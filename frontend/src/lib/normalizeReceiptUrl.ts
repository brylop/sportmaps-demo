import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'payment-receipts';

/**
 * Normalizes a receipt_url to a clean relative path suitable for
 * `supabase.storage.from('payment-receipts').createSignedUrl(path, ttl)`.
 *
 * Handles:
 * - Already-relative paths: "school-x/receipt.png" → "school-x/receipt.png"
 * - Full Supabase URLs: "https://xxx.supabase.co/storage/v1/object/public/payment-receipts/school-x/receipt.png"
 *   → "school-x/receipt.png"
 * - Double-bucket prefix: "payment-receipts/school-x/receipt.png" → "school-x/receipt.png"
 */
export function normalizeReceiptUrl(urlOrPath: string | null | undefined): string {
  if (!urlOrPath) return '';

  let path = urlOrPath.trim();

  // 1. Full URL → extract path after /storage/v1/object/...
  if (path.startsWith('http')) {
    const marker = '/storage/v1/object/';
    const idx = path.indexOf(marker);
    if (idx === -1) return path; // external URL, return as-is

    // After marker: "public/payment-receipts/school-x/file.png"
    const afterMarker = path.substring(idx + marker.length);
    const segments = afterMarker.split('/');
    // segments[0] = "public"|"authenticated", segments[1] = bucket, rest = file path
    path = segments.slice(2).join('/');
  }

  // 2. Strip double-bucket prefix if present
  if (path.startsWith(`${BUCKET}/`)) {
    path = path.substring(BUCKET.length + 1);
  }

  // 3. Remove leading slash
  if (path.startsWith('/')) {
    path = path.substring(1);
  }

  return path;
}

/**
 * Gets a signed URL (5 min TTL) for a receipt, handling all URL formats.
 * Returns null on error.
 */
export async function getSignedReceiptUrl(receiptUrl: string): Promise<string | null> {
  // If it's already a full external URL (not Supabase), return as-is
  if (receiptUrl.startsWith('http') && !receiptUrl.includes('supabase.co')) {
    return receiptUrl;
  }

  const cleanPath = normalizeReceiptUrl(receiptUrl);
  if (!cleanPath) return null;

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(cleanPath, 300); // 5 min

    if (error) {
      console.error('[Receipt] Signed URL error:', error.message);
      return null;
    }
    return data.signedUrl;
  } catch (err) {
    console.error('[Receipt] Unexpected error:', err);
    return null;
  }
}
