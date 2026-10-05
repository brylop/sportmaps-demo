# Plan de salida — Ingresos y Egresos (módulo financiero completo)

**Fecha:** 2026-10-02 · **Rama:** `develop` · **Tipo:** auditoría funcional y de completitud (solo lectura)
**Alcance:** Finanzas, Contabilidad (libro de caja), Proveedores/CxP, Nómina, Presupuesto, Estado de
resultados, Cierre de mes, Facturación electrónica, Tienda/catálogos, Reservas, Delegaciones.
**Fuera de alcance (lo hacen otros agentes en paralelo):** RLS/seguridad de contabilidad y de tienda, y la
conciliación de las tres agregaciones de ingreso (`cash_ledger` / `school_payment_kpis` /
`useDashboardStatsReal`). Cuando un hallazgo toca esos temas se marca **[coordinar]** y no se profundiza.

**Método.** Todo lo que dice «vivo» se verificó **contra la base** (`pg_class`, `pg_proc`, `pg_trigger`,
`cron.job`, conteos reales) el 2026-10-02, no contra el repo. El código se leyó en `frontend/src` y
`bff/src`. No se escribió nada en la base, no se tocó código de producto.

**Lo que NO verifiqué** (dicho de entrada, para no venderlo como hecho):
- El valor real de `max_rows` de PostgREST en este proyecto (asumo el default de Supabase, 1.000).
- Por qué 73 pagos manuales de Dynasty desde el 1-sep no tienen factura electrónica aceptada.
- Ningún flujo de pasarela de punta a punta (no se crearon pagos).
- Las specs Playwright no se ejecutaron (todas pegan a la **única** Supabase compartida; ver §3).
- La estabilidad de `open_month` / duplicados (`DIN-1`) — es otro frente y no la re-medí.

---

## 0. Resumen en una pantalla

1. **El libro (`cash_ledger`) es una vista de dos tablas: `payments` (`paid`/`partial`) y `expenses`
   (`paid`).** Todo lo que no escriba en una de esas dos **no existe** para Contabilidad, Estado de
   resultados ni Presupuesto. Hoy quedan fuera: **ventas de tienda (`orders`), pagos de reservas
   (`reservation_payments`), pagos de delegaciones (`event_delegation_payments`), reembolsos
   (`refunds`), la comisión real de la pasarela, y el recargo online** (el libro toma `amount`, no
   `gross_amount`).
2. **Las correcciones reescriben el pasado.** No hay movimiento de reverso: anular o reembolsar un
   pago cobrado le cambia el `status` y el ingreso **desaparece del mes en que entró**. Ya pasó 77 veces
   (`paid → cancelled`, todas sin actor, por SQL). Y `close_month` es una **foto**, no un candado:
   no hay ningún trigger que impida escribir en un mes cerrado.
3. **Los egresos se pueden borrar sin rastro.** `expenses` tiene policy `DELETE`, la UI no tiene
   «anular», y `expenses`/`supplier_bills`/`payroll_runs` no tienen trigger de auditoría (`payments` sí).
   Borrar el egreso de un pago a proveedor deja la factura marcada como pagada.
4. **Nómina subregistra la salida de caja.** `post_payroll_run` asienta `neto + aportes patronales` y
   omite las deducciones del empleado (salud/pensión retenidas que la escuela paga por PILA). Medido en
   la única corrida viva (jul-2026): asentó **$2.370.440**, la salida real es **$2.530.440** (−$160.000).
   Además `payroll_config` solo tiene 2026: **la nómina de enero 2027 va a fallar** (`no_config_for_year`).
5. **Facturación electrónica: una factura DIAN aceptada sobre un pago que hoy está
   `awaiting_approval`** (emitida 01-oct 12:00, el pago volvió a revisión 15:21). No hay guard que impida
   des-pagar un pago facturado sin nota crédito.
6. **Uso real casi nulo de la parte de egresos:** 9 gastos en total (2 dueños: la escuela demo y MMA
   Blair), 3 facturas de proveedor, 1 corrida de nómina, 8 presupuestos. El ingreso sí es real:
   1.137 pagos cobrados en 22 escuelas. **Salir con egresos es, en la práctica, salir por primera vez.**
7. **QA ejecutado:** typecheck de frontend y BFF limpios; **BFF 378 tests verdes / 6 saltados**;
   frontend 97 verdes. Pero **no hay ni un test unitario de contabilidad, nómina, proveedores, libro
   ni tienda**, y ninguna spec Playwright ejercita un flujo de egreso (solo screenshots).

---

## 1. Mapa funcional — cómo vive cada flujo

Leyenda: ✅ completo y vivo · 🟡 parcial · 🔴 falta · ⚪ existe en código/base pero sin uso vivo.
«Libro» = `cash_ledger`. «EdR» = Estado de resultados (`/accounting/reports`). «Ppto» = Presupuesto.
«FE» = factura electrónica.

### 1.1 Definición real del libro (base viva)

```sql
-- cash_ledger (última redefinición: 20260903150628_articulos_escolares_catalogo_f1.sql)
SELECT 'income', ..., LEAST(p.amount, COALESCE(p.amount_paid, p.amount)) AS amount,
       p.payment_date AS movement_date, 'payment' AS source
  FROM payments p WHERE p.status IN ('paid','partial')
UNION ALL
SELECT 'expense', ..., e.amount, e.paid_date AS movement_date, 'expense'
  FROM expenses e WHERE e.status = 'paid';
```

Consecuencias directas: (a) el ingreso entra con la **fecha del pago** (`payment_date`); si es `NULL`
no aparece en ningún filtro por fecha; (b) cambiar el `status` saca la fila **retroactivamente**;
(c) EdR y Ppto solo ven `owner_type='school'` (la UI lo tiene fijo).

