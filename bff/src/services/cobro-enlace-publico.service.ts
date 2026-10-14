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
 *   · El monto se calcula en el servidor: base = payments.amount - amount_paid
 *     (la mora ya va dentro de amount: apply_late_fees la suma); en línea se
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
    signIntegrity, wompiCredsFrom, buildWebCheckoutUrl, signIntegrityWithExpiration,
} from './wompi.service';
import { mediosDePago } from './whatsapp-medios-de-pago.service';
import { enlaceActivarAvisosParaPagador } from './whatsapp-activar-avisos';
import { categoriaDeCobro, esCobroUnico } from './payment-accounts';
import { findDuplicatePaymentIds } from './duplicatePayerGuard.service';
import { debitoEnCurso, MENSAJE_DEBITO_EN_CURSO } from './autopay.service';
import { saldoDelCobro } from '../utils/saldo-cobro';

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
    /** Lo que se paga por transferencia (sin recargo): saldo = amount - amount_paid, mora incluida. */
    monto: number;
    /**
     * Recargo por mora que ya está DENTRO de `monto` (payments.late_fee_amount,
     * lo suma apply_late_fees cada noche); 0 si no hay. Es solo para mostrar el
     * desglose «Mensualidad $X · Recargo por mora $Y»: no se suma otra vez.
     * Nombre en snake_case a propósito: es el contrato con la página /p/:token.
     */
    late_fee_amount: number;
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
    /**
     * wa.me a la línea de la escuela con «… ACTIVAR AVISOS» prellenado: la
     * familia lo envía desde su WhatsApp y el bot registra el consentimiento
     * con ese mensaje como prueba (whatsapp-activar-avisos). null si la escuela
     * no tiene WhatsApp activo o si el número del pagador ya lo dio.
     */
    whatsappAvisos: string | null;
    /**
     * true si este cobro acepta que se suba la foto/PDF del comprobante aquí
     * mismo (POST /:token/comprobante). Pensado para escuelas sin WhatsApp
     * (Dreamers): sin esto el enlace no tenía cómo cerrar una transferencia.
     */
    subirComprobante: boolean;
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

export function periodoDeCobro(p: { period_year?: number | null; period_month?: number | null; payment_category?: string | null }): string | null {
    // Un cobro único (inscripción, seguro…) lleva el período del mes en que
    // nació, pero no ES ese mes: «Seguro de accidentes (Octubre 2026)» se lee
    // como si se cobrara cada mes.
    if (esCobroUnico(p.payment_category)) return null;
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

/** Saldo del cobro (amount - amount_paid - pronto pago, mora incluida): ver utils/saldo-cobro. */
export { saldoDelCobro };

/**
 * Estados que se pueden pagar en línea: pendiente, vencido y abonado
 * ('partial': pagó una parte, se cobra el saldo).
 */
export const ESTADOS_PAGABLES_EN_LINEA = ['pending', 'overdue', 'partial'];

/** Recargo por mora del cobro (payments.late_fee_amount); 0 si no hay o no es número. */
export function moraDelCobro(p: { late_fee_amount?: number | string | null }): number {
    const v = Number(p.late_fee_amount);
    return Number.isFinite(v) && v > 0 ? v : 0;
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

const COLS_COBRO = 'id, school_id, amount, amount_paid, early_payment_discount_applied, late_fee_amount, status, concept, payment_category, due_date, payment_date, period_year, period_month, '
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
    if (!ESTADOS_PAGABLES_EN_LINEA.includes(p.status) || p.requires_review) return null;
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
    // child_id al final: los cobros que la escuela crea en el alta (inscripción,
    // seguro y la mensualidad) nacen sin parent_id hasta que el acudiente
    // vincula su cuenta; sin esto la página del seguro no listaba los otros dos.
    const col = p.parent_id ? 'parent_id' : p.user_id ? 'user_id'
        : p.unregistered_athlete_id ? 'unregistered_athlete_id' : p.child_id ? 'child_id' : null;
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
            monto: saldoDelCobro(o),
            fechaVencimiento: o.due_date ? String(o.due_date).slice(0, 10) : null,
            vencido: estadoPublico(o.status, o.due_date, hoy) === 'vencido',
        });
    }
    return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Vista pública
