-- ============================================================
-- SPORTMAPS — Branding white-label hardening (Fase 1, parte DB)
--
-- Cierra el bug historico del ThemeContext y deja el feature de
-- branding por escuela seguro, auditable y gated por tier.
--
-- Cambios:
--   1. Tabla branding_change_log (audit trail Ley 1581 + forense)
--   2. Helper school_has_branding_feature(p_school_id)
--   3. RPC update_school_branding(...) seguro:
--        - Auth + permission check
--        - Tier check (Pro+)
--        - Regex hex en colores (anti-XSS via CSS vars)
--        - Validacion logo_url (solo Supabase Storage school-assets)
--        - Audit log automatico (before/after, ip, user_agent)
--        - Rate limit (max 10 cambios / hora / escuela)
--   4. Trigger fail-safe: REVOKE UPDATE directo de columnas branding
--      desde rol authenticated. Solo via RPC. Bloquea
--      `supabase.from('schools').update({ branding_settings: ... })`
--      malicioso desde el cliente.
--   5. Policy de SELECT publico del audit log: solo super-admins y
--      el propio school_admin pueden leerlo.
--
-- Politica de la casa: search_path = pg_catalog, public, pg_temp en
-- TODA funcion nueva. RLS en tablas nuevas. Migraciones inmutables.
-- ============================================================

BEGIN;


-- ============================================================
-- 1. branding_change_log — audit trail
-- ============================================================

