import jsPDF from 'jspdf';
import { labelMetodoDePago } from '@/lib/paymentOrigin';

interface ReceiptData {
  receiptNumber: string;
  date: string;
  customerName: string;
  customerEmail?: string;
  concept: string;
  description?: string;
  amount: number;
  /** Puede venir null: 3.626 cobros en la base no tienen metodo registrado.
   *  labelMetodoDePago() lo resuelve como "No registrado". */
  paymentMethod?: string | null;
  paymentType: 'one_time' | 'subscription' | 'monthly';
  schoolName?: string;
  teamName?: string;
  subscriptionPeriod?: string;
  studentName?: string;
  receiptUrl?: string;
  // ─── White-label branding por escuela ───
  // El caller (typicamente via usePdfBranding hook) ya aplico feature gate
  // por tier. Si tier es free, viene logoUrl=null y brandingSettings=defaults.
  logoUrl?: string | null;
  brandingSettings?: {
    primary_color: string;
    secondary_color: string;
    show_sportmaps_watermark: boolean;
  } | null;
}

// SportMaps default brand (Green / Orange). Mirror del backend resolver
// y del frontend ThemeContext. NO confundir con primary/secondary del usuario.
const BRAND_GREEN = [36, 130, 35] as [number, number, number]; // #248223
const BRAND_ORANGE = [251, 159, 30] as [number, number, number]; // #FB9F1E

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

function hexToRgb(hex: string): [number, number, number] {
  if (!HEX_RE.test(hex)) return BRAND_GREEN; // defensive
  const clean = hex.replace(/^#/, '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

type Rgb = [number, number, number];

/**
 * Luminancia relativa sRGB (0 = negro, 1 = blanco). Es la métrica que decide si
 * un color de marca aguanta texto blanco encima.
 */
function luminancia([r, g, b]: Rgb): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * Color de texto legible ENCIMA de un relleno de marca.
 *
 * Antes esto era `setTextColor(255,255,255)` fijo, y con un secundario claro el
 * texto desaparecía: la banda "RECIBO DE PAGO" de Besser (amarillo #FFCC00,
 * luminancia 0.79) quedaba prácticamente ilegible. Medido sobre las 30 escuelas
 * con marca propia: 3 caían en ese caso, incluida la propia SportMaps con su
 * naranja default #FB9F1E (0.66).
 *
 * El umbral 0.6 es empírico y conservador: por debajo, blanco; por encima, un
 * gris muy oscuro (no negro puro, que sobre un color saturado vibra).
 */
function textoSobre(fondo: Rgb): Rgb {
  return luminancia(fondo) > 0.6 ? [40, 40, 40] : [255, 255, 255];
}

/**
 * El color de marca ajustado para usarse COMO TEXTO sobre fondo claro (blanco o
 * el gris #f5f5f5 de la caja del total).
 *
 * Es el problema espejo del de arriba y pega en el dato más importante del
 * recibo: con un primario claro, el TOTAL PAGADO salía casi invisible. Hay al
 * menos una escuela con primario #65e70d (luminancia 0.74) en esa situación.
 * Se oscurece multiplicando hasta caer bajo el umbral, conservando el tono.
 */
function textoDeMarca(color: Rgb): Rgb {
  let [r, g, b] = color;
  let intentos = 0;
  while (luminancia([r, g, b]) > 0.55 && intentos < 12) {
    r = Math.round(r * 0.82);
    g = Math.round(g * 0.82);
    b = Math.round(b * 0.82);
    intentos++;
  }
  return [r, g, b];
}

/**
 * Carga una imagen URL como dataURL base64 para incrustar en jsPDF.
 * Devuelve null si:
 *  - url es null/undefined
 *  - fetch falla (CORS, 404, etc.)
 *  - tamaño excede 2MB (mismo cap que el bucket Storage)
 *  - MIME no es imagen reconocida
 *
 * NUNCA lanza — falla silenciosa y caemos a render sin logo.
 */
async function fetchLogoAsDataUrl(url: string | null | undefined): Promise<{
  dataUrl: string;
  format: 'PNG' | 'JPEG' | 'WEBP';
  width: number;
  height: number;
} | null> {
  if (!url) return null;

  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    let format: 'PNG' | 'JPEG' | 'WEBP';
    if (contentType.startsWith('image/png')) format = 'PNG';
    else if (contentType.startsWith('image/jpeg')) format = 'JPEG';
    else if (contentType.startsWith('image/webp')) format = 'WEBP';
    else return null; // SVG no soportado por jsPDF.addImage directamente

    const blob = await response.blob();
    if (blob.size > 2 * 1024 * 1024) return null;

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // Calcular dimensiones via Image element
    const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = reject;
      img.src = dataUrl;
    });

    return { dataUrl, format, ...dims };
  } catch {
    return null;
  }
}

