# Facturación SaaS multi-rol con comprobante y validación — plan (sin ejecutar)

**Estado:** ⚪ plan escrito, sin aprobar. Nada de esto se aplicó.
**Fecha:** 2026-08-31 · **Pedido por:** usuario, en la misma sesión que cerró el bug de
facturación mensual de GYM RM.

## 0. Qué se pidió

Que todos los roles con un servicio en la plataforma — **escuela (owner/admin),
`wellness_professional`, `store_owner`, `organizer`, `facility_manager`,
`personal_trainer`** — puedan pagarle a SportMaps su mensualidad SaaS subiendo un
comprobante, y que el `super_admin` lo valide desde su panel. El ciclo lo sigue
disparando el `super_admin` (activar/generar factura), igual que hoy con las
escuelas — esto no cambia quién arranca el cobro, solo agrega cómo se paga.

**Dirección futura, no en el alcance de este plan:** un agente de IA en WhatsApp
terminará operando este flujo completo (activar, recordar, recibir comprobante,
validar). No se construye acá, pero el diseño de abajo evita acoplar la lógica a
una UI específica — todo pasa por RPCs que un canal de WhatsApp podría invocar
después, igual que ya hace `wa_verify_otp`/`wa_get_payment_status` con el otro
motor de pagos.

## 1. Estado actual — verificado en el repo, no supuesto

### 1.1 Lo que existe hoy para escuelas (`school_subscriptions` / `school_subscription_invoices`)
Motor completo pero **100% manual y sin comprobante**: el `super_admin` activa,
genera la factura ($ negociado o de catálogo), la envía, y **marca pagada a mano**
— no hay upload de comprobante en ningún lado de este flujo. Confirmado
columna por columna: `school_subscription_invoices` no tiene `receipt_url`,
`ocr_*`, `verdict` ni nada parecido.

RLS ya deja un camino abierto: **el admin de la escuela ya puede LEER sus propias
facturas** (`school_subscription_invoices_select` permite `is_school_admin(school_id)
OR is_super_admin()`), pero **no puede escribir nada** — todo INSERT/UPDATE pasa
por RPCs `SECURITY DEFINER` limitadas a `super_admin`/`service_role`.

### 1.2 El motor de comprobantes de padres→escuela — por qué NO se puede reusar tal cual
Vive pegado a `public.payments`, con columnas literales `parent_id`, `child_id`,
`school_id`, `team_id` — sin `owner_type`/`owner_id` ni `payer_id`/`payee_id`
genéricos. `payment_glosas` denormaliza `school_id` directo. Cada RPC
(`create_glosa`, `resolve_glosa`, `auto_approve_payment`, `reconcile_statement`)
asume ese único par pagador/receptor y activa `enrollments` al aprobar — lógica
que no aplica a "escuela paga a SportMaps".

**Lo que SÍ es reusable, porque es lógica pura sin acoplar a `payments`:**
- `bff/src/services/ocr.service.ts` — extracción con Groq/OpenAI/Gemini en cadena de fallback. Recibe una imagen, devuelve monto/fecha/banco/referencia — no toca la base.
- `bff/src/services/receipt-verdict.ts` — motor de reglas puro (`evaluateVerdict`), sin I/O. Los 9 chequeos (monto, fecha, duplicado, destino, formato de referencia) sirven igual para cualquier receptor, solo cambian los datos que le pasás.

**Lo que NO se reusa, hay que construir análogo:** `payment_glosas`, las RPCs de
glosa/auto-aprobación, y `receipt-context.service.ts` (que hoy resuelve cuentas
destino desde `school_settings` específicamente).

### 1.3 El patrón `owner_type`/`owner_id` — la base correcta para esto
Ya existe y ya es multi-rol, usado por el módulo contable (`expenses`, `budgets`,
`suppliers`, `payroll_*`, `electronic_invoices`, la vista `cash_ledger`):

