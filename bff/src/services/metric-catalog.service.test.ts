/**
 * Evaluación por escuela (services/metric-catalog.service, spec F5).
 *
 * Lo que se vigila:
 *   · sin configuración, la lista corta por defecto de fútbol (5 métricas 1-5);
 *   · fuera del modal: asistencia_entrenamiento, focus_*, mesociclo_* y las
 *     post-entreno (category IS NULL), tanto en la rápida como en la completa;
 *   · con configuración, manda la escuela: orden, nombre propio, escala;
 *     las filas solo de partido o inactivas no cuentan;
 *   · otro deporte sin las claves de fútbol cae a sus escalas 1-5;
 *   · guardar la configuración: orden, 'match' → 'both', quitar 'both' →
 *     'match', quitar 'training' → inactiva, claves inválidas o de más → error.
 *
 * Cero red: las funciones probadas son puras.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../config/supabase', () => ({ supabase: {} }));

import {
  buildMetricSettingsUpsert,
  defaultQuickKeys,
  isEntryEligible,
  MAX_SCHOOL_METRICS,
  MetricSettingsError,
  scaleForDefinition,
  selectEvaluationCatalog,
  type MetricDefinition,
  type SchoolMetricRow,
} from './metric-catalog.service';

function def(
  metric_key: string,
  category: string | null,
  data_type = 'rating',
  min: number | null = 1,
  max: number | null = 5
): MetricDefinition {
  return {
    id: `id-${metric_key}`,
    metric_key,
    display_name: metric_key.replace(/_/g, ' '),
    parent_label: null,
    parent_hint: null,
    data_type,
    unit: null,
    category,
    subcategory: null,
    min_value: min,
    max_value: max,
    higher_is_better: true,
    is_active: true,
    aggregation: 'latest',
    options: null,
    required: false,
    thresholds: [],
  };
}

/** Catálogo de fútbol tal como está vivo (2026-10-08), resumido. */
const FUTBOL: MetricDefinition[] = [
  def('asistencia_entrenamiento', 'attendance', 'numeric', null, null),
  def('actitud_esfuerzo', 'physical'),
  def('distancia_recorrida', 'physical', 'numeric', null, null),
  def('focus_intensidad_fisica', 'physical', 'count', 0, 1),
  def('mesociclo_condicion_fisica', 'physical', 'rating', 1, 10),
  def('minutos_jugados', 'physical', 'numeric', null, null),
  def('duelos_ganados', 'tactical', 'count', null, null),
  def('posicionamiento_tactico', 'tactical'),
  def('mesociclo_toma_decisiones', 'tactical', 'rating', 1, 10),
  def('control_balon', 'technical'),
  def('definicion', 'technical'),
  def('goles', 'technical', 'count', null, null),
  def('precision_pase', 'technical'),
  def('focus_regate', 'technical', 'count', 0, 1),
  def('coach_effort_rating', null, 'rating', 50, 100),
  def('rpe_borg', null, 'rating', 0, 10),
  def('satisfaction', null, 'rating', 1, 5),
];

const EXCLUIDAS = [
  'asistencia_entrenamiento',
  'focus_intensidad_fisica',
  'focus_regate',
  'mesociclo_condicion_fisica',
  'mesociclo_toma_decisiones',
  'coach_effort_rating',
  'rpe_borg',
  'satisfaction',
];

function row(partial: Partial<SchoolMetricRow> & { metric_key: string }): SchoolMetricRow {
  return {
    display_name: partial.metric_key,
    description: null,
    scale: 'scale_1_5',
    unit: null,
    min_value: 1,
    max_value: 5,
    options: null,
    applies_to: 'training',
    sort_order: 0,
    is_active: true,
    source_definition_id: null,
    created_by: null,
    ...partial,
  };
}

