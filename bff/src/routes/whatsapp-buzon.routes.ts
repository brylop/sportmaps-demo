/**
 * whatsapp-buzon.routes — Fase 1 del rediseño del buzón (2026-10-13).
 *
 *   GET  /api/v1/whatsapp/:schoolId/buzon/buscar?q=&offset=&limite=
 *        Búsqueda en servidor sobre TODAS las conversaciones de la escuela:
 *        nombre, teléfono, nombre del deportista y texto de los mensajes.
 *        Reemplaza la búsqueda local, que solo veía las 200 más recientes
 *        (Dynasty ya tenía 305 y la pantalla decía «usa la búsqueda para el
 *        resto», que era falso).
 *
 *   GET  /api/v1/whatsapp/:schoolId/conversaciones/:conversationId/mensajes/:messageId/media
 *        El adjunto de un mensaje (foto, nota de voz, PDF). La URL de Meta es
 *        privada: el BFF la baja con el token de la WABA. Si el comprobante ya
 *        está guardado en Storage (cola de comprobantes), se sirve de ahí.
 *
 *   GET  /api/v1/whatsapp/:schoolId/conversaciones/:conversationId/plantillas
 *   POST /api/v1/whatsapp/:schoolId/conversaciones/:conversationId/plantilla
 *        Enviar una plantilla aprobada desde el hilo (ventana cerrada). Reglas
 *        en whatsapp-plantilla-manual.service.
 *
 * Autorización igual que el resto del canal: `administraEstaEscuela` (dueña o
 * admin real de ESA escuela) y el school_id en el FILTRO de cada consulta, no
 * solo en la verificación: una conversación o un mensaje de otra escuela
 * responde 404 aunque se conozca su id.
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { esContactoSinContenido, leerConMarca } from '../services/whatsapp-tipo-contacto';
import { requireAuth, type AuthenticatedRequest } from '../middlewares/authMiddleware';
import { downloadMedia } from '../services/whatsapp.service';
import { administraEstaEscuela, enriquecerConversaciones, estadoDeVentana, integracionParaEnviar } from './whatsapp-admin.routes';
import { idDelMedio, medioDelMensaje, MAX_BYTES_VISOR, MIMES_VISOR, nombreSeguro } from '../services/whatsapp-medios';
import {
    TEXTO_MOTIVO, consentimientoDe, enviarPlantillaManual, plantillasParaElHilo, tomarCupoPlantilla,
    validarVariables, type MotivoBloqueo,
} from '../services/whatsapp-plantilla-manual.service';
import { tomarConversacion, HORAS_TOMADA_AL_RESPONDER } from '../services/whatsapp-tomada.service';

const router = Router();

// ─── Búsqueda ────────────────────────────────────────────────────────────────

/** Minúsculas y sin tildes. Pura. */
export const normalizar = (s: string | null | undefined) =>
    String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Patrón ILIKE que no distingue tildes: cada vocal (y la n) pasa a `_`, que en
 * LIKE es «cualquier carácter». «maria» → «m_r__» encuentra «María». Los falsos
 * positivos («Marta») se descartan después comparando normalizado. Los
 * comodines que escriba la persona (% _ \) se escapan. Pura.
 */
export function patronSinTildes(q: string): string {
    return `%${escaparLike(normalizar(q)).replace(/[aeioun]/g, '_')}%`;
}

