/**
 * factura-pagador.service — ¿el pagador quiere factura electrónica a su nombre?
 * y, si quiere, con qué datos. Spec:
 * docs/specs/factura-electronica-preferencia-y-datos-del-pagador.md
 *
 * Tabla `payer_billing_profiles` (migración 20261005133534). Dos dueños
 * posibles: un perfil (pagador con cuenta) o (escuela, celular) para el
 * acudiente SIN cuenta — 141 de ~490 pagadores de Dynasty pagan así.
 *
 * Qué NO hace: tocar `profiles.document_*` / `billing_*`. Esos los escribe el
 * checkout (BillingDetailsForm) y la emisión de hoy los sigue usando cuando la
 * preferencia no es 'quiere'. Un enlace público reenviado no puede cambiar el
 * documento del perfil de nadie.
 *
 * Toda escritura va por RPC (validación en un solo lugar, en SQL). Las reglas
 * de abajo la ESPEJAN para dar el mensaje amable antes de ir a la base (el bot
 * pide el dato otra vez sin gastar una ida y vuelta).
 *
 * Degradación: si la migración no está aplicada, toda lectura devuelve null y
 * la emisión sigue exactamente como antes.
 */

import { supabase } from '../config/supabase';
import type { InvoiceCustomer, ProviderConfig } from './invoicing/types';

export type PreferenciaFactura = 'quiere' | 'no_quiere' | 'sin_respuesta';
export const PREFERENCIAS: readonly PreferenciaFactura[] = ['quiere', 'no_quiere', 'sin_respuesta'];

export const TIPOS_DOCUMENTO = ['CC', 'CE', 'NIT', 'PASAPORTE', 'TI', 'RC'] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

/** Mismos rangos que BillingDetailsForm y que factura_pagador_error_de_datos (SQL). */
export const REGLAS_DOCUMENTO: Record<TipoDocumento, { soloDigitos: boolean; min: number; max: number; nombre: string }> = {
    CC: { soloDigitos: true, min: 5, max: 10, nombre: 'La cédula' },
    TI: { soloDigitos: true, min: 6, max: 11, nombre: 'La tarjeta de identidad' },
    RC: { soloDigitos: true, min: 6, max: 11, nombre: 'El registro civil' },
    NIT: { soloDigitos: true, min: 6, max: 10, nombre: 'El NIT' },
    CE: { soloDigitos: false, min: 4, max: 15, nombre: 'La cédula de extranjería' },
    PASAPORTE: { soloDigitos: false, min: 5, max: 20, nombre: 'El pasaporte' },
};

export function esTipoDocumento(t: unknown): t is TipoDocumento {
    return typeof t === 'string' && (TIPOS_DOCUMENTO as readonly string[]).includes(t);
}

/**
 * Deja el número como se guarda: sin puntos, comas, apóstrofos ni espacios
 * (así se escribe a mano: "1.020.304.050"), en mayúscula, y el NIT sin su
 * dígito de verificación (lo calcula la DIAN). Mismo criterio que el SQL.
 */