```sql
can_manage_finances(p_owner_type text, p_owner_id uuid)
  'school'    -> is_school_admin(p_owner_id)              -- escuelas Y venues/gym (facility_manager)
  'vendor'    -> vendor_profiles.id = p_owner_id AND vendor_profiles.user_id = auth.uid()
  'organizer' -> p_owner_id = auth.uid()                   -- el organizador ES el usuario
```

Mapeo de los roles pedidos a `owner_type`:

| Rol pedido | `owner_type` | Entidad real |
|---|---|---|
| escuela (owner/admin) | `school` | `schools.id` — ya cubierto hoy |
| `facility_manager` | `school` | Un venue/gym **ya es** una fila de `schools` — ya cubierto hoy, cero trabajo nuevo |
| `wellness_professional` | `vendor` | `vendor_profiles.id` (`vendor_type='wellness'`) |
| `store_owner` | `vendor` | `vendor_profiles.id` (`vendor_type='store'`) |
| `personal_trainer` | `vendor` **o** `school` | ⚠️ **doble camino real, hay que decidir cuál** — ver `D-FAC-3` |
| `organizer` | `organizer` | `auth.users.id` directo — **no tiene tabla de perfil propia** |

### 1.4 Lo que NO existe para ninguno de los roles nuevos
`vendor_profiles` (wellness/store/parte de personal_trainer) tiene **cero**
columnas de plan/tier/suscripción — solo `commission_rate` (comisión de
marketplace, no cuota SaaS). `organizer` no tiene tabla de perfil. Ninguno de
los dos tiene hoy ningún concepto de "cuánto le debe a SportMaps".

### 1.5 El tarifario oficial — `sportmaps-combinaciones-modulos (2).xlsx`

Verificado línea por línea (5 hojas: Tarifario Oficial, Parámetros, Combinaciones,
Unit Economics, Cotización FE). Esto **no es negociación puntual como GYM RM** —
es el precio de lista real, vigente, del que la comercial cotiza.

**Catálogo base de escuela** (`Free Start $0 · Start $69k · Crecimiento $99k ·
Pro $159k ⭐ · Elite $349k`) — **coincide exactamente, centavo a centavo, con lo
que ya está hardcodeado hoy** en `generate_school_subscription_invoice()`
(`'start': 6900000, 'crecimiento': 9900000, 'profesional': 15900000, 'elite':
34900000`). El catálogo de escuela no cambia — ya está bien.

**Módulos adicionales (tier Pro) — el catálogo real para los roles nuevos:**

| Módulo | Precio/mes | Mapea a |
|---|---|---|
| Coach Pro | $99.000 | `personal_trainer` |
| Wellness Pro | $149.000 | `wellness_professional` |
| Marketplace Pro | $199.000 | `store_owner` |
| Servicio Pro | $109.000 | rol "servicios" genérico (wellness/consultorio no clínico) |
| Organizador Pro | $249.000 | `organizer` |
| Federación Pro | $549.000 | variante de `organizer` para ligas/federaciones |

Confirma y corrige lo que había sacado de la landing (`sportmap-maps-landing-page`):
esos números SÍ coinciden con la landing en varios casos (Coach $99k, Wellness
$149k, Organizador $249k) — la landing es un derivado de venta de este mismo
tarifario, no una fuente independiente. Donde había ambigüedad (`store_owner`
→ ¿"Proveedores" o "Marcas"?) el tarifario la resuelve: es **"Marketplace Pro"
($199k)**, ni Proveedores ni Marcas — nombre distinto en cada lado, mismo
concepto.

**⚠️ Lo que cambia el diseño de fondo — descuento automático por combo, no
precio plano por rol:**

Estos "módulos" no son necesariamente cuentas separadas de personas distintas
— son **capacidades que un mismo pagador puede combinar**, y la combinación
tiene descuento automático y no negociable:

```
2 módulos: 16%   ·   3: 26%   ·   4: 30%   ·   5: 33%   ·   6: 36%   ·   7: 40%
Precio final SIEMPRE redondeado a terminar en 9.000.
```

