# Contabilidad v2 · F0 — Plan detallado de migraciones

**Versión:** v0.1 · **Fecha:** 2026-10-03 · **Rama destino:** `feature/contab-v2-f0` (nace de `develop`) · **Estado:** 🔵 plan para aprobar. **No hay SQL escrito ni aplicado.**
**Spec madre:** [`contabilidad-v2.md`](contabilidad-v2.md) §9 (fila F0) y §9.1 (5 migraciones F0). **Prerrequisito:** Fase 1 de [`blindaje-dinero-pagos-tienda-nomina.md`](blindaje-dinero-pagos-tienda-nomina.md).
**Piloto:** Monster´s Volley Club (`eb3ebc77-4ea4-4992-96c8-3c8ec574578c`).
**Método:** todo lo de §1 se le preguntó **a la base viva** (`luebjarufsiadojhvxgi`) el 2026-10-03 con SELECT y con `BEGIN; set local role authenticated; … ROLLBACK`. El código se leyó en `frontend/src` y `bff/src`. No se escribió nada.

> **En una línea.** F0 son **6 migraciones** (7 si se aprueba adelantar la bandeja para tienda v2) y ~2,5 semanas. Para los dueños de las tres escuelas reales **el libro no cambia ni un peso**. Lo que cambia: los KPIs filtrados por sede (Dynasty +$34,83M), el dashboard de GYM RM (−$499.150 en total) y los coaches, que dejan de ver ingresos. En la verificación aparecieron **cuatro cosas que el spec no tenía**, y cada una cambia el plan (§0).

---

## 0. Lo que la verificación cambió respecto del spec

| # | Hallazgo (verificado en vivo) | Consecuencia para F0 |
|---|---|---|
| **N1** | **Un rol `accountant` en `school_members` sería "staff" para todo.** `staff_school_ids()` y `user_staff_school_ids()` definen staff como `role NOT IN ('parent','athlete')`. Con eso un contador podría: insertar cobros (`Payments: insert staff`), administrar `children`, escribir en 36 policies de 18 tablas (equipos, asistencia, mesociclos, membresías…) y pasar el guard de pagos de la Fase 1 (`trg_zz_guard_payments_client` deja pasar a quien está en `user_staff_school_ids()`), **es decir, marcar un pago como `paid`** | La migración del rol **tiene que** excluir a `accountant` de las dos funciones de staff, en la misma transacción en que entra el valor al CHECK. Hoy no hay contadores, así que el radio es 0 |
| **N2** | **`accept_invitation_pro` hace `profiles.role = role_to_assign::user_role`.** `accountant` no existe en el enum `user_role`. Invitar a un contador por el flujo normal daría error `22P02` | Hay que decidir el modelo del rol (decisión **U1**). Si se sigue el precedente de `reporter` (que está en el enum y en `school_members`), hace falta una migración previa `ALTER TYPE user_role ADD VALUE 'accountant'`, que no puede compartir transacción con su uso |
| **N3** | **Cuarta suma de ingresos, con fuga entre escuelas.** `get_school_dashboard_stats(p_user_id, p_branch_id)` (consumida en `useDashboardStats.ts:154-168`) suma `SUM(amount)` de `paid`, con sede estricta. Además autoriza a **cualquier** owner/admin de **cualquier** escuela a pasar el `p_user_id` de otro: probado en `ROLLBACK`, el owner de Monster's lee `total_revenue = 87.360.000` de Dynasty | Se agrega al alcance de F0 (decisión **U3**): se redefine sobre la fórmula única y se cierra la fuga. Le asigno el ID **C12** |
| **N4** | **`can_manage_finances` gobierna también la facturación electrónica.** `einvoices_owner_read`, `einvoice_items_read` y `einv_providers_owner` la usan. Dynasty factura en producción con addon `invoicing` y **sin** addon `accounting` | El envoltorio `can_manage_finances` **no puede** llevar el gate del addon `accounting` sin dejar a Dynasty sin facturas. En F0 el gate de addon solo va en `finance_permission` para las acciones de escritura de las RPC nuevas. Las policies existentes conservan su semántica actual |

Otras correcciones al punto de partida del spec:

- **D-ING no mueve ningún número del libro.** Ningún cobro `partial` tiene `amount_paid` nulo (en toda la base hay 2 `partial` y ninguno es así). La fórmula `LEAST(amount, COALESCE(amount_paid, amount))` del libro ya **es** D-ING para los datos vivos. Lo que diverge es el **dashboard**, que suma `amount` de los `paid`.
- **La Fase 1 todavía no está viva.** M1 entró hoy con la versión `20261003193616`, no `20261002125955` (el registro de `apply_migration` y el ledger del repo **no coinciden**, hay que reconciliarlos con `migrations:sync`). M2 (guard de pagos), M3 (tienda apagada) y M4 (nómina) **no están aplicadas**: no existe `trg_zz_guard_payments_client`, `post_payroll_run` sigue con `total_net` y `run_payroll` sigue con `/12`.
- **Las 73 + 10 filas de GYM RM no son comisiones de pasarela.** Todas son manuales (`payment_provider` nulo), así que en F0 no hay egreso que crear. Clasificación en §1.8.
- **Los 73 pagos de Dynasty sin factura electrónica** ya tienen causa (§1.7). Son datos fiscales faltantes, no un bug del emisor.

---

## 1. Estado vivo verificado (2026-10-03)

### 1.1 `cash_ledger`

| Atributo | Valor vivo |
|---|---|
| Tipo | vista, `reloptions = {security_invoker=true}` |
| Ingreso | `payments` con `status IN ('paid','partial')`, monto `LEAST(amount, COALESCE(amount_paid, amount))`, fecha `payment_date`, `owner_type` fijo `'school'` |
| Egreso | `expenses` con `status = 'paid'::expense_status`, fecha `paid_date` |
| Columnas | `direction, id, owner_type, owner_id, school_id, branch_id, concept, category_id, amount, movement_date, source, status, payment_category` (hay que conservarlas idénticas para `CREATE OR REPLACE VIEW`) |
| Grants | `authenticated`: `SELECT, INSERT, UPDATE, DELETE` (la vista no es actualizable por el `UNION`, pero el grant sobra). `anon`: ninguno |
| **C4 en vivo** | Simulado como coach de Dynasty (`8e9554c8…`): **562 filas de ingreso, $87.360.000**. Lo deja pasar `Payments: select staff` = `school_id = ANY(staff_school_ids())`, que incluye coaches |
| Lectores | `AccountingPage.tsx:101-111` (`select('*')` sin paginar, sede `is.null OR eq`, `owner_type='school'` fijo; totales en :141-148) · `AccountingReportsPage.tsx:37-41` (año, sin sede, sin paginar; sumas en :63-82). El BFF no la lee |

### 1.2 `school_payment_kpis(p_school_id, p_branch_id)`

| Atributo | Valor vivo |
|---|---|
| Seguridad | `SECURITY DEFINER`, `STABLE`, `search_path` fijo, EXECUTE solo a `authenticated`/`service_role` ✅ |
| Gate | Con `auth.uid()` nulo (service role) no hay gate. Con usuario: `is_super_admin() OR is_school_admin(p_school_id)` (owner/admin/school_admin en `school_members`; **no** reconoce al owner que solo figura en `schools.owner_id`) |
| `revenue_total` | `paid` → `LEAST(amount, COALESCE(amount_paid, amount))`, `partial` → `COALESCE(amount_paid, 0)` (= D-ING) |
| **Sede (A3 vivo)** | `p_branch_id IS NULL OR branch_id = p_branch_id` → con sede **excluye los cobros sin sede** |
| Sin período | Suma **histórica total**, sin rango de fechas |
| Lector único | `PaymentsAutomationPage.tsx:815-818` (`p_branch_id: activeBranchId \|\| null`). Usa `revenue_total` ("Ingresos Totales"), `awaiting_*`, `tx_count`, `charges_total`, `approval_rate`, `attempts` (:1371-1377). `debt_*` no se usan. `revenue_articulos/torneo` no los lee nadie |

### 1.3 `useDashboardStatsReal` y su origen

- `frontend/src/hooks/useDashboardStatsReal.ts:95` — la rama de escuela corre para `school, school_admin, admin, super_admin, coach` → **el coach también ve "Ingresos del mes"** (C4 por una segunda vía).
- :114-126 — lee `payments` directo (`amount, amount_paid, status`), `paid/partial`, `payment_date >= inicio de mes` **sin límite superior**, sede `is.null OR eq`, sin paginar.
- :129-132 — suma `partial ? amount_paid ?? 0 : amount`. **Diverge de D-ING en los `paid` con `amount_paid < amount`** (GYM RM).
- :135-143 — conteo de pendientes con sede **estricta** (inconsistente con la suma de arriba).
- Consumidor único: `DashboardPage.tsx:74`, renderizado en :388 con `|| 0`.

**Otras sumas de ingreso que el spec no lista** (todas divergen en algo): `get_school_dashboard_stats` (N3) · `FinancialSummaryCards.tsx:19-23` y `TransactionsCard.tsx:107,133` (`paid → amount`, tope de 1.000 filas por `FETCH_CAP`) · `ReportsPage.tsx:112-139` (paginada, `paid → amount`) · `RecepcionPage.tsx:111-124` (`amount_paid ?? gross_amount ?? amount`, por `approved_at`) · BFF `reports.ts:65-66, 232` (`paid → amount`) y `reports.ts:584-591` (sede estricta) · `get_school_dashboard_stats`.

### 1.4 `can_manage_finances` y los helpers de alcance

