/**
 * Ventas de la tienda en los ingresos de la escuela (migración 20261013170548).
 * Lo que se vigila:
 *   · sin tienda → el indicador queda igual que antes (sin desglose, sin 2ª llamada).
 *   · RPC sin aplicar (PGRST202) → "sin tienda", no rompe la pantalla.
 *   · con tienda → total = mensualidades + tienda del MISMO mes, con desglose.
 *   · la tienda falló → "Tienda —", nunca un $0 inventado.
 *   · el CSV del EdR solo cambia con tienda; el libro exportado suma las ventas.
 */
import { describe, it, expect, vi } from 'vitest';
import { fetchStoreIncome, fetchStoreIncomeLines, combineRevenue, type MonthlyRevenue } from '../lib/accounting/income';
import {
    pnlCsvRows, storeLinesToLedgerExport, sortLedgerExport, ledgerCsvRows, STORE_SALES_LABEL,
} from '../lib/accounting/csv';

function cliente(respuestas: Record<string, { data: unknown; error: any }>) {
    const rpc = vi.fn(async (fn: string) => respuestas[fn] ?? { data: null, error: { message: `inesperada ${fn}` } });
    return { rpc, client: { rpc } };
}

const opts = { schoolId: 'esc', branchId: 'sede', from: '2026-10-01', to: '2026-10-31' };

describe('fetchStoreIncome', () => {
    it('sin tienda: no pide el resumen y devuelve hasStore false', async () => {
        const { rpc, client } = cliente({ store_income_has_store: { data: false, error: null } });
        expect(await fetchStoreIncome(client, opts)).toEqual({ kind: 'ok', hasStore: false, total: 0, buckets: {} });
        expect(rpc).toHaveBeenCalledTimes(1);
        expect(rpc).toHaveBeenCalledWith('store_income_has_store', { p_school_id: 'esc' });
    });

    it('migración sin aplicar (PGRST202) = sin tienda, no error', async () => {
        const { client } = cliente({
            store_income_has_store: { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } },
        });
        expect(await fetchStoreIncome(client, opts)).toMatchObject({ kind: 'ok', hasStore: false });
    });

    it('con tienda: pide el resumen con sede y rango, y suma numeric-string', async () => {
        const { rpc, client } = cliente({
            store_income_has_store: { data: true, error: null },
            store_income_summary: {
                data: [{ bucket: '2026-09', income_amount: '11000' }, { bucket: '2026-10', income_amount: 99000 }],
                error: null,
            },
        });
        const r = await fetchStoreIncome(client, opts);
        expect(rpc).toHaveBeenLastCalledWith('store_income_summary', {
            p_school_id: 'esc', p_from: '2026-10-01', p_to: '2026-10-31', p_branch_id: 'sede', p_group: 'month',
        });
        expect(r).toEqual({ kind: 'ok', hasStore: true, total: 110000, buckets: { '2026-09': 11000, '2026-10': 99000 } });
    });

    it('42501 → forbidden; otro error → error (nunca 0)', async () => {
        const f = cliente({ store_income_has_store: { data: null, error: { code: '42501', message: 'FINANCE_FORBIDDEN' } } });
        expect(await fetchStoreIncome(f.client, opts)).toEqual({ kind: 'forbidden' });
        const e = cliente({
            store_income_has_store: { data: true, error: null },
            store_income_summary: { data: null, error: { message: 'Failed to fetch' } },
        });
        expect((await fetchStoreIncome(e.client, opts)).kind).toBe('error');
    });

    it('fetchStoreIncomeLines: RPC sin aplicar → [] y otro error se lanza', async () => {
        const m = cliente({ store_income_lines: { data: null, error: { code: 'PGRST202', message: 'x' } } });
        expect(await fetchStoreIncomeLines(m.client, opts)).toEqual([]);
        const e = cliente({ store_income_lines: { data: null, error: { code: '08006', message: 'conexión' } } });
        await expect(fetchStoreIncomeLines(e.client, opts)).rejects.toBeTruthy();
    });
});

