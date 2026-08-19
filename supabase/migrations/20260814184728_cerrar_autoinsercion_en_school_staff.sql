-- =============================================================================
-- 20260814184728_cerrar_autoinsercion_en_school_staff.sql
-- Autor: brylop   Fecha: 2026-08-14   Versión anterior: 20260814184457
-- Objetivo: impedir que un usuario se inserte a sí mismo como staff de
--           CUALQUIER escuela de la plataforma.
--
-- ── El agujero ──────────────────────────────────────────────────────────────
-- La policy "Staff manage themselves" era:
--
--     FOR ALL  USING (email = auth.email())   -- sin WITH CHECK
--
-- En una policy FOR ALL, si se omite WITH CHECK, PostgreSQL usa la expresión de
-- USING también para validar lo que se inserta. Y esa expresión NO menciona
-- school_id.
--
-- Resultado: cualquier usuario autenticado podía hacer un INSERT en school_staff
-- con su propio correo y el school_id de una escuela ajena. Como user_school_ids()
-- tiene un fallback que resuelve staff por email (para coaches sin coach_auth_id),
-- ese INSERT le daba acceso de miembro a esa escuela y, con él, todo lo que las
-- ~44 policies que usan esa función permiten.
--
-- No es escalada dentro de la propia escuela como la de 20260814184457: es
-- entrar a la escuela de otro. Es el hallazgo más grave de la revisión.
--
-- Apareció al verificar el arreglo anterior: las policies son PERMISIVAS y se
-- suman con OR, así que endurecer cuatro no sirve de nada si queda una quinta
-- abierta sobre la misma tabla. La lección: al cerrar una tabla hay que mirar
-- TODAS sus policies, no solo la que se está tocando.
--
-- ── El arreglo ──────────────────────────────────────────────────────────────
-- La intención legítima de esta policy es que un entrenador pueda editar SU
-- ficha (teléfono, foto, datos personales). Eso no requiere INSERT ni DELETE.
--
--   · Se limita a UPDATE. La creación y el borrado de staff quedan solo para
--     administración, que ya tiene sus policies.
--   · Se agrega WITH CHECK con school_id = ANY(user_school_ids()): sin esto, un
--     coach real podría cambiar el school_id de su propia fila y mudarse a otra
--     escuela. Con esto solo puede quedarse donde ya pertenece.
--   · La lectura de la ficha propia no se toca: ya la cubre coach_read_own_record.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS "Staff manage themselves" ON public.school_staff;

CREATE POLICY "Staff manage themselves"
    ON public.school_staff
    FOR UPDATE
    TO authenticated
    USING      (email = auth.email())
    WITH CHECK (email = auth.email() AND school_id = ANY (public.user_school_ids()));

COMMIT;
