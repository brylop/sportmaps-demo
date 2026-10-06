// Genera el manual "Tienda escolar" en sus dos versiones (interno / academias) como
// HTML + PDF, con las capturas reales de ./shots/ (gemelo local, ver capture.mjs).
//
//   node docs/manuales/_src/manual-tienda/build.mjs
//
// Sistema visual: el de todos los manuales (manual.css, memoria feedback_pdf_manual_template).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../..');
const require = createRequire(path.join(repo, 'frontend', 'package.json'));
const { chromium } = require('playwright');

const SHOTS = path.join(here, 'shots');
const CROPS = path.join(here, 'shots', 'crops');
const OUT = {
  academias: path.join(repo, 'docs/manuales/academias/manual-tienda'),
  interno: path.join(repo, 'docs/manuales/interno/manual-tienda'),
};
const SCALE = 2; // escritorio 1600×1000 @2x

// ── Recortes de escritorio (CSS px del viewport 1600×1000) ────────────────
const CROP_DEFS = {
  'menu-mi-tienda.png':   { src: '02b-menu-mi-tienda.png',          x: 0,    y: 560, w: 256,  h: 360 },
  'categoria.png':        { src: '06-asistente-categoria.png',      x: 490,  y: 195, w: 880,  h: 435 },
  'productos.png':        { src: '10-producto-publicado.png',       x: 420,  y: 100, w: 1020, h: 540 },
  'inventario.png':       { src: '12-inventario.png',               x: 270,  y: 95,  w: 1320, h: 420 },
  'pedidos.png':          { src: '30-pedidos-lista.png',            x: 270,  y: 95,  w: 1320, h: 560 },
  'detalle.png':          { src: '31-pedido-detalle-comprobante.png', x: 1080, y: 0,  w: 520,  h: 820 },
  'pagado.png':           { src: '33-pagado-preparar.png',          x: 1080, y: 0,   w: 520,  h: 660 },
  'listo.png':            { src: '34-listo-para-retirar.png',       x: 1080, y: 0,   w: 520,  h: 640 },
  'entregado.png':        { src: '36-entregado-historial.png',      x: 1080, y: 0,   w: 520,  h: 920 },
  'pedidos-final.png':    { src: '43-pedidos-al-final.png',         x: 270,  y: 95,  w: 1320, h: 560 },
};

async function makeCrops(browser) {
  fs.mkdirSync(CROPS, { recursive: true });
  const page = await browser.newPage();
  for (const [out, d] of Object.entries(CROP_DEFS)) {
    const src = path.join(SHOTS, d.src);
    if (!fs.existsSync(src)) throw new Error(`Falta ${d.src}. Corre capture.mjs — este manual no lleva mockups.`);
    const b64 = fs.readFileSync(src).toString('base64');
    const cropped = await page.evaluate(async ([b64, d, s]) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = d.w * s; c.height = d.h * s;
      c.getContext('2d').drawImage(img, d.x * s, d.y * s, d.w * s, d.h * s, 0, 0, d.w * s, d.h * s);
      return c.toDataURL('image/png').split(',')[1];
    }, [b64, d, SCALE]);
    fs.writeFileSync(path.join(CROPS, out), Buffer.from(cropped, 'base64'));
  }
  await page.close();
}

// ── Piezas ────────────────────────────────────────────────────────────────
function b64(file) {
  const fp = fs.existsSync(path.join(CROPS, file)) ? path.join(CROPS, file) : path.join(SHOTS, file);
  if (!fs.existsSync(fp)) throw new Error(`Falta ${file}`);
  return 'data:image/png;base64,' + fs.readFileSync(fp).toString('base64');
}
const img = (file, caption, style) =>
  `<div class="shot-wrap"><img class="shot" style="${style}" src="${b64(file)}" alt="${caption}"/>` +
  (caption ? `<div class="shot-caption">${caption}</div>` : '') + `</div>`;
const full = (file, caption, maxH = 300) => img(file, caption, `max-height:${maxH}px`);
const crop = (file, caption, width) => img(file, caption, `width:${width}px;max-height:none`);
// Teléfono: ventana de alto fijo sobre la captura móvil (Pixel 7); `top` = desde qué fracción de la captura.
const phone = (file, caption, { h = 470, top = 0, w = 232 } = {}) =>
  `<figure class="phone"><div class="phone-frame" style="width:${w}px;height:${h}px">` +
  `<img src="${b64(file)}" style="width:100%;margin-top:calc(-${top} * var(--ih, 0px))" data-top="${top}"/></div>` +
  (caption ? `<figcaption>${caption}</figcaption>` : '') + `</figure>`;
const phones = (...ph) => `<div class="phones">${ph.join('')}</div>`;

const step = (n, title, body, pic = '') =>
  `<div class="step"><div class="step-head"><div class="step-badge">${n}</div><div class="step-title">${title}</div></div>${body}${pic}</div>`;
const p = (html, cls = '') => `<p${cls ? ` class="${cls}"` : ''}>${html}</p>`;
const warn = (tag, html) => `<div class="callout warn"><span class="tag">${tag}</span>${html}</div>`;
const tip = (tag, html) => `<div class="callout tip"><span class="tag">${tag}</span>${html}</div>`;
const internal = (html) => `<div class="callout internal"><span class="tag">🔒 Interno</span>${html}</div>`;
const chapter = (n, title, crumb, intro) =>
  `<div class="chapter-head"><div class="chapter-badge">${n}</div><h2 class="chapter-title">${title}</h2></div>` +
  `<div class="breadcrumb">${crumb}</div><hr class="chapter-rule" />${intro ? p(intro) : ''}`;
