/**
 * Input sanitizers — restrict characters by field type on every keystroke.
 *
 * Usage:
 *   <Input onChange={e => setValue(sanitizeNIT(e.target.value))} />
 *
 * Each function returns a cleaned string that only contains valid characters
 * for that specific field type.
 */

/** General text: letters, digits, spaces, accents, basic punctuation.  Blocks < > { } [ ] = ; to prevent injection. */
export const sanitizeText = (v: string): string =>
  v.replace(/[<>{}[\]=;\\]/g, '');

/** NIT / legal document: digits, dots, dashes only. E.g. 900.123.456-7 */
export const sanitizeNIT = (v: string): string =>
  v.replace(/[^0-9.-]/g, '');

/** Digits only: account numbers, phone numbers, etc. */
export const sanitizeDigits = (v: string): string =>
  v.replace(/[^0-9]/g, '');

/** Currency / price: digits and a single decimal separator (dot or comma). */
export const sanitizePrice = (v: string): string => {
  // Allow digits and at most one dot
  const cleaned = v.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length <= 2) return cleaned;
  return parts[0] + '.' + parts.slice(1).join('');
};

/** Percentage: digits and one dot, clamped display 0–100. */
export const sanitizePercentage = (v: string): string => {
  const cleaned = sanitizePrice(v);
  const num = parseFloat(cleaned);
  if (!isNaN(num) && num > 100) return '100';
  return cleaned;
};

/** Slug: lowercase letters, digits, dashes. Auto-lowercases. */
export const sanitizeSlug = (v: string): string =>
  v.toLowerCase().replace(/[^a-z0-9-]/g, '');

/** Name fields (persons, banks, org names): letters, spaces, accents, dots, dashes, apostrophes. No digits allowed. */
export const sanitizeName = (v: string): string =>
  v.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s.\-']/g, '');

/** City name: letters, spaces, accents, dashes. */
export const sanitizeCity = (v: string): string =>
  v.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s-]/g, '');

/** Address: letters, digits, spaces, accents, dashes, dots, #, commas. */
export const sanitizeAddress = (v: string): string =>
  v.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s.,#\-/]/g, '');

/** Positive integer: digits only, strip leading zeros except lone "0". */
export const sanitizePositiveInt = (v: string): string => {
  const digits = v.replace(/[^0-9]/g, '');
  if (digits === '') return '';
  return String(parseInt(digits, 10));
};

/** Clamp a numeric value within [min, max]. */
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
