// Genera el manual "Informe Mensual — entrenador" (Besser) en sus dos versiones
// (interno / academias) como HTML + PDF, con las capturas reales de ./shots/.
//
//   node docs/manuales/_src/informe-mensual/build.mjs
//
// Antes: capture.mjs (mismo directorio) y los PNG de los PDF:
//   pdftoppm -png -r 110 -f 1 -l 1 shots/09-informe-individual.pdf shots/09-pdf
//   pdftoppm -png -r 110 -f 1 -l 1 shots/11-informe-grupal-besser.pdf shots/11-pdf
// Sistema visual: el de todos los manuales (docs/manuales/README.md).

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
const NAME = 'informe-mensual-besser';
const OUT = {
  academias: path.join(repo, `docs/manuales/academias/${NAME}`),
  interno: path.join(repo, `docs/manuales/interno/${NAME}`),
};

// Capturas de la app: 1600×1000 CSS px a deviceScaleFactor 2 → s: 2.
// PNG de los PDF: px de imagen directos → s: 1.
const CROP_DEFS = {
  'c01-periodo.png':     { src: '01-informe-mensual-septiembre.png', x: 304, y: 188, w: 976, h: 176, s: 2 },
  'c02-cobertura.png':   { src: '01-informe-mensual-septiembre.png', x: 304, y: 384, w: 976, h: 364, s: 2 },
  'c03-nota.png':        { src: '02-nota-equipo.png',               x: 304, y: 612, w: 976, h: 368, s: 2 },
  'c04-toast.png':       { src: '03-publicados-toast.png',          x: 1196, y: 890, w: 388, h: 94, s: 2 },
  'c05-enviar-lista.png':{ src: '05-pagina-completa.png',           x: 304, y: 474, w: 976, h: 478, s: 2 },
  'c06-cabecera.png':    { src: '06-reportes-equipo.png',           x: 280, y: 88,  w: 1296, h: 380, s: 2 },
  'c07-resultados.png':  { src: '07-reportes-resultados.png',       x: 280, y: 540, w: 1296, h: 384, s: 2 },
  'c08-goleadores.png':  { src: '08-reportes-goleadores.png',       x: 280, y: 540, w: 1296, h: 335, s: 2 },
  'c10-grupal-sel.png':  { src: '10-informe-grupal.png',            x: 496, y: 112, w: 864, h: 192, s: 2 },
  'c09-pdf-indiv.png':   { src: '09-pdf-1.png',                     x: 60,  y: 60,  w: 790, h: 900, s: 1 },
  'c11-pdf-grupal.png':  { src: '11-pdf-1.png',                     x: 60,  y: 60,  w: 790, h: 1130, s: 1 },
};

