// ============================================================================
// Monster's Volley Club (Sede Suba) — carga masiva de TODO el roster tabular
// (sin documentos — esos van aparte, ver README §Documentos).
//
//   · POR DEFECTO NO ESCRIBE NADA. Sin --confirmar hace dry-run.
//   · Salta a los 19 atletas sin doc_number (incompletos) — no se cargan
//     hasta que la escuela responda el reporte de pendientes.
//   · Crea las 13 categorías/equipos si no existen (la migración MOD-3 F1+F2
//     ya cargó las 13 school_categories; este script asegura que cada una
//     tenga su team).
//   · Los 12 pares de doble categoría (mismo doc_number en 2 hojas,
//     confirmados a mano contra _reporte_datos_faltantes.json) se cargan con
//     una categoría principal + una fila en enrollment_categories para la
//     segunda — nunca una segunda fila de enrollments (MOD-3 D3).
//
// Uso:
//   node scripts/monster-volley-suba-import/05_cargar_todo.mjs                # dry-run
//   node scripts/monster-volley-suba-import/05_cargar_todo.mjs --confirmar
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const DATA_DIR = path.join(HERE, 'data');

const CONFIRMAR = process.argv.includes('--confirmar');

const SCHOOL_ID = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c';
const BRANCH_SUBA_ID = '531a2df9-dab4-47bb-a1cf-5a904b276c46';

// Mapeo hoja (nombre EXACTO del JSON extraído) -> code de school_categories.
// U17 usa "PROYECCION" porque es el nombre del archivo más reciente que
// mandó la escuela (antes decía "PROFUNDIZACION") — pendiente de confirmar
// con Monster Volley si son la misma categoría renombrada o dos distintas.
const HOJA_A_CODE = {
  'U9 Y U11 MIXTO': 'U9U11',
  'U13 MIXTO': 'U13',
  'U15 FEMENINO PROYECCION': 'U15FEMPROY',
  'U15 FEMENINO COMPETENCIA': 'U15FEMCOMP',
  'U15 MASCULINO': 'U15MASC',
  'U17 FEMENINO PROYECCION': 'U17FEMPROY',
  'U17 FEMENINO PROFUNDIZACION': 'U17FEMPROY', // por si se corre con el JSON viejo
  'U17 MASCULINO PROYECCION': 'U17MASCPROY',
  'U17 MASCULINO PROFUNDIZACIÓN': 'U17MASCPROY', // idem
  'U17 MASCULINO COMPETENCIA': 'U17MASCCOMP',
  'U19 Y U21 FEMENINO': 'U19U21FEM',
  'U19 Y U21 MASCULINO': 'U19U21MASC',
  'MAYORES FEMENINO': 'MAYFEM',
  'MAYORES MASCULINO': 'MAYMASC',
  'MIXTO MAYORES PROFUNDIZACION': 'MAYMIXPROF',
};

// Los 12 pares de doble categoría confirmados por doc_number repetido (ver
// propuesta-pendientes / _reporte_datos_faltantes.json). Primaria = la
// categoría base; secundaria = la variante Proyección/Profundización.
// Formato: [doc_number, code_primaria, code_secundaria]
const DOBLE_CATEGORIA = [
  ['1031847289', 'U9U11', 'U13'],              // Alan Gabriel Cordoba Castillo
  ['1031836192', 'U13', 'U15FEMPROY'],          // Sara Sofia Nieto Lancheros
  ['1010967707', 'U13', 'U15FEMPROY'],          // María Alejandra Villamil Tabio
  ['1017062379', 'U13', 'U15FEMPROY'],          // Camila Piñeros Cárdenas
  ['1016960399', 'U13', 'U15FEMPROY'],          // Laura Valentina Muñoz Poveda
  ['1027290064', 'U13', 'U15FEMPROY'],          // Sara Lisseth Martínez Ortega
  ['1188219068', 'U13', 'U15MASC'],             // Nicolas Joseph Quecan Moreno
  ['1034306112', 'U13', 'U15MASC'],             // Lucas Javier Bello Castro
  ['1031822970', 'U17FEMPROY', 'MAYMIXPROF'],   // Laura Sofía Pedraza Sanchez
  ['1011086559', 'U19U21FEM', 'MAYMIXPROF'],    // Laura Daniela Vera Herrera
  ['1011090646', 'U19U21MASC', 'MAYMIXPROF'],   // David Santiago Paez Ortiz
  ['1000574446', 'MAYFEM', 'MAYMIXPROF'],       // María Camila Navarro Hernández
];

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

function armarIntakeFormData(a) {
  return {
    address: a.address, locality: a.locality, neighborhood: a.neighborhood,
    landline: a.landline, guardian_occupation: a.guardian_occupation,
    athlete_occupation: a.athlete_occupation, categoria_formulario: a.categoria_formulario,
    social_instagram: a.social_instagram, social_facebook: a.social_facebook, social_tiktok: a.social_tiktok,
  };
}

async function resolverOCrearTeam(code, nombreHoja, categorias) {
  const cat = categorias.find((c) => c.code === code);
  if (!cat) throw new Error(`No existe school_categories con code=${code} (hoja "${nombreHoja}")`);

  const existentes = await get(`teams?school_id=eq.${SCHOOL_ID}&category_id=eq.${cat.id}&select=id,name,category_id`);
  if (existentes.length > 0) return existentes[0];

  if (!CONFIRMAR) return { id: `(se crearía: ${nombreHoja})`, name: nombreHoja, category_id: cat.id };

  return post('teams', {
    school_id: SCHOOL_ID,
    name: nombreHoja,
    sport: 'Voleibol',
    branch_id: BRANCH_SUBA_ID,
    category_id: cat.id,
    age_group: nombreHoja,
    current_students: 0,
    active: true,
  });
}

