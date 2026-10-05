// Genera el manual "Facturación electrónica" en sus dos versiones (interno /
// academias) como HTML + PDF, con las capturas reales de ./shots/.
//
//   node docs/manuales/_src/manual-facturacion-electronica/build.mjs
//
// Antes hay que correr capture.mjs (mismo directorio). Sistema visual: el de
// todos los manuales (memoria feedback_pdf_manual_template, docs/manuales/README.md).

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
  academias: path.join(repo, 'docs/manuales/academias/manual-facturacion-electronica'),
  interno: path.join(repo, 'docs/manuales/interno/manual-facturacion-electronica'),
};
const SCALE = 2;

// ── Recortes (CSS px del viewport 1600×1000) ──────────────────────────────
const CROP_DEFS = {
  'c-menu.png':          { src: '09-menu-finanzas.png',    x: 0,   y: 505, w: 245,  h: 315 },
  'c-contab-tab.png':    { src: '12-contabilidad-tab.png', x: 300, y: 110, w: 1260, h: 410 },
  'c-standalone.png':    { src: '01-pagina.png',           x: 300, y: 110, w: 1260, h: 345 },
  'c-config.png':        { src: '04-config-lleno.png',     x: 544, y: 100, w: 512,  h: 800 },
  'c-pago-manual.png':   { src: '11-modal-factura.png',    x: 580, y: 330, w: 440,  h: 270 },
  'c-faltantes.png':     { src: '05-faltantes.png',        x: 300, y: 525, w: 1260, h: 430 },
  'c-faltantes-tabla.png': { src: '07-faltantes-tabla.png', x: 300, y: 750, w: 1260, h: 240 },
  'c-completar.png':     { src: '06-completar-datos.png',  x: 544, y: 162, w: 512,  h: 676 },
  'c-rango.png':         { src: '08-emitidas-vacio.png',   x: 300, y: 310, w: 1260, h: 460 },
  'c-emitidas.png':      { src: '08-emitidas-vacio.png',   x: 300, y: 784, w: 1260, h: 216 },
};

async function makeCrops(browser) {
  fs.mkdirSync(CROPS, { recursive: true });
  const page = await browser.newPage();
  for (const [out, def] of Object.entries(CROP_DEFS)) {
    const src = path.join(SHOTS, def.src);
    if (!fs.existsSync(src)) throw new Error(`Falta la captura ${def.src}. Corre capture.mjs primero — este manual no lleva mockups.`);
    const b64 = fs.readFileSync(src).toString('base64');
    const cropped = await page.evaluate(async ([b64, d, s]) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = d.w * s; c.height = d.h * s;
      c.getContext('2d').drawImage(img, d.x * s, d.y * s, d.w * s, d.h * s, 0, 0, d.w * s, d.h * s);
      return c.toDataURL('image/png').split(',')[1];
    }, [b64, def, SCALE]);
    fs.writeFileSync(path.join(CROPS, out), Buffer.from(cropped, 'base64'));
  }
  await page.close();
}

// ── Piezas ────────────────────────────────────────────────────────────────
function img(file, caption, style) {
  const fp = fs.existsSync(path.join(CROPS, file)) ? path.join(CROPS, file) : path.join(SHOTS, file);
  if (!fs.existsSync(fp)) throw new Error(`Falta ${file}`);
  const b64 = fs.readFileSync(fp).toString('base64');
  return `<div class="shot-wrap"><img class="shot" style="${style}" src="data:image/png;base64,${b64}" alt="${caption}"/>` +
    (caption ? `<div class="shot-caption">${caption}</div>` : '') + `</div>`;
}
const crop = (file, caption, width) => img(file, caption, `width:${width}px;max-height:none`);
const step = (n, title, body, pic = '') =>
  `<div class="step"><div class="step-head"><div class="step-badge">${n}</div><div class="step-title">${title}</div></div>${body}${pic}</div>`;
const p = (html, cls = '') => `<p${cls ? ` class="${cls}"` : ''}>${html}</p>`;
const warn = (tag, html) => `<div class="callout warn"><span class="tag">${tag}</span>${html}</div>`;
const tip = (tag, html) => `<div class="callout tip"><span class="tag">${tag}</span>${html}</div>`;
const internal = (html) => `<div class="callout internal"><span class="tag">🔒 Interno</span>${html}</div>`;
const chapter = (n, title, crumb, intro) =>
  `<div class="chapter-head"><div class="chapter-badge">${n}</div><h2 class="chapter-title">${title}</h2></div>` +
  `<div class="breadcrumb">${crumb}</div><hr class="chapter-rule" />${intro ? p(intro) : ''}`;
const table = (head, rows) =>
  `<table class="tbl"><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>` +
  rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('') + `</table>`;

