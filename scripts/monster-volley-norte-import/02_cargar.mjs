// ============================================================================
// Monster's Volley Club (Sede Norte) — carga del roster tabular.
//
//   · POR DEFECTO NO ESCRIBE NADA. Sin --confirmar hace dry-run.
//   · Norte no comparte categorías con Suba: sus grupos van por año de
//     nacimiento (Mini, Benjamines, Infantil, Menores, Juvenil, Mayores).
//     Se crean 9 school_categories con branch_id = Norte y un team por cada
//     una (decisión del 2026-10-14: categorías propias de la sede).
//   · Mariana Fernanda Suárez Ramos (nacida 2012) marcó Juvenil femenino y se
//     respeta lo que marcó (decisión del 2026-10-14).
//   · Salta filas sin doc_number (Samantha Acuña Rojas: solo trae el nombre).
//   · Mismo patrón que Suba: unregistered_athletes + enrollments +
//     enrollment_categories (is_primary). Sin plan ni cobros.
//
// Uso:
//   node scripts/monster-volley-norte-import/02_cargar.mjs              # dry-run
//   node scripts/monster-volley-norte-import/02_cargar.mjs --confirmar
// Escribe data/ids.json (doc_number -> unregistered_athlete_id) para el paso
// de documentos.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const DATA = JSON.parse(fs.readFileSync(path.join(HERE, 'data/hoja-1.json'), 'utf8'));

const CONFIRMAR = process.argv.includes('--confirmar');

const SCHOOL_ID = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c';
const BRANCH_NORTE_ID = 'e2918c8d-b510-4f7f-9b05-e73a5e8edb68';

// Prefijo del formulario (antes del paréntesis) -> categoría de Norte.
const CATEGORIAS = [
  { prefijo: 'mini volei mixto',   code: 'NMINIMIX', name: 'MINI VOLEY MIXTO (NORTE)',  rama: 'Mixto',     min: 2013, max: 2014 },
  { prefijo: 'benjamines mixto',   code: 'NBENJMIX', name: 'BENJAMINES MIXTO (NORTE)',  rama: 'Mixto',     min: 2015, max: 2016 },
  { prefijo: 'infantil femenino',  code: 'NINFFEM',  name: 'INFANTIL FEMENINO (NORTE)', rama: 'Femenino',  min: 2011, max: 2012 },
  { prefijo: 'menores femenino',   code: 'NMENFEM',  name: 'MENORES FEMENINO (NORTE)',  rama: 'Femenino',  min: 2009, max: 2010 },
  { prefijo: 'menores masculino',  code: 'NMENMASC', name: 'MENORES MASCULINO (NORTE)', rama: 'Masculino', min: 2009, max: 2010 },
  { prefijo: 'juvenil femenino',   code: 'NJUVFEM',  name: 'JUVENIL FEMENINO (NORTE)',  rama: 'Femenino',  min: 2007, max: 2008 },
  { prefijo: 'juvenil masculino',  code: 'NJUVMASC', name: 'JUVENIL MASCULINO (NORTE)', rama: 'Masculino', min: 2007, max: 2008 },
  { prefijo: 'mayores femenino',   code: 'NMAYFEM',  name: 'MAYORES FEMENINO (NORTE)',  rama: 'Femenino',  min: null, max: 2006 },
  { prefijo: 'mayores masculino',  code: 'NMAYMASC', name: 'MAYORES MASCULINO (NORTE)', rama: 'Masculino', min: null, max: 2006 },
];
const categoriaDe = (texto) => {
  const k = (texto || '').split('(')[0].trim().toLowerCase();
  return CATEGORIAS.find((c) => c.prefijo === k) || null;
};

