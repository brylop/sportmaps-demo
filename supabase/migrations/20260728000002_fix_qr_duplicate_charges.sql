-- ============================================================
-- SPORTMAPS — Fix: el QR apila cobros pendientes de meses que avanzan
-- ------------------------------------------------------------
-- Síntoma (reportado en "Cobros por Aprobar"): un mismo atleta acumula varios
-- cobros pendientes de meses consecutivos (Julio, Agosto, Septiembre…), uno por
-- cada vez que el acudiente entra al QR, sin haber pagado ninguno.
--
-- Causa raíz (dos piezas):
--   1) next_unpaid_period() en algunas BD avanza al mes SIGUIENTE aunque el
--      último período esté solo 'pending'/'overdue' (impago). Debe quedarse en
--      ESE mismo mes hasta que se salde. La versión canónica (20260711130003) ya
--      corrige 'partial'/'pending'; aquí se re-asegura y se añade 'overdue'.
--   2) Las RPCs del flujo QR crean un cobro nuevo en cada visita sin reutilizar
--      el cobro impago que ya existe. Ahora reutilizan el pendiente/vencido.
--
-- Además, el cobro mensual del QR ahora puebla period_year/period_month para que
-- el índice único uniq_payment_active_period_per_child bloquee duplicados del
-- mismo período (red de DB).
--
-- Migración nueva (no se editan las anteriores). Fecha: 2026-07-28
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. next_unpaid_period: un mes impago (pending/overdue/partial) NO avanza
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.next_unpaid_period(p_child_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_today          date := CURRENT_DATE;
    v_curr_year      smallint := EXTRACT(YEAR  FROM v_today)::smallint;
    v_curr_month     smallint := EXTRACT(MONTH FROM v_today)::smallint;
    v_last_year      smallint;
    v_last_month     smallint;
    v_last_status    text;
    v_target_year    smallint;
    v_target_month   smallint;
    v_target_status  jsonb;
BEGIN
    IF p_child_id IS NULL THEN
        RETURN jsonb_build_object('error', 'child_id_required');
    END IF;

    SELECT period_year, period_month, status
      INTO v_last_year, v_last_month, v_last_status
      FROM public.payments
     WHERE child_id     = p_child_id
       AND period_year  IS NOT NULL
       AND period_month IS NOT NULL
       AND status IN ('paid', 'approved', 'awaiting_approval', 'pending', 'partial', 'overdue')
     ORDER BY period_year DESC, period_month DESC,
              CASE status
                WHEN 'paid'              THEN 1
                WHEN 'approved'          THEN 2
                WHEN 'partial'           THEN 3
                WHEN 'awaiting_approval' THEN 4
                WHEN 'pending'           THEN 5
                WHEN 'overdue'           THEN 6
                ELSE 9
              END
     LIMIT 1;

    -- Caso A: nunca ha pagado nada → sugerir mes actual
    IF v_last_year IS NULL THEN
        v_target_year  := v_curr_year;
        v_target_month := v_curr_month;
    ELSIF v_last_status IN ('partial', 'pending', 'overdue') THEN
        -- Caso B1: el último período NO está saldado (abono en curso o cobro
        -- impago) → el objetivo es ESE MISMO mes, para completarlo/pagarlo.
        -- Esto evita que cada visita al QR proponga (y genere) el mes siguiente.
        v_target_year  := v_last_year;
        v_target_month := v_last_month;
    ELSE
        -- Caso B2: el último quedó pagado/en validación → el mes siguiente.
        v_target_year  := v_last_year;
        v_target_month := v_last_month + 1;
        IF v_target_month > 12 THEN
            v_target_month := 1;
            v_target_year  := v_target_year + 1;
        END IF;

        -- Si el siguiente sugerido cae en el pasado, avanzar al mes actual.
        IF make_date(v_target_year::int, v_target_month::int, 1)
           < make_date(v_curr_year::int,   v_curr_month::int,  1)
        THEN
            v_target_year  := v_curr_year;
            v_target_month := v_curr_month;
        END IF;
    END IF;

    v_target_status := public.period_payment_status(p_child_id, v_target_year, v_target_month);

    RETURN jsonb_build_object(
        'year',             v_target_year,
        'month',            v_target_month,
        'label',            public.format_period_label(v_target_year, v_target_month),
        'current_status',     v_target_status->>'status',
        'last_active_period', CASE
            WHEN v_last_year IS NULL THEN NULL
            ELSE jsonb_build_object(
                'year',   v_last_year,
                'month',  v_last_month,
                'status', v_last_status,
                'label',  public.format_period_label(v_last_year, v_last_month)
            )
        END
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_unpaid_period(uuid) TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. generate_qr_monthly_charge: reutiliza cualquier cobro impago + puebla período
-- ─────────────────────────────────────────────────────────────────────────────
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
    v_next jsonb; v_py smallint; v_pm smallint;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
    SELECT * INTO v_qr FROM public.school_join_qr_codes WHERE slug = p_slug AND active = true;
    IF v_qr.id IS NULL THEN RAISE EXCEPTION 'QR not found or inactive' USING ERRCODE='02000'; END IF;
    v_school_id := v_qr.school_id;
    SELECT name INTO v_school_name FROM public.schools WHERE id = v_school_id;

    SELECT * INTO v_child FROM public.children
    WHERE id = p_child_id AND parent_id = v_user_id AND school_id = v_school_id;
    IF v_child.id IS NULL THEN RAISE EXCEPTION 'Hijo no válido para esta escuela' USING ERRCODE='42501'; END IF;

    -- DEDUP FUERTE: reutiliza CUALQUIER cobro impago (pending/overdue) sin
    -- comprobante del hijo en esta escuela — el más antiguo por período. Antes
    -- se deduplicaba solo por "mes en curso", así que al avanzar de mes se
    -- apilaban cobros de meses distintos.
    SELECT id, amount INTO v_existing, v_existing_amount
    FROM public.payments
    WHERE child_id = p_child_id AND school_id = v_school_id
      AND status IN ('pending', 'overdue')
      AND COALESCE(receipt_url, '') = ''
    ORDER BY COALESCE(period_year,  EXTRACT(YEAR  FROM due_date)::smallint),
             COALESCE(period_month, EXTRACT(MONTH FROM due_date)::smallint),
             created_at ASC
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

    -- Período objetivo con la lógica corregida (no avanza si hay impago).
    v_next := public.next_unpaid_period(p_child_id);
    v_py := (v_next->>'year')::smallint;
    v_pm := (v_next->>'month')::smallint;

    INSERT INTO public.payments (
        school_id, branch_id, parent_id, child_id, team_id, concept, amount,
        due_date, status, payment_type, qr_id, period_year, period_month)
    VALUES (
        v_school_id, v_child.branch_id, v_user_id, p_child_id, v_child.team_id,
        'Mensualidad ' || public.format_period_label(v_py, v_pm) || ' - ' || v_child.full_name || ' (' || v_school_name || ')',
        v_amount, CURRENT_DATE, 'pending', 'one_time', v_qr.id, v_py, v_pm)
    RETURNING id INTO v_payment_id;

    RETURN jsonb_build_object('ok', true, 'payment_id', v_payment_id, 'amount', v_amount, 'reused', false, 'period', v_next);
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_qr_monthly_charge(text, uuid) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. submit_qr_signup: inscripción idempotente (no re-inscribe ni re-cobra)
-- ─────────────────────────────────────────────────────────────────────────────
-- Base: 20260625000002 (precio desde offering_plans). Cambios: reutiliza el
-- enrollment activo existente y el cobro impago existente en vez de crear otro.
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
        INSERT INTO public.children (parent_id, school_id, branch_id, team_id, full_name, date_of_birth, doc_type, doc_number, gender, monthly_fee, is_active)
        VALUES (v_user_id, v_school_id, v_branch_id, v_team_id, p_child_full_name, p_child_dob, p_child_doc_type, p_child_doc_number, p_child_gender, v_amount, true)
        RETURNING id INTO v_child_id;
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
    -- sin comprobante en esta escuela, reutilizarlo — no apilar cobros nuevos
    -- en cada visita al QR.
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


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Limpieza de duplicados YA creados (conservadora — es dinero)
-- ─────────────────────────────────────────────────────────────────────────────
-- Cancela SOLO cobros pendientes de meses en el FUTURO cuando el mismo hijo ya
-- tiene otro cobro impago en el mes actual o pasado (el "real"). Así se colapsa
-- el apilamiento (Jul conserva, Ago/Sep cancela) sin tocar meses realmente
-- adeudados, ni cobros con comprobante, ni pagados/en validación.
UPDATE public.payments p
   SET status = 'cancelled',
       updated_at = now()
 WHERE p.child_id IS NOT NULL
   AND p.status = 'pending'
   AND COALESCE(p.receipt_url, '') = ''
   AND p.payment_date IS NULL
   AND p.period_year  IS NOT NULL
   AND p.period_month IS NOT NULL
   AND make_date(p.period_year::int, p.period_month::int, 1)
       > date_trunc('month', CURRENT_DATE)::date
   AND EXISTS (
        SELECT 1 FROM public.payments q
         WHERE q.child_id = p.child_id
           AND q.school_id = p.school_id
           AND q.id <> p.id
           AND q.status IN ('pending', 'overdue')
           AND make_date(
                 COALESCE(q.period_year,  EXTRACT(YEAR  FROM q.due_date))::int,
                 COALESCE(q.period_month, EXTRACT(MONTH FROM q.due_date))::int, 1)
               <= date_trunc('month', CURRENT_DATE)::date
   );

COMMIT;

NOTIFY pgrst, 'reload schema';
