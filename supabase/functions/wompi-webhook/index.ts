import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const wompiSecret = Deno.env.get('WOMPI_INTEGRITY_SECRET') ?? ''

serve(async (req: Request) => {
    try {
        const { method } = req

        if (method !== 'POST') {
            return new Response('Method Not Allowed', { status: 405 })
        }

        const payload = await req.json()
        const { data, signature, timestamp, event } = payload

        if (event !== 'transaction.updated') {
            return new Response('Event ignored', { status: 200 })
        }

        const transaction = data.transaction

        // Verify Signature
        const calculatedSignatureSource = `${transaction.id}${transaction.status}${transaction.amount_in_cents}${timestamp}${wompiSecret}`
        const encoder = new TextEncoder()
        const dataBuffer = encoder.encode(calculatedSignatureSource)
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        const calculatedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

        if (signature.checksum !== calculatedSignature) {
            console.error('Invalid signature', { expected: signature.checksum, calculated: calculatedSignature })
            return new Response('Invalid signature', { status: 400 })
        }

        // Initialize Supabase Client
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        if (transaction.status === 'APPROVED') {
            // 1. Update Payment
            const { error: updateError } = await supabaseClient
                .from('payments')
                .update({
                    status: 'paid',
                    payment_date: new Date().toISOString().split('T')[0],
                    wompi_id: transaction.id,
                    amount_paid: transaction.amount_in_cents / 100
                })
                .eq('reference', transaction.reference)

            if (updateError) {
                throw updateError
            }

            // 2. Update Enrollment (if applicable)
            const { data: payData, error: payError } = await supabaseClient
                .from('payments')
                .select('enrollment_id, child_id, school_id')
                .eq('reference', transaction.reference)
                .single()

            if (payError) throw payError

            if (payData?.enrollment_id) {
                await supabaseClient
                    .from('enrollments')
                    .update({ status: 'active' })
                    .eq('id', payData.enrollment_id)
            }

            // 3. Create Audit Log
            await supabaseClient
                .from('audit_logs')
                .insert({
                    school_id: payData.school_id,
                    action: 'payment_received',
                    table_name: 'payments',
                    record_id: transaction.id,
                    new_data: { amount: transaction.amount_in_cents / 100, provider: 'wompi' }
                })

            // 4. Send Notification
            const { data: childData, error: childError } = await supabaseClient
                .from('children')
                .select('parent_id')
                .eq('id', payData.child_id)
                .single()

            if (!childError && childData?.parent_id) {
                await supabaseClient
                    .from('notifications')
                    .insert({
                        user_id: childData.parent_id,
                        type: 'payment_confirmation',
                        title: 'Pago Recibido',
                        message: `Hemos recibido tu pago de $${transaction.amount_in_cents / 100}. ¡Gracias!`,
                        link: `/payments/${transaction.id}`
                    })
            }
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
        })

    } catch (error) {
        console.error(error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return new Response(JSON.stringify({ error: errorMessage }), {
            headers: { "Content-Type": "application/json" },
            status: 400,
        })
    }
})
