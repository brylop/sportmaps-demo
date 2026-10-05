# Spec — Contabilidad v2: libro mayor inmutable, multi-dueño y con pruebas completas

**Versión:** v0.1 · **Fecha:** 2026-10-02 · **Rama:** `develop` · **Estado:** 🔵 borrador para revisión — **no se escribe código ni migraciones hasta aprobar el plan de la fase (§9)**.
**Roadmap:** absorbe `ERP-1..6` (§2 y §3 del [ROADMAP](../ROADMAP.md)), integra la Fase 2 y la Fase 3 de [`blindaje-dinero-pagos-tienda-nomina.md`](blindaje-dinero-pagos-tienda-nomina.md) (sin duplicarlas, §1.3) y aterriza el modelo de [`pendientes-cxc-cxp-nomina.md`](pendientes-cxc-cxp-nomina.md) §7.
**Origen:** [`auditoria-contabilidad-tienda-2026-10-02.md`](../auditoria-contabilidad-tienda-2026-10-02.md) (A*, C*), [`plan-salida-ingresos-egresos-2026-10-02.md`](../plan-salida-ingresos-egresos-2026-10-02.md) (H*, I-/E-/T-), [`month-close-module.md`](month-close-module.md).
**Spec hermano (otro equipo, no se toca aquí):** `tienda-v2-estilo-mercadolibre.md`. Este documento define **la interfaz** por la que una venta, una comisión y un payout llegan a la contabilidad del dueño correcto (§6).

> **En una línea.** Hoy el "libro" es una vista (`cash_ledger`) que reescribe el pasado cada vez que cambia un `status`, no cierra meses, no audita, no pagina, se la muestra al coach y no cuadra con las otras dos sumas de ingreso. La v2 lo reemplaza por un **libro mayor de partida doble inmutable** (decisión D-PD ya tomada), con **una sola fórmula de ingreso** en SQL, **períodos con candado**, **multi-dueño real** (escuela / vendedor / organizador) y una batería de pruebas que se corre por fase.

---

## 0. Punto de partida (verificado contra la base viva el 2026-10-02, solo SELECT)

| Pieza | Estado real |
|---|---|
| Libro mayor (`journal_entries`, `journal_lines`, `chart_of_accounts`, `accounting_periods`, `obligations`, `cash_movements`) | **No existe ninguna tabla.** Todo el modelo de `pendientes-cxc-cxp-nomina.md` §7 está en papel |
| `cash_ledger` | Vista `security_invoker` = `payments` (`paid`/`partial`, `LEAST(amount, COALESCE(amount_paid, amount))`, fecha `payment_date`) ∪ `expenses` (`paid`, fecha `paid_date`) |
| `expenses` | Solo `owner_type='school'` en uso. Enums con `CREATE TYPE` (deuda; las tablas nuevas usan `text + CHECK`) |
| `pay_supplier_bill`, `post_payroll_run`, `run_payroll` | **`SECURITY INVOKER`** → escriben a través de las policies de las tablas, por eso un admin puede `UPDATE`/`DELETE` directo (C5) |
| `payroll_config` | Una sola fila, `year=2026`, con valores 2025 (SMMLV 1.423.500, auxilio 200.000, UVT 49.799). `fsp_pct` es **un solo porcentaje** (no escalonado). Sin 2027 |
| `monthly_closes` | Existe (5 filas, 2 escuelas). Es una **foto**: ningún trigger la consulta |
| `audit_logs` | Genérica (`table_name, record_id, action, old_data, new_data, profile_id`). No está enganchada a `expenses`, `supplier_bills`, `payroll_runs`, `budgets` |
| Tienda | `orders`, `settlements` (gross/platform_fee/gateway_fee/tax/net), `vendor_payouts` vivas, **fuera del libro**. `reservation_payments` y `event_delegation_payments` también fuera |
| Roles de escuela | `school_members.role ∈ owner, admin, school_admin, coach, staff, parent, athlete, viewer, reporter, super_admin`. **No hay rol contador** |
| PostgREST `max_rows` | No aparece en `authenticator.rolconfig` (solo `statement_timeout=8s`, `lock_timeout=8s`). Sigue **sin verificar**; la v2 lo vuelve irrelevante paginando del lado servidor |
| Uso real | **Cero escuelas reales con un movimiento contable.** Ingresos reales sí: Dynasty (`2d509571…`), Besser (`759eee9d…`), GYM RM (`2137182d…`) |
| Pruebas | **Ni un test** de contabilidad, nómina, proveedores, libro o tienda. Playwright nunca corrió contra contabilidad: el local apunta a la única Supabase (producción) |

Consecuencia práctica: **arrancar limpio es casi gratis** (D-MIG). No hay historia contable que migrar, solo historia de cobros, y esa no se migra (§3.4 del ROADMAP).

---

## 1. Principios y alcance

### 1.1 Reglas que no se negocian

1. **Partida doble desde la primera fase** (D-PD, resuelta 2026-08-01). Ningún flujo de dinero se registra sin contrapartida.
2. **Inmutable.** `journal_entries`/`journal_lines` no otorgan `UPDATE` ni `DELETE` a ningún rol; un trigger levanta excepción si se intenta. Toda corrección es un **asiento de reverso** (`reversal_of` + motivo ≥ 10 caracteres) fechado **en el período abierto**, nunca en el original.
3. **Toda escritura por RPC `SECURITY DEFINER`** (`SET search_path = pg_catalog, public, pg_temp`, `REVOKE` explícito de `PUBLIC`, `anon`, `authenticated` y luego `GRANT EXECUTE` al rol que corresponde — trampa 3). Las tablas no dan `INSERT/UPDATE/DELETE` a `authenticated`.
4. **Una sola fórmula de ingreso** (§3.3) que leen libro, KPIs, dashboard, estado de resultados y presupuesto.
5. **Un período cerrado no recibe asientos.** El candado vive en la base, no en la UI.
6. **CxC no se migra** (ROADMAP §3.4): `payments` sigue siendo la obligación por cobrar; la v2 la **lee** (cartera) y la **postea** (ingreso).
7. **La historia no se contabiliza hacia atrás** (D-CORTE): el mayor de cada dueño arranca con un asiento de saldos de apertura.
8. **Dinero en pesos enteros** en todo lo que se postea (`numeric(18,2)` en columnas, pero las RPC redondean a peso con regla documentada). Fechas contables en **zona Bogotá**, nunca `todayIso()` UTC.

### 1.2 Alcance

| Entra en la v2 | Fuera (v3 o nunca) |
|---|---|
| Libro mayor, períodos, reversos, auditoría, roles | Libros oficiales certificados / firma de contador dentro del producto |
| Ingresos por concepto: mensualidad, inscripción, artículos, torneos, mora, tienda, reservas, delegaciones | Devengado de CxC (el cobro emitido como ingreso) — ver D-BASE |
| Egresos con comprobante (obligatorio configurable), proveedores, CxP con pagos parciales, multi-factura y reverso | Inventario valorizado y costo de ventas de la tienda |
| IVA descontable, retefuente y reteICA básicos en egresos | Declaraciones tributarias, medios magnéticos |
| Nómina CO correcta: FSP escalonado, exoneración, retefuente procedimiento 1, provisiones como pasivo, pago de prima/cesantías | Novedades complejas (incapacidades, licencias, horas extra), nómina electrónica DIAN (fase propia) |
| CxC/cartera por antigüedad, conciliación bancaria, facturación electrónica conectada | Multimoneda |
| Estado de resultados, flujo de caja, presupuesto vs ejecutado, export CSV/XLSX y formato importable Siigo/Alegra | Contabilidad propia de SportMaps como plataforma (`owner_type='platform'` queda reservado) |
| Multi-dueño en UI: escuela, vendedor, organizador | |

### 1.3 Cómo se integran la Fase 2 y la Fase 3 del spec de blindaje

Cada ítem se construye **una sola vez**. Lo que es del dominio de cobros se queda en blindaje y la v2 lo trata como prerrequisito.

