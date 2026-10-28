// Manual del Entrenador V2 en sus dos versiones (academias / interno), HTML + PDF,
// con las capturas reales de ./shots/ (las produce capture.mjs en este mismo directorio).
//
//   node docs/manuales/_src/manual-entrenador-v2/build.mjs
//
// Salidas: docs/manuales/v2/{academias,interno}/manual-entrenador-v2.{html,pdf}
// Sistema visual: el de todos los manuales (memoria feedback_pdf_manual_template).
// Las capturas del celular se tomaron a 390×844 @3x y las de escritorio a 1600×1000 @2x;
// los recortes se dan en px CSS de esa pantalla y se hacen con canvas en Chromium.

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
const OUT = {
  academias: path.join(repo, 'docs/manuales/v2/academias/manual-entrenador-v2'),
  interno: path.join(repo, 'docs/manuales/v2/interno/manual-entrenador-v2'),
};

function launch() {
  const base = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (fs.existsSync(base)) {
    const dirs = fs.readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => +b.split('-')[1] - +a.split('-')[1]);
    for (const d of dirs) {
      const exe = path.join(base, d, 'chrome-win64', 'chrome.exe');
      if (fs.existsSync(exe)) return chromium.launch({ executablePath: exe });
    }
  }
  return chromium.launch();
}

// ── Recortes ────────────────────────────────────────────────────────────────
// Se registran mientras se arma el HTML (primera pasada) y se cortan antes de la segunda.
const pedidos = new Map();
function recorte(file, { x = 0, y = 0, w, h } = {}) {
  const movil = !/^(47|73|74|75|76|77|111|114)-/.test(file);
  const W = movil ? 390 : 1600, H = movil ? 844 : 1000;
  const d = { src: file, x, y, w: w ?? W - x, h: h ?? H - y, scale: movil ? 3 : 2 };
  const nombre = `${file.replace('.png', '')}__${d.x}_${d.y}_${d.w}_${d.h}.png`;
  pedidos.set(nombre, d);
  return nombre;
}

async function hacerRecortes(browser) {
  fs.mkdirSync(CROPS, { recursive: true });
  const page = await browser.newPage();
  for (const [out, d] of pedidos) {
    const dst = path.join(CROPS, out);
    if (fs.existsSync(dst)) continue;
    const src = path.join(SHOTS, d.src);
    if (!fs.existsSync(src)) throw new Error(`Falta la captura ${d.src}. Corre capture.mjs: este manual no lleva mockups.`);
    const b64 = fs.readFileSync(src).toString('base64');
    const png = await page.evaluate(async ([b64, d]) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = d.w * d.scale; c.height = d.h * d.scale;
      c.getContext('2d').drawImage(img, d.x * d.scale, d.y * d.scale, d.w * d.scale, d.h * d.scale, 0, 0, d.w * d.scale, d.h * d.scale);
      return c.toDataURL('image/png').split(',')[1];
    }, [b64, d]);
    fs.writeFileSync(dst, Buffer.from(png, 'base64'));
  }
  await page.close();
}

const b64 = (f) => {
  const fp = path.join(CROPS, f);
  return fs.existsSync(fp) ? fs.readFileSync(fp).toString('base64') : '';
};

// ── Piezas ─────────────────────────────────────────────────────────────────
/** Captura del celular, con recorte vertical opcional (y, h en px CSS de 390×844). */
function tel(file, cap, { y = 0, h = 844 - y, w = 200 } = {}) {
  const n = recorte(file, { x: 0, y, w: 390, h });
  return `<figure class="tel" style="width:${w}px"><img src="data:image/png;base64,${b64(n)}" alt="${cap}"/>${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`;
}
const fila = (...tels) => `<div class="tels">${tels.join('')}</div>`;
/** Captura de escritorio recortada (px CSS de 1600×1000). */
function esc(file, cap, r, ancho = 696) {
  const n = recorte(file, r);
  return `<figure class="esc"><img style="width:${ancho}px" src="data:image/png;base64,${b64(n)}" alt="${cap}"/>${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`;
}
/** Texto a la izquierda y celular a la derecha. */
const lado = (texto, telefono) => `<div class="lado"><div>${texto}</div><div>${telefono}</div></div>`;

const step = (n, title, body) =>
  `<div class="step"><div class="step-head"><div class="step-badge">${n}</div><div class="step-title">${title}</div></div>${body}</div>`;
const p = (html) => `<p>${html}</p>`;
const warn = (tag, html) => `<div class="callout warn"><span class="tag">${tag}</span>${html}</div>`;
const tip = (tag, html) => `<div class="callout tip"><span class="tag">${tag}</span>${html}</div>`;
const chapter = (n, title, crumb, intro) =>
  `<div class="chapter-head"><div class="chapter-badge">${n}</div><h2 class="chapter-title">${title}</h2></div>` +
  `<div class="breadcrumb">${crumb}</div><hr class="chapter-rule" />${intro ? `<p class="intro">${intro}</p>` : ''}`;
