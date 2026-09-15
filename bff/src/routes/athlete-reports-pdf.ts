/**
 * F4 del Informe Mensual del Atleta — PDF al vuelo (spec §8.4, §15).
 *
 * El resto de F4 (lista + detalle interactivo + mark_report_viewed) ya estaba
 * construido en frontend/src/pages/Child{Reports,ReportDetail}Page.tsx — esto
 * era lo único que faltaba. Diseño alineado con saasInvoicePdf.service.ts
 * (fondo blanco, línea de acento fina, cajas con borde redondeado, footer
 * "Powered by SportMaps") en vez del look de certificates.ts (banda sólida) —
 * es el mismo patrón de marca condicional que ya usan los correos
 * (schoolBrandingResolver: logo propio si hay whitelabel, si no SportMaps).
 *
 * §8.4: "El snapshot es la única fuente de la vista del padre y del PDF."
 * Este archivo NO lee performance_entries ni recalcula nada — solo el jsonb
 * ya congelado al publicar.
 */
import { Router, Request, Response, NextFunction } from 'express';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { requireAuth } from '../middlewares/authMiddleware';
import { resolveSchoolBranding } from '../utils/schoolBrandingResolver';
import {
    INK, MUTED, HAIRLINE,
    loadSportmapsLogo, fetchSchoolLogo, fmt, capitalize,
    sectionTitle, noteBox, addFooterToAllPages,
} from '../utils/reportPdfHelpers';

const router = Router();

const BAND_HEX: Record<string, string> = { green: '#16a34a', yellow: '#d97706', red: '#dc2626' };
const CATEGORY_LABEL: Record<string, string> = {
    physical: 'Físico', technical: 'Técnico', tactical: 'Táctico', attendance: 'Asistencia', other: 'Otro',
};

async function isAuthorized(req: Request, report: any): Promise<boolean> {
    const userId = req.user!.id;

    if (report.recipient_id && report.recipient_id === userId) return true;
    if (report.subject_type === 'profile' && report.subject_id === userId) return true;
    if (report.subject_type === 'child') {
        const { data: child } = await supabase
            .from('children').select('parent_id').eq('id', report.subject_id).maybeSingle();
        if (child?.parent_id === userId) return true;
    }

    const staffRoles = ['owner', 'admin', 'school_admin', 'school', 'super_admin', 'coach'];
    if (staffRoles.includes(req.role)) {
        if (['super_admin', 'admin'].includes(req.role)) return true;
        const { data: staff } = await supabase
            .from('school_staff').select('id').eq('coach_auth_id', userId).eq('school_id', report.school_id).maybeSingle();
        if (staff) return true;
    }

    return false;
}

const ParamId = z.object({ id: z.string().uuid() });

