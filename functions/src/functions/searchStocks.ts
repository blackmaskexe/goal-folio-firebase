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
} from "../services/firestore.service";
import { logInfo, logError, logWarn } from "../utils/logger";
import { StockDocument } from "../types/stock";

/**
 * Search stocks endpoint
 *
 * Query parameters:
 * - q: search query (symbol or name)
 * - type: "symbol" or "name" (default: "symbol")
 * - limit: max results (default: 10, max: 50)
 *
 * Example:
 * GET /searchStocks?q=AAPL
 * GET /searchStocks?q=apple&type=name&limit=5
 */
export const searchStocks = onRequest(
  {
    cors: true, // Enable CORS for frontend access
  },
  async (req, res) => {
    // Only allow GET requests
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const query = req.query.q as string;
    const searchType = (req.query.type as string) || "symbol";
    const limitParam = parseInt(req.query.limit as string) || 10;
    const limit = Math.min(limitParam, 50); // Cap at 50 results

    // Validate query parameter
    if (!query || query.trim().length === 0) {
      res.status(400).json({
        error: "Missing or empty query parameter 'q'",
      });
      return;
    }

    if (query.length < 1) {
      res.status(400).json({
        error: "Query must be at least 1 character long",
      });
      return;
    }

    try {
      const db = admin.firestore();
      let results: StockDocument[] = [];

      logInfo("Stock search request", { query, searchType, limit });

      // If query looks like a complete symbol, try exact match first
      if (searchType === "symbol" && query.length <= 5) {
        const exactMatch = await getStockBySymbol(db, query.toUpperCase());
        if (exactMatch) {
          results = [exactMatch];
        }
      }

      // If no exact match, do prefix search
      if (results.length === 0) {
        if (searchType === "name") {
          results = await searchStocksByName(db, query, limit);
        } else {
          results = await searchStocksBySymbol(db, query, limit);
        }
      }

      // If still no results, try the other search type
      if (results.length === 0) {
        logWarn("No results found, trying alternate search type", {
          query,
          searchType,
        });
        if (searchType === "symbol") {
          results = await searchStocksByName(db, query, limit);
        } else {
          results = await searchStocksBySymbol(db, query, limit);
        }
      }

      res.status(200).json({
        success: true,
        query,
        searchType,
        count: results.length,
        results: results.map((stock) => ({
          symbol: stock.symbol,
          name: stock.name,
          type: stock.type,
          region: stock.region,
          currency: stock.currency,
          matchScore: stock.matchScore,
        })),
      });
    } catch (error) {
      logError("Stock search failed", error, { query, searchType });
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
 * Example:
 * GET /getStock?symbol=AAPL
 */
export const getStock = onRequest(
  {
    cors: true,
  },
  async (req, res) => {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const symbol = req.query.symbol as string;

    if (!symbol || symbol.trim().length === 0) {
      res.status(400).json({
        error: "Missing or empty query parameter 'symbol'",
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
