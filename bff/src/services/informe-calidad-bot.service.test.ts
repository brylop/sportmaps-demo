/**
 * Informe semanal de calidad y costo del bot (services/informe-calidad-bot).
 *
 * Lo que se vigila:
 *   · desenlace de cada conversación de familia: solo bot / escuela (una persona
 *     respondió, escalara o no el bot) / sin respuesta (incluida la escalada
 *     que nadie contestó); las que no son de familia no entran al %;
 *   · escalaciones y minutos hasta la respuesta humana (también en modo
 *     asistido, donde la escalación es un borrador);
 *   · errores: envío fallido, fallas del modelo por proveedor, respaldo,
 *     fugas bloqueadas por el filtro de salida, respuestas repetidas;
 *   · comprobantes, cortesías, opt-ins;
 *   · costo por modelo, por función y por conversación desde llm_usage;
 *   · el correo: kill-switch, destino BOT_REPORT_EMAIL, una vez por semana y
 *     SIN contenido de conversaciones.
 *
 * Datos inventados. Cero red: Supabase y correo moqueados.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
    reservas: new Set<string>(),
    enviados: [] as any[],
    tablas: {} as Record<string, any[]>,
    cuentas: {} as Record<string, number>,
}));

/** Cliente falso: cada `from(tabla)` devuelve las filas de `estado.tablas[tabla]` (sin filtrar). */
vi.mock('../config/supabase', () => {
    const builder = (tabla: string) => {
        let head = false;
        const b: any = {
            select: (_c: string, o?: { head?: boolean }) => { head = !!o?.head; return b; },
            eq: () => b, neq: () => b, gte: () => b, lt: () => b, lte: () => b, in: () => b, is: () => b,
            not: () => b, order: () => b, limit: () => b, range: () => b,
            then: (res: any, rej: any) => Promise.resolve(head
                ? { count: estado.cuentas[tabla] ?? 0, error: null }
                : { data: estado.tablas[tabla] ?? [], error: null }).then(res, rej),
        };
        return b;
    };
    return { supabase: { from: (t: string) => builder(t) } };
});

vi.mock('./avisos-correo.service', async (orig) => {
    const real = await orig<typeof import('./avisos-correo.service')>();
    return {
        ...real,
        enviarConReserva: vi.fn(async (p: any) => {
            if (estado.reservas.has(p.clave)) return 'duplicado';
            estado.reservas.add(p.clave);
            estado.enviados.push(p);
            return 'enviado';
        }),
    };
});

import {
    calcularInformeEscuela, contarRepetidas, destinosInformeBot, lineasInforme, resumirCostos,
    runInformeCalidadBotSemanal, semanaAnterior, type DatosEscuela, type MensajeInforme,
} from './informe-calidad-bot.service';

const T0 = Date.parse('2026-10-05T14:00:00Z'); // lunes 9:00 COT
const iso = (min: number) => new Date(T0 + min * 60_000).toISOString();
let seq = 0;
const msg = (conv: string, min: number, m: Partial<MensajeInforme>): MensajeInforme => ({
    id: `m${++seq}`, conversation_id: conv, direction: 'outbound', wa_timestamp: iso(min), ...m,
} as MensajeInforme);
const entra = (conv: string, min: number) => msg(conv, min, { direction: 'inbound', ai_generated: false });
const bot = (conv: string, min: number, extra: Partial<MensajeInforme> = {}) =>
    msg(conv, min, { ai_generated: true, text_body: 'Respuesta del asistente número ' + seq, ...extra });
const persona = (conv: string, min: number) => msg(conv, min, { ai_generated: false, manual: true });

