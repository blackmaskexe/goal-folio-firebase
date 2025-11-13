/**
 * Stock refresh Cloud Functions
 * Handles scheduled and manual refresh of stock data from Alpha Vantage
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { alphaVantageApiKey, refreshSecret, CACHE_CONFIG } from "../config";
import { searchStocks } from "../services/alphavantage.service";
import { upsertStocks } from "../services/firestore.service";
import { logInfo, logError, logExecutionTime } from "../utils/logger";
import { Stock } from "../types/stock";

/**
 * Scheduled function to refresh stock cache
 * Runs daily at 2 AM (configured in CACHE_CONFIG.refreshSchedule)
 */
export const refreshStockCache = onSchedule(
  {
    schedule: CACHE_CONFIG.refreshSchedule,
    timeZone: "America/New_York",
    secrets: [alphaVantageApiKey],
  },
  async (event) => {
    const startTime = Date.now();
    logInfo("Starting scheduled stock cache refresh");

    try {
      await refreshStockData(alphaVantageApiKey.value());
      logExecutionTime("refreshStockCache", startTime);
    } catch (error) {
      logError("Scheduled stock refresh failed", error);
      throw error;
    }
  }
);

/**
 * Manual trigger to refresh stock cache
 * Protected by a secret key for security
 */
export const triggerRefreshNow = onRequest(
  {
    secrets: [alphaVantageApiKey, refreshSecret],
  },
  async (req, res) => {
    const startTime = Date.now();

    // Verify the refresh secret
    const providedSecret = req.get("X-Refresh-Secret") || req.query.secret;
    if (providedSecret !== refreshSecret.value()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      logInfo("Manual stock refresh triggered");
      const result = await refreshStockData(alphaVantageApiKey.value());

      logExecutionTime("triggerRefreshNow", startTime);
      res.status(200).json({
        success: true,
        message: "Stock cache refreshed successfully",
        stocksProcessed: result.stocksProcessed,
        durationMs: Date.now() - startTime,
      });
    } catch (error) {
      logError("Manual stock refresh failed", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * Core refresh logic
 * This is a placeholder - you'll need to provide a list of stock symbols to refresh
 */
async function refreshStockData(
  apiKey: string
): Promise<{ stocksProcessed: number }> {
  const db = admin.firestore();

  // TODO: Implement your stock list strategy
  // Options:
  // 1. Maintain a predefined list of popular stocks
  // 2. Fetch from a watchlist collection in Firestore
  // 3. Use a CSV file of stock symbols
  // 4. Fetch trending stocks from another API

  // Example: Refresh a few major stocks
  const popularStocks = [
    "AAPL",
    "GOOGL",
    "MSFT",
    "AMZN",
    "TSLA",
    "META",
    "NVDA",
  ];

  const allStocks: Stock[] = [];

  for (const symbol of popularStocks) {
    try {
      // Search for each stock to get updated information
      const stocks = await searchStocks(apiKey, symbol);
      if (stocks.length > 0) {
        // Take the best match (first result)
        allStocks.push(stocks[0]);
      }

      // Add a small delay to respect rate limits (5 requests per minute)
      await new Promise((resolve) => setTimeout(resolve, 12000)); // 12 seconds
    } catch (error) {
      logError(`Failed to fetch stock: ${symbol}`, error);
      // Continue with other stocks even if one fails
    }
  }

  // Batch upsert all fetched stocks
  if (allStocks.length > 0) {
    await upsertStocks(db, allStocks);
  }

  logInfo(`Refresh complete. Processed ${allStocks.length} stocks`);

  return {
    stocksProcessed: allStocks.length,
  };
}

/**
 * Helper function to fetch stocks from a watchlist collection
 * This is an example of how you might structure this
 *
 * @example
 * const symbols = await getWatchlistSymbols(db);
 */
export async function getWatchlistSymbols(
  db: admin.firestore.Firestore
): Promise<string[]> {
  try {
    const snapshot = await db.collection("watchlist").get();
    return snapshot.docs.map((doc) => doc.data().symbol as string);
  } catch (error) {
    logError("Failed to fetch watchlist symbols", error);
    return [];
  }
}
