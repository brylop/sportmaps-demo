import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── Edge Function: wompi-sign ────────────────────────────────────────────────
// Genera la firma de integridad para el Widget de Wompi.
//
// Defensa en profundidad:
//   1. Valida el JWT del usuario (no acepta anon key).
//   2. Resuelve `reference` en la BD via service role:
//        - SCH-*   -> payment_links + payments
//        - SVC/EVT/SUB/MKT/BKG-* -> marketplace_transactions
//        - CART-*  -> orders
//      Si no se encuentra, rechaza.
//   3. Verifica que el caller (auth.uid()) sea el dueno de la transaccion.
//   4. Firma con el monto REAL de la BD, ignorando body.amount_in_cents.
//      Esto bloquea el ataque "modificar amount_in_cents en DevTools" — el
//      Widget recibira siempre el monto correcto, no el del cliente.
//   5. Retorna { signature, reference, currency, amount_in_cents } para que
//      el frontend abra el Widget con el monto firmado.
//
// El WOMPI_INTEGRITY_SECRET nunca sale del servidor.

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const jsonResponse = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

interface ResolvedReference {
    /** Auth user id del dueno legitimo de la transaccion */
    ownerId: string
    /** Monto en pesos (no centavos) tal como esta en la BD */
    amountCop: number
    /** Para logging */
    source: 'payment_links' | 'marketplace_transactions' | 'orders'
}

/**
 * Busca el reference en la tabla correcta segun el prefijo y devuelve el
 * dueno + monto autoritativo (de la BD, no del cliente).
 */
async function resolveReference(
    supabaseAdmin: ReturnType<typeof createClient>,
    reference: string,
): Promise<ResolvedReference | null> {
    const prefix = reference.split('-')[0]?.toUpperCase()

    if (prefix === 'SCH') {
        const { data, error } = await supabaseAdmin
            .from('payment_links')
            .select('gross_amount, payment:payments(parent_id)')
            .eq('wompi_reference', reference)
            .maybeSingle()
        if (error || !data) return null
        // payment puede venir como objeto o array segun PostgREST; normalizar
        const parentId = Array.isArray((data as any).payment)
            ? (data as any).payment[0]?.parent_id
            : (data as any).payment?.parent_id
        if (!parentId) return null
        return {
            ownerId: parentId as string,
            amountCop: Number((data as any).gross_amount),
            source: 'payment_links',
        }
    }

    if (prefix === 'SVC' || prefix === 'EVT' || prefix === 'SUB' || prefix === 'MKT' || prefix === 'BKG') {
        const { data, error } = await supabaseAdmin
            .from('marketplace_transactions')
            .select('user_id, gross_amount')
            .eq('wompi_reference', reference)
            .maybeSingle()
        if (error || !data) return null
        return {
            ownerId: (data as any).user_id as string,
            amountCop: Number((data as any).gross_amount),
            source: 'marketplace_transactions',
        }
    }

    if (prefix === 'CART') {
        const { data, error } = await supabaseAdmin
            .from('orders')
            .select('user_id, total_amount')
            .eq('wompi_reference', reference)
            .maybeSingle()
        if (error || !data || !(data as any).user_id) return null
        return {
            ownerId: (data as any).user_id as string,
            amountCop: Number((data as any).total_amount),
            source: 'orders',
        }
    }

    return null
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

    // ─── 1. Verificar autenticacion del usuario ──────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return jsonResponse({ error: 'No autorizado' }, 401)
    }

    const supabaseUserClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser()
    if (authError || !user) {
        return jsonResponse({ error: 'No autorizado' }, 401)
    }

    // ─── 2. Leer parametros del request ──────────────────────────────────────
    let body: { reference?: string; currency?: string }
    try {
        body = await req.json()
    } catch {
        return jsonResponse({ error: 'JSON invalido' }, 400)
    }

    const { reference, currency = 'COP' } = body
    if (!reference || typeof reference !== 'string') {
        return jsonResponse({ error: 'reference es requerido' }, 400)
    }
    if (currency !== 'COP') {
        return jsonResponse({ error: 'Solo COP es soportado' }, 400)
    }

    // ─── 3. Resolver reference en BD (service role, bypass RLS) ──────────────
    // Bypassa RLS aproposito porque hacemos el check de ownership manual abajo;
    // asi el signing no depende de que las policies sean correctas.
    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const resolved = await resolveReference(supabaseAdmin, reference)
    if (!resolved) {
        return jsonResponse({ error: 'Reference no encontrada' }, 404)
    }

    // ─── 4. Verificar ownership ──────────────────────────────────────────────
    // El JWT del caller debe coincidir con el dueno registrado en la BD.
    if (resolved.ownerId !== user.id) {
        console.warn(
            `wompi-sign: ownership mismatch | reference=${reference} | source=${resolved.source} | ` +
            `expected_owner=${resolved.ownerId} | caller=${user.id}`,
        )
        return jsonResponse({ error: 'No tienes permiso para firmar este pago.' }, 403)
    }

    // ─── 5. Validar y obtener integrity secret ───────────────────────────────
    const integritySecret = Deno.env.get('WOMPI_INTEGRITY_SECRET')
    if (!integritySecret) {
        console.error('WOMPI_INTEGRITY_SECRET no configurado en Supabase secrets')
        return jsonResponse({ error: 'Error de configuracion del servidor' }, 500)
    }

    // ─── 6. Calcular amount_in_cents desde BD, NO del cliente ────────────────
    // Esto cierra el ataque de "modificar amount_in_cents en DevTools": el
    // Widget recibira el monto firmado por nosotros, no el que el cliente envio.
    const amountInCents = Math.round(resolved.amountCop * 100)
    if (!Number.isFinite(amountInCents) || amountInCents <= 0) {
        console.error(`wompi-sign: monto invalido en BD | reference=${reference} | amount=${resolved.amountCop}`)
        return jsonResponse({ error: 'Monto invalido en la base de datos' }, 500)
    }

    // ─── 7. Generar firma SHA-256 ────────────────────────────────────────────
    // Protocolo Wompi: SHA256( reference + amount_in_cents + currency + secret )
    const stringToSign = `${reference}${amountInCents}${currency}${integritySecret}`
    const encoder = new TextEncoder()
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(stringToSign))
    const signature = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')

    console.log(
        `wompi-sign OK | reference=${reference} | source=${resolved.source} | ` +
        `owner=${user.id} | amountInCents=${amountInCents}`,
    )

    // Retornamos amount_in_cents para que el frontend abra el Widget con el
    // monto correcto (puede diferir de lo que envio si fue tampered).
    return jsonResponse({ signature, reference, currency, amount_in_cents: amountInCents })
})
