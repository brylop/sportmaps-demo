# Cobros y pagos (un solo modal: generar cobros, registrar pagos y aplicar descuentos) — spec + plan por fases

> Estado: **APROBADO** por el usuario el 2026-10-10 (rev. 3) — todas las preguntas quedaron como decisiones con la respuesta propuesta. Plan de ejecución en §12. · Autor: Brayan Steven Lopez (con Claude)
> Sin código ni migraciones: plan antes de código.
> **Rev. 2 (2026-10-10).** (a) **Una sola pantalla**: no hay modal «Generar cobros» aparte; el modal del personal
> «Registrar pago» (`RegisterCashPaymentModal.tsx`) se convierte en **«Cobros y pagos»** (§10). (b) **Descuentos en el
> mismo modal**, al crear y **al pagar**: por línea, general sobre la selección, condonación del recargo de mora y
> exoneración («No cobrar») — §6.5, §7.5 y §15. El acudiente **nunca** se aplica descuentos (solo los automáticos que
> ya existen). (c) Descuentos **acumulables, secuenciales y visibles por separado**: cada uno (militar, hermanos, «solo este
> mes» del alta, pronto pago, los del modal) es un ajuste con su origen (§6.5, §15.6). (d) **Personas**: nunca un cobro
> «al aire»; atleta sin cuenta se cobra normal; atleta nuevo se crea dentro del modal con registro mínimo y control de
> duplicados (§16). (e) El modal es **general para todas las escuelas** (no es un piloto ni va detrás de un addon).
> **Extiende y reemplaza la F3 («Agregar cobro») de `docs/specs/pagos-unicos-por-plan.md`.** Ese spec sigue mandando
> sobre la lista de pagos únicos por plan (`plan_one_time_fees`), el alta y la exoneración; este manda sobre
> **toda creación manual de cobros** por parte del personal. Donde los dos tocan lo mismo (columnas nuevas de
> `payments`, RPC de cobro suelto), el diseño fusionado está en §6.3 y en §12.
> Base medida en la base viva `luebjarufsiadojhvxgi` el 2026-10-10, solo lectura.

---

## 1. Problema

1. **El personal no tiene cómo crear un cobro pendiente a mano.** Lo único manual es «Registrar pago»
   (`RegisterCashPaymentModal`), que crea el cobro **ya pagado** (efectivo/transferencia recibida). Para cobrar
   «el torneo de $80.000 a todo el Sub-12», «el seguro que se le olvidó a Sofía» o «la mensualidad de noviembre
   adelantada» hoy hay que: crear un plan falso, esperar a `open_month`, o registrar un pago que no ocurrió.
2. **No hay modo masivo.** Torneos, viajes, uniformes y vacacionales se cobran a un equipo o categoría entera.
   Hacerlo atleta por atleta, cobro por cobro, es lento y produce errores (montos distintos, duplicados).
3. **Crear cobros sueltos desde el navegador es frágil.** `RegisterCashPaymentModal` hace `INSERT` directo con
   idempotencia débil (`CASH-${Date.now()}`), y la policy `Payments: insert staff` deja a **cualquier staff,
   incluidos los coaches**, insertar cobros desde el cliente (§2.4).
4. **Cada cobro creado dispara una notificación con push** (`trg_notify_on_payment_created` →
   `notifications` → `trg_push_on_notification` + `trg_enqueue_notification_delivery`). Un lote de 40 atletas ×
   2 cobros = 80 notificaciones push el mismo minuto. Eso choca con la Ley 2300 de 2023 (un contacto de cobranza
   por día) y con el sentido común.
5. **Los descuentos manuales no dejan rastro.** «Registrar pago» sobre un pendiente **sobrescribe `amount`** con lo que
   se escriba en «Monto» (`RegisterCashPaymentModal.tsx:381-384` lo precarga, `:435-446` lo guarda en `amount` y
   `amount_paid`): rebajar $723.000 a $600.000 es un descuento de $123.000 sin motivo, sin quién y sin el monto
   original (y también se puede **subir** el monto). No existe forma de condonar el recargo de mora, ni de hacer «pronto
   pago a mano», «descuento por pagar 3 meses juntos» o «beca de este mes» con auditoría.
6. **Dos pantallas competirían.** Un modal «Generar cobros» al lado de «Registrar pago» obligaría al personal a elegir
   entre «crear deuda» y «registrar plata» cuando el caso real es mixto («hoy pagó la mensualidad vencida y le cobro el
   torneo»). Decisión del usuario: **una sola pantalla**.

## 2. Estado actual (archivo:línea y base viva)

### 2.1 Reglas de negocio vivas (verificadas en `pg_proc` el 2026-10-10)

| Regla | Dónde | Vivo |
|---|---|---|
| Solo la mensualidad extiende la vigencia: `COALESCE(NEW.payment_category,'mensualidad') = 'mensualidad'` | `fn_extend_enrollment_on_payment_paid`, migración `20261010130450` | **Sí** |
| `inscripcion` y `seguro` no pasan a `overdue` ni reciben recargo | `apply_late_fees`, `fn_expire_overdue_payments`, `_mark_overdue_payments_impl`, migración `20261010130733` | **Sí** |
| `emit_enrollment_fees` con exoneración (`20261010124934`) | firma viva = **9 args** | **No aplicada** |
| `plan_one_time_fees`, `payments.created_by/client_request_id/notes/one_time_fee_id` | spec `pagos-unicos-por-plan.md` F1 | **No existen** |
| `payments_payment_category_check` | `NULL \| mensualidad \| inscripcion \| articulos \| torneo \| otro \| seguro \| excedente \| clase_extra \| vacacional \| viaje` | Sí |
| Unicidad de período | `uniq_payment_active_period_per_{child,adult,unreg}` sobre `(atleta, period_year, period_month)` con estados vivos `pending, awaiting_approval, paid, partial, overdue, glosado` y `NOT period_uniqueness_exempt` | Sí |
| Período por defecto | `trg_payments_fill_period` estampa `period_year/month` desde `due_date` si vienen NULL → un cobro único **sin** `period_uniqueness_exempt = true` choca con la mensualidad del mes | Sí |
| Guardia de escritura desde el navegador | `fn_guard_payments_client` (`trg_zz_guard_payments_client`): staff pasa sin restricción; acudiente/atleta solo `pending/awaiting_approval` y lista negra de columnas | Sí |

> **Hueco importante en `20261010130733`.** Excluye de mora **solo** `inscripcion` y `seguro`. Un cobro de
> `torneo`, `articulos`, `viaje`, `vacacional`, `clase_extra`, `excedente` u `otro` **sí** pasa a `overdue`, recibe
> recargo y —por ser `overdue`— lo leen el torniquete (`fn_sync_access_group_on_payment`), el auto-bloqueo
> (`access-auto-block.job.ts`) y el correo de vencido. La decisión del usuario es «los cobros únicos nunca van a
> mora»: hay que **ampliar el filtro a toda categoría distinta de `mensualidad`** antes de abrir este módulo (F0, §12).
> Hoy no hay ningún lote masivo de esas categorías, así que el cambio no altera nada existente.

### 2.2 Ayudantes ya escritos (trabajo en curso, sin commitear) que este spec **reutiliza**

| Ayudante | Archivo | Qué hace | Uso aquí |
|---|---|---|---|
| `categoriaDelCobro`, `esMensualidad`, `esPagoUnico`, `etiquetaDelCobro`, `etiquetaCortaDelCobro`, `periodoDelCobro`, `ETIQUETA_CATEGORIA` | `bff/src/services/tipo-de-cobro.ts:36-139` | Clasificación **inferida** (categoría → concepto → `payment_type`) y nombre humano | Rótulos de la vista previa, de la respuesta y de los avisos |
| `CATEGORIAS_COBRO`, `categoriaDeCobro`, `esCobroUnico`, `etiquetaDeCobro`, `ETIQUETA_COBRO` | `bff/src/services/payment-accounts.ts:20,138,181,202,210` | Clasificación por categoría **explícita** (misma regla que el trigger de vigencia) | Validación zod (enum = `CATEGORIAS_COBRO`), enrutamiento de llaves `only_for` |
| `CHARGE_CATEGORIES`, `isOneTimeCategory` | `frontend/src/lib/payment-accounts.ts:54,127` | Espejo del BFF (ya completo: 10 categorías) | Selector de tipo en el modal |
| `MANUAL_CHARGE_CATEGORY_OPTIONS`, `effectiveManualCategory`, `manualChargeInsertFields`, `manualChargeIsPeriodic`, `canReuseOnPeriodConflict` | `frontend/src/lib/manualPaymentCharge.ts:28-87` | Regla «categoría ≠ mensualidad ⇒ `period_uniqueness_exempt = true` y `offering_plan_id = NULL`» | **La misma regla se mueve a la RPC** (§6.4); el archivo queda para «Registrar pago» y su lista de opciones se amplía a las 10 categorías |

Dos semánticas conviven y hay que nombrarlas: `esCobroUnico` (BFF) / `isOneTimeCategory` (frontend) deciden por
**categoría explícita** (lo correcto para filas nuevas, que siempre la traen); `esPagoUnico` (`tipo-de-cobro.ts`)
**infiere** para filas viejas sin categoría. Todo lo que crea este módulo lleva `payment_category` explícita, así que
las dos coinciden sobre sus filas. Queda pendiente (no bloquea) que `isOneOffCharge` / `ONE_OFF_CHARGE_CATEGORIES`
(`frontend/src/lib/payment-accounts.ts:176-180`, 3 categorías; lo usa `PaymentsAutomationPage.tsx:1062,1084`) pase a
`isOneTimeCategory`.

### 2.3 Tipos de cobro que generan las escuelas hoy y dónde se crean

Censo de todos los caminos que **insertan** en `payments` (ver §2.3.1, armado leyendo el código). Lo que importa
para el modal: qué tipos existen, quién los crea y cómo se deduplican.

#### 2.3.1 Tipos de cobro (lo que el modal debe ofrecer)

| Tipo (modal) | `payment_category` | Quién lo usa hoy | Dónde nace hoy | Dedupe vigente |
|---|---|---|---|---|
| Mensualidad (también la del **plan por horas**: Dreamers 16 planes, Academia Superior 3) | `mensualidad` | todas | `open_month` (`supabase/migrations/20261007095911_ventas_wa_f0_carril_b.sql:210`, cron vía `generate_monthly_charges`, botón `PaymentsAutomationPage.tsx:3073/3095`); `createPendingPayment` (`bff/src/services/enrollmentBilling.ts:189`, desde `routes/enrollments.ts:390,441,671`, `routes/students.ts:864`, `services/planChange.service.ts:351`); `create_enrollment_with_payments` (`20261010124934…:271`, desde `students-create-one.route.ts:488`) | Índice de período + `NOT EXISTS` en `open_month` (excluye las 8 categorías únicas) |
| Inscripción | `inscripcion` | Dreamers | `emit_enrollment_fees` (`20261010124934…:106`) en el alta | ninguno (cada alta) |
| Seguro | `seguro` | Dreamers | `emit_enrollment_fees` (`…:135`) | 365 días por categoría |
| Excedente de banco de horas | `excedente` | Dreamers | sugerencia diaria `generate_hour_bank_overage_suggestions` (`20261005214302…:207`, job `jobs/hour-bank-overage.job.ts:19`) → el owner confirma en `POST /api/v1/access/hour-bank-overage-charges/:id/confirm` (`routes/access-api.ts:1224`, **solo `owner`**) → `confirm_hour_bank_overage` (`20261005214302…:410`); UI `components/access/HourBankOverageCharges.tsx:225` | `UNIQUE(period_id)` + `status='suggested'` bajo `FOR UPDATE` |
| Clases fuera de plan | `excedente` (concepto «Clases …») | — | `POST /attendance/facturar-fuera-de-plan` (`routes/attendance.ts:1923`, insert `:1987`, **sin `parent_id`**) | `uniq_payment_out_of_plan_classes` (`20261005214302…:463-473`) |
| Torneo interno | **NULL** | — | `register_for_internal_tournament` (`20260903103757…:153`, desde `routes/events.route.ts:1049`) | inscripción al evento |
| Torneo / clase extra / vacacional / viaje del catálogo | `item.kind` | Campestre (prueba) | `wa_crear_cobro_suelto` (`20261007095911…:597`, desde `services/ventas-servicios.service.ts:209`); checkout del acudiente `PaymentCheckoutModal.tsx:461,718,883` | llave en `wa_cobros_sueltos`, cupos del ítem |
| Artículos / uniforme | `articulos` | Campestre (prueba) | checkout del acudiente (`PaymentCheckoutModal.tsx:392-407`) | ninguno |
| Clase de prueba | **NULL** con `offering_plan_id` | varias | `trial_class_self_create` (`20260829121405…:284`), `trial_class_public_create` (`20260902190708…:256`) | conflicto de período |
| Pago ya recibido sin cobro previo | la que elija el personal | todas | «Registrar pago» → «Nuevo cobro (sin asociar)» (`RegisterCashPaymentModal.tsx:455`, opción `:845`), nace `paid` | `canReuseOnPeriodConflict` |
| Otros (legado, sin categoría) | NULL | varias | `POST /students/bulk` (`students.ts:440`), `athletes/bulkUpload.ts:222`, `createStudentWithPendingPayment` (`hooks/useSchoolContext.ts:899`), `ParentCheckoutPage.tsx:438`, `recurring-charges.service.ts:155` | ninguno |

No existe hoy ningún punto de entrada «Generar cobros» por atleta ni por grupo; tampoco `_resolve_payment_payer`
(el pagador se resuelve en línea en `enrollmentBilling.ts:170-187`, `emit_enrollment_fees` y `confirm_hour_bank_overage`).

#### 2.3.2 Hallazgos del censo (fuera del alcance, se registran)

- **H1** `register_for_internal_tournament` y las dos RPC de clase de prueba crean filas con categoría **NULL**. Por la
  lista blanca de `20261010130450`, NULL = mensualidad: una clase de prueba **con `offering_plan_id`** daría vigencia al
  pagarse, y el torneo interno con período estampado puede hacer que `open_month` crea que el mes ya está cobrado.
  Propuesta: rama aparte que estampe `clase_extra` / `torneo` (medir antes cuántas filas así hay abiertas).
- **H2** `facturar-fuera-de-plan`, `/students/bulk`, `bulk-upload` y `createStudentWithPendingPayment` no ponen
  `parent_id` (dependen de `trg_backfill_payment_payer_on_link` y de `adopt_orphan_payments_on_child_link`).
- **H3** `trg_payments_fill_period` existe en la base pero **ninguna migración del repo lo crea** (deriva). Toda fila de
  este módulo estampa período explícito para no depender de él.
- **H4** `excedente` lo confirma hoy solo el `owner` (`access-api.ts:1224`); en el modal se respeta esa regla para las
  líneas de excedente (admin/school_admin no las ven) salvo que P-Q6 se decida distinto.
- **H5 (seguridad, dinero)** `fn_guard_payments_client` deja que el **acudiente** escriba
  `early_payment_discount_applied` cuando pasa su cobro a `awaiting_approval` (rama final del `CASE`: solo lo bloquea si
  `NEW.status <> 'awaiting_approval'`). El valor lo calcula el **navegador** (`PaymentCheckoutModal.tsx:711,737,877,899`,
  `lib/earlyPaymentDiscount.ts`) y `auto_approve_payment` lo **resta** al aprobar (`v_paid := v_amount - v_discount`).
  Un acudiente con la consola abierta puede declararse cualquier «pronto pago». Hoy hay **0** filas con ese campo ≠ 0
  (3 escuelas con pronto pago activo). Propuesta (rama de seguridad aparte, no bloquea): la guardia exige
  `NEW.early_payment_discount_applied <= round(amount × early_payment_discount_percentage/100)` y que la fecha esté en la
  ventana (`created_at + early_payment_discount_days`), o se calcula en el servidor y se ignora lo que mande el cliente.
  Regla de este spec (D13): **el acudiente no se aplica descuentos**; los automáticos los calcula el sistema.
- **H7 (cobros «al aire»)** Hay **219** filas de `payments` sin ningún atleta (`child_id`, `user_id` y
  `unregistered_athlete_id` NULL), 209 creadas en los últimos 90 días: 202 `cancelled` y **17 vivas** (10 `paid`, 3
  `overdue`, 1 `partial`…; todas con categoría NULL y casi todas con `parent_id`, en 8 escuelas; ejemplos «Mensualidad
  07/2026 - …», «Cuota social Agosto 2026 — …»). D17 lo prohíbe para todo lo que cree este módulo; para el resto, F1 agrega
  un trigger `BEFORE INSERT` (no un `CHECK`, que rompería los `UPDATE` de esas 17) que rechaza un `INSERT` sin atleta, con
  radio medido antes (qué caminos los crean: rama aparte si alguno es legítimo). Las 17 vivas se revisan con cada escuela;
  no se tocan desde aquí (memoria: el usuario maneja las eliminaciones).
- **H6** «Registrar pago» sobre un pendiente sobrescribe `amount` (problema 5). Este spec lo cierra: el monto del cobro
  solo baja con un **ajuste auditado** (§6.5); lo que se recibe va a `amount_paid`.

### 2.4 Permisos vivos sobre `payments` (`pg_policies`, 2026-10-10)

| Policy | Cmd | Expresión | Observación |
|---|---|---|---|
| `Payments: insert staff` | INSERT | `school_id = ANY (staff_school_ids())` | `staff_school_ids()` = miembros activos con rol **≠ parent, athlete, accountant** → **incluye `coach`** (37 activos) y `reporter`. Hoy un coach puede crear cobros desde el navegador. |
| `Payments: insert parent` / `insert athlete` | INSERT | `parent_id = auth.uid()` / `user_id = auth.uid()` | Acotadas por `fn_guard_payments_client` (solo `pending/awaiting_approval`, escuela propia). |
| `Payments: update admin` | UPDATE | `user_school_ids()` + `school_members.role IN (owner, admin, school_admin, super_admin)` | Sin `WITH CHECK` explícito (es UPDATE, usa el `USING`). |
| `Payments: update parent` / `update athlete` | UPDATE | por `parent_id` / hijos / `user_id` | La guardia bloquea columnas sensibles; **no conoce las columnas nuevas** de este spec (§7.2). |
| `Payments: select staff` / `finance reader` / `parent` / `athlete` | SELECT | | `finance_read_school_ids()` incluye `accountant`. |
| `trial_block_*` | ALL cmds | `school_is_operational(school_id)` | Escuela en prueba vencida no escribe. La RPC debe exigirlo también. |

Funciones de alcance: `user_admin_school_ids()` = owner/admin/school_admin/super_admin + dueño de `schools`;
`can_manage_finances(owner_type, owner_id)` / `finance_permission(…, action)` existen (módulo contable) y exigen el
addon `accounting` para escribir en el libro.

### 2.5 Notificaciones que dispara un cobro nuevo

| Disparador | Qué hace | Efecto en un lote |
|---|---|---|
| `trg_notify_on_payment_created` → `fn_notify_on_payment_created` | `INSERT notifications` «💳 Nuevo cobro pendiente … $X … Vence el …» por **cada fila**, salvo `provider_reference` puesto. Menor sin acudiente vinculado → nada. | N filas = N notificaciones; cada una dispara `trg_push_on_notification` (push) y `trg_enqueue_notification_delivery` (cola de entrega). **484** de estas en los últimos 30 días. |
| `jobs/payment-lifecycle-emails.job.ts` («cobro creado») | Solo `payment_type = 'subscription'` (comentario `:85-95`: los cobros únicos no avisan por correo a propósito, Ley 2300) | Un cobro único del lote no manda correo; una **mensualidad** creada a mano con `payment_type='subscription'` sí. |
| `services/recordatorios-cobro.service.ts` (cadencia) | Recordatorios de mensualidad | Respeta «1 contacto/día» con `charge_notice_sent_at`. |
| `services/estado-de-cuenta.service.ts` (mensual) | Incluye pagos únicos abiertos; `elegirCanal` `:206-215`: un canal, nunca los dos | Es el lugar natural donde la familia se entera del lote. |

### 2.6 Radio (base viva, 2026-10-10)

| Medida | Valor |
|---|---|
| Escuelas en total / con inscripciones activas | 371 / **32** |
| Inscripciones activas / atletas distintos | 1.403 / **1.363** |
| Atletas activos por escuela (p50 / p90 / máx.) | 10 / 100 / **499** (Dynasty) |
| Equipos / equipos con atletas activos | 156 / 117 |
| Atletas activos por equipo (p50 / p90 / máx.) | 5 / 20 / **104** |
| Atletas activos en un mismo plan (máx.) | **248** |
| Categorías (`school_categories`) / escuelas que usan `enrollment_categories` / máx. por categoría | 30 / 2 / 18 |
| Cobros últimos 180 días por categoría | NULL 4.053 (29 escuelas) · `mensualidad` 1.349 (13) · `inscripcion` 3 · `seguro` 3 (Dreamers) · `torneo` 2 · `articulos` 1 (Campestre) · `otro` 1 (Dynasty) |
| Lotes manuales de cobros únicos hoy | **0** (no existe la función). Ráfagas de ≥ 3 cobros no-mensualidad en el mismo minuto: 4, todas de Dynasty el 2026-07-29 («Plan PLAN PRO/ELITE», 3 c/u) |
| Cobros creados por escuela por minuto (p50 / p90 / máx.) | 1 / 11 / 487 (`open_month`) |
| Cobros abiertos de **menores sin pagador** (`child_id` puesto, `parent_id` NULL) | **411**: Dynasty 316 (188 vencidos), Solo Millos 48, Porras 36, Athletic Soacha 6, Dreamers 5 |
| Planes por horas activos (`included_minutes_per_period`) | Dreamers 16, Academia Superior Bogotá 3 |
| Excedentes de banco de horas (`hour_bank_overage_charges`) | 1 fila, `suggested`, $419.188, sin cobro (Dreamers) |
| Ítems de torneo (`school_tournament_items`) | 4 |
| Miembros activos por rol | owner 66 · admin 5 · school_admin 2 · coach 37 · reporter 2 · parent 872 · athlete 48 |
| `payments` en total | 5.496 |

Lectura: el lote típico es **un equipo (≤ 20)**; el peor caso realista es «todo un plan» (248) o «toda la escuela»
(499, Dynasty). Con 2–3 líneas por atleta, un lote de escuela completa son ~1.500 filas: demasiado para una
transacción interactiva con triggers por fila. De ahí el tope de §9.3.

### 2.7 Descuentos y recargos vivos (base viva, 2026-10-10)

