/**
 * Fase A del buzón de WhatsApp: clasifica las conversaciones que ya existían y
 * limpia lo que quedó colgado.
 *
 *   cd bff
 *   npx tsx scripts/wa-fase-a-limpieza.ts                         # solo muestra (NO escribe nada)
 *   npx tsx scripts/wa-fase-a-limpieza.ts --escuela <school_id>   # solo una escuela
 *   npx tsx scripts/wa-fase-a-limpieza.ts --aplicar               # escribe
 *
 * REQUIERE la migración 20261003193624_whatsapp_atencion_solo_familias aplicada
 * (columna `contact_kind`). Sin ella, --aplicar se niega a correr.
 *
 * POR QUÉ EXISTE
 *
 * Medido el 2026-10-03 en Dynasty (primer día con el número conectado por
 * Coexistence, que es también el WhatsApp personal de la dueña): 55
 * conversaciones, todas 'open'; 316 borradores 'pending' sin aprobar, 238 a
 * contactos personales. `contact_kind` nace en NULL para todas: sin este
 * script, el buzón mostraría la pestaña Familias vacía hasta que cada familia
 * vuelva a escribir.
 *
 * QUÉ HACE
 *
 *   1. Clasifica cada conversación (familia, familia_sin_cuenta, ambiguo,
 *      staff, desconocido; respeta 'personal').
 *   2. Cierra las 'open' que ya están respondidas (último saliente — bot,
 *      buzón o echo del celular, sin contar los automáticos del paso 4 — más
 *      nuevo que el último entrante). Quedaron
 *      'open' porque el BFF escribía status='active', que el CHECK rechazaba.
 *   3. Cierra las 'open' sin actividad hace 48 h y expira los borradores
 *      'pending' de más de 24 h — lo mismo que hará el job cada 15 min.
 *   4. Marca `payload.automatico=true` en los echos que mandó sola la app
 *      WhatsApp Business (saludo, ausencia): mismo texto a ≥ 3 contactos en
 *      7 días (regla en src/services/whatsapp-buzon.ts). Esos NO cuentan como
 *      respuesta en el paso 2, y se reabren las 'closed' cuyo último mensaje
 *      es uno de ellos con la familia esperando. Medido el 2026-10-03: 7 echos
 *      "Gracias por comunicarte con Dynasty…", ninguno marcado. procesarEchos
 *      marca los nuevos al llegar; este paso corrige los que ya estaban, y
 *      por eso el GET del buzón no recalcula la regla: solo lee la marca.
 *
 * DRY-RUN DE VERDAD
 *
 * `clasificarContacto` llama a `wa_identify_by_phone`, que ESCRIBE: vincula
 * la conversación al acudiente (parent_id, identified) y crea la fila en
 * whatsapp_identifications. Por eso en dry-run NO se usa: se replica la misma
 * lógica con SELECTs (y con las dos RPC que son solo lectura:
 * `wa_es_familia_sin_registrar`, STABLE, y `wa_identify_staff_admin_by_phone`,
 * que solo hace SELECT). Con --aplicar sí se usa la función real, que es la
 * que corre en producción en cada mensaje entrante.
 */

import 'dotenv/config';
import { supabase } from '../src/config/supabase';
import { clasificarContacto, type TipoDeContacto } from '../src/services/whatsapp-atencion.service';
import type { WhatsAppIntegration } from '../src/services/whatsapp.service';
import { echosAutomaticos, esSalienteAutomatico } from '../src/services/whatsapp-buzon';
import {
    marcarEchosAutomaticos, necesitaReabrir, reabrirSiSoloRespondioLaApp,
} from '../src/services/whatsapp-coexistence.service';
import {
    cerrarConversacionesInactivas, expirarBorradoresViejos,
    HORAS_INACTIVIDAD_CONVERSACION, HORAS_VIDA_BORRADOR,
} from '../src/jobs/whatsapp-mantenimiento.job';

const linea = (t = '─') => console.log(t.repeat(64));
const APLICAR = process.argv.includes('--aplicar');