async function makeCrops(browser) {
  fs.mkdirSync(CROPS, { recursive: true });
  const page = await browser.newPage();
  for (const [out, def] of Object.entries(CROP_DEFS)) {
    const src = path.join(SHOTS, def.src);
    if (!fs.existsSync(src)) throw new Error(`Falta la captura ${def.src}. Corre capture.mjs primero — este manual no lleva mockups.`);
    const b64 = fs.readFileSync(src).toString('base64');
    const cropped = await page.evaluate(async ([b64, d]) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const s = d.s;
      const c = document.createElement('canvas');
      c.width = d.w * s; c.height = d.h * s;
      c.getContext('2d').drawImage(img, d.x * s, d.y * s, d.w * s, d.h * s, 0, 0, d.w * s, d.h * s);
      return c.toDataURL('image/png').split(',')[1];
    }, [b64, def]);
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
const crop = (file, caption, width, maxH) => img(file, caption, `width:${width}px;max-height:${maxH ? maxH + 'px' : 'none'};object-fit:contain`);
const pdfShot = (file, caption, maxH) => img(file, caption, `max-height:${maxH}px;width:auto`);

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

  // ── Cap. 1 — Cómo funciona ──
  pgs.push(
    chapter(1, 'Cómo funciona el Informe Mensual', 'Menú lateral → Informe Mensual',
      'Cada mes, cada jugadora que tuvo <b>evaluaciones</b> recibe un informe con lo que más mejoró, su asistencia y la nota del entrenador. Hay dos informes distintos:') +
    `<table class="tbl"><tr><th>Informe</th><th>Qué trae</th><th>Quién lo ve</th></tr>
      <tr><td><b>Individual</b> (uno por jugadora)</td><td>Mejoras del mes, métricas, asistencia, goles y asistencias, y la nota del equipo</td><td>La familia, por correo y en la app, cuando tú lo envías</td></tr>
      <tr><td><b>Grupal</b> (uno por equipo)</td><td>Promedios del equipo: cansancio, esfuerzo, satisfacción, aspectos a mejorar</td><td>Solo tú y la administración del club</td></tr></table>` +
    step(1, 'El proceso del mes, en cuatro pasos',
      p('<b>1.</b> Los borradores se crean solos para cada jugadora evaluada. <b>2.</b> Tú escribes la nota de cada equipo. <b>3.</b> Publicas y revisas el PDF. <b>4.</b> Lo envías a las familias. Publicar <b>no</b> envía: entre los dos pasos tienes tiempo de revisar.', 'no-shot')) +
    step(2, 'Abrir Informe Mensual y elegir el mes',
      p('En el menú lateral, <b>Informe Mensual</b>. Arriba eliges el <b>mes</b> y el <b>año</b>. La pantalla arranca en el mes en curso: para cerrar septiembre hay que cambiarlo a <b>Septiembre</b>.'),
      crop('c01-periodo.png', 'Mes y año del informe, y el aviso de lo que te toca hacer.', 660)) +
    I('Besser quedó en «Cada entrenador, lo suyo» (<code>school_settings.reports_release_by = \'coach\'</code>, cambiado el 2026-10-02): Duvan publica y envía sus 3 equipos (Infantil, Pre Juvenil y Juvenil Femenino). Con <code>\'school\'</code> el coach solo escribe la nota y no le salen los botones Publicar/Enviar. Lo cambia la administración desde el selector «Quién publica y envía» de esta misma pantalla.')
  );

  pgs.push(
    step(3, 'Leer la tabla de cobertura',
      p('Muestra, por equipo, cuántas jugadoras hay, cuántas ya tienen nota, cuántas <b>faltan</b>, cuántas se publicaron y cuántas familias ya lo leyeron. <b>Sin medir</b> son las jugadoras sin ninguna evaluación en el mes: a ellas no se les crea informe.'),
      crop('c02-cobertura.png', 'Cobertura de septiembre: «Falta nota» en naranja es lo que queda pendiente.', 660)) +
    tip('Para que una jugadora tenga informe', 'Tiene que tener <b>al menos una evaluación</b> en el mes (post-entrenamiento, rúbrica o métricas). Si entrenó pero nadie la evaluó, aparece en «Sin medir» y no recibe informe.') +
    I('Los borradores los crea el cron diario (<code>athlete-reports.job.ts</code>, 06:10 COT, solo el MES EN CURSO) y se publican solos el <code>send_day</code> (28 por defecto) <b>si el equipo tiene nota</b>. Sin nota el cron se los salta, y al cambiar de mes ya no los vuelve a tocar: quedan para publicar a mano. Eso pasó en Besser con septiembre (32 borradores, 0 notas). «Generar borradores» solo lo ve la administración; para una jugadora evaluada tarde (después de la última pasada del cron) hay que pedírselo al admin. El 2026-10-02 se generó a mano la que faltaba en Pre Juvenil.')
  );

  // ── Cap. 2 — Nota y publicar ──
  pgs.push(
    chapter(2, 'Escribir la nota del equipo y publicar', 'Informe Mensual → Nota del equipo',
      'La nota del equipo es <b>obligatoria</b>: sin ella el informe no se puede publicar. Es un solo párrafo por equipo, que aparece en el informe de todas las jugadoras de ese equipo.') +
    step(1, 'Elegir el equipo y escribir la nota',
      p('En <b>Equipo</b> eliges la categoría. En <b>«Cómo le fue al equipo en septiembre»</b> escribes lo que trabajaron, cómo respondió el grupo y qué sigue (mínimo 20 caracteres). Pulsa <b>Guardar nota</b>.'),
      crop('c03-nota.png', 'Nota del equipo escrita, lista para guardar y publicar.', 660)) +
    warn('Al guardar, el cuadro se vacía', 'Es normal: la nota quedó guardada aunque el cuadro aparezca en blanco otra vez. Si la vuelves a escribir y guardar, reemplaza a la anterior.')
  );

  pgs.push(
    step(2, 'Publicar los informes del equipo',
      p('Con la nota guardada, pulsa <b>Publicar N informes</b> (N es la cantidad de jugadoras del equipo con informe). Sale el aviso <b>«N informes publicados»</b>. Publicar <b>congela</b> el informe: queda como foto del mes, aunque después se carguen más evaluaciones.'),
      crop('c04-toast.png', 'Confirmación al publicar.', 300)) +
    step(3, 'Repetir con cada equipo',
      p('Cambia el <b>Equipo</b> y repite: nota, guardar, publicar. En Besser son tres: <b>Infantil Femenino</b>, <b>Pre Juvenil Femenino</b> y <b>Juvenil Femenino</b>.', 'no-shot')) +
    tip('Nota individual (opcional)', 'En la lista de abajo, antes de publicar, cada jugadora tiene <b>Nota individual</b>: un comentario solo para esa familia. No es obligatoria; úsala cuando haya algo puntual que decir.') +
    I('Publicar pasa por <code>POST /school/reports/publish-team</code> → <code>publish_team_reports</code> (valida <code>reports_release_by</code> y la nota del equipo gobernante). El snapshot se arma en el BFF (<code>buildReportSnapshot</code>). Bug corregido el 2026-10-02 (<code>d7ce1457</code>): el embed <code>teams(...)</code> sobre <code>enrollments</code> era ambiguo (dos FK: <code>team_id</code> y <code>scheduling_team_id</code>, PGRST201) y el snapshot salía sin equipo ni nota del equipo. Además, en escuelas multideporte el catálogo de métricas ahora suma el deporte de los equipos del atleta.')
  );

  // ── Cap. 3 — Revisar y enviar ──
  pgs.push(
    chapter(3, 'Revisar el PDF y enviar a las familias', 'Informe Mensual → Enviar e Informes del mes',
      'Después de publicar, cada jugadora aparece como <b>publicado</b> con dos botones: <b>Ver PDF</b> y <b>Enviar</b>. Revisa antes de enviar: lo que ves en el PDF es exactamente lo que recibe la familia.') +
    step(1, 'Ver el PDF de cada jugadora',
      p('<b>Ver PDF</b> abre el informe en otra pestaña. Revisa la nota, las métricas y que el equipo sea el correcto.'),
      crop('c05-enviar-lista.png', 'Arriba, «Enviar los publicados»; abajo, cada jugadora con Ver PDF y Enviar.', 660))
  );

  pgs.push(
    step(2, 'Así se ve el informe que recibe la familia',
      p('Lleva el logo y los colores del club, el nombre del equipo, la asistencia, <b>lo mejor del mes</b>, las métricas por área (físico, técnico, táctico), goles y asistencias, y al final la nota del equipo.'),
      pdfShot('c09-pdf-indiv.png', 'Informe individual en PDF (datos de demostración).', 560))
  );

  pgs.push(
    step(3, 'Enviar',
      p('Tienes dos formas: <b>Enviar</b> en la fila de una jugadora (manda solo ese), o <b>Enviar los publicados</b> (manda todos los publicados de tus equipos que no se han enviado). La familia recibe un <b>correo con el resumen y el enlace</b> y una <b>notificación en la app</b>. Al enviar aparece un chulo verde en la fila.', 'no-shot')) +
    warn('Jugadoras sin acudiente registrado', 'El informe solo le llega a una familia que tiene <b>cuenta en la app vinculada a la jugadora</b>. Si no la tiene, la fila dice «sin acudiente» y no aparece el botón Enviar: el informe queda guardado y la familia lo verá cuando se registre. En Besser hoy 20 de 26 jugadoras con informe tienen acudiente vinculado.') +
    tip('Si te equivocaste', 'Antes de enviar, un informe publicado todavía se puede revisar. Si ya lo enviaste y hay un error, avísale a la administración del club.') +
    I('Correo: <code>report-delivery.service.ts</code> con <code>buildBrandedEmail</code> (logo y color de la escuela, «Powered by SportMaps» porque Besser NO es marca blanca) y remitente con el nombre de la escuela (<code>from_name</code>, send-email v14). Envío del coach acotado a sus equipos (<code>teamIds</code>). El destinatario es <code>children.parent_id</code>; 6 de 26 en Besser no lo tienen (y 7 duplicadas unregistered/child se unificaron el 2026-10-02, respaldo en <code>_backup_unif_besser_20261002</code>).')
  );

  // ── Cap. 4 — Grupal y Reportes ──
  pgs.push(
    chapter(4, 'Informe grupal y Reportes del equipo', 'Menú lateral → Reportes',
      'En <b>Reportes</b> ves el resumen de cada equipo: jugadoras, partidos, asistencia promedio y <b>victorias, empates y derrotas</b>. Desde ahí también se abre el <b>informe grupal del mes</b>.') +
    step(1, 'Elegir el equipo',
      p('Arriba eliges el equipo. Los totales salen de lo que registras en <b>Resultados</b> (los partidos) y en <b>Asistencias</b>. El botón <b>Informe grupal del mes</b> está arriba a la derecha.'),
      crop('c06-cabecera.png', 'Reportes del Equipo: botones arriba a la derecha y los totales del equipo.', 660)) +
    step(2, 'Resultados de partidos',
      p('Cada partido jugado aparece como <b>Victoria</b>, <b>Empate</b> o <b>Derrota</b>, con el marcador del club primero. Los partidos se cargan en <b>Resultados</b>, indicando si el club jugó de local o de visitante.'),
      crop('c07-resultados.png', 'Pestaña Resultados: cada partido con su desenlace.', 620))
  );

  pgs.push(
    step(3, 'Goleadores',
      p('La tabla sale de las métricas <b>Goles</b> y <b>Asistencias</b> que cargas en la evaluación de cada jugadora. Escribe siempre <b>lo que lleva en la temporada</b> (el acumulado), no los del último partido: el sistema toma el último valor que registraste.'),
      crop('c08-goleadores.png', 'Pestaña Goleadores: goles y asistencias acumulados por jugadora.', 620)) +
    warn('Goles por partido no', 'Si en una evaluación escribes «2» porque metió dos en el último partido, la tabla mostrará 2 aunque lleve 10 en la temporada. Siempre el total que lleva.') +
    I('<code>GET /reports/coach/:teamId</code>: antes <code>scorers</code> estaba hardcodeado en <code>[]</code> y el desenlace se leía de un campo <code>result</code> que <code>match_results</code> no tiene, así que todo salía «Programado» y V/E/D en 0 (reporte de Duvan del 2026-10-02). Ahora se deriva del marcador con <code>is_home</code> y los goleadores toman el último valor (<code>aggregation=\'latest\'</code>). Los goles de Duvan se cargaron el 02-oct: cuentan para el informe de octubre, no el de septiembre. Suman 63 en Pre Juvenil contra 42 en los 6 partidos registrados: o faltan partidos o algún acumulado está mal.')
  );

  pgs.push(
    step(4, 'Abrir el informe grupal del mes',
      p('Con <b>Informe grupal del mes</b> eliges equipo, mes y año. Muestra el agregado de las autoevaluaciones de las jugadoras y de tu evaluación: cansancio, comprensión de las tareas, esfuerzo, satisfacción y aspectos a mejorar. Se puede descargar en PDF.'),
      crop('c10-grupal-sel.png', 'Selector del informe grupal: equipo, mes y año.', 520)) +
    pdfShot('c11-pdf-grupal.png', 'Informe grupal de septiembre de Pre Juvenil Femenino (Besser).', 450) +
    I('El grupal se publica solo el <code>send_day</code> (<code>team-reports.job.ts</code>) y queda congelado: el de septiembre de Besser se cerró el 28 y no incluye las sesiones del 29 y 30 (no se puede regenerar, 409). Defecto visual conocido: en el PDF, «Esfuerzo y entrega» y «Aspectos a mejorar» salen corridos a la derecha. El botón «Informe grupal del mes» se agregó el 2026-10-02; antes la página solo se abría escribiendo la URL.')
  );

  // ── Cap. 5 — Checklist ──
  pgs.push(
    chapter(5, 'Si algo no cuadra', 'Lista de chequeo',
      'Las causas más comunes, en orden.') +
    `<table class="tbl"><tr><th>Lo que pasa</th><th>Por qué</th><th>Qué hacer</th></tr>
      <tr><td>El botón <b>Publicar</b> está gris</td><td>No hay informes pendientes en ese equipo, o falta elegir el equipo</td><td>Revisa el equipo elegido y que el mes sea el correcto</td></tr>
      <tr><td>Sale un error al publicar: <b>falta la nota del equipo</b></td><td>No se guardó la nota</td><td>Escríbela (20 caracteres o más) y pulsa <b>Guardar nota</b> antes de publicar</td></tr>
      <tr><td>Una jugadora <b>no tiene informe</b></td><td>No tuvo evaluaciones en el mes, o la evaluaste después del cierre</td><td>Evalúala y pide a la administración que pulse «Generar borradores» del mes</td></tr>
      <tr><td>Una jugadora no tiene botón <b>Enviar</b></td><td>No tiene acudiente con cuenta vinculada</td><td>Invitar al acudiente; el informe le queda guardado</td></tr>
      <tr><td>Victorias/Empates/Derrotas en 0</td><td>No hay partidos cargados como jugados</td><td>Cargarlos en <b>Resultados</b> con el marcador</td></tr>
      <tr><td>Goleadores vacío o con números raros</td><td>No se cargaron Goles/Asistencias, o se cargaron por partido</td><td>Cargar en la evaluación el <b>acumulado de la temporada</b></td></tr></table>` +
    tip('Cada mes', 'Escribe la nota de tus equipos <b>antes del día 28</b>: ese día los informes con nota se publican solos. Después solo te queda revisar el PDF y enviar.')
  );

  if (isInternal) {
    pgs.push(
      chapter(6, 'Lo que NO existe todavía y deuda', 'Solo equipo SportMaps — no prometer al club', '') +
      `<table class="tbl"><tr><th>Hueco</th><th>Estado</th><th>Nota</th></tr>
        <tr><td>Recordatorio al coach sin nota</td><td>No existe</td><td>El cron se salta el equipo sin nota y nadie avisa; así quedó septiembre de Besser.</td></tr>
        <tr><td>Cron sobre meses vencidos</td><td>No existe</td><td>Solo trabaja el mes en curso; un mes sin cerrar queda para publicar a mano.</td></tr>
        <tr><td>Coach no puede generar borradores</td><td>Por diseño</td><td><code>POST /reports/generate</code> es ADMIN_ROLES. Evaluaciones tardías dependen del admin.</td></tr>
        <tr><td>El cuadro de la nota se vacía al guardar</td><td>UX</td><td>No muestra la nota guardada; confunde.</td></tr>
        <tr><td>La tabla de cobertura no se refresca al publicar</td><td>UX</td><td>Hay que pulsar «Actualizar».</td></tr>
        <tr><td>Regenerar un grupal publicado</td><td>No existe</td><td>409; queda congelado al <code>send_day</code>.</td></tr>
        <tr><td>Remitente de correo propio</td><td>Parcial</td><td>Nombre del club sí; la dirección sigue siendo noreply@sportmaps.co.</td></tr></table>` +
      tip('Capturas de este manual', 'Tenant demo Club Campestre Demo, entrenador Felipe Torres con Fútbol — Sub-15 asignado y la escuela en «Cada entrenador, lo suyo». Datos sembrados con <code>notes=\'seed-manual-informe\'</code> (48 evaluaciones y 4 partidos). Se publicaron los 4 informes del Sub-15 del demo; <b>no se envió nada</b>. El PDF grupal es el real de Besser (Pre Juvenil, septiembre).')
    );
  }
  return pgs;
}

