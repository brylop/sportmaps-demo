import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { envolverCliente, instalarGuardiaFetch } from './cortafuegos-simulacion';

dotenv.config();

export const supabaseUrl = process.env.SUPABASE_URL || '';
export const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    throw new Error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_ANON_KEY are required env variables.');
}

// Create a single supabase client for interacting with your database
// IMPORTANT: This uses the service role key, which BYPASSES Row Level Security.
// Do not expose this client to the frontend or allow arbitrary queries through it.
// Guardia del modo pruebas del canal de plataforma (cortafuegos-simulacion):
// fuera de un turno simulado no cambia nada; dentro, ninguna llamada con
// efecto (Graph, correo, pasarelas, FCM) sale. Va ANTES de crear el cliente.
instalarGuardiaFetch();

const clienteReal = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

// El cliente que usa todo el BFF. Fuera de `conCortafuegos` es el mismo cliente
// real (el proxy devuelve cada método tal cual); dentro, las escrituras se
// bloquean y la conversación se sirve desde memoria. Ver cortafuegos-simulacion.ts.
export const supabaseItems = envolverCliente(clienteReal);

export const supabase = supabaseItems;
export { supabaseUrl as SUPABASE_URL, supabaseAnonKey as SUPABASE_ANON_KEY };
