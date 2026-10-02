# Spec — Blindaje del dinero: pagos, tienda y nómina

**Versión:** v0.1 · **Fecha:** 2026-10-02 · **Rama:** `develop`
**Origen:** [`auditoria-contabilidad-tienda-2026-10-02.md`](../auditoria-contabilidad-tienda-2026-10-02.md) (hallazgos A*, T*, C*) y [`plan-salida-ingresos-egresos-2026-10-02.md`](../plan-salida-ingresos-egresos-2026-10-02.md).
**Estado:** 🟡 F1 en construcción. F2 y F3 en plan.

> **Qué resuelve, en una línea:** hoy el navegador decide cuánto vale un pago y en qué estado queda, y un anónimo lee la cuenta bancaria de un vendedor. Este spec mueve esas dos decisiones al servidor, apaga la tienda (sin borrar nada) hasta rehacerla, y corrige el cálculo de nómina.

Se construye **por fases, con revisión entre cada una**. Cada migración se crea con `npm run migrations:new`, se prueba primero contra la base viva **dentro de `BEGIN … ROLLBACK`**, se aplica por una vía que deje rastro (`apply_migration`) y se verifica preguntándole al objeto. Al cerrar cada fase: `npm run seguridad:invariantes`.

---

## 0. Decisiones

| # | Decisión | Valor en este spec | Quién la confirma |
|---|---|---|---|
| D-A | ¿La tienda sale o se apaga? | **Se apaga** con un flag global (`store_enabled = false`). No se borra ninguna fila. Se reprende sin deploy | Producto (por defecto, reversible) |
| D-B | ¿El coach ve ingresos en `cash_ledger`? | **No.** La parte de ingresos se filtra por `can_manage_finances` (F2) | Producto (por defecto, reversible) |
| D-C | ¿La nómina entra o se esconde? | **Entra, corregida** (C1, C2). Los valores 2026 (C3) **esperan al contador** | Contador |
| D-D | ¿Mora sobre artículos y torneos? | **No** (F2) | Producto (por defecto) |
| D-J | ¿El padre puede reabrir un cobro `cancelled` subiendo comprobante? | **No.** Solo pasa a `awaiting_approval` desde `pending`, `overdue`, `partial`, `rejected`, `failed` | Producto (por defecto) |

**Valores 2026 de nómina (C3) — no se cambian hasta que el contador confirme.** El Decreto 1469/2025 fija SMMLV $1.750.905 y el 1470/2025 el auxilio en $249.095 (UVT $52.374). El Consejo de Estado lo suspendió el 13-feb y levantó la suspensión en julio; no está claro si hubo un decreto transitorio entre medio. La fila viva dice 1.423.500 / 200.000 / 49.799 (valores 2025). La corrección es un `UPDATE` de una fila desde `/admin/payroll-config`, sin migración.

---

## 1. Fase 1 — lo que es explotable hoy

### 1.1 T1 · Datos bancarios de vendedores legibles sin login

**Hoy.** `vendor_profiles_select_public` alcanza a `{public}` y `anon` tiene SELECT sobre las 28 columnas. Como anónimo se lee `bank_data` (número de cuenta, titular, documento) de `mmm-team-products`. Además `GET /api/v1/marketplace/vendor/:slug` hace `select('*')` con service role sobre cualquier perfil activo. Es la trampa 4 del CLAUDE.md: RLS filtra filas, no columnas.

**Por qué no una vista.** `useExplorarGlobal.ts:118` hace un embed `vendor_profiles!inner` desde PostgREST. Reemplazar la tabla por una vista lo rompe. Los **grants por columna** dejan funcionando todos los embeds, porque todos piden columnas publicables.

**Cambio.**
- `REVOKE ALL ON vendor_profiles FROM anon` + `GRANT SELECT (columnas publicables) TO anon`.
  Publicables: `id, user_id, vendor_type, display_name, slug, description, logo_url, cover_image_url, city, website_url, verification_status, is_active, avg_rating, reviews_count, response_rate, avg_response_hours, created_at, updated_at`.
  Fuera para `anon`: `bank_data, nit, verification_doc_url, commission_rate, payment_methods, metadata, phone, email, address, capabilities`.
