-- =============================================================================
-- 20260901114532_torneos_internos_baseline_registro_pago.sql
-- Autor: brylop   Fecha: 2026-09-01   Versión anterior: 20260901112643
-- Objetivo: Fase 1 de docs/specs/torneos-internos-inscripcion-pago-2026-09-01.md
--   1) Versionar (baseline, IF NOT EXISTS/idempotente) las 8 tablas del módulo de
--      torneos que hoy viven en la base sin ningún CREATE TABLE en el repo, más
--      las columnas de deriva de event_registrations. Esto es solo documentar lo
--      que ya existe; ningún CREATE/ALTER de esta sección ejecuta de verdad
--      contra la base viva (todo IF NOT EXISTS sobre objetos ya presentes).
--   2) Habilitar de verdad la inscripción + pago individual a un torneo/liga
--      INTERNA de una escuela (hoy bloqueada a propósito solo para delegaciones
--      externas — bff/src/routes/events.route.ts:916 — pero sin ningún camino
--      alternativo para que un padre/atleta se inscriba a la liga de su propia
--      escuela). Decisión de producto ya cerrada en
--      docs/tournaments-enrollment-flow.md:70: el cobro de un torneo interno
--      reusa `payments` (igual que mensualidad/matrícula), NO
--      `event_delegation_payments` (esa es para escuela-vs-escuela).
--   3) El hueco de "hacen falta ≥2 equipos para generar fixtures" se resuelve
--      dejando que la escuela reparta a los inscritos pagados en equipos
--      DESPUÉS de la inscripción (RPC assign_registrants_to_teams), reusando
--      tal cual generate-fixtures/matches/standings — cero cambios ahí.
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

-- =============================================================================
-- PARTE 1 — Baseline de las 8 tablas sin CREATE TABLE en el repo (deriva).
-- Todas ya existen en la base viva; esto es IF NOT EXISTS puro, documentación,
-- no debe ejecutar nada real hoy.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.event_categories_config (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    division            text NOT NULL,
    level               text NOT NULL,
    category            text NOT NULL,
    rama                text NOT NULL,
    age_min             integer,
    age_max             integer,
    birth_year_min      integer,
    birth_year_max      integer,
    team_min            integer DEFAULT 10,
    team_max            integer DEFAULT 30,
    routine_max_seconds integer,
    scoring_system      text,
    crossover_allowed   boolean DEFAULT true,
    active              boolean DEFAULT true,
    sort_order          integer DEFAULT 0,
    created_at          timestamptz NOT NULL DEFAULT now(),
    min_not_met_action  text CHECK (min_not_met_action IS NULL OR min_not_met_action IN ('merge','exhibition','refund','proceed'))
);

