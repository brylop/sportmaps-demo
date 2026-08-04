-- ============================================================
-- SPORTMAPS — Contabilidad · Fase 3 · Slice 2: motor de nómina
--
--  - payroll_config editable por SUPER ADMIN (parámetros nacionales).
--  - payroll_runs (período por entidad) + payroll_items (desprendible x empleado).
--  - run_payroll(): calcula el período (deducciones empleado, aportes patronales
--    con exoneración Ley 1607, provisiones). post_payroll_run(): genera el egreso
--    de caja (net + aportes) enlazado, categoría 'Nómina'.
--
-- Base de caja: el egreso = neto pagado + aportes patronales (salida real del
-- mes). Las PROVISIONES (cesantías/intereses/prima/vacaciones) se calculan y
-- guardan en el desprendible pero NO son egreso hasta que se paguen (devengo).
-- ============================================================

-- ─── payroll_config: escritura por super admin ───────────────────────────────
DROP POLICY IF EXISTS payroll_config_sa_insert ON public.payroll_config;
CREATE POLICY payroll_config_sa_insert ON public.payroll_config
    FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
DROP POLICY IF EXISTS payroll_config_sa_update ON public.payroll_config;
CREATE POLICY payroll_config_sa_update ON public.payroll_config
    FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
GRANT INSERT, UPDATE ON public.payroll_config TO authenticated;

-- ─── Runs + items ─────────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE public.payroll_run_status AS ENUM ('draft','approved','paid','void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.payroll_runs (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_type     text NOT NULL CHECK (owner_type IN ('school','vendor','organizer')),
    owner_id       uuid NOT NULL,
    period_year    integer NOT NULL,
    period_month   integer NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    status         public.payroll_run_status NOT NULL DEFAULT 'draft',
    employee_count integer NOT NULL DEFAULT 0,
    total_gross      numeric NOT NULL DEFAULT 0,  -- salario + auxilio
    total_deductions numeric NOT NULL DEFAULT 0,  -- deducciones empleado
    total_net        numeric NOT NULL DEFAULT 0,  -- neto a pagar
    total_employer   numeric NOT NULL DEFAULT 0,  -- aportes patronales
    total_provisions numeric NOT NULL DEFAULT 0,  -- provisiones (devengo, no caja)
    expense_id     uuid REFERENCES public.expenses(id) ON DELETE SET NULL,
    created_by     uuid NOT NULL REFERENCES auth.users(id),
    approved_by    uuid REFERENCES auth.users(id),
    approved_at    timestamptz,
    paid_at        timestamptz,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);
-- Un run vivo por período/entidad.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_run_period
    ON public.payroll_runs (owner_type, owner_id, period_year, period_month)
    WHERE status <> 'void';
CREATE INDEX IF NOT EXISTS idx_payroll_runs_owner ON public.payroll_runs (owner_type, owner_id, period_year DESC, period_month DESC);

CREATE TABLE IF NOT EXISTS public.payroll_items (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id         uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
    employee_id    uuid NOT NULL REFERENCES public.payroll_employees(id),
    employee_name  text NOT NULL,
    base_salary    numeric NOT NULL,
    transport_aid  numeric NOT NULL DEFAULT 0,
    ibc            numeric NOT NULL,
    -- deducciones empleado
    health_emp     numeric NOT NULL DEFAULT 0,
    pension_emp    numeric NOT NULL DEFAULT 0,
    fsp_emp        numeric NOT NULL DEFAULT 0,
    total_deductions numeric NOT NULL DEFAULT 0,
    -- aportes patronales
    health_er      numeric NOT NULL DEFAULT 0,
    pension_er     numeric NOT NULL DEFAULT 0,
    arl_er         numeric NOT NULL DEFAULT 0,
    caja_er        numeric NOT NULL DEFAULT 0,
    sena_er        numeric NOT NULL DEFAULT 0,
    icbf_er        numeric NOT NULL DEFAULT 0,
    total_employer numeric NOT NULL DEFAULT 0,
    exonerated     boolean NOT NULL DEFAULT false,
    -- provisiones
    cesantias      numeric NOT NULL DEFAULT 0,
    intereses_cesantias numeric NOT NULL DEFAULT 0,
    prima          numeric NOT NULL DEFAULT 0,
    vacaciones     numeric NOT NULL DEFAULT 0,
    total_provisions numeric NOT NULL DEFAULT 0,
    net_pay        numeric NOT NULL DEFAULT 0,
    created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payroll_items_run ON public.payroll_items (run_id);

ALTER TABLE public.payroll_runs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_runs_owner ON public.payroll_runs;
CREATE POLICY payroll_runs_owner ON public.payroll_runs
    FOR ALL TO authenticated
    USING (public.can_manage_finances(owner_type, owner_id))
    WITH CHECK (public.can_manage_finances(owner_type, owner_id));

DROP POLICY IF EXISTS payroll_items_owner ON public.payroll_items;
CREATE POLICY payroll_items_owner ON public.payroll_items
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.payroll_runs r
                    WHERE r.id = payroll_items.run_id
                      AND public.can_manage_finances(r.owner_type, r.owner_id)))
    WITH CHECK (EXISTS (SELECT 1 FROM public.payroll_runs r
                    WHERE r.id = payroll_items.run_id
                      AND public.can_manage_finances(r.owner_type, r.owner_id)));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_runs  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_items TO authenticated;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'set_updated_at') THEN
        EXECUTE 'DROP TRIGGER IF EXISTS trg_payroll_runs_updated_at ON public.payroll_runs';
        EXECUTE 'CREATE TRIGGER trg_payroll_runs_updated_at BEFORE UPDATE ON public.payroll_runs
                 FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    END IF;
