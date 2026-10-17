import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GlobalDiscount } from './GlobalDiscount';
import { emptyDiscount } from '@/lib/cobrosYPagos';

const activo = { ...emptyDiscount(), enabled: true, basis: 'porcentaje' as const, value: 20, reason_code: 'convenio' as const };

describe('GlobalDiscount · efecto del descuento general', () => {
    it('suma lo que se descuenta en las líneas marcadas (antes decía «Sin efecto todavía»)', () => {
        render(
            <GlobalDiscount
                mode="single"
                value={activo}
                onChange={vi.fn()}
                onToggleTarget={vi.fn()}
                targets={[
                    { ref: 'a', label: 'Mensualidad', checked: true, share: 4000 },
                    { ref: 'b', label: 'Inscripción', checked: true, share: 1500 },
                    { ref: 'c', label: 'Seguro', checked: false, share: 9999 }, // desmarcada: no cuenta
                ]}
            />,
        );
        expect(screen.queryByText('Sin efecto todavía')).toBeNull();
        expect(screen.getByTestId('global-discount').textContent).toMatch(/5\.500/);
        expect(screen.getByTestId('global-discount').textContent).not.toMatch(/9\.999\s*$/);
    });

    it('sin líneas marcadas sigue diciendo que no tiene efecto', () => {
        render(
            <GlobalDiscount
                mode="single"
                value={activo}
                onChange={vi.fn()}
                onToggleTarget={vi.fn()}
                targets={[{ ref: 'a', label: 'Mensualidad', checked: false, share: 4000 }]}
            />,
        );
        expect(screen.getByText('Sin efecto todavía')).toBeTruthy();
    });
});
