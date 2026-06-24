-- ============================================================
-- SPORTMAPS — submit_qr_signup: permitir inscribir un HIJO EXISTENTE
-- Propósito:
--   Hasta ahora el QR SIEMPRE creaba un child nuevo. Si el padre ya tiene
--   hijos (sesión iniciada), debe poder ELEGIR cuál inscribir en vez de
--   duplicarlo. Se agrega p_existing_child_id: si viene (y es hijo del padre),
--   se usa ese; si no, se crea uno nuevo (comportamiento previo).
-- Fecha: 2026-06-22
-- ============================================================

BEGIN;

-- Reemplaza la firma anterior (10 args) por la nueva (11 args).
DROP FUNCTION IF EXISTS public.submit_qr_signup(text, uuid, uuid, text, date, text, text, text, text, numeric);

CREATE OR REPLACE FUNCTION public.submit_qr_signup(
    p_slug          text,
    p_team_id       uuid DEFAULT NULL,
    p_branch_id     uuid DEFAULT NULL,
    p_child_full_name text DEFAULT NULL,
    p_child_dob     date DEFAULT NULL,
    p_child_doc_type text DEFAULT NULL,
    p_child_doc_number text DEFAULT NULL,
    p_child_gender  text DEFAULT NULL,
    p_phone         text DEFAULT NULL,
    p_monthly_fee   numeric DEFAULT NULL,
    p_existing_child_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id    uuid := auth.uid();
    v_qr         record;
    v_school_id  uuid;
    v_branch_id  uuid;
    v_team_id    uuid;
    v_child_id   uuid;
    v_enrollment_id uuid;
    v_payment_id uuid;
    v_amount     numeric;
    v_due_date   date := CURRENT_DATE;
    v_concept    text;
    v_school_name text;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_qr FROM public.school_join_qr_codes WHERE slug = p_slug AND active = true;
    IF v_qr.id IS NULL THEN
        RAISE EXCEPTION 'QR not found or inactive' USING ERRCODE = '02000';
    END IF;
    IF v_qr.expires_at IS NOT NULL AND v_qr.expires_at < now() THEN
        RAISE EXCEPTION 'QR expired' USING ERRCODE = '22023';
    END IF;

    v_school_id := v_qr.school_id;
    v_branch_id := COALESCE(p_branch_id, v_qr.branch_id);
    v_team_id   := CASE WHEN v_qr.target_type = 'team' THEN v_qr.target_id ELSE p_team_id END;

    SELECT name INTO v_school_name FROM public.schools WHERE id = v_school_id;

    -- Promover a parent si aún no tiene rol fijo
    UPDATE public.profiles
       SET role = 'parent', phone = COALESCE(phone, p_phone)
     WHERE id = v_user_id
       AND role NOT IN ('admin','school','school_admin','super_admin','organizer','coach','wellness_professional','store_owner');

    IF p_existing_child_id IS NOT NULL THEN
        -- Inscribir un hijo EXISTENTE del padre (validar pertenencia).
        SELECT id INTO v_child_id
        FROM public.children
        WHERE id = p_existing_child_id AND parent_id = v_user_id;

        IF v_child_id IS NULL THEN
            RAISE EXCEPTION 'Hijo no válido para este usuario' USING ERRCODE = '42501';
        END IF;

        -- Asociar a esta escuela/sede/equipo SOLO si aún no tiene (no lo mueve
        -- si ya pertenece a otra escuela).
        UPDATE public.children
           SET school_id = COALESCE(school_id, v_school_id),
               branch_id = COALESCE(branch_id, v_branch_id),
               team_id   = COALESCE(team_id, v_team_id)
         WHERE id = v_child_id;
    ELSE
        -- Crear child nuevo (comportamiento previo)
        INSERT INTO public.children (
            parent_id, school_id, branch_id, team_id,
            full_name, date_of_birth, doc_type, doc_number, gender,
            monthly_fee, is_active
        ) VALUES (
            v_user_id, v_school_id, v_branch_id, v_team_id,
            p_child_full_name, p_child_dob, p_child_doc_type, p_child_doc_number, p_child_gender,
            COALESCE(p_monthly_fee, 0), true
        ) RETURNING id INTO v_child_id;
    END IF;

    -- Enrollment con sujeto ÚNICO: child_id (user_id NULL) → cumple XOR.
    INSERT INTO public.enrollments (
        user_id, child_id, school_id, team_id, start_date, status
    ) VALUES (
        NULL, v_child_id, v_school_id, v_team_id, CURRENT_DATE,
        CASE WHEN v_qr.require_first_payment THEN 'pending' ELSE 'active' END
    ) RETURNING id INTO v_enrollment_id;

    -- Payment pendiente del primer mes (si aplica)
    IF v_qr.require_first_payment AND COALESCE(p_monthly_fee, 0) > 0 THEN
        v_amount  := p_monthly_fee;
        v_concept := 'Primer mes - ' || COALESCE((SELECT full_name FROM public.children WHERE id = v_child_id), 'inscripción') || ' (' || v_school_name || ')';

        INSERT INTO public.payments (
            school_id, branch_id, parent_id, child_id, team_id,
            concept, amount, due_date, status, payment_type
        ) VALUES (
            v_school_id, v_branch_id, v_user_id, v_child_id, v_team_id,
            v_concept, v_amount, v_due_date, 'pending', 'one_time'
        ) RETURNING id INTO v_payment_id;
    END IF;

    UPDATE public.school_join_qr_codes SET signup_count = signup_count + 1 WHERE id = v_qr.id;

    INSERT INTO public.notifications (user_id, title, message, type, link)
    SELECT sm.profile_id,
           'Nueva inscripción por QR',
           COALESCE((SELECT full_name FROM public.children WHERE id = v_child_id), 'Atleta') || ' se inscribió via "' || v_qr.name || '"',
           'success',
           '/admin/cards'
    FROM public.school_members sm
    WHERE sm.school_id = v_school_id
      AND sm.role IN ('owner','admin')
      AND sm.status = 'active';

    RETURN jsonb_build_object(
        'ok',            true,
        'qr_id',         v_qr.id,
        'school_id',     v_school_id,
        'child_id',      v_child_id,
        'enrollment_id', v_enrollment_id,
        'payment_id',    v_payment_id,
        'requires_payment', v_qr.require_first_payment AND v_payment_id IS NOT NULL,
        'amount',        v_amount
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_qr_signup(text, uuid, uuid, text, date, text, text, text, text, numeric, uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
