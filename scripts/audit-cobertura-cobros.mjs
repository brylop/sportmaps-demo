// ============================================================================
// SportMaps — ¿a cada atleta se le cobró CADA mes que le corresponde? (READ-ONLY)
//
// El complemento del barrido de duplicados. Ese busca cobros DE MÁS; este busca
// los que FALTAN, y es la única forma de verificar que las reglas de cobro
// (mes de entrada, día de corte, gracia, cambio de plan) dan el resultado
// correcto: no se auditan las reglas, se audita el resultado.
//
// El método: para cada atleta con inscripción ACTIVA se construye la serie de
// meses que debería tener cobrados —desde su mes de entrada hasta el mes en
// curso— y se compara contra los cobros que existen de verdad.
//
//   FALTA      mes dentro de la vigencia SIN ningún cobro vivo
//              → entró y nadie le cobró ese mes (plata que no se facturó)
//   ANTERIOR   cobro de un mes ANTERIOR a su entrada
//              → le cobran un mes que no cursó
//   POSTERIOR  cobro de un mes que todavía no empieza (más allá del siguiente)
//              → mes adelantado sin que nadie lo haya pedido
//   DUPLICADO  2+ cobros vivos del mismo mes (lo que ya mide audit-cobros-duplicados)
//
// El mes de entrada sale de la inscripción ACTIVA, no de la primera: cuando hay
// cambio de plan la vieja queda 'cancelled' y su fecha ya no manda.
//
// PISO DE LA ESCUELA: una escuela que arrancó a cobrar en agosto no "debe"
// julio. Sin ese piso, todos los atletas viejos saldrían con meses faltantes
// que nunca existieron. Por defecto se toma el primer mes que la escuela tiene
// facturado; se puede fijar con --desde.
//
// LÍMITE CONOCIDO — cruzar siempre con el barrido de duplicados:
// si una persona tiene dos fichas, la gemela absorbida aparece «sin cobrar el
// mes» y eso es CORRECTO (se le cobra por la otra). En Dynasty, 11 de los 30
// faltantes eran fichas gemelas: $1.030.000 de los $3.820.000 no eran plata sin
// facturar. Este script no agrupa identidades a propósito —eso lo hace
// audit-cobros-duplicados.mjs— así que el número crudo se lee siempre junto al
// otro, cruzando por `subject_id`.
//
// Uso:
//   node scripts/audit-cobertura-cobros.mjs --school Dynasty
//   node scripts/audit-cobertura-cobros.mjs --school Dynasty --desde 2026-08
//   node scripts/audit-cobertura-cobros.mjs --school Dynasty --json cobertura.json
//   node scripts/audit-cobertura-cobros.mjs --school Dynasty --solo-faltas
//
// NO escribe nada. Lee con la service key de bff/.env.
// ============================================================================
import { writeFileSync } from 'node:fs';
import { conectar } from './lib/supabase-rest.mjs';

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };
const has = (n) => argv.includes(`--${n}`);
const wantSchool = (arg('school') || '').trim().toLowerCase() || null;
const desdeFlag = (arg('desde') || '').trim() || null;
const hoyFlag = (arg('hoy') || '').trim() || null;   // para reproducir un corte pasado
const soloFaltas = has('solo-faltas');
const jsonOut = arg('json');

const { proyecto, all } = conectar();

// Estado con obligación viva (mismo conjunto que los índices únicos de F0).
const VIVO = new Set(['pending', 'awaiting_approval', 'paid', 'partial', 'overdue', 'glosado']);
const PAGO = new Set(['paid', 'partial']);

