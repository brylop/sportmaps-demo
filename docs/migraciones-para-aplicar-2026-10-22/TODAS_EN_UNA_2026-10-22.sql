-- =============================================================================
-- TODAS LAS MIGRACIONES PENDIENTES EN UN SOLO ARCHIVO - 2026-10-22
-- Verificado contra la base viva el 2026-10-23: son las unicas con objetos que faltan.
-- Cada bloque va en su propia transaccion; si uno falla, los demas siguen.
-- Ejecutar en el SQL editor de Supabase (o por la CLI) en este orden.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 20261021214856_tienda_avisar_pedido_nuevo_a_la_tienda.sql
-- Otra sesion (tienda): avisar al local un pedido nuevo.
-- ---------------------------------------------------------------------------
BEGIN;
-- La tienda no se enteraba de los pedidos: ningún trigger de `orders` escribía en `notifications`.
-- Se avisa (campana + push por el despachador, que ya reacciona a cada INSERT en notifications) en tres momentos:
--   1. Pedido nuevo con pago en efectivo al retirar (nace en pending_payment y se cobra en la sede).
--   2. Comprobante subido (pending_payment → awaiting_approval): hay que revisarlo.
--   3. Pedido pagado por otra vía (tarjeta / transferencia aprobada): hay que alistarlo.
-- Los pedidos de tarjeta o transferencia recién creados NO avisan: son carritos y la mayoría se abandona.
-- Un fallo al avisar nunca bloquea el pedido.

CREATE OR REPLACE FUNCTION public._notify_store_order(p_order_id uuid, p_event text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_o        public.orders%ROWTYPE;
    v_school   uuid;
    v_owner    uuid;
    v_buyer    text;
    v_title    text;
    v_message  text;
    v_data     jsonb;
    v_money    text;
BEGIN
    SELECT * INTO v_o FROM public.orders WHERE id = p_order_id;
    IF v_o.id IS NULL OR v_o.vendor_profile_id IS NULL THEN RETURN; END IF;

    SELECT school_id, user_id INTO v_school, v_owner
      FROM public.vendor_profiles WHERE id = v_o.vendor_profile_id;

    v_buyer := COALESCE(
        NULLIF(btrim(v_o.customer_name), ''),
        (SELECT full_name FROM public.profiles WHERE id = v_o.user_id),
        'Un cliente');
    v_money := '$' || replace(to_char(v_o.total_amount, 'FM999G999G999'), ',', '.');

    v_title := CASE p_event
        WHEN 'new_cash'         THEN 'Pedido nuevo: cobra al retirar'
        WHEN 'receipt_to_check' THEN 'Comprobante por revisar'
        WHEN 'paid'             THEN 'Pedido pagado: alístalo'
        ELSE NULL END;
    IF v_title IS NULL THEN RETURN; END IF;

    v_message := v_buyer || ' · ' || v_money || ' · ' || COALESCE(v_o.reference, '');
    v_data := jsonb_build_object(
        'order_id', v_o.id, 'reference', v_o.reference,
        'vendor_profile_id', v_o.vendor_profile_id, 'amount', v_o.total_amount, 'event', p_event);

    IF v_school IS NOT NULL THEN
        PERFORM public._notify_school_staff(v_school, 'marketplace', 'info', v_title, v_message, '/orders', v_data);
    ELSIF v_owner IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, link, category, data)
        VALUES (v_owner, v_title, v_message, 'info', '/orders', 'marketplace', v_data);
    END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_orders_notify_store()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_event text;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.payment_method = 'cash_pickup' AND NEW.status = 'pending_payment' THEN
            v_event := 'new_cash';
        END IF;
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
        IF NEW.status = 'awaiting_approval' THEN
            v_event := 'receipt_to_check';
        ELSIF NEW.status = 'paid' AND NEW.payment_method IS DISTINCT FROM 'cash_pickup' THEN
            v_event := 'paid';
        END IF;
    END IF;

    IF v_event IS NOT NULL THEN
        BEGIN
            PERFORM public._notify_store_order(NEW.id, v_event);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'fn_orders_notify_store: no se pudo avisar del pedido % (%)', NEW.id, SQLERRM;
        END;
    END IF;
    RETURN NEW;
END;
$function$;

