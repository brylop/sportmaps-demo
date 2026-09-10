/**
 * invoicing.routes — facturación electrónica DIAN (multi-PAC).
 *
 * Endpoints:
 *  - GET    /api/v1/invoicing/providers/:ownerType/:ownerId  → lista (sin secretos)
 *  - POST   /api/v1/invoicing/providers/:ownerType/:ownerId  → upsert facturador
 *  - DELETE /api/v1/invoicing/providers/:id
 *  - POST   /api/v1/invoicing/emit/:paymentId                → emite factura del pago
 *  - POST   /api/v1/invoicing/backfill/:ownerType/:ownerId   → barrido de un rango cerrado
 *  - GET    /api/v1/invoicing/invoices/:ownerType/:ownerId   → lista facturas del dueño
 *  - GET    /api/v1/invoicing/by-payment/:paymentId          → factura de un pago
 *
 * Seguridad:
 *  - credentials del PAC NUNCA se devuelven; solo se reciben.
 *  - escribir facturador / emitir → solo quien administra las finanzas del dueño.
 *  - ver factura de un pago → el dueño (emisor) o el pagador (padre).
 *
 * Este router es el ÚNICO control de acceso real del facturador: el BFF entra
 * con service_role, así que RLS no filtra nada acá. Cada handler correlaciona
 * al usuario con el DUEÑO de la factura antes de tocar la base — un chequeo de
 * rol sin escuela no sirve, ver canManageFinances().
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { requireAuth, AuthenticatedRequest } from '../middlewares/authMiddleware';
import { emitInvoiceForPayment, backfillInvoices } from '../services/invoicing.service';
import { listSupportedProviders } from '../services/invoicing';

const router = Router();

type OwnerType = 'school' | 'vendor' | 'organizer';
const OWNER_TYPES: OwnerType[] = ['school', 'vendor', 'organizer'];

const ProviderUpsertSchema = z.object({
    provider: z.string().min(2),                       // text libre: cualquier PAC soportado
    credentials: z.record(z.string(), z.any()).default({}),   // {client_id, client_secret, username, password, base_url?}
    config: z.record(z.string(), z.any()).default({}),        // {numbering_range_id, default_municipality_id?, ...}
    sandbox: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    enabled: z.boolean().optional(),
});

// ─── Permisos ────────────────────────────────────────────────────────────────

/**
 * Roles de membresía que administran la escuela. Es la MISMA lista que usa
 * user_admin_school_ids() en la base (la función de alcance de administración,
 * no la de staff): lo que otorga permisos no se delega a coaches.
 */
const ADMIN_MEMBER_ROLES: string[] = ['owner', 'admin', 'school_admin', 'super_admin'];

/**
 * ¿Es admin de plataforma? Se pregunta a platform_admins, la misma fuente que
 * is_platform_admin()/is_super_admin() en la base.
 *
 * Antes esto miraba profiles.role === 'admin', y eso estaba mal por los dos
 * lados: ningún usuario tiene ese rol (el único admin real de plataforma es
 * super_admin y quedaba FUERA), y profiles.role lo puede escribir el propio
 * usuario — la policy UPDATE de profiles es USING (auth.uid() = id) y RLS no
 * distingue columnas, así que un rol autoasignado no es una credencial.
 */
async function isPlatformAdmin(userId: string): Promise<boolean> {
    const { data } = await supabase
        .from('platform_admins')
        .select('profile_id')
        .eq('profile_id', userId)
        .eq('is_active', true)
        .limit(1);
    return (data ?? []).length > 0;
}

