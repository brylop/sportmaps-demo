/**
 * Geometría de impresión de carnets y utilidades puras (sin DOM) — se prueban
 * en cardLayout.test.ts. La exportación real (html2canvas + jsPDF) vive en
 * cardExport.tsx y usa estas cuentas.
 *
 * El carnet es una CR80 vertical: 53,98 × 85,6 mm (ISO/IEC 7810 ID-1). El
 * componente AthleteIdCard la dibuja a 340 × 540 px, que es la misma relación.
 */

export const CR80_W_MM = 53.98;
export const CR80_H_MM = 85.6;

/** Medidas CSS del componente AthleteIdCard (no cambiar sin cambiar el componente). */
export const CARD_CSS_W = 340;
export const CARD_CSS_H = 540;

/** Escala de captura para el PDF: ≥ 2 y ≥ 300 dpi a tamaño CR80 real. */
export const PDF_CAPTURE_SCALE = Math.max(2, Math.ceil(((CR80_W_MM / 25.4) * 300 / CARD_CSS_W) * 10) / 10);
/** Escala de captura para el PNG suelto (≈ 640 dpi a tamaño real). */
export const PNG_CAPTURE_SCALE = 4;

/**
 * - `duplex`: una hoja de frentes (3×3) y la siguiente con los reversos en
 *   espejo, para imprimir a doble cara volteando por el borde largo.
 * - `together`: frente y reverso lado a lado (A4 horizontal, 4 carnets por hoja),
 *   para impresoras sin doble cara: se recorta y se pega o plastifica.
 */
export type PdfLayoutMode = 'duplex' | 'together';

export type FacePlacement = {
  /** Índice del carnet en la lista recibida. */
  card: number;
  face: 'front' | 'back';
  x: number;
  y: number;
  w: number;
  h: number;
};

export type PdfPage = {
  orientation: 'portrait' | 'landscape';
  faces: FacePlacement[];
};

const A4 = { w: 210, h: 297 };

/** Calcula página por página dónde va cada cara. Puro: no toca jsPDF. */
export function computePdfPages(count: number, mode: PdfLayoutMode): PdfPage[] {
  const pages: PdfPage[] = [];
  if (count <= 0) return pages;

  if (mode === 'duplex') {
    const cols = 3, rows = 3, gap = 6;
    const perSheet = cols * rows;
    const gridW = cols * CR80_W_MM + (cols - 1) * gap;
    const gridH = rows * CR80_H_MM + (rows - 1) * gap;
    // Centrado: así, al voltear la hoja, los reversos caen exactamente detrás.
    const x0 = (A4.w - gridW) / 2;
    const y0 = (A4.h - gridH) / 2;
    for (let start = 0; start < count; start += perSheet) {
      const fronts: FacePlacement[] = [];
      const backs: FacePlacement[] = [];
      for (let i = start; i < Math.min(count, start + perSheet); i++) {
        const slot = i - start;
        const col = slot % cols;
        const row = Math.floor(slot / cols);
        const y = y0 + row * (CR80_H_MM + gap);
        fronts.push({ card: i, face: 'front', x: x0 + col * (CR80_W_MM + gap), y, w: CR80_W_MM, h: CR80_H_MM });
        // Volteo por el borde largo: la columna se refleja, la fila no.
        const mirrored = cols - 1 - col;
        backs.push({ card: i, face: 'back', x: x0 + mirrored * (CR80_W_MM + gap), y, w: CR80_W_MM, h: CR80_H_MM });
      }
      pages.push({ orientation: 'portrait', faces: fronts });
      pages.push({ orientation: 'portrait', faces: backs });
    }
    return pages;
  }

  // together — A4 horizontal: 2 parejas por fila × 2 filas.
  const L = { w: A4.h, h: A4.w };
  const pairGap = 4;        // entre frente y reverso del mismo carnet
  const colGap = 14;        // entre parejas
  const rowGap = 8;
  const pairsPerRow = 2, rows = 2;
  const pairW = 2 * CR80_W_MM + pairGap;
  const gridW = pairsPerRow * pairW + (pairsPerRow - 1) * colGap;
  const gridH = rows * CR80_H_MM + (rows - 1) * rowGap;
  const x0 = (L.w - gridW) / 2;
  const y0 = (L.h - gridH) / 2;
  const perSheet = pairsPerRow * rows;
  for (let start = 0; start < count; start += perSheet) {
    const faces: FacePlacement[] = [];
    for (let i = start; i < Math.min(count, start + perSheet); i++) {
      const slot = i - start;
      const col = slot % pairsPerRow;
      const row = Math.floor(slot / pairsPerRow);
      const x = x0 + col * (pairW + colGap);
      const y = y0 + row * (CR80_H_MM + rowGap);
      faces.push({ card: i, face: 'front', x, y, w: CR80_W_MM, h: CR80_H_MM });
      faces.push({ card: i, face: 'back', x: x + CR80_W_MM + pairGap, y, w: CR80_W_MM, h: CR80_H_MM });
    }
    pages.push({ orientation: 'landscape', faces });
  }
  return pages;
}

