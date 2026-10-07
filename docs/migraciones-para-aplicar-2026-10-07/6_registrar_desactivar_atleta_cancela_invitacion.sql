-- Registra 20261006101735_desactivar_atleta_cancela_invitacion, que YA está
-- viva en la base (se aplicó por el SQL Editor el 2026-10-06) pero no figura en
-- supabase_migrations.schema_migrations.
--
-- Verificado el 2026-10-07 con SELECT:
--   · md5(replace(prosrc, E'\r','')) de public.set_school_athlete_status
--     = md5 del cuerpo del archivo (90355b515821b44404f0f620515436a1): idéntico.
--   · proconfig = search_path=pg_catalog, public, pg_temp
--   · proacl    = authenticated / service_role con EXECUTE; sin anon ni PUBLIC.
-- Solo inserta el registro: no cambia el esquema.
insert into supabase_migrations.schema_migrations(version, name) values
 ('20261006101735','desactivar_atleta_cancela_invitacion')
on conflict do nothing;
