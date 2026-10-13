/**
 * Bandeja de comprobantes y dinero de WhatsApp (informe 2026-10-13, §5 y §6).
 * Datos inventados.
 *
 *  1. Huellas en las filas de la recuperación + enlace por referencia alternativa.
 *  2. «El más antiguo»: la MISMA función en el worker y en la recuperación.
 *  3. Excedente: recargo del link = pago completo; suma exacta = varios cobros;
 *     de más = saldo a favor; de menos = como antes.
 *  4. Cuentas «por fuera de SportMaps»: no se ofrecen y quedan informativas.
 *  5. Atleta adulto con su número: identificado.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock de supabase: tablas configurables y registro de filtros ────────────
const tablas: Record<string, any[]> = {};
const filtros: { table: string; op: string; args: any[] }[] = [];
const rpcs: { name: string; args: any }[] = [];
let rpcRespuesta: Record<string, any> = {};

function chain(table: string) {
    const c: any = {};
    const anota = (op: string) => (...args: any[]) => { filtros.push({ table, op, args }); return c; };
    for (const op of ['select', 'eq', 'in', 'or', 'is', 'not', 'gte', 'lte', 'neq', 'limit', 'order', 'update']) c[op] = anota(op);
    const res = () => ({ data: tablas[table] ?? [], error: null });
    c.maybeSingle = () => Promise.resolve({ data: (tablas[table] ?? [])[0] ?? null, error: null });
    c.single = c.maybeSingle;
    c.then = (ok: any, ko: any) => Promise.resolve(res()).then(ok, ko);
    return c;
}

vi.mock('../config/supabase', () => ({
    supabase: {
        from: (t: string) => chain(t),
        rpc: (name: string, args: any) => {
            rpcs.push({ name, args });
            return Promise.resolve(rpcRespuesta[name] ?? { data: null, error: null });
        },
    },
}));

import {
    decidirCobroPorTexto, leerTextosDelComprobante, elMasAntiguoDelMismoDeportista, montosConRecargo,
} from './whatsapp-cobro-por-texto.service';
import {
    referenciasDelComprobante, huellasDelComprobante, montoEsperado, textoExcedente, cargarRecargos,
    cubrirCobrosConComprobante, ordenarDelMasAntiguo,
} from './whatsapp-excedente.service';
import {
    decidirRecuperacion, cierreDeFila, filtroDeFamilia, identificarFamilia, type PagoRegistrado,
} from './whatsapp-recuperacion.service';
import {
    huellasDeFila, filasParaAutocierrePorDecision, clasificarFila, type FilaConEnlace, type PagoDecidible,
} from './whatsapp-bandeja.service';
import { parseCuentasDePago, linkDePago } from './payment-accounts';
import { pagosPendientesDe, type PagoPendiente } from './whatsapp-receipt-matching.service';

beforeEach(() => {
    for (const k of Object.keys(tablas)) delete tablas[k];
    filtros.length = 0;
    rpcs.length = 0;
    rpcRespuesta = {};
});

const OCR = {
    amount: 150000, currency: 'COP', date: '2026-10-04', time: '10:00', bank: 'Nequi', reference: 'M7654321',
    destination: '3001112222', destinationName: null, originName: null, isReceipt: true, isTransactionList: false,
    missingFields: [], provider: 'test', rawText: 'Nequi\nRecibo M7654321\nAprob. 998877\nValor $150.000',
};
const P = (id: string, amount: number, due: string, child = 'child-1'): PagoPendiente => ({
    id, amount, concept: `Mensualidad ${due.slice(5, 7)}/2026`, due_date: due, child_id: child, atleta: null,
});
const base = {
    familia: { tipo: 'identificado', parentId: 'parent-1' } as const,
    ocr: OCR, destinoDeLaEscuela: true, yaUsadoEn: null, pagadosQueCubren: [] as PagoRegistrado[],
};

// ─── 1. Huellas ──────────────────────────────────────────────────────────────

describe('1. huellas de la recuperación y referencias alternativas', () => {
    it('referenciasDelComprobante: la del OCR y las etiquetadas («Recibo», «Aprob.»), cruda y normalizada', () => {
        const refs = referenciasDelComprobante({ reference: 'M76-54321', rawText: 'Recibo M7654321 · Aprob. 998877 · OK' });
        expect(refs).toEqual(expect.arrayContaining(['M76-54321', 'M7654321', '998877']));
        expect(refs).not.toContain('OK');
    });

    it('no toma palabras sin dígitos ni números cortos', () => {
        expect(referenciasDelComprobante({ reference: 'Nequi', rawText: 'Aprobación: 123 · Referencia: ABCDEF' })).toEqual([]);
    });

    it('cierreDeFila guarda pregunta_ocr con sha, monto, referencia y referencias (también al buzón)', () => {
        const ahora = '2026-10-13T12:00:00Z';
        const enRevision = cierreDeFila({ decision: 'en_revision', motivo: 'x', ocr: OCR as any, sha: 'sha-1', pago: P('a', 150000, '2026-10-05') }, ahora)!;
        expect(enRevision.pregunta_ocr).toMatchObject({
            sha: 'sha-1', ocr: { amount: 150000, reference: 'M7654321', destination: '3001112222' },
        });
        expect((enRevision.pregunta_ocr as any).referencias).toEqual(expect.arrayContaining(['M7654321', '998877']));
        // Sin el texto crudo del comprobante.
        expect(JSON.stringify(enRevision.pregunta_ocr)).not.toContain('Valor $150.000');

        const buzon = cierreDeFila({ decision: 'varios_cobros', motivo: 'x', ocr: OCR as any, sha: 'sha-2' }, ahora)!;
        expect(buzon).toMatchObject({ status: 'ignored', result_type: 'escalated' });
        expect((buzon.pregunta_ocr as any).sha).toBe('sha-2');

        const sinLectura = cierreDeFila({ decision: 'archivo_no_disponible', motivo: 'x', ocr: null }, ahora)!;
        expect(sinLectura.pregunta_ocr).toBeUndefined();
    });

    it('autocierre: enlaza por la referencia ALTERNATIVA del comprobante, solo por igualdad exacta', () => {
        const fila: FilaConEnlace = {
            id: 'f1', status: 'ignored', error_message: 'recuperado: varios_cobros — x', created_at: '2026-10-10T10:00:00Z',
            pregunta_ocr: huellasDelComprobante({ sha: null, ocr: OCR as any }),
        };
        expect(huellasDeFila(fila).referencias).toContain('998877');
        const pago = (ref: string): PagoDecidible => ({
            id: `p-${ref}`, school_id: 's1', status: 'paid', concept: 'Oct', ocr_reference: ref,
            approved_at: '2026-10-11T10:00:00Z',
        });
        expect(filasParaAutocierrePorDecision('s1', [fila], [pago('998877')])).toHaveLength(1);
        expect(filasParaAutocierrePorDecision('s1', [fila], [pago('99887')])).toHaveLength(0);
        expect(filasParaAutocierrePorDecision('s1', [fila], [pago('9988770')])).toHaveLength(0);
    });

    it('huellasDeFila conserva la referencia principal y suma las alternativas sin repetir', () => {
        const h = huellasDeFila({ id: 'x', status: 'failed', error_message: null, pregunta_ocr: { sha: 's', ocr: { reference: 'R111111' }, referencias: ['R111111', 'A222222', 7] } });
        expect(h).toEqual({ sha: 's', referencia: 'R111111', referencias: ['R111111', 'A222222'] });
    });
});

// ─── 2. El más antiguo ───────────────────────────────────────────────────────

describe('2. «el más antiguo»: una sola regla para el worker y la recuperación', () => {
    const sep = P('sep', 150000, '2026-09-05');
    const oct = P('oct', 150000, '2026-10-05');

    it('elMasAntiguoDelMismoDeportista: el de vencimiento más viejo; de deportistas distintos, null', () => {
        expect(elMasAntiguoDelMismoDeportista([oct, sep])?.id).toBe('sep');
        expect(elMasAntiguoDelMismoDeportista([oct, P('x', 150000, '2026-09-05', 'child-2')])).toBeNull();
        expect(elMasAntiguoDelMismoDeportista([])).toBeNull();
    });

    it('la recuperación y el worker eligen el MISMO cobro', () => {
        const rec = decidirRecuperacion({ ...base, pendientes: [oct, sep] });
        const worker = decidirCobroPorTexto({
            pendientes: [sep, oct], parciales: [], monto: 150000,
            lectura: leerTextosDelComprobante(null, [], [sep, oct]), permiteAbonos: false,
        });
        expect(rec).toMatchObject({ decision: 'en_revision', pago: { id: 'sep' } });
        expect(worker).toMatchObject({ tipo: 'aplicar', pago: { id: 'sep' }, motivo: 'mas_antiguo' });
    });
});

// ─── 3. Excedente ────────────────────────────────────────────────────────────

describe('3. excedente', () => {
    const oct = P('oct', 150000, '2026-10-05');
    const nov = P('nov', 150000, '2026-11-05');
    const decidir = (pendientes: PagoPendiente[], monto: number | null, recargos?: Map<string, number[]>, permiteAbonos = false) =>
        decidirCobroPorTexto({
            pendientes, parciales: [], monto, recargos, permiteAbonos,
            lectura: leerTextosDelComprobante(null, [], pendientes),
        });

    it('montosConRecargo: gross del enlace y cobro × (1 + fee del ENLACE); nunca el cobro mismo', () => {
        expect(montosConRecargo(150000, [{ gross_amount: 157500, base_amount: 150000, fee_pct: 5 }])).toEqual([157500]);
        // Hoy la escuela cobra 0 %, pero el enlace viejo se firmó al 5 %.
        expect(montosConRecargo(150000, [{ gross_amount: 150000, base_amount: 150000, fee_pct: 0 }])).toEqual([]);
        expect(montosConRecargo(150000, [{ gross_amount: null, fee_pct: 3 }])).toEqual([154500]);
    });

    it('a. monto = el del enlace de pago → pago COMPLETO de ese cobro (no excedente)', () => {
        const recargos = new Map([['nov', [157500]]]);
        expect(decidir([oct, nov], 157500, recargos)).toEqual({ tipo: 'aplicar', pago: nov, motivo: 'recargo' });
        expect(montoEsperado(nov, 157500, recargos)).toBe(157500);
        expect(montoEsperado(oct, 150000, recargos)).toBe(150000);
        // La recuperación igual: en revisión con lo esperado = monto con recargo.
        const d = decidirRecuperacion({ ...base, ocr: { ...OCR, amount: 157500 }, pendientes: [oct], recargos: new Map([['oct', [157500]]]) });
        expect(d).toMatchObject({ decision: 'en_revision', pago: { id: 'oct' }, esperado: 157500 });
        expect(d.excedente).toBeUndefined();
    });

    it('b. suma exacta de varios cobros → a todos, el más antiguo lleva el comprobante', () => {
        const d = decidirRecuperacion({ ...base, ocr: { ...OCR, amount: 300000 }, pendientes: [nov, P('ins', 150000, '2026-09-20', 'child-2')] });
        expect(d.decision).toBe('en_revision');
        expect(d.pago?.id).toBe('ins');
        expect(d.pagosCubiertos?.map((p) => p.id)).toEqual(['nov']);
        expect(d.esperado).toBe(300000);
        expect(ordenarDelMasAntiguo([nov, oct]).map((p) => p.id)).toEqual(['oct', 'nov']);
    });

    it('c. de más → se aplica al cobro y lo de más es saldo a favor (worker y recuperación)', () => {
        expect(decidir([oct], 180000)).toEqual({ tipo: 'aplicar', pago: oct, motivo: 'excedente', excedente: 30000 });
        // Varios del mismo deportista: al más antiguo.
        expect(decidir([nov, oct].sort((a, b) => a.due_date!.localeCompare(b.due_date!)), 180000))
            .toMatchObject({ tipo: 'aplicar', pago: { id: 'oct' }, motivo: 'excedente', excedente: 30000 });
        // Con abonos prendidos, igual.
        expect(decidir([oct], 180000, undefined, true)).toMatchObject({ motivo: 'excedente' });
        const d = decidirRecuperacion({ ...base, ocr: { ...OCR, amount: 180000 }, pendientes: [oct] });
        expect(d).toMatchObject({ decision: 'en_revision', pago: { id: 'oct' }, excedente: 30000 });
        expect(textoExcedente(30000)).toContain('$30.000');
        expect(textoExcedente(30000)).toContain('saldo a favor');
    });

    it('c. de más con deportistas distintos y sin pista → no se adivina', () => {
        const otro = P('otro', 150000, '2026-10-05', 'child-2');
        expect(decidir([oct, otro], 180000)).toMatchObject({ tipo: 'preguntar' });
        expect(decidirRecuperacion({ ...base, ocr: { ...OCR, amount: 180000 }, pendientes: [oct, otro] }).decision).toBe('varios_cobros');
    });

    it('d. de MENOS sigue igual: sin abonos, a la escuela', () => {
        expect(decidir([oct], 90000)).toMatchObject({ tipo: 'a_la_escuela', codigo: 'monto_no_cuadra' });
    });

    it('cargarRecargos lee los enlaces de los cobros; cubrirCobrosConComprobante llama la RPC', async () => {
        tablas.payment_links = [{ payment_id: 'oct', gross_amount: 157500, base_amount: 150000, fee_pct: 5 }];
        const m = await cargarRecargos('s1', [oct, nov]);
        expect(m.get('oct')).toEqual([157500]);
        expect(m.has('nov')).toBe(false);

        rpcRespuesta.wa_cubrir_cobros_con_comprobante = { data: 1, error: null };
        expect(await cubrirCobrosConComprobante('s1', 'oct', ['nov'])).toEqual({ ok: true, cubiertos: 1 });
        expect(rpcs.at(-1)).toEqual({ name: 'wa_cubrir_cobros_con_comprobante', args: { p_school_id: 's1', p_principal_id: 'oct', p_cobros: ['nov'] } });
        rpcRespuesta.wa_cubrir_cobros_con_comprobante = { data: null, error: { message: 'COBRO_CAMBIO' } };
        expect(await cubrirCobrosConComprobante('s1', 'oct', ['nov'])).toMatchObject({ ok: false, error: 'COBRO_CAMBIO' });
        expect(await cubrirCobrosConComprobante('s1', 'oct', [])).toEqual({ ok: true, cubiertos: 0 });
    });
});

// ─── 4. Cuentas por fuera de SportMaps ───────────────────────────────────────

describe('4. cuentas aceptadas «por fuera de SportMaps»', () => {
    const raw = [
        { id: 'a', type: 'nequi', label: 'Club', value: '3001112222' },
        { id: 'b', type: 'nequi', label: 'Entrenador (torneos)', value: '3009998888', fuera_de_sportmaps: true },
        { id: 'c', type: 'payment_link', label: 'Link', value: 'https://checkout.wompi.co/l/abc', fuera_de_sportmaps: true },
    ];

    it('parseCuentasDePago marca la cuenta; el link «por fuera» no se ofrece', () => {
        const cuentas = parseCuentasDePago(raw);
        expect(cuentas.find((c) => c.id === 'a')?.fueraDeSportmaps).toBe(false);
        expect(cuentas.find((c) => c.id === 'b')?.fueraDeSportmaps).toBe(true);
        expect(linkDePago(raw, null)).toBeNull();
    });

    it('la recuperación lo deja informativo (no «destino ajeno»)', () => {
        const d = decidirRecuperacion({ ...base, destinoDeLaEscuela: false, fueraDeSportmaps: true, pendientes: [P('a', 150000, '2026-10-05')] });
        expect(d.decision).toBe('fuera_de_sportmaps');
        const cierre = cierreDeFila({ ...d, ocr: OCR as any, sha: 's' }, '2026-10-13T12:00:00Z')!;
        expect(cierre).toMatchObject({ status: 'ignored', result_type: 'none' });
        expect(clasificarFila({ id: 'x', status: 'ignored', error_message: String(cierre.error_message) }))
            .toMatchObject({ grupo: 'informativo', motivo: 'fuera_de_sportmaps', etiqueta: 'Pago por fuera de SportMaps' });
    });

    it('el worker lo cierra con un motivo que la bandeja lee como informativo', () => {
        expect(clasificarFila({ id: 'x', status: 'ignored', error_message: 'pago por fuera de SportMaps' }))
            .toMatchObject({ grupo: 'informativo', motivo: 'fuera_de_sportmaps' });
        // El destino ajeno de verdad sigue en acción.
        expect(clasificarFila({ id: 'x', status: 'ignored', error_message: 'destino no es de la escuela' }).grupo).toBe('accion');
    });
});

// ─── 5. Atleta adulto con su número ──────────────────────────────────────────

describe('5. atleta adulto con su número en la ficha', () => {
    it('modo simulación (espejo de wa_identify_by_phone): sin acudiente con ese número, el adulto queda identificado', async () => {
        tablas.children = [];
        tablas.school_members = [{ profile_id: 'adulto-1' }];
        tablas.profiles = [{ id: 'adulto-1', phone: '+57 301 555 0000' }];
        tablas.unregistered_athletes = [];
        rpcRespuesta.wa_identify_staff_admin_by_phone = { data: { estado: 'no_es_staff_admin' }, error: null };
        const f = await identificarFamilia('int-1', 's1', '573015550000', { soloLectura: true, cache: {} });
        expect(f).toEqual({ tipo: 'identificado', parentId: 'adulto-1' });
    });

    it('los cobros del adulto se buscan también por user_id', async () => {
        expect(filtroDeFamilia({ parentId: 'adulto-1' })).toBe('parent_id.eq.adulto-1,user_id.eq.adulto-1');
        tablas.payments = [];
        await pagosPendientesDe('adulto-1', 's1');
        expect(filtros.find((f) => f.table === 'payments' && f.op === 'or')?.args[0]).toBe('parent_id.eq.adulto-1,user_id.eq.adulto-1');
    });
});
