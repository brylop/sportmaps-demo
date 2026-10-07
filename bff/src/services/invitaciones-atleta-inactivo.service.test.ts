/**
 * Invitaciones de atleta dado de baja (services/invitaciones-atleta-inactivo).
 *
 * Caso real (Dynasty, 2026-10-06): Isabella Mancera Sarmiento quedó con
 * children.is_active=false e inscripción cancelada, pero su invitación de
 * acudiente seguía 'pending' y el reenvío masivo le volvía a escribir a la
 * mamá. Cero red: Supabase en memoria.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

type Fila = Record<string, any>;
const estado = vi.hoisted(() => ({ tablas: {} as Record<string, Fila[]>, consultas: 0 }));

vi.mock('../config/supabase', () => {
    function builder(tabla: string) {
        estado.consultas++;
        let filas: Fila[] = [...(estado.tablas[tabla] ?? [])];
        const api: any = {
            select: () => api,
            eq: (c: string, v: any) => { filas = filas.filter((f) => f[c] === v); return api; },
            in: (c: string, vs: any[]) => { filas = filas.filter((f) => vs.includes(f[c])); return api; },
            not: (c: string) => { filas = filas.filter((f) => f[c] != null); return api; },
            order: () => api,
            range: () => api,
            then: (ok: any, ko: any) => Promise.resolve({ data: filas, error: null }).then(ok, ko),
        };
        return api;
    }
    return { supabase: { from: (t: string) => builder(t) } };
});

import {
    idsInvitacionesDeAtletaInactivo, invitacionesDeAtletaInactivo, normalizarNombre,
} from './invitaciones-atleta-inactivo.service';

const ESCUELA = 'dynasty';

describe('invitacionesDeAtletaInactivo (pura)', () => {
    it('ficha vinculada por invitation_id: inactiva y sin reclamar → fuera; activa o reclamada → se invita', () => {
        const r = invitacionesDeAtletaInactivo([
            { id: 'i1', role_to_assign: 'parent', child_name: 'Ana' },
            { id: 'i2', role_to_assign: 'parent', child_name: 'Beto' },
            { id: 'i3', role_to_assign: 'parent', child_name: 'Caro' },
        ], {
            fichasPorInvitacion: [
                { invitation_id: 'i1', is_active: false, linked_profile_id: null },
                { invitation_id: 'i2', is_active: true, linked_profile_id: null },
                { invitation_id: 'i3', is_active: false, linked_profile_id: 'perfil' },
            ],
            // Un homónimo inactivo de Beto no pesa: manda la ficha vinculada.
            atletasDeLaEscuela: [{ full_name: 'Beto', is_active: false }],
        });
        expect([...r]).toEqual(['i1']);
    });

    it('por nombre: solo se excluye si hay coincidencia y ninguna activa', () => {
        const r = invitacionesDeAtletaInactivo([
            { id: 'isabella', role_to_assign: 'parent', child_name: '  ISABELLA  Mancera Sarmiento ' },
            { id: 'homonimo', role_to_assign: 'parent', child_name: 'Juan Pérez' },
            { id: 'sin-match', role_to_assign: 'parent', child_name: 'Nadie Conocido' },
            { id: 'sin-nombre', role_to_assign: 'parent', child_name: null },
            { id: 'null-activo', role_to_assign: 'athlete', child_name: 'Lina' },
            { id: 'atleta', role_to_assign: 'athlete', child_name: 'Pedro' },
        ], {
            fichasPorInvitacion: [],
            atletasDeLaEscuela: [
                { full_name: 'Isabella Mancera Sarmiento', is_active: false },
                { full_name: 'Juan Pérez', is_active: false },
                { full_name: 'juan pérez', is_active: true },
                { full_name: 'Lina', is_active: null },
                { full_name: 'Pedro', is_active: false },
            ],
        });
        expect([...r].sort()).toEqual(['atleta', 'isabella']);
    });

    it('las invitaciones de coach (child_name = nombre del coach) nunca se tocan', () => {
        const r = invitacionesDeAtletaInactivo(
            [{ id: 'c', role_to_assign: 'coach', child_name: 'Isabella Mancera Sarmiento' }],
            {
                fichasPorInvitacion: [{ invitation_id: 'c', is_active: false, linked_profile_id: null }],
                atletasDeLaEscuela: [{ full_name: 'Isabella Mancera Sarmiento', is_active: false }],
            },
        );
        expect(r.size).toBe(0);
    });

    it('normalizarNombre: minúsculas, trim y espacios colapsados', () => {
        expect(normalizarNombre('  ISABELLA   Mancera ')).toBe('isabella mancera');
        expect(normalizarNombre(null)).toBe('');
    });
});

describe('idsInvitacionesDeAtletaInactivo (con lecturas en lote)', () => {
    beforeEach(() => {
        estado.consultas = 0;
        estado.tablas = {
            unregistered_athletes: [
                { id: 'u1', school_id: ESCUELA, invitation_id: 'inv-ficha', full_name: 'Ficha Baja', is_active: false, linked_profile_id: null },
                { id: 'u2', school_id: ESCUELA, invitation_id: null, full_name: 'Tomás Activo', is_active: true, linked_profile_id: null },
            ],
            children: [
                { id: 'c-isa', school_id: ESCUELA, full_name: 'ISABELLA MANCERA SARMIENTO', is_active: false },
                // Inscrito en la escuela pero con school_id de otra: también cuenta.
                { id: 'c-otro', school_id: null, full_name: 'Mateo Fuera', is_active: false },
                // De otra escuela y sin inscripción acá: no cuenta.
                { id: 'c-ajeno', school_id: 'otra', full_name: 'Sofía Ajena', is_active: false },
                { id: 'c-tomas', school_id: ESCUELA, full_name: 'Tomás Activo', is_active: false },
            ],
            enrollments: [{ id: 'e1', school_id: ESCUELA, child_id: 'c-otro', status: 'cancelled' }],
        };
    });

    it('caso Dynasty: Isabella, la ficha inactiva y el inscrito inactivo quedan fuera; el resto sale', async () => {
        const invs = [
            { id: 'inv-isa', role_to_assign: 'parent', child_name: 'ISABELLA MANCERA SARMIENTO' },
            { id: 'inv-ficha', role_to_assign: 'parent', child_name: 'Otro Nombre' },
            { id: 'inv-mateo', role_to_assign: 'parent', child_name: 'Mateo Fuera' },
            { id: 'inv-sofia', role_to_assign: 'parent', child_name: 'Sofía Ajena' },
            // child inactivo + ficha activa homónima → se invita
            { id: 'inv-tomas', role_to_assign: 'parent', child_name: 'Tomás Activo' },
            { id: 'inv-coach', role_to_assign: 'coach', child_name: 'ISABELLA MANCERA SARMIENTO' },
        ];
        const r = await idsInvitacionesDeAtletaInactivo(ESCUELA, invs);
        expect([...r].sort()).toEqual(['inv-ficha', 'inv-isa', 'inv-mateo']);
        // En lote: fichas por invitación + children + enrollments + fichas de la escuela + children inscritos.
        expect(estado.consultas).toBe(5);
    });

    it('sin invitaciones de familia no consulta nada', async () => {
        const r = await idsInvitacionesDeAtletaInactivo(ESCUELA, [{ id: 'x', role_to_assign: 'coach', child_name: 'X' }]);
        expect(r.size).toBe(0);
        expect(estado.consultas).toBe(0);
    });
});