CREATE TABLE IF NOT EXISTS public.event_price_phases (
    id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id                    uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    phase_name                  text NOT NULL,
    valid_until                 date NOT NULL,
    kit_type                    text NOT NULL DEFAULT 'gold' CHECK (kit_type IN ('platino','gold')),
    deposit_percent             integer NOT NULL DEFAULT 30 CHECK (deposit_percent BETWEEN 1 AND 100),
    price_pkg1                  numeric DEFAULT 0,
    price_pkg2                  numeric DEFAULT 0,
    price_pkg3                  numeric DEFAULT 0,
    price_solo                  numeric DEFAULT 0,
    accommodation_triple        numeric DEFAULT 0,
    accommodation_double        numeric DEFAULT 0,
    accommodation_single_extra  numeric DEFAULT 0,
    crossover_price_pkg         numeric DEFAULT 0,
    crossover_price_solo        numeric DEFAULT 0,
    extra_kit_price             numeric DEFAULT 0,
    sort_order                  integer DEFAULT 0,
    created_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_delegations (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id          uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    school_id         uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    price_phase_id    uuid REFERENCES public.event_price_phases(id) ON DELETE SET NULL,
    kit_type          text DEFAULT 'gold' CHECK (kit_type IN ('platino','gold')),
    package_locked_at timestamptz,
    status            text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','pending_payment','confirmed','closed','rejected')),
    total_owed        numeric DEFAULT 0,
    total_paid        numeric DEFAULT 0,
    referral_source   text,
    contact_name      text,
    contact_email     text,
    contact_phone     text,
    whatsapp          text,
    submitted_at      timestamptz,
    confirmed_at      timestamptz,
    rejection_reason  text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    payer_mode        text CHECK (payer_mode IS NULL OR payer_mode IN ('school','parent','flexible')),
    balance_due_at    date,
    UNIQUE (event_id, school_id)
);

CREATE TABLE IF NOT EXISTS public.event_teams (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    delegation_id  uuid NOT NULL REFERENCES public.event_delegations(id) ON DELETE CASCADE,
    event_id       uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    category_id    uuid REFERENCES public.event_categories_config(id) ON DELETE SET NULL,
    team_name      text NOT NULL,
    package_type   text NOT NULL DEFAULT 'pkg1' CHECK (package_type IN ('pkg1','pkg2','pkg3','solo')),
    accommodation  text NOT NULL DEFAULT 'cuadruple' CHECK (accommodation IN ('cuadruple','triple','doble','sencilla')),
    status         text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','confirmed','rejected')),
    locked_price   numeric DEFAULT 0,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_team_members (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id           uuid NOT NULL REFERENCES public.event_teams(id) ON DELETE CASCADE,
    delegation_id     uuid NOT NULL REFERENCES public.event_delegations(id) ON DELETE CASCADE,
    full_name         text NOT NULL,
    document_number   text,
    birth_year        integer,
    is_crossover      boolean DEFAULT false,
    crossover_team_id uuid REFERENCES public.event_teams(id) ON DELETE SET NULL,
    shirt_size        text,
    bag_size          text,
    age_validation    text DEFAULT 'pending' CHECK (age_validation IN ('pending','valid','warning','invalid')),
    profile_id        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    child_id          uuid REFERENCES public.children(id) ON DELETE SET NULL,
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_team_coaches (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         uuid NOT NULL REFERENCES public.event_teams(id) ON DELETE CASCADE,
    delegation_id   uuid NOT NULL REFERENCES public.event_delegations(id) ON DELETE CASCADE,
    coach_type      text NOT NULL DEFAULT 'principal' CHECK (coach_type IN ('principal','auxiliary','extra')),
    full_name       text NOT NULL,
    phone           text,
    certification   text,
    has_discount    boolean DEFAULT false,
    extra_cost_usd  numeric DEFAULT 0,
    profile_id      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_delegation_payments (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    delegation_id     uuid NOT NULL REFERENCES public.event_delegations(id) ON DELETE CASCADE,
    event_id          uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    school_id         uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    amount            numeric NOT NULL CHECK (amount > 0),
    currency          text NOT NULL DEFAULT 'USD',
    payment_method    text NOT NULL,
    proof_url         text,
    notes             text,
    status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    reviewed_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at       timestamptz,
    rejection_reason  text,
    payment_link_id   uuid,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    team_member_id    uuid REFERENCES public.event_team_members(id) ON DELETE SET NULL,
    payer_profile_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.event_organizers (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id         uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    organization_name  text,
    nit                text,
    city               text,
    sports             text[] DEFAULT '{}',
    bio                text,
    logo_url           text,
    payment_methods    text[] DEFAULT ARRAY['cash','transfer','nequi','daviplata','breb','card_terminal','qr_school','sportmaps_pay'],
    qr_code_url        text,
    qr_smart_enabled   boolean DEFAULT false,
    is_verified        boolean DEFAULT false,
    verification_doc_url text,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    bank_data          jsonb DEFAULT '{}',
    nequi_number       text,
    whatsapp_number    text
);

-- Baseline de las columnas de deriva de event_registrations (ya existen todas
-- en la base viva; IF NOT EXISTS puro).
ALTER TABLE public.event_registrations
    ADD COLUMN IF NOT EXISTS delegation_id     uuid REFERENCES public.event_delegations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS team_id           uuid REFERENCES public.event_teams(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS school_id         uuid REFERENCES public.schools(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS payment_method    text,
    ADD COLUMN IF NOT EXISTS amount_paid       numeric DEFAULT 0,
    ADD COLUMN IF NOT EXISTS approved_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS approved_at       timestamptz,
    ADD COLUMN IF NOT EXISTS cash_session_id   uuid,
    ADD COLUMN IF NOT EXISTS child_id          uuid REFERENCES public.children(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS referral_source   text;

-- =============================================================================
-- PARTE 2 — Columnas NUEVAS de verdad para la inscripción interna individual.
-- =============================================================================

ALTER TABLE public.event_registrations
    ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.event_categories_config(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS payment_id  uuid REFERENCES public.payments(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.event_registrations.category_id IS
    'Categoría del torneo/liga a la que se inscribió (solo torneos internos de escuela). NULL para el flujo viejo de organizador externo.';
COMMENT ON COLUMN public.event_registrations.payment_id IS
    'Cobro real en public.payments (fuente de verdad del estado de pago) — el torneo interno reusa el cobro escuela→familia, no event_delegation_payments (docs/tournaments-enrollment-flow.md:70).';

-- Backstop: un mismo hijo/atleta no se inscribe dos veces (no canceladas) a la
-- misma categoría del mismo torneo.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_event_registration_activa
    ON public.event_registrations (event_id, category_id, COALESCE(child_id, user_id))
    WHERE status <> 'cancelled' AND category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_registrations_event_category
    ON public.event_registrations (event_id, category_id);

-- =============================================================================
-- PARTE 3 — RLS: el dueño (yo mismo o mi hijo) ve su propia inscripción.
-- No hay policy de INSERT directa a propósito: la escritura va solo por la RPC
-- SECURITY DEFINER de abajo, que valida todo antes de insertar.
-- =============================================================================

DROP POLICY IF EXISTS event_registrations_select_own_child ON public.event_registrations;
CREATE POLICY event_registrations_select_own_child ON public.event_registrations
    FOR SELECT
    USING (
        child_id IN (SELECT id FROM public.children WHERE parent_id = auth.uid())
    );

-- =============================================================================
-- PARTE 4 — notifications.category necesita 'tournament' (mismo patrón que la
-- migración que le agregó 'support').
-- =============================================================================

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_category_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_category_check
    CHECK (category = ANY (ARRAY[
        'payment','installment','glosa','enrollment','access','qr','marketplace',
        'equipment','system','support','tournament'
    ]));

-- =============================================================================
-- PARTE 5 — RPC: inscripción individual a un torneo/liga INTERNA.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.register_for_internal_tournament(
    p_event_id    uuid,
    p_category_id uuid,
    p_child_id    uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_event           record;
    v_category        record;
    v_caller_role     public.user_role;
    v_caller_email    text;
    v_caller_phone    text;
    v_caller_name     text;
    v_participant_name  text;
    v_registration_id   uuid;
    v_payment_id        uuid;
    v_amount             numeric;
BEGIN
    SELECT id, school_id, title, tournament_scope, status, registrations_open
      INTO v_event
      FROM public.events
     WHERE id = p_event_id;

    IF v_event.id IS NULL THEN
        RAISE EXCEPTION 'Torneo no encontrado.';
    END IF;

    IF v_event.tournament_scope <> 'internal' THEN
        RAISE EXCEPTION 'Esta inscripción es solo para torneos/ligas internas de una escuela.';
    END IF;

    IF v_event.status <> 'active' OR v_event.registrations_open IS FALSE THEN
        RAISE EXCEPTION 'Las inscripciones no están abiertas.';
    END IF;

    SELECT id, event_id INTO v_category
      FROM public.event_categories_config
     WHERE id = p_category_id AND event_id = p_event_id AND active = true;

    IF v_category.id IS NULL THEN
        RAISE EXCEPTION 'Categoría no válida para este torneo.';
    END IF;

    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    SELECT LOWER(TRIM(email)) INTO v_caller_email FROM auth.users WHERE id = auth.uid();
    SELECT full_name, phone INTO v_caller_name, v_caller_phone FROM public.profiles WHERE id = auth.uid();

    IF p_child_id IS NOT NULL THEN
        -- Solo puede inscribir a SU PROPIO hijo, matriculado en la MISMA escuela
        -- del torneo (evita inscribir a un hijo de otra escuela por error de UI).
        SELECT full_name INTO v_participant_name
          FROM public.children
         WHERE id = p_child_id AND parent_id = auth.uid() AND school_id = v_event.school_id;

        IF v_participant_name IS NULL THEN
            RAISE EXCEPTION 'Ese atleta no es un hijo tuyo inscrito en esta escuela.';
        END IF;
    ELSE
        IF v_caller_role <> 'athlete' THEN
            RAISE EXCEPTION 'Solo un atleta adulto puede inscribirse a sí mismo (sin indicar un hijo).';
        END IF;
        -- El atleta debe pertenecer a la escuela dueña del torneo.
        IF NOT EXISTS (
            SELECT 1 FROM public.school_members
             WHERE profile_id = auth.uid() AND school_id = v_event.school_id
               AND role = 'athlete' AND status = 'active'
        ) THEN
            RAISE EXCEPTION 'No perteneces a la escuela dueña de este torneo.';
        END IF;
        v_participant_name := v_caller_name;
    END IF;

    -- Idempotencia: si ya existe una inscripción no cancelada, devolverla en vez
    -- de duplicar (el índice único de abajo la respalda a nivel base de datos).
    SELECT id, payment_id INTO v_registration_id, v_payment_id
      FROM public.event_registrations
     WHERE event_id = p_event_id AND category_id = p_category_id
       AND COALESCE(child_id, user_id) = COALESCE(p_child_id, auth.uid())
       AND status <> 'cancelled';

    IF v_registration_id IS NOT NULL THEN
        RETURN v_registration_id;
    END IF;

    -- Monto: la fase (vigente por fecha) manda; si no hay ninguna, precio 0 no
    -- es aceptable — sin fase no se puede cobrar, se corta acá.
    SELECT price_solo INTO v_amount
      FROM public.event_price_phases
     WHERE event_id = p_event_id AND valid_until >= CURRENT_DATE
     ORDER BY valid_until ASC
     LIMIT 1;

    IF v_amount IS NULL THEN
        RAISE EXCEPTION 'No hay una tarifa vigente configurada para este torneo todavía.';
    END IF;

    -- due_date es NOT NULL sin default y fn_payments_fill_period() NO lo
    -- rellena (solo period_year/period_month) — hay que darlo explícito.
    INSERT INTO public.payments (
        school_id, user_id, child_id, amount, status, payment_type, concept, due_date
    ) VALUES (
        v_event.school_id,
        CASE WHEN p_child_id IS NULL THEN auth.uid() ELSE NULL END,
        p_child_id,
        v_amount,
        'pending',
        'one_time',
        'Inscripción torneo — ' || v_event.title || ' — ' || (SELECT category FROM public.event_categories_config WHERE id = p_category_id),
        public.qr_first_charge_due_date(v_event.school_id, CURRENT_DATE)
    ) RETURNING id INTO v_payment_id;

    INSERT INTO public.event_registrations (
        event_id, user_id, child_id, category_id, participant_name,
        participant_email, participant_phone, participant_role,
        status, payment_status, school_id, payment_id
    ) VALUES (
        p_event_id, auth.uid(), p_child_id, p_category_id, v_participant_name,
        v_caller_email, COALESCE(v_caller_phone, ''),
        CASE WHEN p_child_id IS NULL THEN 'athlete' ELSE 'parent' END,
        'pending', 'pending', v_event.school_id, v_payment_id
    ) RETURNING id INTO v_registration_id;

    RETURN v_registration_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_for_internal_tournament(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_for_internal_tournament(uuid, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.register_for_internal_tournament(uuid, uuid, uuid) TO authenticated;

-- =============================================================================
-- PARTE 6 — RPC: la escuela reparte a los inscritos (pagados o no, es su
-- criterio) en equipos de una categoría. Llena event_teams/event_team_members
-- reusando tal cual generate-fixtures/matches/standings (sin cambios ahí).
-- Crea una "delegación anfitriona" (event_id, school_id=la propia escuela) la
-- primera vez que hace falta, solo para satisfacer el FK NOT NULL de
-- event_teams.delegation_id — no participa del cobro (eso vive en `payments`).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.assign_registrants_to_teams(
    p_event_id    uuid,
    p_category_id uuid,
    p_assignments jsonb  -- [{"team_name": "Equipo Rojo", "registration_ids": ["..."]}]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school_id       uuid;
    v_delegation_id   uuid;
    v_team            jsonb;
    v_team_id         uuid;
    v_reg_id          uuid;
    v_reg             record;
    v_created_teams   integer := 0;
    v_assigned        integer := 0;
BEGIN
    IF NOT public.can_manage_event(p_event_id, auth.uid()) THEN
        RAISE EXCEPTION 'No tenés permiso para administrar este torneo.'
            USING ERRCODE = '42501';
    END IF;

    SELECT school_id INTO v_school_id FROM public.events WHERE id = p_event_id;
    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'Este torneo no pertenece a ninguna escuela.';
    END IF;

    -- Delegación anfitriona (idempotente): la escuela "participando de su
    -- propio torneo" solo como ancla técnica para event_teams.delegation_id.
    SELECT id INTO v_delegation_id
      FROM public.event_delegations
     WHERE event_id = p_event_id AND school_id = v_school_id;

    IF v_delegation_id IS NULL THEN
        INSERT INTO public.event_delegations (event_id, school_id, status)
        VALUES (p_event_id, v_school_id, 'confirmed')
        RETURNING id INTO v_delegation_id;
    END IF;

    FOR v_team IN SELECT * FROM jsonb_array_elements(p_assignments)
    LOOP
        SELECT id INTO v_team_id
          FROM public.event_teams
         WHERE delegation_id = v_delegation_id AND event_id = p_event_id
           AND category_id = p_category_id
           AND team_name = (v_team->>'team_name');

        IF v_team_id IS NULL THEN
            INSERT INTO public.event_teams (delegation_id, event_id, category_id, team_name, status)
            VALUES (v_delegation_id, p_event_id, p_category_id, v_team->>'team_name', 'confirmed')
            RETURNING id INTO v_team_id;
            v_created_teams := v_created_teams + 1;
        END IF;

        FOR v_reg_id IN SELECT jsonb_array_elements_text(v_team->'registration_ids')::uuid
        LOOP
            SELECT * INTO v_reg
              FROM public.event_registrations
             WHERE id = v_reg_id AND event_id = p_event_id AND category_id = p_category_id;

            IF v_reg.id IS NULL THEN
                CONTINUE; -- fila de otra categoría/torneo, se ignora en vez de tumbar todo el lote
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM public.event_team_members
                 WHERE team_id = v_team_id
                   AND ((child_id IS NOT NULL AND child_id = v_reg.child_id)
                     OR (child_id IS NULL AND profile_id = v_reg.user_id))
            ) THEN
                INSERT INTO public.event_team_members (
                    team_id, delegation_id, full_name, profile_id, child_id
                ) VALUES (
                    v_team_id, v_delegation_id, v_reg.participant_name,
                    CASE WHEN v_reg.child_id IS NULL THEN v_reg.user_id ELSE NULL END,
                    v_reg.child_id
                );
                v_assigned := v_assigned + 1;
            END IF;

            UPDATE public.event_registrations
               SET team_id = v_team_id, status = 'approved'
             WHERE id = v_reg.id;
        END LOOP;
    END LOOP;

    RETURN jsonb_build_object('teams_created', v_created_teams, 'members_assigned', v_assigned);
END;
$$;

REVOKE ALL ON FUNCTION public.assign_registrants_to_teams(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_registrants_to_teams(uuid, uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.assign_registrants_to_teams(uuid, uuid, jsonb) TO authenticated;

COMMIT;
