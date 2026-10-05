/**
 * Estado de las plantillas de la WABA de una escuela, leído EN VIVO de Meta.
 *
 *   cd bff
 *   npx tsx scripts/wa-estado-plantillas.ts --escuela <school_id>
 *
 * SOLO LECTURA: hace únicamente GET a Graph y SELECT a la base. No escribe en
 * whatsapp_template_status (eso lo hace el job de sync) ni registra nada en Meta.
 *
 * Además del estado de cada plantilla muestra:
 *   - qué concepto de la cobranza usa cada una (CONCEPTOS del servicio) y cuáles
 *     faltan en esta WABA;
 *   - si nuestra app está suscrita a la WABA (GET /{waba}/subscribed_apps). Sin
 *     suscripción, Meta no manda message_template_status_update y la aprobación
 *     solo se entera por el sync.
 *   - lo que hay guardado en whatsapp_template_status (si la migración ya se aplicó).
 *
 * El token sale cifrado de la base y se descifra en memoria; nunca se imprime.
 */

import 'dotenv/config';
import { supabase } from '../src/config/supabase';
import { decryptToken } from '../src/services/whatsapp.service';
import { CONCEPTOS, listarPlantillasEnMeta } from '../src/services/whatsapp-plantillas.service';

const GRAPH = `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION || 'v21.0'}`;
const linea = (t = '─') => console.log(t.repeat(72));

function arg(nombre: string): string | undefined {
    const i = process.argv.indexOf(nombre);
    return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
    const escuela = arg('--escuela');
    if (!escuela) {
        console.error('Uso: npx tsx scripts/wa-estado-plantillas.ts --escuela <school_id>');
        process.exit(1);
    }

    const { data, error } = await supabase
        .from('school_whatsapp_integrations')
        .select('id, waba_id, display_phone_number, status, access_token_encrypted, school:schools(name)')
        .eq('school_id', escuela);
    if (error) throw new Error(`Error leyendo la integración: ${error.message}`);
    if (!data?.length) throw new Error(`La escuela ${escuela} no tiene WhatsApp conectado.`);

    for (const i of data as any[]) {
        linea('═');
        console.log(`  ${i.school?.name ?? '—'} · ${i.display_phone_number ?? '—'} · WABA ${i.waba_id ?? '—'} · integración ${i.status}`);
        linea('═');
        if (!i.waba_id || !i.access_token_encrypted) {
            console.log('  Sin waba_id o sin token: nada que consultar.');
            continue;
        }
        const token = decryptToken(i.access_token_encrypted);

        const plantillas = await listarPlantillasEnMeta(i.waba_id, token);
        const usadas = new Map(Object.entries(CONCEPTOS).map(([c, d]) => [`${d.plantilla}|${d.idioma}`, c]));

        console.log(`  ${'PLANTILLA'.padEnd(30)} ${'IDIOMA'.padEnd(7)} ${'CATEGORÍA'.padEnd(15)} ${'ESTADO'.padEnd(10)} CONCEPTO`);
        linea();
        for (const t of plantillas.sort((a, b) => String(a.name).localeCompare(String(b.name)))) {
            const concepto = usadas.get(`${t.name}|${t.language}`) ?? '';
            const motivo = t.rejected_reason && t.rejected_reason !== 'NONE' ? `  (${t.rejected_reason})` : '';
            console.log(`  ${String(t.name).padEnd(30)} ${String(t.language).padEnd(7)} ${String(t.category).padEnd(15)} ${String(t.status).padEnd(10)} ${concepto}${motivo}`);
        }
        linea();

        const enWaba = new Set(plantillas.map((t) => `${t.name}|${t.language}`));
        const faltan = Object.entries(CONCEPTOS).filter(([, d]) => !enWaba.has(`${d.plantilla}|${d.idioma}`));
        const listas = Object.entries(CONCEPTOS).filter(([, d]) =>
            plantillas.some((t) => t.name === d.plantilla && t.language === d.idioma && t.status === 'APPROVED' && t.category === 'UTILITY'));
        console.log(`  Conceptos listos para enviar (APPROVED + UTILITY): ${listas.length}/${Object.keys(CONCEPTOS).length}`
            + (listas.length ? `  → ${listas.map(([c]) => c).join(', ')}` : ''));
        if (faltan.length) console.log(`  Conceptos sin plantilla en esta WABA: ${faltan.map(([c, d]) => `${c} (${d.plantilla})`).join(', ')}`);

        // ¿Nos llegan los eventos de esta WABA?
        const r = await fetch(`${GRAPH}/${i.waba_id}/subscribed_apps`, { headers: { Authorization: `Bearer ${token}` } });
        const j: any = await r.json().catch(() => ({}));
        if (r.ok) {
            const apps = (j.data ?? []).map((a: any) => a?.whatsapp_business_api_data?.name ?? a?.whatsapp_business_api_data?.id ?? '?');
            console.log(`  Apps suscritas a la WABA: ${apps.length ? apps.join(', ') : 'NINGUNA (no llegarán eventos de plantilla)'}`);
        } else {
            console.log(`  subscribed_apps: no se pudo leer (${j?.error?.message ?? r.status})`);
        }

        const { data: eventos } = await supabase
            .from('whatsapp_account_events')
            .select('id')
            .eq('field', 'message_template_status_update')
            .or(`integration_id.eq.${i.id},waba_id.eq.${i.waba_id}`);
        console.log(`  Eventos de plantilla recibidos por el webhook: ${eventos?.length ?? 0}`);

        const { data: guardadas, error: errTabla } = await supabase
            .from('whatsapp_template_status')
            .select('name, status, synced_at')
            .eq('integration_id', i.id);
        console.log(errTabla
            ? `  whatsapp_template_status: no disponible (${errTabla.message})`
            : `  whatsapp_template_status: ${guardadas?.length ?? 0} fila(s) guardadas`);
    }
    linea('═');
}

main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
