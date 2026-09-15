/**
 * whatsapp-admin.routes — lo que la ESCUELA ve y configura de su canal.
 *
 *   GET   /api/v1/whatsapp/:schoolId            → integración, ajustes y consumo
 *   PATCH /api/v1/whatsapp/:schoolId/settings   → modo, IA, horario, saludo
 *   GET   /api/v1/whatsapp/:schoolId/bandeja    → comprobantes que quedaron sin resolver
 *   GET   /api/v1/whatsapp/:schoolId/eventos    → avisos de Meta (plantillas, calidad)
 *
 * Sobre la autorización: NO se reusa el `isSchoolAuthorized` que hay en
 * payment-providers.routes y reconciliation.routes. Ese termina en
 *
 *     return profile?.role === 'school_admin' || profile?.role === 'owner';
 *
 * que mira el rol GLOBAL del perfil y no lo compara contra la escuela pedida:
 * quien tuviera ese rol entraría a cualquier escuela. Hoy no otorga acceso a
 * nadie —ningún perfil tiene `school_admin`, y `owner` ni siquiera es un valor
 * válido del enum— pero es una bomba de tiempo. Acá se verifica la membresía
 * REAL en ESA escuela.
 */

import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { requireAuth, type AuthenticatedRequest } from '../middlewares/authMiddleware';
import { decryptToken, sendTextMessage, aFormatoWhatsApp,
         type WhatsAppIntegration } from '../services/whatsapp.service';
import { conectarEscuela } from '../services/whatsapp-onboarding.service';

const router = Router();

/** Mensajes incluidos por mes y por número. Meta regala 1.000 por número. */
const INCLUIDOS_POR_DEFECTO = 1000;
/** A partir de este consumo se avisa que se acerca al tope. */
const UMBRAL_AVISO = 0.8;

/**
 * ¿Este usuario administra ESTA escuela?
 *
 * Se pregunta por la membresía real, no por el rol del perfil. El super admin de
 * plataforma pasa, como en el resto del producto.
 */
/** Primer instante del mes corriente en hora de Bogota, que es como factura Meta. */
function inicioDelMesBogota(): string {
    const ahora = new Date();
    const bogota = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
    return new Date(Date.UTC(bogota.getFullYear(), bogota.getMonth(), 1, 5, 0, 0)).toISOString();
}

async function administraEstaEscuela(userId: string, schoolId: string): Promise<boolean> {
    // Las tres preguntas van EN PARALELO. Encadenadas costaban ~1,6 s, y como
    // este chequeo corre en cada endpoint, la pantalla gastaba unos 6 segundos
    // verificando cuatro veces lo mismo. Cada consulta contra esta Supabase
    // ronda el medio segundo, asi que lo que se paga es el viaje, no el trabajo.
    const [perfil, escuela, miembro] = await Promise.all([
        supabase.from('profiles').select('role').eq('id', userId).maybeSingle(),
        supabase.from('schools').select('owner_id').eq('id', schoolId).maybeSingle(),
        supabase.from('school_members').select('role, status')
            .eq('school_id', schoolId).eq('profile_id', userId).maybeSingle(),
    ]);

    if (perfil.data?.role === 'super_admin' || perfil.data?.role === 'admin') return true;
    if (escuela.data?.owner_id === userId) return true;

    return miembro.data?.status === 'active'
        && ['owner', 'admin', 'school_admin'].includes(String(miembro.data?.role));
}

async function integracionDe(schoolId: string) {
    const { data } = await supabase
        .from('school_whatsapp_integrations')
        .select('id, school_id, phone_number_id, waba_id, display_phone_number, status, created_at')
        .eq('school_id', schoolId)
        .maybeSingle();
    return data;
}

