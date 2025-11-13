/**
 * Firestore service
 * Handles all Firestore CRUD operations for stocks
 */

import * as admin from "firebase-admin";
import { Stock, StockDocument } from "../types/stock";
import { COLLECTIONS } from "../config";
import { logInfo, logError } from "../utils/logger";
import { batchUpsert } from "../utils/batching";

/**
 * Convert Stock to StockDocument with search fields
 */
export function stockToDocument(stock: Stock): StockDocument {
  return {
    ...stock,
    searchSymbol: stock.symbol.toLowerCase(),
    searchName: stock.name.toLowerCase(),
    lastUpdated: admin.firestore.Timestamp.now(),
  };
}

/**
 * Upsert a single stock into Firestore
 */
export async function upsertStock(
  db: admin.firestore.Firestore,
  stock: Stock
): Promise<void> {
  try {
    const stockDoc = stockToDocument(stock);
    const docRef = db.collection(COLLECTIONS.stocks).doc(stock.symbol);
    await docRef.set(stockDoc, { merge: true });
    logInfo(`Upserted stock: ${stock.symbol}`);
  } catch (error) {
    logError(`Failed to upsert stock: ${stock.symbol}`, error);
    throw error;
  }
}

/**
 * Batch upsert multiple stocks
 */
export async function upsertStocks(
  db: admin.firestore.Firestore,
  stocks: Stock[]
): Promise<void> {
  try {
    const stockDocs = stocks.map(stockToDocument);
    const result = await batchUpsert(
      db,
      COLLECTIONS.stocks,
      stockDocs,
      "symbol"
    );

    if (result.success) {
      logInfo(`Successfully upserted ${stocks.length} stocks`);
    } else {
      logError(`Failed to upsert some stocks`, undefined, {
        errors: result.errors,
        processedCount: result.processedCount,
      });
    }
  } catch (error) {
    logError("Failed to batch upsert stocks", error);
    throw error;
  }
}

/**
 * Search stocks by symbol prefix
 */
export async function searchStocksBySymbol(
  db: admin.firestore.Firestore,
  symbolPrefix: string,
  limit = 10
): Promise<StockDocument[]> {
  try {
    const searchTerm = symbolPrefix.toLowerCase();
    const snapshot = await db
      .collection(COLLECTIONS.stocks)
      .where("searchSymbol", ">=", searchTerm)
      .where("searchSymbol", "<=", searchTerm + "\uf8ff")
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => doc.data() as StockDocument);
  } catch (error) {
    logError("Failed to search stocks by symbol", error, { symbolPrefix });
    throw error;
  }
}

/**
 * Search stocks by name prefix
 */
export async function searchStocksByName(
  db: admin.firestore.Firestore,
  namePrefix: string,
  limit = 10
): Promise<StockDocument[]> {
  try {
    const searchTerm = namePrefix.toLowerCase();
    const snapshot = await db
      .collection(COLLECTIONS.stocks)
      .where("searchName", ">=", searchTerm)
      .where("searchName", "<=", searchTerm + "\uf8ff")
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => doc.data() as StockDocument);
  } catch (error) {
    logError("Failed to search stocks by name", error, { namePrefix });
    throw error;
  }
}

/**
 * Get a stock by symbol
 */
export async function getStockBySymbol(
  db: admin.firestore.Firestore,
  symbol: string
): Promise<StockDocument | null> {
  try {
    const docRef = db.collection(COLLECTIONS.stocks).doc(symbol);
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    return doc.data() as StockDocument;
  } catch (error) {
    logError("Failed to get stock by symbol", error, { symbol });
    throw error;
  }
}

/**
 * Get all stocks (use with caution - can be large)
 */
export async function getAllStocks(
  db: admin.firestore.Firestore,
  limit?: number
): Promise<StockDocument[]> {
  try {
    let query: admin.firestore.Query = db.collection(COLLECTIONS.stocks);

    if (limit) {
      query = query.limit(limit);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => doc.data() as StockDocument);
  } catch (error) {
    logError("Failed to get all stocks", error);
    throw error;
  }
}

/**
 * Delete stocks older than a certain date
 */
export async function deleteOldStocks(
  db: admin.firestore.Firestore,
  olderThanDate: Date
): Promise<number> {
  try {
    const timestamp = admin.firestore.Timestamp.fromDate(olderThanDate);
    const snapshot = await db
      .collection(COLLECTIONS.stocks)
      .where("lastUpdated", "<", timestamp)
      .get();

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    logInfo(`Deleted ${snapshot.size} old stocks`);
    return snapshot.size;
  } catch (error) {
    logError("Failed to delete old stocks", error);
    throw error;
  }
}
