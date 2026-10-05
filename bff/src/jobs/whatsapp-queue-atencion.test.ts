/**
 * La puerta de atención del worker de comprobantes (whatsapp-queue.job.ts).
 *
 * Origen, medido el 2026-10-03 en Dynasty (Coexistence, bot APAGADO): el
 * worker no miraba `ai_enabled` y le escribió de verdad a 17 familias
 * «escríbeme el correo… te mando un código». Del 2 al 3 de octubre, 18 de 29
 * comprobantes se cerraron «contacto sin identificar»; contra
 * `wa_identify_by_phone` 7 eran familias identificables por teléfono, 4
 * familias sin cuenta y 7 desconocidos.
 *
 * Dos capas: la regla pura (`decidirAdjunto`) sin mocks, y el recorrido de
 * `runWhatsAppQueue` con supabase/OCR/envío mockeados para comprobar los
 * efectos: qué se manda, si se gasta OCR y cómo queda la fila.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const state = {
    conv: { data: { id: 'conv-1', parent_id: null, identified: false } as any },
    rpcStaffAdmin: { data: { estado: 'desconocido' } as any },
    rpcIdentifyByPhone: { data: { estado: 'desconocido' } as any },
    rpcInvitacion: { data: null as any },
    atencion: { atender: true, tipo: 'familia', botEncendido: true } as any,
};

/** Cada UPDATE a la cola queda acá, para ver cómo se cerró la fila. */
const updatesCola: any[] = [];

function makeChain(result: any, table?: string) {
    const chain: any = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        or: () => chain,
        gte: () => chain,
        limit: () => chain,
        order: () => chain,
        insert: () => chain,
        update: (v: any) => { if (table === 'whatsapp_inbound_queue') updatesCola.push(v); return chain; },
        upsert: () => chain,
        maybeSingle: () => Promise.resolve(result),
        single: () => Promise.resolve(result),
        then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    };
    return chain;
}

const FILA_BASE = {
    id: 'fila-1',
    integration_id: 'int-1',
    school_id: 'school-1',
    wa_phone_number: '573001234567',
    wa_message_id: 'wamid.abc',
    media_id: 'media-1',
    media_mime_type: 'image/jpeg',
    storage_path: null,
    retries: 0,
};

const rpcMock = vi.fn((name: string) => {
    if (name === 'wa_queue_claim') return Promise.resolve({ data: [{ ...FILA_BASE }], error: null });
    if (name === 'wa_identify_staff_admin_by_phone') return Promise.resolve(state.rpcStaffAdmin);
    if (name === 'wa_identify_by_phone') return Promise.resolve(state.rpcIdentifyByPhone);
    if (name === 'wa_invitacion_pendiente_por_telefono') return Promise.resolve(state.rpcInvitacion);
    return Promise.resolve({ data: null, error: null });
});

vi.mock('../config/supabase', () => ({
    supabase: {
        from: vi.fn((table: string) => {
            if (table === 'school_whatsapp_integrations') {
                return makeChain({ data: { id: 'int-1', school_id: 'school-1', access_token: 'tok', phone_number_id: 'pn-1' } }, table);
            }
            if (table === 'whatsapp_conversations') return makeChain(state.conv, table);
            if (table === 'whatsapp_messages') return makeChain({ data: [], error: null }, table);
            return makeChain({ data: null, error: null }, table);
        }),
        rpc: (...args: any[]) => (rpcMock as any)(...args),
        storage: {
            from: () => ({
                download: vi.fn(() => Promise.resolve({ data: null, error: null })),
                upload: vi.fn(() => Promise.resolve({ data: {}, error: null })),
            }),
        },
    },
}));

const sendTextMessageMock = vi.fn((..._args: any[]) => Promise.resolve({ ok: true, waMessageId: 'wamid.out' }));
const downloadMediaMock = vi.fn((..._args: any[]) => Promise.resolve({ ok: true, base64: 'ZmFrZQ==', mimeType: 'image/jpeg' }));
vi.mock('../services/whatsapp.service', () => ({
    downloadMedia: (...a: any[]) => downloadMediaMock(...a),
    sendTextMessage: (...a: any[]) => sendTextMessageMock(...a),
    aFormatoWhatsApp: (t: string) => t,
}));
vi.mock('../services/whatsapp-optin.service', () => ({
    estaDadoDeBaja: vi.fn(() => Promise.resolve(false)),
    AVISO_DADO_DE_BAJA: '',
}));

