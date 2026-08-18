-- ============================================================================
-- TRUNCATE no pasa por RLS, y `authenticated` lo tenía en todas las tablas
--
-- Fecha: 2026-08-17
-- Encontrado al verificar la migración de `memberships` (20260817142331): el
-- bloque de privilegios devolvió, para el rol `authenticated`, mucho más de lo
-- que la migración concede.
--
-- ── El agujero ──────────────────────────────────────────────────────────────
-- La migración de memberships concede exactamente esto:
--
--     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.memberships TO authenticated;
--
-- y la base terminó con SELECT, INSERT, UPDATE, DELETE, **TRUNCATE**, TRIGGER y
-- REFERENCES. No los agregó la migración: los agregan los **default privileges**
-- del esquema, que otorgan ALL a `authenticated` sobre cada tabla nueva. El
-- GRANT explícito es aditivo, así que no acota nada.
--
-- Y esto importa porque **TRUNCATE no está sujeto a row level security**. RLS
-- filtra SELECT / INSERT / UPDATE / DELETE; TRUNCATE no. O sea: cualquier
-- usuario con sesión iniciada —un padre, un atleta— podía vaciar tablas
-- completas de TODAS las escuelas, sin que ninguna policy lo detuviera.
--
-- Es la misma trampa que ya está documentada en CLAUDE.md para las funciones
-- («REVOKE ALL … FROM PUBLIC no alcanza: los default privileges otorgan EXECUTE
-- a authenticated en cada función nueva»), pero para TABLAS. La diferencia es
-- que en tablas se venía confiando en que RLS tapaba todo, y para TRUNCATE no
-- tapa nada.
--
-- ── Los otros dos privilegios ───────────────────────────────────────────────
-- `TRIGGER` deja crear triggers sobre la tabla: código que corre en cada
-- escritura ajena. `REFERENCES` deja crear claves foráneas contra ella, lo que
-- permite bloquear borrados de filas que no son de uno. Ninguno de los dos hace
-- falta para operar por PostgREST, que solo emite SELECT/INSERT/UPDATE/DELETE.
--
-- ── Si la verificación no da 0 ──────────────────────────────────────────────
-- El REVOKE apunta a `authenticated` y `anon` porque eso es lo que muestra la
-- base hoy: grants DIRECTOS a esos roles. Si el privilegio viniera heredado de
-- `PUBLIC`, este REVOKE no lo quitaría — es la misma trampa que CLAUDE.md
-- documenta para las funciones. No se revoca de PUBLIC a ciegas porque
-- `service_role` (el BFF y los crons) también aparece con TRUNCATE, y si el suyo
-- colgara de PUBLIC lo estaríamos rompiendo.
--
-- Por eso la verificación cuenta cuántas tablas quedan: si da 0, cerrado. Si da
-- más que 0, el origen es PUBLIC y hay que revocarlo de ahí volviendo a conceder
-- TRUNCATE explícitamente a `service_role` en la misma migración.
--
-- ── Por qué es seguro revocarlos ────────────────────────────────────────────
-- El BFF y los crons trabajan con `service_role`, que conserva todo. El frontend
-- va por PostgREST como `authenticated`/`anon`, y PostgREST **no expone
-- TRUNCATE** en ninguna ruta: no hay forma de que la app dependiera de esto.
-- ============================================================================

BEGIN;

-- ── 1. Quitarlo de todo lo que ya existe ────────────────────────────────────
-- Uno por uno y no con `ALL TABLES IN SCHEMA`, para no tocar de rebote los
-- privilegios que sí hacen falta.
DO $$
DECLARE
    v_tabla   text;
    v_tocadas int := 0;
BEGIN
    FOR v_tabla IN
        SELECT c.relname
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relkind IN ('r', 'p')          -- tablas y particionadas; las vistas no truncan
         ORDER BY c.relname
    LOOP
        EXECUTE format(
            'REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE public.%I FROM authenticated, anon',
            v_tabla
        );
        v_tocadas := v_tocadas + 1;
    END LOOP;

    RAISE NOTICE 'TRUNCATE/TRIGGER/REFERENCES revocados a authenticated y anon en % tablas', v_tocadas;