### 1.2 Ingresos

| # | Flujo | Origen (pantalla / endpoint / cron / webhook) | Tabla que escribe | ¿Llega al libro? | EdR / Ppto | FE | Uso real (base 2026-10-02) | Estado |
|---|---|---|---|---|---|---|---|---|
| I1 | **Mensualidad** | cron `generate-monthly-charges-daily` (06:30) → `open_month`; botón «Abrir mes» (`preview_open_month`/`open_month`) | `payments` (`pending`→`paid`) | Sí, al pasar a `paid` | Sí (EdR no separa por categoría) | Sí (auto-emit 3 días) | 795+180+154+4 `paid`; 336 `overdue` con categoría | 🟡 llega bien; estabilidad del productor = `DIN-1` (no re-verificado aquí) |
| I2 | **Inscripción** | alta/QR/checkout | `payments` | Sí | Indistinguible: **0 filas con `payment_category='inscripcion'`** | Sí | `payment_type` solo `subscription`/`one_time` | 🟡 entra como ingreso genérico |
| I3 | **Artículos escolares** | catálogo (`school_tournament_items`/artículos) | `payments` `payment_category='articulos'` | Sí | Sí (sin desglose) | Sí | 1 en `awaiting_approval` | ⚪ construido, sin uso |
| I4 | **Torneos internos** | `register_for_internal_tournament` + pago | `payments` `payment_category='torneo'` | Sí | Sí | Sí | 1 `paid`, 1 `overdue` | ⚪ casi sin uso |
| I5 | **Pago manual / efectivo / transferencia** | `RegisterCashPaymentModal` (insert/update directo a `payments` desde el front) | `payments` | Sí, con `payment_date = pickedDay()` | Sí | Sí | mayoría de los 795 `paid` sin proveedor | 🟡 66 `paid` **sin `payment_date`** (mar–jun, 4 escuelas, $4,87M) → invisibles en EdR |
| I6 | **Comprobante del acudiente** | sube comprobante → OCR `/payments/extract-receipt` → aprobación (`ApprovePaymentMethodSheet`, `PaymentsAutomationPage`) | `payments` | Sí, con `payment_date = todayColombia()` **del día que aprueba** | El ingreso cae en el mes de la aprobación, no del depósito | Sí | — | 🟡 decisión de producto pendiente (fecha del depósito vs. de aprobación) |
| I7 | **Wompi** | `POST /api/v1/webhooks/wompi/webhook` (`payment_date = todayInZone()`) | `payments` (`payment_provider='wompi'`) | Sí, por **`amount`** | Sí | Sí | 158 `paid`, 3 escuelas | 🟡 el recargo online (`gross_amount`≠`amount` en 49 filas) **no entra al libro**; la FE sí lo factura (4 facturas con total = amount × 1,05) **[coordinar]** |
| I8 | **Mercado Pago** | `bff/src/routes/mercadopago.ts` | `payments` | Sí | Sí | Sí | 3 `paid`, 2 escuelas; addon `mp` activo en 0 | ⚪ prácticamente sin uso |
| I9 | **Abonos (parcial)** | `payment_installments` / `submit_athlete_installment` / `status='partial'` | `payments.amount_paid` | Sí, **una sola fila** con el acumulado, fechada en `payment_date` | Abonos de meses distintos quedan en un solo mes | ? | 2 `partial`, 1 installment | 🟡 fecha de cada abono se pierde |
| I10 | **Mora** | cron `apply-late-fees-daily` (07:00) → `apply_late_fees()` (fecha Bogotá) suma a `amount` y `late_fee_amount` | `payments` | Sí (va dentro de `amount`) | Sí, sin separar | Sí | 337 cobros con mora, 6 escuelas, 86 pagados | ✅ |
| I11 | **Reembolso / anulación de un pago cobrado** | `request_refund` → `approve_refund` → `complete_refund` (pone `payments.status='refunded'`). Anular: **no hay UI**; solo SQL | `refunds` + cambio de `status` | **No**: la fila sale del libro **en el mes original** | EdR del pasado cambia sin rastro | No emite nota crédito automática | `refunds` = 0; **77 `paid→cancelled` sin actor** en `payment_audit_logs` | 🔴 |
| I12 | **Ventas de tienda** (`orders`) | checkout marketplace → `confirm_order_payment` | `orders`, `order_items`, `inventory_logs` | **No** | No | `autoEmitPendingOrders` existe; 0 facturas con `order_id` | 1 orden `paid`; addon `store` en 7 | 🔴 ingreso fuera del libro |
| I13 | **Reservas** | `add_reservation_payment` (queda `pending_review`) + trigger `sync_reservation_payment_status` | `reservation_payments`, `facility_reservations.amount_paid` | **No** | No | No | 60 reservas, **0 pagos** | 🔴/⚪ |
| I14 | **Delegaciones de eventos** | `POST /events/.../delegations/:delId/record-payment`, `.../mine/payment` | `event_delegation_payments` | **No** | No | No | 0 filas | 🔴/⚪ |

### 1.3 Egresos

