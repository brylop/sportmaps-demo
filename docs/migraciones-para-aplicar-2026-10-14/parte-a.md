# Migraciones sin registro — Parte A (20260901 .. 20261003193624)

Verificado el 2026-10-14 contra la base viva, solo lectura, con dos consultas filtradas por nombre (`npx supabase db query --linked`). No se aplicó nada.

**Método.** Para las funciones se comparó el md5 de `prosrc` sin espacios contra el cuerpo `$tag$…$tag$` de cada versión del repo. Varias funciones vivas **no** coincidían con ninguna versión, pero sí coinciden **byte a byte una vez quitados los comentarios `--`**: se aplicaron pegando el cuerpo sin comentarios (SQL editor). Por eso se cuentan como aplicadas: la lógica es idéntica, así que no hay deriva hecha a mano en la lógica. Las policies se revisaron en `pg_policies` (nombre, roles y qual). También se revisaron columnas, índices, triggers y constraints (`pg_get_constraintdef`), las ACL (`proacl`) y las filas puntuales de cada fix de datos.

**Resumen:** 15 APLICADA · 9 SUPERADA · 1 PENDIENTE · 2 VACÍA (plantilla `-- TODO`, no hacen nada).

| Archivo | Veredicto | Evidencia | Riesgo / notas |
|---|---|---|---|
| 20260915095800_fix_migrate_unregistered_no_propaga_parent_id | SUPERADA (20260915100420) | La función viva = 20260915100420 sin comentarios, que ya trae el fix de parent_id. El backfill está vivo: 0 pagos de menores sin pagador | Muta `payments` (backfill). No reaplicar: volvería a la versión anterior al fix de la FK linked_profile_id |
| 20260915101557_gate_hour_bank_period_a_flag_por_escuela | SUPERADA (20260915121329) | La función viva tiene la misma lógica (este archivo y 121329 solo difieren en comentarios). Academia Superior tiene `hours_plan_enabled`=**true** | **Peligrosa:** su UPDATE pone `hours_plan_enabled`=false a ACADEMIA SUPERIOR BOGOTA y deshace el fix de 121329 |
| 20260915113256_fix_school_athletes_becado_no_pending | SUPERADA (20260916102444 / 20260916103807) | El viewdef vivo trae el fallback del becado (`fee_is_manual AND COALESCE(pe.monthly_fee…`) | CREATE OR REPLACE VIEW con menos columnas que la viva (sin discount_type): fallaría o haría regresión de security_invoker |
| 20260915121329_corrige_hours_plan_enabled_academia_superior | SUPERADA (grant → 20260917152141) | Función viva = archivo sin comentarios. Flag de Academia Superior = true. Ya no hay EXECUTE para authenticated | **No reaplicar:** su `GRANT … TO authenticated` reabre lo que cerró 20260917152141 |
| 20260917123008_enrollment_intake_storage_policies | APLICADA | Las 3 policies `identity_docs_enrollment_intake_*` existen, TO authenticated, con el qual de enrollment_intake | — |
| 20260917131156_fix_identity_docs_public_read_nunca_aplicado | SUPERADA (20260922223853) | `identity_docs_public_read` y `Public Document Read` ya no existen; `owner_read` está vivo. `staff_read` se cambió por `children_staff_read` y `unregistered_staff_read`, acotadas por escuela | RLS. **No reaplicar:** recrea `identity_docs_staff_read` sin filtro de escuela |
| 20260918123632_buscar_menor_incluye_contacto_temp_del_acudiente | SUPERADA (20261005133932) | La función viva coincide exacto con 20261005133932 | Hace DROP FUNCTION y GRANT a anon: reaplicarla abriría de nuevo una RPC que se cerró |
| 20260918130622_qr_signup_team_fallback_preloaded | APLICADA | `submit_qr_signup` de 12 argumentos = archivo sin comentarios (la de 13 argumentos = 20260918140634) | Dinero (crea payments). 20261013193011 queda fuera de este rango |
| 20260918130753_post_entreno_roster_incluye_no_registrados | APLICADA | Función = archivo sin comentarios. ACL: authenticated sí, anon no | — |
| 20260918131232_training_sessions_select_solo_staff | SUPERADA (20260925135425) | `training_plans_coach_policy` ya no existe. `training_plans_select` es la versión de 135425 (por school_id) | RLS. Reaplicarla volvería al select que pasa por teams |
| 20260919193702_fix_pg_net_schema_extensions | **PENDIENTE** | pg_net sigue en `public`. `extrelocatable` = false (v0.19.5) | **Falla tal cual.** Moverla exige DROP+CREATE EXTENSION, que borra la cola de pg_net y puede cortar los crons de `net.http_post`. Va comentada en parte-a.sql; es solo un warning del linter |
| 20260919194017_fix_athlete_payments_summary_overdue | APLICADA | `get_athlete_payments` = archivo sin comentarios | — |
| 20260919194236_fix_identity_spoofing_trainer_plans_unblock_payment | SUPERADA (20260919194528, 20260922224444) | Las 3 `fn_*` vivas = hotfix 194528; `unblock_payment` viva = 20260922224444 | **No reaplicar:** es la versión que rompió service_role (de ahí el hotfix) |
| 20260921115743_mesociclo_md_cross_microciclo_y_ddl_hardening | APLICADA | `training_days_md_labels` y `check_training_day_within_microcycle` coinciden. El trigger existe, los 7 constraints existen y la fila 9d85… ya está en la semana 4305… | **No idempotente:** `ADD CONSTRAINT` sin IF NOT EXISTS; reaplicarla falla |
| 20260921120611_mesociclo_delete_cascade_rpc | APLICADA | Función = archivo sin comentarios. ACL: authenticated sí, sin PUBLIC | — |
| 20260921120707_fix_org_enumeration_functions | APLICADA | Las 5 funciones sin anon ni authenticated. `is_school_admin_of` coincide exacto | — |
| 20260921130849_mesociclo_fk_dia_sesion_invertido | APLICADA | `training_sessions.microcycle_day_id` y su índice existen. `training_microcycle_days.session_id` y su índice ya no existen | **No idempotente:** su UPDATE lee `d.session_id`, que ya fue borrada, así que reaplicarla falla. Hace DROP COLUMN |
| 20260921131039_fix_more_identity_spoofing_and_execute_grants | VACÍA | Plantilla con `-- TODO`, sin sentencias | — |
| 20260924102932_coach_plans_module_key_carmel | APLICADA | El CHECK vivo incluye `gestion_deportiva_disponibilidad_coach` (luego lo amplió 20261009121558). El override de Carmel = false | **No idempotente:** DROP CONSTRAINT sin IF EXISTS. Reaplicarla **achicaría** el CHECK (se perdería la clave de 20261009121558) |
| 20260925134721_calendar_events_notificar_familias | APLICADA | Las 2 funciones = archivo sin comentarios, `trg_notify_calendar_event` habilitado, el CHECK incluye 'calendar'. recipients sin authenticated | Reaplicarla achicaría `notifications_category_check` (20261006094147 la amplió después) |
| 20260925134939_mesociclo_carga_por_atleta_y_duplicar_semana | APLICADA | Las 2 funciones coinciden exacto y las ACL están bien | — |
| 20260925135425_training_sessions_school_id_deriva_sin_versionar | APLICADA | school_id NOT NULL, `teams_id_school_key` y `training_sessions_team_school_fkey` existen, idx existe. Las 4 policies van por school_id y update tiene WITH CHECK | — |
| 20260925135705_fix_verify_carnet_nombre_null_sin_foto | SUPERADA (20261010201231) | La función viva coincide exacto con 20261010201231 | RPC pública (anon): no reaplicar |
| 20260925140545_pausas_avisar_familia_y_escuela | VACÍA | Plantilla con `-- TODO`, sin sentencias | — |
| 20260926124241_pausas_avisar_pausa_directa_y_reactivacion | APLICADA | `fn_notify_pause_decision` = archivo sin comentarios, el trigger existe | — |
| 20260930131401_seg26_seg15_revoke_release_settlements_y_join_qr | APLICADA | `release_settlements_all`: solo postgres y service_role. `create_school_join_qr`: sin anon ni PUBLIC, con authenticated | — |
| 20261003193624_whatsapp_atencion_solo_familias | APLICADA | `contact_kind`, su CHECK, `idx_wa_conversations_school_kind` y `responder_desconocidos` (NOT NULL default false) existen | — |

## Lo que sale de acá

- **No hay nada útil para aplicar en este rango.** La única pendiente (pg_net) falla tal como está escrita, y moverla en serio es más riesgoso que el warning del linter. Conviene descartarla, o resolverla en otro momento con DROP+CREATE coordinado con los crons.
- **Cómo se aplicó:** 11 funciones están vivas idénticas al repo pero sin comentarios. Alguien las pegó en el SQL editor, por eso no tienen registro. No hay deriva hecha a mano en la lógica.
- **Registrar sin ejecutar:** como todo el rango está vivo o superado, se pueden marcar las 26 como aplicadas en `schema_migrations` (p. ej. `supabase migration repair --status applied <version>`) **sin correr su SQL**. Varias son peligrosas de re-ejecutar: 101557, 121329, 131156, 194236, 102932 y 134721.
