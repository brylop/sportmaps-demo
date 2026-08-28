// ============================================================================
// Invita a los 7 entrenadores de Carmel Club (ya cargados en school_staff el
// 26-ago) para que creen su cuenta. No se asigna equipo/disciplina todavía —
// Carmel aún no tiene las 7 disciplinas configuradas como equipos, solo el
// equipo genérico "Carmel Club" — así que team_id queda NULL en la invitación
// y se vincula después desde team_coaches cuando existan los equipos reales.
//
// Por persona:
//   1. invitations (misma fila que crearía create_invitation, vía service
//      role porque no hay una sesión de auth.uid() real para llamar la RPC)
//   2. correo real vía la Edge Function send-email (mismo payload que usa
//      InvitationsManagementPage.tsx)
//
// Uso:
//   node scripts/carmel-invitar-entrenadores.mjs            (dry-run)
//   node scripts/carmel-invitar-entrenadores.mjs --confirmar
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const CONFIRMAR = process.argv.includes('--confirmar');

const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, 'bff/.env'), 'utf8')
    .split(/\r?\n/).filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
);
const BASE = (env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const SCHOOL_ID = '374a6716-af42-4745-afe1-8d089153e01b';
const SCHOOL_NAME = 'Carmel Club';
const BRANCH_ID = '7e740a1b-8378-4d32-a7f9-648035431edb';
const OWNER_PROFILE_ID = '29cd5373-8ecf-4b12-b914-a4db50bd17c9';
const REGISTRATION_ORIGIN = 'https://app.sportmaps.co';

const COACHES = [
  { staff_id: '873514c7-7265-40f0-a378-1932b6ee4aa9', full_name: 'Yohan Andres Casas Mateus', email: 'andrescasasmateus@hotmail.com', phone: '+573192864840' },
  { staff_id: 'e6dcebac-3901-4961-bf6c-b5eda3d1e4b1', full_name: 'Sergio Nicolás Polanco Quiroga', email: 'plc.sntw@hotmail.com', phone: '+573216096565' },
  { staff_id: 'e7370626-291b-4295-bae6-43e6625b7c49', full_name: 'Michael David Suárez Castillo', email: 'michael11suarez9@gmail.com', phone: '+573016839554' },
  { staff_id: 'ae8d4b7e-952c-4720-ba1d-e647d909cbf4', full_name: 'Robert Herrera Rincon', email: 'robertherrera03@hotmail.com', phone: '+573113568735' },
  { staff_id: 'd74a3065-d7e4-4708-995e-93c802ad5cef', full_name: 'Victor Alfonso Melo Martinez', email: 'victoralfonsomelomartinez@gmail.com', phone: '+573142333450' },
  { staff_id: 'd3a01d34-9c89-4970-bf16-41e6619d9ab8', full_name: 'Carlos Arturo Ruiz', email: 'caturro081@gmail.com', phone: '+573108609562' },
  { staff_id: 'e46a8771-a409-4862-938d-e744b07e2ffa', full_name: 'Gerardo Andres García Chacon', email: 'garciaandresch11@gmail.com', phone: '+573224170876' },
];

async function main() {
  console.log(`Modo: ${CONFIRMAR ? 'CONFIRMAR (escribe)' : 'DRY-RUN (nada se escribe)'}\n`);

  for (const coach of COACHES) {
    console.log(`--- ${coach.full_name} (${coach.email}) ---`);

    if (!CONFIRMAR) {
      console.log('  (dry-run: no se escribe nada)\n');
      continue;
    }

    // 1. invitations — misma fila que crearía create_invitation (sin team_id)
    const invIns = await fetch(`${BASE}/rest/v1/invitations`, {
      method: 'POST', headers: { ...HEADERS, Prefer: 'return=representation' },
      body: JSON.stringify({
        email: coach.email.toLowerCase(), school_id: SCHOOL_ID, role_to_assign: 'coach',
        invited_by: OWNER_PROFILE_ID, child_name: coach.full_name, team_id: null,
        parent_phone: coach.phone, branch_id: BRANCH_ID, status: 'pending',
      }),
    });
    const invText = await invIns.text();
    if (!invIns.ok) throw new Error(`invitations INSERT -> ${invText.slice(0, 300)}`);
    const inviteId = JSON.parse(invText)[0].id;
    console.log(`  invitation creada: ${inviteId}`);

    // 2. correo real
    const registrationUrl = `${REGISTRATION_ORIGIN}/register?email=${encodeURIComponent(coach.email)}&role=coach&invite=${inviteId}`;
    const emailRes = await fetch(`${BASE}/functions/v1/send-email`, {
      method: 'POST', headers: { ...HEADERS },
      body: JSON.stringify({
        type: 'coach_invitation', to: coach.email,
        data: { schoolName: SCHOOL_NAME, coachName: coach.full_name, registrationUrl },
      }),
    });
    const emailText = await emailRes.text();
    console.log(`  email: ${emailRes.status} ${emailText.slice(0, 200)}`);
    console.log('');
  }
}

main().catch((err) => { console.error('ERROR:', err.message); process.exit(1); });