// ── Contenido: cada entrada del array es UNA página ───────────────────────
function pages(isInternal) {
  const I = (html) => (isInternal ? internal(html) : '');
  const PAC = isInternal ? 'Factus' : 'tu proveedor de facturación';
  const pgs = [];

  // ── Cap. 1 — Qué es y qué necesitas ──
  pgs.push(
    chapter(1, 'Qué es y qué necesitas antes de empezar', 'Facturación electrónica DIAN desde SportMaps',
      `SportMaps genera la factura electrónica de cada cobro que tu escuela recibe (mensualidades, inscripciones, torneos y ventas de la tienda) y la envía a la DIAN a través de un <b>proveedor tecnológico autorizado</b> (PAC)${isInternal ? ', hoy <b>Factus</b>' : ''}. La factura sale <b>a nombre de tu escuela</b>, con tu NIT y tu resolución: SportMaps no factura por ti, solo le entrega los datos al proveedor.`) +
    `<h3 style="font-size:16px;margin:4px 0 8px;color:#123416">Lo que la escuela tiene que tener listo</h3>` +
    table(['Requisito', 'Dónde se consigue', 'Para qué sirve'], [
      ['<b>RUT actualizado y NIT</b> de la escuela', 'DIAN', 'Es el emisor que figura en cada factura.'],
      ['<b>Habilitación como facturador electrónico</b> y <b>resolución de numeración</b> con <b>prefijo</b> y <b>rango</b> (ej. FE 1 a 5.000)', 'Portal de la DIAN, normalmente con ayuda del proveedor', 'Cada factura consume un número de ese rango.'],
      ['<b>Cuenta en el proveedor</b> (PAC) con acceso por API: Client ID, Client Secret, usuario y contraseña', `${isInternal ? 'Factus (paquete de documentos + activación)' : 'Tu proveedor de facturación'}`, 'SportMaps se conecta con esas credenciales.'],
      ['<b>Rango de numeración en el proveedor</b> (su número interno) para facturas', 'Portal del proveedor', 'Se escribe en la configuración.'],
      ['<b>Rango de notas crédito</b> (otro prefijo, otra numeración)', 'Portal del proveedor', 'Sin él no se puede anular una factura desde SportMaps.'],
      ['<b>Código DANE</b> del municipio de la escuela (ej. 11001 Bogotá)', 'Catálogo DANE', 'Se usa cuando el pagador no tiene municipio propio.'],
    ]) +
    tip('Consejo', 'Empieza en <b>modo pruebas</b> con las credenciales de pruebas que te da el proveedor. Cuando todo cuadre, cambias a producción y emites primero <b>un solo documento</b> antes de facturar el mes completo.') +
    I('El "proveedor" de la versión para academias es Factus. Hay dos variantes en código: <code>factus</code> (API v1) y <code>factus_v2</code> (API v2, la que usa Dynasty en producción). Solo <code>factus_v2</code> emite notas crédito. Plan comercial: Dynasty con paquete V1/V2 propio; el resto de escuelas, vía SportMaps como ALIADO de Factus (cada escuela se activa como "Usuario" propio con Cámara de Comercio ≤30 días, RUT y cédula del representante legal).')
  );

  // ── Cap. 1 (cont.) — Dónde está ──
  pgs.push(
    step(1, 'Dónde está la pantalla',
      p('Depende de los módulos que tenga tu escuela:') +
      `<ul style="font-size:13.5px;line-height:1.55;color:#33413a;margin:0 0 10px 18px;padding:0">
        <li><span>Con <b>Contabilidad</b>: menú <b>Finanzas → Contabilidad → Contabilidad</b>, pestaña <b>Facturación electrónica</b>.</span></li>
        <li><span>Sin Contabilidad: menú <b>Finanzas → Facturación electrónica</b>.</span></li></ul>` +
      p('Es la misma pantalla en los dos casos. La ven el dueño y los administradores de la escuela; el contador puede consultar las facturas pero no configurar ni emitir.'),
      crop('c-menu.png', 'Menú Finanzas con Contabilidad desplegada.', 220) +
      crop('c-contab-tab.png', 'Contabilidad → pestaña Facturación electrónica, todavía sin facturador conectado.', 696)) +
    I('Gate: addon <code>invoicing</code> + módulo <code>finanzas_facturacion_electronica</code>. El ítem suelto del menú tiene <code>hideIfAddon: \'accounting\'</code>: con Contabilidad no aparece y la función vive solo como pestaña. Si la escuela no tiene el addon <code>invoicing</code>, la pestaña muestra un aviso en vez del facturador. Lectura para el contador (<code>accountant</code>) vía <code>canReadFinances</code>; configurar, emitir y anular exigen owner/admin (<code>canManageFinances</code>) o admin de plataforma.')
  );

  // ── Cap. 2 — Configurar ──
  pgs.push(
    chapter(2, 'Conectar el proveedor', 'Facturación electrónica → Facturador electrónico → Configurar',
      'Se hace una sola vez. Mientras no haya facturador conectado, la pantalla lo dice y nada se emite.') +
    step(1, 'Pulsar "Configurar" y llenar el formulario',
      p(`Elige el proveedor, deja <b>Modo pruebas</b> encendido para el primer ensayo y pega los datos que te entregó ${PAC}.`),
      crop('c-config.png', 'Formulario del facturador con valores de ejemplo (no son credenciales reales).', 380))
  );
  pgs.push(
    step(2, 'Qué va en cada campo',
      table(['Campo', 'Qué poner'], [
        ['Proveedor (PAC)', `El proveedor con el que tienes la cuenta${isInternal ? ' (<code>factus</code> o <code>factus_v2</code>)' : ''}.`],
        ['Modo pruebas', 'Encendido = ambiente de pruebas del proveedor, sin valor ante la DIAN. Apagado = producción: cada documento es real.'],
        ['Client ID / Client Secret / Usuario / Contraseña', 'Las credenciales de API del proveedor. Se guardan cifradas y <b>nunca se vuelven a mostrar</b>: al editar hay que escribirlas de nuevo.'],
        ['Rango de numeración (facturas)', 'El número del rango de facturas <b>tal como aparece en el portal del proveedor</b> (no el prefijo).'],
        ['Rango de notas crédito', 'El número del rango de notas crédito. Opcional para emitir, <b>obligatorio para anular</b>.'],
        ['Municipio por defecto', 'Código DANE de 5 dígitos, con el cero inicial (05001 = Medellín). Se imprime en las facturas de pagadores sin municipio propio.'],
        ['Servicios excluidos de IVA', 'Encendido para mensualidades y clases (servicios deportivos/educativos). Los productos de la tienda se facturan aparte, con IVA.'],
      ])) +
    step(3, 'Guardar y revisar el resumen',
      p('Al guardar, la tarjeta muestra el proveedor, si está en <b>pruebas</b> o <b>producción</b>, si está <b>Activo</b>, el rango de facturas, el de notas crédito (o el aviso <b>"Sin rango de notas crédito: no se puede anular"</b>) y el municipio por defecto. Desde ese momento empieza la emisión automática.', 'no-shot')) +
    warn('Si vienes de otro facturador con la misma resolución', 'La numeración pertenece a la <b>resolución</b>, no al software. Si ya emitiste facturas con otro proveedor usando el mismo prefijo, pídele al proveedor nuevo que ajuste su consecutivo al <b>último número usado + 1</b> antes de conectar SportMaps. Si no, la DIAN rechaza la primera factura por "documento procesado anteriormente" y la emisión queda bloqueada.') +
    I('Guardar el formulario SIEMPRE manda <code>enabled: true</code> e <code>isDefault: true</code>: no hay interruptor para apagar el facturador desde la UI. Apagarlo (la única palanca que frena el cron de una escuela) es un UPDATE a <code>electronic_invoice_providers.enabled</code> hecho por el equipo. Kill-switch global: <code>DISABLE_AUTO_INVOICING=true</code> en el BFF. Caso real del contador: Dynasty migró de Alegra a Factus con la resolución <code>18764109588335</code> (DYTY); Alegra había usado DYTY1–258 y Factus arrancó en 1 → DYTY1 colgado; Factus lo borró y ajustó el consecutivo a DYTY259 (2026-09-17).')
  );

  // ── Cap. 3 — Datos del pagador ──
  pgs.push(
    chapter(3, 'Los datos del acudiente que pide la DIAN', 'Quién paga, con qué documento y dónde vive',
      'La factura sale a nombre de <b>quien paga</b>: el acudiente del deportista menor, o el propio deportista si es adulto. Para emitirla hacen falta estos datos de esa persona:') +
    table(['Dato', '¿Obligatorio?', 'Si falta…'], [
      ['<b>Tipo y número de documento</b> (CC, CE, NIT, TI, RC, pasaporte)', 'Sí', 'El pago <b>no se factura</b>: queda en la lista de "Datos fiscales faltantes".'],
      ['<b>Dirección</b>', 'Sí', 'Igual: no se factura hasta completarla.'],
      ['<b>Municipio</b> (del catálogo, con código DANE)', 'Recomendado', 'La factura sale igual, pero con el municipio de la escuela.'],
      ['<b>Correo</b> y teléfono', 'Se toman de la cuenta', 'Van en el documento como datos de contacto del comprador.'],
      ['<b>Pagador vinculado</b> al cobro', 'Sí', 'Un cobro sin acudiente ni deportista con cuenta no se puede facturar. Se arregla en la ficha del deportista.'],
    ]) +
    step(1, 'Cómo llegan esos datos',
      p('<b>Pagos desde la app:</b> la primera vez que un acudiente paga, SportMaps le pide documento, dirección y municipio antes de mostrar los medios de pago. Se guardan en su perfil y no se vuelven a pedir.') +
      p('<b>Pagos registrados por la escuela</b> (efectivo o transferencia): al elegir el deportista en <b>Registrar pago manual</b> aparece <b>"¿Desea factura electrónica?"</b>. Si el pagador no tiene los datos, se completan ahí mismo.'),
      crop('c-pago-manual.png', 'Registrar pago manual: el interruptor de factura electrónica al elegir el deportista.', 360))
  );
  pgs.push(
    step(2, 'La pestaña "Datos fiscales faltantes"',
      p('Junta en un solo lugar a <b>todos los pagadores con pagos cobrados que no se pueden facturar</b>, cuántos pagos tienen y cuánto dinero suman. El número rojo de la pestaña es la cantidad de casos por resolver. Arriba también avisa cuántos pagos ya están completos pero <b>tienen más de 3 días</b> y por eso hay que emitirlos por rango (capítulo 4).'),
      crop('c-faltantes.png', 'Resumen: casos por resolver, pagos sin facturar y avisos de municipio y de pagos viejos.', 696) +
      crop('c-faltantes-tabla.png', 'Cada pagador con lo que le falta, sus pagos, el monto y su contacto.', 696))
  );
  pgs.push(
    step(3, 'Completar los datos desde la escuela',
      p('Con <b>Completar datos</b> se abre el mismo formulario que ve el acudiente. Se guarda en el perfil del pagador y sirve para todos sus pagos futuros. Ojo: completar el dato <b>habilita</b> la factura pero <b>no la emite</b>; los pagos de hace más de 3 días se emiten por rango.'),
      crop('c-completar.png', 'Completar los datos de facturación de un acudiente (demo).', 330)) +
    tip('Para no perseguir datos', 'Lo más fácil es que cada familia pague una vez por la app: el formulario se le pide solo, antes de pagar. Para los que pagan en efectivo, completa el dato al registrar el pago.') +
    I('Criterio del panel = criterio del motor (<code>emitInvoiceForPayment</code>): pagador = <code>parent_id || user_id</code>; sin documento → <code>customer_missing_fiscal_data</code> (va a <code>SKIP_ERRORS</code>: se salta en silencio, no se registra fila); sin dirección el PAC rechaza. Municipio: si <code>billing_city_dane</code> no es código de 4-5 dígitos se usa el de la escuela (política <code>fallback</code>), o se salta con <code>customer_municipality_policy: require</code>. El correo NO se valida: si falta, el documento sale sin correo del adquirente. El checkout del padre exige los datos aunque la escuela no facture (gate incondicional en <code>ParentCheckoutPage</code>).')
  );

  // ── Cap. 4 — Cómo se emite ──
  pgs.push(
    chapter(4, 'Cómo se emiten las facturas', 'Automática · por rango · reintentos',
      'Solo se factura un cobro <b>pagado</b>. Nunca se emite factura de un cobro pendiente, rechazado o anulado.') +
    step(1, 'Automática: sin hacer nada',
      p('Cada <b>15 minutos</b> SportMaps revisa los cobros que pasaron a <b>pagado</b> en los <b>últimos 3 días</b> y emite la factura de los que tienen los datos completos. Da igual cómo se pagó: pago en línea, transferencia aprobada por la escuela, efectivo registrado en recepción o cobro recurrente. En la práctica, la factura aparece unos minutos después de aprobar el pago.', 'no-shot')) +
    step(2, 'Por rango: lo que quedó atrás',
      p('Un pago con más de 3 días (por ejemplo, una transferencia vieja que se registró tarde, o un acudiente que completó sus datos después) <b>no se factura solo</b>. Para eso está <b>Emitir facturas de un periodo</b>: eliges las fechas de pago, la tarjeta calcula cuántos documentos salen y por cuánto, y cuáles se saltan y por qué.'),
      crop('c-rango.png', 'Emitir facturas de un periodo (aquí sin facturador conectado, por eso el botón está apagado).', 600))
  );
  pgs.push(
    step(3, 'Confirmar la emisión',
      p('Al pulsar <b>Emitir</b>, SportMaps muestra cuántas facturas van a salir y por qué valor, recuerda que cada número de la resolución <b>no se recupera</b> y pide marcar <b>"Entiendo que esto emite N documento(s)… y no se puede deshacer"</b>. El resultado se muestra agrupado: emitidas, saltadas (con el motivo) y fallidas.', 'no-shot')) +
    table(['Regla del rango', 'Por qué'], [
      ['Máximo <b>92 días</b> por corrida', 'Evita facturar años por error. Se emite mes por mes.'],
      ['Máximo <b>200 documentos</b> por corrida', 'Si hay más, se repite el mismo rango: los ya facturados se saltan solos.'],
      ['Campo <b>"Emitir como máximo"</b>', 'Pon <b>1</b> para probar con un documento antes de emitir el resto.'],
      ['Se puede correr dos veces', 'Un pago con factura vigente nunca recibe una segunda.'],
      ['Facturador apagado = no se emite nada', 'Ni automático ni por rango.'],
    ]) +
    step(4, 'Reintentos: qué hacer con cada caso',
      table(['Si la factura quedó…', 'Qué hacer'], [
        ['<b>En cola (nuestra)</b>', 'No llegó al proveedor y no gastó número. Se reintenta sola o con una nueva corrida del rango, sin costo.'],
        ['<b>Emitida · esperando DIAN</b>', 'Nada. El número y el CUFE llegan en minutos; SportMaps los completa solo.'],
        ['<b>Rechazada</b>', 'Leer el <b>motivo</b> en su fila, corregir el dato (documento, dirección…) y volver a emitir el rango. No se reemite sola.'],
        ['<b>Saltada</b> en el resultado', 'Le faltaba un dato del pagador o no tenía pagador. Se arregla en "Datos fiscales faltantes" o en la ficha del deportista.'],
      ])) +
    I('Cron: <code>maintenance.job.ts</code> <code>*/15 * * * *</code> → <code>autoEmitPendingInvoices</code> (ventana <code>sinceDays 3</code> por <code>payment_date</code> o <code>created_at</code>), <code>autoEmitPendingMarketplaceInvoices</code>, <code>autoEmitPendingOrders</code> (solo con tienda prendida) y <code>reconcilePendingInvoices</code> (completa las <code>sent</code> de Factus V2, que valida asíncrono). Rango = <code>POST /api/v1/invoicing/backfill/:ownerType/:ownerId</code> (409 <code>invoicing_disabled</code> si está apagado). Emisión pago por pago existe en el BFF (<code>POST /emit/:paymentId</code>) pero <b>no tiene botón en la UI</b>. Idempotencia por <code>reference_code</code> <code>SM-&lt;paymentId&gt;</code> (<code>-R2</code>, <code>-R3</code> tras anular). Factura por <code>max(amount, gross_amount)</code>: incluye el recargo del pago en línea.')
  );

  // ── Cap. 5 — Consultar ──
  pgs.push(
    chapter(5, 'Consultar las facturas y su estado ante la DIAN', 'Pestaña Facturas emitidas',
      'Debajo de la emisión por rango está la lista de documentos (facturas y notas crédito), del más reciente al más antiguo. Mientras no haya ninguno, dice "Aún no hay facturas emitidas".') +
    crop('c-emitidas.png', 'Facturas emitidas, todavía vacía en la escuela de demostración.', 600) +
    step(1, 'Qué muestra cada fila',
      p('<b>Documento</b> (número con prefijo y, debajo, el <b>CUFE</b> con botón para copiarlo), <b>Estado</b>, <b>Fecha</b>, <b>Total</b> y las acciones <b>Ver</b> y <b>Anular</b>. Si hay algo que explicar, una segunda línea muestra el <b>motivo del rechazo</b>, la nota crédito que la anuló y el <b>código de referencia</b> para buscarla en el portal del proveedor. Arriba de la tabla se resumen los rechazados, los que están en cola y los anulados.', 'no-shot')) +
    table(['Estado', 'Qué significa'], [
      ['<b>Validada por la DIAN</b> (verde)', 'Documento legal vigente.'],
      ['<b>Emitida · esperando DIAN</b> (azul)', 'Ya salió y consumió número; la DIAN la valida en minutos. Todavía no se puede anular.'],
      ['<b>En cola (nuestra)</b> (punteado)', 'Preparada pero no enviada: no consumió número.'],
      ['<b>Rechazada</b> (rojo)', 'No es un documento válido. El motivo está en su fila.'],
      ['<b>Anulada</b> (gris, tachada)', 'Sin efecto por una nota crédito. Su número sigue consumido.'],
    ]) +
    step(2, 'Ver el PDF, el XML y el código QR',
      p(`<b>Ver</b> abre la factura en la página pública del proveedor, donde está la representación gráfica (PDF), el XML y el QR de la DIAN para descargar o reenviar.`, 'no-shot')) +
    step(3, 'Qué ve la familia',
      p('En <b>Mis Pagos</b>, cada pago con factura muestra el botón <b>FACTURA</b>, que abre el mismo documento. Lo ve el acudiente que pagó (y el deportista adulto en sus pagos). Si un acudiente no ve el botón, el pago todavía no tiene factura: revisa sus datos fiscales o el rango.', 'no-shot'))
  );

  // ── Cap. 6 — Anular ──
  pgs.push(
    chapter(6, 'Anular una factura (nota crédito)', 'Facturas emitidas → Anular, en la fila de la factura',
      'Una factura validada por la DIAN <b>no se borra</b>: se deja sin efecto con una <b>nota crédito</b>, que es otro documento electrónico con su propio número.') +
    step(1, 'Cuándo aparece el botón "Anular"',
      p('Solo en facturas <b>Validadas por la DIAN</b>. Una rechazada no existe ante la DIAN (no hay nada que anular), una "esperando DIAN" todavía no tiene número y una nota crédito no se anula con otra. Además el facturador tiene que tener <b>rango de notas crédito</b>; si no lo tiene, el diálogo lo explica y ofrece ir a la configuración.', 'no-shot')) +
    step(2, 'Elegir el motivo y confirmar',
      table(['Motivo', 'Cuándo usarlo'], [
        ['Anular la factura completa', 'Salió por error, duplicada, con el valor equivocado o a nombre de otra familia.'],
        ['Devolución o servicio no aceptado', 'El servicio no se prestó (una matrícula dada de baja).'],
        ['Rebaja o descuento posterior', 'Beca o rebaja aplicada después de facturar.'],
        ['Ajuste de precio', 'El valor facturado no era el correcto.'],
        ['Descuento por pronto pago / por volumen', 'Descuentos comerciales acordados después de emitir.'],
      ]) +
      p('Se escribe una observación (queda guardada como motivo) y se marca la casilla de confirmación. La factura pasa a <b>Anulada</b> y en su fila aparece el número de la nota crédito. El pago vuelve a contar como "por emitir": si corresponde, se factura de nuevo con los datos corregidos.', 'no-shot')) +
    warn('Un pago con factura vigente no sale de "pagado"', 'Si un cobro ya tiene factura electrónica vigente, nadie puede pasarlo a pendiente, rechazado o anulado: SportMaps muestra <b>"Este pago tiene factura electrónica vigente. Emite la nota crédito desde Contabilidad › Facturación electrónica antes de anularlo o rechazarlo."</b> Primero se anula la factura; después se mueve el pago. Si hay un caso excepcional, escríbele al equipo de SportMaps: solo nosotros podemos hacerlo, y queda registrado con el motivo.')
  );

  if (isInternal) {
    pgs.push(
      `<h3 style="font-size:18px;margin:0 0 12px;color:#123416">Notas técnicas de los capítulos 5 y 6</h3>` +
      internal('PDF/XML propios NO existen: <code>pdf_url</code>/<code>xml_url</code> quedan <code>null</code> (el adaptador V2 lo marca "descarga aparte, no implementada"); todo pasa por <code>public_url</code> de Factus. Tampoco hay marca blanca del PDF ni envío de la factura por correo desde SportMaps (lo que mande Factus depende de su configuración). La lista trae máximo 200 documentos (<code>limit(200)</code>) sin paginación ni filtros.') +
      internal('Guard en la base (migración <code>20261003202426</code>, aplicada: trigger <code>trg_zy_guard_pago_facturado</code> vivo): <code>paid → otro</code> con factura <code>queued/sent/accepted</code> sin <code>voided_at</code> → 55000 <code>PAYMENT_INVOICED</code>, por CUALQUIER camino (PostgREST, RPC, BFF con service_role, SQL). Segundo trigger: no se inserta una factura de un pago que no esté <code>paid</code> (<code>INVOICE_PAYMENT_NOT_PAID</code>). Escape: RPC <code>admin_unpay_invoiced_payment(p_payment_id, p_new_status, p_reason)</code>, solo <code>is_super_admin()</code>, motivo ≥ 10 caracteres, deja fila <code>UNPAY_INVOICED</code> en <code>audit_logs</code>. <b>No tiene pantalla</b>: se corre por SQL/RPC. Origen: acudientes de Dynasty que pasaban cobros facturados de <code>paid</code> a <code>awaiting_approval</code> (DYTY426/427). La nota crédito siempre es por el <b>total</b> de la factura: el concepto cambia la etiqueta DIAN, no el monto (no hay notas parciales). Nota débito: no implementada.')
    );
  }

  // ── Cap. 7 — Tienda ──
  pgs.push(
    chapter(7, 'Facturas de las ventas de la tienda', 'Tienda de la escuela → órdenes pagadas',
      'Si tu escuela vende uniformes, implementos u otros productos en la tienda de SportMaps, esas ventas también se facturan solas con el mismo facturador.') +
    table(['Regla', 'Detalle'], [
      ['Emisor', '<b>Tu escuela</b>, con tu NIT y tu resolución. SportMaps no aparece como vendedor.'],
      ['Cuándo', 'Solo órdenes <b>pagadas</b> con prueba de pago (pasarela o pago aprobado por la escuela). Una orden pendiente o cancelada no se factura.'],
      ['Líneas', 'Un renglón por cada producto de la orden.'],
      ['IVA de productos', 'Los productos se facturan <b>gravados</b>: el precio publicado ya incluye el IVA (19% por defecto) y la factura lo separa en base + IVA.'],
      ['Envío', 'Si la orden tiene costo de envío, va en un renglón aparte llamado <b>"Envío"</b>, <b>excluido de IVA</b>.'],
      ['Comprador', 'Quien hizo la compra, con sus datos fiscales. Si le faltan, la orden queda sin factura hasta completarlos.'],
    ]) +
    tip('Mensualidades vs. productos', 'El interruptor <b>"Servicios excluidos de IVA"</b> de la configuración aplica a mensualidades y clases. Los productos de la tienda se tratan aparte, con IVA incluido en el precio.') +
    I('Migración <code>20261003230016_tienda_v2_factura_y_eventos</code> (aplicada: <code>order_invoice_payload</code> existe): <code>guard_invoice_order_paid</code> (<code>INVOICE_ORDER_NOT_PAID</code> / <code>INVOICE_ORDER_WRONG_OWNER</code>), <code>order_invoice_payload(order)</code> con línea <code>ORD-xxxxxxxx-ENVIO</code> (<code>is_shipping</code>, IVA 0), <code>orders_pending_invoice()</code> para el cron. Emisor = tienda escolar por <code>products.school_id</code> o <code>vendor_profile_id</code>. El cron de órdenes solo corre con la tienda prendida (<code>isStoreEnabled()</code>, spec blindaje §1.3). Config <code>products_tax_excluded</code>/<code>products_tax_rate</code> en el JSON del proveedor (no hay campo en el formulario). Vendedor externo: no hay panel donde configurar su PAC (solo admin vía API).')
  );

  // ── Cap. 8 — Checklist ──
  pgs.push(
    chapter(8, 'Si una factura no salió', 'Lista de chequeo, en orden', '') +
    table(['#', 'Revisar', 'Cómo se arregla'], [
      ['1', 'La tarjeta del facturador dice <b>Deshabilitado</b> o no hay facturador', 'Configúralo (capítulo 2) o escríbenos para activarlo.'],
      ['2', 'El pago <b>no está pagado</b> (pendiente de aprobación, rechazado)', 'Apruébalo en Pagos; la factura sale en los siguientes 15 minutos.'],
      ['3', 'El pagador aparece en <b>Datos fiscales faltantes</b>', 'Completar datos. Luego, si el pago tiene más de 3 días, emitirlo por rango.'],
      ['4', 'El cobro <b>no tiene pagador</b> vinculado', 'Vincular el acudiente (o la cuenta del deportista adulto) en la ficha del deportista.'],
      ['5', 'El pago se aprobó o registró <b>hace más de 3 días</b>', 'Emitir facturas de un periodo con esas fechas de pago.'],
      ['6', 'Aparece <b>Rechazada</b>', 'Leer el motivo en la fila, corregir el dato y volver a emitir el rango.'],
      ['7', 'Aparece <b>Emitida · esperando DIAN</b> hace más de una hora', 'Buscar el código de referencia en el portal del proveedor y escribirnos.'],
    ]) +
    tip('Antes de cerrar el mes', 'Abre <b>Datos fiscales faltantes</b>: si el número rojo es 0 y "Emitir facturas de un periodo" del mes dice <b>0 documento(s) por emitir</b>, todo lo cobrado está facturado.')
  );

  if (isInternal) {
    pgs.push(
      chapter(9, 'Notas internas: proveedores, huecos y gotchas', 'Solo equipo SportMaps — no prometer a la escuela', '') +
      table(['Tema', 'Estado real (2026-10-05)'], [
        ['PAC soportados', '<code>factus</code> (v1: emite, <b>sin</b> notas crédito) y <code>factus_v2</code> (emite + nota crédito). Siigo/Alegra: solo comentados en <code>services/invoicing/index.ts</code>. Sumar uno = un <code>*.adapter.ts</code>.'],
        ['FAQ desactualizada', '<code>help-articles.ts</code> l. ~2617 dice "en plan Elite tenemos integración con Siigo y Alegra": <b>falso</b>, corregir.'],
        ['Factus Pay (QR)', 'NO está en la UI de la escuela. Adaptador <code>factus-pay.service.ts</code> + spec <code>docs/specs/factus-pay-recaudo-qr.md</code>; F1 (QR en factura SaaS) espera aprobación. Con la cuenta de SportMaps la plata cae en SportMaps: para mensualidades cada escuela necesita su propia cuenta (F3).'],
        ['Interruptor on/off', 'No existe en la UI; guardar siempre prende.'],
        ['Emitir un pago suelto / reintentar una fila', 'Endpoint existe, sin botón: se usa el rango.'],
        ['Des-pagar con factura (U5)', 'Solo RPC por SQL, sin pantalla de soporte.'],
        ['Nota crédito parcial / nota débito', 'No existen (la NC siempre va por el total).'],
        ['PDF/XML propios, marca blanca', 'No existen; solo <code>public_url</code> del PAC.'],
        ['Panel del vendedor externo', 'No existe (InvoicingTab está parametrizado, falta dónde colgarlo).'],
        ['Medio de pago "card"', 'Cae en código DIAN "1 no definido" (no está en <code>CONFIRMED_PAYMENT_METHOD_CODES</code>).'],
      ]),
      warn('Dynasty: cobros pagados sin factura', 'El plan F0 (<code>docs/specs/contabilidad-v2-f0-plan-migraciones.md</code> §P1-7) contó <b>72</b> cobros <code>paid</code> desde el 1-sep sin factura: <b>27 sin pagador</b> (<code>payment_without_payer</code>, $4,2M), <b>38 con pagador sin documento</b> (<code>customer_missing_fiscal_data</code>, se saltan en silencio, $6,16M) y <b>7 con datos completos pero fuera de la ventana de 3 días</b> ($1,29M). Medido hoy (SQL, solo lectura) ya son <b>92</b>: 39 sin pagador, 51 sin documento, 2 listos fuera de ventana. Va creciendo: hay que completar datos y correr el rango de septiembre/octubre. Ojo con julio/agosto: el usuario decidió facturar <b>solo desde septiembre</b> aunque el panel los cuente.') +
      tip('Cómo se hicieron las capturas', 'dev.sportmaps.co con <b>Club Campestre Demo</b> (owner). La demo no tiene facturador ni sandbox de Factus, así que <b>no se emitió nada</b>: el formulario se llenó con valores de ejemplo y se canceló. Para que la pantalla existiera se prendió el addon <code>invoicing</code> de la demo (<code>school_addons</code> <code>039e581d…</code>) durante la corrida y se volvió a apagar. No se creó ninguna fila. Dynasty producción: <code>factus_v2</code>, <code>enabled</code>, rango NC <code>2701</code>, 233 facturas aceptadas. Regenerar: <code>capture.mjs</code> (con el addon prendido) + <code>build.mjs</code> en <code>docs/manuales/_src/manual-facturacion-electronica/</code>.')
    );
  }
  return pgs;
}

