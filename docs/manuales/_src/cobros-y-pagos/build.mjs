// Genera el manual «Cobros y pagos» (reemplaza a guia-registro-pagos-manual de abril)
// en sus dos versiones (interno / academias) como HTML + PDF, con las capturas
// reales de ./shots/ (las produce capture.mjs, mismo directorio).
//
//   node docs/manuales/_src/cobros-y-pagos/build.mjs
//
// Sistema visual: el de todos los manuales (memoria feedback_pdf_manual_template).
// Chromium de Playwright hace los recortes (canvas) y el PDF. Avisa qué .page
// desborda 1056px (overflow:hidden recorta en silencio).

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
const NAME = 'guia-registro-pagos-manual';
const OUT = {
  academias: path.join(repo, 'docs/manuales/academias', NAME),
  interno: path.join(repo, 'docs/manuales/interno', NAME),
};
const SCALE = 2; // deviceScaleFactor de las capturas

// ── Recortes ──────────────────────────────────────────────────────────────
// rect: coordenadas en CSS px de la captura. modal: el diálogo (1024×1150 CSS)
// se recorta quitando el vacío entre el contenido y el pie fijo con botones;
// `top` fija el alto si no hay pie (pantalla de resultado).
const CROP_DEFS = {
  'c01-pagos-boton.png':      { src: '01-pagos-boton.png', rect: { x: 270, y: 80, w: 1320, h: 310 } },
  'c09-historial.png':        { src: '09-historial.png', rect: { x: 270, y: 335, w: 1320, h: 560 } },
  'c10-deportistas.png':      { src: '10-deportistas.png', rect: { x: 290, y: 480, w: 1280, h: 165 } },
  'c11-deportistas-menu.png': { src: '11-deportistas-menu.png', rect: { x: 290, y: 480, w: 1280, h: 215 } },
  'c06-tipos.png':            { src: '06-tipos-de-cobro.png', rect: { x: 318, y: 732, w: 205, h: 395 } },
  'c19-operaciones.png':      { src: '19-operaciones.png', rect: { x: 270, y: 395, w: 1320, h: 720 } },
  'c02-modal-vacio.png':      { src: '02-modal-vacio.png', modal: true },
  'c03-selector.png':         { src: '03-selector.png', modal: true },
  'c04-pendientes.png':       { src: '04-pendientes.png', modal: true },
  'c05-descuento-linea.png':  { src: '05-descuento-linea.png', modal: true },
  'c07-listo.png':            { src: '07-listo-para-confirmar.png', modal: true },
  'c08-resultado.png':        { src: '08-resultado.png', modal: true, top: 330 },
  'c12-deportistas-modal.png': { src: '12-deportistas-modal.png', modal: true },
  'c13-descuento-general.png': { src: '13-descuento-general.png', modal: true },
  'c14-resultado-sin-pago.png': { src: '14-resultado-sin-pago.png', modal: true, top: 330 },
  'c15b-multi-equipo.png':    { src: '15b-multi-equipo.png', modal: true },
  'c16-multi-vista-previa.png': { src: '16-multi-vista-previa.png', modal: true },
  'c17-multi-resultado.png':  { src: '17-multi-resultado.png', modal: true, top: 330 },
};

