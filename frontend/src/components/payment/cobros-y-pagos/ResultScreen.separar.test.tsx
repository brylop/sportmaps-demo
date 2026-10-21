import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ResultScreen } from './ResultScreen';
import type { ChargeBatchResult } from '@/lib/api/chargeBatches';

const base: ChargeBatchResult = { batch_id: 'b1', duplicated: false, rows_created: 0, payments_registered: 1, paid_total: 387_000, total_amount: 387_000 };

describe('<ResultScreen /> horas separadas', () => {
    it('ofrece «Registrar las horas ahora» con las horas y el valor que quedaron aparte', () => {
        const onRegister = vi.fn();
        render(<ResultScreen result={base} onClose={vi.fn()} horasPorRegistrar={{ horas: 2, monto: 64_500 }} onRegisterHours={onRegister} />);
        const caja = screen.getByTestId('cyp-result-horas-pendientes');
        expect(caja.textContent).toContain('2 h');
        expect(caja.textContent).toContain('64.500');
        fireEvent.click(screen.getByTestId('cyp-result-registrar-horas'));
        expect(onRegister).toHaveBeenCalledTimes(1);
    });

    it('sin horas aparte no muestra nada', () => {
        render(<ResultScreen result={base} onClose={vi.fn()} />);
        expect(screen.queryByTestId('cyp-result-horas-pendientes')).toBeNull();
    });
});
