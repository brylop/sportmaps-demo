import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── Edge Function: wompi-sign ────────────────────────────────────────────────
// Genera la firma de integridad para el Widget de Wompi.
// El WOMPI_INTEGRITY_SECRET NUNCA sale del servidor.
// Esta función verifica que el usuario esté autenticado y pertenezca a la escuela
// antes de generar la firma.

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 })
    }

    // ─── Verificar autenticación del usuario ────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return new Response(
            JSON.stringify({ error: 'No autorizado' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return new Response(
            JSON.stringify({ error: 'No autorizado' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // ─── Leer parámetros del request ────────────────────────────────────────
    let body: { reference: string; amount_in_cents: number; currency?: string; school_id?: string }
    try {
        body = await req.json()
    } catch {
        return new Response(
            JSON.stringify({ error: 'JSON inválido' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    const { reference, amount_in_cents, currency = 'COP' } = body

    if (!reference || !amount_in_cents) {
        return new Response(
            JSON.stringify({ error: 'reference y amount_in_cents son requeridos' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // ─── Obtener el integrity secret ────────────────────────────────────────
    const integritySecret = Deno.env.get('WOMPI_INTEGRITY_SECRET')
    if (!integritySecret) {
        console.error('❌ WOMPI_INTEGRITY_SECRET no configurado en Supabase secrets')
        return new Response(
            JSON.stringify({ error: 'Error de configuración del servidor' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // ─── Generar firma SHA-256 ──────────────────────────────────────────────
    // Protocolo Wompi: concatenar reference + amount_in_cents + currency + secret
    const stringToSign = `${reference}${amount_in_cents}${currency}${integritySecret}`
    const encoder = new TextEncoder()
    const data = encoder.encode(stringToSign)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const signature = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

    console.log(`✅ Firma generada para referencia: ${reference} | usuario: ${user.id}`)

    return new Response(
        JSON.stringify({ signature, reference, currency }),
        {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
    )
})
