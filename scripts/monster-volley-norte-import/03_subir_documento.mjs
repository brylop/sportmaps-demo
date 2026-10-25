// ============================================================================
// Monster's Volley Club (Sede Norte) — sube UN documento ya descargado de
// Drive. Envoltorio idempotente sobre los scripts de Suba:
//   · 02b_subir_documento.mjs  -> identity-documents + athlete_documents
//   · 02c_subir_avatar.mjs     -> solo si es athlete_photo (avatar del roster)
// Si el atleta ya tiene ese document_type en athlete_documents, no hace nada
// (se puede re-correr sobre todo el manifiesto sin duplicar).
//
// La descarga la hace Claude con el conector de Drive (no es invocable desde
// Node): el resultado queda guardado como JSON {content, mimeType, title}.
//
// Uso:
//   node scripts/monster-volley-norte-import/03_subir_documento.mjs \
//     --json <ruta-al-json-descargado> --file-id <drive_file_id>
// (el tipo y el atleta salen de data/documentos.json por file-id)
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const SUBA = path.join(HERE, '../monster-volley-suba-import');
const SCHOOL_ID = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c';

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };
const JSON_PATH = arg('json');
const FILE_ID = arg('file-id');
if (!JSON_PATH || !FILE_ID) { console.error('Uso: --json <ruta> --file-id <drive_file_id>'); process.exit(1); }

const doc = JSON.parse(fs.readFileSync(path.join(HERE, 'data/documentos.json'), 'utf8')).find((d) => d.fileId === FILE_ID);
if (!doc) { console.error(`file-id ${FILE_ID} no está en data/documentos.json`); process.exit(1); }

const descargado = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
if (descargado.id && descargado.id !== FILE_ID) { console.error(`El JSON es del archivo ${descargado.id}, no de ${FILE_ID}`); process.exit(1); }

const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, 'bff/.env'), 'utf8')
    .split(/\r?\n/).filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
);
const BASE = (env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const r = await fetch(
  `${BASE}/rest/v1/athlete_documents?unregistered_athlete_id=eq.${doc.atleta_id}&document_type=eq.${doc.document_type}&select=id`,
  { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } },
);
if (!r.ok) throw new Error(`GET athlete_documents -> ${await r.text()}`);
const yaEsta = (await r.json()).length > 0;

console.log(`${doc.nombre} · ${doc.document_type}${yaEsta ? ' · ya cargado, se salta' : ''}`);
if (!yaEsta) {
  execFileSync('node', [path.join(SUBA, '02b_subir_documento.mjs'), '--json', JSON_PATH, '--tipo', doc.document_type, '--atleta', doc.atleta_id, '--escuela', SCHOOL_ID], { stdio: 'inherit', cwd: ROOT });
  if (doc.document_type === 'athlete_photo') {
    execFileSync('node', [path.join(SUBA, '02c_subir_avatar.mjs'), '--json', JSON_PATH, '--atleta', doc.atleta_id], { stdio: 'inherit', cwd: ROOT });
  }
}
