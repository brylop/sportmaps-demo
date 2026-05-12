/**
 * reviews.routes — Reviews de productos + Q&A + vendor reviews.
 *
 * Publico:
 *  - GET  /api/v1/marketplace/products/:id/reviews
 *  - GET  /api/v1/marketplace/products/:id/questions
 *  - GET  /api/v1/marketplace/vendors/:profileId/reviews
 *
 * Autenticado (verified purchase via RLS):
 *  - POST  /api/v1/reviews/products/:id      (crear review producto)
 *  - PATCH /api/v1/reviews/:id               (editar dentro de 24h)
 *  - DELETE /api/v1/reviews/:id              (autor o admin)
 *  - POST  /api/v1/reviews/:id/vote          (helpful/unhelpful)
 *  - POST  /api/v1/reviews/:id/flag          (reporte)
 *  - POST  /api/v1/reviews/:id/respond       (vendor responde)
 *  - GET   /api/v1/reviews/products/:id/can-review  (puede dejar review?)
 *
 *  - POST  /api/v1/questions/products/:id    (preguntar)
 *  - POST  /api/v1/questions/:id/answer      (vendor responde)
 *
 *  - POST  /api/v1/vendor-reviews/:vendorProfileId (rating al vendor)
 *
 *  - GET   /api/v1/vendor/inbox              (reviews + preguntas pendientes del vendor)
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
    requireMarketplaceAuth,
    optionalAuth,
    auditLog,
} from '../middlewares/authMiddleware';
import { supabase } from '../config/supabase';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Schemas Zod
// ─────────────────────────────────────────────────────────────────────────────
const reviewCreateSchema = z.object({
    rating:         z.number().int().min(1).max(5),
    title:          z.string().max(120).optional(),
    body:           z.string().min(20).max(4000),
    sport_used_for: z.string().max(40).optional().nullable(),
    level:          z.enum(['principiante','intermedio','avanzado','profesional']).optional().nullable(),
    usage_duration: z.enum(['una_vez','1_semana','1_mes','3_meses','6_meses','1_anio','mas_de_1_anio']).optional().nullable(),
    fit_feedback:   z.enum(['muy_pequeno','pequeno','justo','grande','muy_grande','no_aplica']).optional().nullable(),
    recommended:    z.boolean().optional().nullable(),
    variant_id:     z.string().uuid().optional().nullable(),
    media_urls:     z.array(z.string().url()).max(6).optional(),
});

const reviewUpdateSchema = reviewCreateSchema.partial();

const respondSchema = z.object({
    response: z.string().min(5).max(2000),
});

const voteSchema = z.object({
    vote: z.enum(['helpful', 'unhelpful']),
});

const questionSchema = z.object({
    question: z.string().min(5).max(500),
});

const answerSchema = z.object({
    answer: z.string().min(2).max(2000),
});

const vendorReviewSchema = z.object({
    rating:          z.number().int().min(1).max(5),
    shipping_rating: z.number().int().min(1).max(5).optional(),
    service_rating:  z.number().int().min(1).max(5).optional(),
    body:            z.string().max(2000).optional(),
    order_id:        z.string().uuid().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// PUBLICO: GET reviews / questions
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/marketplace/products/:id/reviews
router.get('/marketplace/products/:id/reviews', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { page = '1', limit = '20', sort = 'recent' } = req.query;
        const offset = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);

        let q = supabase
            .from('product_reviews')
            .select(`
                id, rating, title, body, sport_used_for, level, usage_duration, fit_feedback,
                recommended, helpful_count, unhelpful_count, vendor_response, vendor_responded_at,
                is_verified_purchase, created_at, user_id,
                profiles!product_reviews_user_id_fkey(full_name, avatar_url),
                product_review_media(id, type, url, thumbnail_url)
            `, { count: 'exact' })
            .eq('product_id', id)
            .eq('status', 'published');

        // Sort
        if (sort === 'helpful')         q = q.order('helpful_count', { ascending: false });
        else if (sort === 'rating_desc') q = q.order('rating', { ascending: false });
        else if (sort === 'rating_asc')  q = q.order('rating', { ascending: true });
        else                             q = q.order('created_at', { ascending: false });

        const { data, error, count } = await q.range(offset, offset + parseInt(limit as string, 10) - 1);

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error obteniendo reviews.' });
        }

        // Agregar info de voto del usuario actual
        let userVotes: Record<string, string> = {};
        if (req.user?.id && data && data.length > 0) {
            const reviewIds = data.map((r: any) => r.id);
            const { data: votes } = await supabase
                .from('product_review_votes')
                .select('review_id, vote')
                .eq('user_id', req.user.id)
                .in('review_id', reviewIds);
            userVotes = Object.fromEntries((votes || []).map((v: any) => [v.review_id, v.vote]));
        }

        return res.json({
            ok: true,
            data: (data || []).map((r: any) => ({ ...r, my_vote: userVotes[r.id] || null })),
            total: count || 0,
        });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// GET /api/v1/marketplace/products/:id/questions
router.get('/marketplace/products/:id/questions', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { data, error, count } = await supabase
            .from('product_questions')
            .select(`
                id, question, vendor_answer, vendor_answered_at, helpful_count, created_at, user_id,
                profiles!product_questions_user_id_fkey(full_name, avatar_url)
            `, { count: 'exact' })
            .eq('product_id', id)
            .eq('status', 'published')
            .order('vendor_answered_at', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error obteniendo Q&A.' });
        }
        return res.json({ ok: true, data: data || [], total: count || 0 });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// GET /api/v1/marketplace/vendors/:profileId/reviews
router.get('/marketplace/vendors/:profileId/reviews', async (req: Request, res: Response) => {
    try {
        const { profileId } = req.params;
        const { data, error, count } = await supabase
            .from('vendor_reviews')
            .select(`
                id, rating, shipping_rating, service_rating, body, is_verified, created_at, user_id,
                profiles!vendor_reviews_user_id_fkey(full_name, avatar_url)
            `, { count: 'exact' })
            .eq('vendor_profile_id', profileId)
            .eq('status', 'published')
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error obteniendo reviews del vendor.' });
        }
        return res.json({ ok: true, data: data || [], total: count || 0 });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTENTICADO desde aqui
// ─────────────────────────────────────────────────────────────────────────────
const authRouter = Router();
authRouter.use(requireMarketplaceAuth);

// GET /api/v1/reviews/products/:id/can-review
authRouter.get('/reviews/products/:id/can-review', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase.rpc('can_review_product', { p_product_id: id });
        if (error) {
            return res.status(500).json({ ok: false, error: 'Error verificando elegibilidad.' });
        }
        return res.json({ ok: true, ...data });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// POST /api/v1/reviews/products/:id — crear review
authRouter.post('/reviews/products/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const parsed = reviewCreateSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ ok: false, error: 'Body invalido.', issues: parsed.error.format() });
        }
        const { media_urls, ...reviewData } = parsed.data;

        const { data, error } = await supabase
            .from('product_reviews')
            .insert({
                product_id: id,
                user_id:    req.user.id,
                ...reviewData,
            })
            .select()
            .single();

        if (error) {
            // RLS niega si no es verified purchase
            if (error.code === '42501') {
                return res.status(403).json({ ok: false, error: 'Solo compradores con orden entregada pueden reseñar este producto.' });
            }
            // 1 review por user/product
            if (error.code === '23505') {
                return res.status(409).json({ ok: false, error: 'Ya dejaste una review para este producto.' });
            }
            req.log?.error({ err: error }, 'Error creando review');
            return res.status(500).json({ ok: false, error: 'Error creando review.' });
        }

        // Insertar media si vino
        if (media_urls && media_urls.length > 0) {
            await supabase.from('product_review_media').insert(
                media_urls.map((url, idx) => ({
                    review_id: data.id,
                    type:      'image',
                    url,
                    sort_order: idx,
                })),
            );
        }

        await auditLog(req, 'review_create', 'product_reviews', data.id);
        return res.status(201).json({ ok: true, data });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// PATCH /api/v1/reviews/:id — autor edita dentro de 24h
authRouter.patch('/reviews/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const parsed = reviewUpdateSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ ok: false, error: 'Body invalido.' });
        }
        const { media_urls: _omit, ...updates } = parsed.data;

        const { data, error } = await supabase
            .from('product_reviews')
            .update(updates)
            .eq('id', id)
            .eq('user_id', req.user.id)
            .select()
            .single();

        if (error || !data) {
            // RLS bloquea si pasaron 24h
            return res.status(403).json({ ok: false, error: 'No puedes editar esta review (puede que hayan pasado más de 24h).' });
        }

        await auditLog(req, 'review_update', 'product_reviews', id as string);
        return res.json({ ok: true, data });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// DELETE /api/v1/reviews/:id — autor o admin
authRouter.delete('/reviews/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('product_reviews')
            .delete()
            .eq('id', id)
            .eq('user_id', req.user.id);

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error eliminando review.' });
        }
        await auditLog(req, 'review_delete', 'product_reviews', id as string);
        return res.json({ ok: true });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// POST /api/v1/reviews/:id/vote — helpful / unhelpful (upsert)
authRouter.post('/reviews/:id/vote', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const parsed = voteSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ ok: false, error: 'vote debe ser helpful | unhelpful.' });
        }

        const { error } = await supabase
            .from('product_review_votes')
            .upsert({
                review_id: id,
                user_id:   req.user.id,
                vote:      parsed.data.vote,
            }, { onConflict: 'review_id,user_id' });

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error votando.' });
        }
        return res.json({ ok: true });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// POST /api/v1/reviews/:id/flag — reportar para moderacion admin
// Implementacion: registra el flag en audit_log con detalle del motivo.
// El admin revisa via /admin/marketplace/moderation y decide hide/remove.
authRouter.post('/reviews/:id/flag', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const reason: string = (req.body?.reason || 'no_reason').toString().slice(0, 200);

        // Marcar review como flagged si aun no esta
        await supabase
            .from('product_reviews')
            .update({ status: 'flagged' })
            .eq('id', id)
            .eq('status', 'published');

        await auditLog(req, 'review_flag', 'product_reviews', id as string, null, { reason });
        return res.json({ ok: true, message: 'Reporte recibido. Un admin revisará.' });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// POST /api/v1/reviews/:id/respond — vendor responde
authRouter.post('/reviews/:id/respond', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const parsed = respondSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ ok: false, error: 'response es requerida.' });
        }

        const { data, error } = await supabase
            .from('product_reviews')
            .update({
                vendor_response:     parsed.data.response,
                vendor_responded_at: new Date().toISOString(),
                vendor_responded_by: req.user.id,
            })
            .eq('id', id)
            .select(`id, product_id, products!inner(vendor_id)`)
            .single();

        if (error || !data) {
            return res.status(404).json({ ok: false, error: 'Review no encontrada o no eres el vendor.' });
        }

        await auditLog(req, 'review_respond', 'product_reviews', id as string);
        return res.json({ ok: true, data });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Q&A
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/v1/questions/products/:id
authRouter.post('/questions/products/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const parsed = questionSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ ok: false, error: 'question debe tener al menos 5 caracteres.' });
        }
        const { data, error } = await supabase
            .from('product_questions')
            .insert({
                product_id: id,
                user_id:    req.user.id,
                question:   parsed.data.question,
            })
            .select()
            .single();

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error publicando pregunta.' });
        }
        await auditLog(req, 'question_create', 'product_questions', data.id);
        return res.status(201).json({ ok: true, data });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// POST /api/v1/questions/:id/answer — vendor responde
authRouter.post('/questions/:id/answer', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const parsed = answerSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ ok: false, error: 'answer es requerida.' });
        }

        const { data, error } = await supabase
            .from('product_questions')
            .update({
                vendor_answer:      parsed.data.answer,
                vendor_answered_at: new Date().toISOString(),
                vendor_answered_by: req.user.id,
            })
            .eq('id', id)
            .select()
            .single();

        if (error || !data) {
            return res.status(404).json({ ok: false, error: 'Pregunta no encontrada o no tienes permiso.' });
        }
        await auditLog(req, 'question_answer', 'product_questions', id as string);
        return res.json({ ok: true, data });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// VENDOR REVIEWS
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/v1/vendor-reviews/:vendorProfileId
authRouter.post('/vendor-reviews/:vendorProfileId', async (req: Request, res: Response) => {
    try {
        const { vendorProfileId } = req.params;
        const parsed = vendorReviewSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ ok: false, error: 'Body invalido.' });
        }

        const { data, error } = await supabase
            .from('vendor_reviews')
            .insert({
                vendor_profile_id: vendorProfileId,
                user_id:           req.user.id,
                is_verified:       true,
                ...parsed.data,
            })
            .select()
            .single();

        if (error) {
            if (error.code === '42501') {
                return res.status(403).json({ ok: false, error: 'Solo compradores pueden reseñar al vendor.' });
            }
            if (error.code === '23505') {
                return res.status(409).json({ ok: false, error: 'Ya reseñaste a este vendor por esta orden.' });
            }
            return res.status(500).json({ ok: false, error: 'Error creando review de vendor.' });
        }
        await auditLog(req, 'vendor_review_create', 'vendor_reviews', data.id);
        return res.status(201).json({ ok: true, data });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// VENDOR INBOX
// GET /api/v1/vendor/inbox — reviews y preguntas pendientes del vendor logueado
// ─────────────────────────────────────────────────────────────────────────────

authRouter.get('/vendor/inbox', async (req: Request, res: Response) => {
    try {
        // Reviews sin respuesta (rating <= 3 prioritarias)
        const { data: reviews } = await supabase
            .from('product_reviews')
            .select(`
                id, rating, title, body, sport_used_for, level, created_at, vendor_responded_at,
                product_id,
                products!inner(id, name, image_url, vendor_id)
            `)
            .is('vendor_responded_at', null)
            .eq('status', 'published')
            .eq('products.vendor_id', req.user.id)
            .order('rating', { ascending: true })
            .order('created_at', { ascending: false })
            .limit(50);

        // Preguntas sin responder
        const { data: questions } = await supabase
            .from('product_questions')
            .select(`
                id, question, created_at,
                product_id,
                products!inner(id, name, image_url, vendor_id)
            `)
            .is('vendor_answered_at', null)
            .eq('status', 'published')
            .eq('products.vendor_id', req.user.id)
            .order('created_at', { ascending: false })
            .limit(50);

        return res.json({
            ok: true,
            data: {
                pending_reviews:   reviews || [],
                pending_questions: questions || [],
                counts: {
                    reviews:   reviews?.length || 0,
                    questions: questions?.length || 0,
                },
            },
        });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// Mount autenticado sobre el router principal
router.use(authRouter);

export default router;
