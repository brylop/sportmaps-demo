# Spec — Tienda v2 (experiencia estilo MercadoLibre)

**Versión:** v0.1 (borrador para revisión) · **Fecha:** 2026-10-02 · **Rama:** `develop`
**Estado:** 🟡 plan. **No se escribe una migración hasta aprobar el plan de la fase** (§10).
**Pedido del usuario (textual):** *"mejorar la parte de las tiendas … que todo quede como Mercado Libre, en serio: imágenes buenas, inventarios, todo debe quedar con pruebas completas".*

**Se apoya en (leer antes):**
- [`auditoria-contabilidad-tienda-2026-10-02.md`](../auditoria-contabilidad-tienda-2026-10-02.md) — hallazgos T1–T20.
- [`blindaje-dinero-pagos-tienda-nomina.md`](blindaje-dinero-pagos-tienda-nomina.md) — §1.3 tienda apagada con `store_enabled`, §4 requisito para reprenderla.
- [`tienda-productos-flujo.md`](../tienda-productos-flujo.md) — diseño aprobado 2026-07-10 (IVA incluido, retiro en sede por defecto, checkout de 1 pantalla). **Este spec lo amplía, no lo contradice.**
- [`articulos-escolares-catalogo.md`](articulos-escolares-catalogo.md) — el catálogo liviano **no** se funde con la tienda.
- Memoria `project_stores_marketplace_state` — arquitectura R1–R6, envíos por agregador, medios 3D/AR, reseñas con contexto deportivo, lo que no se hace en 6 meses.

> **En una línea.** La tienda ya tiene casi todas las tablas, pero el navegador decide precios, stock y estados, las imágenes se suben crudas y no hay una sola prueba. La v2 mueve **toda** decisión de dinero y stock a RPCs transaccionales, monta un pipeline de imágenes serio, un kardex inmutable y una experiencia de compra al nivel de MercadoLibre — y no se prende para nadie hasta que cada fase tenga sus pruebas verdes en un ambiente que **no** sea producción.

---

## 0. Estado vivo verificado hoy (2026-10-02, solo SELECT)

### 0.1 Qué hay en la base

| Pieza | Filas | Observación |
|---|---|---|
| `products` | 3 (demo) | 28 columnas. Tiene `tax_rate` (0–1), `min_stock_alert`, `weight_grams`, `category_id`, `brand_id`, `status` con CHECK (`draft/pending_review/active/archived/rejected`), `visibility` enum. **`stock` sin `CHECK >= 0`** |
| `product_variants` | 0 | `attributes jsonb`, `price_override`, `stock` con `CHECK >= 0`, `sku UNIQUE` global. Sin unicidad de combinación talla×color |
| `product_images` | 0 | `image_url, alt_text, sort_order, is_primary`. Policy `product_images_public_read USING(true)` → se leen imágenes de borradores. `product_images_vendor_all` es `FOR ALL` sin `WITH CHECK` (T11) |
| `product_categories` | 7 | Con `attribute_schema` jsonb listo (talla/color `applies_to: variant`, deporte, género…). `sport` vacío en todas |
| `product_brands` | 39 | — |
| `product_reviews` | 0 | Ya trae `sport_used_for, level, usage_duration, fit_feedback, recommended, is_verified_purchase`, `UNIQUE(product_id,user_id)`, body ≥ 20. **El vendedor puede UPDATE cualquier columna** (incluido `rating` y `status`) — T10 confirmado |
| `product_questions` | 0 | Vendor UPDATE sin `WITH CHECK` y sin límite de columnas: puede reescribir la pregunta del comprador |
| `inventory_logs` | 0 | Kardex mínimo (`delta, stock_before, stock_after, reason`). `reason` CHECK: `order_paid, order_cancelled, manual_restock, manual_adjust, returned`. Sin costo, sin nota. `inventory_logs_admin_all FOR ALL` → un super admin puede **borrar** el kardex |
| `stock_holds`, `inventory_transactions`, `product_media` | **no existen** | `validate_product_quality()` ya busca `product_media` (y si no existe cae a `products.image_url`; ignora `product_images`) |
| `orders` | 1 (seed) | 34 columnas, `status text` **sin CHECK**, `fulfillment_type` enum, `shipping_cost`, `tax_total`, `platform_fee`. `user_id` nullable (sirve para invitado). FKs a `auth.users`, no a `profiles` |
| `order_items` | 2 | `unit_price, subtotal, tax_amount, platform_fee, variant_id`. Insert por el comprador (T4) |
| `shipments` | 0 | Modelo completo de envío (label, tracking, events, provider). `shipments_vendor FOR ALL` sin `WITH CHECK` (T11) |
| `shipping_zones` | 14 | Por departamento, `costo_base`, días min/max |
| `carts` | 0 | `user_id + items jsonb` con RLS propia. El frontend no la usa: `CartContext` vive en `localStorage` y **borra el carrito si no hay usuario** |
| `store_conversations` / `store_messages` | 0 | RLS por participantes, correcta |
| `settlements`, `vendor_balances`, `vendor_payouts`, `refunds` | 0 | Dos motores de payout (T7) |
| `platform_config.store_enabled` | **no existe la fila** | Las migraciones M1–M3 del blindaje están en el árbol sin commitear y **sin aplicar**: la tienda hoy **no** está apagada en la base. Los middlewares `requireStoreEnabled` del BFF están en el working tree |

### 0.2 Funciones y triggers relevantes

| Objeto | Estado |
|---|---|
| `confirm_order_payment` | **2 sobrecargas** (4 y 5 args) → riesgo `PGRST203` (T8). Descuenta stock con `FOR UPDATE` y escribe `inventory_logs` — la base del motor sirve |
| `compute_settlements_for_order` / `split_order_payment` | Los dos motores de T7, ambos `search_path=public` (no el estándar) |
| `admin_generate_pending_payouts()` | **`EXECUTE` a `authenticated`** — verificar si tiene gate interno; si no, es un hallazgo nuevo (T21) |
| `enforce_product_publish_gate` | Trigger BEFORE en `products`: valida calidad y manda a `pending_review` si el vendedor no está verificado. Reutilizable |
| `trg_orders_release_on_delivered` | Libera settlements al pasar a `delivered` |
| `search_marketplace` | La versión viva no tiene `p_modality` → Explorar da 500 (T18) |
| `trial_block_*` en `products` | `school_is_operational(school_id)` con `school_id NULL` (vendedor externo) → NULL → **bloquea a todo vendedor externo** (mismo patrón que C6) |

### 0.3 Storage

| Bucket | Público | Límite | Tipos | Policies |
|---|---|---|---|---|
| `product-images` | sí | 5 MB | jpeg/png/webp | escribe quien tenga `foldername[1] = auth.uid()` o su vendor profile; lee `anon` **todo** el bucket |
| `vendor-docs` | no | 5 MB | pdf/jpeg/png | — |

El uploader actual (`ProductGalleryUploader.tsx`) sube el archivo **tal cual** (hasta 5 MB, 8 por producto), sin recorte, sin compresión, sin tamaños. `sharp` ya es dependencia del BFF (lo usa `pwaIcons.service.ts`).

### 0.4 Pruebas existentes

Cero pruebas de tienda (auditoría §4). `frontend/playwright.config.ts` apunta a `localhost:3001`, y el local apunta a la única Supabase (producción). `frontend/e2e/README.md` menciona un staging `kbgwjkbqsabnsajdmgxn` que la memoria da por inexistente — **verificar antes de crear un proyecto nuevo** (§8.1).

---

## 1. Principios (no negociables)

1. **El navegador no decide dinero ni stock.** Precio, IVA, envío, comisión, estado de la orden y stock salen de la base, dentro de RPCs `SECURITY DEFINER` con `FOR UPDATE`. Las tablas de dinero y stock **no tienen** INSERT/UPDATE para `authenticated`.
2. **Creación multi-fila = RPC transaccional** (orden + ítems + reservas en la misma transacción).
3. **Stock nunca negativo**, por CHECK y por diseño (reserva antes de cobrar).
4. **Kardex inmutable**: append-only; un error se corrige con un movimiento compensatorio, nunca con UPDATE/DELETE.
5. **La tienda escolar y el vendedor externo comparten catálogo y checkout**; cambia la entrega por defecto y quién recibe la plata (§6.6).
6. **No se funde con Artículos escolares** ni con mensualidad/inscripción.
7. **Estados en `text + CHECK`**, FKs de negocio a `profiles(id)` en tablas nuevas, `SET search_path = pg_catalog, public, pg_temp`, GRANT/REVOKE explícitos (también de `anon` y `authenticated`, trampa 3).
8. **Una fase = una rama = una revisión.** Plan de migraciones aprobado antes de código. La tienda sigue con `store_enabled = false` hasta el gate de §10.

---

## 2. Experiencia del comprador

### 2.1 Mapa de pantallas