// ── Documento ─────────────────────────────────────────────────────────────
function cover(isInternal) {
  return `<div class="page cover"><div class="cover-inner">
    <div><div class="logo"><span class="pin"></span>SportMaps</div></div>
    <div>
      <div class="cover-eyebrow"><span class="dot" style="background:${isInternal ? '#ff8833' : '#4fd17a'}"></span>${isInternal ? '🔒 Uso interno — no enviar a escuelas' : 'Guía de uso · Academias'}</div>
      <h1 class="cover-title">Facturación electrónica DIAN</h1>
      <p class="cover-sub">Qué necesita tu escuela, cómo conectar el proveedor, qué datos del acudiente se piden, cómo salen las facturas (solas o por periodo), cómo consultarlas y cómo anular con nota crédito.</p>
      <div class="pills">
        <span class="pill">Panel de escuela · Finanzas</span>
        <span class="pill">Rol: Owner / Admin</span>
        <span class="pill">${isInternal ? '9' : '8'} capítulos</span>
        <span class="pill">Capturas reales del producto</span>
        ${isInternal ? '<span class="pill" style="border-color:#ff8833;color:#ffcf9e">Uso interno</span>' : ''}
      </div>
    </div>
    <div class="cover-footer">SportMaps © 2026 · octubre</div>
  </div></div>`;
}

