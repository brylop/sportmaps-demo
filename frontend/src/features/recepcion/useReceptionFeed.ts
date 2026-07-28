// Modo Recepción (F-R) — feed en tiempo real.
//
// Realtime de Supabase filtra por user_id (el admin logueado). El filtro por
// SEDE se hace en cliente: data.school_id === schoolId (si viene). Transporte:
// Realtime (ya habilitado en F0). CERO push, CERO outbox.
//
// - Estado de conexión (verde/amarillo/rojo) desde el status del canal + onLine.
// - Catch-up al reconectar: consulta lo perdido desde el último created_at visto
//   y devuelve un resumen agregado (sin vocalizar cada evento).

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ReceptionNotification } from './config';

export type ConnStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

export interface CatchupSummary {
    total: number;
    byCategory: Record<string, number>;
    recaudo: number;
}

interface Params {
    userId: string | null | undefined;
    schoolId: string | null | undefined;
    enabled: boolean;
    onEvent: (n: ReceptionNotification) => void;
    onCatchup: (s: CatchupSummary) => void;
}

const SELECT = 'id, title, message, type, category, link, data, created_at';

/** ¿La notificación pertenece a la sede activa? (si no trae school_id, se acepta) */
function belongsToSchool(n: ReceptionNotification, schoolId: string): boolean {
    const sid = n.data?.school_id;
    return !sid || sid === schoolId;
}

export function useReceptionFeed({ userId, schoolId, enabled, onEvent, onCatchup }: Params) {
    const [status, setStatus] = useState<ConnStatus>('connecting');
    const lastSeenRef = useRef<string>(new Date().toISOString());
    const wasDisconnectedRef = useRef(false);
    const cbEvent = useRef(onEvent); cbEvent.current = onEvent;
    const cbCatchup = useRef(onCatchup); cbCatchup.current = onCatchup;

    const runCatchup = useCallback(async () => {
        if (!userId || !schoolId) return;
        const since = lastSeenRef.current;
        const { data, error } = await supabase
            .from('notifications')
            .select(SELECT)
            .eq('user_id', userId)
            .gt('created_at', since)
            .order('created_at', { ascending: true })
            .limit(200);
        if (error || !data || data.length === 0) return;

        const rows = (data as ReceptionNotification[]).filter((n) => belongsToSchool(n, schoolId));
        if (rows.length === 0) return;

        const summary: CatchupSummary = { total: rows.length, byCategory: {}, recaudo: 0 };
        for (const n of rows) {
            const cat = n.category || 'otros';
            summary.byCategory[cat] = (summary.byCategory[cat] || 0) + 1;
            if ((cat === 'payment' || cat === 'installment') && typeof n.data?.amount === 'number') {
                summary.recaudo += n.data.amount;
            }
        }
        lastSeenRef.current = rows[rows.length - 1].created_at;
        cbCatchup.current(summary);
    }, [userId, schoolId]);

    useEffect(() => {
        if (!enabled || !userId || !schoolId) return;

        const channel = supabase
            .channel(`recepcion-${userId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
                (payload) => {
                    const n = payload.new as ReceptionNotification;
                    lastSeenRef.current = n.created_at || lastSeenRef.current;
                    if (belongsToSchool(n, schoolId)) cbEvent.current(n);
                },
            )
            .subscribe((s) => {
                if (s === 'SUBSCRIBED') {
                    setStatus('live');
                    if (wasDisconnectedRef.current) {
                        wasDisconnectedRef.current = false;
                        runCatchup();
                    }
                } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
                    wasDisconnectedRef.current = true;
                    setStatus('reconnecting');
                } else if (s === 'CLOSED') {
                    wasDisconnectedRef.current = true;
                    setStatus('reconnecting');
                }
            });

        const onOnline = () => { wasDisconnectedRef.current = true; };
        const onOffline = () => setStatus('offline');
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);

        return () => {
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
            supabase.removeChannel(channel);
        };
    }, [enabled, userId, schoolId, runCatchup]);

    return { status };
}