/** Escapa los comodines de LIKE (% _ \) de lo que escribió la persona. Pura. */
export function escaparLike(s: string): string {
    return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

const BuscarSchema = z.object({
    q: z.string().trim().min(2, 'escribe al menos 2 caracteres').max(80),
    offset: z.coerce.number().int().min(0).max(5000).default(0),
    limite: z.coerce.number().int().min(1).max(50).default(25),
});

/** Cuánto se lee como máximo de cada fuente antes de paginar. */
const TOPE_FUENTE = 500;

type Coincidencia = { tipo: 'nombre' | 'telefono' | 'deportista' | 'mensaje'; texto: string | null };
const PRIORIDAD: Record<Coincidencia['tipo'], number> = { nombre: 0, telefono: 1, deportista: 2, mensaje: 3 };

/** Últimos 10 dígitos de un teléfono (el celular colombiano sin el 57). Pura. */
export function ultimos10(tel: string | null | undefined): string | null {
    const d = String(tel ?? '').replace(/\D/g, '');
    return d.length >= 10 ? d.slice(-10) : null;
}

/** Recorte del mensaje alrededor de lo encontrado. Pura. */
export function fragmento(texto: string, q: string, ancho = 60): string {
    const i = normalizar(texto).indexOf(normalizar(q));
    if (i < 0) return texto.slice(0, ancho * 2);
    const desde = Math.max(0, i - ancho);
    const hasta = Math.min(texto.length, i + q.length + ancho);
    return `${desde > 0 ? '…' : ''}${texto.slice(desde, hasta)}${hasta < texto.length ? '…' : ''}`;
}

router.get('/:schoolId/buzon/buscar', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { schoolId } = req.params as { schoolId: string };
    if (!(await administraEstaEscuela(req.user.id, schoolId))) {
        return res.status(403).json({ error: 'forbidden' });
    }
    const parsed = BuscarSchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: 'busqueda_invalida', details: parsed.error.issues });
    const { q, offset, limite } = parsed.data;
    const qn = normalizar(q);
    const digitos = q.replace(/\D/g, '');
    const conLetras = /[a-záéíóúñü]/i.test(q);
    const patron = patronSinTildes(q);

    const { data: integ } = await supabase.from('school_whatsapp_integrations')
        .select('id').eq('school_id', schoolId).maybeSingle();
    if (!integ) return res.json({ q, total: 0, offset, limite, hay_mas: false, conversaciones: [] });

    const vacio = Promise.resolve({ data: [], error: null } as any);
    const [porNombre, porTelefono, porMensaje, porMensajeExacto, hijos, sinCuenta] = await Promise.all([
        conLetras ? supabase.from('whatsapp_conversations').select('id, contact_name')
            .eq('school_id', schoolId).ilike('contact_name', patron).limit(TOPE_FUENTE) : vacio,
        digitos.length >= 3 ? supabase.from('whatsapp_conversations').select('id')
            .eq('school_id', schoolId).ilike('contact_wa_id', `%${digitos}%`).limit(TOPE_FUENTE) : vacio,
        // Texto de los mensajes. Por integración (la de ESTA escuela): el
        // conversation_id de otra escuela nunca aparece.
        supabase.from('whatsapp_messages').select('conversation_id, text_body, created_at')
            .eq('integration_id', (integ as any).id).ilike('text_body', patron)
            .order('created_at', { ascending: false }).limit(TOPE_FUENTE),
        // Y lo escrito tal cual: con frases cortas el patrón sin tildes trae
        // muchos parecidos y el tope podría dejar fuera la coincidencia exacta.
        supabase.from('whatsapp_messages').select('conversation_id, text_body, created_at')
            .eq('integration_id', (integ as any).id).ilike('text_body', `%${escaparLike(q)}%`)
            .order('created_at', { ascending: false }).limit(TOPE_FUENTE),
        conLetras ? supabase.from('children').select('full_name, parent_id, parent_phone_temp')
            .eq('school_id', schoolId).ilike('full_name', patron).limit(50) : vacio,
        conLetras ? supabase.from('unregistered_athletes').select('full_name, guardian_phone')
            .eq('school_id', schoolId).ilike('full_name', patron).limit(50) : vacio,
    ]);
    for (const r of [porNombre, porTelefono, porMensaje, porMensajeExacto]) {
        if ((r as any).error) return res.status(500).json({ error: (r as any).error.message });
    }

    const hallazgos = new Map<string, Coincidencia>();
    const anotar = (id: string, c: Coincidencia) => {
        const previa = hallazgos.get(id);
        if (!previa || PRIORIDAD[c.tipo] < PRIORIDAD[previa.tipo]) hallazgos.set(id, c);
    };
    for (const c of ((porNombre as any).data ?? []) as any[]) {
        if (normalizar(c.contact_name).includes(qn)) anotar(c.id, { tipo: 'nombre', texto: null });
    }
    for (const c of ((porTelefono as any).data ?? []) as any[]) anotar(c.id, { tipo: 'telefono', texto: null });
    for (const m of [...((porMensajeExacto as any).data ?? []), ...((porMensaje as any).data ?? [])] as any[]) {
        if (m.text_body && normalizar(m.text_body).includes(qn)) {
            anotar(m.conversation_id, { tipo: 'mensaje', texto: fragmento(m.text_body, q) });
        }
    }

    // Deportista → acudiente → su conversación (por perfil vinculado o por teléfono).
    const deportistas = [
        ...(((hijos as any).data ?? []) as any[]).filter((h) => normalizar(h.full_name).includes(qn)),
        ...(((sinCuenta as any).data ?? []) as any[]).filter((h) => normalizar(h.full_name).includes(qn))
            .map((h) => ({ full_name: h.full_name, parent_id: null, parent_phone_temp: h.guardian_phone })),
    ];
    if (deportistas.length) {
        const padres = [...new Set(deportistas.map((d) => d.parent_id).filter(Boolean))] as string[];
        const { data: perfiles } = padres.length
            ? await supabase.from('profiles').select('id, phone').in('id', padres)
            : { data: [] as any[] };
        const telefonoDe = new Map<string, string>();
        const nombrePorTel = new Map<string, string>();
        const nombrePorPadre = new Map<string, string>();
        for (const d of deportistas) {
            if (d.parent_id) nombrePorPadre.set(d.parent_id, d.full_name);
            const t = ultimos10(d.parent_phone_temp);
            if (t) nombrePorTel.set(t, d.full_name);
        }
        for (const p of (perfiles ?? []) as any[]) {
            const t = ultimos10(p.phone);
            if (t) { telefonoDe.set(p.id, t); nombrePorTel.set(t, nombrePorPadre.get(p.id) ?? ''); }
        }
        const telefonos = [...nombrePorTel.keys()].slice(0, 40);
        const [porPadre, porTel] = await Promise.all([
            padres.length ? supabase.from('whatsapp_conversations').select('id, parent_id')
                .eq('school_id', schoolId).in('parent_id', padres).limit(TOPE_FUENTE) : vacio,
            // contact_wa_id es 57 + 10 dígitos: se compara por el final.
            telefonos.length ? supabase.from('whatsapp_conversations').select('id, contact_wa_id')
                .eq('school_id', schoolId).in('contact_wa_id', telefonos.map((t) => `57${t}`)).limit(TOPE_FUENTE) : vacio,
        ]);
        for (const c of ((porPadre as any).data ?? []) as any[]) {
            anotar(c.id, { tipo: 'deportista', texto: nombrePorPadre.get(c.parent_id) ?? null });
        }
        for (const c of ((porTel as any).data ?? []) as any[]) {
            anotar(c.id, { tipo: 'deportista', texto: nombrePorTel.get(ultimos10(c.contact_wa_id) ?? '') || null });
        }
    }

    // Las filas de todas las encontradas (para ordenar por actividad) y la página.
    const ids = [...hallazgos.keys()];
    const COLUMNAS = 'id, contact_wa_id, contact_name, identified, status, unread_count, last_message_at, last_inbound_at, parent_id';
    const filas: any[] = [];
    for (let i = 0; i < ids.length; i += 200) {
        const lote = ids.slice(i, i + 200);
        let r: { data: any; error: any } = await supabase.from('whatsapp_conversations')
            .select(`${COLUMNAS}, contact_kind, tambien_familia`).eq('school_id', schoolId).in('id', lote);
        if (r.error) {
            r = await supabase.from('whatsapp_conversations')
                .select(`${COLUMNAS}, contact_kind`).eq('school_id', schoolId).in('id', lote);
        }
        if (r.error) {
            r = await supabase.from('whatsapp_conversations').select(COLUMNAS).eq('school_id', schoolId).in('id', lote);
            if (r.error) return res.status(500).json({ error: r.error.message });
        }
        filas.push(...((r.data ?? []) as any[]));
    }
    filas.sort((a, b) => String(b.last_message_at ?? '').localeCompare(String(a.last_message_at ?? '')));
    const pagina = filas.slice(offset, offset + limite);
    const { filas: enriquecidas } = await enriquecerConversaciones(schoolId,
        pagina.map((c) => ({ contact_kind: null, ...c })));

    return res.json({
        q,
        total: filas.length,
        offset,
        limite,
        hay_mas: offset + limite < filas.length,
        conversaciones: enriquecidas.map((c) => ({ ...c, coincidencia: hallazgos.get(c.id) ?? null })),
    });
});

