/**
 * La barra fija «Pagar / Ya transferí» y la burbuja de Mapi van las dos fijas
 * abajo a la derecha: mientras la barra se ve, la burbuja se esconde
 * (QA deportista V2, 2026-10-25 — tapaba «Ya transferí: subir el comprobante»).
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { AcuPagosV2 } from './AcuPagosV2';
import { useFabSoporteOculto } from '@/lib/supportFab';
import type { Transaction } from './pagosModel';

function Sonda() {
  return <span data-testid="fab">{useFabSoporteOculto() ? 'oculto' : 'visible'}</span>;
}

const cobro: Transaction = {
  id: 'p1', amount: 150000, status: 'pending', reference: 'Mensualidad', transaction_date: '2026-10-01',
};
const noop = () => {};
const pagos = (transactions: Transaction[]) => (
  <AcuPagosV2 state="ready" transactions={transactions} onRetry={noop} onPay={noop} onUploadProof={noop} onShowReceipt={noop} />
);

describe('AcuPagosV2 · burbuja de soporte', () => {
  it('con cobros por pagar la barra está a la vista y la burbuja se esconde; al salir, vuelve', () => {
    const { getByTestId, unmount } = render(<><Sonda />{pagos([cobro])}</>);
    expect(getByTestId('fab').textContent).toBe('oculto');
    unmount();
    const sola = render(<Sonda />);
    expect(sola.getByTestId('fab').textContent).toBe('visible');
  });

  it('sin nada por pagar no hay barra y la burbuja sigue visible', () => {
    const { getByTestId } = render(<><Sonda />{pagos([])}</>);
    expect(getByTestId('fab').textContent).toBe('visible');
  });
});