// ─────────────────────────────────────────────────────────────────────────────

/** Referencia corta y no adivinable a partir de ella sola: 8 hex del id del cobro. */
export function referenciaCortaDeCobro(paymentId: string): string {
    return String(paymentId).replace(/-/g, '').slice(0, 8).toUpperCase();
}

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

    // Saldo vigente, recalculado en cada clic: si anoche apply_late_fees sumó
    // la mora a payments.amount, la familia ve (y paga) el monto ya con mora.
    const monto = saldoDelCobro(p);
    const periodo = periodoDeCobro(p);
    const concepto = String(p.concept || 'Mensualidad');
    const estado = estadoPublico(p.status, p.due_date, hoyBogota());
    const pagable = estado === 'pendiente' || estado === 'vencido' || estado === 'abono' || estado === 'rechazado';

    // La referencia corta (8 primeros hex del id del cobro) es para el bot: el
    // 06-oct dos familias mandaron este texto y nadie lo reconoció. Con la ref
    // el bot responde «mándame la foto» y el worker aplica la imagen que llegue
    // a ESTE cobro aunque la familia tenga varios pendientes del mismo monto
    // (`anunciaComprobante` en whatsapp-reglas-turno, `pistaDeCobro` en el job).
    const textoWa = [
        'Hola, envío el comprobante de pago de',
        concepto + (periodo ? ` (${periodo})` : ''),
        // «Samuel R.» ya trae su punto: sin quitarlo quedaba «Samuel R.. (ref…».
        deportista ? `de ${deportista.replace(/\.+$/, '')}` : '',
    ].filter(Boolean).join(' ') + `. (ref. ${referenciaCortaDeCobro(r.paymentId)})`;

    return {
        escuela: { nombre: (escuela as any)?.name ?? 'Tu escuela', logoUrl: (escuela as any)?.logo_url ?? null },
        concepto,
        periodo,
        deportista,
        estado,
        monto,
        late_fee_amount: moraDelCobro(p),
        fechaVencimiento: p.due_date ? String(p.due_date).slice(0, 10) : null,
        fechaPago: estado === 'pagado' && p.payment_date ? String(p.payment_date).slice(0, 10) : null,
        enlaceVenceEn: r.venceEn,
        enLinea: pasarela && monto > 0
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
        whatsappAvisos: await enlaceActivarAvisosParaPagador(
            p.school_id, p.parent_id || p.user_id || null, (escuela as any)?.name ?? 'la escuela'),
        subirComprobante: ESTADOS_QUE_ACEPTAN_COMPROBANTE.includes(p.status),
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
        /**
         * Link de Web Checkout con el monto ya puesto y firmado (sin redirect-url:
         * quien lo use lo agrega; no entra en la firma). Ver buildWebCheckoutUrl.
         */
        checkoutUrl: string;
        /** Hasta cuándo sirve `checkoutUrl` (expiration-time de Wompi, ISO UTC). */
        checkoutUrlVenceEn: string;
        /** Monto del cobro sin recargo y recargo en línea (total = base + recargo). */
        base: number;
        recargo: number;
    }
    | { ok: false; status: number; code: string; error: string };

const NO_EN_LINEA = (code: string, error: string, status = 409): ResultadoIniciar => ({ ok: false, status, code, error });

/** Vigencia por defecto del link con monto (el «tienes 1 hora para pagar»). */
export const MINUTOS_LINK_CON_MONTO = 60;

/** Cobro por id, sin exigir escuela (para quien parte del id, p.ej. el bot). */
export async function leerCobroPorId(paymentId: string) {
    const { data, error } = await supabase
        .from('payments')
        .select(COLS_COBRO)
        .eq('id', paymentId)
        .maybeSingle();
    if (error) throw new Error(`payments: ${error.message}`);
    return data as any | null;
}

