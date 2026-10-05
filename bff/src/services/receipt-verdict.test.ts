/**
 * Check 4 del veredicto (destino vs cuentas registradas), contra un caso REAL.
 *
 * 2026-09-22, CLUB DEPORTIVO BESSER: la pantalla "Transferencia exitosa" de
 * Davivienda mostró el destino como "**** 6942". La cuenta registrada de la
 * escuela es 478170006942. La comparación exacta daba DESTINO_NO_COINCIDE (rojo)
 * y la acudiente no pudo subir un comprobante legítimo de $210.000.
 */
import { describe, it, expect } from 'vitest';
import type { OcrResult } from './ocr.service';
import {
    evaluateVerdict,
    normalizeDestination,
    maskedDestinationSuffix,
    destinationMatchesRegistered,
} from './receipt-verdict';

const BESSER_DAVIVIENDA = normalizeDestination('478170006942')!;
const TODAY = '2026-09-22';

function comprobante(over: Partial<OcrResult> = {}): OcrResult {
    return {
        amount: 210000,
        currency: 'COP',
        date: TODAY,
        time: '13:23',
        bank: 'Davivienda',
        reference: '233901',
        destination: '**** 6942',
        destinationName: 'CLU**** BES****',
        originName: 'LAU**** PAR****',
        isReceipt: true,
        isTransactionList: false,
        missingFields: [],
        provider: 'test',
        ...over,
    };
}

function codigos(ocr: OcrResult, accounts: string[]) {
    return evaluateVerdict(ocr, {
        today: TODAY,
        expectedAmount: 210000,
        registeredAccounts: accounts,
    }).reasons.map((r) => r.code);
}

describe('maskedDestinationSuffix', () => {
    it('extrae los dígitos visibles cuando el banco enmascaró la cuenta', () => {
        expect(maskedDestinationSuffix(normalizeDestination('**** 6942'))).toBe('6942');
        expect(maskedDestinationSuffix(normalizeDestination('XXXX-6942'))).toBe('6942');
        expect(maskedDestinationSuffix(normalizeDestination('•••• 006942'))).toBe('006942');
        expect(maskedDestinationSuffix(normalizeDestination('Cuenta de ahorros **** 6942'))).toBe('6942');
    });

    it('NO trata como máscara un número corto sin asteriscos (puede ser OCR truncado)', () => {
        expect(maskedDestinationSuffix('6942')).toBeNull();
        expect(maskedDestinationSuffix(BESSER_DAVIVIENDA)).toBeNull();
    });

    it('exige al menos 4 dígitos visibles', () => {
        expect(maskedDestinationSuffix('****42')).toBeNull();
    });
});

describe('destinationMatchesRegistered', () => {
    it('igualdad exacta sigue valiendo', () => {
        expect(destinationMatchesRegistered(BESSER_DAVIVIENDA, [BESSER_DAVIVIENDA])).toBe(true);
    });

    it('destino enmascarado coincide si una cuenta registrada termina en los dígitos visibles', () => {
        expect(destinationMatchesRegistered(normalizeDestination('**** 6942'), [BESSER_DAVIVIENDA])).toBe(true);
    });

    it('destino enmascarado a OTRA cuenta no coincide', () => {
        expect(destinationMatchesRegistered(normalizeDestination('**** 1234'), [BESSER_DAVIVIENDA])).toBe(false);
    });

    it('no acepta un sufijo igual de largo que la cuenta (eso es igualdad, no máscara)', () => {
        expect(destinationMatchesRegistered('****6942', ['6942'])).toBe(false);
    });

    it('sin cuentas registradas no hay con qué cruzar', () => {
        expect(destinationMatchesRegistered('****6942', [])).toBe(false);
    });
});

