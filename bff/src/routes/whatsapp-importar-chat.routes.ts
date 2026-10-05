/**
 * Importar un chat exportado de WhatsApp (Tarea B).
 *
 * Para los comprobantes de ANTES de conectar el número (Dynasty: antes del
 * 2026-10-02), que solo están en el celular de la dueña. Spec:
 * docs/specs/whatsapp-importar-chat-exportado.md.
 *
 *   POST /api/v1/whatsapp/:schoolId/importar-chat/analizar   (cuerpo: el .zip)
 *     → quién mandó fotos en ese chat, cuántas, y si el número se reconoce;
 *       más la lista de acudientes para elegir cuando el contacto está
 *       guardado con nombre. No guarda nada.
 *
 *   POST /api/v1/whatsapp/:schoolId/importar-chat?remitente=…&parentId=…   (cuerpo: el .zip)
 *     → procesa hasta LOTE fotos de ESE remitente que no se hayan importado.
 *       Responde `quedan`: el cliente vuelve a llamar hasta que sea 0. Por
 *       lotes porque el OCR tarda 5-20 s por foto y un chat puede traer 80.
 *
 * El zip viaja dos (o más) veces en vez de quedar guardado: no hay que
 * limpiar nada, y un chat exportado pesa pocos MB.
 */

import express, { Router, type Response } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth, type AuthenticatedRequest } from '../middlewares/authMiddleware';
import { administraEstaEscuela } from './whatsapp-admin.routes';
import { leerZip, ZipInvalidoError, type EntradaZip } from '../utils/zip-lector';
import { analizarChat, archivoDelChat, mimeDeArchivo } from '../services/whatsapp-chat-exportado';
import { identificarFamilia } from '../services/whatsapp-recuperacion.service';
import { acudienteDeLaEscuela, importarAdjunto, type ImportacionDeAdjunto } from '../services/whatsapp-importar-chat.service';

const router = Router();

/** Tope del .zip. Un chat de una familia con fotos rara vez pasa de 10 MB. */
export const MAX_ZIP_BYTES = 40 * 1024 * 1024;
/** Tope por archivo: el mismo que el worker acepta de Meta. */
const MAX_ARCHIVO_BYTES = 8 * 1024 * 1024;
/** Fotos por llamada. */
const LOTE = 15;
const CONCURRENCIA = 3;

const cuerpoZip = express.raw({
    type: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'],
    limit: MAX_ZIP_BYTES,
});

const UUID = /^[0-9a-f-]{36}$/i;

function abrirChat(buf: unknown): { error: string } | { entradas: Map<string, EntradaZip>; chat: ReturnType<typeof analizarChat> } {
    if (!Buffer.isBuffer(buf) || buf.length === 0) return { error: 'Sube el archivo .zip del chat exportado.' };
    let lista: EntradaZip[];
    try {
        lista = leerZip(buf, { maxBytesPorArchivo: MAX_ARCHIVO_BYTES });
    } catch (err) {
        return { error: err instanceof ZipInvalidoError ? err.message : 'No se pudo leer el .zip.' };
    }
    const entradas = new Map(lista.map((e) => [e.nombre, e]));
    const nombreChat = archivoDelChat(lista.map((e) => e.nombre));
    if (!nombreChat) return { error: 'El .zip no trae el texto del chat. Expórtalo desde WhatsApp con «Incluir archivos».' };
    let texto: string;
    try {
        texto = entradas.get(nombreChat)!.leer().toString('utf8');
    } catch {
        return { error: 'No se pudo leer el texto del chat.' };
    }
    const imagenes = lista.filter((e) => mimeDeArchivo(e.nombre)).map((e) => e.nombre);
    return { entradas, chat: analizarChat(texto, imagenes) };
}

