import { Router, Request, Response, NextFunction } from 'express';
import { requireMarketplaceAuth, auditLog } from '../middlewares/authMiddleware';
import { supabase } from '../config/supabase';
import {
    canManageStoreAs,
    resolveManagedVendorProfiles,
    profileCanSellProducts,
    type ManagedVendorProfile,
} from '../services/store-access';
import {
    PRODUCT_EDITABLE_FIELDS,
    VARIANT_EDITABLE_FIELDS,
    parseStock,
    pickEditable,
    buildDuplicateRow,
} from '../services/store-product-fields';
import { mapStoreRpcError } from '../services/store-rpc-errors';
import {
    productStockView,
    parseVariantSpecs,
    comboKey,
    variantDisplayName,
    buildSalesInsights,
    parsePeriodDays,
    PAID_LIKE_STATUSES,
} from '../services/store-inventory';

const router = Router();

const PRIVILEGED_ROLES = ['owner', 'super_admin', 'admin'];
const INVENTORY_REASONS = ['manual_adjust', 'manual_restock'] as const;

router.use(requireMarketplaceAuth);

// ─────────────────────────────────────────────────────────────────────────────
// Gate de la tienda (tienda v2 F0, M-F0-1).
//
// Antes: requireVendorProfile('can_sell_products') → solo el DUEÑO del
// vendor_profile. Ahora también entra el owner/admin (no coach) de la escuela
// dueña de la tienda: la regla la decide can_manage_store_as en la base.
// Las tiendas gestionables quedan en res.locals.managedVendorProfiles.
// ─────────────────────────────────────────────────────────────────────────────
router.use(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.id) {
        return res.status(401).json({ error: 'No autenticado.' });
    }
    try {
        const managed = await resolveManagedVendorProfiles(req.user.id);
        res.locals.managedVendorProfiles = managed;

        if (PRIVILEGED_ROLES.includes(req.role as string)) return next();

        const { data, error } = await supabase.rpc('has_vendor_capability', {
            p_user_id: req.user.id,
            p_capability: 'can_sell_products',
        });
        if (error) {
            req.log?.error({ err: error }, 'Error verificando capability de vendor');
            return res.status(500).json({ error: 'Error interno verificando permisos de vendedor.' });
        }
        if (data === true) return next();

        // Admin de la escuela que no es el dueño del perfil.
        if (managed.some((vp) => vp.user_id !== req.user.id && profileCanSellProducts(vp))) {
            return next();
        }

        return res.status(403).json({
            error: 'Tu cuenta no tiene activada esta capacidad de venta.',
            capability: 'can_sell_products',
            hint: 'Activa Mi Tienda desde tu dashboard para empezar a vender.',
        });
    } catch (err) {
        next(err);
    }
});

function managedOf(res: Response): ManagedVendorProfile[] {
    return (res.locals.managedVendorProfiles as ManagedVendorProfile[] | undefined) ?? [];
}

/** Filtra products/orders a las tiendas que el usuario gestiona (o las suyas legacy por vendor_id). */
function scopeToMyStores<Q extends { or: (f: string) => Q; eq: (c: string, v: string) => Q }>(
    query: Q, req: Request, res: Response,
): Q {
    const managedIds = managedOf(res).map((vp) => vp.id);
    return managedIds.length > 0
        ? query.or(`vendor_id.eq.${req.user.id},vendor_profile_id.in.(${managedIds.join(',')})`)
        : query.eq('vendor_id', req.user.id);
}

/**
 * Carga el producto solo si el usuario puede gestionar su tienda.
 * null = no existe o no es suyo (el llamador responde 404, sin distinguir).
 */
async function loadManagedProduct(req: Request, id: string, columns = 'id, vendor_id, vendor_profile_id'): Promise<any | null> {
    const { data, error } = await supabase
        .from('products')
        .select(columns)
        .eq('id', id)
        .maybeSingle();
    if (error || !data) return null;
    const product = data as any;
    if (product.vendor_profile_id) {
        const ok = await canManageStoreAs(product.vendor_profile_id, req.user.id, product.vendor_id);
        return ok ? product : null;
    }
    // Producto legacy sin vendor_profile_id: solo su vendor_id.
    return product.vendor_id === req.user.id ? product : null;
}

