/**
 * whatsapp-bandeja.service — la «Bandeja» de comprobantes de la pantalla de WhatsApp.
 *
 * La bandeja son las filas de `whatsapp_inbound_queue` en `failed | ignored |
 * waiting_user`. Hasta el 2026-10-07 se listaban todas juntas, con un contador
 * que sumaba fotos personales, capturas de correos y comprobantes que la
 * escuela ya había registrado (Dynasty: 113 filas, ~25 pedían algo de verdad,
 * y el listado cortaba en 100). Este módulo:
 *
 *  1. Clasifica cada fila en tres grupos: `accion` (la escuela tiene que
 *     decidir: varios cobros, monto distinto, número sin ficha…), `revisar`
 *     (puede ser plata, pero lo normal es que no) e `informativo` (no pide
 *     nada: no era comprobante, ya estaba registrado, contacto personal).
 *  2. Marca como cerradas por la escuela las filas que alguien resolvió o
 *     descartó. NO hay columna para eso (sin migración): se escribe un prefijo
 *     en `error_message` y se conserva el motivo original detrás de « | ».
 *     El status queda `ignored`, que es lo que ya significa «no lo procesó el
 *     bot»; ningún job reprocesa un `error_message` con este prefijo
 *     (ver `esRecuperable` en whatsapp-recuperacion.service).
 *  3. Cierra solas (sin tocar `payments`) las filas `ya_registrado` cuyo pago
 *     sigue registrado — eran ruido que la escuela no podía sacar de la lista.
 */

/** Prefijo de `error_message` de las filas que cerró la escuela (o el barrido). */
export const PREFIJO_CERRADA = 'cerrado_escuela:';

export const ESTADOS_BANDEJA = ['failed', 'ignored', 'waiting_user'] as const;

/** Estados de pago que cuentan como «ya está registrado». */
export const ESTADOS_PAGO_REGISTRADO = ['paid', 'awaiting_approval', 'approved', 'completed'] as const;

export type GrupoBandeja = 'accion' | 'revisar' | 'informativo';

export interface FilaCruda {
    id: string;
    status: string;
    error_message: string | null;
    result_type?: string | null;
    result_ref_id?: string | null;
}

export interface Clasificacion {
    grupo: GrupoBandeja;
    /** Código estable: varios_cobros, no_es_comprobante, contacto_no_atendido… */
    motivo: string;
    /** Lo que ve la escuela. */
    etiqueta: string;
    /** El detalle que dejó el bot (montos, cobros), sin el código. */
    detalle: string | null;
}

const ETIQUETAS: Record<string, string> = {
    varios_cobros: 'Hay varios cobros posibles',
    monto_distinto: 'El monto no coincide con el cobro',
    sin_familia: 'El número no está en ninguna ficha',
    familia_sin_cuenta: 'Familia sin cuenta en la app',
    numero_ambiguo: 'El número está en varias fichas',
    destino_ajeno: 'El dinero fue a una cuenta que no es de la escuela',
    otro_concepto: 'Es de otro concepto (uniforme, torneo…)',
    fallido: 'No se pudo procesar',
    pregunta_vencida: 'La familia no dijo a qué cobro va',
    sin_pendientes: 'La familia no tiene cobros pendientes',
    esperando_familia: 'Esperando respuesta de la familia',
    archivo_no_disponible: 'No se pudo descargar el archivo',
    bot_apagado: 'Llegó con el asistente apagado',
    contacto_no_atendido: 'Número que no es de una familia',
    no_es_comprobante: 'No era un comprobante',
    es_listado: 'Era un listado de movimientos',
    ya_registrado: 'El pago ya estaba registrado',
    enviado_por_equipo: 'Lo envió alguien del equipo',
    aviso_no_entregado: 'No se le pudo avisar a la familia',
    sin_integracion: 'El canal ya no existe',
    duplicado: 'Comprobante repetido (misma imagen)',
    otro: 'Sin clasificar',
};

const GRUPO_DE: Record<string, GrupoBandeja> = {
    varios_cobros: 'accion',
    monto_distinto: 'accion',
    sin_familia: 'accion',
    familia_sin_cuenta: 'accion',
    numero_ambiguo: 'accion',
    destino_ajeno: 'accion',
    otro_concepto: 'accion',
    fallido: 'accion',
    pregunta_vencida: 'accion',
    sin_pendientes: 'revisar',
    esperando_familia: 'revisar',
    archivo_no_disponible: 'revisar',
    bot_apagado: 'revisar',
    contacto_no_atendido: 'revisar',
    otro: 'revisar',
    no_es_comprobante: 'informativo',
    es_listado: 'informativo',
    ya_registrado: 'informativo',
    enviado_por_equipo: 'informativo',
    aviso_no_entregado: 'informativo',
    sin_integracion: 'informativo',
    duplicado: 'informativo',
};