| Ítem de blindaje | Dónde vive | Nota |
|---|---|---|
| F2 2.1 · A2 `create_catalog_purchase` | **Blindaje F2** (prerrequisito de v2-F0) | Sin precio desde el servidor no hay ingreso confiable que postear |
| F2 2.2 · C4 coach ve ingresos | **v2-F0** | Se resuelve en la fórmula única: la RPC exige `can_read_finances` |
| F2 2.3 · Egresos inmutables | **v2-F0** (parte barata: sin `DELETE`, `CHECK amount_paid <= amount`, auditoría, `payroll_runs.status` solo por RPC) → **v2-F1/F2** (anular = reverso en el mayor) | La parte barata no espera al mayor |
| F2 2.4 · Reverso de pago | **v2-F1** | Es el asiento de reverso (§3.5) |
| F2 2.5 · Bloqueo de mes cerrado | **v2-F1** | `accounting_periods` + enganche con `close_month` (§3.6) |
| F2 2.6 · Guard DIAN | **v2-F0** | Es P0 de la auditoría; no espera a F4 |
| F2 2.7 · Libro con período y paginación | **v2-F0** (RPC paginada sobre la fórmula) → v2-F5 (UI nueva) | |
| F2 2.8 · Mora sin artículos/torneos | **Blindaje F2** | Dominio de cobros |
| F2 2.9 · A5 toggles en INSERT · A3 KPIs con `branch_id IS NULL` | A5 → blindaje F2 · **A3 → v2-F0** (lo arregla la fórmula única) | |
| F2 2.10 · `vendor_profiles` | **Blindaje F2 / tienda v2** | |
| F3 · A4 estampar `payment_category` en los 14 caminos + backfill | **Blindaje F3**, **bloquea v2-F5** (ingresos por concepto) | v2-F0 mide cuántos quedan sin categoría |
| F3 · C6 `trial_block` para vendor/organizer | **v2-F1** | Es parte de multi-dueño real |
| F3 · C7–C9 limpieza GYM RM | **v2-F0** (conciliación a 0) | Coordinar con DIN-1 §8 |
| F3 · A7 desglose en pantalla | **v2-F5** | |
| F3 · C10 fee de pasarela | **v2-F2** (egresos) y **v2-F6** (tienda) | |
| F3 · CSV, UTC, `owner_type` fijo | **v2-F5** (CSV/UTC) · **v2-F1** (`owner_type`) | |

---

## 2. Decisiones abiertas — lista corta con recomendación

Las de ROADMAP §5 (D-PUC, D-T, D-CORTE, D-MIG, D-NOM, D-ROL) más las que abre este spec. **Ninguna fase arranca con una decisión suya abierta.**

| # | Decisión | Recomendación | Bloquea |
|---|---|---|---|
| **D-PUC** | Plan de cuentas: PUC completo o reducido | **Reducido (~45 cuentas) con códigos PUC reales** (Decreto 2650) para que el contador lo reconozca y el export mapee sin traducción; el dueño (o su contador) puede crear **subcuentas de 6+ dígitos** bajo una cuenta posteable, nunca cuentas nuevas de 4. Catálogo semilla en §3.1, **validado por un contador antes de F1** | F1 |
| **D-T** | Tercero: `parties` unificada o polimórfico | **Polimórfico** `party_type + party_id` (`profile`, `child`, `unregistered_athlete`, `supplier`, `employee`, `vendor`, `school`) + vista `v_parties` para listar/buscar y exportar NIT/CC. No obliga a migrar `suppliers` ni `payroll_employees` | F1 |
| **D-CORTE** | Fecha de corte y saldos de apertura | **Por dueño, el día 1 del mes en que activa la v2.** Asiento de apertura con asistente: caja y bancos (los digita el dueño, con extracto), CxC = saldo vivo de `payments` abiertos al corte, CxP = facturas de proveedor abiertas, pasivo laboral = 0 o digitado. Diferencia contra patrimonio (3705). Antes del corte, los reportes leen la fórmula legacy (§3.3) y lo dicen en pantalla | F1 |
| **D-MIG** | ¿Migrar `expenses` ya pagados? | **No. Arrancar limpio.** Solo hay 9 gastos, todos de prueba | F1 |
| **D-NOM** | Obligación de nómina: trigger o RPC | **RPC explícita** `approve_payroll_run` (causación) y `pay_payroll_run` (pago). Un trigger es difícil de deshacer | F3 |
| **D-ROL** | Matriz de permisos | **Nuevo rol `accountant` en `school_members`** (lectura total + export + cerrar período; **no** reabre, **no** paga). `owner/admin/school_admin` = todo. `coach/staff/reporter/viewer` = **cero dinero** (consistente con D-B). Una sola función `finance_permission(owner_type, owner_id, action)` reemplaza a `can_manage_finances` (que queda como envoltorio). Sin tercera matriz de coach (SEG-4) | F1 |
| **D-BASE** *(nueva)* | ¿Caja o devengado? | **Base mixta explícita:** ingresos de familias **por caja** (al cobrar, porque CxC no se migra y `open_month` todavía puede duplicar, DIN-1); egresos, proveedores y nómina **por causación** (al registrar la factura o aprobar la nómina). El estado de resultados lo declara en el pie. Devengado de CxC = toggle v3 | F1 |
| **D-ING** *(nueva)* | Fórmula de ingreso cobrado | **Dinero efectivamente recibido:** `COALESCE(amount_paid, amount)` en `paid`, `amount_paid` en `partial`. Si `amount_paid > amount`, el excedente va a **anticipos recibidos (2805)**, no se pierde ni se infla el ingreso. Se aplica **después** de clasificar las 73 + 10 filas de GYM RM (C7) en F0: si la diferencia es comisión de pasarela, es egreso; si es descuento, es menor ingreso | F0 |
| **D-FECHA** *(= I-05 / P1-2)* | Fecha del ingreso por comprobante | **Fecha del depósito** cuando la escuela la confirma (o el OCR la valida); si no, la de aprobación. Si esa fecha cae en un período cerrado, el asiento va al primer día del período abierto con referencia a la fecha real | F0 |
| **D-I** | `cancelled` con abono | **Devolución pendiente** (pasivo 2805/2380) hasta que el staff decida reembolsar o reaplicar | F1 |
| **D-H** | Perímetro del ingreso | **Entra todo:** tienda, reservas y delegaciones postean al dueño correcto (F6). Hasta F6 la pantalla dice "no incluye tienda/reservas" | F6 |
| **D-COMP** *(nueva)* | Comprobante obligatorio en egresos | **Toggle por dueño + umbral** (`expense_receipt_required`, `expense_receipt_threshold`). Por defecto apagado; recomendado al dueño encenderlo desde $200.000 | F2 |
| **D-PILA** *(nueva)* | Redondeo de aportes | **Al múltiplo de 100 superior**, como la PILA. Hoy el motor redondea a peso; si se adopta, los casos dorados (§8.4) se recalculan con la misma hoja y el contador los vuelve a firmar | F3 |
| **D-RETE** *(nueva)* | ¿Retención en la fuente en nómina? | **Sí, procedimiento 1** (art. 383 ET), con renta exenta 25 % y tope mensual de 790/12 UVT; dependientes, medicina prepagada e intereses de vivienda como campos opcionales por empleado | F3 |
| **C3** | Valores 2026 de `payroll_config` | **Los confirma el contador** (blindaje §0). Decretos 1469 y 1470 de 2025: SMMLV $1.750.905, auxilio $249.095, UVT $52.374. Y cargar 2027 en diciembre | F0 |
| **D-EXP** *(nueva)* | Primer formato importable | **Siigo Nube primero** (el más usado por contadores en Colombia), **Alegra segundo** (ya es socio PAC). El "libro diario plano" (§5.8) sirve a los dos; las plantillas exactas se validan contra el archivo de importación vigente de cada uno **antes de F5** | F5 |
| **D-POST** *(nueva)* | Posteo síncrono o con bandeja | **Síncrono** en las RPC propias de contabilidad (gasto, factura, pago a proveedor, nómina). **Bandeja (`accounting_outbox`)** para todo lo que viene de `payments` y de la tienda: un cobro nunca debe fallar porque falló el asiento | F1 |
| D-B, D-C, D-D, D-E, D-F | Ya decididas o de otros specs | D-B coach sin ingresos (blindaje). D-C nómina entra corregida. D-D mora sin artículos. **D-E (IVA en tienda) y D-F (motor de payout) las cierra tienda v2**, pero cambian el asiento de §6: tienen que estar resueltas antes de v2-F6 | F6 |

---

## 3. Modelo

### 3.1 Plan de cuentas semilla (reducido, a validar con contador — D-PUC)

`chart_of_accounts` global (semilla) + `owner_account_overrides` (subcuentas por dueño). Cuentas de agrupación con `is_postable=false`.

| Código | Cuenta | Uso en SportMaps |
|---|---|---|
| 1105 | Caja | Efectivo, caja de recepción (`cash_sessions`) |
| 1110 | Bancos | Una **subcuenta por cuenta bancaria** del dueño (las llaves de `payment_accounts`) |
| 1120 | Cuentas de ahorro | Ídem |
| 1305 | Clientes | Saldo de apertura de CxC (al corte) |
| 1330 | Anticipos y avances | Anticipos a proveedores |
| 1355 | Anticipo de impuestos | Retenciones que le practican al dueño |
| 1380 | Deudores varios | **Pasarelas y SportMaps: recaudos por liquidar** (Wompi, MP, tienda) |
| 2205 | Proveedores | CxP |
| 2335 | Costos y gastos por pagar | Gastos causados sin factura de proveedor |
| 2365 / 2367 / 2368 | Retención en la fuente / IVA retenido / ICA retenido | Retenciones practicadas |
| 2370 | Retenciones y aportes de nómina | Salud, pensión, FSP, ARL, caja, SENA, ICBF por pagar (PILA) |
| 2380 | Acreedores varios | Devoluciones por pagar a familias (D-I) |
| 2408 | IVA por pagar | Ventas gravadas de tienda |
| 2505 | Salarios por pagar | Neto de nómina |
| 2510 / 2515 / 2520 / 2525 | Cesantías / Intereses / Prima / Vacaciones consolidadas | Provisiones (pasivo laboral) |
| 2805 | Anticipos y avances recibidos | Excedentes cobrados (D-ING), pagos adelantados |
| 3105 | Capital social / aportes | Apertura |
| 3705 | Resultados de ejercicios anteriores | Contrapartida de saldos de apertura |
| 4135 | Comercio al por mayor y menor | Ventas de tienda y artículos físicos |
| 4160 / 4170 | Enseñanza / Otras actividades de servicios | Mensualidad, inscripción, torneos, reservas (el contador elige cuál por concepto) |
| 4175 | Devoluciones en ventas | Reversos de tienda |
| 4210 | Financieros | Mora |
| 5105 | Gastos de personal | Nómina (salario, auxilio, aportes patronales, provisiones) |
| 5110 / 5120 / 5135 / 5145 / 5195 | Honorarios / Arrendamientos / Servicios / Mantenimiento / Diversos | Categorías de gasto (`expense_categories` mapea aquí) |
| 5305 | Financieros | **Comisiones de pasarela y de SportMaps**, gastos bancarios |

