-- Pegar COMPLETO en el SQL Editor de Supabase y ejecutar. Paso 1 de 3.

-- =============================================================================
-- 20261008163336_tienda_medios_por_defecto_y_cuentas_por_uso.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-08   Versión anterior: 20261008155459
-- Objetivo: la escuela administra los cobros y la entrega de SU tienda (primer
--   cliente: GYM RM). Hoy no hay pantalla de medios de pago, la tienda nace sin
--   medios (store_payment_methods devuelve []), una llave marcada «Solo para
--   inscripciones» aparece en la tienda, y el enlace público lleva el nombre del
--   DUEÑO (/tienda/robinson-mendoza) en vez del de la escuela (/tienda/gym-rm).
--
--   1. store_payment_settings gana tres columnas:
--        transfer_account_ids text[]  → qué llaves de la escuela se muestran
--                                       (NULL = todas las aptas, incluidas las
--                                       que se agreguen después)
--        allow_shipping       boolean → «solo retiro en sede» / «también envío»
--                                       (DEFAULT true = como hasta hoy; la
--                                       tienda escolar nace en false = solo retiro)
--        pickup_branch_ids    uuid[]  → sedes de retiro (NULL = todas las activas)
--   2. _store_school_accounts: las llaves de la escuela con su aptitud para la
--      tienda. NO aptas: apagadas, vacías, «Link de pago (Wompi)» (no es una
--      cuenta para transferir) y las restringidas por uso (`only_for`) que no
--      incluyen 'articulos' (p.ej. «Solo para inscripciones»).
--   3. _store_transfer_accounts respeta la aptitud y la selección de la tienda.
--   4. set_store_payment_settings acepta y valida las tres columnas nuevas.
--   5. store_payment_methods publica además la modalidad de entrega y las sedes
--      de retiro (sin números de cuenta).
--   6. Trigger en orders (BEFORE INSERT): una orden con envío en una tienda que
--      no envía → SHIPPING_NOT_OFFERED; sede fuera de las de retiro →
--      INVALID_PICKUP_BRANCH (si es la sede por defecto, se cambia por la primera
--      sede permitida). Trigger y no cambio de create_cart_order para no pisar
--      otras migraciones de la misma semana que redefinen el motor de la orden.
--   7. enable_school_store: crea la fila de medios por defecto (transferencia si
--      hay llaves aptas + efectivo al retirar + solo retiro) y alinea el slug.
--   8. Slug de la tienda escolar = slug de la escuela (gym-rm). El slug viejo
--      queda en store_slug_aliases y el BFF lo resuelve (/marketplace/vendor/:slug):
--      los enlaces ya compartidos siguen funcionando. generate_vendor_slug no
--      reparte un slug que es alias de otra tienda.
--   9. my_school_store(p_school_id): la tienda de MI escuela para quien la
--      administra (bug N0: el frontend la buscaba por user_id).
--      store_admin_settings: lo que la pantalla «Tienda → Ajustes → Cobros»
--      necesita en una lectura (estado de habilitación, llaves enmascaradas con
--      su aptitud, sedes, pasarelas conectadas, configuración).
--  10. Backfill: slug de los perfiles escolares existentes + fila de medios por
--      defecto para las tiendas escolares que pueden vender y no la tienen.
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

DO $pre$
BEGIN
    IF to_regclass('public.store_payment_settings') IS NULL
       OR to_regprocedure('public.enable_school_store(uuid)') IS NULL
       OR to_regprocedure('public._store_transfer_accounts(uuid)') IS NULL THEN
        RAISE EXCEPTION 'Faltan 20261003202431 / 20261003230013: aplicarlas antes.';
    END IF;
END
$pre$;

-- ─── 1. Columnas nuevas de store_payment_settings ────────────────────────────
ALTER TABLE public.store_payment_settings
    ADD COLUMN IF NOT EXISTS transfer_account_ids text[] NULL,
    ADD COLUMN IF NOT EXISTS allow_shipping boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS pickup_branch_ids uuid[] NULL;
-- DEFAULT true = sin restricción, como hasta hoy (filas existentes y filas que
-- otros caminos crean sin nombrar la columna). La tienda ESCOLAR nace en «solo
-- retiro en sede» porque enable_school_store y el backfill lo fijan explícito.

COMMENT ON COLUMN public.store_payment_settings.transfer_account_ids IS
  'Ids de school_settings.payment_accounts (o ''cuenta_bancaria'' para la cuenta legacy) que la tienda muestra. NULL = todas las aptas.';
COMMENT ON COLUMN public.store_payment_settings.allow_shipping IS
  'false = solo retiro en sede; true = también envío a domicilio.';
COMMENT ON COLUMN public.store_payment_settings.pickup_branch_ids IS
  'Sedes de retiro (school_branches). NULL = todas las activas.';

