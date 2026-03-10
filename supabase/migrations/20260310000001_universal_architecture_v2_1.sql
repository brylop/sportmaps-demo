-- ============================================================
-- SPORTMAPS UNIVERSAL ARCHITECTURE v2.1
-- Migración idempotente: ENUMs, tablas, ALTERs, triggers, RLS
-- ============================================================

-- ============================================================
-- 1. ENUMS NUEVOS
-- ============================================================

DO $$ BEGIN
    CREATE TYPE public.offering_type AS ENUM (
        'membership',
        'session_pack',
        'court_booking',
        'tournament',
        'single_session'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.booking_status AS ENUM (
        'confirmed',
        'cancelled',
        'attended',
        'no_show'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.billing_event_type AS ENUM (
        'charge',
        'partial',
        'refund',
        'late_fee',
        'adjustment'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.categorization_axis AS ENUM (
        'age',
        'weight',
        'belt',
        'level',
        'division',
        'none'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- ============================================================
-- 2. TABLA offerings
-- ============================================================

CREATE TABLE IF NOT EXISTS public.offerings (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    branch_id       uuid REFERENCES public.school_branches(id) ON DELETE SET NULL,
    name            text NOT NULL,
    description     text,
    offering_type   public.offering_type NOT NULL,
    sport           text,
    is_active       boolean NOT NULL DEFAULT true,
    sort_order      integer NOT NULL DEFAULT 0,
    metadata        jsonb NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offerings_school_active
    ON public.offerings(school_id, is_active);
CREATE INDEX IF NOT EXISTS idx_offerings_school_type
    ON public.offerings(school_id, offering_type);

DROP TRIGGER IF EXISTS trg_offerings_updated_at ON public.offerings;
CREATE TRIGGER trg_offerings_updated_at
    BEFORE UPDATE ON public.offerings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 3. TABLA offering_plans
-- ============================================================

CREATE TABLE IF NOT EXISTS public.offering_plans (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    offering_id             uuid NOT NULL REFERENCES public.offerings(id) ON DELETE CASCADE,
    school_id               uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name                    text NOT NULL,
    description             text,
    max_sessions            integer,
    max_secondary_sessions  integer DEFAULT 0,
    duration_days           integer NOT NULL DEFAULT 30,
    auto_renew              boolean NOT NULL DEFAULT false,
    price                   numeric NOT NULL CHECK (price >= 0),
    currency                text NOT NULL DEFAULT 'COP',
    slot_duration_minutes   integer,
    is_active               boolean NOT NULL DEFAULT true,
    sort_order              integer NOT NULL DEFAULT 0,
    metadata                jsonb NOT NULL DEFAULT '{}',
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offering_plans_offering
    ON public.offering_plans(offering_id, is_active);
CREATE INDEX IF NOT EXISTS idx_offering_plans_school
    ON public.offering_plans(school_id);

DROP TRIGGER IF EXISTS trg_offering_plans_updated_at ON public.offering_plans;
CREATE TRIGGER trg_offering_plans_updated_at
    BEFORE UPDATE ON public.offering_plans
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 4. TABLA sport_configs
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sport_configs (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id           uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    sport               text NOT NULL,
    categorization_axis public.categorization_axis NOT NULL DEFAULT 'none',
    rules               jsonb NOT NULL DEFAULT '[]',
    settings            jsonb NOT NULL DEFAULT '{}',
    is_active           boolean NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT sport_configs_school_sport_unique UNIQUE (school_id, sport)
);

CREATE INDEX IF NOT EXISTS idx_sport_configs_school
    ON public.sport_configs(school_id, is_active);

DROP TRIGGER IF EXISTS trg_sport_configs_updated_at ON public.sport_configs;
CREATE TRIGGER trg_sport_configs_updated_at
    BEFORE UPDATE ON public.sport_configs
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 5. MODIFICACIONES A TABLAS EXISTENTES
-- ============================================================

-- 5.1 school_settings: active_modules
ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS active_modules text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.school_settings.active_modules IS
    'Módulos activos: offering_plans, session_bookings, credit_deduction, billing_events, sport_configs, court_booking, tournament_mode';

-- 5.2 attendance_sessions: capacity tracking per session
ALTER TABLE public.attendance_sessions
    ADD COLUMN IF NOT EXISTS requires_capacity_check boolean NOT NULL DEFAULT false;

ALTER TABLE public.attendance_sessions
    ADD COLUMN IF NOT EXISTS max_capacity integer;

ALTER TABLE public.attendance_sessions
    ADD COLUMN IF NOT EXISTS current_bookings integer NOT NULL DEFAULT 0;

-- 5.3 enrollments: offering plan tracking
ALTER TABLE public.enrollments
    ADD COLUMN IF NOT EXISTS offering_plan_id uuid REFERENCES public.offering_plans(id) ON DELETE SET NULL;

ALTER TABLE public.enrollments
    ADD COLUMN IF NOT EXISTS sessions_used integer NOT NULL DEFAULT 0;

ALTER TABLE public.enrollments
    ADD COLUMN IF NOT EXISTS secondary_sessions_used integer NOT NULL DEFAULT 0;

ALTER TABLE public.enrollments
    ADD COLUMN IF NOT EXISTS expires_at date;

CREATE INDEX IF NOT EXISTS idx_enrollments_offering_plan
    ON public.enrollments(offering_plan_id) WHERE offering_plan_id IS NOT NULL;


-- ============================================================
-- 6. TABLA session_bookings (depende de attendance_sessions y enrollments)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.session_bookings (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id           uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    session_id          uuid NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
    enrollment_id       uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
    user_id             uuid REFERENCES auth.users(id),
    child_id            uuid REFERENCES public.children(id),
    status              public.booking_status NOT NULL DEFAULT 'confirmed',
    booking_type        text NOT NULL DEFAULT 'reservation',
    booked_at           timestamptz NOT NULL DEFAULT now(),
    cancelled_at        timestamptz,
    cancelled_reason    text,
    is_secondary        boolean NOT NULL DEFAULT false,
    is_corrected        boolean NOT NULL DEFAULT false,
    corrected_by        uuid REFERENCES auth.users(id),
    corrected_at        timestamptz,
    correction_reason   text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT session_bookings_unique_user
        UNIQUE NULLS NOT DISTINCT (session_id, user_id, child_id),
    CONSTRAINT check_hybrid_booking
        CHECK (
            (user_id IS NOT NULL AND child_id IS NULL)
            OR
            (user_id IS NULL AND child_id IS NOT NULL)
        )
);

CREATE INDEX IF NOT EXISTS idx_session_bookings_session
    ON public.session_bookings(session_id, status);
CREATE INDEX IF NOT EXISTS idx_session_bookings_enrollment
    ON public.session_bookings(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_session_bookings_user
    ON public.session_bookings(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_session_bookings_child
    ON public.session_bookings(child_id) WHERE child_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_session_bookings_school
    ON public.session_bookings(school_id);

DROP TRIGGER IF EXISTS trg_session_bookings_updated_at ON public.session_bookings;
CREATE TRIGGER trg_session_bookings_updated_at
    BEFORE UPDATE ON public.session_bookings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 7. TABLA billing_events
-- ============================================================

CREATE TABLE IF NOT EXISTS public.billing_events (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id           uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    enrollment_id       uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
    offering_plan_id    uuid REFERENCES public.offering_plans(id) ON DELETE SET NULL,
    event_type          public.billing_event_type NOT NULL DEFAULT 'charge',
    amount_due          numeric NOT NULL CHECK (amount_due >= 0),
    amount_paid         numeric NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
    late_fee_amount     numeric NOT NULL DEFAULT 0 CHECK (late_fee_amount >= 0),
    currency            text NOT NULL DEFAULT 'COP',
    due_date            date NOT NULL,
    paid_date           date,
    parent_event_id     uuid REFERENCES public.billing_events(id) ON DELETE SET NULL,
    installment_number  integer,
    payment_id          uuid REFERENCES public.payments(id) ON DELETE SET NULL,
    gateway             text,
    gateway_reference   text,
    status              public.pay_status NOT NULL DEFAULT 'pending',
    notes               text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT billing_events_idempotent
        UNIQUE (enrollment_id, due_date, event_type, installment_number)
);

CREATE INDEX IF NOT EXISTS idx_billing_events_enrollment
    ON public.billing_events(enrollment_id, status);
CREATE INDEX IF NOT EXISTS idx_billing_events_school_due
    ON public.billing_events(school_id, due_date, status);
CREATE INDEX IF NOT EXISTS idx_billing_events_payment
    ON public.billing_events(payment_id) WHERE payment_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_billing_events_updated_at ON public.billing_events;
CREATE TRIGGER trg_billing_events_updated_at
    BEFORE UPDATE ON public.billing_events
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 8. TRIGGERS Y FUNCIONES
-- ============================================================

-- 8.1 Validación de sport_config rules
CREATE OR REPLACE FUNCTION public.fn_validate_sport_config_rules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_rule      jsonb;
    v_idx       integer := 0;
BEGIN
    IF NEW.categorization_axis = 'none' THEN
        IF NEW.rules IS NOT NULL AND jsonb_typeof(NEW.rules) = 'array' AND jsonb_array_length(NEW.rules) > 0 THEN
            RAISE EXCEPTION 'sport_configs: axis "none" no debe tener rules';
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.rules IS NULL OR jsonb_typeof(NEW.rules) != 'array' THEN
        RAISE EXCEPTION 'sport_configs: rules debe ser un JSON array';
    END IF;

    IF jsonb_array_length(NEW.rules) = 0 THEN
        RAISE EXCEPTION 'sport_configs: rules no puede estar vacío cuando axis != none';
    END IF;

    FOR v_rule IN SELECT * FROM jsonb_array_elements(NEW.rules)
    LOOP
        v_idx := v_idx + 1;
        IF NOT (v_rule ? 'name') THEN
            RAISE EXCEPTION 'sport_configs: rules[%] debe tener campo "name"', v_idx;
        END IF;

        CASE NEW.categorization_axis
            WHEN 'age' THEN
                IF NOT (v_rule ? 'min' AND v_rule ? 'max') THEN
                    RAISE EXCEPTION 'sport_configs: rules[%] con axis=age debe tener "min" y "max"', v_idx;
                END IF;
            WHEN 'weight' THEN
                IF NOT (v_rule ? 'min_kg' AND v_rule ? 'max_kg') THEN
                    RAISE EXCEPTION 'sport_configs: rules[%] con axis=weight debe tener "min_kg" y "max_kg"', v_idx;
                END IF;
            WHEN 'belt' THEN
                IF NOT (v_rule ? 'order') THEN
                    RAISE EXCEPTION 'sport_configs: rules[%] con axis=belt debe tener "order"', v_idx;
                END IF;
            WHEN 'level' THEN
                IF NOT (v_rule ? 'min_rating' AND v_rule ? 'max_rating') THEN
                    RAISE EXCEPTION 'sport_configs: rules[%] con axis=level debe tener "min_rating" y "max_rating"', v_idx;
                END IF;
            WHEN 'division' THEN
                NULL; -- Solo requiere name
        END CASE;
    END LOOP;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_sport_config_rules ON public.sport_configs;
CREATE TRIGGER trg_validate_sport_config_rules
    BEFORE INSERT OR UPDATE ON public.sport_configs
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_validate_sport_config_rules();


-- 8.2 Procesamiento de booking (concurrencia + aforo + créditos)
CREATE OR REPLACE FUNCTION public.fn_process_session_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session           record;
    v_enrollment        record;
    v_plan              record;
BEGIN
    -- 1. Lock la sesión para control de concurrencia
    SELECT
        as2.id,
        as2.requires_capacity_check,
        as2.max_capacity,
        as2.current_bookings,
        as2.finalized
    INTO v_session
    FROM public.attendance_sessions as2
    WHERE as2.id = NEW.session_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sesión no encontrada: %', NEW.session_id;
    END IF;

    IF v_session.finalized THEN
        RAISE EXCEPTION 'No se puede reservar en una sesión ya finalizada';
    END IF;

    -- 2. Validar aforo SOLO si la sesión lo requiere
    IF v_session.requires_capacity_check THEN
        IF v_session.max_capacity IS NOT NULL
           AND v_session.current_bookings >= v_session.max_capacity THEN
            RAISE EXCEPTION 'Sesión llena. Aforo máximo: %, Reservas actuales: %',
                v_session.max_capacity, v_session.current_bookings;
        END IF;
    END IF;

    -- 3. Validar créditos del enrollment (lectura sin lock para evitar deadlock)
    SELECT
        e.id,
        e.sessions_used,
        e.secondary_sessions_used,
        e.expires_at,
        e.status,
        e.offering_plan_id
    INTO v_enrollment
    FROM public.enrollments e
    WHERE e.id = NEW.enrollment_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Enrollment no encontrado: %', NEW.enrollment_id;
    END IF;

    IF v_enrollment.status != 'active' THEN
        RAISE EXCEPTION 'El enrollment no está activo';
    END IF;

    IF v_enrollment.expires_at IS NOT NULL AND v_enrollment.expires_at < CURRENT_DATE THEN
        RAISE EXCEPTION 'El plan ha expirado el %', v_enrollment.expires_at;
    END IF;

    -- Verificar créditos si el plan tiene límite
    IF v_enrollment.offering_plan_id IS NOT NULL THEN
        SELECT op.max_sessions, op.max_secondary_sessions
        INTO v_plan
        FROM public.offering_plans op
        WHERE op.id = v_enrollment.offering_plan_id;

        IF FOUND AND v_plan.max_sessions IS NOT NULL THEN
            IF NEW.is_secondary THEN
                IF v_plan.max_secondary_sessions IS NOT NULL
                   AND v_enrollment.secondary_sessions_used >= v_plan.max_secondary_sessions THEN
                    RAISE EXCEPTION 'Sesiones secundarias agotadas. Usadas: %, Máximo: %',
                        v_enrollment.secondary_sessions_used, v_plan.max_secondary_sessions;
                END IF;
            ELSE
                IF v_enrollment.sessions_used >= v_plan.max_sessions THEN
                    RAISE EXCEPTION 'Sesiones agotadas. Usadas: %, Máximo: %',
                        v_enrollment.sessions_used, v_plan.max_sessions;
                END IF;
            END IF;
        END IF;
    END IF;

    -- 4. Incrementar contador de la sesión
    UPDATE public.attendance_sessions
    SET current_bookings = current_bookings + 1
    WHERE id = NEW.session_id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_process_session_booking ON public.session_bookings;
CREATE TRIGGER trg_process_session_booking
    BEFORE INSERT ON public.session_bookings
    FOR EACH ROW
    WHEN (NEW.status = 'confirmed')
    EXECUTE FUNCTION public.fn_process_session_booking();


-- 8.3 Deducción de sesiones al finalizar
CREATE OR REPLACE FUNCTION public.fn_deduct_sessions_on_finalize()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_booking record;
BEGIN
    IF NOT (OLD.finalized = false AND NEW.finalized = true) THEN
        RETURN NEW;
    END IF;

    FOR v_booking IN
        SELECT sb.id, sb.enrollment_id, sb.is_secondary
        FROM public.session_bookings sb
        WHERE sb.session_id = NEW.id
          AND sb.status = 'confirmed'
    LOOP
        UPDATE public.session_bookings
        SET status = 'attended', updated_at = now()
        WHERE id = v_booking.id;

        IF v_booking.is_secondary THEN
            UPDATE public.enrollments
            SET secondary_sessions_used = secondary_sessions_used + 1, updated_at = now()
            WHERE id = v_booking.enrollment_id;
        ELSE
            UPDATE public.enrollments
            SET sessions_used = sessions_used + 1, updated_at = now()
            WHERE id = v_booking.enrollment_id;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deduct_sessions_on_finalize ON public.attendance_sessions;
CREATE TRIGGER trg_deduct_sessions_on_finalize
    AFTER UPDATE ON public.attendance_sessions
    FOR EACH ROW
    WHEN (OLD.finalized = false AND NEW.finalized = true)
    EXECUTE FUNCTION public.fn_deduct_sessions_on_finalize();


-- 8.4 Decrementar bookings al cancelar
CREATE OR REPLACE FUNCTION public.fn_decrement_bookings_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF OLD.status = 'confirmed' AND NEW.status = 'cancelled' THEN
        UPDATE public.attendance_sessions
        SET current_bookings = GREATEST(current_bookings - 1, 0)
        WHERE id = NEW.session_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_decrement_bookings_on_cancel ON public.session_bookings;
CREATE TRIGGER trg_decrement_bookings_on_cancel
    AFTER UPDATE ON public.session_bookings
    FOR EACH ROW
    WHEN (OLD.status = 'confirmed' AND NEW.status = 'cancelled')
    EXECUTE FUNCTION public.fn_decrement_bookings_on_cancel();


-- ============================================================
-- 9. RLS POLICIES
-- ============================================================

-- 9.1 offerings
ALTER TABLE public.offerings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "offerings_select_school_members" ON public.offerings;
CREATE POLICY "offerings_select_school_members"
    ON public.offerings FOR SELECT TO authenticated
    USING (school_id IN (SELECT unnest(public.user_school_ids())));

DROP POLICY IF EXISTS "offerings_insert_admin" ON public.offerings;
CREATE POLICY "offerings_insert_admin"
    ON public.offerings FOR INSERT TO authenticated
    WITH CHECK (public.is_school_admin(school_id));

DROP POLICY IF EXISTS "offerings_update_admin" ON public.offerings;
CREATE POLICY "offerings_update_admin"
    ON public.offerings FOR UPDATE TO authenticated
    USING (public.is_school_admin(school_id))
    WITH CHECK (public.is_school_admin(school_id));

DROP POLICY IF EXISTS "offerings_delete_admin" ON public.offerings;
CREATE POLICY "offerings_delete_admin"
    ON public.offerings FOR DELETE TO authenticated
    USING (public.is_school_admin(school_id));


-- 9.2 offering_plans
ALTER TABLE public.offering_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "offering_plans_select_school_members" ON public.offering_plans;
CREATE POLICY "offering_plans_select_school_members"
    ON public.offering_plans FOR SELECT TO authenticated
    USING (school_id IN (SELECT unnest(public.user_school_ids())));

DROP POLICY IF EXISTS "offering_plans_insert_admin" ON public.offering_plans;
CREATE POLICY "offering_plans_insert_admin"
    ON public.offering_plans FOR INSERT TO authenticated
    WITH CHECK (public.is_school_admin(school_id));

DROP POLICY IF EXISTS "offering_plans_update_admin" ON public.offering_plans;
CREATE POLICY "offering_plans_update_admin"
    ON public.offering_plans FOR UPDATE TO authenticated
    USING (public.is_school_admin(school_id))
    WITH CHECK (public.is_school_admin(school_id));

DROP POLICY IF EXISTS "offering_plans_delete_admin" ON public.offering_plans;
CREATE POLICY "offering_plans_delete_admin"
    ON public.offering_plans FOR DELETE TO authenticated
    USING (public.is_school_admin(school_id));


-- 9.3 sport_configs
ALTER TABLE public.sport_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sport_configs_select_school_members" ON public.sport_configs;
CREATE POLICY "sport_configs_select_school_members"
    ON public.sport_configs FOR SELECT TO authenticated
    USING (school_id IN (SELECT unnest(public.user_school_ids())));

DROP POLICY IF EXISTS "sport_configs_insert_admin" ON public.sport_configs;
CREATE POLICY "sport_configs_insert_admin"
    ON public.sport_configs FOR INSERT TO authenticated
    WITH CHECK (public.is_school_admin(school_id));

DROP POLICY IF EXISTS "sport_configs_update_admin" ON public.sport_configs;
CREATE POLICY "sport_configs_update_admin"
    ON public.sport_configs FOR UPDATE TO authenticated
    USING (public.is_school_admin(school_id))
    WITH CHECK (public.is_school_admin(school_id));

DROP POLICY IF EXISTS "sport_configs_delete_admin" ON public.sport_configs;
CREATE POLICY "sport_configs_delete_admin"
    ON public.sport_configs FOR DELETE TO authenticated
    USING (public.is_school_admin(school_id));


-- 9.4 session_bookings
ALTER TABLE public.session_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "session_bookings_select" ON public.session_bookings;
CREATE POLICY "session_bookings_select"
    ON public.session_bookings FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR child_id IN (SELECT c.id FROM public.children c WHERE c.parent_id = auth.uid())
        OR school_id IN (SELECT unnest(public.user_school_ids()))
    );

DROP POLICY IF EXISTS "session_bookings_insert" ON public.session_bookings;
CREATE POLICY "session_bookings_insert"
    ON public.session_bookings FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        OR child_id IN (SELECT c.id FROM public.children c WHERE c.parent_id = auth.uid())
    );

DROP POLICY IF EXISTS "session_bookings_update" ON public.session_bookings;
CREATE POLICY "session_bookings_update"
    ON public.session_bookings FOR UPDATE TO authenticated
    USING (
        user_id = auth.uid()
        OR child_id IN (SELECT c.id FROM public.children c WHERE c.parent_id = auth.uid())
        OR public.is_school_admin(school_id)
    )
    WITH CHECK (
        user_id = auth.uid()
        OR child_id IN (SELECT c.id FROM public.children c WHERE c.parent_id = auth.uid())
        OR public.is_school_admin(school_id)
    );

DROP POLICY IF EXISTS "session_bookings_delete_none" ON public.session_bookings;
CREATE POLICY "session_bookings_delete_none"
    ON public.session_bookings FOR DELETE TO authenticated
    USING (false);


-- 9.5 billing_events
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "billing_events_select" ON public.billing_events;
CREATE POLICY "billing_events_select"
    ON public.billing_events FOR SELECT TO authenticated
    USING (
        public.is_school_admin(school_id)
        OR enrollment_id IN (
            SELECT e.id FROM public.enrollments e
            WHERE e.user_id = auth.uid()
               OR e.child_id IN (SELECT c.id FROM public.children c WHERE c.parent_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "billing_events_insert_admin" ON public.billing_events;
CREATE POLICY "billing_events_insert_admin"
    ON public.billing_events FOR INSERT TO authenticated
    WITH CHECK (public.is_school_admin(school_id));

DROP POLICY IF EXISTS "billing_events_update_admin" ON public.billing_events;
CREATE POLICY "billing_events_update_admin"
    ON public.billing_events FOR UPDATE TO authenticated
    USING (public.is_school_admin(school_id))
    WITH CHECK (public.is_school_admin(school_id));

DROP POLICY IF EXISTS "billing_events_delete_none" ON public.billing_events;
CREATE POLICY "billing_events_delete_none"
    ON public.billing_events FOR DELETE TO authenticated
    USING (false);