export function normalizarDocumento(tipo: TipoDocumento, escrito: string | null | undefined): string {
    let v = String(escrito ?? '').trim().replace(/[\s.,'’]/g, '').toUpperCase();
    if (tipo === 'NIT') {
        const conDv = v.match(/^(\d+)[-–—/](\d)$/);
        if (conDv) v = conDv[1];
        else if (/^[89]\d{9}$/.test(v)) v = v.slice(0, 9);
    }
    return v.replace(/[-–—]/g, '');
}

/** null = válido; si no, el mensaje para la familia (español de Colombia). */
export function errorDeDocumento(tipo: TipoDocumento, numero: string): string | null {
    const r = REGLAS_DOCUMENTO[tipo];
    if (!numero) return 'Escribe el número de documento.';
    if (r.soloDigitos && !/^\d+$/.test(numero)) {
        return `${r.nombre} debe tener solo números, sin letras ni símbolos.`;
    }
    if (!r.soloDigitos && !/^[0-9A-Z]+$/.test(numero)) {
        return `${r.nombre} solo admite letras y números.`;
    }
    if (numero.length < r.min || numero.length > r.max) {
        return `${r.nombre} debe tener entre ${r.min} y ${r.max} ${r.soloDigitos ? 'dígitos' : 'caracteres'}; escribiste ${numero.length}.`;
    }
    return null;
}

/** Mismo patrón que el CHECK de la tabla. Laxo a propósito: el que vale es el buzón real. */
const CORREO_RE = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
export function correoValido(correo: string | null | undefined): boolean {
    const c = String(correo ?? '').trim();
    return c.length > 0 && c.length <= 254 && CORREO_RE.test(c);
}

export function normalizarNombre(n: string | null | undefined): string {
    return String(n ?? '').trim().replace(/\s+/g, ' ');
}
export function nombreValido(n: string | null | undefined): boolean {
    const v = normalizarNombre(n);
    return v.length >= 3 && v.length <= 200;
}

/** "juan.perez@gmail.com" → "ju•••@gmail.com" (igual que el SQL de por_token). */
export function enmascararCorreo(c: string | null | undefined): string | null {
    const v = String(c ?? '').trim();
    const at = v.indexOf('@');
    if (at < 1) return null;
    return `${v.slice(0, 2)}•••@${v.slice(at + 1)}`;
}

/**
 * Últimos 10 dígitos SOLO si es un celular colombiano (arranca en 3). Un fijo
 * no se cruza: sus 10 dígitos podrían chocar con el celular de otra familia
 * (misma regla que wa_identify_by_phone).
 */
export function celular10(raw: string | null | undefined): string | null {
    const d = String(raw ?? '').replace(/\D/g, '').slice(-10);
    return /^3\d{9}$/.test(d) ? d : null;
}

/**
 * Adquiriente genérico de la DIAN para quien no pide factura a su nombre:
 * identificación 222222222222 con tipo CC, persona natural. NO se usa salvo
 * que el facturador lo active (`config.consumidor_final === true`): es una
 * decisión de cada escuela (y de su contador), y no está verificado contra el
 * sandbox de Factus V2.
 */
export const CONSUMIDOR_FINAL: InvoiceCustomer = Object.freeze({
    documentType: 'CC',
    identification: '222222222222',
    name: 'Consumidor final',
    email: null,
    phone: null,
    address: null,
    department: null,
    city: null,
    municipalityCode: null,
});

export function consumidorFinalHabilitado(cfg: ProviderConfig | null | undefined): boolean {
    return cfg?.config?.consumidor_final === true;
}

/** ¿Factus debe mandarle la factura por correo a quien la pidió? Apagado por defecto. */
export function envioPorCorreoHabilitado(cfg: ProviderConfig | null | undefined): boolean {
    return cfg?.config?.enviar_factura_por_correo === true;
}

// ─── Lectura ───────────────────────────────────────────────────────────────

export interface FilaFactura {
    preference: PreferenciaFactura;
    document_type: string | null;
    document_number: string | null;
    legal_name: string | null;
    invoice_email: string | null;
    address: string | null;
    city_dane: string | null;
    department: string | null;
}

export type DuenoFactura =
    | { tipo: 'perfil'; profileId: string }
    | { tipo: 'telefono'; schoolId: string; phone10: string };

const COLS = 'preference, document_type, document_number, legal_name, invoice_email, address, city_dane, department';

/** null si no hay fila o si la tabla todavía no existe (migración sin aplicar). */
export async function filaDe(dueno: DuenoFactura): Promise<FilaFactura | null> {
    try {
        const q = supabase.from('payer_billing_profiles').select(COLS);
        const { data, error } = dueno.tipo === 'perfil'
            ? await q.eq('profile_id', dueno.profileId).limit(1).maybeSingle()
            : await q.eq('school_id', dueno.schoolId).eq('phone10', dueno.phone10).limit(1).maybeSingle();
        if (error || !data) return null;
        return data as FilaFactura;
    } catch {
        return null;
    }
}

/**
 * Dueño de la preferencia para un cobro: la cascada de los cuatro caminos
 * (memoria "quién paga"): parent_id → user_id → celular del acudiente sin
 * cuenta (children.parent_phone_temp) → celular del atleta sin invitar.
 */
export async function duenoDelCobro(p: {
    parent_id?: string | null; user_id?: string | null; child_id?: string | null;
    unregistered_athlete_id?: string | null; school_id?: string | null;
}): Promise<DuenoFactura | null> {
    const perfil = p.parent_id || p.user_id;
    if (perfil) return { tipo: 'perfil', profileId: perfil };
    if (!p.school_id) return null;
    try {
        let tel: string | null = null;
        if (p.child_id) {
            const { data } = await supabase.from('children').select('parent_phone_temp').eq('id', p.child_id).maybeSingle();
            tel = celular10((data as any)?.parent_phone_temp);
        } else if (p.unregistered_athlete_id) {
            const { data } = await supabase.from('unregistered_athletes')
                .select('guardian_phone, phone').eq('id', p.unregistered_athlete_id).maybeSingle();
            tel = celular10((data as any)?.guardian_phone || (data as any)?.phone);
        }
        return tel ? { tipo: 'telefono', schoolId: p.school_id, phone10: tel } : null;
    } catch {
        return null;
    }
}

// ─── Decisión de la emisión (pura, probada) ────────────────────────────────

export type OrigenCliente = 'preferencia' | 'perfil' | 'consumidor_final';

/**
 * A nombre de quién sale la factura.
 *
 *   quiere + datos completos → con los datos que dejó (nombre/razón social y
 *                              correo de la factura); dirección y municipio
 *                              caen a los del perfil si no los dio.
 *   no_quiere                → consumidor final SI el facturador lo activó;
 *                              si no, exactamente como hoy (perfil).
 *   sin_respuesta / sin fila → como hoy: el perfil si tiene documento; si no,
 *                              consumidor final solo con el flag; si no, nada
 *                              (el pago queda en "datos fiscales faltantes").
 */
export function decidirClienteDeFactura(p: {
    fila: FilaFactura | null;
    clientePerfil: InvoiceCustomer | null;
    consumidorFinal: boolean;
}): { customer: InvoiceCustomer | null; origen: OrigenCliente | null } {
    const { fila, clientePerfil, consumidorFinal } = p;

    if (fila?.preference === 'quiere' && esTipoDocumento(fila.document_type)
        && fila.document_number && nombreValido(fila.legal_name)) {
        const ciudad = (fila.city_dane ?? '').trim();
        return {
            origen: 'preferencia',
            customer: {
                documentType: fila.document_type,
                identification: fila.document_number.replace(/\s+/g, ''),
                name: normalizarNombre(fila.legal_name),
                email: fila.invoice_email || clientePerfil?.email || null,
                phone: clientePerfil?.phone ?? null,
                address: fila.address || clientePerfil?.address || null,
                department: fila.department || (ciudad ? null : clientePerfil?.department) || null,
                city: ciudad || clientePerfil?.city || null,
                municipalityCode: ciudad || clientePerfil?.municipalityCode || null,
            },
        };
    }

    if (fila?.preference === 'no_quiere' && consumidorFinal) {
        return { customer: { ...CONSUMIDOR_FINAL }, origen: 'consumidor_final' };
    }
    if (clientePerfil) return { customer: clientePerfil, origen: 'perfil' };
    if (consumidorFinal) return { customer: { ...CONSUMIDOR_FINAL }, origen: 'consumidor_final' };
    return { customer: null, origen: null };
}

/** ¿La escuela emite factura electrónica hoy? (facturador activo). */
export async function escuelaFacturaElectronicamente(schoolId: string): Promise<boolean> {
    try {
        const { data } = await supabase.from('electronic_invoice_providers')
            .select('id').eq('owner_type', 'school').eq('owner_id', schoolId).eq('enabled', true)
            .limit(1).maybeSingle();
        return !!data;
    } catch {
        return false;
    }
}

// ─── Escritura ─────────────────────────────────────────────────────────────

export interface DatosFactura {
    preferencia: PreferenciaFactura;
    tipoDocumento?: string | null;
    numeroDocumento?: string | null;
    nombre?: string | null;
    correo?: string | null;
    direccion?: string | null;
    ciudadDane?: string | null;
    departamento?: string | null;
}

export type ResultadoGuardar = { ok: true } | { ok: false; error: string };

/** Validación del lado del BFF (la definitiva es la del SQL). */
export function errorDeDatos(d: DatosFactura): string | null {
    if (!PREFERENCIAS.includes(d.preferencia)) return 'preferencia_invalida';
    if (d.preferencia !== 'quiere') return null;
    if (!esTipoDocumento(d.tipoDocumento)) return 'tipo_documento_invalido';
    if (errorDeDocumento(d.tipoDocumento, normalizarDocumento(d.tipoDocumento, d.numeroDocumento))) return 'documento_invalido';
    if (!nombreValido(d.nombre)) return 'nombre_invalido';
    if (d.correo && !correoValido(d.correo)) return 'correo_invalido';
    if (d.ciudadDane && !/^\d{4,5}$/.test(d.ciudadDane)) return 'municipio_invalido';
    return null;
}

function paramsRpc(d: DatosFactura) {
    const tipo = esTipoDocumento(d.tipoDocumento) ? d.tipoDocumento : null;
    return {
        p_preferencia: d.preferencia,
        p_tipo: tipo,
        p_numero: tipo ? normalizarDocumento(tipo, d.numeroDocumento) : null,
        p_nombre: d.nombre ? normalizarNombre(d.nombre) : null,
        p_correo: d.correo ? String(d.correo).trim().toLowerCase() : null,
        p_direccion: d.direccion?.trim() || null,
        p_ciudad: d.ciudadDane?.trim() || null,
        p_depto: d.departamento?.trim() || null,
    };
}

function resultadoRpc(data: any, error: any): ResultadoGuardar {
    if (error) return { ok: false, error: 'no_disponible' };
    const r = (Array.isArray(data) ? data[0] : data) as { ok?: boolean; error?: string } | null;
    return r?.ok ? { ok: true } : { ok: false, error: r?.error || 'no_disponible' };
}

/** Guardar desde el bot (service_role): el dueño lo resolvió el bot por teléfono. */
export async function guardarParaDueno(dueno: DuenoFactura, d: DatosFactura, fuente: 'whatsapp' | 'escuela'): Promise<ResultadoGuardar> {
    const err = errorDeDatos(d);
    if (err) return { ok: false, error: err };
    try {
        const { data, error } = await supabase.rpc('factura_pagador_upsert', {
            p_profile_id: dueno.tipo === 'perfil' ? dueno.profileId : null,
            p_school_id: dueno.tipo === 'telefono' ? dueno.schoolId : null,
            p_phone10: dueno.tipo === 'telefono' ? dueno.phone10 : null,
            ...paramsRpc(d),
            p_fuente: fuente,
        });
        return resultadoRpc(data, error);
    } catch {
        return { ok: false, error: 'no_disponible' };
    }
}

export interface ResumenPorToken {
    disponible: boolean;
    /** false = el cobro no tiene a quién atribuirle la preferencia. */
    pagador: boolean;
    preferencia: PreferenciaFactura;
    tieneDatos: boolean;
    tipoDocumento: string | null;
    documentoTermina: string | null;
    correoEnmascarado: string | null;
}

const SIN_RESUMEN: ResumenPorToken = {
    disponible: false, pagador: false, preferencia: 'sin_respuesta', tieneDatos: false,
    tipoDocumento: null, documentoTermina: null, correoEnmascarado: null,
};

/**
 * Lo que ve /p/<token>: un resumen ENMASCARADO. El enlace se puede reenviar,
 * así que nunca sale el documento ni el correo completos.
 * null = token inválido/vencido.
 */
export async function resumenPorToken(token: string): Promise<ResumenPorToken | null> {
    try {
        const { data, error } = await supabase.rpc('factura_pagador_por_token', { p_token: token });
        if (error) return { ...SIN_RESUMEN };   // migración sin aplicar → se esconde el bloque
        const r = (Array.isArray(data) ? data[0] : data) as any;
        if (!r?.ok) return null;
        if (!r.pagador) return { ...SIN_RESUMEN, disponible: true };
        return {
            disponible: true,
            pagador: true,
            preferencia: PREFERENCIAS.includes(r.preferencia) ? r.preferencia : 'sin_respuesta',
            tieneDatos: !!r.tieneDatos,
            tipoDocumento: r.tipoDocumento ?? null,
            documentoTermina: r.documentoTermina ?? null,
            correoEnmascarado: r.correoEnmascarado ?? null,
        };
    } catch {
        return { ...SIN_RESUMEN };
    }
}

export async function guardarPorToken(token: string, d: DatosFactura): Promise<ResultadoGuardar> {
    const err = errorDeDatos(d);
    if (err) return { ok: false, error: err };
    try {
        const { data, error } = await supabase.rpc('factura_pagador_guardar_por_token', {
            p_token: token, ...paramsRpc(d),
        });
        return resultadoRpc(data, error);
    } catch {
        return { ok: false, error: 'no_disponible' };
    }
}

/** Mensajes para la familia por código de error (BFF y SQL usan los mismos). */
export const MENSAJE_ERROR: Record<string, string> = {
    preferencia_invalida: 'Elige si quieres o no factura electrónica.',
    tipo_documento_invalido: 'Elige el tipo de documento.',
    documento_invalido: 'Revisa el número de documento.',
    nombre_invalido: 'Escribe el nombre completo o la razón social.',
    correo_invalido: 'Revisa el correo electrónico.',
    municipio_invalido: 'Elige el municipio de la lista.',
    sin_pagador: 'Este cobro no tiene un pagador registrado. Pídele a la escuela que lo revise.',
    token_invalido: 'Este enlace ya no está disponible.',
    no_disponible: 'No pudimos guardar tus datos en este momento. Intenta de nuevo más tarde.',
};

