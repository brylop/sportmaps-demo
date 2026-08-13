-- ============================================================================
-- SPORTMAPS — El bloqueo por fin de prueba también en RLS (Fase A)
--
-- Fecha: 2026-08-12
-- Cierra el hueco que quedó abierto en 20260812125503: el middleware del BFF
-- solo protege lo que pasa por el BFF, y el navegador escribe DIRECTO a
-- Supabase en 34 sitios. Una escuela inhabilitada todavía podía registrar
-- pagos, equipos, gastos, inscripciones e invitaciones por esa vía.
--
-- ── Por qué policies RESTRICTIVE y no tocar las que ya existen ──────────────
-- La convención del repo pide revisar policies línea por línea antes de
-- aplicar, y con razón: reescribir ~70 policies para colgarles un AND es la
-- forma más rápida de tumbar todo con 403. Postgres permite algo mucho más
-- seguro: una policy RESTRICTIVE se combina con AND sobre las permissive que
-- ya están, sin modificar ninguna. Additiva, y se revierte con DROP POLICY.
--
-- ── Tres decisiones que importan ────────────────────────────────────────────
-- 1. NUNCA sobre SELECT. Se crean policies separadas para INSERT/UPDATE/DELETE.
--    Un `FOR ALL` restrictive también aplicaría a SELECT y dejaría a la escuela
--    bloqueada sin poder ni leer lo suyo — justo lo contrario de lo acordado
--    ("bloqueado nunca significa sin datos").
-- 2. NO se enciende RLS en ninguna tabla. Encender RLS donde no estaba deniega
--    todo de inmediato (sin permissive policies, todo queda denegado). Por eso
--    el bloque solo agrega la policy donde `relrowsecurity` YA es true, y las
--    que quedan fuera se reportan al final en vez de fingir que están cubiertas.
-- 3. Solo a `authenticated`. Es el agujero medido (escrituras del navegador con
--    sesión). `service_role` tiene BYPASSRLS, así que el BFF no se ve afectado
--    y sigue mandando su 402 con el mensaje bueno.
--
-- Nota de rendimiento: `school_is_operational(school_id)` depende de la fila, así
-- que no se puede cachear como InitPlan envolviéndola en (SELECT …). Acá no
-- duele: estas policies solo corren en INSERT/UPDATE/DELETE, que tocan pocas
-- filas — no en los SELECT masivos que son el problema de rendimiento conocido.
--
-- FALTA (Fase B, no entra acá): los RPC `SECURITY DEFINER` que escriben también
-- saltan RLS por definición. Los que importan: submit_qr_signup,
-- create_invitation, create_school_join_qr, generate_qr_monthly_charge,
-- request_athlete_certificate, issue_athlete_certificate, notify_user.
-- Cada uno necesita su propio guard; va en migración aparte.
-- ============================================================================

BEGIN;

DO $$
DECLARE
    -- Tablas con school_id que el navegador escribe directo (medido sobre
    -- frontend/src: 34 llamadas .insert/.update/.upsert/.delete).
    v_tablas   text[] := ARRAY[
        'payments', 'enrollments', 'expenses', 'teams', 'team_coaches',
        'team_branches', 'school_branches', 'invitations', 'notifications',
        'products', 'academic_progress', 'athlete_id_card_templates',
        'payment_reminder_logs', 'school_settings'
    ];
    v_tabla    text;
    v_sin_rls  text[] := '{}';
    v_no_existe text[] := '{}';
    v_aplicada text[] := '{}';
BEGIN
    FOREACH v_tabla IN ARRAY v_tablas LOOP

        -- ¿Existe la tabla?
        IF NOT EXISTS (
            SELECT 1 FROM pg_class c
              JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = v_tabla AND c.relkind = 'r'
        ) THEN
            v_no_existe := v_no_existe || v_tabla;
            CONTINUE;
        END IF;

        -- ¿Tiene RLS encendido? Si no, se salta: encenderlo acá dejaría la
        -- tabla denegando todo. Queda reportado para decidirlo aparte.
        IF NOT EXISTS (
            SELECT 1 FROM pg_class c
              JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = v_tabla AND c.relrowsecurity
        ) THEN
            v_sin_rls := v_sin_rls || v_tabla;
            CONTINUE;
        END IF;

        -- Idempotente: se rehacen las tres policies en cada corrida.
        EXECUTE format('DROP POLICY IF EXISTS trial_block_insert ON public.%I', v_tabla);
        EXECUTE format('DROP POLICY IF EXISTS trial_block_update ON public.%I', v_tabla);
        EXECUTE format('DROP POLICY IF EXISTS trial_block_delete ON public.%I', v_tabla);

        EXECUTE format($f$
            CREATE POLICY trial_block_insert ON public.%I
                AS RESTRICTIVE FOR INSERT TO authenticated
                WITH CHECK (public.school_is_operational(school_id))
        $f$, v_tabla);

        EXECUTE format($f$
            CREATE POLICY trial_block_update ON public.%I
                AS RESTRICTIVE FOR UPDATE TO authenticated
                USING (public.school_is_operational(school_id))
                WITH CHECK (public.school_is_operational(school_id))
        $f$, v_tabla);

        EXECUTE format($f$
            CREATE POLICY trial_block_delete ON public.%I
                AS RESTRICTIVE FOR DELETE TO authenticated
                USING (public.school_is_operational(school_id))
        $f$, v_tabla);

        v_aplicada := v_aplicada || v_tabla;
    END LOOP;

    -- El SQL editor de Supabase no muestra RAISE NOTICE. En vez de dejar una
    -- tabla de reporte tirada en el esquema, el resultado se consulta abajo
    -- leyendo pg_policies, que además dice la verdad y no lo que creemos.
    IF cardinality(v_no_existe) > 0 THEN
        RAISE EXCEPTION 'Tablas inexistentes en la lista: %. Corrige la migración antes de aplicar.', v_no_existe;
    END IF;
END $$;

COMMIT;

-- ────────────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN — léela, no la saltes.
--
-- `rls_encendido = false` significa que esa tabla NO quedó cubierta: el
-- bloqueo no aplica ahí. Encender RLS no se hace a la ligera — sin policies
-- permissive previas, la tabla queda denegando todo.
-- `policies_trial` debe ser 3 (insert/update/delete) en las cubiertas.
-- ────────────────────────────────────────────────────────────────────────────
SELECT
    c.relname                                             AS tabla,
    c.relrowsecurity                                      AS rls_encendido,
    count(p.polname) FILTER (WHERE p.polname LIKE 'trial_block_%') AS policies_trial,
    CASE
        WHEN NOT c.relrowsecurity THEN 'DESCUBIERTA — RLS apagado'
        WHEN count(p.polname) FILTER (WHERE p.polname LIKE 'trial_block_%') = 3 THEN 'OK'
        ELSE 'REVISAR'
    END                                                   AS estado
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_policy p ON p.polrelid = c.oid
 WHERE n.nspname = 'public'
   AND c.relname = ANY (ARRAY[
        'payments', 'enrollments', 'expenses', 'teams', 'team_coaches',
        'team_branches', 'school_branches', 'invitations', 'notifications',
        'products', 'academic_progress', 'athlete_id_card_templates',
        'payment_reminder_logs', 'school_settings'
   ])
 GROUP BY c.relname, c.relrowsecurity
 ORDER BY c.relrowsecurity, c.relname;