const part = (letter, title, sub) =>
  `<div class="part"><div class="part-letter">${letter}</div><div><div class="part-title">${title}</div><div class="part-sub">${sub}</div></div></div>`;

// ── Contenido: cada entrada es UNA página ────────────────────────────────
function pages(isInternal) {
  const I = (html) => (isInternal ? internal(html) : '');
  const pgs = [];

  // Página de orientación
  pgs.push(
    `<h2 class="chapter-title" style="margin-bottom:6px">Cómo funciona la tienda</h2><hr class="chapter-rule" />` +
    p('La tienda escolar es la vitrina de la escuela dentro de SportMaps: uniformes, accesorios y artículos del club que las familias compran desde el celular y <b>retiran en la sede</b>. La escuela carga los productos con sus tallas y colores, las familias pagan por <b>transferencia</b> (subiendo el comprobante) o en <b>efectivo al retirar</b>, y la escuela aprueba, prepara y entrega cada pedido con un <b>código de retiro</b> de 6 dígitos.') +
    `<table class="tbl"><tr><th>Estado del pedido</th><th>Qué significa</th><th>Quién lo mueve</th></tr>
      <tr><td><b>Pendiente de pago</b></td><td>La familia hizo el pedido; los productos quedan <b>reservados</b> (48 h por defecto).</td><td>La familia paga o sube el comprobante</td></tr>
      <tr><td><b>Esperando aprobación</b></td><td>La familia subió el comprobante de la transferencia. Mientras se revisa, la reserva no vence.</td><td>La escuela aprueba o rechaza</td></tr>
      <tr><td><b>Pagado</b></td><td>El pago está confirmado.</td><td>La escuela: "Preparar pedido"</td></tr>
      <tr><td><b>En preparación</b></td><td>La escuela está alistando el pedido.</td><td>La escuela: "Listo para retirar"</td></tr>
      <tr><td><b>Listo para retirar</b></td><td>La familia puede pasar por la sede.</td><td>La escuela entrega con el código</td></tr>
      <tr><td><b>Entregado</b></td><td>Pedido cerrado.</td><td>—</td></tr>
      <tr><td><b>Cancelado / Vencido</b></td><td>El pedido se canceló o la reserva venció sin pago; los productos vuelven al inventario.</td><td>La escuela, la familia o el sistema</td></tr></table>` +
    tip('Dos partes', '<b>Parte A</b> (capítulos 1 a 6) es para el owner o el administrador de la escuela. <b>Parte B</b> (capítulos 7 a 11) es lo que ve la familia en el celular: sirve para explicarle a un papá cómo comprar, o para reenviarle esas páginas.') +
    warn('Quién puede gestionar la tienda', 'Solo el <b>owner y los administradores</b> de la escuela. Los entrenadores no ven pedidos ni dinero de la tienda.') +
    I('Esta guía se capturó contra el <b>gemelo local</b> (Supabase en Docker con el esquema de la viva, docs/qa-gemelo-local.md), porque en la base real la tienda está <b>apagada</b> (<code>platform_config.store_enabled = false</code>). Club, personas, productos, cuentas y comprobante son ficticios (escenario <code>tienda-qa-andes</code> renombrado por <code>_src/manual-tienda/gemelo-manual.sql</code>). Fotos de producto ilustradas, no fotos reales.')
  );

  // ═══ PARTE A ═══
  pgs.push(
    part('A', 'La escuela', 'Owner o administrador · computador') +
    chapter(1, 'Activar la tienda escolar', 'Panel de Escuela → tarjeta "Mi Tienda"',
      'La tienda es un <b>adicional</b> del plan de la escuela. Una vez contratado, se activa con un clic y aparece el grupo <b>Mi Tienda</b> en el menú lateral.') +
    step(1, 'Pulsar "Activar tienda escolar"',
      p('En el Panel de Escuela aparece la tarjeta <b>Mi Tienda</b>. Si la escuela ya tiene el adicional, el botón crea la tienda y lleva directo a <b>Productos</b>. Si no lo tiene, lleva a <b>Facturación</b> para contratarlo.'),
      crop('01-cta-activar.png', 'La tarjeta de activación en el Panel de Escuela.', 640)) +
    step(2, 'El menú "Mi Tienda"',
      p('Desde ese momento el menú lateral tiene el grupo <b>Mi Tienda</b>: <b>Productos</b>, <b>Inventario</b> y <b>Pedidos</b> son las tres pantallas de uso diario.'),
      crop('menu-mi-tienda.png', 'El grupo Mi Tienda del menú lateral.', 125)) +
    I('<b>La tienda se prende por escuela, con allowlist.</b> Para vender hacen falta las cuatro cosas: (1) <code>platform_config.store_enabled.enabled = true</code> (hoy <b>false</b> en la viva), (2) el <code>vendor_profile_id</code> de la tienda dentro de <code>store_enabled.allowlist</code> (piloto D-14; <code>store_seller_allowed()</code>), (3) el adicional <code>store</code> pagado y (4) perfil verificado con <code>can_sell_products</code>. Como la allowlist guarda el id del perfil, el orden es: la escuela activa (crea el perfil con <code>enable_school_store</code>) y <b>después</b> SportMaps agrega su id. La tarjeta se muestra con solo el flag global, aunque la escuela no esté en la allowlist, y "Facturación" no resalta el adicional Tienda (llega con <code>?upsell=store</code> pero muestra los planes).')
  );

  pgs.push(
    chapter(2, 'Configurar los medios de pago', 'Finanzas → Pagos → pestaña Config',
      'La tienda cobra con los <b>mismos datos de pago de la escuela</b>: no hay que cargarlos dos veces. Las familias pueden pagar por <b>transferencia</b> (a la cuenta o a las llaves de la escuela), en <b>efectivo al retirar</b> o, si la escuela tiene su propia cuenta de recaudo conectada, en línea con <b>Wompi o Mercado Pago</b>.') +
    step(1, 'Cuentas y llaves para transferencia',
      p('En <b>Datos de Pago para Transferencia</b> van el banco, el tipo y el número de cuenta, el titular con su NIT, y las <b>llaves</b> (Bre-B, Nequi, Daviplata). Al pagar un pedido por transferencia, la familia ve exactamente estas cuentas, con botón para copiar cada número.'),
      crop('03-cuentas-transferencia.png', 'Datos de Pago para Transferencia: cuenta bancaria y llave Nequi del club.', 560))
  );
  pgs.push(
    step(2, 'Pagos en línea con la cuenta propia de la escuela',
      p('En la misma pestaña, <b>SportMaps Pay</b> muestra si la escuela tiene conectada su cuenta de recaudo. El dinero de la tienda entra <b>directo a la cuenta de la escuela</b>; SportMaps no lo recibe ni lo retiene. La conexión la hace el equipo de SportMaps con la escuela: <b>nunca envíes tus llaves por chat</b>.'),
      crop('04-pasarela-propia.png', 'SportMaps Pay: estado de la cuenta de recaudo de la escuela.', 600)) +
    step(3, 'Qué medios ofrece la tienda',
      p('Cuando se activa la tienda, SportMaps la deja con los medios que la escuela elija: <b>transferencia</b>, <b>efectivo al retirar</b> y, si hay cuenta conectada, <b>pago en línea</b>. Los productos de un pedido sin pagar quedan reservados <b>48 horas</b>. Para cambiar los medios o esas horas, escríbenos por el chat de soporte.', 'no-shot')) +
    tip('Efectivo al retirar', 'Con efectivo, la familia no paga nada en línea: recibe un <b>código de retiro</b>, pasa por la sede y paga ahí. La escuela cobra y entrega en el mismo paso (capítulo 6).') +
    I('<b>No existe pantalla para los medios de la tienda.</b> <code>store_payment_settings</code> (accept_transfer / accept_cash_pickup / accept_wompi / accept_mercadopago, instrucciones, horas de reserva) solo se cambia con <code>PUT /api/v1/store/vendor/:vendorProfileId/payment-settings</code> o la RPC <code>set_store_payment_settings</code>. Y <code>enable_school_store</code> <b>no crea la fila</b>: una tienda recién activada tiene <b>cero medios</b> (<code>store_payment_methods</code> devuelve <code>[]</code>) y su checkout no deja pagar. Al activar una escuela hay que crearla a mano. Otros detalles: las cuentas salen de <code>school_settings.payment_accounts</code> + columnas <code>bank_*</code> (<code>_store_transfer_accounts</code>), y esa función <b>ignora la marca "Solo para inscripciones"</b> (<code>only_for</code>): una llave reservada para inscripciones aparece igual en la tienda. Wompi/MP usan <code>school_payment_providers</code> de la escuela (D-5); en el gemelo no hay llaves de sandbox, así que el pago en línea no se capturó.')
  );

  pgs.push(
    chapter(3, 'Crear productos con tallas, colores y stock', 'Mi Tienda → Productos → Nuevo Producto',
      'Un asistente de 4 pasos: categoría, información y fotos, variantes con su stock, y publicación. El ejemplo crea el <b>Uniforme de juego</b> en tallas S a XL y dos colores.') +
    step(1, 'Elegir la categoría',
      p('Para uniformes, camisetas y pantalonetas: <b>Ropa Deportiva</b> (pide talla y color). Para rodilleras, balones o termos: <b>Equipamiento</b> o <b>Accesorios</b>.'),
      crop('categoria.png', 'Paso 1 de 4: la categoría define qué datos se piden después.', 560))
  );
  pgs.push(
    step(2, 'Nombre, descripción, precio y foto',
      p('Nombre (mínimo 5 caracteres), descripción (mínimo 30), <b>precio con IVA incluido</b>, el porcentaje de IVA y al menos <b>una foto</b> (JPG, PNG o WebP, hasta 5 MB; la primera es la principal). <b>Género</b> es obligatorio en ropa.'),
      crop('07-asistente-info.png', 'Paso 2 de 4: información básica del Uniforme de juego.', 430))
  );
  pgs.push(
    step(3, 'Tallas, colores y stock',
      p('Prende <b>Este producto tiene variantes</b>, marca las tallas y escribe cada color (Enter para agregarlo). SportMaps arma todas las combinaciones (4 tallas × 2 colores = 8). En <b>Stock por variante</b> va cuántas unidades hay de <b>cada</b> combinación. Deja <b>Precio override</b> vacío para usar el precio del producto.'),
      crop('08-asistente-variantes.png', 'Paso 3 de 4: 4 tallas × 2 colores = 8 combinaciones, 4 unidades de cada una.', 560)) +
    warn('El stock es el mismo para todas las combinaciones', 'El asistente pone la misma cantidad en todas las tallas y colores. Si una talla tiene menos unidades, carga el producto con la cantidad más baja o escríbenos para ajustarla.')
  );
  pgs.push(
    step(4, 'Elegir quién lo ve y publicar',
      p('<b>Visibilidad</b>: <b>Solo mi escuela</b> (solo las familias de la escuela con sesión iniciada; ideal para uniformes), <b>Público</b> (cualquiera que abra el enlace de la tienda) o <b>Privado</b> (no aparece en la vitrina). Luego <b>Publicar</b>, o <b>Guardar borrador</b> para terminarlo después.'),
      crop('09-asistente-publicar.png', 'Paso 4 de 4: resumen y visibilidad "Solo mi escuela".', 520)) +
    step(5, 'El producto queda en "Mis Productos"',
      p('Con su foto, precio, stock y número de variantes. El <b>lápiz</b> edita; el ícono rojo lo <b>archiva</b> (deja de venderse sin borrar los pedidos anteriores).'),
      crop('productos.png', 'Mis Productos con el uniforme recién publicado.', 470)) +
    I('Detalles de la pantalla: el estado sale en inglés (<code>active</code>), "Stock: 0" en los productos con variantes (lee <code>products.stock</code>, no la suma de variantes) y el subtítulo habla de "marketplace". La categoría Ropa Deportiva no tiene <b>voleibol</b> en "Deporte" (se usó "otro"). Crear un producto ya <code>active</code> falla por <code>trg_enforce_product_publish_gate</code> (BEFORE INSERT, ver qa-gemelo-local.md); el asistente lo evita creando en borrador y publicando después.')
  );

  pgs.push(
    chapter(4, 'Inventario: revisar y ajustar el stock', 'Mi Tienda → Inventario  ·  Mi Tienda → Productos → lápiz',
      'El stock baja solo: cada pedido <b>reserva</b> las unidades y, si se cancela o vence sin pago, las devuelve. Nadie puede comprar más de lo que hay: con la última unidad reservada, la tienda la muestra como agotada.') +
    step(1, 'Ver lo que se está acabando',
      p('<b>Inventario</b> resume productos, ventas e ingresos, y lista en rojo los <b>productos con stock bajo</b>.'),
      crop('inventario.png', 'Inventario: productos con stock bajo.', 560)) +
    step(2, 'Cambiar precio, fotos o descripción',
      p('Con el <b>lápiz</b> del producto se abre el mismo asistente. Los cambios de nombre, precio, fotos y visibilidad se ven en la tienda al guardar.'),
      crop('11-editar-variantes.png', 'Editar producto, paso de variantes.', 290)) +
    warn('Reponer unidades de una talla', 'Hoy el stock de cada talla y color ya creado <b>no se cambia desde esta pantalla</b>. Para reponer unidades, escríbenos por el chat de soporte con el producto, la talla y la cantidad.') +
    I('<b>Hueco de inventario.</b> El BFF tiene <code>POST /api/v1/vendor/products/:id/inventory</code> (ajuste con motivo y nota, auditado) y <code>PATCH …/variants/:variantId</code>, pero <b>ninguna pantalla los usa</b>. En edición, el paso 3 muestra "Stock por variante 0" y al guardar <b>no toca las variantes</b> (el bulk solo corre al crear). <code>StoreInventoryPage</code> lee <code>products.stock</code> (0 en productos con variantes), usa "stock bajo" = menos de 20 fijo y categorías quemadas (Fútbol, Tenis, Running…), así que "Nivel de Stock por Categoría" sale vacío para cualquier tienda real.')
  );

  pgs.push(
    chapter(5, 'Compartir la tienda', 'Enlace de la tienda · menú de las familias',
      'Las familias de la escuela encuentran la tienda en su propio menú (<b>Seguimiento → Tienda</b>), sin que la escuela haga nada. Para promocionarla, comparte el enlace en el grupo de WhatsApp de cada categoría.') +
    step(1, 'El enlace de la tienda',
      p('Tiene la forma <b>app.sportmaps.co/tienda/<i>nombre-de-tu-tienda</i></b> (en este ejemplo, <code>/tienda/club-voleibol-condores</code>). Quien lo abre sin sesión ve los productos <b>públicos</b>; los <b>Solo mi escuela</b> aparecen cuando la familia entra con su cuenta.'),
      phones(phone('21-vitrina.png', 'La vitrina en el celular de una familia.', { h: 350, w: 200 }), phone('20-menu-padre.png', 'Menú del acudiente: Seguimiento → Tienda y Mis compras.', { h: 350, w: 200, top: 0.4 }))) +
    tip('Mensaje sugerido para WhatsApp', '"Ya está abierta la tienda del club 🛍️ Uniformes, rodilleras y termos. Pide desde el celular y retira en la sede: <b>app.sportmaps.co/tienda/club-voleibol-condores</b>"') +
    I('<b>La escuela no tiene botón "Compartir" ni QR de la tienda.</b> <code>ShareStoreDialog</code> (enlace + QR descargable + WhatsApp) solo se monta en <code>/vendor/public-profile</code>, permitido para <code>wellness_professional</code> y <code>store_owner</code>. El slug tampoco se ve en ninguna pantalla de la escuela: hoy lo da soporte. Además, en la vitrina el <b>nombre de la tienda queda tapado por la franja de portada</b> (TiendaPublicaPage.tsx: la fila de identidad sube con <code>-mt-10</code> y la portada es <code>relative</code>, así que pinta encima del <code>h1</code>); se ve en las capturas.')
  );

  pgs.push(
    chapter(6, 'Gestionar los pedidos', 'Mi Tienda → Pedidos',
      'Todos los pedidos de la tienda, con filtros por estado y un buscador por referencia o nombre. El botón verde de cada fila es la <b>siguiente acción</b> que toca.') +
    step(1, 'La lista de pedidos',
      p('Arriba, los contadores: <b>Por cobrar</b> (pendientes de pago y comprobantes por revisar), <b>Pagados</b>, <b>En curso</b>, <b>Entregados</b> y <b>Cerrados</b>. Cada fila trae la familia, el estado, la referencia (<code>CART-…</code>), los productos, el medio de pago y el total.'),
      crop('pedidos.png', 'Pedidos: comprobantes por aprobar, pedidos pagados y listos para retirar.', 680)) +
    step(2, 'Revisar el comprobante',
      p('Al abrir un pedido <b>Esperando aprobación</b> se ven la familia, sus datos de contacto, los productos con talla y color, el total con IVA, la sede de retiro y el botón <b>Ver comprobante</b>, que abre la imagen que subió la familia. Compárala con el extracto del banco antes de aprobar.'),
      `<div class="duo">${crop('detalle.png', 'Detalle del pedido con comprobante.', 300)}${crop('31b-comprobante-abierto.png', 'El comprobante (imagen de ejemplo).', 280)}</div>`)
  );
  pgs.push(
    step(3, 'Si el comprobante no sirve: rechazar con motivo',
      p('<b>Rechazar comprobante</b> pide un motivo que la familia ve en su pedido. El pedido vuelve a <b>Pendiente de pago</b> y la familia tiene 24 horas para subir otro.'),
      crop('32-rechazar-dialogo.png', 'Rechazar comprobante: el motivo le llega a la familia.', 400)) +
    step(4, 'Aprobar el pago y preparar',
      p('<b>Aprobar pago</b> deja el pedido <b>Pagado</b>. Luego <b>Preparar pedido</b> (lo estás alistando) y <b>Listo para retirar</b> (la familia ya puede pasar). La familia ve cada cambio en su celular.'),
      `<div class="duo">${crop('pagado.png', 'Pagado: siguiente paso "Preparar pedido".', 290)}${crop('listo.png', 'Listo para retirar: "Entregar con código".', 290)}</div>`)
  );
  pgs.push(
    step(5, 'Entregar con el código de retiro',
      p('Cuando la familia llega a la sede, pídele su <b>código de retiro</b> (6 dígitos, lo tiene en su pedido) y escríbelo en <b>Entregar con código</b>. Si no coincide, SportMaps no deja entregar: así nadie retira un pedido ajeno.'),
      crop('35-entregar-codigo.png', 'Entregar con el código que muestra la familia.', 380)) +
    step(6, 'Pedido entregado',
      p('El pedido queda <b>Entregado</b> y el <b>Historial</b> guarda cada paso con fecha, hora y quién lo hizo (familia o tienda), incluido el comprobante rechazado.'),
      crop('entregado.png', 'Entregado, con el historial completo del pedido.', 240))
  );
  pgs.push(
    step(7, 'Pedidos en efectivo: cobrar y entregar a la vez',
      p('Un pedido en <b>Efectivo al retirar</b> trae el botón <b>Cobrar y entregar</b>. Recibe el dinero, escribe el código de retiro y confirma: el pedido queda pagado y entregado en un solo paso.'),
      crop('41-cobrar-efectivo.png', 'Cobrar en efectivo con el código de retiro.', 380)) +
    step(8, 'Cancelar un pedido sin pagar',
      p('Mientras un pedido está <b>Pendiente de pago</b>, <b>Cancelar pedido</b> (con un motivo opcional) libera los productos reservados. Los pedidos sin pagar también se cancelan solos cuando vence la reserva.'),
      crop('42-cancelar-dialogo.png', 'Cancelar un pedido sin pagar.', 380)) +
    I('Las acciones van por el BFF (<code>/api/v1/store/vendor/orders/:id/…</code>) a las RPC <code>approve_order_receipt</code>, <code>reject_order_receipt</code>, <code>order_transition</code> (exige <code>pickupCode</code> para <code>ready_for_pickup → delivered</code>) y <code>confirm_cash_pickup</code>. No hay reembolso desde la pantalla (MP responde 501) ni tope de 72 h para revisar comprobantes. El historial sale de <code>order_status_history</code>.')
  );

  // ═══ PARTE B ═══
  pgs.push(
    part('B', 'La familia', 'Acudiente · celular') +
    chapter(7, 'Entrar a la tienda', 'Menú → Seguimiento → Tienda',
      'El acudiente entra con su cuenta de SportMaps. La tienda de su escuela está en el menú; también puede abrir el enlace que la escuela compartió.') +
    phones(
      phone('20-menu-padre.png', '1. Menú → Seguimiento → <b>Tienda</b>.', { h: 470, top: 0.12 }),
      phone('21b-vitrina-completa.png', '2. La vitrina: productos con precio; "Solo tu escuela" marca los exclusivos.', { h: 470 }),
    ) +
    tip('Retiro gratis en la sede', 'Los pedidos de la tienda escolar se recogen en la sede de la escuela, sin costo de envío.')
  );

  pgs.push(
    chapter(8, 'Elegir talla y armar el carrito', 'Tienda → producto → Agregar al carrito',
      'Los productos con tallas muestran el botón <b>Elegir talla</b>. Las tallas agotadas aparecen apagadas.') +
    phones(
      phone('22-ficha-talla.png', '1. En la ficha se elige la talla (la L está agotada) y la cantidad.', { h: 470 }),
      phone('23-barra-carrito.png', '2. Lo agregado queda en la barra "Ver carrito".', { h: 470 }),
      phone('24-carrito.png', '3. El carrito: cambiar cantidades y "Pagar".', { h: 470 }),
    ) +
    p('<b>Comprar ahora</b> salta directo al pago con ese producto. El carrito no deja pedir más unidades de las que hay: si queda una sola, el botón + se apaga.') +
    warn('Un pago por tienda', 'Si el carrito tiene productos de dos tiendas distintas, cada una se paga por separado.')
  );

  pgs.push(
    chapter(9, 'Pagar en una sola pantalla', 'Carrito → Pagar',
      'Todo el pago está en una pantalla: entrega, datos de quien compra, medio de pago y resumen con el IVA incluido.') +
    phones(
      phone('25b-checkout-completo.png', '1. Entrega: <b>Retiro en sede</b>. Datos precargados de la cuenta.', { h: 450 }),
      phone('25b-checkout-completo.png', '2. Medio de pago, resumen y botón final "Pagar".', { h: 450, top: 0.5 }),
    ) +
    p('La entrega normal es <b>Retiro en sede</b>, gratis. Si aparece <b>Envío a domicilio</b>, úsalo solo si la escuela te confirmó que hace envíos.') +
    p('Medios posibles: <b>Transferencia bancaria</b> (ves las cuentas y subes el comprobante), <b>Efectivo al retirar</b> (pagas en la sede con tu código) y, si la escuela lo tiene, <b>pago en línea</b> con tarjeta, PSE o Nequi.') +
    I('No existen: <b>cupones</b> (F3b; el BFF responde <code>422 COUPONS_NOT_AVAILABLE</code>), <b>compra sin cuenta</b> (el invitado arma el carrito y se le guarda al recargar, pero "Pagar" pide iniciar sesión) ni <b>envíos</b> definidos para la tienda escolar: el checkout igual muestra <b>"Envío a domicilio · Según el departamento"</b> (se ve en la captura). Cotiza con <code>shipping_zones</code> y la tarifa la configura <code>/vendor/shipping</code>, que la escuela casi seguro no ha llenado; si no hay zona, el BFF responde <code>SHIPPING_ZONE_NOT_FOUND</code>. Efectivo exige retiro. Decidir: ocultar el envío en tiendas escolares o documentarlo.')
  );

  pgs.push(
    chapter(10, 'Transferencia: subir el comprobante', 'Mis compras → el pedido',
      'Al confirmar, el pedido queda creado con los productos reservados. La pantalla muestra las cuentas de la escuela y el <b>código de retiro</b>.') +
    phones(
      phone('26-pedido-1.png', '1. Pedido creado: código de retiro y cuentas de la escuela.', { h: 450 }),
      phone('26-pedido-2.png', '2. Más abajo: "Subir comprobante".', { h: 450 }),
    ) +
    warn('El código de retiro se ve una sola vez', 'Por seguridad, el código de 6 dígitos solo se muestra en el celular donde se hizo el pedido. Tómale foto o pantallazo.') +
    I('El <code>pickupCode</code> no se puede recuperar (contrato §5): se guarda en <code>localStorage</code> del navegador (<code>rememberPickupCode</code>). Si la familia cambia de celular o borra datos, la escuela no tiene cómo entregar con código: hoy no hay flujo de "reenviar código".')
  );
  pgs.push(
    p('Tras subir la foto o el PDF del comprobante (hasta 5 MB), el pedido pasa a <b>Esperando aprobación</b>. Si la escuela lo rechaza, el motivo aparece arriba y se puede subir otro. Cuando la escuela aprueba y alista el pedido, la línea de <b>Seguimiento</b> lo muestra.') +
    phones(
      phone('27-esperando-1.png', '1. Esperando aprobación.', { h: 470 }),
      phone('28-rechazado-1.png', '2. Rechazado: el motivo de la escuela y "Subir otro comprobante".', { h: 470 }),
      phone('29-listo-1.png', '3. Listo para retirar: pasar por la sede con el código.', { h: 470 }),
    ) +
    I('Al recargar la página del pedido, el aviso verde "¡Pedido creado! Te guardamos los productos mientras completas el pago" sigue arriba aunque el pedido ya esté pagado o listo. Y el BFF limita a <b>20 operaciones de pago por minuto por IP</b> (<code>paymentLimiter</code>), que también cuenta la lectura del pedido: al pasarse, el detalle muestra <b>"Pedido no encontrado"</b> en vez de "intenta en un minuto". En una sede con wifi compartido (o datos móviles con CGNAT) varias familias pueden chocar con ese límite.')
  );

  pgs.push(
    chapter(11, 'Efectivo al retirar y "Mis compras"', 'Pagar → Efectivo al retirar  ·  Menú → Mis compras',
      'Con efectivo no se paga nada en línea: el pedido queda reservado y la familia recibe su código. En la sede paga y recibe el producto.') +
    phones(
      phone('40-efectivo-1.png', '1. Pedido en efectivo: el código para pagar y retirar.', { h: 470 }),
      phone('44-mis-compras.png', '2. Mis compras: todos los pedidos con su estado.', { h: 470 }),
      phone('45-entregada-1.png', '3. Un pedido entregado, con su seguimiento.', { h: 470 }),
    ) +
    tip('Si algo no cuadra', 'En la vitrina está el botón <b>Contactar a la tienda</b>. Un pedido que todavía no se ha pagado (o cuyo comprobante está en revisión) se puede cancelar desde el mismo pedido con <b>Cancelar pedido</b>; los productos quedan libres para otros.')
  );

  if (isInternal) {
    pgs.push(
      chapter(12, 'Lo que NO existe todavía', 'Solo equipo SportMaps — no prometer a la escuela', '') +
      `<table class="tbl"><tr><th>Hueco</th><th>Estado</th><th>Nota</th></tr>
        <tr><td>Tienda prendida en la viva</td><td>Apagada</td><td><code>store_enabled=false</code>. Se prende por escuela: flag global + <code>allowlist</code> de <code>vendor_profile_id</code> + adicional <code>store</code> + perfil verificado. Las migraciones de tienda v2 F0 (<code>20261003230007…16</code>) <b>no están aplicadas</b> en la viva.</td></tr>
        <tr><td>Pantalla de medios de pago de la tienda</td><td>No existe</td><td>Solo BFF/RPC. <code>enable_school_store</code> no crea <code>store_payment_settings</code> → tienda nueva sin medios.</td></tr>
        <tr><td>Cupones</td><td>Fase F3b</td><td><code>422 COUPONS_NOT_AVAILABLE</code>.</td></tr>
        <tr><td>Compra sin cuenta (invitado)</td><td>No existe</td><td>Carrito sí; pagar pide sesión.</td></tr>
        <tr><td>Envíos en la tienda escolar</td><td>Fuera del piloto</td><td>Solo retiro en sede.</td></tr>
        <tr><td>Ajustar stock por talla</td><td>Sin UI</td><td>Endpoint de inventario existe; edición no toca variantes; asistente = mismo stock para todas.</td></tr>
        <tr><td>Compartir / QR para la escuela</td><td>Sin acceso</td><td><code>ShareStoreDialog</code> solo en <code>/vendor/public-profile</code> (wellness/store_owner).</td></tr>
        <tr><td>Recuperar código de retiro</td><td>No existe</td><td>Solo en el navegador del pedido.</td></tr>
        <tr><td>Reembolsos, OCR del comprobante, tope 72 h</td><td>No existe</td><td>Contrato §5.</td></tr></table>` +
      `<table class="tbl"><tr><th>Defecto visto al capturar</th><th>Dónde</th></tr>
        <tr><td>Nombre de la tienda tapado por la portada</td><td><code>TiendaPublicaPage.tsx</code> (identidad con <code>-mt-10</code> bajo portada <code>relative</code>)</td></tr>
        <tr><td>Límite 20/min por IP → "Pedido no encontrado"</td><td><code>MiCompraDetallePage</code> trata el 429 como inexistente</td></tr>
        <tr><td>"¡Pedido creado!" persiste en estados posteriores</td><td><code>MiCompraDetallePage</code></td></tr>
        <tr><td>Llave "Solo para inscripciones" aparece en la tienda</td><td><code>_store_transfer_accounts</code> ignora <code>only_for</code></td></tr>
        <tr><td>Inventario con categorías quemadas, umbral 20, lee <code>products.stock</code></td><td><code>StoreInventoryPage.tsx</code></td></tr>
        <tr><td>Estado en inglés y "Stock: 0" en productos con variantes</td><td><code>VendorProductsPage.tsx</code></td></tr>
        <tr><td>Dashboard Vendedor: Ingresos "$0" y Rating "-" fijos</td><td><code>VendorDashboardPage.tsx</code></td></tr>
        <tr><td>Sin "voleibol" en Deporte de Ropa Deportiva</td><td><code>product_categories.attribute_schema</code></td></tr>
        <tr><td>Editar un producto del seed sin "Género" bloquea el paso 2</td><td>Atributo obligatorio nuevo; productos viejos no lo tienen</td></tr></table>` +
      tip('Cómo regenerar', 'Gemelo arriba (<code>npm run qa:twin:up</code>), BFF en 3199 y Vite en 3101 con las variables del gemelo, luego <code>node imagenes.mjs</code>, <code>node capture.mjs</code> (pausas de 62 s por el limitador; ~8 min) y <code>node build.mjs</code>. Al terminar, <code>restaurar-gemelo.sql</code> devuelve los nombres del seed para que <code>frontend/e2e/tienda</code> siga pasando. Todo en <code>docs/manuales/_src/manual-tienda/</code>.')
    );
  }
  return pgs;
}