const fmt = (n) => '$' + Number(n || 0).toLocaleString('es-CO');
const pad = (n) => String(n).padStart(2, '0');
const periodoDe = (p) => (
    p.period_year && p.period_month
        ? `${p.period_year}-${pad(p.period_month)}`
        : (p.due_date || '').slice(0, 7)
);
const mesDe = (fecha) => String(fecha || '').slice(0, 7);
const sigMes = (per) => {
    const [y, m] = per.split('-').map(Number);
    return m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
};
// Serie inclusiva de meses entre dos periodos 'YYYY-MM'.
const serieMeses = (desde, hasta) => {
    const out = [];
    let cur = desde;
    // Cota de seguridad: 120 meses. Si se pasa, algo viene con basura.
    for (let i = 0; cur <= hasta && i < 120; i++) { out.push(cur); cur = sigMes(cur); }
    return out;
};
// Matrícula/uniforme/torneo no cuentan como mensualidad de un mes.
const esUnicaVez = (c) => /matricul|inscripcion|uniforme|torneo|examen|carnet|kit|implement|multa|sancion/
    .test(String(c || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());

const hoy = hoyFlag || new Date().toISOString().slice(0, 10);
const mesActual = mesDe(hoy);

console.log('='.repeat(78));
console.log('Proyecto :', proyecto);
console.log('Barrido  : ¿se le cobró a cada atleta cada mes que le toca? (READ-ONLY)');
console.log('Mes en curso:', mesActual, hoyFlag ? '(forzado con --hoy)' : '');
console.log('='.repeat(78));

const [schools, kids, uas, profs, members, enrs, pays] = await Promise.all([
    all('schools', 'id,name'),
    all('children', 'id,school_id,full_name,is_active'),
    all('unregistered_athletes', 'id,school_id,full_name,is_active,linked_profile_id'),
    all('profiles', 'id,full_name'),
    all('school_members', 'id,profile_id,school_id,role,status'),
    all('enrollments', 'id,school_id,user_id,child_id,unregistered_athlete_id,team_id,offering_plan_id,status,monthly_fee,start_date,created_at'),
    all('payments', 'id,school_id,user_id,child_id,unregistered_athlete_id,status,amount,concept,due_date,period_year,period_month,created_at'),
]);
const schoolName = new Map(schools.map((s) => [s.id, s.name]));
const enEscuela = (sid) => !wantSchool || String(schoolName.get(sid) || sid).toLowerCase().includes(wantSchool);
const nombre = new Map([
    ...kids.map((c) => [c.id, c.full_name]),
    ...uas.map((u) => [u.id, u.full_name]),
    ...profs.map((p) => [p.id, p.full_name]),
]);
console.log(`\nCargado: ${enrs.length} inscripciones · ${pays.length} cobros`);

// ── cobros vivos por sujeto y periodo ───────────────────────────────────────
const sujetoPago = (p) => p.child_id || p.unregistered_athlete_id || p.user_id || null;
const cobrosPorSujeto = new Map();   // sujeto → Map<periodo, cobros[]>
for (const p of pays) {
    if (!VIVO.has(p.status) || !enEscuela(p.school_id)) continue;
    if (esUnicaVez(p.concept)) continue;
    const s = sujetoPago(p);
    const per = periodoDe(p);
    if (!s || !per) continue;
    if (!cobrosPorSujeto.has(s)) cobrosPorSujeto.set(s, new Map());
    const m = cobrosPorSujeto.get(s);
    if (!m.has(per)) m.set(per, []);
    m.get(per).push(p);
}

// ── piso por escuela: el primer mes que esa escuela facturó DE VERDAD ───────
// El mínimo a secas no sirve: basta un puñado de cobros viejos cargados a mano
// para arrastrar la expectativa de toda la escuela a un mes que nunca facturó.
// Medido en Dynasty: 6 cobros de julio contra 452 atletas activos hacían que
// 344 aparecieran «sin cobrar julio» — falso, julio nunca se facturó ahí.
//
// Se toma el primer mes en que la escuela le cobró al menos al 25 % de su
// plantel activo: eso distingue «acá arrancó la facturación» de «acá hubo
// cuatro excepciones».
const UMBRAL_PISO = 0.25;
const activosPorEscuela = new Map();
for (const e of enrs) {
    if (e.status !== 'active') continue;
    const s = e.child_id || e.unregistered_athlete_id || e.user_id;
    if (!s) continue;
    if (!activosPorEscuela.has(e.school_id)) activosPorEscuela.set(e.school_id, new Set());
    activosPorEscuela.get(e.school_id).add(s);
}
const sujetosPorEscuelaMes = new Map();   // escuela|periodo → Set<sujeto>
for (const p of pays) {
    if (!VIVO.has(p.status)) continue;
    const per = periodoDe(p);
    const s = sujetoPago(p);
    if (!per || !s) continue;
    const k = `${p.school_id}|${per}`;
    if (!sujetosPorEscuelaMes.has(k)) sujetosPorEscuelaMes.set(k, new Set());
    sujetosPorEscuelaMes.get(k).add(s);
}
const pisoEscuela = new Map();
for (const [sid, activos] of activosPorEscuela) {
    const minimo = Math.max(1, Math.floor(activos.size * UMBRAL_PISO));
    const meses = [...sujetosPorEscuelaMes]
        .filter(([k, v]) => k.startsWith(`${sid}|`) && v.size >= minimo)
        .map(([k]) => k.split('|')[1])
        .sort();
    if (meses.length) pisoEscuela.set(sid, meses[0]);
}

// ── atletas con inscripción activa ──────────────────────────────────────────
const sujetoEnr = (e) => e.child_id || e.unregistered_athlete_id || e.user_id || null;
const activasPorSujeto = new Map();
for (const e of enrs) {
    if (e.status !== 'active' || !enEscuela(e.school_id)) continue;
    const s = sujetoEnr(e);
    if (!s) continue;
    if (!activasPorSujeto.has(s)) activasPorSujeto.set(s, []);
    activasPorSujeto.get(s).push(e);
}

const filas = [];
for (const [subj, activas] of activasPorSujeto) {
    const sid = activas[0].school_id;
    const piso = desdeFlag || pisoEscuela.get(sid) || mesActual;
    // Mes de entrada: el más TEMPRANO entre las inscripciones activas, porque un
    // atleta con dos categorías tiene dos filas y la vigencia arranca en la
    // primera. `start_date` puede venir vacío → cae a created_at.
    const entrada = activas
        .map((e) => mesDe(e.start_date || e.created_at))
        .filter(Boolean)
        .sort()[0];
    if (!entrada) continue;

    const desde = entrada > piso ? entrada : piso;
    if (desde > mesActual) continue;                 // alta programada a futuro
    const esperados = serieMeses(desde, mesActual);
    const cobros = cobrosPorSujeto.get(subj) || new Map();

    const faltan = esperados.filter((per) => !cobros.has(per));
    const duplicados = [...cobros].filter(([, v]) => v.length > 1).map(([k]) => k);
    const anteriores = [...cobros.keys()].filter((per) => per < entrada);
    // Sobra sólo lo que va MÁS ALLÁ del mes siguiente: el mes próximo es normal
    // (se factura por anticipado y hay prepagos legítimos).
    const limiteFuturo = sigMes(mesActual);
    const posteriores = [...cobros.keys()].filter((per) => per > limiteFuturo);

    if (!faltan.length && !duplicados.length && !anteriores.length && !posteriores.length) continue;

    const cuota = activas.map((e) => e.monthly_fee).find((v) => v != null) ?? null;
    filas.push({
        school_id: sid, school: schoolName.get(sid) || sid,
        subject_id: subj, nombre: nombre.get(subj) || subj,
        entrada, piso, desde, cuota,
        inscripciones_activas: activas.length,
        faltan, duplicados, anteriores, posteriores,
        // Lo no facturado se estima con la cuota vigente; sin cuota no se puede.
        no_facturado: cuota ? faltan.length * Number(cuota) : 0,
        detalle: [...cobros].sort().map(([per, v]) => ({
            periodo: per,
            estados: v.map((x) => x.status),
            montos: v.map((x) => Number(x.amount || 0)),
            pagado: v.some((x) => PAGO.has(x.status)),
        })),
    });
}

// ── salida ──────────────────────────────────────────────────────────────────
filas.sort((a, b) => b.faltan.length - a.faltan.length || b.no_facturado - a.no_facturado);

const totFaltan = filas.reduce((a, f) => a + f.faltan.length, 0);
const totPlata = filas.reduce((a, f) => a + f.no_facturado, 0);

console.log(`\n${'='.repeat(78)}`);
console.log('RESUMEN');
console.log('='.repeat(78));
console.log(`  Atletas activos revisados                     : ${activasPorSujeto.size}`);
console.log(`  Atletas con algo que no cuadra                 : ${filas.length}`);
console.log(`  ─────────────────────────────────────────────`);
console.log(`  🔴 meses SIN cobrar (entró y nadie le facturó) : ${totFaltan} en ${filas.filter((f) => f.faltan.length).length} atletas`);
console.log(`     estimado no facturado                      : ${fmt(totPlata)}`);
console.log(`  🟠 cobros de un mes ANTERIOR a su entrada      : ${filas.filter((f) => f.anteriores.length).length} atletas`);
console.log(`  🟡 cobros más allá del mes siguiente           : ${filas.filter((f) => f.posteriores.length).length} atletas`);
console.log(`  💥 meses con 2+ cobros vivos                   : ${filas.filter((f) => f.duplicados.length).length} atletas`);
if (totFaltan) {
    console.log('\n  ⚠️  Antes de perseguir esa plata, cruzar con los duplicados: la ficha');
    console.log('      gemela de una persona repetida sale «sin cobrar» y está BIEN así.');
    console.log('        node scripts/audit-cobros-duplicados.mjs --school <escuela> --json d.json');
    console.log('      y descartar los subject_id que aparezcan en los ejes B y C.');
}

if (filas.length) {
    console.log(`\n${'-'.repeat(78)}`);
    console.log('DETALLE');
    console.log('-'.repeat(78));
    for (const f of filas) {
        if (soloFaltas && !f.faltan.length) continue;
        console.log(`\n${f.faltan.length ? '🔴' : '🟠'} ${f.nombre}  ·  ${f.school}`);
        console.log(`   entró ${f.entrada} · se revisa desde ${f.desde} (piso de la escuela ${f.piso}) · cuota ${f.cuota ?? '—'}`);
        if (f.inscripciones_activas > 1) console.log(`   ⚠️  ${f.inscripciones_activas} inscripciones activas`);
        if (f.faltan.length) console.log(`   🔴 SIN COBRO: ${f.faltan.join(', ')}${f.no_facturado ? `  → ${fmt(f.no_facturado)} sin facturar` : ''}`);
        if (f.anteriores.length) console.log(`   🟠 cobros de meses que no cursó: ${f.anteriores.join(', ')}`);
        if (f.posteriores.length) console.log(`   🟡 cobros muy adelantados: ${f.posteriores.join(', ')}`);
        if (f.duplicados.length) console.log(`   💥 meses duplicados: ${f.duplicados.join(', ')}`);
        const linea = f.detalle.map((d) => `${d.periodo}${d.pagado ? '✓' : ''}${d.estados.length > 1 ? `×${d.estados.length}` : ''}`).join('  ');
        console.log(`   cobros: ${linea || '(ninguno)'}`);
    }
}

if (!filas.length) console.log('\n✅ Todos los atletas activos tienen cobrado cada mes de su vigencia, sin meses de más.');

if (jsonOut) {
    writeFileSync(jsonOut, JSON.stringify({
        mes_actual: mesActual,
        escuela: wantSchool || 'todas',
        totales: { atletas_revisados: activasPorSujeto.size, con_hallazgos: filas.length, meses_sin_cobrar: totFaltan, estimado_no_facturado: totPlata },
        atletas: filas,
    }, null, 2));
    console.log(`\nJSON → ${jsonOut}`);
}
console.log('\n(READ-ONLY: este script no escribió nada.)');
