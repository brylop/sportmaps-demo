-- Pegar COMPLETO en el SQL Editor. Aplicar DESPUÉS de que main tenga 2666b8ce (estado de cuenta mensual).
-- =============================================================================
-- 20261005130019_estado_de_cuenta_mensual_flag.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-05   Versión anterior: 20261005120806
-- Objetivo: interruptor POR ESCUELA del estado de cuenta mensual automático
--   (bff/src/services/estado-de-cuenta.service.ts + jobs/estado-de-cuenta-mensual.job.ts).
--
-- Por qué en la base y no en el env: los tres BFF (dev/stg/prod) comparten
-- esta base y corren el mismo cron. El estado de cuenta POSPONE los avisos por
-- cobro de la escuela hasta que sale; si el interruptor fuera un env por BFF,
-- uno con el env apagado mandaría los avisos por cobro a las 7:00 y otro el
-- estado de cuenta a las 8:00 — dos contactos el mismo día (Ley 2300). Mientras
-- esta columna no exista, el BFF lee el estado de cuenta mensual como APAGADO
-- en las tres instancias a la vez.
--
-- Default true: el estado de cuenta solo corre donde además está
-- charge_notifications_enabled (hoy 3 escuelas, entre ellas Dynasty), que ya es
-- el "sí" de la escuela a la cobranza automática. Esta columna existe para
-- poder apagar SOLO el resumen mensual de una escuela sin apagarle los avisos.
-- Aplicarla DESPUÉS de promover a main el commit del job y del QR: aplicarla
-- antes activa el job en el BFF de dev con código que prod aún no tiene.
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

ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS monthly_statement_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.school_settings.monthly_statement_enabled IS
  'Estado de cuenta mensual por familia (correo o WhatsApp), primer día hábil desde que se generan los cobros del mes, 8:00 COT. Solo corre si además charge_notifications_enabled. Ver bff/src/services/estado-de-cuenta.service.ts.';

COMMIT;

insert into supabase_migrations.schema_migrations (version, name, created_by)
values ('20261005130019', '20261005130019_estado_de_cuenta_mensual_flag', 'sql-editor 2026-10-05') on conflict (version) do nothing;