// ─── Adjuntos ────────────────────────────────────────────────────────────────

const BUCKET_COMPROBANTES = 'payment-receipts';

router.get('/:schoolId/conversaciones/:conversationId/mensajes/:messageId/media', requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
        const { schoolId, conversationId, messageId } = req.params as Record<string, string>;
        if (!(await administraEstaEscuela(req.user.id, schoolId))) {
            return res.status(403).json({ error: 'forbidden' });
        }
        const { data: conv } = await leerConMarca((cols) => supabase.from('whatsapp_conversations')
            .select(cols)
            .eq('id', conversationId).eq('school_id', schoolId).maybeSingle(), 'id, integration_id');
        if (!conv) return res.status(404).json({ error: 'Conversacion no encontrada' });
        // Privacidad (auditoría 2026-10-06): de un contacto marcado como
        // no-familia (personal, negocio…) la escuela no guarda ni muestra
        // contenido. Tampoco se le hace de proxy a Meta.
        if (esContactoSinContenido((conv as any).contact_kind, (conv as any).tambien_familia)) {
            return res.status(403).json({ error: 'contenido_personal' });
        }

        const { data: msg } = await supabase.from('whatsapp_messages')
            .select('id, type, payload, wa_message_id, conversation_id')
            .eq('id', messageId).eq('conversation_id', conversationId).maybeSingle();
        if (!msg) return res.status(404).json({ error: 'Mensaje no encontrado' });
        const medio = medioDelMensaje((msg as any).type, (msg as any).payload);
        const mediaId = idDelMedio((msg as any).type, (msg as any).payload);
        if (!medio || !mediaId) return res.status(404).json({ error: 'sin_adjunto' });

        const enviar = (buf: Buffer, mime: string) => {
            res.setHeader('Content-Type', mime);
            res.setHeader('Content-Length', String(buf.byteLength));
            // Privado: lleva datos de una familia. Una hora en el navegador de quien lo pidió.
            res.setHeader('Cache-Control', 'private, max-age=3600');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            const disposicion = medio.tipo === 'document' ? 'attachment' : 'inline';
            res.setHeader('Content-Disposition', `${disposicion}; filename="${nombreSeguro(medio.nombre, medio.tipo, mime)}"`);
            return res.status(200).end(buf);
        };

        // 1. Copia propia: el comprobante que la cola ya guardó en Storage. Los
        //    archivos de Meta vencen (~30 días); esta copia no.
        const { data: guardado } = await supabase.from('whatsapp_inbound_queue')
            .select('storage_path, media_mime_type')
            .eq('school_id', schoolId).eq('wa_message_id', (msg as any).wa_message_id)
            .not('storage_path', 'is', null).limit(1).maybeSingle();
        if ((guardado as any)?.storage_path) {
            try {
                const { data: blob } = await supabase.storage.from(BUCKET_COMPROBANTES).download((guardado as any).storage_path);
                if (blob) {
                    const buf = Buffer.from(await blob.arrayBuffer());
                    return enviar(buf, (guardado as any).media_mime_type || medio.mime || 'application/octet-stream');
                }
            } catch { /* cae a Meta */ }
        }

        // 2. Meta, con el token de la WABA. No se guarda copia: el plan de
        //    Storage está cerca del tope (memoria 2026-10-04) y estos archivos
        //    son de consulta ocasional.
        const integracion = await integracionParaEnviar(schoolId);
        if (!integracion || integracion.id !== (conv as any).integration_id) {
            return res.status(409).json({ error: 'sin_integracion' });
        }
        const r = await downloadMedia(integracion, mediaId, { mimes: MIMES_VISOR, maxBytes: MAX_BYTES_VISOR });
        if (!r.ok || !r.buffer) {
            const e = String(r.error ?? '');
            if (e.startsWith('mime_no_soportado')) return res.status(415).json({ error: 'tipo_no_soportado', detalle: e });
            if (e.startsWith('archivo_muy_grande')) return res.status(413).json({ error: 'muy_grande' });
            req.log?.warn({ schoolId, messageId, error: e }, '[wa-buzon] no se pudo bajar el adjunto');
            // Meta borra los archivos a los ~30 días: se dice así.
            return res.status(410).json({ error: 'no_disponible', detalle: 'WhatsApp ya no tiene este archivo.' });
        }
        return enviar(r.buffer, r.mimeType || medio.mime || 'application/octet-stream');
    });