-- ─── 2. Alias de slugs (enlaces ya compartidos) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.store_slug_aliases (
    slug              text PRIMARY KEY CHECK (slug ~ '^[a-z0-9][a-z0-9-]*$'),
    vendor_profile_id uuid NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
    created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS store_slug_aliases_vp_idx ON public.store_slug_aliases (vendor_profile_id);
ALTER TABLE public.store_slug_aliases ENABLE ROW LEVEL SECURITY;   -- sin policies: solo el BFF
REVOKE ALL ON public.store_slug_aliases FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.store_slug_aliases TO service_role;

COMMENT ON TABLE public.store_slug_aliases IS
  'Slugs anteriores de una tienda. El BFF resuelve /tienda/:slug primero por vendor_profiles.slug y después aquí.';

-- generate_vendor_slug: igual que antes, pero sin repartir un alias ajeno.
-- Pasa a SECURITY DEFINER: el alta de vendedor la dispara `authenticated`, que
-- no lee store_slug_aliases (y la unicidad debe mirar todas las filas, no solo
-- las que su RLS le deja ver).
CREATE OR REPLACE FUNCTION public.generate_vendor_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_base_slug text;
    v_slug text;
    v_counter integer := 0;
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        v_base_slug := lower(regexp_replace(
            regexp_replace(NEW.display_name, '[^a-zA-Z0-9\s-]', '', 'g'),
            '\s+', '-', 'g'
        ));
        v_base_slug := regexp_replace(v_base_slug, '-+', '-', 'g');
        v_base_slug := trim(both '-' from v_base_slug);
        IF v_base_slug = '' THEN
            v_base_slug := 'vendor';
        END IF;

        v_slug := v_base_slug;
        WHILE EXISTS (SELECT 1 FROM public.vendor_profiles WHERE slug = v_slug AND id != NEW.id)
           OR EXISTS (SELECT 1 FROM public.store_slug_aliases a
                       WHERE a.slug = v_slug AND a.vendor_profile_id IS DISTINCT FROM NEW.id) LOOP
            v_counter := v_counter + 1;
            v_slug := v_base_slug || '-' || v_counter;
        END LOOP;

        NEW.slug := v_slug;
    END IF;
    RETURN NEW;
END;
$fn$;

-- ─── 3. Slug de la tienda escolar = slug de la escuela ───────────────────────
-- Interna. Devuelve el slug final. El viejo queda como alias. Si el
-- display_name es el nombre del dueño (perfil creado por el onboarding de
-- vendedor), pasa a ser el nombre de la escuela.
CREATE OR REPLACE FUNCTION public._store_sync_school_slug(p_vendor_profile_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_vp      public.vendor_profiles%ROWTYPE;
    v_school  record;
    v_owner   text;
    v_base    text;
    v_slug    text;
    v_n       integer := 0;
    v_trusted text := COALESCE(current_setting('sportmaps.trusted_rpc', true), '');
BEGIN
    SELECT * INTO v_vp FROM public.vendor_profiles WHERE id = p_vendor_profile_id;
    IF v_vp.id IS NULL OR v_vp.vendor_type::text <> 'school' OR v_vp.school_id IS NULL THEN
        RETURN v_vp.slug;
    END IF;
    SELECT id, name, slug, owner_id INTO v_school FROM public.schools WHERE id = v_vp.school_id;
    v_base := NULLIF(btrim(COALESCE(v_school.slug, '')), '');
    IF v_base IS NULL OR v_base !~ '^[a-z0-9][a-z0-9-]*$' THEN
        RETURN v_vp.slug;
    END IF;
    -- Ya alineado (gym-rm o gym-rm-2 si estaba ocupado).
    IF v_vp.slug = v_base OR v_vp.slug ~ ('^' || v_base || '-[0-9]+$') THEN
        RETURN v_vp.slug;
    END IF;

    v_slug := v_base;
    WHILE EXISTS (SELECT 1 FROM public.vendor_profiles WHERE slug = v_slug AND id <> v_vp.id)
       OR EXISTS (SELECT 1 FROM public.store_slug_aliases WHERE slug = v_slug AND vendor_profile_id <> v_vp.id) LOOP
        v_n := v_n + 1;
        v_slug := v_base || '-' || v_n;
    END LOOP;

    IF NULLIF(btrim(COALESCE(v_vp.slug, '')), '') IS NOT NULL
       AND v_vp.slug ~ '^[a-z0-9][a-z0-9-]*$' THEN
        INSERT INTO public.store_slug_aliases (slug, vendor_profile_id)
        VALUES (v_vp.slug, v_vp.id)
        ON CONFLICT (slug) DO NOTHING;
    END IF;
    DELETE FROM public.store_slug_aliases WHERE slug = v_slug AND vendor_profile_id = v_vp.id;

    SELECT p.full_name INTO v_owner FROM public.profiles p WHERE p.id = v_vp.user_id;

    PERFORM set_config('sportmaps.trusted_rpc', 'on', true);
    UPDATE public.vendor_profiles
       SET slug = v_slug,
           display_name = CASE
               WHEN v_owner IS NOT NULL
                AND lower(btrim(COALESCE(display_name, ''))) = lower(btrim(v_owner))
                AND NULLIF(btrim(COALESCE(v_school.name, '')), '') IS NOT NULL
               THEN btrim(v_school.name)
               ELSE display_name END,
           updated_at = now()
     WHERE id = v_vp.id;
    PERFORM set_config('sportmaps.trusted_rpc', v_trusted, true);
    RETURN v_slug;
END;
$fn$;

COMMENT ON FUNCTION public._store_sync_school_slug(uuid) IS
  'Tienda escolar: slug = slug de la escuela (gym-rm); el anterior queda en store_slug_aliases. Interna.';

-- ─── 4. Llaves de la escuela con su aptitud para la tienda ───────────────────
-- Interna (números completos). Cada elemento:
--   {id, type, label, value, bank, account_type, holder, holder_id, eligible, reason}
--   reason ∈ inactive | empty | payment_link | restricted | null
CREATE OR REPLACE FUNCTION public._store_school_accounts(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_ss  record;
    v_out jsonb := '[]'::jsonb;
BEGIN
    SELECT payment_accounts, bank_name, bank_account_type, bank_account_number,
           COALESCE(bank_account_holder, bank_titular_name) AS holder, bank_titular_id
      INTO v_ss
      FROM public.school_settings WHERE school_id = p_school_id;

    IF jsonb_typeof(v_ss.payment_accounts) = 'array' THEN
        SELECT COALESCE(jsonb_agg(x.acc || jsonb_build_object(
                   'eligible', x.reason IS NULL, 'reason', x.reason) ORDER BY x.ord), '[]'::jsonb)
          INTO v_out
          FROM (
            SELECT e.ord,
                   jsonb_strip_nulls(jsonb_build_object(
                       'id', COALESCE(NULLIF(btrim(e.a ->> 'id'), ''), 'pos-' || e.ord),
                       'type', e.a ->> 'type', 'label', e.a ->> 'label', 'value', btrim(COALESCE(e.a ->> 'value', '')),
                       'bank', e.a ->> 'bank', 'account_type', e.a ->> 'account_type',
                       'holder', e.a ->> 'holder', 'holder_id', e.a ->> 'holder_id')) AS acc,
                   CASE
                     WHEN NOT COALESCE((e.a ->> 'active')::boolean, true) THEN 'inactive'
                     WHEN NULLIF(btrim(COALESCE(e.a ->> 'value', '')), '') IS NULL THEN 'empty'
                     WHEN e.a ->> 'type' = 'payment_link' THEN 'payment_link'
                     WHEN jsonb_typeof(e.a -> 'only_for') = 'array'
                          AND jsonb_array_length(e.a -> 'only_for') > 0
                          AND NOT (e.a -> 'only_for') ? 'articulos' THEN 'restricted'
                   END AS reason
              FROM jsonb_array_elements(v_ss.payment_accounts) WITH ORDINALITY AS e(a, ord)
             WHERE jsonb_typeof(e.a) = 'object'
          ) x;
    END IF;

    -- Cuenta bancaria legacy: solo si su número no está ya en la lista (ni
    -- siquiera como llave restringida: no se cuela por la puerta de atrás).
    IF NULLIF(btrim(COALESCE(v_ss.bank_account_number, '')), '') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_out) x
                        WHERE x ->> 'value' = btrim(v_ss.bank_account_number)) THEN
        v_out := v_out || (jsonb_strip_nulls(jsonb_build_object(
            'id', 'cuenta_bancaria', 'type', 'bank', 'label', COALESCE(v_ss.bank_name, 'Cuenta bancaria'),
            'value', btrim(v_ss.bank_account_number), 'bank', v_ss.bank_name,
            'account_type', v_ss.bank_account_type, 'holder', v_ss.holder,
            'holder_id', v_ss.bank_titular_id)) || jsonb_build_object('eligible', true, 'reason', NULL));
    END IF;
    RETURN v_out;
END;
$fn$;

COMMENT ON FUNCTION public._store_school_accounts(uuid) IS
  'Llaves de la escuela con su aptitud para la tienda (only_for sin ''articulos'' = no apta). Interna: números completos.';

-- ─── 5. _store_transfer_accounts: aptitud + selección de la tienda ───────────
CREATE OR REPLACE FUNCTION public._store_transfer_accounts(p_vendor_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_vp  public.vendor_profiles%ROWTYPE;
    v_sel text[];
    v_out jsonb := '[]'::jsonb;
BEGIN
    SELECT * INTO v_vp FROM public.vendor_profiles WHERE id = p_vendor_profile_id;
    IF v_vp.id IS NULL THEN
        RETURN v_out;
    END IF;

    IF v_vp.vendor_type::text = 'school' AND v_vp.school_id IS NOT NULL THEN
        SELECT transfer_account_ids INTO v_sel
          FROM public.store_payment_settings WHERE vendor_profile_id = v_vp.id;
        SELECT COALESCE(jsonb_agg(a - 'eligible' - 'reason'), '[]'::jsonb)
          INTO v_out
          FROM jsonb_array_elements(public._store_school_accounts(v_vp.school_id)) a
         WHERE (a ->> 'eligible')::boolean
           AND (v_sel IS NULL OR (a ->> 'id') = ANY (v_sel));
        RETURN v_out;
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', b.id::text,
               'type', 'bank', 'label', b.bank_name, 'value', b.account_number, 'bank', b.bank_name,
               'account_type', b.account_type, 'holder', b.account_holder,
               'holder_id', b.document_number)) ORDER BY b.is_default DESC, b.created_at), '[]'::jsonb)
      INTO v_out
      FROM public.vendor_bank_accounts b
     WHERE b.vendor_profile_id = v_vp.id AND COALESCE(b.is_active, true);
    RETURN v_out;
