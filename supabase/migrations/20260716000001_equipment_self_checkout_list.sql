-- ============================================================
-- SPORTMAPS — Módulo de Dotación · Fase 3 (soporte coach)
-- RPC coach-readable: lista los ítems que el entrenador PUEDE tomar en
-- autoservicio (respeta override por ítem + config global de la escuela +
-- disponibilidad). Encapsula la lógica de elegibilidad server-side, para que
-- el coach NO necesite leer equipment_settings (RLS admin-only).
-- ============================================================
CREATE OR REPLACE FUNCTION public.equipment_available_for_self_checkout(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_global boolean;
    v_rows   jsonb;
BEGIN
    IF NOT public._equipment_is_active_coach(p_school_id, auth.uid()) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(self_checkout_enabled, false) INTO v_global
    FROM public.equipment_settings WHERE school_id = p_school_id;

    SELECT COALESCE(jsonb_agg(
               jsonb_build_object(
                   'id', i.id, 'name', i.name, 'size', i.size,
                   'quantity_available', i.quantity_available, 'branch_id', i.branch_id
               ) ORDER BY i.name), '[]'::jsonb)
    INTO v_rows
    FROM public.equipment_items i
    WHERE i.school_id = p_school_id
      AND i.is_active = true
      AND i.quantity_available > 0
      AND CASE i.self_checkout_override
              WHEN 'bloqueado' THEN false
              WHEN 'permitido' THEN true
              ELSE COALESCE(v_global, false)
          END;

    RETURN v_rows;
END;
$$;
GRANT EXECUTE ON FUNCTION public.equipment_available_for_self_checkout(uuid) TO authenticated;
