-- ============================================================
-- SPORTMAPS — Módulo de Dotación · Fase 2 (soporte UI)
-- RPC auxiliar: lista los entrenadores activos de una escuela para el
-- dropdown del modal de asignación. Solo admin de la escuela.
-- ============================================================
CREATE OR REPLACE FUNCTION public.equipment_list_coaches(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_rows jsonb;
BEGIN
    IF NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(jsonb_agg(
               jsonb_build_object('profile_id', sm.profile_id, 'full_name', p.full_name)
               ORDER BY p.full_name), '[]'::jsonb)
    INTO v_rows
    FROM public.school_members sm
    JOIN public.profiles p ON p.id = sm.profile_id
    WHERE sm.school_id = p_school_id
      AND sm.role = 'coach'
      AND sm.status = 'active';

    RETURN v_rows;
END;
$$;
GRANT EXECUTE ON FUNCTION public.equipment_list_coaches(uuid) TO authenticated;
