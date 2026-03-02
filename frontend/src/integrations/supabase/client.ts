// SportMaps Supabase Client
// Variables de entorno requeridas: VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY
// Configúralas en .env.local (desarrollo) o en el panel de Vercel (producción).
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Falla de forma explícita si las variables no están configuradas
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  const msg = [
    '❌ Supabase no configurado.',
    'Crea el archivo frontend/.env.local con:',
    '  VITE_SUPABASE_URL=https://tu-proyecto.supabase.co',
    '  VITE_SUPABASE_PUBLISHABLE_KEY=tu_anon_key',
    'Consulta frontend/.env.example para referencia.',
  ].join('\n');
  console.error(msg);
  // En producción lanzar para que Sentry/logs lo capturen
  if (import.meta.env.PROD) {
    throw new Error('Supabase env vars not configured. Check Vercel environment settings.');
  }
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = createClient<Database>(
  SUPABASE_URL ?? '',
  SUPABASE_PUBLISHABLE_KEY ?? '',
  {
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

// Helper: verifica que las credenciales estén configuradas vía env vars
export const isSupabaseConfigured = (): boolean =>
  Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);

if (import.meta.env.DEV) {
  console.log('✅ Supabase configurado desde variables de entorno');
  console.log('   URL:', SUPABASE_URL ?? '⚠️ FALTANTE');
}
