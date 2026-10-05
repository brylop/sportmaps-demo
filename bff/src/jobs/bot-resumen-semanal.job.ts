/**
 * bot-resumen-semanal.job — lunes 7:00 a. m. (Colombia), un correo a SportMaps
 * (`SUPPORT_ALERT_EMAIL`) con cómo le fue a los bots la semana anterior
 * (lunes 00:00 a lunes 00:00, hora Colombia):
 *
 *   Por escuela con WhatsApp conectado:
 *     - conversaciones con algún mensaje entrante en la semana
 *     - % de conversaciones de FAMILIAS que el asistente resolvió sin humano
 *       (le contestó el bot, no escaló y nadie de la escuela tuvo que escribir)
 *     - escaladas (paso 'escalated', o prospecto sin enlace de inscripción)
 *     - mediana de minutos hasta la primera respuesta HUMANA
 *     - familias que hoy llevan más de 24 h sin respuesta
 *   Y los tickets de SportBot creados en la semana.
 *
 * Sin esto no hay forma de saber si el bot sirve: el buzón muestra el día a
 * día, no la tendencia. Las cuentas se hacen sobre `wa_timestamp` (no
 * `created_at`): el historial importado por Coexistence entra con created_at
 * = hora de importación y inflaría la semana en que se conectó la escuela.
 *
 * Idempotencia EN LA BASE: reserva en `email_sends` con id determinístico por
 * fecha del lunes. Los tres BFF comparten base y corren este cron.
 * Kill-switch: DISABLE_BOT_RESUMEN_SEMANAL_CORREO=true.
 */

import { supabase } from '../config/supabase';
import {
    calcularPendientes, estaPendiente, esSalienteAutomatico, TIPOS_FAMILIA,
} from '../services/whatsapp-buzon';
import { correosDeSoporte, enviarConReserva, fechaColombia } from '../services/avisos-correo.service';

const DIA_MS = 24 * 3600_000;
const PASO_DESCONOCIDO_ESCOLAR = 'desconocido_tema_escolar';

export interface MensajeSemana {
    conversation_id: string;
    direction: string;
    ai_generated: boolean | null;
    wa_timestamp: string | null;
    created_at?: string | null;
    step?: string | null;
    con_enlace?: unknown;
    automatico?: unknown;
}

export interface MetricasEscuela {
    conversaciones: number;
    familias: number;
    resueltasSinHumano: number;
    /** 0–100, o null si no hubo familias. */
    pctSinHumano: number | null;
    escaladas: number;
    medianaPrimeraRespuestaMin: number | null;
}

