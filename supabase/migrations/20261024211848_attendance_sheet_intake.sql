-- =============================================================================
-- 20261024211848_attendance_sheet_intake.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-25   Versión anterior: 20261024211844
-- Objetivo: cola de planillas de asistencia (foto por WhatsApp o desde la app),
--   con el OCR pendiente de revisión humana antes de guardar la sesión.
--   Mismo patrón que enrollment_form_intake (20260917122529 + 20261004074523).
--   Spec: docs/specs/whatsapp-conversacion-v2-dynasty.md §3.8.
-- Bucket de la foto: se reutiliza `identity-documents` (privado), path
--   attendance_sheet_intake/{intake_id}/hoja.{ext}. Policies de Storage en la
--   migración siguiente (20261024211852).
-- Radio: tabla nueva (0 filas), sin tocar tablas existentes.
-- Rollback: DROP TABLE en migración nueva.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra.
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

CREATE TABLE public.attendance_sheet_intake (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id               uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    integration_id          uuid,
    queue_id                uuid,
    source                  text        NOT NULL,
    submitted_by            uuid        REFERENCES public.profiles(id),
    submitted_by_wa_id      text,
    photo_path              text,
    team_id                 uuid        REFERENCES public.teams(id) ON DELETE SET NULL,
    session_date            date,
    extracted               jsonb       NOT NULL DEFAULT '{}'::jsonb,
    matches                 jsonb       NOT NULL DEFAULT '{}'::jsonb,
    team_candidates         jsonb       DEFAULT '[]'::jsonb,
    status                  text        NOT NULL DEFAULT 'por_revisar',
    session_id              uuid        REFERENCES public.attendance_sessions(id) ON DELETE SET NULL,
    reviewed_by             uuid        REFERENCES public.profiles(id),
    reviewed_at             timestamptz,
    notas                   text,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_att_sheet_source CHECK (source IN ('whatsapp', 'app')),
    CONSTRAINT chk_att_sheet_status CHECK (status IN ('por_revisar', 'guardada', 'descartada', 'error'))
);

-- queue_id sin FK: apunta a la cola de WhatsApp, que se purga.

-- FK compuesta: impide colar una integración de OTRA escuela (MATCH SIMPLE:
-- con integration_id NULL, caso 'app', no se evalúa).
ALTER TABLE public.attendance_sheet_intake
    ADD CONSTRAINT fk_att_sheet_integracion
    FOREIGN KEY (integration_id, school_id)
    REFERENCES public.school_whatsapp_integrations (id, school_id)
    ON DELETE RESTRICT;

CREATE INDEX idx_att_sheet_school_status ON public.attendance_sheet_intake (school_id, status, created_at DESC);
CREATE INDEX idx_att_sheet_queue         ON public.attendance_sheet_intake (queue_id) WHERE queue_id IS NOT NULL;

REVOKE ALL ON public.attendance_sheet_intake FROM PUBLIC;
REVOKE ALL ON public.attendance_sheet_intake FROM anon;
REVOKE ALL ON public.attendance_sheet_intake FROM authenticated;
GRANT SELECT ON public.attendance_sheet_intake TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_sheet_intake TO service_role;

ALTER TABLE public.attendance_sheet_intake ENABLE ROW LEVEL SECURITY;

CREATE POLICY "att_sheet_staff_select" ON public.attendance_sheet_intake
    FOR SELECT TO authenticated
    USING (school_id = ANY (public.user_staff_school_ids()));

-- Escritura denegada de forma EXPLICITA (invariante I3): todo va por service_role.
CREATE POLICY "att_sheet_no_direct_write" ON public.attendance_sheet_intake
    FOR INSERT TO authenticated WITH CHECK (false);

CREATE TRIGGER set_att_sheet_updated_at
    BEFORE UPDATE ON public.attendance_sheet_intake
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.attendance_sheet_intake IS
    'Planillas de asistencia en foto (WhatsApp o app) con el OCR pendiente de revision humana. '
    'Nunca se guarda asistencia sin que alguien confirme. Spec whatsapp-conversacion-v2-dynasty 3.8.';
COMMENT ON COLUMN public.attendance_sheet_intake.photo_path IS
    'Ruta en el bucket identity-documents: attendance_sheet_intake/{id}/hoja.{ext}.';
COMMENT ON COLUMN public.attendance_sheet_intake.team_candidates IS
    'Equipos candidatos deducidos de la hoja (nombres vs rosters, encabezado, horario) con su puntaje.';

COMMIT;