| Pantalla | Ruta | Hoy | v2 |
|---|---|---|---|
| Home de tienda (vitrina) | `/tienda/:slug` | `TiendaPublicaPage` (grid simple) | Portada + logo + reputación + categorías del vendedor en chips + "Más vendidos" + "Novedades" + grid con filtros. Banner "Retiro gratis en sede" para tienda escolar |
| Explorar (todas las tiendas) | `/explorar` / `MarketplacePage` | 500 (T18) | Búsqueda global con facetas (§2.2) |
| Ficha de producto | `/tienda/:slug/p/:productSlug` | `ProductDetailPage` / `MarketplaceDetailPage` | §2.3 |
| Carrito | drawer + `/carrito` | `CartDrawer` (localStorage, borra si no hay login) | §2.4 |
| Checkout | `/checkout/:checkoutId` | dos flujos (T15) | Uno solo, una pantalla (§2.5) |
| Mis compras | `/mis-compras`, `/mis-compras/:orderId` | no existe para tienda | Lista + detalle con línea de tiempo, seguimiento, código de retiro, "Contactar al vendedor" (hilo con `order_id`), "Devolver", "Opinar" |
| Pedido de invitado | `/pedido/:orderId?t=<token>` | no existe | Mismo detalle, acceso por token del correo |

Tienda escolar: el padre entra por el menú "Tienda" (`/mi-tienda` → `/tienda/:slug`), ve también `school_only`. Externo: por link/QR/Explorar, solo `public`.

### 2.2 Búsqueda y filtros

| Filtro | Fuente | Tipo |
|---|---|---|
| Texto | `products.search_tsv` (columna generada, `to_tsvector('spanish', unaccent(name || brand || category))`) + `pg_trgm` para typos | GIN |
| Categoría (árbol) | `product_categories` (`parent_id`) | slug |
| Deporte | `products.attributes->>'deporte'` normalizado a columna `sport text` (catálogo de deportes = nombre visible, ver memoria de 3 fuentes) | multi |
| Talla | `product_variants.option_size` (§4.1) con stock disponible > 0 | multi |
| Color | `product_variants.option_color` + `color_hex` | multi (swatches) |
| Precio | precio efectivo por variante (min–max) | rango |
| Marca | `brand_id` | multi |
| Entrega | "Retiro en sede" / "Envío" | toggle |
| Solo con stock | disponible > 0 | toggle, **encendido por defecto** |

Orden: relevancia · más vendidos (30 días) · menor precio · mayor precio · mejor calificados · novedades.

**RPC nueva `search_products(...)`** — `SECURITY INVOKER` (respeta RLS: un anónimo jamás ve `school_only`), devuelve página + **facetas con conteo** (`{tallas:[{v:'M',n:12}], colores:[…], precio:{min,max}}`). Reemplaza la parte de productos de `search_marketplace` (que se arregla aparte para servicios, T18). Paginación por cursor, 24 por página, imágenes `thumb`/`medium` con `srcset`.

### 2.3 Ficha de producto

| Bloque | Detalle |
|---|---|
| Galería | Imagen principal 1:1 + tira de miniaturas (vertical en desktop, puntos + swipe en móvil). **Zoom**: hover-lupa en desktop (carga `zoom` 2000 px), tap → visor a pantalla completa con pinch-zoom en móvil. Al elegir un color, la galería salta a las imágenes de esa variante (`product_media.variant_id`). Sin saltos de layout: cajas con `aspect-ratio: 1` y placeholder `blurhash` |
| Título, marca, calificación | ★ promedio + n.º de reseñas (link a la sección) + "N vendidos" |
| Precio | Precio final grande (**IVA incluido**, texto pequeño "IVA incluido"). Si la variante tiene precio propio, cambia al elegirla. Precio tachado solo si hay promoción vigente (fase posterior) |
| Selector de variantes | Talla (botones) × color (swatches). Combinaciones sin stock **visibles pero deshabilitadas** (tachadas), como ML. "Guía de tallas" si la categoría la trae |
| Disponibilidad | "Últimas N disponibles" cuando disponible ≤ `min_stock_alert` (por defecto 5); "Agotado — avísame" (suscripción a reposición, fase posterior); nunca muestra el stock exacto si es > umbral |
| Entrega, **antes de comprar** | Tienda escolar: "Retiro gratis en *Sede Norte* · listo en 1–2 días hábiles". Envío: selector de departamento/ciudad (recordado) → "Envío $X · llega entre el *mié 8* y el *vie 10*" con `shipping_zones` (F3) o cotización del agregador (F6). "Envío gratis desde $Y" si el vendedor lo configura |
| Cantidad + CTA | "Comprar ahora" (crea checkout directo) y "Agregar al carrito". Tope de cantidad = disponible |
| Vendedor | Nombre, verificado, reputación, tiempo de respuesta, "Contactar al vendedor" (`store_conversations` con `product_id`) |
| Descripción y características | Texto + tabla de atributos desde `attribute_schema` |
| Preguntas y respuestas | Lista paginada de respondidas + "Preguntar" (login). Búsqueda dentro de preguntas |
| Reseñas | Promedio, histograma 1–5, filtro por deporte/nivel/"talla justa", fotos de compradores (`product_review_media` ya existe), badge "Compra verificada" |
| Relacionados | "Del mismo vendedor" y "Otros compraron" (por categoría + deporte, sin ML) |

SEO/OG: `<title>`, meta description, OG image = `large` de la portada, JSON-LD `Product` con `offers` y `aggregateRating`. La vitrina pública ya tiene el patrón OG.

### 2.4 Carrito persistente (también invitado)

| Caso | Comportamiento |
|---|---|
| Invitado | Carrito en `localStorage` con `cart_token` (uuid). **Se deja de borrar al no haber usuario** (`CartContext.tsx:71`) |
| Login | Merge: ítems del invitado + `carts` del usuario (suma cantidades, tope = disponible) → se guarda en `carts` y se limpia el local |
| Logueado | `carts` es la fuente; sincroniza entre dispositivos |
| Revalidación | Al abrir el carrito se llama `quote_cart(items)` (RPC de solo lectura): precio vigente, disponible, ítems inactivos. Si algo cambió: aviso "El precio de X cambió" / "Quedan 2, ajustamos la cantidad" |
| Multi-vendedor | El carrito agrupa por tienda. **v2.0: se paga una tienda por checkout** (D-2) — botón "Pagar los de *Tienda Besser*" por grupo |
| Lo que el carrito **no** guarda | Precios. Solo `variant_id` y cantidad. El precio siempre lo pone la base |

Se cambia también el `localStorage` entre usuarios (gotcha conocido): la clave lleva el `user_id` o el `cart_token`.

### 2.5 Checkout de una pantalla

Tres bloques en una sola vista, sin pasos ni redirecciones (diseño aprobado), más el resumen fijo:

1. **Entrega** — "Retiro en sede" (lista de sedes del vendedor escolar; por defecto la del hijo) o "Envío" (dirección guardada / nueva). Cambiar la entrega recalcula por RPC.
2. **Datos** — nombre, documento, correo, teléfono; prellenados desde `profiles` y la última compra. Invitado: correo obligatorio (recibe el link del pedido).
3. **Pago** — widget Wompi (tarjeta, PSE, Nequi). Efectivo en sede solo si el vendedor escolar lo activa (queda `pending_payment` con reserva más larga, D-6).

Resumen: ítems, subtotal, envío, **total** (el IVA se muestra desglosado como "incluye IVA $X"). Botón `Pagar $X`.

**Secuencia técnica:**

```
Front ──POST /api/v1/store/checkout {items:[{variant_id,qty}], fulfillment, pickup_branch_id|address, buyer}──► BFF
BFF ──rpc create_cart_order(...)──► DB: valida, precia, reserva (stock_holds), crea orders+order_items  (1 transacción)
BFF ◄── {order_id, reference: 'ORD-…', amount_in_cents, expires_at}
Front ── widget Wompi con reference + firma de integridad (BFF firma con orders.total_amount) ──► Wompi
Wompi ──webhook──► BFF wompi.ts ── verifica checksum + reconsulta + monto == orders.total_amount
BFF ──rpc confirm_order_payment(order_id, tx_id, provider)──► DB: consume holds, descuenta stock, kardex, settlements, paid
Front: "Pago recibido, confirmando…" → reconsulta → /mis-compras/:id
```

`CheckoutPage.tsx` (flujo viejo, T15) y la referencia `SCH-` se eliminan. `CartCheckoutModal` se reemplaza por la página de checkout.

### 2.6 Estados del pedido y seguimiento

`orders.status` pasa a `text + CHECK`:

| Estado | Quién lo pone | Siguiente |
|---|---|---|
| `pending_payment` | `create_cart_order` | `paid`, `payment_review`, `expired`, `cancelled` |
| `payment_review` | webhook (monto/stock no cuadra) | `paid`, `cancelled` (con reembolso) |
| `paid` | `confirm_order_payment` (service role) | `preparing`, `cancelled` (vendedor, con reembolso) |
| `preparing` | vendedor | `ready_for_pickup` / `shipped` |
| `ready_for_pickup` | vendedor | `delivered` (con código de retiro) |
| `shipped` | vendedor o agregador | `delivered`, `returned` |
| `delivered` | vendedor (retiro con código), comprador ("Ya lo recibí"), agregador, o auto a los 10 días de `shipped` | `return_requested` (ventana) |
| `expired` | cron (reserva vencida sin pago) | — |
| `cancelled` | comprador (solo `pending_payment`), vendedor, admin | — |
| `refunded` / `partially_refunded` | `complete_refund` | — |

