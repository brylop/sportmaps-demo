/**
 * Ventas por WhatsApp, carril B (servicios): consulta (F1) y pedido + pago (F2).
 * Spec: docs/specs/ventas-por-whatsapp.md §5.3, §5.5, §6.3.
 *
 * Conversaciones de ejemplo del spec y del análisis de Dynasty (2026-10-06),
 * sin base, sin Meta y sin Wompi: catálogo, cobro, link, aviso y almacén del
 * flujo son dobles. En cada turno se cuenta lo que manda el bot: UNA respuesta.
 *
 * Lo que se vigila:
 *   · todo valor en dinero que dice el bot sale del catálogo o del link;
 *   · nunca se crea un cobro sin «Sí, procedemos», ni a un desconocido;
 *   · doble toque = el mismo cobro (misma clave de idempotencia);
 *   · «te aviso por aquí» solo si el aviso quedó registrado;
 *   · «ya no» anula; «retomar» con el cobro vencido vuelve a cotizar;
 *   · el comprobante con una venta abierta va a ESE cobro, nunca a la mensualidad;
 *   · español de Colombia, sin voseo.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/supabase', () => ({
    supabase: { from: () => { throw new Error('sin base en pruebas'); }, rpc: async () => ({ data: null, error: null }) },
}));

import {
    atenderTurnoVenta, preguntaPorServicio, serviciosNombrados, cuandoEs, textoFicha, textoResumen,
    decidirComprobanteDeVenta, desiste, esSi, BOTON_VENTA, VIGENCIA_FLUJO_MS,
    type AlmacenVenta, type CtxVenta, type FlujoVenta, type PuertoVentasServicios,
    type ServicioEnVenta, type HijoVenta,
} from './whatsapp-venta-servicios.service';
import type { CobroSueltoCreado, CobroSueltoFallido } from './ventas-servicios.service';
import type { LinkWompiConMonto } from './wompi-link-con-monto.service';

// ─── Dobles ──────────────────────────────────────────────────────────────────

const PERFECCIONAMIENTO: ServicioEnVenta = {
    id: 'srv-perf', nombre: 'Clase de perfeccionamiento', descripcion: 'Técnica individual con el profe Andrés.',
    tipo: 'clase_extra', precio: 25000, imagenUrl: 'https://cdn.sportmaps.co/perf.jpg',
    iniciaEn: '2026-10-09T21:00:00Z', terminaEn: '2026-10-09T22:30:00Z', cupos: 12, cuposRestantes: 3, porAtleta: true,
};
const VACACIONAL_A: ServicioEnVenta = {
    id: 'srv-vac-a', nombre: 'Vacacional Voleibol Semana 1', descripcion: null, tipo: 'vacacional', precio: 180000,
    imagenUrl: null, iniciaEn: '2026-10-14T05:00:00Z', terminaEn: '2026-10-18T05:00:00Z', cupos: null, cuposRestantes: null, porAtleta: true,
};
const VACACIONAL_B: ServicioEnVenta = {
    ...VACACIONAL_A, id: 'srv-vac-b', nombre: 'Vacacional Voleibol Semana 2', precio: 170000,
    iniciaEn: '2026-10-21T05:00:00Z', terminaEn: '2026-10-25T05:00:00Z',
};
const TORNEO_FENIX: ServicioEnVenta = {
    id: 'srv-fenix', nombre: 'Torneo Fénix', descripcion: 'Inscripción por deportista.', tipo: 'torneo', precio: 100000,
    imagenUrl: 'https://cdn.sportmaps.co/fenix.jpg', iniciaEn: null, terminaEn: null, cupos: 20, cuposRestantes: 0, porAtleta: true,
};

let catalogo: ServicioEnVenta[] | null;
let hijos: HijoVenta[];
let cobros: { itemId: string; childId: string | null; key: string; minutos?: number; conv?: string | null }[];
let resultadoCobro: (key: string) => CobroSueltoCreado | CobroSueltoFallido;
let conAnular: boolean;
let estado: string | null;
let anulados: string[];
let anularOk: boolean;
let link: LinkWompiConMonto;
let avisoOk: boolean;
let escalados: { motivo: string; antes: string }[];
let enviados: { texto: string; paso: string; botones?: string[]; imagen?: string | null; cta?: string }[];
let prospectos: number;
let claves: number;

let reloj = new Date('2026-10-08T15:00:00Z');
const flujos = new Map<string, FlujoVenta>();
const almacen: AlmacenVenta = {
    async leer(id) { return flujos.get(id) ?? null; },
    async guardar(id, step, data, vigenciaMs) {
        flujos.set(id, { step, data: JSON.parse(JSON.stringify(data)), expires_at: new Date(reloj.getTime() + vigenciaMs).toISOString() });
        return true;
    },
    async borrar(id) { flujos.delete(id); },
};

function puerto(): PuertoVentasServicios {
    return {
        async catalogo() { return catalogo; },
        async crearCobroSuelto(p) {
            cobros.push({ itemId: p.itemId, childId: p.childId, key: p.idempotencyKey, minutos: p.minutosVigencia, conv: p.conversationId });
            return resultadoCobro(p.idempotencyKey);
        },
        ...(conAnular ? { async anularCobroSuelto(p: { paymentId: string }) { anulados.push(p.paymentId); return anularOk; } } : {}),
        async estadoCobro() { return estado; },
    };
}

const COBRO_OK: CobroSueltoCreado = {
    ok: true, paymentId: 'pay-1', idempotente: false, monto: 25000, concepto: 'Clase de perfeccionamiento · 09/10 · Luis Alejandro Parra',
    categoria: 'clase_extra', estado: 'pending', venceEn: '2026-10-08T16:00:00Z', cuposRestantes: 2,
};

function ctx(over: Partial<CtxVenta> = {}): CtxVenta {
    return {
        conversationId: 'conv-1', schoolId: 'sch-dynasty', integrationId: 'int-1', contactWaId: '573001112233',
        parentId: 'parent-1',
        enviar: async (texto, paso, extra) => {
            enviados.push({ texto, paso, botones: extra?.botones?.map((b) => b.title), imagen: extra?.imagen, cta: extra?.cta?.url });
        },
        escalar: async (motivo, antes) => { escalados.push({ motivo, antes }); },
        registrarProspecto: async () => { prospectos++; },
        puerto: puerto(), almacen,
        hijos: async () => hijos,
        crearLink: async () => link,
        registrarAviso: async () => avisoOk,
        paginaCobro: async (id) => `https://app.sportmaps.co/p/tok-${id}`,
        nuevaClave: () => `clave-${++claves}`,
        ahora: () => reloj,
        ...over,
    };
}

/** Un turno de la familia. Devuelve lo que salió del bot en ESE turno. */
async function turno(texto: string, botonId: string | null = null, over: Partial<CtxVenta> = {}, iniciar = true) {
    const antesE = enviados.length;
    const antesX = escalados.length;
    const atendido = await atenderTurnoVenta(ctx(over), texto, botonId, { iniciar });
    return { atendido, salidas: enviados.slice(antesE), escalas: escalados.slice(antesX) };
}