const tabla = (cab, filas) =>
  `<table class="tbl"><tr>${cab.map((c) => `<th>${c}</th>`).join('')}</tr>${filas.map((f) => `<tr>${f.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`;

// ── Contenido: cada entrada del arreglo es UNA página ───────────────────────
function pages(interno) {
  const I = (html) => (interno ? `<div class="callout internal"><span class="tag">🔒 INTERNO —</span>${html}</div>` : '');
  const pg = [];

  // 1 · Cómo está organizado
  pg.push(
    chapter(1, 'Cómo está organizada tu app', 'Barra de abajo: Hoy · Equipos · Sesiones · Asistencia · Más',
      'La app del entrenador está pensada para el celular, en la cancha: botones grandes y una sola cosa por pantalla. Todo lo que haces a diario está en las cinco pestañas de abajo; lo que usas pocas veces está en <b>Más</b>.') +
    tabla(['Pestaña', 'Para qué la usas', 'Capítulo'], [
      ['<b>Hoy</b>', 'Qué entrenas hoy o mañana y lo que tienes pendiente: evaluar un entreno, convocar a un partido, publicar el informe.', '3'],
      ['<b>Equipos</b>', 'Tus equipos, sus deportistas y su ficha, los <b>partidos y convocatorias</b> y el informe mensual.', '4 y 5'],
      ['<b>Sesiones</b>', 'El entreno de hoy, la semana y el plan del mes. Desde aquí abres la sesión en modo cancha.', '6'],
      ['<b>Asistencia</b>', 'Tomar lista, escanear carnets en la entrada, el historial y las planillas en papel.', '7 y 9'],
      ['<b>Más</b>', 'Calendario, informes, rutinas, dotación, salud del equipo, mensajes, anuncios, encuestas, ayuda y tu cuenta.', '8 y 10'],
    ]) +
    fila(tel('05-hoy.png', 'Hoy', { h: 400, w: 165 }), tel('10-equipos.png', 'Equipos', { h: 400, w: 165 }), tel('120-mas.png', 'Más', { h: 400, w: 165 })) +
    tip('En el computador', 'Las mismas cinco secciones salen en el menú de la izquierda. La planificación completa del mes se trabaja más cómodo ahí.') +
    I('V2 prendida por defecto (<code>VITE_ENTRENADOR_V2</code>, reversa con <code>false</code>). «Más» sale del menú clásico podado por <code>moduleKey</code> (<code>coachMasModel.ts</code>); las rutas que el modelo asigna a una pestaña (ej. planillas → Asistencia) no salen en Más.')
  );

  // 2 · Primer ingreso
  pg.push(
    chapter(2, 'La primera vez que entras', 'Hoy → Perfil Profesional',
      'La primera vez que entras como entrenador, la app te pide tu <b>perfil profesional</b>. Se llena una sola vez y tarda un minuto.') +
    step(1, 'Datos básicos',
      p('Nombre completo, tipo y número de documento, WhatsApp y <b>deporte principal</b> son obligatorios. La foto es opcional. Toca <b>Siguiente</b>.') +
      fila(tel('01-perfil-vacio.png', 'El formulario vacío', { y: 40, h: 590, w: 185 }), tel('02-perfil-lleno.png', 'Lleno, listo para seguir', { y: 40, h: 590, w: 185 }))) +
    step(2, 'Certificados (opcional) y guardar',
      lado(p('Si tienes licencias o certificados (ej. Licencia FIFA, curso de primeros auxilios), agrégalos con su archivo en PDF o foto. Puedes agregar varios con <b>Añadir otra certificación</b>, o dejarlo para después. Toca <b>Guardar Perfil</b> y entras a <b>Hoy</b>.') +
        tip('Si lo cierras', 'Si cierras la ventana sin guardar, la app te lo vuelve a ofrecer la próxima vez. Tus datos los puedes cambiar después en Más → Mi perfil.'),
      tel('03-perfil-certificados.png', 'Paso 2: certificados', { y: 60, h: 520, w: 185 })))
  );

  // 3 · Hoy
  pg.push(
    chapter(3, 'Hoy: lo que toca y lo pendiente', 'Barra de abajo → Hoy',
      'Es la pantalla con la que abre la app. Arriba te dice si entrenas hoy (o qué entrenas mañana) y debajo, en amarillo, lo que tienes <b>pendiente</b>.') +
    lado(
      step(1, 'El entreno de hoy o de mañana',
        p('Si hoy no hay entreno, ves el próximo y el botón <b>Preparar el entreno de mañana</b>, que te lleva a Sesiones. Si hoy sí entrenas, ves la hora, el lugar y el acceso directo a tomar lista.')) +
      step(2, 'Pendientes',
        p('Cada tarjeta trae un botón para resolverla en un toque:') +
        `<ul><li><b>Falta evaluar el entreno</b> → abre «¿Cómo le fue a cada uno?» (capítulo 7).</li><li><b>Convocar al partido</b> → abre la convocatoria del próximo partido (capítulo 5).</li><li><b>Informe por publicar</b> → si tu escuela deja que el entrenador lo publique.</li></ul>` +
        p('<b>Más tarde</b> la esconde por ahora; vuelve a aparecer después.')) +
      p('Abajo, una línea te resume la semana: cuántos entrenos tienen la lista tomada.'),
      tel('05-hoy.png', 'Hoy, con dos pendientes', { h: 500, w: 265 })) +
    I('En la prueba, «Falta evaluar el entreno de hoy» no se quitó nunca: la evaluación del entreno falla en el tenant demo (ver el capítulo de bugs, B3). El texto «en Mar/Jue 16:00-18:00 · Cancha fútbol 11» repetido viene de <code>teams.location</code> del demo, que trae el horario pegado (dato del seed, no de la app).')
  );

  // 4 · Equipos
  pg.push(
    chapter(4, 'Equipos y deportistas', 'Barra de abajo → Equipos',
      'Ves tus equipos con cuántos deportistas tienen y cuándo es el próximo entreno. Al tocar uno, se abre con tres pestañas: <b>Deportistas</b>, <b>Partidos y convocatorias</b> y <b>Evaluar</b>.') +
    step(1, 'Deportistas del equipo',
      lado(p('La lista trae a cada deportista con su acudiente y si está <b>al día</b> o <b>vencido</b> en pagos. Tú solo ves el estado: los valores los maneja la escuela. Con el buscador encuentras a alguien rápido.') +
        p('Al tocar un deportista se despliegan tres acciones:') +
        `<ul><li><b>Escribir al acudiente</b>: abre WhatsApp con su número.</li><li><b>Felicitar</b>: le manda un reconocimiento a la familia (ver el paso 2).</li><li><b>Ver ficha</b>: datos de contacto, avisos de salud y estado de pagos.</li></ul>`,
      tel('12-deportista-acciones.png', 'Tomás desplegado con sus 3 acciones', { y: 0, h: 600, w: 260 })))
  );
  pg.push(
    step(2, 'Felicitar y ver la ficha',
      p('<b>Felicitar</b> trae tres frases listas («Gran actitud hoy en el entreno», «Se nota cuánto has mejorado»…) o escribes la tuya. Le llega a la familia y, si tiene cuenta, al deportista. Una por deportista al día; tienes unos segundos para <b>deshacer</b>.') +
      p('<b>Ver ficha</b> muestra acudiente, salud y pagos, y el botón para escribirle por WhatsApp. Para inscribir, mover o dar de alta deportistas, toca <b>Ver todo en Mis deportistas</b>: esa pantalla completa depende de los permisos que te dé tu escuela.') +
      fila(tel('13-felicitar.png', 'Felicitar a Tomás', { y: 280, h: 564, w: 200 }), tel('14-ficha.png', 'La ficha', { y: 300, h: 544, w: 200 }), tel('134-mis-deportistas.png', 'Mis deportistas (completa)', { y: 40, h: 560, w: 200 }))) +
    step(3, 'Evaluar: el informe del mes',
      lado(p('La pestaña <b>Evaluar</b> del equipo muestra el <b>informe del mes</b> (cuántos van publicados), los entrenos recientes con lista y el <b>informe del entreno para todo el equipo</b>. Quién publica el informe a las familias (tú o la escuela) lo decide tu escuela.'),
        tel('15-equipo-evaluar.png', '', { y: 60, h: 420, w: 190 }))) +
    I('En el demo todos los deportistas salen «Vencido»: <code>school_settings</code> del demo tiene <code>auto_generate_payments</code>, <code>reminder_enabled</code> y <code>late_fee_enabled</code> en <code>true</code> (el README del demo dice que van apagados; alguien los prendió el 2026-10-14).')
  );

  // 5 · Partidos
  pg.push(
    chapter(5, 'Partidos: de la convocatoria al reporte', 'Equipos → tu equipo → Partidos y convocatorias',
      'Todo el partido vive en <b>una sola pantalla</b>, en orden: <b>Programar → Convocar → Resultado → Evaluar → Reporte</b>. Arriba ves los cinco pasos; los que ya hiciste quedan con un chulo y puedes volver a cualquiera.') +
    lado(
      step(1, 'La pestaña Partidos',
        p('Arriba está el botón verde <b>+ Partido</b>. Debajo: el <b>próximo partido</b> con su convocatoria, el acceso <b>Abrir partido: resultado, evaluación y reporte</b>, la <b>pizarra</b> para armar la alineación, la lista <b>Falta el resultado</b> (si hay partidos jugados sin marcador) y los <b>Resultados</b> recientes.')) +
      tip('Los goles por jugadora', 'Las estadísticas por deportista (goles, asistencias, tarjetas) aparecen en equipos de fútbol, fútbol sala y microfútbol. En los demás deportes registras el marcador y la evaluación.'),
      tel('23-tab-proximo.png', 'Equipo con un partido por jugar', { y: 60, h: 600, w: 215 }))
  );
  pg.push(
    step(2, 'Programar',
      lado(p('Toca <b>+ Partido</b> y llena: <b>contra quién</b>, la <b>fecha</b>, la hora (opcional), si juegan <b>en casa o de visita</b>, la cancha, el <b>tipo</b> (Amistoso, Liga, Copa, Torneo, Clasificatorio, Final) y una <b>nota para las familias</b> (uniforme, hora de llegada).') +
        p('Si la fecha es futura, toca <b>Programar y convocar</b>: el partido queda también en el <b>calendario del equipo</b>, así las familias lo ven.') +
        p('Si el partido ya se jugó, usa <b>Ya se jugó: registrar el resultado</b> y pasas directo al marcador (ver el paso 7).'),
      tel('20-programar.png', 'Nuevo partido', { y: 60, h: 600, w: 215 }))) +
    step(3, 'Convocar',
      p('Arranca con todos los del equipo (o con la convocatoria del último partido). Toca a quien no va para quitarlo y luego <b>Convocar a N</b>. Si las familias tienen cuenta, el botón dice <b>Convocar y avisar a N familias</b> y les llega el aviso. Tienes unos segundos para <b>deshacer</b>.') +
      fila(tel('21-convocar.png', 'Convocatoria', { y: 200, h: 470, w: 195 }), tel('22-convocados.png', 'Listo: 3 convocados', { y: 200, h: 420, w: 195 }), tel('21-convocar-full.png', 'Con familias: van / no van', { y: 200, h: 420, w: 195 })))
  );
  pg.push(
    step(4, 'Resultado: marcador, goles, asistencias y tarjetas',
      p('El marcador tiene <b>+</b> y <b>−</b> para cada lado. Debajo está la lista de convocadas: <b>toca una jugadora</b> y anótale <b>Gol</b>, <b>Asistencia</b>, <b>Amarilla</b>, <b>Roja</b> o <b>Autogol</b>. Cada anotación queda guardada al instante y aparece como una etiqueta al lado del nombre (G, A, TA). Con el <b>−</b> la quitas si te equivocaste.') +
      p('El marcador propio se llena solo con los goles que anotes; si lo cambias a mano, la app te avisa si no cuadra. Al final toca <b>Guardar resultado</b>.') +
      fila(tel('33-resultado-vacio.png', 'Antes', { y: 160, h: 620, w: 205 }), tel('34-gol-anotado.png', 'Gol de Tomás', { y: 160, h: 620, w: 205 }), tel('35-resultado-lleno.png', 'Gol, asistencia y amarilla', { y: 160, h: 620, w: 205 }))) +
    I('<b>Bug B1 (alto):</b> en el celular, la barra fija con <b>Guardar resultado</b> queda DEBAJO de la barra de pestañas (se ve solo una franja verde) y no se puede tocar. Lo mismo con <b>Guardar evaluación</b> del paso 5. En computador sí se ve. Para la prueba se forzó el clic por código: el guardado funciona (1–0 quedó en la base). Ver la tabla de bugs.')
  );
  pg.push(
    step(5, 'Evaluar a las convocadas',
      lado(p('Solo se evalúa a quienes quedaron <b>convocadas</b>. Toca cada nombre y califica de <b>1 a 5</b> los criterios de tu escuela (ej. actitud, técnica, toma de decisiones, físico, comunicación, cumplimiento del rol) y deja un comentario corto. Lo que dejes en blanco no se guarda. Toca <b>Guardar evaluación</b>.') +
        p('<b>Familias:</b> si tu escuela comparte las evaluaciones de partido, verás <b>Publicar a las familias</b>; cada familia ve solo la de su deportista. Si no, quedan solo para el cuerpo técnico.') +
        warn('Si dice «No hay criterios para evaluar»', 'Los criterios los define la administración de tu escuela (una sola vez). Pídeselo: desde esta misma pantalla, la administración tiene el botón <b>Usar los criterios sugeridos para partidos</b>.'),
      tel('41-evaluar-tomas.png', 'Evaluación de Tomás: 7 de 7', { y: 60, h: 560, w: 215 }))) +
    I('Criterios: tabla <code>school_metric_definitions</code>, se siembran con <code>seed_school_match_criteria</code> (solo admin; el coach ve «Pídele a la administración»). En el demo los sembró otra sesión de prueba (como Ricardo) el 26-oct a las 16:32. Publicar a familias depende de <code>school_settings.share_match_evaluations</code> (en el demo quedó en <code>true</code>, también por esa sesión). Guardar = RPC <code>submit_match_evaluation</code>; marca el partido como jugado.')
  );
  pg.push(
    step(6, 'Reporte del partido',
      p('Cuenta cómo fue: <b>resumen</b>, <b>desarrollo del partido</b> y <b>aspectos a mejorar</b>. Con el interruptor <b>Publicar a las familias</b> se lo mandas a las familias del equipo (lo ven si tu escuela tiene activado el reporte). Toca <b>Guardar</b> y luego <b>Terminar</b>. Puedes volver a <b>Ver o editar el reporte</b> cuando quieras.') +
      fila(tel('43-reporte.png', 'Paso Reporte', { y: 180, h: 260, w: 200 }), tel('44-reporte-dialogo.png', 'Escribir y publicar', { y: 0, h: 844, w: 200 }), tel('45-reporte-guardado.png', 'Guardado y publicado', { y: 0, h: 360, w: 200 })))
  );
  pg.push(
    step(7, 'Un partido que ya se jugó y «Falta el resultado»',
      p('Si registras un partido con fecha de hoy o pasada, el botón principal es <b>Guardar y registrar el resultado</b> y vas directo al marcador. Si no hubo convocatoria, te muestra a todo el equipo.') +
      p('Si un partido ya pasó y nadie anotó el marcador, sale en la lista <b>Falta el resultado</b> de la pestaña Partidos: tócalo para cerrarlo.') +
      fila(tel('51-ya-se-jugo-resultado.png', 'Ya se jugó: directo al marcador', { y: 60, h: 540, w: 200 }), tel('52-falta-el-resultado.png', '«Falta el resultado» y Resultados', { y: 50, h: 500, w: 200 }))) +
    step(8, 'Alineación en la pizarra',
      lado(p('<b>Armar la alineación en la pizarra</b> abre la cancha con la formación: eliges el esquema, arrastras a los convocados a su posición y dejas el resto en el banco. Toca <b>Guardar Alineación</b>.') +
        p('Para ver todos los partidos del equipo, toca <b>Ver todos los partidos</b> al final de la pestaña.'),
        tel('24-pizarra.png', 'Alineación', { y: 60, h: 600, w: 190 })))
  );

  // 6 · Sesiones
  pg.push(
    chapter(6, 'Sesiones: hoy, la semana y el plan del mes', 'Barra de abajo → Sesiones',
      'Tres vistas: <b>Hoy</b> (la sesión del día y el modo cancha), <b>Semana</b> (lunes a domingo) y <b>Plan del mes</b> (el objetivo del mes y sus cuatro semanas). Crear o editar sesiones y el plan se hace en la <b>planificación completa</b>.') +
    step(1, 'La semana',
      p('Cada día dice qué equipo entrena y si ya tiene sesión planeada. <b>Planear</b> te lleva a la planificación completa. Al tocar un día con sesión ves sus bloques y dos botones: <b>Ver sesión</b> y <b>Abrir en la cancha</b>.') +
      fila(tel('71-sesiones-semana.png', 'Semana sin plan', { y: 60, h: 560, w: 200 }), tel('78b-dia-abierto.png', 'Martes con sesión planeada', { y: 60, h: 400, w: 200 }), tel('70-sesiones-hoy.png', 'Hoy, sin sesión', { y: 60, h: 300, w: 200 }))) +
    I('<b>B6:</b> «Planear» y «Crear el plan» abren <code>/training-plans/planificar</code> sin equipo ni fecha: el entrenador tiene que volver a elegir el equipo y buscar el día.')
  );
  pg.push(
    step(2, 'Ver la sesión y el modo cancha',
      p('<b>Ver sesión</b> muestra el objetivo, los principios de juego, los bloques con sus minutos y los materiales. <b>Abrir en la cancha</b> la pone en letra grande, un bloque a la vez, con <b>Anterior</b> y <b>Siguiente</b>; la pantalla no se apaga mientras estás ahí. <b>Salir</b> arriba a la derecha.') +
      fila(tel('79-ver-sesion.png', 'Ver sesión', { y: 0, h: 844, w: 215 }), tel('80-modo-cancha.png', 'Modo cancha', { y: 0, h: 844, w: 215 }))) +
    step(3, 'Plan del mes',
      lado(p('Elige el equipo arriba. Ves el objetivo del mes, las cuatro semanas con su carga y el balance de entrenos hechos. Si no hay plan, <b>Crear el plan</b> te lleva a la planificación completa.'),
        tel('81-plan-del-mes.png', '', { y: 60, h: 380, w: 190 })))
  );
  pg.push(
    step(4, 'La planificación completa (mejor en computador)',
      p('Elige el equipo en <b>Panel de Selección</b>. Ves el plan del mes (mesociclo) con sus semanas y, a la derecha, el roster. Con el botón <b>⋯</b> del plan: <b>Nuevo mesociclo</b> (inicio, fin, objetivo general y modelo de juego), <b>Editar</b> o <b>Eliminar</b>.') +
      esc('74-nuevo-mesociclo.png', 'Nuevo mesociclo: arranca hoy y dura cuatro semanas', { x: 520, y: 150, w: 560, h: 560 }, 470)) +
    I('<b>B7:</b> en la planificación completa, un mesociclo que ya terminó marca su última semana como «Esta semana» (<code>MesocycleSection.tsx:307-314</code> cae a la última semana si hoy no está en ninguna, y <code>:655-656</code> le pone la insignia igual). Además el «Plan del mes» de la V2 llama «Noviembre» al mesociclo 26-oct → 22-nov.')
  );
  pg.push(
    step(5, 'Crear la sesión de un día',
      p('En la semana, <b>Agregar sesión</b> → elige el día. Llena materiales, el <b>objetivo de la sesión</b>, los principios de juego y los <b>bloques</b> (nombre, minutos, actividad, componente técnico/táctico/físico, objetivo, organización; o tráelos <b>Desde la biblioteca</b>). La evaluación de la sesión es opcional y se puede llenar después. Toca <b>Crear Sesión</b>.') +
      esc('76-form-sesion.png', 'Crear la sesión del martes con tres bloques', { x: 450, y: 0, w: 700, h: 760 }, 570)) +
    step(6, 'La sesión queda en su día',
      p('Al crearla, aparece en la semana de la planificación completa y en <b>Sesiones → Semana</b> del celular, lista para abrir en la cancha.'))
  );

  // 7 · Asistencia
  pg.push(
    chapter(7, 'Asistencia: tomar lista y evaluar el entreno', 'Barra de abajo → Asistencia',
      'Dos pestañas: <b>Tomar lista</b> e <b>Historial</b>. La lista arranca con todos en <b>Vino</b>: solo tocas al que no vino.') +
    step(1, 'Elegir el equipo y marcar',
      p('Elige el equipo (si tienes uno solo, entra directo) y el día: <b>Hoy</b> o <b>Ayer</b>. Toca a cada deportista para cambiar su estado: <b>Vino → Faltó → Excusa → Tarde</b>. Quien avisó por WhatsApp que no venía ya arranca con excusa. Arriba se va contando «Vinieron N de M».') +
      fila(tel('90-asistencia-elegir.png', '¿De quién tomas lista?', { y: 60, h: 300, w: 185 }), tel('92-lista-marcada.png', 'Faltó, Excusa y Tarde', { y: 160, h: 460, w: 185 }))) +
    step(2, 'Guardar la lista',
      lado(p('Toca <b>Guardar lista</b>. Durante unos segundos puedes <b>Deshacer</b>; luego dice «Subiendo la lista…» y queda <b>Lista guardada</b> con tres opciones: <b>Evaluar al equipo</b>, <b>Corregir</b> y <b>Cerrar la lista</b>.') +
        tip('Sin señal', 'Si no hay internet, la lista se guarda en el teléfono y sube sola cuando vuelva la señal. No la borres ni cierres sesión mientras tanto.') +
        p('En <b>Más opciones</b> marcas si fue una <b>clase secundaria</b> (descuenta de las clases secundarias del plan del deportista).'),
      tel('94b-lista-subida.png', 'Lista guardada', { y: 0, h: 560, w: 185 })))
  );
  pg.push(
    step(3, 'Cerrar la lista',
      lado(p('<b>Cerrar la lista</b> la deja fija: ya no se puede cambiar sin reabrirla. Después de cerrarla puedes calificar el entreno.') +
        p('Puedes <b>corregir</b> la lista de hoy y la de ayer; después, la corrige la escuela.'),
        tel('94c-cerrar-confirmar.png', '¿Cerrar la lista?', { y: 230, h: 300, w: 200 }))) +
    step(4, 'Evaluar al equipo: ¿cómo le fue a cada uno?',
      p('Solo salen los que vinieron. Todos arrancan en <b>Normal</b>: toca solo al que le fue <b>Bien</b> o al que <b>Le costó</b>, o usa <b>A todos: Bien</b>. Junto a cada nombre está <b>Felicitar</b>. Escribe una <b>nota para las familias</b> (opcional) y toca <b>Guardar evaluación</b>: las familias reciben «Así le fue hoy».') +
      fila(tel('95-evaluar-equipo.png', 'Todos en Normal', { y: 60, h: 600, w: 200 }), tel('96-evaluar-equipo-lleno.png', 'Tomás: Bien', { y: 230, h: 430, w: 200 }))) +
    I('<b>B3 (alto en escuelas multideporte):</b> «Evaluar al equipo» respondió «Guardado» pero la RPC <code>submit_post_training_coach_rating</code> devolvió 500 (<i>«La escuela no tiene configurada la métrica de rating del coach»</i>): toma el deporte de <code>schools.category_id</code> (el demo está como Golf) y el catálogo post-entreno solo existe para Fútbol, Voleibol y Fútbol Sala. Para Besser (Fútbol) debería funcionar. Al cerrar la lista además aparece el modal viejo «Califica el entreno de hoy» (porcentajes, misma RPC): dos pantallas para lo mismo (B10).')
  );
  pg.push(
    step(5, 'Historial',
      lado(p('Arriba: el <b>% de asistencia del mes</b>, cuántos entrenos tienen lista y cuántos <b>faltan mucho</b>. Debajo, cada entreno con «vinieron N de M»; los de hoy y ayer tienen <b>Corregir</b>, los anteriores un candado. Si llegaron planillas en papel por foto, aquí arriba sale el aviso <b>planillas de papel por revisar</b> (capítulo 9).'),
        tel('98-historial.png', 'Historial', { y: 60, h: 470, w: 200 }))) +
    step(6, 'Escanear carnets en la entrada',
      lado(p('<b>Escanear carnets en la entrada</b> abre la cámara: cada deportista muestra el QR de su carnet digital y queda presente al toque. No hace falta elegir equipo antes: el carnet sabe a qué equipo pertenece. Escanear dos veces no duplica.') +
        p('La primera vez el celular te pide <b>permiso para usar la cámara</b>: acéptalo.'),
        tel('99-escanear.png', 'Check-in por carnet', { y: 60, h: 470, w: 200 }))) +
    I('El escaneo no se probó con cámara (el navegador de prueba no tiene). Copy: el historial dice «hasta el día siguiente» aunque el demo tiene <code>coach_attendance_retro_days = 7</code>: la V2 limita a hoy/ayer (<code>asistenciaModel.ts:151-161</code>) y el BFF permite 7 (B9). El aviso «Lista guardada: vinieron 2, faltaron 2» cuenta las excusas como faltas (B11).')
  );

  // 8 · Calendario
  pg.push(
    chapter(8, 'Calendario y eventos', 'Más → Calendario',
      'El calendario muestra los eventos de tus equipos y de la escuela. Desde aquí también creas un partido.') +
    step(1, 'Crear un evento',
      p('Toca <b>Nuevo Evento</b>. Escribe el título y elige <b>Para quién</b>: un equipo (lo ven sus familias y el staff), <b>Toda la escuela</b> o <b>Solo para mí</b>. Luego el tipo, la fecha y las horas, la ubicación y una descripción.') +
      fila(tel('61-nuevo-evento.png', 'Nuevo evento', { y: 0, h: 640, w: 200 }), tel('62-evento-partido-lleno.png', 'Tipo Partido Oficial: pide el rival', { y: 0, h: 844, w: 200 }))) +
    tip('Evento tipo Partido = partido completo', 'Si el tipo es <b>Partido Oficial</b> y es para un equipo, la app pide el <b>rival</b> y si juegan en casa o de visita, y <b>crea el partido</b>: aparece en Equipos → Partidos, donde convocas, registras el resultado y evalúas.')
  );
  pg.push(
    step(2, 'Abrir el partido desde el calendario',
      p('Al crearlo, el aviso dice «Partido creado. Quedó en el calendario y en Resultados». Toca el día en la cuadrícula: en el detalle del evento aparece <b>Abrir partido</b>, que lleva a la pantalla del partido (capítulo 5).') +
      fila(tel('63-evento-creado.png', 'Aviso al crear', { y: 0, h: 300, w: 200 }), tel('65-evento-detalle.png', 'Detalle del día: Abrir partido', { y: 60, h: 560, w: 200 }), tel('66-sub12-partidos.png', 'Y en Equipos → Partidos', { y: 60, h: 560, w: 200 }))) +
    tip('Cambiar la fecha', 'Si el partido se aplaza, cambia la fecha en el paso <b>Programar</b> del partido: el evento del calendario se mueve solo.') +
    I('Verificado: el evento <code>e78e85df…</code> nació con <code>match_results.calendar_event_id</code> ligado; al editar la fecha del partido con <code>update_match</code>, <code>calendar_events.start_time</code> pasó de 30-sep a 30-oct. «Abrir partido» solo aparece en el detalle del día seleccionado, no en «Próximos Eventos».')
  );

  // 9 · Planillas
  pg.push(
    chapter(9, 'Planillas en papel y hojas de matrícula', 'Asistencia → Historial → planillas por revisar',
      'Si en tu escuela la asistencia o las inscripciones a veces se llenan en papel, puedes tomarle una <b>foto</b> a la hoja. El sistema lee los nombres y los cruza con la lista del grupo; <b>nada se guarda solo</b>: alguien revisa y confirma.') +
    step(1, 'Planillas de asistencia en papel',
      lado(p('En <b>Planillas por revisar</b> toca <b>Subir planilla</b> y toma la foto de la hoja completa, de frente y con buena luz (también se puede mandar por el WhatsApp de la escuela). La planilla queda en la lista para revisar: ves la foto, una grilla con cada deportista y fecha, y corriges lo que haga falta. Solo se guarda lo que dejes marcado al tocar <b>Guardar</b>; <b>Descartar</b> la saca de la lista.') +
        p('Como entrenador ves solo las planillas que tú subiste.'),
        tel('100-planillas-vacia.png', 'Planillas por revisar', { y: 60, h: 420, w: 200 }))) +
    I('<b>B2 (alto): hoy NO funciona.</b> Al subir una planilla de prueba de Sub-15 (foto generada con los nombres reales) el BFF respondió 422 «No tienes equipos asignados para pasar lista»: <code>cargarEquipos()</code> (<code>bff/src/services/whatsapp-asistencia-staff.service.ts:112-118</code>) pide la columna <code>teams.is_active</code>, que no existe (es <code>active</code>), la consulta falla y devuelve 0 equipos para TODOS (coach y admin, app y WhatsApp). Además el OCR se cobra antes de ese chequeo. <b>B4:</b> en la V2 no hay cómo llegar a «Subir planilla» si no hay planillas pendientes (el enlace del Historial solo sale con pendientes y «Más» la omite). <b>B5:</b> el permiso «Coaches pueden subir planillas de asistencia» no se aplica: el BFF deja subir a cualquier coach. No enviar este capítulo a una escuela hasta corregir B2 y B4.')
  );
  pg.push(
    step(2, 'Hojas de matrícula (si tu escuela lo permite)',
      p('Para inscribir a alguien que llenó la ficha en papel, tu escuela puede dejarte <b>subir la foto de la hoja de matrícula</b>. Tú solo tomas la foto; la escuela revisa los datos y crea al deportista. Si no está habilitado, verás el aviso «Tu escuela no tiene habilitado que los entrenadores suban hojas de matrícula».') +
      fila(tel('110-matricula-sin-permiso.png', 'Sin permiso', { y: 60, h: 320, w: 180 }), tel('112-matricula-con-permiso.png', 'Con permiso: Subir hoja', { y: 60, h: 320, w: 180 })) +
      p('Se llega desde <b>Equipos → un deportista → Ver ficha → Ver todo en Mis deportistas</b>, botón de subir hoja.')) +
    step(3, 'Lo que hace la escuela',
      p('La administración activa el permiso en <b>Pagos → Config → Permisos → «Coaches pueden subir hojas de matrícula»</b>, y revisa cada hoja en <b>Matrículas por revisar</b>: el sistema llena el formulario con lo que leyó (deportista, documento, fecha de nacimiento, acudiente, EPS), lo revisan y tocan <b>Crear atleta</b> o <b>Descartar</b>.') +
      esc('114-owner-bandeja-matriculas.png', 'La hoja de prueba leída y lista para revisar (vista de la escuela)', { x: 320, y: 140, w: 820, h: 520 }, 440)) +
    I('Probado: con el permiso prendido, el coach subió una ficha de prueba («Samuel Ortiz Ríos», ficticio); el OCR la leyó bien (todos los campos) y quedó <code>waiting_review</code> (<code>enrollment_form_intake 7f1e4c2d…</code>). El permiso se volvió a apagar. El gate real está en el BFF (<code>enrollment-intake.routes.ts:98-101</code>). La pantalla también exige el módulo <code>deportistas_matriculas_por_revisar</code>.')
  );

  // 10 · Más
  pg.push(
    chapter(10, 'Lo demás: la pestaña Más', 'Barra de abajo → Más',
      'Lo que usas de vez en cuando, en grupos. Lo que salga en tu «Más» depende de los módulos que tenga tu escuela.') +
    tabla(['Entrada', 'Qué hay'], [
      ['<b>Agenda y citas</b>', 'Clases fijas asignadas y tus horarios disponibles (si das clases personales o reservables).'],
      ['<b>Calendario</b>', 'Entrenos, partidos y torneos; crear eventos (capítulo 8).'],
      ['<b>Informe mensual</b>', 'Tu nota del mes para cada equipo, publicar, revisar el PDF y enviarlo a las familias. La escuela genera los borradores.'],
      ['<b>Informes del entreno</b>', 'Reportes del equipo: asistencia, nómina y resultados; informe grupal del mes y exportar PDF.'],
      ['<b>Rutinas</b>', 'Biblioteca de rutinas de la escuela; crear y usar rutinas.'],
      ['<b>Mi dotación</b>', 'Lo que tienes a cargo (balones, petos…): por aceptar, activas e historial; «Tomar dotación».'],
      ['<b>Salud del equipo</b>', 'Quién puede entrenar: solo lo que el profesional y la familia autorizaron compartir; nunca el diagnóstico.'],
      ['<b>Mensajes · Anuncios · Encuestas</b>', 'Conversaciones, anuncios a padres y jugadores, y encuestas de asistencia para compartir por WhatsApp.'],
      ['<b>Ayuda</b>', 'Escribirle a la escuela por WhatsApp, preguntarle a <b>Mapi</b> (el asistente) y el Centro de ayuda.'],
      ['<b>Cuenta</b>', 'Notificaciones, mis datos y configuración, mi perfil, cambiar de escuela o rol, cerrar sesión.'],
    ]) +
    fila(tel('122-informe-mensual.png', 'Informe mensual', { y: 60, h: 420, w: 150 }), tel('125-dotacion.png', 'Mi dotación', { y: 60, h: 420, w: 150 }), tel('126-salud-equipo.png', 'Salud del equipo', { y: 60, h: 420, w: 150 }), tel('136-mapi.png', 'Mapi', { y: 220, h: 420, w: 150 }))
  );

  // 11 · Preguntas frecuentes
  pg.push(
    chapter(11, 'Preguntas frecuentes', '', '') +
    tabla(['Pregunta', 'Respuesta'], [
      ['No me aparece un equipo.', 'La escuela te asigna a tus equipos. Pídele a la administración que te agregue como entrenador de ese equipo.'],
      ['Me equivoqué en la lista.', 'Toca <b>Corregir</b>: puedes cambiar la de hoy y la de ayer. Más atrás, la corrige la escuela.'],
      ['Guardé la lista sin señal.', 'Queda en el teléfono y sube sola cuando vuelva la conexión. Verás «Guardada en el teléfono».'],
      ['Toqué «Guardar» y me arrepentí.', 'Tienes unos segundos para tocar <b>Deshacer</b>. Pasado ese tiempo, corrige normalmente.'],
      ['El partido se aplazó.', 'Abre el partido → <b>Programar</b> → cambia la fecha. El calendario se actualiza solo. Si se cancela, <b>Cancelar este partido</b>.'],
      ['Una jugadora no aparece para evaluar en el partido.', 'Solo se evalúa a las convocadas. Ve al paso <b>Convocar</b> y súmala.'],
      ['«No hay criterios para evaluar».', 'La administración de tu escuela debe definir los criterios de partido (una sola vez).'],
      ['Las familias no ven la evaluación del partido.', 'Depende de que tu escuela comparta las evaluaciones de partido; si no, quedan solo para el cuerpo técnico.'],
      ['No veo los valores de los pagos.', 'Es a propósito: el entrenador ve solo si el deportista está al día o vencido.'],
      ['¿Dónde inscribo o muevo a un deportista?', 'En <b>Mis deportistas</b> (desde la ficha → Ver todo en Mis deportistas), si tu escuela te dio ese permiso.'],
      ['¿Puedo usarla en el computador?', 'Sí: entra con tu mismo correo. La planificación completa del mes es más cómoda en pantalla grande.'],
    ]) +
    tip('¿Más dudas?', 'En <b>Más → Preguntarle a Mapi</b> el asistente te responde al momento, o te pasa con una persona del equipo SportMaps.')
  );

  if (interno) {
    pg.push(
      chapter(12, 'Bugs y huecos encontrados en la prueba', 'Solo equipo SportMaps — 2026-10-26, dev.sportmaps.co (7aeb8c7c)', 'Probado con el entrenador demo de fútbol (Andrés Ríos) en Club Campestre Demo. Detalle, evidencia y propuestas en <code>docs/manuales/v2/pruebas-entrenador-v2.md</code>.') +
      '<div class="chica">' + tabla(['#', 'Gravedad', 'Qué pasa', 'Dónde'], [
        ['B1', 'Alta', 'En el celular, «Guardar resultado» y «Guardar evaluación» del partido quedan tapados por la barra de pestañas: no se pueden tocar.', '<code>PartidoFlujo.tsx:622</code> y <code>:850</code> (z-20 bajo <code>MobileBottomNav</code> z-30)'],
        ['B2', 'Alta', 'Planillas por foto fallan siempre: «No tienes equipos asignados para pasar lista» (columna inexistente <code>teams.is_active</code>). El OCR se cobra antes.', '<code>whatsapp-asistencia-staff.service.ts:112-118</code>, <code>:302</code> vs <code>:326</code>'],
        ['B3', 'Alta (multideporte)', '«Evaluar al equipo» dice «Guardado» y la RPC falla (55000): el deporte sale de la escuela, no del equipo.', 'RPC <code>submit_post_training_coach_rating</code> (mig. <code>20260911123141</code> ~282-316); <code>CoachEvaluateV2.tsx:117-135</code>'],
        ['B4', 'Media', 'Sin planillas pendientes no hay botón para subir una (V2).', '<code>CoachAttendanceV2.tsx:765</code>, <code>coachMasModel.ts:37</code>'],
        ['B5', 'Media', 'El permiso de planillas del coach no se aplica en el BFF; el texto de config dice «en construcción».', '<code>attendance-sheet-intake.routes.ts:143</code>'],
        ['B6', 'Baja', '«Planear»/«Crear el plan» pierden equipo y fecha.', '<code>CoachSessionsV2.tsx:458, 466, 543</code>'],
        ['B7', 'Baja', '«Esta semana» en un mesociclo ya terminado.', '<code>MesocycleSection.tsx:307-314, 655-656</code>'],
        ['B8', 'Baja', 'Deshacer de 8 s: cerrar o recargar la app en esa ventana pierde la acción (convocatoria, evaluación, felicitación).', '<code>useAccionConDeshacer.ts</code>'],
        ['B9', 'Baja', 'Corrección de lista: V2 hoy/ayer, escuela 7 días.', '<code>asistenciaModel.ts:151-161</code>'],
        ['B10', 'Baja', 'Dos UIs para evaluar el entreno (modal de % al cerrar + «Evaluar al equipo»).', '<code>CoachAttendanceV2.tsx:671</code>'],
        ['B11', 'Copy', '«faltaron» suma las excusas.', '<code>CoachAttendanceV2.tsx</code> (aviso-deshacer)'],
        ['B12', 'Cosmético', 'El botón de Mapi tapa parte de botones y textos en la pantalla del partido y en evaluar.', 'FAB de soporte'],
      ]) + '</div>'
    );
    pg.push(
      chapter(13, 'Datos de prueba que quedaron en el demo', 'Club Campestre Demo · 25a123f0…', 'Todo en el tenant demo (<code>is_demo=true</code>). El usuario decide qué borrar.') +
      tabla(['Qué', 'Id'], [
        ['Entrenador Andrés Ríos (auth + profile + coach_profiles)', '<code>16d36eb1-776f-4324-a0ea-fdf1fe5b4519</code>'],
        ['school_members / school_staff', '<code>882bbc3e…</code> / <code>b4f41215-cfa4-4203-ae65-a8df9131d559</code>'],
        ['team_coaches (Sub-15, Sub-12) · offering_coaches', '<code>2b838681…</code>, <code>5ddf1b49…</code> · <code>6476c4b2…</code>'],
        ['teams.coach_id de Sub-15 y Sub-12: era Camilo Herrera (ficha sin cuenta)', 'antes <code>f0000000-…-000000000001</code>'],
        ['Partido Atlético Sabana (Sub-15, 26-oct, 1–0, eventos G/A/TA, convocatoria 3, evaluación, reporte publicado)', '<code>0707b28e-fd47-465f-9562-084f2d37de2a</code>'],
        ['Partido Deportivo Chía (Sub-15, 23-oct, sin resultado)', '<code>bd6f73fc-5b6f-47de-9a30-2063854eeff4</code>'],
        ['Partido Club Los Andes (Sub-12, 30-oct) + evento de calendario', '<code>bc8d1c85…</code> + <code>e78e85df…</code>'],
        ['Partido Deportivo Suba (Sub-12, 7-nov, convocatoria 3) + evento', '<code>64c3d204…</code> + <code>2e54586e…</code>'],
        ['Mesociclo Sub-15 26-oct → 22-nov (4 semanas) + sesión del 27-oct', '<code>7032dfab…</code> + <code>2652a506…</code>'],
        ['Lista de asistencia Sub-15 26-oct (cerrada, 4 registros)', '<code>cc4d1173-aca6-4445-9891-dcb089241148</code>'],
        ['Hoja de matrícula de prueba (Samuel Ortiz Ríos, ficticio) por revisar', '<code>7f1e4c2d-e6c1-405e-8b02-39065954ace1</code>'],
      ]) +
      warn('No son de esta prueba', 'Otra sesión, entrando como Ricardo (owner), creó el mismo día los partidos <b>Halcones FC</b> (<code>09674a04…</code>) y <b>Deportivo Arrayanes</b> (<code>03f916e1…</code>), los 7 criterios de partido y prendió <code>share_match_evaluations</code>.') +
      tip('Regenerar este manual', '<code>node scripts/demo-club-campestre/add-coach.mjs</code> (idempotente) → <code>node docs/manuales/_src/manual-entrenador-v2/capture.mjs todo</code> → <code>build.mjs</code>. Las secciones que crean datos miran antes si ya existen.')
    );
  }
  return pg;
}

// ── Documento ───────────────────────────────────────────────────────────────
function cover(interno, total) {
  return `<div class="page cover"><div class="cover-inner">
    <div><div class="logo"><span class="pin"></span>SportMaps</div></div>
    <div>
      <div class="cover-eyebrow"><span class="dot" style="background:${interno ? '#ff8833' : '#4fd17a'}"></span>${interno ? '🔒 Uso interno — no enviar a escuelas' : 'Guía de uso · Academias'}</div>
      <h1 class="cover-title">Manual del entrenador</h1>
      <p class="cover-sub">Todo lo que hace el entrenador en la app nueva, desde el celular: el día, los equipos, los partidos de la convocatoria al reporte, las sesiones, la asistencia, el calendario y las planillas.</p>
      <div class="pills">
        <span class="pill">Rol: Entrenador</span>
        <span class="pill">Versión 2 · octubre 2026</span>
        <span class="pill">${interno ? 13 : 11} capítulos</span>
        <span class="pill">Capturas reales del producto</span>
        ${interno ? '<span class="pill" style="border-color:#ff8833;color:#ffcf9e">Uso interno</span>' : ''}
      </div>
    </div>
    <div class="cover-footer">SportMaps © 2026 · ${total} páginas</div>
  </div></div>`;
}

const css = () => fs.readFileSync(path.join(here, 'manual.css'), 'utf8');

function html(interno) {
  const body = pages(interno);
  const total = body.length + 1;
  const foot = (n) => `<div class="footer${interno ? ' internal-mark' : ''}"><span>SportMaps · ${interno ? 'Uso interno' : 'Guía de uso'} · Manual del entrenador V2</span><span>Página ${n} de ${total}</span></div>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8" /><title>SportMaps — Manual del entrenador V2 (${interno ? 'Interno' : 'Academias'})</title><style>${css()}</style></head><body>` +
    cover(interno, total) +
    body.map((c, i) => `<div class="page">${c}${foot(i + 2)}</div>`).join('\n') +
    `</body></html>`;
}

async function render() {
  const browser = await launch();
  try {
    html(true); html(false);           // 1ª pasada: registra los recortes
    await hacerRecortes(browser);
    for (const [ver, base] of Object.entries(OUT)) {
      const interno = ver === 'interno';
      const doc = html(interno);
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
