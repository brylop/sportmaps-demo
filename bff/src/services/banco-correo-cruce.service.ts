/**
 * Cruce DETERMINÍSTICO de un aviso bancario verificado contra los pagos de la
 * escuela, y orquestación del webhook de Resend Inbound. Sin IA.
 *
 * Qué puede pasar con un aviso (y nada más):
 *
 *   conciliado  → coincide con UN pago ya 'paid' → reconciliation_status =
 *                 'confirmado'. Es lo único que se escribe en `payments`.
 *   candidato   → coincide con UN pago PENDIENTE (o con uno pagado pero con
 *                 evidencia contradictoria). Se guarda el candidato; la escuela
 *                 aprueba el pago por el flujo normal. NUNCA se aprueba aquí.
 *   ambiguo     → varios pagos posibles (familias que pagan lo mismo el mismo
 *                 día). Decide una persona.
 *   sin_cruce   → plata real sin pago que le corresponda.
 *
 * Criterios (todos exactos o con ventana fija):
 *   · Monto EXACTO en pesos enteros (pagado: amount_paid ?? amount).
 *   · Fecha: contra la del comprobante (ocr_date, ±1 día). Si no hay, para un
 *     pago aprobado contra payment_date —que es el día que la escuela aprobó,
 *     no el de la transferencia— entre −1 y +3 días; para uno pendiente,
 *     vencimiento a ±45 días.
 *   · Cuenta/llave destino: si el aviso y el comprobante la traen, los últimos
 *     4 dígitos tienen que coincidir. Si uno no la trae, no descarta.
 *   · Nombre: `mismoNombre()` contra el origen leído del comprobante o el
 *     acudiente. Desempata; y si el comprobante dice OTRO nombre, un pago
 *     pagado elegido solo por monto+fecha no se confirma (queda candidato).
 *   · La referencia del comprobante NO se usa: el correo del banco no la trae.
 */

import { leerCorreoDeBanco, mismoNombre, type EntradaBancaria } from './banco-correo-parser.service';
import {
    leerConfirmacionReenvio,
    verificarCorreoBancario,
    type ResultadoVerificacion,
} from './banco-correo-dkim.service';
import type { DNSResolver } from 'mailauth';

// ─── Cruce puro ──────────────────────────────────────────────────────────────

export interface PagoCandidato {
    id: string;
    status: string;
    amount: number;
    amount_paid: number | null;
    payment_date: string | null;
    ocr_date: string | null;
    due_date: string | null;
    reconciliation_status: string | null;
    ocr_destination: string | null;
    ocr_origin_name: string | null;
    /** Nombre del acudiente (profiles.full_name de parent_id). */
    nombre_pagador: string | null;
    /** Ya hay otro aviso 'conciliado' que reclama este pago. */
    ya_conciliado_por_aviso: boolean;
}

export type EstadoCruce = 'conciliado' | 'candidato' | 'ambiguo' | 'sin_cruce';

export interface DecisionCruce {
    estado: EstadoCruce;
    paymentId: string | null;
    /** Por qué se eligió: 'monto_fecha' | 'monto_fecha_nombre' | 'ninguno'. */
    base: 'monto_fecha' | 'monto_fecha_nombre' | 'ninguno';
    candidatos: string[];
}

const ESTADOS_PENDIENTES = new Set(['pending', 'overdue', 'awaiting_approval']);
const MAX_CANDIDATOS = 10;

const DIA_MS = 86_400_000;
function diasEntre(a: string, b: string): number {
    return Math.round((Date.parse(`${a.slice(0, 10)}T00:00:00Z`) - Date.parse(`${b.slice(0, 10)}T00:00:00Z`)) / DIA_MS);
}

const digitos = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '');

/** Últimos 4 dígitos coinciden, o alguno de los dos no trae suficiente para comparar. */
export function destinoCompatible(delAviso: string | null, delComprobante: string | null): boolean {
    const a = digitos(delAviso);
    const c = digitos(delComprobante);
    if (a.length < 4 || c.length < 4) return true;
    return a.slice(-4) === c.slice(-4);
}

