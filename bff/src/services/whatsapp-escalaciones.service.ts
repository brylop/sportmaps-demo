/**
 * whatsapp-escalaciones — Escalar es atender: urgencia, aviso y plazo.
 *
 * Dynasty, 2026-10-06 (calidad-bot-whatsapp-dynasty-2026-10-06-tarde.md): tres
 * pedidos de «hablar con una persona» de la tarde quedaron sin respuesta humana
 * en todo el día, uno urgente (`62db6756`: «Estamos varios en Colibrí y no han
 * llegado a dar la clase»). El bot decía «en breve te contactan» y ahí terminaba
 * todo: un push en la transición a 'open' y nada más.
 *
 * Ahora:
 *   1. Cada escalación se CLASIFICA (`clasificarUrgencia`): incidencia en la
 *      sede o la clase, lesión o seguridad = urgente. Pura y con reglas.
 *   2. Se avisa al owner y a los admins con notificación in-app SIEMPRE y push
 *      inmediato si es urgente (el push normal ya sale en la transición a
 *      abierta, `avisarQueEsperan`).
 *   3. El saliente «escalated» lleva `plazo_min` (10 urgente / 30 normal). Si
 *      vence sin que una persona de la escuela haya escrito en el chat, se
 *      re-avisa al equipo y se le dice a la familia algo honesto
 *      (`revisarEscalacionesVencidas`, en whatsapp-bot.service).
 *
 * Idempotencia entre los tres BFF (comparten la base): las notificaciones
 * llevan id DETERMINÍSTICO (`uuidDeClave`), y el 23505 del segundo BFF corta
 * también su push; el re-aviso se reserva con un UPDATE condicional sobre el
 * mismo saliente (`payload->>reaviso_at IS NULL`). Nada en memoria.
 */

import { supabase } from '../config/supabase';
import { sendToUser } from './push.service';
import { uuidDeClave, etiquetaDeContacto } from './avisos-correo.service';

export type Urgencia = 'urgente' | 'normal';
export type CategoriaUrgente = 'clase' | 'lesion' | 'seguridad' | 'urgente_declarado';

/** Minutos que tiene la escuela para responder antes del re-aviso. */
export const PLAZO_ESCALACION_MIN: Record<Urgencia, number> = {
    urgente: Number(process.env.WHATSAPP_PLAZO_URGENTE_MIN) || 10,
    normal: Number(process.env.WHATSAPP_PLAZO_NORMAL_MIN) || 30,
};

/** Hasta cuándo se miran escalaciones viejas (las de más atrás ya no tienen sentido). */
export const VENTANA_REVISION_HORAS = 6;

