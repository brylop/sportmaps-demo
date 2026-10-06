import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/bffClient', () => ({ bffClient: {} }));

import { dayNotAllowedMessage, isDayAllowed, weekdayOfDateString } from './levelProgression';
import { EMPTY_LEVEL_RULES, levelRulesFromPlan, levelRulesPayload } from '@/components/universal/PlanLevelRulesSection';

describe('días permitidos (F-F, D9)', () => {
  it('weekday de YYYY-MM-DD sin zona horaria (0 = domingo)', () => {
    expect(weekdayOfDateString('2026-10-04')).toBe(0);
    expect(weekdayOfDateString('2026-10-06')).toBe(2);
  });

  it('NULL / vacío = todos los días', () => {
    expect(isDayAllowed(undefined, '2026-10-06')).toBe(true);
    expect(isDayAllowed([], '2026-10-06')).toBe(true);
    expect(isDayAllowed([1, 3, 5], '2026-10-06')).toBe(false);
  });

  it('traduce el 422 day_not_allowed del BFF y deja pasar los demás errores', () => {
    expect(dayNotAllowedMessage({ status: 422, body: { reason: 'day_not_allowed', allowed_days: [5, 1] } }))
      .toBe('Tu plan solo permite reservar los días: lunes, viernes.');
    expect(dayNotAllowedMessage({ status: 422, body: { reserved: false, available_minutes: 0 } })).toBeNull();
    expect(dayNotAllowedMessage({ status: 409, body: { reason: 'day_not_allowed' } })).toBeNull();
  });
});

describe('"Ascenso y días" del editor de tarifas', () => {
  it('solo manda lo que cambió (un plan sin tocar no escribe columnas nuevas)', () => {
    const initial = levelRulesFromPlan({ allowed_days_of_week: null, promotion_threshold_points: null });
    expect(levelRulesPayload(initial, initial)).toEqual({});
    expect(levelRulesPayload({ ...initial, allowed_days: [3, 1] }, initial)).toEqual({ allowed_days_of_week: [1, 3] });
  });

  it('desmarcar todos los días vuelve a NULL (sin restricción)', () => {
    const initial = levelRulesFromPlan({ allowed_days_of_week: [1, 3] });
    expect(levelRulesPayload({ ...initial, allowed_days: [] }, initial)).toEqual({ allowed_days_of_week: null });
  });

  it('umbral y nivel: vacío = NULL', () => {
    expect(levelRulesPayload({ ...EMPTY_LEVEL_RULES, threshold: '34', min_level: 'nacional' }, EMPTY_LEVEL_RULES))
      .toEqual({ promotion_threshold_points: 34, promotion_min_competition_level: 'nacional' });
    const initial = levelRulesFromPlan({ promotion_threshold_points: 34, promotion_min_competition_level: 'regional' });
    expect(levelRulesPayload({ ...initial, threshold: '', min_level: '' }, initial))
      .toEqual({ promotion_threshold_points: null, promotion_min_competition_level: null });
  });
});
