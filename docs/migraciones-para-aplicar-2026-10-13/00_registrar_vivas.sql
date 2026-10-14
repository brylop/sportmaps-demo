-- 00_registrar_vivas.sql — 2026-10-13
-- Registra en schema_migrations 18 migraciones del repo cuyos objetos YA ESTAN VIVOS en la base
-- (verificado objeto por objeto: md5 del cuerpo de cada funcion = version del repo, tablas, columnas,
-- constraints, indices, policies, triggers, grants y datos semilla). NO cambia ningun objeto.
-- Algunas ya figuran con OTRA version/nombre (aplicadas por el SQL Editor):
--   20261009121558 ~ 20261009121849 matriculas_por_revisar_module_key
--   20261010130450 ~ 20261010132102 vigencia_solo_mensualidad_cobros_unicos_genericos
--   20261010130733 ~ 20261010130858 cobros_unicos_sin_mora_ni_bloqueo
--   20261010143132 ~ 20261010144228 cobros_unicos_reglas_genericas
--   20261010180834 ~ 20261010140528 payments_descuento_viaja_con_el_cobro + 20261010143454 register_manual_payments_rpc
BEGIN;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20261009115335', '20261009115335_canal_whatsapp_plataforma', 'sql-editor 2026-10-13') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20261009121558', '20261009121558_matriculas_por_revisar_module_key', 'sql-editor 2026-10-13') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20261010130450', '20261010130450_vigencia_solo_mensualidad_cobros_unicos_genericos', 'sql-editor 2026-10-13') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20261010130733', '20261010130733_cobros_unicos_sin_mora_ni_bloqueo', 'sql-editor 2026-10-13') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20261010143132', '20261010143132_cobros_unicos_reglas_genericas', 'sql-editor 2026-10-13') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20261010143743', '20261010143743_seguridad_s1_descuento_pronto_pago', 'sql-editor 2026-10-13') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20261010144551', '20261010144551_cobros_f1_charge_batches', 'sql-editor 2026-10-13') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20261010144552', '20261010144552_cobros_f1_payments_columnas', 'sql-editor 2026-10-13') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20261010144554', '20261010144554_cobros_f1_payment_adjustments', 'sql-editor 2026-10-13') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20261010144555', '20261010144555_cobros_f1_descuentos_automaticos', 'sql-editor 2026-10-13') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20261010144556', '20261010144556_cobros_f1_backfill_ajustes', 'sql-editor 2026-10-13') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20261010144557', '20261010144557_cobros_f1_invariantes_payments', 'sql-editor 2026-10-13') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20261010144558', '20261010144558_cobros_f1_guardia_y_notificaciones', 'sql-editor 2026-10-13') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20261010144559', '20261010144559_cobros_f1_funciones_internas', 'sql-editor 2026-10-13') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20261010144600', '20261010144600_cobros_f1_rpcs', 'sql-editor 2026-10-13') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20261010145241', '20261010145241_seguridad_s4_monto_cobro_cliente', 'sql-editor 2026-10-13') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20261010180834', '20261010180834_versionar_descuento_cobro_y_registro_manual', 'sql-editor 2026-10-13') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20261011101750', '20261011101750_dreamers_primer_cobro_sin_recargo', 'sql-editor 2026-10-13') on conflict (version) do nothing;
COMMIT;
