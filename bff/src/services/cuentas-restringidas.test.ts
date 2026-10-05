/**
 * Llave restringida a inscripciones, de punta a punta en el BFF (Dynasty, 2026-10-05):
 *  - el contexto del verificador la separa según la categoría del cobro, y
 *  - el bot de WhatsApp nunca la ofrece cuando no sabe qué se va a pagar.
 *
 * La configuración es la real de Dynasty (school_settings leído el 2026-10-05)
 * más el Nequi que agrega aplicar_config_dynasty_2026-10-05.sql.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const SETTINGS = {
    receipt_date_window_days: 8,
    bank_account_number: '80600003578',
    nequi_number: null as string | null,
    breb_key: '0089455111',
    breb_number: '0092231411',
    transfer_key: null,
    daviplata_number: null,
    bank_name: 'bancolombia',
    bank_account_holder: null,
    bank_titular_name: 'DYNASTY VOLLEY CLUB',
    payment_accounts: [
        { id: 'c4e8', type: 'breb', label: 'Bre-B', value: '0092231411', active: true },
        { id: '9c70', type: 'breb', label: 'Bre-B', value: '0089455111', active: true },
        { id: '04b1', type: 'breb', label: 'Bre-B', value: '0090399230', active: true },
        { id: 'nequi-insc', type: 'nequi', label: 'Nequi inscripciones', value: '3204298969', active: true, only_for: ['inscripcion'] },
    ],
};

const estado: { pago: { payment_category: string | null; concept: string | null } | null } = { pago: null };

function builder(table: string) {
    const result = () => {
        if (table === 'school_settings') return { data: SETTINGS, error: null };
        if (table === 'payments') return { data: estado.pago, error: null };
        return { data: null, error: null };
    };
    const b: any = {
        select: () => b, eq: () => b, neq: () => b, not: () => b, in: () => b,
        single: async () => result(),
        maybeSingle: async () => result(),
        limit: async () => ({ data: [], error: null }),
    };
    return b;
}

vi.mock('../config/supabase', () => ({ supabase: { from: (t: string) => builder(t) } }));

import { buildVerdictContext } from './receipt-context.service';
import { mediosDePago } from './whatsapp-medios-de-pago.service';

beforeEach(() => {
    estado.pago = null;
    SETTINGS.nequi_number = null;
});

describe('buildVerdictContext con una llave solo para inscripciones', () => {
    it('cobro de mensualidad: el Nequi va a restringidas, no a registradas', async () => {
        estado.pago = { payment_category: 'mensualidad', concept: 'Mensualidad 10/2026 - X' };
        const ctx = await buildVerdictContext('dynasty', { referenceNorm: null, imageSha256: null, paymentId: 'p1' });
        expect(ctx.registeredAccounts).not.toContain('3204298969');
        expect(ctx.restrictedAccounts).toEqual([{ value: '3204298969', onlyFor: ['inscripcion'] }]);
        expect(ctx.paymentCategory).toBe('mensualidad');
        expect(ctx.registeredAccounts).toEqual(
            expect.arrayContaining(['80600003578', '0089455111', '0092231411', '0090399230']),
        );
    });

    it('cobro de inscripción (por concepto): el Nequi es destino válido', async () => {
        estado.pago = { payment_category: null, concept: 'Inscripción Anual' };
        const ctx = await buildVerdictContext('dynasty', { referenceNorm: null, imageSha256: null, paymentId: 'p2' });
        expect(ctx.registeredAccounts).toContain('3204298969');
        expect(ctx.restrictedAccounts).toEqual([]);
    });

    it('la categoría que pasa el caller gana sobre leer el pago', async () => {
        const ctx = await buildVerdictContext('dynasty', { referenceNorm: null, imageSha256: null, paymentCategory: 'inscripcion' });
        expect(ctx.registeredAccounts).toContain('3204298969');
    });

    it('sin cobro conocido el Nequi queda restringido (amarillo, nunca verde)', async () => {
        const ctx = await buildVerdictContext('dynasty', { referenceNorm: null, imageSha256: null });
        expect(ctx.registeredAccounts).not.toContain('3204298969');
        expect(ctx.restrictedAccounts?.map((r) => r.value)).toEqual(['3204298969']);
    });

    it('si una columna suelta espeja la llave restringida, no la vuelve general', async () => {
        SETTINGS.nequi_number = '320 429 8969';
        estado.pago = { payment_category: 'mensualidad', concept: null };
        const ctx = await buildVerdictContext('dynasty', { referenceNorm: null, imageSha256: null, paymentId: 'p3' });
        expect(ctx.registeredAccounts).not.toContain('3204298969');
    });
});

describe('mediosDePago (bot de WhatsApp y página del cobro)', () => {
    it('el bot (sin categoría) NO ofrece el Nequi de inscripciones', async () => {
        const m = await mediosDePago('dynasty');
        const numeros = m.cuentas.map((c) => c.numero.replace(/\s/g, ''));
        expect(numeros).not.toContain('3204298969');
        // Y ahora sí entrega las llaves de la lista (antes leía `number`, que no existe).
        expect(numeros).toEqual(expect.arrayContaining(['0092231411', '0089455111', '0090399230', '80600003578']));
    });

    it('tampoco lo ofrece para una mensualidad', async () => {
        const m = await mediosDePago('dynasty', { categoria: 'mensualidad' });
        expect(m.cuentas.map((c) => c.numero)).not.toContain('3204298969');
    });

    it('aunque una columna suelta lo espeje, no se cuela', async () => {
        SETTINGS.nequi_number = '3204298969';
        const m = await mediosDePago('dynasty');
        expect(m.cuentas.map((c) => c.numero)).not.toContain('3204298969');
    });

    it('para el cobro de una inscripción sí lo muestra', async () => {
        const m = await mediosDePago('dynasty', { categoria: 'inscripcion' });
        expect(m.cuentas.map((c) => c.numero)).toContain('3204298969');
    });

    it('sin duplicados: el Bre-B que también está en columnas sueltas sale una vez', async () => {
        const m = await mediosDePago('dynasty');
        expect(m.cuentas.filter((c) => c.numero === '0092231411')).toHaveLength(1);
    });
});
