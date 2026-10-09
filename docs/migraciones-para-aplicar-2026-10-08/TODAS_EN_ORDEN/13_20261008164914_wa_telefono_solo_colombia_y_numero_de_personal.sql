-- Pegar COMPLETO en el SQL Editor de Supabase y ejecutar. Paso 13 de 14 (orden obligatorio).

-- ============================================================================
-- WhatsApp: el número de quien escribe solo identifica si es un celular
-- COLOMBIANO, y el número de alguien del equipo no identifica a una familia.
--
-- Auditoría de privacidad del bot, 2026-10-08 (docs/analisis/privacidad-bot-2026-10-08.md).
--
-- 1) Número extranjero (P0 latente). Todas las RPC de identificación tomaban
--    los ÚLTIMOS 10 dígitos del `from` de WhatsApp y exigían que arrancaran en
--    3. Un número de EE. UU. +1 310 123 4567 llega como «13101234567»: sus
--    últimos 10 son «3101234567», el celular colombiano de otra persona. Quien
--    consiguiera ese número (las áreas 301-324 y 350 de EE. UU. se solapan con
--    los prefijos móviles de Colombia; México +52 33… también) quedaba
--    identificado como esa familia: pagos, enlaces de pago, su invitación con
--    el correo precargado, su clase de prueba (que además podía cancelar) y,
--    si el número era el de la dueña, entraba por el camino de staff_admin.
--    Medido hoy: 0 conversaciones con número extranjero; ninguna explotación.
--
--    Arreglo: el REMITENTE solo cuenta con 10 dígitos pelados o con 57 + 10
--    (`wa_celular_remitente_co`). Lo GUARDADO (perfiles, fichas) sigue con la
--    regla de siempre: hay fichas con dos números pegados (20 dígitos) que se
--    reconocen por los últimos 10, y no se quiere perderlas.
--
-- 2) Número de alguien del equipo cargado en el perfil de un acudiente (P1).
--    Medido hoy: en 2 escuelas con WhatsApp, el celular de la dueña (una) y el
--    de un entrenador (otra) están en el perfil de OTRA persona con hijos
--    activos, y las dos conversaciones quedaron vinculadas a esa familia; la
--    del entrenador recibió get_payment_status de una familia con 3 atletas.
--    Arreglo: si el número también es de un miembro activo del equipo (rol
--    distinto de parent/athlete) que NO es el acudiente encontrado, la RPC
--    responde 'ambiguo' (el bot ya escala ese estado a una persona) y deshace
--    el vínculo que se hubiera hecho SOLO por teléfono. El vínculo verificado
--    por correo (OTP) no se toca: esa persona probó quién es.
--
--    Y en general, cuando el número da 'ambiguo', se deshace el vínculo hecho
--    solo por teléfono: antes la conversación seguía vinculada a quien el
--    número señalaba ANTES de volverse ambiguo, y `revisarVinculoPorTelefono`
--    (bff) no lo toca con 'ambiguo'.
--
-- Mismas firmas, mismo SECURITY DEFINER, mismo search_path; los GRANT de las
-- funciones existentes se conservan con CREATE OR REPLACE. La función nueva
-- es IMMUTABLE e inofensiva, pero se deja solo a service_role como las demás.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.wa_celular_remitente_co(p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT CASE
        WHEN d ~ '^3[0-9]{9}$'   THEN d
        WHEN d ~ '^573[0-9]{9}$' THEN right(d, 10)
        ELSE NULL
    END
    FROM (SELECT regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') AS d) x;
$$;

REVOKE ALL ON FUNCTION public.wa_celular_remitente_co(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wa_celular_remitente_co(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_celular_remitente_co(text) TO service_role;

COMMENT ON FUNCTION public.wa_celular_remitente_co(text) IS
    'Celular colombiano de 10 dígitos del REMITENTE de WhatsApp (10 dígitos o 57+10), o NULL. '
    'Un número extranjero cuyos últimos 10 dígitos arrancan en 3 NO cuenta.';

-- ----------------------------------------------------------------------------
-- wa_identify_by_phone
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wa_identify_by_phone(p_integration_id uuid, p_contact_wa_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
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

    -- Solo un celular colombiano identifica (ver cabecera, punto 1).
    v_tel := public.wa_celular_remitente_co(p_contact_wa_id);

    IF v_tel IS NULL THEN
        RETURN jsonb_build_object('estado', 'desconocido', 'motivo', 'no_es_celular');
    END IF;

    SELECT array_agg(DISTINCT p.id) INTO v_ids
    FROM public.profiles p
    WHERE right(regexp_replace(coalesce(p.phone,''), '[^0-9]', '', 'g'), 10) = v_tel
      AND EXISTS (
            SELECT 1 FROM public.children c
            WHERE c.parent_id = p.id AND c.school_id = v_school_id AND c.is_active
      );

    -- Número del equipo en el perfil de otra persona (ver cabecera, punto 2).
    IF coalesce(array_length(v_ids, 1), 0) = 1 AND EXISTS (
        SELECT 1
        FROM public.school_members sm
        JOIN public.profiles s ON s.id = sm.profile_id
        WHERE sm.school_id = v_school_id
          AND sm.status = 'active'
          AND sm.role NOT IN ('parent', 'athlete')
          AND sm.profile_id <> v_ids[1]
          AND right(regexp_replace(coalesce(s.phone,''), '[^0-9]', '', 'g'), 10) = v_tel
    ) THEN
        UPDATE public.whatsapp_conversations wc
           SET parent_id = NULL, identified = false, updated_at = now()
         WHERE wc.integration_id = p_integration_id
           AND wc.contact_wa_id = p_contact_wa_id
           AND wc.identified
           AND NOT EXISTS (
                -- Verificado por OTP con el correo de ESE acudiente. El
                -- `email` de la fila sobrevive a que el teléfono pise
                -- `parent_id` (ON CONFLICT no lo toca): por eso se compara
                -- contra el correo del perfil, no solo contra parent_id.
                SELECT 1
                FROM public.whatsapp_identifications i
                JOIN public.profiles pv ON pv.id = wc.parent_id
                WHERE i.integration_id = p_integration_id
                  AND i.contact_wa_id = p_contact_wa_id
                  AND i.verified_at IS NOT NULL
                  AND i.email IS NOT NULL
                  AND lower(pv.email) = lower(i.email)
           );
        RETURN jsonb_build_object('estado', 'ambiguo', 'motivo', 'numero_de_personal');
    END IF;

    IF coalesce(array_length(v_ids, 1), 0) > 1 THEN
        UPDATE public.whatsapp_conversations wc
           SET parent_id = NULL, identified = false, updated_at = now()
         WHERE wc.integration_id = p_integration_id
           AND wc.contact_wa_id = p_contact_wa_id
           AND wc.identified
           AND NOT EXISTS (
                -- Verificado por OTP con el correo de ESE acudiente. El
                -- `email` de la fila sobrevive a que el teléfono pise
                -- `parent_id` (ON CONFLICT no lo toca): por eso se compara
                -- contra el correo del perfil, no solo contra parent_id.
                SELECT 1
                FROM public.whatsapp_identifications i
                JOIN public.profiles pv ON pv.id = wc.parent_id
                WHERE i.integration_id = p_integration_id
                  AND i.contact_wa_id = p_contact_wa_id
                  AND i.verified_at IS NOT NULL
                  AND i.email IS NOT NULL
                  AND lower(pv.email) = lower(i.email)
           );
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

    SELECT EXISTS (
        SELECT 1 FROM public.children c
        WHERE c.school_id = v_school_id
          AND c.is_active
          AND right(regexp_replace(coalesce(c.parent_phone_temp,''), '[^0-9]', '', 'g'), 10) = v_tel
    ) INTO v_es_familia;

    IF NOT v_es_familia THEN
        v_es_familia := public.wa_es_familia_sin_registrar(v_school_id, p_contact_wa_id);
    END IF;

    IF v_es_familia THEN
        RETURN jsonb_build_object('estado', 'debe_registrarse');
    END IF;

    RETURN jsonb_build_object('estado', 'desconocido', 'motivo', 'sin_coincidencia');
END;
$$;

-- ----------------------------------------------------------------------------
-- wa_es_familia_sin_registrar
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wa_es_familia_sin_registrar(p_school_id uuid, p_contact_wa_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.unregistered_athletes ua
        WHERE ua.school_id = p_school_id
          AND ua.is_active
          AND ua.linked_profile_id IS NULL
          AND public.wa_celular_remitente_co(p_contact_wa_id) IS NOT NULL
          AND (
                right(regexp_replace(coalesce(ua.guardian_phone, ''), '[^0-9]', '', 'g'), 10)
                  = public.wa_celular_remitente_co(p_contact_wa_id)
             OR right(regexp_replace(coalesce(ua.phone, ''), '[^0-9]', '', 'g'), 10)
                  = public.wa_celular_remitente_co(p_contact_wa_id)
          )
    );
$$;

-- ----------------------------------------------------------------------------
-- wa_invitacion_pendiente_por_telefono (devuelve el correo de la invitación)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wa_invitacion_pendiente_por_telefono(p_integration_id uuid, p_contact_wa_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
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

    v_tel := public.wa_celular_remitente_co(p_contact_wa_id);
    IF v_tel IS NULL THEN RETURN NULL; END IF;

    SELECT array_agg(DISTINCT id) INTO v_ids
    FROM (
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

    RETURN jsonb_build_object(
        'invite_id',  v_inv.id,
        'email',      v_inv.email,
        'child_name', v_inv.child_name
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- wa_identify_staff_admin_by_phone (el remitente con la regla estricta; los
-- perfiles con la de siempre)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wa_identify_staff_admin_by_phone(p_school_id uuid, p_wa_phone_number text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_tel  text;
    v_ids  uuid[];
BEGIN
    v_tel := public.wa_celular_remitente_co(p_wa_phone_number);
    IF v_tel IS NULL THEN
        RETURN jsonb_build_object('estado', 'no_es_staff_admin', 'motivo', 'no_es_celular');
    END IF;

    SELECT array_agg(DISTINCT p.id)
      INTO v_ids
    FROM public.profiles p
    JOIN public.school_members sm ON sm.profile_id = p.id
    WHERE public.wa_normalize_phone10_co(p.phone) = v_tel
      AND sm.school_id = p_school_id
      AND sm.role IN ('owner', 'admin', 'school_admin')
      AND sm.status = 'active';

    IF coalesce(array_length(v_ids, 1), 0) > 1 THEN
        RETURN jsonb_build_object('estado', 'ambiguo');
    END IF;

    IF coalesce(array_length(v_ids, 1), 0) = 1 THEN
        RETURN jsonb_build_object('estado', 'identificado', 'profile_id', v_ids[1]);
    END IF;

    RETURN jsonb_build_object('estado', 'no_es_staff_admin');
END;
$$;

-- ----------------------------------------------------------------------------
-- wa_cancelar_clase_de_prueba: un número extranjero solo encuentra su propia
-- reserva (todos los dígitos), no la del celular colombiano con sus últimos 10.
-- El bff manda el colombiano como 10 dígitos y el extranjero como +<dígitos>.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wa_cancelar_clase_de_prueba(p_school_id uuid, p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_digitos text;
    v_tel10   text;
    v_lead    record;
    v_slot    record;
BEGIN
    v_digitos := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
    v_tel10   := public.wa_celular_remitente_co(v_digitos);
    IF length(v_digitos) < 10 THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'telefono_invalido');
    END IF;

    -- La reserva FUTURA más reciente de ese número en ESA escuela. Candado
    -- sobre el prospecto primero y sobre el cupo después: el mismo orden que
    -- usaría cualquier otra RPC que toque los dos, para no cruzar candados.
    SELECT l.id, l.full_name, l.trial_slot_id
      INTO v_lead
      FROM public.school_signup_leads l
      JOIN public.school_trial_slots s ON s.id = l.trial_slot_id
     WHERE l.school_id = p_school_id
       AND l.trial_slot_id IS NOT NULL
       AND l.status <> 'discarded'
       AND CASE
             WHEN v_tel10 IS NOT NULL
               THEN right(regexp_replace(l.phone, '[^0-9]', '', 'g'), 10) = v_tel10
             ELSE regexp_replace(l.phone, '[^0-9]', '', 'g') = v_digitos
           END
       AND s.slot_date >= (now() AT TIME ZONE 'America/Bogota')::date
     ORDER BY l.created_at DESC
     LIMIT 1
     FOR UPDATE OF l;

    IF v_lead.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'sin_reserva');
    END IF;

    SELECT id, label, slot_date, start_time, end_time, location, reserved_count
      INTO v_slot
      FROM public.school_trial_slots
     WHERE id = v_lead.trial_slot_id
     FOR UPDATE;

    UPDATE public.school_trial_slots
       SET reserved_count = GREATEST(0, reserved_count - 1)
     WHERE id = v_slot.id;

    UPDATE public.school_signup_leads
       SET trial_slot_id = NULL,
           notes = CONCAT_WS(E'\n', NULLIF(notes, ''),
                   'Clase de prueba del ' || to_char(v_slot.slot_date, 'YYYY-MM-DD') || ' '
                   || to_char(v_slot.start_time, 'HH24:MI')
                   || ' cancelada por el prospecto vía WhatsApp ('
                   || to_char(now() AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI') || ').'),
           updated_at = now()
     WHERE id = v_lead.id;

    -- Mismo aviso in-app que deja `submit_school_lead` al reservar: la escuela
    -- se enteró de la reserva por acá, tiene que enterarse de la baja igual.
    INSERT INTO public.notifications (user_id, school_id, title, message, type, link)
    SELECT sm.profile_id, p_school_id,
           'Clase de prueba cancelada',
           v_lead.full_name || ' canceló su clase de prueba del '
               || to_char(v_slot.slot_date, 'DD/MM') || ' a las ' || to_char(v_slot.start_time, 'HH24:MI')
               || ' (' || v_slot.label || ') por WhatsApp. El cupo quedó libre.',
           'info', NULL
      FROM public.school_members sm
     WHERE sm.school_id = p_school_id AND sm.role IN ('owner', 'admin') AND sm.status = 'active';

    RETURN jsonb_build_object(
        'ok', true,
        'lead_id', v_lead.id,
        'full_name', v_lead.full_name,
        'label', v_slot.label,
        'slot_date', v_slot.slot_date,
        'start_time', v_slot.start_time,
        'end_time', v_slot.end_time,
        'location', v_slot.location
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- Verificación (correr después de aplicar):
--   select public.wa_celular_remitente_co('573101234567');  -- 3101234567
--   select public.wa_celular_remitente_co('13101234567');   -- NULL
--   select public.wa_celular_remitente_co('5213312345678'); -- NULL
--   select proname, proacl from pg_proc where proname like 'wa\_%' and proacl::text like '%authenticated%';
--     -- solo wa_consumo_del_mes (ya estaba así)
-- ----------------------------------------------------------------------------

-- Registro (el SQL Editor no deja rastro en schema_migrations)
insert into supabase_migrations.schema_migrations (version, name, created_by)
values ('20261008164914', '20261008164914_wa_telefono_solo_colombia_y_numero_de_personal', 'sql-editor 2026-10-08') on conflict (version) do nothing;
