import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://app.sportmaps.co';
const DEFAULT_IMAGE = `${FRONTEND_URL}/og-image.png`;

/**
 * Server-Side Rendered Open Graph preview pages.
 * Cuando un crawler de redes sociales (WhatsApp, Facebook, Twitter)
 * visita este URL, recibe HTML con meta tags OG.
 * El usuario real es redirigido al frontend SPA.
 */

// ─────────────────────────────────────────────────────────────────────────────
// GET /share/product/:id — OG preview para productos
// ─────────────────────────────────────────────────────────────────────────────
router.get('/product/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userAgent = (req.headers['user-agent'] || '').toLowerCase();

        // Detectar si es un bot/crawler de redes sociales
        const isCrawler = /facebookexternalhit|twitterbot|whatsapp|linkedinbot|slackbot|telegrambot|pinterest|discordbot/i.test(userAgent);

        // Si es un usuario real, redirigir al frontend
        if (!isCrawler) {
            return res.redirect(301, `${FRONTEND_URL}/marketplace/product/${id}`);
        }

        const { data: product } = await supabase
            .from('products')
            .select('name, description, price, image_url, category, vendor_id')
            .eq('id', id)
            .eq('active', true)
            .maybeSingle();

        if (!product) {
            return res.redirect(301, `${FRONTEND_URL}/marketplace`);
        }

        // Obtener vendor name
        let vendorName = 'SportMaps';
        const { data: vendor } = await supabase
            .from('vendor_profiles')
            .select('display_name')
            .eq('user_id', product.vendor_id)
            .maybeSingle();
        if (vendor) vendorName = vendor.display_name;

        const title = product.name;
        const description = product.description
            ? product.description.slice(0, 200)
            : `$${product.price.toLocaleString('es-CO')} COP - por ${vendorName} en SportMaps`;
        const image = product.image_url || DEFAULT_IMAGE;
        const url = `${FRONTEND_URL}/marketplace/product/${id}`;
        const priceFormatted = `$${Number(product.price).toLocaleString('es-CO')} COP`;

        return res.send(renderOgHtml({
            title: `${title} - ${priceFormatted}`,
            description,
            image,
            url,
            type: 'product',
            price: priceFormatted,
            siteName: 'SportMaps Marketplace',
        }));
    } catch (err) {
        return res.redirect(301, `${FRONTEND_URL}/marketplace`);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /share/service/:id — OG preview para servicios
// ─────────────────────────────────────────────────────────────────────────────
router.get('/service/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userAgent = (req.headers['user-agent'] || '').toLowerCase();

        const isCrawler = /facebookexternalhit|twitterbot|whatsapp|linkedinbot|slackbot|telegrambot|pinterest|discordbot/i.test(userAgent);

        if (!isCrawler) {
            return res.redirect(301, `${FRONTEND_URL}/marketplace/service/${id}`);
        }

        const { data: service } = await supabase
            .from('service_listings')
            .select('name, description, price, image_url, service_type, duration_minutes, vendor_profile_id')
            .eq('id', id)
            .eq('is_active', true)
            .maybeSingle();

        if (!service) {
            return res.redirect(301, `${FRONTEND_URL}/marketplace`);
        }

        let vendorName = 'SportMaps';
        const { data: vendor } = await supabase
            .from('vendor_profiles')
            .select('display_name')
            .eq('id', service.vendor_profile_id)
            .maybeSingle();
        if (vendor) vendorName = vendor.display_name;

        const title = service.name;
        const description = service.description
            ? service.description.slice(0, 200)
            : `${service.service_type} - ${service.duration_minutes} min - por ${vendorName}`;
        const image = service.image_url || DEFAULT_IMAGE;
        const url = `${FRONTEND_URL}/marketplace/service/${id}`;
        const priceFormatted = `$${Number(service.price).toLocaleString('es-CO')} COP`;

        return res.send(renderOgHtml({
            title: `${title} - ${priceFormatted}`,
            description: `${description} | ${service.duration_minutes} min`,
            image,
            url,
            type: 'service',
            price: priceFormatted,
            siteName: 'SportMaps Marketplace',
        }));
    } catch (err) {
        return res.redirect(301, `${FRONTEND_URL}/marketplace`);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /share/vendor/:slug — OG preview para perfil de vendedor
// ─────────────────────────────────────────────────────────────────────────────
router.get('/vendor/:slug', async (req: Request, res: Response) => {
    try {
        const { slug } = req.params;
        const userAgent = (req.headers['user-agent'] || '').toLowerCase();

        const isCrawler = /facebookexternalhit|twitterbot|whatsapp|linkedinbot|slackbot|telegrambot|pinterest|discordbot/i.test(userAgent);

        if (!isCrawler) {
            return res.redirect(301, `${FRONTEND_URL}/vendor/${slug}`);
        }

        const { data: vendor } = await supabase
            .from('vendor_profiles')
            .select('display_name, description, logo_url, city, vendor_type')
            .eq('slug', slug)
            .eq('is_active', true)
            .maybeSingle();

        if (!vendor) {
            return res.redirect(301, `${FRONTEND_URL}/marketplace`);
        }

        const typeLabel = vendor.vendor_type === 'wellness' ? 'Profesional de Salud'
            : vendor.vendor_type === 'school' ? 'Escuela Deportiva'
            : 'Tienda';

        return res.send(renderOgHtml({
            title: `${vendor.display_name} - ${typeLabel}`,
            description: vendor.description || `${typeLabel} en SportMaps${vendor.city ? ` - ${vendor.city}` : ''}`,
            image: vendor.logo_url || DEFAULT_IMAGE,
            url: `${FRONTEND_URL}/vendor/${slug}`,
            type: 'profile',
            siteName: 'SportMaps Marketplace',
        }));
    } catch (err) {
        return res.redirect(301, `${FRONTEND_URL}/marketplace`);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper: render HTML con Open Graph meta tags
// ─────────────────────────────────────────────────────────────────────────────
function renderOgHtml(opts: {
    title: string;
    description: string;
    image: string;
    url: string;
    type: string;
    price?: string;
    siteName: string;
}): string {
    const escaped = {
        title: escapeHtml(opts.title),
        description: escapeHtml(opts.description),
        image: escapeHtml(opts.image),
        url: escapeHtml(opts.url),
        siteName: escapeHtml(opts.siteName),
        price: opts.price ? escapeHtml(opts.price) : '',
    };

    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escaped.title} | ${escaped.siteName}</title>
    <meta name="description" content="${escaped.description}">

    <!-- Open Graph -->
    <meta property="og:type" content="${opts.type === 'product' ? 'product' : 'website'}">
    <meta property="og:title" content="${escaped.title}">
    <meta property="og:description" content="${escaped.description}">
    <meta property="og:image" content="${escaped.image}">
    <meta property="og:url" content="${escaped.url}">
    <meta property="og:site_name" content="${escaped.siteName}">
    <meta property="og:locale" content="es_CO">
    ${escaped.price ? `<meta property="product:price:amount" content="${escaped.price}">
    <meta property="product:price:currency" content="COP">` : ''}

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escaped.title}">
    <meta name="twitter:description" content="${escaped.description}">
    <meta name="twitter:image" content="${escaped.image}">

    <!-- WhatsApp specific -->
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">

    <!-- Redirect to SPA -->
    <meta http-equiv="refresh" content="0;url=${escaped.url}">
    <link rel="canonical" href="${escaped.url}">
</head>
<body>
    <p>Redirigiendo a <a href="${escaped.url}">${escaped.title}</a>...</p>
</body>
</html>`;
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export default router;
