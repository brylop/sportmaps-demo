#!/usr/bin/env node
// scripts/qa-twin/clonar-dreamers.mjs — copia Dreamers Gymnastics al gemelo LOCAL.
//
// Lee de la base viva en modo READ ONLY (liveReadOnlyClient: cualquier escritura
// falla con 25006) y escribe SOLO en el gemelo Docker (twinClient: aborta si la URL
// no es localhost o apunta a producción). Ver docs/qa-gemelo-local.md.
//
// Qué copia: configuración, suscripción, sede, staff, ofertas, planes, equipos,
// disponibilidad de coaches, instalaciones, torniquetes, deportistas, inscripciones,
// cobros, ajustes, auditoría de cobros, asistencias, banco de horas, marcaciones,
// PINs, invitaciones y reservas (si hay).
//
// Anonimiza: las personas reales pasan a cuentas qa-dl-…@demo.sportmaps.co (clave
// Demo2026!), menores = primer nombre + " QA", sin correos/teléfonos/documentos/
// comprobantes/datos bancarios reales, seriales de torniquete ficticios.
// Conserva los ids originales (el gemelo está aislado), así cada caso se compara
// 1:1 con la viva. La escuela se renombra "QA Dreamers Lab".
//
// Uso:  node scripts/qa-twin/clonar-dreamers.mjs        (re-ejecutable: limpia y recarga)

import { liveReadOnlyClient, twinClient } from './lib.mjs';

const SID = '57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe';
const PASS = 'Demo2026!';

const TABLAS = [
  ['schools', `id = '${SID}'`],
  ['school_settings', `school_id = '${SID}'`],
  ['school_subscriptions', `school_id = '${SID}'`],
  ['school_addons', `school_id = '${SID}'`],
  ['school_branches', `school_id = '${SID}'`],
  ['school_staff', `school_id = '${SID}'`],
  ['school_members', `school_id = '${SID}'`],
  ['offerings', `school_id = '${SID}'`],
  ['offering_plans', `school_id = '${SID}'`],
  ['offering_coaches', `school_id = '${SID}'`],
  ['teams', `school_id = '${SID}'`],
  ['team_branches', `school_id = '${SID}'`],
  ['team_coaches', `school_id = '${SID}'`],
  ['coach_availability', `school_id = '${SID}'`],
  ['facilities', `school_id = '${SID}'`],
  ['turnstile_devices', `school_id = '${SID}'`],
  ['children', `school_id = '${SID}'`],
  ['unregistered_athletes', `school_id = '${SID}'`],
  ['enrollments', `school_id = '${SID}'`],
  ['payments', `school_id = '${SID}'`],
  ['payment_adjustments', `school_id = '${SID}'`],
  ['payment_audit_logs', `payment_id in (select id from public.payments where school_id = '${SID}')`],
  ['attendance_sessions', `school_id = '${SID}'`],
  ['attendance_records', `school_id = '${SID}'`],
  ['hour_bank_periods', `school_id = '${SID}'`],
  ['hour_bank_visits', `school_id = '${SID}'`],
  ['hour_bank_visit_segments', `school_id = '${SID}'`],
  ['hour_bank_overage_charges', `school_id = '${SID}'`],
  ['hour_bank_reservations', `school_id = '${SID}'`],
  ['access_events', `school_id = '${SID}'`],
  ['zk_user_mappings', `school_id = '${SID}'`],
  ['invitations', `school_id = '${SID}'`],
  ['facility_reservations', `school_id = '${SID}'`],
  ['session_bookings', `school_id = '${SID}'`],
  ['school_trial_slots', `school_id = '${SID}'`],
  ['trial_class_bookings', `school_id = '${SID}'`],
  ['enrollment_categories', `school_id = '${SID}'`],
];

// Personas reales referenciadas en los datos de Dreamers → cuentas de prueba (mismo id).
const PERSONAS = {
  '6c0b38bb-5c7c-45f0-99e4-cb543b60ea21': ['qa-dl-dueno@demo.sportmaps.co', 'Dueño QA Dreamers Lab', 'school'],
  '2dddf167-e2e5-4489-a98b-bcd37ebf8d13': ['qa-dl-coach@demo.sportmaps.co', 'Coach QA Dreamers Lab', 'coach'],
  '0fca0e19-2b6c-43ca-a727-25cdb65bd1cc': ['qa-dl-acudiente1@demo.sportmaps.co', 'Acudiente QA 1', 'parent'],
  'a72b4381-0d28-4c72-b954-f334f6753ec2': ['qa-dl-acudiente2@demo.sportmaps.co', 'Acudiente QA 2', 'parent'],
  'df03fa5b-504e-4019-9092-0a9cf75a7da9': ['qa-dl-acudiente3@demo.sportmaps.co', 'Acudiente QA 3', 'parent'],
  '7c7d0c90-ebe6-4521-a5a9-2aa75659784e': ['qa-dl-atleta-adulto@demo.sportmaps.co', 'Atleta Adulto QA', 'athlete'],
};

