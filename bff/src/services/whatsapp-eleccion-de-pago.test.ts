/**
 * La respuesta del acudiente a «¿a cuál de tus cobros lo aplico?».
 *
 * Los casos vienen del caso real que motivó la regla: Sharik y Nathaly Zambra,
 * hermanas en Dynasty, el mismo teléfono para las dos.
 */
import { describe, it, expect } from 'vitest';
import { interpretarEleccion, loQueQueda, resumenParaLaEscuela } from './whatsapp-eleccion-de-pago.service';
import type { PagoPendiente } from './whatsapp-receipt-matching.service';

/** Del más viejo al más nuevo, como los entrega `pagosPendientesDe`. */
const SHARIK_AGO: PagoPendiente = {
    id: 'p1', amount: 150000, concept: 'Mensualidad 08/2026 - SHARIK NICOLLE ZAMBRA HIDALGO',
    due_date: '2026-08-10', child_id: 'c-sharik', atleta: 'SHARIK NICOLLE ZAMBRA HIDALGO',
};
const NATHALY_SEP: PagoPendiente = {
    id: 'p2', amount: 150000, concept: 'Mensualidad 09/2026 - Nathaly Valenzuela',
    due_date: '2026-09-10', child_id: 'c-nathaly', atleta: 'Nathaly Valenzuela',
};
const SHARIK_SEP: PagoPendiente = {
    id: 'p3', amount: 150000, concept: 'Mensualidad 09/2026 - SHARIK NICOLLE ZAMBRA HIDALGO',
    due_date: '2026-09-10', child_id: 'c-sharik', atleta: 'SHARIK NICOLLE ZAMBRA HIDALGO',
};

const OPCIONES = [SHARIK_AGO, NATHALY_SEP, SHARIK_SEP];

describe('interpretarEleccion', () => {
    it('un número elige esa opción', () => {
        expect(interpretarEleccion('2', OPCIONES)).toEqual(
            { tipo: 'elegido', pagos: [NATHALY_SEP], motivo: 'numero' });
        expect(interpretarEleccion('la 1 por favor', OPCIONES)).toEqual(
            { tipo: 'elegido', pagos: [SHARIK_AGO], motivo: 'numero' });
    });

    it('varios números eligen varios', () => {
        const r = interpretarEleccion('1 y 3', OPCIONES);
        expect(r).toMatchObject({ tipo: 'elegido', motivo: 'numero' });
        expect((r as any).pagos.map((p: any) => p.id)).toEqual(['p1', 'p3']);
    });

    it('un monto NO se lee como número de opción', () => {
        // «pagué 150000» traía un número; leerlo como la opción 1 sería aplicar
        // plata al cobro equivocado sin que el padre lo eligiera.
        expect(interpretarEleccion('pagué 150000', OPCIONES).tipo).toBe('no_entendi');
    });

    it('«los dos» aplica a todas', () => {
        expect(interpretarEleccion('los dos', OPCIONES)).toMatchObject(
            { tipo: 'elegido', motivo: 'todos' });
        expect(interpretarEleccion('ambos porfa', OPCIONES)).toMatchObject({ motivo: 'todos' });
    });

    it('«el pendiente» aplica al MÁS ANTIGUO, no al del mes', () => {
        for (const frase of ['el pendiente', 'lo atrasado', 'la deuda', 'el más viejo', 'el anterior']) {
            const r = interpretarEleccion(frase, OPCIONES);
            expect(r, frase).toEqual({ tipo: 'elegido', pagos: [SHARIK_AGO], motivo: 'mas_antiguo' });
        }
    });

    it('nombrar a un hijo trae SUS cobros', () => {
        const r = interpretarEleccion('el de Sharik', OPCIONES);
        expect(r).toMatchObject({ tipo: 'elegido', motivo: 'atleta' });
        expect((r as any).pagos.map((p: any) => p.id)).toEqual(['p1', 'p3']);
    });

    it('el apellido compartido por dos hermanas NO desempata', () => {
        // «Zambra» está en las dos fichas. Resolverlo a una sería adivinar.
        const opciones = [SHARIK_AGO, { ...NATHALY_SEP, atleta: 'NATHALY ZAMBRA HIDALGO' }];
        expect(interpretarEleccion('el de Zambra', opciones).tipo).toBe('no_entendi');
    });

    it('un «no» corto cancela; dentro de una frase larga no', () => {
        expect(interpretarEleccion('no, espera', OPCIONES).tipo).toBe('cancelar');
        expect(interpretarEleccion('no sé bien cuál era, me puedes decir cuánto debo', OPCIONES).tipo)
            .toBe('no_entendi');
    });

    it('lo que no entiende NO lo resuelve al azar', () => {
        for (const frase of ['hola', 'gracias', 'ya quedó?', '']) {
            expect(interpretarEleccion(frase, OPCIONES).tipo, frase).toBe('no_entendi');
        }
    });
});