| # | Flujo | Origen | Tabla / RPC | ¿Llega al libro? | Editar / anular | Auditoría | Uso real | Estado |
|---|---|---|---|---|---|---|---|---|
| E1 | **Gasto manual con comprobante** | `/accounting` → «Registrar gasto» (insert directo a `expenses` `status='paid'` + Storage `accounting-receipts` + `expense_attachments`) | `expenses` | Sí, por `paid_date` | **No hay editar ni anular** en la UI; la base **permite `DELETE`** | Ninguna | 5 manuales, 2 adjuntos | 🟡 |
| E2 | **Factura de proveedor** | `/accounting/suppliers` → alta de proveedor y factura (insert directo) | `suppliers`, `supplier_bills` (`open`) | No (es CxP, no caja) — correcto | Sin editar ni anular (`bill_status` tiene `void` pero no hay UI/RPC) | Ninguna | 3 facturas, 3 proveedores | 🟡 |
| E3 | **Pago a proveedor (total o parcial)** | botón «Pagar» → RPC `pay_supplier_bill` (`FOR UPDATE`, rechaza `amount_exceeds_balance`, crea `expenses` `kind='supplier_bill'`) | `expenses` + `supplier_bills.amount_paid/status` | Sí | No se puede revertir un pago; si se borra el `expense` la factura **sigue pagada** | Ninguna | 3 pagos ($750.000); 2 `paid`, 1 `partially_paid` | 🟡 núcleo bien hecho, sin reverso |
| E4 | **Nómina — liquidar** | `/accounting/payroll` → RPC `run_payroll` (Colombia: IBC, salud, pensión, FSP, ARL, caja, SENA/ICBF con exoneración, provisiones) | `payroll_runs` (`draft`), `payroll_items` | No (todavía) | Recalcula mientras `draft`; `run_locked` si ya está pagada | Ninguna | 1 empleado, 1 corrida | ✅ motor |
| E5 | **Nómina — pagar/postear** | RPC `post_payroll_run` (idempotente si `status='paid'`) | `expenses` `kind='payroll'`, `payroll_runs.status='paid'` | Sí, por **`total_net + total_employer`** | No hay anular; `payroll_runs` es `FOR ALL` (un cliente podría devolverla a `draft` y re-postear → segundo egreso) | Ninguna | jul-2026: $2.370.440 | 🟡 **subregistra $160.000** (deducciones del empleado); provisiones ($451.753) no se registran ni tienen flujo de pago; sin `payroll_config` 2027 |
| E6 | **Comisión de pasarela** | trigger `trg_payment_fee_to_expense_{ins,upd}` → `fn_school_fee_to_expense` | `expenses` (`source_payment_id`, `ON CONFLICT DO NOTHING`) | Sí, si dispara | — | — | Solo aplica con `fee_payer='school'` y sobre `sportmaps_fee`. Única escuela así: «pruebas 12». **0 egresos generados.** La comisión real de Wompi/MP **no se registra en ningún lado** | ⚪ / 🔴 |
| E7 | **Devoluciones** (dinero que sale hacia la familia/cliente) | — | — | No existe como egreso; el reembolso es un cambio de estado del ingreso (I11) | — | — | 0 | 🔴 |
| E8 | **IVA / retenciones** (retefuente, reteICA, IVA descontable) | — | `expenses` y `supplier_bills` no tienen campos de impuesto | No | — | — | — | 🔴 |
| E9 | **Suscripción SaaS de SportMaps** (lo que la escuela le paga a SportMaps) | `run_saas_billing_cycle` / `school_subscription_invoices` | No genera egreso para la escuela | No | — | — | 4 facturas SaaS | 🔴 (P2) |

### 1.4 Transversales

| Pieza | Qué hay vivo | Estado |
|---|---|---|
| **Libro de caja** `/accounting` | Lee `cash_ledger` completo sin paginar (`.select('*')`), filtra por sede con `branch_id.is.null OR eq` | 🟡 tope de 1.000 filas de PostgREST (ver H7) |
| **Estado de resultados** `/accounting/reports` | Año, ingresos vs egresos, egresos por categoría, flujo mensual, **CSV de resumen** (sin escapar comas) | 🟡 no separa ingresos por categoría; no exporta movimientos |
| **Presupuesto** `/accounting/budget` | `budgets` por categoría/mes vs `expenses` | 🟡 8 filas; solo egresos (no hay presupuesto de ingresos) |
| **Cierre de mes** (`MonthCloseTab`) | `close_month` / `reopen_month` (motivo obligatorio) / `preview_close_month`; snapshot `scope='cobros'` | 🟡 4 cerrados + 1 reabierto, 2 escuelas; **no bloquea** escrituras (0 triggers) |
| **Facturación electrónica** | Dynasty `factus_v2` **producción** (181 aceptadas, 5 rechazadas); Demo `factus` sandbox (4). Emisión `POST /invoicing/emit/:paymentId`, cron `autoEmitPendingInvoices` (3 días), nota crédito `POST /invoicing/credit-note/:invoiceId` | 🟡 0 notas crédito en prod; 1 factura sobre pago no pagado; 73 pagos manuales Dynasty desde 1-sep sin factura (causa sin verificar) |
| **Gating por addon** | `ModuleGate` en ruta + menú: `accounting` (6 activos), `invoicing` (3 activos, se oculta si hay `accounting`) | ✅ |
| **Permisos** | Rutas: `school`, `admin`, `school_admin`, `super_admin`. RPCs: `can_manage_finances` = `is_school_admin()` / dueño vendor / organizer | 🟡 no hay rol «contador / solo lectura»; coach y reporter no entran (correcto) |
| **Multi-owner** | Tablas y RPCs con `owner_type`/`owner_id`; **UI fija `owner_type='school'`**. Organizer tiene `/organizer/finances` aparte | 🟡 vendor/organizer sin contabilidad |
| **Conciliación bancaria** | `bank_statements`/`reconcile_statement`/`ReconciliationTab` | ⚪ 0 extractos cargados |
| **Caja (recepción)** | `cash_sessions`/`close_cash_session` | ⚪ 0 sesiones |
| **Tienda — rutas de gestión** | `/suppliers`, `/customers`, `/promotions`, `/categories`, `/store-reports` renderizan páginas genéricas (`StoreInventoryPage`, `StoreOrdersPage`, `StoreProductsPage`, `ReportsPage`) | 🔴 stubs |

---

## 2. Huecos que impiden salir

