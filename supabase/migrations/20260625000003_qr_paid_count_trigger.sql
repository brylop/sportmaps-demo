-- ============================================================
-- SPORTMAPS — QR: contar PAGARON cuando el cobro del QR pasa a 'paid'
-- Problema:
--   La estadística PAGARON del QR (school_join_qr_codes.paid_count) quedaba
--   en 0 aunque el atleta se inscribiera y pagara: register_qr_paid_conversion
--   existía pero NADIE lo llamaba, y payments no guardaba qr_id, así que al
--   aprobar el cobro nadie sabía a qué QR sumarle.
-- Solución:
--   1. payments.qr_id → enlaza el cobro con el QR que lo originó.
--   2. submit_qr_signup llena qr_id al crear el cobro.
--   3. Trigger en payments: cuando un cobro con qr_id pasa a status='paid'
--      (aprobación manual de la escuela O webhook de pasarela), incrementa
--      paid_count UNA sola vez (idempotente por transición de estado).
-- Fecha: 2026-06-25
-- ============================================================

BEGIN;

-- ── 1. payments.qr_id ───────────────────────────────────────────────────────
ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS qr_id uuid REFERENCES public.school_join_qr_codes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_payments_qr_id ON public.payments(qr_id) WHERE qr_id IS NOT NULL;

COMMENT ON COLUMN public.payments.qr_id IS
    'QR de inscripción que originó este cobro (school_join_qr_codes). NULL si no vino por QR. '
    'Usado por el trigger trg_bump_qr_paid_count para contar conversiones PAGARON.';


-- ── 2. Trigger: contar PAGARON al pasar a 'paid' ────────────────────────────
CREATE OR REPLACE FUNCTION public.bump_qr_paid_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF NEW.qr_id IS NOT NULL
       AND NEW.status = 'paid'
       AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid') THEN
        UPDATE public.school_join_qr_codes
           SET paid_count = paid_count + 1
         WHERE id = NEW.qr_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_qr_paid_count ON public.payments;
CREATE TRIGGER trg_bump_qr_paid_count
    AFTER INSERT OR UPDATE OF status ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.bump_qr_paid_count();


