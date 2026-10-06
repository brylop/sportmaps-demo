/**
 * Contenido para Sportbot / Centro de Ayuda — manual "Tienda escolar" (versión ACADEMIAS,
 * sin notas internas). Listo para pegar en bff/src/data/help-articles.ts.
 *
 * Qué hacer con cada uno:
 *   1. TIENDA_ESCUELA → REEMPLAZA el artículo existente con slug "tienda-inventario-productos"
 *      (mismo slug, mismo categoryId). El actual describe cosas que no existen: "Valor Total de
 *      Inventario", "Productos sin Stock", umbral de stock bajo configurable, conciliación con
 *      Wompi, categorías Uniforme/Accesorio, y no menciona pedidos, comprobantes ni código de retiro.
 *   2. TIENDA_FAMILIA → artículo NUEVO (slug "tienda-escolar-comprar", categoría
 *      "para-padres-atletas"). No hay ningún artículo para el comprador hoy.
 *   "vendor-productos-catalogo" (vendedores externos) no se toca.
 *
 * Ojo: la tienda está APAGADA en producción (store_enabled=false). Publicar estos artículos
 * antes de prender la tienda haría que el bot explique una pantalla que las escuelas no ven.
 */
import type { HelpArticle } from './help-articles';

export const TIENDA_ESCUELA: HelpArticle = {
  slug: 'tienda-inventario-productos',
  categoryId: 'gestion-alumnos',
  title: 'Tienda escolar: productos, medios de pago y pedidos',
  excerpt:
    'Activa la tienda de tu escuela, carga uniformes y accesorios con tallas y stock, y aprueba, prepara y entrega cada pedido con el código de retiro.',
  readTime: '7 min',
  targetRole: ['school'],
  body: [
    {
      type: 'p',
      content:
        'La tienda escolar es la vitrina de tu escuela dentro de SportMaps: las familias compran uniformes y accesorios desde el celular, pagan por transferencia o en efectivo, y retiran en la sede con un código de retiro de 6 dígitos. Solo el owner y los administradores gestionan la tienda; los entrenadores no ven sus pedidos.',
    },
    { type: 'h2', content: '1. Activar la tienda' },
    { type: 'callout', variant: 'info', content: 'Panel de Escuela → tarjeta "Mi Tienda" → Activar tienda escolar' },
    {
      type: 'p',
      content:
        'La tienda es un adicional del plan. Con el adicional contratado, el botón crea la tienda y lleva a Productos; sin él, lleva a Facturación. Desde ese momento el menú lateral tiene el grupo Mi Tienda: Productos, Inventario y Pedidos.',
    },
    { type: 'h2', content: '2. Medios de pago' },
    { type: 'callout', variant: 'info', content: 'Finanzas → Pagos → pestaña Config' },
    {
      type: 'ul',
      items: [
        'Transferencia: la tienda usa las mismas cuentas y llaves (Bre-B, Nequi, Daviplata) de "Datos de Pago para Transferencia". La familia las ve al pagar y sube el comprobante.',
        'Efectivo al retirar: la familia recibe un código de retiro y paga en la sede.',
        'Pago en línea (tarjeta, PSE, Nequi): solo si la escuela tiene conectada su propia cuenta de recaudo (SportMaps Pay). El dinero entra directo a la cuenta de la escuela. La conexión la hace el equipo de SportMaps; nunca envíes tus llaves por chat.',
      ],
    },
    {
      type: 'p',
      content:
        'Los productos de un pedido sin pagar quedan reservados 48 horas. Para prender o apagar un medio de pago de la tienda, o cambiar esas horas, escríbenos por el chat de soporte.',
    },
    { type: 'h2', content: '3. Crear un producto con tallas y colores' },
    { type: 'callout', variant: 'info', content: 'Mi Tienda → Productos → Nuevo Producto' },
    {
      type: 'ol',
      items: [
        'Categoría: Ropa Deportiva para uniformes y camisetas (pide talla y color); Equipamiento o Accesorios para rodilleras, balones o termos.',
        'Información: nombre (mínimo 5 caracteres), descripción (mínimo 30), precio con IVA incluido, porcentaje de IVA y al menos una foto (JPG, PNG o WebP, hasta 5 MB). En ropa, Género es obligatorio.',
        'Variantes: prende "Este producto tiene variantes", marca las tallas y escribe cada color (Enter para agregarlo). En "Stock por variante" va cuántas unidades hay de cada combinación. Deja "Precio override" vacío para usar el precio del producto.',
        'Visibilidad y publicar: "Solo mi escuela" (solo familias de la escuela con sesión iniciada), "Público" (cualquiera con el enlace) o "Privado" (no aparece). Luego Publicar, o Guardar borrador.',
      ],
    },
    {
      type: 'callout',
      variant: 'warning',
      content:
        'El asistente pone la misma cantidad en todas las tallas y colores. Si una talla tiene menos unidades, carga la cantidad más baja o escríbenos para ajustarla.',
    },
    { type: 'h2', content: '4. Inventario' },
    {
      type: 'p',
      content:
        'El stock baja solo: cada pedido reserva las unidades y, si se cancela o vence sin pago, las devuelve. Nadie puede comprar más de lo que hay. En Mi Tienda → Inventario ves los productos con stock bajo. Con el lápiz de un producto cambias nombre, precio, fotos y visibilidad. Para reponer unidades de una talla ya creada, escríbenos por el chat de soporte con el producto, la talla y la cantidad. El ícono rojo archiva un producto sin borrar los pedidos anteriores.',
    },
    { type: 'h2', content: '5. Compartir la tienda' },
    {
      type: 'p',
      content:
        'Las familias de la escuela la encuentran en su menú (Seguimiento → Tienda). Para promocionarla, comparte el enlace app.sportmaps.co/tienda/nombre-de-tu-tienda en los grupos de WhatsApp. Sin sesión se ven los productos públicos; los de "Solo mi escuela" aparecen cuando la familia entra con su cuenta. Si no tienes a mano el enlace de tu tienda, pídelo por el chat de soporte.',
    },
    { type: 'h2', content: '6. Gestionar los pedidos' },
    { type: 'callout', variant: 'info', content: 'Mi Tienda → Pedidos' },
    {
      type: 'table',
      headers: ['El pedido está…', 'Qué haces', 'Botón'],
      rows: [
        ['Esperando aprobación', 'Abre el pedido, pulsa "Ver comprobante" y compáralo con el extracto del banco', 'Aprobar pago / Rechazar comprobante (con motivo)'],
        ['Pagado', 'Empieza a alistarlo', 'Preparar pedido'],
        ['En preparación', 'Avísale a la familia que ya puede pasar', 'Listo para retirar'],
        ['Listo para retirar', 'Pide el código de 6 dígitos a quien llega a la sede', 'Entregar con código'],
        ['Pendiente de pago, en efectivo', 'Recibe el dinero y escribe el código', 'Cobrar y entregar'],
        ['Pendiente de pago', 'Si la familia ya no lo quiere', 'Cancelar pedido (libera los productos)'],
      ],
    },
    {
      type: 'p',
      content:
        'Si rechazas un comprobante, la familia ve el motivo y tiene 24 horas para subir otro. Si el código no coincide, SportMaps no deja entregar: así nadie retira un pedido ajeno. El Historial de cada pedido guarda cada paso con fecha, hora y quién lo hizo.',
    },
  ],
  related: ['tienda-escolar-comprar'],
};

