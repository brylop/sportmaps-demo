
import { User } from '@supabase/supabase-js';

/**
 * Checks if the current user is a demo user.
 * Supports both the legacy '@demo.sportmaps.com' format and the new 'spoortmaps+...@gmail.com' aliases.
 */
export const isDemoUser = (user: User | null | undefined): boolean => {
    if (!user || !user.email) return false;

    const email = user.email.toLowerCase();

    // Legacy demo users
    if (email.endsWith('@demo.sportmaps.com')) return true;

    // New demo users (Gmail aliases)
    // Check against the known pattern or specific list if strictness is needed
    // For now, simpler is better: check the prefix used in setup-demo-data.mjs
    if (email.startsWith('spoortmaps') && email.includes('@gmail.com')) return true;

    return false;
};

/**
 * Returns the simplified role for demo UI adjustments if needed.
 */
export const getDemoRole = (user: User | null | undefined): string | null => {
    if (!isDemoUser(user)) return null;
    // This could be expanded to parse the email alias if strict role mapping is needed solely from email
    // e.g. spoortmaps+coach@gmail.com -> coach
    return null;
};
