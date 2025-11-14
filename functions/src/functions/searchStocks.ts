/**
 * Stock search Cloud Function
 * Provides HTTP endpoint for searching stocks from cached Firestore data
 */

import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {
  searchStocksBySymbol,
  searchStocksByName,
  getStockBySymbol,
  upsertStocks,
} from "../services/firestore.service";
import { searchStocks as searchAlphaVantage } from "../services/alphavantage.service";
import { alphaVantageApiKey } from "../config";
import { logInfo, logError } from "../utils/logger";
import { StockDocument } from "../types/stock";

/**
 * Search stocks endpoint
 *
 * Smart caching strategy:
 * 1. First checks Firestore cache for matching stocks (searches both symbol AND name)
 * 2. If no results found, calls Alpha Vantage API
 * 3. Caches API results in Firestore for future queries
 * 4. Returns results to user
 *
 * POST /searchStocks
 * Content-Type: application/json
 * {
 *   "q": "AAPL",       // searches both symbol and name
 *   "limit": 10        // optional: max results (default: 10, max: 50)
 * }
 */
export const searchStocks = onRequest(
  {
    cors: true,
    secrets: [alphaVantageApiKey],
  },
  async (req, res) => {
    // Only allow POST requests
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed. Use POST" });
      return;
    }

    // Get parameters from request body
    const query = req.body?.q as string;
    const limitParam = parseInt(req.body?.limit as string) || 10;
    const limit = Math.min(limitParam, 50); // Cap at 50 results

    // Validate query parameter
    if (!query || query.trim().length === 0) {
      res.status(400).json({
        error: "Missing or empty 'q' in request body",
      });
      return;
    }

    try {
      const db = admin.firestore();
      let results: StockDocument[] = [];
      let fromCache = true;

      logInfo("Stock search request", { query, limit });

      // STEP 1: Check Firestore cache first
      // Search both symbol AND name simultaneously
      const [symbolResults, nameResults] = await Promise.all([
        searchStocksBySymbol(db, query, limit),
        searchStocksByName(db, query, limit),
      ]);

      // Combine results and remove duplicates
      const combinedResults = [...symbolResults, ...nameResults];
      const uniqueResults = new Map<string, StockDocument>();

      for (const stock of combinedResults) {
        if (!uniqueResults.has(stock.symbol)) {
          uniqueResults.set(stock.symbol, stock);
        }
      }

      results = Array.from(uniqueResults.values()).slice(0, limit);

      // STEP 2: If still no results, call Alpha Vantage API
      if (results.length === 0) {
        logInfo("No results in cache, calling Alpha Vantage API", { query });
        fromCache = false;

        try {
          const apiResults = await searchAlphaVantage(
            alphaVantageApiKey.value(),
            query
          );

          if (apiResults.length > 0) {
            // STEP 3: Cache all results from API
            logInfo(`Caching ${apiResults.length} stocks from API`, { query });
            await upsertStocks(db, apiResults);

            // Convert to StockDocument format for response
            // Fetch them back from Firestore to get the full StockDocument structure
            const symbols = apiResults.map((s) => s.symbol);
            const cachedResults = await Promise.all(
              symbols.map((symbol) => getStockBySymbol(db, symbol))
            );

            results = cachedResults.filter(
              (r): r is StockDocument => r !== null
            );
          }
        } catch (apiError) {
          logError("Alpha Vantage API call failed", apiError, { query });
          // Don't throw - return empty results with error info
          res.status(200).json({
            success: true,
            query,
            count: 0,
            results: [],
            fromCache: false,
            apiError:
              apiError instanceof Error ? apiError.message : "API call failed",
          });
          return;
        }
      }

      // STEP 4: Return results
      res.status(200).json({
        success: true,
        query,
        count: results.length,
        fromCache,
        results: results.map((stock) => ({
          symbol: stock.symbol,
          name: stock.name,
          type: stock.type,
          region: stock.region,
          currency: stock.currency,
        })),
      });
    } catch (error) {
      logError("Stock search failed", error, { query });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }
);

/**
 * Get stock details by symbol
 *
 * Accepts both GET (query params) and POST (JSON body):
 *
 * GET /getStock?symbol=AAPL
 *
 * POST /getStock
 * Content-Type: application/json
 * { "symbol": "AAPL" }
 */
export const getStock = onRequest(
  {
    cors: true,
  },
  async (req, res) => {
    // Allow both GET and POST
    if (req.method !== "GET" && req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed. Use GET or POST" });
      return;
    }

    // Get symbol from query params (GET) or request body (POST)
    const symbol =
      req.method === "POST"
        ? (req.body?.symbol as string)
        : (req.query.symbol as string);

    if (!symbol || symbol.trim().length === 0) {
      res.status(400).json({
        error:
          req.method === "POST"
            ? "Missing or empty 'symbol' in request body"
            : "Missing or empty query parameter 'symbol'",
      });
      return;
    }

    try {
      const db = admin.firestore();
      const stock = await getStockBySymbol(db, symbol.toUpperCase());

      if (!stock) {
        res.status(404).json({
          success: false,
          error: "Stock not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        result: {
          symbol: stock.symbol,
          name: stock.name,
          type: stock.type,
          region: stock.region,
          currency: stock.currency,
          lastUpdated: stock.lastUpdated.toDate().toISOString(),
        },
      });
    } catch (error) {
      logError("Get stock failed", error, { symbol });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }
);
