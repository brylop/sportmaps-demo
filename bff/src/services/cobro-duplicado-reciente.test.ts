import { describe, expect, it, vi } from 'vitest';

vi.mock('../config/supabase', () => ({ supabase: {} }));

const { firmaDeLineas, firmaDelPedido, lotesIdenticos, mensajeDeDuplicado, VENTANA_DUPLICADO_MIN } = await import('./cobro-duplicado-reciente');

const AHORA = Date.parse('2026-10-21T22:00:00Z');
const hace = (min: number) => new Date(AHORA - min * 60_000).toISOString();
const NINO = 'c0000000-0000-4000-8000-000000000001';

const linea = (extra: Record<string, unknown> = {}) => ({
    category: 'otro', amount: 30000, due_date: '2026-10-31', concept: 'Hora adicional consumida', ...extra,
});
const pedido = (extra: Record<string, unknown> = {}) => ({
    mode: 'single' as const, target: { kind: 'athlete' as const, ids: [NINO] }, athletes: [{ type: 'child' as const, id: NINO }],
    lines: [linea()] as any, ...extra,
}) as any;

describe('firmaDeLineas', () => {
    it('no depende del orden ni de mayúsculas/espacios del concepto', () => {
        const a = firmaDeLineas([linea(), linea({ category: 'torneo', concept: 'Copa  Pony', amount: 80000 })]);
        const b = firmaDeLineas([linea({ category: 'torneo', concept: ' copa pony ', amount: 80000 }), linea()]);
        expect(a).toBe(b);
    });
    it('cambia con el valor, el concepto, la categoría o el vencimiento', () => {
        const base = firmaDeLineas([linea()]);
        expect(firmaDeLineas([linea({ amount: 31000 })])).not.toBe(base);
        expect(firmaDeLineas([linea({ concept: 'Otra cosa' })])).not.toBe(base);
        expect(firmaDeLineas([linea({ category: 'torneo' })])).not.toBe(base);
        expect(firmaDeLineas([linea({ due_date: '2026-11-01' })])).not.toBe(base);
    });
    it('sin líneas no hay firma', () => {
        expect(firmaDeLineas([])).toBeNull();
        expect(firmaDeLineas(undefined)).toBeNull();
    });
});

describe('firmaDelPedido', () => {
    it('un atleta: el destino es el atleta y el lote guardado coincide con su forma real', () => {
        const f = firmaDelPedido(pedido());
        expect(f?.destino).toBe(`athlete:${NINO}`);
    });
    it('la venta de horas se firma como el lote la guarda (clase_extra con concepto fijo)', () => {
        const horas = pedido({ lines: [linea({ category: 'excedente', extra_hours: 2, enrollment_id: 'e1', concept: 'x', amount: 64500, pay_amount: 64500 })] });
        const guardado = [{ idx: 0, category: 'clase_extra', amount: 64500, concept: 'Horas adicionales · 2 h', due_date: '2026-10-31' }];
        expect(firmaDelPedido(horas)?.lineas).toBe(firmaDeLineas(guardado));
    });
    it('varios: usa el grupo; sin ids (lista) no se puede comparar', () => {
        expect(firmaDelPedido(pedido({ mode: 'multi', target: { kind: 'team', ids: ['t2', 't1'] } }))?.destino).toBe('team:t1,t2');
        expect(firmaDelPedido(pedido({ mode: 'multi', target: { kind: 'list', ids: [] } }))).toBeNull();
    });
    it('atleta nuevo o solo pagos de pendientes: no se compara', () => {
        expect(firmaDelPedido(pedido({ new_athlete: { kind: 'menor', full_name: 'X Y Z' } }))).toBeNull();
        expect(firmaDelPedido(pedido({ lines: [] }))).toBeNull();
    });
});

describe('lotesIdenticos', () => {
    const firma = firmaDelPedido(pedido())!;
    const lote = (extra: Record<string, unknown> = {}) => ({
        id: 'b1', client_request_id: 'req-otro', target: { kind: 'athlete', ids: [NINO] },
        lines: [{ idx: 0, ...linea(), pay_amount: 0 }], created_at: hace(3), annulled_at: null, ...extra,
    });

    it('coincide: mismo destino y líneas, otro client_request_id, dentro de la ventana', () => {
        expect(lotesIdenticos([lote()], firma, 'req-mio', AHORA)).toHaveLength(1);
    });
    it('el mismo client_request_id es el mismo envío, no un duplicado', () => {
        expect(lotesIdenticos([lote({ client_request_id: 'req-mio' })], firma, 'req-mio', AHORA)).toHaveLength(0);
    });
    it('fuera de la ventana, anulado o de otro atleta: no', () => {
        expect(lotesIdenticos([lote({ created_at: hace(VENTANA_DUPLICADO_MIN + 1) })], firma, 'req-mio', AHORA)).toHaveLength(0);
        expect(lotesIdenticos([lote({ annulled_at: hace(1) })], firma, 'req-mio', AHORA)).toHaveLength(0);
        expect(lotesIdenticos([lote({ target: { kind: 'athlete', ids: ['otro'] } })], firma, 'req-mio', AHORA)).toHaveLength(0);
    });
    it('el preview (sin client_request_id) compara contra todos', () => {
        expect(lotesIdenticos([lote()], firma, undefined, AHORA)).toHaveLength(1);
    });
});

describe('mensajeDeDuplicado', () => {
    it('dice hace cuánto y por quién', () => {
        const base = { batch_id: 'b', created_at: '', created_by: null, total_amount: null };
        expect(mensajeDeDuplicado({ ...base, minutes_ago: 3, created_by_name: 'Edna' })).toBe('Este mismo cobro ya se registró hace 3 min por Edna.');
        expect(mensajeDeDuplicado({ ...base, minutes_ago: 0, created_by_name: null })).toBe('Este mismo cobro ya se registró hace menos de un minuto.');
    });
});
