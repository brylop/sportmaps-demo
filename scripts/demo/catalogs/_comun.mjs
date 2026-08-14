// ============================================================================
// Piezas compartidas por todos los catálogos demo.
//
// Lo que vive acá es lo que NO cambia entre tenants: cómo se traduce un método
// de pago a las columnas de `payments`, la mezcla de mora, los bancos de los
// comprobantes y los motivos de cancelación. Si esto se copiara en cada
// catálogo, a la tercera demo ya estarían desalineados.
//
// Cada catálogo hace `export * from './_comun.mjs'` y encima define lo suyo.
// ============================================================================

// Imágenes: SOLO ids verificados (HTTP 200) que ya usa frontend/src/lib/sportImages.ts.
// No se inventan ids nuevos: el seed baja el logo para subirlo al bucket, así que
// un 404 acá revienta el paso de branding. Patinaje y boxeo todavía no tienen
// foto propia verificada — usan la genérica hasta que se agregue una.
const U = (id, w = 800) => `https://images.unsplash.com/${id}?auto=format&fit=crop&q=80&w=${w}`;
export const IMG = {
    banner_generico: U('photo-1592919505780-303950717480', 2000),
    futbol: U('photo-1575361204480-aadea25e6e68'),
    voleibol: U('photo-1612872087720-bb876e2e67d1'),
    baloncesto: U('photo-1546519638-68e109498ffc'),
    gimnasio: U('photo-1534438327276-14e5300c3a48'),
    generico: U('photo-1575361204480-aadea25e6e68'),
};
export { U };

// ── Cartera ─────────────────────────────────────────────────────────────────
// ~80% al día, ~15% mora de 1 mes, ~5% mora de 2+ meses. Una demo sin mora no
// sirve para mostrar cobranza, y una con demasiada parece una escuela quebrada.
export const PAY_MIX = { al_dia: 0.80, mora_1: 0.15, mora_2: 0.05 };

export const METHOD_MIX = [
    { key: 'wompi_card', weight: 0.40 },
    { key: 'wompi_nequi', weight: 0.25 },
    { key: 'transfer_ocr', weight: 0.25 },
    { key: 'cash', weight: 0.10 },
];

export const METHODS = {
    wompi_card: { payment_method: 'card', payment_channel: 'online', payment_provider: 'wompi' },
    wompi_nequi: { payment_method: 'other', payment_channel: 'online', payment_provider: 'wompi' },
    transfer_ocr: { payment_method: 'transfer', payment_channel: 'transfer', payment_provider: 'wompi', ocr: true },
    cash: { payment_method: 'cash', payment_channel: 'cash', payment_provider: 'wompi' },
};

export const BANCOS = ['Bancolombia', 'Davivienda', 'Banco de Bogotá', 'Nequi', 'BBVA'];

export const MOTIVOS_CANCELACION = [
    'Lluvia — escenario no apto', 'El deportista canceló con 24h de anticipación',
    'Cruce con torneo interno', 'Mantenimiento preventivo del escenario',
    'No se confirmó el pago del depósito', 'Entrenador incapacitado',
];

// ── Addons ──────────────────────────────────────────────────────────────────
// 'mp' (MercadoPago) queda FUERA a propósito en todas las demos: el token de MP
// de este entorno es de PRODUCCIÓN (APP_USR-), así que un cobro por MP sería un
// cobro real contra una tarjeta real. Wompi sí está en sandbox.
export const ADDONS = [
    'access_control', 'tournaments', 'accounting', 'whatsapp', 'wompi', 'store', 'invoicing',
];
