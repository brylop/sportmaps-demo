// ============================================================================
// SportMaps — ¿la misma persona existe más de una vez? (READ-ONLY)
//
// Barre TODAS las superficies donde puede nacer una identidad de atleta y
// reporta cuántas identidades facturables hay para la misma persona:
//
//   auth.users → profiles → school_members → enrollments → payments
//   unregistered_athletes (registro precargado por la escuela)
//   children (menores a cargo de un acudiente)
//
// El duplicado clásico: la escuela precarga al atleta en `unregistered_athletes`
// y la persona se registra por su cuenta SIN pasar por la invitación. Nacen dos
// identidades sin conectar y AMBAS quedan facturables → doble cobro en la
// siguiente apertura de mes.
//
// Rastrea por documento / teléfono / fecha de nacimiento, NO por nombre:
// "Dai Vázquez" y "DAIMARIS VASQUEZ PEREZ" no matchean por texto.
//
// Uso:
//   node scripts/check-duplicate-identity.mjs --email correo@dominio.com
//   node scripts/check-duplicate-identity.mjs --doc 1014669246
//   node scripts/check-duplicate-identity.mjs --phone 573132699251
//   node scripts/check-duplicate-identity.mjs --name "MIGUEL ANGEL RUNZA"
//   (se pueden combinar; entre más señales, mejor el rastreo)
//
// NO escribe nada. Lee con la service key de bff/.env.
// ============================================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// ── argumentos ──────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };
const q = {
  email: (arg('email') || '').trim().toLowerCase() || null,
  doc: (arg('doc') || '').trim() || null,
  phone: (arg('phone') || '').replace(/\D/g, '') || null,
  name: (arg('name') || '').trim() || null,
};
if (!q.email && !q.doc && !q.phone && !q.name) {
  console.error('Uso: node scripts/check-duplicate-identity.mjs --email x@y.com [--doc 123] [--phone 57300…] [--name "NOMBRE"]');
  process.exit(2);
}

// ── conexión ────────────────────────────────────────────────────────────────
const here = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(here, '../bff/.env'), 'utf8')
    .split(/\r?\n/).filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }),
);
const URL_ = env.SUPABASE_URL.replace(/\/$/, '');
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) { console.error('Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en bff/.env'); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const rest = async (path) => {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { headers: H });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { return { __error: t.slice(0, 200) }; }
  return r.ok ? j : { __error: j.message || JSON.stringify(j).slice(0, 200) };
};
const ok = (d) => Array.isArray(d) ? d : [];
const uniq = (a) => [...new Set(a.filter(Boolean))];
// `or=` de PostgREST necesita los valores sin comas sueltas; los UUID son seguros.
const inList = (ids) => `(${(ids.length ? ids : ['00000000-0000-0000-0000-000000000000']).join(',')})`;
// Para el nombre exigimos que TODOS los tokens estén presentes. Usar solo el
// token más largo trae a todo el que comparta apellido ("RAMIREZ" devolvió 24
// niños del club). PostgREST permite anidar: or=(…,and(ilike,ilike,…)).
const nameTokens = q.name ? q.name.split(/\s+/).filter((t) => t.length >= 3) : [];
const nameStem = nameTokens.length ? nameTokens.join(' ') : null; // solo para mostrar
const nameClause = (col) => nameTokens.length
  ? `and(${nameTokens.map((t) => `${col}.ilike.*${t}*`).join(',')})`
  : null;

console.log('='.repeat(72));
console.log('Proyecto :', URL_.replace('https://', '').split('.')[0]);
console.log('Buscando :', JSON.stringify(q), nameStem ? `(raíz de nombre: "${nameStem}")` : '');
console.log('='.repeat(72));

// ── 1. auth.users ───────────────────────────────────────────────────────────
// Dos cuentas de auth para la misma persona = está entrando a la equivocada.
const authHits = [];
for (const needle of uniq([q.email])) {
  const r = await fetch(`${URL_}/auth/v1/admin/users?filter=${encodeURIComponent(needle)}`, { headers: H });
  const j = await r.json();
  for (const u of (j.users || [])) if (!authHits.some((x) => x.id === u.id)) authHits.push(u);
}
console.log(`\n▸ auth.users (${authHits.length})`);
for (const u of authHits) {
  console.log(`  ${u.email}`);
  console.log(`     id=${u.id}  confirmado=${u.email_confirmed_at ? 'sí' : '❌ NO'}  ultimo_login=${u.last_sign_in_at || '❌ nunca'}  proveedores=${(u.identities || []).map((i) => i.provider).join(',') || '-'}`);
}
if (authHits.length > 1) console.log('  ⚠️  MÁS DE UNA CUENTA DE AUTH — puede estar entrando a la que no tiene la inscripción.');

