/**
 * Alpha Vantage API service
 * Handles all interactions with the Alpha Vantage API
 */

import { ALPHA_VANTAGE_CONFIG } from "../config";
import {
  Stock,
  AlphaVantageSearchResponse,
  StockCandle,
  TimeSeriesIntradayResponse,
} from "../types/stock";
import { logApiCall, logError, logWarn } from "../utils/logger";

/**
 * Search for stocks by symbol or name
 */
export async function searchStocks(
  apiKey: string,
  keywords: string
): Promise<Stock[]> {
  try {
    const url = new URL(ALPHA_VANTAGE_CONFIG.baseUrl);
    url.searchParams.append("function", ALPHA_VANTAGE_CONFIG.searchFunction);
    url.searchParams.append("keywords", keywords);
    url.searchParams.append("apikey", apiKey);

    logApiCall("Alpha Vantage", "SYMBOL_SEARCH", { keywords });

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as AlphaVantageSearchResponse;

    // Check for API error messages
    if ("Error Message" in data) {
      throw new Error(
        `Alpha Vantage API error: ${(data as any)["Error Message"]}`
      );
    }

    if ("Note" in data) {
      // Rate limit warning
      logWarn("Alpha Vantage rate limit warning", { note: (data as any).Note });
      return [];
    }

    return data.bestMatches || [];
  } catch (error) {
    logError("Failed to search stocks from Alpha Vantage", error, { keywords });
    throw error;
  }
}

/**
 * Fetch stock quote (real-time price)
 * Can be extended later for price tracking
 */
export async function getStockQuote(
  apiKey: string,
  symbol: string
): Promise<any> {
  try {
    const url = new URL(ALPHA_VANTAGE_CONFIG.baseUrl);
    url.searchParams.append("function", "GLOBAL_QUOTE");
    url.searchParams.append("symbol", symbol);
    url.searchParams.append("apikey", apiKey);

    logApiCall("Alpha Vantage", "GLOBAL_QUOTE", { symbol });

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    if ("Error Message" in data) {
      throw new Error(`Alpha Vantage API error: ${data["Error Message"]}`);
    }

    if ("Note" in data) {
      logWarn("Alpha Vantage rate limit warning", { note: data.Note });
      return null;
    }

    return data["Global Quote"] || null;
  } catch (error) {
    logError("Failed to fetch stock quote from Alpha Vantage", error, {
      symbol,
    });
    throw error;
  }
}

/**
 * Check if we're within rate limits
 * This is a placeholder - you should implement actual rate limiting
 * using Firestore to track API calls
 */
export function checkRateLimit(): boolean {
  // TODO: Implement actual rate limit checking using Firestore
  // Track API calls per minute and per day
  return true;
}

/**
 * Fetch intraday prices for a stock symbol
 * Equivalent to Swift's fetchIntradayPrices function
 *
 * @param apiKey - Alpha Vantage API key
 * @param symbol - Stock symbol (e.g., "AAPL")
 * @param interval - Time interval: "1min", "5min", "15min", "30min", "60min" (default: "15min")
 * @param outputSize - "compact" (latest 100 data points) or "full" (trailing 30 days or full month) (default: "compact")
 * @param adjusted - Split/dividend-adjusted data (default: true)
 * @param extendedHours - Include pre-market and post-market hours (default: false)
 * @param month - Query specific month in YYYY-MM format (e.g., "2009-01") (optional)
 * @returns Array of StockCandle objects sorted by time
 */