| Mecanismo | Dónde vive | Cómo afecta `amount` | Uso real |
|---|---|---|---|
| **Hermanos** | `school_settings.sibling_discount_enabled/percentage`; `open_month` (`20260916101241`) | Lo **descuenta al crear** la mensualidad: `amount = round(base × (1 − pct))`, deja el monto en `payments.sibling_discount_applied`. No aplica si `enrollments.fee_is_manual`. | 2 escuelas activas, **1** fila con valor |
| **Pronto pago** | `school_settings.early_payment_discount_enabled/days/percentage`; cálculo en el navegador (`lib/earlyPaymentDiscount.ts`), congelado en `payments.early_payment_discount_applied` | **No toca `amount`**: se resta al aprobar (`auto_approve_payment`: `amount_paid = amount − early_payment_discount_applied`). Ventana = `created_at + N días`; exige no tener cobros anteriores sin pagar. | 3 escuelas activas, **0** filas con valor. Ver H5. |
| **Fuerza Militar 10 %** | `school_settings.military_discount_enabled` (`20260903170318`, solo Besser); botón en `SchoolStudentsManagementPage.tsx:119-120` (`MILITARY_DISCOUNT_REASON = 'Descuento Fuerza Militar 10%'`, `RATE = 0.10`) y `:2094-2111` | Rebaja la **tarifa de la inscripción**: `monthly_fee = round(precio × 0,9)` y `enrollments.fee_reason = 'Descuento Fuerza Militar 10%'` (texto libre, único marcador). Permanente: todos los meses siguientes ya nacen rebajados. No queda rastro en el cobro. | 1 escuela; **0** inscripciones con ese `fee_reason` hoy |
| **«Aplicar descuento solo este mes»** (alta) | `CreateChildModal.tsx:212`, `CreateAdultAthleteModal.tsx:216` → `discount_pct` del BFF (`students-create-one.route.ts:91,1260`) → `create_enrollment_with_payments` escribe `payments.discount_pct` + `payments.list_amount` | `amount` = ya descontado; `list_amount` = el de lista; `discount_pct` con `CHECK (NULL OR 0 < x ≤ 100)` | **3** filas (5 %, 12 %, 30 %), todas con `list_amount ≠ amount` |
| **`enrollments.discount_type`** | columna (y vista `school_athletes`, `20260916102444`) | ninguno | 1.928 inscripciones, **todas NULL** |
| **Recargo de mora** | `school_settings.late_fee_enabled/percentage`; `apply_late_fees` | **Suma a `amount`** una vez (`late_fee_applied_at`): `fee = round(pct × max(amount − amount_paid, 0))`, `amount += fee`, `late_fee_amount += fee`. `CHECK (late_fee_amount >= 0)`. | 4 escuelas activas; **211** filas con recargo, **67** abiertas |
| **Abonos** | `payments.status = 'partial'` + `amount_paid`; `payment_installments` (abonos con comprobante del acudiente) | `amount` intacto; `amount_paid` acumula | 2 filas `partial`, 4 con `0 < amount_paid < amount`; 1 fila en `payment_installments` |
| **Ingreso contable** | `finance_income_amount(status, amount, amount_paid)` en `cash_ledger` | `paid` → `LEAST(amount, COALESCE(amount_paid, amount))`; `partial` → `LEAST(amount, amount_paid)` | — |

Restricciones relevantes: `payments_amount_positive` = `CHECK (amount > 0)` (un cobro **no puede quedar en $0**);
`payments_status_check` sin estado «exonerado»; `payments_payment_method_check` = `pse | card | transfer | cash | other`.
No existe tabla de ajustes/descuentos por cobro (las únicas con «discount» son de tienda, eventos y factura electrónica).
`audit_logs (school_id, profile_id, table_name, record_id, action, old_data, new_data)` existe y es genérica.

Lectura: el sistema ya tiene **cuatro** descuentos automáticos o de configuración y **ninguno** manual por cobro. Las dos
columnas que mejor sirven de base son `list_amount` (monto antes de descuentos, ya usada por el alta) y `amount` como
**saldo bruto a cobrar** (lo que leen checkout, Wompi, cartera, bot y contabilidad): si el descuento baja `amount`, **todos
los lectores quedan correctos sin tocarlos**.

---

## 3. Decisiones ya tomadas (no se reabren)

| # | Decisión | Fuente |
|---|---|---|
| D1 | Solo la mensualidad extiende la vigencia; todo lo demás es cobro único. | `20261010130450` (vivo) |
| D2 | Los cobros únicos no van a mora ni reciben recargo ni bloquean el acceso. | `20261010130733` (vivo, **parcial**: §2.1) · P17/P18 de pagos-únicos |
| D3 | `payment_category` **explícita** en toda fila creada; nunca NULL. | `manualPaymentCharge.ts`, memoria «payment_type no fiable» |
| D4 | Monto sugerido de la mensualidad: `enrollments.monthly_fee` → `offering_plans.price` → `teams.price_monthly`. | `docs/gotchas-tecnicos.md` §«El monto que paga un atleta» |
| D5 | Pagador: menor → `children.parent_id`; adulto con cuenta → `user_id`; adulto sin cuenta → NULL. Menor sin acudiente → `parent_id` NULL, **impagable en línea** hasta vincular (`trg_backfill_payment_payer_on_link` lo completa). | memoria «Quién paga: cuatro caminos», «Cobros de menores sin pagador» |
| D6 | Creación multi-fila = **una RPC transaccional `SECURITY DEFINER`**; nunca N inserts desde el cliente. | CLAUDE.md |
| D7 | Un cobro nuevo nunca nace vencido (`due_date ≥ hoy` Bogotá). | `enrollmentFeeDueDate`, pagos-únicos §5.4 |
| D8 | Ley 2300: máximo un contacto de cobranza por día por familia y dentro del horario. | `estado-de-cuenta.service.ts:16-30`, `payment-lifecycle-emails.job.ts:37,92` |
| D9 | La escuela decide montos; el sistema sugiere y advierte, no impone. | memoria «La escuela decide precios» |
| D10 | Inscripción ≠ mensualidad: nunca fusionar en una sola fila. | memoria «Inscripción única, luego mensualidad» |
| D11 | **Una sola pantalla «Cobros y pagos»** para el personal: es el modal «Registrar pago» transformado. Genera cobros (uno o varios atletas), registra pagos de pendientes y de líneas nuevas, y aplica descuentos. No existe modal «Generar cobros» aparte. | usuario, 2026-10-10 |
| D12 | **Descuentos en el mismo modal**, al crear y al pagar: por línea (% o valor, con motivo), general sobre la selección, condonación del recargo de mora y exoneración. Auditados (monto original, descuento, motivo, quién, cuándo). | usuario, 2026-10-10 |
| D13 | **El acudiente/atleta nunca se aplica descuentos.** Solo recibe los automáticos que ya existen (hermanos, pronto pago, «solo este mes» del alta, militar), calculados por el sistema. | usuario, 2026-10-10 |
| D14 | Un descuento **nunca** deja el cobro en negativo ni por debajo de lo ya pagado, y nunca toca el período, el plan ni la vigencia de una mensualidad. | usuario, 2026-10-10 |
| D15 | El modal «Cobros y pagos» es **general para todas las escuelas** (sin flag ni addon). | usuario, 2026-10-10 |
| D16 | Descuentos **acumulables** y **secuenciales**: cada uno se aplica sobre el saldo que dejó el anterior (no se suman porcentajes). Cada uno se ve por separado («Militar −10 %», «Hermanos −10 %», «Solo este mes −12 %», «Pronto pago −10 %», «Convenio −$20.000») y queda como ajuste propio con origen, monto, motivo, quién y cuándo. Si el descuento total de un cobro supera el **50 %** del valor de lista: **aviso, no bloqueo**. Solo owner/admin aplican descuentos. | usuario, 2026-10-10 |
| D17 | **Nunca un cobro sin atleta.** Atleta con ficha y sin acudiente vinculado → se cobra y se registra el pago normal (el `parent_id` lo completa el trigger al vincular). Persona sin ficha (incluye visitante / clase suelta) → «+ Atleta nuevo» dentro del modal con registro mínimo, creado en la **misma transacción** que los cobros y el pago, con búsqueda de duplicados antes de crear. | usuario, 2026-10-10 |

## 4. Requisitos (del usuario)

- **R1 Tipos**: mensualidad (elegir mes/período; monto sugerido por D4), plan de horas / excedente de banco de horas,
  inscripción, seguro, torneo, clase extra, uniforme/artículos, viaje, vacacional, otro, y las filas de la lista de
  pagos únicos del plan del atleta (`plan_one_time_fees`, cuando exista).
- **R2 Destino**: un atleta (desde su ficha o buscándolo) o varios (por equipo / categoría / plan, o lista a mano).
  Vista previa **obligatoria** «Se van a crear N cobros por $X» antes de confirmar.
- **R3 Líneas**: cada una con tipo, monto, vencimiento, nota; total visible.
- **R4 Atómico**: todo o nada en una RPC; idempotente contra doble clic (`client_request_id`); detección de duplicados
  por línea (mensualidad del período ya existe → avisar/omitir; seguro en 12 meses; excedente ya facturado);
  auditoría (`created_by`, id del lote); anular un lote completo.
- **R5 Integraciones** probadas: §11.
- **R6 Permisos**: owner/school_admin sí, coach no; RLS + BFF; tope de filas por lote; rate limit.
- **R7 Notificaciones**: no inundar a las familias.
- **R8 Una pantalla** (D11): elegir un atleta (desde su ficha o Pagos) o varios (a mano o por equipo/categoría/plan);
  sección «Cobros pendientes» con casillas para registrar su pago; sección «+ Nuevo cobro» con N líneas (tipo, valor,
  vence, nota); bloque opcional «Ya lo pagaron» (método, comprobante) que registra el pago de los pendientes marcados
  **y** de las líneas nuevas en la misma confirmación. Modo varios **solo genera** (no registra pagos) y exige vista previa
  «Se van a crear N cobros por $X». El botón principal cambia: «Generar N», «Registrar pago» o «Generar N · Pagar M».
- **R9 Descuentos** (D12): por línea (% o valor fijo, motivo obligatorio) y general sobre la selección; aplicables a
  líneas nuevas y a pendientes que se van a pagar; en modo varios, el mismo descuento a todas las líneas. Condonar el
  recargo de mora como ajuste **distinto** del descuento. «No cobrar» (exoneración). Persistir original, descuento,
  motivo y quién (auditoría).
- **R10 Al pagar** (aclaración del usuario): sobre pendientes, vencidos con recargo y parciales, el personal puede en el
  mismo momento aplicar pronto pago a mano, descuento por pagar varios meses juntos, condonar el recargo, y decidir si lo
  recibido **cierra** el cobro (la diferencia es descuento, con motivo) o queda como **abono parcial**.
- **R11 Personas** (D17): atleta con ficha (con o sin acudiente), atleta adulto con o sin cuenta, y persona nueva creada en
  el modal (nombre obligatorio; documento opcional; teléfono del acudiente) con detección de duplicados por nombre,
  documento y teléfono.
- **R12 Alcance**: todas las escuelas (D15).

---

## 5. Decisiones tomadas (antes «preguntas abiertas»; aprobadas por el usuario el 2026-10-10)

Cada fila era una pregunta con propuesta; el usuario aprobó **todas las propuestas**. Son decisiones: no se reabren
sin una conversación nueva.

| # | Tema | Decisión (aprobada 2026-10-10) |
|---|---|---|
| Q1 | ¿Quién puede generar cobros? | **owner, admin, school_admin** (= `user_admin_school_ids()`), más `super_admin` de plataforma. **No**: coach, reporter, accountant, parent, athlete. Abrirlo a un rol «finanzas» operativo se decide cuando exista ese rol en `school_members` (hoy `can_manage_finances` exige el addon contable y mira otra cosa). |
| Q2 | ¿Una mensualidad creada a mano debe extender vigencia al pagarse? | **Sí**: es una mensualidad real. Lleva `payment_category='mensualidad'`, `offering_plan_id` de la inscripción elegida y `period_year/month` explícitos; el trigger de vigencia la trata como cualquier otra. |
| Q3 | Mensualidad del período que ya existe (pendiente o pagada) | **Omitir la línea** siempre (el índice único la rechazaría igual). En modo un atleta se muestra «ya existe: Mensualidad oct 2026 · $X · pendiente» con enlace. Nunca «reemplazar» desde aquí. |
| Q4 | Mensualidad de un mes **futuro** (adelantada) | Permitida hasta **3 meses** adelante. `open_month` la verá y no duplicará (su dedupe mira los mismos estados). Mes pasado: permitido solo si no existe, con advertencia «este mes ya pasó» y vencimiento ≥ hoy (D7). |
| Q5 | Seguro dentro de 12 meses | Modo un atleta: **advertir y pedir confirmación** por línea. Modo varios: **omitir por defecto** a quien ya tenga seguro vivo en 365 días, con casilla «cobrar igual» en la vista previa. Misma regla que `emit_enrollment_fees` (por **categoría**, que es la de hoy). |
| Q6 | Excedente de banco de horas | Solo el **owner** (regla vigente de `access-api.ts:1224`; H4) y solo desde un período con `hour_bank_overage_charges.status = 'suggested'` (se elige el período, el monto viene de la fila y es editable). La RPC lo pasa a `confirmed` con `payment_id` en la misma transacción. Ya `confirmed`/`dismissed` o con `payment_id` → **omitir: ya facturado**. No hay excedente «libre». |
| Q7 | «Plan de horas» | Es la **mensualidad** del plan por horas (Dreamers): mismo tratamiento que Q2/Q3. No es categoría nueva. |
| Q8 | Torneo con ítem de catálogo (`school_tournament_items`) | v1: el modal permite elegir un ítem para **prellenar** nombre y monto; el cobro no consume cupo del ítem (eso lo hace la venta por WhatsApp). Ligar cupos → fase futura. |
| Q9 | ¿Se avisa a las familias al crear el lote? | **No por defecto.** El lote suprime la notificación por fila (§8.3) y crea **una** notificación in-app **sin push** por familia y lote. Casilla opcional «Avisar a las familias por correo/WhatsApp»: encola **un** aviso agrupado por familia, sujeto al horario de cobranza y al «ya se le contactó hoy» (se envía el siguiente día hábil si hoy ya hubo contacto). Plantilla de WhatsApp neutra nueva → requiere aprobación de Meta (F5). |
| Q10 | Tope por lote | **200 atletas y 600 filas** por lote (cubre un plan completo de 248 en dos lotes, un equipo de 104 con 5 líneas). Más que eso → «divide por equipo o plan». Revisar tras F3 con tiempos medidos. |
| Q11 | Rate limit | Por usuario: **10 lotes / 10 min** y **2.000 filas / hora** por escuela. 429 con mensaje claro. |
| Q12 | Anular un lote con cobros ya pagados o con comprobante | **Anular solo lo anulable** (`pending`, `overdue`, `rejected`, `failed`) y listar lo que no se tocó (`paid`, `partial`, `awaiting_approval`, `glosado`, facturado). Requiere confirmación con el conteo exacto; motivo obligatorio. Nunca toca pagos con dinero recibido. |
| Q13 | ¿Ventana para anular? | Sin ventana de tiempo; la regla de Q12 basta. La anulación de **una** fila suelta usa el flujo existente de anular cobro. |
| Q14 | ¿La nota la ve el acudiente? | **No** (como P7 de pagos-únicos): nota interna. El acudiente ve el **concepto**, que el modal arma («Torneo Copa Pony — Sub-12») y el personal puede editar. |
| Q15 | Menores sin acudiente (411 cobros abiertos hoy) | Se crean igual (D5) y la vista previa los marca «sin acudiente vinculado: no podrá pagar en línea» con conteo. Opción «omitir sin acudiente». Default: **crear** (la deuda existe; la escuela cobra en efectivo). |
| Q16 | Inscripción/atleta inactivo, en pausa o con prueba | Varios: solo atletas con inscripción **activa** en la escuela (pausados excluidos por defecto con casilla «incluir pausados»). Un atleta: permitido para cualquiera con ficha en la escuela, con advertencia si no tiene inscripción activa. |
| Q17 | Descuentos (hermanos, pronto pago) sobre una mensualidad creada a mano | **Rev. 2:** el monto sugerido de una mensualidad a mano es D4 **más** el de hermanos si la escuela lo tiene activo (misma regla que `open_month`, mostrado como sugerencia «−10 % hermanos» que el personal puede quitar; D9). El pronto pago se sigue calculando al pagar sobre `amount` (ya neto). Los descuentos manuales van por §15. |
| Q18 | Atleta con dos inscripciones (multi-categoría) y línea de mensualidad | Se pide elegir la inscripción (plan) en modo un atleta; en modo varios se toma la **primaria** (`enrollment_categories.is_primary`) o la de mayor monto, y la vista previa lo muestra. El índice de período es por **atleta**, no por plan: la segunda mensualidad del mismo mes chocaría → se omite con motivo «ya tiene mensualidad de ese mes (otro plan)». |
| Q19 | ¿Coach puede **ver** los lotes? | No. Lectura de `charge_batches` = admin + `accountant` (`finance_read_school_ids()`). |
| Q20 | Cerrar `Payments: insert staff` para coaches | Sí, pero en **rama propia de seguridad** con radio medido (cuántos INSERT de coaches en 90 días) antes; no bloquea este módulo porque el modal no usa esa policy. |
| Q21 | Al pasar «Registrar pago» al BFF/RPC, ¿quién puede **registrar pagos** (sin generar cobros ni descontar)? | Igual que hoy (`canRegisterPayments`, `SchoolStudentsManagementPage.tsx:262`: administración, coach no) pero con gate real en el BFF: owner/admin/school_admin. Generar cobros y descontar: mismo grupo (Q1, §15.2). Si más adelante se separa un rol «caja» (solo registra plata), el modal oculta «+ Nuevo cobro» y descuentos con el mismo componente. |
| Q22 | ¿Se pueden marcar pendientes con comprobante en revisión (`awaiting_approval`)? | **No** desde este modal: aparecen deshabilitados con «tiene comprobante en revisión → apruébalo o recházalo». Registrar plata por dos lados es el origen de los pagos dobles. |
| Q23 | ¿El modal de un atleta registra pagos de líneas **nuevas** y **pendientes** a la vez con un solo comprobante? | Sí (es el caso mixto de D11). Un solo comprobante/referencia se estampa en cada cobro pagado; el hash y la referencia OCR del comprobante (`uq_payments_school_receipt_hash` sobre `receipt_image_sha256`, `uq_payments_school_ocr_reference` sobre `ocr_reference`, ambos únicos por escuela) se guardan solo en **una** fila (la de mayor monto) y las demás llevan `receipt_url` sin hash ni referencia, para no chocar con los índices y conservar la detección de comprobante repetido. Ver §7.3 paso 9b. |

---

## 6. Modelo de datos

### 6.1 Tabla `public.charge_batches`

Rev. 2: un registro por **confirmación del modal «Cobros y pagos»** (operación), no solo por lote de cobros nuevos. Una
operación puede crear 0..N cobros, registrar el pago de 0..M pendientes y aplicar ajustes; con 0 cobros nuevos
(`rows_created = 0`) sigue siendo el ancla de idempotencia y de auditoría del pago.

| Columna | Tipo | Regla |
|---|---|---|
| `id` | `uuid` PK `default gen_random_uuid()` | |
| `school_id` | `uuid NOT NULL` FK → `schools(id)` `ON DELETE CASCADE` | RLS sin JOIN. |
| `client_request_id` | `uuid NOT NULL` | Idempotencia del lote. `UNIQUE (school_id, client_request_id)`. |
| `mode` | `text NOT NULL` | `CHECK (mode IN ('single','multi'))` |
| `target` | `jsonb NOT NULL` | Cómo se eligieron los atletas: `{"kind":"athlete"\|"team"\|"category"\|"plan"\|"list", "ids":[…]}`. Solo trazabilidad. |
| `lines` | `jsonb NOT NULL` | Las líneas pedidas (tipo, monto, vencimiento, concepto, nota, período, `fee_id`, `overage_charge_id`). Snapshot para auditoría. |
| `status` | `text NOT NULL DEFAULT 'created'` | `CHECK (status IN ('created','partially_annulled','annulled'))` |
| `rows_created` / `rows_skipped` | `integer NOT NULL` | `CHECK (rows_created >= 0 AND rows_skipped >= 0)` |
| `total_amount` | `numeric(14,2) NOT NULL` | Suma de lo creado. `CHECK (total_amount >= 0)` |
| `skipped` | `jsonb NOT NULL DEFAULT '[]'` | `[{athlete, line_idx, reason}]` — lo que la vista previa omitió y por qué. |
| `notify_families` | `boolean NOT NULL DEFAULT false` | Q9 |
| `payments_registered` | `integer NOT NULL DEFAULT 0` | Cobros (pendientes + nuevos) cuyo pago se registró en la operación. `CHECK (>= 0)`. Siempre 0 en `mode='multi'`. |
| `paid_total` | `numeric(14,2) NOT NULL DEFAULT 0` | Plata recibida en la operación (suma de lo que subió `amount_paid`). `CHECK (>= 0)` |
| `discount_total` / `late_fee_waived_total` | `numeric(14,2) NOT NULL DEFAULT 0` | Suma de ajustes de la operación (§6.5). `CHECK (>= 0)` |
| `payment` | `jsonb NULL` | `{method, payment_date, reference, receipt_url}` cuando hubo «Ya lo pagaron»; NULL si solo generó. `CHECK (mode = 'single' OR payment IS NULL)` (D11: modo varios no registra pagos). |
| `created_by` | `uuid NOT NULL` FK → `profiles(id)` | |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `annulled_by` | `uuid NULL` FK → `profiles(id)` | |
| `annulled_at` | `timestamptz NULL` | |
| `annul_reason` | `text NULL` | `CHECK (annul_reason IS NULL OR length(btrim(annul_reason)) BETWEEN 3 AND 300)` |

Índices: `uq_charge_batches_request (school_id, client_request_id)`, `ix_charge_batches_school_created (school_id, created_at DESC)`.
Sin `UPDATE` desde el cliente: solo las RPCs cambian `status/annulled_*`.

### 6.2 Columnas nuevas de `payments`

| Columna | Tipo | Origen |
|---|---|---|
| `charge_batch_id` | `uuid NULL` FK → `charge_batches(id)` `ON DELETE RESTRICT` | **Este spec.** NULL = cobro que no salió de un lote. |
| `created_by` | `uuid NULL` FK → `profiles(id)` | pagos-únicos §4.2 (se crea **una vez**, en la F1 que llegue primero). |
| `notes` | `text NULL` `CHECK (notes IS NULL OR length(notes) <= 500)` | pagos-únicos §4.2. |
| `one_time_fee_id` | `uuid NULL` FK → `plan_one_time_fees(id)` `ON DELETE SET NULL` | pagos-únicos §4.2 (solo cuando exista la tabla). |
| `discount_amount` | `numeric(12,2) NOT NULL DEFAULT 0` `CHECK (discount_amount >= 0)` | **Rev. 2, §6.5.** Suma vigente de **todos** los descuentos que bajan `amount` (militar, hermanos, «solo este mes», los del modal). El pronto pago **no** entra (no baja `amount`, se resta al pagar). Caché de `payment_adjustments`. |
| `late_fee_waived_amount` | `numeric(12,2) NOT NULL DEFAULT 0` `CHECK (late_fee_waived_amount >= 0)` | **Rev. 2, §6.5.** Recargo condonado. Caché de `payment_adjustments`. |
| `list_amount` | **ya existe** (`numeric`, NULL) | Rev. 2 la generaliza: «**valor de lista** antes de cualquier descuento». La estampa el trigger de descuentos automáticos al crear el cobro (§6.5) o, en un cobro viejo sin ella, la RPC la primera vez que lo ajusta (`list_amount := amount − late_fee_amount + descuentos automáticos conocidos de la fila`). |

Índice: `ix_payments_charge_batch (charge_batch_id) WHERE charge_batch_id IS NOT NULL`.

### 6.3 Diseño fusionado con `pagos-unicos-por-plan.md` (qué cambia en aquel spec)

1. **`payments.client_request_id` NO se crea.** La idempotencia vive en `charge_batches.client_request_id`. «Agregar
   cobro» de pagos-únicos (§5.4 `create_one_time_charge`, §6.1 `POST …/charges`, §7.3) **se reemplaza** por el modal
   de este spec en modo un atleta: un cobro suelto = un lote de 1 atleta y 1 línea. Se borra de aquel spec el índice
   `uq_payments_client_request` y la RPC `create_one_time_charge`.