// ── 2. profiles ─────────────────────────────────────────────────────────────
const profFilters = [];
if (q.email) profFilters.push(`email.ilike.${q.email}`);
if (q.phone) profFilters.push(`phone.ilike.*${q.phone.slice(-10)}*`);
if (nameClause('full_name')) profFilters.push(nameClause('full_name'));
const profs = ok(await rest(`profiles?or=(${profFilters.join(',')})&select=id,email,full_name,phone,role,date_of_birth,created_at`));
console.log(`\n▸ profiles (${profs.length})`);
for (const p of profs) console.log(`  ${p.full_name} | ${p.email} | tel=${p.phone || '-'} | rol=${p.role} | nac=${p.date_of_birth || '-'} | id=${p.id}`);
const profIds = profs.map((p) => p.id);

// ── 3. unregistered_athletes (registro precargado por la escuela) ───────────
const uaFilters = [];
if (q.doc) uaFilters.push(`doc_number.eq.${q.doc}`);
if (q.email) uaFilters.push(`email.ilike.${q.email}`);
if (q.phone) uaFilters.push(`phone.ilike.*${q.phone.slice(-10)}*`);
if (nameClause('full_name')) uaFilters.push(nameClause('full_name'));
const uas = ok(await rest(`unregistered_athletes?or=(${uaFilters.join(',')})&select=id,school_id,full_name,doc_number,email,phone,date_of_birth,is_active,linked_profile_id,invitation_id,created_at`));
console.log(`\n▸ unregistered_athletes (${uas.length})`);
for (const u of uas) {
  const estado = u.linked_profile_id ? `✅ vinculado a ${u.linked_profile_id}` : '❌ SIN VINCULAR (badge "Sin cuenta")';
  console.log(`  ${u.full_name} | doc=${u.doc_number || '-'} | activo=${u.is_active} | ${estado} | id=${u.id}`);
}

// ── 4. children (si es menor a cargo de un acudiente) ───────────────────────
const chFilters = [];
if (q.doc) chFilters.push(`doc_number.eq.${q.doc}`);
if (q.email) chFilters.push(`parent_email_temp.ilike.${q.email}`);
if (nameClause('full_name')) chFilters.push(nameClause('full_name'));
const kids = ok(await rest(`children?or=(${chFilters.join(',')})&select=id,full_name,parent_id,parent_email_temp,doc_number,school_id,team_id,created_at`));
console.log(`\n▸ children (${kids.length})`);
for (const k of kids) console.log(`  ${k.full_name} | doc=${k.doc_number || '-'} | parent_id=${k.parent_id || '❌ NULL (huérfano)'} | email_temp=${k.parent_email_temp || '-'} | id=${k.id}`);

// ── 5. invitaciones ─────────────────────────────────────────────────────────
const invFilters = [];
if (q.email) invFilters.push(`email.ilike.${q.email}`);
if (nameClause('child_name')) invFilters.push(nameClause('child_name'));
const invs = ok(await rest(`invitations?or=(${invFilters.join(',')})&select=id,email,status,role_to_assign,school_id,child_name,monthly_fee,created_at,expires_at&order=created_at.desc`));
console.log(`\n▸ invitations (${invs.length})`);
for (const i of invs) console.log(`  [${i.status}] ${i.child_name || i.email} | rol=${i.role_to_assign} | cuota=${i.monthly_fee || '-'} | creada=${(i.created_at || '').slice(0, 16)} | id=${i.id}`);
if (invs.some((i) => i.status === 'accepted')) {
  console.log('  ℹ️  Hay invitación ACCEPTED: ya se consumió. accept_invitation_pro hace RETURN true');
  console.log('     sin hacer nada si se reusa → una cuenta nueva quedaría VACÍA (éxito falso).');
}

// ── 6. enrollments (el eje de la facturación) ──────────────────────────────
const uaIds = uas.map((u) => u.id), kidIds = kids.map((k) => k.id);
const enrOr = [
  profIds.length ? `user_id.in.${inList(profIds)}` : null,
  kidIds.length ? `child_id.in.${inList(kidIds)}` : null,
  uaIds.length ? `unregistered_athlete_id.in.${inList(uaIds)}` : null,
].filter(Boolean);
const enrs = enrOr.length ? ok(await rest(`enrollments?or=(${enrOr.join(',')})&select=id,school_id,user_id,child_id,unregistered_athlete_id,team_id,offering_plan_id,status,monthly_fee,created_at&order=created_at`)) : [];
console.log(`\n▸ enrollments (${enrs.length})`);
for (const e of enrs) {
  const sujeto = e.user_id ? `user=${e.user_id.slice(0, 8)}` : e.child_id ? `child=${e.child_id.slice(0, 8)}` : e.unregistered_athlete_id ? `unreg=${e.unregistered_athlete_id.slice(0, 8)}` : '❌ sin sujeto';
  console.log(`  [${e.status}] ${sujeto} | equipo=${e.team_id ? e.team_id.slice(0, 8) : '❌ sin equipo'} | cuota=${e.monthly_fee ?? '❌ NULL'} | ${(e.created_at || '').slice(0, 16)} | id=${e.id}`);
}
const activas = enrs.filter((e) => e.status === 'active');