/** Marcas de corte en las cuatro esquinas, por fuera del carnet. */
export function cutMarkSegments(p: { x: number; y: number; w: number; h: number }, len = 4, offset = 1.5): [number, number, number, number][] {
  const { x, y, w, h } = p;
  const r = x + w, b = y + h;
  return [
    // arriba-izquierda
    [x - offset - len, y, x - offset, y], [x, y - offset - len, x, y - offset],
    // arriba-derecha
    [r + offset, y, r + offset + len, y], [r, y - offset - len, r, y - offset],
    // abajo-izquierda
    [x - offset - len, b, x - offset, b], [x, b + offset, x, b + offset + len],
    // abajo-derecha
    [r + offset, b, r + offset + len, b], [r, b + offset, r, b + offset + len],
  ];
}

/** Nombre de archivo seguro: sin tildes, espacios ni símbolos. */
export function slugifyFileName(s: string | null | undefined, fallback = 'carnet'): string {
  const out = (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return out || fallback;
}

/** Los motivos de revocación que pone el sistema llegan en inglés desde la base. */
const REVOCATION_REASONS: Record<string, string> = {
  'replaced by new issuance': 'Reemplazado por un carnet nuevo',
  'replaced': 'Reemplazado por un carnet nuevo',
  'lost': 'Reportado como perdido',
  'expired': 'Vencido',
};

export function translateRevocationReason(reason: string | null | undefined): string | null {
  if (!reason) return null;
  const key = reason.trim().toLowerCase();
  return REVOCATION_REASONS[key] ?? reason;
}

/**
 * Vista del acudiente: de cada atleta se muestra solo el carnet vigente (o el
 * más reciente si ninguno está vigente) y se cuenta cuántos anteriores quedaron
 * revocados, para una nota pequeña en vez de una tarjeta "Revocado" más.
 */
export function pickCurrentCards<T extends { athlete_id: string; status: string; version: number; issued_at: string; is_expired?: boolean }>(
  rows: T[],
): { card: T; revokedCount: number }[] {
  const byAthlete = new Map<string, T[]>();
  for (const r of rows) {
    const list = byAthlete.get(r.athlete_id) ?? [];
    list.push(r);
    byAthlete.set(r.athlete_id, list);
  }
  const out: { card: T; revokedCount: number }[] = [];
  for (const list of byAthlete.values()) {
    const sorted = [...list].sort((a, b) => (b.version - a.version) || (Date.parse(b.issued_at) - Date.parse(a.issued_at)));
    const current = sorted.find((c) => c.status !== 'revoked') ?? sorted[0];
    const revokedCount = list.filter((c) => c !== current && c.status === 'revoked').length;
    out.push({ card: current, revokedCount });
  }
  return out;
}

const PRIVATE_FIELDS = ['doc_number', 'fee_status', 'blood_type', 'emergency_contact', 'eps', 'tshirt_size', 'plan'] as const;

type MaskableCard = {
  viewer?: string;
  athlete?: Record<string, unknown> | null;
  template?: { show_fields?: Record<string, boolean> } | null;
  fee_status?: unknown;
  last_payment?: unknown;
  monthly_fee?: unknown;
  last_paid_at?: unknown;
  next_due?: unknown;
};

/**
 * Defensa en la página pública: la RPC nueva ya no manda lo privado al
 * público (viewer = 'public'), pero mientras la migración no esté aplicada la
 * RPC vieja lo sigue mandando. Sin sesión, la página lo descarta antes de
 * pintar. No reemplaza al arreglo en la base: los datos igual viajan en la
 * respuesta hasta que se aplique.
 */
export function maskPrivateCardData<T extends MaskableCard>(data: T): T {
  const athlete = data.athlete
    ? Object.fromEntries(Object.entries(data.athlete).filter(([k]) =>
        !['doc_type', 'doc_number', 'blood_type', 'eps_name', 'tshirt_size', 'emergency_contact'].includes(k)))
    : data.athlete;
  const show = { ...(data.template?.show_fields || {}) };
  for (const f of PRIVATE_FIELDS) show[f] = false;
  return {
    ...data,
    viewer: 'public',
    athlete,
    template: data.template ? { ...data.template, show_fields: show } : data.template,
    fee_status: null,
    last_payment: null,
    monthly_fee: null,
    last_paid_at: null,
    next_due: null,
  };
}
