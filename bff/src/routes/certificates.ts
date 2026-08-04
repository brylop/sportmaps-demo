import { Router, Request, Response, NextFunction } from 'express';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole } from '../middlewares/authMiddleware';
import { resolveSchoolBranding } from '../utils/schoolBrandingResolver';

const router = Router();

// ============================================================================
// Helpers
// ============================================================================

/**
 * Reemplaza variables en un texto: {{atleta.nombre}} -> snapshot.athlete.full_name
 */
function renderTemplate(template: string, vars: Record<string, any>): string {
    return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
        const parts = path.split('.');
        let v: any = vars;
        for (const p of parts) {
            if (v == null) return '';
            v = v[p];
        }
        return v == null ? '' : String(v);
    });
}

/**
 * Construye el diccionario de variables para el body_template del template.
 */
function buildVars(snapshot: any, cert: any, school: any) {
    const athlete = snapshot?.athlete ?? {};
    return {
        atleta: {
            nombre:    athlete.full_name ?? '',
            documento: athlete.doc_number ?? '',
            tipo_doc:  athlete.doc_type ?? '',
            fecha_nac: athlete.date_of_birth ?? '',
            genero:    athlete.gender ?? '',
        },
        escuela: {
            nombre: school?.name ?? snapshot?.school?.name ?? '',
        },
        equipo: snapshot?.team_name ?? '',
        sede:   snapshot?.branch_name ?? '',
        folio:  cert.folio,
        fecha_actual: new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }),
        inscripcion: {
            inicio:  snapshot?.enrollment?.start_date ?? '',
            estado:  snapshot?.enrollment?.status ?? '',
            vence:   snapshot?.enrollment?.expires_at ?? '',
        },
    };
}

/**
 * Genera el PDF de la constancia y devuelve el buffer.
 */
async function generateCertificatePdf(opts: {
    cert: any;
    template: any;
    snapshot: any;
    school: any;
    verifyUrl: string;
}): Promise<Buffer> {
    const { cert, template, snapshot, school, verifyUrl } = opts;
    const vars = buildVars(snapshot, cert, school);
    const body = renderTemplate(template.body_template ?? '', vars);
    const qrPng = await QRCode.toBuffer(verifyUrl, { width: 140, margin: 0 });

    // ── Resolver branding con feature gate por tier ──
    // resolveSchoolBranding aplica el mismo gate que emails/PDFs frontend:
    // - free tier      → defaults SportMaps (verde) y forzar watermark
    // - pro+/enterprise → branding propio (color, logo si lo hay)
    // Nota: school.name se preserva sanitizado en branding.schoolName, pero
    // como PDFKit no parsea HTML (es texto plano), volvemos a usar el name
    // del snapshot tal cual — PDFKit no es vulnerable a HTML injection.
    const branding = await resolveSchoolBranding(school?.id ?? null);
    const schoolNameForPdf = school?.name ?? snapshot?.school?.name ?? 'Constancia';

    return await new Promise<Buffer>((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 60 });
        const chunks: Buffer[] = [];
        doc.on('data', (c) => chunks.push(c as Buffer));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // ── Header band (color primario validado y con feature gate) ──
        const accent = branding.primaryColor; // ya validado hex en resolver
        doc.rect(0, 0, doc.page.width, 90).fill(accent);

        // School name (white on band)
        doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold')
           .text(schoolNameForPdf, 60, 32, {
                width: doc.page.width - 120, align: 'left',
            });

        // Folio (top right white)
        doc.fontSize(10).font('Helvetica')
           .text(`FOLIO: ${cert.folio}`, doc.page.width - 220, 38,
                 { width: 160, align: 'right' });

        // Reset for body
        doc.fillColor('#000000');
        doc.moveDown(4);

        // Title
        doc.fontSize(16).font('Helvetica-Bold').text(cert.title || template.title || '', { align: 'center' });
        doc.moveDown(1);

        // Body (rendered)
        doc.fontSize(11).font('Helvetica').text(body, { align: 'justify', lineGap: 4 });
        doc.moveDown(2);

        // Issued at
        const issuedAtStr = cert.issued_at
            ? new Date(cert.issued_at).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
            : new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
        doc.text(`Expedido el ${issuedAtStr}`, { align: 'right' });
        doc.moveDown(2);

        // Signature block
        if (template.signature_name || template.signature_title) {
            const startY = doc.y + 30;
            doc.moveTo(doc.page.width - 280, startY)
               .lineTo(doc.page.width - 60, startY)
               .strokeColor('#374151').lineWidth(0.7).stroke();
            doc.fontSize(10).font('Helvetica-Bold')
               .text(template.signature_name || '', doc.page.width - 280, startY + 6,
                     { width: 220, align: 'center' });
            if (template.signature_title) {
                doc.font('Helvetica')
                   .text(template.signature_title, doc.page.width - 280, doc.y,
                         { width: 220, align: 'center' });
            }
        }

        // QR + verification URL (bottom-left)
        const qrY = doc.page.height - 180;
        doc.image(qrPng, 60, qrY, { width: 90, height: 90 });
        doc.fontSize(8).font('Helvetica').fillColor('#374151')
           .text('Verifica este documento en:', 160, qrY + 10, { width: 320 });
        doc.font('Helvetica-Bold').text(verifyUrl, 160, qrY + 24, { width: 320 });
        doc.font('Helvetica').fillColor('#6b7280').fontSize(7)
           .text(`Folio único: ${cert.folio}`, 160, qrY + 60, { width: 320 });

        // Footer
        if (template.footer_text) {
            doc.fontSize(8).fillColor('#6b7280').font('Helvetica')
               .text(template.footer_text, 60, doc.page.height - 60,
                     { width: doc.page.width - 120, align: 'center' });
        }

        doc.end();
    });
}

