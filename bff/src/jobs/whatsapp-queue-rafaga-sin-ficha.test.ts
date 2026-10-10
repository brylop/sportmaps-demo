/**
 * Auditoría 2026-10-10 (4): ráfaga de imágenes desde un número sin ficha que
 * no habla de pagos. Cada foto se bajaba y pasaba por el OCR. Ahora: como mucho
 * MAX_OCR_SIN_FICHA por ventana de VENTANA_OCR_SIN_FICHA_MIN; las demás se
 * cierran en silencio (sin bajar, sin OCR, sin respuesta) y quedan marcadas.
 *
 * Mismo andamiaje que whatsapp-queue-comprobante-de-ficha.test.ts. Datos inventados.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
    conv: { data: { id: 'conv-1', parent_id: null, identified: false } as any },
    rpcIdentifyByPhone: { data: { estado: 'identificado', parent_id: 'parent-1' } as any },
    atencion: { atender: true, tipo: 'familia', botEncendido: true } as any,
    claim: [] as any[],
    textos: [] as any[],
    /** ¿Ya salió la pregunta del deportista en las últimas 24 h? */
    yaPreguntado: false,
    /** Cuentas generales de la escuela (destino del comprobante). */
    cuentas: ['3001112222'] as string[],
    /** Pago de la familia con la misma imagen (dedup por hash). */
    mismaImagen: null as any,
    filaEsperando: null as any,
    /** Adjuntos ANTERIORES del contacto en la ventana (el conteo con head:true). */
    previas: 0,
    /** El conteo falla. */
    conteoFalla: false,
};

const updatesCola: any[] = [];

