/**
 * whatsapp-metricas.routes — ¿el bot de WhatsApp sirve? Tablero por escuela.
 *
 *   GET /api/v1/whatsapp/:schoolId/metricas?desde=&hasta=   (default: últimos 30 días)
 *
 * Hasta el 2026-10-04 no había ninguna medición: se sabía cuánto se gastaba en
 * Meta, no si el bot resolvía algo. Las fórmulas viven en
 * services/whatsapp-metricas.ts (puras y probadas); acá solo se traen filas.
 *
 * Por qué no hay RPC: el tablero no justifica una migración (se aplican a mano
 * y hay ~82 sin registro, ver CLAUDE.md). Se piden SOLO las columnas y flechas
 * de payload necesarias, paginado de a 1000 (el tope de PostgREST) y con
 * techo por tabla; si se llega al techo la respuesta lo dice en `avisos`. Para
 * dimensionar: Dynasty generó ~650 mensajes en su primer día y medio por
 * Coexistence, así que 90 días rondarían 30-40 mil y entran en el techo.
 *
 * Autorización: el mismo criterio de whatsapp-admin.routes (membresía REAL en
 * esa escuela, no el rol global del perfil). Allá la función no está
 * exportada y ese archivo lo edita otro frente, así que se replica acá.
 */

import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth, type AuthenticatedRequest } from '../middlewares/authMiddleware';
import { echosAutomaticos, esColumnaInexistente, estaPendiente, ECHO_AUTOMATICO_VENTANA_MS } from '../services/whatsapp-buzon';
import {
    DIA_MS, DIAS_MAXIMO, PASO_PROSPECTO, analizarConversacion, clasificarComprobante, desenlace, esEscalamiento, esFamilia,
    leerRango, momentoDe, motivoCorto, percentil, serieDiaria, tipoDeMensaje, variantesDeTelefono,
    type ClaseComprobante, type Evento, type MensajeCrudo,
} from '../services/whatsapp-metricas';

const router = Router();

const PAGINA = 1000;
const TECHO_MENSAJES = 40_000;
const TECHO_GENERAL = 10_000;
/** Prospectos que se cruzan contra inscripciones: cada uno son 5 variantes de teléfono en un IN. */
const TECHO_PROSPECTOS = 300;
const TIPOS_CONOCIDOS = ['familia', 'familia_sin_cuenta', 'ambiguo', 'staff', 'desconocido', 'personal'] as const;

async function administraEstaEscuela(userId: string, schoolId: string): Promise<boolean> {
    // Copia fiel de whatsapp-admin.routes: las tres preguntas en paralelo.
    const [plataforma, escuela, miembro] = await Promise.all([
        // SEG-26: atajo de plataforma por platform_admins, no profiles.role.
        supabase.from('platform_admins').select('profile_id')
            .eq('profile_id', userId).eq('is_active', true).limit(1),
        supabase.from('schools').select('owner_id').eq('id', schoolId).maybeSingle(),
        supabase.from('school_members').select('role, status')
            .eq('school_id', schoolId).eq('profile_id', userId).maybeSingle(),
    ]);
    if ((plataforma.data ?? []).length > 0) return true;
    if (escuela.data?.owner_id === userId) return true;
    return miembro.data?.status === 'active'
        && ['owner', 'admin', 'school_admin'].includes(String(miembro.data?.role));
}

type Respuesta = { data: unknown; error: { code?: string; message?: string } | null };

/**
 * Trae todas las filas de una consulta, de a 1000, cuatro páginas en paralelo
 * (cada viaje a esta Supabase ronda el medio segundo: en serie, 40 páginas
 * serían 20 s). Requiere que `armar` ordene por una clave estable.
 */
