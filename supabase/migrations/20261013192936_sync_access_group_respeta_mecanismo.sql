-- =============================================================================
-- 20261013192936_sync_access_group_respeta_mecanismo.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261013192915
-- Objetivo (spec docs/specs/dreamers-cierre-total.md F1): el trigger
--   fn_sync_access_group_on_payment (AFTER UPDATE OF status ON payments)
--   · buscaba el PIN solo por user_id / unregistered_athlete_id → nunca
--     encontraba a los menores (child_id), que son casi todos en Dreamers;
--   · mandaba set_group aunque la escuela use access_block_mechanism='disable'
--     (MB360 sin Grupos: el comando no bloquea ni desbloquea nada);
--   · actuaba aunque la escuela tuviera apagado access_auto_block_overdue_enabled;
--   · desbloqueaba al pagar UN cobro aunque quedaran otras mensualidades vencidas,
--     contradiciendo al job de 15 min (que lo volvía a bloquear).
--
--   Ahora replica las reglas de bff/src/jobs/access-auto-block.job.ts (+
--   bff/src/utils/accessBlockMechanism.ts), que sigue siendo la reconciliación
--   completa; el trigger solo adelanta el comando:
--   · no-op si access_auto_block_overdue_enabled no es true;
--   · identidad como athleteKey(): child_id → user_id → unregistered_athlete_id;
--   · mecanismo: 'disable' → disable_user/enable_user {pin}; otro → set_group
--     {pin, group 2|1};
--   · bloquea al pasar a 'overdue'; salvo excepción manual de HOY (comando de
--     desbloqueo con issued_by NOT NULL desde las 00:00 Bogotá);
--   · desbloquea al salir de 'overdue' (paid, awaiting_approval, …) solo si ya
--     no le queda ninguna mensualidad 'overdue' a esa identidad;
--   · no encola si ya hay uno igual 'pending' de los últimos 30 min (en vuelo).
--
-- Cuerpo VIVO de producción (md5 sin CR dd95366f8383b7843d71230205783285).
-- ACL viva: EXECUTE solo postgres y service_role (es función de trigger). Se conserva.
-- El trigger trg_sync_access_group_on_payment no cambia.
-- =============================================================================

BEGIN;

DO $guard$
DECLARE
    v_md5 text;
BEGIN
    SELECT md5(replace(p.prosrc, E'\r', '')) INTO v_md5
      FROM pg_proc p
     WHERE p.oid = 'public.fn_sync_access_group_on_payment()'::regprocedure;
    IF v_md5 IS DISTINCT FROM 'dd95366f8383b7843d71230205783285'
       AND v_md5 IS DISTINCT FROM '8c3cc9c9f27801e0f0dd35f2bfa50f1d' THEN
        RAISE EXCEPTION 'fn_sync_access_group_on_payment cambió en la base (md5 %); revisar antes de reemplazar', v_md5;
    END IF;
END
$guard$;

CREATE OR REPLACE FUNCTION public.fn_sync_access_group_on_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_zk_pin     INTEGER;
  v_action     text;
  v_enabled    boolean;
  v_mechanism  text;
  v_cmd_type   text;
  v_metadata   jsonb;
  v_day_start  timestamptz;
  v_device     RECORD;
