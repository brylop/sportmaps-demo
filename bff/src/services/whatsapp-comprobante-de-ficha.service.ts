/**
 * whatsapp-comprobante-de-ficha — comprobantes que el bot escalaba porque no
 * sabía de quién eran (Dynasty, 28-sep → 08-oct: 43 de 188 adjuntos).
 *
 *  (a) Familia SIN cuenta pero con ficha por teléfono (`children.parent_phone_temp`
 *      o `unregistered_athletes.guardian_phone/phone`): el cobro se busca por
 *      la ficha (`child_id` / `unregistered_athlete_id`) y se aplica igual que a
 *      una familia con cuenta. No se le pide crear la cuenta para pagar.
 *  (b) Número SIN ficha: se busca al deportista por nombre en lo que escribió
 *      (pie, chat, concepto del comprobante, nombre de quien paga). Con un
 *      único candidato se aplica; si no, se pregunta UNA vez «¿De qué
 *      deportista es este pago?» y la respuesta se resuelve igual (único
 *      candidato o a la escuela).
 *  (c) Varios cobros pendientes: la pregunta sale con botones (concepto + monto).
 *  (d) Sin pendientes: si ya hay un pago aprobado que coincide (monto + fecha,
 *      o la referencia del banco), «Este pago ya estaba registrado ✅».
 *
 * Nunca se adivina: un nombre con dos candidatos no se aplica a ninguno.
 */

import { supabase } from '../config/supabase';
import type { OcrResult } from './ocr.service';
import { normalizeReference } from './receipt-verdict';
import { describirPago, type PagoPendiente } from './whatsapp-receipt-matching.service';
import type { BotonInteractivo } from './whatsapp.service';

/** Las fichas de una familia en `payments` cuando no hay `parent_id`. */
export interface LlavesDeFicha { childIds: string[]; unregisteredIds: string[] }

export const PREGUNTA_DEPORTISTA = 'Recibí tu comprobante 📄 ¿De qué deportista es este pago? Escríbeme su nombre completo.';
export const PASO_PREGUNTA_DEPORTISTA = 'ask_deportista';
export const TEXTO_YA_REGISTRADO = 'Este pago ya estaba registrado ✅';

const tel10 = (s: string | null | undefined) => String(s ?? '').replace(/\D/g, '').slice(-10);
const hayLlaves = (k: LlavesDeFicha | null | undefined): k is LlavesDeFicha =>
    !!k && (k.childIds.length > 0 || k.unregisteredIds.length > 0);

// ─── (a) Fichas por teléfono ────────────────────────────────────────────────

/**
 * Las fichas activas cuyo acudiente tiene este celular. Últimos 10 dígitos y
 * solo celulares, como `wa_identify_by_phone`. Nunca lanza.
 */
export async function fichasPorTelefono(schoolId: string, waPhone: string): Promise<LlavesDeFicha> {
    const vacio = { childIds: [], unregisteredIds: [] };
    const t = tel10(waPhone);
    if (!/^3\d{9}$/.test(t)) return vacio;
    try {
        const [{ data: hijos }, { data: sinReg }] = await Promise.all([
            supabase.from('children').select('id, parent_phone_temp')
                .eq('school_id', schoolId).eq('is_active', true)
                .ilike('parent_phone_temp', `%${t}`).limit(10),
            supabase.from('unregistered_athletes').select('id, guardian_phone, phone')
                .eq('school_id', schoolId).eq('is_active', true).is('linked_profile_id', null)
                .or(`guardian_phone.ilike.%${t},phone.ilike.%${t}`).limit(10),
        ]);
        return {
            childIds: ((hijos ?? []) as any[]).filter((h) => tel10(h.parent_phone_temp) === t).map((h) => h.id),
            unregisteredIds: ((sinReg ?? []) as any[])
                .filter((u) => tel10(u.guardian_phone) === t || tel10(u.phone) === t).map((u) => u.id),
        };
    } catch {
        return vacio;
    }
}

// ─── (b) Deportista por nombre ──────────────────────────────────────────────

export interface FichaConNombre { id: string; nombre: string; tipo: 'child' | 'unregistered' }

const plano = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9ñ]+/g, ' ').trim();

