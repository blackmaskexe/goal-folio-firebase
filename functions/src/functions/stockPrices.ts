/**
 * Stock price Cloud Functions - Simplified with Caching
 * Provides callable functions for fetching intraday stock prices
 * Implements smart caching to minimize Alpha Vantage API calls
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { alphaVantageApiKey } from "../config";
import {
  fetchIntradayPrices as fetchPricesService,
  getRecentOpenDayCandles as getRecentCandlesService,
} from "../services/alphavantage.service";
import {
  getCachedIntradayPrices,
  cacheIntradayPrices,
  updateDailyPrice,
  aggregateToDaily,
} from "../services/priceCache.service";
import { findRecentCachedData } from "../services/cacheHelper.service";
import { logInfo } from "../utils/logger";
import { getTodayString, toISOString } from "../utils/date";

/**
 * Fetch intraday prices for a stock
 * Returns: { symbol, interval, candles }
 *
 * Caching strategy:
 * 1. Check Firestore cache for today's date
 * 2. If cache hit and fresh → return cached data
 * 3. If cache miss or stale → fetch from Alpha Vantage
 * 4. Cache the fetched data and return
 */
export const getIntradayPrices = onCall(
  { secrets: [alphaVantageApiKey] },
  async (request) => {
    const symbol = request.data.symbol as string;
    const requestedInterval = (request.data.interval as string) || "15min";
    const outputSize = (request.data.outputSize as string) || "compact";
    const adjusted = request.data.adjusted !== false;
    const extendedHours = request.data.extendedHours === true;
    const month = request.data.month as string | undefined;

    if (!symbol || symbol.trim().length === 0) {
      throw new HttpsError("invalid-argument", "Symbol is required");
    }

    // Default to 60min if invalid interval
    const validIntervals = ["1min", "5min", "15min", "30min", "60min"];
    const interval = validIntervals.includes(requestedInterval)
      ? requestedInterval
      : "60min";

    const normalizedSymbol = symbol.toUpperCase();

    // Determine the date we're fetching (today or specific month)
    const today = getTodayString();
    const targetDate = month || today;

    // Try to get from cache first
    logInfo("Checking cache for intraday prices", {
      symbol: normalizedSymbol,
      date: targetDate,
      interval,
    });

    const cachedPrices = await getCachedIntradayPrices(
      normalizedSymbol,
      targetDate,
      interval
    );

    if (cachedPrices) {
      logInfo("Returning cached intraday prices", {
        symbol: normalizedSymbol,
        count: cachedPrices.length,
      });

      return {
        symbol: normalizedSymbol,
        interval,
        candles: cachedPrices.map((candle) => ({
          time: toISOString(candle.time),
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
        })),
      };
    }

    // Cache miss - fetch from Alpha Vantage
    logInfo("Cache miss - fetching from Alpha Vantage", {
      symbol: normalizedSymbol,
      interval,
    });

    const prices = await fetchPricesService(
      alphaVantageApiKey.value(),
      normalizedSymbol,
      interval as any,
      outputSize as any,
      adjusted,
      extendedHours,
      month
    );

    // Cache the fetched prices
    await cacheIntradayPrices(normalizedSymbol, targetDate, interval, prices);

    // Also update the daily aggregate if we have today's complete data
    if (!month && prices.length > 0) {
      const dailyCandle = aggregateToDaily(prices);
      if (dailyCandle) {
        await updateDailyPrice(normalizedSymbol, today, dailyCandle);
      }
    }

    return {
      symbol: normalizedSymbol,
      interval,
      candles: prices.map((candle) => ({
        time: candle.time.toISOString(),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      })),
    };
  }
);

/**
 * Get candles for the most recent open trading day
 * Returns: { symbol, interval, tradingDay, candles }
 *
 * Caching strategy:
 * 1. Check cache for today's trading day
 * 2. If cache hit and fresh → return cached data
 * 3. If cache miss or stale → fetch from Alpha Vantage
 * 4. Cache the fetched data and return
 */
export const getRecentOpenDay = onCall(
  { secrets: [alphaVantageApiKey] },
  async (request) => {
    const symbol = request.data.symbol as string;
    const requestedInterval = (request.data.interval as string) || "60min";

    if (!symbol || symbol.trim().length === 0) {
      throw new HttpsError("invalid-argument", "Symbol is required");
    }

    // Default to 60min if invalid interval
    const validIntervals = ["1min", "5min", "15min", "30min", "60min"];
    const interval = validIntervals.includes(requestedInterval)
      ? requestedInterval
      : "60min";

    const normalizedSymbol = symbol.toUpperCase();
    const today = getTodayString();

    // Try smart cache lookup with fallbacks
    logInfo("Attempting smart cache lookup for recent open day", {
      symbol: normalizedSymbol,
      preferredInterval: interval,
    });

    const cachedData = await findRecentCachedData(normalizedSymbol, interval);

    if (cachedData && cachedData.candles.length > 0) {
      const cachedPrices = cachedData.candles;

      // Convert Date objects to ISO strings if needed
      const tradingDay = toISOString(cachedPrices[0].time).split("T")[0];

      logInfo("Returning cached recent open day (smart lookup)", {
        symbol: normalizedSymbol,
        tradingDay,
        actualInterval: cachedData.actualInterval,
        count: cachedPrices.length,
      });

      return {
        symbol: normalizedSymbol,
        interval: cachedData.actualInterval, // Return the actual interval we found
        tradingDay,
        candles: cachedPrices.map((candle) => ({
          time: toISOString(candle.time),
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
        })),
      };
    }

    // Cache miss - fetch from Alpha Vantage
    logInfo("Cache miss - fetching recent open day from Alpha Vantage", {
      symbol: normalizedSymbol,
      interval,
    });

    const candles = await getRecentCandlesService(
      alphaVantageApiKey.value(),
      normalizedSymbol,
      interval as any
    );

    // Get the trading day date if we have candles
    const tradingDay =
      candles.length > 0 ? candles[0].time.toISOString().split("T")[0] : null;

    // Only cache if we got valid data (not empty due to rate limit)
    if (candles.length > 0) {
      await cacheIntradayPrices(normalizedSymbol, today, interval, candles);

      // Update daily aggregate
      const dailyCandle = aggregateToDaily(candles);
      if (dailyCandle) {
        await updateDailyPrice(normalizedSymbol, today, dailyCandle);
      }
    } else {
      // Empty response - likely rate limit hit
      // Log warning but don't cache
      logInfo("Alpha Vantage returned empty response - possible rate limit", {
        symbol: normalizedSymbol,
      });
    }

    return {
      symbol: normalizedSymbol,
      interval,
      tradingDay,
      candles: candles.map((candle) => ({
        time: candle.time.toISOString(),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      })),
    };
  }
);