-- Solo las llama el trigger: ni anon ni authenticated.
REVOKE ALL ON FUNCTION public._notify_store_order(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_orders_notify_store() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_orders_notify_store ON public.orders;
CREATE TRIGGER trg_orders_notify_store
    AFTER INSERT OR UPDATE OF status ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.fn_orders_notify_store();
COMMIT;

-- ---------------------------------------------------------------------------
-- 20261022110209_reporte_partido_entrenador_admin_familia.sql
-- Esta sesion (Besser): reporte del partido entrenador + admin + familia.
-- ---------------------------------------------------------------------------
BEGIN;
-- =============================================================================
-- 20261022110209_reporte_partido_entrenador_admin_familia.sql
-- Pedido de CLUB DEPORTIVO BESSER (2026-10-22): el entrenador deja un reporte
-- general del partido (resumen, desarrollo, aspectos a mejorar); la
-- administración lo ve y agrega su propio comentario; ambos se PUBLICAN juntos
-- a las familias, que responden en un espacio aparte (una respuesta por persona).
--
-- Diseño:
--  * El reporte NO va en columnas de match_results: RLS filtra FILAS, no
--    columnas, y la familia ya lee match_results. Tabla propia match_reports,
--    legible solo por el staff; la familia lo recibe por RPC y solo publicado.
--  * Escritura solo por RPC SECURITY DEFINER (sin policies de escritura).
--  * Flag school_settings.share_match_reports, apagado por defecto. Encendido
--    en Besser al final de esta migración.
--  * Respuesta de la familia: match_report_replies, UNIQUE(match_id, author_id).
--
-- Rollback: DROP de las 4 RPCs, las 2 tablas y la columna del flag.
-- =============================================================================

SET LOCAL lock_timeout = '5s';

-- ─── 1. Flag por escuela ────────────────────────────────────────────────────
ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS share_match_reports boolean NOT NULL DEFAULT false;

-- ─── 2. match_reports ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.match_reports (
  match_id         uuid PRIMARY KEY REFERENCES public.match_results(id) ON DELETE CASCADE,
  school_id        uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  summary          text,
  development      text,
  improvements     text,
  coach_id         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_comment    text,
  admin_comment_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_comment_at timestamptz,
  published_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_reports_len CHECK (
    char_length(coalesce(summary, ''))       <= 4000 AND
    char_length(coalesce(development, ''))   <= 4000 AND
    char_length(coalesce(improvements, ''))  <= 4000 AND
    char_length(coalesce(admin_comment, '')) <= 4000
  )
);
CREATE INDEX IF NOT EXISTS idx_match_reports_school ON public.match_reports (school_id, updated_at DESC);

ALTER TABLE public.match_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS match_reports_select_staff ON public.match_reports;
CREATE POLICY match_reports_select_staff ON public.match_reports FOR SELECT TO authenticated
  USING ((SELECT public.is_platform_admin())
         OR school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[]));
REVOKE ALL ON TABLE public.match_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.match_reports TO authenticated;

-- ─── 3. match_report_replies ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.match_report_replies (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id   uuid NOT NULL REFERENCES public.match_results(id) ON DELETE CASCADE,
  school_id  uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body       text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, author_id)
);
CREATE INDEX IF NOT EXISTS idx_match_report_replies_match ON public.match_report_replies (match_id);

ALTER TABLE public.match_report_replies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS match_report_replies_select ON public.match_report_replies;
CREATE POLICY match_report_replies_select ON public.match_report_replies FOR SELECT TO authenticated
  USING ((SELECT public.is_platform_admin())
         OR school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[])
         OR author_id = (SELECT auth.uid()));
REVOKE ALL ON TABLE public.match_report_replies FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.match_report_replies TO authenticated;

-- ─── 4. RPCs ────────────────────────────────────────────────────────────────
-- save_match_report: entrenador o administración (staff de la escuela).
CREATE OR REPLACE FUNCTION public.save_match_report(p_match uuid, p jsonb)
RETURNS public.match_reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  m public.match_results;
  r public.match_reports;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO m FROM public.match_results WHERE id = p_match;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partido no encontrado' USING ERRCODE = '02000'; END IF;
  IF NOT (m.school_id = ANY (public.user_staff_school_ids()) OR public.is_platform_admin()) THEN
    RAISE EXCEPTION 'Sin permiso sobre esta escuela' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.match_reports (match_id, school_id, summary, development, improvements, coach_id)
  VALUES (p_match, m.school_id,
          NULLIF(btrim(p->>'summary'), ''),
          NULLIF(btrim(p->>'development'), ''),
          NULLIF(btrim(p->>'improvements'), ''),
          v_uid)
  ON CONFLICT (match_id) DO UPDATE SET
    summary      = NULLIF(btrim(p->>'summary'), ''),
    development  = NULLIF(btrim(p->>'development'), ''),
    improvements = NULLIF(btrim(p->>'improvements'), ''),
    coach_id     = COALESCE(public.match_reports.coach_id, v_uid),
    updated_at   = now()
  RETURNING * INTO r;
  RETURN r;
