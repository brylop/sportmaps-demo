-- =============================================================================
-- 20260916163755_whatsapp_identificar_por_telefono.sql
-- Autor: brylop   Fecha: 2026-09-16   Versión anterior: 20260916112304
-- Objetivo: identificar al acudiente por el NÚMERO desde el que escribe, y
--           mandar a registrarse a quien no tenga cuenta.
-- =============================================================================
-- POR QUÉ
--
-- Hoy el bot identifica pidiendo el correo y mandando un código. Medido en
-- Dynasty el 2026-09-16: de 502 atletas activos, 156 no tienen ninguna cuenta
-- de acudiente. Para esas familias el camino del correo no existe — escriben
-- un correo que no está en `profiles`, el código nunca sale, y el bot igual
-- responde «te envié un código» (a propósito, para no revelar quién está
-- registrado). La conversación se muere ahí y el papá cree que fallamos.
--
-- Por teléfono, en cambio, el 100% es alcanzable: 346 entran directo y 156
-- quedan reconocidos como familia de la escuela y se les pide crear la cuenta.
--
-- SOBRE LA FUERZA DE ESTA IDENTIDAD
--
-- El `from` de un mensaje de WhatsApp lo autentica Meta: el cliente no puede
-- falsificarlo. Así que "el número que escribe" es un dato verificado, no una
-- afirmación del usuario — es al menos tan fuerte como el OTP por correo, que
-- depende de que la bandeja no esté comprometida. Lo que NO cubre es el cambio
-- de dueño del número (SIM swap, línea reciclada); ese riesgo se acepta, es el
-- mismo de cualquier canal de WhatsApp, y por eso este camino solo da LECTURA
-- de los pagos del propio acudiente.
--
-- QUÉ NO HACE
--
-- No entrega ningún dato. Devuelve un veredicto y, cuando corresponde, deja la
-- conversación vinculada. Quien no tenga cuenta NO recibe información de
-- ningún tipo — ni el nombre del atleta, que sería decirle a quien tenga ese
-- teléfono de quién es familia.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · SET search_path obligatorio en toda función nueva.
--   · GRANT EXECUTE explícito: SECURITY DEFINER no exime al caller.
-- =============================================================================

BEGIN;

-- ── Índices para el cruce ───────────────────────────────────────────────────
-- Se busca por los ÚLTIMOS 10 DÍGITOS: en la base conviven '3001234567',
-- '+573001234567' y '573001234567' para el mismo celular. Comparar el texto
-- crudo no cruza nada, y por eso los índices van sobre la expresión normalizada.
CREATE INDEX IF NOT EXISTS idx_profiles_tel10
    ON public.profiles (right(regexp_replace(coalesce(phone,''), '[^0-9]', '', 'g'), 10))
    WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_children_tel10
    ON public.children (school_id, right(regexp_replace(coalesce(parent_phone_temp,''), '[^0-9]', '', 'g'), 10))
    WHERE parent_phone_temp IS NOT NULL;

