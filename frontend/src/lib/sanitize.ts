/**
 * Input sanitization utilities for SportMaps.
 * Prevents XSS, injection, and storage abuse.
 */

/**
 * Sanitize text input by stripping HTML tags and trimming whitespace.
 * Uses browser-native approach (no external dependency needed).
 */
export function sanitizeText(input: string): string {
    if (!input) return '';

    // Strip HTML tags using regex (safe for plain text fields)
    const stripped = input.replace(/<[^>]*>/g, '');

    // Normalize whitespace
    const normalized = stripped.replace(/\s+/g, ' ').trim();

    return normalized;
}

/**
 * Sanitize and validate bio/description fields.
 * Enforces max length and strips dangerous content.
 */
export function sanitizeBio(input: string, maxLength: number = 500): string {
    const clean = sanitizeText(input);
    return clean.slice(0, maxLength);
}

/**
 * Sanitize a display name or title.
 * Strips HTML but preserves accented characters (important for Spanish names).
 */
export function sanitizeName(input: string, maxLength: number = 100): string {
    if (!input) return '';

    // Keep letters, numbers, spaces, hyphens, dots, accented chars
    const clean = input
        .replace(/<[^>]*>/g, '')
        .replace(/[^\p{L}\p{N}\s\-.']/gu, '')
        .trim();

    return clean.slice(0, maxLength);
}

/**
 * Validate and sanitize an email address.
 */
export function sanitizeEmail(input: string): string {
    const trimmed = input.trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(trimmed) ? trimmed : '';
}

/**
 * Validate and sanitize a phone number (Colombian format).
 */
export function sanitizePhone(input: string): string {
    // Keep only digits, +, and spaces
    const clean = input.replace(/[^\d+\s()-]/g, '').trim();
    // Validate minimum length for Colombian numbers
    const digits = clean.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15 ? clean : '';
}
