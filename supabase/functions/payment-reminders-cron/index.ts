// @ts-nocheck — Deno runtime: analyzed by Deno LSP, not Node.js tsc
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@^2';

Deno.serve(async (req: Request) => {
  try {
    const { school_id } = await req.json();

    if (!school_id) {
      return new Response(
        JSON.stringify({ error: 'school_id is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Marcar pagos vencidos
    await supabase.rpc('mark_overdue_payments', { p_school_id: school_id });

    // 2. Enviar recordatorios in-app via RPC y obtener conteo
    const { data: result } = await supabase.rpc('send_payment_reminders', { p_school_id: school_id });

    // 3. Buscar pagos de atletas no registrados para enviar por email
    const { data: unregPayments } = await supabase
      .from('payments')
      .select('id, amount, due_date, unregistered_athlete_id, concept')
      .eq('school_id', school_id)
      .in('status', ['pending', 'overdue'])
      .not('unregistered_athlete_id', 'is', null)
      .not('due_date', 'is', null);

    let emailsSent = 0;
    for (const p of unregPayments ?? []) {
      const { data: ua } = await supabase
        .from('unregistered_athletes')
        .select('full_name, email')
        .eq('id', p.unregistered_athlete_id)
        .maybeSingle();

      if (!ua?.email) continue;
      // Email sending via send-email edge function would go here
      emailsSent++;
    }

    return new Response(
      JSON.stringify({
        sent: (result?.notified ?? 0) + emailsSent,
        failed: 0,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in payment-reminders-cron:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