| ID | Hueco | Evidencia (base / código) | Impacto |
|---|---|---|---|
| **H1** | **Ingresos fuera del libro**: tienda, reservas, delegaciones | `cash_ledger` = `payments ∪ expenses`; `confirm_order_payment`, `add_reservation_payment`, `record-payment` escriben en sus propias tablas | El EdR de una escuela con tienda o reservas es falso. Hoy el volumen es ~0, así que **se puede decidir dejarlo fuera explícitamente** — pero no venderlo como «todos tus ingresos» |
| **H2** | **No hay reverso; las correcciones son retroactivas** | `complete_refund` → `status='refunded'`; 77 `paid→cancelled` sin actor; no hay UI «Anular pago» | Un mes ya reportado al dueño (o cerrado) cambia de cifra sin explicación. Ningún contador lo acepta |
| **H3** | **El cierre de mes no bloquea** | `close_month` solo hace upsert en `monthly_closes`; 0 triggers que miren `monthly_closes` en `payments`/`expenses` | Cualquiera puede registrar un gasto con `paid_date` en un mes cerrado, o un pago atrasado (`DIN-14`) que reescribe el snapshot |
| **H4** | **Egresos se borran sin rastro** | policy `DELETE` en `expenses`; sin `audit_trigger_func` en `expenses`, `supplier_bills`, `payroll_runs`, `budgets`; no hay «anular» en UI | Desaparece un egreso; si era pago a proveedor, `supplier_bills.amount_paid` queda inflado. **[coordinar]** con el agente de RLS de contabilidad para la policy |
| **H5** | **Nómina subregistra** y **no tiene 2027** | `post_payroll_run`: `v_amount := r.total_net + r.total_employer`; corrida jul-2026: deducciones $160.000 fuera; `payroll_config` solo `year=2026` | Egreso de nómina ~6–7 % bajo; la nómina de enero 2027 devuelve `no_config_for_year` |
| **H6** | **Factura DIAN sobre un pago no pagado** | `electronic_invoices` aceptada 2026-10-01 12:00 → `payments.status='awaiting_approval'` desde 15:21 | Documento fiscal emitido sobre algo que el sistema ya no considera cobrado; no hay guard ni nota crédito automática |
| **H7** | **Tope de 1.000 filas** en libro y EdR | Ambas pantallas hacen `select` sin `range`; Dynasty ya tiene 559 movimientos en 2026 (~90/mes) | Hacia diciembre el EdR anual de Dynasty se trunca **en silencio**. Valor real de `max_rows` sin verificar |
| **H8** | **Fecha del ingreso** | 66 `paid` sin `payment_date`; comprobantes fechan al día de aprobación; abonos en una sola fecha | Ingresos invisibles o en el mes equivocado |
| **H9** | **Recargo online y comisión real de pasarela** | Libro usa `amount`, no `gross_amount` (49 filas difieren); la FE factura el bruto; `fn_school_fee_to_expense` solo para `sportmaps_fee` con `fee_payer='school'` (0 filas) | Libro ≠ factura ≠ extracto bancario. **[coordinar]** con el agente de conciliación |
| **H10** | **No hay export contable** | Solo CSV de resumen del EdR y CSV de pagos en `PaymentsAutomationPage`; sin export de movimientos, sin PUC, sin formato Siigo/World Office | El contador no puede cargar nada; `D-PUC` sigue abierta |
| **H11** | **Sin impuestos en egresos** | `expenses`/`supplier_bills` sin IVA, retefuente, reteICA | No sirve para declarar; solo para flujo de caja |
| **H12** | **Sin editar/anular** gasto, factura de proveedor, pago a proveedor ni corrida de nómina | `AccountingPage`, `AccountingSuppliersPage`, `PayrollPage`: solo insert/RPC de pago | Un error de digitación obliga a SQL |
| **H13** | **Doble posteo de nómina posible** | `payroll_runs` con policy `FOR ALL`; `post_payroll_run` no verifica `expense_id` existente si el status volvió a `draft` | Negativo a probar (caso N5); **[coordinar]** RLS |
| **H14** | **Multi-owner sin UI**; **sin rol contador** | `owner_type='school'` fijo en las 5 páginas | Vendor/organizer no pueden llevar contabilidad; la escuela no puede darle acceso de lectura a su contador |
| **H15** | **Cobertura de pruebas cero en egresos** | Ningún test unitario de contabilidad/nómina/proveedores/libro/tienda; `owner.spec.ts` solo toma screenshots de `/accounting*` | Nada protege contra regresión |
| **H16** | **Stubs en la tienda** | rutas de gestión que renderizan páginas genéricas | El dueño de tienda ve pantallas que no hacen lo que dice el menú |

**Uso real** (base viva): ingreso real en 22 escuelas; addon `accounting` en 6 escuelas, `invoicing` en 3,
`store` en 7; egresos registrados por **2 dueños** (Escuela Demo y MMA Blair); FE en producción en **1**
(Dynasty); cierre de mes en 2. Es decir: la parte de ingresos está en producción con dinero real; la
de egresos está construida pero sin estrenar.

**El ROADMAP está desactualizado en un punto:** `ERP` dice que «no se puede abonar a un gasto» y que el
pago parcial llega con `ERP-2`. **Ya existe** para facturas de proveedor (`pay_supplier_bill` con
`partially_paid`, vivo). Lo que sigue faltando es el gasto manual parcial, el pago multi-factura y el
mayor de partida doble.

---

## 3. QA ejecutado (resultados reales)

