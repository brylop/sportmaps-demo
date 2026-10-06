-- Pegar COMPLETO en el SQL Editor.
-- 20261006104251: reemplaza a 20261005133534, que NUNCA se aplicó: falló en el SQL Editor con
-- 42883 «operator does not exist: uuid = uuid[]». `x = ANY ((SELECT fn()))` se lee
-- como subconsulta (filas de uuid[]); con `::uuid[]` es un arreglo y conserva el initplan.
-- Mismo contenido que 20261005133534 salvo ese cast (1 sitio/s). 20261005133534 NO se aplica.
-- =============================================================================
-- 20261006104251_factura_electronica_preferencia_pagador.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-05   Versión anterior: 20261005131059
-- Objetivo: que cada pagador diga si quiere factura electrónica a su nombre y,
-- si quiere, deje los datos con que se le emite — desde la app, desde el
-- enlace público /p/<token>, desde el correo del estado de cuenta (lleva a
-- /p/<token>) y desde el bot de WhatsApp.
-- Spec: docs/specs/factura-electronica-preferencia-y-datos-del-pagador.md
--
-- Por qué una tabla nueva y no más columnas en `profiles`:
--   · 141 de los ~490 pagadores de Dynasty (ago–oct 2026) NO tienen cuenta:
--     pagan por `children.parent_phone_temp`. Para ellos no hay perfil donde
--     escribir. La tabla admite dos dueños: un perfil, o (escuela, celular).
--   · Los datos del checkout (`profiles.document_*`, `billing_*`) se quedan
--     como están: los escribe BillingDetailsForm, los lee la emisión de hoy y
--     el panel de "datos fiscales faltantes". Esta tabla NO los pisa: un enlace
--     público reenviado no puede cambiar el documento del perfil de nadie.
--     La emisión usa esta tabla SOLO cuando la preferencia es 'quiere'.
--   · Nombre/razón social y correo de la factura pueden ser distintos de los
--     del perfil (factura a nombre de la empresa del papá): profiles no los
--     tiene.
--
-- Seguridad (CLAUDE.md):
--   · RLS activa. SELECT: el dueño ve su fila; la administración de la
--     escuela (user_admin_school_ids, sin coaches: el coach no toca dinero)
--     ve las de sus pagadores. NINGUNA policy de escritura: todo pasa por RPC
--     (validación de documento/correo en un solo lugar).
--   · Nada a anon. REVOKE explícito a anon/authenticated (trampa 3).
--   · El formulario público escribe por RPC SECURITY DEFINER que recibe el
--     TOKEN (trampa 5), solo invocable por service_role (la llama el BFF con
--     rate limit).
--   · Estados en text + CHECK.
--
-- Y una tabla chica para el estado del flujo del bot (pide los datos uno por
-- uno; tiene que sobrevivir entre mensajes y vencer a las 24 h).
--
-- NO APLICADA. Hasta que se aplique el BFF degrada solo: sin tabla, la
-- emisión sigue exactamente como hoy (la consulta falla → se ignora), la
-- página /p/<token> esconde el bloque de factura y el bot contesta que lo
-- revise con la escuela.
-- =============================================================================

BEGIN;