/** Todos los montos ($xx.xxx) de un texto. */
function montos(texto: string): number[] {
    return [...texto.matchAll(/\$([\d.]+)/g)].map((m) => Number(m[1].replace(/\./g, '')));
}

beforeEach(() => {
    catalogo = [PERFECCIONAMIENTO, VACACIONAL_A, VACACIONAL_B, TORNEO_FENIX];
    hijos = [{ id: 'child-luis', nombre: 'Luis Alejandro Parra' }];
    cobros = [];
    resultadoCobro = () => COBRO_OK;
    conAnular = true;
    estado = 'pending';
    anulados = [];
    anularOk = true;
    link = {
        ok: true, url: 'https://checkout.wompi.co/p/?reference=SCH-abc', reference: 'SCH-abc',
        total: 26250, base: 25000, recargo: 1250, venceEn: '2026-10-08T16:00:00Z', minutos: 60, reused: false,
        paginaCobro: 'https://app.sportmaps.co/p/tok',
    };
    avisoOk = true;
    escalados = [];
    enviados = [];
    prospectos = 0;
    claves = 0;
    flujos.clear();
    reloj = new Date('2026-10-08T15:00:00Z');
});

// ─── Lectura del texto ───────────────────────────────────────────────────────

describe('preguntaPorServicio', () => {
    it.each([
        '¿Cuánto vale la clase de perfeccionamiento?',
        'hay vacacionales?',
        'Cómo pago la clase de perfeccionamiento de mañana para Luis',
        'cómo te cancelo la perfeccionamiento',
        'Quiero inscribir a Sofi en el torneo',
        'info del viaje',
    ])('pregunta o quiere: «%s»', (t) => expect(preguntaPorServicio(t)).toBe(true));

    it.each([
        'ya pagué el torneo',
        'te envío el comprobante del viaje',
        'Mi hija no va hoy porque tiene torneo',
        'gracias',
    ])('no es una consulta de venta: «%s»', (t) => expect(preguntaPorServicio(t)).toBe(false));

    it('reconoce el nombre del catálogo sin la palabra del tipo («Fénix?»)', () => {
        expect(preguntaPorServicio('y el Fénix?', ['Torneo Fénix'])).toBe(true);
    });
});

