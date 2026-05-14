import { Router, Request, Response } from 'express';
import { requireMarketplaceAuth, requireVendorProfile, auditLog } from '../middlewares/authMiddleware';
import { supabase } from '../config/supabase';

const router = Router();

router.use(requireMarketplaceAuth);
// Autoriza por capability de vendor_profile, no por role.
// Coach/school/parent/athlete pueden vender si activaron Mi Tienda con can_sell_products.
router.use(requireVendorProfile('can_sell_products'));

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
        // Resolver vendor_profile del caller server-side. Asi un vendor no
        // puede pasar vendor_profile_id arbitrario en el body y asociar
        // productos al perfil de otro vendor.
        const { data: vendor } = await supabase
            .from('vendor_profiles')
            .select('id')
            .eq('user_id', req.user.id)
            .maybeSingle();

        const {
            name, description, price, stock, category, category_id, brand_id, image_url,
            visibility, sku, attributes, weight_grams, is_digital,
            min_stock_alert, tax_rate, status,
        } = req.body;
        // school_id y vendor_profile_id NO se aceptan del body — se ignoran.

        if (!name || price === undefined) {
            return res.status(400).json({ ok: false, error: 'name y price son requeridos.' });
        }

        const { data, error } = await supabase
            .from('products')
            .insert({
                vendor_id: req.user.id,
                vendor_profile_id: vendor?.id ?? null,
                name,
                description: description || null,
                price,
                stock: stock || 0,
                category: category || null,            // legacy text
                category_id: category_id || null,      // FK nuevo
                brand_id: brand_id || null,
                image_url: image_url || null,
                visibility: visibility || 'public',
                // Default seguro: drafts entran como 'draft'. Para publicar
                // el frontend llama POST /:id/publish (trigger valida calidad).
                status: status || 'draft',
                sku: sku || null,
                attributes: attributes || {},
                weight_grams: weight_grams || null,
                is_digital: is_digital || false,
                min_stock_alert: min_stock_alert || 5,
                tax_rate: tax_rate || 0,
                // school_id deliberadamente no se envia desde el cliente;
                // el producto queda sin escuela hasta que admin lo asocie.
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

        // Blacklist de campos que jamas se permiten desde el body — incluye
        // las claves que enlazan el producto con su dueno/escuela. Sin esto
        // un vendor podria reasignar su producto a otro vendor_profile_id
        // o moverlo a otra escuela.
        delete updates.vendor_id;
        delete updates.vendor_profile_id;
        delete updates.school_id;
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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/vendor/products/:id/publish — pasar producto a 'active'
// El trigger enforce_product_publish_gate valida calidad. Si el vendor no esta
// verificado, el status queda en 'pending_review' (no es error).
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/publish', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('products')
            .update({ status: 'active' })
            .eq('id', id)
            .eq('vendor_id', req.user.id)
            .select()
            .single();

        if (error) {
            // 23514 = check_violation → reglas de calidad no cumplidas
            if (error.code === '23514') {
                return res.status(422).json({ ok: false, error: error.message, code: 'quality_check_failed' });
            }
            return res.status(500).json({ ok: false, error: 'Error publicando producto.' });
        }
        if (!data) {
            return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
        }

        await auditLog(req, 'product_publish', 'products', id as string);
        return res.json({
            ok:      true,
            data,
            message: data.status === 'pending_review'
                ? 'Producto en revisión — aparecerá tras aprobación admin.'
                : 'Producto publicado.',
        });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/vendor/products/:id/unpublish — volver a 'draft'
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/unpublish', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('products')
            .update({ status: 'draft' })
            .eq('id', id)
            .eq('vendor_id', req.user.id)
            .select()
            .single();

        if (error || !data) {
            return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
        }
        await auditLog(req, 'product_unpublish', 'products', id as string);
        return res.json({ ok: true, data });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/vendor/products/:id/duplicate — clona producto + sus variantes
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/duplicate', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const { data: original, error: e1 } = await supabase
            .from('products')
            .select('*, product_variants(*)')
            .eq('id', id)
            .eq('vendor_id', req.user.id)
            .maybeSingle();

        if (e1 || !original) {
            return res.status(404).json({ ok: false, error: 'Producto original no encontrado.' });
        }

        const {
            id: _omit_id, created_at: _omit_ca, updated_at: _omit_ua, sku: _omit_sku,
            reviewed_at: _omit_rev, reviewed_by: _omit_revby, rejection_reason: _omit_rr,
            product_variants: variants = [], ...rest
        } = original as Record<string, any>;

        const { data: clone, error: e2 } = await supabase
            .from('products')
            .insert({
                ...rest,
                name:   `${rest.name} (copia)`,
                status: 'draft',
                stock:  0,
            })
            .select()
            .single();

        if (e2 || !clone) {
            return res.status(500).json({ ok: false, error: 'Error duplicando producto.' });
        }

        // Clonar variantes (sin SKU para que se regenere)
        if (Array.isArray(variants) && variants.length > 0) {
            const variantsToInsert = variants.map((v: any) => ({
                product_id:     clone.id,
                name:           v.name,
                attributes:     v.attributes || {},
                price_override: v.price_override,
                stock:          0,
                image_url:      v.image_url,
                is_active:      v.is_active,
                sort_order:     v.sort_order,
            }));
            await supabase.from('product_variants').insert(variantsToInsert);
        }

        await auditLog(req, 'product_duplicate', 'products', clone.id);
        return res.status(201).json({ ok: true, data: clone });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/vendor/products/:id/variants/bulk — crea matriz de variantes
// body: { matrix: { attributeKey: string[], ... }, defaults: { stock?, price_override? } }
// Ejemplo: matrix = { talla: ["S","M","L"], color: ["negro","blanco"] }
//   → genera 6 variantes (S-negro, S-blanco, M-negro, ...)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/variants/bulk', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { matrix, defaults = {} } = req.body as {
            matrix:   Record<string, string[]>;
            defaults: { stock?: number; price_override?: number };
        };

        if (!matrix || typeof matrix !== 'object' || Object.keys(matrix).length === 0) {
            return res.status(400).json({ ok: false, error: 'matrix es requerido y debe tener al menos 1 eje.' });
        }

        // Ownership check
        const { data: product, error: pe } = await supabase
            .from('products')
            .select('id, name, sku')
            .eq('id', id)
            .eq('vendor_id', req.user.id)
            .maybeSingle();

        if (pe || !product) {
            return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
        }

        // Producto cartesiano de los ejes
        const keys = Object.keys(matrix);
        const axes = keys.map(k => matrix[k]);
        if (axes.some(a => !Array.isArray(a) || a.length === 0)) {
            return res.status(400).json({ ok: false, error: 'Cada eje del matrix debe ser un array no vacio.' });
        }

        const combinations: Record<string, string>[] = axes.reduce<Record<string, string>[]>(
            (acc, axisValues, idx) => {
                const key = keys[idx];
                if (acc.length === 0) return axisValues.map(v => ({ [key]: v }));
                const next: Record<string, string>[] = [];
                for (const prev of acc) for (const v of axisValues) next.push({ ...prev, [key]: v });
                return next;
            },
            [],
        );

        // Hard cap para evitar abuso
        if (combinations.length > 200) {
            return res.status(400).json({ ok: false, error: 'La matriz genera mas de 200 variantes. Reducir ejes.' });
        }

        // Build payload
        const baseSku = (product.sku || product.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20));
        const variantsToInsert = combinations.map((attrs, idx) => {
            const variantSuffix = Object.values(attrs).map(v => String(v).toUpperCase().replace(/\s+/g, '')).join('-');
            return {
                product_id:     id,
                name:           Object.entries(attrs).map(([k, v]) => `${k}: ${v}`).join(', '),
                attributes:     attrs,
                stock:          defaults.stock ?? 0,
                price_override: defaults.price_override ?? null,
                sku:            `${baseSku}-${variantSuffix}-${idx + 1}`.toUpperCase(),
                is_active:      true,
                sort_order:     idx,
            };
        });

        const { data: inserted, error: ie } = await supabase
            .from('product_variants')
            .insert(variantsToInsert)
            .select();

        if (ie) {
            req.log?.error({ err: ie }, 'Error en bulk variant insert');
            return res.status(500).json({ ok: false, error: 'Error creando variantes.' });
        }

        await auditLog(req, 'product_variants_bulk', 'product_variants', id as string, null, { count: inserted?.length });
        return res.status(201).json({ ok: true, data: inserted, count: inserted?.length || 0 });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/vendor/products/:id/quality — issues de calidad antes de publicar
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/quality', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Ownership
        const { data: product } = await supabase
            .from('products')
            .select('id')
            .eq('id', id)
            .eq('vendor_id', req.user.id)
            .maybeSingle();

        if (!product) {
            return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
        }

        const { data, error } = await supabase.rpc('validate_product_quality', { p_product_id: id });
        if (error) {
            return res.status(500).json({ ok: false, error: 'Error validando calidad.' });
        }
        return res.json({ ok: true, issues: data || [], ready_to_publish: Array.isArray(data) && data.length === 0 });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

export default router;
