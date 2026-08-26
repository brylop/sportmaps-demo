// ============================================================================
// Sube la foto ya descargada (JSON {content base64, mimeType, title}) al
// bucket PÚBLICO avatars (mismo bucket que children/profiles) y setea
// unregistered_athletes.avatar_url con la URL pública resultante.
//
// Distinto de 02b_subir_documento.mjs: ese guarda en identity-documents
// (privado, requiere URL firmada) porque es evidencia/soporte. Esto es la
// foto de perfil que se muestra en el roster — mismo patrón que
// EditChildDialog.tsx usa para children.avatar_url.
//
// Uso:
//   node scripts/monster-volley-suba-import/02c_subir_avatar.mjs \
//     --json <ruta-al-json-descargado> --atleta <unregistered_athlete_id>
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };

const JSON_PATH = arg('json');
const ATLETA_ID = arg('atleta');

if (!JSON_PATH || !ATLETA_ID) {
  console.error('Uso: --json <ruta> --atleta <unregistered_athlete_id>');
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

const extFromMime = (mime) => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mime] || 'jpg');

async function main() {
  const { content, mimeType } = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const buf = Buffer.from(content, 'base64');
  const ext = extFromMime(mimeType);
  const finalPath = `unregistered_athletes/${ATLETA_ID}/${Date.now()}.${ext}`;

  console.log(`Subiendo ${buf.length} bytes (${mimeType}) a avatars/${finalPath} ...`);
  const up = await fetch(`${BASE}/storage/v1/object/avatars/${finalPath}`, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': mimeType, 'x-upsert': 'true' },
    body: buf,
  });
  const upText = await up.text();
  if (!up.ok) throw new Error(`Storage upload -> ${upText.slice(0, 500)}`);

  const publicUrl = `${BASE}/storage/v1/object/public/avatars/${finalPath}`;
  console.log('  Storage OK, URL pública:', publicUrl);

  const patch = await fetch(`${BASE}/rest/v1/unregistered_athletes?id=eq.${ATLETA_ID}`, {
    method: 'PATCH',
    headers: { ...HEADERS, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ avatar_url: publicUrl }),
  });
  const patchText = await patch.text();
  if (!patch.ok) throw new Error(`unregistered_athletes PATCH -> ${patchText.slice(0, 500)}`);
  console.log('  unregistered_athletes.avatar_url actualizado OK.');
}

main().catch((err) => { console.error('ERROR:', err.message); process.exit(1); });
