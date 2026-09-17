/**
 * Lee las notificaciones que el banco le manda a la escuela cuando entra plata.
 *
 * POR QUÉ EXISTE
 *
 * Un comprobante es una IMAGEN, y una imagen nunca va a probar que hubo una
 * transferencia. El 2026-09-16 se fabricó uno en treinta segundos que pasó los
 * nueve controles de `receipt-verdict` con veredicto verde: monto exacto,
 * cuenta registrada, fecha de hoy, referencia nueva. Esos nueve controles
 * atrapan reúso y errores honestos; ninguno mira el dinero.
 *
 * Esto sí lo mira. No es la foto del papá: es el banco diciéndole a la escuela
 * que la plata llegó.
 *
 * CÓMO LLEGA
 *
 * La escuela pone un filtro en su correo —«de notificaciones@nequi.com.co →
 * reenviar a pagos@sportmaps.co»— y nada más. No nos da claves, no nos da
 * acceso a su bandeja, y puede quitarlo cuando quiera. Se prefirió esto sobre
 * la API de Gmail a propósito: leer correo es *restricted scope* en Google y
 * exige una auditoría anual con un tercero certificado.
 *
 * QUÉ NO TRAE, Y HAY QUE SABERLO
 *
 *   · No hay número de referencia. El cruce va por monto + fecha + nombre, no
 *     contra la referencia del comprobante.
 *   · El correo de RECEPCIÓN no dice a cuál llave entró. Dynasty tiene tres.
 *   · El nombre llega como lo tenga el banco emisor, que no es como lo tiene
 *     la escuela en la ficha.
 */

/** Una entrada de plata confirmada por el banco. */
export interface EntradaBancaria {
    banco: 'nequi' | 'bancolombia';
    /** En pesos enteros. */
    monto: number;
    /** Nombre de quien envió, tal como lo escribió el banco. */
    remitente: string;
    /** ISO yyyy-mm-dd en hora de Bogotá. */
    fecha: string;
    /** hh:mm en 24h, si el correo la trae. */
    hora: string | null;
    /** Banco de origen, cuando el correo lo menciona. */
    bancoOrigen: string | null;
    /** Llave o cuenta de destino, cuando el correo la trae. */
    destino: string | null;
}

const MESES: Record<string, number> = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
    noviembre: 11, diciembre: 12,
};

/**
 * Convierte un monto colombiano a pesos enteros.
 *
 * ACÁ ESTÁ EL BUG QUE MÁS CARO SALDRÍA. Nequi escribe «4.000» —sin `$`, con
 * punto de miles y sin decimales—. `Number('4.000')` da 4. Cuatro pesos en vez
 * de cuatro mil, registrados como un pago válido, y nadie lo nota hasta que
 * alguien cuadra la contabilidad.
 *
 * Bancolombia, en el mismo buzón, escribe «$400000.00»: punto DECIMAL. Y
 * «$237.975,24»: punto de miles y coma decimal. Los tres formatos conviven.
 *
 * La regla que los separa: el último separador manda. Si lo que sigue son
 * exactamente 2 dígitos y hay algo antes, es decimal; en cualquier otro caso
 * es separador de miles.
 */
export function montoAPesos(texto: string): number | null {
    const limpio = texto.replace(/[^0-9.,]/g, '');
    if (!limpio) return null;

    const ultimoPunto = limpio.lastIndexOf('.');
    const ultimaComa = limpio.lastIndexOf(',');
    const corte = Math.max(ultimoPunto, ultimaComa);

    let entero = limpio;
    let decimales = '';

    if (corte > 0 && limpio.length - corte - 1 === 2) {
        entero = limpio.slice(0, corte);
        decimales = limpio.slice(corte + 1);
    }

    const pesos = Number(entero.replace(/[.,]/g, ''));
    if (!Number.isFinite(pesos)) return null;

    // Los centavos se redondean: en la app todo es peso entero.
    return decimales ? Math.round(pesos + Number(`0.${decimales}`)) : pesos;
}

