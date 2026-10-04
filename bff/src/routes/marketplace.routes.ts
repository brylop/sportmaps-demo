import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middlewares/authMiddleware';
import { supabase } from '../config/supabase';
import { todayInZone } from '../utils/businessDate';
import { isStoreEnabled, requireStoreEnabled, STORE_DISABLED_BODY } from '../services/store-flag.service';
import { VENDOR_PUBLIC_COLUMNS } from '../services/vendor-public-columns';
import { shapeStoreCatalog, type CatalogProductRow } from '../services/store-catalog';

// Columnas públicas de vendor_profiles: services/vendor-public-columns.ts
// (con test que vigila que no entre ninguna columna sensible).

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/marketplace
// Busqueda publica unificada de productos + servicios
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', optionalAuth, async (req: Request, res: Response) => {
    try {
        const {
            q, type = 'all', category, city, price_max,
            service_type, modality, page = '1', limit = '24', order_by = 'newest'
        } = req.query;

        // Tienda apagada (spec blindaje §1.3): Explorar sigue mostrando servicios,
        // pero no productos. 'products' -> 503; 'all' -> se piden solo servicios
        // (asi el total y la paginacion salen bien, en vez de filtrar despues).
        let effectiveType = type as string;
        if (effectiveType !== 'services' && !(await isStoreEnabled())) {
            if (effectiveType === 'products') {
                return res.status(503).json(STORE_DISABLED_BODY);
            }
            effectiveType = 'services';
        }

        const VALID_MODALITIES = ['presencial', 'virtual', 'domicilio', 'hibrido'];
        const modalityParam = typeof modality === 'string' && VALID_MODALITIES.includes(modality)
            ? modality
            : null;

        const { data, error } = await supabase.rpc('search_marketplace', {
            p_query: (q as string) || null,
            p_type: effectiveType,
            p_category: (category as string) || null,
            p_city: (city as string) || null,
            p_price_max: price_max ? parseFloat(price_max as string) : null,
            p_service_type: (service_type as string) || null,
            p_modality: modalityParam,
            p_page: parseInt(page as string, 10),
            p_limit: Math.min(parseInt(limit as string, 10), 100),
            p_order_by: order_by as string,
        });

        if (error) {
            req.log?.error({ err: error }, 'Error en search_marketplace');
            return res.status(500).json({ ok: false, error: 'Error buscando en marketplace.' });
        }

        return res.json({ ok: true, ...data });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/marketplace/products/:id
// Detalle de producto con variantes e info de vendor
// ─────────────────────────────────────────────────────────────────────────────
router.get('/products/:id', requireStoreEnabled, optionalAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const { data: product, error } = await supabase
            .from('products')
            .select(`
                *,
                product_variants (id, sku, name, attributes, price_override, stock, image_url, is_active, sort_order),
                vendor_profiles!products_vendor_profile_id_fkey (id, display_name, slug, city, logo_url, verification_status, avg_rating, reviews_count),
                product_categories!products_category_id_fkey (slug, name, attribute_schema)
            `)
            .eq('id', id)
            .eq('active', true)
            .eq('status', 'active')
            .maybeSingle();

        if (error || !product) {
            return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
        }

        return res.json({ ok: true, data: product });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/marketplace/services/:id
// Detalle de servicio con variaciones e info de vendor
// ─────────────────────────────────────────────────────────────────────────────
router.get('/services/:id', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const { data: service, error } = await supabase
            .from('service_listings')
            .select(`
                *,
                service_variations (id, name, description, price, duration_minutes, is_active, sort_order),
                vendor_profiles!service_listings_vendor_profile_id_fkey (id, display_name, slug, city, logo_url, verification_status, user_id)
            `)
            .eq('id', id)
            .eq('is_active', true)
            .maybeSingle();

        if (error || !service) {
            return res.status(404).json({ ok: false, error: 'Servicio no encontrado.' });
        }

        return res.json({ ok: true, data: service });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/marketplace/services/:id/slots
// Slots disponibles para un servicio en una fecha
// ─────────────────────────────────────────────────────────────────────────────
router.get('/services/:id/slots', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { date } = req.query;

        // Obtener vendor_profile_id del servicio
        const { data: service } = await supabase
            .from('service_listings')
            .select('vendor_profile_id')
            .eq('id', id)
            .maybeSingle();

        if (!service) {
            return res.status(404).json({ ok: false, error: 'Servicio no encontrado.' });
        }

        const { data, error } = await supabase.rpc('get_available_slots', {
            p_vendor_profile_id: service.vendor_profile_id,
            p_service_listing_id: id,
            p_date: (date as string) || todayInZone(),
        });

        if (error) {
            req.log?.error({ err: error }, 'Error en get_available_slots');
            return res.status(500).json({ ok: false, error: 'Error obteniendo slots.' });
        }

        return res.json({ ok: true, ...data });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/marketplace/categories
// Categorias agregadas (legacy) — se mueve a /categories-legacy para no
// colisionar con marketplace-catalog.routes.ts /categories (jerarquico).
// El frontend nuevo (ProductWizard) consume el endpoint del catalog router
// que devuelve un array. Este sigue disponible para llamadas legacy.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/categories-legacy', async (_req: Request, res: Response) => {
    try {
        // Categorias de productos
        const { data: productCategories } = await supabase
            .from('products')
            .select('category')
            .eq('active', true)
            .eq('visibility', 'public')
            .not('category', 'is', null);

        const uniqueProductCategories = [...new Set(
            (productCategories || []).map(p => p.category).filter(Boolean)
        )];

        // Tipos de servicio
        const serviceTypes = [
            'Fisioterapia', 'Nutricion', 'Psicologia',
            'Medicina_Deportiva', 'Entrenamiento', 'Otro'
        ];

        return res.json({
            ok: true,
            data: {
                product_categories: uniqueProductCategories,
                service_types: serviceTypes,
            },
        });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/marketplace/vendor/:slug
// Perfil publico del vendedor con su catalogo
// ─────────────────────────────────────────────────────────────────────────────
router.get('/vendor/:slug', requireStoreEnabled, optionalAuth, async (req: Request, res: Response) => {
    try {
        const { slug } = req.params;

        // Tienda escolar: no pasa por la verificación de vendedor externo
        // (store_seller_allowed la gatea por addon + escuela operativa).
        const { data: vendor, error } = await supabase
            .from('vendor_profiles')
            .select(VENDOR_PUBLIC_COLUMNS)
            .eq('slug', slug)
            .eq('is_active', true)
            .or('verification_status.eq.verified,vendor_type.eq.school')
            .maybeSingle();

        if (error || !vendor) {
            return res.status(404).json({ ok: false, error: 'Vendedor no encontrado.' });
        }

        // Tienda v2 F0 (B3/B4): catálogo por vendor_profile_id con variantes y
        // disponibilidad real (stock - reservado); school_only solo a miembros.
        const [{ data: vpSchool }, { data: selling }] = await Promise.all([
            supabase.from('vendor_profiles').select('school_id').eq('id', vendor.id).maybeSingle(),
            supabase.rpc('store_seller_allowed', { p_vendor_profile_id: vendor.id }),
        ]);
        const storeSchoolId: string | null = (vpSchool as any)?.school_id ?? null;
        let memberSchoolIds: string[] = [];
        if (req.user?.id && storeSchoolId) {
            const { data: ids } = await supabase.rpc('_store_user_school_ids', { p_user: req.user.id });
            memberSchoolIds = Array.isArray(ids) ? (ids as string[]) : [];
        }
        const { data: productRows } = await supabase
            .from('products')
            .select(`id, name, description, price, image_url, category, stock, reserved, visibility, school_id,
                     tax_rate, min_stock_alert,
                     product_variants (id, name, attributes, price_override, stock, reserved, image_url, is_active, sort_order),
                     product_images (image_url, alt_text, sort_order, is_primary)`)
            .or(`vendor_profile_id.eq.${vendor.id},and(vendor_profile_id.is.null,vendor_id.eq.${vendor.user_id})`)
            .eq('active', true)
            .in('visibility', ['public', 'school_only'])
            .eq('status', 'active')
            .order('created_at', { ascending: false });
        const products = shapeStoreCatalog((productRows ?? []) as unknown as CatalogProductRow[], {
            storeSchoolId,
            memberSchoolIds,
        });

        // Obtener servicios del vendor
        const { data: services } = await supabase
            .from('service_listings')
            .select('id, name, description, price, image_url, service_type, duration_minutes')
            .eq('vendor_profile_id', vendor.id)
            .eq('is_active', true)
            .eq('visibility', 'public')
            .order('created_at', { ascending: false });

        return res.json({
            ok: true,
            data: {
                vendor: { ...vendor, school_id: storeSchoolId },
                /** false = la tienda existe pero hoy no vende (allowlist, addon, escuela sin operar). */
                selling: selling === true,
                products: products || [],
                services: services || [],
            },
        });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/marketplace/school-store/:schoolId
// Resuelve el slug de la tienda (vendor_profile tipo 'school') de una escuela,
// para que el padre entre a /tienda/:slug desde su app. La tienda de la escuela
// es el vendor_profile con school_id = la escuela (tienda v2 M-F0-1). Fallback
// legacy: el perfil 'school' del dueño, solo si no está atado a OTRA escuela
// (un dueño con dos escuelas no debe mostrar la misma tienda en las dos).
// ─────────────────────────────────────────────────────────────────────────────
router.get('/school-store/:schoolId', requireStoreEnabled, optionalAuth, async (req: Request, res: Response) => {
    try {
        const { schoolId } = req.params;

        const { data: school } = await supabase
            .from('schools')
            .select('owner_id, name')
            .eq('id', schoolId)
            .maybeSingle();
        if (!school?.owner_id) {
            return res.status(404).json({ ok: false, error: 'Escuela no encontrada.' });
        }

        const { data: bySchool } = await supabase
            .from('vendor_profiles')
            .select('slug, display_name, is_active, school_id')
            .eq('school_id', schoolId)
            .maybeSingle();

        let vp = bySchool;
        if (!vp) {
            const { data: byOwner } = await supabase
                .from('vendor_profiles')
                .select('slug, display_name, is_active, school_id')
                .eq('user_id', school.owner_id)
                .eq('vendor_type', 'school')
                .maybeSingle();
            vp = byOwner && (!byOwner.school_id || byOwner.school_id === schoolId) ? byOwner : null;
        }

        return res.json({
            ok: true,
            data: {
                slug: vp?.slug ?? null,
                published: !!(vp && vp.slug && vp.is_active),
                display_name: vp?.display_name ?? school.name,
            },
        });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

export default router;