async function vendorProfileOwner(vendorProfileId: string): Promise<string | null> {
    const { data } = await supabase
        .from('vendor_profiles')
        .select('user_id')
        .eq('id', vendorProfileId)
        .maybeSingle();
    return (data as any)?.user_id ?? null;
}

function sendRpcError(res: Response, err: any) {
    const mapped = mapStoreRpcError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.message, code: mapped.code });
}

async function adjustInventory(
    req: Request,
    target: { variantId: string } | { productId: string },
    newStock: number,
    reasonCode: string,
    note: string | null,
) {
    return supabase.rpc('inventory_adjust', {
        p_variant_id: 'variantId' in target ? target.variantId : null,
        p_product_id: 'productId' in target ? target.productId : null,
        p_new_stock: newStock,
        p_reason_code: reasonCode,
        p_note: note,
        p_actor: req.user.id,
    });
}

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
                product_categories (id, slug, name),
                product_variants (id, sku, name, attributes, price_override, stock, reserved, image_url, is_active, sort_order)
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit as string, 10) - 1);

        query = scopeToMyStores(query, req, res);

        if (status) query = query.eq('status', status as string);
        if (category) query = query.eq('category', category as string);

        const { data, error, count } = await query;

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error obteniendo productos.' });
        }

        // Stock real: con variantes = suma de las activas (no products.stock suelto);
        // "stock bajo" según el min_stock_alert de cada producto.
        const rows = (data || []).map((p: any) => {
            const variants = Array.isArray(p.product_variants)
                ? [...p.product_variants].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                : [];
            return { ...p, product_variants: variants, ...productStockView({ ...p, product_variants: variants }) };
        });

        return res.json({ ok: true, data: rows, total: count || 0 });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/vendor/products/insights?days=30 — métricas de la tienda