/** Códigos que escribe la recuperación (`recuperado: <código> — <motivo>`). */
const ALIAS_RECUPERACION: Record<string, string> = {
    numero_ambiguo: 'numero_ambiguo',
};

/** El motivo «crudo» de la fila: código + detalle, sin mirar el contacto. */
export function motivoDeFila(fila: FilaCruda): { motivo: string; detalle: string | null } {
    const em = (fila.error_message ?? '').trim();

    if (em.startsWith('recuperado:')) {
        const resto = em.slice('recuperado:'.length).trim();
        const [codigo, ...det] = resto.split(' — ');
        const c = ALIAS_RECUPERACION[codigo.trim()] ?? codigo.trim();
        return { motivo: c in GRUPO_DE ? c : 'otro', detalle: det.join(' — ').trim() || null };
    }
    if (em.includes('aviso_no_entregado')) return { motivo: 'aviso_no_entregado', detalle: em };
    if (em.startsWith('otro_concepto')) return { motivo: 'otro_concepto', detalle: em.replace(/^otro_concepto:\s*/, '') || null };
    if (em.startsWith('pregunta_vencida')) return { motivo: 'pregunta_vencida', detalle: em.replace(/^pregunta_vencida:\s*/, '') || null };
    if (em.startsWith('referencia ya usada')) return { motivo: 'ya_registrado', detalle: em };
    // Códigos que escribe el worker con «código: detalle» (medido en Dynasty
    // 2026-10-13: 6 «monto_no_cuadra» y 2 «sin_familia:» caían en «Sin clasificar»).
    if (em.startsWith('monto_no_cuadra')) return { motivo: 'monto_distinto', detalle: em.replace(/^monto_no_cuadra:\s*/, '') || null };
    if (em.startsWith('sin_familia:')) return { motivo: 'sin_familia', detalle: em.replace(/^sin_familia:\s*/, '') || null };
    if (em.startsWith('comprobante ya recibido')) return { motivo: 'duplicado', detalle: null };
    if (em.startsWith('consulta_no_comprobante')
        || ['no es un comprobante', 'ni comprobante ni matrícula'].includes(em)) {
        return { motivo: 'no_es_comprobante', detalle: null };
    }
    if (em === 'listado de movimientos') return { motivo: 'es_listado', detalle: null };
    if (em === 'contacto_no_atendido') return { motivo: 'contacto_no_atendido', detalle: null };
    if (em === 'bot_apagado') return { motivo: 'bot_apagado', detalle: null };
    if (em === 'familia_sin_cuenta') return { motivo: 'familia_sin_cuenta', detalle: null };
    if (em === 'sin pagos pendientes') return { motivo: 'sin_pendientes', detalle: null };
    if (em === 'destino no es de la escuela') return { motivo: 'destino_ajeno', detalle: null };
    if (em.startsWith('admin no acudiente')) return { motivo: 'enviado_por_equipo', detalle: null };
    if (em === 'la integración ya no existe') return { motivo: 'sin_integracion', detalle: null };

    if (fila.status === 'waiting_user') return { motivo: 'esperando_familia', detalle: em || null };
    if (fila.status === 'failed') return { motivo: 'fallido', detalle: em || null };
    return { motivo: 'otro', detalle: em || null };
}

/**
 * Grupo final de la fila. `tipoContacto` es `whatsapp_conversations.contact_kind`
 * (null si no se sabe): lo que manda un contacto personal o del equipo baja un
 * escalón — en Dynasty eran la familia de la dueña y transferencias internas.
 */
export function clasificarFila(fila: FilaCruda, tipoContacto?: string | null): Clasificacion {
    const { motivo, detalle } = motivoDeFila(fila);
    let grupo = GRUPO_DE[motivo] ?? 'revisar';
    if (tipoContacto === 'personal' || tipoContacto === 'staff') {
        if (grupo === 'accion') grupo = 'revisar';
        else if (motivo === 'contacto_no_atendido') grupo = 'informativo';
    }
    return { grupo, motivo, etiqueta: ETIQUETAS[motivo] ?? ETIQUETAS.otro, detalle };
}

