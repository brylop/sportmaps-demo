-- =============================================================================
-- 20260826112433_fix_is_platform_admin_null_root_cause.sql
-- Autor: brylop   Fecha: 2026-08-26   Versión anterior: 20260826110449
-- Objetivo: CIERRE DE RAÍZ del bypass de autorización reportado 2026-08-26
--   (ver 20260825234316 y 20260826110449). is_platform_admin() puede devolver
--   NULL en vez de false: "(auth.jwt()->'app_metadata'->>'platform_admin')
--   ::boolean = true" da NULL cuando la claim no existe (el caso normal para
--   cualquier usuario que no sea platform admin), y "NULL OR EXISTS(false)"
--   es NULL, no false.
--
--   Ese NULL se propaga a TODO lo que compone is_super_admin()/
--   is_platform_admin() con OR — no solo a los ~24 RPCs admin_set_*/admin_list_*
--   ya corregidos con guards explícitos (20260826110449), sino a otras ~30
--   funciones con el patrón "IF NOT (is_super_admin() OR is_school_admin(...))"
--   (equipment_*, issue/revoke/list de carnets y certificados, school leads,
--   join QRs, trial slots, memberships, open_month/preview_open_month,
--   get_payment_aging_report, school_payment_kpis, merge_split_enrollments) y a
--   can_manage_reports() — que a su vez usan 8 funciones más del módulo de
--   informes (generate_report_drafts, publish_athlete_report, hold_athlete_report,
--   reschedule_pending_reports, regenerate_report_snapshot, set_athlete_report_note,
--   publish_team_reports, report_coverage). Ninguna de esas ~40 funciones se toca
--   en esta migración: se corrige is_platform_admin() para que NUNCA devuelva
--   NULL, lo que las vuelve seguras a todas de una sola vez, porque los otros
--   operandos de sus OR (is_school_admin, is_school_admin_of, is_school_member,
--   user_staff_school_ids) ya son EXISTS/array-based — verificados contra la
--   base viva, nunca devuelven NULL.
--
--   Fix: envolver el primer operando en COALESCE(..., false). El segundo
--   (EXISTS) ya era seguro. auth.jwt() con sesión anónima/sin claims también
--   queda cubierto (NULL -> false), no cambia el comportamiento para nadie
--   que hoy es rechazado correctamente — solo cierra el caso que hoy pasaba
--   de largo.
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

CREATE OR REPLACE FUNCTION public.is_platform_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
  SELECT
    COALESCE((auth.jwt() -> 'app_metadata' ->> 'platform_admin')::boolean, false)
    OR EXISTS (
      SELECT 1 FROM public.platform_admins
      WHERE profile_id = auth.uid() AND is_active = true
    );
$function$;

NOTIFY pgrst, 'reload schema';

COMMIT;