describe('loQueQueda', () => {
    it('devuelve el mes corriente cuando se pagó el atrasado', () => {
        expect(loQueQueda(OPCIONES, [SHARIK_AGO]).map((p) => p.id)).toEqual(['p2', 'p3']);
    });
    it('vacío cuando se pagó todo', () => {
        expect(loQueQueda(OPCIONES, OPCIONES)).toEqual([]);
    });
});

// ─── Lenguaje natural (Dynasty 2026-10-09; casos inventados equivalentes) ───

const JUL: PagoPendiente = { id: 'j', amount: 200000, concept: 'Mensualidad 07/2026 - Martina Ruiz',
    due_date: '2026-07-05', child_id: 'c-1', atleta: 'Martina Ruiz' };
const AGO: PagoPendiente = { ...JUL, id: 'a', concept: 'Mensualidad 08/2026 - Martina Ruiz', due_date: '2026-08-05' };
const SEP: PagoPendiente = { ...JUL, id: 's', concept: 'Mensualidad 09/2026 - Martina Ruiz', due_date: '2026-09-05' };
const TRES = [JUL, AGO, SEP];

describe('interpretarEleccion — meses, descarte y valor', () => {
    it('nombrar el mes elige ese cobro', () => {
        expect(interpretarEleccion('el de septiembre', TRES)).toEqual({ tipo: 'elegido', pagos: [SEP], motivo: 'mes' });
        expect(interpretarEleccion('Agosto', TRES)).toEqual({ tipo: 'elegido', pagos: [AGO], motivo: 'mes' });
        expect(interpretarEleccion('es el de sept', TRES)).toMatchObject({ pagos: [SEP] });
    });

    it('«julio ya lo pagué» descarta julio y acota a los otros dos', () => {
        for (const frase of ['julio ya lo pagué', 'Ya habíamos pagado julio', 'no es el de julio']) {
            const r = interpretarEleccion(frase, TRES);
            expect(r, frase).toMatchObject({ tipo: 'acotar', motivo: 'descarte' });
            expect((r as any).opciones.map((p: any) => p.id), frase).toEqual(['a', 's']);
        }
        // «no es el de julio» descarta pero NO dice que esté pagado.
        expect((interpretarEleccion('no es el de julio', TRES) as any).dicePagado).toEqual([]);
        expect((interpretarEleccion('julio ya lo pagué', TRES) as any).dicePagado).toEqual([JUL]);
    });

    it('si con el descarte queda uno, es ese', () => {
        expect(interpretarEleccion('julio y agosto ya están pagos', TRES))
            .toEqual({ tipo: 'elegido', pagos: [SEP], motivo: 'descarte', dicePagado: [JUL, AGO] });
    });

    it('descarte + elección en la misma frase: «julio ya lo pagué, es el de agosto»', () => {
        expect(interpretarEleccion('julio ya lo pagué, es el de agosto', TRES))
            .toEqual({ tipo: 'elegido', pagos: [AGO], motivo: 'mes', dicePagado: [JUL] });
    });

    it('«el último» es el más nuevo; «el más viejo», el más antiguo', () => {
        expect(interpretarEleccion('el último', TRES)).toEqual({ tipo: 'elegido', pagos: [SEP], motivo: 'mas_reciente' });
        expect(interpretarEleccion('el más reciente', TRES)).toMatchObject({ pagos: [SEP] });
        expect(interpretarEleccion('el más viejo', TRES)).toEqual({ tipo: 'elegido', pagos: [JUL], motivo: 'mas_antiguo' });
    });

    it('discutir el valor NO elige: «2 días» no es la opción 2', () => {
        const r = interpretarEleccion('Y la mensualidad es de $160.000 porque va solo 2 días', TRES);
        expect(r).toEqual({ tipo: 'revision_escuela', valorDicho: 160000, dicePagado: [], todoPagado: false,
            razon: 'va solo 2 días' });
        expect(interpretarEleccion('el valor ahora es 160 mil, solo hace 2 clases', TRES))
            .toMatchObject({ tipo: 'revision_escuela', valorDicho: 160000 });
        expect(interpretarEleccion('ese no es el valor', TRES)).toMatchObject({ tipo: 'revision_escuela', valorDicho: null });
    });

    it('una cantidad suelta («2 clases») no es una opción', () => {
        expect(interpretarEleccion('ella solo va a 2 clases', TRES).tipo).toBe('no_entendi');
    });

    it('el monto que SÍ es el del cobro no se lee como reclamo', () => {
        expect(interpretarEleccion('el de 200.000 de agosto', TRES)).toMatchObject({ tipo: 'elegido', pagos: [AGO] });
    });

    it('«09/2026» no es un monto', () => {
        expect(interpretarEleccion('la mensualidad de 09/2026', TRES)).toMatchObject({ tipo: 'elegido', pagos: [SEP] });
    });

    it('«ya pagué todo» va a la escuela', () => {
        expect(interpretarEleccion('ya pagué todo', TRES)).toMatchObject({ tipo: 'revision_escuela', todoPagado: true });
        expect(interpretarEleccion('julio, agosto y septiembre ya están pagos', TRES))
            .toMatchObject({ tipo: 'revision_escuela', todoPagado: true });
    });

    it('un mes que tienen dos hijos acota a esos dos; el nombre desempata', () => {
        const r = interpretarEleccion('el de septiembre', OPCIONES);
        expect(r).toMatchObject({ tipo: 'acotar', motivo: 'ambiguo' });
        expect((r as any).opciones.map((p: any) => p.id)).toEqual(['p2', 'p3']);
        expect(interpretarEleccion('el de Sharik de septiembre', OPCIONES))
            .toEqual({ tipo: 'elegido', pagos: [SHARIK_SEP], motivo: 'mes' });
    });

    it('un mes que no está entre las opciones no se adivina', () => {
        expect(interpretarEleccion('el de diciembre', TRES).tipo).toBe('no_entendi');
    });
});

