#!/usr/bin/env node
// ============================================================
// SEED DEMO — SportMaps  (CAPA DEMO — solo rama `demo`)
//
// Crea un ecosistema DEMO completo e interconectado sobre el mismo
// Supabase de develop, marcado como dummy (is_demo=true donde exista).
// Idempotente: UUIDs fijos + upsert por PK; usuarios auth create-or-update.
// Defensivo: si una tabla no existe (DB detrás de migraciones), la salta
// con log y sigue — nunca aborta.
//
// Modelo real respetado:
//   - teams.coach_id -> school_staff.id (staff se auto-crea desde school_members)
//   - vendor_profiles se auto-crea por trigger al crear perfil wellness/store
//     con capabilities.can_sell_services / can_sell_products
//   - products tiene publish-gate (status='active' exige categoria+imagen+desc>=30)
//
// Uso:
//   node demo/seed/seed-demo.mjs            (lee bff/.env o frontend/.env.local)
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node demo/seed/seed-demo.mjs
// ============================================================
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..', '..');

function loadEnv() {
  const out = { ...process.env };
  const MAIN = 'C:/Users/Usuario/Documents/demo/sportmaps-demo';
  for (const p of [resolve(REPO, 'bff/.env'), resolve(REPO, 'frontend/.env.local'), resolve(REPO, 'frontend/.env'),
                   `${MAIN}/bff/.env`, `${MAIN}/frontend/.env.local`, `${MAIN}/frontend/.env`]) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && out[m[1]] === undefined) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return out;
}
const ENV = loadEnv();
const URL = ENV.SUPABASE_URL || ENV.VITE_SUPABASE_URL;
const KEY = ENV.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error('❌ Falta SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const H = { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${KEY}` };
const PASSWORD = 'SportMapsDemo2025!';
const TODAY = new Date('2026-07-01T12:00:00Z');
const stats = { ok: 0, skip: 0, err: 0 };

// ── helpers ─────────────────────────────────────────────────
function normalize(arr) {
  const keys = new Set();
  arr.forEach(o => Object.keys(o).forEach(k => keys.add(k)));
  return arr.map(o => { const n = {}; for (const k of keys) n[k] = o[k] === undefined ? null : o[k]; return n; });
}
async function up(table, rows, { onConflict } = {}) {
  let arr = (Array.isArray(rows) ? rows : [rows]).filter(Boolean);
  if (!arr.length) return true;
  arr = normalize(arr);
  let q = `${URL}/rest/v1/${table}`;
  if (onConflict) q += `?on_conflict=${onConflict}`;
  const r = await fetch(q, { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(arr) });
  if (r.ok) { stats.ok++; console.log(`  ✅ ${table} (${arr.length})`); return true; }
  const body = await r.text();
  if (r.status === 404 || /PGRST205|Could not find the table/.test(body)) { stats.skip++; console.log(`  ⏭️  ${table} — no existe, se omite`); return false; }
  stats.err++; console.log(`  ❌ ${table} [${r.status}] ${body.slice(0, 220)}`); return false;
}
async function get(path) {
  const r = await fetch(`${URL}/rest/v1/${path}`, { headers: H });
  if (!r.ok) return [];
  try { return JSON.parse(await r.text()); } catch { return []; }
}
async function patch(table, filter, body) {
  const r = await fetch(`${URL}/rest/v1/${table}?${filter}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(body) });
  if (!r.ok) { const t = await r.text(); if (!/404|PGRST205/.test(String(r.status) + t)) console.log(`  ⚠️  patch ${table}: [${r.status}] ${t.slice(0,160)}`); }
  return r.ok;
}
async function adminUser(email, full_name, role) {
  const c = await fetch(`${URL}/auth/v1/admin/users`, { method: 'POST', headers: H, body: JSON.stringify({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name, role } }) });
  const cd = await c.json();
  if (c.ok && cd.id) { console.log(`  👤 creado ${email}`); return cd.id; }
  const ld = await (await fetch(`${URL}/auth/v1/admin/users?per_page=200`, { headers: H })).json();
  const ex = (ld.users || []).find(u => (u.email || '').toLowerCase() === email.toLowerCase());
  if (!ex) { console.log(`  ❌ ${email}: ${JSON.stringify(cd).slice(0,140)}`); return null; }
  await fetch(`${URL}/auth/v1/admin/users/${ex.id}`, { method: 'PUT', headers: H, body: JSON.stringify({ password: PASSWORD, email_confirm: true, user_metadata: { full_name, role } }) });
  console.log(`  👤 actualizado ${email}`);
  return ex.id;
}
async function ensureStaff(schoolId, authId, full_name, email, specialty) {
  let rows = await get(`school_staff?school_id=eq.${schoolId}&coach_auth_id=eq.${authId}&select=id`);
  if (rows[0]) return rows[0].id;
  await up('school_staff', { school_id: schoolId, full_name, email, specialty, status: 'active', coach_auth_id: authId }, { onConflict: 'email,school_id' });
  rows = await get(`school_staff?school_id=eq.${schoolId}&coach_auth_id=eq.${authId}&select=id`);
  if (!rows[0]) rows = await get(`school_staff?school_id=eq.${schoolId}&email=eq.${encodeURIComponent(email)}&select=id`);
  return rows[0]?.id || null;
}
const iso = (d) => d.toISOString();
const dateStr = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

// ── UUIDs fijos ─────────────────────────────────────────────
const ID = {
  school:'de300000-0000-4000-8000-000000000001', ptSchool:'de300000-0000-4000-8000-000000000002',
  branch:'de310000-0000-4000-8000-000000000001',
  teamThunder:'de320000-0000-4000-8000-000000000001', teamLightning:'de320000-0000-4000-8000-000000000002',
  teamHalcones:'de320000-0000-4000-8000-000000000003', teamPT:'de320000-0000-4000-8000-000000000004',
  offMembership:'de330000-0000-4000-8000-000000000001', offSessions:'de330000-0000-4000-8000-000000000002',
  planMonthly:'de340000-0000-4000-8000-000000000001', planQuarter:'de340000-0000-4000-8000-000000000002', planSessions:'de340000-0000-4000-8000-000000000003',
  childSofia:'de350000-0000-4000-8000-000000000001', childMateo:'de350000-0000-4000-8000-000000000002', childValentina:'de350000-0000-4000-8000-000000000003',
  facilityCourt:'de360000-0000-4000-8000-000000000001', event:'de380000-0000-4000-8000-000000000001',
  u:(p,n)=>`de${p}0000-0000-4000-8000-${String(n).padStart(12,'0')}`,
};
const USERS = [
  { key:'school',   email:'demo.escuela@sportmaps.co',     name:'Escuela Demo SportMaps',              role:'school' },
  { key:'coach1',   email:'demo.coach1@sportmaps.co',      name:'Carlos Ramírez',                      role:'coach' },
  { key:'coach2',   email:'demo.coach2@sportmaps.co',      name:'Laura Gómez',                         role:'coach' },
  { key:'parent1',  email:'demo.padre1@sportmaps.co',      name:'María García Hernández',              role:'parent' },
  { key:'parent2',  email:'demo.padre2@sportmaps.co',      name:'Andrés López Ríos',                   role:'parent' },
  { key:'athlete1', email:'demo.atleta1@sportmaps.co',     name:'Juan Martínez',                       role:'athlete' },
  { key:'trainer',  email:'demo.trainer@sportmaps.co',     name:'Andrés Torres',                       role:'coach' },
  { key:'wellness', email:'demo.wellness@sportmaps.co',    name:'Dra. Sofía Rivera',                   role:'wellness_professional' },
  { key:'store',    email:'demo.tienda@sportmaps.co',      name:'Tienda Equípate Más',                 role:'store_owner' },
  { key:'organizer',email:'demo.organizador@sportmaps.co', name:'Liga Deportiva Demo',                 role:'organizer' },
  { key:'admin',    email:'demo.admin@sportmaps.co',       name:'Administrador Demo',                  role:'admin' },
];

async function main() {
  console.log(`🚀 SEED DEMO → ${URL}\n`);
  const U = {};

  console.log('1️⃣  Usuarios + perfiles');
  for (const u of USERS) {
    const id = await adminUser(u.email, u.name, u.role);
    if (!id) continue; U[u.key] = id;
    await up('profiles', { id, full_name: u.name, role: u.role, email: u.email, is_demo: true, onboarding_completed: true, is_verified: true, subscription_tier: 'premium' }, { onConflict: 'id' });
  }

  console.log('\n2️⃣  Escuela + sede + settings + suscripción');
  await up('schools', { id: ID.school, owner_id: U.school, name: 'Escuela Demo SportMaps', description: 'Escuela de demostración con datos ficticios para mostrar todas las funcionalidades de SportMaps.', city: 'Bogotá', address: 'Calle Demo 123', phone: '+57 300 000 0000', email: 'demo.escuela@sportmaps.co', verified: true, is_demo: true, school_type: 'academy', sports: ['Fútbol','Cheerleading','Natación'], accepts_reservations: true, onboarding_status: 'completed' });
  await up('school_branches', { id: ID.branch, school_id: ID.school, name: 'Sede Principal (Demo)', address: 'Calle Demo 123', city: 'Bogotá', is_main: true, status: 'active', capacity: 200 });
  await up('school_settings', { school_id: ID.school, responsible_payment_policy: 'primary_acudiente', wompi_enabled: true, payment_setup_completed: true, bank_name: 'Bancolombia (Demo)', show_programs: true, show_plans: true, show_facilities: true }, { onConflict: 'school_id' });
  await up('school_subscriptions', { school_id: ID.school, plan_code: 'profesional', tier: 'pro', status: 'active', billing_cycle: 'monthly', current_period_start: '2026-06-01', current_period_end: '2026-07-01', metadata: { demo: true } }, { onConflict: 'school_id' });

  console.log('\n3️⃣  Miembros de escuela');
  await up('school_members', [
    { school_id: ID.school, profile_id: U.school,   role: 'owner',   status: 'active' },
    { school_id: ID.school, profile_id: U.coach1,   role: 'coach',   status: 'active' },
    { school_id: ID.school, profile_id: U.coach2,   role: 'coach',   status: 'active' },
    { school_id: ID.school, profile_id: U.parent1,  role: 'parent',  status: 'active' },
    { school_id: ID.school, profile_id: U.parent2,  role: 'parent',  status: 'active' },
    { school_id: ID.school, profile_id: U.athlete1, role: 'athlete', status: 'active' },
  ].filter(m => m.profile_id), { onConflict: 'school_id,profile_id' });

  console.log('\n4️⃣  Staff (coach_id) + equipos');
  const staff1 = await ensureStaff(ID.school, U.coach1, 'Carlos Ramírez', 'demo.coach1@sportmaps.co', 'Fútbol');
  const staff2 = await ensureStaff(ID.school, U.coach2, 'Laura Gómez', 'demo.coach2@sportmaps.co', 'Cheerleading');
  await up('teams', [
    { id: ID.teamThunder,   school_id: ID.school, coach_id: staff1, name: 'Thunder',   sport: 'Fútbol',       age_group: 'Sub-12', is_demo: true, max_students: 20, level: 'Intermedio', price_monthly: 120000, status: 'active' },
    { id: ID.teamLightning, school_id: ID.school, coach_id: staff1, name: 'Lightning', sport: 'Fútbol',       age_group: 'Sub-15', is_demo: true, max_students: 20, level: 'Avanzado',   price_monthly: 150000, status: 'active' },
    { id: ID.teamHalcones,  school_id: ID.school, coach_id: staff2, name: 'Halcones',  sport: 'Cheerleading', age_group: 'Sub-14', is_demo: true, max_students: 24, level: 'Intermedio', price_monthly: 130000, status: 'active' },
  ]);

  console.log('\n5️⃣  Offerings + planes');
  await up('offerings', [
    { id: ID.offMembership, school_id: ID.school, name: 'Membresía Mensual', description: 'Acceso a entrenamientos regulares.', offering_type: 'membership', sport: 'Fútbol', is_active: true, metadata: { demo: true } },
    { id: ID.offSessions,   school_id: ID.school, name: 'Paquete de Sesiones', description: 'Bono de clases sueltas.', offering_type: 'session_pack', sport: 'Fútbol', is_active: true, metadata: { demo: true } },
  ]);
  await up('offering_plans', [
    { id: ID.planMonthly,  offering_id: ID.offMembership, school_id: ID.school, name: 'Mensual',    duration_days: 30, price: 120000, currency: 'COP', is_active: true, max_sessions: null, metadata: { demo: true } },
    { id: ID.planQuarter,  offering_id: ID.offMembership, school_id: ID.school, name: 'Trimestral', duration_days: 90, price: 330000, currency: 'COP', is_active: true, max_sessions: null, metadata: { demo: true } },
    { id: ID.planSessions, offering_id: ID.offSessions,   school_id: ID.school, name: 'Bono x8',    duration_days: 60, price: 200000, currency: 'COP', is_active: true, max_sessions: 8,    metadata: { demo: true } },
  ]);

  console.log('\n6️⃣  Hijos');
  await up('children', [
    { id: ID.childSofia,     parent_id: U.parent1, school_id: ID.school, full_name: 'Sofía García',    date_of_birth: '2014-05-10', is_demo: true, team_id: ID.teamThunder,   monthly_fee: 120000, gender: 'female', is_active: true },
    { id: ID.childMateo,     parent_id: U.parent1, school_id: ID.school, full_name: 'Mateo García',    date_of_birth: '2011-08-22', is_demo: true, team_id: ID.teamLightning, monthly_fee: 150000, gender: 'male',   is_active: true },
    { id: ID.childValentina, parent_id: U.parent2, school_id: ID.school, full_name: 'Valentina López', date_of_birth: '2012-02-14', is_demo: true, team_id: ID.teamHalcones,  monthly_fee: 130000, gender: 'female', is_active: true },
  ].filter(c => c.parent_id));

  console.log('\n7️⃣  Inscripciones');
  await up('enrollments', [
    { id: ID.u('3c',1), school_id: ID.school, child_id: ID.childSofia,     user_id: null, team_id: ID.teamThunder,   offering_id: ID.offMembership, offering_plan_id: ID.planMonthly, status: 'active', start_date: '2026-03-01', monthly_fee: 120000 },
    { id: ID.u('3c',2), school_id: ID.school, child_id: ID.childMateo,     user_id: null, team_id: ID.teamLightning, offering_id: ID.offMembership, offering_plan_id: ID.planMonthly, status: 'active', start_date: '2026-03-01', monthly_fee: 150000 },
    { id: ID.u('3c',3), school_id: ID.school, child_id: ID.childValentina, user_id: null, team_id: ID.teamHalcones,  offering_id: ID.offMembership, offering_plan_id: ID.planMonthly, status: 'active', start_date: '2026-04-01', monthly_fee: 130000 },
    { id: ID.u('3c',4), school_id: ID.school, child_id: null, user_id: U.athlete1, team_id: ID.teamLightning, offering_id: ID.offMembership, offering_plan_id: ID.planMonthly, status: 'active', start_date: '2026-05-01', monthly_fee: 150000 },
  ].filter(e => e.child_id || e.user_id));

  console.log('\n8️⃣  Pagos');
  const pay = (n, o) => ({ id: ID.u('3d', n), school_id: o.school_id || ID.school, parent_id: o.parent_id, concept: o.concept, amount: o.amount, due_date: o.due_date, status: o.status, payment_type: 'subscription', payment_method: o.status === 'paid' ? 'card' : null, payment_date: o.status === 'paid' ? o.due_date : null, amount_paid: o.status === 'paid' ? o.amount : 0, child_id: o.child_id, team_id: o.team_id, period_year: o.year, period_month: o.month });
  await up('payments', [
    pay(1, { parent_id: U.parent1, child_id: ID.childSofia, team_id: ID.teamThunder,   concept: 'Mensualidad Abril 2026', amount: 120000, due_date: '2026-04-05', status: 'paid',    year: 2026, month: 4 }),
    pay(2, { parent_id: U.parent1, child_id: ID.childSofia, team_id: ID.teamThunder,   concept: 'Mensualidad Mayo 2026',  amount: 120000, due_date: '2026-05-05', status: 'paid',    year: 2026, month: 5 }),
    pay(3, { parent_id: U.parent1, child_id: ID.childSofia, team_id: ID.teamThunder,   concept: 'Mensualidad Junio 2026', amount: 120000, due_date: '2026-06-05', status: 'paid',    year: 2026, month: 6 }),
    pay(4, { parent_id: U.parent1, child_id: ID.childSofia, team_id: ID.teamThunder,   concept: 'Mensualidad Julio 2026', amount: 120000, due_date: '2026-07-05', status: 'pending', year: 2026, month: 7 }),
    pay(5, { parent_id: U.parent1, child_id: ID.childMateo, team_id: ID.teamLightning, concept: 'Mensualidad Junio 2026', amount: 150000, due_date: '2026-06-05', status: 'paid',    year: 2026, month: 6 }),
    pay(6, { parent_id: U.parent2, child_id: ID.childValentina, team_id: ID.teamHalcones, concept: 'Mensualidad Mayo 2026',  amount: 130000, due_date: '2026-05-05', status: 'overdue', year: 2026, month: 5 }),
    pay(7, { parent_id: U.parent2, child_id: ID.childValentina, team_id: ID.teamHalcones, concept: 'Mensualidad Julio 2026', amount: 130000, due_date: '2026-07-05', status: 'pending', year: 2026, month: 7 }),
  ].filter(p => p.parent_id));

  console.log('\n9️⃣  Token de pago (tarjeta demo)');
  await up('payment_tokens', { id: ID.u('3e',1), user_id: U.parent1, wompi_token: 'tok_demo_visa_0001', payment_method_type: 'CARD', last_four: '4242', brand: 'VISA', is_default: true, is_active: true });

  console.log('\n🔟 Asistencia');
  const att = []; let ai = 1;
  for (const [child, team] of [[ID.childSofia, ID.teamThunder], [ID.childMateo, ID.teamLightning], [ID.childValentina, ID.teamHalcones]])
    for (let w = 0; w < 4; w++) att.push({ id: ID.u('3f', ai++), school_id: ID.school, child_id: child, team_id: team, attendance_date: dateStr(addDays(TODAY, -7 * w - 1)), status: w === 2 ? 'absent' : 'present', marked_by: U.coach1 });
  await up('attendance_records', att);

  console.log('\n1️⃣1️⃣  Instalación + reserva');
  await up('facilities', { id: ID.facilityCourt, school_id: ID.school, name: 'Cancha Sintética (Demo)', type: 'Cancha de fútbol', capacity: 22, hourly_rate: 80000, status: 'active', booking_enabled: true, rental_enabled: true, rental_rate: 80000 });
  await up('facility_reservations', { id: ID.u('40',1), facility_id: ID.facilityCourt, school_id: ID.school, user_id: U.parent1, reservation_date: dateStr(addDays(TODAY, 3)), start_time: '18:00', end_time: '19:00', status: 'confirmed', price: 80000, payment_status: 'paid' });

  console.log('\n1️⃣2️⃣  Marketplace: vendors, servicios, tienda');
  // vendors se auto-crean por trigger al crear el perfil; obtener ids reales
  async function vendorId(userId, type, display, slug) {
    if (!userId) return null;
    let rows = await get(`vendor_profiles?user_id=eq.${userId}&select=id,capabilities`);
    if (!rows[0]) {
      await up('vendor_profiles', { user_id: userId, vendor_type: type, display_name: display, slug, verification_status: 'verified', is_active: true, capabilities: type === 'store' ? { can_sell_products: true, can_sell_services: false } : { can_sell_products: false, can_sell_services: true } }, { onConflict: 'user_id' });
      rows = await get(`vendor_profiles?user_id=eq.${userId}&select=id`);
    } else {
      await patch('vendor_profiles', `user_id=eq.${userId}`, { display_name: display, city: 'Bogotá', verification_status: 'verified', is_active: true });
    }
    return rows[0]?.id || null;
  }
  const vWellness = await vendorId(U.wellness, 'wellness', 'Dra. Sofía Rivera — Fisioterapia', 'dra-sofia-rivera-demo');
  const vStore = await vendorId(U.store, 'store', 'Tienda Equípate Más', 'tienda-equipate-demo');

  if (vWellness) {
    await up('service_listings', [
      { id: ID.u('41',1), vendor_profile_id: vWellness, name: 'Sesión de Fisioterapia Deportiva', service_type: 'Fisioterapia', price: 90000, currency: 'COP', duration_minutes: 60, description: 'Evaluación y tratamiento físico deportivo (demo).', visibility: 'public', is_active: true },
      { id: ID.u('41',2), vendor_profile_id: vWellness, name: 'Plan Nutricional Deportivo', service_type: 'Nutricion', price: 110000, currency: 'COP', duration_minutes: 45, description: 'Plan de nutrición personalizado para atletas (demo).', visibility: 'public', is_active: true },
    ]);
    await up('subscription_plans', { id: ID.u('42',1), vendor_profile_id: vWellness, name: 'Plan Mensual Fisio', plan_type: 'service_package', price: 240000, currency: 'COP', billing_period: 'monthly', is_active: true });
  }
  await up('wellness_appointments', { id: ID.u('43',1), professional_id: U.wellness, athlete_id: U.athlete1, athlete_name: 'Juan Martínez', appointment_date: dateStr(addDays(TODAY, 2)), appointment_time: '10:00', duration_minutes: 60, service_type: 'Fisioterapia', status: 'confirmed', is_demo: true, notes: 'Cita demo' });

  console.log('\n1️⃣3️⃣  Tienda: productos + orden');
  if (vStore) {
    const cat = (await get('product_categories?select=id&limit=1'))[0]?.id || null;
    const prods = [
      { id: ID.u('44',1), vendor_id: U.store, vendor_profile_id: vStore, school_id: ID.school, name: 'Balón Fútbol Pro (Demo)', description: 'Balón profesional cosido a máquina, tamaño 5, ideal para entrenamientos y partidos.', price: 85000, stock: 40, active: true, status: 'draft', image_url: 'https://picsum.photos/seed/balon/600', category_id: cat, visibility: 'public' },
      { id: ID.u('44',2), vendor_id: U.store, vendor_profile_id: vStore, school_id: ID.school, name: 'Uniforme Thunder (Demo)', description: 'Uniforme oficial del equipo Thunder, tela transpirable, incluye camiseta y pantaloneta.', price: 120000, stock: 25, active: true, status: 'draft', image_url: 'https://picsum.photos/seed/uniforme/600', category_id: cat, visibility: 'public' },
      { id: ID.u('44',3), vendor_id: U.store, vendor_profile_id: vStore, school_id: ID.school, name: 'Guayos Talla 38 (Demo)', description: 'Guayos para grama sintética, suela FG, excelente agarre y comodidad para el jugador.', price: 210000, stock: 12, active: true, status: 'draft', image_url: 'https://picsum.photos/seed/guayos/600', category_id: cat, visibility: 'public' },
    ].filter(p => p.vendor_id);
    await up('products', prods);
    // intentar publicar (requiere categoria + imagen + desc>=30); si falla, quedan en draft
    if (cat) for (const p of prods) await patch('products', `id=eq.${p.id}`, { status: 'active' });
    await up('orders', { id: ID.u('45',1), user_id: U.parent1, total_amount: 205000, status: 'paid' });
    await up('order_items', [
      { id: ID.u('46',1), order_id: ID.u('45',1), product_id: ID.u('44',1), quantity: 1, unit_price: 85000 },
      { id: ID.u('46',2), order_id: ID.u('45',1), product_id: ID.u('44',2), quantity: 1, unit_price: 120000 },
    ]);
  }

  console.log('\n1️⃣4️⃣  Entrenador personal (micro-academia)');
  if (U.trainer) {
    await up('schools', { id: ID.ptSchool, owner_id: U.trainer, name: 'Andrés Torres — Entrenamiento Personal (Demo)', description: 'Entrenador personal independiente con sus propios atletas (demo).', city: 'Bogotá', verified: true, is_demo: true, school_type: 'academy', sports: ['Atletismo','Fitness'], onboarding_status: 'completed' });
    await up('school_members', [
      { school_id: ID.ptSchool, profile_id: U.trainer, role: 'owner', status: 'active' },
      U.athlete1 ? { school_id: ID.ptSchool, profile_id: U.athlete1, role: 'athlete', status: 'active' } : null,
    ], { onConflict: 'school_id,profile_id' });
    const staffPT = await ensureStaff(ID.ptSchool, U.trainer, 'Andrés Torres', 'demo.trainer@sportmaps.co', 'Entrenamiento Personal');
    await up('teams', { id: ID.teamPT, school_id: ID.ptSchool, coach_id: staffPT, name: 'Atletas PT', sport: 'Atletismo', age_group: 'Adultos', is_demo: true, max_students: 10, level: 'Avanzado', price_monthly: 250000, status: 'active' });
    if (U.athlete1) {
      await up('enrollments', { id: ID.u('3c',20), school_id: ID.ptSchool, child_id: null, user_id: U.athlete1, team_id: ID.teamPT, status: 'active', start_date: '2026-05-01', monthly_fee: 250000 });
      await up('payments', pay(20, { school_id: ID.ptSchool, parent_id: U.athlete1, child_id: null, team_id: ID.teamPT, concept: 'Entrenamiento Personal Junio 2026', amount: 250000, due_date: '2026-06-05', status: 'paid', year: 2026, month: 6 }));
    }
  }

  console.log('\n1️⃣5️⃣  Evento del organizador + inscripciones');
  if (U.organizer) {
    await up('events', { id: ID.event, creator_id: U.organizer, slug: 'copa-demo-sportmaps-2026', title: 'Copa Demo SportMaps 2026', sport: 'Fútbol', creator_role: 'organizer', event_type: 'tournament', status: 'active', event_date: dateStr(addDays(TODAY, 20)), start_time: '08:00', address: 'Complejo Deportivo Demo', city: 'Bogotá', capacity: 100, price: 50000 });
    await up('event_registrations', [
      { id: ID.u('47',1), event_id: ID.event, participant_name: 'Sofía García',    participant_phone: '+57 300 000 0001', participant_role: 'athlete', status: 'approved', payment_status: 'verified' },
      { id: ID.u('47',2), event_id: ID.event, participant_name: 'Valentina López', participant_phone: '+57 300 000 0002', participant_role: 'athlete', status: 'pending',  payment_status: 'pending' },
    ]);
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(`✅ OK: ${stats.ok}   ⏭️  omitidas: ${stats.skip}   ❌ errores: ${stats.err}`);
  console.log(`════════════════════════════════════════`);
  console.log(`\n🔑 Password (todos): ${PASSWORD}`);
  for (const u of USERS) console.log(`   ${u.role.padEnd(22)} ${u.email}`);
}
main().catch(e => { console.error(e); process.exit(1); });