### 3.2 Tablas (delta sobre `pendientes-cxc-cxp-nomina.md` §7)

Se adopta el DDL de §7.0–7.1 de ese spec **con estos cambios**:

| Cambio | Por qué |
|---|---|
| `journal_entries.school_id` → **`owner_type` + `owner_id`** (mismo eje que `expenses`) y `branch_id` opcional | Multi-dueño real (vendor/organizer) |
| `journal_entries.source_kind` amplía a `payment, payment_reversal, expense, supplier_bill, bill_payment, payroll_accrual, payroll_payment, provision_payment, commerce_sale, commerce_commission, commerce_gateway_fee, commerce_payout, commerce_refund, reservation_payment, delegation_payment, bank_adjustment, opening_balance, reversal, manual` | Una entrada por tipo de evento |
| **`UNIQUE (source_kind, source_id, event_seq)`** en `journal_entries` | Idempotencia del posteo: reprocesar la bandeja no duplica |
| `journal_entries.reversed_by uuid` + `UNIQUE (reversal_of)` | Un asiento se reversa **una sola vez** |
| `journal_entries.effective_date` (fecha real del hecho) además de `entry_date` (fecha contable) | Un pago del 30-sep aprobado con septiembre cerrado: `effective_date=30-sep`, `entry_date=01-oct` |
| `journal_lines.branch_id`, `journal_lines.concept_key` (`mensualidad`, `inscripcion`, `articulos`, `torneo`, `mora`, `tienda`, `reserva`, `delegacion`…) | Filtro por sede y "ingresos por concepto" sin depender del texto |
| `accounting_periods` por **(owner_type, owner_id, year, month)** con `status ∈ open, closed` y `closed_by/at`, `reopened_by/at/reason` | Candado por dueño |
| `school_account_mappings` → **`owner_account_mappings (owner_type, owner_id, flow_key, account_code)`** con semilla por defecto | Sin mapeo no se postea; la semilla hace que el día 1 funcione sin configurar |
| **`accounting_outbox`** (`id, source_kind, source_id, event_kind, owner_type, owner_id, payload jsonb, idempotency_key UNIQUE, status ∈ pending, posted, failed, skipped, attempts, last_error, created_at, posted_at`) | D-POST. Lo procesa `process_accounting_outbox()` por `pg_cron` cada minuto |
| `obligations.kind ∈ payable, payroll, provision` y `owner_type/owner_id` | CxP, nómina y provisiones (prima/cesantías) con pago parcial |
| Impuestos en `obligations`: `base_amount, vat_amount, withholding_income, withholding_vat, withholding_ica` | IVA descontable y retenciones (H11) |
| `obligation_attachments` (comprobante/factura) — reusa bucket `accounting-receipts` | D-COMP |

Lo que **no** cambia: cuadre por `CONSTRAINT TRIGGER … DEFERRABLE INITIALLY DEFERRED`, `one_side_only`, inmutabilidad por trigger, lock pesimista `FOR UPDATE` en cruces, `idempotency_key` (CONC-1 es prerrequisito).

### 3.3 Una sola fórmula de ingreso

Hoy hay tres sumas que divergen (A3, C7; memoria *tres agregaciones*). La v2 deja **una función** y tres consumidores.

```text
finance_income_lines(p_owner_type, p_owner_id, p_from, p_to, p_branch_id)   -- SETOF, una fila por movimiento
finance_income_summary(p_owner_type, p_owner_id, p_from, p_to, p_branch_id, p_group text)  -- 'month' | 'concept' | 'method' | 'branch'
```

| Regla | Valor |
|---|---|
| Fuente | Meses **≥ corte** del dueño: líneas del mayor sobre cuentas 4xxx (neto de reversos). Meses **< corte**: `payments` con la fórmula legacy corregida. La función decide; el consumidor no sabe |
| Monto | D-ING: `COALESCE(amount_paid, amount)` en `paid`, `amount_paid` en `partial`; excedente sobre `amount` fuera del ingreso (va a 2805) |
| Fecha | `payment_date` en Bogotá; si es NULL → **no se adivina**: la fila aparece en un bucket "sin fecha" que la pantalla muestra (C8) hasta que el backfill de blindaje F3 la corrija |
| Sede | `branch_id = p_branch_id OR branch_id IS NULL` (lo de sede nula aparece en todas, y la pantalla lo dice). Arregla A3 |
| Concepto | `payment_category`; NULL → `sin_categoria` (visible, no fusionado) |
| Permiso | `finance_permission(owner, 'read')`; coach/staff/reporter → `42501` (C4) |
| `SECURITY` | DEFINER, `STABLE`, `search_path` fijo, `GRANT EXECUTE` a `authenticated` |

Consumidores: `cash_ledger` se **redefine** como `SELECT … FROM finance_income_lines(...) UNION ALL egresos` (compatibilidad mientras F5 no reemplaza las pantallas) · `school_payment_kpis()` llama a `finance_income_summary` · `useDashboardStatsReal` deja de sumar en el cliente y llama a la misma RPC.

**Invariante IC6:** para todo dueño y mes, `cash_ledger` = KPIs = dashboard = `finance_income_summary`, al peso.

### 3.4 Capa de posteo — qué asiento produce cada evento

| Evento | Quién lo emite | Asiento (dueño = quien recibe el dinero) |
|---|---|---|
| Cobro pasa a `paid`/`partial` (cualquiera de los 14 caminos, webhook, aprobación) | Trigger AFTER en `payments` → **bandeja** | Dr 1110/1105/1380 (según método) · Cr 4160/4170 por concepto · Cr 4210 la parte de mora · Cr 2805 excedente |
| Abono adicional (`partial` → más `amount_paid`) | Ídem | Solo el delta, **con su propia fecha** (arregla I-08/H8) |
| Cobro cobrado pasa a `cancelled`/`refunded`/vuelve a revisión | Ídem | **Reverso** del/los asientos vivos, fechado hoy (período abierto). Si había FE aceptada → exige nota crédito (§5.9) |
| Gasto manual | RPC `record_expense` (síncrona) | Dr 5xxx (por categoría) [+ Dr 2408 IVA descontable] · Cr 1110/1105 [Cr 2365/2367/2368 retenciones] |
| Factura de proveedor | RPC `record_supplier_bill` | Dr 5xxx [+ IVA] · Cr 2205 [Cr retenciones] |
| Pago a proveedor (parcial o multi-factura) | RPC `pay_obligations` (un movimiento, N cruces) | Dr 2205 · Cr 1110 |
| Aprobación de nómina | RPC `approve_payroll_run` | Dr 5105 (devengado + patronal + provisiones) · Cr 2505 (neto) · Cr 2370 (deducciones + patronal) · Cr 2365 (retefuente) · Cr 2510–2525 (provisiones) |
| Pago de nómina / PILA / prima / cesantías | RPC `pay_obligations` | Dr 2505 / 2370 / 2520 / 2510 · Cr 1110 |
| Comisión de pasarela que absorbe el dueño | Bandeja (webhook) | Dr 5305 · Cr 1380 (C10, H9) |
| Liquidación de la pasarela al banco | Conciliación (§5.7) | Dr 1110 · Cr 1380 |
| Tienda, reservas, delegaciones | Bandeja (§6) | §6 |
| Apertura | RPC `post_opening_balances` (una vez por dueño) | Dr activos · Cr pasivos · contra 3705 |
| Ajuste manual | RPC `post_manual_entry` (solo `owner/admin`, motivo obligatorio) | Libre, cuadrado |
| Reverso de cualquier asiento | RPC `reverse_entry(entry_id, reason)` | Espejo, `reversal_of`, en período abierto |

`process_accounting_outbox()` toma filas `pending` con `FOR UPDATE SKIP LOCKED`, resuelve dueño y cuentas por `owner_account_mappings`, postea con la clave de idempotencia, marca `posted` o `failed` (con `last_error`, máx. 5 intentos y alerta). **Nunca** revierte la escritura de origen.

### 3.5 Reversos (H2, blindaje 2.4)