- `REVOKE ALL ON vendor_bank_accounts FROM anon` (trampa 3; la RLS ya lo frena).
- BFF `marketplace.routes.ts` `/vendor/:slug`: `select` explícito de columnas publicables y solo perfiles `verified`.
- `authenticated` **conserva** todas las columnas en esta fase: tres pantallas del dueño leen columnas sensibles directo (`VendorGuard.tsx:38`, `VendorPublicProfilePage.tsx:113`, `AdminMarketplaceModerationPage.tsx:316`), y la RLS de `authenticated` sí está acotada a la propia fila (`select_own`) o a verificados (`select_public`). El residual —un usuario logueado puede leer `bank_data` de un vendedor **verificado**— se cierra en F2 moviendo esas tres lecturas al BFF.

**Verificación.** `begin; set local role anon; select bank_data from vendor_profiles; rollback;` → `42501 permission denied`. `select id, slug, display_name from vendor_profiles` como `anon` sigue devolviendo filas.

### 1.2 A1 · El padre fija monto y estado de un pago

**Hoy.** Las policies `Payments: insert parent/athlete` solo exigen `parent_id/user_id = auth.uid()`, y `Payments: update parent` deja cambiar cualquier columna. Ningún trigger protege `status` ni `amount`. Al quedar `paid` se disparan la extensión de vigencia, el torniquete y el ingreso en el libro.

**Radio medido (60 días, `audit_logs`):** 103 INSERT y ~219 UPDATE de cliente hechos por no-staff. **Cero** INSERT en `paid`. Todos los INSERT fueron en una escuela donde el actor ya era miembro. Los UPDATE solo cambiaron `status` (→ `awaiting_approval`), `payment_date` y, 4 veces, `period_*`. **Bug real que esto cierra:** dos veces (30-sep, 01-oct) un padre pasó un pago ya aprobado de `paid` a `awaiting_approval`; el cobro `3490fed0…` sigue así.

**Cambio — trigger `trg_zz_guard_payments_client` (BEFORE INSERT OR UPDATE).**
- Solo actúa cuando `current_user IN ('authenticated','anon')` — es decir, una escritura directa por PostgREST con el JWT del usuario. Las 35 RPC que escriben `payments` son `SECURITY DEFINER` de `postgres` y el BFF usa `service_role`: ninguna de las dos pasa por el guard.
- **La función del trigger es `SECURITY INVOKER`** (si fuera DEFINER, `current_user` sería siempre `postgres` y el guard no haría nada). Llama a `user_staff_school_ids()` (DEFINER), **no** a `staff_school_ids()`: la segunda deja por fuera a los owners que solo figuran en `schools.owner_id`.
- Si `school_id` está en `user_staff_school_ids()` → pasa (staff).
- **No-staff, INSERT:** `status` debe ser `pending` o `awaiting_approval`; `amount_paid`, `approved_at`, `approved_by`, `late_fee_amount`, `late_fee_applied_at`, `sportmaps_fee`, `epayco_fee`, `gross_amount` deben venir nulos o en su valor por defecto.
- **No-staff, UPDATE:**
  - `OLD.status IN ('paid','glosado','cancelled')` → no se puede tocar nada (salvo una reescritura idéntica).
  - `status` solo puede pasar a `awaiting_approval` desde `pending, overdue, partial, rejected, failed, awaiting_approval`. Igual a igual, permitido.
  - Columnas **inmutables** para no-staff (comparadas con `IS DISTINCT FROM`, para que reescribir el mismo valor no falle): `amount, amount_paid, school_id, branch_id, offering_plan_id, team_id, child_id, parent_id, user_id, unregistered_athlete_id, late_fee_amount, late_fee_applied_at, approved_at, approved_by, sportmaps_fee, epayco_fee, gross_amount, payment_category, period_uniqueness_exempt, early_payment_discount_applied, due_date, concept, payment_type, provider_transaction_id`.
  - `period_year/period_month`: solo si `OLD` era nulo (el modal los estampa al reusar un cobro).
  - `payment_date`: solo si `NEW.status = 'awaiting_approval'` (fecha del comprobante).
  - Todo lo demás (comprobante, OCR, veredicto, método) se puede cambiar.