/**
 * Crea (o reusa) la sesión de checkout del cobro del token. El cobro sale SIEMPRE
 * del token: el cuerpo de la petición no puede nombrar otro cobro.
 */
export async function iniciarPagoEnLinea(r: Extract<ResultadoResolver, { ok: true }>): Promise<ResultadoIniciar> {
    const p = await leerCobro(r.paymentId, r.schoolId);
    if (!p) return NO_EN_LINEA('no_existe', 'Este enlace de pago no es válido.', 404);
    return prepararCheckoutDeCobro(p);
}

/**
 * Checkout Wompi de UN cobro ya leído: valida que se pueda pagar, calcula el
 * monto en el servidor y crea (o reusa) su `payment_links` 'pending' con
 * referencia SCH-*. Devuelve lo necesario para el Widget Y un link de Web
 * Checkout con el monto fijo (`checkoutUrl`). El webhook concilia las dos cosas
 * igual: por payment_links.wompi_reference.
 *
 * Réplica de create-session §4-§7 (payments.routes.ts). Se replica en vez de
 * extraerla porque ese archivo es el checkout vivo de Dynasty y tocarlo para
 * esto no era imprescindible. Si se cambia la regla allá, cambiarla acá; las
 * pruebas de cobro-enlace-publico.routes.test.ts fijan el comportamiento.
 *
 * Idempotente entre los 3 BFF: el índice único uq_payment_links_one_pending_per_payment
 * deja UNA 'pending' por cobro; el que pierde la carrera (23505) reusa la del otro.
 *
 * `minutosUrl`: vigencia del link (expiration-time). Un 'pending' que vence antes
 * de ese plazo no se reusa (se expira y se crea otro): así el link entregado
 * nunca nace a punto de vencer.
 */
