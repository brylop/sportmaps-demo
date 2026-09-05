# Spec — Catálogo de Artículos Escolares (guayos, uniformes, accesorios)

**Producto:** SportMaps · **Versión:** v1.0 (borrador para revisión)
**Fecha:** Septiembre 2026
**Estado:** decisiones de producto propuestas — **pendiente de aprobación** antes de escribir migraciones (Fase 1).

> Se construye **por fases con revisión entre cada una**. Esta spec es la fuente de verdad;
> las decisiones abiertas quedan marcadas explícitamente en §9.

---

## 0. Principio rector — no es la Tienda/Marketplace, y no se funde con inscripción/mensualidad

Dos separaciones duras, por dos motivos distintos:

**(a) vs. Marketplace/Tienda** (`vendor_profiles`, `products`, addon `store` pago — ver `docs/specs` de marketplace):
| | **Tienda** (addon pago, ya existe) | **Artículos escolares** (este módulo) |
|---|---|---|
| Activación | Opt-in pago desde `/mi-plan` ($49k/mes) | Incluido, gratis, toggle simple en config |
| Catálogo | Rico: fotos, variantes, inventario, envíos, reviews | Liviano: nombre, precio, talla en texto, **sin fotos obligatorias** |
| Dónde se compra | Vitrina pública `/tienda/:slug` | Dentro del mismo flujo de pago de inscripción/mensualidad |
| Vendedor | `vendor_profile` (school o externo) | No hay vendedor — es la escuela cobrando directo |

**(b) vs. inscripción y mensualidad** ([[project_inscripcion_once_then_mensualidad]]):
Inscripción (pago único al ingresar) y mensualidad (recurrente, generada por cron) son conceptos de pago **secuenciales y separados**. Artículos es un **tercer concepto**, independiente de los otros dos — nunca se suma al monto de inscripción ni de mensualidad, nunca reemplaza ninguno de los dos. Se ofrece *junto* a ellos (mismo momento/pantalla) pero genera **su propia fila** en `payments`.

**Reglas duras:** artículos no toca `products`/`vendor_profiles`/`stock_holds` · no hay `vendor_profile` de por medio · el descuento por pronto pago (`early_payment_discount`, exclusivo de mensualidad) no aplica a artículos.

---

## 1. Objetivo

Que una escuela pueda ofrecer a los padres artículos simples de compra (guayos, uniforme, medias, balón) **sin activar la Tienda completa**, aprovechando el mismo momento en que el padre ya está pagando inscripción o mensualidad — sin fricción de un checkout aparte.

