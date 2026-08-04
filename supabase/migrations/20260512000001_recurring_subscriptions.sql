-- ============================================================
-- SPORTMAPS — Recurring subscriptions (debito automatico padre -> escuela)
--
-- Objetivo: que un padre habilite "pago automatico" de la mensualidad
-- de un atleta. El cron diario corre y cobra todas las subs con
-- next_charge_at <= now() usando la tarjeta guardada (payment_tokens),
-- soportando MercadoPago y Wompi via resolve_payment_provider.
--
-- Diseno:
--   recurring_subscriptions      — una fila por (child, plan, school).
--   recurring_charge_attempts    — log de cada intento (exitoso o fallido).
--
-- Concurrencia segura: claim_due_recurring_subscriptions usa
-- FOR UPDATE SKIP LOCKED para permitir multiples workers sin doble cobro.
--
-- Reintentos: tras fallo, next_charge_at += 24h y failed_attempts++.
-- Al alcanzar max_attempts, la sub queda status='suspended'.
-- ============================================================


-- ============================================================
-- 1. recurring_subscriptions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.recurring_subscriptions (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- A quien le cobramos y para que
    school_id           uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- padre o atleta autosuscrito
    child_id            uuid        REFERENCES public.children(id) ON DELETE SET NULL,     -- null si auto-suscripcion
    program_id          uuid        REFERENCES public.programs(id) ON DELETE SET NULL,
    team_id             uuid        REFERENCES public.teams(id)    ON DELETE SET NULL,

    -- Con que tarjeta
    payment_token_id    uuid        NOT NULL REFERENCES public.payment_tokens(id) ON DELETE RESTRICT,

    -- Cuanto y como
    amount              numeric     NOT NULL CHECK (amount > 0),
    currency            text        NOT NULL DEFAULT 'COP',
    concept             text        NOT NULL DEFAULT 'Mensualidad',
    billing_day         smallint    NOT NULL DEFAULT 1 CHECK (billing_day BETWEEN 1 AND 28),

    -- Cuando va el proximo cobro
    next_charge_at      timestamptz NOT NULL,
    last_charge_at      timestamptz,
    last_payment_id     uuid        REFERENCES public.payments(id) ON DELETE SET NULL,

    -- Estado y reintentos
    status              text        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','paused','cancelled','suspended')),
    failed_attempts     integer     NOT NULL DEFAULT 0,
    max_attempts        integer     NOT NULL DEFAULT 3,
    retry_backoff_hours integer     NOT NULL DEFAULT 24,

    cancelled_at        timestamptz,
    cancelled_reason    text,

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Una sola sub no-cancelada por (school, child). Permite re-suscripcion tras cancelar.
CREATE UNIQUE INDEX IF NOT EXISTS uq_rec_subs_active_per_child
    ON public.recurring_subscriptions(school_id, child_id)
    WHERE status IN ('active','paused','suspended') AND child_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rec_subs_school        ON public.recurring_subscriptions(school_id);
CREATE INDEX IF NOT EXISTS idx_rec_subs_user          ON public.recurring_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_rec_subs_child         ON public.recurring_subscriptions(child_id) WHERE child_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rec_subs_token         ON public.recurring_subscriptions(payment_token_id);
CREATE INDEX IF NOT EXISTS idx_rec_subs_due           ON public.recurring_subscriptions(next_charge_at) WHERE status = 'active';

-- Trigger updated_at
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'set_updated_at') THEN
        EXECUTE 'DROP TRIGGER IF EXISTS trg_rec_subs_updated_at ON public.recurring_subscriptions';
        EXECUTE 'CREATE TRIGGER trg_rec_subs_updated_at BEFORE UPDATE ON public.recurring_subscriptions
                 FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    END IF;
END $$;

ALTER TABLE public.recurring_subscriptions ENABLE ROW LEVEL SECURITY;

