import { Router, Request, Response, NextFunction } from 'express';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole } from '../middlewares/authMiddleware';
import { resolveSchoolBranding } from '../utils/schoolBrandingResolver';

const router = Router();

const ParamId = z.object({ id: z.string().uuid() });

const LEGAL_TEXT =
    'Declaro haber recibido a conformidad los elementos descritos, me comprometo a darles ' +
    'uso adecuado, custodiarlos y devolverlos en el estado recibido, salvo el deterioro normal ' +
    'por uso. En caso de pérdida o daño por negligencia, respondo por su reposición según las ' +
    'políticas de la escuela.';

function fmtDateTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' });
}
function fmtDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Descarga (service role) una foto del bucket privado equipment-photos. */
async function downloadPhoto(path: string | null): Promise<Buffer | null> {
    if (!path) return null;
    try {
        const { data, error } = await supabase.storage.from('equipment-photos').download(path);
        if (error || !data) return null;
        return Buffer.from(await data.arrayBuffer());
    } catch {
        return null;
    }
}

async function generateActaPdf(opts: {
    assignment: any;
    school: any;
    accent: string;
    adminName: string | null;
    checkoutPhoto: Buffer | null;
    returns: any[];
}): Promise<Buffer> {
    const { assignment: a, school, accent, adminName, checkoutPhoto, returns } = opts;
    const snap = a.content_snapshot ?? {};
    const coachName = snap?.coach?.full_name ?? '—';
    const item = snap?.item ?? {};
    const schoolName = school?.name ?? snap?.school?.name ?? 'Dotación';

    return await new Promise<Buffer>((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 60 });
        const chunks: Buffer[] = [];
        doc.on('data', (c) => chunks.push(c as Buffer));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header band
        doc.rect(0, 0, doc.page.width, 90).fill(accent);
        doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold')
            .text(schoolName, 60, 30, { width: doc.page.width - 120 });
        doc.fontSize(10).font('Helvetica')
            .text(`FOLIO: ${a.acta_folio ?? '—'}`, doc.page.width - 240, 40, { width: 180, align: 'right' });

        doc.fillColor('#000000').moveDown(4);
        doc.fontSize(16).font('Helvetica-Bold').text('Acta de entrega de dotación', { align: 'center' });
        doc.moveDown(1);

        // Datos del entrenador
        doc.fontSize(11).font('Helvetica-Bold').text('Entrenador: ', { continued: true })
            .font('Helvetica').text(coachName);
        if (snap?.branch) {
            doc.font('Helvetica-Bold').text('Sede: ', { continued: true }).font('Helvetica').text(snap.branch);
        }
        doc.moveDown(0.8);

        // Tabla simple: ítem / talla / cantidad / condición
        doc.font('Helvetica-Bold').fontSize(11).text('Elementos entregados');
        doc.moveDown(0.3);
        doc.font('Helvetica').fontSize(10);
        doc.text(`• ${item.name ?? '—'}${item.size ? ` (talla ${item.size})` : ''} — cantidad: ${a.quantity} — condición al entregar: ${item.condition ?? '—'}`);
        doc.moveDown(1);

        // Texto legal
        doc.fontSize(10.5).font('Helvetica').text(LEGAL_TEXT, { align: 'justify', lineGap: 3 });
        doc.moveDown(1);

        // Sello digital según modo
        let seal: string;
        if (a.mode === 'self_checkout') {
            seal = `Registrado por el propio entrenador el ${fmtDateTime(a.delivered_at)} con evidencia fotográfica, ` +
                `aprobado por ${adminName ?? 'la administración'} el ${fmtDateTime(a.entrega_approved_at)} vía SportMaps.`;
        } else {
            seal = `Aceptado digitalmente por ${coachName} el ${fmtDateTime(a.accepted_at)} vía SportMaps.`;
        }
        doc.fontSize(9.5).font('Helvetica-Oblique').fillColor('#374151').text(seal, { align: 'left' });
        doc.fillColor('#000000').moveDown(1);

        // Foto de entrega embebida
        if (checkoutPhoto) {
            try {
                doc.fontSize(9).font('Helvetica-Bold').text('Evidencia de entrega:');
                doc.moveDown(0.3);
                doc.image(checkoutPhoto, { fit: [200, 200] });
            } catch { /* imagen inválida: se omite */ }
        }

        // Footer folio
        doc.fontSize(7).fillColor('#6b7280').font('Helvetica')
            .text(`Folio único: ${a.acta_folio ?? '—'} · Generado el ${fmtDate(new Date().toISOString())}`,
                60, doc.page.height - 55, { width: doc.page.width - 120, align: 'center' });

        // ── Segunda página: acta de devolución (si hay devoluciones aprobadas) ──
        const approved = (returns ?? []).filter((r) => r.status === 'aprobada');
        if (approved.length > 0) {
            doc.addPage();
            doc.rect(0, 0, doc.page.width, 90).fill(accent);
            doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold')
                .text('Acta de devolución', 60, 34, { width: doc.page.width - 120 });
            doc.fillColor('#000000').moveDown(4);
            doc.fontSize(11).font('Helvetica-Bold').text(`Folio: ${a.acta_folio ?? '—'}`);
            doc.font('Helvetica-Bold').text('Entrenador: ', { continued: true }).font('Helvetica').text(coachName);
            doc.moveDown(0.8);

            doc.font('Helvetica').fontSize(10);
            for (const r of approved) {
                doc.text(`• ${r.quantity} und — estado: ${r.condition} — aprobada el ${fmtDate(r.approved_at)}`);
            }
            const returnedTotal = approved.reduce((s, r) => s + Number(r.quantity || 0), 0);
            const missing = Number(a.quantity) - returnedTotal;
            doc.moveDown(0.8).font('Helvetica-Bold')
                .text(`Total devuelto: ${returnedTotal} de ${a.quantity}${missing > 0 ? ` · Faltante: ${missing}` : ''}`);

            doc.fontSize(7).fillColor('#6b7280').font('Helvetica')
                .text(`Folio único: ${a.acta_folio ?? '—'}`, 60, doc.page.height - 55,
                    { width: doc.page.width - 120, align: 'center' });
        }

        doc.end();
    });
}

