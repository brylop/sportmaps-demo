-- =============================================================================
-- TEAM_ID AUDIT — diagnostico post-rollback shift_to_teams
-- =============================================================================
-- Contexto: la migracion 20260226000053_rollback_shift_to_teams.sql droppea
-- team_id de enrollments y attendance_records, pero el frontend/BFF aun lo
-- referencia (SlotPicker.tsx:92-93, bff/src/routes/enrollments.ts:14).
--
-- Este script verifica:
--   0. Que columnas team_id quedan vivas en el schema actual (meta-diagnostico)
--   1. Si la tabla teams existe y tiene datos
--   2. Estructura actual de enrollments y attendance_records
--   3. Si las columnas team_id siguen vivas, calidad de los datos
--   4. Datos huerfanos detectables (enrollments sin school, etc)
--   5. Distribucion de datos para decidir escenario A vs B
--
-- Como ejecutar:
--   psql $STAGING_URL -f docs/diagnostics/team_id_audit.sql > team_id_report.txt
--   o bien copiar/pegar en el SQL Editor de Supabase staging
--
-- NO modifica nada. Solo lectura.
-- =============================================================================

\echo ''
\echo '================================================================'
\echo '0. META: columnas team_id vivas en el schema'
\echo '================================================================'
SELECT
    table_schema,
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name LIKE '%team%id%'
ORDER BY table_name, column_name;

\echo ''
\echo '================================================================'
\echo '1. TABLA teams: existe? cuantos registros?'
\echo '================================================================'
DO $$
DECLARE
    has_teams_table boolean;
    teams_count bigint;
    orphan_teams_count bigint;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'teams'
    ) INTO has_teams_table;

    IF NOT has_teams_table THEN
        RAISE NOTICE 'TABLA teams NO EXISTE en este schema';
        RETURN;
    END IF;

    EXECUTE 'SELECT COUNT(*) FROM public.teams' INTO teams_count;
    EXECUTE 'SELECT COUNT(*) FROM public.teams t LEFT JOIN public.schools s ON t.school_id = s.id WHERE s.id IS NULL' INTO orphan_teams_count;

    RAISE NOTICE 'teams total: %', teams_count;
    RAISE NOTICE 'teams huerfanos (sin school): %', orphan_teams_count;
END $$;

\echo ''
\echo '================================================================'
\echo '2. ESTRUCTURA de enrollments'
\echo '================================================================'
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'enrollments'
ORDER BY ordinal_position;

\echo ''
\echo '================================================================'
\echo '3. ESTRUCTURA de attendance_records'
\echo '================================================================'
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'attendance_records'
ORDER BY ordinal_position;

\echo ''
\echo '================================================================'
\echo '4. ENROLLMENTS: si team_id sigue vivo, calidad de datos'
\echo '================================================================'
DO $$
DECLARE
    has_col boolean;
    null_count bigint;
    total_count bigint;
    pct_null numeric;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'enrollments'
          AND column_name = 'team_id'
    ) INTO has_col;

    IF NOT has_col THEN
        RAISE NOTICE 'enrollments.team_id NO existe (rollback aplicado correctamente)';
        RAISE NOTICE 'CONCLUSION: el frontend/BFF que referencia team_id va a romper queries -> requiere refactor';
        RETURN;
    END IF;

    EXECUTE 'SELECT COUNT(*) FROM public.enrollments WHERE team_id IS NULL' INTO null_count;
    EXECUTE 'SELECT COUNT(*) FROM public.enrollments' INTO total_count;

    IF total_count = 0 THEN
        pct_null := 0;
    ELSE
        pct_null := ROUND(100.0 * null_count / total_count, 2);
    END IF;

    RAISE NOTICE 'enrollments total: %, team_id NULL: % (%.2f%%)', total_count, null_count, pct_null;
    IF pct_null > 50 THEN
        RAISE NOTICE 'ALERTA: mas del 50%% de enrollments tienen team_id NULL';
    END IF;
END $$;

