-- =============================================================================
-- 20261020111232_cortesia_unica_besser.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-20   Versión anterior: 20261017123746
-- Objetivo: la semana de cortesía por QR es ÚNICA por deportista (Besser).
-- =============================================================================
-- Por qué: el QR `besser-cortesia` (sin cobro inicial) crea la inscripción 'active'
--   sin cuota. Si esa inscripción se cancelaba, el mismo deportista podía volver a
--   registrarse por el mismo QR y tomar otra semana gratis. Además el QR de pago
--   `besser-inscripciones` lista el plan «CORTESÍA» ($0): quien se inscribía por ahí
--   quedaba gratis sin pasar por el control.
--
-- Qué cambia (todo detrás de UN flag por escuela, apagado por defecto):
--   1. school_settings.cortesia_unica (boolean, default false). Besser = true.
--   2. submit_qr_signup (12 y 13 args): si el QR NO cobra (require_first_payment=false
--      y accept_payments=false), la escuela tiene el flag y el deportista YA tiene
--      alguna inscripción en la escuela (de cualquier estado), no crea otra: lanza
--      23505 con el mensaje para que use el enlace de inscripción. Una inscripción
--      que ya existe sigue su camino de siempre (idempotente).
--   3. get_join_qr_public: en un QR que cobra, con el flag, no lista planes de $0.
--
-- Cómo: se parchean los cuerpos VIVOS (pg_get_functiondef) en vez de pegarlos
--   completos. Cada ancla debe aparecer exactamente UNA vez y el md5 vivo debe ser
--   el de la migración 20261014113038 (12/13 args); si no, aborta. ACL intacta:
--   CREATE OR REPLACE la conserva y se verifica.
-- Radio: solo escuelas con el flag (Besser). Las demás no cambian.
-- Revertir: update school_settings set cortesia_unica=false (efecto inmediato);
--   o CREATE OR REPLACE con los cuerpos de 20261014113038.
-- =============================================================================

BEGIN;

ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS cortesia_unica boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.school_settings.cortesia_unica IS
  'true: la semana de cortesía por QR sin cobro es única por deportista, y los QR que cobran no listan planes de $0.';

UPDATE public.school_settings
   SET cortesia_unica = true
 WHERE school_id = '759eee9d-05cb-4958-b84a-2560f77e3683';   -- Club Deportivo Besser

DO $patch$
DECLARE
  r record;
  v_def text; v_new text; v_n int; v_acl_after text;
  v_esperado text;
  -- 1) submit_qr_signup: ancla = el INSERT de la inscripción nueva, dentro de su IF.
  v_ancla_ins constant text :=
    E'    IF v_enrollment_id IS NULL THEN\n        INSERT INTO public.enrollments (user_id, child_id, school_id, team_id, offering_plan_id, monthly_fee, start_date, status)';
  v_bloque constant text :=
    E'    IF v_enrollment_id IS NULL THEN\n'
    || E'        -- 20261020: cortesía única (school_settings.cortesia_unica).\n'
    || E'        IF NOT v_qr.require_first_payment AND COALESCE(v_qr.accept_payments, false) = false\n'
    || E'           AND EXISTS (SELECT 1 FROM public.school_settings ss WHERE ss.school_id = v_school_id AND ss.cortesia_unica)\n'
    || E'           AND EXISTS (SELECT 1 FROM public.enrollments e0 WHERE e0.child_id = v_child_id AND e0.school_id = v_school_id) THEN\n'
    || E'            RAISE EXCEPTION ''Este deportista ya tuvo su semana de cortesía en %. Para continuar, inscríbelo con el enlace de inscripción de la escuela.'',\n'
    || E'                COALESCE(v_school_name, ''la escuela'') USING ERRCODE = ''23505'';\n'
    || E'        END IF;\n'
    || E'        INSERT INTO public.enrollments (user_id, child_id, school_id, team_id, offering_plan_id, monthly_fee, start_date, status)';
  -- 3) get_join_qr_public: ancla = el WHERE de la lista de planes del QR abierto.
  v_ancla_plan constant text :=
    E'WHERE op.school_id = v_qr.school_id AND op.is_active = true AND o.is_active = true\n          AND o.offering_type IN (''membership'',''session_pack'',''single_session'') LIMIT 50;';
  v_nuevo_plan constant text :=
    E'WHERE op.school_id = v_qr.school_id AND op.is_active = true AND o.is_active = true\n          AND o.offering_type IN (''membership'',''session_pack'',''single_session'')\n'
    || E'          -- 20261020: un QR que cobra no ofrece el plan de cortesía ($0) si la escuela tiene cortesía única.\n'
    || E'          AND NOT (v_qr.require_first_payment AND COALESCE(op.price, 0) = 0\n'
    || E'                   AND EXISTS (SELECT 1 FROM public.school_settings ss WHERE ss.school_id = v_qr.school_id AND ss.cortesia_unica))\n'
    || E'          LIMIT 50;';