// ── GET / — el estado completo del canal ────────────────────────────────────
router.get('/:schoolId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { schoolId } = req.params as { schoolId: string };
    if (!(await administraEstaEscuela(req.user.id, schoolId))) {
        return res.status(403).json({ error: 'forbidden' });
    }

    const integracion = await integracionDe(schoolId);
    if (!integracion) {
        // La escuela no tiene el canal conectado. No es un error: es el estado
        // normal antes del Embedded Signup.
        return res.json({ conectado: false, integracion: null, ajustes: null, consumo: null });
    }

    // Todo lo que sale de la base, en un solo viaje de ida. La bandeja y los
    // eventos venian en endpoints aparte: eran dos verificaciones de permisos
    // mas y dos round-trips mas, para datos chicos de la misma consulta.
    const [ajustesR, consumoR, bandejaR, eventosR] = await Promise.all([
        supabase.from('whatsapp_settings')
            .select('mode, ai_enabled, assisted_until, business_hours, welcome_message')
            .eq('integration_id', integracion.id).maybeSingle(),
        // OJO: aca NO va `wa_consumo_del_mes`. Ese RPC lleva su propio candado
        // (`is_school_admin`) pensado para que el navegador lo llame directo. El
        // BFF entra con service_role, que no tiene JWT, asi que el candado daba
        // false y la funcion devolvia todo en cero — el medidor se veia vacio con
        // mensajes cobrados de por medio. Se lee la tabla directo, que es lo que
        // la propia migracion prescribe para los llamadores internos; la
        // autorizacion ya la hizo `administraEstaEscuela()` mas arriba.
        supabase.from('whatsapp_messages')
            .select('billable, pricing_category')
            .eq('integration_id', integracion.id)
            .eq('direction', 'outbound')
            .gte('created_at', inicioDelMesBogota()),
        supabase.from('whatsapp_inbound_queue')
            .select('id, status, wa_phone_number, message_type, media_mime_type, storage_path, '
                + 'error_message, result_type, result_ref_id, retries, created_at, processed_at')
            .eq('school_id', schoolId)
            .in('status', ['failed', 'ignored', 'waiting_user'])
            .order('created_at', { ascending: false }).limit(100),
        supabase.from('whatsapp_account_events')
            .select('id, field, template_name, estado_previo, nuevo_estado, motivo, visto_at, created_at')
            .eq('school_id', schoolId)
            .order('created_at', { ascending: false }).limit(50),
    ]);
    const ajustes = ajustesR.data;

    // El desglose se arma aca con la misma forma que devolvia el RPC, para que
    // la pantalla no note la diferencia.
    const salientes = consumoR.data ?? [];
    const porCategoria: Record<string, number> = {};
    for (const m of salientes) {
        if (m.billable !== true) continue;
        const k = m.pricing_category ?? 'sin_categoria';
        porCategoria[k] = (porCategoria[k] ?? 0) + 1;
    }
    const consumo = {
        desde: inicioDelMesBogota(),
        facturables: salientes.filter((m) => m.billable === true).length,
        gratis: salientes.filter((m) => m.billable === false).length,
        // Salientes cuyo `status` de Meta nunca llego. Si esto crece, el webhook
        // de statuses dejo de procesarse y el medidor esta quedando ciego.
        sin_estado: salientes.filter((m) => m.billable === null || m.billable === undefined).length,
        por_categoria: porCategoria,
    };

    const facturables = Number((consumo as any)?.facturables ?? 0);
    const incluidos = INCLUIDOS_POR_DEFECTO;

    return res.json({
        conectado: true,
        integracion,
        // `mode` por defecto 'assisted' si no hay fila: es el default de la tabla,
        // y es importante que la UI lo muestre — una escuela en asistido tiene un
        // bot que responde y nada sale hasta que alguien aprueba.
        ajustes: ajustes ?? { mode: 'assisted', ai_enabled: true, business_hours: null, welcome_message: null },
        consumo: {
            ...(consumo as object ?? {}),
            incluidos,
            restantes: Math.max(incluidos - facturables, 0),
            excedente: Math.max(facturables - incluidos, 0),
            // Se AVISA al 80%, no se corta. Con el costo por mensaje que maneja
            // Meta, frenarle la cobranza a una escuela cuesta mucho más de lo que
            // ahorra; el excedente se factura como paquete.
            avisar: facturables >= incluidos * UMBRAL_AVISO,
        },
        bandeja: bandejaR.data ?? [],
        eventos: eventosR.data ?? [],
    });
});

