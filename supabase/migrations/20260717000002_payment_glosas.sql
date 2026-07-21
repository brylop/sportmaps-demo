-- ============================================================
-- SPORTMAPS — Comprobantes v2, Fase 3: Módulo de Glosas (tabla + RLS)
-- Spec: docs/specs/receipt-extraction-v2-glosas.md §5
-- ------------------------------------------------------------
-- Un comprobante discutible (amarillo) no se rechaza en seco: entra a un ciclo
-- de glosa (objeción tipificada → respuesta del acudiente → conciliación admin).
-- Esta migración crea la tabla payment_glosas + RLS + triggers, agrega el estado
-- 'glosado' a payments, y los settings de la escuela. Los RPCs de transición y el
-- job de vencimiento van en la migración siguiente (20260717000003).
--
-- Convenciones: text + CHECK (no CREATE TYPE), FKs a public.*, school_id
-- denormalizado p/ RLS + audit. Patrón calcado del módulo Equipment.
-- Fecha: 2026-07-17
-- ============================================================

-- ── Tabla ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_glosas (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Denormalizado desde el pago para RLS (is_school_admin) y audit_trigger_func.
    school_id       uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    payment_id      uuid        NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
    reason          text        NOT NULL CHECK (reason IN (
                                    'MONTO_DIFIERE', 'FECHA_FUERA_VENTANA', 'REFERENCIA_DUPLICADA',
                                    'DESTINO_NO_COINCIDE', 'CAMPOS_ILEGIBLES', 'LECTURA_INCONSISTENTE',
                                    'NO_APARECE_EN_BANCO', 'OTRO')),
    reason_detail   jsonb,
    status          text        NOT NULL DEFAULT 'GLOSADA' CHECK (status IN (
                                    'GLOSADA', 'EN_RESPUESTA', 'EN_CONCILIACION', 'ACEPTADA', 'RATIFICADA')),
    response_text   text,
    response_files  jsonb,
    resolution_note text,
    responds_by     date        NOT NULL,
    created_by      uuid        REFERENCES public.profiles(id),   -- admin que abrió; NULL = sistema
    responded_at    timestamptz,
    resolved_at     timestamptz,
    resolved_by     uuid        REFERENCES public.profiles(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.payment_glosas IS
    'Ciclo de glosa de un comprobante de pago: objeción tipificada → respuesta acudiente → conciliación admin.';
COMMENT ON COLUMN public.payment_glosas.reason_detail IS
    'Detalle del motivo, p.ej. {expected:150000, extracted:130000} para MONTO_DIFIERE.';
COMMENT ON COLUMN public.payment_glosas.created_by IS
    'Admin que abrió la glosa. NULL = creación de sistema (auto-glosa app-layer, Fase 5).';

-- ── Índices ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_payment_glosas_school_status
    ON public.payment_glosas (school_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_glosas_due
    ON public.payment_glosas (responds_by) WHERE status = 'GLOSADA';
CREATE INDEX IF NOT EXISTS idx_payment_glosas_payment
    ON public.payment_glosas (payment_id);

-- Una sola glosa ABIERTA por pago (los estados terminales no bloquean re-glosar).
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_glosas_open_per_payment
    ON public.payment_glosas (payment_id)
    WHERE status IN ('GLOSADA', 'EN_RESPUESTA', 'EN_CONCILIACION');

COMMENT ON INDEX public.uq_payment_glosas_open_per_payment IS
    'Impide dos glosas abiertas a la vez sobre el mismo pago.';

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.payment_glosas ENABLE ROW LEVEL SECURITY;

-- Admin de la escuela (o super admin): gestiona todo. Las escrituras reales van
-- por RPCs SECURITY DEFINER (service_role); esta policy cubre lecturas del panel.
DROP POLICY IF EXISTS payment_glosas_admin ON public.payment_glosas;
CREATE POLICY payment_glosas_admin ON public.payment_glosas
    FOR ALL TO authenticated
    USING (public.is_super_admin() OR public.is_school_admin(school_id))
    WITH CHECK (public.is_super_admin() OR public.is_school_admin(school_id));

-- Acudiente: solo LEE las glosas de sus propios pagos (join a payments; la glosa
-- no tiene parent_id). Responder va por RPC, no por RLS de escritura.
DROP POLICY IF EXISTS payment_glosas_parent_read ON public.payment_glosas;
CREATE POLICY payment_glosas_parent_read ON public.payment_glosas
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.payments p
            WHERE p.id = payment_glosas.payment_id
              AND p.parent_id = auth.uid()
        )
    );

-- ── Triggers (guardados: solo si la función existe) ─────────────────────────
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'set_updated_at') THEN
        EXECUTE 'DROP TRIGGER IF EXISTS trg_set_updated_at_payment_glosas ON public.payment_glosas';
        EXECUTE 'CREATE TRIGGER trg_set_updated_at_payment_glosas
                 BEFORE UPDATE ON public.payment_glosas
                 FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'audit_trigger_func') THEN
        EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_payment_glosas ON public.payment_glosas';
        EXECUTE 'CREATE TRIGGER trg_audit_payment_glosas
                 AFTER INSERT OR UPDATE OR DELETE ON public.payment_glosas
                 FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func()';
    END IF;
END $$;

-- ── payments.status += 'glosado' ───────────────────────────────────────────
-- payments.status es TEXT con CHECK nombrado (no el enum pay_status). Se re-crea
-- el constraint agregando 'glosado' (un pago con glosa abierta sale de la cola de
-- aprobación y muestra "necesita aclaración").
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE public.payments
    ADD CONSTRAINT payments_status_check
    CHECK (status = ANY (ARRAY[
        'pending', 'paid', 'overdue', 'failed', 'cancelled',
        'awaiting_approval', 'rejected', 'partial', 'glosado'
    ]::text[]));

-- ── school_settings: config del ciclo de glosa ─────────────────────────────
ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS glosa_response_days int     NOT NULL DEFAULT 5
        CHECK (glosa_response_days >= 1),
    ADD COLUMN IF NOT EXISTS auto_glosa_enabled  boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.school_settings.glosa_response_days IS
    'Días que tiene el acudiente para responder una glosa antes de que se ratifique automáticamente. Default 5.';
COMMENT ON COLUMN public.school_settings.auto_glosa_enabled IS
    'Si true, el BFF (app-layer) abre glosa automáticamente en comprobantes amarillos. Default false (modo sombra). NO es un trigger de BD.';

NOTIFY pgrst, 'reload schema';
