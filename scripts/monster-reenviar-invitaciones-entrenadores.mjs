// ============================================================================
// Reenvía el correo de invitación a los entrenadores de Monster´s Volley Club
// cuya invitación sigue 'pending' (no crea invitaciones nuevas: reutiliza el id
// de cada una, así el enlace de registro sigue ligado a la misma fila).
//
// Mismo payload que routes/invitations.routes.ts (bulk-send) y mismo registro en
// email_sends, pero con service role porque no hay una sesión de admin.
//
// Uso:
//   node scripts/monster-reenviar-invitaciones-entrenadores.mjs            (simulacro)
//   node scripts/monster-reenviar-invitaciones-entrenadores.mjs --confirmar
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
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
if (!BASE || !KEY) throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en bff/.env');
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const SCHOOL_ID = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c';
// Fija: el FRONTEND_URL de bff/.env local es http://localhost:5173 y mandaba enlaces rotos.
const FRONTEND_URL = 'https://app.sportmaps.co';

async function rest(pathAndQuery, init = {}) {
  const res = await fetch(`${BASE}/rest/v1/${pathAndQuery}`, { headers: HEADERS, ...init });
  const text = await res.text();
  if (!res.ok) throw new Error(`${pathAndQuery} -> ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  console.log(`Modo: ${CONFIRMAR ? 'CONFIRMAR (envía correos)' : 'SIMULACRO (no envía nada)'}\n`);

  const [school] = await rest(`schools?id=eq.${SCHOOL_ID}&select=name`);
  const invs = await rest(
    `invitations?school_id=eq.${SCHOOL_ID}&role_to_assign=eq.coach&status=eq.pending&email=not.is.null&select=id,email,child_name&order=created_at.asc`,
  );
  console.log(`Escuela: ${school.name} · invitaciones de entrenador pendientes: ${invs.length}\n`);

  const batchId = randomUUID();
  const logRows = [];
  for (const inv of invs) {
    const registrationUrl = `${FRONTEND_URL}/register?email=${encodeURIComponent(inv.email)}&role=coach&invite=${inv.id}`;
    console.log(`- ${inv.child_name || '(sin nombre)'} <${inv.email}> · invitación ${inv.id}`);
    if (!CONFIRMAR) continue;

    const res = await fetch(`${BASE}/functions/v1/send-email`, {
      method: 'POST', headers: HEADERS,
      body: JSON.stringify({
        type: 'coach_invitation', to: inv.email,
        data: { schoolName: school.name, coachName: inv.child_name || '', registrationUrl },
      }),
    });
    const text = await res.text();
    console.log(`  correo: ${res.status} ${text.slice(0, 160)}`);
    let providerId = null;
    try { providerId = JSON.parse(text)?.id ?? JSON.parse(text)?.results?.[0]?.id ?? null; } catch { /* sin id */ }
    logRows.push({
      school_id: SCHOOL_ID, invitation_id: inv.id, to_email: inv.email, email_type: 'coach_invitation',
      provider_message_id: providerId, status: res.ok ? 'sent' : 'failed',
      error: res.ok ? null : text.slice(0, 1000), attempts: 1, batch_id: batchId,
    });
  }

  if (CONFIRMAR && logRows.length) {
    await rest('email_sends', { method: 'POST', body: JSON.stringify(logRows) });
    console.log(`\nRegistrados ${logRows.length} envíos en email_sends (lote ${batchId}).`);
  }
}

main().catch((err) => { console.error('ERROR:', err.message); process.exit(1); });
