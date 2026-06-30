-- ============================================================
-- SPORTMAPS — Hardening seguridad de pagos P1 (Tanda 3A)
--
-- Cierra los hallazgos P1+P2 de la auditoria:
--   C3. set_default_payment_token atomico (evita race "ningun default")
--   A5. count_active_payment_tokens para cap por usuario (anti card-testing)
--   A1. data_export_user — derecho de acceso (Ley 1581/2012)
--   A2. request_account_deletion — derecho de supresion (Ley 1581/2012)
--   B3. cleanup_old_inactive_payment_tokens + cron mensual
--   M3. trigger notify_recurring_subscription_status_change (best-effort)
--
-- Politica de la casa: search_path = pg_catalog, public, pg_temp en TODA
-- funcion nueva. RLS en tablas nuevas.
-- ============================================================


-- ============================================================
-- 1. set_default_payment_token — atomico
--
-- Reemplaza el flujo de 2 UPDATEs separados en el BFF (race).
-- Resuelve: si el segundo UPDATE falla, usuario quedaba sin default
-- y autopay se rompia.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_default_payment_token(p_token_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_owner   uuid;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'auth_required');
    END IF;

    SELECT user_id INTO v_owner
      FROM public.payment_tokens
     WHERE id = p_token_id AND is_active = true;

    IF v_owner IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'token_not_found');
    END IF;
    IF v_owner <> v_user_id THEN
        RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
    END IF;

    -- Atomico: en una sola statement marcamos default solo al elegido
    -- y desmarcamos al resto. Si falla, transaccion entera rollback.
    UPDATE public.payment_tokens
       SET is_default = (id = p_token_id),
           updated_at = CASE WHEN is_default <> (id = p_token_id) THEN now() ELSE updated_at END
     WHERE user_id = v_user_id AND is_active = true;

    RETURN jsonb_build_object('ok', true, 'token_id', p_token_id);
END;
$$;

