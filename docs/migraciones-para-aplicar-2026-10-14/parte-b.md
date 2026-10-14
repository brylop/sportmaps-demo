# Parte B: migraciones sin registro del 20261003195158 al 20261013193011

Verificado contra la base viva el 2026-10-14. Solo lectura: tres consultas filtradas por nombre exacto (`pg_proc`, `pg_policies`, `pg_indexes`, `pg_trigger`, `pg_constraint`, `information_schema.columns`).

**Método.** Para cada función se calcula `md5` del cuerpo sin espacios en blanco y se compara con todas las versiones del repo. Si no coincide, se compara también sin comentarios `--`, porque al pegar en el SQL editor se pierden. Tablas, índices, triggers, constraints, columnas y policies se comparan por nombre, y en las policies también se revisa `qual`/`with_check`.

Rango: 22 archivos. **APLICADA 9 · SUPERADA 3 · PENDIENTE 10** (3 de ellas de tienda, que decide el usuario) · PARCIAL 0.

| Archivo | Veredicto | Evidencia | Riesgo / notas |
|---|---|---|---|
| 20261003195158_fix_wa_identify_staff_admin_min_uuid | SUPERADA (por 20261008164914) | `wa_identify_staff_admin_by_phone` vivo = versión de 20261008164914 | Re-correrla volvería a la versión vieja |
| 20261003201142_nomina_egreso_bruto_conserva_default | APLICADA (`post_payroll_run` superado por 20261003202424) | `run_payroll` = este archivo; `post_payroll_run` = 202424 | El DML está dentro de las funciones. No re-correr: pisaría `post_payroll_run` |
| 20261003202431_tienda_v2_vendedor_escuela_y_gate | APLICADA | 5 de 6 funciones = este archivo; `enable_school_store` = 20261008163336; `vendor_profiles.school_id`, `vendor_profiles_school_id_uniq` y policies `store_seller_visible` vivos | El spec `tienda-cambio-gestion-a-tienda.md` dice que F0 de tienda v2 está «sin aplicar»: **está desactualizado**, F0 está viva |
| 20261003202434_tienda_v2_products_guard | APLICADA | 7 de 7 funciones = este archivo; 9 policies, `trg_products_fill_vendor`, `products_stock_nonneg` e `inventory_logs.note` vivos | — |
| 20261003202436_tienda_v2_orders_cerrar_escritura | APLICADA (2 funciones superadas por 20261003230007) | 4 funciones = este archivo; `confirm_order_payment` y `fn_orders_status_history` = 230007; 26 columnas, 5 constraints, 4 triggers y `order_status_history` vivos; las policies `*_insert_buyer`/`orders_update_buyer` ya no están | No re-correr |
| 20261003202439_tienda_v2_refunds_reviews_rpc | APLICADA | 10 de 10 funciones = este archivo; policies `inventory_logs_*_read` y `shipments_vendor` vivas; `inventory_logs_admin_all` y `refunds_owner_insert` borradas | — |
| 20261005133534_factura_electronica_preferencia_pagador | APLICADA | 8 de 8 funciones = este archivo (la v2 20261006104251, registrada, no las cambia); `payer_billing_profiles`, `whatsapp_conversation_flows`, 2 índices y 2 policies vivos | — |
| 20261005221734_open_month_h01_mas_cobros_unicos | APLICADA (`open_month` superado por 20261007095911) | `preview_open_month` = este archivo; `open_month` = 20261007095911 | No re-correr: haría retroceder `open_month` (dinero) |
| 20261005221944_fn_extend_vigencia_viva_mas_cobros_unicos | SUPERADA (por 20261010130450) | `fn_extend_enrollment_on_payment_paid` = 20261010130450 | Re-correrla haría retroceder la vigencia |
| 20261006101628_aviso_ausencia_familia | APLICADA | `athlete_absence_notices`, 2 índices y la policy viva (la crea staff, el usuario o el acudiente) | Hay una v2, 20261006104254, registrada |
| 20261008155457_biblioteca_ejercicios | SUPERADA (por 20261008183744, que también quedó atrás frente a la base) | Tabla, 4 índices, 4 policies y el trigger vivos. **`insert_exercise_into_session_block` vivo NO coincide con ninguna versión del repo**: usa `user_tactical_edit_school_ids()` donde el repo dice `user_staff_school_ids()` | **Deriva hecha a mano** (endurecimiento). Hay que versionarla; re-correr v1 o v2 la ABRIRÍA de nuevo |
| 20261008155459_pizarra_metricas_uso_y_deportes | APLICADA | `log_tactical_board_event` = este archivo; tabla, 2 índices y policy vivos | Hay una v2, 20261008183746, registrada |
| 20261013170543_tienda_cupones_por_empresa | **PENDIENTE: decisión del usuario** | No existen `store_coupons*`, `orders.coupon_code` ni `orders_coupon_id_fkey`; `quote_cart`/`create_cart_order` = 20261003230007 | Cambia `create_cart_order`/`quote_cart` (dinero de la tienda). Idempotente |
| 20261013170548_tienda_ingresos_en_finanzas | **PENDIENTE: decisión del usuario** | Las 4 funciones no existen | Solo lectura; agrega `finance_income_by_origin` (Finanzas). Los prerrequisitos `finance_permission` y `finance_income_lines` están vivos |
| 20261013170553_tienda_compra_sin_cuenta | **PENDIENTE: decisión del usuario** | 11 funciones y `store_guest_checkout_log` no existen (las columnas `guest_*` ya están desde 202436) | **Compra sin cuenta: RPCs para anon** y `platform_config.store_guest_checkout` con `enabled=true` por defecto. Parchea `create_cart_order` vía `pg_get_functiondef`: aplicar **después** de 170543 |
| 20261013192838_fix_aging_cartera_vencidos_meses | PENDIENTE | `get_payment_aging_report` = 20260827221826; la guarda md5 coincide con el cuerpo vivo | Solo lectura (informe) |
| 20261013192856_nuevo_pago_mensualidad_estampa_plan | PENDIENTE | `_payments_cobro_cliente_normalizar` = 20261010145241; la guarda pasa | **Dinero**: trigger de normalización sobre `payments` |
| 20261013192915_reserve_hour_bank_periodo_de_la_fecha | PENDIENTE | `get_or_open_hour_bank_period` y `reserve_hour_bank` vivos = 20260915121329 y 20260915001252 **sin comentarios** (difieren solo en comentarios, no es deriva); `_at` y `_hour_bank_es_personal_de_escuela` no existen; la guarda pasa | Banco de horas (cobro por horas extra) |
| 20261013192936_sync_access_group_respeta_mecanismo | PENDIENTE | `fn_sync_access_group_on_payment` = 20261010143132; la guarda pasa | Control de acceso (encola `device_commands`) |
| 20261013192946_hermanos_escalonado_base | PENDIENTE | No existen la columna `sibling_discount_tiers`, el CHECK, la tabla `school_sibling_links`, las 9 funciones ni el trigger | RLS nueva (solo SELECT para staff vía `user_staff_school_ids`; escritura solo por RPC). Idempotente. No configura los escalones de Dreamers (eso es un paso aparte) |
| 20261013192955_hermanos_escalonado_funciones | PENDIENTE | 5 de 5 funciones en su versión anterior del repo; las 5 guardas md5 pasan | **Dinero**: `open_month`, `create_enrollment_with_payments`, `_plan_charge_operation`. Requiere 192946 |
| 20261013193011_qr_signup_cobra_inscripcion_seguro | PENDIENTE | `submit_qr_signup` 12 args: el md5 vivo = el que espera la guarda (5fc70cb6…); 13 args = 20260918140634 sin comentarios (f3c3524a…); `emit_enrollment_fees` = 57fcfc19… | **Dinero**: el alta por QR empieza a cobrar inscripción y seguro. **No idempotente**: la guarda solo acepta el md5 viejo y una segunda corrida aborta (sin daño) |

