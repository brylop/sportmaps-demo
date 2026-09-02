// ============================================================================
// Dojo Fénix (Karate) — carga inicial de roster desde "BASE DE DATOS FENIX.xlsx"
// Escuela real ya existente: owner psico.xiomaradiaz@gmail.com (Merly Xiomara
// Díaz Piranquive), school_id abajo. onboarding_status ya estaba 'completed'
// pero sin ningún atleta cargado.
//
//   · POR DEFECTO NO ESCRIBE NADA. Sin --confirmar hace dry-run.
//   · 12 menores -> tabla `children`, con parent_id NULL y los datos del
//     responsable en parent_name_temp/parent_phone_temp/parent_email_temp
//     (se linkea cuando el padre se registre, vía claim_child_for_parent).
//   · 2 adultos sin responsable en el Excel (Ronald Ruiz Perez, Darío Peñuela)
//     -> cuenta de usuario real (auth.users vía /auth/v1/invite, envía correo
//     de invitación de Supabase) + enrollments.user_id.
//   · Equipo por edad a la fecha de hoy: <13 Infantil, 13-17 Juvenil, 18+
//     Adultos. La escuela tenía 'Adultos' y 'Juvenil' DUPLICADOS (creados con
//     1 min de diferencia el 2026-08-11, vacíos) — se usa el más antiguo de
//     cada par; los duplicados vacíos se dejan sin tocar.
//   · Cinturón -> school_categories (axis='age' por convención del schema,
//     belt=color) + enrollment_categories (is_primary:true, billable:true).
//     "FN" en el Excel se interpreta como "franja negra" (sub-nivel dentro
//     del color) y queda como categoría separada — a confirmar con la escuela.
//   · El "día de pago" del Excel (ej. "los 15") NO tiene campo propio en el
//     schema: los cobros se generan con `open_month`, que usa un solo
//     payment_cutoff_day por escuela (acá: día 10). Se llama open_month al
//     final para generar el cobro de 09/2026 de cada atleta recién inscrito.
//     Es idempotente (no duplica si ya existe un pago para ese periodo).
//
// Uso:
//   node scripts/dojo-fenix-import/01_importar.mjs                # dry-run
//   node scripts/dojo-fenix-import/01_importar.mjs --confirmar
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

const CONFIRMAR = process.argv.includes('--confirmar');

const SCHOOL_ID = '26bfb68e-87d4-4792-a1bb-3c65ef5358ce';
const BRANCH_ID = 'afa7ed1a-709e-4533-bc57-683099682382';
const TEAM_INFANTIL = 'ced892d9-363b-4627-8c28-7759808c31b3';
const TEAM_JUVENIL = '55cbff18-5446-4ff5-897c-f908f974756f'; // el más antiguo del par duplicado
const TEAM_ADULTOS = 'f83b7cb1-eeb6-49e6-94aa-056fbc994880'; // el más antiguo del par duplicado

const HOY = '2026-09-02'; // fecha de la corrida, para edad y start_date aproximado

const BELTS = [
  { code: 'blanco', name: 'Blanco', belt: 'Blanco' },
  { code: 'azul', name: 'Azul', belt: 'Azul' },
  { code: 'azul_fn', name: 'Azul FN', belt: 'Azul FN' },
  { code: 'naranja', name: 'Naranja', belt: 'Naranja' },
  { code: 'naranja_fn', name: 'Naranja FN', belt: 'Naranja FN' },
  { code: 'verde', name: 'Verde', belt: 'Verde' },
  { code: 'verde_fn', name: 'Verde FN', belt: 'Verde FN' },
];

