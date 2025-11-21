/**
 * Cache Helper Service
 * Provides smart cache lookup with fallbacks
 */

import { getCachedIntradayPrices } from "./priceCache.service";
import { PriceCandle } from "./priceCache.service";
import { logInfo } from "../utils/logger";
import { toDateString } from "../utils/date";

/**
 * Get cached stock data for today using 15min interval.
 * Used by getRecentOpenDay to find the last cached trading day.
 */
export async function getRecentCachedStockData(
  normalizedSymbol: string
): Promise<PriceCandle[] | null> {
  const interval = "15min";
  const dateStr = toDateString();

  logInfo(`Checking cache: ${dateStr} with ${interval}`, {
    symbol: normalizedSymbol,
  });

  const cachedPrices = await getCachedIntradayPrices(
    normalizedSymbol,
    dateStr,
    interval
  );

  if (cachedPrices && cachedPrices.length > 0) {
    logInfo("Cache hit", {
      symbol: normalizedSymbol,
      date: dateStr,
      interval,
      count: cachedPrices.length,
    });
    return cachedPrices;
  }

  logInfo("No cached data found for today", {
    symbol: normalizedSymbol,
    date: dateStr,
  });

  return null;
}