-- Padre: ve y maneja las suyas
DROP POLICY IF EXISTS "rec_subs_owner" ON public.recurring_subscriptions;
CREATE POLICY "rec_subs_owner" ON public.recurring_subscriptions
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Staff de escuela: lee las de su escuela (owner/admin/school_admin)
DROP POLICY IF EXISTS "rec_subs_school_staff_select" ON public.recurring_subscriptions;
CREATE POLICY "rec_subs_school_staff_select" ON public.recurring_subscriptions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.school_members sm
            WHERE sm.school_id  = recurring_subscriptions.school_id
              AND sm.profile_id = auth.uid()
              AND sm.role      IN ('owner','admin')
              AND sm.status     = 'active'
        )
    );


-- ============================================================
-- 2. recurring_charge_attempts — log de cada intento
-- ============================================================

CREATE TABLE IF NOT EXISTS public.recurring_charge_attempts (
    id                   uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id      uuid         NOT NULL REFERENCES public.recurring_subscriptions(id) ON DELETE CASCADE,
    attempted_at         timestamptz  NOT NULL DEFAULT now(),

    -- Que se cobro
    amount               numeric      NOT NULL,
    currency             text         NOT NULL DEFAULT 'COP',
    payment_provider     public.payment_provider NOT NULL,

    -- Resultado
    status               text         NOT NULL CHECK (status IN ('success','failed','retry_scheduled')),
    provider_payment_id  text,
    error_code           text,
    error_message        text,

    -- Trazabilidad
    payment_id           uuid         REFERENCES public.payments(id) ON DELETE SET NULL,
    idempotency_key      text         UNIQUE,
    raw_response         jsonb,

    created_at           timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rec_attempts_sub      ON public.recurring_charge_attempts(subscription_id);
CREATE INDEX IF NOT EXISTS idx_rec_attempts_status   ON public.recurring_charge_attempts(status);
CREATE INDEX IF NOT EXISTS idx_rec_attempts_when     ON public.recurring_charge_attempts(attempted_at DESC);

ALTER TABLE public.recurring_charge_attempts ENABLE ROW LEVEL SECURITY;

-- Solo el duenio de la sub puede leer sus intentos. service_role bypassea RLS.
DROP POLICY IF EXISTS "rec_attempts_owner_select" ON public.recurring_charge_attempts;
CREATE POLICY "rec_attempts_owner_select" ON public.recurring_charge_attempts
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.recurring_subscriptions s
            WHERE s.id = recurring_charge_attempts.subscription_id
              AND (
                   s.user_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.school_members sm
                    WHERE sm.school_id  = s.school_id
                      AND sm.profile_id = auth.uid()
                      AND sm.role      IN ('owner','admin')
                      AND sm.status     = 'active'
                )
              )
        )
    );


-- ============================================================
-- 3. RPC create_recurring_subscription — padre se suscribe
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_recurring_subscription(
    p_school_id        uuid,
    p_child_id         uuid,
    p_payment_token_id uuid,
    p_amount           numeric,
    p_billing_day      smallint DEFAULT 1,
    p_concept          text     DEFAULT 'Mensualidad',
    p_program_id       uuid     DEFAULT NULL,
    p_team_id          uuid     DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id     uuid := auth.uid();
    v_token_owner uuid;
    v_sub_id      uuid;
    v_next        timestamptz;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'auth_required');
    END IF;

    -- El token tiene que pertenecer al mismo user que crea la sub.
    SELECT user_id INTO v_token_owner
      FROM public.payment_tokens
     WHERE id = p_payment_token_id;

    IF v_token_owner IS NULL OR v_token_owner <> v_user_id THEN
        RETURN jsonb_build_object('ok', false, 'error', 'token_not_owned');
    END IF;

    -- Si hay child, debe ser hijo del padre.
    IF p_child_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.children c
            WHERE c.id = p_child_id AND c.parent_id = v_user_id
        ) THEN
            RETURN jsonb_build_object('ok', false, 'error', 'child_not_owned');
        END IF;
    END IF;

    -- Calcular siguiente cobro: el dia billing_day del MES SIGUIENTE.
    -- Asi le damos al padre un mes "gratis" desde la suscripcion.
    v_next := date_trunc('month', now()) + interval '1 month'
            + ((p_billing_day - 1) || ' days')::interval;

    INSERT INTO public.recurring_subscriptions (
        school_id, user_id, child_id, program_id, team_id,
        payment_token_id, amount, concept, billing_day, next_charge_at
    ) VALUES (
        p_school_id, v_user_id, p_child_id, p_program_id, p_team_id,
        p_payment_token_id, p_amount, COALESCE(p_concept, 'Mensualidad'),
        COALESCE(p_billing_day, 1), v_next
    )
    RETURNING id INTO v_sub_id;

    RETURN jsonb_build_object('ok', true, 'subscription_id', v_sub_id, 'next_charge_at', v_next);
EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_subscribed');
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_recurring_subscription(uuid, uuid, uuid, numeric, smallint, text, uuid, uuid)
    TO authenticated;


-- ============================================================
-- 4. RPC pause / resume / cancel
-- ============================================================

CREATE OR REPLACE FUNCTION public.pause_recurring_subscription(p_sub_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
    IF v_user IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'auth_required');
    END IF;
    UPDATE public.recurring_subscriptions
       SET status = 'paused', updated_at = now()
     WHERE id = p_sub_id AND user_id = v_user AND status = 'active';
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'not_found_or_not_active');
    END IF;
    RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.pause_recurring_subscription(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.resume_recurring_subscription(p_sub_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
    IF v_user IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'auth_required');
    END IF;
    UPDATE public.recurring_subscriptions
       SET status = 'active', failed_attempts = 0, updated_at = now()
     WHERE id = p_sub_id AND user_id = v_user AND status IN ('paused','suspended');
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'not_found_or_not_pausable');
    END IF;
    RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.resume_recurring_subscription(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_recurring_subscription(p_sub_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
    IF v_user IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'auth_required');
    END IF;
    UPDATE public.recurring_subscriptions
       SET status = 'cancelled',
           cancelled_at = now(),
           cancelled_reason = p_reason,
           updated_at = now()
     WHERE id = p_sub_id AND user_id = v_user AND status <> 'cancelled';
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'not_found');
    END IF;
    RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.cancel_recurring_subscription(uuid, text) TO authenticated;


