/**
 * Ajustes del asistente de WhatsApp POR ESCUELA (mig. 20261006120601,
 * spec docs/specs/whatsapp-ajustes-por-escuela.md).
 *
 * Viven en `school_settings` y no en `whatsapp_settings` porque esta última es
 * por integración y no existe hasta que la escuela conecta su número: Besser
 * los dejó listos antes de conectar.
 *
 * Los defaults reproducen el comportamiento de siempre. Si la migración no
 * está aplicada (columna inexistente) o la lectura falla, se devuelven los
 * defaults: un ajuste que no se pudo leer nunca le cambia la conducta al bot.
 */
import { supabase } from '../config/supabase';

export type ModoCortesia = 'clase' | 'semana_app';

export interface AjustesWhatsAppEscuela {
    /** 'clase' = agenda una clase suelta (lo de siempre); 'semana_app' = paso a paso del enlace de cortesía. */
    modoCortesia: ModoCortesia;
    cortesiaQrId: string | null;
    cortesiaDias: number;
    ayudaApp: boolean;
    reclamosDeValor: boolean;
    /** Al desconocido que pregunta el precio, los valores de los planes (sin enlace de pago). */
    responderPrecios: boolean;
    /**
     * Ventas por WhatsApp, carril B (docs/specs/ventas-por-whatsapp.md): el bot
     * responde por los servicios del catálogo (clase extra, vacacionales,
     * torneos, viajes) y, a la familia identificada, le arma el cobro y el link.
     * Apagado por defecto (`school_settings.wa_ventas_habilitadas`, F0).
     */
    ventasHabilitadas: boolean;
}

export const AJUSTES_POR_DEFECTO: Readonly<AjustesWhatsAppEscuela> = Object.freeze({
    modoCortesia: 'clase',
    cortesiaQrId: null,
    cortesiaDias: 7,
    ayudaApp: false,
    reclamosDeValor: false,
    responderPrecios: false,
    ventasHabilitadas: false,
});

/** Fila cruda → ajustes. Cualquier valor raro cae al default. */
export function ajustesDesdeFila(fila: Record<string, unknown> | null | undefined): AjustesWhatsAppEscuela {
    if (!fila) return { ...AJUSTES_POR_DEFECTO };
    const dias = Number(fila.wa_cortesia_dias);
    return {
        modoCortesia: fila.wa_modo_cortesia === 'semana_app' ? 'semana_app' : 'clase',
        cortesiaQrId: typeof fila.wa_cortesia_qr_id === 'string' && fila.wa_cortesia_qr_id ? fila.wa_cortesia_qr_id : null,
        cortesiaDias: Number.isInteger(dias) && dias >= 1 && dias <= 60 ? dias : AJUSTES_POR_DEFECTO.cortesiaDias,
        ayudaApp: fila.wa_ayuda_app === true,
        reclamosDeValor: fila.wa_reclamos_de_valor === true,
        responderPrecios: fila.wa_responder_precios === true,
        ventasHabilitadas: fila.wa_ventas_habilitadas === true,
    };
}

// De la consulta más completa a la más pobre: cada columna llegó con una
// migración distinta, y una que falte no puede apagar las demás.
const COLUMNAS = [
    'wa_modo_cortesia, wa_cortesia_qr_id, wa_cortesia_dias, wa_ayuda_app, wa_reclamos_de_valor, wa_responder_precios, wa_ventas_habilitadas',
    'wa_modo_cortesia, wa_cortesia_qr_id, wa_cortesia_dias, wa_ayuda_app, wa_reclamos_de_valor, wa_responder_precios',
    'wa_modo_cortesia, wa_cortesia_qr_id, wa_cortesia_dias, wa_ayuda_app, wa_reclamos_de_valor',
];

/** Nunca lanza. */
export async function ajustesWhatsAppDeEscuela(schoolId: string | null | undefined): Promise<AjustesWhatsAppEscuela> {
    if (!schoolId) return { ...AJUSTES_POR_DEFECTO };
    try {
        for (const columnas of COLUMNAS) {
            const { data, error } = await supabase
                .from('school_settings')
                .select(columnas)
                .eq('school_id', schoolId)
                .maybeSingle();
            if (!error) return ajustesDesdeFila(data as Record<string, unknown> | null);
        }
        return { ...AJUSTES_POR_DEFECTO };
    } catch {
        return { ...AJUSTES_POR_DEFECTO };
    }
}

// ─── Textos libres por escuela (mig. 20261007183601) ─────────────────────────
//
// `wa_atencion_presencial` y `wa_cortesia_indicaciones` en school_settings.
// Mientras la migración no esté aplicada, el mismo dato se lee de
// `schools.payment_settings` (jsonb legacy que ningún formulario escribe), con
// la misma clave: así Dynasty lo tiene hoy sin tocar el esquema.

export type TextoDeEscuela = 'wa_atencion_presencial' | 'wa_cortesia_indicaciones';

/** Recorta y descarta lo vacío o lo que no es texto. Pura. */
export function textoLimpio(v: unknown, max = 400): string | null {
    if (typeof v !== 'string') return null;
    const t = v.replace(/\s+/g, ' ').trim();
    return t ? t.slice(0, max) : null;
}

/** Columna de school_settings; si no existe o está vacía, la clave puente. Nunca lanza. */
export async function textoDeEscuela(schoolId: string | null | undefined, campo: TextoDeEscuela): Promise<string | null> {
    if (!schoolId) return null;
    try {
        const { data, error } = await supabase
            .from('school_settings').select(campo).eq('school_id', schoolId).maybeSingle();
        if (!error) {
            const v = textoLimpio((data as Record<string, unknown> | null)?.[campo]);
            if (v) return v;
        }
    } catch { /* columna sin migrar: se intenta el puente */ }
    try {
        const { data } = await supabase
            .from('schools').select('payment_settings').eq('id', schoolId).maybeSingle();
        return textoLimpio((data as any)?.payment_settings?.[campo]);
    } catch {
        return null;
    }
}

/**
 * Dónde y cuándo atiende la escuela EN PERSONA (pagos, trámites), tal como lo
 * escribió la escuela, o null si no lo configuró: entonces el bot no lo dice
 * (nunca se inventa). Dynasty 2026-10-07: «Club de voleibol Coliseo Dynasty,
 * Cl. 12 Bis #71g-09, Bogotá. Desde las 4 p. m. hasta las 9 p. m.»
 */
export function atencionPresencialDeEscuela(schoolId: string | null | undefined): Promise<string | null> {
    return textoDeEscuela(schoolId, 'wa_atencion_presencial');
}

/** Qué llevar / a quién buscar en la clase de cortesía, o null (= texto genérico). */
export function indicacionesCortesiaDeEscuela(schoolId: string | null | undefined): Promise<string | null> {
    return textoDeEscuela(schoolId, 'wa_cortesia_indicaciones');
}
