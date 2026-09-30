/**
 * Copia las plantillas APROBADAS de la WABA de una escuela a la de otra.
 *
 *   cd bff
 *   npx tsx scripts/wa-copiar-plantillas.ts --desde <school_id> --hacia <school_id>            # solo muestra
 *   npx tsx scripts/wa-copiar-plantillas.ts --desde <school_id> --hacia <school_id> --aplicar  # registra
 *
 * POR QUÉ EXISTE
 *
 * Meta aprueba cada plantilla DENTRO de una WABA. Una escuela que entra por
 * Coexistence trae su propia WABA, y desde su número solo se pueden mandar las
 * plantillas que estén en ella: las aprobadas en la WABA de prueba no le sirven.
 * Lo que sí se reusa es el texto, que la escuela ya revisó y Meta ya aceptó una
 * vez. Se copia tal cual está en Meta —no desde los JSON del repo— porque lo
 * aprobado es lo que vive allá, incluidas las creadas desde la pantalla.
 *
 * QUÉ COPIA
 *
 *   - Solo APPROVED, solo idiomas `es*` (deja afuera las de muestra de Meta,
 *     `hello_world` y `jaspers_market_*`).
 *   - Solo UTILITY, salvo `--con-marketing`. Meta recategorizó algunas a
 *     MARKETING: cuestan ~3x y exigen opt-in de marketing. La salida es apelar,
 *     no copiarlas así (ver whatsapp-templates/README.md).
 *   - Salta las que ya existan en la WABA destino con el mismo nombre e idioma:
 *     se puede correr dos veces sin duplicar ni fallar.
 *
 * El token de cada lado sale cifrado de la base y se descifra en memoria; nunca
 * se imprime.
 */

import 'dotenv/config';
import { supabase } from '../src/config/supabase';
import { decryptToken } from '../src/services/whatsapp.service';

const GRAPH = 'https://graph.facebook.com/v21.0';

const linea = (t = '─') => console.log(t.repeat(64));

function arg(nombre: string): string | undefined {
    const i = process.argv.indexOf(nombre);
    return i >= 0 ? process.argv[i + 1] : undefined;
}

async function integracionDe(schoolId: string) {
    const { data, error } = await supabase
        .from('school_whatsapp_integrations')
        .select('waba_id, display_phone_number, access_token_encrypted, school:schools(name)')
        .eq('school_id', schoolId);
    if (error) throw new Error(`Error leyendo la integración de ${schoolId}: ${error.message}`);
    if (!data?.length) throw new Error(`La escuela ${schoolId} no tiene WhatsApp conectado.`);
    if (data.length > 1) throw new Error(`La escuela ${schoolId} tiene ${data.length} integraciones; resolver a mano.`);
    const i = data[0] as any;
    if (!i.waba_id) throw new Error(`La integración de ${schoolId} no tiene waba_id.`);
    if (!i.access_token_encrypted) throw new Error(`La integración de ${schoolId} no tiene token.`);
    return {
        nombre: i.school?.name ?? '—',
        numero: i.display_phone_number ?? '—',
        waba: i.waba_id as string,
        token: decryptToken(i.access_token_encrypted as string),
    };
}

async function plantillasDe(waba: string, token: string): Promise<any[]> {
    const todas: any[] = [];
    let url: string | undefined =
        `${GRAPH}/${waba}/message_templates?fields=name,status,category,language,components&limit=100`;
    while (url) {
        const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const j: any = await r.json();
        if (!r.ok) throw new Error(`Graph rechazó el listado de ${waba}: ${j?.error?.message}`);
        todas.push(...(j.data ?? []));
        url = j.paging?.next;
    }
    return todas;
}