\echo ''
\echo '================================================================'
\echo '5. ATTENDANCE_RECORDS: si team_id sigue vivo, calidad de datos'
\echo '================================================================'
DO $$
DECLARE
    has_col boolean;
    null_count bigint;
    total_count bigint;
    pct_null numeric;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'attendance_records'
          AND column_name = 'team_id'
    ) INTO has_col;

    IF NOT has_col THEN
        RAISE NOTICE 'attendance_records.team_id NO existe (rollback aplicado correctamente)';
        RETURN;
    END IF;

    EXECUTE 'SELECT COUNT(*) FROM public.attendance_records WHERE team_id IS NULL' INTO null_count;
    EXECUTE 'SELECT COUNT(*) FROM public.attendance_records' INTO total_count;

    IF total_count = 0 THEN
        pct_null := 0;
    ELSE
        pct_null := ROUND(100.0 * null_count / total_count, 2);
    END IF;

    RAISE NOTICE 'attendance_records total: %, team_id NULL: % (%.2f%%)', total_count, null_count, pct_null;
END $$;

\echo ''
\echo '================================================================'
\echo '6. ENROLLMENTS huerfanos (sin school, posible referencia rota)'
\echo '================================================================'
SELECT
    COUNT(*) AS total_enrollments,
    SUM(CASE WHEN school_id IS NULL THEN 1 ELSE 0 END) AS without_school,
    SUM(CASE WHEN s.id IS NULL AND e.school_id IS NOT NULL THEN 1 ELSE 0 END) AS school_id_no_match
FROM public.enrollments e
LEFT JOIN public.schools s ON s.id = e.school_id;

\echo ''
\echo '================================================================'
\echo '7. ENROLLMENTS por status (sample para decidir Escenario A o B)'
\echo '================================================================'
SELECT
    status,
    COUNT(*) AS cnt,
    MIN(created_at) AS oldest,
    MAX(created_at) AS newest
FROM public.enrollments
GROUP BY status
ORDER BY cnt DESC;

\echo ''
\echo '================================================================'
\echo '8. INSCRIPCIONES recientes por escuela (top 10)'
\echo '================================================================'
SELECT
    e.school_id,
    s.name AS school_name,
    COUNT(*) AS total_enrollments,
    MAX(e.created_at) AS last_enrollment
FROM public.enrollments e
LEFT JOIN public.schools s ON s.id = e.school_id
GROUP BY e.school_id, s.name
ORDER BY total_enrollments DESC
LIMIT 10;

\echo ''
\echo '================================================================'
\echo '9. SCHOOL_MEMBERS: existe? estructura?'
\echo '================================================================'
DO $$
DECLARE
    has_table boolean;
    members_count bigint;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'school_members'
    ) INTO has_table;

    IF NOT has_table THEN
        RAISE NOTICE 'school_members NO existe';
        RETURN;
    END IF;

    EXECUTE 'SELECT COUNT(*) FROM public.school_members' INTO members_count;
    RAISE NOTICE 'school_members total: %', members_count;
END $$;

SELECT
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'school_members'
ORDER BY ordinal_position;

\echo ''
\echo '================================================================'
\echo 'FIN DEL DIAGNOSTICO'
\echo '================================================================'
\echo ''
\echo 'CRITERIOS DE DECISION:'
\echo '  Escenario A (fix superficial): si en seccion 4/5 las columnas team_id'
\echo '    NO existen y solo hay codigo cliente referenciandolas -> refactor de'
\echo '    SlotPicker.tsx:92 y enrollments.ts:14 quitando el SELECT/JOIN.'
\echo ''
\echo '  Escenario B (recuperacion datos): si las columnas SI existen y tienen'
\echo '    >0 NULL en datos activos -> migracion UPDATE para recuperar referencias'
\echo '    cruzando con pagos/asistencias historicas.'
\echo ''
\echo '  Escenario C (corrupcion severa): si seccion 6 muestra muchos enrollments'
\echo '    sin school o con school_id que no matchea -> escalar antes de proceder.'