describe('isEntryEligible', () => {
  it('saca asistencia, focus_*, mesociclo_* y las post-entreno', () => {
    for (const k of EXCLUIDAS) {
      const d = FUTBOL.find((m) => m.metric_key === k)!;
      expect(isEntryEligible(d), k).toBe(false);
    }
    expect(isEntryEligible(FUTBOL.find((m) => m.metric_key === 'goles')!)).toBe(true);
  });
});

describe('scaleForDefinition', () => {
  it('traduce el catálogo a la escala de captura', () => {
    expect(scaleForDefinition(def('a', 'x'))).toBe('scale_1_5');
    expect(scaleForDefinition(def('a', 'x', 'rating', 1, 10))).toBe('scale_1_10');
    expect(scaleForDefinition(def('a', 'x', 'count', 0, 1))).toBe('yes_no');
    expect(scaleForDefinition(def('a', 'x', 'numeric', null, null))).toBe('number');
    expect(scaleForDefinition(def('a', 'x', 'rating', 50, 100))).toBe('number');
  });
});

describe('selectEvaluationCatalog — sin configuración de la escuela', () => {
  it('devuelve la lista corta de fútbol, en el orden del spec', () => {
    const ev = selectEvaluationCatalog(FUTBOL, []);
    expect(ev.source).toBe('default');
    expect(ev.quick.map((m) => m.metric_key)).toEqual([
      'actitud_esfuerzo',
      'control_balon',
      'precision_pase',
      'posicionamiento_tactico',
      'definicion',
    ]);
    expect(ev.quick.every((m) => m.scale === 'scale_1_5')).toBe(true);
  });

  it('la "Evaluación completa" trae el resto capturable, sin excluidas ni repetidas', () => {
    const ev = selectEvaluationCatalog(FUTBOL, []);
    expect(ev.full_keys.sort()).toEqual(['distancia_recorrida', 'duelos_ganados', 'goles', 'minutos_jugados']);
    for (const k of EXCLUIDAS) expect(ev.full_keys).not.toContain(k);
  });

  it('ignora filas solo de partido o inactivas', () => {
    const ev = selectEvaluationCatalog(FUTBOL, [
      row({ metric_key: 'goles', applies_to: 'match' }),
      row({ metric_key: 'duelos_ganados', is_active: false }),
    ]);
    expect(ev.source).toBe('default');
    expect(ev.quick).toHaveLength(5);
  });

  it('otro deporte sin claves de fútbol cae a sus escalas 1-5, máximo 5', () => {
    const otro = [
      def('saque', 'technical', 'numeric', null, null),
      def('recepcion', 'technical'),
      def('bloqueo', 'technical'),
      def('focus_saque', 'technical', 'count', 0, 1),
      def('altura_salto', 'physical', 'numeric', null, null),
    ];
    expect(defaultQuickKeys(otro)).toEqual(['recepcion', 'bloqueo', 'saque', 'altura_salto']);
  });

  it('sin catálogo no hay nada que evaluar', () => {
    expect(selectEvaluationCatalog([], [])).toEqual({ source: 'default', quick: [], full_keys: [] });
  });
});

describe('selectEvaluationCatalog — la escuela eligió', () => {
  const rows = [
    row({ metric_key: 'goles', sort_order: 20, scale: 'number', min_value: null, max_value: null, source_definition_id: 'id-goles' }),
    row({ metric_key: 'actitud_esfuerzo', sort_order: 10, display_name: 'Actitud', applies_to: 'both' }),
    row({ metric_key: 'control_balon', sort_order: 5, is_active: false }),
    row({ metric_key: 'definicion', sort_order: 1, applies_to: 'match' }),
  ];

  it('manda su lista, en su orden y con su nombre', () => {
    const ev = selectEvaluationCatalog(FUTBOL, rows);
    expect(ev.source).toBe('school');
    expect(ev.quick.map((m) => m.metric_key)).toEqual(['actitud_esfuerzo', 'goles']);
    expect(ev.quick[0].display_name).toBe('Actitud');
    expect(ev.quick[1].scale).toBe('number');
    expect(ev.quick[1].category).toBe('technical');
  });

  it('lo no elegido queda en la completa (y las rápidas no se repiten)', () => {
    const ev = selectEvaluationCatalog(FUTBOL, rows);
    expect(ev.full_keys).toContain('control_balon');
    expect(ev.full_keys).toContain('definicion');
    expect(ev.full_keys).not.toContain('goles');
    expect(ev.full_keys).not.toContain('actitud_esfuerzo');
  });
});