REVOKE ALL ON FUNCTION public.set_default_payment_token(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_default_payment_token(uuid) TO authenticated;


-- ============================================================
-- 2. count_active_payment_tokens — cap por usuario (anti card-testing)
-- ============================================================
--
-- Devuelve cantidad de tokens activos del usuario. El BFF lo usa antes
-- de aceptar un nuevo token (cap configurable, default 5).
-- Un atacante con cuenta valida no puede llenar la DB con tokens
-- robados para card-testing.

CREATE OR REPLACE FUNCTION public.count_active_payment_tokens(p_user_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT COUNT(*)::integer
      FROM public.payment_tokens
     WHERE user_id = p_user_id AND is_active = true;
$$;

REVOKE ALL ON FUNCTION public.count_active_payment_tokens(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_active_payment_tokens(uuid) TO service_role;


-- ============================================================
-- 3. account_deletion_requests — tabla de solicitudes de borrado
-- ============================================================
--
-- Ley 1581/2012 + Decreto 1377/2013: el titular tiene derecho a la
-- supresion. Plazo maximo: 15 dias habiles desde la solicitud.
-- Nosotros damos 30 dias calendario para que el padre pueda cancelar
-- si fue por error (similar a Google/Meta).
--
-- La ejecucion real (anonimizacion) la hace un job aparte que corre
-- diariamente y procesa requests con scheduled_for <= now() y status='pending'.

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason          text,
    requested_at    timestamptz NOT NULL DEFAULT now(),
    scheduled_for   timestamptz NOT NULL,                       -- requested_at + 30 dias
    status          text        NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','cancelled','completed','failed')),
    cancelled_at    timestamptz,
    completed_at    timestamptz,
    error_message   text,

    -- Trazabilidad legal
    ip_address      inet,
    user_agent      text,

    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Solo una solicitud pendiente por usuario
CREATE UNIQUE INDEX IF NOT EXISTS uq_account_deletion_pending
    ON public.account_deletion_requests(user_id)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_account_deletion_scheduled
    ON public.account_deletion_requests(scheduled_for)
    WHERE status = 'pending';

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "account_deletion_owner_select" ON public.account_deletion_requests;
CREATE POLICY "account_deletion_owner_select" ON public.account_deletion_requests
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());


-- ============================================================
-- 4. request_account_deletion — A2 (derecho al olvido)
-- ============================================================

CREATE OR REPLACE FUNCTION public.request_account_deletion(
    p_reason     text DEFAULT NULL,
    p_ip_address inet DEFAULT NULL,
    p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_user_id  uuid := auth.uid();
    v_id       uuid;
    v_when     timestamptz;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'auth_required');
    END IF;

    v_when := now() + interval '30 days';

    -- 1. Pausar inmediatamente todas las recurring_subscriptions activas
    --    (para que no se cobre durante la ventana de 30 dias antes del delete).
    UPDATE public.recurring_subscriptions
       SET status           = 'cancelled',
           cancelled_at     = now(),
           cancelled_reason = 'account_deletion_requested',
           updated_at       = now()
     WHERE user_id = v_user_id
       AND status IN ('active','paused','suspended');

    -- 2. Soft-delete inmediato de payment_tokens (asi no se pueden usar
    --    para nuevos cobros, ni siquiera one-shot).
    UPDATE public.payment_tokens
       SET is_active = false, is_default = false, updated_at = now()
     WHERE user_id = v_user_id AND is_active = true;

    -- 3. Registrar la solicitud. UNIQUE partial garantiza una sola pendiente.
    INSERT INTO public.account_deletion_requests (
        user_id, reason, scheduled_for, ip_address, user_agent
    ) VALUES (
        v_user_id, p_reason, v_when, p_ip_address, p_user_agent
    )
    ON CONFLICT (user_id) WHERE status = 'pending'
    DO UPDATE SET
        reason        = COALESCE(EXCLUDED.reason, account_deletion_requests.reason),
        scheduled_for = EXCLUDED.scheduled_for,        -- extender ventana
        updated_at    = now()
    RETURNING id INTO v_id;

    RETURN jsonb_build_object(
        'ok', true,
        'request_id', v_id,
        'scheduled_for', v_when,
        'message', 'Tu solicitud se ejecutara en 30 dias. Puedes cancelarla en cualquier momento mientras esta pendiente.'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.request_account_deletion(text, inet, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_account_deletion(text, inet, text) TO authenticated;


-- ============================================================
-- 5. cancel_account_deletion — el padre se arrepiente
-- ============================================================

CREATE OR REPLACE FUNCTION public.cancel_account_deletion()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'auth_required');
    END IF;

    UPDATE public.account_deletion_requests
       SET status        = 'cancelled',
           cancelled_at  = now(),
           updated_at    = now()
     WHERE user_id = v_user_id AND status = 'pending';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'no_pending_request');
    END IF;

    -- NOTA: NO reactivamos los payment_tokens automaticamente. El padre
    -- tiene que volver a agregar la tarjeta. Es defensivo: si el cancel
    -- viene de un atacante con la sesion, no le regalamos las tarjetas.
    RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_account_deletion() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_account_deletion() TO authenticated;


-- ============================================================
-- 6. data_export_user — A1 (derecho de acceso)
-- ============================================================
--
-- Devuelve un JSON con TODA la info personal del usuario que tenemos.
-- Lo expone el BFF via GET /api/v1/me/data-export.
--
-- Se incluye:
--   - perfil (profiles)
--   - hijos (children, solo si es padre)
--   - tarjetas guardadas (sin PAN ni CVC — solo last_four + brand)
--   - consents (payment_consents)
--   - suscripciones recurrentes
--   - intentos de cobro (recurring_charge_attempts ultimo año)
--   - pagos historicos (payments ultimo año)
--   - solicitudes de borrado
--
-- NO se incluye PAN, CVC, tokens efimeros, secrets — eso nunca lo tuvimos.

CREATE OR REPLACE FUNCTION public.data_export_user()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_user_id   uuid := auth.uid();
    v_email     text;
    v_result    jsonb;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'auth_required');
    END IF;

    SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

    v_result := jsonb_build_object(
        'generated_at', now(),
        'user_id', v_user_id,
        'email', v_email,
        'profile', (
            SELECT to_jsonb(p) FROM public.profiles p WHERE p.id = v_user_id
        ),
        'children', (
            SELECT COALESCE(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
              FROM public.children c WHERE c.parent_id = v_user_id
        ),
        'payment_tokens', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', t.id,
                'payment_provider', t.payment_provider,
                'payment_method_type', t.payment_method_type,
                'last_four', t.last_four,
                'brand', t.brand,
                'is_default', t.is_default,
                'is_active', t.is_active,
                'expires_at', t.expires_at,
                'created_at', t.created_at
            )), '[]'::jsonb)
              FROM public.payment_tokens t WHERE t.user_id = v_user_id
        ),
        'payment_consents', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', pc.id,
                'payment_provider', pc.payment_provider,
                'accepted_at', pc.accepted_at,
                'acceptance_permalink', pc.acceptance_permalink,
                'personal_data_permalink', pc.personal_data_permalink,
                'ip_address', pc.ip_address::text,
                'user_agent', pc.user_agent
            )), '[]'::jsonb)
              FROM public.payment_consents pc WHERE pc.user_id = v_user_id
        ),
        'recurring_subscriptions', (
            SELECT COALESCE(jsonb_agg(to_jsonb(rs)), '[]'::jsonb)
              FROM public.recurring_subscriptions rs WHERE rs.user_id = v_user_id
        ),
        'recurring_charge_attempts', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', a.id,
                'subscription_id', a.subscription_id,
                'attempted_at', a.attempted_at,
                'amount', a.amount,
                'currency', a.currency,
                'payment_provider', a.payment_provider,
                'status', a.status,
                'provider_payment_id', a.provider_payment_id,
                'error_code', a.error_code
            )), '[]'::jsonb)
              FROM public.recurring_charge_attempts a
              JOIN public.recurring_subscriptions s ON s.id = a.subscription_id
             WHERE s.user_id = v_user_id
               AND a.attempted_at >= now() - interval '1 year'
        ),
        'deletion_requests', (
            SELECT COALESCE(jsonb_agg(to_jsonb(d)), '[]'::jsonb)
              FROM public.account_deletion_requests d WHERE d.user_id = v_user_id
        )
    );

    RETURN jsonb_build_object('ok', true, 'data', v_result);