function arg(nombre: string): string | undefined {
    const i = process.argv.indexOf(nombre);
    return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Igual que la RPC: últimos 10 dígitos. */
const tel10 = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '').slice(-10);
const esCelularCO = (t: string) => /^3\d{9}$/.test(t);

/** Lo que conoce una escuela para clasificar sin escribir. */
async function padronDe(schoolId: string) {
    const { data: hijos, error } = await supabase
        .from('children')
        .select('parent_id, parent_phone_temp')
        .eq('school_id', schoolId)
        .eq('is_active', true);
    if (error) throw new Error(`children de ${schoolId}: ${error.message}`);

    const parentIds = [...new Set((hijos ?? []).map((h: any) => h.parent_id).filter(Boolean))] as string[];
    const perfilesPorTel = new Map<string, Set<string>>();
    for (let i = 0; i < parentIds.length; i += 200) {
        const { data: perfiles, error: e } = await supabase
            .from('profiles').select('id, phone').in('id', parentIds.slice(i, i + 200));
        if (e) throw new Error(`profiles: ${e.message}`);
        for (const p of (perfiles ?? []) as any[]) {
            const t = tel10(p.phone);
            if (!t) continue;
            if (!perfilesPorTel.has(t)) perfilesPorTel.set(t, new Set());
            perfilesPorTel.get(t)!.add(p.id);
        }
    }
    const telefonosTemporales = new Set(
        (hijos ?? []).map((h: any) => tel10(h.parent_phone_temp)).filter(Boolean));
    return { perfilesPorTel, telefonosTemporales };
}

/** Réplica de solo lectura de clasificarContacto + wa_identify_by_phone. */
async function clasificarSinEscribir(
    schoolId: string,
    conv: { contact_wa_id: string; identified: boolean | null; parent_id: string | null; contact_kind?: string | null },
    padron: Awaited<ReturnType<typeof padronDe>>,
): Promise<TipoDeContacto> {
    if (conv.contact_kind === 'personal') return 'personal';

    const t = tel10(conv.contact_wa_id);
    if (esCelularCO(t)) {
        const cuentas = padron.perfilesPorTel.get(t)?.size ?? 0;
        if (cuentas > 1) return 'ambiguo';
        if (cuentas === 1) return 'familia';
        if (padron.telefonosTemporales.has(t)) return 'familia_sin_cuenta';
        const { data: sinRegistrar } = await supabase.rpc('wa_es_familia_sin_registrar', {
            p_school_id: schoolId, p_contact_wa_id: conv.contact_wa_id,
        });
        if (sinRegistrar === true) return 'familia_sin_cuenta';
    }

    if (conv.identified && conv.parent_id) return 'familia';

    const { data: staff } = await supabase.rpc('wa_identify_staff_admin_by_phone', {
        p_school_id: schoolId, p_wa_phone_number: conv.contact_wa_id,
    });
    if ((staff as any)?.estado === 'identificado') return 'staff';
    return 'desconocido';
}