END;
$fn$;

-- ─── 6. set_store_payment_settings con las columnas nuevas ───────────────────
CREATE OR REPLACE FUNCTION public.set_store_payment_settings(
    p_vendor_profile_id uuid, p_settings jsonb, p_actor uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_actor uuid := public._store_actor(p_actor);
    v_vp    public.vendor_profiles%ROWTYPE;
    v_cur   public.store_payment_settings%ROWTYPE;
    v_new   public.store_payment_settings%ROWTYPE;
    v_ids   text[];
    v_brs   uuid[];
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501';
    END IF;
    IF NOT public.can_manage_store_as(p_vendor_profile_id, v_actor) THEN
        RAISE EXCEPTION 'NOT_OWNER' USING ERRCODE = '42501';
    END IF;
    IF p_settings IS NULL OR jsonb_typeof(p_settings) <> 'object' THEN
        RAISE EXCEPTION 'INVALID_SETTINGS' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_vp FROM public.vendor_profiles WHERE id = p_vendor_profile_id;

    SELECT * INTO v_cur FROM public.store_payment_settings WHERE vendor_profile_id = p_vendor_profile_id FOR UPDATE;

    v_new.vendor_profile_id     := p_vendor_profile_id;
    v_new.accept_wompi          := COALESCE((p_settings ->> 'accept_wompi')::boolean, v_cur.accept_wompi, false);
    v_new.accept_mercadopago    := COALESCE((p_settings ->> 'accept_mercadopago')::boolean, v_cur.accept_mercadopago, false);
    v_new.accept_transfer       := COALESCE((p_settings ->> 'accept_transfer')::boolean, v_cur.accept_transfer, false);
    v_new.accept_cash_pickup    := COALESCE((p_settings ->> 'accept_cash_pickup')::boolean, v_cur.accept_cash_pickup, false);
    v_new.transfer_instructions := CASE WHEN p_settings ? 'transfer_instructions'
                                        THEN NULLIF(left(btrim(COALESCE(p_settings ->> 'transfer_instructions', '')), 1000), '')
                                        ELSE v_cur.transfer_instructions END;
    v_new.transfer_hold_hours   := COALESCE((p_settings ->> 'transfer_hold_hours')::integer, v_cur.transfer_hold_hours, 48);
    v_new.cash_hold_hours       := COALESCE((p_settings ->> 'cash_hold_hours')::integer, v_cur.cash_hold_hours, 48);
    v_new.allow_shipping        := COALESCE((p_settings ->> 'allow_shipping')::boolean, v_cur.allow_shipping, true);

    -- Llaves que se muestran: null = todas las aptas; lista = solo esas (y aptas).
    IF p_settings ? 'transfer_account_ids' THEN
        IF jsonb_typeof(p_settings -> 'transfer_account_ids') = 'null' THEN
            v_ids := NULL;
        ELSIF jsonb_typeof(p_settings -> 'transfer_account_ids') = 'array' THEN
            SELECT COALESCE(array_agg(DISTINCT btrim(x)), '{}'::text[]) INTO v_ids
              FROM jsonb_array_elements_text(p_settings -> 'transfer_account_ids') x
             WHERE btrim(x) <> '';
            IF v_vp.vendor_type::text <> 'school' OR v_vp.school_id IS NULL OR EXISTS (
                SELECT 1 FROM unnest(v_ids) i
                 WHERE NOT EXISTS (
                     SELECT 1 FROM jsonb_array_elements(public._store_school_accounts(v_vp.school_id)) a
                      WHERE a ->> 'id' = i AND (a ->> 'eligible')::boolean)) THEN
                RAISE EXCEPTION 'INVALID_TRANSFER_ACCOUNT' USING ERRCODE = '22023',
                      HINT = 'Solo se pueden elegir llaves activas de la escuela que no estén restringidas a otro uso.';
            END IF;
        ELSE
            RAISE EXCEPTION 'INVALID_SETTINGS' USING ERRCODE = '22023';
        END IF;
        v_new.transfer_account_ids := v_ids;
    ELSE
        v_new.transfer_account_ids := v_cur.transfer_account_ids;
    END IF;

    -- Sedes de retiro: null = todas las activas; lista = al menos una, de la escuela.
    IF p_settings ? 'pickup_branch_ids' THEN
        IF jsonb_typeof(p_settings -> 'pickup_branch_ids') = 'null' THEN
            v_brs := NULL;
        ELSIF jsonb_typeof(p_settings -> 'pickup_branch_ids') = 'array' THEN
            BEGIN
                SELECT COALESCE(array_agg(DISTINCT x::uuid), '{}'::uuid[]) INTO v_brs
                  FROM jsonb_array_elements_text(p_settings -> 'pickup_branch_ids') x;
            EXCEPTION WHEN invalid_text_representation THEN
                RAISE EXCEPTION 'INVALID_PICKUP_BRANCH' USING ERRCODE = '22023';
            END;
            IF cardinality(v_brs) = 0 THEN
                RAISE EXCEPTION 'PICKUP_BRANCH_REQUIRED' USING ERRCODE = '22023',
                      HINT = 'Elige al menos una sede de retiro.';
            END IF;
            IF v_vp.school_id IS NULL OR EXISTS (
                SELECT 1 FROM unnest(v_brs) b
                 WHERE NOT EXISTS (SELECT 1 FROM public.school_branches sb
                                    WHERE sb.id = b AND sb.school_id = v_vp.school_id
                                      AND COALESCE(sb.status, 'active') = 'active')) THEN
                RAISE EXCEPTION 'INVALID_PICKUP_BRANCH' USING ERRCODE = '22023';
            END IF;
        ELSE
            RAISE EXCEPTION 'INVALID_SETTINGS' USING ERRCODE = '22023';
        END IF;
        v_new.pickup_branch_ids := v_brs;
    ELSE
        v_new.pickup_branch_ids := v_cur.pickup_branch_ids;
    END IF;

    IF v_new.accept_wompi AND public._store_gateway_row(p_vendor_profile_id, 'wompi') IS NULL THEN
        RAISE EXCEPTION 'GATEWAY_NOT_CONFIGURED' USING ERRCODE = 'P0001', DETAIL = 'wompi';
    END IF;
    IF v_new.accept_mercadopago AND public._store_gateway_row(p_vendor_profile_id, 'mercadopago') IS NULL THEN
        RAISE EXCEPTION 'GATEWAY_NOT_CONFIGURED' USING ERRCODE = 'P0001', DETAIL = 'mercadopago';
    END IF;

    INSERT INTO public.store_payment_settings AS s (
        vendor_profile_id, accept_wompi, accept_mercadopago, accept_transfer, accept_cash_pickup,
        transfer_instructions, transfer_hold_hours, cash_hold_hours, transfer_account_ids,
        allow_shipping, pickup_branch_ids, updated_at, updated_by)
    VALUES (v_new.vendor_profile_id, v_new.accept_wompi, v_new.accept_mercadopago, v_new.accept_transfer,
            v_new.accept_cash_pickup, v_new.transfer_instructions, v_new.transfer_hold_hours,
            v_new.cash_hold_hours, v_new.transfer_account_ids, v_new.allow_shipping, v_new.pickup_branch_ids,
            now(), (SELECT p.id FROM public.profiles p WHERE p.id = v_actor))
    ON CONFLICT (vendor_profile_id) DO UPDATE
       SET accept_wompi = EXCLUDED.accept_wompi,
           accept_mercadopago = EXCLUDED.accept_mercadopago,
           accept_transfer = EXCLUDED.accept_transfer,
           accept_cash_pickup = EXCLUDED.accept_cash_pickup,
           transfer_instructions = EXCLUDED.transfer_instructions,
           transfer_hold_hours = EXCLUDED.transfer_hold_hours,
           cash_hold_hours = EXCLUDED.cash_hold_hours,
           transfer_account_ids = EXCLUDED.transfer_account_ids,
           allow_shipping = EXCLUDED.allow_shipping,
           pickup_branch_ids = EXCLUDED.pickup_branch_ids,
           updated_at = now(),
           updated_by = EXCLUDED.updated_by
    RETURNING * INTO v_new;

    -- Después de guardar la selección: la transferencia exige al menos una llave visible.
    IF v_new.accept_transfer AND jsonb_array_length(public._store_transfer_accounts(p_vendor_profile_id)) = 0 THEN
        RAISE EXCEPTION 'NO_TRANSFER_ACCOUNTS' USING ERRCODE = 'P0001';
    END IF;
    IF NOT (v_new.accept_wompi OR v_new.accept_mercadopago OR v_new.accept_transfer OR v_new.accept_cash_pickup) THEN
        RAISE EXCEPTION 'NO_PAYMENT_METHODS' USING ERRCODE = '22023',
              HINT = 'Deja al menos un medio de pago encendido.';
    END IF;

    RETURN to_jsonb(v_new);
END;
$fn$;

-- ─── 7. Sedes de retiro de una tienda (interna) ──────────────────────────────
CREATE OR REPLACE FUNCTION public._store_pickup_branches(p_vendor_profile_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
    SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', b.id, 'name', b.name, 'address', b.address, 'is_main', COALESCE(b.is_main, false)))
               ORDER BY b.is_main DESC NULLS LAST, b.created_at), '[]'::jsonb)
      FROM public.vendor_profiles vp
      JOIN public.school_branches b ON b.school_id = vp.school_id
      LEFT JOIN public.store_payment_settings s ON s.vendor_profile_id = vp.id
     WHERE vp.id = p_vendor_profile_id
       AND COALESCE(b.status, 'active') = 'active'
       AND (s.pickup_branch_ids IS NULL OR b.id = ANY (s.pickup_branch_ids));
