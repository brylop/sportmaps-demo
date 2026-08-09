-- Migration: 20260809095613_llaves_de_pago_multiples.sql
-- Description: Una escuela puede registrar VARIAS llaves de pago (Bre-B, Nequi,
-- Daviplata, llaves de otros bancos) en vez de una sola por canal.
--
-- Contexto: hasta hoy cada canal era una columna suelta en school_settings, asi
-- que la segunda Bre-B obligaba a pisar la primera. Peor: el validador de
-- comprobantes (check 4, DESTINO_NO_COINCIDE) compara el destino leido por el
-- OCR contra esas columnas, de modo que un pago hecho a la llave desplazada
-- salia ROJO como "cuenta ajena".
--
-- Esta migracion:
--   1. Versiona las columnas DRIFT (breb_number, transfer_key, daviplata_number):
--      existen en la base pero ninguna migracion las creaba, y el BFF ya las leia
--      en un SELECT aparte justamente por eso (receipt-context.service.ts).
--   2. Agrega school_settings.payment_accounts jsonb = lista ordenada de llaves.
--   3. Backfilea la lista desde las columnas actuales, sin duplicar breb_key vs
--      breb_number cuando traen el mismo valor.
--   4. Expone la lista en get_school_payment_info para el checkout del acudiente.
--
-- Las columnas viejas NO se borran: quedan como lectura de respaldo mientras
-- convivan clientes desplegados que aun no leen la lista, y el guardado del panel
-- sigue sincronizando la primera llave de cada tipo hacia ellas.
--
-- Forma de cada elemento de payment_accounts:
--   { "id": uuid, "type": "breb|nequi|daviplata|transfer_key",
--     "label": "Bre-B principal", "value": "@dynasty", "active": true }

BEGIN;

-- ============================================================
-- 1. Columnas drift -> versionadas
-- ============================================================

ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS daviplata_number text,
    ADD COLUMN IF NOT EXISTS breb_number      text,
    ADD COLUMN IF NOT EXISTS transfer_key     text;

COMMENT ON COLUMN public.school_settings.daviplata_number IS
    'LEGACY. Primera llave Daviplata; la fuente real es payment_accounts.';
COMMENT ON COLUMN public.school_settings.breb_number IS
    'LEGACY. Primera llave Bre-B; la fuente real es payment_accounts.';
COMMENT ON COLUMN public.school_settings.transfer_key IS
    'LEGACY. Primera llave de transferencia; la fuente real es payment_accounts.';


-- ============================================================
-- 2. payment_accounts
-- ============================================================

ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS payment_accounts jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'school_settings_payment_accounts_is_array'
    ) THEN
        ALTER TABLE public.school_settings
            ADD CONSTRAINT school_settings_payment_accounts_is_array
            CHECK (jsonb_typeof(payment_accounts) = 'array');
    END IF;
END $$;

COMMENT ON COLUMN public.school_settings.payment_accounts IS
    'Llaves de pago de la escuela, en el orden en que se muestran al acudiente. '
    'Cada elemento: {id, type: breb|nequi|daviplata|transfer_key, label, value, active}. '
    'Fuente unica: la ve el acudiente en el checkout y contra ella compara el OCR (check 4).';


-- ============================================================
-- 3. Backfill desde las columnas de hoy
--
-- Solo toca filas con la lista vacia, asi que re-ejecutarla no duplica nada.
-- breb_key y breb_number suelen traer el mismo valor escrito distinto
-- ("300 555 1411" vs "3005551411"): el DISTINCT ON normaliza igual que
-- normalizeDestination() en el BFF para quedarse con uno solo.
-- ============================================================