// ── 7. payments ─────────────────────────────────────────────────────────────
const payOr = enrOr; // mismas tres columnas de sujeto
const pays = payOr.length ? ok(await rest(`payments?or=(${payOr.join(',')})&select=id,school_id,user_id,child_id,unregistered_athlete_id,status,amount,due_date,parent_id&order=due_date`)) : [];
console.log(`\n▸ payments (${pays.length})`);
for (const p of pays) {
  console.log(`  [${p.status}] $${p.amount} vence ${p.due_date} | pagador=${p.parent_id ? p.parent_id.slice(0, 8) : '❌ NULL'} | id=${p.id}`);
}
// Mismo mes + mismo monto en la misma escuela = cobro duplicado.
const porMes = {};
for (const p of pays) {
  if (['cancelled', 'canceled', 'void'].includes(p.status)) continue;
  const k = `${p.school_id}|${(p.due_date || '').slice(0, 7)}|${p.amount}`;
  (porMes[k] ||= []).push(p);
}
const dobles = Object.entries(porMes).filter(([, v]) => v.length > 1);

// ── 8. school_athletes: la vista que la escuela realmente factura ──────────
const saOr = [
  profIds.length ? `user_id.in.${inList(profIds)}` : null,
  nameClause('full_name'),
].filter(Boolean);
const sas = saOr.length ? ok(await rest(`school_athletes?or=(${saOr.join(',')})&select=id,school_id,full_name,user_id,team_id,is_active,enrollment_status,enrollment_id,price_monthly,parent_email`)) : [];
console.log(`\n▸ school_athletes [VISTA — lo que ve y factura la escuela] (${sas.length})`);
for (const s of sas) console.log(`  ${s.full_name} | activo=${s.is_active} | inscripción=${s.enrollment_status} | equipo=${s.team_id ? s.team_id.slice(0, 8) : '-'} | $${s.price_monthly ?? '-'} | id=${s.id}`);

// ── VEREDICTO ───────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(72));
console.log('VEREDICTO');
console.log('='.repeat(72));
const problemas = [];
if (authHits.length > 1) problemas.push(`${authHits.length} cuentas de auth para la misma persona → puede estar entrando a la que no tiene la inscripción.`);
const sinVincular = uas.filter((u) => !u.linked_profile_id && u.is_active);
if (sinVincular.length && profs.length) problemas.push(`${sinVincular.length} registro(s) precargado(s) ACTIVO(s) y SIN vincular, existiendo ya un perfil → identidad partida en dos.`);
if (activas.length > 1) problemas.push(`${activas.length} inscripciones ACTIVAS → cada una es facturable.`);
if (dobles.length) problemas.push(`${dobles.length} grupo(s) de cobros mismo mes/monto/escuela → cobro duplicado.`);
const porEscuela = {};
for (const s of sas) (porEscuela[s.school_id] ||= []).push(s);
for (const [sid, rows] of Object.entries(porEscuela)) {
  if (rows.filter((r) => r.is_active).length > 1) problemas.push(`La vista school_athletes lo trae ${rows.length} veces en la escuela ${sid.slice(0, 8)}.`);
}
const huerfanos = kids.filter((k) => !k.parent_id);
if (huerfanos.length) problemas.push(`${huerfanos.length} fila(s) de children con parent_id NULL → el acudiente no está enganchado.`);
const sinPagador = pays.filter((p) => !p.parent_id && p.child_id && ['pending', 'overdue'].includes(p.status));
if (sinPagador.length) problemas.push(`${sinPagador.length} cobro(s) de menor sin parent_id → el papá verá "No tienes permiso para pagar".`);

if (!problemas.length) {
  console.log('✅ SIN DUPLICIDAD. Una sola identidad facturable, sin cobros repetidos.');
  console.log('   Si la persona igual no puede entrar, NO es un problema de datos:');
  console.log('   revisar contraseña / correo exacto / navegador (los WebView in-app rompen el reset).');
} else {
  console.log('❌ HALLAZGOS:');
  problemas.forEach((p, i) => console.log(`   ${i + 1}. ${p}`));
  console.log('\n   Orden de fusión (sobrevive la identidad ADULTA, la única que puede entrar y pagar):');
  console.log('   1) pasar team_id/monthly_fee a la inscripción que sobrevive');
  console.log('   2) atar los pagos al sujeto correcto  3) anular el cobro redundante');
  console.log('   4) cancelar la inscripción duplicada  5) unregistered_athletes.linked_profile_id = <perfil>');
}
console.log('\n(READ-ONLY: este script no escribió nada.)');
