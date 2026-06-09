// bff/src/utils/emailTemplates.ts
//
// Templates de email branded. Cada template:
//   1. Resuelve el branding de la escuela (resolveSchoolBranding) — aplica
//      feature gate por tier; free tier → defaults SportMaps.
//   2. Sanitiza variables del usuario (escapeHtml) para evitar HTML injection.
//   3. Construye HTML final via buildBrandedEmail (layout unificado).
//
// Los templates son async porque hacen un fetch a DB para el branding.
// Si no tenes schoolId, pasa null y se usan defaults SportMaps.
//
// Compatibilidad: existe `EmailTemplates` (export legacy SINCRONICO) para
// los callsites que ya usan el patron viejo. Esos seguiran funcionando
// pero sin branding personalizado. Migrar a `BrandedEmailTemplates` cuando
// se pueda.

import { resolveSchoolBranding, escapeHtml } from './schoolBrandingResolver';
import { buildBrandedEmail } from './emailLayout';

// ─────────────────────────────────────────────────────────────────────────────
// API moderna — async, con branding por escuela
// ─────────────────────────────────────────────────────────────────────────────
export const BrandedEmailTemplates = {
    /**
     * Invitacion a padre/madre para crear cuenta y vincular a un hijo
     * registrado por la escuela.
     */
    invitation: async (params: {
        parentName: string | null;
        childName: string;
        schoolId: string | null;  // si null → defaults SportMaps
        inviteLink: string;
    }): Promise<{ subject: string; html: string }> => {
        const branding = await resolveSchoolBranding(params.schoolId);
        const safeParent = escapeHtml(params.parentName || 'Padre/Madre');
        const safeChild  = escapeHtml(params.childName);

        return {
            subject: `Invitación de ${branding.schoolName.replace(/&amp;/g, '&')}`,
            html: buildBrandedEmail({
                branding,
                title: `¡Invitación de ${branding.schoolName}!`,
                greeting: `Hola ${safeParent},`,
                bodyHtml: `
                    <p>La escuela <strong>${branding.schoolName}</strong> ha registrado
                    a <strong>${safeChild}</strong> en su sistema.</p>
                    <p>Para ver el progreso, realizar pagos y recibir notificaciones,
                    aceptá la invitación y completa tu registro.</p>
                `,
                cta: { label: 'Aceptar Invitación', url: params.inviteLink },
                closingHtml: `
                    <p>Si ya tenés cuenta en SportMaps, el deportista se asociará
                    automáticamente cuando inicies sesión con este correo.</p>
                `,
            }),
        };
    },

    /**
     * Confirmacion de pago aprobado.
     */
    paymentConfirmation: async (params: {
        parentName: string;
        amount: string;
        concept: string;
        receiptNumber: string;
        schoolId: string | null;
    }): Promise<{ subject: string; html: string }> => {
        const branding = await resolveSchoolBranding(params.schoolId);

        return {
            subject: `Pago confirmado — ${branding.schoolName.replace(/&amp;/g, '&')}`,
            html: buildBrandedEmail({
                branding,
                title: '¡Pago Recibido!',
                greeting: `Hola ${escapeHtml(params.parentName)},`,
                bodyHtml: `
                    <p>Hemos recibido y validado tu pago exitosamente. Aquí están los detalles:</p>
                    <table cellpadding="0" cellspacing="0" border="0" width="100%"
                           style="background-color: #f3f4f6; border-radius: 8px; margin: 16px 0;">
                        <tr><td style="padding: 16px;">
                            <p style="margin: 4px 0;"><strong>Concepto:</strong> ${escapeHtml(params.concept)}</p>
                            <p style="margin: 4px 0;"><strong>Monto:</strong> ${escapeHtml(params.amount)}</p>
                            <p style="margin: 4px 0;"><strong>Referencia:</strong> ${escapeHtml(params.receiptNumber)}</p>
                            <p style="margin: 4px 0;"><strong>Estado:</strong>
                                <span style="color: #059669; font-weight: 600;">Aprobado</span></p>
                        </td></tr>
                    </table>
                `,
                closingHtml: 'Gracias por confiar en nosotros.',
            }),
        };
    },

    /**
     * Recordatorio de pago pendiente.
     */
    paymentReminder: async (params: {
        parentName: string;
        amount: string;
        childName: string;
        dueDate: string;
        paymentLink: string;
        schoolId: string | null;
    }): Promise<{ subject: string; html: string }> => {
        const branding = await resolveSchoolBranding(params.schoolId);

        return {
            subject: `Recordatorio de pago — ${branding.schoolName.replace(/&amp;/g, '&')}`,
            html: buildBrandedEmail({
                branding,
                title: 'Recordatorio de Pago',
                greeting: `Hola ${escapeHtml(params.parentName)},`,
                bodyHtml: `
                    <p>Te recordamos amablemente el pago pendiente para la mensualidad
                    de <strong>${escapeHtml(params.childName)}</strong>.</p>
                    <table cellpadding="0" cellspacing="0" border="0" width="100%"
                           style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; margin: 16px 0;">
                        <tr><td style="padding: 16px;">
                            <p style="margin: 4px 0;"><strong>Monto a pagar:</strong> ${escapeHtml(params.amount)}</p>
                            <p style="margin: 4px 0;"><strong>Fecha límite:</strong> ${escapeHtml(params.dueDate)}</p>
                        </td></tr>
                    </table>
                `,
                cta: { label: 'Pagar Ahora', url: params.paymentLink },
                closingHtml: 'Si ya realizaste el pago, podés omitir este mensaje.',
            }),
        };
    },

    /**
     * Bienvenida tras registrarse. Sin schoolId (usuario nuevo sin escuela aún).
     */
    welcome: async (params: { name: string }): Promise<{ subject: string; html: string }> => {
        const branding = await resolveSchoolBranding(null); // defaults SportMaps

        return {
            subject: '¡Bienvenido a SportMaps!',
            html: buildBrandedEmail({
                branding,
                title: '¡Bienvenido a SportMaps!',
                greeting: `Hola ${escapeHtml(params.name)},`,
                bodyHtml: `
                    <p>Estamos emocionados de tenerte con nosotros. Ahora podés gestionar
                    las actividades deportivas de tus hijos de forma fácil y rápida.</p>
                    <p>Explorá las escuelas cercanas y encontrá el programa perfecto.</p>
                `,
                cta: { label: 'Explorar Programas', url: 'https://app.sportmaps.co/explorar' },
            }),
        };
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// API legacy — SINCRONICA, sin branding por escuela.
// Los callsites antiguos no se rompen. Migrar a BrandedEmailTemplates.
// ─────────────────────────────────────────────────────────────────────────────
export const EmailTemplates = {
    paymentConfirmation: (parentName: string, amount: string, concept: string, receiptNumber: string) => `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #248223;">¡Pago Recibido!</h1>
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
        <h1 style="color: #FB9F1E;">Recordatorio de Pago</h1>
        <p>Hola ${escapeHtml(parentName)},</p>
        <p>Este es un recordatorio amable sobre el pago pendiente para la mensualidad de <strong>${escapeHtml(childName)}</strong>.</p>
        <div style="background-color: #FFFBEB; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #FEF3C7;">
          <p><strong>Monto a pagar:</strong> ${escapeHtml(amount)}</p>
          <p><strong>Fecha límite:</strong> ${escapeHtml(dueDate)}</p>
        </div>
        <a href="${escapeHtml(paymentLink)}" style="background-color: #248223; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Pagar Ahora</a>
        <p style="margin-top: 20px;">Si ya realizaste el pago, por favor omite este mensaje.</p>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;" />
        <p style="color: #6B7280; font-size: 12px;">SportMaps - Gestión Deportiva</p>
      </div>
    `,

    welcome: (name: string) => `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #248223;">¡Bienvenido a SportMaps!</h1>
        <p>Hola ${escapeHtml(name)},</p>
        <p>Estamos emocionados de tenerte con nosotros.</p>
        <a href="https://app.sportmaps.co/explorar" style="background-color: #248223; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 10px;">Explorar Programas</a>
      </div>
    `,

    invitation: (parentName: string, childName: string, schoolName: string, inviteLink: string) => `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #248223;">¡Invitación de ${escapeHtml(schoolName)}!</h1>
        <p>Hola ${escapeHtml(parentName || 'Padre/Madre')},</p>
        <p>La escuela <strong>${escapeHtml(schoolName)}</strong> ha registrado a <strong>${escapeHtml(childName)}</strong> en su sistema.</p>
        <p>Para ver el progreso de tu hijo/a, realizar pagos y recibir notificaciones, por favor completa tu registro en SportMaps.</p>
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <a href="${escapeHtml(inviteLink)}" style="background-color: #248223; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Aceptar Invitación y Crear Cuenta</a>
        </div>
        <p>Si ya tenés cuenta, el deportista se asociará automáticamente cuando inicies sesión con este correo.</p>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;" />
        <p style="color: #6B7280; font-size: 12px;">SportMaps - Gestión Deportiva</p>
      </div>
    `,
};
