/**
 * cobro-enlace-publico — el enlace sin login de UN cobro: https://sportmaps.co/p/<token>.
 *
 * Es el destino del botón de las plantillas de cobranza de WhatsApp
 * (bff/whatsapp-templates/*.json). Hasta el 2026-10-04 la ruta no existía y
 * `tokenDelBoton()` devolvía null a propósito, así que la cobranza por
 * WhatsApp NUNCA salía: todo caía al correo con motivo 'sin_enlace'.
 *
 * Qué NO es: un flujo de pago nuevo. Para pagar en línea se crea el MISMO
 * `payment_links` que crea POST /api/v1/payments/create-session (misma
 * referencia SCH-*, misma tarifa en línea, mismo índice de "una pending por
 * cobro"), así el webhook de Wompi lo concilia sin saber que vino de acá.
 *
 * Reglas que se respetan del checkout existente (create-session):
 *   · El monto se calcula en el servidor: base = payments.amount; en línea se
 *     suma `online_fee_pct` de school_settings (recargo de la escuela, ver
 *     memoria "recargo online = de la escuela"). Por transferencia, la base.
 *   · Solo se cobra en línea lo que está en 'pending' u 'overdue' y sin
 *     `requires_review`; y si el pagador tiene el lock de revisión
 *     (is_user_payment_blocked), no.
 *   · La pasarela la decide SOLO resolveProvider (fail-closed por payment_mode).
 *   · Escuela no operativa (prueba vencida) → no se inicia cobro: misma
 *     decisión de producto del 2026-08-12 (requireOperationalSchool), que acá
 *     no aplica sola porque /api/v1/public está en su allowlist.
 *
 * Diferencias deliberadas con create-session:
 *   · La firma de integridad SIEMPRE la calcula el BFF. La Edge Function
 *     `wompi-sign` exige el JWT del acudiente y aquí no hay sesión. Si el BFF
 *     no puede firmar (falta integrity secret), no se ofrece pago en línea:
 *     queda la transferencia.
 *   · Nunca se ofrece un checkout de SANDBOX a un enlace público, salvo
 *     PAGO_PUBLICO_PERMITE_SANDBOX=true. Evidencia del porqué (webhook_events,
 *     Dynasty, 2026-08-27 → 09-19): 13 transacciones `environment=test` del
 *     comercio de pruebas terminaron en "La firma es inválida" — familias
 *     reales que abrieron el Widget con una llave pub_test_ firmada con el
 *     secreto de producción. Un acudiente no debe volver a caer ahí.
 *   · Escuela en 'aggregator' (llaves de ENV): apagado salvo
 *     PAGO_PUBLICO_PERMITE_LLAVES_ENV=true (ver pasarelaParaCobro).
 *   · Solo Wompi. MercadoPago en 'aggregator' está bloqueado (cuenta personal
 *     en ENV) y ninguna escuela 'direct' tiene MP (0 filas al 2026-10-04).
 *
 * Datos que salen a quien tenga el enlace (y nada más): nombre y logo de la
 * escuela, concepto/periodo, nombre CORTO del deportista ("Samuel R."), monto,
 * vencimiento, estado, las cuentas de la escuela para transferir y su link de
 * pago genérico si lo tiene (que la escuela publica para que le paguen). Nunca correo, teléfono ni documento del
 * acudiente, ni ids de otros cobros.
 */

import crypto from 'crypto';
import { supabase } from '../config/supabase';
import { resolveProvider } from './payment-provider.resolver';
import {
    assertUserNotBlocked, UserPaymentBlockedError, copToCents, generateReference,
    signIntegrity, wompiCredsFrom,
} from './wompi.service';
import { mediosDePago } from './whatsapp-medios-de-pago.service';
import { categoriaDeCobro } from './payment-accounts';
import { findDuplicatePaymentIds } from './duplicatePayerGuard.service';

/** Formato del token que emite la RPC: 18 bytes → 24 caracteres base64url. */
export const TOKEN_COBRO_RE = /^[A-Za-z0-9_-]{24}$/;

/** Vigencia del enlace: cubre la escalera completa (día -5 a +12) con holgura. */
const DIAS_VIGENCIA = 30;

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export type EstadoCobro = 'pendiente' | 'vencido' | 'en_revision' | 'pagado' | 'abono' | 'anulado' | 'rechazado';

