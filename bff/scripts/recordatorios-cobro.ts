/**
 * Simulación de la cadencia de recordatorios de cobro por WhatsApp
 * (src/services/recordatorios-cobro.service.ts). NO ENVÍA NADA, no reserva,
 * no emite tokens: solo lee.
 *
 *   cd bff
 *   npx tsx scripts/recordatorios-cobro.ts --escuela <school_id>
 *   npx tsx scripts/recordatorios-cobro.ts --escuela <school_id> --dias 5   # hoy + 4 días siguientes
 *   npx tsx scripts/recordatorios-cobro.ts --escuela <school_id> --detalle  # lista los contactos (teléfono enmascarado)
 *
 * Para cada día dice: si es día hábil (el job solo corre L-V no festivos a las
 * 8:00 COT), cuántos recordatorios saldrían por escalón, cuántos cobros cubren
 * y por qué se descarta el resto. Los días siguientes se simulan con lo que hay
 * HOY en la base (sin los envíos de los días anteriores de la simulación).
 */

import 'dotenv/config';
import { planDeEscuela, sumarDias, ESCALONES } from '../src/services/recordatorios-cobro.service';
import { esDiaHabil } from '../src/services/estado-de-cuenta.service';
import { fechaColombia, enmascararNumero } from '../src/services/avisos-correo.service';

function arg(nombre: string): string | undefined {
    const i = process.argv.indexOf(nombre);
    return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
    const schoolId = arg('--escuela');
    if (!schoolId) throw new Error('Falta --escuela <school_id>');
    const dias = Math.max(1, Math.min(31, Number(arg('--dias') ?? 2)));
    const detalle = process.argv.includes('--detalle');
    const ahora = new Date();
    const hoy = fechaColombia(ahora);

    for (let i = 0; i < dias; i++) {
        const dia = sumarDias(hoy, i);
        const { plan, diag } = await planDeEscuela(schoolId, ahora, dia);
        if (i === 0) {
            console.log(JSON.stringify({
                escuela: diag.escuela,
                integracion_whatsapp: diag.integracion ?? 'ninguna (o más de una activa)',
                telefonos_con_optin: diag.telefonosConOptin,
                migracion_20261006101656: diag.migracionAplicada ? 'aplicada' : 'SIN APLICAR (el job no mandaría nada)',
                plantillas: diag.plantillas,
            }, null, 2));
        }
        const porEscalon: Record<string, { mensajes: number; cobros: number }> = {};
        for (const e of ESCALONES) porEscalon[e.concepto] = { mensajes: 0, cobros: 0 };
        for (const c of plan.contactos) {
            porEscalon[c.concepto].mensajes++;
            porEscalon[c.concepto].cobros += c.paymentIds.length;
        }
        const habil = esDiaHabil(new Date(`${dia}T13:00:00Z`));
        console.log(`\n=== ${dia}${i === 0 ? ' (hoy)' : ''} — ${habil ? 'día hábil: el job corre a las 8:00' : 'NO hábil: el job no corre'}`);
        console.log(`  cobros de mensualidad en ventana: ${diag.cobrosEnVentana} (duplicados excluidos: ${diag.duplicadosExcluidos})`);
        console.log(`  saldrían: ${habil ? plan.contactos.length : 0} mensaje(s)${habil ? '' : ` (el plan del día tendría ${plan.contactos.length})`}`);
        console.log(`  por escalón (mensajes/cobros): ${Object.entries(porEscalon).map(([k, v]) => `${k} ${v.mensajes}/${v.cobros}`).join(' · ')}`);
        console.log(`  descartes: ${Object.entries(plan.descartes).filter(([, n]) => n > 0).map(([k, n]) => `${k}=${n}`).join(' · ') || 'ninguno'}`);
        if (detalle) {
            for (const c of plan.contactos) {
                console.log(`  ${c.concepto.padEnd(19)} ${enmascararNumero(c.waId)}  ${c.datos.nombreContacto} → ${c.datos.nombreAtleta}  ${c.datos.monto}  (${c.paymentIds.length} cobro/s)`);
            }
        }
    }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e?.message || e); process.exit(1); });