function montoDelPago(p: PagoCandidato): number {
    const m = p.status === 'paid' ? (p.amount_paid ?? p.amount) : p.amount;
    return Math.round(Number(m));
}

function fechaCompatible(p: PagoCandidato, fecha: string): boolean {
    if (p.ocr_date) return Math.abs(diasEntre(p.ocr_date, fecha)) <= 1;
    if (p.status === 'paid') {
        if (!p.payment_date) return false;
        const d = diasEntre(p.payment_date, fecha);
        return d >= -1 && d <= 3;
    }
    if (!p.due_date) return false;
    return Math.abs(diasEntre(p.due_date, fecha)) <= 45;
}

function elegible(p: PagoCandidato): boolean {
    if (p.status === 'paid') {
        return !p.ya_conciliado_por_aviso
            && (p.reconciliation_status === null || p.reconciliation_status === 'pendiente');
    }
    return ESTADOS_PENDIENTES.has(p.status);
}

function nombreCoincide(p: PagoCandidato, remitente: string): boolean {
    return (!!p.ocr_origin_name && mismoNombre(remitente, p.ocr_origin_name))
        || (!!p.nombre_pagador && mismoNombre(remitente, p.nombre_pagador));
}

/** El comprobante trae un nombre de origen y NO es el del aviso (ni el del acudiente). */
function nombreContradice(p: PagoCandidato, remitente: string): boolean {
    return !!p.ocr_origin_name && !nombreCoincide(p, remitente);
}

export function decidirCruce(entrada: EntradaBancaria, pagos: PagoCandidato[]): DecisionCruce {
    const cands = pagos.filter((p) =>
        elegible(p)
        && montoDelPago(p) === Math.round(entrada.monto)
        && fechaCompatible(p, entrada.fecha)
        && destinoCompatible(entrada.destino, p.ocr_destination));

    if (cands.length === 0) return { estado: 'sin_cruce', paymentId: null, base: 'ninguno', candidatos: [] };

    const conNombre = cands.filter((p) => nombreCoincide(p, entrada.remitente));
    let elegido: PagoCandidato | null = null;
    let baseEleccion: DecisionCruce['base'] = 'ninguno';
    if (conNombre.length === 1) { elegido = conNombre[0]; baseEleccion = 'monto_fecha_nombre'; }
    else if (cands.length === 1) { elegido = cands[0]; baseEleccion = 'monto_fecha'; }

    const ids = cands.map((p) => p.id).slice(0, MAX_CANDIDATOS);
    if (!elegido) return { estado: 'ambiguo', paymentId: null, base: 'ninguno', candidatos: ids };

    if (elegido.status === 'paid') {
        // Solo por monto+fecha y el comprobante dice que pagó OTRA persona:
        // puede ser justo el comprobante falso que este aviso NO respalda.
        if (baseEleccion === 'monto_fecha' && nombreContradice(elegido, entrada.remitente)) {
            return { estado: 'candidato', paymentId: elegido.id, base: baseEleccion, candidatos: ids };
        }
        return { estado: 'conciliado', paymentId: elegido.id, base: baseEleccion, candidatos: ids };
    }
    return { estado: 'candidato', paymentId: elegido.id, base: baseEleccion, candidatos: ids };
}

// ─── Orquestación del webhook ────────────────────────────────────────────────

/** Evento `email.received` de Resend (solo lo que se usa). */
export interface EventoResendRecibido {
    type: string;
    data?: {
        email_id?: string;
        to?: string[];
        cc?: string[];
        bcc?: string[];
        received_for?: string[];
    };
}

export interface FilaAviso {
    school_id: string;
    resend_email_id: string;
    message_id: string | null;
    body_sha256: string;
    recipient: string;
    from_address: string | null;
    subject: string | null;
    signed_to: string[];
    dkim_domain: string | null;
    dkim_selector: string | null;
    via_adjunto: boolean;
    estado: 'verificado' | 'rechazado' | 'no_es_aviso' | 'confirmacion_reenvio';
    motivo: string | null;
    banco: string | null;
    monto: number | null;
    fecha: string | null;
    hora: string | null;
    remitente: string | null;
    banco_origen: string | null;
    destino: string | null;
    detalle: Record<string, unknown>;
}

