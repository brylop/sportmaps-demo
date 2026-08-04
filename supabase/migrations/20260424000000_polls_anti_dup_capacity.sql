-- =============================================================================
-- Encuestas de asistencia: anti doble-voto + enforcement de capacidad
-- Fecha: 2026-04-24
-- Motivacion:
--   1. El flujo publico de encuestas (links WhatsApp) permitia que un invitado
--      confirmara N veces la misma clase (poll_token no se validaba en DB).
--   2. max_capacity solo se chequeaba en el BFF con un count + insert: race
--      tipico que permitia overbooking bajo carga.
--   3. El constraint previo session_bookings_unique_user trataba NULLs como
--      iguales, bloqueando multiples invitados (ambos con user_id/child_id NULL)
--      en una misma sesion.
-- Estrategia:
--   - Indices UNIQUE parciales por cada tipo de identidad (user / child / guest).
--     Funciona solo cuando el campo esta presente, no interfiere con NULLs.
--   - Trigger BEFORE INSERT con FOR UPDATE sobre attendance_sessions para
--     serializar inserciones concurrentes sobre la misma sesion.
-- =============================================================================

BEGIN;

-- ── 1. Reemplazar el constraint conflictivo con NULLs no-distintos ───────────
-- El constraint previo bloquea 2 invitados anonimos (ambos con user_id/child_id
-- NULL) en la misma sesion, lo cual rompe el flujo publico de la encuesta.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'session_bookings_unique_user'
  ) THEN
    ALTER TABLE public.session_bookings
      DROP CONSTRAINT session_bookings_unique_user;
  END IF;
END $$;

-- ── 2. Indices UNIQUE parciales — anti doble-voto por tipo de identidad ──────
CREATE UNIQUE INDEX IF NOT EXISTS session_bookings_unique_user_idx
  ON public.session_bookings(session_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS session_bookings_unique_child_idx
  ON public.session_bookings(session_id, child_id)
  WHERE child_id IS NOT NULL;

-- Solo aplica si la columna existe en la tabla (creada fuera de este repo).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'session_bookings'
      AND column_name = 'unregistered_athlete_id'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS session_bookings_unique_guest_idx
             ON public.session_bookings(session_id, unregistered_athlete_id)
             WHERE unregistered_athlete_id IS NOT NULL';
  END IF;
END $$;

-- Token anti doble-voto por escuela
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'unregistered_athletes'
      AND column_name = 'poll_token'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS unregistered_athletes_token_idx
             ON public.unregistered_athletes(school_id, poll_token)
             WHERE poll_token IS NOT NULL';
  END IF;
END $$;

-- ── 3. Trigger de capacidad — serializa con FOR UPDATE ───────────────────────
CREATE OR REPLACE FUNCTION public.enforce_session_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  cap           int;
  current_cnt   int;
BEGIN
  -- Solo cuenta status = 'confirmed'
  IF NEW.status IS DISTINCT FROM 'confirmed' THEN
    RETURN NEW;
  END IF;

  -- Lock de la fila de la sesion: serializa inserts concurrentes sobre la
  -- misma session_id mientras dure la transaccion.
  SELECT max_capacity INTO cap
  FROM public.attendance_sessions
  WHERE id = NEW.session_id
  FOR UPDATE;

  IF cap IS NULL THEN
    -- Sesion inexistente: dejar que el FK falle con mensaje propio
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO current_cnt
  FROM public.session_bookings
  WHERE session_id = NEW.session_id
    AND status     = 'confirmed'
    AND id        IS DISTINCT FROM NEW.id;   -- excluye el propio row en UPDATE

  IF current_cnt >= cap THEN
    RAISE EXCEPTION 'La sesion ya alcanzo su capacidad maxima (%).', cap
      USING ERRCODE = '23514';  -- check_violation
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_session_bookings_capacity ON public.session_bookings;
CREATE TRIGGER trg_session_bookings_capacity
  BEFORE INSERT OR UPDATE OF status, session_id ON public.session_bookings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_session_capacity();

COMMIT;
