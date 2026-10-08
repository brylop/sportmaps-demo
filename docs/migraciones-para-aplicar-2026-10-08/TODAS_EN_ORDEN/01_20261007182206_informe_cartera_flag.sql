-- Pegar COMPLETO en el SQL Editor de Supabase y ejecutar. Paso 01 de 14 (orden obligatorio).

-- =============================================================================
-- 20261007182206_informe_cartera_flag.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-07   Versión anterior: 20261007182020
-- Objetivo: ajuste por escuela del INFORME DE CARTERA semanal (morosos,
--   pendientes del mes, comprobantes en revisión, inactivos y bajas con saldo)
--   que manda el BFF a owner + admins los lunes 7:00 COT
--   (bff/src/services/informe-cartera.service.ts).
--
--   school_settings.cartera_report_enabled — boolean NULLABLE, tres estados:
--     · NULL  (default) = automático: ACTIVO solo si la escuela apagó la
--       cancelación automática (auto_cancel_overdue_enabled = false). Quien
--       deja las inscripciones vivas pese a la mora necesita ver la cartera
--       cada semana; quien cancela automático no recibe un correo que no pidió.
--     · TRUE  = activo siempre (lo prende la escuela desde Finanzas → Cartera).
--     · FALSE = apagado siempre.
--
--   Sin la columna (migración sin aplicar) el BFF cae al modo automático: no
--   hace falta coordinar el deploy con esta migración.
--
-- Radio: columna nueva con default NULL → ALTER sin reescritura; ningún
-- comportamiento existente cambia. No toca RLS: lee y escribe el BFF con
-- service_role, con requireRole owner/admin/school_admin en la ruta.
-- =============================================================================

BEGIN;

ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS cartera_report_enabled boolean;

COMMENT ON COLUMN public.school_settings.cartera_report_enabled IS
  'Informe de cartera semanal por correo (lunes 7:00 COT). NULL = automático (activo si auto_cancel_overdue_enabled = false); TRUE/FALSE = explícito. Lo lee bff/src/services/informe-cartera.service.ts.';

COMMIT;

-- Registro (el SQL Editor no deja rastro en schema_migrations)
insert into supabase_migrations.schema_migrations (version, name, created_by)
values ('20261007182206', '20261007182206_informe_cartera_flag', 'sql-editor 2026-10-08') on conflict (version) do nothing;