// ─── Plantillas desde el hilo ────────────────────────────────────────────────

async function contextoDeEnvio(schoolId: string, conversationId: string) {
    const { data: conv } = await leerConMarca((cols) => supabase.from('whatsapp_conversations')
        .select(cols)
        .eq('id', conversationId).eq('school_id', schoolId).maybeSingle(),
        'id, contact_wa_id, contact_name, integration_id, last_inbound_at');
    if (!conv) return { conv: null } as const;
    const integracion = await integracionParaEnviar(schoolId);
    let motivo: MotivoBloqueo | null = null;
    if (!integracion || !integracion.waba_id || integracion.id !== (conv as any).integration_id) motivo = 'sin_integracion';
    else if (esContactoSinContenido((conv as any).contact_kind, (conv as any).tambien_familia)) motivo = 'contacto_personal';
    else {
        const c = await consentimientoDe(integracion.id, (conv as any).contact_wa_id);
        if (c !== 'ok') motivo = c;
    }
    return { conv: conv as any, integracion, motivo } as const;
}

router.get('/:schoolId/conversaciones/:conversationId/plantillas', requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
        const { schoolId, conversationId } = req.params as Record<string, string>;
        if (!(await administraEstaEscuela(req.user.id, schoolId))) {
            return res.status(403).json({ error: 'forbidden' });
        }
        const ctx = await contextoDeEnvio(schoolId, conversationId);
        if (!ctx.conv) return res.status(404).json({ error: 'Conversacion no encontrada' });
        const { plantillas, error } = ctx.integracion
            ? await plantillasParaElHilo(ctx.integracion.id, ctx.integracion.waba_id ?? null)
            : { plantillas: [], error: null };
        if (error) return res.status(500).json({ error });
        return res.json({
            puede_enviar: ctx.motivo === null,
            motivo: ctx.motivo,
            motivo_texto: ctx.motivo ? TEXTO_MOTIVO[ctx.motivo] : null,
            ...estadoDeVentana(ctx.conv.last_inbound_at),
            plantillas: plantillas.map((p) => ({ ...p, motivo_texto: p.motivo ? TEXTO_MOTIVO[p.motivo] : null })),
        });
    });

