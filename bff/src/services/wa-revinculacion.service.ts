/**
 * Revincular un número de WhatsApp a OTRO acudiente exige un código por CORREO.
 *
 * Pendiente 2 de docs/cierre-seguridad-ia-pagos-2026-10-05.md. Antes, cuando el
 * número de una conversación ya vinculada pasaba a apuntar a otro acudiente
 * (línea reciclada, SIM-swap, un perfil con un teléfono ajeno),
 * `wa_identify_by_phone` reescribía el vínculo y el bot le mostraba a quien
 * escribía los pagos y atletas de la cuenta nueva.
 *
 * Desde la migración 20261007163135 la RPC devuelve `revinculacion_pendiente`,
 * deja la conversación SIN vínculo y no lo restablece hasta que se verifique
 * (con el `wa_verify_otp` de siempre) un código enviado al correo del acudiente
 * nuevo. Un código por el mismo WhatsApp no frenaría un SIM-swap: quien tiene
 * el número lo recibe.
 *
 * Este módulo es el turno del bot en ese estado. Reutiliza el OTP del bot
 * (mismo hash sha256, mismo `wa_verify_otp`, mismo correo por emailClient):
 * lo que el bot le inyecta son sus propias funciones de envío y escalamiento.
 */
import crypto from 'crypto';
import { supabase } from '../config/supabase';

export const ESTADO_REVINCULACION = 'revinculacion_pendiente';
export const OTP_REVINCULACION_TTL_MIN = 10;

/** Pura: ¿la respuesta de `wa_identify_by_phone` es una revinculación pendiente? */
export function revinculacionPendiente(respuesta: unknown): boolean {
    return !!respuesta && typeof respuesta === 'object'
        && (respuesta as { estado?: unknown }).estado === ESTADO_REVINCULACION;
}

/** Mismo hash que el OTP del bot (`hashOtp` en whatsapp-bot.service): lo compara `wa_verify_otp`. */
export function hashCodigo(codigo: string): string {
    return crypto.createHash('sha256').update(codigo).digest('hex');
}

export function enmascararCorreo(email: string): string {
    const [user, domain] = email.split('@');
    if (!domain) return '***';
    return `${user.slice(0, 2)}${'*'.repeat(Math.max(1, user.length - 2))}@${domain}`;
}

const CODIGO_RE = /\b(\d{6})\b/;

export const MENSAJES = {
    codigoEnviado: (correo: string) =>
        'Por seguridad necesito confirmar que eres tú antes de mostrarte información de pagos o de tus atletas. 🔒\n\n' +
        `Te envié un código de 6 dígitos al correo *${correo}*. Escríbemelo aquí.`,
    codigoVigente: (correo: string) =>
        `Te envié un código de 6 dígitos al correo *${correo}*. Escríbemelo aquí para continuar. 🔒`,
} as const;

export type ResultadoRevinculacion =
    | 'codigo_verificado' | 'codigo_enviado' | 'codigo_vigente' | 'a_la_escuela' | 'sin_revinculacion';

export interface DependenciasRevinculacion {
    /** El `verificarCodigo` del bot (wa_verify_otp + su respuesta a la familia). */
    verificarCodigo: (codigo: string) => Promise<void>;
    enviar: (texto: string, paso: string) => Promise<unknown>;
    /** Escala a la escuela (manda su propio aviso a la familia). */
    escalar: (motivo: string) => Promise<unknown>;
    enviarCorreo: (para: string, codigo: string) => Promise<unknown>;
    /** Para pruebas. */
    generarCodigo?: () => string;
}

/**
 * Atiende un mensaje mientras la revinculación está pendiente. Nunca entrega
 * datos: o verifica el código que mandaron, o (re)manda el código al correo,
 * o —sin correo en el perfil— lo pasa a la escuela.
 */
export async function atenderRevinculacion(
    ctx: { integrationId: string; contactWaId: string; texto: string },
    deps: DependenciasRevinculacion,
): Promise<ResultadoRevinculacion> {
    const codigo = (ctx.texto || '').match(CODIGO_RE)?.[1];
    if (codigo) {
        await deps.verificarCodigo(codigo);
        return 'codigo_verificado';
    }

    const nuevo = deps.generarCodigo
        ? deps.generarCodigo()
        : String(crypto.randomInt(100000, 1000000));
    const { data, error } = await supabase.rpc('wa_iniciar_revinculacion', {
        p_integration_id: ctx.integrationId,
        p_contact_wa_id: ctx.contactWaId,
        p_otp_hash: hashCodigo(nuevo),
        p_expires_at: new Date(Date.now() + OTP_REVINCULACION_TTL_MIN * 60_000).toISOString(),
    });
    const r = (error ? null : data) as { ok?: boolean; motivo?: string; email?: string } | null;

    if (r?.ok && r.email) {
        await deps.enviarCorreo(r.email, nuevo);
        await deps.enviar(MENSAJES.codigoEnviado(enmascararCorreo(r.email)), 'revinculacion_codigo_enviado');
        return 'codigo_enviado';
    }
    if (r?.motivo === 'codigo_vigente' && r.email) {
        await deps.enviar(MENSAJES.codigoVigente(enmascararCorreo(r.email)), 'revinculacion_codigo_vigente');
        return 'codigo_vigente';
    }
    if (r?.motivo === 'sin_correo') {
        await deps.escalar('Número de WhatsApp que pasó a otra cuenta, sin correo para verificar');
        return 'a_la_escuela';
    }
    // RPC caída o sin revinculación: no se entrega nada y tampoco se inventa
    // un código. Quien llama decide (el bot escala).
    return 'sin_revinculacion';
}
