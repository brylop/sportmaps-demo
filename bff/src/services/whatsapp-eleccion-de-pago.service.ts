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
 * AMPLIADO (Dynasty 2026-10-09). Tres cobros iguales (ago/sep/oct) y la
 * familia contestó en lenguaje natural: «Ya había pagado agosto» recibió LA
 * MISMA lista otra vez, y «el valor actual es de $150.000 porque solo está
 * tomando 2 clases» se leyó como la opción 2 («2 clases») y aplicó el
 * comprobante a septiembre. Ahora:
 *
 *   - Los meses se entienden: «el de septiembre», «octubre», y «agosto ya lo
 *     pagué» DESCARTA agosto (se vuelve a preguntar solo entre lo que queda;
 *     si queda uno, es ese).
 *   - «El último» es el más nuevo; «el más viejo», el más antiguo.
 *   - Una cantidad («2 clases») no es una opción.
 *   - Si discute el VALOR, o dice que ya pagó todo lo que figura pendiente, no
 *     se aplica nada por inferencia: va a la escuela con un resumen.
 *
 * Este módulo solo INTERPRETA. No toca la base ni decide si el monto alcanza;
 * de eso se ocupa quien lo llama, que es el único que sabe cuánta plata llegó.
 */

import type { PagoPendiente } from './whatsapp-receipt-matching.service';

export type Eleccion =
    /**
     * Eligió cobros concretos. `motivo` explica de dónde salió la decisión.
     * `dicePagado`: cobros que, en la misma respuesta, dijo que YA pagó (figuran
     * pendientes): la escuela tiene que enterarse aunque se aplique a otro.
     */
    | {
        tipo: 'elegido';
        pagos: PagoPendiente[];
        motivo: 'numero' | 'todos' | 'mas_antiguo' | 'mas_reciente' | 'atleta' | 'mes' | 'descarte';
        dicePagado?: PagoPendiente[];
    }
    /**
     * Descartó algunos («agosto ya lo pagué», «no es el de agosto») o nombró un
     * mes que tienen varios: se vuelve a preguntar SOLO entre `opciones`.
     */
    | { tipo: 'acotar'; opciones: PagoPendiente[]; dicePagado: PagoPendiente[]; motivo: 'descarte' | 'ambiguo' }
    /**
     * Dice que el VALOR de su mensualidad es otro, o que ya pagó todo lo que
     * figura pendiente. No se aplica por inferencia: lo revisa la escuela.
     */
    | {
        tipo: 'revision_escuela';
        valorDicho: number | null;
        dicePagado: PagoPendiente[];
        todoPagado: boolean;
        razon: string | null;
    }
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
    // «2 clases», «3 hijos», «15 días»: una cantidad, no una opción.
    const crudos = texto.replace(UNIDADES_RE, ' ').match(/\b\d{1,2}\b/g) ?? [];
    const idx = crudos
        .map((n) => Number(n) - 1)
        .filter((i) => i >= 0 && i < cantidad);
    return [...new Set(idx)];
}

/** Un número seguido de una unidad es una cantidad («2 clases»), no una opción. */
const UNIDADES_RE = /\b\d{1,3}\s+(clases?|mil|dias?|hij[oa]s?|mes(es)?|anos?|veces|horas?|semanas?|pesos|personas?|nin[oa]s?|entrenos?|entrenamientos?|sesiones?)\b/g;

// ─── Meses ──────────────────────────────────────────────────────────────────

const MESES: [RegExp, number][] = [
    [/^(enero|ene)$/, 1], [/^(febrero|feb)$/, 2], [/^marzo$/, 3], [/^(abril|abr)$/, 4], [/^mayo$/, 5],
    [/^(junio|jun)$/, 6], [/^(julio|jul)$/, 7], [/^(agosto|ago)$/, 8],
    [/^(septiembre|setiembre|sept|sep|set)$/, 9], [/^(octubre|oct)$/, 10], [/^(noviembre|nov)$/, 11],
    [/^(diciembre|dic)$/, 12],
];
const MES_PALABRA = 'enero|ene|febrero|feb|marzo|abril|abr|mayo|junio|jun|julio|jul|agosto|ago|'
    + 'septiembre|setiembre|sept|sep|set|octubre|oct|noviembre|nov|diciembre|dic';
