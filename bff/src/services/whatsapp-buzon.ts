/**
 * whatsapp-buzon — reglas puras del buzón de conversaciones (Fase A).
 *
 * Separadas de la ruta para poder probarlas sin Express ni Supabase. Medido el
 * 2026-10-03 en Dynasty: 55 conversaciones, todas 'open', mezclando 30 familias
 * con 21 desconocidos y 4 del propio equipo. El buzón tiene que mostrar por
 * defecto SOLO familias y decir cuáles esperan respuesta.
 */

import type { TipoDeContacto } from './whatsapp-atencion.service';

export type VistaDelBuzon = 'familias' | 'otros' | 'todas';

/** Lo que el asistente atiende. Misma lista que TIPOS_QUE_SE_ATIENDEN. */
export const TIPOS_FAMILIA: readonly TipoDeContacto[] = ['familia', 'familia_sin_cuenta', 'ambiguo'];

/**
 * A qué pestaña va una conversación. NULL (sin clasificar todavía) va a
 * "otros": antes de saber quién es, no se le presenta a la escuela como
 * familia. Se reclasifica sola con el próximo mensaje entrante, o con
 * bff/scripts/wa-fase-a-limpieza.ts para las que ya existían.
 */
export function vistaDeTipo(kind: string | null | undefined): Exclude<VistaDelBuzon, 'todas'> {
    return kind && (TIPOS_FAMILIA as readonly string[]).includes(kind) ? 'familias' : 'otros';
}

export function contarPorVista(filas: { contact_kind?: string | null }[]) {
    const conteos = { familias: 0, otros: 0, todas: filas.length };
    for (const f of filas) conteos[vistaDeTipo(f.contact_kind)]++;
    return conteos;
}

/** Momento real del mensaje: el de Meta si vino, si no el de la base. */
const momento = (m: { wa_timestamp?: string | null; created_at?: string | null }) =>
    new Date(m.wa_timestamp ?? m.created_at ?? 0).getTime();

// ─── Echos automáticos de la app WhatsApp Business ──────────────────────────
//
// Con Coexistence, la app del celular de la escuela manda sola el saludo, el
// mensaje de ausencia y las respuestas rápidas, y Meta los entrega como echo:
// idénticos a lo que escribe una persona. Si contaran como respuesta, la
// familia que solo recibió "Gracias por comunicarte con Dynasty…" quedaría
// marcada como atendida sin que nadie le contestara.
//
// Regla (sin configuración): un echo es AUTOMÁTICO si su texto normalizado es
// idéntico al de echos enviados a 3 o más contactos DISTINTOS de la misma
// integración dentro de 7 días (contando el actual), y tiene al menos 20
// caracteres.
//
// Medido en Dynasty el 2026-10-03 (194 echos, 129 con texto):
//  - "Gracias por comunicarte con Dynasty D.C…" (205 caracteres): 7 echos a 7
//    contactos, todos entre 1 y 8 s después del entrante. Es el saludo.
//  - "Hola cómo estás": 3 contactos, pero a 31 min, 36 min y 0 s del entrante:
//    lo escribió la dueña. El largo mínimo lo deja fuera. Sin él, también
//    caerían "listo", "ok", "sii amor" (este último ya va en 2 contactos).
//
// Por qué NO se usa la rapidez ("salió < 5 s después del entrante"):
//  - Sola, es falsa: 28 echos HUMANOS salieron a ≤ 5 s del último entrante en
//    charlas vivas ("Sii amor desde las 6 am" a 0 s, "Ya estoy cuadrando" a
//    0 s). En una charla rápida el entrante llega mientras ella ya escribe.
//  - Como requisito extra tampoco: la fila del entrante se guardó apenas
//    0,4 s antes que la del echo en el caso más justo. Si el webhook del echo
//    gana la carrera, no hay entrante con qué medir y el saludo se tomaría por
//    humano, que es justo el error caro.
//
// Los errores no cuestan lo mismo. Tomar un automático por humano deja a una
// familia sin respuesta y el buzón dice que está atendida. Tomar un humano por
// automático solo deja la conversación como pendiente: la escuela la ve y la
// cierra con un clic. Por eso la regla prefiere equivocarse hacia "automático".
// Si la dueña copia y pega la MISMA respuesta larga a 3 familias en una semana,
// esas conversaciones seguirán pendientes hasta que las cierre: costo aceptado.

/** Contactos distintos con el mismo texto para considerarlo automático. */
export const ECHO_AUTOMATICO_MIN_CONTACTOS = 3;
/** Ventana en la que se cuentan esos contactos. */
export const ECHO_AUTOMATICO_VENTANA_MS = 7 * 24 * 3600_000;
/** Largo mínimo del texto normalizado: los cortos son charla, no plantilla. */
export const ECHO_AUTOMATICO_MIN_LARGO = 20;

/**
 * Texto comparable: minúsculas, sin tildes, espacios colapsados y sin
 * puntuación final. Los emojis se conservan: son parte de la plantilla.
 */
