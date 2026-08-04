-- ============================================================
-- SPORTMAPS — Módulo Contable · Fase 3 (nómina Colombia) · Slice 1: fundación
--
-- Empleados (contrato laboral por entidad, multi-owner) + parámetros legales
-- VERSIONADOS POR AÑO. El versionado por año es lo que hace que:
--   - actualizar el próximo año = 1 fila nueva (no se editan años pasados);
--   - recalcular una nómina histórica siempre use el parámetro de SU año.
--
-- Este slice NO incluye el motor de cálculo (payroll_runs/items) — va en el
-- slice 2, con la exoneración Ley 1607 y las provisiones activadas por defecto.
-- ============================================================

DO $$ BEGIN
    CREATE TYPE public.contract_type AS ENUM
        ('indefinido','fijo','obra_labor','prestacion_servicios','aprendizaje');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Parámetros legales por año (NACIONALES, no por entidad) ──────────────────
CREATE TABLE IF NOT EXISTS public.payroll_config (
    year                          integer PRIMARY KEY,
    smmlv                         numeric NOT NULL,   -- salario mínimo mensual
    transport_aid                 numeric NOT NULL,   -- auxilio de transporte
    uvt                           numeric,            -- unidad de valor tributario (retención)
    transport_aid_threshold_smmlv numeric NOT NULL DEFAULT 2,   -- auxilio si salario <= 2 SMMLV

    -- Deducciones del empleado
    health_pct                    numeric NOT NULL DEFAULT 0.04,   -- salud 4%
    pension_pct                   numeric NOT NULL DEFAULT 0.04,   -- pensión 4%
    fsp_pct                       numeric NOT NULL DEFAULT 0.01,   -- FSP base (>= 4 SMMLV)
    fsp_threshold_smmlv           numeric NOT NULL DEFAULT 4,

    -- Aportes del empleador
    emp_health_pct                numeric NOT NULL DEFAULT 0.085,  -- salud patronal 8.5%
    emp_pension_pct               numeric NOT NULL DEFAULT 0.12,   -- pensión patronal 12%
    caja_pct                      numeric NOT NULL DEFAULT 0.04,   -- caja de compensación
    sena_pct                      numeric NOT NULL DEFAULT 0.02,
    icbf_pct                      numeric NOT NULL DEFAULT 0.03,
    -- ARL por clase de riesgo I..V
    arl_rates                     jsonb   NOT NULL DEFAULT
        '{"1":0.00522,"2":0.01044,"3":0.02436,"4":0.0435,"5":0.0696}'::jsonb,

    -- Exoneración Ley 1607: empleados con IBC < N SMMLV exoneran salud
    -- patronal + SENA + ICBF. Activada por defecto.
    exoneration_enabled           boolean NOT NULL DEFAULT true,
    exoneration_threshold_smmlv   numeric NOT NULL DEFAULT 10,

    -- Provisiones de prestaciones sociales (mensual sobre base prestacional)
    cesantias_pct                 numeric NOT NULL DEFAULT 0.0833,
    intereses_cesantias_pct       numeric NOT NULL DEFAULT 0.12,   -- 12% anual sobre cesantías
    prima_pct                     numeric NOT NULL DEFAULT 0.0833,
    vacaciones_pct                numeric NOT NULL DEFAULT 0.0417,

    notes                         text,
    created_at                    timestamptz NOT NULL DEFAULT now(),
    updated_at                    timestamptz NOT NULL DEFAULT now()
);

-- Seed año actual. OJO: los PORCENTAJES son ley estable; el SMMLV, el auxilio
-- de transporte y la UVT CAMBIAN CADA AÑO → verificar/actualizar con el decreto
-- oficial del año (proceso de actualización documentado en el módulo).
INSERT INTO public.payroll_config (year, smmlv, transport_aid, uvt, notes)
VALUES (2026, 1423500, 200000, 49799,
        'VALORES DE REFERENCIA — verificar SMMLV/auxilio/UVT con el decreto oficial 2026.')
ON CONFLICT (year) DO NOTHING;

ALTER TABLE public.payroll_config ENABLE ROW LEVEL SECURITY;
-- Parámetros nacionales: los lee cualquiera autenticado (el motor de cálculo);
-- la escritura queda a service_role / plataforma (no policy de write a authenticated).
DROP POLICY IF EXISTS payroll_config_read ON public.payroll_config;
CREATE POLICY payroll_config_read ON public.payroll_config
    FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.payroll_config TO authenticated;

-- ─── Empleados (contrato) por entidad ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payroll_employees (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_type     text        NOT NULL CHECK (owner_type IN ('school','vendor','organizer')),
    owner_id       uuid        NOT NULL,
    profile_id     uuid        REFERENCES auth.users(id),        -- si es un coach/usuario de la app
    staff_id       uuid        REFERENCES public.school_staff(id),
    full_name      text        NOT NULL,
    document_id    text        NOT NULL,
    contract_type  public.contract_type NOT NULL DEFAULT 'indefinido',
    base_salary    numeric     NOT NULL CHECK (base_salary >= 0),
    transport_aid_eligible boolean NOT NULL DEFAULT true,        -- aplica si salario <= umbral
    eps            text,
    afp            text,
    arl_class      smallint    CHECK (arl_class BETWEEN 1 AND 5),
    hire_date      date,
    end_date       date,
    active         boolean     NOT NULL DEFAULT true,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payroll_employees_owner ON public.payroll_employees (owner_type, owner_id) WHERE active;

ALTER TABLE public.payroll_employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payroll_employees_owner ON public.payroll_employees;
CREATE POLICY payroll_employees_owner ON public.payroll_employees
    FOR ALL TO authenticated
    USING (public.can_manage_finances(owner_type, owner_id))
    WITH CHECK (public.can_manage_finances(owner_type, owner_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_employees TO authenticated;

-- ─── Triggers updated_at ──────────────────────────────────────────────────────
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'set_updated_at') THEN
        EXECUTE 'DROP TRIGGER IF EXISTS trg_payroll_config_updated_at ON public.payroll_config';
        EXECUTE 'CREATE TRIGGER trg_payroll_config_updated_at BEFORE UPDATE ON public.payroll_config
                 FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
        EXECUTE 'DROP TRIGGER IF EXISTS trg_payroll_employees_updated_at ON public.payroll_employees';
        EXECUTE 'CREATE TRIGGER trg_payroll_employees_updated_at BEFORE UPDATE ON public.payroll_employees
                 FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    END IF;
END $$;
