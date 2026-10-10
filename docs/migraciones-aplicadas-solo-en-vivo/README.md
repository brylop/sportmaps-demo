# Migraciones aplicadas en la base viva SIN archivo en `supabase/migrations/`

Copia de lo que otra sesión aplicó el 2026-10-10 directo en la base (vía MCP),
sacada de `supabase_migrations.schema_migrations.statements`.

**NO se aplican de nuevo.** Están aquí solo como registro. No van en
`supabase/migrations/` porque re-ejecutarlas después de lo que vino luego
deshace cambios:

| Versión viva | Qué hizo | Qué la reemplazó después |
|---|---|---|
| 20261010140528 `payments_descuento_viaja_con_el_cobro` | Columnas `payments.discount_pct` y `list_amount`, CHECK `payments_discount_pct_range`; nuevas versiones de `create_enrollment_with_payments` y `fn_guard_payments_client` | `create_enrollment_with_payments` → `20261010124934_alta_exonerar_inscripcion_seguro.sql` (rebasada sobre este cuerpo). `fn_guard_payments_client` → `20261010144558_cobros_f1_guardia_y_notificaciones.sql` |
| 20261010143454 `register_manual_payments_rpc` | RPC `register_manual_payments` (registrar pago manual de varios cobros de un deportista, owner/admin) | Sigue viva tal cual; ver archivo |

Para reconstruir una base desde cero quedó versionado en
`20261010180834_versionar_descuento_cobro_y_registro_manual.sql` (columnas
de 140528 + RPC de 143454, idempotente).
