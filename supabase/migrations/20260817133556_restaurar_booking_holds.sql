-- ============================================================================
-- booking_holds: la tabla que el código usa y la base no tiene
--
-- Fecha: 2026-08-17
-- Restaura lo que define `20260311000001_athlete_module_v2.sql` §4.
--
-- ── Lo que está roto hoy ────────────────────────────────────────────────────
-- `SlotPicker` inserta un hold al elegir horario y hace `if (error) throw`, así
-- que el catch muestra «No se pudo reservar el horario. Intenta de nuevo.»
-- **siempre**: el atleta nunca logra elegir un horario. Y la lectura de holds
-- devuelve error, así que ningún cupo se muestra como tomado por otro.
--
-- ── Por qué falta ───────────────────────────────────────────────────────────
-- No es diseño nuevo: la tabla ya está escrita en la migración de marzo. Lo que
-- pasa es que de esa migración sí viven `bookings`, `athlete_payments` y
-- `school_availability`, y `booking_holds` no — o se aplicó a medias, o se borró
-- después. Es `INF-1` (deriva de esquema sin versionar) mordiendo.
--
-- ── Dos cosas que se corrigen respecto del original ─────────────────────────
-- 1. La policy era `FOR ALL USING (athlete_id = auth.uid())` **sin WITH CHECK**.
--    Es el invariante I3 de CLAUDE.md: PostgreSQL valida los INSERT con la
--    expresión de USING cuando falta WITH CHECK. Acá el resultado habría sido
--    equivalente, pero `npm run seguridad:invariantes` lo marca como violación y
--    con razón — se escribe explícito.
-- 2. La escuela no podía ver los holds de sus propios horarios, así que nadie
--    del staff podía diagnosticar un cupo trabado. Se agrega un SELECT para
--    quien trabaja en la escuela, con `user_staff_school_ids()` y NO con
--    `user_school_ids()`: esa última incluye padres y atletas (invariante I2).
--
-- ── Lo que NO se agrega, a propósito ────────────────────────────────────────
-- Ninguna restricción de unicidad sobre (availability_slot_id, scheduled_date):
-- `school_availability.max_capacity` puede ser mayor que 1, así que varios holds
-- simultáneos sobre el mismo horario son legítimos. Un UNIQUE ahí convertiría
-- todos los horarios en cupo único.
--
-- Tampoco un cron de limpieza: `expires_at` ya se filtra en la consulta
-- (`.gt('expires_at', now)`), así que un hold vencido no estorba. Si la tabla
-- crece, se agrega después con datos a la vista.
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

-- Índices: el original traía el de expires_at. Se suma el de (slot, fecha),
-- que es exactamente por donde consulta SlotPicker.
CREATE INDEX IF NOT EXISTS idx_booking_holds_expires
    ON public.booking_holds (expires_at);
CREATE INDEX IF NOT EXISTS idx_booking_holds_slot_fecha
    ON public.booking_holds (availability_slot_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_booking_holds_athlete
    ON public.booking_holds (athlete_id);

-- ── Policies ────────────────────────────────────────────────────────────────
-- El atleta administra los suyos. USING y WITH CHECK explícitos y separados:
-- sin WITH CHECK, el INSERT se valida con el USING (invariante I3).
DROP POLICY IF EXISTS athlete_own_holds ON public.booking_holds;
CREATE POLICY booking_holds_atleta_propios ON public.booking_holds
    FOR ALL
    USING      (athlete_id = (SELECT auth.uid()))
    WITH CHECK (athlete_id = (SELECT auth.uid()));

-- El staff de la escuela ve los holds de sus horarios, para poder diagnosticar
-- un cupo trabado. Solo lectura, y con `user_staff_school_ids()` — no
-- `user_school_ids()`, que incluye padres y atletas (invariante I2).
CREATE POLICY booking_holds_staff_lectura ON public.booking_holds
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
              FROM public.school_availability sa
             WHERE sa.id = booking_holds.availability_slot_id
               -- `user_staff_school_ids()` devuelve uuid[], no un conjunto: va como
               -- ANY(array). Y envuelto en (SELECT …) para que se evalúe UNA vez
               -- por consulta y no una por fila — el patrón de lentitud del
               -- 2026-08 con los helpers STABLE pelados.
               AND sa.school_id = ANY ((SELECT public.user_staff_school_ids()))
        )
    );

COMMENT ON TABLE public.booking_holds IS
    'Reserva temporal de un cupo mientras el atleta completa el flujo (10 min por defecto). '
    'La define 20260311000001 §4, que quedó sin aplicar: SlotPicker fallaba siempre al elegir '
    'horario. Sin UNIQUE sobre (slot, fecha) a propósito: max_capacity puede ser > 1.';

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ────────────────────────────────────────────────────────────────────────────
-- Verificación: la tabla existe, tiene RLS y las dos policies traen WITH CHECK
-- donde corresponde.
-- ────────────────────────────────────────────────────────────────────────────
SELECT c.relname, c.relrowsecurity AS rls_activo
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relname = 'booking_holds';

SELECT policyname, cmd, roles, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'booking_holds'
 ORDER BY policyname;
