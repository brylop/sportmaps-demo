// Manual «Torneos internos: inscribir atletas desde la escuela» en dos versiones
// (interno / academias), HTML + PDF, con capturas reales de ./shots/.
//   node docs/manuales/_src/torneos-inscribir-atleta/build.mjs
// Antes: capture.mjs y capture2.mjs (mismo directorio). Patrón: memoria feedback_pdf_manual_template.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../..');
const require = createRequire(path.join(repo, 'frontend', 'package.json'));
const { chromium } = require('playwright');
const SHOTS = path.join(here, 'shots');
const CROPS = path.join(SHOTS, 'crops');
const NAME = 'torneos-inscribir-atleta';
const OUT = { academias: path.join(repo, `docs/manuales/academias/${NAME}`), interno: path.join(repo, `docs/manuales/interno/${NAME}`) };
const SCALE = 2;

// Coordenadas en CSS px (viewport 1400×1000).
const CROP_DEFS = {
  'inscritos-vacio.png':  { src: 'a-05-inscritos-vacio.png',  x: 385, y: 100, w: 890, h: 340 },
  'inscritos-gratis.png': { src: 'a-10-inscritos-lista.png',  x: 385, y: 100, w: 890, h: 480 },
  'inscritos-costo.png':  { src: 'b-07-inscritos-lista.png',  x: 385, y: 100, w: 890, h: 480 },
  'categorias-gratis.png':{ src: 'a-04-categorias.png',       x: 385, y: 100, w: 890, h: 730 },
  'categorias-costo.png': { src: 'c-07-categorias-fases.png', x: 385, y: 100, w: 890, h: 690 },
  'aviso-costo.png':      { src: 'b-06-inscrito-con-cobro.png', x: 998, y: 873, w: 384, h: 109 },
  'aviso-gratis.png':     { src: 'a-07-inscrito-aviso.png',   x: 998, y: 873, w: 384, h: 109 },
  'aviso-ya.png':         { src: 'a-08-ya-inscrito.png',      x: 998, y: 900, w: 384, h: 82 },
};

async function makeCrops(browser) {
  fs.mkdirSync(CROPS, { recursive: true });
  const page = await browser.newPage();
  for (const [out, def] of Object.entries(CROP_DEFS)) {
    const src = path.join(SHOTS, def.src);
    if (!fs.existsSync(src)) throw new Error(`Falta la captura ${def.src}`);
    const b64 = fs.readFileSync(src).toString('base64');
    const cropped = await page.evaluate(async ([b64, d, s]) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = d.w * s; c.height = d.h * s;
      c.getContext('2d').drawImage(img, d.x * s, d.y * s, d.w * s, d.h * s, 0, 0, d.w * s, d.h * s);
      return c.toDataURL('image/png').split(',')[1];
    }, [b64, def, SCALE]);
    fs.writeFileSync(path.join(CROPS, out), Buffer.from(cropped, 'base64'));
  }
  await page.close();
}

function img(file, caption, width) {
  const fp = fs.existsSync(path.join(CROPS, file)) ? path.join(CROPS, file) : path.join(SHOTS, file);
  if (!fs.existsSync(fp)) throw new Error(`Falta ${file}`);
  const b64 = fs.readFileSync(fp).toString('base64');
  return `<div class="shot-wrap"><img class="shot" style="width:${width}px;max-height:none" src="data:image/png;base64,${b64}" alt="${caption}"/>` +
    (caption ? `<div class="shot-caption">${caption}</div>` : '') + `</div>`;
}
const step = (n, title, body, pic = '') => `<div class="step"><div class="step-head"><div class="step-badge">${n}</div><div class="step-title">${title}</div></div>${body}${pic}</div>`;
const p = (html, cls = '') => `<p${cls ? ` class="${cls}"` : ''}>${html}</p>`;
const warn = (tag, html) => `<div class="callout warn"><span class="tag">${tag}</span>${html}</div>`;
const tip = (tag, html) => `<div class="callout tip"><span class="tag">${tag}</span>${html}</div>`;
const internal = (html) => `<div class="callout internal"><span class="tag">🔒 Interno</span>${html}</div>`;
const chapter = (n, title, crumb, intro) =>
  `<div class="chapter-head"><div class="chapter-badge">${n}</div><h2 class="chapter-title">${title}</h2></div>` +
  `<div class="breadcrumb">${crumb}</div><hr class="chapter-rule" />${intro ? p(intro) : ''}`;

