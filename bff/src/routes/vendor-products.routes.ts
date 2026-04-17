import { Router, Request, Response } from 'express';
import { requireMarketplaceAuth, requireRole, auditLog } from '../middlewares/authMiddleware';
import { supabase } from '../config/supabase';

const router = Router();

router.use(requireMarketplaceAuth);
router.use(requireRole('store_owner', 'school', 'admin'));

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/vendor/products — Mis productos con variantes
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
    try {
        const { status, category, page = '1', limit = '50' } = req.query;
        const offset = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);

        let query = supabase
            .from('products')
            .select(`
                *,
                product_variants (id, sku, name, attributes, price_override, stock, image_url, is_active, sort_order)
            `, { count: 'exact' })
            .eq('vendor_id', req.user.id)
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit as string, 10) - 1);

        if (status) query = query.eq('status', status as string);
        if (category) query = query.eq('category', category as string);

        const { data, error, count } = await query;

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error obteniendo productos.' });
        }

        return res.json({ ok: true, data: data || [], total: count || 0 });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/vendor/products — Crear producto
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
    try {
        const {
            name, description, price, stock, category, image_url,
            visibility, sku, attributes, weight_grams, is_digital,
            min_stock_alert, tax_rate, school_id, vendor_profile_id
        } = req.body;

        if (!name || price === undefined) {
            return res.status(400).json({ ok: false, error: 'name y price son requeridos.' });
        }

        const { data, error } = await supabase
            .from('products')
            .insert({
                vendor_id: req.user.id,
                vendor_profile_id: vendor_profile_id || null,
                name,
                description: description || null,
                price,
                stock: stock || 0,
                category: category || null,
                image_url: image_url || null,
                visibility: visibility || 'public',
                status: 'active',
                sku: sku || null,
                attributes: attributes || {},
                weight_grams: weight_grams || null,
                is_digital: is_digital || false,
                min_stock_alert: min_stock_alert || 5,
                tax_rate: tax_rate || 0,
                school_id: school_id || null,
            })
            .select()
            .single();

        if (error) {
            // El trigger de capability validation puede dar 42501
            if (error.code === '42501') {
                return res.status(403).json({ ok: false, error: error.message });
            }
            req.log?.error({ err: error }, 'Error creando producto');
            return res.status(500).json({ ok: false, error: 'Error creando producto.' });
        }

        await auditLog(req, 'product_create', 'products', data.id);
        return res.status(201).json({ ok: true, data });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/vendor/products/:id — Actualizar producto
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // No permitir cambiar vendor_id
        delete updates.vendor_id;
        delete updates.id;
        delete updates.created_at;

        const { data, error } = await supabase
            .from('products')
            .update(updates)
            .eq('id', id)
            .eq('vendor_id', req.user.id)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error actualizando producto.' });
        }

        if (!data) {
            return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
        }

        return res.json({ ok: true, data });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/v1/vendor/products/:id — Archivar producto (soft delete)
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('products')
            .update({ status: 'archived', active: false })
            .eq('id', id)
            .eq('vendor_id', req.user.id)
            .select()
            .single();

        if (error || !data) {
            return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
        }

        await auditLog(req, 'product_archive', 'products', id as string);
        return res.json({ ok: true, message: 'Producto archivado.' });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/vendor/products/:id/variants — Crear variante
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/variants', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { sku, name, attributes, price_override, stock, image_url } = req.body;

        // Verificar ownership del producto
        const { data: product } = await supabase
            .from('products')
            .select('id')
            .eq('id', id)
            .eq('vendor_id', req.user.id)
            .maybeSingle();

        if (!product) {
            return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
        }

        if (!name) {
            return res.status(400).json({ ok: false, error: 'name es requerido para la variante.' });
        }

        const { data, error } = await supabase
            .from('product_variants')
            .insert({
                product_id: id,
                sku: sku || null,
                name,
                attributes: attributes || {},
                price_override: price_override || null,
                stock: stock || 0,
                image_url: image_url || null,
            })
            .select()
            .single();

        if (error) {
            req.log?.error({ err: error }, 'Error creando variante');
            return res.status(500).json({ ok: false, error: 'Error creando variante.' });
        }

        return res.status(201).json({ ok: true, data });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/vendor/products/:id/variants/:variantId — Actualizar variante
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/variants/:variantId', async (req: Request, res: Response) => {
    try {
        const { id, variantId } = req.params;
        const updates = req.body;

        delete updates.id;
        delete updates.product_id;
        delete updates.created_at;

        // Verificar ownership via product
        const { data: product } = await supabase
            .from('products')
            .select('id')
            .eq('id', id)
            .eq('vendor_id', req.user.id)
            .maybeSingle();

        if (!product) {
            return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
        }

        const { data, error } = await supabase
            .from('product_variants')
            .update(updates)
            .eq('id', variantId)
            .eq('product_id', id)
            .select()
            .single();

        if (error || !data) {
            return res.status(404).json({ ok: false, error: 'Variante no encontrada.' });
        }

        return res.json({ ok: true, data });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/v1/vendor/products/:id/variants/:variantId — Eliminar variante
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id/variants/:variantId', async (req: Request, res: Response) => {
    try {
        const { id, variantId } = req.params;

        // Verificar ownership via product
        const { data: product } = await supabase
            .from('products')
            .select('id')
            .eq('id', id)
            .eq('vendor_id', req.user.id)
            .maybeSingle();

        if (!product) {
            return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
        }

        const { error } = await supabase
            .from('product_variants')
            .delete()
            .eq('id', variantId)
            .eq('product_id', id);

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error eliminando variante.' });
        }

        return res.json({ ok: true, message: 'Variante eliminada.' });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

export default router;
