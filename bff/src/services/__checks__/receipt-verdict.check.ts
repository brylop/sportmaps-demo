/**
 * Verificación ejecutable de receipt-verdict (no framework — corre con ts-node).
 *   npx ts-node src/services/__checks__/receipt-verdict.check.ts
 *
 * Cubre los criterios de aceptación testeables de la spec §7 (#9, #5, #6, #1/#2,
 * ordenamiento verde/amarillo/rojo) y el normalizador de referencia.
 */
import assert from 'node:assert';
import type { OcrResult } from '../ocr.service';
import { evaluateVerdict, normalizeReference, clasificarReferencia } from '../receipt-verdict';

const TODAY = '2026-07-17';

/** OcrResult limpio por defecto (comprobante Nequi válido, hoy). */
function ocr(overrides: Partial<OcrResult> = {}): OcrResult {
    return {
        amount: 150000,
        currency: 'COP',
        date: TODAY,
        time: '10:30',
        bank: 'Nequi',
        reference: 'M09743655',
        destination: '3001234567',
        destinationName: 'ESCUELA FC',
        originName: 'PAPA PEREZ',
        isReceipt: true,
        isTransactionList: false,
        missingFields: [],
        provider: 'test',
        ...overrides,
    };
}

let passed = 0;
function check(name: string, fn: () => void) {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
}

console.log('receipt-verdict checks:');

// #9 — referencia Nequi "M09743655" pasa el check de formato.
check('#9 Nequi "M09743655" matchea patrón (sin FORMATO_REFERENCIA)', () => {
    assert.ok(clasificarReferencia('M09743655').ok);
    const r = evaluateVerdict(ocr(), { today: TODAY, expectedAmount: 150000 });
    assert.equal(r.verdict, 'verde', `esperaba verde, dio ${r.verdict}: ${JSON.stringify(r.reasons)}`);
    assert.ok(!r.reasons.some((x) => x.code === 'FORMATO_REFERENCIA'));
});

// Calibración 2026-09-11: formas tomadas de comprobantes reales de la base.
// Si alguna de estas vuelve a fallar, volvimos a glosar comprobantes buenos.
check('#9 las formas reales observadas se reconocen', () => {
    const reales: [string, string][] = [
        ['M00944183', 'app_nequi'],                                   // 86 casos
        ['M1338970', 'app_nequi'],                                    // letra + 7 dígitos
        ['TRcjXnMoooEC', 'breb_trec'],                                // Bre-B / Transfiya
        ['10007461150366217313585571635943677', 'riel_largo'],        // 35 dígitos del riel
        ['1d88d01d-01d1-4ca1-8f13-c399ecf44007', 'uuid'],             // Davivienda
        ['1d0078924bf1', 'hex12'],
        ['93LDJV4LNT', 'codigo10'],
        ['APIU6249326017491581', 'apiu'],
        ['11494938', 'numerico'],
        ['178550921349762', 'numerico'],
        ['20260803901383474SRV001785778599258', 'mixto_srv'],
    ];
    for (const [ref, forma] of reales) {
        const c = clasificarReferencia(ref);
        assert.ok(c.ok, `"${ref}" deberia reconocerse y dio ${JSON.stringify(c)}`);
        assert.equal(c.forma, forma, `"${ref}" clasifico como ${c.forma}, esperaba ${forma}`);
    }
});

// Lo único que sigue siendo problema: lectura cortada y número imposible.
check('#9 el UUID truncado se marca como lectura cortada, no como otro formato', () => {
    const c = clasificarReferencia('0e8b59a0-ee8f-4a59-adb5-0069bf556'); // 33, deberian ser 36
    assert.ok(!c.ok);
    assert.equal(c.problema, 'truncada');
});

check('#9 una referencia de 4 caracteres es implausible', () => {
    const c = clasificarReferencia('0543');
    assert.ok(!c.ok);
    assert.equal(c.problema, 'muy_corta');
});

// El cambio de fondo: desconocido ya NO es glosa.
check('#9 un formato desconocido pero plausible NO genera FORMATO_REFERENCIA', () => {
    const c = clasificarReferencia('ZX-9981-QQ-4417-BB');
    assert.ok(!c.ok);
    assert.equal(c.problema, 'desconocida');
    const r = evaluateVerdict(ocr({ reference: 'ZX-9981-QQ-4417-BB' }), { today: TODAY, expectedAmount: 150000 });
    assert.ok(
        !r.reasons.some((x) => x.code === 'FORMATO_REFERENCIA'),
        `un formato nuevo no es evidencia de nada: ${JSON.stringify(r.reasons)}`,
    );
});

// El banco declarado no debe decidir: Bancolombia con referencia forma Bre-B.
check('#9 el banco declarado no cambia el resultado', () => {
    const r = evaluateVerdict(
        ocr({ bank: 'Bancolombia', reference: 'TRMgzmmFhKEC' }),
        { today: TODAY, expectedAmount: 150000 },
    );
    assert.ok(
        !r.reasons.some((x) => x.code === 'FORMATO_REFERENCIA'),
        `medido en la base: Bancolombia trae referencias forma Bre-B: ${JSON.stringify(r.reasons)}`,
    );
});

// Caso limpio → VERDE.
check('caso limpio → verde', () => {
    const r = evaluateVerdict(ocr(), {
        today: TODAY,
        expectedAmount: 150000,
        registeredAccounts: ['3001234567'],
    });
    assert.equal(r.verdict, 'verde');
    assert.equal(r.reasons.length, 0);
});

