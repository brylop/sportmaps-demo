-- ============================================================
-- SPORTMAPS — Torneos por Escuela: fundación de ownership (Fase 0/1)
-- ------------------------------------------------------------
-- La escuela ya puede ser creadora de eventos a nivel de esquema:
--   * events.creator_role ya permite 'school' (CHECK existente).
--   * events.organizer_id ya es nullable.
--   * visibility ya soporta public / invited_only / school_only.
-- Falta enlazar el evento a la ENTIDAD escuela y agregar los flags de las
-- decisiones de producto (payer_mode, gate de pago, alcance, etc.).
--
-- Mapeo de casos (sin tablas nuevas aún):
--   interno            → creator_role='school', tournament_scope='internal', visibility='school_only'
--   externo privado    → creator_role='school', tournament_scope='external', visibility='invited_only' + invited_schools[]
--   externo público    → creator_role='school', tournament_scope='external', visibility='public'
--
-- SOLO estructura aditiva. RLS va en migración aparte (necesita ver policies
-- existentes). Ref diseño: docs/tournaments-decisions.md (D1,D2,D3,D7).
-- Fecha: 2026-07-14
-- ============================================================

BEGIN;

-- ── 1. events: owner escuela + flags de torneo ─────────────────────────────
ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS school_id                     uuid REFERENCES public.schools(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS tournament_scope              text
        CHECK (tournament_scope IS NULL OR tournament_scope IN ('internal','external')),
    ADD COLUMN IF NOT EXISTS payer_mode                    text NOT NULL DEFAULT 'school'
        CHECK (payer_mode IN ('school','parent','flexible')),
    ADD COLUMN IF NOT EXISTS payment_gates_approval        boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS allow_individual_registration boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS correction_deadline           date;

COMMENT ON COLUMN public.events.school_id IS
    'Escuela dueña del torneo cuando creator_role=school. NULL para torneos de organizer.';
COMMENT ON COLUMN public.events.tournament_scope IS
    'internal = equipos propios de la escuela; external = contra otras academias. NULL en eventos de organizer.';
COMMENT ON COLUMN public.events.payer_mode IS
    'Quién paga la inscripción: school (la escuela recauda) | parent (cada familia paga directo) | flexible.';
COMMENT ON COLUMN public.events.payment_gates_approval IS
    'Si true, una delegación/registro no se aprueba (ni entra a bracket/lista pública) hasta cubrir el pago.';
COMMENT ON COLUMN public.events.allow_individual_registration IS
    'Permite inscripción individual además de por delegación (D1).';
COMMENT ON COLUMN public.events.correction_deadline IS
    'Athlete Correction Deadline: hasta esta fecha, reembolso/cambios completos sin preguntas (D4).';

-- Guard: si el evento es de una escuela, debe tener school_id (no rompe filas de organizer).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'public.events'::regclass
           AND conname  = 'events_school_owner_requires_school_id'
    ) THEN
        ALTER TABLE public.events
            ADD CONSTRAINT events_school_owner_requires_school_id
            CHECK (creator_role <> 'school' OR school_id IS NOT NULL) NOT VALID;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_events_school_id ON public.events (school_id) WHERE school_id IS NOT NULL;

-- ── 2. event_delegations: override de payer_mode + fecha de saldo ──────────
ALTER TABLE public.event_delegations
    ADD COLUMN IF NOT EXISTS payer_mode    text
        CHECK (payer_mode IS NULL OR payer_mode IN ('school','parent','flexible')),
    ADD COLUMN IF NOT EXISTS balance_due_at date;

COMMENT ON COLUMN public.event_delegations.payer_mode IS
    'Override del events.payer_mode para esta delegación. NULL = hereda del evento.';
COMMENT ON COLUMN public.event_delegations.balance_due_at IS
    'Fecha límite de saldo tras el depósito (D3). Si no se cubre, se liberan cupos.';

-- ── 3. event_delegation_payments: soporte parent_pays (pago por familia) ───
ALTER TABLE public.event_delegation_payments
    ADD COLUMN IF NOT EXISTS team_member_id   uuid REFERENCES public.event_team_members(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS payer_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.event_delegation_payments.team_member_id IS
    'En modo parent_pays: integrante al que corresponde este pago. NULL = pago a nivel delegación (school_pays).';
COMMENT ON COLUMN public.event_delegation_payments.payer_profile_id IS
    'En modo parent_pays: perfil (padre/acudiente) que realizó el pago.';

CREATE INDEX IF NOT EXISTS idx_edp_team_member ON public.event_delegation_payments (team_member_id) WHERE team_member_id IS NOT NULL;

-- ── 4. event_registrations: inscripción individual independiente (D1) ──────
-- school_id ya existe en la tabla; solo falta marcar "independiente".
ALTER TABLE public.event_registrations
    ADD COLUMN IF NOT EXISTS is_independent boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.event_registrations.is_independent IS
    'true = atleta sin academia (independiente). Si false, school_id debería estar presente (D1).';

-- ── 5. event_categories_config: acción cuando no se alcanza el mínimo (D7) ──
ALTER TABLE public.event_categories_config
    ADD COLUMN IF NOT EXISTS min_not_met_action text
        CHECK (min_not_met_action IS NULL OR min_not_met_action IN ('merge','exhibition','refund','proceed'));

COMMENT ON COLUMN public.event_categories_config.min_not_met_action IS
    'Decisión MANUAL del organizador si la categoría no alcanza el mínimo: merge | exhibition | refund | proceed (D7).';

COMMIT;

NOTIFY pgrst, 'reload schema';
