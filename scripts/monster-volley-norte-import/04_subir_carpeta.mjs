// ============================================================================
// Monster's Volley Club (Sede Norte) — sube los 14 documentos que el conector
// de Drive no deja bajar solo. Se bajan A MANO de Drive a una carpeta y este
// script reconoce cada archivo por su nombre y lo sube a su casilla correcta.
//
//   node scripts/monster-volley-norte-import/04_subir_carpeta.mjs <carpeta>          # dry-run
//   node scripts/monster-volley-norte-import/04_subir_carpeta.mjs <carpeta> --confirmar
//
// El nombre se compara sin extensión y sin el sufijo " - <Nombre>" que Google
// Forms le agrega al archivo ("firma - Carolina Lara.png" → "firma").
// Idempotente: si el atleta ya tiene ese tipo de documento, no lo repite.
// Reusa 02b (identity-documents + athlete_documents) y 02c (avatar) de Suba.
// ============================================================================
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const SUBA = path.join(HERE, '../monster-volley-suba-import');
const SCHOOL_ID = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c';

const argv = process.argv.slice(2);
const CARPETA = argv.find((a) => !a.startsWith('--'));
const CONFIRMAR = argv.includes('--confirmar');
if (!CARPETA) { console.error('Uso: node 04_subir_carpeta.mjs <carpeta> [--confirmar]'); process.exit(1); }

// nombre normalizado → { fileId (para ubicar al atleta), tipo }
const ESPERADOS = [
  { nombre: ['whatsapp image 2026-06-19 at 4.37.07 pm', 'diana ivonne pinto'], fileId: '1opdcriyRH_izeegAzhwyV7Lq7bx1ga8H', tipo: 'athlete_photo', quien: 'Diana Ivonne Pinto' },
  { nombre: ['carta_juramentada_yuly_castro', 'carta_juramentada_yuly_castro_pardo'], fileId: '1S3kW9FHrM22cdgqrbNaCaiXQvzBS0muZ', tipo: 'good_standing_certificate', quien: 'Yuly Castro' },
  { nombre: 'firma papa', fileId: '1ly4of_7vTQKOjLCh77yuHHc0efrGYvmc', tipo: 'guardian_signature', quien: 'Isabella Güiza' },
  { nombre: 'certificadoposmontserrat quiros lara', fileId: '1RXdxdmGpHcdohfE4EAk2D6yeSBLdLgbL', tipo: 'eps_certificate', quien: 'Montserrat Quiros' },
  { nombre: 'firma', fileId: '14icsO9b7QT7QTozsBV0tqVtJlSBff4wD', tipo: 'guardian_signature', quien: 'Montserrat Quiros' },
  { nombre: 'whatsapp image 2026-02-27 at 9.50.22 pm', fileId: '17xIf6RKvQWkeAc0hRg4Hsh3YHWFhr3yS', tipo: 'athlete_signature', quien: 'Luis Miguel Gamba' },
  { nombre: 'firma deportista', fileId: '1FZu0SeOKwlNSP8kYIZCQ0WdCPUJR-LeE', tipo: 'athlete_signature', quien: 'Antonia Rojas' },
  { nombre: '1000060752 (1)_watermark (3)', fileId: '10H0rI-1oAAXLwYyfT6fVG192tQfQPtrJ', tipo: 'athlete_signature', quien: 'María José Torres' },
  { nombre: 'declaracion_monsters_volley_club_jose_barrios_v3', fileId: '1GX2weExtKaKV3S0EMzSO_gKJejNIBO77', tipo: 'good_standing_certificate', quien: 'Jose Barrios' },
  { nombre: 'img_7819', fileId: '1upimZ7efvmOCeUITMkyjBqdFUDzOtBIJ', tipo: 'guardian_signature', quien: 'Gabriela Rodríguez' },
  { nombre: 'firma digital', fileId: '1xQ6BgccJVON0A2JW2qePuQWFNsEGyP3U', tipo: 'athlete_signature', quien: 'Mateo Rincón' },
  { nombre: 'no pertenezco a ningun club', fileId: '1Fk_EpTcTrbOykonTNMYlgOvxyLXq135o', tipo: 'good_standing_certificate', quien: 'Mateo Rincón' },
  { nombre: 'firma danna', fileId: '1_z0XfrzHNYkEMy1EQXqLxLUldc9pDEkf', tipo: 'athlete_signature', quien: 'Danna Vargas' },
];

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.pdf': 'application/pdf', '.webp': 'image/webp', '.heic': 'image/heic' };
const normalizar = (archivo) => {
  const sinExt = archivo.replace(/\.[a-zA-Z0-9]{2,5}$/, '');
  const i = sinExt.lastIndexOf(' - ');
  return (i === -1 ? sinExt : sinExt.slice(0, i)).trim().toLowerCase();
};

const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, 'bff/.env'), 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
);
const BASE = (env.SUPABASE_URL || '').replace(/\/$/, '');
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };
const manifiesto = JSON.parse(fs.readFileSync(path.join(HERE, 'data/documentos.json'), 'utf8'));

const archivos = fs.readdirSync(CARPETA).filter((f) => MIME[path.extname(f).toLowerCase()]);
console.log(`Modo: ${CONFIRMAR ? 'ESCRITURA' : 'DRY-RUN'} · ${archivos.length} archivos en ${CARPETA}\n`);

const encontrados = new Set();
for (const f of archivos) {
  const clave = normalizar(f);
  const esp = ESPERADOS.find((e) => [].concat(e.nombre).includes(clave));
  if (!esp) { console.log(`  ? sin reconocer: ${f}`); continue; }
  encontrados.add(esp.fileId);
  const m = manifiesto.find((d) => d.fileId === esp.fileId);
  const r = await fetch(`${BASE}/rest/v1/athlete_documents?unregistered_athlete_id=eq.${m.atleta_id}&document_type=eq.${esp.tipo}&select=id`, { headers: H });
  const ya = esp.tipo !== 'other' && (await r.json()).length > 0;
  console.log(`  ${ya ? '=' : '+'} ${esp.quien.padEnd(22)} ${esp.tipo.padEnd(26)} ${f}${ya ? '  (ya tiene ese documento, se salta)' : ''}`);
  if (ya || !CONFIRMAR) continue;

  const ext = path.extname(f).toLowerCase();
  const tmp = path.join(os.tmpdir(), `norte-${esp.fileId}.json`);
  fs.writeFileSync(tmp, JSON.stringify({ content: fs.readFileSync(path.join(CARPETA, f)).toString('base64'), mimeType: MIME[ext], title: f }));
  try {
    execFileSync('node', [path.join(SUBA, '02b_subir_documento.mjs'), '--json', tmp, '--tipo', esp.tipo, '--atleta', m.atleta_id, '--escuela', SCHOOL_ID], { stdio: 'inherit', cwd: ROOT });
    if (esp.tipo === 'athlete_photo') execFileSync('node', [path.join(SUBA, '02c_subir_avatar.mjs'), '--json', tmp, '--atleta', m.atleta_id], { stdio: 'inherit', cwd: ROOT });
  } finally { fs.rmSync(tmp, { force: true }); }
}
const faltan = ESPERADOS.filter((e) => !encontrados.has(e.fileId));
console.log(`\n${encontrados.size} de ${ESPERADOS.length} reconocidos.${faltan.length ? ' Faltan: ' + faltan.map((e) => `${e.quien} (${[].concat(e.nombre)[0]})`).join('; ') : ''}`);
