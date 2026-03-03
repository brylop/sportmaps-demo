import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Template Types ───
type EmailType =
    | "payment_confirmation"
    | "enrollment_confirmation"
    | "welcome_school"
    | "parent_invitation"
    | "payment_reminder";

interface EmailPayload {
    type: EmailType;
    to: string;
    data: Record<string, string>;
}

// ─── Shared Header/Footer ───
const wrapTemplate = (body: string): string => `
<div style="font-family: 'Poppins', Arial, sans-serif; background-color: #f9f9f9; padding: 40px; text-align: center;">
  <div style="max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e0e0e0;">
    <div style="padding: 20px; background-color: #ffffff;">
      <img src="https://luebjarufsiadojhvxgi.supabase.co/storage/v1/object/public/avatars/LOGO.jpg" alt="SportMaps Logo" style="width: 150px; height: auto;">
    </div>
    <div style="padding: 30px; border-top: 3px solid #248223;">
      ${body}
    </div>
    <div style="padding: 15px; background-color: #f4f4f4; font-size: 12px; color: #999;">
      <p style="margin: 5px 0;">SportMaps — Revolucionando el sistema deportivo</p>
      <p style="margin: 5px 0;">Este es un correo automático, no respondas a este mensaje.</p>
    </div>
  </div>
</div>`;