export async function prepararCheckoutDeCobro(
    p: any,
    opts: { minutosUrl?: number } = {},
): Promise<ResultadoIniciar> {
    const minutosUrl = Math.max(5, Math.floor(opts.minutosUrl ?? MINUTOS_LINK_CON_MONTO));

    if (p.status === 'paid') return NO_EN_LINEA('ya_pagado', 'Este cobro ya está pagado.');
    if (!ESTADOS_PAGABLES_EN_LINEA.includes(p.status)) {
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

    // Débito automático en vuelo: mismo 409 que create-session (§7.3 del spec de débito).
    if (await debitoEnCurso(p.id)) return NO_EN_LINEA('autopay_in_progress', MENSAJE_DEBITO_EN_CURSO);

    const pasarela = await pasarelaParaCobro(p);
    if (!pasarela) {
        return NO_EN_LINEA('sin_pago_en_linea', 'La escuela no tiene pago en línea disponible. Puedes pagar por transferencia.');
    }
    const { creds } = pasarela;

    const feePct = await feePctDe(p.school_id);
    // Saldo vigente (amount - amount_paid - pronto pago), mora incluida: se recalcula en cada
    // clic, así que un link creado antes de que corriera apply_late_fees no se
    // reusa con el monto viejo (ver la comparación de base_amount abajo).
    const baseAmount = saldoDelCobro(p);
    // Nada por cobrar (abonos + pronto pago ya cubren el total): Wompi no acepta $0.
    if (baseAmount <= 0) return NO_EN_LINEA('sin_saldo', 'Este cobro no tiene saldo pendiente.');
    const { recargo: sportmapsFee, total: grossAmount } = montosEnLinea(baseAmount, feePct);

    const ahora = Date.now();
    const plazo = ahora + minutosUrl * 60 * 1000;
    const umbral = new Date(plazo).toISOString();

    const ok = (link: { reference: string; gross: number; base: number; expiresAt: string }, reused: boolean): ResultadoIniciar => {
        const amountInCents = copToCents(link.gross);
        // expiration-time = lo que vence primero: el payment_links o el plazo del link.
        // Formato EXACTO de toISOString (…T20:28:50.000Z): es lo que se firma.
        const venceFila = new Date(link.expiresAt).getTime();
        const expirationTime = new Date(Number.isFinite(venceFila) ? Math.min(venceFila, plazo) : plazo).toISOString();
        return {
            ok: true,
            provider: 'wompi',
            publicKey: creds.publicKey,
            reference: link.reference,
            signature: signIntegrity({ reference: link.reference, amountInCents }, creds),
            amountInCents,
            total: link.gross,
            reused,
            checkoutUrl: buildWebCheckoutUrl({
                publicKey: creds.publicKey,
                reference: link.reference,
                amountInCents,
                expirationTime,
                signature: signIntegrityWithExpiration({ reference: link.reference, amountInCents, expirationTime }, creds),
            }),
            checkoutUrlVenceEn: expirationTime,
            base: link.base,
            recargo: link.gross - link.base,
        };
    };

    const linkActivo = () => supabase
        .from('payment_links')
        .select('id, provider_reference, wompi_reference, gross_amount, base_amount, fee_pct, expires_at')
        .eq('payment_id', p.id)
        .eq('payment_provider', 'wompi')
        .eq('status', 'pending')
        .gte('expires_at', umbral)
        .maybeSingle();

    const ref = (l: any) => l?.provider_reference || l?.wompi_reference;
    const desdeFila = (l: any) => ({
        reference: ref(l) as string,
        gross: Number(l.gross_amount),
        base: Number(l.base_amount),
        expiresAt: String(l.expires_at),
    });

    // Reuso solo si los montos siguen vigentes (create-session §5.b: el caso
    // Dynasty de un link con fee_pct=0 cobrando la tarifa vieja). La base se
    // compara contra el saldo ACTUAL: si la mora nocturna subió `amount` (o
    // entró un abono), el link viejo se expira y se crea otro con el monto nuevo.
    const { data: existente } = await linkActivo();
    if (existente && ref(existente)) {
        const igual = Number((existente as any).fee_pct) === feePct
            && Math.abs(Number((existente as any).base_amount) - baseAmount) <= 0.5;
        if (igual) return ok(desdeFila(existente), true);
        await supabase
            .from('payment_links')
            .update({ status: 'expired', updated_at: new Date().toISOString() })
            .eq('id', (existente as any).id)
            .eq('status', 'pending');
    }

    // Expirar 'pending' vencidos (create-session §6.b) o que vencen antes del plazo
    // del link: si no, el insert chocaría con el índice de una-pending-por-cobro.
    await supabase
        .from('payment_links')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('payment_id', p.id)
        .eq('status', 'pending')
        .lt('expires_at', umbral);

    const reference = generateReference('school_payment');
    const expiresAt = new Date(ahora + 72 * 60 * 60 * 1000).toISOString();
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
        expires_at: expiresAt,
        failed_attempts: 0,
    });

    if (insErr) {
        // 23505: otra pestaña/otro acudiente/otro BFF abrió el checkout del mismo
        // cobro a la vez (uq_payment_links_one_pending_per_payment). Se reusa el suyo.
        if ((insErr as any).code === '23505') {
            const { data: ganador } = await linkActivo();
            if (ganador && ref(ganador)) return ok(desdeFila(ganador), true);
            // La 'pending' que ganó es de otra pasarela (p.ej. un checkout MP abierto
            // desde la app). No se pisa: se pide esperar a que venza (72 h máx).
            return NO_EN_LINEA('checkout_en_curso', 'Ya hay un pago en curso para este cobro. Intenta de nuevo más tarde.');
        }
        throw new Error(`payment_links insert: ${insErr.message}`);
    }

    return ok({ reference, gross: grossAmount, base: baseAmount, expiresAt }, false);
}

// ─────────────────────────────────────────────────────────────────────────────
// Subir el comprobante por el token (escuelas sin WhatsApp)
// ─────────────────────────────────────────────────────────────────────────────
//
// Dreamers no tiene WhatsApp: el enlace solo decía «manda el comprobante por
// WhatsApp» y los cobros sin acudiente vinculado (Sofía, Avril, Zoe) no tenían
// cómo cerrarse. Esto deja el cobro EXACTAMENTE como lo deja el bot de
// comprobantes (`estamparComprobante`: archivo en payment-receipts, OCR,
// veredicto, `awaiting_approval`) y, como el flujo del acudiente en la app,
// solo un verde/amarillo pasa por `evaluatePaymentReceipt` (auto-aprobación si
// la escuela la tiene, o glosa); un rojo queda para revisión humana. El aviso a
// la escuela lo da el job receipt-review-alerts como para cualquier otro camino.
//
// Seguridad: el cobro sale SOLO del token (el cuerpo es el archivo, nada más);
// el tipo se valida por los bytes, no por el Content-Type; la respuesta no trae
// ni el veredicto ni nada del pagador.

