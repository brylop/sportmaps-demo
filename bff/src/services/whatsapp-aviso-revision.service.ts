/**
 * whatsapp-aviso-revision.service — «recibimos tu comprobante, la escuela lo
 * está revisando» por PLANTILLA, para cuando la ventana de 24 h está cerrada.
 *
 * Dentro de la ventana eso sale como texto libre (worker de la cola y
 * recuperación). Fuera, hasta el 2026-10-07 no salía nada: «no hay plantilla
 * de recibido» (whatsapp-recuperacion.service, regla 2) y la familia seguía
 * creyendo que su pago se había perdido hasta que la escuela decidiera.
 *
 * Plantilla `comprobante_en_revision` (bff/whatsapp-templates). Mientras no
 * esté APPROVED en la WABA de la escuela —o sin opt-in, o sin datos—
 * `enviarCobroPorPlantilla` devuelve el motivo y quien llama sigue como antes.
 * Nunca lanza.
 */

import { supabase } from '../config/supabase';
import { enviarCobroPorPlantilla, type ResultadoEnvio } from './whatsapp-plantillas.service';

const cop = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

/** «ISABELLA RODRIGUEZ HERNANDEZ» → «Isabella Rodriguez». Pura. */
function nombreCorto(nombre: string | null | undefined): string | null {
    const partes = String(nombre ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
    if (!partes.length) return null;
    return partes.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
}

export interface AvisoRevision {
    schoolId: string;
    /** wa_id del contacto (573…) o celular colombiano. */
    telefono: string;
    paymentId: string;
    parentId: string | null;
    /** Lo que mandó la familia (OCR); si no se leyó, el valor del cobro. */
    monto: number | null;
    /** Nombre del deportista ya resuelto (PagoPendiente.atleta), si se tiene. */
    atleta?: string | null;
    /** Paso que queda en el payload del saliente (trazabilidad en el buzón). */
    paso: string;
}

export async function avisarRevisionPorPlantilla(a: AvisoRevision): Promise<ResultadoEnvio> {
    try {
        const { data: pago } = await supabase.from('payments')
            .select('amount, child_id, unregistered_athlete_id')
            .eq('id', a.paymentId).maybeSingle();
        const p = (pago ?? {}) as any;
        const [perfil, hijo, sinRegistrar, escuela] = await Promise.all([
            a.parentId ? supabase.from('profiles').select('full_name').eq('id', a.parentId).maybeSingle() : Promise.resolve({ data: null }),
            !a.atleta && p.child_id ? supabase.from('children').select('full_name').eq('id', p.child_id).maybeSingle() : Promise.resolve({ data: null }),
            !a.atleta && p.unregistered_athlete_id
                ? supabase.from('unregistered_athletes').select('full_name').eq('id', p.unregistered_athlete_id).maybeSingle()
                : Promise.resolve({ data: null }),
            supabase.from('schools').select('name').eq('id', a.schoolId).maybeSingle(),
        ]);
        const atleta = nombreCorto(a.atleta ?? (hijo as any)?.data?.full_name ?? (sinRegistrar as any)?.data?.full_name);
        const monto = a.monto ?? (p.amount != null ? Number(p.amount) : null);
        return await enviarCobroPorPlantilla({
            schoolId: a.schoolId,
            concepto: 'comprobante_en_revision',
            telefono: a.telefono,
            tokenBoton: null,
            paymentId: a.paymentId,
            parentId: a.parentId,
            datos: {
                nombreContacto: nombreCorto((perfil as any)?.data?.full_name)?.split(' ')[0] ?? 'familia',
                nombreAtleta: atleta ?? '',
                nombreEscuela: (escuela as any)?.data?.name ?? '',
                monto: monto != null && Number.isFinite(monto) && monto > 0 ? cop(monto) : '',
            },
            payloadExtra: { step: a.paso },
        });
    } catch (e: any) {
        return { enviado: false, motivo: 'error_graph', detalle: e?.message ?? String(e) };
    }
}
