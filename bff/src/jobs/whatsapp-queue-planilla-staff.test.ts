/**
 * Foto de PLANILLA DE ASISTENCIA de un entrenador en la cola de WhatsApp
 * (spec conversación v2 §3.8, camino 1) y el humo del lado de la cola:
 *
 *  - el coach manda la foto de la planilla → resumen con botones, fila cerrada
 *    done / result_type 'none' / result_ref_id = el intake (el CHECK
 *    chk_wa_queue_result no admite valores nuevos);
 *  - con el asistente APAGADO el coach igual recibe su resumen;
 *  - staff que manda un COMPROBANTE → sigue el flujo de pagos (no se secuestra y
 *    no se gasta el OCR de planillas);
 *  - la foto que no es planilla ni comprobante sigue a la matrícula, sin repetir
 *    la lectura de comprobantes;
 *  - quien no es staff no cuesta nada: ni descarga extra ni OCR de planillas.
 *
 * Todo con mocks (supabase, OCR, envío, servicio de asistencia): nada real.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const state = {
    conv: { data: { id: 'conv-1', parent_id: null, identified: false } as any },
    rpcStaffAdmin: { data: { estado: 'desconocido' } as any },
    rpcIdentifyByPhone: { data: { estado: 'desconocido' } as any },
    rpcInvitacion: { data: null as any },
    atencion: { atender: true, tipo: 'familia', botEncendido: true } as any,
    /** Mensajes entrantes de la familia alrededor del adjunto. */
    mensajes: [] as { text_body: string | null }[],
    /** Lo que devuelve invitacionPendienteVigente. */
    vigente: { invitacion: null, atletaInactivo: false } as any,
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
        lte: () => chain,
        ilike: () => chain,
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
            if (table === 'whatsapp_messages') {
                // Entrantes = los textos de la familia; salientes (anti-repetición) = nada.
                const result = { data: state.mensajes as any[], error: null };
                const chain = makeChain(result, table);
                chain.eq = (col: string, val: any) => {
                    if (col === 'direction' && val === 'outbound') result.data = [];
                    return chain;
                };
                return chain;
            }
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

const invitacionPendienteVigenteMock = vi.fn((..._a: any[]) => Promise.resolve(state.vigente));
vi.mock('../services/whatsapp-invitacion-vigente.service', () => ({
    invitacionPendienteVigente: (...a: any[]) => invitacionPendienteVigenteMock(...a),
}));

