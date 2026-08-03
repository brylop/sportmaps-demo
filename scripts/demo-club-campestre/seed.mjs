#!/usr/bin/env node
// ============================================================
// SportMaps — Seed del tenant DEMO "Club Campestre Demo".
//
// Qué hace: crea (o actualiza) un club multideporte de demostración completo:
// 8 disciplinas como sedes, categorías, horarios, staff con alcances distintos,
// familias, cartera con mora realista, asistencia, control de acceso biométrico
// y un torneo abierto. Todo marcado con is_demo cuando la tabla lo soporta.
//
// Uso:
//   node scripts/demo-club-campestre/seed.mjs                 # todos los pasos
//   node scripts/demo-club-campestre/seed.mjs --dry-run       # no escribe nada
//   node scripts/demo-club-campestre/seed.mjs --only=club,staff
//   node scripts/demo-club-campestre/seed.mjs --verify        # solo el checklist
//   node scripts/demo-club-campestre/seed.mjs --today=2026-08-05
//
// Credenciales de todos los usuarios: Demo2026!  (ver README.md)
//
// Diseño (por qué es seguro re-ejecutarlo):
//   1. Los IDs son DETERMINISTAS (duid(): sha1 del key → UUID v4-shaped). Cada
//      corrida hace UPSERT sobre el mismo id, no duplica.
//   2. Las tablas tipo bitácora (payments, attendance_records, access_events)
//      NO se re-escriben: si ya hay filas de este club, el paso se omite. Este
//      script nunca borra nada — el rollback es rollback.sql, y lo corre una
//      persona a mano.
//   3. Se apagan los toggles de school_settings que disparan crons
//      (auto_generate_payments, late_fee_enabled, reminder_enabled) para que
//      ningún job nocturno mueva la cartera sembrada ni mande correos a los
//      buzones falsos @demo.sportmaps.co.
//
// Aislamiento: solo toca el school_id derivado de CLUB.key. No lee ni escribe
// datos de Dynasty, RMGYM ni de ninguna otra escuela.
// ============================================================

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
    CLUB, DISCIPLINAS, STAFF, COACHES, PARENTS, ATHLETES, EXTERNAL, TORNEO,
    FILLER_PARENTS, FILLER_MINORS, FILLER_ADULTS, PAY_MIX, METHOD_MIX, METHODS,
    BANCOS, ADDONS, DEVICES, TARIFAS, ARRENDATARIOS, MOTIVOS_CANCELACION,
} from './catalog.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PASSWORD = 'Demo2026!';

// ─── CLI ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d = null) => {
    const a = argv.find((x) => x.startsWith(`${f}=`));
    return a ? a.slice(f.length + 1) : d;
};
const DRY = has('--dry-run');
const VERIFY_ONLY = has('--verify');
const ONLY = val('--only') ? val('--only').split(',').map((s) => s.trim()) : null;
const TODAY = val('--today') || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

// ─── Entorno (bff/.env) ─────────────────────────────────────────────────────
const env = Object.fromEntries(
    readFileSync(join(ROOT, 'bff', '.env'), 'utf8')
        .split(/\r?\n/)
        .filter((l) => l && !l.startsWith('#') && l.includes('='))
        .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }),
);
const SB_URL = env.SUPABASE_URL;
const SB_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !SB_KEY) {
    console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en bff/.env');
    process.exit(1);
}
const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' };

// ─── Utilidades ─────────────────────────────────────────────────────────────
const C = process.stdout.isTTY
    ? { dim: '\x1b[2m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', bold: '\x1b[1m', off: '\x1b[0m' }
    : { dim: '', red: '', green: '', yellow: '', cyan: '', bold: '', off: '' };
const ok = (m) => console.log(`  ${C.green}✓${C.off} ${m}`);
const warn = (m) => console.log(`  ${C.yellow}!${C.off} ${m}`);
const bad = (m) => console.log(`  ${C.red}✗${C.off} ${m}`);
const info = (m) => console.log(`  ${C.dim}·${C.off} ${m}`);
const head = (m) => console.log(`\n${C.bold}${C.cyan}${m}${C.off}`);

