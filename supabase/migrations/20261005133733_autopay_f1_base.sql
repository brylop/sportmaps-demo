-- =============================================================================
-- 20261005133733_autopay_f1_base.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-05   Versión anterior: 20261005112635
-- Objetivo: F1 del débito automático (docs/specs/debito-automatico.md §4-§6, §5.1).
--   Base de datos del débito: el acudiente (o el atleta adulto) autoriza una vez un
--   medio de pago y cada mes se debita LA MENSUALIDAD que ya generó open_month.
--   Nunca crea un cobro ni guarda un monto propio (D2): cada `payments` de
--   mensualidad pendiente tiene su propio ciclo, así que un cambio de plan (cobro
--   cancelado y vuelto a generar, o monto que cambia) cae solo en la regla del ciclo:
--   monto mayor al anunciado → se re-avisa y se esperan 2 días (D6, D9).
--
--   Decisiones confirmadas el 2026-10-05: D7 = una suscripción por atleta y escuela
--   que cubre su(s) mensualidad(es); F1 arranca por tarjeta (el esquema es el mismo
--   para Nequi/Bancolombia).
--
--   Diferencias con el spec (decididas al escribir):
--     · Las retenciones transitorias del claim (checkout manual abierto, débitos
--       pausados, interruptor global) NO cambian `state`: se anotan en
--       `hold_reason`/`hold_at` y el ciclo sigue `noticed`. Así nunca hay que
--       "volver" de skipped a noticed (§4.3).
--     · payment_tokens.status es NULL en las filas legacy (MP / captura vieja de
--       Wompi): el débito solo usa status='available', y los caminos viejos siguen
--       insertando sin tocar las columnas nuevas.
--     · La baja se detecta con un trigger DIFERIDO sobre enrollments (al COMMIT):
--       un cambio de plan que cancela una inscripción y crea otra en la misma
--       transacción NO cancela el débito.
--     · El cron (pg_cron → BFF) y los secretos de vault van en F2, junto con los
--       endpoints que llaman; en F1 no hay nada que despertar.
--   Toda escritura es por RPC SECURITY DEFINER solo para service_role (el BFF);
--   reciben p_user_id/p_actor_id porque con service_role auth.uid() es NULL (B1).
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

-- ════════════════════════════════════════════════════════════════════════════
-- 1. payment_tokens (§4.1)
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.payment_tokens
  ADD COLUMN IF NOT EXISTS status               text,
  ADD COLUMN IF NOT EXISTS provider_token_id    text,
  ADD COLUMN IF NOT EXISTS provider_merchant_id text,
  ADD COLUMN IF NOT EXISTS school_id            uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS display_label        text,
  ADD COLUMN IF NOT EXISTS phone_hmac           text,
  ADD COLUMN IF NOT EXISTS authorized_at        timestamptz,
  ADD COLUMN IF NOT EXISTS voided_at            timestamptz;

ALTER TABLE public.payment_tokens
  -- Solo filas del débito (status no nulo): la captura de Mercado Pago guarda
  -- payment_method_id ('visa', 'master'…) y no se toca.
  ADD CONSTRAINT payment_tokens_method_type_check
    CHECK (status IS NULL OR payment_method_type IN ('CARD', 'NEQUI', 'BANCOLOMBIA_TRANSFER', 'DAVIPLATA')),
  ADD CONSTRAINT payment_tokens_status_check
    CHECK (status IS NULL OR status IN ('pending_authorization', 'available', 'declined', 'voided', 'error')),
  -- D11: una fuente usable sabe de qué comercio y de qué escuela es.
  ADD CONSTRAINT payment_tokens_available_complete
    CHECK (status IS DISTINCT FROM 'available'
           OR (provider_payment_source_id IS NOT NULL AND provider_merchant_id IS NOT NULL AND school_id IS NOT NULL));

-- Las filas que existen (2 tarjetas sin fuente de pago, inservibles) quedan anuladas.
UPDATE public.payment_tokens
   SET status = 'voided', voided_at = now(), is_active = false,
       payment_method_type = upper(payment_method_type)
 WHERE status IS NULL AND provider_payment_source_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_tokens_available_source
  ON public.payment_tokens (user_id, school_id, provider_payment_source_id)
  WHERE status = 'available';

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Configuración (§4.7)
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS autopay_enabled          boolean  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS autopay_debits_paused    boolean  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS autopay_surcharge_mode   text     NOT NULL DEFAULT 'same_as_online',
  ADD COLUMN IF NOT EXISTS autopay_days_before_due  smallint NOT NULL DEFAULT 3;

ALTER TABLE public.school_settings
  ADD CONSTRAINT school_settings_autopay_surcharge_mode_check
    CHECK (autopay_surcharge_mode IN ('same_as_online', 'none')),
  ADD CONSTRAINT school_settings_autopay_days_before_due_check
    CHECK (autopay_days_before_due BETWEEN 0 AND 10);

INSERT INTO public.platform_config (key, value, description) VALUES
  ('autopay_kill_switch', '{"debits_enabled": true}'::jsonb,
   'Débito automático: false frena TODOS los débitos de la plataforma sin deploy (D10).'),
  ('autopay_heartbeat', '{}'::jsonb,
   'Débito automático: última corrida de cada cron (la escribe el BFF).')
ON CONFLICT (key) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Tablas nuevas (§4.2-§4.5)
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE public.recurring_subscriptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id             uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  payer_user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  child_id              uuid REFERENCES public.children(id) ON DELETE CASCADE,
  athlete_user_id       uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  payment_token_id      uuid NOT NULL REFERENCES public.payment_tokens(id) ON DELETE CASCADE,
  consent_id            uuid NOT NULL REFERENCES public.payment_consents(id) ON DELETE CASCADE,
  max_amount            numeric(12,2) NOT NULL CHECK (max_amount > 0),
  first_period_year     smallint NOT NULL CHECK (first_period_year BETWEEN 2020 AND 2100),
  first_period_month    smallint NOT NULL CHECK (first_period_month BETWEEN 1 AND 12),
  status                text NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'suspended', 'cancelled')),
  cycles_without_debit  smallint NOT NULL DEFAULT 0,
  suspend_reason        text CHECK (suspend_reason IN ('provider_declined', 'over_max_amount', 'token_not_available', 'duplicate_charge')),
  cancel_reason         text CHECK (cancel_reason IN ('parent', 'school', 'athlete_inactive', 'no_active_enrollment', 'token_voided', 'account_deleted', 'merchant_changed')),
  cancelled_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  suspended_at          timestamptz,
  cancelled_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recurring_subscriptions_athlete_xor CHECK ((child_id IS NULL) <> (athlete_user_id IS NULL)),
  CONSTRAINT recurring_subscriptions_cancel_coherent CHECK ((status = 'cancelled') = (cancel_reason IS NOT NULL)),
  CONSTRAINT recurring_subscriptions_suspend_coherent CHECK (status <> 'suspended' OR suspend_reason IS NOT NULL)
);