-- ── 1. Preferencia y datos de facturación del pagador ──────────────────────
CREATE TABLE IF NOT EXISTS public.payer_billing_profiles (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Dueño A: pagador con cuenta.
    profile_id      uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    -- Dueño B: pagador SIN cuenta, por escuela + celular (últimos 10 dígitos,
    -- el mismo cruce de wa_identify_by_phone: arranca en 3, un fijo no cruza).
    school_id       uuid REFERENCES public.schools(id) ON DELETE CASCADE,
    phone10         text CHECK (phone10 ~ '^3[0-9]{9}$'),
    -- sin_respuesta → no ha dicho nada (default); la emisión sigue como hoy.
    -- quiere        → factura a su nombre con los datos de esta fila.
    -- no_quiere     → no se le vuelven a pedir datos; la emisión sigue como
    --                 hoy salvo que el facturador tenga consumidor_final=true.
    preference      text NOT NULL DEFAULT 'sin_respuesta'
                    CHECK (preference IN ('quiere', 'no_quiere', 'sin_respuesta')),
    document_type   text CHECK (document_type IN ('CC', 'CE', 'NIT', 'PASAPORTE', 'TI', 'RC')),
    -- Normalizado: sin puntos ni espacios; NIT sin dígito de verificación (lo
    -- calcula la DIAN, igual que en BillingDetailsForm).
    document_number text CHECK (document_number ~ '^[0-9A-Z]{4,20}$'),
    -- Nombre de la persona o razón social de la empresa (NIT).
    legal_name      text CHECK (char_length(btrim(legal_name)) BETWEEN 3 AND 200),
    invoice_email   text CHECK (char_length(invoice_email) <= 254
                                AND invoice_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$'),
    address         text CHECK (char_length(address) <= 200),
    -- Código DANE de 5 dígitos (municipality_code de Factus V2). Opcional: sin
    -- él decide la política de municipio del facturador (fallback del emisor).
    city_dane       text CHECK (city_dane ~ '^[0-9]{5}$'),
    department      text CHECK (char_length(department) <= 100),
    source          text NOT NULL
                    CHECK (source IN ('app', 'enlace_publico', 'whatsapp', 'escuela')),
    answered_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT payer_billing_profiles_un_dueno CHECK (
        (profile_id IS NOT NULL AND school_id IS NULL AND phone10 IS NULL)
        OR (profile_id IS NULL AND school_id IS NOT NULL AND phone10 IS NOT NULL)
    ),
    -- 'quiere' sin documento ni nombre no sirve para facturar: no se acepta.
    CONSTRAINT payer_billing_profiles_quiere_completo CHECK (
        preference <> 'quiere'
        OR (document_type IS NOT NULL AND document_number IS NOT NULL AND legal_name IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payer_billing_profiles_profile
    ON public.payer_billing_profiles (profile_id) WHERE profile_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payer_billing_profiles_school_phone
    ON public.payer_billing_profiles (school_id, phone10) WHERE profile_id IS NULL;

COMMENT ON TABLE public.payer_billing_profiles IS
    'Preferencia de factura electrónica del pagador (quiere/no_quiere/sin_respuesta) y sus datos fiscales. '
    'Dueño: profile_id, o (school_id, phone10) para pagadores sin cuenta. Escritura SOLO por RPC '
    '(factura_pagador_*). La emisión la usa solo con preference=quiere; si no, sigue con profiles.';

ALTER TABLE public.payer_billing_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payer_billing_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.payer_billing_profiles TO authenticated;
GRANT ALL ON TABLE public.payer_billing_profiles TO service_role;

-- ¿Este perfil le paga a alguna escuela que administra quien consulta?
-- SECURITY DEFINER: lee payments sin depender del RLS de payments, y así la
-- policy de abajo no hace SELECT sobre su propia tabla (sin self-recursion).
CREATE OR REPLACE FUNCTION public.factura_pagador_visible_para_admin(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT p_profile_id IS NOT NULL AND (
        public.is_super_admin()
        OR EXISTS (
            SELECT 1 FROM public.payments p
             WHERE (p.parent_id = p_profile_id OR p.user_id = p_profile_id)
               AND p.school_id = ANY (public.user_admin_school_ids())
        )
    );
$$;
REVOKE ALL ON FUNCTION public.factura_pagador_visible_para_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.factura_pagador_visible_para_admin(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS payer_billing_profiles_select_propio ON public.payer_billing_profiles;
CREATE POLICY payer_billing_profiles_select_propio ON public.payer_billing_profiles
    FOR SELECT TO authenticated
    USING (profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS payer_billing_profiles_select_admin ON public.payer_billing_profiles;
CREATE POLICY payer_billing_profiles_select_admin ON public.payer_billing_profiles
    FOR SELECT TO authenticated
    USING (
        (school_id IS NOT NULL AND school_id = ANY ((SELECT public.user_admin_school_ids())::uuid[]))
        OR (profile_id IS NOT NULL AND public.factura_pagador_visible_para_admin(profile_id))
    );

-- ── 2. Normalizar y validar (un solo lugar; el BFF y el frontend lo espejan) ─
-- Devuelve el código de error o NULL. Mismas reglas que BillingDetailsForm:
-- rangos permisivos a propósito (un documento válido rechazado deja a una
-- familia sin factura; uno raro que pase lo ataja la DIAN).
CREATE OR REPLACE FUNCTION public.factura_pagador_error_de_datos(
    p_tipo text, p_numero text, p_nombre text, p_correo text, p_ciudad text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_min int; v_max int; v_digitos boolean;
BEGIN
    IF p_tipo IS NULL OR p_tipo NOT IN ('CC', 'CE', 'NIT', 'PASAPORTE', 'TI', 'RC') THEN
        RETURN 'tipo_documento_invalido';
    END IF;
    v_digitos := p_tipo IN ('CC', 'TI', 'RC', 'NIT');
    SELECT CASE p_tipo WHEN 'CC' THEN 5 WHEN 'TI' THEN 6 WHEN 'RC' THEN 6 WHEN 'NIT' THEN 6
                       WHEN 'CE' THEN 4 ELSE 5 END,
           CASE p_tipo WHEN 'CC' THEN 10 WHEN 'TI' THEN 11 WHEN 'RC' THEN 11 WHEN 'NIT' THEN 10
                       WHEN 'CE' THEN 15 ELSE 20 END
      INTO v_min, v_max;
    IF p_numero IS NULL
       OR (v_digitos AND p_numero !~ '^[0-9]+$')
       OR (NOT v_digitos AND p_numero !~ '^[0-9A-Z]+$')
       OR char_length(p_numero) NOT BETWEEN v_min AND v_max THEN
        RETURN 'documento_invalido';
    END IF;
    IF p_nombre IS NULL OR char_length(btrim(p_nombre)) NOT BETWEEN 3 AND 200 THEN
        RETURN 'nombre_invalido';
    END IF;
    IF p_correo IS NOT NULL
       AND (char_length(p_correo) > 254 OR p_correo !~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$') THEN
        RETURN 'correo_invalido';
    END IF;
    IF p_ciudad IS NOT NULL AND p_ciudad !~ '^[0-9]{5}$' THEN
        RETURN 'municipio_invalido';
    END IF;
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.factura_pagador_error_de_datos(text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.factura_pagador_error_de_datos(text, text, text, text, text) TO service_role;

-- ── 3. Guardar (núcleo, solo service_role) ──────────────────────────────────
-- Con 'no_quiere'/'sin_respuesta' NO se borran los datos que ya hubiera: si
-- mañana dice que sí, no tiene que volver a escribirlos.
CREATE OR REPLACE FUNCTION public.factura_pagador_upsert(
    p_profile_id  uuid,
    p_school_id   uuid,
    p_phone10     text,
    p_preferencia text,
    p_tipo        text,
    p_numero      text,
    p_nombre      text,
    p_correo      text,
    p_direccion   text,
    p_ciudad      text,
    p_depto       text,
    p_fuente      text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_tipo   text := upper(nullif(btrim(coalesce(p_tipo, '')), ''));
    v_numero text := upper(regexp_replace(coalesce(p_numero, ''), '[[:space:].,'']', '', 'g'));
    v_nombre text := nullif(regexp_replace(btrim(coalesce(p_nombre, '')), '[[:space:]]+', ' ', 'g'), '');
    v_correo text := lower(nullif(btrim(coalesce(p_correo, '')), ''));
    v_dir    text := nullif(btrim(coalesce(p_direccion, '')), '');
    v_ciudad text := nullif(btrim(coalesce(p_ciudad, '')), '');
    v_depto  text := nullif(btrim(coalesce(p_depto, '')), '');
    v_tel    text := right(regexp_replace(coalesce(p_phone10, ''), '[^0-9]', '', 'g'), 10);
    v_err    text;
    v_id     uuid;
BEGIN
    IF p_preferencia NOT IN ('quiere', 'no_quiere', 'sin_respuesta') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'preferencia_invalida');
    END IF;
    IF p_fuente NOT IN ('app', 'enlace_publico', 'whatsapp', 'escuela') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'fuente_invalida');
    END IF;
    IF p_profile_id IS NULL AND (p_school_id IS NULL OR v_tel !~ '^3[0-9]{9}$') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'sin_pagador');
    END IF;
    -- NIT pegado con su DV ("900123456-7" o "9001234567"): se guarda sin el
    -- DV, que calcula la DIAN (misma regla que BillingDetailsForm). Diez
    -- dígitos que arrancan en 8 o 9 no son una cédula (las de 10 son NUIP y
    -- empiezan en 1): el último es el DV escrito sin guion.
    IF v_tipo = 'NIT' AND v_numero ~ '^[0-9]+[-][0-9]$' THEN
        v_numero := split_part(v_numero, '-', 1);
    ELSIF v_tipo = 'NIT' AND v_numero ~ '^[89][0-9]{9}$' THEN
        v_numero := left(v_numero, 9);
    END IF;
    v_numero := replace(v_numero, '-', '');
    IF v_numero = '' THEN v_numero := NULL; END IF;
    IF v_ciudad ~ '^[0-9]{4}$' THEN v_ciudad := '0' || v_ciudad; END IF;

    IF p_preferencia = 'quiere' THEN
        v_err := public.factura_pagador_error_de_datos(v_tipo, v_numero, v_nombre, v_correo, v_ciudad);
        IF v_err IS NOT NULL THEN
            RETURN jsonb_build_object('ok', false, 'error', v_err);
        END IF;
    END IF;

    IF p_profile_id IS NOT NULL THEN
        INSERT INTO public.payer_billing_profiles AS b
            (profile_id, preference, document_type, document_number, legal_name, invoice_email,
             address, city_dane, department, source, answered_at)
        VALUES (p_profile_id, p_preferencia,
                CASE WHEN p_preferencia = 'quiere' THEN v_tipo END,
                CASE WHEN p_preferencia = 'quiere' THEN v_numero END,
                CASE WHEN p_preferencia = 'quiere' THEN v_nombre END,
                CASE WHEN p_preferencia = 'quiere' THEN v_correo END,
                CASE WHEN p_preferencia = 'quiere' THEN v_dir END,
                CASE WHEN p_preferencia = 'quiere' THEN v_ciudad END,
                CASE WHEN p_preferencia = 'quiere' THEN v_depto END,
                p_fuente,
                CASE WHEN p_preferencia <> 'sin_respuesta' THEN now() END)
        ON CONFLICT (profile_id) WHERE profile_id IS NOT NULL DO UPDATE SET
            preference      = EXCLUDED.preference,
            document_type   = CASE WHEN EXCLUDED.preference = 'quiere' THEN EXCLUDED.document_type   ELSE b.document_type   END,
            document_number = CASE WHEN EXCLUDED.preference = 'quiere' THEN EXCLUDED.document_number ELSE b.document_number END,
            legal_name      = CASE WHEN EXCLUDED.preference = 'quiere' THEN EXCLUDED.legal_name      ELSE b.legal_name      END,
            invoice_email   = CASE WHEN EXCLUDED.preference = 'quiere' THEN EXCLUDED.invoice_email   ELSE b.invoice_email   END,
            address         = CASE WHEN EXCLUDED.preference = 'quiere' THEN EXCLUDED.address         ELSE b.address         END,
            city_dane       = CASE WHEN EXCLUDED.preference = 'quiere' THEN EXCLUDED.city_dane       ELSE b.city_dane       END,
            department      = CASE WHEN EXCLUDED.preference = 'quiere' THEN EXCLUDED.department      ELSE b.department      END,
            source          = EXCLUDED.source,
            answered_at     = coalesce(EXCLUDED.answered_at, b.answered_at),
            updated_at      = now()
        RETURNING b.id INTO v_id;
    ELSE
        INSERT INTO public.payer_billing_profiles AS b
            (school_id, phone10, preference, document_type, document_number, legal_name, invoice_email,
             address, city_dane, department, source, answered_at)
        VALUES (p_school_id, v_tel, p_preferencia,
                CASE WHEN p_preferencia = 'quiere' THEN v_tipo END,
                CASE WHEN p_preferencia = 'quiere' THEN v_numero END,
                CASE WHEN p_preferencia = 'quiere' THEN v_nombre END,
                CASE WHEN p_preferencia = 'quiere' THEN v_correo END,
                CASE WHEN p_preferencia = 'quiere' THEN v_dir END,
                CASE WHEN p_preferencia = 'quiere' THEN v_ciudad END,
                CASE WHEN p_preferencia = 'quiere' THEN v_depto END,
                p_fuente,
                CASE WHEN p_preferencia <> 'sin_respuesta' THEN now() END)
        ON CONFLICT (school_id, phone10) WHERE profile_id IS NULL DO UPDATE SET
            preference      = EXCLUDED.preference,
            document_type   = CASE WHEN EXCLUDED.preference = 'quiere' THEN EXCLUDED.document_type   ELSE b.document_type   END,
            document_number = CASE WHEN EXCLUDED.preference = 'quiere' THEN EXCLUDED.document_number ELSE b.document_number END,
            legal_name      = CASE WHEN EXCLUDED.preference = 'quiere' THEN EXCLUDED.legal_name      ELSE b.legal_name      END,
            invoice_email   = CASE WHEN EXCLUDED.preference = 'quiere' THEN EXCLUDED.invoice_email   ELSE b.invoice_email   END,
            address         = CASE WHEN EXCLUDED.preference = 'quiere' THEN EXCLUDED.address         ELSE b.address         END,
            city_dane       = CASE WHEN EXCLUDED.preference = 'quiere' THEN EXCLUDED.city_dane       ELSE b.city_dane       END,
            department      = CASE WHEN EXCLUDED.preference = 'quiere' THEN EXCLUDED.department      ELSE b.department      END,
            source          = EXCLUDED.source,
            answered_at     = coalesce(EXCLUDED.answered_at, b.answered_at),
            updated_at      = now()
        RETURNING b.id INTO v_id;
    END IF;

    RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.factura_pagador_upsert(uuid, uuid, text, text, text, text, text, text, text, text, text, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.factura_pagador_upsert(uuid, uuid, text, text, text, text, text, text, text, text, text, text)
    TO service_role;

-- ── 4. Guardar lo propio desde la app (authenticated) ──────────────────────
-- La identidad sale de auth.uid(), nunca de un parámetro: se llama desde el
-- frontend con el JWT del acudiente (ver gotcha "RPC desde el BFF").
CREATE OR REPLACE FUNCTION public.factura_pagador_guardar_mio(
    p_preferencia text,
    p_tipo        text DEFAULT NULL,
    p_numero      text DEFAULT NULL,
    p_nombre      text DEFAULT NULL,
    p_correo      text DEFAULT NULL,
    p_direccion   text DEFAULT NULL,
    p_ciudad      text DEFAULT NULL,
    p_depto       text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_uid uuid := auth.uid();
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
    END IF;
    RETURN public.factura_pagador_upsert(v_uid, NULL, NULL, p_preferencia, p_tipo, p_numero,
                                         p_nombre, p_correo, p_direccion, p_ciudad, p_depto, 'app');
END;
$$;
REVOKE ALL ON FUNCTION public.factura_pagador_guardar_mio(text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.factura_pagador_guardar_mio(text, text, text, text, text, text, text, text) TO authenticated;

-- ── 5. ¿Quién paga este cobro? (la cascada de los cuatro caminos) ──────────
-- parent_id → user_id → acudiente sin cuenta por children.parent_phone_temp →
-- atleta sin invitar por unregistered_athletes.guardian_phone/phone. Para los
-- dos últimos solo vale un CELULAR (arranca en 3): un fijo podría cruzar con
-- el celular de otra familia.
CREATE OR REPLACE FUNCTION public.factura_pagador_de_cobro(p_payment_id uuid)
RETURNS TABLE (profile_id uuid, school_id uuid, phone10 text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_p   record;
    v_tel text;
BEGIN
    SELECT p.parent_id, p.user_id, p.child_id, p.unregistered_athlete_id, p.school_id
      INTO v_p FROM public.payments p WHERE p.id = p_payment_id;
    IF NOT FOUND THEN RETURN; END IF;

    IF coalesce(v_p.parent_id, v_p.user_id) IS NOT NULL THEN
        RETURN QUERY SELECT coalesce(v_p.parent_id, v_p.user_id), NULL::uuid, NULL::text;
        RETURN;
    END IF;

    IF v_p.child_id IS NOT NULL THEN
        SELECT right(regexp_replace(coalesce(c.parent_phone_temp, ''), '[^0-9]', '', 'g'), 10)
          INTO v_tel FROM public.children c WHERE c.id = v_p.child_id;
    ELSIF v_p.unregistered_athlete_id IS NOT NULL THEN
        SELECT right(regexp_replace(coalesce(u.guardian_phone, u.phone, ''), '[^0-9]', '', 'g'), 10)
          INTO v_tel FROM public.unregistered_athletes u WHERE u.id = v_p.unregistered_athlete_id;
    END IF;

    IF v_tel ~ '^3[0-9]{9}$' AND v_p.school_id IS NOT NULL THEN
        RETURN QUERY SELECT NULL::uuid, v_p.school_id, v_tel;
    END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.factura_pagador_de_cobro(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.factura_pagador_de_cobro(uuid) TO service_role;

-- Token vigente → payment_id. NO suma open_count (eso lo hace el resolver de
-- la página); acá solo se lee o se guarda la preferencia.
CREATE OR REPLACE FUNCTION public.factura_pagador_cobro_del_token(p_token text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT t.payment_id
      FROM public.payment_public_tokens t
     WHERE p_token ~ '^[A-Za-z0-9_-]{24}$'
       AND t.token = p_token
       AND t.status IN ('active', 'replaced')
       AND t.expires_at > now();
$$;
REVOKE ALL ON FUNCTION public.factura_pagador_cobro_del_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.factura_pagador_cobro_del_token(text) TO service_role;

-- ── 6. Leer por token (lo que ve /p/<token>) ───────────────────────────────
-- Devuelve SOLO un resumen enmascarado: quien tenga el enlace (puede haberse
-- reenviado) no debe leer el documento ni el correo completos de nadie.
CREATE OR REPLACE FUNCTION public.factura_pagador_por_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_pago   uuid := public.factura_pagador_cobro_del_token(p_token);
    v_d_perfil  uuid;
    v_d_escuela uuid;
    v_d_tel     text;
    v_fila   public.payer_billing_profiles%ROWTYPE;
    -- Texto y no record: en la rama sin cuenta no se asigna, y leer un campo
    -- de un record sin asignar revienta ("record is not assigned yet").
    v_perfil_tipo text;
    v_perfil_doc  text;
    v_doc    text;
    v_tipo   text;
BEGIN
    IF v_pago IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'token_invalido');
    END IF;
    SELECT d.profile_id, d.school_id, d.phone10 INTO v_d_perfil, v_d_escuela, v_d_tel
      FROM public.factura_pagador_de_cobro(v_pago) d;
    IF v_d_perfil IS NULL AND v_d_tel IS NULL THEN
        RETURN jsonb_build_object('ok', true, 'pagador', false);
    END IF;

    IF v_d_perfil IS NOT NULL THEN
        SELECT * INTO v_fila FROM public.payer_billing_profiles b WHERE b.profile_id = v_d_perfil;
        SELECT pr.document_type, pr.document_number INTO v_perfil_tipo, v_perfil_doc
          FROM public.profiles pr WHERE pr.id = v_d_perfil;
    ELSE
        SELECT * INTO v_fila FROM public.payer_billing_profiles b
         WHERE b.profile_id IS NULL AND b.school_id = v_d_escuela AND b.phone10 = v_d_tel;
    END IF;

    v_tipo := coalesce(v_fila.document_type, v_perfil_tipo);
    v_doc  := coalesce(v_fila.document_number, nullif(regexp_replace(coalesce(v_perfil_doc, ''), '[[:space:]]', '', 'g'), ''));

    RETURN jsonb_build_object(
        'ok', true,
        'pagador', true,
        'preferencia', coalesce(v_fila.preference, 'sin_respuesta'),
        'tieneDatos', v_doc IS NOT NULL,
        'tipoDocumento', CASE WHEN v_doc IS NOT NULL THEN v_tipo END,
        'documentoTermina', CASE WHEN v_doc IS NOT NULL THEN right(v_doc, 4) END,
        'correoEnmascarado', CASE WHEN v_fila.invoice_email IS NOT NULL
            THEN left(v_fila.invoice_email, 2) || '•••@' || split_part(v_fila.invoice_email, '@', 2) END
    );
END;
$$;
REVOKE ALL ON FUNCTION public.factura_pagador_por_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.factura_pagador_por_token(text) TO service_role;

-- ── 7. Guardar por token (formulario de /p/<token>) ────────────────────────
CREATE OR REPLACE FUNCTION public.factura_pagador_guardar_por_token(
    p_token       text,
    p_preferencia text,
    p_tipo        text DEFAULT NULL,
    p_numero      text DEFAULT NULL,
    p_nombre      text DEFAULT NULL,
    p_correo      text DEFAULT NULL,
    p_direccion   text DEFAULT NULL,
    p_ciudad      text DEFAULT NULL,
    p_depto       text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_pago      uuid := public.factura_pagador_cobro_del_token(p_token);
    v_d_perfil  uuid;
    v_d_escuela uuid;
    v_d_tel     text;
BEGIN
    IF v_pago IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'token_invalido');
    END IF;
    SELECT d.profile_id, d.school_id, d.phone10 INTO v_d_perfil, v_d_escuela, v_d_tel
      FROM public.factura_pagador_de_cobro(v_pago) d;
    IF v_d_perfil IS NULL AND v_d_tel IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'sin_pagador');
    END IF;
    RETURN public.factura_pagador_upsert(v_d_perfil, v_d_escuela, v_d_tel,
                                         p_preferencia, p_tipo, p_numero, p_nombre, p_correo,
                                         p_direccion, p_ciudad, p_depto, 'enlace_publico');
END;
$$;
REVOKE ALL ON FUNCTION public.factura_pagador_guardar_por_token(text, text, text, text, text, text, text, text, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.factura_pagador_guardar_por_token(text, text, text, text, text, text, text, text, text)
    TO service_role;

-- ── 8. Estado del flujo del bot (captura paso a paso) ──────────────────────
-- Una fila por conversación con un flujo abierto. Solo service_role: lo que
-- se va tecleando (documento, correo) no se expone por PostgREST.
CREATE TABLE IF NOT EXISTS public.whatsapp_conversation_flows (
    conversation_id uuid PRIMARY KEY REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
    flow            text NOT NULL CHECK (flow IN ('factura_electronica')),
    step            text NOT NULL CHECK (step IN (
                        'preguntar_quiere', 'elegir_canal', 'tipo_documento', 'numero',
                        'nombre', 'correo', 'confirmar')),
    data            jsonb NOT NULL DEFAULT '{}'::jsonb,
    expires_at      timestamptz NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.whatsapp_conversation_flows IS
    'Flujo determinista abierto del bot por conversación (hoy: captura de datos de factura). Vence a las 24 h. Solo service_role.';
ALTER TABLE public.whatsapp_conversation_flows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.whatsapp_conversation_flows FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.whatsapp_conversation_flows TO service_role;

COMMIT;

-- Registro (SQL Editor no deja rastro):
-- insert into supabase_migrations.schema_migrations(version,name) values ('20261006104251','factura_electronica_pagador_v2') on conflict do nothing;