/**
 * Las fichas que el texto nombra. Pura. Cuenta como nombrada la que tiene al
 * menos DOS palabras de su nombre (≥ 3 letras) escritas en el texto —«Sara» o
 * «Pérez» solos son media escuela—, y gana la que más palabras acierta. Puede
 * devolver varias: el llamador solo aplica si hay UNA.
 */
export function candidatosPorNombre(
    textos: (string | null | undefined)[],
    fichas: FichaConNombre[],
): FichaConNombre[] {
    const t = ` ${plano(textos.filter(Boolean).join(' '))} `;
    if (t.trim().length < 3) return [];
    let mejor = 0;
    let out: FichaConNombre[] = [];
    for (const f of fichas) {
        const palabras = [...new Set(plano(f.nombre ?? '').split(' ').filter((w) => w.length >= 3))];
        if (palabras.length < 2) continue;
        const aciertos = palabras.filter((w) => t.includes(` ${w} `)).length;
        if (aciertos < 2) continue;
        if (aciertos > mejor) { mejor = aciertos; out = [f]; } else if (aciertos === mejor) out.push(f);
    }
    return out;
}

/** Deportistas activos de la escuela (con y sin cuenta), con su nombre. Nunca lanza. */
async function fichasDeLaEscuela(schoolId: string): Promise<FichaConNombre[]> {
    try {
        const [{ data: hijos }, { data: sinReg }] = await Promise.all([
            supabase.from('children').select('id, full_name')
                .eq('school_id', schoolId).eq('is_active', true).limit(5000),
            supabase.from('unregistered_athletes').select('id, full_name')
                .eq('school_id', schoolId).eq('is_active', true).is('linked_profile_id', null).limit(5000),
        ]);
        return [
            ...((hijos ?? []) as any[]).filter((h) => h.full_name).map((h) => ({ id: h.id, nombre: h.full_name, tipo: 'child' as const })),
            ...((sinReg ?? []) as any[]).filter((u) => u.full_name).map((u) => ({ id: u.id, nombre: u.full_name, tipo: 'unregistered' as const })),
        ];
    } catch {
        return [];
    }
}

/** La ficha que los textos nombran, si es UNA sola; null si ninguna o varias. */
export async function deportistaPorNombre(
    schoolId: string,
    textos: (string | null | undefined)[],
): Promise<LlavesDeFicha | null> {
    if (!textos.some((t) => t && String(t).trim())) return null;
    const c = candidatosPorNombre(textos, await fichasDeLaEscuela(schoolId));
    if (c.length !== 1) return null;
    return c[0].tipo === 'child'
        ? { childIds: [c[0].id], unregisteredIds: [] }
        : { childIds: [], unregisteredIds: [c[0].id] };
}

// ─── Cobros por llaves ──────────────────────────────────────────────────────

/**
 * Pendientes de la familia por sus llaves (parent_id y/o fichas). Import
 * diferido: la recuperación importa el worker y el worker importa esto.
 */
export async function pendientesPorLlaves(
    schoolId: string,
    k: { parentId?: string | null } & Partial<LlavesDeFicha>,
): Promise<PagoPendiente[]> {
    try {
        const { pendientesDeLaFamilia } = await import('./whatsapp-recuperacion.service');
        return await pendientesDeLaFamilia(schoolId, k);
    } catch {
        return [];
    }
}

// ─── (d) ¿Ya estaba registrado? ─────────────────────────────────────────────

/**
 * El pago YA APROBADO (paid/partial) de la familia que este comprobante ya
 * cubre: la misma referencia de banco, o mismo monto con fecha de registro
 * dentro de la ventana de la recuperación (-3 / +20 días). Nunca lanza.
 */
