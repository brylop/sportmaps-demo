-- =============================================================================
-- 20260922164841_teams_admite_nuevos.sql
-- Autor: brylop   Fecha: 2026-09-22   Version anterior: 20260921211509
-- Objetivo: poder decir «esa categoria no la estamos ofertando este ano» sin
--           dar de baja al equipo ni a los atletas que ya estan adentro.
-- =============================================================================
-- EL CASO
--
-- Dynasty decidio no ofertar JUVENIL MAYORES FEMENINO este ano. Pero el equipo
-- NO se puede desactivar: tiene 9 atletas inscritas, con sus cobros y su
-- historial. Desactivarlo para que el bot deje de ofrecerlo seria romperles la
-- inscripcion a las 9 para resolver un problema de comunicacion.
--
-- `max_students` tampoco sirve: esta en 20 con 9 inscritas, y bajarlo a 9 diria
-- «esta lleno», que no es lo mismo que «no la abrimos». La familia que oye
-- «esta lleno» vuelve a preguntar en un mes; la que oye «no la estamos
-- ofertando» entiende y pregunta por otra cosa.
--
-- Son dos estados distintos y el sistema solo tenia uno.
--
-- LOS DOS CAMPOS
--
--   admite_nuevos   false = no recibe ingresos nuevos. Los que ya estan siguen
--                   exactamente igual: es una regla de ADMISION, no de baja.
--   nota_admision   que decirle a quien pregunte. Sin esto el bot diria «no hay
--                   cupo» a secas y la familia se queda sin saber que hacer;
--                   con esto puede decir a donde si.
--
-- El default es `true` para las 154 filas que ya existen: nadie cambia de
-- comportamiento por esta migracion.
-- =============================================================================

BEGIN;

ALTER TABLE public.teams
    ADD COLUMN IF NOT EXISTS admite_nuevos boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS nota_admision text;

COMMENT ON COLUMN public.teams.admite_nuevos IS
    'false = el grupo no recibe atletas nuevos. NO da de baja a los inscritos: es regla de admision, no de estado.';
COMMENT ON COLUMN public.teams.nota_admision IS
    'Que responderle a quien pregunte por este grupo cuando no admite nuevos. Lo lee el bot de WhatsApp.';

COMMIT;

NOTIFY pgrst, 'reload schema';