| Comando | Dónde | Resultado |
|---|---|---|
| `npx tsc --noEmit -p .` | `frontend/` | exit 0 en 18 s — **pero no comprueba nada**: `tsconfig.json` tiene `"files": []` y solo referencias |
| `npx tsc --noEmit -p tsconfig.app.json` | `frontend/` | **exit 0, sin errores** (ojo: `strict: false`, `noImplicitAny: false`) |
| `npx tsc --noEmit -p .` | `bff/` | **exit 0, sin errores** (1 min 23 s) |
| `npx vitest run` (todo) | `frontend/` | **6 archivos, 97 tests, todos verdes.** Relacionados con dinero: solo `billing-details-form.test.tsx` e `InstallmentsConfigCard.test.tsx` |
| `npx vitest run <12 archivos de pagos/facturación>` | `bff/` | **12 pasan, 1 saltado; 267 tests verdes, 6 saltados** |
| `npx vitest run` (todo) | `bff/` | **18 archivos pasan, 1 saltado; 378 tests verdes, 6 saltados.** El saltado es `factus-v2.adapter.sandbox.test.ts`: sale a la red y solo corre con `FACTUS_SANDBOX_TEST=1` — correcto que no corra solo |

Tests de dinero que existen en el BFF: `invoicing.service.unit`, `invoicing.voidInvoice`,
`invoicing.authz` (49 casos, incluye «nadie quema numeración DIAN ajena»), `factus-v2.adapter.unit`,
`invoicing/types.unit`, `mercadopago.status`, `payment-provider.resolver`, `receipt-verdict`,
`receipt-approval.rejection`, `saasInvoicing.constants`, `banco-correo-parser`,
`whatsapp-eleccion-de-pago`. **No hay ninguno** de `expenses`, `supplier_bills`, `payroll`, `budgets`,
`cash_ledger`, `orders` ni `reservation_payments`.

### Specs Playwright existentes que tocan finanzas (no ejecutadas)

| Spec | Qué hace | ¿Escribe? |
|---|---|---|
| `e2e/qa-discovery/owner.spec.ts` | Recorre `/accounting`, `/suppliers`, `/payroll`, `/reports`, `/budget` y toma screenshots | No (no afirma nada de contabilidad) |
| `e2e/qa-discovery/proceso-pago-escuela.spec.ts` | Abre modales y pestañas de pagos como owner demo | No (declara solo lectura) |
| `e2e/qa-discovery/proceso-pago-padre.spec.ts` | Recorre el pago del acudiente, se detiene antes de confirmar | No |
| `e2e/qa-discovery/estado-cuenta-clean.spec.ts` | Estado de cuenta | No (por lectura) |
| `e2e/qa-discovery/torneos-internos-inscripcion-pago.spec.ts` | Inscripción + pago a torneo interno | **Puede escribir** (llama RPCs de inscripción y hace clic en «Pagar») |
| `e2e/descuentos.spec.ts` | `/my-payments`, `/payments-automation`, `/students` | No corre `open_month` |
| `e2e/qa-discovery/padre*.spec.ts`, `atleta.spec.ts`, `admin-padre-recorrido.spec.ts` | Recorridos; `padre.spec.ts` comprueba que `/accounting` y `/finances` están bloqueados al acudiente | No |

Configs: `playwright.config.ts` (baseURL `localhost:3001`, levanta `webServer`),
`playwright.qa-discovery.config.ts` (`localhost:3004`), `playwright.postentreno.config.ts`.
⚠️ **El frontend local apunta a la única Supabase (`luebjarufsiadojhvxgi`), que es también producción.**
Correr cualquiera de estas specs en local lee y escribe datos reales. Por eso no ejecuté ninguna: las
que son solo lectura son seguras en principio, pero las que hacen clic en «Pagar» no.

Cuenta de prueba documentada para el lado acudiente: `qa.athletic@sportmaps.co` (acudiente en Athletic
League, hijo en sub 11; ya tiene 3 cobros de prueba del 24-sep). **Solo se menciona: no se usó.**

---

## 4. Plan de pruebas para salir

**Cómo leer la tabla.** «Base» dice qué fila y qué monto tiene que aparecer — siempre se verifica en
`cash_ledger` además de en la tabla origen. «Auto» = automatizable: **PW** (Playwright TS contra la
escuela demo), **SQL** (prueba de RPC en una transacción con `set_config('request.jwt.claims', …)` y
`ROLLBACK` — no deja datos), **Manual** (pasarela sandbox, DIAN o cuenta real).

**Fixture propuesto:** `Escuela Demo SportMaps` (`de300000-0000-4000-8000-000000000001`, ya tiene FE en
sandbox y datos de contabilidad). Como la base es una sola, **todo dato que cree una prueba PW queda en
producción**: usar solo escuelas demo y dejar la limpieza al usuario (no borrar desde las pruebas).

### 4.1 Ingresos