/** UUID determinista a partir de un key legible. Mismo key = misma fila. */
const NS = 'sportmaps::demo::club-campestre::';
function duid(key) {
    const b = Buffer.from(createHash('sha1').update(NS + key).digest().subarray(0, 16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = b.toString('hex');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** PRNG con semilla: el relleno sale igual en cada corrida. */
function seeded(seed) {
    let s = [...String(seed)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const rnd = seeded('club-campestre-demo');
const pick = (arr, r = rnd) => arr[Math.floor(r() * arr.length)];
const between = (a, b, r = rnd) => a + Math.floor(r() * (b - a + 1));

// ─── Fechas ─────────────────────────────────────────────────────────────────
const [TY, TM, TD] = TODAY.split('-').map(Number);
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const shiftMonth = (y, m, delta) => {
    const t = (y * 12 + (m - 1)) + delta;
    return [Math.floor(t / 12), (t % 12) + 1];
};
const addDays = (dateStr, n) => {
    const d = new Date(`${dateStr}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
};
const dow = (dateStr) => new Date(`${dateStr}T12:00:00Z`).getUTCDay();
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
/** Los 4 periodos de cartera: mes actual y los 3 anteriores. */
const PERIODS = [3, 2, 1, 0].map((back) => {
    const [y, m] = shiftMonth(TY, TM, -back);
    return { y, m, back, label: `${MESES[m - 1]} ${y}`, due: iso(y, m, 10) };
});
/** Cumpleaños coherente con una edad, determinista. */
const dobForAge = (age, r = rnd) => iso(TY - age, between(1, 12, r), between(1, 27, r));

// ─── HTTP ───────────────────────────────────────────────────────────────────
let writes = 0;
async function rest(path, { method = 'GET', body, prefer } = {}) {
    const headers = { ...H };
    if (prefer) headers.Prefer = prefer;
    const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
        method, headers, body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) {
        // El `message` de PostgREST (con el nombre de la constraint) va al final
        // del cuerpo: se imprime primero para que el error sea legible.
        let msg = text;
        try { const j = JSON.parse(text); msg = `${j.code || ''} ${j.message || ''} | hint: ${j.hint || '-'} | ${(j.details || '').slice(0, 400)}`; } catch { msg = text.slice(0, 800); }
        throw new Error(`${method} ${path} → ${res.status} ${msg}`);
    }
    try { return text ? JSON.parse(text) : null; } catch { return text; }
}
const get = (path) => rest(path);

/**
 * PostgREST rechaza un lote cuyas filas no tengan EXACTAMENTE las mismas claves
 * ("PGRST102 All object keys must match"). Se completa con null la unión de
 * claves del lote: en estas tablas las columnas que varían de fila a fila
 * (child_id vs user_id vs unregistered_athlete_id, campos de OCR, etc.) son
 * todas nullable, así que el null es el valor correcto, no un borrado.
 */
function sameShape(list) {
    const keys = [...new Set(list.flatMap((r) => Object.keys(r)))];
    return list.map((r) => Object.fromEntries(keys.map((k) => [k, r[k] === undefined ? null : r[k]])));
}

/** UPSERT por columna(s) de conflicto. Trocea para no armar payloads gigantes. */
async function upsert(table, rows, onConflict = 'id') {
    let list = (Array.isArray(rows) ? rows : [rows]).filter(Boolean);
    if (!list.length) return 0;
    list = sameShape(list);
    if (DRY) { info(`[dry] upsert ${table} × ${list.length}`); return list.length; }
    for (let i = 0; i < list.length; i += 200) {
        await rest(`${table}?on_conflict=${onConflict}`, {
            method: 'POST',
            body: list.slice(i, i + 200),
            prefer: 'resolution=merge-duplicates,return=minimal',
        });
    }
    writes += list.length;
    return list.length;
}

/**
 * PATCH de columnas sueltas. Un upsert parcial no sirve para esto: PostgREST
 * arma un INSERT … ON CONFLICT, así que las columnas NOT NULL que no se manden
 * hacen fallar el INSERT aunque la fila ya exista.
 */
async function patch(table, filter, body) {
    if (DRY) { info(`[dry] patch ${table}?${filter} → ${Object.keys(body).join(',')}`); return; }
    await rest(`${table}?${filter}`, { method: 'PATCH', body, prefer: 'return=minimal' });
    writes++;
}

/** Inserta solo si la tabla no tiene ya filas de este club (bitácoras). */
async function insertIfEmpty(table, rows, countPath) {
    const existing = await get(`${countPath}&select=id&limit=1`);
    if (existing.length) {
        warn(`${table}: ya hay filas de este club → paso omitido (no se re-escribe)`);
        return 0;
    }
    const list = sameShape(rows.filter(Boolean));
    if (DRY) { info(`[dry] insert ${table} × ${list.length}`); return list.length; }
    for (let i = 0; i < list.length; i += 200) {
        await rest(table, { method: 'POST', body: list.slice(i, i + 200), prefer: 'return=minimal' });
    }
    writes += list.length;
    return list.length;
}

// ─── Usuarios de auth ───────────────────────────────────────────────────────
/**
 * Garantiza el usuario y devuelve su id.
 * El trigger handle_new_user crea el profile a partir de user_metadata.role.
 * Ojo: NO se manda `school_name` — con school_name el trigger auto-crearía una
 * escuela fantasma por cada usuario administrativo.
 */
async function ensureUser({ email, password = PASSWORD, full_name, role, phone, date_of_birth }) {
    const found = await get(`profiles?select=id&email=eq.${encodeURIComponent(email)}&limit=1`);
    if (found.length) {
        if (!DRY) {
            // Re-set del password: garantiza que el login en vivo funcione aunque
            // el usuario ya existiera de una corrida anterior.
            await fetch(`${SB_URL}/auth/v1/admin/users/${found[0].id}`, {
                method: 'PUT', headers: H, body: JSON.stringify({ password, email_confirm: true }),
            });
        }
        return { id: found[0].id, created: false };
    }
    if (DRY) { info(`[dry] crear usuario ${email} (${role})`); return { id: duid(`user:${email}`), created: true }; }

    const res = await fetch(`${SB_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: H,
        body: JSON.stringify({
            email, password, email_confirm: true,
            user_metadata: { full_name, role, phone, date_of_birth },
        }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.id) { writes++; return { id: json.id, created: true }; }

    // Ya existe en auth pero sin profile (alta a medias de otra corrida).
    const r2 = await fetch(`${SB_URL}/auth/v1/admin/users?page=1&per_page=200&filter=${encodeURIComponent(email)}`, { headers: H });
    const list = await r2.json().catch(() => ({}));
    const hit = (list.users || []).find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return { id: hit.id, created: false };
    throw new Error(`No se pudo crear ni encontrar ${email}: ${JSON.stringify(json).slice(0, 300)}`);
}

// ─── IDs del tenant ─────────────────────────────────────────────────────────
const SCHOOL_ID = duid('school');
// La sede principal NO se puede crear a mano: al insertar la escuela, el trigger
// handle_new_school ya crea una con is_main=true, y el índice
// uq_one_main_branch_per_school solo admite una por escuela. Se adopta esa.
let MAIN_BRANCH = duid('branch:main');
async function resolveMainBranch() {
    const found = await get(`school_branches?school_id=eq.${SCHOOL_ID}&is_main=is.true&select=id&limit=1`);
    if (found.length) MAIN_BRANCH = found[0].id;
    return MAIN_BRANCH;
}
const branchId = (d) => duid(`branch:${d}`);
const offeringId = (d) => duid(`offering:${d}`);
const planMatriculaId = (d) => duid(`plan:matricula:${d}`);
const planMensualId = (d) => duid(`plan:mensual:${d}`);
const teamId = (d, c) => duid(`team:${d}:${c}`);
const facilityId = (d, f) => duid(`facility:${d}:${f}`);
// school_staff tiene UNIQUE (email, school_id) y el trigger que atiende a
// school_members ya crea la ficha del entrenador: no se puede imponer un id
// propio (teams.coach_id apunta a school_staff.id). Se resuelve por correo.
const staffIds = {};
const staffId = (k) => staffIds[k] || duid(`staff:${k}`);
async function resolveStaffIds() {
    const rows = await get(`school_staff?school_id=eq.${SCHOOL_ID}&select=id,email`);
    const byEmail = Object.fromEntries(rows.map((r) => [r.email?.toLowerCase(), r.id]));
    for (const s of [...STAFF, ...COACHES]) {
        const hit = byEmail[s.email.toLowerCase()];
        if (hit) staffIds[s.key] = hit;
    }
    return staffIds;
}
const childId = (k) => duid(`child:${k}`);
const unregId = (k) => duid(`unreg:${k}`);
const enrollId = (k) => duid(`enroll:${k}`);
const deviceId = (k) => duid(`device:${k}`);

const D = Object.fromEntries(DISCIPLINAS.map((d) => [d.key, d]));
const catOf = (dk, ck) => D[dk].categorias.find((c) => c.key === ck);

// Registro en memoria de las personas resueltas (lo llenan los pasos 2 y 4).
const people = { staff: {}, coaches: {}, parents: {}, athletes: {}, external: null };
/** profile_id del entrenador a cargo de una categoría (null si no tiene). */
const coachProfileFor = (dk, ck) =>
    Object.values(people.coaches).find((c) => c.teams.some((t) => t.disciplina === dk && t.cat === ck))?.profileId || null;
/** Todo lo inscribible, para los pasos de cartera/asistencia/acceso. */
const roster = [];   // { kind:'child'|'profile'|'unreg', id, name, parentId?, disciplina, cat, pay, method, zkPin }

// ============================================================
// PASO 1 — Club, sedes, instalaciones, plan y addons
// ============================================================
async function stepClub() {
    head('1 · Club, sedes e instalaciones');

    await upsert('schools', {
        id: SCHOOL_ID,
        name: CLUB.name,
        slug: CLUB.slug,
        owner_id: null,                    // se setea en el paso 2 (Ricardo)
        school_type: CLUB.school_type,
        business_model: CLUB.business_model,
        payment_mode: CLUB.payment_mode,
        city: CLUB.city,
        address: CLUB.address,
        phone: CLUB.phone,
        email: CLUB.email,
        description: CLUB.description,
        // logo_url NO va acá: el trigger branding_must_go_through_rpc lo bloquea.
        // Se resuelve en el paso "branding". cover_image_url sí es libre.
        cover_image_url: CLUB.cover_image_url,
        sports: DISCIPLINAS.map((d) => d.sport),
        amenities: ['Parqueadero', 'Cafetería', 'Vestieres', 'Enfermería', 'Zona social'],
        is_demo: true,
        verified: true,
        onboarding_status: 'completed',
        onboarding_step: 99,
        // La constraint valid_branding_settings exige las 3 keys mínimas.
        branding_settings: {
            primary_color: '#1f6f3f',       // verde campestre
            secondary_color: '#c9a227',     // dorado
            show_sportmaps_watermark: true,
        },
        accepts_reservations: true,
    });
    ok(`schools · ${CLUB.name} (${SCHOOL_ID})`);

    // Toggles de crons APAGADOS a propósito: ningún job nocturno debe mover la
    // cartera sembrada ni mandar recordatorios a los buzones falsos.
    await upsert('school_settings', {
        school_id: SCHOOL_ID,
        auto_generate_payments: false,
        late_fee_enabled: false,
        reminder_enabled: false,
        auto_glosa_enabled: false,
        auto_approve_enabled: false,
        payment_cutoff_day: 10,
        payment_grace_days: 5,
        allow_multiple_enrollments: true,   // el club es multideporte por diseño
        billing_cycle_type: 'fixed_calendar',
        public_profile_enabled: true,
        show_programs: true,
        show_plans: true,
        show_facilities: true,
        require_payment_proof: true,
        wompi_enabled: true,
        payment_setup_completed: true,   // lo exige chk_wompi_requires_connect
        online_fee_pct: 3,
        fee_payer: 'parent',
        bank_name: 'Bancolombia',
        bank_account_type: 'ahorros',    // el CHECK exige minúsculas
        bank_account_number: '000-000000-00 (demo)',
        bank_titular_name: CLUB.name,
        bank_titular_id: CLUB.nit,
        reports_enabled: true,
        active_modules: [],
    }, 'school_id');
    ok('school_settings · crons de cobro/mora/recordatorio APAGADOS');

    // Sobre la suscripción que ya creó el trigger (free/starter/trialing).
    await upsert('school_subscriptions', {
        school_id: SCHOOL_ID,
        plan_code: 'enterprise',
        tier: 'enterprise',
        status: 'active',
        billing_cycle: 'monthly',
        current_period_start: iso(TY, TM, 1),
        current_period_end: iso(...shiftMonth(TY, TM, 1), 1),
        metadata: { seeded_by: 'demo-club-campestre' },
    }, 'school_id');
    await upsert('school_addons', ADDONS.map((k) => ({
        school_id: SCHOOL_ID, addon_key: k, enabled: true,
        monthly_price_cents: 0, metadata: { demo: true },
    })), 'school_id,addon_key');
    ok(`plan enterprise + ${ADDONS.length} addons habilitados`);

    // Sede social (la que creó el trigger, renombrada) + una sede por disciplina.
    await resolveMainBranch();
    await upsert('school_branches', [
        {
            id: MAIN_BRANCH, school_id: SCHOOL_ID, name: 'Club Campestre — Sede Social',
            is_main: true, status: 'active', city: CLUB.city, address: CLUB.address,
            phone: CLUB.phone, capacity: 800,
        },
        ...DISCIPLINAS.map((d, i) => ({
            id: branchId(d.key), school_id: SCHOOL_ID, name: `Unidad Deportiva — ${d.name}`,
            is_main: false, status: 'active', city: CLUB.city, address: CLUB.address,
            phone: CLUB.phone, capacity: 60 + i * 10,
        })),
    ]);
    ok(`school_branches · 1 sede social + ${DISCIPLINAS.length} unidades deportivas`);

    const facilities = DISCIPLINAS.flatMap((d) => d.facilities.map((f) => {
        const t = TARIFAS[f.key] || { hora: 0, rental: false };
        return {
            id: facilityId(d.key, f.key), school_id: SCHOOL_ID, branch_id: branchId(d.key),
            name: f.name, type: f.type, capacity: f.capacity, status: 'available',
            description: `${d.name} — ${f.name}`, booking_enabled: true,
            hourly_rate: t.hora,
            rental_enabled: t.rental,
            rental_rate: t.rental ? Math.round(t.hora * 1.4) : null,   // a terceros sale más caro
            rental_notes: t.rental ? 'Alquiler a terceros sujeto a disponibilidad y depósito del 30%.' : null,
            min_deposit_pct: 30,
            min_booking_advance_hours: 12,
            min_cancellation_hours: 24,
        };
    }));
    await upsert('facilities', facilities);
    ok(`facilities · ${facilities.length} instalaciones`);
}

// ============================================================
// PASO 2 — Staff: gerencia, finanzas, coordinadores, entrenadores, portería
// ============================================================
async function stepStaff() {
    head('2 · Staff y alcances');

    // El rol se impone acá, no se deja al trigger de alta: `ensureUser` no toca a
    // un usuario que ya existe, así que sin esto un cambio de rol en el catálogo
    // no se aplicaría nunca al re-correr. `profiles.role` es el enum legacy y
    // `role_id` apunta al catálogo `public.roles` — hay que mover los dos.
    const ROL = {
        school: { legacy: 'school', catalogo: 'school_admin' },
        school_admin: { legacy: 'school', catalogo: 'school_admin' },
        coach: { legacy: 'coach', catalogo: 'coach' },
        reporter: { legacy: 'reporter', catalogo: 'reporter' },
    };
    const catalogo = Object.fromEntries(
        (await get('roles?select=id,name')).map((r) => [r.name, r.id]),
    );

    const members = [];
    const profilePatches = [];

    for (const s of [...STAFF, ...COACHES]) {
        const u = await ensureUser({
            email: s.email, full_name: s.full_name, role: s.signup_role, phone: s.phone,
        });
        const bucket = s.member_role === 'coach' ? people.coaches : people.staff;
        bucket[s.key] = { ...s, profileId: u.id };
        ok(`${u.created ? 'creado ' : 'existía'} · ${s.full_name} <${s.email}> → ${s.member_role}${s.branch ? ` @${D[s.branch].name}` : ' (global)'}`);

        const r = ROL[s.signup_role] || ROL.school_admin;
        profilePatches.push({
            id: u.id, full_name: s.full_name, phone: s.phone, is_demo: true,
            role: r.legacy, role_id: catalogo[r.catalogo] ?? null,
            onboarding_completed: true, needs_role_selection: false,
        });
        members.push({
            id: duid(`member:${s.key}`), school_id: SCHOOL_ID, profile_id: u.id,
            role: s.member_role, status: 'active',
            branch_id: s.branch ? branchId(s.branch) : null,
        });
    }

    await upsert('profiles', profilePatches);
    await upsert('school_members', members);
    ok(`school_members · ${members.length} filas (3 coordinadores scoped por branch_id)`);

    // El owner del club es Ricardo.
    const owner = people.staff.gerencia.profileId;
    await patch('schools', `id=eq.${SCHOOL_ID}`, { owner_id: owner });
    ok('schools.owner_id → Ricardo Mendoza');

    // Los entrenadores necesitan fila en school_staff: teams.coach_id y
    // attendance_sessions.coach_id apuntan a school_staff.id, no a profiles.id.
    const staffRows = Object.values(people.coaches).map((c) => ({
        school_id: SCHOOL_ID, branch_id: branchId(c.branch),
        full_name: c.full_name, email: c.email, phone: c.phone,
        specialty: c.specialty, status: 'active', coach_auth_id: c.profileId,
    }));
    // Los coordinadores también aparecen en el directorio de staff.
    // Excepción: la portería es un PUESTO, no una persona. La vista pública
    // `public_staff` no distingue cargo administrativo de cuerpo técnico, así que
    // si queda 'active' se muestra como "entrenador" en el perfil público del
    // club. Se deja inactiva: sus permisos vienen de school_members, no de acá.
    staffRows.push(...Object.values(people.staff).map((s) => ({
        school_id: SCHOOL_ID,
        branch_id: s.branch ? branchId(s.branch) : MAIN_BRANCH,
        full_name: s.full_name, email: s.email, phone: s.phone,
        specialty: s.cargo,
        status: s.key === 'porteria' ? 'inactive' : 'active',
        coach_auth_id: s.profileId,
    })));
    await upsert('school_staff', staffRows, 'email,school_id');
    await resolveStaffIds();
    ok(`school_staff · ${staffRows.length} fichas (ids resueltos: ${Object.keys(staffIds).length})`);
}

// ============================================================
// PASO 2b — Logo y colores, por la vía sancionada
//
// `schools.logo_url` y `branding_settings` están protegidos por el trigger
// `branding_must_go_through_rpc`: solo los cambia `update_school_branding`, que
// exige (a) `auth.uid()` de un admin activo de la escuela, (b) tier Pro+ y
// (c) que el logo viva en el bucket `school-assets` bajo `logos/<school_id>/`
// (anti-SSRF: una URL de Unsplash se rechaza). Así que acá se sube la imagen al
// bucket y se llama la RPC autenticado como Ricardo — el mismo camino que
// recorrería la escuela desde la UI.
// ============================================================
async function stepBranding() {
    head('2b · Logo y colores del club');

    const objectPath = `logos/${SCHOOL_ID}/logo.jpg`;
    const publicUrl = `${SB_URL}/storage/v1/object/public/school-assets/${objectPath}`;

    if (DRY) { info(`[dry] subir logo → ${objectPath} y llamar update_school_branding`); return; }

    // 1. Subir la imagen al bucket (service key; x-upsert para que re-correr no falle).
    try {
        const bytes = Buffer.from(await (await fetch(`${CLUB.logo_source}&h=512`)).arrayBuffer());
        const up = await fetch(`${SB_URL}/storage/v1/object/school-assets/${objectPath}`, {
            method: 'POST',
            headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
            body: bytes,
        });
        if (!up.ok) { warn(`no se pudo subir el logo (${up.status}): ${(await up.text()).slice(0, 160)}`); return; }
        ok(`logo subido a school-assets (${Math.round(bytes.length / 1024)} KB)`);
    } catch (e) {
        warn(`no se pudo bajar/subir el logo: ${e.message}`);
        return;
    }

    // 2. Llamar la RPC como el owner (la RPC necesita auth.uid(), no service key).
    const auth = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: STAFF[0].email, password: PASSWORD }),
    });
    const session = await auth.json().catch(() => ({}));
    if (!session.access_token) { warn(`no se pudo autenticar a ${STAFF[0].email} para la RPC de branding`); return; }

    const res = await fetch(`${SB_URL}/rest/v1/rpc/update_school_branding`, {
        method: 'POST',
        headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            p_school_id: SCHOOL_ID,
            p_logo_url: publicUrl,
            p_primary_color: CLUB.branding.primary_color,
            p_secondary_color: CLUB.branding.secondary_color,
            p_show_watermark: true,
        }),
    });
    const out = await res.json().catch(() => ({}));
    if (out?.ok) {
        writes++;
        ok(`branding aplicado vía RPC · ${CLUB.branding.primary_color} / ${CLUB.branding.secondary_color}`);
    } else {
        warn(`update_school_branding respondió: ${JSON.stringify(out).slice(0, 200)}`);
    }
}

// ============================================================
// PASO 3 — Oferta: disciplinas, tarifas y categorías
// ============================================================
async function stepCatalog() {
    head('3 · Disciplinas, tarifas y categorías');

    const offerings = [];
    const plans = [];
    const teams = [];

    for (const d of DISCIPLINAS) {
        offerings.push({
            id: offeringId(d.key), school_id: SCHOOL_ID, branch_id: branchId(d.key),
            name: d.name, sport: d.sport, offering_type: 'membership', is_active: true,
            description: `Unidad deportiva de ${d.name} — Club Campestre Demo`,
            sort_order: DISCIPLINAS.indexOf(d),
            metadata: { disciplina: d.key, matricula: d.matricula, mensualidad: d.mensualidad },
        });

        // Horarios de la disciplina → metadata.schedule del plan de mensualidad
        // (formato {day,time} que lee SchedulePicker/MyEnrollmentsPage).
        const slots = d.horarios.flatMap((h) => h.days.map((day) => ({ day, time: h.start })));

        if (d.matricula > 0) {
            plans.push({
                id: planMatriculaId(d.key), offering_id: offeringId(d.key), school_id: SCHOOL_ID,
                name: `Matrícula ${d.name}`, price: d.matricula, duration_days: 365,
                auto_renew: false, is_active: true, sort_order: 0, currency: 'COP',
                description: 'Pago único anual de matrícula.',
                metadata: { tipo: 'matricula' },
            });
        }
        plans.push({
            id: planMensualId(d.key), offering_id: offeringId(d.key), school_id: SCHOOL_ID,
            name: `Mensualidad ${d.name}`, price: d.mensualidad, duration_days: 30,
            auto_renew: true, is_active: true, sort_order: 1, currency: 'COP', max_students: 120,
            description: `Cuota mensual de ${d.name}.`,
            metadata: { tipo: 'mensualidad', schedule_type: slots.length ? 'specific' : 'general', schedule: slots },
        });

        for (const c of d.categorias) {
            const hor = d.horarios.filter((h) => h.cat === c.key);
            const fac = hor[0] ? facilityId(d.key, hor[0].facility) : facilityId(d.key, d.facilities[0].key);
            teams.push({
                id: teamId(d.key, c.key), school_id: SCHOOL_ID, branch_id: branchId(d.key),
                name: `${d.name} — ${c.name}`, sport: d.sport, level: c.name,
                age_min: c.age[0], age_max: c.age[1],
                age_group: c.age[1] <= 17 ? `${c.age[0]}-${c.age[1]} años` : 'Adultos',
                price_monthly: d.mensualidad, max_students: 30, status: 'active', active: true,
                is_demo: true, season: `${TY}`, facility_id: fac, image_url: d.img,
                location: hor.length
                    ? hor.map((h) => `${h.days.map((x) => ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][x]).join('/')} ${h.start}-${h.end} · ${d.facilities.find((f) => f.key === h.facility).name}`).join(' | ')
                    : d.facilities[0].name,
                description: `Categoría ${c.name} de ${d.name}.`,
                schedule: hor.flatMap((h) => h.days.map((day) => ({ day, time: h.start, end: h.end }))),
            });
        }
    }

    await upsert('offerings', offerings);
    await upsert('offering_plans', plans);
    await upsert('teams', teams);
    ok(`offerings ${offerings.length} · offering_plans ${plans.length} · teams (categorías) ${teams.length}`);

    // Entrenador ↔ su grupo (teams.coach_id + team_coaches + offering_coaches).
    const teamPatch = [];
    const tCoaches = [];
    const oCoaches = [];
    for (const c of Object.values(people.coaches)) {
        for (const t of c.teams) {
            teamPatch.push({ id: teamId(t.disciplina, t.cat), coach_id: staffId(c.key), school_id: SCHOOL_ID, name: `${D[t.disciplina].name} — ${catOf(t.disciplina, t.cat).name}`, sport: D[t.disciplina].sport });
            tCoaches.push({ id: duid(`tcoach:${c.key}:${t.disciplina}:${t.cat}`), team_id: teamId(t.disciplina, t.cat), coach_id: staffId(c.key), school_id: SCHOOL_ID });
            oCoaches.push({ id: duid(`ocoach:${c.key}:${t.disciplina}`), offering_id: offeringId(t.disciplina), coach_id: staffId(c.key), school_id: SCHOOL_ID });
        }
    }
    await upsert('teams', teamPatch);
    await upsert('team_coaches', tCoaches);
    await upsert('offering_coaches', oCoaches);
    ok(`entrenadores asignados a ${tCoaches.length} grupo(s)`);
}

// ============================================================
// PASO 4 — Personas: familias, deportistas, relleno e inscripciones
// ============================================================
async function stepPeople() {
    head('4 · Familias, deportistas e inscripciones');

    const members = [];
    const profilePatches = [];
    const children = [];
    const unregs = [];
    const enrollments = [];
    const teamMembers = [];

    const enroll = (key, extra) => {
        enrollments.push({
            id: enrollId(key), school_id: SCHOOL_ID, status: 'active',
            start_date: iso(...shiftMonth(TY, TM, -3), 1),
            sessions_used: 0, secondary_sessions_used: 0, ...extra,
        });
    };

    // ── 4a. Padre estrella + sus 2 hijos ────────────────────────────────────
    for (const p of PARENTS) {
        const u = await ensureUser({ email: p.email, full_name: p.full_name, role: 'parent', phone: p.phone });
        people.parents[p.key] = { ...p, profileId: u.id };
        profilePatches.push({ id: u.id, full_name: p.full_name, phone: p.phone, is_demo: true, onboarding_completed: true, needs_role_selection: false });
        members.push({ id: duid(`member:${p.key}`), school_id: SCHOOL_ID, profile_id: u.id, role: 'parent', status: 'active', branch_id: null });
        ok(`${u.created ? 'creado ' : 'existía'} · ${p.full_name} (padre) — ${p.children.length} hijos`);

        for (const ch of p.children) {
            const first = ch.enrollments[0];
            children.push({
                id: childId(ch.key), parent_id: u.id, school_id: SCHOOL_ID,
                full_name: ch.full_name, date_of_birth: dobForAge(ch.age),
                gender: ch.gender, is_active: true, is_demo: true,
                branch_id: branchId(first.disciplina), team_id: teamId(first.disciplina, first.cat),
                monthly_fee: D[first.disciplina].mensualidad,
                emergency_contact: `${p.full_name} — ${p.phone}`,
            });
            for (const e of ch.enrollments) {
                enroll(`${ch.key}:${e.disciplina}:${e.cat}`, {
                    child_id: childId(ch.key), team_id: teamId(e.disciplina, e.cat),
                    offering_id: offeringId(e.disciplina), offering_plan_id: planMensualId(e.disciplina),
                    monthly_fee: D[e.disciplina].mensualidad,
                });
                teamMembers.push({
                    id: duid(`tm:${ch.key}:${e.disciplina}:${e.cat}`), team_id: teamId(e.disciplina, e.cat),
                    player_name: ch.full_name, position: catOf(e.disciplina, e.cat).name,
                    parent_contact: `${p.full_name} — ${p.phone}`,
                });
                roster.push({
                    kind: 'child', id: childId(ch.key), name: ch.full_name, parentId: u.id,
                    disciplina: e.disciplina, cat: e.cat, pay: e.pay, method: e.method, zkPin: null,
                });
                info(`   ${ch.full_name} → ${D[e.disciplina].name} / ${catOf(e.disciplina, e.cat).name} (${e.pay})`);
            }
        }
    }

    // ── 4b. Deportistas adultos con cuenta ──────────────────────────────────
    for (const a of ATHLETES) {
        const u = await ensureUser({ email: a.email, full_name: a.full_name, role: 'athlete', phone: a.phone, date_of_birth: dobForAge(a.age) });
        people.athletes[a.key] = { ...a, profileId: u.id };
        profilePatches.push({
            id: u.id, full_name: a.full_name, phone: a.phone, is_demo: true,
            date_of_birth: dobForAge(a.age), gender: a.gender === 'F' ? 'femenino' : 'masculino',
            onboarding_completed: true, needs_role_selection: false,
        });
        members.push({ id: duid(`member:${a.key}`), school_id: SCHOOL_ID, profile_id: u.id, role: 'athlete', status: 'active', branch_id: branchId(a.enrollments[0].disciplina) });
        for (const e of a.enrollments) {
            enroll(`${a.key}:${e.disciplina}:${e.cat}`, {
                user_id: u.id, team_id: teamId(e.disciplina, e.cat),
                offering_id: offeringId(e.disciplina), offering_plan_id: planMensualId(e.disciplina),
                monthly_fee: D[e.disciplina].mensualidad,
            });
            teamMembers.push({
                id: duid(`tm:${a.key}:${e.disciplina}:${e.cat}`), team_id: teamId(e.disciplina, e.cat),
                player_name: a.full_name, position: catOf(e.disciplina, e.cat).name,
                parent_contact: `${a.full_name} — ${a.phone}`, profile_id: u.id,
            });
            roster.push({
                kind: 'profile', id: u.id, name: a.full_name, parentId: u.id,
                disciplina: e.disciplina, cat: e.cat, pay: e.pay, method: e.method, zkPin: a.zk_pin,
            });
        }
        ok(`${u.created ? 'creado ' : 'existía'} · ${a.full_name} (atleta) — ${a.enrollments.map((e) => D[e.disciplina].name).join(' + ')} [${a.enrollments[0].pay}]`);
    }

    // ── 4c. No socia (solo torneo) ──────────────────────────────────────────
    const ex = await ensureUser({ email: EXTERNAL.email, full_name: EXTERNAL.full_name, role: 'athlete', phone: EXTERNAL.phone, date_of_birth: dobForAge(EXTERNAL.age) });
    people.external = { ...EXTERNAL, profileId: ex.id };
    profilePatches.push({ id: ex.id, full_name: EXTERNAL.full_name, phone: EXTERNAL.phone, is_demo: true, onboarding_completed: true, needs_role_selection: false });
    ok(`${ex.created ? 'creada ' : 'existía'} · ${EXTERNAL.full_name} (externa, sin membresía)`);

    // ── 4d. Padres de relleno ───────────────────────────────────────────────
    const fillerParentIds = [];
    for (const fp of FILLER_PARENTS) {
        const u = await ensureUser({ email: fp.email, full_name: fp.full_name, role: 'parent', phone: fp.phone });
        fillerParentIds.push({ id: u.id, ...fp });
        profilePatches.push({ id: u.id, full_name: fp.full_name, phone: fp.phone, is_demo: true, onboarding_completed: true, needs_role_selection: false });
        members.push({ id: duid(`member:${fp.key}`), school_id: SCHOOL_ID, profile_id: u.id, role: 'parent', status: 'active', branch_id: null });
    }
    ok(`${FILLER_PARENTS.length} familias de relleno`);

    // ── 4e. Relleno repartido por categoría según `fill` ────────────────────
    const payBuckets = (() => {
        // Reparto determinista 80/15/5 sobre el total de cupos de relleno.
        const total = DISCIPLINAS.reduce((a, d) => a + d.categorias.reduce((b, c) => b + (c.fill || 0), 0), 0);
        const n1 = Math.round(total * PAY_MIX.mora_1);
        const n2 = Math.max(1, Math.round(total * PAY_MIX.mora_2));
        const arr = [...Array(total - n1 - n2).fill('al_dia'), ...Array(n1).fill('mora_1'), ...Array(n2).fill('mora_2')];
        // Shuffle determinista para que la mora no quede toda en la misma disciplina.
        for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
        return arr;
    })();

    let minorIdx = 0, adultIdx = 0, bucketIdx = 0, zkPin = 2000;
    for (const d of DISCIPLINAS) {
        for (const c of d.categorias) {
            for (let k = 0; k < (c.fill || 0); k++) {
                const pay = payBuckets[bucketIdx++] || 'al_dia';
                const age = between(c.age[0], Math.min(c.age[1], c.adult ? 48 : c.age[1]));
                if (c.adult) {
                    const name = FILLER_ADULTS[adultIdx++ % FILLER_ADULTS.length];
                    const key = `${d.key}:${c.key}:${k}:${name}`;
                    unregs.push({
                        id: unregId(key), school_id: SCHOOL_ID, branch_id: branchId(d.key),
                        full_name: name, date_of_birth: dobForAge(age), is_active: true,
                        doc_type: 'CC', doc_number: `10${between(10000000, 99999999)}`,
                        email: null, phone: `+57 3${between(10, 25)} ${between(1000000, 9999999)}`,
                    });
                    enroll(`unreg:${key}`, {
                        unregistered_athlete_id: unregId(key), team_id: teamId(d.key, c.key),
                        offering_id: offeringId(d.key), offering_plan_id: planMensualId(d.key),
                        monthly_fee: d.mensualidad,
                    });
                    roster.push({ kind: 'unreg', id: unregId(key), name, disciplina: d.key, cat: c.key, pay, method: null, zkPin: zkPin++ });
                } else {
                    const name = FILLER_MINORS[minorIdx++ % FILLER_MINORS.length];
                    const parent = fillerParentIds[minorIdx % fillerParentIds.length];
                    const key = `${d.key}:${c.key}:${k}:${name}`;
                    children.push({
                        id: childId(key), parent_id: parent.id, school_id: SCHOOL_ID,
                        full_name: name, date_of_birth: dobForAge(age), is_active: true, is_demo: true,
                        branch_id: branchId(d.key), team_id: teamId(d.key, c.key),
                        monthly_fee: d.mensualidad, emergency_contact: `${parent.full_name} — ${parent.phone}`,
                    });
                    enroll(`child:${key}`, {
                        child_id: childId(key), team_id: teamId(d.key, c.key),
                        offering_id: offeringId(d.key), offering_plan_id: planMensualId(d.key),
                        monthly_fee: d.mensualidad,
                    });
                    teamMembers.push({
                        id: duid(`tm:${key}`), team_id: teamId(d.key, c.key), player_name: name,
                        position: c.name, parent_contact: `${parent.full_name} — ${parent.phone}`,
                    });
                    roster.push({ kind: 'child', id: childId(key), name, parentId: parent.id, disciplina: d.key, cat: c.key, pay, method: null, zkPin: null });
                }
            }
        }
    }

    await upsert('profiles', profilePatches);
    await upsert('school_members', members);
    await upsert('children', children);
    await upsert('unregistered_athletes', unregs);
    await upsert('enrollments', enrollments);
    await upsert('team_members', teamMembers);

    // student_count / current_students por categoría (los listados los muestran).
    const counts = {};
    for (const r of roster) counts[teamId(r.disciplina, r.cat)] = (counts[teamId(r.disciplina, r.cat)] || 0) + 1;
    await upsert('teams', Object.entries(counts).map(([id, n]) => {
        const t = roster.find((r) => teamId(r.disciplina, r.cat) === id);
        return {
            id, school_id: SCHOOL_ID, student_count: n, current_students: n,
            name: `${D[t.disciplina].name} — ${catOf(t.disciplina, t.cat).name}`, sport: D[t.disciplina].sport,
        };
    }));

    const mix = roster.reduce((a, r) => { a[r.pay] = (a[r.pay] || 0) + 1; return a; }, {});
    ok(`children ${children.length} · adultos sin cuenta ${unregs.length} · inscripciones ${enrollments.length}`);
    ok(`cartera objetivo → ${JSON.stringify(mix)}`);

    // Token de pago recurrente de Valentina (autopay).
    const val = people.athletes.vcruz;
    if (val?.autopay) {
        await upsert('payment_tokens', {
            id: duid('token:vcruz'), user_id: val.profileId, payment_method_type: 'card',
            last_four: '4242', brand: 'VISA', holder_name: val.full_name,
            is_default: true, is_active: true, payment_provider: 'wompi',
            expires_at: iso(TY + 2, 12, 31),
        });
        warn('payment_tokens · token DEMO de Valentina (Wompi no soporta autopay real todavía)');
    }
}

// ============================================================
// PASO 5 — Cartera: matrícula, cuota social y 4 meses de mensualidades
//
// INVARIANTE DE LA BASE (la más importante de este script):
//   Existen tres índices únicos parciales — uniq_payment_active_period_per_
//   child / _adult / _unreg — que admiten UN SOLO cobro activo por atleta y
//   periodo. Y un trigger NO VERSIONADO rellena period_year/period_month desde
//   due_date cuando llegan en NULL, así que dejar el periodo vacío NO evade el
//   índice: dos cobros del mismo atleta con due_date del mismo mes chocan.
//   (Verificado contra la base el 2026-08-03 con una fila sonda.)
//
// Cómo se modela entonces un atleta multideporte:
//   · Menor con varias disciplinas (Tomás): el cobro de su disciplina principal
//     va con child_id; los de las disciplinas secundarias van SOLO con
//     parent_id (child_id NULL) — ningún índice les aplica y el padre igual los
//     ve y los paga, porque MyPaymentsPage consulta
//     `parent_id.eq.me OR child_id.in.(mis hijos)`. Así se conservan estados de
//     pago INDEPENDIENTES por disciplina, que es el caso estrella de la demo.
//   · Adulto con cuenta (Valentina, Daniel): un ÚNICO cobro mensual que suma
//     sus disciplinas + la cuota social, con el detalle en el concepto. Es lo
//     que la plataforma sabe representar para un adulto self-pay.
//   · Matrícula anual: un solo cobro por atleta (suma de las disciplinas que
//     cobran matrícula) fechado 3 meses antes del periodo más antiguo, para que
//     no compita por el mes de ninguna mensualidad.
// ============================================================
async function stepPayments() {
    head('5 · Cartera (matrícula, cuota social y mensualidades)');

    const pays = [];
    const pickMethod = () => {
        const r = rnd();
        let acc = 0;
        for (const m of METHOD_MIX) { acc += m.weight; if (r <= acc) return m.key; }
        return 'wompi_card';
    };

    /** Estado de cada periodo (del más antiguo al mes actual) según la mora. */
    const planFor = (pay) => ({
        al_dia: ['paid', 'paid', 'paid', rnd() < 0.55 ? 'paid' : 'pending'],
        mora_1: ['paid', 'paid', 'overdue', 'pending'],
        mora_2: ['paid', 'paid', 'overdue', 'overdue'],
    }[pay] || ['paid', 'paid', 'paid', 'paid']);

    const row = (key, { concept, amount, dueDate, period, status, methodKey, subject, teamKey, branchKey, planKey, type = 'subscription' }) => {
        const m = METHODS[methodKey] || METHODS.wompi_card;
        const [py, pm] = [Number(dueDate.slice(0, 4)), Number(dueDate.slice(5, 7))];
        const payDay = between(2, 9);
        const r = {
            id: duid(`payment:${key}`), school_id: SCHOOL_ID,
            branch_id: branchKey ? branchId(branchKey) : MAIN_BRANCH,
            team_id: teamKey || null,
            offering_plan_id: planKey || null,
            concept, amount, status,
            due_date: dueDate,
            // Explícito y coherente con due_date: si se dejan en NULL el trigger
            // los deriva igual, mejor que quede a la vista.
            period_year: py, period_month: pm,
            payment_type: type,
            created_at: `${iso(py, pm, 1)}T09:00:00-05:00`,
            requires_review: false,
            ...subject,
        };
        if (status === 'paid') {
            Object.assign(r, {
                payment_date: iso(py, pm, payDay),
                amount_paid: amount,
                payment_method: m.payment_method,
                payment_channel: m.payment_channel,
                payment_provider: m.payment_provider,
                receipt_number: `DEMO-${String(py).slice(2)}${String(pm).padStart(2, '0')}-${duid(key).slice(0, 6).toUpperCase()}`,
            });
            if (m.payment_channel === 'online') {
                r.provider_reference = `demo-${duid(key).slice(0, 12)}`;
                r.provider_transaction_id = `demo-tx-${duid(key).slice(0, 10)}`;
            }
            if (m.ocr) {
                // Comprobante de transferencia "leído" por OCR, para la demo de
                // conciliación bancaria.
                Object.assign(r, {
                    ocr_amount: amount, ocr_currency: 'COP', ocr_bank: pick(BANCOS),
                    ocr_date: iso(py, pm, payDay),
                    ocr_reference: `${between(100000000, 999999999)}`,
                    ocr_provider: 'demo-seed', ocr_destination_name: CLUB.name,
                    // El CHECK del semáforo de comprobantes usa verde/amarillo/rojo.
                    receipt_verdict: 'verde', reconciliation_status: 'confirmado',
                });
            }
        }
        pays.push(r);
        return r;
    };

    // ── 5a. Agrupar el roster por ATLETA (un atleta puede tener 2+ disciplinas)
    const groups = new Map();
    for (const r of roster) {
        const k = `${r.kind}:${r.id}`;
        if (!groups.has(k)) groups.set(k, { kind: r.kind, id: r.id, parentId: r.parentId, name: r.name, items: [] });
        groups.get(k).items.push(r);
    }

    // Cuota social de los adultos con cuenta: se fusiona en su cobro mensual.
    const cuotaDe = {};
    for (const a of Object.values(people.athletes)) cuotaDe[`profile:${a.profileId}`] = a.cuota_social;

    for (const g of groups.values()) {
        const principal = g.items[0];
        const cuota = cuotaDe[`${g.kind}:${g.id}`] ? CLUB.cuota_social : 0;

        if (g.kind === 'profile') {
            // Adulto self-pay: UN cobro mensual que suma todo lo suyo.
            const partes = g.items.map((it) => `${D[it.disciplina].name} ${catOf(it.disciplina, it.cat).name}`);
            if (cuota) partes.push('Cuota social');
            const monto = g.items.reduce((a, it) => a + D[it.disciplina].mensualidad, 0) + cuota;
            const states = planFor(principal.pay);
            PERIODS.forEach((period, i) => {
                row(`grp:${g.kind}:${g.id}:${period.y}-${period.m}`, {
                    concept: `Mensualidad ${period.label} — ${partes.join(' + ')}`,
                    amount: monto, dueDate: period.due, status: states[i],
                    methodKey: principal.method || pickMethod(),
                    subject: { user_id: g.id, parent_id: g.id },
                    teamKey: teamId(principal.disciplina, principal.cat),
                    branchKey: principal.disciplina,
                    planKey: planMensualId(principal.disciplina),
                });
            });
        } else {
            // Menor o atleta sin cuenta: un cobro por disciplina. El principal
            // lleva la identidad del atleta; los secundarios van al acudiente.
            g.items.forEach((it, idx) => {
                const d = D[it.disciplina];
                const cat = catOf(it.disciplina, it.cat);
                const states = planFor(it.pay);
                const esPrincipal = idx === 0;
                const subject = esPrincipal
                    ? (g.kind === 'child' ? { child_id: g.id, parent_id: g.parentId } : { unregistered_athlete_id: g.id })
                    : { parent_id: g.parentId };   // secundaria: fuera de los índices por atleta
                PERIODS.forEach((period, i) => {
                    row(`grp:${g.kind}:${g.id}:${it.disciplina}:${it.cat}:${period.y}-${period.m}`, {
                        concept: esPrincipal
                            ? `Mensualidad ${period.label} — ${d.name} ${cat.name}`
                            : `Mensualidad ${period.label} — ${d.name} ${cat.name} (${g.name})`,
                        amount: d.mensualidad, dueDate: period.due, status: states[i],
                        methodKey: it.method || pickMethod(),
                        subject,
                        teamKey: teamId(it.disciplina, it.cat),
                        branchKey: it.disciplina,
                        planKey: planMensualId(it.disciplina),
                    });
                });
            });
        }

        // ── Matrícula anual: un solo cobro por atleta, 3 meses antes del
        // periodo más antiguo, para no competir con ninguna mensualidad.
        const matricula = g.items.reduce((a, it) => a + D[it.disciplina].matricula, 0);
        if (matricula > 0) {
            const [my, mm] = shiftMonth(PERIODS[0].y, PERIODS[0].m, -3);
            const partes = g.items.filter((it) => D[it.disciplina].matricula > 0).map((it) => D[it.disciplina].name);
            row(`matricula:${g.kind}:${g.id}`, {
                concept: `Matrícula ${my} — ${partes.join(' + ')}${g.kind === 'child' ? '' : ''}`,
                amount: matricula, dueDate: iso(my, mm, 10), status: 'paid',
                methodKey: 'transfer_ocr', type: 'one_time',
                subject: g.kind === 'child' ? { child_id: g.id, parent_id: g.parentId }
                    : g.kind === 'profile' ? { user_id: g.id, parent_id: g.id }
                        : { unregistered_athlete_id: g.id },
                teamKey: teamId(principal.disciplina, principal.cat),
                branchKey: principal.disciplina,
                planKey: planMatriculaId(principal.disciplina),
            });
        }
    }

    // ── 5b. Cuota social de los acudientes (no son deportistas) ─────────────
    for (const p of Object.values(people.parents)) {
        const states = planFor(p.cuota_social === 'overdue' ? 'mora_2' : 'al_dia');
        PERIODS.forEach((period, i) => {
            row(`cuota:${p.profileId}:${period.y}-${period.m}`, {
                concept: `Cuota social ${period.label} — ${p.full_name}`,
                amount: CLUB.cuota_social, dueDate: period.due, status: states[i],
                methodKey: pickMethod(),
                // Solo parent_id: el acudiente no es atleta y así no compite con
                // el cobro principal de ninguno de sus hijos.
                subject: { parent_id: p.profileId },
                branchKey: null,
            });
        });
    }

    // Orden cronológico: validateAccess mira el pago MÁS RECIENTE por
    // created_at, así que el orden de inserción importa.
    pays.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

    // ── Preflight de los índices únicos F0 ──────────────────────────────────
    // Réplica exacta de las tres condiciones parciales, sobre el periodo
    // EFECTIVO (el que dejará el trigger). Si esto salta, el INSERT moriría con
    // un 23505 a mitad del lote.
    const ACTIVOS = new Set(['pending', 'awaiting_approval', 'paid', 'partial', 'overdue', 'glosado']);
    const slots = new Map();
    for (const p of pays) {
        if (!ACTIVOS.has(p.status)) continue;
        const py = p.period_year ?? Number(p.due_date.slice(0, 4));
        const pm = p.period_month ?? Number(p.due_date.slice(5, 7));
        let idx = null;
        if (p.child_id) idx = `child:${p.child_id}`;
        else if (p.user_id) idx = `adult:${p.user_id}`;
        else if (p.unregistered_athlete_id) idx = `unreg:${p.unregistered_athlete_id}`;
        if (!idx) continue;                       // solo parent_id → sin índice
        const k = `${idx}:${py}-${pm}`;
        slots.set(k, [...(slots.get(k) || []), p.concept]);
    }
    const colisiones = [...slots.entries()].filter(([, v]) => v.length > 1);
    if (colisiones.length) {
        throw new Error(
            `F0: ${colisiones.length} colisión(es) con los índices únicos por atleta+periodo:\n`
            + colisiones.slice(0, 6).map(([k, v]) => `  ${k}\n    ${v.join('\n    ')}`).join('\n'),
        );
    }
    ok(`preflight F0 · ${slots.size} slots atleta+periodo, sin colisiones`);
    if (val('--dump')) {
        const { writeFileSync } = await import('node:fs');
        writeFileSync(val('--dump'), JSON.stringify(pays, null, 1));
        info(`volcado → ${val('--dump')}`);
    }

    const n = await insertIfEmpty('payments', pays, `payments?school_id=eq.${SCHOOL_ID}`);
    if (n) {
        const agg = pays.reduce((a, p) => { a[p.status] = (a[p.status] || 0) + 1; return a; }, {});
        const deuda = pays.filter((p) => p.status !== 'paid').reduce((a, p) => a + p.amount, 0);
        ok(`payments · ${n} filas ${JSON.stringify(agg)}`);
        ok(`cartera pendiente ≈ $${deuda.toLocaleString('es-CO')} COP`);
    }
}

// ============================================================
// PASO 6 — Agenda y asistencia
// ============================================================
async function stepAttendance() {
    head('6 · Agenda de sesiones y asistencia');

    const sessions = [];
    const facilityOf = (d, key) => facilityId(d.key, key);
    // Ventana: 14 días atrás (para asistencia con historia) y 14 adelante
    // (para que los calendarios no se vean vacíos).
    for (let off = -14; off <= 14; off++) {
        const date = addDays(TODAY, off);
        const wd = dow(date);
        for (const d of DISCIPLINAS) {
            for (const h of d.horarios) {
                if (!h.days.includes(wd)) continue;
                const coach = Object.values(people.coaches).find((c) => c.teams.some((t) => t.disciplina === d.key && t.cat === h.cat));
                sessions.push({
                    id: duid(`session:${d.key}:${h.cat}:${date}:${h.start}`),
                    school_id: SCHOOL_ID, team_id: teamId(d.key, h.cat),
                    offering_id: offeringId(d.key), facility_id: facilityOf(d, h.facility),
                    session_date: date, start_time: h.start, end_time: h.end,
                    title: `${d.name} — ${catOf(d.key, h.cat).name}`,
                    coach_id: coach ? staffId(coach.key) : null,
                    finalized: off < 0, is_bookable: off >= 0,
                    max_capacity: 30, requires_capacity_check: false,
                    created_by: people.staff.gerencia.profileId,
                    finalized_at: off < 0 ? `${date}T${h.end}:00-05:00` : null,
                    finalized_by: off < 0 ? people.staff.gerencia.profileId : null,
                });
            }
        }
    }
    await upsert('attendance_sessions', sessions);
    ok(`attendance_sessions · ${sessions.length} sesiones (${addDays(TODAY, -14)} → ${addDays(TODAY, 14)})`);

    // Asistencia de las últimas 2 semanas en los grupos con horario.
    const grupos = [
        { d: 'tenis', c: 'juvenil_comp' },
        { d: 'natacion', c: 'infantil' },
        { d: 'futbol', c: 'sub15' },
        { d: 'golf', c: 'juvenil' },
    ];
    const records = [];
    for (const g of grupos) {
        const tid = teamId(g.d, g.c);
        const miembros = roster.filter((r) => r.disciplina === g.d && r.cat === g.c);
        const past = sessions.filter((s) => s.team_id === tid && s.finalized);
        for (const s of past) {
            for (const m of miembros) {
                const r = rnd();
                const status = r < 0.82 ? 'present' : r < 0.94 ? 'absent' : 'late';
                records.push({
                    id: duid(`att:${s.id}:${m.id}`), school_id: SCHOOL_ID,
                    session_id: s.id, team_id: tid, attendance_date: s.session_date,
                    status, check_in_method: 'manual',
                    marked_by: coachProfileFor(g.d, g.c) || people.staff.gerencia.profileId,
                    ...(m.kind === 'child' ? { child_id: m.id }
                        : m.kind === 'profile' ? { user_id: m.id }
                            : { unregistered_athlete_id: m.id }),
                });
            }
        }
    }
    const n = await insertIfEmpty('attendance_records', records, `attendance_records?school_id=eq.${SCHOOL_ID}`);
    if (n) ok(`attendance_records · ${n} marcas en ${grupos.length} grupos`);
}

// ============================================================
// PASO 7 — Control de acceso biométrico
// ============================================================
async function stepAccess() {
    head('7 · Control de acceso (ZKTeco simulado)');

    await upsert('turnstile_devices', DEVICES.map((dv) => ({
        id: deviceId(dv.key), school_id: SCHOOL_ID, serial_number: dv.serial_number,
        device_name: dv.device_name, direction: dv.direction, location: dv.location,
        brand: dv.brand, is_active: true, port: 4370,
        last_seen_at: `${TODAY}T07:30:00-05:00`,
        metadata: { demo: true },
    })));
    ok(`turnstile_devices · ${DEVICES.length} lectores (${DEVICES.map((d) => d.serial_number).join(', ')})`);

    // Mapeo PIN → persona. Solo los adultos CON cuenta se validan por user_id;
    // validateAccess no contempla menores (van por child_id), así que la demo
    // del bloqueo usa a Daniel y Valentina.
    const maps = [];
    for (const a of Object.values(people.athletes)) {
        if (a.zk_pin) maps.push({ id: duid(`zk:${a.key}`), school_id: SCHOOL_ID, zk_pin: a.zk_pin, user_id: a.profileId });
    }
    for (const r of roster.filter((x) => x.kind === 'unreg' && x.zkPin)) {
        maps.push({ id: duid(`zk:unreg:${r.id}`), school_id: SCHOOL_ID, zk_pin: r.zkPin, unregistered_athlete_id: r.id });
    }
    // La portería y la gerencia también tienen huella (staff entra sin cobro).
    maps.push({ id: duid('zk:porteria'), school_id: SCHOOL_ID, zk_pin: 1, user_id: people.staff.porteria.profileId });
    maps.push({ id: duid('zk:gerencia'), school_id: SCHOOL_ID, zk_pin: 2, user_id: people.staff.gerencia.profileId });
    await upsert('zk_user_mappings', maps);
    ok(`zk_user_mappings · ${maps.length} huellas mapeadas (Daniel=${ATHLETES.find((a) => a.key === 'dospina').zk_pin}, Valentina=${ATHLETES.find((a) => a.key === 'vcruz').zk_pin})`);

    // Bitácora de los últimos 3 días: entradas concedidas + los rechazos de
    // Daniel (mora). Coherente con lo que escribiría access-adms.ts.
    const events = [];
    const zonas = ['Piscina', 'Gimnasio', 'Canchas de tenis', 'Casa club'];
    const candidatos = maps.filter((m) => m.user_id || m.unregistered_athlete_id);
    const daniel = people.athletes.dospina;
    for (let day = 3; day >= 1; day--) {
        const date = addDays(TODAY, -day);
        for (let i = 0; i < 6; i++) {
            const m = pick(candidatos);
            const esDaniel = m.user_id === daniel.profileId;
            const hora = `${String(between(6, 20)).padStart(2, '0')}:${String(between(0, 59)).padStart(2, '0')}:00`;
            events.push({
                id: duid(`access:${date}:${i}`), school_id: SCHOOL_ID,
                device_id: deviceId('entry'), direction: 'entry',
                access_granted: !esDaniel,
                denial_reason: esDaniel ? 'payment_overdue' : null,
                check_in_method: 'fingerprint',
                zk_user_id: m.zk_pin,
                user_id: m.user_id || null,
                unregistered_athlete_id: m.unregistered_athlete_id || null,
                occurred_at: `${date}T${hora}-05:00`,
                raw_event: { demo: true, zona: pick(zonas) },
            });
        }
    }
    // Los 2 intentos rechazados de Daniel de hoy: es el "wow" del biométrico.
    for (const [i, hora] of ['07:12:00', '18:41:00'].entries()) {
        events.push({
            id: duid(`access:daniel:${TODAY}:${i}`), school_id: SCHOOL_ID,
            device_id: deviceId('entry'), direction: 'entry', access_granted: false,
            denial_reason: 'payment_overdue', check_in_method: 'fingerprint',
            zk_user_id: daniel.zk_pin, user_id: daniel.profileId,
            occurred_at: `${TODAY}T${hora}-05:00`,
            raw_event: { demo: true, zona: 'Casa club' },
        });
    }
    const n = await insertIfEmpty('access_events', events, `access_events?school_id=eq.${SCHOOL_ID}`);
    if (n) ok(`access_events · ${n} registros (últimos 3 días + 2 rechazos de Daniel hoy)`);
}

// ============================================================
// PASO 7b — Reservas de escenarios
//
// Llena "Gestión de Reservas" (/facilities → pestaña Reservas). El listado sale
// de `facility_reservations` filtrado por las instalaciones de la escuela, y las
// tarjetas de arriba cuentan los estados pending / confirmed / cancelled /
// completed (useFacilityReservations.ts).
//
// Mezcla buscada: socios reservando cancha (booker_type parent/athlete,
// resv_type internal) + alquiler de escenarios a empresas y colegios
// (booker_type external, resv_type rental) — que es la historia de ingresos por
// alquiler. Pasado → completed/cancelled; hoy y futuro → confirmed/pending.
//
// `reservation_payments` queda a propósito sin sembrar: ninguna pantalla la lee
// (solo existe la RPC add_reservation_payment) y el estado de pago que muestra
// la UI vive en facility_reservations.payment_status / amount_paid.
// ============================================================
async function stepReservations() {
    head('7b · Reservas de escenarios');

    // Franjas horarias fuera de los bloques de clase, para no pisarlos.
    const FRANJAS = [
        ['09:00', '11:00'], ['11:00', '13:00'], ['13:00', '15:00'],
        ['15:00', '17:00'], ['19:00', '21:00'], ['20:00', '22:00'],
    ];

    // Instalaciones reservables con su tarifa.
    const reservables = DISCIPLINAS.flatMap((d) => d.facilities.map((f) => ({
        id: facilityId(d.key, f.key), disciplina: d.key, key: f.key, name: f.name,
        capacity: f.capacity, ...(TARIFAS[f.key] || { hora: 0, rental: false }),
    }))).filter((f) => f.hora > 0);

    // Quién reserva: socios adultos, acudientes y el club (para los alquileres).
    const socios = [
        ...Object.values(people.athletes).map((a) => ({ id: a.profileId, name: a.full_name, tipo: 'athlete' })),
        ...Object.values(people.parents).map((p) => ({ id: p.profileId, name: p.full_name, tipo: 'parent' })),
    ];
    const fillerParents = (await get(
        `profiles?select=id,full_name&email=in.(${FILLER_PARENTS.map((f) => `"${f.email}"`).join(',')})`,
    )).map((p) => ({ id: p.id, name: p.full_name, tipo: 'parent' }));
    const solicitantes = [...socios, ...fillerParents];
    const recepcion = people.staff.gerencia.profileId;   // quien registra los alquileres

    const rows = [];
    const ocupado = new Set();   // evita dos reservas en la misma cancha, día y hora

    // 45 reservas repartidas entre 21 días atrás y 21 adelante.
    for (let i = 0; i < 45; i++) {
        const offset = between(-21, 21);
        const date = addDays(TODAY, offset);
        if (dow(date) === 0) continue;                     // domingo cerrado
        const fac = pick(reservables);
        const [start, end] = pick(FRANJAS);
        const slot = `${fac.id}|${date}|${start}`;
        if (ocupado.has(slot)) continue;
        ocupado.add(slot);

        // 1 de cada 3 es alquiler a un tercero.
        const esAlquiler = fac.rental && rnd() < 0.34;
        const sorteado = esAlquiler ? null : pick(solicitantes);

        const pasada = offset < 0;

        // Un socio en mora no debería aparecer reservando a futuro: Daniel está
        // bloqueado en portería, y una reserva confirmada suya se contradice con
        // eso. Sus reservas quedan solo en el pasado ("reservaba hasta julio").
        // La sustitución es determinista y NO consume aleatoriedad extra: los ids
        // de estas filas derivan de esta misma secuencia y ya están sembrados.
        const morosos = new Set([people.athletes.dospina?.profileId].filter(Boolean));
        const alDia = solicitantes.find((s) => !morosos.has(s.id));
        const quien = (!esAlquiler && !pasada && morosos.has(sorteado.id)) ? alDia : sorteado;

        const r = rnd();
        const status = pasada
            ? (r < 0.78 ? 'completed' : 'cancelled')
            // "Por confirmar" es la métrica que se resalta arriba: conviene que
            // tenga cuerpo, no 2 o 3 filas.
            : (r < 0.50 ? 'confirmed' : r < 0.88 ? 'pending' : 'cancelled');

        const horas = 2;
        const tarifa = esAlquiler ? Math.round(fac.hora * 1.4) : fac.hora;
        const precio = tarifa * horas;

        // Pago: lo completado/confirmado suele estar pagado; lo pendiente, no.
        const payment = status === 'completed' ? (rnd() < 0.85 ? 'paid' : 'partial')
            : status === 'confirmed' ? (rnd() < 0.55 ? 'paid' : 'partial')
                : status === 'pending' ? 'unpaid'
                    // Cancelada: nunca 'paid' (quedaría "pagó y se canceló, ¿y el
                    // reembolso?"). O no se alcanzó a pagar, o se exoneró.
                    : (rnd() < 0.5 ? 'unpaid' : 'waived');
        const amount_paid = payment === 'paid' ? precio
            : payment === 'partial' ? Math.round(precio * 0.3)
                : 0;

        const aprobada = status === 'confirmed' || status === 'completed';
        rows.push({
            id: duid(`resv:${i}:${fac.key}:${date}:${start}`),
            school_id: SCHOOL_ID,
            facility_id: fac.id,
            user_id: esAlquiler ? recepcion : quien.id,
            reservation_date: date, start_time: start, end_time: end,
            status,
            booker_type: esAlquiler ? 'external' : quien.tipo,
            resv_type: esAlquiler ? 'rental' : 'internal',
            external_org_name: esAlquiler ? pick(ARRENDATARIOS) : null,
            price: precio,
            amount_paid,
            payment_status: payment,
            min_deposit_pct: 30,
            participants: esAlquiler ? between(12, Math.max(14, fac.capacity)) : between(2, 8),
            notes: esAlquiler
                ? `Alquiler de escenario — ${horas} horas.`
                : `Reserva de socio en ${fac.name}.`,
            approved_by: aprobada ? recepcion : null,
            approved_at: aprobada ? `${addDays(date, -1)}T10:00:00-05:00` : null,
            cancellation_reason: status === 'cancelled' ? pick(MOTIVOS_CANCELACION) : null,
            cancelled_at: status === 'cancelled' ? `${addDays(date, -1)}T16:00:00-05:00` : null,
            created_at: `${addDays(date, -between(2, 9))}T09:30:00-05:00`,
        });
    }

    await upsert('facility_reservations', rows);
    const agg = rows.reduce((a, x) => { a[x.status] = (a[x.status] || 0) + 1; return a; }, {});
    const ingreso = rows.filter((x) => x.status !== 'cancelled').reduce((a, x) => a + x.amount_paid, 0);
    const alquileres = rows.filter((x) => x.resv_type === 'rental').length;
    ok(`facility_reservations · ${rows.length} reservas ${JSON.stringify(agg)}`);
    ok(`${alquileres} alquileres a terceros · recaudado en reservas ≈ $${ingreso.toLocaleString('es-CO')} COP`);

    // Disponibilidad por escenario (lunes a sábado), para que "Nueva Reserva"
    // tenga franjas que ofrecer y la ficha no se vea sin configurar.
    const disp = [];
    for (const f of reservables) {
        for (let day = 1; day <= 6; day++) {
            disp.push({
                id: duid(`avail:${f.key}:${day}`), facility_id: f.id, school_id: SCHOOL_ID,
                day_of_week: day,
                start_time: day === 6 ? '07:00' : '06:00',
                end_time: day === 6 ? '18:00' : '22:00',
                max_group_capacity: f.capacity,
            });
        }
    }
    await upsert('facility_availability', disp);
    ok(`facility_availability · ${disp.length} franjas (${reservables.length} escenarios × Lun-Sáb)`);
}

// ============================================================
// PASO 8 — Torneo abierto con inscripción externa
// ============================================================
async function stepTorneo() {
    head('8 · Torneo abierto de tenis');

    const fecha = addDays(TODAY, TORNEO.days_ahead);
    await upsert('events', {
        id: duid('event:torneo'), slug: TORNEO.slug, title: TORNEO.title,
        creator_id: people.staff.gerencia.profileId, creator_role: 'school',
        organizer_id: null, school_id: SCHOOL_ID,
        sport: TORNEO.sport, event_type: 'tournament', tournament_scope: 'external',
        event_date: fecha, start_time: TORNEO.start_time, end_time: TORNEO.end_time,
        address: CLUB.address, city: CLUB.city,
        capacity: TORNEO.capacity, price: TORNEO.price, currency: 'COP',
        status: 'active', registrations_open: true, visibility: 'public',
        registration_type: 'individual', allow_individual_registration: true,
        payer_mode: 'flexible', payment_gates_approval: false,
        registration_deadline: addDays(fecha, -3),
        description: 'Torneo abierto a socios y no socios. Inscripción individual con pago único.',
        contact_email: CLUB.email, contact_phone: CLUB.phone,
        payment_methods: ['wompi'],
    });
    ok(`events · ${TORNEO.title} → ${fecha} ($${TORNEO.price.toLocaleString('es-CO')})`);

    await upsert('event_registrations', {
        id: duid('event_reg:aruiz'), event_id: duid('event:torneo'),
        participant_name: EXTERNAL.full_name, participant_email: EXTERNAL.email,
        participant_phone: EXTERNAL.phone, participant_age: EXTERNAL.age,
        // El CHECK vivo es el original: pending|verified|rejected|not_required
        // (el webhook de Wompi escribe 'paid'/'confirmed', que ese CHECK rechaza
        // — bug latente del módulo de eventos, ajeno a este seed).
        participant_role: 'athlete', status: 'approved', payment_status: 'verified',
        amount_paid: TORNEO.price, payment_method: 'card',
        user_id: people.external.profileId, is_independent: true,
        approved_by: people.staff.gerencia.profileId, approved_at: `${TODAY}T10:00:00-05:00`,
        notes: 'Participante externa (no socia) — pago único en línea.',
    });
    ok(`event_registrations · ${EXTERNAL.full_name} inscrita y pagada`);
}

// ============================================================
// PASO 9 — Checklist de verificación
// ============================================================
async function stepVerify() {
    head('9 · Checklist de verificación');
    const q = async (p) => (await get(p)) || [];
    let fails = 0;
    const check = (cond, label, detail = '') => {
        if (cond) ok(`${label} ${C.dim}${detail}${C.off}`);
        else { bad(`${label} ${detail}`); fails++; }
    };

    const school = await q(`schools?id=eq.${SCHOOL_ID}&select=id,name,slug,owner_id,is_demo,school_type`);
    check(school.length === 1 && school[0].is_demo, 'Club creado y marcado is_demo', school[0]?.name || '');

    const branches = await q(`school_branches?school_id=eq.${SCHOOL_ID}&select=id,name,is_main`);
    check(branches.length === DISCIPLINAS.length + 1, `Sedes: ${branches.length}`, `(1 social + ${DISCIPLINAS.length} disciplinas)`);
    check(branches.filter((b) => b.is_main).length === 1, 'Exactamente una sede principal');

    // Solo activas: es lo que muestran los listados, y así una fila desactivada
    // (p. ej. la sonda de permisos) no cuenta como categoría del club.
    const teams = await q(`teams?school_id=eq.${SCHOOL_ID}&active=is.true&select=id,name,branch_id`);
    const cats = DISCIPLINAS.reduce((a, d) => a + d.categorias.length, 0);
    check(teams.length === cats, `Categorías activas: ${teams.length}/${cats}`);

    const plans = await q(`offering_plans?school_id=eq.${SCHOOL_ID}&select=id,name,price`);
    check(plans.length > 0, `Tarifas: ${plans.length}`);

    // Usuarios: login + rol + alcance
    const emails = [...STAFF, ...COACHES, ...PARENTS, ...ATHLETES, EXTERNAL, ...FILLER_PARENTS].map((x) => x.email);
    const profs = await q(`profiles?email=in.(${emails.map((e) => `"${e}"`).join(',')})&select=id,email,full_name,role`);
    check(profs.length === emails.length, `Usuarios con perfil: ${profs.length}/${emails.length}`);

    const members = await q(`school_members?school_id=eq.${SCHOOL_ID}&select=profile_id,role,branch_id,status`);
    const scoped = members.filter((m) => m.role === 'admin' && m.branch_id);
    check(scoped.length === 3, `Coordinadores scoped por sede: ${scoped.length}/3`, '(Andrés, Camila, Jorge)');
    check(members.some((m) => m.role === 'owner' && !m.branch_id), 'Ricardo es owner global');
    check(members.some((m) => m.role === 'admin' && !m.branch_id), 'Portería es admin global (necesita /school/access-control)');
    // Patricia NO debe ser admin: es `reporter` (la UI lo llama "Auditor"), el
    // único perfil de consulta. Si vuelve a admin, tiene el panel completo del club.
    const patricia = profs.find((p) => p.email === 'finanzas@demo.sportmaps.co');
    const patriciaMember = members.find((m) => m.profile_id === patricia?.id);
    check(patricia?.role === 'reporter' && patriciaMember?.role === 'reporter',
        'Patricia es Auditor (solo lectura), no admin',
        `(profiles.role=${patricia?.role}, school_members.role=${patriciaMember?.role})`);
    check(!profs.some((p) => p.role === 'super_admin'),
        'Ninguna cuenta demo quedó como super_admin de plataforma');

    const athl = await q(`school_athletes?school_id=eq.${SCHOOL_ID}&select=id,full_name,payment_status,team_name&limit=200`);
    check(athl.length >= 40, `Deportistas visibles en el dashboard: ${athl.length}`);

    const pays = await q(`payments?school_id=eq.${SCHOOL_ID}&select=status,amount&limit=2000`);
    const agg = pays.reduce((a, p) => { a[p.status] = (a[p.status] || 0) + 1; return a; }, {});
    check(pays.length > 0, `Cartera: ${pays.length} cobros`, JSON.stringify(agg));

    // Caso estrella: Tomás con fútbol al día y tenis en mora.
    // Su cobro de fútbol (disciplina principal) va con child_id; el de tenis va
    // con parent_id — así conviven dos estados en el mismo mes sin romper los
    // índices únicos F0. Ambos los ve el padre en la app.
    const tomas = childId('tomas');
    const mauricio = (await q(`children?id=eq.${tomas}&select=parent_id`))[0]?.parent_id;
    const futbolOk = (await q(`payments?child_id=eq.${tomas}&select=concept,status`))
        .filter((p) => /Fútbol/.test(p.concept) && p.status === 'paid');
    const tenisMora = (await q(`payments?parent_id=eq.${mauricio}&child_id=is.null&select=concept,status,amount`))
        .filter((p) => /Tenis/.test(p.concept) && p.status === 'overdue');
    check(tenisMora.length === 1 && futbolOk.length >= 2,
        'Tomás Herrera: fútbol al día + tenis en mora (pagable por el padre)',
        `(tenis overdue=${tenisMora.length} × $${(tenisMora[0]?.amount || 0).toLocaleString('es-CO')}, fútbol paid=${futbolOk.length})`);

    // Daniel bloqueado: validateAccess deniega si su pago más reciente está overdue
    const daniel = people.athletes?.dospina?.profileId
        || (await q(`profiles?email=eq.${encodeURIComponent('dospina@demo.sportmaps.co')}&select=id`))[0]?.id;
    const last = await q(`payments?user_id=eq.${daniel}&select=status,concept,created_at&order=created_at.desc&limit=1`);
    check(last[0]?.status === 'overdue',
        'Daniel Ospina quedará BLOQUEADO en portería',
        `(último cobro: ${last[0]?.status} — ${last[0]?.concept})`);

    const valentina = people.athletes?.vcruz?.profileId
        || (await q(`profiles?email=eq.${encodeURIComponent('vcruz@demo.sportmaps.co')}&select=id`))[0]?.id;
    const lastV = await q(`payments?user_id=eq.${valentina}&select=status&order=created_at.desc&limit=1`);
    check(lastV[0]?.status !== 'overdue', 'Valentina Cruz pasará el torniquete', `(último cobro: ${lastV[0]?.status})`);

    const sess = await q(`attendance_sessions?school_id=eq.${SCHOOL_ID}&select=id&limit=500`);
    const att = await q(`attendance_records?school_id=eq.${SCHOOL_ID}&select=id&limit=1000`);
    check(sess.length > 0 && att.length > 0, `Agenda ${sess.length} sesiones · asistencia ${att.length} marcas`);

    const acc = await q(`access_events?school_id=eq.${SCHOOL_ID}&select=id,access_granted&limit=200`);
    check(acc.length >= 15, `Logs de acceso: ${acc.length}`, `(denegados: ${acc.filter((a) => !a.access_granted).length})`);

    const resv = await q(`facility_reservations?school_id=eq.${SCHOOL_ID}&select=status,resv_type,payment_status,price&limit=300`);
    const rAgg = resv.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {});
    check(resv.length >= 30 && rAgg.pending > 0 && rAgg.confirmed > 0 && rAgg.completed > 0,
        `Reservas: ${resv.length}`, JSON.stringify(rAgg));
    check(!resv.some((r) => r.status === 'cancelled' && r.payment_status === 'paid'),
        'Ninguna reserva cancelada quedó marcada como pagada');
    check(resv.filter((r) => r.resv_type === 'rental').length > 0,
        `Alquileres a terceros: ${resv.filter((r) => r.resv_type === 'rental').length}`);

    const ev = await q(`events?school_id=eq.${SCHOOL_ID}&select=id,title`);
    const reg = await q(`event_registrations?event_id=eq.${duid('event:torneo')}&select=id,participant_name,payment_status`);
    check(ev.length === 1 && reg.length === 1, 'Torneo con la inscripción de Alejandra', reg[0]?.payment_status || '');

    // Aislamiento: nada tocado fuera de este school_id
    const otros = await q(`schools?owner_id=eq.${school[0]?.owner_id}&select=id,name`);
    check(otros.length === 1, 'El owner demo no quedó dueño de otras escuelas', `(${otros.length})`);

    console.log(fails === 0
        ? `\n${C.green}${C.bold}Checklist completo: sin fallos.${C.off}`
        : `\n${C.red}${C.bold}Checklist con ${fails} fallo(s).${C.off}`);
    return fails;
}