// ── PATCH /settings — configurar el canal ───────────────────────────────────
const HoraHHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'usa HH:MM');

const AjustesSchema = z.object({
    mode: z.enum(['auto', 'assisted']).optional(),
    ai_enabled: z.boolean().optional(),
    welcome_message: z.string().max(1000).nullable().optional(),
    business_hours: z.object({
        tz: z.string().min(1).default('America/Bogota'),
        // Claves '0'..'6' como Date.getDay(): 0 = domingo.
        dias: z.record(z.string().regex(/^[0-6]$/), z.tuple([HoraHHMM, HoraHHMM])),
    }).nullable().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'nada que cambiar' });

router.patch('/:schoolId/settings', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { schoolId } = req.params as { schoolId: string };
    if (!(await administraEstaEscuela(req.user.id, schoolId))) {
        return res.status(403).json({ error: 'forbidden' });
    }

    const parsed = AjustesSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'datos_invalidos', details: parsed.error.issues });
    }

    // El horario se valida de verdad: una franja que cierra antes de abrir dejaría
    // al bot prometiendo una atención que nunca llega.
    const horario = parsed.data.business_hours;
    if (horario) {
        for (const [dia, [abre, cierra]] of Object.entries(horario.dias)) {
            if (abre >= cierra) {
                return res.status(400).json({
                    error: 'horario_invalido',
                    detalle: `El día ${dia} cierra (${cierra}) antes o al mismo tiempo que abre (${abre}).`,
                });
            }
        }
    }

    const integracion = await integracionDe(schoolId);
    if (!integracion) return res.status(404).json({ error: 'sin_integracion' });

    const { data, error } = await supabase
        .from('whatsapp_settings')
        .upsert({ integration_id: integracion.id, ...parsed.data, updated_at: new Date().toISOString() },
            { onConflict: 'integration_id' })
        .select('mode, ai_enabled, business_hours, welcome_message')
        .single();

    if (error) return res.status(500).json({ error: error.message });

    req.log?.info({ schoolId, cambios: Object.keys(parsed.data) }, '[wa-admin] ajustes actualizados');
    return res.json(data);
});

// ── GET /bandeja — lo que quedó sin resolver ────────────────────────────────
router.get('/:schoolId/bandeja', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { schoolId } = req.params as { schoolId: string };
    if (!(await administraEstaEscuela(req.user.id, schoolId))) {
        return res.status(403).json({ error: 'forbidden' });
    }

    // Solo lo que necesita a un humano. Lo 'done' no se lista: es ruido.
    const { data, error } = await supabase
        .from('whatsapp_inbound_queue')
        .select('id, status, wa_phone_number, message_type, media_mime_type, storage_path, '
            + 'error_message, result_type, result_ref_id, retries, created_at, processed_at')
        .eq('school_id', schoolId)
        .in('status', ['failed', 'ignored', 'waiting_user'])
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ filas: data ?? [] });
});

// ── GET /eventos — lo que avisa Meta ────────────────────────────────────────
router.get('/:schoolId/eventos', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { schoolId } = req.params as { schoolId: string };
    if (!(await administraEstaEscuela(req.user.id, schoolId))) {
        return res.status(403).json({ error: 'forbidden' });
    }

    const { data, error } = await supabase
        .from('whatsapp_account_events')
        .select('id, field, template_name, estado_previo, nuevo_estado, motivo, visto_at, created_at')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ eventos: data ?? [] });
});

// ── Plantillas de Meta ──────────────────────────────────────────────────────
// La escuela necesita verlas por una razon concreta: si Meta desactiva o
// recategoriza una plantilla de cobranza, los envios dejan de salir. Hasta hoy
// eso solo se veia preguntandole a Graph a mano.

const GRAPH = `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION || 'v21.0'}`;

/** Token de la integracion, descifrado. Nunca sale de aca. */
function tokenDe(integracion: { access_token_encrypted: string | null }): string | null {
    if (!integracion.access_token_encrypted) return null;
    try { return decryptToken(integracion.access_token_encrypted); } catch { return null; }
}

