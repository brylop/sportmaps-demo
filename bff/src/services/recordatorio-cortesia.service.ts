/**
 * recordatorio-cortesia.service — recordatorio de la clase de cortesía por
 * WhatsApp (2026-10-07, aprobado por el usuario).
 *
 * Hasta hoy la reserva (formulario /inscripcion/<slug> o el bot) terminaba en
 * la confirmación y nadie volvía a escribirle al prospecto: si no podía ir, el
 * cupo quedaba tomado y la escuela esperaba a alguien que no llegaba.
 *
 * DOS AVISOS por reserva (`school_signup_leads.trial_slot_id` → `school_trial_slots`):
 *
 *   víspera   18:00 COT del día anterior. Casi siempre la ventana de 24 h de
 *             Meta está CERRADA (el prospecto escribió al reservar, días antes):
 *             va la plantilla UTILITY `recordatorio_clase_cortesia`, que exige
 *             APPROVED en la WABA de la escuela + opt-in del contacto
 *             (`wa_can_send_template`). Con la ventana abierta, texto (más
 *             completo: grupo, qué llevar, botón «Cancelar mi clase»).
 *   mismo_día ~3 h antes (entre 2 h 30 y 3 h 15), cron cada 15 min de 7:00 a
 *             19:45 COT. SOLO texto y SOLO con la ventana abierta; si está
 *             cerrada no se manda nada (no hay segunda plantilla a propósito:
 *             dos plantillas en menos de 24 h a un prospecto es spam).
 *
 * «CANCELAR»: el saliente queda en el buzón con el estado del flujo de cortesía
 * (`paso_cortesia: 'recordatorio'`), y el bot lee la respuesta contra él
 * (whatsapp-clase-cortesia.service, `cancelaTrasRecordatorio`): libera el cupo
 * con `wa_cancelar_clase_de_prueba` y avisa a la escuela, como el botón.
 *
 * IDEMPOTENCIA entre los 3 BFF: tabla `school_trial_reminders` (migración
 * 20261007095845), UNIQUE (lead, cupo, tipo). Se RESERVA con un INSERT antes de
 * enviar: el que lo logra manda; 23505 = otro BFF ya lo tomó. Sin la tabla
 * (migración sin aplicar) el job no manda nada: sin idempotencia, los tres BFF
 * mandarían tres recordatorios.
 *
 * Respeta: bot apagado de la escuela, conversación tomada por una persona,
 * contacto dado de baja (texto) y opt-in (plantilla). Solo celulares
 * colombianos (`aWaId`); un teléfono fijo o mal escrito no recibe nada.
 * Nunca lanza.
 */

import crypto from 'node:crypto';
import { supabase } from '../config/supabase';
import {
    sendTextMessage, sendInteractiveButtons, aFormatoWhatsApp,
    type WhatsAppIntegration, type SendTextResult,
} from './whatsapp.service';
import {
    aWaId, ventanaAbierta, esErrorDeVentana, enviarCobroPorPlantilla, type ResultadoEnvio,
} from './whatsapp-plantillas.service';
import {
    FLUJO_CORTESIA, QUE_LLEVAR, BOTON_CANCELAR_MI_CLASE, bloqueFranja, sedeConDireccion,
    fechaLegible, horaLegible, direccionDeSede, type FranjaCortesia,
} from './whatsapp-clase-cortesia.service';

export type TipoRecordatorio = 'vispera' | 'mismo_dia';

/** Ventana del aviso del mismo día: minutos que faltan para la clase. */
export const MISMO_DIA_DESDE_MIN = 150;
export const MISMO_DIA_HASTA_MIN = 195;
/** Horario razonable para el del mismo día (COT): ni de madrugada ni de noche. */
export const MISMO_DIA_HORA_MIN = 7 * 60;
export const MISMO_DIA_HORA_MAX = 20 * 60;
/** Quien reservó hace menos de esto ya tiene la confirmación fresca: no se le recuerda. */
export const RESERVA_RECIENTE_MIN = 180;

// ─── Puras ───────────────────────────────────────────────────────────────────

/** Fecha (YYYY-MM-DD) y minuto del día en Bogotá (UTC-5 todo el año). */
export function ahoraBogota(ahora: Date): { iso: string; minutos: number } {
    const cot = new Date(ahora.getTime() - 5 * 3600_000);
    return { iso: cot.toISOString().slice(0, 10), minutos: cot.getUTCHours() * 60 + cot.getUTCMinutes() };
}

