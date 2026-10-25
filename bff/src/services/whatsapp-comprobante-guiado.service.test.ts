/**
 * Comprobante: deportista + mes, sin interrogatorio (spec
 * whatsapp-conversacion-v2-dynasty §3.3). Lo puro y la respuesta de la familia.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const updates: any[] = [];
const state = { pregunta_ocr: null as any };

function chain(table: string, result: () => any) {
    const c: any = {};
    for (const m of ['select', 'eq', 'order', 'limit', 'ilike', 'in', 'is', 'or']) c[m] = () => c;
    c.update = (v: any) => { updates.push({ table, v }); return c; };
    c.maybeSingle = () => Promise.resolve(result());
    c.then = (resolve: any, reject: any) => Promise.resolve(result()).then(resolve, reject);
    return c;
}
vi.mock('../config/supabase', () => ({
    supabase: {
        from: (table: string) => chain(table, () => (table === 'whatsapp_inbound_queue'
            ? { data: { pregunta_ocr: state.pregunta_ocr }, error: null } : { data: [], error: null })),
    },
}));

import {
    candidatosParcialesPorNombre, botonesDeDeportistas, opcionesDeDeportistas, ultimosMeses, opcionesDeMeses,
    botonesDeOpciones, interpretarOpcion, textoCierreEnRevision, mesDeCobroEnTexto, OPCIONES_CONCEPTO,
    deportistaElegidoPorBoton, resolverRespuestaGuiada, textoPreguntaMes, type FichaConNombre, type GuiaGuardada,
} from './whatsapp-comprobante-guiado.service';

beforeEach(() => { updates.length = 0; state.pregunta_ocr = null; });

const F = (id: string, nombre: string): FichaConNombre => ({ id, nombre, tipo: 'child' });
const FICHAS = [F('c1', 'Sofía Pérez Gómez'), F('c2', 'Sofía Ramírez Ortiz'), F('c3', 'Tomás Pérez Gómez'), F('c4', 'Laura Castaño')];

describe('deportista: botones con los nombres (máx. 3)', () => {
    it('«Sofía» a medias señala a dos → candidatos para preguntar', () => {
        const c = candidatosParcialesPorNombre(['pago de Sofia'], FICHAS);
        expect(c.map((f) => f.id)).toEqual(['c1', 'c2']);
    });
    it('el apellido señala a los dos hermanos', () => {
        expect(candidatosParcialesPorNombre(['Carolina Gomez'], FICHAS).map((f) => f.id)).toEqual(['c1', 'c3']);
    });
    it('gana quien más palabras acierta', () => {
        expect(candidatosParcialesPorNombre(['Sofia Ramirez'], FICHAS).map((f) => f.id)).toEqual(['c2']);
    });
    it('más de 3 candidatos o ninguno → no se ofrece nada (se pide escribir nombre y apellido)', () => {
        const muchos = ['a', 'b', 'c', 'd'].map((x, i) => F(`m${i}`, `Maria ${x}lonso`));
        expect(candidatosParcialesPorNombre(['maria'], muchos)).toEqual([]);
        expect(candidatosParcialesPorNombre(['Zoe Lopez'], FICHAS)).toEqual([]);
        expect(candidatosParcialesPorNombre([null, undefined, ''], FICHAS)).toEqual([]);
    });
    it('botones: id sm_cobro_N (el bot lo traduce a «N»), título ≤ 20, nombre completo en la descripción', () => {
        const b = botonesDeDeportistas(FICHAS.slice(0, 3));
        expect(b.map((x) => x.id)).toEqual(['sm_cobro_1', 'sm_cobro_2', 'sm_cobro_3']);
        for (const x of b) expect(x.title.length).toBeLessThanOrEqual(20);
        expect(b[0].title).toBe('1. Sofía Pérez');
        expect(b[0].descripcion).toBe('Sofía Pérez Gómez');
    });
    it('un botón tocado (o su número) resuelve la ficha guardada', async () => {
        state.pregunta_ocr = { guia: { opciones: opcionesDeDeportistas([FICHAS[0], F('u9', 'Ana Sin Registrar')].map((f, i) => i === 1 ? { ...f, tipo: 'unregistered' as const } : f)) } };
        expect(await deportistaElegidoPorBoton('q1', '1')).toEqual({ childIds: ['c1'], unregisteredIds: [] });
        expect(await deportistaElegidoPorBoton('q1', '2')).toEqual({ childIds: [], unregisteredIds: ['u9'] });
        expect(await deportistaElegidoPorBoton('q1', '3')).toBeNull();
        expect(await deportistaElegidoPorBoton('q1', 'Sofía Pérez')).toBeNull(); // texto libre: sigue el camino del nombre
    });
});

describe('mes: los últimos 3 + «Otro mes»', () => {
    it('del actual hacia atrás, cruzando el año', () => {
        expect(ultimosMeses(new Date('2026-01-15T12:00:00Z'))).toEqual([
            { mes: 1, anio: 2026 }, { mes: 12, anio: 2025 }, { mes: 11, anio: 2025 },
        ]);
    });
    it('cuatro opciones (sale como lista) con «Otro mes» al final', () => {
        const o = opcionesDeMeses(ultimosMeses(new Date('2026-10-24T12:00:00Z')));
        expect(o.map((x) => x.etiqueta)).toEqual(['Octubre 2026', 'Septiembre 2026', 'Agosto 2026', 'Otro mes']);
        const b = botonesDeOpciones(o);
        expect(b).toHaveLength(4);
        expect(b[0]).toMatchObject({ id: 'sm_cobro_1', title: '1. Octubre 2026' });
    });
    it('la pregunta dice monto y deportista', () => {
        expect(textoPreguntaMes({ monto: 150000, atleta: 'Sofía Pérez' })).toBe('Recibí tu comprobante por *$150.000* de *Sofía* 📄 ¿De qué mes es? Toca una opción.');
    });
});

describe('interpretarOpcion', () => {
    const meses = opcionesDeMeses(ultimosMeses(new Date('2026-10-24T12:00:00Z')));
    it('número o número con punto', () => {
        expect(interpretarOpcion('2', meses)?.etiqueta).toBe('Septiembre 2026');
        expect(interpretarOpcion('4.', meses)?.valor).toBe('otro');
        expect(interpretarOpcion('9', meses)).toBeNull();
    });
    it('por palabra: el mes o el concepto', () => {
        expect(interpretarOpcion('el de septiembre', meses)?.etiqueta).toBe('Septiembre 2026');
        expect(interpretarOpcion('es inscripción', OPCIONES_CONCEPTO)?.valor).toBe('inscripcion');
        expect(interpretarOpcion('mensualidad', OPCIONES_CONCEPTO)?.valor).toBe('mensualidad');
    });
    it('lo que no se entiende, null', () => {
        expect(interpretarOpcion('no sé', meses)).toBeNull();
        expect(interpretarOpcion('ok', OPCIONES_CONCEPTO)).toBeNull();
    });
});

describe('cierre de una línea', () => {
    it('«Listo: comprobante de $150.000 de Sofía para octubre. La escuela lo confirma.»', () => {
        expect(textoCierreEnRevision({ monto: 150000, atleta: 'Sofía Pérez', para: 'octubre' }))
            .toBe('Listo: comprobante de *$150.000* de *Sofía* para *octubre*. La escuela lo confirma.');
    });
    it('abono, y sin datos no inventa nada', () => {
        expect(textoCierreEnRevision({ monto: 90000, atleta: 'Mariana Ríos', para: 'octubre', abono: true }))
            .toBe('Listo: abono de *$90.000* de *Mariana* para *octubre*. La escuela lo confirma.');
        expect(textoCierreEnRevision({ monto: null, atleta: null, para: null })).toBe('Listo: comprobante. La escuela lo confirma.');
    });
    it('mesDeCobroEnTexto: concepto 10/2026, periodo o vencimiento', () => {
        expect(mesDeCobroEnTexto({ concept: 'Mensualidad 10/2026 - X', due_date: '2026-09-10' })).toBe('octubre');
        expect(mesDeCobroEnTexto({ period_month: 9 })).toBe('septiembre');
        expect(mesDeCobroEnTexto({ due_date: '2026-11-10', concept: 'Plan PRO' })).toBe('noviembre');
        expect(mesDeCobroEnTexto({})).toBeNull();
    });
});

describe('resolverRespuestaGuiada', () => {
    const guiaMes = (extra: Partial<GuiaGuardada> = {}): GuiaGuardada => ({
        opciones: opcionesDeMeses(ultimosMeses(new Date('2026-10-24T12:00:00Z'))), monto: 150000, quienPago: 'Carolina Gómez',
        deportista: { id: 'c1', tipo: 'child', nombre: 'Sofía Pérez', cuota: 150000 }, parentId: null, ...extra,
    });
    const fila = (tipo: 'mes' | 'concepto', guia: GuiaGuardada, retries = 0) => ({
        id: 'q1', school_id: 's1', retries, pregunta_ocr: { tipo, guia, ocr: {}, parentId: null },
    });
    const cola = () => updates.filter((u) => u.table === 'whatsapp_inbound_queue').map((u) => u.v);

    it('eligió el mes: a la bandeja con «crear el cobro de ese mes y aplicar» y cierre de una línea; NO crea nada', async () => {
        const responder = vi.fn(async () => undefined);
        const r = await resolverRespuestaGuiada(fila('mes', guiaMes()), '1', responder);
        expect(r).toBe(true);
        const v = cola()[0];
        expect(v).toMatchObject({ status: 'ignored', result_type: 'escalated', matched_child_id: 'c1' });
        expect(v.error_message.startsWith('sin_pendientes: Sofía Pérez no tiene cobro de octubre 2026')).toBe(true);
        expect(v.error_message).toContain('Propuesta → deportista: Sofía Pérez · mes: octubre 2026 · crear el cobro de ese mes por $150.000 y aplicar');
        expect(v.error_message).toContain('pagó: Carolina Gómez');
        expect(responder).toHaveBeenCalledTimes(1);
        expect((responder.mock.calls[0] as any[])[0]).toBe('Listo: comprobante de *$150.000* de *Sofía* para *octubre*. La escuela lo confirma.');
    });

    it('«Otro mes»: a la bandeja para que la escuela lo ubique', async () => {
        const responder = vi.fn(async () => undefined);
        await resolverRespuestaGuiada(fila('mes', guiaMes()), '4', responder);
        expect(cola()[0].error_message).toContain('OTRO mes');
        expect(cola()[0].status).toBe('ignored');
    });

    it('no se entiende: una repregunta con los mismos botones; a la segunda, a la bandeja', async () => {
        const responder = vi.fn(async (..._a: any[]) => undefined);
        await resolverRespuestaGuiada(fila('mes', guiaMes(), 0), 'no sé', responder);
        expect(cola()[0]).toEqual({ retries: 1 });
        expect(responder.mock.calls[0][2]).toHaveLength(4);
        updates.length = 0;
        await resolverRespuestaGuiada(fila('mes', guiaMes(), 1), 'no sé', responder);
        expect(cola()[0]).toMatchObject({ status: 'ignored', result_type: 'escalated' });
        expect(cola()[0].error_message).toContain('la familia no contestó de qué mes es');
    });

    it('concepto: «Inscripción» y «Otro» → otro_concepto; «Mensualidad» → monto_no_cuadra; nunca aplica nada', async () => {
        const g = guiaMes({ opciones: OPCIONES_CONCEPTO, propuesta: 'Propuesta → abono a cuota de Sofía $150.000' });
        const responder = vi.fn(async () => undefined);
        await resolverRespuestaGuiada(fila('concepto', g), '2', responder);
        expect(cola()[0].error_message.startsWith('otro_concepto: inscripción (la familia lo eligió) · Sofía Pérez · $150.000')).toBe(true);
        expect(cola()[0].error_message).toContain('Propuesta → abono a cuota');
        updates.length = 0;
        await resolverRespuestaGuiada(fila('concepto', g), '1', responder);
        expect(cola()[0].error_message.startsWith('monto_no_cuadra: la familia dice que es mensualidad de Sofía Pérez')).toBe(true);
        updates.length = 0;
        await resolverRespuestaGuiada(fila('concepto', g), '3', responder);
        expect(cola()[0].error_message.startsWith('otro_concepto: otro concepto')).toBe(true);
    });

    it('un tipo que no es de la guía (cobro, deportista) no se toca', async () => {
        const responder = vi.fn(async () => undefined);
        expect(await resolverRespuestaGuiada({ id: 'q', school_id: 's', pregunta_ocr: { tipo: 'deportista' as any } }, '1', responder)).toBe(false);
        expect(updates).toHaveLength(0);
    });
});