const debeAtenderMock = vi.fn((..._args: any[]) => Promise.resolve(state.atencion));
vi.mock('../services/whatsapp-atencion.service', () => ({
    debeAtender: (...a: any[]) => debeAtenderMock(...a),
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

const pagosPendientesDeMock = vi.fn();
const resolverPagoMock = vi.fn();
vi.mock('../services/whatsapp-receipt-matching.service', () => ({
    pagosPendientesDe: (...args: any[]) => pagosPendientesDeMock(...args),
    resolverPago: (...args: any[]) => resolverPagoMock(...args),
    describirPago: () => 'un pago',
    mensajeElegirPago: () => 'elige',
}));

const { runWhatsAppQueue, decidirAdjunto } = await import('./whatsapp-queue.job');

const COMPROBANTE = {
    isReceipt: true, isTransactionList: false, amount: 150000, destination: null,
    reference: 'REF9', bank: 'Bancolombia', date: '2026-10-03', provider: 'gemini',
};

/** El último cierre de la fila (status + result_type + error_message). */
const ultimoCierre = () => [...updatesCola].reverse().find((u) => u.status && u.status !== 'processing');
const textosEnviados = () => sendTextMessageMock.mock.calls.map((c) => c[2] as string);

beforeEach(() => {
    vi.clearAllMocks();
    updatesCola.length = 0;
    state.conv = { data: { id: 'conv-1', parent_id: null, identified: false } };
    state.rpcStaffAdmin = { data: { estado: 'desconocido' } };
    state.rpcIdentifyByPhone = { data: { estado: 'desconocido' } };
    state.rpcInvitacion = { data: null };
    state.atencion = { atender: true, tipo: 'familia', botEncendido: true };
    extractReceiptMock.mockResolvedValue(COMPROBANTE);
    resolverPagoMock.mockReturnValue({ tipo: 'sin_pendientes' });
    pagosPendientesDeMock.mockResolvedValue([]);
});

// ─── La regla pura ───────────────────────────────────────────────────────────

describe('decidirAdjunto — la regla', () => {
    const tipos = ['familia', 'familia_sin_cuenta', 'ambiguo', 'staff', 'desconocido', 'personal'] as const;

    it('bot apagado → bot_apagado para TODOS los tipos, staff incluido', () => {
        for (const tipo of tipos) {
            for (const esStaffAdmin of [false, true]) {
                expect(decidirAdjunto({ botEncendido: false, tipo, esStaffAdmin })).toBe('bot_apagado');
            }
        }
    });

    it('bot prendido: cada tipo a su camino', () => {
        expect(decidirAdjunto({ botEncendido: true, tipo: 'familia', esStaffAdmin: false })).toBe('comprobante');
        expect(decidirAdjunto({ botEncendido: true, tipo: 'familia_sin_cuenta', esStaffAdmin: false })).toBe('escalar_sin_cuenta');
        expect(decidirAdjunto({ botEncendido: true, tipo: 'ambiguo', esStaffAdmin: false })).toBe('escalar_ambiguo');
        expect(decidirAdjunto({ botEncendido: true, tipo: 'staff', esStaffAdmin: true })).toBe('staff_admin');
        expect(decidirAdjunto({ botEncendido: true, tipo: 'desconocido', esStaffAdmin: false })).toBe('silencio');
        expect(decidirAdjunto({ botEncendido: true, tipo: 'personal', esStaffAdmin: false })).toBe('silencio');
    });

    it('dueña que también es familia sigue por staff-admin (no pierde el alta por foto)', () => {
        expect(decidirAdjunto({ botEncendido: true, tipo: 'familia', esStaffAdmin: true })).toBe('staff_admin');
    });

    it('marcado como personal manda sobre staff', () => {
        expect(decidirAdjunto({ botEncendido: true, tipo: 'personal', esStaffAdmin: true })).toBe('silencio');
    });
});

// ─── El recorrido ────────────────────────────────────────────────────────────

describe('runWhatsAppQueue — la puerta de atención', () => {
    it('bot apagado: no responde, no baja el archivo, no gasta OCR, fila ignored/bot_apagado', async () => {
        state.atencion = { atender: false, tipo: 'familia', botEncendido: false };

        await runWhatsAppQueue();

        expect(sendTextMessageMock).not.toHaveBeenCalled();
        expect(downloadMediaMock).not.toHaveBeenCalled();
        expect(extractReceiptMock).not.toHaveBeenCalled();
        expect(extractEnrollmentFormMock).not.toHaveBeenCalled();
        expect(ultimoCierre()).toMatchObject({ status: 'ignored', error_message: 'bot_apagado' });
    });

    it('bot apagado con un admin escribiendo: tampoco corre la rama staff-admin', async () => {
        state.atencion = { atender: false, tipo: 'staff', botEncendido: false };
        state.rpcStaffAdmin = { data: { estado: 'identificado', profile_id: 'staff-1' } };

        await runWhatsAppQueue();

        expect(sendTextMessageMock).not.toHaveBeenCalled();
        expect(extractReceiptMock).not.toHaveBeenCalled();
        expect(ultimoCierre()).toMatchObject({ status: 'ignored', error_message: 'bot_apagado' });
    });

    it('familia sin parent_id previo: se identifica por teléfono y NO se pide el correo', async () => {
        state.atencion = { atender: true, tipo: 'familia', botEncendido: true };
        state.rpcIdentifyByPhone = { data: { estado: 'identificado', parent_id: 'parent-9' } };

        await runWhatsAppQueue();

        expect(debeAtenderMock).toHaveBeenCalledWith(expect.anything(), 'conv-1', '573001234567');
        expect(extractReceiptMock).toHaveBeenCalled();
        expect(pagosPendientesDeMock).toHaveBeenCalledWith('parent-9', 'school-1');
        for (const t of textosEnviados()) expect(t).not.toMatch(/correo|código/i);
    });

    it('familia identificada por OTP (el teléfono no la resuelve): usa el parent_id de la conversación', async () => {
        state.conv = { data: { id: 'conv-1', parent_id: 'parent-otp', identified: true } };
        state.rpcIdentifyByPhone = { data: { estado: 'desconocido' } };

        await runWhatsAppQueue();

        expect(pagosPendientesDeMock).toHaveBeenCalledWith('parent-otp', 'school-1');
    });

    it('familia_sin_cuenta: mensaje de escalamiento una vez, sin OCR, sin pedir correo, fila escalated', async () => {
        state.atencion = { atender: true, tipo: 'familia_sin_cuenta', botEncendido: true };

        await runWhatsAppQueue();

        expect(sendTextMessageMock).toHaveBeenCalledTimes(1);
        const [texto] = textosEnviados();
        expect(texto).toMatch(/todavía no tienes tu cuenta creada/);
        expect(texto).toMatch(/escuela/);
        expect(texto).not.toMatch(/correo|código/i);
        expect(extractReceiptMock).not.toHaveBeenCalled();
        // El archivo SÍ se guarda: la escuela tiene que verlo para aplicarlo.
        expect(downloadMediaMock).toHaveBeenCalled();
        expect(pagosPendientesDeMock).not.toHaveBeenCalled();
        expect(ultimoCierre()).toMatchObject({ status: 'ignored', result_type: 'escalated', error_message: 'familia_sin_cuenta' });
    });

    it('familia_sin_cuenta con invitación pendiente: el mensaje trae SU enlace', async () => {
        state.atencion = { atender: true, tipo: 'familia_sin_cuenta', botEncendido: true };
        state.rpcInvitacion = { data: { invite_id: 'inv-1', email: 'mama@x.com' }, error: null };

        await runWhatsAppQueue();

        expect(textosEnviados()[0]).toContain('/register?invite=inv-1');
    });

    it('ambiguo: «más de una cuenta», escalated, sin pedir correo', async () => {
        state.atencion = { atender: true, tipo: 'ambiguo', botEncendido: true };

        await runWhatsAppQueue();

        const [texto] = textosEnviados();
        expect(texto).toMatch(/más de una cuenta/);
        expect(texto).not.toMatch(/correo|código/i);
        expect(extractReceiptMock).not.toHaveBeenCalled();
        expect(ultimoCierre()).toMatchObject({ status: 'ignored', result_type: 'escalated', error_message: 'numero_ambiguo' });
    });

    it.each(['desconocido', 'personal'])('%s: silencio, sin OCR, fila ignored/contacto_no_atendido', async (tipo) => {
        state.atencion = { atender: tipo === 'desconocido', tipo, botEncendido: true };

        await runWhatsAppQueue();

        expect(sendTextMessageMock).not.toHaveBeenCalled();
        expect(downloadMediaMock).not.toHaveBeenCalled();
        expect(extractReceiptMock).not.toHaveBeenCalled();
        expect(ultimoCierre()).toMatchObject({ status: 'ignored', error_message: 'contacto_no_atendido' });
    });

    it('staff con bot prendido: sigue la rama staff-admin', async () => {
        state.atencion = { atender: false, tipo: 'staff', botEncendido: true };
        extractReceiptMock.mockResolvedValue({ isReceipt: false, isTransactionList: false, provider: 'gemini' });
        extractEnrollmentFormMock.mockResolvedValue({ isEnrollmentForm: false });

        await runWhatsAppQueue();

        // Rama staff: después del comprobante prueba la hoja de matrícula.
        expect(extractEnrollmentFormMock).toHaveBeenCalled();
    });
});
