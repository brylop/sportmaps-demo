-- =============================================================================
-- 20260814111324_rpc_set_school_pwa_icons.sql
-- Autor: brylop   Fecha: 2026-08-14   Versión anterior: 20260814105131
-- Objetivo: permitir que el BFF persista los iconos PNG 192/512 que genera a
--           partir del logo de la escuela, para el manifest dinámico de la PWA.
--
-- Por qué hace falta una RPC y no un UPDATE directo:
-- el trigger enforce_branding_via_rpc bloquea cualquier cambio de logo_url o
-- branding_settings que no venga por RPC. Tiene un passthrough por session_user
-- ('service_role','postgres','supabase_admin'), pero bajo PostgREST el
-- session_user real es `authenticator` (el SET ROLE cambia current_user, no
-- session_user), así que el BFF NO cae en ese passthrough. El mecanismo que sí
-- funciona es el mismo que usa update_school_branding: marcar la transacción con
-- set_config('app.branding_via_rpc', 'true', true).
--
-- Esta RPC es solo para service_role (la llama el BFF tras generar los PNG con
-- sharp). No la ejecuta el usuario logueado: los iconos son un derivado del logo,
-- no algo que la escuela suba a mano. Aun así recibe p_actor: branding_change_log
-- exige changed_by NOT NULL y queremos saber QUIÉN guardó el logo que disparó
-- la generación.
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
    p_actor     uuid
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

    -- changed_by es NOT NULL en branding_change_log.
    IF p_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'actor_required');
    END IF;

    -- Los iconos tienen que vivir en el bucket de ESTA escuela. Sin este check,
    -- un bug en el BFF podría dejar a una escuela con el icono de otra — y como
    -- el icono es lo que el padre ve en su pantalla de inicio, sería un error
    -- silencioso para nosotros y muy visible para el cliente.
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
        'pwa_icons_updated_at', to_jsonb(now())
    );

    -- Flag local a la transacción que el trigger enforce_branding_via_rpc lee
    -- para permitir el UPDATE. Sin esto: 42501.
    PERFORM set_config('app.branding_via_rpc', 'true', true);

    UPDATE public.schools
       SET branding_settings = v_settings,
           updated_at        = now()
     WHERE id = p_school_id;

    -- Se registra en el mismo log que el resto de los cambios de marca para que
    -- la auditoría no tenga huecos. change_source va como 'rpc_update' porque el
    -- CHECK de la tabla solo admite rpc_update/admin_override/reset_default/
    -- migration; el marcador pwa_icons_autogenerados en after_state permite
    -- filtrar la generación automática del cambio hecho por una persona.
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

COMMENT ON FUNCTION public.set_school_pwa_icons(uuid, text, text, uuid) IS
    'Persiste los iconos PNG 192/512 del manifest PWA que el BFF genera a partir '
    'del logo. Solo service_role: es un derivado del logo, no un upload de la '
    'escuela. p_actor = quien guardó el logo (branding_change_log.changed_by).';

-- Solo el BFF. El usuario logueado no genera iconos a mano.
REVOKE ALL ON FUNCTION public.set_school_pwa_icons(uuid, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_school_pwa_icons(uuid, text, text, uuid) TO service_role;

COMMIT;