export async function fetchIntradayPrices(
  apiKey: string,
  symbol: string,
  interval: "1min" | "5min" | "15min" | "30min" | "60min" = "15min",
  outputSize: "compact" | "full" = "compact",
  adjusted = true,
  extendedHours = false,
  month?: string
): Promise<StockCandle[]> {
  try {
    const url = new URL(ALPHA_VANTAGE_CONFIG.baseUrl);
    url.searchParams.append("function", "TIME_SERIES_INTRADAY");
    url.searchParams.append("symbol", symbol);
    url.searchParams.append("interval", interval);
    url.searchParams.append("apikey", apiKey);
    url.searchParams.append("outputsize", outputSize);
    url.searchParams.append("adjusted", String(adjusted));
    url.searchParams.append("extended_hours", String(extendedHours));

    // Add month parameter if specified
    if (month) {
      url.searchParams.append("month", month);
    }

    logApiCall("Alpha Vantage", "TIME_SERIES_INTRADAY", {
      symbol,
      interval,
      outputSize,
      adjusted,
      extendedHours,
      month,
    });

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as TimeSeriesIntradayResponse;

    // Check for API error messages
    if (data["Error Message"]) {
      throw new Error(`Alpha Vantage API error: ${data["Error Message"]}`);
    }

    if (data.Note) {
      // Rate limit warning
      logWarn("Alpha Vantage rate limit warning", { note: data.Note });
      return [];
    }

    // Get the time series data based on interval
    const timeSeriesKey =
      `Time Series (${interval})` as keyof TimeSeriesIntradayResponse;
    const timeSeries = data[timeSeriesKey];

    if (!timeSeries) {
      throw new Error(`Time Series (${interval}) not found in response`);
    }

    // Parse the time series data into StockCandle objects
    const prices: StockCandle[] = Object.entries(timeSeries).map(
      ([timestamp, dataPoint]) => {
        // Parse timestamp (format: "yyyy-MM-dd HH:mm:ss")
        // Alpha Vantage API returns timestamps in US/Eastern timezone
        // Convert to proper Date object
        const date = parseEasternTime(timestamp);

        return {
          time: date,
          open: parseFloat(dataPoint["1. open"]),
          high: parseFloat(dataPoint["2. high"]),
          low: parseFloat(dataPoint["3. low"]),
          close: parseFloat(dataPoint["4. close"]),
          volume: parseInt(dataPoint["5. volume"], 10),
        };
      }
    );

    // Sort by time (ascending)
    return prices.sort((a, b) => a.time.getTime() - b.time.getTime());
  } catch (error) {
    logError("Failed to fetch intraday prices from Alpha Vantage", error, {
      symbol,
      interval,
    });
    throw error;
  }
}

/**
 * Parse a timestamp from Alpha Vantage (US/Eastern timezone) to a Date object
 * Format: "yyyy-MM-dd HH:mm:ss"
 *
 * @param timestamp - Timestamp string from Alpha Vantage
 * @returns Date object in UTC
 */
function parseEasternTime(timestamp: string): Date {
  // Alpha Vantage returns timestamps in US/Eastern Time
  // We need to properly convert to UTC
  const [datePart, timePart] = timestamp.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second] = timePart.split(":").map(Number);

  // Create date in Eastern Time
  // Note: This is a simplified approach. For production, consider using a library like date-fns-tz
  // Eastern Time is UTC-5 (EST) or UTC-4 (EDT during daylight saving time)
  // For simplicity, we'll assume EST (UTC-5) - you may want to handle DST properly
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  // Adjust for Eastern Time offset (UTC-5)
  // Add 5 hours to convert from EST to UTC
  date.setUTCHours(date.getUTCHours() + 5);

  return date;
}

/**
 * Get candles for the most recent open trading day
 * Equivalent to Swift's getRecentOpenDayCandles function
 *
 * @param apiKey - Alpha Vantage API key
 * @param symbol - Stock symbol (e.g., "AAPL")
 * @param interval - Time interval (default: "15min")
 * @returns Array of StockCandle objects for the last open trading day
 */
export async function getRecentOpenDayCandles(
  apiKey: string,
  symbol: string,
  interval: "1min" | "5min" | "15min" | "30min" | "60min" = "15min"
): Promise<StockCandle[]> {
  try {
    // 1. Fetch intraday prices
    const stockPrices = await fetchIntradayPrices(apiKey, symbol, interval);

    if (stockPrices.length === 0) {
      return [];
    }

    // 2. Find the last entry - this is the most recent trading day
    const lastOpenDate = stockPrices[stockPrices.length - 1].time;

    // 3. Filter all candles from the same day
    const lastOpenDayCandles = stockPrices.filter((candle) => {
      return isSameDay(lastOpenDate, candle.time);
    });

    return lastOpenDayCandles;
  } catch (error) {
    logError("Failed to get recent open day candles", error, {
      symbol,
      interval,
    });
    throw error;
  }
}

/**
 * Helper function to check if two dates are on the same day
 */
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}