/** ¿El usuario puede gestionar las finanzas del dueño? (espejo de can_manage_finances) */
async function canManageFinances(userId: string, ownerType: OwnerType, ownerId: string): Promise<boolean> {
    if (await isPlatformAdmin(userId)) return true;

    if (ownerType === 'school') {
        // Correlacionar SIEMPRE con la escuela. La versión anterior caía a
        // `profile?.role === 'school_admin' || 'owner'` IGNORANDO ownerId: con
        // un rol autoasignado se llegaba al facturador de CUALQUIER escuela.
        // (Y 'owner' ni existe en el enum user_role — esa mitad era código
        // muerto.) Los dos caminos de abajo son los mismos que
        // user_admin_school_ids(): membresía administrativa activa, o ser el
        // owner_id de la escuela. Sin el segundo, los 64 dueños que hoy operan
        // el facturador y no tienen fila de membresía se quedaban afuera.
        const { data: school } = await supabase
            .from('schools').select('owner_id').eq('id', ownerId).maybeSingle();
        if (school?.owner_id === userId) return true;

        // limit(1) y no maybeSingle(): school_members no garantiza una sola
        // fila por (escuela, perfil) y un duplicado no debe volverse un 500.
        const { data: members } = await supabase
            .from('school_members')
            .select('role')
            .eq('school_id', ownerId)
            .eq('profile_id', userId)
            .eq('status', 'active')
            .in('role', ADMIN_MEMBER_ROLES)
            .limit(1);
        return (members ?? []).length > 0;
    }
    if (ownerType === 'vendor') {
        const { data: vp } = await supabase
            .from('vendor_profiles').select('user_id').eq('id', ownerId).maybeSingle();
        return vp?.user_id === userId;
    }
    // organizer
    return ownerId === userId;
}

/**
 * ¿El dueño tiene facturador ENCENDIDO? Mismo criterio que el barrido
 * automático (enabled = true) y que resolveInvoiceProvider().
 *
 * Se pregunta antes del barrido para fallar rápido y con motivo, en vez de
 * iterar cientos de pagos que van a rebotar uno por uno con
 * 'no_invoice_provider'. Apagar el facturador es la única palanca que detiene
 * la emisión de una escuela (hoy Dynasty está apagada a propósito), así que
 * esta ruta la respeta explícitamente.
 */
async function hasEnabledProvider(ownerType: OwnerType, ownerId: string): Promise<boolean> {
    const { data } = await supabase
        .from('electronic_invoice_providers')
        .select('id')
        .eq('owner_type', ownerType)
        .eq('owner_id', ownerId)
        .eq('enabled', true)
        .limit(1);
    return (data ?? []).length > 0;
}

function parseOwnerType(v: string): OwnerType | null {
    return OWNER_TYPES.includes(v as OwnerType) ? (v as OwnerType) : null;
}

// ─── Providers ───────────────────────────────────────────────────────────────

router.get('/providers/:ownerType/:ownerId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { ownerType: ownerTypeRaw, ownerId } = req.params as { ownerType: string; ownerId: string };
    const ownerType = parseOwnerType(ownerTypeRaw);
    if (!ownerType) return res.status(400).json({ error: 'invalid_owner_type' });
    if (!(await canManageFinances(req.user.id, ownerType, ownerId))) {
        return res.status(403).json({ error: 'forbidden' });
    }

    const { data, error } = await supabase
        .from('electronic_invoice_providers')
        .select('id, provider, config, sandbox, is_default, enabled, created_at, updated_at')
        .eq('owner_type', ownerType)
        .eq('owner_id', ownerId)
        .order('is_default', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    // config se devuelve (no tiene secretos); credentials NO.
    return res.status(200).json({ providers: data ?? [], supported: listSupportedProviders() });
});

router.post('/providers/:ownerType/:ownerId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { ownerType: ownerTypeRaw, ownerId } = req.params as { ownerType: string; ownerId: string };
    const ownerType = parseOwnerType(ownerTypeRaw);
    if (!ownerType) return res.status(400).json({ error: 'invalid_owner_type' });

    const parsed = ProviderUpsertSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_body', details: parsed.error.issues });
    if (!(await canManageFinances(req.user.id, ownerType, ownerId))) {
        return res.status(403).json({ error: 'forbidden' });
    }

    const p = parsed.data;
    const { data, error } = await supabase
        .from('electronic_invoice_providers')
        .upsert(
            {
                owner_type: ownerType,
                owner_id: ownerId,
                provider: p.provider,
                credentials: p.credentials,
                config: p.config,
                sandbox: p.sandbox ?? true,
                is_default: p.isDefault ?? false,
                enabled: p.enabled ?? true,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'owner_type,owner_id,provider' },
        )
        .select('id, provider, config, sandbox, is_default, enabled')
        .single();
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ provider: data });
});