function datosBase(): DatosEscuela {
    return {
        schoolId: 'esc-1',
        nombre: 'Club Prueba',
        mensajes: [
            // A: solo bot
            entra('A', 0), bot('A', 1),
            // B: bot escala y una persona responde a los 30 min
            entra('B', 0), bot('B', 1, { step: 'escalated' }), persona('B', 30),
            // C: bot escala y nadie responde
            entra('C', 0), bot('C', 1, { step: 'escalated' }),
            // D: responde una persona sin bot
            entra('D', 0), persona('D', 10),
            // E: nadie dice nada
            entra('E', 0),
            // F: staff (no familia): no entra al %
            entra('F', 0), bot('F', 1),
            // Errores
            bot('A', 100, { status: 'failed', error_detail: '(#131047) Re-engagement message to +573001112233' }),
            bot('A', 101, { llm_fallas: [{ proveedor: 'claude', error: 'x' }, { proveedor: 'gemini', error: 'y' }] }),
            bot('A', 102, { salida_filtrada: ['llamado_a_herramienta'] }),
            bot('A', 103, { via: 'llm_error', step: 'payment_fallback' }),
            bot('A', 200, { text_body: 'Escríbeme tu correo para buscarte', step: 'pedir_documento' }),
            bot('A', 210, { text_body: 'Escríbeme tu correo para buscarte', step: 'pedir_documento' }),
        ],
        echos: [],
        borradores: [
            // G: modo asistido, la escalación quedó como borrador; nadie respondió
            { id: 'd1', conversation_id: 'G', created_at: iso(2), step: 'escalated', salida_filtrada: ['json'] },
        ],
        kinds: new Map([['A', 'familia'], ['B', 'familia'], ['C', 'familia_sin_cuenta'], ['D', 'familia'], ['E', 'ambiguo'], ['F', 'staff'], ['G', 'familia']]),
        cola: [
            { status: 'done', result_type: 'payment_receipt', result_ref_id: 'p1' },
            { status: 'done', result_type: 'payment_receipt', result_ref_id: 'p2' },
            { status: 'ignored', result_type: 'escalated' },
            { status: 'failed' },
            { status: 'done', result_type: 'enrollment_form_intake' },
        ],
        pagos: new Map([['p1', { status: 'paid', approved_by: null }], ['p2', { status: 'paid', approved_by: 'u1' }]]),
        optinsNuevos: 3,
        cortesiasReservadas: 2,
        uso: [
            { school_id: 'esc-1', conversation_id: 'A', feature: 'bot', provider: 'claude', model: 'claude-sonnet-5-5', input_tokens: 1_000_000, output_tokens: 0 },
            { school_id: 'esc-1', conversation_id: 'B', feature: 'bot', provider: 'claude', model: 'claude-sonnet-5-5', output_tokens: 100_000 },
            { school_id: 'esc-1', conversation_id: null, feature: 'ocr', provider: 'gemini', model: 'gemini-flash-latest', input_tokens: 1_000_000 },
        ],
    };
}