CREATE UNIQUE INDEX uq_recurring_subscriptions_live_athlete
  ON public.recurring_subscriptions (school_id, coalesce(child_id, athlete_user_id))
  WHERE status IN ('active', 'suspended');
CREATE INDEX idx_recurring_subscriptions_payer ON public.recurring_subscriptions (payer_user_id);
CREATE INDEX idx_recurring_subscriptions_token ON public.recurring_subscriptions (payment_token_id);

CREATE TABLE public.autopay_cycles (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id        uuid NOT NULL UNIQUE REFERENCES public.payments(id) ON DELETE CASCADE,
  subscription_id   uuid NOT NULL REFERENCES public.recurring_subscriptions(id) ON DELETE CASCADE,
  school_id         uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  announced_total   numeric(12,2),
  notice_sent_at    timestamptz,
  first_attempt_on  date,
  next_attempt_on   date,
  attempts_used     smallint NOT NULL DEFAULT 0 CHECK (attempts_used BETWEEN 0 AND 3),
  state             text NOT NULL DEFAULT 'scheduled'
                      CHECK (state IN ('scheduled', 'noticed', 'in_progress', 'paid', 'skipped', 'exhausted', 'cancelled')),
  skip_reason       text CHECK (skip_reason IN ('parent_skip', 'paid_elsewhere', 'over_max_amount', 'token_not_available', 'merchant_mismatch')),
  skipped_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  hold_reason       text CHECK (hold_reason IN ('manual_checkout_open', 'debits_paused', 'kill_switch')),
  hold_at           timestamptz,
  renotice_count    smallint NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT autopay_cycles_skip_coherent CHECK ((state = 'skipped') = (skip_reason IS NOT NULL)),
  CONSTRAINT autopay_cycles_noticed_has_notice CHECK (state NOT IN ('noticed', 'in_progress') OR (notice_sent_at IS NOT NULL AND announced_total IS NOT NULL))
);

CREATE INDEX idx_autopay_cycles_subscription ON public.autopay_cycles (subscription_id);
CREATE INDEX idx_autopay_cycles_due ON public.autopay_cycles (next_attempt_on) WHERE state = 'noticed';

CREATE TABLE public.recurring_charge_attempts (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id                 uuid NOT NULL REFERENCES public.autopay_cycles(id) ON DELETE CASCADE,
  payment_id               uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  payment_link_id          uuid REFERENCES public.payment_links(id) ON DELETE SET NULL,
  attempt_no               smallint NOT NULL CHECK (attempt_no BETWEEN 1 AND 3),
  status                   text NOT NULL DEFAULT 'processing'
                             CHECK (status IN ('processing', 'pending_provider', 'approved', 'declined', 'error')),
  amount                   numeric(12,2) NOT NULL CHECK (amount > 0),
  provider_reference       text,
  provider_transaction_id  text,
  error_code               text,
  lease_until              timestamptz,
  next_check_at            timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_recurring_charge_attempts_cycle_no UNIQUE (cycle_id, attempt_no)
);

-- Un solo intento vivo por cobro (prueba 1).
CREATE UNIQUE INDEX uq_recurring_charge_attempts_live_payment
  ON public.recurring_charge_attempts (payment_id)
  WHERE status IN ('processing', 'pending_provider');
CREATE INDEX idx_recurring_charge_attempts_sweep
  ON public.recurring_charge_attempts (next_check_at)
  WHERE status IN ('processing', 'pending_provider');