// full_name, date_of_birth, tiempo_dojo (para start_date), belt_code,
// guardian_* (null si es adulto sin responsable -> crea cuenta propia)
const ATLETAS = [
  { full_name: 'Daniela Alexandra Estupiñán García', date_of_birth: '2007-08-21', tiempo: '2 años', belt: 'azul',
    guardian_name: 'Ever Armando Estupiñán Rivera', guardian_phone: '3178426566', guardian_email: 'alexapinan07@gmail.com' },
  { full_name: 'David Esteban Ruiz Zorro', date_of_birth: '2014-09-13', tiempo: '2 años, 8 meses', belt: 'azul_fn',
    guardian_name: 'Ronald Ruiz', guardian_phone: '3148143557', guardian_email: 'rarp9481@yahoo.es' },
  { full_name: 'Ronald Alexander Ruiz Perez', date_of_birth: '1981-04-09', tiempo: '2 años, 7 meses', belt: 'azul_fn',
    guardian_name: null, guardian_phone: '3148143557', guardian_email: 'rarp9481@yahoo.es', adulto: true },
  { full_name: 'Ana Lucía Camargo Ortiz', date_of_birth: '2017-11-28', tiempo: '2 meses', belt: 'blanco',
    guardian_name: 'Clara Lucía Ortiz Neira', guardian_phone: '3177069341', guardian_email: 'claralupe123@gmail.com' },
  { full_name: 'Yeid Natalia Camargo Hurtado', date_of_birth: '2002-07-06', tiempo: '1 mes', belt: 'blanco',
    guardian_name: null, guardian_phone: '3135672706', guardian_email: 'yeidnatalia03@gmail.com', adulto: true },
  { full_name: 'Juanita Valentina Páramo Briceño', date_of_birth: '2013-12-10', tiempo: '4 años', belt: 'azul',
    guardian_name: 'Ángela Sofía Briceño Prieto', guardian_phone: '3132919890', guardian_email: 'angelosbp@hotmail.com' },
  { full_name: 'Sofía Isabella Bolivar Moreno', date_of_birth: '2020-01-20', tiempo: '1 mes', belt: 'blanco',
    guardian_name: 'Julieth Camila Moreno Moreno', guardian_phone: '3125721956', guardian_email: 'juliethcamilamoreno2001@gmail.com' },
  { full_name: 'Anthuaneth Becerra Barón', date_of_birth: '2012-03-02', tiempo: '2 años', belt: 'azul',
    guardian_name: 'Nancy Barón', guardian_phone: '3183567021', guardian_email: 'nancyabl@gmail.com' },
  { full_name: 'Jhoshua Becerra Barón', date_of_birth: '2014-09-10', tiempo: '2 años', belt: 'naranja',
    guardian_name: 'Nancy Barón', guardian_phone: '3183567021', guardian_email: 'nancyabl@gmail.com' },
  { full_name: 'Samuel Mauricio Cristancho', date_of_birth: '2012-11-28', tiempo: '7 años', belt: 'verde',
    guardian_name: 'Oscar Mauricio Cristancho', guardian_phone: '3105868867', guardian_email: 'maucrys12@yahoo.es' },
  { full_name: 'Darío Alfredo Peñuela Infante', date_of_birth: '1977-07-11', tiempo: '4 años', belt: 'verde_fn',
    guardian_name: null, guardian_phone: '3133470768', guardian_email: '77artesmarciales@gmail.com', adulto: true },
  { full_name: 'Cristian Jooel Pineda Moreno', date_of_birth: '2016-03-16', tiempo: '3 años', belt: 'azul_fn',
    guardian_name: 'Carlos Pineda Muñoz', guardian_phone: '3214181563', guardian_email: 'morenomorenotanialorena@gmail.com' },
  { full_name: 'Karen Sofia Ibañez Moreno', date_of_birth: '2010-05-13', tiempo: '3 años', belt: 'azul',
    guardian_name: 'Tania Lorena Moreno', guardian_phone: '3222266885', guardian_email: 'morenomorenotanialorena@gmail.com' },
  { full_name: 'Eilyn Salome Jiménez Triana', date_of_birth: '2016-03-06', tiempo: '3 años', belt: 'naranja_fn',
    guardian_name: 'Aura Alicia Triana Sisa', guardian_phone: '3143494568', guardian_email: 'auradisegraf@hotmail.com' },
];

function edad(dob) {
  const [ay, am, ad] = dob.split('-').map(Number);
  const [hy, hm, hd] = HOY.split('-').map(Number);
  let a = hy - ay;
  if (hm < am || (hm === am && hd < ad)) a--;
  return a;
}

function teamPorEdad(dob) {
  const a = edad(dob);
  if (a < 13) return TEAM_INFANTIL;
  if (a < 18) return TEAM_JUVENIL;
  return TEAM_ADULTOS;
}

