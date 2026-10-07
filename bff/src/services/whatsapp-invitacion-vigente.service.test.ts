/**
 * whatsapp-invitacion-vigente — el bot no ofrece `/register?invite=` a la
 * familia de un atleta inactivo.
 *
 * Caso real (Dynasty, 2026-10-06): invitación 28c7071d… 'pending' de
 * ISABELLA MANCERA SARMIENTO; la escuela la dio de baja (children.is_active =
 * false) y la invitación siguió viva.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
    rpc: { data: null as any, error: null as any },
    invitacion: { data: null as any, error: null as any },
    /** unregistered_athletes filtrado por invitation_id. */
    fichasPorInvitacion: [] as any[],
    /** children de la escuela que el ilike devuelve. */
    hijos: [] as any[],
    /** unregistered_athletes de la escuela que el ilike devuelve. */
    fichasPorNombre: [] as any[],
    errorHijos: null as any,
};

function chain(resolver: (filtros: Record<string, any>) => any) {
    const filtros: Record<string, any> = {};
    const c: any = {
        select: () => c,
        eq: (col: string, v: any) => { filtros[col] = v; return c; },
        ilike: (col: string, v: any) => { filtros[`ilike:${col}`] = v; return c; },
        maybeSingle: () => Promise.resolve(resolver(filtros)),
        then: (res: any, rej: any) => Promise.resolve(resolver(filtros)).then(res, rej),
    };
    return c;
}

const ilikes: string[] = [];

vi.mock('../config/supabase', () => ({
    supabase: {
        rpc: vi.fn(() => Promise.resolve(state.rpc)),
        from: vi.fn((table: string) => {
            if (table === 'invitations') return chain(() => state.invitacion);
            if (table === 'children') {
                return chain((f) => {
                    ilikes.push(f['ilike:full_name']);
                    return { data: state.hijos, error: state.errorHijos };
                });
            }
            if (table === 'unregistered_athletes') {
                return chain((f) => (f.invitation_id
                    ? { data: state.fichasPorInvitacion, error: null }
                    : { data: state.fichasPorNombre, error: null }));
            }
            return chain(() => ({ data: null, error: null }));
        }),
    },
}));

const { invitacionPendienteVigente, esInvitacionDeAtletaInactivo } = await import('./whatsapp-invitacion-vigente.service');

const INV = {
    id: '28c7071d-5341-40fc-98f6-954405fedc31', role_to_assign: 'parent',
    child_name: 'ISABELLA MANCERA SARMIENTO', school_id: 'school-1',
};

beforeEach(() => {
    vi.clearAllMocks();
    ilikes.length = 0;
    state.rpc = { data: { invite_id: INV.id, email: 'mama@x.com', child_name: INV.child_name }, error: null };
    state.invitacion = { data: INV, error: null };
    state.fichasPorInvitacion = [];
    state.hijos = [];
    state.fichasPorNombre = [];
    state.errorHijos = null;
});

describe('esInvitacionDeAtletaInactivo', () => {
    it('caso real: el único child con ese nombre está inactivo → inactiva', async () => {
        state.hijos = [{ full_name: 'ISABELLA MANCERA SARMIENTO', is_active: false }];
        expect(await esInvitacionDeAtletaInactivo('school-1', INV.id)).toBe(true);
    });

    it('nombre con mayúsculas y espacios distintos también cruza', async () => {
        state.hijos = [{ full_name: '  isabella  mancera sarmiento ', is_active: false }];
        expect(await esInvitacionDeAtletaInactivo('school-1', INV.id)).toBe(true);
    });

    it('un homónimo activo gana → no inactiva', async () => {
        state.hijos = [
            { full_name: 'ISABELLA MANCERA SARMIENTO', is_active: false },
            { full_name: 'Isabella Mancera Sarmiento', is_active: true },
        ];
        expect(await esInvitacionDeAtletaInactivo('school-1', INV.id)).toBe(false);
    });

    it('sin coincidencia por nombre → no inactiva', async () => {
        state.hijos = [{ full_name: 'ISABELLA MANCERA SARMIENTO PEREZ', is_active: false }];
        expect(await esInvitacionDeAtletaInactivo('school-1', INV.id)).toBe(false);
    });

    it('ficha vinculada por invitation_id inactiva → inactiva; activa → no', async () => {
        state.fichasPorInvitacion = [{ invitation_id: INV.id, is_active: false, linked_profile_id: null }];
        expect(await esInvitacionDeAtletaInactivo('school-1', INV.id)).toBe(true);
        state.fichasPorInvitacion = [{ invitation_id: INV.id, is_active: true, linked_profile_id: null }];
        state.hijos = [{ full_name: 'ISABELLA MANCERA SARMIENTO', is_active: false }];
        expect(await esInvitacionDeAtletaInactivo('school-1', INV.id)).toBe(false);
    });

    it('invitación de staff (coach) no se toca', async () => {
        state.invitacion = { data: { ...INV, role_to_assign: 'coach' }, error: null };
        state.hijos = [{ full_name: 'ISABELLA MANCERA SARMIENTO', is_active: false }];
        expect(await esInvitacionDeAtletaInactivo('school-1', INV.id)).toBe(false);
    });

    it('el patrón del ilike escapa comodines y une palabras con %', async () => {
        state.invitacion = { data: { ...INV, child_name: 'Ana_Maria  100%' }, error: null };
        await esInvitacionDeAtletaInactivo('school-1', INV.id);
        expect(ilikes[0]).toBe('Ana\\_Maria%100\\%');
    });
});

describe('invitacionPendienteVigente', () => {
    it('atleta inactivo → sin invitación, marcado', async () => {
        state.hijos = [{ full_name: 'ISABELLA MANCERA SARMIENTO', is_active: false }];
        expect(await invitacionPendienteVigente('int-1', '573166944827', 'school-1'))
            .toEqual({ invitacion: null, atletaInactivo: true });
    });

    it('atleta activo → la invitación tal cual', async () => {
        state.hijos = [{ full_name: 'ISABELLA MANCERA SARMIENTO', is_active: true }];
        const r = await invitacionPendienteVigente('int-1', '573166944827', 'school-1');
        expect(r.atletaInactivo).toBe(false);
        expect(r.invitacion?.invite_id).toBe(INV.id);
    });

    it('la RPC no encuentra invitación → null sin consultar nada más', async () => {
        state.rpc = { data: null, error: null };
        expect(await invitacionPendienteVigente('int-1', '573166944827', 'school-1'))
            .toEqual({ invitacion: null, atletaInactivo: false });
        expect(ilikes).toHaveLength(0);
    });

    it('si la verificación falla se ofrece igual (lo que ya filtra la RPC)', async () => {
        state.errorHijos = { message: 'timeout' };
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const r = await invitacionPendienteVigente('int-1', '573166944827', 'school-1');
        expect(r.invitacion?.invite_id).toBe(INV.id);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });
});
