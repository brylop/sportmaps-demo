/**
 * Carga los horarios de entrenamiento de Dynasty en `teams.schedule`.
 *
 *   cd bff
 *   npx tsx scripts/dynasty-cargar-horarios.ts --ver      # no escribe nada
 *   npx tsx scripts/dynasty-cargar-horarios.ts --aplicar
 *
 * DE DÓNDE SALEN
 *
 * De las 10 piezas gráficas que la escuela publicó (recibidas 2026-09-17).
 * Transcritas a mano, una por una. NO hay ninguna inferida: los tres equipos
 * cuyo horario no salió en ninguna imagen se quedan vacíos a propósito.
 *
 * Copiar «el horario que más se repite» a los que faltan fue considerado y
 * descartado: serían 76 familias de INFANTIL FEMENINO —el segundo grupo más
 * grande— a las que el bot les diría, con toda seguridad, un día y una hora que
 * nadie verificó. Un horario inventado no se ve como un error: se ve como una
 * respuesta, y la familia llega el día equivocado.
 *
 * FORMATO
 *
 * El que ya usa la plataforma (visto en Club Campestre Demo):
 *
 *     [{ "day": 2, "time": "17:00", "end": "19:00" }]
 *
 * `day` sigue a Date.getDay(): 0=domingo … 6=sábado.
 *
 * Se agrega `place` por franja, que el formato original no tenía y Dynasty sí
 * necesita: sus grupos rotan entre tres sedes DENTRO de la misma semana —
 * Menores Masculino entrena martes en el Coliseo y jueves en Nido del Colibrí—.
 * Sin ese campo el bot diría la sede equivocada la mitad de las veces. `jsonb`
 * admite la clave extra y quien no la lea la ignora.
 */

import dotenv from 'dotenv';
dotenv.config();
import { supabase } from '../src/config/supabase';

const aplicar = process.argv.includes('--aplicar');

const COLISEO = 'Coliseo Dynasty DC';
const COLIBRI = 'Cancha externa Nido del Colibrí';
const ALSACIA = 'Cancha externa Asoalsacia';

/** day: 0=domingo … 6=sábado, como Date.getDay(). */
type Franja = { day: number; time: string; end: string; place: string; group?: string };

// INTERMEDIO y MENORES FEMENINO se dividen en dos subgrupos que la escuela
// publica por separado pero que el sistema no modela: hay UN equipo con 106 y
// 42 atletas. En vez de crear equipos y mover gente a ciegas —o de dejar 148
// familias sin horario— se cargan las DOS tandas etiquetadas, y el bot las
// nombra. El papa sabe en cual esta su hijo; nosotros no.

/**
 * Nombre EXACTO del equipo en la base → sus franjas.
 *
 * Solo los que salieron en una imagen. Los demás no están acá, y eso es
 * deliberado — ver la cabecera.
 */
