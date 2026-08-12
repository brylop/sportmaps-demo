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
    | "coach_invitation"
    | "athlete_invitation"
    | "staff_invitation"
    | "payment_reminder";

interface EmailItem {
    type?: EmailType;
    to: string;
    data?: Record<string, string>;
    subject?: string;
    html?: string;
}

interface EmailPayload extends Partial<EmailItem> {
    // Envío masivo: hasta 100 destinatarios en UNA sola llamada a Resend.
    // 394 invitaciones = 4 requests en vez de 394 (y sin chocar el rate limit).
    batch?: EmailItem[];
}

const RESEND_BATCH_LIMIT = 100;

// ─── Shared Layout (matches Supabase Auth templates) ───
const wrapTemplate = (body: string): string => `
<div style="font-family: 'Poppins', Arial, sans-serif; background-color: #f9f9f9; padding: 40px; text-align: center;">
  <div style="max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e0e0e0;">
    <div style="padding: 20px; background-color: #ffffff;">
      <img src="https://luebjarufsiadojhvxgi.supabase.co/storage/v1/object/public/avatars/LOGO.jpg" alt="SportMaps Logo" style="width: 150px; height: auto;">
    </div>
    <div style="padding: 30px; border-top: 3px solid #248223;">
      ${body}
    </div>
    <div style="background-color: #f1f1f1; padding: 15px; color: #888; font-size: 12px;">
      &copy; 2026 SportMaps Tech. Conectando el deporte.
    </div>
  </div>
</div>`;

const orangeButton = (href: string, text: string): string =>
    `<a href="${href}" style="display: inline-block; padding: 14px 30px; background-color: #FB9F1E; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px; box-shadow: 0 4px 10px rgba(251, 159, 30, 0.3);">${text}</a>`;

