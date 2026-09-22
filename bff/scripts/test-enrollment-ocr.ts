/**
 * Prueba manual y aislada del extractor de hojas de matrícula, sin tocar
 * WhatsApp ni la base — fase 2 de
 * docs/specs/alta-atleta-por-foto-hoja-matricula.md.
 *
 *   npx tsx scripts/test-enrollment-ocr.ts <ruta-a-la-foto.jpg>
 *
 * Requiere GEMINI_API_KEY (o OPENAI_API_KEY / GROQ_API_KEY con GROQ_OCR_MODEL)
 * en el entorno. Imprime el EnrollmentFormResult crudo, tal como saldría en
 * la columna `extracted` de `enrollment_form_intake`.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { extractEnrollmentForm } from '../src/services/enrollment-ocr.service';

const MIME_BY_EXT: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
};

async function main() {
    const filePath = process.argv[2];
    if (!filePath) {
        console.error('Uso: npx tsx scripts/test-enrollment-ocr.ts <ruta-a-la-foto>');
        process.exit(1);
    }

    const ext = extname(filePath).toLowerCase();
    const mimeType = MIME_BY_EXT[ext];
    if (!mimeType) {
        console.error(`Extensión no soportada: ${ext}. Usa png/jpg/jpeg/webp/pdf.`);
        process.exit(1);
    }

    const base64 = readFileSync(filePath).toString('base64');

    console.log(`Extrayendo ${filePath} (${mimeType})...`);
    const start = Date.now();
    const result = await extractEnrollmentForm(base64, mimeType);
    const ms = Date.now() - start;

    console.log(`\nProvider: ${result.provider} · ${ms}ms\n`);
    console.log(JSON.stringify({ ...result, rawResponse: undefined }, null, 2));

    if (!result.isEnrollmentForm) {
        console.log('\n⚠️  El modelo dice que esto NO es una hoja de matrícula.');
    }
    if (result.missingFields.length > 0) {
        console.log(`\n⚠️  Campos no legibles: ${result.missingFields.join(', ')}`);
    }
}

main().catch((err) => {
    console.error('Error:', err);
    process.exit(1);
});
