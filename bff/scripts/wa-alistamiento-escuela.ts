/**
 * ¿Está esta escuela lista para conectar el canal de WhatsApp?
 *
 *   cd bff
 *   npx tsx scripts/wa-alistamiento-escuela.ts "DYNASTY"
 *
 * POR QUÉ EXISTE
 *
 * Alistar a Dynasty tomó una semana, y casi todo el tiempo se fue en DESCUBRIR
 * qué faltaba, no en arreglarlo. Cada hallazgo salió de una consulta distinta y
 * en desorden: los teléfonos malos, los cobros sin pagador, la cuenta de Nequi
 * sin registrar, las cédulas que faltaban para facturar.
 *
 * Esto lo vuelve un comando. Para la segunda escuela el diagnóstico debería
 * tomar treinta segundos, no una semana.
 *
 * LO QUE MIDE, Y POR QUÉ CADA COSA IMPORTA
 *
 *   1. Teléfonos     → sin ellos el bot no reconoce a nadie y les pide un
 *                      correo que la mitad no tiene.
 *   2. Pagador       → `wa_get_payment_status` filtra por `payments.parent_id`.
 *                      Un cobro sin pagador NO EXISTE para el bot: la familia
 *                      pregunta cuánto debe y recibe «estás al día» debiendo.
 *                      Es el fallo más caro porque no parece un fallo.
 *   3. Cuentas       → `get_payment_methods` sale de `school_settings.
 *                      payment_accounts`. Sin cargarlas, el control de destino
 *                      del comprobante marca en ROJO los pagos legítimos.
 *   4. Facturación   → la FE necesita documento Y dirección del pagador. Sin
 *                      eso el motor corta y ese pago no se factura NUNCA.
 *   5. Hermanos      → un teléfono con varios atletas obliga al bot a preguntar
 *                      a cuál cobro aplicar el comprobante. Con 3+ la lista se
 *                      pasa del tope y se calla una opción.
 *   6. Horarios      → lo que más preguntan las familias y lo que más tienta a
 *                      inventar. Si `teams.schedule` está vacío, el bot no
 *                      puede contestar — y es correcto que no lo haga.
 *
 * Solo LEE. No escribe nada.
 */

import dotenv from 'dotenv';
dotenv.config();
import { supabase } from '../src/config/supabase';

const argumento = process.argv[2];

/** Últimos 10 dígitos: en la base conviven '300…', '+57300…' y '57300…'. */
const cel = (v: unknown) => String(v ?? '').replace(/[^0-9]/g, '').slice(-10);
const esCelular = (v: unknown) => /^3[0-9]{9}$/.test(cel(v));
const vacio = (v: unknown) => String(v ?? '').trim() === '';
const cop = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

/** Una fila del reporte: qué se midió, cómo salió y qué significa. */
function linea(etiqueta: string, ok: boolean, detalle: string, nota = '') {
    console.log(`  ${ok ? '✅' : '⚠️ '} ${etiqueta.padEnd(30)} ${detalle}`);
    if (nota) console.log(`     ${nota}`);
}

