import { setGlobalOptions } from "firebase-functions/v2";
import * as admin from "firebase-admin";

// Set global options for all functions
setGlobalOptions({
  maxInstances: 10,
  region: "us-central1",
});

// Initialize Firebase Admin
admin.initializeApp();

// Export all Cloud Functions
export { searchStocks, getStock } from "./functions/searchStocks";
export { getIntradayPrices, getRecentOpenDay } from "./functions/stockPrices";
