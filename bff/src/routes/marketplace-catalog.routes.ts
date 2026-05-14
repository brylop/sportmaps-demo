/**
 * marketplace-catalog.routes — Endpoints publicos de taxonomia.
 *
 *  - GET /api/v1/marketplace/categories         arbol completo
 *  - GET /api/v1/marketplace/categories/:slug   categoria + attribute_schema
 *  - GET /api/v1/marketplace/brands             marcas activas
 *
 * No requieren auth — el catalogo es publico.
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/marketplace/categories — arbol jerarquico
// ─────────────────────────────────────────────────────────────────────────────
router.get('/categories', async (_req: Request, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('product_categories')
            .select('id, parent_id, slug, name, icon, sport, attribute_schema, sort_order')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error obteniendo categorias.' });
        }

        // Construir arbol: agrupar hijos bajo su parent
        type CatRow = {
            id: string; parent_id: string | null; slug: string; name: string;
            icon: string | null; sport: string | null; attribute_schema: unknown; sort_order: number;
            children?: CatRow[];
        };

        const byId = new Map<string, CatRow>();
        const roots: CatRow[] = [];
        for (const row of (data as CatRow[]) || []) {
            byId.set(row.id, { ...row, children: [] });
        }
        for (const row of byId.values()) {
            if (row.parent_id && byId.has(row.parent_id)) {
                byId.get(row.parent_id)!.children!.push(row);
            } else {
                roots.push(row);
            }
        }

        return res.json({ ok: true, data: roots });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/marketplace/categories/:slug — categoria individual con schema
// ─────────────────────────────────────────────────────────────────────────────
router.get('/categories/:slug', async (req: Request, res: Response) => {
    try {
        const { slug } = req.params;
        const { data, error } = await supabase
            .from('product_categories')
            .select('*')
            .eq('slug', slug)
            .eq('is_active', true)
            .maybeSingle();

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error obteniendo categoria.' });
        }
        if (!data) {
            return res.status(404).json({ ok: false, error: 'Categoria no encontrada.' });
        }
        return res.json({ ok: true, data });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/marketplace/brands — marcas activas
// ─────────────────────────────────────────────────────────────────────────────
router.get('/brands', async (_req: Request, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('product_brands')
            .select('id, slug, name, logo_url, is_official')
            .eq('is_active', true)
            .order('is_official', { ascending: false })
            .order('name', { ascending: true });

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error obteniendo marcas.' });
        }
        return res.json({ ok: true, data: data || [] });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

export default router;