export interface AvisoGuardado {
    id: string;
    estado: string;
    banco: string | null;
    monto: number | null;
    fecha: string | null;
    hora: string | null;
    remitente: string | null;
    banco_origen: string | null;
    destino: string | null;
}

/** Acceso a datos. En producción lo implementa Supabase (service_role); en tests, memoria. */
export interface RepoAvisosBanco {
    buzonPorToken(token: string): Promise<{ schoolId: string; mailboxes: string[] } | null>;
    flagActivo(schoolId: string): Promise<boolean>;
    /** El aviso ya guardado de esta entrega de Resend, si existe (reintentos). */
    avisoPorEntrega(resendEmailId: string): Promise<AvisoGuardado | null>;
    /** Inserta; 'duplicado' si (message_id, body_sha256) o resend_email_id ya existen. */
    insertarAviso(fila: FilaAviso): Promise<{ id: string } | 'duplicado'>;
    pagosCandidatos(schoolId: string, monto: number): Promise<PagoCandidato[]>;
    aplicarCruce(noticeId: string, estado: EstadoCruce | 'no_es_aviso', paymentId: string | null, detalle: Record<string, unknown>): Promise<string>;
}

export interface FuenteCorreo {
    /** MIME crudo del correo recibido (Resend: GET /emails/receiving/{id} → raw.download_url). */
    mimeCrudo(emailId: string): Promise<Buffer>;
}

export type ResultadoProceso =
    | { resultado: 'ignorado'; motivo: string }
    | { resultado: 'duplicado' }
    | { resultado: 'rechazado'; motivo: string; noticeId: string }
    | { resultado: 'confirmacion_reenvio'; noticeId: string }
    | { resultado: 'no_es_aviso'; noticeId: string }
    | { resultado: 'procesado'; estado: string; noticeId: string; paymentId: string | null };

/** Saca la dirección de «Nombre <a@b>» o «a@b». */
const soloCorreo = (s: string) => (/<([^>]+)>/.exec(s)?.[1] ?? s).trim().toLowerCase();

/**
 * Dirección de recepción: banco+<token>@<dominio>. Se busca en to, cc, bcc y
 * received_for: con el reenvío automático de Gmail el To: sigue siendo el buzón
 * de la escuela y nuestra dirección solo aparece como destinatario del sobre.
 */
export function tokenDeDestinatarios(evento: EventoResendRecibido, dominio: string): { token: string; direccion: string } | null {
    const d = evento.data ?? {};
    const todos = [...(d.received_for ?? []), ...(d.to ?? []), ...(d.cc ?? []), ...(d.bcc ?? [])].map(soloCorreo);
    const dom = dominio.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`^banco\\+([a-f0-9]{20})@${dom}$`);
    for (const dir of todos) {
        const m = re.exec(dir);
        if (m) return { token: m[1], direccion: dir };
    }
    return null;
}

export interface DepsProceso {
    repo: RepoAvisosBanco;
    fuente: FuenteCorreo;
    dominioEntrada: string;
    resolver?: DNSResolver;
}

/**
 * Procesa UN evento ya autenticado (firma Svix verificada por la ruta).
 * Idempotente: la misma entrega (resend_email_id) o el mismo contenido
 * (message-id + sha256 del cuerpo) no se procesan dos veces.
 * Lanza solo ante fallas de infraestructura (para que Resend reintente).
 */
