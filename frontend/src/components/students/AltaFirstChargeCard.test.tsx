import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { AltaFirstChargeCard, FeeWaivers, NO_FEE_WAIVERS, defaultFeeWaivers, feeWaiversPayload } from './AltaFirstChargeCard';

vi.mock('@/lib/dateUtils', () => ({ todayColombia: () => '2026-10-10' }));

const cop = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);
const norm = (s: string | null | undefined) => (s ?? '').replace(/\s/g, ' ');

function Harness(props: { insuranceActiveSince?: string | null; canWaive?: boolean; registrationFee?: number; insuranceFee?: number }) {
  const [w, setW] = useState<FeeWaivers>(defaultFeeWaivers(props.canWaive ?? true));
  return (
    <AltaFirstChargeCard
      startDate="2026-10-10"
      monthlyFee={245000}
      billing={{ billing_cycle_type: 'fixed_calendar', payment_cutoff_day: 5 }}
      discountPct={0}
      onDiscountChange={() => {}}
      registrationFee={props.registrationFee ?? 120000}
      insuranceFee={props.insuranceFee ?? 150000}
      waivers={w}
      onWaiversChange={setW}
      canWaive={props.canWaive}
      insuranceActiveSince={props.insuranceActiveSince}
    />
  );
}

const total = () => norm(screen.getByTestId('alta-total').textContent);

describe('AltaFirstChargeCard', () => {
  it('por defecto solo la mensualidad: inscripción y seguro son opt-in', () => {
    render(<Harness />);
    expect(total()).toContain(norm(cop(245000)));
    // Corte 5, alta el 10: vence el 10 de octubre (no «el 5 del próximo mes»).
    expect(norm(screen.getByTestId('alta-monthly-due').textContent)).toContain('10 de octubre de 2026');
  });

  it('«Cobrar inscripción» y «Cobrar seguro» suman al total', () => {
    render(<Harness />);
    fireEvent.click(screen.getByLabelText('Cobrar inscripción'));
    expect(total()).toContain(norm(cop(365000)));
    fireEvent.click(screen.getByLabelText('Cobrar seguro'));
    expect(total()).toContain(norm(cop(515000)));
  });

  it('seguro vigente: aviso, sin checkbox de seguro y sin sumarlo', () => {
    render(<Harness insuranceActiveSince="2026-03-02" />);
    expect(screen.getByText(/Ya tiene seguro vigente/)).toBeTruthy();
    expect(screen.queryByLabelText('Cobrar seguro')).toBeNull();
    fireEvent.click(screen.getByLabelText('Cobrar inscripción'));
    expect(total()).toContain(norm(cop(365000)));
  });

  it('plan sin pagos únicos: sin checkboxes', () => {
    render(<Harness registrationFee={0} insuranceFee={0} />);
    expect(screen.queryByLabelText('Cobrar inscripción')).toBeNull();
    expect(screen.queryByLabelText('Cobrar seguro')).toBeNull();
    expect(total()).toContain(norm(cop(245000)));
  });

  it('coach (canWaive=false): ve las líneas pero no puede exonerar', () => {
    render(<Harness canWaive={false} />);
    expect(screen.queryByLabelText('Cobrar inscripción')).toBeNull();
    expect(total()).toContain(norm(cop(515000)));
  });
});

describe('feeWaiversPayload', () => {
  it('sin exoneración no agrega campos (payload idéntico al de siempre)', () => {
    expect(feeWaiversPayload(NO_FEE_WAIVERS)).toEqual({});
  });
  it('solo manda lo exonerado', () => {
    expect(feeWaiversPayload({ registration: true, insurance: false })).toEqual({ waive_registration_fee: true });
  });
});