describe('serviciosNombrados', () => {
    it('el nombre distintivo manda sobre el tipo', () => {
        expect(serviciosNombrados('el torneo Fénix cuánto vale', catalogo).map((s) => s.id)).toEqual(['srv-fenix']);
    });
    it('sin nombre, todos los del tipo', () => {
        expect(serviciosNombrados('hay vacacionales?', catalogo).map((s) => s.id)).toEqual(['srv-vac-a', 'srv-vac-b']);
    });
    it('nada del tipo → vacío', () => {
        expect(serviciosNombrados('hay viajes?', catalogo)).toEqual([]);
    });
});

describe('plantillas', () => {
    it('fecha en hora de Colombia', () => {
        expect(cuandoEs(PERFECCIONAMIENTO)).toBe('viernes 9 de octubre, 4:00 p. m.');
        expect(cuandoEs(VACACIONAL_A)).toBe('del 14 al 18 de octubre');
        expect(cuandoEs({ iniciaEn: null, terminaEn: null })).toBeNull();
    });
    it('ficha con valor y cupos de la base', () => {
        const f = textoFicha(PERFECCIONAMIENTO);
        expect(f).toContain('*Clase de perfeccionamiento*');
        expect(f).toContain('Valor: *$25.000* · quedan 3 cupos');
        expect(textoFicha(TORNEO_FENIX)).toContain('Ya no quedan cupos.');
    });
    it('resumen fijo «Así quedaría … Total … ¿Procedemos?»', () => {
        const r = textoResumen(PERFECCIONAMIENTO, 'Luis Alejandro Parra');
        expect(r).toMatch(/^Así quedaría:\n• Clase de perfeccionamiento \(viernes 9 de octubre, 4:00 p\. m\.\)\n• Para: Luis Alejandro Parra\nTotal: \*\$25\.000\*\n¿Procedemos\?$/);
    });
    it('sí / ya no', () => {
        expect(esSi('Sí, procedemos')).toBe(true);
        expect(esSi('dale')).toBe(true);
        expect(desiste('ya no')).toBe(true);
        expect(desiste('cancela')).toBe(true);
        // En Colombia «te cancelo» es «te pago».
        expect(desiste('cómo te cancelo la perfeccionamiento')).toBe(false);
    });
});

// ─── F1: consulta ────────────────────────────────────────────────────────────

