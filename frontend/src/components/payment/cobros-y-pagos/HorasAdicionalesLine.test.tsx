import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { HorasAdicionalesLine, borradorDeVentaDeHoras, inscripcionesConHoras } from './HorasAdicionalesLine';
import { newLineDraft, type NewLineDraft } from '@/lib/cobrosYPagos';
import type { ChargeSuggestions } from '@/lib/api/chargeBatches';

const PGR6X2 = {
    enrollment_id: 'enr-1', offering_plan_id: 'p1', plan_name: 'PGR6x2', team_name: 'USAG Nivel 1', is_primary: true,
    monthly_amount: 387_000, active: true, hours_plan: true, hourly_rate: 32_250, included_minutes: 720,
};
const SIN_HORAS = { ...PGR6X2, enrollment_id: 'enr-2', plan_name: 'PGP4x1', hours_plan: false, hourly_rate: null, included_minutes: null, is_primary: false };

const sugerencias = (over: Partial<ChargeSuggestions> = {}): ChargeSuggestions => ({ enrollments: [PGR6X2], overages: [], ...over });

const linea = (over: Partial<NewLineDraft> = {}) =>
    newLineDraft({ category: 'excedente', due_date: '2026-10-30', ...borradorDeVentaDeHoras(sugerencias()), ...over });

describe('borradorDeVentaDeHoras', () => {
    it('arranca en 1 hora con la tarifa del plan y la inscripción con banco', () => {
        expect(borradorDeVentaDeHoras(sugerencias())).toMatchObject({
            extra_hours: 1, enrollment_id: 'enr-1', amount: 32_250, concept: 'Horas adicionales · 1 h', overage_charge_id: null,
        });
    });
    it('ignora las inscripciones sin banco de horas', () => {
        expect(inscripcionesConHoras(sugerencias({ enrollments: [SIN_HORAS, PGR6X2] })).map((e) => e.enrollment_id)).toEqual(['enr-1']);
        expect(borradorDeVentaDeHoras(sugerencias({ enrollments: [SIN_HORAS] }))).toMatchObject({ enrollment_id: null, amount: null });
    });
});

