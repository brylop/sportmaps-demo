-- Cierra la escritura de team_tactical_presets al staff de la escuela.
--
-- Qué estaba mal (introducido por f1f720d, migración 20260819142729_tactical_presets_p2):
--
--   INSERT WITH CHECK (school_id = ANY (user_school_ids()) OR created_by = auth.uid())
--
-- La rama `OR created_by = auth.uid()` deja el school_id SIN ACOTAR: cualquier
-- usuario autenticado — de cualquier escuela, con cualquier rol — insertaba
-- presets tácticos en CUALQUIER escuela con solo ponerse a sí mismo en
-- created_by. Verificado evaluando el WITH CHECK con una sesión simulada contra
-- una escuela ajena: daba true.
--
-- Y las tres policies de escritura usaban user_school_ids(), que incluye a
-- padres y atletas (invariante I2): los familiares de la escuela podían
-- modificar y borrar la táctica de cualquier equipo.
--
-- El BFF sí guardaba bien (requireRole(TACTICAL_EDIT_ROLES) = owner/super_admin/
-- coach), pero la tabla tiene GRANT a authenticated y es alcanzable por
-- PostgREST directo, así que el BFF no era el único camino.
--
-- Radio medido antes de aplicar: 2 filas, 1 escuela, ninguna creada por alguien
-- ajeno a su escuela — el hueco no alcanzó a usarse.
--
-- Convenciones: el helper va envuelto en (SELECT …) para que Postgres lo evalúe
-- una vez por query y no una vez por fila.

BEGIN;

-- 1. Escritura: solo staff (user_staff_school_ids() excluye parent/athlete y
--    cubre coach por school_members, school_staff.coach_auth_id, por email, y
--    al owner por schools.owner_id).

DROP POLICY IF EXISTS "team_tactical_presets_insert" ON public.team_tactical_presets;
CREATE POLICY "team_tactical_presets_insert" ON public.team_tactical_presets
    FOR INSERT TO authenticated
    WITH CHECK (school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[]));

DROP POLICY IF EXISTS "team_tactical_presets_update" ON public.team_tactical_presets;
CREATE POLICY "team_tactical_presets_update" ON public.team_tactical_presets
    FOR UPDATE TO authenticated
    USING      (school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[]))
    WITH CHECK (school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[]));

DROP POLICY IF EXISTS "team_tactical_presets_delete" ON public.team_tactical_presets;
CREATE POLICY "team_tactical_presets_delete" ON public.team_tactical_presets
    FOR DELETE TO authenticated
    USING (school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[]));

-- 2. Lectura: se mantiene el alcance de miembro (user_school_ids()) — leer es el
--    uso correcto de esa función — pero acotada a authenticated, no a public.

DROP POLICY IF EXISTS "team_tactical_presets_select" ON public.team_tactical_presets;
CREATE POLICY "team_tactical_presets_select" ON public.team_tactical_presets
    FOR SELECT TO authenticated
    USING (school_id = ANY ((SELECT public.user_school_ids())::uuid[]));

-- 3. anon no tiene nada que hacer en esta tabla. Hoy las policies lo frenan
--    (auth.uid() es NULL), pero el GRANT existe y los default privileges del
--    esquema lo vuelven a otorgar: hay que revocar explícitamente.

REVOKE ALL ON public.team_tactical_presets FROM anon;

COMMIT;
