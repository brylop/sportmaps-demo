// Genera el manual "Mesociclo del mes y sesiones por día" en sus dos versiones
// (interno / academias) como HTML + PDF, con las capturas reales de ./shots/.
//
//   node docs/manuales/_src/mesociclo-mes-siguiente/build.mjs
//
// Antes: capture.mjs (mismo directorio). Sistema visual de todos los manuales
// (memoria feedback_pdf_manual_template, docs/manuales/README.md).

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
const NAME = 'mesociclo-mes-siguiente';
const OUT = {
  academias: path.join(repo, 'docs/manuales/academias', NAME),
  interno: path.join(repo, 'docs/manuales/interno', NAME),
};

// ── Recortes (CSS px; escritorio 1600×1000 @2x, celular 390 @3x) ─────────
const CROP_DEFS = {
  '01-septiembre.png':     { src: '01-septiembre-con-nuevo.png', x: 280, y: 408, w: 856, h: 372, s: 2 },
  '02-nuevo.png':          { src: '02-nuevo-mesociclo.png',      x: 544, y: 142, w: 512, h: 716, s: 2 },
  '04-semana.png':         { src: '04-semana-dias-y-suelta.png', x: 280, y: 408, w: 856, h: 592, s: 2 },
  '05-sesion.png':         { src: '05-crear-sesion-domingo.png', x: 464, y: 88,  w: 672, h: 826, s: 2 },
  '06-resultado.png':      { src: '06-semana-con-sesiones.png',  x: 280, y: 596, w: 856, h: 256, s: 2 },
  '07-selector.png':       { src: '07-selector-abierto.png',     x: 296, y: 424, w: 560, h: 150, s: 2 },
  '08-celular.png':        { src: '08-celular-semana.png',       x: 0,   y: 0,   w: 340, h: 420, s: 3 },
};

async function makeCrops(browser) {
  fs.mkdirSync(CROPS, { recursive: true });
  const page = await browser.newPage();
  for (const [out, d] of Object.entries(CROP_DEFS)) {
    const src = path.join(SHOTS, d.src);
    if (!fs.existsSync(src)) throw new Error(`Falta la captura ${d.src}. Corre capture.mjs primero — este manual no lleva mockups.`);
    const b64 = fs.readFileSync(src).toString('base64');
    const cropped = await page.evaluate(async ([b64, d]) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = d.w * d.s; c.height = d.h * d.s;
      c.getContext('2d').drawImage(img, d.x * d.s, d.y * d.s, d.w * d.s, d.h * d.s, 0, 0, d.w * d.s, d.h * d.s);
      return c.toDataURL('image/png').split(',')[1];
    }, [b64, d]);
    fs.writeFileSync(path.join(CROPS, out), Buffer.from(cropped, 'base64'));
  }
  await page.close();
}

