/**
 * Franjas de clase de cortesía desde los entrenamientos de una escuela.
 * La lógica vive en src/services/franjas-cortesia.service.ts (la misma que usa
 * el job diario de las 05:30 COT).
 *
 *   cd bff
 *   npx tsx scripts/franjas-cortesia.ts --escuela <school_id>                 # simulación: no escribe nada
 *   npx tsx scripts/franjas-cortesia.ts --escuela <school_id> --aplicar       # crea las franjas Y activa la opción
 *
 * Opciones:
 *   --semanas N           ventana en semanas (default 3).
 *   --incluir-festivos    también en festivos de Colombia (por defecto se omiten).
 *   --sin-activar         con --aplicar: crea las franjas pero NO prende
 *                         school_settings.courtesy_from_training (el job no
 *                         las mantendría al día).
 *
 * Con --aplicar exige la migración 20261006084303 aplicada (columna
 * generated_from_schedule + índice único); sin ella no escribe nada.
 *
 * Dynasty:
 *   npx tsx scripts/franjas-cortesia.ts --escuela 2d509571-3238-4c04-ac3f-6dfe20539226
 */

import 'dotenv/config';
import { supabase } from '../src/config/supabase';
import { sincronizarFranjasDeEscuela, type FranjaPlaneada } from '../src/services/franjas-cortesia.service';

function arg(nombre: string): string | undefined {
    const i = process.argv.indexOf(nombre);
    return i >= 0 ? process.argv[i + 1] : undefined;
}

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const legible = (f: FranjaPlaneada) => {
    const [y, m, d] = f.slot_date.split('-').map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
    return `${DIAS[dow]} ${f.slot_date} ${f.start_time}${f.end_time ? `-${f.end_time}` : ''}${f.location ? ` @ ${f.location}` : ''}`;
};

async function main() {
    const schoolId = arg('--escuela');
    if (!schoolId) throw new Error('Falta --escuela <school_id>');
    const semanas = Number(arg('--semanas') ?? 3);
    if (!Number.isInteger(semanas) || semanas < 1 || semanas > 12) throw new Error('--semanas debe ser un entero entre 1 y 12');
    const aplicar = process.argv.includes('--aplicar');
    const incluirFestivos = process.argv.includes('--incluir-festivos');
    const activar = aplicar && !process.argv.includes('--sin-activar');

    const r = await sincronizarFranjasDeEscuela(schoolId, { semanas, aplicar, incluirFestivos });

    console.log(`\n${aplicar ? 'APLICANDO' : 'SIMULACIÓN (no se escribe nada)'} — ${r.escuela}`);
    console.log(`Ventana: ${r.ventana.desde} → ${r.ventana.hasta} (excl.), ${semanas} semana(s)\n`);

    const porGrupo = new Map<string, FranjaPlaneada[]>();
    for (const f of r.plan.franjas) {
        if (!porGrupo.has(f.label)) porGrupo.set(f.label, []);
        porGrupo.get(f.label)!.push(f);
    }
    const nuevas = new Set(r.nuevas.map((f) => `${f.team_id}|${f.slot_date}|${f.start_time}`));
    console.log('Franjas por grupo (plan completo de la ventana):');
    for (const [label, fs] of [...porGrupo.entries()].sort()) {
        const faltan = fs.filter((f) => nuevas.has(`${f.team_id}|${f.slot_date}|${f.start_time}`)).length;
        console.log(`  • ${label}: ${fs.length} (${faltan} nuevas)`);
        for (const f of fs.slice(0, 3)) console.log(`      ${legible(f)}`);
        if (fs.length > 3) console.log(`      … y ${fs.length - 3} más`);
    }

    if (r.plan.excluidos.length) {
        console.log('\nEquipos excluidos:');
        for (const e of r.plan.excluidos) console.log(`  - ${e.equipo}: ${e.motivo}`);
    }
    if (r.plan.festivosOmitidos.length) {
        console.log(`\nOmitidas por festivo: ${r.plan.festivosOmitidos.length}`);
        for (const f of r.plan.festivosOmitidos) console.log(`  - ${f.fecha} ${f.label}`);
    }
    if (r.plan.choques.length) {
        console.log(`\nChoques (dos subgrupos a la misma hora; queda una franja): ${r.plan.choques.length}`);
        for (const c of r.plan.choques) console.log(`  - ${c.fecha} ${c.hora}: ${c.labels.join(' / ')}`);
    }

    console.log(`\nTotal plan: ${r.plan.franjas.length} · ya existían: ${r.yaExistian} · ${aplicar ? 'creadas' : 'se crearían'}: ${aplicar ? r.creadas : r.nuevas.length}` +
        (aplicar ? ` · duplicadas en carrera: ${r.duplicadasEnCarrera}` : '') +
        ` · ${aplicar ? 'cerradas' : 'se cerrarían'} (obsoletas sin reserva): ${r.cerradas}`);
    if (r.conservadasConReserva.length) {
        console.log(`Obsoletas CON reserva (quedan abiertas, avisar a la escuela): ${r.conservadasConReserva.length}`);
        for (const c of r.conservadasConReserva) console.log(`  - ${c.slot_date} ${c.start_time} ${c.label ?? ''}`);
    }
    if (r.errores.length) {
        console.log('\nErrores:');
        for (const e of r.errores) console.log(`  ! ${e}`);
    }

    if (activar && !r.errores.length) {
        // La opción la lee el job diario: sin ella, las franjas creadas hoy no
        // se renuevan y en 3 semanas el bot vuelve a no tener qué ofrecer.
        const { data, error } = await supabase.from('school_settings')
            .update({ courtesy_from_training: true })
            .eq('school_id', schoolId)
            .select('school_id');
        if (error) console.log(`\n! No se pudo activar courtesy_from_training: ${error.message}`);
        else if (!data?.length) console.log('\n! La escuela no tiene fila en school_settings: la opción NO quedó activa.');
        else console.log('\n✓ school_settings.courtesy_from_training = true (el job de las 05:30 COT mantiene la ventana).');
    } else if (!aplicar) {
        console.log('\nPara crear las franjas y activar la opción, repite con --aplicar.');
    }

    if (r.errores.length) process.exitCode = 1;
}

main().catch((e) => {
    console.error(e?.message ?? e);
    process.exit(1);
});