describe('buildMetricSettingsUpsert', () => {
  const base = { schoolId: 'sch', userId: 'u1', catalog: FUTBOL, now: '2026-10-08T00:00:00Z' };

  it('escribe la elección en orden, como training, con la escala del catálogo', () => {
    const out = buildMetricSettingsUpsert({ ...base, selectedKeys: ['goles', 'actitud_esfuerzo'], existing: [] });
    expect(out.map((r) => [r.metric_key, r.sort_order, r.applies_to, r.is_active, r.scale])).toEqual([
      ['goles', 10, 'training', true, 'number'],
      ['actitud_esfuerzo', 20, 'training', true, 'scale_1_5'],
    ]);
    expect(out[0].source_definition_id).toBe('id-goles');
    expect(out[0].created_by).toBe('u1');
  });

  it('todas las filas llevan las mismas columnas (upsert por lote)', () => {
    const out = buildMetricSettingsUpsert({
      ...base,
      selectedKeys: ['goles'],
      existing: [row({ metric_key: 'definicion', applies_to: 'training' })],
    });
    const cols = Object.keys(out[0]).sort();
    for (const r of out) expect(Object.keys(r).sort()).toEqual(cols);
  });

  it('respeta los partidos: match → both al elegir; both → match al quitar', () => {
    const out = buildMetricSettingsUpsert({
      ...base,
      selectedKeys: ['goles'],
      existing: [
        row({ metric_key: 'goles', applies_to: 'match', display_name: 'Goles (partido)', created_by: 'otro' }),
        row({ metric_key: 'definicion', applies_to: 'both' }),
      ],
    });
    const goles = out.find((r) => r.metric_key === 'goles')!;
    expect(goles.applies_to).toBe('both');
    expect(goles.display_name).toBe('Goles (partido)');
    expect(goles.created_by).toBe('otro');
    const definicion = out.find((r) => r.metric_key === 'definicion')!;
    expect(definicion.applies_to).toBe('match');
    expect(definicion.is_active).toBe(true);
  });

  it('quitar una de entrenamiento la desactiva; las de partido no se tocan', () => {
    const out = buildMetricSettingsUpsert({
      ...base,
      selectedKeys: [],
      existing: [
        row({ metric_key: 'control_balon', applies_to: 'training' }),
        row({ metric_key: 'goles', applies_to: 'match' }),
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ metric_key: 'control_balon', is_active: false, applies_to: 'training' });
  });

  it('rechaza claves excluidas o ajenas al deporte', () => {
    expect(() =>
      buildMetricSettingsUpsert({ ...base, selectedKeys: ['focus_regate'], existing: [] })
    ).toThrow(MetricSettingsError);
    expect(() =>
      buildMetricSettingsUpsert({ ...base, selectedKeys: ['no_existe'], existing: [] })
    ).toThrow(/no_existe/);
  });

  it(`rechaza más de ${MAX_SCHOOL_METRICS}`, () => {
    const many = Array.from({ length: MAX_SCHOOL_METRICS + 1 }, (_, i) => def(`m_${i}`, 'technical'));
    expect(() =>
      buildMetricSettingsUpsert({
        ...base,
        catalog: many,
        selectedKeys: many.map((d) => d.metric_key),
        existing: [],
      })
    ).toThrow(MetricSettingsError);
  });

  it('claves repetidas cuentan una vez', () => {
    const out = buildMetricSettingsUpsert({ ...base, selectedKeys: ['goles', 'goles'], existing: [] });
    expect(out).toHaveLength(1);
  });
});
