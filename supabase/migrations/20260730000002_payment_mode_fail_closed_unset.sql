-- ============================================================
-- SPORTMAPS — Connected Accounts F0: contención del fallback a ENV
-- ------------------------------------------------------------
-- Ref: docs/payments-connected-accounts-fase0-cierre.md §2 ter. Fecha: 2026-07-30
--
-- CONTEXTO (hallazgo 2026-07-29): las llaves WOMPI_* del ENV del BFF NO son de
-- SportMaps — son de una escuela real (Dynasty). El resolver cae a ENV cuando una
-- escuela no tiene config propia, así que CUALQUIER otra escuela que cobre online
-- le manda el dinero a la cuenta comercial de Dynasty.
--
-- La migración 20260714000004 marcó a TODAS las escuelas como payment_mode='aggregator'
-- bajo la premisa (falsa) de que ENV eran las llaves globales de SportMaps. Esta
-- migración corrige esa clasificación:
--
--   • Escuela con transacción real de pasarela  → sigue 'aggregator' (no romperla).
--   • Todas las demás                            → 'unset' = BLOQUEADA (fail-closed).
--
-- El bloqueo efectivo lo aplica el resolver del BFF, que a partir de este cambio
-- trata 'unset' como "sin credenciales" en vez de caer a ENV.
--
-- Migraciones inmutables: NO se edita 20260714000004; esto es corrección posterior.
--
-- NOTA: sin CREATE TEMP TABLE ni RAISE NOTICE a propósito. El pooler de Supabase
-- puede servir cada statement desde otra sesión (la temp table se pierde: "relation
-- ... does not exist") y el SQL Editor no muestra la salida de NOTICE. El reporte va
-- como SELECT final, que sí se ve.
-- ============================================================

BEGIN;

-- ── 1. Reclasificar: solo quien YA cobró por pasarela conserva el acceso a ENV ──
--
-- Discriminador: provider_transaction_id / wompi_transaction_id. NO se usa
-- payments.payment_provider — la migración 20260504000001 le puso DEFAULT 'wompi' y
-- backfill con COALESCE, así que está poblada incluso en pagos en efectivo y daría
-- un falso positivo para casi toda escuela.

UPDATE public.schools s
   SET payment_mode = 'unset'
 WHERE s.payment_mode = 'aggregator'
   AND NOT EXISTS (
       SELECT 1
         FROM public.payments p
        WHERE p.school_id = s.id
          AND (p.provider_transaction_id IS NOT NULL
               OR p.wompi_transaction_id IS NOT NULL)
   );

COMMENT ON COLUMN public.schools.payment_mode IS
  'unset|direct|aggregator. unset = BLOQUEADA (fail-closed, el resolver no cae a ENV). '
  'direct = cuenta propia conectada (secretos cifrados en payment_provider_secrets). '
  'aggregator = usa las llaves WOMPI_*/MP_* del ENV del BFF — que HOY son de una escuela '
  'real, no de SportMaps: transitorio hasta migrar esa escuela a direct.';

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ── 2. Reporte: quién conserva acceso a las llaves de ENV ──────────────────────
--
-- Se espera EXACTAMENTE UNA fila (Dynasty). Si sale más de una, hubo cobros ruteados
-- a la cuenta equivocada: revisar a dónde fue el dinero de cada una antes de seguir
-- (ver docs/payments-connected-accounts-fase0-cierre.md §2 ter).

SELECT s.id,
       s.name,
       s.payment_mode,
       count(p.id) FILTER (
           WHERE p.provider_transaction_id IS NOT NULL
              OR p.wompi_transaction_id IS NOT NULL
       ) AS txs_pasarela
  FROM public.schools s
  JOIN public.payments p ON p.school_id = s.id
 GROUP BY s.id, s.name, s.payment_mode
HAVING count(p.id) FILTER (
           WHERE p.provider_transaction_id IS NOT NULL
              OR p.wompi_transaction_id IS NOT NULL
       ) > 0
 ORDER BY txs_pasarela DESC;