// ── Documento ─────────────────────────────────────────────────────────────
function cover(isInternal) {
  return `<div class="page cover"><div class="cover-inner">
    <div><div class="logo"><span class="pin"></span>SportMaps</div></div>
    <div>
      <div class="cover-eyebrow"><span class="dot" style="background:${isInternal ? '#ff8833' : '#4fd17a'}"></span>${isInternal ? '🔒 Uso interno — no enviar a escuelas' : 'Guía de uso · Club Deportivo Besser'}</div>
      <h1 class="cover-title">Informe Mensual de las jugadoras</h1>
      <p class="cover-sub">Cómo el entrenador escribe la nota de cada equipo, publica, revisa el PDF y envía el informe del mes a las familias, y dónde ver el informe grupal, los resultados y los goleadores.</p>
      <div class="pills">
        <span class="pill">Rol: Entrenador</span>
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
  return `<!doctype html><html><head><meta charset="utf-8" /><title>SportMaps — Informe Mensual (${isInternal ? 'Interno' : 'Academias'})</title><style>${css()}</style></head><body>` +
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
      console.log(`✅ ${ver}: ${base}.pdf (${n} páginas)`);
    }
  } finally {
    await browser.close();
  }
}

render().catch((e) => { console.error(e); process.exit(1); });
