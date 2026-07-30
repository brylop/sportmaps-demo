-- ============================================================
-- SPORTMAPS — Log de correos enviados
-- ------------------------------------------------------------
-- Hoy el envío es ciego: send-email dispara a Resend y no queda rastro. Cuando
-- Dynasty mandó 396 invitaciones y solo salieron 100 (tope del plan free), no
-- hubo forma de saber CUÁLES llegaron ni de reintentar solo las que fallaron.
--
-- Esta tabla registra una fila por destinatario y envío. Con eso el reenvío
-- masivo puede filtrar "los que nunca salieron" en vez de repetirle a todos.
--
-- Escribe únicamente el BFF con service_role (bypassea RLS). Los admins de la
-- escuela solo LEEN lo suyo.
--
-- Fecha: 2026-07-30
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.email_sends (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id           uuid        REFERENCES public.schools(id)     ON DELETE CASCADE,
    invitation_id       uuid        REFERENCES public.invitations(id) ON DELETE SET NULL,
    to_email            text        NOT NULL,
    email_type          text        NOT NULL DEFAULT 'parent_invitation',
    provider            text        NOT NULL DEFAULT 'resend',
    provider_message_id text,
    -- estado en text + CHECK (convención del repo: sin CREATE TYPE)
    status              text        NOT NULL DEFAULT 'sent'
                                    CHECK (status IN ('sent', 'failed')),
    error               text,
    attempts            integer     NOT NULL DEFAULT 1,
    batch_id            uuid,       -- agrupa una corrida de envío masivo
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_sends_school_created
    ON public.email_sends (school_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_sends_invitation
    ON public.email_sends (invitation_id) WHERE invitation_id IS NOT NULL;

-- Para "¿a quién le falta que le llegue?": busca sent por invitación.
CREATE INDEX IF NOT EXISTS idx_email_sends_invitation_sent
    ON public.email_sends (invitation_id) WHERE status = 'sent';

CREATE INDEX IF NOT EXISTS idx_email_sends_batch
    ON public.email_sends (batch_id) WHERE batch_id IS NOT NULL;

ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;

-- Solo lectura, y solo de la propia escuela. El INSERT lo hace el BFF con
-- service_role, que no pasa por RLS — por eso no hay policy de escritura.
DROP POLICY IF EXISTS "School admins read their email log" ON public.email_sends;
CREATE POLICY "School admins read their email log"
ON public.email_sends FOR SELECT
TO authenticated
USING (
    public.is_super_admin()
    OR (school_id IS NOT NULL AND public.is_school_admin_of(school_id))
);

COMMIT;

NOTIFY pgrst, 'reload schema';