/**
 * Genera el PDF de recibo branded. Async porque puede cargar el logo de la
 * escuela via fetch. El caller espera la promesa antes de descargar.
 */
export async function generatePaymentReceipt(data: ReceiptData): Promise<jsPDF> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  const centerText = (text: string, y: number, fontSize: number = 12) => {
    doc.setFontSize(fontSize);
    const textWidth = doc.getTextWidth(text);
    doc.text(text, (pageWidth - textWidth) / 2, y);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);

  // Colores con fallback defensivo
  const primaryColor = data.brandingSettings?.primary_color
    ? hexToRgb(data.brandingSettings.primary_color)
    : BRAND_GREEN;
  const secondaryColor = data.brandingSettings?.secondary_color
    ? hexToRgb(data.brandingSettings.secondary_color)
    : BRAND_ORANGE;
  const showWatermark = data.brandingSettings?.show_sportmaps_watermark !== false;

  // Colores de texto derivados del contraste, no fijos. Ver textoSobre() y
  // textoDeMarca() arriba: con un secundario claro (el amarillo de Besser) el
  // texto blanco desaparecia, y con un primario claro el TOTAL PAGADO tambien.
  const textoEnHeader    = textoSobre(primaryColor);
  const textoEnBanda     = textoSobre(secondaryColor);
  const marcaComoTexto   = textoDeMarca(primaryColor);

  // ── Cargar logo (si lo hay y el tier lo permite — usePdfBranding lo gatea) ──
  const logoImage = await fetchLogoAsDataUrl(data.logoUrl);

  // ── Header con banda de color primario ──
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, 45, 'F');

  doc.setTextColor(textoEnHeader[0], textoEnHeader[1], textoEnHeader[2]);

  if (logoImage) {
    // Logo a la izquierda, max alto 28mm, ancho proporcional
    const maxH = 28;
    const ratio = logoImage.width / logoImage.height;
    const h = Math.min(maxH, 28);
    const w = h * ratio;
    try {
      doc.addImage(logoImage.dataUrl, logoImage.format, 14, 8, w, h);
    } catch {
      // si el formato no es soportable, fallback a text-only
    }

    // Nombre escuela al lado del logo
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(data.schoolName || 'SPORTMAPS', 14 + Math.max(w, 24) + 8, 22);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Recibo Oficial', 14 + Math.max(w, 24) + 8, 30);
  } else {
    // Sin logo — texto centrado (modo SportMaps default o tier free)
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    centerText(data.schoolName || 'SPORTMAPS', 22);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    centerText(data.schoolName ? 'Recibo Oficial' : 'Tu ecosistema deportivo', 32);
  }

  // ── Banda secundaria con "RECIBO DE PAGO" ──
  doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.rect(0, 45, pageWidth, 8, 'F');

  doc.setTextColor(textoEnBanda[0], textoEnBanda[1], textoEnBanda[2]);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  centerText('RECIBO DE PAGO', 51);

  // ── Cuerpo ──
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  let y = 65;
  doc.setFont('helvetica', 'bold');
  doc.text(`Recibo N°: ${data.receiptNumber}`, 20, y);
  doc.text(`Fecha: ${data.date}`, pageWidth - 20, y, { align: 'right' });

  y += 10;
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(0.5);
  doc.line(20, y, pageWidth - 20, y);

  y += 15;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(marcaComoTexto[0], marcaComoTexto[1], marcaComoTexto[2]);
  doc.text('INFORMACIÓN DEL CLIENTE', 20, y);

  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(`Nombre: ${data.customerName}`, 20, y);

  if (data.customerEmail) {
    y += 7;
    doc.text(`Email: ${data.customerEmail}`, 20, y);
  }

  y += 15;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(marcaComoTexto[0], marcaComoTexto[1], marcaComoTexto[2]);
  doc.text('DETALLE DEL PAGO', 20, y);

  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);

  doc.text('Concepto:', 20, y);
  doc.setFont('helvetica', 'bold');
  doc.text(data.concept, 60, y);

  if (data.schoolName) {
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.text('Escuela:', 20, y);
    doc.text(data.schoolName, 60, y);
  }

  if (data.studentName) {
    y += 7;
    doc.text('Deportista:', 20, y);
    doc.text(data.studentName, 60, y);
  }

  if (data.teamName) {
    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('Programa:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.teamName, 60, y);
  }

  if (data.description) {
    y += 7;
    doc.text('Descripción:', 20, y);
    const descriptionLines = doc.splitTextToSize(data.description, pageWidth - 80);
    doc.text(descriptionLines, 60, y);
    y += (descriptionLines.length - 1) * 5;
  }

  y += 10;
  doc.text('Método de pago:', 20, y);
  // Etiqueta desde el mapa canónico de paymentOrigin.ts. El mapa local que
  // había acá solo cubría card/pse/nequi, así que imprimía el valor crudo en
  // inglés para transfer/cash/other — que son la mayoría de los cobros con
  // método registrado. En un recibo que ve el acudiente eso se nota.
  doc.text(labelMetodoDePago(data.paymentMethod), 70, y);

  y += 7;
  doc.text('Tipo de pago:', 20, y);
  const paymentTypeLabels: Record<string, string> = {
    subscription: `Suscripción Mensual${data.subscriptionPeriod ? ` (${data.subscriptionPeriod})` : ''}`,
    one_time: 'Pago Único',
    monthly: 'Mensualidad',
  };
  doc.text(paymentTypeLabels[data.paymentType] || data.paymentType, 70, y);

  // ── Total ──
  y += 20;
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(20, y - 5, pageWidth - 40, 25, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  doc.text('TOTAL PAGADO:', 30, y + 8);

  doc.setTextColor(marcaComoTexto[0], marcaComoTexto[1], marcaComoTexto[2]);
  doc.setFontSize(18);
  doc.text(formatCurrency(data.amount), pageWidth - 30, y + 10, { align: 'right' });

  // ── Status badge ──
  y += 35;
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.roundedRect(pageWidth / 2 - 25, y, 50, 12, 2, 2, 'F');
  doc.setTextColor(textoEnHeader[0], textoEnHeader[1], textoEnHeader[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  centerText('PAGADO', y + 8);

  // ── Footer ──
  y = 260;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(20, y, pageWidth - 20, y);

  y += 10;
  doc.setTextColor(120, 120, 120);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  if (showWatermark) {
    centerText('Este recibo es un comprobante válido de tu transacción en SportMaps.', y);
    y += 5;
    centerText('Para cualquier consulta, contáctanos en soporte@sportmaps.co', y);
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(BRAND_ORANGE[0], BRAND_ORANGE[1], BRAND_ORANGE[2]);
    centerText('Powered by SportMaps | www.sportmaps.co', y);
  } else {
    // Tier Pro+ con watermark off — sin mencion SportMaps en el cuerpo.
    centerText(`Este recibo es un comprobante válido emitido por ${data.schoolName || 'la academia'}.`, y);
    y += 5;
    centerText('Por favor contacta a tu sede para dudas sobre este cobro.', y);
  }

  y += 10;
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  centerText(`Ref: ${data.receiptNumber} | Generado: ${new Date().toISOString()}`, y);

  return doc;
}

/**
 * Descarga el recibo como PDF. Es async porque puede esperar al logo.
 * Los callsites deben hacer `await downloadReceipt(...)`.
 */
export async function downloadReceipt(data: ReceiptData) {
  const doc = await generatePaymentReceipt(data);
  const fileName = `SportMaps_Recibo_${data.receiptNumber}.pdf`;
  doc.save(fileName);
}

/**
 * Devuelve el recibo como Blob para casos donde se quiere subir / mandar.
 */
export async function getReceiptBlob(data: ReceiptData): Promise<Blob> {
  const doc = await generatePaymentReceipt(data);
  return doc.output('blob');
}
