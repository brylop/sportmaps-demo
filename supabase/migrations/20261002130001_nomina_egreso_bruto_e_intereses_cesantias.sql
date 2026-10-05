-- =============================================================================
-- 20261002130001_nomina_egreso_bruto_e_intereses_cesantias.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-02   Versión anterior: 20261002125959
-- Objetivo: C1 y C2 de docs/auditoria-contabilidad-tienda-2026-10-02.md.
--   Spec: docs/specs/blindaje-dinero-pagos-tienda-nomina.md §1.4.
--
--   C1 — post_payroll_run asentaba el egreso como total_net + total_employer.
--        Lo deducido al empleado (salud 4 %, pensión 4 %, FSP) también sale de la
--        caja de la escuela: lo paga en la PILA. La salida real del mes es
--        total_gross (salario + auxilio) + total_employer. En la única nómina
--        posteada (Escuela Demo, jul-2026) faltaban $160.000 de $2.530.440.
--        run_payroll devuelve cash_cost con la misma fórmula (lo muestra la UI).
--   C2 — run_payroll calculaba la provisión de intereses de cesantías como
--        cesantía_mensual × 12 % / 12. La cesantía ya es mensual (8,33 % del
--        salario), así que la provisión mensual es cesantía_mensual × 12 %
--        (≈ 1 % del salario). Quedaba 12 veces más baja.
--
--   Fuera de alcance (C3): los valores 2026 de payroll_config (SMMLV, auxilio,
--   UVT) siguen con los de 2025 hasta que el contador confirme el valor vigente
--   (Decreto 1469/2025 y su suspensión/levantamiento en el Consejo de Estado).
--   Se corrigen con un UPDATE desde /admin/payroll-config, sin migración.
--   La nómina demo ya posteada NO se reescribe (no es dinero real).
--
--   Solo cambian las dos líneas marcadas «C1»/«C2»; el resto es el cuerpo vivo
--   de 20260711000002, idéntico. Misma firma: se conservan los GRANT.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.run_payroll(p_owner_type text, p_owner_id uuid, p_year integer, p_month integer)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $fn$
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
        v_int  := round(v_ces * c.intereses_cesantias_pct);   -- «C2»: 12 % anual sobre la cesantía causada = porción del mes
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
        'cash_cost', t_gross + t_er);   -- «C1»: bruto + patronal (lo deducido también se paga, por PILA)
END;
$fn$;

CREATE OR REPLACE FUNCTION public.post_payroll_run(p_run_id uuid, p_paid_date date)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $fn$
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

    -- «C1»: salida de caja del mes = devengado (salario + auxilio) + aportes
    -- patronales. Neto al empleado + sus deducciones (que la escuela paga en la
    -- PILA) = devengado. Provisiones = devengo, aparte.
    v_amount := r.total_gross + r.total_employer;
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
$fn$;

COMMIT;
