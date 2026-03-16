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