async function makeCrops(browser) {
  fs.mkdirSync(CROPS, { recursive: true });
  const page = await browser.newPage();
  for (const [out, def] of Object.entries(CROP_DEFS)) {
    const src = path.join(SHOTS, def.src);
    if (!fs.existsSync(src)) throw new Error(`Falta la captura ${def.src}. Corre capture.mjs primero — este manual no lleva mockups.`);
    const b64 = fs.readFileSync(src).toString('base64');
    const cropped = await page.evaluate(async ([b64, def, s]) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const W = img.width, H = img.height;
      const full = document.createElement('canvas');
      full.width = W; full.height = H;
      const fctx = full.getContext('2d');
      fctx.drawImage(img, 0, 0);
      const out = document.createElement('canvas');
      const octx = out.getContext('2d');
      if (def.rect) {
        const r = def.rect;
        out.width = r.w * s; out.height = r.h * s;
        octx.drawImage(img, r.x * s, r.y * s, r.w * s, r.h * s, 0, 0, r.w * s, r.h * s);
      } else if (def.top) {
        out.width = W; out.height = def.top * s;
        octx.drawImage(img, 0, 0, W, def.top * s, 0, 0, W, def.top * s);
      } else {
        const d = fctx.getImageData(0, 0, W, H).data;
        const px = (x, y) => { const i = (y * W + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
        // inicio del pie fijo: primera fila (≥ 900 CSS px) con el borde gris
        let ft = H - 150 * s;
        for (let y = 900 * s; y < H; y++) { if (px(300 * s, y)[0] < 245) { ft = y; break; } }
        // fin del contenido: última fila no blanca antes del pie (sin la línea vertical de la columna lateral)
        let cb = 300 * s;
        for (let y = ft - 4; y > 300 * s; y--) {
          let hit = false;
          for (let x = 8; x < W - 8 && !hit; x += 2) {
            if (x > 696 * s && x < 712 * s) continue;
            const p = px(x, y);
            if (Math.min(p[0], p[1], p[2]) < 236) hit = true;
          }
          if (hit) { cb = y + 1; break; }
        }
        const topH = Math.min(cb + 22 * s, ft - 6 * s);
        out.width = W; out.height = topH + (H - ft);
        octx.fillStyle = '#fff'; octx.fillRect(0, 0, out.width, out.height);
        octx.drawImage(img, 0, 0, W, topH, 0, 0, W, topH);
        octx.drawImage(img, 0, ft, W, H - ft, 0, topH, W, H - ft);
      }
      return out.toDataURL('image/png').split(',')[1];
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
const sub = (title, intro = '') => `<h3 style="font-size:21px;font-weight:800;margin:0 0 6px;color:#123416">${title}</h3><hr class="chapter-rule" />${intro ? p(intro) : ''}`;
const table = (head, rows) =>
  `<table class="tbl"><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`;

// ── Contenido: cada entrada del array es UNA página ───────────────────────
function pages(isInternal) {
  const I = (html) => (isInternal ? internal(html) : '');
  const pgs = [];

  // ── Cap. 1 ──
  pgs.push(
    chapter(1, 'Qué es «Cobros y pagos» y dónde se abre', 'Pagos → Cobros y pagos · Deportistas → lápiz → Editar estado de cuenta · Equipos → Cobrar a este equipo',
      '«Cobros y pagos» es <b>una sola ventana</b> para todo lo que se hace con el dinero de un deportista: <b>registrar lo que la familia ya pagó</b>, <b>crear cobros nuevos</b>, <b>aplicar descuentos</b> con su motivo y <b>cobrarle lo mismo a todo un equipo</b>. Reemplaza al botón «Registrar pago» de antes, que solo anotaba un pago.') +
    step(1, 'Desde Pagos',
      p('En <b>Gestión de Pagos</b>, el botón <b>«Cobros y pagos»</b> está arriba a la derecha, junto a «Actualizar». Abre la ventana en blanco: ahí eliges a quién.'),
      crop('c01-pagos-boton.png', 'Gestión de Pagos: el botón «Cobros y pagos» y, en las pestañas, «Operaciones» (el historial de lo que se hizo con esta ventana).', 540)) +
    step(2, 'Desde Deportistas',
      p('En la lista de deportistas, el <b>lápiz</b> de la fila ofrece dos opciones: «Editar deportista» y <b>«Editar estado de cuenta»</b>. La segunda abre «Cobros y pagos» con el deportista <b>ya elegido y fijo</b> (no se puede cambiar por otro). En el celular, en los tres puntos de la tarjeta: <b>«Cobros y pagos»</b>.'),
      crop('c11-deportistas-menu.png', 'Deportistas: el lápiz de la fila abre «Editar deportista» o «Editar estado de cuenta».', 540)) +
    step(3, 'Desde Equipos',
      p('En <b>Mis Equipos</b>, cada equipo activo tiene <b>«Cobrar a este equipo»</b>: abre la ventana en el modo «Varios atletas» con ese equipo ya elegido (capítulo 5).', 'no-shot')) +
    tip('Quién lo ve', 'Solo el <b>dueño y los administradores</b>. El entrenador no los ve (no registra dinero); el contador ve «Operaciones», sin botones para anular.')
  );

  // ── Cap. 2 ──
  pgs.push(
    chapter(2, 'Registrar lo que una familia ya pagó', 'Cobros y pagos → modo «Un atleta»',
      'Es el caso de todos los días: la familia pagó en efectivo o por transferencia y hay que dejarlo anotado. La ventana tiene tres zonas: a la izquierda <b>el atleta, sus cobros pendientes y los cobros nuevos</b>; a la derecha <b>el descuento general, «Ya lo pagaron» y la vista previa</b>; abajo, el botón que confirma.') +
    step(1, 'Elegir el atleta',
      p('Abre el selector y escribe el <b>nombre, el acudiente o el teléfono</b>. Debajo del nombre ves el plan y si tiene acudiente vinculado. Si es una persona nueva, el botón <b>«Atleta nuevo»</b> pide nombre, teléfono del acudiente (o del adulto), documento y fecha de nacimiento opcionales, y avisa si ya existe alguien parecido para que no lo dupliques.'),
      crop('c03-selector.png', 'El selector busca por nombre, acudiente o teléfono. Los nombres de esta guía son de la escuela de pruebas.', 600))
  );
  pgs.push(
    step(2, 'Ver sus cobros pendientes y marcar los que cubre el pago',
      p('Al elegir al atleta aparece <b>«Cobros pendientes · marca los que cubre»</b>: cada cobro abierto con su concepto, si está vencido, el saldo y el valor. Marca con la casilla <b>solo los que la familia pagó</b>. Si no marcas ninguno, no se registra pago de cobros viejos (puedes igual crear cobros nuevos).'),
      crop('c04-pendientes.png', 'Dos mensualidades vencidas. Nada marcado: abajo dice «Marca un cobro pendiente o agrega un cobro nuevo».', 600)) +
    p('Un cobro con el <b>comprobante en revisión</b> o con un <b>pago en línea en curso</b> sale bloqueado, con el motivo escrito: primero se aprueba o rechaza el comprobante, o se espera el resultado del pago en línea.')
  );
  pgs.push(
    step(3, 'Ajustar cuánto se paga y, si hace falta, dar un descuento',
      p('Al marcar un cobro aparece <b>«Pagar»</b> con el saldo completo; puedes escribir un valor menor. El botón <b>«Descuento»</b> abre el valor, el tipo (% o $) y el <b>motivo</b>; al lado ves el efecto en pesos («−$18.000 → $162.000») y el saldo nuevo arriba a la derecha. Más sobre descuentos en el capítulo 3.'),
      crop('c05-descuento-linea.png', 'Mensualidad 08/2026 marcada, con un 10 % de descuento por «Convenio»: el saldo baja de $180.000 a $162.000.', 620))
  );
  pgs.push(
    step(4, 'Agregar un cobro nuevo, si la familia pagó algo que aún no estaba cobrado',
      p('En <b>«Nuevos cobros»</b> pulsa <b>«Agregar cobro»</b>, elige el <b>tipo</b>, escribe el <b>detalle</b> («Uniforme de entrenamiento»), el <b>valor</b> y el <b>vencimiento</b> (por defecto, 10 días). Queda marcado <b>«Pagar»</b> para registrarlo ya como pagado; desmárcalo si solo quieres dejarlo cobrado.'),
      '') +
    `<div style="display:flex;gap:18px;align-items:flex-start;margin-top:6px"><div style="flex:0 0 215px">${crop('c06-tipos.png', 'El desplegable «Tipo de cobro».', 205)}</div><div style="flex:1">` +
    table(['Tipo', 'Qué es'], [
      ['<b>Mensualidad</b>', 'La cuota del mes. Eliges el mes (y el plan, si tiene más de uno); da vigencia y es la única que puede entrar en mora.'],
      ['<b>Inscripción · Seguro</b>', 'Se cobran una vez. El seguro no se repite si ya se cobró en los últimos 12 meses.'],
      ['<b>Artículos / uniformes · Torneo · Clase extra · Vacacional · Viaje · Otro cobro</b>', 'Cobros únicos con el detalle que escribas. «Pago único · no genera mora».'],
      ['<b>Horas adicionales</b>', 'El excedente del banco de horas. Solo lo cobra el dueño de la escuela.'],
    ]) + `</div></div>` +
    p('Un atleta <b>nuevo</b> todavía no tiene plan, así que no se le puede generar mensualidad. Cada cobro nuevo admite una <b>nota interna</b> que la familia no ve.')
  );

  pgs.push(
    step(5, 'Marcar «Ya lo pagaron» y ver la vista previa',
      p('A la derecha, <b>«Ya lo pagaron»</b> (encendido por defecto) es lo que convierte la operación en un pago registrado: eliges <b>Efectivo</b> o <b>Transferencia</b>, la <b>fecha del pago</b> (hoy o una anterior, nunca futura) y, si quieres, una <b>referencia</b>. Debajo, «Se registran $172.000» suma todo lo marcado. La <b>vista previa</b> se calcula sola unos segundos después de cada cambio; «Actualizar» la fuerza.'),
      crop('c07-listo.png', 'Listo para confirmar: se crea 1 cobro por $10.000 y se registra el pago de 2 cobros por $172.000. El botón dice «Generar 1 · Pagar 2».', 620)) +
    p('<b>Importante:</b> el botón solo se enciende cuando la vista previa está al día con lo que escribiste. Si cambias algo, espera un momento a que vuelva a calcular.')
  );
  pgs.push(
    step(6, 'Confirmar',
      p('Pulsa el botón principal. Sale la pantalla de resultado con el resumen («1 cobro creado por $10.000, 2 pagos registrados ($172.000)») y cuatro opciones: <b>Ver operación</b> (te lleva a la pestaña «Operaciones» cuando abriste desde Pagos), <b>Anular lote</b>, <b>Otra operación</b> y <b>Cerrar</b>.'),
      crop('c08-resultado.png', 'Resultado de la operación.', 520)) +
    step(7, 'Comprobar el resultado',
      p('El pago aparece de inmediato en <b>Pagos → Historial</b>, con el método («Efectivo»), el estado «Pagado» y a qué mes cubre. Cada cobro que se pagó con descuento queda por el valor ya descontado.'),
      crop('c09-historial.png', 'Historial: la mensualidad de agosto por $162.000 y el uniforme por $10.000, ambos en efectivo.', 560))
  );

  pgs.push(
    sub('El botón principal: qué dice y por qué está apagado',
      'El texto del botón te dice exactamente qué va a pasar; si está apagado, <b>a la izquierda del botón</b> aparece el motivo.') +
    table(['El botón dice', 'Qué hace'], [
      ['<b>Generar 1 · Pagar 2</b>', 'Crea 1 cobro nuevo y registra el pago de 2 cobros (los marcados y los nuevos con «Pagar»).'],
      ['<b>Generar 2</b>', 'Solo crea cobros; nadie pagó (con «Ya lo pagaron» apagado, o sin «Pagar» en las líneas).'],
      ['<b>Registrar pago</b> / <b>Registrar pago (3)</b>', 'Solo registra el pago de 1 (o 3) cobros que ya existían.'],
      ['<b>Guardar descuentos</b>', 'Solo aplica descuentos o condonaciones a cobros marcados, sin registrar ningún pago.'],
    ]) +
    table(['Motivo que aparece', 'Qué hacer'], [
      ['«Elige el atleta.»', 'Falta elegir a quién.'],
      ['«Marca un cobro pendiente o agrega un cobro nuevo.» (el botón dice «Registrar pago»; arriba «Se registran $0.»)', 'No hay nada marcado ni agregado.'],
      ['«Corrige lo marcado en rojo.»', 'Hay un dato incompleto: por ejemplo un cobro nuevo sin valor, un descuento sin motivo, una fecha de pago futura o un vencimiento anterior a hoy.'],
      ['«Calculando la vista previa…» / «Esperando la vista previa.»', 'Espera unos segundos o pulsa «Actualizar».'],
    ]) +
    tip('Sin avisos por sorpresa', 'Los <b>cobros nuevos</b> no se avisan a la familia por correo ni WhatsApp: la familia los ve en su app. La casilla «Avisar por correo/WhatsApp» del pie viene <b>apagada</b>; enciéndela solo si quieres avisar. Al registrar un <b>pago</b>, la familia recibe la notificación «Pago registrado» con el total recibido.') +
    I('Verificado en dev el 17-oct: «Pago registrado» llegó con push; los «Nuevos cobros» llegaron sin push (solo in-app) y «Cobros anulados» también sin push. Quitar un descuento no genera ninguna notificación.')
  );

  // ── Cap. 3 ──
  pgs.push(
    chapter(3, 'Descuentos, condonar la mora y «No cobrar»', 'Cobros y pagos → «Descuento» en cada cobro · «Descuento general» a la derecha',
      'Todo descuento <b>exige motivo</b> y queda registrado: quién lo aplicó, cuándo, con qué motivo y cuál era el valor original. Solo lo hace el dueño o un administrador; la familia nunca ve estas casillas.') +
    step(1, 'Descuento en un cobro',
      p('Valor + <b>%</b> o <b>$</b> + <b>motivo</b> (Pronto pago, Varios meses juntos, Hermanos, Beca, Convenio, Cortesía, Ajuste de precio, Error de cobro u Otro, que pide que escribas cuál). El descuento se calcula sobre el valor <b>sin recargo de mora</b>, y nunca puede dejar el cobro por debajo de lo que la familia ya abonó. Si el cobro tiene mora, el descuento no la toca: para eso está «Condonar recargo».')) +
    step(2, 'Descuento general',
      p('El interruptor <b>«Descuento general»</b> (arriba a la derecha) reparte un solo descuento entre varios cobros. Por defecto aplica a los que <b>no tienen descuento propio</b>; con las casillas «Sobre:» eliges a cuáles. Un % se aplica igual a cada cobro; un valor fijo se reparte en proporción a lo que vale cada uno.'),
      crop('c13-descuento-general.png', 'Descuento general del 20 % por «Beca» sobre dos cobros nuevos de $10.000: cada uno queda en $8.000. «Ya lo pagaron» está apagado, así que solo se generan los cobros.', 440))
  );
  pgs.push(
    step(3, 'Condonar el recargo de mora',
      p('Si un cobro vencido ya tiene <b>recargo por mora</b>, al marcarlo aparece el botón <b>«Condonar recargo ($…)»</b>. Por defecto condona todo; puedes escribir cuánto. El motivo viene como «Condonación de mora» y se puede cambiar. En el resumen se ve como «Recargo condonado».', 'no-shot')) +
    step(4, '«No cobrar»',
      p('Dentro del control del descuento, <b>«No cobrar»</b> exonera el cobro y pide un motivo obligatorio. En una <b>mensualidad</b> queda pagada en $0 y cuenta para la vigencia (una beca del mes); en un <b>cobro único</b> el cobro se anula. Solo se puede si nadie ha abonado nada.', 'no-shot')) +
    step(5, 'Pagar menos de lo que se debe',
      p('Si en «Pagar» escribes menos que el saldo, la ventana pregunta qué pasa con la diferencia: <b>«Abono — queda debiendo $X»</b> (el cobro sigue abierto, con un abono) o <b>«Cerrar el cobro — los $X son descuento»</b> (queda pagado y la diferencia se anota como descuento, con su motivo).', 'no-shot')) +
    step(6, 'Sugerencias y avisos',
      p('Con un descuento por <b>pronto pago</b> vigente, el cobro ofrece «Sugerencia: pronto pago X % · Usar». Al marcar <b>tres o más mensualidades</b>, la ventana propone «Varios meses juntos». Los descuentos por <b>hermanos</b> o militar se aplican solos a la mensualidad nueva. Pasar del 50 % de descuento dispara un aviso (no lo impide). Y si el descuento es «para siempre» (beca, convenio), la ventana recuerda que eso es la <b>tarifa del atleta</b> y se cambia en su inscripción.', 'no-shot')) +
    I('Condonar recargo: NO se pudo capturar en vivo (Escuela Pruebas no tiene cobros con <code>late_fee_amount &gt; 0</code>; la mora no está encendida). Texto tomado de <code>PendingChargesSection.tsx</code> (botón «Condonar recargo», campos «Cuánto se condona» y «Motivo»). Lo mismo vale para «No cobrar», «Abono / Cerrar el cobro» y las sugerencias de pronto pago / varios meses: salen del código, no se ejercieron en dev.')
  );

  // ── Cap. 4 ──
  pgs.push(
    chapter(4, 'Pagos por fuera: efectivo y transferencia', 'Cobros y pagos → «Ya lo pagaron» (columna derecha)',
      'Un <b>pago por fuera</b> es el que la familia hizo directamente a la escuela —en la caja o a una cuenta bancaria— y ahora se anota en SportMaps. «Ya lo pagaron» es el interruptor que lo activa; está encendido al abrir la ventana.') +
    table(['Campo', 'Qué poner'], [
      ['<b>Efectivo / Transferencia</b>', 'Cómo pagó. «Transferencia» incluye consignación bancaria.'],
      ['<b>Fecha del pago</b>', 'El día que recibiste el dinero. Viene con la fecha de hoy; puede ser anterior, nunca futura.'],
      ['<b>Referencia</b> (opcional)', 'Número de transferencia, de recibo de caja o lo que sirva para encontrarlo después.'],
      ['<b>Comprobante</b> (opcional; solo en Transferencia)', 'Sube la foto o el PDF. El sistema lo lee y avisa si el valor o la fecha no coinciden con lo que vas a registrar (con «Usar fecha…» para corregirla). Los avisos no te bloquean: tú ya viste el dinero.'],
      ['<b>Factura electrónica</b> (si la escuela la tiene activa)', 'Interruptor para facturar este pago. Muestra si al pagador le faltan documento, dirección o municipio, con un botón «Completar datos».'],
    ]) +
    step(1, 'Si la familia pagó varias cosas juntas',
      p('Marca <b>todos</b> los cobros que cubre y escribe el pago una sola vez: «Ya lo pagaron» suma lo marcado y registra un pago por cada cobro. Para un pago parcial usa el campo «Pagar» de cada cobro (capítulo 3, paso 5).', 'no-shot')) +
    step(2, 'Si no pagaron nada todavía',
      p('Apaga «Ya lo pagaron»: los cobros nuevos quedan <b>pendientes</b> y los cobros marcados solo reciben ajustes (descuentos, mora condonada). El botón pasa a «Generar N» o «Guardar descuentos».', 'no-shot')) +
    tip('Para el pago en línea no hay que hacer nada', 'Si la familia paga con tarjeta, PSE o un enlace de pago, el sistema registra el pago solo cuando la pasarela lo confirma. «Cobros y pagos» es para lo que se pagó por fuera.')
  );

  // ── Cap. 5 ──
  pgs.push(
    chapter(5, 'Cobrarle lo mismo a varios atletas', 'Cobros y pagos → «Varios atletas» · Equipos → Cobrar a este equipo',
      'Para un torneo, un uniforme o una mensualidad que le vas a cobrar a todo un equipo. En este modo la ventana <b>solo genera cobros</b>: no registra pagos (para eso, abre un atleta). Cambia con el selector «Un atleta / Varios atletas» de arriba.') +
    step(1, '¿A quiénes?',
      p('Elige cómo: por <b>Equipo</b>, <b>Categoría</b>, <b>Plan</b> o <b>A mano</b> (buscas y marcas uno por uno). Al elegir el grupo aparece la lista de atletas activos con una casilla en cada uno: desmarca a quien no va. «Incluir pausados» suma a los atletas en pausa.'),
      crop('c15b-multi-equipo.png', 'Por equipo: 8 atletas activos, todos marcados. Falta el valor del cobro, por eso la ventana lo marca en rojo.', 500)) +
    table(['Límite', 'Valor'], [
      ['Atletas por lote', 'Hasta 200. Si el equipo es más grande, divide por categoría o plan.'],
      ['Cobros por lote', 'Hasta 600 (atletas × cobros).'],
      ['Vencimiento', 'No puede ser anterior a hoy.'],
    ])
  );
  pgs.push(
    step(2, '¿Qué se cobra?',
      p('Igual que en el modo un atleta —tipo, detalle, valor, vencimiento, nota—, pero <b>el mismo cobro para todos</b>. Una mensualidad sin valor toma el de cada atleta según su plan. «Descuento para todos» aplica el mismo % o valor a cada cobro de cada atleta.'),
      crop('c16-multi-vista-previa.png', 'Dos atletas elegidos a mano, un torneo de $10.000 para cada uno: «Se van a crear 2 cobros por $20.000». «Detalle por atleta» muestra uno por uno.', 430)) +
    step(3, 'Revisar la vista previa y generar',
      p('La vista previa dice cuántos cobros se crean y por cuánto, y <b>«Se omiten N»</b> con la razón de cada uno (ya tiene la mensualidad de ese mes, ya tiene seguro en los últimos 12 meses, ya tiene ese mismo cobro creado hoy, no tiene inscripción activa…). Cuando la razón lo permite, aparece <b>«Cobrar igual»</b>. Si algún atleta no tiene acudiente vinculado, la ventana lo avisa y ofrece <b>«Omitirlos»</b>. El botón dice «Generar N» y se enciende cuando la vista previa está al día.')) +
    warn('Un atleta sin inscripción activa se omite', 'En el modo «Varios atletas» se omite a quien <b>no tiene una inscripción activa</b>, aunque lo hayas marcado a mano (la vista previa dice «no tiene inscripción activa»). En el modo «Un atleta» sí puedes crearle cobros a un atleta sin inscripción.') +
    step(4, 'El resultado',
      p('Sale «Listo» con el resumen («2 cobros creados por $20.000») y los mismos botones del modo un atleta, entre ellos «Anular lote». El lote queda guardado como <b>una operación</b> en Pagos → Operaciones (capítulo 6). Cada familia recibe <b>una sola notificación</b> dentro de la app (sin aviso al celular), aunque tenga varios hijos en el lote.', 'no-shot'))
  );

  // ── Cap. 6 ──
  pgs.push(
    chapter(6, 'Corregir un error: qué se puede y qué no', 'Pagos → Operaciones · Cobros y pagos antes de confirmar',
      'Cada decisión tiene un momento: <b>antes de confirmar</b> se corrige todo en la ventana; <b>después</b>, depende de si alguien ya pagó el cobro.') +
    table(['Quiero…', 'Se puede', 'Cómo'], [
      ['Cambiar un dato antes de confirmar', 'Sí', 'Todo se edita en la ventana hasta pulsar el botón: valores, descuentos, método, fecha. «Cancelar» no guarda nada.'],
      ['Deshacer cobros que creé por error y nadie ha pagado', 'Sí', 'Pagos → Operaciones → <b>Anular lote</b> (o «Anular lote» en la pantalla de resultado, apenas confirmas).'],
      ['Quitar un descuento de un cobro que sigue abierto', 'Sí', 'Pagos → Operaciones → Ver detalle → <b>Quitar descuento</b>, con motivo.'],
      ['Rechazar un comprobante que no corresponde', 'Sí', 'Pagos → Cobros por Aprobar → «Rechazar», con motivo (flujo de siempre).'],
      ['Anular una factura electrónica ya emitida', 'Sí', 'Con nota crédito desde Contabilidad → Facturación electrónica. Un pago con factura vigente no se puede anular.'],
      ['Cambiar el monto, la fecha o el método de un pago ya registrado', '<b>No existe todavía</b>', '—'],
      ['Borrar o devolver un pago ya registrado como pagado', '<b>No existe todavía</b>', '—'],
      ['Cambiar el valor de un cobro ya creado', '<b>No existe todavía</b>', 'Se anula el lote (si nadie pagó) y se crea de nuevo.'],
    ]) +
    warn('Lo que ya está pagado es definitivo', 'Anular un lote <b>no toca</b> lo pagado, lo que está en revisión ni lo facturado, y un descuento de un cobro ya pagado no se puede quitar. Hoy no hay forma, desde la app, de corregir un pago registrado con un valor, fecha o método equivocado. La guía anterior decía «contacta al administrador»: eso sigue siendo cierto para este caso, y todavía no hay una opción de «anular pago».')
  );
  pgs.push(
    sub('Pagos → Operaciones: el historial de lo que se hizo',
      'Cada vez que alguien confirma en «Cobros y pagos» queda una <b>operación</b>: fecha y hora, quién la hizo, a quién («Un atleta», «Varios atletas (a mano)», «Equipo…»), cuántos <b>cobros creó</b> y por cuánto, cuántos <b>pagos registró</b>, los <b>descuentos</b> y el <b>recargo condonado</b>, y un estado: <b>Vigente</b>, <b>Anulado en parte</b> o <b>Anulado</b>.') +
    crop('c19-operaciones.png', 'Operaciones: la más reciente arriba. El primer lote ya está anulado (con su motivo); los otros siguen vigentes y tienen «Anular lote».', 700) +
    p('El interruptor <b>«Con descuentos»</b> deja solo las operaciones que tuvieron descuento o mora condonada, y <b>«Informe de descuentos de este mes»</b> (al final) lista cada descuento con quién lo aplicó y por qué. «Cargar más» trae operaciones anteriores.')
  );
  pgs.push(
    step(1, 'Ver el detalle',
      p('<b>«Ver detalle»</b> abre cada cobro de la operación con su valor, su estado y los descuentos que tiene.'),
      '' ) +
    `<div class="shot-wrap"><img class="shot" style="width:700px;max-height:none" src="data:image/png;base64,${fs.readFileSync(path.join(SHOTS, '20-operaciones-detalle.png')).toString('base64')}" alt="detalle"/><div class="shot-caption">Detalle de un lote con dos cobros con «Beca −20 %». Cada uno tiene su «Quitar descuento».</div></div>` +
    step(2, 'Anular un lote',
      p('<b>«Anular lote»</b> pide un motivo (obligatorio, entre 3 y 300 caracteres) y dice antes <b>exactamente cuántos cobros</b> se van a anular y por cuánto. Solo se anula lo que nadie ha pagado; lo pagado, en revisión o facturado no se toca. Las familias reciben una notificación «La escuela anuló N cobros» dentro de la app.'),
      `<div class="shot-wrap"><img class="shot" style="width:380px;max-height:none" src="data:image/png;base64,${fs.readFileSync(path.join(SHOTS, '18-anular-lote.png')).toString('base64')}" alt="anular"/><div class="shot-caption">Anular lote: «Se anularán 2 cobros pendientes por $20.000».</div></div>`) +
    warn('Las mensualidades anuladas vuelven', 'Si anulas una <b>mensualidad</b> del mes en curso, la ventana lo avisa: el ciclo normal del mes la <b>volverá a generar</b>. Es lo correcto cuando el lote era un error.')
  );
  pgs.push(
    step(3, 'Quitar un descuento',
      p('Solo mientras <b>nadie haya pagado</b> ese cobro. «Quitar descuento» pide un motivo y el cobro <b>sube</b> a su valor anterior («Beca −20 %: el cobro sube $2.000»). Queda en el historial como una reversión; no se borra el descuento original. No funciona si el cobro tiene un pago en curso o un comprobante en revisión.'),
      `<div class="shot-wrap"><img class="shot" style="width:380px;max-height:none" src="data:image/png;base64,${fs.readFileSync(path.join(SHOTS, '21-quitar-descuento.png')).toString('base64')}" alt="quitar"/><div class="shot-caption">Quitar descuento: el motivo es obligatorio.</div></div>`) +
    `<div class="shot-wrap"><img class="shot" style="width:700px;max-height:none" src="data:image/png;base64,${fs.readFileSync(path.join(SHOTS, '22-descuento-quitado.png')).toString('base64')}" alt="resultado"/><div class="shot-caption">Después: el torneo volvió a $10.000 y ya no muestra descuento; el seguro conserva el suyo.</div></div>` +
    tip('Para no equivocarte', 'Antes de pulsar el botón revisa la vista previa: lo que dice ahí es lo que se guarda. Y recuerda que «Anular lote» está disponible en la pantalla de resultado apenas confirmas, mientras nadie haya pagado esos cobros.') 
  );

  // ── Cap. 7 ──
  pgs.push(
    chapter(7, 'Dónde se refleja', 'Después de confirmar',
      'Al confirmar, todo se actualiza solo; no hay que refrescar nada a mano.') +
    table(['Sección', 'Qué cambia'], [
      ['<b>Deportistas</b>', 'El estado del pago pasa a <b>«Al día»</b> cuando ya no le queda nada vencido ni pendiente. Si le quedan cobros abiertos, sigue «Vencido» o «Pendiente».'],
      ['<b>Recordatorios de cobro</b>', 'Un cobro pagado sale de la lista; un cobro nuevo sin pagar entra.'],
      ['<b>Pagos → Historial</b>', 'El pago aparece como <b>Pagado</b>, con el método, la fecha y el mes que cubre.'],
      ['<b>Pagos → Operaciones</b>', 'La operación completa: qué se creó, qué se pagó, qué se descontó y quién lo hizo.'],
      ['<b>Estadísticas de Pagos</b>', 'El dinero recibido suma a «Ingresos Totales» y a «Transacciones».'],
      ['<b>La app de la familia</b>', 'Ve el pago como «Pagado», los cobros nuevos como pendientes y, si hubo descuento, el valor ya descontado. Recibe la notificación «Pago registrado».'],
    ]) +
    tip('Qué ve la familia de un descuento', 'La familia ve el valor final del cobro. <b>El motivo del descuento y la nota interna son solo para la escuela.</b>')
  );
  pgs.push(
    chapter(7, 'Preguntas frecuentes', 'Pagos y cobros', '') +
    step(1, 'Un padre me pagó, pero tiene varios cobros pendientes. ¿Qué hago?',
      p('Marca en «Cobros pendientes» <b>los que cubre el pago</b>. Ya no se cierra todo de una vez: tú decides cuáles. Si pagó menos de lo que debía, escribe el valor en «Pagar» y elige si queda como abono o se cierra el cobro con la diferencia como descuento.', 'no-shot')) +
    step(2, 'Me equivoqué al registrar un pago. ¿Cómo lo corrijo?',
      p('Si todavía no pulsaste el botón, corrige en la ventana. Si ya lo confirmaste, <b>hoy no hay opción para editar ni anular un pago ya registrado</b>: hay que pedirle la corrección al equipo de SportMaps. Si lo que te equivocaste fue <b>crear cobros</b> y nadie los ha pagado, usa «Anular lote».', 'no-shot')) +
    step(3, '¿Cuál es la diferencia con el pago en línea?',
      p('«Cobros y pagos» es para lo que se pagó <b>por fuera</b> (efectivo o transferencia ya recibidos) y queda pagado al instante. En el pago en línea la familia paga desde su celular y el cobro queda pendiente hasta que la pasarela confirma. Si registras un pago, el cobro deja de aparecer como deuda; y si la familia tiene un pago en línea en curso o un comprobante en revisión, el cobro sale bloqueado hasta que se resuelva.', 'no-shot')) +
    step(4, '¿Le llega un aviso a la familia? ¿Por qué no veo el botón?',
      p('Al <b>registrar un pago</b>, la familia recibe «Pago registrado» con el total. Al <b>crear cobros</b> no hay correo ni WhatsApp salvo que enciendas «Avisar por correo/WhatsApp»; los ve en su app. El botón es solo del dueño y los administradores.', 'no-shot'))
  );

  if (isInternal) {
    pgs.push(
      chapter(8, 'Notas internas: estado, hallazgos y datos de prueba', 'Solo equipo SportMaps — no enviar a escuelas', '') +
      internal('<b>El modal nuevo está detrás de una bandera.</b> Hoy el botón «Cobros y pagos» y todo lo de esta guía solo aparece con <code>VITE_COBROS_Y_PAGOS=on</code> en el build, o en un navegador con <code>localStorage[\'sportmaps:cobros-y-pagos\'] = \'on\'</code> (<code>lib/cobrosYPagosFlag.ts</code>). Sin la bandera, todos los puntos de entrada abren el «Registrar pago» de siempre y «Operaciones» no existe. No enviar esta guía a una escuela hasta encender la bandera (o borrarla junto con el modal viejo).') +
      internal('<b>Contenido de la guía anterior que ya no aplica:</b> «Registrar pago» (un solo formulario Efectivo/Transferencia), «salda TODOS los pendientes de una vez» (ahora se marca cuáles), «Guardar y confirmar», el correo de confirmación automático, la tarjeta «Cobros Pendientes por Generar» en Config (ya no existe; hoy el botón de Config se llama «Abrir el mes») y la frase «contacta al administrador / próximamente anular pagos» (sigue sin existir).') +
      table(['Qué se vio en vivo (dev.sportmaps.co, Escuela Pruebas, 17-oct-2026)', 'Resultado'], [
        ['Abrir desde Pagos y desde Deportistas (lápiz → «Editar estado de cuenta»), elegir atleta, marcar pendiente, descuento por línea 10 %, cobro nuevo, efectivo + referencia, vista previa, confirmar', 'Funciona. Pago de $162.000 + $10.000 registrado, aviso «Pago registrado» entregado.'],
        ['Descuento general 20 % sobre 2 cobros nuevos, sin pago', 'Funciona. Se crearon 2 cobros de $8.000 (lista $10.000).'],
        ['Modo varios (por equipo: vista previa; a mano: confirmar) y «Anular lote»', 'Funciona. Atletas sin inscripción activa → «Se omiten» y «Generar 0».'],
        ['Operaciones, Ver detalle, Quitar descuento', 'Funciona (con el defecto del total, abajo).'],
        ['Condonar recargo, No cobrar, Abono/Cerrar, Transferencia con comprobante, factura electrónica, Atleta nuevo, sugerencias', '<b>No se ejercieron</b>: sin mora, sin datos o sin addon. Descritos desde el código.'],
      ])
    );
    pgs.push(
      sub('Hallazgos en el modal y en el flujo') +
      I('Confirmado en código (17-oct): no hay endpoint ni pantalla de edición de pagos. El BFF solo expone <code>POST /charge-batches(/preview)</code>, <code>GET /charge-batches(/:id, /targets)</code>, <code>POST /charge-batches/:id/annul</code>, <code>GET/POST /payment-adjustments(/:id/revert)</code> y <code>GET /athletes/:type/:id/open-charges</code>. El Historial de Pagos no tiene acciones por fila (solo «Ver soporte»). Decisión de producto abierta: «anular pago» y «corregir pago» (<code>docs/specs/cobros-multiples.md</code> §7.4 deja pagado = definitivo).') +
      
      table(['Hallazgo', 'Dónde'], [
        ['El menú del lápiz dice «Editar estado de cuenta» aunque la bandera esté encendida (solo el menú móvil dice «Cobros y pagos»). El spec §10.1 lo llamaba «pie de la ficha»: la ficha («Ver perfil») no tiene botón.', '<code>SchoolStudentsManagementPage.tsx:1294-1308</code>'],
        ['Desde Deportistas la pantalla de resultado no trae «Ver operación» (solo Pagos pasa <code>onViewOperations</code>).', '<code>SchoolStudentsManagementPage.tsx:2678</code> vs <code>PaymentsAutomationPage.tsx:3045</code>'],
        ['El panel «Descuento general» dice «Sin efecto todavía» aun cuando cada cobro ya muestra su parte («−$2.000»).', '<code>DiscountControl.tsx</code> (texto de <code>effect</code> sin valor en el general)'],
        ['«Descuentos» del lote no baja al quitar un descuento; la operación aparece como «Un atleta» sin nombre.', '<code>OperacionesTab.tsx:49, 313-316</code> (totales vienen del BFF)'],
        ['El campo de motivo del descuento general y el selector de tipo quedan angostos («Beca» se corta, «Artículos /…»).', 'Ancho del aside (20rem) en <code>CobrosYPagosModal.tsx:652</code>'],
        ['Un cobro único («Uniforme», vence 27-oct) sale en Historial como «Cubre Octubre 2026», igual que una mensualidad.', 'Historial, columna «Concepto»'],
        ['No existe el «#TB-…» del spec.', 'Spec §10; ni frontend ni BFF'],
      ])
    );
    pgs.push(
      sub('Datos que quedaron en Escuela Pruebas (school_id ec26397b-8d08-4534-a3a8-331b757a21f8)') +
      table(['Qué', 'Detalle'], [
        ['Pago efectivo (ref. MANUAL-A)', 'Mateo Ensayo: «Mensualidad 08/2026» pasó de $180.000 a <b>$162.000 pagada</b> (descuento Convenio 10 %: $18.000), id <code>9429c203-88f5-49da-bbfd-e6d5c7a38502</code>; y «Uniforme de entrenamiento» <b>$10.000 pagado</b>, id <code>9a268134-b2dd-4356-bfdc-457fda007b4a</code> (lote <code>59fd1b3e-9186-44e4-95fe-6cdeacc93f6f</code>).'],
        ['Lote sin pago', 'Sofía Ensayo: «Seguro de accidentes — $8.000 pendiente» (lista $10.000, Beca 20 %), id <code>46835498-562f-4f65-95c5-542c4596d7a3</code>; «Torneo Relámpago — $10.000 pendiente» (Beca revertida), id <code>bad0abc2-90f0-466f-9237-d1ee24ee0bbc</code>. Lote <code>1f0a3f49-f339-45ac-848d-7f11115e5b1d</code>.'],
        ['Lote anulado', '«Cuadrangular Ensayo» $10.000 a Emilio Torres Salazar (<code>d9b6e4a3-4e06-42e4-903b-774920e0b8b0</code>) y a Valentina Salcedo Rojas (<code>66900bd2-1e1e-4d6c-ba86-2330a2d0aeb5</code>): quedaron <b>cancelled</b>. Lote <code>e5581d77-d738-47ba-845c-956b5fe41848</code>.'],
        ['Notificaciones', 'A brayan.lopez@osigu.com (acudiente de Mateo y Sofía): «Pago registrado», 2× «Nuevos cobros», 2× «Cobros anulados» (algunas duplicadas). Los acudientes de Emilio y Valentina son correos <code>@sportmaps-test.local</code>. «Avisar a las familias» siempre apagado.'],
        ['Qué no se tocó', 'Ninguna otra escuela; no se borró nada. Los dos cobros de Sofía quedan pendientes y los dos lotes de Mateo y Sofía siguen «Vigentes» en Operaciones; borrarlos o anularlos es decisión del equipo.'],
      ])
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
      <h1 class="cover-title">Cobros y pagos</h1>
      <p class="cover-sub">Cómo registrar lo que una familia pagó por fuera (efectivo o transferencia), crear cobros nuevos, dar descuentos, cobrarle lo mismo a todo un equipo y corregir lo que se pueda — desde Pagos o desde Deportistas.</p>
      <div class="pills">
        <span class="pill">Panel de escuela</span>
        <span class="pill">Rol: Dueño / Administrador</span>
        <span class="pill">${isInternal ? 8 : 7} capítulos</span>
        ${isInternal ? '<span class="pill" style="border-color:#ff8833;color:#ffcf9e">Uso interno</span>' : ''}
      </div>
    </div>
    <div class="cover-footer">SportMaps © 2026 · octubre · reemplaza la guía «Registro de pagos manuales» de abril</div>
  </div></div>`;
}
const css = () => fs.readFileSync(path.join(here, 'manual.css'), 'utf8');
function html(isInternal) {
  const body = pages(isInternal);
  const total = body.length + 1;
  const foot = (n) => `<div class="footer${isInternal ? ' internal-mark' : ''}"><span>SportMaps · ${isInternal ? 'Uso interno' : 'Guía de uso'}</span><span>Página ${n} de ${total}</span></div>`;
  return `<!doctype html><html><head><meta charset="utf-8" /><title>SportMaps — Cobros y pagos (${isInternal ? 'Interno' : 'Academias'})</title><style>${css()}</style></head><body>` +
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
      if (overflow.length) console.warn(`⚠️  ${ver}: páginas que desbordan 1056px →`, JSON.stringify(overflow));
      // contenido que choca con el pie (padding inferior 76px)
      const tight = await page.evaluate(() =>
        [...document.querySelectorAll('.page')].map((el, i) => {
          const foot = el.querySelector('.footer'); if (!foot) return null;
          const fr = foot.getBoundingClientRect();
          let maxB = 0;
          for (const c of el.children) { if (c === foot) continue; maxB = Math.max(maxB, c.getBoundingClientRect().bottom); }
          return { n: i + 1, gap: Math.round(fr.top - maxB) };
        }).filter((x) => x && x.gap < 8));
      if (tight.length) console.warn(`⚠️  ${ver}: contenido pegado al pie →`, JSON.stringify(tight));
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