export const NOMBRE_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
    'septiembre', 'octubre', 'noviembre', 'diciembre'];

function mesDePalabra(w: string): number | null {
    for (const [re, n] of MESES) if (re.test(w)) return n;
    return null;
}

const SIN_NOMBRES: ReadonlySet<string> = new Set();

/** Los meses nombrados en un texto ya `plano`, en orden y sin repetir. */
function mesesEn(t: string, nombres: ReadonlySet<string> = SIN_NOMBRES): number[] {
    const out: number[] = [];
    for (const w of t.split(' ')) {
        // «Abril», «Julio»: si es el nombre de un deportista de la lista, es él.
        const m = nombres.has(w) ? null : mesDePalabra(w);
        if (m && !out.includes(m)) out.push(m);
    }
    return out;
}

/**
 * El mes del cobro como lo lee la familia: el del concepto («Mensualidad
 * 09/2026», «Mensualidad septiembre») y, si el concepto no lo trae, el del
 * vencimiento. Pura.
 */
export function mesDePago(p: PagoPendiente): number | null {
    const concepto = String(p.concept ?? '');
    const mmYyyy = concepto.match(/\b(\d{1,2})\s*[/-]\s*(20\d{2})\b/);
    if (mmYyyy) {
        const n = Number(mmYyyy[1]);
        if (n >= 1 && n <= 12) return n;
    }
    const nombres = new Set(plano(String(p.atleta ?? '')).split(' ').filter(Boolean));
    const porNombre = mesesEn(plano(concepto), nombres);
    if (porNombre.length === 1) return porNombre[0];
    const v = p.due_date ? Number(String(p.due_date).slice(5, 7)) : NaN;
    return Number.isInteger(v) && v >= 1 && v <= 12 ? v : null;
}

/** «agosto», o el concepto si el cobro no tiene mes. Para nombrarlo en el chat y en el resumen. */
export function etiquetaDeCobro(p: PagoPendiente): string {
    const m = mesDePago(p);
    return m ? NOMBRE_MES[m - 1] : (p.concept ?? 'un cobro');
}

/** «ya lo pagué», «ya había pagado», «está pago», «quedó al día». */
const YA_PAGADO_RE = /\b(ya (lo |la |los |las |le |se )?(habia |habiamos |he |hemos )?(pague|pagado|pagamos|cancele|cancelado|cancelamos|abone)|(esta|estan|quedo|quedaron) (pago|pagos|paga|pagado|pagados|al dia|cancelado)|(lo|la|los|las) pague)\b/;

/** «Ya pagué todo», «ya están todos pagos». */
const TODO_PAGADO_RE = /\b(tod[oa]s?|ambos|l[oa]s dos|l[oa]s tres)\b/;

/** Partes de la respuesta («agosto ya lo pagué, es el de septiembre»): cada una se lee aparte. */
function clausulas(crudo: string, nombres: ReadonlySet<string>): string[] {
    const partes = crudo.split(/(?<!\d)[,.](?!\d)|[;:!\n]|\bpero\b|\bsino\b/i).map(plano).filter(Boolean);
    // «julio, agosto y septiembre ya están pagos»: una parte que es solo una
    // enumeración de meses va con la siguiente, que trae el verbo.
    const out: string[] = [];
    let pendiente = '';
    for (const c of partes) {
        const soloMeses = c.split(' ').every((w) => (!nombres.has(w) && mesDePalabra(w) !== null)
            || /^(y|e|el|la|de|del|mes)$/.test(w));
        if (soloMeses && mesesEn(c, nombres).length) { pendiente = `${pendiente} ${c}`.trim(); continue; }
        out.push(`${pendiente} ${c}`.trim());
        pendiente = '';
    }
    if (pendiente) out.push(pendiente);
    return out;
}

