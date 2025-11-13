/**
 * Consistent logging utilities
 */

import * as logger from "firebase-functions/logger";

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

/**
 * Structured log data
 */
interface LogData {
  [key: string]: unknown;
}

/**
 * Log a debug message
 */
export function logDebug(message: string, data?: LogData): void {
  logger.debug(message, data);
}

/**
 * Log an info message
 */
export function logInfo(message: string, data?: LogData): void {
  logger.info(message, data);
}

/**
 * Log a warning message
 */
export function logWarn(message: string, data?: LogData): void {
  logger.warn(message, data);
}

/**
 * Log an error message
 */
export function logError(
  message: string,
  error?: Error | unknown,
  data?: LogData
): void {
  const errorData = {
    ...data,
    error:
      error instanceof Error
        ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
          }
        : error,
  };
  logger.error(message, errorData);
}

/**
 * Log API call
 */
export function logApiCall(
  service: string,
  endpoint: string,
  data?: LogData
): void {
  logInfo(`API Call: ${service}`, { endpoint, ...data });
}

/**
 * Log function execution time
 */
export function logExecutionTime(
  functionName: string,
  startTime: number
): void {
  const duration = Date.now() - startTime;
  logInfo(`Execution complete: ${functionName}`, { durationMs: duration });
}