async function main() {
  console.log(`Modo: ${CONFIRMAR ? 'ESCRITURA' : 'DRY-RUN (nada se escribe)'}\n`);

  const categorias = await get(`school_categories?school_id=eq.${SCHOOL_ID}&select=id,code,name`);
  const archivos = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));

  // ── Paso 1: asegurar los 13 equipos ────────────────────────────────────────
  const teamPorCode = {};
  for (const f of archivos) {
    const { hoja } = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
    const code = HOJA_A_CODE[hoja];
    if (!code) { console.log(`  ⚠ hoja "${hoja}" sin mapeo a categoría, se salta`); continue; }
    if (teamPorCode[code]) continue;
    const team = await resolverOCrearTeam(code, hoja, categorias);
    teamPorCode[code] = team;
    console.log(`Team ${code.padEnd(12)} (${hoja}): ${team.id.startsWith('(') ? team.id : 'ok -> ' + team.id}`);
  }

  // ── Paso 2: cargar atletas con doc_number (saltar los 19 incompletos) ─────
  const resumen = { insertados: 0, saltados_duplicado: 0, saltados_sin_doc: 0, errores: 0 };
  const idPorDoc = {}; // doc_number -> { unregistered_athlete_id, enrollment_id, code_primaria }

  for (const f of archivos) {
    const { hoja, atletas } = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
    const code = HOJA_A_CODE[hoja];
    if (!code) continue;
    const team = teamPorCode[code];
    const cat = categorias.find((c) => c.code === code);

    for (const a of atletas) {
      if (!a.doc_number || !a.doc_type) { resumen.saltados_sin_doc++; continue; }

      const dup = await get(`unregistered_athletes?school_id=eq.${SCHOOL_ID}&doc_number=eq.${a.doc_number}&select=id`);
      if (dup.length > 0) {
        resumen.saltados_duplicado++;
        idPorDoc[a.doc_number] = { unregistered_athlete_id: dup[0].id, enrollment_id: null, code_primaria: code };
        continue;
      }

      const payloadAtleta = {
        school_id: SCHOOL_ID, branch_id: BRANCH_SUBA_ID,
        full_name: a.full_name.trim(), doc_type: a.doc_type, doc_number: a.doc_number,
        date_of_birth: a.date_of_birth, email: a.athlete_email, phone: a.athlete_phone,
        guardian_phone: a.guardian_phone, guardian_email: a.guardian_email,
        blood_type: a.blood_type, eps_name: a.eps_name,
        health_screening: a.health_screening, intake_form_data: armarIntakeFormData(a),
        is_active: true,
      };

      if (!CONFIRMAR) {
        idPorDoc[a.doc_number] = { unregistered_athlete_id: '(pendiente)', enrollment_id: '(pendiente)', code_primaria: code };
        resumen.insertados++;
        continue;
      }

      try {
        const ua = await post('unregistered_athletes', payloadAtleta);
        const enr = await post('enrollments', {
          school_id: SCHOOL_ID, unregistered_athlete_id: ua.id,
          team_id: team.id, status: 'active', start_date: new Date().toISOString().slice(0, 10),
        });
        await post('enrollment_categories', {
          enrollment_id: enr.id, school_id: SCHOOL_ID, category_id: cat.id,
          team_id: team.id, is_primary: true, billable: true, status: 'active',
        });
        idPorDoc[a.doc_number] = { unregistered_athlete_id: ua.id, enrollment_id: enr.id, code_primaria: code };
        resumen.insertados++;
      } catch (err) {
        console.error(`  ERROR con ${a.full_name} (${a.doc_number}): ${err.message}`);
        resumen.errores++;
      }
    }
  }

  console.log('\nResumen carga principal:', resumen);

  // ── Paso 3: doble categoría (segunda fila en enrollment_categories) ───────
  console.log('\nDoble categoría:');
  for (const [doc, , codeSecundaria] of DOBLE_CATEGORIA) {
    const info = idPorDoc[doc];
    if (!info) { console.log(`  ${doc}: no se cargó en el paso 2 (¿está entre los 19 incompletos?), se salta`); continue; }

    const teamSecundario = teamPorCode[codeSecundaria];
    const catSecundaria = categorias.find((c) => c.code === codeSecundaria);

    if (!CONFIRMAR) {
      console.log(`  ${doc}: se agregaría categoría ${codeSecundaria} (equipo ${teamSecundario?.id})`);
      continue;
    }

    if (!info.enrollment_id) {
      // Era un duplicado ya existente — buscar su enrollment activo.
      const enrs = await get(`enrollments?unregistered_athlete_id=eq.${info.unregistered_athlete_id}&status=eq.active&select=id`);
      info.enrollment_id = enrs[0]?.id;
    }
    if (!info.enrollment_id) { console.log(`  ${doc}: sin enrollment activo, no se puede agregar categoría`); continue; }

    const yaExiste = await get(`enrollment_categories?enrollment_id=eq.${info.enrollment_id}&category_id=eq.${catSecundaria.id}&status=eq.active&select=id`);
    if (yaExiste.length > 0) { console.log(`  ${doc}: ya tenía la categoría ${codeSecundaria}`); continue; }

    try {
      await post('enrollment_categories', {
        enrollment_id: info.enrollment_id, school_id: SCHOOL_ID, category_id: catSecundaria.id,
        team_id: teamSecundario.id, is_primary: false, billable: true, status: 'active',
      });
      console.log(`  ${doc}: agregado ${codeSecundaria}`);
    } catch (err) {
      console.error(`  ${doc}: ERROR agregando ${codeSecundaria} -> ${err.message}`);
    }
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
