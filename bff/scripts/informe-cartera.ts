/**
 * Informe de cartera — SIMULACIÓN. Arma el informe de una escuela con los
 * datos reales y muestra los totales. NO manda ningún correo ni escribe en la
 * base (solo SELECT). La lógica vive en src/services/informe-cartera.service.ts,
 * la misma que usa el envío semanal (lunes 7:00 COT).
 *
 *   cd bff
 *   npx tsx scripts/informe-cartera.ts --escuela <school_id>
 *   npx tsx scripts/informe-cartera.ts --escuela <school_id> --csv salida.csv   # CSV completo (con nombres)
 *   npx tsx scripts/informe-cartera.ts --escuela <school_id> --html salida.html # el correo tal cual saldría
 *
 * Por defecto imprime SOLO agregados (sin nombres de atletas ni familias): se
 * puede pegar en un reporte sin exponer menores.
 */

import 'dotenv/config';
import { writeFileSync } from 'fs';
import {
    armarInformeCartera, asuntoInforme, etiquetaMes, fmtCop, htmlInforme, informeACsv, informeVacio, leerAjusteInforme,
} from '../src/services/informe-cartera.service';
import { destinatariosDeEscuela } from '../src/services/avisos-correo.service';

function arg(nombre: string): string | undefined {
    const i = process.argv.indexOf(nombre);
    return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
    const schoolId = arg('--escuela');
    if (!schoolId) throw new Error('Falta --escuela <school_id>');

    const [informe, ajuste, dest] = await Promise.all([
        armarInformeCartera(schoolId),
        leerAjusteInforme(schoolId),
        destinatariosDeEscuela(schoolId),
    ]);
    const m = informe.morosos;
    const pe = informe.pendientes;
    const ina = informe.inactivos;

    console.log(JSON.stringify({
        modo: 'SIMULACION (no se envía nada)',
        escuela: informe.escuela,
        fecha: informe.hoy,
        asunto: asuntoInforme(informe),
        informe_semanal_activo: ajuste.activo,
        ajuste_explicito: ajuste.explicito,
        cancelacion_automatica: ajuste.cancelacionAutomatica,
        columna_ajuste_aplicada: ajuste.columnaDisponible,
        destinatarios: dest.correos.length,
        se_enviaria: ajuste.activo && !informeVacio(informe) && dest.correos.length > 0,
        morosos: {
            familias: m.familias,
            atletas: m.atletas,
            cobros_vencidos: m.cobros,
            total: fmtCop(m.total),
            mensualidades: fmtCop(m.mensualidades),
            otros: fmtCop(m.otros),
            por_mes: m.porMes.map((x) => ({ mes: etiquetaMes(x.mes), cobros: x.cobros, total: fmtCop(x.total) })),
            por_antiguedad: m.porAntiguedad.map((x) => ({ tramo: x.tramo, cobros: x.cobros, total: fmtCop(x.total) })),
            familias_por_meses_adeudados: m.filas.reduce((acc, f) => {
                const k = f.meses >= 4 ? '4+' : String(f.meses);
                acc[k] = (acc[k] ?? 0) + 1;
                return acc;
            }, {} as Record<string, number>),
            top20_suma: fmtCop(m.filas.slice(0, 20).reduce((s, f) => s + f.total, 0)),
            mayor_deuda_familia: fmtCop(m.filas[0]?.total ?? 0),
            max_dias_mora: m.filas.reduce((s, f) => Math.max(s, f.diasMora), 0),
        },
        pendientes: {
            por_vencer_mes_en_curso: { cobros: pe.porVencer.length, familias: pe.porVencerFamilias, total: fmtCop(pe.porVencerTotal) },
            comprobantes_en_revision: { cobros: pe.enRevision.length, total: fmtCop(pe.enRevisionTotal) },
        },
        inactivos: {
            dias_ventana: ina.dias,
            hay_asistencia_en_ventana: ina.conDatos,
            activos_sin_asistencia: ina.sinAsistencia.length,
            nunca_registrados_presentes: ina.sinAsistencia.filter((a) => !a.ultimaAsistencia).length,
            bajas_recientes_con_saldo: { atletas: ina.bajasConSaldo.length, saldo: fmtCop(ina.bajasConSaldoTotal) },
            bajas_antiguas_con_saldo: { atletas: ina.bajasAntiguas.atletas, saldo: fmtCop(ina.bajasAntiguas.saldo) },
        },
        excluidos: { cobros_duplicados: informe.excluidos.duplicados },
    }, null, 2));

    const csv = arg('--csv');
    if (csv) { writeFileSync(csv, informeACsv(informe), 'utf8'); console.log(`CSV completo en ${csv}`); }
    const html = arg('--html');
    if (html) { writeFileSync(html, htmlInforme(informe), 'utf8'); console.log(`HTML del correo en ${html}`); }
}

main().catch((e) => { console.error(e?.message || e); process.exit(1); });
