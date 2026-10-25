/**
 * Pagos del acudiente V2 (AcuPagosV2): lo que la familia ve antes de pagar.
 *
 * - Lo normal viene marcado: todo lo que debe entra al total del botón.
 * - Lo que está «En revisión» se ve aparte y sin casilla (no se puede volver a pagar).
 * - Un error al cargar NUNCA se ve como «estás al día» (UX-2).
 *
 * Componente puramente presentacional: sin red ni Supabase. El FailedAttemptChip
 * se deja real (sin motivo de fallo no pinta nada).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AcuPagosV2 } from '@/components/parent/v2/AcuPagosV2';
import type { Transaction } from '@/components/parent/v2/pagosModel';
import { formatCurrency } from '@/lib/utils';

const tx = (over: Partial<Transaction>): Transaction => ({
  id: 'x',
  amount: 0,
  status: 'pending',
  reference: 'SP-X',
  transaction_date: '2026-10-01',
  ...over,
});

const filas: Transaction[] = [
  tx({ id: 'a', concept: 'Mensualidad Octubre', child_name: 'Sofía', amount: 180000, due_date: '2026-11-11' }),
  tx({ id: 'b', concept: 'Mensualidad Octubre', child_name: 'Tomás', amount: 160000, status: 'overdue', due_date: '2026-10-05' }),
  tx({ id: 'c', concept: 'Inscripción 2026', child_name: 'Tomás', amount: 120000, payment_category: 'inscripcion' }),
  tx({ id: 'd', concept: 'Seguro de accidentes', child_name: 'Sofía', amount: 150000, status: 'awaiting_approval' }),
  tx({ id: 'e', concept: 'Mensualidad Septiembre', child_name: 'Sofía', amount: 180000, status: 'approved', receipt_url: 'r/1.jpg' }),
  tx({ id: 'f', concept: 'Cobro anulado', child_name: 'Sofía', amount: 99000, status: 'cancelled' }),
];

const noop = () => {};
const renderPagos = (props: Partial<Parameters<typeof AcuPagosV2>[0]> = {}) =>
  render(
    <AcuPagosV2
      state="ready"
      transactions={filas}
      onRetry={noop}
      onPay={noop}
      onUploadProof={noop}
      onShowReceipt={noop}
      {...props}
    />,
  );

const money = (n: number) => formatCurrency(n).replace(/\s/g, ' ');
const norm = (s: string | null) => (s ?? '').replace(/\s/g, ' ');

describe('AcuPagosV2 — Por pagar', () => {
  it('marca por defecto todo lo que se debe y el botón suma el total', () => {
    renderPagos();
    const casillas = screen.getAllByRole('checkbox');
    expect(casillas).toHaveLength(3);
    casillas.forEach((c) => expect(c).toHaveAttribute('aria-checked', 'true'));
    expect(norm(document.body.textContent)).toContain(`Debes ${money(460000)} en 3 cobros.`);
    expect(norm(screen.getByRole('button', { name: /^Pagar / }).textContent)).toBe(`Pagar 3 cobros · ${money(460000)}`);
  });

  it('desmarcar un cobro baja el total y lo saca de lo que se paga', async () => {
    const onPay = vi.fn();
    renderPagos({ onPay });
    const inscripcion = screen.getAllByRole('checkbox').find((c) => c.textContent?.includes('Inscripción'))!;
    await userEvent.click(inscripcion);
    expect(inscripcion).toHaveAttribute('aria-checked', 'false');
    const pagar = screen.getByRole('button', { name: /^Pagar / });
    expect(norm(pagar.textContent)).toBe(`Pagar 2 cobros · ${money(340000)}`);
    await userEvent.click(pagar);
    expect(onPay).toHaveBeenCalledTimes(1);
    expect(onPay.mock.calls[0][0].map((t: Transaction) => t.id).sort()).toEqual(['a', 'b']);
  });

  it('lo que está en revisión se ve aparte, con su etiqueta y sin casilla', () => {
    renderPagos();
    const etiqueta = screen.getByText('En revisión');
    const fila = etiqueta.parentElement!;
    expect(within(fila).getByText(/Seguro de accidentes · Sofía/)).toBeInTheDocument();
    expect(within(fila).queryByRole('checkbox')).toBeNull();
    // Ni el pagado ni el anulado aparecen como cobro por pagar.
    expect(screen.queryByText(/Cobro anulado/)).toBeNull();
    expect(screen.queryByText(/Mensualidad Septiembre/)).toBeNull();
  });

  it('nunca muestra el estado técnico', () => {
    renderPagos();
    const texto = document.body.textContent ?? '';
    for (const tecnico of ['pending', 'overdue', 'awaiting_approval', 'partial', 'approved']) {
      expect(texto).not.toContain(tecnico);
    }
    expect(texto).toContain('Vencido');
  });
});

describe('AcuPagosV2 — carga, vacío y error son distintos (UX-2)', () => {
  it('un error al cargar no dice que estás al día ni muestra el botón de pagar', () => {
    const onRetry = vi.fn();
    renderPagos({ state: 'error', transactions: [], onRetry });
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar tus pagos');
    expect(screen.queryByText('Estás al día')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Pagar / })).toBeNull();
    screen.getByRole('button', { name: /Reintentar/ }).click();
    expect(onRetry).toHaveBeenCalled();
  });

  it('sin cobros y sin error: «Estás al día»', () => {
    renderPagos({ transactions: [] });
    expect(screen.getByText('Estás al día')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('mientras carga no dice ni al día ni error', () => {
    renderPagos({ state: 'loading', transactions: [] });
    expect(screen.queryByText('Estás al día')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('AcuPagosV2 — Pagados', () => {
  it('lista lo pagado con «Recibo» cuando hay recibo y la nota de factura', async () => {
    const onShowReceipt = vi.fn();
    renderPagos({ onShowReceipt });
    await userEvent.click(screen.getByRole('tab', { name: 'Pagados' }));
    expect(screen.getByText('Mensualidad Septiembre · Sofía')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Recibo' }));
    expect(onShowReceipt).toHaveBeenCalledWith(expect.objectContaining({ id: 'e' }));
    expect(screen.getByText('Si la escuela emite factura electrónica, también te llega al correo.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Pagar / })).toBeNull();
  });
});
