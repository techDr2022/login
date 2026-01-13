import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a Date object as YYYY-MM-DD string in local timezone (not UTC).
 * This prevents timezone conversion issues when sending dates to APIs.
 * @param date The date to format
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDateLocal(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parses a YYYY-MM-DD date string as a Date object in local timezone (not UTC).
 * This prevents timezone conversion issues when receiving dates from APIs.
 * @param dateString Date string in YYYY-MM-DD format
 * @returns Date object set to midnight in local timezone
 */
export function parseDateLocal(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  // month is 0-indexed in Date constructor, so subtract 1
  return new Date(year, month - 1, day, 0, 0, 0, 0)
}