// Limpieza mínima de lo que se tecleó en el formulario.
const VACIOS = new Set(['na', 'n/a', 'no', 'ninguno', '-', '.']);
const limpio = (v) => (v == null || VACIOS.has(String(v).trim().toLowerCase()) ? null : String(v).trim());
const email = (v) => limpio(v)?.toLowerCase() ?? null;
const telefono = (v) => { const s = limpio(v); return s && /\d{7,}/.test(s.replace(/\D/g, '')) ? s.replace(/\D/g, '') : null; };
const MINUSCULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y']);
const nombrePropio = (s) => s.trim().replace(/\s+/g, ' ').toLowerCase().split(' ')
  .map((w, i) => (i > 0 && MINUSCULAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');

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

async function asegurarCategoriaYTeam(c, existentes) {
  let cat = existentes.find((x) => x.code === c.code);
  if (!cat) {
    if (!CONFIRMAR) return { cat: { id: '(nueva)' }, team: { id: '(nuevo)' } };
    cat = await post('school_categories', {
      school_id: SCHOOL_ID, branch_id: BRANCH_NORTE_ID, sport: 'voleibol',
      code: c.code, name: c.name, rama: c.rama, axis: 'age', age_rule: 'birth_year',
      birth_year_min: c.min, birth_year_max: c.max, is_active: true,
    });
  }
  const teams = await get(`teams?school_id=eq.${SCHOOL_ID}&category_id=eq.${cat.id}&select=id,name`);
  if (teams.length > 0) return { cat, team: teams[0] };
  if (!CONFIRMAR) return { cat, team: { id: '(nuevo)' } };
  const team = await post('teams', {
    school_id: SCHOOL_ID, name: c.name, sport: 'Voleibol', branch_id: BRANCH_NORTE_ID,
    category_id: cat.id, age_group: c.name, current_students: 0, active: true,
  });
  return { cat, team };
}

async function main() {
  console.log(`Modo: ${CONFIRMAR ? 'ESCRITURA' : 'DRY-RUN (nada se escribe)'}\n`);

  const existentes = await get(`school_categories?school_id=eq.${SCHOOL_ID}&is_active=eq.true&select=id,code`);
  const usadas = new Set(DATA.atletas.map((a) => categoriaDe(a.categoria_formulario)?.code).filter(Boolean));

  const porCode = {};
  for (const c of CATEGORIAS.filter((x) => usadas.has(x.code))) {
    porCode[c.code] = await asegurarCategoriaYTeam(c, existentes);
    console.log(`${c.code.padEnd(9)} cat=${porCode[c.code].cat.id}  team=${porCode[c.code].team.id}`);
  }

  const idsPath = path.join(HERE, 'data/ids.json');
  const ids = fs.existsSync(idsPath) ? JSON.parse(fs.readFileSync(idsPath, 'utf8')) : {};
  const resumen = { insertados: 0, ya_existian: 0, saltados_sin_doc: 0, sin_categoria: 0, errores: 0 };
  console.log('');

  for (const a of DATA.atletas) {
    if (!a.doc_number || !a.doc_type) { console.log(`  SALTA (sin documento): ${a.full_name}`); resumen.saltados_sin_doc++; continue; }
    const c = categoriaDe(a.categoria_formulario);
    if (!c) { console.log(`  SALTA (categoría "${a.categoria_formulario}" sin mapeo): ${a.full_name}`); resumen.sin_categoria++; continue; }

    const dup = await get(`unregistered_athletes?school_id=eq.${SCHOOL_ID}&doc_number=eq.${a.doc_number}&select=id`);
    if (dup.length > 0) { ids[a.doc_number] = dup[0].id; resumen.ya_existian++; console.log(`  ya existe: ${a.full_name}`); continue; }

    // En una fila el "celular del acudiente" trae el NOMBRE del acudiente.
    const guardianPhoneRaw = limpio(a.guardian_phone);
    const guardianNombreEnTelefono = guardianPhoneRaw && !/\d/.test(guardianPhoneRaw) ? nombrePropio(guardianPhoneRaw) : null;

    const payload = {
      school_id: SCHOOL_ID, branch_id: BRANCH_NORTE_ID,
      full_name: nombrePropio(a.full_name), doc_type: a.doc_type, doc_number: a.doc_number,
      date_of_birth: a.date_of_birth, email: email(a.athlete_email), phone: telefono(a.athlete_phone),
      guardian_phone: telefono(a.guardian_phone), guardian_email: email(a.guardian_email),
      ...(guardianNombreEnTelefono ? { guardian_full_name: guardianNombreEnTelefono } : {}),
      blood_type: limpio(a.blood_type), eps_name: limpio(a.eps_name),
      health_screening: a.health_screening,
      intake_form_data: {
        address: a.address, locality: a.locality, neighborhood: a.neighborhood,
        landline: limpio(a.landline), guardian_occupation: a.guardian_occupation,
        athlete_occupation: a.athlete_occupation, categoria_formulario: a.categoria_formulario,
        social_instagram: limpio(a.social_instagram), social_facebook: limpio(a.social_facebook),
        social_tiktok: limpio(a.social_tiktok), sede: 'Norte',
      },
      is_active: true,
    };

    if (!CONFIRMAR) {
      console.log(`  + ${payload.full_name.padEnd(34)} ${a.doc_number.padEnd(11)} ${c.code.padEnd(9)} acud=${payload.guardian_phone ?? '-'} ${payload.guardian_email ?? '-'}${guardianNombreEnTelefono ? ` (${guardianNombreEnTelefono})` : ''}`);
      resumen.insertados++;
      continue;
    }

    try {
      const { cat, team } = porCode[c.code];
      const ua = await post('unregistered_athletes', payload);
      const enr = await post('enrollments', {
        school_id: SCHOOL_ID, unregistered_athlete_id: ua.id,
        team_id: team.id, status: 'active', start_date: new Date().toISOString().slice(0, 10),
      });
      await post('enrollment_categories', {
        enrollment_id: enr.id, school_id: SCHOOL_ID, category_id: cat.id,
        team_id: team.id, is_primary: true, billable: true, status: 'active',
      });
      ids[a.doc_number] = ua.id;
      resumen.insertados++;
      console.log(`  ✓ ${payload.full_name} -> ${ua.id}`);
    } catch (err) {
      console.error(`  ERROR con ${a.full_name} (${a.doc_number}): ${err.message}`);
      resumen.errores++;
    }
  }

  if (CONFIRMAR) fs.writeFileSync(idsPath, JSON.stringify(ids, null, 2));
  console.log('\nResumen:', resumen);
}

main().catch((err) => { console.error(err); process.exit(1); });
