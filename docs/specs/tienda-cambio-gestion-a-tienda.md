# Tienda dentro de la gestión: cambio de contexto "gestión → tienda"

**Fecha:** 2026-10-05 (rev. 2: alineada al rediseño del ROADMAP) · **Estado:** propuesta (sin código). **Mockup:** [`docs/mockups/tienda-gestion-a-tienda.html`](../mockups/tienda-gestion-a-tienda.html)
**Relacionado:** [`tienda-v2-estilo-mercadolibre.md`](tienda-v2-estilo-mercadolibre.md) (§2.1, §5.4, §6.5, §6.8), [`tienda-v2-contrato-checkout.md`](tienda-v2-contrato-checkout.md), [`../tienda-productos-flujo.md`](../tienda-productos-flujo.md), [`../qa/tienda-baseline-padre-2026-10-03.md`](../qa/tienda-baseline-padre-2026-10-03.md).
**Base de navegación (manda sobre esta propuesta):** [`../ROADMAP.md`](../ROADMAP.md) `UX-1`, `UX-3`, `UX-4`, `UX-14`, `UX-15`, `UX-16`, `ERP-6`, `MOV-4`; [`simplificacion-ux-dashboard-roles-2026-08-31.md`](simplificacion-ux-dashboard-roles-2026-08-31.md); mockup aprobado [F–K](https://claude.ai/artifact/TfcP5CCSnfMENFMnALery7).
**Fuentes del análisis:** código de `develop` (incluido lo sin commitear de tienda v2 F0) y las capturas de `docs/capturas/tienda-baseline/`. No se navegó dev de nuevo: las capturas del 10-03 ya cubren owner y padre, y el resto sale del código.

> **En una línea.** La tienda escolar se construyó como si la escuela fuera un vendedor externo más: un segundo panel (`/vendor/*`) colgado al final del menú, atado al *usuario* dueño y no a la *escuela*, con su propio dashboard, su propia bandeja de comprobantes y sus ventas fuera de los ingresos. Para el padre, comprar lo saca de la app. La propuesta no inventa navegación: mete la tienda en las pantallas que el rediseño ya aprobó. Para la escuela, **un destino del menú de `UX-4`/`ERP-6`** y **un tipo más de acción en "Hoy en tu escuela" (`UX-14`)**. Para la familia, **compras dentro de Pagos y la vitrina en Más**, sin tocar la barra de `UX-15` (§2).

---

## 1. Cómo funciona hoy (medido en el código)

### 1.1 Las piezas

| Pieza | Qué hace | Problema para el cambio de contexto |
|---|---|---|
| `config/navigation.ts` — árboles `school` y `school_admin` | Dos copias del menú de la escuela (Principal, Gestión Deportiva, Finanzas, Reportes, Documentos, Comunicación, Sedes, Cuenta) | **Ninguno de los dos tiene tienda.** Si se agrega, hay que tocarlo en los dos (ya divergieron antes con WhatsApp) |
| `getVendorNavGroup()` | Grupo "Mi Tienda": Panel Tienda, Productos, Inventario, Pedidos, Inbox, Liquidaciones, Envíos, Promociones, Verificación | Pensado para el vendedor externo. "Liquidaciones" (payout de SportMaps) y "Verificación" no aplican a la escuela (D-5: cobra con su pasarela; D-4: no se verifica) |
| `AppSidebar.tsx` (l. 118-145) | Agrega "Mi Tienda" **al final** del sidebar si `hasVendorProfile && hasAddon('store')` | Queda debajo de 8 grupos; en escritorio y móvil hay que hacer scroll y abrirlo |
| `useVendorProfile` / `VendorGuard` | Leen `vendor_profiles` con `.eq('user_id', auth.uid())` | El perfil de la tienda escolar es del **dueño** (`enable_school_store` lo crea con `user_id = schools.owner_id`). Un `school_admin` que no es dueño no tiene perfil |
| `ActivateStoreCTA` (solo en `DashboardPage`) | Único camino para abrir la tienda escolar: llama `enable_school_store` y navega a `/vendor/products` | Si el usuario lo cierra (`store_cta_dismissed`), no queda ningún camino visible. Para el `school_admin` reaparece siempre y lo manda a un bucle (ver 1.2) |
| `VendorDashboardPage` (`/vendor/dashboard`) | "Dashboard Vendedor — Gestiona tu presencia en el marketplace" | Segundo inicio. "Ingresos" está fijo en `'$0'` (l. 53). No ve nada de la escuela |
| `StoreOrdersPage` (`/orders`) | Pedidos con aprobar/rechazar comprobante, preparar, listo, entregado, efectivo | Bandeja buena, pero separada de los comprobantes de mensualidad (`/payments-automation` → Cobros → "Por aprobar") |
| Rutas `/products`, `/inventory`, `/categories`, `/customers`, `/promotions`, `/store-reports` | Rutas del rol legado `store_owner` | Conviven con `/vendor/products`, `/vendor/promotions`: dos pantallas de productos y dos de promociones. `/categories` y `/promotions` abren `StoreProductsPage`; `/customers` abre `StoreOrdersPage` |
| `StoreGate` / `useStoreEnabled` | Corte global `store_enabled()`, fail-closed | Correcto. Se mantiene igual en cualquier alternativa |
| `MiTiendaPage` (`/mi-tienda`) | Resuelve el slug de la escuela y **redirige** a `/tienda/:slug` | `/tienda/:slug`, `/carrito` y `/checkout/tienda/:id` son rutas **públicas fuera de `AuthenticatedLayout`** (App.tsx l. 350-403): el padre pierde el menú y la barra inferior |
| `TiendaPublicaPage` | Vitrina | Sale del shell; para volver solo hay "Mis compras" o el botón atrás del navegador |
| `MobileBottomNav` (padre) | Inicio · Hijos · Pagos · Chat | La tienda no está; "Pagos" (`/my-payments`) no muestra compras |
| Contabilidad | Las ventas emiten `commerce_sale` a `accounting_outbox` (mig. `20261003230016`), no a `cash_ledger` | `useDashboardStatsReal` ("Ingresos del Mes") y `/finances` leen `payments`: **la tienda no aparece en los ingresos** que ve la escuela |

### 1.2 Por actor

**Dueño de la escuela (owner), Monster´s Volley Club con el adicional Tienda**

| Tarea | Hoy | Clics |
|---|---|---|
| Descubrir que puede abrir la tienda | Solo la tarjeta `ActivateStoreCTA` en el dashboard. Si la cerró alguna vez, no hay más camino que la URL | 1 (si la ve) |
| Ir a la tienda ya abierta | Scroll del sidebar hasta el fondo → abrir "Mi Tienda" (colapsado) → "Panel Tienda" | 2 + scroll |
| Revisar "lo que hay que aprobar hoy" | Mensualidades: Finanzas (abrir) → Pagos → pestaña Cobros → filtro Por aprobar (4). Tienda: scroll → Mi Tienda → Pedidos → filtro (3+). **Dos bandejas, dos pantallas, 7+ clics** | 7+ |
| Ver cuánto vendió la tienda este mes | No está en "Panel de Escuela". En "Dashboard Vendedor" dice `$0` siempre | — (no existe) |
| Ver la venta en contabilidad | Contabilidad v2 la recibe por el outbox; Finanzas/Reportes y el KPI del inicio no | — |

Se pierde en: dos inicios con dos nombres ("Panel de Escuela" / "Dashboard Vendedor"), dos menús mezclados (rutas `/vendor/*` y rutas sueltas `/orders`, `/inventory`), ítems que no le aplican (Liquidaciones, Verificación), y el lenguaje de "marketplace" para lo que es la tienda de su club.

**Administrador de la escuela (`school_admin`, no dueño)**

La base lo autoriza (`can_manage_store` incluye `owner/admin/school_admin`), pero el frontend no:
1. `useVendorProfile` devuelve `null` (el perfil es del dueño) → no ve el grupo "Mi Tienda".
2. `ActivateStoreCTA` le aparece aunque la tienda ya esté abierta (`canSellProducts` es `false` para él).
3. Clic → `enable_school_store` (idempotente, responde bien) → navega a `/vendor/products` → `VendorGuard` no encuentra perfil por `user_id` → lo manda a `/vendor/onboarding`, **el alta de vendedor externo**. Bucle.
4. Solo llega a pedidos escribiendo `/orders` (la ruta sí lo admite por rol).

Es el actor que más opera la tienda en la práctica (secretaría/administración) y hoy es el que no puede entrar.

**Coach**

- `ActivateStoreCTA` lo considera elegible (`ELIGIBLE_ROLES` incluye `coach`) y lo manda a `/vendor/onboarding`: abre una tienda **personal**, no la del club. Eso puede ser correcto para un entrenador que vende servicios, pero hoy se le ofrece en el mismo lugar y con el mismo texto que a la escuela.
- No administra la tienda del club (D-15, correcto) y **tampoco puede comprar en ella desde el menú**: su árbol no tiene "Tienda". Si es padre a la vez, depende de con qué rol entró.

**Padre / acudiente (compra y además paga mensualidades)**

| Tarea | Hoy | Clics (móvil) |
|---|---|---|
| Entrar a la tienda | ☰ → abrir "Seguimiento" → Tienda → redirección a `/tienda/:slug` | 3 |
| Qué pasa al entrar | **Sale de la app**: sin menú lateral ni barra inferior (ruta pública) | — |
| Volver al inicio | Botón atrás del navegador o "Mis compras" | — |
| Pagar la mensualidad y una camiseta | Dos flujos, dos pantallas, dos comprobantes: `/my-payments` y `/checkout/tienda/:id` | 2 pagos separados |
| Subir comprobante | Mensualidad en Pagos; tienda en Mis compras → detalle | 2 lugares |
| Ver todo lo que pagó | "Pagos" (mensualidades) y "Mis compras" (tienda) por separado | 2 pantallas |

Se pierde en: la tienda escondida dentro de "Seguimiento" (junto a "Asistencias"), la salida del shell, y que "lo que le debo al club" y "lo que le compré al club" vivan en dos sitios con dos maneras de pagar.

**Atleta adulto**: su menú tiene "Tienda → Catálogo" que apunta a `/shop` (huérfano, mezcla productos de otras escuelas, B10), mientras el padre va a `/mi-tienda`. Mismo actor de compra, dos destinos.

**Vendedor externo (`external_vendor` → menú `store_owner`)**

Menú legado: Dashboard Vendedor, Mis Productos, Pedidos, Stock, Proveedores, Categorías, Clientes, Reportes, Promociones. Cuatro de esos ítems abren pantallas que no corresponden (Categorías y Promociones → lista de productos; Clientes → pedidos). Para él **sí** tiene sentido un panel propio de vendedor, porque la tienda es todo su negocio. Queda fuera del piloto (D-5), así que no es prioridad, pero el panel `/vendor/*` debe quedar como el de él, no como el de la escuela.

### 1.3 Los cinco problemas de fondo

1. **La tienda escolar cuelga del usuario, no de la escuela.** `useVendorProfile`/`VendorGuard` filtran por `user_id`; la base ya tiene `vendor_profiles.school_id` y `can_manage_store`. El frontend no los usa.
2. **Dos paneles para una sola escuela.** `/dashboard` y `/vendor/dashboard`, cada uno con su menú y sus números, sin cruzarse.
3. **Dos bandejas de aprobación** con el mismo trabajo (mirar un comprobante, aprobar o rechazar con motivo).
4. **Las ventas no llegan a los ingresos que la escuela mira** (inicio, Finanzas, Reportes). Solo a Contabilidad v2, que además es un adicional aparte.
5. **El padre sale de la app para comprar** y tiene pagos y compras separados.

---

## 2. Encaje con el rediseño del ROADMAP

La primera versión de esta propuesta (mismo día) diseñaba sobre el menú y las barras de **hoy**. El rediseño ya aprobado los cambia, así que la tienda se monta sobre él. Lo que cambia la base:

| Ítem | Qué fija | Choque con la v1 de esta propuesta | Cómo queda la tienda |
|---|---|---|---|
| `UX-14` (c, e) | Inicio del admin = **"Hoy en tu escuela"** con bandeja de acciones (por aprobar · nuevas esperando pago · vencidas · matrículas por revisar); barra móvil **Hoy · Deportistas · Pagos · Calendario · Más**; el banner de "Mi Tienda" deja de ser lo primero | La v1 creaba una pantalla nueva `/por-aprobar` y una fila de KPIs de tienda | **No hay pantalla nueva.** Los comprobantes de tienda entran a la tarjeta "Pagos por aprobar" de Hoy y a la pestaña **Pagos → Por aprobar** (vista G) como un tipo más, con chip de origen. Se agrega una sola tarjeta, **"Pedidos por entregar"**, visible solo con la tienda abierta. El recaudo del mes muestra el desglose Mensualidades / Tienda. `ActivateStoreCTA` deja de estar en el inicio (ver §5) |
| `UX-14` (a) | El indicador "Por aprobar" cuenta lo mismo que la lista | — | El contador suma `payments` por aprobar + `orders` `awaiting_approval` de la escuela, con la misma regla en indicador, lista, badge del menú y badge de la barra |
| `UX-4` + `ERP-6` | Menú de 36 a **24 destinos**, ningún grupo de más de 5; **"Finanzas" y "Proveedores" desaparecen** → `Pendientes · Movimientos · Contabilidad`; 12 pantallas pasan a pestañas | La v1 agregaba un grupo "Tienda" de 5 ítems al menú viejo, junto a "Finanzas" | Tienda ocupa **1 destino** dentro del grupo de dinero: **Pagos · Tienda · Pendientes · Movimientos · Contabilidad** (5, el máximo). Adentro, **5 pestañas**: Pedidos (por defecto) · Productos · Inventario · Ventas · Ajustes. Los 9 ítems de "Mi Tienda" se reparten así: Panel Tienda y Productos → Productos; Inventario → Inventario; Pedidos → Pedidos; Envíos y medios de pago → Ajustes; Liquidaciones, Verificación, Promociones e Inbox **salen** para la escuela (D-5, D-4, cupones fuera de v2, chat en F5) |
| `UX-15` (b, c) | Barra del acudiente **Inicio · Calendario · Hijos · Pagos · Más** (sin Chat ni Explorar); Pagos con secciones Por pagar / En revisión del club / Pagados | La v1 ponía Tienda y Chat en la barra y quitaba Calendario | **La barra no se toca.** La tienda vive en tres lugares: (1) **Pagos** se titula "Pagos y compras" y las compras entran en sus tres secciones aprobadas, más un bloque "Carrito de la tienda" solo si tiene productos; (2) **Más → "Tienda del club"**, primer ítem; (3) **Inicio**: tarjeta de una línea al final, después de los avisos, solo con tienda publicada. Justificación abajo |
| `UX-16` (a) | Botón flotante de soporte → **Más → Ayuda y soporte** | La vitrina y el carrito actuales conviven con el botón flotante, que tapa el "Pagar" en móvil (baseline §1 paso 5) | Las pantallas de tienda no llevan botón flotante; soporte queda en Más (acudiente y admin) y al pie del menú lateral |
| `UX-1` | `<PageShell>` (4 anchos) y `<PageHeader>` compacto | Las pantallas de tienda tienen cabeceras de ~110 px y anchos propios | Tienda, Pedidos, vitrina, carrito, checkout y Mis compras nacen sobre `PageShell`/`PageHeader` |
| `UX-3` | Gating por plan a nivel de ítem (hoy solo "Mi Tienda" mira `hasAddon`) | — | El ítem Tienda lleva `addon: 'store'` + `requiresStore`, igual que cualquier otro ítem; desaparece la lógica especial de `showVendorGroup` para la escuela |
| `MOV-4` | Solo tokens; nada de hex ni paleta Tailwind fija (rompe el white-label) | — | Las pantallas de tienda tienen hoy **~74 colores fijos** (`TiendaPublicaPage` 23, `OrderStatusBadge` 15, `VendorDashboardPage` 8, `MiCompraDetallePage` 7, `TiendaProductoPage` 6, `StoreCheckoutPage` 6, `MisComprasPage` 4, `StoreOrdersPage` 3, `CartContents` 2). Se pasan a tokens semánticos al mover cada pantalla; el mockup usa solo tokens |

**Por qué la tienda no gana pestaña en la barra del acudiente.** (1) `UX-15` la diseñó para lo que el acudiente hace cada semana: pagar y ver a su hijo. Comprar es ocasional (uniforme al inicio de temporada, una reposición). (2) Cambiar Calendario o Hijos por Tienda rompe una pantalla aprobada para servir a la acción menos frecuente; una sexta pestaña deja los rótulos en ~60 px en un teléfono de 360 px. (3) Lo que el acudiente sí necesita a diario de la tienda es **dinero**: qué compró, si el club aprobó el comprobante, qué le falta pagar. Eso cae en Pagos, donde ya mira. (4) El descubrimiento queda cubierto por la tarjeta del Inicio (al final, sin desplazar "Por pagar") y por Más. (5) La vitrina se abre **dentro** del shell, con Más marcado: el acudiente no pierde la barra, que hoy es el problema real.

**Orden en la cola.** La tienda no pide lugar propio en `ROADMAP §4`; cada pieza se monta en el ítem que la absorbe:

| Orden | Pieza de tienda | Va con | Lugar en la cola |
|---|---|---|---|
| 0 | **N0** — bug del `school_admin` que no es dueño | — (es un bug, no rediseño) | Ya; no depende de nada |
| 1 | `PageShell`/`PageHeader` en pantallas de tienda; gating del ítem por adicional | `UX-1` + `UX-3` | **§4 #12** (`UX-1 + UX-3 + ERP-1 + MOV-3`) |
| 2 | Comprobantes de tienda en Hoy y en Pagos → Por aprobar; tarjeta "Pedidos por entregar"; recaudo con desglose; barra del admin | `UX-14` | Sin número en §4 todavía; detrás de #12 porque monta sobre `PageShell` |
| 3 | Pagos y compras, Más → Tienda del club, vitrina dentro del shell | `UX-15` + `UX-16` | Igual que `UX-14` |
| 4 | Tienda como 1 destino con 5 pestañas en el menú definitivo; desaparece "Mi Tienda" de la escuela | `UX-4` + `ERP-6` | **§3.3 #13 / P3 de §4** ("juntos, o hay que tocar el menú dos veces") |
| — | Colores de tienda a tokens | `MOV-4` | Emparejado con `BLQ-6`; cada pantalla de tienda que se toque antes ya se escribe con tokens |

Mientras `UX-4`/`ERP-6` no lleguen, el ítem Tienda se agrega al menú actual (árboles `school` y `school_admin`) como un ítem suelto dentro de "Finanzas", no como grupo: así el día de `UX-4` solo se mueve una línea.

---

## 3. Alternativas

### A. Tienda como un destino más del menú de la escuela — **recomendada**

Lo descrito en §2: un ítem en el grupo de dinero, 5 pestañas adentro, sus pendientes en Hoy y en Pagos → Por aprobar, y el acceso decidido por **escuela** (`vendor_profiles.school_id = escuela activa` + rol owner/admin/school_admin), no por `user_id`. `/vendor/*` queda para vendedores externos y para quien vende por su cuenta (coach, profesional).

| Pros | Contras |
|---|---|
| Sin cambio de modo: lo pendiente de tienda está donde el admin ya mira (Hoy, Pagos) | El menú definitivo espera a `UX-4`/`ERP-6` (mitigado: un ítem suelto antes) |
| Cabe en el presupuesto de `UX-4` (1 destino; grupo de dinero en 5) | Hay que separar a la escuela de `VendorGuard` y de `getVendorNavGroup` sin romper a los externos |
| Arregla al `school_admin` sin migraciones (`can_manage_store` ya lo admite) | El contador de "Por aprobar" lee dos fuentes |
| Reusa `StoreOrdersPage`, `VendorProductsPage` y el wizard como pestañas | — |

### B. Selector "Gestión | Tienda" arriba del menú — descartada

Formaliza el cambio de modo y esconde lo pendiente del otro lado. Choca con `UX-14`: "Hoy en tu escuela" tiene que mostrar todo lo que necesita atención, tienda incluida.

### C. Panel `/vendor` aparte con mejores accesos — descartada

Mantiene 9 ítems de vendedor contra el objetivo de 24 destinos en total, dos inicios y dos bandejas: lo contrario de `UX-14` y `UX-4`.

---

## 4. Recomendación

**Alternativa A, montada sobre el rediseño.** La escuela no "cambia a la tienda": la tienda es un destino de su menú, sus comprobantes aparecen en la misma bandeja que las mensualidades y sus ventas en el mismo recaudo. El acudiente no "va a la tienda": ve sus compras donde ya paga y abre la vitrina desde Más, sin perder la barra.

### 4.1 Cómo llegan las ventas a contabilidad (con los nombres de `ERP-6`)

| Dónde | Qué se ve | Fuente |
|---|---|---|
| Hoy → recaudo del mes | Mensualidades / Tienda | `useDashboardStatsReal` + suma de `orders` cobradas del mes (`paid…delivered`, por `paid_at`) |
| Pagos → indicador "Recaudado en el mes" | Incluye tienda, con la cifra al pie | misma lectura de `orders` |
| Tienda → Ventas | Ventas por día y por producto, ticket promedio, IVA incluido | `orders` / `order_items` (RLS de vendedor) |
| Movimientos · Contabilidad (`ERP-2..6`) | Asiento `commerce_sale` (+ comisión y fee si > 0); reembolsos `commerce_refund` | `accounting_outbox` (ya construido en `20261003230016`) |
| Facturación electrónica | Factura de la orden, emisor = escuela | `orders_pending_invoice()` + cron |

Regla: el desglose en Hoy y Pagos es **lectura de `orders`**; no se copia a `payments` ni se abre otra rama en `cash_ledger` (el contrato de contabilidad v2 lo prohíbe). Cuando `ERP-5` lleve los cobros al mayor, la tienda ya llega por su propio evento.

---

## 5. Cambios concretos por archivo

| Archivo | Cambio | Ítem |
|---|---|---|
| `frontend/src/hooks/useSchoolStore.ts` (nuevo) | Lee el `vendor_profile` por `school_id = escuela activa` y dice si el usuario la administra (rol owner/admin/school_admin del `SchoolContext`; la base decide con `can_manage_store`) | N0 |
| `frontend/src/components/vendor/VendorGuard.tsx` | Si el usuario administra la tienda de su escuela, no redirige a `/vendor/onboarding`; quita los banners de verificación con `vendor_type = 'school'` | N0 |
| `frontend/src/components/vendor/ActivateStoreCTA.tsx` | Roles de escuela: no aparece si `useSchoolStore` encuentra la tienda. Sale del inicio (`UX-14` c): la tienda sin abrir se ofrece dentro de Tienda → estado vacío "Abrir la tienda del club" y en Mi plan. El coach conserva su CTA con texto propio | N0 / `UX-14` |
| `frontend/src/config/navigation.ts` | Ítem `Tienda` (`/tienda-escuela`, `addon: 'store'`, `requiresStore: true`) en **los dos** árboles `school` y `school_admin` (hoy: dentro de "Finanzas"; con `UX-4`/`ERP-6`: grupo de dinero). `getVendorNavGroup` deja de usarse para roles de escuela. Acudiente: barra y menú según `UX-15`; "Tienda" y "Mis compras" salen del grupo "Seguimiento" (la tienda pasa a Más, las compras a Pagos). Atleta: "Catálogo `/shop`" → "Tienda del club" | `UX-3`, `UX-4`, `ERP-6`, `UX-15` |
| `frontend/src/components/AppSidebar.tsx` | `showVendorGroup` excluye `isSchoolRole`; badge de Pagos = por aprobar unificado; badge de Tienda = pedidos por entregar | `UX-3`, `UX-14` |
| `frontend/src/hooks/usePendingApprovals.ts` (nuevo) | Un solo conteo para indicador, lista, badge del menú y de la barra: `payments` por aprobar no-pasarela (misma regla que `PaymentsAutomationPage` l. 1152-1190) + `orders` `awaiting_approval` de la tienda de la escuela | `UX-14` a |
| `frontend/src/pages/PaymentsAutomationPage.tsx` | Pestaña **Por aprobar** (la de la vista G) mezcla las dos fuentes con chip de origen y filtro; cada acción llama a su RPC (`approve_order_receipt` / flujo actual de mensualidades). El efectivo de tienda no entra: se confirma al entregar en Tienda → Pedidos | `UX-14` |
| `frontend/src/pages/DashboardPage.tsx` (inicio del admin) | Tarjeta "Pedidos por entregar" en la bandeja de Hoy (solo con tienda abierta); "Pagos por aprobar" con desglose; recaudo con Mensualidades / Tienda | `UX-14` c |
| `frontend/src/hooks/useDashboardStatsReal.ts` | `ingresos_mes` → `{ mensualidades, tienda }` | `UX-14` c |
| `frontend/src/pages/SchoolStorePage.tsx` (nuevo, `/tienda-escuela`) | `PageShell` + `PageHeader` + 5 pestañas que montan lo que existe: `StoreOrdersPage` (Pedidos), `VendorProductsPage` (Productos), `StoreInventoryPage` (Inventario), Ventas (nuevo, lectura de `orders`), Ajustes (`VendorShippingSettingsPage` + medios de pago + compartir). Sin tienda abierta: estado vacío con "Abrir la tienda del club" | `UX-4`, `UX-1` |
| `frontend/src/App.tsx` | Ruta `tienda-escuela` dentro de `AuthenticatedLayout` con `StoreGate`. `mi-tienda` renderiza la vitrina **dentro** del layout (y `mi-tienda/p/:id`, `mi-tienda/carrito`); `/tienda/:slug` público queda para enlaces y redes. `/orders`, `/products`, `/inventory`, `/categories`, `/customers`, `/promotions` del rol legado → redirigen a la pestaña correspondiente | `UX-4` |
| `frontend/src/pages/MiTiendaPage.tsx` · `TiendaPublicaPage.tsx` | `MiTiendaPage` monta la vitrina con prop `embedded` (sin cabecera pública, migas "Más › Tienda del club") en vez de `navigate()` | `UX-15` |
| `frontend/src/pages/MyPaymentsPage.tsx` | Título "Pagos y compras"; compras en Por pagar (pendientes de pago) / En revisión del club / Pagados; bloque "Carrito de la tienda" solo con productos | `UX-15` c |
| `frontend/src/components/navigation/MobileBottomNav.tsx` | Acudiente y admin según `UX-15`/`UX-14` e. **La tienda no agrega pestaña.** Badge de Pagos del admin = conteo unificado | `UX-14` e, `UX-15` b |
| Página **Más** (de `UX-14`/`UX-15`) | Acudiente: "Tienda del club" primer ítem (con tienda publicada). Admin: "Tienda" con badge en el bloque de dinero. Ambos: "Ayuda y soporte" | `UX-15`, `UX-16` |
| `TiendaPublicaPage`, `OrderStatusBadge`, `VendorDashboardPage`, `MiCompraDetallePage`, `TiendaProductoPage`, `StoreCheckoutPage`, `MisComprasPage`, `StoreOrdersPage`, `CartContents` | ~74 colores fijos → tokens semánticos al tocar cada archivo | `MOV-4` |
| `frontend/src/pages/vendor/VendorDashboardPage.tsx` | Queda solo para externos; quitar el `'$0'` fijo | — |

Nada de esto requiere migraciones: `vendor_profiles.school_id`, `can_manage_store` y las RPC de aprobación ya existen (F0 de tienda v2, todavía sin aplicar en la viva). Si el conteo unificado resulta lento con dos lecturas, una RPC de lectura `pending_approvals(p_school_id)` `SECURITY DEFINER STABLE` sería la fase siguiente, con su plan de migración aprobado antes.

---

## 6. Fases

| Fase | Contenido | Va con | Listo cuando |
|---|---|---|---|
| **N0 — Destrabar** | `useSchoolStore`; `VendorGuard` y `ActivateStoreCTA` por escuela | Sola, ya | Un `school_admin` de la demo abre la tienda sin pasar por onboarding; el CTA no reaparece con la tienda abierta |
| **N1 — Cimientos** | `PageShell`/`PageHeader` en las pantallas de tienda; ítem Tienda suelto (dentro de "Finanzas" del menú actual) con gating por adicional; `SchoolStorePage` con sus 5 pestañas | `UX-1` + `UX-3` (§4 #12) | Owner y school_admin ven el mismo ítem; "Mi Tienda" ya no aparece para la escuela; test que compara los dos árboles |
| **N2 — Hoy y Pagos** | Conteo unificado, comprobantes de tienda en Pagos → Por aprobar, tarjeta "Pedidos por entregar", recaudo con desglose | `UX-14` | Aprobar desde Pagos produce el mismo estado que desde Tienda → Pedidos (E2E en QA, nunca en prod); indicador = lista |
| **N3 — Acudiente** | Pagos y compras, Más → Tienda del club, vitrina dentro del shell, tarjeta al final de Inicio | `UX-15` + `UX-16` | El acudiente compra sin perder la barra; ve mensualidad y compra en Pagos |
| **N4 — Menú definitivo** | El ítem Tienda pasa al grupo de dinero; redirecciones de las rutas legadas | `UX-4` + `ERP-6` (§3.3 #13) | 24 destinos, ningún grupo > 5, Tienda cuenta 1 |

Dependencias: N0 puede ir ya. N2 y N3 necesitan F0 de tienda v2 aplicada (estados `awaiting_approval` de orden, `approve_order_receipt`). Todo detrás de `StoreGate`; ninguna fase prende la tienda. `MOV-4` corre en paralelo: cada archivo de tienda que se toque en N1–N3 sale con tokens.

## 7. Preguntas abiertas

| # | Pregunta | Propuesta |
|---|---|---|
| Q1 | ¿Un coach puede ver "Pedidos" para entregar en el entrenamiento? | No en N1 (D-15). Si se pide, un permiso "entregar pedidos" sin ver dinero |
| Q2 | ¿La tarjeta "Pedidos por entregar" va en la bandeja de Hoy o solo como badge? | En la bandeja, porque un pedido pagado sin entregar es una promesa incumplida con una familia; solo aparece con la tienda abierta |
| Q3 | ¿El acudiente puede pagar mensualidad y compra en un solo pago? | No en v2 (la tienda no escribe en `payments`, D-2). Se ven juntas, se pagan por separado |
| Q4 | Con `UX-4`, ¿la tienda va en el grupo de dinero o en uno propio? | Dinero: es una fuente de ingreso como Pagos, y un grupo de un solo ítem va contra la regla de `UX-4` |
