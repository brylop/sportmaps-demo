-- =============================================================================
-- 20260922130832_wa_identify_mira_tambien_sin_registrar.sql
-- Autor: brylop   Fecha: 2026-09-22   Version anterior: 20260922130717
-- Objetivo: que el bot reconozca como FAMILIA al papa cuyo atleta esta en
--           `unregistered_athletes`, en vez de saludarlo como a un extrano.
-- =============================================================================
-- El veredicto `debe_registrarse` solo miraba `children.parent_phone_temp`. El
-- papa de Besser —cuyos 38 atletas viven en `unregistered_athletes`— caia en
-- `desconocido`: saludo neutro, sin enlace de registro, sin decirle que es de
-- la escuela. Quedaba peor que antes de conectar el canal.
--
-- Ahora, si el numero no resuelve a una cuenta, se pregunta tambien por los sin
-- registrar antes de rendirse. El orden importa: la cuenta manda, y solo si no
-- hay cuenta se mira si al menos es familia conocida.
--
-- El resto del cuerpo queda identico a 20260916174222.
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

    -- Un fijo NO se cruza: hay acudientes con el fijo cargado y sus 10 digitos
    -- pueden chocar contra el celular de otra persona.
    IF v_tel !~ '^3[0-9]{9}$' THEN
        RETURN jsonb_build_object('estado', 'desconocido', 'motivo', 'no_es_celular');
    END IF;

    -- Tener el numero no basta: hay que ser acudiente de un atleta ACTIVO de
    -- ESTA escuela. Sin ese segundo filtro, el acudiente de otra escuela entra
    -- a ver los pagos de esta.
    SELECT array_agg(DISTINCT p.id) INTO v_ids
    FROM public.profiles p
    WHERE right(regexp_replace(coalesce(p.phone,''), '[^0-9]', '', 'g'), 10) = v_tel
      AND EXISTS (
            SELECT 1 FROM public.children c
            WHERE c.parent_id = p.id AND c.school_id = v_school_id AND c.is_active
      );

    -- Dos cuentas con el mismo numero no se desempatan solas: elegir mal es
    -- mostrarle a alguien los pagos de otra familia.
    IF coalesce(array_length(v_ids, 1), 0) > 1 THEN
        RETURN jsonb_build_object('estado', 'ambiguo', 'motivo', 'varias_cuentas_mismo_numero');
    END IF;

    IF coalesce(array_length(v_ids, 1), 0) = 1 THEN
        v_parent_id := v_ids[1];

        UPDATE public.whatsapp_conversations
           SET parent_id = v_parent_id, identified = true, updated_at = now()
         WHERE integration_id = p_integration_id AND contact_wa_id = p_contact_wa_id;

        INSERT INTO public.whatsapp_identifications (
            integration_id, contact_wa_id, parent_id, email,
            otp_hash, otp_expires_at, attempts, verified_at, updated_at
        ) VALUES (
            p_integration_id, p_contact_wa_id, v_parent_id, NULL,
            NULL, NULL, 0, now(), now()
        )
        ON CONFLICT (integration_id, contact_wa_id) DO UPDATE SET
            parent_id = EXCLUDED.parent_id, verified_at = now(), updated_at = now();

        RETURN jsonb_build_object('estado', 'identificado', 'parent_id', v_parent_id);
    END IF;

    -- ¿Es familia aunque no tenga cuenta? Primero por `children`…
    SELECT EXISTS (
        SELECT 1 FROM public.children c
        WHERE c.school_id = v_school_id
          AND c.is_active
          AND right(regexp_replace(coalesce(c.parent_phone_temp,''), '[^0-9]', '', 'g'), 10) = v_tel
    ) INTO v_es_familia;

    -- …y si no, por los atletas cargados que nunca se registraron. Sin esto el
    -- papa de Besser caia en `desconocido` y ni sabia que podia registrarse.
    IF NOT v_es_familia THEN
        v_es_familia := public.wa_es_familia_sin_registrar(v_school_id, p_contact_wa_id);
    END IF;

    IF v_es_familia THEN
        -- Sin el nombre del atleta: quien tenga hoy ese numero no es
        -- necesariamente el acudiente, y decirselo ya es entregar un dato de un
        -- menor.
        RETURN jsonb_build_object('estado', 'debe_registrarse');
    END IF;

    RETURN jsonb_build_object('estado', 'desconocido', 'motivo', 'sin_coincidencia');
END;
$function$;

REVOKE ALL ON FUNCTION public.wa_identify_by_phone(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wa_identify_by_phone(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.wa_identify_by_phone(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.wa_identify_by_phone(uuid, text) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