// ============================================================================
// GET /api/v1/athlete-reports/:id/pdf
// ============================================================================
router.get(
    '/:id/pdf',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const parse = ParamId.safeParse(req.params);
            if (!parse.success) return res.status(400).json({ error: 'invalid_id' });

            const { data: report, error } = await supabase
                .from('athlete_reports' as any)
                .select('id, school_id, subject_type, subject_id, status, recipient_id, period_year, period_month, snapshot')
                .eq('id', parse.data.id)
                .maybeSingle();

            if (error || !report) return res.status(404).json({ error: 'report_not_found' });

            if ((report as any).status !== 'publicado') {
                return res.status(403).json({ error: 'report_not_published' });
            }

            if (!(await isAuthorized(req, report))) {
                return res.status(403).json({ error: 'forbidden' });
            }

            const snapshot = (report as any).snapshot;
            if (!snapshot) return res.status(409).json({ error: 'snapshot_missing' });

            const branding = await resolveSchoolBranding((report as any).school_id);
            const [sportmapsLogo, schoolLogo] = await Promise.all([
                Promise.resolve(loadSportmapsLogo()),
                fetchSchoolLogo(branding.logoUrl),
            ]);

            // bufferPages: el footer se dibuja al final sobre las páginas YA
            // creadas (switchToPage), no "al vuelo" mientras se escribe el
            // contenido -- escribir texto cerca del borde inferior dispara la
            // paginación automática de pdfkit y deja una página fantasma casi
            // en blanco con el footer duplicado (bug real, visto en QA).
            const doc = new PDFDocument({ size: 'A4', margin: 60, bufferPages: true });
            // No cachear: el snapshot puede regenerarse (snapshot_version sube) y el
            // padre tiene que ver siempre la última versión, no una descarga vieja
            // que el navegador sirvió de su caché HTTP.
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader(
                'Content-Disposition',
                `inline; filename="informe-${snapshot.period.year}-${String(snapshot.period.month).padStart(2, '0')}.pdf"`,
            );
            doc.pipe(res);

            // ── Header: logo (propio si hay whitelabel, si no SportMaps) + línea de acento ──
            const headerLogo = schoolLogo ?? sportmapsLogo;
            if (headerLogo) {
                try {
                    doc.image(headerLogo, 60, 50, { height: 34 });
                } catch {
                    doc.fillColor(INK).fontSize(17).font('Helvetica-Bold').text(branding.schoolName, 60, 55);
                }
            } else {
                doc.fillColor(INK).fontSize(17).font('Helvetica-Bold').text(branding.schoolName, 60, 55);
            }
            doc.fillColor(MUTED).fontSize(9).font('Helvetica').text('Informe Mensual del Atleta', 60, 92);

            doc.fillColor(MUTED).fontSize(9).font('Helvetica')
                .text(capitalize(snapshot.period.label), doc.page.width - 220, 55, { width: 160, align: 'right' });
            if (snapshot.governing_team) {
                doc.fillColor(INK).fontSize(11).font('Helvetica-Bold')
                    .text(snapshot.governing_team.name, doc.page.width - 220, 69, { width: 160, align: 'right' });
            }

            const accentY = 112;
            doc.rect(60, accentY, doc.page.width - 120, 2.5).fill(branding.primaryColor);
            doc.y = accentY + 24;

            // ── Atleta ──
            doc.fillColor(MUTED).fontSize(9).font('Helvetica-Bold').text('ATLETA', 60, doc.y, { characterSpacing: 0.5 });
            doc.fillColor(INK).fontSize(18).font('Helvetica-Bold').text(snapshot.athlete.name, 60, doc.y + 2);
            doc.moveDown(1);

            // ── Fila de cajas: fútbol + asistencia ──
            const boxesTop = doc.y;
            const boxH = 62;
            const gap = 10;
            const footballStats: [string, string][] = snapshot.football
                ? [
                    ['Partidos', String(snapshot.football.matches_played)],
                    ['Minutos', `${snapshot.football.minutes_played}'`],
                    ['Goles', String(snapshot.football.goals)],
                    ['Asist.', String(snapshot.football.assists)],
                    ['Amar.', String(snapshot.football.yellow_cards)],
                    ['Roja', String(snapshot.football.red_cards)],
                ]
                : [];
            const a = snapshot.attendance;
            const cells = [...footballStats, ['Asistencia', a.pct !== null ? `${a.pct}%` : `${a.present}/${a.total}`]];
            const boxW = (doc.page.width - 120 - gap * (cells.length - 1)) / cells.length;
            cells.forEach(([label, value], i) => {
                const x = 60 + i * (boxW + gap);
                doc.roundedRect(x, boxesTop, boxW, boxH, 6).lineWidth(1).strokeColor(HAIRLINE).stroke();
                doc.fillColor(branding.primaryColor).fontSize(15).font('Helvetica-Bold')
                    .text(value, x, boxesTop + 14, { width: boxW, align: 'center' });
                doc.fillColor(MUTED).fontSize(7).font('Helvetica')
                    .text(label.toUpperCase(), x, boxesTop + 38, { width: boxW, align: 'center', characterSpacing: 0.3 });
            });
            doc.y = boxesTop + boxH + 22;

            // ── Destacados ──
            if (snapshot.highlights?.length > 0) {
                sectionTitle(doc, 'Lo mejor del mes', '#15803d');
                for (const m of snapshot.highlights) drawMetricLine(doc, m);
                doc.moveDown(0.8);
            }

            // ── A trabajar ──
            if (snapshot.to_work_on?.length > 0) {
                sectionTitle(doc, 'En qué trabajar', '#b45309');
                for (const m of snapshot.to_work_on) drawMetricLine(doc, m);
                doc.moveDown(0.8);
            }

            // ── Todas las métricas, por categoría ──
            const byCategory = new Map<string, any[]>();
            for (const m of snapshot.metrics ?? []) {
                const cat = m.category ?? 'other';
                if (!byCategory.has(cat)) byCategory.set(cat, []);
                byCategory.get(cat)!.push(m);
            }
            for (const cat of ['physical', 'technical', 'tactical', 'attendance', 'other']) {
                const rows = byCategory.get(cat);
                if (!rows?.length) continue;
                if (doc.y > doc.page.height - 150) doc.addPage();
                sectionTitle(doc, CATEGORY_LABEL[cat], INK);
                for (const m of rows) drawMetricLine(doc, m);
                doc.moveDown(0.5);
            }

            // ── Notas ──
            if (doc.y > doc.page.height - 220) doc.addPage();
            if (snapshot.coach_note) {
                doc.moveDown(0.4);
                noteBox(doc, 'Nota del entrenador', snapshot.coach_note, branding.primaryColor);
            }
            for (const n of snapshot.team_notes ?? []) {
                doc.moveDown(0.4);
                noteBox(doc, n.team_name, n.body, branding.primaryColor);
            }

            // Footer en cada página ya creada, después de que todo el contenido
            // se terminó de escribir -- range() es estable recién acá.
            addFooterToAllPages(doc, branding.showWatermark);

            doc.end();
        } catch (err) {
            next(err);
        }
    },
);

function drawMetricLine(doc: PDFKit.PDFDocument, m: any) {
    const bandColor = m.band ? BAND_HEX[m.band] : '#9ca3af';
    const deltaTxt = m.delta !== null && m.delta !== undefined
        ? ` (${m.delta > 0 ? '+' : ''}${fmt(m.delta, m.unit)})`
        : '';
    const y = doc.y;
    doc.circle(64, y + 6, 3).fill(bandColor);
    doc.fillColor(INK).font('Helvetica').fontSize(10)
        .text(`${m.label}: ${fmt(m.value, m.unit)}${deltaTxt}`, 74, y);
    doc.moveDown(0.25);
}

export default router;