function makeChain(result: any, table?: string) {
    const chain: any = {
        select: () => chain, eq: () => chain, in: () => chain, or: () => chain, gte: () => chain,
        lte: () => chain, lt: () => chain, ilike: () => chain, limit: () => chain, order: () => chain, neq: () => chain, is: () => chain,
        insert: () => chain, upsert: () => chain,
        update: (v: any) => { if (table === 'whatsapp_inbound_queue') updatesCola.push(v); return chain; },
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

const rpcMock = vi.fn((name: string) => {
    if (name === 'wa_queue_claim') return Promise.resolve({ data: state.claim, error: null });
    if (name === 'wa_identify_staff_admin_by_phone') return Promise.resolve({ data: { estado: 'desconocido' } });
    if (name === 'wa_identify_by_phone') return Promise.resolve(state.rpcIdentifyByPhone);
    return Promise.resolve({ data: null, error: null });
});

vi.mock('../config/supabase', () => ({
    supabase: {
        from: vi.fn((table: string) => {
            if (table === 'school_whatsapp_integrations') {
                return makeChain({ data: { id: 'int-1', school_id: 'school-1', access_token: 'tok', phone_number_id: 'pn-1' } }, table);
            }
            if (table === 'whatsapp_conversations') return makeChain(state.conv, table);
            if (table === 'payments') return makeChain({ data: state.mismaImagen ? [state.mismaImagen] : [], error: null }, table);
            if (table === 'whatsapp_inbound_queue') {
                const chain = makeChain({ data: [], error: null, count: state.conteoFalla ? null : state.previas,
                    ...(state.conteoFalla ? { error: { message: 'boom' } } : {}) }, table);
                const update = chain.update;
                chain.update = (v: any) => {
                    update(v);
                    // aplicarComprobanteDeFicha toma la fila que esperaba.
                    if (v.status === 'processing' && state.filaEsperando) {
                        chain.select = () => Promise.resolve({ data: [state.filaEsperando], error: null });
                    }
                    return chain;
                };
                return chain;
            }
            if (table === 'whatsapp_messages') {
                const result: any = { data: [], error: null };
                const chain = makeChain(result, table);
                let saliente = false;
                chain.eq = (col: string, val: any) => {
                    if (col === 'direction' && val === 'outbound') saliente = true;
                    if (col === 'direction' && val === 'inbound') result.data = state.textos;
                    if (saliente && col === 'payload->>step' && val === 'ask_deportista' && state.yaPreguntado) result.data = [{ id: 'm-prev' }];
                    return chain;
                };
                return chain;
            }
            return makeChain({ data: null, error: null }, table);
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
const downloadMediaMock = vi.fn((..._a: any[]) => Promise.resolve({ ok: true, base64: 'ZmFrZQ==', mimeType: 'image/jpeg' }));
vi.mock('../services/whatsapp.service', () => ({
    downloadMedia: (...a: any[]) => downloadMediaMock(...a),
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
    evaluateVerdict: vi.fn(() => ({ verdict: 'YELLOW', reasons: [] })),
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

const fichasPorTelefonoMock = vi.fn((..._a: any[]) => Promise.resolve({ childIds: [] as string[], unregisteredIds: [] as string[] }));
const deportistaPorNombreMock = vi.fn((..._a: any[]) => Promise.resolve(null as any));
const pendientesPorLlavesMock = vi.fn((..._a: any[]) => Promise.resolve([] as any[]));
const pagoYaRegistradoMock = vi.fn((..._a: any[]) => Promise.resolve(null as any));
vi.mock('../services/whatsapp-comprobante-de-ficha.service', async () => {
    const real = await vi.importActual<any>('../services/whatsapp-comprobante-de-ficha.service');
    return {
        ...real,
        fichasPorTelefono: (...a: any[]) => fichasPorTelefonoMock(...a),
        deportistaPorNombre: (...a: any[]) => deportistaPorNombreMock(...a),
        pendientesPorLlaves: (...a: any[]) => pendientesPorLlavesMock(...a),
        pagoYaRegistrado: (...a: any[]) => pagoYaRegistradoMock(...a),
    };
});

const { runWhatsAppQueue, excedeTopeOcr, MAX_OCR_SIN_FICHA, MOTIVO_OCR_OMITIDO_RAFAGA } = await import('./whatsapp-queue.job');

const comprobante = (amount: number, extra: Record<string, unknown> = {}) => ({
    isReceipt: true, isTransactionList: false, amount, destination: '3001112222',
    reference: 'REF-EJEMPLO-1', bank: 'Nequi', date: '2026-10-06', provider: 'gemini',
    originName: 'Persona Ejemplo', description: null, ...extra,
});
const enviados = () => [
    ...sendTextMessageMock.mock.calls.map((c) => c[2] as string),
    ...sendInteractiveButtonsMock.mock.calls.map((c) => c[2] as string),
];
const cierre = () => [...updatesCola].reverse().find((u) => u.status && u.status !== 'processing');

beforeEach(() => {
    vi.clearAllMocks();
    updatesCola.length = 0;
    state.conv = { data: { id: 'conv-1', parent_id: null, identified: false } };
    state.atencion = { atender: false, tipo: 'desconocido', botEncendido: true };
    state.claim = [FILA('f1')];
    state.textos = [];
    state.yaPreguntado = false;
    state.cuentas = ['3001112222'];
    state.mismaImagen = null;
    state.filaEsperando = null;
    state.previas = 0;
    state.conteoFalla = false;
    // Una foto cualquiera (no comprobante): lo típico de la ráfaga.
    extractReceiptMock.mockResolvedValue({ ...comprobante(0), isReceipt: false, amount: null, destination: null });
    fichasPorTelefonoMock.mockResolvedValue({ childIds: [], unregisteredIds: [] });
    deportistaPorNombreMock.mockResolvedValue(null);
});

describe('excedeTopeOcr (pura)', () => {
    it(`deja pasar las primeras ${MAX_OCR_SIN_FICHA} y frena desde la siguiente`, () => {
        expect(excedeTopeOcr(0)).toBe(false);
        expect(excedeTopeOcr(1)).toBe(false);
        expect(excedeTopeOcr(2)).toBe(true);
        expect(excedeTopeOcr(30)).toBe(true);
    });
});

describe('número sin ficha que no habla de pagos', () => {
    it('1.ª y 2.ª imagen de la ventana → se leen (OCR) como antes', async () => {
        state.previas = 1;
        await runWhatsAppQueue();
        expect(downloadMediaMock).toHaveBeenCalledTimes(1);
        expect(extractReceiptMock).toHaveBeenCalledTimes(1);
        expect(cierre()).toMatchObject({ status: 'ignored', error_message: 'contacto_no_atendido' });
    });

    it('3.ª imagen en 10 min → sin bajarla, sin OCR, sin respuesta, y marcada para no reintentarse', async () => {
        state.previas = 2;
        await runWhatsAppQueue();
        expect(downloadMediaMock).not.toHaveBeenCalled();
        expect(extractReceiptMock).not.toHaveBeenCalled();
        expect(enviados()).toHaveLength(0);
        expect(cierre()).toMatchObject({ status: 'ignored', result_type: 'none', error_message: MOTIVO_OCR_OMITIDO_RAFAGA });
    });

    it('ráfaga larga (10 en el lote, todas con ≥ 2 anteriores) → ningún OCR y ninguna respuesta', async () => {
        state.claim = Array.from({ length: 10 }, (_, i) => FILA(`r${i}`));
        // El conteo lo hace la base por llegada; acá la ráfaga ya tiene 5 antes.
        state.previas = 5;
        await runWhatsAppQueue();
        expect(extractReceiptMock).not.toHaveBeenCalled();
        expect(enviados()).toHaveLength(0);
        expect(updatesCola.filter((u) => u.error_message === MOTIVO_OCR_OMITIDO_RAFAGA)).toHaveLength(10);
    });

    it('si el conteo falla, ante la duda se lee (no se pierde un comprobante)', async () => {
        state.conteoFalla = true;
        await runWhatsAppQueue();
        expect(extractReceiptMock).toHaveBeenCalledTimes(1);
    });

    it('si habla de pago, el tope NO aplica: se lee aunque haya ráfaga', async () => {
        state.previas = 9;
        state.claim = [FILA('f1', { media_caption: 'te envío el comprobante de la mensualidad' })];
        await runWhatsAppQueue();
        expect(extractReceiptMock).toHaveBeenCalledTimes(1);
        expect(updatesCola.some((u) => u.error_message === MOTIVO_OCR_OMITIDO_RAFAGA)).toBe(false);
    });
});