La hoja "Combinaciones" tiene las **120 combinaciones posibles** ya calculadas
(de 2 a 7 módulos, incluyendo o no "Escuela" como uno de ellos) — por ejemplo
"Coach + Wellness" = $209.000/mes (16% sobre $248.000), o "Escuela + Coach +
Organizador + Federación" = $739.000/mes (30% sobre $1.056.000). Varias ya
tienen nombre de venta publicado: "Clínica Deportiva" (Wellness+Servicio),
"Academia 360°" (Escuela+Organizador+Marketplace), "Federación Completa"
(Organizador+Federación).

**Consecuencia real para F1:** el modelo de datos no puede ser "una fila de
suscripción con un `plan_code` y listo" para los roles nuevos — necesita un
**catálogo de módulos activables por `owner_id`** (muy parecido a como ya
funciona `school_addons`, que ya tiene la forma correcta: `addon_key` +
`enabled`) y una función que **sume los módulos activos, aplique el % de
descuento de la escalera, y redondee a 9.000** — no una tabla de precios fija
por rol. Esto es más grande que "portar un catálogo": es una funcionalidad de
pricing nueva. Se resuelve en su propio punto de F1, no como un simple mapeo.

**Lo que NO cambia:** el override sigue siendo `custom_price_cents` — un trato
como GYM RM (o cualquier combo con descuento especial) sigue pudiendo saltarse
todo este cálculo con un número fijo a mano, exactamente como ya funciona hoy.

## 2. Decisión de arquitectura

**`school_subscriptions` y `school_subscription_invoices` se generalizan a
`owner_type`/`owner_id`**, mismo patrón que el módulo contable — no se inventa
uno nuevo. `school_id` deja de ser la única llave; para las filas existentes
(escuelas reales) `owner_type='school'`, `owner_id=school_id` — dato idéntico,
solo cambia el nombre de la columna y el tipo de índice. Renombrar las tablas
queda fuera de alcance (es solo ruido); se agregan las columnas nuevas y se
deja `school_id` como caso particular de `owner_id` para `owner_type='school'`
mientras dure la migración de datos, o se resuelve directo con las columnas
nuevas — a decidir en el plan de F1, no acá.

El comprobante y su validación se construyen como **estructura nueva, análoga
al motor de padres→escuela pero no acoplada a él**: nuevas columnas en la
tabla de facturas (`receipt_object_path`, `ocr_*`, `verdict`, nuevo status) +
una tabla de objeciones propia si hace falta glosa (a definir en F1, puede que
al volumen bajo de este flujo ni haga falta la complejidad de glosa completa).

## 3. Fases

### F0 — Decisiones de producto — ✅ CERRADAS el 2026-08-31