- No existe "editar" ni "borrar" un movimiento contabilizado. Gasto, factura, cruce, nómina y cobro se **anulan** → `status='void'` en la tabla de origen + asiento de reverso.
- El reverso cae en el **período abierto** (`entry_date` = hoy Bogotá o el primer día abierto), con `effective_date` y referencia al original. El mes cerrado **no cambia**.
- Anular un pago a proveedor reabre el saldo de la factura (`settled_amount` se recalcula de los cruces vivos).
- UI: botón **"Anular"** con motivo (≥ 10 caracteres), visible solo con permiso `void`; el original queda tachado con enlace al reverso.

### 3.6 Período contable y cierre (H3, ERP-3, blindaje 2.5)

| Regla | Mecanismo |
|---|---|
| Un asiento con `entry_date` en período `closed` se rechaza | Trigger BEFORE INSERT en `journal_entries` que lee `accounting_periods` con `FOR SHARE` (`PERIOD_CLOSED: 2026-09`) |
| Cerrar y postear a la vez no deja mitades | `close_period` toma `FOR UPDATE` sobre la fila del período; los posteos toman `FOR SHARE` → se serializan |
| `close_month(scope)` del ciclo de mes cierra también el período contable | `close_month` llama a `close_period` en la misma transacción; `reopen_month` llama a `reopen_period` (motivo obligatorio, solo `owner/admin`, auditado) |
| Orígenes con fecha en mes cerrado | **Gasto/factura con fecha en mes cerrado → rechazo** con mensaje claro ("Septiembre está cerrado. Regístralo en octubre o pide reabrir"). **Cobros**: el cobro conserva su `period_month` (el mes que paga) y el asiento va al período abierto (D-FECHA) |
| Snapshot del cierre | Pasa a ser un **reporte congelado sobre el mayor** (ROADMAP §3.2); D7 del ciclo de mes se actualiza en ese spec cuando F1 entre a plan |
| Soft-close (D3 del ciclo de mes) | Se mantiene: cerrar septiembre no bloquea operar octubre |

### 3.7 Auditoría (quién / cuándo / qué)

- El mayor **es** su propia auditoría (`created_by`, `created_at`, inmutable, reversos enlazados).
- `audit_trigger_func` (ya existe, DEFINER) se engancha a `expenses`, `suppliers`, `supplier_bills`/`obligations`, `obligation_settlements`, `cash_movements`, `payroll_runs`, `payroll_items`, `payroll_employees`, `payroll_config`, `budgets`, `accounting_periods`, `owner_account_mappings`, `school_members` (cambios de rol a `accountant`).
- Pantalla **"Historial"** por movimiento (Ojo, ERP-1): quién lo creó, quién lo anuló, motivo, asiento.

### 3.8 Permisos (D-ROL)

`finance_permission(owner_type, owner_id, action)` con `action ∈ read, write, pay, void, close, reopen, configure, export`.

| Acción | owner / admin / school_admin | accountant *(nuevo)* | coach / staff / reporter / viewer | parent / athlete | vendor (su perfil) | organizer (él mismo) | super_admin |
|---|---|---|---|---|---|---|---|
| read, export | ✅ | ✅ | ❌ | ❌ (solo sus propios cobros, fuera de contabilidad) | ✅ | ✅ | ✅ |
| write (gasto, factura) | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| pay, void | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| close | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| reopen, configure (mapeos, apertura) | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |

Gate del addon `accounting` **también en la base** (hoy solo UI): `finance_permission` devuelve falso para `write/pay/close` si el dueño escuela no tiene el addon activo (la lectura de ingresos de cobros sigue, porque Gestión de Pagos la usa). `trial_block` aplica a vendor/organizer con su propio criterio (C6).

---

## 4. Nómina Colombia correcta

| # | Qué | Hoy | v2 |
|---|---|---|---|
| N1 | Egreso = bruto + patronal | Blindaje F1 M4 lo corrige en `post_payroll_run` | Causación completa (§3.4) |
| N2 | Intereses de cesantías | Blindaje F1 M4 quita el `/12` | Igual |
| N3 | FSP escalonado | `fsp_pct` único | `fsp_brackets jsonb` en `payroll_config`: 4–<16 SMMLV 1 %, 16–17 1,2 %, 17–18 1,4 %, 18–19 1,6 %, 19–20 1,8 %, ≥20 2 % |
| N4 | Exoneración (art. 114-1 ET) | Umbral 10 SMMLV | Exonerado si **< 10 SMMLV** (10 exactos **no** exonera); toggle por dueño (persona natural con < 2 empleados no aplica → `exoneration_eligible` por empleador) |
| N5 | Auxilio de transporte | Sí | ≤ 2 SMMLV; entra a la base de cesantías y prima, **no** al IBC ni a vacaciones |
| N6 | Salario integral | No | Flag por empleado: IBC = 70 %, sin prestaciones de cesantías/prima |
| N7 | Tope IBC | ? | 25 SMMLV |
| N8 | Retención en la fuente | No | D-RETE, procedimiento 1 |
| N9 | Redondeo | `round()` a peso | D-PILA |
| N10 | Parámetros anuales | Editables por super admin en `/admin/payroll-config` | Igual + **validación** (SMMLV > año anterior, % en rango) + **aviso** desde el 1-dic en `/admin` y en `PayrollPage` del dueño si falta el año siguiente; `run_payroll` sin año → `no_config_for_year` con texto claro (blindaje F1) |
| N11 | Provisiones | Se calculan, no se registran | Pasivo 2510–2525 y obligación pagable (prima en junio/diciembre, cesantías al fondo antes del 14-feb, intereses en enero) |
| N12 | Doble posteo | Posible (C5/H13) | `payroll_runs.status` solo por RPC; `approve_payroll_run` idempotente por `run_id`; anular = reverso |
| N13 | Desprendible | Ventana de impresión | Igual + PDF con totales que cuadran con el asiento |

---

## 5. Funcionalidad tipo producto serio

### 5.1 Ingresos por concepto
Estado de resultados y dashboard desglosados por `concept_key` (mensualidad, inscripción, artículos, torneos, mora, tienda, reservas, delegaciones, **sin categoría**). "Sin categoría" se muestra con su monto y un enlace "¿qué es esto?" hasta que blindaje F3 (A4) lo lleve a 0.

### 5.2 Egresos
Formulario único: fecha (Bogotá), categoría → cuenta, tercero, método/cuenta bancaria, base, IVA, retenciones (calculadas por defecto según el tercero y editables), comprobante (obligatorio si D-COMP aplica). **Una RPC transaccional** (gasto + adjunto + asiento), no tres escrituras sueltas.

### 5.3 Proveedores y CxP
Ficha de tercero Natural/Jurídica (NIT/CC, DV, régimen, responsable de IVA, retenedor). Facturas con vencimiento. Pagos parciales, **un giro que paga N facturas**, anulación de un cruce. Pestaña **Por pagar** con antigüedad (0–30, 31–60, 61–90, >90).

### 5.4 CxC / cartera
Pestaña **Por cobrar** que **lee `payments`** (sin migrar): saldo por familia/atleta, por equipo/sede, por antigüedad desde `due_date` (mismos buckets), mora acumulada, enlace al cobro. Total de cartera cuadra con `school_payment_kpis` (IC9).

### 5.5 Presupuesto vs ejecutado
`budgets` pasa a cuentas (o categoría → cuenta) **y** a ingresos por concepto. Ejecutado = mayor del mes. Si la consulta del ejecutado falla → **error visible**, nunca $0 (bug actual).

### 5.6 Estado de resultados y flujo de caja (por mes)
- **Estado de resultados**: ingresos (4xxx) − gastos (5xxx) por mes, columnas enero…diciembre + total, filtro de sede, base declarada (D-BASE).
- **Flujo de caja**: movimiento de 1105/1110/1120 por mes, saldo inicial y final, separando operación (cobros, gastos, nómina) de liquidaciones de pasarela.
- Ambos con agregación **del lado servidor** (RPC), nunca sumando filas en el navegador.

### 5.7 Conciliación bancaria
Reusa `bank_statements`/`bank_statement_lines` y lo aprendido en comprobantes v2 / glosas. Cambia el destino: una línea del extracto se cruza con **líneas del mayor en la subcuenta 1110 de esa cuenta**. Sin match → sugerencias (monto ± fecha ± referencia, la regla de igualdad exacta de cuenta enmascarada ya conocida) o "crear asiento" (gasto bancario, liquidación de pasarela 1380→1110). Saldo según banco vs según libros por mes.

### 5.8 Export para el contador
| Export | Formato |
|---|---|
| Libro diario | CSV y XLSX, **UTF-8 con BOM**, separador `;` para Excel en español, comillas y escape correctos, fechas `AAAA-MM-DD`, montos sin separador de miles. Una fila por `journal_line`: comprobante, fecha, cuenta, nombre cuenta, tercero tipo/número/DV/nombre, débito, crédito, sede (centro de costo), concepto, referencia de origen |
| Mayor y balance de prueba | XLSX por cuenta y por mes |
| Estado de resultados, flujo, cartera, CxP | XLSX con los mismos números que la pantalla |
| **Siigo Nube** (D-EXP) | Mapeo del libro diario a la plantilla de importación de comprobantes contables: tipo y consecutivo de comprobante, fecha, cuenta PUC, NIT, débito/crédito, centro de costo, descripción. **Columnas exactas a validar contra la plantilla vigente antes de F5** |
| **Alegra** | Mismo origen; Excel de importación de comprobantes o API de asientos (Alegra ya es socio PAC) |

