# Migraciones pendientes — 2026-10-22

Verificado contra la base viva (existencia de funciones, tablas y columnas que crea cada archivo).

## Pendientes de verdad (aplicar en este orden)
1. 01_...tienda_avisar_pedido_nuevo_a_la_tienda.sql — falta `fn_orders_notify_store` / `_notify_store_order`. Es de otra sesion (sin commitear).
2. 02_...reporte_partido_entrenador_admin_familia.sql — falta `match_reports`, `match_report_replies`, `share_match_reports` y 5 RPCs.

No incluida a proposito: 20261022110155_pizarra_admin_edita_tablero.sql (el admin de Besser es `owner`, que ya edita la pizarra; ampliaria permisos a otras escuelas sin necesidad).

## Aplicadas (verificadas por objetos): 58 de las 66 'sin registro'
Todo lo que crean ya existe en la base: se aplicaron por el editor de SQL y solo les falta el registro.

## Sin objetos verificables: 6
Solo cambian policies, datos o el cuerpo de una funcion existente; la existencia no las distingue. Verificar a mano si importan:
- 20261014105158_indices_duplicados_y_parciales.sql
- 20261014153533_rol_facility_manager.sql
- 20261015170324_acuerdo_monster_volley.sql
- 20261015171123_plantillas_ejercicios_otros_deportes.sql
- 20261020113226_pizarra_ia_revoca_grant_creditos_firma_vieja.sql
- 20261021100846_cerrar_rls_enrollments_staff_manage.sql