router.get('/:schoolId/plantillas', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { schoolId } = req.params as { schoolId: string };
    if (!(await administraEstaEscuela(req.user.id, schoolId))) {
        return res.status(403).json({ error: 'forbidden' });
    }

    const { data: integracion } = await supabase
        .from('school_whatsapp_integrations')
        .select('waba_id, access_token_encrypted')
        .eq('school_id', schoolId)
        .maybeSingle();

    if (!integracion?.waba_id) return res.status(404).json({ error: 'sin_integracion' });
    const token = tokenDe(integracion as any);
    if (!token) return res.status(409).json({ error: 'sin_token' });

    const r = await fetch(
        `${GRAPH}/${integracion.waba_id}/message_templates?fields=name,status,category,language,quality_score&limit=100`,
        { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) },
    );
    const j: any = await r.json();
    if (!r.ok) {
        req.log?.warn({ schoolId, status: r.status }, '[wa-admin] Meta rechazo el listado de plantillas');
        return res.status(502).json({ error: 'meta_error', detalle: j?.error?.message ?? null });
    }

    return res.json({ plantillas: j.data ?? [] });
});

const PlantillaSchema = z.object({
    // Meta exige minusculas, numeros y guion bajo.
    name: z.string().regex(/^[a-z0-9_]{3,60}$/, 'solo minusculas, numeros y guion bajo'),
    language: z.string().min(2).max(10).default('es_CO'),
    category: z.enum(['UTILITY', 'MARKETING', 'AUTHENTICATION']).default('UTILITY'),
    body: z.string().min(10).max(1024),
    // Los ejemplos de cada {{n}}: Meta los EXIGE si el texto trae variables.
    ejemplos: z.array(z.string()).default([]),
});

router.post('/:schoolId/plantillas', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { schoolId } = req.params as { schoolId: string };
    if (!(await administraEstaEscuela(req.user.id, schoolId))) {
        return res.status(403).json({ error: 'forbidden' });
    }

    const parsed = PlantillaSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'datos_invalidos', details: parsed.error.issues });
    }
    const p = parsed.data;

    // Se valida ANTES de llamar a Meta, porque su error para esto es opaco.
    const variables = [...new Set(Array.from(p.body.matchAll(/\{\{(\d+)\}\}/g)).map((m) => Number(m[1])))]
        .sort((a, b) => a - b);
    if (variables.length !== p.ejemplos.length) {
        return res.status(400).json({
            error: 'ejemplos_incompletos',
            detalle: `El texto usa ${variables.length} variable(s) y llegaron ${p.ejemplos.length} ejemplo(s).`,
        });
    }
    if (variables.length && (variables[0] !== 1 || variables[variables.length - 1] !== variables.length)) {
        return res.status(400).json({
            error: 'variables_no_consecutivas',
            detalle: 'Las variables deben ir de {{1}} en adelante, sin saltos.',
        });
    }
    // Meta rechaza que el cuerpo empiece o termine con una variable. Ya nos paso
    // con tres plantillas y el mensaje de error no lo dice claro.
    if (/^\s*\{\{\d+\}\}/.test(p.body) || /\{\{\d+\}\}\s*$/.test(p.body)) {
        return res.status(400).json({
            error: 'variable_en_el_borde',
            detalle: 'El texto no puede empezar ni terminar con una variable. Agrega una palabra antes o despues.',
        });
    }

    const { data: integracion } = await supabase
        .from('school_whatsapp_integrations')
        .select('waba_id, access_token_encrypted')
        .eq('school_id', schoolId)
        .maybeSingle();

    if (!integracion?.waba_id) return res.status(404).json({ error: 'sin_integracion' });
    const token = tokenDe(integracion as any);
    if (!token) return res.status(409).json({ error: 'sin_token' });

    const cuerpo: any = {
        name: p.name,
        language: p.language,
        category: p.category,
        components: [{
            type: 'BODY',
            text: p.body,
            ...(p.ejemplos.length ? { example: { body_text: [p.ejemplos] } } : {}),
        }],
    };

    const r = await fetch(`${GRAPH}/${integracion.waba_id}/message_templates`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(30_000),
    });
    const j: any = await r.json();

    if (!r.ok) {
        return res.status(400).json({
            error: 'meta_rechazo',
            // `error_user_msg` es el texto que Meta escribe para humanos; el
            // `message` tecnico no le sirve a nadie en la pantalla.
            detalle: j?.error?.error_user_msg ?? j?.error?.message ?? 'Meta rechazo la plantilla.',
        });
    }

    req.log?.info({ schoolId, plantilla: p.name, id: j?.id, estado: j?.status }, '[wa-admin] plantilla registrada');
    return res.status(201).json({ id: j?.id, status: j?.status, category: j?.category, name: p.name });
});

