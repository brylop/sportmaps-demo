// scripts/rls-pruebas-clinicas.mjs
//
// Prueba de COMPORTAMIENTO del módulo de profesionales de salud contra la base
// viva: actúa como profesional, otro profesional, atleta adulto, acudiente,
// coach de la escuela y coach ajeno, y verifica que cada operación pase o
// rebote como dice docs/specs/profesionales-salud-fisioterapia.md.
//
// Mismo patrón que rls-pruebas-negativas.mjs: usuarios de auth REALES y
// desechables (Admin API), login real, PostgREST con el token de cada uno.
// La historia clínica es inmutable incluso para service_role; para limpiar se
// usa purge_clinical_test_data(), que solo acepta correos del dominio de
// pruebas. Todo se borra en el finally.
//
// Requiere aplicadas: 20261006094145, 20261006094147, 20261006094149.
// Uso:  npm run seguridad:rls-clinicas      (sale con 1 si algún caso falla)

import { createClient } from '../bff/node_modules/@supabase/supabase-js/dist/index.mjs';
import { config } from '../bff/node_modules/dotenv/lib/main.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: resolve(RAIZ, 'bff/.env') });

const URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON_KEY || !SERVICE_KEY) {
    console.error('Faltan SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY en bff/.env');
    process.exit(1);
}

const admin = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });
const anon = createClient(URL, ANON_KEY, { auth: { persistSession: false } });
const marca = Date.now();
const inv = { users: [], professionals: [], schools: [], members: [], children: [], vendors: [], enrollments: [], teams: [] };

// Fecha de mañana en Colombia (YYYY-MM-DD) y su día de la semana.
const hoyCol = new Date(Date.now() - 5 * 3600 * 1000);
const manana = new Date(hoyCol.getTime() + 86400000);
const MANANA = manana.toISOString().slice(0, 10);
const DOW = manana.getUTCDay();

async function crearUsuario(etiqueta, rol = 'parent') {
    const email = `clin-${etiqueta}-${marca}-${randomUUID().slice(0, 8)}@rls-pruebas-negativas.invalid`;
    const password = `Prueba-${randomUUID()}!A1`;
    const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { role: rol, full_name: `Prueba ${etiqueta}` },
    });
    if (error) throw new Error(`crear usuario ${etiqueta}: ${error.message}`);
    inv.users.push(data.user.id);
    await admin.from('profiles').update({ role: rol, full_name: `Prueba ${etiqueta}` }).eq('id', data.user.id);
    const cliente = createClient(URL, ANON_KEY, { auth: { persistSession: false } });
    const { error: e2 } = await cliente.auth.signInWithPassword({ email, password });
    if (e2) throw new Error(`login ${etiqueta}: ${e2.message}`);
    return { id: data.user.id, c: cliente };
}

const resultados = [];
/** esperado: 'OK' | 'RECHAZO' | función(data) => true/false */
async function caso(nombre, esperado, fn) {
    let paso = false, detalle = '', data = null;
    try {
        const r = await fn();
        data = r?.data ?? null;
        const error = r?.error ?? null;
        const filas = Array.isArray(data) ? data.length : (data != null ? 1 : 0);
        if (esperado === 'RECHAZO') {
            paso = !!error || filas === 0;
            detalle = error ? error.message : (filas ? `PASÓ (${filas} filas) y debía rebotar` : '0 filas (bloqueado en silencio)');
        } else if (esperado === 'OK') {
            paso = !error;
            detalle = error ? error.message : 'ok';
        } else {
            paso = !error && esperado(data);
            detalle = error ? error.message : (paso ? 'ok' : `resultado inesperado: ${JSON.stringify(data)?.slice(0, 200)}`);
        }
    } catch (e) { detalle = `excepción: ${e.message}`; }
    resultados.push({ nombre, paso, detalle });
    return data;
}
const conError = (codigo) => async (p) => { const r = await p; return { data: r.error?.message?.includes(codigo) ? true : null, error: r.error && !r.error.message.includes(codigo) ? r.error : null }; };

