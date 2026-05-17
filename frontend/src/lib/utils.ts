import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string): string {
  // Append T00:00:00 so the date is parsed in local time, not UTC midnight.
  // Without this, YYYY-MM-DD strings are treated as UTC, which shifts the
  // displayed date back by one day in timezones behind UTC (e.g. US/Europe).
  const normalized = dateStr.length === 10 ? `${dateStr}T00:00:00` : dateStr;
  return new Date(normalized).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