BEGIN
  -- (20261010143132) el acceso solo lo mueve la mensualidad. Un cobro único
  -- (torneo, artículo, inscripción…) ni bloquea ni desbloquea.
  IF COALESCE(NEW.payment_category, 'mensualidad') <> 'mensualidad' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'overdue' AND (OLD.status IS DISTINCT FROM 'overdue') THEN
    v_action := 'block';
  ELSIF OLD.status = 'overdue' AND NEW.status IS DISTINCT FROM 'overdue' THEN
    v_action := 'unblock';
  ELSE
    RETURN NEW;
  END IF;

  -- (20261013192936) mismo interruptor que el job de bloqueo por mora.
  SELECT COALESCE(ss.access_auto_block_overdue_enabled, false),
         CASE WHEN ss.access_block_mechanism = 'disable' THEN 'disable' ELSE 'group' END
    INTO v_enabled, v_mechanism
    FROM public.school_settings ss
   WHERE ss.school_id = NEW.school_id;

  IF NOT COALESCE(v_enabled, false) THEN
    RETURN NEW;
  END IF;

  -- Identidad como athleteKey() del BFF: menor → adulto → atleta sin cuenta.
  SELECT m.zk_pin INTO v_zk_pin
    FROM public.zk_user_mappings m
   WHERE m.school_id = NEW.school_id
     AND CASE
           WHEN NEW.child_id IS NOT NULL THEN m.child_id = NEW.child_id
           WHEN NEW.user_id IS NOT NULL THEN m.user_id = NEW.user_id
           WHEN NEW.unregistered_athlete_id IS NOT NULL THEN m.unregistered_athlete_id = NEW.unregistered_athlete_id
           ELSE false
         END
   LIMIT 1;

  IF v_zk_pin IS NULL THEN
    RETURN NEW;
  END IF;

  v_day_start := date_trunc('day', now() AT TIME ZONE 'America/Bogota') AT TIME ZONE 'America/Bogota';

  IF v_action = 'block' THEN
    -- Excepción manual de UN día: un admin lo habilitó hoy desde Control de acceso.
    IF EXISTS (
      SELECT 1 FROM public.device_commands dc
       WHERE dc.school_id = NEW.school_id
         AND dc.issued_by IS NOT NULL
         AND dc.issued_at >= v_day_start
         AND (dc.metadata->>'pin') = v_zk_pin::text
         AND (dc.command_type = 'enable_user'
              OR (dc.command_type = 'set_group' AND (dc.metadata->>'group') = '1'))
    ) THEN
      RETURN NEW;
    END IF;
  ELSE
    -- Solo se desbloquea si ya no le queda ninguna mensualidad vencida.
    IF EXISTS (
      SELECT 1 FROM public.payments p
       WHERE p.school_id = NEW.school_id
         AND p.id <> NEW.id
         AND p.status = 'overdue'
         AND COALESCE(p.payment_category, 'mensualidad') = 'mensualidad'
         AND CASE
               WHEN NEW.child_id IS NOT NULL THEN p.child_id = NEW.child_id
               WHEN NEW.user_id IS NOT NULL THEN p.child_id IS NULL AND p.user_id = NEW.user_id
               ELSE p.child_id IS NULL AND p.user_id IS NULL
                    AND p.unregistered_athlete_id = NEW.unregistered_athlete_id
             END
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Mismo comando que buildBlockCommand() (bff/src/utils/accessBlockMechanism.ts).
  IF v_mechanism = 'disable' THEN
    v_cmd_type := CASE WHEN v_action = 'block' THEN 'disable_user' ELSE 'enable_user' END;
    v_metadata := jsonb_build_object('pin', v_zk_pin, 'reason', 'overdue_trigger');
  ELSE
    v_cmd_type := 'set_group';
    v_metadata := jsonb_build_object('pin', v_zk_pin,
                                     'group', CASE WHEN v_action = 'block' THEN 2 ELSE 1 END,
                                     'reason', 'overdue_trigger');
  END IF;

  FOR v_device IN
    SELECT id, direction FROM public.turnstile_devices
    WHERE school_id = NEW.school_id AND is_active = true
  LOOP
    -- En vuelo: ya hay uno igual encolado hace menos de 30 min.
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.device_commands dc
       WHERE dc.school_id = NEW.school_id
         AND dc.device_id = v_device.id
         AND dc.command_type = v_cmd_type
         AND dc.status = 'pending'
         AND dc.expires_at > now()
         AND dc.issued_at >= now() - interval '30 minutes'
         AND (dc.metadata->>'pin') = v_zk_pin::text
         AND COALESCE(dc.metadata->>'group', '') = COALESCE(v_metadata->>'group', '')
    );

    INSERT INTO public.device_commands (school_id, device_id, command_type, direction, status, expires_at, metadata)
    VALUES (
      NEW.school_id, v_device.id, v_cmd_type,
      CASE WHEN v_device.direction = 'both' THEN 'entry' ELSE v_device.direction END,
      'pending', NOW() + interval '24 hours',
      v_metadata
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

-- ACL viva: EXECUTE solo postgres y service_role.
REVOKE ALL ON FUNCTION public.fn_sync_access_group_on_payment() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_sync_access_group_on_payment() TO service_role;

COMMIT;
