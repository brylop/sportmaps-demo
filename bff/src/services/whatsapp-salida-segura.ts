/**
 * whatsapp-salida-segura — Filtro de lo que el MODELO quiere decirle a una familia.
 *
 * Dynasty, 2026-10-06: dos respuestas salieron con «Llamando escalate_to_human»
 * pegado al final (`1bee1bba`, `8a12267e`). Era el turno de REDACCIÓN, que va sin
 * herramientas: el modelo quería escalar, no podía, e imitó el «Llamando
 * get_payment_status» que el bot le había puesto en el historial. La familia
 * leyó el nombre interno de una función.
 *
 * Esto se aplica SOLO a texto del modelo, nunca a los textos deterministas
 * (que llevan enlaces, correos y otras cosas con guion bajo legítimo). Pura y
 * sin dependencias: se prueba con casos reales.
 *
 * Qué hace:
 *   - Quita «Llamando X», «(calling X)», «Invocando la herramienta X».
 *   - Quita las líneas que nombran una herramienta, un identificador en
 *     snake_case (fuera de enlaces y correos), «tool», JSON o bloques de código.
 *   - Si el texto deja ver el prompt («Reglas estrictas», «datos del sistema»,
 *     «tool_use»…) NO se rescata nada: el texto entero es sospechoso.
 *   - Si nombraba `escalate_to_human`, avisa que el modelo quería escalar.
 *
 * Quien llama decide la respuesta segura: si `texto` vuelve null, no se manda
 * nada de lo que escribió el modelo.
 */

export interface ResultadoFiltroSalida {
    /** Texto limpio para enviar, o null si no queda nada confiable. */
    texto: string | null;
    /** ¿Se quitó algo? */
    alterado: boolean;
    /** El modelo intentó escalar a una persona (nombró escalate_to_human). */
    quiereEscalar: boolean;
    /** Por qué se tocó (para el payload del mensaje; nunca para la familia). */
    motivos: string[];
}

/** Señales de que el modelo está devolviendo su prompt o su andamiaje: no se rescata nada. */
const FILTRACION_DE_PROMPT: RegExp[] = [
    /reglas estrictas/i,
    /\b(system prompt|prompt del sistema|instrucciones del sistema|mis instrucciones)\b/i,
    /datos del sistema, no del (acudiente|usuario)/i,
    /\bresultado de [a-z0-9]+(?:_[a-z0-9]+)+/i,
    /<\/?\s*(tool|tools|function|functions|system|tool_call|tool_result)\b/i,
    /\b(tool_use|tool_calls?|tool_result|function_?call|functionCall|function_declarations|tool_choice)\b/i,
];

