-- =============================================================================
-- 20260814122449_watermark_solo_lo_apaga_whitelabel.sql
-- Autor: brylop   Fecha: 2026-08-14   Versión anterior: 20260814112450
-- Objetivo: que el "powered by SportMaps" solo lo pueda apagar quien contrató
--           la app nativa de marca blanca (addon `whitelabel`).
--
-- Qué estaba pasando: update_school_branding aceptaba p_show_watermark validando
-- únicamente el gate de tier, así que CUALQUIER escuela en pro entraba a
-- Configuración → Marca y apagaba la atribución con un switch, gratis. O sea que
-- la marca de agua no diferenciaba nada: el argumento de venta del tier alto se
-- regalaba en el tier de abajo.
--
-- Decisión de producto (2026-08-14):
--   · addon `pwa_branding`  → watermark SIEMPRE visible, no apagable. Es lo que
--     hace que valga la pena subir a white-label.
--   · addon `whitelabel`    → puede apagarlo. La atribución no desaparece: se
--     muda a Ajustes → Acerca de (eso es de frontend, no de esta migración).
--
-- Impacto medido antes de aplicar: CERO escuelas tenían el watermark apagado, así
-- que a nadie le cambia la app de un día para otro.
--
-- Se devuelve el intento rechazado en la respuesta (watermark_no_editable) en vez
-- de fallar toda la operación: el resto del guardado —logo y colores— es legítimo
-- y no tiene por qué caerse porque el switch no corresponda al plan.
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

CREATE OR REPLACE FUNCTION public.update_school_branding(
    p_school_id uuid,
    p_logo_url text DEFAULT NULL::text,
    p_primary_color text DEFAULT NULL::text,
    p_secondary_color text DEFAULT NULL::text,
    p_show_watermark boolean DEFAULT NULL::boolean,
    p_ip_address inet DEFAULT NULL::inet,
    p_user_agent text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    v_user_id            uuid := auth.uid();
    v_has_permission     boolean;
    v_has_feature        boolean;
    v_recent_changes     integer;
    v_before_logo        text;
    v_before_settings    jsonb;
    v_new_settings       jsonb;
    v_storage_url_prefix text;
    v_puede_apagar       boolean := false;
    v_watermark_negado   boolean := false;

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

    -- ── NUEVO 2026-08-14: el watermark solo lo apaga `whitelabel` ──
    -- Se consulta el addon, no el tier: el tier dice si puede EDITAR su marca,
    -- el addon dice qué compró.
    IF p_show_watermark IS NOT NULL THEN
        SELECT EXISTS(
            SELECT 1 FROM public.school_addons a
             WHERE a.school_id = p_school_id
               AND a.addon_key = 'whitelabel'
               AND a.enabled
        ) INTO v_puede_apagar;

        IF p_show_watermark = false AND NOT v_puede_apagar THEN
            -- Se ignora el intento pero NO se aborta: el logo y los colores que
            -- vinieran en la misma llamada son legítimos y se guardan igual.
            v_watermark_negado := true;
            v_new_settings := v_new_settings || jsonb_build_object('show_sportmaps_watermark', true);
        ELSE
            v_new_settings := v_new_settings || jsonb_build_object('show_sportmaps_watermark', p_show_watermark);
        END IF;
    END IF;

    -- Flag de sesion (local a la transaccion) que el trigger
    -- enforce_branding_via_rpc lee para permitir el UPDATE.
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
        'branding_settings', v_new_settings,
        'watermark_no_editable', v_watermark_negado
    );
END;
$function$;

COMMENT ON FUNCTION public.update_school_branding(uuid, text, text, text, boolean, inet, text) IS
    'Actualiza logo y colores de la escuela. El watermark "powered by SportMaps" '
    'solo lo puede APAGAR quien tenga el addon whitelabel; para el resto se fuerza '
    'a true y se avisa con watermark_no_editable (ver 20260814122449).';

COMMIT;