async function paginar<T>(
    armar: (de: number, a: number) => PromiseLike<Respuesta>, techo: number,
): Promise<{ filas: T[]; truncado: boolean; error: Respuesta['error'] }> {
    const filas: T[] = [];
    const EN_PARALELO = 4;
    for (let base = 0; base < techo; base += PAGINA * EN_PARALELO) {
        const paginas = await Promise.all(Array.from({ length: EN_PARALELO }, (_, i) => base + i * PAGINA)
            .filter((de) => de < techo)
            .map((de) => armar(de, Math.min(de + PAGINA, techo) - 1)));
        for (const p of paginas) {
            if (p.error) return { filas, truncado: false, error: p.error };
            const lote = (p.data as T[]) ?? [];
            filas.push(...lote);
            if (lote.length < PAGINA) return { filas, truncado: false, error: null };
        }
    }
    return { filas, truncado: true, error: null };
}

/** `.in()` con listas largas rompe el largo de la URL: se parte en trozos. */
async function enTrozos<T, R>(ids: T[], tam: number, f: (trozo: T[]) => PromiseLike<{ data: unknown }>): Promise<R[]> {
    const out: R[] = [];
    const trozos: T[][] = [];
    for (let i = 0; i < ids.length; i += tam) trozos.push(ids.slice(i, i + tam));
    const res = await Promise.all(trozos.map(f));
    for (const r of res) out.push(...(((r.data as R[]) ?? [])));
    return out;
}

const COLUMNAS_MENSAJE = 'id, conversation_id, direction, ai_generated, wa_timestamp, created_at, '
    + 'step:payload->>step, con_enlace:payload->con_enlace, intencion:payload->>intencion, '
    + 'automatico:payload->automatico, '
    + 'to:payload->to, manual:payload->manual, aprobado_por:payload->aprobado_por';

