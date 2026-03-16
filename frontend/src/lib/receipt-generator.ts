import jsPDF from 'jspdf';

interface ReceiptData {
  receiptNumber: string;
  date: string;
  customerName: string;
  customerEmail?: string;
  concept: string;
  description?: string;
  amount: number;
  paymentMethod: string;
  paymentType: 'one_time' | 'subscription' | 'monthly';
  schoolName?: string;
  programName?: string;
  subscriptionPeriod?: string;
  studentName?: string;
  receiptUrl?: string;
  // White Label Branding
  logoUrl?: string | null;
  brandingSettings?: {
    primary_color: string;
    secondary_color: string;
    show_sportmaps_watermark: boolean;
  } | null;
}

// Default SportMaps brand colors
const BRAND_GREEN = [36, 130, 35] as [number, number, number]; // #248223
const BRAND_ORANGE = [251, 159, 30] as [number, number, number]; // #FB9F1E

// Helper to convert hex to RGB
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : BRAND_GREEN;
}

export function generatePaymentReceipt(data: ReceiptData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Helper functions
  const centerText = (text: string, y: number, fontSize: number = 12) => {
    doc.setFontSize(fontSize);
    const textWidth = doc.getTextWidth(text);
    doc.text(text, (pageWidth - textWidth) / 2, y);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Determine colors based on branding settings
  const primaryColor = data.brandingSettings?.primary_color
    ? hexToRgb(data.brandingSettings.primary_color)
    : BRAND_GREEN;

  const secondaryColor = data.brandingSettings?.secondary_color
    ? hexToRgb(data.brandingSettings.secondary_color)
    : BRAND_ORANGE;

  // Header with brand colors
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 45, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');

  // NOTE: Loading external images in jsPDF requires converting them to base64 first.
  // We'll fallback to text if logo_url is hard to load synchronously or if it's missing.
  centerText(data.schoolName || 'SPORTMAPS', 22);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  centerText(data.schoolName ? 'Recibo Oficial' : 'Tu ecosistema deportivo', 32);

  // Receipt title with secondary color accent
  doc.setFillColor(...secondaryColor);
  doc.rect(0, 45, pageWidth, 8, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  centerText('RECIBO DE PAGO', 51);

  // Receipt details section
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  // Receipt number and date
  let y = 65;
  doc.setFont('helvetica', 'bold');
  doc.text(`Recibo N°: ${data.receiptNumber}`, 20, y);
  doc.text(`Fecha: ${data.date}`, pageWidth - 20, y, { align: 'right' });

  // Divider line
  y += 10;
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.5);
  doc.line(20, y, pageWidth - 20, y);

  // Customer information
  y += 15;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('INFORMACIÓN DEL CLIENTE', 20, y);

  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(`Nombre: ${data.customerName}`, 20, y);

  if (data.customerEmail) {
    y += 7;
    doc.text(`Email: ${data.customerEmail}`, 20, y);
  }

  // Payment details
  y += 15;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('DETALLE DEL PAGO', 20, y);

  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);

  // Concept
  doc.text('Concepto:', 20, y);
  doc.setFont('helvetica', 'bold');
  doc.text(data.concept, 60, y);

  // School name if applicable
  if (data.schoolName) {
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.text('Escuela:', 20, y);
    doc.text(data.schoolName, 60, y);
  }

  // Student name if applicable
  if (data.studentName) {
    y += 7;
    doc.text('Estudiante:', 20, y);
    doc.text(data.studentName, 60, y);
  }

  // Program name if applicable
  if (data.programName) {
    y += 7;
    doc.text('Programa:', 20, y);
    doc.text(data.programName, 60, y);
  }

  // Description
  if (data.description) {
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.text('Descripción:', 20, y);

    // Handle long descriptions with text wrapping
    const descriptionLines = doc.splitTextToSize(data.description, pageWidth - 80);
    doc.text(descriptionLines, 60, y);
    y += (descriptionLines.length - 1) * 5;
  }

  // Payment method
  y += 10;
  doc.text('Método de pago:', 20, y);
  const methodLabels: Record<string, string> = {
    card: 'Tarjeta de Crédito/Débito',
    pse: 'PSE - Débito Bancario',
    nequi: 'Nequi',
  };
  doc.text(methodLabels[data.paymentMethod] || data.paymentMethod, 70, y);

  // Payment type
  y += 7;
  doc.text('Tipo de pago:', 20, y);
  const paymentTypeLabels: Record<string, string> = {
    subscription: `Suscripción Mensual${data.subscriptionPeriod ? ` (${data.subscriptionPeriod})` : ''}`,
    one_time: 'Pago Único',
    monthly: 'Mensualidad',
  };
  doc.text(paymentTypeLabels[data.paymentType] || data.paymentType, 70, y);

  // Amount box
  y += 20;
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(20, y - 5, pageWidth - 40, 25, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  doc.text('TOTAL PAGADO:', 30, y + 8);

  doc.setTextColor(...primaryColor);
  doc.setFontSize(18);
  doc.text(formatCurrency(data.amount), pageWidth - 30, y + 10, { align: 'right' });

  // Status badge
  y += 35;
  doc.setFillColor(...primaryColor);
  doc.roundedRect(pageWidth / 2 - 25, y, 50, 12, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  centerText('PAGADO', y + 8);

  // Footer
  y = 260;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(20, y, pageWidth - 20, y);

  y += 10;
  doc.setTextColor(120, 120, 120);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  if (data.brandingSettings?.show_sportmaps_watermark !== false) {
    centerText('Este recibo es un comprobante válido de tu transacción en SportMaps.', y);
    y += 5;
    centerText('Para cualquier consulta, contáctanos en soporte@sportmaps.co', y);
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND_ORANGE);
    centerText('Powered by SportMaps | www.sportmaps.co', y);
  } else {
    centerText(`Este recibo es un comprobante válido emitido por ${data.schoolName || 'la academia'}.`, y);
    y += 5;
    centerText('Por favor contacte a su sede para dudas sobre este cobro.', y);
  }

  // Add QR-like reference code at the bottom
  y += 10;
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  centerText(`Ref: ${data.receiptNumber} | Generado: ${new Date().toISOString()}`, y);

  return doc;
}

export function downloadReceipt(data: ReceiptData) {
  const doc = generatePaymentReceipt(data);
  const fileName = `SportMaps_Recibo_${data.receiptNumber}.pdf`;
  doc.save(fileName);
}

export function getReceiptBlob(data: ReceiptData): Blob {
  const doc = generatePaymentReceipt(data);
  return doc.output('blob');
}