/**
 * Estados en que se acepta un comprobante: los que estampa el bot más
 * 'partial' (abono): el comprobante debe ser del SALDO (saldoDelCobro).
 */
export const ESTADOS_QUE_ACEPTAN_COMPROBANTE = ['pending', 'overdue', 'partial'];

/** 6 MB: un pantallazo de banco pesa < 1 MB; un PDF de comprobante, < 500 KB. */
export const MAX_BYTES_COMPROBANTE = 6 * 1024 * 1024;
const MIN_BYTES_COMPROBANTE = 512;

/** Tipo real del archivo por su firma (magic bytes). null = no se acepta. */
export function tipoDeComprobante(buf: Buffer): { mime: string; ext: string } | null {
    if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        return { mime: 'image/png', ext: 'png' };
    }
    if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
    if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
        return { mime: 'image/webp', ext: 'webp' };
    }
    if (buf.length >= 5 && buf.subarray(0, 5).toString('ascii') === '%PDF-') return { mime: 'application/pdf', ext: 'pdf' };
    return null;
}

export type ResultadoSubirComprobante =
    | { ok: true; estado: 'en_revision' | 'pagado' | 'rechazado' }
    | { ok: false; status: number; code: string; error: string };

const NO_SUBE = (status: number, code: string, error: string): ResultadoSubirComprobante => ({ ok: false, status, code, error });

const MENSAJE_REPETIDO = 'Este comprobante ya se usó en otro cobro de la escuela. Si hiciste otra transferencia, sube ese comprobante.';

type LogMin = { info?: (...a: any[]) => void; warn?: (...a: any[]) => void };

