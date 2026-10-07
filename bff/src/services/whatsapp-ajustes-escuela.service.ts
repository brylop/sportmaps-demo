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
}

export const AJUSTES_POR_DEFECTO: Readonly<AjustesWhatsAppEscuela> = Object.freeze({
    modoCortesia: 'clase',
    cortesiaQrId: null,
    cortesiaDias: 7,
    ayudaApp: false,
    reclamosDeValor: false,
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
    };
}

/** Nunca lanza. */
export async function ajustesWhatsAppDeEscuela(schoolId: string | null | undefined): Promise<AjustesWhatsAppEscuela> {
    if (!schoolId) return { ...AJUSTES_POR_DEFECTO };
    try {
        const { data, error } = await supabase
            .from('school_settings')
            .select('wa_modo_cortesia, wa_cortesia_qr_id, wa_cortesia_dias, wa_ayuda_app, wa_reclamos_de_valor')
            .eq('school_id', schoolId)
            .maybeSingle();
        if (error) return { ...AJUSTES_POR_DEFECTO };
        return ajustesDesdeFila(data as Record<string, unknown> | null);
    } catch {
        return { ...AJUSTES_POR_DEFECTO };
    }
}