// ─── Buzon de conversaciones (F3) ────────────────────────────────────────────
//
// Hasta ahora la escuela no tenia donde LEER ni RESPONDER: la pestania
// "Bandeja" lista comprobantes que fallaron, no chats. El bot atendia, y lo que
// no sabia manejar quedaba marcado como escalado sin que nadie pudiera verlo.
//
// La ventana de 24 horas manda sobre todo lo de aca. Meta solo deja responder
// en texto libre mientras el titular haya escrito en las ultimas 24 h; pasado
// eso hay que mandar una plantilla aprobada. Por eso cada conversacion viaja
// con `ventana_abierta` y `ventana_vence`: si la pantalla mostrara un cuadro de
// texto normal con la ventana cerrada, la escuela escribiria, enviaria, y
// recibiria un error que no sabe leer.

const VENTANA_MS = 24 * 60 * 60 * 1000;

function estadoDeVentana(lastInboundAt: string | null) {
    if (!lastInboundAt) return { ventana_abierta: false, ventana_vence: null };
    const vence = new Date(new Date(lastInboundAt).getTime() + VENTANA_MS);
    return { ventana_abierta: vence.getTime() > Date.now(), ventana_vence: vence.toISOString() };
}

/**
 * La integracion CON el token descifrable, para poder enviar.
 *
 * Distinta de `integracionDe`, que alimenta la pantalla de estado y a
 * proposito no selecciona `access_token_encrypted`: ese dato no tiene por
 * que viajar en una respuesta que solo pinta un encabezado.
 */
async function integracionParaEnviar(schoolId: string): Promise<WhatsAppIntegration | null> {
    const { data } = await supabase
        .from('school_whatsapp_integrations')
        .select('id, school_id, phone_number_id, waba_id, display_phone_number, '
              + 'access_token_encrypted, verify_token, status')
        .eq('school_id', schoolId)
        .maybeSingle();
    return (data as unknown as WhatsAppIntegration) ?? null;
}

/** GET /api/v1/whatsapp/:schoolId/conversaciones */
router.get('/:schoolId/conversaciones', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { schoolId } = req.params as { schoolId: string };
    const userId = req.user.id;
    if (!(await administraEstaEscuela(userId, schoolId))) {
        return res.status(403).json({ error: 'Sin permiso sobre esta escuela' });
    }

    const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select('id, contact_wa_id, contact_name, identified, status, unread_count, '
              + 'last_message_at, last_inbound_at, parent_id')
        .eq('school_id', schoolId)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(200);
    if (error) return res.status(500).json({ error: error.message });

    const ids = (data ?? []).map((c: any) => c.id);

    // El ultimo mensaje de cada hilo. Una sola consulta para las 200
    // conversaciones, no una por cada una.
    const ultimos = new Map<string, any>();
    if (ids.length) {
        const { data: msgs } = await supabase
            .from('whatsapp_messages')
            .select('conversation_id, direction, text_body, type, created_at, ai_generated')
            .in('conversation_id', ids)
            .order('created_at', { ascending: false })
            .limit(1000);
        for (const m of (msgs ?? []) as any[]) {
            if (!ultimos.has(m.conversation_id)) ultimos.set(m.conversation_id, m);
        }
    }

    // Cuantos borradores esperan aprobacion en cada hilo.
    const borradores = new Map<string, number>();
    if (ids.length) {
        const { data: d } = await supabase
            .from('whatsapp_message_drafts')
            .select('conversation_id')
            .in('conversation_id', ids)
            .eq('status', 'pending');
        for (const x of (d ?? []) as any[]) {
            borradores.set(x.conversation_id, (borradores.get(x.conversation_id) ?? 0) + 1);
        }
    }

    return res.json({
        conversaciones: (data ?? []).map((c: any) => ({
            ...c,
            ...estadoDeVentana(c.last_inbound_at),
            ultimo_mensaje: ultimos.get(c.id) ?? null,
            borradores_pendientes: borradores.get(c.id) ?? 0,
        })),
    });
});

