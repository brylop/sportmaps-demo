/**
 * Implementación real (Supabase service_role + API de Resend) de los puertos
 * que usa `procesarEventoResend`. Toda la lógica vive en banco-correo-cruce;
 * aquí solo hay lecturas, el INSERT del aviso y la RPC atómica del cruce.
 */

import { supabase } from '../config/supabase';
import type {
    AvisoGuardado,
    EstadoCruce,
    FilaAviso,
    FuenteCorreo,
    PagoCandidato,
    RepoAvisosBanco,
} from './banco-correo-cruce.service';

const ESTADOS_CRUZABLES = ['paid', 'pending', 'overdue', 'awaiting_approval'];
/** Tope del MIME que se descarga. Un aviso bancario pesa decenas de KB. */
const MAX_MIME_BYTES = 10 * 1024 * 1024;

export const repoAvisosSupabase: RepoAvisosBanco = {
    async buzonPorToken(token) {
        const { data, error } = await supabase
            .from('bank_email_inboxes').select('school_id, mailboxes')
            .eq('token', token).maybeSingle();
        if (error) throw new Error(`bank_email_inboxes: ${error.message}`);
        return data ? { schoolId: data.school_id as string, mailboxes: (data.mailboxes as string[]) ?? [] } : null;
    },

    async flagActivo(schoolId) {
        const { data, error } = await supabase
            .from('school_settings').select('bank_email_reconciliation_enabled')
            .eq('school_id', schoolId).maybeSingle();
        if (error) throw new Error(`school_settings: ${error.message}`);
        return data?.bank_email_reconciliation_enabled === true;
    },

    async avisoPorEntrega(resendEmailId) {
        const { data, error } = await supabase
            .from('bank_email_notices')
            .select('id, estado, banco, monto, fecha, hora, remitente, banco_origen, destino')
            .eq('resend_email_id', resendEmailId).maybeSingle();
        if (error) throw new Error(`bank_email_notices: ${error.message}`);
        return (data as AvisoGuardado | null) ?? null;
    },

    async insertarAviso(fila: FilaAviso) {
        const { data, error } = await supabase
            .from('bank_email_notices').insert(fila).select('id').single();
        if (error) {
            if (error.code === '23505') return 'duplicado';
            throw new Error(`insert bank_email_notices: ${error.message}`);
        }
        return { id: data.id as string };
    },

    async pagosCandidatos(schoolId, monto) {
        const m = Math.round(monto);
        const { data, error } = await supabase
            .from('payments')
            .select('id, status, amount, amount_paid, payment_date, ocr_date, due_date, reconciliation_status, ocr_destination, ocr_origin_name, parent_id')
            .eq('school_id', schoolId)
            .in('status', ESTADOS_CRUZABLES)
            .or(`amount.eq.${m},amount_paid.eq.${m}`)
            .limit(200);
        if (error) throw new Error(`payments: ${error.message}`);
        const pagos = data ?? [];
        if (pagos.length === 0) return [];

        const parentIds = [...new Set(pagos.map((p) => p.parent_id).filter(Boolean))] as string[];
        const nombres = new Map<string, string>();
        if (parentIds.length) {
            const { data: perfiles, error: e2 } = await supabase
                .from('profiles').select('id, full_name').in('id', parentIds);
            if (e2) throw new Error(`profiles: ${e2.message}`);
            for (const p of perfiles ?? []) if (p.full_name) nombres.set(p.id, p.full_name);
        }

        const { data: reclamados, error: e3 } = await supabase
            .from('bank_email_notices').select('matched_payment_id')
            .eq('estado', 'conciliado').in('matched_payment_id', pagos.map((p) => p.id));
        if (e3) throw new Error(`bank_email_notices: ${e3.message}`);
        const yaReclamados = new Set((reclamados ?? []).map((r) => r.matched_payment_id));

        return pagos.map((p): PagoCandidato => ({
            id: p.id,
            status: p.status,
            amount: Number(p.amount),
            amount_paid: p.amount_paid === null ? null : Number(p.amount_paid),
            payment_date: p.payment_date,
            ocr_date: p.ocr_date,
            due_date: p.due_date,
            reconciliation_status: p.reconciliation_status,
            ocr_destination: p.ocr_destination,
            ocr_origin_name: p.ocr_origin_name,
            nombre_pagador: p.parent_id ? nombres.get(p.parent_id) ?? null : null,
            ya_conciliado_por_aviso: yaReclamados.has(p.id),
        }));
    },

    async aplicarCruce(noticeId, estado: EstadoCruce | 'no_es_aviso', paymentId, detalle) {
        const { data, error } = await supabase.rpc('bank_email_notice_apply', {
            p_notice_id: noticeId,
            p_estado: estado,
            p_payment_id: paymentId,
            p_detalle: detalle,
        });
        if (error) throw new Error(`bank_email_notice_apply: ${error.message}`);
        return String(data);
    },
};

/**
 * MIME crudo desde Resend: el webhook NO trae el cuerpo. Se pide el correo con
 * GET /emails/receiving/{id} y se descarga `raw.download_url` (URL firmada y
 * con vencimiento). Requiere RESEND_INBOUND_API_KEY con permiso de lectura.
 */
export const fuenteResend: FuenteCorreo = {
    async mimeCrudo(emailId) {
        const key = process.env.RESEND_INBOUND_API_KEY;
        if (!key) throw new Error('RESEND_INBOUND_API_KEY no configurada');

        const meta = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
            headers: { Authorization: `Bearer ${key}` },
        });
        if (!meta.ok) throw new Error(`Resend receiving ${meta.status}`);
        const json = (await meta.json()) as { raw?: { download_url?: string } };
        const url = json.raw?.download_url;
        if (!url || !/^https:\/\//.test(url)) throw new Error('Resend no devolvió raw.download_url');

        const r = await fetch(url);
        if (!r.ok) throw new Error(`descarga MIME ${r.status}`);
        const largo = Number(r.headers.get('content-length') ?? 0);
        if (largo > MAX_MIME_BYTES) throw new Error('MIME demasiado grande');
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length > MAX_MIME_BYTES) throw new Error('MIME demasiado grande');
        return buf;
    },
};