-- ── La función ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.wa_identify_by_phone(
    p_integration_id uuid,
    p_contact_wa_id  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_school_id  uuid;
    v_tel        text;
    v_parent_id  uuid;
    v_cuantos    int;
    v_es_familia boolean;
BEGIN
    SELECT school_id INTO v_school_id
    FROM public.school_whatsapp_integrations
    WHERE id = p_integration_id;

    IF v_school_id IS NULL THEN
        RETURN jsonb_build_object('estado', 'desconocido', 'motivo', 'integracion_inexistente');
    END IF;

    v_tel := right(regexp_replace(coalesce(p_contact_wa_id, ''), '[^0-9]', '', 'g'), 10);

    -- Un celular colombiano son 10 dígitos y arranca en 3. Un fijo NO se cruza:
    -- medido en Dynasty, hay acudientes con el fijo cargado, y un fijo de Bogotá
    -- termina en 10 dígitos que podrían chocar contra el celular de otro.
    IF v_tel !~ '^3[0-9]{9}$' THEN
        RETURN jsonb_build_object('estado', 'desconocido', 'motivo', 'no_es_celular');
    END IF;

    -- ── 1. ¿Hay una CUENTA con ese número, que además sea acudiente acá? ────
    -- El doble filtro es el que importa: tener el número no basta, hay que ser
    -- acudiente de un atleta activo de ESTA escuela. Sin eso, el acudiente de
    -- otra escuela entraría a ver los pagos de esta.
    SELECT count(DISTINCT p.id), min(p.id)
      INTO v_cuantos, v_parent_id
    FROM public.profiles p
    WHERE right(regexp_replace(coalesce(p.phone,''), '[^0-9]', '', 'g'), 10) = v_tel
      AND EXISTS (
            SELECT 1 FROM public.children c
            WHERE c.parent_id = p.id
              AND c.school_id = v_school_id
              AND c.is_active
      );

    -- Dos cuentas distintas con el mismo número no se desempatan solas. Antes
    -- que adivinar de quién es, se trata como desconocido y lo ve un humano:
    -- elegir mal acá es mostrarle a alguien los pagos de otra familia.
    IF v_cuantos > 1 THEN
        RETURN jsonb_build_object('estado', 'ambiguo', 'motivo', 'varias_cuentas_mismo_numero');
    END IF;

    IF v_cuantos = 1 THEN
        UPDATE public.whatsapp_conversations
           SET parent_id  = v_parent_id,
               identified = true,
               updated_at = now()
         WHERE integration_id = p_integration_id
           AND contact_wa_id  = p_contact_wa_id;

        INSERT INTO public.whatsapp_identifications (
            integration_id, contact_wa_id, parent_id, email,
            otp_hash, otp_expires_at, attempts, verified_at, updated_at
        ) VALUES (
            p_integration_id, p_contact_wa_id, v_parent_id, NULL,
            NULL, NULL, 0, now(), now()
        )
        ON CONFLICT (integration_id, contact_wa_id) DO UPDATE SET
            parent_id   = EXCLUDED.parent_id,
            verified_at = now(),
            updated_at  = now();

        RETURN jsonb_build_object('estado', 'identificado', 'parent_id', v_parent_id);
    END IF;

    -- ── 2. ¿Es familia de la escuela aunque no tenga cuenta? ────────────────
    SELECT EXISTS (
        SELECT 1 FROM public.children c
        WHERE c.school_id = v_school_id
          AND c.is_active
          AND right(regexp_replace(coalesce(c.parent_phone_temp,''), '[^0-9]', '', 'g'), 10) = v_tel
    ) INTO v_es_familia;

    IF v_es_familia THEN
        -- NO se devuelve el nombre del atleta. Quien tenga hoy ese número no es
        -- necesariamente el acudiente, y decirle de quién es familia ya es
        -- entregar un dato de un menor.
        RETURN jsonb_build_object('estado', 'debe_registrarse');
    END IF;

    RETURN jsonb_build_object('estado', 'desconocido', 'motivo', 'sin_coincidencia');
END;
$function$;

-- Solo la llama el BFF. No hay razón para exponerla a `authenticated`: recibe
-- un integration_id y devuelve si un teléfono es de la escuela — con acceso
-- libre sería un oráculo para saber qué números pertenecen a qué escuela.
REVOKE ALL ON FUNCTION public.wa_identify_by_phone(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wa_identify_by_phone(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.wa_identify_by_phone(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.wa_identify_by_phone(uuid, text) TO service_role;

COMMENT ON FUNCTION public.wa_identify_by_phone(uuid, text) IS
  'Identifica al acudiente por el numero de WhatsApp desde el que escribe (ultimos 10 digitos). '
  'Devuelve identificado | debe_registrarse | ambiguo | desconocido. No entrega ningun dato del atleta.';

COMMIT;

NOTIFY pgrst, 'reload schema';
