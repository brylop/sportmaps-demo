-- ============================================================================
-- booking_holds — v2. SUPERSEDE a 20260817133556, que NO se debe correr.
--
-- Fecha: 2026-08-17
--
-- ── Por qué hay una v2 ──────────────────────────────────────────────────────
-- La v1 abortó con:
--
--     ERROR 42883: operator does not exist: uuid = uuid[]
--
-- El error estaba en la policy del staff. Se había escrito:
--
--     sa.school_id = ANY ((SELECT public.user_staff_school_ids()))
--
-- `user_staff_school_ids()` devuelve **uuid[]**, y la intención era la forma
-- `= ANY (arreglo)`. Pero cuando lo que sigue a `ANY (` es un `SELECT`,
-- PostgreSQL lo parsea como `= ANY (subconsulta)`: compara el uuid contra cada
-- FILA devuelta, y cada fila acá es un uuid[] completo. De ahí `uuid = uuid[]`.
-- El paréntesis extra no cambia el parseo — sigue siendo un SELECT pelado.
--
-- La forma que se usa acá evita la ambigüedad del parseo en vez de pelearse con
-- ella:
--
--     sa.school_id IN (SELECT unnest(public.user_staff_school_ids()))
--
-- `unnest` convierte el arreglo en filas, así que la subconsulta devuelve uuid y
-- la comparación es uuid = uuid. Y al no estar correlada, el planificador la
-- resuelve UNA vez (SubPlan hasheado) y no una por fila — que era lo que se
-- buscaba con el `(SELECT …)`, por el patrón de lentitud de agosto con los
-- helpers STABLE pelados dentro del USING.
--
-- Un `= ANY ((SELECT …)::uuid[])` también funciona, pero depende de que el cast
-- fuerce el parseo a la forma de arreglo. No vale la pena apostar a eso en una
-- policy.
--
-- La v1 iba en BEGIN/COMMIT, así que el rollback la dejó sin efecto: no quedó
-- ni la tabla ni las policies a medias. Se verifica igual acá abajo.
--
-- ── Qué restaura (contexto completo) ────────────────────────────────────────
-- `booking_holds` la define `20260311000001_athlete_module_v2.sql` §4, pero no
-- vive en la base — sí viven `bookings`, `athlete_payments` y
-- `school_availability` de esa misma migración. Es `INF-1` (deriva de esquema).
--
-- El síntoma: `SlotPicker` inserta un hold al elegir horario y hace
-- `if (error) throw`, así que el atleta veía «No se pudo reservar el horario.
-- Intenta de nuevo.» SIEMPRE. Nunca pudo elegir un horario.
--
-- ── Dos correcciones sobre el original de marzo ─────────────────────────────
-- 1. La policy era `FOR ALL USING (athlete_id = auth.uid())` **sin WITH CHECK**.
--    Es el invariante I3 de CLAUDE.md: sin WITH CHECK, PostgreSQL valida los
--    INSERT con la expresión de USING. Acá el resultado sería equivalente, pero
--    `npm run seguridad:invariantes` lo marca como violación y con razón.
-- 2. El staff no podía ver los holds de sus propios horarios, así que nadie
--    podía diagnosticar un cupo trabado. Se agrega un SELECT con
--    `user_staff_school_ids()` y NO con `user_school_ids()`, que incluye padres
--    y atletas (invariante I2).
--
-- ── Lo que NO se agrega, a propósito ────────────────────────────────────────
-- Ningún UNIQUE sobre (availability_slot_id, scheduled_date):
-- `school_availability.max_capacity` puede ser > 1, así que varios holds sobre
-- el mismo horario son legítimos. Un UNIQUE ahí volvería cupo único a todos.
--
-- Tampoco un cron de limpieza: `expires_at` ya se filtra en la consulta
-- (`.gt('expires_at', now)`), así que un hold vencido no estorba.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.booking_holds (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    athlete_id           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    availability_slot_id uuid NOT NULL REFERENCES public.school_availability(id) ON DELETE CASCADE,
    scheduled_date       date NOT NULL,
    expires_at           timestamptz NOT NULL DEFAULT (now() + INTERVAL '10 minutes'),
    created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_holds ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_booking_holds_expires
    ON public.booking_holds (expires_at);
CREATE INDEX IF NOT EXISTS idx_booking_holds_slot_fecha
    ON public.booking_holds (availability_slot_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_booking_holds_athlete
    ON public.booking_holds (athlete_id);

-- ── Policies ────────────────────────────────────────────────────────────────
-- El atleta administra los suyos. USING y WITH CHECK explícitos y separados.
DROP POLICY IF EXISTS athlete_own_holds            ON public.booking_holds;
DROP POLICY IF EXISTS booking_holds_atleta_propios ON public.booking_holds;
CREATE POLICY booking_holds_atleta_propios ON public.booking_holds
    FOR ALL
    USING      (athlete_id = (SELECT auth.uid()))
    WITH CHECK (athlete_id = (SELECT auth.uid()));

-- El staff de la escuela ve los holds de sus horarios. Solo lectura.
DROP POLICY IF EXISTS booking_holds_staff_lectura ON public.booking_holds;
CREATE POLICY booking_holds_staff_lectura ON public.booking_holds
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
              FROM public.school_availability sa
             WHERE sa.id = booking_holds.availability_slot_id
               -- `IN (SELECT unnest(...))` y no `= ANY (...)`: el helper devuelve
               -- uuid[], y `ANY (` seguido de un SELECT se parsea como subconsulta
               -- —compara uuid contra uuid[], que es lo que abortó la v1—. Con
               -- unnest la subconsulta devuelve filas uuid, sin ambigüedad de
               -- parseo, y al no estar correlada el planificador la resuelve una
               -- sola vez (SubPlan hasheado) en vez de una por fila.
               AND sa.school_id IN (SELECT unnest(public.user_staff_school_ids()))
        )
    );

COMMENT ON TABLE public.booking_holds IS
    'Reserva temporal de un cupo mientras el atleta completa el flujo (10 min por defecto). '
    'La define 20260311000001 §4, que quedó sin aplicar: SlotPicker fallaba siempre al elegir '
    'horario. Sin UNIQUE sobre (slot, fecha) a propósito: max_capacity puede ser > 1.';

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ────────────────────────────────────────────────────────────────────────────
-- Verificación
-- ────────────────────────────────────────────────────────────────────────────

-- 1. La tabla existe, con RLS activo y sin filas.
SELECT c.relname,
       c.relrowsecurity AS rls_activo,
       (SELECT count(*) FROM public.booking_holds) AS filas
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relname = 'booking_holds';

-- 2. Las dos policies, y que la del atleta traiga WITH CHECK (invariante I3).
SELECT policyname,
       cmd,
       roles,
       qual        AS using_expr,
       with_check
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'booking_holds'
 ORDER BY policyname;

-- 3. La comparación que abortó la v1, ahora resuelta: no debe dar error.
--    Con un uuid al azar el resultado es falso; lo que se prueba es que el
--    operador exista, no que coincida.
SELECT gen_random_uuid() IN (SELECT unnest(public.user_staff_school_ids())) AS operador_ok;
