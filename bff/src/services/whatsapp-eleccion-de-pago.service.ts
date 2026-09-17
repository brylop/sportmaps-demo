/**
 * Qué quiso decir el acudiente cuando le preguntamos a cuál cobro aplicar.
 *
 * El worker ofrece una lista numerada y se queda esperando. La respuesta real
 * casi nunca es un número: es «al de Sharik», «los dos», «al pendiente», «el
 * atrasado». Sin entender eso, la pregunta es un callejón sin salida — que es
 * exactamente lo que era hasta hoy.
 *
 * REGLA DE PRODUCTO (Milena, 2026-09-15). Un teléfono con dos hijos:
 *
 *   - Se PREGUNTA por cuál hijo, o si es por los dos. No se adivina.
 *   - Si contesta que va a pagar la deuda —«el pendiente», «lo atrasado»— se
 *     aplica al MÁS ANTIGUO, y el del mes en curso QUEDA CORRIENDO. Eso último
 *     hay que decírselo: el padre que paga «lo pendiente» se va creyendo que
 *     quedó al día, y el mes corriente le vence igual.
 *
 * Este módulo solo INTERPRETA. No toca la base ni decide si el monto alcanza;
 * de eso se ocupa quien lo llama, que es el único que sabe cuánta plata llegó.
 */

import type { PagoPendiente } from './whatsapp-receipt-matching.service';

export type Eleccion =
    /** Eligió cobros concretos. `motivo` explica de dónde salió la decisión. */
    | { tipo: 'elegido'; pagos: PagoPendiente[]; motivo: 'numero' | 'todos' | 'mas_antiguo' | 'atleta' }
    /** Dijo que no, o que lo revise la escuela. */
    | { tipo: 'cancelar' }
    /** No se entiende. NUNCA se resuelve al azar: se vuelve a preguntar. */
    | { tipo: 'no_entendi' };

/** Sin tildes, sin mayúsculas, sin puntuación. Para comparar lo que escribe la gente. */
const plano = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

/** «el pendiente», «lo atrasado», «la deuda», «el más viejo», «el de agosto». */
const DEUDA_RE = /\b(pendiente|pendientes|atrasad[oa]s?|atraso|deuda|debo|mora|vencid[oa]s?|viej[oa]s?|antigu[oa]s?|anterior|primero|el de atras)\b/;

/** «los dos», «ambos», «todo», «completo». */
const TODOS_RE = /\b(l[oa]s dos|amb[oa]s|tod[oa]s?|tod[oa]|complet[oa]s?|junt[oa]s|el total|en total)\b/;

/**
 * ¿Está preguntando, en vez de eligiendo?
 *
 * «no sé cuál era, me puedes decir cuánto debo» trae la palabra «debo», y sin
 * esta guarda se leía como «aplícalo a la deuda»: el padre preguntaba y le
 * estampábamos un pago. Una pregunta nunca elige — salvo que traiga el número,
 * que se resuelve antes de llegar acá.
 */
function esPregunta(crudo: string, t: string): boolean {
    if (/[?¿]/.test(crudo)) return true;
    return /\b(cuant[oa]s?|cual(es)?|como|donde|quien|por que|porque|me puedes|puedes decirme|sabes)\b/.test(t);
}

/** «no», «ninguno», «que lo vea la escuela», «espera». */
const CANCELA_RE = /\b(no|ningun[oa]?|nada|cancelar?|cancela|espera|esperen|despues|luego|me equivoque|olvidalo)\b/;

/**
 * Los números que escribió, 1-based, mapeados a opciones válidas.
 *
 * Acepta «1», «la 2», «1 y 3», «1,3». NO acepta números de cuatro cifras o más:
 * «pagué 150000» trae un número que no es una opción, y leerlo como la opción 1
 * sería aplicar plata al cobro equivocado.
 */
function numerosElegidos(texto: string, cantidad: number): number[] {
    const crudos = texto.match(/\b\d{1,2}\b/g) ?? [];
    const idx = crudos
        .map((n) => Number(n) - 1)
        .filter((i) => i >= 0 && i < cantidad);
    return [...new Set(idx)];
}