describe('evaluateVerdict · check 4 con el comprobante real de Besser', () => {
    it('el comprobante Davivienda con "**** 6942" ya NO cae en DESTINO_NO_COINCIDE', () => {
        const r = evaluateVerdict(comprobante(), {
            today: TODAY,
            expectedAmount: 210000,
            registeredAccounts: [BESSER_DAVIVIENDA],
        });
        expect(r.reasons.map((x) => x.code)).not.toContain('DESTINO_NO_COINCIDE');
        expect(r.verdict).toBe('verde');
    });

    it('un envío enmascarado a otra cuenta sigue siendo rojo', () => {
        expect(codigos(comprobante({ destination: '**** 1234' }), [BESSER_DAVIVIENDA])).toContain('DESTINO_NO_COINCIDE');
    });

    it('la cuenta completa sigue pasando como antes', () => {
        expect(codigos(comprobante({ destination: '478170006942' }), [BESSER_DAVIVIENDA])).not.toContain('DESTINO_NO_COINCIDE');
    });

    it('el nombre del titular no interviene: con destino correcto, un nombre raro no bloquea', () => {
        expect(
            codigos(comprobante({ destination: '**** 6942', destinationName: 'OTRO NOMBRE' }), [BESSER_DAVIVIENDA]),
        ).not.toContain('DESTINO_NO_COINCIDE');
    });

    it('sin cuentas registradas el check 4 no se evalúa', () => {
        expect(codigos(comprobante({ destination: '**** 1234' }), [])).not.toContain('DESTINO_NO_COINCIDE');
    });
});

/**
 * Llaves restringidas a un concepto (payment_accounts[].only_for).
 *
 * Dynasty, 2026-10-05: el Nequi 320 429 8969 es de la dueña y SOLO recibe
 * inscripciones. Para una mensualidad el dinero sí llegó a la escuela, pero por
 * el canal de otro concepto: amarillo (revisión), nunca rojo — rechazarlo haría
 * que la familia pagara dos veces. Caso real del 2026-09-03: mensualidad de
 * septiembre pagada a ese Nequi, que la escuela terminó aprobando a mano.
 */
describe('check 4 con llaves restringidas a un concepto', () => {
    const DYNASTY_BREB = normalizeDestination('0092231411')!;
    const NEQUI_INSCRIPCIONES = normalizeDestination('320 429 8969')!;
    const base = { today: TODAY, expectedAmount: 210000 };

    it('mensualidad pagada al Nequi de inscripciones → amarillo con el motivo, no rojo', () => {
        const r = evaluateVerdict(comprobante({ destination: '320 429 8969' }), {
            ...base,
            registeredAccounts: [DYNASTY_BREB],
            restrictedAccounts: [{ value: NEQUI_INSCRIPCIONES, onlyFor: ['inscripcion'] }],
            paymentCategory: 'mensualidad',
        });
        const motivo = r.reasons.find((x) => x.code === 'DESTINO_NO_COINCIDE');
        expect(motivo?.level).toBe('amarillo');
        expect(motivo?.message).toContain('inscripciones');
        expect(motivo?.detail).toMatchObject({ cuentaRestringida: true, soloPara: ['inscripcion'], categoriaDelCobro: 'mensualidad' });
        expect(r.verdict).not.toBe('rojo');
    });

    it('inscripción al mismo Nequi (el caller ya la puso en registeredAccounts) → sin motivo de destino', () => {
        const r = evaluateVerdict(comprobante({ destination: '3204298969' }), {
            ...base,
            registeredAccounts: [DYNASTY_BREB, NEQUI_INSCRIPCIONES],
            restrictedAccounts: [],
            paymentCategory: 'inscripcion',
        });
        expect(r.reasons.map((x) => x.code)).not.toContain('DESTINO_NO_COINCIDE');
    });

    it('un destino que no es de la escuela sigue siendo rojo aunque haya llaves restringidas', () => {
        const r = evaluateVerdict(comprobante({ destination: '3001112233' }), {
            ...base,
            registeredAccounts: [DYNASTY_BREB],
            restrictedAccounts: [{ value: NEQUI_INSCRIPCIONES, onlyFor: ['inscripcion'] }],
        });
        const motivo = r.reasons.find((x) => x.code === 'DESTINO_NO_COINCIDE');
        expect(motivo?.level).toBe('rojo');
        expect(r.verdict).toBe('rojo');
    });

    it('con solo llaves restringidas cargadas el check 4 igual se evalúa', () => {
        const r = evaluateVerdict(comprobante({ destination: '3001112233' }), {
            ...base,
            registeredAccounts: [],
            restrictedAccounts: [{ value: NEQUI_INSCRIPCIONES, onlyFor: ['inscripcion'] }],
        });
        expect(r.reasons.find((x) => x.code === 'DESTINO_NO_COINCIDE')?.level).toBe('rojo');
    });
});