export function estaCerrada(errorMessage: string | null | undefined): boolean {
    return (errorMessage ?? '').startsWith(PREFIJO_CERRADA);
}

export type AccionDeCierre = 'resuelto' | 'descartado' | 'resuelto_auto';

/** El `error_message` que deja un cierre. Conserva el motivo original tras « | ». */
export function marcaDeCierre(accion: AccionDeCierre, motivo: string, quien: string | null,
                              previo: string | null): string {
    const limpio = motivo.replace(/\s+/g, ' ').replace(/\|/g, '/').trim().slice(0, 200);
    const por = quien ? ` (por ${quien.slice(0, 8)})` : '';
    return `${PREFIJO_CERRADA} ${accion} — ${limpio}${por} | ${previo ?? ''}`.slice(0, 1000);
}

/** Referencia de banco de «referencia ya usada: X» (lo escribe el worker). */
export function referenciaUsada(errorMessage: string | null): string | null {
    const m = (errorMessage ?? '').match(/^referencia ya usada:\s*(\S+)/);
    return m ? m[1] : null;
}

export interface PagoMinimo { id: string; school_id: string; status: string; concept: string | null; ocr_reference?: string | null }

/**
 * Filas que el barrido cierra solas: `ya_registrado` (de la recuperación, con
 * `result_ref_id`, o del worker, «referencia ya usada: X») cuyo pago ES de la
 * escuela y sigue registrado. Si el pago se anuló o rechazó después, la fila
 * se queda: ahí sí puede faltar plata.
 */
export function filasParaAutocierre(
    schoolId: string,
    filas: FilaCruda[],
    pagosPorId: Map<string, PagoMinimo>,
    pagosPorReferencia: Map<string, PagoMinimo>,
): { fila: FilaCruda; pago: PagoMinimo }[] {
    const out: { fila: FilaCruda; pago: PagoMinimo }[] = [];
    for (const f of filas) {
        if (f.status !== 'ignored' || estaCerrada(f.error_message)) continue;
        if (motivoDeFila(f).motivo !== 'ya_registrado') continue;
        const ref = referenciaUsada(f.error_message);
        const pago = (f.result_ref_id ? pagosPorId.get(f.result_ref_id) : undefined)
            ?? (ref ? pagosPorReferencia.get(ref) : undefined);
        if (!pago || pago.school_id !== schoolId) continue;
        if (!(ESTADOS_PAGO_REGISTRADO as readonly string[]).includes(pago.status)) continue;
        out.push({ fila: f, pago });
    }
    return out;
}

export function resumenDeGrupos(clases: Clasificacion[]): Record<GrupoBandeja, number> & { total: number } {
    const r = { accion: 0, revisar: 0, informativo: 0, total: clases.length };
    for (const c of clases) r[c.grupo] += 1;
    return r;
}

// ─── Autocierre por la decisión sobre el pago (2026-10-13) ───────────────────
//
// Dynasty: 206 abiertas y 0 cerradas por la escuela. El barrido de arriba solo
// cerraba `ya_registrado`. Una fila que pedía decidir (varios cobros, monto
// distinto…) seguía abierta aunque la escuela YA hubiera aprobado o rechazado
// ese comprobante desde Pagos (u otro camino): la bandeja quedaba como una
// lista de pendientes que ya no lo eran. Ahora se cierra sola cuando el pago
// enlazado a la fila tiene una decisión POSTERIOR a la llegada de la fila.
//
// Enlace fila → pago (de más a menos directo):
//   · `result_ref_id`                         (lo deja el worker/recuperación)
//   · `pregunta_ocr.sha` = receipt_image_sha256  (misma imagen)
//   · `pregunta_ocr.ocr.reference` = ocr_reference / receipt_reference_norm
// Nunca por «la familia tiene un pago aprobado esos días»: eso cerraría fotos
// que no tenían nada que ver (medido: 20 de 196 en Dynasty, casi todas «no es
// un comprobante»).

/** Pago con lo necesario para saber si ya se decidió. */
export interface PagoDecidible extends PagoMinimo {
    approved_at?: string | null;
    payment_date?: string | null;
    updated_at?: string | null;
    receipt_rejected_at?: string | null;
    receipt_image_sha256?: string | null;
    receipt_reference_norm?: string | null;
}

export interface FilaConEnlace extends FilaCruda {
    created_at?: string | null;
    pregunta_ocr?: any;
}

