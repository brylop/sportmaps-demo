import jsPDF from 'jspdf';

interface ReceiptData {
  receiptNumber: string;
  date: string;
  customerName: string;
  customerEmail?: string;
  concept: string;
  description?: string;
  amount: number;
  paymentMethod: 'card' | 'pse';
  paymentType: 'one_time' | 'subscription';
  schoolName?: string;
  programName?: string;
  subscriptionPeriod?: string;
}

// SportMaps brand colors
const BRAND_GREEN = [36, 130, 35] as const; // #248223
const BRAND_ORANGE = [251, 159, 30] as const; // #FB9F1E

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

  // Header with brand colors
  doc.setFillColor(...BRAND_GREEN);
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  // Logo area (text-based since we can't load external images easily)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  centerText('SPORTMAPS', 22);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  centerText('Tu ecosistema deportivo', 32);

  // Receipt title with orange accent
  doc.setFillColor(...BRAND_ORANGE);
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
  doc.setDrawColor(...BRAND_GREEN);
  doc.setLineWidth(0.5);
  doc.line(20, y, pageWidth - 20, y);

  // Customer information
  y += 15;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND_GREEN);
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
  doc.setTextColor(...BRAND_GREEN);
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
  doc.text(data.paymentMethod === 'card' ? 'Tarjeta de Crédito/Débito' : 'PSE - Débito Bancario', 70, y);

  // Payment type
  y += 7;
  doc.text('Tipo de pago:', 20, y);
  const paymentTypeText = data.paymentType === 'subscription' 
    ? `Suscripción Mensual${data.subscriptionPeriod ? ` (${data.subscriptionPeriod})` : ''}`
    : 'Pago Único';
  doc.text(paymentTypeText, 70, y);

  // Amount box
  y += 20;
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(20, y - 5, pageWidth - 40, 25, 3, 3, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  doc.text('TOTAL PAGADO:', 30, y + 8);
  
  doc.setTextColor(...BRAND_GREEN);
  doc.setFontSize(18);
  doc.text(formatCurrency(data.amount), pageWidth - 30, y + 10, { align: 'right' });

  // Status badge
  y += 35;
  doc.setFillColor(...BRAND_GREEN);
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
  centerText('Este recibo es un comprobante válido de tu transacción en SportMaps.', y);
  
  y += 5;
  centerText('Para cualquier consulta, contáctanos en soporte@sportmaps.co', y);

  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND_ORANGE);
  centerText('www.sportmaps.co', y);

  // Add QR-like reference code at the bottom
  y += 10;
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(7);
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
