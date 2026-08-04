/**
 * Cliente de Supabase que actúa COMO EL USUARIO de la petición, no como el
 * servicio.
 *
 * Por qué hace falta: el cliente de `config/supabase` usa la service role key y
 * por diseño **salta la RLS**. Dentro de PostgREST eso también significa que
 * `auth.uid()` devuelve NULL, porque el JWT de servicio no trae `sub`.
 *
 * La consecuencia es fácil de pasar por alto y rompe en silencio: cualquier RPC
 * `SECURITY DEFINER` que autorice con `auth.uid()` —que son todas las del repo,
 * porque §10.1 exige validar al caller adentro— **rechaza al BFF con 42501**
 * cuando se la invoca con la service key. No es que falten permisos: es que no
 * hay caller.
 *
 * Regla práctica:
 *   · RPCs que autorizan por caller, y lecturas que deben respetar RLS
 *     (el coach ve solo lo suyo)              → `userClient(req)`
 *   · Trabajo de sistema: jobs, envíos masivos, agregaciones que cruzan filas
 *     que el usuario no puede leer una por una → `supabase` (service role)
 *
 * El patrón ya se usaba suelto en polls.controller y admin-payments; acá queda
 * en un solo lugar para no repetir el createClient en cada ruta.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Request } from 'express';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase';

export function userClient(req: Request): SupabaseClient {
    const token = req.headers.authorization?.replace('Bearer ', '') ?? '';

    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { autoRefreshToken: false, persistSession: false },
    });
}