2. `created_by`, `notes`, `one_time_fee_id` se crean **una sola vez**. Quien llegue primero (F1 de cualquiera de los
   dos specs) las agrega con `ADD COLUMN IF NOT EXISTS`; el otro verifica en `information_schema` y no las repite.
3. La función interna de pagador `_resolve_payment_payer(...)` que pagos-únicos propone extraer de
   `emit_enrollment_fees` es **la misma** que usa `create_charge_batch`. Se escribe una vez (F1 de este spec si llega
   antes).
4. `preview_enrollment_fees` (pagos-únicos §5.2) da las sugerencias «del plan» del modal; la regla del seguro de 12
   meses se escribe en **un** lugar (`_charge_duplicate_reason`, §7.1) y la usan las dos.
5. El predicado SQL `es_pago_unico(...)` de pagos-únicos §4.4 ya está, en la práctica, cubierto por la lista blanca de
   `20261010130450`; para mora (§2.1) F0 de este spec usa la misma lista blanca: `COALESCE(payment_category,'mensualidad') = 'mensualidad'`.

### 6.4 Cómo se ve cada fila creada por un lote

| Campo | Mensualidad | Cobro único (cualquier otra categoría) |
|---|---|---|
| `payment_category` | `'mensualidad'` | la elegida (nunca NULL, nunca `otro` si hay una mejor; `otro` permitido) |
| `payment_type` | `'subscription'` | `'one_time'` |
| `period_year/month` | los del mes elegido | derivados de `due_date` (explícitos; el trigger no decide) |
| `period_uniqueness_exempt` | `false` (el índice protege) | `true` |
| `offering_plan_id` | el de la inscripción elegida | **NULL** (misma regla que `manualChargeInsertFields`: sin plan, nunca extiende vigencia) |
| `team_id`, `branch_id` | de la inscripción | de la inscripción principal, si la hay (para cartera por sede) |
| `child_id / user_id / unregistered_athlete_id` | trío del atleta | igual |
| `parent_id` | `_resolve_payment_payer` (D5) | igual |
| `status` | `'pending'` | `'pending'` |
| `due_date` | ≥ hoy Bogotá | ≥ hoy Bogotá |
| `concept` | `'Mensualidad <mes> <año> — <plan> — <atleta>'` (mismo formato que `open_month`, para que el verificador de comprobantes y el bot lo lean) | `'<Nombre de la línea> — <atleta>'` |
| `amount` | > 0, ≤ 20.000.000 | > 0, ≤ 20.000.000 |
| `created_by` / `notes` / `charge_batch_id` | puestos | puestos |
| `one_time_fee_id` | NULL | el de la fila del plan si la línea vino de la lista |
| `provider_reference` | NULL | NULL |
| `list_amount` / `discount_amount` | `list_amount` = valor antes de descuentos si la línea trae descuento; si no, NULL y 0 | igual |
| `status` si la línea va con «Ya lo pagaron» | `paid` (o `partial` si es abono, §15.5) con `amount_paid`, `payment_method`, `approved_by = p_actor`, `approved_at`, `payment_date` | igual |

### 6.5 Descuentos y ajustes: modelo (rev. 2)

**Elección: columnas caché en `payments` + tabla de eventos `payment_adjustments` (solo inserción).**

| Alternativa | Por qué no / por qué sí |
|---|---|
| Solo columnas en `payments` (`discount_amount`, `discount_reason`, `discount_by`) | Pierde la historia: un cobro puede recibir un descuento al crearse y otro al pagarse, más una condonación; con columnas solo queda el último «quién y por qué». |
| Solo `audit_logs` | Ya existe y `trg_audit_payments` registra cambios, pero es `jsonb` genérico: no se puede sumar «descuentos de octubre por motivo», ni tiene RLS propia, ni FK. Se sigue escribiendo **además** (resumen por operación). |
| Solo tabla, sin caché | Todos los lectores (checkout, Wompi, cartera, bot, contabilidad, informe) tendrían que hacer JOIN y restar. Hoy leen `amount`: si el descuento baja `amount`, **siguen correctos sin cambios**. |
| **Tabla + caché (elegida)** | `amount` sigue siendo «lo que se debe en total»; la tabla guarda cada evento con quién/cuándo/por qué/antes/después; las dos columnas caché permiten mostrar el desglose sin JOIN. La RPC escribe ambas en la misma transacción. |

**Invariante por fila** (vale desde que `list_amount` no es NULL):

```
amount = list_amount − discount_amount + late_fee_amount
saldo  = amount − COALESCE(amount_paid, 0) − COALESCE(early_payment_discount_applied, 0)   -- lo que falta pagar
```

- `late_fee_amount` queda **neto** (lo condonado se resta de ahí y se acumula en `late_fee_waived_amount`), así las
  pantallas que hoy muestran «Recargo» (`MyPaymentsPage.tsx:242`) muestran el valor real sin cambios.
- `apply_late_fees` suma a `amount` y a `late_fee_amount` a la vez → preserva el invariante. `late_fee_applied_at` **no**
  se borra al condonar: así el job no vuelve a cobrar el recargo.
- Se impone con `CHECK (list_amount IS NULL OR amount = list_amount − discount_amount + late_fee_amount)`,
  creado `NOT VALID` y validado **después** del backfill de las 3 filas del alta (abajo). Antes de crearlo, F1 lista con
  `grep` + `pg_proc.prosrc` todo escritor que haga `UPDATE … amount` (cambio de plan, glosas, `open_month` no) y verifica
  que ninguno toque filas con `list_amount` puesta; si alguno lo hace, se adapta en la misma fase.

**Tabla `public.payment_adjustments`** (append-only):

| Columna | Tipo | Regla |
|---|---|---|
| `id` | `uuid` PK | |
| `school_id` | `uuid NOT NULL` FK → `schools(id)` | RLS sin JOIN. Trigger de coherencia: `= (SELECT school_id FROM payments WHERE id = NEW.payment_id)`. |
| `payment_id` | `uuid NOT NULL` FK → `payments(id)` `ON DELETE CASCADE` | El borrado total de usuario (memoria) borra sus cobros; el resumen sobrevive en `audit_logs`. |
| `charge_batch_id` | `uuid NULL` FK → `charge_batches(id)` | Operación del modal. NULL solo en `context IN ('alta','backfill')`. |
| `kind` | `text NOT NULL` | `CHECK (kind IN ('descuento','condonacion_recargo','exoneracion','reversion'))` |
| `origin` | `text NOT NULL` | **D16.** De dónde salió: `CHECK (origin IN ('militar','hermanos','alta_solo_este_mes','pronto_pago','modal'))`. Los cuatro primeros los escribe el sistema (trigger, abajo); `modal` = decisión del personal en «Cobros y pagos». |
| `applies_to` | `text NOT NULL DEFAULT 'monto'` | `CHECK (applies_to IN ('monto','pago'))`: `monto` = bajó `amount` (entra en `discount_amount`); `pago` = se restó al pagar sin tocar `amount` (solo `pronto_pago`, que vive en `early_payment_discount_applied`). |
| `sequence` | `smallint NOT NULL` | Orden de aplicación dentro del cobro (1, 2, 3…): es lo que hace **secuencial** la acumulación y lo que pinta las etiquetas en orden. |
| `basis` | `text NULL` | `CHECK (basis IN ('porcentaje','valor'))`; NULL en `reversion`. |
| `pct` | `numeric(5,2) NULL` | `CHECK (pct IS NULL OR (pct > 0 AND pct <= 100))`; puesto si `basis='porcentaje'`. |
| `amount` | `numeric(12,2) NOT NULL` | **Efecto en pesos**, siempre `> 0`. Redondeo a peso entero (COP). |
| `scope` | `text NOT NULL DEFAULT 'linea'` | `CHECK (scope IN ('linea','general'))`: `general` = parte prorrateada de un descuento global (§15.3). |
| `context` | `text NOT NULL` | `CHECK (context IN ('al_crear','al_pagar','sobre_pendiente','alta','backfill'))` |
| `reason_code` | `text NOT NULL` | `CHECK (reason_code IN ('pronto_pago','varios_meses','hermanos','beca','convenio','cortesia','ajuste_de_precio','error_de_cobro','condonacion_mora','descuento_alta','otro'))` |
| `reason_text` | `text NULL` | `CHECK (reason_text IS NULL OR length(btrim(reason_text)) BETWEEN 3 AND 300)`; **obligatorio** si `reason_code='otro'` o `kind='exoneracion'` (`CHECK`). |
| `amount_before` / `amount_after` | `numeric(12,2) NOT NULL` | `payments.amount` antes y después del evento. |
| `amount_paid_at` | `numeric(12,2) NOT NULL DEFAULT 0` | `amount_paid` en ese momento (prueba de D14). |
| `reverts_id` | `uuid NULL` FK → `payment_adjustments(id)` | Solo `kind='reversion'`; `UNIQUE (reverts_id)` (un ajuste se revierte una vez). |
| `created_by` | `uuid NULL` FK → `profiles(id)` | `CHECK (created_by IS NOT NULL OR origin <> 'modal')`: NULL = el sistema (trigger, `open_month`, `auto_approve_payment`). Un ajuste del modal siempre tiene persona. Para militar y «solo este mes», el trigger pone quien creó el cobro si se conoce (`payments.created_by`). |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

Índices: `ix_padj_payment (payment_id)`, `ix_padj_school_created (school_id, created_at DESC)`,
`ix_padj_batch (charge_batch_id) WHERE charge_batch_id IS NOT NULL`. Sin UPDATE ni DELETE (ni por policy ni por GRANT):
corregir = insertar `reversion`.

**Exoneración («No cobrar»)** — `CHECK (amount > 0)` impide un cobro de $0, y la respuesta depende del tipo:

| Caso | Qué hace | Por qué |
|---|---|---|
| Línea **nueva** de cobro único marcada «No cobrar» | **No se crea** la fila. Queda en `charge_batches.skipped` con `reason='exonerado'`. | No hay deuda que registrar; crear y anular en el mismo acto solo ensucia. |
| Cobro único **pendiente** | **Anular**: `status='cancelled'`, `rejection_reason='Exonerado: <motivo>'` + fila `payment_adjustments(kind='exoneracion', amount = saldo)`. Solo si `amount_paid = 0` (si ya abonó, se ofrece «cerrar con descuento», §15.5). | `cancelled` ya lo excluyen cartera, bot, checkout, mora y contabilidad. Un cobro único no ocupa período ni da vigencia: no hay nada más que preservar. |
| **Mensualidad** (nueva o pendiente) — «beca del mes» | Fila `status='paid'`, `amount = 0`, `amount_paid = 0`, `discount_amount = list_amount`, `late_fee_amount = 0` (recargo condonado), `payment_method='other'`, `payment_channel='exoneracion'`, `approved_by = p_actor` + ajuste `exoneracion`. Requiere relajar el CHECK a `amount > 0 OR (amount = 0 AND status = 'paid' AND discount_amount > 0)`. | Anularla rompería dos cosas: `open_month` **la volvería a emitir** (no cuenta `cancelled`) y el atleta perdería la vigencia del mes. `paid` ocupa el período (el índice protege) y extiende la vigencia como cualquier mensualidad pagada; `finance_income_amount` da 0 de ingreso. Lectores a ajustar: factura electrónica (no facturar `amount_paid = 0`), rótulo «Exonerado» en vez de «Pagado $0» (I29–I31). |

Alternativa descartada para la mensualidad: nuevo estado `waived` en `payments_status_check` — obligaría a revisar los
13 caminos que crean cobros y todo lector que filtra por estado (memoria «13 caminos»); el `paid` de $0 no cambia ninguna
regla existente.

**Descuentos automáticos: también quedan como ajuste (D16), sin reescribir sus RPCs.** Un trigger
`trg_payments_descuentos_automaticos` (`BEFORE INSERT` estampa columnas; `AFTER INSERT` / `AFTER UPDATE OF
early_payment_discount_applied, status` inserta los ajustes; `SECURITY DEFINER`, `search_path` fijo) registra cada
descuento que ya existe, con su origen y en orden:

| Origen | Cómo lo detecta el trigger | Monto del ajuste | `applies_to` |
|---|---|---|---|
| `militar` | Mensualidad cuya inscripción (mismo atleta + `offering_plan_id`, activa) tiene marca militar. Hoy la marca es `fee_reason = 'Descuento Fuerza Militar 10%'`; F1 agrega `enrollments.fee_discount_origin text NULL CHECK (fee_discount_origin IN ('militar'))` + `fee_discount_pct numeric(5,2)` que el botón (`SchoolStudentsManagementPage.tsx:2102-2111`) escribe junto al texto, con backfill desde `fee_reason` (0 filas hoy) — Q-D15 | `precio de lista − monthly_fee` (lista = `offering_plans.price` o `teams.price_monthly`, D4) | `monto` |
| `hermanos` | `NEW.sibling_discount_applied > 0` (`open_month`) | ese valor | `monto` |
| `alta_solo_este_mes` | `NEW.discount_pct IS NOT NULL AND NEW.list_amount IS NOT NULL` (`create_enrollment_with_payments`) | `list_amount − amount` (menos militar/hermanos si los hubo) | `monto` |
| `pronto_pago` | `early_payment_discount_applied` pasa de NULL/0 a > 0, o el cobro pasa a `paid` con ese valor (`auto_approve_payment`, aprobación manual) | ese valor | `pago` |

`BEFORE INSERT` deja `list_amount` = valor de lista (antes del militar) y `discount_amount` = suma de los `monto`, de
modo que el invariante vale desde el nacimiento. Ventaja: `open_month`, `create_enrollment_with_payments` y
`auto_approve_payment` **no se tocan** (son RPCs vivas con deriva frente al repo; memoria «Deriva de esquema»).
Riesgo: costo por fila en `open_month` (hasta 487 filas/minuto, §2.6) → F1 mide un `open_month` de Campestre con y sin
trigger (rollback); si pesa, el trigger solo actúa cuando alguna de las columnas de descuento viene puesta (la mayoría de
filas no tiene ninguna y sale en la primera comparación).

**Backfill (F1, datos, con dry-run):** las 3 filas con `discount_pct` del alta y la 1 con `sibling_discount_applied` →
sus ajustes (`context='backfill'`, `created_by` NULL) y `list_amount`/`discount_amount` coherentes; luego se valida el
`CHECK` del invariante. Pronto pago: 0 filas, nada que migrar.

**Secuencial, no suma de porcentajes (D16).** Cada porcentaje se calcula sobre el saldo que dejó el anterior
(`base = list_amount − discount_amount` en ese momento): lista $100.000, militar 10 % → $90.000, hermanos 10 % →
$81.000, modal 10 % → $72.900 (no $70.000). El orden es el de §15.6 y queda en `sequence`.

**Aviso del 50 % (D16).** `preview_charge_batch` y `GET …/open-charges` devuelven `warnings: ['descuento_total_mayor_50']`
cuando `(discount_amount + COALESCE(early_payment_discount_applied,0)) / list_amount > 0,5` (la condonación no cuenta: es recargo, no precio) después de lo pedido. Es
aviso amarillo en la línea; **no** bloquea ni pide permiso extra.

---

## 7. RPCs

Todas (`preview_charge_batch`, `create_charge_batch`, `annul_charge_batch`, `revert_payment_adjustment` y las internas `_…`): `LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp`,
`REVOKE ALL … FROM PUBLIC, anon, authenticated; GRANT EXECUTE … TO service_role;`. Se llaman **solo desde el BFF**,
que valida el rol (gotchas: con service role `auth.uid()` es NULL; la RPC recibe `p_actor` y **re-valida** que
`p_actor` sea admin de `p_school_id` consultando `school_members`/`schools.owner_id` directamente, no con
`user_admin_school_ids()` que depende de `auth.uid()`).

### 7.1 `_charge_duplicate_reason(p_school_id, p_athlete jsonb, p_line jsonb) RETURNS text` (interna, STABLE)

NULL si la línea se puede crear; si no, el motivo:

| Motivo | Regla |
|---|---|
| `mensualidad_ya_existe` | Existe fila del atleta con mismo `period_year/month`, estado en (`pending, awaiting_approval, paid, partial, overdue, glosado`) y `NOT period_uniqueness_exempt` (mismo predicado que el índice). |
| `seguro_en_12_meses` | Línea `seguro` y existe cobro `seguro` del atleta en la escuela, `status <> 'cancelled'`, `due_date > hoy - 365`. (= `emit_enrollment_fees` vivo). |
| `excedente_ya_facturado` | `hour_bank_overage_charges` del `overage_charge_id` con `status <> 'suggested'` o `payment_id IS NOT NULL`. |
| `misma_linea_hoy` | Mismo atleta + misma categoría + mismo monto + mismo concepto creado en las últimas 24 h y no cancelado (doble lote por error con otro `client_request_id`). Advertencia, **omitible** con «cobrar igual». |
| `fee_unica_vez` | Línea con `one_time_fee_id` de frecuencia `una_sola_vez_por_atleta` ya cobrada (cuando exista pagos-únicos F1). |
| `sin_inscripcion_para_mensualidad` | Línea mensualidad y el atleta no tiene inscripción con plan en la escuela. |

### 7.2 `preview_charge_batch(p_school_id uuid, p_actor uuid, p_athletes jsonb, p_lines jsonb, p_pending jsonb DEFAULT '[]', p_global_discount jsonb DEFAULT NULL, p_payment jsonb DEFAULT NULL) RETURNS jsonb` (STABLE)

Rev. 2: además de las líneas nuevas recibe `p_pending` (cobros existentes marcados, cada uno con `pay_amount`, ajustes
por línea y `close_mode: 'cerrar'|'abono'`), el descuento global y el bloque de pago. La vista previa calcula **el mismo**
resultado que el `create` (función interna compartida `_plan_charge_operation`, para que no diverjan) y devuelve por
línea: `amount_before`, ajustes en pesos (con el prorrateo del global ya hecho), `amount_after`, `pay_amount`,
`resulting_status` (`pending | paid | partial | cancelled`), las **etiquetas** de descuento en orden (§15.6),
`warnings` (`descuento_total_mayor_50`, `sin_acudiente`) y errores de §15.4. Con `p_new_athlete` devuelve además
`duplicates: [...]` de `_find_athlete_duplicates` (§16) para que el personal decida antes de confirmar. Totales: `to_create {n, total}`,
`to_pay {n, total}`, `discounts {total, by_reason}`, `late_fee_waived`, `exonerated`. `p_pending` y `p_payment` con más de
un atleta → error `MULTI_NO_PAGA`.

- Valida actor (admin de la escuela), `school_is_operational`, topes (Q10), atletas ∈ escuela (inscripción o ficha en
  la escuela; `children.school_id`, `enrollments`, `unregistered_athletes.school_id`).
- Resuelve por atleta: nombre, pagador (`_resolve_payment_payer`), inscripción/plan elegido, **monto sugerido de
  mensualidad** (D4), y por línea `will_create` + `skip_reason` (§7.1) + `warnings` (`sin_acudiente`, `mes_pasado`,
  `sin_inscripcion_activa`, `pausado`).
- Devuelve `{ rows_to_create, total_amount, by_category: {torneo: {n, total}}, skipped: [...], athletes: [...],
  warnings_count: {sin_acudiente: n}, preview_hash }`. `preview_hash` = hash de (atletas, líneas, decisiones): el BFF
  lo exige en el `create` para garantizar que lo confirmado es lo mostrado.
- No escribe nada. Se puede llamar las veces que haga falta.

### 7.3 `create_charge_batch(p_school_id uuid, p_actor uuid, p_client_request_id uuid, p_mode text, p_target jsonb, p_athletes jsonb, p_lines jsonb, p_overrides jsonb, p_notify boolean, p_preview_hash text, p_pending jsonb DEFAULT '[]', p_global_discount jsonb DEFAULT NULL, p_payment jsonb DEFAULT NULL) RETURNS jsonb`

Rev. 2: es la **única** RPC de escritura del modal «Cobros y pagos»: crea cobros, aplica ajustes y registra pagos en
**una** transacción (D6). Se conserva el nombre para no reescribir §9 y §13; los parámetros nuevos tienen default, así
que un lote «solo generar» es la misma llamada de antes. Los pasos 9a–9d son nuevos.

Orden exacto dentro de la transacción:

1. **Idempotencia primero**: `SELECT … FROM charge_batches WHERE school_id = p_school_id AND client_request_id = p_client_request_id`.
   Si existe → devolver `{batch_id, duplicated: true, rows_created, total_amount}` sin hacer nada más.
2. `pg_advisory_xact_lock(hashtextextended('charge_batch:' || p_school_id || ':' || p_client_request_id, 0))` y repetir
   el paso 1 (dos clics simultáneos: el segundo espera y encuentra el lote).
3. Validar actor, `school_is_operational`, topes, categorías ∈ CHECK, montos (0 < x ≤ 20.000.000), `due_date ≥ hoy`
   Bogotá, mensualidad con mes en [hoy − 12 meses, hoy + 3 meses].
3b. **Atleta nuevo** (rev. 2, `p_new_athlete`, solo `mode='single'`, §16): repetir `_find_athlete_duplicates`; si hay
   coincidencia y no viene `allow_duplicate` → `RAISE ATLETA_DUPLICADO` con la coincidencia (el BFF devuelve 409 y el
   modal ofrece «usar este»). Crear la ficha (menor → `children` con `parent_*_temp`; adulto → `unregistered_athletes`)
   y usar su id como el único atleta de la operación. Con `allow_duplicate`, `set_config('app.permitir_atleta_duplicado',
   'on', true)` (local a la transacción) para que `bloquear_atleta_duplicado` lo deje pasar, y `audit_logs
   action='athlete_duplicate_forced'`. Si después algo falla, la ficha también se revierte (todo o nada).
4. Por cada atleta, **en orden estable por id** (evita deadlocks entre lotes concurrentes):
   `pg_advisory_xact_lock(hashtextextended('enrollment_fees:' || <atleta>, 0))` — **la misma llave** que
   `create_enrollment_with_payments` / `emit_enrollment_fees`, para serializar contra un alta concurrente del mismo atleta.
5. Recalcular `_charge_duplicate_reason` por línea (la vista previa pudo quedar vieja). Aplicar `p_overrides`
   (`{athlete, line_idx, action: 'force'|'skip'}`) solo a motivos omitibles (`seguro_en_12_meses`, `misma_linea_hoy`).
   `mensualidad_ya_existe` y `excedente_ya_facturado` **nunca** se fuerzan.
6. Si el resultado difiere del `p_preview_hash` (otro usuario creó algo entretanto) → `RAISE` con código
   `PREVIEW_STALE` y **no** crear nada: el BFF devuelve 409 y el modal re-pide la vista previa.
7. `INSERT INTO charge_batches (…)` (estado `created`).
8. `PERFORM set_config('app.charge_batch_id', v_batch_id::text, true)` (local a la transacción): suprime
   `fn_notify_on_payment_created` por fila (§8.3).
9. `INSERT INTO payments (…) SELECT …` en **una** sentencia (§6.4). El índice único de período es la última defensa:
   si dispara `23505` (carrera que el paso 5 no vio), toda la transacción revierte (todo o nada) y el BFF devuelve 409.
9a. **Ajustes de las líneas nuevas**: por cada fila insertada con descuento, `_apply_payment_adjustment(...)` (§7.5) con
    `context='al_crear'`. (Equivalente y más simple: insertar ya con `list_amount`, `discount_amount` y `amount`
    neto, y escribir la fila de `payment_adjustments` en la misma sentencia con `INSERT … RETURNING`.) Líneas de
    mensualidad exoneradas nacen como en §6.5 (`paid`, $0).
