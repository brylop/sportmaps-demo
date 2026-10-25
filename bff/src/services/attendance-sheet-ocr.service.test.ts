/**
 * OCR de planillas: parser del JSON del modelo, fechas de columna y — con las
 * transcripciones REALES de septiembre de Dynasty — la leyenda de marcas de
 * Milena (2026-10-05). El OCR en vivo no corre acá (requiere foto y cuota):
 * ver scripts/test-attendance-sheet-ocr.ts.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parsePlanillaJson, resolverFechasColumnas, interpretarMarca, mesDeTexto } from './attendance-sheet-ocr.service';

describe('parsePlanillaJson', () => {
    it('parsea schema completo, limpia ```json y descarta filas sin nombre', () => {
        const r = parsePlanillaJson('```json\n' + JSON.stringify({
            is_attendance_sheet: true, title: 'ASISTENCIA', group_header: 'NUEVA ERA', month_header: 'SEPTIEMBRE',
            columns: [{ label: '22', day: 22, month: null }, { label: 23 }],
            rows: [{ n: 1, name: ' LOPEZ ANA ', marks: { '22': '✓', '23': 3 }, note: '', struck: false }, { n: 2, name: '' }, null],
            missing_fields: ['x'],
        }) + '\n```', 'gemini');
        expect(r).toMatchObject({ isAttendanceSheet: true, groupHeader: 'NUEVA ERA', provider: 'gemini' });
        expect(r.columns.map((c) => c.label)).toEqual(['22', '23']);
        expect(r.rows).toHaveLength(1);
        expect(r.rows[0]).toMatchObject({ name: 'LOPEZ ANA', marks: { '22': '✓', '23': '3' }, struck: false });
    });
    it('JSON truncado: no descarta en falso (isAttendanceSheet=true) y queda sin filas', () => {
        const r = parsePlanillaJson('{"is_attendance_sheet": true, "rows": [{"n":1,"na', 'gemini');
        expect(r.isAttendanceSheet).toBe(true);
        expect(r.rows).toEqual([]);
        expect(r.missingFields).toContain('json_no_parseable');
    });
    it('is_attendance_sheet:false se respeta (planilla de pagos, comprobante)', () => {
        expect(parsePlanillaJson('{"is_attendance_sheet": false}', 'openai').isAttendanceSheet).toBe(false);
    });
});

describe('resolverFechasColumnas', () => {
    const cols = (...ds: number[]) => ds.map((d) => ({ label: String(d), day: d, month: null }));
    it('usa el mes impreso del encabezado', () => {
        expect(resolverFechasColumnas(cols(3, 28), 'SEPTIEMBRE', '2026-10-03').map((x) => x.fecha)).toEqual(['2026-09-03', '2026-09-28']);
    });
    it('sin mes: el de hoy; si el día cae en el futuro, el mes anterior', () => {
        expect(resolverFechasColumnas(cols(22, 28), null, '2026-10-24').map((x) => x.fecha)).toEqual(['2026-10-22', '2026-09-28']);
        expect(resolverFechasColumnas(cols(28), null, '2026-01-05').map((x) => x.fecha)).toEqual(['2025-12-28']);
    });
    it('"23/10" en la etiqueta y día inexistente', () => {
        expect(resolverFechasColumnas([{ label: '23/10', day: null, month: null }], null, '2026-10-24')[0].fecha).toBe('2026-10-23');
        expect(resolverFechasColumnas([{ label: '31', day: 31, month: 9 }], null, '2026-10-24')[0].fecha).toBeNull();
        expect(resolverFechasColumnas([{ label: 'abc', day: null, month: null }], null, '2026-10-24')[0].fecha).toBeNull();
    });
    it('mesDeTexto', () => {
        expect(mesDeTexto('ASISTENCIA SEPTIEMBRE')).toBe(9);
        expect(mesDeTexto('Setiembre')).toBe(9);
        expect(mesDeTexto('nada')).toBeNull();
    });
});

const DIR = resolve(__dirname, '../../../docs/dynasty-planillas-septiembre-2026');
describe.skipIf(!existsSync(resolve(DIR, 'transcripcion_01_08.json')))('leyenda de Milena contra las 24 planillas reales de asistencia', () => {
    const hojas: any[] = ['transcripcion_01_08.json', 'transcripcion_09_16.json', 'transcripcion_17_24.json', 'transcripcion_25_32.json']
        .flatMap((f) => JSON.parse(readFileSync(resolve(DIR, f), 'utf-8'))).filter((h: any) => h.tipo === 'asistencia');
    const marcas: string[] = hojas.flatMap((h) => h.filas.flatMap((f: any) => Object.values(f.marcas ?? {}) as string[]));

    it('hay centenares de marcas reales', () => { expect(hojas.length).toBeGreaterThanOrEqual(15); expect(marcas.length).toBeGreaterThan(1000); });

    it('toda sigla de la leyenda (✓ X R VR ✓R / VA) cuenta como asistió y R tachada también', () => {
        const siglas = marcas.filter((m) => /^(✓|x|r|vr|✓r|\/|va|r\(tachada\)|✓\((rojo|sobrescrito)\))$/i.test(m.trim()));
        expect(siglas.length).toBeGreaterThan(800);
        for (const m of siglas) expect(interpretarMarca(m), m).toBe('asistio');
    });

    it('lo que Milena no cubrió (garabatos, tachones sobre ✓/X, números, anotaciones) queda dudoso, nunca presente', () => {
        const raras = marcas.filter((m) => /garabato|borr|repetida|incapacidad|retirada|tachado|(?:^|[^a-z])sobre(?:[^a-z]|$)|^\d+$/i.test(m) && !/^r\(tachada\)$/i.test(m));
        expect(raras.length).toBeGreaterThan(5);
        for (const m of raras) expect(interpretarMarca(m), m).toBe('dudosa');
    });

    it('el conteo por interpretación es consistente con el cruce manual (≈ 1.374 presentes en septiembre)', () => {
        const presentes = marcas.filter((m) => interpretarMarca(m) === 'asistio').length;
        // El cruce manual contó 1.374 filas atleta×día (únicas) y las marcas crudas incluyen días
        // repetidos/filas sin atleta: el orden de magnitud debe coincidir.
        expect(presentes).toBeGreaterThan(1200);
        expect(presentes).toBeLessThan(2400);
    });
});
