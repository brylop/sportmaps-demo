// ============================================================================
// Carga a los 3 «Asistentes» de Monster Volley que 06_cargar_entrenadores.mjs
// dejó afuera (hoja ENTRENADORES del Excel de Suba): Tatiana Díaz, Ana Sofía
// Forero y Julián Torres. El usuario pidió el 2026-10-23 cargarlos con los
// permisos de coach (hoy no existe un tier de asistente: `coach` les da el mismo
// acceso que al titular; ver memoria project_monster_volley_categorias_roles).
//
// Por persona (idempotente: si ya existe, no duplica):
//   1. school_staff (alta, status active, sede Suba)
//   2. team_coaches para el equipo que la hoja les asigna
//   3. invitations (misma fila que crearía create_invitation, rol coach)
//   4. correo real vía la Edge Function send-email + registro en email_sends
//
// Uso:
//   node scripts/monster-volley-suba-import/07_cargar_asistentes.mjs            (simulacro)
//   node scripts/monster-volley-suba-import/07_cargar_asistentes.mjs --confirmar
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const CONFIRMAR = process.argv.includes('--confirmar');

const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, 'bff/.env'), 'utf8')
    .split(/\r?\n/).filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
);
const BASE = (env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!BASE || !KEY) throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en bff/.env');
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const SCHOOL_ID = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c';
const BRANCH_ID = '531a2df9-dab4-47bb-a1cf-5a904b276c46'; // sede principal (Suba)
const OWNER_PROFILE_ID = '1247192f-eefa-471e-a939-d52f13962a90';
// Fija: el FRONTEND_URL de bff/.env local es http://localhost:5173 y mandaba enlaces rotos.
const REGISTRATION_ORIGIN = 'https://app.sportmaps.co';

const TEAMS = {
  U9U11: 'b45bd5cb-1ac5-457c-bb4e-129477f99108',          // U9 Y U11 MIXTO
  MAYORES_MIXTO: '444bca9a-26cb-4ef9-a719-9c6cbf32fd4e',  // MIXTO MAYORES PROFUNDIZACION
};

const ASISTENTES = [
  { full_name: 'Tatiana Díaz', email: 'tatianadiaz022@gmail.com', phone: '3134389625', team: 'MAYORES_MIXTO' },
  { full_name: 'Ana Sofía Forero Orozco', email: 'foreroorozcoanasofia@gmail.com', phone: '3217189990', team: 'U9U11' },
  { full_name: 'Julián Torres', email: 'torresjulian2723@gmail.com', phone: '3027822723', team: 'U9U11' },
];

async function rest(pathAndQuery, init = {}) {
  const res = await fetch(`${BASE}/rest/v1/${pathAndQuery}`, { headers: HEADERS, ...init });
  const text = await res.text();
  if (!res.ok) throw new Error(`${pathAndQuery} -> ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  console.log(`Modo: ${CONFIRMAR ? 'CONFIRMAR (escribe y envía correos)' : 'SIMULACRO (no escribe nada)'}`);
  console.log(`Enlace de registro: ${REGISTRATION_ORIGIN}/register?...\n`);

  const [owner] = await rest(`school_members?school_id=eq.${SCHOOL_ID}&profile_id=eq.${OWNER_PROFILE_ID}&select=role,status`);
  if (!owner || owner.role !== 'owner' || owner.status !== 'active') {
    throw new Error('OWNER_PROFILE_ID no es el dueño activo de Monster: no sigo.');
  }
  const [school] = await rest(`schools?id=eq.${SCHOOL_ID}&select=name`);

  const batchId = randomUUID();
  const logRows = [];

  for (const a of ASISTENTES) {
    const email = a.email.toLowerCase();
    console.log(`--- ${a.full_name} <${email}> · equipo ${a.team} ---`);

    const [profile] = await rest(`profiles?email=ilike.${encodeURIComponent(email)}&select=id`);
    if (profile) { console.log('  ya tiene cuenta: se omite'); continue; }

    const staffRows = await rest(`school_staff?school_id=eq.${SCHOOL_ID}&email=ilike.${encodeURIComponent(email)}&select=id`);
    const invRows = await rest(`invitations?school_id=eq.${SCHOOL_ID}&email=ilike.${encodeURIComponent(email)}&role_to_assign=eq.coach&status=eq.pending&select=id`);
    console.log(`  staff existente: ${staffRows.length} · invitación pendiente existente: ${invRows.length}`);
    if (!CONFIRMAR) continue;

    let staffId = staffRows[0]?.id;
    if (!staffId) {
      const [created] = await rest('school_staff', {
        method: 'POST', headers: { ...HEADERS, Prefer: 'return=representation' },
        body: JSON.stringify({
          school_id: SCHOOL_ID, full_name: a.full_name, email, phone: a.phone,
          specialty: 'Voleibol — Asistente', branch_id: BRANCH_ID, status: 'active',
        }),
      });
      staffId = created.id;
      console.log(`  school_staff creado: ${staffId}`);
    }

    const tc = await fetch(`${BASE}/rest/v1/team_coaches`, {
      method: 'POST', headers: { ...HEADERS, Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify({ team_id: TEAMS[a.team], coach_id: staffId, school_id: SCHOOL_ID }),
    });
    console.log(`  team_coaches ${a.team}: ${tc.ok ? 'OK' : (await tc.text()).slice(0, 160)}`);

    let inviteId = invRows[0]?.id;
    if (!inviteId) {
      const [inv] = await rest('invitations', {
        method: 'POST', headers: { ...HEADERS, Prefer: 'return=representation' },
        body: JSON.stringify({
          email, school_id: SCHOOL_ID, role_to_assign: 'coach', invited_by: OWNER_PROFILE_ID,
          child_name: a.full_name, team_id: TEAMS[a.team], branch_id: BRANCH_ID, status: 'pending',
        }),
      });
      inviteId = inv.id;
      console.log(`  invitation creada: ${inviteId}`);
    }

    const registrationUrl = `${REGISTRATION_ORIGIN}/register?email=${encodeURIComponent(email)}&role=coach&invite=${inviteId}`;
    const res = await fetch(`${BASE}/functions/v1/send-email`, {
      method: 'POST', headers: HEADERS,
      body: JSON.stringify({ type: 'coach_invitation', to: email, data: { schoolName: school.name, coachName: a.full_name, registrationUrl } }),
    });
    const text = await res.text();
    console.log(`  correo: ${res.status} ${text.slice(0, 120)}`);
    let providerId = null;
    try { providerId = JSON.parse(text)?.id ?? null; } catch { /* sin id */ }
    logRows.push({
      school_id: SCHOOL_ID, invitation_id: inviteId, to_email: email, email_type: 'coach_invitation',
      provider_message_id: providerId, status: res.ok ? 'sent' : 'failed',
      error: res.ok ? null : text.slice(0, 1000), attempts: 1, batch_id: batchId,
    });
    console.log('');
  }

  if (CONFIRMAR && logRows.length) {
    await rest('email_sends', { method: 'POST', body: JSON.stringify(logRows) });
    console.log(`Registrados ${logRows.length} envíos en email_sends (lote ${batchId}).`);
  }
}

main().catch((err) => { console.error('ERROR:', err.message); process.exit(1); });