function normalizar(t: string | null | undefined): string {
    return String(t ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Algo de la clase o de la sede: sin esto «no han llegado» son los uniformes. */
const CONTEXTO_CLASE = /\b(clases?|entreno|entrenos|entrenamientos?|practicas?|profes?|profesor[a]?|profesores|entrenador[a]?|entrenadores|cancha|coliseo|sede|polideportivo|colibri|nido)\b/;
const INCIDENCIA_CLASE: RegExp[] = [
    /\bno (ha|han|a|an) (llegado|venido|abierto|aparecido)\b/,
    /\bno (llego|vino|aparecio|abrio|abrieron|llegaron|vinieron)\b/,
    /\bnadie (ha llegado|llego|vino|esta|aparece|abre)\b/,
    /\bno hay (nadie|profe|profesor[a]?|entrenador[a]?)\b/,
    /\bestamos esperando (al|a la|el|la|a los|que)\b/,
    /\b(esta|estan) cerrad[oa]s?\b/,
    /\bno (nos )?(abren|abrieron|dejan entrar)\b/,
];
const LESION: RegExp[] = [
    /\b(se lesiono|lesionad[oa]|se golpeo|se pego|golpe en la cabeza|se desmayo|desmay\w*|convulsi\w*|fractur\w*|sangr\w*|no puede respirar|se ahoga\w*|ambulancia|urgencias|accidente|herid[oa]s?)\b/,
];
const SEGURIDAD: RegExp[] = [
    // Con la persona de por medio: «no aparece mi pago» o «la clase perdida» no son esto.
    /\b(se perdio|perdid[oa]|extraviad[oa]|no aparece|no (lo|la) encuentro|no (lo|la) encontramos)\b(\s+\w+){0,3}\s+(mi|el|la|nuestr[oa])?\s*(hij[oa]s?|nin[oa]s?|nen[ea]s?|sobrin[oa]s?|atleta|jugador[a]?)\b/,
    /\b(mi|el|la|nuestr[oa]) (hij[oa]|nin[oa]|nen[ea]|atleta)\b(\s+\w+){0,3}\s+(se perdio|no aparece|no (lo|la) encuentro|esta perdid[oa])\b/,
    /\b(no (lo|la) han recogido|nadie (lo|la) recogio|se (lo|la) llevaron|acoso|acosando|abuso|abusando|amenaz\w*|en peligro)\b/,
];
const URGENTE_DECLARADO = /\b(urgente|urgencia|emergencia)\b/;

/**
 * Incidencia que no puede esperar: la clase que no se da con la gente en la
 * sede, una lesión, algo de seguridad. Es lo que el turno escala DE UNA, sin
 * pasar por el modelo. «Es urgente» a secas no alcanza para eso (puede ser un
 * paz y salvo), pero sí sube la urgencia de una escalación (`clasificarUrgencia`).
 */
export function incidenciaUrgente(texto: string | null | undefined): CategoriaUrgente | null {
    const t = normalizar(texto);
    if (!t) return null;
    if (LESION.some((re) => re.test(t))) return 'lesion';
    if (SEGURIDAD.some((re) => re.test(t))) return 'seguridad';
    if (CONTEXTO_CLASE.test(t) && INCIDENCIA_CLASE.some((re) => re.test(t))) return 'clase';
    return null;
}

/** Urgencia de una escalación, sobre el texto de la familia y el motivo. Pura. */
export function clasificarUrgencia(...textos: (string | null | undefined)[]): { urgencia: Urgencia; categoria: CategoriaUrgente | null } {
    const todo = textos.filter(Boolean).join('\n');
    const categoria = incidenciaUrgente(todo) ?? (URGENTE_DECLARADO.test(normalizar(todo)) ? 'urgente_declarado' : null);
    return { urgencia: categoria ? 'urgente' : 'normal', categoria };
}

/** ¿Venció el plazo de esta escalación? Pura. */
export function plazoVencido(creadaAt: string | number | Date, plazoMin: number, ahora = Date.now()): boolean {
    const t = new Date(creadaAt).getTime();
    if (!Number.isFinite(t)) return false;
    return ahora - t >= plazoMin * 60_000;
}

/** Lo que se le dice a la familia cuando el plazo venció sin respuesta. Pura. */
export function textoSinRespuesta(p: {
    urgencia: Urgencia;
    categoria: CategoriaUrgente | null;
    fueraDeHorario: boolean;
    proximaAtencion?: string | null;
}): string {
    if (p.urgencia === 'urgente') {
        const emergencia = p.categoria === 'lesion' || p.categoria === 'seguridad'
            ? '\n\nSi alguien está lastimado o en peligro, no esperes este chat: llama ya a la línea de emergencias *123*.'
            : '';
        return 'Todavía nadie de la escuela ha podido contestarte 🙏 Ya les volví a avisar como *urgente*. ' +
            'Apenas alguien lo vea, te escribe por aquí.' + emergencia;
    }
    if (p.fueraDeHorario) {
        return 'Todavía nadie de la escuela ha podido contestarte 🙏 Ahora están fuera del horario de atención' +
            (p.proximaAtencion ? `, así que lo más probable es que te respondan ${p.proximaAtencion}.` : '.') +
            ' Tu mensaje ya está con ellos.';
    }
    return 'Todavía nadie de la escuela ha podido contestarte 🙏 Ya les volví a avisar. ' +
        'Apenas alguien lo vea, te escribe por aquí.';
}

/** owner + owner/admin/school_admin activos de la escuela, sin repetir. */
export async function destinatariosDeLaEscuela(schoolId: string): Promise<string[]> {
    const [{ data: escuela }, { data: miembros }] = await Promise.all([
        supabase.from('schools').select('owner_id').eq('id', schoolId).maybeSingle(),
        supabase.from('school_members').select('profile_id')
            .eq('school_id', schoolId).eq('status', 'active')
            .in('role', ['owner', 'admin', 'school_admin']),
    ]);
    const ids = new Set<string>();
    for (const m of (miembros ?? []) as any[]) if (m.profile_id) ids.add(m.profile_id);
    if ((escuela as any)?.owner_id) ids.add((escuela as any).owner_id);
    return [...ids];
}

export interface AvisoDeEscalacion {
    schoolId: string;
    conversationId: string;
    contactWaId: string;
    contactName: string | null;
    urgencia: Urgencia;
    categoria: CategoriaUrgente | null;
    /** 'inicial' al escalar, 'reaviso' al vencer el plazo. */
    etapa: 'inicial' | 'reaviso';
    /** Identifica ESTA escalación (id del saliente o minuto); arma el id determinístico. */
    ancla: string;
    /** ¿Mandar push? (el inicial normal no: ya lo manda la transición a abierta). */
    push: boolean;
}

const ETIQUETA_CATEGORIA: Record<CategoriaUrgente, string> = {
    clase: 'problema con la clase o la sede',
    lesion: 'posible lesión',
    seguridad: 'tema de seguridad',
    urgente_declarado: 'lo marcó como urgente',
};

/**
 * In-app (+ push si `push`) a cada admin. Idempotente: el id de la
 * notificación sale de la clave; si otro BFF ya la insertó (23505), este no
 * manda el push. Nunca lanza. Devuelve cuántas notificaciones nuevas dejó.
 */
export async function avisarEscalacionAlEquipo(a: AvisoDeEscalacion): Promise<number> {
    try {
        const ids = await destinatariosDeLaEscuela(a.schoolId);
        if (!ids.length) return 0;
        const quien = etiquetaDeContacto(a.contactName, a.contactWaId);
        const urgente = a.urgencia === 'urgente';
        const titulo = a.etapa === 'reaviso'
            ? (urgente ? `URGENTE sin respuesta: ${quien}` : `${quien} sigue esperando respuesta`)
            : (urgente ? `URGENTE en WhatsApp: ${quien}` : `${quien} pidió hablar con la escuela`);
        const cuerpo = a.etapa === 'reaviso'
            ? `Pasaron ${PLAZO_ESCALACION_MIN[a.urgencia]} min y nadie le ha respondido por WhatsApp.` +
              (a.categoria ? ` Motivo: ${ETIQUETA_CATEGORIA[a.categoria]}.` : '')
            : (a.categoria ? `Motivo: ${ETIQUETA_CATEGORIA[a.categoria]}. ` : '') +
              'El asistente le dijo que una persona le responde. Abre WhatsApp en SportMaps.';
        let nuevas = 0;
        await Promise.allSettled(ids.map(async (uid) => {
            const { error } = await supabase.from('notifications').insert({
                id: uuidDeClave(`wa_escalacion:${a.conversationId}:${a.ancla}:${a.etapa}:${uid}`),
                user_id: uid,
                school_id: a.schoolId,
                title: titulo,
                message: cuerpo,
                type: urgente ? 'warning' : 'info',
                // El CHECK de `notifications.category` no tiene 'whatsapp'; el buzón es atención.
                category: 'support',
                link: `/whatsapp?conversacion=${a.conversationId}`,
                data: {
                    tipo: 'whatsapp_escalado', etapa: a.etapa, urgencia: a.urgencia, categoria: a.categoria,
                    conversation_id: a.conversationId, school_id: a.schoolId,
                },
            });
            if (error) return; // 23505: otro BFF ya avisó a esta persona por esta escalación.
            nuevas++;
            if (a.push) {
                await sendToUser(uid, {
                    title: titulo,
                    body: cuerpo,
                    // FCM exige que todos los valores sean string.
                    data: { tipo: 'whatsapp_escalado', conversation_id: a.conversationId, school_id: a.schoolId,
                            urgencia: a.urgencia, etapa: a.etapa },
                }).catch(() => undefined);
            }
        }));
        return nuevas;
    } catch (e: any) {
        console.warn('[wa-escalaciones] no se pudo avisar al equipo', { conversationId: a.conversationId, err: e?.message });
        return 0;
    }
}

export interface EscalacionPendiente {
    id: string;
    conversationId: string;
    integrationId: string;
    createdAt: string;
    payload: Record<string, any>;
}

/**
 * Salientes «escalated» con plazo (`payload.plazo_min`), de las últimas
 * VENTANA_REVISION_HORAS, sin re-aviso todavía. Las escalaciones de antes de
 * este cambio no tienen `plazo_min` y no se tocan: re-avisar algo de hace
 * horas que nadie configuró así sería una sorpresa. Nunca lanza.
 */
export async function escalacionesSinRevisar(ahora = Date.now()): Promise<EscalacionPendiente[]> {
    try {
        const { data, error } = await supabase.from('whatsapp_messages')
            .select('id, conversation_id, integration_id, created_at, payload')
            .eq('direction', 'outbound')
            .eq('payload->>step', 'escalated')
            .not('payload->>plazo_min', 'is', null)
            .is('payload->>reaviso_at', null)
            .gte('created_at', new Date(ahora - VENTANA_REVISION_HORAS * 3600_000).toISOString())
            .lte('created_at', new Date(ahora - Math.min(...Object.values(PLAZO_ESCALACION_MIN)) * 60_000).toISOString())
            .limit(50);
        if (error || !Array.isArray(data)) return [];
        return (data as any[]).map((f) => ({
            id: f.id, conversationId: f.conversation_id, integrationId: f.integration_id,
            createdAt: f.created_at, payload: f.payload ?? {},
        }));
    } catch {
        return [];
    }
}

/** ¿Una PERSONA de la escuela escribió en el chat después de la escalación? */
export async function respondioUnaPersona(conversationId: string, desde: string): Promise<boolean> {
    const { count, error } = await supabase.from('whatsapp_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conversationId)
        .eq('direction', 'outbound')
        .eq('ai_generated', false)
        .gt('created_at', desde);
    // Sin poder leer, se da por respondida: un re-aviso de más a la familia
    // («nadie te ha contestado») cuando sí le contestaron es peor que uno de menos.
    if (error) return true;
    return (count ?? 0) > 0;
}

/**
 * Reserva el re-aviso de UNA escalación: UPDATE condicional sobre el mismo
 * saliente. Solo uno de los BFF lo logra. Devuelve true si este lo tomó.
 */
export async function reservarRevision(e: EscalacionPendiente, resultado: string, ahora = Date.now()): Promise<boolean> {
    const { data, error } = await supabase.from('whatsapp_messages')
        .update({ payload: { ...e.payload, reaviso_at: new Date(ahora).toISOString(), reaviso: resultado } })
        .eq('id', e.id)
        .is('payload->>reaviso_at', null)
        .select('id');
    return !error && Array.isArray(data) && data.length > 0;
}
