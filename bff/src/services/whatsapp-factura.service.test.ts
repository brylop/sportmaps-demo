/**
 * Flujo de factura electrónica del bot de WhatsApp, paso a paso. Sin LLM, sin
 * base y sin Meta: el almacén del flujo, el guardado y el envío se inyectan.
 *
 * Lo que se vigila:
 *   · cada paso valida con las mismas reglas que el formulario y la base, y
 *     al tercer intento malo se ofrece el formulario en vez de insistir;
 *   · el estado sobrevive entre mensajes y vence a las 24 h;
 *   · solo se guarda después de «Correcto»; «Corregir» vuelve a empezar;
 *   · un botón de otra cosa o una pregunta suelta liberan el turno;
 *   · al acudiente SIN cuenta nunca se le muestra lo que ya está guardado;
 *   · si la escuela no factura, no se piden datos.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/supabase', () => ({ supabase: { from: () => { throw new Error('sin base en pruebas'); }, rpc: async () => ({ data: null, error: null }) } }));

import {
    atenderTurnoFactura, esIntencionFactura, respuestaSiNo, tipoDesdeRespuesta, ofertaTrasPago,
    BOTON_FE, VIGENCIA_FLUJO_MS, type AlmacenFlujo, type CtxFactura, type FlujoGuardado,
    type PasoFactura, type DatosFlujo,
} from './whatsapp-factura.service';
import type { DuenoFactura, FilaFactura } from './factura-pagador.service';

// ─── Dobles ──────────────────────────────────────────────────────────────────

let reloj = new Date('2026-10-05T15:00:00Z');
const flujos = new Map<string, FlujoGuardado>();
const almacen: AlmacenFlujo = {
    async leer(id) { return flujos.get(id) ?? null; },
    async guardar(id, step: PasoFactura, data: DatosFlujo) {
        flujos.set(id, { step, data, expires_at: new Date(reloj.getTime() + VIGENCIA_FLUJO_MS).toISOString() });
        return true;
    },
    async borrar(id) { flujos.delete(id); },
};

let enviados: { texto: string; paso: string; botones?: { id: string; title: string }[] }[] = [];
let guardar: ReturnType<typeof vi.fn>;
let filaGuardada: FilaFactura | null = null;
let escuelaFactura = true;
let enlace: string | null = 'https://app.sportmaps.co/p/TokenAAAAAAAAAAAAAAAAAAA#factura';

const DUENO_CUENTA: DuenoFactura = { tipo: 'perfil', profileId: 'parent-1' };
const DUENO_TEL: DuenoFactura = { tipo: 'telefono', schoolId: 'sch-1', phone10: '3001234567' };

function ctx(over: Partial<CtxFactura> = {}): CtxFactura {
    return {
        conversationId: 'conv-1',
        schoolId: 'sch-1',
        dueno: DUENO_CUENTA,
        conCuenta: true,
        enviar: async (texto, paso, botones) => { enviados.push({ texto, paso, botones }); },
        enlaceFormulario: async () => enlace,
        almacen,
        ahora: () => reloj,
        guardar: guardar as any,
        leerFila: async () => filaGuardada,
        escuelaFactura: async () => escuelaFactura,
        ...over,
    };
}

const turno = (texto: string, boton: string | null = null, c = ctx()) => atenderTurnoFactura(c, texto, boton);
const ultimo = () => enviados[enviados.length - 1];
const paso = () => flujos.get('conv-1')?.step ?? null;

beforeEach(() => {
    reloj = new Date('2026-10-05T15:00:00Z');
    flujos.clear();
    enviados = [];
    guardar = vi.fn(async () => ({ ok: true }));
    filaGuardada = null;
    escuelaFactura = true;
    enlace = 'https://app.sportmaps.co/p/TokenAAAAAAAAAAAAAAAAAAA#factura';
});

// ─── Texto ───────────────────────────────────────────────────────────────────

describe('reconocer lo que escribe la familia', () => {
    it('intención de factura por palabra', () => {
        expect(esIntencionFactura('Necesito factura electrónica')).toBe(true);
        expect(esIntencionFactura('me pueden FACTURAR?')).toBe(true);
        expect(esIntencionFactura('cuánto debo')).toBe(false);
    });
    it('sí / no por botón o escrito (modo asistido manda texto)', () => {
        expect(respuestaSiNo('', BOTON_FE.SI)).toBe('si');
        expect(respuestaSiNo('Sí, quiero factura', null)).toBe('si');
        expect(respuestaSiNo('No, gracias', null)).toBe('no');
        expect(respuestaSiNo('tal vez', null)).toBeNull();
    });
    it('tipo de documento por botón o escrito', () => {
        expect(tipoDesdeRespuesta('', BOTON_FE.NIT)).toBe('NIT');
        expect(tipoDesdeRespuesta('Cédula (CC)', null)).toBe('CC');
        expect(tipoDesdeRespuesta('pasaporte', null)).toBe('PASAPORTE');
        expect(tipoDesdeRespuesta('ce', null)).toBe('CE');
        expect(tipoDesdeRespuesta('licencia', null)).toBeNull();
    });
});

// ─── Flujo completo ──────────────────────────────────────────────────────────

describe('flujo paso a paso', () => {
    it('camino feliz por aquí: pregunta, pide 4 datos, confirma y guarda', async () => {
        expect(await turno('necesito factura')).toBe(true);
        expect(paso()).toBe('preguntar_quiere');
        expect(ultimo().botones?.map((b) => b.id)).toEqual([BOTON_FE.SI, BOTON_FE.NO]);

        await turno('', BOTON_FE.SI);
        expect(paso()).toBe('elegir_canal');
        await turno('', BOTON_FE.AQUI);
        expect(paso()).toBe('tipo_documento');
        await turno('', BOTON_FE.CC);
        expect(paso()).toBe('numero');
        await turno('1.020.304.050');
        expect(paso()).toBe('nombre');
        expect(flujos.get('conv-1')?.data.numero).toBe('1020304050');
        await turno('  Ana   Gómez  ');
        expect(paso()).toBe('correo');
        await turno('Ana@Correo.com');
        expect(paso()).toBe('confirmar');
        expect(ultimo().texto).toContain('1020304050');
        expect(ultimo().texto).toContain('Ana Gómez');
        expect(ultimo().texto).toContain('ana@correo.com');
        expect(guardar).not.toHaveBeenCalled();   // nada se guarda antes de confirmar

        await turno('', BOTON_FE.CORRECTO);
        expect(guardar).toHaveBeenCalledWith(DUENO_CUENTA, {
            preferencia: 'quiere', tipoDocumento: 'CC', numeroDocumento: '1020304050',
            nombre: 'Ana Gómez', correo: 'ana@correo.com',
        }, 'whatsapp');
        expect(paso()).toBeNull();
        expect(ultimo().paso).toBe('factura_guardada');
    });

    it('«No, gracias» guarda no_quiere y cierra', async () => {
        await turno('factura');
        await turno('No, gracias');
        expect(guardar).toHaveBeenCalledWith(DUENO_CUENTA, { preferencia: 'no_quiere' }, 'whatsapp');
        expect(paso()).toBeNull();
    });

    it('«no quiero factura» de entrada se registra sin preguntar', async () => {
        await turno('no quiero factura');
        expect(guardar).toHaveBeenCalledWith(DUENO_CUENTA, { preferencia: 'no_quiere' }, 'whatsapp');
        expect(enviados).toHaveLength(1);
    });

    it('«Por formulario» manda el enlace /p/<token>#factura y cierra', async () => {
        await turno('factura');
        await turno('', BOTON_FE.SI);
        await turno('', BOTON_FE.FORMULARIO);
        expect(ultimo().texto).toContain('#factura');
        expect(paso()).toBeNull();
    });

    it('sin enlace disponible se salta la elección y pide los datos por aquí', async () => {
        enlace = null;
        await turno('factura');
        await turno('Sí, quiero factura');
        expect(paso()).toBe('tipo_documento');
    });

    it('«Otro documento» muestra la lista larga y acepta lo escrito', async () => {
        flujos.set('conv-1', { step: 'tipo_documento', data: {}, expires_at: new Date(reloj.getTime() + 1000).toISOString() });
        await turno('', BOTON_FE.OTRO);
        expect(ultimo().texto).toMatch(/PASAPORTE/);
        await turno('pasaporte');
        expect(flujos.get('conv-1')?.data.tipo).toBe('PASAPORTE');
    });

    it('NIT con DV pegado se guarda sin DV y pide razón social', async () => {
        flujos.set('conv-1', { step: 'numero', data: { tipo: 'NIT' }, expires_at: new Date(reloj.getTime() + 1000).toISOString() });
        await turno('901.929.705-1');
        expect(flujos.get('conv-1')?.data.numero).toBe('901929705');
        expect(ultimo().texto).toMatch(/razón social/);
    });

    it('correo opcional: «no tengo» deja el correo vacío', async () => {
        flujos.set('conv-1', { step: 'correo', data: { tipo: 'CC', numero: '12345', nombre: 'Ana Gómez' }, expires_at: new Date(reloj.getTime() + 1000).toISOString() });
        await turno('no tengo');
        expect(paso()).toBe('confirmar');
        expect(flujos.get('conv-1')?.data.correo).toBeNull();
    });

    it('«Corregir» vuelve al tipo de documento sin guardar', async () => {
        flujos.set('conv-1', { step: 'confirmar', data: { tipo: 'CC', numero: '12345', nombre: 'Ana Gómez', correo: null }, expires_at: new Date(reloj.getTime() + 1000).toISOString() });
        await turno('', BOTON_FE.CORREGIR);
        expect(paso()).toBe('tipo_documento');
        expect(guardar).not.toHaveBeenCalled();
    });

    it('si guardar falla, lo dice y no deja el flujo colgado', async () => {
        guardar = vi.fn(async () => ({ ok: false, error: 'documento_invalido' }));
        flujos.set('conv-1', { step: 'confirmar', data: { tipo: 'CC', numero: '12345', nombre: 'Ana Gómez', correo: null }, expires_at: new Date(reloj.getTime() + 1000).toISOString() });
        await turno('Correcto');
        expect(ultimo().paso).toBe('factura_error_guardar');
        expect(paso()).toBeNull();
    });
});

describe('validación con reintentos', () => {
    it('un documento inválido se vuelve a pedir; al tercero se ofrece el formulario', async () => {
        flujos.set('conv-1', { step: 'numero', data: { tipo: 'CC' }, expires_at: new Date(reloj.getTime() + 1000).toISOString() });
        await turno('12A');
        expect(ultimo().texto).toMatch(/solo números/);
        expect(paso()).toBe('numero');
        await turno('12');
        expect(paso()).toBe('numero');
        await turno('1');
        expect(paso()).toBeNull();
        expect(ultimo().paso).toBe('factura_demasiados_intentos');
        expect(ultimo().texto).toContain('#factura');
    });

    it('un correo inválido se vuelve a pedir', async () => {
        flujos.set('conv-1', { step: 'correo', data: { tipo: 'CC', numero: '12345', nombre: 'Ana Gómez' }, expires_at: new Date(reloj.getTime() + 1000).toISOString() });
        await turno('ana@correo');
        expect(paso()).toBe('correo');
        expect(ultimo().texto).toMatch(/no parece válido/);
    });

    it('un nombre de puros números no pasa', async () => {
        flujos.set('conv-1', { step: 'nombre', data: { tipo: 'CC', numero: '12345' }, expires_at: new Date(reloj.getTime() + 1000).toISOString() });
        await turno('12345');
        expect(paso()).toBe('nombre');
    });
});

describe('estado entre mensajes', () => {
    it('vence a las 24 h: el mensaje siguiente ya no se lee como respuesta', async () => {
        await turno('factura');
        await turno('', BOTON_FE.SI);
        await turno('', BOTON_FE.AQUI);
        expect(paso()).toBe('tipo_documento');
        reloj = new Date(reloj.getTime() + VIGENCIA_FLUJO_MS + 1);
        expect(await turno('CC')).toBe(false);
        expect(paso()).toBeNull();
    });

    it('un botón de otra cosa («Ver mis pagos») cierra el flujo y suelta el turno', async () => {
        await turno('factura');
        expect(await turno('', 'sm_ver_pagos')).toBe(false);
        expect(paso()).toBeNull();
    });

    it('una pregunta suelta en un paso de botones suelta el turno', async () => {
        await turno('factura');
        expect(await turno('¿cuánto debo de este mes?')).toBe(false);
        expect(paso()).toBeNull();
    });

    it('«cancelar» cierra en cualquier paso', async () => {
        flujos.set('conv-1', { step: 'nombre', data: { tipo: 'CC', numero: '12345' }, expires_at: new Date(reloj.getTime() + 1000).toISOString() });
        expect(await turno('cancelar')).toBe(true);
        expect(paso()).toBeNull();
    });

    it('sin flujo abierto y sin pedir factura, no toma el turno', async () => {
        expect(await turno('hola')).toBe(false);
        expect(enviados).toHaveLength(0);
    });
});

describe('a quién y qué se le muestra', () => {
    it('con cuenta y datos guardados: se le dice el final del documento y el correo enmascarado', async () => {
        filaGuardada = {
            preference: 'quiere', document_type: 'CC', document_number: '1020304050', legal_name: 'Ana Gómez',
            invoice_email: 'ana.gomez@correo.com', address: null, city_dane: null, department: null,
        };
        await turno('factura');
        expect(ultimo().texto).toContain('4050');
        expect(ultimo().texto).toContain('an•••@correo.com');
        expect(ultimo().texto).not.toContain('1020304050');
    });

    it('SIN cuenta: nunca se le muestra lo guardado, y se guarda por escuela + celular', async () => {
        filaGuardada = {
            preference: 'quiere', document_type: 'CC', document_number: '1020304050', legal_name: 'Ana Gómez',
            invoice_email: 'ana@correo.com', address: null, city_dane: null, department: null,
        };
        const c = ctx({ dueno: DUENO_TEL, conCuenta: false });
        await turno('factura', null, c);
        expect(ultimo().texto).not.toContain('4050');
        expect(ultimo().texto).not.toContain('Ana');
        await turno('No, gracias', null, c);
        expect(guardar).toHaveBeenCalledWith(DUENO_TEL, { preferencia: 'no_quiere' }, 'whatsapp');
    });

    it('si la escuela no factura electrónicamente, no se piden datos', async () => {
        escuelaFactura = false;
        expect(await turno('factura')).toBe(true);
        expect(ultimo().paso).toBe('factura_no_disponible');
        expect(paso()).toBeNull();
    });

    it('sin tabla de flujos (migración sin aplicar) ofrece el formulario', async () => {
        const c = ctx({ almacen: { ...almacen, guardar: async () => false } });
        await turno('factura', null, c);
        expect(ultimo().paso).toBe('factura_sin_flujo');
        expect(ultimo().texto).toContain('#factura');
    });
});

describe('oferta después de confirmar un pago', () => {
    it('solo a quien no ha respondido y si la escuela factura', async () => {
        expect(await ofertaTrasPago({ schoolId: 's', dueno: DUENO_CUENTA, leerFila: async () => null, escuelaFactura: async () => true }))
            .not.toBeNull();
        expect(await ofertaTrasPago({
            schoolId: 's', dueno: DUENO_CUENTA, escuelaFactura: async () => true,
            leerFila: async () => ({ preference: 'no_quiere' } as FilaFactura),
        })).toBeNull();
        expect(await ofertaTrasPago({ schoolId: 's', dueno: DUENO_CUENTA, leerFila: async () => null, escuelaFactura: async () => false }))
            .toBeNull();
    });
});