Toda transición por la RPC `order_transition(order_id, to_status, note)` con matriz de transiciones permitidas por actor, y registro en `order_status_history (order_id, from, to, actor_id, actor_role, note, created_at)`. La línea de tiempo del comprador sale de esa tabla. **Código de retiro:** 6 dígitos + QR por orden (`orders.pickup_code_hash`); el vendedor lo escanea o digita → `delivered`. Notificaciones (despachador unificado): pagado, listo para retirar, enviado (con tracking), entregado, "¿Cómo te fue? Opina".

### 2.7 Preguntas, reseñas y chat

| Pieza | Regla |
|---|---|
| Preguntas | Cualquier usuario logueado pregunta (rate limit 5/día/producto). El vendedor **solo responde** por RPC `answer_question(id, text)` — se revoca su UPDATE directo. Moderación de admin: `hidden`. Notificación al vendedor; indicador "responde en ~N h" alimenta `avg_response_hours` |
| Reseñas | Solo con orden `delivered` del mismo producto (gate por RPC `create_review`, que fija `is_verified_purchase` y `order_id`). Campos de contexto **obligatorios**: `sport_used_for`, `level`, `usage_duration`, `fit_feedback` (si la categoría tiene talla), `recommended`. Hasta 5 fotos (pipeline §3). Reseña ≤ 2★ queda `pending` 24 h para que el vendedor responda antes de publicarse; luego se publica igual (no se puede enterrar). El vendedor **solo** responde (`respond_review`), **no** modera ni cambia rating/estado (cierra T10) |
| Reputación del vendedor | `vendor_reviews` (ya existe) al cerrar la orden: envío/atención 1–5 |
| Chat | Ya construido (`store_conversations`/`store_messages`). Falta: hilo desde el detalle del pedido (`order_id`), adjuntar foto (pipeline §3, bucket privado), y bloquear datos de pago fuera de la plataforma con un aviso (no filtro). Pasa a realtime en vez de polling 8 s |

---

## 3. Imágenes buenas — pipeline de medios

### 3.1 Decisión: dónde se transforma

| Opción | A favor | En contra | Veredicto |
|---|---|---|---|
| **Supabase Storage image transformation** (`/render/image`) | Cero código, tamaños al vuelo | **Solo en plan Pro** (el proyecto es Free, cerca del límite); se cobra por imagen de origen; latencia en la primera petición; no recorta a fondo blanco ni hace AVIF a elección; acopla la calidad a un proveedor | No |
| **Procesar en el navegador** | Sin costo de servidor | Calidad dispareja por dispositivo, no se puede confiar en lo que manda el cliente (tamaño/tipo), no sirve para la importación masiva | Solo como pre-compresión |
| **BFF con `sharp`** | Ya es dependencia (`pwaIcons.service.ts`); control total (recorte, `flatten` a blanco, EXIF, WebP/AVIF, blurhash); resultado determinista; se valida el binario real, no la extensión | Consume CPU/RAM del BFF en Render | **Sí** |

**Decisión:** el navegador **pre-comprime** (lado largo ≤ 2560 px, JPEG/WebP q≈0,85, corrige orientación) para ahorrar datos móviles; el **BFF con `sharp`** genera los derivados definitivos. Protección de recursos en Render: `sharp.concurrency(1)`, `limitInputPixels: 40e6`, cola en memoria de 2 trabajos simultáneos, timeout 20 s por imagen; si la cola se llena, 429 con reintento. Si el volumen crece, el mismo código se mueve a un worker aparte sin cambiar el contrato.

### 3.2 Flujo

```
1. Front: elige/arrastra hasta 10 fotos (o cámara) → recortador 1:1 por foto (react-easy-crop),
   opción "Fondo blanco" (contain + relleno blanco) vs "Recortar" (cover), pre-compresión.
2. Front → BFF POST /store/media/upload-url {product_id, mime, bytes}  → valida dueño, cupo, tipo
   ← signed upload URL al bucket PRIVADO product-media-src/{vendor_profile_id}/{product_id}/{media_id}.orig
3. Front sube directo a Storage (no pasa por el BFF: ahorra ancho de banda de Render).
4. Front → BFF POST /store/media/:id/process {crop:{x,y,w,h}, background:'white'|'none', alt_text}
5. BFF: descarga original, valida magic bytes (no la extensión), rota por EXIF y BORRA EXIF/GPS,
   aplica recorte, flatten a #FFFFFF si hay transparencia o si se pidió fondo blanco,
   genera derivados, calcula blurhash, sube derivados, marca product_media.status='ready'.
6. Publicar el producto → los derivados se copian al bucket PÚBLICO (ver 3.4).
```

### 3.3 Derivados y límites

| Tamaño | Lado (px) | Uso | Formato |
|---|---|---|---|
| `thumb` | 200 | miniaturas, carrito, listas | WebP q75 |
| `medium` | 600 | grid de vitrina/búsqueda | WebP q78 |
| `large` | 1200 | imagen principal de la ficha, OG | WebP q80 + JPEG q82 (OG y correos) |
| `zoom` | 2000 | lupa / visor a pantalla completa (solo si el original lo permite; nunca se agranda) | WebP q82 |

AVIF: **no** en v2.0 (D-7) — duplica almacenamiento en un proyecto Free (1 GB de storage, 5 GB/mes de egress) y WebP ya cubre >97% de los navegadores. El `<picture>` se escribe preparado para sumarlo.

Presupuesto aproximado por foto: ~8 + 45 + 140 (+60 JPEG) + 350 KB ≈ **0,6 MB**. 10 fotos × 100 productos ≈ 600 MB → **choca con el plan Free** (D-8).

| Límite | Valor |
|---|---|
| Tipos aceptados (original) | `image/jpeg`, `image/png`, `image/webp`. HEIC: el selector de iOS lo convierte a JPEG con `accept="image/jpeg,image/png,image/webp"`; si llega HEIC crudo, se rechaza con mensaje claro (el `sharp` precompilado no decodifica HEIC) |
| Peso del original | 10 MB (tras pre-compresión, rara vez > 1,5 MB) |
| Resolución mínima | 800 × 800 (bloquea publicar); recomendada ≥ 1200 |
| Fotos por producto | mín. 1 para publicar, recomendado ≥ 3, máx. 10; por variante máx. 6 |
| Relación de aspecto | todo derivado sale 1:1 |
| Alt text | obligatorio para publicar; se propone por defecto "*{nombre}* — *{color}*, vista *{n}*" y el vendedor lo edita |
| Portada | exactamente una `is_cover` por producto (índice único parcial); arrastrar para ordenar (`sort_order`) |

### 3.4 Modelo, buckets y policies

**Tabla nueva `product_media`** (la que ya espera `validate_product_quality`; `product_images`, con 0 filas, queda deprecada y se elimina en una fase posterior):

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | también es la carpeta en storage |
| `product_id` | uuid FK `products` ON DELETE CASCADE | |
| `variant_id` | uuid FK `product_variants` NULL | foto de un color concreto |
| `vendor_profile_id` | uuid FK | denormalizado para policies sin JOIN recursivo |
| `kind` | text CHECK (`image`) | `video`, `spin_360`, `model_3d` quedan para R6 |
| `status` | text CHECK (`uploading`,`processing`,`ready`,`failed`) | |
| `src_path` | text | original en bucket privado |
| `variants` | jsonb | `{thumb:{webp:path,w,h,bytes}, medium:…, large:{webp,jpg}, zoom:…}` |
| `blurhash` | text | placeholder |
| `width`, `height`, `bytes_total` | int | |
| `alt_text` | text | CHECK longitud 3–160 al publicar (validado en el gate) |
| `background` | text CHECK (`none`,`white`) | |
| `is_cover` | bool | índice único parcial `(product_id) WHERE is_cover` |
| `sort_order` | int | |
| `created_by` | uuid FK `profiles` | |

| Bucket | Público | Contenido | Escribe | Lee |
|---|---|---|---|---|
| `product-media-src` (nuevo) | **no** | originales y derivados de borradores | solo el BFF (service role) vía URL firmada de subida | dueño del producto (URL firmada), service role |
| `product-media` (nuevo) | sí | derivados de productos **publicados** con ruta inmutable `{vendor}/{product}/{media_id}/{size}.{hash8}.webp` | solo service role | todos, vía CDN |
| `product-images` (viejo) | sí | — | **se le quita INSERT/UPDATE en F0** | se mantiene lectura hasta migrar |

"El público lee solo productos publicados" se cumple así: un bucket público no puede filtrar por fila, así que **lo no publicado nunca está en el bucket público**. Al publicar, el BFF copia los derivados; al archivar/rechazar, los borra del público (la caché del CDN puede servirlos hasta su vencimiento: se acepta). La RLS de `product_media` deja leer a `anon` solo filas `ready` de productos `active` + `public` (y `school_only` a miembros), con lo que las rutas de borradores tampoco salen por la API.

