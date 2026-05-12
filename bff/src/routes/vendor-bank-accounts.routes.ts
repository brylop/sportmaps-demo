/**
 * vendor-bank-accounts.routes — CRUD cuentas bancarias del vendor.
 *
 *  GET    /api/v1/vendor/bank-accounts
 *  POST   /api/v1/vendor/bank-accounts
 *  PATCH  /api/v1/vendor/bank-accounts/:id
 *  DELETE /api/v1/vendor/bank-accounts/:id
 *  POST   /api/v1/vendor/bank-accounts/:id/set-default
 *
 * Solo el dueno del vendor_profile puede gestionar sus cuentas (via RLS).
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireMarketplaceAuth, auditLog } from '../middlewares/authMiddleware';
import { supabase } from '../config/supabase';

const router = Router();
router.use(requireMarketplaceAuth);

const accountSchema = z.object({
    bank_name:       z.string().min(2).max(80),
    account_type:    z.enum(['ahorros','corriente','nequi','daviplata','bancolombia_a_la_mano']),
    account_number:  z.string().min(4).max(40),
    account_holder:  z.string().min(2).max(120),
    document_type:   z.enum(['CC','CE','NIT','PASS','PEP']),
    document_number: z.string().min(4).max(40),
    email:           z.string().email().optional().nullable(),
    phone:           z.string().min(7).max(20).optional().nullable(),
    is_default:      z.boolean().optional(),
});

async function resolveVendorProfileId(userId: string): Promise<string | null> {
    const { data } = await supabase
        .from('vendor_profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
    return (data as any)?.id ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET — listar cuentas del vendor
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
    try {
        const vpId = await resolveVendorProfileId(req.user.id);
        if (!vpId) return res.status(403).json({ ok: false, error: 'No tienes vendor_profile.' });

        const { data, error } = await supabase
            .from('vendor_bank_accounts')
            .select('id, bank_name, account_type, account_number, account_holder, document_type, document_number, email, phone, is_default, is_active, verified_at, created_at')
            .eq('vendor_profile_id', vpId)
            .eq('is_active', true)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error obteniendo cuentas.' });
        }
        return res.json({ ok: true, data: data || [] });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST — crear cuenta. Si es la primera, queda is_default=true.
//        Si is_default=true, las otras pasan a is_default=false.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
    try {
        const vpId = await resolveVendorProfileId(req.user.id);
        if (!vpId) return res.status(403).json({ ok: false, error: 'No tienes vendor_profile.' });

        const parsed = accountSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ ok: false, error: 'Datos invalidos.', issues: parsed.error.format() });
        }

        // Verificar si ya tiene cuentas
        const { count } = await supabase
            .from('vendor_bank_accounts')
            .select('id', { count: 'exact', head: true })
            .eq('vendor_profile_id', vpId)
            .eq('is_active', true);

        const isFirst   = (count ?? 0) === 0;
        const isDefault = parsed.data.is_default ?? isFirst;

        // Si va a ser default, desmarcar las otras
        if (isDefault && !isFirst) {
            await supabase
                .from('vendor_bank_accounts')
                .update({ is_default: false })
                .eq('vendor_profile_id', vpId);
        }

        const { data, error } = await supabase
            .from('vendor_bank_accounts')
            .insert({
                vendor_profile_id: vpId,
                ...parsed.data,
                is_default: isDefault,
            })
            .select()
            .single();

        if (error) {
            req.log?.error({ err: error }, 'Error creando bank account');
            return res.status(500).json({ ok: false, error: 'Error creando cuenta.' });
        }

        await auditLog(req, 'bank_account_create', 'vendor_bank_accounts', data.id);
        return res.status(201).json({ ok: true, data });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH — actualizar cuenta
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id', async (req: Request, res: Response) => {
    try {
        const vpId = await resolveVendorProfileId(req.user.id);
        if (!vpId) return res.status(403).json({ ok: false, error: 'No tienes vendor_profile.' });

        const parsed = accountSchema.partial().safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ ok: false, error: 'Datos invalidos.' });
        }

        // Si pasa is_default=true, desmarcar las demas primero
        if (parsed.data.is_default === true) {
            await supabase
                .from('vendor_bank_accounts')
                .update({ is_default: false })
                .eq('vendor_profile_id', vpId);
        }

        const { data, error } = await supabase
            .from('vendor_bank_accounts')
            .update(parsed.data)
            .eq('id', req.params.id)
            .eq('vendor_profile_id', vpId)
            .select()
            .single();

        if (error || !data) {
            return res.status(404).json({ ok: false, error: 'Cuenta no encontrada.' });
        }
        await auditLog(req, 'bank_account_update', 'vendor_bank_accounts', req.params.id as string);
        return res.json({ ok: true, data });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE — soft delete (is_active=false)
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const vpId = await resolveVendorProfileId(req.user.id);
        if (!vpId) return res.status(403).json({ ok: false, error: 'No tienes vendor_profile.' });

        const { data, error } = await supabase
            .from('vendor_bank_accounts')
            .update({ is_active: false, is_default: false })
            .eq('id', req.params.id as string)
            .eq('vendor_profile_id', vpId)
            .select()
            .single();

        if (error || !data) {
            return res.status(404).json({ ok: false, error: 'Cuenta no encontrada.' });
        }
        await auditLog(req, 'bank_account_delete', 'vendor_bank_accounts', req.params.id as string);
        return res.json({ ok: true });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /:id/set-default — marcar cuenta como default
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/set-default', async (req: Request, res: Response) => {
    try {
        const vpId = await resolveVendorProfileId(req.user.id);
        if (!vpId) return res.status(403).json({ ok: false, error: 'No tienes vendor_profile.' });

        // Desmarcar las demas
        await supabase
            .from('vendor_bank_accounts')
            .update({ is_default: false })
            .eq('vendor_profile_id', vpId);

        const { data, error } = await supabase
            .from('vendor_bank_accounts')
            .update({ is_default: true })
            .eq('id', req.params.id)
            .eq('vendor_profile_id', vpId)
            .eq('is_active', true)
            .select()
            .single();

        if (error || !data) {
            return res.status(404).json({ ok: false, error: 'Cuenta no encontrada.' });
        }
        return res.json({ ok: true, data });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

export default router;