// ============================================================================
// POST /api/v1/certificates/:id/generate-pdf  (admin escuela)
// ============================================================================
const ParamId = z.object({ id: z.string().uuid() });

router.post(
    '/:id/generate-pdf',
    requireAuth,
    requireRole('admin', 'owner', 'school_admin', 'school'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const parse = ParamId.safeParse(req.params);
            if (!parse.success) {
                return res.status(400).json({ error: 'invalid_id', issues: parse.error.issues });
            }
            const certificateId = parse.data.id;

            // 1) Cargar el certificate (service role bypass RLS, validamos manualmente abajo)
            const { data: cert, error: certErr } = await supabase
                .from('athlete_certificates')
                .select('*')
                .eq('id', certificateId)
                .single();

            if (certErr || !cert) {
                req.log?.warn({ err: certErr, certificateId }, 'Certificate not found');
                return res.status(404).json({ error: 'certificate_not_found' });
            }

            // Cross-tenant guard: usuario debe ser admin de la escuela del cert
            if (cert.school_id !== req.schoolId) {
                return res.status(403).json({ error: 'forbidden_other_school' });
            }

            if (cert.status !== 'issued') {
                return res.status(409).json({
                    error: 'certificate_not_issued',
                    detail: `Current status: ${cert.status}. Must be 'issued' to generate PDF.`,
                });
            }

            // 2) Cargar template + school
            const [{ data: template }, { data: school }] = await Promise.all([
                supabase.from('school_certificate_templates').select('*').eq('id', cert.template_id).single(),
                supabase.from('schools').select('id, name, slug, logo_url, branding_settings').eq('id', cert.school_id).single(),
            ]);

            if (!template) return res.status(500).json({ error: 'template_missing' });

            // 3) URL pública de verificación
            const origin = (process.env.FRONTEND_URL || req.headers.origin || 'https://sportmaps.com').toString().replace(/\/$/, '');
            const verifyUrl = `${origin}/cert/${cert.folio}`;

            // 4) Generar PDF
            const pdfBuffer = await generateCertificatePdf({
                cert, template, snapshot: cert.content_snapshot, school, verifyUrl,
            });

            // 5) Subir a Storage (path: schoolId/folio.pdf)
            const objectPath = `${cert.school_id}/${cert.folio}.pdf`;
            const { error: upErr } = await supabase.storage
                .from('certificates')
                .upload(objectPath, pdfBuffer, {
                    contentType: 'application/pdf',
                    upsert: true,
                });

            if (upErr) {
                req.log?.error({ err: upErr, objectPath }, 'PDF upload failed');
                return res.status(500).json({ error: 'pdf_upload_failed', detail: upErr.message });
            }

            // 6) Actualizar pdf_url
            const { error: updErr } = await supabase
                .from('athlete_certificates')
                .update({ pdf_url: objectPath })
                .eq('id', certificateId);

            if (updErr) {
                req.log?.error({ err: updErr }, 'Failed to set pdf_url');
                return res.status(500).json({ error: 'pdf_url_update_failed' });
            }

            return res.json({
                ok: true,
                certificate_id: certificateId,
                folio: cert.folio,
                pdf_path: objectPath,
                verify_url: verifyUrl,
            });
        } catch (err) {
            next(err);
        }
    }
);

// ============================================================================
// GET /api/v1/certificates/:id/signed-url  (autenticado: dueño/admin)
//   Devuelve una URL firmada de Supabase Storage (10 min) para descargar el PDF.
// ============================================================================
router.get(
    '/:id/signed-url',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const parse = ParamId.safeParse(req.params);
            if (!parse.success) {
                return res.status(400).json({ error: 'invalid_id' });
            }
            const certificateId = parse.data.id;

            const { data: cert, error: certErr } = await supabase
                .from('athlete_certificates')
                .select('id, school_id, child_id, profile_id, pdf_url, status')
                .eq('id', certificateId)
                .single();

            if (certErr || !cert || !cert.pdf_url) {
                return res.status(404).json({ error: 'certificate_or_pdf_not_found' });
            }

            // Authz: super-admin / school_admin de la escuela / atleta dueño / padre del child
            const isSuperAdmin = ['admin', 'super_admin'].includes(req.role);
            const isSchoolAdmin = ['owner', 'admin', 'school_admin', 'school'].includes(req.role)
                && cert.school_id === req.schoolId;
            const isAthleteOwner = cert.profile_id === req.user.id;

            let isParentOwner = false;
            if (cert.child_id && !isSuperAdmin && !isSchoolAdmin && !isAthleteOwner) {
                const { data: child } = await supabase
                    .from('children')
                    .select('parent_id')
                    .eq('id', cert.child_id)
                    .single();
                isParentOwner = child?.parent_id === req.user.id;
            }

            if (!isSuperAdmin && !isSchoolAdmin && !isAthleteOwner && !isParentOwner) {
                return res.status(403).json({ error: 'forbidden' });
            }

            const { data: signed, error: signErr } = await supabase.storage
                .from('certificates')
                .createSignedUrl(cert.pdf_url, 600);

            if (signErr || !signed) {
                return res.status(500).json({ error: 'sign_failed', detail: signErr?.message });
            }

            // Bump download counter
            await supabase.rpc('set_certificate_pdf_url' as any, {
                p_certificate_id: certificateId,
                p_pdf_url: cert.pdf_url,
            });

            return res.json({ ok: true, url: signed.signedUrl, expires_in: 600 });
        } catch (err) {
            next(err);
        }
    }
);

export default router;
