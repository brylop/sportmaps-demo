import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Edge Function: payment-reminders-cron
 *
 * Se ejecuta diariamente (via pg_cron o invocacion manual).
 * Para cada escuela con reminder_enabled=true:
 * 1. Marca pagos vencidos como 'overdue'
 * 2. Busca pagos que vencen en los proximos N dias (reminder_days_before)
 * 3. Busca pagos ya vencidos sin recordatorio reciente
 * 4. Envia email de recordatorio a cada padre/atleta con email
 *
 * Tambien se puede invocar manualmente: POST /payment-reminders-cron
 * con body: { school_id: "uuid" } para ejecutar solo para una escuela.
 */

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Email template ──
function buildReminderHtml(d: {
  parentName: string;
  schoolName: string;
  childName: string;
  teamName: string;
  amount: string;
  dueDate: string;
  isOverdue: boolean;
  paymentUrl: string;
}): { subject: string; html: string } {
  const title = d.isOverdue ? "Pago Vencido" : "Recordatorio de Pago";
  const titleColor = d.isOverdue ? "#FB9F1E" : "#248223";
  const statusText = d.isOverdue
    ? `El pago de <strong>${d.childName}</strong> esta vencido desde el <strong>${d.dueDate}</strong>.`
    : `El pago de <strong>${d.childName}</strong> vence el <strong>${d.dueDate}</strong>.`;

  return {
    subject: `${title} — ${d.schoolName}`,
    html: `
<div style="font-family: 'Poppins', Arial, sans-serif; background-color: #f9f9f9; padding: 40px; text-align: center;">
  <div style="max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e0e0e0;">
    <div style="padding: 20px; background-color: #ffffff;">
      <img src="https://luebjarufsiadojhvxgi.supabase.co/storage/v1/object/public/avatars/LOGO.jpg" alt="Logo" style="width: 150px; height: auto;">
    </div>
    <div style="padding: 30px; border-top: 3px solid ${titleColor};">
      <h2 style="color: ${titleColor}; margin-top: 0;">${title}</h2>
      <p style="color: #4a4a4a; line-height: 1.6;">
        Hola <strong>${d.parentName}</strong>, ${statusText}
      </p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; text-align: left;">
        <tr>
          <td style="padding: 10px; color: #888; border-bottom: 1px solid #eee;">Equipo</td>
          <td style="padding: 10px; font-weight: 600; text-align: right; border-bottom: 1px solid #eee;">${d.teamName}</td>
        </tr>
        <tr>
          <td style="padding: 10px; color: #888; border-bottom: 1px solid #eee;">Monto</td>
          <td style="padding: 10px; font-weight: 600; text-align: right; border-bottom: 1px solid #eee;">${d.amount}</td>
        </tr>
        <tr>
          <td style="padding: 10px; color: #888;">Vencimiento</td>
          <td style="padding: 10px; font-weight: 600; text-align: right;">${d.dueDate}</td>
        </tr>
      </table>
      <a href="${d.paymentUrl}" style="display: inline-block; padding: 14px 30px; background-color: #FB9F1E; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px;">Realizar Pago</a>
    </div>
    <div style="background-color: #f1f1f1; padding: 15px; color: #888; font-size: 12px;">
      &copy; 2026 SportMaps Tech. Conectando el deporte.
    </div>
  </div>
</div>`,
  };
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log(`[SIM] Email a ${to}: ${subject}`);
    return true;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "SportMaps <noreply@sportmaps.co>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    console.error(`Email error (${res.status}):`, await res.text());
    return false;
  }
  return true;
}