router.delete('/providers/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params as { id: string };
    const { data: target } = await supabase
        .from('electronic_invoice_providers')
        .select('owner_type, owner_id')
        .eq('id', id)
        .maybeSingle();
    if (!target) return res.status(404).json({ error: 'not_found' });
    if (!(await canManageFinances(req.user.id, target.owner_type as OwnerType, target.owner_id))) {
        return res.status(403).json({ error: 'forbidden' });
    }

    const { error } = await supabase.from('electronic_invoice_providers').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
});

// ─── Emisión ─────────────────────────────────────────────────────────────────

router.post('/emit/:paymentId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { paymentId } = req.params as { paymentId: string };

    // Solo quien administra la escuela del pago puede emitir manualmente.
    const { data: payment } = await supabase
        .from('payments').select('school_id, status').eq('id', paymentId).maybeSingle();
    if (!payment) return res.status(404).json({ error: 'payment_not_found' });
    if (!payment.school_id) return res.status(400).json({ error: 'payment_without_school' });
    if (!(await canManageFinances(req.user.id, 'school', payment.school_id))) {
        return res.status(403).json({ error: 'forbidden' });
    }

    // Una factura electrónica es un documento fiscal: solo se emite por plata
    // que ENTRÓ. Los otros dos orígenes ya lo validan ('tx_not_paid' /
    // 'order_not_paid'); el de pagos era el único sin el chequeo, y por acá
    // pasa el grueso de la cartera pendiente. Un número de la resolución DIAN
    // gastado en un cobro que nunca se cobró no se recupera.
    if (payment.status !== 'paid') {
        return res.status(422).json({ ok: false, error: 'payment_not_paid', status: payment.status });
    }

    const result = await emitInvoiceForPayment(paymentId);
    return res.status(result.ok ? 200 : 422).json(result);
});

// ─── Backfill ────────────────────────────────────────────────────────────────

/**
 * Tope de pagos por llamada. El barrido automático ve solo los últimos 3 días,
 * así que todo lo anterior se factura por acá: el tope tiene que dar para un
 * mes entero de una escuela grande (septiembre 2026 de Dynasty son 147 pagos)
 * sin dejar que una sola llamada barra el histórico completo.
 */
const BACKFILL_MAX_LIMIT = 200;
const BACKFILL_DEFAULT_LIMIT = 50;
/** Ventana máxima: un trimestre. Evita un `from` de 2020 por dedo torpe. */
const BACKFILL_MAX_DAYS = 92;

const BackfillSchema = z.object({
    // Rango OBLIGATORIO y cerrado: sin él, "backfill" es "factura todo lo que
    // encuentres", que es exactamente lo que no queremos poder pedir.
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from debe ser YYYY-MM-DD'),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to debe ser YYYY-MM-DD'),
    limit: z.number().int().positive().max(BACKFILL_MAX_LIMIT).optional(),
});

/**
 * POST /backfill/:ownerType/:ownerId — emite las facturas que el cron no
 * alcanzó, en un rango cerrado de fechas.
 *
 * Seguro de llamar dos veces: la emisión es idempotente por
 * (owner, reference_code) y por payment_id, así que un pago ya facturado
 * vuelve como `skipped`, no como una segunda factura.
 */