function startDateAprox(tiempoTexto) {
  const anios = Number((tiempoTexto.match(/(\d+)\s*año/) || [])[1] || 0);
  const meses = Number((tiempoTexto.match(/(\d+)\s*mes/) || [])[1] || 0);
  const d = new Date(HOY + 'T00:00:00Z');
  d.setUTCFullYear(d.getUTCFullYear() - anios);
  d.setUTCMonth(d.getUTCMonth() - meses);
  return d.toISOString().slice(0, 10);
}

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
const rpc = async (fn, args) => {
  const r = await fetch(`${BASE}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`RPC ${fn} -> ${t.slice(0, 500)}`);
  return JSON.parse(t);
};
const invite = async (email, data) => {
  const r = await fetch(`${BASE}/auth/v1/invite`, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, data }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`INVITE ${email} -> ${t.slice(0, 500)}`);
  return JSON.parse(t);
};

async function main() {
  console.log(`Modo: ${CONFIRMAR ? 'ESCRITURA' : 'DRY-RUN (nada se escribe)'}\n`);

  const resultado = { categorias: {}, children: [], adultos: [], errores: [] };

  // ── Paso 1: asegurar las 7 categorías de cinturón ──────────────────────
  const existentes = await get(`school_categories?school_id=eq.${SCHOOL_ID}&select=id,code`);
  const catPorCode = Object.fromEntries(existentes.map((c) => [c.code, c]));
  for (const b of BELTS) {
    if (catPorCode[b.code]) { console.log(`Categoría ${b.code}: ya existe -> ${catPorCode[b.code].id}`); continue; }
    if (!CONFIRMAR) { console.log(`Categoría ${b.code}: se crearía (${b.name})`); continue; }
    const cat = await post('school_categories', {
      school_id: SCHOOL_ID, sport: 'Karate', code: b.code, name: b.name, belt: b.belt, is_active: true,
    });
    catPorCode[b.code] = cat;
    resultado.categorias[b.code] = cat.id;
    console.log(`Categoría ${b.code}: creada -> ${cat.id}`);
  }

  // ── Paso 2: menores -> children + enrollments + enrollment_categories ──
  console.log('\nMenores:');
  for (const a of ATLETAS.filter((x) => !x.adulto)) {
    const team_id = teamPorEdad(a.date_of_birth);
    const start_date = startDateAprox(a.tiempo);
    const cat = catPorCode[a.belt];

    if (!CONFIRMAR) {
      console.log(`  ${a.full_name}: team=${team_id} start=${start_date} belt=${a.belt} (dry-run)`);
      continue;
    }
    try {
      const child = await post('children', {
        school_id: SCHOOL_ID, branch_id: BRANCH_ID, team_id,
        full_name: a.full_name, date_of_birth: a.date_of_birth,
        parent_name_temp: a.guardian_name, parent_phone_temp: a.guardian_phone, parent_email_temp: a.guardian_email,
        is_active: true,
      });
      const enr = await post('enrollments', {
        school_id: SCHOOL_ID, child_id: child.id, team_id, status: 'active', start_date,
      });
      // team_id se deja NULL a propósito: trg_enrollment_categories_check_team exige que,
      // si se manda, teams.category_id == category_id — y acá el equipo es por EDAD
      // (Infantil/Juvenil/Adultos), no por cinturón, así que no comparten fila.
      await post('enrollment_categories', {
        enrollment_id: enr.id, school_id: SCHOOL_ID, category_id: cat.id,
        is_primary: true, billable: true, status: 'active',
      });
      resultado.children.push({ full_name: a.full_name, child_id: child.id, enrollment_id: enr.id });
      console.log(`  ${a.full_name}: child=${child.id} enrollment=${enr.id}`);
    } catch (err) {
      console.error(`  ERROR con ${a.full_name}: ${err.message}`);
      resultado.errores.push({ full_name: a.full_name, error: err.message });
    }
  }

  // ── Paso 3: adultos -> cuenta propia + enrollments.user_id ─────────────
  console.log('\nAdultos (cuenta propia):');
  for (const a of ATLETAS.filter((x) => x.adulto)) {
    const team_id = teamPorEdad(a.date_of_birth);
    const start_date = startDateAprox(a.tiempo);
    const cat = catPorCode[a.belt];

    if (!CONFIRMAR) {
      console.log(`  ${a.full_name}: se invitaría a ${a.guardian_email}, team=${team_id} (dry-run)`);
      continue;
    }
    try {
      const inv = await invite(a.guardian_email, {
        role: 'athlete', full_name: a.full_name, phone: a.guardian_phone, date_of_birth: a.date_of_birth,
      });
      const userId = inv.id || inv.user?.id;
      if (!userId) throw new Error(`invite no devolvió id: ${JSON.stringify(inv).slice(0, 300)}`);

      await post('school_members', {
        profile_id: userId, school_id: SCHOOL_ID, role: 'athlete', status: 'active', joined_at: new Date().toISOString(),
      });
      const enr = await post('enrollments', {
        school_id: SCHOOL_ID, user_id: userId, team_id, status: 'active', start_date,
      });
      await post('enrollment_categories', {
        enrollment_id: enr.id, school_id: SCHOOL_ID, category_id: cat.id,
        is_primary: true, billable: true, status: 'active',
      });
      resultado.adultos.push({ full_name: a.full_name, user_id: userId, enrollment_id: enr.id, email: a.guardian_email });
      console.log(`  ${a.full_name}: user=${userId} enrollment=${enr.id} (invitación enviada a ${a.guardian_email})`);
    } catch (err) {
      console.error(`  ERROR con ${a.full_name}: ${err.message}`);
      resultado.errores.push({ full_name: a.full_name, error: err.message });
    }
  }

  // ── Paso 4: abrir el mes 09/2026 -> genera el cobro pendiente de c/u ────
  if (CONFIRMAR && resultado.errores.length === 0) {
    console.log('\nAbriendo mes 09/2026 (genera cobro pendiente por atleta)...');
    const r = await rpc('open_month', { p_school_id: SCHOOL_ID, p_year: 2026, p_month: 9 });
    console.log('  ', r);
  } else if (CONFIRMAR) {
    console.log('\nHubo errores arriba: NO se abre el mes automáticamente. Revisar antes de correr open_month a mano.');
  }

  if (CONFIRMAR) {
    const outPath = path.join(HERE, `resultado_${Date.now()}.json`);
    fs.writeFileSync(outPath, JSON.stringify(resultado, null, 2), 'utf8');
    console.log(`\nResultado guardado en ${outPath} (usar para rollback si hace falta)`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
