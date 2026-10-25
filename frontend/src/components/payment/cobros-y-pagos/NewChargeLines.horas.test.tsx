import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NewChargeLines } from './NewChargeLines';
import { newLineDraft, type NewLineDraft } from '@/lib/cobrosYPagos';
import type { ChargeSuggestions } from '@/lib/api/chargeBatches';

const CON_BANCO = {
    enrollment_id: 'enr-1', offering_plan_id: 'p1', plan_name: 'PGR6x2', team_name: null, is_primary: true,
    monthly_amount: 387_000, active: true, hours_plan: true, hourly_rate: 32_250, included_minutes: 720,
};
const SIN_BANCO = { ...CON_BANCO, enrollment_id: 'enr-2', plan_name: 'PGP8x1', hours_plan: false, hourly_rate: null, included_minutes: null };

const sug = (enrollments = [CON_BANCO]): ChargeSuggestions => ({ enrollments, overages: [] });

function montar(over: Partial<React.ComponentProps<typeof NewChargeLines>> = {}) {
    const onChange = vi.fn();
    render(<NewChargeLines
        mode="single" lines={[]} onChange={onChange} calcByRef={new Map()} paymentOn canDiscount={false} canOverage
        suggestions={sug()} defaultDue="2026-10-30" minDue="2026-10-21" {...over} />);
    return onChange;
}

describe('<NewChargeLines /> atajo «Horas adicionales»', () => {
    it('lo ofrece al dueño con un atleta que tiene banco de horas', () => {
        montar();
        expect(screen.getByTestId('cyp-add-horas')).toBeTruthy();
    });

    it('crea la línea SIN modo elegido: el usuario decide «Ya las usó» o «Por adelantado»', () => {
        const onChange = montar();
        fireEvent.click(screen.getByTestId('cyp-add-horas'));
        const [lineas] = onChange.mock.calls[0] as [NewLineDraft[]];
        expect(lineas).toHaveLength(1);
        expect(lineas[0]).toMatchObject({ category: 'excedente', horas_modo: null, extra_hours: null, enrollment_id: null, pay: true });
    });

    it('también se ofrece a un atleta sin banco de horas (caso Zoe): ahí la línea se cobra como «Ya las usó»', () => {
        montar({ suggestions: sug([SIN_BANCO]) });
        expect(screen.getByTestId('cyp-add-horas')).toBeTruthy();
    });

    it('«Agregar cobro» sigue creando la fila de Torneo de siempre', () => {
        const onChange = montar();
        fireEvent.click(screen.getByTestId('cyp-add-line'));
        expect((onChange.mock.calls[0][0] as NewLineDraft[])[0].category).toBe('torneo');
    });

    it('no lo ofrece si no es el dueño ni en modo varios', () => {
        montar({ canOverage: false });
        expect(screen.queryByTestId('cyp-add-horas')).toBeNull();
    });
    it('modo varios no aparece', () => {
        montar({ mode: 'multi' });
        expect(screen.queryByTestId('cyp-add-horas')).toBeNull();
    });

    it('una sola línea de horas por operación: con una ya agregada desaparece', () => {
        const venta = newLineDraft({ category: 'excedente', due_date: '2026-10-30', horas_modo: 'adelantado', extra_hours: 2, enrollment_id: 'enr-1', amount: 64_500 });
        montar({ lines: [venta] });
        expect(screen.queryByTestId('cyp-add-horas')).toBeNull();
    });
});
