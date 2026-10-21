-- Permiso por escuela: el entrenador puede remover deportistas de SUS equipos.
-- Cancelar una inscripción anula los cobros pendientes del atleta, así que lo decide
-- la escuela (default false = cerrado, como quedó con 20261021100846). El gate vive
-- en el BFF (DELETE /api/v1/enrollments/:id): valida el flag y que el equipo sea suyo.
-- No toca RLS: la escritura directa de enrollments sigue solo para owner/admin.

ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS coach_can_remove_enrollments boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.school_settings.coach_can_remove_enrollments IS
    'Si true, el entrenador puede cancelar inscripciones de equipos que él entrena '
    '(anula los cobros pendientes del atleta). Las inscripciones de plan siguen '
    'siendo solo de administración. Default false.';
