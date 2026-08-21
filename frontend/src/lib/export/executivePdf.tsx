/**
 * PDF ejecutivo con gráficos reales — no es el HTML de `window.print()`.
 * Los gráficos se renderizan off-screen con Recharts, se rasterizan con
 * html2canvas y se insertan como imagen en un documento jsPDF paginado.
 * Mismos colores de marca que `receipt-generator.ts` (recibo de pago).
 */
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { createRoot } from 'react-dom/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, PieChart, Pie, Legend } from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const BRAND_GREEN: [number, number, number] = [26, 97, 24]; // #1a6118
const BRAND_ORANGE: [number, number, number] = [251, 159, 30]; // #FB9F1E

const currency = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);

export interface ExecutivePdfData {
    schoolName: string;
    dateRangeLabel: string;
    generatedAt: Date;
    kpis: { label: string; value: string; sub?: string }[];
    financeBreakdown: { label: string; value: number; color: string }[];
    statusDistribution: { label: string; value: number; color: string }[];
    topTeamsByRevenue: { name: string; revenue: number }[];
    topOverdueStudents: { name: string; team: string; amount: number; days: number }[];
}

// ─── Charts (tamaño fijo — nada de ResponsiveContainer: el contenedor real
// vive fuera de pantalla y no tiene un padre con ancho para medir) ─────────
function FinanceBarChart({ data }: { data: ExecutivePdfData['financeBreakdown'] }) {
    return (
        <BarChart width={640} height={320} data={data} margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 13, fill: '#374151' }} />
            <YAxis tickFormatter={v => `$${(v / 1_000_000).toFixed(1)}M`} tick={{ fontSize: 12, fill: '#6b7280' }} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
        </BarChart>
    );
}

function StatusPieChart({ data }: { data: ExecutivePdfData['statusDistribution'] }) {
    return (
        <PieChart width={640} height={320}>
            <Pie
                data={data} dataKey="value" nameKey="label" cx="42%" cy="50%" outerRadius={110}
                isAnimationActive={false}
                label={({ label, value }: any) => `${label}: ${value}`}
            >
                {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Legend layout="vertical" align="right" verticalAlign="middle" />
        </PieChart>
    );
}

function TeamsBarChart({ data }: { data: ExecutivePdfData['topTeamsByRevenue'] }) {
    return (
        <BarChart width={640} height={320} data={data} layout="vertical" margin={{ top: 10, right: 40, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tickFormatter={v => `$${(v / 1_000_000).toFixed(1)}M`} tick={{ fontSize: 12, fill: '#6b7280' }} />
            <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12, fill: '#374151' }} />
            <Bar dataKey="revenue" fill="#1a6118" radius={[0, 6, 6, 0]} isAnimationActive={false} />
        </BarChart>
    );
}

/**
 * Monta un elemento React fuera de la pantalla, espera un frame para que
 * Recharts termine de medir/pintar, lo rasteriza a PNG y desmonta. Ningún
 * paso de esto es visible para el usuario.
 */
async function renderChartToImage(element: React.ReactElement, width: number, height: number): Promise<string> {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-10000px';
    container.style.top = '0';
    container.style.width = `${width}px`;
    container.style.height = `${height}px`;
    container.style.background = '#ffffff';
    document.body.appendChild(container);

    const root = createRoot(container);
    root.render(element);
    // Dos rAF: uno para que Recharts monte, otro para que termine el layout.
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    const canvas = await html2canvas(container, { backgroundColor: '#ffffff', scale: 2 });
    const dataUrl = canvas.toDataURL('image/png');

    root.unmount();
    document.body.removeChild(container);
    return dataUrl;
}

function addHeader(doc: jsPDF, title: string, subtitle: string) {
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(...BRAND_GREEN);
    doc.rect(0, 0, pageWidth, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(title, 15, 17);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(subtitle, pageWidth - 15, 17, { align: 'right' });
}

function addFooter(doc: jsPDF, pageNum: number) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(15, pageHeight - 14, pageWidth - 15, pageHeight - 14);
    doc.setTextColor(140, 140, 140);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text('SportMaps · Reporte confidencial de solo lectura', 15, pageHeight - 9);
    doc.text(`Página ${pageNum}`, pageWidth - 15, pageHeight - 9, { align: 'right' });
}

function addImageFullWidth(doc: jsPDF, dataUrl: string, y: number, aspect: number) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const w = pageWidth - 30;
    doc.addImage(dataUrl, 'PNG', 15, y, w, w * aspect);
}

