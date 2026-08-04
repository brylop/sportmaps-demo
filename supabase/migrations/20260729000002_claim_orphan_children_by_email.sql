-- ============================================================
-- SPORTMAPS — Vincular hijos pre-cargados por CORREO (evita duplicar)
-- ------------------------------------------------------------
-- Caso Dynasty: la escuela pre-carga hijos (admin/CSV) → children con
-- parent_id NULL y parent_email_temp = correo del acudiente. Cuando el papá
-- entra por el QR a pagar la mensualidad, los flujos buscaban a sus hijos por
-- parent_id (NULL en pre-cargados) → NO los veía → creaba uno nuevo → hijo y
-- cobros DUPLICADOS, y el historial manual quedaba en el hijo huérfano.
--
-- Fix: "claim by email". Al entrar el papá (con el correo pre-registrado, sea
-- por link de invitación o por el QR), se adoptan automáticamente los hijos
-- huérfanos cuyo parent_email_temp = su correo (set parent_id). El historial
-- (payments cuelgan de child_id) queda vinculado solo.
--
--   claim_orphan_children(p_school_id)  → adopta huérfanos del correo actual
--   get_qr_pay_targets(slug)            → adopta antes de listar (ve al hijo real)
--   submit_qr_signup(...)               → adopta + reutiliza por nombre (no recrea)
--
-- Migración nueva (timestamp posterior). Fecha: 2026-07-29
-- ============================================================

BEGIN;

-- ── 1. claim_orphan_children: adopta hijos huérfanos por correo ─────────────
CREATE OR REPLACE FUNCTION public.claim_orphan_children(p_school_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_email   text;
    v_count   int := 0;
BEGIN
    IF v_user_id IS NULL THEN RETURN 0; END IF;
    SELECT LOWER(email) INTO v_email FROM auth.users WHERE id = v_user_id;
    IF v_email IS NULL OR v_email = '' THEN RETURN 0; END IF;

    UPDATE public.children c
       SET parent_id  = v_user_id,
           updated_at = now()
     WHERE c.parent_id IS NULL
       AND LOWER(c.parent_email_temp) = v_email
       AND (p_school_id IS NULL OR c.school_id = p_school_id);

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_orphan_children(uuid) TO authenticated;


-- ── 2. get_qr_pay_targets: adopta huérfanos antes de listar ─────────────────
CREATE OR REPLACE FUNCTION public.get_qr_pay_targets(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_school_id uuid;
    v_school_name text;
    v_rows jsonb;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
    SELECT school_id INTO v_school_id FROM public.school_join_qr_codes WHERE slug = p_slug AND active = true;
    IF v_school_id IS NULL THEN RAISE EXCEPTION 'QR not found or inactive' USING ERRCODE='02000'; END IF;
    SELECT name INTO v_school_name FROM public.schools WHERE id = v_school_id;

    -- Adopta hijos pre-cargados de este correo → el papá ve a SU hijo (con su
    -- cobro/historial) y lo paga, en vez de crear uno nuevo (duplicado).
    PERFORM public.claim_orphan_children(v_school_id);

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'child_id', c.id,
        'full_name', c.full_name,
        'monthly_fee', COALESCE(
            (SELECT NULLIF(e.monthly_fee, 0)
               FROM public.enrollments e
              WHERE e.child_id = c.id AND e.school_id = v_school_id
                AND e.status = 'active' AND e.monthly_fee IS NOT NULL
              ORDER BY e.updated_at DESC NULLS LAST LIMIT 1),
            NULLIF(c.monthly_fee, 0),
            (SELECT NULLIF(t.price_monthly, 0)
               FROM public.enrollments e
               JOIN public.teams t ON t.id = e.team_id
              WHERE e.child_id = c.id AND e.school_id = v_school_id
                AND e.status = 'active' AND e.team_id IS NOT NULL
              ORDER BY e.updated_at DESC NULLS LAST LIMIT 1),
            (SELECT NULLIF(op.price, 0)
               FROM public.enrollments e
               JOIN public.offering_plans op ON op.id = e.offering_plan_id
              WHERE e.child_id = c.id AND e.school_id = v_school_id
                AND e.status = 'active' AND e.offering_plan_id IS NOT NULL
              ORDER BY e.updated_at DESC NULLS LAST LIMIT 1),
            (SELECT NULLIF(price_monthly, 0) FROM public.teams WHERE id = c.team_id AND school_id = v_school_id),
            0),
        'pending', (
            SELECT jsonb_build_object('payment_id', p.id, 'amount', p.amount, 'concept', p.concept, 'due_date', p.due_date)
            FROM public.payments p
            WHERE p.child_id = c.id AND p.school_id = v_school_id AND p.status = 'pending'
            ORDER BY p.created_at DESC LIMIT 1
        ),
        'has_current_month', EXISTS(
            SELECT 1 FROM public.payments p
            WHERE p.child_id = c.id AND p.school_id = v_school_id
              AND p.due_date >= date_trunc('month', CURRENT_DATE)
              AND p.due_date <  date_trunc('month', CURRENT_DATE) + interval '1 month'
        )
    ) ORDER BY c.full_name), '[]'::jsonb)
    INTO v_rows
    FROM public.children c
    WHERE c.parent_id = v_user_id AND c.school_id = v_school_id;

    RETURN jsonb_build_object('school_id', v_school_id, 'school_name', v_school_name, 'children', v_rows);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_qr_pay_targets(text) TO authenticated;