- Error: `SQLSTATE 42501`, mensaje `PAYMENT_FIELD_LOCKED: <columna>`.

> **Limitación conocida (F2):** en el INSERT el monto lo sigue mandando el cliente (`PaymentCheckoutModal`). El guard impide que se marque `paid`, y la escuela aprueba cada comprobante a mano, pero en Wompi se cobra el monto que mande el cliente. Eso es A2 y va en F2 con una RPC que tome el precio del catálogo o del plan.

**Cambio de frontend que va en el mismo despliegue.**
- `ParentCheckoutPage.tsx` · Wompi APPROVED: deja de escribir `status='paid'` y `payment_date`. El webhook del BFF (`wompi.ts`, que verifica monto contra `payment_links` e idempotencia) es quien marca `paid`. La página muestra "Pago recibido, confirmando…" y reconsulta.
- `ParentCheckoutPage.tsx` · `recordPaymentWithTraceability`: filtrar por `status IN (pending, overdue, partial, rejected, failed, awaiting_approval)` y **propagar el error** (hoy hace `return` y la pantalla muestra éxito igual).
- `PaymentCheckoutModal.tsx`: borrar el camino de MercadoPago client-side que marca `paid` (muerto por el kill switch SEG-23, origen del caso de $2.500) y el camino manual `paid` inalcanzable.

**Orden de despliegue.** Frontend primero (deja de escribir `paid`), después el trigger. Si se aplica el trigger antes, un padre que paga por Wompi ve un error aunque el webhook sí registre el pago.

### 1.3 Tienda apagada + T2 · autoverificación de vendedores

**Por qué apagar y no cerrar la tabla.** `vendor_profiles` no es solo de la tienda: la usan wellness, el entrenador personal, 12 planes `school_monthly` de escuelas reales, `can_manage_finances('vendor', …)` y 9 policies de otras tablas. Se apaga **la tienda** (productos, carrito, órdenes, reembolsos, mensajes), no la tabla.

**Uso real que se pierde: cero.** 1 orden seed, 3 productos demo, 0 variantes, 0 reembolsos, 0 settlements, 0 conversaciones.

**Mecanismo.**
- Fila `platform_config (key='store_enabled', value='{"enabled": false}')`.
- `public.store_enabled()` — `SECURITY DEFINER STABLE`, `search_path` fijo, `REVOKE` de `PUBLIC/anon/authenticated` y luego `GRANT EXECUTE` a `anon, authenticated` (solo devuelve un booleano).
- Policies **RESTRICTIVE** nuevas `store_off_*` con `public.store_enabled()` sobre: INSERT/UPDATE de `orders`, INSERT de `order_items`, INSERT/UPDATE de `products` y `product_variants`, INSERT de `refunds`, INSERT de `store_messages`, y SELECT de `products`/`product_variants` **para `anon`** (desaparecen de la vitrina pública). El dueño y el comprador siguen viendo su historial.
- Reprender: `UPDATE platform_config SET value='{"enabled":true}' WHERE key='store_enabled'`. Sin deploy.

**T2 — trigger `trg_guard_vendor_profiles` (BEFORE INSERT OR UPDATE), INVOKER.**
- Pasa si `auth.role() = 'service_role'`, `current_user` es `postgres` sin JWT, o `is_super_admin()`.
- UPDATE: rechaza cambios (`IS DISTINCT FROM`) en `verification_status, commission_rate, capabilities, vendor_type, user_id, avg_rating, reviews_count`. El upsert de `WellnessOnboarding` reescribe `vendor_type` y `capabilities` con el mismo valor, así que no se rompe.
- INSERT: fuerza `verification_status='pending'` y `commission_rate` al default de la columna.
- Como `enable_vendor_profile` es DEFINER pero `auth.role()` sigue siendo `authenticated`, también queda cubierta.
- `vendor_profiles_update_own` recibe `WITH CHECK (user_id = auth.uid())`.