// ─── Templates ───
function getSubjectAndHtml(type: EmailType, d: Record<string, string>): { subject: string; html: string } {
    switch (type) {
        case "payment_confirmation":
            return {
                subject: `Pago Aprobado: ${d.concept || "Mensualidad"}`,
                html: wrapTemplate(`
          <h2 style="color: #248223; margin-top: 0;">¡Pago Aprobado!</h2>
          <p style="color: #4a4a4a; line-height: 1.6;">
            Hola <strong>${d.userName}</strong>, te confirmamos que <strong>${d.schoolName}</strong> ha validado exitosamente tu pago.
          </p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; text-align: left;">
            <tr>
              <td style="padding: 10px; color: #888; border-bottom: 1px solid #eee;">Concepto</td>
              <td style="padding: 10px; font-weight: 600; text-align: right; border-bottom: 1px solid #eee;">${d.concept}</td>
            </tr>
            <tr>
              <td style="padding: 10px; color: #888; border-bottom: 1px solid #eee;">Monto</td>
              <td style="padding: 10px; font-weight: 600; text-align: right; border-bottom: 1px solid #eee;">${d.amount}</td>
            </tr>
            <tr>
              <td style="padding: 10px; color: #888; border-bottom: 1px solid #eee;">Referencia</td>
              <td style="padding: 10px; font-family: monospace; text-align: right; border-bottom: 1px solid #eee;">${d.reference}</td>
            </tr>
            <tr>
              <td style="padding: 10px; color: #888;">Estado</td>
              <td style="padding: 10px; color: #248223; font-weight: 600; text-align: right;">Aprobado ✅</td>
            </tr>
          </table>
          <p style="color: #4a4a4a; line-height: 1.6;">
            Puedes descargar tu recibo desde la sección "Mis Pagos" en la aplicación.
          </p>
        `),
            };

        case "enrollment_confirmation":
            return {
                subject: `Inscripción Confirmada: ${d.programName}`,
                html: wrapTemplate(`
          <h2 style="color: #248223; margin-top: 0;">¡Inscripción Exitosa!</h2>
          <p style="color: #4a4a4a; line-height: 1.6;">
            Hola <strong>${d.userName}</strong>, tu inscripción en <strong>${d.programName}</strong> con <strong>${d.schoolName}</strong> ha sido confirmada.
          </p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; text-align: left;">
            <tr>
              <td style="padding: 10px; color: #888; border-bottom: 1px solid #eee;">Programa</td>
              <td style="padding: 10px; font-weight: 600; text-align: right; border-bottom: 1px solid #eee;">${d.programName}</td>
            </tr>
            <tr>
              <td style="padding: 10px; color: #888; border-bottom: 1px solid #eee;">Escuela</td>
              <td style="padding: 10px; font-weight: 600; text-align: right; border-bottom: 1px solid #eee;">${d.schoolName}</td>
            </tr>
            <tr>
              <td style="padding: 10px; color: #888;">Horario</td>
              <td style="padding: 10px; font-weight: 600; text-align: right;">${d.schedule || "Por definir"}</td>
            </tr>
          </table>
          <p style="color: #4a4a4a; line-height: 1.6;">¡Nos vemos en el campo! 🏟️</p>
        `),
            };

        case "welcome_school":
            return {
                subject: "¡Bienvenido a SportMaps!",
                html: wrapTemplate(`
          <h2 style="color: #248223; margin-top: 0;">¡Bienvenido al equipo!</h2>
          <p style="color: #4a4a4a; line-height: 1.6;">
            Hola <strong>${d.userName}</strong>, tu escuela <strong>${d.schoolName}</strong> ha sido creada exitosamente en SportMaps.
          </p>
          <p style="color: #4a4a4a; line-height: 1.6;">
            Estás a un paso de revolucionar tu sistema deportivo. SportMaps conecta atletas, entrenadores y proveedores en tiempo real.
          </p>
          ${orangeButton(d.dashboardUrl || "https://app.sportmaps.co/dashboard", "Ir a mi Dashboard")}
          <p style="color: #4a4a4a; line-height: 1.6; margin-top: 20px;">
            Próximos pasos: configura tus programas, agrega entrenadores e invita a tus deportistas.
          </p>
        `),
            };

        case "parent_invitation":
            return {
                subject: `Te invitaron a unirte a ${d.schoolName} en SportMaps`,
                html: wrapTemplate(`
          <h2 style="color: #248223; margin-top: 0;">¡Has sido invitado!</h2>
          <p style="color: #4a4a4a; line-height: 1.6;">
            La escuela <strong>${d.schoolName}</strong> te ha invitado a unirte a SportMaps para gestionar la información deportiva de tu hijo(a) <strong>${d.childName || ""}</strong>.
          </p>
          ${orangeButton(d.registrationUrl || "https://app.sportmaps.co/register", "Crear mi Cuenta")}
          <p style="color: #888; font-size: 12px; margin-top: 20px;">
            Si el botón no funciona, copia y pega este enlace:<br>
            <span style="color: #248223; word-break: break-all;">${d.registrationUrl || "https://app.sportmaps.co/register"}</span>
          </p>
        `),
            };

        case "coach_invitation":
            return {
                subject: `${d.schoolName} te invita como Entrenador en SportMaps`,
                html: wrapTemplate(`
          <h2 style="color: #248223; margin-top: 0;">Te necesitamos en el equipo</h2>
          <p style="color: #4a4a4a; line-height: 1.6;">
            Hola <strong>${d.coachName}</strong>, la academia <strong>${d.schoolName}</strong> te ha registrado como entrenador en SportMaps.
          </p>
          <p style="color: #4a4a4a; line-height: 1.6;">
            Crea tu cuenta para gestionar tus equipos, planificar entrenamientos y llevar el control de asistencia.
          </p>
          ${orangeButton(d.registrationUrl || "https://app.sportmaps.co/register?role=coach", "Crear mi Cuenta")}
          <p style="color: #888; font-size: 12px; margin-top: 20px;">
            Si el boton no funciona, copia y pega este enlace:<br>
            <span style="color: #248223; word-break: break-all;">${d.registrationUrl || "https://app.sportmaps.co/register?role=coach"}</span>
          </p>
        `),
            };

        // Atleta mayor de edad: se registra él mismo, no un acudiente. Antes le
        // llegaba parent_invitation hablándole de "tu hijo(a)".
        case "athlete_invitation":
            return {
                subject: `${d.schoolName} te invita a entrenar en SportMaps`,
                html: wrapTemplate(`
          <h2 style="color: #248223; margin-top: 0;">¡Te esperamos en la cancha!</h2>
          <p style="color: #4a4a4a; line-height: 1.6;">
            Hola${d.athleteName ? ` <strong>${d.athleteName}</strong>` : ""}, la academia <strong>${d.schoolName}</strong> te invitó a unirte a SportMaps como deportista.
          </p>
          <p style="color: #4a4a4a; line-height: 1.6;">
            Crea tu cuenta para ver tus horarios, tus pagos y tu evolución deportiva. Este registro es para ti: no necesitas un acudiente.
          </p>
          ${orangeButton(d.registrationUrl || "https://app.sportmaps.co/register?role=athlete", "Crear mi Cuenta")}
          <p style="color: #888; font-size: 12px; margin-top: 20px;">
            Si el botón no funciona, copia y pega este enlace:<br>
            <span style="color: #248223; word-break: break-all;">${d.registrationUrl || "https://app.sportmaps.co/register?role=athlete"}</span>
          </p>
        `),
            };

        // Administrador de sede y súper usuario. `roleLabel` viene del llamador
        // para no tener una plantilla por cada rol administrativo.
        case "staff_invitation":
            return {
                subject: `${d.schoolName} te dio acceso como ${d.roleLabel || "miembro del equipo"}`,
                html: wrapTemplate(`
          <h2 style="color: #248223; margin-top: 0;">Tienes un nuevo acceso</h2>
          <p style="color: #4a4a4a; line-height: 1.6;">
            Hola${d.staffName ? ` <strong>${d.staffName}</strong>` : ""}, la academia <strong>${d.schoolName}</strong> te dio acceso a SportMaps como <strong>${d.roleLabel || "miembro del equipo"}</strong>.
          </p>
          <p style="color: #4a4a4a; line-height: 1.6;">
            Crea tu cuenta para entrar al panel de la academia.
          </p>
          ${orangeButton(d.registrationUrl || "https://app.sportmaps.co/register", "Crear mi Cuenta")}
          <p style="color: #888; font-size: 12px; margin-top: 20px;">
            Si el botón no funciona, copia y pega este enlace:<br>
            <span style="color: #248223; word-break: break-all;">${d.registrationUrl || "https://app.sportmaps.co/register"}</span>
          </p>
        `),
            };

        case "payment_reminder":
            return {
                subject: `Recordatorio de Pago — ${d.schoolName}`,
                html: wrapTemplate(`
          <h2 style="color: #FB9F1E; margin-top: 0;">Recordatorio de Pago</h2>
          <p style="color: #4a4a4a; line-height: 1.6;">
            Hola <strong>${d.userName}</strong>, te recordamos que tienes un pago pendiente con <strong>${d.schoolName}</strong>.
          </p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; text-align: left;">
            <tr>
              <td style="padding: 10px; color: #888; border-bottom: 1px solid #eee;">Concepto</td>
              <td style="padding: 10px; font-weight: 600; text-align: right; border-bottom: 1px solid #eee;">${d.concept}</td>
            </tr>
            <tr>
              <td style="padding: 10px; color: #888; border-bottom: 1px solid #eee;">Monto</td>
              <td style="padding: 10px; font-weight: 600; text-align: right; border-bottom: 1px solid #eee;">${d.amount}</td>
            </tr>
            <tr>
              <td style="padding: 10px; color: #888;">Vencimiento</td>
              <td style="padding: 10px; font-weight: 600; text-align: right;">${d.dueDate || "Próximamente"}</td>
            </tr>
          </table>
          ${orangeButton(d.paymentUrl || "https://app.sportmaps.co/my-payments", "Realizar Pago")}
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
        const payload: EmailPayload = await req.json();
        const { type, to, data, subject: rawSubject, html: rawHtml, batch } = payload;

        // ── Envío masivo (POST /emails/batch) ──────────────────────────────
        if (Array.isArray(batch)) {
            if (batch.length === 0) {
                return new Response(
                    JSON.stringify({ error: "'batch' vacío" }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
            if (batch.length > RESEND_BATCH_LIMIT) {
                return new Response(
                    JSON.stringify({ error: `'batch' admite máximo ${RESEND_BATCH_LIMIT} destinatarios por llamada` }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            let emails;
            try {
                emails = batch.map((item) => {
                    if (!item.to) throw new Error("Falta 'to' en un elemento del batch");
                    const built = item.type
                        ? getSubjectAndHtml(item.type, item.data || {})
                        : { subject: item.subject!, html: item.html! };
                    if (!built.subject || !built.html) {
                        throw new Error(`Elemento sin 'type' ni ('subject' y 'html'): ${item.to}`);
                    }
                    return {
                        from: "SportMaps <noreply@sportmaps.co>",
                        to: [item.to],
                        subject: built.subject,
                        html: built.html,
                    };
                });
            } catch (buildErr) {
                return new Response(
                    JSON.stringify({ error: (buildErr as Error).message }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // Sin llave NO se envió nada: devolver 200 con success:true hacía que
            // el cliente contara los correos como enviados y la UI dijera
            // «✅ enviado» sin que saliera uno solo. Falla explícito.
            if (!RESEND_API_KEY) {
                console.error("RESEND_API_KEY not configured");
                return new Response(
                    JSON.stringify({ error: "RESEND_API_KEY no configurada: no se envió ningún correo", sent: 0 }),
                    { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            const batchRes = await fetch("https://api.resend.com/emails/batch", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${RESEND_API_KEY}`,
                },
                body: JSON.stringify(emails),
            });

            const batchText = await batchRes.text();

            if (!batchRes.ok) {
                console.error("Resend batch error:", batchRes.status, batchText);
                // 429 (rate limit) y 4xx de cuota se devuelven tal cual para que
                // el BFF distinga "reintentable" de "se acabó el plan".
                return new Response(
                    JSON.stringify({ error: `Resend error: ${batchRes.status}`, details: batchText }),
                    { status: batchRes.status === 429 ? 429 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // Resend devuelve { data: [{ id }, ...] } en el MISMO orden del request.
            const parsed = JSON.parse(batchText);
            const ids: string[] = (parsed?.data || []).map((d: { id: string }) => d?.id);
            console.log(`Batch enviado: ${ids.length}/${emails.length}`);

            return new Response(
                JSON.stringify({
                    success: true,
                    count: ids.length,
                    results: batch.map((item, i) => ({ to: item.to, id: ids[i] ?? null })),
                }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!to) {
            return new Response(
                JSON.stringify({ error: "Missing 'to' field" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        let subject: string;
        let html: string;

        if (type) {
            const template = getSubjectAndHtml(type, data || {});
            subject = template.subject;
            html = template.html;
        } else if (rawSubject && rawHtml) {
            subject = rawSubject;
            html = rawHtml;
        } else {
            return new Response(
                JSON.stringify({ error: "Missing 'type' or ('subject' and 'html') fields" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Igual que en el batch: sin llave no hay envío, y decir que sí lo hubo
        // es peor que fallar (la escuela cree que avisó y nadie recibió nada).
        if (!RESEND_API_KEY) {
            console.error("RESEND_API_KEY not configured");
            return new Response(
                JSON.stringify({ error: "RESEND_API_KEY no configurada: no se envió el correo" }),
                { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
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
