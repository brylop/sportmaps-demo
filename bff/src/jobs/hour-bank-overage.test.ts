/**
 * F-E — cargo por horas de más (D8). Fija la fórmula del espejo TS de
 * public.hour_bank_overage_calc() y que el job solo llama a la RPC.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('../config/supabase', () => ({ supabase: { rpc } }));

const { computeHourBankOverage, runHourBankOverageSuggestions } = await import('./hour-bank-overage.job');

describe('computeHourBankOverage', () => {
  it('Dreamers agosto 2026 (PGA8x2): 1111 min de más con hour_up → 19 h × 22.062,5 = 419.188', () => {
    const r = computeHourBankOverage({
      includedMinutes: 960, consumedMinutes: 2071, planPrice: 353_000, rounding: 'hour_up',
    });
    expect(r).toEqual({ overageMinutes: 1111, billableHours: 19, hourlyRate: 22_062.5, amount: 419_188 });
  });

  it('rounding none: cobra los minutos exactos (fracción de hora)', () => {
    const r = computeHourBankOverage({
      includedMinutes: 960, consumedMinutes: 2071, planPrice: 353_000, rounding: 'none',
    });
    expect(r?.billableHours).toBe(18.5167);
    // 353000 × 1111 / 960 = 408523.96… → 408524
    expect(r?.amount).toBe(408_524);
  });

  it('hour_up se aplica al total del periodo: 1 min de más = 1 hora', () => {
    const r = computeHourBankOverage({
      includedMinutes: 600, consumedMinutes: 601, planPrice: 300_000, rounding: 'hour_up',
    });
    expect(r).toEqual({ overageMinutes: 1, billableHours: 1, hourlyRate: 30_000, amount: 30_000 });
  });

  it('hour_up con excedente exacto en horas no sube de más', () => {
    const r = computeHourBankOverage({
      includedMinutes: 600, consumedMinutes: 720, planPrice: 300_000, rounding: 'hour_up',
    });
    expect(r?.billableHours).toBe(2);
    expect(r?.amount).toBe(60_000);
  });

  it('tarifa de plan 723.000 / 24 h = 30.125 por hora', () => {
    const r = computeHourBankOverage({
      includedMinutes: 24 * 60, consumedMinutes: 24 * 60 + 150, planPrice: 723_000, rounding: 'hour_up',
    });
    expect(r?.hourlyRate).toBe(30_125);
    expect(r?.billableHours).toBe(3);
    expect(r?.amount).toBe(90_375);
  });

  it('tarifa fraccional (100.000 / 7 h) no arrastra el redondeo al monto', () => {
    const r = computeHourBankOverage({
      includedMinutes: 420, consumedMinutes: 600, planPrice: 100_000, rounding: 'hour_up',
    });
    expect(r?.hourlyRate).toBe(14_285.7143);
    // 3 h × 14285.714285… = 42857.14 → 42857 (no 3 × 14285.7143 redondeado distinto)
    expect(r?.amount).toBe(42_857);
  });

  it('sin excedente (consumo = incluido o menor) → nada que cobrar', () => {
    expect(computeHourBankOverage({ includedMinutes: 960, consumedMinutes: 960, planPrice: 353_000, rounding: 'hour_up' })).toBeNull();
    expect(computeHourBankOverage({ includedMinutes: 960, consumedMinutes: 100, planPrice: 353_000, rounding: 'none' })).toBeNull();
  });

  it('sin precio o sin minutos incluidos → no hay tarifa, nada que cobrar', () => {
    expect(computeHourBankOverage({ includedMinutes: 960, consumedMinutes: 2000, planPrice: 0, rounding: 'hour_up' })).toBeNull();
    expect(computeHourBankOverage({ includedMinutes: 0, consumedMinutes: 2000, planPrice: 353_000, rounding: 'hour_up' })).toBeNull();
  });
});

describe('runHourBankOverageSuggestions', () => {
  beforeEach(() => rpc.mockReset());

  it('llama solo a la RPC generadora, sin parámetros', async () => {
    rpc.mockResolvedValue({ data: { created: 1, skipped: 0, notified: 1 }, error: null });
    await runHourBankOverageSuggestions();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('generate_hour_bank_overage_suggestions');
  });

  it('un error de la RPC no revienta el cron', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(runHourBankOverageSuggestions()).resolves.toBeUndefined();
  });
});
