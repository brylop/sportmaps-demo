-- =============================================================================
-- 20260821125525_dreamers_hour_bank_schema.sql
-- Autor: judegor99   Fecha: 2026-08-21   Versión anterior: 20260821112428
-- Objetivo: F1 de docs/specs/dreamers-banco-de-horas-torniquete.md — solo
-- esquema (columnas de config + 3 tablas nuevas + RLS de solo-lectura). SIN
-- lógica de negocio todavía: nadie escribe estas tablas hasta F2 (RPC atómica
-- move_hour_bank, SECURITY DEFINER + FOR UPDATE) y nadie las lee hasta F3-F6
-- (torniquete, reservas, frontend). `school_settings.hours_plan_enabled`
-- queda en `false` para TODAS las escuelas — activar el banco de horas para
-- Dreamers es un paso manual posterior, después de F2-F5.
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

-- =============================================================================
-- 1. school_settings — configuración del banco de horas (D-9, D-14)
-- =============================================================================

ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS hours_plan_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hours_session_block_minutes integer NOT NULL DEFAULT 120,
  ADD COLUMN IF NOT EXISTS hours_entry_grace_minutes integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS hours_exit_grace_minutes integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS hours_reentry_merge_minutes integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS hours_closing_time time NOT NULL DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS hours_max_visit_minutes integer NOT NULL DEFAULT 360;

COMMENT ON COLUMN public.school_settings.hours_plan_enabled IS
  'Feature flag del banco de horas por torniquete (docs/specs/dreamers-banco-de-horas-torniquete.md). '
  'false para todas las escuelas hasta activarlo a mano tras F2-F5. NO activar en Dreamers sin '
  'confirmar antes hours_closing_time real con la escuela (D-14 es un valor provisional).';
COMMENT ON COLUMN public.school_settings.hours_session_block_minutes IS
  'Duración del bloque fijo de reserva (D-4). No es un tope de visita real — el torniquete puede '
  'medir más o menos, ver hour_bank_visits.billed_minutes.';
COMMENT ON COLUMN public.school_settings.hours_entry_grace_minutes IS
  'Minutos de tolerancia antes de que el reloj de una visita cuente en firme (cambiarse, etc).';
COMMENT ON COLUMN public.school_settings.hours_exit_grace_minutes IS
  'Minutos de tolerancia de recogida tarde antes de que el excedente cuente contra el banco.';
COMMENT ON COLUMN public.school_settings.hours_reentry_merge_minutes IS
  'Ventana para fusionar una salida + reentrada corta en la misma hour_bank_visit (D-6/D-11: '
  'sale al baño y vuelve, cada evento se sigue viendo por separado en hour_bank_visit_segments).';
COMMENT ON COLUMN public.school_settings.hours_closing_time IS
  'Corte diario (hora local de la escuela) para el auto-cierre de visitas abiertas (D-7). '
  'Asume un horario único por sede — si hace falta variar por día de la semana, requiere '
  'modelo aparte (anotado como riesgo abierto en el spec).';
COMMENT ON COLUMN public.school_settings.hours_max_visit_minutes IS
  'Tope de seguridad absoluto (D-7): si una visita sigue abierta más de esto (falla del cron de '
  'cierre por horario, o cruce de medianoche), se fuerza a pending_review de todos modos.';

-- =============================================================================
-- 2. offering_plans — un plan puede ser "por horas" en vez de "por sesiones"
-- =============================================================================

ALTER TABLE public.offering_plans
  ADD COLUMN IF NOT EXISTS included_minutes_per_period integer;

COMMENT ON COLUMN public.offering_plans.included_minutes_per_period IS
  'Si no es NULL, el plan se mide en minutos incluidos por período (banco de horas, D-1) en vez '
  'de max_sessions. Coexiste con max_sessions sin usarlo — no son excluyentes a nivel de esquema, '
  'pero un plan de Dreamers usa uno u otro, nunca los dos a la vez (regla de negocio, no CHECK).';

-- =============================================================================
-- 3. hour_bank_periods — la ventana del período (mes calendario o rolling_30,
--    según school_settings.billing_cycle_type existente — D-12)
-- =============================================================================

CREATE TABLE public.hour_bank_periods (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id     uuid NOT NULL REFERENCES public.enrollments(id),
  school_id         uuid NOT NULL REFERENCES public.schools(id),
  period_start      date NOT NULL,
  period_end        date NOT NULL,
  included_minutes  integer NOT NULL,
  reserved_minutes  integer NOT NULL DEFAULT 0,
  consumed_minutes  integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hour_bank_periods_window_valid CHECK (period_end > period_start),
  CONSTRAINT hour_bank_periods_reserved_non_negative CHECK (reserved_minutes >= 0),
  CONSTRAINT hour_bank_periods_consumed_non_negative CHECK (consumed_minutes >= 0),
  CONSTRAINT hour_bank_periods_unique_window UNIQUE (enrollment_id, period_start)
);

