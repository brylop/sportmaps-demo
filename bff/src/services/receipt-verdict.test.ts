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
