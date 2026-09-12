/**
 * Registra una plantilla de mensaje en la WABA de una escuela.
 *
 *   npx tsx scripts/wa-registrar-plantilla.ts <nombre-del-json>
 *   npx tsx scripts/wa-registrar-plantilla.ts comprobante_rechazado
 *
 * La salida está pensada para ser LEGIBLE EN UN VIDEO: el App Review de Meta
 * pide un screencast que demuestre el uso de `whatsapp_business_management`, y
 * lo que hay que ver es la llamada, la respuesta con el id y el estado, y la
 * plantilla ya listada en la cuenta.
 *
 * El token sale cifrado de la base y se descifra en memoria: nunca se imprime,
 * ni siquiera parcialmente, porque este script se graba en pantalla.
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { supabase } from '../src/config/supabase';
import { decryptToken } from '../src/services/whatsapp.service';

const GRAPH = 'https://graph.facebook.com/v21.0';
const DIR = path.join(__dirname, '..', 'whatsapp-templates');

const linea = (t = '─') => console.log(t.repeat(64));

async function main() {
    const nombre = process.argv[2];
    if (!nombre) {
        console.error('Falta el nombre. Ej: npx tsx scripts/wa-registrar-plantilla.ts comprobante_rechazado');
        process.exit(1);
    }

    const ruta = path.join(DIR, `${nombre}.json`);
    if (!fs.existsSync(ruta)) {
        console.error(`No existe ${ruta}`);
        process.exit(1);
    }
    const plantilla = JSON.parse(fs.readFileSync(ruta, 'utf8'));

    const { data: integracion, error } = await supabase
        .from('school_whatsapp_integrations')
        .select('waba_id, display_phone_number, access_token_encrypted, school:schools(name)')
        .limit(1)
        .single();

    if (error || !integracion?.access_token_encrypted) {
        console.error('No hay una integración de WhatsApp con token.');
        process.exit(1);
    }
    const token = decryptToken(integracion.access_token_encrypted as string);
    const waba = integracion.waba_id as string;

    linea('═');
    console.log('  SportMaps · registro de plantilla de WhatsApp');
    linea('═');
    console.log(`  Escuela : ${(integracion as any).school?.name ?? '—'}`);
    console.log(`  Número  : ${integracion.display_phone_number ?? '—'}`);
    console.log(`  WABA    : ${waba}`);
    linea();

    const cuerpo = (plantilla.components ?? []).find((c: any) => c.type === 'BODY');
    console.log(`  Plantilla : ${plantilla.name}`);
    console.log(`  Idioma    : ${plantilla.language}`);
    console.log(`  Categoría : ${plantilla.category}`);
    console.log('  Texto     :');
    for (const l of String(cuerpo?.text ?? '').match(/.{1,56}(\s|$)/g) ?? []) {
        console.log(`      ${l.trim()}`);
    }
    linea();

    console.log(`  POST ${GRAPH}/${waba}/message_templates`);
    console.log();

    const res = await fetch(`${GRAPH}/${waba}/message_templates`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(plantilla),
    });
    const json: any = await res.json();

    console.log(`  Respuesta de Meta — HTTP ${res.status}`);
    console.log();
    console.log(JSON.stringify(json, null, 2).split('\n').map((l) => '      ' + l).join('\n'));
    linea();

    if (!res.ok) {
        console.log('  ✗ No se registró.');
        console.log(`    ${json?.error?.error_user_msg ?? json?.error?.message ?? ''}`);
        process.exit(1);
    }

    // Releer de la cuenta: que se vea que quedó, no solo que el POST respondió.
    const lista = await fetch(
        `${GRAPH}/${waba}/message_templates?fields=name,status,category,language&limit=100`,
        { headers: { Authorization: `Bearer ${token}` } },
    );
    const lj: any = await lista.json();
    const recien = (lj.data ?? []).find((t: any) => t.name === plantilla.name);

    console.log('  Verificación — la plantilla en la cuenta de WhatsApp:');
    console.log();
    if (recien) {
        console.log(`      nombre    : ${recien.name}`);
        console.log(`      estado    : ${recien.status}`);
        console.log(`      categoría : ${recien.category}`);
        console.log(`      idioma    : ${recien.language}`);
    } else {
        console.log('      (todavía no aparece en el listado)');
    }
    linea();
    console.log(`  Total de plantillas en la cuenta: ${(lj.data ?? []).length}`);
    linea('═');
}

main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
