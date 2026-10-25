-- =============================================================================
-- 20261024211841_enrollment_plan_changes_y_ajustes.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-25   Versión anterior: 20261024084549
-- Objetivo: docs/specs/whatsapp-conversacion-v2-dynasty.md §3.7/§3.8.
--   (1) enrollment_plan_changes: registro de cada cambio de plan por asistencia,
--       real (mode='auto', applied=true) o simulado (mode='sombra', applied=false).
--   (2) school_settings: modo y parámetros del cambio automático por asistencia.
-- Radio: tabla nueva (0 filas) + 3 columnas con DEFAULT constante sobre
--   school_settings (una fila por escuela; en PG15 ADD COLUMN con default
--   constante no reescribe la tabla; toma ACCESS EXCLUSIVE un instante).
--   Todas las escuelas quedan en 'apagado': comportamiento actual intacto.
-- Rollback: migración nueva que haga DROP TABLE / DROP COLUMN.
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

CREATE TABLE public.enrollment_plan_changes (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id               uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    enrollment_id           uuid        NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
    child_id                uuid        REFERENCES public.children(id) ON DELETE SET NULL,
    unregistered_athlete_id uuid        REFERENCES public.unregistered_athletes(id) ON DELETE SET NULL,
    from_plan_id            uuid        REFERENCES public.offering_plans(id) ON DELETE SET NULL,
    to_plan_id              uuid        REFERENCES public.offering_plans(id) ON DELETE SET NULL,
    from_amount             numeric,
    to_amount               numeric,
    clases_mes              integer,
    amount_paid             numeric,
    period_year             integer,
    period_month            integer,
    debt_at_change          numeric     NOT NULL DEFAULT 0,
    direction               text        NOT NULL,
    source                  text        NOT NULL,
    mode                    text        NOT NULL,
    applied                 boolean     NOT NULL DEFAULT false,
    queue_id                uuid,
    payment_id              uuid        REFERENCES public.payments(id) ON DELETE SET NULL,
    changed_by              text        NOT NULL DEFAULT 'auto',
    razon                   text,
    created_at              timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_epc_direction    CHECK (direction IN ('up', 'down', 'same_price')),
    CONSTRAINT chk_epc_source       CHECK (source    IN ('attendance', 'manual', 'api')),
    CONSTRAINT chk_epc_mode         CHECK (mode      IN ('sombra', 'auto')),
    CONSTRAINT chk_epc_period_month CHECK (period_month IS NULL OR period_month BETWEEN 1 AND 12)
);

-- queue_id no lleva FK a propósito: apunta a la cola de WhatsApp, que se purga.

CREATE INDEX idx_epc_school_created ON public.enrollment_plan_changes (school_id, created_at DESC);
CREATE INDEX idx_epc_enrollment     ON public.enrollment_plan_changes (enrollment_id);
-- Una sola propuesta de sombra por inscripción y mes: el cálculo puede correr
-- varias veces sin duplicar (el BFF usa ON CONFLICT DO NOTHING/UPDATE).
CREATE UNIQUE INDEX uq_epc_sombra_por_periodo
    ON public.enrollment_plan_changes (enrollment_id, period_year, period_month, mode)
    WHERE mode = 'sombra';

REVOKE ALL ON public.enrollment_plan_changes FROM PUBLIC;
REVOKE ALL ON public.enrollment_plan_changes FROM anon;
REVOKE ALL ON public.enrollment_plan_changes FROM authenticated;
GRANT SELECT ON public.enrollment_plan_changes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enrollment_plan_changes TO service_role;

ALTER TABLE public.enrollment_plan_changes ENABLE ROW LEVEL SECURITY;

-- Lectura: quien trabaja en la escuela (sin padres/atletas). Sin policies de
-- escritura: toda escritura va por service_role o por aplicar_cambio_plan().
CREATE POLICY "epc_staff_select" ON public.enrollment_plan_changes
    FOR SELECT TO authenticated
    USING (school_id = ANY (public.user_staff_school_ids()));

COMMENT ON TABLE public.enrollment_plan_changes IS
    'Registro de cambios de plan por asistencia (spec whatsapp-conversacion-v2-dynasty 3.7/3.8). '
    'mode=sombra/applied=false: lo que se cambiaria; mode=auto/applied=true: lo que se cambio. '
    'Control: direction=down AND debt_at_change > 0 = bajo de plan debiendo.';

-- ── Ajustes por escuela ─────────────────────────────────────────────────────
-- La tabla viva es public.school_settings (una fila por school_id).
ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS plan_por_asistencia_modo text    NOT NULL DEFAULT 'apagado',
    ADD COLUMN IF NOT EXISTS plan_sube_umbral         integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS plan_baja_meses          integer NOT NULL DEFAULT 2;

ALTER TABLE public.school_settings
    ADD CONSTRAINT chk_school_settings_plan_por_asistencia_modo
    CHECK (plan_por_asistencia_modo IN ('apagado', 'sombra', 'auto'));
ALTER TABLE public.school_settings
    ADD CONSTRAINT chk_school_settings_plan_sube_umbral CHECK (plan_sube_umbral >= 0);
ALTER TABLE public.school_settings
    ADD CONSTRAINT chk_school_settings_plan_baja_meses CHECK (plan_baja_meses >= 1);

COMMENT ON COLUMN public.school_settings.plan_por_asistencia_modo IS
    'apagado | sombra (solo registra lo que cambiaria) | auto (cambia el plan por clases tomadas).';
COMMENT ON COLUMN public.school_settings.plan_sube_umbral IS
    'Clases por ENCIMA del tope (max_sessions) del plan que disparan la subida. 0 = basta superarlo.';
COMMENT ON COLUMN public.school_settings.plan_baja_meses IS
    'Meses seguidos por debajo del tope del plan inferior antes de bajar.';

COMMIT;