**T3/T4 (órdenes editables por el comprador)** quedan cerradas mientras `store_enabled = false`. Rehacer la tienda (RPC `create_cart_order` transaccional con precios de la base) es requisito para volver a prenderla — ver §4.

**Capas fuera de la base (mismo despliegue).**
- BFF: middleware `requireStoreEnabled` → `503 STORE_DISABLED` en `/marketplace/orders`, `/vendor/products`, `/checkout/cart`, `/refund*`, shipping, payouts, `/marketplace/products/:id`, `/marketplace/vendor/:slug`, `/marketplace/school-store/:schoolId`. **No** en `/vendor/profile|availability|stats|services`, `/trainer`, `/checkout/session-booking`, webhooks, `/invoicing`. El cron `autoEmitPendingOrders` se salta con la tienda apagada.
- Frontend: hook `useStoreEnabled()`. Con la tienda apagada se ocultan el ítem "Tienda" del padre, `/shop`, el grupo "Mi Tienda", el carrito y los productos de Explorar; las rutas de tienda muestran "Tienda no disponible". Se conservan `/vendor/services|appointments|dashboard|public-profile|onboarding` (wellness).

### 1.4 C1 + C2 · Cálculo de nómina

- **C1** `post_payroll_run`: el egreso pasa de `total_net + total_employer` a **`total_gross + total_employer`**. Lo deducido al empleado (salud, pensión, FSP) también sale de la caja de la escuela, por la PILA. `run_payroll` devuelve `cash_cost` con la misma fórmula, y `PayrollPage.tsx` muestra "Costo caja" igual.
- **C2** `run_payroll`: `v_int := round(v_ces * c.intereses_cesantias_pct)` (sin el `/ 12`: la cesantía ya es mensual).
- Datos: la única nómina posteada es de Escuela Demo. **No se reescribe** (no es dinero real); queda anotado.
- Aviso de año sin parámetros: `PayrollPage` muestra el error `no_config_for_year` con texto claro ("Faltan los parámetros de nómina de 2027 — los carga SportMaps"), en vez de un error genérico.

---

## 2. Fase 2 — integridad del libro

| # | Qué | Hallazgo |
|---|---|---|
| 2.1 | RPC `create_catalog_purchase` (precio desde `school_merchandise_items`/`school_tournament_items`, exige `active` y toggle, membresía) y el guard pasa a congelar `amount` también en el INSERT de no-staff | A2 |
| 2.2 | `cash_ledger`: ingresos filtrados por `can_manage_finances` | C4 / D-B |
| 2.3 | Egresos inmutables: sin DELETE directo, anular = `void` que revierte saldo de proveedor y egreso de nómina; `CHECK amount_paid <= amount`; auditoría en `expenses`, `supplier_bills`, `payroll_runs` | C5 |
| 2.4 | Movimiento de reverso de pago fechado el día de la anulación + UI "Anular pago" | plan de salida §2 |
| 2.5 | Bloqueo de escritura en mes cerrado | plan de salida §2 |
| 2.6 | Guard DIAN: no emitir factura de un pago que no esté `paid`; investigar la del 01-oct | plan de salida §2 |
| 2.7 | Libro y estado de resultados con período y paginación | plan de salida §2 |
| 2.8 | `apply_late_fees` excluye `articulos`/`torneo` | A6 / D-D |
| 2.9 | Guards de toggles también en INSERT; `school_payment_kpis` con `branch_id IS NULL` | A5, A3 |
| 2.10 | Lecturas sensibles de `vendor_profiles` al BFF + REVOKE de columnas a `authenticated` | cierre de T1 |

## 3. Fase 3 — calidad del dato

A4 (estampar `payment_category` en los 14 caminos + backfill), C6 (`trial_block` para vendor/organizer), C7–C9 (limpieza GYM RM dentro de DIN-1 §8), A7 (desglose en pantalla), C10, y el resto del código contable (CSV, UTC, `owner_type`).

