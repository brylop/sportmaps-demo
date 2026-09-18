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

// Import DESPUÉS de los vi.mock — vitest hoistea los vi.mock, pero el import
// dinámico deja explícito el orden para quien lea el archivo.
const { runWhatsAppQueue } = await import('./whatsapp-queue.job');
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
