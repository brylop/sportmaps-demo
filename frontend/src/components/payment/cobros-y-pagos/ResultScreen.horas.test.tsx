import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ResultScreen } from './ResultScreen';
import type { ChargeBatchResult } from '@/lib/api/chargeBatches';

const base: ChargeBatchResult = { batch_id: 'b1', duplicated: false, rows_created: 1, total_amount: 30_625 };

describe('<ResultScreen /> con venta de horas', () => {
    it('horas sumadas: lo dice con las horas y lo disponible', () => {
        render(<ResultScreen result={{ ...base, hour_bank_grant: { ok: true, hours: 2, minutes: 120, available_minutes: 840 } }} onClose={vi.fn()} />);
        expect(screen.getByTestId('cyp-result-horas-ok').textContent).toContain('2 h');
        expect(screen.getByTestId('cyp-result-horas-ok').textContent).toContain('14h');
        expect(screen.queryByTestId('cyp-result-horas-error')).toBeNull();
    });

    it('la suma falló: alerta visible con el mensaje y botón de reintento que llama al manejador', () => {
        const onRetry = vi.fn();
        render(<ResultScreen
            result={{ ...base, hour_bank_grant: { ok: false, reason: 'error', message: 'El cobro quedó registrado, pero no se pudieron sumar las horas.' } }}
            onClose={vi.fn()} onRetryHours={onRetry} />);
        expect(screen.getByRole('alert').textContent).toContain('NO se sumaron');
        fireEvent.click(screen.getByTestId('cyp-result-horas-reintentar'));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('mientras reintenta el botón se deshabilita', () => {
        render(<ResultScreen result={{ ...base, hour_bank_grant: { ok: false, reason: 'sin_pago', message: 'Pendiente' } }}
            onClose={vi.fn()} onRetryHours={vi.fn()} retryingHours />);
        expect((screen.getByTestId('cyp-result-horas-reintentar') as HTMLButtonElement).disabled).toBe(true);
    });

    it('si no se creó el cobro no ofrece reintentar (no hay nada que sumar)', () => {
        render(<ResultScreen result={{ ...base, hour_bank_grant: { ok: false, reason: 'sin_cobro', message: 'No se creó el cobro' } }}
            onClose={vi.fn()} onRetryHours={vi.fn()} />);
        expect(screen.queryByTestId('cyp-result-horas-reintentar')).toBeNull();
    });

    it('una operación sin venta de horas no muestra nada de horas', () => {
        render(<ResultScreen result={base} onClose={vi.fn()} />);
        expect(screen.queryByTestId('cyp-result-horas-ok')).toBeNull();
        expect(screen.queryByTestId('cyp-result-horas-error')).toBeNull();
    });
});