Policies `product_media`: SELECT público (condición anterior) + SELECT del dueño; **sin** INSERT/UPDATE/DELETE para `authenticated` — todo por BFF (subida, proceso, orden, portada, alt). Esto evita repetir T11.

**CDN / caché:** derivados con `cacheControl: '31536000, immutable'` (la ruta lleva hash: cambiar la imagen = ruta nueva). Supabase sirve el bucket público detrás de su CDN. Si el egress del plan Free se queda corto, el paso siguiente es Cloudflare delante del dominio de storage o R2 (memoria de medios), sin cambiar el modelo.

**Front:** componente único `<ProductImage media size sizes>` que arma `srcset` (thumb/medium/large), `loading="lazy"` salvo la portada (`fetchpriority="high"`), `decoding="async"`, `aspect-ratio:1`, placeholder blurhash. Objetivo medible: LCP de la ficha < 2,5 s en móvil 4G medio; CLS < 0,05.

**Fondo blanco automático (quitar el fondo):** **no** en v2.0 — se ofrece `flatten`/relleno blanco, que resuelve PNG transparentes y fotos de estudio. La remoción real de fondo (MediaPipe en el navegador o API paga) es R6 / D-9.

---

## 4. Inventario serio

### 4.1 Modelo

**Todo producto vendible tiene ≥ 1 variante.** Un producto sin talla/color tiene una variante "Única". Así el stock vive en un solo lugar (`product_variants.stock`) y `products.stock` pasa a ser un **caché de solo lectura** (suma de variantes, mantenido por trigger) para no romper lecturas viejas.

Cambios a `product_variants`:

| Columna | Nota |
|---|---|
| `option_size text`, `option_color text`, `color_hex text` | columnas explícitas para filtrar e indexar (además de `attributes`) |
| `price_override` | ya existe: precio por variante, IVA incluido |
| `stock int CHECK (stock >= 0)` | ya existe; **solo lo mutan RPCs** (se revoca UPDATE de la columna a `authenticated`) |
| `reserved int CHECK (reserved >= 0)` | caché de holds activos (lo mantienen solo las RPCs de hold); `available = stock - reserved`. La disponibilidad se valida en la RPC con `FOR UPDATE` (no con un CHECK `reserved <= stock`, que bloquearía el caso de pago tardío de §4.2) |
| `barcode text` | opcional (lector en panel) |
| `UNIQUE (product_id, option_size, option_color)` | sin combinaciones duplicadas (`NULLS NOT DISTINCT`) |
| `sku` | se pasa de `UNIQUE` global a `UNIQUE (vendor_profile_id, sku)` vía columna denormalizada; dos vendedores pueden usar "CAM-M-AZ" |

`products`: `CHECK (stock >= 0)` (falta hoy), `low_stock_threshold` = `min_stock_alert` (ya existe, se reutiliza).

**Costo (para margen) en tabla aparte** — RLS filtra filas, no columnas (trampa 4): `product_variants` es legible por `anon`, así que el costo **no** puede ser una columna de ella.

`variant_costs (variant_id PK, avg_unit_cost numeric(12,2), last_unit_cost, updated_at)` — RLS: solo el dueño del vendedor y `can_manage_finances`. Costo promedio ponderado recalculado en cada entrada.

### 4.2 Reservas (`stock_holds`)

| Columna | Nota |
|---|---|
| `id`, `variant_id`, `order_id`, `quantity > 0` | |
| `status text CHECK (active, consumed, released, expired)` | |
| `expires_at timestamptz` | `now() + 20 min` (tarjeta/Nequi); PSE extiende a 45 min al recibir `PENDING` del webhook; efectivo en sede: 48 h (D-6) |
| `created_at`, `closed_at` | |

Reglas:
- `create_cart_order` bloquea las variantes **en orden de `id`** (evita deadlocks entre dos carritos con los mismos ítems), verifica `stock - reserved >= qty`, crea el hold y suma `reserved`. Si no alcanza: `INSUFFICIENT_STOCK` con la variante y el disponible, y no se crea nada.
- `confirm_order_payment`: consume los holds (`consumed`), resta `stock` y `reserved`, escribe kardex `sale`. Idempotente por `provider_transaction_id`.
- **Pago que llega tarde** (hold ya `expired`): intenta descontar si hay disponible; si no, la orden queda `payment_review` con `requires_review = true` y motivo `PAID_WITHOUT_STOCK`, se avisa al vendedor y se ofrece reembolso — nunca stock negativo.
- `release_expired_holds()` en `pg_cron` cada minuto: `expired` + resta `reserved` + orden `pending_payment → expired`. También se libera al cancelar.

### 4.3 Kardex (movimientos)

Se **amplía `inventory_logs`** (0 filas; no se crea una tabla gemela) a kardex completo:

| Columna | Nota |
|---|---|
| `movement_type text CHECK` | `initial`, `purchase` (entrada), `sale`, `adjustment_in`, `adjustment_out`, `return_restock`, `shrinkage` (merma: daño, pérdida, robo, vencido), `transfer_in/out` (entre sedes, fase posterior) |
| `reason_code text` + `note text` | motivo obligatorio en ajustes y mermas (`conteo_fisico`, `danado`, `perdido`, `vencido`, `error_carga`, …) |
| `delta`, `stock_before`, `stock_after` | ya existen; CHECK `stock_after = stock_before + delta` y `stock_after >= 0` |
| `unit_cost numeric(12,2)` | obligatorio en `purchase`; costo vigente en salidas |
| `order_id`, `return_id`, `import_batch_id` | trazabilidad |
| `actor_id` (`created_by`), `actor_role`, `source text CHECK (rpc, import, webhook, cron, admin)` | quién y por dónde |

Se migra el `reason` viejo (CHECK actual) al nuevo `movement_type` en la misma migración. **Append-only:** sin policy de INSERT/UPDATE/DELETE para nadie (también se quita `inventory_logs_admin_all FOR ALL`); solo SELECT para el dueño y super admin; escribe solo `SECURITY DEFINER`. Un error se corrige con un movimiento inverso.

### 4.4 RPCs de inventario

| RPC | Quién | Qué hace |
|---|---|---|
| `inventory_receive(variant_id, qty, unit_cost, note)` | vendedor dueño | entrada + recalcula costo promedio |
| `inventory_adjust(variant_id, new_stock, reason_code, note)` | vendedor dueño | conteo físico: calcula delta, rechaza si `new_stock < reserved` |
| `inventory_shrink(variant_id, qty, reason_code, note)` | vendedor dueño | merma |
| `inventory_import_batch(batch jsonb, dry_run bool)` | vendedor dueño (llamada desde BFF) | todo o nada; devuelve errores por fila |
| `release_expired_holds()` | cron | §4.2 |

Todas: `SECURITY DEFINER`, `FOR UPDATE` sobre la variante, validan propiedad con `is_store_vendor(vendor_profile_id)` + gate de tienda (§6.5), `GRANT EXECUTE` explícito.

### 4.5 Alertas de stock bajo

Al bajar `available` por debajo de `min_stock_alert` (trigger AFTER en la RPC, no en el cliente): notificación al vendedor (despachador unificado, una por variante por día) + badge en el panel "N variantes con stock bajo" + vista `v_vendor_low_stock`. Agotado → la variante queda visible pero deshabilitada en la ficha.

### 4.6 Importación masiva CSV

Plantilla descargable: `sku, nombre_producto, categoria_slug, talla, color, precio, stock, costo_unitario, peso_g, codigo_barras`. Flujo: subir CSV/XLSX (≤ 2.000 filas) → BFF parsea (UTF-8 con BOM, `;` o `,`) → **vista previa con errores por fila** (dry-run) → confirmar → `inventory_import_batch` en una transacción → reporte. Las fotos no van en el CSV (se suben en el panel). Tests unitarios del parser con los casos feos (comas en nombres, BOM, decimales con coma, tildes).

---

## 5. Panel del vendedor

### 5.1 Wizard de publicación (`ProductWizardPage`, ya existe — se rehace)

| Paso | Contenido |
|---|---|
| 1. Categoría | árbol de `product_categories`; define atributos y si hay talla/color |
| 2. Datos | nombre, marca, descripción, atributos de producto (`attribute_schema`, `applies_to: product`), deporte, visibilidad (`public`/`school_only`/`private`) |
| 3. Variantes | matriz talla × color autogenerada → por celda: activa, precio propio, stock inicial, costo, SKU (sugerido) |
| 4. Fotos | pipeline §3: subir, recortar, ordenar, portada, fotos por color, alt |
| 5. Precio y entrega | precio (IVA incluido) con **"Vas a recibir $X"** (precio − comisión − pasarela estimada), `tax_rate` (0, 5 o 19 %), peso, retiro/envío |
| 6. Revisión | vista previa como la ve el comprador + checklist de calidad → Publicar |