// ── Piezas ────────────────────────────────────────────────────────────────
function img(file, caption, style) {
  const fp = path.join(CROPS, file);
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

/** Texto a la izquierda y captura angosta (un formulario) a la derecha. */
const side = (text, pic) => `<div style="display:flex;gap:22px;align-items:flex-start"><div style="flex:1;min-width:0">${text}</div><div style="flex:none">${pic}</div></div>`;

const ROUTE = 'Menú lateral → Sesiones de Entrenamiento (Métricas y Rendimiento) → elige tu categoría';

// ── Contenido: cada entrada del array es UNA página ───────────────────────
function pages(isInternal) {
  const I = (html) => (isInternal ? internal(html) : '');
  const pgs = [];

  // ── Cap. 1 — Mesociclo del mes siguiente ──
  pgs.push(
    chapter(1, 'Crear el mesociclo del mes siguiente', ROUTE,
      'El mesociclo es el plan del mes de una categoría: fechas, objetivo, modelo de juego y sus 4 semanas. Cuando termina un mes, el del siguiente se crea <b>sin tocar el anterior</b>.') +
    step(1, 'Abre la categoría y pulsa Nuevo mesociclo',
      p('Arriba ves el mesociclo de la categoría con sus fechas y su objetivo. El botón verde <b>Nuevo mesociclo</b> está siempre ahí, aunque la categoría ya tenga el del mes pasado.'),
      crop('01-septiembre.png', 'El mesociclo de septiembre, con el botón Nuevo mesociclo.', 470)) +
    step(2, 'Revisa las fechas y crea', side(
      p('El formulario ya viene con el <b>inicio el día siguiente al cierre del mes anterior</b> y el fin 4 semanas después.') +
      p('También trae el <b>número de sesiones</b>, la <b>duración</b> y el <b>modelo de juego</b> del mes anterior. Escribe el <b>objetivo</b> del mes y pulsa <b>Crear Mesociclo</b>: las 4 semanas se generan solas.'),
      crop('02-nuevo.png', 'Fechas sugeridas y datos del mes anterior.', 228)))
  );
  pgs.push(
I('Antes de <code>4c623e0d</code> (2026-10-02) solo existía "Crear Mesociclo" en el estado vacío: MesocycleSection traía el último mesociclo (<code>limit 1</code>) y con uno ya creado mostraba Editar/Eliminar. Carlos Ruiz (Carmel, 2013-2012-2011) y Besser (INFANTIL FEMENINO) quedaron sin poder crear octubre.') +
    tip('Si la fecha sugerida no te sirve', 'Cámbiala en el calendario. Lo único que no se puede es que un mes se cruce con otro de la misma categoría: si eliges fechas que pisan el mes anterior, la app te avisa y no lo crea.') +
    step(3, 'Ver un mes anterior',
      p('Con más de un mesociclo aparece un <b>selector</b> debajo del título. Por defecto se abre el mes en curso (o el próximo, si todavía no empezó). Desde el selector vuelves al anterior para revisar su cierre o exportar su PDF.'),
      crop('07-selector.png', 'El selector con los dos meses de la categoría.', 560)) +
    warn('Eliminar borra el plan, no las sesiones', '<b>Eliminar</b> quita el mesociclo, sus semanas y la rúbrica. Las sesiones ya creadas no se borran: quedan guardadas y aparecen en "Sesiones sin semana" para volver a ubicarlas.')
  );

  // ── Cap. 2 — Sesiones por día ──
  pgs.push(
    chapter(2, 'Cargar la sesión de cualquier día', ROUTE + ' → Semana',
      'Cada semana muestra <b>todos sus días</b>, también sábados y domingos, cada uno con su botón. No hace falta preparar nada antes.') +
    step(1, 'Busca el día y pulsa Crear sesión',
      p('Abre la semana y busca el día (por ejemplo <b>Dom 4</b>). Pulsa <b>+ Crear sesión</b>.'),
      crop('04-semana.png', 'Semana 1: todos los días con su botón Crear sesión.', 640)) +
    I('Antes la semana listaba solo los días ya cargados ("Sin días cargados en esta semana") y había que pasar por "Agregar día"; con mesociclo además se oculta el botón suelto "Crear Sesión". Así Yohan Casas (arqueros, Carmel) no encontraba cómo cargar el domingo. "+ Crear sesión" crea el día (tipo entrenamiento) y abre el formulario sobre él.')
  );
  pgs.push(
    step(2, 'Llena la sesión y guarda', side(
      p('La <b>fecha</b> ya viene puesta con el día que elegiste.') +
      p('Escribe el <b>objetivo</b> y, si quieres, calentamiento, ejercicios, materiales y notas.') +
      p('Pulsa <b>Crear Sesión</b>.'),
      crop('05-sesion.png', 'La sesión del domingo, con la fecha ya puesta.', 330))) +
    step(3, 'Queda en su día',
      p('El día pasa a <b>Entrenamiento</b> y muestra la sesión debajo. Si ese día entrenas dos veces (gimnasio en la mañana y cancha en la tarde), <b>Agregar otra</b> suma una segunda sesión al mismo día.'),
      crop('06-resultado.png', 'Sábado y domingo con su sesión.', 600)) +
    tip('Partido o descanso', 'Para marcar un día como <b>partido</b>, <b>descanso</b>, <b>regenerativo</b> o <b>activación</b>, con su intensidad planeada, usa <b>Agregar día</b> al final de la semana. Los días de descanso no ofrecen crear sesión.')
  );

  // ── Cap. 3 — Sesiones que no aparecían ──
  pgs.push(
    chapter(3, 'Sesiones que no aparecían: Enganchar', ROUTE + ' → Semana',
      'Si creaste una sesión <b>antes</b> de crear el mesociclo del mes, quedó guardada pero sin día del plan. Ahora aparece en su fecha, en color durazno, con el botón <b>Enganchar</b>.') +
    step(1, 'Pulsa Enganchar',
      p('En la captura del capítulo 2, el sábado 3 tiene la sesión <b>"Técnica de saque y devolución"</b> con <b>Enganchar</b>. Un toque y queda en su día, como cualquier otra (paso 3 del capítulo 2).', 'no-shot')) +
    step(2, 'Sesiones de otro mes',
      p('Las sesiones sueltas que no caen en ninguna semana del mes que estás viendo salen en un recuadro <b>Sesiones sin semana</b>, abajo. Ábrelas para revisarlas o cambiarles la fecha.', 'no-shot')) +
    warn('Revisa antes de enganchar dos el mismo día', 'Si ves dos sesiones sueltas iguales en el mismo día, puede ser la misma sesión guardada dos veces. Ábrelas antes de engancharlas.') +
    I('Al 2026-10-02 había 9 sesiones sueltas dentro de un mesociclo: Carmel 6 (Robert Herrera 2020-21, dom 4 ×2, posible duplicado; Carlos Ruiz sep ×4), Besser 1 (INFANTIL FEMENINO, 22-sep), demo 2. La de Yohan (sáb 3, arqueros) se enganchó por SQL (día <code>2f492af5</code>).')
  );

  // ── Cap. 4 — En el celular ──
  pgs.push(
    chapter(4, 'En el celular', ROUTE,
      'Es la misma pantalla: el mesociclo arriba, con sus botones en dos filas, y debajo cada semana con sus días.') +
    step(1, 'La semana en el celular', side(
      p('Desliza hasta la semana y toca <b>+ Crear sesión</b> en el día.') +
      p('Los días que ya tienen sesión muestran <b>Agregar otra</b>, para una segunda sesión el mismo día.') +
      p('Para cambiar de mes, usa el selector debajo del título del mesociclo, igual que en el computador.'),
      crop('08-celular.png', 'La semana 1 en el celular.', 280))) +
    tip('¿No ves los cambios?', 'Si la pantalla se ve como antes (sin "Nuevo mesociclo" o sin todos los días), cierra la app o la pestaña del navegador y vuelve a abrirla.') +
    I('Las fechas se mostraban un día antes en Colombia (<code>new Date(\'YYYY-MM-DD\')</code> es medianoche UTC): la semana del 3 al 10 se leía "2 oct – 9 oct". Corregido con <code>dayToLocalDate</code> en mesociclos, semanas sueltas, lista de sesiones y resultados.')
  );

  if (isInternal) {
    pgs.push(
      chapter(5, 'Qué se cambió y cómo se hizo este manual', 'Solo equipo SportMaps', '') +
      `<table class="tbl"><tr><th>Tema</th><th>Detalle</th></tr>
        <tr><td>Origen</td><td>Mensaje de Mauricio Rodríguez (Club Carmel), 2026-10-02: "no está disponible el formato de mesociclo de octubre" y "el entrenador de arqueros no puede cargar la sesión del domingo". Ninguno era permisos: 0 fallos en los logs.</td></tr>
        <tr><td>Código</td><td><code>4c623e0d</code> — <code>MesocycleSection.tsx</code>, <code>MesocycleFormDialog.tsx</code>, lógica pura en <code>lib/school/mesocyclePlanning.ts</code> (13 tests). En producción el mismo día (main <code>7fe05ec5</code>). Sin migraciones.</td></tr>
        <tr><td>Escuelas</td><td>Aplica a todas. Pedido explícito: Carmel y Besser.</td></tr>
        <tr><td>Capturas</td><td>stg, tenant demo "Club Campestre Demo", coach de tenis, "Tenis — Adultos". Quedaron en el demo: el mesociclo de octubre (2 → 29 oct), la sesión del sábado 3 (sembrada por SQL y enganchada) y la del domingo 4. Se cambió el objetivo del de septiembre, que era un texto de prueba.</td></tr></table>` +
      warn('No prometer', 'No hay copia automática de sesiones de un mes al otro (sí "Duplicar semana anterior" para los días). La rúbrica "Por atleta" sigue deshabilitada.') +
      tip('Regenerar', '<code>BASE_URL=https://stg.sportmaps.co node docs/manuales/_src/mesociclo-mes-siguiente/capture.mjs</code> (con <code>ONLY=01,08</code> rehace solo esas) y luego <code>node docs/manuales/_src/mesociclo-mes-siguiente/build.mjs</code>.')
    );
  }
  return pgs;
}

// ── Documento ─────────────────────────────────────────────────────────────
function cover(isInternal) {
  return `<div class="page cover"><div class="cover-inner">
    <div><div class="logo"><span class="pin"></span>SportMaps</div></div>
    <div>
      <div class="cover-eyebrow"><span class="dot" style="background:${isInternal ? '#ff8833' : '#4fd17a'}"></span>${isInternal ? '🔒 Uso interno — no enviar a escuelas' : 'Guía de uso · Entrenadores'}</div>
      <h1 class="cover-title">Mesociclo del mes y sesiones por día</h1>
      <p class="cover-sub">Cómo crear el mesociclo del mes siguiente sin perder el anterior, cargar la sesión de cualquier día de la semana —también fines de semana— y recuperar sesiones que no aparecían.</p>
      <div class="pills">
        <span class="pill">Rol: Entrenador</span>
        <span class="pill">${isInternal ? '5' : '4'} capítulos</span>
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
  return `<!doctype html><html><head><meta charset="utf-8" /><title>SportMaps — Mesociclo del mes y sesiones por día (${isInternal ? 'Interno' : 'Academias'})</title><style>${css()}</style></head><body>` +
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
