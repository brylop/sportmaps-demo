-- =============================================================================
-- 20260922130717_wa_reconocer_atletas_sin_registrar.sql
-- Autor: brylop   Fecha: 2026-09-22   Versión anterior: 20260922123945
-- Objetivo: que el bot vea la TERCERA tabla de atletas. Hoy no la mira, y ahí
--           vive la mitad de la plataforma.
-- =============================================================================
-- EL HUECO
--
-- `wa_identify_by_phone` y `wa_invitacion_pendiente_por_telefono` solo miran
-- `children`. Pero hay atletas que la escuela cargó y nunca se convirtieron en
-- `children`: viven en `unregistered_athletes`. El bot no sabe que existen.
--
-- Medido el 2026-09-22 (activos, sin perfil vinculado):
--
--     Monster's Volley  125    GYM RM           125
--     The Blair          68    Besser            38
--
-- Para Besser eso es TODO su problema: sus 32 cobros abiertos sin pagador
-- ($10,2 M) no son de familias sin cuenta como en Dynasty — son de atletas que
-- el bot ni siquiera sabe que existen.
--
-- CADA ESCUELA LLENÓ UN CAMPO DISTINTO, Y ESTO ES LO QUE ROMPERÍA UN FIX INGENUO
--
--     Besser     → guardian_phone: 37   ·  phone: 0
--     GYM RM     → guardian_phone: 0    ·  phone: 32
--     The Blair  → guardian_phone: 0    ·  phone: 67
--     Monster's  → los dos llenos
--
-- Mirar UN solo campo funciona en una escuela y falla en la otra, en silencio.
-- Se miran los dos.
--
-- QUÉ PASA DESPUÉS (verificado, no asumido)
--
-- `accept_invitation_pro` SÍ migra el atleta sin registrar: lo busca por
-- `invitation_id` y, si no, por correo, y llama a
-- `migrate_unregistered_athlete_to_profile`. Y hay cobertura real:
-- Besser 38/38 con `invitation_id`, Monster's 125/125 con correo. O sea que el
-- camino de salida ya existe — lo único que faltaba era que el bot los viera.
-- =============================================================================

BEGIN;

-- El cruce por teléfono sobre los dos campos de contacto.
CREATE INDEX IF NOT EXISTS idx_unreg_athletes_tel_acudiente
    ON public.unregistered_athletes
       (school_id, right(regexp_replace(coalesce(guardian_phone,''), '[^0-9]', '', 'g'), 10))
    WHERE linked_profile_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_unreg_athletes_tel_atleta
    ON public.unregistered_athletes
       (school_id, right(regexp_replace(coalesce(phone,''), '[^0-9]', '', 'g'), 10))
    WHERE linked_profile_id IS NULL;

