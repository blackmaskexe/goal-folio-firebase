/**
 * Stock price Cloud Functions - Simplified
 * Provides callable functions for fetching intraday stock prices
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { alphaVantageApiKey } from "../config";
import {
  fetchIntradayPrices as fetchPricesService,
  getRecentOpenDayCandles as getRecentCandlesService,
} from "../services/alphavantage.service";

/**
 * Fetch intraday prices for a stock
 * Returns: { symbol, interval, candles }
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

    const prices = await fetchPricesService(
      alphaVantageApiKey.value(),
      symbol.toUpperCase(),
      interval as any,
      outputSize as any,
      adjusted,
      extendedHours,
      month
    );

    return {
      symbol: symbol.toUpperCase(),
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
 */
export const getRecentOpenDay = onCall(
  { secrets: [alphaVantageApiKey] },
  async (request) => {
    const symbol = request.data.symbol as string;
    const requestedInterval = (request.data.interval as string) || "15min";

    if (!symbol || symbol.trim().length === 0) {
      throw new HttpsError("invalid-argument", "Symbol is required");
    }

    // Default to 60min if invalid interval
    const validIntervals = ["1min", "5min", "15min", "30min", "60min"];
    const interval = validIntervals.includes(requestedInterval)
      ? requestedInterval
      : "60min";

    const candles = await getRecentCandlesService(
      alphaVantageApiKey.value(),
      symbol.toUpperCase(),
      interval as any
    );

    // Get the trading day date if we have candles
    const tradingDay =
      candles.length > 0 ? candles[0].time.toISOString().split("T")[0] : null;

    return {
      symbol: symbol.toUpperCase(),
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