describe('resumenParaLaEscuela', () => {
    it('junta lo dicho antes (mes pagado) con el valor y la razón', () => {
        expect(resumenParaLaEscuela({ valorDicho: 160000, dicePagado: [], todoPagado: false, razon: 'va solo 2 días' },
            ['julio'])).toBe('La familia dice que julio ya está pagado y que su mensualidad es $160.000 (va solo 2 días). ' +
            'Mandó un comprobante y no lo apliqué a ningún cobro: revisen su plan y sus pagos.');
    });
});

describe('un deportista que se llama como un mes', () => {
    const ABRIL_AGO: PagoPendiente = { id: 'x1', amount: 120000, concept: 'Mensualidad 08/2026 - Abril Torres',
        due_date: '2026-08-05', child_id: 'c-abril', atleta: 'Abril Torres' };
    const TOMAS_AGO: PagoPendiente = { id: 'x2', amount: 120000, concept: 'Mensualidad 08/2026 - Tomás Torres',
        due_date: '2026-08-05', child_id: 'c-tomas', atleta: 'Tomás Torres' };
    it('«el de Abril» es la niña, no el mes', () => {
        expect(interpretarEleccion('el de Abril', [ABRIL_AGO, TOMAS_AGO]))
            .toEqual({ tipo: 'elegido', pagos: [ABRIL_AGO], motivo: 'atleta' });
    });
});