COMMENT ON TABLE public.hour_bank_periods IS
  'Ventana mensual del banco de horas de una inscripción. Un solo escritor: la RPC move_hour_bank '
  '(F2, SECURITY DEFINER + FOR UPDATE) — nada más debe hacer UPDATE directo de reserved_minutes/ '
  'consumed_minutes, mismo patrón que move_session_credit. Reinicio sin arrastre (D-5): las horas '
  'no usadas al cerrar period_end simplemente no se copian al período siguiente.';
COMMENT ON COLUMN public.hour_bank_periods.included_minutes IS
  'Copiado de offering_plans.included_minutes_per_period al abrir el período — un cambio de plan '
  'a mitad de mes no debe alterar retroactivamente períodos ya abiertos.';
COMMENT ON COLUMN public.hour_bank_periods.reserved_minutes IS
  'Suma de reservas activas de este período (D-2: la reserva es techo de validación, no descuento '
  'en firme). Baja cuando la reserva se cumple (la visita real la consume) o se cancela.';
COMMENT ON COLUMN public.hour_bank_periods.consumed_minutes IS
  'Suma de minutos REALES de hour_bank_visits cerradas (D-3: el torniquete manda, no lo reservado). '
  'Puede superar included_minutes - reserved_minutes (D-10: no hay bloqueo automático de excedente, '
  'solo notificación) — no poner un CHECK que lo impida, sería falso a la realidad medida.';

CREATE INDEX hour_bank_periods_enrollment_idx ON public.hour_bank_periods (enrollment_id);
CREATE INDEX hour_bank_periods_school_window_idx ON public.hour_bank_periods (school_id, period_start);

-- =============================================================================
-- 4. hour_bank_visits — la visita facturable (entrada→salida, con reentradas
--    cortas fusionadas por hours_reentry_merge_minutes — D-6/D-11)
-- =============================================================================

CREATE TABLE public.hour_bank_visits (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id          uuid NOT NULL REFERENCES public.schools(id),
  enrollment_id      uuid NOT NULL REFERENCES public.enrollments(id),
  period_id          uuid REFERENCES public.hour_bank_periods(id),
  status             text NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'closed', 'pending_review', 'corrected')),
  started_at         timestamptz NOT NULL,
  ended_at           timestamptz,
  billed_minutes     integer,
  auto_closed        boolean NOT NULL DEFAULT false,
  corrected_by       uuid REFERENCES public.profiles(id),
  corrected_at       timestamptz,
  correction_reason  text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hour_bank_visits_billed_non_negative CHECK (billed_minutes IS NULL OR billed_minutes >= 0),
  CONSTRAINT hour_bank_visits_ended_after_started CHECK (ended_at IS NULL OR ended_at >= started_at)
);

COMMENT ON TABLE public.hour_bank_visits IS
  'Una visita = una estancia continua dentro de la sede para efectos de descuento, aunque tenga '
  'varios segmentos de entrada/salida fusionados (ver hour_bank_visit_segments). status: open '
  '(dentro, sin cerrar) → closed (cerrada normal, billed_minutes en firme, ya impactó '
  'hour_bank_periods.consumed_minutes) o pending_review (D-7: el cron de auto-cierre la cortó por '
  'hours_closing_time / hours_max_visit_minutes SIN descontar todavía) → corrected (D-8: el owner '
  'ajustó ended_at, recién ahí se descuenta). Solo owner puede pasar pending_review → corrected.';
COMMENT ON COLUMN public.hour_bank_visits.billed_minutes IS
  'NULL mientras open o pending_review. Se fija al cerrar (con gracia de entrada/salida aplicada) '
  'y es lo único que mueve hour_bank_periods.consumed_minutes — la RPC de cierre (F2) es el único '
  'escritor.';
COMMENT ON COLUMN public.hour_bank_visits.corrected_by IS
  'D-8: solo el owner de la escuela puede corregir una visita pending_review. La RPC de corrección '
  '(F5) valida el rol, esta columna es el rastro de auditoría, no el control de acceso en sí.';

CREATE INDEX hour_bank_visits_enrollment_idx ON public.hour_bank_visits (enrollment_id);
CREATE INDEX hour_bank_visits_school_status_idx ON public.hour_bank_visits (school_id, status);
CREATE INDEX hour_bank_visits_period_idx ON public.hour_bank_visits (period_id);

