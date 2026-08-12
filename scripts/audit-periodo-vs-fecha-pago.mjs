// ============================================================================
// SportMaps — ¿el mes rotulado corresponde a la fecha en que se pagó? (READ-ONLY)
//
// Genera la lista para revisar CON LA ESCUELA. La pregunta que contesta, cobro
// por cobro: «se pagó tal día; el mes que dice cubrir, ¿es el correcto?».
//
// Por qué hace falta: el periodo de un cobro no lo pone el pago, lo pone quien
// crea el cobro. En los registros MANUALES la escuela teclea el mes, y ahí es
// donde se cuela el error — un pago recibido en agosto rotulado a julio deja
// agosto sin facturar y a la familia con un cobro que parece deuda vieja.
//
// El método NO es un detalle, decide cuánto se puede confiar en la fila:
//   · manual (transferencia / efectivo): la fecha y el mes los puso una persona
//     → hay que CONFIRMAR con la escuela qué mes cubre ese pago.
//   · pasarela (online, con id de transacción): la fecha viene del proveedor y
//     es confiable → si el mes no coincide con la fecha, el rótulo está mal.
//
// OJO con `payment_provider`: se creó con DEFAULT 'wompi', así que TODAS las
// filas dicen wompi y el campo no distingue nada (DIN-3 del roadmap). Para
// separar manual de pasarela se usa `payment_channel` + el id de transacción.
//
// Veredictos:
//   COINCIDE     el mes rotulado es el mes en que se pagó
//   ANTERIOR     el mes rotulado es ANTERIOR al pago → ¿pago atrasado real, o
//                mes mal tecleado? Es el que hay que confirmar
//   ADELANTADO   el mes rotulado es POSTERIOR al pago → prepago; legítimo si la
//                familia lo pidió, sospechoso si nadie lo pidió
//
// Y por cada fila se dice si el MES EN QUE SE PAGÓ quedó cubierto por algún
// cobro: si un pago de agosto está rotulado a julio y no hay cobro de agosto,
// ese mes no se facturó nunca.
//
// Uso:
//   node scripts/audit-periodo-vs-fecha-pago.mjs --school Dynasty
//   node scripts/audit-periodo-vs-fecha-pago.mjs --school Dynasty --csv revisar.csv
//   node scripts/audit-periodo-vs-fecha-pago.mjs --school Dynasty --solo-revisar
//
// NO escribe en la base. El CSV es para mandárselo a la escuela.
// ============================================================================
import { writeFileSync } from 'node:fs';
import { conectar } from './lib/supabase-rest.mjs';

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };
const has = (n) => argv.includes(`--${n}`);
const wantSchool = (arg('school') || '').trim().toLowerCase() || null;
const csvOut = arg('csv');
const soloRevisar = has('solo-revisar');

const { proyecto, all } = conectar();

const VIVO = new Set(['pending', 'awaiting_approval', 'paid', 'partial', 'overdue', 'glosado']);
const PAGADO = new Set(['paid', 'partial']);
const pad = (n) => String(n).padStart(2, '0');
const fmt = (n) => '$' + Number(n || 0).toLocaleString('es-CO');
const mes = (f) => String(f || '').slice(0, 7);
const periodoDe = (p) => (p.period_year && p.period_month ? `${p.period_year}-${pad(p.period_month)}` : null);
const sujetoDe = (p) => p.child_id || p.unregistered_athlete_id || p.user_id || null;

console.log('='.repeat(78));
console.log('Proyecto :', proyecto);
console.log('Barrido  : ¿el mes rotulado corresponde a la fecha de pago? (READ-ONLY)');
console.log('='.repeat(78));

