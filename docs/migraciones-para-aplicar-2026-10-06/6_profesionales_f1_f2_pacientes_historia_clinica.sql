-- =============================================================================
-- 20261006094147_profesionales_f1_f2_pacientes_historia_clinica.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-06   Versión anterior: 20261006094145
-- Objetivo: F1 + F2 de docs/specs/profesionales-salud-fisioterapia.md.
--   Custodio de la historia = el PROFESIONAL (decisión D1, 2026-10-06): toda
--   tabla clínica lleva professional_id y el RLS es "solo el profesional".
--   El paciente / acudiente lee por RPC SECURITY DEFINER (resumen sin notas).
--
--   F1: credenciales del profesional, clinical_patients (adulto, menor de
--       `children`, atleta sin cuenta o externo), invitaciones con vencimiento
--       real, consentimientos versionados (Ley 1581), reserva y cancelación del
--       cliente por RPC, avisos in-app/push de citas y recordatorio 24 h.
--   F2: episodios, notas clínicas INMUTABLES con nota aclaratoria (Res. 1995),
--       diagnósticos CIE-10, adjuntos en bucket privado, bitácora de acceso.
--
--   Depende de 20261006094145 (columnas nuevas de wellness_appointments).
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 00. Categoría 'salud' en notifications (el CHECK vivo no la tenía: todo
--     trigger que avisa de citas habría abortado con 23514).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_category_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_category_check
    CHECK (category = ANY (ARRAY['payment','installment','glosa','enrollment','access','qr','marketplace',
                                 'equipment','system','support','tournament','post_training','calendar','salud']::text[]));

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Credenciales del profesional (Ley 528/1999)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.vendor_profiles
    ADD COLUMN IF NOT EXISTS professional_license  text,   -- tarjeta profesional
    ADD COLUMN IF NOT EXISTS rethus_number         text,
    ADD COLUMN IF NOT EXISTS professional_specialty text;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Pacientes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clinical_patients (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    -- A lo sumo UNO: cuenta propia (adulto), menor de un acudiente, atleta sin
    -- cuenta de una escuela, o ninguno (paciente externo).
    profile_id              uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    child_id                uuid REFERENCES public.children(id) ON DELETE SET NULL,
    unregistered_athlete_id uuid REFERENCES public.unregistered_athletes(id) ON DELETE SET NULL,
    full_name               text NOT NULL CHECK (length(btrim(full_name)) BETWEEN 2 AND 160),
    document_type           text CHECK (document_type IN ('CC','TI','RC','CE','PA','PPT','NUIP','OTRO')),
    document_number         text,
    birth_date              date,
    sex                     text CHECK (sex IN ('F','M','X')),
    phone                   text,
    email                   text,
    sport                   text,
    occupation              text,
    eps_name                text,
    blood_type              text CHECK (blood_type IN ('O+','O-','A+','A-','B+','B-','AB+','AB-')),
    allergies               text,
    medical_background      text,   -- antecedentes personales y familiares
    medications             text,
    guardian_name           text,
    guardian_relationship   text,
    guardian_phone          text,
    guardian_document       text,
    guardian_profile_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    emergency_contact_name  text,
    emergency_contact_phone text,
    notes                   text,   -- administrativas, NO clínicas
    status                  text NOT NULL DEFAULT 'activo' CHECK (status IN ('activo','alta','archivado')),
    source                  text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','marketplace','invitacion')),
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT clinical_patients_un_vinculo_chk
        CHECK (num_nonnulls(profile_id, child_id, unregistered_athlete_id) <= 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_cp_prof_profile ON public.clinical_patients (professional_id, profile_id) WHERE profile_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_cp_prof_child   ON public.clinical_patients (professional_id, child_id)   WHERE child_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_cp_prof_unreg   ON public.clinical_patients (professional_id, unregistered_athlete_id) WHERE unregistered_athlete_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cp_professional ON public.clinical_patients (professional_id, status);
CREATE INDEX IF NOT EXISTS idx_cp_profile  ON public.clinical_patients (profile_id)  WHERE profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cp_child    ON public.clinical_patients (child_id)    WHERE child_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cp_guardian ON public.clinical_patients (guardian_profile_id) WHERE guardian_profile_id IS NOT NULL;

ALTER TABLE public.clinical_patients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cp_select_own ON public.clinical_patients;
DROP POLICY IF EXISTS cp_insert_own ON public.clinical_patients;
DROP POLICY IF EXISTS cp_update_own ON public.clinical_patients;
CREATE POLICY cp_select_own ON public.clinical_patients FOR SELECT TO authenticated
    USING (professional_id = (SELECT auth.uid()));
CREATE POLICY cp_insert_own ON public.clinical_patients FOR INSERT TO authenticated
    WITH CHECK (professional_id = (SELECT auth.uid()));
CREATE POLICY cp_update_own ON public.clinical_patients FOR UPDATE TO authenticated
    USING (professional_id = (SELECT auth.uid())) WITH CHECK (professional_id = (SELECT auth.uid()));
REVOKE ALL ON public.clinical_patients FROM anon;
REVOKE DELETE ON public.clinical_patients FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.clinical_patients TO authenticated;

-- El vínculo con una cuenta (profile/child/acudiente) solo lo pone una RPC
-- (invitación o reserva): el profesional no puede "adoptar" un menor ajeno
-- escribiendo un child_id a mano y luego leerle datos por otra vía.
CREATE OR REPLACE FUNCTION public.fn_clinical_patients_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF COALESCE(current_setting('sportmaps.clinical_rpc', true), '') <> 'on'
       AND COALESCE(auth.role(), '') <> 'service_role' THEN
        IF TG_OP = 'INSERT' THEN
            IF NEW.profile_id IS NOT NULL OR NEW.child_id IS NOT NULL
               OR NEW.unregistered_athlete_id IS NOT NULL OR NEW.guardian_profile_id IS NOT NULL THEN
                RAISE EXCEPTION 'VINCULO_SOLO_POR_INVITACION' USING ERRCODE = '42501';
            END IF;
        ELSIF NEW.profile_id IS DISTINCT FROM OLD.profile_id
           OR NEW.child_id IS DISTINCT FROM OLD.child_id
           OR NEW.unregistered_athlete_id IS DISTINCT FROM OLD.unregistered_athlete_id
           OR NEW.guardian_profile_id IS DISTINCT FROM OLD.guardian_profile_id
           OR NEW.professional_id IS DISTINCT FROM OLD.professional_id THEN
            RAISE EXCEPTION 'VINCULO_SOLO_POR_INVITACION' USING ERRCODE = '42501';
        END IF;
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_clinical_patients_guard ON public.clinical_patients;
CREATE TRIGGER trg_clinical_patients_guard BEFORE INSERT OR UPDATE ON public.clinical_patients
    FOR EACH ROW EXECUTE FUNCTION public.fn_clinical_patients_guard();

-- Pacientes que el usuario actual puede ver "del lado del paciente".
CREATE OR REPLACE FUNCTION public.clinical_viewer_patient_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT p.id FROM public.clinical_patients p
    WHERE p.profile_id = auth.uid()
       OR p.guardian_profile_id = auth.uid()
       OR (p.child_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.children c WHERE c.id = p.child_id AND c.parent_id = auth.uid()));
$$;
REVOKE ALL ON FUNCTION public.clinical_viewer_patient_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clinical_viewer_patient_ids() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Consentimientos (Ley 1581/2012, Dec. 1377/2013)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clinical_consent_texts (
    consent_type text NOT NULL CHECK (consent_type IN ('datos_sensibles','tratamiento','compartir_disponibilidad')),
    version      text NOT NULL,
    title        text NOT NULL,
    body         text NOT NULL,
    required     boolean NOT NULL DEFAULT true,
    is_current   boolean NOT NULL DEFAULT true,
    created_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (consent_type, version)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_consent_text_current ON public.clinical_consent_texts (consent_type) WHERE is_current;
ALTER TABLE public.clinical_consent_texts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cct_read ON public.clinical_consent_texts;
CREATE POLICY cct_read ON public.clinical_consent_texts FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.clinical_consent_texts FROM anon;
GRANT SELECT ON public.clinical_consent_texts TO authenticated;

INSERT INTO public.clinical_consent_texts (consent_type, version, title, required, body) VALUES
('datos_sensibles', 'v1', 'Autorización de tratamiento de datos de salud', true,
'Autorizo de manera previa, expresa e informada al profesional de la salud que me atiende a través de SportMaps para recolectar, almacenar y usar mis datos de salud (o los del menor que represento), que son datos sensibles según la Ley 1581 de 2012 y el Decreto 1377 de 2013.

Finalidad: elaborar y custodiar la historia clínica, valorar, diagnosticar, tratar y hacer seguimiento, y cumplir las obligaciones legales del profesional (Resolución 1995 de 1999).

Sé que no estoy obligado(a) a autorizar el tratamiento de datos sensibles, que puedo conocer, actualizar y rectificar mis datos, pedir copia de la historia clínica y revocar esta autorización para usos distintos a la atención y a la conservación legal de la historia clínica. SportMaps actúa como encargado del tratamiento; el profesional es el responsable y custodio de la historia clínica.'),
('tratamiento', 'v1', 'Consentimiento informado para valoración y tratamiento', true,
'Acepto que el profesional realice la valoración y el tratamiento propuestos. El profesional me explicó (o explicó al representante legal del menor) en qué consisten, sus beneficios, sus riesgos más frecuentes y las alternativas, y tuve oportunidad de preguntar.

Puedo retirar este consentimiento en cualquier momento, sin perjuicio de la atención que ya recibí. Informaré al profesional cualquier cambio en mi estado de salud, medicamentos o lesiones.'),
('compartir_disponibilidad', 'v1', 'Compartir disponibilidad deportiva con la escuela', false,
'Autorizo que el profesional comparta con los entrenadores y la administración de mi escuela deportiva únicamente mi ESTADO DE DISPONIBILIDAD (disponible, restringido o no disponible), las restricciones de actividad y la fecha estimada de regreso.

No se compartirá el diagnóstico, las notas clínicas, las imágenes ni ningún otro dato de la historia clínica. Esta autorización es voluntaria y la puedo revocar en cualquier momento.')
ON CONFLICT (consent_type, version) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.clinical_consents (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    patient_id          uuid NOT NULL REFERENCES public.clinical_patients(id) ON DELETE RESTRICT,
    consent_type        text NOT NULL CHECK (consent_type IN ('datos_sensibles','tratamiento','compartir_disponibilidad')),
    version             text NOT NULL,
    text_snapshot       text NOT NULL,
    granted_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    granted_by_name     text NOT NULL,
    relationship        text NOT NULL CHECK (relationship IN ('titular','madre','padre','acudiente','representante_legal')),
    channel             text NOT NULL CHECK (channel IN ('app','presencial_firma')),
    evidence_path       text,   -- documento firmado en el bucket clinical-files
    granted_at          timestamptz NOT NULL DEFAULT now(),
    revoked_at          timestamptz,
    revoked_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    revoked_reason      text,
    FOREIGN KEY (consent_type, version) REFERENCES public.clinical_consent_texts (consent_type, version)
);
CREATE INDEX IF NOT EXISTS idx_cc_patient ON public.clinical_consents (patient_id, consent_type) WHERE revoked_at IS NULL;
ALTER TABLE public.clinical_consents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cc_select_own ON public.clinical_consents;
CREATE POLICY cc_select_own ON public.clinical_consents FOR SELECT TO authenticated
    USING (professional_id = (SELECT auth.uid()));
REVOKE ALL ON public.clinical_consents FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.clinical_consents FROM authenticated;
GRANT SELECT ON public.clinical_consents TO authenticated;

CREATE OR REPLACE FUNCTION public.clinical_patient_has_consent(p_patient_id uuid, p_type text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT EXISTS (SELECT 1 FROM public.clinical_consents c
                   WHERE c.patient_id = p_patient_id AND c.consent_type = p_type AND c.revoked_at IS NULL);
$$;
REVOKE ALL ON FUNCTION public.clinical_patient_has_consent(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clinical_patient_has_consent(uuid, text) TO authenticated;

-- Helper interno: inserta un consentimiento con el texto vigente.
CREATE OR REPLACE FUNCTION public._clinical_insert_consent(
    p_patient_id uuid, p_type text, p_by_profile uuid, p_by_name text,
    p_relationship text, p_channel text, p_evidence text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_prof uuid;
    v_txt  record;
    v_id   uuid;
BEGIN
    SELECT professional_id INTO v_prof FROM public.clinical_patients WHERE id = p_patient_id;
    SELECT * INTO v_txt FROM public.clinical_consent_texts WHERE consent_type = p_type AND is_current;
    IF v_prof IS NULL OR v_txt.version IS NULL THEN
        RAISE EXCEPTION 'CONSENTIMIENTO_INVALIDO' USING ERRCODE = '22023';
    END IF;
    -- Uno vigente por tipo: si ya hay, no se duplica.
    SELECT id INTO v_id FROM public.clinical_consents
    WHERE patient_id = p_patient_id AND consent_type = p_type AND revoked_at IS NULL;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;

    INSERT INTO public.clinical_consents (professional_id, patient_id, consent_type, version, text_snapshot,
        granted_by_profile_id, granted_by_name, relationship, channel, evidence_path)
    VALUES (v_prof, p_patient_id, p_type, v_txt.version, v_txt.body,
        p_by_profile, p_by_name, p_relationship, p_channel, p_evidence)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public._clinical_insert_consent(uuid, text, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;

-- El profesional registra un consentimiento firmado en papel.
CREATE OR REPLACE FUNCTION public.record_clinical_consent_presencial(
    p_patient_id uuid, p_types text[], p_signed_by_name text, p_relationship text, p_evidence_path text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_t text;
    v_n integer := 0;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.clinical_patients WHERE id = p_patient_id AND professional_id = auth.uid()) THEN
        RAISE EXCEPTION 'PACIENTE_NO_ENCONTRADO' USING ERRCODE = '42501';
    END IF;
    IF length(btrim(COALESCE(p_signed_by_name, ''))) < 3 THEN
        RAISE EXCEPTION 'FIRMANTE_REQUERIDO' USING ERRCODE = '22023';
    END IF;
    IF p_evidence_path IS NOT NULL AND split_part(p_evidence_path, '/', 1) <> auth.uid()::text THEN
        RAISE EXCEPTION 'EVIDENCIA_INVALIDA' USING ERRCODE = '42501';
    END IF;
    FOREACH v_t IN ARRAY p_types LOOP
        PERFORM public._clinical_insert_consent(p_patient_id, v_t, NULL, btrim(p_signed_by_name),
            p_relationship, 'presencial_firma', p_evidence_path);
        v_n := v_n + 1;
    END LOOP;
    PERFORM public._clinical_log(p_patient_id, 'consentimiento_presencial', jsonb_build_object('tipos', p_types));
    RETURN v_n;
END;
$$;

-- El paciente / acudiente otorga desde la app.
CREATE OR REPLACE FUNCTION public.grant_clinical_consents(p_patient_id uuid, p_types text[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_p    record;
    v_name text;
    v_rel  text;
    v_t    text;
    v_n    integer := 0;
BEGIN
    IF p_patient_id NOT IN (SELECT public.clinical_viewer_patient_ids()) THEN
        RAISE EXCEPTION 'PACIENTE_NO_ENCONTRADO' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_p FROM public.clinical_patients WHERE id = p_patient_id;
    SELECT full_name INTO v_name FROM public.profiles WHERE id = auth.uid();
    v_rel := CASE WHEN v_p.profile_id = auth.uid() THEN 'titular' ELSE 'acudiente' END;
    FOREACH v_t IN ARRAY p_types LOOP
        PERFORM public._clinical_insert_consent(p_patient_id, v_t, auth.uid(), COALESCE(v_name, 'Usuario'), v_rel, 'app', NULL);
        v_n := v_n + 1;
    END LOOP;
    PERFORM public._clinical_log(p_patient_id, 'consentimiento_app', jsonb_build_object('tipos', p_types));
    RETURN v_n;
END;
$$;

-- Revocar: el titular/acudiente, o el profesional dejando constancia.
CREATE OR REPLACE FUNCTION public.revoke_clinical_consent(p_consent_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_c record;
BEGIN
    SELECT * INTO v_c FROM public.clinical_consents WHERE id = p_consent_id AND revoked_at IS NULL;
    IF v_c.id IS NULL
       OR (v_c.professional_id <> auth.uid() AND v_c.patient_id NOT IN (SELECT public.clinical_viewer_patient_ids())) THEN
        RAISE EXCEPTION 'CONSENTIMIENTO_NO_ENCONTRADO' USING ERRCODE = '42501';
    END IF;
    UPDATE public.clinical_consents
       SET revoked_at = now(), revoked_by = auth.uid(), revoked_reason = p_reason
     WHERE id = p_consent_id;
    PERFORM public._clinical_log(v_c.patient_id, 'consentimiento_revocado', jsonb_build_object('tipo', v_c.consent_type));
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Bitácora (accesos y cambios)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clinical_access_log (
    id              bigserial PRIMARY KEY,
    professional_id uuid,
    patient_id      uuid,
    actor_id        uuid,
    action          text NOT NULL,
    detail          jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cal_patient ON public.clinical_access_log (patient_id, created_at DESC);
ALTER TABLE public.clinical_access_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cal_select_own ON public.clinical_access_log;
CREATE POLICY cal_select_own ON public.clinical_access_log FOR SELECT TO authenticated
    USING (professional_id = (SELECT auth.uid()));
REVOKE ALL ON public.clinical_access_log FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.clinical_access_log FROM authenticated;
GRANT SELECT ON public.clinical_access_log TO authenticated;

CREATE OR REPLACE FUNCTION public._clinical_log(p_patient_id uuid, p_action text, p_detail jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    INSERT INTO public.clinical_access_log (professional_id, patient_id, actor_id, action, detail)
    SELECT p.professional_id, p.id, auth.uid(), p_action, COALESCE(p_detail, '{}'::jsonb)
    FROM public.clinical_patients p WHERE p.id = p_patient_id;
$$;
REVOKE ALL ON FUNCTION public._clinical_log(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

-- El front la llama al abrir la historia, imprimirla o exportarla.
CREATE OR REPLACE FUNCTION public.log_clinical_access(p_patient_id uuid, p_action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF p_action NOT IN ('ver_historia','imprimir_historia','ver_adjunto') THEN
        RAISE EXCEPTION 'ACCION_INVALIDA' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.clinical_patients WHERE id = p_patient_id AND professional_id = auth.uid()) THEN
        RAISE EXCEPTION 'PACIENTE_NO_ENCONTRADO' USING ERRCODE = '42501';
    END IF;
    PERFORM public._clinical_log(p_patient_id, p_action, '{}'::jsonb);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Invitaciones (vincular paciente con una cuenta + consentimiento)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clinical_patient_invites (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    patient_id      uuid NOT NULL REFERENCES public.clinical_patients(id) ON DELETE CASCADE,
    token           text NOT NULL UNIQUE,
    expires_at      timestamptz NOT NULL DEFAULT now() + interval '14 days',
    used_at         timestamptz,
    used_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clinical_patient_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cpi_select_own ON public.clinical_patient_invites;
CREATE POLICY cpi_select_own ON public.clinical_patient_invites FOR SELECT TO authenticated
    USING (professional_id = (SELECT auth.uid()));
REVOKE ALL ON public.clinical_patient_invites FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.clinical_patient_invites FROM authenticated;
GRANT SELECT ON public.clinical_patient_invites TO authenticated;

CREATE OR REPLACE FUNCTION public.create_clinical_invite(p_patient_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_token text := encode(extensions.gen_random_bytes(24), 'hex');
    v_exp   timestamptz;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.clinical_patients WHERE id = p_patient_id AND professional_id = auth.uid()) THEN
        RAISE EXCEPTION 'PACIENTE_NO_ENCONTRADO' USING ERRCODE = '42501';
    END IF;
    -- Una invitación viva por paciente: las anteriores vencen.
    UPDATE public.clinical_patient_invites SET expires_at = now()
     WHERE patient_id = p_patient_id AND used_at IS NULL AND expires_at > now();
    INSERT INTO public.clinical_patient_invites (professional_id, patient_id, token)
    VALUES (auth.uid(), p_patient_id, v_token) RETURNING expires_at INTO v_exp;
    RETURN jsonb_build_object('token', v_token, 'expires_at', v_exp);
END;
$$;

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
    SELECT i.*, p.full_name AS patient_name, p.birth_date, pr.full_name AS professional_name,
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
        -- Solo el primer nombre: quien abre el enlace puede no ser el acudiente.
        'patient_first_name', split_part(v.patient_name, ' ', 1),
        'expires_at', v.expires_at,
        'consents', (SELECT jsonb_agg(jsonb_build_object('type', t.consent_type, 'version', t.version,
                         'title', t.title, 'body', t.body, 'required', t.required) ORDER BY t.required DESC, t.consent_type)
                     FROM public.clinical_consent_texts t WHERE t.is_current));
END;
$$;

-- p_child_id NULL = el paciente es quien acepta (adulto con cuenta).
CREATE OR REPLACE FUNCTION public.accept_clinical_invite(p_token text, p_child_id uuid, p_types text[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_inv  record;
    v_name text;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NO_AUTENTICADO' USING ERRCODE = '42501'; END IF;
    SELECT * INTO v_inv FROM public.clinical_patient_invites WHERE token = p_token FOR UPDATE;
    IF v_inv.id IS NULL OR v_inv.used_at IS NOT NULL OR v_inv.expires_at <= now() THEN
        RAISE EXCEPTION 'INVITACION_INVALIDA' USING ERRCODE = '22023';
    END IF;
    IF NOT ('datos_sensibles' = ANY (p_types) AND 'tratamiento' = ANY (p_types)) THEN
        RAISE EXCEPTION 'CONSENTIMIENTOS_REQUERIDOS' USING ERRCODE = '22023';
    END IF;
    IF v_inv.professional_id = auth.uid() THEN
        RAISE EXCEPTION 'INVITACION_PROPIA' USING ERRCODE = '22023';
    END IF;

    PERFORM set_config('sportmaps.clinical_rpc', 'on', true);
    IF p_child_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.children WHERE id = p_child_id AND parent_id = auth.uid()) THEN
            RAISE EXCEPTION 'MENOR_NO_ENCONTRADO' USING ERRCODE = '42501';
        END IF;
        IF EXISTS (SELECT 1 FROM public.clinical_patients WHERE professional_id = v_inv.professional_id
                   AND child_id = p_child_id AND id <> v_inv.patient_id) THEN
            RAISE EXCEPTION 'PACIENTE_YA_VINCULADO' USING ERRCODE = '23505';
        END IF;
        SELECT full_name INTO v_name FROM public.profiles WHERE id = auth.uid();
        UPDATE public.clinical_patients
           SET child_id = p_child_id, profile_id = NULL, unregistered_athlete_id = NULL,
               guardian_profile_id = auth.uid(),
               guardian_name = COALESCE(guardian_name, v_name),
               source = 'invitacion'
         WHERE id = v_inv.patient_id;
    ELSE
        IF EXISTS (SELECT 1 FROM public.clinical_patients WHERE professional_id = v_inv.professional_id
                   AND profile_id = auth.uid() AND id <> v_inv.patient_id) THEN
            RAISE EXCEPTION 'PACIENTE_YA_VINCULADO' USING ERRCODE = '23505';
        END IF;
        UPDATE public.clinical_patients
           SET profile_id = auth.uid(), child_id = NULL, unregistered_athlete_id = NULL, source = 'invitacion'
         WHERE id = v_inv.patient_id;
    END IF;

    UPDATE public.clinical_patient_invites SET used_at = now(), used_by = auth.uid() WHERE id = v_inv.id;
    PERFORM public.grant_clinical_consents(v_inv.patient_id, p_types);

    -- Las citas agendadas antes de vincular pasan a verse (y avisarse) del lado
    -- del cliente: el trigger de la cita solo copia el vínculo cuando cambia patient_id.
    UPDATE public.wellness_appointments wa
       SET athlete_id = p.profile_id, child_id = p.child_id
      FROM public.clinical_patients p
     WHERE p.id = v_inv.patient_id AND wa.patient_id = p.id;

    INSERT INTO public.notifications (user_id, title, message, type, link, category)
    SELECT v_inv.professional_id, 'Paciente vinculado',
           p.full_name || ' aceptó tu invitación y firmó el consentimiento.',
           'clinical_invite_accepted', '/pacientes/' || p.id, 'salud'
      FROM public.clinical_patients p WHERE p.id = v_inv.patient_id;
    RETURN v_inv.patient_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Citas: paciente, reserva y cancelación del cliente, avisos
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.wellness_appointments
    ADD COLUMN IF NOT EXISTS patient_id uuid REFERENCES public.clinical_patients(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_wellness_apt_patient ON public.wellness_appointments (patient_id) WHERE patient_id IS NOT NULL;

-- La cita hereda de su paciente quién la ve del lado del cliente.
CREATE OR REPLACE FUNCTION public.fn_wellness_appointment_patient()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_p record;
BEGIN
    IF NEW.patient_id IS NOT NULL
       AND (TG_OP = 'INSERT' OR NEW.patient_id IS DISTINCT FROM OLD.patient_id) THEN
        SELECT * INTO v_p FROM public.clinical_patients WHERE id = NEW.patient_id;
        IF v_p.id IS NULL OR v_p.professional_id <> NEW.professional_id THEN
            RAISE EXCEPTION 'PACIENTE_DE_OTRO_PROFESIONAL' USING ERRCODE = '42501';
        END IF;
        NEW.athlete_id   := v_p.profile_id;
        NEW.child_id     := v_p.child_id;
        NEW.athlete_name := v_p.full_name;
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
        IF NEW.status = 'confirmed' THEN NEW.confirmed_at := COALESCE(NEW.confirmed_at, now()); END IF;
        IF NEW.status = 'completed' THEN NEW.completed_at := COALESCE(NEW.completed_at, now()); END IF;
        IF NEW.status = 'cancelled' THEN
            NEW.cancelled_at := COALESCE(NEW.cancelled_at, now());
            NEW.cancelled_by := COALESCE(NEW.cancelled_by, auth.uid());
        END IF;
    END IF;
    -- Si se reprograma, el recordatorio se vuelve a mandar.
    IF TG_OP = 'UPDATE' AND (NEW.appointment_date, NEW.appointment_time) IS DISTINCT FROM (OLD.appointment_date, OLD.appointment_time) THEN
        NEW.reminder_sent_at := NULL;
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_wellness_appointment_patient() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_wellness_appointment_patient ON public.wellness_appointments;
CREATE TRIGGER trg_wellness_appointment_patient BEFORE INSERT OR UPDATE ON public.wellness_appointments
    FOR EACH ROW EXECUTE FUNCTION public.fn_wellness_appointment_patient();

-- A quién avisar del lado del cliente.
CREATE OR REPLACE FUNCTION public._wellness_appointment_client_ids(p_apt public.wellness_appointments)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT DISTINCT x FROM (
        SELECT p_apt.athlete_id AS x
        UNION SELECT p_apt.booked_by
        UNION SELECT c.parent_id FROM public.children c WHERE c.id = p_apt.child_id
        UNION SELECT cp.guardian_profile_id FROM public.clinical_patients cp WHERE cp.id = p_apt.patient_id
    ) s WHERE x IS NOT NULL AND x <> p_apt.professional_id;
$$;
REVOKE ALL ON FUNCTION public._wellness_appointment_client_ids(public.wellness_appointments) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_wellness_appointment_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_actor  uuid := auth.uid();
    v_when   text := to_char(NEW.appointment_date, 'DD/MM') || ' ' || to_char(NEW.appointment_time, 'HH24:MI');
    v_title  text;
    v_msg    text;
    v_to_pro boolean;
BEGIN
    IF COALESCE(NEW.is_demo, false) THEN RETURN NEW; END IF;

    IF TG_OP = 'INSERT' THEN
        IF v_actor IS DISTINCT FROM NEW.professional_id THEN
            v_to_pro := true;
            v_title := 'Nueva solicitud de cita';
            v_msg := COALESCE(NEW.athlete_name, 'Un paciente') || ' pidió cita para el ' || v_when || '. Confírmala en tu agenda.';
        ELSE
            v_to_pro := false;
            v_title := 'Tienes una cita agendada';
            v_msg := 'Cita de ' || NEW.service_type || ' el ' || v_when || '.';
        END IF;
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
        v_to_pro := v_actor IS DISTINCT FROM NEW.professional_id;
        v_title := CASE NEW.status
            WHEN 'confirmed' THEN 'Cita confirmada'
            WHEN 'cancelled' THEN 'Cita cancelada'
            WHEN 'completed' THEN 'Cita realizada'
            WHEN 'no_show'   THEN 'Cita marcada como no asistida'
            ELSE 'Tu cita cambió' END;
        v_msg := 'Cita de ' || NEW.service_type || ' del ' || v_when
              || CASE WHEN NEW.status = 'cancelled' AND NEW.cancellation_reason IS NOT NULL
                      THEN '. Motivo: ' || NEW.cancellation_reason ELSE '.' END;
        IF NEW.status = 'completed' THEN RETURN NEW; END IF;  -- no hace falta avisar
    ELSIF (NEW.appointment_date, NEW.appointment_time) IS DISTINCT FROM (OLD.appointment_date, OLD.appointment_time) THEN
        v_to_pro := v_actor IS DISTINCT FROM NEW.professional_id;
        v_title := 'Cita reprogramada';
        v_msg := 'Tu cita de ' || NEW.service_type || ' quedó para el ' || v_when || '.';
    ELSE
        RETURN NEW;
    END IF;

    IF v_to_pro THEN
        INSERT INTO public.notifications (user_id, title, message, type, link, category, data)
        VALUES (NEW.professional_id, v_title, v_msg, 'wellness_appointment', '/schedule', 'salud',
                jsonb_build_object('appointment_id', NEW.id));
    ELSE
        INSERT INTO public.notifications (user_id, title, message, type, link, category, data)
        SELECT u, v_title, v_msg, 'wellness_appointment', '/wellness/appointments', 'salud',
               jsonb_build_object('appointment_id', NEW.id)
          FROM public._wellness_appointment_client_ids(NEW) u;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_wellness_appointment_notify() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_wellness_appointment_notify ON public.wellness_appointments;
CREATE TRIGGER trg_wellness_appointment_notify AFTER INSERT OR UPDATE ON public.wellness_appointments
    FOR EACH ROW EXECUTE FUNCTION public.fn_wellness_appointment_notify();

-- Reserva del cliente (atleta adulto o acudiente para su hijo). Precio y
-- duración salen de la base, el horario se valida contra get_available_slots
-- y el antisolapes corre con lock. La cita nace 'pending' hasta que el
-- profesional la confirma; el cobro online llega en F5 (marketplace).
CREATE OR REPLACE FUNCTION public.request_service_appointment(
    p_service_listing_id uuid,
    p_date               date,
    p_time               text,
    p_child_id           uuid DEFAULT NULL,
    p_notes              text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_uid     uuid := auth.uid();
    v_sl      record;
    v_slots   jsonb;
    v_time    time;
    v_patient uuid;
    v_name    text;
    v_id      uuid;
BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'NO_AUTENTICADO' USING ERRCODE = '42501'; END IF;
    v_time := p_time::time;

    SELECT sl.*, vp.user_id AS professional_id, vp.verification_status, vp.is_active AS vendor_active
      INTO v_sl
      FROM public.service_listings sl
      JOIN public.vendor_profiles vp ON vp.id = sl.vendor_profile_id
     WHERE sl.id = p_service_listing_id AND sl.is_active;
    IF v_sl.id IS NULL OR v_sl.verification_status <> 'verified' OR NOT v_sl.vendor_active THEN
        RAISE EXCEPTION 'SERVICIO_NO_DISPONIBLE' USING ERRCODE = '22023';
    END IF;
    IF v_sl.professional_id = v_uid THEN
        RAISE EXCEPTION 'NO_PUEDES_RESERVARTE' USING ERRCODE = '22023';
    END IF;

    v_slots := public.get_available_slots(v_sl.vendor_profile_id, p_service_listing_id, p_date);
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(v_slots->'slots', '[]'::jsonb)) s
                   WHERE (s->>'start_time')::time = v_time) THEN
        RAISE EXCEPTION 'HORARIO_NO_DISPONIBLE' USING ERRCODE = '23P01';
    END IF;

    -- Paciente del profesional (lo crea si no existe, con el vínculo correcto).
    PERFORM set_config('sportmaps.clinical_rpc', 'on', true);
    IF p_child_id IS NOT NULL THEN
        SELECT full_name INTO v_name FROM public.children WHERE id = p_child_id AND parent_id = v_uid;
        IF v_name IS NULL THEN RAISE EXCEPTION 'MENOR_NO_ENCONTRADO' USING ERRCODE = '42501'; END IF;
        SELECT id INTO v_patient FROM public.clinical_patients
         WHERE professional_id = v_sl.professional_id AND child_id = p_child_id;
        IF v_patient IS NULL THEN
            INSERT INTO public.clinical_patients (professional_id, child_id, guardian_profile_id, full_name,
                   birth_date, guardian_name, guardian_phone, eps_name, blood_type, source)
            SELECT v_sl.professional_id, c.id, v_uid, c.full_name, c.date_of_birth, pr.full_name, pr.phone,
                   c.eps_name,
                   CASE WHEN c.blood_type IN ('O+','O-','A+','A-','B+','B-','AB+','AB-') THEN c.blood_type END,
                   'marketplace'
              FROM public.children c JOIN public.profiles pr ON pr.id = v_uid
             WHERE c.id = p_child_id
            RETURNING id INTO v_patient;
        END IF;
    ELSE
        SELECT id INTO v_patient FROM public.clinical_patients
         WHERE professional_id = v_sl.professional_id AND profile_id = v_uid;
        IF v_patient IS NULL THEN
            INSERT INTO public.clinical_patients (professional_id, profile_id, full_name, birth_date, phone, email, source)
            SELECT v_sl.professional_id, pr.id, COALESCE(pr.full_name, 'Paciente'), pr.date_of_birth, pr.phone, pr.email, 'marketplace'
              FROM public.profiles pr WHERE pr.id = v_uid
            RETURNING id INTO v_patient;
        END IF;
    END IF;

    INSERT INTO public.wellness_appointments (
        professional_id, patient_id, booked_by, appointment_date, appointment_time, duration_minutes,
        service_type, service_listing_id, price, is_courtesy, payment_status, booking_source, status, notes,
        modality, client_notes)
    VALUES (
        v_sl.professional_id, v_patient, v_uid, p_date, v_time, v_sl.duration_minutes,
        COALESCE(v_sl.service_type, 'Otro'), v_sl.id, v_sl.price, v_sl.price = 0,
        CASE WHEN v_sl.price = 0 THEN 'courtesy' ELSE 'pending' END,
        'marketplace', 'pending', NULL,
        CASE WHEN 'virtual' = ANY (v_sl.modality) AND NOT ('presencial' = ANY (v_sl.modality)) THEN 'virtual'
             WHEN 'domicilio' = ANY (v_sl.modality) AND NOT ('presencial' = ANY (v_sl.modality)) THEN 'domicilio'
             ELSE 'presencial' END,
        left(p_notes, 1000))
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_my_appointment(p_appointment_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_a record;
BEGIN
    SELECT * INTO v_a FROM public.wellness_appointments WHERE id = p_appointment_id FOR UPDATE;
    IF v_a.id IS NULL OR NOT (
           v_a.athlete_id = auth.uid() OR v_a.booked_by = auth.uid()
        OR (v_a.child_id IS NOT NULL AND public.is_parent_of_child(v_a.child_id))
        OR (v_a.patient_id IS NOT NULL AND v_a.patient_id IN (SELECT public.clinical_viewer_patient_ids()))) THEN
        RAISE EXCEPTION 'CITA_NO_ENCONTRADA' USING ERRCODE = '42501';
    END IF;
    IF v_a.status NOT IN ('pending','confirmed') THEN
        RAISE EXCEPTION 'CITA_NO_CANCELABLE' USING ERRCODE = '22023';
    END IF;
    IF (v_a.appointment_date + v_a.appointment_time) <= (now() AT TIME ZONE 'America/Bogota') THEN
        RAISE EXCEPTION 'CITA_YA_PASO' USING ERRCODE = '22023';
    END IF;
    UPDATE public.wellness_appointments
       SET status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
           cancellation_reason = left(COALESCE(p_reason, 'Cancelada por el paciente'), 500)
     WHERE id = p_appointment_id;
END;
$$;

-- Recordatorio 24 h antes (pg_cron cada 15 min).
CREATE OR REPLACE FUNCTION public.send_wellness_appointment_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_a record;
    v_n integer := 0;
    v_now timestamp := now() AT TIME ZONE 'America/Bogota';
BEGIN
    FOR v_a IN
        SELECT * FROM public.wellness_appointments wa
         WHERE wa.status = 'confirmed' AND wa.reminder_sent_at IS NULL AND NOT COALESCE(wa.is_demo, false)
           AND (wa.appointment_date + wa.appointment_time) BETWEEN v_now AND v_now + interval '24 hours'
         FOR UPDATE SKIP LOCKED
    LOOP
        INSERT INTO public.notifications (user_id, title, message, type, link, category, data)
        SELECT u, 'Recordatorio de cita',
               'Recordatorio: ' || v_a.service_type || ' el ' || to_char(v_a.appointment_date, 'DD/MM')
               || ' a las ' || to_char(v_a.appointment_time, 'HH24:MI') || '.',
               'wellness_appointment_reminder', '/wellness/appointments', 'salud',
               jsonb_build_object('appointment_id', v_a.id)
          FROM public._wellness_appointment_client_ids(v_a) u;
        UPDATE public.wellness_appointments SET reminder_sent_at = now() WHERE id = v_a.id;
        v_n := v_n + 1;
    END LOOP;
    RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.send_wellness_appointment_reminders() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'wellness-appointment-reminders';
        PERFORM cron.schedule('wellness-appointment-reminders', '*/15 * * * *',
                              'SELECT public.send_wellness_appointment_reminders()');
    END IF;
END $$;

-- Citas del lado del cliente (atleta adulto, acudiente, quien reservó). Trae el
-- nombre del profesional sin abrir `profiles` (su RLS no deja leer a un
-- profesional ajeno a la escuela) y NO devuelve `notes` (internas).
CREATE OR REPLACE FUNCTION public.get_my_appointments()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', wa.id, 'professional_id', wa.professional_id, 'patient_id', wa.patient_id,
        'athlete_id', wa.athlete_id, 'child_id', wa.child_id, 'booked_by', wa.booked_by,
        'athlete_name', wa.athlete_name, 'appointment_date', wa.appointment_date,
        'appointment_time', wa.appointment_time, 'duration_minutes', wa.duration_minutes,
        'service_type', wa.service_type, 'status', wa.status, 'price', wa.price,
        'payment_status', wa.payment_status, 'is_courtesy', wa.is_courtesy, 'modality', wa.modality,
        'location', wa.location, 'meeting_url', wa.meeting_url,
        'cancellation_reason', wa.cancellation_reason, 'notes', wa.client_notes,
        'professional', jsonb_build_object(
            'full_name', COALESCE(pr.full_name, vp.display_name),
            'avatar_url', COALESCE(pr.avatar_url, vp.logo_url),
            'practice', vp.display_name, 'phone', vp.phone),
        'service_listing', CASE WHEN sl.id IS NULL THEN NULL ELSE jsonb_build_object('name', sl.name) END)
        ORDER BY wa.appointment_date DESC, wa.appointment_time DESC), '[]'::jsonb)
      FROM public.wellness_appointments wa
      JOIN public.profiles pr ON pr.id = wa.professional_id
      LEFT JOIN public.vendor_profiles vp ON vp.user_id = wa.professional_id
      LEFT JOIN public.service_listings sl ON sl.id = wa.service_listing_id
     WHERE NOT COALESCE(wa.is_demo, false)
       AND (wa.athlete_id = auth.uid() OR wa.booked_by = auth.uid()
            OR (wa.child_id IS NOT NULL AND EXISTS (
                  SELECT 1 FROM public.children c WHERE c.id = wa.child_id AND c.parent_id = auth.uid()))
            OR (wa.patient_id IS NOT NULL AND wa.patient_id IN (SELECT public.clinical_viewer_patient_ids())));
$$;
REVOKE ALL ON FUNCTION public.get_my_appointments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_appointments() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Catálogo CIE-10 (subconjunto de uso frecuente en fisioterapia deportiva;
--    se acepta cualquier código con formato válido aunque no esté aquí)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cie10_codes (
    code        text PRIMARY KEY,
    description text NOT NULL,
    chapter     text
);
ALTER TABLE public.cie10_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cie10_read ON public.cie10_codes;
CREATE POLICY cie10_read ON public.cie10_codes FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.cie10_codes FROM anon;
GRANT SELECT ON public.cie10_codes TO authenticated;

INSERT INTO public.cie10_codes (code, description, chapter) VALUES
('G44.2','Cefalea debida a tensión','G'),
('G56.0','Síndrome del túnel carpiano','G'),
('M16.9','Coxartrosis, no especificada','M'),
('M17.9','Gonartrosis, no especificada','M'),
('M19.9','Artrosis, no especificada','M'),
('M22.2','Trastornos patelofemorales','M'),
('M22.4','Condromalacia de la rótula','M'),
('M23.2','Trastorno de menisco debido a desgarro o lesión antigua','M'),
('M23.5','Inestabilidad crónica de la rodilla','M'),
('M24.4','Luxación y subluxación recidivante de articulación','M'),
('M24.5','Contractura articular','M'),
('M25.5','Dolor en articulación','M'),
('M25.6','Rigidez articular, no clasificada en otra parte','M'),
('M35.7','Síndrome de hiperlaxitud (hipermovilidad)','M'),
('M40.2','Otras cifosis y las no especificadas','M'),
('M41.9','Escoliosis, no especificada','M'),
('M43.0','Espondilólisis','M'),
('M43.1','Espondilolistesis','M'),
('M43.6','Tortícolis','M'),
('M47.8','Otras espondilosis','M'),
('M51.1','Trastorno de disco lumbar y otros, con radiculopatía','M'),
('M51.2','Otros desplazamientos especificados de disco intervertebral','M'),
('M53.1','Síndrome cervicobraquial','M'),
('M54.2','Cervicalgia','M'),
('M54.3','Ciática','M'),
('M54.4','Lumbago con ciática','M'),
('M54.5','Lumbago no especificado','M'),
('M54.6','Dolor en la columna dorsal','M'),
('M62.4','Contractura muscular','M'),
('M62.6','Distensión muscular','M'),
('M62.8','Otros trastornos especificados de los músculos','M'),
('M65.3','Dedo en gatillo','M'),
('M65.4','Tenosinovitis de estiloides radial (de Quervain)','M'),
('M65.9','Sinovitis y tenosinovitis, no especificada','M'),
('M67.4','Ganglión','M'),
('M70.2','Bursitis del olécranon','M'),
('M70.4','Otras bursitis prerrotulianas','M'),
('M70.6','Bursitis del trocánter','M'),
('M71.2','Quiste sinovial del hueco poplíteo (de Baker)','M'),
('M72.2','Fibromatosis de la aponeurosis plantar (fascitis plantar)','M'),
('M75.0','Capsulitis adhesiva del hombro','M'),
('M75.1','Síndrome del manguito rotatorio','M'),
('M75.2','Tendinitis del bíceps','M'),
('M75.3','Tendinitis calcificante del hombro','M'),
('M75.4','Síndrome de abducción dolorosa del hombro (pinzamiento)','M'),
('M75.5','Bursitis del hombro','M'),
('M76.0','Tendinitis del glúteo','M'),
('M76.1','Tendinitis del psoas','M'),
('M76.3','Síndrome del tendón del tensor de la fascia lata (cintilla iliotibial)','M'),
('M76.5','Tendinitis rotuliana','M'),
('M76.6','Tendinitis aquiliana','M'),
('M76.7','Tendinitis peroneal','M'),
('M76.8','Otras entesopatías del miembro inferior, excluido el pie','M'),
('M77.0','Epicondilitis media','M'),
('M77.1','Epicondilitis lateral','M'),
('M77.3','Espolón calcáneo','M'),
('M77.4','Metatarsalgia','M'),
('M77.5','Otras entesopatías del pie','M'),
('M79.1','Mialgia','M'),
('M79.6','Dolor en miembro','M'),
('M79.7','Fibromialgia','M'),
('M84.3','Fractura por tensión (de estrés), no clasificada en otra parte','M'),
('M92.5','Osteocondrosis juvenil de la tibia y del peroné (Osgood-Schlatter)','M'),
('M92.8','Otras osteocondrosis juveniles especificadas (incluye enfermedad de Sever)','M'),
('M93.2','Osteocondritis disecante','M'),
('R26.8','Otras anormalidades de la marcha y de la movilidad','R'),
('R52.9','Dolor, no especificado','R'),
('S06.0','Conmoción cerebral','S'),
('S09.9','Traumatismo de la cabeza, no especificado','S'),
('S13.4','Esguince y torcedura de la columna cervical','S'),
('S33.5','Esguince y torcedura de la columna lumbar','S'),
('S39.0','Traumatismo de tendón y músculo del abdomen, región lumbosacra y pelvis','S'),
('S42.0','Fractura de la clavícula','S'),
('S43.0','Luxación de la articulación del hombro','S'),
('S43.1','Luxación de la articulación acromioclavicular','S'),
('S43.4','Esguince y torcedura de la articulación del hombro','S'),
('S46.0','Traumatismo de tendón del manguito rotatorio del hombro','S'),
('S52.5','Fractura de la epífisis inferior del radio','S'),
('S53.4','Esguince y torcedura del codo','S'),
('S60.0','Contusión de dedo(s) de la mano sin daño de la(s) uña(s)','S'),
('S62.6','Fractura de otro dedo de la mano','S'),
('S63.5','Esguince y torcedura de la muñeca','S'),
('S63.6','Esguince y torcedura de dedo(s) de la mano','S'),
('S70.0','Contusión de la cadera','S'),
('S70.1','Contusión del muslo','S'),
('S73.1','Esguince y torcedura de la cadera','S'),
('S76.0','Traumatismo del tendón y músculo de la cadera','S'),
('S76.1','Traumatismo del tendón y músculo cuádriceps','S'),
('S76.2','Traumatismo del tendón y músculo aductor mayor del muslo','S'),
('S76.3','Traumatismo del tendón y músculo del grupo muscular posterior a nivel del muslo (isquiotibiales)','S'),
('S80.0','Contusión de la rodilla','S'),
('S80.1','Contusión de otras partes y de las no especificadas de la pierna','S'),
('S82.0','Fractura de la rótula','S'),
('S82.6','Fractura del maléolo externo','S'),
('S83.0','Luxación de la rótula','S'),
('S83.2','Desgarro de meniscos, presente','S'),
('S83.4','Esguince y torcedura que compromete el ligamento colateral (externo)(interno) de la rodilla','S'),
('S83.5','Esguince y torcedura que compromete el ligamento cruzado (anterior)(posterior) de la rodilla','S'),
('S83.6','Esguince y torcedura de otras partes y las no especificadas de la rodilla','S'),
('S86.0','Traumatismo del tendón de Aquiles','S'),
('S86.1','Traumatismo de otro(s) tendón(es) y músculo(s) del grupo muscular posterior a nivel de la pierna','S'),
('S90.0','Contusión del tobillo','S'),
('S92.3','Fractura de huesos del metatarso','S'),
('S93.0','Luxación de la articulación del tobillo','S'),
('S93.4','Esguince y torcedura del tobillo','S'),
('S93.6','Esguince y torcedura de otras articulaciones y las no especificadas del pie','S'),
('Z02.5','Examen para la participación en deportes','Z'),
('Z50.1','Otras terapias físicas','Z'),
('Z54.0','Convalecencia consecutiva a cirugía','Z'),
('Z96.6','Presencia de implantes articulares ortopédicos','Z'),
('Z98.8','Otros estados postquirúrgicos especificados','Z')
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Historia clínica: episodios, notas inmutables, diagnósticos
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clinical_episodes (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    patient_id         uuid NOT NULL REFERENCES public.clinical_patients(id) ON DELETE RESTRICT,
    specialty          text NOT NULL DEFAULT 'fisioterapia'
                       CHECK (specialty IN ('fisioterapia','nutricion','psicologia','medicina_deportiva')),
    reason             text NOT NULL CHECK (length(btrim(reason)) >= 3),   -- motivo de consulta
    status             text NOT NULL DEFAULT 'abierto' CHECK (status IN ('abierto','alta','cerrado_sin_alta')),
    treatment_goals    text,
    planned_sessions   integer CHECK (planned_sessions IS NULL OR planned_sessions BETWEEN 1 AND 200),
    frequency          text,
    opened_at          timestamptz NOT NULL DEFAULT now(),
    closed_at          timestamptz,
    discharge_summary  text,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ce_patient ON public.clinical_episodes (patient_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_ce_prof_status ON public.clinical_episodes (professional_id, status);

CREATE TABLE IF NOT EXISTS public.clinical_notes (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    patient_id       uuid NOT NULL REFERENCES public.clinical_patients(id) ON DELETE RESTRICT,
    episode_id       uuid NOT NULL REFERENCES public.clinical_episodes(id) ON DELETE RESTRICT,
    appointment_id   uuid REFERENCES public.wellness_appointments(id) ON DELETE SET NULL,
    note_type        text NOT NULL CHECK (note_type IN ('valoracion_inicial','evolucion','alta','nota_aclaratoria','otro')),
    occurred_at      timestamptz NOT NULL DEFAULT now(),
    subjective       text,
    objective        text,
    assessment       text,
    plan             text,
    pain_before      smallint CHECK (pain_before BETWEEN 0 AND 10),
    pain_after       smallint CHECK (pain_after  BETWEEN 0 AND 10),
    -- Valoración estructurada: anamnesis, mecanismo, mapa corporal, goniometría,
    -- fuerza (Daniels 0-5), pruebas especiales/funcionales, técnicas aplicadas.
    data             jsonb NOT NULL DEFAULT '{}'::jsonb,
    addendum_of      uuid REFERENCES public.clinical_notes(id) ON DELETE RESTRICT,
    addendum_reason  text,
    author_name      text,
    author_license   text,
    signed_at        timestamptz NOT NULL DEFAULT now(),
    created_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT clinical_notes_addendum_chk CHECK (
        (note_type = 'nota_aclaratoria') = (addendum_of IS NOT NULL)
        AND (addendum_of IS NULL OR length(btrim(COALESCE(addendum_reason, ''))) >= 5)),
    CONSTRAINT clinical_notes_contenido_chk CHECK (
        num_nonnulls(NULLIF(btrim(subjective), ''), NULLIF(btrim(objective), ''),
                     NULLIF(btrim(assessment), ''), NULLIF(btrim(plan), '')) >= 1
        OR data <> '{}'::jsonb)
);
CREATE INDEX IF NOT EXISTS idx_cn_episode ON public.clinical_notes (episode_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_cn_patient ON public.clinical_notes (patient_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_cn_appointment ON public.clinical_notes (appointment_id) WHERE appointment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.clinical_diagnoses (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    patient_id       uuid NOT NULL REFERENCES public.clinical_patients(id) ON DELETE RESTRICT,
    episode_id       uuid NOT NULL REFERENCES public.clinical_episodes(id) ON DELETE RESTRICT,
    cie10_code       text NOT NULL CHECK (cie10_code ~ '^[A-Z][0-9]{2}(\.[0-9A-Z]{1,2})?$'),
    description      text NOT NULL,
    kind             text NOT NULL DEFAULT 'principal' CHECK (kind IN ('principal','relacionado')),
    status           text NOT NULL DEFAULT 'activo' CHECK (status IN ('activo','resuelto','descartado')),
    status_changed_at timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cd_episode ON public.clinical_diagnoses (episode_id);

-- RLS: solo el profesional; notas y diagnósticos sin UPDATE/DELETE de contenido.
ALTER TABLE public.clinical_episodes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_notes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_diagnoses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ce_select_own ON public.clinical_episodes;
DROP POLICY IF EXISTS ce_insert_own ON public.clinical_episodes;
DROP POLICY IF EXISTS ce_update_own ON public.clinical_episodes;
CREATE POLICY ce_select_own ON public.clinical_episodes FOR SELECT TO authenticated
    USING (professional_id = (SELECT auth.uid()));
CREATE POLICY ce_insert_own ON public.clinical_episodes FOR INSERT TO authenticated
    WITH CHECK (professional_id = (SELECT auth.uid()));
CREATE POLICY ce_update_own ON public.clinical_episodes FOR UPDATE TO authenticated
    USING (professional_id = (SELECT auth.uid())) WITH CHECK (professional_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS cn_select_own ON public.clinical_notes;
DROP POLICY IF EXISTS cn_insert_own ON public.clinical_notes;
CREATE POLICY cn_select_own ON public.clinical_notes FOR SELECT TO authenticated
    USING (professional_id = (SELECT auth.uid()));
CREATE POLICY cn_insert_own ON public.clinical_notes FOR INSERT TO authenticated
    WITH CHECK (professional_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS cd_select_own ON public.clinical_diagnoses;
DROP POLICY IF EXISTS cd_insert_own ON public.clinical_diagnoses;
DROP POLICY IF EXISTS cd_update_own ON public.clinical_diagnoses;
CREATE POLICY cd_select_own ON public.clinical_diagnoses FOR SELECT TO authenticated
    USING (professional_id = (SELECT auth.uid()));
CREATE POLICY cd_insert_own ON public.clinical_diagnoses FOR INSERT TO authenticated
    WITH CHECK (professional_id = (SELECT auth.uid()));
CREATE POLICY cd_update_own ON public.clinical_diagnoses FOR UPDATE TO authenticated
    USING (professional_id = (SELECT auth.uid())) WITH CHECK (professional_id = (SELECT auth.uid()));

REVOKE ALL ON public.clinical_episodes, public.clinical_notes, public.clinical_diagnoses FROM anon;
REVOKE DELETE ON public.clinical_episodes, public.clinical_notes, public.clinical_diagnoses FROM authenticated;
REVOKE UPDATE ON public.clinical_notes FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.clinical_episodes, public.clinical_diagnoses TO authenticated;
GRANT SELECT, INSERT ON public.clinical_notes TO authenticated;

-- Reglas de negocio de la historia (corren también para service_role).
CREATE OR REPLACE FUNCTION public.fn_clinical_record_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_pat  record;
    v_ep   record;
    v_orig record;
BEGIN
    IF TG_OP = 'DELETE' THEN
        -- Única excepción: purge_clinical_test_data() (solo cuentas de prueba).
        IF COALESCE(current_setting('sportmaps.clinical_purge', true), '') = 'on' THEN
            RETURN OLD;
        END IF;
        RAISE EXCEPTION 'HISTORIA_CLINICA_INMUTABLE: no se borra (Res. 1995/1999)' USING ERRCODE = '42501';
    END IF;

    IF TG_TABLE_NAME = 'clinical_notes' AND TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'HISTORIA_CLINICA_INMUTABLE: corrija con una nota aclaratoria' USING ERRCODE = '42501';
    END IF;

    IF TG_TABLE_NAME = 'clinical_diagnoses' AND TG_OP = 'UPDATE' THEN
        IF (NEW.cie10_code, NEW.description, NEW.kind, NEW.patient_id, NEW.episode_id, NEW.professional_id, NEW.created_at)
           IS DISTINCT FROM (OLD.cie10_code, OLD.description, OLD.kind, OLD.patient_id, OLD.episode_id, OLD.professional_id, OLD.created_at) THEN
            RAISE EXCEPTION 'HISTORIA_CLINICA_INMUTABLE: solo cambia el estado del diagnóstico' USING ERRCODE = '42501';
        END IF;
        IF NEW.status IS DISTINCT FROM OLD.status THEN NEW.status_changed_at := now(); END IF;
        PERFORM public._clinical_log(NEW.patient_id, 'diagnostico_estado',
            jsonb_build_object('codigo', NEW.cie10_code, 'de', OLD.status, 'a', NEW.status));
        RETURN NEW;
    END IF;

    IF TG_TABLE_NAME = 'clinical_episodes' AND TG_OP = 'UPDATE' THEN
        IF (NEW.patient_id, NEW.professional_id, NEW.opened_at, NEW.created_at)
           IS DISTINCT FROM (OLD.patient_id, OLD.professional_id, OLD.opened_at, OLD.created_at) THEN
            RAISE EXCEPTION 'EPISODIO_INMUTABLE' USING ERRCODE = '42501';
        END IF;
        IF OLD.status <> 'abierto' AND NEW.status <> OLD.status THEN
            RAISE EXCEPTION 'EPISODIO_CERRADO: abra un episodio nuevo' USING ERRCODE = '22023';
        END IF;
        IF NEW.status <> 'abierto' AND OLD.status = 'abierto' THEN
            NEW.closed_at := now();
            IF NEW.status = 'alta' AND length(btrim(COALESCE(NEW.discharge_summary, ''))) < 10 THEN
                RAISE EXCEPTION 'RESUMEN_DE_ALTA_REQUERIDO' USING ERRCODE = '22023';
            END IF;
        END IF;
        NEW.updated_at := now();
        PERFORM public._clinical_log(NEW.patient_id, 'episodio_actualizado',
            jsonb_build_object('episodio', NEW.id, 'estado', NEW.status));
        RETURN NEW;
    END IF;

    -- INSERT en episodios / notas / diagnósticos
    SELECT * INTO v_pat FROM public.clinical_patients WHERE id = NEW.patient_id;
    IF v_pat.id IS NULL OR v_pat.professional_id <> NEW.professional_id THEN
        RAISE EXCEPTION 'PACIENTE_DE_OTRO_PROFESIONAL' USING ERRCODE = '42501';
    END IF;
    IF NOT (public.clinical_patient_has_consent(NEW.patient_id, 'datos_sensibles')
            AND public.clinical_patient_has_consent(NEW.patient_id, 'tratamiento')) THEN
        RAISE EXCEPTION 'CONSENTIMIENTO_REQUERIDO: el paciente (o su acudiente) debe autorizar datos de salud y tratamiento'
            USING ERRCODE = '42501';
    END IF;

    IF TG_TABLE_NAME = 'clinical_episodes' THEN
        NEW.status := 'abierto';
        NEW.closed_at := NULL;
        PERFORM public._clinical_log(NEW.patient_id, 'episodio_abierto', jsonb_build_object('motivo', left(NEW.reason, 80)));
        RETURN NEW;
    END IF;

    SELECT * INTO v_ep FROM public.clinical_episodes WHERE id = NEW.episode_id;
    IF v_ep.id IS NULL OR v_ep.patient_id <> NEW.patient_id THEN
        RAISE EXCEPTION 'EPISODIO_INVALIDO' USING ERRCODE = '22023';
    END IF;

    IF TG_TABLE_NAME = 'clinical_notes' THEN
        IF v_ep.status <> 'abierto' AND NEW.note_type <> 'nota_aclaratoria' THEN
            RAISE EXCEPTION 'EPISODIO_CERRADO: solo admite notas aclaratorias' USING ERRCODE = '22023';
        END IF;
        IF NEW.addendum_of IS NOT NULL THEN
            SELECT * INTO v_orig FROM public.clinical_notes WHERE id = NEW.addendum_of;
            IF v_orig.id IS NULL OR v_orig.episode_id <> NEW.episode_id THEN
                RAISE EXCEPTION 'NOTA_ORIGINAL_INVALIDA' USING ERRCODE = '22023';
            END IF;
        END IF;
        IF NEW.appointment_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.wellness_appointments wa
             WHERE wa.id = NEW.appointment_id AND wa.professional_id = NEW.professional_id) THEN
            RAISE EXCEPTION 'CITA_INVALIDA' USING ERRCODE = '22023';
        END IF;
        -- Firma: autor y tarjeta profesional congelados al momento de firmar.
        SELECT pr.full_name, vp.professional_license INTO NEW.author_name, NEW.author_license
          FROM public.profiles pr LEFT JOIN public.vendor_profiles vp ON vp.user_id = pr.id
         WHERE pr.id = NEW.professional_id;
        NEW.signed_at := now();
        NEW.created_at := now();
        IF NEW.occurred_at > now() + interval '5 minutes' THEN
            RAISE EXCEPTION 'FECHA_FUTURA' USING ERRCODE = '22023';
        END IF;
        PERFORM public._clinical_log(NEW.patient_id, 'nota_firmada',
            jsonb_build_object('tipo', NEW.note_type, 'episodio', NEW.episode_id));
        -- Completar la cita enlazada.
        IF NEW.appointment_id IS NOT NULL THEN
            UPDATE public.wellness_appointments SET status = 'completed'
             WHERE id = NEW.appointment_id AND status IN ('pending','confirmed');
        END IF;
    END IF;

    IF TG_TABLE_NAME = 'clinical_diagnoses' THEN
        NEW.status := 'activo';
        PERFORM public._clinical_log(NEW.patient_id, 'diagnostico', jsonb_build_object('codigo', NEW.cie10_code));
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_clinical_record_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_clinical_episodes_guard  ON public.clinical_episodes;
DROP TRIGGER IF EXISTS trg_clinical_notes_guard     ON public.clinical_notes;
DROP TRIGGER IF EXISTS trg_clinical_diagnoses_guard ON public.clinical_diagnoses;
CREATE TRIGGER trg_clinical_episodes_guard  BEFORE INSERT OR UPDATE OR DELETE ON public.clinical_episodes
    FOR EACH ROW EXECUTE FUNCTION public.fn_clinical_record_guard();
CREATE TRIGGER trg_clinical_notes_guard     BEFORE INSERT OR UPDATE OR DELETE ON public.clinical_notes
    FOR EACH ROW EXECUTE FUNCTION public.fn_clinical_record_guard();
CREATE TRIGGER trg_clinical_diagnoses_guard BEFORE INSERT OR UPDATE OR DELETE ON public.clinical_diagnoses
    FOR EACH ROW EXECUTE FUNCTION public.fn_clinical_record_guard();

-- Consentimientos: solo se marca la revocación (por RPC), nunca se borran.
CREATE OR REPLACE FUNCTION public.fn_clinical_consents_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF COALESCE(current_setting('sportmaps.clinical_purge', true), '') = 'on' THEN
            RETURN OLD;
        END IF;
        RAISE EXCEPTION 'CONSENTIMIENTO_INMUTABLE' USING ERRCODE = '42501';
    END IF;
    IF (NEW.consent_type, NEW.version, NEW.text_snapshot, NEW.patient_id, NEW.professional_id,
        NEW.granted_by_profile_id, NEW.granted_by_name, NEW.relationship, NEW.channel, NEW.granted_at)
       IS DISTINCT FROM
       (OLD.consent_type, OLD.version, OLD.text_snapshot, OLD.patient_id, OLD.professional_id,
        OLD.granted_by_profile_id, OLD.granted_by_name, OLD.relationship, OLD.channel, OLD.granted_at)
       OR OLD.revoked_at IS NOT NULL THEN
        RAISE EXCEPTION 'CONSENTIMIENTO_INMUTABLE' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_clinical_consents_guard ON public.clinical_consents;
CREATE TRIGGER trg_clinical_consents_guard BEFORE UPDATE OR DELETE ON public.clinical_consents
    FOR EACH ROW EXECUTE FUNCTION public.fn_clinical_consents_guard();

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Adjuntos (bucket privado; primer segmento de la ruta = professional_id)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('clinical-files', 'clinical-files', false, 15728640,
        ARRAY['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS clinical_files_insert_own ON storage.objects;
DROP POLICY IF EXISTS clinical_files_select_own ON storage.objects;
CREATE POLICY clinical_files_insert_own ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'clinical-files' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY clinical_files_select_own ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'clinical-files' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
-- Sin UPDATE ni DELETE: los anexos son parte de la historia.

CREATE TABLE IF NOT EXISTS public.clinical_attachments (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    patient_id      uuid NOT NULL REFERENCES public.clinical_patients(id) ON DELETE RESTRICT,
    episode_id      uuid REFERENCES public.clinical_episodes(id) ON DELETE RESTRICT,
    note_id         uuid REFERENCES public.clinical_notes(id) ON DELETE RESTRICT,
    storage_path    text NOT NULL UNIQUE,
    file_name       text NOT NULL,
    mime_type       text,
    size_bytes      bigint,
    description     text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT clinical_attachments_path_chk CHECK (split_part(storage_path, '/', 1) = professional_id::text)
);
CREATE INDEX IF NOT EXISTS idx_cat_patient ON public.clinical_attachments (patient_id, created_at DESC);
ALTER TABLE public.clinical_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cat_select_own ON public.clinical_attachments;
DROP POLICY IF EXISTS cat_insert_own ON public.clinical_attachments;
CREATE POLICY cat_select_own ON public.clinical_attachments FOR SELECT TO authenticated
    USING (professional_id = (SELECT auth.uid()));
CREATE POLICY cat_insert_own ON public.clinical_attachments FOR INSERT TO authenticated
    WITH CHECK (professional_id = (SELECT auth.uid())
                AND EXISTS (SELECT 1 FROM public.clinical_patients p
                            WHERE p.id = patient_id AND p.professional_id = (SELECT auth.uid())));
REVOKE ALL ON public.clinical_attachments FROM anon;
REVOKE UPDATE, DELETE ON public.clinical_attachments FROM authenticated;
GRANT SELECT, INSERT ON public.clinical_attachments TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. GRANTs de RPCs públicas (SECURITY DEFINER no exime de EXECUTE)
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.record_clinical_consent_presencial(uuid, text[], text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.grant_clinical_consents(uuid, text[])                             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_clinical_consent(uuid, text)                               FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.log_clinical_access(uuid, text)                                   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_clinical_invite(uuid)                                      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_clinical_invite(text)                                         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_clinical_invite(text, uuid, text[])                        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_service_appointment(uuid, date, text, uuid, text)         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_my_appointment(uuid, text)                                 FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_clinical_consent_presencial(uuid, text[], text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_clinical_consents(uuid, text[])                             TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_clinical_consent(uuid, text)                               TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_clinical_access(uuid, text)                                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_clinical_invite(uuid)                                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_clinical_invite(text)                                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_clinical_invite(text, uuid, text[])                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_service_appointment(uuid, date, text, uuid, text)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_my_appointment(uuid, text)                                 TO authenticated;

COMMIT;
