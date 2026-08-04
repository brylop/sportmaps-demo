-- ============================================================
-- SPORTMAPS — Fix submit_qr_signup: enrollment con sujeto único (XOR)
-- Propósito:
--   La constraint chk_enrollment_subject_exclusivity exige que un enrollment
--   tenga EXACTAMENTE uno de (user_id, child_id). submit_qr_signup insertaba
--   AMBOS (user_id=padre + child_id=hijo) → violación → 400 al inscribir por QR.
--   El QR siempre crea un `child` como sujeto de la inscripción, así que el
--   enrollment debe llevar child_id y user_id = NULL. La RLS de padres sigue
--   funcionando vía child_id IN (children del padre).
-- Fecha: 2026-06-20
-- ============================================================

BEGIN;

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
    p_monthly_fee   numeric DEFAULT NULL
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

    -- Crear child (sujeto de la inscripción)
    INSERT INTO public.children (
        parent_id, school_id, branch_id, team_id,
        full_name, date_of_birth, doc_type, doc_number, gender,
        monthly_fee, is_active
    ) VALUES (
        v_user_id, v_school_id, v_branch_id, v_team_id,
        p_child_full_name, p_child_dob, p_child_doc_type, p_child_doc_number, p_child_gender,
        COALESCE(p_monthly_fee, 0), true
    ) RETURNING id INTO v_child_id;

    -- Enrollment con sujeto ÚNICO: child_id (NO user_id) → cumple XOR.
    INSERT INTO public.enrollments (
        user_id, child_id, school_id, team_id, start_date, status
    ) VALUES (
        NULL, v_child_id, v_school_id, v_team_id, CURRENT_DATE,
        CASE WHEN v_qr.require_first_payment THEN 'pending' ELSE 'active' END
    ) RETURNING id INTO v_enrollment_id;

    -- Payment pendiente del primer mes (si aplica)
    IF v_qr.require_first_payment AND COALESCE(p_monthly_fee, 0) > 0 THEN
        v_amount  := p_monthly_fee;
        v_concept := 'Primer mes - ' || COALESCE(p_child_full_name, 'inscripción') || ' (' || v_school_name || ')';

        INSERT INTO public.payments (
            school_id, branch_id, parent_id, child_id, team_id,
            concept, amount, due_date, status, payment_type
        ) VALUES (
            v_school_id, v_branch_id, v_user_id, v_child_id, v_team_id,
            v_concept, v_amount, v_due_date, 'pending', 'one_time'
        ) RETURNING id INTO v_payment_id;
    END IF;

    UPDATE public.school_join_qr_codes SET signup_count = signup_count + 1 WHERE id = v_qr.id;

    -- Notificar admins de la escuela
    INSERT INTO public.notifications (user_id, title, message, type, link)
    SELECT sm.profile_id,
           'Nueva inscripción por QR',
           COALESCE(p_child_full_name, 'Atleta nuevo') || ' se inscribió via "' || v_qr.name || '"',
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

GRANT EXECUTE ON FUNCTION public.submit_qr_signup(text, uuid, uuid, text, date, text, text, text, text, numeric) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