describe('calcularInformeEscuela', () => {
    const d = datosBase();
    d.mensajes.push(entra('G', 0)); // G necesita un entrante para ser conversación activa
    const inf = calcularInformeEscuela(d);

    it('mensajes entrantes y salientes por tipo', () => {
        expect(inf.mensajes.entrantes).toBe(7);
        expect(inf.mensajes.humano).toBe(2);
        expect(inf.mensajes.bot).toBe(10);
        expect(inf.mensajes.salientes).toBe(12);
    });

    it('familias: bot / escuela / sin respuesta (el staff no cuenta)', () => {
        expect(inf.conversaciones).toEqual({ activas: 7, familias: 6 });
        expect(inf.familias).toMatchObject({ soloBot: 1, escuela: 2, sinRespuesta: 3 });
        expect(inf.familias.pctBot).toBeCloseTo(16.7);
        expect(inf.familias.pctEscuela).toBeCloseTo(33.3);
        expect(inf.familias.pctSinRespuesta).toBe(50);
    });

    it('escalaciones (incluida la del borrador) y minutos hasta la persona', () => {
        expect(inf.escalaciones).toMatchObject({ conversaciones: 3, respondidasPorPersona: 1, sinRespuestaHumana: 2, medianaMin: 30 });
    });

    it('errores: fallido, fallas del modelo, respaldo, fugas y repetidas', () => {
        expect(inf.errores.enviosFallidos).toBe(1);
        expect(inf.errores.motivosEnvio[0].motivo).not.toMatch(/3001112233/); // sin teléfonos
        expect(inf.errores.turnosConFallaLlm).toBe(1);
        expect(inf.errores.fallasPorProveedor).toEqual(expect.arrayContaining([{ proveedor: 'claude', n: 1 }, { proveedor: 'gemini', n: 1 }]));
        expect(inf.errores.respaldoPorFallaLlm).toBe(1);
        expect(inf.errores.fugasBloqueadas).toBe(2);
        expect(inf.errores.motivosFuga.map((m) => m.motivo)).toEqual(expect.arrayContaining(['llamado_a_herramienta', 'json']));
        expect(inf.errores.respuestasRepetidas).toBe(1);
        expect(inf.errores.repetidasPorPaso).toEqual([{ motivo: 'pedir_documento', n: 1 }]);
    });

    it('comprobantes (la matrícula no es comprobante), cortesías y opt-ins', () => {
        expect(inf.comprobantes).toMatchObject({ recibidos: 4, aplicadosSolos: 1, aprobadosPorEscuela: 1, escalados: 1, fallidos: 1 });
        expect(inf.cortesiasReservadas).toBe(2);
        expect(inf.optinsNuevos).toBe(3);
    });

    it('costo por modelo, por función y por conversación', () => {
        // Sonnet: 1M entrada = $2 (A) + 100k salida = $1 (B); Gemini 1M = $0,30 (sin conversación)
        expect(inf.costo.usd).toBeCloseTo(3.3);
        expect(inf.costo.porModelo[0]).toMatchObject({ clave: 'claude · claude-sonnet-5-5', llamadas: 2 });
        expect(inf.costo.porFuncion.map((g) => g.clave)).toEqual(['bot', 'ocr']);
        expect(inf.costo.conversacionesConCosto).toBe(2);
        expect(inf.costo.usdPromedioPorConversacion).toBeCloseTo(1.5);
        expect(inf.costo.usdMaxConversacion).toBeCloseTo(2);
        expect(inf.costo.porModelo.find((g) => g.clave.includes('gemini'))?.precioPorConfirmar).toBe(true);
    });
});

describe('contarRepetidas', () => {
    it('solo dentro de 24 h, misma conversación, textos no triviales', () => {
        const t = (h: number) => T0 + h * 3600_000;
        const r = contarRepetidas([
            { conversation_id: 'x', texto: 'Tu pago quedó registrado, gracias', t: t(0) },
            { conversation_id: 'x', texto: 'Tu  PAGO quedó registrado, gracias', t: t(1) },
            { conversation_id: 'y', texto: 'Tu pago quedó registrado, gracias', t: t(2) },
            { conversation_id: 'x', texto: 'Tu pago quedó registrado, gracias', t: t(30) },
            { conversation_id: 'x', texto: 'Listo', t: t(31) },
            { conversation_id: 'x', texto: 'Listo', t: t(32) },
        ]);
        expect(r.total).toBe(1);
    });
});

describe('resumirCostos', () => {
    it('un modelo sin precio queda contado aparte', () => {
        const r = resumirCostos([{ provider: 'x', feature: 'bot', model: 'desconocido', input_tokens: 10 }]);
        expect(r.sinPrecio).toBe(1);
        expect(r.usd).toBe(0);
    });
});

