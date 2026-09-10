-- =============================================================================
-- 20260910074449_pausa_vacaciones_enrollments.sql
-- Autor: brylop   Fecha: 2026-09-10   Versión anterior: 20260905124655
--
-- APLICADA EN LA BASE 2026-09-10 vía `apply_migration` (deja rastro en
-- schema_migrations), en dos pasadas porque el payload no entraba en una:
--     20260910080206  pausa_vacaciones_enrollments   → secciones 1-10
--     20260910080313  pausa_vacaciones_open_month    → sección 11
-- Este archivo es el equivalente completo para un ambiente nuevo y es
-- re-ejecutable (IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS),
-- así que correrlo de nuevo converge al mismo estado. Los timestamps de
-- schema_migrations los pone el CLI, no coinciden con el nombre del archivo —
-- es el mismo patrón que el resto del historial de este repo.
--
-- VERIFICADO tras aplicar: `npm run seguridad:invariantes` sin violaciones
-- CRÍTICAS y sin ninguna que involucre a los objetos nuevos; prueba funcional
-- end-to-end en transacción con rollback (pausa → el preview del mes excluye al
-- atleta → reactivación anticipada lo devuelve al roster el mismo día → el mes
-- ya saltado sigue sin cobro). Radio confirmado en cero: 0 escuelas con
-- pause_enabled, 0 pausas, 1.322 inscripciones activas intactas.
-- Objetivo: Fase 1 (backend) de docs/specs/pausa-vacaciones-enrollments.md.
--   El "botón de vacaciones": pausar una inscripción por N meses completos sin
--   cobrar esos meses, con dos caminos de entrada — el acudiente SOLICITA y el
--   admin APRUEBA, o el admin pausa directo con una sola llamada.
--
-- Cierra la decisión D4 de docs/specs/cobranza-vencidos-estados-y-alertas.md,
-- y las que salieron de ahí:
--   D5 granularidad = mes completo (no prorrateo; consistente con open_month).
--   D6 los cobros pending/overdue del periodo pausado se ANULAN.
--   D7 rollout opt-in por escuela (pause_enabled), apagado por defecto.
--
-- Contexto: 20260902171932 dejó las columnas paused_reason/paused_at/paused_until
-- en enrollments (aplicadas, 0 filas usadas de 1.322 activas) y la exclusión en
-- fn_expire_overdue_enrollments, pero SIN nada que las setee ni las respete.
-- Esta migración construye lo que faltaba.
--
-- DOS PREGUNTAS DISTINTAS, DOS REGLAS DISTINTAS — no confundirlas:
--   · COBRO (¿se emite la cuota del mes M?) → granularidad de MES, se responde
--     con month_from/month_to. Un mes que ya se saltó sigue saltado aunque el
--     atleta vuelva antes: la plata ya se decidió.
--   · OPERACIÓN (¿aparece en la lista de asistencia del día D?) → granularidad
--     de DÍA, se responde con la vista v_enrollment_pauses_effective, que
--     recorta la ventana en resumed_at. El que vuelve de vacaciones reaparece
--     ese mismo día, no el mes siguiente.
--
-- LO QUE NO SE TOCA, Y POR QUÉ:
--   · apply_late_fees() — no hace falta. Con D6 el cobro del mes pausado no
--     existe, así que no hay a qué aplicarle recargo. La deuda técnica que
--     20260902171932 anotó ("payments no tiene enrollment_id") queda superada:
--     payments SÍ tiene period_year/period_month + child_id/user_id/
--     unregistered_athlete_id, y con eso alcanza para casar cobro↔pausa.
--   · send_payment_reminders() — igual: sin cobro no hay recordatorio.
--   · La vista school_athletes — el badge de F2 lee la vista nueva y mapea por
--     enrollment_id (school_athletes ya lo expone). Reescribir esas ~200 líneas
--     para agregar dos columnas es riesgo sin beneficio.
--   · access-auto-block.job.ts — el bloqueo de puerta se dispara por
--     payments.status='overdue'. Un pausado no llega a overdue (D6 anula), así
--     que la puerta le sigue abriendo. Es un hueco CONOCIDO y deliberado: la
--     pausa saca de la lista de asistencia, no cierra el torno. Cerrar la
--     puerta al pausado es una decisión de producto aparte.
--   · claim_due_recurring_subscriptions — el autopay NO está desplegado
--     (recurring_subscriptions no existe en esta base). Cuando se despliegue,
--     el chequeo de pausa va ahí: crea su propio payments por fuera de
--     open_month. Anotado en docs/gotchas-tecnicos.md.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
--   · REVOKE incluye PUBLIC: Postgres otorga EXECUTE a PUBLIC por defecto.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Columnas de auditoría en enrollments
--    Las de estado (paused_reason/paused_at/paused_until) ya existen desde
--    20260902171932. Acá solo se agrega el rastro de quién y por cuál solicitud.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS paused_by        uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS pause_request_id uuid;

COMMENT ON COLUMN public.enrollments.paused_by IS
  'Quién aprobó/aplicó la pausa vigente. NULL si no está pausada.';
COMMENT ON COLUMN public.enrollments.pause_request_id IS
  'La solicitud (enrollment_pause_requests) que produjo la pausa VIGENTE. Se limpia al reactivar; la historia queda en la tabla.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Config por escuela (D7: opt-in, apagado por defecto)
--    Con pause_enabled=false el radio de esta migración es CERO escuelas: nadie
--    puede pausar hasta que su escuela lo prenda, así que open_month se comporta
--    exactamente igual que antes para las 368.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS pause_enabled             boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pause_max_months_per_year int     NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS pause_parent_can_request  boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'school_settings_pause_max_months_check'
  ) THEN
    ALTER TABLE public.school_settings
      ADD CONSTRAINT school_settings_pause_max_months_check
      CHECK (pause_max_months_per_year BETWEEN 0 AND 12);
  END IF;
END $$;

COMMENT ON COLUMN public.school_settings.pause_enabled IS
  'Habilita la pausa por vacaciones/lesión en esta escuela. FALSE por defecto: sin esto nadie puede pausar y open_month no cambia de comportamiento.';
COMMENT ON COLUMN public.school_settings.pause_max_months_per_year IS
  'Tope de meses pausados por inscripción por año calendario. 0 = la escuela permite el botón del admin pero sin tope automático desactivado — usar pause_enabled para apagar del todo.';
COMMENT ON COLUMN public.school_settings.pause_parent_can_request IS
  'Si el acudiente/atleta puede SOLICITAR la pausa. FALSE deja solo el botón directo del admin.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Tabla de solicitudes e historia
