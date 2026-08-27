-- =============================================================================
-- 20260825232553_school_module_overrides.sql
-- Autor: brylop   Fecha: 2026-08-26   Versión anterior: 20260825183159
-- Objetivo: F0 de "módulos del menú por escuela" — tabla de overrides UX-only
--   (Super Admin oculta/muestra ítems del menú lateral por escuela, independiente
--   de los addons comerciales), RPC de escritura admin_set_school_module, y la
--   columna module_overrides en v_school_entitlements para que el frontend la
--   lea gratis vía GET /api/v1/me/entitlements. Sin cambios de frontend todavía:
--   ninguna escuela tiene filas hoy, así que jsonb_object_agg da NULL para todas
--   y el comportamiento actual queda intacto. Ver docs/specs/ (spec de este plan)
--   y docs/specs/capacidades-de-la-escuela-2026-08-18.md §14.3 (derecho vs prendido).
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

-- -----------------------------------------------------------------------------
-- 1. Tabla de overrides. Ausencia de fila = heredado (visible, o sigue al addon
--    si el module_key tiene uno asociado en frontend/src/config/module-catalog.ts).
--    enabled=false = forzado OFF. enabled=true = forzado ON.
-- -----------------------------------------------------------------------------
CREATE TABLE public.school_module_overrides (
    school_id   uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    module_key  text        NOT NULL,
    enabled     boolean     NOT NULL,
    set_by      uuid        REFERENCES public.profiles(id),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (school_id, module_key),
    CONSTRAINT school_module_overrides_module_key_check CHECK (module_key IN (
        'gestion_deportiva_equipos_planes','gestion_deportiva_calendario',
        'gestion_deportiva_entrenamiento_metricas','gestion_deportiva_entrenamiento_rutinas',
        'gestion_deportiva_informe_mensual',
        'finanzas_pagos','finanzas_recepcion','finanzas_contabilidad',
        'reportes_finanzas','reportes_reportes','reportes_panel',
        'documentos_carnets','documentos_constancias','documentos_qr_inscripcion',
        'documentos_recordatorios','documentos_plantillas_mensajes',
        'sedes_sedes','sedes_instalaciones','sedes_control_acceso',
        'cuenta_perfil_publico'
    ))
);

COMMENT ON TABLE public.school_module_overrides IS
    'Override UX-only por escuela de la visibilidad de items del menu lateral. '
    'Ausencia de fila = heredado. enabled=false = forzado OFF (oculta). '
    'enabled=true = forzado ON. Nunca sustituye un addon comercial: si el '
    'module_key tiene addon asociado (ver MODULE_CATALOG en el frontend), la '
    'visibilidad efectiva sigue siendo hasAddon AND NOT apagado.';

ALTER TABLE public.school_module_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_module_overrides FORCE ROW LEVEL SECURITY;

CREATE POLICY school_module_overrides_select_admin
    ON public.school_module_overrides
    FOR SELECT
    TO authenticated
    USING (public.is_school_admin(school_id) OR public.is_super_admin());

CREATE POLICY school_module_overrides_super_admin_all
    ON public.school_module_overrides
    FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

CREATE TRIGGER school_module_overrides_set_updated_at
    BEFORE UPDATE ON public.school_module_overrides
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. RPC de escritura, patrón identico a admin_set_school_addon
--    (20260713000006_school_addons_admin_toggle.sql). p_enabled = NULL vuelve
--    a heredado (borra la fila) en vez de necesitar un "reset" separado.
-- -----------------------------------------------------------------------------
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
    IF NOT public.is_super_admin() THEN
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

    -- Reusa audit_logs (ya existe, sirve a admin_list_audit_logs) — no crea
    -- una tabla de auditoria nueva, ver leccion documentada en
    -- docs/specs/capacidades-de-la-escuela-2026-08-18.md seccion 11.4.
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

REVOKE ALL ON FUNCTION public.admin_set_school_module(uuid, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_school_module(uuid, text, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_school_module(uuid, text, boolean) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. v_school_entitlements + columna module_overrides al final (columna 33).
--    CREATE OR REPLACE VIEW no permite reordenar/renombrar columnas (42P16),
--    asi que se copia la definicion vigente completa (confirmada contra la
--    base con pg_get_viewdef, no solo contra el repo) y se agrega al final.
--    jsonb_object_agg sobre 0 filas da NULL: para toda escuela sin overrides
--    (el 100% hoy) la columna sale NULL y el frontend la trata como {} — cero
--    cambio de comportamiento hasta que alguien use el panel (F3).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_school_entitlements AS
 SELECT s.id AS school_id,
    s.school_type,
    COALESCE(sub.plan_code, 'starter'::text) AS plan_code,
    COALESCE(sub.tier, 'free'::text) AS tier,
    COALESCE(sub.status, 'trialing'::text) AS subscription_status,
    COALESCE(sub.trial_ends_at, s.created_at + '1 mon'::interval) AS trial_ends_at,
    sub.current_period_start,
    sub.current_period_end,
    sub.billing_cycle,
    s.school_type IS NULL OR (s.school_type = ANY (ARRAY['academy'::text, 'hybrid'::text, 'club'::text, 'escuela'::text, 'gimnasio'::text, 'personal_trainer'::text])) AS has_academy,
    s.school_type = ANY (ARRAY['venue'::text, 'hybrid'::text, 'gimnasio'::text]) AS has_reservations,
    s.school_type = ANY (ARRAY['venue'::text, 'hybrid'::text, 'gimnasio'::text]) AS has_wallet,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'tournaments'::text AND a.enabled)) AS has_tournaments,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'access_control'::text AND a.enabled)) AS has_access_control,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'biomech'::text AND a.enabled)) AS has_biomech,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'nutrition'::text AND a.enabled)) AS has_nutrition,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'whitelabel'::text AND a.enabled)) AS has_whitelabel,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'whatsapp'::text AND a.enabled)) AS has_whatsapp,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'wompi'::text AND a.enabled)) AS has_wompi,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'mp'::text AND a.enabled)) AS has_mp,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'store'::text AND a.enabled)) AS has_store,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'accounting'::text AND a.enabled)) AS has_accounting,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'invoicing'::text AND a.enabled)) AS has_invoicing,
    s.created_at AS school_created_at,
    s.account_type,
    sub.school_id IS NOT NULL AS has_subscription_row,
    sub.trial_months,
    COALESCE(sub.blocking_exempt, false) AS blocking_exempt,
    sub.blocking_exempt_reason,
    school_is_operational(s.id) AS is_operational,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND (a.addon_key = ANY (ARRAY['pwa_branding'::text, 'whitelabel'::text])) AND a.enabled)) AS has_pwa_branding,
    COALESCE(sset.billing_enabled, true) AS has_billing,
    (SELECT jsonb_object_agg(m.module_key, m.enabled)
       FROM public.school_module_overrides m
      WHERE m.school_id = s.id) AS module_overrides
   FROM schools s
     LEFT JOIN school_subscriptions sub ON sub.school_id = s.id
     LEFT JOIN school_settings sset ON sset.school_id = s.id;

ALTER VIEW public.v_school_entitlements SET (security_invoker = true);

NOTIFY pgrst, 'reload schema';

COMMIT;