CREATE TABLE IF NOT EXISTS public.branding_change_log (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    changed_by      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    changed_at      timestamptz NOT NULL DEFAULT now(),

    -- Snapshots before/after (jsonb completo de branding_settings + logo_url)
    before_state    jsonb       NOT NULL,
    after_state     jsonb       NOT NULL,

    -- Trazabilidad legal/forense
    ip_address      inet,
    user_agent      text,

    -- Causa: 'rpc_update' | 'admin_override' | 'reset_default'
    change_source   text        NOT NULL DEFAULT 'rpc_update'
                      CHECK (change_source IN ('rpc_update','admin_override','reset_default','migration')),

    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_branding_change_log_school
    ON public.branding_change_log(school_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_branding_change_log_user
    ON public.branding_change_log(changed_by, changed_at DESC);

ALTER TABLE public.branding_change_log ENABLE ROW LEVEL SECURITY;

-- Lectura: school_admin de la escuela puede ver SUS cambios
DROP POLICY IF EXISTS "branding_log_school_admin_select" ON public.branding_change_log;
CREATE POLICY "branding_log_school_admin_select" ON public.branding_change_log
    FOR SELECT TO authenticated
    USING (
        school_id IN (
            SELECT sm.school_id
              FROM public.school_members sm
             WHERE sm.profile_id = auth.uid()
               AND sm.role IN ('owner','super_admin','admin','school_admin')
               AND sm.status = 'active'
        )
    );

-- INSERT solo via RPC (SECURITY DEFINER). Cerrado a authenticated.
-- (Las RPC corren como postgres y bypassean RLS de INSERT.)
DROP POLICY IF EXISTS "branding_log_no_direct_insert" ON public.branding_change_log;
CREATE POLICY "branding_log_no_direct_insert" ON public.branding_change_log
    FOR INSERT TO authenticated
    WITH CHECK (false);

COMMENT ON TABLE public.branding_change_log IS
    'Audit log de cambios de branding por escuela. Inserts solo via RPC '
    'update_school_branding. Lectura solo por admins de la escuela o '
    'super-admin. Soporta requisitos forenses Ley 1581/2012.';


-- ============================================================
-- 2. Helper: school_has_branding_feature(p_school_id)
--
-- Devuelve true si la escuela tiene tier que incluye white-label
-- branding (pro o enterprise) y suscripcion activa/trialing.
-- ============================================================

CREATE OR REPLACE FUNCTION public.school_has_branding_feature(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT EXISTS(
        SELECT 1
          FROM public.school_subscriptions ss
         WHERE ss.school_id = p_school_id
           AND ss.tier IN ('pro','enterprise')
           AND ss.status IN ('active','trialing','grandfathered')
    );
$$;

REVOKE ALL ON FUNCTION public.school_has_branding_feature(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_has_branding_feature(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.school_has_branding_feature IS
    'Feature gate: branding white-label es exclusivo de tier pro/enterprise. '
    'Free tier siempre ve branding SportMaps default.';


-- ============================================================
-- 3. RPC update_school_branding — UNICO punto de actualizacion
-- ============================================================
--
-- Reemplaza el UPDATE directo desde cliente (inseguro). Aplica:
--   - Auth check (auth.uid())
--   - Permission check (owner/admin/school_admin con status=active)
--   - Tier check (Pro+; free recibe error feature_not_available)
--   - Regex hex estricto en primary_color y secondary_color
--   - Validacion logo_url: debe ser del bucket Supabase Storage
--     school-assets con la ruta logos/{school_id}/... (anti-SSRF)
--   - Rate limit: maximo 10 cambios por hora por escuela
--   - Audit log automatico con before/after, ip, user_agent
--
-- Devuelve jsonb con ok + datos actualizados o error.

CREATE OR REPLACE FUNCTION public.update_school_branding(
    p_school_id              uuid,
    p_logo_url               text DEFAULT NULL,
    p_primary_color          text DEFAULT NULL,
    p_secondary_color        text DEFAULT NULL,
    p_show_watermark         boolean DEFAULT NULL,
    p_ip_address             inet DEFAULT NULL,
    p_user_agent             text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_user_id            uuid := auth.uid();
    v_has_permission     boolean;
    v_has_feature        boolean;
    v_recent_changes     integer;
    v_before_logo        text;
    v_before_settings    jsonb;
    v_new_settings       jsonb;
    v_storage_url_prefix text;

    -- Regex hex estricto: #RRGGBB (6 hex digits). Reject CSS payloads.
    c_hex_regex constant text := '^#[0-9A-Fa-f]{6}$';
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'auth_required');
    END IF;

    IF p_school_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'school_id_required');
    END IF;

    -- 3.1 Permission: caller debe ser admin activo de la escuela
    SELECT EXISTS(
        SELECT 1 FROM public.school_members
         WHERE school_id = p_school_id
           AND profile_id = v_user_id
           AND role IN ('owner','super_admin','admin','school_admin')
           AND status = 'active'
    ) INTO v_has_permission;

    IF NOT v_has_permission THEN
        RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
    END IF;

    -- 3.2 Feature gate por tier
    SELECT public.school_has_branding_feature(p_school_id) INTO v_has_feature;
    IF NOT v_has_feature THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'feature_not_available',
            'message', 'La personalizacion de marca esta disponible en planes Pro y superiores.'
        );
    END IF;

    -- 3.3 Rate limit: max 10 cambios / hora por escuela (anti-abuse)
    SELECT COUNT(*) INTO v_recent_changes
      FROM public.branding_change_log
     WHERE school_id = p_school_id
       AND changed_at >= now() - interval '1 hour';

    IF v_recent_changes >= 10 THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'rate_limited',
            'message', 'Demasiados cambios recientes. Intenta de nuevo en 1 hora.'
        );
    END IF;

    -- 3.4 Validacion: regex hex estricto en colores
    IF p_primary_color IS NOT NULL AND p_primary_color !~ c_hex_regex THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_primary_color');
    END IF;
    IF p_secondary_color IS NOT NULL AND p_secondary_color !~ c_hex_regex THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_secondary_color');
    END IF;

    -- 3.5 Validacion logo_url: debe venir del bucket Storage school-assets
    --     con la ruta logos/{school_id}/... (anti-SSRF, anti-arbitrary-URL)
    IF p_logo_url IS NOT NULL THEN
        -- Acepta tanto la URL publica como path relativo. La verificacion
        -- estricta del path real (logos/<school_id>/...) la hace tambien
        -- la RLS de storage.objects en INSERT, asi que aqui validamos prefix.
        v_storage_url_prefix := '/storage/v1/object/public/school-assets/logos/' || p_school_id::text || '/';
        IF position(v_storage_url_prefix in p_logo_url) = 0
           AND p_logo_url NOT LIKE ('logos/' || p_school_id::text || '/%')
        THEN
            RETURN jsonb_build_object(
                'ok', false,
                'error', 'invalid_logo_url',
                'message', 'logo_url debe pertenecer al bucket school-assets de esta escuela.'
            );
        END IF;
    END IF;

    -- 3.6 Snapshot before
    SELECT logo_url, branding_settings
      INTO v_before_logo, v_before_settings
      FROM public.schools
     WHERE id = p_school_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'school_not_found');
    END IF;

    -- 3.7 Build new branding_settings (merge: solo cambia lo provisto)
    v_new_settings := COALESCE(v_before_settings, '{}'::jsonb);
    IF p_primary_color IS NOT NULL THEN
        v_new_settings := v_new_settings || jsonb_build_object('primary_color', p_primary_color);
    END IF;
    IF p_secondary_color IS NOT NULL THEN
        v_new_settings := v_new_settings || jsonb_build_object('secondary_color', p_secondary_color);
    END IF;
    IF p_show_watermark IS NOT NULL THEN
        v_new_settings := v_new_settings || jsonb_build_object('show_sportmaps_watermark', p_show_watermark);
    END IF;

    -- 3.8 Aplicar UPDATE (en transaccion con el INSERT al log)
    UPDATE public.schools
       SET logo_url          = COALESCE(p_logo_url, logo_url),
           branding_settings = v_new_settings,
           updated_at        = now()
     WHERE id = p_school_id;

    -- 3.9 Audit log
    INSERT INTO public.branding_change_log (
        school_id, changed_by, before_state, after_state,
        ip_address, user_agent, change_source
    ) VALUES (
        p_school_id, v_user_id,
        jsonb_build_object('logo_url', v_before_logo, 'branding_settings', v_before_settings),
        jsonb_build_object('logo_url', COALESCE(p_logo_url, v_before_logo), 'branding_settings', v_new_settings),
        p_ip_address, p_user_agent, 'rpc_update'
    );

    RETURN jsonb_build_object(
        'ok', true,
        'school_id', p_school_id,
        'logo_url', COALESCE(p_logo_url, v_before_logo),
        'branding_settings', v_new_settings
    );
END;
$$;

REVOKE ALL ON FUNCTION public.update_school_branding(uuid, text, text, text, boolean, inet, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_school_branding(uuid, text, text, text, boolean, inet, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.update_school_branding IS
    'UNICO punto de actualizacion de branding. Valida tier, permisos, '
    'colores hex, logo_url del bucket Storage, rate-limit, y deja audit '
    'log. Reemplaza el UPDATE directo desde cliente (inseguro).';


-- ============================================================
-- 4. REVOKE UPDATE directo de columnas branding desde authenticated
-- ============================================================
--
-- Forza que el unico camino sea la RPC. Si el frontend mantiene
-- por error un `supabase.from('schools').update({ branding_settings })`
-- ese UPDATE recibira 42501 insufficient_privilege.
--
-- Nota: las columnas ya estan en la lista de actualizables via la
-- policy school_admin_update_branding (de la migracion del 7 de marzo).
-- Aqui revocamos a nivel de GRANT de columnas, mas restrictivo.

REVOKE UPDATE (branding_settings, logo_url) ON public.schools FROM authenticated, anon, public;

-- Para mantener la posibilidad de que super-admin pueda hacer un override
-- manual desde la consola Supabase, dejamos GRANT a service_role.
GRANT UPDATE (branding_settings, logo_url) ON public.schools TO service_role;


-- ============================================================
-- 5. Comentarios finales
-- ============================================================

COMMENT ON COLUMN public.schools.branding_settings IS
    'Configuracion de branding (colores, watermark). Solo actualizable via '
    'RPC update_school_branding. UPDATE directo desde authenticated REVOCADO.';

COMMENT ON COLUMN public.schools.logo_url IS
    'URL publica del logo de la escuela (bucket school-assets/logos/<school_id>/). '
    'Solo actualizable via RPC update_school_branding.';


COMMIT;
