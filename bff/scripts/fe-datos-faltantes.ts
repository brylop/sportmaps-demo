/**
 * Lista de datos que faltan para poder facturar electrónicamente.
 *
 *   cd bff
 *   npx tsx scripts/fe-datos-faltantes.ts "DYNASTY"
 *   npx tsx scripts/fe-datos-faltantes.ts "DYNASTY" C:/tmp/salida.csv
 *
 * POR QUÉ
 *
 * La factura electrónica se emite contra el PAGADOR del cobro y necesita su
 * documento. Sin pagador o sin documento, el motor corta con
 * `payment_without_payer` o `customer_missing_fiscal_data` y ese pago no se
 * puede facturar nunca — no es que falle y reintente: no hay a quién facturarle.
 *
 * Medido en Dynasty el 2026-09-17: 123 de 514 pagos cobrados ($19,5M) están en
 * ese estado. 117 son de ANTES del 2026-09-10, que es cuando se agregó el
 * chequeo de datos DIAN al registro manual de pagos; los 6 posteriores existen
 * porque ese chequeo AVISA pero no bloquea.
 *
 * Los 23 pagos que pasaron por la pasarela (PSE y tarjeta) tienen el 100% de
 * los datos. El hueco está donde la escuela registra a mano.
 *
 * Sale en CSV para que la escuela lo abra en Excel, complete la columna del
 * documento y lo devuelva. Pedirle 46 cédulas por WhatsApp no funciona.
 */

import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import { supabase } from '../src/config/supabase';

const nombreEscuela = process.argv[2];
const salida = process.argv[3];

