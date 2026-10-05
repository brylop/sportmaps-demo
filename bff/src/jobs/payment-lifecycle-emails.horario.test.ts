/**
 * Avisos de cobro y de vencido dentro del horario de cobranza (Ley 2300 de 2023).
 * Con auto_generate_payments el cron abre el mes a las 01:30 COT del día 1 y el
 * tick de las 01:45 mandaba el correo de respaldo de madrugada.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { from } = vi.hoisted(() => ({
    from: vi.fn((_table: string) => {
        const b: any = {};
        b.select = () => b;
        b.is = () => b;
        b.in = async () => ({ data: [], error: null });
        b.eq = () => Promise.resolve({ data: [], error: null });
        return b;
    }),
}));
vi.mock('../config/supabase', () => ({ supabase: { from } }));
vi.mock('../utils/emailClient', () => ({ emailClient: { send: vi.fn() } }));
vi.mock('../utils/emailTemplates', () => ({ BrandedEmailTemplates: {} }));
vi.mock('../services/duplicatePayerGuard.service', () => ({ findDuplicatePaymentIds: vi.fn(async () => []) }));
vi.mock('../services/cobro-enlace-publico.service', () => ({ emitirTokenCobro: vi.fn(async () => null) }));

import { sendChargeCreatedEmails, sendOverdueNoticeEmails, puedeAvisarCobranzaAhora } from './payment-lifecycle-emails.job';

// Bogotá = UTC-5.
const DOMINGO_1_NOV_0145_COT = new Date('2026-11-01T06:45:00Z');
const LUNES_FESTIVO_2_NOV_0900_COT = new Date('2026-11-02T14:00:00Z');
const MARTES_3_NOV_0700_COT = new Date('2026-11-03T12:00:00Z');
const SABADO_10_OCT_0715_COT = new Date('2026-10-10T12:15:00Z');

beforeEach(() => from.mockClear());

describe('horario de cobranza en los avisos del ciclo de cobro', () => {
    it('madrugada de domingo, festivo y sábado antes de las 8: fuera; martes 7:00: dentro', () => {
        expect(puedeAvisarCobranzaAhora(DOMINGO_1_NOV_0145_COT)).toBe(false);
        expect(puedeAvisarCobranzaAhora(LUNES_FESTIVO_2_NOV_0900_COT)).toBe(false);
        expect(puedeAvisarCobranzaAhora(SABADO_10_OCT_0715_COT)).toBe(false);
        expect(puedeAvisarCobranzaAhora(MARTES_3_NOV_0700_COT)).toBe(true);
    });

    it('fuera de horario no toca la base: no reclama ni envía nada', async () => {
        expect(await sendChargeCreatedEmails(DOMINGO_1_NOV_0145_COT)).toEqual({ sent: 0, whatsapp: 0 });
        expect(await sendOverdueNoticeEmails(LUNES_FESTIVO_2_NOV_0900_COT)).toEqual({ sent: 0, whatsapp: 0 });
        expect(from).not.toHaveBeenCalled();
    });

    it('dentro de horario sí consulta las escuelas habilitadas', async () => {
        await sendChargeCreatedEmails(MARTES_3_NOV_0700_COT);
        expect(from).toHaveBeenCalledWith('school_settings');
    });
});