## Hallazgos fuera del veredicto

- **Deriva hecha a mano:** `insert_exercise_into_session_block` (ver arriba).
- **QR sin guarda de prueba:** el `submit_qr_signup` vivo de 12 args **no** es el envoltorio de SEG-19 (20260818071427, que llamaba a `school_is_operational` y delegaba en `__interno`). Es un cuerpo completo **sin** `school_is_operational`. La variante de 13 args tampoco lo tiene. `submit_qr_signup__interno`, con el fix 09-23, sigue vivo pero queda huérfano. 193011 continúa sobre ese cuerpo sin guarda. Probablemente lo pisaron 20260918130622/140634; queda para la parte A.
- **Spec de tienda desactualizado:** F0 de tienda v2 (202431–202439 y 230007–230016) **está viva** en la base, aunque `tienda-cambio-gestion-a-tienda.md` diga que no.

## Paquetes del 2026-10-13

- `docs/migraciones-para-aplicar-2026-10-13.sql` (8 migraciones: 20260718000001, 20260811110226, 20260921204955, 20261010124934, 20261010201231, 20261010201426, 20261010202857, 20261013124655): **APLICADO**. Ninguna aparece sin registro (el paquete las registra al final de su transacción), y `create_enrollment_with_payments` vivo = 20261010124934.
- `docs/migraciones-para-aplicar-2026-10-13-b.sql` (20261013164839 y 20261013165308): **APLICADO** (las dos están registradas).
- `docs/migraciones-para-aplicar-2026-10-13/00_registrar_vivas.sql` (18 registros): **APLICADO** (ninguna de las 18 aparece sin registro).