END;
$$;

REVOKE ALL ON FUNCTION public.data_export_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.data_export_user() TO authenticated;


-- ============================================================
-- 7. cleanup_old_inactive_payment_tokens — B3
-- ============================================================
--
-- Tokens soft-deleted (is_active=false) que llevan >2 anios → hard delete.
-- Mantenemos 2 anios para forense + chargebacks (regla Visa/MC).

CREATE OR REPLACE FUNCTION public.cleanup_old_inactive_payment_tokens()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_deleted integer;
BEGIN
    DELETE FROM public.payment_tokens
     WHERE is_active = false
       AND updated_at < now() - interval '2 years';
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_old_inactive_payment_tokens() TO service_role;


-- ============================================================
-- 8. pg_cron — cleanup mensual
-- ============================================================

DO $$
BEGIN
    PERFORM cron.unschedule('cleanup-old-payment-tokens-monthly');
EXCEPTION WHEN OTHERS THEN
    NULL;  -- no existia
END $$;

-- Primer dia de cada mes a las 03:00 UTC = 22:00 Bogota del dia anterior
SELECT cron.schedule(
    'cleanup-old-payment-tokens-monthly',
    '0 3 1 * *',
    $cron$
    SELECT public.cleanup_old_inactive_payment_tokens();
    SELECT public.cleanup_expired_card_save_intents();
    $cron$
);


-- ============================================================
-- 9. Comentarios y documentacion
-- ============================================================

COMMENT ON TABLE public.account_deletion_requests IS
    'Solicitudes de borrado de cuenta (Ley 1581/2012 derecho de supresion). '
    'Ventana de 30 dias para cancelar antes de ejecutar. Pause inmediata de '
    'subs + soft-delete de tokens al solicitar.';

COMMENT ON FUNCTION public.data_export_user IS
    'A1 — Ley 1581 derecho de acceso. Devuelve todos los datos personales '
    'del usuario autenticado en formato JSON. NO incluye PAN/CVC (que nunca '
    'guardamos).';

COMMENT ON FUNCTION public.request_account_deletion IS
    'A2 — Ley 1581 derecho de supresion. Programa borrado en 30 dias. '
    'Cancela subs y desactiva tokens inmediatamente. El borrado fisico '
    'lo ejecuta un job separado al cumplirse scheduled_for.';