--    Las columnas de enrollments guardan solo la pausa VIGENTE. El tope de
--    meses/año y el rastro de quién pidió/aprobó necesitan historia.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.enrollment_pause_requests (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id                uuid NOT NULL REFERENCES public.schools(id)     ON DELETE CASCADE,
  enrollment_id            uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,

  -- Identidad del atleta: el mismo trío que usa payments. Es lo que permite
  -- casar los cobros a anular sin un enrollment_id que payments no tiene.
  child_id                 uuid REFERENCES public.children(id)              ON DELETE CASCADE,
  user_id                  uuid REFERENCES public.profiles(id)              ON DELETE CASCADE,
  unregistered_athlete_id  uuid REFERENCES public.unregistered_athletes(id) ON DELETE CASCADE,

  reason                   text NOT NULL CHECK (reason IN ('injury','vacation','other')),
  reason_note              text CHECK (reason_note IS NULL OR length(reason_note) <= 500),

  -- Día 1 del primer y del último mes pausado (D5: granularidad de mes).
  month_from               date NOT NULL,
  month_to                 date NOT NULL,

  status                   text NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','approved','rejected','cancelled')),
  source                   text NOT NULL CHECK (source IN ('parent','athlete','admin')),

  requested_by             uuid REFERENCES public.profiles(id),
  requested_at             timestamptz NOT NULL DEFAULT now(),
  reviewed_by              uuid REFERENCES public.profiles(id),
  reviewed_at              timestamptz,
  review_note              text,

  -- Auditoría de lo que la aprobación movió realmente.
  payments_cancelled       int,
  payments_ambiguos        int,   -- candidatos por periodo+identidad que NO se anularon por categoría dudosa
  expires_at_at_pause      date,  -- vigencia al momento de pausar, para decidir la extensión al reactivar

  resumed_at               timestamptz,
  resumed_by               uuid REFERENCES public.profiles(id),
  days_extended            int,

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pause_meses_ordenados CHECK (month_to >= month_from),
  CONSTRAINT pause_dia_uno CHECK (
    extract(day from month_from) = 1 AND extract(day from month_to) = 1
  ),
  CONSTRAINT pause_una_identidad CHECK (
    (child_id IS NOT NULL)::int + (user_id IS NOT NULL)::int
      + (unregistered_athlete_id IS NOT NULL)::int = 1
  )
);

COMMENT ON TABLE public.enrollment_pause_requests IS
  'Pausas de inscripción (vacaciones/lesión): solicitud del acudiente + aprobación del admin, o pausa directa del admin (source=admin, nace approved). Es la fuente de verdad de qué mes NO se cobra — enrollments.paused_* refleja solo la pausa vigente y se limpia al reactivar. Ver docs/specs/pausa-vacaciones-enrollments.md.';
COMMENT ON COLUMN public.enrollment_pause_requests.payments_ambiguos IS
  'Cobros que caían en el periodo pausado pero NO se anularon porque su categoría es dudosa (payment_category NULL + payment_type one_time: 2.773 filas hoy, la bolsa donde viven los cobros registrados a mano). Si es > 0, el admin tiene que revisarlos a mano — anularlos automáticamente barrería cobros que no son mensualidad.';
COMMENT ON COLUMN public.enrollment_pause_requests.expires_at_at_pause IS
  'enrollments.expires_at al momento de aprobar. Al reactivar se extiende la vigencia SOLO si el atleta ya estaba pago hasta dentro de la pausa (payments_cancelled = 0 y expires_at >= month_from): si no pagó esos meses, extender le regalaría vigencia.';

-- Una sola solicitud pendiente por inscripción. btree simple: btree_gist NO está
-- instalado en esta base, así que el no-solape de pausas APROBADAS no puede ir
-- por EXCLUDE USING gist — se valida en la RPC bajo advisory lock (§5).
CREATE UNIQUE INDEX IF NOT EXISTS enrollment_pause_requests_una_pendiente
  ON public.enrollment_pause_requests(enrollment_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS enrollment_pause_requests_bandeja
  ON public.enrollment_pause_requests(school_id, requested_at DESC) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS enrollment_pause_requests_aprobadas
  ON public.enrollment_pause_requests(enrollment_id, month_from) WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS enrollment_pause_requests_escuela_aprobadas
  ON public.enrollment_pause_requests(school_id, month_from, month_to) WHERE status = 'approved';

-- FK diferida de enrollments → la solicitud (se agrega acá, ya creada la tabla).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_pause_request_id_fkey'
  ) THEN
    ALTER TABLE public.enrollments
      ADD CONSTRAINT enrollments_pause_request_id_fkey
      FOREIGN KEY (pause_request_id)
      REFERENCES public.enrollment_pause_requests(id) ON DELETE SET NULL;
  END IF;
END $$;

DROP TRIGGER IF EXISTS enrollment_pause_requests_set_updated_at ON public.enrollment_pause_requests;
CREATE TRIGGER enrollment_pause_requests_set_updated_at
  BEFORE UPDATE ON public.enrollment_pause_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS
--    Policies POR COMANDO, nunca FOR ALL: FOR ALL sin WITH CHECK valida los
--    INSERT con la expresión del USING, que es exactamente cómo cualquiera se
--    insertaba como staff de cualquier escuela (invariante I3).
--    Escritura: NINGUNA policy. Todo entra por las RPCs SECURITY DEFINER.
-- ─────────────────────────────────────────────────────────────────────────────
-- Sin FORCE ROW LEVEL SECURITY: solo 5 de 254 tablas lo usan, y las RPCs de
-- abajo corren como owner (postgres, que tiene BYPASSRLS) — FORCE no cambiaría
-- nada para ellas y sí sería una sorpresa si algún día cambia el dueño.
ALTER TABLE public.enrollment_pause_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pause_requests_select_staff    ON public.enrollment_pause_requests;
DROP POLICY IF EXISTS pause_requests_select_acudiente ON public.enrollment_pause_requests;
DROP POLICY IF EXISTS pause_requests_select_atleta   ON public.enrollment_pause_requests;

-- Staff de la escuela: lectura. user_school_ids() incluye padres y atletas, y
-- acá eso está BIEN porque es solo lectura (invariante I2 prohíbe usarla para
-- ESCRITURA, y esta tabla no tiene ninguna policy de escritura).
--
-- OJO con la forma. user_school_ids() devuelve uuid[], así que:
--   · `school_id = ANY (user_school_ids())` — lo que usa el resto del repo:
--     compila, pero el planner evalúa la función POR FILA (la lentitud de agosto).
--   · `school_id = ANY ((SELECT public.user_school_ids()))` — NO compila:
--     "operator does not exist: uuid = uuid[]". El paréntesis lo parsea como la
--     forma de subconsulta, que espera un conjunto de uuid, no un array.
--   · `school_id IN (SELECT unnest(public.user_school_ids()))` — la buena:
--     compila y el plan la resuelve UNA vez (ProjectSet + HashAggregate) contra
--     un Index Only Scan. Verificado con EXPLAIN antes de escribir esto.
CREATE POLICY pause_requests_select_staff
  ON public.enrollment_pause_requests
  FOR SELECT TO authenticated
  USING (school_id IN (SELECT unnest(public.user_school_ids())));

-- Acudiente del menor. is_parent_of_child() ya existe, es SECURITY DEFINER y
-- tiene search_path fijo — resuelve por PK de children, no escanea.
CREATE POLICY pause_requests_select_acudiente
  ON public.enrollment_pause_requests
  FOR SELECT TO authenticated
  USING (child_id IS NOT NULL AND public.is_parent_of_child(child_id));

-- Atleta adulto: la suya propia.
CREATE POLICY pause_requests_select_atleta
  ON public.enrollment_pause_requests
  FOR SELECT TO authenticated
  USING (user_id IS NOT NULL AND user_id = (SELECT auth.uid()));