END $$;

-- ─── run_payroll: calcula el período (idempotente sobre draft) ────────────────
CREATE OR REPLACE FUNCTION public.run_payroll(
    p_owner_type text, p_owner_id uuid, p_year integer, p_month integer
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    c            public.payroll_config;
    v_run_id     uuid;
    v_existing   public.payroll_runs;
    e            public.payroll_employees;
    v_base numeric; v_aux numeric; v_ibc numeric;
    v_he numeric; v_pe numeric; v_fsp numeric; v_ded numeric;
    v_exon boolean;
    v_hr numeric; v_pr numeric; v_arl numeric; v_caja numeric; v_sena numeric; v_icbf numeric; v_er numeric;
    v_arl_rate numeric;
    v_baseprest numeric; v_ces numeric; v_int numeric; v_prima numeric; v_vac numeric; v_prov numeric;
    v_net numeric;
    t_gross numeric := 0; t_ded numeric := 0; t_net numeric := 0; t_er numeric := 0; t_prov numeric := 0; t_cnt integer := 0;
BEGIN
    IF NOT public.can_manage_finances(p_owner_type, p_owner_id) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
    END IF;
    IF p_month < 1 OR p_month > 12 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_month');
    END IF;

    SELECT * INTO c FROM public.payroll_config WHERE year = p_year;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'no_config_for_year', 'year', p_year);
    END IF;

    -- Run existente del período.
    SELECT * INTO v_existing FROM public.payroll_runs
     WHERE owner_type = p_owner_type AND owner_id = p_owner_id
       AND period_year = p_year AND period_month = p_month AND status <> 'void'
     FOR UPDATE;

    IF FOUND THEN
        IF v_existing.status <> 'draft' THEN
            RETURN jsonb_build_object('ok', false, 'error', 'run_locked', 'status', v_existing.status);
        END IF;
        v_run_id := v_existing.id;
        DELETE FROM public.payroll_items WHERE run_id = v_run_id;  -- recalcular
    ELSE
        INSERT INTO public.payroll_runs (owner_type, owner_id, period_year, period_month, status, created_by)
        VALUES (p_owner_type, p_owner_id, p_year, p_month, 'draft', auth.uid())
        RETURNING id INTO v_run_id;
    END IF;

    FOR e IN
        SELECT * FROM public.payroll_employees
         WHERE owner_type = p_owner_type AND owner_id = p_owner_id AND active
    LOOP
        v_base := e.base_salary;
        v_aux  := CASE WHEN e.transport_aid_eligible
                        AND v_base <= c.transport_aid_threshold_smmlv * c.smmlv
                       THEN c.transport_aid ELSE 0 END;
        v_ibc  := GREATEST(v_base, c.smmlv);   -- IBC mínimo 1 SMMLV (auxilio no es IBC)

        -- Deducciones empleado
        v_he  := round(v_ibc * c.health_pct);
        v_pe  := round(v_ibc * c.pension_pct);
        v_fsp := CASE WHEN v_ibc >= c.fsp_threshold_smmlv * c.smmlv THEN round(v_ibc * c.fsp_pct) ELSE 0 END;
        v_ded := v_he + v_pe + v_fsp;

        -- Exoneración Ley 1607 (IBC < umbral SMMLV)
        v_exon := c.exoneration_enabled AND v_ibc < c.exoneration_threshold_smmlv * c.smmlv;

        -- Aportes patronales
        v_hr   := CASE WHEN v_exon THEN 0 ELSE round(v_ibc * c.emp_health_pct) END;
        v_pr   := round(v_ibc * c.emp_pension_pct);
        v_arl_rate := COALESCE((c.arl_rates ->> COALESCE(e.arl_class, 1)::text)::numeric, 0);
        v_arl  := round(v_ibc * v_arl_rate);
        v_caja := round(v_ibc * c.caja_pct);
        v_sena := CASE WHEN v_exon THEN 0 ELSE round(v_ibc * c.sena_pct) END;
        v_icbf := CASE WHEN v_exon THEN 0 ELSE round(v_ibc * c.icbf_pct) END;
        v_er   := v_hr + v_pr + v_arl + v_caja + v_sena + v_icbf;

        -- Provisiones (base prestacional = salario + auxilio)
        v_baseprest := v_base + v_aux;
        v_ces  := round(v_baseprest * c.cesantias_pct);
        v_int  := round(v_ces * c.intereses_cesantias_pct / 12);   -- 12% anual → porción mensual
        v_prima := round(v_baseprest * c.prima_pct);
        v_vac   := round(v_base * c.vacaciones_pct);                -- vacaciones sobre salario
        v_prov  := v_ces + v_int + v_prima + v_vac;

        v_net := v_base + v_aux - v_ded;

        INSERT INTO public.payroll_items (
            run_id, employee_id, employee_name, base_salary, transport_aid, ibc,
            health_emp, pension_emp, fsp_emp, total_deductions,
            health_er, pension_er, arl_er, caja_er, sena_er, icbf_er, total_employer, exonerated,
            cesantias, intereses_cesantias, prima, vacaciones, total_provisions, net_pay
        ) VALUES (
            v_run_id, e.id, e.full_name, v_base, v_aux, v_ibc,
            v_he, v_pe, v_fsp, v_ded,
            v_hr, v_pr, v_arl, v_caja, v_sena, v_icbf, v_er, v_exon,
            v_ces, v_int, v_prima, v_vac, v_prov, v_net
        );

        t_gross := t_gross + v_base + v_aux;
        t_ded   := t_ded + v_ded;
        t_net   := t_net + v_net;
        t_er    := t_er + v_er;
        t_prov  := t_prov + v_prov;
        t_cnt   := t_cnt + 1;
    END LOOP;

    UPDATE public.payroll_runs
       SET employee_count = t_cnt, total_gross = t_gross, total_deductions = t_ded,
           total_net = t_net, total_employer = t_er, total_provisions = t_prov,
           status = 'draft', updated_at = now()
     WHERE id = v_run_id;

    RETURN jsonb_build_object('ok', true, 'run_id', v_run_id, 'employees', t_cnt,
        'total_net', t_net, 'total_employer', t_er, 'total_provisions', t_prov,
        'cash_cost', t_net + t_er);
