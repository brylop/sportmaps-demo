/**
 * whatsapp-prospecto-lead.service — que ningún prospecto de WhatsApp se pierda.
 *
 * «SE ESTÁN QUEDANDO LEADS SIN RESPONDER» (Dynasty, 2026-10-06). Todo
 * desconocido que pasa la regla de prospecto (`puertaDeProspecto`) queda
 * registrado como lead, conteste o no el bot (ventana de 24 h cerrada, error,
 * escuela atendiendo, bot apagado).
 *
 * Se reutiliza `school_signup_leads` (la misma tabla del formulario
 * /inscripcion/<slug> y de la reserva de cortesía por WhatsApp), con:
 *   - `how_heard = 'whatsapp'`, `source_detail.canal = 'whatsapp'` y
 *     `source_detail.origen = 'wa_prospecto'` (lo que distingue ESTE registro);
 *   - el teléfono en el mismo formato que usa la reserva (`telefonoDelLead`),
 *     para que sea UNA fila por persona;
 *   - estado: new («nuevo») → contacted («respondido»); «agendado» es la fila
 *     con `trial_slot_id` que crea la reserva. Nunca se baja de estado.
 *
 * Choque conocido y resuelto: `submit_school_lead` (la reserva) deduplica 24 h
 * por teléfono y devolvería «duplicado» SIN reservar el cupo si encuentra este
 * lead. Por eso `liberarLeadParaReserva` borra el registro sin cupo de ESTE
 * origen justo antes de reservar; la fila que crea la reserva lo reemplaza
 * (lleva `canal: 'whatsapp'` y queda con el cupo).
 */
import { supabase } from '../config/supabase';
import {
    interesesDeProspecto, buscaParaAdulto, edadMencionada, type InteresDeProspecto,
} from './whatsapp-atencion.service';

export const ORIGEN_LEAD_WA = 'wa_prospecto';

export type EstadoLeadWa = 'nuevo' | 'respondido' | 'agendado' | 'convertido' | 'descartado';

const A_STATUS: Record<'nuevo' | 'respondido', 'new' | 'contacted'> = { nuevo: 'new', respondido: 'contacted' };
const RANGO: Record<string, number> = { new: 0, contacted: 1, converted: 2, discarded: 2 };

/** Mismo formato que la reserva (whatsapp-clase-cortesia `telefonoDelLead`). */
export function telefonoDeLeadWa(waId: string): string {
    const d = String(waId ?? '').replace(/\D/g, '');
    const t10 = d.slice(-10);
    return /^3\d{9}$/.test(t10) ? t10 : `+${d}`;
}

export function variantesTelefonoLead(waId: string): string[] {
    const d = String(waId ?? '').replace(/\D/g, '');
    if (!d) return [];
    const t10 = d.slice(-10);
    return [...new Set([t10, `57${t10}`, `+57${t10}`, d, `+${d}`])];
}

export interface ResumenProspecto {
    intereses: InteresDeProspecto[];
    adulto: boolean;
    edad: number | null;
}

/** Lo que se sabe del prospecto a partir de sus mensajes. Pura. */
export function resumirProspecto(textos: (string | null | undefined)[]): ResumenProspecto {
    const limpios = textos.map((t) => (t || '').trim()).filter(Boolean);
    const junto = limpios.join('\n');
    const intereses = [...new Set(limpios.flatMap((t) => interesesDeProspecto(t)))];
    const sinInfo = intereses.filter((i) => i !== 'informacion');
    let edad: number | null = null;
    for (const t of limpios) edad = edadMencionada(t) ?? edad;
    return {
        intereses: (sinInfo.length ? sinInfo : intereses) as InteresDeProspecto[],
        adulto: buscaParaAdulto(junto),
        edad,
    };
}

export interface ParamsLeadWa {
    schoolId: string;
    conversationId: string;
    contactWaId: string;
    nombre: string | null;
    /** Entrantes de texto del prospecto, del más viejo al más nuevo. */
    textos: string[];
    estado: 'nuevo' | 'respondido';
}

/**
 * Crea o actualiza el lead del prospecto (una fila por escuela + teléfono).
 * Nunca lanza: registrar el lead no puede tumbar la respuesta del bot.
 */
