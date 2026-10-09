/**
 * Ficha del ejercicio en PDF (spec docs/specs/pizarra-nivel-tacticalpad.md, T2).
 *
 * Una sola hoja A4: encabezado, la jugada grande (cuadro 1), la secuencia de
 * cuadros en miniatura si hay más de uno (máx. 6 casillas; con más, la última
 * dice «+n») y los campos del ejercicio. Lo que no cabe en la hoja se corta
 * con «…»: es una ficha, no un documento.
 */
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import type { TacticalArrow } from '@/lib/school/footballQueries';
import type { TacticalFrame } from '@/lib/school/tacticalFrames';
import type { TacticalStaticPlayer } from '@/components/school/TacticalStaticSvg';
import { renderTacticalPng } from './tacticalImage';
import { frameToStatic } from './tacticalInterpolation';
import { cleanPdfText as clean } from './tacticalExportUtils';

export interface ExercisePdfInput {
  title: string;
  objective?: string | null;
  minutes?: number | string | null;
  ageGroup?: string | null;
  materials?: string | null;
  description?: string | null;
  teamName?: string | null;
  frames: TacticalFrame[] | null;
  players: TacticalStaticPlayer[];
  arrows: TacticalArrow[];
  playerLabels?: Record<string, string>;
  playerJerseys?: Record<string, number | null>;
}

const BRAND_GREEN: [number, number, number] = [26, 97, 24]; // mismo verde que MesocycleExportButton/executivePdf
const BRAND_GREEN_SOFT: [number, number, number] = [232, 243, 231];
const TEXT_DARK: [number, number, number] = [31, 41, 55];
const TEXT_MUTED: [number, number, number] = [107, 114, 128];
const MARGIN = 15;
const PITCH_ASPECT = 340 / 300;
export const PDF_MAX_STRIP = 6;

/** Casillas de la tira: hasta 6 miniaturas; con más cuadros, 5 + «+n». */
export function stripSlots(frameCount: number): { thumbs: number; more: number } {
  if (frameCount <= 1) return { thumbs: 0, more: 0 };
  if (frameCount <= PDF_MAX_STRIP) return { thumbs: frameCount, more: 0 };
  return { thumbs: PDF_MAX_STRIP - 1, more: frameCount - (PDF_MAX_STRIP - 1) };
}