-- A lo sumo una visita abierta por inscripción — guardarraíl a nivel de base
-- además del FOR UPDATE que traerá la RPC de F2/F3 (mismo espíritu que el
-- UNIQUE de session_bookings contra doble reserva activa).
CREATE UNIQUE INDEX hour_bank_visits_one_open_per_enrollment
  ON public.hour_bank_visits (enrollment_id)
  WHERE status = 'open';

-- =============================================================================
-- 5. hour_bank_visit_segments — cada entrada/salida real (auditoría, D-6/D-11:
--    "siempre mostrando entrada y salida" aunque se fusionen para facturar)
-- =============================================================================

CREATE TABLE public.hour_bank_visit_segments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id        uuid NOT NULL REFERENCES public.hour_bank_visits(id) ON DELETE CASCADE,
  school_id       uuid NOT NULL REFERENCES public.schools(id),
  enrollment_id   uuid NOT NULL REFERENCES public.enrollments(id),
  entry_event_id  uuid REFERENCES public.access_events(id),
  exit_event_id   uuid REFERENCES public.access_events(id),
  entered_at      timestamptz NOT NULL,
  exited_at       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hour_bank_visit_segments_exited_after_entered
    CHECK (exited_at IS NULL OR exited_at >= entered_at)
);

COMMENT ON TABLE public.hour_bank_visit_segments IS
  'Un segmento = un par entrada/salida real del torniquete. school_id/enrollment_id están '
  'denormalizados desde hour_bank_visits a propósito: evita un JOIN en cada policy de RLS y en '
  'las queries de dashboard (padre/coach/owner) que solo necesitan filtrar por escuela o '
  'inscripción sin resolver primero el visit_id.';

CREATE INDEX hour_bank_visit_segments_visit_idx ON public.hour_bank_visit_segments (visit_id);
CREATE INDEX hour_bank_visit_segments_enrollment_idx ON public.hour_bank_visit_segments (enrollment_id);

-- =============================================================================
-- 6. RLS — solo SELECT. Las 3 tablas son "contadores"/ledger: el único
--    escritor es la RPC SECURITY DEFINER de F2 (mismo patrón que
--    move_session_credit para enrollments.sessions_used). Nadie hace
--    INSERT/UPDATE/DELETE directo desde el cliente, así que no hay policies
--    de escritura para authenticated — la ausencia es intencional, no un
--    olvido.
-- =============================================================================

ALTER TABLE public.hour_bank_periods        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hour_bank_visits          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hour_bank_visit_segments  ENABLE ROW LEVEL SECURITY;

-- Visibilidad (D-1/§4.7 del spec: owner, coach y padre/atleta ven sus horas):
-- staff de la escuela (owner/admin/coach, vía user_staff_school_ids()) ve
-- todo lo de su escuela; el atleta adulto o el padre del atleta ve solo lo de
-- su propia inscripción. Sin recursión: consulta enrollments, no la propia
-- tabla, en el USING.

CREATE POLICY "hour_bank_periods_select" ON public.hour_bank_periods
  FOR SELECT
  USING (
    school_id = ANY (public.user_staff_school_ids())
    OR EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.id = hour_bank_periods.enrollment_id
        AND (e.user_id = auth.uid() OR public.is_parent_of_child(e.child_id))
    )
  );

CREATE POLICY "hour_bank_visits_select" ON public.hour_bank_visits
  FOR SELECT
  USING (
    school_id = ANY (public.user_staff_school_ids())
    OR EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.id = hour_bank_visits.enrollment_id
        AND (e.user_id = auth.uid() OR public.is_parent_of_child(e.child_id))
    )
  );

CREATE POLICY "hour_bank_visit_segments_select" ON public.hour_bank_visit_segments
  FOR SELECT
  USING (
    school_id = ANY (public.user_staff_school_ids())
    OR EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.id = hour_bank_visit_segments.enrollment_id
        AND (e.user_id = auth.uid() OR public.is_parent_of_child(e.child_id))
    )
  );

-- Defensa en profundidad (trap #3 de CLAUDE.md: los default privileges del
-- esquema otorgan de más si no se revocan explícito). anon nunca debe tocar
-- estas 3 tablas — RLS ya lo bloquea vía auth.uid(), esto es cinturón y tirantes.
REVOKE ALL ON public.hour_bank_periods        FROM anon;
REVOKE ALL ON public.hour_bank_visits          FROM anon;
REVOKE ALL ON public.hour_bank_visit_segments  FROM anon;

COMMIT;