| ID | Caso | Precondición | Pasos | Resultado esperado (pantalla) | Resultado esperado (base) | Auto |
|---|---|---|---|---|---|---|
| I-01 | Mensualidad del mes | Atleta activo con plan $150.000; mes sin abrir | Abrir mes desde Finanzas | 1 cobro `pending` por atleta | `payments` 1 fila `period_month` = mes, `amount=150000`; `cash_ledger` **sin** fila | SQL (`preview_open_month` + `open_month` con rollback) |
| I-02 | Abrir el mismo mes dos veces | I-01 hecho | Repetir «Abrir mes» / correr el cron | Mensaje «ya abierto», 0 nuevos | Sigue 1 fila por atleta/periodo | SQL |
| I-03 | Pago manual en efectivo | Cobro `pending` | Registrar efectivo con fecha de hoy | Cobro «Pagado» | `payments.status='paid'`, `payment_date`=hoy Bogotá; `cash_ledger` 1 fila `income` 150.000 | PW |
| I-04 | Doble clic en «Registrar pago» | Cobro `pending` | Doble clic rápido / dos pestañas | Un solo pago | 1 fila `paid`; no hay segundo `payments` | PW |
| I-05 | Comprobante aprobado otro día | Acudiente sube comprobante el día 30 | Escuela aprueba el día 2 del mes siguiente | — | `payment_date` = día 2 (comportamiento actual). **Decidir** si debe ser el 30 | PW + decisión |
| I-06 | Comprobante rechazado | Comprobante subido | Rechazar con motivo | «Rechazado» | `status='rejected'`; **sin** fila en `cash_ledger` | PW |
| I-07 | Abono parcial | Cobro 150.000 | Registrar abono 50.000 | «Parcial — saldo 100.000» | `status='partial'`, `amount_paid=50000`; ledger 50.000 | PW |
| I-08 | Abono en dos meses | I-07 en sep | Abono 100.000 en oct | «Pagado» | Hoy: **una** fila de 150.000 en un solo mes (falla esperada → H8) | PW |
| I-09 | Pago por encima del saldo | Cobro con saldo 100.000 | Registrar 120.000 | Rechazo o aviso | Sin sobrepago silencioso | PW |
| I-10 | Wompi aprobado | Escuela con Wompi sandbox | Pagar con tarjeta de prueba | Página de resultado OK | `payments.status='paid'`, `payment_provider='wompi'`, `payment_date` hoy Bogotá; ledger = `amount` (ver H9) | Manual (sandbox) |
| I-11 | Webhook Wompi repetido | I-10 | Reenviar el mismo evento | — | Sigue 1 pago; sin segundo ingreso | SQL/BFF unit |
| I-12 | Mercado Pago aprobado/rechazado | MP sandbox | Pagar aprobado y rechazado | — | `paid` / sin cambio | Manual |
| I-13 | Mora | `late_fee_enabled`, 5 %, gracia 0; cobro vencido ayer | Correr `apply_late_fees()` | Cobro con recargo | `amount` +5 % del saldo, `late_fee_applied_at` set; segunda corrida **no** vuelve a sumar | SQL |
| I-14 | Límite 23:59 Bogotá | Pago aprobado a las 23:59 del 30-sep (04:59 UTC del 1-oct) | Registrar/webhook | — | `payment_date='2026-09-30'`, ledger en **septiembre** | SQL + BFF unit sobre `todayInZone` |
| I-15 | Mora a medianoche | Cobro vence hoy | Correr cron 07:00 UTC (02:00 Bogotá) | — | Usa fecha Bogotá; no marca vencido un día antes | SQL |
| I-16 | Anular un pago cobrado | Pago `paid` en mes cerrado | Anular (hoy: no hay UI) | — | Esperado al salir: movimiento de reverso **en el mes de la anulación**; el mes cerrado no cambia. Hoy falla (H2/H3) | SQL tras el fix |
| I-17 | Reembolso | Pago `paid` | `request_refund` → `approve_refund` → `complete_refund` | — | Esperado: egreso/reverso con fecha del reembolso y nota crédito si había FE. Hoy: la fila desaparece del mes original | SQL tras el fix |
| I-18 | Artículo escolar | Catálogo con un artículo | Acudiente compra; escuela aprueba | — | `payments.payment_category='articulos'`; ledger 1 fila | PW |
| I-19 | Torneo interno | Torneo con precio | Inscribir y pagar | — | `payment_category='torneo'`; ledger 1 fila | PW (spec existente, adaptar) |
| I-20 | Venta de tienda | Producto con stock 1 | Comprar y confirmar | Orden pagada, stock 0 | `orders.status='paid'`, `inventory_logs` −1; **hoy no hay fila en ledger** (H1) | PW + Manual (pasarela) |
| I-21 | Stock insuficiente concurrente | Stock 1, dos compradores | Confirmar ambos a la vez | Uno falla | `insufficient_stock_*`; stock nunca negativo | SQL |
| I-22 | Pago de reserva | Reserva $80.000 | `add_reservation_payment` 80.000; aprobar | Reserva «Pagada» | `facility_reservations.payment_status='paid'`; **hoy no hay fila en ledger** | SQL |
| I-23 | Sobrepago de reserva | Reserva 80.000 | Pagar 100.000 | Error | `overpayment` | SQL |
| I-24 | Pago de delegación | Delegación con precio | `record-payment` | — | Fila en `event_delegation_payments`; **hoy no hay fila en ledger** | PW |

### 4.2 Egresos