function cover(isInternal) {
  return `<div class="page cover"><div class="cover-inner">
    <div><div class="logo"><span class="pin"></span>SportMaps</div></div>
    <div>
      <div class="cover-eyebrow"><span class="dot" style="background:${isInternal ? '#ff8833' : '#4fd17a'}"></span>${isInternal ? '🔒 Uso interno — no enviar a escuelas' : 'Guía de uso · Academias'}</div>
      <h1 class="cover-title">Tienda escolar</h1>
      <p class="cover-sub">Cómo la escuela activa su tienda, carga uniformes y accesorios con tallas y stock, y gestiona cada pedido hasta la entrega; y cómo la familia compra desde el celular y paga por transferencia o en efectivo.</p>
      <div class="pills">
        <span class="pill">Owner/Admin · Familias</span>
        <span class="pill">${isInternal ? '12' : '11'} capítulos</span>
        <span class="pill">Capturas reales del producto</span>
        ${isInternal ? '<span class="pill" style="border-color:#ff8833;color:#ffcf9e">Uso interno</span>' : ''}
      </div>
    </div>
    <div class="cover-footer">SportMaps © 2026 · octubre</div>
  </div></div>`;
}

const css = () => fs.readFileSync(path.join(here, 'manual.css'), 'utf8') + `
.part { display:flex; align-items:center; gap:16px; background:#123416; color:#f2f7f2; border-radius:16px; padding:14px 20px; margin-bottom:22px; }
.part-letter { font-family:'Baloo 2',sans-serif; font-size:34px; font-weight:800; color:#4fd17a; line-height:1; }
.part-title { font-family:'Baloo 2',sans-serif; font-size:20px; font-weight:800; }
.part-sub { font-size:12px; color:#9fc9ab; }
.phones { display:flex; justify-content:center; gap:18px; margin:8px 0 14px; }
.phone { margin:0; display:flex; flex-direction:column; align-items:center; }
.phone-frame { overflow:hidden; border:7px solid #1c2b20; border-radius:26px; box-shadow:0 6px 18px rgba(20,50,30,.18); background:#fff; }
.phone-frame img { display:block; }
.phone figcaption { font-size:11px; color:#5d6d62; margin-top:7px; max-width:230px; text-align:center; line-height:1.4; }
.duo { display:flex; justify-content:center; align-items:flex-start; gap:18px; }
.duo .shot-wrap { flex:0 0 auto; }
`;

