/**
 * D2 de docs/specs/fotos-de-planillas-y-autorregistro.md: el coach SUBE la hoja
 * de matrícula solo si la escuela lo activó (coach_can_upload_enrollment_forms).
 * Pedido de Dynasty, 2026-10-05. Revisar/aprobar sigue siendo solo de admin.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/supabase', () => ({ supabase: { from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock('../services/enrollment-ocr.service', () => ({ extractEnrollmentForm: vi.fn() }));

import { puedeSubirMatricula } from './enrollment-intake.routes';

describe('puedeSubirMatricula', () => {
    it('admin siempre, sin importar el flag', () => {
        for (const rol of ['owner', 'admin', 'super_admin', 'school_admin', 'school']) {
            expect(puedeSubirMatricula(rol, false)).toBe(true);
            expect(puedeSubirMatricula(rol, null)).toBe(true);
        }
    });

    it('coach solo con el flag en true', () => {
        expect(puedeSubirMatricula('coach', true)).toBe(true);
        expect(puedeSubirMatricula('coach', false)).toBe(false);
        expect(puedeSubirMatricula('coach', null)).toBe(false);
        expect(puedeSubirMatricula('coach', undefined)).toBe(false);
    });

    it('padres, atletas y sin rol: nunca', () => {
        expect(puedeSubirMatricula('parent', true)).toBe(false);
        expect(puedeSubirMatricula('athlete', true)).toBe(false);
        expect(puedeSubirMatricula(undefined, true)).toBe(false);
    });
});