Cada export lleva hash del contenido y queda registrado (quién, cuándo, rango) en `audit_logs`.

### 5.9 Facturación electrónica conectada
- Guard (F0, blindaje 2.6): no se emite FE de un pago que no esté `paid`, y **no se puede sacar de `paid` un pago con FE aceptada** sin nota crédito: la RPC de anulación la exige o la dispara (`POST /invoicing/credit-note/:id`).
- Investigar la factura aceptada el 01-oct sobre un pago en `awaiting_approval` y los 73 pagos manuales de Dynasty sin FE (P1-7) en F0.
- El asiento del ingreso guarda `electronic_invoice_id`; el reverso guarda el de la nota crédito. Reporte "facturado vs cobrado" por mes (H9: recargo online facturado sobre `gross_amount`).
- Tienda: el emisor es el vendedor o la escuela dueña del ítem (T20), resuelto por la misma regla de dueño de §6.

---

## 6. Interfaz con Tienda v2 — cómo llega el dinero de comercio al dueño correcto

La tienda (spec hermano) **no escribe en el mayor**. Escribe, dentro de la misma transacción de sus RPC, **una fila en `accounting_outbox`** por evento. La contabilidad la postea.

### 6.1 Contrato del evento

| Campo | Regla |
|---|---|
| `source_kind` | `order`, `order_item`, `settlement`, `payout`, `refund` |
| `source_id` | id de la fila de tienda |
| `event_kind` | `commerce_sale`, `commerce_commission`, `commerce_gateway_fee`, `commerce_payout`, `commerce_refund`, `commerce_chargeback` |
| `owner_type`, `owner_id` | **El vendedor del ítem**, resuelto por la tienda: `vendor_profiles.vendor_type='school'` → (`school`, `school_id`); si no → (`vendor`, `vendor_profile_id`). Una orden con ítems de dos vendedores emite un evento **por vendedor** |
| `idempotency_key` | `<event_kind>:<source_id>[:<seq>]`. Reintentos del webhook no duplican |
| `payload` | `gross`, `base`, `vat`, `vat_rate`, `shipping`, `commission`, `commission_rate` (foto, no la actual), `gateway_fee`, `net`, `currency='COP'`, `settlement_mode ∈ direct, via_platform`, `payout_batch_id`, `buyer_party` (tipo/id), `electronic_invoice_id`, `effective_date` (Bogotá) |
| Montos | Pesos enteros, ya redondeados por la tienda con la regla de D-F. `gross = base + vat + shipping` y `net = gross − commission − gateway_fee` **deben** cuadrar o el evento queda `failed` |

### 6.2 Asientos que produce (en los libros del vendedor)

| Evento | `via_platform` (SportMaps recauda y luego paga) | `direct` (cuenta conectada del vendedor) |
|---|---|---|
| `commerce_sale` | Dr 1380 SportMaps por liquidar · Cr 4135 base · Cr 2408 IVA · Cr 4135/4170 envío | Dr 1110 · Cr 4135 · Cr 2408 |
| `commerce_commission` | Dr 5305 · Cr 1380 | Dr 5305 · Cr 2380 (por pagar a SportMaps) |
| `commerce_gateway_fee` | Dr 5305 · Cr 1380 | Dr 5305 · Cr 1110 |
| `commerce_payout` | Dr 1110 · Cr 1380 | — |
| `commerce_refund` | Reverso proporcional: Dr 4175 · Dr 2408 · Cr 1380 (o 1110) | Ídem contra 1110 |
| `commerce_chargeback` | Como refund + Dr 5305 por la penalidad | Ídem |

Invariante de comercio **IC10**: por vendedor, saldo de 1380 = ventas `via_platform` − comisiones − fees − payouts − reembolsos; y debe coincidir con `settlements` pendientes de pago. Un payout que deja 1380 negativo es un **doble pago** (T7) y la invariante lo grita.

Lo que la contabilidad de SportMaps como plataforma (el ingreso por comisión) haga queda **fuera** (`owner_type='platform'` reservado).

### 6.3 Reservas y delegaciones
Mismo mecanismo: `reservation_payments` aprobado → `reservation_payment`; `event_delegation_payments` → `delegation_payment` (dueño = escuela/organizador del evento). Concepto `reserva` / `delegacion`.

### 6.4 Lo que la tienda v2 tiene que garantizar (checklist de interfaz)
1. Vendedor resuelto por ítem y guardado en la fila (no recalculado después).
2. Foto de comisión e IVA en el momento de la venta.
3. Un solo motor de payout (D-F, T7).
4. Emitir el evento en la **misma transacción** que cambia el estado (`confirm_order_payment`, payout, reembolso).
5. No borrar nunca una fila de `orders`/`settlements`/`vendor_payouts` (los reversos se hacen con eventos).

---

## 7. UX

| Tema | Regla |
|---|---|
| Menú | `Dinero → Pendientes (Por cobrar · Por pagar · Nómina) · Movimientos · Contabilidad (Estado de resultados · Flujo · Presupuesto · Conciliación · Exportar · Configuración)` — ERP-6 junto con UX-4 |
| Dashboard contable | 4 tarjetas: Ingresos del mes, Egresos del mes, Resultado, Caja y bancos; debajo: cartera vencida, por pagar esta semana, nómina próxima, conciliación pendiente. Cada número enlaza a su detalle |
| Filtros | Período (mes, trimestre, año, rango), sede, concepto, tercero, cuenta. Se guardan en la URL |
| Paginación | **Keyset** del lado servidor (`entry_date, id`), 50 por página; totales de una RPC aparte (nunca la suma de la página) |
| Estados | Componente único `<MoneyState>`: cargando (esqueleto), **error ("No se pudo cargar — Reintentar", nunca $0)**, vacío ("Aún no hay movimientos en octubre"), datos. Prohibido `?? 0` en montos que vienen de la red (lint en F5) |
| Mes cerrado | Banda "Septiembre cerrado por X el …"; acciones de escritura ocultas (no deshabilitadas, ERP-1) |
| Íconos | Ojo = ver contabilización; Lupa = solo búsqueda (ERP-1) |
| Móvil | Tablas → tarjetas bajo `md`; filtros en hoja inferior; safe-area (MOV-3); objetivos táctiles ≥ 44 px; export descarga el archivo |
| Multi-dueño | `useAccountingOwner()` resuelve escuela / vendor_profile / organizer; las 6 páginas dejan de fijar `owner_type='school'`; entradas en los menús de vendor y organizer |
| Fechas | `todayColombia()` en todas las pantallas (bug UTC) |
| Texto | Español de Colombia, sin "vos/che" |

---

## 8. Plan de pruebas (por fase, todas obligatorias para el "listo")

### 8.1 Ambientes — cómo no tocar producción

| Capa | Dónde corre | Cómo |
|---|---|---|
| **SQL de RLS, invariantes y RPC** | **Base viva** solo dentro de `BEGIN … ROLLBACK` (patrón del repo) **y** en el gemelo local | Runner `npm run test:sql:contabilidad` (node + `pg`): envuelve cada archivo de `supabase/tests/contabilidad/*.sql` en `BEGIN … ROLLBACK`, falla si algún `ASSERT`/`RAISE` dispara. En la viva **nunca** `COMMIT` |
| **Concurrencia** | **Solo en el gemelo local** | Requiere dos sesiones que hacen `COMMIT`; no se puede con rollback en la viva |
| **Playwright E2E** | **Gemelo local**, nunca la viva | Ver abajo |
| **Conciliación con datos reales** | Base viva, **solo SELECT** | §8.6 |
| **Pasarela y DIAN** | Wompi sandbox, Factus sandbox (escuela demo) | Manual, con checklist |

**Gemelo local (propuesta).** `supabase start` (Docker) + **volcado de esquema de la viva** (`pg_dump --schema-only` de `public`, `storage` policies y funciones; incluye los ~336 objetos sin versionar, que es por lo que no sirve reconstruir desde `supabase/migrations/`) + semilla sintética `supabase/tests/seed/contabilidad.sql` (dos escuelas QA, un vendor, un organizer, y un usuario por rol de §3.8, creados con la API admin de auth local). BFF y frontend locales con `SUPABASE_URL=http://127.0.0.1:54321`. El volcado se regenera cada noche en CI (solo lectura) y en cada PR de contabilidad.

**Guarda anti-producción.** `globalSetup` de Playwright y el runner SQL abortan si la URL contiene `luebjarufsiadojhvxgi` y la variable `ALLOW_LIVE_READONLY` no está, y Playwright aborta **siempre** contra la viva. Cuando se ejecute `separar-prod-de-dev-stg.md`, el destino pasa a ser el proyecto de staging.

