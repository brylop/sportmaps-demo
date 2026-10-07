-- =============================================================================
-- 20261006111003_profesionales_gates_i7.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-06   Versión anterior: 20261006094149
-- Objetivo: cerrar los tres I7 (RPC SECURITY DEFINER sin gate explícito) que
--   `npm run seguridad:invariantes` marcó tras aplicar el módulo de profesionales.
--   · unlog_exercise_done: ya filtraba por clinical_viewer_patient_ids() en el
--     DELETE, pero en silencio; ahora rechaza explícito a quien no es el
--     paciente ni su acudiente.
--   · clinical_patient_has_consent: solo la usan triggers y RPC SECURITY
--     DEFINER (corren con el owner), así que el cliente no necesita EXECUTE.
--     Con EXECUTE, cualquier usuario podía sondear si un paciente (por UUID)
--     tiene consentimiento.
--   · get_clinical_invite: exige sesión (la ruta /salud/invitacion ya es
--     protegida); el token sigue siendo el secreto.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.unlog_exercise_done(p_assignment_id uuid, p_done_on date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.exercise_assignments a
         WHERE a.id = p_assignment_id
           AND a.patient_id IN (SELECT public.clinical_viewer_patient_ids())) THEN
        RAISE EXCEPTION 'EJERCICIO_NO_ENCONTRADO' USING ERRCODE = '42501';
    END IF;
    DELETE FROM public.exercise_logs l
     WHERE l.assignment_id = p_assignment_id AND l.done_on = p_done_on;
END;
$$;
REVOKE ALL ON FUNCTION public.unlog_exercise_done(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unlog_exercise_done(uuid, date) TO authenticated;

REVOKE ALL ON FUNCTION public.clinical_patient_has_consent(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_clinical_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v record;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'NO_AUTENTICADO');
    END IF;
    SELECT i.*, p.full_name AS patient_name, pr.full_name AS professional_name,
           vp.professional_specialty, vp.display_name
      INTO v
      FROM public.clinical_patient_invites i
      JOIN public.clinical_patients p ON p.id = i.patient_id
      JOIN public.profiles pr ON pr.id = i.professional_id
      LEFT JOIN public.vendor_profiles vp ON vp.user_id = i.professional_id
     WHERE i.token = p_token;
    IF v.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'INVITACION_NO_ENCONTRADA');
    END IF;
    IF v.used_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'INVITACION_USADA');
    END IF;
    IF v.expires_at <= now() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'INVITACION_VENCIDA');
    END IF;
    RETURN jsonb_build_object(
        'ok', true,
        'professional_name', v.professional_name,
        'practice_name', v.display_name,
        'specialty', v.professional_specialty,
        'patient_first_name', split_part(v.patient_name, ' ', 1),
        'expires_at', v.expires_at,
        'consents', (SELECT jsonb_agg(jsonb_build_object('type', t.consent_type, 'version', t.version,
                         'title', t.title, 'body', t.body, 'required', t.required) ORDER BY t.required DESC, t.consent_type)
                     FROM public.clinical_consent_texts t WHERE t.is_current));
END;
$$;
REVOKE ALL ON FUNCTION public.get_clinical_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_clinical_invite(text) TO authenticated;

COMMIT;
