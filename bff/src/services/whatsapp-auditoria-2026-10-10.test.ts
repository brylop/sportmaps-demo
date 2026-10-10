/**
 * Auditoría del bot de WhatsApp, últimas 48 h de Dynasty (2026-10-10).
 * Supabase mockeado con un builder encadenable; datos inventados, sin nombres
 * ni teléfonos reales.
 *
 *  1. «¿A cuál cobro va?» seguía saliendo después de que la escuela escribió.
 *  2. Elegir un cobro de la pregunta estampaba montos que no cuadran; el
 *     recargo en línea cuenta como cuadre, y el link de pago lo nombra.
 *  3. El botón del consentimiento solo al número del pagador.
 *  6. Nada de emojis de deporte ni de «otro sistema procesa las imágenes».
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
    filaEsperando: null as any,
    conv: null as any,
    salientes: [] as any[],
    settings: null as any,
    updates: [] as { table: string; v: any }[],
}));

vi.mock('../config/supabase', () => {
    const builder = (table: string) => {
        const b: any = {};
        for (const m of ['select', 'eq', 'in', 'order', 'limit', 'neq', 'is', 'not', 'gte', 'lte', 'lt', 'or']) {
            b[m] = () => b;
        }
        b.update = (v: any) => { h.updates.push({ table, v }); return b; };
        b.maybeSingle = () => Promise.resolve(
            table === 'whatsapp_inbound_queue' ? { data: h.filaEsperando, error: null }
                : table === 'whatsapp_conversations' ? { data: h.conv, error: null }
                    : table === 'school_settings' ? { data: h.settings, error: null }
                        : { data: null, error: null });
        b.then = (res: any, rej: any) => Promise.resolve(
            table === 'whatsapp_messages' ? { data: h.salientes, error: null } : { data: [], error: null },
        ).then(res, rej);
        return b;
    };
    return { supabase: { from: (t: string) => builder(t), rpc: () => Promise.resolve({ data: null, error: null }) } };
});
vi.mock('./cobro-enlace-publico.service', () => ({ emitirTokenCobro: vi.fn(async () => null) }));
const aplicarComprobanteMock = vi.fn(async (..._a: any[]) => undefined);
vi.mock('../jobs/whatsapp-queue.job', () => ({ aplicarComprobante: (...a: any[]) => aplicarComprobanteMock(...a) }));

import {
    resolverRespuestaDeCobro, escuelaEscribioDespues, montoLeido, esPagoEnLinea, montoCuadraConElCobro,
    textoMontoNoCuadra, MOTIVO_ESCUELA_TOMO, PASO_MONTO_NO_CUADRA,
} from './whatsapp-respuesta-de-cobro.service';
import { instruccionesDelLinkConMonto, lineaPagar } from './whatsapp-enlaces-de-pago.service';
import { filtrarSalidaDelModelo, sinEmojisDeDeporte } from './whatsapp-salida-segura';
import { textoSemanaDeCortesia } from './whatsapp-cortesia-semana.service';
import type { PagoPendiente } from './whatsapp-receipt-matching.service';
import type { FilaReciente } from './whatsapp-reglas-turno';

const SEP: PagoPendiente = { id: 'p-sep', amount: 180000, concept: 'Mensualidad 09/2026', due_date: '2026-09-10' } as any;
const OCT: PagoPendiente = { id: 'p-oct', amount: 180000, concept: 'Mensualidad 10/2026', due_date: '2026-10-10' } as any;

const PREGUNTA_AT = new Date(Date.now() - 30 * 60_000).toISOString();
const despues = (min: number) => new Date(Date.parse(PREGUNTA_AT) + min * 60_000).toISOString();

const fila = (amount: number | null, ocrExtra: Record<string, unknown> = {}) => ({
    id: 'q1', school_id: 'school-1', retries: 0, pregunta_at: PREGUNTA_AT,
    pregunta_opciones: [SEP, OCT],
    pregunta_ocr: { ocr: { amount, bank: 'Nequi', ...ocrExtra }, sha: 'x', storagePath: 'p', parentId: 'parent-1' },
});

beforeEach(() => {
    h.filaEsperando = null;
    h.conv = { id: 'conv-1' };
    h.salientes = [];
    h.settings = { allow_installments: false, online_fee_pct: 3 };
    h.updates = [];
    aplicarComprobanteMock.mockClear();
});

// ─── 1. La escuela tomó la conversación ─────────────────────────────────────

describe('1. escuelaEscribioDespues (pura)', () => {
    const humano = (at: string, extra: Partial<FilaReciente> = {}): FilaReciente =>
        ({ direction: 'outbound', type: 'text', text_body: 'Ya lo reviso', ai_generated: false, created_at: at, ...extra });

    it('texto de una persona de la escuela después de la pregunta → true', () => {
        expect(escuelaEscribioDespues([humano(despues(5))], PREGUNTA_AT)).toBe(true);
    });
    it('antes de la pregunta no cuenta', () => {
        expect(escuelaEscribioDespues([humano(despues(-5))], PREGUNTA_AT)).toBe(false);
    });
    it('el bot, los automáticos de WhatsApp Business y las plantillas de la app no cuentan', () => {
        expect(escuelaEscribioDespues([
            humano(despues(1), { ai_generated: true }),
            humano(despues(2), { payload: { automatico: true } }),
            humano(despues(3), { type: 'template' }),
            { direction: 'inbound', type: 'text', text_body: 'ok', ai_generated: false, created_at: despues(4) },
        ], PREGUNTA_AT)).toBe(false);
    });
    it('sin fecha de pregunta → false', () => {
        expect(escuelaEscribioDespues([humano(despues(5))], null)).toBe(false);
    });
});

describe('1. resolverRespuestaDeCobro con la escuela escribiendo', () => {
    it('persona de la escuela escribió después → se cierra «la escuela tomó la conversación» y no se contesta', async () => {
        h.filaEsperando = fila(180000);
        h.salientes = [{ direction: 'outbound', type: 'text', text_body: 'Hola, ya revisamos', ai_generated: false, created_at: despues(10) }];
        const responder = vi.fn(async (..._a: any[]) => undefined);
        const r = await resolverRespuestaDeCobro({ id: 'int-1' } as any, '570000000000', 'gracias', responder);
        expect(r).toBe(true);
        expect(responder).not.toHaveBeenCalled();
        expect(aplicarComprobanteMock).not.toHaveBeenCalled();
        expect(h.updates.at(-1)).toMatchObject({ table: 'whatsapp_inbound_queue',
            v: { status: 'ignored', error_message: MOTIVO_ESCUELA_TOMO } });
    });

    it('también corta la pregunta «¿de qué deportista?» (número sin ficha)', async () => {
        h.filaEsperando = { ...fila(180000), pregunta_opciones: [],
            pregunta_ocr: { ocr: { amount: 180000 }, sha: 'x', storagePath: 'p', parentId: null, tipo: 'deportista' } };
        h.salientes = [{ direction: 'outbound', type: 'text', text_body: 'Te ayudo yo', ai_generated: false, created_at: despues(2) }];
        const responder = vi.fn(async (..._a: any[]) => undefined);
        expect(await resolverRespuestaDeCobro({ id: 'int-1' } as any, '570000000000', 'Ana', responder)).toBe(true);
        expect(responder).not.toHaveBeenCalled();
        expect(h.updates.at(-1)?.v).toMatchObject({ error_message: MOTIVO_ESCUELA_TOMO });
    });

    it('solo una plantilla automática después → la pregunta sigue viva (se repregunta)', async () => {
        h.filaEsperando = fila(180000);
        h.salientes = [{ direction: 'outbound', type: 'template', text_body: 'Recordatorio', ai_generated: false, created_at: despues(10) }];
        const responder = vi.fn(async (..._a: any[]) => undefined);
        await resolverRespuestaDeCobro({ id: 'int-1' } as any, '570000000000', 'mmm', responder);
        expect(responder).toHaveBeenCalledTimes(1);
        expect(responder.mock.calls[0][1]).toBe('ask_cual_pago_reintento');
    });
});

// ─── 2. El monto contra el cobro elegido ────────────────────────────────────

describe('2. reglas de monto (puras)', () => {
    it('montoLeido', () => {
        expect(montoLeido(150000)).toBe(150000);
        expect(montoLeido('150000')).toBe(150000);
        expect(montoLeido(null)).toBeNull();
        expect(montoLeido(0)).toBeNull();
        expect(montoLeido('abc')).toBeNull();
    });
    it('esPagoEnLinea: Wompi / PSE / Mercado Pago sí; Nequi no', () => {
        expect(esPagoEnLinea({ bank: 'Wompi' })).toBe(true);
        expect(esPagoEnLinea({ bank: 'Bancolombia', description: 'Pago PSE' })).toBe(true);
        expect(esPagoEnLinea({ rawText: 'Pagado con Mercado Pago' })).toBe(true);
        expect(esPagoEnLinea({ bank: 'Nequi', description: 'mensualidad' })).toBe(false);
        expect(esPagoEnLinea(null)).toBe(false);
    });
    it('montoCuadraConElCobro: exacto, o con el recargo SOLO si es en línea', () => {
        expect(montoCuadraConElCobro(180000, OCT, { feePct: 3, enLinea: false })).toBe(true);
        expect(montoCuadraConElCobro(185400, OCT, { feePct: 3, enLinea: true })).toBe(true);
        expect(montoCuadraConElCobro(185400, OCT, { feePct: 3, enLinea: false })).toBe(false);
        expect(montoCuadraConElCobro(150000, OCT, { feePct: 3, enLinea: true })).toBe(false);
        expect(montoCuadraConElCobro(180000, OCT, { feePct: 0, enLinea: true })).toBe(true);
    });
});

describe('2. elegir un cobro de la pregunta: sin abonos no se estampa lo que no cuadra', () => {
    it('$150.000 contra una mensualidad de $180.000 → a la escuela con UNA respuesta, sin estampar', async () => {
        h.filaEsperando = fila(150000);
        const responder = vi.fn(async (..._a: any[]) => undefined);
        const r = await resolverRespuestaDeCobro({ id: 'int-1' } as any, '570000000000', '2', responder);
        expect(r).toBe(true);
        expect(aplicarComprobanteMock).not.toHaveBeenCalled();
        expect(responder).toHaveBeenCalledTimes(1);
        expect(responder.mock.calls[0]).toEqual([textoMontoNoCuadra(150000, OCT), PASO_MONTO_NO_CUADRA]);
        expect(responder.mock.calls[0][0]).toContain('$150.000');
        expect(h.updates.at(-1)?.v).toMatchObject({
            status: 'ignored', result_type: 'escalated', matched_parent_id: 'parent-1',
        });
        expect(String(h.updates.at(-1)?.v.error_message)).toMatch(/^monto_no_cuadra:/);
    });

    it('monto exacto → se aplica como siempre', async () => {
        h.filaEsperando = fila(180000);
        await resolverRespuestaDeCobro({ id: 'int-1' } as any, '570000000000', '2', vi.fn(async () => undefined));
        expect(aplicarComprobanteMock).toHaveBeenCalledTimes(1);
        expect((aplicarComprobanteMock.mock.calls[0] as any[])[1]).toMatchObject({ id: 'p-oct' });
    });

    it('pago en línea con el recargo de la escuela (3 %) → cuadra y se aplica', async () => {
        h.filaEsperando = fila(185400, { bank: 'Wompi' });
        await resolverRespuestaDeCobro({ id: 'int-1' } as any, '570000000000', '2', vi.fn(async () => undefined));
        expect(aplicarComprobanteMock).toHaveBeenCalledTimes(1);
    });

    it('el mismo $185.400 por Nequi (no es en línea) → no cuadra', async () => {
        h.filaEsperando = fila(185400, { bank: 'Nequi' });
        await resolverRespuestaDeCobro({ id: 'int-1' } as any, '570000000000', '2', vi.fn(async () => undefined));
        expect(aplicarComprobanteMock).not.toHaveBeenCalled();
    });

    it('escuela que SÍ recibe abonos → se aplica aunque no cuadre (lo revisa la escuela al aprobar)', async () => {
        h.settings = { allow_installments: true, online_fee_pct: 3 };
        h.filaEsperando = fila(150000);
        await resolverRespuestaDeCobro({ id: 'int-1' } as any, '570000000000', '2', vi.fn(async () => undefined));
        expect(aplicarComprobanteMock).toHaveBeenCalledTimes(1);
    });

    it('sin monto leído → no se decide por monto (igual que el worker)', async () => {
        h.filaEsperando = fila(null);
        await resolverRespuestaDeCobro({ id: 'int-1' } as any, '570000000000', '2', vi.fn(async () => undefined));
        expect(aplicarComprobanteMock).toHaveBeenCalledTimes(1);
    });

    it('sin fila de ajustes → ante la duda no recibe abonos', async () => {
        h.settings = null;
        h.filaEsperando = fila(150000);
        await resolverRespuestaDeCobro({ id: 'int-1' } as any, '570000000000', '2', vi.fn(async () => undefined));
        expect(aplicarComprobanteMock).not.toHaveBeenCalled();
    });
});

describe('2. el link de pago nombra el recargo', () => {
    it('con recargo: total y recargo', () => {
        const t = instruccionesDelLinkConMonto(60, true, { total: 185400, recargo: 5400 });
        expect(t).toContain('El link cobra $185.400 (incluye $5.400 de recargo por pago en línea)');
        expect(t).toContain('Tienes 1 hora para pagar');
    });
    it('sin recargo (o sin montos): el texto de siempre', () => {
        expect(instruccionesDelLinkConMonto(60, false, { total: 180000, recargo: 0 }))
            .toBe('Tienes 1 hora para pagar con ese link; al aprobarse, el pago queda aplicado solo.');
        expect(instruccionesDelLinkConMonto(30)).toBe('Tienes 30 minutos para pagar con ese link; al aprobarse, el pago queda aplicado solo.');
    });
    it('lineaPagar lleva el recargo del cobro', () => {
        const l = lineaPagar({ enlace_pago: 'https://checkout.example/p', enlace_vence_min: 60, enlace_total: 185400, enlace_recargo: 5400 });
        expect(l).toContain('incluye $5.400 de recargo');
    });
});

// ─── 6. Tono ────────────────────────────────────────────────────────────────

describe('6. emojis de deporte y «otro sistema»', () => {
    it('sinEmojisDeDeporte quita ⚽ 🏐 🏀 (con variantes) y deja los demás', () => {
        expect(sinEmojisDeDeporte('¡Listo! ⚽ Te esperamos 🙌')).toBe('¡Listo! Te esperamos 🙌');
        expect(sinEmojisDeDeporte('Vamos 🏐 equipo 🏀')).toBe('Vamos equipo');
        expect(sinEmojisDeDeporte('Ánimo ⛹️‍♀️ campeona ✅')).toBe('Ánimo campeona ✅');
    });
    it('filtrarSalidaDelModelo: ⚽ fuera del texto del modelo', () => {
        const r = filtrarSalidaDelModelo('¡Claro! ⚽ El entreno es a las 5 p. m.');
        expect(r.texto).toBe('¡Claro! El entreno es a las 5 p. m.');
        expect(r.motivos).toContain('emoji_de_deporte');
    });
    it('filtrarSalidaDelModelo: «otro sistema procesa las imágenes» → «La escuela revisa los comprobantes.»', () => {
        const r = filtrarSalidaDelModelo('Tu foto la procesa otro sistema que te responde aparte. ¿Algo más?');
        expect(r.texto).toBe('La escuela revisa los comprobantes. ¿Algo más?');
        expect(r.texto).not.toMatch(/sistema/i);
        expect(r.motivos).toContain('menciona_otro_sistema');
        // Sin la frase, nada cambia.
        expect(filtrarSalidaDelModelo('Tu pago está en revisión.').alterado).toBe(false);
    });
    it('la plantilla de la semana de cortesía ya no lleva ⚽', () => {
        const t = textoSemanaDeCortesia({ enlace: 'https://sportmaps.co/join/x', dias: 7, horarios: null });
        expect(t).not.toMatch(/⚽|🏐|🏀/);
    });
});