const corto = (id) => String(id).slice(0, 8);
const primerNombre = (n) => `${String(n ?? '').trim().split(/\s+/)[0] || 'Atleta'} QA`;

const live = await liveReadOnlyClient();
const twin = await twinClient();

// ── 1. Leer de la viva (solo lectura) ─────────────────────────────────────────
const datos = {};
for (const [t, f] of TABLAS) {
  const { rows } = await live.query(`select to_jsonb(x) j from public.${t} x where ${f}`);
  datos[t] = rows.map((r) => r.j);
}
const { rows: perfiles } = await live.query(
  `select to_jsonb(p) j from public.profiles p where id = any($1::uuid[])`, [Object.keys(PERSONAS)]);
datos.profiles = perfiles.map((r) => r.j);

// Pares nombre viejo → nuevo, para limpiar conceptos de cobro e invitaciones
const nombres = new Map([['Silva Moreno Ropero', 'Silvana QA']]);
for (const c of datos.children) {
  if (c.full_name?.trim()) nombres.set(c.full_name, primerNombre(c.full_name));
  if (c.parent_name_temp?.trim()) nombres.set(c.parent_name_temp, 'Acudiente QA');
}
for (const u of datos.unregistered_athletes) if (u.full_name?.trim()) nombres.set(u.full_name, primerNombre(u.full_name));
for (const p of datos.profiles) if (p.full_name?.trim()) nombres.set(p.full_name, PERSONAS[p.id][1]);
const pares = [...nombres].sort((a, b) => b[0].length - a[0].length);
const limpiar = (txt) => (txt == null ? txt : pares.reduce((s, [v, n]) => s.split(v).join(n), txt));
const correoReal = new Map(datos.profiles.filter((p) => p.email).map((p) => [p.email.toLowerCase(), PERSONAS[p.id][0]]));

// ── 2. Anonimizar ─────────────────────────────────────────────────────────────
const anon = {
  profiles: (r) => Object.assign(r, { email: PERSONAS[r.id][0], full_name: PERSONAS[r.id][1], phone: null,
    avatar_url: null, document_type: null, document_number: null, billing_address: null, is_demo: true }),
  schools: (r) => Object.assign(r, { name: 'QA Dreamers Lab', slug: 'qa-dreamers-lab', email: 'qa-dl-escuela@demo.sportmaps.co',
    phone: null, address: null, logo_url: null, cover_image_url: null, is_demo: true, account_type: 'test',
    description: 'Escuela de PRUEBA (gemelo local) — copia de Dreamers Gymnastics.' }),
  school_settings: (r) => Object.assign(r, { bank_name: 'Banco QA', bank_account_number: '0000000000',
    bank_titular_name: 'Titular QA', bank_titular_id: '900000000', bank_account_holder: null, nequi_number: null,
    daviplata_number: null, breb_number: null, breb_key: null, transfer_key: null, payment_qr_url: null,
    whatsapp_number: null, payment_accounts: [] }),
  school_branches: (r) => Object.assign(r, { address: 'Dirección QA', phone: null }),
  school_staff: (r) => Object.assign(r, { full_name: `Staff QA ${corto(r.id).slice(0, 4)}`,
    email: `qa-dl-staff-${corto(r.id)}@demo.sportmaps.co`, phone: null }),
  turnstile_devices: (r) => Object.assign(r, { serial_number: `QA-${corto(r.id).toUpperCase()}`, ip_address: null,
    device_name: `QA ${r.device_name ?? 'lector'}` }),
  children: (r) => Object.assign(r, { full_name: primerNombre(r.full_name), avatar_url: null, medical_info: null,
    doc_type: null, doc_number: null, id_document_url: null, blood_type: null, eps_name: null, is_demo: true,
    parent_name_temp: r.parent_name_temp ? 'Acudiente QA' : null,
    parent_email_temp: r.parent_email_temp ? `qa-dl-acud-${corto(r.id)}@demo.sportmaps.co` : null,
    parent_phone_temp: null }),
  unregistered_athletes: (r) => Object.assign(r, { full_name: primerNombre(r.full_name),
    email: `qa-dl-adulto-${corto(r.id)}@demo.sportmaps.co`, phone: null, doc_type: null, doc_number: null,
    poll_token: null, blood_type: null, eps_name: null, guardian_phone: null, guardian_email: null,
    guardian_full_name: null, avatar_url: null }),
  invitations: (r) => Object.assign(r, {
    email: correoReal.get(String(r.email).toLowerCase()) ?? `qa-dl-inv-${corto(r.id)}@demo.sportmaps.co`,
    child_name: limpiar(r.child_name), parent_phone: null }),
  payments: (r) => Object.assign(r, { concept: limpiar(r.concept),
    reference: r.reference ? `QA-${r.reference}` : null, receipt_url: null, rejected_receipt_url: null,
    receipt_image_sha256: null, ocr_raw_response: null, ocr_origin_name: null, ocr_destination: null,
    ocr_destination_name: null, provider_reference: null, provider_transaction_id: null,
    wompi_id: null, wompi_reference: null, wompi_transaction_id: null }),
};
for (const [t, fn] of Object.entries(anon)) datos[t] = (datos[t] ?? []).map((r) => fn({ ...r }));

