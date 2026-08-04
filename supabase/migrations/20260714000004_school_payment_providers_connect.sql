-- ============================================================
-- SPORTMAPS — Connected Accounts Fase 0: fundaciones de conexión self-service
-- ------------------------------------------------------------
-- Ref: docs/payments-connected-accounts-plan.md (v2.1, Fase 0). Fecha: 2026-07-14
--
--  1. Columnas de conexión en school_payment_providers (OAuth/manual, estado, fee).
--  2. schools.payment_mode — regla fail-closed [M1]: una escuela 'direct' NUNCA
--     cae a las llaves globales de SportMaps (ENV) por accidente.
--  3. payment_provider_secrets — secretos CIFRADOS, SOLO service_role, sin policies [M3].
--  4. Índice único: una cuenta MP (external_user_id) no puede quedar en dos escuelas [M4].
--
-- NO se droppean las columnas legacy de secretos (access_token/webhook_secret/
-- integrity_secret): las lee todavía el path vendor + recurring + marketplace.
-- Se dejan NULLABLE y en desuso; su limpieza va en una migración posterior cuando
-- también se migre el path vendor. Regla de migraciones inmutables respetada.
-- ============================================================

BEGIN;

-- ── 1. Columnas de conexión (visibles; NO secretos) ────────────────────────
ALTER TABLE public.school_payment_providers
  ADD COLUMN IF NOT EXISTS connect_method       text
    CHECK (connect_method IN ('oauth','manual')),
  ADD COLUMN IF NOT EXISTS external_user_id     text,                 -- MP user_id del merchant
  ADD COLUMN IF NOT EXISTS application_fee_pct  numeric,              -- override comisión (null = global)
  ADD COLUMN IF NOT EXISTS connect_status       text NOT NULL DEFAULT 'disconnected'
    CHECK (connect_status IN ('disconnected','connected','connected_pending_webhook','expired','error')),
  ADD COLUMN IF NOT EXISTS connected_at         timestamptz,
  ADD COLUMN IF NOT EXISTS connected_by         uuid REFERENCES public.profiles(id);

-- Los secretos dejan de vivir aquí (M3). access_token era NOT NULL; se libera para
-- que Fase 1 pueda crear la fila con los secretos en la tabla cifrada aparte.
ALTER TABLE public.school_payment_providers ALTER COLUMN access_token DROP NOT NULL;

COMMENT ON COLUMN public.school_payment_providers.access_token IS
  'DEPRECATED (Fase 0 connected-accounts): los secretos viven cifrados en payment_provider_secrets. No escribir nuevas conexiones aquí.';

-- ── 2. Modo de pago por escuela [M1] — fail-closed ─────────────────────────
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'unset'
    CHECK (payment_mode IN ('unset','direct','aggregator'));

-- Backfill honesto: hoy TODA escuela cobra con las llaves globales de SportMaps
-- (= agregador). Se las marca así para preservar exactamente el comportamiento actual.
UPDATE public.schools SET payment_mode = 'aggregator' WHERE payment_mode = 'unset';

COMMENT ON COLUMN public.schools.payment_mode IS
  'unset|direct|aggregator. direct = solo cuenta propia (fail-closed, nunca ENV). aggregator = llaves globales SportMaps. Endurecer unset=bloqueado es gate de prod (Fase 4).';

-- ── 3. Secretos cifrados — SOLO service_role (sin policies de cliente) [M3] ─
CREATE TABLE IF NOT EXISTS public.payment_provider_secrets (
  provider_id           uuid PRIMARY KEY
                        REFERENCES public.school_payment_providers(id) ON DELETE CASCADE,
  access_token_enc      text,      -- formato gcm:iv:tag:ct (AES-256-GCM cifrado en el BFF)
  refresh_token_enc     text,      -- MP OAuth refresh (de un solo uso, rota) [M4]
  private_key_enc       text,      -- Wompi
  integrity_secret_enc  text,      -- Wompi Widget
  events_secret_enc     text,      -- Wompi webhooks
  token_expires_at      timestamptz,
  updated_at            timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_provider_secrets ENABLE ROW LEVEL SECURITY;
-- Deliberadamente SIN CREATE POLICY: ningún rol de cliente (anon/authenticated) la lee.
-- El BFF accede con service_role, que bypassa RLS.
REVOKE ALL ON public.payment_provider_secrets FROM anon, authenticated;

-- ── 4. Una cuenta externa (MP user_id) no puede conectarse a dos escuelas [M4] ─
CREATE UNIQUE INDEX IF NOT EXISTS uq_spp_external_user
  ON public.school_payment_providers (provider, external_user_id)
  WHERE external_user_id IS NOT NULL;

COMMIT;

NOTIFY pgrst, 'reload schema';