// Ingresos, pedidos, ticket promedio y más vendidos desde orders/order_items
// de las tiendas que el usuario gestiona. Solo pedidos pagados en adelante.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/insights', async (req: Request, res: Response) => {
    try {
        const days = parsePeriodDays(req.query.days);
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        let ordersQ = supabase
            .from('orders')
            .select('id, status, total_amount, created_at')
            .in('status', PAID_LIKE_STATUSES as unknown as string[])
            .gte('created_at', since)
            .limit(5000);
        ordersQ = scopeToMyStores(ordersQ, req, res);
        const { data: orders, error: oErr } = await ordersQ;
        if (oErr) {
            req.log?.error({ err: oErr }, 'insights: error leyendo pedidos');
            return res.status(500).json({ ok: false, error: 'Error obteniendo métricas.' });
        }

        const orderIds = (orders || []).map((o: any) => o.id as string);
        let items: any[] = [];
        for (let i = 0; i < orderIds.length; i += 200) {
            const { data: chunk, error: iErr } = await supabase
                .from('order_items')
                .select('order_id, product_id, quantity, line_total, subtotal, unit_price')
                .in('order_id', orderIds.slice(i, i + 200));
            if (iErr) {
                req.log?.error({ err: iErr }, 'insights: error leyendo ítems');
                return res.status(500).json({ ok: false, error: 'Error obteniendo métricas.' });
            }
            items = items.concat(chunk || []);
        }

        const productIds = [...new Set(items.map((it) => it.product_id).filter(Boolean))] as string[];
        const names: Record<string, string> = {};
        if (productIds.length > 0) {
            const { data: prods } = await supabase.from('products').select('id, name').in('id', productIds);
            for (const p of prods || []) names[(p as any).id] = (p as any).name;
        }

        const insights = buildSalesInsights((orders || []) as any[], items, names);
        return res.json({ ok: true, data: { ...insights, days, since } });
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
            name, description, price, category, category_id, brand_id, image_url,
            visibility, sku, attributes, weight_grams, is_digital,
            min_stock_alert, tax_rate, status,
        } = req.body;
        // vendor_id y school_id NO se aceptan del body: vendor_id sale del
        // vendor_profile y school_id lo fija el trigger desde el perfil.

        if (!name || price === undefined) {
            return res.status(400).json({ ok: false, error: 'name y price son requeridos.' });
        }

        const stock = parseStock(req.body);
        if (stock.present && !stock.valid) {
            return res.status(400).json({ ok: false, error: 'stock debe ser un entero mayor o igual a 0.' });
        }

        // Tienda destino: la del body solo si el usuario la puede gestionar;
        // si no viene, la propia (o la única que gestiona).
        const managed = managedOf(res);
        const requestedVp = typeof req.body?.vendor_profile_id === 'string' && req.body.vendor_profile_id
            ? req.body.vendor_profile_id as string
            : null;

        let vendorProfileId: string | null = null;
        let vendorOwnerId: string | null = null;
        if (requestedVp) {
            const known = managed.find((vp) => vp.id === requestedVp);
            if (known) {
                vendorProfileId = known.id;
                vendorOwnerId = known.user_id;
            } else {
                const owner = await vendorProfileOwner(requestedVp);
                if (await canManageStoreAs(requestedVp, req.user.id, owner)) {
                    vendorProfileId = requestedVp;
                    vendorOwnerId = owner;
                }
            }
            if (!vendorProfileId) {
                return res.status(403).json({ ok: false, error: 'No puedes gestionar esta tienda.', code: 'NOT_OWNER' });
            }
        } else {
            const own = managed.find((vp) => vp.user_id === req.user.id) ?? (managed.length === 1 ? managed[0] : undefined);
            if (!own) {
                return res.status(400).json({
                    ok: false,
                    error: 'Indica vendor_profile_id: no hay una tienda única asociada a tu cuenta.',
                    code: 'VENDOR_PROFILE_REQUIRED',
                });
            }
            vendorProfileId = own.id;
            vendorOwnerId = own.user_id;
        }

        const { data, error } = await supabase
            .from('products')
            .insert({
                vendor_id: vendorOwnerId,
                vendor_profile_id: vendorProfileId,
                name,
                description: description || null,
                price,
                // Nace en 0: el stock inicial entra abajo por inventory_adjust (kardex).
                stock: 0,
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

        let created = data;
        if (stock.present && stock.valid && stock.value > 0) {
            const { data: adj, error: adjErr } = await adjustInventory(
                req, { productId: data.id }, stock.value, 'manual_restock', 'Stock inicial',
            );
            if (adjErr) {
                req.log?.error({ err: adjErr }, 'Producto creado sin stock inicial');
                return res.status(207).json({
                    ok: false, data, error: 'El producto se creó, pero no se pudo cargar el stock inicial.',
                    code: mapStoreRpcError(adjErr).code,
                });
            }
            created = { ...data, stock: (adj as any)?.stock_after ?? stock.value };
        }

        await auditLog(req, 'product_create', 'products', data.id);
        return res.status(201).json({ ok: true, data: created });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/vendor/products/:id — Actualizar producto
//
// Lista blanca de campos (store-product-fields). `stock` no se escribe directo:
// si viene y cambia, va por inventory_adjust (rastro en inventory_logs).
// En un producto con variantes el stock es de cada variante: se ignora acá.
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id', async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;

        const stock = parseStock(req.body);
        if (stock.present && !stock.valid) {
            return res.status(400).json({ ok: false, error: 'stock debe ser un entero mayor o igual a 0.' });
        }

        const product = await loadManagedProduct(req, id, 'id, vendor_id, vendor_profile_id, stock, product_variants(id)');
        if (!product) {
            return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
        }

        let inventory: unknown = null;
        const hasVariants = Array.isArray(product.product_variants) && product.product_variants.length > 0;
        if (stock.present && stock.valid && !hasVariants && stock.value !== Number(product.stock ?? 0)) {
            const { data: adj, error: adjErr } = await adjustInventory(
                req, { productId: id }, stock.value, 'manual_adjust', 'Edición del producto',
            );
            if (adjErr) return sendRpcError(res, adjErr);
            inventory = adj;
        }

        const updates = pickEditable(req.body, PRODUCT_EDITABLE_FIELDS);

        const { data, error } = Object.keys(updates).length > 0
            ? await supabase.from('products').update(updates).eq('id', id).select().single()
            : await supabase.from('products').select().eq('id', id).single();

        if (error) {
            if (error.code === '23514') {
                return res.status(422).json({ ok: false, error: error.message, code: 'quality_check_failed' });
            }
            return res.status(500).json({ ok: false, error: 'Error actualizando producto.' });
        }

        if (!data) {
            return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
        }

        return res.json({ ok: true, data, inventory });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/vendor/products/:id/inventory — kardex (historial de movimientos)
// Lo más reciente primero. Solo lectura: inventory_logs es append-only.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/inventory', async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const product = await loadManagedProduct(req, id);
        if (!product) {
            return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
        }
        const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '100'), 10) || 100, 1), 500);

        const { data: logs, error } = await supabase
            .from('inventory_logs')
            .select('id, variant_id, delta, stock_before, stock_after, reason, note, order_id, created_by, created_at')
            .eq('product_id', id)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) {
            req.log?.error({ err: error }, 'Error leyendo kardex');
            return res.status(500).json({ ok: false, error: 'Error obteniendo el historial.' });
        }

        const variantIds = [...new Set((logs || []).map((l: any) => l.variant_id).filter(Boolean))] as string[];
        const actorIds = [...new Set((logs || []).map((l: any) => l.created_by).filter(Boolean))] as string[];
        const [variantsRes, actorsRes] = await Promise.all([
            variantIds.length
                ? supabase.from('product_variants').select('id, name').in('id', variantIds)
                : Promise.resolve({ data: [] as any[] }),
            actorIds.length
                ? supabase.from('profiles').select('id, full_name').in('id', actorIds)
                : Promise.resolve({ data: [] as any[] }),
        ]);
        const vName = new Map((variantsRes.data || []).map((v: any) => [v.id, v.name]));
        const aName = new Map((actorsRes.data || []).map((a: any) => [a.id, a.full_name]));

        return res.json({
            ok: true,
            data: (logs || []).map((l: any) => ({
                ...l,
                variant_name: l.variant_id ? vName.get(l.variant_id) ?? null : null,
                actor_name: l.created_by ? aName.get(l.created_by) ?? null : null,
            })),
        });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/vendor/products/:id/inventory — Ajuste de stock