/** Estados que dejan el cobro vivo tras rechazar el comprobante (reject_payment_receipt). */
const VIVOS_TRAS_RECHAZO = ['pending', 'overdue', 'partial'];

export type DecisionDePago = 'aprobado' | 'rechazado';

/**
 * ¿Se decidió el pago DESPUÉS de que llegó la fila? Pura. Misma semántica que
 * `desenlaceDelPago` del job de desenlaces: un rechazo se reconoce por
 * `receipt_rejected_at` (o el viejo status 'rejected'); una aprobación, por el
 * estado registrado con fecha de aprobación (o de pago) posterior.
 */
export function decisionDelPago(pago: PagoDecidible, filaCreadaEn: string | null | undefined): DecisionDePago | null {
    const llegada = Date.parse(String(filaCreadaEn ?? ''));
    if (!Number.isFinite(llegada)) return null;
    // Margen: la fila se guarda unos segundos después de que entra el mensaje.
    const desde = llegada - 5 * 60_000;
    const despues = (s: string | null | undefined) => {
        const t = Date.parse(String(s ?? ''));
        return Number.isFinite(t) && t >= desde;
    };
    if ((ESTADOS_PAGO_REGISTRADO as readonly string[]).includes(pago.status) && pago.status !== 'awaiting_approval') {
        return despues(pago.approved_at ?? pago.payment_date ?? pago.updated_at) ? 'aprobado' : null;
    }
    if (pago.status === 'rejected') return despues(pago.receipt_rejected_at ?? pago.updated_at) ? 'rechazado' : null;
    if (VIVOS_TRAS_RECHAZO.includes(pago.status) && pago.receipt_rejected_at) {
        return despues(pago.receipt_rejected_at) ? 'rechazado' : null;
    }
    return null;
}

/** sha y referencia que el worker guardó en `pregunta_ocr`. Pura. */
export function huellasDeFila(f: FilaConEnlace): { sha: string | null; referencia: string | null } {
    const p = f.pregunta_ocr ?? null;
    const sha = typeof p?.sha === 'string' && p.sha ? p.sha : null;
    const ref = p?.ocr?.reference ?? p?.ocr?.referencia ?? null;
    return { sha, referencia: typeof ref === 'string' && ref.trim() ? ref.trim() : null };
}

/**
 * Filas abiertas cuyo pago enlazado ya se decidió después de su llegada. Pura.
 * No incluye las `ya_registrado` (las cierra `filasParaAutocierre`).
 */
export function filasParaAutocierrePorDecision(
    schoolId: string,
    filas: FilaConEnlace[],
    pagos: PagoDecidible[],
): { fila: FilaConEnlace; pago: PagoDecidible; decision: DecisionDePago }[] {
    const deLaEscuela = pagos.filter((p) => p.school_id === schoolId);
    const porId = new Map(deLaEscuela.map((p) => [p.id, p]));
    const out: { fila: FilaConEnlace; pago: PagoDecidible; decision: DecisionDePago }[] = [];
    for (const f of filas) {
        if (estaCerrada(f.error_message)) continue;
        if (!(ESTADOS_BANDEJA as readonly string[]).includes(f.status)) continue;
        if (motivoDeFila(f).motivo === 'ya_registrado') continue;
        const { sha, referencia } = huellasDeFila(f);
        const candidatos: PagoDecidible[] = [];
        if (f.result_ref_id && porId.has(f.result_ref_id)) candidatos.push(porId.get(f.result_ref_id)!);
        if (sha) candidatos.push(...deLaEscuela.filter((p) => p.receipt_image_sha256 === sha));
        if (referencia) {
            candidatos.push(...deLaEscuela.filter((p) => p.ocr_reference === referencia || p.receipt_reference_norm === referencia));
        }
        for (const pago of candidatos) {
            const decision = decisionDelPago(pago, f.created_at);
            if (decision) { out.push({ fila: f, pago, decision }); break; }
        }
    }
    return out;
}

/** Cuántas cerró la escuela y cuántas se cerraron solas, a partir de su `error_message`. Pura. */
export function contarCierres(mensajes: (string | null | undefined)[]): { escuela: number; automaticas: number; total: number } {
    let escuela = 0, automaticas = 0;
    for (const m of mensajes) {
        if (!estaCerrada(m)) continue;
        if (/^cerrado_escuela:\s*resuelto_auto\b/.test(String(m))) automaticas++;
        else escuela++;
    }
    return { escuela, automaticas, total: escuela + automaticas };
}
