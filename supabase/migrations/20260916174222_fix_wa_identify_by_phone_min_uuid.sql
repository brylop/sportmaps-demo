-- =============================================================================
-- 20260916174222_fix_wa_identify_by_phone_min_uuid.sql
-- Autor: brylop   Fecha: 2026-09-16   Versión anterior: 20260916163755
-- Objetivo: wa_identify_by_phone reventaba al identificar. Nadie podía entrar.
-- =============================================================================
-- SÍNTOMA
--
--   ERROR 42883: function min(uuid) does not exist
--
-- Encontrado al ejercitar la función contra un número real, antes de la
-- primera prueba con WhatsApp. En PostgreSQL `min()` no está definido para
-- uuid — el tipo tiene orden (se puede ORDER BY) pero no agregado de mínimo.
-- Compila igual porque plpgsql no resuelve las funciones del cuerpo hasta que
-- la línea se ejecuta: el error solo aparece cuando un acudiente que SÍ tiene
-- cuenta escribe, que es justo el camino feliz.
--
-- Efecto real: los 346 acudientes de Dynasty con cuenta no se habrían
-- identificado nunca. No es silencioso —el BFF loguea y cae al camino del
-- correo— pero para el papá es el bot pidiéndole un correo que no debería
-- necesitar.
--
-- FIX
--
-- Se separa contar de elegir. `array_agg(DISTINCT ...)` sí existe para uuid, y
-- deja la cuenta y el candidato en una sola pasada sin inventar un orden que
-- no significa nada: cuando hay más de uno la función no elige, escala.
--
-- El resto del cuerpo queda idéntico al de 20260916163755.
-- =============================================================================

BEGIN;

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
    v_ids        uuid[];
    v_parent_id  uuid;
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
    -- hay acudientes con el fijo cargado, y los 10 dígitos de un fijo pueden
    -- chocar contra el celular de otra persona.
    IF v_tel !~ '^3[0-9]{9}$' THEN
        RETURN jsonb_build_object('estado', 'desconocido', 'motivo', 'no_es_celular');
    END IF;

    -- Tener el número no basta: hay que ser acudiente de un atleta ACTIVO de
    -- ESTA escuela. Sin ese segundo filtro, el acudiente de otra escuela
    -- entraría a ver los pagos de esta.
    SELECT array_agg(DISTINCT p.id) INTO v_ids
    FROM public.profiles p
    WHERE right(regexp_replace(coalesce(p.phone,''), '[^0-9]', '', 'g'), 10) = v_tel
      AND EXISTS (
            SELECT 1 FROM public.children c
            WHERE c.parent_id = p.id
              AND c.school_id = v_school_id
              AND c.is_active
      );

    -- Dos cuentas con el mismo número no se desempatan solas. Elegir mal acá es
    -- mostrarle a alguien los pagos de otra familia: lo resuelve un humano.
    IF coalesce(array_length(v_ids, 1), 0) > 1 THEN
        RETURN jsonb_build_object('estado', 'ambiguo', 'motivo', 'varias_cuentas_mismo_numero');
    END IF;

    IF coalesce(array_length(v_ids, 1), 0) = 1 THEN
        v_parent_id := v_ids[1];

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

    SELECT EXISTS (
        SELECT 1 FROM public.children c
        WHERE c.school_id = v_school_id
          AND c.is_active
          AND right(regexp_replace(coalesce(c.parent_phone_temp,''), '[^0-9]', '', 'g'), 10) = v_tel
    ) INTO v_es_familia;

    IF v_es_familia THEN
        -- Sin el nombre del atleta: quien hoy tenga ese número no es
        -- necesariamente el acudiente, y decírselo ya es entregar un dato de
        -- un menor.
        RETURN jsonb_build_object('estado', 'debe_registrarse');
    END IF;

    RETURN jsonb_build_object('estado', 'desconocido', 'motivo', 'sin_coincidencia');
END;
$function$;

-- CREATE OR REPLACE conserva los privilegios, pero se reafirman: si alguna vez
-- esta función se recrea con DROP + CREATE, quedaría con los default
-- privileges del esquema, que otorgan EXECUTE a `authenticated`.
REVOKE ALL ON FUNCTION public.wa_identify_by_phone(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wa_identify_by_phone(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.wa_identify_by_phone(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.wa_identify_by_phone(uuid, text) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