/** GET /api/v1/whatsapp/:schoolId/conversaciones/:conversationId */
router.get('/:schoolId/conversaciones/:conversationId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { schoolId, conversationId } = req.params as { schoolId: string; conversationId: string };
    const userId = req.user.id;
    if (!(await administraEstaEscuela(userId, schoolId))) {
        return res.status(403).json({ error: 'Sin permiso sobre esta escuela' });
    }

    // El school_id va en el FILTRO, no solo en la autorizacion. Sin eso, un
    // admin de la escuela A podria leer el hilo de la escuela B pasando su
    // propio schoolId en la ruta y el id de la conversacion ajena.
    const { data: conv } = await supabase
        .from('whatsapp_conversations')
        .select('id, contact_wa_id, contact_name, identified, status, parent_id, last_inbound_at')
        .eq('id', conversationId)
        .eq('school_id', schoolId)
        .maybeSingle();
    if (!conv) return res.status(404).json({ error: 'Conversacion no encontrada' });

    const { data: mensajes } = await supabase
        .from('whatsapp_messages')
        .select('id, direction, type, text_body, status, ai_generated, created_at, error_detail')
        .eq('conversation_id', conversationId)
        .order('created_at');

    const { data: drafts } = await supabase
        .from('whatsapp_message_drafts')
        .select('id, proposed_text, edited_text, status, llm_provider, created_at')
        .eq('conversation_id', conversationId)
        .eq('status', 'pending')
        .order('created_at');

    return res.json({
        conversacion: { ...conv, ...estadoDeVentana((conv as any).last_inbound_at) },
        mensajes: mensajes ?? [],
        borradores: drafts ?? [],
    });
});

const RespuestaSchema = z.object({ texto: z.string().trim().min(1).max(4000) });

/** POST /api/v1/whatsapp/:schoolId/conversaciones/:conversationId/responder */
router.post('/:schoolId/conversaciones/:conversationId/responder', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { schoolId, conversationId } = req.params as { schoolId: string; conversationId: string };
    const userId = req.user.id;
    if (!(await administraEstaEscuela(userId, schoolId))) {
        return res.status(403).json({ error: 'Sin permiso sobre esta escuela' });
    }

    const parsed = RespuestaSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Texto invalido' });

    const { data: conv } = await supabase
        .from('whatsapp_conversations')
        .select('id, contact_wa_id, last_inbound_at')
        .eq('id', conversationId)
        .eq('school_id', schoolId)
        .maybeSingle();
    if (!conv) return res.status(404).json({ error: 'Conversacion no encontrada' });

    // Se corta ACA, no en la pantalla. Una pestania abierta desde ayer, un
    // cliente viejo o una llamada directa a la API se saltarian el aviso
    // visual, y Meta devolveria un error que la escuela no sabe leer.
    const ventana = estadoDeVentana((conv as any).last_inbound_at);
    if (!ventana.ventana_abierta) {
        return res.status(409).json({
            error: 'ventana_cerrada',
            mensaje: 'Pasaron mas de 24 horas desde el ultimo mensaje de esta persona. '
                   + 'WhatsApp solo permite responder con una plantilla aprobada.',
            ...ventana,
        });
    }

    const integracion = await integracionParaEnviar(schoolId);
    if (!integracion) return res.status(409).json({ error: 'La escuela no tiene WhatsApp conectado' });

    // WhatsApp usa UN asterisco para negrita: quien escriba en Markdown desde
    // la pantalla veria los dos asteriscos literales del otro lado.
    const texto = aFormatoWhatsApp(parsed.data.texto);
    const enviado = await sendTextMessage(integracion, (conv as any).contact_wa_id, texto);
    if (!enviado.ok) {
        req.log?.warn({ schoolId, conversationId, error: enviado.error }, '[wa-admin] no se pudo responder');
        return res.status(502).json({ error: 'No se pudo enviar', detalle: enviado.error });
    }

    // Por la MISMA RPC que usa el bot. Insertar directo dejaria el mensaje con
    // otra forma y la escuela veria huecos en el hilo. `ai_generated: false` es
    // lo que distingue lo que escribio una persona.
    await supabase.rpc('wa_record_outbound_message', {
        p_conversation_id: conversationId,
        p_integration_id: integracion.id,
        p_wa_message_id: enviado.waMessageId || `local-${crypto.randomUUID()}`,
        p_type: 'text',
        p_text_body: texto,
        p_payload: { manual: true, por: userId },
        p_ai_generated: false,
        p_to_wa_id: (conv as any).contact_wa_id,
    });

    // Atendida por una persona: deja de estar escalada.
    await supabase.from('whatsapp_conversations')
        .update({ status: 'active', assigned_to: userId, unread_count: 0, updated_at: new Date().toISOString() })
        .eq('id', conversationId);

    return res.status(201).json({ ok: true });
});