| ID | Caso | Precondición | Pasos | Pantalla | Base | Auto |
|---|---|---|---|---|---|---|
| E-01 | Gasto manual con comprobante | Addon `accounting` | Registrar $100.000 con PDF | Aparece en el libro como egreso | `expenses` `kind='manual'`, `status='paid'`; `expense_attachments` 1; objeto en `accounting-receipts`; ledger `expense` 100.000 en `paid_date` | PW |
| E-02 | Gasto con monto 0 / negativo | — | Intentar guardar | Validación | Sin fila | PW |
| E-03 | Gasto en mes cerrado | Mes cerrado | Registrar con `paid_date` en ese mes | Esperado: rechazo | Hoy entra (H3) | SQL/PW tras el fix |
| E-04 | Anular gasto | E-01 | Anular con motivo | Esperado: sale del libro con rastro | Esperado: `status='void'` + auditoría; **nunca** `DELETE` | PW tras el fix |
| E-05 | Factura de proveedor | Proveedor creado | Registrar factura $400.000 | «Abierta» | `supplier_bills.status='open'`; **sin** fila en ledger | PW |
| E-06 | Pago parcial a proveedor | E-05 | Pagar 150.000 | «Pago parcial — saldo 250.000» | `expenses` `kind='supplier_bill'` 150.000; bill `partially_paid`, `amount_paid=150000` | PW / SQL |
| E-07 | Pagar por encima del saldo | E-06 | Pagar 300.000 | Error «excede el saldo» | `amount_exceeds_balance`, sin egreso | SQL |
| E-08 | Dos pagos concurrentes que juntos exceden | Saldo 250.000 | Dos `pay_supplier_bill` de 200.000 a la vez | Uno falla | `FOR UPDATE` serializa; `amount_paid ≤ amount` | SQL (dos sesiones) |
| E-09 | Monto 0 / negativo a proveedor | — | Pagar 0 | Error | `invalid_amount` | SQL |
| E-10 | Liquidar nómina | Empleado salario 2.000.000, aux. transporte | `run_payroll` | Corrida en borrador | `payroll_items` con IBC, deducciones, aportes, provisiones correctos contra cálculo manual | SQL |
| E-11 | Postear nómina | E-10 | «Pagar» | «Pagada» | `expenses` `kind='payroll'` = **neto + deducciones + aportes** (hoy da neto + aportes → falla H5) | SQL |
| E-12 | Postear dos veces | E-11 | Repetir | Idempotente | `idempotent=true`, sigue 1 egreso | SQL |
| E-13 | Re-liquidar una pagada | E-11 | `run_payroll` mismo mes | Error | `run_locked` | SQL |
| E-14 | Devolver una pagada a borrador desde el cliente | E-11 | `update payroll_runs set status='draft'` con JWT de admin | Esperado: rechazo | Si pasa → re-postear crea 2.º egreso (H13) | SQL |
| E-15 | Nómina 2027 | — | `run_payroll` año 2027 | — | Hoy `no_config_for_year` | SQL |
| E-16 | Comisión de pasarela (escuela absorbe) | `fee_payer='school'` | Pago con `sportmaps_fee>0` | — | 1 egreso «Comisión pasarela · ref»; reintento no duplica | SQL |
| E-17 | Presupuesto vs real | Presupuesto categoría X 500.000 | Registrar gasto 600.000 | Barra roja / sobre presupuesto | `budgets` vs `sum(expenses)` | PW |

### 4.3 Transversales y permisos

| ID | Caso | Esperado | Auto |
|---|---|---|---|
| T-01 | EdR anual cuadra con la base | Ingresos/egresos/neto del EdR = `sum` de `cash_ledger` del año (consulta directa) | SQL + PW |
| T-02 | EdR con > 1.000 movimientos | Mismo total que la base (hoy se trunca, H7) | SQL (crear en rollback no sirve para el front → usar escuela demo con seed) |
| T-03 | CSV del EdR | Abre en Excel en español, concepto con coma no rompe columnas | PW |
| T-04 | Cerrar mes | Snapshot con totales = `preview_close_month` | SQL |
| T-05 | Reabrir sin motivo | Error | SQL |
| T-06 | FE de un pago `paid` | Factura aceptada en sandbox, total = lo cobrado | Manual (Factus sandbox) |
| T-07 | Des-pagar un pago facturado | Esperado: bloqueo o nota crédito obligatoria (hoy pasa, H6) | SQL |
| T-08 | Nota crédito | `POST /invoicing/credit-note/:id` en sandbox | Manual |
| T-09 | Acudiente entra a `/accounting`, `/finances` | `/unauthorized` (ya cubierto por `padre.spec.ts`) | PW |
| T-10 | Coach entra a `/accounting` | Bloqueado | PW |
| T-11 | Admin de **otra** escuela llama `pay_supplier_bill` / `post_payroll_run` / `run_payroll` | `forbidden` | SQL **[coordinar RLS]** |
| T-12 | Escuela sin addon `accounting` | Menú sin Contabilidad; URL directa → pantalla bloqueada | PW |
| T-13 | Escuela con `invoicing` sin `accounting` | Ve «Facturación electrónica» standalone | PW |
| T-14 | Estados vacíos / error | Escuela sin movimientos ve «sin datos», no «$0 de ingresos» presentado como real; error de red muestra «No se pudo cargar» (ya existe en EdR) | PW |
| T-15 | Filtro por sede | Movimientos sin sede aparecen en todas las sedes (comportamiento documentado) | PW |

**Qué exige prueba manual sí o sí:** I-10, I-12, I-20 (pasarela), T-06, T-08 (DIAN), y el pago real de
la cuenta QA acudiente cuando haga falta validar la experiencia de punta a punta.

---

## 5. Checklist de salida priorizado

Tamaños: XS < 1 d · S 1–3 d · M 1–2 sem · L > 2 sem.

### P0 — bloquea salir

