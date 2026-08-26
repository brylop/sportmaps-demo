-- =============================================================================
-- 20260825234316_school_module_overrides_null_safe_guard.sql
-- Autor: brylop   Fecha: 2026-08-26   Versión anterior: 20260825232553
-- Objetivo: cerrar un bypass de autorización descubierto al probar
--   admin_set_school_module (20260825232553): is_platform_admin() puede
--   devolver NULL (no false) para un usuario autenticado cualquiera —
--   "(auth.jwt()->'app_metadata'->>'platform_admin')::boolean = true" da
--   NULL cuando la claim no existe (el caso normal), y "NULL OR EXISTS(false)"
--   es NULL, no false. En PL/pgSQL, "IF NOT <condicion NULL> THEN RAISE"
--   NO lanza la excepción: un IF con condición NULL se trata como false,
--   así que el bloque de RAISE se salta y la función privilegiada se
--   ejecuta igual. Verificado en vivo simulando sesión de un owner de
--   escuela (rol 'school', no admin): admin_set_school_module tal como
--   quedó en 20260825232553 SÍ permitía la escritura. Mismo patrón
--   "IF NOT is_super_admin()/is_platform_admin() THEN RAISE" está en otras
--   23 funciones de public (ver hallazgo reportado al usuario) — esta
--   migración solo corrige la función nueva de este módulo; las demás
--   quedan fuera de alcance, a decidir con el usuario.
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

CREATE OR REPLACE FUNCTION public.admin_set_school_module(
    p_school_id   uuid,
    p_module_key  text,
    p_enabled     boolean   -- NULL = volver a heredado
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_actor  uuid := auth.uid();
    v_old    jsonb;
    v_new    jsonb;
    v_action text;
BEGIN
    -- IS NOT TRUE (no NOT ...) es deliberado: is_super_admin() puede dar
    -- NULL, y "NOT NULL" es NULL, que un IF de PL/pgSQL trata como false
    -- (no lanza). "IS NOT TRUE" convierte NULL en TRUE, así que sí lanza.
    IF public.is_super_admin() IS NOT TRUE THEN
        RAISE EXCEPTION 'solo super_admin puede activar o desactivar modulos del menu'
            USING ERRCODE = '42501';
    END IF;

    SELECT to_jsonb(m) INTO v_old
      FROM public.school_module_overrides m
     WHERE m.school_id = p_school_id AND m.module_key = p_module_key;

    IF p_enabled IS NULL THEN
        DELETE FROM public.school_module_overrides
         WHERE school_id = p_school_id AND module_key = p_module_key;
        v_action := 'DELETE';
        v_new := NULL;
    ELSE
        INSERT INTO public.school_module_overrides (school_id, module_key, enabled, set_by, updated_at)
        VALUES (p_school_id, p_module_key, p_enabled, v_actor, now())
        ON CONFLICT (school_id, module_key) DO UPDATE
        SET enabled = EXCLUDED.enabled, set_by = EXCLUDED.set_by, updated_at = now()
        RETURNING to_jsonb(school_module_overrides.*) INTO v_new;
        v_action := CASE WHEN v_old IS NULL THEN 'INSERT' ELSE 'UPDATE' END;
    END IF;

    INSERT INTO public.audit_logs (school_id, profile_id, table_name, record_id, action, old_data, new_data)
    VALUES (p_school_id, v_actor, 'school_module_overrides', p_module_key, v_action, v_old, v_new);

    RETURN jsonb_build_object(
        'ok', true,
        'school_id', p_school_id,
        'module_key', p_module_key,
        'enabled', p_enabled
    );
END;
$$;

-- REVOKE/GRANT ya quedaron correctos en 20260825232553; CREATE OR REPLACE
-- no los toca, pero se reafirman por si algo los tocó fuera del repo.
REVOKE ALL ON FUNCTION public.admin_set_school_module(uuid, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_school_module(uuid, text, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_school_module(uuid, text, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