export function normalizarTextoEcho(texto: string | null | undefined): string {
    return (texto ?? '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[\s.,;:!?¡¿…]+$/u, '');
}

/** ¿Un texto ya normalizado, visto en N contactos distintos, es automático? */
export function esTextoAutomatico(normalizado: string, contactosDistintos: number): boolean {
    return normalizado.length >= ECHO_AUTOMATICO_MIN_LARGO
        && contactosDistintos >= ECHO_AUTOMATICO_MIN_CONTACTOS;
}

export type EchoParaRegla = {
    id: string;
    conversation_id: string;
    text_body?: string | null;
    wa_timestamp?: string | null;
    created_at?: string | null;
};

/**
 * Aplica la regla a un lote de echos de UNA integración y devuelve los ids
 * automáticos. Un echo lo es si cae en alguna ventana de 7 días donde su texto
 * llegó a ≥ 3 contactos: así también se marcan el 1.º y el 2.º, que cuando se
 * enviaron todavía no alcanzaban el umbral. Una conversación = un contacto
 * (`uq_wa_conversation` es integration_id + contact_wa_id).
 */
export function echosAutomaticos(echos: EchoParaRegla[]): Set<string> {
    const porTexto = new Map<string, { id: string; conv: string; t: number }[]>();
    for (const e of echos) {
        const n = normalizarTextoEcho(e.text_body);
        if (n.length < ECHO_AUTOMATICO_MIN_LARGO) continue;
        const lista = porTexto.get(n) ?? [];
        lista.push({ id: e.id, conv: e.conversation_id, t: momento(e) });
        porTexto.set(n, lista);
    }

    const automaticos = new Set<string>();
    for (const [n, lista] of porTexto) {
        lista.sort((a, b) => a.t - b.t);
        for (const fin of lista) {
            const ventana = lista.filter((x) => x.t <= fin.t && x.t >= fin.t - ECHO_AUTOMATICO_VENTANA_MS);
            if (esTextoAutomatico(n, new Set(ventana.map((x) => x.conv)).size)) {
                for (const x of ventana) automaticos.add(x.id);
            }
        }
    }
    return automaticos;
}

/** El saliente lo mandó sola la app del negocio (ver arriba). */
export function esSalienteAutomatico(m: { automatico?: unknown; payload?: any }): boolean {
    return m.automatico === true || m.automatico === 'true' || m.payload?.automatico === true;
}

/**
 * ¿La conversación espera respuesta de la escuela?
 *
 * Sí cuando el último ENTRANTE es más nuevo que el último SALIENTE. Saliente
 * es todo lo que mandó el número de la escuela: el bot, el buzón y los echos
 * de Coexistence (lo que la dueña contesta desde su celular se guarda como
 * direction='outbound', ai_generated=false y payload con `to`; 193 filas así
 * el 2026-10-03). Por eso se compara por dirección y no por quién lo escribió.
 *
 * Se ordena por `wa_timestamp` y no por `created_at`: el historial importado y
 * los echos llegan con `created_at` = hora de importación, que no es cuándo se
 * escribió el mensaje.
 *
 * Una conversación cerrada a mano no está pendiente aunque el último sea
 * entrante ("ok, gracias"). Si la familia vuelve a escribir,
 * `wa_ingest_inbound_message` la reabre a 'open'.
 *
 * Los salientes con `payload.automatico=true` (saludo / ausencia de la app del
 * negocio) NO cuentan como respuesta: nadie contestó.
 */
export function calcularPendientes(
    mensajes: {
        conversation_id: string; direction: string; wa_timestamp?: string | null; created_at?: string | null;
        automatico?: unknown; payload?: any;
    }[],
): Map<string, { ultimoEntrante: number; ultimoSaliente: number }> {
    const porConv = new Map<string, { ultimoEntrante: number; ultimoSaliente: number }>();
    for (const m of mensajes) {
        const t = momento(m);
        const e = porConv.get(m.conversation_id) ?? { ultimoEntrante: 0, ultimoSaliente: 0 };
        if (m.direction === 'inbound') e.ultimoEntrante = Math.max(e.ultimoEntrante, t);
        else if (m.direction === 'outbound' && !esSalienteAutomatico(m)) e.ultimoSaliente = Math.max(e.ultimoSaliente, t);
        porConv.set(m.conversation_id, e);
    }
    return porConv;
}

export function estaPendiente(
    status: string | null | undefined,
    tiempos: { ultimoEntrante: number; ultimoSaliente: number } | undefined,
): boolean {
    if (status === 'closed') return false;
    if (!tiempos || tiempos.ultimoEntrante === 0) return false;
    return tiempos.ultimoEntrante > tiempos.ultimoSaliente;
}

/** El error de PostgREST cuando se pide una columna que todavía no existe. */
export function esColumnaInexistente(error: { code?: string; message?: string } | null | undefined): boolean {
    if (!error) return false;
    return error.code === '42703' || error.code === 'PGRST204'
        || /column .* does not exist|could not find the .* column/i.test(error.message ?? '');
}
