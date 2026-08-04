import { Router, Request, Response, NextFunction } from 'express';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole } from '../middlewares/authMiddleware';

const router = Router();

const ParamSlug = z.object({ slug: z.string().min(3).max(120) });

// ============================================================================
// GET /api/v1/join-qr/:slug/poster.pdf
//   Devuelve un PDF imprimible (A4) con el QR escaneable + branding de la
//   escuela. Pensado para descargar e imprimir como flyer/poster.
//   Auth: cualquier usuario autenticado puede generarlo (es publico el destino).
// ============================================================================
router.get(
    '/:slug/poster.pdf',
    requireAuth,
    requireRole('admin', 'owner', 'school_admin', 'school'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const parse = ParamSlug.safeParse(req.params);
            if (!parse.success) {
                return res.status(400).json({ error: 'invalid_slug' });
            }
            const slug = parse.data.slug;

            // Verifica QR + autorizacion (debe ser admin de la misma escuela)
            const { data: qr, error: qrErr } = await supabase
                .from('school_join_qr_codes')
                .select('id, school_id, slug, name, intro_text, active')
                .eq('slug', slug)
                .single();

            if (qrErr || !qr) {
                return res.status(404).json({ error: 'qr_not_found' });
            }
            if (qr.school_id !== req.schoolId) {
                return res.status(403).json({ error: 'forbidden_other_school' });
            }

            const { data: school } = await supabase
                .from('schools')
                .select('id, name, logo_url, branding_settings')
                .eq('id', qr.school_id)
                .single();

            const origin = (process.env.FRONTEND_URL || req.headers.origin || 'https://sportmaps.com')
                .toString()
                .replace(/\/$/, '');
            const publicUrl = `${origin}/join/${qr.slug}`;
            // QR hi-res + nivel H (robusto, soporta impresión grande sin pixelar)
            const qrPng = await QRCode.toBuffer(publicUrl, { width: 1000, margin: 1, errorCorrectionLevel: 'H' });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${qr.slug}-poster.pdf"`);

            const doc = new PDFDocument({ size: 'A4', margin: 40 });
            doc.pipe(res);

            const W = doc.page.width;
            const H = doc.page.height;
            const branding: any = school?.branding_settings ?? {};
            const accent: string = branding.primary_color || '#248223';
            const secondary: string = branding.secondary_color || '#FB9F1E';
            const showWatermark: boolean = branding.show_sportmaps_watermark !== false;

            // ── Banda superior (color principal de la escuela) ──
            doc.rect(0, 0, W, 110).fill(accent);

            // Logo de la escuela
            if (school?.logo_url) {
                try {
                    const r = await fetch(school.logo_url);
                    if (r.ok) {
                        const buf = Buffer.from(await r.arrayBuffer());
                        doc.image(buf, 40, 25, { width: 60, height: 60 });
                    }
                } catch {
                    /* ignore */
                }
            }
            doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold')
                .text(school?.name ?? 'Inscríbete', 120, 38, { width: W - 160, align: 'left' });
            doc.fontSize(11).font('Helvetica')
                .text('Inscripciones abiertas', 120, 72, { width: W - 160 });

            // ── Cuerpo con posiciones ABSOLUTAS → garantiza UNA sola página ──
            doc.fillColor('#111827').fontSize(28).font('Helvetica-Bold')
                .text('¡Únete escaneando!', 40, 160, { width: W - 80, align: 'center' });

            // intro_text acotado (height + ellipsis) para que un texto largo NO
            // empuje el contenido a una segunda página.
            doc.fillColor('#374151').fontSize(14).font('Helvetica')
                .text(
                    qr.intro_text ?? `Escanea el código y completa tu inscripción a ${school?.name ?? 'la escuela'}.`,
                    60, 205, { width: W - 120, align: 'center', height: 70, ellipsis: true },
                );

            // QR centrado (posición y tamaño fijos)
            const qrSize = 300;
            doc.image(qrPng, (W - qrSize) / 2, 300, { width: qrSize, height: qrSize });

            // URL textual debajo del QR
            doc.fillColor('#6b7280').fontSize(10).font('Helvetica')
                .text(publicUrl, 40, 620, { width: W - 80, align: 'center' });

            // ── Banda inferior (color secundario) ──
            doc.rect(0, H - 24, W, 24).fill(secondary);

            // Footer — respeta el toggle de marca de agua de la escuela
            doc.fillColor('#9ca3af').fontSize(9).font('Helvetica')
                .text(
                    showWatermark ? ('Powered by SportMaps · ' + (qr.name || qr.slug)) : (qr.name || qr.slug),
                    40, H - 50, { width: W - 80, align: 'center' },
                );

            doc.end();
        } catch (err) {
            next(err);
        }
    }
);

export default router;
