/**
 * Stock price Cloud Functions
 * Provides HTTP endpoints for fetching intraday stock prices
 */

import { onRequest } from "firebase-functions/v2/https";
import { alphaVantageApiKey } from "../config";
import {
  fetchIntradayPrices,
  getRecentOpenDayCandles,
} from "../services/alphavantage.service";
import { logInfo, logError } from "../utils/logger";

/**
 * Get intraday prices for a stock
 *
 * Query parameters:
 * - symbol: stock symbol (required, e.g., "AAPL")
 * - interval: time interval (optional, default: "15min")
 *   Options: "1min", "5min", "15min", "30min", "60min"
 * - outputSize: "compact" or "full" (optional, default: "compact")
 *   compact = latest 100 data points
 *   full = trailing 30 days or full month if month parameter is set
 * - adjusted: "true" or "false" (optional, default: "true")
 *   Split/dividend-adjusted data
 * - extendedHours: "true" or "false" (optional, default: "false")
 *   Include pre-market and post-market hours (4am-8pm ET)
 * - month: YYYY-MM format (optional, e.g., "2024-01")
 *   Query specific month in history
 *
 * Example:
 * GET /getIntradayPrices?symbol=AAPL&interval=15min&outputSize=compact
 * GET /getIntradayPrices?symbol=IBM&interval=5min&month=2024-11&adjusted=false
 */
export const getIntradayPrices = onRequest(
  {
    cors: true,
    secrets: [alphaVantageApiKey],
  },
  async (req, res) => {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const symbol = req.query.symbol as string;
    const interval = (req.query.interval as string) || "15min";
    const outputSize = (req.query.outputSize as string) || "compact";
    const adjusted = req.query.adjusted === "false" ? false : true;
    const extendedHours = req.query.extendedHours === "true" ? true : false;
    const month = req.query.month as string | undefined;

    // Validate required parameters
    if (!symbol || symbol.trim().length === 0) {
      res.status(400).json({
        error: "Missing or empty query parameter 'symbol'",
      });
      return;
    }

    // Validate interval
    const validIntervals = ["1min", "5min", "15min", "30min", "60min"];
    if (!validIntervals.includes(interval)) {
      res.status(400).json({
        error: `Invalid interval. Must be one of: ${validIntervals.join(", ")}`,
      });
      return;
    }

    // Validate output size
    if (outputSize !== "compact" && outputSize !== "full") {
      res.status(400).json({
        error: "Invalid outputSize. Must be 'compact' or 'full'",
      });
      return;
    }

    // Validate month format if provided
    if (month && !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({
        error: "Invalid month format. Must be YYYY-MM (e.g., '2024-01')",
      });
      return;
    }

    try {
      logInfo("Fetching intraday prices", {
        symbol,
        interval,
        outputSize,
        adjusted,
        extendedHours,
        month,
      });

      const prices = await fetchIntradayPrices(
        alphaVantageApiKey.value(),
        symbol.toUpperCase(),
        interval as any,
        outputSize as any,
        adjusted,
        extendedHours,
        month
      );

      res.status(200).json({
        success: true,
        symbol: symbol.toUpperCase(),
        interval,
        outputSize,
        adjusted,
        extendedHours,
        month: month || null,
        count: prices.length,
        prices: prices.map((candle) => ({
          time: candle.time.toISOString(),
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
        })),
      });
    } catch (error) {
      logError("Failed to fetch intraday prices", error, { symbol, interval });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }
);

/**
 * Get candles for the most recent open trading day
 *
 * Query parameters:
 * - symbol: stock symbol (required, e.g., "AAPL")
 * - interval: time interval (optional, default: "15min")
 *   Options: "1min", "5min", "15min", "30min", "60min"
 *
 * Example:
 * GET /getRecentOpenDayCandles?symbol=AAPL&interval=15min
 */
export const getRecentOpenDay = onRequest(
  {
    cors: true,
    secrets: [alphaVantageApiKey],
  },
  async (req, res) => {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const symbol = req.query.symbol as string;
    const interval = (req.query.interval as string) || "15min";

    // Validate required parameters
    if (!symbol || symbol.trim().length === 0) {
      res.status(400).json({
        error: "Missing or empty query parameter 'symbol'",
      });
      return;
    }

    // Validate interval
    const validIntervals = ["1min", "5min", "15min", "30min", "60min"];
    if (!validIntervals.includes(interval)) {
      res.status(400).json({
        error: `Invalid interval. Must be one of: ${validIntervals.join(", ")}`,
      });
      return;
    }

    try {
      logInfo("Fetching recent open day candles", { symbol, interval });

      const candles = await getRecentOpenDayCandles(
        alphaVantageApiKey.value(),
        symbol.toUpperCase(),
        interval as any
      );

      // Get the trading day date if we have candles
      const tradingDay =
        candles.length > 0 ? candles[0].time.toISOString().split("T")[0] : null;

      res.status(200).json({
        success: true,
        symbol: symbol.toUpperCase(),
        interval,
        tradingDay,
        count: candles.length,
        candles: candles.map((candle) => ({
          time: candle.time.toISOString(),
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
        })),
      });
    } catch (error) {
      logError("Failed to fetch recent open day candles", error, {
        symbol,
        interval,
      });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }
);