// Ninguna fila puede llevar un correo o teléfono real de los perfiles
const realesTexto = new Set();
for (const r of perfiles) { if (r.j.email) realesTexto.add(r.j.email.toLowerCase()); }

// ── 3. Escribir en el gemelo ──────────────────────────────────────────────────
async function columnas(t) {
  const { rows } = await twin.query(
    `select a.attname from pg_attribute a
      where a.attrelid = ('public.' || quote_ident($1))::regclass and a.attnum > 0 and not a.attisdropped
        and a.attgenerated = '' and a.attidentity <> 'a' order by a.attnum`, [t]);
  return rows.map((r) => r.attname);
}

const resumen = [];
await twin.query('begin');
try {
  await twin.query('set local session_replication_role = replica');

  // limpiar una carga anterior (en orden inverso)
  for (const [t, f] of [...TABLAS].reverse()) await twin.query(`delete from public.${t} where ${f}`);
  await twin.query('delete from public.profiles where id = any($1::uuid[])', [Object.keys(PERSONAS)]);
  await twin.query('delete from auth.identities where user_id = any($1::uuid[])', [Object.keys(PERSONAS)]);
  await twin.query('delete from auth.users where id = any($1::uuid[])', [Object.keys(PERSONAS)]);

  // cuentas de prueba
  for (const [id, [email, nombre, rol]] of Object.entries(PERSONAS)) {
    await twin.query(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
          raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
          email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token,
          reauthentication_token)
       values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2,
          extensions.crypt($3, extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
          jsonb_build_object('full_name', $4::text, 'role', $5::text), now(), now(), '', '', '', '', '', '', '', '')`,
      [id, email, PASS, nombre, rol]);
    await twin.query(
      `insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
       values ($1::text, $1::uuid, jsonb_build_object('sub', $1::text, 'email', $2::text, 'email_verified', true),
               'email', now(), now(), now())`, [id, email]);
  }

  for (const t of ['profiles', ...TABLAS.map(([t]) => t)]) {
    const filas = datos[t] ?? [];
    if (filas.length === 0) { resumen.push([t, 0, 0]); continue; }
    const cols = (await columnas(t)).map((c) => `"${c}"`).join(',');
    const r = await twin.query(
      `insert into public.${t} (${cols}) select ${cols} from jsonb_populate_recordset(null::public.${t}, $1::jsonb)`,
      [JSON.stringify(filas)]);
    resumen.push([t, filas.length, r.rowCount]);
  }

  // control: ningún correo real quedó en la escuela de prueba
  const { rows: fuga } = await twin.query(
    `select count(*)::int n from (
        select email from public.profiles where id = any($1::uuid[])
        union all select email from public.invitations where school_id = $2
        union all select email from public.school_staff where school_id = $2
        union all select parent_email_temp from public.children where school_id = $2
        union all select email from public.unregistered_athletes where school_id = $2) s
      where lower(email) = any($3::text[])`,
    [Object.keys(PERSONAS), SID, [...realesTexto]]);
  if (fuga[0].n > 0) throw new Error(`Quedaron ${fuga[0].n} correos reales en la copia: se revierte.`);

  await twin.query('commit');
} catch (e) {
  await twin.query('rollback');
  console.error('ERROR — no se cargó nada:', e.message);
  process.exitCode = 1;
}

console.table(resumen.map(([tabla, leidas, cargadas]) => ({ tabla, leidas, cargadas })));
await live.end();
await twin.end();