export interface VistaCobroPublico {
    escuela: { nombre: string; logoUrl: string | null };
    concepto: string;
    periodo: string | null;
    deportista: string | null;
    estado: EstadoCobro;
    /** Lo que se paga por transferencia (sin recargo). */
    monto: number;
    fechaVencimiento: string | null;
    fechaPago: string | null;
    enlaceVenceEn: string;
    enLinea: null | {
        proveedor: 'wompi';
        recargoPct: number;
        recargo: number;
        /** Lo que cobra la pasarela: monto + recargo. */
        total: number;
    };
    transferencia: {
        cuentas: { tipo: string; titular: string | null; numero: string }[];
        /** wa.me de la línea de WhatsApp de la escuela, con el texto prellenado. */
        whatsappComprobante: string | null;
        /**
         * Imagen del QR de pago que la escuela cargó (school_settings.payment_qr_url,
         * p.ej. el QR Bre-B de Bancolombia). Solo https; null si no hay.
         */
        qrEscuelaUrl: string | null;
        /**
         * Link de pago genérico de la escuela (payment_accounts type
         * 'payment_link', p.ej. https://checkout.wompi.co/l/Hj5s7R de Dynasty), o
         * null. NO es `enLinea`: aquel es un checkout de ESTE cobro, firmado por
         * el BFF y conciliado por webhook; este es un link donde el acudiente
         * escribe el valor y la escuela concilia con el comprobante. Por eso va
         * con la transferencia (mismo cierre: mandar el comprobante).
         */
        linkDePago: string | null;
    };
    /**
     * Los OTROS cobros por pagar del mismo pagador en esta escuela, cada uno con
     * su propio enlace. El botón de WhatsApp y el QR del estado de cuenta abren
     * un solo cobro; sin esta lista la familia no vería el resto. Solo concepto,
     * periodo, nombre corto, monto y vencimiento — lo mismo que ya dice el correo.
     */
    otrosPendientes: {
        token: string;
        concepto: string;
        periodo: string | null;
        deportista: string | null;
        monto: number;
        fechaVencimiento: string | null;
        vencido: boolean;
    }[];
}

export type ResultadoResolver =
    | { ok: true; paymentId: string; schoolId: string; venceEn: string }
    | { ok: false; motivo: 'no_existe' | 'vencido' | 'revocado' };

// ─────────────────────────────────────────────────────────────────────────────
// Emitir
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Token del botón de WhatsApp para un cobro. Reusa el vigente (la RPC lo rota
 * cuando le quedan < 7 días). Nunca lanza: null = "no hay enlace", y el job de
 * cobranza cae al correo como antes. Eso cubre también el despliegue del BFF
 * antes de aplicar la migración 20261004083707 (la RPC no existe → null).
 */
