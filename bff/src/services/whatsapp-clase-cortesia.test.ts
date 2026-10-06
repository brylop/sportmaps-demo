/**
 * Clase de cortesía por WhatsApp: el motor del flujo, sin red ni base.
 *
 * El estado se simula igual que en producción: lo que se "envía" con estado
 * queda como el último saliente y es lo que lee el turno siguiente; un mensaje
 * terminal (estado null) cierra el flujo.
 *
 * Caso de origen: Dynasty, 2026-10-06 — «Clase de cortesía tienen» y el bot
 * contestó que no tenía esa información.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/supabase', () => ({ supabase: {} }));
vi.mock('./push.service', () => ({ sendToUser: vi.fn() }));
vi.mock('./avisos-correo.service', () => ({ destinatariosDeEscuela: vi.fn(), enviarConReserva: vi.fn() }));

import {
    atenderTurnoCortesia, pideClaseDeCortesia, quiereCancelarClase, leerEdad, filtrarVigentes,
    tituloBoton, BOTON_CC, type CtxCortesia, type EstadoCortesia, type FranjaCortesia,
    type ResultadoReserva, type ResultadoCancelacion, type ReservaVigente,
} from './whatsapp-clase-cortesia.service';

// 2026-10-06 08:00 en Bogotá.
const AHORA = new Date('2026-10-06T13:00:00Z');

const F = (id: string, fecha: string, hora: string, cupos = 3, grupo = 'Sub-15'): FranjaCortesia => ({
    id, grupo, fecha, horaInicio: hora, horaFin: '18:30', sede: 'Sede principal', cupos,
});

interface Enviado { texto: string; step: string; estado: EstadoCortesia | null; botones?: any[]; enTexto?: string }

function armar(op: {
    franjas?: FranjaCortesia[];
    reserva?: ReservaVigente | null;
    reservar?: (p: any) => Promise<ResultadoReserva>;
    cancelar?: () => Promise<ResultadoCancelacion>;
    acudiente?: string | null;
} = {}) {
    const enviados: Enviado[] = [];
    let estado: EstadoCortesia | null = null;
    let franjas = op.franjas ?? [];
    const reservar = vi.fn(op.reservar ?? (async () => ({ ok: true, leadId: 'lead-1', duplicado: false, conCupo: true }) as ResultadoReserva));
    const cancelar = vi.fn(op.cancelar ?? (async () => ({ ok: true, franja: null }) as ResultadoCancelacion));
    const avisarEscuela = vi.fn(async () => {});
    const ctx: CtxCortesia = {
        conversationId: 'conv-1',
        schoolId: 'school-1',
        contactWaId: '573001112233',
        enviar: async (texto, step, est, botones, enTexto) => {
            enviados.push({ texto, step, estado: est, botones, enTexto });
            estado = est;
        },
        nombreAcudiente: op.acudiente !== undefined ? async () => op.acudiente ?? null : undefined,
        leerEstado: async () => estado,
        franjas: async () => franjas,
        reservaVigente: async () => op.reserva ?? null,
        reservar,
        cancelar,
        avisarEscuela,
        ahora: () => AHORA,
    };
    const turno = (texto: string, botonId: string | null = null, opciones = {}) =>
        atenderTurnoCortesia(ctx, texto, botonId, opciones);
    return {
        ctx, enviados, reservar, cancelar, avisarEscuela, turno,
        ultimo: () => enviados[enviados.length - 1],
        estado: () => estado,
        setFranjas: (f: FranjaCortesia[]) => { franjas = f; },
    };
}

describe('reglas (puras)', () => {
    it('reconoce las formas de pedir la clase de cortesía', () => {
        for (const t of ['Clase de cortesía tienen', '¿tienen clase de prueba?', 'clase gratis?',
            '¿Puedo ir a probar?', 'quiero agendar una clase', 'tienen cortesía para mi hija']) {
            expect(pideClaseDeCortesia(t), t).toBe(true);
        }
        for (const t of ['cuánto debo', 'hola', 'mi hija no va a la clase hoy']) {
            expect(pideClaseDeCortesia(t), t).toBe(false);
        }
    });

    it('«cancelar mi clase» sí; «cancelar» suelto no', () => {
        expect(quiereCancelarClase('quiero cancelar mi clase')).toBe(true);
        expect(quiereCancelarClase('cancelar la clase de prueba')).toBe(true);
        expect(quiereCancelarClase('cancelar')).toBe(false);
    });

    it('lee edad o fecha de nacimiento', () => {
        expect(leerEdad('12', AHORA)).toEqual({ edad: 12, fechaNacimiento: null });
        expect(leerEdad('12 años', AHORA)).toEqual({ edad: 12, fechaNacimiento: null });
        expect(leerEdad('15/03/2014', AHORA)).toEqual({ edad: 12, fechaNacimiento: '2014-03-15' });
        expect(leerEdad('2014-11-20', AHORA)).toEqual({ edad: 11, fechaNacimiento: '2014-11-20' });
        expect(leerEdad('31/02/2014', AHORA)).toBeNull();
        expect(leerEdad('mañana', AHORA)).toBeNull();
        expect(leerEdad('1', AHORA)).toBeNull();
    });

    it('descarta franjas pasadas, sin cupo o de hoy que ya empezaron', () => {
        const v = filtrarVigentes([
            F('pasada', '2026-08-28', '17:00'),
            F('hoy-temprano', '2026-10-06', '07:00'),
            F('hoy-tarde', '2026-10-06', '17:00'),
            F('llena', '2026-10-10', '17:00', 0),
            F('futura', '2026-10-08', '17:00'),
        ], AHORA);
        expect(v.map((f) => f.id)).toEqual(['hoy-tarde', 'futura']);
    });

    it('título de botón ≤ 20 caracteres y numerado', () => {
        const t = tituloBoton(F('a', '2026-10-10', '17:00'), 1);
        expect(t).toBe('1. Sáb 10/10 5:00pm');
        expect(Array.from(t).length).toBeLessThanOrEqual(20);
    });
});

describe('sin franjas cargadas', () => {
    it('lo dice y ofrece dejar los datos; con «Sí» crea el prospecto SIN cupo', async () => {
        const t = armar({ franjas: [] });
        expect(await t.turno('Clase de cortesía tienen')).toBe(true);
        expect(t.ultimo().texto).toContain('no tengo horarios de *clase de cortesía* publicados');
        expect(t.ultimo().botones?.map((b) => b.id)).toEqual([BOTON_CC.DATOS_SI, BOTON_CC.DATOS_NO]);
        expect(t.estado()?.paso).toBe('dejar_datos');

        await t.turno('Sí, dejar mis datos', BOTON_CC.DATOS_SI);
        expect(t.estado()?.paso).toBe('nombre');
        await t.turno('juan pérez');
        expect(t.estado()?.paso).toBe('edad');
        await t.turno('10');
        expect(t.estado()?.paso).toBe('acudiente');
        await t.turno('Ana Gómez');
        expect(t.estado()?.paso).toBe('confirmar');
        expect(t.ultimo().texto).toContain('la escuela te contacta para agendarla');
        expect(t.ultimo().texto).toContain('Juan Pérez');

        await t.turno('Confirmar', BOTON_CC.CONFIRMAR);
        expect(t.reservar).toHaveBeenCalledWith(expect.objectContaining({
            franjaId: null, nombre: 'Juan Pérez', edad: 10, acudiente: 'Ana Gómez', contactWaId: '573001112233',
        }));
        expect(t.ultimo().texto).toContain('Le pasé los datos de *Juan Pérez*');
        expect(t.estado()).toBeNull();
        expect(t.avisarEscuela).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'datos' }));
    });

    it('«No, gracias» cierra sin crear nada', async () => {
        const t = armar({ franjas: [] });
        await t.turno('clase de prueba?');
        await t.turno('No, gracias', BOTON_CC.DATOS_NO);
        expect(t.estado()).toBeNull();
        expect(t.reservar).not.toHaveBeenCalled();
    });
});

describe('reserva', () => {
    const FRANJAS = [F('f1', '2026-10-10', '17:00', 2), F('f2', '2026-10-11', '09:00', 5, 'Sub-17')];

    it('camino feliz: franja con botón → nombre → fecha de nacimiento → acudiente → Confirmar → reservada', async () => {
        const t = armar({ franjas: FRANJAS });
        await t.turno('Clase de cortesía tienen');
        const oferta = t.ultimo();
        expect(oferta.texto).toContain('*Sub-15* — sábado 10 de octubre, 5:00 p. m. a 6:30 p. m. (1 h 30 min)');
        expect(oferta.texto).toContain('2 cupos');
        expect(oferta.botones?.map((b) => b.id)).toEqual([`${BOTON_CC.FRANJA}f1`, `${BOTON_CC.FRANJA}f2`]);

        await t.turno('1. Sáb 10/10 5:00pm', `${BOTON_CC.FRANJA}f1`);
        expect(t.estado()?.paso).toBe('nombre');
        await t.turno('Sofía Ruiz');
        await t.turno('15/03/2014');
        await t.turno('Carlos Ruiz');
        expect(t.ultimo().texto).toContain('• Clase: *Sub-15*');
        expect(t.ultimo().texto).toContain('• Acudiente: *Carlos Ruiz*');
        expect(t.ultimo().botones?.map((b) => b.title)).toEqual(['Confirmar', 'Cambiar']);

        await t.turno('Confirmar', BOTON_CC.CONFIRMAR);
        expect(t.reservar).toHaveBeenCalledWith(expect.objectContaining({
            franjaId: 'f1', nombre: 'Sofía Ruiz', edad: 12, fechaNacimiento: '2014-03-15', acudiente: 'Carlos Ruiz',
        }));
        const fin = t.ultimo();
        expect(fin.texto).toContain('Quedó reservada la clase de cortesía de *Sofía Ruiz*');
        expect(fin.texto).toContain('📍 Sede principal');
        expect(fin.texto).toContain('cancelar mi clase');
        expect(t.estado()).toBeNull();
        expect(t.avisarEscuela).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'reservada', leadId: 'lead-1' }));
    });

    it('el número escrito también elige (modo asistido, sin botones)', async () => {
        const t = armar({ franjas: FRANJAS });
        await t.turno('clase de prueba');
        await t.turno('2');
        expect(t.estado()?.datos.franja?.id).toBe('f2');
    });

    it('familia con cuenta: no le pregunta su propio nombre como acudiente', async () => {
        const t = armar({ franjas: FRANJAS, acudiente: 'Marta López' });
        await t.turno('clase de prueba');
        await t.turno('x', `${BOTON_CC.FRANJA}f1`);
        await t.turno('Pedro López');
        await t.turno('9');
        expect(t.estado()?.paso).toBe('confirmar');
        expect(t.ultimo().texto).toContain('Marta López');
    });

    it('adulto: no pide acudiente', async () => {
        const t = armar({ franjas: FRANJAS });
        await t.turno('clase de prueba');
        await t.turno('x', `${BOTON_CC.FRANJA}f2`);
        await t.turno('Laura Díaz');
        await t.turno('25 años');
        expect(t.estado()?.paso).toBe('confirmar');
    });

    it('CUPO LLENO en la carrera: ofrece lo que queda y conserva los datos', async () => {
        let intento = 0;
        const t = armar({
            franjas: FRANJAS,
            reservar: async () => (++intento === 1
                ? { ok: false, motivo: 'lleno' }
                : { ok: true, leadId: 'lead-2', duplicado: false, conCupo: true }),
        });
        await t.turno('clase de prueba');
        await t.turno('x', `${BOTON_CC.FRANJA}f1`);
        await t.turno('Sofía Ruiz');
        await t.turno('12');
        await t.turno('Carlos Ruiz');
        // Otra familia se llevó el último cupo de f1 mientras confirmaba.
        t.setFranjas([{ ...FRANJAS[0], cupos: 0 }, FRANJAS[1]]);
        await t.turno('Confirmar', BOTON_CC.CONFIRMAR);
        expect(t.ultimo().texto).toContain('se acaba de llenar');
        expect(t.ultimo().botones?.map((b) => b.id)).toEqual([`${BOTON_CC.FRANJA}f2`]);
        expect(t.estado()?.datos.nombre).toBe('Sofía Ruiz');

        // Elige otra: ya tiene los datos, va directo al resumen.
        await t.turno('x', `${BOTON_CC.FRANJA}f2`);
        expect(t.estado()?.paso).toBe('confirmar');
        await t.turno('Confirmar', BOTON_CC.CONFIRMAR);
        expect(t.reservar).toHaveBeenLastCalledWith(expect.objectContaining({ franjaId: 'f2' }));
        expect(t.ultimo().texto).toContain('Quedó reservada');
    });

    it('franja que se cerró entre la oferta y el toque: lo dice y re-ofrece', async () => {
        const t = armar({ franjas: FRANJAS });
        await t.turno('clase de prueba');
        t.setFranjas([FRANJAS[1]]);
        await t.turno('x', `${BOTON_CC.FRANJA}f1`);
        expect(t.ultimo().texto).toContain('esa franja ya no está disponible');
    });

    it('dedupe de 24 h de submit_school_lead: NO dice «reservada» si no tomó el cupo', async () => {
        const t = armar({ franjas: FRANJAS, reservar: async () => ({ ok: true, leadId: 'viejo', duplicado: true, conCupo: false }) });
        await t.turno('clase de prueba');
        await t.turno('x', `${BOTON_CC.FRANJA}f2`);
        await t.turno('Laura Díaz');
        await t.turno('30');
        await t.turno('Confirmar', BOTON_CC.CONFIRMAR);
        expect(t.ultimo().texto).not.toContain('Quedó reservada');
        expect(t.ultimo().texto).toContain('te confirme el horario');
        expect(t.avisarEscuela).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'no_reservada' }));
    });

    it('más de 3 franjas: 2 con botón + «Ver más»', async () => {
        const t = armar({ franjas: [
            F('a', '2026-10-07', '17:00'), F('b', '2026-10-08', '17:00'),
            F('c', '2026-10-09', '17:00'), F('d', '2026-10-10', '17:00'),
        ] });
        await t.turno('clase de prueba');
        expect(t.ultimo().botones?.map((b) => b.id)).toEqual([`${BOTON_CC.FRANJA}a`, `${BOTON_CC.FRANJA}b`, BOTON_CC.VER_MAS]);
        await t.turno('Ver más horarios', BOTON_CC.VER_MAS);
        expect(t.ultimo().botones?.map((b) => b.id)).toEqual([`${BOTON_CC.FRANJA}c`, `${BOTON_CC.FRANJA}d`, BOTON_CC.VER_MAS]);
        expect(t.ultimo().texto).toContain('3. *Sub-15*');
    });

    it('ya tiene una clase reservada: se le recuerda, no se le reserva otra', async () => {
        const t = armar({ franjas: FRANJAS, reserva: { leadId: 'l', nombre: 'Sofía Ruiz', franja: FRANJAS[0] } });
        await t.turno('clase de prueba');
        expect(t.ultimo().texto).toContain('Ya tienes una clase de cortesía reservada');
        expect(t.ultimo().botones?.[0].id).toBe(BOTON_CC.CANCELAR);
        expect(t.estado()).toBeNull();
    });

    it('una pregunta a mitad del flujo lo suelta (la atiende el bot normal)', async () => {
        const t = armar({ franjas: FRANJAS });
        await t.turno('clase de prueba');
        await t.turno('x', `${BOTON_CC.FRANJA}f1`);
        expect(await t.turno('¿y cuánto vale la mensualidad?')).toBe(false);
    });

    it('un botón de otra cosa con el flujo abierto lo suelta', async () => {
        const t = armar({ franjas: FRANJAS });
        await t.turno('clase de prueba');
        expect(await t.turno('Ver mis pagos', 'sm_ver_pagos')).toBe(false);
    });

    it('con iniciar=false no arranca nada nuevo (puerta del desconocido)', async () => {
        const t = armar({ franjas: FRANJAS });
        expect(await t.turno('clase de prueba', null, { iniciar: false })).toBe(false);
        expect(t.enviados).toHaveLength(0);
    });
});

describe('cancelar mi clase', () => {
    const RESERVA: ReservaVigente = { leadId: 'l1', nombre: 'Sofía Ruiz', franja: F('f1', '2026-10-10', '17:00', 0) };

    it('con reserva: pregunta, y con «Sí, cancelar» libera el cupo y avisa', async () => {
        const t = armar({ reserva: RESERVA, cancelar: async () => ({ ok: true, franja: RESERVA.franja }) });
        expect(await t.turno('quiero cancelar mi clase', null, { iniciar: false })).toBe(true);
        expect(t.estado()?.paso).toBe('confirmar_cancelacion');
        expect(t.ultimo().texto).toContain('*Sofía Ruiz*');

        await t.turno('Sí, cancelar', BOTON_CC.CANCELAR_SI);
        expect(t.cancelar).toHaveBeenCalledWith('school-1', '573001112233');
        expect(t.ultimo().texto).toContain('cancelé tu clase de cortesía del sábado 10 de octubre');
        expect(t.estado()).toBeNull();
        expect(t.avisarEscuela).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'cancelada' }));
    });

    it('«No, la mantengo» no cancela', async () => {
        const t = armar({ reserva: RESERVA });
        await t.turno('cancelar mi clase');
        await t.turno('No, la mantengo', BOTON_CC.CANCELAR_NO);
        expect(t.cancelar).not.toHaveBeenCalled();
        expect(t.ultimo().texto).toContain('sigue reservada');
    });

    it('sin la RPC aplicada: se le pide a la escuela, nunca se toca el cupo', async () => {
        const t = armar({ reserva: RESERVA, cancelar: async () => ({ ok: false, motivo: 'sin_rpc' }) });
        await t.turno('cancelar mi clase');
        await t.turno('si');
        expect(t.ultimo().texto).toContain('Le pedí a la escuela que cancele tu clase');
        expect(t.avisarEscuela).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'cancelacion_pedida' }));
    });

    it('SIN reserva de ese número: no se lo toma (para una familia es «no voy a entrenar»)', async () => {
        const t = armar({ reserva: null });
        expect(await t.turno('cancelar la clase de hoy')).toBe(false);
        expect(t.enviados).toHaveLength(0);
    });
});
