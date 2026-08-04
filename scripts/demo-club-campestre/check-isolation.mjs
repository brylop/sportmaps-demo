#!/usr/bin/env node
// ============================================================
// ¿Qué ve REALMENTE cada usuario del club demo?
//
// Inicia sesión de verdad con cada cuenta (grant_type=password + anon key) y
// consulta con SU token, así que lo que se mide es RLS, no la vista del cliente.
// Úsalo antes de la demo para saber qué se puede afirmar en voz alta y qué no.
//
//   node scripts/demo-club-campestre/check-isolation.mjs
//
// Lectura de la salida: si un coordinador de disciplina ve las 8 disciplinas, el
// aislamiento que muestra la app es del CLIENTE (el selector de sede filtra las
// consultas), no de la base. Ver README.md § "Lo que la demo no puede afirmar".
// ============================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CLUB, STAFF, COACHES, PARENTS, ATHLETES, EXTERNAL } from './catalog.mjs';
import { createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PASSWORD = 'Demo2026!';

const env = Object.fromEntries(
    readFileSync(join(ROOT, 'bff', '.env'), 'utf8')
        .split(/\r?\n/).filter((l) => l && !l.startsWith('#') && l.includes('='))
        .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }),
);
const { SUPABASE_URL: URL_, SUPABASE_ANON_KEY: ANON } = env;

// Mismo esquema de ids deterministas que seed.mjs.
const duid = (key) => {
    const b = Buffer.from(createHash('sha1').update('sportmaps::demo::club-campestre::' + key).digest().subarray(0, 16));
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    const h = b.toString('hex');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
const SCHOOL_ID = duid('school');

async function login(email) {
    const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
        method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: PASSWORD }),
    });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, token: j.access_token, err: j.error_description || j.msg || `HTTP ${r.status}` };
}
const asUser = async (token, path) => {
    const r = await fetch(`${URL_}/rest/v1/${path}`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
    const t = await r.text();
    try { return JSON.parse(t); } catch { return t; }
};

const CUENTAS = [
    ...STAFF.map((s) => ({ email: s.email, quien: s.full_name, esperado: s.branch ? `solo ${s.branch}` : 'todo el club' })),
    ...COACHES.map((c) => ({ email: c.email, quien: c.full_name, esperado: 'solo su grupo, sin cartera' })),
    ...PARENTS.map((p) => ({ email: p.email, quien: p.full_name, esperado: 'solo sus hijos' })),
    ...ATHLETES.map((a) => ({ email: a.email, quien: a.full_name, esperado: 'solo lo suyo' })),
    { email: EXTERNAL.email, quien: EXTERNAL.full_name, esperado: 'nada del club' },
];

console.log(`Club: ${CLUB.name} (${SCHOOL_ID})\nQué devuelve la BASE con el token de cada usuario:\n`);
const filas = [];
for (const c of CUENTAS) {
    const s = await login(c.email);
    if (!s.ok) { filas.push({ quien: c.quien, correo: c.email, login: `✗ ${s.err}` }); continue; }
    const [teams, pays, kids, staff] = await Promise.all([
        asUser(s.token, `teams?school_id=eq.${SCHOOL_ID}&select=name&limit=200`),
        asUser(s.token, `payments?school_id=eq.${SCHOOL_ID}&select=id&limit=500`),
        asUser(s.token, `children?school_id=eq.${SCHOOL_ID}&select=id&limit=200`),
        asUser(s.token, `school_staff?school_id=eq.${SCHOOL_ID}&select=id&limit=100`),
    ]);
    const n = (x) => (Array.isArray(x) ? x.length : 'ERR');
    const disciplinas = Array.isArray(teams) ? new Set(teams.map((t) => t.name.split(' — ')[0])).size : 'ERR';
    filas.push({
        quien: c.quien, correo: c.email, login: '✓',
        esperado: c.esperado,
        disciplinas, categorias: n(teams), cobros: n(pays), menores: n(kids), staff: n(staff),
    });
}
console.table(filas);
console.log(
    '\nLectura: "disciplinas" = cuántas de las 8 alcanza a leer en la BD.\n'
    + 'Un coordinador con 8 y un entrenador/atleta con cobros > 0 significan que el\n'
    + 'aislamiento es del cliente, no de RLS. Es un hallazgo conocido del producto\n'
    + '(las policies tratan a cualquier miembro como staff), no un problema del seed.',
);