END;
$$;

-- save_match_admin_comment: SOLO la administración de la escuela.
CREATE OR REPLACE FUNCTION public.save_match_admin_comment(p_match uuid, p_comment text)
RETURNS public.match_reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  m public.match_results;
  v_text text := NULLIF(btrim(p_comment), '');
  r public.match_reports;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO m FROM public.match_results WHERE id = p_match;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partido no encontrado' USING ERRCODE = '02000'; END IF;
  IF NOT (m.school_id = ANY (public.user_admin_school_ids()) OR public.is_platform_admin()) THEN
    RAISE EXCEPTION 'Solo la administración de la escuela comenta el reporte' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.match_reports (match_id, school_id, admin_comment, admin_comment_by, admin_comment_at)
  VALUES (p_match, m.school_id, v_text,
          CASE WHEN v_text IS NULL THEN NULL ELSE v_uid END,
          CASE WHEN v_text IS NULL THEN NULL ELSE now() END)
  ON CONFLICT (match_id) DO UPDATE SET
    admin_comment    = v_text,
    admin_comment_by = CASE WHEN v_text IS NULL THEN NULL ELSE v_uid END,
    admin_comment_at = CASE WHEN v_text IS NULL THEN NULL ELSE now() END,
    updated_at       = now()
  RETURNING * INTO r;
  RETURN r;
END;
$$;

-- publish_match_report: el reporte del entrenador y el comentario del admin
-- salen JUNTOS (un solo published_at). Despublicar los oculta a los dos.
CREATE OR REPLACE FUNCTION public.publish_match_report(p_match uuid, p_publish boolean)
RETURNS public.match_reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  r public.match_reports;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM public.match_reports WHERE match_id = p_match;
  IF NOT FOUND THEN RAISE EXCEPTION 'El partido todavía no tiene reporte' USING ERRCODE = '02000'; END IF;
  IF NOT (r.school_id = ANY (public.user_staff_school_ids()) OR public.is_platform_admin()) THEN
    RAISE EXCEPTION 'Sin permiso sobre esta escuela' USING ERRCODE = '42501';
  END IF;
  IF p_publish AND r.summary IS NULL AND r.development IS NULL AND r.improvements IS NULL AND r.admin_comment IS NULL THEN
    RAISE EXCEPTION 'El reporte está vacío' USING ERRCODE = '22023';
  END IF;

  UPDATE public.match_reports
     SET published_at = CASE WHEN p_publish THEN now() ELSE NULL END,
         updated_at = now()
   WHERE match_id = p_match
  RETURNING * INTO r;
  RETURN r;
END;
$$;

-- reply_match_report: la familia (acudiente o atleta de ese equipo) responde.
-- Una respuesta por persona y partido; volver a enviar la reemplaza.
CREATE OR REPLACE FUNCTION public.reply_match_report(p_match uuid, p_body text)
RETURNS public.match_report_replies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  m public.match_results;
  v_body text := btrim(coalesce(p_body, ''));
  r public.match_report_replies;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF char_length(v_body) < 1 OR char_length(v_body) > 1000 THEN
    RAISE EXCEPTION 'La respuesta debe tener entre 1 y 1000 caracteres' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO m FROM public.match_results WHERE id = p_match;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partido no encontrado' USING ERRCODE = '02000'; END IF;
  IF NOT (m.team_id = ANY (public.calendar_family_team_ids())) THEN
    RAISE EXCEPTION 'Este partido no es de tu familia' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM public.match_reports mr
      JOIN public.school_settings ss ON ss.school_id = mr.school_id
     WHERE mr.match_id = p_match AND mr.published_at IS NOT NULL AND ss.share_match_reports
  ) THEN
    RAISE EXCEPTION 'El reporte no está publicado' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.match_report_replies (match_id, school_id, author_id, body)
  VALUES (p_match, m.school_id, v_uid, v_body)
  ON CONFLICT (match_id, author_id) DO UPDATE SET body = EXCLUDED.body, updated_at = now()
  RETURNING * INTO r;
  RETURN r;
END;
$$;