export async function emitirTokenCobro(paymentId: string): Promise<string | null> {
    try {
        const { data, error } = await supabase.rpc('cobro_enlace_publico_emitir', {
            p_payment_id: paymentId,
            p_dias: DIAS_VIGENCIA,
        });
        if (error) {
            console.warn('[cobro-enlace-publico] no se pudo emitir el token', { paymentId, error: error.message });
            return null;
        }
        const fila = Array.isArray(data) ? data[0] : data;
        const token = (fila as any)?.enlace_token;
        return typeof token === 'string' && TOKEN_COBRO_RE.test(token) ? token : null;
    } catch (e: any) {
        console.warn('[cobro-enlace-publico] emitir lanzó', { paymentId, error: e?.message });
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolver
// ─────────────────────────────────────────────────────────────────────────────

export async function resolverToken(token: string): Promise<ResultadoResolver> {
    // Se valida el formato ANTES de ir a la base: un token mal formado y uno
    // inexistente responden igual (sin oráculo de existencia).
    if (!TOKEN_COBRO_RE.test(token)) return { ok: false, motivo: 'no_existe' };

    const { data, error } = await supabase.rpc('cobro_enlace_publico_resolver', { p_token: token });
    if (error) throw new Error(`cobro_enlace_publico_resolver: ${error.message}`);

    const fila = (Array.isArray(data) ? data[0] : data) as any;
    if (!fila?.payment_id) return { ok: false, motivo: 'no_existe' };
    if (fila.estado === 'vencido') return { ok: false, motivo: 'vencido' };
    if (fila.estado === 'revocado') return { ok: false, motivo: 'revocado' };
    if (fila.estado !== 'vigente') return { ok: false, motivo: 'no_existe' };
    return { ok: true, paymentId: fila.payment_id, schoolId: fila.school_id, venceEn: fila.vence_en };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers puros (exportados para pruebas)
// ─────────────────────────────────────────────────────────────────────────────

/** "Samuel Rodríguez Pérez" → "Samuel R." — suficiente para que la familia reconozca el cobro. */
export function nombreCorto(full: string | null | undefined): string | null {
    const partes = String(full ?? '').trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return null;
    if (partes.length === 1) return partes[0];
    return `${partes[0]} ${partes[1].charAt(0).toUpperCase()}.`;
}

export function periodoDeCobro(p: { period_year?: number | null; period_month?: number | null }): string | null {
    if (p.period_year && p.period_month && p.period_month >= 1 && p.period_month <= 12) {
        return `${MESES[p.period_month - 1]} ${p.period_year}`;
    }
    return null;
}

export function estadoPublico(status: string, dueDate: string | null, hoyISO: string): EstadoCobro {
    switch (status) {
        case 'paid': return 'pagado';
        case 'partial': return 'abono';
        case 'awaiting_approval': return 'en_revision';
        case 'cancelled': return 'anulado';
        case 'rejected': return 'rechazado';
        case 'overdue': return 'vencido';
        default:
            // 'pending' con fecha pasada se muestra vencido aunque el cron de
            // mora todavía no lo haya marcado (apply_late_fees corre una vez al día).
            return dueDate && dueDate.slice(0, 10) < hoyISO ? 'vencido' : 'pendiente';
    }
}

/** Mismo cálculo que create-session (payments.routes.ts §5): recargo redondeado al peso. */
export function montosEnLinea(base: number, feePct: number): { recargo: number; total: number } {
    const recargo = Math.round(base * (feePct / 100));
    return { recargo, total: base + recargo };
}

export function enlaceWhatsApp(telefono: string | null | undefined, texto: string): string | null {
    const digitos = String(telefono ?? '').replace(/\D/g, '');
    if (digitos.length < 10) return null;
    return `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`;
}

function hoyBogota(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

const permiteSandbox = () => process.env.PAGO_PUBLICO_PERMITE_SANDBOX === 'true';

// ─────────────────────────────────────────────────────────────────────────────
// Lecturas
// ─────────────────────────────────────────────────────────────────────────────

const COLS_COBRO = 'id, school_id, amount, status, concept, payment_category, due_date, payment_date, period_year, period_month, '
    + 'child_id, user_id, parent_id, unregistered_athlete_id, requires_review';

async function leerCobro(paymentId: string, schoolId: string) {
    const { data, error } = await supabase
        .from('payments')
        .select(COLS_COBRO)
        .eq('id', paymentId)
        .eq('school_id', schoolId)
        .maybeSingle();
    if (error) throw new Error(`payments: ${error.message}`);
    return data as any | null;
}

async function nombreDelDeportista(p: any): Promise<string | null> {
    if (p.child_id) {
        const { data } = await supabase.from('children').select('full_name').eq('id', p.child_id).maybeSingle();
        return nombreCorto((data as any)?.full_name);
    }
    if (p.unregistered_athlete_id) {
        const { data } = await supabase.from('unregistered_athletes').select('full_name').eq('id', p.unregistered_athlete_id).maybeSingle();
        return nombreCorto((data as any)?.full_name);
    }
    if (p.user_id) {
        const { data } = await supabase.from('profiles').select('full_name').eq('id', p.user_id).maybeSingle();
        return nombreCorto((data as any)?.full_name);
    }
    return null;
}

async function escuelaOperativa(schoolId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('school_is_operational', { p_school_id: schoolId });
    // Mismo fail-open que requireOperationalSchool: un error de red no apaga cobros.
    if (error) return true;
    return data !== false;
}

/**
 * ¿Se puede cobrar en línea este cobro, y con qué? Devuelve las credenciales
 * resueltas (para firmar) o null. No escribe nada.
 */
async function pasarelaParaCobro(p: any) {
    if (!['pending', 'overdue'].includes(p.status) || p.requires_review) return null;
    if (!(await escuelaOperativa(p.school_id))) return null;

    const resolved = await resolveProvider({ schoolId: p.school_id, preferredProvider: 'wompi' });
    if (!resolved || resolved.provider !== 'wompi') return null;
    if (resolved.sandbox && !permiteSandbox()) return null;
    // Llaves de ENV (escuela en 'aggregator', hoy Dynasty): el checkout vivo NO
    // firma con ellas en el BFF — pide la firma a la Edge Function, cuyo secreto
    // vive en Supabase y es el que hoy aprueba transacciones (6 APPROVED env=prod
    // ago-sep 2026). Que WOMPI_INTEGRITY_SECRET de Render coincida con ese nunca
    // se verificó (payments.routes.ts signFor lo evita a propósito). Firmar acá
    // sin verificarlo podría dar "firma inválida" en producción, así que va
    // apagado hasta que alguien lo pruebe y prenda PAGO_PUBLICO_PERMITE_LLAVES_ENV.
    if (resolved.source === 'env' && process.env.PAGO_PUBLICO_PERMITE_LLAVES_ENV !== 'true') return null;

    const creds = wompiCredsFrom(resolved);
    if (!creds?.integritySecret) return null;
    return { resolved, creds };
}

async function feePctDe(schoolId: string): Promise<number> {
    const { data } = await supabase
        .from('school_settings')
        .select('online_fee_pct')
        .eq('school_id', schoolId)
        .maybeSingle();
    return Number((data as any)?.online_fee_pct ?? 3);
}

export async function whatsappDeLaEscuela(schoolId: string): Promise<string | null> {
    const { data } = await supabase
        .from('school_whatsapp_integrations')
        .select('display_phone_number, status')
        .eq('school_id', schoolId)
        .eq('status', 'active')
        .maybeSingle();
    return (data as any)?.display_phone_number ?? null;
}

/** QR de pago cargado por la escuela; solo si es una URL https (no se sirve cualquier cosa). */
export async function qrPagoDeLaEscuela(schoolId: string): Promise<string | null> {
    const { data } = await supabase
        .from('school_settings')
        .select('payment_qr_url')
        .eq('school_id', schoolId)
        .maybeSingle();
    const url = String((data as any)?.payment_qr_url ?? '').trim();
    return /^https:\/\/[^\s"'<>]+$/i.test(url) ? url : null;
}

const MAX_OTROS = 10;

/**
 * Otros cobros vivos del MISMO pagador (parent_id, si no user_id, si no el
 * atleta no registrado) en la misma escuela. Cada uno con su token: la RPC
 * reusa el vigente, así que abrir la página no multiplica tokens.
 */
async function otrosPendientesDelPagador(p: any): Promise<VistaCobroPublico['otrosPendientes']> {
    const col = p.parent_id ? 'parent_id' : p.user_id ? 'user_id' : p.unregistered_athlete_id ? 'unregistered_athlete_id' : null;
    if (!col) return [];
    const { data, error } = await supabase
        .from('payments')
        .select(COLS_COBRO)
        .eq('school_id', p.school_id)
        .eq(col, p[col])
        .in('status', ['pending', 'overdue', 'partial'])
        .order('due_date', { ascending: true })
        .limit(MAX_OTROS + 1);
    if (error || !data) return [];
    const hoy = hoyBogota();
    // Sin los que ya están pagados bajo una ficha gemela (mismo filtro que la cobranza).
    const duplicados = await findDuplicatePaymentIds(p.school_id, data as any[]).catch(() => new Set<string>());
    const filas = (data as any[]).filter((o) => o.id !== p.id && !duplicados.has(o.id)).slice(0, MAX_OTROS);
    const out: VistaCobroPublico['otrosPendientes'] = [];
    for (const o of filas) {
        const token = await emitirTokenCobro(o.id);
        if (!token) continue;
        out.push({
            token,
            concepto: String(o.concept || 'Mensualidad'),
            periodo: periodoDeCobro(o),
            deportista: await nombreDelDeportista(o),
            monto: Number(o.amount),
            fechaVencimiento: o.due_date ? String(o.due_date).slice(0, 10) : null,
            vencido: estadoPublico(o.status, o.due_date, hoy) === 'vencido',
        });
    }
    return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Vista pública
// ─────────────────────────────────────────────────────────────────────────────

export async function vistaDelCobro(r: Extract<ResultadoResolver, { ok: true }>): Promise<VistaCobroPublico | null> {
    const p = await leerCobro(r.paymentId, r.schoolId);
    if (!p) return null;

    const [{ data: escuela }, deportista, pasarela, feePct, medios, waEscuela, qrEscuela, otros] = await Promise.all([
        supabase.from('schools').select('name, logo_url').eq('id', p.school_id).maybeSingle(),
        nombreDelDeportista(p),
        pasarelaParaCobro(p),
        feePctDe(p.school_id),
        // Con la categoría del cobro: una llave restringida (only_for) solo se
        // muestra en el cobro de su concepto.
        mediosDePago(p.school_id, { categoria: categoriaDeCobro(p.payment_category, p.concept) }),
        whatsappDeLaEscuela(p.school_id),
        qrPagoDeLaEscuela(p.school_id),
        otrosPendientesDelPagador(p),
    ]);

    const monto = Number(p.amount);
    const periodo = periodoDeCobro(p);
    const concepto = String(p.concept || 'Mensualidad');
    const estado = estadoPublico(p.status, p.due_date, hoyBogota());
    const pagable = estado === 'pendiente' || estado === 'vencido' || estado === 'abono' || estado === 'rechazado';

    const textoWa = [
        'Hola, envío el comprobante de pago de',
        concepto + (periodo ? ` (${periodo})` : ''),
        deportista ? `de ${deportista}` : '',
    ].filter(Boolean).join(' ') + '.';

    return {
        escuela: { nombre: (escuela as any)?.name ?? 'Tu escuela', logoUrl: (escuela as any)?.logo_url ?? null },
        concepto,
        periodo,
        deportista,
        estado,
        monto,
        fechaVencimiento: p.due_date ? String(p.due_date).slice(0, 10) : null,
        fechaPago: estado === 'pagado' && p.payment_date ? String(p.payment_date).slice(0, 10) : null,
        enlaceVenceEn: r.venceEn,
        enLinea: pasarela
            ? { proveedor: 'wompi', recargoPct: feePct, ...montosEnLinea(monto, feePct) }
            : null,
        transferencia: pagable
            ? {
                cuentas: medios.cuentas,
                whatsappComprobante: enlaceWhatsApp(waEscuela, textoWa),
                qrEscuelaUrl: qrEscuela,
                // `?? null`: un mediosDePago anterior a este campo no rompe la vista.
                linkDePago: medios.link_de_pago ?? null,
            }
            : { cuentas: [], whatsappComprobante: null, qrEscuelaUrl: null, linkDePago: null },
        otrosPendientes: otros,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Iniciar el pago en línea
// ─────────────────────────────────────────────────────────────────────────────

export type ResultadoIniciar =
    | {
        ok: true;
        provider: 'wompi';
        publicKey: string;
        reference: string;
        signature: string;
        amountInCents: number;
        total: number;
        reused: boolean;
    }
    | { ok: false; status: number; code: string; error: string };

const NO_EN_LINEA = (code: string, error: string, status = 409): ResultadoIniciar => ({ ok: false, status, code, error });

/**
 * Crea (o reusa) la sesión de checkout del cobro del token. El cobro sale SIEMPRE
 * del token: el cuerpo de la petición no puede nombrar otro cobro.
 *
 * Réplica de create-session §4-§7 (payments.routes.ts). Se replica en vez de
 * extraerla porque ese archivo es el checkout vivo de Dynasty y tocarlo para
 * esto no era imprescindible. Si se cambia la regla allá, cambiarla acá; las
 * pruebas de cobro-enlace-publico.routes.test.ts fijan el comportamiento.
 */
export async function iniciarPagoEnLinea(r: Extract<ResultadoResolver, { ok: true }>): Promise<ResultadoIniciar> {
    const p = await leerCobro(r.paymentId, r.schoolId);
    if (!p) return NO_EN_LINEA('no_existe', 'Este enlace de pago no es válido.', 404);

    if (p.status === 'paid') return NO_EN_LINEA('ya_pagado', 'Este cobro ya está pagado.');
    if (!['pending', 'overdue'].includes(p.status)) {
        return NO_EN_LINEA('no_pagable', 'Este cobro no se puede pagar en línea en este momento.');
    }
    if (p.requires_review) {
        return NO_EN_LINEA('PAYMENT_REQUIRES_REVIEW', 'Este cobro está en revisión por la escuela.');
    }

    // Lock de revisión del pagador (mismo que create-session §0).
    const pagador = p.parent_id || p.user_id;
    if (pagador) {
        try {
            await assertUserNotBlocked(pagador);
        } catch (e) {
            if (e instanceof UserPaymentBlockedError) {
                return NO_EN_LINEA('USER_PAYMENT_BLOCKED', 'Hay pagos en revisión por la escuela. Escríbele para destrabarlo.');
            }
            throw e;
        }
    }

    const pasarela = await pasarelaParaCobro(p);
    if (!pasarela) {
        return NO_EN_LINEA('sin_pago_en_linea', 'La escuela no tiene pago en línea disponible. Puedes pagar por transferencia.');
    }
    const { creds } = pasarela;

    const feePct = await feePctDe(p.school_id);
    const baseAmount = Number(p.amount);
    const { recargo: sportmapsFee, total: grossAmount } = montosEnLinea(baseAmount, feePct);

    const ok = (link: { reference: string; gross: number }, reused: boolean): ResultadoIniciar => {
        const amountInCents = copToCents(link.gross);
        return {
            ok: true,
            provider: 'wompi',
            publicKey: creds.publicKey,
            reference: link.reference,
            signature: signIntegrity({ reference: link.reference, amountInCents }, creds),
            amountInCents,
            total: link.gross,
            reused,
        };
    };

    const linkActivo = () => supabase
        .from('payment_links')
        .select('id, provider_reference, wompi_reference, gross_amount, base_amount, fee_pct')
        .eq('payment_id', p.id)
        .eq('payment_provider', 'wompi')
        .eq('status', 'pending')
        .gte('expires_at', new Date().toISOString())
        .maybeSingle();

    // Reuso solo si los montos siguen vigentes (create-session §5.b: el caso
    // Dynasty de un link con fee_pct=0 cobrando la tarifa vieja).
    const { data: existente } = await linkActivo();
    const ref = (l: any) => l?.provider_reference || l?.wompi_reference;
    if (existente && ref(existente)) {
        const igual = Number((existente as any).fee_pct) === feePct
            && Math.abs(Number((existente as any).base_amount) - baseAmount) <= 0.5;
        if (igual) return ok({ reference: ref(existente), gross: Number((existente as any).gross_amount) }, true);
        await supabase
            .from('payment_links')
            .update({ status: 'expired', updated_at: new Date().toISOString() })
            .eq('id', (existente as any).id)
            .eq('status', 'pending');
    }

    // Expirar 'pending' vencidos por tiempo (create-session §6.b).
    await supabase
        .from('payment_links')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('payment_id', p.id)
        .eq('status', 'pending')
        .lt('expires_at', new Date().toISOString());

    const reference = generateReference('school_payment');
    const { error: insErr } = await supabase.from('payment_links').insert({
        payment_id: p.id,
        school_id: p.school_id,
        token: crypto.randomBytes(32).toString('hex'),
        payment_provider: 'wompi',
        provider_reference: reference,
        wompi_reference: reference,
        gross_amount: grossAmount,
        base_amount: baseAmount,
        sportmaps_fee: sportmapsFee,
        fee_pct: feePct,
        status: 'pending',
        expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        failed_attempts: 0,
    });

    if (insErr) {
        // 23505: otra pestaña/otro acudiente abrió el checkout del mismo cobro a la vez
        // (uq_payment_links_one_pending_per_payment). Se reusa el suyo.
        if ((insErr as any).code === '23505') {
            const { data: ganador } = await linkActivo();
            if (ganador && ref(ganador)) {
                return ok({ reference: ref(ganador), gross: Number((ganador as any).gross_amount) }, true);
            }
            // La 'pending' que ganó es de otra pasarela (p.ej. un checkout MP abierto
            // desde la app). No se pisa: se pide esperar a que venza (72 h máx).
            return NO_EN_LINEA('checkout_en_curso', 'Ya hay un pago en curso para este cobro. Intenta de nuevo más tarde.');
        }
        throw new Error(`payment_links insert: ${insErr.message}`);
    }

    return ok({ reference, gross: grossAmount }, false);
}