async function main() {
    const desde = arg('--desde');
    const hacia = arg('--hacia');
    const aplicar = process.argv.includes('--aplicar');
    const conMarketing = process.argv.includes('--con-marketing');

    if (!desde || !hacia) {
        console.error('Uso: npx tsx scripts/wa-copiar-plantillas.ts --desde <school_id> --hacia <school_id> [--aplicar] [--con-marketing]');
        process.exit(1);
    }
    if (desde === hacia) {
        console.error('Origen y destino son la misma escuela.');
        process.exit(1);
    }

    const origen = await integracionDe(desde);
    const destino = await integracionDe(hacia);
    if (origen.waba === destino.waba) {
        console.error(`Las dos escuelas comparten la WABA ${origen.waba}: las plantillas ya están ahí.`);
        process.exit(1);
    }

    linea('═');
    console.log(`  Copia de plantillas${aplicar ? '' : '  ·  SIMULACIÓN (agrega --aplicar para registrar)'}`);
    linea('═');
    console.log(`  Desde : ${origen.nombre} · ${origen.numero} · WABA ${origen.waba}`);
    console.log(`  Hacia : ${destino.nombre} · ${destino.numero} · WABA ${destino.waba}`);
    linea();

    const enOrigen = await plantillasDe(origen.waba, origen.token);
    const enDestino = await plantillasDe(destino.waba, destino.token);
    const yaEsta = new Set(enDestino.map((t) => `${t.name}|${t.language}`));

    const candidatas = enOrigen.filter((t) => t.status === 'APPROVED' && String(t.language).startsWith('es'));
    const saltadasMarketing = conMarketing ? [] : candidatas.filter((t) => t.category !== 'UTILITY');
    const aCopiar = candidatas.filter((t) => conMarketing || t.category === 'UTILITY');

    let registradas = 0, existentes = 0, fallidas = 0;

    for (const t of aCopiar) {
        const etiqueta = `${t.name} (${t.language}, ${t.category})`;

        if (yaEsta.has(`${t.name}|${t.language}`)) {
            console.log(`  = ${etiqueta} — ya está en destino`);
            existentes++;
            continue;
        }
        // Un HEADER de imagen/video/documento trae un handle atado a la WABA de
        // origen; reenviarlo no sirve. Ninguna de las nuestras lo usa hoy.
        const headerMedia = (t.components ?? []).some(
            (c: any) => c.type === 'HEADER' && c.format && c.format !== 'TEXT',
        );
        if (headerMedia) {
            console.log(`  ! ${etiqueta} — tiene encabezado multimedia; copiarla a mano`);
            fallidas++;
            continue;
        }
        if (!aplicar) {
            console.log(`  + ${etiqueta} — se registraría`);
            continue;
        }

        const r = await fetch(`${GRAPH}/${destino.waba}/message_templates`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${destino.token}`, 'content-type': 'application/json' },
            body: JSON.stringify({
                name: t.name,
                language: t.language,
                category: t.category,
                components: t.components,
            }),
        });
        const j: any = await r.json();
        if (r.ok) {
            console.log(`  ✓ ${etiqueta} — ${j.status ?? 'enviada'}${j.category && j.category !== t.category ? ` · Meta la pasó a ${j.category}` : ''}`);
            registradas++;
        } else {
            console.log(`  ✗ ${etiqueta} — ${j?.error?.error_user_msg ?? j?.error?.message ?? `HTTP ${r.status}`}`);
            fallidas++;
        }
    }

    for (const t of saltadasMarketing) {
        console.log(`  · ${t.name} (${t.language}, ${t.category}) — omitida: no es UTILITY (usa --con-marketing si de verdad va así)`);
    }

    linea();
    if (aplicar) {
        console.log(`  Registradas: ${registradas} · ya estaban: ${existentes} · fallidas: ${fallidas} · omitidas por categoría: ${saltadasMarketing.length}`);
        console.log('  La aprobación llega por el webhook message_template_status_update (minutos, a veces horas).');
    } else {
        console.log(`  A registrar: ${aCopiar.length - existentes} · ya estaban: ${existentes} · omitidas por categoría: ${saltadasMarketing.length}`);
    }
    linea('═');
    if (fallidas) process.exit(1);
}

main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