const staffSvc = {
    identificar: vi.fn((..._a: any[]) => Promise.resolve({ resultado: 'no_staff' } as any)),
    recibir: vi.fn((..._a: any[]) => Promise.resolve({ estado: 'no_aplica', texto: '' } as any)),
};
vi.mock('../services/whatsapp-asistencia-staff.service', () => ({
    identificarStaffPorTelefono: (...a: any[]) => staffSvc.identificar(...a),
    recibirPlanillaDeStaff: (...a: any[]) => staffSvc.recibir(...a),
}));
const enviarStaffMock = vi.fn((..._a: any[]) => Promise.resolve({ ok: true }));
const abrirConsultaMock = vi.fn((..._a: any[]) => Promise.resolve());
vi.mock('../services/whatsapp-bot.service', () => ({
    abrirConsultaParaLaEscuela: (...a: any[]) => abrirConsultaMock(...a),
    enviarRespuestaStaff: (...a: any[]) => enviarStaffMock(...a),
    ofrecerConsentimientoSiFalta: vi.fn(() => Promise.resolve()),
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

const { runWhatsAppQueue } = await import('./whatsapp-queue.job');

const COMPROBANTE = {
    isReceipt: true, isTransactionList: false, amount: 150000, destination: null,
    reference: 'REF9', bank: 'Bancolombia', date: '2026-10-03', provider: 'gemini',
};
const NO_ES_COMPROBANTE = { isReceipt: false, isTransactionList: false, provider: 'gemini' };
const COACH = { resultado: 'staff', profileId: 'coach-1', role: 'coach', schoolId: 'school-1' };

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
    state.mensajes = [];
    state.vigente = { invitacion: null, atletaInactivo: false };
    // El coach no es acudiente ni admin: para el asistente es «desconocido».
    state.atencion = { atender: true, tipo: 'desconocido', botEncendido: true };
    staffSvc.identificar.mockResolvedValue(COACH);
    staffSvc.recibir.mockResolvedValue({ estado: 'no_aplica', texto: '' });
    extractReceiptMock.mockResolvedValue(NO_ES_COMPROBANTE);
    resolverPagoMock.mockReturnValue({ tipo: 'sin_pendientes' });
    pagosPendientesDeMock.mockResolvedValue([]);
});

const RESUMEN = {
    estado: 'resumen', intakeId: 'intake-1', texto: 'Intermedio, 22-oct: 14 presentes, 3 sin marca.',
    botones: [
        { id: 'asis_guardar:intake-1', title: 'Guardar' },
        { id: 'asis_corregir:intake-1', title: 'Corregir' },
        { id: 'asis_descartar:intake-1', title: 'Descartar' },
    ],
};

describe('runWhatsAppQueue — planilla de asistencia del equipo', () => {
    it('coach manda la foto de la planilla: resumen con botones y fila done/none con el intake', async () => {
        staffSvc.recibir.mockResolvedValue(RESUMEN);

        await runWhatsAppQueue();

        // §4.1: primero el comprobante, después la planilla.
        expect(extractReceiptMock).toHaveBeenCalledTimes(1);
        expect(staffSvc.recibir).toHaveBeenCalledTimes(1);
        expect(staffSvc.recibir.mock.calls[0][0]).toMatchObject({ waId: '573001234567', queueId: 'fila-1', source: 'whatsapp' });
        expect(enviarStaffMock).toHaveBeenCalledTimes(1);
        const [, conv, waId, r] = enviarStaffMock.mock.calls[0];
        expect(conv).toBe('conv-1');
        expect(waId).toBe('573001234567');
        expect(r.botones.map((b: any) => b.id)).toEqual(['asis_guardar:intake-1', 'asis_corregir:intake-1', 'asis_descartar:intake-1']);
        // Nada del flujo de pagos ni de matrícula.
        expect(extractEnrollmentFormMock).not.toHaveBeenCalled();
        expect(pagosPendientesDeMock).not.toHaveBeenCalled();
        expect(sendTextMessageMock).not.toHaveBeenCalled();
        expect(ultimoCierre()).toMatchObject({ status: 'done', result_type: 'none', result_ref_id: 'intake-1' });
    });

    it('con el asistente APAGADO el coach igual recibe su resumen', async () => {
        state.atencion = { atender: false, tipo: 'desconocido', botEncendido: false };
        staffSvc.recibir.mockResolvedValue(RESUMEN);

        await runWhatsAppQueue();

        expect(enviarStaffMock).toHaveBeenCalledTimes(1);
        expect(ultimoCierre()).toMatchObject({ status: 'done', result_type: 'none', result_ref_id: 'intake-1' });
    });

    it('conversación tomada por una persona: el resumen al coach sale igual', async () => {
        state.atencion = { atender: false, tipo: 'desconocido', botEncendido: true, tomada: true };
        staffSvc.recibir.mockResolvedValue(RESUMEN);

        await runWhatsAppQueue();

        expect(enviarStaffMock).toHaveBeenCalledTimes(1);
    });

    it('staff que manda un COMPROBANTE sigue el flujo de pagos (sin OCR de planillas ni secuestro)', async () => {
        state.atencion = { atender: false, tipo: 'staff', botEncendido: true };
        state.rpcStaffAdmin = { data: { estado: 'identificado', profile_id: 'admin-1' } };
        state.rpcIdentifyByPhone = { data: { estado: 'identificado', parent_id: 'parent-9' } };
        extractReceiptMock.mockResolvedValue(COMPROBANTE);

        await runWhatsAppQueue();

        expect(staffSvc.recibir).not.toHaveBeenCalled();
        expect(enviarStaffMock).not.toHaveBeenCalled();
        // La rama staff-admin aplica el comprobante como acudiente (no pierde el camino de pagos).
        expect(pagosPendientesDeMock).toHaveBeenCalledWith('parent-9', 'school-1');
        // La lectura de comprobantes de la rama de planillas se reutiliza: una sola.
        expect(extractReceiptMock).toHaveBeenCalledTimes(1);
    });

    it('si el texto cercano habla de pago no se intenta la planilla (es un comprobante)', async () => {
        state.mensajes = [{ text_body: 'Hola, envío el comprobante de pago de la mensualidad' }];
        state.atencion = { atender: false, tipo: 'staff', botEncendido: true };
        state.rpcStaffAdmin = { data: { estado: 'identificado', profile_id: 'admin-1' } };
        extractReceiptMock.mockResolvedValue(COMPROBANTE);

        await runWhatsAppQueue();

        expect(staffSvc.recibir).not.toHaveBeenCalled();
        expect(extractReceiptMock).toHaveBeenCalledTimes(1);
    });

    it('foto de staff que no es planilla ni comprobante sigue a la matrícula sin repetir la lectura de comprobantes', async () => {
        state.atencion = { atender: false, tipo: 'staff', botEncendido: true };
        state.rpcStaffAdmin = { data: { estado: 'identificado', profile_id: 'admin-1' } };
        extractEnrollmentFormMock.mockResolvedValue({ isEnrollmentForm: false });

        await runWhatsAppQueue();

        expect(staffSvc.recibir).toHaveBeenCalledTimes(1);     // intentó la planilla: no_aplica
        expect(extractReceiptMock).toHaveBeenCalledTimes(1);   // una sola lectura de comprobantes
        expect(extractEnrollmentFormMock).toHaveBeenCalledTimes(1);
        expect(enviarStaffMock).not.toHaveBeenCalled();
    });

    it('quien NO es staff (familia): sin OCR de planillas, el comprobante sigue su camino', async () => {
        staffSvc.identificar.mockResolvedValue({ resultado: 'no_staff' });
        state.atencion = { atender: true, tipo: 'familia', botEncendido: true };
        state.rpcIdentifyByPhone = { data: { estado: 'identificado', parent_id: 'parent-9' } };
        extractReceiptMock.mockResolvedValue(COMPROBANTE);

        await runWhatsAppQueue();

        expect(staffSvc.recibir).not.toHaveBeenCalled();
        expect(extractReceiptMock).toHaveBeenCalledTimes(1);
        expect(pagosPendientesDeMock).toHaveBeenCalledWith('parent-9', 'school-1');
    });

    it('contacto marcado personal/negocio: no se identifica ni se lee como planilla', async () => {
        state.atencion = { atender: false, tipo: 'personal', botEncendido: true };

        await runWhatsAppQueue();

        expect(staffSvc.identificar).not.toHaveBeenCalled();
        expect(staffSvc.recibir).not.toHaveBeenCalled();
    });

    it('el OCR de planillas con error: el coach recibe el aviso y la fila queda done (sin reintento ciego)', async () => {
        staffSvc.recibir.mockResolvedValue({ estado: 'error', texto: 'No pude leer la planilla en este momento.' });

        await runWhatsAppQueue();

        expect(enviarStaffMock).toHaveBeenCalledTimes(1);
        expect(ultimoCierre()).toMatchObject({ status: 'done', result_type: 'none', error_message: 'planilla_asistencia: error' });
        expect(textosEnviados()).toEqual([]);
    });
});
