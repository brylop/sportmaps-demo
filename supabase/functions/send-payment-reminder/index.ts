import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PaymentReminderRequest {
  to: string;
  parentName: string;
  concept: string;
  amount: number;
  dueDate: string;
  paymentLink: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      to, 
      parentName, 
      concept, 
      amount, 
      dueDate,
      paymentLink 
    }: PaymentReminderRequest = await req.json();

    const formattedAmount = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);

    const emailResponse = await resend.emails.send({
      from: "SportMaps Pagos <onboarding@resend.dev>",
      to: [to],
      subject: `Recordatorio de pago: ${concept}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .payment-box { background: white; padding: 25px; border: 2px solid #f59e0b; border-radius: 10px; margin: 20px 0; }
              .button { display: inline-block; padding: 15px 40px; background: #f59e0b; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>💳 Recordatorio de Pago</h1>
              </div>
              <div class="content">
                <h2>Hola ${parentName},</h2>
                
                <p>Este es un recordatorio amistoso sobre un pago pendiente en SportMaps.</p>
                
                <div class="payment-box">
                  <h3 style="margin-top: 0; color: #f59e0b;">📄 Detalles del Pago</h3>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 10px 0; border-bottom: 1px solid #eee;"><strong>Concepto:</strong></td>
                      <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">${concept}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0; border-bottom: 1px solid #eee;"><strong>Monto:</strong></td>
                      <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; font-size: 20px; color: #f59e0b;"><strong>${formattedAmount}</strong></td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0;"><strong>Fecha de Vencimiento:</strong></td>
                      <td style="padding: 10px 0; text-align: right;">${new Date(dueDate).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}</td>
                    </tr>
                  </table>
                </div>

                <p>Puedes realizar el pago de manera fácil y segura a través de nuestra plataforma:</p>

                <center>
                  <a href="${paymentLink}" class="button">
                    Pagar Ahora
                  </a>
                </center>

                <div style="background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0;">
                  <p style="margin: 0;"><strong>Métodos de pago disponibles:</strong></p>
                  <ul style="margin: 10px 0;">
                    <li>Tarjeta de crédito/débito</li>
                    <li>PSE (Pago desde tu banco)</li>
                    <li>Efectivo (Puntos autorizados)</li>
                  </ul>
                </div>

                <p style="color: #666; font-size: 14px; margin-top: 30px;">
                  Si ya realizaste este pago, por favor ignora este recordatorio. Si tienes alguna pregunta, no dudes en contactarnos.
                </p>
              </div>
              <div class="footer">
                <p>© 2024 SportMaps. Todos los derechos reservados.</p>
                <p>Este es un correo automático, por favor no responder.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    console.log("Payment reminder sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-payment-reminder function:", error);
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
