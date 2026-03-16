-- Migración para endurecer los RPCs de invitación y corregir visibilidad
-- Fecha: 2025-02-25

-- 1. Asegurar que get_invitation_details sea SECURITY DEFINER para permitir acceso anónimo
CREATE OR REPLACE FUNCTION public.get_invitation_details(p_invite_id uuid)
RETURNS TABLE (
    school_name text,
    role_to_assign text,
    child_name text,
    status text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.name as school_name,
        i.role_to_assign,
        i.child_name,
        i.status
    FROM public.invitations i
    LEFT JOIN public.schools s ON i.school_id = s.id
    WHERE i.id = p_invite_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permisos de ejecución a todos (incluyendo anónimos)
GRANT EXECUTE ON FUNCTION public.get_invitation_details(uuid) TO anon, authenticated, service_role;

-- 2. Robustecer accept_invitation con mejores logs y manejo de errores
CREATE OR REPLACE FUNCTION public.accept_invitation(p_invite_id uuid)
RETURNS boolean AS $$
DECLARE
    v_invite RECORD;
    v_user_email text;
    v_child_id uuid;
    v_program_price numeric;
    v_school_id uuid;
BEGIN
    -- Obtener email del usuario actual operando
    SELECT LOWER(email) INTO v_user_email FROM auth.users WHERE id = auth.uid();

    -- 1. Validar invitación
    SELECT * INTO v_invite
    FROM public.invitations
    WHERE id = p_invite_id
    AND status = 'pending';

    IF NOT FOUND THEN
        -- Verificar si ya fue aceptada para no errorar agresivamente en el frontend
        SELECT status INTO v_invite.status FROM public.invitations WHERE id = p_invite_id;
        IF v_invite.status = 'accepted' THEN
            RETURN true;
        END IF;
        RAISE EXCEPTION 'Invitación no válida o ya procesada.';
    END IF;

    -- Validar que el email coincida (case insensitive)
    IF LOWER(v_invite.email) != v_user_email THEN
        RAISE EXCEPTION 'Esta invitación pertenece a otro correo electrónico (% vs %).', v_invite.email, v_user_email;
    END IF;

    -- 2. Crear miembro de escuela
    INSERT INTO public.school_members (
        profile_id,
        school_id,
        role,
        status,
        branch_id,
        invited_by
    )
    VALUES (
        auth.uid(),
        v_invite.school_id,
        v_invite.role_to_assign,
        'active',
        v_invite.branch_id,
        v_invite.invited_by
    )
    ON CONFLICT (profile_id, school_id) DO UPDATE
    SET status = 'active', 
        role = EXCLUDED.role,
        branch_id = COALESCE(school_members.branch_id, EXCLUDED.branch_id);

    -- 3. Si es padre y tiene niño, crear/vincular niño
    IF v_invite.role_to_assign = 'parent' AND v_invite.child_name IS NOT NULL THEN
        -- Intentar encontrar el precio del programa/equipo si no está en la invitación
        v_program_price := v_invite.monthly_fee;
        
        IF v_program_price IS NULL AND v_invite.program_id IS NOT NULL THEN
            SELECT price_monthly INTO v_program_price 
            FROM public.teams 
            WHERE id = v_invite.program_id;
        END IF;

        -- Crear el estudiante
        INSERT INTO public.children (
            parent_id,
            full_name,
            school_id,
            branch_id
        )
        VALUES (
            auth.uid(),
            v_invite.child_name,
            v_invite.school_id,
            v_invite.branch_id
        )
        RETURNING id INTO v_child_id;

        -- Crear inscripción si hay programa
        IF v_invite.program_id IS NOT NULL THEN
            INSERT INTO public.enrollments (
                child_id,
                school_id,
                program_id,
                status,
                start_date
            )
            VALUES (
                v_child_id,
                v_invite.school_id,
                v_invite.program_id,
                'active',
                CURRENT_DATE
            );

            -- Crear primer pago pendiente si hay precio
            IF v_program_price > 0 THEN
                INSERT INTO public.payments (
                    parent_id,
                    child_id,
                    school_id,
                    amount,
                    status,
                    due_date,
                    concept,
                    program_id
                )
                VALUES (
                    auth.uid(),
                    v_child_id,
                    v_invite.school_id,
                    v_program_price,
                    'pending',
                    CURRENT_DATE + interval '5 days',
                    'Mensualidad - ' || v_invite.child_name,
                    v_invite.program_id
                );
            END IF;
        END IF;
    END IF;

    -- 4. Marcar invitación como aceptada
    UPDATE public.invitations
    SET status = 'accepted'
    WHERE id = p_invite_id;

    -- Registrar acción (opcional, si existe tabla de logs)
    -- INSERT INTO system_logs (action, metadata) VALUES ('accept_invitation', jsonb_build_object('invite_id', p_invite_id, 'user_id', auth.uid()));

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