router.get('/:schoolId/metricas', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { schoolId } = req.params as { schoolId: string };
    if (!(await administraEstaEscuela(req.user.id, schoolId))) {
        return res.status(403).json({ error: 'forbidden' });
    }

    const rango = leerRango(req.query.desde, req.query.hasta);
    if ('error' in rango) {
        return res.status(400).json({ error: rango.error, detalle: `usa YYYY-MM-DD o ISO; máximo ${DIAS_MAXIMO} días` });
    }
    const { desde, hasta } = rango;
    const desdeIso = new Date(desde).toISOString();
    const hastaIso = new Date(hasta).toISOString();
    const ahora = Date.now();
    const avisos: string[] = [];

    const { data: integracion } = await supabase.from('school_whatsapp_integrations')
        .select('id').eq('school_id', schoolId).maybeSingle();
    if (!integracion) return res.json({ conectado: false });
    const integrationId = (integracion as { id: string }).id;

    // ── Todo lo independiente, en un solo viaje de ida ─────────────────────
    const convsConTipo = () => paginar<any>((de, a) => supabase.from('whatsapp_conversations')
        .select('id, contact_kind, status, parent_id, contact_wa_id, last_inbound_at')
        .eq('school_id', schoolId).order('id').range(de, a), TECHO_GENERAL);

    const [convsR, msgsR, echosR, borradoresR, colaR, optinsR] = await Promise.all([
        convsConTipo(),
        paginar<MensajeCrudo>((de, a) => supabase.from('whatsapp_messages')
            .select(COLUMNAS_MENSAJE)
            .eq('integration_id', integrationId)
            .gte('wa_timestamp', desdeIso).lte('wa_timestamp', hastaIso)
            .order('wa_timestamp').order('id').range(de, a), TECHO_MENSAJES),
        // Echos con texto para la regla de saludos automáticos: 7 días ANTES del
        // rango también, porque la ventana de la regla mira hacia atrás.
        paginar<any>((de, a) => supabase.from('whatsapp_messages')
            .select('id, conversation_id, text_body, wa_timestamp, created_at')
            .eq('integration_id', integrationId).eq('direction', 'outbound').eq('ai_generated', false)
            .not('payload->to', 'is', null)
            .gte('wa_timestamp', new Date(desde - ECHO_AUTOMATICO_VENTANA_MS).toISOString())
            .lte('wa_timestamp', hastaIso)
            .order('wa_timestamp').order('id').range(de, a), TECHO_GENERAL),
        paginar<any>((de, a) => supabase.from('whatsapp_message_drafts')
            .select('id, conversation_id, created_at, step:tool_context->>step, '
                  + 'con_enlace:tool_context->con_enlace, intencion:tool_context->>intencion')
            .eq('integration_id', integrationId)
            .gte('created_at', desdeIso).lte('created_at', hastaIso)
            .order('created_at').order('id').range(de, a), TECHO_GENERAL),
        paginar<any>((de, a) => supabase.from('whatsapp_inbound_queue')
            .select('id, status, result_type, result_ref_id, error_message, created_at')
            .eq('school_id', schoolId)
            .gte('created_at', desdeIso).lte('created_at', hastaIso)
            .order('created_at').order('id').range(de, a), TECHO_GENERAL),
        paginar<any>((de, a) => supabase.from('whatsapp_optins')
            .select('id, contact_wa_id, opted_in_at, opted_out_at')
            .eq('school_id', schoolId).order('id').range(de, a), TECHO_GENERAL),
    ]);

    // La columna `contact_kind` llega con una migración que se aplica a mano:
    // sin ella se degrada igual que el buzón (todo "sin clasificar").
    let convs = convsR;
    let clasificacionDisponible = true;
    if (convs.error && esColumnaInexistente(convs.error)) {
        clasificacionDisponible = false;
        convs = await paginar<any>((de, a) => supabase.from('whatsapp_conversations')
            .select('id, status, parent_id, contact_wa_id, last_inbound_at')
            .eq('school_id', schoolId).order('id').range(de, a), TECHO_GENERAL);
    }
    for (const r of [convs, msgsR, echosR, borradoresR, colaR, optinsR]) {
        if (r.error) return res.status(500).json({ error: r.error.message ?? 'error_consulta' });
    }
    if (msgsR.truncado) avisos.push(`Se analizaron los primeros ${TECHO_MENSAJES} mensajes del rango; acorta el rango para verlo completo.`);
    if (convs.truncado || echosR.truncado || borradoresR.truncado || colaR.truncado || optinsR.truncado) {
        avisos.push('Alguna tabla superó el tope de filas y quedó recortada: los números son un piso.');
    }

    const convPorId = new Map<string, any>(convs.filas.map((c) => [c.id, c]));
    const automaticos = echosAutomaticos(echosR.filas);

    // ── Eventos por conversación ───────────────────────────────────────────
    const eventosPorConv = new Map<string, Evento[]>();
    const todosLosEventos: Evento[] = [];
    const agregar = (conv: string, e: Evento) => {
        const l = eventosPorConv.get(conv) ?? [];
        l.push(e);
        eventosPorConv.set(conv, l);
    };
    const prospectoDesde = new Map<string, { t: number; intencion: string | null; conEnlace: unknown }>();
    const marcarProspecto = (conv: string, t: number, intencion: string | null, conEnlace: unknown) => {
        const p = prospectoDesde.get(conv);
        if (!p || t < p.t) prospectoDesde.set(conv, { t, intencion, conEnlace });
    };

    for (const m of msgsR.filas) {
        const e: Evento = { t: momentoDe(m), tipo: tipoDeMensaje(m, automaticos) };
        todosLosEventos.push(e);
        agregar(m.conversation_id, e);
        if (m.direction === 'outbound' && m.step === PASO_PROSPECTO) {
            marcarProspecto(m.conversation_id, e.t, m.intencion ?? null, m.con_enlace);
        }
    }
    // En modo asistido la escalación y la respuesta al prospecto quedan como
    // borrador: igual ocurrieron. Los demás borradores NO cuentan como
    // respuesta del bot (la familia no recibió nada).
    for (const d of borradoresR.filas) {
        const t = new Date(d.created_at).getTime();
        if (esEscalamiento(d.step, d.con_enlace)) agregar(d.conversation_id, { t, tipo: 'escalamiento' });
        if (d.step === PASO_PROSPECTO) marcarProspecto(d.conversation_id, t, d.intencion ?? null, d.con_enlace);
    }

    // ── Conversaciones y familias ──────────────────────────────────────────
    const porTipo: Record<string, number> = Object.fromEntries([...TIPOS_CONOCIDOS, 'sin_clasificar'].map((k) => [k, 0]));
    const familias = { activas: 0, solo_bot: 0, escaladas: 0, atendidas_por_persona: 0, sin_respuesta: 0 };
    const esperas: number[] = [];
    let activas = 0;
    for (const [convId, eventos] of eventosPorConv) {
        const r = analizarConversacion(eventos);
        if (!r.tuvoEntrante) continue;
        activas++;
        const kind = convPorId.get(convId)?.contact_kind ?? null;
        porTipo[kind && kind in porTipo ? kind : 'sin_clasificar']++;
        if (!esFamilia(kind)) continue;
        familias.activas++;
        const d = desenlace(r);
        if (d === 'solo_bot') familias.solo_bot++;
        else if (d === 'escalada') familias.escaladas++;
        else if (d === 'humano') familias.atendidas_por_persona++;
        else if (d === 'sin_respuesta') familias.sin_respuesta++;
        esperas.push(...r.esperas);
    }
    if (porTipo.sin_clasificar > 0) {
        avisos.push(`${porTipo.sin_clasificar} conversaciones del rango no tienen tipo de contacto: no entran en las métricas de familias hasta que se clasifiquen.`);
    }

    // ── Pendientes AHORA (no dependen del rango) ───────────────────────────
    // Misma regla que el buzón (`estaPendiente`): último entrante más nuevo
    // que el último saliente que no sea automático.
    const familiasConv = convs.filas.filter((c) => esFamilia(c.contact_kind));
    const candidatas = familiasConv.filter((c) => c.status !== 'closed' && c.last_inbound_at);
    const pendientes = { ahora: 0, mas_de_24h: 0 };
    if (candidatas.length) {
        const desdeMin = candidatas.reduce((m, c) => Math.min(m, new Date(c.last_inbound_at).getTime()), Infinity);
        const salientes = await enTrozos<string, any>(candidatas.map((c) => c.id), 150, (ids) =>
            supabase.from('whatsapp_messages')
                .select('id, conversation_id, wa_timestamp, created_at, automatico:payload->automatico')
                .in('conversation_id', ids).eq('direction', 'outbound')
                .gte('wa_timestamp', new Date(desdeMin).toISOString())
                .order('wa_timestamp', { ascending: false }).limit(PAGINA));
        const ultimoSaliente = new Map<string, number>();
        for (const s of salientes) {
            if (s.automatico === true || s.automatico === 'true' || automaticos.has(s.id)) continue;
            ultimoSaliente.set(s.conversation_id, Math.max(ultimoSaliente.get(s.conversation_id) ?? 0, momentoDe(s)));
        }
        for (const c of candidatas) {
            const ultimoEntrante = new Date(c.last_inbound_at).getTime();
            if (!estaPendiente(c.status, { ultimoEntrante, ultimoSaliente: ultimoSaliente.get(c.id) ?? 0 })) continue;
            pendientes.ahora++;
            if (ahora - ultimoEntrante > DIA_MS) pendientes.mas_de_24h++;
        }
    }

    // ── Comprobantes ────────────────────────────────────────────────────────
    const idsPago = colaR.filas.filter((f) => f.result_type === 'payment_receipt' && f.result_ref_id)
        .map((f) => f.result_ref_id as string);
    const pagos = new Map<string, any>();
    if (idsPago.length) {
        const filas = await enTrozos<string, any>(idsPago, 150, (ids) =>
            supabase.from('payments').select('id, status, approved_by').in('id', ids));
        for (const p of filas) pagos.set(p.id, p);
    }
    const clases: Record<ClaseComprobante, number> = {
        aprobado_solo: 0, aprobado_por_escuela: 0, esperando_revision: 0, rechazado: 0, escalado: 0,
        fallido: 0, esperando_familia: 0, ignorado: 0, matricula: 0, en_proceso: 0,
    };
    const motivos = new Map<string, number>();
    for (const f of colaR.filas) {
        const c = clasificarComprobante(f, f.result_ref_id ? pagos.get(f.result_ref_id) : null);
        clases[c]++;
        if (c === 'ignorado') motivos.set(motivoCorto(f.error_message), (motivos.get(motivoCorto(f.error_message)) ?? 0) + 1);
    }

    // ── Consentimientos ─────────────────────────────────────────────────────
    const activosOptin = optinsR.filas.filter((o) => o.opted_in_at && !o.opted_out_at).length;
    const familiasConConversacion = familiasConv.length;

    // ── Prospectos y si se inscribieron ─────────────────────────────────────
    const prospectos = await cruzarProspectos(schoolId, prospectoDesde, convPorId);
    if (prospectoDesde.size > TECHO_PROSPECTOS) avisos.push(`Se cruzaron contra inscripciones solo los primeros ${TECHO_PROSPECTOS} prospectos.`);

    const totales = { entrantes: 0, bot: 0, humano: 0, automatico: 0, otro: 0 };
    const serie = serieDiaria(todosLosEventos, desde, hasta);
    for (const p of serie) {
        totales.entrantes += p.entrantes; totales.bot += p.bot; totales.humano += p.humano;
        totales.automatico += p.automatico; totales.otro += p.otro;
    }

    const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);
    const seg = (ms: number | null) => (ms === null ? null : Math.round(ms / 1000));

    return res.json({
        conectado: true,
        rango: { desde: desdeIso, hasta: hastaIso, dias: Math.round((hasta - desde) / DIA_MS) },
        clasificacion_disponible: clasificacionDisponible,
        conversaciones: { activas, por_tipo: porTipo },
        familias: {
            ...familias,
            pct_solo_bot: pct(familias.solo_bot, familias.activas),
            pct_escaladas: pct(familias.escaladas, familias.activas),
            primera_respuesta_humana: {
                muestras: esperas.length,
                mediana_seg: seg(percentil(esperas, 0.5)),
                p90_seg: seg(percentil(esperas, 0.9)),
            },
            pendientes_ahora: pendientes.ahora,
            sin_responder_mas_24h: pendientes.mas_de_24h,
        },
        comprobantes: {
            recibidos: colaR.filas.length - clases.matricula,
            aplicados_solos: clases.aprobado_solo,
            aprobados_por_la_escuela: clases.aprobado_por_escuela,
            esperando_revision: clases.esperando_revision,
            rechazados: clases.rechazado,
            // Lo que necesita a una persona de la escuela.
            para_la_escuela: clases.esperando_revision + clases.escalado + clases.fallido,
            escalados: clases.escalado,
            fallidos: clases.fallido,
            esperando_familia: clases.esperando_familia,
            ignorados: clases.ignorado,
            en_proceso: clases.en_proceso,
            motivos_ignorados: [...motivos].map(([motivo, n]) => ({ motivo, n })).sort((a, b) => b.n - a.n).slice(0, 6),
        },
        consentimientos: {
            activos: activosOptin,
            bajas: optinsR.filas.filter((o) => o.opted_out_at).length,
            nuevos_en_rango: optinsR.filas.filter((o) => o.opted_in_at && !o.opted_out_at
                && new Date(o.opted_in_at).getTime() >= desde && new Date(o.opted_in_at).getTime() <= hasta).length,
            familias_con_conversacion: familiasConConversacion,
            familias_identificadas: familiasConv.filter((c) => c.parent_id).length,
            pct_sobre_familias: pct(activosOptin, familiasConConversacion),
        },
        prospectos,
        totales_mensajes: totales,
        serie,
        avisos,
    });
});