let proA, proB, adulto, acudiente, coach, coachAjeno, ruta;
try {
    [proA, proB, adulto, acudiente, coach, coachAjeno] = await Promise.all([
        crearUsuario('pro-a', 'wellness_professional'), crearUsuario('pro-b', 'wellness_professional'),
        crearUsuario('adulto', 'athlete'), crearUsuario('acudiente', 'parent'),
        crearUsuario('coach', 'coach'), crearUsuario('coach-ajeno', 'coach'),
    ]);
    inv.professionals.push(proA.id, proB.id);

    // ── Montaje (service_role) ────────────────────────────────────────────────
    // El registro de un wellness_professional ya crea su vendor_profiles: upsert.
    const { data: vp, error: vpErr } = await admin.from('vendor_profiles').upsert({
        user_id: proA.id, vendor_type: 'wellness', display_name: `__CLIN_TEST_${marca}__`,
        verification_status: 'verified', is_active: true, professional_license: 'TP-PRUEBA-123',
    }, { onConflict: 'user_id' }).select('id').single();
    if (vpErr) throw new Error(`vendor_profiles: ${vpErr.message}`);
    inv.vendors.push(vp.id);
    const { data: sl, error: slErr } = await admin.from('service_listings').insert({
        vendor_profile_id: vp.id, name: 'Sesión de prueba', service_type: 'Fisioterapia', price: 50000,
        currency: 'COP', duration_minutes: 60, visibility: 'public', is_active: true,
    }).select('id').single();
    if (slErr) throw new Error(`service_listings: ${slErr.message}`);
    const { error: saErr } = await admin.from('service_availability').insert({
        vendor_profile_id: vp.id, day_of_week: DOW, start_time: '06:00', end_time: '22:00',
        slot_duration_minutes: 60, buffer_time_minutes: 0, max_concurrent: 1, is_active: true,
    });
    if (saErr) throw new Error(`service_availability: ${saErr.message}`);

    const { data: esc } = await admin.from('schools').insert({ name: `__CLIN_TEST_${marca}__`, is_demo: true }).select('id').single();
    const { data: escB } = await admin.from('schools').insert({ name: `__CLIN_TEST_B_${marca}__`, is_demo: true }).select('id').single();
    inv.schools.push(esc.id, escB.id);
    for (const [u, s] of [[coach, esc.id], [coachAjeno, escB.id], [acudiente, esc.id]]) {
        const { data: m } = await admin.from('school_members').insert({
            profile_id: u.id, school_id: s, role: u === acudiente ? 'parent' : 'coach', status: 'active',
        }).select('id').single();
        if (m) inv.members.push(m.id);
    }
    const { data: hijo, error: hijoErr } = await admin.from('children').insert({
        parent_id: acudiente.id, full_name: 'Hijo Prueba Clínica', date_of_birth: '2014-05-10', school_id: esc.id, is_demo: true,
    }).select('id').single();
    if (hijoErr) throw new Error(`children: ${hijoErr.message}`);
    inv.children.push(hijo.id);
    // Una inscripción activa exige equipo o plan (enrollments_active_needs_target).
    const { data: equipo } = await admin.from('teams').insert({
        school_id: esc.id, name: `__CLIN_TEST_TEAM_${marca}__`, sport: 'futbol', is_demo: true,
    }).select('id').single();
    if (equipo) inv.teams.push(equipo.id);
    const { data: enr, error: enrErr } = await admin.from('enrollments').insert({
        school_id: esc.id, child_id: hijo.id, team_id: equipo?.id ?? null, status: 'active', start_date: MANANA,
    }).select('id').single();
    if (enr) inv.enrollments.push(enr.id);

    // ── Reserva y agenda ──────────────────────────────────────────────────────
    const citaId = await caso('acudiente reserva para su hijo por RPC', (d) => typeof d === 'string',
        () => acudiente.c.rpc('request_service_appointment', {
            p_service_listing_id: sl.id, p_date: MANANA, p_time: '10:00', p_child_id: hijo.id, p_notes: 'prueba' }));
    await caso('otro cliente no puede tomar el mismo horario', (d) => d === true,
        () => conError('HORARIO_NO_DISPONIBLE')(adulto.c.rpc('request_service_appointment', {
            p_service_listing_id: sl.id, p_date: MANANA, p_time: '10:00' })));
    await caso('cliente no inserta citas directo (ni "confirmadas")', 'RECHAZO',
        () => adulto.c.from('wellness_appointments').insert({
            professional_id: proA.id, athlete_id: adulto.id, appointment_date: MANANA, appointment_time: '12:00',
            service_type: 'Fisioterapia', status: 'confirmed' }).select('id'));
    await caso('acudiente reserva para un menor ajeno', (d) => d === true,
        () => conError('MENOR_NO_ENCONTRADO')(adulto.c.rpc('request_service_appointment', {
            p_service_listing_id: sl.id, p_date: MANANA, p_time: '14:00', p_child_id: hijo.id })));
    await caso('profesional ve la solicitud en su agenda', (d) => d?.length === 1 && d[0].status === 'pending',
        () => proA.c.from('wellness_appointments').select('id, status, child_id').eq('id', citaId));
    await caso('otro profesional no ve la cita', 'RECHAZO',
        () => proB.c.from('wellness_appointments').select('id').eq('id', citaId));
    await caso('el profesional recibió aviso de la solicitud', (d) => d?.length >= 1,
        () => admin.from('notifications').select('id').eq('user_id', proA.id).eq('type', 'wellness_appointment'));
    await caso('profesional confirma la cita', 'OK',
        () => proA.c.from('wellness_appointments').update({ status: 'confirmed' }).eq('id', citaId).select('id').single());
    await caso('profesional no puede solapar otra cita en el mismo horario', (d) => d === true,
        () => conError('HORARIO_OCUPADO')(proA.c.from('wellness_appointments').insert({
            professional_id: proA.id, athlete_name: 'Externo', appointment_date: MANANA, appointment_time: '10:30',
            duration_minutes: 30, service_type: 'Control' })));

    const { data: pac } = await proA.c.from('clinical_patients').select('id, child_id, guardian_profile_id').eq('child_id', hijo.id).single();

    // ── Historia clínica y consentimiento ─────────────────────────────────────
    await caso('sin consentimiento no se abre episodio', (d) => d === true,
        () => conError('CONSENTIMIENTO_REQUERIDO')(proA.c.from('clinical_episodes').insert({
            professional_id: proA.id, patient_id: pac.id, reason: 'Dolor de rodilla' })));
    await caso('el resumen del acudiente muestra consentimientos pendientes', (d) => d?.[0]?.pending_consents?.length === 3,
        () => acudiente.c.rpc('get_my_health_summary'));
    await caso('un tercero no puede otorgar el consentimiento', (d) => d === true,
        () => conError('PACIENTE_NO_ENCONTRADO')(adulto.c.rpc('grant_clinical_consents', {
            p_patient_id: pac.id, p_types: ['datos_sensibles', 'tratamiento'] })));
    await caso('acudiente otorga los tres consentimientos', (d) => d === 3,
        () => acudiente.c.rpc('grant_clinical_consents', {
            p_patient_id: pac.id, p_types: ['datos_sensibles', 'tratamiento', 'compartir_disponibilidad'] }));
    const ep = await caso('con consentimiento, el profesional abre episodio', 'OK',
        () => proA.c.from('clinical_episodes').insert({ professional_id: proA.id, patient_id: pac.id, reason: 'Dolor de rodilla' }).select('id').single());
    const nota = await caso('profesional firma valoración inicial enlazada a la cita', (d) => d?.author_license === 'TP-PRUEBA-123',
        () => proA.c.from('clinical_notes').insert({
            professional_id: proA.id, patient_id: pac.id, episode_id: ep?.id, appointment_id: citaId,
            note_type: 'valoracion_inicial', subjective: 'Dolor al saltar', pain_before: 6 }).select('id, author_license').single());
    await caso('la nota enlazada completó la cita', (d) => d?.status === 'completed',
        () => proA.c.from('wellness_appointments').select('status').eq('id', citaId).single());
    await caso('nota firmada: no se edita', 'RECHAZO',
        () => proA.c.from('clinical_notes').update({ subjective: 'cambiado' }).eq('id', nota?.id).select('id'));
    await caso('nota firmada: no se borra', 'RECHAZO',
        () => proA.c.from('clinical_notes').delete().eq('id', nota?.id).select('id'));
    await caso('nota firmada: service_role tampoco la borra', (d) => d === true,
        () => conError('HISTORIA_CLINICA_INMUTABLE')(admin.from('clinical_notes').delete().eq('id', nota?.id)));
    await caso('corrección por nota aclaratoria', 'OK',
        () => proA.c.from('clinical_notes').insert({
            professional_id: proA.id, patient_id: pac.id, episode_id: ep?.id, note_type: 'nota_aclaratoria',
            addendum_of: nota?.id, addendum_reason: 'Error de digitación en EVA', assessment: 'EVA real 5/10' }).select('id').single());
    await caso('otro profesional no lee las notas', 'RECHAZO',
        () => proB.c.from('clinical_notes').select('id').eq('patient_id', pac.id));
    await caso('otro profesional no escribe en la historia ajena', 'RECHAZO',
        () => proB.c.from('clinical_notes').insert({
            professional_id: proB.id, patient_id: pac.id, episode_id: ep?.id, note_type: 'evolucion', subjective: 'x' }).select('id'));
    await caso('el acudiente no lee notas clínicas por REST', 'RECHAZO',
        () => acudiente.c.from('clinical_notes').select('id').eq('patient_id', pac.id));
    await caso('el resumen del acudiente trae el episodio y ninguna nota', (d) =>
        d?.[0]?.episodes?.length === 1 && !JSON.stringify(d).includes('Dolor al saltar'),
        () => acudiente.c.rpc('get_my_health_summary'));
    await caso('profesional no adopta un menor escribiendo child_id a mano', (d) => d === true,
        () => conError('VINCULO_SOLO_POR_INVITACION')(proB.c.from('clinical_patients').insert({
            professional_id: proB.id, full_name: 'Robado', child_id: hijo.id })));
    await caso('CIE-10 inválido rebota', 'RECHAZO',
        () => proA.c.from('clinical_diagnoses').insert({
            professional_id: proA.id, patient_id: pac.id, episode_id: ep?.id, cie10_code: 'rodilla', description: 'x' }).select('id'));
    await caso('diagnóstico CIE-10 válido', 'OK',
        () => proA.c.from('clinical_diagnoses').insert({
            professional_id: proA.id, patient_id: pac.id, episode_id: ep?.id, cie10_code: 'M76.5',
            description: 'Tendinitis rotuliana', kind: 'principal' }).select('id').single());

    // ── Lesión y disponibilidad ───────────────────────────────────────────────
    await caso('profesional registra lesión con restricción', 'OK',
        () => proA.c.from('athlete_injuries').insert({
            professional_id: proA.id, patient_id: pac.id, episode_id: ep?.id, body_region: 'rodilla', side: 'derecho',
            injury_type: 'tendinosa', occurred_on: MANANA.slice(0, 8) + '01', availability_status: 'restringido',
            rtp_stage: 'entrenamiento_modificado', restrictions: 'Sin saltos' }).select('id').single());
    await caso('coach de la escuela ve la disponibilidad, sin diagnóstico', (d) =>
        d?.length === 1 && d[0].availability_status === 'restringido' && d[0].restrictions === 'Sin saltos'
        && !JSON.stringify(d).includes('M76.5') && !JSON.stringify(d).includes('tendinosa'),
        () => coach.c.rpc('get_school_athlete_availability', { p_school_id: esc.id }));
    if (!enr) resultados.push({ nombre: '(montaje) inscripción del menor', paso: false, detalle: enrErr?.message ?? 'sin inscripción' });
    await caso('coach de otra escuela no ve nada de la escuela A', 'RECHAZO',
        () => coachAjeno.c.rpc('get_school_athlete_availability', { p_school_id: esc.id }));
    await caso('acudiente (no staff) no usa la vista de escuela', 'RECHAZO',
        () => acudiente.c.rpc('get_school_athlete_availability', { p_school_id: esc.id }));

    // ── Ejercicios ────────────────────────────────────────────────────────────
    const { data: ej } = await proA.c.from('exercise_library').select('id').is('professional_id', null).limit(1).single();
    const asig = await caso('profesional asigna ejercicio', 'OK',
        () => proA.c.from('exercise_assignments').insert({
            professional_id: proA.id, patient_id: pac.id, exercise_id: ej?.id, sets: 3, reps: 12 }).select('id').single());
    await caso('acudiente marca el ejercicio hecho hoy', 'OK',
        () => acudiente.c.rpc('log_exercise_done', { p_assignment_id: asig?.id }));
    await caso('un tercero no marca ejercicios ajenos', (d) => d === true,
        () => conError('EJERCICIO_NO_ENCONTRADO')(adulto.c.rpc('log_exercise_done', { p_assignment_id: asig?.id })));
    await caso('el profesional ve la adherencia', (d) => d?.length === 1,
        () => proA.c.from('exercise_logs').select('id').eq('assignment_id', asig?.id));

    // ── Invitación de un paciente externo (adulto) ────────────────────────────
    const ext = await caso('profesional crea paciente externo', 'OK',
        () => proA.c.from('clinical_patients').insert({ professional_id: proA.id, full_name: 'Adulto Externo' }).select('id').single());
    const invi = await caso('profesional genera invitación', (d) => !!d?.token,
        () => proA.c.rpc('create_clinical_invite', { p_patient_id: ext?.id }));
    await caso('aceptar sin los consentimientos obligatorios rebota', (d) => d === true,
        () => conError('CONSENTIMIENTOS_REQUERIDOS')(adulto.c.rpc('accept_clinical_invite', {
            p_token: invi?.token, p_child_id: null, p_types: ['datos_sensibles'] })));
    await caso('el adulto acepta la invitación', 'OK',
        () => adulto.c.rpc('accept_clinical_invite', {
            p_token: invi?.token, p_child_id: null, p_types: ['datos_sensibles', 'tratamiento'] }));
    await caso('la invitación no se reusa', (d) => d === true,
        () => conError('INVITACION_INVALIDA')(proB.c.rpc('accept_clinical_invite', {
            p_token: invi?.token, p_child_id: null, p_types: ['datos_sensibles', 'tratamiento'] })));
    await caso('el adulto ve su ficha en "Mi salud"', (d) => d?.some((p) => p.patient_id === ext?.id && p.is_self === true),
        () => adulto.c.rpc('get_my_health_summary'));

    // ── Adjuntos (bucket privado) ─────────────────────────────────────────────
    ruta = `${proA.id}/${pac.id}/prueba-${marca}.pdf`;
    await caso('profesional sube un adjunto a su carpeta', 'OK',
        () => proA.c.storage.from('clinical-files').upload(ruta, new Blob(['%PDF-1.4 prueba'], { type: 'application/pdf' })));
    await caso('otro profesional no firma URL del adjunto ajeno', 'RECHAZO',
        () => proB.c.storage.from('clinical-files').createSignedUrl(ruta, 60));
    await caso('nadie sube en la carpeta de otro profesional', 'RECHAZO',
        () => proB.c.storage.from('clinical-files').upload(`${proA.id}/x-${marca}.pdf`, new Blob(['x'], { type: 'application/pdf' })));

    // ── Anónimo y tablas congeladas ───────────────────────────────────────────
    for (const t of ['clinical_patients', 'clinical_notes', 'clinical_consents', 'athlete_injuries', 'wellness_appointments']) {
        await caso(`anónimo no lee ${t}`, 'RECHAZO', () => anon.from(t).select('id').limit(1));
    }
    await caso('health_records congelada: nadie inserta', 'RECHAZO',
        () => adulto.c.from('health_records').insert({ athlete_id: adulto.id, professional_id: proA.id, record_type: 'x' }).select('id'));

    // ── Cancelación del cliente ───────────────────────────────────────────────
    const cita2 = await caso('adulto reserva otra hora', (d) => typeof d === 'string',
        () => adulto.c.rpc('request_service_appointment', { p_service_listing_id: sl.id, p_date: MANANA, p_time: '16:00' }));
    await caso('un tercero no cancela la cita ajena', (d) => d === true,
        () => conError('CITA_NO_ENCONTRADA')(acudiente.c.rpc('cancel_my_appointment', { p_appointment_id: cita2 })));
    await caso('el adulto cancela su cita', 'OK',
        () => adulto.c.rpc('cancel_my_appointment', { p_appointment_id: cita2, p_reason: 'prueba' }));
} catch (e) {
    resultados.push({ nombre: '(montaje)', paso: false, detalle: e.message });
} finally {
    for (const id of inv.professionals) {
        const { error } = await admin.rpc('purge_clinical_test_data', { p_professional_id: id });
        if (error) console.warn(`purga ${id}: ${error.message}`);
    }
    if (ruta) await admin.storage.from('clinical-files').remove([ruta]).catch(() => {});
    for (const id of inv.enrollments) await admin.from('enrollments').delete().eq('id', id);
    for (const id of inv.children) await admin.from('children').delete().eq('id', id);
    for (const id of inv.teams) await admin.from('teams').delete().eq('id', id);
    if (proB) inv.vendors.push(...((await admin.from('vendor_profiles').select('id').eq('user_id', proB.id)).data ?? []).map((v) => v.id));
    for (const id of inv.vendors) {
        await admin.from('service_availability').delete().eq('vendor_profile_id', id);
        await admin.from('service_listings').delete().eq('vendor_profile_id', id);
        await admin.from('vendor_profiles').delete().eq('id', id);
    }
    for (const id of inv.members) await admin.from('school_members').delete().eq('id', id);
    for (const id of inv.schools) await admin.from('schools').delete().eq('id', id);
    for (const id of inv.users) {
        await admin.from('notifications').delete().eq('user_id', id);
        await admin.from('profiles').delete().eq('id', id);
        await admin.auth.admin.deleteUser(id);
    }
}

let fallos = 0;
for (const r of resultados) {
    if (!r.paso) fallos++;
    console.log(`${r.paso ? '✅' : '❌'} ${r.nombre} — ${r.detalle}`);
}
console.log(`\n${resultados.length - fallos}/${resultados.length} casos como se esperaba.`);
process.exit(fallos ? 1 : 0);