function html(isInternal) {
  const body = pages(isInternal);
  const total = body.length + 1;
  const foot = (n) => `<div class="footer${isInternal ? ' internal-mark' : ''}"><span>SportMaps · ${isInternal ? 'Uso interno' : 'Guía de uso'}</span><span>Página ${n} de ${total}</span></div>`;
  return `<!doctype html><html><head><meta charset="utf-8" /><title>SportMaps — Tienda escolar (${isInternal ? 'Interno' : 'Academias'})</title><style>${css()}</style></head><body>` +
    cover(isInternal) + body.map((pg, i) => `<div class="page">${pg}${foot(i + 2)}</div>`).join('\n') + `</body></html>`;
}

async function render() {
  const browser = await chromium.launch();
  try {
    await makeCrops(browser);
    for (const [ver, base] of Object.entries(OUT)) {
      const isInternal = ver === 'interno';
      fs.mkdirSync(path.dirname(base), { recursive: true });
      fs.writeFileSync(`${base}.html`, html(isInternal), 'utf8');
      const page = await browser.newPage();
      await page.goto('file:///' + `${base}.html`.replace(/\\/g, '/'));
      await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalHeight > 0));
      await page.evaluate(() => document.fonts.ready);
      // Ventanas de teléfono: el desplazamiento `top` se calcula sobre el alto real de la imagen.
      await page.evaluate(() => document.querySelectorAll('.phone-frame img').forEach((im) => {
        im.style.marginTop = `-${Number(im.dataset.top) * im.getBoundingClientRect().height}px`;
      }));
      // Paginación automática: lo que no cabe en una hoja pasa ENTERO (paso, callout, tabla)
      // a una hoja nueva a continuación; después se renumeran los pies.
      await page.evaluate(() => {
        const LIMIT = 1056 - 76; // alto útil: el pie ocupa el margen inferior
        const fits = (pg) => {
          const top = pg.getBoundingClientRect().top;
          const kids = [...pg.children].filter((c) => !c.classList.contains('footer'));
          return !kids.length || kids[kids.length - 1].getBoundingClientRect().bottom - top <= LIMIT;
        };
        for (let i = 0; i < 200; i++) {
          const pg = [...document.querySelectorAll('.page:not(.cover)')].find((x) => !fits(x));
          if (!pg) break;
          const nueva = document.createElement('div');
          nueva.className = 'page';
          nueva.appendChild(pg.querySelector('.footer').cloneNode(true));
          pg.after(nueva);
          while (!fits(pg)) {
            const kids = [...pg.children].filter((c) => !c.classList.contains('footer'));
            if (kids.length <= 1) break; // un bloque más alto que la hoja: se avisa abajo
            nueva.insertBefore(kids[kids.length - 1], nueva.firstChild);
          }
        }
        const all = [...document.querySelectorAll('.page')];
        all.forEach((pg, i) => {
          const f = pg.querySelector('.footer span:last-child');
          if (f) f.textContent = 'Página ' + (i + 1) + ' de ' + all.length;
        });
      });
      const overflow = await page.evaluate(() =>
        [...document.querySelectorAll('.page')].map((el, i) => ({ n: i + 1, h: el.scrollHeight })).filter((x) => x.h > 1056));
      if (overflow.length) console.warn(`⚠️  ${ver}: páginas que desbordan 1056px →`, overflow);
      // Contenido que se sale por abajo del área útil (choca con el pie).
      const tight = await page.evaluate(() => [...document.querySelectorAll('.page:not(.cover)')].map((el, i) => {
        const foot = el.querySelector('.footer').getBoundingClientRect().top;
        const last = [...el.children].filter((c) => !c.classList.contains('footer')).pop();
        return { n: i + 2, gap: Math.round(foot - last.getBoundingClientRect().bottom) };
      }).filter((x) => x.gap < 8));
      if (tight.length) console.warn(`⚠️  ${ver}: contenido que toca el pie →`, tight);
      await page.pdf({ path: `${base}.pdf`, width: '816px', height: '1056px', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
      const n = await page.evaluate(() => document.querySelectorAll('.page').length);
      await page.close();
      console.log(`✅ ${ver}: ${base}.pdf (${n} páginas)`);
    }
  } finally {
    await browser.close();
  }
}

render().catch((e) => { console.error(e); process.exit(1); });
