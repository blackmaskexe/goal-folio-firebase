/**
 * Configuration and environment variables
 */

import { defineSecret } from "firebase-functions/params";

/**
 * Alpha Vantage API key from Firebase secrets
 * Set using: firebase functions:secrets:set ALPHA_VANTAGE_API_KEY
 */
export const alphaVantageApiKey = defineSecret("ALPHA_VANTAGE_API_KEY");

/**
 * Optional: Refresh secret for manual trigger authentication
 * Set using: firebase functions:secrets:set REFRESH_SECRET
 */
export const refreshSecret = defineSecret("REFRESH_SECRET");

/**
 * Alpha Vantage API configuration
 */
export const ALPHA_VANTAGE_CONFIG = {
  baseUrl: "https://www.alphavantage.co/query",
  searchFunction: "SYMBOL_SEARCH",
  rateLimit: {
    maxRequestsPerMinute: 5, // Free tier limit
    maxRequestsPerDay: 500, // Free tier daily limit
  },
};

/**
 * Firestore collection names
 */
export const COLLECTIONS = {
  stocks: "stocks",
  apiUsage: "apiUsage", // Track API usage to avoid rate limits
};

/**
 * Cache configuration
 */
export const CACHE_CONFIG = {
  stockDataTTL: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  refreshSchedule: "0 2 * * *", // Daily at 2 AM (cron format)
};
