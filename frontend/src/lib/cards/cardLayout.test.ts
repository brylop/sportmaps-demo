import { describe, expect, it } from 'vitest';
import {
  CR80_H_MM,
  CR80_W_MM,
  PDF_CAPTURE_SCALE,
  computePdfPages,
  cutMarkSegments,
  pickCurrentCards,
  slugifyFileName,
  translateRevocationReason,
  maskPrivateCardData,
} from './cardLayout';

describe('computePdfPages · duplex', () => {
  it('9 carnets → 2 hojas: frentes y reversos, todas las caras a tamaño CR80 exacto', () => {
    const pages = computePdfPages(9, 'duplex');
    expect(pages).toHaveLength(2);
    expect(pages[0].faces.every((f) => f.face === 'front')).toBe(true);
    expect(pages[1].faces.every((f) => f.face === 'back')).toBe(true);
    for (const f of pages.flatMap((p) => p.faces)) {
      expect(f.w).toBeCloseTo(CR80_W_MM, 5);
      expect(f.h).toBeCloseTo(CR80_H_MM, 5);
    }
  });

  it('ninguna cara se sale de la hoja A4 (antes la tercera fila quedaba cortada)', () => {
    for (const p of computePdfPages(20, 'duplex')) {
      for (const f of p.faces) {
        expect(f.x).toBeGreaterThanOrEqual(5);
        expect(f.y).toBeGreaterThanOrEqual(5);
        expect(f.x + f.w).toBeLessThanOrEqual(210 - 5);
        expect(f.y + f.h).toBeLessThanOrEqual(297 - 5);
      }
    }
  });

  it('el reverso queda en espejo horizontal: al voltear por el borde largo cae detrás de su frente', () => {
    const [fronts, backs] = computePdfPages(9, 'duplex');
    for (const front of fronts.faces) {
      const back = backs.faces.find((b) => b.card === front.card)!;
      expect(back.y).toBeCloseTo(front.y, 5);
      // espejo respecto del centro de la hoja
      expect(back.x + back.w / 2).toBeCloseTo(210 - (front.x + front.w / 2), 5);
    }
  });

  it('10 carnets → 4 hojas (2 pliegos) y cada carnet aparece una vez por cara', () => {
    const pages = computePdfPages(10, 'duplex');
    expect(pages).toHaveLength(4);
    const fronts = pages.flatMap((p) => p.faces).filter((f) => f.face === 'front').map((f) => f.card);
    const backs = pages.flatMap((p) => p.faces).filter((f) => f.face === 'back').map((f) => f.card);
    expect(fronts.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(backs.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

describe('computePdfPages · together', () => {
  it('A4 horizontal, 4 carnets por hoja, frente y reverso lado a lado sin salirse', () => {
    const pages = computePdfPages(5, 'together');
    expect(pages).toHaveLength(2);
    expect(pages[0].orientation).toBe('landscape');
    expect(pages[0].faces).toHaveLength(8);
    for (const p of pages) {
      for (const f of p.faces) {
        expect(f.x + f.w).toBeLessThanOrEqual(297);
        expect(f.y + f.h).toBeLessThanOrEqual(210);
      }
    }
    const front = pages[0].faces.find((f) => f.card === 0 && f.face === 'front')!;
    const back = pages[0].faces.find((f) => f.card === 0 && f.face === 'back')!;
    expect(back.y).toBe(front.y);
    expect(back.x).toBeGreaterThan(front.x + front.w);
  });

  it('0 carnets → sin hojas', () => {
    expect(computePdfPages(0, 'together')).toEqual([]);
    expect(computePdfPages(0, 'duplex')).toEqual([]);
  });
});

describe('impresión', () => {
  it('la escala de captura da ≥ 300 dpi a tamaño real y nunca menos de 2', () => {
    expect(PDF_CAPTURE_SCALE).toBeGreaterThanOrEqual(2);
    const dpi = (340 * PDF_CAPTURE_SCALE) / (CR80_W_MM / 25.4);
    expect(dpi).toBeGreaterThanOrEqual(300);
  });

  it('marcas de corte: 8 segmentos fuera del carnet', () => {
    const segs = cutMarkSegments({ x: 10, y: 10, w: 54, h: 85.6 });
    expect(segs).toHaveLength(8);
    for (const [x1, y1, x2, y2] of segs) {
      const inside = (x: number, y: number) => x > 10 && x < 64 && y > 10 && y < 95.6;
      expect(inside(x1, y1) || inside(x2, y2)).toBe(false);
    }
  });
});

describe('textos', () => {
  it('traduce los motivos de revocación que pone el sistema', () => {
    expect(translateRevocationReason('Replaced by new issuance')).toBe('Reemplazado por un carnet nuevo');
    expect(translateRevocationReason('reportado como perdido')).toBe('reportado como perdido');
    expect(translateRevocationReason(null)).toBeNull();
  });

  it('slugifyFileName quita tildes y símbolos', () => {
    expect(slugifyFileName('Fútbol — Sub-15')).toBe('futbol-sub-15');
    expect(slugifyFileName('', 'x')).toBe('x');
  });
});

describe('pickCurrentCards', () => {
  const base = { issued_at: '2026-10-01T00:00:00Z' };
  it('deja solo el vigente por atleta y cuenta los revocados', () => {
    const out = pickCurrentCards([
      { ...base, athlete_id: 'a', status: 'revoked', version: 1 },
      { ...base, athlete_id: 'a', status: 'active', version: 2 },
      { ...base, athlete_id: 'b', status: 'active', version: 1 },
    ]);
    expect(out).toHaveLength(2);
    const a = out.find((o) => o.card.athlete_id === 'a')!;
    expect(a.card.version).toBe(2);
    expect(a.revokedCount).toBe(1);
    expect(out.find((o) => o.card.athlete_id === 'b')!.revokedCount).toBe(0);
  });

  it('si todos están revocados muestra el más reciente', () => {
    const out = pickCurrentCards([
      { ...base, athlete_id: 'a', status: 'revoked', version: 1 },
      { ...base, athlete_id: 'a', status: 'revoked', version: 2 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].card.version).toBe(2);
    expect(out[0].revokedCount).toBe(1);
  });
});

describe('maskPrivateCardData', () => {
  it('quita emergencia, EPS, RH, documento y pagos; deja nombre, equipo y foto', () => {
    const masked = maskPrivateCardData({
      viewer: undefined,
      athlete: { full_name: 'Ana', avatar_url: 'x', emergency_contact: '300', eps_name: 'EPS', blood_type: 'O+', doc_number: '1' },
      template: { show_fields: { emergency_contact: true, fee_status: true, team: true } },
      fee_status: 'paid',
      last_payment: { concept: 'Mensualidad', amount: 1 },
    });
    expect(masked.viewer).toBe('public');
    expect(masked.athlete).toEqual({ full_name: 'Ana', avatar_url: 'x' });
    expect(masked.template?.show_fields?.emergency_contact).toBe(false);
    expect(masked.template?.show_fields?.fee_status).toBe(false);
    expect(masked.template?.show_fields?.team).toBe(true);
    expect(masked.fee_status).toBeNull();
    expect(masked.last_payment).toBeNull();
  });
});
