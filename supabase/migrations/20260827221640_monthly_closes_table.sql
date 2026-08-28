-- =============================================================================
-- 20260827221640_monthly_closes_table.sql
-- Autor: brylop   Fecha: 2026-08-27   Versión anterior: 20260826112433
-- Objetivo: F1 del módulo Ciclo de Mes (docs/specs/month-close-module.md,
--   docs/plan-f1-cierre-de-mes.md) — tabla que registra el cierre de mes de
--   cobros por escuela. Es un cierre de REGISTRO (soft-close, D5 del spec):
--   no bloquea pagos ni la generación del mes siguiente (open_month, F0, sigue
--   intacta). Solo congela los 7 totales agregados del período; el detalle
--   nominal (quién debe / quién pagó) se sigue consultando en vivo con las
--   RPCs que ya existen (get_payment_aging_report, get_school_payment_history_grid,
--   tab Historial) — decisión tomada en la conversación del 27-ago para no
--   versionar un breakdown nominal que nadie pidió.
--   v1 solo usa scope='cobros'; gastos/nomina/consolidado quedan como valores
--   válidos en el CHECK (no cuesta nada dejarlos) pero ninguna RPC los produce
--   todavía — son F5/F6 del spec, fuera de este plan.
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

CREATE TABLE public.monthly_closes (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    branch_id       uuid        REFERENCES public.school_branches(id) ON DELETE SET NULL, -- v1 siempre NULL (single-branch)
    period_year     smallint    NOT NULL CHECK (period_year BETWEEN 2020 AND 2100),
    period_month    smallint    NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    scope           text        NOT NULL DEFAULT 'cobros'
                    CHECK (scope IN ('cobros','gastos','nomina','consolidado')),
    status          text        NOT NULL DEFAULT 'abierto'
                    CHECK (status IN ('abierto','cerrado','reabierto')),
    opened_by       uuid        REFERENCES public.profiles(id),  -- NULL = fila creada por close_month (mes histórico nunca abierto)
    opened_at       timestamptz,
    closed_by       uuid        REFERENCES public.profiles(id),
    closed_at       timestamptz,
    reopened_by     uuid        REFERENCES public.profiles(id),
    reopened_at     timestamptz,
    reopen_reason   text,
    -- Snapshot: solo totales agregados. Recalculado en cada close_month, incluso
    -- si ya estaba 'cerrado' (recerrar sobreescribe directo — decisión 27-ago,
    -- sin exigir reopen_month primero).
    total_expected  numeric     NOT NULL DEFAULT 0,  -- facturado (excluye cancelled y rejected)
    total_settled   numeric     NOT NULL DEFAULT 0,  -- cobrado (paid + amount_paid de partial)
    total_open      numeric     NOT NULL DEFAULT 0,  -- cartera = expected - settled
    total_late_fees numeric     NOT NULL DEFAULT 0,
    count_expected  integer     NOT NULL DEFAULT 0,
    count_settled   integer     NOT NULL DEFAULT 0,
    count_open      integer     NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Un cierre activo por escuela/sede/período/scope. branch_id NULL no colisiona
-- consigo mismo en Postgres (NULL <> NULL) → dos índices únicos parciales,
-- mismo gotcha ya documentado en el spec §7 y en el plan F1 §2.
CREATE UNIQUE INDEX uniq_monthly_close_branch
    ON public.monthly_closes (school_id, branch_id, period_year, period_month, scope)
    WHERE branch_id IS NOT NULL;
CREATE UNIQUE INDEX uniq_monthly_close_no_branch
    ON public.monthly_closes (school_id, period_year, period_month, scope)
    WHERE branch_id IS NULL;

CREATE INDEX idx_monthly_closes_school_period
    ON public.monthly_closes (school_id, period_year, period_month);

ALTER TABLE public.monthly_closes ENABLE ROW LEVEL SECURITY;

-- Cerrar el mes es un acto administrativo/financiero, no trabajo operativo de
-- staff (a diferencia de school_categories) — mismo criterio que la policy
-- viva de payments ("Payments: manage staff" usa is_school_admin, no
-- user_staff_school_ids). Una sola policy FOR ALL con WITH CHECK explícito
-- (invariante I3 de docs/auditoria-seguridad-2026-08-14.md).
CREATE POLICY "monthly_closes_manage_admin"
    ON public.monthly_closes FOR ALL
    USING (public.is_super_admin() OR public.is_school_admin(school_id))
    WITH CHECK (public.is_super_admin() OR public.is_school_admin(school_id));

REVOKE ALL ON public.monthly_closes FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_closes TO authenticated;
GRANT ALL ON public.monthly_closes TO service_role;

COMMENT ON TABLE public.monthly_closes IS
    'F1 del Ciclo de Mes: cierre de registro (soft-close) por escuela/período/scope. v1 solo scope=cobros. No bloquea pagos ni open_month (F0); el detalle nominal (quién debe/pagó) se consulta en vivo, no se congela acá. Ver docs/plan-f1-cierre-de-mes.md.';

DROP TRIGGER IF EXISTS update_monthly_closes_updated_at ON public.monthly_closes;
CREATE TRIGGER update_monthly_closes_updated_at
    BEFORE UPDATE ON public.monthly_closes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
