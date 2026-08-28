// ============================================================================
// Carga los 4 entrenadores confirmados de Monster Volley (Jeffrey, Sebastian,
// Laura, Santiago) — sin ambigüedad de rol. Tatiana/Ana Sofía/Julián quedan
// afuera: tienen el rol "Asistente", que hoy no tiene permiso propio en el
// sistema, y el usuario pidió esperar la respuesta de la escuela a la
// propuesta de roles antes de cargarlos.
//
// Por persona:
//   1. school_staff (alta o actualización si ya existe por email)
//   2. team_coaches para TODOS sus equipos (create_invitation solo soporta
//      un team_id, así que el resto se linkea acá directo)
//   3. invitations (misma fila que crearía create_invitation, vía service
//      role porque no hay una sesión de auth.uid() real para llamar la RPC)
//   4. correo real vía la Edge Function send-email (mismo payload que usa
//      InvitationsManagementPage.tsx)
//
// Uso:
//   node scripts/monster-volley-suba-import/06_cargar_entrenadores.mjs           (dry-run)
//   node scripts/monster-volley-suba-import/06_cargar_entrenadores.mjs --confirmar
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
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
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const SCHOOL_ID = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c';
const SCHOOL_NAME = "Monster's Volley Club";
const BRANCH_ID = '531a2df9-dab4-47bb-a1cf-5a904b276c46'; // sede principal (Suba)
const OWNER_PROFILE_ID = '1247192f-eefa-471e-a939-d52f13962a90';
const REGISTRATION_ORIGIN = 'https://stg.sportmaps.co';

const TEAMS = {
  U15FEMCOMP:  '9abf3ced-6da5-460d-b181-f081bda43b25',
  U15MASC:     '4a0bc0a4-26c8-4e54-adc0-6242227f924d',
  U17MASCCOMP: '4c525cfb-6eeb-4e98-b9fa-20ddeb5d56ff',
  U13:         'a3dd05d2-228c-4c70-a9d4-95a37c919f2d',
  U15FEMPROY:  '64706216-e4f8-41f5-9a55-f0b61dd75f29',
  U17MASCPROY: 'bf487f87-2221-4bb5-b2dc-618215437159',
  U17FEMPROY:  '38e5c0c6-98d8-4674-a69f-5fa5fbfc15d4',
  U19U21FEM:   '13737c80-ad4c-4a70-b3e5-2846fc631c53',
  MAYFEM:      'a9edafee-616f-42f6-94d9-392ef78016a4',
  U19U21MASC:  '9a68a04f-8e57-4944-a145-f979c7ac5776',
  MAYMASC:     '39b009d2-ba60-48d2-af75-ef934630fbbe',
};

const COACHES = [
  {
    full_name: 'Jeffrey Mauricio Moreno',
    email: 'j.mauricio2212@hotmail.com',
    phone: '3102075574',
    specialty: 'Voleibol — Metodólogo',
    teams: ['U15FEMCOMP', 'U15MASC', 'U17MASCCOMP'],
  },
  {
    full_name: 'Sebastian Hurtado',
    email: 'jsebastianh1710@gmail.com',
    phone: '3143626505',
    specialty: 'Voleibol',
    teams: ['U13', 'U15FEMPROY', 'U17MASCPROY'],
  },
  {
    full_name: 'Laura Gómez',
    email: 'laura11gomez11@gmail.com',
    phone: '3194554880',
    specialty: 'Voleibol',
    teams: ['U17FEMPROY', 'U19U21FEM', 'MAYFEM'],
    existing_staff_id: '89d8cbc2-bbec-42b9-99d1-b8baa1f89c33', // ya existe, colgada del equipo viejo duplicado
  },
  {
    full_name: 'Santiago Carranza Higuita',
    email: 'carranza9622@gmail.com',
    phone: '3162693371',
    specialty: 'Voleibol',
    teams: ['U19U21MASC', 'MAYMASC'],
  },
];

async function main() {
  console.log(`Modo: ${CONFIRMAR ? 'CONFIRMAR (escribe)' : 'DRY-RUN (nada se escribe)'}\n`);

  for (const coach of COACHES) {
    console.log(`--- ${coach.full_name} (${coach.email}) ---`);
    console.log(`  Equipos: ${coach.teams.join(', ')}`);

    if (!CONFIRMAR) {
      console.log('  (dry-run: no se escribe nada)\n');
      continue;
    }

    // 1. school_staff — upsert por (email, school_id)
    let staffId = coach.existing_staff_id;
    if (staffId) {
      const upd = await fetch(`${BASE}/rest/v1/school_staff?id=eq.${staffId}`, {
        method: 'PATCH', headers: { ...HEADERS, Prefer: 'return=representation' },
        body: JSON.stringify({ full_name: coach.full_name, phone: coach.phone, specialty: coach.specialty, branch_id: BRANCH_ID, status: 'active' }),
      });
      const updText = await upd.text();
      if (!upd.ok) throw new Error(`school_staff PATCH -> ${updText.slice(0, 300)}`);
      console.log(`  school_staff actualizado: ${staffId}`);
    } else {
      const ins = await fetch(`${BASE}/rest/v1/school_staff`, {
        method: 'POST', headers: { ...HEADERS, Prefer: 'return=representation,resolution=merge-duplicates' },
        body: JSON.stringify({
          school_id: SCHOOL_ID, full_name: coach.full_name, email: coach.email,
          phone: coach.phone, specialty: coach.specialty, branch_id: BRANCH_ID, status: 'active',
        }),
      });
      const insText = await ins.text();
      if (!ins.ok) throw new Error(`school_staff INSERT -> ${insText.slice(0, 300)}`);
      staffId = JSON.parse(insText)[0].id;
      console.log(`  school_staff creado: ${staffId}`);
    }

    // 2. team_coaches para TODOS los equipos
    for (const teamKey of coach.teams) {
      const teamId = TEAMS[teamKey];
      const tc = await fetch(`${BASE}/rest/v1/team_coaches`, {
        method: 'POST', headers: { ...HEADERS, Prefer: 'resolution=ignore-duplicates' },
        body: JSON.stringify({ team_id: teamId, coach_id: staffId, school_id: SCHOOL_ID }),
      });
      if (!tc.ok) {
        const t = await tc.text();
        if (!t.includes('duplicate')) console.warn(`  team_coaches ${teamKey} -> ${t.slice(0, 200)}`);
      } else {
        console.log(`  team_coaches: ${teamKey} OK`);
      }
    }

    // 3. invitations — misma fila que crearía create_invitation__interno
    const primaryTeam = TEAMS[coach.teams[0]];
    const invIns = await fetch(`${BASE}/rest/v1/invitations`, {
      method: 'POST', headers: { ...HEADERS, Prefer: 'return=representation' },
      body: JSON.stringify({
        email: coach.email.toLowerCase(), school_id: SCHOOL_ID, role_to_assign: 'coach',
        invited_by: OWNER_PROFILE_ID, child_name: coach.full_name, team_id: primaryTeam,
        branch_id: BRANCH_ID, status: 'pending',
      }),
    });
    const invText = await invIns.text();
    if (!invIns.ok) throw new Error(`invitations INSERT -> ${invText.slice(0, 300)}`);
    const inviteId = JSON.parse(invText)[0].id;
    console.log(`  invitation creada: ${inviteId}`);

    // 4. correo real
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