const AprobarSchema = z.object({
    // Si la escuela corrigio el borrador, se manda lo corregido. Se guardan los
    // dos: `proposed_text` es lo que dijo el modelo y `edited_text` lo que la
    // persona decidio enviar. Comparar los dos con el tiempo es lo unico que
    // dice si el bot esta mejorando o empeorando.
    texto: z.string().trim().min(1).max(4000).optional(),
});

/** POST /api/v1/whatsapp/:schoolId/borradores/:draftId/aprobar */
router.post('/:schoolId/borradores/:draftId/aprobar', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { schoolId, draftId } = req.params as { schoolId: string; draftId: string };
    const userId = req.user.id;
    if (!(await administraEstaEscuela(userId, schoolId))) {
        return res.status(403).json({ error: 'Sin permiso sobre esta escuela' });
    }

    const parsed = AprobarSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: 'Texto invalido' });

    // El borrador se lee JUNTO con su conversacion y filtrando por escuela: sin
    // eso, un admin podria aprobar el borrador de otra escuela conociendo su id.
    const { data: draft } = await supabase
        .from('whatsapp_message_drafts')
        .select('id, status, proposed_text, conversation_id, '
              + 'conversacion:whatsapp_conversations!inner(id, school_id, contact_wa_id, last_inbound_at)')
        .eq('id', draftId)
        .eq('whatsapp_conversations.school_id', schoolId)
        .maybeSingle();
    if (!draft) return res.status(404).json({ error: 'Borrador no encontrado' });

    // Dos personas mirando la misma bandeja aprueban el mismo borrador: el
    // segundo no debe enviar otra vez.
    if ((draft as any).status !== 'pending') {
        return res.status(409).json({ error: 'Ese borrador ya fue resuelto' });
    }

    const conv = (draft as any).conversacion;
    const ventana = estadoDeVentana(conv.last_inbound_at);
    if (!ventana.ventana_abierta) {
        return res.status(409).json({
            error: 'ventana_cerrada',
            mensaje: 'Pasaron mas de 24 horas desde el ultimo mensaje de esta persona. '
                   + 'WhatsApp solo permite responder con una plantilla aprobada.',
            ...ventana,
        });
    }

    const integracion = await integracionParaEnviar(schoolId);
    if (!integracion) return res.status(409).json({ error: 'La escuela no tiene WhatsApp conectado' });

    const texto = aFormatoWhatsApp(parsed.data.texto ?? (draft as any).proposed_text);
    const enviado = await sendTextMessage(integracion, conv.contact_wa_id, texto);
    if (!enviado.ok) {
        req.log?.warn({ schoolId, draftId, error: enviado.error }, '[wa-admin] no se pudo enviar el borrador');
        return res.status(502).json({ error: 'No se pudo enviar', detalle: enviado.error });
    }

    // Se marca DESPUES de enviar. Al reves, un fallo de red dejaria el borrador
    // como enviado sin que el padre haya recibido nada.
    await supabase.from('whatsapp_message_drafts').update({
        status: 'sent',
        edited_text: parsed.data.texto ?? null,
        approved_by: userId,
        approved_at: new Date().toISOString(),
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }).eq('id', draftId);

    // `ai_generated` en true: lo escribio el modelo aunque lo haya aprobado una
    // persona. Si la escuela lo corrigio, deja de serlo.
    await supabase.rpc('wa_record_outbound_message', {
        p_conversation_id: (draft as any).conversation_id,
        p_integration_id: integracion.id,
        p_wa_message_id: enviado.waMessageId || `local-${crypto.randomUUID()}`,
        p_type: 'text',
        p_text_body: texto,
        p_payload: { draft_id: draftId, aprobado_por: userId, editado: Boolean(parsed.data.texto) },
        p_ai_generated: !parsed.data.texto,
        p_to_wa_id: conv.contact_wa_id,
    });

    await supabase.from('whatsapp_conversations')
        .update({ status: 'active', unread_count: 0, updated_at: new Date().toISOString() })
        .eq('id', (draft as any).conversation_id);

    return res.status(201).json({ ok: true });
});

