# Auditoría — Contabilidad, Tienda e Ingresos/Egresos

**Fecha:** 2026-10-02 · **Rama:** `develop` · **Base:** `luebjarufsiadojhvxgi` (la única Supabase)
**Método:** 5 auditorías en paralelo, todas **solo lectura** (SELECT y `BEGIN; SET LOCAL ROLE …; ROLLBACK`). No se escribió en la base, no se tocó código, no se explotó ningún hallazgo.
**Complemento:** el mapa por flujo, el plan de pruebas (~55 casos) y el QA ejecutado viven en [`plan-salida-ingresos-egresos-2026-10-02.md`](plan-salida-ingresos-egresos-2026-10-02.md).

> **Lectura en una línea.** Lo grave no está en las tablas contables sino en lo que las alimenta: **`payments` y `orders` aceptan monto y estado desde el navegador**. Antes de salir con ingresos/egresos hay que cerrar eso; lo demás es corrección de cálculo, datos sucios y huecos funcionales.

---

## 0. Uso real (por qué el daño hoy es acotado)

| Pieza | Uso real |
|---|---|
| Contabilidad (gastos, proveedores, nómina, presupuesto) | **Ninguna escuela real tiene un movimiento.** 9 gastos, 3 facturas, 1 nómina — todo en Escuela Demo y MMA Blair (prueba). Addon `accounting` real: Monster's y "Mi Escuela", ambas en 0 |
| Tienda / marketplace | 1 orden (seed, jul-2026), 0 settlements, 0 payouts, 3 productos demo. Addon `store` en 7 escuelas (Monster's desde hoy) |
| Artículos / Torneos | Besser con los dos toggles ON y **0 ítems**. 3 pagos de prueba en Club Campestre Demo |
| Ingresos (`payments`) | Sí hay dinero real: Dynasty $86,85M histórico, GYM RM, Besser |

`npm run seguridad:invariantes`: **0 CRÍTICAS**, 58 ALTA (50 × I3 `FOR ALL` sin `WITH CHECK`, 8 vistas definer expuestas a `anon`). El script **no detecta** los hallazgos CRÍTICOS de abajo: son policies con `WITH CHECK` presente pero demasiado amplio.

---

## 1. CRÍTICAS — verificadas en la base

| ID | Hallazgo | Evidencia | Impacto |
|---|---|---|---|
| **A1** | **Un padre/atleta puede insertar o marcar como `paid` un pago, con el monto que quiera, en cualquier escuela operativa** | `Payments: insert parent` = `WITH CHECK (parent_id = auth.uid())`; `insert athlete` = `user_id = auth.uid()`; `update parent` deja cambiar cualquier columna de sus cobros. Ningún trigger BEFORE protege `status`/`amount`/`amount_paid`/`school_id` (solo `fn_payments_fill_period`, `clear_payment_review_on_settle`, `set_updated_at`). `audit_logs` ya tiene 1 INSERT `paid` hecho por un `parent` (MP, $2.500) | Al quedar `paid` se disparan `trg_extend_enrollment_on_payment_paid` (vigencia gratis), `trg_sync_access_group_on_payment` (torniquete) y el ingreso aparece en `cash_ledger`, KPIs y dashboard |
| **A2** | **El precio de Artículos y Torneos lo fija el navegador** | `PaymentCheckoutModal.tsx:328-336` suma `price*qty` en el cliente; los 4 INSERT mandan `amount: finalAmount`. BFF `/create-session` (`payments.routes.ts:76-81`) cobra el `amount` de la fila sin compararlo con el catálogo. El toggle solo se mira en la UI | Se compra a cualquier precio, ítems inactivos o de otra escuela. En Wompi se cobra exactamente el monto manipulado |
| **T1** | **Un anónimo lee datos bancarios de vendedores** | `vendor_profiles_select_public` (`{public}`) + GRANT de todas las columnas a `anon`. Comprobado como `anon`: `mmm-team-products` (MMA BLAIR TEAM) expone `bank_data` (banco, tipo, titular, **número de cuenta**, documento), teléfono y `verification_doc_url`. Además `GET /marketplace/vendor/:slug` hace `select('*')` con service role sobre los 33 perfiles | **Fuga viva de datos financieros.** Trampa 4 del CLAUDE.md (RLS filtra filas, no columnas) |
| **T2** | **Cualquier usuario se autoverifica como vendedor, con comisión 0** | `vendor_profiles_update_own` sin protección de columnas; ningún trigger guarda `verification_status`, `commission_rate`, `capabilities`, `vendor_type`. `enable_vendor_profile` deja ponerse `vendor_type='school'` sin addon | Productos sin revisión; liquidaciones con 0% de comisión |
| **T3** | **El comprador edita su orden: total y estado** | `orders_update_buyer` sin `WITH CHECK` ni límite de columnas; `orders.status` sin CHECK. `wompi-sign` firma con `orders.total_amount` de la base y el webhook compara contra ese mismo total | (a) paga $1.000 una orden de $205.000; (b) se pone `paid` y el cron `autoEmitPendingOrders` (cada 15 min) **emite factura electrónica real** de una venta no pagada |
| **T4** | **El comprador inserta órdenes e ítems con precio y vendedor arbitrarios** | `orders_insert_buyer` / `order_items_insert_buyer` sin validar `unit_price`, `vendor_id`, `product_id`. `POST /marketplace/orders` toma precios del body (`marketplace-orders.routes.ts:23-65`) | Saldo inflado acreditado a cualquier vendedor, incluido uno mismo |

---

## 2. ALTAS

### Pagos e ingresos
| ID | Hallazgo | Evidencia |
|---|---|---|
| A3 | `school_payment_kpis(p_branch_id)` excluye pagos sin sede | Dynasty con sede: $52,38M vs `cash_ledger` $86,85M (−$34,47M). Las otras dos vías usan `branch_id IS NULL OR =` |
| A4 | Solo 1 de 14 funciones vivas que crean pagos estampa `payment_category` | 4.128 NULL vs 851 con valor; 0 `inscripcion`. Dynasty ago+sep: 69% "sin categoría". Caminos sin estampar: alta del BFF, QR, registro manual, importación masiva, `ParentCheckoutPage`, recurring |
| C7 | Las tres agregaciones de ingreso no cuadran en GYM RM | Ago-2026: dashboard $2,999M vs libro/KPIs $2,571M. El dashboard suma `amount`; el libro `LEAST(amount, amount_paid)`. 73 `paid` con `amount_paid < amount`, 10 con excedente ($913.200 que nadie cuenta). Dynasty y Besser sí cuadran |

### Contabilidad
| ID | Hallazgo | Evidencia |
|---|---|---|
| C1 | El egreso de nómina omite las deducciones del empleado | `post_payroll_run`: `total_net + total_employer`. Debe ser bruto + patronal (la escuela paga la PILA completa). Nómina demo: $2.370.440 asentado vs $2.530.440 real. La UI repite el error (`PayrollPage.tsx:125, 270, 353`) |
| C2 | Intereses de cesantías 12× más bajos | `run_payroll`: `v_ces * 0,12 / 12` sobre una cesantía ya mensual. Fila viva: 1.833 vs ~21.991 |
| C3 | `payroll_config` "2026" tiene valores de 2025, y no hay 2027 | SMMLV 1.423.500 (oficial 2026: **1.750.905**, Dec. 1469/2025), auxilio 200.000 (**249.095**, Dec. 1470/2025), UVT 49.799 (**52.374**). Sin fila 2027 → la nómina de enero falla con `no_config_for_year`. Confirmar si hubo ajuste a mitad de año |
| C4 | Un coach ve todos los ingresos de su escuela | `cash_ledger` es `security_invoker` y hereda `Payments: select staff` (incluye coaches). Coach de Dynasty simulado: 559 filas, $86,85M. `school_payment_kpis()` sí lo bloquea |

### Tienda
| ID | Hallazgo |
|---|---|
| T5 | Cualquier autenticado inserta productos públicos sin ser vendedor, o colgados del perfil de otro, o en la tienda `school_only` de otra escuela (los guards solo validan si `vendor_profile_id IS NOT NULL` y nunca comprueban que sea suyo) |
| T6 | Stock editable desde el cliente (`useStoreData.ts:40-45`, `useProducts.ts:46-49`) — viola la regla de stock por RPC con `FOR UPDATE` |
| T7 | Dos motores de payout en el mismo webhook (`split_order_payment` 5%+2,65% sobre subtotal+IVA vs `compute_settlements_for_order` 10%+2,5% sin IVA), más `admin_generate_pending_payouts` → doble pago potencial, sin redondeo a pesos |
| T8 | `confirm_order_payment` tiene 2 sobrecargas con DEFAULT → probable `PGRST203` en el webhook: la orden quedaría en `payment_review` sin descontar stock (inferido, no probado) |
| T9 | Reembolsos muertos (`request_refund`/`approve_refund` usan `auth.uid()` pero el BFF los llama con service role) y a la vez `refunds` insertable por el usuario con monto y estado libres; `complete_refund` repone stock dos veces si se llama dos veces |
| T15 | El carrito real (`CartDrawer` → `CheckoutPage`) usa el flujo viejo: total del cliente, orden creada **después** del pago con precios de `localStorage`, referencia `SCH-` que `wompi-sign` no resuelve. El camino correcto (`/checkout/cart` del BFF) solo lo usa `CartCheckoutModal` |
| T16 | `/checkout/cart` (bien: precio desde la base) pero: IVA 19% hardcodeado **sumado encima** (spec dice incluido), envío $18.000 por defecto aunque sea retiro, orden+ítems no transaccional, sin reserva de stock; `/checkout/service|event|subscription` dan 500 (tablas inexistentes) |
| T17 | **El gate del addon `store` no existe en ninguna capa** (ni RLS, ni BFF, ni vitrina pública). `VendorGuard` es solo frontend. Las 14 vitrinas de escuela responden |

---

## 3. MEDIAS y BAJAS

**Pagos / catálogos**
- A5 · El guard de los toggles `merchandise_enabled`/`tournament_charges_enabled` es solo `BEFORE UPDATE`: un admin lo salta con DELETE+INSERT de su `school_settings`, sin auditoría.
- A6 · `apply_late_fees` cobra mora sobre artículos y torneos. Caso real: torneo de $341.000 → $358.050 (Campestre). Athletic Soacha tiene torneos ON con 15% de mora.
- A7 · El desglose por categoría ya está calculado (`cash_ledger.payment_category`, `revenue_articulos/torneo`) pero ninguna pantalla lo muestra.
- C8 · 55 pagos `paid` de GYM RM sin `payment_date` ($3,85M; 66 en total) — suman en el total histórico y desaparecen del estado de resultados.
- C9 · 75 pagos `cancelled` con `amount_paid > 0` (1 real de GYM RM, $70.000; el resto de prueba). Falta decidir: ¿reembolso pendiente o ingreso?
- Reverso: no existe movimiento de anulación; una anulación borra el ingreso del mes original. 77 transiciones `paid→cancelled` sin actor.
- Factura DIAN aceptada el 01-oct sobre un pago que hoy está `awaiting_approval` — investigar (plan de salida §2).

**Contabilidad**
- C5 · Admin puede UPDATE/DELETE directo `supplier_bills.amount_paid/status` (sin `CHECK amount_paid <= amount`) y `payroll_runs` (`void` → repost = **segundo egreso**; borrar el egreso deja la nómina `paid` sin egreso). Las RPC sí están bien (`FOR UPDATE`, rechazan sobrepago, idempotentes).
- C6 · `trial_block_*` en `expenses` con `school_is_operational(NULL)` = NULL → **ningún vendor/organizer puede escribir egresos**. Y el bloqueo solo está en `expenses`.
- Sin cierre de mes efectivo: `close_month` es una foto; nada impide escribir en un mes cerrado.
- Sin auditoría (quién cambió qué) en `expenses`, `supplier_bills`, `payroll_runs`.
- Gate del addon `accounting` solo en UI (RLS no mira `school_addons`); `ModuleGate` no aplica al rol `admin`.
- Libro de `/accounting` sin período ni paginación → riesgo de truncado a 1.000 filas (Dynasty: 559). `max_rows` real no verificado.
- Presupuesto: si falla la consulta de ejecutado muestra **$0 sin aviso**; ejecutado por `expense_date` vs libro por `paid_date`.
- Gasto + adjunto = 3 escrituras sueltas desde el cliente; el INSERT del adjunto no revisa error.
- `todayIso()` en UTC (después de las 19:00 Bogotá propone mañana). CSV sin escape de comas ni BOM. `owner_type='school'` hardcodeado en 5 páginas + `InvoicingTab`.
- C10 · El trigger fee de pasarela → egreso nunca se ha disparado (los 49 pagos con fee son `fee_payer='parent'`), ignora `split`, no revierte.
- C11 · `anon`/`PUBLIC` con grants y EXECUTE en tablas y RPC contables (la RLS lo frena — probado — pero es trampa 3).

**Tienda**
- T10 · El vendedor modera (status/rating) las reseñas de sus propios productos.
- T11 · I3 en `product_images_vendor_all`, `mp_shipping_rates_owner`, `shipments_vendor`.
- T18 · `GET /api/v1/marketplace` (Explorar) da 500: pasa `p_modality` a una `search_marketplace` viva que no lo tiene (mig `20260520000001` no aplicada).
- T19 · `TiendaPublicaPage`/`MiTiendaPage` convierten cualquier error en "no encontrada".
- T20 · Factura electrónica de órdenes: sin envío, IVA que no cuadra con lo cobrado, emisor equivocado (escuela vs vendor `store`), y emite para cualquier orden `paid` (que el comprador puede fijar, T3).

---

## 4. Lo que está bien (verificado)

- Tablas contables: ningún `USING(true)` sobre datos privados, todos los `FOR ALL` con `WITH CHECK`, sin recursión, `anon` lee 0 filas. `can_manage_finances` excluye coach y reporter. Bucket `accounting-receipts` privado, 10 MB, tipos acotados, policies atadas al egreso.
- `pay_supplier_bill`, `run_payroll`, `post_payroll_run`: validan permiso, `FOR UPDATE`, rechazan sobrepago, no recalculan nómina cerrada.
- Catálogos: policies correctas, sin grants a `anon`, RPCs `admin_*` `SECURITY DEFINER` con `search_path` y `is_super_admin()`. Todos los toggles los prendió un super admin.
- Webhook Wompi: checksum, reconsulta a la API, exige COP, deduplica por `txId:status`. `confirm_order_payment` idempotente y con `FOR UPDATE` sobre stock. `release_settlements_*` cerrado a service role (SEG-26). Un comprador no ve órdenes ajenas.
- Dynasty y Besser: las tres vías de ingreso cuadran al peso en ago/sep.
- QA ejecutado: `tsc` frontend (tsconfig.app) y bff en 0 errores; bff vitest 378 ✓; frontend vitest 97 ✓. **No hay ni un test de contabilidad, nómina, proveedores, libro ni tienda.** Playwright no se corrió: el local apunta a la única Supabase (producción).

---

## 5. El ROADMAP quedó desactualizado

- **§1 "Seguridad: sin hallazgos explotables abiertos"** — falso por A1, T1, T2, T3, T4.
- **MOD-11** dice que el riesgo de la tienda es "teórico porque la tabla no existe" — `orders`, `products`, `vendor_profiles` están vivas y abiertas.
- **ERP-4** da el motor de nómina por hecho — existe pero calcula mal (C1, C2) con parámetros de 2025 (C3).
- **ERP-2** dice que el pago parcial a proveedor llega con el libro mayor — ya está vivo en `pay_supplier_bill`.
- Ya hechos y marcados pendientes: **DIN-3** (backfill aplicado), **DIN-6** (`hasGatewayAddon` sí se invoca), **§3.3 #9** (`monthly_closes` existe, 5 filas).
- **DIN-19 confirmado:** 12 jobs en `pg_cron`, ninguno llama al autopay canónico; solo corre el legacy (BFF 02:00) y el comentario de `maintenance.job.ts:53` miente.
- Conteos: SEG-18 = 50 (no 53); SEG-2 = 8 vistas (no 3).
- **INF-7 sigue mordiendo:** ninguna migración contable ni las de 20260921 figuran en `schema_migrations`, aunque todas están vivas.
- **~30 hallazgos de esta auditoría no tienen ID** en el roadmap (A1–A7, T1–T20, C1–C11).

---

## 6. Decisiones de producto que bloquean salir

| # | Decisión | Por qué bloquea |
|---|---|---|
| D-A | **¿La tienda sale o se apaga?** | Uso real ≈ 0 y 4 CRÍTICAS. Apagarla bien (gate real del addon en RLS + BFF + vitrina, y cerrar T1) es barato; arreglarla para salir es 2–3 semanas |
| D-B | ¿El coach ve ingresos? | C4. Hay memoria de "coach sin dinero" con flags por escuela (Besser) |
| D-C | ¿Nómina entra en esta salida o se oculta hasta corregir C1–C3? | Calcula mal hoy |
| D-D | ¿Mora sobre artículos y torneos? | A6 |
| D-E | IVA en tienda: ¿incluido o sumado? ¿envío por defecto? | T16 / T20 |
| D-F | ¿Qué motor de payout y qué comisión manda? | T7 |
| D-G | ¿Se agenda el autopay canónico o se jubila el legacy? | DIN-19 |
| D-H | Perímetro del ingreso: ¿tienda, reservas y delegaciones entran al libro? | Hoy están fuera de `cash_ledger` |
| D-I | `cancelled` con abono: ¿reembolso pendiente o ingreso? | C9 |
| — | Ya en el roadmap: las 4 de DIN-1 §8, D-PUC / D-T / D-CORTE / D-MIG (ERP-2), D-NOM, D-ROL, D1/D2/D4-pagos | |

---

## 7. Orden unificado para salir y probar

### P0 — bloquea salir
| # | Qué | Tamaño |
|---|---|---|
| 1 | **A1** — trigger BEFORE INSERT/UPDATE en `payments`: quien no es staff (`user_staff_school_ids()`) solo crea `pending`/`awaiting_approval`, debe ser miembro de `school_id`, y no toca `amount`, `amount_paid`, `status`, `offering_plan_id`, `late_fee_*`. Mover el `paid` de MercadoPago al webhook del BFF. **Medir el radio antes** (qué flujos legítimos del cliente escriben esas columnas hoy) | M |
| 2 | **T1** — vista `v_vendor_profiles_publico` sin `bank_data`/`nit`/`verification_doc_url`/`commission_rate`, REVOKE de columnas a `anon`, `select` explícito en el BFF. **Es fuga viva: va primero aunque la tienda se apague** | S |
| 3 | **D-A + T17** — si la tienda se apaga: gate real del addon en RLS y BFF, y cerrar T2/T3/T4 al menos quitando la escritura directa. Si sale: RPC `create_cart_order` transaccional con precios de la base y `FOR UPDATE` (T3, T4, T13) | S / L |
| 4 | **A2** — RPC `create_catalog_purchase` que tome el precio del catálogo, exija `active` y el toggle | S |
| 5 | **C4** según D-B | XS–S |
| 6 | **C3** — corregir `payroll_config` 2026 y cargar 2027; **C1** (egreso = bruto + patronal) y **C2** (quitar `/12`) — o esconder nómina (D-C) | XS |
| 7 | Egresos inmutables: quitar DELETE, anular con `void` revirtiendo saldo, `CHECK amount_paid <= amount`, auditoría en `expenses`/`supplier_bills`/`payroll_runs` (C5) | S |
| 8 | Reverso de pago fechado el día de la anulación + UI "Anular pago" | M |
| 9 | Bloqueo de mes cerrado (trigger sobre `close_month`) | M |
| 10 | Factura DIAN sobre pago `awaiting_approval`: investigar + guard | S |
| 11 | Libro y estado de resultados con período y paginación | S |
| 12 | Desplegar DIN-11/12, verificar pago real de Dynasty (P0#0.2), DIN-9, DIN-19 (D-G) | deploy |
| 13 | Tests mínimos (SQL de RLS negativos + Playwright) para 1–11 | M |

### P1 — salir con riesgo aceptado
A3 · A4 (estampar categoría en los 14 caminos + backfill) · A5 · A6 · C6 · C7–C9 (limpieza de datos GYM RM, dentro de DIN-1 §8) · DIN-1 · CONC-1 · SEG-18 sobre tablas de dinero · UX-14(a) · UX-2 F-01 (error como $0) · si la tienda sigue: T5, T6, T8, T9, T15, T18 · actualizar el ROADMAP (§5).

### P2 — después
A7 (desglose en pantalla) · T7 (un solo libro de payout) · T16 · T20 con DIN-8 · C10 · resto del código contable (CSV, UTC, `owner_type`, multi-owner vendor/organizer) · D-PUC/D-T/D-CORTE/D-MIG → ERP-2 → 3 → 4 → 5 · DIN-5 · DIN-6 · MOD-11 · DIN-13/16/17.

---

**Regla de cierre:** cada fix de RLS se mide antes (radio) y se verifica después contra la base viva (`set local role …`), no contra el repo. Después de cada tanda: `npm run seguridad:invariantes`. Migraciones por `npm run migrations:new` y aplicadas por una vía que deje rastro.
