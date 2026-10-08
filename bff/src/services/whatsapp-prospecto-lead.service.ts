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
import { celular10 } from './factura-pagador.service';
import {
    interesesDeProspecto, buscaParaAdulto, edadMencionada, type InteresDeProspecto,
} from './whatsapp-atencion.service';

export const ORIGEN_LEAD_WA = 'wa_prospecto';

export type EstadoLeadWa = 'nuevo' | 'respondido' | 'agendado' | 'asistio' | 'convertido' | 'descartado';

const A_STATUS: Record<'nuevo' | 'respondido', 'new' | 'contacted'> = { nuevo: 'new', respondido: 'contacted' };
const RANGO: Record<string, number> = { new: 0, contacted: 1, converted: 2, discarded: 2 };

/**
 * Mismo formato que la reserva (whatsapp-clase-cortesia `telefonoDelLead`).
 * Solo un celular COLOMBIANO se recorta a 10 dígitos (`celular10`): los
 * últimos 10 de un +1 310… también arrancan en 3 y cruzaban con el prospecto
 * colombiano de ese número (auditoría de privacidad 2026-10-08).
 */
export function telefonoDeLeadWa(waId: string): string {
    const d = String(waId ?? '').replace(/\D/g, '');
    return celular10(d) ?? `+${d}`;
}