export async function pagoYaRegistrado(
    schoolId: string,
    k: { parentId?: string | null } & Partial<LlavesDeFicha>,
    ocr: Pick<OcrResult, 'amount' | 'date' | 'reference'>,
    fechaMensaje: string,
): Promise<{ id: string; concept: string | null } | null> {
    try {
        const norm = normalizeReference(ocr.reference);
        if (norm && norm.length >= 6) {
            for (const [col, val] of [['ocr_reference', String(ocr.reference)], ['receipt_reference_norm', norm]] as const) {
                const { data } = await supabase.from('payments').select('id, concept')
                    .eq('school_id', schoolId).in('status', ['paid', 'partial'])
                    .eq(col, val).limit(1);
                if (Array.isArray(data) && data.length) return { id: (data[0] as any).id, concept: (data[0] as any).concept ?? null };
            }
        }
        const r = await import('./whatsapp-recuperacion.service');
        const registrados = (await r.pagosRegistradosDe(schoolId, k)).filter((p) => p.status === 'paid' || p.status === 'partial');
        const cubre = r.pagosQueYaCubren(registrados, ocr.amount ?? null, r.fechaDeReferencia(ocr.date ?? null, fechaMensaje));
        return cubre.length ? { id: cubre[0].id, concept: cubre[0].concept } : null;
    } catch {
        return null;
    }
}

// ─── (c) Botones de la pregunta «¿a cuál cobro?» ────────────────────────────

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const pesos = (n: number) => `$${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n)}`;
const MAX_TITULO = 20;

/** Prefijo del id de cada botón: «sm_cobro_2» = la opción 2. */
export const PREFIJO_BOTON_COBRO = 'sm_cobro_';

/**
 * Un botón por cobro: «1. Sep $150.000» (con el primer nombre si son de
 * varios deportistas: «2. Sara Oct $150.000»). Más de 3 salen como lista
 * (`sendInteractiveButtons`), con el concepto completo en la descripción. Pura.
 */
export function botonesDeCobros(opciones: PagoPendiente[]): BotonInteractivo[] {
    const varios = new Set(opciones.map((p) => p.child_id ?? p.atleta ?? '')).size > 1;
    return opciones.map((p, i) => {
        const m = p.due_date ? Number(String(p.due_date).slice(5, 7)) : NaN;
        const mes = Number.isInteger(m) && m >= 1 && m <= 12 ? MES[m - 1].replace(/^./, (c) => c.toUpperCase()) : '';
        const nombre = varios && p.atleta ? String(p.atleta).trim().split(/\s+/)[0] : '';
        const n = `${i + 1}.`;
        const candidatos = [
            [n, nombre, mes, pesos(p.amount)], [n, nombre, pesos(p.amount)], [n, mes, pesos(p.amount)], [n, pesos(p.amount)],
        ].map((partes) => partes.filter(Boolean).join(' '));
        const title = candidatos.find((c) => c.length <= MAX_TITULO) ?? candidatos[candidatos.length - 1];
        return { id: `${PREFIJO_BOTON_COBRO}${i + 1}`, title, descripcion: describirPago(p).slice(0, 72) };
    });
}

/**
 * Lo que vale como respuesta a la pregunta: el número del botón tocado (el
 * título trae el monto, y «$15.000» no puede leerse como la opción 15). Pura.
 */
export function textoDeEleccion(botonId: string | null | undefined, texto: string): string {
    const m = String(botonId ?? '').match(/^sm_cobro_(\d{1,2})$/);
    return m ? m[1] : texto;
}

// ─── La respuesta a «¿De qué deportista es este pago?» ──────────────────────

/**
 * Resuelve una fila `waiting_user` que preguntó por el deportista: un único
 * candidato → se aplica como familia con ficha; si no → a la escuela. No se
 * repregunta (la pregunta va UNA vez). Devuelve true: consumió el turno.
 */
export async function resolverRespuestaDeDeportista(
    fila: { id: string; school_id: string },
    texto: string,
    responder: (texto: string, paso: string) => Promise<unknown>,
): Promise<boolean> {
    const llaves = await deportistaPorNombre(fila.school_id, [texto]);
    if (!hayLlaves(llaves)) {
        await responder('Gracias 🙏 No encontré a ese deportista, así que le paso tu comprobante a la escuela para que lo aplique.',
            'deportista_a_la_escuela');
        await supabase.from('whatsapp_inbound_queue').update({
            status: 'ignored', result_type: 'escalated', processed_at: new Date().toISOString(),
            error_message: 'sin_familia: el nombre no señala a un único deportista',
        }).eq('id', fila.id).eq('status', 'waiting_user');
        return true;
    }
    const { aplicarComprobanteDeFicha } = await import('../jobs/whatsapp-queue.job');
    await aplicarComprobanteDeFicha(fila.id, llaves, responder);
    return true;
}
