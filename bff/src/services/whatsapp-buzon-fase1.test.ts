/**
 * Reglas puras de la Fase 1 del buzón (2026-10-13): adjuntos del hilo,
 * plantillas desde el hilo y autocierre de la bandeja por decisión del pago.
 */
import { describe, expect, it } from 'vitest';
import { idDelMedio, medioDelMensaje, nombreSeguro } from './whatsapp-medios';
import { evaluarPlantilla, ordenarParaElHilo, validarVariables, tomarCupoPlantilla, reiniciarCuposPlantilla, LIMITES_PLANTILLA }
    from './whatsapp-plantilla-manual.service';
import { contarCierres, decisionDelPago, filasParaAutocierrePorDecision, motivoDeFila } from './whatsapp-bandeja.service';

describe('medioDelMensaje', () => {
    it('describe foto, nota de voz y documento sin exponer el payload', () => {
        expect(medioDelMensaje('image', { image: { id: 'm1', mime_type: 'image/jpeg', caption: 'recibo' } }))
            .toEqual({ tipo: 'image', mime: 'image/jpeg', nombre: null, caption: 'recibo', voz: false, disponible: true });
        expect(medioDelMensaje('audio', { audio: { id: 'a1', mime_type: 'audio/ogg; codecs=opus', voice: true } }))
            .toMatchObject({ tipo: 'audio', mime: 'audio/ogg', voz: true, disponible: true });
        expect(medioDelMensaje('document', { document: { id: 'd1', mime_type: 'application/pdf', filename: 'recibo.pdf' } }))
            .toMatchObject({ nombre: 'recibo.pdf', disponible: true });
    });
    it('texto → null; contenido purgado o personal → no disponible y sin id', () => {
        expect(medioDelMensaje('text', { text: { body: 'hola' } })).toBeNull();
        const purgado = { privacidad: 'personal_sin_contenido', image: { id: 'x' } };
        expect(medioDelMensaje('image', purgado)?.disponible).toBe(false);
        expect(idDelMedio('image', purgado)).toBeNull();
        expect(idDelMedio('image', {})).toBeNull();
    });
    it('nombreSeguro no deja comillas ni saltos en el encabezado', () => {
        expect(nombreSeguro('a"b\r\nc.pdf', 'document', 'application/pdf')).toBe('a b c.pdf');
        expect(nombreSeguro(null, 'image', 'image/png')).toBe('whatsapp-image.png');
    });
});

describe('evaluarPlantilla', () => {
    const base = {
        name: 'clase_cancelada', language: 'es_CO', category: 'UTILITY', status: 'APPROVED', waba_id: 'w1',
        components: [{ type: 'BODY', text: 'Hola {{1}} y {{2}}', example: { body_text: [['A', 'B']] } }],
    };
    it('aprobada, UTILITY, sin botón y de la WABA actual → enviable', () => {
        expect(evaluarPlantilla(base, 'w1')).toMatchObject({ enviable: true, variables: 2, ejemplos: ['A', 'B'] });
    });
    it('cada bloqueo con su motivo', () => {
        expect(evaluarPlantilla(base, 'otra').motivo).toBe('otra_waba');
        expect(evaluarPlantilla({ ...base, status: 'PAUSED' }, 'w1').motivo).toBe('no_aprobada');
        expect(evaluarPlantilla({ ...base, category: 'MARKETING' }, 'w1').motivo).toBe('no_es_utility');
        const conBoton = { ...base, components: [...base.components,
            { type: 'BUTTONS', buttons: [{ type: 'URL', url: 'https://sportmaps.co/p/{{1}}' }] }] };
        expect(evaluarPlantilla(conBoton, 'w1').motivo).toBe('necesita_enlace');
    });
    it('una de cobro fuera del horario legal (domingo) → fuera_de_horario', () => {
        const cobro = { ...base, name: 'pago_vence_manana' };
        // Domingo 2026-10-11, 10:00 a. m. Bogotá.
        expect(evaluarPlantilla(cobro, 'w1', new Date('2026-10-11T15:00:00Z')).motivo).toBe('fuera_de_horario');
        // Martes 2026-10-13, 10:00 a. m. Bogotá.
        expect(evaluarPlantilla(cobro, 'w1', new Date('2026-10-13T15:00:00Z')).enviable).toBe(true);
    });
    it('ordena las enviables primero', () => {
        const ps = ordenarParaElHilo([
            evaluarPlantilla({ ...base, name: 'b', category: 'MARKETING' }, 'w1'),
            evaluarPlantilla({ ...base, name: 'z' }, 'w1'),
        ]);
        expect(ps.map((p) => p.nombre)).toEqual(['z', 'b']);
    });
});

