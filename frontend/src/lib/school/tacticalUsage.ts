/**
 * T0 pizarra táctica (docs/specs/pizarra-nivel-tacticalpad.md): métrica de uso.
 *
 * Registra un evento en `tactical_board_events` vía la RPC
 * `log_tactical_board_event` (mig 20261008155459). Es fire-and-forget: nunca
 * lanza, nunca bloquea la UI y se traga cualquier error. La RPC ya descarta lo
 * que no corresponde (no staff, evento desconocido, antirrebote de 10 s).
 */
import { supabase } from '@/integrations/supabase/client';

export const TACTICAL_BOARD_EVENTS = [
    'open',
    'save',
    'play',
    'export_png',
    'export_pdf',
    'export_video',
    'share',
    'library_save',
    'library_insert',
    'frame_add',
] as const;

export type TacticalBoardEvent = (typeof TACTICAL_BOARD_EVENTS)[number];

export interface TacticalEventInput {
    schoolId: string | null | undefined;
    event: TacticalBoardEvent;
    teamId?: string | null;
    /** Origen de la pizarra (p. ej. 'match_lineup', 'preset', 'session_block'). */
    sourceType?: string | null;
    /** Clave del catálogo de deportes del cliente (tacticalSports.ts). */
    sport?: string | null;
}

/** Dispara el registro y vuelve de inmediato. Nunca lanza. */
export function logTacticalEvent(input: TacticalEventInput): void {
    try {
        if (!input?.schoolId || !TACTICAL_BOARD_EVENTS.includes(input.event)) return;
        const pending = supabase.rpc('log_tactical_board_event' as never, {
            p_school_id: input.schoolId,
            p_event: input.event,
            p_team_id: input.teamId ?? null,
            p_source_type: input.sourceType ?? null,
            p_sport: input.sport ?? null,
        } as never) as unknown as PromiseLike<unknown>;
        // La respuesta ({ data, error }) no importa: es una métrica.
        Promise.resolve(pending).catch(() => undefined);
    } catch {
        // Métrica: jamás romper la pizarra por esto.
    }
}