describe('F1 — la familia pregunta por un servicio', () => {
    it('§5.3: un hijo → ficha con foto + resumen + [Sí, procedemos][No] en UN mensaje', async () => {
        const r = await turno('Cómo pago la clase de perfeccionamiento de mañana para Luis');
        expect(r.atendido).toBe(true);
        expect(r.salidas).toHaveLength(1);
        const m = r.salidas[0];
        expect(m.paso).toBe('venta_confirmar');
        expect(m.imagen).toBe('https://cdn.sportmaps.co/perf.jpg');
        expect(m.botones).toEqual(['Sí, procedemos', 'No']);
        expect(m.texto).toContain('Para: Luis Alejandro Parra');
        expect(m.texto).toContain('quedan 3 cupos');
        expect(new Set(montos(m.texto))).toEqual(new Set([25000]));
        expect(cobros).toHaveLength(0);   // consultar no crea nada
        expect(flujos.get('conv-1')?.step).toBe('venta_confirmar');
    });

    it('varios hijos: pregunta para quién y después el resumen', async () => {
        hijos = [{ id: 'child-sofia', nombre: 'Sofía Ramírez' }, { id: 'child-sara', nombre: 'Sara Ramírez' }];
        const a = await turno('¿Cuánto vale la clase de perfeccionamiento?');
        expect(a.salidas).toHaveLength(1);
        expect(a.salidas[0].paso).toBe('venta_elegir_atleta');
        expect(a.salidas[0].botones).toEqual(['Sofía', 'Sara']);

        const b = await turno('Sara', BOTON_VENTA.HIJO + '1');
        expect(b.salidas).toHaveLength(1);
        expect(b.salidas[0].paso).toBe('venta_confirmar');
        expect(b.salidas[0].texto).toContain('Para: Sara Ramírez');
        expect(flujos.get('conv-1')?.data.child_id).toBe('child-sara');
    });

    it('el hijo nombrado en el texto se toma sin preguntar', async () => {
        hijos = [{ id: 'child-sofia', nombre: 'Sofía Ramírez' }, { id: 'child-sara', nombre: 'Sara Ramírez' }];
        const r = await turno('quiero la clase de perfeccionamiento para Sofía');
        expect(r.salidas[0].paso).toBe('venta_confirmar');
        expect(r.salidas[0].texto).toContain('Para: Sofía Ramírez');
    });

    it('«hay vacacionales?» con dos → lista; «2» → ficha del segundo', async () => {
        const a = await turno('hay vacacionales?');
        expect(a.salidas).toHaveLength(1);
        expect(a.salidas[0].paso).toBe('venta_elegir_item');
        expect(a.salidas[0].texto).toContain('1. *Vacacional Voleibol Semana 1* — del 14 al 18 de octubre — $180.000');
        expect(a.salidas[0].texto).toContain('2. *Vacacional Voleibol Semana 2* — del 21 al 25 de octubre — $170.000');

        const b = await turno('2');
        expect(b.salidas).toHaveLength(1);
        expect(b.salidas[0].paso).toBe('venta_confirmar');
        expect(b.salidas[0].texto).toContain('Total: *$170.000*');
    });

    it('cupos agotados: ficha «Ya no quedan cupos», sin botones ni flujo', async () => {
        const r = await turno('el torneo Fénix cuánto vale?');
        expect(r.salidas).toHaveLength(1);
        expect(r.salidas[0].paso).toBe('venta_sin_cupos');
        expect(r.salidas[0].texto).toContain('Ya no quedan cupos.');
        expect(r.salidas[0].botones).toBeUndefined();
        expect(flujos.has('conv-1')).toBe(false);
    });

    it('tipo que la escuela no tiene → «no lo tengo» a la escuela, sin precio', async () => {
        const r = await turno('hay viajes este año?');
        expect(r.salidas).toHaveLength(0);
        expect(r.escalas).toHaveLength(1);
        expect(r.escalas[0].antes).toContain('no tengo viajes');
        expect(montos(r.escalas[0].antes)).toEqual([]);
    });

    it('«ya pagué el torneo» no es para la venta', async () => {
        expect((await turno('ya pagué el torneo')).atendido).toBe(false);
        expect((await turno('Te envío el comprobante del vacacional')).atendido).toBe(false);
    });

    it('ventas apagadas o migración pendiente (catálogo null): el bot sigue como hoy', async () => {
        catalogo = null;
        const r = await turno('¿Cuánto vale la clase de perfeccionamiento?');
        expect(r.atendido).toBe(false);
        expect(r.salidas).toHaveLength(0);
        expect(r.escalas).toHaveLength(0);
    });

    it('sin iniciar (gancho 2.33) no arranca una venta', async () => {
        const r = await turno('¿Cuánto vale la clase de perfeccionamiento?', null, {}, false);
        expect(r.atendido).toBe(false);
        expect(r.salidas).toHaveLength(0);
    });

    it('desconocido: ficha con precio, queda como prospecto, nunca cobro ni botones', async () => {
        const r = await turno('¿Cuánto vale la clase de perfeccionamiento?', null, { parentId: null });
        expect(r.salidas).toHaveLength(1);
        expect(r.salidas[0].paso).toBe('venta_consulta_desconocido');
        expect(r.salidas[0].texto).toContain('$25.000');
        expect(r.salidas[0].botones).toBeUndefined();
        expect(prospectos).toBe(1);
        expect(cobros).toHaveLength(0);
        expect(flujos.has('conv-1')).toBe(false);
        // Ni un «Sí» lo convierte en compra.
        expect((await turno('Sí', BOTON_VENTA.SI, { parentId: null }, false)).salidas.every((s) => !s.cta)).toBe(true);
        expect(cobros).toHaveLength(0);
    });
});