| ID | Decisión | Respuesta |
|---|---|---|
| ~~**D-FAC-1**~~ | ¿Catálogo de precios o 100% negociado? | ✅ **CORREGIDO DOS VECES — hay una fuente única y oficial, con un mecanismo que no estaba en el plan.** No es la landing (esa es un derivado de venta, ver abajo): la fuente real es `C:\Users\Usuario\Pictures\equipos\sportmaps-combinaciones-modulos (2).xlsx`, hoja **"Tarifario Oficial"** — literal: *"Regla de oro: se cotiza SOLO desde esta hoja"*. Ver §1.5 abajo, cambia el diseño de F1. |
| ~~**D-FAC-2**~~ | ¿`organizer` entra ahora, sin tener tabla de perfil? | ✅ **Sí, entra — y hay que terminarlo.** No existe tabla de perfil para `organizer` todavía; construirla (o decidir que la suscripción cuelga directo de `auth.users.id`, como ya soporta `can_manage_finances`) es parte de esta F1, no un futuro aparte. |
| ~~**D-FAC-3**~~ | `personal_trainer`: ¿cuál camino es el vigente? | ✅ **Aclarado, con un cabo suelto real.** El PT (entrenador personal **independiente**) es `owner_type='vendor'` — entidad única, se le cobra. El **coach de escuela** (staff de una escuela, vía `school_staff`) es otra cosa completamente distinta y **no se le cobra aparte** — su costo ya está dentro de la cuota de la escuela. ⚠️ **No existe hoy ningún mecanismo de "un coach de escuela pasa a ser PT independiente"** (confirmado por grep, cero resultados) — el usuario mismo no tiene claro cómo se resolvería esa transición. **No se construye en esta F1**: si un coach hoy quiere facturar aparte como PT, se le crea una fila nueva en `vendor_profiles` a mano (proceso manual, como se hace hoy con cualquier vendor), no una migración automática de coach→PT. |
| ~~**D-FAC-4**~~ | ¿Glosa completa o aprobar/rechazar simple? | ✅ **Aprobar/rechazar simple.** "No es relevante ahora para nosotros como super admin" — sin ciclo de objeción/respuesta. Si en el futuro el volumen lo justifica, se agrega glosa encima sin romper lo que se construya ahora (mismo patrón: estados nuevos en el `CHECK`, no una tabla que haya que migrar). |
| ~~**D-FAC-5**~~ | ¿A qué cuenta se sube el comprobante? | ✅ **La misma que ya sale en el PDF de factura** (`loadActivePaymentAccounts()`) — sin config nueva. **Además, idea nueva del usuario, ver §3.5**: integrar Wompi para que además de comprobante manual se pueda pagar por pasarela. |

### 3.5 — Idea nueva: pagar por pasarela (Wompi), no solo comprobante manual

El usuario planteó, al resolver D-FAC-5, sumar un camino de pago **por pasarela**
además de subir comprobante — y de paso preguntó por tokenizar tarjetas para que
los padres también paguen automático a cada escuela. **Son dos cosas distintas,
importante no mezclarlas:**

1. **SportMaps cobrando por Wompi a quien le paga a SportMaps** (escuela/vendor/
   organizer) — esto SÍ es parte natural de este spec, F2.5 más abajo. Ya existe
   `bff/src/services/wompi.service.ts` y una `WOMPI_PRIVATE_KEY` a nivel de
   ambiente en `bff/.env` — es decir, **ya hay una credencial de Wompi que
   SportMaps podría usar como comerciante propio**, sin depender de que cada
   escuela tenga su cuenta conectada (eso es para OTRO flujo, ver punto 2).
   Falta verificar si esa key es realmente "la cuenta de SportMaps" o un
   fallback genérico — confirmar antes de F2.5.

2. **Que cada padre guarde su tarjeta y le cobre automático a la escuela**
   (autopay/tokenización padre→escuela) — esto **ya existe como iniciativa
   separada y parcialmente construida** (`recurring_subscriptions`,
   `save_payment_token`, memoria `project_recurring_charges_status`: hoy
   **solo MercadoPago** soporta cobro recurrente real, Wompi está bloqueado
   porque falta la API `payment_sources` del lado del proveedor — no es un
   límite del código, es un límite comercial/de contrato con Wompi). **No es
   parte de este spec** — es el track `DIN-6`/`BLQ` de connected accounts que
   ya tiene ~85% de avance documentado en memoria. Si se quiere retomar,
   es su propio ítem de roadmap, no se resuelve acá.

**F2.5 (agregada a las fases de abajo):** una vez F1/F2/F3 (comprobante manual)
estén andando, agregar como alternativa "pagar ahora por Wompi" en el mismo
panel de quien paga — reusa `wompi.service.ts` tal cual está, solo cambia qué
tabla se marca `paid` al confirmar el webhook (`school_subscription_invoices`
en vez de `payments`/`orders`).

