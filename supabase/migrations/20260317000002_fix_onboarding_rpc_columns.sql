-- ============================================================================
-- MIGRACIÓN: Corregir desajuste de esquema en RPC de Onboarding
-- Fecha: 2026-03-17
-- Descripción: Corrige nombres de columnas y tablas basándose en el esquema real:
--              - Reemplaza 'students' por 'children'.
--              - Reemplaza 'student_id' por 'user_id' (atletas) o 'child_id' (padres).
--              - Usa 'status' en lugar de 'is_active' para inscripciones.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_onboarding_status()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role public.user_role;
  v_school_id uuid;
  v_email_verified boolean;
  v_result jsonb;
BEGIN
  -- Obtener rol y estado de verificación de email
  SELECT role INTO v_role FROM public.profiles WHERE id = v_user_id;
  
  -- Verificar si el email está confirmado
  v_email_verified := (auth.jwt() ->> 'email_confirmed_at') IS NOT NULL;

  -- Obtener la escuela activa
  SELECT school_id INTO v_school_id 
  FROM public.school_members 
  WHERE profile_id = v_user_id 
  AND status = 'active'
  ORDER BY joined_at DESC 
  LIMIT 1;

  SELECT jsonb_build_object(
    'role', v_role,
    'school_id', v_school_id,
    'email_verified', v_email_verified,
    
    -- Flags generales de perfil
    'profile_complete', (
        SELECT (
            full_name IS NOT NULL AND full_name != 'Usuario' AND
            phone IS NOT NULL AND
            date_of_birth IS NOT NULL AND
            (role != 'athlete' OR (bio IS NOT NULL OR (sports_interests IS NOT NULL AND array_length(sports_interests, 1) > 0)))
        ) 
        FROM public.profiles 
        WHERE id = v_user_id
    ),
    'has_avatar', (SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = v_user_id AND avatar_url IS NOT NULL)),
    
    -- Flags comunes de vinculación
    'has_pending_invitation', (SELECT EXISTS(SELECT 1 FROM public.school_members WHERE profile_id = v_user_id AND status = 'pending')),
    'has_accepted_invite', (SELECT EXISTS(SELECT 1 FROM public.school_members WHERE profile_id = v_user_id AND status = 'active')),
    
    -- Flags específicos de Parent/Athlete
    -- Un padre tiene hijos si hay registros en la tabla 'children' con su parent_id
    'has_children', (SELECT EXISTS(SELECT 1 FROM public.children WHERE parent_id = v_user_id)),
    'has_medical_records', (SELECT EXISTS(SELECT 1 FROM public.children c WHERE c.parent_id = v_user_id AND c.medical_info IS NOT NULL)),
    'has_enrollment', (
        SELECT EXISTS(
            -- Para padres: inscripciones de sus hijos
            SELECT 1 FROM public.enrollments e 
            WHERE e.child_id IN (SELECT id FROM public.children WHERE parent_id = v_user_id)
            AND e.status = 'active'
        ) OR EXISTS(
            -- Para atletas: inscripciones directas
            SELECT 1 FROM public.enrollments e
            WHERE e.user_id = v_user_id AND e.status = 'active'
        )
    ),
    
    -- Flags específicos de Coach/Escuela
    -- La tabla schools usa owner_id según la inspección en vivo
    'has_school', (SELECT EXISTS(SELECT 1 FROM public.schools WHERE owner_id = v_user_id)),
    'has_branches', (SELECT EXISTS(SELECT 1 FROM public.school_branches b JOIN public.schools s ON b.school_id = s.id WHERE s.owner_id = v_user_id OR s.id = v_school_id)),
    'has_teams', (SELECT EXISTS(SELECT 1 FROM public.teams WHERE school_id = v_school_id OR (v_school_id IS NULL AND school_id IN (SELECT id FROM public.schools WHERE owner_id = v_user_id)))),
    'has_staff', (SELECT EXISTS(SELECT 1 FROM public.school_members WHERE school_id = v_school_id AND role IN ('coach', 'admin'))),
    'has_professional_profile', (SELECT EXISTS(SELECT 1 FROM public.coach_profiles WHERE id = v_user_id AND profile_completed = true)),
    
    -- Flags Misceláneos
    'has_sports_interest', (
        SELECT (
            (bio IS NOT NULL AND length(bio) > 10) OR 
            (sports_interests IS NOT NULL AND array_length(sports_interests, 1) > 0)
        )
        FROM public.profiles 
        WHERE id = v_user_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