export const TIENDA_FAMILIA: HelpArticle = {
  slug: 'tienda-escolar-comprar',
  categoryId: 'para-padres-atletas',
  title: 'Comprar en la tienda de la escuela',
  excerpt:
    'Uniformes y accesorios del club desde el celular: elige la talla, paga por transferencia o en efectivo y retira en la sede con tu código.',
  readTime: '4 min',
  targetRole: ['parent', 'athlete'],
  body: [
    { type: 'callout', variant: 'info', content: 'Menú → Seguimiento → Tienda (o el enlace que compartió la escuela)' },
    { type: 'h2', content: 'Elegir y pagar' },
    {
      type: 'ol',
      items: [
        'Abre la tienda. Los productos marcados "Solo tu escuela" son exclusivos para las familias del club.',
        'En los productos con tallas pulsa "Elegir talla". Las tallas agotadas aparecen apagadas. Elige la cantidad y "Agregar al carrito" (o "Comprar ahora").',
        'Abre "Ver carrito" y pulsa "Pagar". Si tienes productos de dos tiendas distintas, cada una se paga por separado.',
        'En la pantalla de pago: la entrega es Retiro en sede (gratis; si aparece Envío a domicilio, úsalo solo si la escuela te confirmó que hace envíos), tus datos vienen de tu cuenta, y eliges el medio de pago. El total ya incluye el IVA.',
      ],
    },
    { type: 'h2', content: 'Si pagas por transferencia' },
    {
      type: 'ul',
      items: [
        'Al confirmar ves las cuentas de la escuela (con botón para copiar) y el total. Tus productos quedan reservados mientras pagas.',
        'Transfiere y pulsa "Subir comprobante" (foto o PDF, hasta 5 MB). El pedido pasa a "Esperando aprobación".',
        'Si la escuela rechaza el comprobante, verás el motivo arriba y podrás subir otro.',
        'Cuando la escuela aprueba y alista el pedido, el seguimiento muestra "Listo para retirar".',
      ],
    },
    { type: 'h2', content: 'Si pagas en efectivo' },
    {
      type: 'p',
      content:
        'Elige "Efectivo al retirar". No pagas nada en línea: el pedido queda reservado y recibes tu código de retiro. Pasa por la sede, paga y la escuela te entrega en el mismo momento.',
    },
    {
      type: 'callout',
      variant: 'warning',
      content:
        'El código de retiro de 6 dígitos se muestra una sola vez y solo en el celular donde hiciste el pedido. Tómale foto o pantallazo: lo necesitas para recibir tu pedido.',
    },
    { type: 'h2', content: 'Mis compras' },
    {
      type: 'p',
      content:
        'En Menú → Seguimiento → Mis compras están todos tus pedidos con su estado. Un pedido que todavía no has pagado (o cuyo comprobante está en revisión) se puede cancelar desde el mismo pedido con "Cancelar pedido". Para cualquier duda, usa "Contactar a la tienda" en la vitrina o el chat de soporte.',
    },
  ],
  related: ['tienda-inventario-productos'],
};