/** ¿Nombró a un atleta de la lista? Basta con un nombre o un apellido propio. */
function porAtleta(texto: string, opciones: PagoPendiente[]): PagoPendiente[] {
    const conNombre = opciones.filter((p) => p.atleta);
    if (!conNombre.length) return [];

    // Palabras que aparecen en VARIOS atletas no identifican a nadie: dos
    // hermanos comparten apellido, y «Zambra» señalaría a los dos.
    //
    // Se cuenta por HIJO, no por pago. Contando pagos, un hijo con dos cobros
    // hacía que su propio nombre pareciera compartido y «el de Sharik» dejaba
    // de resolver — justo el caso que motivó todo esto.
    const nombrePorHijo = new Map<string, string>();
    for (const p of conNombre) nombrePorHijo.set(p.child_id ?? p.id, p.atleta!);

    const frecuencia = new Map<string, number>();
    for (const nombre of nombrePorHijo.values()) {
        for (const parte of new Set(plano(nombre).split(' ').filter((w) => w.length >= 3))) {
            frecuencia.set(parte, (frecuencia.get(parte) ?? 0) + 1);
        }
    }

    const t = ` ${plano(texto)} `;
    const señalados = conNombre.filter((p) =>
        plano(p.atleta!).split(' ').some((w) =>
            w.length >= 3 && frecuencia.get(w) === 1 && t.includes(` ${w} `),
        ),
    );

    const ids = new Set(señalados.map((p) => p.child_id ?? p.id));
    return opciones.filter((p) => ids.has(p.child_id ?? p.id));
}

/**
 * Interpreta la respuesta contra las opciones EXACTAS que se le ofrecieron.
 *
 * `opciones` tiene que venir congelada del momento de la pregunta, no
 * recalculada: entre la pregunta y la respuesta la escuela pudo aprobar un pago
 * o pudo entrar la mensualidad del mes, y ahí «1» ya señala otra cosa.
 */
export function interpretarEleccion(texto: string, opciones: PagoPendiente[]): Eleccion {
    const t = plano(texto);
    if (!t || !opciones.length) return { tipo: 'no_entendi' };

    // 1. Un número explícito gana sobre todo lo demás: es lo que le pedimos.
    const idx = numerosElegidos(t, opciones.length);
    if (idx.length) return { tipo: 'elegido', pagos: idx.map((i) => opciones[i]), motivo: 'numero' };

    // 1b. Si está preguntando, no está eligiendo. Va después del número
    //     —«cuál era, la 1?» sí elige— y antes de todo lo que infiere.
    if (esPregunta(texto, t)) return { tipo: 'no_entendi' };

    // 2. «Los dos» / «todos». Va ANTES de la deuda porque «págalos todos, los
    //    dos están pendientes» dice las dos cosas y manda la primera.
    if (TODOS_RE.test(t)) return { tipo: 'elegido', pagos: [...opciones], motivo: 'todos' };

    // 3. Nombró a un hijo. Si ese hijo tiene varios cobros, se devuelven todos y
    //    el que llama decide con el monto — acá no se sabe cuánta plata llegó.
    const porHijo = porAtleta(t, opciones);
    if (porHijo.length) return { tipo: 'elegido', pagos: porHijo, motivo: 'atleta' };

    // 4. «El pendiente», «la deuda», «lo atrasado» → el MÁS ANTIGUO.
    //    `opciones` viene del más viejo al más nuevo (due_date ascendente).
    if (DEUDA_RE.test(t)) return { tipo: 'elegido', pagos: [opciones[0]], motivo: 'mas_antiguo' };

    // 5. Un «no» suelto solo cancela si no dijo nada más; si no, es ruido.
    if (CANCELA_RE.test(t) && t.split(' ').length <= 4) return { tipo: 'cancelar' };

    return { tipo: 'no_entendi' };
}

/**
 * Lo que queda debiendo después de aplicar el comprobante.
 *
 * Existe por la mitad menos obvia de la regla: quien paga «lo pendiente» se va
 * convencido de que quedó al día. Si no se le dice que el mes corriente sigue
 * vivo, la escuela se entera cuando ese cobro vence.
 */
export function loQueQueda(opciones: PagoPendiente[], aplicados: PagoPendiente[]): PagoPendiente[] {
    const ya = new Set(aplicados.map((p) => p.id));
    return opciones.filter((p) => !ya.has(p.id));
}
