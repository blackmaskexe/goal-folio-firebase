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

export interface IntradayPricesQuery {
  symbol?: string;
  interval?: string;
  outputSize?: string;
  adjusted?: string;
  extendedHours?: string;
  month?: string;
}

/**
 * Query parameters for recent open day endpoint
 * All query params are strings from HTTP request
 * All fields are optional since query params may not be present
 */
export interface RecentOpenDayQuery {
  symbol?: string;
  interval?: string;
}

/**
 * Request body for search stocks endpoint
 */
export interface SearchStocksBody {
  q: string;
  limit?: string | number;
}

/**
 * Query/Body parameters for get stock endpoint
 */
export interface GetStockParams {
  symbol: string;
}