9b. **Pendientes marcados** (`p_pending`, solo `mode='single'`): `SELECT … FROM payments WHERE id = ANY(...) AND
    school_id = p_school_id AND <atleta del modal> ORDER BY id FOR UPDATE`. Exigir estado ∈ (`pending`, `overdue`,
    `partial`, `rejected`, `failed`) — `awaiting_approval` → `RAISE EN_REVISION` (Q22); `paid/cancelled/glosado` →
    `RAISE COBRO_CAMBIO` (otro usuario o la pasarela lo cerró entretanto; el BFF devuelve 409 y el modal recarga).
    Comparar `amount` y `amount_paid` con los que vio la vista previa (van en `p_pending[i].seen`) → si difieren,
    `PREVIEW_STALE`. Aplicar sus ajustes con `context='al_pagar'` (o `'sobre_pendiente'` si no hay pago).
9c. **Descuento global** (`p_global_discount = {basis, value, reason_code, reason_text, line_refs[]}`): prorrateo de §15.3
    sobre las líneas elegidas (nuevas y pendientes), **después** de los descuentos por línea; cada parte es una fila
    `payment_adjustments(scope='general')`.
9d. **Registro del pago** (`p_payment = {method: 'cash'|'transfer', payment_date, reference?, receipt_url?, receipt_sha256?,
    ocr_reference?, …}`, solo `mode='single'`): para cada línea con `pay_amount > 0`, en orden estable:
    `amount_paid := COALESCE(amount_paid,0) + pay_amount`; si `amount_paid + early_payment_discount_applied >= amount` →
    `status='paid'`, si no → `status='partial'` (abono, §15.5); `payment_method`, `payment_channel`, `payment_date`,
    `approved_by = p_actor`, `approved_at = now()`, `reference`, y los campos de desbloqueo (`requires_review=false`,
    `unblocked_at`, `unblocked_by`) igual que hace hoy el modal (`RegisterCashPaymentModal.tsx:411-415`). Hash/OCR del
    comprobante solo en una fila (Q23). Un abono además inserta `payment_installments(status='approved', reviewed_by =
    p_actor)` para que el historial de abonos sea uno solo. `pay_amount > saldo` → `RAISE SOBREPAGO` (el personal registra
    lo que corresponde; un saldo a favor no se modela aquí).
10. Excedentes: misma lógica que `confirm_hour_bank_overage` (`20261005214302…:410`) — `SELECT … FOR UPDATE` de la fila,
    exige `status='suggested'`, y `UPDATE hour_bank_overage_charges SET status='confirmed', payment_id=…, decided_by=p_actor,
    decided_at=now()`; si no está `suggested` → `RAISE` (todo o nada). Se extrae a `_confirm_overage_into_payment(...)`
    interna que usan las dos RPCs, para no duplicar la regla. La fila nace como allá: `excedente`, exenta, **sin**
    `offering_plan_id`.
11. Notificación agrupada: **una** fila en `notifications` por pagador con cuenta (`type='info'`, título «Nuevos cobros de
    <escuela>», cuerpo «Se generaron N cobros por $X. Vence el …», link `/my-payments`) **con marca para no hacer push**
    (columna/flag que respete `fn_trigger_push_on_notification`; ver §8.3). Si `p_notify` → además encolar el aviso
    externo agrupado (F5).
    Si hubo pago (9d): **una** notificación «Pago registrado» por familia con el total recibido (hoy el modal llama
    `notify_user` por cobro, `RegisterCashPaymentModal.tsx:544`); esa sí puede llevar push (es confirmación de plata, no
    cobranza).
12. `audit_logs (school_id, profile_id=p_actor, table_name='charge_batches', record_id=batch, action='charge_batch_created', new_data={rows, total, by_category, skipped, payments_registered, paid_total, discount_total, late_fee_waived_total})`.
13. Devolver `{batch_id, duplicated:false, rows_created, total_amount, payment_ids, paid_ids, partial_ids, adjustments: [...], skipped}`.

### 7.4 `annul_charge_batch(p_school_id uuid, p_actor uuid, p_batch_id uuid, p_reason text, p_expected_count int) RETURNS jsonb`

1. Validar actor (admin), lote ∈ escuela, `status <> 'annulled'`, motivo 3–300 caracteres.
2. `SELECT … FROM charge_batches WHERE id = p_batch_id FOR UPDATE`; `SELECT … FROM payments WHERE charge_batch_id = p_batch_id FOR UPDATE`.
3. Anulables = `status IN ('pending','overdue','rejected','failed')` **y** sin factura electrónica emitida (la guardia
   `trg_zy_guard_pago_facturado` lo impediría igual). Si `count(anulables) <> p_expected_count` → `RAISE ANNUL_STALE`
   (la UI mostró otro número; se re-pide).
4. `UPDATE payments SET status='cancelled', rejection_reason = 'Lote anulado: ' || p_reason, updated_at=now() WHERE id = ANY(anulables)`.
5. Excedentes ligados: `UPDATE hour_bank_overage_charges SET status='suggested', payment_id=NULL WHERE payment_id = ANY(anulables)`
   (vuelve a poder facturarse).
6. `charge_batches.status` = `annulled` si se anularon todas las filas; `partially_annulled` si quedaron vivas (pagadas…).
   `annulled_by/at/reason`.
7. Una notificación in-app agrupada por familia afectada («La escuela anuló N cobros»), sin push.
8. `audit_logs action='charge_batch_annulled'` con ids anulados y no anulados (y su estado).
9. Devuelve `{annulled: n, kept: [{payment_id, status}]}`.

Mensualidades anuladas: `cancelled` no cuenta en el dedupe de `open_month` (gotchas §pausa) → si se anula una
mensualidad del mes en curso, `open_month` **la volverá a emitir** en su próxima corrida. Es lo correcto si el lote
era un error; la UI lo advierte («las mensualidades anuladas se regenerarán con el ciclo normal»).

Rev. 2: anular un lote no toca filas `paid`, incluidas las mensualidades exoneradas ($0) — para deshacer una beca se usa
`revert_payment_adjustment` (§7.5), que solo procede si nadie más pagó nada. Los ajustes de filas anuladas quedan en
`payment_adjustments` (historia) y no se revierten.

### 7.5 Ajustes: `_apply_payment_adjustment` (interna) y `revert_payment_adjustment`

`_apply_payment_adjustment(p_payment_id, p_actor, p_batch_id, p_kind, p_basis, p_value, p_scope, p_context, p_reason_code, p_reason_text) RETURNS numeric`
— la llaman `create_charge_batch` (9a–9c) y `revert_payment_adjustment`. Exige que el llamador ya tenga la fila con
`FOR UPDATE`. Reglas, en orden (cualquier violación = `RAISE` y la operación entera revierte):

1. **Estado**: solo `pending, overdue, partial, rejected, failed` (o la fila recién insertada en la misma transacción).
   `awaiting_approval` → `EN_REVISION` (hay una plata declarada que se está revisando: descontar ahora cambiaría lo que
   se aprueba). `paid, cancelled, glosado` → `COBRO_CERRADO`.
2. **Pasarela en vuelo**: si la fila tiene un intento de pago en curso (`wompi_transaction_id`/`provider_transaction_id`
   puesto con estado no final, o enlace de pago con monto vigente emitido por `cobro-enlace-publico.service.ts`, cuyo
   monto quedó firmado) → `PAGO_EN_CURSO`. El modal dice «La familia tiene un pago en curso por $X; espera el resultado o
   anula el enlace». F1 mide qué marca usar (columna existente o `payment_links` vigentes) antes de escribirla.
3. **Monto en pesos**: `porcentaje` → `round(base × pct/100)` con `base = list_amount − discount_amount` (el valor
   aún no descontado, **sin** recargo); `valor` → el valor. Debe ser `> 0`.
4. **Topes (D14)**:
   - `descuento`: `amount_nuevo = amount − x` debe cumplir `amount_nuevo ≥ COALESCE(amount_paid,0) + COALESCE(early_payment_discount_applied,0)`
     y `x ≤ list_amount − discount_amount` (nunca se descuenta el recargo con un descuento; para eso está la condonación).
     `amount_nuevo = 0` solo es válido como **exoneración de mensualidad** (§6.5); en cualquier otro caso `> 0`.
   - `condonacion_recargo`: `x ≤ late_fee_amount` y el mismo piso de lo pagado. `late_fee_amount −= x`,
     `late_fee_waived_amount += x`. `late_fee_applied_at` se conserva.
   - `exoneracion`: solo con `amount_paid = 0`. Cobro único → `cancelled` (§6.5); mensualidad → `paid` $0.
5. **Nunca toca** `period_year/month`, `period_uniqueness_exempt`, `offering_plan_id`, `payment_category`, `due_date` ni
   `status` (salvo exoneración y el cierre de 9d). Por eso un descuento en una mensualidad no rompe la unicidad del período
   ni la vigencia (D14): el índice y el trigger de vigencia no leen `amount`.
6. Primera vez: `list_amount := COALESCE(list_amount, amount − late_fee_amount)`.
7. `UPDATE payments SET amount = amount − x, discount_amount = …, updated_at = now()` + `INSERT payment_adjustments`
   con `origin='modal'`, `applies_to='monto'`, `sequence = max(sequence)+1`, `amount_before/after` y `amount_paid_at`.
   Devuelve también si el cobro cruzó el umbral del 50 % (aviso, D16).
8. Si tras el ajuste `amount_paid + early_payment_discount_applied >= amount` y `amount_paid > 0` → el cobro queda
   **saldado** (`status='paid'`): es el caso «descuento al pagar que cierra el cobro» (§15.5).

`revert_payment_adjustment(p_school_id, p_actor, p_adjustment_id, p_reason) RETURNS jsonb` — «Quitar descuento»: solo si
el cobro sigue abierto (o es una mensualidad exonerada sin ningún pago) y no fue revertido antes; inserta
`kind='reversion'` y devuelve `amount` a su valor (`amount += x`, cachés −= x). Revertir una exoneración de mensualidad
devuelve el cobro a `pending` con su monto. No revierte la anulación de un cobro único exonerado (se crea uno nuevo).
Mismo gate de actor y mismo `PAGO_EN_CURSO`.

### 7.6 Pruebas SQL (`supabase/migrations/_smoke/`)

`supabase/migrations/_smoke/charge_batches_smoke.sql` en transacción con `ROLLBACK`: crear lote de 2 atletas × 3 líneas en Club Campestre Demo;
mismo `client_request_id` → `duplicated`; mensualidad duplicada → omitida; seguro < 12 meses → omitido; excedente
`suggested` → `confirmed`; anular → `cancelled` + excedente vuelve a `suggested`; pagar un `torneo` → `expires_at` igual.

`supabase/migrations/_smoke/payment_adjustments_smoke.sql` (rev. 2, misma técnica): descuento 10 % a línea nueva → `list_amount`, `amount` neto,
1 ajuste; descuento a un pendiente con abono de $300.000 que lo bajaría a $250.000 → `RAISE`; condonar recargo de una
mensualidad vencida → `late_fee_amount` baja, `late_fee_waived_amount` sube, `apply_late_fees` posterior **no** vuelve a
cobrar; descuento con recargo puesto que intente tocar el recargo → `RAISE`; exonerar mensualidad → `paid` $0, vigencia
extendida, `open_month` del mismo mes no la reemite; exonerar torneo → `cancelled`; revertir → monto original; descuento
sobre `awaiting_approval` → `EN_REVISION`; pago que cierra con descuento → `paid` y `amount = amount_paid`; abono →
`partial` + `payment_installments`; invariante `amount = list_amount − discount_amount + late_fee_amount` en todas.

---

## 8. RLS, GRANTs y guardias (línea por línea)

### 8.1 `charge_batches`

`ALTER TABLE public.charge_batches ENABLE ROW LEVEL SECURITY;` (sin `FORCE`).

| Policy | Cmd | Roles | Expresión | Por qué |
|---|---|---|---|---|
| `cb_select_finance` | SELECT | `authenticated` | `USING (school_id = ANY ((SELECT public.finance_read_school_ids())::uuid[]))` | Admin + contador leen el historial de lotes. Coach, acudiente, atleta: no (Q19). Envuelta en `(SELECT …)`. |
| — | INSERT / UPDATE / DELETE | — | **sin policy** | Solo las RPCs (`SECURITY DEFINER`, dueño `postgres`) escriben. Sin policy = denegado para `authenticated`. |

GRANTs: `REVOKE ALL ON public.charge_batches FROM PUBLIC, anon, authenticated; GRANT SELECT ON public.charge_batches TO authenticated; GRANT ALL TO service_role;`

Invariantes: I1 no aplica (sin `anon`); I2 no aplica (sin escritura por policy); I3 no hay `FOR ALL`; I4 las 3 RPCs
llevan `search_path`. Sin self-recursion (la policy no lee `charge_batches`).

### 8.1b `payment_adjustments` (rev. 2)

`ENABLE ROW LEVEL SECURITY` (sin `FORCE`).

