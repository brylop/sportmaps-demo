import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Extracts the relative path from a full Supabase Storage URL or returns the path if it's already relative.
 * Example: https://.../storage/v1/object/public/payment-receipts/file.png -> file.png
 */
export function getStoragePath(urlOrPath: string): string {
  if (!urlOrPath) return "";
  if (!urlOrPath.startsWith("http")) return urlOrPath;

  try {
    const parts = urlOrPath.split("/storage/v1/object/");
    if (parts.length < 2) return urlOrPath;

    // The part after /storage/v1/object/ is [type]/[bucket]/[path]
    const pathPart = parts[1];
    const pathSegments = pathPart.split("/");

    // We want everything after the second segment (skip 'public'/'authenticated' and bucket name)
    // Actually, usually it's [public|authenticated]/[bucket_name]/[file_path]
    return pathSegments.slice(2).join("/");
  } catch (e) {
    console.error("Error parsing storage URL:", e);
    return urlOrPath;
  }
}
/**
 * Masks a sensitive string (bank account, ID, phone) leaving only the last 4 characters visible.
 */
export function maskSensitive(value: string | null | undefined): string {
  if (!value) return "";
  if (value.length <= 4) return value;
  return "*".repeat(value.length - 4) + value.slice(-4);
}

/**
 * Formats a duration in days into a friendly human-readable Spanish text.
 * Handles weeks, 15 days, months, and years nicely.
 */
export function formatFriendlyDuration(days: number): string {
  if (days === 7) return '1 semana';
  if (days === 14) return '2 semanas';
  if (days === 15) return '15 días';
  if (days === 30) return '1 mes';
  if (days === 90) return '3 meses';
  if (days === 180) return '6 meses';
  if (days === 365) return '1 año';

  if (days % 30 === 0) {
    const months = days / 30;
    return `${months} ${months === 1 ? 'mes' : 'meses'}`;
  }
  if (days % 7 === 0) {
    const weeks = days / 7;
    return `${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`;
  }
  return `${days} días`;
}

