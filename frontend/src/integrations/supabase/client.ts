// SportMaps Supabase Client
// Configured with fallback for demo deployment
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

<<<<<<< HEAD
// Production Supabase credentials (public keys - safe to expose)
=======
// Hardcoded credentials for demo deployment (public keys only - safe to expose)
// These are the PUBLISHABLE keys, not secret keys, so it's safe
>>>>>>> cb426b9a3a46d1327181571e62588ccfc62ea39f
const PRODUCTION_SUPABASE_URL = 'https://sznbagbtwenyihpewczg.supabase.co';
const PRODUCTION_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6bmJhZ2J0d2VueWlocGV3Y3pnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMTk4ODksImV4cCI6MjA3NDc5NTg4OX0.Aiv6tgIOGUw30jTW_InH-oJAxmx6ovK64SnWaGnKlJw';

// Try environment variables first (local dev), fallback to production
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || PRODUCTION_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || PRODUCTION_SUPABASE_KEY;

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
