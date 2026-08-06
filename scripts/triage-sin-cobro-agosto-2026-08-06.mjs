// ============================================================================
// SportMaps — TRIAGE de los 26 «sin cobro de agosto» (Dynasty Volley Club)
//
// SOLO LECTURA. Ni un INSERT, ni un UPDATE, ni una RPC de emisión. Termina en un
// reporte y nada más. Es el prerrequisito del paso 7 del plan P0: hasta que este
// triage cierre, no se emite ningún cobro.
//
// POR QUÉ EXISTE
// La lista de 26 «sin cobro generado» NO es una cola de emisión. Mezcla cuatro
// cosas que se ven iguales en un listado por nombre:
//   · identidades duplicadas cuyo gemelo YA tiene el cobro (emitir = doble cobro)
//   · inscripciones sin plan ni equipo (no hay monto que emitir)
//   · acudientes rotos (el cobro no le llega a nadie)
//   · candidatos legítimos
// Ya está demostrado que el criterio por nombre falla y que cada refinamiento
// movió gente de bucket. Acá se decide POR ID y POR EVIDENCIA DE LA BASE.
//
// LA DIMENSIÓN QUE FALTABA: EL ORIGEN
// De dónde salió cada registro es lo que separa la ficha precargada legítima de
// la fila duplicada del auto-registro. Se clasifica en cuatro orígenes
// (`carga_masiva`, `invitacion`, `qr_autoregistro`, `alta_manual`) a partir de
// la ráfaga de inserts del onboarding, que el script DETECTA, no asume.
//
// ESQUEMA: LEÍDO DE LA BASE VIVA, NO DE LAS MIGRACIONES
// `supabase/migrations/` no reproduce esta base (hay deriva sin versionar), así
// que las columnas de acá salen de introspección de la base real. Dos hallazgos
// que rompen la consulta de origen tal como venía en el spec:
//   · `invitations` NO tiene `child_id`. Tiene `child_name` (texto) y `email`.
//     El cruce invitación↔identidad es por nombre normalizado + correo, y por eso
//     es una señal DÉBIL, no una prueba. Se reporta como tal.
//   · `unregistered_athletes` sí tiene `invitation_id` (cruce fuerte), pero en
//     Dynasty casi nadie lo trae.
// Lo que no se puede leer por PostgREST (cuerpo de funciones y triggers) va en
// `scripts/verificacion-esquema-triage-2026-08-06.sql`.
//
// REUTILIZACIÓN (regla del spec: no una tercera implementación del matching)
// El pesaje de parejas —`evaluar()`, `lev()`, `normName()`— es copia citada de
// `scripts/audit-duplicate-athletes.mjs`. La noción de «cobro vivo» y la cadena
// del monto son copia citada de la RPC `open_month`
// (`supabase/migrations/20260803114540_open_month_distinct_athlete.sql`), para
// que el monto del bucket D sea el que la emisión realmente va a producir.
//
// Uso:
//   node scripts/triage-sin-cobro-agosto-2026-08-06.mjs
//   node scripts/triage-sin-cobro-agosto-2026-08-06.mjs --md docs/triage-....md
//   node scripts/triage-sin-cobro-agosto-2026-08-06.mjs --json salida.json
//   node scripts/triage-sin-cobro-agosto-2026-08-06.mjs --school "Dynasty"
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };

const BUSCAR_ESCUELA = (arg('school') || 'Dynasty').trim();
const SALIDA_MD = arg('md') ?? path.join(ROOT, 'docs/triage-sin-cobro-agosto-2026-08-06.md');
const SALIDA_JSON = arg('json');

// ── Los 26 del listado ───────────────────────────────────────────────────────
// Semilla, NO verdad: son los nombres tal como salieron en pantalla. Resolverlos
// a IDs es el paso 1 y puede fallar — quien no resuelva cae al bucket E.
const LOS_26 = [
  'ANAISABEL MONDRAGON MEJIA', 'CRISTIAN DAVID CASTILLO TAPIAS', 'DAYANY ECHAVARRIA VARON',
  'Dilan Yadiel Gaona Martin', 'HADE SOFIA PRADA ACERO', 'Jerónimo Balaguera Barrera',
  'Josue Cortes Saenz', 'JUAN JOSE PEÑA', 'JUAN SEBASTIAN ROMERO AGUDELO',
  'Julieta Mayorga Veloza', 'Lauren soffia Garcia bohorquez', 'María Natalia Lemus Díaz',
  'MARIA PAULA CALDERON MONTENEGRO', 'MARIA PAULA ESCOBAR BENITEZ', 'Miguel Ángel Runza Ramírez',
  'SALOME MONTENEGRO PIEDRAHITA', 'SALOME PAMPLONA MARIN', 'Samuel Puentes Barrera',
  'Sara Camila Bejarano', 'SERGIO HERRERA TORRES', 'Sergio Soler Suárez',
  'SHARITH ENCISO BARON', 'Sofia Anaya', 'Sofia Valentina Barón Chacón',
  'VALENTINA CASTELLANOS CUETO', 'VICTORIA OSORIO MARTINEZ',
];

// El historial de anulación NO se lee de una lista de nombres. El spec traía los
// nombres de las 5 anulaciones del 5-ago y los 3 duplicados posteriores, pero
// cruzarlos por nombre es exactamente el error que este triage existe para no
// repetir ("Buitrago" o "MARIA CAMILA" pegan con cualquiera). La evidencia está
// en la base: un payment del período en estado terminal. Eso es la marca.

// Dominios mal escritos ya detectados en el chequeo 13b de cartera. Un cobro que
// sale a uno de estos no le llega a nadie.
const DOMINIOS_CON_TYPO = [
  'gmail.co', 'gmail.con', 'gmail.om', 'gmai.com', 'gmial.com', 'gmail.cm',
  'hormail.com', 'hotmial.com', 'hotmail.co', 'hotmai.com', 'homtail.com',
  'outlok.com', 'yahoo.es.com', 'hotmail.con',
];

