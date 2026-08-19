-- =============================================================================
-- 20260814193412_guardar_fondo_del_icono_pwa.sql
-- Autor: brylop   Fecha: 2026-08-14   Versión anterior: 20260814190911
-- Objetivo: que el splash de la app use el MISMO fondo que el ícono.
--
-- ── El problema ─────────────────────────────────────────────────────────────
-- El generador elige el fondo del ícono mirando el logo: si el logo ya trae uno
-- sólido (los JPG siempre lo traen), lo extiende. El manifest, en cambio,
-- declaraba `background_color` = color primario de la escuela, sin enterarse.
--
-- Caso real, Besser: el ícono quedó con fondo #030303 (el negro de su logo) y el
-- manifest decía #E3000F (su rojo). Android arma el splash con background_color
-- + el ícono centrado, así que se vería una pantalla ROJA con un cuadrado NEGRO
-- en el medio. Es el mismo defecto de tres capas que ya se corrigió una vez, de
-- vuelta por otra puerta.
--
-- ── El arreglo ──────────────────────────────────────────────────────────────
-- El generador guarda el color que efectivamente usó, y el manifest lo lee para
-- background_color. `theme_color` se mantiene en el color de la escuela: ese
-- pinta la barra del navegador y ahí sí corresponde la marca.
--
-- La función pasa a recibir p_bg. No se puede agregar un parámetro a la de 4
-- argumentos, así que se crea la de 5 y se elimina la anterior: dejar las dos
-- convivir invita a que alguien llame a la vieja y el fondo vuelva a
-- desincronizarse en silencio.
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

CREATE OR REPLACE FUNCTION public.set_school_pwa_icons(
    p_school_id uuid,
    p_icon_192  text,
    p_icon_512  text,
    p_actor     uuid,
    p_bg        text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_prefix   text;
    v_settings jsonb;
    v_before   jsonb;
BEGIN
    IF p_school_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'school_id_required');
    END IF;

    IF p_icon_192 IS NULL OR p_icon_512 IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'both_icons_required');
    END IF;

    IF p_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'actor_required');
    END IF;

    IF p_bg IS NOT NULL AND p_bg !~ '^#[0-9A-Fa-f]{6}$' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_bg_color');
    END IF;

    v_prefix := '/storage/v1/object/public/school-assets/pwa-icons/' || p_school_id::text || '/';

    IF position(v_prefix in p_icon_192) = 0 OR position(v_prefix in p_icon_512) = 0 THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'invalid_icon_url',
            'message', 'Los iconos deben estar en school-assets/pwa-icons/<school_id>/.'
        );
    END IF;

    SELECT branding_settings INTO v_before
      FROM public.schools
     WHERE id = p_school_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'school_not_found');
    END IF;

    v_settings := COALESCE(v_before, '{}'::jsonb) || jsonb_build_object(
        'pwa_icon_192',         p_icon_192,
        'pwa_icon_512',         p_icon_512,
        'pwa_icon_bg',          p_bg,
        'pwa_icons_updated_at', to_jsonb(now())
    );

    PERFORM set_config('app.branding_via_rpc', 'true', true);

    UPDATE public.schools
       SET branding_settings = v_settings,
           updated_at        = now()
     WHERE id = p_school_id;

    INSERT INTO public.branding_change_log (
        school_id, changed_by, before_state, after_state, change_source
    ) VALUES (
        p_school_id,
        p_actor,
        jsonb_build_object('branding_settings', v_before),
        jsonb_build_object('branding_settings', v_settings, 'pwa_icons_autogenerados', true),
        'rpc_update'
    );

    RETURN jsonb_build_object('ok', true, 'school_id', p_school_id, 'branding_settings', v_settings);
END;
$$;

COMMENT ON FUNCTION public.set_school_pwa_icons(uuid, text, text, uuid, text) IS
    'Persiste los iconos PNG 192/512 del manifest PWA y EL FONDO que uso el '
    'generador. El manifest lee pwa_icon_bg para background_color, para que el '
    'splash no quede de un color y el icono de otro (ver 20260814193412).';

REVOKE ALL ON FUNCTION public.set_school_pwa_icons(uuid, text, text, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_school_pwa_icons(uuid, text, text, uuid, text) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.set_school_pwa_icons(uuid, text, text, uuid, text) TO service_role;

-- Se elimina la de 4 argumentos: con las dos vivas, una llamada a la vieja
-- volvería a dejar el fondo sin guardar y el defecto reaparecería en silencio.
DROP FUNCTION IF EXISTS public.set_school_pwa_icons(uuid, text, text, uuid);

COMMIT;