Borrador autoguardado (`status = draft`). Publicar → `enforce_product_publish_gate` (se actualiza para leer `product_media`) → `active` o `pending_review` si el vendedor no está verificado.

### 5.2 Calidad de publicación

`validate_product_quality` pasa a devolver un **puntaje 0–100** + ítems:

| Ítem | Peso | Bloquea |
|---|---|---|
| ≥ 1 foto `ready` con alt | 20 | sí |
| ≥ 3 fotos | 10 | no |
| Portada 1:1 ≥ 1200 px con fondo blanco | 10 | no |
| Nombre 5–80 caracteres, sin MAYÚSCULAS completas | 10 | sí (5) |
| Descripción ≥ 30 (recomendado ≥ 150) | 10 | sí (30) |
| Atributos obligatorios de la categoría | 15 | sí |
| Cada variante con stock y precio | 10 | sí |
| Peso informado (si tiene envío) | 5 | sí si envío |
| Guía de tallas (categorías con talla) | 5 | no |
| Fotos por color | 5 | no |

El panel muestra "Calidad: 72 — Buena. Sube 2 fotos más para llegar a Excelente".

### 5.3 Métricas

Tabla `product_daily_stats (product_id, day, views, unique_visitors, add_to_cart, checkouts, orders, units, revenue)` — PK `(product_id, day)`. Las visitas se registran por un beacon al BFF (`POST /store/events`), deduplicadas por `(product, visitor_hash, día)` en memoria/tabla temporal, **sin** guardar IP ni usuario (privacidad). Los pedidos y unidades salen de `orders` al pagar (no del beacon).

Panel: visitas, visitantes únicos, conversión (`orders / unique_visitors`), ventas $, unidades, ticket promedio, top productos, productos sin ventas en 30 días, stock bajo, preguntas sin responder, tiempo de respuesta. Periodo: 7/30/90 días.

### 5.4 Gestión de pedidos

Bandeja por estado (pestañas con contador): **Por preparar** (`paid`) → **Listos para retirar / Para enviar** → **En camino** → **Entregados** → **Cancelados / Devoluciones**. Acciones: "Empezar a preparar", "Marcar listo para retirar" (notifica al comprador con el código), "Validar retiro" (escanea QR / digita código → `delivered`), "Marcar enviado" (transportadora + guía; o etiqueta del agregador en F6), "Cancelar" (con motivo; reembolso automático). Imprimir lista de picking y comprobante de entrega. SLA visible: pedido `paid` sin preparar > 48 h → alerta.

### 5.5 Devoluciones

| Regla | Valor propuesto |
|---|---|
| Ventana | **Derecho de retracto: 5 días hábiles** desde la entrega en venta a distancia (Estatuto del Consumidor, Ley 1480/2011 art. 47) + garantía legal por defecto. **Confirmar con legal** (D-10) |
| Flujo | comprador solicita (motivo + fotos) → vendedor aprueba/rechaza en 48 h (si no responde, escala a admin) → comprador devuelve (retiro en sede o guía) → vendedor recibe y elige "reintegrar a stock" (`return_restock`) o "merma" (`shrinkage`) → `complete_refund` |
| Tabla | `return_requests (id, order_id, items jsonb, reason_code, photos, status CHECK(requested, approved, rejected, in_transit, received, refunded, closed), decided_by, …)` |
| Dinero | reembolso total o parcial por ítem; revierte settlement (§6.3) y factura con nota crédito (§6.7) |

---

## 6. Dinero y seguridad (cierra T2–T20)

### 6.1 Cierre hallazgo por hallazgo

| ID | Cierre en v2 | Fase |
|---|---|---|
| T1 | Grants por columna (blindaje M1) + lecturas sensibles al BFF (blindaje 2.10) | F0 (prerrequisito) |
| T2 | `trg_guard_vendor_profiles` (blindaje M3) | F0 (prerrequisito) |
| T3 | Se eliminan `orders_update_buyer` y `orders_insert_buyer`; REVOKE INSERT/UPDATE en `orders` a `authenticated`/`anon`; `status` con CHECK; trigger que congela columnas de dinero (`total_amount`, `tax_total`, `shipping_cost`, `platform_fee`, `status`, `paid_at`, `provider_*`) salvo service role/DEFINER | F0 |
| T4 | Se elimina `order_items_insert_buyer`; solo `create_cart_order` crea ítems, con precio de la base | F0 |
| T5 | INSERT de `products` solo con `vendor_profile_id` propio (`is_store_vendor`), `can_sell_products`, y si `school_id` no es nulo, `school_id = ANY(user_admin_school_ids())`. `vendor_id` (legacy, FK a `auth.users`) lo fija un trigger. Arreglar `trial_block_*` con `school_id NULL` | F0 |
| T6 | REVOKE UPDATE de `stock` (columna) en `products`/`product_variants`; `useStoreData.ts` y `useProducts.ts` pasan a las RPCs de §4.4 | F0 |
| T7 | **Un solo motor:** `compute_settlements_for_order` (por ítem). Se borra `split_order_payment` del webhook y se revoca/elimina `admin_generate_pending_payouts` (además verificar T21: `EXECUTE` a `authenticated`). Redondeo a pesos | F0 |
| T8 | `DROP FUNCTION confirm_order_payment(uuid,text,text,text)`; queda la de 5 argumentos, reescrita con holds (§4.2) | F0 |
| T9 | Se elimina `refunds_owner_insert`; `request_refund` / `approve_refund` aceptan `p_actor` validado por el BFF (o se llaman con JWT del usuario); `complete_refund` idempotente (`FOR UPDATE` + estado) y repone stock **una** vez vía kardex | F0 |
| T10 | Vendedor sin UPDATE en `product_reviews`/`product_questions`; responde por RPC | F0 |
| T11 | `WITH CHECK` en `shipments_vendor`; `product_images_vendor_all` desaparece con `product_media`; `mp_shipping_rates_owner` con `WITH CHECK` | F0 |
| T15 | Se elimina `CheckoutPage` viejo; un solo checkout (§2.5) | F3 |
| T16 | IVA según `products.tax_rate`, **incluido** (D-1); envío según modalidad (retiro = 0); orden transaccional con reservas; `/checkout/service|event|subscription` → 501 explícito hasta que existan | F0 (cálculo) / F3 (UI) |
| T17 | Gate real del addon (§6.5) | F0 |
| T18 | `search_products` nueva + arreglar `search_marketplace` (servicios) | F3 |
| T19 | Vitrinas distinguen 404 / 503 `STORE_DISABLED` / 403 addon / error de red | F3 |
| T20 | Factura de órdenes correcta (§6.7) | F0 |

### 6.2 `create_cart_order` — contrato

```
create_cart_order(
  p_items          jsonb,   -- [{variant_id, quantity}] — nada más; precios ignorados si vienen
  p_fulfillment    text,    -- 'pickup' | 'shipping'
  p_pickup_branch  uuid,    -- sede (tienda escolar)
  p_address        jsonb,   -- {departamento, ciudad, direccion, …}
  p_buyer          jsonb,   -- {name, document, email, phone}
  p_buyer_id       uuid,    -- NULL = invitado (solo service role puede pasarlo NULL)
  p_idempotency_key uuid    -- reintento del mismo clic = misma orden
) RETURNS jsonb  -- {order_id, reference, total, tax_total, shipping, expires_at}
SECURITY DEFINER, SET search_path = pg_catalog, public, pg_temp
```

Valida, en este orden: `store_enabled()` · un solo vendedor (D-2) · `store_seller_allowed(vendor)` (§6.5) · cada variante activa de producto `active` · visibilidad (`school_only` exige `school_id = ANY(user_school_ids())` del comprador) · cantidades 1–20 · `FOR UPDATE` de variantes ordenadas por id · disponible · envío por modalidad (retiro: 0 y sede del vendedor; envío: zona por departamento o cotización guardada) · total > 0. Escribe orden + ítems + holds + historial en la misma transacción. `GRANT EXECUTE` a `authenticated` (con `p_buyer_id` forzado a `auth.uid()` si no es service role) y a `service_role`.

### 6.3 IVA, redondeo y comisión

**IVA incluido (D-1, recomendado: confirmar con el contador):** el precio publicado es el que paga el comprador. Por línea:

```
line_total = round(unit_price * qty)                  -- pesos enteros
line_base  = round(line_total / (1 + tax_rate))
line_tax   = line_total - line_base                   -- el IVA cuadra al peso con lo cobrado
```

`orders.tax_total = Σ line_tax`; el envío va como línea aparte con su propio tratamiento (D-11: el transporte de carga suele estar excluido de IVA, pero depende de quién lo factura — contador). Todo en `numeric(12,0)` efectivo (se redondea en la RPC; las columnas quedan `numeric`).

**Comisión (D-3):** `settlements` por ítem:

```
gross        = line_total                (IVA incluido, sin envío)
platform_fee = round(gross * vendor_profiles.commission_rate)
gateway_fee  = parte proporcional del fee REAL de la transacción (de la respuesta de Wompi), no estimado
net          = gross - platform_fee - gateway_fee
```

El envío se liquida aparte (al vendedor si él despacha; al agregador en F6).

