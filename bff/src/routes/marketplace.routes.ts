import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middlewares/authMiddleware';
import { supabase } from '../config/supabase';

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

        const VALID_MODALITIES = ['presencial', 'virtual', 'domicilio', 'hibrido'];
        const modalityParam = typeof modality === 'string' && VALID_MODALITIES.includes(modality)
            ? modality
            : null;

        const { data, error } = await supabase.rpc('search_marketplace', {
            p_query: (q as string) || null,
            p_type: type as string,
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
router.get('/products/:id', optionalAuth, async (req: Request, res: Response) => {
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
            p_date: (date as string) || new Date().toISOString().split('T')[0],
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
router.get('/vendor/:slug', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { slug } = req.params;

        const { data: vendor, error } = await supabase
            .from('vendor_profiles')
            .select('*')
            .eq('slug', slug)
            .eq('is_active', true)
            .maybeSingle();

        if (error || !vendor) {
            return res.status(404).json({ ok: false, error: 'Vendedor no encontrado.' });
        }

        // Obtener productos del vendor
        const { data: products } = await supabase
            .from('products')
            .select('id, name, description, price, image_url, category, stock')
            .eq('vendor_id', vendor.user_id)
            .eq('active', true)
            .eq('visibility', 'public')
            .eq('status', 'active')
            .order('created_at', { ascending: false });

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
                vendor,
                products: products || [],
                services: services || [],
            },
        });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

export default router;
