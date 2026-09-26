// Genera el manual "Pizarra táctica" en sus dos versiones (interno / academias) como
// HTML + PDF con las capturas reales de ./shots/, y convierte el video crudo de
// ./video-raw/ (Playwright, webm) a docs/manuales/video/pizarra-tactica.{webm,mp4}.
//
//   node docs/manuales/_src/pizarra-tactica/build.mjs
//
// Antes: capture.mjs (mismo directorio). Sistema visual: el de todos los manuales
// (memoria feedback_pdf_manual_template, docs/manuales/README.md). ffmpeg en PATH.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../..');
const require = createRequire(path.join(repo, 'frontend', 'package.json'));
const { chromium } = require('playwright');

const SHOTS = path.join(here, 'shots');
const CROPS = path.join(here, 'shots', 'crops');
const VIDEO_RAW = path.join(here, 'video-raw');
const VIDEO_OUT = path.join(repo, 'docs/manuales/video');
const OUT = {
  academias: path.join(repo, 'docs/manuales/academias/pizarra-tactica'),
  interno: path.join(repo, 'docs/manuales/interno/pizarra-tactica'),
};
const SCALE = 2; // capturas a 1600×1000 CSS px con deviceScaleFactor 2

// ── Recortes (coordenadas en CSS px del viewport 1600×1000) ───────────────
// Layout del tablero a 1600×1000: barra superior y=0..40, panel Pizarra x=0..220,
// cancha x≈492..1068 / y≈188..844, panel Plantilla x=1340..1600.
const PITCH = { x: 470, y: 176, w: 640, h: 680 };
const CROP_DEFS = {
  '02-tablero.png':          { src: '02-tablero.png',             x: 0,   y: 0,   w: 1600, h: 860 },
  '03-jugadores.png':        { src: '03-jugadores.png',           ...PITCH },
  '04-silueta.png':          { src: '04-siluetas.png',            x: 480, y: 560, w: 260,  h: 150 },
  '05-material-panel.png':   { src: '05-material.png',            x: 0,   y: 424, w: 220,  h: 310 },
  '05-material-cancha.png':  { src: '05-material.png',            x: 470, y: 176, w: 640,  h: 300 },
  '06-seleccion.png':        { src: '06-seleccion-tamano-giro.png', x: 490, y: 250, w: 240,  h: 150 },
  '06-panel-seleccion.png':  { src: '06-seleccion-tamano-giro.png', x: 0,   y: 878, w: 220,  h: 108 },
  '07-duplicar.png':         { src: '07-duplicar.png',            x: 490, y: 250, w: 240,  h: 150 },
  '08-colores-panel.png':    { src: '08-colores.png',             x: 0,   y: 736, w: 220,  h: 130 },
  '09-lineas.png':           { src: '09-lineas.png',              ...PITCH },
  '10-balon-panel.png':      { src: '10-balon-en-juego.png',      x: 0,   y: 290, w: 220,  h: 130 },
  '10-balon-cancha.png':     { src: '10-balon-en-juego.png',      ...PITCH },
  '11-reproduciendo.png':    { src: '11-reproduciendo.png',       ...PITCH },
  '13-modo-arqueros.png':    { src: '13-modo-arqueros.png',       ...PITCH },
  '14-arqueros-material.png':{ src: '14-arqueros-material.png',   ...PITCH },
  '15-plantilla-nombre.png': { src: '15-plantilla-nombre.png',    x: 0,   y: 0,   w: 760,  h: 42 },
  '17-cancha-completa.png':  { src: '17-cancha-completa.png',     ...PITCH },
  '01-toolbar.png':          { src: '02-tablero.png',             x: 0,   y: 0,   w: 1600, h: 42 },
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
const twoUp = (a, b) => `<div style="display:flex;gap:14px;align-items:flex-start">${a}${b}</div>`;

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

  // ── Cap. 1 — Abrir ──
  pgs.push(
    chapter(1, 'Abrir la pizarra', 'Métricas y Rendimiento → equipo → sesión → bloque → "Tablero táctico"',
      'La pizarra es <b>por bloque de sesión</b>: cada bloque (calentamiento, parte situacional, arqueros…) tiene su propio tablero, y lo que dibujas queda guardado con ese bloque. Solo aparece en equipos de <b>fútbol</b>.') +
    step(1, 'Elegir el equipo y la sesión',
      p('En <b>Métricas y Rendimiento</b> elige el equipo. En cada sesión, junto a cada bloque, está el botón <b>Tablero táctico</b>. Si el equipo tiene mesociclo, la sesión se abre desde su día.'),
      full('01-abrir-desde-sesion.png', 'La sesión con sus bloques; cada uno con su botón Tablero táctico.', 250)) +
    step(2, 'El tablero',
      p('Abre a pantalla completa. <b>Arriba</b>: situación (Ataque, Defensa, Presión, Transición, Córner, Tiro libre, Penalti, Arqueros), plantillas guardadas, vistas (zonas, siluetas, zoom) y los botones <b>Pizarra</b> y <b>Plantilla</b>. <b>Derecha</b>: la plantilla del equipo. <b>Izquierda</b> (al pulsar Pizarra): líneas, balón en juego, material, colores, tamaño y giro.'),
      crop('01-toolbar.png', 'Barra superior: situación · plantillas · vistas · Pizarra · Plantilla · Guardar.', 696)) +
    I('Entradas: <code>TrainingPlansPage.openBlockTacticalBoard</code> (bloque de <code>training_sessions.session_blocks</code>, le genera <code>id</code> la primera vez) y <code>FootballDashboardModal</code> (partidos). Guarda en <code>match_lineups</code>/<code>match_lineup_players</code> con <code>source_type = training_session | team_match</code>; las figuras van en el jsonb <code>shapes</code>. Con mesociclo activo la lista plana de sesiones se oculta: una sesión no enganchada a un día no muestra el botón.')
  );

  // ── Cap. 2 — Jugadores ──
  pgs.push(
    chapter(2, 'Jugadores: discos o siluetas', 'Botón "Plantilla" (derecha) → arrastrar a la cancha',
      'La plantilla trae a los deportistas del equipo. Se arrastran a la cancha; al soltar quedan con su etiqueta de posición, que se puede tocar para renombrar.') +
    step(1, 'Arrastrar cada jugador a su posición',
      p('Toma la tarjeta y suéltala donde va. La × roja sobre el jugador lo devuelve a la plantilla. Máximo 11 en cancha; el resto puede ir a la <b>banca</b>. <b>Sugerir XI</b> arma una formación por minutos jugados cuando hay partidos registrados.'),
      crop('03-jugadores.png', 'Jugador colocado, con su etiqueta de posición.', 360))
  );
  pgs.push(
    step(2, 'Discos o siluetas',
      p('El botón de la persona en la barra superior cambia entre <b>discos con dorsal</b> y <b>siluetas</b>. En siluetas, el arquero (etiqueta "arquero", "portero" o "golero") sale con camiseta <b>amarilla</b>. Es una preferencia de vista: se recuerda en tu celular y no cambia lo guardado.'),
      crop('04-silueta.png', 'Silueta con dorsal y etiqueta.', 260)) +
    tip('Nunca fotos', 'Las siluetas son genéricas a propósito: la pizarra no muestra la foto del deportista, aunque la tenga en su ficha.') +
    I('<code>pinStyle</code> en <code>localStorage</code> (<code>tacticalPalette.ts</code>, clave <code>PIN_STYLE_KEY</code>). Arquero por regex sobre la etiqueta: <code>/arquer|portero|golero|guardameta/</code>. Decisión cerrada en la spec §6.3: sin foto por consentimiento de menores.')
  );

  // ── Cap. 3 — Material ──
  pgs.push(
    chapter(3, 'Material de entrenamiento', 'Botón "Pizarra" (izquierda) → Material',
      'Once objetos: <b>cono, plato, balón, arco, arco chico, vallita, aro, escalera, estaca, maniquí y rival</b>. Elige uno y toca la cancha una vez por cada objeto que quieras poner.') +
    step(1, 'Colocar',
      p('Un toque en la cancha coloca el objeto centrado bajo el dedo. Arrástralo para moverlo. El contador del botón <b>Pizarra (N)</b> suma cada figura.'),
      twoUp(crop('05-material-panel.png', 'La sección Material del panel.', 220), crop('05-material-cancha.png', 'Los once objetos colocados.', 440))) +
    warn('Tocar no borra', 'Tocar un objeto ya puesto lo <b>selecciona</b>; nunca lo borra. Borrar es explícito: la × roja del objeto o la papelera del panel.')
  );
  pgs.push(
    step(2, 'Seleccionar, tamaño y giro',
      p('Con un objeto seleccionado aparece un marco punteado, un <b>punto verde</b> arriba para girarlo con el dedo y la <b>×</b> para quitarlo. En el panel, los deslizadores de <b>Tamaño</b> (0,5× a 3×) y <b>Giro</b> cambian ese objeto; <b>+90°</b> gira en cuartos (dos veces = arco mirando hacia abajo).'),
      twoUp(crop('06-seleccion.png', 'Cono seleccionado a 2,2× y 90°.', 300), crop('06-panel-seleccion.png', 'Tamaño, giro, +90°, Duplicar y quitar.', 220))) +
    step(3, 'Duplicar',
      p('<b>Duplicar</b> copia el objeto seleccionado con su tamaño, giro y color, un poco desplazado, y deja la copia seleccionada. Sirve para filas de conos o estacas.'),
      crop('07-duplicar.png', 'La copia sale al lado, lista para arrastrar.', 300)) +
    tip('Sin nada seleccionado', 'Los mismos deslizadores fijan el tamaño y el giro con que se colocan los objetos <b>nuevos</b>. Los ya puestos no cambian.') +
    I('Campos opcionales en el jsonb: <code>size</code> (0,25–4, validado en BFF <code>footballShapes.validateArrows</code>), <code>rot</code>, <code>kind</code>. Figuras viejas sin esos campos se dibujan igual que antes (sin <code>schema_version</code>, spec §5). Los glifos viven en <code>tacticalGlyphs.tsx</code>; el catálogo <code>OBJECT_TYPES</code> en <code>tacticalGeometry.ts</code>.')
  );

  // ── Cap. 4 — Colores y líneas ──
  pgs.push(
    chapter(4, 'Colores, líneas y zonas', 'Panel Pizarra → Color · Líneas',
      'Nueve colores para líneas, zonas y material: blanco, amarillo, rojo, azul, verde, naranja, morado, rosado y negro. Zonas de distinto color = distintas consignas.') +
    step(1, 'Elegir color',
      p('El color activo se aplica a lo que dibujes o coloques después. Con un objeto seleccionado, elegir otro color lo cambia. "Blanco" es el color natural de cada objeto: el cono queda naranja, aro, plato y escalera amarillos, la estaca roja.', 'no-shot')) +
    step(2, 'Flecha, curva y zona',
      p('Elige <b>Flecha</b>, <b>Curva</b> o <b>Zona</b> y arrastra sobre la cancha desde donde empieza hasta donde termina. Los puntos blancos de cada figura se pueden arrastrar después para ajustarla. <b>Deshacer</b> quita la última figura; <b>Borrar</b> las quita todas.'),
      twoUp(crop('08-colores-panel.png', 'Los nueve colores.', 200), crop('09-lineas.png', 'Flecha y curva azules, zona amarilla y conos rojos.', 330))) +
    I('Las líneas se guardan como <code>type: arrow | curve | zone</code> con <code>x1,y1,x2,y2</code> en 0–100 de cancha completa y <code>color</code>. Regla de distancia aparte (botón Regla, largo de cancha configurable).')
  );

  // ── Cap. 5 — Balón en juego ──
  pgs.push(
    chapter(5, 'Balón en juego y "Reproducir jugada"', 'Panel Pizarra → Balón en juego',
      'Tres recorridos de balón: <b>Pase</b>, <b>Remate</b> y <b>Penal</b>. Se dibujan igual que una flecha, desde donde sale el balón hasta donde llega.') +
    step(1, 'Dibujar el recorrido',
      p('Coloca un <b>balón</b> del material y elige Pase, Remate o Penal. Arrastra desde el balón hasta el destino. Un pase que sale de un jugador y llega a otro es un pase entre ellos; un remate hacia el arco es un tiro.'),
      twoUp(crop('10-balon-panel.png', 'Pase · Remate · Penal.', 200), crop('10-balon-cancha.png', 'Pase al compañero y remate al arco.', 340)))
  );
  pgs.push(
    step(2, 'Reproducir jugada',
      p('<b>Reproducir jugada</b> anima todo a la vez: cada jugador con flecha o curva viaja hasta la punta y vuelve; el balón recorre su línea, y en remate y penal se ve elevándose. Al terminar, todo queda como estaba: es un ensayo que se puede repetir las veces que haga falta.'),
      crop('11-reproduciendo.png', 'A mitad de la reproducción.', 360)) +
    tip('Video', 'El recorrido completo (colocar, dibujar, reproducir, arqueros y guardar) está grabado en <b>docs/manuales/video/pizarra-tactica.mp4</b>, 3 minutos con subtítulos.') +
    I('<code>type: ball_path</code> con <code>kind: pase | remate | penal</code>; la parábola es visual (sombra), no física. Un jugador con <code>ball_path</code> que sale de su posición se anima primero al balón. Los "balones fantasma" son estado efímero (<code>ghostBalls</code>), no se guardan.')
  );

  // ── Cap. 6 — Modo arqueros ──
  pgs.push(
    chapter(6, 'Modo arqueros', 'Situación "Arqueros" → zoom al área',
      'Para el entrenador de arqueros. Al elegir la situación <b>Arqueros</b>, la cancha hace <b>zoom al área</b>: el arco, los conos y los maniquíes se ven grandes. El botón de zoom de la barra superior alterna entre el área y la cancha completa cuando quieras.') +
    warn('Cambiar de situación vacía las figuras', 'Elegir otra situación (Ataque → Arqueros) <b>borra lo dibujado</b>, igual que siempre. Si solo quieres el zoom sin perder el trabajo, usa el botón de zoom de la barra, no el selector de situación.') +
    step(1, 'Armar el ejercicio en el área',
      p('Arco, maniquíes como barrera, balones y conos; un <b>Remate</b> desde el balón al arco para el 1v1. Todo se coloca y se mueve igual que en la cancha completa.'),
      twoUp(crop('13-modo-arqueros.png', 'Zoom al área al elegir Arqueros.', 300), crop('14-arqueros-material.png', 'Arco, maniquíes, balones, conos y un remate.', 300))) +
    I('Situación <code>arqueros</code> en el CHECK de <code>team_tactical_presets</code> (migración <code>20260924102935</code>). El zoom es solo <code>viewBox</code> (<code>GK_VIEW</code>, y0 = 52) sobre el mismo SVG: las coordenadas guardadas siguen siendo 0–100 de cancha completa, así que una plantilla de arqueros se ve bien en los dos zooms.')
  );

  // ── Cap. 7 — Guardar ──
  pgs.push(
    chapter(7, 'Guardar: en el bloque o como plantilla', 'Barra superior → Guardar · icono de marcador',
      'Dos cosas distintas. <b>Guardar</b> deja jugadores y figuras en <b>este bloque</b> de la sesión. <b>Guardar como plantilla</b> guarda la disposición con un nombre, por situación, para cargarla en cualquier otra sesión del equipo.') +
    step(1, 'Guardar como plantilla',
      p('El icono de marcador de la barra superior pide un nombre; <b>OK</b> la guarda para la situación elegida. Desde entonces aparece en el desplegable <b>Plantilla…</b>. Con una plantilla cargada, <b>Actualizar</b> guarda los cambios sobre ella y la papelera la elimina.'),
      crop('15-plantilla-nombre.png', 'Nombre de la plantilla nueva en la barra superior.', 696)) +
    step(2, 'Volver a la cancha completa y guardar el bloque',
      p('El botón de zoom devuelve la cancha completa sin perder nada. <b>Guardar</b> (verde, arriba a la derecha) deja la alineación y las figuras en el bloque y cierra el tablero; al reabrirlo está todo igual.'),
      crop('17-cancha-completa.png', 'Cancha completa con el ejercicio de arqueros arriba.', 240)) +
    I('Plantillas: <code>team_tactical_presets</code> (jsonb, por <code>team_id</code> + <code>situation</code>). Bloque: <code>match_lineups</code> con <code>source_type = training_session</code> y <code>source_id</code> = id del bloque. Ambas por el BFF (<code>football.ts</code>).')
  );

  // ── Cap. 8 — Consejos ──
  pgs.push(
    chapter(8, 'Consejos para la cancha', 'Resumen',
      '') +
    `<table class="tbl"><tr><th>Quieres…</th><th>Cómo</th></tr>
      <tr><td>Una fila de conos iguales</td><td>Coloca uno, ajusta tamaño y color, selecciónalo y pulsa Duplicar las veces que necesites</td></tr>
      <tr><td>Arco en el otro extremo</td><td>Coloca el Arco, selecciónalo y pulsa +90° dos veces</td></tr>
      <tr><td>Mostrar la jugada al grupo</td><td>Dibuja flechas y recorridos de balón y pulsa Reproducir jugada; se repite las veces que haga falta</td></tr>
      <tr><td>El mismo ejercicio en otra sesión</td><td>Guarda como plantilla; en la otra sesión elige la situación y carga la plantilla</td></tr>
      <tr><td>Borrar solo una figura</td><td>Selecciónala y usa la × o la papelera; Deshacer quita la última que dibujaste</td></tr>
      <tr><td>Se colocó algo sin querer</td><td>Deshacer, o arrastra el objeto a donde va</td></tr></table>` +
    tip('En el celular', 'La pizarra está pensada para usarse con el dedo en la cancha. Los paneles Pizarra y Plantilla se abren y cierran con sus botones para dejar más espacio a la cancha.')
  );

  if (isInternal) {
    pgs.push(
      chapter(9, 'Estado, huecos y cómo se hizo este manual', 'Solo equipo SportMaps — no prometer a la escuela', '') +
      `<table class="tbl"><tr><th>Tema</th><th>Estado 2026-09-25</th></tr>
        <tr><td>F1 (material, tamaño/giro, balón en juego, siluetas, zoom arqueros, 9 colores)</td><td>Commit <code>2b1dc946</code>, en develop, staging y main. Sin migración de datos; solo el CHECK de situación <code>arqueros</code>.</td></tr>
        <tr><td>3D (F2 visor, F3 edición)</td><td><b>No existe.</b> Se hace solo si F1 se usa y con métrica (≥20 aperturas/semana, ≥3 escuelas, ≥5 coaches). Decisión cerrada en <code>docs/specs/pizarra-tactica-material-y-3d.md</code> §6. No vender "todo en 3D".</td></tr>
        <tr><td>Balón que "patea" un jugador</td><td>Cubierto por <code>ball_path</code> saliendo de la posición del jugador; no hay animación de patada como tal.</td></tr>
        <tr><td>Fotos de jugadores en la pizarra</td><td>No, por consentimiento de menores (Carmel). Siluetas genéricas.</td></tr>
        <tr><td>QA en dispositivos</td><td><b>Pendiente.</b> F1 está en producción sin la pasada del checklist <code>docs/qa/pizarra-tactica-f1-checklist.md</code> en Android gama media + iPhone Safari + desktop. Hace falta conseguir los dispositivos.</td></tr>
        <tr><td>Capturas y video</td><td>stg, tenant demo "Club Campestre Demo", owner, equipo "Fútbol — Sub-10" (sin mesociclo; con mesociclo la lista plana se oculta). Sesión sembrada <code>817c0183…</code> con dos bloques. Quedan guardadas la alineación del bloque y la plantilla "Arqueros 1v1" del equipo demo.</td></tr></table>` +
      tip('Regenerar', '<code>BASE_URL=https://stg.sportmaps.co node docs/manuales/_src/pizarra-tactica/capture.mjs</code> y luego <code>node docs/manuales/_src/pizarra-tactica/build.mjs</code> (recortes, PDFs y video mp4/webm con ffmpeg). Para volver a empezar de cero, borrar el <code>match_lineups</code> del bloque y la plantilla demo.')
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
      <h1 class="cover-title">Pizarra táctica</h1>
      <p class="cover-sub">Jugadores, material de entrenamiento con tamaño y giro, colores, líneas, balón en juego, modo arqueros y plantillas: cómo se arma y se guarda una jugada o un ejercicio en SportMaps.</p>
      <div class="pills">
        <span class="pill">Rol: Entrenador · Owner/Admin</span>
        <span class="pill">${isInternal ? '9' : '8'} capítulos</span>
        <span class="pill">Capturas reales del producto</span>
        <span class="pill">Video: docs/manuales/video/pizarra-tactica.mp4</span>
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
  return `<!doctype html><html><head><meta charset="utf-8" /><title>SportMaps — Pizarra táctica (${isInternal ? 'Interno' : 'Academias'})</title><style>${css()}</style></head><body>` +
    cover(isInternal) +
    body.map((pg, i) => `<div class="page">${pg}${foot(i + 2)}</div>`).join('\n') +
    `</body></html>`;
}

function buildVideo() {
  const raw = fs.existsSync(VIDEO_RAW) ? fs.readdirSync(VIDEO_RAW).filter((f) => f.endsWith('.webm')) : [];
  if (raw.length === 0) { console.warn('⚠️  Sin video crudo en video-raw/: se omite el mp4'); return; }
  // El más reciente = la última corrida completa de capture.mjs.
  const src = raw.map((f) => path.join(VIDEO_RAW, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
  fs.mkdirSync(VIDEO_OUT, { recursive: true });
  const mp4 = path.join(VIDEO_OUT, 'pizarra-tactica.mp4');
  const webm = path.join(VIDEO_OUT, 'pizarra-tactica.webm');
  fs.copyFileSync(src, webm);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4], { stdio: 'inherit' });
  console.log(`🎬 ${mp4} (${(fs.statSync(mp4).size / 1e6).toFixed(1)} MB) y ${path.basename(webm)}`);
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
      await page.pdf({ path: `${base}.pdf`, width: '816px', height: '1056px', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
      const n = await page.evaluate(() => document.querySelectorAll('.page').length);
      await page.close();
      console.log(`✅ ${ver}: ${base}.pdf (${n} páginas esperadas)`);
    }
  } finally {
    await browser.close();
  }
  buildVideo();
}

render().catch((e) => { console.error(e); process.exit(1); });
