-- =============================================================================
-- 20260825125806_monster_volley_athlete_intake.sql
-- Autor: brylop   Fecha: 2026-08-25   Versión anterior: 20260825125349
-- Objetivo: soportar la carga real de Monster's Volley Club (Sede Suba) como
--   unregistered_athletes con datos de salud/documento estructurados, y una
--   tabla de metadatos de documentos (foto, cédulas, firmas, EPS, paz y salvo)
--   reusando el bucket privado identity-documents ya existente para children.
--   Piloto: 1 equipo + 1 atleta. Ver docs/ (plan de esta sesión) para contexto.
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

-- ─── 1. Campos de salud/documento en unregistered_athletes ───────────────────
-- Mismos nombres que ya usa children (blood_type, eps_name) para no inventar
-- vocabulario nuevo. health_screening guarda las respuestas del cuestionario
-- de afiliación (cardiaco/medicamentos/alergias) estructuradas, NUNCA dentro
-- de un campo de texto libre tipo medical_info (ese fue el error que corrigió
-- scripts/spirit-fontibon-import/10_structured_athlete_fields.sql para
-- children). intake_form_data guarda lo que el formulario trae pero ningún
-- flujo del producto lee todavía (dirección, localidad, barrio, ocupación,
-- redes) — se preserva sin construir columnas para datos sin consumidor.
ALTER TABLE public.unregistered_athletes
  ADD COLUMN IF NOT EXISTS blood_type       text,
  ADD COLUMN IF NOT EXISTS eps_name         text,
  ADD COLUMN IF NOT EXISTS guardian_phone   text,
  ADD COLUMN IF NOT EXISTS guardian_email   text,
  ADD COLUMN IF NOT EXISTS health_screening jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS intake_form_data jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.unregistered_athletes.blood_type IS
  'RH del atleta (O+, O-, A+, A-, B+, B-, AB+, AB-). Mismo vocabulario que children.blood_type.';
COMMENT ON COLUMN public.unregistered_athletes.eps_name IS
  'Nombre de la EPS del atleta. Mismo vocabulario que children.eps_name.';
COMMENT ON COLUMN public.unregistered_athletes.health_screening IS
  'Respuestas autorreportadas del cuestionario de afiliación (cardiaco, medicamentos, alergias). No es historia clínica firmada por un profesional.';
COMMENT ON COLUMN public.unregistered_athletes.intake_form_data IS
  'Campos del formulario de afiliación sin columna propia ni consumidor hoy (dirección, localidad, barrio, ocupación, redes sociales). Preservado, no expuesto en ninguna pantalla.';

-- ─── 2. Metadatos de documentos por atleta ────────────────────────────────────
-- El archivo en sí vive en Storage (bucket identity-documents, ya existente);
-- esta tabla es lo que permite listarlo/filtrarlo/aprobarlo sin depender de
-- storage.list() a ciegas (que además solo mira la carpeta 'children/').
CREATE TABLE IF NOT EXISTS public.athlete_documents (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id               uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    child_id                uuid        REFERENCES public.children(id) ON DELETE CASCADE,
    user_id                 uuid        REFERENCES public.profiles(id) ON DELETE CASCADE,
    unregistered_athlete_id uuid        REFERENCES public.unregistered_athletes(id) ON DELETE CASCADE,
    document_type           text        NOT NULL CHECK (document_type IN (
                                           'athlete_photo', 'eps_certificate',
                                           'guardian_id_front', 'guardian_id_back',
                                           'athlete_id_front', 'athlete_id_back',
                                           'guardian_signature', 'athlete_signature',
                                           'good_standing_certificate', 'other'
                                         )),
    storage_path            text        NOT NULL,
    uploaded_by             uuid        REFERENCES public.profiles(id),
    uploaded_at             timestamptz NOT NULL DEFAULT now(),
    verified                boolean     NOT NULL DEFAULT false,
    verified_by             uuid        REFERENCES public.profiles(id),
    verified_at             timestamptz,
    notes                   text,
    CONSTRAINT athlete_documents_subject_xor CHECK (
      ((child_id IS NOT NULL)::int
       + (user_id IS NOT NULL)::int
       + (unregistered_athlete_id IS NOT NULL)::int) = 1
    )
);

CREATE INDEX IF NOT EXISTS idx_athlete_documents_school
    ON public.athlete_documents (school_id);
CREATE INDEX IF NOT EXISTS idx_athlete_documents_child
    ON public.athlete_documents (child_id) WHERE child_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_athlete_documents_user
    ON public.athlete_documents (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_athlete_documents_unregistered
    ON public.athlete_documents (unregistered_athlete_id) WHERE unregistered_athlete_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_athlete_documents_storage_path
    ON public.athlete_documents (storage_path);

ALTER TABLE public.athlete_documents ENABLE ROW LEVEL SECURITY;

-- Sin policy para el propio atleta/acudiente todavía: en este piloto el
-- sujeto es unregistered_athletes (sin auth.uid()). Cuando exista el flujo
-- de reclamo (DIN-13) esta policy se AMPLÍA (no se reemplaza) con el caso
-- child_id -> children.parent_id = auth.uid() / user_id = auth.uid().
CREATE POLICY "school_staff_manage_athlete_documents"
    ON public.athlete_documents
    FOR ALL
    USING (public.is_school_admin(school_id) OR public.is_super_admin())
    WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());

REVOKE ALL ON public.athlete_documents FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.athlete_documents TO authenticated;
GRANT ALL ON public.athlete_documents TO service_role;

COMMENT ON TABLE public.athlete_documents IS
  'Metadata de documentos sensibles por atleta (foto, cédulas, firmas, EPS, paz y salvo). El archivo vive en el bucket identity-documents; esta tabla es lo que se lista/filtra/aprueba.';

-- ─── 3. Storage: la escuela puede leer los documentos de SUS atletas ─────────
-- Mismo patrón que "School can view school payment receipts via DB"
-- (20260728000001): autoriza por DB (join a athlete_documents), no por path,
-- así funciona sin importar el prefijo de carpeta usado (children/... o
-- unregistered_athletes/...). Complementaria (OR) con las policies
-- históricas del bucket — no se tocan ni se dropean.
DROP POLICY IF EXISTS "School can view athlete documents via DB" ON storage.objects;
CREATE POLICY "School can view athlete documents via DB"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'identity-documents'
      AND EXISTS (
        SELECT 1 FROM public.athlete_documents ad
        WHERE ad.storage_path = storage.objects.name
          AND (public.is_school_admin(ad.school_id) OR public.is_super_admin())
      )
    );

COMMENT ON POLICY "School can view athlete documents via DB" ON storage.objects IS
  'Admin/owner de la escuela puede leer el documento si el athlete_documents.school_id es el suyo. Complementa las policies históricas de identity-documents (children/{childId}).';

COMMIT;