// ============================================================
// Orquestación
// ============================================================
const STEPS = [
    ['club', stepClub],
    ['staff', stepStaff],
    ['branding', stepBranding],
    ['catalog', stepCatalog],
    ['people', stepPeople],
    ['payments', stepPayments],
    ['attendance', stepAttendance],
    ['access', stepAccess],
    ['reservations', stepReservations],
    ['torneo', stepTorneo],
];

async function main() {
    console.log(`${C.bold}SportMaps — seed demo "${CLUB.name}"${C.off}`);
    console.log(`${C.dim}proyecto: ${SB_URL.replace('https://', '').split('.')[0]} · hoy: ${TODAY} · school_id: ${SCHOOL_ID}${C.off}`);
    console.log(`${C.dim}periodos de cartera: ${PERIODS.map((p) => p.label).join(', ')}${C.off}`);
    if (DRY) console.log(`${C.yellow}MODO --dry-run: no se escribe nada.${C.off}`);

    if (VERIFY_ONLY) {
        // El checklist necesita los ids de las personas: se resuelven leyendo.
        for (const s of [...STAFF, ...COACHES]) {
            const p = await get(`profiles?select=id&email=eq.${encodeURIComponent(s.email)}&limit=1`);
            if (p[0]) (s.member_role === 'coach' ? people.coaches : people.staff)[s.key] = { ...s, profileId: p[0].id };
        }
        for (const a of ATHLETES) {
            const p = await get(`profiles?select=id&email=eq.${encodeURIComponent(a.email)}&limit=1`);
            if (p[0]) people.athletes[a.key] = { ...a, profileId: p[0].id };
        }
        process.exit((await stepVerify()) === 0 ? 0 : 1);
    }

    // Con --only=staff/payments/... la sede principal y las fichas de staff
    // tienen que estar resueltas igual (varias tablas las referencian).
    await resolveMainBranch();
    await resolveStaffIds();

    for (const [name, fn] of STEPS) {
        if (ONLY && !ONLY.includes(name)) { info(`paso "${name}" omitido (--only)`); continue; }
        await fn();
    }

    if (!DRY && !ONLY) {
        const fails = await stepVerify();
        head('Resumen');
        console.log(`  filas escritas/actualizadas: ${writes}`);
        console.log(`  school_id: ${SCHOOL_ID}`);
        console.log(`  perfil público: /s/${CLUB.slug}`);
        console.log(`  contraseña de todos los usuarios: ${PASSWORD}`);
        console.log(`  guion de la demo y credenciales: scripts/demo-club-campestre/README.md`);
        process.exit(fails === 0 ? 0 : 1);
    }
}

main().catch((e) => { console.error(`\n${C.red}ERROR:${C.off} ${e.message}`); process.exit(1); });
