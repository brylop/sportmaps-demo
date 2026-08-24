-- =============================================================================
-- 20260820124659_lead_capture_school_signup_leads.sql
-- Autor: brylop   Fecha: 2026-08-20   Versión anterior: 20260819173354
-- Objetivo: captura de prospectos sin fricción para el formulario público de
--   una escuela (caso Dynasty), en tabla propia — NO en `children`/`enrollments`.
-- =============================================================================
-- Por qué tabla separada y no una inscripción "liviana":
--
-- La migración 20260803110621 ya mostró el costo de meter datos incompletos en
-- `enrollments`: 17 filas de Dynasty sin equipo/plan/cuota, activas, contaminando
-- el motor de cobros. Un prospecto («dejo mi teléfono, todavía no me inscribo»)
-- es exactamente esa clase de fila incompleta. Va aparte.
--
-- Por qué NO reusa `submit_qr_signup`: esa RPC exige `auth.uid()` — el padre ya
-- tuvo que crear cuenta. Un formulario de marketing (nombre/teléfono/edad) no
-- puede exigir login sin matar la conversión; por eso esto es anon de punta a
-- punta, con honeypot + dedupe por teléfono en vez de auth.
--
-- Por qué NO se llama `leads` a secas: `demo_links.prospect_*` (cerrado en
-- 20260814190911) ya es "lead" en este repo, pero de OTRO embudo — SportMaps
-- vendiéndose a escuelas. Esto es una escuela captando familias. Dos negocios,
-- dos tablas, nombre sin ambigüedad: `school_signup_leads`.
--
-- Modelo de acceso: RLS habilitada, CERO policies. Todo el acceso —insert
-- anónimo, listado y cambio de estado del admin— pasa por RPC SECURITY DEFINER
-- con su propio chequeo de rol. Ninguna policy que aparente filtrar y no filtre
-- (la trampa de "…_by_token" del CLAUDE.md).
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

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Tabla
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_signup_leads (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id           uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    source_slug         text NOT NULL,          -- schools.slug al momento del submit
    full_name           text NOT NULL,
    guardian_name       text,                   -- si full_name es el atleta menor y el contacto es otro adulto
    phone               text NOT NULL,          -- normalizado server-side (solo dígitos, + opcional al inicio)
    email               text,
    gender              text,
    birth_date          date,
    suggested_category  text,                   -- calculada server-side desde birth_date, informativa
    how_heard           text,
    notes               text,
    source_detail       jsonb,                  -- UTMs u otro contexto de origen
    status              text NOT NULL DEFAULT 'new'
                          CHECK (status IN ('new', 'contacted', 'converted', 'discarded')),
    converted_enrollment_id uuid REFERENCES public.enrollments(id) ON DELETE SET NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_signup_leads_school_status
    ON public.school_signup_leads(school_id, status, created_at DESC);

-- Dedupe 24h por escuela+teléfono: soporta el `WHERE` de submit_school_lead sin
-- table scan (una escuela captando en feria puede recibir cientos en una hora).
CREATE INDEX IF NOT EXISTS idx_school_signup_leads_dedupe
    ON public.school_signup_leads(school_id, phone, created_at DESC);

COMMENT ON TABLE public.school_signup_leads IS
    'Prospectos de inscripción captados por formulario público (sin login), antes de convertirse en children/enrollments. No confundir con demo_links.prospect_* (leads comerciales de SportMaps vendiéndose a escuelas).';

-- ────────────────────────────────────────────────────────────────────────────
-- 2. RLS: habilitada, cero policies. Solo entra por las RPC de abajo.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.school_signup_leads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.school_signup_leads FROM anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Triggers: updated_at + auditoría (mismos genéricos que usa el resto del repo)
-- ────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_school_signup_leads_touch ON public.school_signup_leads;
CREATE TRIGGER trg_school_signup_leads_touch
    BEFORE UPDATE ON public.school_signup_leads
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_audit_school_signup_leads ON public.school_signup_leads;
CREATE TRIGGER trg_audit_school_signup_leads
    AFTER INSERT OR UPDATE OR DELETE ON public.school_signup_leads
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- ────────────────────────────────────────────────────────────────────────────
-- 4. get_school_lead_landing_public — anon. Branding para /inscripcion/:slug.
--    Nada sensible: mismo criterio que get_join_qr_public.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_school_lead_landing_public(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school record;
BEGIN
    SELECT id, name, slug, logo_url, branding_settings
      INTO v_school
      FROM public.schools
     WHERE slug = p_slug;

    IF v_school.id IS NULL THEN
        RETURN jsonb_build_object('found', false);
    END IF;

    RETURN jsonb_build_object(
        'found', true,
        'school', jsonb_build_object(
            'id',                v_school.id,
            'name',              v_school.name,
            'slug',              v_school.slug,
            'logo_url',          v_school.logo_url,
            'branding_settings', v_school.branding_settings
        )
    );
END;
$$;

COMMENT ON FUNCTION public.get_school_lead_landing_public(text) IS
    'Datos de branding para la landing pública /inscripcion/:slug. Sin datos sensibles.';

GRANT EXECUTE ON FUNCTION public.get_school_lead_landing_public(text) TO anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. submit_school_lead — anon. Un paso, sin cuenta.
--    Honeypot (p_website) + normalización de teléfono + dedupe 24h.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_school_lead(
    p_slug          text,
    p_full_name     text,
    p_phone         text,
    p_email         text DEFAULT NULL,
    p_gender        text DEFAULT NULL,
    p_birth_date    date DEFAULT NULL,
    p_guardian_name text DEFAULT NULL,
    p_how_heard     text DEFAULT NULL,
    p_notes         text DEFAULT NULL,
    p_source_detail jsonb DEFAULT NULL,
    p_website       text DEFAULT NULL   -- honeypot: campo oculto que un humano nunca llena
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school_id  uuid;
    v_phone      text;
    v_age_years  int;
    v_category   text;
    v_lead_id    uuid;
    v_existing   uuid;
BEGIN
    -- Honeypot: si vino lleno es un bot. Se responde "éxito" sin escribir nada,
    -- para no revelarle al bot que fue detectado.
    IF COALESCE(TRIM(p_website), '') <> '' THEN
        RETURN jsonb_build_object('ok', true);
    END IF;

    SELECT id INTO v_school_id FROM public.schools WHERE slug = p_slug;
    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'Escuela no encontrada' USING ERRCODE = '02000';
    END IF;

    IF COALESCE(TRIM(p_full_name), '') = '' THEN
        RAISE EXCEPTION 'Nombre requerido' USING ERRCODE = '22023';
    END IF;

    v_phone := NULLIF(regexp_replace(COALESCE(p_phone, ''), '[^0-9+]', '', 'g'), '');
    IF v_phone IS NULL OR length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 7 THEN
        RAISE EXCEPTION 'Teléfono inválido' USING ERRCODE = '22023';
    END IF;

    -- Categoría sugerida: heurística simple por edad, solo informativa para el
    -- staff — no toca el motor de categorías por deporte (sport_configs.rules),
    -- que es por escuela+deporte y este formulario no captura deporte.
    IF p_birth_date IS NOT NULL THEN
        v_age_years := EXTRACT(YEAR FROM age(CURRENT_DATE, p_birth_date))::int;
        v_category := CASE
            WHEN v_age_years <= 10 THEN 'Sub-11'
            WHEN v_age_years <= 12 THEN 'Sub-13'
            WHEN v_age_years <= 14 THEN 'Sub-15'
            WHEN v_age_years <= 16 THEN 'Sub-17'
            WHEN v_age_years <= 19 THEN 'Sub-20'
            ELSE 'Senior'
        END;
    END IF;

    -- Dedupe 24h: doble clic o el mismo prospecto reintentando no abre dos filas.
    SELECT id INTO v_existing
      FROM public.school_signup_leads
     WHERE school_id = v_school_id
       AND phone = v_phone
       AND created_at > now() - interval '24 hours'
     ORDER BY created_at DESC
     LIMIT 1;

    IF v_existing IS NOT NULL THEN
        RETURN jsonb_build_object('ok', true, 'lead_id', v_existing, 'duplicate', true);
    END IF;

    INSERT INTO public.school_signup_leads (
        school_id, source_slug, full_name, guardian_name, phone, email, gender,
        birth_date, suggested_category, how_heard, notes, source_detail
    ) VALUES (
        v_school_id, p_slug, TRIM(p_full_name), NULLIF(TRIM(p_guardian_name), ''), v_phone,
        NULLIF(TRIM(p_email), ''), NULLIF(TRIM(p_gender), ''), p_birth_date, v_category,
        NULLIF(TRIM(p_how_heard), ''), NULLIF(TRIM(p_notes), ''), p_source_detail
    ) RETURNING id INTO v_lead_id;

    INSERT INTO public.notifications (user_id, school_id, title, message, type, link)
    SELECT sm.profile_id, v_school_id, 'Nuevo prospecto',
           TRIM(p_full_name) || ' dejó sus datos vía "' || p_slug || '"',
           'success', NULL
    FROM public.school_members sm
    WHERE sm.school_id = v_school_id AND sm.role IN ('owner', 'admin') AND sm.status = 'active';

    RETURN jsonb_build_object('ok', true, 'lead_id', v_lead_id, 'duplicate', false);
END;
$$;

COMMENT ON FUNCTION public.submit_school_lead(text, text, text, text, text, date, text, text, text, jsonb, text) IS
    'Captura de prospecto sin login para /inscripcion/:slug. Honeypot p_website + dedupe 24h por school_id+phone. Nunca escribe en children/enrollments — ver 20260803110621 para por qué.';

GRANT EXECUTE ON FUNCTION public.submit_school_lead(text, text, text, text, text, date, text, text, text, jsonb, text) TO anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. list_school_leads — admin de la escuela.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_school_leads(
    p_school_id uuid,
    p_status    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_rows jsonb;
BEGIN
    IF NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT id, full_name, guardian_name, phone, email, gender, birth_date,
               suggested_category, how_heard, notes, status,
               converted_enrollment_id, created_at, updated_at
          FROM public.school_signup_leads
         WHERE school_id = p_school_id
           AND (p_status IS NULL OR status = p_status)
    ) t;

    RETURN v_rows;
END;
$$;

COMMENT ON FUNCTION public.list_school_leads(uuid, text) IS
    'Listado de prospectos para el admin de la escuela. Gateado por is_school_admin, no por policy.';

GRANT EXECUTE ON FUNCTION public.list_school_leads(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.list_school_leads(uuid, text) FROM anon;

-- ────────────────────────────────────────────────────────────────────────────
-- 7. update_school_lead_status — admin de la escuela.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_school_lead_status(
    p_lead_id uuid,
    p_status  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school_id uuid;
BEGIN
    IF p_status NOT IN ('new', 'contacted', 'converted', 'discarded') THEN
        RAISE EXCEPTION 'Estado inválido' USING ERRCODE = '22023';
    END IF;

    SELECT school_id INTO v_school_id FROM public.school_signup_leads WHERE id = p_lead_id;
    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'Prospecto no encontrado' USING ERRCODE = '02000';
    END IF;

    IF NOT (public.is_super_admin() OR public.is_school_admin(v_school_id)) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;

    UPDATE public.school_signup_leads
       SET status = p_status
     WHERE id = p_lead_id;

    RETURN jsonb_build_object('ok', true, 'lead_id', p_lead_id, 'status', p_status);
END;
$$;

COMMENT ON FUNCTION public.update_school_lead_status(uuid, text) IS
    'Cambia el estado de un prospecto (new/contacted/converted/discarded). Gateado por is_school_admin de la escuela dueña del lead.';

GRANT EXECUTE ON FUNCTION public.update_school_lead_status(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.update_school_lead_status(uuid, text) FROM anon;

COMMIT;

-- ────────────────────────────────────────────────────────────────────────────
-- Verificación después de aplicar
-- ────────────────────────────────────────────────────────────────────────────
-- 1) Cero policies, RLS encendida, sin grants directos:
--    SELECT relrowsecurity FROM pg_class WHERE relname = 'school_signup_leads';
--    SELECT count(*) FROM pg_policies WHERE tablename = 'school_signup_leads';  -- debe ser 0
--    SET LOCAL ROLE anon; SELECT count(*) FROM public.school_signup_leads;      -- debe fallar (permission denied)
--
-- 2) Landing pública funciona sin sesión:
--    SET LOCAL ROLE anon; SELECT public.get_school_lead_landing_public('dynasty');
--
-- 3) Submit + dedupe:
--    SET LOCAL ROLE anon;
--    SELECT public.submit_school_lead('dynasty', 'Prueba QA', '3001234567');
--    SELECT public.submit_school_lead('dynasty', 'Prueba QA', '3001234567');  -- 2da: duplicate=true, mismo lead_id
--
-- 4) Honeypot:
--    SELECT public.submit_school_lead('dynasty', 'Bot', '3009999999', p_website => 'http://spam.com');
--    -- debe devolver ok:true SIN insertar fila (contar antes/después en school_signup_leads)
