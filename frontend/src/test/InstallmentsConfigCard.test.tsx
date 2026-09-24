import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { InstallmentsConfigCard } from '@/components/payment/InstallmentsConfigCard';

type Settings = Parameters<typeof InstallmentsConfigCard>[0]['settings'];

const base: Settings = {
  allow_installments: true,
  max_installments_per_payment: 2,
  min_installment_amount: 0,
  installment_require_proof: false,
};

/** Simula al padre real (PaymentsAutomationPage): guarda lo que el card confirma. */
function Harness({ initial = base, onCommit }: { initial?: Settings; onCommit?: (u: Partial<Settings>) => void }) {
  const [settings, setSettings] = useState<Settings>(initial);
  return (
    <InstallmentsConfigCard
      settings={settings}
      onChange={(u) => {
        onCommit?.(u);
        setSettings((s) => ({ ...s, ...u }));
      }}
    />
  );
}

// Regresión del reporte de Athletic League (2026-09-24): en el celular los dos
// campos numéricos "no dejaban borrar" porque `parseInt('') || 3` reescribía
// el valor por defecto en el mismo tick en que el campo quedaba vacío.
describe('InstallmentsConfigCard — campos numéricos que se pueden borrar', () => {
  it('permite dejar vacío "Máximo de abonos" y al salir vuelve al valor por defecto (3)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText('Máximo de abonos por pago') as HTMLInputElement;
    expect(input).toHaveValue(2);

    await user.clear(input);
    expect(input).toHaveValue(null); // vacío de verdad, no vuelve a 3 solo

    await user.tab(); // blur
    expect(input).toHaveValue(3);
  });

  it('confirma el número que se escribe (borrar y escribir 10 → 10)', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = screen.getByLabelText('Máximo de abonos por pago');

    await user.clear(input);
    await user.type(input, '10');
    expect(input).toHaveValue(10);
    expect(onCommit).toHaveBeenLastCalledWith({ max_installments_per_payment: 10 });

    await user.tab();
    expect(input).toHaveValue(10);
  });

  it('acota al rango 2..12 al salir del campo', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText('Máximo de abonos por pago');

    await user.clear(input);
    await user.type(input, '15');
    await user.tab();
    expect(input).toHaveValue(12);

    await user.clear(input);
    await user.type(input, '1');
    await user.tab();
    expect(input).toHaveValue(2);
  });

  it('permite borrar "Monto mínimo por abono" y al salir queda en 0', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness initial={{ ...base, min_installment_amount: 10000 }} onCommit={onCommit} />);
    const input = screen.getByLabelText('Monto mínimo por abono');
    expect(input).toHaveValue(10000);

    await user.clear(input);
    expect(input).toHaveValue(null);

    await user.tab();
    expect(input).toHaveValue(0);
    expect(onCommit).toHaveBeenLastCalledWith({ min_installment_amount: 0 });
  });

  it('re-sincroniza cuando el valor llega desde afuera (carga de settings)', () => {
    const onChange = vi.fn();
    const { rerender } = render(<InstallmentsConfigCard settings={base} onChange={onChange} />);
    const input = screen.getByLabelText('Máximo de abonos por pago');
    expect(input).toHaveValue(2);

    rerender(<InstallmentsConfigCard settings={{ ...base, max_installments_per_payment: 6 }} onChange={onChange} />);
    expect(input).toHaveValue(6);
  });
});