export async function generateExecutivePdf(data: ExecutivePdfData): Promise<jsPDF> {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let page = 1;

    // ── Portada ──────────────────────────────────────────────────────────
    doc.setFillColor(...BRAND_GREEN);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setFillColor(...BRAND_ORANGE);
    doc.rect(0, pageHeight / 2 - 2, pageWidth, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.text('Reporte Ejecutivo', pageWidth / 2, pageHeight / 2 - 18, { align: 'center' });
    doc.setFontSize(15);
    doc.setFont('helvetica', 'normal');
    doc.text(data.schoolName, pageWidth / 2, pageHeight / 2 + 12, { align: 'center' });
    doc.setFontSize(10);
    doc.text(data.dateRangeLabel, pageWidth / 2, pageHeight / 2 + 22, { align: 'center' });
    doc.setFontSize(8);
    doc.setTextColor(230, 230, 230);
    doc.text(
        `Generado el ${format(data.generatedAt, "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}`,
        pageWidth / 2, pageHeight - 20, { align: 'center' }
    );

    // ── Indicadores clave ────────────────────────────────────────────────
    doc.addPage(); page++;
    addHeader(doc, 'Indicadores Clave', data.dateRangeLabel);
    const kpiCols = 2;
    const gap = 8;
    const kpiW = (pageWidth - 30 - gap) / kpiCols;
    const kpiH = 24;
    data.kpis.forEach((kpi, i) => {
        const col = i % kpiCols;
        const row = Math.floor(i / kpiCols);
        const x = 15 + col * (kpiW + gap);
        const y = 40 + row * (kpiH + 6);
        doc.setDrawColor(225, 225, 225);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, kpiW, kpiH, 2, 2, 'S');
        doc.setTextColor(130, 130, 130);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text(kpi.label.toUpperCase(), x + 5, y + 7);
        doc.setTextColor(30, 30, 30);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text(kpi.value, x + 5, y + 16);
        if (kpi.sub) {
            doc.setTextColor(150, 150, 150);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.text(kpi.sub, x + 5, y + 21);
        }
    });
    addFooter(doc, page);

    // ── Cartera de pagos ─────────────────────────────────────────────────
    doc.addPage(); page++;
    addHeader(doc, 'Cartera de Pagos', data.dateRangeLabel);
    const financeImg = await renderChartToImage(<FinanceBarChart data={data.financeBreakdown} />, 640, 320);
    addImageFullWidth(doc, financeImg, 40, 320 / 640);
    addFooter(doc, page);

    // ── Distribución por estado ──────────────────────────────────────────
    doc.addPage(); page++;
    addHeader(doc, 'Distribución de Pagos por Estado', data.dateRangeLabel);
    const statusImg = await renderChartToImage(<StatusPieChart data={data.statusDistribution} />, 640, 320);
    addImageFullWidth(doc, statusImg, 40, 320 / 640);
    addFooter(doc, page);

    // ── Equipos por ingreso ──────────────────────────────────────────────
    if (data.topTeamsByRevenue.length > 0) {
        doc.addPage(); page++;
        addHeader(doc, 'Equipos por Ingreso Potencial', data.dateRangeLabel);
        const teamsImg = await renderChartToImage(<TeamsBarChart data={data.topTeamsByRevenue} />, 640, 320);
        addImageFullWidth(doc, teamsImg, 40, 320 / 640);
        addFooter(doc, page);
    }

    // ── Morosos — tabla compacta, no el detalle completo (eso va en Excel) ──
    if (data.topOverdueStudents.length > 0) {
        doc.addPage(); page++;
        addHeader(doc, 'Mayor Deuda Vencida', data.dateRangeLabel);
        let y = 42;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(90, 90, 90);
        doc.text('Deportista', 15, y);
        doc.text('Equipo', 95, y);
        doc.text('Monto', 155, y, { align: 'right' });
        doc.text('Días', pageWidth - 15, y, { align: 'right' });
        y += 3;
        doc.setDrawColor(200, 200, 200);
        doc.line(15, y, pageWidth - 15, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        data.topOverdueStudents.slice(0, 25).forEach(s => {
            y += 7;
            if (y > pageHeight - 20) {
                addFooter(doc, page);
                doc.addPage(); page++;
                addHeader(doc, 'Mayor Deuda Vencida (cont.)', data.dateRangeLabel);
                y = 42;
            }
            doc.setTextColor(40, 40, 40);
            doc.text(s.name, 15, y);
            doc.text(s.team, 95, y);
            doc.text(currency(s.amount), 155, y, { align: 'right' });
            doc.setTextColor(190, 50, 50);
            doc.text(`${s.days}d`, pageWidth - 15, y, { align: 'right' });
        });
        addFooter(doc, page);
    }

    return doc;
}

export async function downloadExecutivePdf(data: ExecutivePdfData, filename: string) {
    const doc = await generateExecutivePdf(data);
    doc.save(`${filename}.pdf`);
}
