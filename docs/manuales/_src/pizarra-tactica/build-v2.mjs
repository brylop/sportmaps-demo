// Genera el manual "Pizarra táctica" v2 (M0–M6) en sus dos versiones (interno / academias)
// como HTML + PDF con las capturas reales de ./shots-v2/ (las toma capture-v2.mjs).
//
//   node docs/manuales/_src/pizarra-tactica/build-v2.mjs
//
// Sustituye a build.mjs (que cubría solo F1: material, siluetas, balón, arqueros).
// Sistema visual: el de todos los manuales (manual.css; memoria feedback_pdf_manual_template).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../..');
const require = createRequire(path.join(repo, 'frontend', 'package.json'));
const { chromium } = require('playwright');

const SHOTS = path.join(here, 'shots-v2');
const CROPS = path.join(SHOTS, 'crops');
const OUT = {
  academias: path.join(repo, 'docs/manuales/academias/pizarra-tactica'),
  interno: path.join(repo, 'docs/manuales/interno/pizarra-tactica'),
};

// ── Recortes en CSS px del viewport de captura (vw = ancho del viewport; la escala se deduce) ──
const C = (src, x, y, w, h, vw = 1600) => ({ src, x, y, w, h, vw });
const CROP_DEFS = {
  'sesion': C('01-sesion.png', 300, 580, 815, 315),
  'tablero': C('12-cuadros.png', 0, 0, 1600, 1000),
  'tb-izq': C('12-cuadros.png', 0, 0, 820, 46),
  'tb-der': C('12-cuadros.png', 760, 0, 840, 46),
  'galeria': C('03-galeria.png', 350, 0, 900, 545),
  'galeria-rival': C('04-galeria-rival.png', 350, 0, 900, 545),
  'espejo': C('05-formaciones-aplicadas.png', 500, 150, 600, 680),
  'jugadores': C('06-jugadores.png', 1330, 50, 270, 330),
  'panel1': C('07-panel-dibujar.png', 0, 60, 255, 640),
  'panel2': C('07-panel-dibujar.png', 0, 700, 255, 780),
  'lineas': C('08-lineas.png', 630, 400, 595, 680),
  'obj-panel': C('09-material-objeto.png', 0, 1300, 255, 190),
  'obj-cancha': C('09-material-objeto.png', 740, 640, 220, 140),
  'campo': C('10-campo.png', 460, 72, 680, 856),
  'campo-aplicado': C('11-campo-aplicado.png', 500, 190, 600, 640),
  'timeline': C('12-cuadros.png', 0, 850, 800, 150),
  'reproduciendo': C('13-reproduciendo.png', 500, 120, 600, 680),
  'equipos': C('14-equipos.png', 350, 100, 900, 1050),
  'almacenados': C('15-equipos-almacenados.png', 830, 850, 420, 190),
  'notas': C('16-notas.png', 460, 135, 680, 735),
  'videos': C('17-videos-youtube.png', 350, 95, 900, 815),
  'videos-subir': C('18-videos-subir.png', 350, 310, 900, 380),
  'mas': C('19-mas.png', 560, 0, 520, 500),
  'ajustes': C('20-ajustes.png', 570, 96, 460, 810),
  'exportar-menu': C('21-exportar-menu.png', 900, 0, 700, 250),
  'ia': C('22-ia-panel.png', 1215, 55, 385, 290),
  'guardar-bib': C('39-guardar-biblioteca.png', 510, 210, 580, 830),
  'bib-plantillas': C('36-biblioteca-plantillas.png', 410, 0, 780, 560),
  'bib-escuela': C('37-biblioteca-escuela.png', 410, 255, 780, 590),
  'bib-paquetes': C('38-biblioteca-paquetes.png', 410, 130, 780, 840),
  '3d-tv': C('23-3d-tv.png', 0, 0, 1600, 1000),
  '3d-cenital': C('24-3d-cenital.png', 0, 0, 1600, 1000),
  '3d-iso': C('25-3d-iso.png', 0, 0, 1600, 1000),
  '3d-spider': C('26-3d-spider.png', 0, 0, 1600, 1000),
  '3d-director': C('27-3d-director.png', 0, 0, 1600, 1000),
  '3d-volver': C('28-volver-2d.png', 0, 0, 1600, 1000),
  '3d-voleibol': C('31-3d-voleibol.png', 0, 56, 1600, 944),
  '3d-baloncesto': C('32-3d-baloncesto.png', 0, 56, 1600, 944),
  '3d-detras': C('33-3d-detras.png', 0, 56, 1600, 944),
  'movil': C('29-movil-tablero.png', 0, 0, 390, 844, 390),
  'movil-mas': C('30-movil-mas.png', 0, 0, 390, 844, 390),
  'export-png': C('export-jugada.png', 0, 0, 1080, 1316, 1080),
  'export-ficha': C('export-ficha-1.png', 0, 0, 909, 800, 909),
};

async function makeCrops(browser) {
  fs.mkdirSync(CROPS, { recursive: true });
  const page = await browser.newPage();
  for (const [out, def] of Object.entries(CROP_DEFS)) {
    const src = path.join(SHOTS, def.src);
    if (!fs.existsSync(src)) throw new Error(`Falta la captura ${def.src}. Corre capture-v2.mjs — este manual no lleva mockups.`);
    const b64 = fs.readFileSync(src).toString('base64');
    const cropped = await page.evaluate(async ([b64, d]) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const s = img.naturalWidth / d.vw;
      const c = document.createElement('canvas');
      c.width = Math.round(d.w * s); c.height = Math.round(d.h * s);
      c.getContext('2d').drawImage(img, d.x * s, d.y * s, d.w * s, d.h * s, 0, 0, c.width, c.height);
      return c.toDataURL('image/png').split(',')[1];
    }, [b64, def]);
    fs.writeFileSync(path.join(CROPS, out + '.png'), Buffer.from(cropped, 'base64'));
  }
  await page.close();
}

// ── Piezas ─────────────────────────────────────────────────────────────────
const crop = (name, caption, width) => {
  const fp = path.join(CROPS, name + '.png');
  if (!fs.existsSync(fp)) throw new Error(`Falta el recorte ${name}`);
  const b64 = fs.readFileSync(fp).toString('base64');
  return `<div class="shot-wrap"><img class="shot" style="width:${width}px;max-height:none" src="data:image/png;base64,${b64}" alt="${caption}"/>` +
    (caption ? `<div class="shot-caption">${caption}</div>` : '') + `</div>`;
};
const keep = (...items) => `<div class="keep">${items.join('')}</div>`;
const row = (...items) => `<div style="display:flex;gap:14px;align-items:flex-start;justify-content:center">${items.join('')}</div>`;
const col = (html, w) => `<div style="flex:1;min-width:0${w ? `;max-width:${w}px` : ''}">${html}</div>`;
const step = (n, title, body, pic = '') =>
  `<div class="step"><div class="step-head"><div class="step-badge">${n}</div><div class="step-title">${title}</div></div>${body}${pic}</div>`;