// ─── Templates ───
function getSubjectAndHtml(type: EmailType, d: Record<string, string>): { subject: string; html: string } {
    switch (type) {
        case "payment_confirmation":
            return {
                subject: `Pago Aprobado: ${d.concept || "Mensualidad"}`,
                html: wrapTemplate(`
          <h2 style="color: #248223; margin-top: 0;">¡Pago Aprobado!</h2>
          <p style="color: #4a4a4a; line-height: 1.6;">Hola <strong>${d.userName}</strong>,</p>
          <p style="color: #4a4a4a; line-height: 1.6;">Te confirmamos que <strong>${d.schoolName}</strong> ha validado exitosamente tu pago.</p>
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0; text-align: left;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #64748b;">Concepto:</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">${d.concept}</td></tr>
              <tr><td style="padding: 8px 0; color: #64748b;">Monto:</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">${d.amount}</td></tr>
              <tr><td style="padding: 8px 0; color: #64748b;">Referencia:</td><td style="padding: 8px 0; font-family: monospace; text-align: right;">${d.reference}</td></tr>
              <tr><td style="padding: 8px 0; color: #64748b;">Estado:</td><td style="padding: 8px 0; color: #16a34a; font-weight: 600; text-align: right;">Aprobado ✅</td></tr>
            </table>
          </div>
          <p style="color: #4a4a4a;">Puedes descargar tu recibo desde la sección "Mis Pagos" en la aplicación.</p>
        `),
            };

        case "enrollment_confirmation":
            return {
                subject: `Inscripción Confirmada: ${d.programName}`,
                html: wrapTemplate(`
          <h2 style="color: #248223; margin-top: 0;">¡Inscripción Exitosa!</h2>
          <p style="color: #4a4a4a; line-height: 1.6;">Hola <strong>${d.userName}</strong>,</p>
          <p style="color: #4a4a4a; line-height: 1.6;">Tu inscripción en <strong>${d.programName}</strong> con <strong>${d.schoolName}</strong> ha sido confirmada.</p>
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0; text-align: left;">
            <p style="margin: 5px 0;"><strong>Programa:</strong> ${d.programName}</p>
            <p style="margin: 5px 0;"><strong>Escuela:</strong> ${d.schoolName}</p>
            <p style="margin: 5px 0;"><strong>Horario:</strong> ${d.schedule || "Por definir"}</p>
          </div>
          <p style="color: #4a4a4a;">¡Nos vemos en el campo! 🏟️</p>
        `),
            };

        case "welcome_school":
            return {
                subject: "¡Bienvenido a SportMaps!",
                html: wrapTemplate(`
          <h2 style="color: #248223; margin-top: 0;">¡Bienvenido al equipo!</h2>
          <p style="color: #4a4a4a; line-height: 1.6;">Hola <strong>${d.userName}</strong>,</p>
          <p style="color: #4a4a4a; line-height: 1.6;">Tu escuela <strong>${d.schoolName}</strong> ha sido creada exitosamente en SportMaps.</p>
          <p style="color: #4a4a4a; line-height: 1.6;">Estás a un paso de revolucionar tu sistema deportivo. SportMaps conecta atletas, entrenadores y proveedores en tiempo real.</p>
          <a href="${d.dashboardUrl || 'https://app.sportmaps.co/dashboard'}" style="display: inline-block; padding: 14px 30px; background-color: #FB9F1E; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 10px rgba(251, 159, 30, 0.3); margin: 15px 0;">Ir a mi Dashboard</a>
          <p style="color: #4a4a4a; line-height: 1.6;">Próximos pasos: configura tus programas, agrega entrenadores e invita a tus deportistas.</p>
        `),
            };

        case "parent_invitation":
            return {
                subject: `Te invitaron a unirte a ${d.schoolName} en SportMaps`,
                html: wrapTemplate(`
          <h2 style="color: #248223; margin-top: 0;">¡Has sido invitado!</h2>
          <p style="color: #4a4a4a; line-height: 1.6;">Hola,</p>
          <p style="color: #4a4a4a; line-height: 1.6;">La escuela <strong>${d.schoolName}</strong> te ha invitado a unirte a SportMaps para gestionar la información deportiva de tu hijo(a) <strong>${d.childName || ""}</strong>.</p>
          <a href="${d.registrationUrl || 'https://app.sportmaps.co/register'}" style="display: inline-block; padding: 14px 30px; background-color: #FB9F1E; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 10px rgba(251, 159, 30, 0.3); margin: 15px 0;">Crear mi Cuenta</a>
          <p style="color: #888; font-size: 13px; margin-top: 20px;">Si el botón no funciona, copia y pega este enlace:<br><span style="color: #248223; word-break: break-all;">${d.registrationUrl || 'https://app.sportmaps.co/register'}</span></p>
        `),
            };

        case "payment_reminder":
            return {
                subject: `Recordatorio de Pago — ${d.schoolName}`,
                html: wrapTemplate(`
          <h2 style="color: #FB9F1E; margin-top: 0;">Recordatorio de Pago</h2>
          <p style="color: #4a4a4a; line-height: 1.6;">Hola <strong>${d.userName}</strong>,</p>
          <p style="color: #4a4a4a; line-height: 1.6;">Te recordamos que tienes un pago pendiente con <strong>${d.schoolName}</strong>.</p>
          <div style="background: #fff8f0; padding: 20px; border-radius: 8px; border: 1px solid #FB9F1E; margin: 20px 0; text-align: left;">
            <p style="margin: 5px 0;"><strong>Concepto:</strong> ${d.concept}</p>
            <p style="margin: 5px 0;"><strong>Monto:</strong> ${d.amount}</p>
            <p style="margin: 5px 0;"><strong>Vencimiento:</strong> ${d.dueDate || "Próximamente"}</p>
          </div>
          <a href="${d.paymentUrl || 'https://app.sportmaps.co/payments'}" style="display: inline-block; padding: 14px 30px; background-color: #FB9F1E; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 15px 0;">Realizar Pago</a>
        `),
            };

        default:
            throw new Error(`Tipo de correo no soportado: ${type}`);
    }
}

// ─── Handler ───
Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { type, to, data }: EmailPayload = await req.json();

        if (!type || !to) {
            return new Response(
                JSON.stringify({ error: "Missing 'type' or 'to' field" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!RESEND_API_KEY) {
            console.error("RESEND_API_KEY not configured");
            return new Response(
                JSON.stringify({ success: true, simulated: true, message: "API key missing — email simulated" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const { subject, html } = getSubjectAndHtml(type, data);

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
            const errorText = await res.text();
            console.error("Resend API Error:", errorText);
            return new Response(
                JSON.stringify({ error: `Resend error: ${res.status}`, details: errorText }),
                { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const resendData = await res.json();
        console.log("Email sent successfully:", { type, to, id: resendData.id });

        return new Response(
            JSON.stringify({ success: true, id: resendData.id }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Error in send-email:", error);
        return new Response(
            JSON.stringify({ error: (error as Error).message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