$fn$;

-- ─── 8. store_payment_methods + modalidad de entrega ─────────────────────────
CREATE OR REPLACE FUNCTION public.store_payment_methods(p_vendor_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_s       public.store_payment_settings%ROWTYPE;
    v_methods jsonb := '[]'::jsonb;
    v_gw      jsonb;
    v_row     record;
    v_p       text;
    v_ful     jsonb;
BEGIN
    IF NOT public.store_seller_allowed(p_vendor_profile_id) THEN
        RETURN jsonb_build_object('vendor_profile_id', p_vendor_profile_id, 'allowed', false, 'methods', '[]'::jsonb);
    END IF;
    SELECT * INTO v_s FROM public.store_payment_settings WHERE vendor_profile_id = p_vendor_profile_id;
    -- Sin fila: sin restricción de entrega (comportamiento anterior).
    v_ful := jsonb_build_object(
        'pickup', true,
        'shipping', COALESCE(v_s.allow_shipping, true),
        'pickup_branches', public._store_pickup_branches(p_vendor_profile_id));
    IF v_s.vendor_profile_id IS NULL THEN
        RETURN jsonb_build_object('vendor_profile_id', p_vendor_profile_id, 'allowed', true,
                                  'methods', '[]'::jsonb, 'fulfillment', v_ful);
    END IF;

    FOREACH v_p IN ARRAY ARRAY['wompi', 'mercadopago'] LOOP
        IF (v_p = 'wompi' AND v_s.accept_wompi) OR (v_p = 'mercadopago' AND v_s.accept_mercadopago) THEN
            v_gw := public._store_gateway_row(p_vendor_profile_id, v_p);
            IF v_gw IS NOT NULL THEN
                IF v_gw ->> 'gateway_kind' = 'school' THEN
                    SELECT public_key, sandbox INTO v_row FROM public.school_payment_providers
                     WHERE id = (v_gw ->> 'gateway_id')::uuid;
                ELSE
                    SELECT public_key, sandbox INTO v_row FROM public.vendor_payment_providers
                     WHERE id = (v_gw ->> 'gateway_id')::uuid;
                END IF;
                v_methods := v_methods || jsonb_build_object('method', v_p, 'provider', v_p,
                                                             'public_key', v_row.public_key, 'sandbox', v_row.sandbox);
            END IF;
        END IF;
    END LOOP;
    IF v_s.accept_transfer AND jsonb_array_length(public._store_transfer_accounts(p_vendor_profile_id)) > 0 THEN
        v_methods := v_methods || jsonb_build_object('method', 'transfer', 'hold_hours', v_s.transfer_hold_hours,
                                                     'requires_receipt', true);
    END IF;
    IF v_s.accept_cash_pickup THEN
        v_methods := v_methods || jsonb_build_object('method', 'cash_pickup', 'hold_hours', v_s.cash_hold_hours,
                                                     'requires_pickup', true);
    END IF;

    RETURN jsonb_build_object('vendor_profile_id', p_vendor_profile_id, 'allowed', true,
                              'methods', v_methods, 'fulfillment', v_ful);
END;
$fn$;

-- ─── 9. Entrega en orders: envío y sedes según la tienda ─────────────────────
CREATE OR REPLACE FUNCTION public.fn_orders_store_fulfillment_policy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_s       public.store_payment_settings%ROWTYPE;
    v_school  uuid;
    v_default uuid;
    v_first   uuid;
BEGIN
    IF NEW.vendor_profile_id IS NULL OR NEW.fulfillment_mode IS NULL THEN
        RETURN NEW;
    END IF;
    SELECT * INTO v_s FROM public.store_payment_settings WHERE vendor_profile_id = NEW.vendor_profile_id;
    IF v_s.vendor_profile_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.fulfillment_mode = 'shipping' AND NOT v_s.allow_shipping THEN
        RAISE EXCEPTION 'SHIPPING_NOT_OFFERED' USING ERRCODE = 'P0001',
              HINT = 'Esta tienda solo entrega con retiro en sede.';
    END IF;

    IF NEW.fulfillment_mode = 'pickup' AND v_s.pickup_branch_ids IS NOT NULL
       AND cardinality(v_s.pickup_branch_ids) > 0
       AND (NEW.pickup_branch_id IS NULL OR NOT (NEW.pickup_branch_id = ANY (v_s.pickup_branch_ids))) THEN
        SELECT school_id INTO v_school FROM public.vendor_profiles WHERE id = NEW.vendor_profile_id;
        -- La sede que create_cart_order pone cuando el comprador no eligió.
        SELECT b.id INTO v_default FROM public.school_branches b
         WHERE b.school_id = v_school AND COALESCE(b.status, 'active') = 'active'
         ORDER BY b.is_main DESC NULLS LAST, b.created_at LIMIT 1;
        IF NEW.pickup_branch_id IS NOT NULL AND NEW.pickup_branch_id IS DISTINCT FROM v_default THEN
            RAISE EXCEPTION 'INVALID_PICKUP_BRANCH' USING ERRCODE = '22023';
        END IF;
        SELECT b.id INTO v_first FROM public.school_branches b
         WHERE b.school_id = v_school AND COALESCE(b.status, 'active') = 'active'
           AND b.id = ANY (v_s.pickup_branch_ids)
         ORDER BY b.is_main DESC NULLS LAST, b.created_at LIMIT 1;
        IF v_first IS NULL THEN
            RAISE EXCEPTION 'INVALID_PICKUP_BRANCH' USING ERRCODE = '22023';
        END IF;
        NEW.pickup_branch_id := v_first;
    END IF;
    RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.fn_orders_store_fulfillment_policy() IS
  'Orden de tienda: SHIPPING_NOT_OFFERED si la tienda es solo retiro; sede de retiro dentro de store_payment_settings.pickup_branch_ids.';

DROP TRIGGER IF EXISTS trg_orders_store_fulfillment_policy ON public.orders;
CREATE TRIGGER trg_orders_store_fulfillment_policy
    BEFORE INSERT ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.fn_orders_store_fulfillment_policy();

-- ─── 10. enable_school_store: medios por defecto + slug de la escuela ────────
CREATE OR REPLACE FUNCTION public.enable_school_store(p_school_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_uid    uuid := auth.uid();
    v_school record;
    v_vp     record;
    v_id     uuid;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    IF p_school_id IS NULL OR NOT (p_school_id = ANY (public.user_admin_school_ids())) THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501',
              HINT = 'Solo el dueño o un administrador de la escuela activa su tienda.';
    END IF;

    SELECT id, name, owner_id INTO v_school FROM public.schools WHERE id = p_school_id;
    IF v_school.id IS NULL OR v_school.owner_id IS NULL THEN
        RAISE EXCEPTION 'SCHOOL_WITHOUT_OWNER' USING ERRCODE = 'P0002';
    END IF;
    IF NOT COALESCE(public.has_entitlement(p_school_id, 'store'), false) THEN
        RAISE EXCEPTION 'ADDON_REQUIRED' USING ERRCODE = 'P0001',
              HINT = 'La escuela necesita el adicional Tienda.';
    END IF;

    PERFORM set_config('sportmaps.trusted_rpc', 'on', true);

    -- (a) la escuela ya tiene su perfil
    SELECT * INTO v_vp FROM public.vendor_profiles WHERE school_id = p_school_id FOR UPDATE;
    IF v_vp.id IS NULL THEN
        -- (b) el dueño ya tiene un perfil (UNIQUE(user_id), D-16)
        SELECT * INTO v_vp FROM public.vendor_profiles WHERE user_id = v_school.owner_id FOR UPDATE;
        IF v_vp.id IS NOT NULL
           AND (v_vp.vendor_type::text <> 'school'
                OR (v_vp.school_id IS NOT NULL AND v_vp.school_id <> p_school_id)) THEN
            PERFORM set_config('sportmaps.trusted_rpc', 'off', true);
            RAISE EXCEPTION 'OWNER_HAS_OTHER_VENDOR_PROFILE' USING ERRCODE = 'P0001',
                  HINT = 'El dueño ya tiene otro perfil de vendedor; se resuelve a mano (D-16).';
        END IF;
    END IF;

    IF v_vp.id IS NOT NULL THEN
        UPDATE public.vendor_profiles
           SET school_id           = p_school_id,
               is_active           = true,
               verification_status = 'verified',
               capabilities        = jsonb_set(COALESCE(capabilities, '{}'::jsonb),
                                               '{can_sell_products}', 'true'::jsonb, true),
               updated_at          = now()
         WHERE id = v_vp.id
        RETURNING id INTO v_id;
    ELSE
        INSERT INTO public.vendor_profiles (
            user_id, vendor_type, display_name, school_id, capabilities,
            verification_status, is_active
        ) VALUES (
            v_school.owner_id, 'school', COALESCE(v_school.name, 'Tienda'), p_school_id,
            jsonb_build_object('can_sell_products', true, 'can_sell_services', false),
            'verified', true
        )
        RETURNING id INTO v_id;
    END IF;

    -- Enlace con el nombre de la escuela (el anterior queda como alias).
    PERFORM public._store_sync_school_slug(v_id);
    PERFORM set_config('sportmaps.trusted_rpc', 'on', true);

    -- Medios por defecto (solo si la tienda no tiene configuración todavía):
    -- transferencia con las llaves aptas, efectivo al retirar, solo retiro.
    INSERT INTO public.store_payment_settings (
        vendor_profile_id, accept_wompi, accept_mercadopago, accept_transfer, accept_cash_pickup,
        transfer_instructions, transfer_hold_hours, cash_hold_hours, transfer_account_ids,
        allow_shipping, pickup_branch_ids, updated_at, updated_by)
    VALUES (
        v_id, false, false,
        EXISTS (SELECT 1 FROM jsonb_array_elements(public._store_school_accounts(p_school_id)) a
                 WHERE (a ->> 'eligible')::boolean),
        true,
        'Escribe la referencia del pedido en la descripción de la transferencia.',
        48, 48, NULL, false, NULL, now(),
        (SELECT p.id FROM public.profiles p WHERE p.id = v_uid))
    ON CONFLICT (vendor_profile_id) DO NOTHING;

    PERFORM set_config('sportmaps.trusted_rpc', 'off', true);
    RETURN v_id;
END;
$fn$;

COMMENT ON FUNCTION public.enable_school_store(uuid) IS
  'Tienda v2: crea o reusa la tienda (vendor_profile school) de la escuela, verificada (D-4), con slug de la escuela y medios por defecto (transferencia + efectivo + solo retiro). Owner/admin con addon store.';

-- ─── 11. Lectura para «Tienda → Ajustes → Cobros» ────────────────────────────
CREATE OR REPLACE FUNCTION public.store_admin_settings(p_vendor_profile_id uuid, p_actor uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_actor uuid := public._store_actor(p_actor);
    v_vp    public.vendor_profiles%ROWTYPE;
    v_s     public.store_payment_settings%ROWTYPE;
    v_allow uuid[];
    v_accs  jsonb := '[]'::jsonb;
    v_brs   jsonb := '[]'::jsonb;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501';
    END IF;
    IF NOT public.can_manage_store_as(p_vendor_profile_id, v_actor) THEN
        RAISE EXCEPTION 'NOT_OWNER' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_vp FROM public.vendor_profiles WHERE id = p_vendor_profile_id;
    SELECT * INTO v_s FROM public.store_payment_settings WHERE vendor_profile_id = p_vendor_profile_id;
    v_allow := public.store_pilot_allowlist();

    IF v_vp.vendor_type::text = 'school' AND v_vp.school_id IS NOT NULL THEN
        -- Valores enmascarados: la pantalla elige, no necesita el número completo.
        SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                   'id', a ->> 'id', 'type', a ->> 'type', 'label', a ->> 'label', 'bank', a ->> 'bank',
                   'value_masked', CASE WHEN length(a ->> 'value') > 4
                                        THEN '•••• ' || right(a ->> 'value', 4) ELSE a ->> 'value' END,
                   'reason', a ->> 'reason'))
                   || jsonb_build_object(
                   'eligible', (a ->> 'eligible')::boolean,
                   'selected', (a ->> 'eligible')::boolean
                               AND (v_s.transfer_account_ids IS NULL OR (a ->> 'id') = ANY (v_s.transfer_account_ids)))),
                   '[]'::jsonb)
          INTO v_accs
          FROM jsonb_array_elements(public._store_school_accounts(v_vp.school_id)) a;

        SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                   'id', b.id, 'name', b.name, 'address', b.address)) || jsonb_build_object(
                   'is_main', COALESCE(b.is_main, false),
                   'selected', v_s.pickup_branch_ids IS NULL OR b.id = ANY (v_s.pickup_branch_ids))
                   ORDER BY b.is_main DESC NULLS LAST, b.created_at), '[]'::jsonb)
          INTO v_brs
          FROM public.school_branches b
         WHERE b.school_id = v_vp.school_id AND COALESCE(b.status, 'active') = 'active';
    END IF;

    RETURN jsonb_build_object(
        'store', jsonb_build_object(
            'id', v_vp.id, 'slug', v_vp.slug, 'display_name', v_vp.display_name,
            'vendor_type', v_vp.vendor_type, 'school_id', v_vp.school_id),
        'status', jsonb_build_object(
            'selling', public.store_seller_allowed(v_vp.id),
            'store_enabled', public.store_enabled(),
            'in_pilot', v_allow IS NULL OR v_vp.id = ANY (v_allow),
            'addon', CASE WHEN v_vp.school_id IS NULL THEN NULL
                          ELSE COALESCE(public.has_entitlement(v_vp.school_id, 'store'), false) END,
            'operational', CASE WHEN v_vp.school_id IS NULL THEN NULL
                                ELSE public.school_is_operational(v_vp.school_id) IS TRUE END,
            'can_sell_products', v_vp.is_active
                                 AND COALESCE((v_vp.capabilities ->> 'can_sell_products')::boolean, false)),
        'settings', CASE WHEN v_s.vendor_profile_id IS NULL THEN NULL ELSE to_jsonb(v_s) - 'updated_by' END,
        'accounts', v_accs,
        'branches', v_brs,
        'gateways', jsonb_build_object(
            'wompi', public._store_gateway_row(v_vp.id, 'wompi') IS NOT NULL,
            'mercadopago', public._store_gateway_row(v_vp.id, 'mercadopago') IS NOT NULL));
