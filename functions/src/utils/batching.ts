/**
 * Firestore batch operation utilities
 */

import * as admin from "firebase-admin";
import { logInfo, logWarn } from "./logger";
import { BatchResult } from "../types/stock";

/**
 * Maximum operations per batch (Firestore limit is 500)
 */
const MAX_BATCH_SIZE = 400;

/**
 * Commit batches in chunks to avoid Firestore limits
 */
export async function commitBatches(
  batches: admin.firestore.WriteBatch[]
): Promise<BatchResult> {
  const errors: string[] = [];
  let processedCount = 0;

  for (let i = 0; i < batches.length; i++) {
    try {
      await batches[i].commit();
      processedCount += MAX_BATCH_SIZE;
      logInfo(`Batch ${i + 1}/${batches.length} committed successfully`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logWarn(`Failed to commit batch ${i + 1}`, { error: errorMessage });
      errors.push(`Batch ${i + 1}: ${errorMessage}`);
    }
  }

  return {
    success: errors.length === 0,
    processedCount,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Create batches from an array of operations
 */
export function createBatches<T>(
  items: T[],
  db: admin.firestore.Firestore,
  operationFn: (batch: admin.firestore.WriteBatch, item: T) => void
): admin.firestore.WriteBatch[] {
  const batches: admin.firestore.WriteBatch[] = [];
  let currentBatch = db.batch();
  let operationCount = 0;

  items.forEach((item, index) => {
    operationFn(currentBatch, item);
    operationCount++;

    // Create new batch when reaching limit or at the end
    if (operationCount >= MAX_BATCH_SIZE || index === items.length - 1) {
      batches.push(currentBatch);
      if (index < items.length - 1) {
        currentBatch = db.batch();
        operationCount = 0;
      }
    }
  });

  return batches;
}

/**
 * Batch upsert documents to a collection
 */
export async function batchUpsert<T extends Record<string, any>>(
  db: admin.firestore.Firestore,
  collectionName: string,
  items: T[],
  keyField: keyof T
): Promise<BatchResult> {
  if (items.length === 0) {
    return { success: true, processedCount: 0 };
  }

  const batches = createBatches(items, db, (batch, item) => {
    const docRef = db.collection(collectionName).doc(String(item[keyField]));
    batch.set(docRef, item, { merge: true });
  });

  logInfo(`Created ${batches.length} batches for ${items.length} items`);
  return await commitBatches(batches);
}
