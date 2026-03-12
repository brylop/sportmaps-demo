-- =============================================================================
-- FIX: Coaches en school_staff sin registro en school_members no ven sus alumnos
-- Fecha: 2026-03-01
--
-- Raíz del problema:
--   user_school_ids() solo consulta school_members (por profile_id = auth.uid()).
--   Los coaches agregados directamente en school_staff (sin pasar por el flujo
--   de invitación) no tienen registro en school_members, por lo que la función
--   devuelve array vacío y la política "Children: select staff" bloquea todo.
--   Solo ven los children donde parent_id = auth.uid() (~2 registros).
--
-- Solución:
--   1. Expandir user_school_ids() para incluir también los school_id de school_staff
--      donde el email del coach coincide con el usuario autenticado.
--   2. Backfill directo: sincronizar school_staff activos → school_members.
--
-- NOTA: Se eliminó el trigger de sincronización porque colisionaba con el
--   trigger existente sync_coach_to_staff (school_members → school_staff),
--   formando un loop infinito que provoca "stack depth limit exceeded".
--   La expansión de user_school_ids() (parte 1) es suficiente como fix permanente.
-- =============================================================================


-- ─── 1. AMPLIAR user_school_ids() ────────────────────────────────────────────
-- Ahora retorna los school_ids del usuario via:
--   a) school_members (todos los roles, flujo estándar)
--   b) school_staff (coaches agregados manualmente sin invitation flow)
--
-- SECURITY DEFINER permite leer auth.users para hacer el JOIN por email.

CREATE OR REPLACE FUNCTION public.user_school_ids()
RETURNS uuid[] LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE(ARRAY(
    -- Vía school_members (flujo estándar para todos los roles)
    SELECT sm.school_id
    FROM public.school_members sm
    WHERE sm.profile_id = auth.uid()
      AND sm.status = 'active'

    UNION

    -- Vía school_staff (coaches creados directamente sin pasar por invitación)
    SELECT ss.school_id
    FROM public.school_staff ss
    JOIN auth.users au ON LOWER(au.email) = LOWER(ss.email)
    WHERE au.id = auth.uid()
      AND ss.status = 'active'
  ), '{}'::uuid[]);
$$;


-- ─── 2. BACKFILL: Sincronizar school_staff activos existentes → school_members ──
-- Aplica la misma lógica a todos los registros ya existentes en school_staff
-- para que los coaches actuales queden cubiertos de inmediato.
-- No usa trigger para evitar el loop con sync_coach_to_staff.

DO $$
DECLARE
  rec RECORD;
  v_profile_id uuid;
BEGIN
  FOR rec IN
    SELECT ss.id, ss.school_id, ss.email
    FROM public.school_staff ss
    WHERE ss.status = 'active'
  LOOP
    SELECT au.id INTO v_profile_id
    FROM auth.users au
    WHERE LOWER(au.email) = LOWER(rec.email)
    LIMIT 1;

    IF v_profile_id IS NOT NULL THEN
      INSERT INTO public.school_members (school_id, profile_id, role, status)
      VALUES (rec.school_id, v_profile_id, 'coach', 'active')
      ON CONFLICT (school_id, profile_id) DO UPDATE
        SET status = 'active',
            role   = CASE
                       WHEN school_members.role IN ('owner', 'admin') THEN school_members.role
                       ELSE 'coach'
                     END;
    END IF;
  END LOOP;
END $$;