/** Escapa un campo para CSV: comillas dobles y separadores rompen la columna. */
function csv(valor: unknown): string {
    const s = String(valor ?? '');
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
    if (!nombreEscuela) {
        console.error('Uso: npx tsx scripts/fe-datos-faltantes.ts "<parte del nombre>" [archivo.csv]');
        process.exit(1);
    }

    const { data: escuelas } = await supabase
        .from('schools').select('id, name').ilike('name', `%${nombreEscuela}%`);

    if (!escuelas?.length) { console.error(`No encontré ninguna escuela con «${nombreEscuela}».`); process.exit(1); }
    if (escuelas.length > 1) {
        console.error(`«${nombreEscuela}» coincide con varias. Sé más específico:`);
        for (const e of escuelas) console.error(`  · ${e.name}`);
        process.exit(1);
    }
    const escuela = escuelas[0] as { id: string; name: string };

    // Todos los pagos COBRADOS, con su pagador y los datos fiscales de ese
    // pagador. El estado importa: facturar un pago pendiente emitiría un
    // documento fiscal con número de la resolución DIAN, que no se recupera.
    const { data: pagos } = await supabase
        .from('payments')
        .select('id, amount, concept, payment_method, payment_date, parent_id, user_id')
        .eq('school_id', escuela.id)
        .eq('status', 'paid')
        .limit(5000);

    const filas = pagos ?? [];
    const payerIds = [...new Set(filas.map((p: any) => p.parent_id || p.user_id).filter(Boolean))];

    const { data: perfiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, document_type, document_number, billing_address, billing_city_dane')
        .in('id', payerIds);

    const porId = new Map((perfiles ?? []).map((p: any) => [p.id, p]));

    // Los atletas de cada acudiente, para que la escuela reconozca de quién se
    // trata: el nombre del papá muchas veces no le dice nada, el del hijo sí.
    const { data: hijos } = await supabase
        .from('children').select('parent_id, full_name')
        .eq('school_id', escuela.id).in('parent_id', payerIds);

    const atletasDe = new Map<string, string[]>();
    for (const h of (hijos ?? []) as any[]) {
        if (!h.parent_id) continue;
        atletasDe.set(h.parent_id, [...(atletasDe.get(h.parent_id) ?? []), h.full_name]);
    }

    const vacio = (v: unknown) => String(v ?? '').trim() === '';

    interface Pendiente {
        acudiente: string; email: string; telefono: string; atletas: string;
        falta: string; pagos: number; monto: number;
    }
    const porAcudiente = new Map<string, Pendiente>();
    const sinCiudad = new Set<string>();
    const sinPagador: { concept: string; monto: number; fecha: string; metodo: string }[] = [];

    for (const p of filas as any[]) {
        const payerId = p.parent_id || p.user_id;

        // Sin pagador no hay a quién facturarle, y tampoco a quién preguntarle:
        // va en su propia lista, identificada por el concepto del cobro.
        if (!payerId) {
            sinPagador.push({
                concept: p.concept ?? '(sin concepto)',
                monto: Number(p.amount) || 0,
                fecha: p.payment_date ?? '',
                metodo: p.payment_method ?? '',
            });
            continue;
        }

        const pr: any = porId.get(payerId);
        // SOLO lo que impide emitir. El municipio se cuenta aparte a proposito:
        // no bloquea (hay una politica de respaldo que usa el de la escuela) y
        // meterlo aca convertia la lista de 46 acudientes en una de 265, que
        // nadie persigue. Una lista que no se puede trabajar no sirve.
        const faltan: string[] = [];
        if (vacio(pr?.document_number)) faltan.push('documento');
        if (vacio(pr?.billing_address)) faltan.push('direccion');

        if (!/^[0-9]{5}$/.test(String(pr?.billing_city_dane ?? '').trim())) sinCiudad.add(payerId);
        if (!faltan.length) continue;

        const ya = porAcudiente.get(payerId);
        if (ya) { ya.pagos++; ya.monto += Number(p.amount) || 0; continue; }

        porAcudiente.set(payerId, {
            acudiente: pr?.full_name ?? '(sin nombre)',
            email: pr?.email ?? '',
            telefono: pr?.phone ?? '',
            atletas: (atletasDe.get(payerId) ?? []).join(' / '),
            falta: faltan.join(' + '),
            pagos: 1,
            monto: Number(p.amount) || 0,
        });
    }

    // Primero quien más pagos tiene pendientes: es donde más rinde el esfuerzo
    // de perseguir un dato.
    const lista = [...porAcudiente.values()].sort((a, b) => b.pagos - a.pagos || a.acudiente.localeCompare(b.acudiente));

    const lineas = [
        'Acudiente;Atleta(s);Correo;Telefono;Que falta;Documento (COMPLETAR);Direccion (COMPLETAR);Ciudad (COMPLETAR);Pagos sin facturar;Monto',
        ...lista.map((f) => [
            csv(f.acudiente), csv(f.atletas), csv(f.email), csv(f.telefono), csv(f.falta),
            '', '', '',
            f.pagos, f.monto,
        ].join(';')),
    ];

    const destino = salida || `datos-faltantes-fe-${escuela.name.replace(/[^\w]+/g, '-').toLowerCase()}.csv`;
    // BOM para que Excel en Windows abra las tildes bien. Sin esto,
    // «Bermúdez» sale «BermÃºdez» y la escuela cree que el archivo está roto.
    fs.writeFileSync(destino, '\ufeff' + lineas.join('\r\n'), 'utf8');

    const totalPagos = lista.reduce((a, f) => a + f.pagos, 0);
    const totalMonto = lista.reduce((a, f) => a + f.monto, 0);
    const cop = (n: number) => `$${n.toLocaleString('es-CO')}`;

    console.log(`
${escuela.name}
${'─'.repeat(60)}
Pagos cobrados                       ${filas.length}
Acudientes con datos incompletos     ${lista.length}
  · sus pagos sin poder facturar     ${totalPagos}  (${cop(totalMonto)})
Pagos sin pagador asignado           ${sinPagador.length}  (${cop(sinPagador.reduce((a, s) => a + s.monto, 0))})
Acudientes sin codigo de ciudad      ${sinCiudad.size}  (no bloquea; se factura con el municipio de la escuela)

Archivo: ${destino}
`);

    if (sinPagador.length) {
        console.log('Los pagos SIN PAGADOR no van en el archivo: no hay a quién preguntarle.');
        console.log('Hay que asignarles acudiente en la app antes de poder facturarlos.\n');
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