describe('combineRevenue', () => {
    const pagos: MonthlyRevenue = { kind: 'ok', amount: 50000, month: '2026-10' };

    it('sin tienda: igual que antes (sin desglose)', () => {
        expect(combineRevenue(pagos, { kind: 'ok', hasStore: false, total: 0, buckets: {} }, '2026-10'))
            .toEqual({ state: 'ok', amount: 50000, breakdown: null });
    });

    it('con tienda: suma solo el bucket del mes y desglosa', () => {
        const store = { kind: 'ok' as const, hasStore: true, total: 110000, buckets: { '2026-09': 11000, '2026-10': 99000 } };
        expect(combineRevenue(pagos, store, '2026-10'))
            .toEqual({ state: 'ok', amount: 149000, breakdown: { mensualidades: 50000, tienda: 99000 } });
        expect(combineRevenue(pagos, store).amount).toBe(160000);
    });

    it('tienda con venta solo en otro mes → Tienda $0 legítimo (hay tienda)', () => {
        const store = { kind: 'ok' as const, hasStore: true, total: 11000, buckets: { '2026-09': 11000 } };
        expect(combineRevenue(pagos, store, '2026-10').breakdown).toEqual({ mensualidades: 50000, tienda: 0 });
    });

    it('la tienda falló → mensualidades con "Tienda —" (null), nunca 0', () => {
        expect(combineRevenue(pagos, { kind: 'error', message: 'x' }, '2026-10'))
            .toEqual({ state: 'ok', amount: 50000, breakdown: { mensualidades: 50000, tienda: null } });
    });

    it('sin permiso o error en mensualidades manda (oculto / "—")', () => {
        const store = { kind: 'ok' as const, hasStore: true, total: 1, buckets: {} };
        expect(combineRevenue({ kind: 'forbidden' }, store)).toEqual({ state: 'forbidden', amount: null, breakdown: null });
        expect(combineRevenue({ kind: 'error', message: 'x' }, store)).toEqual({ state: 'error', amount: null, breakdown: null });
    });
});

describe('CSV con tienda', () => {
    const base = {
        year: 2026, income: 280000, expense: 10000, net: 270000,
        catRows: [{ name: 'Arriendo', value: 10000 }],
        monthly: [{ month: 'Sep', ingresos: 130000, egresos: 10000, cobros: 50000, tienda: 80000 }],
    };

    it('sin tienda el EdR sale igual que antes', () => {
        const rows = pnlCsvRows({ ...base, store: null });
        expect(rows).toContainEqual(['Ingresos', 280000]);
        expect(rows).toContainEqual(['Mes', 'Ingresos', 'Egresos', 'Neto']);
        expect(rows).toContainEqual(['Sep', 130000, 10000, 120000]);
        expect(JSON.stringify(rows)).not.toContain(STORE_SALES_LABEL);
    });

    it('con tienda: línea «Ventas de tienda» en resumen y por mes', () => {
        const rows = pnlCsvRows({ ...base, store: { cobros: 200000, tienda: 80000 } });
        expect(rows).toContainEqual(['Ingresos — Mensualidades y cobros', 200000]);
        expect(rows).toContainEqual(['Ingresos — Ventas de tienda', 80000]);
        expect(rows).toContainEqual(['Ingresos', 280000]);
        expect(rows).toContainEqual(['Mes', 'Mensualidades y cobros', 'Ventas de tienda', 'Ingresos', 'Egresos', 'Neto']);
        expect(rows).toContainEqual(['Sep', 50000, 80000, 130000, 10000, 120000]);
    });

    it('libro exportado: las ventas entran como ingreso «Ventas de tienda», neto y en orden', () => {
        const store = storeLinesToLedgerExport([
            { paid_date: '2026-10-05', reference: 'SM-1', payment_method: 'transfer', income_amount: '70000' },
            { paid_date: '2026-10-06', reference: 'SM-2', payment_method: 'wompi', income_amount: 0 },
        ]);
        expect(store).toEqual([{
            date: '2026-10-05', tercero: null, concept: 'Venta tienda SM-1', category: 'Ventas de tienda',
            method: 'transfer', reference: 'SM-1', direction: 'income', amount: 70000,
        }]);
        const lines = sortLedgerExport([
            { date: '2026-10-01', tercero: null, concept: 'Mensualidad', category: 'Mensualidad', method: 'cash', reference: null, direction: 'income', amount: 150000 },
            { date: null, tercero: null, concept: 'Vieja', category: null, method: null, reference: null, direction: 'income', amount: 1 },
            ...store,
        ]);
        expect(lines.map((l) => l.concept)).toEqual(['Venta tienda SM-1', 'Mensualidad', 'Vieja']);
        const csv = ledgerCsvRows(lines);
        expect(csv[csv.length - 1]).toEqual(['', '', 'TOTAL', '', '', '', 220001, 0]);
    });
});