-- ── 3. submit_qr_signup: adopta por correo + reutiliza por nombre ───────────
-- Base: 20260728000002 (idempotente). Añade: claim de huérfanos y, al crear
-- "nuevo", reutiliza un hijo existente del mismo acudiente y nombre → no recrea.
DROP FUNCTION IF EXISTS public.submit_qr_signup(text, uuid, uuid, text, date, text, text, text, text, numeric, uuid, uuid);
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

    -- Adopta hijos pre-cargados de este correo (parent_id NULL) para no duplicar.
    PERFORM public.claim_orphan_children(v_school_id);

    -- Precio del plan (offering_plan validado contra la escuela) ------------
    IF v_plan_id IS NOT NULL THEN
        SELECT op.price INTO v_plan_price
        FROM public.offering_plans op
        WHERE op.id = v_plan_id AND op.school_id = v_school_id AND op.is_active = true;
        IF v_plan_price IS NULL THEN RAISE EXCEPTION 'Plan no válido para esta escuela' USING ERRCODE='22023'; END IF;
    END IF;

    -- Precio SERVER-SIDE: promo > plan > equipo > fallback cliente ----------
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
        -- Anti-duplicado: si ya existe un hijo con ese nombre para este acudiente
        -- en la escuela (incluye los recién adoptados por correo), reutilizarlo.
        SELECT id INTO v_child_id FROM public.children
         WHERE school_id = v_school_id AND parent_id = v_user_id
           AND LOWER(full_name) = LOWER(TRIM(COALESCE(p_child_full_name, '')))
           AND COALESCE(TRIM(p_child_full_name), '') <> ''
         ORDER BY created_at ASC LIMIT 1;

        IF v_child_id IS NULL THEN
            INSERT INTO public.children (parent_id, school_id, branch_id, team_id, full_name, date_of_birth, doc_type, doc_number, gender, monthly_fee, is_active)
            VALUES (v_user_id, v_school_id, v_branch_id, v_team_id, p_child_full_name, p_child_dob, p_child_doc_type, p_child_doc_number, p_child_gender, v_amount, true)
            RETURNING id INTO v_child_id;
        ELSE
            UPDATE public.children
               SET school_id = COALESCE(school_id, v_school_id),
                   branch_id = COALESCE(branch_id, v_branch_id),
                   team_id   = COALESCE(team_id, v_team_id)
             WHERE id = v_child_id;
        END IF;
    END IF;

    -- Enrollment IDEMPOTENTE: si ya hay uno activo/pendiente para el mismo
    -- equipo (o sin equipo), reutilizarlo en vez de crear un duplicado.
    SELECT id INTO v_enrollment_id
      FROM public.enrollments
     WHERE child_id = v_child_id AND school_id = v_school_id
       AND COALESCE(team_id::text, '') = COALESCE(v_team_id::text, '')
       AND status IN ('active', 'pending')
     ORDER BY created_at DESC
     LIMIT 1;

    IF v_enrollment_id IS NULL THEN
        INSERT INTO public.enrollments (user_id, child_id, school_id, team_id, start_date, status)
        VALUES (NULL, v_child_id, v_school_id, v_team_id, CURRENT_DATE,
                CASE WHEN v_qr.require_first_payment THEN 'pending' ELSE 'active' END)
        RETURNING id INTO v_enrollment_id;
    END IF;

    -- Cobro IDEMPOTENTE: si el hijo ya tiene un cobro impago (pending/overdue)
    -- sin comprobante en esta escuela, reutilizarlo — no apilar cobros nuevos.
    IF v_qr.require_first_payment AND v_amount > 0 THEN
        SELECT id INTO v_payment_id
          FROM public.payments
         WHERE child_id = v_child_id AND school_id = v_school_id
           AND status IN ('pending', 'overdue')
           AND COALESCE(receipt_url, '') = ''
         ORDER BY created_at ASC
         LIMIT 1;

        IF v_payment_id IS NULL THEN
            v_concept := 'Primer pago - ' || COALESCE((SELECT full_name FROM public.children WHERE id = v_child_id), 'inscripción') || ' (' || v_school_name || ')';
            INSERT INTO public.payments (school_id, branch_id, parent_id, child_id, team_id, concept, amount, due_date, status, payment_type, qr_id)
            VALUES (v_school_id, v_branch_id, v_user_id, v_child_id, v_team_id, v_concept, v_amount, v_due_date, 'pending', 'one_time', v_qr.id)
            RETURNING id INTO v_payment_id;
        END IF;
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