async function main() {
    if (!argumento) {
        console.error('Uso: npx tsx scripts/wa-alistamiento-escuela.ts "<parte del nombre>"');
        process.exit(1);
    }

    const { data: escuelas } = await supabase
        .from('schools').select('id, name').ilike('name', `%${argumento}%`);

    if (!escuelas?.length) { console.error(`Sin coincidencias para «${argumento}».`); process.exit(1); }
    if (escuelas.length > 1) {
        console.error(`«${argumento}» coincide con varias:`);
        for (const e of escuelas) console.error(`  · ${e.name}`);
        process.exit(1);
    }
    const escuela = escuelas[0] as { id: string; name: string };
    const sid = escuela.id;

    const [atletas, pagos, settings, integracion, equipos, categorias, sinRegistrar, invitaciones] = await Promise.all([
        supabase.from('children')
            .select('id, full_name, parent_id, parent_phone_temp')
            .eq('school_id', sid).eq('is_active', true).limit(5000),
        supabase.from('payments')
            .select('id, amount, status, parent_id, user_id')
            .eq('school_id', sid).limit(10000),
        supabase.from('school_settings').select('payment_accounts').eq('school_id', sid).maybeSingle(),
        supabase.from('school_whatsapp_integrations').select('id, status').eq('school_id', sid).maybeSingle(),
        supabase.from('teams').select('id, name, schedule, location, student_count').eq('school_id', sid).limit(200),
        supabase.from('school_categories').select('id').eq('school_id', sid).limit(200),
        supabase.from('unregistered_athletes')
            .select('id, full_name, phone, guardian_phone, invitation_id, email')
            .eq('school_id', sid).eq('is_active', true).is('linked_profile_id', null).limit(2000),
        supabase.from('invitations').select('id, status').eq('school_id', sid).limit(2000),
    ]);

    const hijos = atletas.data ?? [];
    const cobros = pagos.data ?? [];

    // Los perfiles de los acudientes, para teléfono y datos fiscales.
    const parentIds = [...new Set(hijos.map((h: any) => h.parent_id).filter(Boolean))];
    const { data: perfiles } = parentIds.length
        ? await supabase.from('profiles')
            .select('id, phone, document_number, billing_address').in('id', parentIds)
        : { data: [] as any[] };
    const perfil = new Map((perfiles ?? []).map((p: any) => [p.id, p]));

    console.log(`\n${escuela.name}\n${'═'.repeat(66)}`);

    // ── 1. Teléfonos ────────────────────────────────────────────────────────
    // El bot cruza el numero del que escribe. Se mira el telefono EFECTIVO:
    // el del perfil si existe, si no el de la ficha — que es el mismo orden
    // que usa la vista que lee el bot.
    const telDe = (h: any) => {
        const p: any = perfil.get(h.parent_id);
        return esCelular(p?.phone) ? cel(p.phone) : (esCelular(h.parent_phone_temp) ? cel(h.parent_phone_temp) : null);
    };
    const conTel = hijos.filter((h: any) => telDe(h));
    const pctTel = hijos.length ? Math.round((conTel.length / hijos.length) * 100) : 0;
    console.log('\n1 · IDENTIFICACIÓN POR TELÉFONO');
    linea('Atletas activos', true, String(hijos.length));
    linea('Con celular usable', pctTel >= 95, `${conTel.length} / ${hijos.length}  (${pctTel}%)`,
        pctTel < 95 ? 'A los que falten, el bot les pedirá un correo que quizá no tengan.' : '');

    // ── 2. Pagador ──────────────────────────────────────────────────────────
    const abiertos = cobros.filter((p: any) => ['pending', 'overdue', 'partial'].includes(p.status));
    const sinPagador = abiertos.filter((p: any) => !p.parent_id && !p.user_id);
    const plataCiega = sinPagador.reduce((a, p: any) => a + (Number(p.amount) || 0), 0);
    console.log('\n2 · COBROS VISIBLES PARA EL BOT');
    linea('Cobros abiertos', true, String(abiertos.length));
    linea('SIN pagador asignado', sinPagador.length === 0,
        `${sinPagador.length}  (${cop(plataCiega)})`,
        sinPagador.length ? 'A esas familias el bot les dirá «estás al día» debiendo. Es el fallo más caro.' : '');

    // ── 3. Cuentas de pago ──────────────────────────────────────────────────
    const cuentas = ((settings.data as any)?.payment_accounts ?? []) as any[];
    console.log('\n3 · MEDIOS DE PAGO');
    linea('Cuentas registradas', cuentas.length > 0, String(cuentas.length),
        !cuentas.length
            ? 'Sin cuentas, el bot no puede decir cómo pagar Y el control de destino no puede evaluar.'
            : 'Verifica que estén TODAS: una cuenta real sin registrar marca en rojo comprobantes legítimos.');

    // ── 4. Facturación electrónica ──────────────────────────────────────────
    const pagados = cobros.filter((p: any) => p.status === 'paid');
    const sinDatosFE = pagados.filter((p: any) => {
        const id = p.parent_id || p.user_id;
        if (!id) return true;
        const pr: any = perfil.get(id);
        return !pr || vacio(pr.document_number) || vacio(pr.billing_address);
    });
    console.log('\n4 · FACTURACIÓN ELECTRÓNICA');
    linea('Pagos cobrados', true, String(pagados.length));
    linea('NO facturables', sinDatosFE.length === 0,
        `${sinDatosFE.length}  (${cop(sinDatosFE.reduce((a, p: any) => a + (Number(p.amount) || 0), 0))})`,
        sinDatosFE.length ? 'Falta documento o dirección del pagador. Detalle: scripts/fe-datos-faltantes.ts' : '');

    // ── 5. Hermanos ─────────────────────────────────────────────────────────
    const porTel = new Map<string, number>();
    for (const h of conTel) { const t = telDe(h)!; porTel.set(t, (porTel.get(t) ?? 0) + 1); }
    const compartidos = [...porTel.values()].filter((n) => n > 1);
    const tresOmas = [...porTel.values()].filter((n) => n >= 3).length;
    console.log('\n5 · HERMANOS EN UN MISMO NÚMERO');
    linea('Teléfonos compartidos', true, `${compartidos.length}  (${compartidos.reduce((a, b) => a + b, 0)} atletas)`);
    linea('Con 3 o más atletas', tresOmas === 0, String(tresOmas),
        tresOmas ? 'El bot ofrece máximo 5 cobros al preguntar a cuál aplicar: con 3 hijos puede pasarse.' : '');

    // ── 6. Lo que el bot NO puede contestar ─────────────────────────────────
    const eq = equipos.data ?? [];
    const conHorario = eq.filter((t: any) => t.schedule && String(t.schedule).trim() !== '');
    console.log('\n6 · DATOS PARA RESPONDER PREGUNTAS');
    linea('Equipos con horario', conHorario.length === eq.length && eq.length > 0,
        `${conHorario.length} / ${eq.length}`,
        conHorario.length < eq.length ? 'Sin horario el bot dirá «no lo tengo». Correcto, pero la escuela recibe la pregunta.' : '');
    linea('Categorías por edad', (categorias.data ?? []).length > 0, String((categorias.data ?? []).length),
        !(categorias.data ?? []).length ? 'Sin school_categories no puede decir a qué grupo va un niño por su año.' : '');

    // ── 6b. Atletas que la escuela cargo y nunca se registraron ─────────────
    //
    // Es la TERCERA tabla de atletas, y el bot la mira desde el 2026-09-22.
    // Pero reconocerlos no basta: para VINCULARLOS hace falta una invitacion,
    // porque `accept_invitation_pro` es lo unico que migra el atleta a un
    // perfil. Y ahi las escuelas se parten en dos grupos:
    //
    //   Besser    38 de 38 con invitacion  -> el bot los resuelve solo
    //   GYM RM     3 de 125                -> 6 invitaciones en toda su
    //                                          historia; nunca se invito a
    //                                          nadie. Eso no lo arregla el
    //                                          codigo, lo arregla la escuela.
    //
    // Distinguirlos es la diferencia entre «falta un dato» y «falta que la
    // escuela haga algo».
    const sr = sinRegistrar.data ?? [];
    const invits = invitaciones.data ?? [];
    if (sr.length) {
        const alcanzables = sr.filter((a: any) => esCelular(a.guardian_phone) || esCelular(a.phone));
        // SOLO `invitation_id` cuenta. El correo NO alcanza, y creerlo fue un
        // error mio: `accept_invitation_pro` recibe un ID DE INVITACION, y el
        // correo sirve despues, para encontrar al atleta una vez aceptada. Sin
        // invitacion que aceptar no hay nada que el correo pueda salvar.
        //
        // La metrica vieja daba «Monster's 125/125» y era falso: tienen 5
        // invitaciones para 125 atletas.
        const vinculables = sr.filter((a: any) => a.invitation_id);
        console.log('\n6b · ATLETAS CARGADOS SIN REGISTRAR');
        linea('Total', true, String(sr.length));
        linea('Alcanzables por celular', alcanzables.length === sr.length,
            `${alcanzables.length} / ${sr.length}`,
            alcanzables.length < sr.length ? 'Sin celular el bot no los reconoce.' : '');
        linea('Con invitación ligada', vinculables.length === sr.length,
            `${vinculables.length} / ${sr.length}`,
            vinculables.length < sr.length
                ? `A ${sr.length - vinculables.length} el bot los reconoce pero NO los puede vincular: la escuela tiene que invitarlos primero.`
                : '');
        linea('Invitaciones creadas', invits.length >= sr.length, String(invits.length),
            invits.length < sr.length ? 'Menos invitaciones que atletas: no es que no aceptaran, es que no se invitó.' : '');
    }

    // ── 7. El canal ─────────────────────────────────────────────────────────
    console.log('\n7 · CANAL');
    linea('Integración de WhatsApp', !!integracion.data,
        integracion.data ? `conectada (${(integracion.data as any).status})` : 'sin conectar');

    // ── Veredicto ───────────────────────────────────────────────────────────
    const bloqueantes: string[] = [];
    // Una escuela sin atletas no tiene «0 atletas sin celular»: no tiene a
    // quien atender. Es otra conversacion, no un dato que arreglar.
    if (!hijos.length) bloqueantes.push('la escuela no tiene atletas activos');
    else if (pctTel < 95) bloqueantes.push(`${hijos.length - conTel.length} atletas sin celular usable`);
    if (sinPagador.length) bloqueantes.push(`${sinPagador.length} cobros sin pagador (${cop(plataCiega)} invisibles)`);
    if (!cuentas.length) bloqueantes.push('sin cuentas de pago registradas');

    console.log(`\n${'═'.repeat(66)}`);
    if (!bloqueantes.length) {
        console.log('LISTA para conectar. Lo de la sección 6 no bloquea: el bot admite que no lo sabe.\n');
    } else {
        console.log('ANTES DE CONECTAR hay que resolver:');
        for (const b of bloqueantes) console.log(`  · ${b}`);
        console.log('');
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