export async function subirComprobantePorToken(
    r: Extract<ResultadoResolver, { ok: true }>,
    archivo: Buffer,
    log?: LogMin,
): Promise<ResultadoSubirComprobante> {
    if (!Buffer.isBuffer(archivo) || archivo.length < MIN_BYTES_COMPROBANTE) {
        return NO_SUBE(400, 'archivo_invalido', 'Sube la foto o el PDF del comprobante.');
    }
    if (archivo.length > MAX_BYTES_COMPROBANTE) {
        return NO_SUBE(413, 'archivo_grande', 'El archivo es muy pesado (máximo 6 MB). Sube una captura de pantalla.');
    }
    const tipo = tipoDeComprobante(archivo);
    if (!tipo) return NO_SUBE(415, 'tipo_no_permitido', 'Solo se aceptan imágenes (JPG, PNG, WEBP) o PDF.');

    const p = await leerCobro(r.paymentId, r.schoolId);
    if (!p) return NO_SUBE(404, 'no_existe', 'Este enlace de pago no es válido.');
    if (p.status === 'paid') return NO_SUBE(409, 'ya_pagado', 'Este cobro ya está pagado.');
    if (p.status === 'awaiting_approval') {
        return NO_SUBE(409, 'en_revision', 'Ya recibimos un comprobante para este cobro y la escuela lo está revisando.');
    }
    if (!ESTADOS_QUE_ACEPTAN_COMPROBANTE.includes(p.status)) {
        return NO_SUBE(409, 'no_pagable', 'Este cobro no recibe comprobantes por aquí. Escríbele a la escuela.');
    }
    if (!(await escuelaOperativa(p.school_id))) {
        return NO_SUBE(409, 'escuela_no_operativa', 'La escuela no está recibiendo pagos por SportMaps en este momento.');
    }

    const sha = crypto.createHash('sha256').update(archivo).digest('hex');

    // La misma imagen ya está en otro cobro vivo de la escuela: no se sube de nuevo.
    const { data: repetido } = await supabase
        .from('payments')
        .select('id')
        .eq('school_id', p.school_id)
        .eq('receipt_image_sha256', sha)
        .neq('id', p.id)
        .not('status', 'in', '(cancelled,rejected)')
        .limit(1);
    if (repetido && repetido.length > 0) return NO_SUBE(409, 'comprobante_repetido', MENSAJE_REPETIDO);

    const storagePath = `${p.school_id}/enlace-publico/${p.id}-${Date.now()}.${tipo.ext}`;
    const { error: upErr } = await supabase.storage
        .from('payment-receipts')
        .upload(storagePath, archivo, { contentType: tipo.mime, upsert: false });
    if (upErr) throw new Error(`storage upload: ${upErr.message}`);

    // OCR: si falla (proveedor caído), el comprobante igual queda para revisión
    // manual con el veredicto de una lectura vacía — nunca se pierde.
    const { extractReceipt } = await import('./ocr.service');
    let ocr: Awaited<ReturnType<typeof extractReceipt>> = {
        amount: null, currency: null, date: null, time: null, bank: null, reference: null,
        destination: null, destinationName: null, originName: null,
        isReceipt: true, isTransactionList: false, missingFields: [], provider: 'none',
    };
    try {
        ocr = await extractReceipt(archivo.toString('base64'), tipo.mime);
    } catch (e: any) {
        log?.warn?.({ paymentId: p.id, err: e?.message }, '[cobro-publico] OCR falló; queda para revisión manual');
    }

    // Import diferido: el job arrastra media capa de WhatsApp y varios de esos
    // servicios importan este archivo (evita el ciclo en la carga).
    const { estamparComprobante } = await import('../jobs/whatsapp-queue.job');
    const estampado = await estamparComprobante(
        { schoolId: p.school_id, storagePath, sha, ocr, queueId: `enlace-publico:${p.id}`, log: log as any },
        { id: p.id, amount: Number(p.amount) } as any,
        // Lo que el comprobante debe decir: el saldo (con mora, menos abonos y
        // pronto pago). Sin esto un abono saldado marcaría MONTO_DIFIERE.
        saldoDelCobro(p),
        { estados: ESTADOS_QUE_ACEPTAN_COMPROBANTE },
    );

    if (!estampado.ok || !estampado.actualizado) {
        await supabase.storage.from('payment-receipts').remove([storagePath]).catch(() => undefined);
        if (!estampado.ok && estampado.duplicado) return NO_SUBE(409, 'comprobante_repetido', MENSAJE_REPETIDO);
        if (!estampado.ok) throw new Error(estampado.error);
        return NO_SUBE(409, 'no_pagable', 'Este cobro cambió de estado mientras subías el comprobante. Recarga la página.');
    }

    // Misma regla que el flujo del acudiente en la app (PaymentCheckoutModal →
    // autoEvaluateGlosa): solo verde/amarillo pasan por la evaluación automática
    // (auto-aprobación si la escuela la tiene, o glosa). Un ROJO se queda en
    // `awaiting_approval` para que lo vea una persona: aquí no hay canal para
    // explicarle a la familia un rechazo automático, y un rojo falso (cuenta
    // enmascarada → DESTINO_NO_COINCIDE) le tumbaría un pago legítimo.
    let accion: string | undefined;
    if (estampado.veredicto.verdict === 'verde' || estampado.veredicto.verdict === 'amarillo') {
        const { evaluatePaymentReceipt } = await import('./receipt-approval.service');
        const resultado = await evaluatePaymentReceipt(p.id, log as any).catch(() => ({ action: 'none' as const }));
        accion = (resultado as { action?: string })?.action;
    }
    log?.info?.({ paymentId: p.id, veredicto: estampado.veredicto.verdict, accion }, '[cobro-publico] comprobante subido');

    return { ok: true, estado: accion === 'approved' ? 'pagado' : accion === 'rejected' ? 'rechazado' : 'en_revision' };
}