| Policy | Cmd | Roles | Expresión | Por qué |
|---|---|---|---|---|
| `padj_select_finance` | SELECT | `authenticated` | `USING (school_id = ANY ((SELECT public.finance_read_school_ids())::uuid[]))` | Admin y contador ven quién descontó qué. Coach no. |
| `padj_select_family` | SELECT | `authenticated` | `USING (EXISTS (SELECT 1 FROM public.payments p WHERE p.id = payment_id AND (p.parent_id = (SELECT auth.uid()) OR p.user_id = (SELECT auth.uid()))))` | **Propuesta** (Q-D7): la familia ve que su cobro tuvo un descuento y el motivo (código), no quién lo hizo — servido por una **vista** `v_payment_adjustments_familia` con columnas publicables (trampa #4: RLS filtra filas, no columnas). Si se elige la vista, esta policy no se crea y la vista es `security_invoker` sobre `payments`. Sin self-recursion (lee `payments`, no `payment_adjustments`). |
| — | INSERT / UPDATE / DELETE | — | sin policy | Solo las RPCs. Append-only. |

GRANTs: `REVOKE ALL … FROM PUBLIC, anon, authenticated; GRANT SELECT … TO authenticated; GRANT ALL … TO service_role`.
Invariantes: I1 (sin anon), I2 y I3 no aplican, I4 (search_path en las RPCs).

### 8.2 `payments`

- **Sin policies nuevas.** Las filas nuevas se leen con las policies de siempre (staff, finance reader, acudiente por
  `parent_id`/hijos, atleta por `user_id`).
- **`fn_guard_payments_client`**: agregar `charge_batch_id`, `created_by`, `notes`, `one_time_fee_id` (y
  `payment_category`, `period_uniqueness_exempt` ya están) a la lista negra de **INSERT y UPDATE** para no-staff. Sin
  esto un acudiente con `Payments: update parent` podría reasignar `charge_batch_id` o `created_by` de su cobro.
  `CREATE OR REPLACE` con el cuerpo vivo + las 4 columnas (copiar de `pg_get_functiondef`, no del repo: deriva).
- **Staff desde el navegador** (incluye coach, §2.4) sigue pudiendo insertar por la policy vieja; la guardia debe
  impedir que **staff** escriba `charge_batch_id` (solo RPC): condición `current_user IN ('authenticated','anon') AND NEW.charge_batch_id IS NOT NULL → RAISE`.
  El cierre de `Payments: insert staff` para coaches es Q20 (rama aparte).
- **Rev. 2 — descuentos solo por RPC.** La guardia agrega `discount_amount` y `late_fee_waived_amount` a la lista
  negra de no-staff (INSERT ≠ 0 y UPDATE) y, para **staff desde el navegador**, rechaza cambiar `discount_amount`,
  `late_fee_waived_amount` y `list_amount` (`current_user = 'authenticated'` → `RAISE PAYMENT_FIELD_LOCKED`). Cuando F3
  quite el `UPDATE … amount` de `RegisterCashPaymentModal`, una rama de seguridad mide los demás escritores de `amount`
  desde el cliente (grep `from('payments').update` en `frontend/src`) y cierra `amount` también para staff navegador: un
  descuento sin rastro (H6) deja de ser posible por cualquier vía.
- **D13 (acudiente):** ya no puede tocar `amount`, `discount_pct`, `list_amount`, `late_fee_amount` (guardia viva). El único
  hueco es `early_payment_discount_applied` (H5), que se cierra en su rama.
- Verificar antes de aplicar: `select cmd, policyname, roles, qual, with_check from pg_policies where tablename='payments'` (trampa #1).

### 8.3 Notificaciones

- `fn_notify_on_payment_created`: `CREATE OR REPLACE` agregando al inicio
  `IF current_setting('app.charge_batch_id', true) IS NOT NULL AND current_setting('app.charge_batch_id', true) <> '' THEN RETURN NEW; END IF;`.
  `set_config(..., true)` es local a la transacción de la RPC: no afecta a ningún otro camino.
- Push de la notificación agrupada: hoy `trg_push_on_notification` empuja **toda** notificación. Opción preferida:
  columna `notifications.push boolean NOT NULL DEFAULT true` y el trigger la respeta; la RPC inserta con `push=false`.
  (Alternativa sin columna: `type='batch_info'` filtrado en el trigger — más frágil.) Revisar `enqueue_notification_delivery`
  con el mismo criterio (no debe encolar correo/WhatsApp para estas).

### 8.4 Verificación tras cada migración

`npm run seguridad:invariantes` (0 críticos) · `pg_policies` de `charge_batches` y `payments` · `set local role anon; select count(*) from charge_batches;` → error de permiso · JWT simulado de coach y de acudiente: `select * from charge_batches` → 0 filas; `rpc('create_charge_batch')` → `permission denied`.

---

## 9. BFF

### 9.1 Rutas (nuevo archivo `bff/src/routes/charge-batches.routes.ts`)

| Ruta | Rol | Cuerpo / respuesta |
|---|---|---|
| `POST /api/v1/charge-batches/preview` | `requireRole('owner','admin','school_admin')` + escuela del token (`req.schoolId`) | `ChargeBatchRequestSchema` → `preview_charge_batch` |
| `POST /api/v1/charge-batches` | igual | `ChargeBatchRequestSchema & { client_request_id, preview_hash, overrides?, notify_families? }` → `create_charge_batch`. 200 (`duplicated` true/false), 409 `PREVIEW_STALE` / período duplicado, 422 validación, 429 rate limit |
| `GET /api/v1/charge-batches?cursor=` | owner/admin/school_admin/accountant | Historial: fecha, quién, N, total, estado |
| `GET /api/v1/charge-batches/:id` | igual | Detalle con filas (estado actual de cada cobro) |
| `POST /api/v1/charge-batches/:id/annul` | owner/admin/school_admin | `{ reason, expected_count }` → `annul_charge_batch` |
| `GET /api/v1/charge-batches/targets?kind=team\|category\|plan&id=` | igual que preview | Atletas activos del grupo (resuelve el BFF; el cliente no arma listas grandes) |
| `GET /api/v1/athletes/:athleteType/:athleteId/charge-suggestions` | igual | Plan/inscripciones del atleta, monto sugerido de mensualidad (D4), próximo período sin cobro, filas de `plan_one_time_fees` (cuando exista) y excedentes `suggested` |
| `GET /api/v1/athletes/:athleteType/:athleteId/open-charges` (rev. 2) | igual | Sección «Cobros pendientes» del modal: cobros abiertos del atleta con `amount`, `list_amount`, `discount_amount`, `late_fee_amount`, `amount_paid`, `early_payment_discount_applied`, `sibling_discount_applied`, saldo, estado, `en_revision`, `pago_en_curso`, y **sugerencias** (pronto pago si la escuela lo tiene y el cobro está en ventana; «varios meses» si se marcan ≥ N mensualidades — Q-D3). Reemplaza la lectura directa de `RegisterCashPaymentModal.tsx:252`. |
| `GET /api/v1/charge-batches/athlete-search?q=&doc=&phone=` (rev. 2) | igual que preview | Buscador del modal y detección de duplicados antes de «+ Atleta nuevo»: llama `_find_athlete_duplicates` (§16). Devuelve coincidencias con escuela propia únicamente, nombre, documento enmascarado, acudiente y motivo de la coincidencia. |
| `POST /api/v1/payment-adjustments/:id/revert` (rev. 2) | owner/admin/school_admin | `{ reason }` → `revert_payment_adjustment` |
| `GET /api/v1/payment-adjustments?from&to&reason` (rev. 2) | owner/admin/school_admin/accountant | Informe de descuentos (quién, cuánto, motivo, atleta) para el dueño |

Todas: el atleta/grupo debe ser de `req.schoolId` **antes** de llamar la RPC (la RPC lo re-valida).

**`requireRole` no basta.** `middlewares/authMiddleware.ts:50,207`: `PRIVILEGED_ROLES = ['owner','super_admin','admin']`
pasan **siempre**, y `req.role` es un rol único del usuario, no «rol en esta escuela» (memoria «profiles.role=admin
global»). Las rutas de este módulo llevan además un `assertSchoolFinanceAdmin(req.user.id, req.schoolId)` que consulta
`school_members` (`status='active'`, `role IN ('owner','admin','school_admin')`) o `schools.owner_id`, o
`is_super_admin`. Mismo criterio que pasa la RPC (`p_actor`). Para el GET de historial se acepta además `accountant`
(espejo de `canReadFinances`, `routes/invoicing.routes.ts:101`).

Montaje: bajo `/api/v1/charge-batches` con `paymentLimiter` (`index.ts:154`, 20/min) + el limitador propio de §9.3.

### 9.2 zod

```ts
const Categoria = z.enum(CATEGORIAS_COBRO);              // payment-accounts.ts:20
const Linea = z.object({
  category: Categoria,
  amount: z.number().positive().max(20_000_000).optional(), // ausente en mensualidad = sugerido por atleta
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),       // ≥ hoy Bogotá: refine
  concept: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(500).optional(),
  period: z.object({ year: z.number().int(), month: z.number().int().min(1).max(12) }).optional(), // obligatorio si mensualidad
  enrollment_id: z.string().uuid().optional(),             // modo un atleta, mensualidad
  fee_id: z.string().uuid().optional(),
  overage_charge_id: z.string().uuid().optional(),         // obligatorio si excedente
}).superRefine(/* mensualidad ⇒ period; excedente ⇒ overage_charge_id; mensualidad sin amount ⇒ sugerido */);
const Atleta = z.object({ type: z.enum(['child','adult','unregistered']), id: z.string().uuid() });
export const ChargeBatchRequestSchema = z.object({
  mode: z.enum(['single','multi']),
  target: z.object({ kind: z.enum(['athlete','team','category','plan','list']), ids: z.array(z.string().uuid()).max(50) }),
  athletes: z.array(Atleta).min(1).max(200),
  lines: z.array(Linea).max(10),                           // rev. 2: puede ser 0 si solo se pagan pendientes
  // ── rev. 2 ──
  pending: z.array(PendienteSel).max(24).default([]),      // solo mode='single'
  global_discount: DescuentoGlobal.optional(),
  payment: Pago.optional(),                                // solo mode='single'
  new_athlete: AtletaNuevo.optional(),                     // solo mode='single'; excluye athletes[]
}).refine(b => b.athletes.length * b.lines.length <= 600, 'Máximo 600 cobros por lote')
  .refine(b => b.mode === 'single' || (b.pending.length === 0 && !b.payment), 'En modo varios solo se generan cobros')
  .refine(b => b.lines.length + b.pending.length > 0, 'Nada que hacer');

// rev. 2 — descuentos y pagos
const Motivo = z.enum(['pronto_pago','varios_meses','hermanos','beca','convenio','cortesia','ajuste_de_precio','error_de_cobro','condonacion_mora','otro']);
const Descuento = z.object({
  basis: z.enum(['porcentaje','valor']),
  value: z.number().positive(),                            // porcentaje ≤ 100 (refine); valor ≤ 20.000.000
  reason_code: Motivo,
  reason_text: z.string().trim().min(3).max(300).optional(),// obligatorio si 'otro'
});
// Linea (arriba) gana: discount?: Descuento, exonerate?: { reason_text } (mutuamente excluyentes)
const AtletaNuevo = z.object({                            // rev. 2, §16 — en lugar de athletes[0]
  kind: z.enum(['menor','adulto']),
  full_name: z.string().trim().min(3).max(120),
  doc_type: z.string().max(10).optional(), doc_number: z.string().trim().max(30).optional(),
  guardian_name: z.string().trim().max(120).optional(),   // menor
  guardian_phone: z.string().trim().min(7).max(20),        // menor: del acudiente; adulto: el suyo
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  allow_duplicate: z.boolean().default(false),
});
const PendienteSel = z.object({
  payment_id: z.string().uuid(),
  seen: z.object({ amount: z.number(), amount_paid: z.number() }),   // para PREVIEW_STALE
  discount: Descuento.optional(),
  waive_late_fee: z.object({ value: z.number().positive().optional(), reason_text: z.string().trim().max(300).optional() }).optional(), // sin value = todo el recargo
  exonerate: z.object({ reason_text: z.string().trim().min(3).max(300) }).optional(),
  pay_amount: z.number().nonnegative().max(20_000_000).default(0),
  close_mode: z.enum(['cerrar','abono']).default('abono'), // si pay_amount < saldo: 'cerrar' = la diferencia es descuento (pide motivo)
});
const DescuentoGlobal = Descuento.extend({ line_refs: z.array(z.string()).min(1) }); // 'new:<idx>' | 'pending:<uuid>'
const Pago = z.object({
  method: z.enum(['cash','transfer']),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),   // ≤ hoy Bogotá
  receipt_url: z.string().url().optional(), receipt_sha256: z.string().optional(), ocr: z.record(z.unknown()).optional(),
});
```

El BFF **no calcula** montos: manda las decisiones y la RPC calcula (la vista previa y el `create` usan la misma función,
§7.2). Un `close_mode='cerrar'` sin `discount.reason_code` → 422 («¿por qué se cierra por menos?»).

### 9.3 Límites y abuso

- Topes Q10 en zod **y** en la RPC.
- Rate limit Q11 con el mismo patrón de `middlewares/storeRateLimit.ts` (clave = `user_id`), y por escuela.
- `timeout` de la RPC: medir en F1 un lote de 600 filas en Campestre (rollback); objetivo < 3 s. Si no, bajar el tope.
- Log estructurado `charge_batch_created` con escuela, actor, N, total, duración (sin nombres de menores).

### 9.4 Pruebas BFF (vitest, sin red)

Coach/acudiente/accountant → 403 en preview/create/annul (accountant 200 en GET); atleta de otra escuela → 404;
mensualidad sin `period` → 422; `excedente` sin `overage_charge_id` → 422; 201 atletas → 422; 601 filas → 422;
`client_request_id` repetido → mismo `batch_id`, `duplicated:true`; `PREVIEW_STALE` → 409; rate limit → 429.

Rev. 2: `mode='multi'` con `pending` o `payment` → 422; porcentaje 101 → 422; motivo `otro` sin texto → 422;
`close_mode='cerrar'` sin motivo → 422; `EN_REVISION` / `COBRO_CAMBIO` / `PAGO_EN_CURSO` / `COBRO_CERRADO` → 409 con
mensaje en español; `SOBREPAGO` → 422; coach con `discount` o con `payment` → 403; acudiente llamando la ruta → 403;
`revert` de un ajuste ya revertido → 409; contador en `GET /payment-adjustments` → 200, en `revert` → 403.

---

## 10. Frontend — el modal «Cobros y pagos» (rev. 2)

Rev. 2 (D11): **no hay** modal «Generar cobros». `components/payment/RegisterCashPaymentModal.tsx` se transforma en
`CobrosYPagosModal` (mismo archivo renombrado en F3, o un archivo nuevo que lo reemplaza y el viejo se borra en la misma
rama; los dos lugares que lo abren cambian el import). Lo que hoy hace bien se conserva: buscador de atleta, validador de
comprobante (`useReceiptValidator`, `paymentCategory` del cobro), adjuntar comprobante solo en transferencia, campos OCR
para la deduplicación, desbloqueo de cobros con intento de tarjeta rechazado, y la opción de factura electrónica con la
consulta del pagador en la DIAN (`wantsEInvoice`, `payerDianState`). Lo que cambia: **toda escritura pasa por el BFF**
(`POST /charge-batches`); desaparecen los `insert/update` directos (`:434`, `:455`, `:517`), el rescate del 23505 y el
`notify_user` por cobro. `lib/manualPaymentCharge.ts` deja de usarse para escribir (su regla vive en la RPC, §6.4); su
lista de opciones se amplía a las 10 categorías y se usa solo para el selector «Tipo».

### 10.1 Puntos de entrada (los mismos de «Registrar pago», más equipos)

| Dónde | Hoy | Rev. 2 |
|---|---|---|
| Ficha / listado de atletas — `pages/SchoolStudentsManagementPage.tsx:2651` (modal), menú de la fila `:1323`, pie de la ficha `:2605-2619` | «Registrar pago» con el atleta preelegido | «Cobros y pagos», modo un atleta, atleta fijo |
| Pagos — `pages/PaymentsAutomationPage.tsx:2984` | «Registrar pago» | «Cobros y pagos» con buscador; casilla «Varios atletas» pasa a modo varios. «Apertura del Mes — Generar Cobros» (`:3095`, `open_month`) se renombra «Abrir el mes» para que no compita. Pestaña nueva «Operaciones» (§10.5). |
| Equipos — `pages/TeamsPage.tsx`, roster `components/teams/EnrollTeamStudentModal.tsx:137-140` | — | «Cobrar a este equipo»: abre el mismo modal en modo varios con el equipo elegido |

Gates visuales (el BFF es el gate real, §9.1): abrir el modal y registrar pagos = `canRegisterPayments` (`:262`, ya
excluye al coach); «+ Nuevo cobro», descuentos, condonación y exoneración = `canManageCharges` (owner/admin/school_admin).
El selector de atletas en modo varios pide `GET /charge-batches/targets` (no arma listas en el cliente).

### 10.2 Modo un atleta

```
┌ Cobros y pagos ─────────────────────────────────────────────────────── ✕ ┐
│ Atleta [Sofía Ramírez ▾]  Plan PGP8x3 · Acudiente María R. ✓   [ ] Varios │
│        ¿No aparece? [+ Atleta nuevo]                                     │
│                                                                          │
│ COBROS PENDIENTES                                       Saldo     Pagar  │
│ [✓] Mensualidad sep 2026 · vencida                                       │
│       723.000 + recargo 36.150                         759.150 [723.000] │
│       [✓] Condonar recargo  −36.150   Motivo [Condonación de mora ▾]     │
│ [✓] Mensualidad oct 2026 · pendiente                   723.000 [650.700] │
│       Ya trae: [Hermanos −10 %]  (lista 803.333)                         │
│       Descuento [10 ▾][% ▾] [Pronto pago ▾]  −72.300 → 650.700           │
│       Etiquetas: Hermanos −10 % · Pronto pago −10 %  (total −19 %)       │
│       Sugerencia: pronto pago de la escuela 10 % hasta el 15/10 [Usar]   │
│ [ ] Seguro de accidentes · pendiente                   150.000 [       ] │
│ [–] Inscripción · comprobante en revisión            → Revisar comprobante│
│                                                                          │
│ + NUEVO COBRO                                                            │
│  Tipo           Detalle             Valor     Vence   Descuento  Nota Pagar│
│  [Torneo ▾]     [Copa Pony 2026  ]  [ 80.000] [20/10] [ —      ] [  ] [✓]│
│  [Mensualidad▾] [Noviembre 2026 ▾]  [723.000] [05/11] [ —      ] [  ] [ ]│
│     sugerido 723.000 (plan) · hermanos: no aplica                        │
│  [Seguro ▾]     [Seguro accidentes] [150.000] [15/10] [No cobrar]  …     │
│     ⚠ Ya tiene seguro del 02/03/2026 · «No cobrar»: esta línea no se crea │
│  + Agregar línea      Desde su plan: [Inscripción] [Uniforme]            │
│                                                                          │
│ DESCUENTO GENERAL  [   ][% ▾] [Motivo ▾]  sobre: [✓]sep [✓]oct [ ]torneo │
│                                                                          │
│ [✓] YA LO PAGARON   (•) Efectivo  ( ) Transferencia   Fecha [10/10/2026] │
│                     Comprobante [Subir]   [ ] Factura electrónica        │
│ ──────────────────────────────────────────────────────────────────────── │
│ Se crean 2 cobros por $803.000                                           │
│ Se registra el pago de 3 cobros por $1.453.700                           │
│   Descuentos −$72.300 · Recargo condonado −$36.150                       │
│ Las familias no reciben aviso de los cobros nuevos. [ ] Avisar           │
│                                   [Cancelar]  [Generar 2 · Pagar 3]      │
└──────────────────────────────────────────────────────────────────────────┘
```

«+ Atleta nuevo» (§16) abre dentro del mismo modal:

```
┌ Atleta nuevo ──────────────────────────────────────────────────────────┐
│ (•) Menor   ( ) Adulto                                                 │
│ Nombre completo* [Samuel Pardo R.            ]                         │
│ Documento        [CC ▾][                    ]  (opcional)              │
│ Acudiente        [Paola Restrepo              ]                         │
│ Teléfono acud.*  [+57 310 555 0101            ]                         │
│ ┌ ¿Es alguno de estos? ─────────────────────────────────────────────┐ │
│ │ SAMUEL PARDO RESTREPO · Sub-11 · doc ***4421 · acud. 310***0101    │ │
│ │   coincide: nombre + teléfono                     [Usar este]      │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ [Es otra persona: crear igual]                         [Cancelar]      │
└────────────────────────────────────────────────────────────────────────┘
```

Reglas de la pantalla (un atleta):
- **Atleta**: buscador por nombre, documento o teléfono del acudiente (`GET …/athlete-search`) sobre las tres
  identidades (`children`, `unregistered_athletes`, adultos con inscripción). Atleta con ficha y sin acudiente vinculado
  se cobra y se paga normal, con la marca «sin acudiente: no podrá pagar en línea hasta vincularlo» (D17). Si no aparece,
  «+ Atleta nuevo» (arriba): nada se crea hasta confirmar la operación completa; la ficha nace en la misma transacción.
- **Etiquetas de descuento** (D16): cada cobro muestra, en orden, los descuentos que ya trae (militar, hermanos, «solo
  este mes», pronto pago congelado) y los que se le agregan en el modal, cada uno con su valor; el total y, si supera
  50 % del valor de lista, un aviso amarillo «Descuento total 55 %: revisa» (no bloquea).
- **Pendientes**: lista de `GET …/open-charges` (todas las categorías, rotuladas con `etiquetaDeCobro`). Cada fila
  muestra el desglose que tenga (valor de lista, hermanos, descuentos previos, recargo, abonado) y su saldo. Marcarla
  precarga «Pagar» = saldo después de ajustes. `awaiting_approval` y «pago en curso» salen deshabilitadas con su motivo
  (Q22, §7.5 regla 2).
- **«Pagar» menor que el saldo** abre en la misma fila: `(•) Abono — queda debiendo $50.700   ( ) Cerrar el cobro — los
  $50.700 son descuento [Motivo ▾]`. Por defecto **abono** (nunca un descuento implícito; H6). Mayor que el saldo → error
  en línea («no se puede recibir más de lo que se debe»).
- **Descuento por línea** (pendiente o nueva): `[valor][% | $][Motivo]`; muestra el efecto en pesos y el nuevo valor. Motivo
  `otro` pide texto. «No cobrar» es una opción del mismo control (exoneración, §6.5): en una mensualidad dice «Beca del
  mes: queda pagada en $0 y cuenta para la vigencia»; en un cobro único nuevo «no se crea»; en uno pendiente «se anula».
- **Condonar recargo**: solo aparece si la fila tiene `late_fee_amount > 0`; total o parcial; motivo por defecto
  «Condonación de mora».
- **Sugerencias, no imposiciones (D9)**: pronto pago (si la escuela lo tiene y el cobro está en ventana y no tiene ya
  `early_payment_discount_applied`), hermanos en una mensualidad nueva, «varios meses» si se marcan ≥ 3 mensualidades
  (Q-D3). Son botones «Usar»; nada se aplica solo.
- **Descuento general**: un valor (% o $) + motivo, y casillas de a qué líneas aplica (por defecto todas las marcadas
  **menos** las que ya tienen descuento propio — Q-D2). Reparto en §15.3; la vista previa muestra cuánto le tocó a cada una.
- **«Ya lo pagaron»**: casilla. Activa la columna «Pagar» en las líneas nuevas (por defecto marcada en todas) y exige
  método; comprobante solo en transferencia. Sin la casilla, los pendientes marcados solo reciben ajustes.
- **Botón principal** (texto según lo que va a pasar):

| Lo que hay | Texto |
|---|---|
| Solo líneas nuevas, sin «Ya lo pagaron» | «Generar N» (N cobros) |
| Solo pendientes con «Pagar» | «Registrar pago» (M = 1) / «Registrar pago (M)» |
| Líneas nuevas + pagos | «Generar N · Pagar M» |
| Solo ajustes sobre pendientes, sin pago | «Guardar descuentos» |
| Modo varios | «Generar N» (N = filas de la vista previa) |
| Nada marcado, vista previa vencida o errores | deshabilitado, con el motivo debajo |

### 10.3 Modo varios (solo genera)

```
┌ Cobros y pagos · varios atletas ───────────────────────────────────── ✕ ┐
│ 1. ¿A quiénes?                                                          │
│   (•) Equipo [Sub-12 ▾]  ( ) Categoría  ( ) Plan  ( ) A mano            │
│   18 atletas activos · [ ] incluir pausados (2)                         │
│   [✓] Juan P.  [✓] Ana G.  [✓] Luis M.  … [Quitar a…]                   │
│                                                                         │
│ 2. ¿Qué se cobra? (igual para todos)                                    │
│ Tipo        Detalle                  Valor    Vence   Descuento   Nota  │
│ [Torneo ▾]  [Copa Pony 2026 — Sub-12] [80.000] [20/10] [10 %][Convenio▾] │
│ + Agregar línea                                                         │
│ Descuento para todos  [   ][% ▾] [Motivo ▾]                             │
│ Para registrar pagos, elige un solo atleta.                             │
│                                                                         │
│ 3. Vista previa                                        [Actualizar]     │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Se van a crear 17 cobros por $1.224.000                           │  │
│  │   (valor de lista $1.360.000 · descuentos −$136.000, Convenio)    │  │
│  │ Se omiten 1: Ana G. — ya tiene «Copa Pony» de hoy                  │  │
│  │ ⚠ 3 sin acudiente vinculado: no podrán pagar en línea [ ] omitirlos│  │
│  │ Detalle por atleta ▸                                               │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│ Las familias no reciben aviso. [ ] Avisar por correo/WhatsApp           │
│                                   [Cancelar]  [Generar 17]              │
└─────────────────────────────────────────────────────────────────────────┘
```

Reglas: sin sección de pendientes, sin «Ya lo pagaron», sin «No cobrar» de mensualidad (una beca es decisión por
atleta). El descuento por línea y el «descuento para todos» se aplican igual a cada atleta. El botón queda deshabilitado
hasta tener una vista previa vigente (cualquier cambio la invalida). Mensualidad en modo varios: el monto es «el de cada
atleta» (D4) y la vista previa muestra el total real; el personal puede fijar un monto único con casilla explícita.

### 10.4 Reglas comunes

`client_request_id = crypto.randomUUID()` se genera **al abrir** el modal y se conserva en reintentos; el botón se
bloquea mientras envía; tras confirmar, pantalla de resultado («2 cobros creados, 3 pagos registrados, descuentos
$72.300») con «Ver operación» y, si creó cobros, «Anular lote». Se invalidan las queries de pagos de la escuela, cartera,
ficha y tableros. 409 (`PREVIEW_STALE`, `COBRO_CAMBIO`, `PAGO_EN_CURSO`, `EN_REVISION`) → aviso y recarga de pendientes y
vista previa, sin perder lo escrito. En móvil las líneas se apilan (tipo / detalle / valor+vence / descuento / nota) y el
resumen con el botón queda fijo abajo.

### 10.5 Historial («Operaciones»)

En Pagos → pestaña «Operaciones»: fecha, quién, atleta o destino («Equipo Sub-12»), cobros creados, pagos registrados,
descuentos, total, estado, acciones «Anular lote» (solo lo creado, Q12) y, por cobro, «Quitar descuento» (§7.5). Anular
abre confirmación con el conteo exacto («Se anularán 15 cobros pendientes por $1.200.000. 2 ya pagados no se tocan.») y
motivo obligatorio. Filtro «con descuentos» y enlace al informe `GET /payment-adjustments`.

---

## 11. Integraciones (dónde se ve un cobro del lote y qué probar)

Rutas: BFF relativas a `bff/src/`, frontend a `frontend/src/`. «Ya cubre» = lo resuelve el trabajo en curso
(`tipo-de-cobro.ts`, `esCobroUnico/etiquetaDeCobro`, `manualPaymentCharge.ts`); «Falta» = cambio de este spec.
Referencias detalladas por componente: `pagos-unicos-por-plan.md` §9 (mismo código).

| # | Componente (archivo:línea) | Estado frente a un cobro del lote | Cambio | Prueba | Fase |
|---|---|---|---|---|---|
| I1 | Ficha del atleta — `SchoolStudentsManagementPage.tsx:2243-2622`, modal `:2651` | No hay sección de pagos en la ficha; «Registrar pago» abre el modal viejo | «Registrar pago» → «Cobros y pagos» (mismo lugar, atleta fijo) + lista de cobros abiertos del atleta con su desglose de descuentos | Playwright T1, T19 | F3 |
| I2 | Lista de pagos de la escuela — `PaymentsAutomationPage.tsx:1062,1084` (`isOneOffCharge`, 3 categorías) | Un `torneo`/`viaje` del lote se toma como «cobro del mes» | `isOneOffCharge` → `isOneTimeCategory` (`lib/payment-accounts.ts:127`) | vitest del selector «cobro del mes» con `torneo` | F0 |
| I3 | Cartera del personal — `lib/paymentCartera.ts:91` (`groupOpenDebtByAthlete`), `FinancialSummaryCards`, `OverdueAccountsCard.tsx:58` | Incluye la deuda (bien) | Rótulo con `etiquetaDeCobro` | vitest `groupOpenDebtByAthlete` | F3 |
| I4 | Informe de cartera — `services/informe-cartera.service.ts:227-231` | **Ya cubre**: `payment_category` manda | Nada | vitest existente + caso `torneo` | — |
| I5 | Mis pagos (acudiente) — `MyPaymentsPage.tsx:242-262,307,353,522,610` | **Ya cubre**: lee `payment_category` y lo pasa al checkout. Menor con `parent_id` NULL se ve por `child_id` de sus hijos | Agrupar «Otros cobros» bajo la mensualidad (cosmético) | Playwright T7 | F3 |
| I6 | Pagos del atleta adulto — `AthletePaymentsPage.tsx:23,121` (`get_athlete_payments`) | La RPC **no devuelve** `payment_category` (comentario `:23`): rotula por concepto | Agregar `payment_category` a `get_athlete_payments` (nueva migración, `CREATE OR REPLACE` misma firma si el retorno es jsonb; si es `TABLE`, DROP+CREATE en su propia rama) | SQL `_smoke` + vitest | F3 |
| I7 | Checkout — `PaymentCheckoutModal.tsx:81,105,298,367-372`, `ParentCheckoutPage.tsx:209,346` | **Ya cubre** en `ParentCheckoutPage` (`chargeCategoryOf(payment_category, …)`, `isOneTimeCategory`); el modal todavía calcula llaves por concepto en modo update | Prop `paymentCategory` real primero | vitest: `torneo` + llave `only_for:['torneo']` visible | F3 |
| I8 | Bot WhatsApp: estado de cuenta — RPC `wa_get_payment_status` (`20260911184400…:56-81`), `services/whatsapp-bot.service.ts` | Lista por `parent_id` → **no ve** cobros de menores sin acudiente (Q15). Rótulos con `tipo-de-cobro.ts` (**ya cubre**, tests `whatsapp-bot-pagos-unicos.test.ts`) | Nada en este spec (el fallback por `child_id` es de pagos-únicos F5) | T13 | — |
| I9 | Bot: enlaces «Pagar» — `whatsapp-enlaces-de-pago.service.ts:243` (`etiquetaDelCobro`) | **Ya cubre** | Nada | T13 | — |
| I10 | Bot: comprobante → cobro — `whatsapp-receipt-matching.service.ts:13,71`, `whatsapp-recuperacion.service.ts:567`, `whatsapp-otro-concepto.service.ts` | **Ya cubre** categoría inferida | Verificar `OtroConcepto` con `viaje`/`vacacional`/`clase_extra` (lote los vuelve comunes) | vitest `whatsapp-queue-pagos-unicos.test.ts` + caso viaje; T14 | F3 |
| I11 | Bot: aviso de resultado — `jobs/whatsapp-payment-outcome.job.ts:49,167` (`esPagoUnico`) | **Ya cubre**: plantilla neutra para cobro único | Nada | T7 | — |
| I12 | Wompi enlace con monto — `services/cobro-enlace-publico.service.ts:58,203,395`; webhook `routes/wompi.ts:346,395-465` | **Ya cubre** (`esCobroUnico`, llaves por categoría). Candado de pagador `parent_id \|\| user_id` se salta con `parent_id` NULL | Nada aquí (pagos-únicos §9.2) | T7 sandbox | — |
| I13 | Mercado Pago — `routes/payments.routes.ts:95-144`, webhook `routes/mercadopago.ts:430-456` | Sin filtro de categoría (bien); deuda conocida P12 de pagos-únicos | Nada | — | — |
| I14 | Registrar pago — `RegisterCashPaymentModal.tsx:252,381-384,434-459,517,544` + `lib/manualPaymentCharge.ts` | Escribe desde el navegador; un pendiente a la vez; **sobrescribe `amount`** (H6) | **Se convierte** en «Cobros y pagos» (§10): varios pendientes, líneas nuevas, descuentos, abono vs. cerrar; todo por `POST /charge-batches`. `MANUAL_CHARGE_CATEGORY_OPTIONS` a 10 categorías (solo selector) | T15, T19–T24 | F3 |
| I15 | Aprobar comprobante — `lib/approvePayment.ts:80-95` | **Activa inscripciones `pending` del atleta (filtradas por `team_id`) al aprobar cualquier cobro completo**: aprobar el `torneo` de un lote (que lleva `team_id`) activaría una inscripción pendiente | Activar solo si `!isOneTimeCategory(payment.payment_category)` | vitest `approvePayment` con `torneo` | F0 |
| I16 | Rechazo — `reject_payment_receipt` (`20261008165728…:129-260`) | Vuelve a pendiente; sin categoría (bien) | Nada | — | — |
| I17 | Contabilidad / CSV — `lib/accounting/csv.ts:79-89`, `AccountingPage.tsx:322`; `cash_ledger`, `school_payment_kpis` (`20261003202419…`) | Categoría manda | Columna «Lote» (`charge_batch_id`) en el CSV | vitest CSV con 10 categorías; T16 | F3 |
| I18 | Factura electrónica — `services/invoicing.service.ts:169-173,413,437,517-524` | Factura todo `paid`; impuesto no depende de categoría (P15 de pagos-únicos) | Nada hasta decisión tributaria; anular lote no toca facturados (`trg_zy_guard_pago_facturado`) | T10 | — |
| I19 | Estado de cuenta mensual — `services/estado-de-cuenta.service.ts:74,271-277,535,664` | **Ya cubre** rótulos (`esCobroUnico`, `etiquetaDeCobro`); se dispara solo si hay mensualidad del mes | Canal natural del aviso de lote (Q9) | T17 | F5 |
| I20 | Recordatorios — `services/recordatorios-cobro.service.ts:264-267,391-393` | Solo mensualidades `subscription`: las mensualidades del lote **sí** entran (por eso `payment_type='subscription'`, §6.4); los únicos no | Nada | vitest `entraEnRecordatorios` con fila del lote | — |
| I21 | Correos de ciclo — `jobs/payment-lifecycle-emails.job.ts:56,85-97,309,382` | «Cobro creado» solo `subscription` → una mensualidad del lote **sí** manda correo | Saltar `charge_batch_id IS NOT NULL AND notify_families = false`; con `true`, un correo agrupado por familia (F5) | vitest del job | F2 / F5 |
| I22 | Notificación in-app por fila — `fn_notify_on_payment_created` + push | N notificaciones con push | §8.3 | T5 (0 push) | F1 |
| I23 | Control de acceso — `routes/access-adms.ts:452-470` | Mira **el último cobro creado** de cualquier categoría: un `torneo` del lote creado hoy **esconde** una mensualidad `overdue` anterior y deja entrar | Decidir por `exists overdue AND categoria = mensualidad` (lista blanca), no por el último | vitest con los dos órdenes | F0 |
| I24 | Auto-bloqueo — `jobs/access-auto-block.job.ts:68-72`; `fn_sync_access_group_on_payment` | Bloquea con cualquier `overdue` | Tras F0 un cobro único nunca es `overdue` → queda cubierto; agregar test de regresión | T9 | F0 |
| I25 | Mora — `apply_late_fees`, `fn_expire_overdue_payments`, `_mark_overdue_payments_impl` | Solo excluye `inscripcion`/`seguro` (§2.1) | Lista blanca `COALESCE(payment_category,'mensualidad') = 'mensualidad'` | SQL `_smoke`: torneo vencido sigue `pending` sin recargo | F0 |
| I26 | `open_month` — `20261007095911…:210` | Su `NOT EXISTS` ya excluye las 8 categorías únicas: un torneo del lote no tapa la mensualidad (bien). Una mensualidad del lote sí la cuenta (bien, evita duplicado) | Nada | §13.3 | — |
| I27 | Débito automático — `autopay_plan_cycles` (`20261005133733…:663-677`) | Solo `mensualidad` con período: una mensualidad adelantada del lote **sería debitada** al llegar su ciclo | Correcto si la familia autorizó débito; la vista previa avisa «N con débito automático: se les debitará» | vitest autopay | F3 |
| I28 | Duplicado de pagador — `services/duplicatePayerGuard.service.ts:17,64-70` | **Ya cubre** (`esCobroUnico`) | Nada | — | — |
| I29 | Factura electrónica de una mensualidad exonerada ($0) — `services/invoicing.service.ts:437,517-524` | Factura todo `paid` → intentaría una factura de $0 | Excluir `amount = 0` / `amount_paid = 0` del facturable | vitest | F2 (antes de que la exoneración sea alcanzable desde el BFF) |
| I30 | Rótulos «Pagado $X» — `MyPaymentsPage.tsx`, `AthletePaymentsPage.tsx`, ficha, recibo, bot (`wa_get_payment_status`), aviso de resultado (`whatsapp-payment-outcome.job.ts`) | Mostrarían «Pagado $0» | Rótulo «Exonerado» si `amount = 0`; con descuento: «$650.700 (antes $723.000 · descuento pronto pago)». El acudiente ve el motivo por código, no quién lo aplicó (Q-D7) | Playwright T21; vitest del formateo del bot | F3 |
| I31 | Pronto pago automático — `lib/earlyPaymentDiscount.ts`, `PaymentCheckoutModal.tsx:269-275,711-899`, `auto_approve_payment` | Calcula `round(amount × pct)` sobre `amount` | Sin cambio de fórmula: como `amount` ya es neto, el pronto pago se calcula **sobre el valor descontado** (§15.6). El modal del personal no ofrece «pronto pago» manual si ya hay `early_payment_discount_applied` | vitest con fila descontada | F3 |
| I32 | Mora — `apply_late_fees` | Recargo sobre `amount − amount_paid` una vez | Sin cambio: preserva el invariante (suma a `amount` y a `late_fee_amount`); un descuento previo baja el recargo; uno posterior no lo recalcula (§15.6) | `_smoke` | F1 |
| I33 | Cierre de mes — `preview_close_month`, `monthly_closes.total_late_fees` | Suma `late_fee_amount` | Con la condonación restada de `late_fee_amount` el total queda neto; agregar `total_late_fees_waived` y `total_discounts` al cierre (lectura de `payment_adjustments` del mes) | `_smoke` | F3 |
| I34 | Tableros / `school_payment_kpis` / CSV contable | Ingreso = `finance_income_amount` (ya neto) | Columnas «Valor de lista», «Descuento», «Recargo condonado», «Motivo» en el CSV; KPI «Descuentos del mes» | vitest CSV; T22 | F3 |
| I35 | Wompi enlace con monto — `cobro-enlace-publico.service.ts`; webhook `routes/wompi.ts:395-465` | El enlace firma un monto; el webhook marca `paid` | Regla 2 de §7.5 impide descontar con enlace vigente. Defensa en el webhook: si lo recibido **supera** `amount` (descuento aplicado por otra vía entre la firma y el pago) → `paid` con `amount_paid` = recibido y `requires_review = true` («pagó de más $X») | vitest webhook; §13.10 | F2 |
| I36 | Estado de cuenta (`estado-de-cuenta.service.ts`), informe de cartera, recordatorios | Leen `amount` y `amount_paid` | Nada (ya neto). Estado de cuenta: línea «Descuentos aplicados este mes» si hubo | vitest | F5 |

---

## 12. Plan de ejecución (F0–F5) — listo para construir

### 12.0 Reglas para todas las fases (CLAUDE.md del repo)

- Una rama por fase **desde `develop`**, merge `--no-ff` a `develop` tras revisión; **nada a `main`**. Revisión del
  usuario entre fases. Commitear solo lo propio (índice temporal; varias sesiones trabajan en `develop`).
- Migraciones: **plan aprobado antes de escribirlas**; crear cada archivo con `npm run migrations:new -- <slug>` y
  commitearlo junto a `supabase/migrations_ledger.json`; `npm run migrations:check` en verde. Nunca editar una migración
  existente. Toda función: `SET search_path = pg_catalog, public, pg_temp`; `REVOKE … FROM PUBLIC, anon, authenticated`
  explícito y `GRANT EXECUTE … TO service_role` (o el rol que corresponda). Estados en `text + CHECK`. FKs a `profiles(id)`.
- `CREATE OR REPLACE` de una función viva = copiar el cuerpo de `pg_get_functiondef` (no del repo: hay deriva).
- Aplicar por vía con rastro (CLI de Supabase o `apply_migration`), **no** por el SQL Editor. Después:
  `npm run seguridad:invariantes` (0 críticos), `npm run seguridad:rls-negativas`, `npm run seguridad:blindaje-dinero`,
  y `select … from pg_policies where tablename in (…)` de cada tabla tocada.
- Escritura de prueba **solo en Club Campestre Demo** (`25a123f0-6d57-48a4-9800-7b1531d61cd2`). **Dreamers solo lectura**
  (vistas previas, `SELECT`). Snapshot antes/después (conteos de `payments` por categoría/estado, `charge_batches`,
  `payment_adjustments`, `notifications`, `children`, `unregistered_athletes` de Campestre). No borrar datos de prueba.
- Pruebas: Playwright **solo TypeScript** en `frontend/e2e/` (patrón de `descuentos.spec.ts`: `helpers/auth.ts` +
  `helpers/guard-no-prod.ts`, usuarios de seed); SQL en `supabase/migrations/_smoke/<tema>_smoke.sql` (transacción con
  `ROLLBACK`); concurrencia con dos conexiones en un script `scripts/pruebas-*.mjs` (patrón de
  `scripts/pruebas-blindaje-dinero.mjs`); BFF y frontend con vitest junto al archivo (`*.test.ts`).
- Agrupar pushes (cupo de despliegues de Vercel).

### 12.1 Dependencias

```
F0 (EN CURSO, otro agente) ──► F1 backend ──► F2 BFF ──► F3 modal «Cobros y pagos» ──► F5 aviso a familias
                                    │                         ▲
   Seguridad S1 (H5) ───────────────┼─────────────────────────┘ (antes de abrir F3 a producción)
                                    └── pagos-únicos F1 ──► F4 lista del plan en el modal
```

- F1 no necesita `plan_one_time_fees`; `one_time_fee_id` se agrega en F4 (o en pagos-únicos F1 si llega antes, con
  `ADD COLUMN IF NOT EXISTS`). `created_by` y `notes` de `payments` se crean en F1 de este spec (§6.3).
- La F3 «Agregar cobro» de `pagos-unicos-por-plan.md` queda **eliminada**: la reemplaza la F3 de aquí.

### F0 · Reglas genéricas de cobros únicos — **EN CONSTRUCCIÓN por otro agente (2026-10-10). No duplicar.**

Alcance (para revisar contra lo que entregue, no para reconstruirlo): mora/vencimiento con lista blanca
`COALESCE(payment_category,'mensualidad') = 'mensualidad'` en `apply_late_fees`, `fn_expire_overdue_payments`,
`_mark_overdue_payments_impl` (I25); `bff/src/routes/access-adms.ts` decide por mensualidad vencida, no por el último
cobro (I23); `frontend/src/lib/approvePayment.ts` no activa inscripciones al aprobar un cobro único (I15);
`isOneOffCharge` → `isOneTimeCategory` en `PaymentsAutomationPage.tsx` (I2). Es la misma F0 de pagos-únicos.
**Criterio para arrancar F1**: F0 mergeada en `develop` y su migración aplicada (verificar en `pg_proc` que
`apply_late_fees` ya no tiene `NOT IN ('inscripcion','seguro')`).

### F1 · Backend: esquema, ajustes, triggers y RPCs (sin UI) — rama `feat/cobros-y-pagos-f1-backend`

**Medir antes (solo lectura, pegar resultados en el PR):** escritores de `payments.amount` (grep `bff/src`,
`frontend/src`, `pg_proc.prosrc ILIKE '%amount%'` con `UPDATE public.payments`); caminos que insertan cobros sin atleta
(H7, 219 filas); costo de un `open_month` de Campestre con y sin el trigger de descuentos (en transacción con `ROLLBACK`);
cuerpo vivo de `fn_guard_payments_client`, `fn_notify_on_payment_created`, `fn_trigger_push_on_notification`,
`enqueue_notification_delivery`, `confirm_hour_bank_overage`.

**Migraciones** (en este orden; cada una con `npm run migrations:new -- <slug>`):

| # | Slug | Contenido |
|---|---|---|
| M1 | `cobros_f1_charge_batches` | Tabla `charge_batches` (§6.1 con columnas rev. 2) + índices + RLS `cb_select_finance` + GRANTs (§8.1). |
| M2 | `cobros_f1_payments_columnas` | `payments`: `charge_batch_id`, `created_by`, `notes`, `discount_amount`, `late_fee_waived_amount` (`ADD COLUMN IF NOT EXISTS`) + `ix_payments_charge_batch`. `enrollments`: `fee_discount_origin`, `fee_discount_pct` + backfill desde `fee_reason = 'Descuento Fuerza Militar 10%'` (0 filas hoy). `notifications.push boolean NOT NULL DEFAULT true`. |
| M3 | `cobros_f1_payment_adjustments` | Tabla `payment_adjustments` (§6.5, con `origin`, `applies_to`, `sequence`) + trigger de coherencia de `school_id` + RLS `padj_select_finance` + vista `v_payment_adjustments_familia` (`security_invoker`, columnas publicables: tipo, origen, motivo humanizado, monto, fecha) + GRANTs (§8.1b). |
| M4 | `cobros_f1_descuentos_automaticos` | Función + trigger `trg_payments_descuentos_automaticos` (BEFORE INSERT estampa `list_amount`/`discount_amount`; AFTER INSERT / AFTER UPDATE OF `early_payment_discount_applied, status` inserta ajustes `militar`, `hermanos`, `alta_solo_este_mes`, `pronto_pago`) (§6.5). |
| M5 | `cobros_f1_backfill_ajustes` | **Datos**, idempotente, con bloque de dry-run comentado arriba: ajustes `context='backfill'` para las 3 filas con `discount_pct` y la 1 con `sibling_discount_applied`; `list_amount`/`discount_amount` coherentes. |
| M6 | `cobros_f1_invariantes_payments` | `CHECK` del invariante `list_amount IS NULL OR amount = list_amount − discount_amount + late_fee_amount` (`NOT VALID` → `VALIDATE`); `payments_amount_positive` reemplazado por `amount > 0 OR (amount = 0 AND status = 'paid' AND discount_amount > 0)`; trigger `BEFORE INSERT` que rechaza cobros sin atleta (H7, solo si el radio medido no muestra caminos legítimos; si los hay, se documentan y esta parte se separa). |
| M7 | `cobros_f1_guardia_y_notificaciones` | `fn_guard_payments_client` (cuerpo vivo + columnas nuevas, §8.2); `fn_notify_on_payment_created` respeta `app.charge_batch_id`; trigger de push y `enqueue_notification_delivery` respetan `notifications.push = false` (§8.3). |
| M8 | `cobros_f1_funciones_internas` | `_resolve_payment_payer`, `_charge_duplicate_reason`, `_confirm_overage_into_payment` (+ `confirm_hour_bank_overage` la usa, mismo comportamiento), `_find_athlete_duplicates` (§16.3), `_apply_payment_adjustment` (§7.5), `_plan_charge_operation` (cálculo compartido preview/create). Todas solo `service_role`. |
| M9 | `cobros_f1_rpcs` | `preview_charge_batch`, `create_charge_batch` (pasos 1–13 con 3b y 9a–9d), `annul_charge_batch`, `revert_payment_adjustment`. `GRANT EXECUTE … TO service_role` únicamente. |

**Pruebas automáticas:**
- `supabase/migrations/_smoke/charge_batches_smoke.sql` y `supabase/migrations/_smoke/payment_adjustments_smoke.sql`
  (§7.6) + `supabase/migrations/_smoke/cobros_personas_smoke.sql` (atleta nuevo menor/adulto, duplicado bloqueado,
  `allow_duplicate` auditado, rollback total si falla el cobro; cobro sin atleta rechazado).
- `scripts/pruebas-cobros-y-pagos-concurrencia.mjs` (dos conexiones; casos §13.1–17) — script de **harness**, no de UI.
- Ampliar `scripts/pruebas-blindaje-dinero.mjs` con: acudiente no puede escribir `discount_amount`,
  `late_fee_waived_amount`, `list_amount`; staff navegador no puede escribir `charge_batch_id` ni columnas de ajuste.
- `npm run seguridad:invariantes`, `seguridad:rls-negativas` (anon/coach/acudiente sobre `charge_batches` y
  `payment_adjustments`).
- Medición: lote de 600 filas en Campestre < 3 s (rollback); `open_month` de Campestre con trigger ≤ +10 % del tiempo.

**QA manual (Campestre, por SQL con `ROLLBACK` o RPC con service role):** T1–T3, T10, T20 (a nivel RPC), T24, T29,
T32–T34. Dreamers: `preview_charge_batch` con 3 atletas reales (montos sugeridos de planes por horas, seguro de 12 meses),
**sin** `create`.

**Criterio de salida:** 0 cambios de comportamiento en caminos existentes (un alta de Campestre y un `open_month` de
prueba producen las mismas filas y notificaciones que antes, más sus ajustes automáticos); invariantes en verde.

### F2 · BFF — rama `feat/cobros-y-pagos-f2-bff`

**Archivos nuevos:**
- `bff/src/routes/charge-batches.routes.ts` — `POST /preview`, `POST /`, `GET /`, `GET /:id`, `POST /:id/annul`,
  `GET /targets`, `GET /athlete-search` (§9.1).
- `bff/src/routes/payment-adjustments.routes.ts` — `POST /:id/revert`, `GET /` (informe).
- `bff/src/routes/athlete-charges.routes.ts` — `GET /api/v1/athletes/:athleteType/:athleteId/charge-suggestions` y
  `…/open-charges` (con etiquetas de descuento en orden y avisos del 50 %).
- `bff/src/services/charge-batches.service.ts` — llamadas a las RPC, traducción de errores (`PREVIEW_STALE`,
  `COBRO_CAMBIO`, `EN_REVISION`, `PAGO_EN_CURSO`, `COBRO_CERRADO`, `DESCUENTO_EXCEDE`, `ATLETA_DUPLICADO`, `SOBREPAGO`,
  `MULTI_NO_PAGA`) a 409/422 con mensaje en español.
- `bff/src/services/charge-batches.schemas.ts` — zod de §9.2 (`ChargeBatchRequestSchema`, `Descuento`, `PendienteSel`,
  `DescuentoGlobal`, `Pago`, `AtletaNuevo`).
- `bff/src/middlewares/assertSchoolFinanceAdmin.ts` — owner/admin/school_admin activo en `school_members`, dueño en
  `schools.owner_id` o `is_super_admin`; variante lectura con `accountant`.
- `bff/src/middlewares/chargeBatchRateLimit.ts` — Q11 (patrón `storeRateLimit.ts`).

**Archivos que cambian:** `bff/src/index.ts` (montaje con `paymentLimiter` + limitador propio);
`bff/src/jobs/payment-lifecycle-emails.job.ts` (I21: salta filas de lote sin aviso); `bff/src/services/invoicing.service.ts`
(I29: no facturar `amount = 0` / `amount_paid = 0`); `bff/src/routes/wompi.ts` (I35: recibido > `amount` → `paid` +
`requires_review`); `bff/src/routes/students-create-one.route.ts` (`findExistingAthlete` llama `_find_athlete_duplicates`
vía RPC, una sola regla de duplicados).

**Pruebas automáticas (vitest, sin red):** `charge-batches.routes.test.ts` (§9.4 completo: roles, 403/404/409/422/429,
idempotencia, modo varios sin pagos, atleta nuevo y duplicado); `payment-adjustments.routes.test.ts`;
`assertSchoolFinanceAdmin.test.ts` (admin global de `profiles.role` sin membresía → 403); `charge-batches.schemas.test.ts`;
`invoicing.service` caso $0; `wompi` caso sobrepago; `payment-lifecycle-emails.job` caso lote silencioso;
`students-create-one` regresión de duplicados.

**QA manual (Campestre, con curl/Postman al BFF de dev y el JWT del seed):** T4, T11, T12, T25, T27 (API), T28 (coach),
T34. **Criterio de salida:** `npm test` del BFF en verde; ninguna ruta acepta escritura sin `assertSchoolFinanceAdmin`.

### F3 · Convertir «Registrar pago» en «Cobros y pagos» — rama `feat/cobros-y-pagos-f3-modal`

**Requisito previo:** rama de seguridad **S1** (H5: el acudiente ya no puede fijar `early_payment_discount_applied`)
mergeada; si no, F3 no se abre a producción.

**Componentes (frontend):**
- `frontend/src/components/payment/CobrosYPagosModal.tsx` — reemplaza a `RegisterCashPaymentModal.tsx` (que se **borra**
  en esta rama); conserva validador de comprobante, OCR, desbloqueo y factura electrónica (§10).
- `frontend/src/components/payment/cobros-y-pagos/`: `AthletePicker.tsx` (buscador + «+ Atleta nuevo»),
  `NewAthleteForm.tsx` (registro mínimo + coincidencias), `PendingChargesSection.tsx` (casillas, saldo, «Pagar», abono vs.
  cerrar, condonar), `NewChargeLines.tsx` (N líneas), `DiscountControl.tsx` (% / $, motivo, «No cobrar»),
  `DiscountTags.tsx` (etiquetas en orden + aviso 50 %), `GlobalDiscount.tsx`, `PaymentBlock.tsx` («Ya lo pagaron»),
  `MultiTargetPicker.tsx` (equipo/categoría/plan/a mano), `PreviewSummary.tsx`, `ResultScreen.tsx`.
- `frontend/src/components/payment/OperacionesTab.tsx` — historial, anular lote, quitar descuento (§10.5).
- `frontend/src/lib/cobrosYPagos.ts` — funciones puras: texto del botón (tabla §10.2), armado del body, mapeo de errores.
- `frontend/src/lib/api/chargeBatches.ts` — cliente del BFF.

**Archivos que cambian:** `pages/SchoolStudentsManagementPage.tsx` (`:1323`, `:2605-2619`, `:2651`: abre el modal nuevo;
botón militar escribe también `fee_discount_origin/pct`); `pages/PaymentsAutomationPage.tsx` (`:2984` modal nuevo,
`:3095` «Abrir el mes», pestaña «Operaciones»); `pages/TeamsPage.tsx` («Cobrar a este equipo»);
`pages/MyPaymentsPage.tsx`, `pages/AthletePaymentsPage.tsx` (etiquetas de descuento, «Exonerado», I30);
`lib/manualPaymentCharge.ts` (opciones a 10 categorías; sin escritura); `lib/paymentCartera.ts` (I3);
`components/payment/PaymentCheckoutModal.tsx`, `pages/ParentCheckoutPage.tsx` (I7); `lib/accounting/csv.ts` (I17, I34).

**Migraciones de F3:** `cobros_f3_get_athlete_payments_categoria` (I6: `payment_category` y desglose de descuentos en
`get_athlete_payments`; si el retorno es `TABLE`, DROP + CREATE en la misma migración con sus GRANTs);
`cobros_f3_cierre_mes_descuentos` (I33: `total_discounts`, `total_late_fees_waived` en `preview_close_month`/cierre).

**Seed de prueba:** `supabase/seed/cobros_y_pagos_test_users.sql` — `qa-cobros-admin`, `qa-cobros-coach`,
`qa-cobros-parent` (con hijo inscrito) en **Club Campestre Demo**; idempotente; imprime los ids.

**Pruebas automáticas:**
- vitest: `lib/cobrosYPagos.test.ts` (texto del botón en los 6 casos, body por modo, errores), `paymentCartera` con
  `torneo`, CSV con columnas de descuento, etiquetas de descuento en `MyPaymentsPage` (formateo).
- Playwright `frontend/e2e/cobros-y-pagos.spec.ts` (con `guard-no-prod`): T1, T2, T5, T19 (regresión del viejo «Registrar
  pago»), T20 (caso mixto del wireframe), T22, T23, T24, T26, T27, T29 (etiquetas), T30, T31, T32, T33, T35; y
  `frontend/e2e/cobros-y-pagos-familia.spec.ts`: T21 (el acudiente ve «antes $X · Pronto pago» y no ve quién), T28 (coach
  no ve el modal). Pagos Wompi en sandbox solo si el ambiente de dev lo tiene configurado para Campestre; si no, T7/T21
  se cubren hasta el checkout.

**QA manual (Campestre):** recorrido completo del wireframe §10.2 en escritorio y celular; modo varios con un equipo de
Campestre (T5, T27); anular el lote (T10); T13/T14 por vitest si Campestre no tiene línea de WhatsApp de prueba; T16
(cartera, informe, CSV, tableros cuadran); T17 (estado de cuenta en dry-run). Dreamers: abrir el modal en modo un atleta
y llegar hasta la **vista previa** con atletas reales (sin confirmar).

**Criterio de salida:** todo lo que hacía «Registrar pago» sigue funcionando (T19); `grep "from('payments')"` sin
escrituras en el modal; Playwright en verde; snapshot de Campestre sin efectos colaterales fuera de lo creado.

### F4 · Lista del plan en el modal — rama `feat/cobros-y-pagos-f4-lista-plan` (depende de pagos-únicos F1)

Migración `cobros_f4_one_time_fee_id` (solo si pagos-únicos F1 no la creó: `payments.one_time_fee_id` + índice;
`_charge_duplicate_reason` con `fee_unica_vez`). BFF: `charge-suggestions` devuelve filas de `plan_one_time_fees` con
`will_charge`. Frontend: botones «Desde su plan» en `NewChargeLines.tsx`. Pruebas: smoke `cobros_lista_plan_smoke.sql`;
vitest de sugerencias; Playwright: agregar inscripción desde la lista y ver el dedupe del seguro. QA manual en Campestre
con una lista de prueba (Q3 de pagos-únicos).

### F5 · Aviso agrupado a familias — rama `feat/cobros-y-pagos-f5-aviso`

**Al iniciar la fase**: someter a Meta la plantilla neutra de WhatsApp («Nuevos cobros de {escuela}: {n} por {total}»).
Archivos: `bff/src/services/aviso-lote-familias.service.ts` (agrupa por familia, respeta horario de cobranza y «ya
contactado hoy» con el mismo registro de `estado-de-cuenta.service.ts` / `recordatorios-cobro.service.ts`), job
`bff/src/jobs/aviso-lote-familias.job.ts`, `estado-de-cuenta.service.ts` (línea «Descuentos aplicados este mes», I36),
`payment-lifecycle-emails.job.ts` (correo agrupado cuando `notify_families = true`). Pruebas vitest del agrupado, del
«ya contactado hoy» y del horario; QA manual T17 en dry-run sobre Campestre.

### Ramas de seguridad aparte (no son fases de este módulo, pero se ordenan aquí)

| Rama | Qué | Cuándo |
|---|---|---|
| S1 `fix/seguridad-pronto-pago-cliente` | H5: la guardia limita `early_payment_discount_applied` al valor calculado por el servidor (o se calcula en el servidor) | Antes de abrir F3 a producción |
| S2 `fix/seguridad-insert-payments-coach` | Q20: cerrar `Payments: insert staff` para coaches, con radio medido | Después de F3 (el modal ya no usa la policy) |
| S3 `fix/seguridad-amount-staff-navegador` | §8.2: staff desde el navegador ya no escribe `amount` | Después de F3, con los escritores medidos en F1 |

## 13. Pruebas de concurrencia

1. **Doble clic** (2 llamadas simultáneas, mismo `client_request_id`): 1 lote, 1 juego de filas; la segunda devuelve
   `duplicated:true` (lock del paso 2).
2. **Dos administradores, mismo grupo, distinto `client_request_id`, mismo torneo**: el segundo ve `misma_linea_hoy` en el
   paso 5 → `PREVIEW_STALE` (409) si su vista previa no lo mostraba; si lo mostraba y no lo forzó, se omite. Nunca 2 cobros
   iguales sin decisión explícita.
3. **Lote con mensualidad nov + `open_month` de nov corriendo a la vez**: el índice único decide; o el lote omite (vio la
   de `open_month`) o `open_month` omite (vio la del lote) o el lote revierte con 409 — nunca dos mensualidades.
4. **Lote + alta del mismo atleta** (`create_enrollment_with_payments` con seguro): misma llave advisory
   `enrollment_fees:<atleta>` → serializados; el segundo ve el seguro del primero.
5. **Dos lotes con atletas solapados en orden inverso**: locks tomados en orden por id → sin deadlock (test con 2 sesiones
   y `lock_timeout`).
6. **Excedente**: dos lotes con el mismo `overage_charge_id` → uno confirma, el otro revierte entero.
7. **Anular mientras el acudiente paga** (webhook Wompi marca `paid` una fila del lote): `FOR UPDATE` serializa; si el pago
   llegó primero, la fila queda en `kept`; si la anulación llegó primero, el webhook encuentra `cancelled` (su guard de doble
   pago ya lo maneja: verificar que no reviva el cobro).
8. **Anular con `expected_count` viejo** → `ANNUL_STALE`, nada cambia.
9. **Todo o nada**: lote de 50 filas donde la 37 viola el índice (insertada a mano en la prueba entre preview y create) → 0
   filas, 0 lote, 0 notificaciones.
10. **Descuento mientras hay un pago de pasarela en vuelo** (rev. 2): el acudiente abre el enlace Wompi con monto $723.000;
    el admin intenta un 10 %. (a) Con enlace/transacción vigente → `PAGO_EN_CURSO`, nada cambia. (b) Si el webhook llega
    primero, la fila está `paid` → `COBRO_CERRADO`. (c) Carrera residual (enlace emitido por un camino que la regla 2 no
    ve): el webhook encuentra `amount = 650.700` y recibe 723.000 → `paid`, `amount_paid = 723.000`,
    `requires_review = true` (I35); nunca un cobro reabierto ni un descuento perdido sin aviso.
11. **Descuento vs. comprobante**: el acudiente sube comprobante (`awaiting_approval`) mientras el admin descuenta →
    el `FOR UPDATE` serializa; si el comprobante llegó primero, `EN_REVISION`; si el descuento llegó primero, el
    comprobante se valida contra el monto **nuevo** (el validador lee `amount` al revisar).
12. **Dos admins descuentan el mismo cobro a la vez** (cada uno con su vista previa): el segundo ve `amount` distinto de
    `seen.amount` → `PREVIEW_STALE`; nunca dos descuentos sumados sin que alguien lo haya visto.
13. **Descuento + `apply_late_fees` en paralelo** sobre una mensualidad que vence hoy: el job hace `UPDATE` sobre la fila
    (bloqueo de fila); en cualquier orden el invariante `amount = list_amount − discount_amount + late_fee_amount`
    se cumple (el `CHECK` lo garantiza) y el recargo se calcula sobre lo que había en ese momento.
14. **Pago parcial + descuento que cerraría por debajo de lo pagado** (dos pestañas): la segunda ve `amount_paid` nuevo
    → regla 4 de §7.5 la rechaza o `PREVIEW_STALE`.
15. **Doble clic en «Registrar pago»** (mismo `client_request_id`): un solo `amount_paid` sumado; la segunda devuelve
    `duplicated:true` (hoy el modal duplicaría con `CASH-${Date.now()}`).
16. **Dos admins crean el mismo atleta nuevo a la vez** (dos modales, mismo nombre): `create_charge_batch` toma
    `pg_advisory_xact_lock(hashtextextended('athlete_new:' || school || ':' || normalize_athlete_name(nombre), 0))` antes
    de repetir `_find_athlete_duplicates`; el segundo ve al primero → `ATLETA_DUPLICADO` (409) y su modal ofrece «usar
    este». Para menores, `bloquear_atleta_duplicado` (trigger vivo en `children`) es la última defensa; para adultos
    (`unregistered_athletes`, sin ese trigger) el lock es la defensa.
17. **Descuento automático y del modal en la misma fila**: `open_month` crea con hermanos (el trigger escribe el ajuste
    `sequence=1`) mientras el admin aplica uno del modal: el `FOR UPDATE` del modal espera al `INSERT`; el del modal queda
    `sequence=2` sobre el saldo con hermanos.

## 14. Plan de QA (solo escuelas de prueba)

Una sola base para todos los ambientes: «ambiente» = qué BFF/frontend se ejerce (dev en F1–F3, staging antes de prod).
Snapshot antes/después de cada corrida: conteo de `payments` por categoría/estado, `charge_batches`, `notifications`
de la escuela de prueba. No se borran datos de prueba (los borra el usuario).

- **Club Campestre Demo** (`25a123f0-6d57-48a4-9800-7b1531d61cd2`, 46 inscripciones activas, 29 equipos): toda la escritura,
  modo varios incluido.
- **Acudiente y admin de prueba en Campestre**: el seed `supabase/seed/cobros_y_pagos_test_users.sql` (F3) crea
  `qa-cobros-admin@sportmaps.test` (admin), `qa-cobros-coach@sportmaps.test` (coach) y
  `qa-cobros-parent@sportmaps.test` (acudiente con un hijo inscrito en un equipo de Campestre). Los casos de acudiente
  (T7, T13, T17, T21) se hacen con esa cuenta. **Ninguna escuela real se escribe** (rev. 3: se retira el uso de la
  cuenta de Athletic Soacha). WhatsApp (T13, T14) solo si Campestre tiene línea de prueba conectada; si no, vitest.
- **Dreamers** (`57ba9352-…`): **solo lectura** — vista previa (no escribe) con atletas reales para verificar montos sugeridos de
  planes por horas y la regla del seguro.

| # | Caso | Esperado |
|---|---|---|
| T1 | Un atleta, 3 líneas (mensualidad mes siguiente, seguro, torneo) | 3 filas con categoría explícita, `charge_batch_id`, `created_by`; mensualidad con `offering_plan_id` y período; únicos exentos y sin plan |
| T2 | Mensualidad del mes que ya existe | Omitida con motivo; total no la suma |
| T3 | Seguro < 12 meses | Advertencia; «Cobrar igual» crea, «No cobrar» omite |
| T4 | Doble clic / red lenta (reintento) | 1 lote |
| T5 | Equipo Sub-12 de Campestre, torneo $80.000 | Vista previa N = activos del equipo; crear; N filas, 1 notificación in-app por familia, **0 push** |
| T6 | Menor sin acudiente en el grupo | Aviso con conteo; fila con `parent_id` NULL; no aparece en Mis Pagos de nadie hasta vincular; al vincular, `trg_backfill_payment_payer_on_link` lo asigna |
| T7 | Acudiente QA ve y paga (Wompi sandbox) el torneo | `paid`; `expires_at` sin cambio; aviso de resultado neutro (no «mensualidad») |
| T8 | Pagar la mensualidad creada a mano | `expires_at` se extiende como con `open_month` |
| T9 | Día siguiente al vencimiento de un torneo | Sigue `pending` (sin `overdue`, sin recargo, sin bloqueo) — **requiere F0** |
| T10 | Anular lote con 1 fila pagada | Anula el resto, conserva la pagada; estado `partially_annulled`; excedente vuelve a `suggested` |
| T11 | Coach (cuenta de prueba) | No ve el botón; BFF 403; `rpc` directo con su JWT → `permission denied` |
| T12 | 201 atletas / 601 filas / 11 lotes en 10 min | 422 / 422 / 429 |
| T13 | WhatsApp: «¿cuánto debo?» del acudiente QA | Lista el torneo con su nombre; botón «Pagar» con rótulo corto («Torneo») |
| T14 | Comprobante por WhatsApp con pie «torneo» y mensualidad + torneo pendientes | Se aplica al torneo |
| T15 | «Cobros y pagos»: registrar en efectivo el pago del torneo pendiente | Ese cobro `paid` con `amount` intacto y `amount_paid` = valor; mensualidad intacta |
| T16 | Cartera / informe de cartera / CSV contable / tableros | El torneo aparece en «otros», rotulado; totales cuadran |
| T17 | Estado de cuenta mensual de la familia QA | Incluye el torneo; un solo envío |
| T18 | Seguridad | `npm run seguridad:invariantes` sin críticos; anon sin acceso a `charge_batches`; acudiente no puede cambiar `charge_batch_id` de su cobro (guardia) |
| T19 | Regresión de «Registrar pago»: un pendiente, transferencia con comprobante, factura electrónica marcada | Igual que hoy: `paid`, comprobante con hash, validador en verde, factura emitida; **`amount` no cambia** aunque se escriba otro valor (el campo ya no lo edita: la diferencia pide abono o descuento) |
| T20 | Caso mixto: pagar mensualidad vencida con condonación total del recargo + pagar oct con 10 % pronto pago + crear torneo pagado + mensualidad de nov sin pagar (wireframe §10.2) | Botón «Generar 2 · Pagar 3»; 2 filas nuevas, 3 `paid`; sep: `late_fee_amount` 0, `late_fee_waived_amount` 36.150; oct: `list_amount` 723.000, `amount` 650.700; 2 filas en `payment_adjustments` con actor y motivo; un `charge_batches` con `paid_total` 1.453.700 |
| T21 | Acudiente QA ve su mensualidad con descuento y la paga en Wompi sandbox | Ve «$650.700 (antes $723.000 · Pronto pago)»; paga 650.700; `paid`; `expires_at` extendido; no ve quién descontó |
| T22 | Descuento general 5 % «Varios meses» sobre 3 mensualidades, una con descuento propio | Reparto §15.3; suma de partes = total mostrado; cada parte `scope='general'`; CSV contable con columnas de descuento |
| T23 | Pagar $600.000 de $650.700: abono / cerrar | Abono → `partial`, `amount_paid` 600.000, `payment_installments` aprobado, saldo 50.700. Cerrar → descuento 50.700 con motivo, `paid`, `amount = amount_paid` |
| T24 | «No cobrar»: mensualidad (beca) y torneo pendiente | Mensualidad `paid` $0, rótulo «Exonerado», vigencia extendida, `open_month` no la reemite, **sin factura**; torneo `cancelled` con motivo; ambos con ajuste `exoneracion` |
| T25 | Descuento que deja el cobro por debajo de lo abonado / porcentaje > 100 / sobre `awaiting_approval` / con enlace Wompi vigente | Rechazos `RAISE` → 409/422 con mensaje claro; nada cambia |
| T26 | «Quitar descuento» de oct antes de que paguen | `amount` vuelve a 723.000; fila `reversion`; una segunda reversión del mismo ajuste → 409 |
| T27 | Modo varios con 10 % «Convenio» a todos (wireframe §10.3) | 17 filas con `list_amount` 80.000, `amount` 72.000, 17 ajustes; sin sección de pagos; `payment` en el body → 422 |
| T29 | Etiquetas acumuladas: atleta de prueba con marca militar (escuela de prueba con `military_discount_enabled` encendido solo durante la prueba) + hermanos + 10 % del modal | Ajustes `militar`(1), `hermanos`(2), `modal`(3), cada % sobre el saldo anterior (lista 100.000 → 90.000 → 81.000 → 72.900); etiquetas en ese orden en el modal, la ficha y «Mis pagos» |
| T30 | Descuento total > 50 % | Aviso amarillo en vista previa y en la línea; se puede confirmar; queda en el informe |
| T31 | Atleta con ficha y sin acudiente vinculado: generar torneo y registrar su pago en efectivo | `parent_id` NULL en ambos; pago `paid`; al vincular el acudiente después, `trg_backfill_payment_payer_on_link` completa `parent_id` |
| T32 | «+ Atleta nuevo» menor (solo nombre + teléfono del acudiente) con clase suelta pagada | En una operación: ficha `children` con `parent_*_temp`, cobro `clase_extra`, pago `paid`. Si el cobro falla (forzar error), **no** queda ficha |
| T33 | «+ Atleta nuevo» con nombre/teléfono de uno existente | La vista previa muestra la coincidencia; «Usar este» cobra al existente; «crear igual» crea y deja `audit_logs athlete_duplicate_forced` |
| T34 | Cobro sin atleta (llamada directa al BFF/RPC sin atleta) | 422 / `RAISE`; y el trigger de H7 rechaza un `INSERT` sin atleta desde cualquier camino |
| T35 | Escuela sin ningún addon (D15) | El modal aparece y funciona igual |
| T28 | Coach y acudiente | Coach: no ve descuentos ni «+ Nuevo cobro»; BFF 403 con `discount`. Acudiente: `update payments set discount_amount…` / `amount…` con su JWT → `PAYMENT_FIELD_LOCKED`; `select` de `payment_adjustments` ajenos → 0 filas |

Automatización: T1–T5, T7, T10–T12, T19–T24, T26–T33, T35 como specs Playwright TypeScript; concurrencia (§13) como `_smoke` SQL + vitest.

---

## 15. Descuentos, condonación de recargo, exoneración y abonos (rev. 2)

Modelo de datos en §6.5, reglas de RPC en §7.5, pantalla en §10.2–10.3, pruebas en §13 (casos 10–15) y T19–T28.

### 15.1 Qué es cada cosa

| Ajuste | Sobre qué | Efecto | Dónde queda | Ejemplo |
|---|---|---|---|---|
| **Descuento** | Valor del cobro **sin** recargo (`list_amount − discount_amount`) | Baja `amount`; el cobro sigue abierto (o se cierra si ya cubre lo pagado) | `discount_amount` + `payment_adjustments(kind='descuento')` | Pronto pago a mano, beca parcial, convenio, «pagó 3 meses juntos» |
| **Condonación de recargo** | `late_fee_amount` | Baja `amount` y `late_fee_amount`; no toca el valor del cobro | `late_fee_waived_amount` + ajuste `condonacion_recargo` | «Se le perdona la mora de septiembre» |
| **Exoneración («No cobrar»)** | Todo el saldo, sin pagos previos | Cobro único: anulado (o no se crea). Mensualidad: pagada en $0 (beca del mes) | ajuste `exoneracion` (+ `cancelled` o `paid` $0) | «Este mes no paga», «el seguro no se le cobra» |
| **Abono** | — (no es ajuste) | Sube `amount_paid`; `status='partial'`; la deuda sigue | `amount_paid` + `payment_installments` | «Trajo $300.000 de los $723.000» |
| **Cerrar con descuento** | La diferencia entre lo recibido y el saldo | Descuento por la diferencia + `paid` | ajuste `descuento` con el motivo elegido | «Trajo $600.000 y se le acepta como pago completo» |

Por qué la condonación es distinta del descuento: el recargo no es precio, es castigo por mora; mezclarlos esconde en los
informes cuánto se perdona de mora (dato que el dueño quiere ver aparte) y rompería el invariante (un descuento de valor
que «se coma» el recargo dejaría `late_fee_amount` mostrando un recargo que ya no se cobra).

### 15.2 Quién puede

| Rol | Generar | Registrar pago | Descontar / condonar / exonerar | Revertir | Ver ajustes |
|---|---|---|---|---|---|
| owner, admin, school_admin (+ `super_admin`) | Sí | Sí | Sí | Sí | Sí |
| accountant | No | No | No | No | Sí (lectura) |
| coach, reporter | No | No | No | No | No |
| acudiente / atleta | No | No | **Nunca** (D13). Solo reciben los automáticos (hermanos, pronto pago, «solo este mes», militar), calculados por el sistema | No | Solo los de sus cobros, sin quién (Q-D7) |

La restricción vive en tres capas: BFF (`assertSchoolFinanceAdmin`), RPC (`p_actor` revalidado) y guardia de `payments`
(columnas de ajuste bloqueadas a quien escriba desde el navegador, §8.2). Excedentes: solo owner (H4), también para
descontarlos.

### 15.3 Descuento general sobre la selección (propuesta)

- **Se aplica después** de los descuentos por línea, sobre el valor que queda por descontar de cada línea elegida.
- **Porcentaje**: el mismo % a cada línea (exacto, no hay reparto).
- **Valor fijo**: se **prorratea en proporción** al valor por descontar de cada línea; redondeo a peso por el método del
  resto mayor (la suma de las partes es exactamente el valor pedido). Si una línea toca su piso (lo ya pagado), su parte
  se recorta y el sobrante se reparte entre las demás; si no cabe → `DESCUENTO_EXCEDE` con el máximo posible.
- **A qué líneas** (`line_refs`): el personal marca; por defecto las marcadas **sin** descuento propio (Q-D2), nunca
  excedentes salvo owner. Cada parte es un ajuste `scope='general'` con el mismo motivo, para que el informe lo agrupe.
- Alternativa considerada: «aplicar todo a una línea elegida». No se toma como default porque cambia el valor de una sola
  mensualidad (confunde a la familia al mirar mes a mes) y choca antes con su piso; sigue siendo posible eligiendo una
  sola línea.

### 15.4 Reglas que la RPC hace cumplir (resumen; detalle en §7.5)

| Regla | Error |
|---|---|
| Nunca negativo; nunca `amount` final por debajo de `amount_paid + early_payment_discount_applied`; `amount = 0` solo en exoneración de mensualidad | `DESCUENTO_EXCEDE` |
| Porcentaje en (0, 100]; valor > 0; motivo del catálogo; texto si `otro` o exoneración | 422 en BFF / `RAISE` |
| Un descuento no toca el recargo; la condonación no toca el valor | `DESCUENTO_EXCEDE` |
| Cobro en `awaiting_approval` o con abono del acudiente en revisión | `EN_REVISION` |
| Pago de pasarela en curso | `PAGO_EN_CURSO` |
| Cobro `paid / cancelled / glosado` | `COBRO_CERRADO` |
| Vista previa vieja (`amount` / `amount_paid` cambiaron) | `PREVIEW_STALE` |
| Exoneración con abonos | `EXONERACION_CON_PAGO` (se ofrece «cerrar con descuento») |
| Mensualidad: período, plan, categoría y vencimiento intactos (unicidad y vigencia no cambian) | — (no se escriben) |

### 15.5 Al pagar (aclaración del usuario)

Sobre pendientes, vencidos con recargo y parciales, en la misma confirmación:
1. **Pronto pago a mano**: descuento con motivo `pronto_pago`. Si la escuela tiene pronto pago automático y el cobro está
   en ventana, el modal lo **sugiere** con el % de la escuela; si la fila ya tiene `early_payment_discount_applied`, no se
   ofrece (sería doble).
2. **Varios meses juntos**: descuento general con motivo `varios_meses` sobre las mensualidades marcadas (Q-D3).
3. **Condonar recargo**: total o parcial, por fila.
4. **Lo recibido frente al saldo**: igual → `paid`. Menor → el personal elige **abono** (default: `partial`, la deuda
   sigue) o **cerrar** (la diferencia es un descuento con motivo obligatorio: `paid`). Mayor → error (no se modela saldo a
   favor).
5. **Parciales previos**: el saldo resta lo ya abonado; un descuento nunca baja el cobro por debajo de lo abonado.
6. El acudiente no tiene nada de esto: su checkout solo aplica los automáticos (y H5 cierra el hueco del pronto pago).

### 15.6 Orden con los descuentos automáticos y el recargo (propuesta)

```
list_amount (valor de lista: precio del plan / tarifa sin descuento)
  1 − militar               (tarifa de la inscripción; etiqueta «Militar −10 %»)        → saldo
  2 − hermanos              (open_month, % sobre el saldo; «Hermanos −10 %»)            → saldo
  3 − solo este mes         (alta, % sobre el saldo; «Solo este mes −12 %»)              → saldo
  4 − descuentos del modal  (por línea, luego general; «Convenio −$20.000»)              → amount
  5 + recargo de mora       (apply_late_fees, % sobre amount − amount_paid)             → amount
  6 − condonación           (solo sobre el recargo; «Mora condonada −$36.150»)          → amount
  7 − pronto pago           (al pagar, % sobre amount; «Pronto pago −10 %»)             → lo que paga la familia
```

Cada paso es un ajuste con `sequence`; cada % se aplica sobre el saldo que dejó el anterior (D16: secuencial, no se
suman porcentajes). Las etiquetas se muestran en este orden en el modal, en la ficha, en «Mis pagos» y en el recibo.

- **Descuento antes del recargo**: el recargo se calcula después sobre un saldo menor. **Después del recargo**: el
  recargo no se recalcula (ya se aplicó una vez); si la escuela quiere quitarlo, condona. Es la regla más simple de
  explicar y la que `apply_late_fees` ya cumple sin tocarlo.
- **Pronto pago + manual se acumulan** (la escuela decide: si no quiere acumular, no aplica el manual). Q-D5.
- **«Aplicar descuento solo este mes»** del alta queda como ajuste `origin='alta_solo_este_mes'` del primer cobro
  (lo escribe el trigger, §6.5); el formulario no cambia.
- **Militar** y cualquier descuento **permanente** no se aplican desde este modal: cambian la tarifa de la inscripción.
  Pero sí se **ven** en cada cobro como etiqueta («Militar −10 %») porque el trigger los registra como ajuste. El modal
  sugiere «¿Todos los meses? Cambia la tarifa del atleta» cuando el motivo es `convenio` o `beca` (Q-D11).
- **Mensualidad**: el ajuste no toca período, plan ni categoría → el índice de unicidad y el trigger de vigencia (que no
  lee `amount`, verificado en `fn_extend_enrollment_on_payment_paid` el 2026-10-10) se comportan igual. Una mensualidad
  descontada y pagada extiende la vigencia como cualquier otra; una exonerada también (beca).

### 15.7 Modo varios

Mismo descuento por línea para todos y «descuento para todos» (equivale a un % o valor fijo por línea; no hay reparto
entre atletas). Sin exoneración de mensualidad ni condonación (son decisiones por atleta, sobre cobros existentes). La
vista previa muestra valor de lista, descuento total y neto.

### 15.8 Decisiones de descuentos (aprobadas 2026-10-10)

| # | Tema | Decisión (aprobada 2026-10-10) |
|---|---|---|
| Q-D1 | ¿Tope de descuento por rol o por monto? | Sin tope (D16); aviso (no bloqueo) si el total del cobro supera 50 % del valor de lista; solo owner/admin/school_admin. El informe de descuentos resalta «descuentos > 50 % y exoneraciones». |
| Q-D2 | Descuento general: ¿a qué líneas por defecto y cómo se reparte? | Las marcadas **sin** descuento propio; % igual por línea; valor fijo prorrateado por valor (§15.3). |
| Q-D3 | «Varios meses juntos»: ¿regla automática con % fijo? | No en v1: **sugerencia** cuando se marcan ≥ 3 mensualidades, sin %; la escuela lo escribe. Si varias escuelas usan el mismo % → setting por escuela. |
| Q-D4 | ¿Descuento antes o después del recargo? | Sobre el valor sin recargo; el recargo va aparte y se perdona con condonación (§15.6). |
| Q-D5 | ¿El pronto pago automático se acumula con un descuento manual? | Sí (se calcula sobre el neto). El modal avisa «además aplicará pronto pago automático de 10 % si paga antes del 15/10». Si una escuela no quiere acumular → setting `early_payment_with_manual_discount` (default true), fase posterior. |
| Q-D6 | «No cobrar»: ¿descuento del 100 % o anular? | **Depende del tipo** (§6.5): cobro único → anular (`cancelled`) o no crear; mensualidad → `paid` en $0 (beca), porque anularla haría que `open_month` la reemita y quitaría la vigencia. Requiere relajar `CHECK (amount > 0)` solo para ese caso y no facturar $0 (I29). Alternativa si no se quiere tocar el CHECK: no ofrecer «No cobrar» en mensualidades y que la beca sea un cambio de tarifa del mes. |
| Q-D7 | ¿La familia ve el descuento? | Sí: valor de lista, descuento y motivo humanizado («Pronto pago», «Beca»); **no** quién lo aplicó ni la nota. `error_de_cobro` se muestra como «Ajuste». Vía vista con columnas publicables (§8.1b). |
| Q-D8 | ¿Se puede quitar un descuento ya aplicado? | Sí, mientras el cobro siga abierto (o sea una beca sin pagos), con reversión auditada (§7.5). Pagado = definitivo. |
| Q-D9 | ¿Avisar a la familia cuando se le descuenta un pendiente? | Una notificación in-app **sin push** por operación («Tu cobro de octubre ahora es $650.700»). Sin correo ni WhatsApp (no es cobranza). |
| Q-D10 | Mensualidad con hermanos + descuento manual | El manual se calcula sobre el valor ya con hermanos (`list_amount` = `amount` al primer ajuste). |
| Q-D11 | ¿Descuento recurrente («20 % todos los meses»)? | No es de este modal: es la tarifa de la inscripción (`monthly_fee` / `fee_is_manual`, como el militar). El modal enlaza a cambiar la tarifa. |
| Q-D12 | Contabilidad y factura: ¿el descuento es menor ingreso o gasto? | **Menor ingreso** (el ingreso ya sale de `amount`/`amount_paid` netos). CSV con valor de lista, descuento y motivo. Factura electrónica: v1 factura el neto; mostrar el descuento como `electronic_invoice_items.discount_rate` lo decide el contador de cada escuela (como P15 de pagos-únicos). |
| Q-D13 | ¿Descuento sobre un cobro con un abono del acudiente en revisión (`payment_installments` pendiente)? | Bloquear igual que `awaiting_approval` (`EN_REVISION`) hasta que se apruebe o rechace el abono. |
| Q-D14 | H5 (el acudiente fija su pronto pago desde el navegador): ¿se cierra antes de F3? | Sí, en rama de seguridad propia, **antes** de abrir el modal (D13 lo promete). Radio hoy: 0 filas, 3 escuelas con pronto pago. |
| Q-D15 | Marca del militar: hoy es texto libre en `fee_reason`. ¿Columna estructurada? | Sí: `enrollments.fee_discount_origin` (`'militar'`) + `fee_discount_pct`, escritas por el botón junto con el texto; el trigger lee la columna (no compara textos). Backfill desde `fee_reason` (0 filas hoy). Si más adelante hay otros descuentos permanentes («convenio empresa»), se amplía el CHECK. |
| Q-D16 | ¿«Solo owner/admin» incluye `school_admin`? | Sí: owner, admin y school_admin (= `user_admin_school_ids()`), igual que generar cobros (Q1). |
| Q-D17 | Un descuento del modal sobre un cobro que ya trae militar o hermanos: ¿el % del modal va sobre la lista o sobre el saldo? | Sobre el **saldo** (D16). La vista previa muestra la cuenta completa con las etiquetas en orden para que nadie espere una suma de porcentajes. |

---

## 16. Personas: a quién se le cobra (rev. 2, D17)

### 16.1 Las identidades que existen (base viva, 2026-10-10)

| Caso | Tabla | Pagador (`parent_id`) | En el modal |
|---|---|---|---|
| Menor con acudiente vinculado | `children` (`parent_id` puesto) | acudiente | Normal |
| Menor **sin** acudiente vinculado (589 fichas hoy) | `children` con `parent_name_temp/email_temp/phone_temp`, `parent_id` NULL | NULL; lo completa `trg_backfill_payment_payer_on_link` / `adopt_orphan_payments_on_child_link` al vincular | Se cobra y se registra el pago normal; marca «sin acudiente: no podrá pagar en línea» |
| Adulto con cuenta | `profiles` + `enrollments.user_id` | él mismo (`user_id`) | Normal |
| Adulto **sin** cuenta (557 fichas) | `unregistered_athletes` (`full_name`, `doc_*`, `phone`, `guardian_phone`…) | NULL | Normal |
| Persona sin ficha (nueva, visitante, clase suelta) | — | — | «+ Atleta nuevo» crea la ficha mínima |

El alta sin cuenta de hoy (`POST /students/create-one`, `students-create-one.route.ts:660-715` y `:1080-1100`) ya crea
exactamente eso: **menor** → `children` con `parent_*_temp`; **adulto sin cuenta** → `unregistered_athletes`. El modal
usa las mismas dos ramas (no inventa una tabla de «visitantes»): un visitante es una ficha mínima que la escuela puede
completar después.

### 16.2 Registro mínimo

- **Obligatorio**: nombre completo (≥ 3 caracteres) y teléfono (del acudiente si es menor; el propio si es adulto).
- **Opcional**: tipo y número de documento, nombre del acudiente, fecha de nacimiento.
- Se marca el origen (`unregistered_athletes.intake_form_data.origen = 'cobros_y_pagos'`; en `children`,
  `audit_logs action='athlete_created_from_cobros'`) para que la escuela encuentre después las fichas incompletas.
- Sin inscripción: la ficha nace sin plan. Una línea de **mensualidad** para una ficha nueva → `sin_inscripcion_para_mensualidad`
  (§7.1): para eso está el alta completa. La ficha nueva solo admite cobros únicos (clase suelta, torneo, artículos,
  otro…).
- Menor con fecha de nacimiento que da ≥ 18 años → misma advertencia que el alta (`mayor_de_edad`,
  `students-create-one.route.ts:660-668`): se sugiere «Adulto».

### 16.3 Duplicados (memoria «Identidades de atleta duplicadas»)

`_find_athlete_duplicates(p_school_id, p_full_name, p_doc_number, p_phone) RETURNS TABLE(table_name, id, full_name,
doc_masked, guardian, matched_by)` — interna, `STABLE SECURITY DEFINER`, solo `service_role`. Cruza las **tres**
identidades de la escuela (`children`, `unregistered_athletes`, adultos con inscripción vía `profiles`) por:
- documento normalizado (`normalize_doc_number`) exacto o casi igual (`doc_casi_igual`);
- nombre normalizado (`normalize_athlete_name`) exacto o prefijo (`nombre_es_prefijo`);
- teléfono normalizado (solo dígitos, últimos 10) contra `children.parent_phone_temp`,
  `unregistered_athletes.phone/guardian_phone` y el teléfono del acudiente vinculado.

Son las mismas funciones que usa el trigger vivo `bloquear_atleta_duplicado` (en `children`) y la misma intención que
`findExistingAthlete` del BFF (`students-create-one.route.ts:195-280`), que pasa a llamar esta función para que haya
**una** regla. El teléfono solo, sin nombre parecido, **no** es duplicado (hermanos comparten acudiente): se muestra como
«mismo acudiente que …», informativo.

Flujo: el modal busca mientras se escribe; si hay coincidencia, «Usar este» (recomendado) o «Es otra persona: crear
igual» (`allow_duplicate`, auditado). La RPC repite la búsqueda bajo lock (§13, caso 16) y `bloquear_atleta_duplicado`
sigue siendo la última defensa en `children`.

### 16.4 Nunca un cobro sin atleta

- zod: `athletes.min(1)` o `new_athlete`; la RPC exige exactamente uno de `child_id/user_id/unregistered_athlete_id` en
  cada fila que inserta.
- H7: trigger `BEFORE INSERT` en `payments` que rechaza filas sin atleta desde cualquier camino (radio medido antes).
- No hay «pago al aire» ni «cobro a nombre del acudiente»: si alguien paga por un visitante, la ficha mínima del
  visitante es el destino.

### 16.5 Decisiones de personas (aprobadas 2026-10-10)

| # | Tema | Decisión (aprobada 2026-10-10) |
|---|---|---|
| Q-P1 | ¿«+ Atleta nuevo» también en modo varios? | No: modo varios trabaja con grupos que ya existen. |
| Q-P2 | ¿La ficha creada en el modal se inscribe a algún equipo o plan? | No; queda sin plan. «Completar ficha / inscribir» lleva al alta normal. Evita duplicar la lógica del alta (pagos únicos, exoneración, vigencia). |
| Q-P3 | ¿Un visitante frecuente (clase suelta cada semana) termina con 20 cobros sueltos? | Es correcto como registro; un informe de fichas «origen cobros_y_pagos» con ≥ N clases sueltas sugiere ofrecerle un plan. |
| Q-P4 | ¿Se invita automáticamente al acudiente del menor nuevo? | No (Ley 2300, spam); botón «Invitar acudiente» en la pantalla de resultado, con el flujo de invitación existente. |
| Q-P5 | ¿El coach puede crear fichas desde el modal? | No (no abre el modal). El alta de coach sigue por su flujo (`COACH_CREATE_ATHLETE`). |
| Q-P6 | Las 17 filas vivas sin atleta (H7) | Revisar con cada escuela a qué atleta corresponden; las corrige el usuario o la escuela, no este módulo. |

---

## 17. Contrato final F1 (2026-10-10, lo que quedó en las migraciones `cobros_f1_*`)

Migraciones (en orden): `20261010144551_cobros_f1_charge_batches` · `…144552_cobros_f1_payments_columnas` ·
`…144554_cobros_f1_payment_adjustments` · `…144555_cobros_f1_descuentos_automaticos` · `…144556_cobros_f1_backfill_ajustes` ·
`…144557_cobros_f1_invariantes_payments` · `…144558_cobros_f1_guardia_y_notificaciones` · `…144559_cobros_f1_funciones_internas` ·
`…144600_cobros_f1_rpcs`. Todas las RPC: `SECURITY DEFINER`, `search_path` fijo, `EXECUTE` solo a `service_role`; cada una
re-valida `p_actor` (owner / admin / school_admin / super_admin de `school_members`, dueño en `schools.owner_id` o
`platform_admins` activo) sin usar `auth.uid()`.

### 17.1 Firmas

```sql
preview_charge_batch(p_school_id uuid, p_actor uuid, p_athletes jsonb, p_lines jsonb,
                     p_pending jsonb DEFAULT '[]', p_global_discount jsonb DEFAULT NULL, p_payment jsonb DEFAULT NULL,
                     p_new_athlete jsonb DEFAULT NULL,      -- agregado
                     p_overrides jsonb DEFAULT '[]',        -- agregado
                     p_mode text DEFAULT NULL)              -- agregado: NULL = 'multi' si hay > 1 atleta, si no 'single'
  RETURNS jsonb   -- STABLE, no escribe

create_charge_batch(p_school_id uuid, p_actor uuid, p_client_request_id uuid, p_mode text, p_target jsonb,
                    p_athletes jsonb, p_lines jsonb, p_overrides jsonb, p_notify boolean, p_preview_hash text,
                    p_pending jsonb DEFAULT '[]', p_global_discount jsonb DEFAULT NULL, p_payment jsonb DEFAULT NULL,
                    p_new_athlete jsonb DEFAULT NULL)       -- agregado
  RETURNS jsonb

annul_charge_batch(p_school_id uuid, p_actor uuid, p_batch_id uuid, p_reason text, p_expected_count int) RETURNS jsonb
revert_payment_adjustment(p_school_id uuid, p_actor uuid, p_adjustment_id uuid, p_reason text) RETURNS jsonb
```

**El hash cubre el resultado con los `p_overrides` aplicados**: la vista previa y el `create` deben recibir los mismos
`p_overrides` (al marcar «cobrar igual» / «no cobrar» el modal vuelve a pedir la vista previa). El `create` con
`p_new_athlete` usa `p_athletes = []`; el hash es el mismo que el de la vista previa del atleta virtual.

### 17.2 Entradas

- `p_athletes[]`: `{type: 'child'|'adult'|'unregistered', id}` (`adult` = `profiles.id` con inscripción en la escuela).
- `p_lines[]`: `{idx, category, amount?, due_date, concept, notes?, period?: {year, month}, enrollment_id?, fee_id?,
  overage_charge_id?, discount?: {basis, value, reason_code, reason_text?}, exonerate?: {reason_text, reason_code?},
  pay_amount?, pay?: false, close_mode?: 'abono'|'cerrar', auto_discounts?: boolean}`.
  - `idx` arma la referencia `new:<idx>` (si falta, la posición). Los `line_idx` de `p_overrides` y los `line_refs` usan ese `idx`.
  - `amount` = **valor de lista** de la línea. Mensualidad sin `amount` → D4 (`monthly_fee` → plan → equipo →
    `children.monthly_fee`); si la inscripción tiene marca militar, la lista es el precio y el militar queda como ajuste 1.
    Hermanos (Q17) se aplica si la escuela lo tiene activo y el atleta califica (regla de `open_month`), salvo
    `auto_discounts: false`.
  - `concept`: obligatorio salvo mensualidad (`'Mensualidad <Mes> <año> — <plan> — <atleta>'`) y excedente (formato de
    `confirm_hour_bank_overage`); en las demás la fila queda `'<concept> — <atleta>'`.
  - Con `p_payment`, cada línea nueva se paga completa salvo `pay_amount` (abono / cierre) o `pay: false`.
  - `fee_id` se ignora en F1 (llega con F4).
- `p_pending[]`: `{payment_id, seen: {amount, amount_paid}, discount?, waive_late_fee?: {value?, reason_text?},
  exonerate?: {reason_text, reason_code?}, pay_amount?, close_mode?}`. `close_mode='cerrar'` con `pay_amount` < saldo usa
  `discount.reason_code` (y `reason_text`) como motivo del descuento de cierre; `discount.value` puede faltar.
- `p_global_discount`: `{basis, value, reason_code, reason_text?, line_refs: ['new:<idx>'|'pending:<uuid>']}`. Modo un
  atleta: `porcentaje` igual por línea; `valor` prorrateado por lo que falta descontar, resto mayor, recorte en el piso.
  Modo varios: el mismo % o valor **por línea** a cada atleta (§15.7).
- `p_payment`: `{method: 'cash'|'transfer', payment_date (≤ hoy), reference? (→ payments.receipt_number en cada fila),
  receipt_url?, receipt_sha256?, ocr_reference?, ocr?: {ocr_amount, ocr_currency, ocr_date, ocr_bank, ocr_reference,
  ocr_provider, ocr_destination, ocr_destination_name, ocr_origin_name, ocr_time, ocr_raw_response, receipt_verdict,
  receipt_verdict_reasons, receipt_reference_norm, receipt_image_sha256, receipt_image_sha256_source}}`.
  `payments.reference` es UNIQUE: cada fila pagada recibe `CYP-<lote>-<n>` (si no tenía referencia). Hash y OCR solo en la
  fila de mayor pago (Q23).
- `p_overrides[]`: `{athlete: <id> | 'nuevo', line_idx, action: 'force'|'skip'}`; `force` solo vale para
  `seguro_en_12_meses` y `misma_linea_hoy`.
- `p_new_athlete`: `{kind: 'menor'|'adulto', full_name, guardian_phone, guardian_name?, doc_type?, doc_number?,
  date_of_birth?, allow_duplicate?}`; excluye `p_athletes`.

### 17.3 Salidas

- **preview**: `{mode, actor_role, athletes[], items[], pending[], skipped[{athlete, athlete_name, line_idx, reason}],
  errors[{ref, code, detail?, max?}], rows_to_create, total_amount, by_category{cat:{n,total}}, to_create{n,total},
  to_pay{n,total}, discounts{total, by_reason}, late_fee_waived, exonerated{n,total}, warnings_count{sin_acudiente},
  preview_hash, duplicates?[]}`. Cada ítem trae `ref`, `amount_before`, `list`, `disc`, `late`, `amount` (después),
  `pay_amount`, `status` resultante (`pending|paid|partial|cancelled`), `adjustments[]` en orden (origen, basis, pct,
  monto, alcance, motivo: las etiquetas), `existing_adjustments[]` (pendientes), `warnings[]` (`sin_acudiente`,
  `sin_inscripcion_activa`, `pausado`, `mes_pasado`, `mayor_de_edad`, `pago_en_curso`, `descuento_total_mayor_50`, y
  `seguro_en_12_meses` / `misma_linea_hoy` cuando se forzaron) y `skip_reason`.
- **create**: `{batch_id, duplicated, rows_created, total_amount, payment_ids[], paid_ids[], partial_ids[],
  adjustments[], skipped[], payments_registered, paid_total, new_athlete: {table, id} | null}`; repetido:
  `{batch_id, duplicated: true, rows_created, total_amount}`.
- **annul**: `{annulled, annulled_ids[], kept[{payment_id, status}]}`.
- **revert**: `{payment_id, reverted_id, reversion_id, amount_before, amount_after, status}`.
- `_find_athlete_duplicates(...)` → `(table_name, id, full_name, doc_masked, guardian, matched_by text[])` con
  `'doc' | 'nombre' | 'telefono'`; solo `'telefono'` = informativo (no bloquea).

### 17.4 Errores

`RAISE EXCEPTION '<CÓDIGO>: <mensaje>'`, ERRCODE `P0001` (salvo `FORBIDDEN` = `42501`). `DETAIL` lleva JSON:
`ATLETA_DUPLICADO` → `{code, matches[]}`; `PREVIEW_STALE` → `{code, preview_hash}`; error por línea → `{code, errors[]}`.
Códigos: `FORBIDDEN`, `ESCUELA_NO_OPERATIVA`, `DATOS_INVALIDOS`, `TOPE_EXCEDIDO`, `ATLETA_AJENO`, `MULTI_NO_PAGA`,
`PREVIEW_STALE`, `ATLETA_DUPLICADO`, `EN_REVISION`, `COBRO_CAMBIO`, `COBRO_CERRADO`, `PAGO_EN_CURSO`, `DESCUENTO_EXCEDE`,
`SOBREPAGO`, `EXONERACION_CON_PAGO`, `MOTIVO_REQUERIDO`, `SIN_RECARGO`, `EXCEDENTE_NO_DISPONIBLE`, `ANNUL_STALE`,
`YA_REVERTIDO`, `AJUSTE_NO_REVERSIBLE`, `PLAN_DIVERGE` (interno: lo escrito no coincide con lo planificado). Un `23505`
del índice de período en el `INSERT` revierte todo (409).

### 17.5 Desvíos del spec (decididos en F1)

1. `v_payment_adjustments_familia` **no** es `security_invoker` (con la RLS de finanzas la familia vería 0 filas): es una
   vista con dueño `postgres` y `security_barrier` que filtra por `auth.uid()` (patrón `v_school_staff_publico`). No se crea
   `padj_select_family`.
2. CHECK de `payment_adjustments.charge_batch_id`: `origin <> 'modal' OR kind = 'reversion' OR charge_batch_id IS NOT NULL`
   (los automáticos de `open_month` y el pronto pago nacen fuera de un lote).
3. Militar: `reason_code = 'convenio'` + `reason_text = 'Descuento Fuerza Militar'` (el catálogo no tiene `militar`).
4. Pronto pago: el ajuste (`applies_to = 'pago'`) se escribe cuando el cobro queda `paid` con ese valor, no al declararlo.
5. Triggers `BEFORE` nombrados `trg_zzz_…` para correr después de `trg_zz_guard_payments_client`.
6. Nuevo trigger `trg_zzz_payments_rebase_list_amount`: si un escritor ajeno (cambio de plan en `students.ts`,
   «Registrar pago» viejo) cambia `amount` sin tocar lista/descuentos/recargo, `list_amount` se re-basa y el invariante se
   mantiene.
7. **H7 no se aplica en F1**: `ParentCheckoutPage.tsx:438` y `recurring-charges.service.ts:155` insertan cobros de adultos
   sin `user_id` (caminos vivos). Rama aparte: estampar `user_id` en esos dos caminos y después el trigger.
8. Push: en vez de reescribir `fn_trigger_push_on_notification` (tiene un secreto en el cuerpo) se agregó
   `WHEN (NEW.push IS DISTINCT FROM false)` a `trg_push_on_notification` y `trg_enqueue_notification_delivery`.
9. Guardia: además de lo pedido, `sibling_discount_applied` en INSERT de no-staff (D13) y `list_amount` en INSERT de
   staff navegador. `one_time_fee_id` queda para F4 (la columna no existe).
10. Abono: `payment_installments` solo si el cobro tiene `parent_id` o `user_id` (`installment_owner_check`).
11. `revert_payment_adjustment` solo revierte ajustes `origin = 'modal'`; los automáticos se cambian en su origen.
12. Excedente: además de crearlo, solo el owner lo descuenta, condona, exonera o revierte (también en las RPC internas).