export function mediana(xs: number[]): number | null {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const t = (m: { wa_timestamp?: string | null; created_at?: string | null }) =>
    new Date(m.wa_timestamp ?? m.created_at ?? 0).getTime();

const esHumano = (m: MensajeSemana) =>
    m.direction === 'outbound' && m.ai_generated === false && !esSalienteAutomatico(m);

/**
 * Métricas puras de una escuela sobre los mensajes de la semana. `kinds`
 * mapea conversación → contact_kind. Exportada para probarla sin base.
 */
export function calcularMetricasEscuela(mensajes: MensajeSemana[], kinds: Map<string, string | null>): MetricasEscuela {
    const porConv = new Map<string, MensajeSemana[]>();
    for (const m of mensajes) {
        const l = porConv.get(m.conversation_id) ?? [];
        l.push(m);
        porConv.set(m.conversation_id, l);
    }

    let conversaciones = 0, familias = 0, resueltas = 0, escaladas = 0;
    const demoras: number[] = [];

    for (const [conv, lista] of porConv) {
        lista.sort((a, b) => t(a) - t(b));
        const entrantes = lista.filter((m) => m.direction === 'inbound');
        if (!entrantes.length) continue; // solo salientes (avisos de cobro): no es una conversación
        conversaciones++;

        const escalo = lista.some((m) => m.direction === 'outbound' && (m.step === 'escalated'
            || (m.step === PASO_DESCONOCIDO_ESCOLAR && m.con_enlace === false)));
        if (escalo) escaladas++;

        const humanos = lista.filter(esHumano);
        const bot = lista.some((m) => m.direction === 'outbound' && m.ai_generated === true);

        if ((TIPOS_FAMILIA as readonly string[]).includes(kinds.get(conv) ?? '')) {
            familias++;
            if (bot && !escalo && !humanos.length) resueltas++;
        }

        // Primera respuesta humana: desde el primer entrante de la semana
        // hasta el primer humano posterior a él.
        const primero = t(entrantes[0]);
        const respuesta = humanos.find((h) => t(h) > primero);
        if (respuesta) demoras.push((t(respuesta) - primero) / 60_000);
    }

    const med = mediana(demoras);
    return {
        conversaciones,
        familias,
        resueltasSinHumano: resueltas,
        pctSinHumano: familias ? Math.round((resueltas / familias) * 100) : null,
        escaladas,
        medianaPrimeraRespuestaMin: med === null ? null : Math.round(med),
    };
}

/** [lunes anterior 00:00, este lunes 00:00) en hora Colombia (UTC-5 fijo). */
export function rangoSemanaAnterior(ahora = Date.now()): { inicio: number; fin: number; lunes: string } {
    const hoy = fechaColombia(ahora);
    const medianocheHoy = Date.parse(`${hoy}T05:00:00Z`);
    const diaSemana = new Date(`${hoy}T12:00:00Z`).getUTCDay(); // 0=domingo
    const desdeLunes = (diaSemana + 6) % 7;
    const fin = medianocheHoy - desdeLunes * DIA_MS;
    return { inicio: fin - 7 * DIA_MS, fin, lunes: fechaColombia(fin) };
}

async function sinResponderMasDe24h(schoolId: string, ahora: number): Promise<number> {
    const { data: convs } = await supabase.from('whatsapp_conversations')
        .select('id, status, contact_kind, last_inbound_at')
        .eq('school_id', schoolId)
        .in('contact_kind', [...TIPOS_FAMILIA])
        .neq('status', 'closed')
        .lt('last_inbound_at', new Date(ahora - DIA_MS).toISOString())
        .limit(500);
    const lista = (convs ?? []) as any[];
    if (!lista.length) return 0;
    const tiempos = new Map<string, { ultimoEntrante: number; ultimoSaliente: number }>();
    for (const c of lista) tiempos.set(c.id, { ultimoEntrante: new Date(c.last_inbound_at).getTime(), ultimoSaliente: 0 });
    const masViejo = Math.min(...[...tiempos.values()].map((x) => x.ultimoEntrante));
    const { data: salientes } = await supabase.from('whatsapp_messages')
        .select('conversation_id, direction, wa_timestamp, created_at, automatico:payload->automatico')
        .in('conversation_id', [...tiempos.keys()])
        .eq('direction', 'outbound')
        .gte('wa_timestamp', new Date(masViejo).toISOString())
        .limit(2000);
    for (const [id, x] of calcularPendientes((salientes ?? []) as any[])) {
        const e = tiempos.get(id);
        if (e) e.ultimoSaliente = x.ultimoSaliente;
    }
    return lista.filter((c) => estaPendiente(c.status, tiempos.get(c.id))).length;
}

export async function runBotResumenSemanal(ahora = Date.now()): Promise<'enviado' | 'duplicado' | 'fallo' | 'nada' | 'apagado'> {
    if (process.env.DISABLE_BOT_RESUMEN_SEMANAL_CORREO === 'true') return 'apagado';
    try {
        const { inicio, fin, lunes } = rangoSemanaAnterior(ahora);
        const desde = new Date(inicio).toISOString();
        const hasta = new Date(fin).toISOString();

        const { data: integraciones } = await supabase.from('school_whatsapp_integrations')
            .select('id, school_id').eq('status', 'active');
        const integs = (integraciones ?? []) as any[];
        const { data: escuelasRows } = integs.length
            ? await supabase.from('schools').select('id, name').in('id', integs.map((i) => i.school_id))
            : { data: [] as any[] };
        const nombres = new Map(((escuelasRows ?? []) as any[]).map((s) => [s.id, s.name]));

        const escuelas: Array<MetricasEscuela & { nombre: string; sinResponder24h: number }> = [];
        for (const integ of integs) {
            const [{ data: msgs }, { data: convs }] = await Promise.all([
                supabase.from('whatsapp_messages')
                    .select('conversation_id, direction, ai_generated, wa_timestamp, created_at, step:payload->>step, con_enlace:payload->con_enlace, automatico:payload->automatico')
                    .eq('integration_id', integ.id)
                    .gte('wa_timestamp', desde)
                    .lt('wa_timestamp', hasta)
                    .limit(10000),
                supabase.from('whatsapp_conversations').select('id, contact_kind').eq('school_id', integ.school_id).limit(2000),
            ]);
            const kinds = new Map<string, string | null>(((convs ?? []) as any[]).map((c) => [c.id, c.contact_kind ?? null]));
            const m = calcularMetricasEscuela((msgs ?? []) as MensajeSemana[], kinds);
            escuelas.push({
                ...m,
                nombre: nombres.get(integ.school_id) || 'Escuela',
                sinResponder24h: await sinResponderMasDe24h(integ.school_id, ahora),
            });
        }

        const { data: tickets } = await supabase.from('support_tickets')
            .select('status, created_at, first_response_at')
            .gte('created_at', desde)
            .lt('created_at', hasta)
            .limit(5000);
        const tk = (tickets ?? []) as any[];
        const resumenTickets = {
            total: tk.length,
            botHandled: tk.filter((x) => x.status === 'bot_handled').length,
            waitingHuman: tk.filter((x) => x.status === 'waiting_human').length,
            conRespuestaHumana: tk.filter((x) => x.first_response_at).length,
            resueltos: tk.filter((x) => x.status === 'resolved' || x.status === 'closed').length,
            medianaPrimeraRespuestaMin: (() => {
                const d = tk.filter((x) => x.first_response_at)
                    .map((x) => (Date.parse(x.first_response_at) - Date.parse(x.created_at)) / 60_000);
                const med = mediana(d);
                return med === null ? null : Math.round(med);
            })(),
        };

        if (!escuelas.length && !resumenTickets.total) return 'nada';

        const destinos = correosDeSoporte();
        const semana = `${fechaColombia(inicio)} al ${fechaColombia(fin - 1)}`;
        const base = (process.env.FRONTEND_URL || 'https://app.sportmaps.co').replace(/\/$/, '');
        const fmt = (n: number | null, suf = '') => (n === null ? '—' : `${n}${suf}`);

        return await enviarConReserva({
            clave: `bot_resumen_semanal:${lunes}`,
            tipo: 'bot_resumen_semanal',
            schoolId: null,
            refId: null,
            destinos,
            data: {
                semana,
                escuelasJson: JSON.stringify(escuelas),
                ticketsJson: JSON.stringify(resumenTickets),
                adminUrl: `${base}/admin/support`,
            },
            respaldo: {
                subject: `Resumen semanal de los bots (${semana})`,
                titulo: `Resumen semanal de los bots — ${semana}`,
                lineas: [
                    ...escuelas.map((e) => `${e.nombre}: ${e.conversaciones} conversaciones · ${fmt(e.pctSinHumano, '%')} de familias resueltas sin humano · ${e.escaladas} escaladas · mediana a primera respuesta humana ${fmt(e.medianaPrimeraRespuestaMin, ' min')} · ${e.sinResponder24h} sin responder > 24 h`),
                    `SportBot: ${resumenTickets.total} tickets · ${resumenTickets.botHandled} resueltos por el bot · ${resumenTickets.waitingHuman} esperando a una persona · ${resumenTickets.conRespuestaHumana} con respuesta humana`,
                ],
                enlace: { url: `${base}/admin/support`, texto: 'Abrir la bandeja de soporte' },
            },
        });
    } catch (err: any) {
        console.error('[resumen-semanal] falló:', err?.message || String(err));
        return 'fallo';
    }
}