// ─── F2: pedido y pago ───────────────────────────────────────────────────────

describe('F2 — confirmar, link y desenlace', () => {
    async function hastaConfirmar() {
        await turno('Cómo pago la clase de perfeccionamiento de mañana para Luis');
        expect(flujos.get('conv-1')?.step).toBe('venta_confirmar');
    }

    it('«Sí, procedemos» → cobro + link con monto + aviso → UN mensaje con «1 hora» y «te aviso»', async () => {
        await hastaConfirmar();
        const r = await turno('Sí, procedemos', BOTON_VENTA.SI);
        expect(r.salidas).toHaveLength(1);
        const m = r.salidas[0];
        expect(m.paso).toBe('venta_link_enviado');
        expect(m.cta).toBe(link.ok && link.url);
        expect(m.texto).toContain('Aquí está tu link de pago por *$26.250*');
        expect(m.texto).toContain('Tienes 1 hora para pagar; cuando se apruebe te aviso por aquí.');
        // El total que dice el bot es el del link (con el recargo), no el de lista.
        expect(montos(m.texto)).toEqual([26250, 1250]);
        expect(cobros).toEqual([{ itemId: 'srv-perf', childId: 'child-luis', key: 'clave-1', minutos: 60, conv: 'conv-1' }]);
        const f = flujos.get('conv-1')!;
        expect(f.step).toBe('venta_esperando_pago');
        expect(f.data.payment_id).toBe('pay-1');
    });

    it('sin aviso registrado no promete «te aviso por aquí»', async () => {
        avisoOk = false;
        await hastaConfirmar();
        const r = await turno('si');
        expect(r.salidas[0].texto).toContain('Tienes 1 hora para pagar.');
        expect(r.salidas[0].texto).not.toContain('te aviso');
    });

    it('doble toque del botón: el MISMO cobro (misma clave)', async () => {
        await hastaConfirmar();
        await turno('Sí, procedemos', BOTON_VENTA.SI);
        const r = await turno('Sí, procedemos', BOTON_VENTA.SI);
        expect(r.salidas).toHaveLength(1);
        expect(cobros.map((c) => c.key)).toEqual(['clave-1', 'clave-1']);
    });

    it('sin pago en línea: la página del cobro /p/:token, sin prometer la hora', async () => {
        link = { ok: false, code: 'sin_pago_en_linea', error: '' };
        await hastaConfirmar();
        const r = await turno('Sí, procedemos', BOTON_VENTA.SI);
        expect(r.salidas).toHaveLength(1);
        expect(r.salidas[0].texto).toContain('https://app.sportmaps.co/p/tok-pay-1');
        expect(r.salidas[0].texto).toContain('*$25.000*');
        expect(r.salidas[0].texto).not.toContain('1 hora');
    });

    it('«No» en el resumen: no se crea nada', async () => {
        await hastaConfirmar();
        const r = await turno('No', BOTON_VENTA.NO);
        expect(r.salidas).toHaveLength(1);
        expect(r.salidas[0].paso).toBe('venta_cancelada');
        expect(cobros).toHaveLength(0);
        expect(flujos.has('conv-1')).toBe(false);
    });

    it('se acabaron los cupos al confirmar: lo dice y no queda cobro', async () => {
        resultadoCobro = () => ({ ok: false, code: 'sin_cupos', error: '' });
        await hastaConfirmar();
        const r = await turno('dale');
        expect(r.salidas).toHaveLength(1);
        expect(r.salidas[0].texto).toContain('se acabaron los cupos');
        expect(flujos.has('conv-1')).toBe(false);
    });

    it('otro error del cobro → a la escuela, «no se cobró nada»', async () => {
        resultadoCobro = () => ({ ok: false, code: 'familia_no_valida', error: '' });
        await hastaConfirmar();
        const r = await turno('Sí, procedemos', BOTON_VENTA.SI);
        expect(r.salidas).toHaveLength(0);
        expect(r.escalas).toHaveLength(1);
        expect(r.escalas[0].antes).toContain('No se cobró nada');
    });

    it('«ya no» esperando el pago → anula el cobro', async () => {
        await hastaConfirmar();
        await turno('Sí, procedemos', BOTON_VENTA.SI);
        const r = await turno('ya no');
        expect(r.salidas).toHaveLength(1);
        expect(anulados).toEqual(['pay-1']);
        expect(r.salidas[0].texto).toContain('anulé el cobro');
        expect(flujos.has('conv-1')).toBe(false);
    });

    it('«ya no» pero ya está pagado: a la escuela, sin anular', async () => {
        await hastaConfirmar();
        await turno('Sí, procedemos', BOTON_VENTA.SI);
        estado = 'paid';
        const r = await turno('ya no la quiero');
        expect(anulados).toEqual([]);
        expect(r.escalas).toHaveLength(1);
    });

    it('vencido y anulado por F0 → «retomar» vuelve a cotizar con clave nueva', async () => {
        await hastaConfirmar();
        await turno('Sí, procedemos', BOTON_VENTA.SI);
        estado = 'cancelled';
        catalogo = [{ ...PERFECCIONAMIENTO, precio: 30000, cuposRestantes: 1 }];
        const r = await turno('retomar');
        expect(r.salidas).toHaveLength(1);
        expect(r.salidas[0].paso).toBe('venta_confirmar');
        expect(r.salidas[0].texto).toContain('Total: *$30.000*');
        expect(flujos.get('conv-1')?.data.idempotency_key).toBe('clave-2');
        expect(flujos.get('conv-1')?.data.child_id).toBe('child-luis');
    });

    it('«retomar» con el cobro aún pendiente: el mismo cobro, link de nuevo', async () => {
        await hastaConfirmar();
        await turno('Sí, procedemos', BOTON_VENTA.SI);
        const r = await turno('mándame el link otra vez, retomar');
        expect(r.salidas).toHaveLength(1);
        expect(r.salidas[0].paso).toBe('venta_link_enviado');
        expect(cobros.map((c) => c.key)).toEqual(['clave-1', 'clave-1']);
    });

    it('ya_inscrito: reenvía el link del cobro que ya existía, sin crear otro', async () => {
        resultadoCobro = () => ({ ok: false, code: 'ya_inscrito', error: '', paymentId: 'pay-viejo' });
        await hastaConfirmar();
        const r = await turno('Sí, procedemos', BOTON_VENTA.SI);
        expect(r.salidas).toHaveLength(1);
        expect(r.salidas[0].texto).toMatch(/^Ya tenías un cobro pendiente de \*Clase de perfeccionamiento\* para Luis Alejandro Parra\./);
        expect(flujos.get('conv-1')?.data.payment_id).toBe('pay-viejo');
    });

    it('ya_inscrito y pagado: «ya está aprobado», sin link', async () => {
        resultadoCobro = () => ({ ok: false, code: 'ya_inscrito', error: '', paymentId: 'pay-viejo' });
        estado = 'paid';
        await hastaConfirmar();
        const r = await turno('Sí, procedemos', BOTON_VENTA.SI);
        expect(r.salidas[0].paso).toBe('venta_ya_pagada');
        expect(r.salidas[0].cta).toBeUndefined();
    });

    it('clave repetida de un cobro ya vencido: vuelve a cotizar en vez de mandar un link muerto', async () => {
        await hastaConfirmar();
        resultadoCobro = () => ({ ...COBRO_OK, idempotente: true, estado: 'cancelled' });
        const r = await turno('Sí, procedemos', BOTON_VENTA.SI);
        expect(r.salidas).toHaveLength(1);
        expect(r.salidas[0].paso).toBe('venta_confirmar');
        expect(flujos.get('conv-1')?.data.idempotency_key).toBe('clave-2');
    });

    it('item vencido al confirmar: «ya no está disponible», sin escalar', async () => {
        resultadoCobro = () => ({ ok: false, code: 'item_vencido', error: '' });
        await hastaConfirmar();
        const r = await turno('si');
        expect(r.salidas[0].paso).toBe('venta_no_disponible');
        expect(r.escalas).toHaveLength(0);
    });

    it('sin anulación inmediata en F0: «no lo pagues», el job lo anula al vencer', async () => {
        conAnular = false;
        await hastaConfirmar();
        await turno('Sí, procedemos', BOTON_VENTA.SI);
        const r = await turno('ya no');
        expect(r.salidas).toHaveLength(1);
        expect(r.salidas[0].texto).toContain('no lo pagues');
        expect(anulados).toEqual([]);
        expect(flujos.has('conv-1')).toBe(false);
    });

    it('esperando el pago, otra pregunta la atiende el bot y el flujo queda (para el comprobante)', async () => {
        await hastaConfirmar();
        await turno('Sí, procedemos', BOTON_VENTA.SI);
        const r = await turno('cuánto debo de mensualidad', null, {}, false);
        expect(r.atendido).toBe(false);
        expect(flujos.get('conv-1')?.step).toBe('venta_esperando_pago');
    });

    it('el flujo vence a las 2 h sin confirmar', async () => {
        await hastaConfirmar();
        reloj = new Date(reloj.getTime() + VIGENCIA_FLUJO_MS + 1000);
        const r = await turno('si', null, {}, false);
        expect(r.atendido).toBe(false);
        expect(cobros).toHaveLength(0);
    });

    it('nunca usa voseo ni «che»', async () => {
        hijos = [{ id: 'a', nombre: 'Sofía Ramírez' }, { id: 'b', nombre: 'Sara Ramírez' }];
        await turno('¿Cuánto vale la clase de perfeccionamiento?');
        await turno('Sara', BOTON_VENTA.HIJO + '1');
        await turno('Sí, procedemos', BOTON_VENTA.SI);
        await turno('ya no');
        await turno('el torneo Fénix cuánto vale?');
        const todo = [...enviados.map((e) => e.texto), ...escalados.map((e) => e.antes)].join('\n');
        expect(todo).not.toMatch(/\b(vos|querés|tenés|podés|sabés|escribí|mandá|che)\b/i);
    });
});