export async function exportExercisePdf(input: ExercisePdfInput): Promise<Blob> {
  const frames = input.frames && input.frames.length > 0 ? input.frames : null;
  const first = frames
    ? frameToStatic(frames[0], input.playerLabels, input.playerJerseys)
    : { players: input.players || [], arrows: input.arrows || [] };
  const { thumbs, more } = stripSlots(frames?.length ?? 0);

  const main = await renderTacticalPng(first.players, first.arrows, 900);
  const thumbImgs: string[] = [];
  for (let i = 0; i < thumbs; i++) {
    const s = frameToStatic(frames![i], input.playerLabels, input.playerJerseys);
    thumbImgs.push((await renderTacticalPng(s.players, s.arrows, 300)).dataUrl);
  }

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN * 2;
  const bottom = pageH - 16;

  // ── Encabezado ──────────────────────────────────────────────────────────
  doc.setFillColor(...BRAND_GREEN);
  doc.rect(0, 0, pageW, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('FICHA DEL EJERCICIO', MARGIN, 8);
  const team = clean(input.teamName);
  if (team) doc.text(doc.splitTextToSize(team, 80)[0] ?? '', pageW - MARGIN, 8, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(doc.splitTextToSize(clean(input.title) || 'Ejercicio', contentW)[0] ?? '', MARGIN, 17.5);

  // ── Jugada grande ───────────────────────────────────────────────────────
  let y = 30;
  const mainW = thumbs > 0 ? 100 : 118;
  const mainH = mainW * (main.aspect || PITCH_ASPECT);
  doc.addImage(main.dataUrl, 'PNG', (pageW - mainW) / 2, y, mainW, mainH);
  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.3);
  doc.rect((pageW - mainW) / 2, y, mainW, mainH);
  y += mainH + 6;

  // ── Secuencia de cuadros ────────────────────────────────────────────────
  if (thumbs > 0 && frames) {
    doc.setTextColor(...TEXT_MUTED);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(`SECUENCIA (${frames.length} cuadros)`, MARGIN, y);
    y += 2.5;
    const gap = 3;
    const slotW = (contentW - gap * (PDF_MAX_STRIP - 1)) / PDF_MAX_STRIP;
    const slotH = slotW * PITCH_ASPECT;
    thumbImgs.forEach((img, i) => {
      const x = MARGIN + i * (slotW + gap);
      doc.addImage(img, 'PNG', x, y, slotW, slotH);
      doc.setDrawColor(209, 213, 219);
      doc.rect(x, y, slotW, slotH);
      doc.setFillColor(...BRAND_GREEN);
      doc.circle(x + 3.6, y + 3.6, 2.8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(String(i + 1), x + 3.6, y + 4.6, { align: 'center' });
    });
    if (more > 0) {
      const x = MARGIN + thumbs * (slotW + gap);
      doc.setFillColor(...BRAND_GREEN_SOFT);
      doc.setDrawColor(209, 213, 219);
      doc.rect(x, y, slotW, slotH, 'FD');
      doc.setTextColor(...BRAND_GREEN);
      doc.setFontSize(16);
      doc.text(`+${more}`, x + slotW / 2, y + slotH / 2 + 2, { align: 'center' });
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('cuadros más', x + slotW / 2, y + slotH / 2 + 7, { align: 'center' });
    }
    y += slotH + 7;
  }

  // ── Campos ──────────────────────────────────────────────────────────────
  const minutes = clean(input.minutes);
  const meta: [string, string][] = [
    ['Duración', minutes ? `${minutes} min` : ''],
    ['Edad o categoría', clean(input.ageGroup)],
  ];
  const metaFilled = meta.filter(([, v]) => v);
  if (metaFilled.length) {
    doc.setFillColor(...BRAND_GREEN_SOFT);
    doc.rect(MARGIN, y - 4.5, contentW, 8, 'F');
    let x = MARGIN + 3;
    for (const [label, value] of metaFilled) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...BRAND_GREEN);
      doc.text(`${label}:`, x, y + 0.6);
      const lw = doc.getTextWidth(`${label}: `);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...TEXT_DARK);
      doc.text(value, x + lw, y + 0.6);
      x += lw + doc.getTextWidth(value) + 10;
    }
    y += 9;
  }

  const sections: [string, string][] = [
    ['Objetivo', clean(input.objective)],
    ['Material', clean(input.materials)],
    ['Descripción', clean(input.description)],
  ];
  const LINE = 4.4;
  for (const [label, value] of sections) {
    if (!value) continue;
    if (y + 10 > bottom) break;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...BRAND_GREEN);
    doc.text(label.toUpperCase(), MARGIN, y);
    y += 4.8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...TEXT_DARK);
    const lines = doc.splitTextToSize(value, contentW) as string[];
    const room = Math.max(1, Math.floor((bottom - y) / LINE));
    const shown = lines.slice(0, room);
    if (lines.length > room) shown[shown.length - 1] = `${shown[shown.length - 1].replace(/\s*\S{0,3}$/, '')}…`;
    doc.text(shown, MARGIN, y);
    y += shown.length * LINE + 4;
  }

  // ── Pie ─────────────────────────────────────────────────────────────────
  doc.setDrawColor(229, 231, 235);
  doc.line(MARGIN, pageH - 11, pageW - MARGIN, pageH - 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`SportMaps · Ficha generada el ${format(new Date(), 'dd/MM/yyyy')}`, MARGIN, pageH - 6.5);
  if (team) doc.text(doc.splitTextToSize(team, 80)[0] ?? '', pageW - MARGIN, pageH - 6.5, { align: 'right' });

  return doc.output('blob');
}
