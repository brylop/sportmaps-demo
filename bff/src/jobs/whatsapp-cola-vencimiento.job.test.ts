/**
 * P1 (análisis 2026-10-06): la promesa del acuse tiene plazo. El 06-oct, 15
 * adjuntos de familias quedaron `pending` una hora sin que nadie se enterara.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
    const state = {
        filas: [] as any[],
        sinColumna: false,
        marcadas: [] as string[][],
        escalar: vi.fn(),
    };
    function builder(table: string) {
        const ops: [string, any[]][] = [];
        const b: any = {};
        for (const m of ['select', 'eq', 'in', 'gte', 'lt', 'is', 'limit', 'update']) {
            b[m] = (...a: any[]) => { ops.push([m, a]); return b; };
        }
        const resolver = () => {
            if (table === 'whatsapp_inbound_queue') {
                const upd = ops.find(([m]) => m === 'update');
                if (upd) {
                    const ids = ops.find(([m]) => m === 'in')![1][1] as string[];
                    state.marcadas.push(ids);
                    return { data: ids.map((id) => ({ id })), error: null };
                }
                const conVencida = String(ops.find(([m]) => m === 'select')![1][0]).includes('vencida_at');
                if (conVencida && state.sinColumna) return { data: null, error: { message: 'column vencida_at does not exist' } };
                return { data: state.filas, error: null };
            }
            if (table === 'school_whatsapp_integrations') return { data: { id: 'int-1', school_id: 'school-1' }, error: null };
            if (table === 'whatsapp_conversations') return { data: { id: 'conv-1' }, error: null };
            return { data: null, error: null };
        };
        b.maybeSingle = () => Promise.resolve(resolver());
        b.then = (res: any, rej: any) => Promise.resolve(resolver()).then(res, rej);
        return b;
    }
    return { state, supabase: { from: (t: string) => builder(t) } };
});

vi.mock('../config/supabase', () => ({ supabase: h.supabase }));
vi.mock('../services/whatsapp-bot.service', () => ({ escalarComprobanteSinProcesar: h.state.escalar }));

import { clasificarColgadas, vencerComprobantesColgados, type FilaColgada } from './whatsapp-cola-vencimiento.job';

const AHORA = new Date('2026-10-06T14:00:00Z').getTime();
const haceMin = (m: number) => new Date(AHORA - m * 60_000).toISOString();
const fila = (over: Partial<FilaColgada>): FilaColgada => ({
    id: 'q1', integration_id: 'int-1', school_id: 'school-1', wa_phone_number: '573001112233',
    status: 'pending', locked_until: null, created_at: haceMin(12), ...over,
});

beforeEach(() => {
    h.state.filas = [];
    h.state.sinColumna = false;
    h.state.marcadas = [];
    h.state.escalar.mockReset();
    h.state.escalar.mockResolvedValue('avisado');
});

describe('clasificarColgadas', () => {
    it('alerta desde 5 min, vence desde 10, sin lease vivo', () => {
        const filas = [
            fila({ id: 'a', created_at: haceMin(3) }),                                    // muy nueva
            fila({ id: 'b', created_at: haceMin(6) }),                                    // alerta
            fila({ id: 'c', created_at: haceMin(55) }),                                   // vence (caso 06-oct)
            fila({ id: 'd', status: 'processing', locked_until: new Date(AHORA + 60_000).toISOString(), created_at: haceMin(30) }), // worker vivo
            fila({ id: 'e', status: 'processing', locked_until: haceMin(1), created_at: haceMin(30) }),                           // lease vencido
            fila({ id: 'f', created_at: haceMin(40), vencida_at: haceMin(20) }),          // ya vencida
        ];
        const { alerta, vencer } = clasificarColgadas(filas, AHORA);
        expect(alerta.map((f) => f.id)).toEqual(['b', 'c', 'e']);
        expect(vencer.map((f) => f.id)).toEqual(['c', 'e']);
    });
});

describe('vencerComprobantesColgados', () => {
    it('cinco fotos de la misma familia = UN aviso; marca vencida_at', async () => {
        h.state.filas = ['q1', 'q2', 'q3', 'q4', 'q5'].map((id) => fila({ id }));
        const r = await vencerComprobantesColgados(AHORA);
        expect(r).toMatchObject({ alerta: 5, vencidas: 5, avisadas: 1 });
        expect(h.state.escalar).toHaveBeenCalledTimes(1);
        expect(h.state.escalar).toHaveBeenCalledWith(expect.objectContaining({ id: 'int-1' }), 'conv-1', '573001112233');
        expect(h.state.marcadas).toEqual([['q1', 'q2', 'q3', 'q4', 'q5']]);
    });

    it('sin la migración aplicada sigue funcionando (el freno queda en el bot: 1 aviso cada 24 h)', async () => {
        h.state.sinColumna = true;
        h.state.filas = [fila({ id: 'q1' })];
        const r = await vencerComprobantesColgados(AHORA);
        expect(r.vencidas).toBe(1);
        expect(h.state.marcadas).toEqual([]);
        expect(h.state.escalar).toHaveBeenCalledTimes(1);
    });

    it('filas de menos de 10 min: solo alerta, nadie escala', async () => {
        h.state.filas = [fila({ id: 'q1', created_at: haceMin(7) })];
        const r = await vencerComprobantesColgados(AHORA);
        expect(r).toMatchObject({ alerta: 1, vencidas: 0 });
        expect(h.state.escalar).not.toHaveBeenCalled();
    });
});
