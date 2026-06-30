// frontend/src/lib/email-templates.ts
//
// DEPRECATED — Este archivo no tiene callsites activos en el frontend
// (verificado 2026-05-29). Los emails de SportMaps se generan en el BFF
// via `bff/src/utils/emailTemplates.ts` (BrandedEmailTemplates) que ya
// aplica branding por escuela + feature gate + sanitización HTML.
//
// Si necesitas mandar un email desde el frontend en el futuro:
//   - Para correos transaccionales: llama al BFF (que aplica branding).
//   - Para correos del cliente Supabase Auth (reset, invite): se configuran
//     desde Supabase Dashboard > Auth > Email Templates con HTML branded.
//
// Mantenemos este archivo con escape HTML aplicado para que NO sea un vector
// de XSS si alguien lo importa accidentalmente.

function escapeHtml(str: string): string {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const BRAND_GREEN = '#248223'; // SportMaps default — mirror del backend
const BRAND_ORANGE = '#FB9F1E';

/** @deprecated Use BrandedEmailTemplates en BFF. Ver header del archivo. */
export const EmailTemplates = {
    paymentConfirmation: (parentName: string, amount: string, concept: string, receiptNumber: string) => `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: ${BRAND_GREEN};">¡Pago Recibido!</h1>
        <p>Hola ${escapeHtml(parentName)},</p>
        <p>Hemos recibido y validado tu pago exitosamente. Aquí están los detalles:</p>
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Concepto:</strong> ${escapeHtml(concept)}</p>
          <p><strong>Monto:</strong> ${escapeHtml(amount)}</p>
          <p><strong>Referencia:</strong> ${escapeHtml(receiptNumber)}</p>
          <p><strong>Estado:</strong> <span style="color: green; font-weight: bold;">Aprobado</span></p>
        </div>
        <p>Gracias por confiar en nosotros.</p>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;" />
        <p style="color: #6B7280; font-size: 12px;">SportMaps - Gestión Deportiva</p>
      </div>
    `,

    paymentReminder: (parentName: string, amount: string, childName: string, dueDate: string, paymentLink: string) => `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: ${BRAND_ORANGE};">Recordatorio de Pago</h1>
        <p>Hola ${escapeHtml(parentName)},</p>
        <p>Este es un recordatorio amable sobre el pago pendiente para la mensualidad de <strong>${escapeHtml(childName)}</strong>.</p>
        <div style="background-color: #FFFBEB; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #FEF3C7;">
          <p><strong>Monto a pagar:</strong> ${escapeHtml(amount)}</p>
          <p><strong>Fecha límite:</strong> ${escapeHtml(dueDate)}</p>
        </div>
        <a href="${escapeHtml(paymentLink)}" style="background-color: ${BRAND_GREEN}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Pagar Ahora</a>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;" />
        <p style="color: #6B7280; font-size: 12px;">SportMaps - Gestión Deportiva</p>
      </div>
    `,

    welcome: (name: string) => `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: ${BRAND_GREEN};">¡Bienvenido a SportMaps!</h1>
        <p>Hola ${escapeHtml(name)},</p>
        <p>Estamos emocionados de tenerte con nosotros.</p>
        <a href="https://app.sportmaps.co/explorar" style="background-color: ${BRAND_GREEN}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 10px;">Explorar Programas</a>
      </div>
    `,

    invitation: (parentName: string, childName: string, schoolName: string, inviteLink: string) => `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: ${BRAND_GREEN};">¡Invitación de ${escapeHtml(schoolName)}!</h1>
        <p>Hola ${escapeHtml(parentName || 'Padre/Madre')},</p>
        <p>La escuela <strong>${escapeHtml(schoolName)}</strong> ha registrado a <strong>${escapeHtml(childName)}</strong> en su sistema.</p>
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <a href="${escapeHtml(inviteLink)}" style="background-color: ${BRAND_GREEN}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Aceptar Invitación y Crear Cuenta</a>
        </div>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;" />
        <p style="color: #6B7280; font-size: 12px;">SportMaps - Gestión Deportiva</p>
      </div>
    `,
};