async function main() {
    const escuela = arg('--escuela');
    linea('═');
    console.log(`Fase A — limpieza del buzón de WhatsApp ${APLICAR ? '(APLICANDO)' : '(solo muestra, no escribe)'}`);
    linea('═');

    let q = supabase.from('school_whatsapp_integrations')
        .select('id, school_id, phone_number_id, waba_id, display_phone_number, status, school:schools(name)');
    if (escuela) q = q.eq('school_id', escuela);
    const { data: integraciones, error } = await q;
    if (error) throw new Error(`integraciones: ${error.message}`);

    // ¿Existe la columna? Sin ella no hay qué clasificar en la base.
    const sonda = await supabase.from('whatsapp_conversations').select('contact_kind').limit(1);
    const hayColumna = !sonda.error;
    if (!hayColumna) {
        console.log('⚠  La columna contact_kind NO existe: falta aplicar la migración 20261003193624.');
        if (APLICAR) throw new Error('Se aborta --aplicar: aplicar primero la migración.');
        console.log('   La clasificación se calcula igual, pero no se podría guardar.');
    }

    const ahora = Date.now();
    const corteConv = new Date(ahora - HORAS_INACTIVIDAD_CONVERSACION * 3600_000).toISOString();
    const corteDraft = new Date(ahora - HORAS_VIDA_BORRADOR * 3600_000).toISOString();

    const totalPorTipo: Record<string, number> = {};
    let totalRespondidas = 0;
    let totalEchosAuto = 0;
    let totalDejanDeContar = 0;
    let totalReabrir = 0;

    for (const integ of (integraciones ?? []) as any[]) {
        linea();
        console.log(`${integ.school?.name ?? '—'} · ${integ.display_phone_number ?? '—'} · ${integ.school_id}`);

        const { data: convs, error: e } = await supabase
            .from('whatsapp_conversations')
            .select(`id, contact_wa_id, identified, parent_id, status, last_inbound_at${hayColumna ? ', contact_kind' : ''}`)
            .eq('integration_id', integ.id);
        if (e) throw new Error(`conversaciones: ${e.message}`);
        const lista = (convs ?? []) as any[];
        if (!lista.length) { console.log('  sin conversaciones'); continue; }

        const padron = APLICAR ? null : await padronDe(integ.school_id);
        const porTipo: Record<string, number> = {};
        for (const c of lista) {
            const tipo = APLICAR
                ? await clasificarContacto(integ as unknown as WhatsAppIntegration, c.id, c.contact_wa_id)
                : await clasificarSinEscribir(integ.school_id, c, padron!);
            porTipo[tipo] = (porTipo[tipo] ?? 0) + 1;
            totalPorTipo[tipo] = (totalPorTipo[tipo] ?? 0) + 1;
        }
        console.log(`  ${lista.length} conversación(es):`,
            Object.entries(porTipo).map(([k, n]) => `${k}=${n}`).join(' · '));

        // Echos automáticos (saludo / ausencia de la app del negocio). Se
        // evalúan sobre TODOS los echos de la integración, no por conversación:
        // la regla es "mismo texto a ≥ 3 contactos". Echo = saliente con
        // ai_generated=false y `to` en el payload (los del bot no lo traen).
        const { data: echos, error: eEchos } = await supabase.from('whatsapp_messages')
            .select('id, conversation_id, text_body, wa_timestamp, created_at, payload')
            .eq('integration_id', integ.id).eq('direction', 'outbound').eq('ai_generated', false)
            .not('payload->to', 'is', null).not('text_body', 'is', null)
            .limit(20000);
        if (eEchos) throw new Error(`echos: ${eEchos.message}`);
        const listaEchos = (echos ?? []) as any[];
        const autoIds = echosAutomaticos(listaEchos);
        const porMarcar = listaEchos.filter((e) => autoIds.has(e.id) && !esSalienteAutomatico(e));
        totalEchosAuto += porMarcar.length;
        const textos = new Map<string, number>();
        for (const e of porMarcar) {
            const t = String(e.text_body).replace(/\s+/g, ' ').slice(0, 60);
            textos.set(t, (textos.get(t) ?? 0) + 1);
        }
        console.log(`  ${listaEchos.length} echo(s) con texto; ${porMarcar.length} automático(s) sin marcar`
            + (autoIds.size > porMarcar.length ? ` (${autoIds.size - porMarcar.length} ya marcados)` : ''));
        for (const [t, n] of textos) console.log(`    ×${n}  «${t}»`);

        /** Cuenta como respuesta: no es automático ni ahora ni después de marcar. */
        const cuentaComoRespuesta = (m: any) => !esSalienteAutomatico(m) && !autoIds.has(m.id);

        // Por conversación: 'open' ya respondidas por una PERSONA (el último
        // saliente humano es más nuevo que el último entrante), cuántas dejan
        // de contar como respondidas por la regla, y 'closed' a reabrir.
        const abiertas = lista.filter((c) => c.status === 'open');
        const respondidas: string[] = [];
        const aReabrir: string[] = [];
        for (const c of lista) {
            const { data: msgs } = await supabase.from('whatsapp_messages')
                .select('id, direction, wa_timestamp, created_at, payload')
                .eq('conversation_id', c.id)
                .order('wa_timestamp', { ascending: false, nullsFirst: false }).limit(200);
            const ms = (msgs ?? []) as any[];
            const t = (m: any) => new Date(m.wa_timestamp ?? m.created_at).getTime();
            const max = (xs: any[]) => xs.reduce((a, m) => Math.max(a, t(m)), 0);
            const entra = max(ms.filter((m) => m.direction === 'inbound'));
            const saleAntes = max(ms.filter((m) => m.direction === 'outbound'));
            const sale = max(ms.filter((m) => m.direction === 'outbound' && cuentaComoRespuesta(m)));
            const respondidaAntes = saleAntes > 0 && saleAntes >= entra;
            const respondida = sale > 0 && sale >= entra;
            if (respondidaAntes && !respondida) totalDejanDeContar++;
            if (c.status === 'open' && respondida) respondidas.push(c.id);
            // Misma regla que procesarEchos, viendo la marca que tendrán tras --aplicar.
            const conMarca = ms.map((m) => (autoIds.has(m.id)
                ? { ...m, payload: { ...(m.payload ?? {}), automatico: true } } : m));
            if (c.status === 'closed' && necesitaReabrir(conMarca)) aReabrir.push(c.id);
        }
        totalRespondidas += respondidas.length;
        totalReabrir += aReabrir.length;
        console.log(`  ${abiertas.length} 'open'; ${respondidas.length} ya respondida(s) por una persona → se cerrarían`);
        console.log(`  ${aReabrir.length} 'closed' cuyo último mensaje es un automático con la familia esperando → se reabrirían`);

        if (APLICAR && porMarcar.length) {
            const n = await marcarEchosAutomaticos(porMarcar);
            console.log(`  ✔ ${n} echo(s) marcados automatico=true`);
        }
        if (APLICAR && aReabrir.length) {
            const r = await reabrirSiSoloRespondioLaApp(aReabrir);
            console.log(`  ✔ ${r.length} conversación(es) reabiertas`);
        }

        if (APLICAR && respondidas.length) {
            const { error: errC } = await supabase.from('whatsapp_conversations')
                .update({ status: 'closed', unread_count: 0, updated_at: new Date().toISOString() })
                .in('id', respondidas).eq('status', 'open');
            if (errC) console.log(`  ✗ no se pudieron cerrar: ${errC.message}`);
        }
    }

    // Lo mismo que hará el job cada 15 min (todas las escuelas, no se filtra por --escuela).
    linea();
    const { count: inactivas } = await supabase.from('whatsapp_conversations')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open')
        .or(`last_message_at.lt.${corteConv},and(last_message_at.is.null,updated_at.lt.${corteConv})`);
    const { count: viejos } = await supabase.from('whatsapp_message_drafts')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending').lt('created_at', corteDraft);

    console.log('Total por tipo:', Object.entries(totalPorTipo).map(([k, n]) => `${k}=${n}`).join(' · ') || '—');
    console.log(`Conversaciones 'open' ya respondidas que se cierran: ${totalRespondidas}`);
    console.log(`Echos automáticos (saludo/ausencia) a marcar: ${totalEchosAuto}`);
    console.log(`Conversaciones que dejan de contar como respondidas: ${totalDejanDeContar}`
        + ` · 'closed' que se reabren: ${totalReabrir}`);
    console.log(`Conversaciones 'open' sin actividad hace ${HORAS_INACTIVIDAD_CONVERSACION} h (todas las escuelas): ${inactivas ?? 0}`
        + ' (puede solaparse con las respondidas)');
    console.log(`Borradores 'pending' de más de ${HORAS_VIDA_BORRADOR} h → 'expired' (todas las escuelas): ${viejos ?? 0}`);

    if (APLICAR) {
        const cerradas = await cerrarConversacionesInactivas(ahora);
        const expirados = await expirarBorradoresViejos(ahora);
        console.log(`✔ Aplicado: ${cerradas} cerrada(s) por inactividad, ${expirados} borrador(es) expirado(s).`);
    } else {
        console.log('Nada se escribió. Para aplicar: --aplicar');
    }
    linea('═');
}

main().catch((err) => {
    console.error('✗', err?.message ?? err);
    process.exit(1);
});
