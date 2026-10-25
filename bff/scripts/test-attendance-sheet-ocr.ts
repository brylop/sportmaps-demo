/**
 * Prueba manual del OCR de planillas de asistencia, sin WhatsApp ni base.
 *
 *   npx tsx scripts/test-attendance-sheet-ocr.ts <foto.jpg> [idx_transcripcion]
 *
 * Con `idx_transcripcion` (1..32 de docs/dynasty-planillas-septiembre-2026/) compara
 * contra la transcripción a mano: filas leídas, y por marca si coincide la
 * interpretación (asistió / sin marca / dudosa). Requiere GEMINI_API_KEY (o las
 * de OpenAI/Groq) en el entorno. Consume cuota del proveedor.
 */
import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { extractAttendanceSheet, interpretarMarca } from '../src/services/attendance-sheet-ocr.service';

const MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.pdf': 'application/pdf' };

async function main() {
    const [foto, idx] = process.argv.slice(2);
    if (!foto) { console.error('Uso: npx tsx scripts/test-attendance-sheet-ocr.ts <foto> [idx]'); process.exit(1); }
    const mime = MIME[extname(foto).toLowerCase()];
    if (!mime) { console.error('Extensión no soportada'); process.exit(1); }
    const t0 = Date.now();
    const r = await extractAttendanceSheet(readFileSync(foto).toString('base64'), mime);
    console.log(`Proveedor: ${r.provider} · ${Date.now() - t0} ms · planilla=${r.isAttendanceSheet} · grupo="${r.groupHeader}" · filas=${r.rows.length} · columnas=${r.columns.map((c) => c.label).join(',')}`);
    if (!idx) { console.log(JSON.stringify({ ...r, rawResponse: undefined }, null, 2)); return; }

    const dir = resolve(__dirname, '../../docs/dynasty-planillas-septiembre-2026');
    const ref = ['transcripcion_01_08.json', 'transcripcion_09_16.json', 'transcripcion_17_24.json', 'transcripcion_25_32.json']
        .filter((f) => existsSync(resolve(dir, f))).flatMap((f) => JSON.parse(readFileSync(resolve(dir, f), 'utf-8')))
        .find((h: any) => h.idx === Number(idx));
    if (!ref) { console.error(`No hay transcripción ${idx}`); process.exit(1); }
    let celdas = 0; let iguales = 0;
    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, '').split(' ').sort().join(' ');
    for (const fr of ref.filas) {
        const f = r.rows.find((x) => norm(x.name) === norm(fr.nombre));
        if (!f) { console.log(`  ✗ fila no leída: ${fr.nombre}`); continue; }
        for (const d of ref.dias) {
            celdas++;
            const a = interpretarMarca(fr.marcas?.[String(d)]);
            const b = interpretarMarca(f.marks[String(d)]);
            if (a === b) iguales++; else console.log(`  ≠ ${fr.nombre} día ${d}: transcripción=${a} (${fr.marcas?.[String(d)] ?? ''}) OCR=${b} (${f.marks[String(d)] ?? ''})`);
        }
    }
    console.log(`Celdas iguales: ${iguales}/${celdas} (${Math.round((100 * iguales) / Math.max(1, celdas))}%)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