END;
$$;
GRANT EXECUTE ON FUNCTION public.run_payroll(text, uuid, integer, integer) TO authenticated;

-- ─── post_payroll_run: marca pagado + genera egreso de caja ───────────────────
CREATE OR REPLACE FUNCTION public.post_payroll_run(p_run_id uuid, p_paid_date date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    r          public.payroll_runs;
    v_cat      uuid;
    v_expense  uuid;
    v_amount   numeric;
    v_date     date;
BEGIN
    SELECT * INTO r FROM public.payroll_runs WHERE id = p_run_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'run_not_found'); END IF;
    IF NOT public.can_manage_finances(r.owner_type, r.owner_id) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
    END IF;
    IF r.status = 'paid' THEN
        RETURN jsonb_build_object('ok', true, 'idempotent', true, 'expense_id', r.expense_id);
    END IF;
    IF r.status = 'void' THEN RETURN jsonb_build_object('ok', false, 'error', 'run_void'); END IF;

    v_amount := r.total_net + r.total_employer;   -- salida de caja del mes (provisiones = devengo, aparte)
    v_date   := COALESCE(p_paid_date, (make_date(r.period_year, r.period_month, 1) + interval '1 month - 1 day')::date);

    -- Categoría 'Nómina' (propia de la entidad o de sistema).
    SELECT id INTO v_cat FROM public.expense_categories
     WHERE name = 'Nómina' AND (owner_id = r.owner_id OR owner_id IS NULL)
     ORDER BY owner_id NULLS LAST LIMIT 1;

    INSERT INTO public.expenses (
        owner_type, owner_id, school_id, branch_id,
        category_id, kind, status, concept, amount, expense_date, paid_date,
        payment_method, created_by
    ) VALUES (
        r.owner_type, r.owner_id,
        CASE WHEN r.owner_type = 'school' THEN r.owner_id ELSE NULL END, NULL,
        v_cat, 'payroll', 'paid',
        'Nómina ' || lpad(r.period_month::text, 2, '0') || '/' || r.period_year
            || ' (' || r.employee_count || ' empleados)',
        v_amount, v_date, v_date, 'transfer', auth.uid()
    )
    RETURNING id INTO v_expense;

    UPDATE public.payroll_runs
       SET status = 'paid', expense_id = v_expense, approved_by = auth.uid(),
           approved_at = COALESCE(approved_at, now()), paid_at = now(), updated_at = now()
     WHERE id = p_run_id;

    RETURN jsonb_build_object('ok', true, 'expense_id', v_expense, 'amount', v_amount);
END;
$$;
GRANT EXECUTE ON FUNCTION public.post_payroll_run(uuid, date) TO authenticated;