describe('envío semanal', () => {
    const LUNES_8AM = Date.parse('2026-10-12T13:00:00Z');

    beforeEach(() => {
        estado.reservas.clear();
        estado.enviados = [];
        delete process.env.DISABLE_INFORME_CALIDAD_BOT;
        delete process.env.BOT_REPORT_EMAIL;
        estado.tablas = {
            school_whatsapp_integrations: [{ id: 'i1', school_id: 'esc-1' }],
            schools: [{ id: 'esc-1', name: 'Club Prueba' }],
            whatsapp_messages: [
                { id: 'a', conversation_id: 'A', direction: 'inbound', ai_generated: false, wa_timestamp: '2026-10-06T15:00:00Z', text_body: 'TEXTO-PRIVADO-DE-LA-FAMILIA' },
                { id: 'b', conversation_id: 'A', direction: 'outbound', ai_generated: true, wa_timestamp: '2026-10-06T15:01:00Z', text_body: 'RESPUESTA-PRIVADA-DEL-BOT' },
            ],
            whatsapp_message_drafts: [],
            whatsapp_conversations: [{ id: 'A', contact_kind: 'familia' }],
            whatsapp_inbound_queue: [],
            llm_usage: [{ school_id: 'esc-1', conversation_id: 'A', feature: 'bot', provider: 'claude', model: 'claude-sonnet-5-5', input_tokens: 5000, output_tokens: 300, created_at: '2026-10-06T15:01:00Z' }],
        };
        estado.cuentas = { whatsapp_optins: 1, school_signup_leads: 0 };
    });

    it('la semana es de lunes a lunes en hora Colombia', () => {
        const s = semanaAnterior(LUNES_8AM);
        expect(new Date(s.inicio).toISOString()).toBe('2026-10-05T05:00:00.000Z');
        expect(new Date(s.fin).toISOString()).toBe('2026-10-12T05:00:00.000Z');
        expect(s.lunes).toBe('2026-10-12');
    });

    it('sale una vez por semana a BOT_REPORT_EMAIL, sin contenido de conversaciones', async () => {
        process.env.BOT_REPORT_EMAIL = 'Bots@sportmaps.co, otro@sportmaps.co';
        expect(await runInformeCalidadBotSemanal(LUNES_8AM)).toBe('enviado');
        expect(await runInformeCalidadBotSemanal(LUNES_8AM + 3600_000)).toBe('duplicado');
        expect(estado.enviados).toHaveLength(1);
        const p = estado.enviados[0];
        expect(p.clave).toBe('informe_calidad_bot:2026-10-12');
        expect(p.destinos).toEqual(['bots@sportmaps.co', 'otro@sportmaps.co']);
        expect(p.plantilla).toBeNull();
        const todo = JSON.stringify(p);
        expect(todo).not.toContain('TEXTO-PRIVADO');
        expect(todo).not.toContain('RESPUESTA-PRIVADA');
        expect(p.respaldo.html).toContain('Club Prueba');
        expect(p.respaldo.lineas.join('\n')).toMatch(/Opt-ins nuevos: 1/);
    });

    it('sin BOT_REPORT_EMAIL usa SUPPORT_ALERT_EMAIL', () => {
        process.env.SUPPORT_ALERT_EMAIL = 'soporte@sportmaps.co';
        expect(destinosInformeBot()).toEqual(['soporte@sportmaps.co']);
        delete process.env.SUPPORT_ALERT_EMAIL;
    });

    it('kill-switch DISABLE_INFORME_CALIDAD_BOT', async () => {
        process.env.DISABLE_INFORME_CALIDAD_BOT = 'true';
        expect(await runInformeCalidadBotSemanal(LUNES_8AM)).toBe('apagado');
        expect(estado.enviados).toHaveLength(0);
    });

    it('avisa cuando los costos empiezan a mitad del rango', async () => {
        const { armarInformeCalidadBot } = await import('./informe-calidad-bot.service');
        const inf = await armarInformeCalidadBot({ desde: Date.parse('2026-10-01T05:00:00Z'), hasta: Date.parse('2026-10-08T05:00:00Z') });
        expect(inf.usoDesde).toBe('2026-10-06T15:01:00Z');
        expect(lineasInforme(inf).join('\n')).toMatch(/Costos solo desde 2026-10-06/);
    });
});
