-- =============================================================================
-- 20260814185120_padres_no_escriben_tablas_operativas.sql
-- Autor: brylop   Fecha: 2026-08-14   Versión anterior: 20260814184728
-- Objetivo: que un padre o un atleta no pueda escribir ni borrar en las tablas
--           operativas de la escuela.
--
-- Segunda tanda del barrido de `user_school_ids()`. La primera cerró las dos
-- escaladas de privilegios (20260814184457 y 20260814184728). Esta cierra el
-- daño operativo: hoy un padre puede borrar los equipos de su escuela, alterar
-- alineaciones, resultados, métricas de rendimiento, sesiones de asistencia y
-- recordatorios de pago. No se vuelve administrador, pero rompe datos de todos.
--
-- ── Por qué un helper distinto al de la primera tanda ───────────────────────
-- user_admin_school_ids() excluye a los coaches, y acá eso ROMPERÍA la
-- operación: el entrenador es justamente quien toma asistencia, arma equipos y
-- carga alineaciones. Se necesita "staff" (todo el que trabaja en la escuela),
-- no "administración".
--
-- user_staff_school_ids() = user_school_ids() MENOS los miembros cuyo rol es
-- parent o athlete. Se conservan las tres vías de acceso de coach que ya tenía
-- (school_members, coach_auth_id, y el fallback por email para coaches sin
-- coach_auth_id todavía). Radio de cambio mínimo: sale exactamente quien sobra.
--
-- ── Por qué el reemplazo es programático y no a mano ────────────────────────
-- Son 22 policies y varias tienen cláusulas OR propias que hay que preservar,
-- como `OR recorded_by = auth.uid()` o `OR created_by = auth.uid()`, que son las
-- que permiten a un atleta cargar su propio resultado. Copiarlas a mano es la
-- forma más fácil de perder una y dejar a alguien sin poder trabajar.
--
-- El DO lee la expresión real de pg_policies y sustituye SOLO el nombre de la
-- función. Nada más cambia.
--
-- Se excluyen a propósito:
--   · school_staff — ya quedó cerrada en las dos migraciones anteriores.
--   · Las policies que ya validan rol (no hace falta tocarlas).
--   · Todas las de SELECT — que un padre VEA la lista de equipos u ofertas es
--     correcto y necesario. La lectura se revisa aparte, caso por caso.
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

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: escuelas donde el usuario TRABAJA (staff), no donde es familia.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.user_staff_school_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT COALESCE(ARRAY(
    -- Miembros que NO son familia: owner, admin, coach, reporter…
    SELECT sm.school_id
      FROM public.school_members sm
     WHERE sm.profile_id = auth.uid()
       AND sm.status = 'active'
       AND sm.role NOT IN ('parent', 'athlete')

    UNION

    -- Coach con su cuenta ya vinculada (vía principal)
    SELECT ss.school_id
      FROM public.school_staff ss
     WHERE ss.coach_auth_id = auth.uid()
       AND ss.status = 'active'

    UNION

    -- Coach sin coach_auth_id todavía (legacy, se resuelve por email)
    SELECT ss.school_id
      FROM public.school_staff ss
      JOIN auth.users au ON LOWER(au.email) = LOWER(ss.email)
     WHERE au.id = auth.uid()
       AND ss.coach_auth_id IS NULL
       AND ss.status = 'active'

    UNION

    -- Dueño registrado solo en schools.owner_id
    SELECT s.id
      FROM public.schools s
     WHERE s.owner_id = auth.uid()
  ), '{}'::uuid[]);
$$;

COMMENT ON FUNCTION public.user_staff_school_ids() IS
    'Escuelas donde el usuario TRABAJA: igual que user_school_ids() pero sin los '
    'miembros cuyo rol es parent o athlete. Usar en policies de ESCRITURA de '
    'tablas operativas. Para permisos que otorgan permisos usar '
    'user_admin_school_ids(), que ademas excluye coaches.';

REVOKE ALL ON FUNCTION public.user_staff_school_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_staff_school_ids() TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Sustitución de la función en las policies de ESCRITURA
--
-- ALTER POLICY conserva cmd, roles y permissive; solo se reescriben las
-- expresiones, tomadas de pg_policies para no perder ninguna cláusula OR.
-- ─────────────────────────────────────────────────────────────────────────────
DO $migracion$
DECLARE
    r        record;
    v_using  text;
    v_check  text;
BEGIN
    FOR r IN
        SELECT tablename, policyname, qual, with_check
          FROM pg_policies
         WHERE schemaname = 'public'
           AND cmd IN ('ALL', 'INSERT', 'UPDATE', 'DELETE')
           AND tablename <> 'school_staff'
           AND (qual LIKE '%user_school_ids%' OR with_check LIKE '%user_school_ids%')
           -- Las que ya validan rol quedan como están.
           AND COALESCE(qual, '') || COALESCE(with_check, '') NOT LIKE '%role%'
    LOOP
        v_using := replace(COALESCE(r.qual, ''),       'user_school_ids()', 'user_staff_school_ids()');
        v_check := replace(COALESCE(r.with_check, ''), 'user_school_ids()', 'user_staff_school_ids()');

        IF r.qual IS NOT NULL AND r.with_check IS NOT NULL THEN
            EXECUTE format('ALTER POLICY %I ON public.%I USING (%s) WITH CHECK (%s)',
                           r.policyname, r.tablename, v_using, v_check);
        ELSIF r.qual IS NOT NULL THEN
            EXECUTE format('ALTER POLICY %I ON public.%I USING (%s)',
                           r.policyname, r.tablename, v_using);
        ELSE
            EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (%s)',
                           r.policyname, r.tablename, v_check);
        END IF;
    END LOOP;
END
$migracion$;

COMMIT;
