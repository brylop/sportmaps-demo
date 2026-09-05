-- =============================================================================
-- 20260902194954_school_staff_sports_multi_y_niveles.sql
-- Autor: judegor99   Fecha: 2026-09-03   Versión anterior: 20260902190708
-- Objetivo: al editar/registrar un entrenador (StaffFormDialog.tsx), sumar
--   qué deportes dicta (multi, hoy `specialty` es un solo deporte) y qué
--   niveles de atleta puede dictar (Nivel 1-4, con etiqueta genérica entre
--   paréntesis: Principiante/Intermedio/Avanzado/Elite). `specialty` queda
--   deprecado por COMMENT (patrón ya usado en el repo para `ADM-2`) — no se
--   borra porque 8 archivos del FE/BFF todavía lo leen; se sigue
--   sincronizando con `sports[0]` desde el BFF para no romperlos mientras se
--   migran. Backfill: specialty existente pasa a sports[0].
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

ALTER TABLE public.school_staff
    ADD COLUMN IF NOT EXISTS sports text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS taught_levels smallint[] NOT NULL DEFAULT '{}';

ALTER TABLE public.school_staff
    ADD CONSTRAINT school_staff_taught_levels_check
    CHECK (taught_levels <@ ARRAY[1,2,3,4]::smallint[]);

-- Backfill: specialty (un solo deporte) → primer elemento de sports.
UPDATE public.school_staff
SET sports = ARRAY[specialty]
WHERE specialty IS NOT NULL AND btrim(specialty) <> '' AND sports = '{}';

COMMENT ON COLUMN public.school_staff.specialty IS
    'DEPRECADO 2026-09-03: reemplazado por sports (multi-select contra SPORTS_CATALOG). '
    'Se mantiene solo por compatibilidad de lectura — el BFF lo sincroniza con sports[0] '
    'en cada escritura; no editar directamente. Candidato a DROP cuando se confirme que '
    'ningún consumidor lo lee (StaffPage.tsx, useSchoolData.ts, schools.ts, '
    'SchoolOnboardingWizard.tsx a la fecha de este comentario).';

COMMENT ON COLUMN public.school_staff.sports IS
    'Deportes que dicta este entrenador — multi-select contra SPORTS_CATALOG '
    '(frontend/src/lib/constants/sportsCatalog.ts), guarda el nombre en español '
    '(mismo formato que specialty, no el slug).';

COMMENT ON COLUMN public.school_staff.taught_levels IS
    'Niveles de atleta que puede dictar: 1=Principiante, 2=Intermedio, 3=Avanzado, '
    '4=Elite/Alto rendimiento. Vacío = sin restricción declarada (no implica ningún '
    'nivel específico, distinto de "todos").';

COMMIT;
