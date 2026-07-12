/**
 * invoicing.routes — facturación electrónica DIAN (multi-PAC).
 *
 * Endpoints:
 *  - GET    /api/v1/invoicing/providers/:ownerType/:ownerId  → lista (sin secretos)
 *  - POST   /api/v1/invoicing/providers/:ownerType/:ownerId  → upsert facturador
 *  - DELETE /api/v1/invoicing/providers/:id
 *  - POST   /api/v1/invoicing/emit/:paymentId                → emite factura del pago
 *  - GET    /api/v1/invoicing/invoices/:ownerType/:ownerId   → lista facturas del dueño
 *  - GET    /api/v1/invoicing/by-payment/:paymentId          → factura de un pago
 *
 * Seguridad:
 *  - credentials del PAC NUNCA se devuelven; solo se reciben.
 *  - escribir facturador / emitir → solo quien administra las finanzas del dueño.
 *  - ver factura de un pago → el dueño (emisor) o el pagador (padre).
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { requireAuth, AuthenticatedRequest } from '../middlewares/authMiddleware';
import { emitInvoiceForPayment } from '../services/invoicing.service';
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

async function isAdminGlobal(userId: string): Promise<boolean> {
    const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
    return data?.role === 'admin';
}

/** ¿El usuario puede gestionar las finanzas del dueño? (espejo de can_manage_finances) */
async function canManageFinances(userId: string, ownerType: OwnerType, ownerId: string): Promise<boolean> {
    if (await isAdminGlobal(userId)) return true;

    if (ownerType === 'school') {
        const { data: school } = await supabase.from('schools').select('owner_id').eq('id', ownerId).maybeSingle();
        if (school?.owner_id === userId) return true;
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
        return profile?.role === 'school_admin' || profile?.role === 'owner';
    }
    if (ownerType === 'vendor') {
        const { data: vp } = await supabase
            .from('vendor_profiles').select('user_id').eq('id', ownerId).maybeSingle();
        return vp?.user_id === userId;
    }
    // organizer
    return ownerId === userId;
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
        .from('payments').select('school_id').eq('id', paymentId).maybeSingle();
    if (!payment) return res.status(404).json({ error: 'payment_not_found' });
    if (!payment.school_id) return res.status(400).json({ error: 'payment_without_school' });
    if (!(await canManageFinances(req.user.id, 'school', payment.school_id))) {
        return res.status(403).json({ error: 'forbidden' });
    }

    const result = await emitInvoiceForPayment(paymentId);
    return res.status(result.ok ? 200 : 422).json(result);
});

// ─── Consulta ────────────────────────────────────────────────────────────────

router.get('/invoices/:ownerType/:ownerId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { ownerType: ownerTypeRaw, ownerId } = req.params as { ownerType: string; ownerId: string };
    const ownerType = parseOwnerType(ownerTypeRaw);
    if (!ownerType) return res.status(400).json({ error: 'invalid_owner_type' });
    if (!(await canManageFinances(req.user.id, ownerType, ownerId))) {
        return res.status(403).json({ error: 'forbidden' });
    }

    const { data, error } = await supabase
        .from('electronic_invoices')
        .select('id, payment_id, provider, document_type, number, cufe, status, public_url, total, taxable_amount, tax_amount, validated_at, created_at')
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
