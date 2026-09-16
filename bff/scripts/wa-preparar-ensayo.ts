/**
 * Arma en Escuela Pruebas el escenario para ensayar el bot con un WhatsApp real.
 *
 *   cd bff
 *   npx tsx scripts/wa-preparar-ensayo.ts 3001234567
 *   npx tsx scripts/wa-preparar-ensayo.ts 3001234567 --borrar
 *
 * POR QUÉ EXISTE
 *
 * Todo lo del 2026-09-15/16 —identificación por número, la respuesta a «¿a cuál
 * cobro lo aplico?», el aviso de registrarse— tiene tests y NUNCA corrió contra
 * un WhatsApp de verdad. Ensayarlo con Dynasty sería estrenarlo sobre la plata
 * de familias reales.
 *
 * Escuela Pruebas tiene la única integración viva, pero está vacía: 1 atleta, 1
 * cobro, 0 cuentas bancarias, 0 teléfonos en perfil. Así no se puede ejercitar
 * NADA de lo nuevo. Este script la deja lista.
 *
 * QUÉ ARMA — el caso más difícil que tiene Dynasty, en chiquito:
 *
 *   · Tu número en el perfil del acudiente  → identificación por teléfono
 *   · DOS hijos con ese mismo número        → la pregunta de «¿a cuál?»
 *   · Cada uno con dos cobros, uno vencido  → «el pendiente» va al más antiguo
 *   · Un tercer atleta SIN cuenta           → el aviso de registrarse
 *   · Cuentas bancarias de mentira          → get_payment_methods
 *
 * EL NÚMERO NO SE ESCRIBE EN EL CÓDIGO. Va por argumento: este archivo se
 * commitea y el celular de alguien no tiene por qué quedar en el repo.
 *
 * Es idempotente y `--borrar` deshace todo lo que crea. Solo toca Escuela
 * Pruebas: si el nombre de la escuela no coincide exacto, se planta.
 */

import dotenv from 'dotenv';
dotenv.config();
import { supabase } from '../src/config/supabase';

const ESCUELA = 'Escuela Pruebas';

/** Marca para reconocer lo que crea este script y poder borrarlo después. */
const MARCA = '[ENSAYO WA]';

const tel = process.argv[2];
const borrar = process.argv.includes('--borrar');

function salir(msg: string): never {
    console.error(`\n✗ ${msg}\n`);
    process.exit(1);
}

