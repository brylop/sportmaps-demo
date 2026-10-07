/**
 * Cobertura de la rama nueva de staff-admin en whatsapp-queue.job.ts
 * (fase 3 de docs/specs/alta-atleta-por-foto-hoja-matricula.md).
 *
 * No existía suite previa para este archivo — el resto del módulo se verifica
 * en vivo, no con mocks. Esta prueba no reemplaza esa verificación; cubre
 * puntualmente el riesgo que se identificó al revisar el diseño: que un
 * admin de escuela que TAMBIÉN es acudiente (frecuente en escuelas chicas)
 * no pierda el camino de pagos de hoy por caer siempre en la rama nueva.
 *
 * Estrategia de mock: se resuelve `resolverPago` a 'sin_pendientes' para que
 * `continuarComoComprobante` corte temprano, sin necesitar mockear
 * `aplicarComprobante`/`payments`/`evaluatePaymentReceipt`. Lo que se prueba
 * es el RUTEO — que el parentId correcto llega hasta `pagosPendientesDe` (o
 * no llega nunca) — no el resultado final de aplicar un pago, que ya lo
 * cubre la verificación en vivo del resto del módulo.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
    integration: { data: { id: 'int-1', school_id: 'school-1', access_token: 'tok', phone_number_id: 'pn-1' } },
    conv: { data: null as any },
    rpcStaffAdmin: { data: { estado: 'identificado', profile_id: 'staff-1' } as any },
    rpcIdentifyByPhone: { data: { estado: 'desconocido' } as any },
};

function makeChain(result: any) {
    const chain: any = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        gte: () => chain,
        limit: () => chain,
        order: () => chain,
        insert: () => chain,
        update: () => chain,
        upsert: () => chain,
        maybeSingle: () => Promise.resolve(result),
        single: () => Promise.resolve(result),
        then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    };
    return chain;
}

const fromResults: Record<string, any> = {};
const rpcMock = vi.fn((name: string) => {
    if (name === 'wa_identify_staff_admin_by_phone') return Promise.resolve(state.rpcStaffAdmin);
    if (name === 'wa_identify_by_phone') return Promise.resolve(state.rpcIdentifyByPhone);
    return Promise.resolve({ data: null, error: null });
});

vi.mock('../config/supabase', () => ({
    supabase: {
        from: vi.fn((table: string) => makeChain(fromResults[table] ?? { data: null, error: null })),
        rpc: rpcMock,
        storage: {
            from: () => ({
                download: vi.fn(() => Promise.resolve({ data: null, error: null })),
                upload: vi.fn(() => Promise.resolve({ data: {}, error: null })),
            }),
        },
    },
}));

vi.mock('../services/whatsapp.service', () => ({
    downloadMedia: vi.fn(() => Promise.resolve({ ok: true, base64: 'ZmFrZQ==', mimeType: 'image/jpeg' })),
    sendTextMessage: vi.fn(() => Promise.resolve({ ok: true, waMessageId: 'wamid.test' })),
    aFormatoWhatsApp: (t: string) => t,
}));
vi.mock('../services/whatsapp-optin.service', () => ({
    estaDadoDeBaja: vi.fn(() => Promise.resolve(false)),
    AVISO_DADO_DE_BAJA: '',
}));

const extractReceiptMock = vi.fn();
vi.mock('../services/ocr.service', () => ({
    extractReceipt: (...args: any[]) => extractReceiptMock(...args),
}));

const extractEnrollmentFormMock = vi.fn();
vi.mock('../services/enrollment-ocr.service', () => ({
    extractEnrollmentForm: (...args: any[]) => extractEnrollmentFormMock(...args),
}));

vi.mock('../services/receipt-context.service', () => ({
    buildVerdictContext: vi.fn(() => Promise.resolve({ registeredAccounts: [] })),
}));
vi.mock('../services/receipt-verdict', () => ({
    normalizeDestination: (d: any) => d,
    normalizeReference: (r: any) => r,
    destinationMatchesRegistered: (d: any, a: any[]) => a.includes(d),
    evaluateVerdict: vi.fn(() => ({ verdict: 'YELLOW', reasons: [] })),
}));
vi.mock('../services/receipt-approval.service', () => ({
    evaluatePaymentReceipt: vi.fn(() => Promise.resolve({ action: 'manual_review' })),
    redRejectionMessage: vi.fn(() => ''),
}));

// Desde 2026-10-03 el worker pregunta primero a `debeAtender` (bot prendido +
// tipo de contacto). Esta suite prueba la rama de staff-admin, así que el
// contacto es staff con el bot prendido; la puerta se prueba en
// whatsapp-queue-atencion.test.ts.
vi.mock('../services/whatsapp-atencion.service', () => ({
    debeAtender: vi.fn(() => Promise.resolve({ atender: false, tipo: 'staff', botEncendido: true })),
}));

const pagosPendientesDeMock = vi.fn();
const resolverPagoMock = vi.fn();
vi.mock('../services/whatsapp-receipt-matching.service', () => ({
    pagosPendientesDe: (...args: any[]) => pagosPendientesDeMock(...args),
    resolverPago: (...args: any[]) => resolverPagoMock(...args),
    describirPago: () => 'un pago',
    mensajeElegirPago: () => 'elige',
}));

// Import DESPUÉS de los vi.mock — vitest hoistea los vi.mock, pero el import
// dinámico deja explícito el orden para quien lea el archivo.
const { runWhatsAppQueue, elegirPorPista, pistaDesdeTextos } = await import('./whatsapp-queue.job');
const { supabase } = await import('../config/supabase');

const FILA_BASE = {
    id: 'fila-1',
    integration_id: 'int-1',
    school_id: 'school-1',
    wa_phone_number: '3001234567',
    wa_message_id: 'wamid.abc',
    media_id: 'media-1',
    media_mime_type: 'image/jpeg',
    storage_path: null,
    retries: 0,
};

beforeEach(() => {
    vi.clearAllMocks();
    fromResults['school_whatsapp_integrations'] = state.integration;
    fromResults['whatsapp_conversations'] = state.conv;
    fromResults['enrollment_form_intake'] = { data: [], error: null };
    fromResults['children'] = { data: null, error: null };
    state.rpcStaffAdmin = { data: { estado: 'identificado', profile_id: 'staff-1' } };
    state.rpcIdentifyByPhone = { data: { estado: 'desconocido' } };
    resolverPagoMock.mockReturnValue({ tipo: 'sin_pendientes' });
    pagosPendientesDeMock.mockResolvedValue([]);
    // Una sola implementación, que lee `state` en el momento de la llamada
    // (no una cadena de mockImplementation delegando entre sí — eso recursaba).
    (supabase.rpc as any).mockImplementation((name: string) => {
        if (name === 'wa_queue_claim') return Promise.resolve({ data: [{ ...FILA_BASE }], error: null });
        if (name === 'wa_identify_staff_admin_by_phone') return Promise.resolve(state.rpcStaffAdmin);
        if (name === 'wa_identify_by_phone') return Promise.resolve(state.rpcIdentifyByPhone);
        return Promise.resolve({ data: null, error: null });
    });
});

describe('whatsapp-queue.job — rama de staff-admin', () => {
    it('admin que TAMBIÉN es acudiente: un comprobante sigue el camino de pagos de siempre', async () => {
        extractReceiptMock.mockResolvedValue({
            isReceipt: true, isTransactionList: false, amount: 50000, destination: null,
            reference: 'REF1', bank: 'Nequi', date: '2026-09-17', provider: 'gemini',
        });
        state.rpcIdentifyByPhone = { data: { estado: 'identificado', parent_id: 'parent-1' } };

        await runWhatsAppQueue();

        expect(extractReceiptMock).toHaveBeenCalled();
        expect(extractEnrollmentFormMock).not.toHaveBeenCalled();
        // Llegó a continuarComoComprobante con el parentId resuelto por
        // wa_identify_by_phone — el mismo camino que un acudiente normal.
        expect(pagosPendientesDeMock).toHaveBeenCalledWith('parent-1', 'school-1');
    });

    it('admin que NO es acudiente: el comprobante no se aplica ni se crea matrícula', async () => {
        extractReceiptMock.mockResolvedValue({
            isReceipt: true, isTransactionList: false, amount: 50000, destination: null,
            reference: 'REF2', bank: 'Nequi', date: '2026-09-17', provider: 'gemini',
        });
        state.rpcIdentifyByPhone = { data: { estado: 'desconocido' } };

        await runWhatsAppQueue();

        expect(extractReceiptMock).toHaveBeenCalled();
        expect(extractEnrollmentFormMock).not.toHaveBeenCalled();
        // Nunca se resolvió a qué pago aplicar: no siguió el camino de pagos.
        expect(pagosPendientesDeMock).not.toHaveBeenCalled();
        // Y tampoco se creó una matrícula — es un comprobante, no una hoja.
        expect((supabase.from as any)).toHaveBeenCalledWith('school_whatsapp_integrations');
    });

    it('admin manda una hoja de matrícula (no comprobante): se encola en enrollment_form_intake', async () => {
        extractReceiptMock.mockResolvedValue({ isReceipt: false, isTransactionList: false, provider: 'gemini' });
        extractEnrollmentFormMock.mockResolvedValue({
            athleteFullName: 'Mariana Villar', docType: 'TI', docNumber: '1016957517',
            dateOfBirth: '2010-10-06', dateOfBirthRaw: '6 de octubre de 2010', ageOnForm: 15,
            category: 'INTERMEDIO B', guardianFullName: 'Carina Bermudez', guardianDocNumber: '1032389195',
            guardianPhone: '3186230322', guardianEmail: 'x@x.com', athleteEmail: null, athletePhone: null,
            epsName: 'COMPENSAR', bloodType: 'O+', isEnrollmentForm: true, missingFields: [], provider: 'gemini',
        });

        const insertSpy = vi.fn(() => makeChain({ data: { id: 'intake-1' }, error: null }));
        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'enrollment_form_intake') {
                const chain = makeChain({ data: [], error: null });
                chain.insert = insertSpy;
                return chain;
            }
            return makeChain(fromResults[table] ?? { data: null, error: null });
        });

        await runWhatsAppQueue();

        expect(extractEnrollmentFormMock).toHaveBeenCalled();
        expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({
            school_id: 'school-1',
            status: 'waiting_review',
            wa_message_id: 'wamid.abc',
        }));
        expect(pagosPendientesDeMock).not.toHaveBeenCalled();
    });
});

// P3 (análisis 2026-10-06): cuando el monto no desempata, manda lo que la
// familia anunció con texto (el precargado de /p/:token trae la referencia).
describe('pista del cobro anunciado', () => {
    const P = (id: string, concept: string) => ({ id, concept, amount: 180000, due_date: null, child_id: null, atleta: null });
    const pendientes = [
        P('3fa2b91c-0000-4000-8000-000000000001', 'Mensualidad 09/2026 - LAURA P'),
        P('77aa0000-0000-4000-8000-000000000002', 'Mensualidad 10/2026 - LAURA P'),
    ];

    it('por la ref del texto precargado', () => {
        const pista = pistaDesdeTextos([null,
            'Hola, envío el comprobante de pago de Mensualidad 09/2026 - LAURA P (septiembre 2026) de Laura. (ref. 3FA2B91C)']);
        expect(elegirPorPista(pendientes, pista)?.id).toBe(pendientes[0].id);
    });

    it('por el concepto exacto (precargado viejo, sin ref)', () => {
        const pista = pistaDesdeTextos(['Hola, envío el comprobante de pago de Mensualidad 10/2026 - LAURA P (octubre 2026) de Laura.']);
        expect(elegirPorPista(pendientes, pista)?.id).toBe(pendientes[1].id);
    });

    it('sin pista útil → null (se le pregunta a la familia, como antes)', () => {
        expect(elegirPorPista(pendientes, pistaDesdeTextos(['Pago Laura']))).toBeNull();
        expect(elegirPorPista(pendientes, null)).toBeNull();
    });
});

// Item 3 (2026-10-07): una fila `waiting_user` cuya pregunta nadie va a
// contestar (borrador sin enviar, conversación tomada, familia que no responde)
// vence a las 24 h y pasa al buzón de la escuela con el motivo.
describe('preguntas vencidas', () => {
    it('motivo: el borrador manda sobre «no respondió»', async () => {
        const { motivoPreguntaVencida } = await import('./whatsapp-queue.job');
        expect(motivoPreguntaVencida({ enviada: true, enBorrador: true }).codigo).toBe('pregunta_en_borrador');
        expect(motivoPreguntaVencida({ enviada: false, enBorrador: false }).codigo).toBe('pregunta_no_enviada');
        expect(motivoPreguntaVencida({ enviada: true, enBorrador: false }).codigo).toBe('sin_respuesta');
        expect(motivoPreguntaVencida({ enviada: true, enBorrador: false }).texto).toMatch(/^pregunta_vencida: /);
    });

    it('caso real …9366: pregunta enviada, repregunta en borrador → ignored + escalated con el motivo', async () => {
        const { vencerPreguntasSinRespuesta } = await import('./whatsapp-queue.job');
        const updates: any[] = [];
        const ahora = Date.parse('2026-10-07T15:00:00Z');
        const filas = [{
            id: 'q-9366', integration_id: 'int-1', wa_phone_number: '573232849366',
            pregunta_at: '2026-10-06T14:32:10Z', updated_at: '2026-10-06T14:32:38Z',
        }];
        const tabla = (t: string) => {
            const o: any = { t, op: 'select', vals: null };
            const c: any = {
                select: () => c, eq: () => c, in: () => c, lt: () => c, gte: () => c, limit: () => c,
                update: (v: any) => { o.op = 'update'; o.vals = v; updates.push(o); return c; },
                maybeSingle: () => Promise.resolve({ data: t === 'whatsapp_conversations' ? { id: 'conv-1' } : null, error: null }),
                then: (ok: any, ko: any) => {
                    let r: any = { data: [], error: null };
                    if (t === 'whatsapp_inbound_queue') r = o.op === 'update' ? { data: [{ id: 'q-9366' }] } : { data: filas, error: null };
                    if (t === 'whatsapp_messages') r = { data: [{ id: 'm-1' }], error: null };
                    if (t === 'whatsapp_message_drafts') r = { data: [{ id: 'd-1', tool_context: { step: 'ask_cual_pago_reintento' } }], error: null };
                    return Promise.resolve(r).then(ok, ko);
                },
            };
            return c;
        };
        const prev = (supabase.from as any).getMockImplementation();
        (supabase.from as any).mockImplementation(tabla);
        try {
            expect(await vencerPreguntasSinRespuesta(undefined, ahora)).toBe(1);
        } finally {
            (supabase.from as any).mockImplementation(prev);
        }
        expect(updates).toHaveLength(1);
        expect(updates[0].vals).toMatchObject({ status: 'ignored', result_type: 'escalated' });
        expect(updates[0].vals.error_message).toMatch(/borrador sin enviar/);
    });

    it('una pregunta de hace 3 h no vence', async () => {
        const { vencerPreguntasSinRespuesta } = await import('./whatsapp-queue.job');
        const ahora = Date.parse('2026-10-06T17:32:00Z');
        const updates: any[] = [];
        const c: any = {
            select: () => c, eq: () => c, lt: () => c, limit: () => c,
            update: (v: any) => { updates.push(v); return c; },
            then: (ok: any, ko: any) => Promise.resolve({
                data: [{ id: 'q', integration_id: 'i', wa_phone_number: 'w', pregunta_at: '2026-10-06T14:32:10Z', updated_at: '2026-10-05T00:00:00Z' }],
                error: null,
            }).then(ok, ko),
        };
        const prev = (supabase.from as any).getMockImplementation();
        (supabase.from as any).mockImplementation(() => c);
        try {
            expect(await vencerPreguntasSinRespuesta(undefined, ahora)).toBe(0);
        } finally {
            (supabase.from as any).mockImplementation(prev);
        }
        expect(updates).toHaveLength(0);
    });
});

// Item 1 (P0, 2026-10-07): el pie nombra otro concepto → no se aplica a la mensualidad.
describe('comprobante de otro concepto', () => {
    it('pie «Clase perfeccionamiento» con la mensualidad pendiente: a la escuela con motivo otro_concepto', async () => {
        state.rpcStaffAdmin = { data: { estado: 'no_es_staff_admin' } };
        state.rpcIdentifyByPhone = { data: { estado: 'identificado', parent_id: 'parent-1' } };
        const { debeAtender } = await import('../services/whatsapp-atencion.service');
        (debeAtender as any).mockResolvedValueOnce({ atender: true, tipo: 'familia', botEncendido: true });
        (supabase.rpc as any).mockImplementation((name: string) => {
            if (name === 'wa_queue_claim') {
                return Promise.resolve({ data: [{ ...FILA_BASE, media_caption: 'Clase perfeccionamiento Luis Parra' }], error: null });
            }
            if (name === 'wa_identify_staff_admin_by_phone') return Promise.resolve(state.rpcStaffAdmin);
            if (name === 'wa_identify_by_phone') return Promise.resolve(state.rpcIdentifyByPhone);
            return Promise.resolve({ data: null, error: null });
        });
        extractReceiptMock.mockResolvedValue({
            isReceipt: true, isTransactionList: false, amount: 25000, reference: 'M123456', date: '2026-10-06',
            bank: 'Nequi', destination: null, description: null, provider: 'test',
        });
        pagosPendientesDeMock.mockResolvedValue([
            { id: 'p-oct', amount: 180000, concept: 'Mensualidad 10/2026 - LUIS PARRA', due_date: null, child_id: 'c1', atleta: null },
        ]);
        const updates: any[] = [];
        const prev = (supabase.from as any).getMockImplementation();
        (supabase.from as any).mockImplementation((t: string) => {
            const ch = makeChain(fromResults[t] ?? { data: null, error: null });
            const upd = ch.update;
            ch.update = (v: any) => { updates.push({ t, v }); return upd(v); };
            return ch;
        });
        const { sendTextMessage } = await import('../services/whatsapp.service');
        try {
            await runWhatsAppQueue();
        } finally {
            (supabase.from as any).mockImplementation(prev);
        }
        expect(resolverPagoMock).not.toHaveBeenCalled();
        expect(updates.some((u) => u.t === 'payments')).toBe(false);
        const cierre = updates.filter((u) => u.t === 'whatsapp_inbound_queue').at(-1)!.v;
        expect(cierre).toMatchObject({ status: 'ignored', result_type: 'escalated' });
        expect(cierre.error_message).toMatch(/^otro_concepto: clase de perfeccionamiento/);
        expect(String((sendTextMessage as any).mock.calls.at(-1)?.[2])).toMatch(/clase de perfeccionamiento/);
    });
});
