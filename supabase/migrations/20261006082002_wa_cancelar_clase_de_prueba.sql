-- =============================================================================
-- 20261006082002_wa_cancelar_clase_de_prueba.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-06   Versión anterior: 20261005221944
-- Objetivo: que el asistente de WhatsApp pueda CANCELAR la clase de cortesía
--   (cupo de `school_trial_slots`) que el mismo prospecto reservó, liberando el
--   cupo con el mismo candado (FOR UPDATE) con que `submit_school_lead` lo toma.
-- =============================================================================
-- Por qué una RPC nueva y no un UPDATE desde el BFF:
--   · `reserved_count` es un contador de cupo: CLAUDE.md exige mutarlo solo en
--     una RPC SECURITY DEFINER con SELECT … FOR UPDATE. Hoy SOLO existe la
--     reserva (`submit_school_lead`); no hay ningún camino que libere un cupo, y
--     la escuela tampoco tiene pantalla para hacerlo (Fase 1 sin construir).
--   · La reserva se sigue haciendo con `submit_school_lead` (la misma del
--     formulario /inscripcion/<slug>): esta migración NO crea otra reserva.
--
-- Quién la llama: SOLO el BFF con service_role (bot de WhatsApp). El teléfono
-- lo autentica Meta en cada mensaje (`from`), y es lo único con lo que se
-- busca la reserva: nadie cancela la clase de otro número. Por eso NO se
-- otorga a anon ni a authenticated — desde el navegador cualquiera podría
-- mandar un teléfono ajeno.
--
-- Cruce por los ÚLTIMOS 10 DÍGITOS (misma regla que `wa_identify_by_phone`):
-- el formulario guarda «3001234567» y el bot puede haber guardado
-- «573001234567»; comparar el texto crudo no cruza.
--
-- El prospecto NO se descarta: sigue siendo un prospecto (status intacto). Solo
-- se suelta el cupo (`trial_slot_id = NULL`) y queda la nota de quién y cuándo.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · REVOKE explícito de anon y authenticated (los default privileges del
--     esquema les otorgan EXECUTE a cada función nueva).
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.wa_cancelar_clase_de_prueba(
    p_school_id uuid,
    p_phone     text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_tel10 text;
    v_lead  record;
    v_slot  record;
BEGIN
    v_tel10 := right(regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g'), 10);
    IF length(v_tel10) < 10 THEN
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
       AND right(regexp_replace(l.phone, '[^0-9]', '', 'g'), 10) = v_tel10
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

COMMENT ON FUNCTION public.wa_cancelar_clase_de_prueba(uuid, text) IS
    'Bot de WhatsApp: libera el cupo de clase de prueba (school_trial_slots) que reservó ese teléfono (últimos 10 dígitos) en esa escuela. FOR UPDATE sobre prospecto y cupo. Solo service_role.';

REVOKE ALL ON FUNCTION public.wa_cancelar_clase_de_prueba(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_cancelar_clase_de_prueba(uuid, text) TO service_role;

COMMIT;

-- ────────────────────────────────────────────────────────────────────────────
-- Verificación después de aplicar
-- ────────────────────────────────────────────────────────────────────────────
-- SELECT has_function_privilege('anon', 'public.wa_cancelar_clase_de_prueba(uuid,text)', 'EXECUTE');          -- false
-- SELECT has_function_privilege('authenticated', 'public.wa_cancelar_clase_de_prueba(uuid,text)', 'EXECUTE'); -- false
-- SELECT proconfig FROM pg_proc WHERE proname = 'wa_cancelar_clase_de_prueba';  -- {search_path=pg_catalog, public, pg_temp}
