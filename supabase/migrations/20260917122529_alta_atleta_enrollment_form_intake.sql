-- =============================================================================
-- 20260917122529_alta_atleta_enrollment_form_intake.sql
-- Autor: brylop   Fecha: 2026-09-17   Versión anterior: 20260916174222
-- Objetivo: fase 1 de docs/specs/alta-atleta-por-foto-hoja-matricula.md — la
--   escuela manda por WhatsApp la foto de la hoja de matrícula en papel, un
--   OCR la extrae, y un admin confirma antes de crear el atleta. Esta
--   migración crea la cola `enrollment_form_intake` + RLS. Las policies de
--   Storage van en la migración siguiente (necesitan supabase_storage_admin,
--   no aplican desde este mismo camino — ver 20260917123000). El extractor
--   OCR, el worker y el inbox son fases posteriores.
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

-- ── A. La tabla ──────────────────────────────────────────────────────────────
-- Mismo patrón que whatsapp_inbound_queue (20260911170115): FK compuesta a la
-- integración, wa_message_id NOT NULL UNIQUE para la idempotencia contra el
-- reintento de Meta, lease con locked_until/next_retry_at.
CREATE TABLE public.enrollment_form_intake (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id               uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    integration_id          uuid        NOT NULL,
    wa_message_id           text        NOT NULL,
    wa_phone_number         text        NOT NULL,
    media_id                text        NOT NULL,
    storage_path            text,
    status                  text        NOT NULL DEFAULT 'pending',
    extracted               jsonb,
    reviewed_by             uuid        REFERENCES public.profiles(id),
    reviewed_at             timestamptz,
    child_id                uuid        REFERENCES public.children(id),
    duplicate_of_child_id   uuid        REFERENCES public.children(id),
    duplicate_of_intake_id  uuid        REFERENCES public.enrollment_form_intake(id),
    rejection_reason        text,
    locked_until            timestamptz,
    next_retry_at           timestamptz,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    UNIQUE (wa_message_id)
);

-- FK compuesta contra el UNIQUE (id, school_id) de school_whatsapp_integrations
-- (puesto por la migración de opt-in): impide colar una integración de OTRA
-- escuela. ON DELETE RESTRICT: borrar una integración no puede borrar el
-- rastro de una matrícula que ya creó un atleta.
ALTER TABLE public.enrollment_form_intake
    ADD CONSTRAINT fk_enrollment_intake_integracion
    FOREIGN KEY (integration_id, school_id)
    REFERENCES public.school_whatsapp_integrations (id, school_id)
    ON DELETE RESTRICT;

ALTER TABLE public.enrollment_form_intake
    ADD CONSTRAINT chk_enrollment_intake_status CHECK (status IN (
        'pending',        -- encolada, sin procesar
        'processing',     -- tomada por el worker, con lease vigente
        'waiting_review', -- OCR corrió, espera confirmación de un admin
        'approved',       -- el admin confirmó → se creó (o vinculó) el children
        'rejected',       -- el admin descartó la foto, o no pasó el filtro de staff/formato
        'failed'          -- error permanente (mime no soportado, > tamaño)
    ));

-- ── B. Permisos ───────────────────────────────────────────────────────────────
-- Mismo criterio que whatsapp_inbound_queue: los default privileges del
-- esquema otorgan permisos a authenticated en cada tabla nueva, y
-- REVOKE ... FROM PUBLIC no los quita — hay que revocar de cada rol explícito.
REVOKE ALL ON public.enrollment_form_intake FROM PUBLIC;
REVOKE ALL ON public.enrollment_form_intake FROM anon;
REVOKE ALL ON public.enrollment_form_intake FROM authenticated;

-- El inbox de la escuela (fase 4) lee por la policy, que necesita el GRANT.
GRANT SELECT ON public.enrollment_form_intake TO authenticated;
-- El worker y los endpoints de aprobar/vincular/rechazar corren con la
-- service key del BFF.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enrollment_form_intake TO service_role;

ALTER TABLE public.enrollment_form_intake ENABLE ROW LEVEL SECURITY;

-- Lectura: is_school_admin(), no schools.owner_id = auth.uid() — el mismo
-- patrón que ya usa whatsapp_inbound_queue, para que un admin que no sea el
-- dueño también vea la cola.
CREATE POLICY "enrollment_intake_admin_select" ON public.enrollment_form_intake
    FOR SELECT TO authenticated
    USING (public.is_school_admin(school_id));

-- Escritura denegada de forma EXPLÍCITA, no por ausencia de policy
-- (invariante I3): toda escritura pasa por el BFF con service_role.
CREATE POLICY "enrollment_intake_no_direct_write" ON public.enrollment_form_intake
    FOR INSERT TO authenticated WITH CHECK (false);

-- ── C. Índice de trabajo ──────────────────────────────────────────────────────
CREATE INDEX idx_enrollment_intake_pendientes
    ON public.enrollment_form_intake (created_at)
    WHERE status IN ('pending', 'processing');

CREATE INDEX idx_enrollment_intake_school
    ON public.enrollment_form_intake (school_id, status);

-- ── D. updated_at ─────────────────────────────────────────────────────────────
-- Reusa la función genérica que ya existe (schema_refactored.sql), no se crea
-- una nueva.
CREATE TRIGGER set_enrollment_intake_updated_at
    BEFORE UPDATE ON public.enrollment_form_intake
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.enrollment_form_intake IS
    'Fotos de hojas de matrícula en papel recibidas por WhatsApp, con el '
    'resultado del OCR pendiente de revisión humana antes de crear el atleta. '
    'Ver docs/specs/alta-atleta-por-foto-hoja-matricula.md.';
COMMENT ON COLUMN public.enrollment_form_intake.extracted IS
    'EnrollmentFormResult crudo tal como salió del OCR (fase 2). El modelo '
    'solo extrae, nunca decide — el humano confirma o corrige en el inbox.';
COMMENT ON COLUMN public.enrollment_form_intake.storage_path IS
    'Ruta en el bucket identity-documents. Se estampa ANTES del OCR porque la '
    'URL de media de Meta expira (misma lección que whatsapp_inbound_queue).';
COMMENT ON COLUMN public.enrollment_form_intake.duplicate_of_child_id IS
    'Estampado cuando el documento del deportista ya existe en children de la '
    'misma escuela (§6.1 del plan). Bloquea "Crear atleta"; solo permite '
    'Vincular o Descartar.';
COMMENT ON COLUMN public.enrollment_form_intake.duplicate_of_intake_id IS
    'Estampado cuando otra fila de esta misma cola, aún sin aprobar, trae el '
    'mismo documento (dos fotos de la misma hoja).';
COMMENT ON COLUMN public.enrollment_form_intake.locked_until IS
    'Lease del worker. Vencido = la fila se rescata aunque esté en processing.';

COMMIT;