**Patrón SQL de simulación de rol** (todas las pruebas de permisos):

```sql
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', '<uuid-del-usuario>', 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  begin
    insert into public.journal_entries (owner_type, owner_id, entry_date, source_kind, description)
    values ('school', '<escuela>', current_date, 'manual', 'intento directo');
    raise exception 'FALLO: INSERT directo al mayor permitido';
  exception when insufficient_privilege then null;  -- esperado: 42501
  end;
end $$;
rollback;
```

### 8.2 Matriz de RLS / permisos (positivos y negativos)

Roles simulados: owner, school_admin, accountant, coach, staff, reporter, parent, athlete, admin **de otra escuela**, vendor dueño, vendor ajeno, organizer, anon, service_role.

| # | Prueba | Esperado |
|---|---|---|
| R1 | Cada rol llama `finance_income_summary` de la escuela | owner/admin/accountant ✅; coach/staff/reporter/parent/athlete/otra escuela/anon → 42501 |
| R2 | `select` directo a `journal_entries/lines`, `obligations`, `cash_movements` | Solo filas del dueño con `read`; anon 0 filas y sin GRANT |
| R3 | `INSERT/UPDATE/DELETE` directo a cualquier tabla contable como cualquier rol `authenticated` | 42501 |
| R4 | `UPDATE`/`DELETE` sobre `journal_*` como `postgres` (dentro de rollback) | Excepción del trigger de inmutabilidad |
| R5 | Cada RPC de escritura con cada rol | Según §3.8; accountant `pay` → `forbidden`; accountant `close` ✅, `reopen` → `forbidden` |
| R6 | Admin de escuela A llama `pay_obligations` / `approve_payroll_run` / `reverse_entry` sobre escuela B | `forbidden` (T-11) |
| R7 | Vendor A lee/escribe el libro de vendor B; organizer lee el de otro | 42501 |
| R8 | Escuela sin addon `accounting`: `record_expense` | `addon_required`; lectura de ingresos ✅ |
| R9 | `cash_ledger` como coach de Dynasty | 0 filas de ingreso (hoy 559, C4) |
| R10 | `EXECUTE` de cada RPC nueva para `anon` y `PUBLIC` | Sin privilegio (trampa 3) |
| R11 | `npm run seguridad:invariantes` | 0 CRÍTICAS; I3 de tablas contables = 0; sin policies `FOR ALL` nuevas |
| R12 | Las cinco trampas del CLAUDE.md, listando **todas** las policies de cada tabla contable | Ninguna permisiva abierta de más |

### 8.3 Invariantes contables (`invariantes_contables()`, también en cron nocturno)

Se implementan como RPC análoga a `invariantes_seguridad()` y como pruebas SQL.

| # | Invariante | Prueba que la ejerce |
|---|---|---|
| IC1 | Todo asiento cuadra (Σ débito = Σ crédito) | Insertar asiento descuadrado vía RPC → falla al `COMMIT` (trigger diferido) |
| IC2 | Ningún asiento con `entry_date` en período cerrado creado después de `closed_at` | Cerrar → `record_expense` con fecha en el mes → `PERIOD_CLOSED`; cobro aprobado con fecha del mes cerrado → asiento en el período abierto |
| IC3 | Reverso deja neto 0 por cuenta; un asiento se reversa a lo sumo una vez | `reverse_entry` dos veces → segunda falla; Σ(original + reverso) por cuenta = 0 |
| IC4 | Auxiliar = mayor: Σ CxP abiertas = saldo 2205; Σ neto nómina por pagar = 2505; Σ aportes = 2370; provisiones = 2510–2525 | Escenario con 3 facturas, 2 pagos parciales, 1 anulación |
| IC5 | Todo `payments` cobrado después del corte tiene exactamente un ingreso vivo (neto de reversos); todo cobrado→anulado tiene reverso; la bandeja no tiene `pending` > 10 min ni `failed` | Simular los 14 caminos (los ejecutables en SQL) y revisar la bandeja |
| IC6 | `cash_ledger` = KPIs = dashboard = `finance_income_summary` | Por dueño y mes |
| IC7 | `obligations.settled_amount` = Σ cruces vivos ≤ `total_amount` | Pago, anulación de cruce, nuevo pago |
| IC8 | Saldo de bancos según libros = extracto conciliado al cierre del mes | Extracto de prueba con 1 partida sin match |
| IC9 | Cartera (Por cobrar) = saldo abierto de `payments` = `school_payment_kpis.pending` | Dynasty en solo lectura |
| IC10 | Comercio: saldo 1380 por vendedor = settlements pendientes | §6.2 |
| IC11 | Nada en `journal_*` sin `owner_type/owner_id` válido ni con cuenta no posteable | Intento con cuenta de agrupación → rechazo |

### 8.4 Nómina — casos dorados (calculados a mano, con los decretos 1469/1470 de 2025)

**Supuestos:** SMMLV $1.750.905 · auxilio $249.095 · UVT $52.374 · ARL clase 1 = 0,522 % · salud 4 % / 8,5 %, pensión 4 % / 12 %, caja 4 %, SENA 2 %, ICBF 3 % · cesantías y prima 8,33 % sobre (salario + auxilio), vacaciones 4,17 % sobre salario, intereses = 12 % de la cesantía del mes · **redondeo a peso** (regla actual; si se adopta D-PILA se regeneran) · persona jurídica con derecho a exoneración · retefuente procedimiento 1 con solo la renta exenta del 25 % (tope 790/12 UVT), resultado redondeado a miles. **Requieren la firma del contador antes de cerrar F3** (C3 sigue abierta).

| Concepto | **1 SMMLV con auxilio** | **3 SMMLV** | **10 SMMLV (frontera, sin exoneración)** | **12 SMMLV** | **18 SMMLV (FSP 1,6 %)** |
|---|---|---|---|---|---|
| Salario | 1.750.905 | 5.252.715 | 17.509.050 | 21.010.860 | 31.516.290 |
| Auxilio transporte | 249.095 | 0 | 0 | 0 | 0 |
| IBC | 1.750.905 | 5.252.715 | 17.509.050 | 21.010.860 | 31.516.290 |
| Salud empleado 4 % | 70.036 | 210.109 | 700.362 | 840.434 | 1.260.652 |
| Pensión empleado 4 % | 70.036 | 210.109 | 700.362 | 840.434 | 1.260.652 |
| FSP | 0 | 0 | 175.091 (1 %) | 210.109 (1 %) | 504.261 (1,6 %) |
| **Total deducciones** | **140.072** | **420.218** | **1.575.815** | **1.890.977** | **3.025.565** |
| Retefuente | 0 | 0 | 1.820.000 | 2.712.000 | 5.656.000 |
| **Neto a pagar** | **1.859.928** | **4.832.497** | **14.113.235** | **16.407.883** | **22.834.725** |
| Salud patronal 8,5 % | 0 (exonerado) | 0 (exonerado) | 1.488.269 | 1.785.923 | 2.678.885 |
| Pensión patronal 12 % | 210.109 | 630.326 | 2.101.086 | 2.521.303 | 3.781.955 |
| ARL clase 1 | 9.140 | 27.419 | 91.397 | 109.677 | 164.515 |
| Caja 4 % | 70.036 | 210.109 | 700.362 | 840.434 | 1.260.652 |
| SENA 2 % | 0 | 0 | 350.181 | 420.217 | 630.326 |
| ICBF 3 % | 0 | 0 | 525.272 | 630.326 | 945.489 |
| **Total patronal** | **289.285** | **867.854** | **5.256.567** | **6.307.880** | **9.461.822** |
| **Costo caja del mes** (bruto + patronal) | **2.289.285** | **6.120.569** | **22.765.617** | **27.318.740** | **40.978.112** |
| Cesantías | 166.600 | 437.551 | 1.458.504 | 1.750.205 | 2.625.307 |
| Intereses cesantías | 19.992 | 52.506 | 175.020 | 210.025 | 315.037 |
| Prima | 166.600 | 437.551 | 1.458.504 | 1.750.205 | 2.625.307 |
| Vacaciones | 73.013 | 219.038 | 730.127 | 876.153 | 1.314.229 |
| **Total provisiones** | **426.205** | **1.146.646** | **3.822.155** | **4.586.588** | **6.879.880** |

Comprobaciones de la hoja: neto + deducciones + retefuente = bruto; costo caja = neto + deducciones + retefuente + patronal; en 9,99 SMMLV el patronal cae a 2.889.953 (con exoneración), es decir **el salto en 10 SMMLV es de ~$2,37M** y tiene que estar cubierto. Retefuente 12 SMMLV: base = 21.010.860 − 1.890.977 − 3.447.955 (exenta, tope) = 15.671.928 = 299,23 UVT → (299,23 − 150) × 28 % + 10 UVT = 51,78 UVT.

