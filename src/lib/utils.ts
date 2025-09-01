import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

// Remove the circular import
// import { cn } from "@/lib/utils";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Sanitizes a string to be used as a video title on Bunny.net.
 * Removes potentially problematic characters and trims whitespace.
 *
 * @param title The original title string.
 * @returns The sanitized title string.
 */
export function sanitizeTitle(title: string): string {
  if (!title) {
    return `Untitled_${Date.now()}`; // Provide a default if title is empty
  }
  // Remove file extension if present (common case)
  const nameWithoutExtension = title.replace(/\.[^/.]+$/, "");

  // Remove or replace characters not allowed or problematic in Bunny titles
  // Example: Replace multiple spaces/underscores with single underscore, remove special chars
  let sanitized = nameWithoutExtension
    .replace(/[\s_]+/g, '_') // Replace spaces and underscores with a single underscore
    .replace(/[^\w\-\.]/g, '') // Remove characters that are not word chars, hyphens, or periods
    .replace(/_+/g, '_') // Ensure single underscores
    .replace(/^_+|_+$/g, ''); // Trim leading/trailing underscores

  // Ensure the title is not empty after sanitization
  if (!sanitized) {
    return `Video_${Date.now()}`; // Fallback if sanitization results in empty string
  }

  // Optional: Truncate if title is too long (Bunny might have limits)
  // const maxLength = 255; // Example max length
  // if (sanitized.length > maxLength) {
  //   sanitized = sanitized.substring(0, maxLength);
  // }

  return sanitized;
}

/**
 * Formats bytes into a human-readable string (KB, MB, GB).
 * @param bytes The number of bytes.
 * @param decimals The number of decimal places (default: 2).
 * @returns A formatted string representing the size.
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Formats a number with thousand separators.
 * @param num The number to format.
 * @returns A formatted string with commas as thousand separators.
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('ar-EG');
}

/**
 * Formats seconds into a human-readable time string (h m s).
 * @param totalSeconds The total number of seconds.
 * @returns A formatted string representing the time duration.
 */
export function formatTime(totalSeconds: number | undefined): string {
    if (totalSeconds === undefined || totalSeconds < 0) return '--:--';

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const hoursStr = hours > 0 ? `${hours}h ` : '';
    const minutesStr = minutes > 0 || hours > 0 ? `${minutes}m ` : '';
    const secondsStr = `${seconds}s`;

    if (hours > 0) return `${hoursStr}${minutesStr}${secondsStr}`;
    if (minutes > 0) return `${minutesStr}${secondsStr}`;
    return secondsStr;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  return `${hours}h ${remainingMinutes}m ${remainingSeconds.toFixed(0)}s`;
}

/**
 * Format upload speed with consistent logic across components
 */
export function formatUploadSpeed(bytesPerSecond?: number): string {
  if (!bytesPerSecond || bytesPerSecond <= 0) {
    return 'Initializing...';
  }
  
  // For very slow speeds (< 1KB/s), show "Starting..."
  if (bytesPerSecond < 1024) {
    return 'Starting...';
  }
  
  return formatBytes(bytesPerSecond, 1) + '/s';
}

/**
 * Format time remaining with better display
 */
export function formatTimeRemaining(seconds: number): string {
  if (!seconds || seconds <= 0) {
    return '--';
  }
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}
