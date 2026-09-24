// Genera el manual "Funciones del entrenador — Club Carmel" en sus dos versiones
// (interno / academias) como HTML + PDF, con las capturas reales de ./shots/.
//
//   node docs/manuales/_src/entrenador-carmel/build.mjs
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
  academias: path.join(repo, 'docs/manuales/academias/entrenador-carmel'),
  interno: path.join(repo, 'docs/manuales/interno/entrenador-carmel'),
};
const SCALE = 2; // capturas a 1600×1000 CSS px con deviceScaleFactor 2

// ── Recortes (coordenadas en CSS px del viewport 1600×1000) ───────────────
const CROP_DEFS = {
  '02-equipos-cabecera.png':  { src: '02-equipos.png',                x: 280, y: 84,  w: 1296, h: 90 },
  '02-equipos-tabla.png':     { src: '02-equipos.png',                x: 280, y: 388, w: 1296, h: 400 },
  '03-nuevo-equipo.png':      { src: '03-nuevo-equipo.png',           x: 464, y: 100, w: 672,  h: 800 },
  '04-inscribir-modal.png':   { src: '04-inscribir-modal.png',        x: 464, y: 0,   w: 672,  h: 760 },
  '05-dialogo.png':           { src: '05-dialogo-ya-tiene-equipo.png', x: 576, y: 332, w: 448,  h: 336 },
  '06-deportistas.png':       { src: '06-deportistas.png',            x: 280, y: 84,  w: 664,  h: 640 },
  '07-nuevo-deportista.png':  { src: '07-nuevo-deportista.png',       x: 576, y: 364, w: 448,  h: 276 },
  '08-asistencia-equipos.png':{ src: '08-asistencia.png',             x: 280, y: 84,  w: 1296, h: 380 },
  '10-reportes-asistencia.png':{ src: '10-reportes-asistencia.png',   x: 280, y: 352, w: 1296, h: 460 },
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

  // ── Cap. 1 — Entrar y tu menú ──
  pgs.push(
    chapter(1, 'Entrar y ubicarte', 'app.sportmaps.co → tu correo y contraseña',
      'Entras con el correo con el que el club te registró. Lo primero que ves es tu <b>Dashboard</b>; a la izquierda está el menú con todo lo que usa un entrenador. Nada de lo que ves aquí toca dinero: en Club Carmel el entrenador no cobra ni ve cobros.') +
    step(1, 'El menú del entrenador',
      p('<b>Principal:</b> Dashboard, <b>Mis Equipos</b> (tus categorías), <b>Mis Deportistas</b> (todos los deportistas del club) y Calendario. <b>Gestión:</b> Entrenamiento → <b>Métricas y Rendimiento</b> (tus sesiones y el mesociclo), Asistencias → <b>Supervisión</b> (pasar lista), <b>Reportes</b> e Informe Mensual.'),
      full('01-dashboard.png', 'Dashboard del entrenador, con el menú lateral.', 330)) +
    tip('Si te falta una categoría', 'Solo te aparecen las categorías donde el club te puso como entrenador. Si falta una, pídele al administrador que te asigne; no hace falta que te cree otra cuenta.') +
    I('Menú del coach en <code>navigation.ts</code>. Hay un cambio sin desplegar (otra sesión, 2026-09-24) que sube "Sesiones de Entrenamiento" al bloque Principal y esconde "Mis Planes" por módulo (<code>gestion_deportiva_disponibilidad_coach</code>). Cuando salga, el capítulo 6 cambia de ruta pero no de contenido.')
  );

  // ── Cap. 2 — Mis Equipos ──
  pgs.push(
    chapter(2, 'Tus categorías y cómo crear una nueva', 'Menú lateral → Mis Equipos',
      'Cada categoría (2014-2015, 2016-17, Juvenil, arqueros…) es un <b>equipo</b> en SportMaps. En Club Carmel el entrenador puede crear categorías nuevas; en la mayoría de escuelas eso lo hace solo la administración.') +
    step(1, 'Ver tus categorías',
      p('La tabla muestra cada categoría con su deporte, sede, <b>entrenador</b>, cuántos deportistas tiene sobre su cupo y su estado. Los tres íconos de la derecha son: <b>inscribir deportistas</b> (persona con +), <b>editar</b> (lápiz) y más opciones.'),
      crop('02-equipos-tabla.png', 'Mis Equipos: una fila por categoría, con el entrenador y el cupo.', 696)) +
    step(2, 'Crear una categoría',
      p('Arriba a la derecha, <b>Nuevo Equipo</b>.'),
      crop('02-equipos-cabecera.png', 'El botón Nuevo Equipo, visible para los entrenadores de Carmel.', 696))
  );
  pgs.push(
    step(3, 'Llenar el formulario y crear',
      p('<b>Nombre</b> (ej. "Categoría 2018-19" o "Equipo Arqueros"), <b>deporte</b>, categoría, una descripción corta, <b>capacidad</b> y <b>sede</b>. El precio mensual se deja en <b>0</b>: Carmel no cobra por la app. Pulsa <b>Crear Equipo</b> y la categoría aparece en tu lista contigo como entrenador.'),
      crop('03-nuevo-equipo.png', 'Formulario de nueva categoría.', 400)) +
    warn('El equipo es del club', 'Tú creas la categoría y quedas como su entrenador, pero <b>no puedes cambiar quién la entrena</b>: eso es de la administración. Si el administrador se la asigna a otro entrenador, deja de aparecerte en tu lista.') +
    I('Flag <code>school_settings.coach_can_create_teams</code> (solo Carmel, migración <code>20260831191515</code>): el coach escribe en <code>teams</code> vía la policy "coach manage own (scoped)"; <code>team_coaches</code>/<code>team_branches</code> siguen siendo admin-only, y la lectura de esas dos tablas para el coach acotado la devolvió <code>20260924100845</code>.')
  );

  // ── Cap. 3 — Inscribir ──
  pgs.push(
    chapter(3, 'Inscribir deportistas en tu categoría', 'Mis Equipos → ícono "Gestionar Deportistas" en la fila',
      'Desde la fila de la categoría, el ícono de la persona con + abre la ventana <b>Inscribir Deportistas</b>. Arriba van los que ya están inscritos; debajo, todos los deportistas del club que todavía no están en esa categoría.') +
    step(1, 'Buscar e inscribir',
      p('Escribe el nombre en el buscador y pulsa <b>Inscribir</b>. Si el deportista no tiene ninguna otra categoría, queda inscrito de inmediato y pasa a la parte de arriba con el sello <b>Inscrito</b>.'),
      crop('04-inscribir-modal.png', 'Inscribir Deportistas: inscritos arriba, disponibles abajo.', 420))
  );
  pgs.push(
    step(2, 'Si el deportista ya está en otra categoría',
      p('Al pulsar <b>Inscribir</b> aparece la pregunta <b>"ya tiene equipo"</b> con dos opciones:') +
      `<table class="tbl"><tr><th>Opción</th><th>Qué pasa</th><th>Cuándo usarla</th></tr>
        <tr><td><b>Agregarlo también</b></td><td>Queda en las dos categorías. La segunda <b>no genera cobro</b>.</td><td><b>Equipo de arqueros</b>, preparación física, selección: el niño sigue en su categoría y además entrena con el grupo especial.</td></tr>
        <tr><td><b>Moverlo</b></td><td>Sale de la categoría anterior y entra a esta.</td><td>Cambio de categoría (ej. un niño de 2020 que estaba en 2018-19 y pasa a 2020-21).</td></tr></table>`,
      crop('05-dialogo.png', 'La pregunta cuando el deportista ya tiene equipo. En Carmel las dos opciones salen activas.', 440)) +
    tip('Equipo de arqueros', 'Crea una sola vez la categoría <b>Equipo Arqueros</b> (capítulo 2) y agrega a cada arquero con <b>Agregarlo también</b>. Cada uno queda en su categoría por edad <b>y</b> en arqueros, y tú puedes pasar lista y planear sesiones solo para ellos.') +
    I('Flag <code>allow_secondary_team_enrollment</code> (migración <code>20260924101138</code>, Carmel true). El modal detecta <code>enrolled_team_id !== team.id</code> antes de llamar; "Agregarlo también" manda <code>POST /enrollments {secondary:true}</code> y el BFF inserta la segunda fila con <code>monthly_fee=0, fee_is_manual=true</code>; "Moverlo" usa <code>PUT /students/:id</code> (camino del editor, solo sin plan). En la captura el deportista del demo tiene plan y por eso "Moverlo" sale deshabilitado; en Carmel nadie tiene plan.')
  );
  pgs.push(
    step(3, 'Quitar a alguien de la categoría',
      p('En la parte de arriba, <b>Remover</b> lo saca <b>solo de esta categoría</b>. Si estaba también en arqueros, sigue en arqueros; si lo quitas de arqueros, sigue en su categoría por edad.', 'no-shot')) +
    warn('El contador de la tarjeta puede quedarse en 0', 'En la lista de Mis Equipos, el número "0/20" de una categoría creada para arqueros puede no reflejar a los que agregaste con "Agregarlo también". La cuenta correcta la ves dentro de <b>Inscribir Deportistas</b> ("N inscritos en este grupo") y en Asistencias.') +
    warn('En Mis Deportistas cada uno aparece con una sola categoría', 'La lista de deportistas muestra la categoría principal (la primera en la que se inscribió). El equipo de arqueros no sale ahí; sí sale en Asistencias, Sesiones y Reportes.') +
    I('<code>teams.current_students</code> lo recalcula un trigger desde <code>children.team_id</code> (legacy), y la vista <code>school_athletes</code> toma UNA inscripción por LATERAL (la más antigua). Pendiente del plan (tanda 3): grupo de trabajo con <code>teams.kind</code> y lectores que unan la secundaria.')
  );

  // ── Cap. 4 — Registrar deportista ──
  pgs.push(
    chapter(4, 'Registrar un deportista nuevo', 'Menú lateral → Mis Deportistas → Agregar Atleta',
      'En Club Carmel el entrenador también puede dar de alta deportistas. <b>Mis Deportistas</b> muestra a todos los del club; el botón <b>Agregar Atleta</b> abre la ficha.') +
    step(1, 'Abrir Mis Deportistas',
      p('Pestañas <b>Activos / Inactivos / Todos</b>, buscador por nombre o acudiente y filtro por categoría. Cada fila trae la edad, la categoría y el acudiente. El botón verde <b>Agregar Atleta</b> está arriba a la derecha.'),
      crop('06-deportistas.png', 'Mis Deportistas (recortado): pestañas, filtros y lista.', 440))
  );
  pgs.push(
    step(2, 'Elegir el tipo y llenar la ficha',
      p('Primero eliges <b>Menor de Edad</b> (requiere acudiente) o <b>Atleta Adulto</b>. Luego la ficha: <b>nombre completo</b>, <b>fecha de nacimiento</b>, la <b>categoría</b> y los datos del acudiente (nombre y teléfono; en Carmel el correo del acudiente no es obligatorio). Guarda y el deportista queda en la lista y en la categoría elegida.'),
      crop('07-nuevo-deportista.png', 'Nuevo Atleta: menor de edad o adulto.', 440)) +
    warn('Revisa el año de nacimiento', 'La fecha de nacimiento es la que define en qué categoría por edad debería estar. Una fecha equivocada (por ejemplo el año en curso) deja al niño mal clasificado en informes y reportes; se corrige con el lápiz de su fila.') +
    I('Flags <code>coach_can_create_athletes</code> y <code>parent_email_optional</code> (Carmel true). El 2026-09-24 había 3 fichas de Carmel con nacimiento en 2026 (Jackson Haime, Lucca Gerard, Jerónimo Carvajal) y 0 acudientes vinculados de 72.')
  );

  // ── Cap. 5 — Asistencia ──
  pgs.push(
    chapter(5, 'Tomar asistencia', 'Menú lateral → Asistencias → Supervisión',
      'Una lista por categoría y por día. Todos arrancan en <b>Presente</b>: solo marcas a quien faltó, llegó tarde o excusó.') +
    step(1, 'Elegir la categoría',
      p('Las tarjetas rojas son tus categorías. Pulsa la del entrenamiento de hoy.'),
      crop('08-asistencia-equipos.png', 'Asistencias: una tarjeta por categoría del entrenador.', 696)) +
    step(2, 'Marcar y finalizar',
      p('Cambia el estado de quien no vino (<b>Ausente</b>, <b>Tarde</b>, <b>Excusado</b>) y pulsa <b>Finalizar</b>. Puedes corregir la lista durante <b>7 días</b>; después solo la administración.', 'no-shot')) +
    tip('Dos categorías, dos listas', 'Un arquero puede quedar presente el mismo día en la lista de su categoría <b>y</b> en la del equipo de arqueros. Son listas separadas y las dos cuentan en su historial. Nada te impide pasar lista dos veces a la misma persona el mismo día si entrenó dos veces.') +
    I('Verificado contra la base 2026-09-24: los únicos índices únicos de <code>attendance_records</code> son por (session_id, persona) y por (persona, team_id, session_id); <code>attendance_sessions</code> es única por (team_id, session_date, start_time). La RPC <code>upsert_attendance_record</code> no tiene regla por día. Carmel no usa planes por sesiones: no se descuenta ningún crédito.')
  );

  // ── Cap. 6 — Sesiones ──
  pgs.push(
    chapter(6, 'Sesiones de entrenamiento y mesociclo', 'Menú lateral → Gestión → Entrenamiento → Métricas y Rendimiento',
      'Aquí planeas el mes y cargas cada sesión. La dirección del club ve lo que cargas: en su pantalla aparece una lista de <b>todas las sesiones de la semana</b> de todos los entrenadores.') +
    step(1, 'Elegir la categoría',
      p('En el <b>Panel de Selección</b>, pestaña Equipos, elige la categoría. A la derecha aparece su <b>roster</b> con <b>Evaluar</b> y <b>Evolución</b> por deportista.'),
      full('09-sesiones.png', 'Métricas y Rendimiento con una categoría seleccionada.', 330)) +
    step(2, 'Planear el mes y cargar sesiones',
      p('<b>Crear Mesociclo</b> arma el plan del mes (período, objetivo, modelo de juego) y de ahí salen las sesiones por día. Si no quieres mesociclo, <b>Crear Sesión</b> carga una sesión suelta: fecha, objetivos, calentamiento, bloques de trabajo y materiales. Para el equipo de arqueros, selecciona esa categoría y planea igual: sus sesiones quedan separadas de las de la categoría por edad.', 'no-shot')) +
    I('Tablas <code>training_mesocycles</code> / <code>training_sessions</code> por <code>team_id</code>, escritura frontend→Supabase sin BFF. Panel del owner: <code>WeekSessionsPanel</code> en <code>TrainingPlansPage</code> (commit <code>9649a7b6</code>). En la pizarra táctica hay una situación "arqueros" y un bloque "Arqueros" en <code>SessionFormDialog</code> en otra sesión sin desplegar.')
  );

  // ── Cap. 7 — Reportes ──
  pgs.push(
    chapter(7, 'Reportes de tu categoría', 'Menú lateral → Gestión → Reportes',
      'Elige la categoría arriba. La pestaña <b>Asistencia</b> muestra el porcentaje del mes por deportista; los que están por debajo del 70% salen marcados.') +
    step(1, 'Asistencia por deportista',
      p('Un renglón por deportista con su porcentaje del mes. Sirve para la charla con el acudiente y para detectar quién se está descolgando. También hay <b>Nómina</b>, <b>Resultados</b> y <b>Goleadores</b>, y el botón <b>Exportar PDF</b>.'),
      crop('10-reportes-asistencia.png', 'Reportes → Asistencia: porcentaje del mes por deportista.', 696)) +
    warn('Informe Mensual', 'El <b>Informe Mensual del deportista</b> (nota del entrenador + evaluación, que llega a la familia) está en el menú pero <b>el club todavía no lo activó</b>. Cuando lo haga, tu parte es escribir la nota de equipo del mes; el club decide cuándo se publica.') +
    I('<code>school_settings.reports_enabled = false</code> en Carmel; 0 evaluaciones y 0 acudientes vinculados. Bloqueo real: consentimiento de los padres (memoria <code>project_club_carmel_reports_consent</code>). Fútbol tiene 31 métricas y solo 5 con <code>parent_label</code>.')
  );

  // ── Cap. 8 — Lo que no haces ──
  pgs.push(
    chapter(8, 'Lo que no ves y a quién pedirle', 'Resumen',
      '') +
    `<table class="tbl"><tr><th>Quieres…</th><th>Quién lo hace</th></tr>
      <tr><td>Cambiar el entrenador de una categoría o agregar un segundo entrenador</td><td>La administración del club, desde Mis Equipos (lápiz)</td></tr>
      <tr><td>Corregir la fecha de nacimiento o el acudiente de un deportista</td><td>Tú, con el lápiz de su fila en Mis Deportistas</td></tr>
      <tr><td>Mover un deportista de categoría</td><td>Tú: Inscribir → "Moverlo" (capítulo 3) o el lápiz de su ficha</td></tr>
      <tr><td>Activar el Informe Mensual para las familias</td><td>El club, con SportMaps</td></tr>
      <tr><td>Ver cobros, mensualidades o pagos</td><td>Nadie desde la app: Club Carmel no cobra por SportMaps</td></tr></table>` +
    tip('Soporte', 'El botón verde de la esquina inferior derecha abre el chat de soporte de SportMaps desde cualquier pantalla.') +
    I('Carmel: <code>billing_enabled=false</code>, módulos de finanzas apagados por super admin (09-19). Pendientes del plan: <code>moduleKey</code> propio para "Mis Planes"/"Membresías" del owner y entrada "Sesiones de entrenamiento" en su menú (bloqueados por trabajo sin commitear de otra sesión), informes personalizados, "solo visualizar el informe".')
  );

  if (isInternal) {
    pgs.push(
      chapter(9, 'Estado de Carmel y cómo se hizo este manual', 'Solo equipo SportMaps — no prometer a la escuela', '') +
      `<table class="tbl"><tr><th>Tema</th><th>Estado 2026-09-24</th></tr>
        <tr><td>Flags de Carmel</td><td><code>coach_can_create_teams</code>, <code>coach_can_create_athletes</code>, <code>parent_email_optional</code>, <code>allow_secondary_team_enrollment</code> en true; <code>billing_enabled</code>, <code>reports_enabled</code> en false.</td></tr>
        <tr><td>Segundo equipo (arqueros)</td><td>En producción desde el 24-sep (main <code>94bb7a70</code>). Noam Lerner quedó por SQL antes del código; el resto los agrega Carmel desde la app.</td></tr>
        <tr><td>Reporte gerencial y sesiones de la semana</td><td>Commit <code>9649a7b6</code> en develop y staging; main lo promueve el usuario.</td></tr>
        <tr><td>Capturas de este manual</td><td>Tenant demo "Club Campestre Demo" en stg, coach de tenis, con los tres flags de Carmel prendidos temporalmente y apagados al terminar. Ningún dato real de Carmel (menores) aparece en el PDF.</td></tr>
        <tr><td>Datos de Carmel</td><td>Equipos ya renombrados por el club ("Categoría 2014-2015", "Categoría 2016-17", "CATEGORIA 2013-2012-2011", "EQUIPO ARQUEROS"). Tres fechas de nacimiento en 2026 por corregir. 0 acudientes vinculados.</td></tr></table>` +
      warn('No vender', 'Marcar posición (arquero/defensa…) en el roster no existe en la práctica (<code>team_members.position_code</code> sin UI, 0 usos). El "grupo de trabajo" real (tabla propia, contadores y listas que lo muestren) es tanda 3 del plan y no está construido.') +
      tip('Regenerar', '<code>BASE_URL=https://stg.sportmaps.co node docs/manuales/_src/entrenador-carmel/capture.mjs</code> con los flags del demo prendidos, luego <code>node docs/manuales/_src/entrenador-carmel/build.mjs</code>. Apagar los flags del demo después.')
    );
  }
  return pgs;
}

