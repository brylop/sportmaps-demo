-- =============================================================================
-- 20260802224625_children_rls_solo_staff.sql
-- Autor: brylop   Fecha: 2026-08-03   Versión anterior: 20260802215226
-- Objetivo: cerrar el acceso de padres y atletas a las fichas de TODOS los
--   menores de su escuela. Hoy cualquier acudiente puede leerlas — y borrarlas.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================
--
-- HALLAZGO
--
-- `user_school_ids()` devuelve toda escuela donde el usuario tenga una fila activa
-- en school_members, SIN mirar el rol. Los acudientes tienen fila ahí (rol 'parent'),
-- así que las dos policies de `children` que dicen "staff" en el nombre los incluyen:
--
--   "Children: select staff"  SELECT  USING (school_id = ANY (user_school_ids()))
--   "Children: manage staff"  ALL     USING (school_id = ANY (user_school_ids()))
--
-- Verificado en la base (2026-08-02): un acudiente de DYNASTY VOLLEY CLUB alcanza las
-- 451 fichas de menores del club — nombre, fecha de nacimiento, medical_info y, vía
-- la vista school_athletes, el contacto de los demás acudientes. La segunda policy es
-- `ALL`, así que además habilita UPDATE y DELETE sobre el hijo de otra familia.
-- Alcance: 568 membresías 'parent' y 33 'athlete' activas en toda la base.
--
-- DECISIÓN
--
-- No se toca `user_school_ids()`: la usan ~70 policies en 12 migraciones y cambiarle
-- la semántica de golpe tiene un radio de impacto que no se puede verificar en un
-- paso. Se agrega un helper hermano, explícitamente de staff, y se apuntan a él las
-- dos policies de `children`. El resto de las tablas que confunden "miembro" con
-- "staff" queda para un barrido aparte.
--
-- El helper excluye por lista negra ('parent','athlete') en vez de exigir una lista
-- blanca de roles de staff: así ningún rol de staff existente pierde acceso hoy, que
-- es la forma de acotar el riesgo de esta migración a exactamente lo que se quiere
-- cambiar.
--
-- Lo que NO cambia:
--   · El acudiente sigue viendo, creando y editando a SUS hijos por las policies
--     "Children: select/insert/update parent" (auth.uid() = parent_id).
--   · El coach conserva sus dos policies propias y además entra por el helper.
--   · El BFF usa service_role y nunca pasó por RLS: sus flujos no se ven afectados.

BEGIN;

-- ── 1. Helper: escuelas donde el usuario es STAFF (no simple miembro) ───────
--
-- SECURITY DEFINER a propósito: lee school_members sin RLS para no crear recursión
-- cuando se la invoque desde policies de otras tablas.

CREATE OR REPLACE FUNCTION public.staff_school_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT COALESCE(ARRAY_AGG(school_id), ARRAY[]::uuid[])
  FROM public.school_members
  WHERE profile_id = auth.uid()
    AND status = 'active'
    AND role::text NOT IN ('parent', 'athlete');
$$;

COMMENT ON FUNCTION public.staff_school_ids() IS
    'Escuelas donde el usuario es staff. Igual que user_school_ids() pero excluyendo '
    'las membresías de consumo (parent/athlete). Usar esta en policies que quieren '
    'decir "trabaja en la escuela"; user_school_ids() solo dice "está vinculado a ella".';

-- Mismo patrón de grants que user_school_ids(): las policies también se evalúan para
-- anon, y sin EXECUTE la policy revienta con 403 en vez de devolver falso.
GRANT EXECUTE ON FUNCTION public.staff_school_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_school_ids() TO anon;

-- ── 2. Reapuntar las policies de children ──────────────────────────────────

DROP POLICY IF EXISTS "Children: select staff" ON public.children;
CREATE POLICY "Children: select staff"
    ON public.children
    FOR SELECT
    USING (school_id = ANY (public.staff_school_ids()));

DROP POLICY IF EXISTS "Children: manage staff" ON public.children;
CREATE POLICY "Children: manage staff"
    ON public.children
    FOR ALL
    USING (school_id = ANY (public.staff_school_ids()))
    WITH CHECK (school_id = ANY (public.staff_school_ids()));

COMMIT;

-- ── Verificación después de aplicar ────────────────────────────────────────
--
-- 1) Las policies quedaron apuntando al helper nuevo:
--
--    SELECT policyname, cmd, qual FROM pg_policies
--     WHERE tablename = 'children' AND policyname LIKE '%staff%';
--
-- 2) Un acudiente ya NO alcanza a los hijos de otros (debe devolver solo los suyos):
--
--    SET LOCAL ROLE authenticated;
--    SET LOCAL request.jwt.claims = '{"sub":"1a9a3189-e67f-49a7-9e87-d093fb288976","role":"authenticated"}';
--    SELECT count(*) FROM public.children WHERE school_id = '2d509571-3238-4c04-ac3f-6dfe20539226';
--    RESET ROLE;
--
--    Antes: 451. Después: solo los hijos de ese acudiente.
--
-- 3) Un owner/admin de la escuela sigue viendo las 451 (mismo bloque, con su uid).
