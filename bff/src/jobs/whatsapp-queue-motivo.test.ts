/**
 * Comprobantes con motivo (plan B4, docs/specs/whatsapp-monster-plan-B4.md §5).
 *
 * Primero la CARACTERIZACIÓN: con el interruptor `wa_cobro_desde_comprobante`
 * apagado (como nace en todas las escuelas) la cola responde exactamente como
 * hoy — pregunta del mes, [Mensualidad][Inscripción][Otro], otro concepto a la
 * escuela, ráfaga sin botones y prospecto sin ficha. Dynasty, Dreamers y las
 * demás no pueden notar el cambio. Datos inventados con la forma de los reales.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// La primera foto carga en frío los servicios que la cola importa perezoso.
vi.setConfig({ testTimeout: 30_000 });

const state = {
    conv: { data: { id: 'conv-1', parent_id: null, identified: false } as any },
    rpcIdentifyByPhone: { data: { estado: 'identificado', parent_id: 'parent-1' } as any },
    atencion: { atender: true, tipo: 'familia', botEncendido: true } as any,
    claim: [] as any[],
    textos: [] as any[],
    cuentas: ['3001112222'] as string[],
    children: [] as any[],
    enrollments: [] as any[],
};

const updatesCola: any[] = [];
const updatesPagos: any[] = [];
const registrados: any[] = [];

function makeChain(result: any, table?: string) {
    const chain: any = {
        select: () => chain, eq: () => chain, in: () => chain, or: () => chain, gte: () => chain, gt: () => chain,
        lte: () => chain, lt: () => chain, ilike: () => chain, limit: () => chain, order: () => chain, neq: () => chain,
        is: () => chain, not: () => chain, insert: () => chain, upsert: () => chain,
        update: (v: any) => {
            if (table === 'whatsapp_inbound_queue') updatesCola.push(v);
            if (table === 'payments') updatesPagos.push(v);
            return chain;
        },
        maybeSingle: () => Promise.resolve(result),
        single: () => Promise.resolve(result),
        then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    };
    return chain;
}

const FILA = (id: string, extra: Record<string, unknown> = {}) => ({
    id, integration_id: 'int-1', school_id: 'school-1', wa_phone_number: '573005550101',
    wa_message_id: `wamid.${id}`, media_id: `media-${id}`, media_mime_type: 'image/jpeg',
    storage_path: null, retries: 0, created_at: new Date().toISOString(), ...extra,
});

const rpcMock = vi.fn((name: string, args?: any) => {
    if (name === 'wa_queue_claim') return Promise.resolve({ data: state.claim, error: null });
    if (name === 'wa_identify_staff_admin_by_phone') return Promise.resolve({ data: { estado: 'desconocido' } });
    if (name === 'wa_identify_by_phone') return Promise.resolve(state.rpcIdentifyByPhone);
    if (name === 'wa_record_outbound_message') registrados.push(args);
    return Promise.resolve({ data: null, error: null });
});

vi.mock('../config/supabase', () => ({
    supabase: {
        from: vi.fn((table: string) => {
            if (table === 'school_whatsapp_integrations') {
                return makeChain({ data: { id: 'int-1', school_id: 'school-1', access_token: 'tok', phone_number_id: 'pn-1' } }, table);
            }
            if (table === 'whatsapp_conversations') return makeChain(state.conv, table);
            if (table === 'children') return makeChain({ data: state.children, error: null }, table);
            if (table === 'enrollments') return makeChain({ data: state.enrollments, error: null }, table);
            if (table === 'whatsapp_messages') {
                const result: any = { data: [], error: null };
                const chain = makeChain(result, table);
                chain.eq = (col: string, val: any) => {
                    if (col === 'direction' && val === 'inbound') result.data = state.textos;
                    return chain;
                };
                return chain;
            }
            return makeChain({ data: [], error: null }, table);
        }),
        rpc: (...args: any[]) => (rpcMock as any)(...args),
        storage: {
            from: () => ({
                download: vi.fn(() => Promise.resolve({ data: new Blob(['fake']), error: null })),
                upload: vi.fn(() => Promise.resolve({ data: {}, error: null })),
            }),
        },
    },
}));

const sendTextMessageMock = vi.fn((..._a: any[]) => Promise.resolve({ ok: true, waMessageId: 'wamid.out' }));
const sendInteractiveButtonsMock = vi.fn((..._a: any[]) => Promise.resolve({ ok: true, waMessageId: 'wamid.btn' }));
vi.mock('../services/whatsapp.service', () => ({
    downloadMedia: vi.fn(() => Promise.resolve({ ok: true, base64: 'ZmFrZQ==', mimeType: 'image/jpeg' })),
    sendTextMessage: (...a: any[]) => sendTextMessageMock(...a),
    sendInteractiveButtons: (...a: any[]) => sendInteractiveButtonsMock(...a),
    aFormatoWhatsApp: (t: string) => t,
}));
vi.mock('../services/whatsapp-optin.service', () => ({
    estaDadoDeBaja: vi.fn(() => Promise.resolve(false)),
    AVISO_DADO_DE_BAJA: '',
}));
vi.mock('../services/whatsapp-atencion.service', () => ({
    debeAtender: vi.fn(() => Promise.resolve(state.atencion)),
}));
vi.mock('../services/whatsapp-invitacion-vigente.service', () => ({
    invitacionPendienteVigente: vi.fn(() => Promise.resolve({ invitacion: { invite_id: 'inv-1' }, atletaInactivo: false })),
}));
vi.mock('../services/whatsapp-bot.service', () => ({
    abrirConsultaParaLaEscuela: vi.fn(() => Promise.resolve()),
    acusarAdjunto: vi.fn(() => Promise.resolve('acusado')),
    conPresentacionSiEsPrimera: vi.fn(async (_w: any, _c: string, t: string) => t),
    anexoDeConsentimiento: vi.fn(async () => null),
}));

const extractReceiptMock = vi.fn();
vi.mock('../services/ocr.service', () => ({ extractReceipt: (...a: any[]) => extractReceiptMock(...a) }));
vi.mock('../services/enrollment-ocr.service', () => ({ extractEnrollmentForm: vi.fn() }));
vi.mock('../services/receipt-context.service', () => ({
    buildVerdictContext: vi.fn(() => Promise.resolve({ registeredAccounts: state.cuentas, restrictedAccounts: [] })),
}));
vi.mock('../services/receipt-verdict', () => ({
    normalizeDestination: (d: any) => d,
    normalizeReference: (r: any) => r,
    destinationMatchesRegistered: (d: any, a: any[]) => a.includes(d),
    classifyDestinationMatch: (d: any, a: any[]) => (d && a.includes(d) ? 'exact' : 'none'),
    maskedDestinationSuffix: () => null,
    evaluateVerdict: vi.fn(() => ({ verdict: 'amarillo', reasons: [] })),
}));
const evaluatePaymentReceiptMock = vi.fn((..._a: any[]) => Promise.resolve({ action: 'manual_review' }));
vi.mock('../services/receipt-approval.service', () => ({
    evaluatePaymentReceipt: (...a: any[]) => evaluatePaymentReceiptMock(...a),
    redRejectionMessage: vi.fn(() => ''),
}));
vi.mock('../services/whatsapp-venta-servicios.service', () => ({
    ventaAbiertaDeContacto: vi.fn(() => Promise.resolve(null)),
    decidirComprobanteDeVenta: vi.fn(() => ({ tipo: 'seguir' })),
}));

const pagosPendientesDeMock = vi.fn((..._a: any[]) => Promise.resolve([] as any[]));
vi.mock('../services/whatsapp-receipt-matching.service', async () => {
    const real = await vi.importActual<any>('../services/whatsapp-receipt-matching.service');
    return { ...real, pagosPendientesDe: (...a: any[]) => pagosPendientesDeMock(...a) };
});

const deportistaPorNombreMock = vi.fn((..._a: any[]) => Promise.resolve(null as any));
vi.mock('../services/whatsapp-comprobante-de-ficha.service', async () => {
    const real = await vi.importActual<any>('../services/whatsapp-comprobante-de-ficha.service');
    return {
        ...real,
        fichasPorTelefono: vi.fn(() => Promise.resolve({ childIds: [], unregisteredIds: [] })),
        deportistaPorNombre: (...a: any[]) => deportistaPorNombreMock(...a),
        pendientesPorLlaves: vi.fn(() => Promise.resolve([])),
        pagoYaRegistrado: vi.fn(() => Promise.resolve(null)),
    };
});

const { runWhatsAppQueue } = await import('./whatsapp-queue.job');

const comprobante = (amount: number, extra: Record<string, unknown> = {}) => ({
    isReceipt: true, isTransactionList: false, amount, destination: '3001112222',
    reference: `REF-${amount}`, bank: 'Nequi', date: '2026-10-06', provider: 'gemini',
    originName: 'Pedro Gómez', description: null, ...extra,
});
const LAURA = { id: 'c1', full_name: 'Laura Peña' };
const OCT = { id: 'p-oct', amount: 180000, concept: 'Mensualidad 10/2026', due_date: '2026-10-10', child_id: 'c1', atleta: 'Laura Peña' };
const INSC = { id: 'p-insc', amount: 310000, concept: 'Inscripción — Laura Peña', due_date: '2026-10-01', child_id: 'c1', atleta: 'Laura Peña', categoria: 'inscripcion' };
const INSCRIPCION_LAURA = { child_id: 'c1', unregistered_athlete_id: null, monthly_fee: 180000, fee_is_manual: false, status: 'active', plan: { name: 'PRO', price: 180000, registration_fee: 310000 }, team: null };

const enviados = () => [
    ...sendTextMessageMock.mock.calls.map((c) => c[2] as string),
    ...sendInteractiveButtonsMock.mock.calls.map((c) => c[2] as string),
];
const cierre = () => [...updatesCola].reverse().find((u) => u.status && u.status !== 'processing');
const llamadasRpc = (nombre: string) => rpcMock.mock.calls.filter((c) => c[0] === nombre);

beforeAll(async () => {
    await import('../services/whatsapp-recuperacion.service');
});

beforeEach(() => {
    vi.clearAllMocks();
    updatesCola.length = 0;
    updatesPagos.length = 0;
    registrados.length = 0;
    state.conv = { data: { id: 'conv-1', parent_id: null, identified: false } };
    state.rpcIdentifyByPhone = { data: { estado: 'identificado', parent_id: 'parent-1' } };
    state.atencion = { atender: true, tipo: 'familia', botEncendido: true };
    state.claim = [FILA('f1')];
    state.textos = [];
    state.cuentas = ['3001112222'];
    state.children = [];
    state.enrollments = [];
    extractReceiptMock.mockResolvedValue(comprobante(150000));
    deportistaPorNombreMock.mockResolvedValue(null);
    pagosPendientesDeMock.mockResolvedValue([]);
});

// ─── Caracterización: interruptor apagado = idéntico a hoy ──────────────────

describe('caracterización (interruptor apagado, sin motivo esperado): la cola responde como hoy', () => {
    it('familia con UN hijo y sin cobros pendientes → la pregunta del mes con 4 botones', async () => {
        state.children = [LAURA];
        await runWhatsAppQueue();
        expect(enviados()).toHaveLength(1);
        expect(enviados()[0]).toBe('Recibí tu comprobante por *$150.000* de *Laura* 📄 ¿De qué mes es? Toca una opción.');
        const botones = sendInteractiveButtonsMock.mock.calls[0][3] as any[];
        expect(botones).toHaveLength(4);
        expect(botones[3].title).toBe('4. Otro mes');
        expect(updatesCola.find((u) => u.status === 'waiting_user').pregunta_ocr).toMatchObject({ tipo: 'mes' });
        expect(updatesPagos).toHaveLength(0);
    });

    it('monto que no cuadra con la mensualidad → [Mensualidad][Inscripción][Otro], nada se crea ni se aplica', async () => {
        state.children = [LAURA];
        state.enrollments = [INSCRIPCION_LAURA];
        pagosPendientesDeMock.mockResolvedValue([OCT]);
        extractReceiptMock.mockResolvedValue(comprobante(20000));
        await runWhatsAppQueue();
        const botones = sendInteractiveButtonsMock.mock.calls[0][3] as any[];
        expect(botones.map((b) => b.title)).toEqual(['1. Mensualidad', '2. Inscripción', '3. Otro']);
        expect(botones.map((b) => b.id)).toEqual(['sm_cobro_1', 'sm_cobro_2', 'sm_cobro_3']);
        const espera = updatesCola.find((u) => u.status === 'waiting_user');
        expect(espera.pregunta_ocr).toMatchObject({ tipo: 'concepto' });
        expect(espera.pregunta_ocr.guia.opciones.map((o: any) => o.valor)).toEqual(['mensualidad', 'inscripcion', 'otro']);
        expect(updatesPagos).toHaveLength(0);
        expect(evaluatePaymentReceiptMock).not.toHaveBeenCalled();
    });

    it('$310.000 sin cobro de inscripción creado (= registration_fee del plan) → NO se crea el cobro: se pregunta como hoy', async () => {
        state.children = [LAURA];
        state.enrollments = [INSCRIPCION_LAURA];
        pagosPendientesDeMock.mockResolvedValue([]);
        extractReceiptMock.mockResolvedValue(comprobante(310000));
        await runWhatsAppQueue();
        expect(llamadasRpc('wa_crear_cobro_desde_comprobante')).toHaveLength(0);
        expect(enviados()[0]).toContain('¿De qué mes es?');
        expect(updatesPagos).toHaveLength(0);
    });

    it('pie «lo de los uniformes» sin cobro de uniformes → a la escuela, sin aplicarlo a la mensualidad', async () => {
        state.children = [LAURA];
        pagosPendientesDeMock.mockResolvedValue([OCT]);
        state.claim = [FILA('f1', { media_caption: 'mira aquí lo de los uniformes' })];
        extractReceiptMock.mockResolvedValue(comprobante(60000));
        await runWhatsAppQueue();
        expect(enviados()).toEqual([
            'Recibí tu comprobante de *uniforme* 📄 Se lo paso a la escuela para que lo registre; no lo apliqué a la mensualidad.',
        ]);
        const c = cierre();
        expect(c).toMatchObject({ status: 'ignored', result_type: 'escalated' });
        expect(c.error_message.startsWith('otro_concepto: uniforme (pie: «mira aquí lo de los uniformes»)')).toBe(true);
        expect(updatesPagos).toHaveLength(0);
        expect(llamadasRpc('wa_crear_cobro_desde_comprobante')).toHaveLength(0);
    });

    it('ráfaga de 2 fotos que se aplican → UN mensaje numerado, sin botones nuevos', async () => {
        state.children = [LAURA];
        pagosPendientesDeMock.mockResolvedValue([OCT, INSC]);
        state.claim = [FILA('f1'), FILA('f2')];
        extractReceiptMock
            .mockResolvedValueOnce(comprobante(180000))
            .mockResolvedValueOnce(comprobante(310000));
        await runWhatsAppQueue();
        expect(sendInteractiveButtonsMock).not.toHaveBeenCalled();
        expect(sendTextMessageMock).toHaveBeenCalledTimes(1);
        const texto = enviados()[0];
        expect(texto.startsWith('Recibí tus 2 comprobantes:\n\n*1.* Listo: comprobante de *$180.000* de *Laura* para *octubre*.')).toBe(true);
        expect(texto).toContain('*2.* Listo: comprobante de *$310.000* de *Laura* para *inscripción*. La escuela lo confirma.');
        expect(registrados[0].p_payload).toMatchObject({ step: 'resultado_rafaga', queue_ids: ['f1', 'f2'] });
        expect(updatesPagos.map((u) => u.status)).toEqual(['awaiting_approval', 'awaiting_approval']);
    });

    it('prospecto (número sin ficha) con comprobante a la cuenta de la escuela → «¿De qué deportista es este pago?», sin cobro creado', async () => {
        state.atencion = { atender: false, tipo: 'desconocido', botEncendido: true };
        state.claim = [FILA('f1', { media_caption: 'pago de la clase de prueba' })];
        extractReceiptMock.mockResolvedValue(comprobante(15000));
        await runWhatsAppQueue();
        expect(enviados()).toHaveLength(1);
        expect(enviados()[0]).toContain('¿De qué deportista es este pago?');
        expect(updatesCola.find((u) => u.status === 'waiting_user').pregunta_ocr).toMatchObject({ tipo: 'deportista' });
        expect(llamadasRpc('wa_crear_cobro_desde_comprobante')).toHaveLength(0);
        expect(updatesPagos).toHaveLength(0);
    });
});