// ─── Comprobante con una venta abierta ──────────────────────────────────────

describe('decidirComprobanteDeVenta', () => {
    const mensualidad = { id: 'pay-mens', amount: 180000 };
    const clase = { id: 'pay-1', amount: 25000 };

    it('sin venta abierta: flujo normal', () => {
        expect(decidirComprobanteDeVenta(null, [mensualidad])).toEqual({ tipo: 'seguir' });
    });
    it('el cobro de la venta está pendiente → se aplica a ESE, no a la mensualidad', () => {
        const d = decidirComprobanteDeVenta({ paymentId: 'pay-1', nombre: 'Clase de perfeccionamiento' }, [mensualidad, clase]);
        expect(d).toEqual({ tipo: 'aplicar', pago: clase });
    });
    it('ya no está pendiente → a la escuela, nunca a la mensualidad', () => {
        const d = decidirComprobanteDeVenta({ paymentId: 'pay-1', nombre: 'Clase de perfeccionamiento' }, [mensualidad]);
        expect(d.tipo).toBe('a_la_escuela');
        if (d.tipo === 'a_la_escuela') {
            expect(d.motivo).toMatch(/^otro_concepto: venta por WhatsApp/);
            expect(d.mensaje).toContain('no lo apliqué a la mensualidad');
        }
    });
});