### 6.4 Un solo libro de payout

```
orders(paid) ──► settlements (1 por ítem, status pending)
                    │ delivered + ventana de devolución (7 días) → available   [cron release_settlements_*]
                    ▼
vendor_balances  = caché derivada de settlements (pending/available/paid). Solo la escriben las RPC.
                    │ admin agrupa por vendedor y fecha de corte
                    ▼
vendor_payouts (lote) ◄── settlements.payout_id   →  paid con bank_reference
refund ──► settlement negativo (status reversal) que descuenta del siguiente lote
```

Se agrega `settlements.payout_id` y el estado `reversed`; `vendor_payouts` deja de ser "por orden" y pasa a ser **lote**. Un test verifica la invariante `vendor_balances.* == Σ settlements` por vendedor.

### 6.5 Gate del addon `store` real

`store_seller_allowed(p_vendor_profile_id) → bool`, `SECURITY DEFINER STABLE`:

```
store_enabled()
AND vp.is_active AND vp.capabilities->>'can_sell_products' = 'true'
AND (vp.vendor_type <> 'school' OR has_entitlement(<school del dueño>, 'store'))
AND (vp.verification_status = 'verified' OR <vendor_type = 'school' con addon>)   -- D-4
```

Se usa en: policies **RESTRICTIVE** de SELECT público de `products`/`product_variants`/`product_media` (sin addon, la vitrina queda vacía para terceros; el dueño sigue viendo lo suyo), INSERT/UPDATE de `products`, `create_cart_order`, RPCs de inventario. BFF: middleware `requireStoreSeller` en `/vendor/products`, `/store/media`, pedidos. Frontend: `VendorGuard` + `useEntitlements().hasAddon('store')` — solo cosmético. Al vencer el addon: los productos se ocultan, los pedidos ya pagados se pueden seguir despachando.

### 6.6 ¿Quién cobra? (D-5, la decisión más grande)

| Vendedor | Recomendación | Por qué |
|---|---|---|
| Tienda escolar (addon `store`) | **Cobra con la pasarela de la propia escuela** (sus llaves Wompi / Connected Accounts). Sin payout. La comisión de SportMaps (si la hay) se factura en la factura SaaS mensual | La plata nunca pasa por SportMaps → no hay que operar payouts ni asumir riesgo regulatorio de agregador de pagos. Es el caso real de uso (familias de la escuela) |
| Vendedor externo | SportMaps cobra y liquida (settlements → payout) **solo después de validar con legal/finanzas** el esquema de recaudo a nombre de terceros. Hasta entonces, el vendedor externo queda fuera del piloto | Recaudar para terceros tiene implicaciones (mandato, retenciones, conciliación) |

Con eso, en el piloto el libro de payout (§6.4) se construye y prueba, pero el flujo de dinero real es el de la escuela.

### 6.7 Factura electrónica de órdenes

- **Emisor = dueño de la venta:** escuela (su configuración Factus) para tienda escolar; vendedor externo con su propio PAC, o sin factura (solo comprobante) si no tiene — nunca la escuela por un vendedor externo.
- Ítems con base + IVA según §6.3 (cuadra al peso con lo cobrado) + **línea de envío**.
- Se emite solo si `orders.status = 'paid'` **y** `paid_at` lo puso el webhook (service role). Guard en el emisor + trigger que impide pasar a `paid` sin `provider_transaction_id`. El cron `autoEmitPendingOrders` filtra por eso.
- Reembolso → nota crédito (total o parcial).

### 6.8 Integración con contabilidad (`cash_ledger`)

| Evento | Asiento | Dueño |
|---|---|---|
| Venta pagada (tienda escolar) | ingreso, `payment_category = 'tienda'` (se amplía el CHECK), fecha `paid_at`, base e IVA separados | escuela |
| Venta pagada (vendedor externo) | ingreso bruto | `owner_type='vendor'` |
| Comisión SportMaps | egreso del vendedor (`categoria = comision_plataforma`) | vendedor / escuela |
| Fee de pasarela | egreso (`fee_pasarela`) — corrige C10 para órdenes | vendedor / escuela |
| Payout | **no** es P&L: movimiento de caja (cuenta por cobrar a SportMaps → banco) | vendedor |
| Reembolso | reverso fechado el día del reembolso (mismo criterio que blindaje 2.4), nunca borra el ingreso original | dueño de la venta |
| Merma | egreso de inventario a costo promedio (opcional, D-12) | dueño |

Decisión de perímetro D-H de la auditoría: **la tienda entra al libro**. Se expone en `cash_ledger` con una rama nueva desde `orders`/`settlements` (no se insertan filas en `payments`, que tiene su propio guard).

---

## 7. Plan de migraciones (se crean con `npm run migrations:new`, una por bloque)

Ninguna edita una anterior. Cada una: `search_path` fijo, GRANT/REVOKE explícitos (también a `anon` y `authenticated`), probada primero en el ambiente de pruebas (§8.1) y luego en vivo **dentro de `BEGIN … ROLLBACK`**, aplicada por `apply_migration`, verificada preguntándole al objeto, y `npm run seguridad:invariantes` al final.

| Fase | Migración (slug) | Contenido |
|---|---|---|
| F0 | *(prerrequisito)* M1–M3 del blindaje aplicadas | `store_enabled`, guard de `vendor_profiles`, columnas públicas |
| F0 | `tienda_v2_orders_cerrar_escritura` | DROP policies insert/update de comprador en `orders`/`order_items`; REVOKE; CHECK de `orders.status` (migrando `paid` existente); trigger de columnas congeladas; `order_status_history` |
| F0 | `tienda_v2_products_guard` | Policies de INSERT/UPDATE de `products` (T5), REVOKE `stock`, `CHECK stock >= 0`, `trial_block` con `school_id NULL`, `store_seller_allowed()` + RESTRICTIVE |
| F0 | `tienda_v2_motor_orden` | `stock_holds`, `create_cart_order`, `quote_cart`, `cancel_my_order`, `order_transition`, `release_expired_holds` + `pg_cron`; DROP `confirm_order_payment` de 4 args y reescritura de la de 5 |
| F0 | `tienda_v2_settlements_unico` | `settlements.payout_id`, estado `reversed`, `compute_settlements_for_order` con redondeo y fee real; DROP/REVOKE `split_order_payment`, `admin_generate_pending_payouts` |
| F0 | `tienda_v2_refunds_reviews_rpc` | Refunds solo por RPC idempotentes; `answer_question`, `respond_review`, `create_review`; quitar UPDATE del vendedor (T9, T10, T11) |
| F0 | `tienda_v2_factura_y_ledger` | Guard de emisión, línea de envío, rama de órdenes en `cash_ledger`, `payment_category 'tienda'` |
| F1 | `tienda_v2_inventario_kardex` | Columnas de variantes (`option_*`, unicidad, sku por vendedor), variante "Única" para productos sin variantes, `products.stock` caché, `inventory_logs` → kardex completo append-only, `variant_costs`, RPCs §4.4, `v_vendor_low_stock` |
| F2 | `tienda_v2_product_media` | `product_media`, buckets `product-media-src` (privado) y `product-media` (público), policies de storage, REVOKE escritura en `product-images`, `validate_product_quality` con puntaje |
| F3 | `tienda_v2_busqueda` | `search_tsv`, `sport`, índices GIN/trgm, `search_products`, arreglo de `search_marketplace` |
| F3 | `tienda_v2_carrito_invitado` | `orders.guest_email`, `guest_token_hash`, `pickup_code_hash`; `carts` con `cart_token` |
| F4 | `tienda_v2_metricas_devoluciones` | `product_daily_stats`, `return_requests`, RPCs de devolución |

---

## 8. Plan de pruebas completo

### 8.1 Dónde se prueba (nunca contra producción)

Hay **una sola Supabase** (`luebjarufsiadojhvxgi`), plan Free → **no hay branching** (es de Pro). Y como ~336 objetos viven fuera de las migraciones (deriva de esquema), reconstruir la base corriendo `supabase/migrations/` **no** reproduce la real.

| Opción | Uso | Veredicto |
|---|---|---|
| **A. Supabase local (CLI + Docker)** cargada con `supabase db dump --schema-only` de la base viva (+ buckets y policies de storage) y un seed de tienda | SQL de RLS, concurrencia, vitest de integración del BFF, CI | **Sí — base de todo** |
| **B. Proyecto Supabase aparte `sportmaps-qa`** (Free permite 2 proyectos por organización; se pausa tras 7 días sin uso), mismo dump + seed, Wompi **sandbox**, BFF de QA en Render (o local) | Playwright E2E comprador/vendedor, pruebas visuales, piloto interno | **Sí** — antes, verificar si el `kbgwjkbqsabnsajdmgxn` del README de e2e existe y sirve |
| C. Datos `is_demo` en producción | — | **No para nada que escriba**: una orden "de prueba" pagada dispara `autoEmitPendingOrders` (factura DIAN real), toca `cash_ledger` y settlements. Solo se admite un smoke **de lectura** de la vitrina demo |
| D. Branch de Supabase | — | Requiere Pro; reconsiderar si se sube de plan (D-8) |

