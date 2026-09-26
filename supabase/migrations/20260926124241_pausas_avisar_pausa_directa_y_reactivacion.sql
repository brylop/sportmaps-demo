-- =============================================================================
-- 20260926124241_pausas_avisar_pausa_directa_y_reactivacion.sql
-- Autor: brylop   Fecha: 2026-09-26   Versión anterior: 20260925140545
-- Objetivo: cerrar los dos huecos de aviso del módulo de pausas. Hoy la familia
--           SÍ se entera cuando la escuela aprueba o rechaza su solicitud (lo
--           hacen approve_enrollment_pause / reject_enrollment_pause) y la
--           escuela SÍ se entera cuando el acudiente solicita
--           (request_enrollment_pause). Pero NADIE le avisa a la familia cuando:
--             (a) la escuela pausa directo con su botón
--                 (pause_enrollment_directly → fila 'approved' con source='admin'), ni
--             (b) la escuela reactiva antes de tiempo (resume_enrollment → resumed_at).
--           Pedido de Athletic League (2026-09-25): "decisiones sobre pausas".
--           (La 20260925140545 quedó como esqueleto vacío por un commit cruzado
--           entre sesiones; el contenido real vive acá.)
-- =============================================================================
-- Cómo funciona:
--   · Trigger AFTER INSERT OR UPDATE en enrollment_pause_requests.
--   · INSERT: solo si nace 'approved' con source='admin' (pausa directa). Las
--     solicitudes ('pending') ya avisan a la escuela desde la RPC, y su
--     aprobación/rechazo ya avisan a quien pidió desde las RPCs: no se duplica.
--   · UPDATE: solo cuando resumed_at pasa de NULL a un valor (reactivación).
--   · Destinatario: acudiente del menor (children.parent_id) o el atleta adulto
--     (user_id). Atleta no registrado → no hay a quién avisar. Nunca se avisa a
--     quien hizo la acción (admin pausando a su propio hijo).
--   · Escribe en public.notifications con category='enrollment' (ya en el
--     CHECK) y link '/children', igual que las RPCs. In-app + push.
--   · Un fallo del aviso queda como WARNING y no bloquea la pausa.
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_notify_pause_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_user    uuid;
  v_nombre  text;
  v_school  text;
  v_meses   text;
  v_motivo  text;
  v_titulo  text;
  v_mensaje text;
  v_op      text;
BEGIN
  -- ¿Qué pasó? Solo dos hechos interesan acá.
  IF TG_OP = 'INSERT' THEN
    IF NOT (NEW.status = 'approved' AND NEW.source = 'admin') THEN
      RETURN NULL;
    END IF;
    v_op := 'paused_by_admin';
  ELSE
    IF NOT (OLD.resumed_at IS NULL AND NEW.resumed_at IS NOT NULL) THEN
      RETURN NULL;
    END IF;
    v_op := 'resumed';
  END IF;

  -- ¿A quién? Acudiente del menor o el atleta adulto.
  IF NEW.child_id IS NOT NULL THEN
    SELECT c.parent_id, c.full_name INTO v_user, v_nombre
      FROM public.children c WHERE c.id = NEW.child_id;
  ELSIF NEW.user_id IS NOT NULL THEN
    v_user := NEW.user_id;
    SELECT p.full_name INTO v_nombre FROM public.profiles p WHERE p.id = NEW.user_id;
  END IF;
  IF v_user IS NULL THEN
    RETURN NULL;  -- no registrado o menor sin acudiente vinculado
  END IF;
  -- Quien hizo la acción no necesita que le avisen de lo que acaba de hacer.
  IF (v_op = 'paused_by_admin' AND NEW.requested_by = v_user)
     OR (v_op = 'resumed' AND NEW.resumed_by = v_user) THEN
    RETURN NULL;
  END IF;

  BEGIN
    SELECT btrim(name) INTO v_school FROM public.schools WHERE id = NEW.school_id;
    v_nombre := COALESCE(NULLIF(btrim(v_nombre), ''), 'el atleta');
    v_meses  := CASE
                  WHEN NEW.month_from = NEW.month_to THEN to_char(NEW.month_from, 'MM/YYYY')
                  ELSE to_char(NEW.month_from, 'MM/YYYY') || ' a ' || to_char(NEW.month_to, 'MM/YYYY')
                END;
    v_motivo := CASE NEW.reason
                  WHEN 'vacation' THEN 'vacaciones'
                  WHEN 'injury'   THEN 'lesión'
                  ELSE 'otro motivo'
                END;

    IF v_op = 'paused_by_admin' THEN
      v_titulo  := '🏖️ Inscripción en pausa: ' || v_nombre;
      v_mensaje := v_school || ' pausó la inscripción de ' || v_nombre
                   || ' por ' || v_motivo || ' durante ' || v_meses
                   || '. Esos meses no se cobran.'
                   || COALESCE(' Nota: ' || NULLIF(btrim(NEW.reason_note), ''), '');
    ELSE
      v_titulo  := '▶️ Inscripción reactivada: ' || v_nombre;
      v_mensaje := v_school || ' reactivó la inscripción de ' || v_nombre
                   || ' desde hoy. Ya vuelve a la lista de asistencia.'
                   || CASE WHEN COALESCE(NEW.days_extended, 0) > 0
                           THEN ' Se le suman ' || NEW.days_extended || ' día(s) de vigencia que no usó.'
                           ELSE '' END;
    END IF;

    INSERT INTO public.notifications (user_id, school_id, type, category, title, message, link, data)
    VALUES (v_user, NEW.school_id, 'info', 'enrollment', v_titulo, v_mensaje, '/children',
            jsonb_build_object('pause_request_id', NEW.id, 'enrollment_id', NEW.enrollment_id,
                               'op', v_op, 'month_from', NEW.month_from, 'month_to', NEW.month_to));
  EXCEPTION WHEN OTHERS THEN
    -- Nunca bloquear la pausa por un aviso: queda en el log y se sigue.
    RAISE WARNING '[pausas] aviso a la familia falló (% %): %', TG_OP, NEW.id, SQLERRM;
  END;

  RETURN NULL;  -- AFTER trigger: el valor de retorno se ignora.
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_pause_decision ON public.enrollment_pause_requests;
CREATE TRIGGER trg_notify_pause_decision
  AFTER INSERT OR UPDATE ON public.enrollment_pause_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_pause_decision();

COMMIT;

-- Verificación:
--   select tgname, tgenabled from pg_trigger where tgname = 'trg_notify_pause_decision';
--   -- pausar directo desde la app (botón del admin) y luego reactivar; mirar
--   -- public.notifications where category = 'enrollment' order by created_at desc;