### F1 — Base de datos
- **Motor de precio por combo de módulos** (nuevo, ver §1.5): catálogo de
  módulos con su precio de lista (Coach/Wellness/Marketplace/Servicio/
  Organizador/Federación Pro), tabla de módulos activos por `owner_id` (mismo
  patrón que `school_addons`), y una función que sume + aplique la escalera de
  descuento (16/26/30/33/36/40%) + redondee a terminar en 9.000. Este cálculo
  alimenta el `amount_cents` que hoy en escuelas sale de un `CASE` fijo.
- Generalizar `school_subscriptions`/`school_subscription_invoices` a
  `owner_type`/`owner_id` (según lo que resuelva D-FAC-1..3).
- Agregar columnas de comprobante a la tabla de facturas: `receipt_object_path`,
  `ocr_amount`, `ocr_date`, `ocr_bank`, `ocr_reference`, `verdict`,
  `verdict_reasons`, y un status nuevo (`awaiting_approval`, igual que
  `payments`) en el `CHECK` existente.
- RLS: quien puede `can_manage_finances(owner_type, owner_id)` gana un INSERT
  acotado (solo puede escribir las columnas de comprobante de SU factura, no
  cambiar `amount_cents` ni `status` directo — eso lo hace la RPC de
  aprobación).
- Nueva RPC `submit_subscription_invoice_receipt(...)` — SECURITY DEFINER,
  valida `can_manage_finances`, guarda el comprobante, deja el status en
  `awaiting_approval`.
- Bucket de Storage para estos comprobantes (nuevo o reusar `payment-receipts`
  con prefijo distinto — a decidir).

### F2 — BFF
- Endpoint de submit (llama a `ocr.service.ts` para extraer, corre
  `receipt-verdict.ts` adaptado con el contexto de esta factura, guarda el
  veredicto, invoca la RPC).
- Endpoint de aprobar/rechazar para el `super_admin` (marca `paid`/`rejected`,
  notifica a quien pagó).
- Sin glosa (D-FAC-4 cerrada en simple): el endpoint de aprobar/rechazar es
  corto, sin ciclo de objeción.

### F2.5 — Pago por pasarela (Wompi), alternativa al comprobante manual
Ver §3.5. Reusa `wompi.service.ts` sin tocarlo; el webhook marca `paid` en la
factura de este flujo en vez de `payments`/`orders`. Verificar primero si
`WOMPI_PRIVATE_KEY` en `bff/.env` es de verdad la cuenta comercial de
SportMaps antes de dar esto por listo para construir.

### F3 — Frontend
- Panel de quien paga: "lo que le debés a SportMaps" + subir comprobante — para
  `wellness_professional`/`store_owner`/`organizer`/`personal_trainer` esto es
  territorio nuevo (no tienen un `AdminSubscriptionsPage` propio); para
  escuela probablemente se cuelga de `MiPlanPage.tsx`, que ya existe.
- Cola de validación del `super_admin`: extender `AdminSubscriptionsPage.tsx` o
  un panel nuevo tipo `PaymentsAutomationPage.tsx` pero para este universo.

### F4 — QA + auditoría
Casos de prueba por rol, verificación de que un `vendor` no pueda ver ni tocar
facturas de otro `vendor_id`, ni de una `school`.

### F5 — Futuro, fuera de alcance ahora
Agente de WhatsApp que dispare recordatorios, reciba el comprobante por chat
(ya hay infraestructura de canal — `school_whatsapp_integrations`,
`wa_ingest_inbound_message`) y llame a las mismas RPCs de F1/F2.

## 4. Riesgos

- **`facility_manager` no necesita nada de esto** — ya es `owner_type='school'`
  de forma implícita porque un venue/gym es una fila de `schools`. Incluirlo en
  el alcance sin aclararlo genera trabajo redundante.
- **Sin D-FAC-1 resuelta, F1 no tiene qué facturar** — un rol sin catálogo ni
  precio negociado no tiene monto que generar.
- **Volumen bajo, pero mismo cuidado que con dinero real** — son pocas cuentas
  (decenas, no miles), pero cada una es un cobro real a un cliente/proveedor de
  la plataforma; aplica el mismo rigor que cualquier cambio de `payments`.
