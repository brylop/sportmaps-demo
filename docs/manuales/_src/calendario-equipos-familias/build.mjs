// Genera el manual "Calendario por equipos" en sus dos versiones (interno /
// academias) como HTML + PDF, con las capturas reales de ./shots/.
//
//   node docs/manuales/_src/calendario-equipos-familias/build.mjs
//
// Antes hay que correr capture.mjs (mismo directorio) para producir ./shots/.
// Sistema visual: el de todos los manuales (ver memoria feedback_pdf_manual_template
// y docs/manuales/README.md). Chromium de Playwright hace los recortes (canvas) y el
// PDF; no hace falta nada más.

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
  academias: path.join(repo, 'docs/manuales/academias/calendario-equipos-familias'),
  interno: path.join(repo, 'docs/manuales/interno/calendario-equipos-familias'),
};
// Las capturas se tomaron a 1600×1000 CSS px con deviceScaleFactor 2.
const SCALE = 2;

// ── Recortes (coordenadas en CSS px del viewport 1600×1000) ───────────────
// Un manual de venta o de uso muestra SOLO lo relevante: el diálogo, la tarjeta,
// la fila. La página completa se deja únicamente donde da contexto.
const CROP_DEFS = {
  '01-equipos-tabla.png':      { src: '01-equipos-owner.png',              x: 280,  y: 385, w: 1300, h: 235 },
  '03-dialogo-para-quien.png': { src: '03-coach-nuevo-evento-para-quien.png', x: 540, y: 70,  w: 520,  h: 480 },
  '04-dialogo-lleno.png':      { src: '04-coach-nuevo-evento-lleno.png',   x: 540,  y: 70,  w: 520,  h: 560 },
  '05-tarjeta-proximo.png':    { src: '05-coach-evento-creado.png',        x: 1150, y: 205, w: 440,  h: 135 },
  '05-detalle-dia.png':        { src: '05-coach-evento-creado.png',        x: 300,  y: 765, w: 630,  h: 160 },
  '06-dialogo-editar.png':     { src: '06-coach-editar-evento.png',        x: 540,  y: 70,  w: 520,  h: 860 },
  '07-tarjeta-padre.png':      { src: '07-padre-calendario-familiar.png',  x: 1150, y: 205, w: 440,  h: 115 },
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
const full = (file, caption, maxH = 300) => img(file, caption, `max-height:${maxH}px`);
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

// ── Contenido: cada entrada del array es UNA página ───────────────────────
function pages(isInternal) {
  const I = (html) => (isInternal ? internal(html) : '');
  const pgs = [];

  // ── Cap. 1 — Antes de empezar ──
  pgs.push(
    chapter(1, 'Antes de empezar: cada equipo con su coach', 'Menú lateral → Equipos y Planes → Mis Equipos',
      'El coach solo puede publicar eventos para las categorías que tiene <b>asignadas</b>. Si una categoría no le aparece al crear un evento, casi siempre es porque nadie se la asignó. Esto lo revisa el owner o un admin, una sola vez.') +
    step(1, 'Revisar quién es el coach de cada categoría',
      p('En <b>Mis Equipos</b>, la columna <b>Entrenador</b> muestra quién tiene cada categoría. Un coach puede tener varias; el owner y los admins ven todas las de la escuela.'),
      crop('01-equipos-tabla.png', 'Mis Equipos, vista del owner: la columna Entrenador de cada categoría.', 696)) +
    step(2, 'Si falta un coach, asignarlo desde el equipo',
      p('Con el lápiz de la fila se edita la categoría y se elige el coach. Desde ese momento la categoría le aparece al coach en la lista <b>"Para quién"</b> del calendario y en Asistencias.', 'no-shot')) +
    I('La lista "Para quién" del coach se arma igual que en Métricas y Rendimiento (<code>TrainingPlansPage</code>): <code>teams.coach_id</code> o <code>team_coaches.coach_id</code>, comparando contra <code>auth.uid()</code> <b>y</b> contra su <code>school_staff.id</code> (<code>coach_auth_id</code>). En Besser, <code>teams.coach_id</code> apunta al <code>school_staff.id</code>, no al usuario; por eso hace falta la doble comparación. La RLS no restringe al coach a sus equipos (cualquier staff de la escuela puede publicar para cualquier equipo de esa escuela): la restricción es de la interfaz.')
  );

  // ── Cap. 2 — Publicar ──
  pgs.push(
    chapter(2, 'Publicar un entrenamiento o un partido', 'Menú lateral → Calendario → Nuevo Evento',
      'Lo hace el coach (o el owner/admin). Un evento se publica <b>para una categoría</b>, <b>para toda la escuela</b> o <b>solo para quien lo crea</b>. Lo único que cambia entre las tres opciones es quién lo ve.') +
    step(1, 'Abrir Calendario y pulsar "Nuevo Evento"',
      p('El calendario del coach muestra sus propios eventos y los de los equipos de la escuela. El botón <b>Nuevo Evento</b> está arriba a la derecha. También se puede seleccionar primero el día en la cuadrícula: el formulario arranca con esa fecha.'),
      full('02-coach-calendario.png', 'Calendario del coach antes de crear el evento.', 320))
  );
  pgs.push(
    step(2, 'Elegir "Para quién"',
      p('Es el campo que decide quién ve el evento. Aparecen las categorías del coach y dos opciones fijas:') +
      `<table class="tbl"><tr><th>Opción</th><th>Quién lo ve</th><th>Cuándo usarla</th></tr>
        <tr><td><b>Una categoría</b> (ej. PRE JUVENIL FEMENINO)</td><td>Las familias de ese equipo y el staff de la escuela</td><td>Entrenamientos, partidos, citaciones de esa categoría</td></tr>
        <tr><td><b>Toda la escuela</b></td><td>Todas las familias y todo el staff</td><td>Reunión de padres, festivo sin entrenamiento, evento del club</td></tr>
        <tr><td><b>Solo para mí</b></td><td>Nadie más</td><td>Recordatorios personales del coach</td></tr></table>`,
      crop('03-dialogo-para-quien.png', 'El desplegable "Para quién" con las categorías del coach y las dos opciones fijas.', 460)) +
    warn('Ojo con "Solo para mí"', 'Un evento "Solo para mí" <b>no le llega a ningún papá</b>. Si la intención es que las familias lo vean, tiene que ir a una categoría o a toda la escuela. Si el coach tiene una sola categoría ya viene preseleccionada; si tiene varias, el formulario no deja guardar hasta elegir una.')
  );
  pgs.push(
    step(3, 'Completar tipo, fecha, hora y lugar',
      p('<b>Tipo de evento</b> (Entrenamiento, Partido, Competencia, Reunión…), una <b>etiqueta</b> opcional (ej. "Liga Municipal Sub-15"), <b>fecha y hora de inicio y fin</b>, la <b>ubicación</b> (busca direcciones de Colombia) y una descripción. Título, fechas y "Para quién" son obligatorios. Debajo del selector, una línea confirma quién lo va a ver.'),
      crop('04-dialogo-lleno.png', 'Formulario completo: partido de liga para la categoría Juvenil Competitivo.', 480))
  );
  pgs.push(
    step(4, 'Crear',
      p('Al guardar, la tarjeta en <b>Próximos Eventos</b> muestra la etiqueta del tipo y, al lado, <b>el nombre de la categoría</b> (o "Toda la escuela"). Esa etiqueta es la confirmación de que las familias lo van a ver.'),
      crop('05-tarjeta-proximo.png', 'La tarjeta recién creada, con la etiqueta de la categoría.', 560)) +
    step(5, 'Ver el detalle del día',
      p('Al pulsar el día en la cuadrícula aparece el detalle: horario, lugar, descripción y la misma etiqueta de categoría.'),
      crop('05-detalle-dia.png', 'Detalle del día con el evento publicado.', 620)) +
    I('Modelo en la base: <code>team_id</code> lleno = evento de equipo (el trigger <code>calendar_events_fill_school</code> copia <code>school_id</code> desde el equipo, no confía en el cliente); solo <code>school_id</code> = toda la escuela; ambos NULL = personal. No hay columna de visibilidad. Policies nuevas <code>calendar_events_select/insert/update/delete</code> (migración <code>20260923113401</code>), escritura solo con <code>user_staff_school_ids()</code>, y <code>anon</code> perdió los GRANTs que tenía sobre la tabla.')
  );

  // ── Cap. 3 — Editar / mover / eliminar ──
  pgs.push(
    chapter(3, 'Corregir, mover a otro equipo o eliminar', 'Calendario → lápiz sobre el evento',
      'El lápiz aparece solo para quien creó el evento y para el owner/admin de la escuela. Un papá no puede editar lo que publica la escuela.') +
    step(1, 'Abrir el evento con el lápiz',
      p('Al pasar el mouse sobre la tarjeta (en "Próximos Eventos" o en el detalle del día) aparece el lápiz. Se abre el mismo formulario de creación, con el campo <b>Para quién</b> incluido y el botón <b>Eliminar</b> abajo a la izquierda.'),
      crop('06-dialogo-editar.png', 'Editar: mismo formulario, con "Para quién" y el botón Eliminar.', 360))
  );
  pgs.push(
    step(2, 'Mover un evento a otro equipo o a toda la escuela',
      p('Basta cambiar <b>Para quién</b> y guardar. Sirve para arreglar un evento creado "Solo para mí" por error: al pasarlo a la categoría, las familias lo ven de inmediato.', 'no-shot')) +
    step(3, 'Eliminar',
      p('El botón <b>Eliminar</b> pide confirmación y borra el evento para todos. Si un partido se aplazó, es mejor <b>editar la fecha</b> que borrarlo y crear otro.', 'no-shot')) +
    warn('Eventos creados antes de esta actualización', 'Todo lo que se creó antes quedó como <b>"Solo para mí"</b>, porque el formulario anterior no preguntaba el equipo. Hay que abrir cada evento futuro con el lápiz y elegirle la categoría; los pasados se pueden dejar como están.') +
    I('Backfill de la migración: los eventos que ya tenían <code>team_id</code> recibieron <code>school_id</code> (61); los que no (28, entre ellos todos los de Besser, creados por Duván Daza) quedaron personales a propósito: convertirlos en "toda la escuela" habría mostrado el entrenamiento de una categoría a todas las familias. El owner/admin también puede reasignarlos, porque <code>calendar_events_update</code> deja editar lo de su escuela vía <code>user_admin_school_ids()</code>.')
  );

  // ── Cap. 4 — Familia ──
  pgs.push(
    chapter(4, 'Qué ve la familia', 'App del acudiente → Calendario Familiar',
      'El papá o la mamá entra con su cuenta y abre <b>Calendario Familiar</b>. Ve los eventos de las categorías donde tiene un hijo inscrito y los de toda la escuela. No tiene que configurar nada.') +
    step(1, 'El calendario muestra los eventos de sus hijos',
      p('Cada tarjeta trae la hora, el tipo de evento y <b>el nombre de la categoría</b>. Si la familia tiene dos hijos en categorías distintas, ve las dos. También ve lo que la escuela publica para todos.'),
      full('07-padre-calendario-familiar.png', 'Calendario Familiar del acudiente: el partido publicado por el coach, el mismo día.', 300) +
      crop('07-tarjeta-padre.png', 'La tarjeta tal como la ve el papá: misma etiqueta de categoría, sin lápiz.', 520))
  );
  pgs.push(
    step(2, 'Lo que la familia puede y no puede hacer',
      p('Puede ver el detalle de cada día pulsándolo en la cuadrícula y crear <b>sus propios recordatorios</b> (que nadie más ve). <b>No puede editar ni borrar</b> lo que publica la escuela: por eso en sus tarjetas no aparece el lápiz.', 'no-shot')) +
    tip('Familias recién inscritas', 'Una familia que se inscribió por el QR y todavía debe el primer pago <b>ya ve el calendario</b> de su categoría. No hay que esperar a que pague para que sepa cuándo entrena.') +
    I('La visibilidad del papá sale de <code>enrollments</code> (estados <code>active</code>, <code>pending</code>, <code>paused</code>) y de <code>children.team_id</code>, vía <code>calendar_family_team_ids()</code> / <code>calendar_family_school_ids()</code> (SECURITY DEFINER). <b>No</b> usa <code>team_members</code>: esa tabla tiene 0 filas en los 8 equipos de Besser. La policy vieja sí la usaba, y por eso ni con equipo un papá habría visto nada. Los eventos "toda la escuela" usan además <code>user_school_ids()</code>, que incluye padres y atletas (solo lectura). Verificado simulando la sesión del papá demo: 3 equipos de familia, 8 eventos visibles, 0 de otros equipos; y el INSERT de un papá con <code>team_id</code> revienta con 42501.')
  );

  // ── Cap. 5 — Checklist ──
  pgs.push(
    chapter(5, 'Si un papá no ve un evento', 'Lista de chequeo, en orden',
      'Cuatro causas cubren casi todos los casos. Revisar en este orden.') +
    `<table class="tbl"><tr><th>#</th><th>Revisar</th><th>Cómo se arregla</th></tr>
      <tr><td>1</td><td>La tarjeta del evento <b>no tiene etiqueta de categoría</b> ni "Toda la escuela"</td><td>Quedó "Solo para mí". El coach lo abre con el lápiz y elige la categoría.</td></tr>
      <tr><td>2</td><td>El hijo <b>no está inscrito</b> en esa categoría (en Deportistas aparece "Sin equipo" o en otra categoría)</td><td>Asignarle la categoría desde la ficha del deportista.</td></tr>
      <tr><td>3</td><td>El papá entra con <b>otra cuenta</b> distinta a la del acudiente registrado</td><td>Debe usar el correo con el que se inscribió al hijo, o la escuela vincula el hijo a su cuenta.</td></tr>
      <tr><td>4</td><td>Está en <b>otro mes</b> del calendario</td><td>Pulsar "Hoy" en la cuadrícula.</td></tr></table>` +
    step(1, 'Deportista inscrito por QR que no aparece en su categoría',
      p('Hasta el 23 de septiembre de 2026, un deportista que se inscribía por el QR eligiendo una categoría <b>sin plan y sin precio</b> podía quedar "pendiente" para siempre: la escuela lo veía "Sin equipo" y el coach no lo tenía en la lista. Ya está corregido: si no hay nada que pagar, la inscripción queda activa de inmediato. Los que sí tienen un primer pago pendiente aparecen en su categoría <b>cuando la escuela aprueba ese pago</b>.', 'no-shot')) +
    I('Fix: migración <code>20260923113359_fix_qr_signup_pending_sin_cobro</code> (aplicada el 2026-09-23). <code>submit_qr_signup__interno</code> usa <code>v_needs_payment := require_first_payment AND v_amount > 0</code> para decidir <code>pending</code>/<code>active</code>, y la rama de reuso activa una <code>pending</code> huérfana al volver a pasar por el QR. Caso real: Eillen Katherine Navarro Moreno (Besser → PRE JUVENIL FEMENINO), activada a mano; era la única atascada en toda la base. Deuda aparte: el wrapper <code>submit_qr_signup</code> de 13 argumentos tiene EXECUTE para PUBLIC en la base viva.')
  );

  if (isInternal) {
    pgs.push(
      chapter(6, 'Lo que NO existe todavía', 'Solo equipo SportMaps — no prometer a la escuela', '') +
      `<table class="tbl"><tr><th>Hueco</th><th>Estado</th><th>Nota</th></tr>
        <tr><td>Notificación al papá cuando se crea un evento</td><td>No existe</td><td>No hay trigger ni endpoint; el papá lo ve al abrir el calendario. Candidato natural para el despachador unificado de notificaciones.</td></tr>
        <tr><td>Un evento para varias categorías a la vez</td><td>No existe</td><td>1 evento = 1 equipo. Para dos categorías se crean dos eventos. Si se quiere multi-equipo, va tabla puente + RPC transaccional (regla de CLAUDE.md).</td></tr>
        <tr><td>Eventos recurrentes (todos los lunes 16:00)</td><td>No existe</td><td>Cada entrenamiento se crea a mano. La agenda real de entrenamientos vive en <code>attendance_sessions</code>/horarios; el calendario no se alimenta de ahí.</td></tr>
        <tr><td>Tiempo real</td><td>Cableado a medias</td><td><code>useRealtimeCalendar</code> existe pero ninguna pantalla lo usa; el calendario se refresca al volver a cargar.</td></tr>
        <tr><td><code>CalendarAdvancedPage.tsx</code></td><td>Código muerto</td><td>Nadie lo enruta; sigue insertando sin equipo. Borrar o alinear.</td></tr>
        <tr><td>Deploy</td><td>Manual</td><td>Vercel no despliega desde git en este proyecto: el frontend hay que subirlo a mano con el CLI (memoria <code>project_vercel_deploys_son_manuales</code>). Hasta entonces la escuela sigue viendo el calendario viejo.</td></tr></table>` +
      warn('Gotcha de SQL que costó una aplicación fallida', 'Con una función que devuelve <code>uuid[]</code>, <code>x = ANY ((SELECT fn()))</code> se interpreta como subconsulta de filas y falla con <code>uuid = uuid[]</code>. Hay que castear: <code>x = ANY ((SELECT fn())::uuid[])</code>. La migración se revirtió entera (apply_migration es transaccional) y se reaplicó con el cast.') +
      tip('Cómo se verificó', '<code>npm run seguridad:invariantes</code>: sin violaciones críticas. Sesiones simuladas con <code>set_config(\'request.jwt.claims\', …)</code> + <code>set local role authenticated</code>: papá demo ve 8 eventos de sus 3 equipos y ninguno ajeno; papá de Besser no puede insertar con <code>team_id</code> (42501); coach de Besser inserta para su equipo y el trigger llena <code>school_id</code>.')
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
      <h1 class="cover-title">Calendario por equipos</h1>
      <p class="cover-sub">Cómo el coach o la administración publica entrenamientos, partidos y avisos para una categoría o para toda la escuela, y cómo los ven las familias en su Calendario Familiar.</p>
      <div class="pills">
        <span class="pill">Roles: Coach · Owner/Admin · Familias</span>
        <span class="pill">${isInternal ? '6' : '5'} capítulos</span>
        <span class="pill">Capturas reales del producto</span>
        ${isInternal ? '<span class="pill" style="border-color:#ff8833;color:#ffcf9e">Uso interno</span>' : ''}
      </div>
    </div>
    <div class="cover-footer">SportMaps © 2026 · septiembre</div>
  </div></div>`;
}

const css = () => fs.readFileSync(path.join(here, 'manual.css'), 'utf8');

function html(isInternal) {
  const body = pages(isInternal);
  const total = body.length + 1;
  const foot = (n) => `<div class="footer${isInternal ? ' internal-mark' : ''}"><span>SportMaps · ${isInternal ? 'Uso interno' : 'Guía de uso'}</span><span>Página ${n} de ${total}</span></div>`;
  return `<!doctype html><html><head><meta charset="utf-8" /><title>SportMaps — Calendario por equipos (${isInternal ? 'Interno' : 'Academias'})</title><style>${css()}</style></head><body>` +
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
      // Una página que desborda se recorta en silencio (overflow:hidden): avisar.
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
