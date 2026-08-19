// SportMaps Supabase Client
// Variables de entorno requeridas: VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY
// Configúralas en .env.local (desarrollo) o en el panel de Vercel (producción).
import { createClient, processLock } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

// Falla de forma explícita si las variables no están configuradas
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  const msg = [
    '❌ Supabase no configurado.',
    'Crea el archivo frontend/.env.local con:',
    '  VITE_SUPABASE_URL=https://tu-proyecto.supabase.co',
    '  VITE_SUPABASE_ANON_KEY=tu_anon_key',
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
      // Candado en memoria (por pestana) en vez del de Web Locks.
      //
      // Por defecto supabase-js serializa TODA operacion de auth con un lock
      // exclusivo de `navigator.locks` llamado `lock:sb-<ref>-auth-token`,
      // compartido por todo el origen. Si quien lo tiene nunca lo suelta
      // —pestana congelada en segundo plano, pagina en bfcache, o el documento
      // anterior mientras el service worker hace clients.claim()— el lock queda
      // huerfano y no hay quien lo libere.
      //
      // Desde ahi cada getSession(), getUser() y cada .from() (que pide el
      // access token por dentro) espera 10 s y revienta con
      // "Acquiring an exclusive Navigator LockManager lock ... timed out".
      // Como ProtectedRoute y useSchoolContext dependen de esas llamadas para
      // bajar su `loading`, la app se queda con el spinner puesto para siempre.
      //
      // `processLock` mantiene la exclusion mutua DENTRO de la pestana —la que
      // evita la carrera real: dos refrescos de token simultaneos— y renuncia a
      // la coordinacion entre pestanas, que es justamente la que se atasca.
      lock: processLock,
    },
  }
);

// Helper: verifica que las credenciales estén configuradas vía env vars
export const isSupabaseConfigured = (): boolean =>
  Boolean(import.meta.env.VITE_SUPABASE_URL && (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY));

if (import.meta.env.DEV) {
  console.log('✅ Supabase configurado desde variables de entorno');
  console.log('   URL:', SUPABASE_URL ?? '⚠️ FALTANTE');
}
