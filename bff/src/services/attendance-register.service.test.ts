/**
 * Caracterización de guardarSesionAsistencia (lógica extraída de POST /session).
 * Los helpers de crédito van simulados: lo que se prueba es la orquestación
 * (sesión → upsert → transición de crédito → avisos) y los parámetros nuevos
 * (finalized / descontarCreditos / notes / markedBy).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    inserts: [] as any[],
    rpcs: [] as any[],
    prev: [] as any[],
    staff: { id: 'staff-1' } as any,
    sesionExistente: null as any,
}));

vi.mock('../config/supabase', () => {
    const from = (tabla: string) => {
        let op = 'select';
        const api: any = {
            select: () => api, eq: () => api, order: () => api, match: () => api,
            insert: (p: any) => { op = 'insert'; h.inserts.push({ tabla, p }); return api; },
            maybeSingle: () => Promise.resolve({
                data: tabla === 'school_staff' ? h.staff : tabla === 'attendance_sessions' ? h.sesionExistente : null,
                error: null,
            }),
            single: () => Promise.resolve({ data: { id: 'sesion-nueva', finalized: false }, error: null }),
            then: (ok: any, ko: any) => Promise.resolve({
                data: tabla === 'attendance_records' && op === 'select' ? h.prev : null, error: null,
            }).then(ok, ko),
        };
        return api;
    };
    return { supabase: { from, rpc: (n: string, a: any) => { h.rpcs.push({ n, a }); return Promise.resolve({ data: 'rec', error: null }); } } };
});

const cred = vi.hoisted(() => ({
    findTeamSessionOfDay: vi.fn(),
    findCreditEnrollment: vi.fn(),
    loadCreditEnrollment: vi.fn(),
    avisarHitoDePlan: vi.fn(),
    moveCredit: vi.fn(),
    findFreeBookingOfDay: vi.fn(),
    consumeBooking: vi.fn(),
    releaseConsumedBooking: vi.fn(),
}));
vi.mock('./attendance-credits', () => ({
    athleteKey: (a: any) => a.childId ?? a.userId ?? a.unregisteredId ?? null,
    ...cred,
}));

import { guardarSesionAsistencia } from './attendance-register.service';

const base = { schoolId: 'esc', teamId: 'eq', date: '2026-10-22', markedBy: 'coach-auth' };

beforeEach(() => {
    h.inserts.length = 0; h.rpcs.length = 0; h.prev = []; h.sesionExistente = null;
    Object.values(cred).forEach((f) => f.mockReset());
    cred.findTeamSessionOfDay.mockResolvedValue({ kind: 'none' });
    cred.findFreeBookingOfDay.mockResolvedValue(null);
    cred.releaseConsumedBooking.mockResolvedValue(false);
});

describe('guardarSesionAsistencia', () => {
    it('crea la sesión, upsertea con marked_by y descuenta una clase al presente nuevo', async () => {
        cred.findCreditEnrollment.mockResolvedValue({ id: 'enr', sessions_used: 2, max_sessions: 8, secondary_sessions_used: 0, max_secondary_sessions: null, expires_at: null, plan_name: 'PRO' });
        cred.moveCredit.mockResolvedValue({ moved: true });
        const r = await guardarSesionAsistencia({ ...base, records: [{ childId: 'c1', status: 'present' }] });
        expect(r).toMatchObject({ ok: true, sessionId: 'sesion-nueva', sesionCreada: true, creditOutcomes: { c1: 'deducted' } });
        expect(h.inserts[0].p).toMatchObject({ team_id: 'eq', session_date: '2026-10-22', created_by: 'coach-auth', coach_id: 'staff-1' });
        expect(h.inserts[0].p.finalized).toBeUndefined();
        expect(h.rpcs[0].a).toMatchObject({ p_status: 'present', p_marked_by: 'coach-auth', p_child_id: 'c1', p_team_id: 'eq' });
        expect(cred.moveCredit).toHaveBeenCalledWith('enr', 1, false);
    });

    it('avisa "ultima" cuando la clase consumida era la última del plan', async () => {
        cred.findCreditEnrollment.mockResolvedValue({ id: 'enr', sessions_used: 7, max_sessions: 8, secondary_sessions_used: 0, max_secondary_sessions: null, expires_at: null, plan_name: 'PRO' });
        cred.moveCredit.mockResolvedValue({ moved: true });
        await guardarSesionAsistencia({ ...base, records: [{ childId: 'c1', status: 'present' }] });
        expect(cred.avisarHitoDePlan).toHaveBeenCalledWith('esc', expect.anything(), 'ultima', expect.objectContaining({ usadas: 8 }));
    });

    it('plan agotado: registra igual y marca no_credits + aviso excedida', async () => {
        cred.findCreditEnrollment.mockResolvedValue({ id: 'enr', sessions_used: 8, max_sessions: 8, secondary_sessions_used: 0, max_secondary_sessions: null, expires_at: null, plan_name: 'PRO' });
        const r: any = await guardarSesionAsistencia({ ...base, records: [{ childId: 'c1', status: 'present' }] });
        expect(r.creditOutcomes.c1).toBe('no_credits');
        expect(h.rpcs).toHaveLength(1);
        expect(cred.moveCredit).not.toHaveBeenCalled();
        expect(cred.avisarHitoDePlan).toHaveBeenCalledWith('esc', expect.anything(), 'excedida', expect.anything());
    });

    it('corrección presente→ausente devuelve el crédito; sin cambio no toca nada', async () => {
        h.sesionExistente = { id: 's1', finalized: false, team_id: 'eq', offering_id: null };
        h.prev = [{ child_id: 'c1', status: 'present' }, { child_id: 'c2', status: 'present' }];
        cred.loadCreditEnrollment.mockResolvedValue(null);
        cred.findCreditEnrollment.mockResolvedValue({ id: 'enr', sessions_used: 3, max_sessions: 8, secondary_sessions_used: 0, max_secondary_sessions: null, expires_at: null, plan_name: 'PRO' });
        cred.moveCredit.mockResolvedValue({ moved: true });
        const r: any = await guardarSesionAsistencia({
            ...base, sessionId: 's1',
            records: [{ childId: 'c1', status: 'absent' }, { childId: 'c2', status: 'present' }],
        });
        expect(r.creditOutcomes).toEqual({ c1: 'returned' });
        expect(cred.moveCredit).toHaveBeenCalledTimes(1);
        expect(cred.moveCredit).toHaveBeenCalledWith('enr', -1, false);
    });

    it('sesión existente finalizada → 409 sin escribir', async () => {
        h.sesionExistente = { id: 's1', finalized: true, team_id: 'eq', offering_id: null };
        const r: any = await guardarSesionAsistencia({ ...base, sessionId: 's1', records: [{ childId: 'c1', status: 'present' }] });
        expect(r).toMatchObject({ ok: false, status: 409, body: { finalized: true } });
        expect(h.rpcs).toHaveLength(0);
    });

    it('sesión del día ya cerrada: mensaje distinto si es retroactiva', async () => {
        cred.findTeamSessionOfDay.mockResolvedValue({ kind: 'one', session: { id: 's9', finalized: true } });
        const hoy: any = await guardarSesionAsistencia({ ...base, records: [{ childId: 'c1', status: 'present' }] });
        const retro: any = await guardarSesionAsistencia({ ...base, esRetroactiva: true, records: [{ childId: 'c1', status: 'present' }] });
        expect(hoy.body.error).toBe('La sesión de hoy ya fue finalizada.');
        expect(retro.body.error).toContain('reabrir');
        expect(retro.body).toMatchObject({ reason: 'session_finalized', sessionId: 's9' });
    });

    it('varios bloques el mismo día → 409 multiple_sessions_today', async () => {
        cred.findTeamSessionOfDay.mockResolvedValue({ kind: 'many', sessions: [{ id: 'a' }, { id: 'b' }] });
        const r: any = await guardarSesionAsistencia({ ...base, records: [{ childId: 'c1', status: 'present' }] });
        expect(r).toMatchObject({ ok: false, status: 409, body: { reason: 'multiple_sessions_today' } });
    });

    it('autorizarSesionExistente puede denegar con su propio status', async () => {
        h.sesionExistente = { id: 's1', finalized: false, team_id: 'otro', offering_id: null };
        const r: any = await guardarSesionAsistencia({
            ...base, sessionId: 's1', records: [{ childId: 'c1', status: 'present' }],
            autorizarSesionExistente: async () => ({ status: 403, body: { reason: 'not_your_team' } }),
        });
        expect(r).toMatchObject({ ok: false, status: 403, body: { reason: 'not_your_team' } });
        expect(h.rpcs).toHaveLength(0);
    });

    it('finalized=true: sesión nueva entra cerrada, con notas de origen, y NO descuenta ni avisa', async () => {
        const r: any = await guardarSesionAsistencia({
            ...base, finalized: true, notes: 'whatsapp_foto',
            records: [{ childId: 'c1', status: 'present' }],
        });
        expect(r.ok).toBe(true);
        expect(r.creditOutcomes).toEqual({});
        expect(h.inserts[0].p).toMatchObject({ finalized: true, finalized_by: 'coach-auth', coach_notes: 'whatsapp_foto' });
        expect(h.inserts[0].p.finalized_at).toBeTruthy();
        expect(cred.findCreditEnrollment).not.toHaveBeenCalled();
        expect(cred.moveCredit).not.toHaveBeenCalled();
        expect(cred.avisarHitoDePlan).not.toHaveBeenCalled();
    });

    it('sin plan (equipo puro) → no_plan', async () => {
        cred.findCreditEnrollment.mockResolvedValue(null);
        const r: any = await guardarSesionAsistencia({ ...base, records: [{ childId: 'c1', status: 'present' }] });
        expect(r.creditOutcomes.c1).toBe('no_plan');
    });
});