BEGIN
  -- ── submit_qr_signup: las dos variantes vivas ──────────────────────────────
  FOR r IN
    SELECT p.oid, p.pronargs, p.proacl::text AS acl, md5(replace(p.prosrc, E'\r', '')) AS m
      FROM pg_proc p
     WHERE p.proname = 'submit_qr_signup' AND p.pronamespace = 'public'::regnamespace
       AND p.pronargs IN (12, 13)
  LOOP
    v_esperado := CASE r.pronargs WHEN 12 THEN '4eae0c15606e8cdba1ae102b379f5bf5'
                                  ELSE 'cced5836c5af7f5e48e1648700ef9dfa' END;
    IF r.m IS DISTINCT FROM v_esperado THEN
      RAISE EXCEPTION 'submit_qr_signup (% args) cambió en la base: md5 % (esperado %). Re-leer el cuerpo vivo.', r.pronargs, r.m, v_esperado;
    END IF;
    v_def := replace(pg_get_functiondef(r.oid), E'\r', '');
    v_n := (length(v_def) - length(replace(v_def, v_ancla_ins, ''))) / length(v_ancla_ins);
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'submit_qr_signup (% args): el ancla del INSERT aparece % veces (esperado 1)', r.pronargs, v_n;
    END IF;
    v_new := replace(v_def, v_ancla_ins, v_bloque);
    EXECUTE v_new;
    SELECT proacl::text INTO v_acl_after FROM pg_proc WHERE oid = r.oid;
    IF v_acl_after IS DISTINCT FROM r.acl THEN
      RAISE EXCEPTION 'submit_qr_signup (% args): la ACL cambió (% → %)', r.pronargs, r.acl, v_acl_after;
    END IF;
  END LOOP;

  -- ── get_join_qr_public ─────────────────────────────────────────────────────
  SELECT p.oid, p.proacl::text AS acl INTO r
    FROM pg_proc p
   WHERE p.proname = 'get_join_qr_public' AND p.pronamespace = 'public'::regnamespace;
  v_def := replace(pg_get_functiondef(r.oid), E'\r', '');
  v_n := (length(v_def) - length(replace(v_def, v_ancla_plan, ''))) / length(v_ancla_plan);
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'get_join_qr_public: el ancla de planes aparece % veces (esperado 1)', v_n;
  END IF;
  EXECUTE replace(v_def, v_ancla_plan, v_nuevo_plan);
  SELECT proacl::text INTO v_acl_after FROM pg_proc WHERE oid = r.oid;
  IF v_acl_after IS DISTINCT FROM r.acl THEN
    RAISE EXCEPTION 'get_join_qr_public: la ACL cambió (% → %)', r.acl, v_acl_after;
  END IF;
END
$patch$;

-- Verificación: las tres funciones quedaron con el parche.
DO $post$
DECLARE v_ok int;
BEGIN
  SELECT count(*) INTO v_ok FROM pg_proc
   WHERE proname = 'submit_qr_signup' AND pronamespace = 'public'::regnamespace
     AND pronargs IN (12, 13) AND prosrc LIKE '%school_settings ss WHERE ss.school_id = v_school_id AND ss.cortesia_unica%';
  IF v_ok <> 2 THEN RAISE EXCEPTION 'submit_qr_signup: el parche quedó en % de 2 variantes', v_ok; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_join_qr_public' AND pronamespace = 'public'::regnamespace
                    AND prosrc LIKE '%ss.cortesia_unica%') THEN
    RAISE EXCEPTION 'get_join_qr_public: el parche no quedó';
  END IF;
END
$post$;

COMMIT;

NOTIFY pgrst, 'reload schema';