const p = (html, cls = '') => `<p${cls ? ` class="${cls}"` : ''}>${html}</p>`;
const ul = (items) => `<ul class="bl">${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
const warn = (tag, html) => `<div class="callout warn"><span class="tag">${tag}</span>${html}</div>`;
const tip = (tag, html) => `<div class="callout tip"><span class="tag">${tag}</span>${html}</div>`;
const internal = (html) => `<div class="callout internal"><span class="tag">🔒 Interno — no prometer</span>${html}</div>`;
const chapter = (n, title, crumb, intro) =>
  `<div class="chapter-head"><div class="chapter-badge">${n}</div><h2 class="chapter-title">${title}</h2></div>` +
  `<div class="breadcrumb">${crumb}</div><hr class="chapter-rule" />${intro ? p(intro) : ''}`;
const table = (head, rows) => `<table class="tbl"><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`;

// ── Contenido: cada entrada del array es UNA página ────────────────────────
function pages(isInternal) {
  const I = (html) => (isInternal ? internal(html) : '');
  const pgs = [];
  let cap = 0;
  const nextCap = () => ++cap;

  // ── 1 · Qué es y quién la ve ──
  pgs.push(
    chapter(nextCap(), 'Qué es y quién la ve', 'Métricas y Rendimiento → equipo → sesión → bloque → «Tablero táctico»',
      'La pizarra táctica es donde el entrenador arma una jugada o un ejercicio: pone a su equipo y al rival en una formación, dibuja recorridos, la anima por cuadros, la mira en 3D, la guarda en su biblioteca y la comparte. Vive <b>dentro de cada bloque de una sesión</b>: lo que armas queda guardado con ese bloque.') +
    step(1, 'Abrir el tablero',
      p('En <b>Métricas y Rendimiento</b> elige el equipo. En la sesión, junto a cada bloque (calentamiento, parte situacional, arqueros…), está el botón <b>Tablero táctico</b>. Si el equipo tiene mesociclo activo, la sesión se abre desde su día.'),
      crop('sesion', 'La sesión con sus bloques; cada uno con su botón Tablero táctico.', 640)) +
    step(2, 'Cada deporte, su pizarra',
      p('La pizarra se abre según el <b>deporte del equipo</b>, y cada escuela ve solo lo de sus equipos: una escuela de fútbol no ve plantillas ni formaciones de voleibol.'),
      table(['Nivel', 'Deportes', 'Qué trae'], [
        ['<b>Pizarra completa</b>', 'Fútbol 11, fútbol 7, fútbol 5, fútbol sala, voleibol, baloncesto y balonmano', 'Cancha reglamentaria, formaciones propias del deporte, material, biblioteca de ejercicios y paquetes, 3D y análisis con IA'],
        ['<b>Pizarra de cancha</b>', 'Rugby, fútbol americano, tenis, pádel, bádminton, vóley playa, hockey sobre césped, hockey sobre patines, netball, waterpolo y ultimate', 'Su cancha con medidas oficiales y posiciones de arranque; dibujo, material, cuadros, exportar y 3D'],
        ['<b>Sin pizarra</b>', 'Natación, gimnasia, karate, golf, boxeo, atletismo, cheerleading y similares', 'El botón no aparece; siguen con sesiones, asistencia y métricas'],
      ])) +
    I('Fuente única: <code>lib/sports/sportCatalog.ts</code> (<code>resolveSport</code> normaliza tildes y sinónimos; lo que no reconoce queda sin pizarra y no se adivina). La IA y la biblioteca (<code>EXERCISE_SPORTS</code>) son solo de «pizarra completa»; el nivel «cancha» abre la pizarra pero no la biblioteca. El demo «Club Campestre» tiene pizarra en fútbol, voleibol, baloncesto, tenis y pádel; golf, natación y gimnasio no la muestran.')
  );

  // ── 2 · Recorrido ──
  pgs.push(
    chapter(nextCap(), 'Recorrido por el tablero', 'Tablero táctico (pantalla completa)',
      'El tablero abre a pantalla completa: arriba la barra de herramientas, en el centro la cancha, abajo la línea de tiempo de cuadros. Los paneles de <b>Jugadores</b> (derecha) y <b>Dibujar</b> (izquierda) se abren y cierran con sus botones para dejar más espacio a la cancha.') +
    crop('tablero', 'Tablero con la formación 4-3-3 aplicada: círculos punteados donde van los jugadores y línea de tiempo abajo.', 640) +
    crop('tb-izq', '', 640) + crop('tb-der', 'La barra superior, en dos mitades.', 640) +
    table(['Botón', 'Para qué sirve'], [
      ['<b>Formación</b>', 'Galería de formaciones para tu equipo y para el rival (muestra el nombre de la formación puesta)'],
      ['<b>Jugadores (n)</b>', 'Plantilla del equipo: arrastrar a la cancha o pasar a la banca; Sugerir XI'],
      ['<b>Dibujar (n)</b>', 'Lápiz, texto, líneas, balón en juego, zonas, foco, material, colores, deshacer. «n» es la cantidad de figuras'],
      ['<b>Equipos</b> · <b>Material</b>', 'Nombre, escudo, colores y ficha de los dos equipos · atajo al material dentro del panel Dibujar'],
      ['<b>Notas</b> · <b>Videos</b>', 'Texto y etiquetas de la jugada y de cada cuadro · videos por enlace'],
      ['<b>Más</b>', 'Situación, Mis jugadas, guardar en biblioteca, Campo y opciones de vista'],
      ['<b>Analizar jugada</b> · <b>Ajustes</b>', 'IA que lee la jugada · preferencias de animación, rastros y tema'],
      ['<b>Exportar</b> · <b>Ver en 3D</b>', 'PNG, PDF, video o GIF, WhatsApp · visor 3D de la misma jugada'],
      ['<b>Cancelar</b> · <b>Guardar jugada</b>', 'Salir sin guardar · dejar la jugada guardada en este bloque'],
    ]) +
    I('<code>TacticalBoard.tsx</code> (~4.000 líneas) es el único contenedor; cada bloque M6 vive en su componente (<code>TacticalDrawToolsPanel</code>, <code>TacticalTeamsDialog</code>, <code>TacticalCourtDialog</code>, <code>TacticalTimeline</code>, <code>TacticalExportMenu</code>, <code>TacticalAiPanel</code>, <code>tactical3d/</code>, <code>tacticalMedia/</code>). Escape cierra TODO el tablero (no solo el diálogo abierto): lo comprobé en la captura. «Guardar jugada» guarda en <code>match_lineups</code> con <code>source_type = training_session</code>.')
  );

  // ── 3 · Formaciones y jugadores ──
  pgs.push(
    chapter(nextCap(), 'Formaciones: tu equipo y el rival', 'Barra superior → Formación',
      'Cada deporte trae su catálogo de formaciones con miniatura. Elige para quién es la formación y toca la tarjeta.') +
    step(1, 'La galería de formaciones',
      p('En fútbol hay <b>38 formaciones</b> agrupadas en Clásicas, Modernas, Defensivas, Ofensivas, Históricas y Fútbol 7, con buscador (escribe «433» o «rombo») y filtro por 11 o 7 jugadores. Voleibol trae las rotaciones R1–R6 de 5-1, 4-2 y 6-2 en recepción y defensa; baloncesto, defensas en zona, presiones y ataques; balonmano, sus defensas y ataques.'),
      crop('galeria', 'Pestaña «Mi equipo»: toca una tarjeta y se arma la formación.', 520)) +
    step(2, 'Rival en espejo',
      p('En la pestaña <b>Rival</b> la misma galería pone al contrario en espejo en la mitad de arriba, con fichas rojas «R». Elegir otra formación de rival reemplaza al anterior, y <b>Quitar rival</b> lo borra.'),
      crop('galeria-rival', 'Pestaña «Rival»: el aviso explica dónde queda el contrario.', 520))
  );
  pgs.push(
    step(3, 'Poner a los jugadores',
      p('Al elegir una formación aparecen <b>círculos punteados con el nombre del puesto</b> (Lateral izq., Volante, Delantero…). Abre <b>Jugadores</b> y arrastra a cada deportista a su círculo; la <b>×</b> roja lo devuelve a la plantilla. El panel separa <b>Disponibles</b> y <b>Banca</b>, y <b>Sugerir XI</b> arma un once por minutos jugados cuando el equipo tiene partidos registrados (solo funciona con la cancha vacía).'),
      row(crop('espejo', 'Nuestro 4-3-3 y el rival 4-4-2 en espejo.', 330), crop('jugadores', 'Panel Jugadores.', 250))) +
    step(4, 'Discos, siluetas y fotos',
      p('En <b>Más → Vista</b> puedes ver los jugadores como <b>siluetas</b> (el arquero sale con camiseta amarilla) y activar <b>Zonas de la cancha</b>. La opción <b>Fotos de los jugadores</b> está pensada solo para cuando los padres autorizaron el uso de la imagen; viene apagada y es una preferencia de tu pantalla. El estilo de la ficha (disco, camiseta, rayas, silueta) se elige en <b>Equipos</b>.')) +
    tip('Arrastrar o tocar', 'En el celular los círculos punteados se llenan igual arrastrando desde Jugadores; un toque sobre una ficha ya puesta abre su tarjeta del deportista.') +
    I('Catálogos: fútbol 11 en <code>lib/school/tacticalFormations.ts</code> (las formaciones viejas conservan clave y coordenadas: <code>fixtures/formacionesHistoricas.json</code>), el resto en <code>tacticalSports.ts</code>. Rival = figuras <code>opponent</code> en el jsonb <code>arrows</code>. «Sugerir XI» usa minutos jugados, no la posición real (el propio panel lo avisa). <b>Fotos:</b> la advertencia «solo si los padres autorizaron» es texto; en el código del tablero no encontré ningún chequeo de consentimiento por menor: si la ficha del deportista tiene foto y el coach activa la opción, se muestra. No vender «fotos con consentimiento verificado».')
  );

  // ── 4 · Dibujar ──
  pgs.push(
    chapter(nextCap(), 'Dibujar: líneas, zonas, foco y números', 'Barra superior → Dibujar (panel izquierdo)',
      'El panel <b>Dibujar</b> reúne todo lo que se traza sobre la cancha. Activa <b>Modo dibujo</b> y arrastra sobre la cancha; las figuras ya puestas se ajustan (puntos blancos) o se borran sin necesidad de este modo.') +
    row(
      crop('panel1', 'Escribir, líneas, balón en juego, tipo de línea y zonas.', 220),
      crop('panel2', 'Material, color, tamaño y giro, deshacer y regla.', 220)
    ) +
    table(['Sección del panel', 'Qué hace'], [
      ['<b>Escribir</b>', '<b>Lápiz</b> para rayar libre con el dedo o el lápiz, <b>Texto</b> para escribir sobre la cancha y <b>Borrador</b>'],
      ['<b>Líneas</b>', '<b>Flecha</b> (recta), <b>Curva</b> y <b>Zona</b>'],
      ['<b>Balón en juego</b>', '<b>Pase</b>, <b>Remate</b> y <b>Penal</b>: arrastra desde donde sale el balón hasta donde llega'],
      ['<b>Tipo de línea</b> (flecha y curva)', '<b>Clásica</b>, <b>Pase</b> (discontinua con flecha), <b>Conducción</b> (ondulada, con el balón en los pies), <b>Carrera sin balón</b> (continua, desmarque) y <b>Disparo</b> (doble y gruesa). La <b>leyenda</b> aparece sola en la cancha y en lo que exportes, con solo los tipos usados'],
      ['<b>Zonas</b>', '<b>Rectángulo</b>, <b>Elipse</b> y <b>Polígono</b>, con relleno translúcido (deslizador «Relleno de la zona») y color. El centro de la zona deja arrastrar al jugador que haya debajo'],
    ]) + 
    I('Tipos de línea y zonas viajan como campos opcionales del jsonb <code>arrows</code> (<code>line</code>, <code>form</code>, <code>fill</code>, <code>seq</code>), validados en <code>bff/src/routes/school/footballShapes.ts</code>; sin migración. Una jugada vieja se ve idéntica (<code>tacticalM6dCompat.test.tsx</code>). Grosor fijo por estilo: no hay slider.')
  );
  pgs.push(
    step(1, 'Un ejemplo completo',
      p('Un pase, una conducción, una carrera sin balón y un disparo, numerados 1–4, más una zona elíptica. Con <b>Numerar</b> activo cada flecha nueva lleva su número; <b>Renumerar</b> los deja 1, 2, 3… en el orden en que se dibujaron.'),
      row(crop('lineas', 'Los cuatro tipos de línea, numerados, con su leyenda abajo a la izquierda.', 360),
        col(
          p('<b>Resaltar jugador</b> pone un anillo de foco con resplandor sobre el jugador que toques, con tamaño y color.') +
          p('<b>Color.</b> Nueve colores para líneas, zonas y material: blanco, amarillo, rojo, azul, verde, naranja, morado, rosado y negro. Zonas de distinto color, distintas consignas.') +
          p('<b>Deshacer y Rehacer</b> (también Ctrl+Z y Ctrl+Shift+Z) recorren los cambios; <b>Borrar todo</b> pide confirmación y no toca a los jugadores.') +
          p('<b>Regla.</b> Toca dos puntos de la cancha y mide la distancia en metros, a partir del largo de cancha que escribas (90 m por defecto).')
        )
      )) +
    tip('Reproducir jugada', 'El botón <b>Reproducir jugada</b> (arriba del panel) anima a cada jugador hasta la punta de su flecha o curva y lo devuelve; el balón recorre su línea y en remate y penal se eleva. Se repite las veces que haga falta.') +
    I('El foco es una figura por cuadro: <b>no sigue al jugador</b> en la animación. No hay líneas que unan jugadores y los acompañen al moverse (línea defensiva, triángulos): candidato a M7.')
  );

  // ── 5 · Material ──
  pgs.push(
    chapter(nextCap(), 'Material de entrenamiento', 'Barra superior → Material (o Dibujar → Material)',
      'Once objetos: <b>cono, plato, balón, arco, arco chico, vallita, aro, escalera, estaca, maniquí y rival</b>. Elige uno y toca la cancha una vez por cada objeto que quieras poner; arrástralo para moverlo.') +
    step(1, 'Seleccionar, tamaño, giro y duplicar',
      p('Tocar un objeto ya puesto lo <b>selecciona</b> (nunca lo borra): aparece un marco punteado, un punto verde para girarlo con el dedo y una × para quitarlo. En el panel, <b>Tamaño</b> (0,5× a 3×) y <b>Giro</b> cambian ese objeto; <b>+90°</b> gira en cuartos y <b>Duplicar</b> copia el objeto con su tamaño, giro y color, un poco desplazado. El icono de papelera lo quita.'),
      row(crop('obj-cancha', 'Cono seleccionado.', 230), crop('obj-panel', 'Tamaño, giro, +90°, Duplicar y quitar.', 260))) +
    tip('Sin nada seleccionado', 'Los mismos deslizadores fijan el tamaño y el giro con que se colocan los objetos <b>nuevos</b>; los ya puestos no cambian. Para una fila de conos iguales: coloca uno, ajústalo, selecciónalo y pulsa Duplicar las veces que necesites. Para el arco del otro lado, +90° dos veces.') +
    warn('Tocar no borra', 'Borrar es siempre explícito: la × del objeto seleccionado, la papelera del panel o <b>Borrar todo</b> (que pregunta antes). Si algo se quita sin querer, usa Deshacer.') +
    I('El panel Dibujar muestra «Material» aunque el deporte no use todos los objetos; el catálogo es el mismo en todos los deportes (<code>OBJECT_TYPES</code>). Tamaño validado en el BFF entre 0,25 y 4. No hay selección múltiple ni papelera para restaurar; el orden de capas es el de creación.')
  );

  // ── 6 · Campo ──
  pgs.push(
    chapter(nextCap(), 'Campo: líneas de ayuda, cámara y piso', 'Barra superior → Más → Campo…',
      'El diálogo <b>Campo</b> cambia cómo se ve la cancha. Se guarda con la jugada y sale igual en el PDF, la imagen y el video. Las posiciones no cambian: siempre se guardan sobre la cancha completa.') +
    row(
      crop('campo', 'Plantillas de líneas, cámara, piso y colores.', 330),
      col(
        p('<b>Plantillas de líneas</b>, con miniatura: cancha completa, media cancha, 5 carriles, 3 tercios, carriles + tercios, half-spaces, juego de posición (20 zonas), área grande + líneas, diagonales, cuadrículas 2×2, 3×3 y 4×3, sin líneas y rondos (círculo, triángulo, hexágono y cuadrado). Carriles, half-spaces y juego de posición son solo para fútbol. <b>Incluyendo porterías</b> agrega un arco en cada fondo de los lienzos de ejercicio.') +
        p('<b>Cámara:</b> cancha completa, media cancha (arco abajo o arriba), 3/4 de cancha y área (arqueros). La opción <b>Horizontal</b> aplica a la imagen, el PDF, el GIF, el video y las miniaturas; para editar, la pizarra queda vertical.') +
        p('<b>Piso y colores:</b> el del deporte, césped a rayas o liso, sintética, piso de madera, piso azul (indoor) y pizarra blanca para imprimir sin gastar tinta; además colores de césped, líneas y contorno. <b>Cancha de siempre</b> deshace todo.')
      )
    ) +
    crop('campo-aplicado', 'Ejemplo: plantilla «5 carriles» con césped liso.', 300) +
    I('El zoom de arqueros de antes (<code>GK_VIEW</code>) ahora es una cámara más («Área (arqueros)») y sigue existiendo el atajo «Zoom al área (arqueros)» en Más → Vista. Se guarda como una pseudo-figura <code>type: court</code> (una por jugada) en <code>arrows</code>: un cliente viejo que no recargue la dibujaría como un punto en la esquina (0,0) hasta recargar. No se puede subir una imagen propia de fondo (decisión: no almacenar archivos de usuarios).')
  );

  // ── 7 · Cuadros ──
  pgs.push(
    chapter(nextCap(), 'Animación por cuadros', 'Línea de tiempo (abajo del tablero)',
      'Una jugada puede tener hasta <b>30 cuadros</b>. Cada cuadro guarda las posiciones de los jugadores, el balón y las figuras; al reproducir, todo se mueve con suavidad de un cuadro al siguiente.') +
    step(1, 'Agregar y mover cuadros',
      p('El botón <b>+ Cuadro</b> copia el cuadro actual: mueve a los jugadores en el nuevo para marcar el siguiente momento. Toca la miniatura de un cuadro para editarlo. Con dos o más cuadros aparecen los controles de abajo: mover el cuadro a izquierda o derecha, <b>Tiempo</b> para llegar a ese cuadro (de 0,5 a 5 segundos), quitar el cuadro, velocidad <b>0,5×, 1× o 2×</b> y <b>Repetir</b>.'),
      crop('timeline', 'Tres cuadros, con sus controles de tiempo, velocidad y repetición.', 640)) +
    step(2, 'Reproducir',
      p('El botón de reproducir de la izquierda recorre los cuadros; la barra de avance permite saltar a cualquier momento. Mientras reproduce, el tablero no se edita ni se guarda.'),
      row(crop('reproduciendo', 'A mitad de la reproducción.', 300),
        col(
          p('<b>Deshacer y rehacer</b> funcionan también entre cuadros (Ctrl+Z, Ctrl+Shift+Z).') +
          p('En <b>Ajustes</b> eliges la curva de velocidad (suave, lineal, rápida al inicio o al final), si se ven los rastros de cada jugador y del balón, y la <b>posesión del balón</b>: en cada cuadro eliges quién lo tiene, se mueve con él y se dibuja el pase.')
        ))) +
    I('No hay «copiar/pegar grupo de figuras» entre cuadros: la spec T1 lo menciona pero no lo encontré en la interfaz. Lo que existe: <b>+ Cuadro</b> (copia el cuadro completo), <b>Duplicar</b> (un objeto) y deshacer/rehacer. El máximo de 30 cuadros es <code>MAX_FRAMES</code>.')
  );

  // ── 8 · Equipos y rivales ──
  pgs.push(
    chapter(nextCap(), 'Equipos y rivales guardados', 'Barra superior → Equipos (en celular: Más → Equipos)',
      'Define cómo se ven tus jugadores y los del rival en la cancha, en el 3D y al exportar. A la izquierda va <b>tu equipo</b>; a la derecha, el <b>rival</b>.') +
    row(
      crop('equipos', 'Configuración de los equipos.', 400),
      col(
        p('<b>Nombre y escudo.</b> El tuyo puede usar el logo de la escuela; el rival lleva un escudo con sus iniciales.') +
        p('<b>Colores:</b> principal, secundario y del número. Si el número no se lee sobre el color, el sistema avisa y lo pasa a blanco o negro en la cancha.') +
        p('<b>Estilo de ficha:</b> disco con número, camiseta lisa, rayas verticales, rayas horizontales o silueta. Eliges qué va <b>dentro</b> de la ficha (número, iniciales o nada) y qué va <b>debajo</b> (posición, número, iniciales, nombre o nada; en el rival, alias).') +
        p('<b>Portero con otra apariencia</b>, con sus propios colores.') +
        p('<b>Tamaño</b> de los jugadores y del material (en %), y <b>Mostrar nombres al exportar</b>, apagado de entrada: salen número y posición porque son menores de edad. <b>Volver al aspecto de siempre</b> restablece todo.')
      )
    ) +
    step(1, 'Guardar y reutilizar rivales',
      p('Con <b>Guardar este rival</b> el contrario queda en la escuela con su nombre, colores, escudo y plantilla. <b>Equipos almacenados</b> los lista; elegir uno copia su nombre, colores, escudo y plantilla a la jugada. La <b>plantilla del rival</b> lleva solo número y alias.'),
      crop('almacenados', 'Rivales guardados de la escuela.', 420)) +
    I('Tabla <code>tactical_rival_teams</code> (por escuela). La plantilla del rival nunca guarda datos de menores de otra escuela: solo número y alias. En el demo no hay rivales guardados (la captura muestra «Aún no hay rivales guardados»); NO guardé uno para no dejar datos. En celular «Equipos» no está en la barra: vive en Más.')
  );

  // ── 9 · Notas y videos ──
  pgs.push(
    chapter(nextCap(), 'Notas y videos', 'Barra superior → Notas · Videos',
      'Cada jugada puede llevar texto, etiquetas y videos de apoyo. Las etiquetas sirven para encontrarla después en la biblioteca y en Mis jugadas.') +
    row(
      crop('notas', 'Notas de la jugada, con etiquetas.', 330),
      col(
        p('<b>Nota de la jugada.</b> Hasta 2.000 caracteres, con <b>negrita</b> (**texto**) y listas (un guion al comienzo de la línea); <b>Vista previa</b> muestra cómo queda.') +
        p('<b>Etiquetas.</b> De <b>fase de juego</b> (ataque organizado, defensa organizada, transición ofensiva, transición defensiva, balón parado) y de <b>objetivo</b> (posesión, salida de balón, presión, finalización, contraataque, marcaje, juego aéreo, rondo, conducción, calentamiento), más las que agregues con «Otra etiqueta».') +
        p('<b>Nota del cuadro.</b> En jugadas animadas, cada cuadro tiene su propia nota corta (hasta 280 caracteres) que se ve al pasar por él.')
      )
    ) +
    step(1, 'Videos por enlace',
      p('Pega el enlace de <b>YouTube</b> o <b>Vimeo</b> y se ve la vista previa dentro de la pizarra. También se aceptan enlaces de cámaras deportivas (Veo, Hudl, Trace, Pixellot, Spiideo, XbotGo, Reeplayer), Google Drive y Dropbox: esos se muestran como una tarjeta <b>«Ver en …»</b> que abre el video en otra pestaña. Agrega título y, si quieres, minuto de inicio y de fin.'),
      crop('videos', 'Vista previa de un enlace de YouTube y datos del video.', 520))
  );
  pgs.push(
    p('Hasta <b>10 videos por jugada</b>. Marca <b>Enlace privado</b> si no debe salir en el PDF ni en los paquetes que exportes, y deja activa <b>Guardar también en Videos guardados</b> para reutilizarlo en otras jugadas de la escuela. Las notas y los videos públicos salen en la ficha PDF de la jugada.') +
    tip('Sin archivos', 'Los videos se agregan por enlace: SportMaps no almacena el archivo, así que no ocupa espacio de tu escuela.') +
    (isInternal ? internal('<b>Videos subidos desde el celular, Veo o Hudl: detrás de un flag APAGADO.</b> En la pestaña «Subir» del diálogo Videos hoy se ve «Disponible pronto — Muy pronto podrás subir los videos del celular o de Veo y recortar las jugadas aquí. Mientras tanto, pega el enlace»; <b>la pestaña es visible para las escuelas</b> aunque no funcione (lo comprobé en dev). Diseño en <code>docs/specs/pizarra-m6h-videos-subidos.md</code>: subida directa a Bunny Stream, migración <code>20261015145434</code> escrita y SIN aplicar, sin llaves del proveedor. No prometer subida de videos ni «recortar jugadas». Mientras el flag siga apagado conviene decidir si se oculta la pestaña.') + crop('videos-subir', 'Pestaña «Subir» con el flag apagado (solo interno).', 520) : '') +
    I('Proveedores válidos (CHECK): youtube, vimeo, veo, hudl, trace, pixellot, spiideo, xbotgo, reeplayer, drive, dropbox, sportmaps. Solo YouTube (<code>youtube-nocookie</code>) y Vimeo se incrustan en iframe; el resto es tarjeta con <code>rel="noopener noreferrer"</code>. La captura de este manual usa un video público de muestra de YouTube.')
  );

  // ── 10 · Biblioteca, paquetes y plantillas ──
  pgs.push(
    chapter(nextCap(), 'Biblioteca de ejercicios, paquetes y Mis jugadas', 'Más → Guardar… · Sesión → Editar → «Desde la biblioteca»',
      'Una jugada buena se guarda para usarla otra vez, en el mismo equipo o en otro.') +
    step(1, 'Guardar',
      p('En <b>Más</b> hay dos formas. <b>Guardar en Mis jugadas…</b> guarda la disposición con un nombre, por situación (Ataque, Defensa, Presión, Transición, Córner, Tiro libre, Penalti o Arqueros), y luego la cargas desde el mismo menú; con una cargada puedes actualizarla o eliminarla. <b>Guardar en biblioteca…</b> la convierte en un ejercicio de la escuela, con objetivo, duración, edad, material, etiquetas y descripción. Se guarda con los <b>puestos</b>, sin los nombres de los jugadores, para usarla con cualquier equipo.'),
      row(crop('mas', 'Menú Más.', 250), crop('guardar-bib', 'Guardar en biblioteca.', 330))) +
    I('Mis jugadas = <code>team_tactical_presets</code> (por equipo y situación; cambiar de situación vacía las figuras). La biblioteca = <code>training_exercises</code>; <code>boardFromPitch()</code> guarda puestos y posiciones, nunca atletas. Mis jugadas del demo: vacío (no guardé nada).')
  );
  pgs.push(
    step(2, 'Usar un ejercicio en la sesión',
      p('En la sesión, <b>Editar</b> → en el bloque, <b>Desde la biblioteca</b>. Hay tres pestañas: <b>Plantillas SportMaps</b> (ejercicios listos con su jugada), <b>De mi escuela</b> (los que guardaste) y <b>Paquetes</b>. Busca por texto, filtra por deporte y por objetivo, mira el ejercicio con <b>Ver</b> y pulsa <b>Usar en esta sesión</b>: el bloque queda con la jugada, y de ahí se edita en la pizarra.'),
      crop('bib-plantillas', 'Plantillas SportMaps, filtradas por el deporte del equipo.', 560)) +
    step(3, 'Paquetes',
      p('Un <b>paquete</b> es un conjunto de ejercicios de un deporte. SportMaps publica los suyos (fútbol: fundamentos y juego; fútbol 7 y fútbol 5; voleibol formativo; baloncesto; preparación física). Quien gestiona la escuela puede <b>Activar</b> los que quiera: la biblioteca mostrará solo esos más los de la escuela. <b>Exportar</b> descarga un paquete como archivo y <b>Importar paquete</b> trae uno de otra escuela; se valida todo antes y, si hay un error, no se guarda nada.'),
      crop('bib-paquetes', 'Paquetes disponibles para los deportes de la escuela.', 500)) +
    I('Pestaña «De mi escuela» del demo: vacía («Tu escuela todavía no tiene ejercicios guardados»). Activar e importar paquetes lo gestiona el BFF con RPC transaccional; el importador no trae ids de atletas. Los deportes de nivel «cancha» no tienen biblioteca ni paquetes.')
  );

  // ── 11 · Exportar ──
  pgs.push(
    chapter(nextCap(), 'Exportar y compartir', 'Barra superior → Exportar',
      'Lo que ves en la cancha sale igual afuera: con la cámara, la orientación, el piso, la plantilla de líneas y la leyenda que hayas elegido.') +
    crop('exportar-menu', 'El menú Exportar con una jugada de dos cuadros.', 640) +
    ul([
      '<b>Imagen (PNG).</b> La cancha con la jugada y su título, lista para pegar en un chat o un documento.',
      '<b>Ficha del ejercicio (PDF).</b> Una hoja con la cancha, la secuencia de cuadros, y las notas y videos públicos.',
      '<b>Video de la jugada.</b> Necesita dos cuadros o más. Sale en video si el navegador graba y, si no, como GIF animado; el menú lo dice.',
      '<b>Compartir por WhatsApp.</b> En el celular abre la hoja de compartir con el archivo; en el computador descarga la imagen y ofrece «Abrir WhatsApp» para adjuntarla.',
    ]) +
    row(crop('export-png', 'Imagen (PNG).', 230), crop('export-ficha', 'Ficha del ejercicio (PDF).', 330)) +
    tip('Nombres de menores', 'Por defecto lo exportado muestra número y posición, no nombres. Si quieres nombres, actívalos en Equipos → «Mostrar nombres al exportar».') +
    I('Las capturas de PNG y PDF son archivos reales exportados desde dev (el PDF tiene el banner verde y pie «SportMaps · Ficha generada el …»). La marca «SportMaps» del PNG se respeta con marca blanca (spec de marca: «Powered by SportMaps» siempre salvo marca blanca). El video/GIF no lo capturé: depende de MediaRecorder del navegador.')
  );

  // ── 12 · 3D ──
  pgs.push(
    chapter(nextCap(), 'Ver en 3D', 'Barra superior → Ver en 3D',
      'La misma jugada, con jugadores en volumen y la cancha de tu deporte. Se dibuja y se edita en 2D; el 3D es para <b>mirarla y mostrarla</b>. Se carga solo al tocar el botón.') +
    row(crop('3d-voleibol', 'Voleibol: cancha, red y rotación.', 340), crop('3d-baloncesto', 'Baloncesto: piso de madera y aros.', 340)) +
    row(crop('3d-tv', 'Transmisión TV con la jugada de la pizarra.', 340), crop('3d-iso', 'Isométrica.', 340)) +
    keep(p('<b>Cámaras</b> (los botones de arriba; los nombres del fondo cambian según el deporte: arco, aro, palos):'),
    table(['Cámara', 'Qué muestra'], [
      ['<b>Cámara automática</b> (director)', 'Elige sola: un remate hacia el arco o el aro → detrás del fondo; un pase largo → seguir balón; el resto → Transmisión TV. «Al aire:» indica cuál está puesta'],
      ['Transmisión TV · Táctica alta · Cenital · Isométrica', 'Vistas de conjunto, desde un lado, muy arriba o desde arriba en ángulo'],
      ['Detrás del arco/aro · Arco/aro rival', 'Desde cada fondo (en voleibol: fondo propio y fondo rival)'],
      ['Seguir balón · Seguir jugador', 'La cámara acompaña al balón o al jugador que elijas (vista del jugador o desde atrás)'],
      ['Spider-cam · Dron · Libre', 'Cámara suspendida, cámara que se mueve sola y cámara libre que giras arrastrando'],
    ]))
  );
  pgs.push(
    step(1, 'Controles de reproducción',
      p('Abajo: cuadro anterior y siguiente, <b>Reproducir/Pausar</b>, velocidad <b>0,25×, 0,5×, 1× y 2×</b>, <b>Repetición</b> (la jugada otra vez en cámara lenta), <b>Congelar</b> (toca un jugador para ponerle el foco), <b>Rastro</b> y <b>Grabar video</b> cuando el navegador lo permite. La barra de arriba permite saltar a cualquier cuadro.'),
      row(crop('3d-cenital', 'Cenital.', 340), crop('3d-spider', 'Spider-cam.', 340))) +
    step(2, 'Volver a 2D',
      p('<b>Volver a 2D</b> (arriba a la derecha) cierra el visor y te devuelve al tablero 2D tal como lo dejaste, con tu jugada intacta.'),
      row(crop('3d-director', 'Cámara automática: «Al aire: Transmisión TV».', 340), crop('3d-volver', 'Después de «Volver a 2D»: el tablero.', 340))) +
    warn('Si tu equipo no puede con el 3D', 'Si el dispositivo no tiene los gráficos necesarios o va lento al abrir, la pizarra te avisa («Tu celular no soporta bien el 3D; seguimos en 2D») y te deja en el tablero 2D. Con «reducir movimiento» activado en el dispositivo, el dron y la cámara automática se desactivan.') +
    I('3D = three.js + @react-three/fiber en un chunk aparte; mide fps los primeros 2 s y cae a 2D bajo 20. Las capturas del 3D de la pizarra real (dev) se tomaron con WebGL por software (swiftshader) y con el piso de fps desactivado (<code>window.__TACTICAL3D_MIN_FPS__ = 0</code>), porque si no el propio visor cae a 2D en esa máquina; las de voleibol y baloncesto salen del banco de pruebas local <code>e2e/harness/visor-3d.html</code> (jugadas de prueba fijas). Gratis para toda escuela con pizarra (corre en el equipo del coach, no cuesta nada a SportMaps). Siluetas genéricas, nunca fotos. Los contraataques de la IA también se ven en 3D.')
  );

  // ── 13 · IA ──
  pgs.push(
    chapter(nextCap(), 'Análisis de la jugada con IA', 'Barra superior → Analizar jugada',
      'Un ayudante que lee la jugada que tienes en la cancha y te sugiere qué mirar. Son <b>sugerencias</b>: tú decides qué usar. No se envían nombres ni fotos de tus deportistas.') +
    row(
      crop('ia', 'El panel antes de analizar: muestra cuánta IA te queda este mes.', 360),
      col(
        p('El panel (a la derecha en el computador, como hoja inferior en el celular) muestra la barra <b>«Te queda el 100 % de tu IA este mes · unos 15 análisis de fútbol 11»</b>.') +
        p('Al pulsar <b>Analizar jugada</b> (puede tardar hasta un minuto) entrega:') +
        ul(['<b>Lectura de la jugada:</b> qué busca, en pocas líneas.', '<b>Riesgos:</b> espacios que deja y puntos débiles.', '<b>Contraataques del rival:</b> cada uno se puede ver animado encima de tu jugada, también en 3D.', '<b>Variantes</b> de tu jugada, con <b>Guardar como nueva jugada</b>.'])
      )
    ) +
    step(1, 'Tu cupo',
      p('Cada entrenador tiene un <b>cupo de IA por mes</b>, que se renueva el 1.º de cada mes. Si vuelves a analizar una jugada que ya analizaste, se muestra sin gastar cupo. Cuando se acaba aparece «Usaste tu IA de este mes» y el botón <b>Quiero más</b>, que abre WhatsApp con el equipo comercial de SportMaps con tu mensaje listo.')) +
    tip('Para qué deportes', 'El análisis está disponible en los deportes de pizarra completa: fútbol 11, 7 y 5, fútbol sala, voleibol, baloncesto y balonmano. Todo lo que sugiere sale marcado «Sugerencia IA» y no se guarda solo.') +
    (isInternal ? internal('<b>Aún no hay precio y se está midiendo el uso.</b> Hoy: cupo por usuario y mes de <b>USD 1,00</b> en costo real (≈ 15 análisis de fútbol 11; costo medido por análisis: fútbol 11 USD 0,064, voleibol 0,043), techo por escuela = 10× el del usuario. «Quiero más» abre WhatsApp al comercial (+57 320 268 3539) con escuela, quien pide, deporte y consumo; sin datos de atletas. El super admin da cupo con <code>grant_tactical_ai_credits</code> y ve el consumo en <code>/admin/ia-pizarra</code>: es el dato para fijar el precio. <b>No se ejecutó ningún análisis para este manual</b> (quema cuota real): solo se abrió el panel para ver la barra de cupo. A las escuelas NO se les promete precio ni «análisis ilimitados».') : '')
  );

  // ── 14 · Ajustes y celular ──
  pgs.push(
    chapter(nextCap(), 'Ajustes de la pizarra y uso en el celular', 'Barra superior → Ajustes · en celular: Más',
      'Los <b>Ajustes</b> son tuyos: valen para todas tus jugadas en el dispositivo que estás usando.') +
    row(
      crop('ajustes', 'Ajustes de la pizarra.', 250),
      col(
        p('<b>Animación.</b> Curva de velocidad: suave (la de siempre), lineal, rápida al inicio o rápida al final.') +
        p('<b>Rastros en la animación.</b> Ruta del jugador (equipo local y visitante), trayectoria del balón y trayectoria discontinua.') +
        p('<b>Balón y jugadores.</b> Definir la posesión del balón en cada cuadro y mostrar siempre el nombre del jugador.') +
        p('<b>Vista.</b> Tema oscuro o claro de la pizarra y pantalla completa.')
      )
    ) +
    step(1, 'En el celular',
      p('La pizarra está pensada para usarse con el dedo en la cancha. En pantallas chicas la barra se simplifica: <b>Más</b> agrupa <b>Notas, Videos, Equipos y Ajustes</b> junto con Mis jugadas, biblioteca y las opciones de vista; <b>Material</b> es una pestaña dentro de la hoja de Dibujar, y la <b>×</b> de arriba reemplaza a Cancelar. El análisis con IA se abre como una hoja desde abajo.'),
      row(crop('movil', 'Tablero en el celular.', 190), crop('movil-mas', 'Más agrupa Notas, Videos, Equipos y Ajustes.', 190))) +
    I('Preferencias en <code>localStorage</code> del dispositivo (no viajan con la cuenta): <code>pinStyle</code>, <code>PIN_PHOTOS_KEY</code>, ajustes M6g. QA en dispositivos reales (Android gama media + iPhone Safari) <b>sigue pendiente</b> desde F1: las capturas del celular son de un viewport emulado de 390×844, no de un teléfono. Commit <code>3dfbc217</code>: «Equipos» y «Ajustes» pasaron a «Más» y el toolbar ya no desborda.')
  );

  // ── 15 · Consejos ──
  pgs.push(
    chapter(nextCap(), 'Consejos para la cancha', 'Resumen',
      'Atajos para los casos más comunes.') +
    table(['Quieres…', 'Cómo'], [
      ['Armar el equipo rápido', 'Formación → tarjeta; luego arrastra a cada deportista a su círculo. En Rival, elige la formación del contrario'],
      ['Mostrar la jugada al grupo', 'Dibuja los recorridos, agrega cuadros y pulsa reproducir; o mírala en 3D con Transmisión TV'],
      ['Explicar un movimiento paso a paso', 'Activa Numerar y dibuja las flechas en orden; usa la nota de cada cuadro'],
      ['Distinguir quién hace qué', 'Tipo de línea: pase discontinuo, conducción ondulada, carrera continua, disparo grueso; la leyenda sale sola'],
      ['Marcar una zona de presión', 'Zona (elipse o rectángulo) con su color; el centro deja mover al jugador'],
      ['Una fila de conos iguales', 'Coloca uno, ajusta tamaño y color, selecciónalo y pulsa Duplicar'],
      ['Cambiar cómo se ve la cancha', 'Más → Campo: plantilla de líneas, media cancha, piso'],
      ['Usarla en otra sesión', 'Más → Guardar en Mis jugadas o en biblioteca; en la sesión, Desde la biblioteca'],
      ['Mandarla por WhatsApp', 'Exportar → Compartir por WhatsApp, o la ficha PDF'],
      ['Algo salió mal', 'Deshacer / Rehacer; Borrar todo pregunta antes y no toca a los jugadores'],
    ]) +
    tip('Siempre guarda', 'Todo lo que armas se queda en pantalla hasta que pulsas <b>Guardar jugada</b>; <b>Cancelar</b> o cerrar sin guardar descarta los cambios.')
  );

  if (isInternal) {
    pgs.push(
      chapter(nextCap(), 'Estado, huecos y qué NO prometer', 'Solo equipo SportMaps — no enviar a escuelas', '') +
      table(['Tema', 'Estado 2026-10-20'], [
        ['M0–M6 en develop', 'Merge <code>0539f5fe</code> (pizarra M1–M6). dev.sportmaps.co ya muestra todo (formaciones, equipos, notas/videos, Campo, paquetes, 3D, IA): las capturas son de dev. <b>No verifiqué staging ni producción.</b>'],
        ['Subir videos (Bunny)', '<b>Flag apagado</b> y migración sin aplicar. La pestaña «Subir» se ve con «Disponible pronto». No prometer.'],
        ['IA de jugadas', 'Cupo USD 1/mes por entrenador, techo 10× por escuela; <b>sin precio</b>; se mide el uso. Solo pizarra completa. No se ejecutó análisis para este manual.'],
        ['Fotos de jugadores', 'Opción por dispositivo, apagada por defecto; sin chequeo de consentimiento en el tablero. Siluetas por defecto.'],
        ['Copiar/pegar grupo de figuras', 'No existe (la spec T1 lo menciona). Existen + Cuadro, Duplicar y deshacer/rehacer.'],
        ['Foco que sigue al jugador · líneas ancladas a jugadores', 'No: el foco es una figura por cuadro; las líneas ancladas son candidato a M7.'],
        ['Imagen propia de fondo · selección múltiple · papelera para restaurar · orden de capas · árbitro · globos de diálogo · grosor de línea', '<b>No hay.</b> Decisiones: no subir archivos de usuarios; el resto, P3.'],
        ['Orientación horizontal', 'Solo al exportar (imagen, PDF, GIF, video, miniaturas). La pizarra edita en vertical.'],
        ['Cancha de otros deportes en 2D', 'Existen (11 deportes de nivel «cancha»), pero este manual solo capturó la pizarra 2D de fútbol: el demo no tiene sesiones de voleibol, baloncesto, tenis ni pádel y el dueño no crea sesiones. En 3D sí se muestran voleibol y baloncesto.'],
        ['Video/GIF exportado', 'No capturado (MediaRecorder). Probado el menú, el PNG y el PDF.'],
        ['QA en dispositivos', '<b>Pendiente</b> (Android gama media, iPhone Safari). Capturas de celular emuladas.'],
        ['Video del manual', 'El mp4 de <code>docs/manuales/video/pizarra-tactica.mp4</code> es el de F1 y quedó desactualizado; no se regeneró.'],
      ]) +
      tip('Regenerar', '<code>capture-v2.mjs</code> (por secciones: <code>ONLY=base,dibujar</code>; el 3D necesita WebGL por software) y luego <code>build-v2.mjs</code>, en <code>docs/manuales/_src/pizarra-tactica/</code>. Nunca pulsan «Guardar jugada» ni «Analizar».')
    );
  }
  return { pgs, caps: cap };
}

// ── Documento ──────────────────────────────────────────────────────────────
function cover(isInternal, caps) {
  return `<div class="page cover"><div class="cover-inner">
    <div><div class="logo"><span class="pin"></span>SportMaps</div></div>
    <div>
      <div class="cover-eyebrow"><span class="dot" style="background:${isInternal ? '#ff8833' : '#4fd17a'}"></span>${isInternal ? '🔒 Uso interno — no enviar a escuelas' : 'Guía de uso · Academias'}</div>
      <h1 class="cover-title">Pizarra táctica</h1>
      <p class="cover-sub">Formaciones para tu equipo y el rival, dibujo con tipos de línea, animación por cuadros, vista en 3D, notas y videos, biblioteca de ejercicios, exportar y análisis con IA: cómo se arma, se mira y se comparte una jugada o un ejercicio.</p>
      <div class="pills">
        <span class="pill">Rol: Entrenador · Owner/Admin</span>
        <span class="pill">${caps} capítulos</span>
        <span class="pill">Capturas reales del producto</span>
        ${isInternal ? '<span class="pill" style="border-color:#ff8833;color:#ffcf9e">Uso interno</span>' : ''}
      </div>
    </div>
    <div class="cover-footer">SportMaps © 2026 · octubre</div>
  </div></div>`;
}

const css = () => fs.readFileSync(path.join(here, 'manual.css'), 'utf8') + `
ul.bl { margin: 0 0 12px; padding-left: 20px; font-size: 13.5px; line-height: 1.55; color: #33413a; }
ul.bl li { margin-bottom: 3px; }
.step > ul.bl { margin-top: 4px; }
`;

const CAP = 1056 - 56 - 76 - 6; // alto útil de una página (padding de .page y pie)

/** Reparte los bloques de cada capítulo en páginas por altura medida (un capítulo nuevo = página nueva). */
async function paginate(browser, pgs) {
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${css()}</style></head><body><div class="page" id="m">${pgs.join('')}</div></body></html>`);
  await page.waitForFunction(() => [...document.images].every((img) => img.complete && img.naturalHeight > 0));
  await page.evaluate(() => document.fonts.ready);
  const units = await page.evaluate(() => {
    const m = document.getElementById('m');
    const out = [];
    let pendingHead = [];
    const h = (el) => { const cs = getComputedStyle(el); return el.getBoundingClientRect().height + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom); };
    for (const el of [...m.children]) {
      const isHead = el.classList.contains('chapter-head');
      const isHeadPart = isHead || el.classList.contains('breadcrumb') || el.classList.contains('chapter-rule');
      if (isHeadPart) { pendingHead.push({ html: el.outerHTML, h: h(el), newChapter: isHead }); continue; }
      if (pendingHead.length) {
        // la entradilla del capítulo (primer párrafo) viaja con su encabezado
        const u = { html: pendingHead.map((x) => x.html).join('') + el.outerHTML, h: pendingHead.reduce((a, x) => a + x.h, 0) + h(el), newChapter: true };
        out.push(u); pendingHead = [];
      } else if (el.classList.contains('step')) {
        // un paso se puede partir: título + texto juntos; cada imagen/tabla aparte
        const kids = [...el.children];
        const wrapOpen = '<div class="step">';
        let i = 0; let head = [kids[i++]];
        while (i < kids.length && (kids[i].tagName === 'P' || kids[i].tagName === 'UL' || kids[i].tagName === 'TABLE')) head.push(kids[i++]);
        const sh = el.querySelector('.step-head');
        const hh = head.reduce((a, k) => a + h(k), 0);
        out.push({ html: wrapOpen + head.map((k) => k.outerHTML).join('') + '</div>', h: hh + 22, newChapter: false });
        for (; i < kids.length; i++) out.push({ html: '<div class="step" style="margin-bottom:12px">' + kids[i].outerHTML + '</div>', h: h(kids[i]) + 12, newChapter: false });
      } else out.push({ html: el.outerHTML, h: h(el), newChapter: false });
    }
    return out;
  });
  await page.close();
  if (process.env.DEBUG_UNITS) console.log(units.map((u) => Math.round(u.h) + (u.newChapter ? 'C' : '')).join(' '));
  const pages = []; let cur = []; let used = 0;
  for (let k = 0; k < units.length; k++) {
    const u = units[k];
    if (u.h > CAP) console.warn('⚠️  bloque más alto que una página:', Math.round(u.h), u.html.replace(/<[^>]+>/g, ' ').replace(/data:image[^"]*/g, '').slice(0, 120));
    // el encabezado de un capítulo no se queda solo al pie: debe caber con el bloque que sigue
    const needNext = u.newChapter && units[k + 1] ? Math.min(units[k + 1].h, CAP - u.h) : 0;
    if (cur.length && ((u.newChapter && used > CAP * 0.55) || used + u.h + (u.newChapter ? needNext : 0) > CAP)) { pages.push(cur.join('')); cur = []; used = 0; }
    cur.push(u.html); used += u.h;
  }
  if (cur.length) pages.push(cur.join(''));
  return pages;
}

function htmlDoc(isInternal, caps, pages) {
  const total = pages.length + 1;
  const foot = (n) => `<div class="footer${isInternal ? ' internal-mark' : ''}"><span>SportMaps · ${isInternal ? 'Uso interno' : 'Guía de uso'}</span><span>Página ${n} de ${total}</span></div>`;
  return `<!doctype html><html><head><meta charset="utf-8" /><title>SportMaps — Pizarra táctica (${isInternal ? 'Interno' : 'Academias'})</title><style>${css()}</style></head><body>` +
    cover(isInternal, caps) +
    pages.map((pg, i) => `<div class="page">${pg}${foot(i + 2)}</div>`).join('') +
    `</body></html>`;
}

async function render() {
  const browser = await chromium.launch();
  try {
    await makeCrops(browser);
    for (const [ver, base] of Object.entries(OUT)) {
      const isInternal = ver === 'interno';
      fs.mkdirSync(path.dirname(base), { recursive: true });
      const { pgs, caps } = pages(isInternal);
      const paged = await paginate(browser, pgs);
      fs.writeFileSync(`${base}.html`, htmlDoc(isInternal, caps, paged), 'utf8');
      const page = await browser.newPage();
      await page.goto('file:///' + `${base}.html`.replace(/\\/g, '/'));
      await page.waitForFunction(() => [...document.images].every((img) => img.complete && img.naturalHeight > 0));
      await page.evaluate(() => document.fonts.ready);
      // contenido real = hasta el borde inferior del último hijo (sin el pie), debe dejar sitio al pie (y ≤ 1056 - 76)
      const overflow = await page.evaluate(() =>
        [...document.querySelectorAll('.page')].map((el, i) => {
          const kids = [...el.children].filter((c) => !c.classList.contains('footer'));
          const bottom = kids.length ? Math.max(...kids.map((c) => c.getBoundingClientRect().bottom - el.getBoundingClientRect().top)) : 0;
          return { n: i + 1, h: el.scrollHeight, bottom: Math.round(bottom) };
        }).filter((x) => x.h > 1056 || (x.n > 1 && x.bottom > 1056 - 70)));
      if (overflow.length) console.warn(`⚠️  ${ver}: páginas que desbordan →`, JSON.stringify(overflow));
      const pdfBuf = await page.pdf({ width: '816px', height: '1056px', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
      for (let t = 0; ; t++) { // Windows (antivirus / visor) puede tener el PDF abierto unos segundos
        try { fs.writeFileSync(`${base}.pdf`, pdfBuf); break; } catch (e) { if (e.code !== 'EBUSY' || t > 20) throw e; await new Promise((r) => setTimeout(r, 3000)); }
      }
      const n = await page.evaluate(() => document.querySelectorAll('.page').length);
      await page.close();
      console.log(`✅ ${ver}: ${base}.pdf (${n} páginas esperadas)`);
    }
  } finally {
    await browser.close();
  }
}

render().catch((e) => { console.error(e); process.exit(1); });