router.post('/backfill/:ownerType/:ownerId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { ownerType: ownerTypeRaw, ownerId } = req.params as { ownerType: string; ownerId: string };
    const ownerType = parseOwnerType(ownerTypeRaw);
    if (!ownerType) return res.status(400).json({ error: 'invalid_owner_type' });

    const parsed = BackfillSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_body', details: parsed.error.issues });
    if (!(await canManageFinances(req.user.id, ownerType, ownerId))) {
        return res.status(403).json({ error: 'forbidden' });
    }

    const { from, to } = parsed.data;
    const limit = parsed.data.limit ?? BACKFILL_DEFAULT_LIMIT;

    const desde = new Date(`${from}T00:00:00Z`);
    const hasta = new Date(`${to}T00:00:00Z`);
    if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) {
        return res.status(400).json({ error: 'invalid_date_range' });
    }
    if (desde > hasta) return res.status(400).json({ error: 'from_after_to' });
    const dias = Math.round((hasta.getTime() - desde.getTime()) / 86_400_000) + 1;
    if (dias > BACKFILL_MAX_DAYS) {
        return res.status(400).json({ error: 'date_range_too_wide', maxDays: BACKFILL_MAX_DAYS, days: dias });
    }

    // Facturador apagado = no se emite, ni por acá ni por el cron. Se responde
    // 409 y no se llama al servicio: el barrido no debe ser la puerta trasera
    // que reactive una escuela que alguien apagó a mano.
    if (!(await hasEnabledProvider(ownerType, ownerId))) {
        return res.status(409).json({ error: 'invoicing_disabled', ownerType, ownerId });
    }

    const result = await backfillInvoices({ ownerType, ownerId, from, to, limit });

    // 200 siempre que el barrido haya corrido: los rechazos individuales son
    // parte del resultado esperado y van en el desglose, no en el status HTTP.
    return res.status(200).json({ ok: true, ownerType, ownerId, from, to, limit, ...result });
});

// ─── Consulta ────────────────────────────────────────────────────────────────

router.get('/invoices/:ownerType/:ownerId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { ownerType: ownerTypeRaw, ownerId } = req.params as { ownerType: string; ownerId: string };
    const ownerType = parseOwnerType(ownerTypeRaw);
    if (!ownerType) return res.status(400).json({ error: 'invalid_owner_type' });
    if (!(await canManageFinances(req.user.id, ownerType, ownerId))) {
        return res.status(403).json({ error: 'forbidden' });
    }

    // error_message, cufe y reference_code van en el select a propósito: la
    // tabla los guarda desde siempre, pero al no devolverlos la pantalla del
    // dueño mostraba un rechazo idéntico a una factura en trámite. Así se
    // acumularon rechazos sin que nadie se enterara. reference_code además es
    // la única forma de casar la fila con el documento en el PAC cuando la
    // emisión falló antes de que hubiera número.
    const { data, error } = await supabase
        .from('electronic_invoices')
        .select('id, payment_id, provider, document_type, number, cufe, reference_code, status, error_message, public_url, total, taxable_amount, tax_amount, validated_at, created_at')
        .eq('owner_type', ownerType)
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false })
        .limit(200);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ invoices: data ?? [] });
});

router.get('/by-payment/:paymentId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { paymentId } = req.params as { paymentId: string };

    const { data: invoice, error } = await supabase
        .from('electronic_invoices')
        .select('id, owner_type, owner_id, payment_id, provider, number, cufe, qr_url, qr_image, public_url, status, total, taxable_amount, tax_amount, validated_at, created_at')
        .eq('payment_id', paymentId)
        .order('created_at', { ascending: false })
        .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!invoice) return res.status(404).json({ error: 'not_found' });

    // Autorizado si administra el dueño, o si es el pagador del pago.
    const owns = await canManageFinances(req.user.id, invoice.owner_type as OwnerType, invoice.owner_id);
    let isPayer = false;
    if (!owns) {
        const { data: pay } = await supabase
            .from('payments').select('parent_id').eq('id', paymentId).maybeSingle();
        isPayer = pay?.parent_id === req.user.id;
    }
    if (!owns && !isPayer) return res.status(403).json({ error: 'forbidden' });

    return res.status(200).json({ invoice });
});

export default router;