REVOKE ALL   ON TABLE public.enrollment_pause_requests FROM PUBLIC, anon;
GRANT  SELECT ON TABLE public.enrollment_pause_requests TO authenticated;
GRANT  ALL    ON TABLE public.enrollment_pause_requests TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Vista de ventana EFECTIVA (la regla OPERATIVA, granularidad de día)
--    Responde "¿está pausado el día D?". Recorta en resumed_at para que el que
--    vuelve de vacaciones reaparezca ese mismo día en la lista de asistencia,
--    sin esperar a que termine el mes.
--    effective_until es EXCLUSIVO: pausado ⇔ effective_from <= D < effective_until.
-- ─────────────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.v_enrollment_pauses_effective;
CREATE VIEW public.v_enrollment_pauses_effective
WITH (security_invoker = true) AS
SELECT
  r.id                       AS request_id,
  r.school_id,
  r.enrollment_id,
  r.child_id,
  r.user_id,
  r.unregistered_athlete_id,
  r.reason,
  r.reason_note,
  r.month_from,
  r.month_to,
  r.month_from               AS effective_from,
  LEAST(
    COALESCE((r.resumed_at AT TIME ZONE 'America/Bogota')::date, 'infinity'::date),
    (r.month_to + interval '1 month')::date
  )                          AS effective_until,
  r.resumed_at
FROM public.enrollment_pause_requests r
WHERE r.status = 'approved';

COMMENT ON VIEW public.v_enrollment_pauses_effective IS
  'Ventana EFECTIVA de cada pausa aprobada, en días. Para la regla OPERATIVA (¿aparece en la lista de asistencia del día D?): pausado ⇔ effective_from <= D < effective_until. NO usar para decidir el cobro — eso es granularidad de mes y va por enrollment_pausada_en(). security_invoker + sin subqueries correlacionadas: una subquery acá re-activaría RLS por fila (ya costó un timeout 57014).';

GRANT SELECT ON public.v_enrollment_pauses_effective TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Helpers de consulta
-- ─────────────────────────────────────────────────────────────────────────────

-- Regla de COBRO: ¿la inscripción tiene el mes (año, mes) pausado entero?
-- Se lee de la TABLA, no de enrollments.paused_*, para que abrir un mes pasado
-- dé el mismo resultado que dio en su momento.
CREATE OR REPLACE FUNCTION public.enrollment_pausada_en(
  p_enrollment_id uuid, p_year int, p_month int
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollment_pause_requests r
    WHERE r.enrollment_id = p_enrollment_id
      AND r.status = 'approved'
      AND make_date(p_year, p_month, 1) BETWEEN r.month_from AND r.month_to
  );
$$;

