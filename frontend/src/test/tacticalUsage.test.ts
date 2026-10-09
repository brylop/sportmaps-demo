/**
 * T0 pizarra táctica: logTacticalEvent es fire-and-forget. Nunca lanza, no
 * llama sin escuela y manda los parámetros con el nombre que espera la RPC.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
    supabase: { rpc: (...a: unknown[]) => rpc(...a) },
}));

import { logTacticalEvent } from '../lib/school/tacticalUsage';

describe('logTacticalEvent', () => {
    beforeEach(() => {
        rpc.mockReset();
    });

    it('llama a la RPC con los parámetros p_*', () => {
        rpc.mockResolvedValue({ data: true, error: null });
        logTacticalEvent({ schoolId: 's1', event: 'open', teamId: 't1', sourceType: 'match_lineup', sport: 'football11' });
        expect(rpc).toHaveBeenCalledWith('log_tactical_board_event', {
            p_school_id: 's1',
            p_event: 'open',
            p_team_id: 't1',
            p_source_type: 'match_lineup',
            p_sport: 'football11',
        });
    });

    it('opcionales ausentes van como null', () => {
        rpc.mockResolvedValue({ data: true, error: null });
        logTacticalEvent({ schoolId: 's1', event: 'save' });
        expect(rpc).toHaveBeenCalledWith('log_tactical_board_event', {
            p_school_id: 's1',
            p_event: 'save',
            p_team_id: null,
            p_source_type: null,
            p_sport: null,
        });
    });

    it('sin schoolId no llama', () => {
        logTacticalEvent({ schoolId: null, event: 'open' });
        logTacticalEvent({ schoolId: undefined, event: 'open' });
        logTacticalEvent({ schoolId: '', event: 'open' });
        expect(rpc).not.toHaveBeenCalled();
    });

    it('evento desconocido no llama', () => {
        logTacticalEvent({ schoolId: 's1', event: 'hack' as never });
        expect(rpc).not.toHaveBeenCalled();
    });

    it('devuelve de inmediato (no bloquea) aunque la RPC no resuelva', () => {
        rpc.mockReturnValue(new Promise(() => undefined));
        expect(logTacticalEvent({ schoolId: 's1', event: 'play' })).toBeUndefined();
    });

    it('no lanza si la RPC lanza en sincrónico', () => {
        rpc.mockImplementation(() => {
            throw new Error('boom');
        });
        expect(() => logTacticalEvent({ schoolId: 's1', event: 'share' })).not.toThrow();
    });

    it('se traga el rechazo de la promesa', async () => {
        const unhandled = vi.fn();
        process.on('unhandledRejection', unhandled);
        rpc.mockRejectedValue(new Error('red caída'));
        logTacticalEvent({ schoolId: 's1', event: 'export_png' });
        await new Promise((r) => setTimeout(r, 0));
        process.off('unhandledRejection', unhandled);
        expect(unhandled).not.toHaveBeenCalled();
    });

    it('se traga el { error } de supabase', async () => {
        rpc.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
        expect(() => logTacticalEvent({ schoolId: 's1', event: 'frame_add' })).not.toThrow();
        await new Promise((r) => setTimeout(r, 0));
    });
});