WITH src AS (
    SELECT s.school_id,
           v.kind,
           v.lbl,
           btrim(v.val) AS val,
           v.ord
      FROM public.school_settings s
      CROSS JOIN LATERAL (VALUES
          ('nequi',        s.nequi_number,     'Nequi',                  1),
          ('daviplata',    s.daviplata_number, 'Daviplata',              2),
          ('breb',         s.breb_number,      'Bre-B',                  3),
          ('breb',         s.breb_key,         'Bre-B',                  4),
          ('transfer_key', s.transfer_key,     'Llave de transferencia', 5)
      ) AS v(kind, val, lbl, ord)
     WHERE s.payment_accounts = '[]'::jsonb
       AND v.val IS NOT NULL
       AND btrim(v.val) <> ''
),
dedup AS (
    SELECT DISTINCT ON (school_id, kind, upper(regexp_replace(val, '[\s.-]', '', 'g')))
           school_id, kind, lbl, val, ord
      FROM src
     ORDER BY school_id,
              kind,
              upper(regexp_replace(val, '[\s.-]', '', 'g')),
              ord
),
agg AS (
    SELECT school_id,
           jsonb_agg(
               jsonb_build_object(
                   'id',     gen_random_uuid(),
                   'type',   kind,
                   'label',  lbl,
                   'value',  val,
                   'active', true
               )
               ORDER BY ord
           ) AS accounts
      FROM dedup
     GROUP BY school_id
)
UPDATE public.school_settings ss
   SET payment_accounts = agg.accounts
  FROM agg
 WHERE ss.school_id = agg.school_id;


-- ============================================================
-- 4. get_school_payment_info: devolver la lista
--
-- La RPC ya bypaseaba la RLS "staff only" para el checkout. Se le agrega
-- payment_accounts y, de paso, breb_number/transfer_key: hasta hoy no salian
-- por aca, asi que el acudiente que entraba por el checkout publico nunca veia
-- la Bre-B ni la llave de transferencia de la escuela.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_school_payment_info(
    p_school_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_data jsonb;
    v_public_profile_enabled boolean;
BEGIN
    -- Gate: solo exponer info de escuelas que optaron por perfil publico.
    -- Si no es publica, devuelve null; el checkout no debe ser accesible.
    SELECT public_profile_enabled
    INTO v_public_profile_enabled
    FROM school_settings
    WHERE school_id = p_school_id;

    IF NOT COALESCE(v_public_profile_enabled, false) THEN
        RETURN NULL;
    END IF;

    SELECT jsonb_build_object(
        -- Manual: cuenta bancaria + llaves
        'bank_name',            ss.bank_name,
        'bank_account_type',    ss.bank_account_type,
        'bank_account_number',  ss.bank_account_number,
        'payment_accounts',     COALESCE(ss.payment_accounts, '[]'::jsonb),
        -- Legacy: respaldo para clientes desplegados que aun no leen la lista
        'nequi_number',         ss.nequi_number,
        'daviplata_number',     ss.daviplata_number,
        'breb_number',          ss.breb_number,
        'transfer_key',         ss.transfer_key,
        'bank_titular_name',    ss.bank_titular_name,
        'bank_titular_id',      ss.bank_titular_id,
        'payment_qr_url',       ss.payment_qr_url,
        -- Gateways online
        'epayco_enabled',       COALESCE(ss.epayco_enabled, false),
        'sportmaps_pay_enabled', ss.sportmaps_pay_terms_accepted_at IS NOT NULL,
        -- UX
        'fee_payer',            ss.fee_payer,
        'require_payment_proof', COALESCE(ss.require_payment_proof, true)
    )
    INTO v_data
    FROM school_settings ss
    WHERE ss.school_id = p_school_id;

    RETURN v_data;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_school_payment_info(uuid) TO authenticated, anon;

COMMENT ON FUNCTION public.get_school_payment_info(uuid) IS
    'Expone datos de pago publicos para checkout (cuenta bancaria + payment_accounts + flags de gateway). Solo responde si la escuela tiene public_profile_enabled=true.';

COMMIT;

NOTIFY pgrst, 'reload schema';