/** «09/2026» → «septiembre»: la familia copia el concepto tal como lo vio. */
function conMesesEscritos(texto: string): string {
    return texto.replace(/\b(\d{1,2})\s*\/\s*(20\d{2})\b/g, (x, m) => {
        const n = Number(m);
        return n >= 1 && n <= 12 ? ` ${NOMBRE_MES[n - 1]} ` : x;
    });
}

interface LecturaDeMeses {
    /** Meses que señaló como el bueno. */
    positivos: number[];
    /** Meses que descartó («no es agosto», «agosto ya lo pagué»). */
    descartados: number[];
    /** De los descartados, los que dijo que YA pagó. */
    pagados: number[];
    /** «Ya pagué» (con o sin mes) en alguna parte. */
    diceYaPago: boolean;
}

const NEGADO_RE = new RegExp(
    `\\bno (es |era |fue |va )?(a |al )?(el |la )?(de |del )?(mes de )?(${MES_PALABRA})\\b|\\b(${MES_PALABRA}) no\\b`, 'g');

function leerMeses(crudo: string, nombres: ReadonlySet<string>): LecturaDeMeses {
    const positivos = new Set<number>();
    const descartados = new Set<number>();
    const pagados = new Set<number>();
    let diceYaPago = false;
    for (const c of clausulas(crudo, nombres)) {
        const meses = mesesEn(c, nombres);
        if (YA_PAGADO_RE.test(c)) {
            diceYaPago = true;
            for (const m of meses) { descartados.add(m); pagados.add(m); }
            continue;
        }
        const negados = new Set<number>();
        for (const x of c.matchAll(NEGADO_RE)) {
            const w = x[6] ?? x[7] ?? '';
            const m = nombres.has(w) ? null : mesDePalabra(w);
            if (m) negados.add(m);
        }
        for (const m of meses) (negados.has(m) ? descartados : positivos).add(m);
    }
    return {
        positivos: [...positivos].filter((m) => !descartados.has(m)),
        descartados: [...descartados],
        pagados: [...pagados],
        diceYaPago,
    };
}

// ─── El valor que dice la familia ───────────────────────────────────────────

/** Palabras con las que se habla del valor de la mensualidad o del plan. */
const VALOR_RE = /\b(valor|vale|cuesta|costo|precio|tarifa|cobran|cobrar|cobrando|deberia|debe ser|mensualidad (es|era|sale|queda|quedo|de)|clases?|plan)\b/;
/** «El valor está mal», «ese no es el valor»: reclamo sin cifra. */
const VALOR_MAL_RE = /\b(valor|precio|tarifa|monto) (esta mal|no es|es otro|no coincide|cambio|no corresponde)\b|\bno es (ese|el) (valor|precio|monto)\b/;

/** Un monto en pesos escrito por la familia («$150.000», «150000», «150 mil»). null si no hay. Pura. */
export function montoEscrito(crudo: string): number | null {
    // Primero la cifra escrita entera: «$80.000 mil» es 80.000 (el «mil» sobra),
    // no «000 mil». 5+ cifras sueltas: «2026» (el año de «09/2026») no es un monto.
    const m = crudo.match(/(?<![\d/.,])(\d{1,3}(?:[.,]\d{3})+|\d{5,7})(?![\d/])/);
    if (m) {
        const n = Number(m[1].replace(/[.,]/g, ''));
        if (n >= 1000) return n;
    }
    const mil = plano(crudo).match(/(?:^|\s)(\d{2,3}) mil\b/);
    return mil ? Number(mil[1]) * 1000 : null;
}

/**
 * Los meses que el texto señala como el del pago (no los descartados):
 * «envío saldo sept 15 - oct 15» → [9, 10]; «Mensualidad 10/2026» → [10].
 * `opciones`: para no leer como mes el nombre de un deportista («Abril»). Pura.
 */
export function mesesDelTexto(texto: string, opciones: PagoPendiente[] = []): number[] {
    const nombres = new Set(opciones.flatMap((p) => plano(String(p.atleta ?? '')).split(' ').filter(Boolean)));
    return leerMeses(conMesesEscritos(texto), nombres).positivos;
}