## 4. Requisito para volver a prender la tienda

T3, T4, T5, T6 (órdenes, ítems, productos y stock solo por RPC `SECURITY DEFINER` con `FOR UPDATE` y precios de la base), T7 (un solo libro de payout), T8 (quitar la sobrecarga de `confirm_order_payment`), T9 (reembolsos), T15 (carrito al checkout del BFF), T16 (IVA según `products.tax_rate`, envío según modalidad), T17 (gate del addon en RLS y BFF), T20 (factura de órdenes).

---

## 5. Plan de migraciones — Fase 1

| # | Migración | Contenido | Depende de | Prueba antes de aplicar |
|---|---|---|---|---|
| M1 | `vendor_profiles_columnas_publicas_anon` | REVOKE/GRANT por columna a `anon` en `vendor_profiles`; REVOKE `anon` en `vendor_bank_accounts` | — | `begin; set local role anon; select bank_data …` → 42501; embed publicable sigue |
| M2 | `guard_payments_escritura_cliente` | función INVOKER + trigger `trg_zz_guard_payments_client` | frontend de §1.2 desplegado | dentro de `BEGIN…ROLLBACK`, simulando un padre real: INSERT `paid` → 42501; INSERT `awaiting_approval` → ok; UPDATE `pending→awaiting_approval` con comprobante → ok; UPDATE `amount` → 42501; UPDATE sobre `paid` → 42501; staff UPDATE → ok |
| M3 | `tienda_apagada_y_guard_vendor_profiles` | `platform_config.store_enabled`, `store_enabled()`, policies RESTRICTIVE `store_off_*`, trigger `trg_guard_vendor_profiles`, `WITH CHECK` en `update_own` | — (el BFF/frontend degradan solos ante 403) | simulando un comprador: INSERT `orders` → falla; UPDATE `orders.total_amount` → falla; vendedor UPDATE `commission_rate` → 42501; wellness upsert idéntico → ok; `anon` ve 0 productos |
| M4 | `nomina_egreso_bruto_e_intereses_cesantias` | `CREATE OR REPLACE` de `post_payroll_run` y `run_payroll` | — | recalcular la nómina demo dentro de `BEGIN…ROLLBACK`: intereses ≈ 21.991, `cash_cost` = bruto + patronal |

Cada migración lleva `SET search_path = pg_catalog, public, pg_temp`, GRANT/REVOKE explícitos y no edita ninguna anterior.

## 6. QA de la Fase 1

| Caso | Dónde | Esperado |
|---|---|---|
| Anónimo pide `bank_data` | SQL `set local role anon` | 42501 |
| Explorar y vitrina con embed `vendor_profiles!inner` | navegador / SQL anon con columnas publicables | funciona |
| Padre sube comprobante a un cobro `pending`/`overdue` | SQL simulado + Playwright | `awaiting_approval`, sin error |
| Padre intenta `paid` (INSERT o UPDATE) | SQL simulado | 42501 `PAYMENT_FIELD_LOCKED: status` |
| Padre cambia `amount` | SQL simulado | 42501 |
| Padre toca un cobro ya `paid` | SQL simulado | 42501 |
| Owner/admin aprueba un comprobante | SQL simulado | ok |
| Webhook Wompi marca `paid` (service role) | SQL como `service_role` | ok |
| RPC de alta por QR (DEFINER) | SQL | ok |
| Comprador inserta/edita orden con tienda apagada | SQL simulado | falla |
| Vendedor se pone `verified` o comisión 0 | SQL simulado | 42501 |
| Wellness reescribe su perfil sin cambiar tipo/capacidades | SQL simulado | ok |
| Nómina demo recalculada | SQL en `ROLLBACK` | intereses ×12, egreso = bruto + patronal |
| `npm run seguridad:invariantes` | CLI | 0 CRÍTICAS; las I3 de tienda no suben |
| `tsc` frontend + BFF, vitest | CLI | verde |