const EnvioPlantillaSchema = z.object({
    nombre: z.string().regex(/^[a-z0-9_]{1,512}$/),
    idioma: z.string().min(2).max(10).optional(),
    variables: z.array(z.string().max(1000)).max(20).default([]),
}).strict();

router.post('/:schoolId/conversaciones/:conversationId/plantilla', requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
        const { schoolId, conversationId } = req.params as Record<string, string>;
        const userId = req.user.id;
        if (!(await administraEstaEscuela(userId, schoolId))) {
            return res.status(403).json({ error: 'forbidden' });
        }
        const parsed = EnvioPlantillaSchema.safeParse(req.body ?? {});
        if (!parsed.success) return res.status(400).json({ error: 'datos_invalidos', details: parsed.error.issues });

        const ctx = await contextoDeEnvio(schoolId, conversationId);
        if (!ctx.conv) return res.status(404).json({ error: 'Conversacion no encontrada' });
        if (ctx.motivo || !ctx.integracion) {
            const m = ctx.motivo ?? 'sin_integracion';
            return res.status(409).json({ error: m, detalle: TEXTO_MOTIVO[m] });
        }

        // Se relee y se evalúa en el servidor: lo que diga la pantalla no cuenta.
        const { plantillas } = await plantillasParaElHilo(ctx.integracion.id, ctx.integracion.waba_id ?? null);
        const plantilla = plantillas.find((p) => p.nombre === parsed.data.nombre
            && (!parsed.data.idioma || p.idioma === parsed.data.idioma));
        if (!plantilla) return res.status(404).json({ error: 'plantilla_no_encontrada' });
        if (!plantilla.enviable) {
            return res.status(409).json({ error: plantilla.motivo, detalle: TEXTO_MOTIVO[plantilla.motivo!] });
        }
        const vars = validarVariables(plantilla.variables, parsed.data.variables);
        if (!vars.ok) return res.status(400).json({ error: 'variables_invalidas', detalle: vars.error });

        const freno = tomarCupoPlantilla(userId, conversationId, schoolId);
        if (freno) return res.status(429).json({ error: freno, code: 'RATE_LIMITED' });

        const { data: fila } = await supabase.from('whatsapp_template_status')
            .select('components').eq('integration_id', ctx.integracion.id)
            .eq('name', plantilla.nombre).eq('language', plantilla.idioma).maybeSingle();

        const r = await enviarPlantillaManual({
            integration: ctx.integracion, conversationId, toWaId: ctx.conv.contact_wa_id,
            plantilla, components: (fila as any)?.components ?? [], variables: vars.variables, userId,
        });
        if (!r.ok) {
            req.log?.warn({ schoolId, conversationId, plantilla: plantilla.nombre, error: r.error }, '[wa-buzon] plantilla no enviada');
            return res.status(502).json({ error: 'No se pudo enviar', detalle: r.error });
        }

        // Igual que responder: queda atendida por esta persona y el asistente
        // calla 2 h (sin acortar una toma más larga).
        await supabase.from('whatsapp_conversations')
            .update({ status: 'closed', assigned_to: userId, unread_count: 0, updated_at: new Date().toISOString() })
            .eq('id', conversationId).eq('school_id', schoolId);
        await tomarConversacion(schoolId, conversationId, userId, HORAS_TOMADA_AL_RESPONDER, { soloExtender: true })
            .catch(() => null);

        req.log?.info({ schoolId, conversationId, plantilla: plantilla.nombre, por: userId }, '[wa-buzon] plantilla enviada');
        return res.status(201).json({ ok: true, texto: r.texto });
    });

export default router;
