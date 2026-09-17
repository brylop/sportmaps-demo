/**
 * Horario de atención de la escuela — para lo que el bot PROMETE, no para si responde.
 *
 * La distinción es la decisión de producto. El bot contesta 24/7 y eso está
 * bien: un acudiente a las 11 de la noche preguntando cuánto debe recibe la
 * respuesta al instante, y ese es el valor de tenerlo. Lo que no puede pasar es
 * que a esa hora prometa «en breve te contactan» cuando en la escuela no hay
 * nadie hasta el otro día — visto el 2026-09-11 a las 19:09.
 *
 * `whatsapp_settings.business_hours` existía en la base desde antes y NINGÚN
 * código la leía: configuración muerta. Esto la conecta.
 *
 * Formato esperado (jsonb). Ausente o null = la escuela no configuró horario, y
 * entonces no se promete una hora concreta:
 *
 *   { "tz": "America/Bogota",
 *     "dias": { "1": ["08:00","17:00"], ..., "6": ["08:00","12:00"] } }
 *
 * Las claves de `dias` son 0=domingo … 6=sábado, como `Date.getDay()`.
 */

import { supabase } from '../config/supabase';

const TZ_POR_DEFECTO = 'America/Bogota';

interface Horario {
    tz: string;
    dias: Record<string, [string, string]>;
}

/** Hora y día de la semana en la zona de la escuela, sin depender del reloj del server. */
function ahoraEn(tz: string): { dia: number; minutos: number } {
    const f = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const partes = Object.fromEntries(f.formatToParts(new Date()).map((p) => [p.type, p.value]));
    const dias = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return {
        dia: Math.max(0, dias.indexOf(String(partes.weekday))),
        minutos: Number(partes.hour) * 60 + Number(partes.minute),
    };
}

const aMinutos = (hhmm: string): number => {
    const [h, m] = hhmm.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
};

export interface EstadoHorario {
    /** false solo si la escuela configuró horario Y estamos fuera de él. */
    fueraDeHorario: boolean;
    /** "mañana a las 8:00 a. m.", "el lunes a las 8:00 a. m.". null si no hay horario configurado. */
    proximaAtencion: string | null;
}

/**
 * ¿Estamos dentro del horario de atención?
 *
 * Sin horario configurado devuelve `fueraDeHorario: false`: no se asume que la
 * escuela está cerrada. Prometer menos de lo real es mejor que inventar un
 * horario que nadie definió.
 */
export async function estadoDeHorario(integrationId: string): Promise<EstadoHorario> {
    const { data } = await supabase
        .from('whatsapp_settings')
        .select('business_hours')
        .eq('integration_id', integrationId)
        .maybeSingle();

    const cfg = data?.business_hours as Horario | null | undefined;
    if (!cfg?.dias) return { fueraDeHorario: false, proximaAtencion: null };

    const tz = cfg.tz || TZ_POR_DEFECTO;
    const { dia, minutos } = ahoraEn(tz);

    const hoy = cfg.dias[String(dia)];
    if (hoy && minutos >= aMinutos(hoy[0]) && minutos < aMinutos(hoy[1])) {
        return { fueraDeHorario: false, proximaAtencion: null };
    }

    // Fuera de horario: buscar la próxima apertura, hasta una semana adelante.
    const NOMBRES = ['el domingo', 'el lunes', 'el martes', 'el miércoles', 'el jueves', 'el viernes', 'el sábado'];
    for (let salto = 0; salto <= 7; salto++) {
        const d = (dia + salto) % 7;
        const rango = cfg.dias[String(d)];
        if (!rango) continue;
        // Hoy solo cuenta si la apertura todavía no pasó.
        if (salto === 0 && minutos >= aMinutos(rango[0])) continue;
        const cuando = salto === 0 ? 'hoy' : salto === 1 ? 'mañana' : NOMBRES[d];
        return { fueraDeHorario: true, proximaAtencion: `${cuando} a las ${rango[0]}` };
    }

    return { fueraDeHorario: true, proximaAtencion: null };
}

/**
 * Lo que el bot dice al escalar. Cambia SOLO la promesa, nunca si responde.
 */
export function mensajeDeEscalamiento(estado: EstadoHorario): string {
    const base = 'Voy a pasar tu caso con una persona del equipo de la escuela para ayudarte mejor.';
    if (!estado.fueraDeHorario) return `${base} En breve te contactan. 🙌`;
    if (estado.proximaAtencion) {
        return `${base}\n\nAhora mismo están fuera del horario de atención, así que te responden ${estado.proximaAtencion}. 🙌`;
    }
    return `${base}\n\nTe responden apenas estén disponibles. 🙌`;
}
