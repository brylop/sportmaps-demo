/**
 * Conecta el número de WhatsApp de una escuela, por la vía manual.
 *
 * Es el camino para las escuelas que NO necesitan conservar su número en el
 * celular: se agrega un número nuevo al WABA de SportMaps, lo paga SportMaps y
 * se le factura a la escuela junto al resto del servicio. La escuela no
 * registra tarjeta ni pasa por el Embedded Signup.
 *
 * Para las escuelas que SÍ quieren seguir usando su número desde el teléfono,
 * el camino es el otro: Embedded Signup con Coexistence. Ver
 * `docs/specs/whatsapp-alta-de-escuelas-y-buzon.md`.
 *
 * El token NUNCA se pasa por argumento ni por el chat: se lee de un archivo que
 * se borra al final. Mismo criterio que `wa-set-token.ts`.
 *
 *   cd bff
 *   npx tsx scripts/wa-conectar-escuela.ts <school_id> <phone_number_id> <ruta-al-token>
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
dotenv.config();
import { encryptToken, decryptToken } from '../src/services/whatsapp.service';
import { supabase } from '../src/config/supabase';

const GRAPH = `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION || 'v21.0'}`;
const [, , schoolId, phoneNumberId, tokenFile] = process.argv;

function mask(t: string): string {
    if (t.length < 16) return '(sospechosamente corto)';
    return `${t.slice(0, 6)}…${t.slice(-4)} (${t.length} chars)`;
}

async function main() {
    if (!schoolId || !phoneNumberId || !tokenFile) {
        console.error('Uso: npx tsx scripts/wa-conectar-escuela.ts <school_id> <phone_number_id> <ruta-al-token>');
        process.exit(1);
    }

    // ── 1. ¿La escuela existe y está libre? ─────────────────────────────────
    const { data: escuela } = await supabase
        .from('schools').select('id, name').eq('id', schoolId).maybeSingle();
    if (!escuela) {
        console.error(`✗ No existe la escuela ${schoolId}.`);
        process.exit(1);
    }

    const { data: yaTiene } = await supabase
        .from('school_whatsapp_integrations')
        .select('id, display_phone_number')
        .eq('school_id', schoolId)
        .maybeSingle();
    if (yaTiene) {
        console.error(`✗ ${escuela.name} ya tiene WhatsApp conectado (${yaTiene.display_phone_number}).`);
        console.error('  Para rotar el token usa wa-set-token.ts, no este script.');
        process.exit(1);
    }

    // Un mismo numero no puede atender a dos escuelas: el webhook rutea por
    // phone_number_id y no sabria a cual entregar.
    const { data: numeroOcupado } = await supabase
        .from('school_whatsapp_integrations')
        .select('school_id, school:schools(name)')
        .eq('phone_number_id', phoneNumberId)
        .maybeSingle();
    if (numeroOcupado) {
        console.error(`✗ Ese número ya está conectado a ${(numeroOcupado as any).school?.name}.`);
        process.exit(1);
    }

    // ── 2. El token ─────────────────────────────────────────────────────────
    const abs = path.resolve(tokenFile);
    if (!fs.existsSync(abs)) {
        console.error(`✗ No existe el archivo: ${abs}`);
        process.exit(1);
    }
    const token = fs.readFileSync(abs, 'utf8').trim();
    if (!token) {
        console.error('✗ El archivo está vacío.');
        process.exit(1);
    }
    console.log(`Token leído: ${mask(token)}`);

    // ── 3. ¿Sirve para ESE número? ──────────────────────────────────────────
    const numRes = await fetch(
        `${GRAPH}/${phoneNumberId}?fields=display_phone_number,verified_name`,
        { headers: { Authorization: `Bearer ${token}` } },
    );
    const num: any = await numRes.json();
    if (!numRes.ok) {
        console.error(`✗ Graph rechazó el token para ${phoneNumberId}: ${num?.error?.message}`);
        console.error('  NO se escribió nada. El archivo queda intacto para reintentar.');
        process.exit(1);
    }
    console.log(`✓ Token válido para ${num.display_phone_number} (${num.verified_name || 's/n'})`);

    // ── 4. ¿De qué WABA es? ─────────────────────────────────────────────────
    // Se pregunta en vez de pedirlo por argumento: un waba_id mal tecleado
    // rompe el ruteo de los eventos de cuenta y no da error hasta semanas
    // despues, cuando Meta recategoriza una plantilla y nadie se entera.
    const wabaRes = await fetch(
        `${GRAPH}/${phoneNumberId}?fields=whatsapp_business_account{id,name}`,
        { headers: { Authorization: `Bearer ${token}` } },
    );
    const waba: any = (await wabaRes.json())?.whatsapp_business_account;
    if (!waba?.id) {
        console.error('✗ No se pudo resolver el WABA del número. Abortado.');
        process.exit(1);
    }
    console.log(`✓ WABA ${waba.id} (${waba.name || 's/n'})`);

    // ── 5. Cifrar, con round-trip ───────────────────────────────────────────
    const encrypted = encryptToken(token);
    if (decryptToken(encrypted) !== token) {
        console.error('✗ El round-trip de cifrado no coincide. Abortado.');
        process.exit(1);
    }

    // ── 6. Escribir ─────────────────────────────────────────────────────────
    const { data: creada, error: e1 } = await supabase
        .from('school_whatsapp_integrations')
        .insert({
            school_id: schoolId,
            phone_number_id: phoneNumberId,
            waba_id: waba.id,
            display_phone_number: num.display_phone_number,
            access_token_encrypted: encrypted,
            status: 'active',
            connected_at: new Date().toISOString(),
            token_rotated_at: new Date().toISOString(),
        })
        .select('id')
        .single();
    if (e1 || !creada) {
        console.error(`✗ No se pudo crear la integración: ${e1?.message}`);
        process.exit(1);
    }

    // `mode` en la tabla tiene DEFAULT 'assisted', y el modo asistido hoy esta
    // roto: el bot guarda un borrador en whatsapp_message_drafts y ninguna
    // pantalla lee esa tabla, asi que el padre no recibe nada, en silencio.
    // Dejarlo al default significa entregarle a la escuela un canal mudo. Se
    // fuerza 'auto' hasta que exista el buzon (F3 del spec).
    const { error: e2 } = await supabase.from('whatsapp_settings').insert({
        integration_id: creada.id,
        mode: 'auto',
        ai_enabled: true,
    });
    if (e2) {
        console.error(`⚠ La integración quedó creada pero sin ajustes: ${e2.message}`);
        console.error('  El canal NO va a responder hasta que exista la fila en whatsapp_settings.');
        process.exit(1);
    }

    // ── 7. Borrar el archivo del token ──────────────────────────────────────
    fs.writeFileSync(abs, '\0'.repeat(token.length));
    fs.unlinkSync(abs);

    console.log('');
    console.log(`✓ ${escuela.name} quedó conectada.`);
    console.log(`    número      : ${num.display_phone_number}`);
    console.log(`    integración : ${creada.id}`);
    console.log(`    modo        : auto`);
    console.log(`    archivo del token borrado.`);
    console.log('');
    console.log('  Falta suscribir la app a los webhooks de ese WABA si es nuevo:');
    console.log(`    POST ${GRAPH}/${waba.id}/subscribed_apps`);
}

main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
