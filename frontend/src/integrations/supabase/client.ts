// SportMaps Supabase Client
// Configured with fallback for demo deployment
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Production Supabase credentials (public keys - safe to expose)
// Fallback to production credentials if environment variables are missing
// Note: Anon keys are safe to expose in client-side code by design.
const PRODUCTION_SUPABASE_URL = 'https://luebjarufsiadojhvxgi.supabase.co';
const PRODUCTION_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZWJqYXJ1ZnNpYWRvamh2eGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MTU2NTgsImV4cCI6MjA3NDQ5MTY1OH0.yfmAH4N9UboL4p6UqK-_tQnfhBHlTQrXCrwRokALix4';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || PRODUCTION_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || PRODUCTION_SUPABASE_KEY;

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  console.warn('⚠️ Usando credenciales de respaldo (Fallback). Para producción, configura las variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.');
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