export async function procesarEventoResend(evento: EventoResendRecibido, deps: DepsProceso): Promise<ResultadoProceso> {
    if (evento.type !== 'email.received') return { resultado: 'ignorado', motivo: 'tipo_evento' };
    const emailId = evento.data?.email_id;
    if (!emailId) return { resultado: 'ignorado', motivo: 'sin_email_id' };

    const destino = tokenDeDestinatarios(evento, deps.dominioEntrada);
    if (!destino) return { resultado: 'ignorado', motivo: 'destinatario_desconocido' };

    const buzon = await deps.repo.buzonPorToken(destino.token);
    if (!buzon) return { resultado: 'ignorado', motivo: 'destinatario_desconocido' };
    if (!(await deps.repo.flagActivo(buzon.schoolId))) return { resultado: 'ignorado', motivo: 'flag_apagado' };

    // Reintento de Resend: si el aviso quedó guardado pero el cruce no alcanzó a
    // correr (caída entre los dos pasos), se retoma; si no, es duplicado.
    const previo = await deps.repo.avisoPorEntrega(emailId);
    if (previo) {
        if (previo.estado !== 'verificado' || previo.monto === null || !previo.fecha) return { resultado: 'duplicado' };
        return cruzar(previo.id, {
            banco: (previo.banco ?? 'nequi') as EntradaBancaria['banco'],
            monto: Number(previo.monto),
            fecha: previo.fecha,
            hora: previo.hora,
            remitente: previo.remitente ?? '',
            bancoOrigen: previo.banco_origen,
            destino: previo.destino,
        }, buzon.schoolId, deps);
    }

    const mime = await deps.fuente.mimeCrudo(emailId);
    const v: ResultadoVerificacion = await verificarCorreoBancario(mime, {
        buzones: buzon.mailboxes,
        direccionEntrada: destino.direccion,
        resolver: deps.resolver,
    });

    const fila: FilaAviso = {
        school_id: buzon.schoolId,
        resend_email_id: emailId,
        message_id: v.messageId,
        body_sha256: v.bodySha256,
        recipient: destino.direccion,
        from_address: v.from,
        subject: v.subject ? v.subject.slice(0, 300) : null,
        signed_to: v.signedTo,
        dkim_domain: v.dkimDomain,
        dkim_selector: v.dkimSelector,
        via_adjunto: v.viaAdjunto,
        estado: 'rechazado',
        motivo: v.motivo,
        banco: v.banco,
        monto: null, fecha: null, hora: null, remitente: null, banco_origen: null, destino: null,
        detalle: {},
    };

    if (!v.ok) {
        const ins = await deps.repo.insertarAviso(fila);
        if (ins === 'duplicado') return { resultado: 'duplicado' };
        return { resultado: 'rechazado', motivo: v.motivo ?? 'desconocido', noticeId: ins.id };
    }

    if (v.tipo === 'confirmacion_reenvio') {
        const ins = await deps.repo.insertarAviso({
            ...fila, estado: 'confirmacion_reenvio', motivo: null,
            detalle: leerConfirmacionReenvio(v.texto) as Record<string, unknown>,
        });
        if (ins === 'duplicado') return { resultado: 'duplicado' };
        return { resultado: 'confirmacion_reenvio', noticeId: ins.id };
    }

    const entrada = leerCorreoDeBanco(v.from ?? '', v.texto);
    if (!entrada) {
        const ins = await deps.repo.insertarAviso({ ...fila, estado: 'no_es_aviso', motivo: null });
        if (ins === 'duplicado') return { resultado: 'duplicado' };
        return { resultado: 'no_es_aviso', noticeId: ins.id };
    }

    const ins = await deps.repo.insertarAviso({
        ...fila,
        estado: 'verificado',
        motivo: null,
        monto: entrada.monto,
        fecha: entrada.fecha,
        hora: entrada.hora,
        remitente: entrada.remitente,
        banco_origen: entrada.bancoOrigen,
        destino: entrada.destino,
    });
    if (ins === 'duplicado') return { resultado: 'duplicado' };

    return cruzar(ins.id, entrada, buzon.schoolId, deps);
}

async function cruzar(noticeId: string, entrada: EntradaBancaria, schoolId: string, deps: DepsProceso): Promise<ResultadoProceso> {
    const pagos = await deps.repo.pagosCandidatos(schoolId, entrada.monto);
    const dec = decidirCruce(entrada, pagos);
    const estado = await deps.repo.aplicarCruce(noticeId, dec.estado, dec.paymentId, {
        base: dec.base,
        candidatos: dec.candidatos,
    });
    return { resultado: 'procesado', estado, noticeId, paymentId: dec.paymentId };
}