const HORARIOS: Record<string, Franja[]> = {
    'MINIVOLLEY BENJAMINES': [
        { day: 1, time: '17:00', end: '19:00', place: COLISEO },
        { day: 3, time: '17:00', end: '19:00', place: COLISEO },
        { day: 6, time: '08:00', end: '10:00', place: COLISEO },
        { day: 0, time: '08:00', end: '10:00', place: COLISEO },
    ],
    'INFANTIL MASCULINO': [
        { day: 2, time: '18:30', end: '20:30', place: COLISEO },
        { day: 4, time: '18:30', end: '20:30', place: COLISEO },
        { day: 6, time: '07:00', end: '09:00', place: COLISEO },
        { day: 0, time: '08:00', end: '10:00', place: ALSACIA },
    ],
    'MENORES MASCULINO': [
        { day: 2, time: '16:00', end: '18:00', place: COLISEO },
        { day: 4, time: '16:00', end: '18:00', place: COLIBRI },
        { day: 6, time: '09:30', end: '11:30', place: COLISEO },
        { day: 0, time: '09:30', end: '11:30', place: ALSACIA },
    ],
    'INTERMEDIO': [
        { day: 1, time: '16:00', end: '18:00', place: COLISEO, group: 'Origen' },
        { day: 3, time: '16:00', end: '18:00', place: COLISEO, group: 'Origen' },
        { day: 5, time: '16:00', end: '18:00', place: COLISEO, group: 'Origen' },
        { day: 6, time: '07:00', end: '09:00', place: COLISEO, group: 'Origen' },
        { day: 0, time: '09:30', end: '11:30', place: ALSACIA, group: 'Origen' },
        { day: 2, time: '16:00', end: '18:00', place: COLIBRI, group: 'Evolución' },
        { day: 4, time: '16:00', end: '18:00', place: COLISEO, group: 'Evolución' },
        { day: 6, time: '09:30', end: '11:30', place: ALSACIA, group: 'Evolución' },
        { day: 0, time: '07:00', end: '09:00', place: COLISEO, group: 'Evolución' },
    ],
    'MENORES FEMENINO': [
        { day: 2, time: '17:00', end: '19:00', place: COLIBRI, group: 'White' },
        { day: 4, time: '17:00', end: '19:00', place: COLISEO, group: 'White' },
        { day: 6, time: '09:30', end: '11:30', place: ALSACIA, group: 'White' },
        { day: 0, time: '07:00', end: '09:00', place: COLISEO, group: 'White' },
        { day: 2, time: '18:30', end: '20:30', place: COLISEO, group: 'Selección' },
        { day: 4, time: '18:30', end: '20:30', place: COLISEO, group: 'Selección' },
        { day: 5, time: '18:30', end: '20:30', place: COLISEO, group: 'Selección' },
    ],
    'JUVENIL MAYORES MASCULINO': [
        { day: 2, time: '20:00', end: '22:00', place: COLISEO },
        { day: 5, time: '20:00', end: '22:00', place: COLISEO },
    ],
    'NUEVA ERA': [
        { day: 2, time: '17:00', end: '19:00', place: COLISEO },
        { day: 3, time: '17:00', end: '19:00', place: COLIBRI },
        { day: 5, time: '16:00', end: '18:00', place: COLISEO },
        { day: 0, time: '09:30', end: '11:30', place: COLISEO },
    ],
};

/**
 * Equipos que NO se tocan, y por qué. Se imprimen para que la razón quede a la
 * vista en cada corrida, no enterrada en un comentario.
 */
const SIN_CARGAR: Record<string, string> = {
    'INFANTIL FEMENINO':        'no salió en ninguna imagen — 76 atletas, el 2º grupo más grande',
    'JUVENIL MAYORES FEMENINO': 'no salió en ninguna imagen',
    'SENIORS':                  'no salió en ninguna imagen',
    'MINIVOLLEY -BENJAMINES (DUPLICADO - NO USAR)': 'el nombre lo dice; tiene 3 atletas que alguien debería mover',
};

const DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

async function main() {
    const { data: escuela } = await supabase
        .from('schools').select('id, name').ilike('name', '%DYNASTY%').maybeSingle();
    if (!escuela) { console.error('No encontré Dynasty.'); process.exit(1); }

    const { data: equipos } = await supabase
        .from('teams').select('id, name, schedule, student_count')
        .eq('school_id', (escuela as any).id).limit(100);

    console.log(`\n${(escuela as any).name}\n${'─'.repeat(64)}`);

    let escritos = 0;
    for (const t of (equipos ?? []) as any[]) {
        const franjas = HORARIOS[String(t.name).trim()];

        if (!franjas) {
            const razon = SIN_CARGAR[String(t.name).trim()] ?? 'sin horario conocido';
            console.log(`  ·  ${String(t.name).padEnd(30)} SIN CARGAR — ${razon}`);
            continue;
        }

        const resumen = franjas.map((f) => `${DIA[f.day].slice(0, 3)} ${f.time}`).join(', ');
        if (!aplicar) {
            console.log(`  →  ${String(t.name).padEnd(30)} ${resumen}`);
            continue;
        }

        const { error } = await supabase
            .from('teams').update({ schedule: franjas }).eq('id', t.id);
        if (error) {
            console.log(`  ✗  ${String(t.name).padEnd(30)} ${error.message}`);
            continue;
        }
        console.log(`  ✓  ${String(t.name).padEnd(30)} ${resumen}`);
        escritos++;
    }

    console.log('');
    if (!aplicar) {
        console.log('Esto fue solo la vista previa. Para escribir: --aplicar\n');
    } else {
        console.log(`${escritos} equipos con horario cargado.`);
        console.log('Los que faltan los tiene que mandar la escuela: NO se copian del que más se repite,');
        console.log('porque un horario inventado manda a la familia el día equivocado.\n');
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