// body: { variant_id?, new_stock, reason_code?: 'manual_adjust'|'manual_restock', note? }
// Sin variant_id ajusta el producto (solo si no tiene variantes).
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/inventory', async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const { variant_id, reason_code, note } = req.body ?? {};

        const stock = parseStock({ stock: req.body?.new_stock });
        if (!stock.present || !stock.valid) {
            return res.status(400).json({ ok: false, error: 'new_stock debe ser un entero mayor o igual a 0.', code: 'INVALID_QTY' });
        }
        const reason = reason_code ?? 'manual_adjust';
        if (!(INVENTORY_REASONS as readonly string[]).includes(reason)) {
            return res.status(400).json({ ok: false, error: `reason_code debe ser uno de: ${INVENTORY_REASONS.join(', ')}.` });
        }
        if (note !== undefined && note !== null && (typeof note !== 'string' || note.length > 500)) {
            return res.status(400).json({ ok: false, error: 'note debe ser texto de hasta 500 caracteres.' });
        }
        if (variant_id !== undefined && variant_id !== null && typeof variant_id !== 'string') {
            return res.status(400).json({ ok: false, error: 'variant_id inválido.' });
        }

        const product = await loadManagedProduct(req, id);
        if (!product) {
            return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
        }

        if (variant_id) {
            const { data: variant } = await supabase
                .from('product_variants')
                .select('id')
                .eq('id', variant_id)
                .eq('product_id', id)
                .maybeSingle();
            if (!variant) {
                return res.status(404).json({ ok: false, error: 'Variante no encontrada.' });
            }
        }

        const { data, error } = await adjustInventory(
            req,
            variant_id ? { variantId: variant_id } : { productId: id },
            stock.value,
            reason,
            note ?? null,
        );
        if (error) return sendRpcError(res, error);

        await auditLog(req, 'inventory_adjust', variant_id ? 'product_variants' : 'products', (variant_id || id) as string, null, {
            new_stock: stock.value,
            reason_code: reason,
        });
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
        const id = req.params.id as string;

        const product = await loadManagedProduct(req, id);
        if (!product) {
            return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
        }

        const { data, error } = await supabase
            .from('products')
            .update({ status: 'archived', active: false })
            .eq('id', id)
            .select()
            .single();

        if (error || !data) {
            return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
        }

        await auditLog(req, 'product_archive', 'products', id);
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
        const id = req.params.id as string;
        const { sku, name, attributes, price_override, image_url } = req.body;

        const product = await loadManagedProduct(req, id);
        if (!product) {
            return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
        }

        if (!name) {
            return res.status(400).json({ ok: false, error: 'name es requerido para la variante.' });
        }

        // Stock inicial: se permite en el alta (INSERT), no en la edición.
        const stock = parseStock(req.body);
        if (stock.present && !stock.valid) {
            return res.status(400).json({ ok: false, error: 'stock debe ser un entero mayor o igual a 0.' });
        }

        const { data, error } = await supabase
            .from('product_variants')
            .insert({
                product_id: id,
                sku: sku || null,
                name,
                attributes: attributes || {},
                price_override: price_override || null,
                stock: stock.present && stock.valid ? stock.value : 0,
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
// `stock` no se escribe directo: si viene y cambia, va por inventory_adjust.
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/variants/:variantId', async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const variantId = req.params.variantId as string;

        const stock = parseStock(req.body);
        if (stock.present && !stock.valid) {
            return res.status(400).json({ ok: false, error: 'stock debe ser un entero mayor o igual a 0.' });
        }

        const product = await loadManagedProduct(req, id);
        if (!product) {
            return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
        }

        const { data: current } = await supabase
            .from('product_variants')
            .select('id, stock')
            .eq('id', variantId)
            .eq('product_id', id)
            .maybeSingle();
        if (!current) {
            return res.status(404).json({ ok: false, error: 'Variante no encontrada.' });
        }

        let inventory: unknown = null;
        if (stock.present && stock.valid && stock.value !== Number((current as any).stock ?? 0)) {
            const { data: adj, error: adjErr } = await adjustInventory(
                req, { variantId }, stock.value, 'manual_adjust', 'Edición de la variante',
            );
            if (adjErr) return sendRpcError(res, adjErr);
            inventory = adj;
        }

        const updates = pickEditable(req.body, VARIANT_EDITABLE_FIELDS);

        const { data, error } = Object.keys(updates).length > 0
            ? await supabase.from('product_variants').update(updates).eq('id', variantId).eq('product_id', id).select().single()
            : await supabase.from('product_variants').select().eq('id', variantId).eq('product_id', id).single();

        if (error || !data) {
            return res.status(404).json({ ok: false, error: 'Variante no encontrada.' });
        }

        return res.json({ ok: true, data, inventory });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/v1/vendor/products/:id/variants/:variantId — Eliminar variante
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id/variants/:variantId', async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const variantId = req.params.variantId as string;

        const product = await loadManagedProduct(req, id);
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
        const id = req.params.id as string;

        const product = await loadManagedProduct(req, id);
        if (!product) {
            return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
        }

        const { data, error } = await supabase
            .from('products')
            .update({ status: 'active' })
            .eq('id', id)
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

        await auditLog(req, 'product_publish', 'products', id);
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
        const id = req.params.id as string;

        const product = await loadManagedProduct(req, id);
        if (!product) {
            return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
        }

        const { data, error } = await supabase
            .from('products')
            .update({ status: 'draft' })
            .eq('id', id)
            .select()
            .single();

        if (error || !data) {
            return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
        }
        await auditLog(req, 'product_unpublish', 'products', id);
        return res.json({ ok: true, data });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/vendor/products/:id/duplicate — clona producto + sus variantes
// No copia vendor_id / school_id del original: vendor_id sale del
// vendor_profile (ya validado con can_manage_store_as) y school_id lo fija el
// trigger. Stock en 0.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/duplicate', async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;

        const original = await loadManagedProduct(req, id, '*, product_variants(*)');
        if (!original) {
            return res.status(404).json({ ok: false, error: 'Producto original no encontrado.' });
        }

        const variants = (original as Record<string, any>).product_variants ?? [];
        const row = buildDuplicateRow(original as Record<string, unknown>);
        row.vendor_id = original.vendor_profile_id
            ? await vendorProfileOwner(original.vendor_profile_id)
            : req.user.id; // legacy sin perfil: loadManagedProduct ya exigió vendor_id = usuario

        const { data: clone, error: e2 } = await supabase
            .from('products')
            .insert(row)
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
// POST /api/v1/vendor/products/:id/variants/bulk — crea variantes con su stock
// body (preferido): { variants: [{ attributes: { talla: "S" }, stock: 12, price_override? }, …] }
//   → cada combinación con SU stock inicial.
// body (legacy):    { matrix: { talla: ["S","M"], color: [...] }, defaults: { stock?, price_override? } }
//   → producto cartesiano con el mismo stock.
// Las combinaciones que el producto ya tiene se omiten (sirve al editar para
// agregar tallas nuevas). Las variantes nacen en 0 y el stock inicial entra por
// inventory_adjust ('manual_restock', nota "Stock inicial"): queda en el kardex.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/variants/bulk', async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;

        const parsed = parseVariantSpecs(req.body);
        if (!parsed.ok) {
            return res.status(400).json({ ok: false, error: parsed.error });
        }

        const product = await loadManagedProduct(req, id, 'id, name, sku, vendor_id, vendor_profile_id');
        if (!product) {
            return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
        }

        const { data: existing, error: exErr } = await supabase
            .from('product_variants')
            .select('id, attributes, sort_order')
            .eq('product_id', id);
        if (exErr) {
            return res.status(500).json({ ok: false, error: 'Error leyendo variantes.' });
        }
        const have = new Set((existing || []).map((v: any) => comboKey(v.attributes || {})));
        const toCreate = parsed.variants.filter((v) => !have.has(comboKey(v.attributes)));
        if ((existing?.length ?? 0) + toCreate.length > 200) {
            return res.status(400).json({ ok: false, error: 'El producto superaría 200 variantes. Reducir ejes.' });
        }
        if (toCreate.length === 0) {
            return res.status(200).json({ ok: true, data: [], count: 0, skipped: parsed.variants.length });
        }

        const baseSku = (product.sku || String(product.name).toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20));
        const maxSort = Math.max(-1, ...(existing || []).map((v: any) => Number(v.sort_order ?? 0)));
        const stamp = Date.now().toString(36).slice(-4).toUpperCase();
        const rows = toCreate.map((v, idx) => {
            const suffix = Object.values(v.attributes).map((x) => String(x).toUpperCase().replace(/\s+/g, '')).join('-');
            return {
                product_id:     id,
                name:           variantDisplayName(v.attributes),
                attributes:     v.attributes,
                stock:          0,
                price_override: v.price_override,
                sku:            `${baseSku}-${suffix}-${stamp}${idx + 1}`.toUpperCase(),
                is_active:      true,
                sort_order:     maxSort + 1 + idx,
            };
        });

        const { data: inserted, error: ie } = await supabase
            .from('product_variants')
            .insert(rows)
            .select();

        if (ie || !inserted) {
            req.log?.error({ err: ie }, 'Error en bulk variant insert');
            return res.status(500).json({ ok: false, error: 'Error creando variantes.' });
        }

        // Stock inicial por variante, con kardex.
        const stockErrors: { variant_id: string; error: string }[] = [];
        for (const v of inserted as any[]) {
            const spec = toCreate.find((t) => comboKey(t.attributes) === comboKey(v.attributes || {}));
            if (!spec || spec.stock <= 0) continue;
            const { error: adjErr } = await adjustInventory(req, { variantId: v.id }, spec.stock, 'manual_restock', 'Stock inicial');
            if (adjErr) {
                stockErrors.push({ variant_id: v.id, error: mapStoreRpcError(adjErr).message });
            } else {
                v.stock = spec.stock;
            }
        }

        await auditLog(req, 'product_variants_bulk', 'product_variants', id, null, { count: inserted.length });
        if (stockErrors.length > 0) {
            return res.status(207).json({
                ok: false, data: inserted, count: inserted.length, stock_errors: stockErrors,
                error: 'Se crearon las variantes, pero no se pudo cargar el stock inicial de algunas.',
            });
        }
        return res.status(201).json({ ok: true, data: inserted, count: inserted.length });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/vendor/products/:id/quality — issues de calidad antes de publicar
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/quality', async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;

        const product = await loadManagedProduct(req, id);
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