export function variantesTelefonoLead(waId: string): string[] {
    const d = String(waId ?? '').replace(/\D/g, '');
    if (!d) return [];
    const t10 = celular10(d);
    return t10 ? [...new Set([t10, `57${t10}`, `+57${t10}`, d, `+${d}`])] : [d, `+${d}`];
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
            const etapaAntes = etapaDeLead(previo);
            const etapa = siguienteEtapa(etapaAntes, p.estado);
            const { error } = await supabase.from('school_signup_leads').update({
                status,
                source_detail: {
                    ...sd,
                    etapa,
                    ...(etapa !== etapaAntes ? { [`${etapa}_at`]: sd[`${etapa}_at`] ?? ahora } : {}),
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
                etapa: p.estado,
                [`${p.estado}_at`]: ahora,
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
            const etapa = etapaDeLead(l);
            const estado: EstadoLeadWa = etapa === 'inscrito' ? 'convertido' : etapa;
            salida.set(convId, {
                lead_id: l.id, estado, intereses: sd.intereses ?? [], adulto: Boolean(sd.adulto), edad: sd.edad ?? null,
            });
        }
    } catch {
        // el buzón no se cae por esto
    }
    return salida;
}

// ─── Etapas del embudo (2026-10-08) ──────────────────────────────────────────
//
// Dynasty, 26 leads de WhatsApp en 6 días: 19 `contacted` y 7 `new`, incluso
// con la clase reservada o la familia ya en la cancha. El CHECK de `status`
// admite solo new / contacted / converted / discarded y lo leen el formulario,
// el buzón y la reserva; ampliarlo rompía esos filtros. La etapa fina vive en
// `source_detail.etapa` (con `<etapa>_at`) y `status` se mueve con ella:
//
//   nuevo → respondido → agendado → asistio → inscrito        (descartado: aparte)
//   new     contacted    contacted  contacted  converted       discarded
//
// Nunca se baja de etapa; `inscrito` y `descartado` son finales.

export type EtapaLead = 'nuevo' | 'respondido' | 'agendado' | 'asistio' | 'inscrito' | 'descartado';

const ORDEN_ETAPA: Record<EtapaLead, number> = {
    nuevo: 0, respondido: 1, agendado: 2, asistio: 3, inscrito: 4, descartado: 4,
};

export const STATUS_DE_ETAPA: Record<EtapaLead, 'new' | 'contacted' | 'converted' | 'discarded'> = {
    nuevo: 'new', respondido: 'contacted', agendado: 'contacted', asistio: 'contacted',
    inscrito: 'converted', descartado: 'discarded',
};

function esEtapa(v: unknown): v is EtapaLead {
    return typeof v === 'string' && v in ORDEN_ETAPA;
}

/** Etapa de una fila: la guardada, sin bajar de lo que dicen las columnas. Pura. */
export function etapaDeLead(l: { status?: string | null; trial_slot_id?: string | null; source_detail?: any }): EtapaLead {
    if (l.status === 'converted') return 'inscrito';
    if (l.status === 'discarded') return 'descartado';
    const guardada = esEtapa(l.source_detail?.etapa) ? l.source_detail.etapa as EtapaLead : null;
    const porColumnas: EtapaLead = l.trial_slot_id ? 'agendado' : l.status === 'contacted' ? 'respondido' : 'nuevo';
    if (!guardada || guardada === 'inscrito' || guardada === 'descartado') return porColumnas;
    return ORDEN_ETAPA[guardada] >= ORDEN_ETAPA[porColumnas] ? guardada : porColumnas;
}

/** A qué etapa pasa un lead que está en `actual` cuando ocurre `evento`. Pura. */
export function siguienteEtapa(actual: EtapaLead, evento: EtapaLead): EtapaLead {
    if (actual === 'inscrito' || actual === 'descartado') return actual;
    if (evento === 'descartado' || evento === 'inscrito') return evento;
    return ORDEN_ETAPA[evento] > ORDEN_ETAPA[actual] ? evento : actual;
}

/**
 * Mueve el lead a `evento` (si es un paso adelante) y estampa `<etapa>_at`.
 * `extra` se mezcla en source_detail. Devuelve la etapa resultante, o null si
 * no se pudo. Nunca lanza.
 */
export async function avanzarEtapaLead(
    leadId: string,
    evento: EtapaLead,
    extra: Record<string, unknown> = {},
    ahora: Date = new Date(),
): Promise<EtapaLead | null> {
    try {
        const { data: l, error } = await supabase.from('school_signup_leads')
            .select('id, status, trial_slot_id, source_detail').eq('id', leadId).maybeSingle();
        if (error || !l) return null;
        const antes = etapaDeLead(l as any);
        const etapa = siguienteEtapa(antes, evento);
        const sd = ((l as any).source_detail ?? {}) as Record<string, any>;
        const iso = ahora.toISOString();
        const cambios: Record<string, unknown> = {
            source_detail: {
                ...sd, ...extra, etapa,
                ...(etapa !== antes ? { [`${etapa}_at`]: sd[`${etapa}_at`] ?? iso } : {}),
            },
            updated_at: iso,
        };
        // El status solo se mueve si la etapa cambió (no se pisa lo que puso una persona).
        if (etapa !== antes) cambios.status = STATUS_DE_ETAPA[etapa];
        const { error: e2 } = await supabase.from('school_signup_leads').update(cambios).eq('id', leadId);
        if (e2) throw e2;
        return etapa;
    } catch (e: any) {
        console.warn('[wa-prospecto] no se pudo mover la etapa del lead', { leadId, evento, err: e?.message });
        return null;
    }
}

// ─── Reserva sobre el lead que ya existe (2026-10-08) ───────────────────────
//
// La reserva (`submit_school_lead`) insertaba una fila NUEVA aunque el bot ya
// hubiera registrado al prospecto: si el lead del bot tenía más de 24 h no lo
// veía el dedupe y quedaban dos; si tenía menos, `liberarLeadParaReserva` lo
// BORRABA y se perdía su historia (origen, intereses, fecha del primer
// contacto). Ahora: una fila por escuela + teléfono. La RPC sigue siendo la
// que toma el cupo (FOR UPDATE, capacidad, aviso in-app); después el cupo y
// los datos de la reserva pasan a la fila que ya existía y la nueva se borra.

export interface LeadSinCupo { id: string; phone: string; created_at: string }

/** El lead más reciente de ese teléfono en la escuela, SIN cupo y abierto. Nunca lanza. */
export async function leadSinCupoParaReserva(schoolId: string, contactWaId: string): Promise<LeadSinCupo | null> {
    try {
        const variantes = variantesTelefonoLead(contactWaId);
        if (!variantes.length) return null;
        const { data, error } = await supabase.from('school_signup_leads')
            .select('id, phone, created_at, trial_slot_id, status')
            .eq('school_id', schoolId)
            .in('phone', variantes)
            .order('created_at', { ascending: false })
            .limit(5);
        if (error || !Array.isArray(data)) return null;
        const l = (data as any[]).find((x) => !x.trial_slot_id && (x.status === 'new' || x.status === 'contacted'));
        return l ? { id: l.id, phone: l.phone, created_at: l.created_at } : null;
    } catch {
        return null;
    }
}

/**
 * Otro formato del MISMO número para que el dedupe de 24 h de
 * `submit_school_lead` (igualdad exacta del texto) no devuelva «duplicado» sin
 * reservar: 3001234567 → +573001234567; +1555… → 1555…. Pura.
 */
export function telefonoAlterno(telefono: string): string {
    const crudo = String(telefono ?? '').trim();
    const d = crudo.replace(/\D/g, '');
    if (/^3\d{9}$/.test(d)) return `+57${d}`;
    return crudo.startsWith('+') ? d : `+${d}`;
}

/**
 * Pasa el cupo y los datos de la reserva (`nuevoId`, recién creado por la RPC)
 * al lead que ya existía (`previoId`) y borra la fila nueva. Si algo falla a
 * mitad, deja todo como lo dejó la RPC (la reserva vale igual). Devuelve el id
 * con que quedó la reserva. Nunca lanza.
 */
export async function fusionarReservaEnLead(previoId: string, nuevoId: string, ahora: Date = new Date()): Promise<string> {
    if (!previoId || !nuevoId || previoId === nuevoId) return nuevoId;
    let movido = false;
    try {
        const [{ data: nuevo }, { data: previo }] = await Promise.all([
            supabase.from('school_signup_leads')
                .select('id, trial_slot_id, full_name, guardian_name, birth_date, suggested_category, notes, source_detail, email, gender')
                .eq('id', nuevoId).maybeSingle(),
            supabase.from('school_signup_leads')
                .select('id, full_name, guardian_name, notes, status, trial_slot_id, source_detail, email')
                .eq('id', previoId).maybeSingle(),
        ]);
        const n = nuevo as any;
        const p = previo as any;
        if (!n?.trial_slot_id || !p || p.trial_slot_id) return nuevoId;
        const sd = (p.source_detail ?? {}) as Record<string, any>;
        const sdNuevo = (n.source_detail ?? {}) as Record<string, any>;
        const iso = ahora.toISOString();
        const etapa = siguienteEtapa(etapaDeLead(p), 'agendado');
        const nombreContacto = String(p.full_name ?? '').trim();
        const { data: movidas, error: e1 } = await supabase.from('school_signup_leads').update({
            trial_slot_id: n.trial_slot_id,
            // La reserva trae el nombre del DEPORTISTA; el del lead del bot era
            // el de quien escribe (queda en source_detail.contacto).
            full_name: n.full_name || p.full_name,
            guardian_name: n.guardian_name ?? p.guardian_name ?? null,
            birth_date: n.birth_date ?? null,
            suggested_category: n.suggested_category ?? null,
            email: p.email ?? n.email ?? null,
            gender: n.gender ?? null,
            notes: [p.notes, n.notes].filter(Boolean).join('\n').slice(0, 2000) || null,
            status: STATUS_DE_ETAPA[etapa],
            source_detail: {
                ...sdNuevo,
                ...sd,
                canal: sd.canal ?? sdNuevo.canal ?? 'whatsapp',
                conversation_id: sd.conversation_id ?? sdNuevo.conversation_id ?? null,
                ...(nombreContacto && nombreContacto !== n.full_name && nombreContacto !== 'Prospecto WhatsApp'
                    ? { contacto: nombreContacto } : {}),
                etapa,
                agendado_at: iso,
                reserva_fusionada: nuevoId,
            },
            updated_at: iso,
        }).eq('id', previoId).is('trial_slot_id', null).select('id');
        if (e1) throw e1;
        // Otra reserva le ganó a esta fila: la reserva nueva queda como la dejó la RPC.
        if (!Array.isArray(movidas) || !movidas.length) return nuevoId;
        movido = true;
        const { error: e2 } = await supabase.from('school_signup_leads').delete().eq('id', nuevoId);
        if (e2) throw e2;
        return previoId;
    } catch (e: any) {
        // Dos filas con el mismo cupo contarían doble al cancelar: se deshace.
        if (movido) {
            await supabase.from('school_signup_leads').update({ trial_slot_id: null }).eq('id', previoId)
                .then(() => undefined, () => undefined);
        }
        console.warn('[wa-prospecto] no se pudo fusionar la reserva con el lead del bot', { err: e?.message });
        return nuevoId;
    }
}
