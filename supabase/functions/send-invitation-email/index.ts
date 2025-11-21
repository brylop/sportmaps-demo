import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// Temporarily disabled - Resend integration requires additional setup
// import { Resend } from "npm:resend@2.0.0";

// const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InvitationEmailRequest {
  to: string;
  parentName: string;
  childName: string;
  schoolName: string;
  programName: string;
  invitationLink: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      to, 
      parentName, 
      childName, 
      schoolName, 
      programName, 
      invitationLink 
    }: InvitationEmailRequest = await req.json();

    // Temporarily return success - email integration requires additional setup
    console.log("Email request received:", { to, parentName, childName, schoolName, programName });

    /* Commented until Resend is properly configured
    const emailResponse = await resend.emails.send({
      from: "SportMaps <onboarding@resend.dev>",
      to: [to],
      subject: `Invitación para inscribir a ${childName} en ${schoolName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎯 Invitación a SportMaps</h1>
              </div>
              <div class="content">
                <h2>¡Hola ${parentName}!</h2>
                
                <p>Te han invitado a unirte a SportMaps para gestionar la inscripción deportiva de <strong>${childName}</strong>.</p>
                
                <div style="background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0;">
                  <h3 style="margin-top: 0;">📋 Detalles de la Invitación</h3>
                  <p><strong>Escuela:</strong> ${schoolName}</p>
                  <p><strong>Programa:</strong> ${programName}</p>
                  <p><strong>Estudiante:</strong> ${childName}</p>
                </div>

                <p>SportMaps es la plataforma que te permite:</p>
                <ul>
                  <li>✅ Ver el progreso académico y deportivo de tu hijo/a</li>
                  <li>✅ Gestionar pagos y recibos</li>
                  <li>✅ Comunicarte con entrenadores</li>
                  <li>✅ Revisar asistencias y calendario</li>
                </ul>

                <center>
                  <a href="${invitationLink}" class="button">
                    Aceptar Invitación
                  </a>
                </center>

                <p style="color: #666; font-size: 14px; margin-top: 30px;">
                  <strong>Nota:</strong> Esta invitación es personal e intransferible. Si tienes alguna pregunta, contacta directamente con ${schoolName}.
                </p>
              </div>
              <div class="footer">
                <p>© 2024 SportMaps. Todos los derechos reservados.</p>
                <p>Si no solicitaste esta invitación, puedes ignorar este correo.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    console.log("Invitation email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
    */

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Email functionality temporarily disabled - integration in progress" 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-invitation-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