// ── Documento ─────────────────────────────────────────────────────────────
function cover(isInternal) {
  return `<div class="page cover"><div class="cover-inner">
    <div><div class="logo"><span class="pin"></span>SportMaps</div></div>
    <div>
      <div class="cover-eyebrow"><span class="dot" style="background:${isInternal ? '#ff8833' : '#4fd17a'}"></span>${isInternal ? '🔒 Uso interno — no enviar a escuelas' : 'Guía de uso · Club Carmel'}</div>
      <h1 class="cover-title">Funciones del entrenador</h1>
      <p class="cover-sub">Categorías, deportistas, equipo de arqueros, asistencia, sesiones y reportes: todo lo que hace un entrenador de Club Carmel en SportMaps, paso a paso.</p>
      <div class="pills">
        <span class="pill">Rol: Entrenador</span>
        <span class="pill">${isInternal ? '9' : '8'} capítulos</span>
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
  return `<!doctype html><html><head><meta charset="utf-8" /><title>SportMaps — Funciones del entrenador (${isInternal ? 'Interno' : 'Club Carmel'})</title><style>${css()}</style></head><body>` +
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
      console.log(`✅ ${ver}: ${base}.pdf (${n} páginas esperadas)`);
    }
  } finally {
    await browser.close();
  }
}

render().catch((e) => { console.error(e); process.exit(1); });
