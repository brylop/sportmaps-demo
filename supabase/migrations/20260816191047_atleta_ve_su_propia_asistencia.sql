-- =============================================================================
-- 20260816191047_atleta_ve_su_propia_asistencia.sql
-- Autor: brylop   Fecha: 2026-08-16   Versión anterior: 20260816184104
-- Objetivo: que el atleta adulto pueda ver su propia asistencia.
--
-- ── El hallazgo ─────────────────────────────────────────────────────────────
-- `attendance_records` tenía policies de SELECT para tres actores:
--
--   attendance_records_admin_all                  → is_school_admin(school_id)
--   Coaches can view attendance for their teams   → por team_id
--   Parents can view attendance of their children → child_id vía children.parent_id
--
-- Falta el dueño del dato. El atleta ADULTO se registra en `user_id`, no en
-- `child_id`, así que ninguna de las tres lo alcanza: no tiene forma de ver su
-- propia asistencia. Hoy son 18 marcas, pero crece con cada gimnasio y cada
-- entrenador personal, donde el atleta es adulto por definición.
--
-- Estuvo tapado porque las pantallas del padre leían la tabla legacy
-- `attendance` (0 filas) y nunca llegaron a ejercer esta RLS. Salió al
-- apuntarlas a `attendance_records`.
--
-- ── Por qué (SELECT auth.uid()) y no auth.uid() pelado ──────────────────────
-- `auth.uid()` es STABLE: puesto pelado en el USING, PostgreSQL lo evalúa UNA
-- VEZ POR FILA. Envuelto en un subselect se evalúa una sola vez y el plan lo
-- trata como constante. Es la misma lentitud que ya está medida en el resto de
-- las policies del esquema; no vamos a agregar una más.
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

DROP POLICY IF EXISTS atleta_ve_su_propia_asistencia ON public.attendance_records;

CREATE POLICY atleta_ve_su_propia_asistencia
    ON public.attendance_records
    FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

COMMENT ON POLICY atleta_ve_su_propia_asistencia ON public.attendance_records IS
    'El atleta adulto se guarda en user_id, no en child_id: las policies de '
    'admin, coach y padre no lo alcanzaban y no podia ver su propia '
    'asistencia. Solo lectura de sus propias filas — registrar y corregir '
    'sigue siendo del coach y la administracion.';

COMMIT;
