/**
 * Contabilidad v2 F0 (plan §4 F2/F3/F13): "Ingresos del mes" del dashboard sale
 * de la fórmula única de la base (finance_income_summary). Lo que se vigila:
 *   · 42501 (coach/staff/reporter) → 'forbidden' (la tarjeta se oculta), NUNCA 0.
 *   · un error de red → 'error' (se pinta "—"), NUNCA 0.
 *   · se suma solo el bucket del mes; el 'sin_fecha' no es "de este mes".
 *   · el rango tiene límite superior (fin de mes), que antes faltaba.
 *   · el coach ni siquiera pide la RPC.
 */
import { describe, it, expect, vi } from 'vitest';
import {
    fetchMonthlyRevenue,
    monthBounds,
    roleRequestsSchoolRevenue,
    isForbiddenError,
} from '../lib/accounting/income';

function cliente(respuesta: { data: unknown; error: any }) {
    const rpc = vi.fn(async () => respuesta);
    return { rpc, client: { rpc } };
}

describe('monthBounds', () => {
    it('da primer y último día del mes, con febrero bisiesto y diciembre', () => {
        expect(monthBounds('2026-10-03')).toEqual({ from: '2026-10-01', to: '2026-10-31', bucket: '2026-10' });
        expect(monthBounds('2028-02-15')).toEqual({ from: '2028-02-01', to: '2028-02-29', bucket: '2028-02' });
        expect(monthBounds('2026-02-28').to).toBe('2026-02-28');
        expect(monthBounds('2026-12-31')).toEqual({ from: '2026-12-01', to: '2026-12-31', bucket: '2026-12' });
        expect(monthBounds('2026-09-30').to).toBe('2026-09-30');
    });

    it('rechaza una fecha mal formada en vez de inventar un mes', () => {
        expect(() => monthBounds('03/10/2026')).toThrow();
    });
});

describe('fetchMonthlyRevenue', () => {
    it('llama finance_income_summary con el mes acotado, la sede y agrupado por mes', async () => {
        const { rpc, client } = cliente({ data: [], error: null });
        await fetchMonthlyRevenue(client, { schoolId: 'esc', branchId: 'sede', todayIso: '2026-10-03' });
        expect(rpc).toHaveBeenCalledWith('finance_income_summary', {
            p_owner_type: 'school',
            p_owner_id: 'esc',
            p_from: '2026-10-01',
            p_to: '2026-10-31',
            p_branch_id: 'sede',
            p_group: 'month',
        });
    });

    it('sin sede manda null (todas las sedes)', async () => {
        const { rpc, client } = cliente({ data: [], error: null });
        await fetchMonthlyRevenue(client, { schoolId: 'esc', branchId: '', todayIso: '2026-10-03' });
        expect((rpc.mock.calls[0] as any[])[1].p_branch_id).toBeNull();
    });

    it('suma solo el bucket del mes (el sin_fecha queda fuera) y convierte numeric-string', async () => {
        const { client } = cliente({
            data: [
                { bucket: '2026-10', income_amount: '3720000', tx_count: 20, excess_amount: 0 },
                { bucket: 'sin_fecha', income_amount: 3850000, tx_count: 55, excess_amount: 0 },
            ],
            error: null,
        });
        const r = await fetchMonthlyRevenue(client, { schoolId: 'esc', todayIso: '2026-10-03' });
        expect(r).toEqual({ kind: 'ok', amount: 3720000, month: '2026-10' });
    });

    it('un mes sin cobros es 0 legítimo (kind ok)', async () => {
        const { client } = cliente({ data: [], error: null });
        expect(await fetchMonthlyRevenue(client, { schoolId: 'esc', todayIso: '2026-10-03' }))
            .toEqual({ kind: 'ok', amount: 0, month: '2026-10' });
    });

    it('42501 → forbidden, nunca un 0', async () => {
        const { client } = cliente({ data: null, error: { code: '42501', message: 'FINANCE_FORBIDDEN' } });
        const r = await fetchMonthlyRevenue(client, { schoolId: 'esc', todayIso: '2026-10-03' });
        expect(r).toEqual({ kind: 'forbidden' });
        expect((r as any).amount).toBeUndefined();
    });

    it('error de red → error, nunca un 0', async () => {
        const { client } = cliente({ data: null, error: { message: 'Failed to fetch' } });
        const r = await fetchMonthlyRevenue(client, { schoolId: 'esc', todayIso: '2026-10-03' });
        expect(r.kind).toBe('error');
        expect((r as any).amount).toBeUndefined();
    });
});

describe('roleRequestsSchoolRevenue / isForbiddenError', () => {
    it('el coach no pide ingresos; admins y contador sí', () => {
        expect(roleRequestsSchoolRevenue('coach')).toBe(false);
        expect(roleRequestsSchoolRevenue('parent')).toBe(false);
        expect(roleRequestsSchoolRevenue('reporter')).toBe(false);
        expect(roleRequestsSchoolRevenue(undefined)).toBe(false);
        for (const r of ['school', 'school_admin', 'admin', 'super_admin', 'accountant']) {
            expect(roleRequestsSchoolRevenue(r)).toBe(true);
        }
    });

    it('reconoce el 42501 por código o por el mensaje del gate', () => {
        expect(isForbiddenError({ code: '42501' })).toBe(true);
        expect(isForbiddenError({ code: 'P0001', message: 'FINANCE_FORBIDDEN' })).toBe(true);
        expect(isForbiddenError({ code: '08006', message: 'connection' })).toBe(false);
        expect(isForbiddenError(null)).toBe(false);
    });
});

// F7: el "Rechazar" sobre un pago facturado lo frena la base con
// PAYMENT_INVOICED; la pantalla tiene que decir qué hacer, no "error inesperado".
import { getUserFriendlyError } from '../lib/error-translator';

describe('errores de los guards contables', () => {
    it('PAYMENT_INVOICED pide la nota crédito', () => {
        const msg = getUserFriendlyError({
            code: '55000',
            message: 'PAYMENT_INVOICED: el pago tiene factura electrónica vigente; emite la nota crédito antes de anularlo',
        });
        expect(msg).toMatch(/nota crédito/i);
    });
    it('FINANCE_FORBIDDEN se traduce a falta de permiso', () => {
        expect(getUserFriendlyError({ code: '42501', message: 'FINANCE_FORBIDDEN' })).toMatch(/permiso/i);
    });
});