/** «… porque solo está tomando 2 clases» → «solo está tomando 2 clases». */
function razonEscrita(crudo: string): string | null {
    const m = crudo.match(/\b(?:porque|ya que|pues)\s+([\s\S]+)$/i);
    if (!m) return null;
    const r = m[1].replace(/\s+/g, ' ').replace(/[.!¡\s]+$/, '').trim();
    return r ? r.slice(0, 120) : null;
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
export function interpretarEleccion(textoOriginal: string, opciones: PagoPendiente[]): Eleccion {
    const texto = conMesesEscritos(textoOriginal);
    const t = plano(texto);
    if (!t || !opciones.length) return { tipo: 'no_entendi' };

    const nombres = new Set(opciones.flatMap((p) => plano(String(p.atleta ?? '')).split(' ').filter(Boolean)));
    const meses = leerMeses(texto, nombres);
    const conMes = (ms: number[]) => opciones.filter((p) => {
        const m = mesDePago(p);
        return m !== null && ms.includes(m);
    });
    const dicePagado = conMes(meses.pagados);

    // 0. Dice que el VALOR es otro («el valor actual es de $150.000 porque solo
    //    toma 2 clases»). Va antes del número: «2 clases» no es la opción 2, y
    //    aplicar el comprobante a un cobro cuyo valor la familia discute es
    //    decidir por la escuela.
    const monto = montoEscrito(texto);
    if ((monto !== null && VALOR_RE.test(t) && !opciones.some((p) => Number(p.amount) === monto))
        || VALOR_MAL_RE.test(t)) {
        return { tipo: 'revision_escuela', valorDicho: monto, dicePagado, todoPagado: false, razon: razonEscrita(texto) };
    }

    // 1. Un número explícito gana sobre todo lo demás: es lo que le pedimos.
    const idx = numerosElegidos(t, opciones.length);
    if (idx.length) return { tipo: 'elegido', pagos: idx.map((i) => opciones[i]), motivo: 'numero' };

    // 1b. Si está preguntando, no está eligiendo. Va después del número
    //     —«cuál era, la 1?» sí elige— y antes de todo lo que infiere.
    if (esPregunta(texto, t)) return { tipo: 'no_entendi' };

    // 2. «Ya pagué todo»: no queda a qué aplicarlo; lo mira la escuela. Va antes
    //    de «todos», que lo leería como «aplícalo a todos».
    if (meses.diceYaPago && !meses.positivos.length && !meses.descartados.length && TODO_PAGADO_RE.test(t)) {
        return { tipo: 'revision_escuela', valorDicho: null, dicePagado: [], todoPagado: true, razon: razonEscrita(texto) };
    }

    // 3. Meses: «el de septiembre», «octubre», «agosto ya lo pagué».
    if (meses.positivos.length || meses.descartados.length) {
        const descartados = conMes(meses.descartados);
        const quedan = opciones.filter((p) => !descartados.includes(p));
        let señalados = conMes(meses.positivos).filter((p) => quedan.includes(p));
        // «El de Sharik de septiembre»: el nombre desempata el mes.
        const delHijo = porAtleta(t, señalados);
        if (delHijo.length && delHijo.length < señalados.length) señalados = delHijo;
        const nota = dicePagado.length ? { dicePagado } : {};

        if (señalados.length === 1) return { tipo: 'elegido', pagos: señalados, motivo: 'mes', ...nota };
        if (señalados.length > 1) {
            // Ese mes lo tienen varios (dos hijos): se pregunta solo entre ellos.
            return señalados.length < opciones.length
                ? { tipo: 'acotar', opciones: señalados, dicePagado, motivo: 'ambiguo' }
                : { tipo: 'no_entendi' };
        }
        if (descartados.length) {
            // Descartó todo lo que había: dice que ya está al día.
            if (!quedan.length) {
                return { tipo: 'revision_escuela', valorDicho: null, dicePagado, todoPagado: true, razon: razonEscrita(texto) };
            }
            // Queda uno: es ese (lo dijo él, no se infiere).
            if (quedan.length === 1) return { tipo: 'elegido', pagos: quedan, motivo: 'descarte', ...nota };
            return { tipo: 'acotar', opciones: quedan, dicePagado, motivo: 'descarte' };
        }
        // Nombró un mes que no está entre las opciones: no se adivina.
        return { tipo: 'no_entendi' };
    }

    // 4. «Los dos» / «todos». Va ANTES de la deuda porque «págalos todos, los
    //    dos están pendientes» dice las dos cosas y manda la primera.
    if (TODOS_RE.test(t)) return { tipo: 'elegido', pagos: [...opciones], motivo: 'todos' };

    // 5. Nombró a un hijo. Si ese hijo tiene varios cobros, se devuelven todos y
    //    el que llama decide con el monto — acá no se sabe cuánta plata llegó.
    const porHijo = porAtleta(t, opciones);
    if (porHijo.length) return { tipo: 'elegido', pagos: porHijo, motivo: 'atleta' };

    // 6. «El último», «el más reciente», «el de este mes» → el MÁS NUEVO. Va
    //    antes de la deuda: «el último pendiente» trae las dos palabras.
    if (ULTIMO_RE.test(t)) return { tipo: 'elegido', pagos: [opciones[opciones.length - 1]], motivo: 'mas_reciente' };

    // 7. «El pendiente», «la deuda», «lo atrasado», «el más viejo» → el MÁS
    //    ANTIGUO. `opciones` viene del más viejo al más nuevo (due_date ascendente).
    if (DEUDA_RE.test(t)) return { tipo: 'elegido', pagos: [opciones[0]], motivo: 'mas_antiguo' };

    // 8. Un «no» suelto solo cancela si no dijo nada más; si no, es ruido.
    if (CANCELA_RE.test(t) && t.split(' ').length <= 4) return { tipo: 'cancelar' };

    return { tipo: 'no_entendi' };
}

/** «El último», «el más reciente», «el de este mes», «el actual». */
const ULTIMO_RE = /\b(ultimo|ultima|mas reciente|mas nuevo|el actual|la actual|de este mes|del mes actual|el de ahora)\b/;

const cop = (n: number) => `$${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n)}`;
const listaY = (xs: string[]) =>
    xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`;

/**
 * El resumen que recibe la escuela cuando la familia discute el valor o dice
 * que ya pagó algo que figura pendiente. `yaDichos`: meses que dijo pagados en
 * respuestas anteriores a la misma pregunta («Ya había pagado agosto» y luego el
 * valor). Pura.
 */
export function resumenParaLaEscuela(
    e: { valorDicho: number | null; dicePagado: PagoPendiente[]; todoPagado: boolean; razon: string | null },
    yaDichos: string[] = [],
): string {
    const pagados = [...new Set([...yaDichos, ...e.dicePagado.map(etiquetaDeCobro)])];
    const partes: string[] = [];
    if (e.todoPagado) partes.push('ya pagó todo lo que figura pendiente');
    else if (pagados.length) partes.push(`${listaY(pagados)} ya ${pagados.length > 1 ? 'están pagados' : 'está pagado'}`);
    if (e.valorDicho) partes.push(`su mensualidad es ${cop(e.valorDicho)}`);
    if (!partes.length) partes.push('el valor de sus cobros no es el que figura');
    return `La familia dice que ${partes.join(' y que ')}${e.razon ? ` (${e.razon})` : ''}. ` +
        'Mandó un comprobante y no lo apliqué a ningún cobro: revisen su plan y sus pagos.';
}

/** Lo que se le dice a la familia al pasarle a la escuela la revisión del plan. */
export const TEXTO_REVISION_ESCUELA =
    'Le paso esto a la escuela para que revise tu plan y tus pagos. Tu comprobante queda guardado ' +
    'y no lo apliqué a ningún cobro todavía 🙏';

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
