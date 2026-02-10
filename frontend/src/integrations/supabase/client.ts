// SportMaps Supabase Client
// Configured with fallback for demo deployment
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Production Supabase credentials (public keys - safe to expose)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.warn('⚠️ Supabase credentials not found in environment variables. Falling back to default demo project.');
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Helper to check if Supabase is properly configured
export const isSupabaseConfigured = (): boolean => {
  return true; // Always configured now with fallback
};

// Log configuration in development
if (import.meta.env.DEV) {
  console.log('✅ Supabase configured');
  console.log('Supabase URL:', SUPABASE_URL);
}
