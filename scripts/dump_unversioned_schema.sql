-- =============================================================================
-- dump_unversioned_schema.sql
-- Objetivo: volcar el DDL REAL de las tablas que existen en la base compartida
--           pero que NINGUNA migración del repo crea.
--
-- Por qué: `supabase/migrations/` no contiene un CREATE TABLE para
--   sport_metric_definitions, sport_metric_thresholds, performance_entries,
--   competition_results ni unregistered_athletes. Se crearon fuera del repo.
--   Consecuencias medibles:
--     · La cadena de migraciones NO reproduce la base desde cero. Sobre una
--       base limpia, 20260731123145 (F0) falla: hace ALTER TABLE sobre
--       sport_metric_definitions, que nadie creó. El `IF NOT EXISTS` es de la
--       COLUMNA, no de la tabla — no salva nada.
--     · F1 del informe mensual lee performance_entries para armar el snapshot.
--       Construir sobre una tabla no versionada deja el módulo sin línea base.
--
-- Qué hacer con el resultado: con este volcado se escribe UNA migración de
--   regularización (`CREATE TABLE IF NOT EXISTS` + índices + policies), que es
--   inocua contra la base actual (ya existen) y le da línea base a una limpia.
--
-- Gotchas del SQL Editor de Supabase (ya conocidos):
--   · No usar CREATE TEMP TABLE — el pooler la pierde entre sentencias.
--   · No usar RAISE NOTICE — no se ve en la salida.
--   · Reportar con un SELECT final. Este script ES un solo SELECT.
--
-- Uso: pegar completo en el SQL Editor y exportar el resultado.
-- =============================================================================

WITH objetivo(tabla) AS (
    VALUES ('sport_metric_definitions'),
           ('sport_metric_thresholds'),
           ('performance_entries'),
           ('competition_results'),
           ('unregistered_athletes')
)

-- ── 1. ¿Existe cada tabla, y tiene RLS activa? ───────────────────────────────
SELECT o.tabla,
       1                             AS seccion,
       'existencia'                  AS tipo,
       0                             AS ord,
       COALESCE(c.relname, '(NO EXISTE)')  AS nombre,
       CASE
           WHEN c.oid IS NULL THEN 'la tabla no existe en esta base'
           ELSE 'rls_activa=' || c.relrowsecurity::text
                || ' forzada=' || c.relforcerowsecurity::text
                || ' filas_aprox=' || c.reltuples::bigint::text
       END                           AS definicion
FROM objetivo o
LEFT JOIN pg_class c
       ON c.relname = o.tabla
      AND c.relnamespace = 'public'::regnamespace
      AND c.relkind = 'r'

UNION ALL

-- ── 2. Columnas, en orden, con tipo / NOT NULL / DEFAULT ─────────────────────
SELECT c.relname,
       2,
       'columna',
       a.attnum,
       a.attname,
       format_type(a.atttypid, a.atttypmod)
           || CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END
           || COALESCE(' DEFAULT ' || pg_get_expr(d.adbin, d.adrelid), '')
FROM pg_attribute a
JOIN pg_class     c ON c.oid = a.attrelid
JOIN objetivo     o ON o.tabla = c.relname
LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
WHERE c.relnamespace = 'public'::regnamespace
  AND a.attnum > 0
  AND NOT a.attisdropped

UNION ALL

-- ── 3. Constraints (PK, FK, UNIQUE, CHECK) tal cual las tiene la base ────────
--    Interesa sobre todo cómo resuelven el eje polimórfico subject_type +
--    subject_id: si performance_entries lo valida con CHECK, con trigger o con
--    nada, athlete_reports debe hacer lo mismo y no inventar otra convención.
SELECT c.relname,
       3,
       'constraint',
       con.oid::bigint,
       con.conname,
       pg_get_constraintdef(con.oid)
FROM pg_constraint con
JOIN pg_class      c ON c.oid = con.conrelid
JOIN objetivo      o ON o.tabla = c.relname
WHERE c.relnamespace = 'public'::regnamespace

UNION ALL

-- ── 4. Índices (incluye los únicos parciales, que es donde dolió en payments) ─
SELECT i.tablename,
       4,
       'indice',
       0,
       i.indexname,
       i.indexdef
FROM pg_indexes i
JOIN objetivo o ON o.tabla = i.tablename
WHERE i.schemaname = 'public'

UNION ALL

-- ── 5. Policies de RLS ───────────────────────────────────────────────────────
SELECT p.tablename,
       5,
       'policy',
       0,
       p.policyname,
       'FOR ' || p.cmd
           || ' TO ' || array_to_string(p.roles, ', ')
           || ' USING (' || COALESCE(p.qual, '—') || ')'
           || ' WITH CHECK (' || COALESCE(p.with_check, '—') || ')'
FROM pg_policies p
JOIN objetivo o ON o.tabla = p.tablename
WHERE p.schemaname = 'public'

UNION ALL

-- ── 6. GRANTs por rol ────────────────────────────────────────────────────────
SELECT g.table_name,
       6,
       'grant',
       0,
       g.grantee,
       string_agg(g.privilege_type, ', ' ORDER BY g.privilege_type)
FROM information_schema.role_table_grants g
JOIN objetivo o ON o.tabla = g.table_name
WHERE g.table_schema = 'public'
GROUP BY g.table_name, g.grantee

UNION ALL

-- ── 7. Triggers (auditoría, updated_at, validaciones del eje polimórfico) ────
SELECT c.relname,
       7,
       'trigger',
       0,
       t.tgname,
       pg_get_triggerdef(t.oid)
FROM pg_trigger t
JOIN pg_class   c ON c.oid = t.tgrelid
JOIN objetivo   o ON o.tabla = c.relname
WHERE c.relnamespace = 'public'::regnamespace
  AND NOT t.tgisinternal

ORDER BY 1, 2, 4, 5;
