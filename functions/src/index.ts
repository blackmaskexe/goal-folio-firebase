/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

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
export {
  refreshStockCache,
  triggerRefreshNow,
} from "./functions/refreshStocks";
export { searchStocks, getStock } from "./functions/searchStocks";
export { getIntradayPrices, getRecentOpenDay } from "./functions/stockPrices";
