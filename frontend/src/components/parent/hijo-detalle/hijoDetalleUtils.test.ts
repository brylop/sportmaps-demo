import { describe, it, expect } from 'vitest';
import {
  POST_TRAINING_SECTIONS,
  attendanceLabel,
  attendanceTotals,
  deltaIsGood,
  deltaText,
  groupByMonth,
  longDateWithYear,
  matchScore,
  metricLabel,
  plural,
  reportTitle,
  respondieron,
} from './hijoDetalleUtils';

describe('asistencia', () => {
  it('traduce los estados crudos a palabras V2', () => {
    expect(attendanceLabel('present')).toBe('Vino');
    expect(attendanceLabel('late')).toBe('Llegó tarde');
    expect(attendanceLabel('excused')).toBe('Con excusa');
    expect(attendanceLabel('absent')).toBe('No vino');
    expect(attendanceLabel('cualquier_cosa')).toBe('No vino');
  });

  it('cuenta llegar tarde como haber venido (igual que el BFF)', () => {
    const t = attendanceTotals([
      { status: 'present' }, { status: 'late' }, { status: 'absent' }, { status: 'excused' },
    ]);
    expect(t).toEqual({ total: 4, came: 2, late: 1, absent: 1, excused: 1, pct: 50 });
    expect(attendanceTotals([]).pct).toBe(0);
    expect(attendanceTotals(null).total).toBe(0);
  });

  it('agrupa por mes, el más reciente primero', () => {
    const g = groupByMonth(
      [{ d: '2026-07-20' }, { d: '2026-09-02' }, { d: '2026-07-31' }],
      (r) => r.d,
    );
    expect(g.map((x) => x.label)).toEqual(['Septiembre 2026', 'Julio 2026']);
    expect(g[1].items.map((x) => x.d)).toEqual(['2026-07-31', '2026-07-20']);
  });
});

describe('informes', () => {
  it('titula con el mes en palabras', () => {
    expect(reportTitle(9, 2026)).toBe('Informe de septiembre 2026');
  });

  it('muestra la variación con signo y unidad, y nada si no cambió', () => {
    expect(deltaText(0.54, 'kg')).toBe('+0,5 kg');
    expect(deltaText(-3, 's')).toBe('−3 s');
    expect(deltaText(0.01)).toBeNull();
    expect(deltaText(null)).toBeNull();
  });

  it('respeta «menos es mejor»', () => {
    expect(deltaIsGood(-2, false)).toBe(true);
    expect(deltaIsGood(-2, true)).toBe(false);
    expect(deltaIsGood(0, true)).toBeNull();
  });

  it('nunca muestra la clave técnica de una medición', () => {
    expect(metricLabel('control_balon', 'control_balon')).toBe('Control balón');
    expect(metricLabel('Control de balón', 'control_balon')).toBe('Control de balón');
    expect(metricLabel(null, 'precision_pase')).toBe('Precisión pase');
  });
});

describe('partidos', () => {
  it('pone el marcador desde el lado de su equipo', () => {
    expect(matchScore({ is_home: false, home_score: 1, away_score: 3 })).toMatchObject({ text: '3 - 1', outcome: 'Ganó' });
    expect(matchScore({ is_home: true, home_score: 0, away_score: 2 })?.outcome).toBe('Perdió');
    expect(matchScore({ is_home: true, home_score: 1, away_score: 1 })?.outcome).toBe('Empató');
    expect(matchScore({ is_home: true, home_score: null, away_score: 1 })).toBeNull();
  });

  it('fecha larga con año, sin correrse de día', () => {
    expect(longDateWithYear('2026-10-04')).toBe('Domingo 4 de octubre de 2026');
  });
});

describe('informe del equipo', () => {
  it('usa palabras V2, nunca BORG ni RPE', () => {
    const titles = POST_TRAINING_SECTIONS.map((s) => s.title).join(' ');
    expect(titles).toContain('¿Qué tan duro fue?');
    expect(titles).not.toMatch(/borg|rpe/i);
  });

  it('concuerda en número', () => {
    expect(respondieron(1)).toBe('1 deportista respondió');
    expect(respondieron(12)).toBe('12 deportistas respondieron');
    expect(plural(1, 'entreno', 'entrenos')).toBe('1 entreno');
    expect(plural(3, 'entreno', 'entrenos')).toBe('3 entrenos');
  });
});