// ── POST /:schoolId/importar-chat/analizar ──────────────────────────────────
router.post('/:schoolId/importar-chat/analizar', requireAuth, cuerpoZip, async (req: AuthenticatedRequest, res: Response) => {
    const { schoolId } = req.params as { schoolId: string };
    if (!(await administraEstaEscuela(req.user.id, schoolId))) return res.status(403).json({ error: 'forbidden' });

    const abierto = abrirChat(req.body);
    if ('error' in abierto) return res.status(400).json({ error: abierto.error });

    const { data: integracion } = await supabase.from('school_whatsapp_integrations')
        .select('id').eq('school_id', schoolId).maybeSingle();

    // Si el remitente aparece como número, se intenta reconocer. En modo
    // lectura: analizar no tiene que vincular conversaciones ni dejar rastro.
    const cache = {};
    const remitentes = await Promise.all(abierto.chat.remitentes.map(async (r) => {
        if (!r.telefono || !integracion) return { ...r, familia: null };
        const f = await identificarFamilia(integracion.id as string, schoolId, `57${r.telefono}`, { soloLectura: true, cache });
        return { ...r, familia: f };
    }));

    // Acudientes con cuenta y atleta activo: para elegir cuando el contacto
    // está guardado con nombre. Sin cuenta no hay `parent_id` en los cobros y
    // no hay a qué aplicar (ver spec §4).
    const { data: hijos } = await supabase.from('children')
        .select('full_name, parent_id').eq('school_id', schoolId).eq('is_active', true)
        .not('parent_id', 'is', null).limit(5000);
    const hijosPorAcudiente = new Map<string, string[]>();
    for (const h of hijos ?? []) {
        const id = (h as any).parent_id as string;
        if (!hijosPorAcudiente.has(id)) hijosPorAcudiente.set(id, []);
        hijosPorAcudiente.get(id)!.push((h as any).full_name ?? '');
    }
    const ids = Array.from(hijosPorAcudiente.keys());
    const acudientes: { id: string; nombre: string; telefono: string | null; hijos: string[] }[] = [];
    for (let i = 0; i < ids.length; i += 150) {
        const { data: perfiles } = await supabase.from('profiles').select('id, full_name, phone').in('id', ids.slice(i, i + 150));
        for (const p of perfiles ?? []) {
            const tel = String((p as any).phone ?? '').replace(/\D/g, '');
            acudientes.push({
                id: (p as any).id,
                nombre: (p as any).full_name ?? '(sin nombre)',
                // Solo los últimos 4: alcanza para distinguir y no expone el número.
                telefono: tel ? tel.slice(-4) : null,
                hijos: hijosPorAcudiente.get((p as any).id) ?? [],
            });
        }
    }
    acudientes.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    return res.json({
        conectado: !!integracion,
        remitentes,
        adjuntos: abierto.chat.adjuntos.length,
        acudientes,
        lote: LOTE,
    });
});

// ── POST /:schoolId/importar-chat ───────────────────────────────────────────
router.post('/:schoolId/importar-chat', requireAuth, cuerpoZip, async (req: AuthenticatedRequest, res: Response) => {
    const { schoolId } = req.params as { schoolId: string };
    if (!(await administraEstaEscuela(req.user.id, schoolId))) return res.status(403).json({ error: 'forbidden' });

    const remitente = typeof req.query.remitente === 'string' ? req.query.remitente : '';
    const parentId = typeof req.query.parentId === 'string' ? req.query.parentId : '';
    if (!remitente || !UUID.test(parentId)) return res.status(400).json({ error: 'Falta elegir el remitente y el acudiente.' });

    if (!(await acudienteDeLaEscuela(parentId, schoolId))) {
        return res.status(400).json({ error: 'Ese acudiente no tiene atletas activos en esta escuela.' });
    }
    const { data: integracion } = await supabase.from('school_whatsapp_integrations')
        .select('id').eq('school_id', schoolId).maybeSingle();
    if (!integracion) return res.status(400).json({ error: 'La escuela no tiene WhatsApp conectado.' });

    const abierto = abrirChat(req.body);
    if ('error' in abierto) return res.status(400).json({ error: abierto.error });

    const delRemitente = abierto.chat.adjuntos.filter((a) => a.remitente === remitente);
    if (delRemitente.length === 0) return res.status(400).json({ error: 'Ese remitente no mandó fotos en este chat.' });

    // Teléfono para la fila: el del chat si el contacto no estaba guardado,
    // si no el del perfil del acudiente (así el buzón muestra un número real).
    const telChat = abierto.chat.remitentes.find((r) => r.nombre === remitente)?.telefono ?? null;
    let telefono: string | null = telChat ? `57${telChat}` : null;
    if (!telefono) {
        const { data: perfil } = await supabase.from('profiles').select('phone').eq('id', parentId).maybeSingle();
        const d = String((perfil as any)?.phone ?? '').replace(/\D/g, '');
        telefono = d.length >= 10 ? `57${d.slice(-10)}` : null;
    }

    const resultados: ImportacionDeAdjunto[] = [];
    let procesadas = 0;
    let i = 0;
    const log = (req as any).log;
    const trabajador = async () => {
        while (i < delRemitente.length && procesadas < LOTE) {
            const adj = delRemitente[i++];
            const entrada = abierto.entradas.get(adj.archivo);
            const mime = mimeDeArchivo(adj.archivo);
            if (!entrada || !mime) continue;
            let contenido: Buffer;
            try {
                contenido = entrada.leer();
            } catch (err: any) {
                resultados.push({ archivo: adj.archivo, fecha: adj.fecha, decision: 'archivo_no_disponible', motivo: err?.message ?? 'archivo ilegible', monto: null, cobro: null });
                continue;
            }
            const r = await importarAdjunto({
                schoolId, integrationId: integracion.id as string, parentId, telefono,
                archivo: adj.archivo, fecha: adj.fecha, contenido, mime, log,
            });
            // Lo ya importado no gasta cupo del lote: no costó OCR.
            if (r.decision !== 'ya_importado') procesadas++;
            resultados.push(r);
        }
    };
    await Promise.all(Array.from({ length: CONCURRENCIA }, trabajador));

    return res.json({
        resultados,
        total: delRemitente.length,
        quedan: delRemitente.length - i,
    });
});

export default router;
