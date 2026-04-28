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
            const qrPng = await QRCode.toBuffer(publicUrl, { width: 600, margin: 1 });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${qr.slug}-poster.pdf"`);

            const doc = new PDFDocument({ size: 'A4', margin: 40 });
            doc.pipe(res);

            const branding: any = school?.branding_settings ?? {};
            const accent: string = branding.primary_color || '#0ea5e9';

            // Banda superior
            doc.rect(0, 0, doc.page.width, 110).fill(accent);

            // Logo
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

            doc.fillColor('#ffffff')
                .fontSize(22).font('Helvetica-Bold')
                .text(school?.name ?? 'Inscríbete', 120, 38, {
                    width: doc.page.width - 160, align: 'left',
                });
            doc.fontSize(11).font('Helvetica')
                .text('Inscripciones abiertas', 120, 70, { width: doc.page.width - 160 });

            doc.fillColor('#000000');
            doc.moveDown(5);

            // Titulo principal
            doc.fontSize(28).font('Helvetica-Bold').text('¡Únete escaneando!', { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(14).font('Helvetica').fillColor('#374151')
                .text(qr.intro_text ?? `Escanea el código y completa tu inscripción a ${school?.name ?? 'la escuela'}.`,
                      { align: 'center', width: doc.page.width - 120 });

            // QR centrado grande
            const qrSize = 320;
            const qrX = (doc.page.width - qrSize) / 2;
            doc.image(qrPng, qrX, doc.y + 30, { width: qrSize, height: qrSize });

            // URL textual debajo
            doc.fontSize(10).fillColor('#6b7280').font('Helvetica')
                .text(publicUrl, 0, doc.y + qrSize + 50, { align: 'center', width: doc.page.width });

            // Footer marca
            doc.fontSize(9).fillColor('#9ca3af')
                .text('Powered by SportMaps · ' + (qr.name || qr.slug), 0, doc.page.height - 50,
                      { align: 'center', width: doc.page.width });

            doc.end();
        } catch (err) {
            next(err);
        }
    }
);

export default router;