describe('validarVariables y freno', () => {
    it('exige todas, limpia saltos y rechaza vacías', () => {
        expect(validarVariables(2, ['a\nb', ' c '])).toEqual({ ok: true, variables: ['a b', 'c'] });
        expect(validarVariables(2, ['a'])).toMatchObject({ ok: false });
        expect(validarVariables(1, ['  '])).toMatchObject({ ok: false });
    });
    it('el freno por conversación corta en el máximo', () => {
        reiniciarCuposPlantilla();
        const t = 1_000_000;
        for (let i = 0; i < LIMITES_PLANTILLA.porConversacion.max; i++) {
            expect(tomarCupoPlantilla('u', 'c', 's', t + i)).toBeNull();
        }
        expect(tomarCupoPlantilla('u', 'c', 's', t + 10)).toMatch(/última hora/);
        // Pasada la hora vuelve a haber cupo.
        expect(tomarCupoPlantilla('u', 'c', 's', t + LIMITES_PLANTILLA.porConversacion.ventanaMs + 1)).toBeNull();
    });
});

describe('autocierre por decisión del pago', () => {
    const llegada = '2026-10-06T12:00:00Z';
    it('decisionDelPago: solo cuenta lo decidido después de la llegada', () => {
        expect(decisionDelPago({ id: 'p', school_id: 's', status: 'paid', concept: null, approved_at: '2026-10-07T00:00:00Z' }, llegada)).toBe('aprobado');
        expect(decisionDelPago({ id: 'p', school_id: 's', status: 'paid', concept: null, approved_at: '2026-10-01T00:00:00Z' }, llegada)).toBeNull();
        expect(decisionDelPago({ id: 'p', school_id: 's', status: 'awaiting_approval', concept: null, updated_at: '2026-10-07T00:00:00Z' }, llegada)).toBeNull();
        expect(decisionDelPago({ id: 'p', school_id: 's', status: 'pending', concept: null, receipt_rejected_at: '2026-10-07T00:00:00Z' }, llegada)).toBe('rechazado');
        expect(decisionDelPago({ id: 'p', school_id: 's', status: 'pending', concept: null }, llegada)).toBeNull();
        expect(decisionDelPago({ id: 'p', school_id: 's', status: 'paid', concept: null, approved_at: '2026-10-07T00:00:00Z' }, null)).toBeNull();
    });
    it('no cierra por pagos de otra escuela ni las ya_registrado ni las cerradas', () => {
        const pago = { id: 'p1', school_id: 'otra', status: 'paid', concept: null, approved_at: '2026-10-07T00:00:00Z', ocr_reference: 'R' };
        const filas = [
            { id: 'f1', status: 'ignored', error_message: 'x', result_ref_id: 'p1', created_at: llegada },
            { id: 'f2', status: 'ignored', error_message: 'x', pregunta_ocr: { ocr: { reference: 'R' } }, created_at: llegada },
        ];
        expect(filasParaAutocierrePorDecision('s', filas, [pago])).toEqual([]);
        const propio = { ...pago, school_id: 's' };
        expect(filasParaAutocierrePorDecision('s', [
            { id: 'f3', status: 'ignored', error_message: 'recuperado: ya_registrado — x', result_ref_id: 'p1', created_at: llegada },
            { id: 'f4', status: 'ignored', error_message: 'cerrado_escuela: descartado — x | y', result_ref_id: 'p1', created_at: llegada },
        ], [propio])).toEqual([]);
        expect(filasParaAutocierrePorDecision('s', filas, [propio]).map((r) => r.fila.id)).toEqual(['f1', 'f2']);
    });
    it('contarCierres y los motivos nuevos', () => {
        expect(contarCierres(['cerrado_escuela: resuelto_auto — a | b', 'cerrado_escuela: descartado — c | d', 'otro', null]))
            .toEqual({ escuela: 1, automaticas: 1, total: 2 });
        expect(motivoDeFila({ id: 'x', status: 'ignored', error_message: 'monto_no_cuadra: leído 5000' }).motivo).toBe('monto_distinto');
    });
});