-- ── La invitación pendiente, ahora mirando también los sin registrar ────────
-- Reemplaza la de 20260922123945. Misma firma, mismo contrato: devuelve null si
-- no hay EXACTAMENTE una.
CREATE OR REPLACE FUNCTION public.wa_invitacion_pendiente_por_telefono(
    p_integration_id uuid,
    p_contact_wa_id  text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_school_id uuid;
    v_tel       text;
    v_ids       uuid[];
    v_inv       RECORD;
BEGIN
    SELECT school_id INTO v_school_id
    FROM public.school_whatsapp_integrations
    WHERE id = p_integration_id;

    IF v_school_id IS NULL THEN RETURN NULL; END IF;

    v_tel := right(regexp_replace(coalesce(p_contact_wa_id, ''), '[^0-9]', '', 'g'), 10);
    IF v_tel !~ '^3[0-9]{9}$' THEN RETURN NULL; END IF;

    SELECT array_agg(DISTINCT id) INTO v_ids
    FROM (
        -- (a) Atleta en `children` sin acudiente, cruzado por nombre contra la
        --     invitación pendiente. `invitations` no tiene child_id; se exige
        --     coincidencia EXACTA del nombre normalizado, porque un «parecido»
        --     acá es vincular al papá con el hijo de otra familia.
        SELECT i.id
        FROM public.children c
        JOIN public.invitations i
          ON i.school_id = c.school_id
         AND i.status = 'pending'
         AND btrim(regexp_replace(lower(translate(coalesce(i.child_name, ''),
                'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')), '[^a-z ]', '', 'g'))
           = btrim(regexp_replace(lower(translate(coalesce(c.full_name, ''),
                'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')), '[^a-z ]', '', 'g'))
        WHERE c.school_id = v_school_id
          AND c.is_active
          AND c.parent_id IS NULL
          AND right(regexp_replace(coalesce(c.parent_phone_temp, ''), '[^0-9]', '', 'g'), 10) = v_tel

        UNION

        -- (b) Atleta en `unregistered_athletes`. Acá el vínculo con la
        --     invitación es una FK REAL (`invitation_id`), no un nombre: es más
        --     confiable que (a). Se miran los DOS teléfonos porque cada escuela
        --     llenó uno distinto — Besser el del acudiente, GYM RM el del
        --     atleta. Mirar uno solo falla en la otra escuela, en silencio.
        SELECT ua.invitation_id
        FROM public.unregistered_athletes ua
        JOIN public.invitations i
          ON i.id = ua.invitation_id AND i.status = 'pending'
        WHERE ua.school_id = v_school_id
          AND ua.is_active
          AND ua.linked_profile_id IS NULL
          AND (
                right(regexp_replace(coalesce(ua.guardian_phone, ''), '[^0-9]', '', 'g'), 10) = v_tel
             OR right(regexp_replace(coalesce(ua.phone, ''),          '[^0-9]', '', 'g'), 10) = v_tel
          )
    ) AS todas(id);

    IF coalesce(array_length(v_ids, 1), 0) <> 1 THEN RETURN NULL; END IF;

    SELECT id, email, child_name INTO v_inv
    FROM public.invitations WHERE id = v_ids[1];

    -- El correo viaja para que RegisterPage lo precargue: accept_invitation_pro
    -- exige `LOWER(TRIM(email)) = v_user_email`, y con otro correo la aceptación
    -- falla EN SILENCIO después de que el papá ya llenó todo el formulario.
    RETURN jsonb_build_object(
        'invite_id',  v_inv.id,
        'email',      v_inv.email,
        'child_name', v_inv.child_name
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.wa_invitacion_pendiente_por_telefono(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wa_invitacion_pendiente_por_telefono(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.wa_invitacion_pendiente_por_telefono(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.wa_invitacion_pendiente_por_telefono(uuid, text) TO service_role;

-- ── Y que el bot los RECONOZCA como familia ────────────────────────────────
-- Sin esto, `wa_identify_by_phone` devuelve 'desconocido' para el papá de
-- Besser: lo saluda como a un extraño y ni le ofrece registrarse.
CREATE OR REPLACE FUNCTION public.wa_es_familia_sin_registrar(
    p_school_id     uuid,
    p_contact_wa_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.unregistered_athletes ua
        WHERE ua.school_id = p_school_id
          AND ua.is_active
          AND ua.linked_profile_id IS NULL
          AND (
                right(regexp_replace(coalesce(ua.guardian_phone, ''), '[^0-9]', '', 'g'), 10)
                  = right(regexp_replace(coalesce(p_contact_wa_id, ''), '[^0-9]', '', 'g'), 10)
             OR right(regexp_replace(coalesce(ua.phone, ''), '[^0-9]', '', 'g'), 10)
                  = right(regexp_replace(coalesce(p_contact_wa_id, ''), '[^0-9]', '', 'g'), 10)
          )
    );
$function$;

REVOKE ALL ON FUNCTION public.wa_es_familia_sin_registrar(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wa_es_familia_sin_registrar(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.wa_es_familia_sin_registrar(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.wa_es_familia_sin_registrar(uuid, text) TO service_role;

COMMENT ON FUNCTION public.wa_es_familia_sin_registrar(uuid, text) IS
  'Ese numero pertenece a un atleta cargado pero no registrado. Mira guardian_phone Y phone: cada escuela lleno uno distinto.';

COMMIT;

NOTIFY pgrst, 'reload schema';