Las cinco columnas viven en `supabase/tests/fixtures/nomina_casos_dorados.json` y las consumen: (a) prueba SQL que corre `run_payroll` dentro de rollback y compara **cada** campo de `payroll_items` al peso, (b) vitest del cálculo de vista previa del frontend si lo hay, (c) prueba del asiento de `approve_payroll_run` (Dr 5105 = bruto + patronal + provisiones; Cr 2505 = neto; Cr 2370 = deducciones + patronal; Cr 2365 = retefuente; Cr 2510–2525 = provisiones). Casos extra: salario integral 13 SMMLV (IBC 70 %), empleado con 15 días (proporcional), año sin parámetros (`no_config_for_year` con el texto del aviso).

### 8.5 Concurrencia (gemelo local, dos o más sesiones con `COMMIT`)

| # | Escenario | Esperado |
|---|---|---|
| K1 | Dos `pay_obligations` de $200.000 a la vez sobre una factura con saldo $250.000 | Uno pasa, otro `amount_exceeds_balance`; `settled_amount ≤ total` |
| K2 | Doble clic: dos `pay_obligations` con la **misma** `idempotency_key` | Un solo movimiento y un solo asiento |
| K3 | Dos `approve_payroll_run` del mismo run a la vez | Un asiento; el otro devuelve `idempotent=true` |
| K4 | `approve_payroll_run` mientras alguien intenta devolver el run a `draft` | Imposible (sin `UPDATE` directo); el run queda aprobado una vez |
| K5 | Dos `reverse_entry` del mismo asiento | Uno pasa; el otro choca con `UNIQUE (reversal_of)` |
| K6 | `close_period` mientras la bandeja postea 100 cobros del mismo mes | Cada asiento queda o antes del cierre (en el mes) o después (en el abierto); **ninguno** en el mes cerrado después de `closed_at` (IC2) |
| K7 | Webhook Wompi repetido + anulación del pago en paralelo | Ingreso y reverso exactamente una vez cada uno; neto 0 |
| K8 | Dos workers de `process_accounting_outbox()` | `SKIP LOCKED`: ningún evento posteado dos veces |
| K9 | Conciliar la misma línea de extracto en dos sesiones | Un cruce |
| K10 | Payout de tienda duplicado (dos motores, T7) | IC10 lo rechaza o lo detecta; nunca 1380 negativo silencioso |

### 8.6 Conciliación de las tres vías con datos reales (solo lectura en la viva)

Escuelas: **Dynasty** (`2d509571-3238-4c04-ac3f-6dfe20539226`), **Besser** (`759eee9d-05cb-4958-b84a-2560f77e3683`), **GYM RM** (`2137182d-a695-4695-8e5a-61151fc59196`). Meses: enero–septiembre 2026, sin sede y por cada sede.

1. **Línea base (hoy):** suma por mes de (a) `cash_ledger`, (b) `school_payment_kpis` (con y sin sede), (c) la fórmula de `useDashboardStatsReal` reescrita en SQL (`sum(amount)` de `paid` por `payment_date` del mes). Se guarda el resultado como evidencia del F0.
2. **Clasificación de diferencias:** cada peso de diferencia queda explicado en una tabla: sede nula (A3), `amount_paid ≠ amount` (C7, 73 + 10 filas), sin `payment_date` (C8, 55–66 filas), `cancelled` con abono (C9).
3. **Con la fórmula única:** se crea `finance_income_summary` **dentro de `BEGIN … ROLLBACK`** en la viva y se compara contra (a), (b), (c) ya redirigidos a ella. **Criterio: 0 de diferencia** entre las tres vías en los 27 escuela-mes; y la diferencia contra la línea base igual a la suma de las filas clasificadas en el paso 2 (ni un peso sin explicar).
4. Repetir en F1 contra el mayor (meses ≥ corte) — IC6.

### 8.7 Vitest

| Módulo | Qué se prueba |
|---|---|
| `lib/accounting/money.ts` | Redondeo a peso, formato COP, nunca `NaN`/`undefined` → "—" |
| `lib/accounting/period.ts` | `todayColombia()` a las 23:59 y 00:01 Bogotá; mes contable de un pago del 30-sep 23:59 |
| `lib/export/csv.ts` / `xlsx.ts` | BOM presente, `;`, comillas, concepto con `;`, `"` y salto de línea, tildes, montos sin miles |
| `lib/export/siigo.ts` / `alegra.ts` | Fila de libro diario → fila de plantilla; un asiento cuadrado produce un comprobante cuadrado |
| `lib/accounting/aging.ts` | Buckets 0–30/31–60/61–90/>90 en las fronteras |
| `<MoneyState>` | Error → "No se pudo cargar", nunca "$0" |
| `useAccountingOwner` | school / vendor / organizer / sin dueño |
| BFF: rutas de export | Permiso por rol, rango obligatorio, auditoría escrita |
| Nómina (si hay cálculo en TS) | Los cinco casos dorados |

### 8.8 Playwright TS (gemelo local)

Specs en `frontend/e2e/contabilidad/` por flujo, nombre `<tema>.<suite>.spec.ts`:

| Spec | Recorrido |
|---|---|
| `gasto.regression.spec.ts` | Registrar gasto con comprobante → aparece en Movimientos y en el EdR → anular con motivo → reverso visible, original tachado |
| `proveedores.regression.spec.ts` | Proveedor → factura $400.000 → pago parcial 150.000 → saldo 250.000 → pago multi-factura → anular un cruce |
| `nomina.regression.spec.ts` | Empleado 1 SMMLV → liquidar → los números de la tabla dorada en pantalla → aprobar → pagar → desprendible |
| `cierre.regression.spec.ts` | Cerrar septiembre → intentar gasto en septiembre (mensaje claro) → aprobar pago con fecha de septiembre (cae en octubre con nota) → accountant no ve "Reabrir" |
| `reportes.regression.spec.ts` | EdR y flujo de caja del año = totales de `finance_income_summary` y del mayor (consulta directa al gemelo) |
| `permisos.regression.spec.ts` | Coach, parent, reporter → `/accounting*` bloqueado; accountant ve todo sin botones de escritura |
| `export.regression.spec.ts` | Descargar libro diario → abrir el archivo → BOM, columnas, cuadre |
| `estados.regression.spec.ts` | Red caída (route abort) → "No se pudo cargar", nunca $0; vacío → mensaje de vacío |
| `movil.regression.spec.ts` | Viewport 390×844: tarjetas, filtros en hoja inferior, sin scroll horizontal |
| `multi-dueno.regression.spec.ts` | Vendor y organizer ven su contabilidad y no la de la escuela |
| `paginacion.regression.spec.ts` | Semilla con 2.500 movimientos: páginas, orden estable, total = suma servidor |

Manual (checklist firmado): Wompi sandbox aprobado/rechazado/repetido, nota crédito Factus sandbox al anular un pago facturado, pago real con la cuenta QA acudiente solo si hace falta.

---

## 9. Fases (una rama por fase, revisión entre fases, plan de migraciones aprobado antes de código)

Tamaños: S 1–3 d · M 1–2 sem · L > 2 sem. Cada fase: migraciones con `npm run migrations:new`, probadas en `BEGIN … ROLLBACK` contra la viva **y** en el gemelo, aplicadas por `apply_migration`, verificadas preguntándole al objeto, y `npm run seguridad:invariantes` al cerrar.