export async function registrarLeadDeProspecto(p: ParamsLeadWa): Promise<{ leadId: string; creado: boolean } | null> {
    try {
        const resumen = resumirProspecto(p.textos);
        const ultimos = p.textos.map((t) => t.trim()).filter(Boolean).slice(-6);
        const ahora = new Date().toISOString();

        const { data: previos, error: errPrev } = await supabase
            .from('school_signup_leads')
            .select('id, status, source_detail, trial_slot_id')
            .eq('school_id', p.schoolId)
            .in('phone', variantesTelefonoLead(p.contactWaId))
            .order('created_at', { ascending: false })
            .limit(1);
        if (errPrev) throw errPrev;
        const previo = (previos as any[] | null)?.[0];

        if (previo) {
            const sd = (previo.source_detail ?? {}) as Record<string, any>;
            const intereses = [...new Set([...(sd.intereses ?? []), ...resumen.intereses])];
            const nuevoStatus = A_STATUS[p.estado];
            const status = (RANGO[nuevoStatus] ?? 0) > (RANGO[previo.status] ?? 0) ? nuevoStatus : previo.status;
            const { error } = await supabase.from('school_signup_leads').update({
                status,
                source_detail: {
                    ...sd,
                    canal: sd.canal ?? 'whatsapp',
                    conversation_id: sd.conversation_id ?? p.conversationId,
                    intereses,
                    adulto: Boolean(sd.adulto) || resumen.adulto,
                    edad: resumen.edad ?? sd.edad ?? null,
                    mensajes: ultimos,
                    ultima_actividad: ahora,
                    ...(p.estado === 'respondido' ? { respondido_at: sd.respondido_at ?? ahora } : {}),
                },
                updated_at: ahora,
            }).eq('id', previo.id);
            if (error) throw error;
            return { leadId: previo.id, creado: false };
        }

        const { data: escuela } = await supabase.from('schools').select('slug').eq('id', p.schoolId).maybeSingle();
        const { data, error } = await supabase.from('school_signup_leads').insert({
            school_id: p.schoolId,
            source_slug: (escuela as any)?.slug ?? 'whatsapp',
            full_name: (p.nombre || '').trim() || 'Prospecto WhatsApp',
            phone: telefonoDeLeadWa(p.contactWaId),
            how_heard: 'whatsapp',
            notes: ultimos.join(' | ').slice(0, 1000) || null,
            status: A_STATUS[p.estado],
            source_detail: {
                canal: 'whatsapp',
                origen: ORIGEN_LEAD_WA,
                conversation_id: p.conversationId,
                intereses: resumen.intereses,
                adulto: resumen.adulto,
                edad: resumen.edad,
                mensajes: ultimos,
                ultima_actividad: ahora,
                ...(p.estado === 'respondido' ? { respondido_at: ahora } : {}),
            },
        }).select('id').single();
        if (error) throw error;
        return { leadId: (data as any).id, creado: true };
    } catch (e: any) {
        console.error('[wa-prospecto] no se pudo registrar el lead', { conversationId: p.conversationId, err: e?.message });
        return null;
    }
}

/**
 * Antes de reservar una clase de cortesía: borra el lead SIN cupo que dejó este
 * módulo en las últimas 24 h, para que `submit_school_lead` no lo tome como
 * duplicado y sí reserve el cupo. Solo filas de origen `wa_prospecto`.
 */
export async function liberarLeadParaReserva(schoolId: string, contactWaId: string): Promise<void> {
    try {
        const desde = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
        await supabase.from('school_signup_leads')
            .delete()
            .eq('school_id', schoolId)
            .in('phone', variantesTelefonoLead(contactWaId))
            .is('trial_slot_id', null)
            .eq('source_detail->>origen', ORIGEN_LEAD_WA)
            .gte('created_at', desde);
    } catch (e: any) {
        console.warn('[wa-prospecto] no se pudo liberar el lead antes de reservar', { err: e?.message });
    }
}

export interface ProspectoDeConversacion {
    lead_id: string;
    estado: EstadoLeadWa;
    intereses: string[];
    adulto: boolean;
    edad: number | null;
}

/**
 * Para el buzón: `prospecto` por conversación (id → datos del lead), buscando
 * los leads de la escuela por teléfono. Nunca lanza (Map vacío).
 */
export async function prospectosDeConversaciones(
    schoolId: string,
    conversaciones: { id: string; contact_wa_id: string }[],
): Promise<Map<string, ProspectoDeConversacion>> {
    const salida = new Map<string, ProspectoDeConversacion>();
    if (!conversaciones.length) return salida;
    try {
        const porTelefono = new Map<string, string>();
        for (const c of conversaciones) for (const v of variantesTelefonoLead(c.contact_wa_id)) porTelefono.set(v, c.id);
        const { data, error } = await supabase
            .from('school_signup_leads')
            .select('id, phone, status, trial_slot_id, source_detail, created_at')
            .eq('school_id', schoolId)
            .in('phone', [...porTelefono.keys()])
            .order('created_at', { ascending: false })
            .limit(1000);
        if (error) return salida;
        for (const l of (data ?? []) as any[]) {
            const convId = porTelefono.get(l.phone);
            if (!convId || salida.has(convId)) continue;
            const sd = l.source_detail ?? {};
            const estado: EstadoLeadWa = l.status === 'converted' ? 'convertido'
                : l.status === 'discarded' ? 'descartado'
                : l.trial_slot_id ? 'agendado'
                : l.status === 'contacted' ? 'respondido' : 'nuevo';
            salida.set(convId, {
                lead_id: l.id, estado, intereses: sd.intereses ?? [], adulto: Boolean(sd.adulto), edad: sd.edad ?? null,
            });
        }
    } catch {
        // el buzón no se cae por esto
    }
    return salida;
}
