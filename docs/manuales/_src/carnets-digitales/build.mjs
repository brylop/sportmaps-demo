// Genera el manual "Carnets digitales: cómo generarlos y cómo les llegan a las
// familias" en sus dos versiones (interno / academias) como HTML + PDF, con las
// capturas reales de ./shots/.
//
//   node docs/manuales/_src/carnets-digitales/build.mjs
//
// Antes hay que correr capture.mjs (mismo directorio) para producir ./shots/.
// Sistema visual: el de todos los manuales (memoria feedback_pdf_manual_template
// y docs/manuales/README.md). Copiado de _src/calendario-equipos-familias/.

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
  academias: path.join(repo, 'docs/manuales/academias/carnets-digitales'),
  interno: path.join(repo, 'docs/manuales/interno/carnets-digitales'),
};
// Todas las capturas se tomaron con deviceScaleFactor 2 (escritorio 1600×1000,
// celular 390×844): las coordenadas de abajo van en CSS px.
const SCALE = 2;

const CROP_DEFS = {
  'c-menu.png':             { src: '04-emitir-lista.png',        x: 10,  y: 620, w: 240,  h: 200 },
  'c-plantilla-lista.png':  { src: '03-plantilla-creada.png',    x: 300, y: 190, w: 875,  h: 200 },
  'c-plantilla-editor.png': { src: '02-plantilla-editor.png',    x: 300, y: 60,  w: 875,  h: 900 },
  'c-emitir-lista.png':     { src: '04-emitir-lista.png',        x: 300, y: 110, w: 1255, h: 700 },
  'c-filtro.png':           { src: '05-filtro-equipo.png',       x: 880, y: 300, w: 570,  h: 450 },
  'c-dialogo-emitir.png':   { src: '06-dialogo-emitir.png',      x: 544, y: 314, w: 512,  h: 372 },
  'c-plantilla-select.png': { src: '06b-plantilla-select.png',   x: 544, y: 304, w: 512,  h: 392 },
  'c-frente-dialogo.png':   { src: '07-preview-frente.png',      x: 576, y: 120, w: 448,  h: 762 },
  'c-frente.png':           { src: '07-preview-frente.png',      x: 646, y: 206, w: 340,  h: 540 },
  'c-reverso.png':          { src: '08-preview-reverso.png',     x: 646, y: 206, w: 340,  h: 540 },
  'c-lote.png':             { src: '09-lote-seleccion.png',      x: 300, y: 240, w: 1255, h: 640 },
  'c-emitidos.png':         { src: '12-pdf-equipo.png',          x: 300, y: 240, w: 1290, h: 760 },
  'c-enviar.png':           { src: '13-enviar-al-padre.png',     x: 576, y: 120, w: 448,  h: 762 },
  'c-whatsapp.png':         { src: '14-whatsapp-compartir.png',  x: 400, y: 80,  w: 800,  h: 460 },
  'c-padre-lista.png':      { src: '20-padre-mis-carnets.png',   x: 300, y: 100, w: 1255, h: 460 },
  'c-padre-preview.png':    { src: '21-padre-preview.png',       x: 576, y: 136, w: 448,  h: 728 },
  'c-padre-movil.png':      { src: '22-padre-movil-carnets.png', x: 0,   y: 0,   w: 390,  h: 560 },
  'c-staff-panel.png':      { src: '42-coach-publico-staff.png', x: 0,   y: 540, w: 390,  h: 500 },
  'c-coach-asist.png':      { src: '40-coach-asistencias.png',   x: 280, y: 70,  w: 1320, h: 270 },
  'c-coach-scan.png':       { src: '41-coach-scan.png',          x: 280, y: 70,  w: 1320, h: 350 },
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
function src64(file) {
  const fp = fs.existsSync(path.join(CROPS, file)) ? path.join(CROPS, file) : path.join(SHOTS, file);
  if (!fs.existsSync(fp)) throw new Error(`Falta ${file}`);
  return 'data:image/png;base64,' + fs.readFileSync(fp).toString('base64');
}
function img(file, caption, style) {
  return `<div class="shot-wrap"><img class="shot" style="${style}" src="${src64(file)}" alt="${caption}"/>` +
    (caption ? `<div class="shot-caption">${caption}</div>` : '') + `</div>`;
}
const full = (file, caption, maxH = 300) => img(file, caption, `max-height:${maxH}px`);
const crop = (file, caption, width) => img(file, caption, `width:${width}px;max-height:none`);
/** Dos capturas lado a lado (frente/reverso, celular), cada una con su alto máximo. */
const pair = (a, capA, b, capB, maxH = 420) =>
  `<div class="pair"><div>${full(a, capA, maxH)}</div><div>${full(b, capB, maxH)}</div></div>`;

const step = (n, title, body, pic = '') =>
  `<div class="step"><div class="step-head"><div class="step-badge">${n}</div><div class="step-title">${title}</div></div>${body}${pic}</div>`;
const p = (html, cls = '') => `<p${cls ? ` class="${cls}"` : ''}>${html}</p>`;
const warn = (tag, html) => `<div class="callout warn"><span class="tag">${tag}</span>${html}</div>`;
const tip = (tag, html) => `<div class="callout tip"><span class="tag">${tag}</span>${html}</div>`;
const internal = (html) => `<div class="callout internal"><span class="tag">🔒 Interno</span>${html}</div>`;
const chapter = (n, title, crumb, intro) =>
  `<div class="chapter-head"><div class="chapter-badge">${n}</div><h2 class="chapter-title">${title}</h2></div>` +
  `<div class="breadcrumb">${crumb}</div><hr class="chapter-rule" />${intro ? p(intro) : ''}`;

// ── Contenido: cada entrada del array es UNA página ───────────────────────
function pages(isInternal) {
  const I = (html) => (isInternal ? internal(html) : '');
  const pgs = [];

  // ── Cap. 1 — Dónde está ──
  pgs.push(
    chapter(1, 'Dónde están los carnets', 'Menú lateral → Documentos e Identidad → Carnets',
      'Cada deportista puede tener un <b>carnet digital</b> con la marca de la escuela, su foto, su equipo y un <b>código QR</b>. Quien escanea el QR ve el carnet en línea y sabe al instante si está <b>vigente</b>, <b>vencido</b> o <b>revocado</b>. Lo administra el owner o un admin de la escuela.') +
    step(1, 'Abrir Carnets en el menú',
      `<div class="side"><div>${p('En el grupo <b>Documentos e Identidad</b>, el menú <b>Carnets</b> tiene dos entradas: <b>Carnets Digitales</b> (emitir y administrar) y <b>Plantillas de Carnets</b> (el diseño). Las dos llevan a la misma pantalla, cada una en su pestaña.')}</div>` +
      `<div>${crop('c-menu.png', 'Menú lateral del owner.', 200)}</div></div>`) +
    step(2, 'Las tres pestañas de la pantalla',
      `<table class="tbl"><tr><th>Pestaña</th><th>Para qué sirve</th></tr>
        <tr><td><b>Emitir nuevo</b></td><td>Deportistas con el estado de su carnet, filtros por equipo y sede, emisión uno por uno o en lote.</td></tr>
        <tr><td><b>Carnets emitidos</b></td><td>Los carnets que ya salieron: ver, enviar a la familia, revocar y PDF por equipo.</td></tr>
        <tr><td><b>Plantillas</b></td><td>El diseño: colores, disposición, datos visibles y plantilla predeterminada.</td></tr></table>`) +
    tip('Orden recomendado', 'Primero la <b>plantilla</b> (una vez), luego la <b>emisión</b> (por equipo es lo más rápido) y al final el <b>envío</b> a las familias.') +
    I('Ruta <code>/cards</code> tras el módulo <code>documentos_carnets</code>; tablas <code>athlete_id_card_templates</code> + <code>athlete_id_cards</code>. El listado usa <code>list_school_athletes_for_card_issue_v2</code>; la v1 sigue viva en la base sin llamadores.')
  );

  // ── Cap. 2 — Plantilla ──
  pgs.push(
    chapter(2, 'Diseñar la plantilla del carnet', 'Carnets → pestaña Plantillas',
      'La plantilla define cómo se ve el carnet. Se arma una vez y sirve para todos. Si la escuela no crea ninguna, los carnets salen con el diseño básico de SportMaps.') +
    step(1, 'Crear la plantilla',
      p('En <b>Plantillas de la escuela</b> pulsa <b>Nueva</b>. Arriba del editor hay cinco combinaciones listas (<b>Federación</b>, <b>Club moderno</b>, <b>Sobrio</b>, <b>Alto impacto</b>, <b>Energía</b>) que aplican colores, disposición y textura de un solo clic; después se ajusta lo que haga falta. Al guardar, la plantilla aparece en la lista con la etiqueta <b>Predeterminada</b> si se marcó así.'),
      crop('c-plantilla-lista.png', 'La plantilla "Carnet 2026" creada y marcada como predeterminada.', 640)) +
    step(2, 'Qué se puede ajustar',
      `<table class="tbl"><tr><th>Ajuste</th><th>Opciones</th></tr>
        <tr><td><b>Disposición</b></td><td>Clásico, Moderno, Minimal (gasta poca tinta al imprimir), Foto (retrato a sangre) y Franja.</td></tr>
        <tr><td><b>Colores</b></td><td>Color principal y segundo color. Si el segundo se deja vacío, se calcula un tono oscuro del principal.</td></tr>
        <tr><td><b>Encabezado y pie</b></td><td>Texto superior (ej. "Carnet deportivo 2026") y una nota legal opcional para el reverso.</td></tr>
        <tr><td><b>Acabados</b></td><td>Textura (diagonales, puntos, cuadrícula, ondas), forma de la foto y color del texto (automático, claro u oscuro).</td></tr>
        <tr><td><b>Imagen de fondo</b></td><td>Opcional, por ejemplo una foto de la cancha; va detrás de un velo de color para que el texto se lea.</td></tr></table>`)
  );
  pgs.push(
    step(3, 'Elegir qué datos lleva el carnet',
      p('En <b>Campos visibles en el carnet</b> se prenden o apagan: foto, documento, equipo, sede, vigencia, estado de cuota, RH, EPS, talla y contacto de emergencia. <b>Lo que se apaga aquí tampoco se muestra al escanear el QR.</b> Marca <b>Predeterminada</b> y <b>Activa</b> y pulsa <b>Crear plantilla</b>.'),
      crop('c-plantilla-editor.png', 'Editor de plantilla: disposición, colores, acabados y campos visibles.', 560)) +
    I('La vista previa en vivo del editor usa datos de ejemplo fijos en el código (<code>CardTemplatesManager.tsx</code>): "Abril Samudio Vera · Coliseo Dynasty · Minivolley Benjamines". Es el nombre de la sede de un cliente real y se le muestra a todas las escuelas: cambiarlo por datos genéricos. Por eso esta guía no muestra esa vista previa. Hasta hoy había <b>0 plantillas en toda la base</b>: todos los carnets reales (Dynasty incluido) salieron con el diseño básico.')
  );
  pgs.push(
    warn('Importante al emitir', 'Al emitir, en el campo <b>Plantilla</b> elige tu plantilla <b>por su nombre</b> (la predeterminada aparece con una ★). La opción "Predeterminada de la escuela" deja el carnet con el diseño básico de SportMaps.') +
    I('<b>Bug confirmado en la base viva:</b> con "Predeterminada de la escuela" el cliente manda <code>p_template_id = null</code> y <code>issue_athlete_id_card</code> <b>no busca</b> la plantilla <code>is_default</code> (su código no menciona <code>is_default</code>); <code>verify_athlete_id_card_public</code> tampoco. Resultado: <code>template_id</code> NULL y el carnet sale con el diseño por defecto, aunque la escuela tenga una predeterminada. Lo comprobé emitiendo a Tomás Herrera (Club Campestre Demo): v1 sin plantilla con la opción por defecto; v2 con "Carnet 2026 ★" elegida a mano. Fix: que la RPC haga <code>COALESCE(p_template_id, (select id … where is_default and active))</code>, o que el frontend mande el id de la predeterminada.') +
    step(4, 'Editar o cambiar la plantilla después',
      p('Con <b>Editar</b> se cambia la plantilla; con el ícono de la papelera se elimina. Los carnets ya emitidos con esa plantilla toman el diseño nuevo la próxima vez que alguien los abra, porque el carnet se dibuja en línea. Solo puede haber <b>una predeterminada</b> por escuela: al marcar otra, la anterior deja de serlo.', 'no-shot'))
  );

  // ── Cap. 3 — Emitir uno ──
  pgs.push(
    chapter(3, 'Emitir el carnet de un deportista', 'Carnets → pestaña Emitir nuevo',
      'La lista muestra todos los deportistas de la escuela —menores, adultos y fichas sin cuenta— con el estado de su carnet. Arriba a la derecha, la <b>cobertura</b> dice cuántos tienen carnet vigente sobre el total.') +
    step(1, 'Buscar al deportista',
      p('Escribe el nombre o el documento en el buscador, o filtra por <b>equipo</b> y <b>sede</b>. Las tres tarjetas (<b>Todos</b>, <b>Con carnet</b>, <b>Sin carnet</b>) también filtran la lista al pulsarlas.'),
      crop('c-emitir-lista.png', 'Emitir nuevo: cobertura, filtros, tarjetas de estado y lista de deportistas.', 696))
  );
  pgs.push(
    step(2, 'Pulsar "Emitir" en la fila',
      p('Se abre <b>Emitir carnet</b> con el resumen del deportista (menor o adulto, documento, equipo y sede), la <b>plantilla</b> y la fecha de <b>vencimiento</b>, que por defecto es un año.'),
      crop('c-dialogo-emitir.png', 'Diálogo de emisión individual.', 420)) +
    step(3, 'Elegir la plantilla y la fecha de vencimiento',
      p('Abre <b>Plantilla</b> y elige la tuya por su nombre (la ★ marca la predeterminada). Ajusta <b>Vence el</b> si el carnet debe durar menos, por ejemplo hasta fin de temporada. Pulsa <b>Emitir</b>.'),
      crop('c-plantilla-select.png', 'La plantilla de la escuela se elige por nombre.', 420))
  );
  pgs.push(
    step(4, 'Revisar el carnet: frente y reverso',
      p('Al emitir se abre la <b>vista previa</b>. El frente lleva la marca de la escuela, la foto, el nombre, la sede, el equipo, el estado de la cuota y el QR. Con <b>Ver reverso</b> se ve la cara de emergencia: contacto, EPS, RH y talla (según los campos que active la plantilla), el QR y la nota legal.'),
      pair('c-frente.png', 'Frente: plantilla "Carnet 2026".', 'c-reverso.png', 'Reverso: datos de emergencia y QR.', 380)) +
    step(5, 'Emitir, renovar o reemitir',
      `<table class="tbl"><tr><th>El botón de la fila dice</th><th>Qué pasa</th></tr>
        <tr><td><b>Emitir</b></td><td>El deportista no tiene carnet: se crea la versión 1.</td></tr>
        <tr><td><b>Renovar</b></td><td>El carnet venció: se reemplaza por una versión nueva con nueva fecha.</td></tr>
        <tr><td><b>Reemitir</b></td><td>Tiene uno vigente: el anterior queda <b>revocado</b> y sale una versión nueva (útil si se perdió o cambió la foto o el equipo). El QR viejo deja de servir.</td></tr></table>`) +
    I('El motivo que guarda la reemisión es fijo y en inglés: la tarjeta revocada muestra <b>"Replaced by new issuance"</b> en la vista del papá y en la página pública. Traducirlo en la RPC. Los atletas "Sin cuenta" (<code>unregistered_athletes</code>) sí son emitibles desde la mig <code>20260902113317</code>.')
  );

  // ── Cap. 4 — Lote ──
  pgs.push(
    chapter(4, 'Emitir los carnets de un equipo completo', 'Emitir nuevo → filtro de equipo → Emitir seleccionados',
      'Para no ir fila por fila: se filtra el equipo, se seleccionan todos los que no tienen carnet y se emiten de una vez.') +
    step(1, 'Filtrar el equipo',
      p('En <b>Todos los equipos</b> elige la categoría. Si la escuela tiene varias sedes, también se puede filtrar por <b>sede</b>.'),
      crop('c-filtro.png', 'El filtro de equipo con las categorías de la escuela.', 430)) +
    step(2, 'Seleccionar los que no tienen carnet',
      p('Pulsa la tarjeta <b>Sin carnet</b> y luego <b>Seleccionar esta página</b> (o <b>Seleccionar los N sin carnet</b>, que recorre todas las páginas). Los que ya tienen carnet vigente no se pueden marcar.', 'no-shot'))
  );
  pgs.push(
    step(3, 'Emitir seleccionados',
      p('Revisa la fecha de <b>Vence</b> en la barra verde y pulsa <b>Emitir seleccionados (N)</b>. El botón muestra el avance ("Emitiendo 2/3…") y al terminar aparece el resumen <b>"Emitidos N carnet(s)"</b>. Si alguno falla, el aviso lo dice y basta con volver a intentarlo.'),
      crop('c-lote.png', 'Fútbol — Sub-15: tres deportistas sin carnet seleccionados para emitir en lote.', 696)) +
    warn('Plantilla en la emisión en lote', 'La emisión en lote no tiene selector de plantilla: los carnets salen con el diseño básico de SportMaps. Si quieres tu plantilla en un carnet emitido así, usa <b>Reemitir</b> en su fila y elige la plantilla por nombre.') +
    I('El lote es un <code>for</code> en el navegador que llama <code>issue_athlete_id_card</code> uno por uno (no es una RPC transaccional; si se cierra la pestaña a mitad queda a medias, aunque cada carnet es independiente). Usa el estado <code>issueTemplate</code> que comparte con el diálogo individual: si antes se eligió una plantilla en ese diálogo, el lote la hereda sin que la pantalla lo muestre. Propuesta: selector de plantilla en la barra del lote. <b>Adopción real:</b> Dynasty emitió <b>494 carnets en un solo lote</b> el 2026-09-02 (Milena Barrera, usuaria de la escuela); hoy 497 en Dynasty, 6 en MMA Blair y 1 en Spirit.')
  );

  // ── Cap. 5 — Emitidos / PDF / revocar ──
  pgs.push(
    chapter(5, 'Carnets emitidos: imprimir por equipo y revocar', 'Carnets → pestaña Carnets emitidos',
      'Aquí están todos los carnets que ya salieron, con su fecha de emisión, vencimiento, versión y estado. Las tarjetas de arriba filtran por <b>Vigentes</b>, <b>Revocados</b> y <b>Vencidos</b>.') +
    step(1, 'Descargar el PDF de un equipo para imprimir',
      p('Elige el equipo en el selector de la derecha y pulsa <b>Descargar PDF</b>. Sale un archivo A4 con los carnets vigentes de ese equipo, <b>nueve por hoja</b>, en tamaño tarjeta (CR80, el de una tarjeta bancaria), listo para imprimir, recortar y plastificar. Con "Todos los equipos" salen todos.'),
      crop('c-emitidos.png', 'Carnets emitidos: botones Ver / Enviar / Revocar por fila y el aviso "PDF generado".', 696))
  );
  pgs.push(
    I('<b>Calidad del PDF:</b> en el PDF generado durante la captura (headless Chromium) las <b>fotos salieron en blanco</b> y el nombre de la escuela y los valores de sede/equipo quedaron <b>cortados en la línea base</b> (html2canvas). Verificar en un navegador real antes de recomendar la impresión masiva; si se reproduce, es CORS de las fotos y el recorte de <code>line-height</code> de html2canvas. Además: el selector de equipo del PDF sale <b>vacío</b> si se entra directo a <code>/cards?tab=cards</code> (la lista de equipos solo se carga en la pestaña "Emitir nuevo"), y el filtro compara por <code>team_name</code>, no por id. ' + `<span style="display:block;margin-top:8px">${full('pdf-zoom-1.png', 'Detalle del PDF de Fútbol — Sub-15 generado en la captura.', 200)}</span>`) +
    step(2, 'Ver un carnet',
      p('<b>Ver</b> abre la misma vista previa de la emisión, con frente, reverso, <b>Abrir</b> (la página pública del QR), <b>Enviar al padre</b> y <b>Descargar PNG</b> (una imagen del carnet).', 'no-shot')) +
    step(3, 'Revocar un carnet perdido o mal emitido',
      p('<b>Revocar</b> pide un motivo opcional (ej. "reportado como perdido") y deja el carnet inválido: al escanear su QR aparece <b>"Carnet revocado"</b>. No se puede deshacer; para darle uno nuevo, se emite otra vez desde <b>Emitir nuevo</b>.', 'no-shot')) +
    tip('Vencidos', 'Un carnet vence solo en su fecha de <b>Vence</b>: pasa a la tarjeta <b>Vencidos</b> y al escanearlo se ve como vencido. Para renovarlo, en <b>Emitir nuevo</b> su botón dice <b>Renovar</b>.')
  );

  // ── Cap. 6 — Cómo le llega a la familia ──
  pgs.push(
    chapter(6, 'Cómo le llega el carnet a la familia', 'Cuatro caminos, se pueden combinar',
      'El carnet no es un archivo que haya que mandar: vive en línea. Por eso hay varias formas de que la familia lo tenga, y todas muestran el mismo carnet actualizado.') +
    `<table class="tbl"><tr><th>Camino</th><th>Cómo funciona</th><th>Cuándo usarlo</th></tr>
      <tr><td><b>1. En la app de la familia</b></td><td>Apenas se emite, aparece en <b>Carnets de mis hijos</b> de la cuenta del acudiente. No hay que hacer nada más.</td><td>Familias que ya usan SportMaps con su cuenta.</td></tr>
      <tr><td><b>2. Enlace por WhatsApp</b></td><td>Botón <b>Enviar</b> / <b>Enviar al padre</b>: arma un mensaje con el enlace del carnet para mandarlo por WhatsApp.</td><td>Familias sin cuenta, o para avisar que el carnet ya está.</td></tr>
      <tr><td><b>3. Impreso</b></td><td><b>Descargar PDF</b> por equipo (capítulo 5), para imprimir y plastificar.</td><td>Escuelas que entregan carnet físico.</td></tr>
      <tr><td><b>4. Imagen</b></td><td><b>Descargar PNG</b>: una imagen del carnet que se puede mandar por cualquier canal.</td><td>Cuando se pide "mándamelo en foto".</td></tr></table>` +
    tip('Avisar a las familias', 'Cuando emites, el carnet queda de inmediato en la app de cada familia con cuenta. Para que se enteren, avísales: con el botón <b>Enviar</b> de cada carnet, o con un mensaje general por tu canal habitual ("ya está el carnet de tu hijo en SportMaps, menú Carnets de mis hijos").') +
    I('<b>Hoy no existe ningún envío automático.</b> Verificado: en la base, <code>athlete_id_cards</code> solo tiene los triggers <code>trg_athlete_id_cards_touch</code> y <code>trg_audit_athlete_id_cards</code>; ninguna función que toca carnets notifica; el BFF no tiene ruta ni job de carnets (solo <code>checkin-by-card</code>), y el bot de WhatsApp no tiene intención de carnet (la palabra solo aparece en el detector de escalaciones). Ni push, ni correo, ni WhatsApp al emitir. Candidato natural para el despachador unificado de notificaciones; ya estaba en el pendiente "envío por email".')
  );
  pgs.push(
    step(1, 'Enviar al padre por WhatsApp',
      p('En <b>Carnets emitidos</b> pulsa <b>Enviar</b> en la fila, o <b>Enviar al padre</b> en la vista previa. Desde el celular se abre el menú de compartir del teléfono; desde el computador se abre WhatsApp con el mensaje ya escrito: <i>"Carnet deportivo de [nombre] — valida y consúltalo aquí: [enlace]"</i>.'),
      crop('c-enviar.png', 'Vista previa con el botón "Enviar al padre".', 330)) +
    I('<code>shareCard()</code> usa <code>navigator.share</code> si existe; si no, <code>wa.me/?text=…</code> <b>sin número</b>: el admin elige el contacto a mano, uno por uno. No hay envío masivo ni se precarga el teléfono del acudiente (que sí está en la ficha).')
  );
  pgs.push(
    step(2, 'Elegir el chat de la familia',
      p('WhatsApp muestra el mensaje con el enlace. Pulsa <b>Abrir aplicación</b> o <b>Continuar en WhatsApp Web</b> y elige el chat del acudiente. El mensaje sale desde tu WhatsApp, no desde SportMaps.'),
      crop('c-whatsapp.png', 'Pantalla de WhatsApp con el mensaje y el enlace del carnet, antes de elegir el chat.', 600)) +
    warn('El enlace es público', 'Cualquier persona que tenga el enlace (o escanee el QR) puede ver el carnet con los datos que la plantilla deja visibles. Mándalo solo a la familia y, si no quieres que se vea el contacto de emergencia o el estado de la cuota, apágalos en la plantilla.') +
    I('Privacidad: la página pública <code>/c/:token</code> muestra, sin sesión, nombre del menor, foto, sede, equipo, <b>contacto de emergencia con teléfono</b> y, con "Estado de cuota" activo (viene activo por defecto), el <b>último pago con concepto y monto</b> (en la captura: "Torneos: Torneo E2E Test x1 · $50.000"). El token es un UUID no adivinable, pero el carnet impreso lo lleva en el QR. Evaluar apagar por defecto el último pago en la vista pública.')
  );

  // ── Cap. 7 — Qué ve la familia ──
  pgs.push(
    chapter(7, 'Qué ve la familia', 'App del acudiente → Mi Actividad → Carnets de mis hijos',
      'El acudiente entra con su cuenta y abre <b>Carnets de mis hijos</b>. Ve los carnets de todos sus hijos, agrupados por escuela, con equipo, sede, vencimiento y estado.') +
    step(1, 'Abrir "Carnets de mis hijos"',
      p('En el celular, el menú se abre con el botón de la esquina superior izquierda; <b>Carnets de mis hijos</b> está en <b>Mi Actividad</b>. Un deportista adulto con cuenta propia lo encuentra como <b>Mis Carnets</b>.'),
      pair('23-padre-movil-menu.png', 'Menú del acudiente en el celular.', 'c-padre-movil.png', 'Sus carnets en el celular.', 470))
  );
  pgs.push(
    step(2, 'La lista en el computador',
      p('Cada tarjeta trae el nombre, el equipo, la sede, la fecha de vencimiento y el estado (<b>Vigente</b>, <b>Vencido</b> o <b>Revocado</b>). Si un carnet se reemitió, la versión anterior aparece como <b>Revocado</b>: la que sirve es la <b>Vigente</b>.'),
      crop('c-padre-lista.png', 'Mis carnets del papá demo: Sofía y Tomás (con su versión anterior revocada).', 696)) +
    I('<code>my_athlete_id_cards</code> devuelve también los carnets revocados y la pantalla no los separa ni los oculta: tras una reemisión el papá ve dos tarjetas iguales. Detalles de la pantalla: el título dice "Mis carnets" aunque el menú del padre dice "Carnets de mis hijos"; la vista previa del padre <b>no tiene "Ver reverso"</b>; en el celular las tarjetas se aprietan y el nombre se corta ("Tom…"). La sección depende de <code>children.parent_id</code>: un acudiente sin cuenta vinculada solo recibe el carnet por enlace.')
  );
  pgs.push(
    step(3, 'Abrir el carnet y guardarlo',
      p('Al tocar la tarjeta se abre el carnet con su QR. <b>Descargar PNG</b> lo guarda como imagen en el teléfono; <b>Abrir público</b> abre la página de validación, la misma que ve quien escanea el QR.'),
      crop('c-padre-preview.png', 'El carnet de Tomás tal como lo ve su papá.', 330))
  );
  pgs.push(
    step(4, 'La página del QR (lo que ve cualquiera que escanee)',
      p('Arriba dice <b>"Carnet verificado — Verificación oficial de [escuela]"</b>. Si el carnet fue revocado o venció, se ve en rojo. La etiqueta de cuota informa el estado de pagos del deportista:') +
      `<table class="tbl"><tr><th>Etiqueta</th><th>Significado</th></tr>
        <tr><td><b>Cuota al día</b></td><td>Los pagos están al día.</td></tr>
        <tr><td><b>Próxima a vencer</b></td><td>Se acerca la fecha del próximo pago.</td></tr>
        <tr><td><b>Cuota vencida</b></td><td>Hay un pago vencido; la página le pide a la familia ponerse al día.</td></tr></table>`,
      full('30-publico-movil.png', 'Página pública del carnet en el celular, sin iniciar sesión.', 470)) +
    I('La etiqueta y el recuadro de "último pago" salen del último pago registrado, sea del concepto que sea (en la demo, un torneo), no necesariamente de la mensualidad.')
  );

  // ── Cap. 8 — En la cancha ──
  pgs.push(
    chapter(8, 'El carnet en la cancha: asistencia con el QR', 'Coach → Asistencias → Escanear carnet',
      'El QR también sirve para tomar asistencia: el coach escanea el carnet de cada deportista al llegar y queda marcado <b>Presente</b> en la sesión de hoy, sin elegir equipo antes.') +
    step(1, 'Desde Asistencias, pulsar "Escanear carnet"',
      p('El botón está arriba a la derecha de <b>Asistencias</b>.'),
      crop('c-coach-asist.png', 'Asistencias del coach con el botón "Escanear carnet".', 696)) +
    step(2, 'Escanear uno tras otro',
      p('<b>Escanear carnet</b> abre la cámara. Después de cada lectura aparece el nombre del deportista y el resultado, y un contador de escaneados del día. Escanear dos veces el mismo carnet no lo cuenta doble.'),
      crop('c-coach-scan.png', 'Pantalla de check-in por carnet.', 696))
  );
  pgs.push(
    step(3, 'Con la cámara normal del teléfono',
      p('Si alguien del staff escanea el QR con la cámara del teléfono y ya tiene la sesión abierta en SportMaps, la página del carnet le muestra el <b>Panel de staff</b> con el botón <b>Marcar asistencia</b>. Si no ha iniciado sesión, abajo aparece <b>"¿Eres del staff de esta escuela? Iniciar sesión"</b>.'),
      full('c-staff-panel.png', 'La página del carnet vista por una entrenadora con sesión: Panel de staff.', 380)) +
    tip('Más detalle', 'La toma de asistencia completa (lista manual, carnet y torniquete) está en la guía <b>Cómo tomar asistencia</b>.') +
    I('BFF <code>POST /api/v1/attendance/checkin-by-card</code> (staff+coach, <code>x-school-id</code>), reusa <code>checkInPresenceFromEvent</code>. <code>/coach-attendance/scan</code> está permitido solo al rol <code>coach</code> en <code>routePermissions</code>. <b>Uso real: 1 solo registro <code>check_in_method=\'qr\'</code> en toda la base</b> (2026-09-03, de prueba). Nadie lo usa en campo todavía, ni siquiera Dynasty con 495 carnets vigentes.')
  );

  // ── Cap. 9 — Si algo no cuadra ──
  pgs.push(
    chapter(9, 'Si la familia no ve el carnet', 'Lista de chequeo, en orden', 'Cinco causas cubren casi todos los casos.') +
    `<table class="tbl"><tr><th>#</th><th>Revisar</th><th>Cómo se arregla</th></tr>
      <tr><td>1</td><td>En <b>Emitir nuevo</b>, el deportista dice <b>Sin carnet</b></td><td>Todavía no se emitió: pulsar <b>Emitir</b> en su fila.</td></tr>
      <tr><td>2</td><td>El acudiente entra con <b>otra cuenta</b> o el hijo no está vinculado a su cuenta</td><td>Mandarle el enlace con <b>Enviar</b>, y vincular el hijo a su cuenta para que lo vea en la app.</td></tr>
      <tr><td>3</td><td>La familia ve un carnet <b>Revocado</b></td><td>Es la versión anterior: que abra el que dice <b>Vigente</b>.</td></tr>
      <tr><td>4</td><td>Al escanear sale <b>vencido</b></td><td>Pasó la fecha de vencimiento: <b>Renovar</b> desde Emitir nuevo.</td></tr>
      <tr><td>5</td><td>El botón <b>Emitir</b> está gris</td><td>El deportista no tiene cuenta ni ficha de menor válida; completar su registro.</td></tr></table>` +
    step(1, 'El carnet salió sin los colores de la escuela',
      p('Se emitió con "Predeterminada de la escuela" o en lote. Pulsar <b>Reemitir</b> en su fila y elegir la plantilla por su nombre.', 'no-shot')) +
    step(2, 'Falta el RH, la EPS o el contacto de emergencia',
      p('Hay que activarlos en la plantilla <b>y</b> tenerlos en la ficha del deportista. Si la ficha no tiene el dato, el carnet no lo muestra.', 'no-shot'))
  );

  if (isInternal) {
    pgs.push(
      chapter(10, 'Lo que NO existe o está roto', 'Solo equipo SportMaps — no prometer a la escuela', '') +
      `<table class="tbl"><tr><th>Hueco</th><th>Estado</th><th>Nota</th></tr>
        <tr><td>Aviso automático a la familia al emitir</td><td>No existe</td><td>Ni push, ni correo, ni WhatsApp, ni bot. El papá lo descubre si entra a la app o si la escuela le manda el enlace a mano.</td></tr>
        <tr><td>Plantilla predeterminada al emitir</td><td><b>Bug</b></td><td>La RPC ignora <code>is_default</code>; "Predeterminada de la escuela" = sin plantilla. El lote siempre sale sin plantilla (o con la que quedó en el estado del diálogo).</td></tr>
        <tr><td>Envío masivo por WhatsApp</td><td>No existe</td><td><code>wa.me</code> sin número, uno por uno. No usa el teléfono del acudiente ni la línea oficial de WhatsApp de la escuela.</td></tr>
        <tr><td>Revocados en "Carnets de mis hijos"</td><td>Confuso</td><td>Se listan junto al vigente; motivo "Replaced by new issuance" en inglés.</td></tr>
        <tr><td>PDF por equipo</td><td>Revisar</td><td>Fotos en blanco y textos cortados en la captura; selector de equipo vacío entrando por <code>?tab=cards</code>.</td></tr>
        <tr><td>Datos de ejemplo del editor</td><td>Corregir</td><td>"Coliseo Dynasty" (cliente real) en la vista previa de todas las escuelas.</td></tr>
        <tr><td>Página pública</td><td>Revisar</td><td>Contacto de emergencia y último pago (concepto + monto) visibles sin sesión con la configuración por defecto.</td></tr>
        <tr><td>Check-in por QR</td><td>Sin uso</td><td>1 registro en toda la base.</td></tr>
        <tr><td>Retirar <code>list_school_athletes_for_card_issue</code> v1</td><td>Pendiente</td><td>Sin llamadores en el repo; confirmar que prod corre el frontend con v2.</td></tr></table>`
    );
    pgs.push(
      tip('Números a la fecha (2026-10-10)', 'Carnets en la base: <b>Dynasty 497</b> (494 en un solo lote el 2026-09-02, 2 revocados), <b>MMA Blair 6</b>, <b>Spirit 1</b>. Plantillas reales: <b>0</b> (la única es la de Club Campestre Demo creada para esta guía). Check-in por QR: <b>1</b>. En Club Campestre Demo quedaron de esta guía: la plantilla "Carnet 2026" y 8 carnets (Tomás Herrera v1 revocado + v2, Sofía Herrera y su categoría Natación — Infantil, y Fútbol — Sub-15).') +
      warn('Cómo se verificó', 'Código de <code>SchoolCardsAdminPage</code>, <code>CardTemplatesManager</code>, <code>AthleteIdCard</code>, <code>MyAthleteCardsPage</code>, <code>AthleteCardPublicPage</code> y <code>CoachCheckInScanPage</code>; base viva (<code>pg_trigger</code>, <code>pg_proc</code>, conteos); capturas reales con Playwright contra <code>dev.sportmaps.co</code> con el owner, el papá y la entrenadora de natación del tenant demo.')
    );
  }
  return pgs;
}

// ── Documento ─────────────────────────────────────────────────────────────
function cover(isInternal, nChapters) {
  return `<div class="page cover"><div class="cover-inner">
    <div><div class="logo"><span class="pin"></span>SportMaps</div></div>
    <div>
      <div class="cover-eyebrow"><span class="dot" style="background:${isInternal ? '#ff8833' : '#4fd17a'}"></span>${isInternal ? '🔒 Uso interno — no enviar a escuelas' : 'Guía de uso · Academias'}</div>
      <h1 class="cover-title">Carnets digitales</h1>
      <p class="cover-sub">Cómo la escuela genera los carnets de sus deportistas —uno por uno o por equipo completo— y cómo les llegan a las familias: en la app, por WhatsApp, impresos o en imagen.</p>
      <div class="pills">
        <span class="pill">Roles: Owner/Admin · Familias · Coach</span>
        <span class="pill">${nChapters} capítulos</span>
        <span class="pill">Capturas reales del producto</span>
        ${isInternal ? '<span class="pill" style="border-color:#ff8833;color:#ffcf9e">Uso interno</span>' : ''}
      </div>
    </div>
    <div class="cover-footer">SportMaps © 2026 · octubre</div>
  </div></div>`;
}

const css = () => fs.readFileSync(path.join(here, 'manual.css'), 'utf8');

function html(isInternal) {
  const body = pages(isInternal);
  const total = body.length + 1;
  const foot = (n) => `<div class="footer${isInternal ? ' internal-mark' : ''}"><span>SportMaps · ${isInternal ? 'Uso interno' : 'Guía de uso'}</span><span>Página ${n} de ${total}</span></div>`;
  return `<!doctype html><html><head><meta charset="utf-8" /><title>SportMaps — Carnets digitales (${isInternal ? 'Interno' : 'Academias'})</title><style>${css()}</style></head><body>` +
    cover(isInternal, isInternal ? 10 : 9) +
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