REVOKE ALL ON FUNCTION public.enrollment_pausada_en(uuid, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enrollment_pausada_en(uuid, int, int) TO authenticated, service_role;

COMMENT ON FUNCTION public.enrollment_pausada_en(uuid, int, int) IS
  'Regla de COBRO (granularidad de mes): TRUE si una pausa aprobada cubre ese mes calendario entero. La usan open_month y preview_open_month. No mira resumed_at a propósito: un mes que ya se saltó sigue saltado aunque el atleta vuelva antes.';

-- Regla OPERATIVA: ¿está pausado el día D?
CREATE OR REPLACE FUNCTION public.enrollment_pausada_el(
  p_enrollment_id uuid, p_date date DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.v_enrollment_pauses_effective v
    WHERE v.enrollment_id = p_enrollment_id
      AND COALESCE(p_date, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date)
            >= v.effective_from
      AND COALESCE(p_date, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date)
            <  v.effective_until
  );
$$;

REVOKE ALL ON FUNCTION public.enrollment_pausada_el(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enrollment_pausada_el(uuid, date) TO authenticated, service_role;

COMMENT ON FUNCTION public.enrollment_pausada_el(uuid, date) IS
  'Regla OPERATIVA (granularidad de día): TRUE si la inscripción está pausada ese día, respetando la reactivación anticipada. La usa el BFF para sacar al pausado del roster de asistencia.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Anulación de los cobros del periodo pausado (D6)
--    Privada: se revoca de todos y solo la llaman las RPCs de aprobación, que
--    son SECURITY DEFINER y corren como owner.
--
--    QUÉ ANULA Y QUÉ NO. payment_category es poco fiable (censo: solo 4 de 13
--    caminos la estampan). Distribución real hoy:
--        NULL + one_time     2.773   ← acá viven los cobros registrados A MANO
--        NULL + subscription 1.319   ← mensualidades de open_month viejas
--        mensualidad + subscription 504
--        mensualidad + one_time      10
--        articulos / torneo            2
--    Anular la bolsa NULL+one_time barrería cobros que no son mensualidad, así
--    que se excluye y se CUENTA en payments_ambiguos para que el admin la
--    revise. Falso negativo (queda un cobro vivo que había que anular) es
--    recuperable a mano; falso positivo (anular la matrícula de un torneo) no.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pause_anular_cobros_del_periodo(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_r          record;
  v_cancelled  int := 0;
  v_ambiguos   int := 0;
  v_hasta      date;
BEGIN
  SELECT * INTO v_r FROM public.enrollment_pause_requests WHERE id = p_request_id;
  IF v_r.id IS NULL THEN
    RETURN jsonb_build_object('cancelled', 0, 'ambiguos', 0);
  END IF;

  v_hasta := (v_r.month_to + interval '1 month')::date;   -- exclusivo

  -- Un solo statement: la CTE `candidatos` se lee dos veces (una para anular, una
  -- para contar los dudosos) y la CTE que escribe va anidada. Sin TEMP TABLE a
  -- propósito: en una función SECURITY DEFINER son frágiles y el SQL editor de
  -- Supabase directamente no las soporta.
  WITH candidatos AS (
    SELECT
      p.id,
      (p.payment_category = 'mensualidad'
         OR (p.payment_category IS NULL AND p.payment_type = 'subscription')) AS es_mensualidad
    FROM public.payments p
    WHERE p.school_id = v_r.school_id
      AND p.status IN ('pending','overdue')
      AND (
            (v_r.child_id IS NOT NULL AND p.child_id = v_r.child_id)
         OR (v_r.user_id  IS NOT NULL AND (p.user_id = v_r.user_id OR p.parent_id = v_r.user_id))
         OR (v_r.unregistered_athlete_id IS NOT NULL
               AND p.unregistered_athlete_id = v_r.unregistered_athlete_id)
      )
      AND (
            (p.period_year IS NOT NULL AND p.period_month IS NOT NULL
               AND make_date(p.period_year, p.period_month, 1) BETWEEN v_r.month_from AND v_r.month_to)
         OR (p.period_year IS NULL
               AND p.due_date >= v_r.month_from AND p.due_date < v_hasta)   -- legacy sin periodo
      )
  ),
  anulados AS (
    UPDATE public.payments p
    SET status = 'cancelled', updated_at = now()
    WHERE p.id IN (SELECT c.id FROM candidatos c WHERE c.es_mensualidad)
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM anulados),
         (SELECT count(*) FROM candidatos c WHERE NOT c.es_mensualidad)
    INTO v_cancelled, v_ambiguos;

  RETURN jsonb_build_object('cancelled', COALESCE(v_cancelled, 0), 'ambiguos', COALESCE(v_ambiguos, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.pause_anular_cobros_del_periodo(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pause_anular_cobros_del_periodo(uuid) TO service_role;

COMMENT ON FUNCTION public.pause_anular_cobros_del_periodo(uuid) IS
  'D6: anula (cancelled) los cobros pending/overdue de mensualidad cuyo periodo cae dentro de la pausa, casando por identidad de atleta + period_year/month. Devuelve {cancelled, ambiguos}. NO anula la bolsa payment_category NULL + payment_type one_time (cobros a mano): los cuenta como ambiguos para revisión manual. Privada: solo la llaman las RPCs de aprobación.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Aplicar / levantar la pausa sobre enrollments (privada)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pause_aplicar(p_request_id uuid, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_r        record;
  v_anulados jsonb;
  v_expires  date;
BEGIN
  SELECT * INTO v_r FROM public.enrollment_pause_requests WHERE id = p_request_id;
  IF v_r.id IS NULL THEN
    RAISE EXCEPTION 'Solicitud de pausa no encontrada.';
  END IF;

  SELECT e.expires_at INTO v_expires FROM public.enrollments e WHERE e.id = v_r.enrollment_id;

  v_anulados := public.pause_anular_cobros_del_periodo(p_request_id);

  UPDATE public.enrollments e
  SET paused_reason     = v_r.reason,
      paused_at         = (v_r.month_from::timestamp AT TIME ZONE 'America/Bogota'),
      paused_until      = ((v_r.month_to + interval '1 month')::timestamp AT TIME ZONE 'America/Bogota'),
      paused_by         = p_actor,
      pause_request_id  = p_request_id,
      updated_at        = now()
  WHERE e.id = v_r.enrollment_id;

  UPDATE public.enrollment_pause_requests
  SET status              = 'approved',
      reviewed_by         = p_actor,
      reviewed_at         = now(),
      payments_cancelled  = (v_anulados->>'cancelled')::int,
      payments_ambiguos   = (v_anulados->>'ambiguos')::int,
      expires_at_at_pause = v_expires
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'request_id',         p_request_id,
    'enrollment_id',      v_r.enrollment_id,
    'month_from',         v_r.month_from,
    'month_to',           v_r.month_to,
    'meses_pausados',     (extract(year from v_r.month_to) * 12 + extract(month from v_r.month_to))
                          - (extract(year from v_r.month_from) * 12 + extract(month from v_r.month_from)) + 1,
    'payments_cancelled', (v_anulados->>'cancelled')::int,
    'payments_ambiguos',  (v_anulados->>'ambiguos')::int
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pause_aplicar(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pause_aplicar(uuid, uuid) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Validación compartida (privada): tope, solape, ventana, flags
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pause_validar(
  p_enrollment_id uuid, p_month_from date, p_month_to date, p_es_admin boolean,
  p_excluir_request_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_e          record;
  v_cfg        record;
  v_meses      int;
  v_ya         int;
  v_mes_actual date := date_trunc('month', (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date)::date;
BEGIN
  SELECT e.id, e.school_id, e.status, e.child_id, e.user_id, e.unregistered_athlete_id
    INTO v_e
  FROM public.enrollments e WHERE e.id = p_enrollment_id;

  IF v_e.id IS NULL THEN
    RAISE EXCEPTION 'Inscripción no encontrada.';
  END IF;
  IF v_e.status <> 'active' THEN
    RAISE EXCEPTION 'Solo se puede pausar una inscripción activa (esta está %).', v_e.status;
  END IF;

  SELECT COALESCE(pause_enabled, false)            AS habilitada,
         COALESCE(pause_max_months_per_year, 2)    AS tope,
         COALESCE(pause_parent_can_request, true)  AS padre_puede
    INTO v_cfg
  FROM public.school_settings WHERE school_id = v_e.school_id;

  IF NOT COALESCE(v_cfg.habilitada, false) THEN
    RAISE EXCEPTION 'La pausa por vacaciones no está habilitada en esta escuela.';
  END IF;
  IF NOT p_es_admin AND NOT COALESCE(v_cfg.padre_puede, true) THEN
    RAISE EXCEPTION 'En esta escuela la pausa la aplica la administración; no se puede solicitar.';
  END IF;

  IF p_month_to < p_month_from THEN
    RAISE EXCEPTION 'El mes final no puede ser anterior al inicial.';
  END IF;
  IF extract(day from p_month_from) <> 1 OR extract(day from p_month_to) <> 1 THEN
    RAISE EXCEPTION 'Los meses deben venir como el día 1 del mes.';
  END IF;
  IF p_month_from < v_mes_actual THEN
    RAISE EXCEPTION 'No se puede pausar un mes que ya pasó.';
  END IF;

  v_meses := (extract(year from p_month_to) * 12 + extract(month from p_month_to))
           - (extract(year from p_month_from) * 12 + extract(month from p_month_from)) + 1;

  -- Solape con pausas ya aprobadas o pendientes de la misma inscripción.
  IF EXISTS (
    SELECT 1 FROM public.enrollment_pause_requests r
    WHERE r.enrollment_id = p_enrollment_id
      AND r.status IN ('approved','pending')
      -- Al APROBAR, la solicitud que se está aprobando sigue en 'pending' y se
      -- solaparia consigo misma: sin esta exclusion no se podria aprobar nada.
      AND (p_excluir_request_id IS NULL OR r.id <> p_excluir_request_id)
      AND daterange(r.month_from, (r.month_to + interval '1 month')::date, '[)')
          && daterange(p_month_from, (p_month_to + interval '1 month')::date, '[)')
  ) THEN
    RAISE EXCEPTION 'Ya hay una pausa aprobada o pendiente que se cruza con esos meses.';
  END IF;

  -- Tope por año calendario (cuenta las aprobadas del año de month_from).
  IF COALESCE(v_cfg.tope, 2) > 0 THEN
    SELECT COALESCE(sum(
             (extract(year from r.month_to) * 12 + extract(month from r.month_to))
           - (extract(year from r.month_from) * 12 + extract(month from r.month_from)) + 1
           ), 0)
      INTO v_ya
    FROM public.enrollment_pause_requests r
    WHERE r.enrollment_id = p_enrollment_id
      AND r.status = 'approved'
      AND (p_excluir_request_id IS NULL OR r.id <> p_excluir_request_id)
      AND extract(year from r.month_from) = extract(year from p_month_from);

    IF v_ya + v_meses > v_cfg.tope THEN
      RAISE EXCEPTION 'Supera el tope de % mes(es) de pausa por año (ya usó %).', v_cfg.tope, v_ya;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'school_id',               v_e.school_id,
    'child_id',                v_e.child_id,
    'user_id',                 v_e.user_id,
    'unregistered_athlete_id', v_e.unregistered_athlete_id,
    'meses',                   v_meses
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pause_validar(uuid, date, date, boolean, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pause_validar(uuid, date, date, boolean, uuid) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. RPCs públicas
--     Guarda de autorización con COALESCE obligatorio: NOT NULL es NULL, no
--     TRUE — es exactamente el bypass que costó ~64 funciones (20260826110449).
-- ─────────────────────────────────────────────────────────────────────────────

-- 10.1 Preview: qué meses no se cobrarían y cuántos cobros se anularían.
--      Alimenta el diálogo de confirmación para que la plata NO se calcule en
--      el navegador (censo: 11 divergencias de cálculos monetarios en el front).
CREATE OR REPLACE FUNCTION public.preview_enrollment_pause(
  p_enrollment_id uuid, p_month_from date, p_month_to date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_e         record;
  v_es_admin  boolean;
  v_meses     jsonb;
  v_a_anular  int := 0;
  v_ambiguos  int := 0;
  v_hasta     date := (p_month_to + interval '1 month')::date;
BEGIN
  SELECT e.school_id, e.child_id, e.user_id, e.unregistered_athlete_id
    INTO v_e
  FROM public.enrollments e WHERE e.id = p_enrollment_id;
  IF v_e.school_id IS NULL THEN RAISE EXCEPTION 'Inscripción no encontrada.'; END IF;

  v_es_admin := COALESCE(public.is_super_admin(), false)
             OR COALESCE(public.is_school_admin(v_e.school_id), false);

  IF NOT v_es_admin
     AND NOT (v_e.child_id IS NOT NULL AND COALESCE(public.is_parent_of_child(v_e.child_id), false))
     AND NOT (v_e.user_id IS NOT NULL AND v_e.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado.';
  END IF;

  SELECT jsonb_agg(to_char(m, 'MM/YYYY') ORDER BY m)
    INTO v_meses
  FROM generate_series(p_month_from, p_month_to, interval '1 month') AS m;

  SELECT
    count(*) FILTER (WHERE p.payment_category = 'mensualidad'
                        OR (p.payment_category IS NULL AND p.payment_type = 'subscription')),
    count(*) FILTER (WHERE NOT (p.payment_category = 'mensualidad'
                        OR (p.payment_category IS NULL AND p.payment_type = 'subscription')))
    INTO v_a_anular, v_ambiguos
  FROM public.payments p
  WHERE p.school_id = v_e.school_id
    AND p.status IN ('pending','overdue')
    AND (
          (v_e.child_id IS NOT NULL AND p.child_id = v_e.child_id)
       OR (v_e.user_id  IS NOT NULL AND (p.user_id = v_e.user_id OR p.parent_id = v_e.user_id))
       OR (v_e.unregistered_athlete_id IS NOT NULL
             AND p.unregistered_athlete_id = v_e.unregistered_athlete_id)
    )
    AND (
          (p.period_year IS NOT NULL AND p.period_month IS NOT NULL
             AND make_date(p.period_year, p.period_month, 1) BETWEEN p_month_from AND p_month_to)
       OR (p.period_year IS NULL AND p.due_date >= p_month_from AND p.due_date < v_hasta)
    );

  RETURN jsonb_build_object(
    'meses',              COALESCE(v_meses, '[]'::jsonb),
    'payments_a_anular',  COALESCE(v_a_anular, 0),
    'payments_ambiguos',  COALESCE(v_ambiguos, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.preview_enrollment_pause(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_enrollment_pause(uuid, date, date) TO authenticated, service_role;

-- 10.2 El acudiente / atleta adulto SOLICITA. No toca enrollments.
CREATE OR REPLACE FUNCTION public.request_enrollment_pause(
  p_enrollment_id uuid,
  p_reason        text,
  p_month_from    date,
  p_month_to      date,
  p_reason_note   text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_e       record;
  v_v       jsonb;
  v_meses   int;
  v_source  text;
  v_id      uuid;
  v_caller  uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Sesión requerida.'; END IF;

  SELECT e.school_id, e.child_id, e.user_id, e.unregistered_athlete_id
    INTO v_e
  FROM public.enrollments e WHERE e.id = p_enrollment_id;
  IF v_e.school_id IS NULL THEN RAISE EXCEPTION 'Inscripción no encontrada.'; END IF;

  IF v_e.child_id IS NOT NULL AND COALESCE(public.is_parent_of_child(v_e.child_id), false) THEN
    v_source := 'parent';
  ELSIF v_e.user_id IS NOT NULL AND v_e.user_id = v_caller THEN
    v_source := 'athlete';
  ELSE
    RAISE EXCEPTION 'No autorizado: solo el acudiente del atleta o el atleta adulto pueden solicitar la pausa.';
  END IF;

  -- Serializa por inscripción: dos solicitudes concurrentes esperan en fila, así
  -- el chequeo de solape y de tope no se pisa. btree_gist no está instalado, así
  -- que este lock ES la garantía de no-solape (ver §3).
  PERFORM pg_advisory_xact_lock(hashtextextended(p_enrollment_id::text, 0));

  v_v     := public.pause_validar(p_enrollment_id, p_month_from, p_month_to, false);
  v_meses := (v_v->>'meses')::int;

  INSERT INTO public.enrollment_pause_requests (
    school_id, enrollment_id, child_id, user_id, unregistered_athlete_id,
    reason, reason_note, month_from, month_to, status, source, requested_by
  ) VALUES (
    v_e.school_id, p_enrollment_id, v_e.child_id, v_e.user_id, v_e.unregistered_athlete_id,
    p_reason, p_reason_note, p_month_from, p_month_to, 'pending', v_source, v_caller
  )
  RETURNING id INTO v_id;

  -- Aviso a la administración. Un INSERT en notifications encola el envío solo
  -- (trigger trg_enqueue_notification_delivery) — no se llama a ningún servicio.
  -- Los admins salen de school_members (profile_id/role/status) más el owner de
  -- la escuela: school_staff NO tiene role ni user_id, es la tabla de coaches.
  -- category='enrollment': 'billing' no está en el CHECK de notifications.
  INSERT INTO public.notifications (user_id, school_id, title, message, type, category, link, data)
  SELECT DISTINCT admin_id, v_e.school_id,
         'Solicitud de pausa',
         'Hay una solicitud de pausa por ' || v_meses || ' mes(es) esperando revisión.',
         'info', 'enrollment', '/students',
         jsonb_build_object('pause_request_id', v_id, 'enrollment_id', p_enrollment_id)
  FROM (
    SELECT sm.profile_id AS admin_id
      FROM public.school_members sm
     WHERE sm.school_id = v_e.school_id
       AND sm.status = 'active'
       AND sm.role IN ('owner','admin','school_admin')
    UNION
    SELECT s.owner_id
      FROM public.schools s
     WHERE s.id = v_e.school_id AND s.owner_id IS NOT NULL
  ) a
  WHERE admin_id IS NOT NULL;

  RETURN jsonb_build_object('request_id', v_id, 'status', 'pending', 'meses', v_meses);
END;
$$;

REVOKE ALL ON FUNCTION public.request_enrollment_pause(uuid, text, date, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_enrollment_pause(uuid, text, date, date, text) TO authenticated, service_role;

-- 10.3 Retirar la propia solicitud mientras siga pendiente.
CREATE OR REPLACE FUNCTION public.cancel_enrollment_pause_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_r      record;
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Sesión requerida.'; END IF;

  SELECT * INTO v_r FROM public.enrollment_pause_requests WHERE id = p_request_id;
  IF v_r.id IS NULL THEN RAISE EXCEPTION 'Solicitud no encontrada.'; END IF;
  IF v_r.status <> 'pending' THEN
    RAISE EXCEPTION 'Solo se puede retirar una solicitud pendiente (esta está %).', v_r.status;
  END IF;

  IF v_r.requested_by <> v_caller
     AND NOT COALESCE(public.is_super_admin(), false)
     AND NOT COALESCE(public.is_school_admin(v_r.school_id), false) THEN
    RAISE EXCEPTION 'No autorizado.';
  END IF;

  UPDATE public.enrollment_pause_requests SET status = 'cancelled' WHERE id = p_request_id;
  RETURN jsonb_build_object('request_id', p_request_id, 'status', 'cancelled');
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_enrollment_pause_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_enrollment_pause_request(uuid) TO authenticated, service_role;

-- 10.4 El admin APRUEBA. Aprobar exime de pagar, o sea otorga un beneficio
--      económico: va con is_school_admin, NUNCA user_staff_school_ids (un coach
--      no aprueba pausas).
CREATE OR REPLACE FUNCTION public.approve_enrollment_pause(
  p_request_id uuid, p_review_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_r      record;
  v_res    jsonb;
  v_caller uuid := auth.uid();
BEGIN
  SELECT * INTO v_r FROM public.enrollment_pause_requests WHERE id = p_request_id FOR UPDATE;
  IF v_r.id IS NULL THEN RAISE EXCEPTION 'Solicitud no encontrada.'; END IF;

  IF v_caller IS NOT NULL
     AND NOT COALESCE(public.is_super_admin(), false)
     AND NOT COALESCE(public.is_school_admin(v_r.school_id), false) THEN
    RAISE EXCEPTION 'No autorizado para aprobar pausas en esta escuela.';
  END IF;

  IF v_r.status <> 'pending' THEN
    RAISE EXCEPTION 'Esta solicitud ya fue resuelta (está %).', v_r.status;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_r.enrollment_id::text, 0));

  -- Se re-valida al aprobar: entre la solicitud y la aprobación pudo cambiar la
  -- config, aparecer otra pausa o pasar el mes.
  PERFORM public.pause_validar(v_r.enrollment_id, v_r.month_from, v_r.month_to, true, p_request_id);

  IF p_review_note IS NOT NULL THEN
    UPDATE public.enrollment_pause_requests SET review_note = p_review_note WHERE id = p_request_id;
  END IF;

  v_res := public.pause_aplicar(p_request_id, v_caller);

  INSERT INTO public.notifications (user_id, school_id, title, message, type, category, link, data)
  SELECT v_r.requested_by, v_r.school_id,
         'Pausa aprobada',
         'La pausa quedó aprobada. No se cobrarán esos meses.',
         'success', 'enrollment', '/children',
         jsonb_build_object('pause_request_id', p_request_id)
  WHERE v_r.requested_by IS NOT NULL;

  RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_enrollment_pause(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_enrollment_pause(uuid, text) TO authenticated, service_role;

-- 10.5 El admin RECHAZA.
CREATE OR REPLACE FUNCTION public.reject_enrollment_pause(
  p_request_id uuid, p_review_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_r      record;
  v_caller uuid := auth.uid();
BEGIN
  SELECT * INTO v_r FROM public.enrollment_pause_requests WHERE id = p_request_id FOR UPDATE;
  IF v_r.id IS NULL THEN RAISE EXCEPTION 'Solicitud no encontrada.'; END IF;

  IF v_caller IS NOT NULL
     AND NOT COALESCE(public.is_super_admin(), false)
     AND NOT COALESCE(public.is_school_admin(v_r.school_id), false) THEN
    RAISE EXCEPTION 'No autorizado para resolver pausas en esta escuela.';
  END IF;
  IF v_r.status <> 'pending' THEN
    RAISE EXCEPTION 'Esta solicitud ya fue resuelta (está %).', v_r.status;
  END IF;

  UPDATE public.enrollment_pause_requests
  SET status = 'rejected', reviewed_by = v_caller, reviewed_at = now(), review_note = p_review_note
  WHERE id = p_request_id;

  INSERT INTO public.notifications (user_id, school_id, title, message, type, category, link, data)
  SELECT v_r.requested_by, v_r.school_id,
         'Solicitud de pausa rechazada',
         COALESCE(p_review_note, 'La administración no aprobó la pausa.'),
         'warning', 'enrollment', '/children',
         jsonb_build_object('pause_request_id', p_request_id)
  WHERE v_r.requested_by IS NOT NULL;

  RETURN jsonb_build_object('request_id', p_request_id, 'status', 'rejected');
END;
$$;

REVOKE ALL ON FUNCTION public.reject_enrollment_pause(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_enrollment_pause(uuid, text) TO authenticated, service_role;

-- 10.6 EL BOTÓN DEL ADMIN: pausa directa, hace toda la acción de una.
--      Calca la UX del botón de becado, pero por RPC porque tiene que anular
--      cobros y escribir en dos tablas de forma atómica.
CREATE OR REPLACE FUNCTION public.pause_enrollment_directly(
  p_enrollment_id uuid,
  p_reason        text,
  p_month_from    date,
  p_month_to      date,
  p_note          text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_e      record;
  v_id     uuid;
  v_caller uuid := auth.uid();
BEGIN
  SELECT e.school_id, e.child_id, e.user_id, e.unregistered_athlete_id
    INTO v_e
  FROM public.enrollments e WHERE e.id = p_enrollment_id;
  IF v_e.school_id IS NULL THEN RAISE EXCEPTION 'Inscripción no encontrada.'; END IF;

  IF v_caller IS NOT NULL
     AND NOT COALESCE(public.is_super_admin(), false)
     AND NOT COALESCE(public.is_school_admin(v_e.school_id), false) THEN
    RAISE EXCEPTION 'No autorizado para pausar inscripciones en esta escuela.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_enrollment_id::text, 0));
  PERFORM public.pause_validar(p_enrollment_id, p_month_from, p_month_to, true);

  -- Nace 'approved', NO 'pending': el índice único enrollment_pause_requests_
  -- una_pendiente admite una sola pendiente por inscripción, así que insertar
  -- como pendiente reventaría si el acudiente ya tiene una solicitud abierta
  -- para OTROS meses — que es un caso perfectamente válido.
  INSERT INTO public.enrollment_pause_requests (
    school_id, enrollment_id, child_id, user_id, unregistered_athlete_id,
    reason, reason_note, month_from, month_to, status, source,
    requested_by, requested_at, reviewed_by, reviewed_at
  ) VALUES (
    v_e.school_id, p_enrollment_id, v_e.child_id, v_e.user_id, v_e.unregistered_athlete_id,
    p_reason, p_note, p_month_from, p_month_to, 'approved', 'admin',
    v_caller, now(), v_caller, now()
  )
  RETURNING id INTO v_id;

  RETURN public.pause_aplicar(v_id, v_caller);
END;
$$;

REVOKE ALL ON FUNCTION public.pause_enrollment_directly(uuid, text, date, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pause_enrollment_directly(uuid, text, date, date, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.pause_enrollment_directly(uuid, text, date, date, text) IS
  'El botón de vacaciones del admin: crea la solicitud ya aprobada (source=admin) y aplica la pausa completa —marca la inscripción, anula los cobros del periodo— en una sola transacción. Devuelve {meses_pausados, payments_cancelled, payments_ambiguos} para el toast.';

-- 10.7 Reactivar: vuelve a aparecer en todo, ese mismo día.
--      La extensión de vigencia es CONDICIONAL: solo si el atleta ya estaba
--      pago hasta dentro de la pausa (no se le anuló ningún cobro y su
--      expires_at alcanzaba el periodo). Si no pagó esos meses, extender le
--      regalaría vigencia que nadie compró.
CREATE OR REPLACE FUNCTION public.resume_enrollment(
  p_enrollment_id uuid, p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_e       record;
  v_r       record;
  v_hoy     date := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date;
  v_dias    int  := 0;
  v_caller  uuid := auth.uid();
BEGIN
  SELECT e.id, e.school_id, e.expires_at, e.pause_request_id, e.paused_reason
    INTO v_e
  FROM public.enrollments e WHERE e.id = p_enrollment_id;
  IF v_e.id IS NULL THEN RAISE EXCEPTION 'Inscripción no encontrada.'; END IF;

  IF v_caller IS NOT NULL
     AND NOT COALESCE(public.is_super_admin(), false)
     AND NOT COALESCE(public.is_school_admin(v_e.school_id), false) THEN
    RAISE EXCEPTION 'No autorizado para reactivar inscripciones en esta escuela.';
  END IF;
  IF v_e.paused_reason IS NULL THEN
    RAISE EXCEPTION 'Esta inscripción no está pausada.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_enrollment_id::text, 0));

  SELECT * INTO v_r
  FROM public.enrollment_pause_requests
  WHERE id = v_e.pause_request_id FOR UPDATE;

  -- Vigencia: se compensa SOLO el tiempo que el atleta había pagado y no usó.
  IF v_r.id IS NOT NULL
     AND COALESCE(v_r.payments_cancelled, 0) = 0
     AND v_r.expires_at_at_pause IS NOT NULL
     AND v_r.expires_at_at_pause >= v_r.month_from THEN
    v_dias := GREATEST(0, v_hoy - v_r.month_from);
    UPDATE public.enrollments
    SET expires_at = expires_at + v_dias, updated_at = now()
    WHERE id = p_enrollment_id AND expires_at IS NOT NULL;
  END IF;

  -- Cierra la ventana efectiva: la vista recorta en resumed_at, así que desde
  -- HOY el atleta vuelve a salir en el roster de asistencia.
  UPDATE public.enrollment_pause_requests
  SET resumed_at    = now(),
      resumed_by    = v_caller,
      days_extended = v_dias,
      review_note   = COALESCE(review_note, '') ||
                      CASE WHEN p_note IS NULL THEN '' ELSE E'\nReactivación: ' || p_note END
  WHERE id = v_r.id;

  UPDATE public.enrollments
  SET paused_reason    = NULL,
      paused_at        = NULL,
      paused_until     = NULL,
      paused_by        = NULL,
      pause_request_id = NULL,
      updated_at       = now()
  WHERE id = p_enrollment_id;

  RETURN jsonb_build_object(
    'enrollment_id',  p_enrollment_id,
    'resumed_at',     v_hoy,
    'days_extended',  v_dias,
    -- Aviso honesto para la UI: el mes en curso sigue sin cobro porque la
    -- ventana de COBRO es mensual y ese mes ya se decidió. Si la escuela lo
    -- quiere cobrar, lo registra a mano.
    'mes_en_curso_sin_cobro',
      (v_r.id IS NOT NULL AND date_trunc('month', v_hoy)::date BETWEEN v_r.month_from AND v_r.month_to)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resume_enrollment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resume_enrollment(uuid, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.resume_enrollment(uuid, text) IS
  'Reactiva una inscripción pausada: limpia enrollments.paused_*, cierra la ventana efectiva en resumed_at (el atleta reaparece HOY en el roster de asistencia) y extiende expires_at solo si había vigencia paga sin usar. Devuelve mes_en_curso_sin_cobro para que la UI diga la verdad: la ventana de cobro es mensual, así que el mes en el que se reactiva no se cobra.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. open_month y preview_open_month: excluir los meses pausados
--     Cuerpo copiado de la BASE VIVA (pg_get_functiondef), no de la migración
--     de becas: el último cambio vino de 20260903150628 (payment_category).
--     Lo único que se agrega es la línea marcada PAUSA.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.open_month(
  p_school_id uuid, p_year integer, p_month integer, p_branch_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_month_start date := make_date(p_year, p_month, 1);
  v_month_end   date := (make_date(p_year, p_month, 1) + interval '1 month')::date;
  v_cutoff      int;
  v_due         date;
  v_created     int := 0;
  v_caller      uuid := auth.uid();
BEGIN
  -- Autorización: admin de la escuela / super admin. El cron y service_role
  -- corren sin auth.uid() (v_caller NULL) y pasan.
  IF v_caller IS NOT NULL
     AND NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
    RAISE EXCEPTION 'No autorizado para abrir el mes de esta escuela.';
  END IF;

  -- Serializa por (escuela, periodo): dos disparadores concurrentes (doble-clic,
  -- cron + botón el mismo día) esperan en fila → cero duplicados por carrera.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_school_id::text || ':' || p_year::text || ':' || p_month::text, 0)
  );

  SELECT COALESCE(payment_cutoff_day, 10) INTO v_cutoff
  FROM public.school_settings WHERE school_id = p_school_id;
  v_cutoff := COALESCE(v_cutoff, 10);

  v_due := make_date(
    p_year, p_month,
    LEAST(v_cutoff, extract(day from (v_month_end - 1))::int)
  );

  WITH elegibles AS (
    -- Una fila por ATLETA. Ver el encabezado: el desempate no mira el monto.
    SELECT DISTINCT ON (COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id))
      e.school_id,
      COALESCE(c.branch_id, t.branch_id)                             AS branch_id,
      c.parent_id,                       -- solo el menor tiene acudiente; adulto/unreg → NULL
      e.child_id,
      e.user_id,
      e.unregistered_athlete_id,
      e.team_id,
      e.offering_plan_id,
      COALESCE(c.full_name, pr.full_name, ua.full_name, 'Atleta')    AS athlete_name,
      fee.amount                                                     AS amount
    FROM public.enrollments e
    LEFT JOIN public.children               c  ON c.id  = e.child_id
    LEFT JOIN public.profiles               pr ON pr.id = e.user_id
    LEFT JOIN public.unregistered_athletes  ua ON ua.id = e.unregistered_athlete_id
    LEFT JOIN public.teams                  t  ON t.id  = e.team_id
    CROSS JOIN LATERAL (
      -- Cuota manual (beca / descuento pactado): manda tal cual, sin caer a la
      -- cascada. Un becado con fee_is_manual=true y monthly_fee=0 queda con
      -- amount=0 y lo filtra el `fee.amount > 0` de abajo — no genera cobro.
      SELECT CASE
               WHEN e.fee_is_manual THEN COALESCE(e.monthly_fee, 0)
               ELSE COALESCE(
                 NULLIF(e.monthly_fee, 0),
                 NULLIF((SELECT op.price FROM public.offering_plans op WHERE op.id = e.offering_plan_id), 0),
                 NULLIF(t.price_monthly, 0),
                 NULLIF(c.monthly_fee, 0),
                 0
               )
             END AS amount
    ) fee
    WHERE e.school_id = p_school_id
      AND e.status = 'active'
      AND COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) IS NOT NULL
      AND fee.amount > 0
      AND (p_branch_id IS NULL OR COALESCE(c.branch_id, t.branch_id) = p_branch_id)
      -- PAUSA (D5/D6): el mes pausado no se cobra. Se pregunta a la TABLA de
      -- pausas, no a enrollments.paused_*, para que abrir un mes pasado dé el
      -- mismo resultado que dio en su momento.
      AND NOT EXISTS (
        SELECT 1 FROM public.enrollment_pause_requests r
        WHERE r.enrollment_id = e.id
          AND r.status = 'approved'
          AND v_month_start BETWEEN r.month_from AND r.month_to
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.payments p2
        WHERE p2.school_id = e.school_id
          AND p2.status IN ('pending','awaiting_approval','paid','partial','overdue','glosado')
          AND (
                (e.child_id IS NOT NULL AND p2.child_id = e.child_id)
             OR (e.child_id IS NULL AND e.user_id IS NOT NULL
                   AND (p2.user_id = e.user_id OR p2.parent_id = e.user_id))  -- adulto (incl. legacy en parent_id)
             OR (e.unregistered_athlete_id IS NOT NULL
                   AND p2.unregistered_athlete_id = e.unregistered_athlete_id)
          )
          AND (
                (p2.period_year = p_year AND p2.period_month = p_month)
             OR (p2.period_year IS NULL
                   AND p2.due_date >= v_month_start AND p2.due_date < v_month_end)  -- legacy sin periodo
          )
      )
    ORDER BY COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id),
             (e.offering_plan_id IS NOT NULL) DESC,   -- 1. el plan gobierna el cobro
             (e.team_id IS NOT NULL)          DESC,   -- 2. antes que una huérfana
             e.created_at ASC                         -- 3. la más antigua: carga el historial
  ),
  ins AS (
    INSERT INTO public.payments (
      school_id, branch_id, parent_id, child_id, user_id, unregistered_athlete_id,
      team_id, offering_plan_id, concept, amount, due_date, status, payment_type,
      period_year, period_month, payment_category
    )
    SELECT
      el.school_id,
      el.branch_id,
      el.parent_id,
      el.child_id,
      el.user_id,
      el.unregistered_athlete_id,
      el.team_id,
      el.offering_plan_id,
      'Mensualidad ' || to_char(v_due, 'MM/YYYY') || ' - ' || el.athlete_name,
      el.amount,
      v_due,
      'pending',
      'subscription',
      p_year::smallint,
      p_month::smallint,
      'mensualidad'
    FROM elegibles el
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_created FROM ins;

  RETURN jsonb_build_object(
    'school_id', p_school_id,
    'year',      p_year,
    'month',     p_month,
    'due_date',  v_due,
    'generados', v_created
  );
END;
$$;

COMMENT ON FUNCTION public.open_month(uuid, int, int, uuid) IS
  'Genera las cuotas del mes para una escuela por una sola vía canónica (period poblado, subscription, sin prorrateo, dedup por mes calendario, advisory lock). Un cobro por ATLETA: DISTINCT ON con desempate plan > equipo > más antigua, sin mirar el monto. fee_is_manual=true salta la cascada y respeta el monto puesto a mano, incluido 0 (becado). Desde 20260910074449 tampoco cobra los meses con una pausa aprobada que los cubra entera (vacaciones/lesión). Idempotente. OJO: no persiste ninguna apertura — monthly_closes no existe todavía.';

CREATE OR REPLACE FUNCTION public.preview_open_month(
  p_school_id uuid, p_year integer, p_month integer, p_branch_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_month_start date := make_date(p_year, p_month, 1);
  v_month_end   date := (make_date(p_year, p_month, 1) + interval '1 month')::date;
  v_cutoff      int;
  v_due         date;
  v_items       jsonb;
  v_caller      uuid := auth.uid();
BEGIN
  IF v_caller IS NOT NULL
     AND NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
    RAISE EXCEPTION 'No autorizado.';
  END IF;

  SELECT COALESCE(payment_cutoff_day, 10) INTO v_cutoff
  FROM public.school_settings WHERE school_id = p_school_id;
  v_cutoff := COALESCE(v_cutoff, 10);
  v_due := make_date(p_year, p_month, LEAST(v_cutoff, extract(day from (v_month_end - 1))::int));

  -- MISMO CTE que open_month. Si acá el criterio difiere, la pantalla de confirmación
  -- miente respecto de lo que se va a generar.
  WITH elegibles AS (
    SELECT DISTINCT ON (COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id))
      COALESCE(c.full_name, pr.full_name, ua.full_name, 'Atleta') AS athlete_name,
      CASE WHEN e.child_id IS NOT NULL THEN 'menor'
           WHEN e.user_id  IS NOT NULL THEN 'adulto'
           ELSE 'no_registrado' END                                AS tipo,
      fee.amount                                                   AS amount
    FROM public.enrollments e
    LEFT JOIN public.children               c  ON c.id  = e.child_id
    LEFT JOIN public.profiles               pr ON pr.id = e.user_id
    LEFT JOIN public.unregistered_athletes  ua ON ua.id = e.unregistered_athlete_id
    LEFT JOIN public.teams                  t  ON t.id  = e.team_id
    CROSS JOIN LATERAL (
      SELECT CASE
               WHEN e.fee_is_manual THEN COALESCE(e.monthly_fee, 0)
               ELSE COALESCE(
                 NULLIF(e.monthly_fee, 0),
                 NULLIF((SELECT op.price FROM public.offering_plans op WHERE op.id = e.offering_plan_id), 0),
                 NULLIF(t.price_monthly, 0),
                 NULLIF(c.monthly_fee, 0), 0)
             END AS amount
    ) fee
    WHERE e.school_id = p_school_id
      AND e.status = 'active'
      AND COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) IS NOT NULL
      AND fee.amount > 0
      AND (p_branch_id IS NULL OR COALESCE(c.branch_id, t.branch_id) = p_branch_id)
      -- PAUSA: mismo criterio que open_month.
      AND NOT EXISTS (
        SELECT 1 FROM public.enrollment_pause_requests r
        WHERE r.enrollment_id = e.id
          AND r.status = 'approved'
          AND v_month_start BETWEEN r.month_from AND r.month_to
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.payments p2
        WHERE p2.school_id = e.school_id
          AND p2.status IN ('pending','awaiting_approval','paid','partial','overdue','glosado')
          AND (
                (e.child_id IS NOT NULL AND p2.child_id = e.child_id)
             OR (e.child_id IS NULL AND e.user_id IS NOT NULL
                   AND (p2.user_id = e.user_id OR p2.parent_id = e.user_id))
             OR (e.unregistered_athlete_id IS NOT NULL
                   AND p2.unregistered_athlete_id = e.unregistered_athlete_id)
          )
          AND (
                (p2.period_year = p_year AND p2.period_month = p_month)
             OR (p2.period_year IS NULL AND p2.due_date >= v_month_start AND p2.due_date < v_month_end)
          )
      )
    ORDER BY COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id),
             (e.offering_plan_id IS NOT NULL) DESC,
             (e.team_id IS NOT NULL)          DESC,
             e.created_at ASC
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'athlete',  el.athlete_name,
           'tipo',     el.tipo,
           'amount',   el.amount,
           'due_date', v_due
         )), '[]'::jsonb)
  INTO v_items
  FROM elegibles el;

  RETURN jsonb_build_object(
    'school_id', p_school_id, 'year', p_year, 'month', p_month,
    'due_date', v_due,
    'count', jsonb_array_length(v_items),
    'items', v_items
  );
END;
$$;

COMMENT ON FUNCTION public.preview_open_month(uuid, int, int, uuid) IS
  'Preview de open_month, con el MISMO criterio de elegibilidad (incluida la exclusión de meses pausados desde 20260910074449). Si divergen, la pantalla de confirmación miente.';

COMMIT;

-- =============================================================================
-- ROLLBACK (manual, en una migración NUEVA — no editar esta):
--   · CREATE OR REPLACE de open_month/preview_open_month sin el NOT EXISTS de pausa.
--   · DROP FUNCTION resume_enrollment, pause_enrollment_directly,
--     reject_enrollment_pause, approve_enrollment_pause,
--     cancel_enrollment_pause_request, request_enrollment_pause,
--     preview_enrollment_pause, pause_validar, pause_aplicar,
--     pause_anular_cobros_del_periodo, enrollment_pausada_el, enrollment_pausada_en.
--   · DROP VIEW v_enrollment_pauses_effective.
--   · ALTER TABLE enrollments DROP CONSTRAINT enrollments_pause_request_id_fkey,
--     DROP COLUMN pause_request_id, DROP COLUMN paused_by.
--   · DROP TABLE enrollment_pause_requests.
--   · ALTER TABLE school_settings DROP COLUMN pause_enabled,
--     pause_max_months_per_year, pause_parent_can_request.
-- =============================================================================