async function main() {
    if (!tel || !/^3\d{9}$/.test(tel)) {
        salir('Pasa tu celular como argumento, 10 dígitos empezando en 3.\n' +
              '  npx tsx scripts/wa-preparar-ensayo.ts 3001234567');
    }

    // Se busca por nombre EXACTO. Un `like '%prueba%'` puede pegarle a una
    // escuela real que se llame «Pruebas de Salto» — y este script escribe.
    const { data: escuela } = await supabase
        .from('schools').select('id, name').eq('name', ESCUELA).maybeSingle();
    if (!escuela) salir(`No encontré la escuela «${ESCUELA}». No toco ninguna otra.`);

    const schoolId = (escuela as any).id;
    console.log(`Escuela: ${(escuela as any).name}`);

    // ── Deshacer ────────────────────────────────────────────────────────────
    if (borrar) {
        const { data: hijos } = await supabase
            .from('children').select('id')
            .eq('school_id', schoolId).like('full_name', `${MARCA}%`);
        const ids = (hijos ?? []).map((h: any) => h.id);

        if (ids.length) {
            await supabase.from('payments').delete().in('child_id', ids);
            await supabase.from('children').delete().in('id', ids);
        }
        await supabase.from('school_settings')
            .update({ payment_accounts: [] }).eq('school_id', schoolId);

        console.log(`✓ Borrados ${ids.length} atletas de ensayo y sus cobros.`);
        console.log('  El perfil del acudiente NO se toca: es una cuenta real.');
        return;
    }

    // ── 1. Tu número en el perfil ───────────────────────────────────────────
    // Se usa el acudiente que ya exista en la escuela. Si no hay ninguno, no se
    // inventa una cuenta: crear perfiles sueltos ensucia auth y no se limpia
    // solo. (Ver el gotcha de borrado total de un usuario.)
    const { data: existente } = await supabase
        .from('children').select('parent_id')
        .eq('school_id', schoolId).not('parent_id', 'is', null).limit(1).maybeSingle();

    const parentId = (existente as any)?.parent_id;
    if (!parentId) {
        salir('Escuela Pruebas no tiene ningún atleta con acudiente vinculado.\n' +
              '  Crea uno desde la app y vuelve a correr esto.');
    }

    const { error: errTel } = await supabase
        .from('profiles').update({ phone: tel }).eq('id', parentId);
    if (errTel) salir(`No pude poner el teléfono en el perfil: ${errTel.message}`);
    console.log(`✓ Teléfono ***${tel.slice(-4)} puesto en el perfil del acudiente.`);

    // ── 2. Dos hermanos con ese mismo número ────────────────────────────────
    const hermanos = [`${MARCA} Sofía Ensayo`, `${MARCA} Mateo Ensayo`];
    const idsHermanos: string[] = [];

    for (const nombre of hermanos) {
        const { data: ya } = await supabase
            .from('children').select('id')
            .eq('school_id', schoolId).eq('full_name', nombre).maybeSingle();

        if (ya) { idsHermanos.push((ya as any).id); continue; }

        const { data: nuevo, error } = await supabase.from('children').insert({
            school_id: schoolId, full_name: nombre,
            parent_id: parentId, parent_phone_temp: tel, is_active: true,
        }).select('id').single();
        if (error) salir(`No pude crear a ${nombre}: ${error.message}`);
        idsHermanos.push((nuevo as any).id);
    }
    console.log(`✓ Dos hermanos con el mismo número: ${hermanos.map((h) => h.replace(MARCA + ' ', '')).join(' y ')}.`);

    // ── 3. Un atleta reconocido pero SIN cuenta ─────────────────────────────
    // parent_id en null y el teléfono solo en la ficha: así se ve exactamente
    // como las 156 familias de Dynasty que tienen que registrarse.
    const sinCuenta = `${MARCA} Valeria SinCuenta`;
    const { data: yaSin } = await supabase
        .from('children').select('id')
        .eq('school_id', schoolId).eq('full_name', sinCuenta).maybeSingle();
    if (!yaSin) {
        // Un número distinto al tuyo, para que no choque con el identificado.
        const telSinCuenta = '3' + String(Date.now()).slice(-9);
        await supabase.from('children').insert({
            school_id: schoolId, full_name: sinCuenta,
            parent_id: null, parent_phone_temp: telSinCuenta, is_active: true,
        });
        console.log(`✓ Atleta sin cuenta creado (su número: ${telSinCuenta}).`);
        console.log('  Escríbele al bot DESDE ese número para ver el aviso de registro.');
    } else {
        console.log('✓ El atleta sin cuenta ya existía.');
    }

    // ── 4. Dos cobros por hermano: uno vencido y el del mes ─────────────────
    // Es la forma exacta de la regla: «el pendiente» va al MÁS ANTIGUO y el del
    // mes en curso queda corriendo.
    const hoy = new Date();
    const mes = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    const anterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 10);
    const actual = new Date(hoy.getFullYear(), hoy.getMonth(), 10);
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    let creados = 0;
    for (let i = 0; i < idsHermanos.length; i++) {
        const nombre = hermanos[i].replace(`${MARCA} `, '');
        for (const [fecha, estado] of [[anterior, 'overdue'], [actual, 'pending']] as const) {
            const concepto = `Mensualidad ${mes(fecha)} - ${nombre}`;
            const { data: yaCobro } = await supabase
                .from('payments').select('id')
                .eq('school_id', schoolId).eq('child_id', idsHermanos[i])
                .eq('concept', concepto).maybeSingle();
            if (yaCobro) continue;

            const { error } = await supabase.from('payments').insert({
                school_id: schoolId, child_id: idsHermanos[i], parent_id: parentId,
                concept: concepto,
                // Montos DISTINTOS entre hermanos a propósito: si fueran iguales
                // el monto del comprobante desempataría solo y nunca se probaría
                // la pregunta, que es lo que vinimos a ensayar.
                amount: i === 0 ? 150000 : 180000,
                due_date: iso(fecha), status: estado,
            });
            if (error) salir(`No pude crear el cobro «${concepto}»: ${error.message}`);
            creados++;
        }
    }
    console.log(`✓ ${creados} cobros nuevos (uno vencido y uno del mes por hermano).`);

    // ── 5. Cuentas para que get_payment_methods tenga qué responder ─────────
    const { data: settings } = await supabase
        .from('school_settings').select('payment_accounts').eq('school_id', schoolId).maybeSingle();
    const cuentas = (settings as any)?.payment_accounts ?? [];
    if (!Array.isArray(cuentas) || cuentas.length === 0) {
        await supabase.from('school_settings').upsert({
            school_id: schoolId,
            payment_accounts: [
                { tipo: 'Nequi', numero: '3001112233', titular: 'ESCUELA PRUEBAS SAS', active: true },
                { tipo: 'Bancolombia Ahorros', numero: '12345678901', titular: 'ESCUELA PRUEBAS SAS', active: true },
            ],
        }, { onConflict: 'school_id' });
        console.log('✓ Dos cuentas de mentira cargadas.');
    } else {
        console.log('✓ Ya había cuentas cargadas; no las toco.');
    }

    // ── El guion ────────────────────────────────────────────────────────────
    console.log(`
─────────────────────────────────────────────────────────────
GUION DEL ENSAYO — escríbele al WhatsApp de Escuela Pruebas
desde ***${tel.slice(-4)}, en este orden:

  1. «hola»                    → te reconoce por el número, sin pedir correo
  2. «sí»                      → queda el consentimiento
  3. «cuánto debo»             → los CUATRO cobros, ninguno en $0
  4. «cómo pago»               → las dos cuentas COMPLETAS + el enlace
  5. manda una foto de un      → pregunta a cuál aplicarlo (son 4 cobros)
     comprobante
  6. «el pendiente»            → lo aplica al MÁS ANTIGUO y te dice
                                 cuáles siguen corriendo
  7. «marca mi deuda como      → NO debe decir que lo hizo
     pagada»

Y desde OTRO número, uno que no sea de la escuela:
  8. «hola»                    → saludo neutro, sin interrogarte

Para deshacer todo:
  npx tsx scripts/wa-preparar-ensayo.ts ${tel} --borrar
─────────────────────────────────────────────────────────────`);
}

main().catch((e) => { console.error(e); process.exit(1); });
