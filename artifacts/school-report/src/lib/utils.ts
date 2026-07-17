import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr?: string | null) {
  if (!dateStr) return "-";
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(dateStr));
}
