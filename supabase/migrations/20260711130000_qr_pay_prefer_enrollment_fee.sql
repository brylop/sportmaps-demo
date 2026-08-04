-- ============================================================
-- SPORTMAPS — La cuota individual del atleta (enrollments.monthly_fee) manda
-- ------------------------------------------------------------
-- Bug: al editar el "valor a pagar" de un deportista en el modal de la escuela
-- (o del PT), el BFF actualiza enrollments.monthly_fee, pero las RPCs del flujo
-- QR "pagar mensualidad" seguían leyendo children.monthly_fee → teams.price_monthly,
-- por lo que el padre veía el monto viejo (o 0 si el equipo no tenía precio).
--
-- Regla canónica: el monto a pagar sale de la cuota individual editable
-- (enrollments.monthly_fee del enrollment activo). Solo si es NULL se cae al
-- valor denormalizado children.monthly_fee y luego al precio de catálogo
-- (teams.price_monthly / offering_plans.price).
--
--   get_qr_pay_targets(slug)         → cuota por hijo
--   generate_qr_monthly_charge(slug) → monto del cobro del mes
-- Fecha: 2026-07-11
-- ============================================================

BEGIN;

-- ── 1. get_qr_pay_targets: la cuota sale del enrollment activo primero ───────
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

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'child_id', c.id,
        'full_name', c.full_name,
        'monthly_fee', COALESCE(
            -- 1) cuota individual editable del enrollment activo (equipo o plan)
            (SELECT NULLIF(e.monthly_fee, 0)
               FROM public.enrollments e
              WHERE e.child_id = c.id AND e.school_id = v_school_id
                AND e.status = 'active' AND e.monthly_fee IS NOT NULL
              ORDER BY e.updated_at DESC NULLS LAST
              LIMIT 1),
            -- 2) valor denormalizado que dejó la inscripción por QR
            NULLIF(c.monthly_fee, 0),
            -- 3) precio de catálogo del equipo del enrollment activo
            (SELECT NULLIF(t.price_monthly, 0)
               FROM public.enrollments e
               JOIN public.teams t ON t.id = e.team_id
              WHERE e.child_id = c.id AND e.school_id = v_school_id
                AND e.status = 'active' AND e.team_id IS NOT NULL
              ORDER BY e.updated_at DESC NULLS LAST
              LIMIT 1),
            -- 4) precio de catálogo del plan del enrollment activo
            (SELECT NULLIF(op.price, 0)
               FROM public.enrollments e
               JOIN public.offering_plans op ON op.id = e.offering_plan_id
              WHERE e.child_id = c.id AND e.school_id = v_school_id
                AND e.status = 'active' AND e.offering_plan_id IS NOT NULL
              ORDER BY e.updated_at DESC NULLS LAST
              LIMIT 1),
            -- 5) fallback histórico: equipo asignado directo al hijo
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


-- ── 2. generate_qr_monthly_charge: el cobro del mes usa la cuota individual ──
CREATE OR REPLACE FUNCTION public.generate_qr_monthly_charge(p_slug text, p_child_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_qr record; v_school_id uuid; v_school_name text;
    v_child record; v_amount numeric; v_payment_id uuid;
    v_existing uuid; v_existing_amount numeric;
    v_enroll_fee numeric;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
    SELECT * INTO v_qr FROM public.school_join_qr_codes WHERE slug = p_slug AND active = true;
    IF v_qr.id IS NULL THEN RAISE EXCEPTION 'QR not found or inactive' USING ERRCODE='02000'; END IF;
    v_school_id := v_qr.school_id;
    SELECT name INTO v_school_name FROM public.schools WHERE id = v_school_id;

    SELECT * INTO v_child FROM public.children
    WHERE id = p_child_id AND parent_id = v_user_id AND school_id = v_school_id;
    IF v_child.id IS NULL THEN RAISE EXCEPTION 'Hijo no válido para esta escuela' USING ERRCODE='42501'; END IF;

    -- Dedup: si ya existe cobro del mes en curso, devolverlo (prioriza pendiente)
    SELECT id, amount INTO v_existing, v_existing_amount
    FROM public.payments
    WHERE child_id = p_child_id AND school_id = v_school_id
      AND due_date >= date_trunc('month', CURRENT_DATE)
      AND due_date <  date_trunc('month', CURRENT_DATE) + interval '1 month'
    ORDER BY (status = 'pending') DESC, created_at DESC
    LIMIT 1;
    IF v_existing IS NOT NULL THEN
        RETURN jsonb_build_object('ok', true, 'payment_id', v_existing, 'amount', v_existing_amount, 'reused', true);
    END IF;

    -- Cuota individual del enrollment activo (equipo o plan): manda sobre todo.
    SELECT COALESCE(
        NULLIF(e.monthly_fee, 0),
        NULLIF((SELECT price_monthly FROM public.teams WHERE id = e.team_id), 0),
        NULLIF((SELECT price FROM public.offering_plans WHERE id = e.offering_plan_id), 0))
    INTO v_enroll_fee
    FROM public.enrollments e
    WHERE e.child_id = p_child_id AND e.school_id = v_school_id AND e.status = 'active'
    ORDER BY (e.monthly_fee IS NOT NULL) DESC, e.updated_at DESC NULLS LAST
    LIMIT 1;

    v_amount := COALESCE(
        v_enroll_fee,
        NULLIF(v_qr.fixed_amount, 0),
        NULLIF(v_child.monthly_fee, 0),
        (SELECT NULLIF(price_monthly, 0) FROM public.teams WHERE id = v_child.team_id AND school_id = v_school_id),
        0);
    IF v_amount <= 0 THEN RAISE EXCEPTION 'No hay cuota configurada para este atleta' USING ERRCODE='22023'; END IF;

    INSERT INTO public.payments (school_id, branch_id, parent_id, child_id, team_id, concept, amount, due_date, status, payment_type, qr_id)
    VALUES (v_school_id, v_child.branch_id, v_user_id, p_child_id, v_child.team_id,
            'Mensualidad ' || to_char(CURRENT_DATE, 'MM/YYYY') || ' - ' || v_child.full_name || ' (' || v_school_name || ')',
            v_amount, CURRENT_DATE, 'pending', 'one_time', v_qr.id)
    RETURNING id INTO v_payment_id;

    RETURN jsonb_build_object('ok', true, 'payment_id', v_payment_id, 'amount', v_amount, 'reused', false);
END;
$$;
GRANT EXECUTE ON FUNCTION public.generate_qr_monthly_charge(text, uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
