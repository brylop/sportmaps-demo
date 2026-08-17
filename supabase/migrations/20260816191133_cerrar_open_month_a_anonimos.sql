-- ============================================================================
-- SEG-8b — `open_month` la puede ejecutar CUALQUIERA desde internet
--
-- Fecha: 2026-08-16
-- Severidad: 🔴 crea registros financieros de escuelas reales, sin sesión.
--
-- ── Verificado en vivo, no inferido ─────────────────────────────────────────
-- Con la llave pública del frontend y sin sesión:
--     POST /rest/v1/rpc/open_month {p_school_id: <uuid>, p_year, p_month}
--     → HTTP 200 · {"generados": 0, ...}
-- Se probó con un school_id INEXISTENTE a propósito, para confirmar que el
-- guard no rechaza sin llegar a crear nada. Con un school_id real —y `schools`
-- es el directorio público, 365 filas legibles por `anon`— habría generado las
-- cuotas del mes de esa escuela.
--
-- ── Por qué pasa ────────────────────────────────────────────────────────────
-- El guard de las tres funciones dice, textualmente:
--
--     -- El cron y service_role corren sin auth.uid() (v_caller NULL) y pasan.
--     IF v_caller IS NOT NULL
--        AND NOT (public.is_super_admin() OR public.is_school_admin(p_school_id))
--     THEN RAISE EXCEPTION 'No autorizado...'
--
-- Si `auth.uid()` es NULL, la condición entera es falsa y NO se levanta la
-- excepción. La intención era dejar pasar al cron; el error es tratar
-- «auth.uid() IS NULL» como «soy interno». NULL no significa interno: significa
-- **no traigo JWT de usuario**, que es exactamente lo que trae un anónimo.
--
-- Para un caller `authenticated` el guard SÍ funciona (v_caller no es NULL, y
-- si no es admin de esa escuela, rechaza). El agujero es solo para quien llega
-- sin sesión.
--
-- ── Por qué el fix es REVOKE y no reescribir las funciones ──────────────────
-- Quitarle EXECUTE a `anon` cierra el caso por completo, porque el guard ya
-- cubre bien al resto. Reescribir tres funciones de 200+ líneas para arreglar
-- un IF sería mucho más superficie de riesgo por el mismo resultado, y
-- `open_month` es justo la que genera la cartera: no es donde uno quiere
-- introducir un cambio grande con el cliente entrando el martes.
--
-- `authenticated` CONSERVA el EXECUTE: el panel de escuela llama a estas tres,
-- y ahí el guard interno hace su trabajo.
--
-- Relacionado: `SEG-8` (20260812181043) barrió por catálogo las funciones que
-- su migración declaraba solo para service_role, pero estas tres no entraban en
-- ese criterio — su migración nunca las restringió. Las encontró la
-- verificación posterior (scripts/verificar-seg8-anon-2026-08-15.sql).
-- ============================================================================

BEGIN;

-- ── 1. Las tres del patrón «sin uid, pasa» ──────────────────────────────────
-- open_month: genera las cuotas del mes. Es la peor: escribe dinero.
REVOKE EXECUTE ON FUNCTION public.open_month(uuid, int, int, uuid) FROM anon;

-- preview_open_month: no escribe, pero enumera qué se le cobraría a cada
-- escuela y por cuánto. Fuga financiera por tenant.
REVOKE EXECUTE ON FUNCTION public.preview_open_month(uuid, int, int, uuid) FROM anon;

-- school_payment_kpis: recaudo, mora y pendientes de cualquier escuela.
REVOKE EXECUTE ON FUNCTION public.school_payment_kpis(uuid, uuid) FROM anon;

-- ── 2. Los dos admin_* que quedaron abiertos a anon ─────────────────────────
-- Estos NO son explotables —su guard `is_super_admin()` devuelve false sin
-- sesión— pero no hay ninguna razón para que un anónimo pueda invocarlos.
REVOKE EXECUTE ON FUNCTION public.admin_set_school_plan(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_school_addon(uuid, text, boolean, integer) FROM anon;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ────────────────────────────────────────────────────────────────────────────
-- Verificación: las cinco deben quedar en anon_puede = false, y las que usa el
-- panel deben seguir en auth_puede = true.
-- ────────────────────────────────────────────────────────────────────────────
SELECT p.proname,
       has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_puede,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_puede,
       CASE WHEN has_function_privilege('anon', p.oid, 'EXECUTE')
            THEN '🔴 SIGUE ABIERTA' ELSE '✅ cerrada a anónimos' END AS estado
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('open_month','preview_open_month','school_payment_kpis',
                     'admin_set_school_plan','admin_set_school_addon')
 ORDER BY p.proname;
