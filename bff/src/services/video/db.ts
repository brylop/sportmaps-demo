/**
 * Clientes de base para los videos subidos (M6h).
 *
 *   · userDb(req): cliente con la SESIÓN DEL USUARIO (anon key + su JWT). Todo lo
 *     que hace una persona (listar, subir, recortar, borrar) pasa por la RLS y
 *     por las RPCs que validan auth.uid(): la base es el gate de verdad y el
 *     requireRole del BFF es una segunda capa. Mismo patrón que
 *     admin-payments.routes.ts.
 *   · serviceDb(): service_role, SOLO para settle_school_video (webhook del
 *     proveedor y «Actualizar estado»), que no tiene usuario.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Request } from 'express';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../../config/supabase';

export function bearerToken(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h || !/^Bearer\s+/i.test(h)) return null;
  const t = h.replace(/^Bearer\s+/i, '').trim();
  return t || null;
}

export function userDb(req: Request): SupabaseClient {
  const token = bearerToken(req);
  if (!token) throw Object.assign(new Error('Sin sesión.'), { status: 401 });
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function serviceDb(): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}
