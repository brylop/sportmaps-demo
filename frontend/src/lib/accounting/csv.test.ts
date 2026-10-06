import { describe, expect, it } from 'vitest';
import { buildCsv, csvCell, isoDateToCo, ledgerCsvRows, CSV_BOM } from './csv';

describe('csv para Excel en español', () => {
    it('empieza con BOM UTF-8, separa con ; y termina líneas con CRLF', () => {
        const out = buildCsv([['Categoría', 'Monto'], ['Nómina', 1500000]]);
        expect(out.startsWith(CSV_BOM)).toBe(true);
        expect(out).toBe('\uFEFFCategoría;Monto\r\nNómina;1500000\r\n');
    });

    it('entrecomilla celdas con ; comillas o saltos de línea y duplica las comillas', () => {
        expect(csvCell('Arriendo; sede norte')).toBe('"Arriendo; sede norte"');
        expect(csvCell('Balón "Golty"')).toBe('"Balón ""Golty"""');
        expect(csvCell('línea 1\nlínea 2')).toBe('"línea 1\nlínea 2"');
        expect(csvCell(' espacio')).toBe('" espacio"');
        // la coma ya no es separador: no hace falta comillar
        expect(csvCell('Pago proveedor: QA, SAS')).toBe('Pago proveedor: QA, SAS');
    });

    it('números con coma decimal y sin miles; null/undefined vacíos', () => {
        expect(csvCell(1234.5)).toBe('1234,5');
        expect(csvCell(400000)).toBe('400000');
        expect(csvCell(0.1 + 0.2)).toBe('0,3');
        expect(csvCell(null)).toBe('');
        expect(csvCell(undefined)).toBe('');
        expect(csvCell(Number.NaN)).toBe('');
    });

    it('neutraliza fórmulas (inyección CSV) en texto, no en números negativos', () => {
        expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
        expect(csvCell('+57 300')).toBe("'+57 300");
        expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
        expect(csvCell(-5000)).toBe('-5000');
    });

    it('fecha date → dd/mm/aaaa sin correrse un día', () => {
        expect(isoDateToCo('2026-10-01')).toBe('01/10/2026');
        expect(isoDateToCo(null)).toBe('');
    });

    it('libro línea por línea: entrada/salida en su columna y fila de totales', () => {
        const rows = ledgerCsvRows([
            { date: '2026-10-02', tercero: 'Sofía Ruiz', concept: 'Mensualidad octubre', category: 'Mensualidad',
              method: 'transfer', reference: 'TRX-1', direction: 'income', amount: 145000 },
            { date: '2026-10-03', tercero: 'QA Distribuidora; SAS', concept: 'Pago proveedor', category: 'Implementos',
              method: 'cash', reference: null, direction: 'expense', amount: 80000.5 },
        ]);
        const csv = buildCsv(rows);
        const lines = csv.slice(1).split('\r\n');
        expect(lines[0]).toBe('Fecha;Tercero;Concepto;Categoría;Método;Referencia;Entrada;Salida');
        expect(lines[1]).toBe('02/10/2026;Sofía Ruiz;Mensualidad octubre;Mensualidad;Transferencia;TRX-1;145000;');
        expect(lines[2]).toBe('03/10/2026;"QA Distribuidora; SAS";Pago proveedor;Implementos;Efectivo;;;80000,5');
        expect(lines[3]).toBe(';;TOTAL;;;;145000;80000,5');
    });
});
