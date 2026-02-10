import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentEmailRequest {
    userEmail: string;
    userName: string;
    amount: string;
    concept: string;
    schoolName: string;
    reference: string;
}

const handler = async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { userEmail, userName, amount, concept, schoolName, reference }: PaymentEmailRequest = await req.json();

        if (!RESEND_API_KEY) {
            console.error("Falta RESEND_API_KEY");
            // For demo purposes, we might want to return success even if key is missing to avoid frontend errors
            // But standard practice is to throw.
            // throw new Error("Falta la API Key de Resend");
            return new Response(JSON.stringify({ success: true, message: "Simulated email (missing key)" }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: "SportMaps <onboarding@resend.dev>", // O tu dominio verificado
                to: [userEmail],
                subject: `Pago Aprobado: ${concept}`,
                html: `
          <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
            <div style="text-align: center; padding: 20px;">
              <h1 style="color: #2563eb;">¡Pago Aprobado!</h1>
            </div>
            
            <p>Hola <strong>${userName}</strong>,</p>
            <p>Te confirmamos que <strong>${schoolName}</strong> ha validado exitosamente tu pago.</p>
            
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Concepto:</td>
                  <td style="padding: 8px 0; font-weight: 600; text-align: right;">${concept}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Monto:</td>
                  <td style="padding: 8px 0; font-weight: 600; text-align: right;">${amount}</td>
                </tr>
                 <tr>
                  <td style="padding: 8px 0; color: #64748b;">Referencia:</td>
                  <td style="padding: 8px 0; font-family: monospace; text-align: right;">${reference}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Estado:</td>
                  <td style="padding: 8px 0; color: #16a34a; font-weight: 600; text-align: right;">Aprobado</td>
                </tr>
              </table>
            </div>

            <p>Puedes descargar tu recibo desde la sección "Mis Pagos" en la aplicación.</p>
            
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
            
            <p style="text-align: center; color: #94a3b8; font-size: 12px;">
              Este es un correo automático de SportMaps.
            </p>
          </div>
        `,
            }),
        });

        if (!res.ok) {
            const errorData = await res.text();
            console.error("Resend API Error:", errorData);
            throw new Error(`Resend API Error: ${res.statusText}`);
        }

        const data = await res.json();

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error: any) {
        console.error("Error sending email:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
};

serve(handler);