const [schools, kids, uas, profs, pays] = await Promise.all([
    all('schools', 'id,name'),
    all('children', 'id,school_id,full_name,doc_number'),
    all('unregistered_athletes', 'id,school_id,full_name,doc_number'),
    all('profiles', 'id,full_name'),
    all('payments', 'id,school_id,user_id,child_id,unregistered_athlete_id,status,amount,amount_paid,concept,due_date,payment_date,period_year,period_month,payment_method,payment_channel,receipt_url,wompi_transaction_id,provider_transaction_id,approved_by,created_at'),
]);
const schoolName = new Map(schools.map((s) => [s.id, s.name]));
const enEscuela = (sid) => !wantSchool || String(schoolName.get(sid) || sid).toLowerCase().includes(wantSchool);
const info = new Map([
    ...kids.map((c) => [c.id, { nombre: c.full_name, doc: c.doc_number }]),
    ...uas.map((u) => [u.id, { nombre: u.full_name, doc: u.doc_number }]),
    ...profs.map((p) => [p.id, { nombre: p.full_name, doc: null }]),
]);

// Meses que cada atleta tiene cubiertos por algún cobro vivo.
const cubiertos = new Map();   // sujeto → Set<periodo>
for (const p of pays) {
    if (!VIVO.has(p.status) || !enEscuela(p.school_id)) continue;
    const s = sujetoDe(p);
    const per = periodoDe(p) || mes(p.due_date);
    if (!s || !per) continue;
    if (!cubiertos.has(s)) cubiertos.set(s, new Set());
    cubiertos.get(s).add(per);
}

const filas = [];
for (const p of pays) {
    if (!enEscuela(p.school_id) || !PAGADO.has(p.status)) continue;
    if (!p.payment_date) continue;
    const s = sujetoDe(p);
    if (!s) continue;
    const mesPago = mes(p.payment_date);
    const per = periodoDe(p);
    // Un pagado sin periodo poblado no se puede juzgar: se reporta aparte.
    const esPasarela = !!(p.wompi_transaction_id || p.provider_transaction_id) || p.payment_channel === 'online';
    const metodo = esPasarela ? 'pasarela' : (p.payment_channel || p.payment_method || 'manual');

    let veredicto;
    if (!per) veredicto = 'SIN PERIODO';
    else if (per === mesPago) veredicto = 'COINCIDE';
    else if (per < mesPago) veredicto = 'ANTERIOR';
    else veredicto = 'ADELANTADO';

    const mesPagoCubierto = (cubiertos.get(s) || new Set()).has(mesPago);
    filas.push({
        school: schoolName.get(p.school_id) || p.school_id,
        subject_id: s,
        nombre: info.get(s)?.nombre || s,
        doc: info.get(s)?.doc || '',
        metodo,
        esPasarela,
        fecha_pago: String(p.payment_date).slice(0, 10),
        mes_pago: mesPago,
        periodo: per || '(vacío)',
        monto: Number(p.amount_paid ?? p.amount ?? 0),
        veredicto,
        // Si el mes en que pagó NO tiene cobro, ese mes no se facturó.
        mes_pago_cubierto: mesPagoCubierto,
        comprobante: !!p.receipt_url,
        payment_id: p.id,
        concepto: p.concept || '',
    });
}

const orden = { ANTERIOR: 0, 'SIN PERIODO': 1, ADELANTADO: 2, COINCIDE: 3 };
filas.sort((a, b) => orden[a.veredicto] - orden[b.veredicto]
    || Number(a.mes_pago_cubierto) - Number(b.mes_pago_cubierto)
    || String(a.nombre).localeCompare(String(b.nombre)));

