-- =============================================================================
-- 20261014105158_indices_duplicados_y_parciales.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261013193011
-- Objetivo: bajar el Disk IO tras la caída del 2026-10-14 (~14 h sin base).
--   1) Borra 24 índices EXACTAMENTE duplicados (misma tabla, columnas, opclass,
--      expresión y predicado). Cada uno se mantiene en cada INSERT/UPDATE sin
--      servir a ninguna lectura que su gemelo no sirva: frenan toda escritura.
--      Regla por grupo: se conserva el que respalda una constraint o es UNIQUE;
--      si no hay, el de más idx_scan (pg_stat_user_indexes, 2026-10-14).
--   2) Crea dos índices parciales para consultas de jobs que hacían seq scan
--      cada minuto ×3 BFF.
-- Sin CONCURRENTLY: la migración corre en transacción y las tablas son chicas.
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

-- ─── 1. Duplicados exactos ──────────────────────────────────────────────────
-- Formato: DROP <borrado>  -- se queda <gemelo> (motivo)

-- payments
DROP INDEX IF EXISTS public.idx_payments_child_id;          -- se queda idx_payments_child (493k scans)
DROP INDEX IF EXISTS public.idx_transactions_child;         -- se queda idx_payments_child (493k scans)
DROP INDEX IF EXISTS public.idx_payments_school_id;         -- se queda idx_transactions_school (27.9k scans)

-- children
DROP INDEX IF EXISTS public.idx_children_parent_id;         -- se queda idx_children_parent (136k scans)
DROP INDEX IF EXISTS public.idx_children_school_id;         -- se queda idx_children_school (53.8k scans)

-- products
DROP INDEX IF EXISTS public.idx_products_school_id;         -- se queda idx_products_school (173 scans)

-- events (ambos con 0 scans)
DROP INDEX IF EXISTS public.idx_events_event_date;          -- se queda idx_events_date

-- school_members
DROP INDEX IF EXISTS public.idx_school_members_composite;   -- se queda idx_school_members_composite_lookup (1.7M scans)

-- attendance_records
DROP INDEX IF EXISTS public.idx_attendance_records_date;    -- se queda idx_attendance_date (6.9k scans)

-- attendance_sessions
DROP INDEX IF EXISTS public.idx_attendance_sessions_facility_availability; -- se queda idx_attendance_sessions_unique_facility_slot (UNIQUE)

-- user_favorites
DROP INDEX IF EXISTS public.idx_favorites_user_id;          -- se queda idx_user_favorites_user (283 scans)
DROP INDEX IF EXISTS public.idx_favorites_school_id;        -- se queda idx_user_favorites_school (158 scans)

-- Duplicados de un índice que respalda constraint UNIQUE: se queda la constraint.
DROP INDEX IF EXISTS public.idx_school_referrals_code;      -- se queda school_referrals_referral_code_key
DROP INDEX IF EXISTS public.idx_payment_links_token;        -- se queda payment_links_token_key
DROP INDEX IF EXISTS public.idx_payment_splits_epayco_ref;  -- se queda payment_splits_epayco_ref_key
DROP INDEX IF EXISTS public.idx_certs_folio;                -- se queda athlete_certificates_folio_key
DROP INDEX IF EXISTS public.idx_join_qr_slug;               -- se queda school_join_qr_codes_slug_key
DROP INDEX IF EXISTS public.idx_vendor_profiles_user_id;    -- se queda vendor_profiles_user_id_key
DROP INDEX IF EXISTS public.idx_product_categories_slug;    -- se queda product_categories_slug_key
DROP INDEX IF EXISTS public.idx_product_brands_slug;        -- se queda product_brands_slug_key
DROP INDEX IF EXISTS public.idx_vendor_balances_vendor;     -- se queda vendor_balances_vendor_profile_id_key
DROP INDEX IF EXISTS public.idx_wa_messages_wa_id;          -- se queda uq_wa_message_wamid
DROP INDEX IF EXISTS public.idx_wa_ident_contact;           -- se queda uq_wa_ident
DROP INDEX IF EXISTS public.idx_zk_user_mappings_school_pin; -- se queda zk_user_mappings_school_id_zk_pin_key
DROP INDEX IF EXISTS public.idx_athlete_report_snapshots_report; -- se queda athlete_report_snapshots_unique_version

-- ─── 2. Índices parciales para jobs ─────────────────────────────────────────

-- Claim de comandos ZKTeco en el BFF:
--   UPDATE device_commands … WHERE school_id = $1 AND command_type IN (…)
--     AND status = 'pending' AND claimed_at IS NULL AND expires_at > now()
-- ~390k llamadas, todas seq scan.
CREATE INDEX IF NOT EXISTS idx_device_commands_claim_pendiente
    ON public.device_commands (school_id, command_type)
    WHERE status = 'pending' AND claimed_at IS NULL;

-- Barrido de avisos rechazados por Meta (whatsapp-payment-outcome).
CREATE INDEX IF NOT EXISTS idx_wa_messages_outbound_failed
    ON public.whatsapp_messages (created_at)
    WHERE direction = 'outbound' AND status = 'failed';

COMMIT;