/**
 * Prospecto = conversación a la que el bot le respondió (o dejó borrador) con
 * el paso `desconocido_tema_escolar`. ¿Se inscribió después? Se cruza por
 * teléfono, que es lo único que se tiene de un desconocido:
 *  - `school_signup_leads.phone` de esta escuela, creado después → dejó datos
 *    (formulario del enlace de inscripción).
 *  - `profiles.phone` (o el `parent_id` que la conversación ganó al
 *    identificarse) con una inscripción NUEVA en esta escuela, propia o de un
 *    hijo, creada después del primer contacto → se inscribió.
 * Teléfonos con formato raro (29 perfiles el 2026-10-04) no cruzan: es un piso.
 */
async function cruzarProspectos(
    schoolId: string,
    prospectoDesde: Map<string, { t: number; intencion: string | null; conEnlace: unknown }>,
    convPorId: Map<string, any>,
) {
    const lista = [...prospectoDesde].slice(0, TECHO_PROSPECTOS);
    const base = {
        atendidos: prospectoDesde.size,
        inscripcion: [...prospectoDesde.values()].filter((p) => p.intencion === 'inscripcion').length,
        pagos: [...prospectoDesde.values()].filter((p) => p.intencion === 'pagos').length,
        sin_enlace: [...prospectoDesde.values()].filter((p) => p.conEnlace === false || p.conEnlace === 'false').length,
        dejaron_datos: 0,
        se_inscribieron: 0,
        cruce: 'telefono' as const,
    };
    if (!lista.length) return base;

    const variantesDe = new Map<string, string[]>();
    for (const [convId] of lista) variantesDe.set(convId, variantesDeTelefono(convPorId.get(convId)?.contact_wa_id ?? ''));
    const todas = [...new Set([...variantesDe.values()].flat())];
    const minT = new Date(Math.min(...lista.map(([, p]) => p.t))).toISOString();

    const [perfiles, leads] = await Promise.all([
        enTrozos<string, any>(todas, 200, (tr) => supabase.from('profiles').select('id, phone').in('phone', tr)),
        enTrozos<string, any>(todas, 200, (tr) => supabase.from('school_signup_leads')
            .select('phone, created_at').eq('school_id', schoolId).in('phone', tr).gte('created_at', minT)),
    ]);

    const perfilesDe = new Map<string, Set<string>>();
    for (const [convId, vars] of variantesDe) {
        const s = new Set<string>(perfiles.filter((p) => vars.includes(p.phone)).map((p) => p.id));
        const parentId = convPorId.get(convId)?.parent_id;
        if (parentId) s.add(parentId);
        perfilesDe.set(convId, s);
    }
    const idsPerfil = [...new Set([...perfilesDe.values()].flatMap((s) => [...s]))];

    const hijos = idsPerfil.length
        ? await enTrozos<string, any>(idsPerfil, 150, (tr) => supabase.from('children').select('id, parent_id').in('parent_id', tr))
        : [];
    const idsHijo = hijos.map((h) => h.id);
    const [inscPropias, inscHijos] = await Promise.all([
        idsPerfil.length ? enTrozos<string, any>(idsPerfil, 150, (tr) => supabase.from('enrollments')
            .select('user_id, child_id, created_at').eq('school_id', schoolId).in('user_id', tr).gte('created_at', minT)) : [],
        idsHijo.length ? enTrozos<string, any>(idsHijo, 150, (tr) => supabase.from('enrollments')
            .select('user_id, child_id, created_at').eq('school_id', schoolId).in('child_id', tr).gte('created_at', minT)) : [],
    ]);
    const padreDeHijo = new Map<string, string>(hijos.map((h) => [h.id, h.parent_id]));

    for (const [convId, p] of lista) {
        const vars = variantesDe.get(convId) ?? [];
        if (leads.some((l) => vars.includes(l.phone) && new Date(l.created_at).getTime() >= p.t)) base.dejaron_datos++;
        const mios = perfilesDe.get(convId) ?? new Set<string>();
        const inscrito = [...inscPropias, ...inscHijos].some((e) => new Date(e.created_at).getTime() >= p.t
            && (mios.has(e.user_id) || (e.child_id && mios.has(padreDeHijo.get(e.child_id) ?? ''))));
        if (inscrito) base.se_inscribieron++;
    }
    return base;
}

export default router;