**Problema:** hoy la única forma de cobrar esto es a mano, por fuera de la plataforma, o forzando al padre a escribir "Uniforme" en el campo de texto libre de `conceptType='otro'` ([PaymentCheckoutModal.tsx:969-973](../../frontend/src/components/payment/PaymentCheckoutModal.tsx#L969-L973)) sin catálogo, sin precio fijo, sin control de qué se vende.

---

## 2. Roles y permisos

| Rol | Puede |
|---|---|
| **Admin escolar** (`is_school_admin(school_id)`) | Activar/desactivar el módulo, crear/editar/desactivar ítems del catálogo |
| **Padre / atleta adulto que paga solo** | Ver el catálogo (solo ítems `active=true`), agregar al carrito, pagar |
| **Coach** | Sin rol en este módulo — no vende, no aprueba |

Lectura del catálogo: **miembro de la escuela** (`user_school_ids()` — es solo lectura, como manda la regla de las tres funciones de alcance). Escritura: solo `is_school_admin()`.

---

## 3. Modelo de datos

`text` + `CHECK` (no `CREATE TYPE`), FK de negocio a `public.schools(id)`, sin variantes estructuradas en v1 (tallas como texto libre).

```sql
-- 1. Catálogo
CREATE TABLE public.school_merchandise_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name          text NOT NULL,
  description   text,
  price         numeric(12,2) NOT NULL CHECK (price >= 0),
  size_options  text,               -- CSV libre, ej. "S,M,L,XL" — NULL si no aplica talla
  price_by_size jsonb,              -- opcional: {"S": 45000, "M": 50000} — override de `price` por talla.
                                     -- Columna reservada en Fase 1, SIN UI en Fase 2; se activa si la
                                     -- piloto confirma que el precio varía por talla (evita 2ª migración).
  image_url     text                -- opcional; v1 no construye upload, solo URL pegada a mano
                CHECK (image_url IS NULL OR image_url ~ '^https://'),
  active        boolean NOT NULL DEFAULT true,
  sort_order    int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 2. Toggle por escuela (mismo patrón que wompi_enabled)
ALTER TABLE public.school_settings
  ADD COLUMN merchandise_enabled boolean NOT NULL DEFAULT false;

-- 3. Categoría del pago — para que Finanzas pueda separar sin parsear texto
ALTER TABLE public.payments
  ADD COLUMN payment_category text
    CHECK (payment_category IS NULL OR payment_category IN ('mensualidad','inscripcion','articulos','otro'));
-- NULL en filas existentes; nuevas filas de cada flujo se estampan con su categoría
-- (retro-poblar mensualidad/inscripcion queda fuera de v1 — no es necesario para el filtro de artículos).
```

> **Estampado obligatorio en el mismo PR de Fase 1** (no queda para "después"): además de crear la
> columna, hay que tocar los puntos donde HOY se insertan filas de mensualidad/inscripción para que
> escriban `payment_category` desde el día uno — si no, Fase 4 filtra "artículos" contra un fondo de
> filas nuevas de mensualidad/inscripción sin categoría, y un bug de estampado ahí queda invisible.
> Puntos a tocar: `generate_monthly_charges()` (cron, mensualidad), `enrollmentBilling.ts`
> `createPendingPayment` (inscripción), y los 3 caminos de insert propios de
> `PaymentCheckoutModal.tsx` (wompi/`openCheckout`, MercadoPago/`handleMpSuccess`,
> transferencia-manual/`processPayment`) — cada uno estampa `payment_category` según `conceptType`.

**RLS (`school_merchandise_items`):**
- `SELECT`: `active = true AND school_id = ANY(user_school_ids())` **OR** `is_school_admin(school_id)` (admin ve inactivos también, para editar).
- `INSERT/UPDATE/DELETE`: solo `is_school_admin(school_id)`.
- Ninguna policy usa `USING(true)` ni alcanza a `anon` — catálogo es privado a miembros de la escuela, no público (a diferencia de la vitrina de Tienda).

**GRANT:** `SELECT` a `authenticated` (filtrado por RLS), `INSERT/UPDATE/DELETE` a `authenticated` (filtrado por RLS a admin). Nada a `anon`.

---

## 4. Flujo del padre

Se extiende `PaymentCheckoutModal.tsx`, **sin modal nuevo**:

1. Nuevo `conceptType: 'articulos'` en el selector de "Estado 3: Formulario" ([línea 948-1000](../../frontend/src/components/payment/PaymentCheckoutModal.tsx#L948-L1000)) — visible solo si `school_settings.merchandise_enabled = true` y hay ≥1 ítem activo.
2. Lista de ítems con checkbox + stepper de cantidad + talla (select si `size_options` no es null). Subtotal en vivo.
3. Al confirmar, arma `finalConcept` = `"Artículos escolares: Guayos talla 38 x1, Uniforme talla M x1"` (mismo patrón que hoy arma `finalConcept` para inscripción) y `finalAmount` = suma. Crea la fila en `payments` con `payment_type: 'one_time'`, `payment_category: 'articulos'`, `period_year/period_month: NULL`.
4. De ahí en adelante, **el mismo flujo de pago ya existente** (transferencia + comprobante, o Wompi si la escuela lo activó) — cero código nuevo de cobro. El descuento por pronto pago se excluye explícitamente para este `conceptType` (no es mensualidad).
5. Al quedar el pago en `awaiting_approval` (transferencia) o `paid` (online), se notifica al admin igual que hoy se notifica el comprobante de mensualidad ([PaymentCheckoutModal.tsx:700-737](../../frontend/src/components/payment/PaymentCheckoutModal.tsx#L700-L737), vía `notify_user`) — mismo mecanismo, mensaje adaptado a "Pedido de artículos por validar". Esto queda en el alcance de Fase 3, no pendiente.

**Puntos de entrada:**
- Botón "Agregar artículos" junto al botón de pagar mensualidad en `MyPaymentsPage`/`AthletePaymentsPage`.
- Como opción del selector `conceptType` cuando el padre ya abrió el modal en modo `create` (mismo lugar donde hoy elige inscripción/otro).

No se combina en una sola transacción con la mensualidad/inscripción: son cobros separados, el padre puede pagar uno, otro, o ambos en la misma sesión.

---

## 5. Flujo del admin

Pantalla nueva y simple (cerca de `PaymentsAutomationPage.tsx`, mismo patrón de `feature-detect` + `upsert` por `school_id` que ya usa `payment_accounts`):
- Toggle "Vender artículos a los padres" → `merchandise_enabled`.
- Tabla CRUD: nombre, precio, tallas (texto libre separado por comas), imagen (campo URL opcional), activo/inactivo, orden.
- Sin wizard, sin pasos, sin fotos obligatorias — un formulario simple.

---

## 6. Fuera de alcance v1 (explícito)

- Control de stock/inventario (si se agota, la escuela lo maneja fuera de la plataforma — igual de manual que hoy).
- Variantes estructuradas (talla como fila propia con su propio precio) — talla es texto informativo, mismo precio para todas.
- Upload de fotos con storage propio — solo URL pegada a mano, opcional.
- Envíos — retiro es siempre en la escuela.
- Descuentos/cupones sobre artículos.
- Reviews o Q&A.
- **Estado de entrega física** (¿ya le dieron el uniforme al padre?): el módulo captura el pago, no la logística de entrega. No hay tabla ni estado `entregado`/`pendiente_entrega` en v1 — la escuela reconcilia entrega fuera de la plataforma, igual que hoy.

Si una escuela necesita algo de esta lista, el camino es migrar al addon `store` real (Tienda completa), no crecer este módulo hacia el marketplace.

---

## 7. Reportes / Finanzas

**El dinero de artículos SÍ es ingreso real de la escuela — no se oculta.** El riesgo no es que
desaparezca, es que hoy se **fusiona sin etiqueta** con mensualidad/inscripción en los tres lugares
donde se agrega plata, porque ninguno agrupa por concepto — solo filtran por `status`:

| Reporte | Dónde | Qué agrega hoy |
|---|---|---|
| Contabilidad / P&L / Estado de resultados | vista `cash_ledger` (`20260707000001_cash_ledger_real_amounts.sql:41-51`), leída por `AccountingPage.tsx:102` y `AccountingReportsPage.tsx:38` | Todo `payments` con `status IN ('paid','partial')` por `school_id`, sin categoría |
| Gestión de Pagos ("Ingresos Totales") | RPC `school_payment_kpis()` (`20260730000005_school_payment_kpis.sql:52-98`) | `SUM` sobre `payments` filtrado solo por `school_id`/`branch_id` |
| Dashboard ("Ingresos del mes") | `useDashboardStatsReal.ts:99-132` | Query directa a `payments` del mes, sumada en el cliente |

**Cambios necesarios en la MISMA Fase 1 (no en Fase 4 — sin esto la columna `payment_category` no sirve de nada):**
- `cash_ledger`: agregar `p.payment_category` al `SELECT` — hoy no expone ninguna categoría de ingreso (solo `category_id` de egresos). Habilita agrupar el P&L por Mensualidad/Inscripción/Artículos en vez de un solo "Ingresos".
- `school_payment_kpis()`: agregar `revenue_articulos` (o `revenue_by_category` jsonb) junto a `revenue_total` — el total NO se toca (sigue siendo toda la plata recibida), pero la parte de artículos queda visible aparte en la tarjeta de Gestión de Pagos.
- `useDashboardStatsReal.ts`: mismo criterio, prioridad menor (tarjeta resumen, no estado financiero) — puede quedar para una iteración posterior sin bloquear Fase 1.

Precedente ya documentado del mismo problema: [[project_math_audit_census]] (C-02, dashboard vs Gestión de Pagos ya divergen hoy sin artículos de por medio) y [[project_payment_type_not_reliable]] (hoy la única forma de separar conceptos es parsear texto — `payment_category` la reemplaza).

### 7.1 Censo completo de caminos que crean `payments` (2026-09-03)

Al verificar Fase 1 en vivo apareció un pago real sin categoría que no venía de ninguno de los 3 caminos estampados — investigarlo llevó a un censo completo de TODO lugar del código que hace `INSERT INTO payments`. Detalle completo en [[project_payment_creation_paths_census]]. Resumen:

**Estampados en Fase 1 (4):** `open_month()` → mensualidad · `chargeRegistrationFeeIfApplicable()` (students-create-one.route.ts) → inscripcion · `createPendingPayment()` (enrollmentBilling.ts) → mensualidad · `PaymentCheckoutModal.tsx` (4 inserts) → según conceptType.

**Sin estampar, pendientes para Fase 4 (9):**

| # | Camino | Categoría sugerida |
|---|---|---|
| 5 | `generate_qr_monthly_charge()` RPC — auto-cobro QR | mensualidad |
| 6 | `submit_qr_signup()` RPC — primer cobro al inscribirse por QR | mensualidad |
| 7 | `RegisterCashPaymentModal.tsx` — admin registra efectivo/transferencia a mano | mensualidad/otro (según `isMonthlyConcept(concept)`, ya existe en el archivo) |
| 8 | `recurring-charges.service.ts` (BFF) — autopay MercadoPago | mensualidad |
| 9 | `attendance.ts POST /facturar-fuera-de-plan` — clases excedentes/vencidas fuera de plan | otro |
| 10 | `ParentCheckoutPage.tsx` — checkout standalone, gemelo de PaymentCheckoutModal | mensualidad/otro (mismo criterio que PaymentCheckoutModal) |
| 11 | `register_for_internal_tournament()` RPC — inscripción a torneo interno | otro (o categoría `torneo` propia a futuro) |
| 12 | `trial_class_self_create()` RPC — clase de prueba self-service | otro |
| 13 | `trial_class_public_create()` RPC — clase de prueba, prospecto público | otro |

**Descartado:** `accept_invitation()` — insertaba pagos en versiones viejas (`20260225000039`), la versión vigente (`20260730231131`) ya no lo hace, delega la facturación a otro camino.

3 de los 9 (torneo, ambas trial class) no encajan bien en el `CHECK` actual de `payment_category` (mensualidad/inscripcion/articulos/otro) — quedan como `otro` por ahora; expandir el enum es una decisión de producto aparte, no bloquea Fase 4.

---

## 8. Fases de entrega

| Fase | Contenido |
|---|---|
| **1 — DB** | Migración: tabla catálogo + columna `merchandise_enabled` + columna `payment_category` + estampado en los 3 flujos existentes (§3) + **`cash_ledger` y `school_payment_kpis()` actualizados para exponer la categoría (§7)** + RLS + GRANT explícitos + `search_path` fijo. Correr `npm run seguridad:invariantes` después. |
| **2 — Admin UI** | Toggle + CRUD del catálogo. |
| **3 — Padre** | Extensión de `PaymentCheckoutModal` (`conceptType='articulos'`) + botón de entrada en `MyPaymentsPage`/`AthletePaymentsPage`. |
| **4 — Reportes** | UI: mostrar el desglose por categoría en `AccountingReportsPage`/`PaymentsAutomationPage` (el dato ya viene de Fase 1); opcional `useDashboardStatsReal`. |
| **5 — QA piloto** | Una escuela real, catálogo de 2-3 ítems, validar el flujo completo antes de abrir a todas. |

Una rama por fase, revisión entre cada una ([[feedback_phased_module_build]]).

---

## 9.5. Piloto Besser — cómo se activa sin ser addon formal

Decisión (2026-09-03): **sin mecanismo nuevo de gating.** `school_settings.merchandise_enabled`
(§3) ya nace en `false` para toda escuela — esa es la única barrera, no se suma ninguna whitelist
ni se toca el sistema de `school_module_overrides` (ese sistema asume "todo nace prendido, el
override apaga" — `useEntitlements.ts:389`, `moduleOverrides[key] !== false` — es el reverso de lo
que necesitábamos acá, y extenderlo fue evaluado y descartado por alcance/riesgo compartido con
los ~20 módulos que ya lo usan).

**Cómo se activa para Besser:** una vez la Fase 1-2 estén construidas, se prende el toggle
`merchandise_enabled` solo para Besser (a mano o desde el admin de Fase 2). No hay tabla
`school_addons` de por medio — sigue sin ser un addon comercial.

**Riesgo aceptado explícitamente:** la sección "Artículos escolares" en Configuraciones es visible
para CUALQUIER escuela que entre — el toggle está ahí, apagado, y nada impide que otra escuela lo
prenda ella misma antes de que se quiera ofrecer formalmente. Si eso deja de ser aceptable (ej. se
quiere ocultar la sección completa a quien no esté en el piloto), retomar la Opción B evaluada
(whitelist chica y aislada) — no la Opción C (extender `school_module_overrides`), descartada por
el motivo de arriba.

---

## 9. Decisiones de producto

**Resueltas (propuestas en esta spec, listas para construir salvo objeción):**
- Talla = texto libre CSV, no variantes estructuradas; `price_by_size` (jsonb) reservado en la tabla desde Fase 1 por si la piloto confirma que el precio varía por talla — sin UI hasta que haga falta, evita una 2ª migración.
- Sin fotos obligatorias; imagen opcional por URL con `CHECK` de formato (`^https://`), sin upload propio en v1.
- Fila de pago separada, nunca fusionada con inscripción/mensualidad; `payment_category` se estampa en TODOS los flujos (mensualidad/inscripción/artículos) en el mismo PR de Fase 1, no después.
- Gratis / incluido — no es addon pago (a diferencia de la Tienda).
- Pago único de contado en v1, sin abonos/cuotas sobre artículos (igual que inscripción hoy).
- Notificación al admin por pedido de artículos: en alcance de Fase 3, reutilizando `notify_user`.
- Estado de entrega física: explícitamente fuera de alcance (§6) — el módulo cobra, no reconcilia entrega.

**Pendiente real, sin resolver todavía:**
- Con el catálogo de 2-3 ítems de la piloto, confirmar que "un solo precio, con o sin talla" cubre el caso real antes de construir cualquier UI sobre `price_by_size` (la columna ya existe; construir su UI en Fase 2 sería adelantarse sin necesidad confirmada).

---

Relacionado: [[project_inscripcion_once_then_mensualidad]], [[project_school_store_addon]], [[project_equipment_dotacion]], [[project_math_audit_census]]