END;
$$;

-- ── 2. Que no vuelva en las tablas nuevas ───────────────────────────────────
-- Los default privileges son POR ROL CREADOR. Se cubren los que crean objetos
-- acá: `postgres` (el SQL editor y las migraciones) y `supabase_admin`.
-- Si aparece un tercero, la verificación de abajo lo delata en la próxima tabla.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM authenticated, anon;

DO $$
BEGIN
    -- `supabase_admin` puede no existir o no ser alterable según el proyecto: se
    -- intenta y se sigue, en vez de abortar toda la migración por eso.
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
             REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM authenticated, anon';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'No se pudieron ajustar los default privileges de supabase_admin (%). '
                 'Revisar si aparece una tabla nueva con TRUNCATE para authenticated.', SQLERRM;
END;
$$;

-- ── 3. Que quede vigilado: invariante I5 ────────────────────────────────────
-- I1..I4 van COPIADOS TAL CUAL de 20260814195535, que es la version viva. Un
-- CREATE OR REPLACE reemplaza la funcion entera, asi que reescribirlos de
-- memoria los habria degradado en silencio: la I1 real trae una lista blanca de
-- ~40 tablas publicas por diseno y la I2 excluye las policies que SI chequean
-- rol. Solo se agrega el bloque I5 al final.
CREATE OR REPLACE FUNCTION public.invariantes_seguridad()
RETURNS TABLE (invariante text, gravedad text, objeto text, detalle text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    -- I1 · Datos privados legibles SIN autenticación.
    -- Hacen falta las DOS cosas: que la policy alcance a anon/public Y que anon
    -- tenga el GRANT de tabla. Con una sola, no se lee nada.
    SELECT
        'I1_tabla_privada_publica'::text, 'CRITICA'::text, p.tablename::text,
        ('policy "' || p.policyname || '" es USING(true), alcanza a ' || p.roles::text ||
         ' y anon tiene SELECT')::text
      FROM pg_policies p
      JOIN pg_class c ON c.relname = p.tablename
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
     WHERE p.schemaname = 'public' AND c.relkind = 'r'
       AND p.cmd IN ('SELECT','ALL') AND p.permissive = 'PERMISSIVE'
       AND btrim(coalesce(p.qual,'')) IN ('true','(true)')
       AND (p.roles::text[] && ARRAY['public','anon'])
       AND has_table_privilege('anon', c.oid, 'SELECT')
       AND p.tablename NOT IN (
            'schools','school_branches','teams','classes','facilities',
            'events','event_categories_config','event_price_phases',
            'products','product_images','product_variants','product_brands',
            'product_brand_categories','product_categories','product_questions',
            'product_reviews','product_review_media','product_review_votes',
            'reviews','vendor_reviews','vendor_profiles',
            'service_listings','service_variations','service_availability',
            'offerings','offering_plans','subscription_plans',
            'sports_categories','sports_equipment','sport_configs',
            'sport_category_templates','sport_metric_definitions','sport_metric_thresholds',
            'exercise_analyzers','exercise_analyzer_mappings',
            'marketplace_shipping_zones','marketplace_shipping_rates','shipping_zones',
            'platform_config','school_availability','coach_availability',
            'school_onboarding_configs','trainer_profiles','template_variables',
            'attendance_polls','roles')
    UNION ALL
    SELECT
        'I2_familia_puede_escribir'::text, 'CRITICA'::text,
        (p.tablename || '.' || p.policyname)::text,
        ('policy ' || p.cmd || ' usa user_school_ids() sin chequeo de rol')::text
      FROM pg_policies p
     WHERE p.schemaname = 'public'
       AND p.cmd IN ('ALL','INSERT','UPDATE','DELETE')
       AND (coalesce(p.qual,'') LIKE '%user_school_ids%' OR coalesce(p.with_check,'') LIKE '%user_school_ids%')
       AND coalesce(p.qual,'') || coalesce(p.with_check,'') NOT LIKE '%role%'
       AND NOT (p.tablename = 'school_staff' AND p.policyname = 'Staff manage themselves')
    UNION ALL
    SELECT
        'I3_for_all_sin_with_check'::text, 'ALTA'::text,
        (p.tablename || '.' || p.policyname)::text,
        'FOR ALL sin WITH CHECK: el USING valida los INSERT'::text
      FROM pg_policies p
     WHERE p.schemaname = 'public' AND p.cmd = 'ALL'
       AND p.permissive = 'PERMISSIVE' AND p.with_check IS NULL AND p.qual IS NOT NULL
    UNION ALL
    SELECT
        'I4_definer_sin_search_path'::text, 'MEDIA'::text, p.proname::text,
        'SECURITY DEFINER sin SET search_path'::text
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prosecdef
       AND (p.proconfig IS NULL OR NOT EXISTS (
            SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%'))
    UNION ALL
    -- I5 · TRUNCATE en manos de un usuario cualquiera.
    -- TRUNCATE **no pasa por RLS**: ninguna policy lo detiene. Con este privilegio
    -- cualquier sesion iniciada vacia la tabla de TODAS las escuelas. No lo dan las
    -- migraciones sino los default privileges del esquema, asi que reaparece solo
    -- con cada tabla nueva si nadie mira. Se sumo el 2026-08-17, al ver que la
    -- verificacion de `memberships` devolvia TRUNCATE para authenticated sin que la
    -- migracion lo concediera.
    SELECT
        'I5_truncate_a_usuario_comun'::text, 'CRITICA'::text, c.relname::text,
        ('el rol ' || r.rolname || ' puede TRUNCATE, y TRUNCATE no pasa por RLS')::text
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      CROSS JOIN (SELECT unnest(ARRAY['authenticated','anon']) AS rolname) r
     WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
       AND has_table_privilege(r.rolname, c.oid, 'TRUNCATE')
$$;

COMMENT ON FUNCTION public.invariantes_seguridad() IS
    'Afirma contra la base viva las reglas de seguridad que no se pueden romper. '
    'Existe porque el registro de migraciones no dice que esta aplicado (el SQL '
    'editor no deja rastro) y las fugas del 2026-08-14 se encontraron mirando '
    'pg_policies, no el repo. I5 se sumo el 2026-08-17: TRUNCATE no pasa por RLS '
    'y los default privileges se lo daban a authenticated en cada tabla nueva. '
    'Devuelve una fila por violacion; vacio = todo bien.';

REVOKE ALL ON FUNCTION public.invariantes_seguridad() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.invariantes_seguridad() FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.invariantes_seguridad() TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ────────────────────────────────────────────────────────────────────────────
-- Verificación
-- ────────────────────────────────────────────────────────────────────────────

-- 1. Cuántas tablas quedan con TRUNCATE para un usuario común. Debe dar 0.
SELECT r.rolname,
       count(*) AS tablas_con_truncate
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN (SELECT unnest(ARRAY['authenticated', 'anon']) AS rolname) r
 WHERE n.nspname = 'public'
   AND c.relkind IN ('r', 'p')
   AND has_table_privilege(r.rolname, c.oid, 'TRUNCATE')
 GROUP BY r.rolname;

-- 2. Que las operaciones normales SIGAN estando. `memberships` como muestra:
--    se esperan SELECT/INSERT/UPDATE/DELETE en true y TRUNCATE/TRIGGER en false.
SELECT 'memberships' AS tabla,
       has_table_privilege('authenticated', 'public.memberships', 'SELECT')   AS puede_leer,
       has_table_privilege('authenticated', 'public.memberships', 'INSERT')   AS puede_insertar,
       has_table_privilege('authenticated', 'public.memberships', 'UPDATE')   AS puede_actualizar,
       has_table_privilege('authenticated', 'public.memberships', 'DELETE')   AS puede_borrar,
       has_table_privilege('authenticated', 'public.memberships', 'TRUNCATE') AS puede_truncar,
       has_table_privilege('authenticated', 'public.memberships', 'TRIGGER')  AS puede_trigger;

-- 3. El invariante nuevo, corrido contra la base. Debe volver vacío para I5.
SELECT invariante, gravedad, count(*) AS violaciones
  FROM public.invariantes_seguridad()
 GROUP BY invariante, gravedad
 ORDER BY invariante;