export function sumarDias(iso: string, n: number): string {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + n, 12)).toISOString().slice(0, 10);
}

export function minutosDeHora(hora: string): number {
    const [hh, mm] = String(hora).split(':').map(Number);
    return hh * 60 + (mm || 0);
}

/** ¿Le toca el aviso del mismo día a una clase que empieza a `horaInicio`? */
export function tocaMismoDia(horaInicio: string, ahoraMin: number): boolean {
    if (ahoraMin < MISMO_DIA_HORA_MIN || ahoraMin >= MISMO_DIA_HORA_MAX) return false;
    const faltan = minutosDeHora(horaInicio) - ahoraMin;
    return faltan >= MISMO_DIA_DESDE_MIN && faltan <= MISMO_DIA_HASTA_MIN;
}

/** «ISABELLA RODRIGUEZ HERNANDEZ» → «Isabella Rodriguez». */
function nombreCorto(nombre: string | null | undefined): string | null {
    const partes = String(nombre ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
    if (!partes.length) return null;
    return partes.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
}

/** A quién se saluda (el acudiente si lo hay) y de quién es la clase. */
export function nombresDelLead(l: { full_name: string | null; guardian_name: string | null }): { saludo: string; atleta: string | null } {
    const atleta = nombreCorto(l.full_name);
    const acudiente = nombreCorto(l.guardian_name);
    const saludo = (acudiente ?? atleta)?.split(' ')[0] ?? 'hola';
    return { saludo, atleta };
}

export function textoRecordatorio(
    tipo: TipoRecordatorio,
    a: { saludo: string; atleta: string | null; esAcudiente: boolean; escuela: string; franja: FranjaCortesia },
): string {
    const cuando = tipo === 'vispera' ? 'mañana' : 'hoy';
    const de = a.esAcudiente && a.atleta ? `la clase de cortesía de *${a.atleta}*` : 'tu clase de cortesía';
    return `Hola ${a.saludo} 👋 Te recuerdo ${de} ${cuando} en *${a.escuela}*:\n\n`
        + `${bloqueFranja(a.franja)}\n\n`
        + `🎒 Qué llevar: ${QUE_LLEVAR}.\n\n`
        + 'Si no puedes ir, responde *CANCELAR* y liberamos el cupo para otra persona.';
}

/** {{5}} de la plantilla: sede con dirección; sin sede, la principal de la escuela. */
export function sedeParaPlantilla(franja: FranjaCortesia, principal: { name: string | null; address: string | null } | null): string {
    const sede = sedeConDireccion(franja);
    if (sede) return sede;
    if (principal?.name) return principal.address ? `${principal.name} (${principal.address})` : principal.name;
    return 'la sede de la escuela';
}

// ─── Datos ───────────────────────────────────────────────────────────────────

export interface ReservaParaRecordar {
    leadId: string;
    schoolId: string;
    nombre: string | null;
    acudiente: string | null;
    telefono: string | null;
    creadaEn: string | null;
    slot: { id: string; label: string | null; slot_date: string; start_time: string; end_time: string | null; location: string | null };
}

export interface ResumenRecordatorios {
    candidatas: number;
    enviados: number;
    noEnviados: number;
    omitidos: number;
    sinTabla?: boolean;
}

type Cierre = { estado: 'enviado' | 'no_enviado'; canal?: 'plantilla' | 'texto' | null; waMessageId?: string | null; motivo?: string | null };

export interface DepsRecordatorio {
    reservasDelDia: (fecha: string) => Promise<ReservaParaRecordar[]>;
    integracion: (schoolId: string) => Promise<WhatsAppIntegration | null>;
    conversacion: (integrationId: string, waId: string) => Promise<{ id: string; last_inbound_at: string | null } | null>;
    escuela: (schoolId: string) => Promise<{ nombre: string; sedes: { name: string | null; address: string | null; is_main?: boolean | null }[] }>;
    /** 'ok' = este BFF lo tomó; 'ya' = otro lo tomó; 'sin_tabla' = migración sin aplicar. */
    reservar: (r: ReservaParaRecordar, tipo: TipoRecordatorio, waId: string) => Promise<{ estado: 'ok'; id: string } | { estado: 'ya' | 'sin_tabla' | 'error'; detalle?: string }>;
    cerrar: (id: string, c: Cierre) => Promise<void>;
    botEncendido: (integrationId: string) => Promise<boolean>;
    tomada: (conversationId: string) => Promise<boolean>;
    dadoDeBaja: (integrationId: string, waId: string) => Promise<boolean>;
    enviarTexto: (integ: WhatsAppIntegration, waId: string, texto: string) => Promise<SendTextResult>;
    registrarTexto: (a: { integ: WhatsAppIntegration; conversationId: string; waId: string; waMessageId: string | null; texto: string; payload: Record<string, unknown> }) => Promise<void>;
    enviarPlantilla: typeof enviarCobroPorPlantilla;
}

const SELECT_LEAD = 'id, school_id, full_name, guardian_name, phone, status, created_at, trial_slot_id, '
    + 'school_trial_slots!inner(id, label, slot_date, start_time, end_time, location)';

const DEPS: DepsRecordatorio = {
    async reservasDelDia(fecha) {
        const { data, error } = await supabase.from('school_signup_leads')
            .select(SELECT_LEAD)
            .not('trial_slot_id', 'is', null)
            .in('status', ['new', 'contacted', 'converted'])
            .eq('school_trial_slots.slot_date', fecha)
            .limit(1000);
        if (error || !Array.isArray(data)) {
            if (error) console.warn('[recordatorio-cortesia] no se pudieron leer las reservas', { err: error.message });
            return [];
        }
        return (data as any[]).flatMap((l) => {
            const s = Array.isArray(l.school_trial_slots) ? l.school_trial_slots[0] : l.school_trial_slots;
            if (!s || String(s.slot_date).slice(0, 10) !== fecha) return [];
            return [{
                leadId: l.id, schoolId: l.school_id, nombre: l.full_name ?? null, acudiente: l.guardian_name ?? null,
                telefono: l.phone ?? null, creadaEn: l.created_at ?? null,
                slot: {
                    id: s.id, label: s.label ?? null, slot_date: String(s.slot_date).slice(0, 10),
                    start_time: String(s.start_time).slice(0, 5), end_time: s.end_time ? String(s.end_time).slice(0, 5) : null,
                    location: s.location ?? null,
                },
            }];
        });
    },
    async integracion(schoolId) {
        const { data } = await supabase.from('school_whatsapp_integrations')
            .select('id, school_id, phone_number_id, waba_id, display_phone_number, access_token_encrypted, verify_token, status')
            .eq('school_id', schoolId).eq('status', 'active');
        const activas = ((data as any[]) ?? []).filter((i) => i.access_token_encrypted && i.phone_number_id);
        // Más de una: no se adivina por cuál número escribir (mismo criterio que la cobranza).
        return activas.length === 1 ? (activas[0] as WhatsAppIntegration) : null;
    },
    async conversacion(integrationId, waId) {
        const { data } = await supabase.from('whatsapp_conversations')
            .select('id, last_inbound_at').eq('integration_id', integrationId).eq('contact_wa_id', waId).maybeSingle();
        return (data as any) ?? null;
    },
    async escuela(schoolId) {
        const [{ data: s }, { data: b }] = await Promise.all([
            supabase.from('schools').select('name').eq('id', schoolId).maybeSingle(),
            supabase.from('school_branches').select('name, address, is_main').eq('school_id', schoolId).limit(50),
        ]);
        return { nombre: (s as any)?.name ?? 'la escuela', sedes: ((b as any[]) ?? []) };
    },
    async reservar(r, tipo, waId) {
        const { data, error } = await supabase.from('school_trial_reminders')
            .insert({ school_id: r.schoolId, lead_id: r.leadId, trial_slot_id: r.slot.id, tipo, contact_wa_id: waId })
            .select('id').maybeSingle();
        if (!error && (data as any)?.id) return { estado: 'ok', id: (data as any).id };
        const code = (error as any)?.code;
        if (code === '23505') return { estado: 'ya' };
        if (code === '42P01' || code === 'PGRST205' || /school_trial_reminders/.test(error?.message ?? '') && /exist|find/i.test(error?.message ?? '')) {
            return { estado: 'sin_tabla' };
        }
        return { estado: 'error', detalle: error?.message };
    },
    async cerrar(id, c) {
        await supabase.from('school_trial_reminders').update({
            estado: c.estado, canal: c.canal ?? null, wa_message_id: c.waMessageId ?? null,
            motivo: c.motivo ? String(c.motivo).slice(0, 300) : null, updated_at: new Date().toISOString(),
        }).eq('id', id);
    },
    async botEncendido(integrationId) {
        const { botEncendido } = await import('./whatsapp-atencion.service');
        return botEncendido(integrationId);
    },
    async tomada(conversationId) {
        const { conversacionTomada } = await import('./whatsapp-tomada.service');
        return conversacionTomada(conversationId);
    },
    async dadoDeBaja(integrationId, waId) {
        const { estaDadoDeBaja } = await import('./whatsapp-optin.service');
        return estaDadoDeBaja(integrationId, waId);
    },
    async enviarTexto(integ, waId, texto) {
        const r = await sendInteractiveButtons(integ, waId, texto, BOTON_CANCELAR_MI_CLASE);
        // Si Meta rechaza los botones por otra cosa que la ventana, el texto
        // plano igual sale: dice «responde CANCELAR».
        return r.ok || esErrorDeVentana(r.error) ? r : sendTextMessage(integ, waId, texto);
    },
    async registrarTexto(a) {
        await supabase.rpc('wa_record_outbound_message', {
            p_conversation_id: a.conversationId,
            p_integration_id: a.integ.id,
            p_wa_message_id: a.waMessageId || `local-${crypto.randomUUID()}`,
            p_type: 'interactive',
            p_text_body: a.texto,
            p_payload: a.payload,
            p_ai_generated: false,
            p_to_wa_id: a.waId,
        });
    },
    enviarPlantilla: enviarCobroPorPlantilla,
};

// ─── Job ─────────────────────────────────────────────────────────────────────

/**
 * `vispera`: reservas de MAÑANA (correr a las 18:00 COT).
 * `mismo_dia`: reservas de HOY que empiezan en 2 h 30 – 3 h 15 (cada 15 min).
 */
export async function runRecordatorioCortesia(
    tipo: TipoRecordatorio,
    opciones: { ahora?: Date; deps?: Partial<DepsRecordatorio>; log?: { info?: Function; warn?: Function } } = {},
): Promise<ResumenRecordatorios> {
    const d: DepsRecordatorio = { ...DEPS, ...(opciones.deps ?? {}) };
    const ahora = opciones.ahora ?? new Date();
    const hoy = ahoraBogota(ahora);
    const resumen: ResumenRecordatorios = { candidatas: 0, enviados: 0, noEnviados: 0, omitidos: 0 };

    if (tipo === 'mismo_dia' && (hoy.minutos < MISMO_DIA_HORA_MIN || hoy.minutos >= MISMO_DIA_HORA_MAX)) return resumen;

    const fecha = tipo === 'vispera' ? sumarDias(hoy.iso, 1) : hoy.iso;
    let reservas = await d.reservasDelDia(fecha);
    if (tipo === 'mismo_dia') reservas = reservas.filter((r) => tocaMismoDia(r.slot.start_time, hoy.minutos));
    resumen.candidatas = reservas.length;

    const integraciones = new Map<string, WhatsAppIntegration | null>();
    const escuelas = new Map<string, Awaited<ReturnType<DepsRecordatorio['escuela']>>>();

    for (const r of reservas) {
        try {
            const waId = aWaId(r.telefono);
            if (!waId) { resumen.omitidos++; continue; }
            // Recién reservada: la confirmación todavía está fresca.
            if (r.creadaEn && ahora.getTime() - new Date(r.creadaEn).getTime() < RESERVA_RECIENTE_MIN * 60_000) {
                resumen.omitidos++; continue;
            }
            if (!integraciones.has(r.schoolId)) integraciones.set(r.schoolId, await d.integracion(r.schoolId));
            const integ = integraciones.get(r.schoolId);
            if (!integ) { resumen.omitidos++; continue; }

            const conv = await d.conversacion(integ.id, waId);
            const abierta = ventanaAbierta(conv?.last_inbound_at ?? null, ahora.getTime());
            // El del mismo día solo existe como texto: con la ventana cerrada no
            // se reserva, así un tick posterior lo manda si el prospecto escribe.
            if (tipo === 'mismo_dia' && (!abierta || !conv)) { resumen.omitidos++; continue; }

            const toma = await d.reservar(r, tipo, waId);
            if (toma.estado === 'sin_tabla') {
                opciones.log?.warn?.('[recordatorio-cortesia] falta la tabla school_trial_reminders (migración 20261007095845): no se manda nada');
                return { ...resumen, sinTabla: true };
            }
            if (toma.estado !== 'ok') { resumen.omitidos++; continue; }

            const cierre = await enviarUno(d, tipo, r, integ, waId, conv, abierta, escuelas);
            await d.cerrar(toma.id, cierre).catch(() => undefined);
            if (cierre.estado === 'enviado') resumen.enviados++; else resumen.noEnviados++;
        } catch (e: any) {
            resumen.noEnviados++;
            opciones.log?.warn?.({ leadId: r.leadId, err: e?.message }, '[recordatorio-cortesia] falló una reserva');
        }
    }
    return resumen;
}

async function enviarUno(
    d: DepsRecordatorio, tipo: TipoRecordatorio, r: ReservaParaRecordar, integ: WhatsAppIntegration, waId: string,
    conv: { id: string; last_inbound_at: string | null } | null, abierta: boolean,
    escuelas: Map<string, Awaited<ReturnType<DepsRecordatorio['escuela']>>>,
): Promise<Cierre> {
    if (!(await d.botEncendido(integ.id))) return { estado: 'no_enviado', motivo: 'bot_apagado' };
    if (conv && await d.tomada(conv.id)) return { estado: 'no_enviado', motivo: 'conversacion_tomada' };

    if (!escuelas.has(r.schoolId)) escuelas.set(r.schoolId, await d.escuela(r.schoolId));
    const esc = escuelas.get(r.schoolId)!;
    const franja: FranjaCortesia = {
        id: r.slot.id, grupo: r.slot.label ?? 'Clase de cortesía', fecha: r.slot.slot_date,
        horaInicio: r.slot.start_time, horaFin: r.slot.end_time, sede: r.slot.location, cupos: 0,
        direccion: direccionDeSede(r.slot.location, esc.sedes),
    };
    const { saludo, atleta } = nombresDelLead({ full_name: r.nombre, guardian_name: r.acudiente });
    // Estado del flujo en el saliente: la respuesta «CANCELAR» se lee contra él.
    const estadoFlujo = {
        step: `recordatorio_cortesia_${tipo}`, flujo: FLUJO_CORTESIA, paso_cortesia: 'recordatorio',
        datos_cortesia: { franja, nombre: r.nombre }, lead_id: r.leadId,
    };

    if (abierta && conv) {
        if (await d.dadoDeBaja(integ.id, waId)) return { estado: 'no_enviado', motivo: 'dado_de_baja' };
        const texto = aFormatoWhatsApp(textoRecordatorio(tipo, {
            saludo, atleta, esAcudiente: !!r.acudiente, escuela: esc.nombre, franja,
        }));
        const env = await d.enviarTexto(integ, waId, texto);
        if (env.ok) {
            await d.registrarTexto({ integ, conversationId: conv.id, waId, waMessageId: env.waMessageId ?? null, texto, payload: estadoFlujo })
                .catch(() => undefined);
            return { estado: 'enviado', canal: 'texto', waMessageId: env.waMessageId ?? null };
        }
        // La ventana cerró justo (borde de las 24 h): la víspera cae a la plantilla.
        if (!(tipo === 'vispera' && esErrorDeVentana(env.error))) {
            return { estado: 'no_enviado', canal: 'texto', motivo: env.error ?? 'envio_fallido' };
        }
    }

    if (tipo !== 'vispera') return { estado: 'no_enviado', motivo: 'ventana_cerrada' };

    const principal = esc.sedes.find((s) => s.is_main) ?? esc.sedes[0] ?? null;
    const env: ResultadoEnvio = await d.enviarPlantilla({
        schoolId: r.schoolId,
        concepto: 'recordatorio_clase_cortesia',
        telefono: waId,
        tokenBoton: null,
        datos: {
            nombreContacto: saludo, nombreAtleta: atleta ?? '', nombreEscuela: esc.nombre, monto: '',
            dia: fechaLegible(franja.fecha), hora: horaLegible(franja.horaInicio),
            sede: sedeParaPlantilla(franja, principal),
        },
        payloadExtra: estadoFlujo,
    });
    if (env.enviado) return { estado: 'enviado', canal: 'plantilla', waMessageId: env.waMessageId };
    return { estado: 'no_enviado', canal: 'plantilla', motivo: `${env.motivo}${env.detalle ? ` (${env.detalle})` : ''}` };
}