Guardas obligatorias: `global-setup` de Playwright y el setup de vitest de integración **abortan** si `SUPABASE_URL` contiene `luebjarufsiadojhvxgi` o si `WOMPI_PUBLIC_KEY` empieza por `pub_prod_`. Script `npm run qa:dump-schema` para refrescar el dump antes de cada fase (la base viva cambia). El seed vive en `supabase/seed/tienda_v2_seed.sql`: 2 escuelas (una con addon `store`, otra sin), 1 vendedor externo verificado, 1 sin verificar, padre miembro, padre ajeno, coach, anónimo, 6 productos (con y sin variantes, `school_only`, borrador, agotado, último ítem).

### 8.2 SQL de RLS — positivos y negativos

Formato de cada caso (archivo `supabase/tests/tienda_v2/*.sql`, corridos por un runner en vitest que reporta caso por caso):

```sql
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','<uuid padre>','role','authenticated')::text, true);
  -- caso
  insert into public.orders(user_id, total_amount, status) values ('<uuid padre>', 1000, 'paid');  -- esperado: 42501
rollback;
```

| # | Actor | Acción | Esperado |
|---|---|---|---|
| R1 | anon | `select * from products` | solo `active` + `public` de vendedores permitidos; 0 `school_only`, 0 borradores |
| R2 | anon | `select` de `product_media` de un borrador | 0 filas |
| R3 | anon | `select bank_data from vendor_profiles` | 42501 |
| R4 | padre miembro | `select` `school_only` de su escuela | ve; de otra escuela: 0 |
| R5 | comprador | INSERT/UPDATE directo en `orders`, `order_items` | 42501 |
| R6 | comprador | `create_cart_order` con precio en el JSON | precio ignorado; total = base |
| R7 | comprador | `create_cart_order` de un `school_only` ajeno, de un borrador, de vendedor sin addon | error tipado, nada creado |
| R8 | comprador | ver orden ajena / ítems ajenos | 0 filas |
| R9 | vendedor A | UPDATE `stock` directo | 42501 |
| R10 | vendedor A | `inventory_adjust` sobre variante de B | error `NOT_OWNER` |
| R11 | vendedor A | INSERT producto con `vendor_profile_id` de B / `school_id` ajeno | 42501 |
| R12 | vendedor | UPDATE `rating`/`status` de reseña; reescribir pregunta | 42501; `respond_review` ok |
| R13 | vendedor | UPDATE/DELETE `inventory_logs` | 42501 (append-only) |
| R14 | super admin | DELETE `inventory_logs` | 42501 (tampoco) |
| R15 | coach | ver `variant_costs`, `settlements` | 0 filas |
| R16 | comprador | INSERT `refunds` directo | 42501; `request_refund` ok |
| R17 | cualquiera | `store_enabled=false` → `create_cart_order` | `STORE_DISABLED` |
| R18 | escuela sin addon | publicar producto | bloqueado; con addon: ok |
| R19 | vendedor no verificado | publicar | `pending_review` |
| R20 | `authenticated` | `execute admin_generate_pending_payouts` / `split_order_payment` | sin permiso / no existe |
| R21 | anon | listar `storage.objects` de `product-media-src` | 0 |
| R22 | vendedor A | subir a `product-media-src/{B}/…` | denegado (solo URL firmada del BFF) |
| R23 | service role | webhook `confirm_order_payment` | ok, idempotente al repetir |

Al cerrar cada fase: `npm run seguridad:invariantes` sin CRÍTICAS nuevas y sin I3 nuevas en tablas de tienda.

### 8.3 Concurrencia de stock (vitest + `pg`, dos o más conexiones reales contra la base local)

| # | Escenario | Esperado |
|---|---|---|
| C1 | Dos compradores, `create_cart_order` simultáneo del **último** ítem (barrera con `pg_advisory_lock` para arrancar a la vez) | exactamente 1 orden; el otro `INSUFFICIENT_STOCK`; `reserved = 1`, `stock = 1` |
| C2 | 50 compradores sobre 10 unidades | 10 órdenes; `Σ holds = 10`; ninguna negativa |
| C3 | Dos carritos con las mismas 2 variantes en orden inverso | sin deadlock (orden por id); ambos resuelven |
| C4 | Webhook duplicado / concurrente del mismo pago | un solo descuento, un solo kardex `sale`, un solo set de settlements |
| C5 | Pago que llega después de expirar el hold, con stock agotado | `payment_review` `PAID_WITHOUT_STOCK`; stock ≥ 0 |
| C6 | `release_expired_holds` mientras llega el webhook | o consume o libera, nunca ambos |
| C7 | `inventory_adjust` del vendedor a 0 con holds activos | rechazado (`new_stock < reserved`) |
| C8 | `complete_refund` dos veces en paralelo | stock repuesto una vez |
| C9 | Importación CSV concurrente con una venta | la venta o la importación espera; kardex consistente |
| C10 | Invariante final de cada test | `stock = Σ kardex.delta` por variante; `reserved = Σ holds activos`; `vendor_balances = Σ settlements` |

### 8.4 Unitarias (vitest)

| BFF | Frontend |
|---|---|
| Cálculo IVA incluido por línea (0/5/19 %, redondeo, cuadre al peso) | Selector talla×color: combinaciones deshabilitadas sin stock |
| Cotización de envío por zona/modalidad | Precio de la ficha cambia con la variante |
| Firma Wompi con el total de la base | "Últimas N" según umbral |
| Webhook: monto distinto, moneda, idempotencia, prefijos | Merge de carrito invitado → usuario (tope por disponible) |
| Pipeline `sharp`: tamaños, 1:1, `flatten` a blanco, EXIF borrado (sin GPS), rotación, rechazo por magic bytes/peso/resolución, blurhash | Revalidación del carrito (precio cambió / ajuste de cantidad) |
| Parser CSV (BOM, `;`/`,`, decimales con coma, tildes, filas malas) | Checkout: recalcula al cambiar entrega; deshabilita pagar sin datos |
| Matriz de transiciones de orden por actor | Estados del pedido → etiqueta y línea de tiempo |
| Puntaje de calidad | Wizard: validación por paso, autoguardado |
| `requireStoreEnabled` / `requireStoreSeller` | `<ProductImage>`: `srcset`, lazy salvo portada |
| Dedupe del beacon de visitas | Manejo de errores de vitrina (404/503/403/red, T19) |

### 8.5 E2E Playwright (TypeScript) contra `sportmaps-qa`

`frontend/e2e/tienda/` con proyectos `desktop-chrome`, `iphone-13` (WebKit), `pixel-7`.

| Suite | Flujo |
|---|---|
| `comprador-escuela.spec.ts` | padre → menú Tienda → filtra talla M / color azul → ficha → galería → elige variante → agrega → carrito → checkout retiro en sede → Wompi sandbox aprobado → "confirmando" → pedido `paid` → vendedor marca listo → código de retiro → `delivered` → reseña verificada con contexto |
| `comprador-invitado.spec.ts` | link público → carrito invitado → login a mitad (merge) / o checkout invitado (si D-13) → link del pedido por token |
| `ultimo-item.spec.ts` | dos contextos de navegador compran el último ítem → uno ve "Ya no hay stock" sin cobro |
| `pago-rechazado.spec.ts` | Wompi sandbox `DECLINED` → hold liberado al expirar, orden `expired` |
| `vendedor-publicar.spec.ts` | wizard completo: matriz 3×2, fotos (fixtures reales de distintos tamaños/orientación), recorte, portada, alt → checklist → publicar → aparece en búsqueda |
| `vendedor-inventario.spec.ts` | entrada con costo, ajuste con motivo, merma, alerta de stock bajo, CSV con error en fila 3 → vista previa → corregir → importar |
| `vendedor-pedidos.spec.ts` | bandeja por estados, preparar → enviar con guía → entregado; cancelar con reembolso |
| `devolucion.spec.ts` | solicitar → aprobar → recibir → reintegrar a stock → reembolso → nota crédito |
| `preguntas-chat.spec.ts` | preguntar, responder, contactar desde el pedido |
| `addon-gate.spec.ts` | escuela sin addon: vitrina vacía para terceros y panel con upsell; `store_enabled=false`: "Tienda no disponible" |

Datos: cada spec crea lo suyo por RPC/servicio en `beforeAll` con prefijo `e2e-<runId>` y lo limpia en `afterAll` (en `sportmaps-qa`, no en producción; la regla "el usuario maneja las eliminaciones" aplica a la base real).

### 8.6 Pruebas visuales de la galería en móvil

`expect(page).toHaveScreenshot()` con umbral 0,2 % en `iphone-13` y `pixel-7`, más desktop:

