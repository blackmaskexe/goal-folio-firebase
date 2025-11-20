/**
 * Stock-related type definitions
 */

/**
 * Stock data as received from Alpha Vantage API
 * API returns fields with numeric prefixes like "1. symbol"
 */
export interface AlphaVantageStock {
  "1. symbol": string;
  "2. name": string;
  "3. type": string; // e.g., "Equity", "ETF"
  "4. region": string; // e.g., "United States"
  "5. marketOpen": string; // e.g., "09:30"
  "6. marketClose": string; // e.g., "16:00"
  "7. timezone": string; // e.g., "UTC-04"
  "8. currency": string; // e.g., "USD"
  "9. matchScore": string; // e.g., "1.0000"
}

/**
 * Stock data in normalized format for internal use
 */
export interface Stock {
  symbol: string;
  name: string;
  type?: string; // e.g., "Equity", "ETF"
  region?: string; // e.g., "United States"
  currency?: string; // e.g., "USD"
}

/**
 * Stock document as stored in Firestore
 * Includes additional metadata for caching
 */
export interface StockDocument extends Stock {
  lastUpdated: FirebaseFirestore.Timestamp;
  searchName: string; // lowercase name for efficient searching
  searchSymbol: string; // lowercase symbol for efficient searching
}

/**
 * Response from Alpha Vantage search endpoint
 */
export interface AlphaVantageSearchResponse {
  bestMatches?: AlphaVantageStock[];
}

/**
 * Batch operation result
 */
export interface BatchResult {
  success: boolean;
  processedCount: number;
  errors?: string[];
}

/**
 * Stock candle/price data point (OHLCV)
 * Represents a single price point in time series data
 */
export interface StockCandle {
  time: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Raw time series data point from Alpha Vantage API
 */
export interface TimeSeriesDataPoint {
  "1. open": string;
  "2. high": string;
  "3. low": string;
  "4. close": string;
  "5. volume": string;
}

/**
 * Alpha Vantage Time Series Intraday metadata
 */
export interface IntradayMetaData {
  "1. Information": string;
  "2. Symbol": string;
  "3. Last Refreshed": string;
  "4. Interval": string;
  "5. Output Size": string;
  "6. Time Zone": string;
}

/**
 * Alpha Vantage Time Series Intraday response structure
 * Based on official API documentation
 */
export interface TimeSeriesIntradayResponse {
  "Meta Data"?: IntradayMetaData;
  "Time Series (1min)"?: Record<string, TimeSeriesDataPoint>;
  "Time Series (5min)"?: Record<string, TimeSeriesDataPoint>;
  "Time Series (15min)"?: Record<string, TimeSeriesDataPoint>;
  "Time Series (30min)"?: Record<string, TimeSeriesDataPoint>;
  "Time Series (60min)"?: Record<string, TimeSeriesDataPoint>;
  "Error Message"?: string;
  Note?: string; // Rate limit warning
}

/**
 * Query parameters for intraday prices endpoint
 * All query params are strings from HTTP request
 * All fields are optional since query params may not be present
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
  q?: string;
  limit?: string | number;
}

/**
 * Query/Body parameters for get stock endpoint
 */
export interface GetStockParams {
  symbol?: string;
}
