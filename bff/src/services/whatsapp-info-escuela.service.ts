/**
 * Lo que el bot SÍ sabe de la escuela, y —más importante— lo que NO.
 *
 * POR QUÉ EXISTE
 *
 * De las 110 preguntas de la batería de QA, unas 30 son sobre la escuela:
 * dónde queda, qué sedes tiene, qué categorías hay, a qué hora entrenan. Hoy el
 * bot no tiene NINGUNA herramienta para eso, así que las escala todas — 4 de
 * cada 5 preguntas terminan en la bandeja de la escuela.
 *
 * Lo bueno de medirlo primero: la batería dio **cero invenciones**. El bot no
 * se inventa un horario, dice que no lo tiene. Esta herramienta no viene a
 * arreglar un invento, viene a que deje de derivar lo que sí puede contestar.
 *
 * LO QUE HAY, MEDIDO EL 2026-09-22 (no supuesto)
 *
 *   sedes           1-2 por escuela, con nombre           → SÍ
 *   ciudad          Dynasty y Monster's; Besser/GYM no    → a veces
 *   dirección       Dynasty y Monster's                   → a veces
 *   equipos         todas las escuelas, con nombre        → SÍ
 *   categorías      SOLO Monster's (13)                   → casi nunca
 *   horarios        CERO en las cuatro escuelas           → NO
 *   edades          age_min/birth_year_min NULL en TODAS  → NO
 *
 * Por eso el contrato de este servicio es devolver SOLO lo que está lleno y
 * decir explícitamente qué falta. El campo `no_disponible` no es cosmético: es
 * lo que el prompt usa para que el modelo diga «eso no lo tengo» en vez de
 * deducirlo del nombre del equipo.
 *
 * NO SE DEDUCE NADA. «U15 FEMENINO» sugiere sub-15, y es tentador traducirlo a
 * «para niñas de 14 y 15 años». No se hace: la convención varía por federación
 * y por año, y una respuesta con la edad equivocada manda a una familia a la
 * categoría que no es. El nombre se devuelve tal cual y que lo interprete quien
 * sepa.
 */

import { supabase } from '../config/supabase';

export interface InfoDeEscuela {
    nombre: string;
    ciudad: string | null;
    direccion: string | null;
    sedes: string[];
    /** Deportes que aparecen en los equipos, sin repetir. */
    deportes: string[];
    /** Nombre de cada grupo/equipo, tal como lo escribió la escuela. */
    grupos: { nombre: string; sede: string | null; horario: string | null }[];
    /** Categorías formales, cuando la escuela las cargó. */
    categorias: { nombre: string; rama: string | null }[];
    /** Horario de ATENCIÓN (no de entrenamiento), si está configurado. */
    horario_atencion: string | null;
    /**
     * Qué NO se puede responder con estos datos. El prompt lo usa para que el
     * modelo lo diga en vez de deducirlo.
     */
    no_disponible: string[];
}

const vacio = (v: unknown) => String(v ?? '').trim() === '';

/** «{"dias":{"1":["16:00","20:00"]}}» → «lunes a viernes de 4:00 p. m. a 8:00 p. m.» */
function describirAtencion(bh: any): string | null {
    const dias = bh?.dias;
    if (!dias || typeof dias !== 'object') return null;

    const NOMBRES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const partes: string[] = [];
    for (let d = 0; d <= 6; d++) {
        const r = dias[String(d)];
        if (Array.isArray(r) && r.length === 2) partes.push(`${NOMBRES[d]} de ${r[0]} a ${r[1]}`);
    }
    return partes.length ? partes.join(', ') : null;
}

/**
 * Todo lo publicable de una escuela, para que el bot conteste sin inventar.
 *
 * No recibe `parent_id`: nada de esto es privado — son los mismos datos que
 * cualquiera ve en el perfil público de la escuela. Por eso tampoco hace falta
 * que el acudiente esté identificado para preguntarlo.
 */
