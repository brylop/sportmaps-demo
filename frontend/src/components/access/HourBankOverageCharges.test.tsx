import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
vi.mock('@/lib/api/bffClient', () => ({
  bffClient: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a), patch: (...a: unknown[]) => patch(...a) },
  BFFError: class BFFError extends Error {},
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { HourBankOverageCharges, cuerpoDeAutomatizacion } from './HourBankOverageCharges';

const AJUSTES = {
  hours_plan_enabled: true,
  hour_bank_overage_charges_enabled: true,
  hours_billing_rounding: 'hour_up',
  overage_auto_confirm_max_hours: null,
  overage_auto_confirm_max_amount: null,
  balance_notice_steps: [],
  balance_notice_email_enabled: true,
};
const CARGOS = [
  { id: 'a', athlete_name: 'Camila', plan_name: 'PGC12x3', period_start: '2026-10-01', included_minutes: 2160, consumed_minutes: 2220, overage_minutes: 60, billable_hours: 1, hourly_rate: 26778, amount: 26778, rounding: 'hour_up' },
  { id: 'b', athlete_name: 'Sofía', plan_name: 'PGA8x2', period_start: '2026-10-01', included_minutes: 960, consumed_minutes: 1080, overage_minutes: 120, billable_hours: 2, hourly_rate: 22063, amount: 44126, rounding: 'hour_up' },
];

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><HourBankOverageCharges /></QueryClientProvider>);
}

beforeEach(() => {
  get.mockReset(); post.mockReset(); patch.mockReset();
  get.mockImplementation((url: string) => Promise.resolve(url.includes('overage-settings') ? AJUSTES : { charges: CARGOS }));
  post.mockResolvedValue({ confirmed: 2, skipped: [], errors: [] });
  patch.mockResolvedValue({ success: true });
});

describe('cuerpoDeAutomatizacion', () => {
  it('campos vacíos = null (apagado) y escalones de mayor a menor', () => {
    expect(cuerpoDeAutomatizacion({ maxHoras: '', maxMonto: ' ', steps: [0, 50, 20], correo: true })).toEqual({
      overage_auto_confirm_max_hours: null,
      overage_auto_confirm_max_amount: null,
      balance_notice_steps: [50, 20, 0],
      balance_notice_email_enabled: true,
    });
  });
  it('acepta coma decimal en las horas', () => {
    expect(cuerpoDeAutomatizacion({ maxHoras: '1,5', maxMonto: '60000', steps: [], correo: false })).toMatchObject({
      overage_auto_confirm_max_hours: 1.5, overage_auto_confirm_max_amount: 60000, balance_notice_email_enabled: false,
    });
  });
});

describe('<HourBankOverageCharges /> — Cobrar todos y automatización', () => {
  it('«Cobrar todos» muestra el total, pide confirmar y llama a confirm-all', async () => {
    montar();
    const boton = await screen.findByTestId('cobrar-todos');
    expect(boton.textContent).toContain('(2)');
    expect(screen.getAllByText(/\$70\.904/).length).toBeGreaterThan(0); // 26.778 + 44.126
    fireEvent.click(boton);
    const confirmar = await screen.findAllByRole('button', { name: /^Cobrar todos$/ });
    fireEvent.click(confirmar[confirmar.length - 1]);
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/v1/access/hour-bank-overage-charges/confirm-all', {}));
  });

  it('sin sugerencias no aparece «Cobrar todos»', async () => {
    get.mockImplementation((url: string) => Promise.resolve(url.includes('overage-settings') ? AJUSTES : { charges: [] }));
    montar();
    await screen.findByText(/Horas por encima del plan/);
    expect(screen.queryByTestId('cobrar-todos')).toBeNull();
  });

  it('guardar la automatización manda topes y escalones', async () => {
    montar();
    const horas = await screen.findByLabelText('Hasta (horas)');
    fireEvent.change(horas, { target: { value: '2' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mitad (50 %)' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Quedan pocas (20 %)' }));
    fireEvent.click(screen.getByTestId('guardar-automatizacion'));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/v1/access/hour-bank-overage-settings', {
      overage_auto_confirm_max_hours: 2,
      overage_auto_confirm_max_amount: null,
      balance_notice_steps: [50, 20],
      balance_notice_email_enabled: true,
    }));
  });

  it('con los cargos por horas de más apagados no se ofrece la automatización', async () => {
    get.mockImplementation((url: string) => Promise.resolve(url.includes('overage-settings')
      ? { ...AJUSTES, hour_bank_overage_charges_enabled: false } : { charges: [] }));
    montar();
    await screen.findByText(/Horas por encima del plan/);
    expect(screen.queryByTestId('automatizacion')).toBeNull();
  });
});
