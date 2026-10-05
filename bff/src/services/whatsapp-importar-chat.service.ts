/**
 * whatsapp-importar-chat.service — mete al flujo de revisión los comprobantes
 * de un chat exportado de WhatsApp (Tarea B; spec en
 * docs/specs/whatsapp-importar-chat-exportado.md).
 *
 * Cada imagen sigue EXACTAMENTE el camino de la recuperación en lote
 * (`procesarComprobanteRecuperado`): en revisión de la escuela, nunca
 * aprobada, sin escribirle a nadie. La diferencia es de dónde sale y quién es
 * la familia: acá la elige la escuela, una vez por chat.
 *
 * Cada imagen importada deja su fila en `whatsapp_inbound_queue`, igual que
 * una que llegó por el webhook, con `wa_message_id = 'import:<sha256>'`:
 *   - el buzón la muestra si necesita a una persona;
 *   - el UNIQUE de `wa_message_id` hace idempotente reimportar el mismo chat
 *     (o el mismo comprobante en dos chats): se salta antes de pagar OCR;
 *   - la fila se inserta YA CERRADA. Nunca pasa por `pending`, que es lo que
 *     toma el cron del worker — y el worker le respondería a alguien.
 */

import crypto from 'node:crypto';
import type { Logger } from 'pino';
import { supabase } from '../config/supabase';
import {
    procesarComprobanteRecuperado, cierreDeFila, type ResultadoRecuperacion,
} from './whatsapp-recuperacion.service';
import { describirPago } from './whatsapp-receipt-matching.service';

const BUCKET = 'payment-receipts';

export interface ImportacionDeAdjunto {
    archivo: string;
    fecha: string | null;
    decision: ResultadoRecuperacion['decision'] | 'ya_importado';
    motivo: string;
    monto: number | null;
    cobro: string | null;
}

/** Id determinístico de un adjunto importado: el mismo archivo es la misma fila. */
export const idDeImportacion = (sha: string) => `import:${sha}`;

/**
 * ¿Este acudiente es de esta escuela? Tiene que tener un atleta activo ahí;
 * si no, la escuela estaría aplicando comprobantes a cobros de otra.
 */
export async function acudienteDeLaEscuela(parentId: string, schoolId: string): Promise<boolean> {
    const { data } = await supabase.from('children').select('id')
        .eq('parent_id', parentId).eq('school_id', schoolId).eq('is_active', true).limit(1);
    return !!data?.length;
}

export async function importarAdjunto(a: {
    schoolId: string;
    integrationId: string;
    parentId: string;
    /** El número del contacto en el chat, o el del perfil del acudiente. */
    telefono: string | null;
    archivo: string;
    fecha: string | null;
    contenido: Buffer;
    mime: string;
    log?: Logger;
}): Promise<ImportacionDeAdjunto> {
    const base = { archivo: a.archivo, fecha: a.fecha, monto: null, cobro: null };
    const sha = crypto.createHash('sha256').update(a.contenido).digest('hex');
    const waMessageId = idDeImportacion(sha);

    // Idempotencia ANTES del OCR: reimportar no cuesta nada.
    const { data: previa } = await supabase.from('whatsapp_inbound_queue')
        .select('id, error_message').eq('wa_message_id', waMessageId).maybeSingle();
    if (previa) {
        return { ...base, decision: 'ya_importado', motivo: (previa as any).error_message ?? 'ya se había importado' };
    }

    const ext = a.mime === 'application/pdf' ? 'pdf' : (a.mime.split('/')[1] ?? 'jpg');
    // Misma carpeta que el worker; el nombre por hash hace que subirlo dos
    // veces pise el mismo objeto en vez de duplicar archivos.
    const storagePath = `${a.schoolId}/whatsapp/import-${sha.slice(0, 40)}.${ext}`;
    const { error: upErr } = await supabase.storage.from(BUCKET)
        .upload(storagePath, a.contenido, { contentType: a.mime, upsert: true });
    if (upErr) return { ...base, decision: 'reintentar', motivo: `no se pudo guardar el archivo: ${upErr.message}` };

    const fechaMensaje = a.fecha ? (a.fecha.length === 10 ? `${a.fecha}T12:00:00-05:00` : `${a.fecha}:00-05:00`) : new Date().toISOString();
    const r = await procesarComprobanteRecuperado({
        schoolId: a.schoolId,
        familia: { tipo: 'identificado', parentId: a.parentId },
        base64: a.contenido.toString('base64'),
        mime: a.mime,
        sha,
        storagePath,
        fechaMensaje,
        aplicar: true,
        queueId: waMessageId,
        log: a.log,
    });

    const salida: ImportacionDeAdjunto = {
        ...base,
        decision: r.decision,
        motivo: r.motivo,
        monto: r.ocr?.amount ?? null,
        cobro: r.pago ? describirPago(r.pago) : null,
    };
    // Transitorio (OCR caído): sin fila, para que reimportar lo vuelva a intentar.
    if (r.decision === 'reintentar') return salida;

    const cierre = cierreDeFila(r, new Date().toISOString());
    const { error: insErr } = await supabase.from('whatsapp_inbound_queue').insert({
        school_id: a.schoolId,
        integration_id: a.integrationId,
        wa_phone_number: a.telefono ?? 'chat-importado',
        wa_message_id: waMessageId,
        wa_timestamp: fechaMensaje,
        message_type: a.mime === 'application/pdf' ? 'document' : 'image',
        media_mime_type: a.mime,
        media_caption: `Importado de un chat exportado (${a.archivo})`.slice(0, 300),
        storage_path: storagePath,
        ...cierre,
    });
    if (insErr) {
        // 23505: otra importación simultánea del mismo archivo ganó la carrera.
        // El cobro ya quedó estampado (si tocaba) por ESA importación o por
        // esta; el UNIQUE de referencia/imagen impide el doble estampado.
        a.log?.warn?.({ err: insErr.message, archivo: a.archivo }, '[importar-chat] no se pudo registrar la fila');
    }
    return salida;
}
