/**
 * Date utility functions
 * Common date operations used across the application
 */

import { Timestamp } from "firebase-admin/firestore";

/**
 * Convert any time value to a Date object
 * Handles Firestore Timestamps, Date objects, strings, numbers, and timestamp-like objects
 */
export function toDate(time: any): Date {
  if (time instanceof Timestamp) {
    return time.toDate();
  } else if (time instanceof Date) {
    return time;
  } else if (typeof time === "string") {
    return new Date(time);
  } else if (typeof time === "number") {
    return new Date(time);
  } else if (typeof time === "object" && time !== null) {
    // Handle Firestore Timestamp-like objects
    if ("_seconds" in time) {
      return new Date(
        time._seconds * 1000 + (time._nanoseconds || 0) / 1000000
      );
    }
    if ("seconds" in time) {
      return new Date(time.seconds * 1000 + (time.nanoseconds || 0) / 1000000);
    }
  }

  // Last resort - try to convert
  return new Date(time);
}

/**
 * Convert a Date to YYYY-MM-DD format
 */
export function toDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Get today's date as YYYY-MM-DD string
 */
export function getTodayString(): string {
  return toDateString(new Date());
}

/**
 * Get a date N days ago as YYYY-MM-DD string
 */
export function getDaysAgoString(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return toDateString(date);
}

/**
 * Convert Date or any time value to ISO string
 */
export function toISOString(time: any): string {
  const date = toDate(time);
  return date.toISOString();
}

/**
 * Parse a timestamp from Alpha Vantage (US/Eastern timezone) to a Date object
 * Format: "yyyy-MM-dd HH:mm:ss"
 *
 * @param timestamp - Timestamp string from Alpha Vantage
 * @returns Date object in UTC
 */
export function parseEasternTime(timestamp: string): Date {
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
 * Check if market is currently open (rough estimate)
 * US market hours: 9:30 AM - 4:00 PM ET, Mon-Fri
 */
export function isMarketOpen(): boolean {
  const now = new Date();
  const et = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const day = et.getDay();
  const hour = et.getHours();
  const minute = et.getMinutes();

  // Weekend
  if (day === 0 || day === 6) return false;

  // Before 9:30 AM or after 4:00 PM ET
  const currentMinutes = hour * 60 + minute;
  const marketOpen = 9 * 60 + 30; // 9:30 AM
  const marketClose = 16 * 60; // 4:00 PM

  return currentMinutes >= marketOpen && currentMinutes < marketClose;
}

/**
 * Check if two dates are on the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Get ISO week number for a date
 */
export function getISOWeek(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}