-- ── 3. submit_qr_signup: llenar qr_id en el cobro ───────────────────────────
--    (idéntica a 20260625000002 — planes desde offering_plans — + qr_id en el INSERT)
CREATE OR REPLACE FUNCTION public.submit_qr_signup(
    p_slug text, p_team_id uuid DEFAULT NULL, p_branch_id uuid DEFAULT NULL,
    p_child_full_name text DEFAULT NULL, p_child_dob date DEFAULT NULL,
    p_child_doc_type text DEFAULT NULL, p_child_doc_number text DEFAULT NULL,
    p_child_gender text DEFAULT NULL, p_phone text DEFAULT NULL,
    p_monthly_fee numeric DEFAULT NULL, p_existing_child_id uuid DEFAULT NULL,
    p_plan_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid(); v_qr record;
    v_school_id uuid; v_branch_id uuid; v_team_id uuid; v_plan_id uuid; v_child_id uuid;
    v_enrollment_id uuid; v_payment_id uuid; v_amount numeric; v_plan_price numeric;
    v_due_date date := CURRENT_DATE; v_concept text; v_school_name text;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
    SELECT * INTO v_qr FROM public.school_join_qr_codes WHERE slug = p_slug AND active = true;
    IF v_qr.id IS NULL THEN RAISE EXCEPTION 'QR not found or inactive' USING ERRCODE='02000'; END IF;
    IF v_qr.expires_at IS NOT NULL AND v_qr.expires_at < now() THEN RAISE EXCEPTION 'QR expired' USING ERRCODE='22023'; END IF;

    v_school_id := v_qr.school_id;
    v_branch_id := COALESCE(p_branch_id, v_qr.branch_id);
    v_team_id   := CASE WHEN v_qr.target_type = 'team' THEN v_qr.target_id ELSE p_team_id END;
    v_plan_id   := CASE WHEN v_qr.target_type = 'plan' THEN v_qr.target_id ELSE p_plan_id END;
    SELECT name INTO v_school_name FROM public.schools WHERE id = v_school_id;

    IF v_plan_id IS NOT NULL THEN
        SELECT op.price INTO v_plan_price FROM public.offering_plans op
        WHERE op.id = v_plan_id AND op.school_id = v_school_id AND op.is_active = true;
        IF v_plan_price IS NULL THEN RAISE EXCEPTION 'Plan no válido para esta escuela' USING ERRCODE='22023'; END IF;
    END IF;

    v_amount := COALESCE(
        NULLIF(v_qr.fixed_amount, 0),
        NULLIF(v_plan_price, 0),
        (SELECT NULLIF(price_monthly, 0) FROM public.teams WHERE id = v_team_id AND school_id = v_school_id),
        NULLIF(p_monthly_fee, 0),
        0
    );

    UPDATE public.profiles SET role='parent', phone=COALESCE(phone,p_phone)
     WHERE id = v_user_id AND role NOT IN ('admin','school','school_admin','super_admin','organizer','coach','wellness_professional','store_owner');

    IF p_existing_child_id IS NOT NULL THEN
        SELECT id INTO v_child_id FROM public.children WHERE id = p_existing_child_id AND parent_id = v_user_id;
        IF v_child_id IS NULL THEN RAISE EXCEPTION 'Hijo no válido para este usuario' USING ERRCODE='42501'; END IF;
        UPDATE public.children
           SET school_id = COALESCE(school_id, v_school_id),
               branch_id = COALESCE(branch_id, v_branch_id),
               team_id   = COALESCE(team_id, v_team_id)
         WHERE id = v_child_id;
    ELSE
        INSERT INTO public.children (parent_id, school_id, branch_id, team_id, full_name, date_of_birth, doc_type, doc_number, gender, monthly_fee, is_active)
        VALUES (v_user_id, v_school_id, v_branch_id, v_team_id, p_child_full_name, p_child_dob, p_child_doc_type, p_child_doc_number, p_child_gender, v_amount, true)
        RETURNING id INTO v_child_id;
    END IF;

    INSERT INTO public.enrollments (user_id, child_id, school_id, team_id, start_date, status)
    VALUES (NULL, v_child_id, v_school_id, v_team_id, CURRENT_DATE,
            CASE WHEN v_qr.require_first_payment THEN 'pending' ELSE 'active' END)
    RETURNING id INTO v_enrollment_id;

    IF v_qr.require_first_payment AND v_amount > 0 THEN
        v_concept := 'Primer pago - ' || COALESCE((SELECT full_name FROM public.children WHERE id = v_child_id), 'inscripción') || ' (' || v_school_name || ')';
        INSERT INTO public.payments (school_id, branch_id, parent_id, child_id, team_id, concept, amount, due_date, status, payment_type, qr_id)
        VALUES (v_school_id, v_branch_id, v_user_id, v_child_id, v_team_id, v_concept, v_amount, v_due_date, 'pending', 'one_time', v_qr.id)
        RETURNING id INTO v_payment_id;
    END IF;

    UPDATE public.school_join_qr_codes SET signup_count = signup_count + 1 WHERE id = v_qr.id;

    INSERT INTO public.notifications (user_id, title, message, type, link)
    SELECT sm.profile_id, 'Nueva inscripción por QR',
           COALESCE((SELECT full_name FROM public.children WHERE id = v_child_id), 'Atleta') || ' se inscribió via "' || v_qr.name || '"',
           'success', '/payments-automation'
    FROM public.school_members sm
    WHERE sm.school_id = v_school_id AND sm.role IN ('owner','admin') AND sm.status='active';

    RETURN jsonb_build_object('ok',true,'qr_id',v_qr.id,'school_id',v_school_id,'child_id',v_child_id,
        'enrollment_id',v_enrollment_id,'payment_id',v_payment_id,
        'requires_payment', v_qr.require_first_payment AND v_payment_id IS NOT NULL, 'amount', v_amount);
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_qr_signup(text, uuid, uuid, text, date, text, text, text, text, numeric, uuid, uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