const cuenta = (v, f = () => true) => filas.filter((x) => x.veredicto === v && f(x)).length;
console.log(`\n${'='.repeat(78)}`);
console.log(`RESUMEN — ${filas.length} pagos con fecha, en ${new Set(filas.map((f) => f.subject_id)).size} atletas`);
console.log('='.repeat(78));
console.log(`  ✅ COINCIDE   (mes rotulado = mes del pago)      : ${cuenta('COINCIDE')}`);
console.log(`  🔴 ANTERIOR   (rotulado a un mes ya pasado)      : ${cuenta('ANTERIOR')}`);
console.log(`       de esos, manuales (la escuela puso el mes)  : ${cuenta('ANTERIOR', (x) => !x.esPasarela)}  ← CONFIRMAR CON LA ESCUELA`);
console.log(`       de esos, por pasarela (fecha confiable)     : ${cuenta('ANTERIOR', (x) => x.esPasarela)}  ← el rótulo está mal`);
console.log(`       y el mes del pago quedó SIN cobro           : ${cuenta('ANTERIOR', (x) => !x.mes_pago_cubierto)}  ← ese mes no se facturó`);
console.log(`  🟡 ADELANTADO (rotulado a un mes futuro)         : ${cuenta('ADELANTADO')}`);
console.log(`       y el mes del pago quedó SIN cobro           : ${cuenta('ADELANTADO', (x) => !x.mes_pago_cubierto)}`);
console.log(`  ⚪ SIN PERIODO (no se puede juzgar)              : ${cuenta('SIN PERIODO')}`);

const porMetodo = {};
for (const f of filas) porMetodo[f.metodo] = (porMetodo[f.metodo] || 0) + 1;
console.log(`\n  por método: ${Object.entries(porMetodo).map(([k, v]) => `${k}=${v}`).join(' · ')}`);

console.log(`\n${'-'.repeat(78)}`);
console.log('A REVISAR CON LA ESCUELA');
console.log('-'.repeat(78));
console.log('Pregunta por fila: «este pago del <fecha>, ¿qué mes cubre?»\n');
for (const f of filas) {
    if (f.veredicto === 'COINCIDE' && soloRevisar) continue;
    if (f.veredicto === 'COINCIDE') continue;
    const marca = f.veredicto === 'ANTERIOR' ? (f.esPasarela ? '🔴' : '🟠') : f.veredicto === 'ADELANTADO' ? '🟡' : '⚪';
    console.log(`${marca} ${String(f.nombre).slice(0, 34).padEnd(36)} pagó ${f.fecha_pago} (${f.metodo})  ${fmt(f.monto)}`);
    console.log(`     rotulado a ${f.periodo}  ·  el pago es de ${f.mes_pago}  ·  ${f.veredicto}`);
    console.log(`     ${f.mes_pago_cubierto ? `${f.mes_pago} sí tiene cobro` : `⚠️ ${f.mes_pago} NO tiene ningún cobro → ese mes no se facturó`}`);
    console.log(`     ${f.comprobante ? '📎 con comprobante' : 'sin comprobante'}  ·  ${f.concepto.slice(0, 48)}`);
    console.log(`     id=${f.payment_id}`);
}

if (csvOut) {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const cab = ['escuela', 'atleta', 'documento', 'metodo', 'fecha_de_pago', 'mes_del_pago',
        'mes_rotulado', 'monto', 'veredicto', 'mes_del_pago_tiene_cobro', 'tiene_comprobante',
        'que_mes_cubre_ESCUELA_RESPONDE', 'concepto', 'payment_id'];
    const lineas = [cab.join(',')];
    for (const f of filas) {
        lineas.push([
            f.school, f.nombre, f.doc, f.metodo, f.fecha_pago, f.mes_pago, f.periodo, f.monto,
            f.veredicto, f.mes_pago_cubierto ? 'sí' : 'NO', f.comprobante ? 'sí' : 'no',
            '', // columna vacía para que la escuela escriba la respuesta
            f.concepto, f.payment_id,
        ].map(esc).join(','));
    }
    // BOM para que Excel en español abra los acentos bien.
    writeFileSync(csvOut, '﻿' + lineas.join('\r\n'));
    console.log(`\nCSV → ${csvOut}  (${filas.length} filas; la columna «que_mes_cubre_ESCUELA_RESPONDE» va vacía a propósito)`);
}
console.log('\n(READ-ONLY: este script no escribió nada en la base.)');