CREATE TABLE public.autopay_incidents (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind                     text NOT NULL CHECK (kind IN ('duplicate_charge', 'cron_missed', 'stale_lease', 'stale_pending', 'merchant_mismatch')),
  school_id                uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  payment_id               uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  subscription_id          uuid REFERENCES public.recurring_subscriptions(id) ON DELETE SET NULL,
  provider_transaction_id  text,
  amount                   numeric(12,2),
  state                    text NOT NULL DEFAULT 'open'
                             CHECK (state IN ('open', 'refund_requested', 'refunded', 'credited', 'dismissed')),
  resolution_note          text,
  resolved_by              uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at              timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_autopay_incidents_school ON public.autopay_incidents (school_id, created_at DESC);
-- Un cobro doble se registra una sola vez por transacción sobrante.
CREATE UNIQUE INDEX uq_autopay_incidents_duplicate_tx
  ON public.autopay_incidents (provider_transaction_id)
  WHERE kind = 'duplicate_charge' AND provider_transaction_id IS NOT NULL;

-- payment_links (§4.6)
ALTER TABLE public.payment_links
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'checkout',
  ADD COLUMN IF NOT EXISTS recurring_attempt_id uuid REFERENCES public.recurring_charge_attempts(id) ON DELETE SET NULL;
ALTER TABLE public.payment_links
  ADD CONSTRAINT payment_links_origin_check CHECK (origin IN ('checkout', 'autopay'));

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Helpers internos (sin EXECUTE para nadie fuera del dueño)
-- ════════════════════════════════════════════════════════════════════════════

-- Escuelas que administra p_user. Mismo criterio que user_admin_school_ids(), pero
-- evaluado para un actor explícito (el BFF llama con service_role → auth.uid() NULL).
CREATE FUNCTION public.autopay_admin_school_ids_for(p_user uuid)
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT COALESCE(ARRAY(
    SELECT sm.school_id FROM public.school_members sm
     WHERE sm.profile_id = p_user AND sm.status = 'active'
       AND sm.role IN ('owner', 'admin', 'school_admin', 'super_admin')
    UNION
    SELECT s.id FROM public.schools s WHERE s.owner_id = p_user
  ), '{}'::uuid[]);
$$;

-- Total a debitar de un cobro: base + recargo según la escuela (D2, D3). Misma
-- cuenta que create-session: round(base * online_fee_pct / 100), default 3 %.
CREATE FUNCTION public.autopay_payment_total(p_payment_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT p.amount
       + CASE WHEN COALESCE(ss.autopay_surcharge_mode, 'same_as_online') = 'same_as_online'
              THEN round(p.amount * COALESCE(ss.online_fee_pct, 3) / 100)
              ELSE 0 END
    FROM public.payments p
    LEFT JOIN public.school_settings ss ON ss.school_id = p.school_id
   WHERE p.id = p_payment_id;
$$;

-- ¿El cobro es del atleta de la suscripción? Menor por child_id; adulto por
-- user_id (o el parent_id legacy sin child_id, como set_school_athlete_status).
CREATE FUNCTION public.autopay_payment_matches(p_sub public.recurring_subscriptions, p_pay public.payments)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT p_pay.school_id = p_sub.school_id
     AND CASE WHEN p_sub.child_id IS NOT NULL THEN p_pay.child_id = p_sub.child_id
              ELSE p_pay.child_id IS NULL AND p_pay.unregistered_athlete_id IS NULL
                   AND (p_pay.user_id = p_sub.athlete_user_id OR (p_pay.user_id IS NULL AND p_pay.parent_id = p_sub.athlete_user_id))
         END;
$$;

-- Ciclo que termina SIN débito (D12): suma al contador y suspende al segundo.
CREATE FUNCTION public.autopay_count_cycle_without_debit(p_subscription_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  UPDATE public.recurring_subscriptions
     SET cycles_without_debit = cycles_without_debit + 1,
         status         = CASE WHEN cycles_without_debit + 1 >= 2 AND status = 'active' THEN 'suspended' ELSE status END,
         suspend_reason = CASE WHEN cycles_without_debit + 1 >= 2 AND status = 'active' THEN p_reason ELSE suspend_reason END,
         suspended_at   = CASE WHEN cycles_without_debit + 1 >= 2 AND status = 'active' THEN now() ELSE suspended_at END,
         updated_at     = now()
   WHERE id = p_subscription_id;
END;
$$;

-- Ciclo pagado por cualquier vía: reinicia el contador (D12).
CREATE FUNCTION public.autopay_reset_cycles_without_debit(p_subscription_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  UPDATE public.recurring_subscriptions
     SET cycles_without_debit = 0, updated_at = now()
   WHERE id = p_subscription_id AND cycles_without_debit <> 0;
$$;

-- Cancela una suscripción y sus ciclos abiertos. Un ciclo `in_progress` no se toca:
-- tiene un intento en vuelo y termina por finish_attempt.
CREATE FUNCTION public.autopay_cancel_internal(p_subscription_id uuid, p_reason text, p_actor uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  UPDATE public.recurring_subscriptions
     SET status = 'cancelled', cancel_reason = p_reason, cancelled_by = p_actor,
         cancelled_at = now(), updated_at = now()
   WHERE id = p_subscription_id AND status <> 'cancelled';

  UPDATE public.autopay_cycles
     SET state = 'cancelled', hold_reason = NULL, hold_at = NULL, updated_at = now()
   WHERE subscription_id = p_subscription_id AND state IN ('scheduled', 'noticed');
END;
$$;

REVOKE ALL ON FUNCTION public.autopay_admin_school_ids_for(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.autopay_payment_total(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.autopay_payment_matches(public.recurring_subscriptions, public.payments) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.autopay_count_cycle_without_debit(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.autopay_reset_cycles_without_debit(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.autopay_cancel_internal(uuid, text, uuid) FROM PUBLIC, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. RPCs del BFF (§5) — solo service_role
-- ════════════════════════════════════════════════════════════════════════════

-- 5.1 Medio de pago. El dueño es siempre p_user_id: una fuente ya registrada por
-- otro usuario no se reasigna (B12).
CREATE FUNCTION public.autopay_register_token(
  p_user_id                     uuid,
  p_school_id                   uuid,
  p_payment_method_type         text,
  p_status                      text,
  p_provider_payment_source_id  bigint DEFAULT NULL,
  p_provider_token_id           text   DEFAULT NULL,
  p_provider_merchant_id        text   DEFAULT NULL,
  p_display_label               text   DEFAULT NULL,
  p_last_four                   text   DEFAULT NULL,
  p_brand                       text   DEFAULT NULL,
  p_phone_hmac                  text   DEFAULT NULL,
  p_expires_at                  date   DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_id    uuid;
  v_owner uuid;
BEGIN
  IF p_user_id IS NULL OR p_school_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_owner');
  END IF;
  IF p_status NOT IN ('pending_authorization', 'available') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  IF p_provider_payment_source_id IS NOT NULL THEN
    SELECT id, user_id INTO v_id, v_owner FROM public.payment_tokens
     WHERE payment_provider = 'wompi' AND provider_payment_source_id = p_provider_payment_source_id
     FOR UPDATE;
  ELSIF p_provider_token_id IS NOT NULL THEN
    SELECT id, user_id INTO v_id, v_owner FROM public.payment_tokens
     WHERE payment_provider = 'wompi' AND provider_token_id = p_provider_token_id
     FOR UPDATE;
  END IF;

  IF v_id IS NOT NULL AND v_owner <> p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_owned_by_other');
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.payment_tokens (
      user_id, school_id, payment_provider, payment_method_type, status,
      provider_payment_source_id, provider_token_id, provider_merchant_id,
      display_label, last_four, brand, phone_hmac, expires_at,
      is_active, authorized_at
    ) VALUES (
      p_user_id, p_school_id, 'wompi', upper(p_payment_method_type), p_status,
      p_provider_payment_source_id, p_provider_token_id, p_provider_merchant_id,
      p_display_label, p_last_four, p_brand, p_phone_hmac, p_expires_at,
      true, CASE WHEN p_status = 'available' THEN now() END
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.payment_tokens
       SET school_id                  = p_school_id,
           payment_method_type        = upper(p_payment_method_type),
           status                     = p_status,
           provider_payment_source_id = COALESCE(p_provider_payment_source_id, provider_payment_source_id),
           provider_token_id          = COALESCE(p_provider_token_id, provider_token_id),
           provider_merchant_id       = COALESCE(p_provider_merchant_id, provider_merchant_id),
           display_label              = COALESCE(p_display_label, display_label),
           last_four                  = COALESCE(p_last_four, last_four),
           brand                      = COALESCE(p_brand, brand),
           phone_hmac                 = COALESCE(p_phone_hmac, phone_hmac),
           expires_at                 = COALESCE(p_expires_at, expires_at),
           is_active                  = true,
           authorized_at              = CASE WHEN p_status = 'available' THEN COALESCE(authorized_at, now()) ELSE authorized_at END,
           voided_at                  = NULL,
           updated_at                 = now()
     WHERE id = v_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'token_id', v_id);
END;
$$;

-- 5.2 Transiciones del medio. Al anularse cancela las suscripciones que lo usan.
CREATE FUNCTION public.autopay_mark_token(
  p_token_id                    uuid,
  p_status                      text,
  p_provider_payment_source_id  bigint DEFAULT NULL,
  p_provider_merchant_id        text   DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_cur text;
  r     record;
BEGIN
  SELECT status INTO v_cur FROM public.payment_tokens WHERE id = p_token_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'token_not_found'); END IF;
  IF v_cur = p_status THEN RETURN jsonb_build_object('ok', true, 'unchanged', true); END IF;

  IF NOT (
       (v_cur = 'pending_authorization' AND p_status IN ('available', 'declined', 'error', 'voided'))
    OR (v_cur = 'available'             AND p_status IN ('voided', 'error'))
    OR (v_cur IN ('declined', 'error')  AND p_status = 'voided')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_transition', 'from', v_cur, 'to', p_status);
  END IF;

  UPDATE public.payment_tokens
     SET status                     = p_status,
         provider_payment_source_id = COALESCE(p_provider_payment_source_id, provider_payment_source_id),
         provider_merchant_id       = COALESCE(p_provider_merchant_id, provider_merchant_id),
         authorized_at              = CASE WHEN p_status = 'available' THEN now() ELSE authorized_at END,
         voided_at                  = CASE WHEN p_status = 'voided' THEN now() ELSE voided_at END,
         is_active                  = p_status IN ('available', 'pending_authorization'),
         updated_at                 = now()
   WHERE id = p_token_id;

  IF p_status IN ('voided', 'error') THEN
    FOR r IN SELECT id FROM public.recurring_subscriptions
              WHERE payment_token_id = p_token_id AND status <> 'cancelled' LOOP
      PERFORM public.autopay_cancel_internal(r.id, 'token_voided', NULL);
    END LOOP;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 5.3 Alta (D5, D7, D14).
CREATE FUNCTION public.autopay_create_subscription(
  p_user_id                 uuid,
  p_school_id               uuid,
  p_child_id                uuid,
  p_athlete_user_id         uuid,
  p_token_id                uuid,
  p_max_amount              numeric,
  p_consent_id              uuid,
  p_include_current_period  boolean DEFAULT false,
  p_today                   date    DEFAULT (now() AT TIME ZONE 'America/Bogota')::date
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_tok      public.payment_tokens;
  v_last     public.payments;
  v_year     int;
  v_month    int;
  v_total    numeric;
  v_sub_id   uuid;
BEGIN
  IF (p_child_id IS NULL) = (p_athlete_user_id IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'athlete_required');
  END IF;

  IF NOT COALESCE((SELECT autopay_enabled FROM public.school_settings WHERE school_id = p_school_id), false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'autopay_not_offered');
  END IF;

  -- Quién puede: el acudiente del menor, o el atleta adulto sobre sí mismo.
  IF p_child_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.children c WHERE c.id = p_child_id AND c.parent_id = p_user_id) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_guardian');
    END IF;
  ELSIF p_athlete_user_id <> p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_guardian');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.enrollments e
     WHERE e.school_id = p_school_id AND e.status = 'active'
       AND ((p_child_id IS NOT NULL AND e.child_id = p_child_id)
         OR (p_athlete_user_id IS NOT NULL AND e.user_id = p_athlete_user_id))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_active_enrollment');
  END IF;

  SELECT * INTO v_tok FROM public.payment_tokens WHERE id = p_token_id;
  IF NOT FOUND OR v_tok.user_id <> p_user_id OR v_tok.school_id IS DISTINCT FROM p_school_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_not_owned');
  END IF;
  IF v_tok.status IS DISTINCT FROM 'available' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_not_available');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.payment_consents pc WHERE pc.id = p_consent_id AND pc.user_id = p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'consent_not_found');
  END IF;

  IF p_max_amount IS NULL OR p_max_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_max_amount');
  END IF;

  -- Último cobro de mensualidad generado para el atleta en la escuela (D14).
  SELECT p.* INTO v_last
    FROM public.payments p
   WHERE p.school_id = p_school_id AND p.payment_category = 'mensualidad'
     AND p.period_year IS NOT NULL AND p.status <> 'cancelled'
     AND ((p_child_id IS NOT NULL AND p.child_id = p_child_id)
       OR (p_athlete_user_id IS NOT NULL AND p.child_id IS NULL AND p.unregistered_athlete_id IS NULL
           AND (p.user_id = p_athlete_user_id OR (p.user_id IS NULL AND p.parent_id = p_athlete_user_id))))
   ORDER BY p.period_year DESC, p.period_month DESC, p.created_at DESC
   LIMIT 1;

  IF v_last.id IS NULL THEN
    v_year  := extract(year FROM p_today);
    v_month := extract(month FROM p_today);
  ELSIF p_include_current_period AND v_last.status = 'pending' AND v_last.due_date >= p_today THEN
    -- "Debitar también la mensualidad de <mes>": solo si está pending y NO vencida.
    v_year  := v_last.period_year;
    v_month := v_last.period_month;
    v_total := public.autopay_payment_total(v_last.id);
  ELSE
    v_year  := v_last.period_year + CASE WHEN v_last.period_month = 12 THEN 1 ELSE 0 END;
    v_month := CASE WHEN v_last.period_month = 12 THEN 1 ELSE v_last.period_month + 1 END;
    v_total := public.autopay_payment_total(v_last.id);  -- referencia del total vigente
  END IF;

  -- D5: el tope tiene que cubrir el total vigente.
  IF v_total IS NOT NULL AND p_max_amount < v_total THEN
    RETURN jsonb_build_object('ok', false, 'error', 'max_amount_below_current', 'current_total', v_total);
  END IF;

  BEGIN
    INSERT INTO public.recurring_subscriptions (
      school_id, payer_user_id, child_id, athlete_user_id, payment_token_id, consent_id,
      max_amount, first_period_year, first_period_month
    ) VALUES (
      p_school_id, p_user_id, p_child_id, p_athlete_user_id, p_token_id, p_consent_id,
      p_max_amount, v_year, v_month
    ) RETURNING id INTO v_sub_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_subscribed');
  END;

  RETURN jsonb_build_object('ok', true, 'subscription_id', v_sub_id,
                            'first_period_year', v_year, 'first_period_month', v_month);
END;
$$;

-- 5.4 Cancelación (D13). Pagador ('parent'), admin de la escuela ('school') o el
-- sistema (p_actor_id NULL) con los motivos automáticos. Devuelve si la fuente quedó
-- sin uso, para que el BFF decida el void en Wompi.
CREATE FUNCTION public.autopay_cancel_subscription(
  p_actor_id        uuid,
  p_subscription_id uuid,
  p_reason          text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_sub public.recurring_subscriptions;
BEGIN
  SELECT * INTO v_sub FROM public.recurring_subscriptions WHERE id = p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;

  IF p_reason = 'parent' THEN
    IF p_actor_id IS DISTINCT FROM v_sub.payer_user_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
    END IF;
  ELSIF p_reason = 'school' THEN
    IF p_actor_id IS NULL OR NOT (v_sub.school_id = ANY (public.autopay_admin_school_ids_for(p_actor_id))) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
    END IF;
  ELSIF p_reason IN ('athlete_inactive', 'no_active_enrollment', 'token_voided', 'account_deleted', 'merchant_changed') THEN
    IF p_actor_id IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'system_reason_only');
    END IF;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_reason');
  END IF;

  IF v_sub.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', true, 'unchanged', true, 'token_id', v_sub.payment_token_id,
      'token_unused', NOT EXISTS (SELECT 1 FROM public.recurring_subscriptions
                                   WHERE payment_token_id = v_sub.payment_token_id AND status <> 'cancelled'));
  END IF;

  PERFORM public.autopay_cancel_internal(p_subscription_id, p_reason, p_actor_id);

  RETURN jsonb_build_object('ok', true, 'token_id', v_sub.payment_token_id,
    'token_unused', NOT EXISTS (SELECT 1 FROM public.recurring_subscriptions
                                 WHERE payment_token_id = v_sub.payment_token_id AND status <> 'cancelled'));
END;
$$;

-- 5.5 "Ya pagué este mes / no debitar esta vez" (D8). Solo el pagador.
CREATE FUNCTION public.autopay_parent_skip(p_user_id uuid, p_cycle_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_state text;
  v_payer uuid;
BEGIN
  SELECT c.state, s.payer_user_id INTO v_state, v_payer
    FROM public.autopay_cycles c JOIN public.recurring_subscriptions s ON s.id = c.subscription_id
   WHERE c.id = p_cycle_id
     FOR UPDATE OF c;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF v_payer <> p_user_id THEN RETURN jsonb_build_object('ok', false, 'error', 'forbidden'); END IF;
  IF v_state NOT IN ('scheduled', 'noticed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cycle_not_skippable', 'state', v_state);
  END IF;

  UPDATE public.autopay_cycles
     SET state = 'skipped', skip_reason = 'parent_skip', skipped_by = p_user_id,
         hold_reason = NULL, hold_at = NULL, updated_at = now()
   WHERE id = p_cycle_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 5.6 Planificar y decidir avisos (§5.1 A y B). Devuelve lo que el BFF tiene que
-- avisar hoy: 'notice' (primer aviso o re-aviso) o los skips que se notifican
-- ('over_max_amount', 'token_not_available').
CREATE FUNCTION public.autopay_plan_cycles(p_today date DEFAULT (now() AT TIME ZONE 'America/Bogota')::date)
RETURNS TABLE (
  cycle_id        uuid,
  subscription_id uuid,
  payment_id      uuid,
  payer_user_id   uuid,
  school_id       uuid,
  action          text,
  total           numeric,
  first_attempt_on date
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  r       record;
  v_total numeric;
  v_n     int;
BEGIN
  -- A. Un ciclo por cada mensualidad pending del atleta, periodo >= first_period.
  INSERT INTO public.autopay_cycles (payment_id, subscription_id, school_id, first_attempt_on)
  SELECT p.id, s.id, s.school_id,
         p.due_date - COALESCE(ss.autopay_days_before_due, 3)
    FROM public.recurring_subscriptions s
    JOIN public.payments p
      ON p.school_id = s.school_id
     AND p.payment_category = 'mensualidad'
     AND p.status = 'pending'
     AND p.period_year IS NOT NULL
     AND (p.period_year, p.period_month) >= (s.first_period_year, s.first_period_month)
     AND public.autopay_payment_matches(s, p)
    LEFT JOIN public.school_settings ss ON ss.school_id = s.school_id
   WHERE s.status = 'active'
  ON CONFLICT (payment_id) DO NOTHING;

  -- Cobros que dejaron de estar pending antes de avisar o de debitar.
  FOR r IN
    SELECT c.id, c.subscription_id, p.status AS pay_status
      FROM public.autopay_cycles c JOIN public.payments p ON p.id = c.payment_id
     WHERE c.state IN ('scheduled', 'noticed') AND p.status <> 'pending'
       FOR UPDATE OF c
  LOOP
    IF r.pay_status IN ('paid', 'awaiting_approval', 'partial') THEN
      UPDATE public.autopay_cycles SET state = 'skipped', skip_reason = 'paid_elsewhere',
             hold_reason = NULL, hold_at = NULL, updated_at = now() WHERE id = r.id;
      PERFORM public.autopay_reset_cycles_without_debit(r.subscription_id);
    ELSE
      -- cancelled / overdue / failed / rejected / glosado: lo vencido nunca se debita (D14).
      UPDATE public.autopay_cycles SET state = 'cancelled', hold_reason = NULL, hold_at = NULL,
             updated_at = now() WHERE id = r.id;
    END IF;
  END LOOP;

  -- B. Avisos de hoy.
  FOR r IN
    SELECT c.id, c.subscription_id, c.payment_id, c.school_id, c.renotice_count,
           s.payer_user_id, s.max_amount, s.status AS sub_status,
           t.status AS tok_status,
           p.due_date, p.created_at AS pay_created,
           COALESCE(ss.autopay_days_before_due, 3) AS n_days
      FROM public.autopay_cycles c
      JOIN public.recurring_subscriptions s ON s.id = c.subscription_id
      JOIN public.payments p                ON p.id = c.payment_id
      JOIN public.payment_tokens t          ON t.id = s.payment_token_id
      LEFT JOIN public.school_settings ss   ON ss.school_id = c.school_id
     WHERE c.state = 'scheduled' AND s.status = 'active'
       FOR UPDATE OF c
  LOOP
    v_n := r.n_days;
    IF p_today < GREATEST((r.pay_created AT TIME ZONE 'America/Bogota')::date, r.due_date - v_n - 2) THEN
      CONTINUE;
    END IF;

    v_total := public.autopay_payment_total(r.payment_id);

    IF v_total > r.max_amount THEN
      UPDATE public.autopay_cycles SET state = 'skipped', skip_reason = 'over_max_amount', updated_at = now()
       WHERE id = r.id;
      PERFORM public.autopay_count_cycle_without_debit(r.subscription_id, 'over_max_amount');
      cycle_id := r.id; subscription_id := r.subscription_id; payment_id := r.payment_id;
      payer_user_id := r.payer_user_id; school_id := r.school_id; action := 'over_max_amount';
      total := v_total; first_attempt_on := NULL;
      RETURN NEXT;
    ELSIF r.tok_status IS DISTINCT FROM 'available' THEN
      UPDATE public.autopay_cycles SET state = 'skipped', skip_reason = 'token_not_available', updated_at = now()
       WHERE id = r.id;
      PERFORM public.autopay_count_cycle_without_debit(r.subscription_id, 'token_not_available');
      cycle_id := r.id; subscription_id := r.subscription_id; payment_id := r.payment_id;
      payer_user_id := r.payer_user_id; school_id := r.school_id; action := 'token_not_available';
      total := v_total; first_attempt_on := NULL;
      RETURN NEXT;
    ELSE
      cycle_id := r.id; subscription_id := r.subscription_id; payment_id := r.payment_id;
      payer_user_id := r.payer_user_id; school_id := r.school_id; action := 'notice';
      total := v_total; first_attempt_on := GREATEST(r.due_date - v_n, p_today + 2);
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

-- 5.7 El BFF la llama DESPUÉS de enviar el aviso: recién ahí existe notice_sent_at (D4).
CREATE FUNCTION public.autopay_mark_noticed(
  p_cycle_id        uuid,
  p_announced_total numeric,
  p_today           date DEFAULT (now() AT TIME ZONE 'America/Bogota')::date
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_state text;
  v_due   date;
  v_n     int;
  v_first date;
BEGIN
  SELECT c.state, p.due_date, COALESCE(ss.autopay_days_before_due, 3)
    INTO v_state, v_due, v_n
    FROM public.autopay_cycles c
    JOIN public.payments p ON p.id = c.payment_id
    LEFT JOIN public.school_settings ss ON ss.school_id = c.school_id
   WHERE c.id = p_cycle_id
     FOR UPDATE OF c;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF v_state <> 'scheduled' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cycle_not_scheduled', 'state', v_state);
  END IF;
  IF p_announced_total IS NULL OR p_announced_total <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_total');
  END IF;

  v_first := GREATEST(v_due - v_n, p_today + 2);
  UPDATE public.autopay_cycles
     SET state = 'noticed', notice_sent_at = now(), announced_total = p_announced_total,
         first_attempt_on = v_first, next_attempt_on = v_first, updated_at = now()
   WHERE id = p_cycle_id;

  RETURN jsonb_build_object('ok', true, 'first_attempt_on', v_first);
END;
$$;

-- 5.8 Claim (§5.1 C). En una transacción: elige los ciclos a debitar hoy e inserta el
-- intento `processing` con lease. FOR UPDATE SKIP LOCKED + índice único de intento
-- vivo por cobro → dos corridas simultáneas nunca cobran dos veces el mismo cobro.
-- Devuelve además el checkout manual pendiente más viejo de 2 h, si lo hay (§7.3):
-- el BFF lo consulta en Wompi y, si tiene transacción, libera el intento con
-- autopay_release_attempt(..., 'manual_checkout_open').
CREATE FUNCTION public.autopay_claim_due(
  p_limit          int  DEFAULT 50,
  p_lease_seconds  int  DEFAULT 300,
  p_today          date DEFAULT (now() AT TIME ZONE 'America/Bogota')::date
) RETURNS TABLE (
  attempt_id                 uuid,
  cycle_id                   uuid,
  payment_id                 uuid,
  subscription_id            uuid,
  school_id                  uuid,
  payer_user_id              uuid,
  amount                     numeric,
  attempt_no                 smallint,
  payment_token_id           uuid,
  provider_payment_source_id bigint,
  payment_method_type        text,
  provider_merchant_id       text,
  manual_link_id             uuid,
  manual_link_reference      text
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  r          record;
  v_total    numeric;
  v_attempt  uuid;
  v_no       smallint;
  v_recent   boolean;
  v_old_link public.payment_links;
BEGIN
  -- C.1 Interruptor global.
  IF NOT COALESCE((SELECT (value->>'debits_enabled')::boolean FROM public.platform_config
                    WHERE key = 'autopay_kill_switch'), false) THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT c.id, c.subscription_id, c.payment_id, c.school_id, c.announced_total, c.attempts_used,
           s.payer_user_id, s.status AS sub_status, s.payment_token_id,
           t.status AS tok_status, t.provider_payment_source_id, t.payment_method_type, t.provider_merchant_id,
           p.status AS pay_status,
           COALESCE(ss.autopay_debits_paused, false) AS paused
      FROM public.autopay_cycles c
      JOIN public.recurring_subscriptions s ON s.id = c.subscription_id
      JOIN public.payments p                ON p.id = c.payment_id
      JOIN public.payment_tokens t          ON t.id = s.payment_token_id
      LEFT JOIN public.school_settings ss   ON ss.school_id = c.school_id
     WHERE c.state = 'noticed'                 -- C.3
       AND c.notice_sent_at IS NOT NULL
       AND c.next_attempt_on <= p_today
       AND c.attempts_used < 3                  -- C.7
       AND s.status = 'active'
     ORDER BY c.next_attempt_on, c.created_at
     LIMIT p_limit
       FOR UPDATE OF c SKIP LOCKED
  LOOP
    -- C.2 Débitos pausados por la escuela: retención, sin consumir intento.
    IF r.paused THEN
      UPDATE public.autopay_cycles SET hold_reason = 'debits_paused', hold_at = now(), updated_at = now()
       WHERE id = r.id;
      CONTINUE;
    END IF;

    -- C.4 El cobro ya no está pending.
    IF r.pay_status IN ('paid', 'awaiting_approval', 'partial') THEN
      UPDATE public.autopay_cycles SET state = 'skipped', skip_reason = 'paid_elsewhere',
             hold_reason = NULL, hold_at = NULL, updated_at = now() WHERE id = r.id;
      PERFORM public.autopay_reset_cycles_without_debit(r.subscription_id);
      CONTINUE;
    ELSIF r.pay_status <> 'pending' THEN
      UPDATE public.autopay_cycles SET state = 'cancelled', hold_reason = NULL, hold_at = NULL,
             updated_at = now() WHERE id = r.id;
      CONTINUE;
    END IF;

    -- Medio que dejó de servir después del aviso.
    IF r.tok_status IS DISTINCT FROM 'available' THEN
      UPDATE public.autopay_cycles SET state = 'skipped', skip_reason = 'token_not_available',
             hold_reason = NULL, hold_at = NULL, updated_at = now() WHERE id = r.id;
      PERFORM public.autopay_count_cycle_without_debit(r.subscription_id, 'token_not_available');
      CONTINUE;
    END IF;

    -- C.5 Nunca por encima de lo anunciado: si subió (p. ej. cambio de plan), re-aviso.
    v_total := public.autopay_payment_total(r.payment_id);
    IF v_total > r.announced_total THEN
      UPDATE public.autopay_cycles
         SET state = 'scheduled', renotice_count = renotice_count + 1,
             hold_reason = NULL, hold_at = NULL, updated_at = now()
       WHERE id = r.id;
      CONTINUE;
    END IF;

    -- C.7 Sin intento vivo (el índice único lo garantiza; esto evita el error).
    IF EXISTS (SELECT 1 FROM public.recurring_charge_attempts a
                WHERE a.payment_id = r.payment_id AND a.status IN ('processing', 'pending_provider')) THEN
      CONTINUE;
    END IF;

    -- C.8 / §7.3 Checkout manual pendiente del mismo cobro.
    SELECT EXISTS (SELECT 1 FROM public.payment_links l
                    WHERE l.payment_id = r.payment_id AND l.status = 'pending' AND l.origin = 'checkout'
                      AND l.created_at > now() - interval '2 hours')
      INTO v_recent;
    IF v_recent THEN
      UPDATE public.autopay_cycles SET hold_reason = 'manual_checkout_open', hold_at = now(), updated_at = now()
       WHERE id = r.id;
      CONTINUE;
    END IF;
    SELECT * INTO v_old_link FROM public.payment_links l
     WHERE l.payment_id = r.payment_id AND l.status = 'pending' AND l.origin = 'checkout'
     ORDER BY l.created_at DESC LIMIT 1;

    -- Intento real.
    v_no := r.attempts_used + 1;
    INSERT INTO public.recurring_charge_attempts (cycle_id, payment_id, attempt_no, status, amount, lease_until)
    VALUES (r.id, r.payment_id, v_no, 'processing', v_total, now() + make_interval(secs => p_lease_seconds))
    RETURNING id INTO v_attempt;

    UPDATE public.autopay_cycles
       SET state = 'in_progress', attempts_used = v_no, hold_reason = NULL, hold_at = NULL, updated_at = now()
     WHERE id = r.id;

    attempt_id := v_attempt; cycle_id := r.id; payment_id := r.payment_id;
    subscription_id := r.subscription_id; school_id := r.school_id; payer_user_id := r.payer_user_id;
    amount := v_total; attempt_no := v_no; payment_token_id := r.payment_token_id;
    provider_payment_source_id := r.provider_payment_source_id;
    payment_method_type := r.payment_method_type; provider_merchant_id := r.provider_merchant_id;
    manual_link_id := v_old_link.id; manual_link_reference := COALESCE(v_old_link.provider_reference, v_old_link.wompi_reference);
    RETURN NEXT;
  END LOOP;
END;
$$;

-- 5.9 Liberar un intento que NO llegó a Wompi (merchant distinto, checkout manual con
-- transacción, etc.): se borra el intento y no consume attempt_no (prueba 5).
CREATE FUNCTION public.autopay_release_attempt(p_attempt_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_att public.recurring_charge_attempts;
  v_sub uuid;
BEGIN
  SELECT * INTO v_att FROM public.recurring_charge_attempts WHERE id = p_attempt_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF v_att.status <> 'processing' OR v_att.provider_transaction_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'attempt_reached_provider');
  END IF;
  IF p_reason NOT IN ('manual_checkout_open', 'merchant_mismatch') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_reason');
  END IF;

  DELETE FROM public.recurring_charge_attempts WHERE id = p_attempt_id;

  IF p_reason = 'manual_checkout_open' THEN
    UPDATE public.autopay_cycles
       SET state = 'noticed', attempts_used = attempts_used - 1,
           hold_reason = 'manual_checkout_open', hold_at = now(), updated_at = now()
     WHERE id = v_att.cycle_id;
  ELSE
    UPDATE public.autopay_cycles
       SET state = 'skipped', skip_reason = 'merchant_mismatch', attempts_used = attempts_used - 1,
           updated_at = now()
     WHERE id = v_att.cycle_id
    RETURNING subscription_id INTO v_sub;
    -- D11: la fuente es de otro comercio → no vuelve a servir.
    PERFORM public.autopay_cancel_internal(v_sub, 'merchant_changed', NULL);
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 5.10 Resultado del intento. Idempotente: un intento ya cerrado no se reabre.
CREATE FUNCTION public.autopay_finish_attempt(
  p_attempt_id       uuid,
  p_status           text,
  p_provider_tx_id   text DEFAULT NULL,
  p_error_code       text DEFAULT NULL,
  p_provider_reference text DEFAULT NULL,
  p_payment_link_id  uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_att   public.recurring_charge_attempts;
  v_cyc   public.autopay_cycles;
BEGIN
  IF p_status NOT IN ('pending_provider', 'approved', 'declined', 'error') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  SELECT * INTO v_att FROM public.recurring_charge_attempts WHERE id = p_attempt_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;

  IF v_att.status IN ('approved', 'declined', 'error') THEN
    RETURN jsonb_build_object('ok', true, 'unchanged', true, 'status', v_att.status);
  END IF;

  UPDATE public.recurring_charge_attempts
     SET status                  = p_status,
         provider_transaction_id = COALESCE(p_provider_tx_id, provider_transaction_id),
         provider_reference      = COALESCE(p_provider_reference, provider_reference),
         payment_link_id         = COALESCE(p_payment_link_id, payment_link_id),
         error_code              = CASE WHEN p_status IN ('declined', 'error') THEN p_error_code ELSE error_code END,
         lease_until             = CASE WHEN p_status = 'pending_provider' THEN lease_until ELSE NULL END,
         next_check_at           = CASE WHEN p_status = 'pending_provider' THEN now() + interval '2 minutes' ELSE NULL END,
         updated_at              = now()
   WHERE id = p_attempt_id;

  IF p_status = 'pending_provider' THEN
    RETURN jsonb_build_object('ok', true, 'status', p_status);
  END IF;

  SELECT * INTO v_cyc FROM public.autopay_cycles WHERE id = v_att.cycle_id FOR UPDATE;

  IF p_status = 'approved' THEN
    UPDATE public.autopay_cycles SET state = 'paid', updated_at = now() WHERE id = v_cyc.id;
    PERFORM public.autopay_reset_cycles_without_debit(v_cyc.subscription_id);
  ELSIF v_cyc.attempts_used >= 3 THEN
    UPDATE public.autopay_cycles SET state = 'exhausted', updated_at = now() WHERE id = v_cyc.id;
    PERFORM public.autopay_count_cycle_without_debit(v_cyc.subscription_id, 'provider_declined');
  ELSIF v_cyc.state = 'in_progress' THEN
    -- Reintentos a +1 y +3 días del primero.
    UPDATE public.autopay_cycles
       SET state = 'noticed',
           next_attempt_on = v_cyc.first_attempt_on + CASE v_cyc.attempts_used WHEN 1 THEN 1 ELSE 3 END,
           updated_at = now()
     WHERE id = v_cyc.id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', p_status);
END;
$$;

-- 5.11 Incidentes. Un cobro doble suspende la suscripción (§8.3).
CREATE FUNCTION public.autopay_record_incident(
  p_kind                    text,
  p_school_id               uuid    DEFAULT NULL,
  p_payment_id              uuid    DEFAULT NULL,
  p_subscription_id         uuid    DEFAULT NULL,
  p_provider_transaction_id text    DEFAULT NULL,
  p_amount                  numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  BEGIN
    INSERT INTO public.autopay_incidents (kind, school_id, payment_id, subscription_id, provider_transaction_id, amount)
    VALUES (p_kind, p_school_id, p_payment_id, p_subscription_id, p_provider_transaction_id, p_amount)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', true, 'unchanged', true);
  END;

  IF p_kind = 'duplicate_charge' AND p_subscription_id IS NOT NULL THEN
    UPDATE public.recurring_subscriptions
       SET status = 'suspended', suspend_reason = 'duplicate_charge', suspended_at = now(), updated_at = now()
     WHERE id = p_subscription_id AND status = 'active';
  END IF;

  RETURN jsonb_build_object('ok', true, 'incident_id', v_id);
END;
$$;

-- 5.12 Intentos de una suscripción, para el pagador o el admin de la escuela.
CREATE FUNCTION public.autopay_attempts_for(p_actor_id uuid, p_subscription_id uuid)
RETURNS SETOF public.recurring_charge_attempts
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT a.*
    FROM public.recurring_charge_attempts a
    JOIN public.autopay_cycles c          ON c.id = a.cycle_id
    JOIN public.recurring_subscriptions s ON s.id = c.subscription_id
   WHERE s.id = p_subscription_id
     AND (s.payer_user_id = p_actor_id OR s.school_id = ANY (public.autopay_admin_school_ids_for(p_actor_id)))
   ORDER BY a.created_at;
$$;

-- 5.13 Latido de cada corrida.
CREATE FUNCTION public.autopay_heartbeat(p_run text, p_detail jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  UPDATE public.platform_config
     SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(p_run, jsonb_build_object('at', now(), 'detail', p_detail)),
         updated_at = now()
   WHERE key = 'autopay_heartbeat';
$$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.autopay_register_token(uuid, uuid, text, text, bigint, text, text, text, text, text, text, date)',
    'public.autopay_mark_token(uuid, text, bigint, text)',
    'public.autopay_create_subscription(uuid, uuid, uuid, uuid, uuid, numeric, uuid, boolean, date)',
    'public.autopay_cancel_subscription(uuid, uuid, text)',
    'public.autopay_parent_skip(uuid, uuid)',
    'public.autopay_plan_cycles(date)',
    'public.autopay_mark_noticed(uuid, numeric, date)',
    'public.autopay_claim_due(int, int, date)',
    'public.autopay_release_attempt(uuid, text)',
    'public.autopay_finish_attempt(uuid, text, text, text, text, uuid)',
    'public.autopay_record_incident(text, uuid, uuid, uuid, text, numeric)',
    'public.autopay_attempts_for(uuid, uuid)',
    'public.autopay_heartbeat(text, jsonb)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. Baja / fin de inscripción (§5.2) — trigger DIFERIDO
-- ════════════════════════════════════════════════════════════════════════════
-- Corre al COMMIT: un cambio de plan que cancela una inscripción y crea otra en la
-- misma transacción ve la nueva y NO cancela el débito. Solo cancela si el atleta
-- quedó sin ninguna inscripción activa en la escuela.
CREATE FUNCTION public.autopay_on_enrollment_end()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  r        record;
  v_reason text;
BEGIN
  IF OLD.child_id IS NULL AND OLD.user_id IS NULL THEN RETURN NULL; END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = 'active' THEN RETURN NULL; END IF;

  FOR r IN
    SELECT s.id, s.child_id, s.athlete_user_id
      FROM public.recurring_subscriptions s
     WHERE s.school_id = OLD.school_id AND s.status IN ('active', 'suspended')
       AND ((OLD.child_id IS NOT NULL AND s.child_id = OLD.child_id)
         OR (OLD.user_id IS NOT NULL AND s.athlete_user_id = OLD.user_id))
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.enrollments e
       WHERE e.school_id = OLD.school_id AND e.status = 'active'
         AND ((r.child_id IS NOT NULL AND e.child_id = r.child_id)
           OR (r.athlete_user_id IS NOT NULL AND e.user_id = r.athlete_user_id))
    ) THEN
      CONTINUE;
    END IF;

    -- Atleta dado de baja (set_school_athlete_status) vs. inscripción que terminó.
    IF (r.child_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.children c WHERE c.id = r.child_id AND NOT c.is_active))
       OR (r.athlete_user_id IS NOT NULL AND EXISTS (
             SELECT 1 FROM public.school_members sm
              WHERE sm.profile_id = r.athlete_user_id AND sm.school_id = OLD.school_id
                AND sm.role = 'athlete' AND sm.status = 'inactive')) THEN
      v_reason := 'athlete_inactive';
    ELSE
      v_reason := 'no_active_enrollment';
    END IF;

    PERFORM public.autopay_cancel_internal(r.id, v_reason, NULL);
  END LOOP;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.autopay_on_enrollment_end() FROM PUBLIC, anon, authenticated;

CREATE CONSTRAINT TRIGGER trg_autopay_on_enrollment_end
  AFTER UPDATE OF status OR DELETE ON public.enrollments
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (OLD.status = 'active')
  EXECUTE FUNCTION public.autopay_on_enrollment_end();

-- ════════════════════════════════════════════════════════════════════════════
-- 7. RLS (§6): lectura del pagador y del admin de la escuela; escritura solo RPC
-- ════════════════════════════════════════════════════════════════════════════

-- Suscripciones visibles para el usuario de la sesión (para la policy de ciclos:
-- evita que autopay_cycles subconsulte una tabla con RLS en su USING).
CREATE FUNCTION public.autopay_visible_subscription_ids()
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT COALESCE(ARRAY(
    SELECT s.id FROM public.recurring_subscriptions s
     WHERE s.payer_user_id = auth.uid()
        OR s.school_id = ANY (public.user_admin_school_ids())
  ), '{}'::uuid[]);
$$;
REVOKE ALL ON FUNCTION public.autopay_visible_subscription_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.autopay_visible_subscription_ids() TO authenticated;

ALTER TABLE public.recurring_subscriptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autopay_cycles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_charge_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autopay_incidents         ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.recurring_subscriptions, public.autopay_cycles,
              public.recurring_charge_attempts, public.autopay_incidents
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.recurring_subscriptions, public.autopay_cycles, public.autopay_incidents TO authenticated;
-- recurring_charge_attempts: sin GRANT ni policy → solo vía autopay_attempts_for.

CREATE POLICY recurring_subscriptions_read ON public.recurring_subscriptions
  FOR SELECT TO authenticated
  USING (payer_user_id = (SELECT auth.uid())
         OR school_id = ANY ((SELECT public.user_admin_school_ids())::uuid[]));

CREATE POLICY autopay_cycles_read ON public.autopay_cycles
  FOR SELECT TO authenticated
  USING (subscription_id = ANY ((SELECT public.autopay_visible_subscription_ids())::uuid[]));

CREATE POLICY autopay_incidents_read ON public.autopay_incidents
  FOR SELECT TO authenticated
  USING ((SELECT public.is_super_admin())
         OR school_id = ANY ((SELECT public.user_admin_school_ids())::uuid[]));

COMMIT;
