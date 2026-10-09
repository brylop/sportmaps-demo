-- Registra migraciones que YA están vivas en la base pero no figuran en
-- supabase_migrations.schema_migrations (se aplicaron por el SQL Editor).
-- Verificado por el supervisor el 2026-10-07 contra los objetos de la base.
-- Solo inserta registros: no cambia el esquema. Correr después de 1_*.sql.
-- Incluye las 2 de la sesión -e0 con su versión del repo (en la base quedaron
-- como 20261006223343 y 20261006224725 porque se aplicaron con apply_migration).
insert into supabase_migrations.schema_migrations(version, name) values
 ('20261004074523','matricula_por_foto_desde_app'),
 ('20261005131057','cerrar_rpc_sin_gate_linter_2026_10_05'),
 ('20261005131059','invariante_i7_rpc_sin_gate_y_fix_i6'),
 ('20261005173001','hour_bank_billing_rounding'),
 ('20261005173002','pizarra_blindaje_datos_y_lectura'),
 ('20261005214245','cobros_base_categorias_y_unicidad'),
 ('20261005214248','inscripcion_seguro_emit_enrollment_fees'),
 ('20261005214250','alta_clases_restantes_create_enrollment_with_payments'),
 ('20261005214253','cobranza_flags_autocancel_y_comprobante_pendiente'),
 ('20261005214258','niv_f2_progresion_competitiva'),
 ('20261005214300','niv_d9_dias_permitidos'),
 ('20261005214302','hour_bank_overage_charges'),
 ('20261005221257','vigencia_fin_de_mes_y_cambio_plan_horas'),
 ('20261006094145','profesionales_f0_seguridad_agenda'),
 ('20261006094147','profesionales_f1_f2_pacientes_historia_clinica'),
 ('20261006094149','profesionales_f3_lesiones_ejercicios'),
 ('20261006110920','whatsapp_responder_prospectos'),
 ('20261006111003','profesionales_gates_i7'),
 ('20261006120601','whatsapp_ajustes_por_escuela'),
 ('20261006224322','whatsapp_responder_precios')
on conflict do nothing;