/** «12 de septiembre de 2026» → 2026-09-12 */
function fechaEnLetras(dia: string, mes: string, anio: string): string | null {
    const m = MESES[mes.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')];
    if (!m) return null;
    return `${anio}-${String(m).padStart(2, '0')}-${String(Number(dia)).padStart(2, '0')}`;
}

/**
 * «15/09/26» o «15/09/2026» → 2026-09-15
 *
 * El año de dos dígitos se resuelve al 2000: un extracto bancario de 1926 no
 * existe, y asumir el siglo equivocado tira el cruce por 100 años.
 */
function fechaEnNumeros(d: string, m: string, a: string): string {
    const anio = a.length === 2 ? `20${a}` : a;
    return `${anio}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/** «8:09 p.m» / «4:19 pm» / «16:09» → «20:09» / «16:19» / «16:09» */
function hora24(h: string, min: string, sufijo?: string | null): string {
    let hh = Number(h);
    const s = (sufijo ?? '').toLowerCase().replace(/[^apm]/g, '');
    if (s === 'pm' && hh < 12) hh += 12;
    if (s === 'am' && hh === 12) hh = 0;
    return `${String(hh).padStart(2, '0')}:${min}`;
}

/** Aplana el correo: los reenvíos meten saltos, tabs y «>» de cita. */
function aplanar(cuerpo: string): string {
    return cuerpo
        .replace(/\r/g, ' ')
        .replace(/^[>|\s]+/gm, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// ─── Nequi ───────────────────────────────────────────────────────────────────
// «Recibiste 400.000 de BRAYAN STEVEN LOPEZ ROMERO el 15 de septiembre de 2026
//  a las 4:19 p.m, desde el banco Bancolombia.»
//
// Solo se lee RECEPCIÓN. El correo de «Enviaste …» es del papá, no de la
// escuela, y tomarlo por bueno seria dar por recibida plata que salio de otra
// cuenta.
const NEQUI_RECIBE =
    /Recibiste\s+([\d.,]+)\s+de\s+(.+?)\s+el\s+(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})(?:\s+a\s+las\s+(\d{1,2}):(\d{2})\s*([ap]\.?\s?m\.?)?)?(?:,?\s*desde\s+el\s+banco\s+([^.,]+))?/i;

// ─── Bancolombia ─────────────────────────────────────────────────────────────
// «recibiste una transferencia de Tumipay SAS por $400000.00 en tu cuenta *6943
//  conectada a la llave 1016088109 el 15/09/26 a las 16:09.»
const BANCOLOMBIA_TRANSFERENCIA =
    /recibiste\s+una\s+transferencia\s+de\s+(.+?)\s+por\s+\$?\s*([\d.,]+)\s+en\s+tu\s+cuenta\s+\*?([\w]+)(?:\s+conectada\s+a\s+la\s+llave\s+(\d+))?\s+el\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+a\s+las\s+(\d{1,2}):(\d{2}))?/i;

// «Recibiste un pago PROVEEDOR de INVERSIONES por $244530.00 en tu cuenta de
//  Ahorros el 15/09/2026 a las 18:46.»
const BANCOLOMBIA_PAGO =
    /Recibiste\s+un\s+pago\s+\w*\s*de\s+(.+?)\s+por\s+\$?\s*([\d.,]+)\s+en\s+tu\s+cuenta\s+(?:de\s+)?([\w*]+)\s+el\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+a\s+las\s+(\d{1,2}):(\d{2}))?/i;

/**
 * Extrae la entrada de plata de un correo de notificación, o null si no lo es.
 *
 * `null` es la respuesta correcta y frecuente: al buzón van a llegar rechazos
 * de factura, promociones del banco y avisos de envío. Nada de eso es plata
 * que entró, y confundirlo sería peor que no leer nada.
 */
export function leerCorreoDeBanco(remitente: string, cuerpo: string): EntradaBancaria | null {
    const de = remitente.toLowerCase();
    const t = aplanar(cuerpo);

    if (de.includes('nequi.com.co')) {
        const m = NEQUI_RECIBE.exec(t);
        if (!m) return null;
        const monto = montoAPesos(m[1]);
        const fecha = fechaEnLetras(m[3], m[4], m[5]);
        if (monto === null || !fecha) return null;
        return {
            banco: 'nequi',
            monto,
            remitente: m[2].trim(),
            fecha,
            hora: m[6] ? hora24(m[6], m[7], m[8]) : null,
            bancoOrigen: m[9]?.trim() ?? null,
            // El correo de recepción de Nequi NO dice a cuál llave entró.
            destino: null,
        };
    }

    if (de.includes('bancolombia')) {
        const m = BANCOLOMBIA_TRANSFERENCIA.exec(t);
        if (m) {
            const monto = montoAPesos(m[2]);
            if (monto === null) return null;
            return {
                banco: 'bancolombia',
                monto,
                remitente: m[1].trim(),
                fecha: fechaEnNumeros(m[5], m[6], m[7]),
                hora: m[8] ? hora24(m[8], m[9]) : null,
                bancoOrigen: null,
                destino: m[4] ?? m[3] ?? null,
            };
        }
        const p = BANCOLOMBIA_PAGO.exec(t);
        if (p) {
            const monto = montoAPesos(p[2]);
            if (monto === null) return null;
            return {
                banco: 'bancolombia',
                monto,
                remitente: p[1].trim(),
                fecha: fechaEnNumeros(p[4], p[5], p[6]),
                hora: p[7] ? hora24(p[7], p[8]) : null,
                bancoOrigen: null,
                destino: p[3] ?? null,
            };
        }
    }

    return null;
}

/** Sin tildes, sin mayúsculas, sin dobles espacios. Para comparar nombres. */
export const nombrePlano = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
     .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * ¿El remitente del banco es la misma persona que el acudiente de la ficha?
 *
 * No se comparan cadenas completas: el banco manda «BRAYAN LOPEZ» donde la
 * ficha dice «Brayan Steven López Romero», y al revés. Se pide que TODAS las
 * palabras del nombre más corto estén en el más largo, y al menos dos — con
 * una sola, cualquier «María» calzaría con cualquier otra «María».
 */
export function mismoNombre(a: string, b: string): boolean {
    const pa = nombrePlano(a).split(' ').filter((w) => w.length >= 3);
    const pb = nombrePlano(b).split(' ').filter((w) => w.length >= 3);
    if (pa.length === 0 || pb.length === 0) return false;

    const [corto, largo] = pa.length <= pb.length ? [pa, pb] : [pb, pa];
    const enComun = corto.filter((w) => largo.includes(w));
    return enComun.length >= 2 && enComun.length === corto.length;
}