const css = () => fs.readFileSync(path.join(here, 'manual.css'), 'utf8') +
  '\n.page ul li{margin-bottom:4px}\n';

function html(isInternal) {
  const body = pages(isInternal);
  const total = body.length + 1;
  const foot = (n) => `<div class="footer${isInternal ? ' internal-mark' : ''}"><span>SportMaps · ${isInternal ? 'Uso interno' : 'Guía de uso'}</span><span>Página ${n} de ${total}</span></div>`;
  return `<!doctype html><html><head><meta charset="utf-8" /><title>SportMaps — Facturación electrónica (${isInternal ? 'Interno' : 'Academias'})</title><style>${css()}</style></head><body>` +
    cover(isInternal) +
    body.map((pg, i) => `<div class="page">${pg}${foot(i + 2)}</div>`).join('\n') +
    `</body></html>`;
}

async function render() {
  const browser = await chromium.launch();
  try {
    await makeCrops(browser);
    for (const [ver, base] of Object.entries(OUT)) {
      const isInternal = ver === 'interno';
      const doc = html(isInternal);
      fs.mkdirSync(path.dirname(base), { recursive: true });
      fs.writeFileSync(`${base}.html`, doc, 'utf8');
      const page = await browser.newPage();
      await page.goto('file:///' + `${base}.html`.replace(/\\/g, '/'));
      await page.waitForFunction(() => [...document.images].every((img) => img.complete && img.naturalHeight > 0));
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(() =>
        [...document.querySelectorAll('.page')].map((el, i) => ({ n: i + 1, h: el.scrollHeight })).filter((x) => x.h > 1056));
      if (overflow.length) console.warn(`⚠️  ${ver}: páginas que desbordan 1056px →`, overflow);
      await page.pdf({ path: `${base}.pdf`, width: '816px', height: '1056px', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
      const n = await page.evaluate(() => document.querySelectorAll('.page').length);
      await page.close();
      console.log(`✅ ${ver}: ${base}.pdf (${n} páginas esperadas)`);
    }
  } finally {
    await browser.close();
  }
}

render().catch((e) => { console.error(e); process.exit(1); });