| # | Ítem | Hueco | Tamaño | Depende de |
|---|---|---|---|---|
| P0-1 | **Nómina:** `post_payroll_run` asienta neto + **deducciones** + aportes (o dos egresos: «Nómina neta» y «Seguridad social/PILA»). Cargar `payroll_config` 2027 antes de enero | H5 | XS | Cifras 2027 (SMMLV, aux. transporte) |
| P0-2 | **Egresos sin borrado:** quitar `DELETE` de `expenses`; anular = `status='void'` con motivo; anular pago a proveedor revierte `supplier_bills.amount_paid`; trigger de auditoría en `expenses`, `supplier_bills`, `payroll_runs`, `budgets` | H4, H12 | S | **[coordinar]** agente RLS contabilidad |
| P0-3 | **Reverso en vez de reescritura:** anular/reembolsar un ingreso cobrado deja un movimiento negativo **con fecha de la anulación** (p. ej. nueva rama de `cash_ledger` sobre `payment_audit_logs`/`refunds`, o tabla `ledger_adjustments`). UI «Anular pago» con motivo para owner/admin | H2 | M | Decisión de modelo (adelanto de `ERP-2`, sin partida doble) |
| P0-4 | **Bloqueo de mes cerrado:** trigger que rechaza insert/update en `payments` (cambios de `status`/`amount`/`payment_date`) y `expenses` cuya fecha cae en un mes `cerrado` de `monthly_closes`; correcciones solo vía P0-3 | H3 | M | P0-3 (si no, no hay forma legal de corregir) |
| P0-5 | **FE coherente con el pago:** investigar la factura aceptada sobre el pago `awaiting_approval`; guard que impide sacar de `paid` un pago con FE aceptada sin nota crédito | H6 | S | — |
| P0-6 | **Libro sin truncar:** EdR y libro con agregación del lado servidor (RPC/vista por mes y categoría) o paginación; verificar `max_rows` real | H7 | S | — |
| P0-7 | **Decidir y declarar el perímetro del ingreso:** o se suman `orders` (de la escuela), `reservation_payments` aprobados y `event_delegation_payments` aprobados a `cash_ledger`, o la pantalla dice explícitamente «solo cobros de mensualidades, inscripciones, artículos y torneos» | H1 | S (declarar) / M (sumar) | **[coordinar]** agente de conciliación, que es quien redefine las agregaciones |
| P0-8 | **Pruebas mínimas que protejan lo anterior:** casos SQL con rollback para E-06..E-15, I-13, I-14, I-16, I-17, T-04, T-07, T-11; PW para E-01, E-04, E-05, I-03, T-01 | H15 | M | P0-1..P0-6 |

### P1 — salir con riesgo aceptado (documentado al cliente)

| # | Ítem | Hueco | Tamaño | Depende de |
|---|---|---|---|---|
| P1-1 | Backfill de los 66 pagos `paid` sin `payment_date` + `CHECK` que exija fecha al pasar a `paid` | H8 | S | Revisar cada uno contra `payment_audit_logs` |
| P1-2 | Decisión: fecha del ingreso por comprobante = fecha del depósito (OCR `ocr_date`) o de aprobación | H8 | XS (decidir) / S | Producto |
| P1-3 | Abonos con su propia fecha en el libro (una fila por abono) | H8 | S | P0-3 si se modela como movimientos |
| P1-4 | Recargo online y comisión real de pasarela: libro = lo cobrado (`gross_amount`) y egreso por la comisión del proveedor | H9 | S–M | **[coordinar]** conciliación |
| P1-5 | Export de movimientos del libro (CSV/XLSX con fecha, tercero, concepto, categoría, método, referencia) — reusar `lib/export/xlsx.ts` | H10 | S | — |
| P1-6 | EdR con ingresos por categoría (`payment_category`) y estampar `inscripcion` en los caminos que no la estampan | — | S | Censo de los 13 caminos de `payments` |
| P1-7 | Explicar los 73 pagos manuales de Dynasty desde 1-sep sin FE (¿filtro, rechazo, backfill pendiente?) | H6 | XS | — |
| P1-8 | Editar factura de proveedor (antes de pagos) y anular (`void`) | H12 | S | P0-2 |
| P1-9 | Provisiones de nómina: al menos mostrarlas como pasivo acumulado y permitir registrar el pago de prima/cesantías | H5 | S | — |
| P1-10 | Cerrar `payroll_runs` a escritura directa de `status` desde el cliente (solo vía RPC) | H13 | XS | **[coordinar]** RLS |

### P2 — después

| # | Ítem | Tamaño | Depende de |
|---|---|---|---|
| P2-1 | IVA y retenciones en egresos (campos + reporte) | M | `D-PUC` |
| P2-2 | Plan de cuentas / PUC, mapeo por escuela, formato Siigo/World Office (`ERP-2`) | L | D-T, D-MIG, D-PUC, D-CORTE |
| P2-3 | Rol «contador» de solo lectura por escuela | S | Modelo de permisos |
| P2-4 | Contabilidad para vendor y organizer (UI con `owner_type` dinámico) | M | P0-2 |
| P2-5 | Suscripción SaaS como egreso automático de la escuela | S | — |
| P2-6 | Presupuesto de ingresos | S | P0-7 |
| P2-7 | Rutas stub de tienda (`/suppliers`, `/customers`, `/promotions`, `/categories`, `/store-reports`): construir u ocultar | S | — |
| P2-8 | Conciliación bancaria en uso (0 extractos hoy) | M | P1-4 |

---

## 6. Referencias

- Base viva: `cash_ledger`, `pay_supplier_bill`, `post_payroll_run`, `run_payroll`,
  `fn_school_fee_to_expense`, `close_month`, `reopen_month`, `apply_late_fees`, `complete_refund`,
  `confirm_order_payment`, `add_reservation_payment`, `can_manage_finances`; `cron.job` (12 jobs activos).
- Migraciones: `20260710000002_accounting_phase2_suppliers.sql`,
  `20260711000002_accounting_phase3_payroll_engine.sql`, `20260711000004_accounting_fee_to_expense.sql`,
  `20260827221826_cierre_de_mes_rpcs.sql`, `20260903150628_articulos_escolares_catalogo_f1.sql`.
- Frontend: `frontend/src/pages/Accounting*.tsx`, `PayrollPage.tsx`, `FinancesPage.tsx`,
  `components/finances/MonthCloseTab.tsx`, `components/accounting/*`, `config/navigation.ts`,
  `config/module-catalog.ts`, `components/ModuleGate.tsx`.
- BFF: `routes/wompi.ts`, `routes/mercadopago.ts`, `routes/invoicing.routes.ts`,
  `services/invoicing.service.ts`, `jobs/maintenance.job.ts`, `routes/events.route.ts`.
- Docs: `docs/ROADMAP.md` §2 ERP y §3 Track Contable, `docs/specs/pendientes-cxc-cxp-nomina.md`,
  `docs/specs/month-close-module.md`.
