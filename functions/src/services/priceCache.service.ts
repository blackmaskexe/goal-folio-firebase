/**
 * Price Cache Service
 * Handles caching of stock price data in Firestore with multiple granularities
 */

import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { logInfo, logError } from "../utils/logger";

const db = getFirestore();

// Cache TTL configurations
const CACHE_TTL = {
  intraday: 15 * 60 * 1000, // 15 minutes during market hours
  intradayAfterClose: 24 * 60 * 60 * 1000, // 24 hours after market close
  daily: 24 * 60 * 60 * 1000, // 24 hours
  weekly: 7 * 24 * 60 * 60 * 1000, // 7 days
  monthly: 30 * 24 * 60 * 60 * 1000, // 30 days
};

export interface PriceCandle {
  time: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CachedIntradayData {
  date: string; // YYYY-MM-DD
  interval: string;
  symbol: string;
  candles: PriceCandle[];
  lastUpdated: Timestamp | Date;
}

export interface CachedAggregateData {
  symbol: string;
  granularity: "daily" | "weekly" | "monthly";
  prices: Record<string, PriceCandle>; // key: date/week/month string
  lastUpdated: Timestamp | Date;
}

/**
 * Check if market is currently open (rough estimate)
 * US market hours: 9:30 AM - 4:00 PM ET, Mon-Fri
 */
function isMarketOpen(): boolean {
  const now = new Date();
  const et = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const day = et.getDay();
  const hour = et.getHours();
  const minute = et.getMinutes();

  // Weekend
  if (day === 0 || day === 6) return false;

  // Before 9:30 AM or after 4:00 PM ET
  const currentMinutes = hour * 60 + minute;
  const marketOpen = 9 * 60 + 30; // 9:30 AM
  const marketClose = 16 * 60; // 4:00 PM

  return currentMinutes >= marketOpen && currentMinutes < marketClose;
}

/**
 * Get cached intraday prices for a specific date
 */
export async function getCachedIntradayPrices(
  symbol: string,
  date: string,
  interval: string
): Promise<PriceCandle[] | null> {
  try {
    const docRef = db
      .collection("stocks")
      .doc(symbol.toUpperCase())
      .collection("prices")
      .doc(`intraday_${date}`);

    const doc = await docRef.get();

    if (!doc.exists) {
      logInfo("Intraday cache miss", { symbol, date, interval });
      return null;
    }

    const data = doc.data() as CachedIntradayData;

    // Check if interval matches
    if (data.interval !== interval) {
      logInfo("Interval mismatch in cache", {
        symbol,
        cached: data.interval,
        requested: interval,
      });
      return null;
    }

    // Check freshness
    const lastUpdated = data.lastUpdated instanceof Timestamp
      ? data.lastUpdated.toDate()
      : new Date(data.lastUpdated);
    const now = new Date();
    const age = now.getTime() - lastUpdated.getTime();

    // Determine TTL based on market status
    const ttl = isMarketOpen() ? CACHE_TTL.intraday : CACHE_TTL.intradayAfterClose;

    if (age > ttl) {
      logInfo("Intraday cache expired", { symbol, date, age, ttl });
      return null;
    }

    logInfo("Intraday cache hit", { symbol, date, interval });
    return data.candles;
  } catch (error) {
    logError("Error reading intraday cache", error, { symbol, date });
    return null;
  }
}

/**
 * Cache intraday prices for a specific date
 */
export async function cacheIntradayPrices(
  symbol: string,
  date: string,
  interval: string,
  candles: PriceCandle[]
): Promise<void> {
  try {
    const docRef = db
      .collection("stocks")
      .doc(symbol.toUpperCase())
      .collection("prices")
      .doc(`intraday_${date}`);

    const data: CachedIntradayData = {
      date,
      interval,
      symbol: symbol.toUpperCase(),
      candles,
      lastUpdated: new Date(),
    };

    await docRef.set(data);

    logInfo("Cached intraday prices", {
      symbol,
      date,
      interval,
      count: candles.length,
    });
  } catch (error) {
    logError("Error caching intraday prices", error, { symbol, date });
  }
}

/**
 * Get cached aggregate prices (daily, weekly, monthly)
 */
export async function getCachedAggregatePrices(
  symbol: string,
  granularity: "daily" | "weekly" | "monthly"
): Promise<Record<string, PriceCandle> | null> {
  try {
    const docRef = db
      .collection("stocks")
      .doc(symbol.toUpperCase())
      .collection("prices")
      .doc(granularity);

    const doc = await docRef.get();

    if (!doc.exists) {
      logInfo("Aggregate cache miss", { symbol, granularity });
      return null;
    }

    const data = doc.data() as CachedAggregateData;

    // Check freshness
    const lastUpdated = data.lastUpdated instanceof Timestamp
      ? data.lastUpdated.toDate()
      : new Date(data.lastUpdated);
    const now = new Date();
    const age = now.getTime() - lastUpdated.getTime();

    const ttl =
      granularity === "daily"
        ? CACHE_TTL.daily
        : granularity === "weekly"
          ? CACHE_TTL.weekly
          : CACHE_TTL.monthly;

    if (age > ttl) {
      logInfo("Aggregate cache expired", { symbol, granularity, age, ttl });
      return null;
    }

    logInfo("Aggregate cache hit", { symbol, granularity });
    return data.prices;
  } catch (error) {
    logError("Error reading aggregate cache", error, { symbol, granularity });
    return null;
  }
}

/**
 * Cache aggregate prices (daily, weekly, monthly)
 */
export async function cacheAggregatePrices(
  symbol: string,
  granularity: "daily" | "weekly" | "monthly",
  prices: Record<string, PriceCandle>
): Promise<void> {
  try {
    const docRef = db
      .collection("stocks")
      .doc(symbol.toUpperCase())
      .collection("prices")
      .doc(granularity);

    const data: CachedAggregateData = {
      symbol: symbol.toUpperCase(),
      granularity,
      prices,
      lastUpdated: new Date(),
    };

    await docRef.set(data);

    logInfo("Cached aggregate prices", {
      symbol,
      granularity,
      count: Object.keys(prices).length,
    });
  } catch (error) {
    logError("Error caching aggregate prices", error, { symbol, granularity });
  }
}

/**
 * Add or update a single day's data in the daily cache
 */
export async function updateDailyPrice(
  symbol: string,
  date: string,
  candle: PriceCandle
): Promise<void> {
  try {
    const docRef = db
      .collection("stocks")
      .doc(symbol.toUpperCase())
      .collection("prices")
      .doc("daily");

    await docRef.set(
      {
        symbol: symbol.toUpperCase(),
        granularity: "daily",
        [`prices.${date}`]: candle,
        lastUpdated: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    logInfo("Updated daily price", { symbol, date });
  } catch (error) {
    logError("Error updating daily price", error, { symbol, date });
  }
}

/**
 * Aggregate intraday candles to a single daily candle
 */
export function aggregateToDaily(candles: PriceCandle[]): PriceCandle | null {
  if (candles.length === 0) return null;

  const open = candles[0].open;
  const close = candles[candles.length - 1].close;
  const high = Math.max(...candles.map((c) => c.high));
  const low = Math.min(...candles.map((c) => c.low));
  const volume = candles.reduce((sum, c) => sum + c.volume, 0);

  return {
    time: candles[0].time,
    open,
    high,
    low,
    close,
    volume,
  };
}

/**
 * Aggregate daily candles to weekly
 */
export function aggregateToWeekly(
  dailyPrices: Record<string, PriceCandle>
): Record<string, PriceCandle> {
  const weeklyPrices: Record<string, PriceCandle[]> = {};

  // Group by ISO week (YYYY-Www format)
  for (const [dateStr, candle] of Object.entries(dailyPrices)) {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const week = getISOWeek(date);
    const weekKey = `${year}-W${week.toString().padStart(2, "0")}`;

    if (!weeklyPrices[weekKey]) {
      weeklyPrices[weekKey] = [];
    }
    weeklyPrices[weekKey].push(candle);
  }

  // Aggregate each week
  const result: Record<string, PriceCandle> = {};
  for (const [weekKey, candles] of Object.entries(weeklyPrices)) {
    const aggregated = aggregateToDaily(candles);
    if (aggregated) {
      result[weekKey] = aggregated;
    }
  }

  return result;
}

/**
 * Aggregate daily candles to monthly
 */
export function aggregateToMonthly(
  dailyPrices: Record<string, PriceCandle>
): Record<string, PriceCandle> {
  const monthlyPrices: Record<string, PriceCandle[]> = {};

  // Group by month (YYYY-MM format)
  for (const [dateStr, candle] of Object.entries(dailyPrices)) {
    const monthKey = dateStr.substring(0, 7); // YYYY-MM

    if (!monthlyPrices[monthKey]) {
      monthlyPrices[monthKey] = [];
    }
    monthlyPrices[monthKey].push(candle);
  }

  // Aggregate each month
  const result: Record<string, PriceCandle> = {};
  for (const [monthKey, candles] of Object.entries(monthlyPrices)) {
    const aggregated = aggregateToDaily(candles);
    if (aggregated) {
      result[monthKey] = aggregated;
    }
  }

  return result;
}

/**
 * Get ISO week number for a date
 */
function getISOWeek(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}
