-- =============================================================================
-- 20260930230003_v_session_load_minutos_no_numericos.sql
-- Autor: judegor99   Fecha: 2026-09-30   Versión anterior: 20260930230002
-- Objetivo: bug real encontrado construyendo PER-2/PER-6 (carga de
--   entrenamiento), sin relación con esas features en sí — `v_session_load`
--   (`20260831160936`) castea `session_blocks[].minutes` directo a
--   `numeric`, y datos reales de coach ya tienen valores como `"25´"` o
--   `"10'"` (la comilla/acento como símbolo de minutos, notación común al
--   escribir a mano). Eso no da NULL: **revienta la consulta entera** con
--   `22P02 invalid input syntax for type numeric` en cualquier query que
--   toque esa fila — confirmado en vivo: 3 sesiones reales ya tienen este
--   patrón hoy (2026-09-30), antes de que `training_load_summary`
--   (`20260929211124`) o `athlete_monthly_load_system` (`20260929215013`)
--   existieran para exponerlo. Es un latente que iba a estallar solo con
--   más uso real del módulo, no algo que estas dos RPCs introducen.
--
--   Fix: extraer el número LÍDER de la cadena (`substring(... from
--   '^\s*([0-9]+(\.[0-9]+)?)')`) en vez of castear la cadena completa —
--   tolera el símbolo de minutos al final sin necesitar limpiar los datos
--   ya guardados. Mismo cálculo, misma columna, `security_invoker=true`
--   sin cambios — solo la extracción del número se endurece.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE VIEW public.v_session_load
WITH (security_invoker = true) AS
SELECT
    ts.id            AS session_id,
    ts.team_id       AS team_id,
    ts.session_date  AS session_date,
    NULLIF(ts.evaluation ->> 'rpe', '')::smallint AS rpe,
    COALESCE((
        SELECT SUM(NULLIF(substring(block ->> 'minutes' from '^\s*([0-9]+(\.[0-9]+)?)'), '')::numeric)
        FROM jsonb_array_elements(COALESCE(ts.session_blocks, '[]'::jsonb)) AS block
    ), 0) AS total_minutes,
    NULLIF(ts.evaluation ->> 'rpe', '')::smallint * COALESCE((
        SELECT SUM(NULLIF(substring(block ->> 'minutes' from '^\s*([0-9]+(\.[0-9]+)?)'), '')::numeric)
        FROM jsonb_array_elements(COALESCE(ts.session_blocks, '[]'::jsonb)) AS block
    ), 0) AS load_ua
FROM public.training_sessions ts;

COMMENT ON VIEW public.v_session_load IS
    'Carga por sesión (UA = RPE de sesión x minutos totales, sRPE de Foster). '
    'security_invoker=true: hereda la RLS de training_sessions, no la de esta vista. '
    'Minutos extraídos con substring numérico líder -- tolera "25´"/"10''" (dato real de coach).';

COMMIT;

NOTIFY pgrst, 'reload schema';