/** «Llamando escalate_to_human», «(calling get_payment_status)», «Invocando la herramienta x». */
const LLAMADO_INLINE =
    /[ \t]*[(\[]?\s*\b(llamando|llamar[eé]?|calling|invocando|invoco|ejecutando|ejecuto|usando)\s+(a\s+)?(la\s+)?(herramienta|funci[oó]n|tool)?\s*[`'"*]?([a-z0-9]+(?:_[a-z0-9]+)+)[`'"*]?\s*(\([^)\n]*\))?\s*[)\]]?\.?/gi;

const MENCIONA_TOOL = /\btools?\b/i;
const USA_HERRAMIENTA = /\b(usar|uso|usando|usar[eé]|llamar|llamo|llamando|invoco|invocar|ejecuto|ejecutar)\s+(la\s+|una\s+|esta\s+)?(herramienta|funci[oó]n)\b/i;
const LINEA_JSON = /^\s*([{\[]\s*("|$)|"[^"\n]+"\s*:\s*|[}\]],?\s*$)/;
const SNAKE = /\b[a-z0-9]+(?:_[a-z0-9]+)+\b/i;
const URL_O_CORREO = /(https?:\/\/\S+|www\.\S+|[\w.+-]+@[\w-]+\.[\w.-]+)/gi;

/**
 * Emojis de un deporte concreto (auditoría 2026-10-10: ⚽ en un club de
 * voleibol). El bot atiende escuelas de cualquier deporte; un emoji de otro
 * deporte se lee como plantilla genérica. Se quitan del texto del modelo.
 */
export const EMOJIS_DE_DEPORTE =
    /(?:⚽|🏐|🏀|🏈|⚾|🥎|🎾|🏉|🏒|🏑|🥍|🏏|🏓|🏸|🥊|🥋|⛳|🏊|🚴|🏇|🤾|🤽|⛹|🏋|🤸|🤺|🏌|🏄|🚣|🧗|🛹|⛸|🎿|⛷|🏂|🥅)️?(?:\u{1F3FB}|\u{1F3FC}|\u{1F3FD}|\u{1F3FE}|\u{1F3FF})?(?:‍[♀♂]️?)?️?/gu;

/** Quita los emojis de deporte y los espacios que dejan. Pura. */
export function sinEmojisDeDeporte(t: string): string {
    return t.replace(EMOJIS_DE_DEPORTE, '').replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+$/gm, '');
}

/**
 * «Otro sistema procesa las imágenes», «un sistema automático revisa…»: para
 * la familia, quien revisa es la escuela (auditoría 2026-10-10). La oración se
 * reemplaza entera.
 */
const OTRO_SISTEMA = /[^.!?\n]*\b(otro sistema|un sistema (automatico|automático|aparte|externo)|sistema automatizado)\b[^.!?\n]*[.!?]?/gi;
const LA_ESCUELA_REVISA = 'La escuela revisa los comprobantes.';

/**
 * «Voy a consultar el estado de tus pagos.» y nada más: el turno de REDACTAR
 * (los datos ya están en el mensaje) devolvió una promesa de consultar. Desde
 * que ese turno manda las herramientas con tool_choice 'none' (caché de
 * prompt, 2026-10-10) el modelo a veces escribe el preámbulo de la consulta en
 * vez de la respuesta (Dynasty 2026-10-11 `8423dad1`, 2026-10-13 `d0631e79`:
 * 2 de 8 estados de pago). La familia se queda esperando algo que no llega.
 *
 * true = promete consultar/revisar y no trae ningún dato (ni monto, ni enlace,
 * ni fecha). Quien llama usa su respaldo determinista. Pura.
 */
const PROMESA_DE_CONSULTA =
    /\b(voy a|vamos a|d[ée]jame|perm[ií]teme|ya mismo|enseguida|un momento,?\s*(que\s+)?(voy a)?)\s*(consultar|revisar|verificar|buscar|mirar|chequear|validar)\b/i;
const TRAE_DATOS = /(\$\s?\d|\d{1,3}(?:\.\d{3})+|https?:\/\/|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\s+de\s+[a-z]+)/i;
export function prometeConsultarSinDatos(texto: string | null | undefined): boolean {
    const t = String(texto ?? '');
    return PROMESA_DE_CONSULTA.test(t) && !TRAE_DATOS.test(t);
}

function escapar(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Enlaces del texto que NO están en la lista permitida (comparando sin
 * protocolo, `www.` ni barra final; un permitido también cubre sus subrutas).
 * Un enlace que el modelo copió de un mensaje del usuario o armó él mismo es
 * la vía más directa a un pago falso (auditoría 2026-10-28, P-01). Pura.
 */
export function enlacesNoPermitidos(texto: string, permitidos: readonly string[]): string[] {
    const base = (u: string) => u.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '')
        .replace(/[).,;:!?»"'*_]+$/, '').replace(/\/+$/, '');
    const ok = permitidos.map(base).filter(Boolean);
    const enlaces = texto.match(/(https?:\/\/\S+|www\.\S+)/gi) ?? [];
    return enlaces.filter((e) => {
        const b = base(e);
        return !ok.some((p) => b === p || b.startsWith(p + '/') || b.startsWith(p + '?'));
    });
}

export function filtrarSalidaDelModelo(
    texto: string | null | undefined,
    herramientas: readonly string[] = [],
): ResultadoFiltroSalida {
    const motivos: string[] = [];
    const original = (texto ?? '').trim();
    if (!original) return { texto: null, alterado: false, quiereEscalar: false, motivos: ['vacio'] };

    const nombres = herramientas.filter(Boolean);
    const reNombre = nombres.length
        ? new RegExp(`\\b(${nombres.map(escapar).join('|')})\\b`, 'i')
        : null;
    let quiereEscalar = /\bescalate_to_human\b/i.test(original);

    if (FILTRACION_DE_PROMPT.some((re) => re.test(original))) {
        return { texto: null, alterado: true, quiereEscalar, motivos: ['filtracion_de_prompt'] };
    }

    let t = original;

    // Bloques de código: nunca son para la familia.
    if (/```/.test(t)) {
        t = t.replace(/```[\s\S]*?(```|$)/g, '');
        motivos.push('bloque_de_codigo');
    }

    // «Otro sistema procesa las imágenes» → «La escuela revisa los comprobantes.»
    if (OTRO_SISTEMA.test(t)) {
        OTRO_SISTEMA.lastIndex = 0;
        t = t.replace(OTRO_SISTEMA, (m) => (m.startsWith(' ') ? ' ' : '') + LA_ESCUELA_REVISA);
        motivos.push('menciona_otro_sistema');
    }
    OTRO_SISTEMA.lastIndex = 0;

    // Emojis de un deporte (⚽ en un club de voleibol): fuera.
    const sinDeporte = sinEmojisDeDeporte(t);
    if (sinDeporte !== t) {
        t = sinDeporte;
        motivos.push('emoji_de_deporte');
    }

    // «Llamando X» en la misma línea que texto legítimo: se quita el pedazo.
    t = t.replace(LLAMADO_INLINE, (m, _v, _a, _l, _h, nombre: string) => {
        if (/^escalate_to_human$/i.test(nombre)) quiereEscalar = true;
        motivos.push('llamado_a_herramienta');
        return m.startsWith('\n') ? '\n' : '';
    });

    const lineas = t.split(/\r?\n/);
    const quedan: string[] = [];
    for (const linea of lineas) {
        const sinEnlaces = linea.replace(URL_O_CORREO, ' ');
        let motivo: string | null = null;
        if (reNombre && reNombre.test(sinEnlaces)) motivo = 'nombre_de_herramienta';
        else if (MENCIONA_TOOL.test(sinEnlaces) || USA_HERRAMIENTA.test(sinEnlaces)) motivo = 'menciona_herramienta';
        else if (LINEA_JSON.test(linea)) motivo = 'json';
        else if (SNAKE.test(sinEnlaces)) motivo = 'identificador_interno';
        if (motivo) { motivos.push(motivo); continue; }
        quedan.push(linea.replace(/[ \t]+$/, ''));
    }

    const limpio = quedan.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    const alterado = motivos.length > 0;
    // Sin letras (solo emojis o signos) no es una respuesta.
    if (!limpio || !/\p{L}{2,}/u.test(limpio)) {
        return { texto: null, alterado: true, quiereEscalar, motivos: [...new Set([...motivos, 'vacio_tras_filtro'])] };
    }
    return { texto: limpio, alterado, quiereEscalar, motivos: [...new Set(motivos)] };
}