| Fase | Rama | Contenido | Tamaño | Depende de | Listo cuando |
|---|---|---|---|---|---|
| **F0 · Cimientos y una sola verdad** | `feature/contab-v2-f0` | Gemelo local + runner SQL + guarda anti-prod · `finance_permission` + rol `accountant` · `finance_income_lines/summary` (D-ING, D-FECHA) y los 3 consumidores redirigidos (A3, C4, C7) · RPC paginada del libro actual (blindaje 2.7) · parte barata de egresos inmutables (sin `DELETE`, `CHECK`, auditoría, `payroll_runs` solo por RPC) · guard DIAN (2.6) e investigación de la factura del 01-oct y los 73 de Dynasty · `payroll_config` 2026 confirmado + 2027 + aviso (C3) · clasificación de las filas de GYM RM (C7–C9) | M (2 sem) | Blindaje F1 desplegado · A2 (blindaje 2.1) · respuesta del contador a C3 · D-ING, D-FECHA, D-ROL | §8.6 en **0 de diferencia** en los 27 escuela-mes con cada peso clasificado · R1, R9, R10 verdes · coach de Dynasty ve 0 ingresos · runner y gemelo corriendo en CI |
| **F1 · Libro mayor** | `feature/contab-v2-f1` | Plan de cuentas (D-PUC) · `journal_*` con cuadre diferido e inmutabilidad · `accounting_periods` + candado + enganche con `close_month`/`reopen_month` · `owner_account_mappings` con semilla · `accounting_outbox` + `process_accounting_outbox` (pg_cron) · posteo de cobros (14 caminos vía trigger a la bandeja) y de gastos manuales · reversos (blindaje 2.4) · apertura por dueño (D-CORTE) · `trial_block` vendor/organizer (C6) · auditoría §3.7 | L (4 sem) | F0 · CONC-1 · D-PUC (validado por contador), D-T, D-CORTE, D-MIG, D-BASE, D-POST · DIN-1 cerrado o con riesgo aceptado por escrito | IC1–IC3, IC5, IC6, IC11 verdes en gemelo y en rollback sobre la viva · K5–K8 verdes · R2–R7, R11, R12 verdes · un mes de prueba cerrado en la escuela demo sin poder escribirle |
| **F2 · Egresos, proveedores y CxP** | `feature/contab-v2-f2` | `obligations` + `cash_movements` + `obligation_settlements` · `record_expense` y `record_supplier_bill` transaccionales con adjunto · IVA/retenciones · pago parcial y multi-factura · anular cruce · comprobante obligatorio (D-COMP) · fee de pasarela como egreso (C10) · pestaña Por pagar con antigüedad · `pay_supplier_bill` y `expenses` viejos quedan como lectura | M–L (2–3 sem) | F1 en producción | IC4 (CxP), IC7 verdes · K1, K2, K9 verdes · E-01..E-09 y E-16 del plan de salida pasan sobre el modelo nuevo · Playwright `gasto` y `proveedores` verdes |
| **F3 · Nómina CO** | `feature/contab-v2-f3` | §4 completo: FSP escalonado, exoneración por empleador, salario integral, tope IBC, retefuente (D-RETE), redondeo (D-PILA), provisiones como pasivo y su pago, `approve_payroll_run`/`pay_payroll_run` (D-NOM), validación y aviso anual | M (2 sem) | F2 · D-NOM, D-RETE, D-PILA · casos dorados firmados por el contador | Los 5 casos dorados + 3 extra al peso en SQL y vitest · IC4 (nómina) · K3, K4 · Playwright `nomina` |
| **F4 · Cartera, conciliación y FE** | `feature/contab-v2-f4` | Pestaña Por cobrar (lee `payments`) con antigüedad · conciliación bancaria contra el mayor (1110/1380) · liquidaciones de pasarela · nota crédito obligatoria al anular un pago facturado · reporte facturado vs cobrado | M (2 sem) | F1 · DIN-8 estable para el emisor | IC8, IC9 verdes · T-06/T-07/T-08 (manual sandbox) firmados · un extracto real de prueba conciliado en la escuela demo |
| **F5 · Reportes, export y UX** | `feature/contab-v2-f5` | Dashboard, EdR y flujo de caja por mes/concepto/sede, presupuesto vs ejecutado (ingresos y egresos), `<MoneyState>`, paginación keyset, móvil, multi-dueño en UI (`useAccountingOwner`, menús vendor/organizer), export CSV/XLSX con BOM, libro diario, Siigo y Alegra (D-EXP), menú ERP-6 + UX-4, quick wins ERP-1 | L (3 sem) | F1–F4 · A4 (blindaje F3) con "sin categoría" < 5 % en las 3 escuelas · plantillas Siigo/Alegra validadas | Todos los specs Playwright de §8.8 verdes · vitest §8.7 verdes · el contador importa un mes de la escuela demo en Siigo (o su sandbox) sin editar el archivo |
| **F6 · Comercio, reservas y delegaciones** | `feature/contab-v2-f6` | Consumo de los eventos de §6 · reservas y delegaciones · IC10 | S–M (1 sem) | Tienda v2 emitiendo eventos · D-E, D-F, D-H | IC10 verde · K10 · una venta `via_platform` y una `direct` de punta a punta en el gemelo con asientos en el dueño correcto |
| **Piloto** | — | Activar con la escuela demo y **una** escuela real con addon (Monster's o la que acepte), con su contador | 2–4 sem de acompañamiento | F5 | Un mes cerrado y exportado por la escuela real, cero correcciones por SQL |

**Total estimado:** ~15–17 semanas de construcción + piloto. Coincide con el orden de ROADMAP §3.3 (ERP-2 → ERP-3 → ERP-4 → ERP-5), con F0 adelante porque sin una sola fórmula y sin ambiente aislado no hay forma de probar nada de lo demás.

### 9.1 Plan de migraciones (borrador por fase — se detalla y aprueba al abrir cada fase)

| Fase | Migración (slug) | Contenido |
|---|---|---|
| F0 | `finanzas_permiso_y_rol_contador` | `school_members.role` + `accountant` (nuevo CHECK), `finance_permission()`, `can_manage_finances` como envoltorio |
| F0 | `finanzas_formula_unica_ingreso` | `finance_income_lines/summary`; `cash_ledger` y `school_payment_kpis` redefinidos sobre ellas |
| F0 | `finanzas_libro_paginado` | RPC keyset sobre el libro actual |
| F0 | `egresos_sin_borrado_y_auditoria` | `REVOKE DELETE`, `CHECK amount_paid <= amount`, triggers de auditoría, `payroll_runs` sin escritura directa de `status` |
| F0 | `factura_electronica_guard_pago` | Guard de emisión y de des-pago |
| F1 | `mayor_plan_de_cuentas` | `chart_of_accounts` + semilla + `owner_account_overrides` |
| F1 | `mayor_asientos_y_periodos` | `journal_entries/lines`, cuadre diferido, inmutabilidad, `accounting_periods`, candado |
| F1 | `mayor_mapeos_y_bandeja` | `owner_account_mappings`, `accounting_outbox`, `process_accounting_outbox`, job pg_cron |
| F1 | `mayor_posteo_cobros_y_gastos` | Trigger de `payments` a la bandeja, `record_expense`, `reverse_entry`, `post_opening_balances`, `post_manual_entry` |
| F1 | `cierre_mes_bloquea_periodo` | `close_month`/`reopen_month` llaman a `close_period`/`reopen_period` |
| F2 | `cxp_obligaciones_movimientos_cruces` | `obligations`, `cash_movements`, `obligation_settlements`, `pay_obligations`, impuestos, adjuntos |
| F3 | `nomina_v2_parametros_y_causacion` | `fsp_brackets`, integral, retefuente, `approve/pay_payroll_run` |
| F4 | `conciliacion_contra_mayor` | Match extracto ↔ `journal_lines` |
| F6 | `comercio_eventos_contables` | Mapeos `commerce_*`, IC10 |

Todas: `SET search_path = pg_catalog, public, pg_temp`, `REVOKE` explícito de `anon`/`authenticated`/`PUBLIC` + `GRANT EXECUTE` puntual, estados con `text + CHECK`, FKs de negocio a `profiles`, ninguna edita una anterior.

---

## 10. Riesgos

| Riesgo | Mitigación |
|---|---|
| **Una sola Supabase para dev/stg/prod**: cualquier prueba con `COMMIT` toca dinero real | Gemelo local + guarda anti-prod (§8.1); en la viva solo `BEGIN … ROLLBACK` y SELECT |
| **Deriva de esquema** (~336 objetos sin versionar): el gemelo reconstruido desde `migrations/` no sería la realidad | Gemelo desde **volcado de esquema** de la viva, regenerado cada noche |
| **Trigger en `payments`** (la tabla más caliente, 14 escritores) | Solo inserta en la bandeja (barato, sin fallar); el posteo es asíncrono; IC5 detecta atrasos; kill switch `accounting_posting_enabled` por dueño |
| **DIN-1 sin cerrar** (`open_month` puede duplicar) | D-BASE caja: el mayor solo ve lo **cobrado**, no lo emitido; un cobro duplicado sin pagar no contamina el libro |
| **Nadie usa contabilidad hoy** → no hay retroalimentación real | Piloto obligatorio con una escuela real y su contador antes de anunciar |
| **Validación profesional**: PUC, retenciones y nómina son materia de contador | D-PUC, casos dorados y plantillas Siigo/Alegra **firmados por contador** como criterio de "listo"; SportMaps produce libros de gestión y exportables, no libros oficiales certificados |
| **Parámetros 2026 inciertos** (suspensión y reactivación del decreto) | C3 abierta hasta el contador; corrección por `UPDATE` en `/admin/payroll-config`, sin migración |
| **Interfaz con tienda v2** depende de D-E/D-F sin resolver | Contrato de §6 fijo; F6 no arranca sin esas dos |
| **Supabase Free cerca del límite** (160/500 MB) | El mayor agrega ~2–4 líneas por cobro (miles de filas, no millones): medir en F1; la bandeja se purga a los 90 días |
| **Cupo de despliegues de Vercel** | Agrupar pushes por fase |
| **Plantillas Siigo/Alegra cambian** | Adaptadores en archivos separados y prueba con archivo real en F5 |
| **Rendimiento de RLS** (helpers sin `(SELECT fn())`) | Las tablas nuevas usan `(select finance_permission(...))` en las policies de lectura desde el inicio |

---

## 11. Qué hay que actualizar en otros documentos cuando se apruebe

- `ROADMAP.md`: ERP-2..6 apuntan a este spec; §1 y MOD-11 según la auditoría (§5 de ella); IDs A*/C* enlazados.
- `month-close-module.md` §12 D7: "el snapshot es un reporte congelado sobre el mayor; el cierre bloquea el período".
- `pendientes-cxc-cxp-nomina.md` §7: anotar los deltas de §3.2.
- `blindaje-dinero-pagos-tienda-nomina.md` §2–§3: enlazar la tabla §1.3 de este spec.