function pages(isInternal) {
  const I = (html) => (isInternal ? internal(html) : '');
  const pgs = [];

  // ── Cap. 1 ──
  pgs.push(
    chapter(1, 'Qué es y qué necesitas', 'Menú lateral → Gestión deportiva → Mis Torneos',
      'En un <b>torneo interno</b> compiten solo los equipos de tu escuela. Con <b>Inscribir atleta</b> tú mismo anotas a un deportista, sin esperar a que su familia lo haga desde la app. La inscripción queda <b>confirmada al instante</b> y la familia recibe un aviso.') +
    `<table class="tbl"><tr><th>Requisito</th><th>Detalle</th></tr>
      <tr><td><b>Módulo de Torneos activo</b></td><td>Sin él, «Crear torneo» muestra «Módulo de Torneos no activo». Se activa desde Mi Plan.</td></tr>
      <tr><td><b>Ser owner o administrador</b></td><td>El entrenador no puede inscribir: es una decisión de la administración.</td></tr>
      <tr><td><b>Torneo interno y publicado</b></td><td>El botón está apagado mientras el torneo es borrador. En torneos externos (contra otras academias) se usa otro flujo, por delegaciones.</td></tr>
      <tr><td><b>Al menos una categoría</b></td><td>El deportista se inscribe <b>en una categoría</b> del torneo.</td></tr>
      <tr><td><b>Deportistas activos de tu escuela</b></td><td>Solo aparecen los hijos/deportistas activos registrados en tu escuela.</td></tr></table>` +
    tip('Gratis o con costo', 'Cuando creas el torneo eliges si <b>tiene costo o es gratis</b>. Si es gratis, inscribir no genera ningún cobro. Si tiene costo, cada inscripción crea un cobro pendiente al acudiente.') +
    I('Alcance: el atleta tiene que ser un <b>hijo</b> (<code>children</code>); los adultos sin hijo no aparecen. El gate de la RPC es <code>user_admin_school_ids()</code> (sin coaches). Besser: addon <code>tournaments</code> regalado como cortesía el 2026-10-20 (<code>metadata.via = cortesia_besser_2026_10_20</code>, precio 0); sin él, <code>has_tournaments</code> es false y el BFF devuelve 403.')
  );

  // ── Cap. 2 ──
  pgs.push(
    chapter(2, 'Preparar el torneo', 'Mis Torneos → Crear torneo', 'El modal solo funciona si el torneo ya está publicado. Estos son los pasos previos.') +
    step(1, 'Crear el torneo y elegir «Interno»',
      p('En <b>Alcance</b> elige <b>Interno (mis propios equipos)</b>. La visibilidad pasa sola a <b>Solo mi escuela</b>. Aparece el bloque <b>Cobro de la inscripción</b>.'),
      img('c-02-tipo-interno.png', 'Tipo de torneo: alcance Interno, visibilidad «Solo mi escuela».', 520)) +
    step(2, 'Decidir si tiene costo',
      p('El interruptor <b>El torneo tiene costo</b> viene encendido. Si lo dejas así, marca los <b>medios de pago</b> que aceptas (solo aparecen los que ya configuraste en los datos de pago; <b>Efectivo</b> siempre está) y escribe el <b>valor de la inscripción</b>.'),
      img('c-04-cobro-con-costo.png', 'Torneo con costo: medios de pago y valor de la inscripción.', 460))
  );
  pgs.push(
    step(3, 'Si es gratis, apaga el interruptor',
      p('Al apagarlo desaparecen los medios de pago y el valor: no se pide nada de eso y la inscripción nunca generará cobro.'),
      img('c-05-cobro-gratis.png', 'Torneo gratis: sin medios de pago ni valor.', 460)) +
    step(4, 'Completar la información y crear',
      p('Título, deporte, fecha, <b>cierre de inscripciones</b> (opcional), hora de inicio, dirección y ciudad son lo mínimo. Se crea como <b>borrador</b>.', 'no-shot')) +
    warn('El valor vive hasta el cierre', 'La tarifa queda vigente <b>hasta el cierre de inscripciones</b> (o hasta la fecha del torneo si no pusiste cierre). Pasada esa fecha, <b>ya no se puede inscribir en un torneo con costo</b> hasta que alargues la fecha de la tarifa en «Categorías y Precios».')
  );
  pgs.push(
    step(5, 'Agregar la categoría y publicar',
      p('En <b>Categorías y Precios</b> pulsa <b>Agregar</b>, escribe el nombre (por ejemplo «Sub 12») y guarda. Un torneo gratis no necesita precio; uno con costo ya trae su fase de precio. Luego pulsa <b>Publicar</b>.'),
      img('categorias-gratis.png', 'Torneo gratis en borrador: una categoría y el botón Publicar. La franja amarilla avisa qué falta.', 440)) +
    p('Con costo, la pestaña muestra además la <b>fase de precio</b> (nombre, fecha límite, valor):', 'no-shot') +
    img('categorias-costo.png', 'Torneo con costo: categoría y fase de precio «Inscripción» de $50.000 vigente hasta el cierre.', 400)
  );

  // ── Cap. 3 ──
  pgs.push(
    chapter(3, 'El modal «Inscribir atleta», paso a paso', 'Mis Torneos → (tu torneo) → pestaña Inscritos → Inscribir atleta', '') +
    step(1, 'Abrir el modal',
      p('Entra al torneo y abre la pestaña <b>Inscritos</b>. Arriba a la derecha está el botón verde <b>Inscribir atleta</b>. Si el torneo sigue en borrador el botón está apagado y la pantalla dice «Publica el torneo para poder inscribir atletas».'),
      img('inscritos-vacio.png', 'Pestaña Inscritos de un torneo publicado, todavía sin inscritos.', 400)) +
    step(2, 'Leer el encabezado del modal',
      p('Te recuerda lo que va a pasar. En un torneo <b>gratis</b> dice «El torneo es gratis: no se cobra». En uno <b>con costo</b> dice «Se crea el cobro al acudiente».'),
      img('a-06-modal.png', 'Modal de un torneo gratis: categoría, buscador y lista de deportistas.', 290))
  );
  pgs.push(
    step(3, 'Elegir la categoría',
      p('Por defecto viene la primera categoría del torneo. Si hay varias, cámbiala antes de inscribir: <b>cada clic en «Inscribir» usa la categoría que esté elegida en ese momento</b>.', 'no-shot')) +
    step(4, 'Buscar al deportista',
      p('Escribe parte del nombre en <b>Buscar atleta</b>; no importan las tildes ni las mayúsculas. Se muestran hasta 50 coincidencias. Si no hay ninguna, el modal dice «No hay atletas que coincidan».'),
      img('a-09-sin-resultados.png', 'Búsqueda sin coincidencias.', 400)) +
    I('Se leen los primeros 500 deportistas activos de la escuela y se filtra en el navegador. Si la escuela tiene 500 o más, la lista queda «truncada» y el modal pide escribir al menos 2 letras: ahí la búsqueda va al servidor (<code>ilike</code>, 50 filas).')
  );
  pgs.push(
    step(5, 'Pulsar «Inscribir»',
      p('El botón de esa fila dice «Inscribiendo…» unos instantes y aparece un aviso abajo a la derecha. El modal <b>se queda abierto</b> para que inscribas a varios deportistas seguidos; ciérralo con la <b>X</b> cuando termines.'),
      img('aviso-gratis.png', 'Torneo gratis: «quedó inscrito. Se le avisó a la familia».', 380) +
      img('aviso-costo.png', 'Torneo con costo: además «se creó el cobro al acudiente».', 380)) +
    step(6, 'Si ya estaba inscrito',
      p('Inscribir de nuevo al mismo deportista en la misma categoría <b>no duplica nada</b>: aparece «Ya estaba inscrito» y no se le vuelve a avisar a la familia ni se crea otro cobro.'),
      img('aviso-ya.png', 'Aviso al repetir la inscripción.', 380)) +
    warn('El modal no marca a los ya inscritos', 'Quien ya está inscrito sigue apareciendo con el botón «Inscribir» activo. Para ver quién ya está, mira la pestaña <b>Inscritos</b> detrás del modal. Repetir es inofensivo, pero conviene revisar antes.')
  );
  pgs.push(
    step(7, 'Deportista sin acudiente en un torneo con costo',
      p('Un cobro necesita a quién cobrarle. Si el deportista <b>no tiene acudiente</b> asignado y el torneo tiene costo, su botón queda <b>apagado</b> y aparece la etiqueta ámbar <b>«Sin acudiente: asígnalo primero»</b>. Asígnale el acudiente desde su ficha en Deportistas y vuelve a abrir el modal. En un torneo <b>gratis</b> no hace falta acudiente.', 'no-shot')) +
    step(8, 'Revisar el resultado en la pestaña Inscritos',
      p('Cada inscrito aparece bajo su categoría, en «Sin equipo», con una etiqueta de pago: <b>Sin cobro</b> (torneo gratis), <b>Pendiente</b> (cobro creado, sin pagar) o <b>Pagado</b>.'),
      img('inscritos-gratis.png', 'Torneo gratis: el inscrito queda «Sin cobro».', 520) +
      img('inscritos-costo.png', 'Torneo con costo: el inscrito queda «Pendiente» de pago.', 520))
  );

  // ── Cap. 4 ──
  pgs.push(
    chapter(4, 'Qué pasa después', 'Inscritos · Pagos · Familia', '') +
    `<table class="tbl"><tr><th>Quién</th><th>Qué ocurre</th></tr>
      <tr><td><b>La inscripción</b></td><td>Queda <b>aprobada</b> de inmediato. No necesita que nadie la revise.</td></tr>
      <tr><td><b>La familia</b></td><td>Recibe el aviso «🏆 Inscribieron a tu deportista en un torneo» con el nombre del torneo. En un torneo con costo, el aviso añade «Tienes un cobro pendiente en Mis pagos» y el mensaje la lleva a la pantalla del torneo.</td></tr>
      <tr><td><b>El cobro</b></td><td>Solo si el torneo tiene costo: «Inscripción torneo — (nombre) — (categoría)» por el valor vigente, <b>pendiente</b>, a nombre del acudiente. Vence unos días después de inscribir.</td></tr>
      <tr><td><b>Pago en efectivo</b></td><td>Si el único medio del torneo es «Efectivo», la app no registra el pago sola: cuando la familia pague en la escuela, regístralo en <b>Pagos</b>.</td></tr>
      <tr><td><b>Armar equipos</b></td><td>En «Sin equipo», marca a los inscritos, escribe el nombre del equipo y pulsa <b>Crear equipo</b>. Con los equipos armados se genera el calendario en la pestaña Resultados.</td></tr></table>` +
    tip('Plazo cerrado', 'La escuela <b>sí puede inscribir con el plazo de inscripciones vencido</b>. La excepción: en un torneo con costo, si la tarifa ya venció, hay que extender su fecha primero (ver «Si algo falla»).') +
    I('Aviso por <code>notifyProfiles([parent_id])</code> solo cuando <code>already_registered = false</code> y hay <code>parent_id</code>. El cobro se inserta en <code>payments</code> con <code>payment_type = one_time</code>, <code>period_uniqueness_exempt = true</code>, vencimiento <code>qr_first_charge_due_date(school, hoy)</code> (hoy +5 días en la prueba) y <b><code>payment_category</code> en NULL</b>: no estampa categoría (ver memoria <code>project_payment_creation_paths_census</code>); revisar cómo lo agrupan los tres cálculos de ingreso. La inscripción nace con <code>payment_status = pending</code> (con costo) o <code>not_required</code> (gratis).')
  );

  // ── Cap. 5 ──
  pgs.push(
    chapter(5, 'Si algo falla', 'Mensajes del modal y qué hacer', '') +
    `<table class="tbl"><tr><th>Lo que ves</th><th>Por qué</th><th>Qué hacer</th></tr>
      <tr><td>El botón <b>Inscribir atleta</b> está apagado</td><td>El torneo sigue en borrador</td><td>Agrega una categoría y pulsa <b>Publicar</b>.</td></tr>
      <tr><td>«Sin acudiente: asígnalo primero»</td><td>Torneo con costo y el deportista no tiene pagador</td><td>Asigna el acudiente en su ficha, o inscríbelo en un torneo gratis.</td></tr>
      <tr><td>«No hay una tarifa vigente configurada para este torneo todavía»</td><td>La fecha límite de la tarifa ya pasó (por ejemplo, el cierre de inscripciones)</td><td>Categorías y Precios → cambia «Válida hasta» a una fecha futura → Guardar.</td></tr>
      <tr><td>«El torneo todavía no está publicado»</td><td>Se despublicó o sigue en borrador</td><td>Publícalo.</td></tr>
      <tr><td>«El atleta está inactivo»</td><td>El deportista fue dado de baja</td><td>Reactívalo en Deportistas si debe competir.</td></tr>
      <tr><td>«No autorizado: este torneo no es de tu escuela»</td><td>Tu usuario no es administración de la escuela dueña del torneo</td><td>Entra con la cuenta del owner o de un administrador.</td></tr>
      <tr><td>«Módulo de Torneos no activo»</td><td>La escuela no tiene el módulo</td><td>Solicítalo desde Mi Plan.</td></tr>
      <tr><td>Un deportista no aparece en la lista</td><td>Está inactivo, es de otra escuela o es un adulto sin ficha de hijo</td><td>Revisa su estado y su escuela en Deportistas.</td></tr></table>` +
    I('Mensajes tal cual salen de <code>school_register_athlete_for_tournament</code>; el BFF devuelve 403 si el código es 42501 y 400 para el resto. Orden de validación: torneo → admin de la escuela → interno → publicado/cerrado → categoría activa del torneo → hijo de la escuela y activo → ya inscrito (salida con <code>already_registered</code>) → acudiente → tarifa vigente (<code>valid_until &gt;= CURRENT_DATE</code>, la más próxima) → monto &gt; 0. <b>No valida cupo (<code>capacity</code>) ni fecha de cierre</b>: la escuela puede pasarse del cupo.')
  );

  if (isInternal) {
    pgs.push(
      chapter(6, 'Estado de la prueba y huecos conocidos', 'Solo equipo SportMaps — no prometer a la escuela', '') +
      `<table class="tbl"><tr><th>Tema</th><th>Estado</th></tr>
        <tr><td>Prueba de punta a punta (2026-10-20)</td><td>Tenant <b>Club Campestre Demo</b> en dev.sportmaps.co, navegador real (Playwright): crear torneo gratis y con costo → categoría → publicar → modal → inscribir → repetir → verificación en base. 2 torneos y 2 inscripciones quedaron en el demo (<code>Copa Interna Demo 10201619</code>, <code>Copa Con Costo Demo 10201621</code>). Script: <code>docs/manuales/_src/torneos-inscribir-atleta/</code>.</td></tr>
        <tr><td>Verificado en base</td><td>Gratis: inscripción <code>approved</code>, <code>payment_status = not_required</code>, sin <code>payment_id</code>. Con costo: <code>approved</code> + pago <code>pending</code> de $50.000 con el concepto esperado y <code>parent_id</code> correcto. Repetir no duplica. Notificación a la familia creada.</td></tr>
        <tr><td>No probado en navegador</td><td>La insignia «Sin acudiente» (el demo no tiene hijos sin acudiente; Besser tiene 1 de 60) y el modal en celular. La regla está en el código y la RPC la rechaza igual.</td></tr>
        <tr><td>Lado de la familia</td><td>Verificado solo el registro de la notificación, no la pantalla de la familia.</td></tr>
        <tr><td>Besser</td><td>Addon <code>tournaments</code> activado de cortesía. 60 atletas activos, 1 sin acudiente. Medios de pago configurados: transferencia y efectivo (sin Wompi ni Nequi), así que son los únicos que verá en un torneo con costo.</td></tr>
        <tr><td>Hueco 1</td><td>El modal no marca a los ya inscritos (el botón sigue activo).</td></tr>
        <tr><td>Hueco 2</td><td>Torneo con costo con tarifa vencida: no se puede inscribir aunque la escuela pueda pasar el cierre de inscripciones. Contradice la decisión «se puede inscribir con el plazo cerrado» cuando la tarifa vence el mismo día que el cierre (que es lo que hace el formulario de creación).</td></tr>
        <tr><td>Hueco 3</td><td>No se valida cupo.</td></tr>
        <tr><td>Hueco 4</td><td><code>payment_category</code> NULL en el cobro.</td></tr>
        <tr><td>Hueco 5</td><td>Solo hijos; con «solo efectivo» la app no registra el pago.</td></tr></table>`
    );
  }
  return pgs;
}

