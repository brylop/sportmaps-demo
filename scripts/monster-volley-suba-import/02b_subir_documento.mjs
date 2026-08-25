// ============================================================================
// Sube UN documento ya descargado (JSON {content base64, mimeType, title}) al
// bucket identity-documents y registra la fila en athlete_documents.
//
// Existe separado de 02_cargar.mjs porque la descarga de Drive la hace Claude
// (la integración de Drive no es invocable desde un script de Node), así que
// el flujo real es: Claude descarga 1 archivo -> guarda el JSON -> corre esto.
//
// Uso:
//   node scripts/monster-volley-suba-import/02b_subir_documento.mjs \
//     --json <ruta-al-json-descargado> --tipo athlete_photo \
//     --atleta <unregistered_athlete_id> --escuela <school_id>
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };

const JSON_PATH = arg('json');
const TIPO = arg('tipo');
const ATLETA_ID = arg('atleta');
const ESCUELA_ID = arg('escuela');

if (!JSON_PATH || !TIPO || !ATLETA_ID || !ESCUELA_ID) {
  console.error('Uso: --json <ruta> --tipo <document_type> --atleta <unregistered_athlete_id> --escuela <school_id>');
  process.exit(1);
}

const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, 'bff/.env'), 'utf8')
    .split(/\r?\n/).filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
);
const BASE = (env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const extFromMime = (mime) => ({
  'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf',
  'image/heic': 'heic', 'image/webp': 'webp',
}[mime] || 'bin');

// El formulario NO pregunta el nombre del acudiente, pero Google Forms
// sufija cada archivo subido con el nombre de la cuenta que lo subió
// ("... - Nombre Apellido.ext"). Se rescata de ahí, una sola vez por atleta
// (no pisa un valor ya cargado ni una corrección manual posterior).
function extraerNombreAcudiente(title) {
  if (!title) return null;
  const sinExt = title.replace(/\.[a-zA-Z0-9]{2,5}$/, '');
  const idx = sinExt.lastIndexOf(' - ');
  if (idx === -1) return null;
  const nombre = sinExt.slice(idx + 3).trim();
  return nombre.length >= 3 ? nombre : null;
}

async function main() {
  const { content, mimeType, title } = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const buf = Buffer.from(content, 'base64');
  const ts = Date.now();
  const ext = extFromMime(mimeType);
  const baseName = (title || TIPO).replace(/\.[a-zA-Z0-9]{2,5}$/, ''); // sin la extensión original
  const safeName = baseName.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 60);
  const finalPath = `unregistered_athletes/${ATLETA_ID}/docs/${TIPO}-${ts}-${safeName}.${ext}`;

  console.log(`Subiendo ${buf.length} bytes (${mimeType}) a identity-documents/${finalPath} ...`);

  const up = await fetch(`${BASE}/storage/v1/object/identity-documents/${finalPath}`, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': mimeType, 'x-upsert': 'true' },
    body: buf,
  });
  const upText = await up.text();
  if (!up.ok) throw new Error(`Storage upload -> ${upText.slice(0, 500)}`);
  console.log('  Storage OK:', upText.slice(0, 200));

  const insert = await fetch(`${BASE}/rest/v1/athlete_documents`, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      school_id: ESCUELA_ID,
      unregistered_athlete_id: ATLETA_ID,
      document_type: TIPO,
      storage_path: finalPath,
    }),
  });
  const insertText = await insert.text();
  if (!insert.ok) throw new Error(`athlete_documents insert -> ${insertText.slice(0, 500)}`);
  console.log('  athlete_documents OK:', JSON.parse(insertText)[0].id);

  const guardianName = extraerNombreAcudiente(title);
  if (guardianName) {
    const patch = await fetch(
      `${BASE}/rest/v1/unregistered_athletes?id=eq.${ATLETA_ID}&guardian_full_name=is.null`,
      { method: 'PATCH', headers: { ...HEADERS, 'Content-Type': 'application/json' }, body: JSON.stringify({ guardian_full_name: guardianName }) },
    );
    if (patch.ok) console.log(`  guardian_full_name completado desde el título del archivo: "${guardianName}"`);
  }
}

main().catch((err) => { console.error('ERROR:', err.message); process.exit(1); });
