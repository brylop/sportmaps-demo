-- 00_registrar_vivas.sql — registra 38 migraciones YA VIVAS, SUPERADAS o VACÍAS para que nadie las vuelva a correr.
-- NO cambia ningún objeto. Evidencia en parte-a.md y parte-b.md.
-- NO incluye 20260919193702 (pg_net): queda descartada, falla tal como está escrita.
-- Generado 2026-10-14. Correr en el SQL Editor de Supabase, UN archivo a la vez, en orden.


-- Registro en schema_migrations (no cambia objetos).
BEGIN;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20260915095800', '20260915095800_fix_migrate_unregistered_no_propaga_parent_id', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20260915101557', '20260915101557_gate_hour_bank_period_a_flag_por_escuela', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20260915113256', '20260915113256_fix_school_athletes_becado_no_pending', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20260915121329', '20260915121329_corrige_hours_plan_enabled_academia_superior', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20260917123008', '20260917123008_enrollment_intake_storage_policies', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20260917131156', '20260917131156_fix_identity_docs_public_read_nunca_aplicado', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20260918123632', '20260918123632_buscar_menor_incluye_contacto_temp_del_acudiente', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20260918130622', '20260918130622_qr_signup_team_fallback_preloaded', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20260918130753', '20260918130753_post_entreno_roster_incluye_no_registrados', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20260918131232', '20260918131232_training_sessions_select_solo_staff', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20260919194017', '20260919194017_fix_athlete_payments_summary_overdue', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20260919194236', '20260919194236_fix_identity_spoofing_trainer_plans_unblock_payment', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20260921115743', '20260921115743_mesociclo_md_cross_microciclo_y_ddl_hardening', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20260921120611', '20260921120611_mesociclo_delete_cascade_rpc', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20260921120707', '20260921120707_fix_org_enumeration_functions', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20260921130849', '20260921130849_mesociclo_fk_dia_sesion_invertido', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20260921131039', '20260921131039_fix_more_identity_spoofing_and_execute_grants', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20260924102932', '20260924102932_coach_plans_module_key_carmel', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20260925134721', '20260925134721_calendar_events_notificar_familias', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20260925134939', '20260925134939_mesociclo_carga_por_atleta_y_duplicar_semana', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20260925135425', '20260925135425_training_sessions_school_id_deriva_sin_versionar', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20260925135705', '20260925135705_fix_verify_carnet_nombre_null_sin_foto', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20260925140545', '20260925140545_pausas_avisar_familia_y_escuela', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20260926124241', '20260926124241_pausas_avisar_pausa_directa_y_reactivacion', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20260930131401', '20260930131401_seg26_seg15_revoke_release_settlements_y_join_qr', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20261003193624', '20261003193624_whatsapp_atencion_solo_familias', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20261003195158', '20261003195158_fix_wa_identify_staff_admin_min_uuid', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20261003201142', '20261003201142_nomina_egreso_bruto_conserva_default', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20261003202431', '20261003202431_tienda_v2_vendedor_escuela_y_gate', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20261003202434', '20261003202434_tienda_v2_products_guard', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20261003202436', '20261003202436_tienda_v2_orders_cerrar_escritura', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20261003202439', '20261003202439_tienda_v2_refunds_reviews_rpc', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20261005133534', '20261005133534_factura_electronica_preferencia_pagador', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20261005221734', '20261005221734_open_month_h01_mas_cobros_unicos', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20261005221944', '20261005221944_fn_extend_vigencia_viva_mas_cobros_unicos', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20261006101628', '20261006101628_aviso_ausencia_familia', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20261008155457', '20261008155457_biblioteca_ejercicios', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20261008155459', '20261008155459_pizarra_metricas_uso_y_deportes', 'registrar-vivas 2026-10-14') on conflict (version) do nothing;
COMMIT;