END;
$fn$;

COMMENT ON FUNCTION public.store_admin_settings(uuid, uuid) IS
  'Pantalla Tienda → Ajustes → Cobros: estado de habilitación, llaves enmascaradas con aptitud, sedes, pasarelas conectadas y configuración. Solo quien administra la tienda.';

-- ─── 11b. La tienda de MI escuela (bug N0) ───────────────────────────────────
-- El frontend buscaba el perfil por vendor_profiles.user_id: un school_admin
-- que no es dueño no lo encontraba (y la RLS de vendor_profiles tampoco le deja
-- ver un perfil 'pending' ajeno). Esta lectura resuelve por ESCUELA y solo
-- responde a quien administra la tienda (can_manage_store: owner/admin, no coach).
CREATE OR REPLACE FUNCTION public.my_school_store(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_vp public.vendor_profiles%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL OR p_school_id IS NULL THEN
        RETURN NULL;
    END IF;
    SELECT * INTO v_vp FROM public.vendor_profiles WHERE school_id = p_school_id;
    IF v_vp.id IS NULL OR NOT public.can_manage_store(v_vp.id) THEN
        RETURN NULL;
    END IF;
    RETURN jsonb_build_object(
        'id', v_vp.id, 'user_id', v_vp.user_id, 'school_id', v_vp.school_id,
        'vendor_type', v_vp.vendor_type, 'display_name', v_vp.display_name, 'slug', v_vp.slug,
        'is_active', v_vp.is_active, 'verification_status', v_vp.verification_status,
        'capabilities', COALESCE(v_vp.capabilities, '{}'::jsonb),
        'selling', public.store_seller_allowed(v_vp.id));
END;
$fn$;

COMMENT ON FUNCTION public.my_school_store(uuid) IS
  'Tienda de la escuela p_school_id si el usuario de la sesión la administra (owner/admin, no coach). NULL si no. Bug N0.';

-- ─── 12. Backfill ────────────────────────────────────────────────────────────
-- (Lo corre postgres sin JWT: el guard de vendor_profiles lo deja pasar.)
DO $bf$
DECLARE
    r record;
BEGIN
    FOR r IN SELECT id FROM public.vendor_profiles
              WHERE vendor_type::text = 'school' AND school_id IS NOT NULL
              ORDER BY created_at
    LOOP
        PERFORM public._store_sync_school_slug(r.id);
    END LOOP;
END
$bf$;

INSERT INTO public.store_payment_settings (
    vendor_profile_id, accept_wompi, accept_mercadopago, accept_transfer, accept_cash_pickup,
    transfer_instructions, transfer_hold_hours, cash_hold_hours, transfer_account_ids,
    allow_shipping, pickup_branch_ids)
SELECT vp.id, false, false,
       EXISTS (SELECT 1 FROM jsonb_array_elements(public._store_school_accounts(vp.school_id)) a
                WHERE (a ->> 'eligible')::boolean),
       true,
       'Escribe la referencia del pedido en la descripción de la transferencia.',
       48, 48, NULL, false, NULL
  FROM public.vendor_profiles vp
 WHERE vp.vendor_type::text = 'school' AND vp.school_id IS NOT NULL
   AND COALESCE((vp.capabilities ->> 'can_sell_products')::boolean, false)
ON CONFLICT (vendor_profile_id) DO NOTHING;

-- ─── Grants ──────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public._store_sync_school_slug(uuid)              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._store_school_accounts(uuid)               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._store_pickup_branches(uuid)               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_orders_store_fulfillment_policy()       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.store_admin_settings(uuid, uuid)           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.my_school_store(uuid)                      FROM PUBLIC, anon, authenticated;
-- Redefinidas: se repiten los grants de 230013 / 202431 para no depender del estado previo.
REVOKE ALL ON FUNCTION public._store_transfer_accounts(uuid)             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_store_payment_settings(uuid, jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.store_payment_methods(uuid)                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enable_school_store(uuid)                  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_vendor_slug()                     FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public._store_sync_school_slug(uuid)                 TO service_role;
GRANT EXECUTE ON FUNCTION public._store_school_accounts(uuid)                  TO service_role;
GRANT EXECUTE ON FUNCTION public._store_pickup_branches(uuid)                  TO service_role;
GRANT EXECUTE ON FUNCTION public.store_admin_settings(uuid, uuid)              TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_school_store(uuid)                         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_store_payment_settings(uuid, jsonb, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.store_payment_methods(uuid)                   TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enable_school_store(uuid)                     TO authenticated, service_role;

COMMIT;

-- Registro (el SQL Editor no deja rastro en schema_migrations)
insert into supabase_migrations.schema_migrations (version, name, created_by)
values ('20261008163336', '20261008163336_tienda_medios_por_defecto_y_cuentas_por_uso', 'sql-editor 2026-10-08') on conflict (version) do nothing;
