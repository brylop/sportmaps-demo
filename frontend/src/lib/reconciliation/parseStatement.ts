/**
 * parseStatement — parseo de extractos bancarios CSV en el cliente.
 *
 * No dependemos de librerías: leemos el CSV, detectamos delimitador, mapeamos
 * columnas por palabra clave del encabezado (sirve para Nequi, Bancolombia y la
 * mayoría de exports genéricos) y normalizamos monto (formato colombiano) y
 * fecha (dd/mm/yyyy, yyyy-mm-dd, dd-mm-yyyy) a ISO.
 *
 * Devuelve solo movimientos de ENTRADA (monto > 0): un extracto trae débitos y
 * créditos, y para conciliar cobros nos interesan los ingresos.
 *
 * XLSX no está soportado aún (requiere librería): exportá el extracto como CSV.
 */

export interface StatementLine {
    occurredDate: string | null;   // YYYY-MM-DD
    amount: number;                // COP, entero o con decimales
    reference: string | null;
    description: string | null;
    counterparty: string | null;
}

export interface ParseResult {
    lines: StatementLine[];
    skipped: number;               // filas descartadas (sin monto válido / débitos)
    detectedColumns: Record<string, string | null>;
}

// ── CSV split (delimitador , o ; ; soporta comillas) ───────────────────────
function detectDelimiter(headerLine: string): string {
    const c = (headerLine.match(/,/g) || []).length;
    const s = (headerLine.match(/;/g) || []).length;
    return s > c ? ';' : ',';
}

function splitCsvLine(line: string, delim: string): string[] {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
            else inQuotes = !inQuotes;
        } else if (ch === delim && !inQuotes) {
            out.push(cur); cur = '';
        } else {
            cur += ch;
        }
    }
    out.push(cur);
    return out.map(s => s.trim());
}

// ── Monto colombiano: "1.234.567,89" | "1,234,567.89" | "120000" | "$ 120.000" ─
export function parseAmount(raw: string): number | null {
    if (!raw) return null;
    let s = raw.replace(/[^0-9.,-]/g, '').trim();   // quita $, espacios, letras
    if (!s || s === '-') return null;
    const neg = s.startsWith('-');
    s = s.replace(/-/g, '');

    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    let normalized: string;
    if (lastComma > -1 && lastDot > -1) {
        // El separador más a la derecha es el decimal.
        if (lastComma > lastDot) normalized = s.replace(/\./g, '').replace(',', '.');
        else normalized = s.replace(/,/g, '');
    } else if (lastComma > -1) {
        // Solo comas: decimal si hay 1-2 dígitos después de la última coma.
        const after = s.length - lastComma - 1;
        normalized = (after === 1 || after === 2) ? s.replace(',', '.') : s.replace(/,/g, '');
    } else if (lastDot > -1) {
        const after = s.length - lastDot - 1;
        normalized = (after === 1 || after === 2) ? s : s.replace(/\./g, '');
    } else {
        normalized = s;
    }
    const n = Number(normalized);
    if (!Number.isFinite(n)) return null;
    return neg ? -n : n;
}

// ── Fecha → YYYY-MM-DD ─────────────────────────────────────────────────────
export function parseDate(raw: string): string | null {
    if (!raw) return null;
    const s = raw.trim().split(/[ T]/)[0];   // corta hora si viene
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);   // dd/mm/yyyy o dd-mm-yyyy
    if (m) {
        const d = m[1].padStart(2, '0'), mo = m[2].padStart(2, '0');
        return `${m[3]}-${mo}-${d}`;
    }
    m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/);   // dd/mm/yy
    if (m) {
        const d = m[1].padStart(2, '0'), mo = m[2].padStart(2, '0');
        return `20${m[3]}-${mo}-${d}`;
    }
    return null;
}

// ── Detección de columnas por palabra clave del encabezado ─────────────────
function findCol(headers: string[], keywords: string[]): number {
    const norm = headers.map(h => h.toLowerCase());
    for (const kw of keywords) {
        const i = norm.findIndex(h => h.includes(kw));
        if (i > -1) return i;
    }
    return -1;
}

export function parseStatementCsv(text: string): ParseResult {
    const rawLines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    if (rawLines.length < 2) return { lines: [], skipped: 0, detectedColumns: {} };

    const delim = detectDelimiter(rawLines[0]);
    const headers = splitCsvLine(rawLines[0], delim);

    const idxDate = findCol(headers, ['fecha', 'date']);
    const idxAmount = findCol(headers, ['valor', 'monto', 'importe', 'amount', 'crédito', 'credito', 'abono', 'ingreso']);
    const idxRef = findCol(headers, ['referencia', 'reference', 'nro', 'número', 'numero', 'comprobante', 'transacc']);
    const idxDesc = findCol(headers, ['descrip', 'concepto', 'detalle', 'observ']);
    const idxParty = findCol(headers, ['origen', 'remitente', 'de:', 'nombre', 'ordenante', 'pagador']);

    const detectedColumns = {
        fecha: idxDate > -1 ? headers[idxDate] : null,
        monto: idxAmount > -1 ? headers[idxAmount] : null,
        referencia: idxRef > -1 ? headers[idxRef] : null,
        descripcion: idxDesc > -1 ? headers[idxDesc] : null,
    };

    const lines: StatementLine[] = [];
    let skipped = 0;

    for (let r = 1; r < rawLines.length; r++) {
        const cols = splitCsvLine(rawLines[r], delim);
        const amount = idxAmount > -1 ? parseAmount(cols[idxAmount] ?? '') : null;
        // Solo ingresos (monto > 0). Débitos/negativos/sin monto → descartar.
        if (amount === null || amount <= 0) { skipped++; continue; }
        lines.push({
            occurredDate: idxDate > -1 ? parseDate(cols[idxDate] ?? '') : null,
            amount,
            reference: idxRef > -1 ? (cols[idxRef] || null) : null,
            description: idxDesc > -1 ? (cols[idxDesc] || null) : null,
            counterparty: idxParty > -1 ? (cols[idxParty] || null) : null,
        });
    }

    return { lines, skipped, detectedColumns };
}
