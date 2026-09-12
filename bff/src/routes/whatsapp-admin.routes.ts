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

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { requireAuth, type AuthenticatedRequest } from '../middlewares/authMiddleware';

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
async function administraEstaEscuela(userId: string, schoolId: string): Promise<boolean> {
    const { data: perfil } = await supabase
        .from('profiles').select('role').eq('id', userId).maybeSingle();
    if (perfil?.role === 'super_admin' || perfil?.role === 'admin') return true;

    const { data: escuela } = await supabase
        .from('schools').select('owner_id').eq('id', schoolId).maybeSingle();
    if (escuela?.owner_id === userId) return true;

    const { data: miembro } = await supabase
        .from('school_members')
        .select('role, status')
        .eq('school_id', schoolId)
        .eq('profile_id', userId)
        .maybeSingle();

    return miembro?.status === 'active'
        && ['owner', 'admin', 'school_admin'].includes(String(miembro?.role));
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

    const { data: ajustes } = await supabase
        .from('whatsapp_settings')
        .select('mode, ai_enabled, assisted_until, business_hours, welcome_message')
        .eq('integration_id', integracion.id)
        .maybeSingle();

    const { data: consumo } = await supabase.rpc('wa_consumo_del_mes', {
        p_integration_id: integracion.id,
    });

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

export default router;
