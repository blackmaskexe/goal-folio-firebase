/**
 * Cache Helper Service
 * Provides smart cache lookup with fallbacks
 */

import { getCachedIntradayPrices } from "./priceCache.service";
import { PriceCandle } from "./priceCache.service";
import { logInfo } from "../utils/logger";
import { getDaysAgoString } from "../utils/date";

/**
 * Smart cache lookup that tries multiple strategies:
 * 1. Exact date and interval match
 * 2. Recent dates (up to 5 days back)
 * 3. Any available interval for the date
 */
export async function findRecentCachedData(
  symbol: string,
  preferredInterval: string
): Promise<{ candles: PriceCandle[]; actualInterval: string } | null> {
  const normalizedSymbol = symbol.toUpperCase();
  const intervals = ["15min", "60min", "30min", "5min", "1min"];

  // Try up to 5 days back
  for (let daysBack = 0; daysBack <= 5; daysBack++) {
    const dateStr = getDaysAgoString(daysBack);

    // First try preferred interval
    logInfo(`Checking cache: ${dateStr} with ${preferredInterval}`, {
      symbol: normalizedSymbol,
      daysBack,
    });

    let cachedPrices = await getCachedIntradayPrices(
      normalizedSymbol,
      dateStr,
      preferredInterval
    );

    if (cachedPrices && cachedPrices.length > 0) {
      logInfo("Cache hit with preferred interval", {
        symbol: normalizedSymbol,
        date: dateStr,
        interval: preferredInterval,
        count: cachedPrices.length,
      });
      return { candles: cachedPrices, actualInterval: preferredInterval };
    }

    // If not found, try other intervals for this date
    for (const interval of intervals) {
      if (interval === preferredInterval) continue; // Already tried

      cachedPrices = await getCachedIntradayPrices(
        normalizedSymbol,
        dateStr,
        interval
      );

      if (cachedPrices && cachedPrices.length > 0) {
        logInfo("Cache hit with different interval", {
          symbol: normalizedSymbol,
          date: dateStr,
          requestedInterval: preferredInterval,
          foundInterval: interval,
          count: cachedPrices.length,
        });
        return { candles: cachedPrices, actualInterval: interval };
      }
    }
  }

  logInfo("No cached data found for any recent date or interval", {
    symbol: normalizedSymbol,
  });

  return null;
}
