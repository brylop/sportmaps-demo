import { describe, it, expect } from 'vitest';
import {
    parseInvoiceListQuery, pageRange, totalPages, isRealDay,
    INVOICE_PAGE_SIZE_DEFAULT, INVOICE_PAGE_SIZE_MAX, INVOICE_PAGE_SIZE_LEGACY,
} from './list-query';

function ok(q: Record<string, unknown>) {
    const r = parseInvoiceListQuery(q);
    if (!r.ok) throw new Error(`esperaba ok, vino ${r.error}`);
    return r.value;
}
function err(q: Record<string, unknown>) {
    const r = parseInvoiceListQuery(q);
    if (r.ok) throw new Error('esperaba error');
    return r.error;
}

describe('listado de facturas: paginación', () => {
    it('sin parámetros devuelve 200 en la página 1 (compatibilidad con el frontend viejo)', () => {
        const v = ok({});
        expect(v.page).toBe(1);
        expect(v.pageSize).toBe(INVOICE_PAGE_SIZE_LEGACY);
        expect(v.statuses).toEqual([]);
        expect(v.createdFrom).toBeNull();
    });

    it('con page y sin pageSize usa el default de 50', () => {
        expect(ok({ page: '3' }).pageSize).toBe(INVOICE_PAGE_SIZE_DEFAULT);
    });

    it('pageSize se recorta al máximo, no se rechaza', () => {
        expect(ok({ page: '1', pageSize: '5000' }).pageSize).toBe(INVOICE_PAGE_SIZE_MAX);
    });

    it('page/pageSize inválidos → 400 con motivo', () => {
        expect(err({ page: '0' })).toBe('invalid_page');
        expect(err({ page: '-1' })).toBe('invalid_page');
        expect(err({ page: 'dos' })).toBe('invalid_page');
        expect(err({ pageSize: '0' })).toBe('invalid_page_size');
        expect(err({ pageSize: '1.5' })).toBe('invalid_page_size');
    });

    it('pageRange es inclusivo y sin solapes entre páginas', () => {
        expect(pageRange(1, 50)).toEqual({ desde: 0, hasta: 49 });
        expect(pageRange(2, 50)).toEqual({ desde: 50, hasta: 99 });
        expect(pageRange(5, 200)).toEqual({ desde: 800, hasta: 999 });
    });

    it('totalPages: 243 documentos de a 50 son 5 páginas; vacío es 1', () => {
        expect(totalPages(243, 50)).toBe(5);
        expect(totalPages(250, 50)).toBe(5);
        expect(totalPages(0, 50)).toBe(1);
    });
});

describe('listado de facturas: filtros', () => {
    it('estado acepta lista con comas o repetida, sin duplicados y sin importar la caja', () => {
        expect(ok({ status: 'rejected,queued' }).statuses).toEqual(['rejected', 'queued']);
        expect(ok({ status: ['REJECTED', 'rejected', 'void'] }).statuses).toEqual(['rejected', 'void']);
    });

    it('un estado que no existe es error (no se ignora en silencio)', () => {
        expect(err({ status: 'pagada' })).toBe('invalid_status');
    });

    it('tipo de documento', () => {
        expect(ok({ documentType: 'credit_note' }).documentType).toBe('credit_note');
        expect(err({ documentType: 'recibo' })).toBe('invalid_document_type');
    });

    it('fechas: día de Colombia (UTC-5), inclusivo en los dos extremos', () => {
        const v = ok({ from: '2026-09-01', to: '2026-09-30' });
        expect(v.createdFrom).toBe('2026-09-01T00:00:00-05:00');
        expect(v.createdTo).toBe('2026-09-30T23:59:59.999-05:00');
        // Una factura de las 9 p.m. del 30-sep en Bogotá (02:00Z del 1-oct) cae en septiembre.
        expect(new Date('2026-10-01T02:00:00Z') <= new Date(v.createdTo!)).toBe(true);
    });

    it('fechas inválidas o invertidas → error', () => {
        expect(err({ from: '2026-02-30' })).toBe('invalid_from');
        expect(err({ to: '30/09/2026' })).toBe('invalid_to');
        expect(err({ from: '2026-10-01', to: '2026-09-01' })).toBe('from_after_to');
    });

    it('isRealDay', () => {
        expect(isRealDay('2026-09-30')).toBe(true);
        expect(isRealDay('2026-09-31')).toBe(false);
        expect(isRealDay('2026-9-1')).toBe(false);
    });
});