// #2 acceptance — monto difiere → AMARILLO MONTO_DIFIERE con detail {expected, extracted}.
check('#2 monto 130000 vs 150000 → amarillo MONTO_DIFIERE con detail', () => {
    const r = evaluateVerdict(ocr({ amount: 130000 }), {
        today: TODAY,
        expectedAmount: 150000,
    });
    assert.equal(r.verdict, 'amarillo');
    const m = r.reasons.find((x) => x.code === 'MONTO_DIFIERE');
    assert.ok(m, 'falta razón MONTO_DIFIERE');
    assert.deepEqual(m!.detail, { expected: 150000, extracted: 130000 });
});

// Check 6 — fecha futura → ROJO.
check('fecha futura → rojo FECHA_FUTURA', () => {
    const r = evaluateVerdict(ocr({ date: '2026-07-20' }), { today: TODAY });
    assert.equal(r.verdict, 'rojo');
    assert.ok(r.reasons.some((x) => x.code === 'FECHA_FUTURA' && x.level === 'rojo'));
});

// Check 6 — fecha vieja fuera de ventana (default 5) → AMARILLO.
check('fecha de hace 10 días (ventana 5) → amarillo FECHA_FUERA_VENTANA', () => {
    const r = evaluateVerdict(ocr({ date: '2026-07-07' }), { today: TODAY });
    assert.ok(r.reasons.some((x) => x.code === 'FECHA_FUERA_VENTANA' && x.level === 'amarillo'));
});

// Check 6 — dentro de ventana → sin razón de fecha.
check('fecha de hace 3 días (ventana 5) → sin razón de fecha', () => {
    const r = evaluateVerdict(ocr({ date: '2026-07-14' }), { today: TODAY, expectedAmount: 150000 });
    assert.ok(!r.reasons.some((x) => x.check === 6));
});

// #1/#2 — no es comprobante / lista de movimientos → ROJO.
check('is_receipt=false → rojo NOT_A_RECEIPT', () => {
    const r = evaluateVerdict(ocr({ isReceipt: false }), { today: TODAY });
    assert.equal(r.verdict, 'rojo');
    assert.ok(r.reasons.some((x) => x.code === 'NOT_A_RECEIPT'));
});
check('is_transaction_list=true → rojo IS_TRANSACTION_LIST', () => {
    const r = evaluateVerdict(ocr({ isTransactionList: true }), { today: TODAY });
    assert.equal(r.verdict, 'rojo');
    assert.ok(r.reasons.some((x) => x.code === 'IS_TRANSACTION_LIST'));
});

// Check 3 — missing_fields con campo crítico → AMARILLO.
check('missing_fields incluye reference → amarillo CAMPOS_ILEGIBLES', () => {
    const r = evaluateVerdict(ocr({ reference: null, missingFields: ['reference'] }), { today: TODAY });
    assert.ok(r.reasons.some((x) => x.code === 'CAMPOS_ILEGIBLES'));
});

// Check 4 — destino no coincide → ROJO.
check('destino no registrado → rojo DESTINO_NO_COINCIDE', () => {
    const r = evaluateVerdict(ocr({ destination: '3009999999' }), {
        today: TODAY,
        registeredAccounts: ['3001234567'],
    });
    assert.equal(r.verdict, 'rojo');
    assert.ok(r.reasons.some((x) => x.code === 'DESTINO_NO_COINCIDE'));
});

// Check 4 — sin cuentas registradas → NO se evalúa (modo sombra sin cuentas).
check('sin cuentas registradas → no evalúa destino', () => {
    const r = evaluateVerdict(ocr({ destination: '3009999999' }), { today: TODAY });
    assert.ok(!r.reasons.some((x) => x.check === 4));
});

// Checks 7/8 — dedup por BD → ROJO.
check('referenceAlreadyUsed → rojo REFERENCIA_DUPLICADA', () => {
    const r = evaluateVerdict(ocr(), { today: TODAY, expectedAmount: 150000, referenceAlreadyUsed: true });
    assert.equal(r.verdict, 'rojo');
    assert.ok(r.reasons.some((x) => x.code === 'REFERENCIA_DUPLICADA'));
});
check('imageHashDuplicate → rojo IMAGEN_DUPLICADA', () => {
    const r = evaluateVerdict(ocr(), { today: TODAY, expectedAmount: 150000, imageHashDuplicate: true });
    assert.equal(r.verdict, 'rojo');
    assert.ok(r.reasons.some((x) => x.code === 'IMAGEN_DUPLICADA'));
});

// Ordenamiento — rojo domina a amarillo cuando coexisten.
check('rojo + amarillo coexisten → veredicto rojo', () => {
    const r = evaluateVerdict(ocr({ amount: 130000, isReceipt: false }), { today: TODAY, expectedAmount: 150000 });
    assert.equal(r.verdict, 'rojo');
    assert.ok(r.reasons.some((x) => x.level === 'amarillo'));
    assert.ok(r.reasons.some((x) => x.level === 'rojo'));
});

// normalizeReference — mayúsculas, sin espacios/guiones.
check('normalizeReference limpia y estabiliza', () => {
    assert.equal(normalizeReference(' m09 743-655 '), 'M09743655');
    assert.equal(normalizeReference(''), null);
    assert.equal(normalizeReference(null), null);
});

console.log(`\n${passed} checks passed ✓`);