-- ============================================================
-- 5. RPC claim_due_recurring_subscriptions — usado por el runner
--
-- Toma hasta N subs vencidas y devuelve todo lo que el runner necesita
-- para cobrar (token + provider + monto + email). Usa SKIP LOCKED para
-- correr en paralelo sin doble cobro. No avanza next_charge_at hasta
-- que el runner llame record_recurring_attempt — eso garantiza que si
-- el worker se cae a mitad, la sub vuelve a estar elegible.
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_due_recurring_subscriptions(p_limit integer DEFAULT 50)
RETURNS TABLE (
    subscription_id     uuid,
    school_id           uuid,
    user_id             uuid,
    child_id            uuid,
    amount              numeric,
    currency            text,
    concept             text,
    payment_token_id    uuid,
    payment_provider    public.payment_provider,
    provider_token      text,
    provider_customer_id text,
    provider_card_id    text,
    user_email          text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH due AS (
        SELECT s.id
          FROM public.recurring_subscriptions s
         WHERE s.status = 'active'
           AND s.next_charge_at <= now()
         ORDER BY s.next_charge_at
         FOR UPDATE SKIP LOCKED
         LIMIT GREATEST(p_limit, 1)
    )
    SELECT
        s.id,
        s.school_id,
        s.user_id,
        s.child_id,
        s.amount,
        s.currency,
        s.concept,
        s.payment_token_id,
        t.payment_provider,
        t.provider_token,
        t.provider_customer_id,
        t.provider_card_id,
        u.email
      FROM due
      JOIN public.recurring_subscriptions s ON s.id = due.id
      JOIN public.payment_tokens t          ON t.id = s.payment_token_id
      JOIN auth.users u                     ON u.id = s.user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_recurring_subscriptions(integer) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.claim_due_recurring_subscriptions(integer) TO service_role;


-- ============================================================
-- 6. RPC record_recurring_attempt — el runner llama esto despues del intento
-- ============================================================

CREATE OR REPLACE FUNCTION public.record_recurring_attempt(
    p_subscription_id    uuid,
    p_status             text,                              -- 'success' | 'failed'
    p_amount             numeric,
    p_payment_provider   public.payment_provider,
    p_provider_payment_id text DEFAULT NULL,
    p_error_code         text DEFAULT NULL,
    p_error_message      text DEFAULT NULL,
    p_idempotency_key    text DEFAULT NULL,
    p_raw_response       jsonb DEFAULT NULL,
    p_payment_id         uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sub   RECORD;
    v_new_next       timestamptz;
    v_new_status     text;
    v_new_failed     integer;
BEGIN
    SELECT * INTO v_sub FROM public.recurring_subscriptions WHERE id = p_subscription_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'subscription_not_found');
    END IF;

    -- Registrar el intento (idempotente por idempotency_key)
    INSERT INTO public.recurring_charge_attempts (
        subscription_id, amount, currency, payment_provider, status,
        provider_payment_id, error_code, error_message,
        idempotency_key, raw_response, payment_id
    ) VALUES (
        p_subscription_id, p_amount, v_sub.currency, p_payment_provider,
        CASE WHEN p_status = 'success' THEN 'success' ELSE 'failed' END,
        p_provider_payment_id, p_error_code, p_error_message,
        p_idempotency_key, p_raw_response, p_payment_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    IF p_status = 'success' THEN
        -- Avanzar al siguiente mes
        v_new_next := (
            date_trunc('month', v_sub.next_charge_at) + interval '1 month'
            + ((v_sub.billing_day - 1) || ' days')::interval
        );
        UPDATE public.recurring_subscriptions
           SET next_charge_at  = v_new_next,
               last_charge_at  = now(),
               last_payment_id = p_payment_id,
               failed_attempts = 0,
               updated_at      = now()
         WHERE id = p_subscription_id;
    ELSE
        -- Fallo: ¿retry o suspend?
        v_new_failed := v_sub.failed_attempts + 1;
        IF v_new_failed >= v_sub.max_attempts THEN
            v_new_status := 'suspended';
            v_new_next   := v_sub.next_charge_at;          -- no avanzar
        ELSE
            v_new_status := 'active';
            v_new_next   := now() + (v_sub.retry_backoff_hours || ' hours')::interval;
        END IF;
        UPDATE public.recurring_subscriptions
           SET status          = v_new_status,
               next_charge_at  = v_new_next,
               failed_attempts = v_new_failed,
               updated_at      = now()
         WHERE id = p_subscription_id;
    END IF;

    RETURN jsonb_build_object('ok', true, 'next_charge_at', v_new_next, 'status', COALESCE(v_new_status, v_sub.status));
END;
$$;

REVOKE ALL ON FUNCTION public.record_recurring_attempt(uuid, text, numeric, public.payment_provider, text, text, text, text, jsonb, uuid)
    FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.record_recurring_attempt(uuid, text, numeric, public.payment_provider, text, text, text, text, jsonb, uuid)
    TO service_role;


-- ============================================================
-- 7. Comentarios
-- ============================================================

COMMENT ON TABLE public.recurring_subscriptions IS
    'Debito automatico de mensualidades padre->escuela. Cobrado por cron diario via Edge Function run-recurring-charges.';
COMMENT ON TABLE public.recurring_charge_attempts IS
    'Log de cada intento de cobro recurrente. Auditoria + base de dunning. idempotency_key previene cobros duplicados.';
COMMENT ON COLUMN public.recurring_subscriptions.next_charge_at IS
    'Cuando es elegible para cobrar. Avanza +1 mes en exito, +retry_backoff_hours en fallo.';
COMMENT ON COLUMN public.recurring_subscriptions.status IS
    'active = corre por el cron. paused = padre pauso. suspended = max_attempts agotados. cancelled = no se reactiva.';