/** POST /api/v1/whatsapp/:schoolId/borradores/:draftId/descartar */
router.post('/:schoolId/borradores/:draftId/descartar', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { schoolId, draftId } = req.params as { schoolId: string; draftId: string };
    const userId = req.user.id;
    if (!(await administraEstaEscuela(userId, schoolId))) {
        return res.status(403).json({ error: 'Sin permiso sobre esta escuela' });
    }

    const { data: draft } = await supabase
        .from('whatsapp_message_drafts')
        .select('id, status, conversacion:whatsapp_conversations!inner(school_id)')
        .eq('id', draftId)
        .eq('whatsapp_conversations.school_id', schoolId)
        .maybeSingle();
    if (!draft) return res.status(404).json({ error: 'Borrador no encontrado' });
    if ((draft as any).status !== 'pending') {
        return res.status(409).json({ error: 'Ese borrador ya fue resuelto' });
    }

    // No se borra: queda el rastro de que el modelo propuso algo y una persona
    // dijo que no. Es lo que permite medir cuanto se descarta.
    await supabase.from('whatsapp_message_drafts').update({
        status: 'discarded',
        approved_by: userId,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }).eq('id', draftId);

    return res.json({ ok: true });
});

const ConectarSchema = z.object({
    code: z.string().trim().min(10).max(1000),
    sesion: z.object({
        event: z.string().optional(),
        waba_id: z.string().optional(),
        phone_number_id: z.string().optional(),
        business_id: z.string().optional(),
    }).nullable().optional(),
});

/**
 * POST /api/v1/whatsapp/:schoolId/conectar
 *
 * Cierra el alta que empezo el dialogo de Meta en el navegador. El `code` es de
 * un solo uso y vence en minutos: no se reintenta solo, y si falla la escuela
 * tiene que volver a pasar por el dialogo.
 */
router.post('/:schoolId/conectar', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { schoolId } = req.params as { schoolId: string };
    const userId = req.user.id;
    if (!(await administraEstaEscuela(userId, schoolId))) {
        return res.status(403).json({ error: 'Sin permiso sobre esta escuela' });
    }

    const parsed = ConectarSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Datos de conexión inválidos' });

    const r = await conectarEscuela(schoolId, parsed.data.code, parsed.data.sesion ?? null, userId);

    if (!r.ok) {
        // El code NUNCA se registra, ni truncado: es una credencial de un solo
        // uso y los logs se leen en pantalla compartida.
        req.log?.warn({ schoolId, error: r.error }, '[wa-admin] alta fallida');
        const status = r.error === 'ya_conectada' || r.error === 'numero_ocupado' ? 409 : 502;
        return res.status(status).json({ error: r.error, detalle: r.detalle });
    }

    req.log?.info({ schoolId, integrationId: r.integrationId, coexistence: r.coexistence },
                  '[wa-admin] escuela conectada');
    return res.status(201).json({
        ok: true,
        display_phone_number: r.displayPhoneNumber,
        coexistence: r.coexistence,
    });
});

export default router;