export async function infoDeEscuela(schoolId: string): Promise<InfoDeEscuela> {
    const [escuela, sedes, equipos, categorias, ajustes] = await Promise.all([
        supabase.from('schools').select('name, city, address').eq('id', schoolId).maybeSingle(),
        supabase.from('school_branches').select('name').eq('school_id', schoolId).limit(50),
        supabase.from('teams')
            .select('name, sport, location, schedule, active')
            .eq('school_id', schoolId).limit(100),
        supabase.from('school_categories')
            .select('name, rama, sort_order')
            .eq('school_id', schoolId).eq('is_active', true)
            .order('sort_order', { ascending: true, nullsFirst: false }).limit(60),
        supabase.from('whatsapp_settings').select('business_hours').eq('school_id', schoolId).maybeSingle(),
    ]);

    const e = (escuela.data ?? {}) as any;

    // Los equipos dados de baja no se nombran: una familia preguntando por
    // grupos no necesita saber cuáles ya no existen.
    const eq = ((equipos.data ?? []) as any[]).filter((t) => t.active !== false);

    const grupos = eq.map((t) => ({
        nombre: String(t.name ?? '').trim(),
        sede: vacio(t.location) ? null : String(t.location).trim(),
        // `schedule` es jsonb/text y en las cuatro escuelas medidas está VACÍO.
        // Se devuelve igual por si alguna lo llena: el día que pase, el bot
        // empieza a contestar horarios sin que haya que tocar nada.
        horario: vacio(t.schedule) ? null : String(t.schedule).trim(),
    })).filter((g) => g.nombre);

    const info: InfoDeEscuela = {
        nombre: e.name ?? 'la escuela',
        ciudad: vacio(e.city) ? null : String(e.city).trim(),
        direccion: vacio(e.address) ? null : String(e.address).trim(),
        sedes: ((sedes.data ?? []) as any[]).map((b) => String(b.name ?? '').trim()).filter(Boolean),
        deportes: [...new Set(eq.map((t) => String(t.sport ?? '').trim()).filter(Boolean))],
        grupos,
        categorias: ((categorias.data ?? []) as any[])
            .map((c) => ({ nombre: String(c.name ?? '').trim(), rama: vacio(c.rama) ? null : String(c.rama).trim() }))
            .filter((c) => c.nombre),
        horario_atencion: describirAtencion((ajustes.data as any)?.business_hours),
        no_disponible: [],
    };

    // Lo que falta se dice EXPLÍCITO. Un campo vacío el modelo lo puede leer
    // como «no aplica» y rellenarlo; una frase que diga «no tengo horarios de
    // entrenamiento» no deja lugar a eso.
    if (!grupos.some((g) => g.horario)) {
        info.no_disponible.push('horarios de entrenamiento (días y horas de cada grupo)');
    }
    info.no_disponible.push('edades exactas de cada categoría');
    info.no_disponible.push('precios de mensualidad, inscripción y uniforme');
    if (!info.sedes.length && !info.direccion) info.no_disponible.push('dirección y sedes');
    if (!info.horario_atencion) info.no_disponible.push('horario de atención de la escuela');

    return info;
}

/**
 * Texto de respaldo, sin pasar por el modelo.
 *
 * Si la segunda llamada al LLM falla, la familia igual se queda con lo que la
 * escuela sí tiene cargado. Mismo criterio que `fallbackMediosDePago`.
 */
export function fallbackInfoEscuela(i: InfoDeEscuela): string {
    const l: string[] = [`*${i.nombre}*`, ''];

    if (i.ciudad || i.direccion) l.push(`📍 ${[i.direccion, i.ciudad].filter(Boolean).join(', ')}`);
    if (i.sedes.length > 1) l.push(`*Sedes:* ${i.sedes.join(' · ')}`);
    if (i.horario_atencion) l.push(`*Atención:* ${i.horario_atencion}`);

    if (i.grupos.length) {
        l.push('', '*Grupos:*');
        for (const g of i.grupos.slice(0, 12)) l.push(`• ${g.nombre}`);
    }

    l.push('', 'Los horarios y precios te los confirma la escuela directamente.');
    return l.join('\n');
}
