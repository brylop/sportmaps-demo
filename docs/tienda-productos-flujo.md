# Tienda de productos — flujo de venta sin fricción (spec de diseño)

> **Estado:** diseño APROBADO (2026-07-10). Es el norte para construir la vitrina
> pública y el checkout de productos. Mockup visual de referencia: artifact
> "Tienda SportMaps — flujo de venta sin fricción".
>
> **Alcance:** SOLO productos. Las mensualidades/planes de la escuela viven en
> otro flujo (escuela→familias) y NO forman parte de la tienda/addon.

## Principio
Comprar en 3 toques. Precios con IVA incluido, retiro en la escuela por defecto,
datos y pago guardados. El mismo catálogo y checkout sirven para la tienda de la
escuela (familias) y para vendedores externos — cambia solo la entrega.

## Flujo de compra (4 pantallas)
1. **Vitrina** — grid limpio, precio grande (IVA incluido), un toque para
   "Agregar". Chip "Solo tu escuela" cuando la visibilidad es `school_only`.
   Barra de carrito fija abajo.
2. **Carrito** — drawer que se desliza sobre la vitrina (no cambia de página);
   steppers de cantidad; el total mostrado ya es el final.
3. **Pagar (una sola pantalla)** — Entrega + Datos de facturación + Método de
   pago, sin pasos ni redirecciones. Botón `Pagar $X`.
4. **Listo** — confirmación con # de pedido + factura electrónica al instante.

## Las 6 decisiones anti-fricción
1. Precio final con IVA incluido — nada se suma al final.
2. **Retiro en la escuela por defecto** — para familias, cero campos de dirección
   ni costo de envío (mayor quita-fricción interno).
3. Datos fiscales/dirección guardados — se piden una sola vez y se reutilizan.
4. Pago con método guardado (1 toque) — también PSE, Nequi, efectivo.
5. Checkout en una sola pantalla.
6. Factura automática al pagar (ya construida — ver `project_electronic_invoicing`).

## Descubrir y compartir
- **Interno (familias):** ítem "Tienda" en el menú → abre la tienda de su escuela
  activa. Selector de escuela arriba para familias con hijos en varias. Ve todos
  los productos, incluidos los `school_only`. Entrega por defecto: **retiro en sede**.
- **Externo (cualquiera):** llega por **Explorar** (todo el ecosistema) o por la
  **vitrina pública** del vendedor (URL compartible `…/tienda/:slug`). Mismo flujo,
  entrega por defecto: **envío a domicilio**. Checkout como invitado.
- **Compartir en redes:** botón "Compartir tienda" en el panel del vendedor →
  link + **QR** + vista previa (OG) para Instagram/WhatsApp/Facebook.

## Visibilidad por producto (`product_visibility`)
| Nivel | Explorar | Vitrina pública | Dentro de la app (familias) |
|---|---|---|---|
| `public` | ✅ | ✅ | ✅ |
| `school_only` | ❌ | ❌ | ✅ |
| `private` | ❌ | ❌ | ❌ (borrador) |

## Cómo aparece según entrada
| | Entrada | Quién | Entrega por defecto |
|---|---|---|---|
| App | Menú "Tienda" | Familias de la escuela | Retiro en sede |
| Link público / redes | URL + QR | Cualquiera (invitado) | Envío a domicilio |

## Notas de implementación
- Vitrina pública real = `VendorPublicProfilePage` (hoy stub) — construir contra
  el diseño de este spec.
- Tienda escolar = addon `store`; la escuela obtiene `vendor_profile` tipo
  `school` con `can_sell_products=true`. Solo productos.
- Producto de escuela: `products.school_id NOT NULL`; externo: `vendor_profile_id`.
- Facturación de ventas de productos: emitir desde `orders` (ver pendiente
  "emit-source #3" en `project_electronic_invoicing`).
- **Backend pendiente antes de que funcione end-to-end** (ver
  `project_stores_marketplace_state`): motor de inventario (`stock_holds`),
  RPCs de orden, y despliegue/reconciliación del marketplace (hoy parcial en la
  DB del user). No aplicar cambios de esquema mientras el equipo ajusta el módulo.