describe('<HorasAdicionalesLine />', () => {
    it('sin excedentes solo existe la venta: muestra las horas y la tarifa (Dreamers)', () => {
        render(<HorasAdicionalesLine line={linea()} suggestions={sugerencias()} onPatch={vi.fn()} />);
        expect((screen.getByLabelText('Horas vendidas') as HTMLInputElement).value).toBe('1');
        expect(screen.getByTestId('cyp-horas-tarifa').textContent).toContain('32.250');
        expect(screen.getByTestId('cyp-horas-tarifa').textContent).toContain('pagado');
        expect(screen.queryByText('Excedente del período')).toBeNull();
    });

    it('«+» pasa a 2 horas y recalcula el valor con la tarifa y el concepto', () => {
        const onPatch = vi.fn();
        render(<HorasAdicionalesLine line={linea()} suggestions={sugerencias()} onPatch={onPatch} />);
        fireEvent.click(screen.getByLabelText('Una hora más'));
        expect(onPatch).toHaveBeenCalledWith({ extra_hours: 2, concept: 'Horas adicionales · 2 h', amount: 64_500 });
    });

    it('«−» no baja de 15 minutos', () => {
        const onPatch = vi.fn();
        render(<HorasAdicionalesLine line={linea({ extra_hours: 0.25 })} suggestions={sugerencias()} onPatch={onPatch} />);
        fireEvent.click(screen.getByLabelText('Una hora menos'));
        expect(onPatch).toHaveBeenCalledWith(expect.objectContaining({ extra_hours: 0.25 }));
    });

    it('escribir 1,5 recalcula; el valor sigue editable por fuera (no se bloquea)', () => {
        const onPatch = vi.fn();
        render(<HorasAdicionalesLine line={linea()} suggestions={sugerencias()} onPatch={onPatch} />);
        fireEvent.change(screen.getByLabelText('Horas vendidas'), { target: { value: '1.5' } });
        expect(onPatch).toHaveBeenCalledWith({ extra_hours: 1.5, concept: 'Horas adicionales · 1,5 h', amount: 48_375 });
    });

    it('vaciar el campo no rompe: queda en 0 y el cálculo del modal avisa', () => {
        const onPatch = vi.fn();
        render(<HorasAdicionalesLine line={linea()} suggestions={sugerencias()} onPatch={onPatch} />);
        fireEvent.change(screen.getByLabelText('Horas vendidas'), { target: { value: '' } });
        expect(onPatch).toHaveBeenCalledWith({ extra_hours: 0 });
    });

    it('sin tarifa del plan pide escribir el valor y no pisa el que hay', () => {
        const s = sugerencias({ enrollments: [{ ...PGR6X2, hourly_rate: null }] });
        const onPatch = vi.fn();
        render(<HorasAdicionalesLine line={linea({ ...borradorDeVentaDeHoras(s), amount: 20_000 })} suggestions={s} onPatch={onPatch} />);
        expect(screen.getByTestId('cyp-horas-tarifa').textContent).toContain('escribe el valor');
        fireEvent.click(screen.getByLabelText('Una hora más'));
        expect(onPatch).toHaveBeenCalledWith({ extra_hours: 2, concept: 'Horas adicionales · 2 h' });
    });

    it('un atleta sin plan con banco de horas ve el aviso y la salida «Otro cobro» (caso PGP4x1)', () => {
        const s = sugerencias({ enrollments: [SIN_HORAS] });
        render(<HorasAdicionalesLine line={linea({ ...borradorDeVentaDeHoras(s) })} suggestions={s} onPatch={vi.fn()} />);
        expect(screen.getByTestId('cyp-horas-sin-banco').textContent).toContain('Otro cobro');
        expect(screen.queryByLabelText('Horas vendidas')).toBeNull();
    });

    it('si el atleta cambió con la línea abierta, corrige sola la inscripción ajena (y el valor)', () => {
        const onPatch = vi.fn();
        render(<HorasAdicionalesLine line={linea({ enrollment_id: 'enr-DEL-OTRO-ATLETA', amount: 1 })} suggestions={sugerencias()} onPatch={onPatch} />);
        expect(onPatch).toHaveBeenCalledWith({ enrollment_id: 'enr-1', amount: 32_250 });
    });

    it('si las sugerencias llegaron después del borrador (sin inscripción), la completa', () => {
        const onPatch = vi.fn();
        render(<HorasAdicionalesLine line={linea({ enrollment_id: null, amount: null })} suggestions={sugerencias()} onPatch={onPatch} />);
        expect(onPatch).toHaveBeenCalledWith({ enrollment_id: 'enr-1', amount: 32_250 });
    });

    it('con la inscripción correcta no hace nada (sin bucles)', () => {
        const onPatch = vi.fn();
        render(<HorasAdicionalesLine line={linea()} suggestions={sugerencias()} onPatch={onPatch} />);
        expect(onPatch).not.toHaveBeenCalled();
    });

    it('un atleta sin banco de horas con una inscripción vieja en el borrador la limpia', () => {
        const s = sugerencias({ enrollments: [SIN_HORAS] });
        const onPatch = vi.fn();
        render(<HorasAdicionalesLine line={linea({ enrollment_id: 'enr-1' })} suggestions={s} onPatch={onPatch} />);
        expect(onPatch).toHaveBeenCalledWith({ enrollment_id: null });
    });

    it('con excedentes pendientes ofrece las dos vistas y cambia entre ellas', () => {
        const s = sugerencias({ overages: [{ id: 'ov-1', period_label: 'sep 2026', amount: 50_000 }] });
        const onPatch = vi.fn();
        render(<HorasAdicionalesLine line={linea({ extra_hours: null, enrollment_id: null, amount: null })} suggestions={s} onPatch={onPatch} />);
        expect(screen.getByLabelText('Período de horas adicionales')).toBeTruthy();
        fireEvent.click(screen.getByText('Horas vendidas'));
        expect(onPatch).toHaveBeenCalledWith(expect.objectContaining({ extra_hours: 1, enrollment_id: 'enr-1', amount: 32_250 }));
    });

    it('de la venta de vuelta al excedente limpia las horas y la inscripción', () => {
        const s = sugerencias({ overages: [{ id: 'ov-1', period_label: 'sep 2026', amount: 50_000 }] });
        const onPatch = vi.fn();
        render(<HorasAdicionalesLine line={linea()} suggestions={s} onPatch={onPatch} />);
        fireEvent.click(screen.getByText('Excedente del período'));
        expect(onPatch).toHaveBeenCalledWith({ extra_hours: null, concept: 'Horas adicionales', enrollment_id: null });
    });
});