| Caso | Verifica |
|---|---|
| Galería 1, 3 y 10 fotos | miniaturas/puntos, sin desborde horizontal |
| Swipe entre fotos | posición e indicador |
| Tap → visor a pantalla completa + pinch-zoom (`touchscreen` CDP en Chromium) | carga `zoom`, cierra con gesto/botón |
| Cambio de color | salta a la foto de la variante |
| Foto vertical, horizontal, PNG transparente | todas salen 1:1, fondo blanco donde corresponde |
| Red 3G simulada | placeholder blurhash, sin CLS (medido con `PerformanceObserver` de layout-shift < 0,05) |
| Modo oscuro | contraste de swatches y bordes |
| Safe-area (notch) | barra de compra fija no tapa contenido (gotcha de safe-area conocido) |

Más un presupuesto de rendimiento: LCP de la ficha < 2,5 s con throttling 4G en `pixel-7` (web-vitals inyectado), peso de la ficha < 600 KB en la primera vista.

### 8.7 Qué se corre en cada fase

| Fase | SQL RLS | Concurrencia | Unit | E2E | Visual |
|---|---|---|---|---|---|
| F0 | R1–R23 aplicables | C1–C4, C8, C10 | dinero, webhook, transiciones | — (sin UI nueva) + smoke de checkout existente | — |
| F1 | R9–R15 | C5–C10 | CSV, kardex | inventario | — |
| F2 | R2, R21, R22 | — | pipeline sharp, `<ProductImage>` | publicar | galería completa |
| F3 | R1, R4, R6–R8, R17 | C1 (vía UI) | carrito, checkout, búsqueda | comprador-*, último ítem, rechazado, addon | ficha, búsqueda, checkout |
| F4 | devoluciones, métricas | C8 | métricas | vendedor-pedidos, devolución | panel |
| F5 | reseñas/preguntas | — | contexto obligatorio | preguntas-chat, reseña | reseñas |

---

## 9. Decisiones abiertas (con recomendación)

| # | Decisión | Recomendación | Quién |
|---|---|---|---|
| D-1 | IVA incluido o sumado | **Incluido** (ya aprobado en el diseño de julio); se desglosa en la factura | Contador confirma |
| D-2 | Carrito multi-vendedor en un solo pago | **No en v2.0**: un checkout por tienda (el carrito sí agrupa varias). Multi-vendedor después del piloto | Producto |
| D-3 | Comisión | **0 % para tienda escolar** (ya paga el addon $49k/mes) + pasarela a cargo de la escuela; **10 %** para vendedores externos sobre el total del ítem con IVA, sin envío | Producto / finanzas |
| D-4 | ¿La tienda escolar necesita verificación? | **No**: el addon pagado ya identifica a la escuela; los externos sí | Producto |
| D-5 | ¿Quién cobra? | Escuela con su pasarela; externos solo tras validación legal (§6.6). Piloto **solo tienda escolar** | Producto + legal |
| D-6 | Pago en efectivo en sede | Sí, opcional por escuela, reserva 48 h | Producto |
| D-7 | AVIF | No en v2.0 (WebP); revisar con CDN propio | Técnica |
| D-8 | Plan de Supabase | Medios + proyecto QA presionan el Free (storage 1 GB, egress 5 GB). **Recomendado pasar a Pro antes del piloto** (habilita además branching y transformaciones) | Producto / finanzas |
| D-9 | Remoción automática de fondo | No en v2.0; `flatten`/relleno blanco sí. MediaPipe en R6 | Producto |
| D-10 | Ventana de devolución | 5 días hábiles de retracto + garantía legal; validar con legal | Legal |
| D-11 | IVA del envío | Según quién lo factura; validar | Contador |
| D-12 | ¿Merma y costo de ventas al libro? | Sí, como egreso de inventario a costo promedio, en F4 | Contador |
| D-13 | Checkout invitado | **Sí para vitrina pública** (diseño aprobado), con correo obligatorio, Turnstile y rate limit; las familias de la escuela siempre logueadas | Producto |

---

## 10. Fases

Tamaños: **S** ≤ 3 días · **M** 1–2 semanas · **L** 2–4 semanas. Una rama por fase (`feat/tienda-v2-f0-…`), PR a `develop`, revisión antes de la siguiente. Cada fase arranca con su **plan de migraciones aprobado** (§7) y termina con sus pruebas de §8.7 verdes en el ambiente de pruebas.

| Fase | Contenido | Tamaño | Listo cuando |
|---|---|---|---|
| **F0 — Requisitos para reprender (seguridad y dinero)** | Ambiente de pruebas A+B y guardas (§8.1); M1–M3 del blindaje aplicadas; cierre de T3–T11, T16 (cálculo), T17, T20 (§6.1); `create_cart_order` + holds + `confirm_order_payment` único; un solo motor de settlements; refunds por RPC; factura y `cash_ledger` de órdenes; D-1, D-3, D-5 decididas | **L** | R1–R23 y C1–C4/C8/C10 verdes; `seguridad:invariantes` sin CRÍTICAS ni I3 nuevas en tienda; el checkout actual del BFF compra en QA de punta a punta con Wompi sandbox; T21 verificado; ninguna tabla de dinero/stock con INSERT/UPDATE para `authenticated` (consulta a `pg_policies` + `information_schema.role_table_grants` en el PR) |
| **F1 — Inventario serio** | Variantes con opciones y unicidad, variante "Única", kardex append-only, costo, RPCs de inventario, alertas, CSV | **M** | C5–C10 verdes; `stock = Σ kardex` en el seed tras la suite; importación de 2.000 filas < 30 s; panel de inventario usable en móvil |
| **F2 — Imágenes buenas** | `product_media`, buckets, pipeline `sharp`, recortador, portada/orden/alt, `<ProductImage>`, calidad con puntaje | **M** | Unitarias del pipeline verdes (incluye EXIF/GPS borrado); R2/R21/R22 verdes; snapshots de galería aprobados; LCP < 2,5 s y CLS < 0,05 en `pixel-7`; consumo de storage medido por foto y anotado en D-8 |
| **F3 — Experiencia del comprador** | Vitrina, búsqueda con facetas, ficha completa, carrito persistente + invitado, checkout de 1 pantalla, mis compras, estados y código de retiro; borrar flujo viejo (T15), T18, T19 | **L** | E2E comprador-*, último ítem, rechazado y addon verdes en los 3 dispositivos; visuales aprobados; 0 llamadas del front que escriban `orders`/`order_items`/`stock` (grep en el PR) |
| **F4 — Panel del vendedor** | Wizard rehecho, bandeja de pedidos, métricas, devoluciones | **L** | E2E vendedor-* y devolución verdes; invariante `vendor_balances = Σ settlements` tras devoluciones; métricas cuadran con `orders` en el seed |
| **— Gate de piloto —** | `store_enabled = true` + addon en **una** escuela (tienda escolar, D-5) en producción | — | F0–F4 listas y revisadas; smoke de lectura en prod; plan de rollback = volver a `false` (sin deploy); monitoreo de 2 semanas con revisión diaria de órdenes, kardex y facturas |
| **F5 — Confianza** | Reseñas verificadas con contexto, ≤2★ con 24 h, preguntas por RPC, reputación del vendedor, chat desde el pedido + realtime | **M** | Suite de reseñas/preguntas verde; vendedor no puede moderar (R12) |
| **F6 — Envíos con agregador** | Mox vs Drenvio (evaluación), cotización en la ficha, etiquetas, tracking a `shipments.events` | **M** | Envío sandbox de punta a punta; fallback a `shipping_zones` si el agregador cae |
| **Fuera de v2** | 3D/AR, video, 360°, remoción de fondo (R6); promociones y cupones (R5); multi-vendedor en un pago; C2C; multipaís | — | — |

Orden recomendado: F0 → F1 → F2 → F3 → F4 → piloto → F5 → F6. F1 y F2 pueden ir en paralelo (no comparten tablas) si hay dos personas, con revisiones separadas.

---

## 11. Riesgos

| Riesgo | Mitigación |
|---|---|
| La deriva de esquema hace que el ambiente de pruebas no se parezca a producción | Dump de esquema de la base viva antes de cada fase, no replay de migraciones |
| Plan Free: storage/egress de imágenes y 2 proyectos máximo | D-8 (Pro antes del piloto); presupuesto medido en F2 |
| `sharp` satura el BFF en Render | Cola con concurrencia 1–2, límites de píxeles, timeout; mover a worker si crece |
| Recaudar para terceros (vendedores externos) sin marco legal | Piloto solo con tienda escolar cobrando con su propia pasarela (D-5) |
| Reembolsos: Wompi no reembolsa por API todos los medios (PSE) | Reembolso manual asistido con registro en `refunds`; el estado del pedido no depende de que Wompi lo haga |
| Factura DIAN emitida de más | Guard de `paid` + `provider_transaction_id`; tests de emisión; el cron respeta `store_enabled` |
| Cambio de `orders.status` a CHECK rompe lectores que esperan valores viejos | Inventario de lectores (`grep` de estados) en el plan de F0; mapeo explícito |
| M1–M3 del blindaje siguen sin aplicar: hoy la tienda **no** está apagada en la base | Aplicarlas antes de empezar F0 (prerrequisito) |
| Mezclar con Artículos escolares o con `payments` | Regla dura: la tienda no escribe en `payments`; entra al libro por su propia rama |
