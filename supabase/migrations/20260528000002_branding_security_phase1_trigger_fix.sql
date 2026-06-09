-- ============================================================
-- SPORTMAPS — Branding security Fase 1 fix (Trigger BEFORE UPDATE)
--
-- Corrige el problema descubierto al verificar la 20260528000001:
-- el REVOKE UPDATE (branding_settings, logo_url) FROM authenticated no
-- surte efecto porque en Postgres los privilegios son aditivos: si existe
-- un GRANT UPDATE ON public.schools TO authenticated a nivel tabla, el
-- REVOKE column-level no lo quita.
--
-- Como NO podemos revocar el GRANT table-level (rompe los UPDATE legitimos
-- a name, address, etc. desde school_admin), usamos un trigger
-- BEFORE UPDATE que rechaza cambios a branding_settings/logo_url si NO
-- vienen via la RPC update_school_branding (que setea un flag de sesion).
--
-- Politica de la casa: search_path = pg_catalog, public, pg_temp en TODA
-- funcion nueva.
-- ============================================================

BEGIN;


-- ============================================================
-- 1. Funcion trigger: enforce_branding_via_rpc
-- ============================================================
--
-- Rechaza UPDATEs directos a branding_settings o logo_url. Solo permite
-- pasar si el flag de sesion app.branding_via_rpc = 'true' (lo setea el
-- RPC update_school_branding antes de su UPDATE interno).
--
-- service_role y postgres bypassean (para migraciones, scripts admin,
-- soporte tecnico). El rol authenticated NUNCA puede setear el flag por
-- su cuenta porque set_config es solo visible dentro de la transaccion
-- y un cliente Supabase no puede ejecutar SQL arbitrario fuera de RPCs.

CREATE OR REPLACE FUNCTION public.enforce_branding_via_rpc()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_branding_changed boolean;
    v_logo_changed     boolean;
    v_via_rpc          text;
    v_session_user     text := session_user;
BEGIN
    -- service_role / postgres: passthrough (admin overrides, migraciones, soporte)
    IF v_session_user IN ('service_role', 'postgres', 'supabase_admin') THEN
        RETURN NEW;
    END IF;

    v_branding_changed := (OLD.branding_settings IS DISTINCT FROM NEW.branding_settings);
    v_logo_changed     := (OLD.logo_url          IS DISTINCT FROM NEW.logo_url);

    -- Nada de branding cambio → permitir UPDATE normal (name, address, etc.)
    IF NOT (v_branding_changed OR v_logo_changed) THEN
        RETURN NEW;
    END IF;

    -- Branding cambio → exigir que venga via RPC
    BEGIN
        v_via_rpc := current_setting('app.branding_via_rpc', true);
    EXCEPTION WHEN OTHERS THEN
        v_via_rpc := NULL;
    END;

    IF v_via_rpc IS DISTINCT FROM 'true' THEN
        RAISE EXCEPTION
            'branding_must_go_through_rpc: branding_settings y logo_url solo se actualizan via la RPC update_school_branding'
            USING ERRCODE = '42501';  -- insufficient_privilege
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_branding_via_rpc IS
    'Trigger que bloquea UPDATEs directos a schools.branding_settings y schools.logo_url. '
    'Solo deja pasar si la sesion seteo el flag app.branding_via_rpc=true (lo hace la RPC '
    'update_school_branding). service_role y postgres bypasean.';


-- ============================================================
-- 2. Trigger asociado a schools
-- ============================================================

DROP TRIGGER IF EXISTS trg_enforce_branding_via_rpc ON public.schools;

CREATE TRIGGER trg_enforce_branding_via_rpc
    BEFORE UPDATE ON public.schools
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_branding_via_rpc();


-- ============================================================
-- 3. Actualizar la RPC update_school_branding para setear el flag
-- ============================================================
--
-- Se setea con is_local=true → vive solo dentro de la transaccion del RPC.
-- Al terminar el RPC se descarta automaticamente — no puede ser leido
-- por queries posteriores en la misma sesion.

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

    c_hex_regex constant text := '^#[0-9A-Fa-f]{6}$';
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'auth_required');
    END IF;

    IF p_school_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'school_id_required');
    END IF;

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

    SELECT public.school_has_branding_feature(p_school_id) INTO v_has_feature;
    IF NOT v_has_feature THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'feature_not_available',
            'message', 'La personalizacion de marca esta disponible en planes Pro y superiores.'
        );
    END IF;

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

    IF p_primary_color IS NOT NULL AND p_primary_color !~ c_hex_regex THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_primary_color');
    END IF;
    IF p_secondary_color IS NOT NULL AND p_secondary_color !~ c_hex_regex THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_secondary_color');
    END IF;

    IF p_logo_url IS NOT NULL THEN
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

    SELECT logo_url, branding_settings
      INTO v_before_logo, v_before_settings
      FROM public.schools
     WHERE id = p_school_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'school_not_found');
    END IF;

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

    -- ── FIX 2026-05-28 ──
    -- Setear flag de sesion (local a la transaccion) que el trigger
    -- enforce_branding_via_rpc lee para permitir el UPDATE.
    -- is_local = true: vive solo dentro de esta transaccion, no se
    -- puede leer desde una sesion posterior del mismo usuario.
    PERFORM set_config('app.branding_via_rpc', 'true', true);

    UPDATE public.schools
       SET logo_url          = COALESCE(p_logo_url, logo_url),
           branding_settings = v_new_settings,
           updated_at        = now()
     WHERE id = p_school_id;

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

-- Re-grant tras CREATE OR REPLACE (los grants existentes se preservan en CREATE OR REPLACE,
-- pero por idempotencia los re-aplicamos).
REVOKE ALL ON FUNCTION public.update_school_branding(uuid, text, text, text, boolean, inet, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_school_branding(uuid, text, text, text, boolean, inet, text) TO authenticated, service_role;


COMMIT;
