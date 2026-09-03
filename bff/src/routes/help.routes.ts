import { Router, Request, Response } from 'express';
import {
    helpArticles,
    helpCategories,
    getArticleBySlug,
    getRelatedArticles,
} from '../data/help-articles';

const router = Router();

/**
 * GET /api/v1/help/categories
 * Publico, sin auth: catalogo de categorias del Centro de Ayuda.
 */
router.get('/categories', (_req: Request, res: Response) => {
    res.json({ categories: helpCategories });
});

/**
 * GET /api/v1/help/articles
 * Publico, sin auth. Query params opcionales: categoryId, role, q (busqueda simple).
 */
router.get('/articles', (req: Request, res: Response) => {
    const { categoryId, role, q } = req.query as { categoryId?: string; role?: string; q?: string };

    let list = helpArticles;
    if (categoryId) {
        list = list.filter((a) => a.categoryId === categoryId);
    }
    if (role) {
        list = list.filter((a) => a.targetRole.includes('all' as any) || a.targetRole.includes(role as any));
    }
    if (q) {
        const needle = q.toLowerCase();
        list = list.filter(
            (a) => a.title.toLowerCase().includes(needle) || a.excerpt.toLowerCase().includes(needle)
        );
    }

    // No mandamos el body completo en el listado, solo lo necesario para tarjetas.
    const summaries = list.map(({ slug, categoryId, title, excerpt, readTime, targetRole }) => ({
        slug,
        categoryId,
        title,
        excerpt,
        readTime,
        targetRole,
    }));
    res.json({ articles: summaries });
});

/**
 * GET /api/v1/help/articles/:slug
 * Publico, sin auth: articulo completo con su body y relacionados.
 */
router.get('/articles/:slug', (req: Request, res: Response) => {
    const article = getArticleBySlug(String(req.params.slug));
    if (!article) {
        res.status(404).json({ error: 'Articulo no encontrado' });
        return;
    }
    const related = getRelatedArticles(article.related ?? []).map(
        ({ slug, title, excerpt, readTime, categoryId }) => ({ slug, title, excerpt, readTime, categoryId })
    );
    res.json({ article, related });
});

export default router;
