import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── TIPOS ───────────────────────────────────────────────────────────────────
interface WompiTransaction {
    id: string
    status: string
    reference: string
    amount_in_cents: number
    currency: string
    payment_method_type: string
}

interface WompiWebhookPayload {
    event: string
    data: {
        transaction: WompiTransaction
    }
    timestamp: number
    sent_at: string
    signature?: {
        checksum: string
        properties: string[]
    }
}

// ─── CORS headers ────────────────────────────────────────────────────────────
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Verificar firma HMAC de Wompi ───────────────────────────────────────────
async function verifyWompiSignature(
    payload: WompiWebhookPayload,
    receivedChecksum: string
): Promise<boolean> {
    const eventsSecret = Deno.env.get('WOMPI_EVENTS_SECRET')
    if (!eventsSecret) {
        console.error('❌ WOMPI_EVENTS_SECRET no configurado')
        return false
    }

    const properties = payload.signature?.properties ?? []
    const dataToSign = properties.map((prop) => {
        const parts = prop.split('.')
        let value: unknown = payload
        for (const part of parts) {
            value = (value as Record<string, unknown>)[part]
        }
        return String(value)
    }).join('')

    const stringToSign = `${dataToSign}${payload.timestamp}${eventsSecret}`
    const encoder = new TextEncoder()
    const data = encoder.encode(stringToSign)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const computedChecksum = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

    const isValid = computedChecksum === receivedChecksum
    if (!isValid) {
        console.error('❌ Firma inválida', { computed: computedChecksum, received: receivedChecksum })
    }
    return isValid
}

// ─── Handler principal ────────────────────────────────────────────────────────
serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 })
    }

    let payload: WompiWebhookPayload
    try {
        payload = await req.json()
    } catch {
        return new Response('Bad Request: invalid JSON', { status: 400 })
    }

    console.log('📨 Wompi webhook:', payload.event, payload.data?.transaction?.reference)

    // ─── Verificar firma ─────────────────────────────────────────────────────
    const checksum = payload.signature?.checksum ?? ''
    if (checksum) {
        const isValid = await verifyWompiSignature(payload, checksum)
        if (!isValid) {
            return new Response('Unauthorized: invalid signature', { status: 401 })
        }
    } else {
        const isProduction = Deno.env.get('ENVIRONMENT') === 'production'
        if (isProduction) {
            return new Response('Unauthorized: missing signature', { status: 401 })
        }
        console.warn('⚠️ Sin firma (modo sandbox)')
    }

    if (payload.event !== 'transaction.updated') {
        return new Response('OK: event ignored', { status: 200 })
    }

    const transaction = payload.data.transaction
    const { reference, status, amount_in_cents } = transaction

    if (!reference) {
        return new Response('Bad Request: missing reference', { status: 400 })
    }

    // Mapeo de status Wompi → status interno
    // Schema real de payments acepta: 'pending','paid','overdue','failed','cancelled'
    const statusMap: Record<string, string> = {
        APPROVED: 'paid',
        DECLINED: 'failed',
        VOIDED: 'cancelled',
        ERROR: 'failed',
        PENDING: 'pending',
    }
    const internalStatus = statusMap[status] ?? 'pending'

    // ─── Supabase admin con service_role ─────────────────────────────────────
    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { persistSession: false } }
    )

    // ─── Actualizar pago buscando por campo 'reference' (agregado en migración)
    const updateData: Record<string, unknown> = {
        status: internalStatus,
        wompi_id: transaction.id,
        // payment_method: solo valores permitidos por el CHECK del schema real:
        // 'pse','card','transfer','cash','other'
        payment_method: mapPaymentMethod(transaction.payment_method_type),
        updated_at: new Date().toISOString(),
    }

    // Solo actualizar payment_date y amount_paid si fue aprobado
    if (status === 'APPROVED') {
        updateData.payment_date = new Date().toISOString().split('T')[0] // solo fecha DATE
        updateData.amount_paid = amount_in_cents / 100
    }

    const { error: updateError } = await supabaseAdmin
        .from('payments')
        .update(updateData)
        .eq('reference', reference)

    if (updateError) {
        console.error('❌ Error actualizando pago:', updateError)
        return new Response(`Internal Server Error: ${updateError.message}`, { status: 500 })
    }

    console.log(`✅ Pago ${reference} → ${internalStatus}`)

    // ─── Notificación in-app al padre si fue aprobado ─────────────────────────
    // Schema real de notifications: { user_id, title, message, type, read, link }
    // user_id referencia profiles(id) — que es el mismo que auth.users(id)
    if (status === 'APPROVED') {
        const { data: payment } = await supabaseAdmin
            .from('payments')
            .select('parent_id, child_id, amount, school_id')
            .eq('reference', reference)
            .single()

        if (payment?.parent_id) {
            const amountFormatted = (amount_in_cents / 100).toLocaleString('es-CO')

            await supabaseAdmin.from('notifications').insert({
                user_id: payment.parent_id,   // profiles.id = auth.users.id ✅
                type: 'info',              // tipo confirmado en schema: 'info' es default
                title: '✅ Pago confirmado',
                message: `Tu pago de $${amountFormatted} COP fue procesado exitosamente. Ref: ${reference}`,
                read: false,
                link: `/parent/payments`,  // link a la sección de pagos del padre
                created_at: new Date().toISOString(),
            })
        }
    }

    return new Response(
        JSON.stringify({ ok: true, reference, status: internalStatus }),
        {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
    )
})

// ─── Mapear payment_method_type de Wompi al ENUM del schema ──────────────────
// Schema real CHECK: ('pse','card','transfer','cash','other')
function mapPaymentMethod(wompiMethod: string): string {
    const methodMap: Record<string, string> = {
        CARD: 'card',
        PSE: 'pse',
        BANCOLOMBIA_PAY: 'transfer',
        BANCOLOMBIA_QR: 'transfer',
        NEQUI: 'transfer',
        DAVIPLATA: 'transfer',
        CASH: 'cash',
        EFECTY: 'cash',
        BALOTO: 'cash',
    }
    return methodMap[wompiMethod?.toUpperCase()] ?? 'other'
}
