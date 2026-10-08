/**
 * Informe de calidad y costo del bot — SIMULACIÓN. Imprime el mismo informe
 * que sale los lunes 8:00 COT (src/services/informe-calidad-bot.service.ts).
 * NO manda correos ni escribe en la base: solo SELECT. Solo agregados (sin
 * nombres de familias ni contenido de conversaciones).
 *
 *   cd bff
 *   npx tsx scripts/informe-calidad-bot.ts --desde 2026-10-01
 *   npx tsx scripts/informe-calidad-bot.ts --desde 2026-10-01 --hasta 2026-10-07 --escuela <school_id>
 *   npx tsx scripts/informe-calidad-bot.ts --desde 2026-10-01 --json          # estructura completa
 *   npx tsx scripts/informe-calidad-bot.ts --desde 2026-10-01 --html out.html # el correo tal cual
 *
 * Fechas = días de Bogotá; `--hasta` es inclusive (por defecto, ahora).
 */

import 'dotenv/config';
import { writeFileSync } from 'fs';
import { armarInformeCalidadBot, htmlInforme, lineasInforme } from '../src/services/informe-calidad-bot.service';

function arg(nombre: string): string | undefined {
    const i = process.argv.indexOf(nombre);
    return i >= 0 ? process.argv[i + 1] : undefined;
}

function dia(s: string | undefined, nombre: string): number | undefined {
    if (!s) return undefined;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`${nombre} debe ser YYYY-MM-DD`);
    return Date.parse(`${s}T00:00:00-05:00`);
}

async function main() {
    const desde = dia(arg('--desde'), '--desde');
    if (desde === undefined) throw new Error('Falta --desde YYYY-MM-DD');
    const hastaDia = dia(arg('--hasta'), '--hasta');
    const hasta = hastaDia === undefined ? Date.now() : Math.min(hastaDia + 24 * 3600_000, Date.now());
    if (hasta <= desde) throw new Error('El rango está vacío');

    const inf = await armarInformeCalidadBot({ desde, hasta, schoolId: arg('--escuela') ?? null });
    const semana = `${new Date(desde - 5 * 3600_000).toISOString().slice(0, 10)} al ${new Date(hasta - 1 - 5 * 3600_000).toISOString().slice(0, 10)}`;

    if (process.argv.includes('--json')) {
        console.log(JSON.stringify(inf, null, 2));
    } else {
        console.log(`Informe de calidad del bot — ${semana} (SIMULACIÓN: no se envía nada)`);
        for (const l of lineasInforme(inf)) console.log(l);
    }
    const html = arg('--html');
    if (html) {
        writeFileSync(html, htmlInforme(inf, semana), 'utf8');
        console.log(`HTML escrito en ${html}`);
    }
}

main().catch((err) => {
    console.error(err?.message || err);
    process.exit(1);
});