| Función | Vivo |
|---|---|
| `can_manage_finances(text, uuid)` | DEFINER `STABLE`, `search_path` fijo. `school` → `is_school_admin(id)`; `vendor` → `vendor_profiles.user_id = auth.uid()`; `organizer` → `id = auth.uid()`. EXECUTE a **`PUBLIC`, `anon`**, `authenticated` (trampa 3) |
| Quién la usa | 16 policies de 13 tablas: `budgets, expense_attachments, expense_categories, expenses, payroll_employees, payroll_items, payroll_runs, supplier_bills, suppliers, electronic_invoices, electronic_invoice_items, electronic_invoice_providers` + 3 de `storage.objects` (bucket `accounting-receipts`), y las RPC `run_payroll`, `pay_supplier_bill`, `post_payroll_run` |
| Espejo en el BFF | `invoicing.routes.ts:82-117` `canManageFinances()` **sí** acepta `schools.owner_id`; la SQL no. Hoy solo 2 escuelas tienen owner sin fila de miembro ("Entrenador Personal - Workspace", "NPC"); ninguna del piloto |
| `is_school_admin(uuid)` | plpgsql DEFINER **VOLATILE**, `search_path=public`, roles `owner, admin, school_admin`, `status='active'` |
| `staff_school_ids()` / `user_staff_school_ids()` | `role NOT IN ('parent','athlete')` → ver N1 |
| `school_members.role` CHECK | `owner, admin, school_admin, coach, staff, parent, athlete, viewer, reporter, super_admin`. `UNIQUE (profile_id, school_id)`: **un rol por persona por escuela** |
| Miembros activos hoy | 66 owner, 5 admin, 2 school_admin, 37 coach, 2 reporter, 862 parent, 48 athlete |
| Invitaciones | `Invitations: manage staff` = `user_admin_school_ids()` → solo administración invita ✅ (no se delega) |
| Addon | No existe helper SQL de addon. Tabla `school_addons(addon_key, enabled, …)`. `accounting` encendido en 6 escuelas (incluida Monster's desde el 2026-10-02 11:23) |

### 1.5 Políticas de `expenses`, `supplier_bills`, `payroll_runs` y vecinas

| Tabla | Policies vivas | Grants `anon` / `authenticated` | Filas |
|---|---|---|---|
| `expenses` | `expenses_owner` **FOR ALL** `can_manage_finances` (USING y CHECK) + RESTRICTIVE `trial_block_{insert,update,delete}` | **anon: S/I/U/D** · auth: S/I/U/D | 9 |
| `supplier_bills` | `supplier_bills_owner` FOR ALL | anon S/I/U/D · auth S/I/U/D | 3 (0 con `amount_paid > amount`) |
| `suppliers` | `suppliers_owner` FOR ALL | ídem | 3 |
| `payroll_runs` | `payroll_runs_owner` FOR ALL | ídem | 1 (Escuela Demo, jul-2026, `paid`) |
| `payroll_items` | FOR ALL vía `payroll_runs` | ídem | — |
| `payroll_employees` | FOR ALL | ídem | — |
| `budgets` | FOR ALL | ídem | 8 |
| `expense_attachments` | FOR ALL vía `expenses` | ídem | — |
| `audit_logs` | solo `audit_logs_platform_admin_select` | **anon y auth: S/I/U/D** (la RLS frena, pero es trampa 3) | — |

- **Triggers:** ninguna de esas tablas tiene trigger de auditoría (solo `set_updated_at`). `payments` sí (`trg_audit_payments`).
- **`audit_trigger_func` no sirve para egresos:** guarda `new_data = to_jsonb(NEW)` y **nunca `old_data`**. En un `DELETE` queda `new_data = null`: se pierde la fila borrada. Hace falta una función nueva.
- **CHECKs:** `expenses.amount > 0`, `supplier_bills.amount > 0`, `amount_paid >= 0`. **No hay** `amount_paid <= amount`.
- **Enums (deuda, no se tocan):** `expense_status = draft, pending_approval, approved, paid, void`; `bill_status = open, partially_paid, paid, overdue, void`; `payroll_run_status = draft, approved, paid, void`.
- **RPC de escritura son `SECURITY INVOKER`:** `pay_supplier_bill`, `post_payroll_run`, `run_payroll` (EXECUTE a `PUBLIC`/`anon`). Escriben **a través** de las policies. Por eso, si se quita `UPDATE` a `authenticated` sin pasarlas a DEFINER, **se rompen**.
- **El frontend no hace `UPDATE` ni `DELETE`** sobre `expenses`, `supplier_bills`, `payroll_runs` ni `expense_attachments`. Solo inserta: `AccountingPage.tsx:206-222` (gasto `kind:'manual'`, `status:'paid'`), `:237-244` (adjunto), `AccountingSuppliersPage.tsx:294` (proveedor) y `:359-364` (factura). `PayrollPage.tsx` usa las RPC y hace `update`/soft-delete de `payroll_employees` (:138, :466). `AccountingBudgetPage.tsx:99-106` hace upsert de `budgets`.

### 1.6 `payroll_config`

Una fila, `year = 2026`, `notes = "VALORES DE REFERENCIA — verificar SMMLV/auxilio/UVT con el decreto oficial 2026."`, sin cambios desde 2026-07-10:

| Campo | Vivo | Decretos 1469/1470 de 2025 |
|---|---|---|
| `smmlv` | 1.423.500 | 1.750.905 |
| `transport_aid` | 200.000 | 249.095 |
| `uvt` | 49.799 | 52.374 |
| `fsp_pct` / `fsp_threshold_smmlv` | 0,01 / 4 (un solo tramo) | escalonado (F3) |
| `exoneration_threshold_smmlv` | 10 | < 10 (F3 lo afina) |
| resto | salud 4/8,5 · pensión 4/12 · caja 4 · SENA 2 · ICBF 3 · ARL 0,522/1,044/2,436/4,35/6,96 % · prima y cesantías 8,33 · vacaciones 4,17 · intereses 12 % | — |

- **No hay fila 2027.**
- RLS: lectura `USING(true)` a `authenticated` (son parámetros públicos, está bien). Escritura solo `is_super_admin()`. **`anon` tiene S/I/U/D** (la RLS lo frena; trampa 3).
- Editor: `/admin/payroll-config` (`PayrollConfigPage.tsx:164` update, `:249` insert, solo `super_admin`). Aviso de año faltante: `PayrollPage.tsx:152-155` ya traduce `no_config_for_year`. **C3 es un `UPDATE` de datos, no una migración.**

### 1.7 Emisor DIAN, su cron y la factura del 01-oct

| Pieza | Vivo |
|---|---|
| Emisores (`electronic_invoice_providers`) | **Dynasty**: `factus_v2`, **producción** (`sandbox=false`), rango 2697, notas crédito 2701, 184 aceptadas, última hoy 2026-10-03 11:21 · **Escuela Demo**: `factus` sandbox (4, 0 aceptadas). **Monster's no tiene emisor** aunque tiene el addon `invoicing` |
| Cron | **No es `pg_cron`.** Es `node-cron` del BFF, `maintenance.job.ts:243-245`, `*/15 * * * *` → `autoEmitPendingInvoices()` (`invoicing.service.ts:1307-1349`), ventana de 3 días por `payment_date` **o** `created_at`, máx. 100 |
| Guard de emisión | Ya existe en el BFF: `invoicing.routes.ts:237-239` y `invoicing.service.ts:380` (`status !== 'paid'` → `payment_not_paid`). La fila se inserta `queued` **antes** de llamar al PAC (`runEmission`). **No existe nada en la base** que impida sacar de `paid` un pago facturado |
| Totales | 183 aceptadas sobre pagos `paid` ($28,36M) · 5 rechazadas · **1 aceptada sobre un pago no pagado** |

**La factura del 01-oct, reconstruida:**

| Hora (Bogotá) | Evento | Actor |
|---|---|---|
| 11:53:19 | INSERT del cobro `3490fed0…` ya en `paid`, $180.000, transferencia, "Mensualidad octubre" | **owner** de Dynasty (`73adf4ca…`) |
| 12:00:02 | Factura **DYTY427** emitida por el cron, aceptada por la DIAN a las 12:00:12 | BFF |
| 15:21:21 | UPDATE `paid → awaiting_approval` (mismo `payment_date`, mismo comprobante) | **acudiente** (`932ce99a…`), por PostgREST |

**Diagnóstico:** la factura **es correcta** (el cobro sí estaba pagado). Lo que está mal es el des-pago, y lo hizo el acudiente: es **A1**, que cierra el guard de la Fase 1 (M2). Lo mismo pasó el 30-sep con `f7bcc085…` (DYTY426), que ya volvió a `paid`. En 90 días, las **únicas** transiciones `paid → otro` sobre pagos facturados fueron esas dos. **Remediación:** que el owner de Dynasty vuelva a aprobar `3490fed0`. Eso no requiere nota crédito ni SQL (decisión **U6**).

**Los "73" de Dynasty sin factura (P1-7)** — hoy son 72 cobros `paid` desde el 1-sep sin ninguna fila de factura:

| Causa | Cobros | Monto |
|---|---|---|
| Sin pagador (`parent_id` y `user_id` nulos) → `payment_without_payer` | 27 | $4.200.000 |
| Pagador sin `document_number` → `customer_missing_fiscal_data` (se salta en silencio, `SKIP_ERRORS`) | 38 (30 pagadores) | $6.160.000 |
| Con documento, pero quedaron fuera de la ventana de 3 días del cron | 7 | $1.290.000 |

No hace falta migración: es completar datos (los 38 los lista `MissingBillingDataPanel`) y correr `backfillInvoices` con rango. Queda como tarea de datos de F0.

### 1.8 GYM RM (`2137182d…`): C7, C8 y C9 clasificados

**C7 · 73 cobros `paid` con `amount_paid < amount` ($499.150 de diferencia).** Todos son manuales:

| Patrón | Cobros | Diferencia | Lectura |
|---|---|---|---|
| Cobro $70.700 (= $70.000 + mora 1 %), pagado $70.000 | 63 | $44.100 | **Mora no cobrada.** El ingreso real es $70.000 |
| Cobro $323.200, pagado $320.000 | 2 | $6.400 | Mora no cobrada |
| Cobro $70.700, pagado $35.000 | 3 | $107.100 | **Medio mes marcado `paid`**: descuento o abono mal marcado |
| Cobro $323.200, pagado $70.000 | 1 | $253.200 | Plan trimestral cobrado como mensual |
| Cobro $131.300, pagado $70.000 | 1 | $61.300 | Ídem (2 meses) |
| Otros (50.000 y 65.000 de 70.700; 65.000 de 65.650) | 3 | $27.050 | Descuento puntual |

**C7 · 10 cobros con excedente ($913.200 que hoy no cuenta nadie):** 6 son **planes multi-mes registrados sobre un cobro mensual** ($320.000, $270.000, $150.000 y $130.000 contra $70.700; Nohelia Guevara dos veces), y cada uno de esos atletas **conserva 1–2 cobros abiertos** (cartera inflada). Los otros 4 son $70.000 pagados contra cobros de $65.650.

**C8 · 55 cobros `paid` sin `payment_date` ($3.850.000):** **todos** se insertaron en un solo lote, ya en `paid`, el 2026-06-26 20:00:09 Bogotá, sin actor, concepto "Membresía Mensual GYM RM", sin período, y se volvieron a tocar en lote el 13-ago. Es una **importación histórica**, no 55 cobros reales de junio.

**C9 · 1 cobro `cancelled` con $70.000 abonados** (`48e80e4f…`, "Mensualidad 07/2026 - ANDERSON CASTELLANOS"): es un **duplicado** del día siguiente (el de `ab18425d…` del 18-jul también está `paid` por $70.000) que generó el productor diario (DIN-1). Hubo 10 duplicados más, ya cancelados sin abono. La limpieza lo canceló el 28-jul. **No es ingreso** salvo que GYM RM confirme que recibió el dinero dos veces.

**En toda la base:** 66 `paid/partial` sin fecha en 4 escuelas, 2 `partial` (ninguno con `amount_paid` nulo ni excedente), 0 con fecha futura.

### 1.9 Línea base de las tres vías (§8.6 paso 1)

Monto por mes de cobro (`payment_date`). (a) = `cash_ledger` · (c) = dashboard (`paid → amount`) · D-ING = fórmula única.

| Escuela | Mes | (a) libro | (c) dashboard | D-ING | Excedente fuera |
|---|---|---|---|---|---|
| Dynasty | 2026-07 | 2.600.000 | 2.600.000 | 2.600.000 | 0 |
| Dynasty | 2026-08 | 44.690.000 | 44.690.000 | 44.690.000 | 0 |
| Dynasty | 2026-09 | 36.350.000 | 36.350.000 | 36.350.000 | 0 |
| Dynasty | 2026-10 | 3.720.000 | 3.720.000 | 3.720.000 | 0 |
| Besser | 2026-09 | 2.200.000 | 2.200.000 | 2.200.000 | 0 |
| Besser | 2026-10 | 1.100.000 | 1.100.000 | 1.100.000 | 0 |
| GYM RM | 2026-06 | 281.400 | 281.400 | 281.400 | 138.600 |
| GYM RM | 2026-07 | 4.675.700 | **4.693.600** | 4.675.700 | 249.300 |
| GYM RM | 2026-08 | 2.571.400 | **2.999.000** | 2.571.400 | 448.600 |
| GYM RM | 2026-09 | 1.658.300 | **1.711.950** | 1.658.300 | 76.700 |
| GYM RM | sin fecha | 3.850.000 (solo en el total) | ídem | **bucket visible** | 0 |

Ene–jun no tienen cobros en las tres escuelas, salvo GYM RM en junio. Totales históricos: KPIs sin sede = libro = Dynasty $87.360.000, Besser $3.300.000, GYM RM $13.036.800. `get_school_dashboard_stats` da **$13.535.950** para GYM RM.

**KPIs con sede (A3):** las tres escuelas tienen **una sola sede**, y gran parte de los cobros no la tiene:

| Escuela | Cobros sin sede | KPI con sede, hoy | Con la regla nueva | Δ |
|---|---|---|---|---|
| Dynasty | 220 de 562 | 52.530.000 | 87.360.000 | **+34.830.000** |
| Besser | 8 de 11 | 1.140.000 | 3.300.000 | **+2.160.000** |
| GYM RM | 153 de 175 | 1.480.000 | 13.036.800 | **+11.556.800** |

**D-FECHA retroactivo (no recomendado, §3 U4):** en Dynasty 8 cobros ($1.200.000) tienen `ocr_date` en un mes distinto de `payment_date`. Uno con `ocr_date` de marzo, 178 días antes: es un OCR erróneo o un comprobante reusado. **Agosto y septiembre de Dynasty están cerrados** en `monthly_closes` (cerrados el 01-sep y el 02-oct).

### 1.10 Piloto y seguridad base

- **Monster´s Volley Club:** addons `accounting`, `invoicing`, `store`, `whatsapp` encendidos el 02-oct por super admin · 5 cobros, **0 cobrados** · 0 gastos · 1 owner (`1247192f…`), 1 coach (`97f66b29…`), 1 atleta inactivo · sin emisor DIAN.
- **`invariantes_seguridad()` hoy:** 0 CRÍTICAS · 50 × I3 (ALTA) · 8 × I6 vista definer expuesta (ALTA). F0 no puede subir ninguna de las dos.
- PostgreSQL 17.6 · 845 filas en `schema_migrations` · `max_rows` de PostgREST **sigue sin verificar** (no está en la base; la RPC paginada lo vuelve irrelevante).

---

## 2. Migraciones

Convenciones de todas: `npm run migrations:new -- <slug>` (timestamp posterior al head **y a las 4 de la Fase 1**) · `SET search_path = pg_catalog, public, pg_temp` en toda función · `REVOKE ALL … FROM PUBLIC, anon, authenticated` y después `GRANT EXECUTE` puntual · `text + CHECK` · ninguna edita una anterior · prueba en la viva solo dentro de `BEGIN … ROLLBACK` · se aplica con `apply_migration` · después de aplicar se verifica con `pg_proc`/`pg_policies` y `set local role` · `npm run seguridad:invariantes` al cerrar la fase.

**Antes de aplicar cada una** se guarda el estado previo de lo que reemplaza (`pg_get_functiondef`, `pg_get_viewdef`, `pg_policies`) en `supabase/tests/contabilidad/rollback/<slug>.previo.sql`. El rollback es **una migración nueva** que restaura ese estado: nunca se borra la migración aplicada.

Simulación usada en las pruebas (los UUID son reales):

```sql
-- owner Dynasty 73adf4ca-51f5-4f4a-a6ca-1973c84e8151 · coach Dynasty 8e9554c8-1dbe-46f1-8c90-53bcb8f7bd2f
-- owner Monster 1247192f-eefa-471e-a939-d52f13962a90 · coach Monster 97f66b29-eec5-4d47-962d-c0710a9c7060
-- acudiente Dynasty 932ce99a-8bfa-4458-b865-f1495238273f
select set_config('request.jwt.claims', json_build_object('sub', :uid, 'role','authenticated')::text, true);
set local role authenticated;
```

### M0 · `finanzas_rol_contador_enum` *(solo si U1 = opción B)*

| | |
|---|---|
| **Objetos** | tipo `public.user_role` |
| **SQL** | `ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'accountant';` (sola, sin otra sentencia; el valor no se puede usar en la misma transacción) |
| **Prueba** | `select enum_range(null::user_role)` después de aplicar. No hay prueba en rollback útil |
| **Radio** | 0 filas. TypeScript: el union de `types.ts` se regenera |
| **Rollback** | No se puede quitar un valor de un enum. Queda inerte si se revierte M1 |

### M1 · `finanzas_permiso_y_rol_contador`

**Objetos:** CHECK `school_members_role_check` · funciones nuevas `_finance_actor_role`, `finance_permission`, `finance_read_school_ids`, `school_has_addon` · `CREATE OR REPLACE` de `can_manage_finances`, `staff_school_ids`, `user_staff_school_ids` · policies nuevas de lectura para el contador.

```sql
-- 1) rol
ALTER TABLE public.school_members DROP CONSTRAINT school_members_role_check;
ALTER TABLE public.school_members ADD CONSTRAINT school_members_role_check CHECK (role IN
  ('owner','admin','school_admin','coach','staff','parent','athlete','viewer','reporter','super_admin','accountant'));

-- 2) N1: el contador NO es staff (misma transacción)
CREATE OR REPLACE FUNCTION public.staff_school_ids() … role::text NOT IN ('parent','athlete','accountant') …
CREATE OR REPLACE FUNCTION public.user_staff_school_ids() … sm.role NOT IN ('parent','athlete','accountant') …   -- resto idéntico

-- 3) addon
CREATE FUNCTION public.school_has_addon(p_school_id uuid, p_key text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT EXISTS (SELECT 1 FROM public.school_addons WHERE school_id = p_school_id AND addon_key = p_key AND enabled) $$;

-- 4) núcleo: qué es el usuario respecto de un dueño ('admin' | 'accountant' | NULL)
CREATE FUNCTION public._finance_actor_role(p_owner_type text, p_owner_id uuid) RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN NULL
    WHEN public.is_super_admin() THEN 'admin'
    WHEN p_owner_type = 'school' THEN (
      SELECT CASE WHEN bool_or(r IN ('owner','admin','school_admin','super_admin')) THEN 'admin'
                  WHEN bool_or(r = 'accountant') THEN 'accountant' END
        FROM (SELECT sm.role AS r FROM public.school_members sm
               WHERE sm.school_id = p_owner_id AND sm.profile_id = auth.uid() AND sm.status = 'active'
              UNION ALL
              SELECT 'owner' FROM public.schools s WHERE s.id = p_owner_id AND s.owner_id = auth.uid()) x)
    WHEN p_owner_type = 'vendor' AND EXISTS (SELECT 1 FROM public.vendor_profiles vp
                                              WHERE vp.id = p_owner_id AND vp.user_id = auth.uid()) THEN 'admin'
    WHEN p_owner_type = 'organizer' AND p_owner_id = auth.uid() THEN 'admin'
  END $$;

-- 5) matriz §3.8 (+ gate de addon solo para acciones que escriben, y solo para escuelas)
CREATE FUNCTION public.finance_permission(p_owner_type text, p_owner_id uuid, p_action text) RETURNS boolean
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_role text := public._finance_actor_role(p_owner_type, p_owner_id);
BEGIN
  IF p_action NOT IN ('read','write','pay','void','close','reopen','configure','export') THEN
    RAISE EXCEPTION 'finance_permission: acción inválida %', p_action USING ERRCODE = '22023';
  END IF;
  IF v_role IS NULL THEN RETURN false; END IF;
  IF p_owner_type = 'school' AND p_action IN ('write','pay','void','close','reopen','configure')
     AND NOT public.is_super_admin() AND NOT public.school_has_addon(p_owner_id, 'accounting') THEN
    RETURN false;
  END IF;
  RETURN v_role = 'admin' OR (v_role = 'accountant' AND p_action IN ('read','export','close'));
END $$;

-- 6) lista de escuelas legibles (para policies y vistas, se evalúa una vez con (SELECT …))
CREATE FUNCTION public.finance_read_school_ids() RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT COALESCE(ARRAY(
    SELECT sm.school_id FROM public.school_members sm WHERE sm.profile_id = auth.uid() AND sm.status = 'active'
       AND sm.role IN ('owner','admin','school_admin','super_admin','accountant')
    UNION SELECT s.id FROM public.schools s WHERE s.owner_id = auth.uid()), '{}'::uuid[]) $$;

-- 7) envoltorio: MISMA semántica de hoy (sin gate de addon, por N4) + owner por schools.owner_id
CREATE OR REPLACE FUNCTION public.can_manage_finances(p_owner_type text, p_owner_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT public._finance_actor_role(p_owner_type, p_owner_id) = 'admin' $$;
-- ⚠ is_super_admin(): hoy can_manage_finances NO lo reconoce. Decisión U7 (por defecto: SÍ, alinea con el BFF).

-- 8) lectura del contador: policies PERMISIVAS de SELECT (se suman con OR a las FOR ALL actuales)
CREATE POLICY expenses_finance_read ON public.expenses FOR SELECT TO authenticated
  USING (public.finance_permission(owner_type, owner_id, 'read'));
-- ídem: suppliers, supplier_bills, payroll_runs, payroll_employees (U2), budgets,
--        expense_categories (owner_id IS NULL OR …), electronic_invoices,
--        payroll_items / expense_attachments / electronic_invoice_items (por EXISTS al padre),
--        storage.objects bucket 'accounting-receipts' (SELECT)
CREATE POLICY "Payments: select finance reader" ON public.payments FOR SELECT TO authenticated
  USING (school_id = ANY ((SELECT public.finance_read_school_ids())));
```

**GRANT/REVOKE:**
- `_finance_actor_role`: `REVOKE ALL FROM PUBLIC, anon, authenticated`. **Sin grant**: solo la llaman funciones DEFINER.
- `finance_permission`, `finance_read_school_ids`, `school_has_addon`: `REVOKE … FROM PUBLIC, anon` + `GRANT EXECUTE TO authenticated, service_role` (se evalúan dentro de policies con el rol del que consulta).
- `can_manage_finances`: `REVOKE EXECUTE FROM PUBLIC, anon` (hoy los tiene). Se mantiene `authenticated`, porque lo exigen las policies.
- `staff_school_ids`, `user_staff_school_ids`: grants **sin cambio**. ⚠ No revocar nada a `authenticated` (CLAUDE.md: helpers de RLS).

**Prueba (BEGIN … ROLLBACK en la viva):**
1. Como `postgres`: `insert into school_members (school_id, profile_id, role, status) values ('eb3ebc77…', <perfil de prueba sin membresía en Monster's>, 'accountant', 'active')`. Después, simulando a ese perfil:
   - `finance_permission('school','eb3ebc77…','read')` = t · `'write'` = f · `'close'` = t · `'reopen'` = f;
   - `'eb3ebc77…' = ANY(user_staff_school_ids())` = **f** · `staff_school_ids()` no la incluye;
   - `insert into payments (school_id, …, status) values ('eb3ebc77…', …, 'paid')` → **42501** (ya no lo deja `Payments: insert staff`);
   - `insert into teams (…school_id='eb3ebc77…')` → 42501;
   - `select count(*) from expenses where owner_id='eb3ebc77…'` funciona (0 filas, sin error).
2. Owner de Monster's: `finance_permission(…,'write')` = t (tiene el addon). Owner de Dynasty: `'write'` = **f** (no tiene `accounting`) · `can_manage_finances('school','2d509571…')` = **t** · `select count(*) from electronic_invoices where owner_id='2d509571…'` = **185** (N4: la facturación no se rompe).
3. Coach de Dynasty: `finance_permission(…,'read')` = f · `can_manage_finances` = f.
4. Acudiente: todo f.
5. `has_function_privilege('anon','public.can_manage_finances(text,uuid)','execute')` = f.

**Radio de impacto:**
- **Hoy hay 0 contadores**, así que excluirlos de staff no cambia nada vivo.
- `can_manage_finances` gana a los 2 owners por `schools.owner_id` (Workspace y NPC, sin dinero) y a los super admin (si U7 = sí). Ningún lector del frontend llama la RPC (solo `types.ts`). El BFF ya aplica esa regla en `invoicing.routes.ts:82-117`.
- Los 10 procs que usan `NOT IN ('parent','athlete')` (`claim_children_by_document`, `claim_member_for_plan`, `fn_create_plan_from_routine`, `fn_unassign_gym_session`, `get_onboarding_status`, `link_unregistered_to_profile`, `register_for_internal_tournament`, `submit_qr_signup` ×2, `submit_qr_signup__interno`) tratarían al contador como staff. Se revisan uno por uno en el PR. **No se tocan en M1**, porque hoy el radio es 0.
- Monto: **0 pesos** en las tres escuelas.

**Rollback:** migración nueva que restaura el CHECK previo (falla si ya hay filas `accountant`: hay que borrarlas a mano antes, U-tarea del usuario), los cuerpos previos de las 3 funciones y `DROP POLICY` de las nuevas. Las funciones nuevas se dejan (inertes) o se borran.

### M2 · `finanzas_formula_unica_ingreso`

**Objetos:** `finance_income_amount` (nueva), `finance_income_lines` (nueva), `finance_income_summary` (nueva) · `CREATE OR REPLACE VIEW cash_ledger` · `CREATE OR REPLACE FUNCTION school_payment_kpis` · `CREATE OR REPLACE FUNCTION get_school_dashboard_stats` (si U3 = sí).

```sql
-- regla de monto D-ING, en un solo lugar (IMMUTABLE, no lee tablas)
CREATE FUNCTION public.finance_income_amount(p_status text, p_amount numeric, p_amount_paid numeric) RETURNS numeric
  LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT CASE p_status
    WHEN 'paid'    THEN LEAST(p_amount, COALESCE(p_amount_paid, p_amount))
    WHEN 'partial' THEN LEAST(p_amount, COALESCE(p_amount_paid, 0))
    ELSE 0 END $$;
-- excedente (va a 2805 en F1; en F0 solo se informa)
CREATE FUNCTION public.finance_income_excess(p_status text, p_amount numeric, p_amount_paid numeric) … GREATEST(COALESCE(p_amount_paid,0) - p_amount, 0) para paid/partial

-- líneas (una por cobro). F0: solo owner_type='school'; vendor/organizer devuelven vacío hasta F6.
CREATE FUNCTION public.finance_income_lines(p_owner_type text, p_owner_id uuid, p_from date, p_to date,
    p_branch_id uuid DEFAULT NULL, p_include_undated boolean DEFAULT false)
  RETURNS TABLE (payment_id uuid, school_id uuid, branch_id uuid, payment_date date, period_year int, period_month int,
                 concept_key text, concept text, payment_method text, payment_provider text, status text,
                 amount_charged numeric, amount_paid numeric, income_amount numeric, excess_amount numeric,
                 electronic_invoice_id uuid)
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  -- service_role sin JWT puede leer (BFF); un usuario sin permiso recibe 42501, NUNCA ceros (memoria "RPC con gate = ceros")
  IF auth.uid() IS NOT NULL AND NOT public.finance_permission(p_owner_type, p_owner_id, 'read') THEN
    RAISE EXCEPTION 'FINANCE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_owner_type <> 'school' THEN RETURN; END IF;
  RETURN QUERY
    SELECT p.id, p.school_id, p.branch_id, p.payment_date, p.period_year, p.period_month,
           COALESCE(p.payment_category, 'sin_categoria'), p.concept, p.payment_method::text, p.payment_provider::text, p.status,
           p.amount, p.amount_paid,
           public.finance_income_amount(p.status, p.amount, p.amount_paid),
           public.finance_income_excess(p.status, p.amount, p.amount_paid),
           (SELECT ei.id FROM public.electronic_invoices ei WHERE ei.payment_id = p.id AND ei.document_type='invoice'
              AND ei.status = 'accepted' AND ei.voided_at IS NULL LIMIT 1)
      FROM public.payments p
     WHERE p.school_id = p_owner_id AND p.status IN ('paid','partial')
       AND (p_branch_id IS NULL OR p.branch_id = p_branch_id OR p.branch_id IS NULL)          -- A3
       AND ((p.payment_date BETWEEN p_from AND p_to) OR (p_include_undated AND p.payment_date IS NULL));  -- C8 visible
END $$;

-- resumen: p_group IN ('month','concept','method','branch'); siempre agrega un bucket 'sin_fecha' si existe
CREATE FUNCTION public.finance_income_summary(p_owner_type text, p_owner_id uuid, p_from date, p_to date,
    p_branch_id uuid DEFAULT NULL, p_group text DEFAULT 'month')
  RETURNS TABLE (bucket text, income_amount numeric, tx_count int, excess_amount numeric)
  … mismo gate; agrega sobre finance_income_lines(…, p_include_undated => true); bucket 'sin_fecha' para payment_date NULL

-- cash_ledger: mismas 13 columnas, misma vista invoker; ingreso filtrado por permiso de lectura financiera (C4)
CREATE OR REPLACE VIEW public.cash_ledger WITH (security_invoker = true) AS
  SELECT 'income'::text, p.id, 'school'::text, p.school_id, p.school_id, p.branch_id, p.concept, NULL::uuid,
         public.finance_income_amount(p.status, p.amount, p.amount_paid), p.payment_date, 'payment'::text,
         p.status, p.payment_category
    FROM public.payments p
   WHERE p.status IN ('paid','partial')
     AND p.school_id = ANY ((SELECT public.finance_read_school_ids()))    -- coach/staff/reporter → 0 filas
  UNION ALL
  SELECT 'expense'::text, e.id, e.owner_type, e.owner_id, e.school_id, e.branch_id, e.concept, e.category_id,
         e.amount, e.paid_date, 'expense'::text, e.status::text, NULL::text
    FROM public.expenses e WHERE e.status = 'paid';                        -- RLS de expenses (M1/M5) hace el resto
REVOKE INSERT, UPDATE, DELETE ON public.cash_ledger FROM authenticated;
REVOKE ALL ON public.cash_ledger FROM anon, PUBLIC;

-- KPIs: mismas claves de salida; gate = finance_permission(read); sede incluye NULL; monto = finance_income_amount
CREATE OR REPLACE FUNCTION public.school_payment_kpis(p_school_id uuid, p_branch_id uuid) …
   IF v_caller IS NOT NULL AND NOT public.finance_permission('school', p_school_id, 'read') THEN RAISE … ERRCODE '42501'
   … revenue_* con public.finance_income_amount(...) …
   WHERE p.school_id = p_school_id AND (p_branch_id IS NULL OR p.branch_id = p_branch_id OR p.branch_id IS NULL)

-- (U3) get_school_dashboard_stats: misma firma y claves; v_school_id solo de una escuela donde el CALLER es admin
--      (auth.uid() = p_user_id obligatorio, o super admin) → cierra C12; total_revenue = suma de finance_income_amount, sede con NULL
```

**GRANT/REVOKE:** `finance_income_amount`/`_excess`: `REVOKE ALL FROM PUBLIC, anon` + `GRANT EXECUTE TO authenticated, service_role` (la vista invoker las evalúa con el rol del usuario). `finance_income_lines`/`_summary`: `REVOKE ALL FROM PUBLIC, anon, authenticated` + `GRANT EXECUTE TO authenticated, service_role`. `school_payment_kpis` y `get_school_dashboard_stats`: conservan los grants actuales (`authenticated`, `service_role`) y se re-afirma `REVOKE FROM PUBLIC, anon`.

**Prueba (BEGIN … ROLLBACK), criterio §8.6 paso 3 = 0 de diferencia:**
1. Como `postgres`, aplicar el cuerpo completo de M2 dentro de la transacción.
2. Por escuela (las 3) y por mes (2026-01…2026-10 + sin fecha), comparar `cash_ledger` (agrupado), `finance_income_summary(…,'month')` y `school_payment_kpis(…).revenue_total` (suma histórica). **Esperado:** las tres iguales al peso y, contra la tabla de §1.9, solo cambian las columnas (c) de GYM RM (jul −17.900, ago −427.600, sep −53.650).
3. KPIs con sede: Dynasty `revenue_total` = 87.360.000 con `p_branch_id = 'ac8e6ed8…'` (hoy 52.530.000).
4. Coach de Dynasty: `select count(*) from cash_ledger where direction='income'` = **0** (hoy 562) · `finance_income_summary(…)` → **42501** · `school_payment_kpis` → error (ya lo hace hoy).
5. Owner de Dynasty: 562 filas, $87.360.000 (igual que hoy).
6. Owner de Monster's llamando `get_school_dashboard_stats('73adf4ca…', null)` → error o ceros de **su** escuela, nunca 87.360.000.
7. `explain (analyze, buffers)` de `cash_ledger` como owner de Dynasty: `finance_read_school_ids()` aparece como **InitPlan** (una sola evaluación), no por fila.

**Radio de impacto:**

| Lector | Archivo:línea | Cambio |
|---|---|---|
| Libro `/accounting` | `AccountingPage.tsx:101-148` | Owner: **0 pesos** en las 3 escuelas. Coach: no entra a la ruta (`App.tsx:682-716`) |
| EdR | `AccountingReportsPage.tsx:37-82` | 0 pesos. Los 55 sin fecha de GYM RM siguen fuera hasta que la UI use el bucket (M3) |
| KPIs | `PaymentsAutomationPage.tsx:815, 1371-1377` | Sin sede: 0. **Con sede:** Dynasty **+$34,83M**, Besser **+$2,16M**, GYM RM **+$11,56M**. También suben `awaiting_*`/`debt_*` con los cobros sin sede |
| Dashboard escuela | `useDashboardStatsReal.ts:114-132` → `DashboardPage.tsx:388` | Solo si se cambia el hook (§4). GYM RM octubre: hoy 0 cobros, sin cambio visible. En meses pasados la diferencia es la de §1.9 |
| `get_school_dashboard_stats` | `useDashboardStats.ts:154-168` | GYM RM 13.535.950 → **13.036.800** (−499.150). Con sede, + cobros sin sede. Cierra C12 |
| Coaches | — | Dynasty 8, Besser 3, Monster's 1: dejan de ver $87,36M / $3,3M / $0 en el libro (C4) |
| BFF | ninguno lee `cash_ledger` ni los KPIs | — |

**Rollback:** migración nueva con `pg_get_viewdef` y `pg_get_functiondef` previos (guardados antes de aplicar). Las funciones nuevas quedan inertes.

### M3 · `finanzas_libro_paginado`

**Objetos nuevos:** `finance_ledger_page`, `finance_ledger_totals`, `finance_pnl_monthly`.

```sql
-- SECURITY INVOKER sobre cash_ledger (hereda RLS + filtro de M2) + gate explícito para devolver 42501 y no vacío
CREATE FUNCTION public.finance_ledger_page(p_owner_type text, p_owner_id uuid, p_from date, p_to date,
    p_branch_id uuid DEFAULT NULL, p_direction text DEFAULT NULL,
    p_cursor_date date DEFAULT NULL, p_cursor_id uuid DEFAULT NULL, p_limit int DEFAULT 50,
    p_include_undated boolean DEFAULT false)
  RETURNS SETOF public.cash_ledger LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NOT public.finance_permission(p_owner_type, p_owner_id, 'read') THEN RAISE EXCEPTION 'FINANCE_FORBIDDEN' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT * FROM public.cash_ledger l
   WHERE l.owner_type = p_owner_type AND l.owner_id = p_owner_id
     AND (p_branch_id IS NULL OR l.branch_id = p_branch_id OR l.branch_id IS NULL)
     AND (p_direction IS NULL OR l.direction = p_direction)
     AND ((l.movement_date BETWEEN p_from AND p_to) OR (p_include_undated AND l.movement_date IS NULL))
     AND (p_cursor_id IS NULL OR (l.movement_date, l.id) < (p_cursor_date, p_cursor_id))   -- keyset
   ORDER BY l.movement_date DESC NULLS LAST, l.id DESC
   LIMIT LEAST(GREATEST(p_limit, 1), 200);
END $$;
-- totales del rango (nunca la suma de la página): direction, total, n, undated_total, undated_n
CREATE FUNCTION public.finance_ledger_totals(p_owner_type, p_owner_id, p_from, p_to, p_branch_id) …
-- EdR del año agregado en el servidor: (month int|NULL, direction, category_id, total)
CREATE FUNCTION public.finance_pnl_monthly(p_owner_type text, p_owner_id uuid, p_year int, p_branch_id uuid DEFAULT NULL) …
```

**GRANT/REVOKE:** las tres con `REVOKE ALL FROM PUBLIC, anon` + `GRANT EXECUTE TO authenticated`.

**Prueba (BEGIN … ROLLBACK):**
- Owner de Dynasty, rango 2026-01-01…2026-12-31: recorrer páginas de 50 hasta agotar. La suma de las páginas tiene que ser igual a `finance_ledger_totals` (562 filas, 87.360.000) y no puede haber ids repetidos.
- Owner de GYM RM con `p_include_undated=true`: aparecen las 55 sin fecha al final, $3.850.000.
- Coach → 42501. `p_limit = 100000` → devuelve 200.
- `finance_pnl_monthly(…, 2026)` suma lo mismo que `finance_income_summary` y que los egresos de `cash_ledger`.

**Radio:** solo consumidores nuevos (§4). **0 pesos.** Elimina H7 (truncado a 1.000) en cuanto la UI lo use.
**Rollback:** `DROP FUNCTION` ×3 (no tienen dependientes en la base).

### M4 · `egresos_sin_borrado_y_auditoria`

**Depende de que M4 de la Fase 1 (`20261002130001`) esté aplicada.** Esta migración re-crea `post_payroll_run` y `run_payroll` **copiando los cuerpos de la Fase 1**. Si se aplica antes, revierte C1/C2.

**Objetos:** grants y policies de `expenses, supplier_bills, suppliers, payroll_runs, payroll_items, payroll_employees, budgets, expense_attachments, expense_categories, payroll_config, audit_logs` · CHECK nuevo · función `audit_finance_row()` y sus triggers · `pay_supplier_bill`, `post_payroll_run`, `run_payroll` → DEFINER.

```sql
-- 1) trampa 3 / C11
REVOKE ALL ON public.expenses, public.supplier_bills, public.suppliers, public.payroll_runs, public.payroll_items,
              public.payroll_employees, public.budgets, public.expense_attachments, public.expense_categories,
              public.payroll_config FROM anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM anon, authenticated;   -- solo escriben triggers DEFINER y el BFF (service_role)

-- 2) sin borrado ni edición directa del dinero
REVOKE UPDATE, DELETE ON public.expenses        FROM authenticated;   -- el front solo inserta (AccountingPage.tsx:206)
REVOKE UPDATE, DELETE ON public.supplier_bills  FROM authenticated;   -- el front solo inserta (AccountingSuppliersPage.tsx:359)
REVOKE DELETE         ON public.suppliers, public.payroll_employees, public.expense_attachments FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payroll_runs, public.payroll_items FROM authenticated;   -- solo por RPC (C5/H13)

-- 3) partir las FOR ALL (trampa 1: listar TODAS las policies de cada tabla antes de tocar)
DROP POLICY expenses_owner ON public.expenses;
CREATE POLICY expenses_insert_manual ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_finances(owner_type, owner_id) AND kind = 'manual');   -- payroll/supplier_bill solo por RPC
-- (la lectura queda en expenses_finance_read de M1)
DROP POLICY supplier_bills_owner ON public.supplier_bills;
CREATE POLICY supplier_bills_insert ON public.supplier_bills FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_finances(owner_type, owner_id) AND amount_paid = 0 AND status = 'open');
DROP POLICY payroll_runs_owner ON public.payroll_runs;     -- queda solo SELECT (M1)
DROP POLICY payroll_items_owner ON public.payroll_items;   -- ídem
-- suppliers / payroll_employees / budgets / expense_attachments: FOR ALL → SELECT (M1) + INSERT + UPDATE con WITH CHECK explícito

-- 4) integridad
ALTER TABLE public.supplier_bills ADD CONSTRAINT supplier_bills_paid_le_amount CHECK (amount_paid <= amount);  -- 0 violaciones hoy

-- 5) RPC → DEFINER (cuerpos idénticos a los vigentes tras Fase 1; ya validan can_manage_finances y usan FOR UPDATE)
CREATE OR REPLACE FUNCTION public.pay_supplier_bill(…) … SECURITY DEFINER …
CREATE OR REPLACE FUNCTION public.post_payroll_run(…) … SECURITY DEFINER …   -- = 20261002130001 (total_gross + total_employer)
CREATE OR REPLACE FUNCTION public.run_payroll(…)      … SECURITY DEFINER …   -- = 20261002130001 (sin /12)

-- 6) auditoría con old y new (audit_trigger_func no guarda old_data)
CREATE FUNCTION public.audit_finance_row() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_row jsonb := to_jsonb(COALESCE(NEW, OLD)); v_school uuid;
BEGIN
  v_school := CASE WHEN v_row->>'owner_type' = 'school' THEN (v_row->>'owner_id')::uuid
                   ELSE NULLIF(v_row->>'school_id','')::uuid END;
  INSERT INTO public.audit_logs (school_id, profile_id, table_name, record_id, action, old_data, new_data)
  VALUES (v_school, auth.uid(), TG_TABLE_NAME, v_row->>'id', TG_OP,
          CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
          CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END);
  RETURN COALESCE(NEW, OLD);
END $$;
-- AFTER INSERT OR UPDATE OR DELETE en: expenses, supplier_bills, suppliers, payroll_runs, payroll_employees,
--   payroll_config, budgets, expense_attachments. (payroll_items NO: run_payroll lo reescribe entero en cada recálculo;
--   el run ya queda auditado.)
```

**GRANT/REVOKE de funciones:** `audit_finance_row`: `REVOKE ALL FROM PUBLIC, anon, authenticated` (un trigger no necesita EXECUTE del que dispara). Las 3 RPC: `REVOKE ALL FROM PUBLIC, anon` + `GRANT EXECUTE TO authenticated, service_role` (hoy tienen `PUBLIC` y `anon`).

**Prueba (BEGIN … ROLLBACK), como owner de Escuela Demo (`de300000…`, la que tiene datos):**
- `delete from expenses where id = <uno>` → **42501** · `update expenses set amount = 1` → 42501.
- `insert into expenses (…kind='payroll'…)` → 42501 · `insert … kind='manual'` → ok, y se crea la fila en `audit_logs` con `new_data`.
- `update supplier_bills set amount_paid = amount + 1` → 42501 (por el grant). Como `postgres`: → `23514` (por el CHECK).
- `update payroll_runs set status='draft' where id='270e490a…'` → **42501** (H13/E-14 cerrado).
- `select pay_supplier_bill(<bill abierto>, 1000, current_date, 'transfer', 'prueba')` → `ok:true`, `amount_paid` sube y `audit_logs` registra `old_data` y `new_data` · el mismo `select` con 10 millones → `amount_exceeds_balance`.
- `select post_payroll_run('270e490a…', null)` → `idempotent:true` (ya está `paid`).
- `select run_payroll('school','de300000…', 2026, 8)` → corre (crea `draft`) · un admin de **otra** escuela llamando lo mismo → `forbidden` (T-11).
- Como `anon`: `select * from payroll_config` → 42501.
- Inventario de policies después: `select cmd, policyname, permissive, roles, qual, with_check from pg_policies where tablename in (…)`. **No puede quedar ninguna `FOR ALL`** en estas tablas, y la cuenta de I3 de `invariantes_seguridad()` tiene que bajar (hoy hay 8 `FOR ALL` contables con `WITH CHECK`; no suman a I3 pero salen del inventario).

**Radio:**
- Frontend: ninguna pantalla hace `UPDATE`/`DELETE` sobre esas tablas (§1.5) → **0 cambios de UI obligados**.
- `PayrollPage` y `AccountingSuppliersPage` siguen llamando las mismas RPC con la misma firma.
- Storage: la policy `accounting_receipts_delete` sigue dejando borrar el comprobante de un gasto (decisión **U8**: recomiendo borrarla aquí).
- **Dinero: 0 pesos** (9 gastos, 3 facturas y 1 nómina, todos de prueba).

**Rollback:** migración nueva que restaura las 9 policies `FOR ALL` (texto guardado), los grants previos (`GRANT … TO authenticated`; **no** volver a dar nada a `anon`) y los cuerpos INVOKER de las 3 RPC. Los triggers de auditoría y el CHECK se pueden dejar.

### M5 · `factura_electronica_guard_pago`

**Objetos:** funciones `guard_payment_invoiced()` y `guard_invoice_requires_paid()` · triggers `trg_zy_guard_pago_facturado` en `payments` y `trg_guard_factura_pago_pagado` en `electronic_invoices`.

```sql
-- (a) no se sale de 'paid' con factura viva sin nota crédito (H6, T-07)
CREATE FUNCTION public.guard_payment_invoiced() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF OLD.status = 'paid' AND NEW.status IS DISTINCT FROM 'paid'
     AND EXISTS (SELECT 1 FROM public.electronic_invoices ei
                  WHERE ei.payment_id = OLD.id AND ei.document_type = 'invoice'
                    AND ei.status IN ('queued','sent','accepted') AND ei.voided_at IS NULL)
     AND current_setting('sportmaps.allow_unpay_invoiced', true) IS DISTINCT FROM 'on'   -- U5
  THEN
    RAISE EXCEPTION 'PAYMENT_INVOICED: el pago tiene factura electrónica vigente; emite la nota crédito antes de anularlo'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_zy_guard_pago_facturado BEFORE UPDATE OF status ON public.payments
  FOR EACH ROW WHEN (OLD.status = 'paid' AND NEW.status IS DISTINCT FROM 'paid')
  EXECUTE FUNCTION public.guard_payment_invoiced();

-- (b) no se crea una factura de un pago que no esté 'paid' (cinturón además del BFF: invoicing.service.ts:380)
CREATE FUNCTION public.guard_invoice_requires_paid() RETURNS trigger … AS $$
DECLARE v_status text;
BEGIN
  IF NEW.payment_id IS NOT NULL AND NEW.document_type = 'invoice' THEN
    SELECT status INTO v_status FROM public.payments WHERE id = NEW.payment_id FOR SHARE;   -- serializa con (a)
    IF v_status IS DISTINCT FROM 'paid' THEN
      RAISE EXCEPTION 'INVOICE_PAYMENT_NOT_PAID: %', COALESCE(v_status,'inexistente') USING ERRCODE = '55000';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_factura_pago_pagado BEFORE INSERT ON public.electronic_invoices
  FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_requires_paid();
```

**GRANT/REVOKE:** ambas funciones `REVOKE ALL FROM PUBLIC, anon, authenticated`.

**Prueba (BEGIN … ROLLBACK):**
- Como `service_role`/`postgres`: `update payments set status='cancelled' where id='f7bcc085…'` (paid + DYTY426 aceptada) → **55000 PAYMENT_INVOICED**. Lo mismo como owner de Dynasty (camino de `PaymentsAutomationPage.tsx:1001`, "Rechazar").
- Con `set local sportmaps.allow_unpay_invoiced = 'on'` → pasa (solo si U5 = sí).
- `update payments set status='paid' where id='3490fed0…'` (re-aprobar) → pasa: el guard no mira la entrada a `paid`.
- `insert into electronic_invoices (payment_id, document_type, status, owner_type, owner_id, provider, …) values ('3490fed0…','invoice','queued', …)` mientras está `awaiting_approval` → **55000 INVOICE_PAYMENT_NOT_PAID**. Si es `document_type='credit_note'` → pasa.
- Un cobro `paid` sin factura → `cancelled` pasa (no hay nada que guardar).

**Radio:**
- En 90 días el guard (a) habría frenado **2** transiciones (las dos de acudientes que ya frena la Fase 1) y **0** de staff.
- Las 77 cancelaciones `paid → cancelled` del 28-jul (limpieza por SQL) no tenían factura: no se habrían frenado.
- Desde ahora, cualquier limpieza de duplicados (DIN-1) de un cobro facturado exige nota crédito primero, o el escape de U5.
- BFF: `voidInvoice` (`invoicing.service.ts:721+`) no toca `payments.status`, así que el orden "nota crédito → anular el pago" funciona sin cambiar código.
- Emisión: 0 cambios (el BFF ya filtra `paid`).
- **0 pesos.**

**Rollback:** `DROP TRIGGER` ×2 (sin datos que revertir).

### M6 *(opcional, decisión U9)* · `contabilidad_bandeja_eventos`

Adelanta de F1 **solo la tabla** `accounting_outbox` y la función de emisión, para que la tienda v2 (que se planea hoy en paralelo) emita desde su F0 sin una segunda pasada. **El procesador `process_accounting_outbox()` y el job de `pg_cron` siguen en F1.** Contrato en §6.

```sql
CREATE TABLE public.accounting_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_kind text NOT NULL CHECK (source_kind IN ('payment','order','order_item','settlement','payout','refund','reservation_payment','delegation_payment')),
  source_id uuid NOT NULL,
  event_kind text NOT NULL CHECK (event_kind IN ('payment_income','payment_reversal','commerce_sale','commerce_commission',
              'commerce_gateway_fee','commerce_payout','commerce_refund','commerce_chargeback','reservation_payment','delegation_payment')),
  owner_type text NOT NULL CHECK (owner_type IN ('school','vendor','organizer')),
  owner_id uuid NOT NULL,
  payload jsonb NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','posted','failed','skipped')),
  attempts int NOT NULL DEFAULT 0, last_error text,
  created_at timestamptz NOT NULL DEFAULT now(), posted_at timestamptz);
ALTER TABLE public.accounting_outbox ENABLE ROW LEVEL SECURITY;          -- sin policies: nadie la lee por PostgREST
REVOKE ALL ON public.accounting_outbox FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.accounting_emit_event(p_source_kind text, p_source_id uuid, p_event_kind text,
    p_owner_type text, p_owner_id uuid, p_payload jsonb, p_idempotency_key text) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$ … INSERT … ON CONFLICT (idempotency_key) DO NOTHING;
  -- si ya existía con OTRO payload → RAISE (es un bug del emisor); si es igual → devuelve el id existente $$;
REVOKE ALL ON FUNCTION public.accounting_emit_event(…) FROM PUBLIC, anon, authenticated;   -- solo la llaman RPC DEFINER de tienda
GRANT EXECUTE ON FUNCTION public.accounting_emit_event(…) TO service_role;
```

**Prueba:** emitir dos veces con la misma clave → un solo id · con otra payload → excepción · como `authenticated`: `select * from accounting_outbox` → 42501, `select accounting_emit_event(…)` → 42501.
**Radio:** 0 (tabla nueva vacía, tienda apagada).
**Rollback:** `DROP TABLE` y `DROP FUNCTION` (si no hay filas).

---

## 3. Orden de despliegue

| Paso | Qué | Bloquea a | Nota |
|---|---|---|---|
| 0 | **Fase 1 de blindaje completa**: frontend de §1.2 → M2 guard de pagos → M3 tienda apagada → **M4 nómina** · reconciliar el ledger (`20261003193616` vs `20261002125955`) con `migrations:sync` | F0-M4 (copia los cuerpos de la Fase 1), F0-M1 (el guard de pagos usa `user_staff_school_ids`) | Hoy solo está aplicada la M1 |
| 1 | Volcado del gemelo local + runner `npm run test:sql:contabilidad` + guarda anti-prod | Todas las pruebas | No es migración. Pre-requisito de "listo" |
| 2 | **M0** (si U1 = B) | M1 | Sola |
| 3 | **M1** `finanzas_permiso_y_rol_contador` | M2, M3 | Ningún cambio visible |
| 4 | **M2** `finanzas_formula_unica_ingreso` + en el mismo push el frontend del dashboard (§4 F2, F3) | — | Desde aquí el coach ya no ve ingresos en el libro. Avisar a Dynasty: los KPIs con sede **suben $34,8M** |
| 5 | **M3** `finanzas_libro_paginado` → después el frontend del libro y del EdR (§4 F4, F5) | — | Primero la RPC, después la UI |
| 6 | **M4** `egresos_sin_borrado_y_auditoria` | — | Antes, verificar que `post_payroll_run` vivo contenga `total_gross` |
| 7 | **M5** `factura_electronica_guard_pago` | — | Antes, decidir U6 (re-aprobar `3490fed0`) |
| 8 | **M6** (si U9 = sí) | F0 de tienda v2 | Puede ir en cualquier momento después del paso 0 |
| 9 | Tareas de datos (§3.1) + conciliación §8.6 con evidencia + `npm run seguridad:invariantes` | Cierre de F0 | — |

Push agrupados: un push de base (pasos 3–7) y uno de frontend (§4). Hay que cuidar el cupo de Vercel.

### 3.1 Tareas de datos de F0 (no son migraciones; las ejecuta o aprueba el usuario)

| # | Qué | Quién |
|---|---|---|
| D1 | C3: `UPDATE payroll_config` 2026 con los valores que confirme el contador (desde `/admin/payroll-config`) | super admin, con la respuesta del contador |
| D2 | GYM RM C8: las 55 importadas, según U4b | owner de GYM RM / usuario |
| D3 | GYM RM C7: los 6 excedentes multi-mes → aplicar a los cobros abiertos del mismo atleta (cerrar la cartera inflada) o confirmar anticipo | owner de GYM RM |
| D4 | Dynasty `3490fed0`: re-aprobar | owner de Dynasty |
| D5 | Dynasty 72 sin FE: completar documento (38), asignar pagador (27), `backfillInvoices` con rango (7) | owner de Dynasty + soporte |

---

## 4. Cambios obligados de BFF y frontend

| # | Dónde | Cambio | Va con |
|---|---|---|---|
| F1 | `frontend/src/integrations/supabase/types.ts` | Regenerar (funciones nuevas; `accountant` si M0) | M1–M3 |
| F2 | `useDashboardStatsReal.ts:114-132` | Reemplazar la suma en el cliente por `rpc('finance_income_summary', {p_owner_type:'school', p_owner_id, p_from: inicio de mes, p_to: fin de mes Bogotá, p_branch_id, p_group:'month'})` (agrega el límite superior que falta). `42501` → ocultar la tarjeta, **no** mostrar $0 | M2 |
| F3 | `useDashboardStatsReal.ts:95` / `DashboardPage.tsx:388` | El coach no pide ingresos (la RPC le da 42501). La tarjeta "Ingresos del mes" solo con permiso. Quitar `\|\| 0` en el monto | M2 |
| F4 | `AccountingPage.tsx:101-148` | `finance_ledger_page` con filtro de mes (por defecto el actual), "Cargar más" por cursor, totales de `finance_ledger_totals` (no la suma de la página), fila "Sin fecha (N · $X)" con `p_include_undated` | M3 |
| F5 | `AccountingReportsPage.tsx:37-82` | `finance_pnl_monthly` en vez de leer `cash_ledger` crudo | M3 |
| F6 | `PayrollPage.tsx:178` | Invalidar `['cash-ledger', schoolId]` como prefijo (hoy deja la clave con sede vieja) | M3 |
| F7 | `PaymentsAutomationPage.tsx:1001` | "Rechazar" solo sobre `awaiting_approval`/`pending` (`.in('status', …)`) y mostrar el error `PAYMENT_INVOICED` legible | M5 |
| F8 | Rol contador (si U1 = B) | `ProtectedRoute.tsx:8,15` · `App.tsx:682-716` (`allowedRoles` + `accountant`) · `routePermissions.ts:116-125` · `navigation.ts:233` (nav `accountant`: Contabilidad sin "Registrar gasto"/"Pagar"/"Liquidar") · unions en `types/dashboard.ts:2`, `AuthContext.tsx:17`, `useSchoolContext.ts:28` · `InvitationsManagementPage.tsx:78, 980-984` (opción "Contador") · ocultar botones de escritura en `AccountingPage`, `AccountingSuppliersPage`, `PayrollPage`, `AccountingBudgetPage` | M1 |
| F9 | BFF `invoicing.routes.ts:59` | `ADMIN_MEMBER_ROLES`: el contador **lee** facturas (GET) pero no emite ni hace nota crédito → dos listas, lectura y escritura | M1 |
| F10 | BFF `middlewares/authMiddleware.ts:47`, `reports.ts:93,249,885` | Decidir si el contador entra a `/reports/school/summary` (U2) | M1 |
| F11 | BFF `reports.ts:65-66, 232, 584-591` y `FinancialSummaryCards.tsx:19-23`, `TransactionsCard.tsx:107,133`, `ReportsPage.tsx:112-139`, `RecepcionPage.tsx:111-124` | Si U3 = ampliado: usar `finance_income_summary`/`_lines` (o `finance_income_amount` en el SQL del BFF). Si no: queda anotado como divergencia conocida para F5 | M2 |
| F12 | `useDashboardStats.ts:154-168` | Sin cambio de llamada. M2 cambia el servidor; verificar que el owner siga viendo su total | M2 |
| F13 | Anti-regresión | Vitest de `useDashboardStatsReal` (42501 → oculto, nunca 0) y prueba SQL R1/R9/R10 en `supabase/tests/contabilidad/` | F0 |

El BFF **no** lee `cash_ledger` ni `school_payment_kpis`, y no escribe `expenses/supplier_bills/payroll_*`: M2–M4 no le cambian nada fuera de F9–F11.

---

## 5. Preguntas para el contador (listas para enviar tal cual)

> **Asunto: SportMaps — validación contable antes de activar el módulo de contabilidad (respuestas por número, por favor)**
>
> Hola. Estamos rehaciendo el módulo de contabilidad de SportMaps (escuelas y clubes deportivos en Colombia). Los clubes registran cobros a familias (mensualidades, inscripciones, artículos, torneos, mora), gastos, proveedores y nómina. No pretendemos llevar libros oficiales: queremos producir libros de gestión y un archivo que usted pueda importar en Siigo o Alegra. Necesitamos su criterio en estos puntos. Donde proponemos algo, basta con "de acuerdo" o su corrección.
>
> **A. Parámetros de nómina 2026 y 2027 (lo más urgente)**
> 1. Para nóminas causadas en 2026, ¿qué valores aplicamos? Tenemos SMMLV $1.750.905 (Decreto 1469 de 2025), auxilio de transporte $249.095 (Decreto 1470 de 2025) y UVT $52.374. Sabemos que el Consejo de Estado suspendió el decreto el 13-feb-2026 y levantó la suspensión en julio. ¿Hubo un valor distinto vigente entre febrero y julio? Si lo hubo, ¿hay que reliquidar esos meses?
> 2. Hoy el sistema tiene cargados por error los valores de 2025 (SMMLV 1.423.500, auxilio 200.000, UVT 49.799). ¿Basta con corregir los parámetros desde hoy o recomienda recalcular las nóminas de 2026 ya liquidadas? (Hoy solo hay una, de prueba.)
> 3. Para 2027: ¿cargamos los valores el día que salga el decreto de diciembre? Si en enero aún no hay decreto, ¿liquidamos con los de 2026 y reliquidamos después, o bloqueamos la liquidación?
> 4. Confirme estos porcentajes: salud 4 % empleado / 8,5 % empleador; pensión 4 % / 12 %; caja de compensación 4 %; SENA 2 %; ICBF 3 %; ARL clase I 0,522 %, II 1,044 %, III 2,436 %, IV 4,35 %, V 6,96 %; prima y cesantías 8,33 % sobre (salario + auxilio); vacaciones 4,17 % sobre salario; intereses de cesantías 12 % anual. Pregunta concreta: si la cesantía se provisiona **cada mes**, ¿el interés del mes es el 12 % de esa cesantía mensual o el 1 % (12 %/12)?
> 5. Exoneración de aportes (art. 114-1 ET): ¿aplica a empleados que devenguen **menos** de 10 SMMLV (10 exactos no)? ¿Qué necesitamos saber del empleador para aplicarla (persona jurídica; persona natural con 2 o más empleados)?
>
> **B. Cuánto y cuándo es ingreso (cobros a familias)**
> 6. Cuando una familia paga **menos** que el cobro porque no pagó la mora (cobro $70.700 = $70.000 + $700 de mora, pagó $70.000) y el club lo da por pagado: ¿el ingreso es $70.000 y la mora no cobrada simplemente no existe (condonada)? ¿O los $700 quedan como cartera?
> 7. Cuando el club da por pagado un cobro con un pago claramente menor ($35.000 de $70.700): ¿lo tratamos como descuento (menor ingreso) o como abono parcial (el saldo sigue en cartera)? Proponemos: si el club lo marcó pagado, descuento.
> 8. Cuando una familia paga **más** que el cobro ($320.000 contra una mensualidad de $70.700, porque pagó varios meses): proponemos registrar el ingreso del mes por $70.700 y el resto como **anticipo recibido (2805)**, que se aplica a los meses siguientes. ¿De acuerdo?
> 9. Pagos por transferencia: la familia transfiere el 30 de septiembre y el club aprueba el comprobante el 2 de octubre. ¿El ingreso es de septiembre (fecha del depósito) u octubre (fecha de aprobación)? Si septiembre ya está cerrado, proponemos registrarlo en octubre con una nota de la fecha real. ¿De acuerdo?
> 10. Un club importó al sistema 55 pagos históricos sin fecha ($3.850.000, cargados el 26-jun-2026). ¿Los tratamos como ingreso de junio de 2026 o como parte del saldo inicial (no son ingreso del período)?
> 11. Un cobro duplicado que se registró como pagado dos veces ($70.000) y luego se anuló: si el club confirma que recibió el dinero una sola vez, no hay nada que registrar. Si lo recibió dos veces, ¿anticipo (2805) o devolución pendiente (2380)?
> 12. Base: proponemos que los ingresos de familias se registren **por caja** (cuando se cobran) y los gastos, proveedores y nómina **por causación** (al registrar la factura o aprobar la nómina). El estado de resultados lo dice al pie. ¿Es aceptable para estados de gestión de estos clubes?
>
> **C. Plan de cuentas (para la siguiente fase; adjuntamos la lista de unas 45 cuentas)**
> 13. ¿Qué marco aplican normalmente estas escuelas y clubes? (NIIF Grupo 2 o 3, persona natural no obligada, ESAL / régimen tributario especial para clubes con reconocimiento deportivo). ¿Cambia el plan de cuentas que debemos ofrecer?
> 14. Ingresos: ¿mensualidades e inscripciones van a 4160 (enseñanza) o 4170 (otras actividades de servicios)? ¿Torneos y artículos (uniformes) van a 4135? ¿Mora a 4210?
> 15. Comisiones de pasarela (Wompi, Mercado Pago) y de SportMaps: ¿5305 (financieros) o 5295/5195?
> 16. Para usted: ¿sirven subcuentas de 6 dígitos creadas por el club bajo cada cuenta de 4, sin permitir crear cuentas de 4 nuevas?
> 17. Saldos iniciales al activar: proponemos que el club digite caja y bancos con extracto, que la cartera salga de los cobros abiertos del sistema y que las cuentas por pagar salgan de las facturas abiertas, todo contra 3705. ¿De acuerdo?
>
> **D. Nómina avanzada (fase posterior; si puede, de una vez)**
> 18. ¿Practicamos retención en la fuente por salarios con el procedimiento 1 (art. 383 ET), con renta exenta del 25 % (tope mensual 790/12 UVT) y dependientes, medicina prepagada e intereses de vivienda como campos opcionales?
> 19. ¿Redondeamos los aportes al múltiplo de $100 superior, como la PILA, o a peso?
> 20. ¿Podría firmar, cuando se los enviemos, cinco casos calculados (1, 3, 10, 12 y 18 SMMLV)?
>
> **E. Exportación**
> 21. ¿Usa Siigo Nube, Alegra u otro? ¿Nos puede compartir la plantilla vigente de importación de comprobantes contables que usa?
>
> Gracias. Las preguntas 1–12 son las que nos frenan hoy; 13–21 pueden esperar dos semanas.

---

## 6. Interfaz con Tienda v2 — qué espera contabilidad

Esto no diseña la tienda. Fija **qué tiene que entregar la tienda** para que su dinero llegue al libro del dueño correcto. El modelo y los asientos están en `contabilidad-v2.md` §6.

### 6.1 Conflicto que hay que resolver YA con el equipo de tienda

`tienda-v2-estilo-mercadolibre.md` §6.8 dice: *"Se expone en `cash_ledger` con una rama nueva desde `orders`/`settlements`"*. **Eso choca con este plan:** M2 redefine `cash_ledger`, y en F1 el libro pasa a ser el mayor (`journal_*`) alimentado por la bandeja. **La tienda no agrega ramas a `cash_ledger` ni escribe en tablas contables.** Su única salida contable es emitir eventos. Si la tienda necesita mostrar ventas antes de F6, lo hace en sus propias pantallas, leyendo `orders`/`settlements`.

### 6.2 El contrato

| Pieza | Regla |
|---|---|
| Cómo | `public.accounting_emit_event(source_kind, source_id, event_kind, owner_type, owner_id, payload, idempotency_key)`, llamada **dentro de la misma transacción** de la RPC de tienda que cambia el estado: confirmación de pago, liquidación, payout, reembolso, contracargo. Si U9 = no, la tienda deja esos puntos marcados y los conecta en F1 |
| Quién la llama | Solo RPC `SECURITY DEFINER` de tienda o el BFF con `service_role`. **Nunca** el navegador |
| Fallar | La emisión no valida negocio (no lanza error por montos que no cuadran: el procesador marca `failed`). Solo lanza error si la misma clave llega con otro payload (es un bug) |
| `event_kind` por momento | Pago confirmado → `commerce_sale` + `commerce_commission` + `commerce_gateway_fee` (uno por vendedor) · payout → `commerce_payout` · reembolso → `commerce_refund` · contracargo → `commerce_chargeback` |
| `source_kind`/`source_id` | `order_item` o `settlement` para venta/comisión/fee, `payout` para payout, `refund` para reembolso. Id de la fila de tienda, que **nunca se borra** |
| **Dueño** | Se resuelve **por ítem al vender** y se guarda en la fila. **Corrección al spec madre:** `vendor_profiles` **no tiene `school_id`** (verificado). La escuela dueña está en `products.school_id`. Regla: `products.school_id IS NOT NULL` → (`school`, `products.school_id`); si no → (`vendor`, `products.vendor_profile_id`). La tienda debe fotografiar `owner_type/owner_id` en `order_items` (o en `settlements`) al crear la orden |
| Un evento por vendedor | Una orden con ítems de dos dueños emite dos `commerce_sale` (si D-2 de tienda, "un solo vendedor por orden", se mantiene, siempre es uno) |
| `idempotency_key` | `<event_kind>:<source_id>[:<seq>]`. Los reintentos del webhook reusan la clave |
| `payload` | `gross, base, vat, vat_rate, shipping, commission, commission_rate (foto), gateway_fee, net, currency='COP', settlement_mode ∈ direct\|via_platform, payout_batch_id, buyer_party {type,id}, electronic_invoice_id, effective_date` (fecha **Bogotá** del hecho, `YYYY-MM-DD`) |
| Montos | **Pesos enteros**, ya redondeados por la regla de D-F. Tienen que cuadrar: `gross = base + vat + shipping` y `net = gross − commission − gateway_fee` |
| Reembolso parcial | `commerce_refund` con los mismos campos en proporción. Nunca se modifica el evento de venta |
| Lo que contabilidad garantiza | Postear cada evento **una vez** (clave única), en el período abierto, en el libro del dueño. Avisar los `failed`. Verificar **IC10** (saldo 1380 por vendedor = settlements pendientes) |
| Decisiones de tienda que bloquean F6 (no F0) | **D-E** (IVA incluido o sumado; envío) y **D-F** (un solo motor de payout y comisión) |

### 6.3 Checklist para el F0 de tienda

1. Guardar `owner_type/owner_id`, `commission_rate`, `vat_rate` y `gateway_fee` **por ítem** al crear la orden (foto, no recálculo).
2. Montos en pesos enteros desde el origen.
3. Ningún `DELETE` sobre `orders`, `order_items`, `settlements`, `vendor_payouts`, `refunds`.
4. Un solo camino de confirmación de pago (T8), que es donde se emite `commerce_sale`.
5. No tocar `cash_ledger`, `payments` ni `expenses` para registrar ventas, comisiones o fees. (Hoy la comisión de pasarela de cobros escolares sí va a `expenses` por `fn_school_fee_to_expense`; eso **no** se extiende a órdenes.)

---

## 7. Estimación

| Bloque | Esfuerzo |
|---|---|
| Gemelo local (volcado de esquema), runner SQL `BEGIN…ROLLBACK`, guarda anti-prod, CI | 3–4 d |
| M0 + M1 (rol, permisos, helpers de staff, policies de lectura) + pruebas R1/R5/R10 | 2 d |
| M2 (fórmula única, vista, KPIs, `get_school_dashboard_stats`) + conciliación §8.6 con evidencia | 2,5 d |
| M3 (libro paginado, totales, EdR) | 1 d |
| M4 (egresos inmutables, RPC a DEFINER, auditoría) + inventario de policies | 1,5 d |
| M5 (guard DIAN) | 0,5 d |
| M6 (bandeja, opcional) | 0,5 d |
| Frontend/BFF §4 (F2–F9; F11 si U3 = ampliado: +1,5 d) | 3 d |
| Tareas de datos D1–D5 (acompañamiento, no código) | 1 d |
| **Total** | **≈ 15–16 días hábiles (~3 semanas)**; ~12 días sin gemelo ni M6 |

El spec decía "M (2 sem)". La diferencia viene de N1–N4, de las 5 sumas extra si se amplía U3 y del gemelo, que el spec cuenta dentro de F0 pero que es infraestructura para todas las fases.

---

## 8. Decisiones que tiene que tomar el usuario

| # | Decisión | Recomendación |
|---|---|---|
| **U1** | Modelo del rol contador. **A:** solo en `school_members`, con una RPC propia de "dar acceso a mi contador", sin tocar `profiles.role` (la UI lo reconoce por la membresía). **B:** como `reporter`: valor en el enum `user_role` (M0) + invitación normal (`accept_invitation_pro`) + rutas por `profile.role` | **B**: sigue un precedente vivo y reutiliza el flujo de invitaciones. Ojo: `UNIQUE(profile_id, school_id)` hace que un acudiente de la escuela no pueda ser también su contador, y `accept_invitation_pro` le **reemplazaría** el rol |
| **U2** | ¿El contador ve **salarios** (`payroll_employees`, `payroll_items`) y el resumen del BFF `/reports`? | Sí a nómina (D-ROL: "lectura total"). No a `/reports` en F0 |
| **U3** | Alcance de "una sola fórmula" en F0: solo los 3 consumidores del spec, o también `get_school_dashboard_stats` (**obligatorio por la fuga C12**), `FinancialSummaryCards`, `ReportsPage`, `RecepcionPage` y el BFF `reports.ts` | Spec + `get_school_dashboard_stats` en F0. El resto a F5 con divergencia documentada |
| **U4** | D-FECHA: aplicarlo **del lado de la escritura** (desde el despliegue, la aprobación estampa `payment_date = ocr_date` validado, con ventana de 45 días) o recalcular el pasado | **Hacia adelante.** Recalcular movería 8 cobros de Dynasty ($1,2M) entre meses ya **cerrados** (ago, sep) |
| **U4b** | GYM RM C8 (55 importados sin fecha, $3,85M) | Hasta que responda el contador (pregunta 10), dejarlos visibles en el bucket "sin fecha". Después: fecha 2026-06-26 o saldo inicial |
| **U5** | Guard DIAN: ¿válvula de escape `sportmaps.allow_unpay_invoiced` para soporte? | Sí, solo en `SET LOCAL` dentro de una RPC de super admin que exija motivo y escriba en `audit_logs`. Nunca desde el cliente |
| **U6** | `3490fed0` (Dynasty, DYTY427): ¿re-aprobar o nota crédito? | **Re-aprobar** (D4): el cobro estaba bien pagado y la factura es correcta |
| **U7** | ¿`can_manage_finances` reconoce a super admin y a los owners por `schools.owner_id`? | Sí, alinea la base con el BFF (`invoicing.routes.ts:82`). Radio: 2 escuelas sin dinero |
| **U8** | ¿Se borra la policy `accounting_receipts_delete` (comprobantes de gasto borrables)? | Sí, en M4 |
| **U9** | ¿Adelantar la bandeja (`accounting_outbox` + `accounting_emit_event`) a F0 para que tienda v2 emita desde su F0? | **Sí** (M6, medio día). Si no, la tienda hace dos pasadas |
| **U10** | Gate del addon `accounting` en la base: solo en las RPC nuevas (`finance_permission`), no en las policies existentes | Así. Ponerlo en `can_manage_finances` rompe la facturación de Dynasty (N4) |
| **U11** | ¿F0 sigue esperando a A2 (`create_catalog_purchase`, blindaje F2) como dice el spec? | No. A2 bloquea **F1** (postear ingresos). La fórmula de F0 no depende del origen del precio |
| **U12** | Residual de C4: el coach sigue pudiendo leer `payments` crudo por PostgREST (lo necesitan asistencia y "al día") | Aceptarlo en F0 y anotarlo. Cerrarlo exige una vista por columnas (trampa 4): otra fase |