// ============================================================================
// POST /api/v1/equipment/assignments/:id/acta-pdf
//   Genera (o regenera) el acta y setea acta_pdf_url. Admin de la escuela o el
//   propio entrenador (tras aceptar). Reusa el patrón del renderer de constancias.
// ============================================================================
router.post(
    '/:id/acta-pdf',
    requireAuth,
    requireRole('admin', 'owner', 'school_admin', 'school', 'coach'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const parse = ParamId.safeParse(req.params);
            if (!parse.success) return res.status(400).json({ error: 'invalid_id' });
            const assignmentId = parse.data.id;

            const { data: a, error: aErr } = await supabase
                .from('equipment_assignments')
                .select('*')
                .eq('id', assignmentId)
                .single();
            if (aErr || !a) return res.status(404).json({ error: 'assignment_not_found' });

            // Cross-tenant + ownership guard
            if (a.school_id !== req.schoolId) {
                return res.status(403).json({ error: 'forbidden_other_school' });
            }
            const isAdmin = ['admin', 'owner', 'school_admin', 'school', 'super_admin'].includes(req.role);
            const isOwnerCoach = a.assigned_to === req.user.id;
            if (!isAdmin && !isOwnerCoach) return res.status(403).json({ error: 'forbidden' });

            // Requiere estar ACTIVA o CERRADA (folio ya generado al activar)
            if (!a.acta_folio || !['activa', 'cerrada'].includes(a.status)) {
                return res.status(409).json({
                    error: 'acta_not_ready',
                    detail: `status=${a.status}, folio=${a.acta_folio ?? 'null'}. Debe estar activa/cerrada.`,
                });
            }

            const [{ data: school }, { data: returns }] = await Promise.all([
                supabase.from('schools').select('id, name, slug, logo_url, branding_settings').eq('id', a.school_id).single(),
                supabase.from('equipment_returns').select('quantity, condition, status, approved_at').eq('assignment_id', assignmentId),
            ]);

            let adminName: string | null = null;
            if (a.entrega_approved_by) {
                const { data: p } = await supabase.from('profiles').select('full_name').eq('id', a.entrega_approved_by).single();
                adminName = p?.full_name ?? null;
            }

            const branding = await resolveSchoolBranding(a.school_id);
            const checkoutPhoto = await downloadPhoto(a.checkout_photo_url);

            const pdfBuffer = await generateActaPdf({
                assignment: a,
                school,
                accent: branding.primaryColor,
                adminName,
                checkoutPhoto,
                returns: returns ?? [],
            });

            const objectPath = `dotacion/${a.school_id}/${assignmentId}.pdf`;
            const { error: upErr } = await supabase.storage
                .from('certificates')
                .upload(objectPath, pdfBuffer, { contentType: 'application/pdf', upsert: true });
            if (upErr) {
                req.log?.error({ err: upErr, objectPath }, 'Acta upload failed');
                return res.status(500).json({ error: 'acta_upload_failed', detail: upErr.message });
            }

            // Service role: update directo (el RPC exige auth.uid de admin)
            const { error: updErr } = await supabase
                .from('equipment_assignments')
                .update({ acta_pdf_url: objectPath })
                .eq('id', assignmentId);
            if (updErr) return res.status(500).json({ error: 'acta_url_update_failed' });

            return res.json({ ok: true, assignment_id: assignmentId, folio: a.acta_folio, pdf_path: objectPath });
        } catch (err) {
            next(err);
        }
    }
);

// ============================================================================
// GET /api/v1/equipment/assignments/:id/acta-signed-url
//   URL firmada (10 min) del acta. Admin de la escuela o el entrenador dueño.
// ============================================================================
router.get(
    '/:id/acta-signed-url',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const parse = ParamId.safeParse(req.params);
            if (!parse.success) return res.status(400).json({ error: 'invalid_id' });
            const assignmentId = parse.data.id;

            const { data: a, error: aErr } = await supabase
                .from('equipment_assignments')
                .select('id, school_id, assigned_to, acta_pdf_url')
                .eq('id', assignmentId)
                .single();
            if (aErr || !a || !a.acta_pdf_url) return res.status(404).json({ error: 'acta_not_found' });

            const isAdmin = ['admin', 'owner', 'school_admin', 'school', 'super_admin'].includes(req.role)
                && a.school_id === req.schoolId;
            const isOwnerCoach = a.assigned_to === req.user.id;
            if (!isAdmin && !isOwnerCoach) return res.status(403).json({ error: 'forbidden' });

            const { data: signed, error: signErr } = await supabase.storage
                .from('certificates')
                .createSignedUrl(a.acta_pdf_url, 600);
            if (signErr || !signed) return res.status(500).json({ error: 'sign_failed', detail: signErr?.message });

            return res.json({ ok: true, url: signed.signedUrl, expires_in: 600 });
        } catch (err) {
            next(err);
        }
    }
);

export default router;
