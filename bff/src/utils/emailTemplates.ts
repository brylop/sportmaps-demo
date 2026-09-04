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
     * Aviso de cobro recién generado (apertura del mes — open_month). Distinto
     * de paymentReminder: este es informativo ("ya está disponible"), no un
     * reclamo por atraso.
     */
    chargeCreated: async (params: {
        parentName: string;
        amount: string;
        childName: string;
        concept: string;
        dueDate: string;
        paymentLink: string;
        schoolId: string | null;
    }): Promise<{ subject: string; html: string }> => {
        const branding = await resolveSchoolBranding(params.schoolId);

        return {
            subject: `Nuevo cobro disponible — ${branding.schoolName.replace(/&amp;/g, '&')}`,
            html: buildBrandedEmail({
                branding,
                title: 'Nuevo Cobro Disponible',
                greeting: `Hola ${escapeHtml(params.parentName)},`,
                bodyHtml: `
                    <p>Ya está disponible la mensualidad de <strong>${escapeHtml(params.childName)}</strong>
                    en <strong>${branding.schoolName}</strong>.</p>
                    <table cellpadding="0" cellspacing="0" border="0" width="100%"
                           style="background-color: #f3f4f6; border-radius: 8px; margin: 16px 0;">
                        <tr><td style="padding: 16px;">
                            <p style="margin: 4px 0;"><strong>Concepto:</strong> ${escapeHtml(params.concept)}</p>
                            <p style="margin: 4px 0;"><strong>Monto:</strong> ${escapeHtml(params.amount)}</p>
                            <p style="margin: 4px 0;"><strong>Vence:</strong> ${escapeHtml(params.dueDate)}</p>
                        </td></tr>
                    </table>
                `,
                cta: { label: 'Pagar Ahora', url: params.paymentLink },
                closingHtml: 'Gracias por estar al día.',
            }),
        };
    },

    /**
     * Recordatorio de pago VENCIDO — se envía una vez pasan los días de gracia
     * (apply_late_fees ya marcó el pago 'overdue'). Distinto de paymentReminder,
     * que es el recordatorio in-app previo al vencimiento.
     */
    paymentOverdue: async (params: {
        parentName: string;
        amount: string;
        childName: string;
        dueDate: string;
        paymentLink: string;
        schoolId: string | null;
    }): Promise<{ subject: string; html: string }> => {
        const branding = await resolveSchoolBranding(params.schoolId);

        return {
            subject: `Pago vencido — ${branding.schoolName.replace(/&amp;/g, '&')}`,
            html: buildBrandedEmail({
                branding,
                title: 'Pago Vencido',
                greeting: `Hola ${escapeHtml(params.parentName)},`,
                bodyHtml: `
                    <p>El pago de la mensualidad de <strong>${escapeHtml(params.childName)}</strong>
                    en <strong>${branding.schoolName}</strong> ya pasó su fecha límite y sigue pendiente.</p>
                    <table cellpadding="0" cellspacing="0" border="0" width="100%"
                           style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; margin: 16px 0;">
                        <tr><td style="padding: 16px;">
                            <p style="margin: 4px 0;"><strong>Monto a pagar:</strong> ${escapeHtml(params.amount)}</p>
                            <p style="margin: 4px 0;"><strong>Venció el:</strong> ${escapeHtml(params.dueDate)}</p>
                        </td></tr>
                    </table>
                `,
                cta: { label: 'Pagar Ahora', url: params.paymentLink },
                closingHtml: 'Si ya realizaste el pago, podés omitir este mensaje.',
            }),
        };
    },

    // ── Glosas (aclaraciones de comprobante) ─────────────────────────────────
    /** Glosa creada → acudiente: necesita aclarar su comprobante. */
    glosaCreada: async (params: {
        parentName: string; concept: string; amount: string; reasonText: string;
        respondsBy: string; link: string; schoolId: string | null;
    }): Promise<{ subject: string; html: string }> => {
        const branding = await resolveSchoolBranding(params.schoolId);
        return {
            subject: `Tu comprobante necesita una aclaración — ${branding.schoolName.replace(/&amp;/g, '&')}`,
            html: buildBrandedEmail({
                branding,
                title: 'Tu comprobante necesita una aclaración',
                greeting: `Hola ${escapeHtml(params.parentName)},`,
                bodyHtml: `
                    <p>Revisamos el comprobante de <strong>${escapeHtml(params.concept)}</strong>
                    (${escapeHtml(params.amount)}) y necesitamos que aclares un detalle:</p>
                    <table cellpadding="0" cellspacing="0" border="0" width="100%"
                           style="background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; margin: 16px 0;">
                        <tr><td style="padding: 16px;">
                            <p style="margin: 4px 0;">${escapeHtml(params.reasonText)}</p>
                            <p style="margin: 8px 0 0;"><strong>Responde antes del ${escapeHtml(params.respondsBy)}.</strong></p>
                        </td></tr>
                    </table>
                `,
                cta: { label: 'Responder ahora', url: params.link },
                closingHtml: 'Si no respondes a tiempo, el pago quedará pendiente.',
            }),
        };
    },

    /** Acudiente respondió → dueño de la escuela: lista para conciliar. */
    glosaRespondida: async (params: {
        parentName: string; concept: string; link: string; schoolId: string | null;
    }): Promise<{ subject: string; html: string }> => {
        const branding = await resolveSchoolBranding(params.schoolId);
        return {
            subject: `Aclaración recibida — ${branding.schoolName.replace(/&amp;/g, '&')}`,
            html: buildBrandedEmail({
                branding,
                title: 'Una aclaración está lista para conciliar',
                greeting: 'Hola,',
                bodyHtml: `<p><strong>${escapeHtml(params.parentName)}</strong> respondió la aclaración
                    del comprobante de <strong>${escapeHtml(params.concept)}</strong>. Ya puedes conciliarla.</p>`,
                cta: { label: 'Ir a conciliar', url: params.link },
            }),
        };
    },

    /** Glosa aceptada → acudiente: pago aprobado. */
    glosaAceptada: async (params: {
        parentName: string; concept: string; amount: string; link: string; schoolId: string | null;
    }): Promise<{ subject: string; html: string }> => {
        const branding = await resolveSchoolBranding(params.schoolId);
        return {
            subject: `Pago aprobado — ${branding.schoolName.replace(/&amp;/g, '&')}`,
            html: buildBrandedEmail({
                branding,
                title: '¡Pago aprobado!',
                greeting: `Hola ${escapeHtml(params.parentName)},`,
                bodyHtml: `<p>Revisamos tu aclaración y tu pago de
                    <strong>${escapeHtml(params.concept)}</strong> (${escapeHtml(params.amount)})
                    quedó <span style="color:#059669;font-weight:600;">aprobado</span>. ¡Gracias!</p>`,
                cta: { label: 'Ver mis pagos', url: params.link },
            }),
        };
    },

    /** Glosa ratificada (o vencida) → acudiente: pago sigue pendiente. */
    glosaRatificada: async (params: {
        parentName: string; concept: string; amount: string; link: string; schoolId: string | null;
        expired?: boolean;
    }): Promise<{ subject: string; html: string }> => {
        const branding = await resolveSchoolBranding(params.schoolId);
        return {
            subject: `Tu pago sigue pendiente — ${branding.schoolName.replace(/&amp;/g, '&')}`,
            html: buildBrandedEmail({
                branding,
                title: 'Tu pago sigue pendiente',
                greeting: `Hola ${escapeHtml(params.parentName)},`,
                bodyHtml: `<p>${params.expired
                    ? 'No recibimos tu aclaración a tiempo, así que'
                    : 'Revisamos tu aclaración pero'} el pago de
                    <strong>${escapeHtml(params.concept)}</strong> (${escapeHtml(params.amount)})
                    <strong>sigue pendiente</strong>. Comunícate con la escuela para regularizarlo.</p>`,
                cta: { label: 'Ver mis pagos', url: params.link },
            }),
        };
    },

    /** Recordatorio: la aclaración vence mañana (última oportunidad). */
    glosaVenceManana: async (params: {
        parentName: string; concept: string; respondsBy: string; link: string; schoolId: string | null;
    }): Promise<{ subject: string; html: string }> => {
        const branding = await resolveSchoolBranding(params.schoolId);
        return {
            subject: `Última oportunidad para aclarar tu comprobante — ${branding.schoolName.replace(/&amp;/g, '&')}`,
            html: buildBrandedEmail({
                branding,
                title: 'Tu aclaración vence mañana',
                greeting: `Hola ${escapeHtml(params.parentName)},`,
                bodyHtml: `<p>Te recordamos que la aclaración del comprobante de
                    <strong>${escapeHtml(params.concept)}</strong> vence
                    <strong>${escapeHtml(params.respondsBy)}</strong>. Si no respondes, el pago
                    quedará pendiente.</p>`,
                cta: { label: 'Responder ahora', url: params.link },
                closingHtml: 'Es la última oportunidad antes de que el plazo se cierre.',
            }),
        };
    },

    // ── Intento de pago online rechazado (Wompi/MercadoPago) ─────────────────
    /** El banco rechazó el intento → acudiente: puede reintentar ya mismo. */
    paymentAttemptFailed: async (params: {
        parentName: string; concept: string; amount: string; bankReason: string | null;
        link: string; schoolId: string | null;
    }): Promise<{ subject: string; html: string }> => {
        const branding = await resolveSchoolBranding(params.schoolId);
        return {
            subject: `Tu pago no se pudo procesar — ${branding.schoolName.replace(/&amp;/g, '&')}`,
            html: buildBrandedEmail({
                branding,
                title: 'Tu pago no se pudo procesar',
                greeting: `Hola ${escapeHtml(params.parentName)},`,
                bodyHtml: `
                    <p>Intentaste pagar <strong>${escapeHtml(params.concept)}</strong>
                    (${escapeHtml(params.amount)}) y el banco rechazó la transacción${
                        params.bankReason ? `: <em>${escapeHtml(params.bankReason)}</em>` : '.'
                    }</p>
                    <p>No te preocupes: el cobro sigue disponible, no perdiste el intento.
                    Podés volver a intentarlo con el mismo medio o con otro.</p>
                `,
                cta: { label: 'Reintentar pago', url: params.link },
                closingHtml: 'Si el problema persiste, contactá directamente a la escuela.',
            }),
        };
    },

    /** Resultado ambiguo (ERROR/VOIDED) → acudiente: que NO reintente todavía. */
    paymentAttemptAmbiguous: async (params: {
        parentName: string; concept: string; amount: string; link: string; schoolId: string | null;
    }): Promise<{ subject: string; html: string }> => {
        const branding = await resolveSchoolBranding(params.schoolId);
        return {
            subject: `No pudimos confirmar tu pago — ${branding.schoolName.replace(/&amp;/g, '&')}`,
            html: buildBrandedEmail({
                branding,
                title: 'No pudimos confirmar tu pago',
                greeting: `Hola ${escapeHtml(params.parentName)},`,
                bodyHtml: `
                    <p>El pago de <strong>${escapeHtml(params.concept)}</strong>
                    (${escapeHtml(params.amount)}) quedó sin confirmar con la pasarela.</p>
                    <p><strong>No vuelvas a pagar todavía</strong>: estamos verificando con el
                    banco si el dinero se movió, y te avisamos apenas lo sepamos.</p>
                `,
                cta: { label: 'Ver mis pagos', url: params.link },
            }),
        };
    },

    /** Intento rechazado/ambiguo → escuela: para que responda con el motivo real. */
    paymentAttemptFailedSchoolAlert: async (params: {
        payerName: string; studentName: string | null; concept: string; amount: string;
        bankReason: string | null; ambiguous: boolean; link: string; schoolId: string | null;
    }): Promise<{ subject: string; html: string }> => {
        const branding = await resolveSchoolBranding(params.schoolId);
        const quien = params.studentName
            ? `${escapeHtml(params.payerName)} (${escapeHtml(params.studentName)})`
            : escapeHtml(params.payerName);
        return {
            subject: params.ambiguous
                ? `Pago sin confirmar — ${branding.schoolName.replace(/&amp;/g, '&')}`
                : `Intento de pago rechazado — ${branding.schoolName.replace(/&amp;/g, '&')}`,
            html: buildBrandedEmail({
                branding,
                title: params.ambiguous ? 'Pago sin confirmar' : 'Intento de pago rechazado',
                greeting: 'Hola,',
                bodyHtml: params.ambiguous
                    ? `<p><strong>${quien}</strong> intentó pagar <strong>${escapeHtml(params.concept)}</strong>
                        (${escapeHtml(params.amount)}) pero la pasarela no confirmó el resultado.
                        Verificá en el dashboard de la pasarela antes de volver a cobrarle: no sabemos
                        todavía si el dinero se movió.</p>`
                    : `<p><strong>${quien}</strong> intentó pagar <strong>${escapeHtml(params.concept)}</strong>
                        (${escapeHtml(params.amount)}) y el banco lo rechazó${
                            params.bankReason ? `: <em>${escapeHtml(params.bankReason)}</em>` : '.'
                        }</p>
                        <p>El cobro sigue pendiente y la familia ya puede reintentar. Si le escribís,
                        contale el motivo exacto en vez de solo decir "no ha pagado" — a veces el
                        rechazo lo dio el banco, no una decisión suya.</p>`,
                cta: { label: 'Ver cartera', url: params.link },
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

    /**
     * Confirmación de clase de prueba agendada por el owner/admin desde el
     * módulo de instalaciones (ver docs/specs/clases-de-prueba-agenda-owner.md).
     * Va al prospecto, no a un usuario con cuenta — sin CTA de login.
     */
    trialClassConfirmation: async (params: {
        prospectName: string;
        childName?: string | null; // presente = prospectName es el acudiente, no el atleta
        dateLabel: string;
        timeLabel: string;
        facilityName: string;
        coachName: string;
        priceLabel: string | null; // null = sin costo, no se muestra la fila
        schoolId: string | null;
    }): Promise<{ subject: string; html: string }> => {
        const branding = await resolveSchoolBranding(params.schoolId);
        const priceRow = params.priceLabel
            ? `<p style="margin: 4px 0;"><strong>Costo:</strong> ${escapeHtml(params.priceLabel)}</p>`
            : '';
        const intro = params.childName
            ? `Confirmamos la clase de prueba de <strong>${escapeHtml(params.childName)}</strong> en <strong>${branding.schoolName}</strong>:`
            : `Confirmamos tu clase de prueba en <strong>${branding.schoolName}</strong>:`;

        return {
            subject: `Confirmación de tu clase de prueba — ${branding.schoolName.replace(/&amp;/g, '&')}`,
            html: buildBrandedEmail({
                branding,
                title: '¡Clase de prueba confirmada!',
                greeting: `Hola ${escapeHtml(params.prospectName)},`,
                bodyHtml: `
                    <p>${intro}</p>
                    <table cellpadding="0" cellspacing="0" border="0" width="100%"
                           style="background-color: #f3f4f6; border-radius: 8px; margin: 16px 0;">
                        <tr><td style="padding: 16px;">
                            <p style="margin: 4px 0;"><strong>Fecha:</strong> ${escapeHtml(params.dateLabel)}</p>
                            <p style="margin: 4px 0;"><strong>Hora:</strong> ${escapeHtml(params.timeLabel)}</p>
                            <p style="margin: 4px 0;"><strong>Lugar:</strong> ${escapeHtml(params.facilityName)}</p>
                            <p style="margin: 4px 0;"><strong>Entrenador:</strong> ${escapeHtml(params.coachName)}</p>
                            ${priceRow}
                        </td></tr>
                    </table>
                `,
                closingHtml: '¡Te esperamos!',
            }),
        };
    },

    /** Cancelación de una clase de prueba ya agendada — ver trialClassConfirmation. */
    trialClassCancellation: async (params: {
        prospectName: string;
        childName?: string | null;
        dateLabel: string;
        timeLabel: string;
        cancelReason?: string | null;
        schoolId: string | null;
    }): Promise<{ subject: string; html: string }> => {
        const branding = await resolveSchoolBranding(params.schoolId);
        const who = params.childName ? `la clase de prueba de <strong>${escapeHtml(params.childName)}</strong>` : 'tu clase de prueba';
        const reasonRow = params.cancelReason
            ? `<p style="margin: 8px 0 0;">Motivo: ${escapeHtml(params.cancelReason)}</p>`
            : '';

        return {
            subject: `Tu clase de prueba fue cancelada — ${branding.schoolName.replace(/&amp;/g, '&')}`,
            html: buildBrandedEmail({
                branding,
                title: 'Clase de prueba cancelada',
                greeting: `Hola ${escapeHtml(params.prospectName)},`,
                bodyHtml: `
                    <p>Te confirmamos que ${who} programada para el <strong>${escapeHtml(params.dateLabel)}</strong> a las <strong>${escapeHtml(params.timeLabel)}</strong> en <strong>${branding.schoolName}</strong> fue cancelada.${reasonRow}</p>
                    <p>Si quieres reagendar, contáctanos cuando quieras.</p>
                `,
            }),
        };
    },

    /** Reprogramación (cambio de fecha/hora) de una clase de prueba ya agendada. */
    trialClassRescheduled: async (params: {
        prospectName: string;
        childName?: string | null;
        dateLabel: string;
        timeLabel: string;
        facilityName: string;
        coachName: string;
        schoolId: string | null;
    }): Promise<{ subject: string; html: string }> => {
        const branding = await resolveSchoolBranding(params.schoolId);
        const who = params.childName ? `la clase de prueba de <strong>${escapeHtml(params.childName)}</strong>` : 'tu clase de prueba';

        return {
            subject: `Tu clase de prueba fue reprogramada — ${branding.schoolName.replace(/&amp;/g, '&')}`,
            html: buildBrandedEmail({
                branding,
                title: 'Clase de prueba reprogramada',
                greeting: `Hola ${escapeHtml(params.prospectName)},`,
                bodyHtml: `
                    <p>Te confirmamos que ${who} en <strong>${branding.schoolName}</strong> fue reprogramada:</p>
                    <table cellpadding="0" cellspacing="0" border="0" width="100%"
                           style="background-color: #f3f4f6; border-radius: 8px; margin: 16px 0;">
                        <tr><td style="padding: 16px;">
                            <p style="margin: 4px 0;"><strong>Nueva fecha:</strong> ${escapeHtml(params.dateLabel)}</p>
                            <p style="margin: 4px 0;"><strong>Nueva hora:</strong> ${escapeHtml(params.timeLabel)}</p>
                            <p style="margin: 4px 0;"><strong>Lugar:</strong> ${escapeHtml(params.facilityName)}</p>
                            <p style="margin: 4px 0;"><strong>Entrenador:</strong> ${escapeHtml(params.coachName)}</p>
                        </td></tr>
                    </table>
                `,
                closingHtml: '¡Te esperamos!',
            }),
        };
    },

    /**
     * Cancelación de una reserva de instalación (alquiler del owner o clase
     * de cortesía pública) — ver reservationRescheduled y useFacilityReservations.
     */
    reservationCancelled: async (params: {
        recipientName: string;
        facilityName: string;
        dateLabel: string;
        timeLabel: string;
        cancelReason?: string | null;
        schoolId: string | null;
    }): Promise<{ subject: string; html: string }> => {
        const branding = await resolveSchoolBranding(params.schoolId);
        const reasonRow = params.cancelReason
            ? `<p style="margin: 8px 0 0;">Motivo: ${escapeHtml(params.cancelReason)}</p>`
            : '';

        return {
            subject: `Tu reserva fue cancelada — ${branding.schoolName.replace(/&amp;/g, '&')}`,
            html: buildBrandedEmail({
                branding,
                title: 'Reserva cancelada',
                greeting: `Hola ${escapeHtml(params.recipientName)},`,
                bodyHtml: `
                    <p>Te confirmamos que tu reserva en <strong>${escapeHtml(params.facilityName)}</strong> programada para el <strong>${escapeHtml(params.dateLabel)}</strong> a las <strong>${escapeHtml(params.timeLabel)}</strong> fue cancelada.${reasonRow}</p>
                    <p>Si quieres reservar de nuevo, contáctanos cuando quieras.</p>
                `,
            }),
        };
    },

    /** Reprogramación (cambio de fecha/hora) de una reserva de instalación. */
    reservationRescheduled: async (params: {
        recipientName: string;
        facilityName: string;
        dateLabel: string;
        timeLabel: string;
        schoolId: string | null;
    }): Promise<{ subject: string; html: string }> => {
        const branding = await resolveSchoolBranding(params.schoolId);

        return {
            subject: `Tu reserva fue reprogramada — ${branding.schoolName.replace(/&amp;/g, '&')}`,
            html: buildBrandedEmail({
                branding,
                title: 'Reserva reprogramada',
                greeting: `Hola ${escapeHtml(params.recipientName)},`,
                bodyHtml: `
                    <p>Te confirmamos que tu reserva en <strong>${branding.schoolName}</strong> fue reprogramada:</p>
                    <table cellpadding="0" cellspacing="0" border="0" width="100%"
                           style="background-color: #f3f4f6; border-radius: 8px; margin: 16px 0;">
                        <tr><td style="padding: 16px;">
                            <p style="margin: 4px 0;"><strong>Nueva fecha:</strong> ${escapeHtml(params.dateLabel)}</p>
                            <p style="margin: 4px 0;"><strong>Nueva hora:</strong> ${escapeHtml(params.timeLabel)}</p>
                            <p style="margin: 4px 0;"><strong>Lugar:</strong> ${escapeHtml(params.facilityName)}</p>
                        </td></tr>
                    </table>
                `,
                closingHtml: '¡Te esperamos!',
            }),
        };
    },

    /**
     * Confirmación de reserva agendada desde el flujo público (/agendar/:slug,
     * bff/src/routes/public-booking.routes.ts POST /confirm) — clase de
     * cortesía o reserva de socio con plan activo. Va al prospecto tras
     * verificar el código OTP; distinta de reservationCancelled/Rescheduled,
     * que son para reservas ya agendadas.
     */
    publicBookingConfirmation: async (params: {
        recipientName: string;
        facilityName: string;
        dateLabel: string;
        timeLabel: string;
        schoolId: string | null;
    }): Promise<{ subject: string; html: string }> => {
        const branding = await resolveSchoolBranding(params.schoolId);

        return {
            subject: `Tu reserva en ${branding.schoolName.replace(/&amp;/g, '&')} está confirmada`,
            html: buildBrandedEmail({
                branding,
                title: '¡Reserva confirmada!',
                greeting: `Hola ${escapeHtml(params.recipientName)},`,
                bodyHtml: `
                    <p>Confirmamos tu reserva en <strong>${branding.schoolName}</strong>:</p>
                    <table cellpadding="0" cellspacing="0" border="0" width="100%"
                           style="background-color: #f3f4f6; border-radius: 8px; margin: 16px 0;">
                        <tr><td style="padding: 16px;">
                            <p style="margin: 4px 0;"><strong>Fecha:</strong> ${escapeHtml(params.dateLabel)}</p>
                            <p style="margin: 4px 0;"><strong>Hora:</strong> ${escapeHtml(params.timeLabel)}</p>
                            <p style="margin: 4px 0;"><strong>Lugar:</strong> ${escapeHtml(params.facilityName)}</p>
                        </td></tr>
                    </table>
                `,
                closingHtml: '¡Te esperamos!',
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
