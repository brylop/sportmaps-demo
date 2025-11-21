import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  userEmail: string;
  userName: string;
  programName: string;
  schoolName: string;
  schedule: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userEmail, userName, programName, schoolName, schedule }: EmailRequest = await req.json();

    if (!RESEND_API_KEY) {
      throw new Error("Falta la API Key de Resend");
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
        subject: `Confirmación de Inscripción: ${programName}`,
        html: `
          <div style="font-family: sans-serif; color: #333;">
            <h1>¡Hola, ${userName}!</h1>
            <p>Tu inscripción en <strong>${programName}</strong> con <strong>${schoolName}</strong> ha sido confirmada exitosamente.</p>
            
            <div style="background: #f4f4f4; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Programa:</strong> ${programName}</p>
              <p style="margin: 5px 0;"><strong>Escuela:</strong> ${schoolName}</p>
              <p style="margin: 5px 0;"><strong>Horario:</strong> ${schedule}</p>
            </div>

            <p>Hemos agendado la primera sesión en tu calendario de SportMaps.</p>
            
            <p>¡Nos vemos en el campo!</p>
            <p><em>El equipo de SportMaps</em></p>
          </div>
        `,
      }),
    });

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);