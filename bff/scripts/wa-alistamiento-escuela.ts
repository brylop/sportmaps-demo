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
 *   8. Inscripción   → (2026-10-21, tras Dynasty y Besser) el enlace que manda
 *                      el bot es el QR `open` con más altas: si hay dos, puede
 *                      cambiar solo. Un QR que cobra no debe ofrecer el plan de
 *                      $0. La conversión escaneo→alta dice si el formulario pierde gente.
 *   9. Políticas     → lo que la escuela decidió contra lo que el bot asume
 *                      (abonos, cortesía única, modo de cortesía).
 *  10. Cuentas nuevas→ acudientes creados en los últimos 60 días SIN WhatsApp
 *                      (el registro con Google no lo pide): para el bot no existen.
 *  11. Bandeja       → solo con el canal conectado: contactos sin clasificar y
 *                      por qué motivo se acumulan los casos que piden acción.
 *
 * Los avisos (secciones 8 a 11) no bloquean conectar: son lo que se arregla
 * en la primera semana. Ver docs/playbook-nueva-escuela-bot-web.md.
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
        .from('schools').select('id, name, slug').ilike('name', `%${argumento}%`);

    if (!escuelas?.length) { console.error(`Sin coincidencias para «${argumento}».`); process.exit(1); }
    if (escuelas.length > 1) {
        console.error(`«${argumento}» coincide con varias:`);
        for (const e of escuelas) console.error(`  · ${e.name}`);
        process.exit(1);
    }
    const escuela = escuelas[0] as { id: string; name: string; slug: string | null };
    const sid = escuela.id;

    const [atletas, pagos, settings, integracion, equipos, categorias, sinRegistrar, invitaciones, qrs, planes] = await Promise.all([
        supabase.from('children')
            .select('id, full_name, parent_id, parent_phone_temp')
            .eq('school_id', sid).eq('is_active', true).limit(5000),
        supabase.from('payments')
            .select('id, amount, status, parent_id, user_id')
            .eq('school_id', sid).limit(10000),
        supabase.from('school_settings').select('*').eq('school_id', sid).maybeSingle(),
        supabase.from('school_whatsapp_integrations').select('id, status').eq('school_id', sid).maybeSingle(),
        supabase.from('teams').select('id, name, schedule, location, student_count').eq('school_id', sid).limit(200),
        supabase.from('school_categories').select('id').eq('school_id', sid).limit(200),
        supabase.from('unregistered_athletes')
            .select('id, full_name, phone, guardian_phone, invitation_id, email')
            .eq('school_id', sid).eq('is_active', true).is('linked_profile_id', null).limit(2000),
        supabase.from('invitations').select('id, status').eq('school_id', sid).limit(2000),
        supabase.from('school_join_qr_codes')
            .select('slug, target_type, active, expires_at, signup_count, scan_count, require_first_payment, accept_payments')
            .eq('school_id', sid).limit(50),
        supabase.from('offering_plans').select('name, price, is_active').eq('school_id', sid).limit(200),
    ]);

    const hijos = atletas.data ?? [];
    const cobros = pagos.data ?? [];

    // Los perfiles de los acudientes, para teléfono y datos fiscales.
    const parentIds = [...new Set(hijos.map((h: any) => h.parent_id).filter(Boolean))];
    const { data: perfiles } = parentIds.length
        ? await supabase.from('profiles')
            .select('id, phone, document_number, billing_address, created_at').in('id', parentIds)
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


    // ── 8. Inscripción: el enlace y el formulario ───────────────────────────
    //
    // El bot manda el QR `open` activo y sin vencer con MÁS ALTAS
    // (`enlaceDeInscripcion`). Con dos abiertos, el día que el segundo pase al
    // primero el bot cambia de enlace sin que nadie lo decida. Dynasty tiene dos
    // (127 y 68 altas). Y un QR que cobra la primera mensualidad no debe ofrecer
    // el plan de $0 (Besser, 2026-10-20: cualquiera se inscribía gratis).
    const ahora = Date.now();
    const lista = (qrs.data ?? []) as any[];
    const vivos = lista.filter((q) => q.active && (!q.expires_at || new Date(q.expires_at).getTime() > ahora));
    const abiertos2 = vivos.filter((q) => q.target_type === 'open')
        .sort((a, b) => (b.signup_count ?? 0) - (a.signup_count ?? 0));
    const elDelBot = abiertos2[0] ?? vivos.find((q) => q.target_type === 'branch');
    const set = (settings.data ?? {}) as Record<string, any>;
    const planesCero = ((planes.data ?? []) as any[]).filter((p) => p.is_active && Number(p.price) === 0);
    const avisos: string[] = [];

    console.log('\n8 · INSCRIPCIÓN Y WEB');
    linea('Slug de la escuela', !!escuela.slug, escuela.slug ?? 'sin slug',
        escuela.slug ? '' : 'Sin slug la web no puede enlazar la clase de prueba ni el formulario.');
    linea('QR de inscripción vivos', vivos.length > 0, String(vivos.length));
    if (!elDelBot) {
        avisos.push('sin QR de inscripción vivo: el bot no tiene enlace que mandar y pasa el caso a una persona');
    } else {
        const conv = elDelBot.scan_count ? Math.round((100 * (elDelBot.signup_count ?? 0)) / elDelBot.scan_count) : null;
        linea('El que manda el bot', true, `/join/${elDelBot.slug}  (${elDelBot.signup_count ?? 0} altas)`,
            elDelBot.require_first_payment ? 'Cobra la primera mensualidad al inscribir.' : 'Inscribe SIN cobro inicial.');
        linea('Conversión escaneo → alta', conv === null || conv >= 10,
            conv === null ? 'sin datos' : `${conv}%  (${elDelBot.scan_count} aperturas)`,
            'Las aperturas incluyen recargas y visitas al portal de pagos (?do=pagar): el % real es mayor.');
    }
    linea('QR abiertos compitiendo', abiertos2.length <= 1, String(abiertos2.length),
        abiertos2.length > 1
            ? `El bot elige por altas (${abiertos2.map((q) => `${q.slug}: ${q.signup_count}`).join(' · ')}). Si el segundo lo alcanza, cambia de enlace solo.`
            : '');
    if (abiertos2.length > 1) avisos.push('más de un QR abierto: el enlace del bot puede cambiar solo; fijar cuál manda');
    const cobraConCero = vivos.some((q) => q.require_first_payment) && planesCero.length > 0;
    linea('Plan de $0 en un QR que cobra', !cobraConCero || set.cortesia_unica === true,
        cobraConCero ? planesCero.map((p) => p.name).join(', ') : 'ninguno',
        cobraConCero && set.cortesia_unica !== true
            ? 'Quien se inscribe por ese QR puede elegir el plan gratis. Activar school_settings.cortesia_unica o desactivar el plan.'
            : '');
    if (cobraConCero && set.cortesia_unica !== true) avisos.push('un QR que cobra ofrece un plan de $0: activar cortesia_unica');

    // ── 9. Políticas: lo que decidió la escuela contra lo que el bot asume ─
    console.log('\n9 · POLÍTICAS DE LA ESCUELA');
    const abonos = set.allow_installments === true;
    linea('Recibe abonos', true, abonos
        ? `sí (mínimo ${cop(Number(set.min_installment_amount) || 0)}, hasta ${set.max_installments_per_payment ?? '?'} pagos)`
        : 'no',
        abonos
            ? 'OJO: el bot todavía trata todo monto menor al cobro como «no cuadra» y dice «la escuela no recibe abonos». Contradice esta política.'
            : 'Los pagos parciales van a la bandeja para decisión humana (Dynasty: 10 familias en 3 semanas).');
    if (abonos) avisos.push('allow_installments=true pero el bot no entiende abonos: los mandará a la bandeja');
    linea('Modo de cortesía del bot', true, String(set.wa_modo_cortesia ?? 'clase (por defecto)'),
        set.wa_modo_cortesia === 'semana_app'
            ? `Semana por la app con el QR ${set.wa_cortesia_qr_id ?? 'SIN ELEGIR'}.`
            : 'Agenda franjas de clase de prueba.');
    linea('Cortesía única por deportista', set.cortesia_unica === true, set.cortesia_unica === true ? 'sí' : 'no',
        set.cortesia_unica === true ? '' : 'Quien ya usó su cortesía puede repetirla por el QR sin cobro.');

    // ── 10. Cuentas de acudiente nuevas sin WhatsApp ────────────────────────
    //
    // El registro con correo pide el WhatsApp; el de Google NO. Medido el
    // 2026-10-21 (todas las escuelas, 60 días): 10 de 24 cuentas de Google sin
    // WhatsApp (42%) contra 22 de 147 con correo (15%). Para el bot no existen.
    const hace60 = ahora - 60 * 86400_000;
    const nuevas = (perfiles ?? []).filter((p: any) => p.created_at && new Date(p.created_at).getTime() >= hace60);
    const nuevasSinTel = nuevas.filter((p: any) => !esCelular(p.phone));
    console.log('\n10 · CUENTAS NUEVAS (60 días)');
    linea('Acudientes nuevos', true, String(nuevas.length));
    linea('Sin WhatsApp propio', nuevasSinTel.length === 0, `${nuevasSinTel.length} / ${nuevas.length}`,
        nuevasSinTel.length ? 'Si la ficha tampoco tiene celular, el bot los trata como desconocidos.' : '');
    if (nuevas.length && nuevasSinTel.length / nuevas.length > 0.1) {
        avisos.push(`${nuevasSinTel.length} de ${nuevas.length} acudientes nuevos sin WhatsApp`);
    }

    // ── 11. Bandeja y contactos (solo con el canal conectado) ───────────────
    if (integracion.data) {
        const integ = (integracion.data as any).id as string;
        const hace30 = new Date(ahora - 30 * 86400_000).toISOString();
        const [sinTipo, cola] = await Promise.all([
            supabase.from('whatsapp_conversations').select('id', { count: 'exact', head: true })
                .eq('integration_id', integ).is('contact_kind', null),
            supabase.from('whatsapp_inbound_queue').select('error_message')
                .eq('school_id', sid).eq('result_type', 'escalated').gte('created_at', hace30)
                .not('error_message', 'like', 'cerrado_escuela%').limit(2000),
        ]);
        const motivos = new Map<string, number>();
        for (const f of (cola.data ?? []) as any[]) {
            const m = String(f.error_message ?? '(sin motivo)').replace(/^recuperado:\s*/, '').split(/[:—(]/)[0].trim().slice(0, 40);
            motivos.set(m, (motivos.get(m) ?? 0) + 1);
        }
        const top = [...motivos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
        console.log('\n11 · BANDEJA Y CONTACTOS');
        linea('Conversaciones sin tipo de contacto', (sinTipo.count ?? 0) === 0, String(sinTipo.count ?? 0),
            'Marcar personal / negocio / otro club saca ruido de las métricas y de la bandeja.');
        linea('Casos que piden acción (30 d)', (cola.data ?? []).length === 0, String((cola.data ?? []).length),
            top.map(([m, n]) => `${m}: ${n}`).join(' · '));
    }

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
    if (avisos.length) {
        console.log('AVISOS (no bloquean; resolver en la primera semana):');
        for (const a of avisos) console.log(`  · ${a}`);
        console.log('');
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
