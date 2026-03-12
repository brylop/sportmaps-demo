-- =============================================================================
-- ROLLBACK: 20260301_fix_coach_children_rls (partes 1 y 2 únicamente)
-- =============================================================================

-- ─── PARTE 2: Eliminar trigger y función de sincronización ───────────────────
DROP TRIGGER IF EXISTS trg_sync_staff_to_school_members ON public.school_staff;
DROP FUNCTION IF EXISTS public.sync_staff_to_school_members();

-- ─── PARTE 1: Restaurar user_school_ids() a su versión anterior ──────────────
CREATE OR REPLACE FUNCTION public.user_school_ids()
RETURNS uuid[] LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE(ARRAY(
    SELECT school_id FROM public.school_members
    WHERE profile_id = auth.uid() AND status = 'active'
  ), '{}'::uuid[]);
$$;
