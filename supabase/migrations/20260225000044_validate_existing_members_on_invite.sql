-- Migración para validar miembros existentes y evitar duplicados al crear invitaciones
-- Fecha: 2026-02-25

CREATE OR REPLACE FUNCTION public.create_invitation(
    p_email text,
    p_role text,
    p_child_name text DEFAULT NULL,
    p_program_id uuid DEFAULT NULL,
    p_monthly_fee numeric DEFAULT NULL,
    p_parent_phone text DEFAULT NULL,
    p_branch_id uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
    v_school_id uuid;
    v_id uuid;
    v_existing_member_id uuid;
BEGIN
    -- 1. Encontrar la escuela gestionada por el usuario actual
    SELECT school_id INTO v_school_id FROM public.school_members
    WHERE profile_id = auth.uid()
      AND role IN ('owner', 'admin', 'admin')
      AND status = 'active'
    LIMIT 1;

    IF v_school_id IS NULL THEN
        SELECT id INTO v_school_id FROM schools WHERE owner_id = auth.uid() LIMIT 1;
    END IF;

    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'No se encontró una escuela administrada por ti.';
    END IF;

    -- 2. Validar si el usuario ya es miembro activo de esta escuela con ese rol
    -- Primero buscamos si el email existe en auth.users (vía perfiles)
    SELECT sm.id INTO v_existing_member_id
    FROM public.school_members sm
    JOIN public.profiles p ON sm.profile_id = p.id
    WHERE LOWER(p.email) = LOWER(TRIM(p_email))
      AND sm.school_id = v_school_id
      AND sm.role = p_role
      AND sm.status = 'active';

    IF v_existing_member_id IS NOT NULL THEN
        RAISE EXCEPTION 'Este usuario ya es un miembro activo de la academia con el rol de %.', p_role;
    END IF;

    -- 3. Validar si ya existe una invitación ACEPTADA para este mismo contexto
    -- (Email + Escuela + Rol + Niño si aplica)
    SELECT id INTO v_id 
    FROM public.invitations
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_email))
      AND school_id = v_school_id
      AND role_to_assign = p_role
      AND LOWER(TRIM(COALESCE(child_name, ''))) = LOWER(TRIM(COALESCE(p_child_name, '')))
      AND status = 'accepted'
    LIMIT 1;

    IF v_id IS NOT NULL THEN
        RAISE EXCEPTION 'Ya existe una invitación aceptada para este usuario con el rol de %. El usuario ya debería tener acceso.', p_role;
    END IF;

    -- 4. Verificar si ya existe una invitación PENDIENTE para actualizarla en lugar de crear una nueva
    SELECT id INTO v_id 
    FROM public.invitations
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_email))
      AND school_id = v_school_id
      AND role_to_assign = p_role
      AND LOWER(TRIM(COALESCE(child_name, ''))) = LOWER(TRIM(COALESCE(p_child_name, '')))
      AND status = 'pending'
    LIMIT 1;

    IF v_id IS NOT NULL THEN
        -- Actualizar la invitación existente con los últimos detalles
        UPDATE public.invitations
        SET monthly_fee = p_monthly_fee,
            parent_phone = p_parent_phone,
            branch_id = p_branch_id,
            program_id = p_program_id,
            invited_by = auth.uid(),
            created_at = NOW() -- Refrescar fecha para que el link no parezca "viejo"
        WHERE id = v_id;
        
        RETURN v_id;
    END IF;

    -- 5. Crear nueva invitación si pasó todas las validaciones
    INSERT INTO public.invitations (
        email, 
        school_id, 
        role_to_assign, 
        invited_by, 
        child_name, 
        program_id, 
        monthly_fee, 
        parent_phone, 
        branch_id,
        status
    )
    VALUES (
        LOWER(TRIM(p_email)), 
        v_school_id, 
        p_role, 
        auth.uid(), 
        p_child_name, 
        p_program_id, 
        p_monthly_fee, 
        p_parent_phone, 
        p_branch_id,
        'pending'
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
