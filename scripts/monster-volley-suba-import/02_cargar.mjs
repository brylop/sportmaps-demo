// ============================================================================
// Monster's Volley Club (Sede Suba) — carga a la base + Storage.
//
//   · POR DEFECTO NO ESCRIBE NADA. Sin --confirmar hace dry-run y muestra
//     exactamente qué insertaría (team, unregistered_athlete, enrollment,
//     documentos) fila por fila.
//   · No crea offering_plan_id ni payments — no se decidió facturación para
//     esta escuela. Solo roster + documentos.
//   · Los documentos se bajan de Google Drive con la integración ya conectada
//     de esta sesión (Claude), no con una API key propia — por eso este paso
//     hoy es semi-manual: el script deja el trabajo de descarga listado y este
//     mismo proceso (Claude) hace la descarga + sube el archivo, uno por uno,
//     usando las funciones de abajo desde una consola interactiva o adaptando
//     este archivo. Ver 02b_subir_documento.mjs para la mitad "subir a Storage"
//     ya aislada y reusable.
//
// Uso:
//   node scripts/monster-volley-suba-import/02_cargar.mjs --hoja u9-y-u11-mixto --solo-doc 1031847289
//   node scripts/monster-volley-suba-import/02_cargar.mjs --hoja u9-y-u11-mixto --solo-doc 1031847289 --confirmar
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };
const has = (n) => argv.includes(`--${n}`);

const HOJA = arg('hoja');
const SOLO_DOC = arg('solo-doc');
const CONFIRMAR = has('confirmar');

if (!HOJA) { console.error('Falta --hoja <slug> (ver data/*.json)'); process.exit(1); }

// ── Fijo para esta escuela — este script es un one-off, no un endpoint genérico ──
const SCHOOL_ID = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c'; // Monster's Volley Club
const BRANCH_SUBA_ID = '531a2df9-dab4-47bb-a1cf-5a904b276c46'; // Sede Suba

const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, 'bff/.env'), 'utf8')
    .split(/\r?\n/).filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
);
const BASE = (env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const get = async (q) => {
  const r = await fetch(`${BASE}/rest/v1/${q}`, { headers: HEADERS });
  const t = await r.text();
  if (!r.ok) throw new Error(`GET ${q} -> ${t.slice(0, 300)}`);
  return JSON.parse(t);
};
const post = async (tabla, fila) => {
  const r = await fetch(`${BASE}/rest/v1/${tabla}`, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(fila),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`POST ${tabla} -> ${t.slice(0, 500)}`);
  return JSON.parse(t)[0];
};

async function resolverOCrearTeam(nombreHoja) {
  const existentes = await get(`teams?school_id=eq.${SCHOOL_ID}&name=eq.${encodeURIComponent(nombreHoja)}&select=id,name,branch_id`);
  if (existentes.length > 0) return { team: existentes[0], creado: false };
  if (!CONFIRMAR) return { team: { id: '(se crearía)', name: nombreHoja, branch_id: BRANCH_SUBA_ID }, creado: true };
  const team = await post('teams', {
    school_id: SCHOOL_ID,
    name: nombreHoja,
    sport: 'Voleibol',
    branch_id: BRANCH_SUBA_ID,
    age_group: nombreHoja,
    current_students: 0,
    active: true,
  });
  return { team, creado: true };
}

function armarIntakeFormData(a) {
  return {
    address: a.address, locality: a.locality, neighborhood: a.neighborhood,
    landline: a.landline, guardian_occupation: a.guardian_occupation,
    athlete_occupation: a.athlete_occupation, categoria_formulario: a.categoria_formulario,
    social_instagram: a.social_instagram, social_facebook: a.social_facebook, social_tiktok: a.social_tiktok,
  };
}

async function main() {
  const jsonPath = path.join(HERE, 'data', `${HOJA}.json`);
  if (!fs.existsSync(jsonPath)) { console.error(`No existe ${jsonPath}. Corré 01_extraer.mjs primero.`); process.exit(1); }
  const { hoja, atletas } = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  const seleccion = SOLO_DOC ? atletas.filter((a) => a.doc_number === SOLO_DOC) : atletas;
  if (seleccion.length === 0) { console.error(`Ningún atleta con doc_number=${SOLO_DOC} en ${HOJA}.`); process.exit(1); }

  console.log(`Modo: ${CONFIRMAR ? 'ESCRITURA' : 'DRY-RUN (nada se escribe)'}`);
  console.log(`Hoja: ${hoja} — atletas a procesar: ${seleccion.length}\n`);

  const { team, creado } = await resolverOCrearTeam(hoja);
  console.log(`Team "${hoja}": ${creado ? (CONFIRMAR ? 'creado' : 'se crearía') : 'ya existía'} -> id=${team.id}\n`);

  for (const a of seleccion) {
    console.log(`── ${a.full_name} (doc ${a.doc_type} ${a.doc_number}) ──`);

    const dup = a.doc_number
      ? await get(`unregistered_athletes?school_id=eq.${SCHOOL_ID}&doc_number=eq.${a.doc_number}&select=id,full_name`)
      : [];
    if (dup.length > 0) {
      console.log(`  YA EXISTE como unregistered_athletes.id=${dup[0].id} ("${dup[0].full_name}") — se salta, no se duplica.\n`);
      continue;
    }

    const payloadAtleta = {
      school_id: SCHOOL_ID,
      branch_id: BRANCH_SUBA_ID,
      full_name: a.full_name.trim(),
      doc_type: a.doc_type,
      doc_number: a.doc_number,
      date_of_birth: a.date_of_birth,
      email: a.athlete_email,
      phone: a.athlete_phone,
      guardian_phone: a.guardian_phone,
      guardian_email: a.guardian_email,
      blood_type: a.blood_type,
      eps_name: a.eps_name,
      health_screening: a.health_screening,
      intake_form_data: armarIntakeFormData(a),
      is_active: true,
    };

    console.log('  unregistered_athletes:', JSON.stringify(payloadAtleta, null, 2).slice(0, 800));

    let uaId = '(se crearía)';
    if (CONFIRMAR) {
      const ua = await post('unregistered_athletes', payloadAtleta);
      uaId = ua.id;
    }
    console.log(`  -> unregistered_athlete_id = ${uaId}`);

    const payloadEnrollment = {
      school_id: SCHOOL_ID,
      unregistered_athlete_id: uaId,
      team_id: team.id,
      status: 'active',
      start_date: new Date().toISOString().slice(0, 10),
    };
    console.log('  enrollments:', JSON.stringify(payloadEnrollment));
    if (CONFIRMAR) {
      const enr = await post('enrollments', payloadEnrollment);
      console.log(`  -> enrollment_id = ${enr.id}`);
    }

    console.log(`  documentos a subir (${a.documentos.length}):`);
    for (const d of a.documentos) {
      const estado = d.broken ? 'ROTO — no se puede recuperar' : `Drive fileId=${d.fileId}`;
      console.log(`    - ${d.document_type}: ${estado}`);
    }
    console.log('  (la descarga+subida de estos documentos la hace Claude en el mismo turno, ver README §2)\n');
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
