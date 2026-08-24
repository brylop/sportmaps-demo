// saasInvoicePdf.service — genera el PDF del recibo SaaS que SportMaps le
// envía a una escuela por su mensualidad. Clona la estructura visual de
// bff/src/routes/certificates.ts (banda de color, título, cuerpo, footer),
// pero el emisor es SportMaps, no la escuela — por eso NO usa
// resolveSchoolBranding(schoolId) (eso trae la marca de la escuela
// destinataria) sino los colores default de SportMaps.
//
// Los métodos de pago se leen de platform_config.platform_payment_accounts
// en cada generación — cambiar la cuenta ahí no requiere tocar este archivo.

import PDFDocument from 'pdfkit';
import { supabase } from '../config/supabase';
import { ACADEMY_PLAN_NAMES } from './saasInvoicing.constants';

const SPORTMAPS_GREEN = '#248223';

interface PlatformPaymentAccount {
    id: string;
    type: string;
    label: string;
    value: string;
    holder_name: string;
    active: boolean;
}

async function loadActivePaymentAccounts(): Promise<PlatformPaymentAccount[]> {
    const { data } = await supabase
        .from('platform_config')
        .select('value')
        .eq('key', 'platform_payment_accounts')
        .maybeSingle();
    const accounts = (data?.value as PlatformPaymentAccount[] | undefined) ?? [];
    return accounts.filter((a) => a.active);
}

function formatCop(cents: number): string {
    return `$${Math.round(cents / 100).toLocaleString('es-CO')}`;
}

function formatDate(d: string | Date): string {
    return new Date(d).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
}

export interface SaasInvoiceForPdf {
    invoice_number: string;
    plan_code: string;
    amount_cents: number;
    period_start: string;
    period_end: string;
    due_date: string;
    status: string;
}

export async function generateSaasInvoicePdf(invoice: SaasInvoiceForPdf, schoolName: string): Promise<Buffer> {
    const accounts = await loadActivePaymentAccounts();
    const planName = ACADEMY_PLAN_NAMES[invoice.plan_code] ?? invoice.plan_code;

    return new Promise<Buffer>((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 60 });
        const chunks: Buffer[] = [];
        doc.on('data', (c) => chunks.push(c as Buffer));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // ── Header band ──
        doc.rect(0, 0, doc.page.width, 90).fill(SPORTMAPS_GREEN);
        doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold')
           .text('SportMaps', 60, 28, { width: doc.page.width - 220 });
        doc.fontSize(10).font('Helvetica')
           .text('Factura de mensualidad SaaS', 60, 54, { width: doc.page.width - 220 });
        doc.fontSize(10).font('Helvetica-Bold')
           .text(invoice.invoice_number, doc.page.width - 220, 38, { width: 160, align: 'right' });

        doc.fillColor('#000000');
        doc.moveDown(4);

        // ── Datos de la escuela ──
        doc.fontSize(12).font('Helvetica-Bold').text('Para', 60, doc.y);
        doc.fontSize(12).font('Helvetica').text(schoolName);
        doc.moveDown(1.5);

        // ── Tabla plan / período / valor ──
        const rows: [string, string][] = [
            ['Plan', planName],
            ['Período facturado', `${formatDate(invoice.period_start)} — ${formatDate(invoice.period_end)}`],
            ['Fecha de vencimiento', formatDate(invoice.due_date)],
        ];
        doc.font('Helvetica-Bold').fontSize(11);
        for (const [label, value] of rows) {
            const y = doc.y;
            doc.font('Helvetica-Bold').text(label, 60, y, { width: 200, continued: false });
            doc.font('Helvetica').text(value, 270, y, { width: doc.page.width - 330 });
            doc.moveDown(0.3);
        }
        doc.moveDown(1);

        // ── Total en caja ──
        const boxY = doc.y;
        doc.rect(60, boxY, doc.page.width - 120, 50).fillAndStroke('#f3f4f6', '#e5e7eb');
        doc.fillColor('#000000').fontSize(11).font('Helvetica')
           .text('Total a pagar', 76, boxY + 12);
        doc.fontSize(18).font('Helvetica-Bold')
           .text(formatCop(invoice.amount_cents), 76, boxY + 26);
        doc.moveDown(4);

        // ── Cómo pagar ──
        doc.fontSize(13).font('Helvetica-Bold').text('Cómo pagar', 60, doc.y);
        doc.moveDown(0.5);
        if (accounts.length === 0) {
            doc.fontSize(10).font('Helvetica').fillColor('#6b7280')
               .text('Escríbenos para confirmar el método de pago vigente.');
        }
        for (const acc of accounts) {
            const y = doc.y;
            doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000')
               .text(acc.label, 60, y);
            doc.fontSize(11).font('Helvetica')
               .text(`Llave: ${acc.value}`, 60, doc.y);
            doc.fontSize(9).font('Helvetica').fillColor('#6b7280')
               .text(`A nombre de ${acc.holder_name}`, 60, doc.y);
            doc.moveDown(1);
        }
        doc.fillColor('#000000');
        doc.moveDown(1);
        doc.fontSize(9).font('Helvetica').fillColor('#6b7280')
           .text('Envía el comprobante de pago por WhatsApp o correo para que confirmemos tu factura.');

        // ── Footer ──
        doc.fontSize(8).fillColor('#9ca3af').font('Helvetica')
           .text('SportMaps · Este es un recibo interno, no una factura electrónica DIAN.', 60, doc.page.height - 60,
                 { width: doc.page.width - 120, align: 'center' });

        doc.end();
    });
}