function cover(isInternal) {
  return `<div class="page cover"><div class="cover-inner">
    <div><div class="logo"><span class="pin"></span>SportMaps</div></div>
    <div>
      <div class="cover-eyebrow"><span class="dot" style="background:${isInternal ? '#ff8833' : '#4fd17a'}"></span>${isInternal ? '🔒 Uso interno — no enviar a escuelas' : 'Guía de uso · Academias'}</div>
      <h1 class="cover-title">Inscribir atletas en un torneo interno</h1>
      <p class="cover-sub">Cómo crear un torneo de tu escuela, gratis o con costo, y usar el modal «Inscribir atleta» para anotar a tus deportistas sin esperar a las familias.</p>
      <div class="pills">
        <span class="pill">Rol: Owner / Administración</span>
        <span class="pill">${isInternal ? '6' : '5'} capítulos</span>
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
  return `<!doctype html><html><head><meta charset="utf-8" /><title>SportMaps — Inscribir atletas en un torneo interno (${isInternal ? 'Interno' : 'Academias'})</title><style>${css()}</style></head><body>` +
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
      const overflow = await page.evaluate(() => [...document.querySelectorAll('.page')].map((el, i) => ({ n: i + 1, h: el.scrollHeight })).filter((x) => x.h > 1056));
      if (overflow.length) console.warn(`⚠️  ${ver}: páginas que desbordan 1056px →`, JSON.stringify(overflow));
      await page.pdf({ path: `${base}.pdf`, width: '816px', height: '1056px', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
      const n = await page.evaluate(() => document.querySelectorAll('.page').length);
      await page.close();
      console.log(`✅ ${ver}: ${base}.pdf (${n} páginas esperadas)`);
    }
  } finally { await browser.close(); }
}
render().catch((e) => { console.error(e); process.exit(1); });