// ── Conexión ─────────────────────────────────────────────────────────────────
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, 'bff/.env'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [
      l.slice(0, l.indexOf('=')).trim(),
      l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, ''),
    ]),
);
const BASE = (env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!BASE || !KEY) {
  console.error('Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en bff/.env');
  process.exit(1);
}
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}` };

/** GET paginado. PostgREST corta en 1000 filas y acá hay tablas más grandes. */
async function api(tabla, query) {
  const filas = [];
  const PAGE = 1000;
  for (let off = 0; ; off += PAGE) {
    const url = `${BASE}/rest/v1/${tabla}?${query}&limit=${PAGE}&offset=${off}`;
    const r = await fetch(url, { headers: HEADERS });
    const txt = await r.text();
    if (!r.ok) throw new Error(`${tabla}: ${txt.slice(0, 300)}`);
    const j = JSON.parse(txt);
    filas.push(...j);
    if (j.length < PAGE) break;
  }
  return filas;
}

// ── Normalización — copia citada de audit-duplicate-athletes.mjs ─────────────
const sinTildes = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const normName = (s) => sinTildes(s).toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s) => normName(s).split(' ').filter((t) => t.length >= 3);
const digitos = (d) => String(d || '').replace(/\D/g, '');
const localPart = (e) => String(e || '').split('@')[0].toLowerCase();
const dominio = (e) => String(e || '').split('@')[1]?.toLowerCase() ?? '';
const money = (n) => '$' + Number(n || 0).toLocaleString('es-CO');

/** Distancia de Levenshtein. Copia citada: pesca el typo de un dígito (…373 vs …393). */
function lev(a, b) {
  a = String(a || ''); b = String(b || '');
  const m = a.length, n = b.length;
  if (!m || !n) return Math.max(m, n);
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

/**
 * Pesaje de una pareja de identidades. Copia citada de audit-duplicate-athletes.mjs,
 * con el FILTRO DE HOMÓNIMOS que exige el spec endurecido encima:
 *
 * la lección de las tres «VICTORIA GOMEZ» es que el nombre NUNCA agrupa solo. Acá
 * se separa explícitamente el veredicto (¿qué tan parecidas son?) de la licencia
 * para agrupar (`agrupa`), que exige una segunda señal dura: documento (con
 * tolerancia a un dígito), fecha de nacimiento, o acudiente.
 */
function evaluar(a, b) {
  const ta = new Set(tokens(a.name)), tb = new Set(tokens(b.name));
  const inter = [...ta].filter((t) => tb.has(t));
  const nombreIgual = ta.size === tb.size && inter.length === ta.size;
  const nombreContenido = !nombreIgual && inter.length >= 2 && (inter.length === ta.size || inter.length === tb.size);
  const nombreCoincide = nombreIgual || nombreContenido;

  const da = digitos(a.doc), db = digitos(b.doc);
  const dosDocs = da.length >= 5 && db.length >= 5;
  const docIgual = dosDocs && da === db;
  const docCasi = dosDocs && !docIgual && lev(da, db) <= 1;   // el typo conocido de 1 dígito
  const docDistinto = dosDocs && !docIgual && !docCasi;

  const dosDob = !!a.dob && !!b.dob;
  const dobIgual = dosDob && String(a.dob).slice(0, 10) === String(b.dob).slice(0, 10);
  const dobDistinto = dosDob && !dobIgual;

  // El acudiente cuenta como señal dura: mismo parent_id, o correo de acudiente
  // igual / casi igual (los typos de dominio son endémicos en este tenant).
  const acudienteIgual = !!a.parent_id && a.parent_id === b.parent_id;
  const ea = localPart(a.email_acudiente), eb = localPart(b.email_acudiente);
  const mailIgual = !!ea && ea === eb;
  const mailCasi = !!ea && !!eb && !mailIgual && ea.length > 4 && lev(ea, eb) <= 2;

  const segundaSenal = docIgual || docCasi || dobIgual || acudienteIgual || mailIgual || mailCasi;

  const razones = [];
  let veredicto;
  if (docIgual && nombreCoincide) { veredicto = 'CONFIRMADO'; razones.push('mismo documento + mismo nombre'); }
  else if (docIgual) { veredicto = 'DOC_REPETIDO'; razones.push(`mismo documento (${da}) con nombres distintos → documento mal digitado`); }
  else if (nombreCoincide && docCasi) { veredicto = 'CONFIRMADO'; razones.push(`documento con un dígito de diferencia (${da} vs ${db})`); }
  else if (nombreCoincide && dobIgual) { veredicto = 'CONFIRMADO'; razones.push('mismo nombre + misma fecha de nacimiento'); }
  else if (nombreCoincide && acudienteIgual) { veredicto = 'CONFIRMADO'; razones.push('mismo nombre + mismo acudiente (parent_id)'); }
  else if (nombreCoincide && (mailIgual || mailCasi)) { veredicto = 'CONFIRMADO'; razones.push(mailIgual ? 'mismo nombre + mismo correo de acudiente' : `mismo nombre + correo de acudiente casi igual (${ea} vs ${eb})`); }
  else if (nombreCoincide) { veredicto = 'SOLO_NOMBRE'; razones.push('coincide el nombre y NADA más → puede ser homónimo, no agrupa'); }
  else { veredicto = 'DISTINTAS'; razones.push('ni el nombre coincide'); }

  if (dobDistinto) razones.push(`fechas de nacimiento distintas (${String(a.dob).slice(0, 10)} vs ${String(b.dob).slice(0, 10)})`);
  if (docDistinto) razones.push(`documentos distintos (${da} vs ${db})`);

  // AGRUPA solo con nombre + segunda señal. Un doc repetido con nombres distintos
  // NO agrupa: es un error de digitación, no una persona repetida.
  const agrupa = nombreCoincide && segundaSenal;
  return { veredicto, razones, agrupa, docCasi, docDistinto, dobDistinto };
}

// ── Estados: copia citada de open_month, no inventados ───────────────────────
// `open_month` considera que un atleta YA tiene cobro del período si existe un
// payment en estos estados. Usar el mismo set es lo que hace que este triage
// prediga lo que la emisión real va a hacer.
const VIVOS = new Set(['pending', 'awaiting_approval', 'paid', 'partial', 'overdue', 'glosado']);
const PAGADOS = new Set(['paid', 'partial']);
// El dominio completo lo fija `payments_status_check` en la base:
//   pending, paid, overdue, failed, cancelled, awaiting_approval, rejected, partial, glosado
// Terminal = todo lo que no es vivo. Nada de 'void'/'refunded'/'canceled': no son
// valores legales, y ponerlos "por si acaso" sugiere estados que no existen.
const TERMINALES = new Set(['cancelled', 'rejected', 'failed']);

/**
 * Cadena canónica del monto — copia citada de `open_month`:
 *   COALESCE(NULLIF(e.monthly_fee,0), NULLIF(op.price,0),
 *            NULLIF(t.price_monthly,0), NULLIF(c.monthly_fee,0), 0)
 * NO se usa children.monthly_fee directo (la lección de C-03): es el ÚLTIMO
 * escalón, no el primero.
 *
 * CONFIRMADO contra la base viva el 2026-08-06 con el bloque 1 de
 * `scripts/verificacion-esquema-triage-2026-08-06.sql`: la `open_month` real es
 * idéntica a la del repo. El monto del bucket D es el que la emisión producirá.
 */
function montoCanonico(enr, plan, team, child) {
  const escalones = [
    { fuente: 'enrollments.monthly_fee', valor: Number(enr?.monthly_fee || 0) },
    { fuente: 'offering_plans.price', valor: Number(plan?.price || 0) },
    { fuente: 'teams.price_monthly', valor: Number(team?.price_monthly || 0) },
    { fuente: 'children.monthly_fee', valor: Number(child?.monthly_fee || 0) },
  ];
  const ganador = escalones.find((e) => e.valor > 0);
  return { monto: ganador?.valor ?? 0, fuente: ganador?.fuente ?? '(ninguna: cuota 0)' };
}

/** Hoy en Colombia, no en UTC. */
const hoyCO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const [ANIO, MES] = hoyCO.split('-').map(Number);

// ============================================================================
const main = async () => {
  // ── Escuela: por nombre, no por UUID hardcodeado ──────────────────────────
  const escuelas = await api('schools', `select=id,name,slug&name=ilike.*${encodeURIComponent(BUSCAR_ESCUELA)}*`);
  if (escuelas.length !== 1) {
    console.error(`"${BUSCAR_ESCUELA}" resolvió a ${escuelas.length} escuelas: ${escuelas.map((e) => e.name).join(', ') || '(ninguna)'}`);
    process.exit(1);
  }
  const ESCUELA = escuelas[0];
  const S = ESCUELA.id;

  const [
    kids, uas, members, enrs, pays, planes, equipos, invitaciones, ajustes,
  ] = await Promise.all([
    api('children', `select=id,full_name,doc_number,date_of_birth,parent_id,parent_email_temp,parent_name_temp,parent_phone_temp,team_id,monthly_fee,is_active,created_at&school_id=eq.${S}`),
    api('unregistered_athletes', `select=id,full_name,doc_number,date_of_birth,email,phone,is_active,linked_profile_id,invitation_id,created_at&school_id=eq.${S}`),
    api('school_members', `select=profile_id,role,status,created_at&school_id=eq.${S}`),
    api('enrollments', `select=id,child_id,user_id,unregistered_athlete_id,team_id,offering_plan_id,status,monthly_fee,start_date,created_at&school_id=eq.${S}`),
    api('payments', `select=id,child_id,user_id,unregistered_athlete_id,parent_id,status,amount,concept,due_date,payment_date,period_year,period_month,created_at&school_id=eq.${S}`),
    api('offering_plans', `select=id,name,price&school_id=eq.${S}`),
    api('teams', `select=id,name,price_monthly&school_id=eq.${S}`),
    api('invitations', `select=id,email,child_name,role_to_assign,status,created_at,team_id,offering_plan_id,monthly_fee&school_id=eq.${S}`),
    api('school_settings', `select=payment_cutoff_day,payment_grace_days&school_id=eq.${S}`),
  ]);

  // ── Rastro de anulaciones ─────────────────────────────────────────────────
  // Hace falta porque en Dynasty hay 163 cobros de agosto anulados repartidos en
  // dos semanas: decir "tuvo un cobro anulado" no informa nada. Lo que informa es
  // POR QUÉ se anuló — así se separa la anulación por duplicado (no volver a
  // emitir) de la anulación por monto mal puesto (sí, corregido).
  //
  // La fuente es `audit_logs` (trigger `trg_audit_payments`), no
  // `payment_audit_logs`: esta última existe y tiene 3178 filas, pero su
  // `school_id` viene NULL, así que no se puede filtrar por escuela. `audit_logs`
  // sí lo trae, y además guarda el motivo en `new_data` — las 5 anulaciones del
  // 5-ago están ahí con `action = 'cancel_duplicate_charge'` y el texto completo.
  const auditoriaCobros = await api('audit_logs',
    `select=record_id,action,profile_id,created_at,new_data&table_name=eq.payments&school_id=eq.${S}`);
  const auditPorCobro = new Map();
  for (const a of auditoriaCobros) {
    if (!a.record_id) continue;
    if (!auditPorCobro.has(a.record_id)) auditPorCobro.set(a.record_id, []);
    auditPorCobro.get(a.record_id).push(a);
  }

  // Perfiles: los de los miembros (atletas adultos y acudientes) + los parent_id.
  const idsPerfil = [...new Set([
    ...members.map((m) => m.profile_id),
    ...kids.map((k) => k.parent_id),
    ...enrs.map((e) => e.user_id),
    ...pays.map((p) => p.parent_id),
    ...auditoriaCobros.map((a) => a.profile_id),   // quién anuló
  ].filter(Boolean))];
  const profs = [];
  for (let i = 0; i < idsPerfil.length; i += 100) {
    profs.push(...await api('profiles', `select=id,full_name,email,phone,date_of_birth,document_number,role&id=in.(${idsPerfil.slice(i, i + 100).join(',')})`));
  }

  // ── ¿El acudiente "de texto" ya tiene cuenta? ─────────────────────────────
  // Un menor puede traer acudiente en `parent_email_temp` sin `parent_id`: hay a
  // quién escribirle pero NO hay pagador, y el padre recibe 403 al intentar pagar.
  // La acción cambia por completo según si ese correo ya corresponde a un perfil
  // (basta vincular) o no existe (hay que crear la cuenta), así que se verifica.
  const correosTemp = [...new Set(kids.map((k) => String(k.parent_email_temp || '').toLowerCase().trim()).filter(Boolean))];
  const perfilesPorCorreo = new Map();
  for (let i = 0; i < correosTemp.length; i += 50) {
    const lote = correosTemp.slice(i, i + 50).map((e) => `"${e}"`).join(',');
    const encontrados = await api('profiles', `select=id,full_name,email,role&email=in.(${encodeURIComponent(lote)})`);
    for (const p of encontrados) perfilesPorCorreo.set(String(p.email).toLowerCase(), p);
  }

  const porId = (arr) => new Map(arr.map((x) => [x.id, x]));
  const idxKid = porId(kids), idxUa = porId(uas), idxProf = porId(profs);
  const idxPlan = porId(planes), idxTeam = porId(equipos);
  const rolMiembro = new Map(members.map((m) => [m.profile_id, m]));

  // ── Ventana de la carga masiva: DETECTADA, no asumida ─────────────────────
  // El onboarding entra en ráfaga: cientos de inserts en pocos minutos, varios
  // con el mismo timestamp al microsegundo. Un alta manual es una fila suelta.
  // Se agrupa por minuto y se toma como ráfaga todo minuto con ≥ UMBRAL filas;
  // la ventana es el rango contiguo que cubren esos minutos.
  const UMBRAL_RAFAGA = 20;
  function detectarRafaga(filas) {
    const porMinuto = new Map();
    for (const f of filas) {
      const k = String(f.created_at || '').slice(0, 16);
      if (!k) continue;
      porMinuto.set(k, (porMinuto.get(k) || 0) + 1);
    }
    const minutos = [...porMinuto.entries()].filter(([, n]) => n >= UMBRAL_RAFAGA).map(([m]) => m).sort();
    if (!minutos.length) return null;
    const dentro = filas.filter((f) => minutos.includes(String(f.created_at || '').slice(0, 16)));
    const ts = dentro.map((f) => f.created_at).sort();
    return { desde: ts[0], hasta: ts.at(-1), filas: dentro.length, minutos: minutos.length };
  }
  const rafagaIdentidades = detectarRafaga([...kids, ...uas]);
  const rafagaInvitaciones = detectarRafaga(invitaciones);

  const dentroDeRafaga = (ts) => !!rafagaIdentidades && ts >= rafagaIdentidades.desde && ts <= rafagaIdentidades.hasta;

  // ── Índices de cruce ──────────────────────────────────────────────────────
  const enrsPorSujeto = new Map();
  for (const e of enrs) {
    for (const k of [e.child_id, e.user_id, e.unregistered_athlete_id].filter(Boolean)) {
      if (!enrsPorSujeto.has(k)) enrsPorSujeto.set(k, []);
      enrsPorSujeto.get(k).push(e);
    }
  }
  const paysPorSujeto = new Map();
  for (const p of pays) {
    for (const k of [p.child_id, p.user_id, p.unregistered_athlete_id].filter(Boolean)) {
      if (!paysPorSujeto.has(k)) paysPorSujeto.set(k, []);
      paysPorSujeto.get(k).push(p);
    }
  }
  // Invitaciones indexadas por nombre de niño normalizado y por correo.
  // Cruce DÉBIL a propósito: `invitations` no tiene child_id en esta base.
  const invPorNombre = new Map();
  const invPorEmail = new Map();
  for (const i of invitaciones) {
    const n = tokens(i.child_name).sort().join('|');
    if (n) { if (!invPorNombre.has(n)) invPorNombre.set(n, []); invPorNombre.get(n).push(i); }
    const e = String(i.email || '').toLowerCase();
    if (e) { if (!invPorEmail.has(e)) invPorEmail.set(e, []); invPorEmail.get(e).push(i); }
  }

  // ── Pool de identidades de atleta de la escuela (las tres ramas) ──────────
  const pool = [];
  for (const c of kids) {
    const acu = c.parent_id ? idxProf.get(c.parent_id) : null;
    pool.push({
      rama: 'child', id: c.id, name: c.full_name, doc: c.doc_number, dob: c.date_of_birth,
      activa: c.is_active !== false, created_at: c.created_at,
      parent_id: c.parent_id ?? null,
      email_acudiente: acu?.email || c.parent_email_temp || null,
      nombre_acudiente: acu?.full_name || c.parent_name_temp || null,
      telefono_acudiente: acu?.phone || c.parent_phone_temp || null,
      raw: c,
    });
  }
  for (const u of uas) {
    pool.push({
      rama: 'unregistered', id: u.id, name: u.full_name, doc: u.doc_number, dob: u.date_of_birth,
      // la vista school_athletes oculta al no-registrado que ya está vinculado
      activa: u.is_active !== false && !u.linked_profile_id,
      created_at: u.created_at, parent_id: null,
      email_acudiente: u.email || null, nombre_acudiente: null, telefono_acudiente: u.phone || null,
      linked_profile_id: u.linked_profile_id ?? null, invitation_id: u.invitation_id ?? null,
      raw: u,
    });
  }
  for (const m of members) {
    if (m.role !== 'athlete') continue;
    const p = idxProf.get(m.profile_id);
    if (!p) continue;
    pool.push({
      rama: 'adult', id: p.id, name: p.full_name, doc: p.document_number, dob: p.date_of_birth,
      activa: m.status !== 'inactive' && m.status !== 'removed',
      created_at: m.created_at, parent_id: null,
      email_acudiente: p.email || null, nombre_acudiente: null, telefono_acudiente: p.phone || null,
      raw: p,
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PASO 1 — Resolver cada nombre a un grupo de identidades (por ID de acá en más)
  // ══════════════════════════════════════════════════════════════════════════
  const casos = [];
  for (const buscado of LOS_26) {
    const tb = tokens(buscado);
    // Candidatos: nombre exacto o contenido en ambos sentidos ("Sergio Herrera"
    // ⊂ "SERGIO HERRERA TORRES"). El documento entra después, al pesar parejas.
    const candidatos = pool.filter((p) => {
      const tp = tokens(p.name);
      if (tp.length < 2 || tb.length < 2) return false;
      const [corto, largo] = tb.length <= tp.length ? [tb, tp] : [tp, tb];
      return corto.every((t) => largo.includes(t));
    });

    if (!candidatos.length) {
      casos.push({ buscado, bucket: 'E', motivo: 'ningún registro con ese nombre en la escuela', grupo: [] });
      continue;
    }

    // Con más de un candidato, el filtro de homónimos decide quién entra al grupo.
    //
    // El ancla es el candidato SIN cobro vivo del período. No es un detalle: la
    // entrada de este triage es una lista de «sin cobro generado», así que por
    // construcción el registro al que se refiere el listado es el que NO tiene
    // cobro. Anclar en el más antiguo elegía al que sí lo tiene y hacía concluir
    // "la premisa no se sostiene" cuando lo que pasaba era que faltaba mirar al
    // otro registro (caso Josue Cortes: el del cargue tiene el pendiente de
    // agosto, el del auto-registro no, y el listado hablaba del segundo).
    const conInscripcion = (p) => (enrsPorSujeto.get(p.id) || []).some((e) => e.status === 'active');
    const conCobroDelPeriodo = (p) => (paysPorSujeto.get(p.id) || [])
      .some((y) => VIVOS.has(y.status) && y.period_year === ANIO && y.period_month === MES);
    const orden = [...candidatos].sort((a, b) =>
      (conCobroDelPeriodo(a) ? 1 : 0) - (conCobroDelPeriodo(b) ? 1 : 0) ||   // primero el que NO tiene cobro
      (conInscripcion(b) ? 1 : 0) - (conInscripcion(a) ? 1 : 0) ||
      String(a.created_at).localeCompare(String(b.created_at)));
    const ancla = orden[0];

    const grupo = [ancla];
    const homonimos = [];
    for (const otro of orden.slice(1)) {
      const ev = evaluar(ancla, otro);
      if (ev.agrupa) grupo.push({ ...otro, _ev: ev });
      else homonimos.push({ ...otro, _ev: ev });
    }
    casos.push({ buscado, grupo, homonimos, ancla });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PASO 2 — Ficha de origen e historia de dinero, por identidad
  // ══════════════════════════════════════════════════════════════════════════
  function ficha(ident) {
    const misEnr = enrsPorSujeto.get(ident.id) || [];
    const activas = misEnr.filter((e) => e.status === 'active');
    const enr = activas[0] ?? misEnr[0] ?? null;
    const plan = enr?.offering_plan_id ? idxPlan.get(enr.offering_plan_id) : null;
    const team = enr?.team_id ? idxTeam.get(enr.team_id) : null;
    const child = ident.rama === 'child' ? idxKid.get(ident.id) : null;
    const { monto, fuente } = montoCanonico(enr, plan, team, child);

    const misPagos = paysPorSujeto.get(ident.id) || [];
    const vivos = misPagos.filter((p) => VIVOS.has(p.status));
    const anulados = misPagos.filter((p) => TERMINALES.has(p.status));
    const pagados = misPagos.filter((p) => PAGADOS.has(p.status));
    const delMes = misPagos.filter((p) => p.period_year === ANIO && p.period_month === MES);
    const anuladosDelMes = delMes.filter((p) => TERMINALES.has(p.status));
    // Deuda anterior: vivo, sin pagar, de un período previo a este mes.
    const deudaAnterior = vivos.filter((p) => {
      if (PAGADOS.has(p.status)) return false;
      if (p.period_year != null && p.period_month != null) {
        return p.period_year < ANIO || (p.period_year === ANIO && p.period_month < MES);
      }
      return (p.due_date || '') < `${ANIO}-${String(MES).padStart(2, '0')}-01`;
    });

    // ── Origen ────────────────────────────────────────────────────────────
    // Señal de invitación: DÉBIL, por nombre/correo (no hay child_id). Solo
    // cuenta si la invitación es ANTERIOR a la identidad.
    const claveNombre = tokens(ident.name).sort().join('|');
    const invsNombre = invPorNombre.get(claveNombre) || [];
    const invsEmail = ident.email_acudiente ? (invPorEmail.get(String(ident.email_acudiente).toLowerCase()) || []) : [];
    const invsDirecta = ident.invitation_id ? invitaciones.filter((i) => i.id === ident.invitation_id) : [];
    const invs = [...invsDirecta, ...invsNombre, ...invsEmail]
      .filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i);
    const invPrevia = invs.filter((i) => String(i.created_at) <= String(ident.created_at))
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))[0] ?? null;

    const enRafaga = dentroDeRafaga(String(ident.created_at));
    let origen, origen_por_que;
    if (enRafaga) {
      origen = 'carga_masiva';
      origen_por_que = `creada dentro de la ráfaga del onboarding (${rafagaIdentidades.desde.slice(0, 16)} → ${rafagaIdentidades.hasta.slice(0, 16)})`;
    } else if (invsDirecta.length) {
      origen = 'invitacion';
      origen_por_que = 'unregistered_athletes.invitation_id apunta a una invitación (cruce fuerte)';
    } else if (invPrevia) {
      origen = 'invitacion';
      origen_por_que = `hay invitación previa (${String(invPrevia.created_at).slice(0, 10)}, ${invPrevia.status}) cruzada por nombre/correo — señal DÉBIL, invitations no tiene child_id`;
    } else if (ident.parent_id || ident.email_acudiente) {
      origen = 'qr_autoregistro';
      origen_por_que = 'creada fuera de la ráfaga, sin invitación previa y con acudiente propio → firma del auto-registro';
    } else {
      origen = 'alta_manual';
      origen_por_que = 'creada fuera de la ráfaga, sin invitación y sin acudiente → alta suelta de la escuela';
    }

    return {
      ...ident,
      enrollment_id: enr?.id ?? null,
      enrollments: misEnr.length, activas: activas.length,
      status_enr: enr?.status ?? null,
      team_id: enr?.team_id ?? null, team_name: team?.name ?? null,
      plan_id: enr?.offering_plan_id ?? null, plan_name: plan?.name ?? null,
      monto, fuente_monto: fuente,
      fecha_inscripcion: enr?.created_at ?? null,
      start_date: enr?.start_date ?? null,
      origen, origen_por_que, invitaciones_cruzadas: invs.length,
      cobros_total: misPagos.length,
      vivos: vivos.length, pagados: pagados.length,
      // Períodos de los cobros vivos: hace falta para no confundir "tiene cobro"
      // con "tiene cobro DE ESTE MES".
      cobros_periodos: [...new Set(vivos.map((p) => p.period_year != null
        ? `${p.period_year}-${String(p.period_month).padStart(2, '0')}`
        : `due ${p.due_date}`))],
      pagado_monto: pagados.reduce((s, p) => s + Number(p.amount || 0), 0),
      anulados: anulados.length,
      del_mes: delMes.map((p) => `${p.status}/${money(p.amount)}`),
      anulados_del_mes: anuladosDelMes.length,
      // Rastro real de cada anulación del período: fecha, quién y el motivo.
      // `cancel_duplicate_charge` es la acción explícita de la limpieza del
      // 5-ago; un `UPDATE` genérico a cancelled es una anulación cualquiera.
      rastro_anulacion: anuladosDelMes.flatMap((p) =>
        (auditPorCobro.get(p.id) || [])
          .filter((a) => a.action === 'cancel_duplicate_charge' || a.new_data?.status === 'cancelled')
          .map((a) => ({
            payment_id: p.id,        // empatar por acá: hay anulaciones al mismo segundo
            fecha: String(a.created_at).slice(0, 19),
            accion: a.action,
            por_duplicado: a.action === 'cancel_duplicate_charge',
            quien: idxProf.get(a.profile_id)?.full_name ?? (a.profile_id ? a.profile_id.slice(0, 8) : 'sistema/cron'),
            motivo: a.new_data?.motivo ?? null,
            atleta_anotado: a.new_data?.atleta ?? null,
            monto: Number(p.amount || 0),
          }))),
      // Si al anulado del período le habían puesto OTRO monto que el que la
      // cadena canónica calcula hoy, alguien cambió el plan por el camino. No es
      // un veto, pero emitir un monto distinto al que la escuela ya había
      // comunicado a la familia genera la siguiente disputa.
      montos_anulados_distintos: [...new Set(anuladosDelMes
        .map((p) => Number(p.amount || 0))
        .filter((a) => a > 0 && a !== monto))],
      deuda_anterior: deudaAnterior.length,
      deuda_anterior_monto: deudaAnterior.reduce((s, p) => s + Number(p.amount || 0), 0),
      ultimo_pago: misPagos.map((p) => p.payment_date).filter(Boolean).sort().at(-1) ?? null,
    };
  }

  for (const c of casos) {
    if (c.bucket === 'E') continue;
    c.fichas = c.grupo.map(ficha);
    c.fichas_homonimos = (c.homonimos || []).map(ficha);
    // La fecha REAL de entrada es la del primer registro del grupo, aunque hoy
    // ese registro sea la fila muerta. start_date no sirve: los merges del 3-4
    // de agosto lo reescribieron.
    c.entrada_real = c.fichas.map((f) => f.created_at).filter(Boolean).sort()[0] ?? null;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PASO 3 — Vetos, en orden. El primero que dispara manda.
  // ══════════════════════════════════════════════════════════════════════════
  for (const c of casos) {
    if (c.bucket === 'E') continue;
    const alertas = [];
    const notas = [];
    // Marca de anulación: por evidencia (payment terminal del período), no por nombre.
    // El rastro se busca sobre TODOS los candidatos del nombre, incluidos los
    // que el filtro de homónimos descartó. Motivo: la anulación del 5-ago se
    // decidió sobre "la persona del listado", y si mi agrupación difiere de la
    // de esa auditoría, la que manda es la auditoría — no mi matcher.
    // Caso real: la anulación de Sofia Anaya está en la identidad que el filtro
    // descartó como homónima, no en la que quedó de principal.
    const todasLasFichas = [...c.fichas, ...(c.fichas_homonimos || [])];
    c.historial_anulacion = todasLasFichas.some((f) => f.anulados_del_mes > 0);
    if (c.historial_anulacion) {
      const rastro = todasLasFichas.flatMap((f) => f.rastro_anulacion);
      c.anulado_por_duplicado = rastro.some((r) => r.por_duplicado);
      // ¿La anulación cae en el grupo aceptado o en un candidato descartado?
      // Cambia la acción: en el primer caso la decisión ya está tomada; en el
      // segundo hay que confirmar a cuál de los registros se refería el listado.
      c.anulacion_en_descartado = !c.fichas.some((f) => f.rastro_anulacion.some((r) => r.por_duplicado))
        && (c.fichas_homonimos || []).some((f) => f.rastro_anulacion.some((r) => r.por_duplicado));
      notas.push(rastro.length
        ? `cobro(s) de ${ANIO}-${MES} ANULADO(s): ${rastro.map((r) =>
          `${money(r.monto)} el ${r.fecha} por ${r.quien}` +
          (r.por_duplicado ? ` — **anulado POR DUPLICADO**${r.atleta_anotado ? ` ("${r.atleta_anotado}")` : ''}${r.motivo ? `: ${r.motivo}` : ''}` : ' (anulación genérica, sin motivo registrado)'),
        ).join(' · ')}`
        : `${c.fichas.reduce((s, f) => s + f.anulados_del_mes, 0)} cobro(s) de ${ANIO}-${MES} anulado(s), sin rastro en audit_logs`);
      if (c.anulado_por_duplicado) {
        notas.push('🚩 la anulación fue EXPLÍCITAMENTE por duplicado, con aprobación del owner → volver a emitir aquí recrea exactamente lo que se limpió el 5-ago');
      }
    }

    // La ficha "principal" es la que tiene inscripción activa; si hay varias, la
    // más antigua (la que carga el historial), igual que el DISTINCT ON de open_month.
    const conActiva = c.fichas.filter((f) => f.activas > 0)
      .sort((a, b) => (b.plan_id ? 1 : 0) - (a.plan_id ? 1 : 0) || (b.team_id ? 1 : 0) - (a.team_id ? 1 : 0) || String(a.fecha_inscripcion).localeCompare(String(b.fecha_inscripcion)));
    const principal = conActiva[0] ?? c.fichas[0];
    c.principal = principal;

    // ── VETO 0 · ya se decidió que este cobro NO va ─────────────────────────
    // Va PRIMERO, antes del detector de duplicados, porque es evidencia más
    // fuerte que cualquier matcher: alguien miró este caso el 5-ago, concluyó
    // que era duplicado y lo anuló con aprobación explícita del owner.
    //
    // Sin este veto, Julieta Mayorga caía en «EMITIR»: su gemela es la MAMÁ
    // cargada con el nombre de la hija, con un documento que difiere en más de
    // un dígito, así que el filtro de homónimos —correctamente— no las agrupa.
    // El matcher no puede saberlo; el registro de auditoría sí.
    if (c.anulado_por_duplicado) {
      const r = [...c.fichas, ...(c.fichas_homonimos || [])]
        .flatMap((f) => f.rastro_anulacion).find((x) => x.por_duplicado);
      c.bucket = 'A';
      c.id_viva = null;
      c.ids_muertas = [];
      if (c.anulacion_en_descartado) {
        c.motivo = `hay ${(c.fichas_homonimos || []).length + c.fichas.length} registros con este nombre y a uno de ellos —el que este triage descartó como homónimo— se le anuló el cobro de ${ANIO}-${MES} POR DUPLICADO el ${r.fecha.slice(0, 10)}`;
        c.accion = `NO EMITIR sin confirmar a cuál registro se refiere el listado: la auditoría del 5-ago los trató como la misma persona ("${r.atleta_anotado}") y este triage no. Uno de los dos criterios está mal y hay que resolverlo antes de cobrar.`;
      } else {
        c.motivo = `su cobro de ${ANIO}-${MES} ya fue anulado POR DUPLICADO el ${r.fecha.slice(0, 10)} (${r.quien}), con aprobación explícita del owner`;
        c.accion = 'NO EMITIR — la decisión ya se tomó y quedó registrada. Reabrirla es revertir la limpieza del 5-ago, no completarla.';
      }
      c.notas = notas;
      continue;
    }

    // ── VETO 1 · duplicado ──────────────────────────────────────────────────
    // El estado del gemelo se mide SOBRE EL PERÍODO QUE SE ESTÁ COBRANDO. Decir
    // "el gemelo ya tiene cobro" cuando ese cobro es de septiembre no cierra
    // agosto: Miguel Ángel tiene exactamente eso, un cobro de 2026-09 y ninguno
    // de 2026-08 — el desfase mes+1 del alta, que deja el mes de entrada sin cobrar.
    const vivoDelPeriodo = (f) => f.del_mes.some((d) => VIVOS.has(d.split('/')[0]));
    const pagadoDelPeriodo = (f) => f.del_mes.some((d) => PAGADOS.has(d.split('/')[0]));
    if (c.fichas.length > 1) {
      const otras = c.fichas.filter((f) => f.id !== principal.id);
      const conPeriodo = c.fichas.filter(vivoDelPeriodo);
      const conPago = c.fichas.filter(pagadoDelPeriodo);
      const conVivoOtroPeriodo = c.fichas.filter((f) => !vivoDelPeriodo(f) && f.vivos > 0);
      c.bucket = 'A';
      c.motivo = `la persona existe ${c.fichas.length} veces en la escuela` +
        (conPeriodo.length ? ` y ${conPeriodo.length} de esas identidades YA tiene cobro de ${ANIO}-${MES}` : ` y NINGUNA tiene cobro de ${ANIO}-${MES}`);
      c.id_viva = (conPago[0] ?? conPeriodo[0] ?? principal).id;
      c.ids_muertas = c.fichas.filter((f) => f.id !== c.id_viva).map((f) => f.id);
      c.accion = conPago.length
        ? `NO EMITIR — el gemelo ya PAGÓ ${ANIO}-${MES}. Esperar la fusión F3.`
        : conPeriodo.length
          ? `NO EMITIR — el gemelo ya tiene el cobro de ${ANIO}-${MES}. Esperar la fusión F3.`
          : `FUSIONAR PRIMERO (F3), después emitir UNA sola vez a la identidad que sobreviva: ${money(principal.monto)}. Hoy ninguna de las ${c.fichas.length} tiene cobro de ${ANIO}-${MES}, así que el mes sí falta — pero emitirlo antes de fusionar elige mal la identidad.`;
      if (conVivoOtroPeriodo.length) {
        notas.push(`ojo: ${conVivoOtroPeriodo.length} identidad(es) tiene(n) cobro vivo pero de OTRO período (${conVivoOtroPeriodo.flatMap((f) => f.cobros_periodos).join(', ')}) → no cubre ${ANIO}-${MES}; es el desfase mes+1 del alta`);
      }
      for (const o of otras) if (o._ev) notas.push(`agrupada con ${o.id.slice(0, 8)}: ${o._ev.razones.join(' | ')}`);
      c.notas = notas;
      continue;
    }

    // ── VETO 1b · homónimo con el cobro del período ─────────────────────────
    // Patrón clásico del duplicado que el filtro de homónimos NO puede agrupar
    // (documentos distintos, ambos plausibles): dos registros con el mismo nombre
    // exacto, uno del cargue masivo y otro del auto-registro, y el del cargue ya
    // tiene el cobro del mes. Es el caso Josue Cortes. Agrupar sería inventar;
    // emitir sería cobrar dos veces. Se reporta como ambiguo y no se emite.
    const gemelosNombre = (c.fichas_homonimos || []).filter((h) => vivoDelPeriodo(h) || pagadoDelPeriodo(h));
    if (gemelosNombre.length) {
      c.bucket = 'A';
      c.id_viva = gemelosNombre[0].id;
      c.ids_muertas = [principal.id];
      c.motivo = `otro registro con el MISMO nombre ya tiene cobro de ${ANIO}-${MES}, pero con documento distinto: este triage no los agrupa y podrían ser dos personas`;
      c.accion = `NO EMITIR sin que Dynasty confirme si son la misma persona. Si lo son, el cobro ya existe en \`${gemelosNombre[0].id.slice(0, 8)}\` y esto es un duplicado; si no lo son, falta emitir ${money(principal.monto)} acá.`;
      for (const h of gemelosNombre) {
        notas.push(`\`${h.id.slice(0, 8)}\` "${String(h.name).trim()}" doc=${h.doc || '—'} origen \`${h.origen}\` · de ${ANIO}-${MES}: ${h.del_mes.join(', ')} — ${h._ev?.razones.join(' | ')}`);
      }
      notas.push(`este registro: doc=${principal.doc || '—'} origen \`${principal.origen}\` · sin cobro de ${ANIO}-${MES}`);
      c.notas = notas;
      continue;
    }

    // ── VETO 2 · ¿hay algo que emitir? ──────────────────────────────────────
    // La identidad dada de baja va primero: dar de baja a un atleta CANCELA su
    // inscripción y ANULA sus cobros pendientes (RPC set_school_athlete_status).
    // Si sigue con inscripción activa es una inconsistencia, y emitirle un cobro
    // le factura a una familia que ya se fue.
    if (!principal.activa) {
      c.bucket = 'B';
      c.motivo = `la identidad está INACTIVA en la escuela` +
        (principal.activas > 0 ? ` pero conserva ${principal.activas} inscripción(es) activa(s) → inconsistencia: la baja debió cancelarlas` : '');
      c.accion = 'no emitir; Dynasty confirma si es baja real (y se cierra la inscripción) o si la inactivación fue un error';
      c.notas = notas; continue;
    }
    if (!principal.enrollment_id || principal.activas === 0) {
      c.bucket = 'B';
      c.motivo = principal.enrollments === 0
        ? 'no tiene ninguna inscripción'
        : `tiene ${principal.enrollments} inscripción(es) pero ninguna activa (estado: ${principal.status_enr})`;
      c.accion = 'Dynasty debe inscribir/reactivar antes de que exista cobro';
      c.notas = notas; continue;
    }
    if (!principal.plan_id && !principal.team_id) {
      c.bucket = 'B';
      c.motivo = 'inscripción activa sin plan y sin equipo';
      c.accion = 'Dynasty define plan (o equipo con cuota)';
      c.notas = notas; continue;
    }
    if (principal.monto <= 0) {
      c.bucket = 'B';
      c.motivo = `cuota efectiva 0 por la cadena canónica (plan=${principal.plan_name ?? '—'}, equipo=${principal.team_name ?? '—'})`;
      c.accion = 'Dynasty asigna precio — con monto 0 la emisión falla por el constraint amount > 0';
      c.notas = notas; continue;
    }

    // ── VETO 3 · ¿el cobro le llega a alguien que pueda pagarlo? ────────────
    // Se aplica a las TRES ramas, no solo a los menores: un no-registrado sin
    // correo ni perfil vinculado no tiene pagador posible, y el cobro nace con
    // parent_id NULL (el 403 conocido de "No tienes permiso para pagar").
    if (principal.rama === 'child') {
      const acu = principal.parent_id ? idxProf.get(principal.parent_id) : null;
      if (!principal.parent_id) {
        // El acudiente puede existir como TEXTO sin ser pagador. Distinguir los
        // dos casos es la diferencia entre "vincular una cuenta que ya existe" y
        // "la familia no tiene cuenta".
        const temp = String(principal.raw?.parent_email_temp || '').toLowerCase().trim();
        const cuenta = temp ? perfilesPorCorreo.get(temp) : null;
        c.acudiente_temp = temp || null;
        c.acudiente_cuenta = cuenta ? { id: cuenta.id, nombre: cuenta.full_name, rol: cuenta.role } : null;
        alertas.push(
          !temp
            ? 'menor sin acudiente de ninguna clase (parent_id NULL y sin parent_email_temp) → el cobro nace sin pagador'
            : cuenta
              ? `acudiente solo como TEXTO: parent_id NULL pero ${temp} YA tiene cuenta (\`${cuenta.id}\`) → el cobro nace sin pagador y el padre verá 403; basta vincular`
              : `acudiente solo como TEXTO: parent_id NULL y ${temp} no tiene cuenta todavía → el cobro nace sin pagador (403)`,
        );
      } else if (acu && tokens(acu.full_name).sort().join('|') === tokens(principal.name).sort().join('|')) {
        // El caso HADE SOFIA / SALOME: el acudiente es la propia atleta.
        alertas.push(`el acudiente es la propia atleta ("${acu.full_name}") → nadie distinto puede pagar`);
      }
    } else if (principal.rama === 'unregistered') {
      if (!principal.linked_profile_id) {
        alertas.push('atleta no registrado sin perfil vinculado → el cobro nace sin pagador (parent_id NULL)');
      }
    }
    const mail = principal.email_acudiente;
    if (!mail) alertas.push(`sin correo de ${principal.rama === 'child' ? 'acudiente' : 'contacto'} → no hay a dónde mandar el cobro`);
    else if (DOMINIOS_CON_TYPO.includes(dominio(mail))) alertas.push(`correo con dominio mal escrito (${mail}) → el cobro no llega`);
    if (alertas.length) {
      c.bucket = 'C';
      c.motivo = alertas.join(' · ');
      c.accion = c.acudiente_cuenta
        ? `vincular el perfil \`${c.acudiente_cuenta.id}\` (${c.acudiente_cuenta.nombre}) como acudiente y recién ahí emitir`
        : c.acudiente_temp
          ? `invitar a ${c.acudiente_temp} para que cree la cuenta; al aceptar queda como pagador y ahí se emite`
          : 'Dynasty consigue un acudiente con correo; hoy el cobro nace sin pagador y sin destinatario';
      c.notas = notas; continue;
    }

    // ── VETO 4 · ¿de verdad no tiene cobro de agosto? ───────────────────────
    // El listado dijo "sin cobro". Se re-verifica contra la base con el MISMO
    // criterio de open_month. Si aparece uno vivo, la premisa era falsa.
    if (principal.del_mes.some((d) => VIVOS.has(d.split('/')[0]))) {
      c.bucket = 'E';
      c.motivo = `la premisa no se sostiene: YA tiene cobro de ${ANIO}-${MES} (${principal.del_mes.join(', ')})`;
      c.accion = 'revisar por qué salió en el listado';
      c.notas = notas; continue;
    }

    // ── D ────────────────────────────────────────────────────────────────────
    c.bucket = 'D';
    c.motivo = 'sobrevive los cuatro vetos';
    c.accion = `emitir ${money(principal.monto)} (${principal.fuente_monto}) período ${ANIO}-${String(MES).padStart(2, '0')}`;
    if (principal.deuda_anterior) {
      notas.push(`arrastra ${principal.deuda_anterior} cobro(s) anterior(es) sin pagar por ${money(principal.deuda_anterior_monto)} — NO bloquea agosto, pero cobrar solo agosto no salda la cuenta`);
    }
    if (principal.del_mes.length) notas.push(`hubo cobro de ${ANIO}-${MES} y quedó en: ${principal.del_mes.join(', ')}`);
    if (principal.montos_anulados_distintos.length) {
      notas.push(`el cobro anulado de ${ANIO}-${MES} decía ${principal.montos_anulados_distintos.map(money).join(' / ')} y la cadena canónica hoy da ${money(principal.monto)} → alguien cambió el plan; confirmar con Dynasty cuál monto se le comunicó a la familia`);
    }
    c.notas = notas;
  }

  // Regla dura del spec: en la duda, no se emite. Cualquier caso que no haya
  // quedado clasificado cae a E, nunca a D.
  for (const c of casos) if (!c.bucket) { c.bucket = 'E'; c.motivo = 'no se pudo clasificar'; }

  // ══════════════════════════════════════════════════════════════════════════
  // Reporte
  // ══════════════════════════════════════════════════════════════════════════
  const B = (x) => casos.filter((c) => c.bucket === x);
  const L = [];
  const say = (s = '') => { L.push(s); console.log(s); };

  say(`# Triage — los 26 «sin cobro de agosto»`);
  say('');
  say(`**Escuela:** ${ESCUELA.name} (\`${S}\`) · **Corrido:** ${hoyCO} (hora Colombia) · **Período:** ${ANIO}-${String(MES).padStart(2, '0')}`);
  say(`**Modo:** SOLO LECTURA — este script no escribió una sola fila.`);
  say('');
  say(`Universo cargado: ${kids.length} children · ${uas.length} no registrados · ${members.filter((m) => m.role === 'athlete').length} atletas adultos · ${enrs.length} inscripciones · ${pays.length} cobros · ${invitaciones.length} invitaciones.`);
  // Vencimiento que pondría la emisión. Copia citada de `open_month`:
  //   v_due := make_date(año, mes, LEAST(cutoff, último día del mes))
  // Ojo: open_month NO usa payment_grace_days — esos días de gracia solo entran
  // en `qr_first_charge_due_date`, que es la fórmula del alta por QR, no la del
  // cierre de mes. Emitir "como open_month" vence el día de corte, seco.
  const cutoff = ajustes[0]?.payment_cutoff_day ?? 10;
  const gracia = ajustes[0]?.payment_grace_days ?? 0;
  const ultimoDia = new Date(Date.UTC(ANIO, MES, 0)).getUTCDate();
  const vencimiento = `${ANIO}-${String(MES).padStart(2, '0')}-${String(Math.min(cutoff, ultimoDia)).padStart(2, '0')}`;
  say(`Corte día ${cutoff} · gracia ${gracia} días. **Vencimiento que pondría \`open_month\`: ${vencimiento}** (la gracia no aplica acá: solo la usa el alta por QR).`);
  say('');
  say('## Ventana de la carga masiva (detectada, no asumida)');
  say('');
  if (rafagaIdentidades) {
    say(`- **Identidades:** ${rafagaIdentidades.desde} → ${rafagaIdentidades.hasta} · ${rafagaIdentidades.filas} filas en ${rafagaIdentidades.minutos} minutos.`);
  } else say('- **Identidades:** no se detectó ráfaga.');
  if (rafagaInvitaciones) {
    say(`- **Invitaciones:** ${rafagaInvitaciones.desde} → ${rafagaInvitaciones.hasta} · ${rafagaInvitaciones.filas} filas en ${rafagaInvitaciones.minutos} minutos.`);
  } else say('- **Invitaciones:** no se detectó ráfaga.');
  say('');
  say('Queda documentada para los triages futuros: todo lo creado dentro de esa ventana es `carga_masiva`; lo de después, no.');
  say('');
  say('## Resumen');
  say('');
  say('| Bucket | Qué es | n |');
  say('|---|---|---|');
  say(`| A | Duplicado — NO EMITIR | ${B('A').length} |`);
  say(`| B | Sin cuota asignable / no emitible | ${B('B').length} |`);
  say(`| C | Acudiente roto | ${B('C').length} |`);
  say(`| D | **Emitir con confirmación** | ${B('D').length} |`);
  say(`| E | No resuelto | ${B('E').length} |`);
  say(`| | **total** | **${casos.length}** |`);
  say('');

  const bloque = (letra, titulo, render) => {
    const lista = B(letra);
    say(`## BUCKET ${letra} — ${titulo} (n=${lista.length})`);
    say('');
    if (!lista.length) { say('_vacío._'); say(''); return; }
    for (const c of lista) { render(c); say(''); }
  };

  bloque('A', 'DUPLICADO, NO EMITIR', (c) => {
    say(`### ${c.buscado}`);
    say(`- **Por qué:** ${c.motivo}`);
    say(`- **Entrada real:** ${String(c.entrada_real).slice(0, 19)} _(la del primer registro del grupo; \`start_date\` no sirve, los merges del 3-4 ago lo reescribieron)_`);
    for (const f of c.fichas) {
      // Con veto 0 no hay una "viva" señalada: la evidencia es el registro de
      // auditoría, no una comparación entre dos filas del grupo.
      const etiqueta = c.id_viva === null ? '·' : (f.id === c.id_viva ? '**⭐ VIVA**' : '· muerta');
      say(`- ${etiqueta} \`${f.id}\` [${f.rama}] "${String(f.name).trim()}" doc=${f.doc || '—'}`);
      say(`    - origen \`${f.origen}\` — ${f.origen_por_que}`);
      say(`    - inscripciones ${f.enrollments} (activas ${f.activas}) · plan ${f.plan_name ?? '—'} · equipo ${f.team_name ?? '—'} · cuota ${money(f.monto)} (${f.fuente_monto})`);
      say(`    - cobros ${f.cobros_total}: vivos ${f.vivos}, pagados ${f.pagados} (${money(f.pagado_monto)}), anulados ${f.anulados}${f.del_mes.length ? ` · de ${ANIO}-${MES}: ${f.del_mes.join(', ')}` : ''}`);
    }
    if (c.anulacion_en_descartado) {
      for (const h of c.fichas_homonimos) {
        say(`- ⚖ **descartado por el matcher pero anulado por la auditoría** \`${h.id}\` [${h.rama}] "${String(h.name).trim()}" doc=${h.doc || '—'} — ${h._ev?.razones.join(' | ')}`);
        say(`    - cobros ${h.cobros_total}: vivos ${h.vivos}, pagados ${h.pagados} (${money(h.pagado_monto)}), anulados ${h.anulados}`);
      }
    }
    say(`- **Acción:** ${c.accion}`);
    for (const n of c.notas) say(`- ⚠ ${n}`);
  });

  bloque('B', 'SIN CUOTA ASIGNABLE / NO EMITIBLE', (c) => {
    const f = c.principal;
    say(`### ${c.buscado}`);
    say(`- \`${f.id}\` [${f.rama}] · enrollment \`${f.enrollment_id ?? '—'}\` · origen \`${f.origen}\``);
    say(`- **Falta:** ${c.motivo}`);
    say(`- plan ${f.plan_name ?? '—'} · equipo ${f.team_name ?? '—'} · cuota calculada ${money(f.monto)}`);
    say(`- **Acción:** ${c.accion}`);
    for (const n of c.notas) say(`- ⚠ ${n}`);
  });

  bloque('C', 'ACUDIENTE ROTO', (c) => {
    const f = c.principal;
    say(`### ${c.buscado}`);
    say(`- \`${f.id}\` [${f.rama}] · origen \`${f.origen}\` · cuota que tendría ${money(f.monto)}`);
    say(`- **Roto:** ${c.motivo}`);
    say(`- acudiente: ${f.nombre_acudiente ?? '—'} · ${f.email_acudiente ?? 'sin correo'} · ${f.telefono_acudiente ?? 'sin teléfono'}`);
    say(`- **Acción:** ${c.accion}`);
    for (const n of c.notas) say(`- ⚠ ${n}`);
  });

  bloque('D', 'EMITIR CON CONFIRMACIÓN', (c) => {
    const f = c.principal;
    say(`### ${c.buscado} — ${money(f.monto)}`);
    say(`- \`${f.id}\` [${f.rama}] · enrollment \`${f.enrollment_id}\``);
    say(`- equipo ${f.team_name ?? '—'} · plan ${f.plan_name ?? '—'} · monto ${money(f.monto)} vía \`${f.fuente_monto}\``);
    say(`- origen \`${f.origen}\` — ${f.origen_por_que}`);
    say(`- entrada real ${String(c.entrada_real).slice(0, 19)} · acudiente ${f.nombre_acudiente ?? '—'} (${f.email_acudiente ?? 'sin correo'})`);
    if (f.deuda_anterior) say(`- 🔶 **deuda anterior:** ${f.deuda_anterior} cobro(s), ${money(f.deuda_anterior_monto)}`);
    for (const n of c.notas) say(`- ⚠ ${n}`);
  });
  const totalD = B('D').reduce((s, c) => s + c.principal.monto, 0);
  say(`**TOTAL BUCKET D: ${money(totalD)} en ${B('D').length} cobros.**`);
  say('');

  bloque('E', 'NO RESUELTO', (c) => {
    say(`### ${c.buscado}`);
    say(`- **Por qué:** ${c.motivo}`);
    if (c.accion) say(`- **Acción:** ${c.accion}`);
    if (c.homonimos?.length) say(`- descartados como homónimos: ${c.homonimos.map((h) => `"${String(h.name).trim()}" (${h._ev.razones[0]})`).join(' · ')}`);
  });

  // ── Agregados de control ──────────────────────────────────────────────────
  say('## Agregados de control');
  say('');
  const estimado = 960000 + 1170000;
  say(`### 1. Bucket D contra el estimado previo`);
  say('');
  say(`- Estimado que traía el plan: **${money(estimado)}** (960.000 + 1.170.000).`);
  say(`- Bucket D real: **${money(totalD)}** en ${B('D').length} personas.`);
  say(`- Diferencia: **${money(totalD - estimado)}**.`);
  say('');
  say(`La diferencia no es un error de suma: el estimado contaba a los 26 como si todos fueran emitibles. Este triage saca ${B('A').length + B('B').length + B('C').length + B('E').length} de la cola (${B('A').length} duplicados, ${B('B').length} sin cuota, ${B('C').length} con acudiente roto, ${B('E').length} sin resolver), y para los que quedan usa la cadena canónica de \`open_month\` en vez de la cuota que muestra el listado.`);
  say('');

  const qrConCarga = casos.filter((c) => c.fichas?.length > 1
    && c.fichas.some((f) => f.origen === 'qr_autoregistro')
    && c.fichas.some((f) => f.origen === 'carga_masiva'));
  say(`### 2. El grifo: auto-registro conviviendo con carga masiva`);
  say('');
  say(`- **${qrConCarga.length}** de los 26 tienen una identidad \`qr_autoregistro\` conviviendo con una \`carga_masiva\` de la misma persona.`);
  for (const c of qrConCarga) say(`  - ${c.buscado}: ${c.fichas.map((f) => `${f.origen}(${String(f.created_at).slice(0, 10)})`).join(' + ')}`);
  say('');
  say('Esa es la firma exacta del duplicado: la escuela precargó la ficha en el onboarding y después el acudiente se auto-registró por QR sin que el sistema adoptara el registro existente. Mientras el grifo siga abierto, cada mes reaparecen casos nuevos.');
  say('');

  // Control: las anulaciones explícitas por duplicado y dónde cayó cada una.
  // Si alguna no aparece en el reporte, es una persona a la que ya se le anuló un
  // cobro y que este triage no está mirando.
  const anulacionesDup = auditoriaCobros.filter((a) => a.action === 'cancel_duplicate_charge');
  say(`### 3. Las ${anulacionesDup.length} anulaciones explícitas por duplicado del 5-ago`);
  say('');
  say('Vienen de `audit_logs.action = \'cancel_duplicate_charge\'` — el registro que dejó la limpieza, con motivo y aprobación del owner. Es la evidencia que manda sobre cualquier coincidencia de nombres.');
  say('');
  for (const a of anulacionesDup) {
    const quien = a.new_data?.atleta ?? '(sin nombre en el registro)';
    const caso = casos.find((c) => [...(c.fichas || []), ...(c.fichas_homonimos || [])]
      .some((f) => f.rastro_anulacion?.some((r) => r.por_duplicado && r.payment_id === a.record_id)));
    say(`- **${quien}** → ${caso ? `bucket ${caso.bucket} (como "${caso.buscado}")` : '**no está entre los 26** — fuera del alcance de este triage'}`);
  }
  say('');

  const porOrigen = {};
  for (const c of casos) for (const f of (c.fichas || [])) porOrigen[f.origen] = (porOrigen[f.origen] || 0) + 1;
  say(`### 4. Origen de las ${Object.values(porOrigen).reduce((a, b) => a + b, 0)} identidades de los 26`);
  say('');
  for (const [o, n] of Object.entries(porOrigen).sort((a, b) => b[1] - a[1])) say(`- \`${o}\`: ${n}`);
  say('');

  // ══════════════════════════════════════════════════════════════════════════
  // ¿Y si simplemente se corre open_month?
  // ══════════════════════════════════════════════════════════════════════════
  // La pregunta operativa que el triage tiene que contestar: la escuela tiene un
  // botón que genera el mes. Si ese botón hace lo correcto, sobra la emisión
  // manual. Acá se replica la cláusula `elegibles` de la RPC —tal como está en la
  // base, verificada hoy— sobre TODA la escuela, y se cruza con los buckets.
  const cobroVivoDelPeriodo = (e) => pays.some((p) => {
    if (!VIVOS.has(p.status)) return false;
    const apunta = e.child_id ? p.child_id === e.child_id
      : (!e.child_id && e.user_id) ? (p.user_id === e.user_id || p.parent_id === e.user_id)
        : e.unregistered_athlete_id ? p.unregistered_athlete_id === e.unregistered_athlete_id : false;
    if (!apunta) return false;
    const inicioMes = `${ANIO}-${String(MES).padStart(2, '0')}-01`;
    const finMes = MES === 12 ? `${ANIO + 1}-01-01` : `${ANIO}-${String(MES + 1).padStart(2, '0')}-01`;
    return (p.period_year === ANIO && p.period_month === MES)
      || (p.period_year == null && p.due_date >= inicioMes && p.due_date < finMes);
  });
  const elegibles = new Map();      // DISTINCT ON (atleta)
  for (const e of enrs) {
    const sujeto = e.child_id || e.user_id || e.unregistered_athlete_id;
    if (!sujeto || e.status !== 'active') continue;
    const { monto } = montoCanonico(e, idxPlan.get(e.offering_plan_id), idxTeam.get(e.team_id), idxKid.get(e.child_id));
    if (monto <= 0 || cobroVivoDelPeriodo(e)) continue;
    // ORDER BY plan DESC, equipo DESC, created_at ASC
    const rango = (x) => [x.offering_plan_id ? 0 : 1, x.team_id ? 0 : 1, String(x.created_at)];
    const previo = elegibles.get(sujeto);
    if (!previo || JSON.stringify(rango(e)) < JSON.stringify(rango(previo.e))) elegibles.set(sujeto, { e, monto });
  }
  const bucketDeIdentidad = new Map();
  for (const c of casos) {
    for (const f of [...(c.fichas || []), ...(c.fichas_homonimos || [])]) {
      if (!bucketDeIdentidad.has(f.id)) bucketDeIdentidad.set(f.id, c);
    }
  }
  const vetados = [...elegibles.entries()]
    .map(([sujeto, v]) => ({ sujeto, ...v, caso: bucketDeIdentidad.get(sujeto) }))
    .filter((x) => x.caso && x.caso.bucket !== 'D');
  const totalElegibles = [...elegibles.values()].reduce((s, v) => s + v.monto, 0);

  say('## ¿Se puede simplemente correr `open_month`?');
  say('');
  say(`**No.** Replicando la cláusula \`elegibles\` de la RPC viva sobre toda la escuela, \`open_month(${ANIO}, ${MES})\` generaría **${elegibles.size} cobros por ${money(totalElegibles)}** — bastante más que los ${B('D').length} del bucket D.`);
  say('');
  say(`De esos, **${vetados.length} son personas que este triage marcó como NO emitibles**, por ${money(vetados.reduce((s, x) => s + x.monto, 0))}:`);
  say('');
  say('| Persona | Bucket | Monto | Qué pasaría si se corre |');
  say('|---|---|---|---|');
  for (const v of vetados.sort((a, b) => a.caso.buscado.localeCompare(b.caso.buscado))) {
    const f = [...v.caso.fichas, ...(v.caso.fichas_homonimos || [])].find((x) => x.id === v.sujeto);
    const consecuencia = v.caso.bucket === 'A'
      ? (v.caso.anulado_por_duplicado ? 'recrea el cobro que el owner anuló por duplicado' : 'cobra a la identidad duplicada')
      : v.caso.bucket === 'C' ? 'crea un cobro que nadie puede pagar'
        : 'cobra algo que no debería existir';
    say(`| ${v.caso.buscado}${f && String(f.name).trim() !== v.caso.buscado ? ` (\`${v.sujeto.slice(0, 8)}\` "${String(f.name).trim()}")` : ''} | ${v.caso.bucket} | ${money(v.monto)} | ${consecuencia} |`);
  }
  say('');
  say(`Los ${B('D').length} del bucket D **sí** están entre los elegibles y con el mismo monto — el total coincide al peso con ${money(totalD)}. Es decir: la cadena del triage y la de la RPC dan lo mismo; lo que la RPC no sabe es a quién NO cobrarle.`);
  say('');
  say('**Conclusión operativa:** la emisión tiene que ser dirigida (por `enrollment_id`/atleta, los 13 del bucket D), no un `open_month` de toda la escuela. Y hasta que la fusión F3 limpie los duplicados, correr el botón de generar mes sobre Dynasty vuelve a romper lo que se arregló el 5-ago.');
  say('');

  say('## Lo que va a pasar cuando se emita (triggers vivos, verificados en la base)');
  say('');
  say('No es teoría: son los triggers que hoy están activos sobre `payments` y `children`.');
  say('');
  say(`- **\`trg_notify_on_payment_created\`** — \`AFTER INSERT ... WHEN (new.status = 'pending')\`. Cada cobro emitido dispara una notificación a la familia. Emitir los ${B('D').length} del bucket D manda ${B('D').length} avisos de golpe; si se emiten de a uno para confirmar, son ${B('D').length} avisos igual, pero escalonados.`);
  say('- **`trg_payments_fill_period`** — `BEFORE INSERT`. Rellena `period_year`/`period_month` desde `due_date`. No hace falta pasarlos a mano, y por eso el veto de «¿ya tiene cobro del período?» es confiable incluso en cobros creados por otras vías.');
  say('- **`trg_adopt_orphan_payments_on_child_link`** y **`trg_backfill_payment_payer_on_link`** — `AFTER UPDATE OF parent_id ON children WHEN (old.parent_id IS NULL AND new.parent_id IS NOT NULL)`.');
  say('');
  say(`  Esto **cambia la urgencia del bucket C**: un cobro emitido hoy con \`parent_id\` NULL no queda huérfano para siempre. En cuanto se vincule el acudiente, los dos triggers lo adoptan y le rellenan el pagador. Es decir, el orden no es destructivo — se puede vincular primero y emitir después (recomendado, la familia puede pagar desde el minuto uno), o emitir y vincular después (el cobro se arregla solo, pero mientras tanto el padre ve 403). Lo que **no** se arregla solo es el correo con dominio mal escrito ni el acudiente que es la propia atleta.`);
  say('- **`trg_cancel_payments_on_enrollment_cancel`** — cancelar la inscripción anula sus cobros. Relevante para el caso inactivo del bucket B: si Dynasty confirma la baja, no hay que anular a mano.');
  say('');
  say('## Sobre el origen: qué es dato y qué es inferencia');
  say('');
  say('Se revisó si existe un rastro versionado del cargue masivo. `external_school_imports` **no sirve**: guarda el scraping del IDRD (`source = idrd_bogota_2026`), no este onboarding. No hay tabla que diga «esta fila entró por el cargue».');
  say('');
  say('Por eso el `origen` de este reporte es **inferencia por ráfaga**, y es sólida para `carga_masiva` (415 filas en 5 minutos no es otra cosa) pero **débil para `invitacion`**: `invitations` no tiene `child_id`, así que el cruce es por nombre normalizado y correo. Donde la distinción entre `invitacion` y `qr_autoregistro` cambie una decisión, hay que confirmarla a mano.');
  say('');
  say('---');
  say('');
  say('**Este script no escribió nada.** La emisión de los D es un paso aparte, con confirmación fila por fila.');

  // ── Chequeo del criterio de cierre ────────────────────────────────────────
  const enUnBucket = casos.filter((c) => ['A', 'B', 'C', 'D', 'E'].includes(c.bucket)).length;
  console.log('');
  console.log('─'.repeat(78));
  console.log(`CIERRE: ${casos.length} personas · ${enUnBucket} en exactamente un bucket · ${casos.length - enUnBucket} sin clasificar`);
  if (enUnBucket !== LOS_26.length) console.log('⚠ NO CIERRA: revisar antes de usar este reporte.');
  console.log('─'.repeat(78));

  if (SALIDA_MD) {
    fs.mkdirSync(path.dirname(SALIDA_MD), { recursive: true });
    fs.writeFileSync(SALIDA_MD, L.join('\n') + '\n', 'utf8');
    console.log(`Markdown → ${SALIDA_MD}`);
  }
  if (SALIDA_JSON) {
    fs.writeFileSync(SALIDA_JSON, JSON.stringify({ escuela: ESCUELA, rafagaIdentidades, rafagaInvitaciones, casos }, null, 2), 'utf8');
    console.log(`JSON → ${SALIDA_JSON}`);
  }
};

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
