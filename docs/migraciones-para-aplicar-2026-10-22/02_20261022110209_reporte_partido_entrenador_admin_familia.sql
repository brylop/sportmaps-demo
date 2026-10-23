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
