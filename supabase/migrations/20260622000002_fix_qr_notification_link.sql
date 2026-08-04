-- ============================================================
-- SPORTMAPS — Fix link de la notificación "Nueva inscripción por QR"
-- Propósito:
--   submit_qr_signup creaba la notificación con link '/admin/cards', ruta
--   que NO existe → "Ver detalle" daba 404. Se cambia a '/payments-automation'
--   (panel "Cobros por Aprobar", que es lo accionable para un ingreso nuevo).
--   También se corrigen las notificaciones ya emitidas.
-- Fecha: 2026-06-22
-- ============================================================

BEGIN;

-- 1. Corregir notificaciones existentes
UPDATE public.notifications
   SET link = '/payments-automation'
 WHERE link = '/admin/cards'
   AND title = 'Nueva inscripción por QR';

-- 2. Redefinir submit_qr_signup con el link correcto (resto idéntico a 20260622000001)
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

    UPDATE public.profiles
       SET role = 'parent', phone = COALESCE(phone, p_phone)
     WHERE id = v_user_id
       AND role NOT IN ('admin','school','school_admin','super_admin','organizer','coach','wellness_professional','store_owner');

    IF p_existing_child_id IS NOT NULL THEN
        SELECT id INTO v_child_id
        FROM public.children
        WHERE id = p_existing_child_id AND parent_id = v_user_id;

        IF v_child_id IS NULL THEN
            RAISE EXCEPTION 'Hijo no válido para este usuario' USING ERRCODE = '42501';
        END IF;

        UPDATE public.children
           SET school_id = COALESCE(school_id, v_school_id),
               branch_id = COALESCE(branch_id, v_branch_id),
               team_id   = COALESCE(team_id, v_team_id)
         WHERE id = v_child_id;
    ELSE
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

    INSERT INTO public.enrollments (
        user_id, child_id, school_id, team_id, start_date, status
    ) VALUES (
        NULL, v_child_id, v_school_id, v_team_id, CURRENT_DATE,
        CASE WHEN v_qr.require_first_payment THEN 'pending' ELSE 'active' END
    ) RETURNING id INTO v_enrollment_id;

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
           '/payments-automation'
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
