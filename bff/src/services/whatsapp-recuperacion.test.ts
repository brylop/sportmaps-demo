/**
 * Recuperación en lote de comprobantes de WhatsApp (whatsapp-recuperacion.service).
 *
 * Lo que NO puede pasar nunca, y por eso se prueba con efectos y no leyendo:
 *   - que se le escriba a alguien (WhatsApp o correo);
 *   - que un comprobante quede aprobado (aunque la escuela tenga auto-aprobación);
 *   - que se registre dos veces un pago que la escuela ya registró a mano;
 *   - que la simulación escriba algo;
 *   - que una fila ya tomada se procese otra vez.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

type Op = { table: string; op: 'select' | 'update' | 'insert'; cols?: string; values?: any };
const ops: Op[] = [];
const rpcs: string[] = [];
const subidas: string[] = [];

const state = {
    pendientes: [] as any[],
    registrados: [] as any[],
    tomaOk: true,
    staff: false,
    porTelefono: { estado: 'identificado', parent_id: 'parent-1' } as any,
    previa: null as any,
};

function resultado(o: Op): { data: any; error: any } {
    if (o.table === 'payments' && o.op === 'select') {
        if (o.cols?.includes('child:children')) return { data: state.pendientes, error: null };
        if (o.cols?.includes('amount_paid')) return { data: state.registrados, error: null };
        return { data: [], error: null }; // ¿referencia/imagen ya usadas? no
    }
    if (o.table === 'payments' && o.op === 'update') return { data: [{ id: 'pay-x' }], error: null };
    if (o.table === 'whatsapp_inbound_queue' && o.op === 'select') return { data: state.previa, error: null };
    if (o.table === 'whatsapp_inbound_queue' && o.op === 'update') {
        return { data: state.tomaOk ? [{ id: 'fila-1' }] : [], error: null };
    }
    if (o.table === 'children' && o.cols?.includes('parent_phone_temp')) {
        return { data: [{ parent_id: 'parent-1', parent_phone_temp: null }], error: null };
    }
    if (o.table === 'children') return { data: [{ id: 'child-1' }], error: null };
    if (o.table === 'profiles') return { data: [{ id: 'parent-1', phone: '+57 300 123 4567' }], error: null };
    return { data: null, error: null };
}

function chain(table: string) {
    const o: Op = { table, op: 'select' };
    const c: any = {
        select: (cols?: string) => { if (o.op === 'select') o.cols = cols; return c; },
        update: (v: any) => { o.op = 'update'; o.values = v; ops.push(o); return c; },
        insert: (v: any) => { o.op = 'insert'; o.values = v; ops.push(o); return c; },
        eq: () => c, in: () => c, or: () => c, is: () => c, not: () => c, gte: () => c, neq: () => c,
        limit: () => c, order: () => c,
        maybeSingle: () => Promise.resolve(resultado(o)),
        single: () => Promise.resolve(resultado(o)),
        then: (ok: any, ko: any) => Promise.resolve(resultado(o)).then(ok, ko),
    };
    return c;
}

vi.mock('../config/supabase', () => ({
    supabase: {
        from: (t: string) => { const c = chain(t); return c; },
        rpc: (name: string) => {
            rpcs.push(name);
            if (name === 'wa_identify_staff_admin_by_phone') {
                return Promise.resolve({ data: { estado: state.staff ? 'identificado' : 'no_es_staff_admin' }, error: null });
            }
            if (name === 'wa_identify_by_phone') return Promise.resolve({ data: state.porTelefono, error: null });
            return Promise.resolve({ data: false, error: null });
        },
        storage: {
            from: () => ({
                upload: (path: string) => { subidas.push(path); return Promise.resolve({ error: null }); },
                download: () => Promise.resolve({ data: null, error: { message: 'no' } }),
            }),
        },
    },
}));

const enviar = vi.fn();
vi.mock('./whatsapp.service', () => ({
    downloadMedia: vi.fn(() => Promise.resolve({ ok: true, base64: Buffer.from('foto').toString('base64'), mimeType: 'image/jpeg' })),
    sendTextMessage: (...a: any[]) => { enviar(...a); return Promise.resolve({ ok: true }); },
    sendInteractiveButtons: (...a: any[]) => { enviar(...a); return Promise.resolve({ ok: true }); },
    aFormatoWhatsApp: (t: string) => t,
}));

const evaluar = vi.fn();
vi.mock('./receipt-approval.service', () => ({
    evaluatePaymentReceipt: (...a: any[]) => { evaluar(...a); return Promise.resolve({ action: 'approved' }); },
    redRejectionMessage: () => null,
}));

const correo = vi.fn();
vi.mock('../utils/emailClient', () => ({ emailClient: { send: (...a: any[]) => correo(...a) } }));

const extraer = vi.fn();
vi.mock('./ocr.service', () => ({ extractReceipt: (...a: any[]) => extraer(...a) }));

import {
    decidirRecuperacion, pagosQueYaCubren, fechaDeReferencia, cierreDeFila, recuperarFilaDeCola,
    type PagoRegistrado,
} from './whatsapp-recuperacion.service';
import { importarAdjunto } from './whatsapp-importar-chat.service';

// ─── Datos ───────────────────────────────────────────────────────────────────

const OCR = {
    amount: 180000, currency: 'COP', date: '2026-10-04', time: '10:00', bank: 'Nequi', reference: 'M1234567',
    destination: null, destinationName: null, originName: null, isReceipt: true, isTransactionList: false,
    missingFields: [], provider: 'openai',
};
const ocrFn = vi.fn(() => Promise.resolve({ ...OCR }));

const PEND = (id: string, amount: number) => ({
    id, amount, concept: `Mensualidad ${id}`, due_date: '2026-10-05', child_id: 'child-1', atleta: null,
});
const REG = (o: Partial<PagoRegistrado>): PagoRegistrado => ({
    id: 'paid-1', amount: 180000, amount_paid: 180000, status: 'paid', payment_date: '2026-10-04',
    updated_at: '2026-10-04T15:00:00Z', concept: 'Mensualidad 10/2026', ...o,
});

const FILA = {
    id: 'fila-1', integration_id: 'int-1', school_id: 'school-1', wa_phone_number: '573001234567',
    wa_message_id: 'wamid.1', media_id: 'media-1', media_mime_type: 'image/jpeg', storage_path: null,
    retries: 0, status: 'ignored', error_message: 'bot_apagado', created_at: '2026-10-04T15:00:00Z', wa_timestamp: null,
};
const WA = { id: 'int-1', school_id: 'school-1', access_token_encrypted: 'x' } as any;

beforeEach(() => {
    ops.length = 0; rpcs.length = 0; subidas.length = 0;
    enviar.mockClear(); evaluar.mockClear(); correo.mockClear(); ocrFn.mockClear();
    state.pendientes = [PEND('p-oct', 180000)];
    state.registrados = [];
    state.tomaOk = true;
    state.staff = false;
    state.porTelefono = { estado: 'identificado', parent_id: 'parent-1' };
    state.previa = null;
    extraer.mockReset();
    extraer.mockImplementation(() => Promise.resolve({ ...OCR }));
});

// ─── La regla, sin mocks ─────────────────────────────────────────────────────

describe('decidirRecuperacion', () => {
    const base = {
        familia: { tipo: 'identificado', parentId: 'parent-1' } as const,
        ocr: OCR, destinoDeLaEscuela: true, yaUsadoEn: null, pagadosQueCubren: [] as PagoRegistrado[],
    };

    it('un solo cobro pendiente → en revisión en ese cobro', () => {
        const d = decidirRecuperacion({ ...base, pendientes: [PEND('a', 180000)] });
        expect(d.decision).toBe('en_revision');
        expect(d.pago?.id).toBe('a');
    });

    it('único cobro pero el comprobante es por otro valor (abono) → al buzón, no se estampa', () => {
        const d = decidirRecuperacion({ ...base, ocr: { ...OCR, amount: 75000 }, pendientes: [PEND('a', 210000)] });
        expect(d.decision).toBe('monto_distinto');
        expect(d.pago).toBeUndefined();
    });

    it('único cobro y el OCR no leyó el monto → en revisión (lo marca el veredicto)', () => {
        const d = decidirRecuperacion({ ...base, ocr: { ...OCR, amount: null }, pendientes: [PEND('a', 210000)] });
        expect(d.decision).toBe('en_revision');
    });

    it('el monto desempata entre varios → en revisión en el del monto', () => {
        const d = decidirRecuperacion({ ...base, pendientes: [PEND('a', 90000), PEND('b', 180000)] });
        expect(d).toMatchObject({ decision: 'en_revision', pago: { id: 'b' } });
    });

    it('el monto no desempata → al buzón, no se adivina', () => {
        const d = decidirRecuperacion({ ...base, pendientes: [PEND('a', 180000), PEND('b', 180000)] });
        expect(d.decision).toBe('varios_cobros');
    });

    it('ya registrado a mano por ese monto y sin pendiente igual → ya_registrado, sin cobro', () => {
        const d = decidirRecuperacion({ ...base, pagadosQueCubren: [REG({})], pendientes: [PEND('nov', 90000)] });
        expect(d.decision).toBe('ya_registrado');
        expect(d.pago).toBeUndefined();
        expect(d.pagoRegistradoId).toBe('paid-1');
    });

    it('ya registrado pero también hay pendiente del mismo monto → decide una persona', () => {
        const d = decidirRecuperacion({ ...base, pagadosQueCubren: [REG({})], pendientes: [PEND('sep', 180000)] });
        expect(d.decision).toBe('varios_cobros');
        expect(d.pago).toBeUndefined();
    });

    it('referencia de banco ya usada → ya_registrado aunque haya pendientes', () => {
        const d = decidirRecuperacion({ ...base, yaUsadoEn: { paymentId: 'x', por: 'referencia' }, pendientes: [PEND('a', 180000)] });
        expect(d).toMatchObject({ decision: 'ya_registrado', pagoRegistradoId: 'x' });
    });

    it('no es comprobante / destino ajeno / sin familia', () => {
        expect(decidirRecuperacion({ ...base, ocr: { ...OCR, isReceipt: false }, pendientes: [] }).decision).toBe('no_es_comprobante');
        expect(decidirRecuperacion({ ...base, destinoDeLaEscuela: false, pendientes: [] }).decision).toBe('destino_ajeno');
        expect(decidirRecuperacion({ ...base, familia: { tipo: 'sin_cuenta' }, pendientes: [] }).decision).toBe('familia_sin_cuenta');
        expect(decidirRecuperacion({ ...base, familia: { tipo: 'desconocido' }, pendientes: [] }).decision).toBe('sin_familia');
        expect(decidirRecuperacion({ ...base, familia: { tipo: 'staff' }, pendientes: [PEND('a', 180000)] }).decision).toBe('enviado_por_equipo');
    });
});

describe('pagosQueYaCubren y fechaDeReferencia', () => {
    it('mismo monto dentro de la ventana cubre; fuera de ella o de otro monto, no', () => {
        expect(pagosQueYaCubren([REG({ payment_date: '2026-10-06' })], 180000, '2026-10-04')).toHaveLength(1);
        expect(pagosQueYaCubren([REG({ payment_date: '2026-09-05' })], 180000, '2026-10-04')).toHaveLength(0);
        expect(pagosQueYaCubren([REG({ amount: 90000, amount_paid: 90000 })], 180000, '2026-10-04')).toHaveLength(0);
        expect(pagosQueYaCubren([REG({})], null, '2026-10-04')).toHaveLength(0);
    });

    it('una fecha de comprobante absurda cede a la del mensaje', () => {
        expect(fechaDeReferencia('2025-10-04', '2026-10-04T15:00:00Z')).toBe('2026-10-04');
        expect(fechaDeReferencia('2026-10-01', '2026-10-04T15:00:00Z')).toBe('2026-10-01');
        expect(fechaDeReferencia(null, '2026-10-04T15:00:00Z')).toBe('2026-10-04');
    });
});

describe('cierreDeFila', () => {
    const STATUS = ['pending', 'processing', 'waiting_user', 'done', 'failed', 'ignored'];
    const RESULT = ['payment_receipt', 'glosa', 'escalated', 'none'];
    const decisiones = ['en_revision', 'ya_registrado', 'no_es_comprobante', 'es_listado', 'destino_ajeno', 'sin_pendientes',
        'varios_cobros', 'monto_distinto', 'familia_sin_cuenta', 'numero_ambiguo', 'sin_familia', 'enviado_por_equipo', 'archivo_no_disponible'] as const;

    it.each(decisiones)('%s cierra dentro de los CHECK, marcado como recuperado y sin aviso de desenlace', (decision) => {
        const c = cierreDeFila({ decision, motivo: 'm', ocr: null }, '2026-10-05T00:00:00Z')!;
        expect(STATUS).toContain(c.status);
        expect(RESULT).toContain(c.result_type);
        expect(String(c.error_message).startsWith('recuperado:')).toBe(true);
        // El job de desenlace no le escribe al acudiente cuando la escuela apruebe.
        expect(c.outcome_notified_at).toBe('2026-10-05T00:00:00Z');
    });

    it('transitorio → no se cierra', () => {
        expect(cierreDeFila({ decision: 'reintentar', motivo: 'ocr', ocr: null }, 'x')).toBeNull();
    });
});

// ─── Con efectos ─────────────────────────────────────────────────────────────

const updatesDe = (t: string) => ops.filter((o) => o.table === t && o.op === 'update');

describe('recuperarFilaDeCola', () => {
    it('SIMULACIÓN: decide pero no escribe nada, ni identifica con la RPC que vincula', async () => {
        const r = await recuperarFilaDeCola({ ...FILA }, WA, { aplicar: false, ocrFn, cache: {} });
        expect(r.decision).toBe('en_revision');
        expect(r.pago?.id).toBe('p-oct');
        expect(ops.filter((o) => o.op !== 'select')).toEqual([]);
        expect(subidas).toEqual([]);
        expect(rpcs).not.toContain('wa_identify_by_phone');
        expect(enviar).not.toHaveBeenCalled();
        expect(evaluar).not.toHaveBeenCalled();
    });

    it('APLICAR: deja el cobro awaiting_approval con el comprobante; nunca aprueba ni responde', async () => {
        const r = await recuperarFilaDeCola({ ...FILA }, WA, { aplicar: true, ocrFn });
        expect(r.decision).toBe('en_revision');

        const pago = updatesDe('payments');
        expect(pago).toHaveLength(1);
        expect(pago[0].values.status).toBe('awaiting_approval');
        expect(pago[0].values.receipt_url).toBe('school-1/whatsapp/fila-1.jpeg');
        expect(subidas).toEqual(['school-1/whatsapp/fila-1.jpeg']);

        expect(evaluar).not.toHaveBeenCalled();               // ni auto-aprobación ni glosa
        expect(rpcs).not.toContain('auto_approve_payment');
        expect(enviar).not.toHaveBeenCalled();                // ni WhatsApp…
        expect(correo).not.toHaveBeenCalled();                // …ni correo

        const cierre = updatesDe('whatsapp_inbound_queue').at(-1)!.values;
        expect(cierre).toMatchObject({ status: 'done', result_type: 'payment_receipt', result_ref_id: 'p-oct' });
        expect(cierre.outcome_notified_at).toBeTruthy();
    });

    it('ya registrado a mano: no toca ningún cobro y la fila queda con el pago que lo cubre', async () => {
        state.pendientes = [];
        state.registrados = [{ id: 'paid-1', amount: 180000, amount_paid: 180000, status: 'paid', payment_date: '2026-10-04', updated_at: null, concept: 'Oct' }];
        const r = await recuperarFilaDeCola({ ...FILA }, WA, { aplicar: true, ocrFn });
        expect(r.decision).toBe('ya_registrado');
        expect(updatesDe('payments')).toEqual([]);
        expect(updatesDe('whatsapp_inbound_queue').at(-1)!.values).toMatchObject({ status: 'ignored', result_ref_id: 'paid-1' });
    });

    it('idempotente: si la fila ya no está como se leyó, no se procesa (ni OCR)', async () => {
        state.tomaOk = false;
        const r = await recuperarFilaDeCola({ ...FILA }, WA, { aplicar: true, ocrFn });
        expect(r.decision).toBe('reintentar');
        expect(ocrFn).not.toHaveBeenCalled();
        expect(updatesDe('payments')).toEqual([]);
        expect(subidas).toEqual([]);
    });

    it('OCR caído: la fila vuelve a su estado previo, sin veredicto', async () => {
        ocrFn.mockImplementationOnce(() => Promise.reject(new Error('429')));
        const r = await recuperarFilaDeCola({ ...FILA }, WA, { aplicar: true, ocrFn });
        expect(r.decision).toBe('reintentar');
        expect(updatesDe('payments')).toEqual([]);
        expect(updatesDe('whatsapp_inbound_queue').at(-1)!.values).toEqual({ status: 'ignored', locked_until: null });
    });

    it('lo manda quien administra la escuela (aunque sea acudiente): no se aplica a sus cobros', async () => {
        state.staff = true;
        const r = await recuperarFilaDeCola({ ...FILA }, WA, { aplicar: true, ocrFn });
        expect(r.decision).toBe('enviado_por_equipo');
        expect(updatesDe('payments')).toEqual([]);
        expect(updatesDe('whatsapp_inbound_queue').at(-1)!.values).toMatchObject({ status: 'ignored', result_type: 'escalated' });
    });
});

// ─── Importar chat exportado (Tarea B): mismo camino ─────────────────────────

describe('importarAdjunto', () => {
    const ADJ = {
        schoolId: 'school-1', integrationId: 'int-1', parentId: 'parent-1', telefono: '573001234567',
        archivo: 'IMG-20260905-WA0012.jpg', fecha: '2026-09-05', contenido: Buffer.from('foto'), mime: 'image/jpeg',
    };

    it('en revisión, fila insertada YA CERRADA (nunca pending), sin responder ni aprobar', async () => {
        state.pendientes = [PEND('p-sep', 180000)];
        const r = await importarAdjunto(ADJ);
        expect(r.decision).toBe('en_revision');
        expect(updatesDe('payments')[0].values.status).toBe('awaiting_approval');
        const fila = ops.find((o) => o.table === 'whatsapp_inbound_queue' && o.op === 'insert')!.values;
        expect(fila.status).toBe('done');
        expect(fila.wa_message_id).toMatch(/^import:[0-9a-f]{64}$/);
        expect(fila.outcome_notified_at).toBeTruthy();
        expect(evaluar).not.toHaveBeenCalled();
        expect(enviar).not.toHaveBeenCalled();
        expect(correo).not.toHaveBeenCalled();
    });

    it('idempotente: el mismo archivo ya importado no se procesa ni paga OCR', async () => {
        state.previa = { id: 'q-1', error_message: 'recuperado: en_revision — a Mensualidad' };
        const r = await importarAdjunto(ADJ);
        expect(r.decision).toBe('ya_importado');
        expect(extraer).not.toHaveBeenCalled();
        expect(ops.filter((o) => o.op !== 'select')).toEqual([]);
        expect(subidas).toEqual([]);
    });

    it('ya registrado por la planilla de papel: no estampa ningún cobro', async () => {
        state.pendientes = [PEND('p-oct', 90000)];
        state.registrados = [{ id: 'paid-sep', amount: 180000, amount_paid: 180000, status: 'paid', payment_date: '2026-09-05', updated_at: null, concept: 'Sep' }];
        extraer.mockImplementation(() => Promise.resolve({ ...OCR, date: '2026-09-05' }));
        const r = await importarAdjunto(ADJ);
        expect(r.decision).toBe('ya_registrado');
        expect(updatesDe('payments')).toEqual([]);
    });
});