-- list_child_match_reports: reportes PUBLICADOS de los equipos de un hijo del
-- que quien llama es acudiente, con su propia respuesta.
CREATE OR REPLACE FUNCTION public.list_child_match_reports(p_child uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_teams uuid[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.children c WHERE c.id = p_child AND c.parent_id = v_uid) THEN
    RAISE EXCEPTION 'No es tu hijo' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT x.team_id), '{}'::uuid[]) INTO v_teams
    FROM (
      SELECT e.team_id FROM public.enrollments e
       WHERE e.child_id = p_child AND e.team_id IS NOT NULL
         AND e.status IN ('active', 'pending', 'paused')
      UNION
      SELECT c.team_id FROM public.children c
       WHERE c.id = p_child AND c.team_id IS NOT NULL
    ) x;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(q)::jsonb ORDER BY q.match_date DESC)
      FROM (
        SELECT mr.id AS match_id, mr.match_date, mr.opponent, mr.is_home,
               mr.home_score, mr.away_score, mr.match_type,
               t.name AS team_name,
               rep.summary, rep.development, rep.improvements,
               rep.admin_comment, rep.published_at,
               (SELECT jsonb_build_object('body', y.body, 'updated_at', y.updated_at)
                  FROM public.match_report_replies y
                 WHERE y.match_id = mr.id AND y.author_id = v_uid) AS my_reply
          FROM public.match_reports rep
          JOIN public.match_results mr ON mr.id = rep.match_id
          JOIN public.teams t ON t.id = mr.team_id
          JOIN public.school_settings ss ON ss.school_id = mr.school_id
         WHERE mr.team_id = ANY (v_teams)
           AND rep.published_at IS NOT NULL
           AND ss.share_match_reports
         ORDER BY mr.match_date DESC
         LIMIT 50
      ) q
  ), '[]'::jsonb);
END;
$$;

-- ─── 5. Permisos de ejecución (explícitos: los default privileges dan EXECUTE) ─
REVOKE ALL ON FUNCTION public.save_match_report(uuid, jsonb)          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_match_admin_comment(uuid, text)    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.publish_match_report(uuid, boolean)     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reply_match_report(uuid, text)          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_child_match_reports(uuid)          FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_match_report(uuid, jsonb)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_match_admin_comment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_match_report(uuid, boolean)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.reply_match_report(uuid, text)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_child_match_reports(uuid)       TO authenticated;

-- ─── 6. Besser lo tiene encendido (pedido del cliente) ──────────────────────
UPDATE public.school_settings SET share_match_reports = true
 WHERE school_id = '759eee9d-05cb-4958-b84a-2560f77e3683';
COMMIT;

-- ---------------------------------------------------------------------------
-- 20261022110155_pizarra_admin_edita_tablero.sql
-- OPCIONAL: admin/school_admin editan la pizarra. Besser NO lo necesita (su admin es owner); amplia permisos a 5 admins de otras escuelas. Si no lo quieres, borra este bloque.
-- ---------------------------------------------------------------------------
BEGIN;
-- =============================================================================
-- 20261022110155_pizarra_admin_edita_tablero.sql
-- Pedido de CLUB DEPORTIVO BESSER (2026-10-22): la administración quiere los
-- mismos permisos que el entrenador sobre la pizarra táctica (alineaciones,
-- plantillas, biblioteca, paquetes, notas, videos y equipos rivales).
--
-- user_tactical_edit_school_ids() gobierna las policies de escritura de todo
-- eso (ver 20260925170001 y 20261015171124..31). Se agregan 'admin' y
-- 'school_admin' a la rama de school_members. NO se agrega nada de más:
-- 'staff', 'parent' y 'athlete' siguen sin editar, 'super_admin' no cambia.
--
-- Mismo cuerpo que la versión viva; solo cambia la lista de roles.
-- Rollback: volver a crear la función con IN ('owner','coach','super_admin').
-- =============================================================================

SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.user_tactical_edit_school_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
  SELECT COALESCE(ARRAY(
    SELECT sm.school_id
      FROM public.school_members sm
     WHERE sm.profile_id = auth.uid()
       AND sm.status = 'active'
       AND sm.role IN ('owner', 'admin', 'school_admin', 'coach', 'super_admin')
    UNION
    SELECT ss.school_id
      FROM public.school_staff ss
     WHERE ss.coach_auth_id = auth.uid()
       AND ss.status = 'active'
    UNION
    SELECT ss.school_id
      FROM public.school_staff ss
      JOIN auth.users au ON LOWER(au.email) = LOWER(ss.email)
     WHERE au.id = auth.uid()
       AND ss.coach_auth_id IS NULL
       AND ss.status = 'active'
    UNION
    SELECT s.id
      FROM public.schools s
     WHERE s.owner_id = auth.uid()
  ), '{}'::uuid[]);
$function$;

GRANT EXECUTE ON FUNCTION public.user_tactical_edit_school_ids() TO authenticated;
COMMIT;

