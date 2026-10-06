/**
 * TEST ESPEJO — bff/src/utils/prorationUtils.ts vs frontend/src/lib/prorationUtils.ts
 * (docs/specs/dreamers-niveles-por-horas-y-progresion.md §6 / §8.5).
 *
 * El frontend usa su copia solo como PREVIEW («así quedará el cobro»); el cobro
 * real lo calcula el BFF. Si divergen, la pantalla miente. Este test corre los
 * mismos casos contra las dos implementaciones y falla si se separan.
 *
 * La fórmula nueva de F7 (clases restantes) NO tiene espejo a propósito: vive
 * solo en el BFF (utils/remainingClasses.ts) y el frontend pide un preview.
 *
 * Divergencia EXISTENTE documentada (C-06 del censo de cálculos): `rolling_30`
 * arma `description` distinto en cada lado (BFF: "Ciclo 30 días: A → B";
 * frontend: "Ciclo 30 días — vence 23 sept") y el frontend acepta `lastDueDate`.
 * Monto, vencimiento y período coinciden; el texto no. Va como `it.fails`: el
 * día que alguien las alinee, este test empieza a fallar y hay que pasarlo a `it`.
 */
import { describe, expect, it } from 'vitest';
import * as bff from './prorationUtils';
import * as front from '../../../frontend/src/lib/prorationUtils';

const FECHAS = ['2026-08-01', '2026-08-24', '2026-08-31', '2026-02-15', '2028-02-29', '2026-12-20', '2026-09-10', '2026-09-11'];
const CORTES = [1, 5, 10, 28, 31];
const CUOTA = 723000;

function nucleo(c: { amount: number; dueDate: string; isFullMonth: boolean; periodYear: number; periodMonth: number }) {
  return { amount: c.amount, dueDate: c.dueDate, isFullMonth: c.isFullMonth, periodYear: c.periodYear, periodMonth: c.periodMonth };
}

describe('espejo calcFirstPayment — prorated y fixed_calendar (deben ser idénticos)', () => {
  for (const ciclo of ['prorated', 'fixed_calendar'] as const) {
    for (const fecha of FECHAS) {
      for (const corte of CORTES) {
        it(`${ciclo} ${fecha} corte ${corte}`, () => {
          const b = bff.calcFirstPayment(fecha, CUOTA, ciclo, corte);
          const f = front.calcFirstPayment(fecha, CUOTA, ciclo, corte);
          expect(nucleo(f)).toEqual(nucleo(b));
          expect(f.description).toBe(b.description);
        });
      }
    }
  }
});

describe('espejo calcFirstPayment — rolling_30', () => {
  for (const fecha of FECHAS) {
    it(`rolling_30 ${fecha}: monto, vencimiento y período coinciden`, () => {
      const b = bff.calcFirstPayment(fecha, CUOTA, 'rolling_30', 10);
      const f = front.calcFirstPayment(fecha, CUOTA, 'rolling_30', 10);
      expect(nucleo(f)).toEqual(nucleo(b));
    });
  }

  it.fails('C-06 (divergencia existente): rolling_30 arma description distinto en BFF y frontend', () => {
    const b = bff.calcFirstPayment('2026-08-24', CUOTA, 'rolling_30', 10);
    const f = front.calcFirstPayment('2026-08-24', CUOTA, 'rolling_30', 10);
    expect(f.description).toBe(b.description);
  });
});

describe('espejo formatCOP', () => {
  it('mismo formato en los dos lados', () => {
    for (const n of [0, 1000, 180750, 723000, 1230000]) {
      expect(front.formatCOP(n)).toBe(bff.formatCOP(n));
    }
  });
});
