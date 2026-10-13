/**
 * wa-plataforma — operación del canal de WhatsApp de PLATAFORMA (número
 * comercial de SportMaps). Spec: docs/specs/canal-whatsapp-plataforma.md §8.
 *
 *   npx tsx scripts/wa-plataforma.ts estado
 *   npx tsx scripts/wa-plataforma.ts conectar --phone-number-id <id> --waba-id <id> --token-file <ruta> [--aplicar]
 *   npx tsx scripts/wa-plataforma.ts plantillas [--aplicar]
 *   npx tsx scripts/wa-plataforma.ts habilitar-escuela <school_id> [--aplicar]
 *   npx tsx scripts/wa-plataforma.ts deshabilitar-escuela <school_id> [--aplicar]
 *
 * Sin --aplicar NO escribe nada (ni en la base ni en Meta): muestra lo que haría.
 *
 * El token NUNCA se imprime ni va a .env: se lee de un archivo, se valida
 * contra Graph, se cifra (WHATSAPP_TOKEN_ENC_KEY) en platform_wa_canal y el
 * archivo se sobrescribe y borra (igual que wa-set-token.ts).
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { supabase } from '../src/config/supabase';
import { encryptToken, decryptToken } from '../src/services/whatsapp.service';

const GRAPH = `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION || 'v21.0'}`;
const DIR_PLANTILLAS = path.join(__dirname, '..', 'whatsapp-templates', 'plataforma');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const args = process.argv.slice(2);
const cmd = args[0];
const aplicar = args.includes('--aplicar');
function opcion(nombre: string): string | null {
    const i = args.indexOf(nombre);
    return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
}
function salir(msg: string): never {
    console.error(`✗ ${msg}`);
    process.exit(1);
}
const modo = () => (aplicar ? 'APLICAR' : 'SIMULACIÓN (agrega --aplicar para escribir)');

async function canal(): Promise<any | null> {
    const { data, error } = await supabase.from('platform_wa_canal').select('*').eq('id', 'sportmaps').maybeSingle();
    if (error) salir(`No se pudo leer platform_wa_canal (¿falta aplicar la migración 20261009115335?): ${error.message}`);
    return data;
}

function tokenDelCanal(c: any): string {
    if (!c?.access_token_encrypted) salir('El canal no tiene token. Corre primero: conectar … --aplicar');
    return decryptToken(c.access_token_encrypted);
}

async function estado() {
    const c = await canal();
    if (!c) {
        console.log('Canal de plataforma: NO configurado (sin fila en platform_wa_canal).');
        return;
    }
    console.log(`Canal: ${c.display_phone_number ?? '—'} · phone_number_id ${c.phone_number_id} · WABA ${c.waba_id} · status ${c.status}`);
    console.log(`PLATFORM_WA_ENABLED=${process.env.PLATFORM_WA_ENABLED ?? '(no definida)'} · PLATFORM_WA_TESTERS=${process.env.PLATFORM_WA_TESTERS ? '(definida)' : '(vacía)'}  ← valores de ESTE .env, no de Render`);
    const token = tokenDelCanal(c);
    const n = await fetch(`${GRAPH}/${c.phone_number_id}?fields=display_phone_number,verified_name,name_status,quality_rating,platform_type,status,is_on_biz_app`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json()).catch((e) => ({ error: { message: e.message } }));
    if ((n as any).error) console.log(`  Graph (número): ✗ ${(n as any).error.message}`);
    else console.log(`  Graph (número): ${JSON.stringify(n)}`);
    const t: any = await fetch(`${GRAPH}/${c.waba_id}/message_templates?fields=name,status,category,language&limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json()).catch((e) => ({ error: { message: e.message } }));
    if (t.error) {
        console.log(`  Plantillas: ✗ ${t.error.message}`);
    } else {
        const propias = (t.data ?? []).filter((x: any) => String(x.name).startsWith('sm_'));
        console.log(`  Plantillas sm_* en la WABA: ${propias.length}`);
        for (const x of propias) console.log(`    ${x.name.padEnd(30)} ${x.status.padEnd(10)} ${x.category} ${x.language}`);
    }
    const { data: escuelas } = await supabase.from('platform_wa_escuelas').select('school_id, habilitado, schools(name)').eq('habilitado', true);
    console.log(`  Escuelas habilitadas: ${(escuelas ?? []).map((e: any) => e.schools?.name ?? e.school_id).join(', ') || 'ninguna'}`);
    const { count } = await supabase.from('platform_wa_suscripciones').select('id', { count: 'exact', head: true }).eq('estado', 'activa');
    console.log(`  Suscripciones activas: ${count ?? 0}`);
}

async function conectar() {
    const phoneNumberId = opcion('--phone-number-id') ?? salir('Falta --phone-number-id');
    const wabaId = opcion('--waba-id') ?? salir('Falta --waba-id');
    const archivo = opcion('--token-file') ?? salir('Falta --token-file');
    const abs = path.resolve(archivo);
    if (!fs.existsSync(abs)) salir(`No existe ${abs}`);
    const token = fs.readFileSync(abs, 'utf8').trim();
    if (token.length < 20) salir('El archivo del token está vacío o es demasiado corto.');
    console.log(`Modo: ${modo()}`);

    const num: any = await fetch(`${GRAPH}/${phoneNumberId}?fields=display_phone_number,verified_name,name_status,platform_type,is_on_biz_app`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());
    if (num.error) salir(`Graph rechazó el token para ${phoneNumberId}: ${num.error.message}. No se escribió nada.`);
    console.log(`✓ El token alcanza ${num.display_phone_number} (${num.verified_name ?? 's/n'}) · nombre: ${num.name_status ?? '—'} · plataforma: ${num.platform_type ?? '—'} · app Business: ${num.is_on_biz_app ?? '—'}`);
    if (String(num.display_phone_number ?? '').replace(/\D/g, '') !== '573202683539') {
        console.warn('⚠ Ese número NO es el comercial oficial (+57 320 268 3539). Revisa antes de aplicar.');
    }
    const subs: any = await fetch(`${GRAPH}/${wabaId}/subscribed_apps`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    if (subs.error) console.warn(`⚠ No se pudo leer subscribed_apps de la WABA: ${subs.error.message}`);
    else if (!(subs.data ?? []).length) console.warn('⚠ La WABA no tiene la app suscrita: corre POST /<WABA_ID>/subscribed_apps (spec §8.4) o el webhook no traerá nada.');
    else console.log(`✓ Apps suscritas a la WABA: ${(subs.data ?? []).map((a: any) => a?.whatsapp_business_api_data?.name ?? a?.id ?? '?').join(', ')}`);

    const cifrado = encryptToken(token);
    if (decryptToken(cifrado) !== token) salir('El round-trip de cifrado no coincide.');
    if (!aplicar) {
        console.log('Simulación: se guardaría el canal (status=activo) con el token cifrado. El archivo del token NO se borró.');
        return;
    }
    const ahora = new Date().toISOString();
    const { error } = await supabase.from('platform_wa_canal').upsert({
        id: 'sportmaps', phone_number_id: phoneNumberId, waba_id: wabaId,
        display_phone_number: String(num.display_phone_number ?? '').replace(/\D/g, '') || null,
        access_token_encrypted: cifrado, status: 'activo', conectado_at: ahora, token_rotated_at: ahora,
    }, { onConflict: 'id' });
    if (error) salir(`No se pudo guardar: ${error.message}`);
    console.log('✓ Canal guardado (status=activo).');
    try {
        fs.writeFileSync(abs, '0'.repeat(token.length));
        fs.unlinkSync(abs);
        console.log('✓ Archivo del token sobrescrito y borrado.');
    } catch (e: any) {
        console.warn(`⚠ No se pudo borrar ${abs}: ${e.message} — bórralo a mano.`);
    }
    console.log('Los BFF releen el canal en ≤ 1 min (cache).');
}

async function plantillas() {
    const archivos = fs.readdirSync(DIR_PLANTILLAS).filter((f) => f.endsWith('.json')).sort();
    console.log(`Modo: ${modo()} · ${archivos.length} plantilla(s) en ${DIR_PLANTILLAS}`);
    const c = aplicar ? await canal() : null;
    if (aplicar && !c) salir('El canal no está configurado. Corre primero: conectar … --aplicar');
    const token = c ? tokenDelCanal(c) : null;
    for (const f of archivos) {
        const p = JSON.parse(fs.readFileSync(path.join(DIR_PLANTILLAS, f), 'utf8'));
        const cuerpo = (p.components ?? []).find((x: any) => x.type === 'BODY')?.text ?? '';
        console.log(`\n→ ${p.name} (${p.category}, ${p.language})\n  ${cuerpo}`);
        if (!aplicar) continue;
        const r = await fetch(`${GRAPH}/${c.waba_id}/message_templates`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(p),
        });
        const j: any = await r.json().catch(() => ({}));
        if (!r.ok) console.log(`  ✗ ${j?.error?.error_user_msg || j?.error?.message || r.status}`);
        else console.log(`  ✓ id ${j.id} · status ${j.status} · categoría ${j.category ?? p.category}`);
    }
    if (!aplicar) console.log('\nSimulación: no se mandó nada a Meta.');
    else console.log('\nLa aprobación llega en minutos u horas. Revisa con: npx tsx scripts/wa-plataforma.ts estado');
}

async function habilitarEscuela(habilitado: boolean) {
    const schoolId = args[1];
    if (!schoolId || !UUID.test(schoolId)) salir('Falta el school_id (uuid).');
    const { data: escuela } = await supabase.from('schools').select('id, name').eq('id', schoolId).maybeSingle();
    if (!escuela) salir(`No existe la escuela ${schoolId}.`);
    console.log(`Modo: ${modo()} · ${(escuela as any).name}: habilitado → ${habilitado}`);
    if (!aplicar) return;
    const { error } = await supabase.from('platform_wa_escuelas').upsert({ school_id: schoolId, habilitado }, { onConflict: 'school_id' });
    if (error) salir(error.message);
    console.log('✓ Guardado.');
}

async function main() {
    switch (cmd) {
        case 'estado': return estado();
        case 'conectar': return conectar();
        case 'plantillas': return plantillas();
        case 'habilitar-escuela': return habilitarEscuela(true);
        case 'deshabilitar-escuela': return habilitarEscuela(false);
        default:
            console.log('Uso: estado | conectar --phone-number-id <id> --waba-id <id> --token-file <ruta> [--aplicar] | plantillas [--aplicar] | habilitar-escuela <school_id> [--aplicar] | deshabilitar-escuela <school_id> [--aplicar]');
            process.exit(cmd ? 1 : 0);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
