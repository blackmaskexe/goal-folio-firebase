import { defineSecret } from "firebase-functions/params";

export const alphaVantageApiKey = defineSecret("ALPHA_VANTAGE_API_KEY");

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