function formatCOP(amount: number): string {
  return `$${amount.toLocaleString("es-CO")}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Optional: filter by school_id if provided
    let targetSchoolId: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        targetSchoolId = body.school_id || null;
      } catch { /* no body = run for all */ }
    }

    // 1. Get schools with reminders enabled
    let settingsQuery = supabase
      .from("school_settings")
      .select("school_id, reminder_enabled, reminder_days_before, payment_grace_days")
      .eq("reminder_enabled", true);

    if (targetSchoolId) {
      settingsQuery = settingsQuery.eq("school_id", targetSchoolId);
    }

    const { data: schools, error: schoolsError } = await settingsQuery;

    if (schoolsError) throw schoolsError;
    if (!schools || schools.length === 0) {
      return new Response(
        JSON.stringify({ message: "No schools with reminders enabled", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalSent = 0;
    let totalFailed = 0;
    const today = new Date().toISOString().split("T")[0];

    for (const school of schools) {
      const daysBefore = school.reminder_days_before || 3;
      const graceDays = school.payment_grace_days || 5;

      // Calculate date range: from today to N days ahead (upcoming)
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysBefore);
      const futureDateStr = futureDate.toISOString().split("T")[0];

      // 2. Mark overdue payments (past grace period)
      const graceDate = new Date();
      graceDate.setDate(graceDate.getDate() - graceDays);
      const graceDateStr = graceDate.toISOString().split("T")[0];

      await supabase
        .from("payments")
        .update({ status: "overdue" })
        .eq("school_id", school.school_id)
        .eq("status", "pending")
        .lt("due_date", graceDateStr);

      // 3. Get payments that need reminders:
      //    a) Pending payments due within reminder_days_before
      //    b) Overdue payments (not yet reminded today)
      const { data: payments, error: paymentsError } = await supabase
        .from("payments")
        .select(`
          id, amount, due_date, status, child_id, parent_id, team_id,
          last_reminder_sent
        `)
        .eq("school_id", school.school_id)
        .in("status", ["pending", "overdue"])
        .or(`due_date.lte.${futureDateStr},status.eq.overdue`)
        .order("due_date", { ascending: true });

      if (paymentsError) {
        console.error(`Error fetching payments for ${school.school_id}:`, paymentsError);
        continue;
      }

      if (!payments || payments.length === 0) continue;

      // Filter: skip if reminded today
      const paymentsToRemind = payments.filter((p: any) => {
        if (p.last_reminder_sent && p.last_reminder_sent === today) return false;
        return true;
      });

      if (paymentsToRemind.length === 0) continue;

      // 4. Get related data
      const parentIds = [...new Set(paymentsToRemind.map((p: any) => p.parent_id).filter(Boolean))];
      const childIds = [...new Set(paymentsToRemind.map((p: any) => p.child_id).filter(Boolean))];
      const teamIds = [...new Set(paymentsToRemind.map((p: any) => p.team_id).filter(Boolean))];

      const [parentsRes, childrenRes, teamsRes, schoolRes] = await Promise.all([
        parentIds.length > 0
          ? supabase.from("profiles").select("id, full_name, email, phone").in("id", parentIds)
          : { data: [] },
        childIds.length > 0
          ? supabase.from("children").select("id, full_name, parent_email_temp, parent_phone_temp, parent_id").in("id", childIds)
          : { data: [] },
        teamIds.length > 0
          ? supabase.from("teams").select("id, name").in("id", teamIds)
          : { data: [] },
        supabase.from("schools").select("name").eq("id", school.school_id).single(),
      ]);

      const parentMap = new Map((parentsRes.data || []).map((p: any) => [p.id, p]));
      const childMap = new Map((childrenRes.data || []).map((c: any) => [c.id, c]));
      const teamMap = new Map((teamsRes.data || []).map((t: any) => [t.id, t]));
      const schoolName = schoolRes.data?.name || "Tu Academia";

      // 5. Send reminders
      for (const payment of paymentsToRemind) {
        const parent = parentMap.get(payment.parent_id);
        const child = childMap.get(payment.child_id || "");
        const team = teamMap.get(payment.team_id || "");

        // Determine email: parent profile email OR temp email from child record
        const email = parent?.email || child?.parent_email_temp;
        if (!email) continue;

        const parentName = parent?.full_name || "Padre/Acudiente";
        const childName = child?.full_name || "Deportista";
        const teamName = team?.name || "Equipo";
        const isOverdue = payment.status === "overdue";

        const { subject, html } = buildReminderHtml({
          parentName,
          schoolName,
          childName,
          teamName,
          amount: formatCOP(payment.amount),
          dueDate: formatDate(payment.due_date),
          isOverdue,
          paymentUrl: `https://app.sportmaps.co/my-payments`,
        });

        const sent = await sendEmail(email, subject, html);

        if (sent) {
          totalSent++;
          // Mark as reminded today
          await supabase
            .from("payments")
            .update({ last_reminder_sent: today })
            .eq("id", payment.id);
        } else {
          totalFailed++;
        }
      }
    }

    console.log(`Reminders complete: ${totalSent} sent, ${totalFailed} failed`);

    return new Response(
      JSON.stringify({ success: true, sent: totalSent, failed: totalFailed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Cron error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
