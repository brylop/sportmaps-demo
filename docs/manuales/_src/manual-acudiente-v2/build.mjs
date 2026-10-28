// Genera el manual del Acudiente V2 en sus dos versiones (academias / interno)
// como HTML + PDF, con las capturas reales de ./shots/ (capture.mjs).
//
//   node docs/manuales/_src/manual-acudiente-v2/build.mjs
//
// Salida: docs/manuales/v2/{academias,interno}/manual-acudiente-v2.{html,pdf}
// Sistema visual: el de todos los manuales (memoria feedback_pdf_manual_template).
import fs from 'node:fs';
import path from 'node:path';
import * as lib from './lib.mjs';

const here = lib.here;
const repo = lib.repo;
const SHOTS = path.join(here, 'shots');
const CROPS = path.join(SHOTS, 'crops');
const OUT = {
  academias: path.join(repo, 'docs/manuales/v2/academias/manual-acudiente-v2'),
  interno: path.join(repo, 'docs/manuales/v2/interno/manual-acudiente-v2'),
};

// Recortes en CSS px. Las capturas del celular son 390 px de ancho @3x; las del
// panel de la escuela, 1440 px @2x.
const CROP_DEFS = {
  'c-inicio-torneos.png':   { src: '01-inicio-completo.png', x: 0, y: 805, w: 390, h: 205, s: 3 },
  'c-partido-arrayanes.png':{ src: '12-partidos-completo.png', x: 0, y: 795, w: 390, h: 570, s: 3 },
  'c-partidos-cabecera.png':{ src: '12-partidos-completo.png', x: 0, y: 60, w: 390, h: 330, s: 3 },
  'c-progreso-partido.png': { src: '13-progreso-con-partido.png', x: 0, y: 300, w: 390, h: 530, s: 3 },
  'c-mas-lista.png':        { src: '22-mas-completo.png', x: 0, y: 70, w: 390, h: 880, s: 3 },
  'c-ficha-docs.png':       { src: '08-hijos-ficha-completo.png', x: 0, y: 600, w: 390, h: 900, s: 3 },
  'c-transferencia.png':    { src: '18-transferencia-completo.png', x: 0, y: 0, w: 390, h: 844, s: 3 },
  'c-estado.png':           { src: '21c-estado-completo.png', x: 0, y: 60, w: 390, h: 840, s: 3 },
  'c-revision.png':         { src: '19b-en-revision.png', x: 0, y: 1380, w: 390, h: 560, s: 3 },
  'c-cal-mes-dia.png':      { src: '04b-cal-mes-dia.png', x: 0, y: 760, w: 390, h: 640, s: 3 },
  'c-owner-bandeja.png':    { src: '37-owner-por-asignar.png', x: 250, y: 150, w: 1190, h: 650, s: 2 },
  'c-owner-asignar.png':    { src: '37b-owner-asignar.png', x: 470, y: 120, w: 500, h: 600, s: 2 },
  'c-registro.png':         { src: '30b-registro.png', x: 0, y: 0, w: 390, h: 1456, s: 3 },
};

async function makeCrops(browser) {
  fs.mkdirSync(CROPS, { recursive: true });
  const page = await browser.newPage();
  for (const [out, d] of Object.entries(CROP_DEFS)) {
    const src = path.join(SHOTS, d.src);
    if (!fs.existsSync(src)) throw new Error(`Falta la captura ${d.src}. Corre capture.mjs: este manual no lleva mockups.`);
    const b64 = fs.readFileSync(src).toString('base64');
    const cropped = await page.evaluate(async ([b64, d]) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const s = d.s;
      const h = Math.min(d.h * s, img.naturalHeight - d.y * s);
      const c = document.createElement('canvas');
      c.width = d.w * s; c.height = h;
      c.getContext('2d').drawImage(img, d.x * s, d.y * s, d.w * s, h, 0, 0, d.w * s, h);
      return c.toDataURL('image/png').split(',')[1];
    }, [b64, d]);
    fs.writeFileSync(path.join(CROPS, out), Buffer.from(cropped, 'base64'));
  }
  await page.close();
}

// ── Piezas ────────────────────────────────────────────────────────────────
const b64 = (file) => {
  const fp = fs.existsSync(path.join(CROPS, file)) ? path.join(CROPS, file) : path.join(SHOTS, file);
  if (!fs.existsSync(fp)) throw new Error(`Falta ${file}`);
  return fs.readFileSync(fp).toString('base64');
};
/** Captura del celular, de ancho fijo. */
const phone = (file, caption = '', w = 200, maxH = 0) =>
  `<figure class="ph" style="width:${w}px"><img class="shot" style="width:${w}px;${maxH ? `max-height:${maxH}px;object-fit:cover;object-position:top` : 'max-height:none'}" src="data:image/png;base64,${b64(file)}" alt="${caption}"/>` +
  (caption ? `<figcaption class="shot-caption">${caption}</figcaption>` : '') + `</figure>`;
const phones = (...items) => `<div class="phones">${items.join('')}</div>`;
const wide = (file, caption, w = 640) =>
  `<div class="shot-wrap"><img class="shot" style="width:${w}px;max-height:none" src="data:image/png;base64,${b64(file)}" alt="${caption}"/><div class="shot-caption">${caption}</div></div>`;

const p = (html, cls = '') => `<p${cls ? ` class="${cls}"` : ''}>${html}</p>`;
const ul = (...items) => `<ul class="lst">${items.map((i) => `<li><span>${i}</span></li>`).join('')}</ul>`;
const step = (n, title, body) =>
  `<div class="step"><div class="step-head"><div class="step-badge">${n}</div><div class="step-title">${title}</div></div>${body}</div>`;
/** Paso con el texto a la izquierda y la captura del celular a la derecha. */
const srow = (n, title, body, pic) =>
  `<div class="srow"><div class="stext">${step(n, title, body)}</div><div class="spic">${pic}</div></div>`;
const warn = (tag, html) => `<div class="callout warn"><span class="tag">${tag}</span>${html}</div>`;
const tip = (tag, html) => `<div class="callout tip"><span class="tag">${tag}</span>${html}</div>`;
const internal = (html) => `<div class="callout internal"><span class="tag">🔒 INTERNO —</span>${html}</div>`;
const chapter = (n, title, crumb, intro) =>
  `<div class="chap"><div class="chapter-head"><div class="chapter-badge">${n}</div><h2 class="chapter-title">${title}</h2></div>` +
  `<div class="breadcrumb">${crumb}</div><hr class="chapter-rule" />${intro ? p(intro) : ''}</div>`;
const tbl = (head, rows) => `<table class="tbl"><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`;

// ── Contenido: cada entrada del array es UNA página ───────────────────────
function pages(I) {
  const pgs = [];

  // ── Cap. 1 — Cómo está organizada ──
  pgs.push(
    chapter(1, 'Cómo está organizada la app', 'Barra de abajo: Inicio · Calendario · Hijos · Pagos · Más',
      'La app de SportMaps para familias está pensada para el celular. Todo lo que necesitas está en <b>cinco pestañas</b> en la barra de abajo. Lo que no cabe en las primeras cuatro está en <b>Más</b>: no se perdió nada.') +
    tbl(['Pestaña', 'Para qué sirve', 'Lo más usado'], [
      ['<b>Inicio</b>', 'Lo importante de hoy en una sola pantalla', 'Saldo y botón Pagar, próximo entreno, tarjeta de cada hijo con la frase del profe'],
      ['<b>Calendario</b>', 'Entrenos, partidos y torneos de tus hijos', 'Próximos días, torneos para inscribirse, vista del mes'],
      ['<b>Hijos</b>', 'La ficha de cada hijo', 'Progreso, asistencia, informes, partidos, ficha de salud, documentos y carnet'],
      ['<b>Pagos</b>', 'Lo que debes y lo que ya pagaste', 'Pagar en línea, subir el comprobante de una transferencia, estado de cuenta'],
      ['<b>Más</b>', 'Todo lo demás', 'Inscripciones, torneos, carnets, constancias, compras, salud, ayuda, Mi cuenta'],
    ]) +
    tip('Para volver', 'Cuando entras a una pantalla interna (un informe, el estado de cuenta, un carnet), arriba aparece <b>«Volver a …»</b> con el nombre de la pestaña de donde saliste. Y el botón redondo de abajo a la derecha es <b>Mapi</b>, el asistente: le puedes preguntar cómo hacer cualquier cosa.') +
    phones(phone('01-inicio.png', 'Inicio', 118), phone('22-mas.png', 'Más', 118), phone('05-hijos-progreso.png', 'Hijos', 118), phone('16-pagos-por-pagar.png', 'Pagos', 118))
  );

  // ── Cap. 2 — Inicio ──
  pgs.push(
    chapter(2, 'Inicio', 'Pestaña Inicio',
      'Inicio te dice en una frase si estás al día y qué viene. No hace falta buscar nada.') +
    srow(1, 'La frase de arriba y el botón Pagar',
      p('Si tienes cobros pendientes, la primera línea lo dice (<b>«Tienes 8 cobros pendientes. Venció el 10 de julio»</b>) y el botón verde te lleva directo a pagarlos. Si estás al día, dice <b>«Todo al día»</b>.') +
      p('Debajo, en verde claro, el <b>próximo entreno</b> de cualquiera de tus hijos: quién, cuándo y dónde.'),
      phone('01-inicio.png', 'Inicio de una familia con dos hijos.', 168)) +
    srow(2, 'La tarjeta de cada hijo',
      p('Cada hijo tiene su tarjeta con el equipo, el profe y si debe algo. Cuando el profe publica el informe del mes, aparece aquí su <b>frase</b> entre comillas.') +
      p('<b>«Ver cómo va»</b> abre la ficha de ese hijo en la pestaña Hijos.'),
      phone('c-inicio-torneos.png', 'Torneos abiertos al final de Inicio.', 168))
  );
  pgs.push(
    srow(3, 'Una pregunta a la vez',
      p('Si a la ficha de tu hijo le falta un dato importante (por ejemplo la <b>EPS</b>), Inicio te lo pregunta con botones: tocas la respuesta y listo. Solo lo ve la escuela, por si hay una emergencia.') +
      p('Al final de Inicio están los <b>torneos o ligas abiertos</b> de la escuela con el botón <b>Inscribirme</b>.'),
      phone('38d-inicio-con-escuela.png', 'La pregunta de la EPS, en el Inicio de otra familia.', 168)) +
    tip('Avisos', 'La campana de arriba muestra cuántos avisos sin leer tienes: cobros nuevos, recordatorios de pago, convocatorias a partidos, torneos abiertos. También los ves en <b>Más → Notificaciones</b>.') +
    I('Hay dos campanas en Inicio (la del encabezado de la app y la de la tarjeta de la escuela). Bug de texto: la frase del entreno termina en <b>«p. m..»</b> (doble punto) porque <code>ParentHomeV2.tsx:171-172</code> agrega «.» después de una hora que ya termina en «p. m.». Propuesta: no agregar el punto si <code>cuando</code> termina en «.». La frase del profe sale del informe mensual publicado (<code>athlete_monthly_reports</code>); la pregunta de la EPS (spec §4.2 la daba como ✖) sí existe y funciona.')
  );

  // ── Cap. 3 — Calendario ──
  pgs.push(
    chapter(3, 'Calendario', 'Pestaña Calendario → Próximos · Torneos · Mes',
      'El calendario lo arma la escuela: tú lo recibes. Ves los entrenos, partidos y torneos de <b>todos tus hijos</b> juntos, con el nombre de cada uno.') +
    srow(1, 'Próximos: lo que viene, día por día',
      p('Cada fila dice la hora, si es <b>Entreno</b> o <b>Partido</b>, de qué hijo, el equipo, el lugar y el profe. Los partidos traen además la <b>nota de la escuela</b> (hora de llegada, uniforme).'),
      phone('02-cal-proximos.png', 'Próximos: entrenos de Sofía y Tomás.', 168)) +
    phones(phone('02b-cal-partido.png', 'Un partido programado, con la nota para la familia.', 320))
  );
  pgs.push(
    srow(2, 'Torneos: inscribir a tu hijo',
      p('Aquí ves los torneos donde tu hijo <b>ya está inscrito</b> («Inscripción lista») y los que tienen <b>inscripciones abiertas</b>, con el precio y la fecha límite. El botón <b>«Inscribir a Sofía»</b> hace la inscripción; si tiene costo, te lleva a pagarla.') +
      p('Cuando es la escuela la que inscribe al equipo, el torneo aparece aquí solo.'),
      phone('03-cal-torneos.png', 'Torneos inscritos y abiertos.', 168)) +
    srow(3, 'Mes: la cuadrícula de siempre',
      p('La vista <b>Mes</b> muestra el mes completo. Los días con eventos tienen una marca; al tocar un día ves sus eventos abajo, con hora, lugar y equipo.'),
      phone('c-cal-mes-dia.png', 'Al tocar el sábado 31 aparece el partido.', 168)) +
    warn('Tú no creas eventos', 'Los eventos los publica la escuela o el profe. Si ves algo mal (una hora, un lugar), avísale a la escuela por WhatsApp desde <b>Más → Escribirle al club</b>.') +
    I('Tocar una tarjeta en «Próximos» no abre ningún detalle (la tarjeta ya trae hora, lugar y nota, pero no hay mapa ni «agregar a mi calendario»). La vista Mes es el <code>CalendarPage</code> de siempre en modo lectura (<code>isParentView</code>): sin «Nuevo Evento», confirmado en vivo.')
  );

  // ── Cap. 4 — Hijos ──
  pgs.push(
    chapter(4, 'Hijos: la ficha de cada uno', 'Pestaña Hijos → Progreso · Asistencia · Informes · Ficha y salud',
      'Si tienes varios hijos, arriba eliges a cuál ver. La ficha tiene cuatro pestañas.') +
    srow(1, 'Progreso',
      p('<b>«En qué va mejorando»</b>: cada habilidad que el profe mide (de 1 a 5), con la flecha de si subió o bajó desde la medición anterior. Abajo, qué <b>trabajar en casa</b>.') +
      p('Tu hijo <b>solo se compara con su propio avance</b>, nunca con otros niños. <b>«Ver las gráficas»</b> abre el detalle mes a mes y las rutinas que compartió el profe.'),
      phone('05-hijos-progreso.png', 'Progreso de Tomás.', 168)) +
    srow(2, 'Asistencia',
      p('El porcentaje de cada mes y la lista de los últimos entrenos: <b>Vino</b>, <b>Llegó tarde</b>, <b>No vino</b> o <b>Con excusa</b>. Llegar tarde cuenta como haber venido. <b>«Ver todo el historial»</b> muestra todos los meses.'),
      phone('06-hijos-asistencia.png', 'Asistencia por mes.', 168))
  );
  pgs.push(
    srow(3, 'Informes',
      p('Tres cosas que publica la escuela:') +
      ul('<b>Informe del mes</b>: cómo le fue, lo mejor del mes y qué trabajar. Se puede <b>descargar en PDF</b>.',
        '<b>Lo que trabajó el equipo</b>: el informe del entreno, con el dato de tu hijo frente al grupo (sin nombres de otros niños).',
        '<b>Informes de partidos</b>: el reporte del profe después de cada partido (capítulo 5).'),
      phone('07-hijos-informes.png', 'La pestaña Informes.', 168)) +
    srow(4, 'El informe del mes',
      p('Arriba, la asistencia del mes y el botón <b>Descargar PDF</b>. Luego la frase del equipo, lo mejor del mes, lo que hay que trabajar y cada habilidad por área (físico, técnico, táctico), con goles y asistencias si es fútbol.'),
      phone('10-informe-mensual.png', 'Informe de septiembre de Tomás.', 168))
  );
  pgs.push(
    srow(5, 'Ficha y salud: los datos',
      p('Documento, EPS, tipo de sangre, alergias y contacto de emergencia. Si algo está mal o falta, toca <b>«Corregir un dato»</b>: se abre el formulario con los datos del hijo.') +
      p('Desde aquí también está <b>«Mostrar carnet»</b>.'),
      phone('08-hijos-ficha.png', 'Ficha y salud de Sofía.', 168)) +
    srow(6, 'Documentos: todos opcionales',
      p('Hay diez tipos: documento del deportista (frente y reverso), foto, certificado de la EPS, paz y salvo, documento del acudiente (frente y reverso), <b>firma del acudiente</b>, <b>firma del deportista</b> y otro documento.') +
      p('<b>Ninguno es obligatorio.</b> Súbelos si la escuela te los pide: toca <b>Subir</b>, elige una foto o un PDF y queda <b>«Cargado»</b>, con <b>Ver</b> y <b>Cambiar</b>.') +
      phones(phone('09-documento-subido.png', 'Un documento ya cargado.', 300)),
      phone('c-ficha-docs.png', 'La lista de documentos.', 168)) +
    I('<b>Bug de producto (verificado en vivo): la escuela no ve lo que sube la familia.</b> La V2 guarda en <code>identity-documents/children/&lt;uid del acudiente&gt;/&lt;child_id&gt;/docs/</code> (<code>useHijosData.ts:86</code>), pero la ficha del atleta en la escuela lista <code>children/&lt;child_id&gt;/docs</code> (<code>SchoolStudentsManagementPage.tsx:548</code>). Con el token del owner demo, la ruta vieja devuelve <code>[]</code> y la nueva sí trae el archivo: la RLS deja leer, la pantalla no busca ahí. Propuesta: registrar cada subida en <code>athlete_documents</code> (la tabla que la escuela ya lista para fichas sin cuenta) o que la ficha de la escuela liste también la carpeta del acudiente. Hasta entonces la frase «los ve solo la escuela» es cierta en permisos pero la escuela no los encuentra.')
  );
  pgs.push(
    srow(7, 'Carnet digital',
      p('En <b>Más → Carnets</b> (o «Mostrar carnet» en la ficha) están los carnets de tus hijos con su vigencia. Al tocar uno se abre en grande con el <b>código QR</b> para la entrada de la escuela, el equipo, la EPS y el contacto de emergencia.') +
      p('Abajo: <b>Ver el reverso</b>, <b>Descargar el carnet</b> y <b>Abrir el enlace para compartir</b>.'),
      phones(phone('14-carnets.png', 'Carnets vigentes.', 150), phone('14b-carnet-grande.png', 'El carnet en grande.', 150))) +
    srow(8, '¿Cómo te fue en el entreno?',
      p('Después de algunos entrenos te llega un aviso: <b>«¿Cómo estuvo el entreno de hoy?»</b>. Son 5 preguntas de un toque, menos de 30 segundos, y ayudan al profe a cuidar cuánto entrena tu hijo.') +
      p('Para <b>agregar otro hijo</b>, en la pestaña Hijos toca <b>«Agregar hijo»</b> arriba a la derecha.'),
      phone('11b-autoevaluacion.png', 'La autoevaluación después del entreno.', 168)) +
    I('Tabs de la ficha a 390 px: «Ficha y salud» se corta («Ficha y salu…») porque las cuatro pestañas no caben (<code>HijosV2.tsx:100-106</code>, <code>TabsList</code> sin scroll ni etiqueta corta). El carnet de Tomás muestra como «último pago» un torneo de $50.000 y la marca «Cuota vencida»: el dato es correcto, pero el pago destacado no es la mensualidad.')
  );

  // ── Cap. 5 — Partidos y convocatorias ──
  pgs.push(
    chapter(5, 'Partidos y convocatorias de mi hijo', 'Hijos → Informes → Informes de partidos',
      'Cuando el equipo de tu hijo juega, la escuela te avisa antes (convocatoria) y te cuenta después (reporte del partido).') +
    srow(1, 'Te avisan que tu hijo está convocado',
      p('Cuando el profe arma la convocatoria te llega un aviso: <b>«⚽ Convocatoria: vs Halcones FC — Tomás está convocado para el partido del 31/10 a las 10:00, en Cancha fútbol 11»</b>. El partido aparece también en tu <b>Calendario</b>, con la nota de llegada y uniforme.') +
      p('Si tu hijo <b>no puede ir</b>, avísale al profe o a la escuela lo antes posible por WhatsApp (<b>Más → Escribirle al club</b>).'),
      phone('15-notif-convocatoria.png', 'El aviso de la convocatoria.', 168)) +
    I('<b>FALLA — el acudiente no puede responder «Va / No va».</b> El aviso de <code>save_match_roster</code> dice «Cuéntanos si va» y enlaza a <code>/calendar</code>, y el entrenador ve «0 van · 0 no van · 4 sin responder»; pero en la V2 del acudiente no hay ningún botón para responder: <code>responderConvocatoria</code>/<code>misConvocatorias</code> (<code>lib/api/v2Contratos.ts:160-172</code>) solo se usan en <code>AthleteHomeV2.tsx</code> y <code>AthleteTrainingV2.tsx</code>. La RPC funciona para el acudiente: <code>my_callups</code> con el token de Mauricio devuelve la convocatoria de Tomás (<code>lineup 537b7aaa…</code>, <code>response: null</code>). Propuesta: tarjeta «Convocado: ¿va Tomás?» con Va / No va en Inicio (como el deportista) y en la fila del partido en Calendario › Próximos, reutilizando <code>misConvocatorias()</code> + <code>responderConvocatoria(lineupId, {tipo:\'child\', id}, …)</code>. Por eso la versión para academias dice «avísale al profe».')
  );
  pgs.push(
    srow(2, 'Después del partido: el reporte del profe',
      p('En <b>Hijos → Informes → Informes de partidos</b> ves cada partido con su resultado (<b>Ganó</b>, <b>Empató</b>, <b>Perdió</b>), el <b>resumen</b>, <b>cómo fue el partido</b> y <b>qué van a mejorar</b>. Si la administración dejó un comentario, también sale.') +
      p('Debajo está <b>«Tu respuesta»</b>: escríbele al profe lo que quieras sobre el partido y toca <b>Enviar</b>. Puedes editarla después.'),
      phone('c-partido-arrayanes.png', 'Reporte del partido y la respuesta de la familia.', 168)) +
    srow(3, 'La evaluación del partido',
      p('Si la escuela comparte las evaluaciones de partido con las familias, la calificación de tu hijo (actitud, técnica, decisiones, físico, comunicación, cumplimiento del rol) aparece en <b>Progreso</b>, junto con lo que el profe mide en los entrenos. Cada familia ve <b>solo la de su hijo</b>.'),
      phone('c-progreso-partido.png', 'La evaluación del partido ya en Progreso.', 168)) +
    I('Dos interruptores de escuela deciden lo que ve la familia: <code>school_settings.share_match_reports</code> (reporte) y <code>share_match_evaluations</code> (evaluación). El de evaluaciones tiene interruptor en la pantalla del partido; <b>el de reportes no tiene ninguna pantalla</b>: nace apagado (migración <code>20261022110209</code>, solo se encendió Besser) y el diálogo dice «las familias verán esto solo si la escuela tiene activado el reporte». Para el demo se encendió por SQL. Bug 2: la métrica de texto «Comentario del coach» se guarda con <code>value = 0</code> y el texto en <code>notes</code>; la familia ve «Comentario 0» como si fuera una habilidad y nunca ve el comentario (<code>hijosUtils.ts:233</code> <code>isSkillMetric</code> no excluye métricas de texto y <code>skillRows</code> no lee <code>notes</code>). La evaluación tampoco sale dentro de la tarjeta del partido en «Informes de partidos».')
  );

  // ── Cap. 6 — Pagos ──
  pgs.push(
    chapter(6, 'Pagos', 'Pestaña Pagos → Por pagar · Pagados',
      'Arriba ves cuánto debes en total. Cada cobro viene <b>ya marcado</b>: si los quieres pagar todos, no tienes que tocar nada más.') +
    srow(1, 'Por pagar',
      p('Cada cobro dice el concepto, de qué hijo es, desde cuándo está vencido (y si incluye recargo por mora) y el valor. Para dejar uno por fuera, <b>desmárcalo</b>: el botón de abajo se recalcula solo (por ejemplo de 8 a 7 cobros).') +
      p('Los cobros que ya tienen un comprobante enviado salen abajo como <b>«En revisión»</b>.'),
      phone('16-pagos-por-pagar.png', 'Pagos: los cobros vienen marcados.', 168)) +
    srow(2, 'Pagar en línea',
      p('Toca <b>«Pagar N cobros»</b>. Se pagan <b>uno por uno</b>, con el valor de cada cobro. Elige <b>Pagar en línea</b> (tarjeta, PSE o Nequi): el resumen muestra el valor, el recargo por pago en línea si la escuela lo cobra y el total. El último botón te lleva a la pasarela segura para pagar.'),
      phone('17-pagar-online.png', 'Antes de ir a la pasarela.', 168)) +
    I('La prueba se detuvo en este botón: no se abrió la pasarela ni se pagó nada. Con varios cobros marcados se pagan en serie (<code>MyPaymentsPage.tsx:512</code> <code>startPaying</code>), un checkout por cobro; el recargo del 3 % es de la escuela.')
  );
  pgs.push(
    srow(3, 'Ya transferí: subir el comprobante',
      p('Si pagaste por transferencia, Nequi o Daviplata, toca <b>«Ya transferí: subir el comprobante»</b>. En la ventana elige <b>Transferencia / Nequi / Daviplata</b>: aparecen los datos de la cuenta de la escuela (con botón para copiar) y <b>«Sube tu comprobante»</b>.') +
      p('Elige la foto o el PDF del comprobante, espera el chulo de <b>«Comprobante cargado»</b> y confirma. Sale el mensaje <b>«Pago registrado. Validaremos tu comprobante pronto»</b>.'),
      phone('18-transferencia.png', 'Datos de la cuenta y subir comprobante.', 168)) +
    srow(4, 'En revisión',
      p('Ese cobro pasa a <b>«En revisión»</b> hasta que la escuela compare el comprobante con su cuenta. Cuando lo aprueba, pasa a <b>Pagados</b> y te llega un aviso <b>«Pago confirmado»</b>.') +
      tip('Un comprobante por cobro', 'Si hiciste una sola transferencia por varios cobros, súbela en uno y avísale a la escuela para que la reparta.'),
      phone('c-revision.png', 'Cobros con comprobante enviado.', 168)) +
    I('«Ya transferí» abre el mismo checkout con <b>«Pagar online» preseleccionado</b>: la familia tiene que cambiar a Transferencia a mano (<code>MyPaymentsPage.tsx:531-541</code> <code>startUploadingProof</code> llama a <code>openCheckoutFor</code> sin método inicial). Propuesta: pasar <code>initialMethod=\'transfer\'</code>. Comprobante de prueba enviado para «Mensualidad Julio 2026 — Tenis (Tomás)» de Mauricio; el OCR no lo bloqueó.')
  );
  pgs.push(
    srow(5, 'Pagados y recibos',
      p('En <b>Pagados</b> está todo lo que ya pagaste, con el valor, el medio (en línea, tarjeta, transferencia) y la fecha. Los que tienen <b>Recibo</b> lo abren con un toque.'),
      phone('20-pagados.png', 'Historial de pagos.', 168)) +
    srow(6, 'Estado de cuenta de cada hijo',
      p('Desde <b>Pagos</b> (o el enlace del estado de cuenta) eliges al hijo y ves cuánto debe, cuántos cobros están vencidos y cuál está en revisión, <b>mes a mes</b>, con <b>«Pagar este cobro»</b> en cada uno. Al final, el resumen desde que entró y el botón <b>Imprimir</b> (últimos 12 meses).'),
      phone('c-estado.png', 'Estado de cuenta de Tomás.', 168)) +
    I('Etiqueta equivocada: los cobros de Tenis de Tomás (sin <code>child_id</code>, con <code>parent_id</code> = Mauricio) salen como <b>«Tú (como atleta)»</b> (<code>MyPaymentsPage.tsx:303</code>): la regla asume que un cobro sin hijo es del acudiente como atleta. En el demo es un dato sembrado sin <code>child_id</code>, pero en producción pasa con cualquier cobro de menor al que le falte el hijo. Propuesta: rotular «Tú» solo si el usuario tiene inscripción propia; si no, «Sin deportista asignado».')
  );

  // ── Cap. 7 — Más ──
  pgs.push(
    chapter(7, 'Más', 'Pestaña Más → Mi familia · Ayuda · Cuenta',
      'Todo lo que no está en las otras pestañas. Nada se quitó: lo que tenías antes está aquí.') +
    srow(1, 'Mi familia',
      ul('<b>Inscripciones y planes</b>: el plan activo de cada hijo, agendar clases y reservas.',
        '<b>Mis eventos y torneos</b>: las inscripciones a torneos, aprobadas y pagadas.',
        '<b>Carnets</b> de tus hijos (capítulo 4).',
        '<b>Constancias</b>: pide una constancia de estudio o de deportista y la escuela te la entrega aquí.',
        '<b>Tienda del club</b> y <b>Mis compras</b>: si la escuela tiene tienda, tus pedidos y en qué van.',
        '<b>Salud de mis hijos</b> y <b>Mis citas</b>: el plan y las citas con un profesional de salud, si lo hay.'),
      phone('c-mas-lista.png', 'Todo lo que hay en Más.', 168)) +
    srow(2, 'Ayuda',
      ul('<b>Escribirle al club</b>: abre el WhatsApp de la escuela.',
        '<b>Mensajes</b>: los avisos del club llegan a Notificaciones; para preguntar algo, el WhatsApp.',
        '<b>Centro de ayuda</b>: guías paso a paso.',
        '<b>Mapi</b>: el botón redondo de abajo a la derecha. Escríbele tu pregunta («¿Cómo subo el comprobante?») y te responde con los pasos.'),
      phone('26b-mapi-respuesta.png', 'Mapi responde.', 168)) +
    I('<b>Mapi da pasos de la versión anterior</b>: respondió «Abre Pagos en el menú lateral (sección Seguimiento) → PAGAR…». El acudiente V2 no tiene menú lateral. Origen: <code>bff/src/data/app-map.ts:405-460</code> (rol <code>parent</code>) describe el menú V1 («Principal / Seguimiento / Mi Actividad», «Mis Pagos → pestaña Pendientes»). Hay que reescribirlo con las 5 pestañas. El Centro de ayuda muestra al acudiente artículos de escuela («Cómo registrar un pago manual», «Configurar Wompi») porque «Todas» no filtra por rol.')
  );
  pgs.push(
    srow(3, 'Mi cuenta',
      p('<b>Mi cuenta</b> junta tu perfil y la configuración en un solo lugar:') +
      ul('<b>Perfil</b>: nombre, WhatsApp, fecha de nacimiento y foto.',
        '<b>Notificaciones</b>: qué avisos te llegan y por dónde.',
        '<b>Privacidad</b>: quién ve tu perfil.',
        '<b>Seguridad</b>: cambiar la contraseña y eliminar la cuenta.') +
      p('Al final de Más está <b>Cerrar sesión</b>.'),
      phones(phone('23-mi-cuenta.png', 'Mi cuenta.', 150), phone('23-perfil.png', 'Perfil.', 150))) +
    srow(4, 'Notificaciones',
      p('Todos los avisos de la escuela: cobros nuevos, recordatorios de pago, pagos confirmados, convocatorias, partidos nuevos, torneos abiertos y la pregunta de cómo estuvo el entreno. Al tocar uno te lleva a la pantalla que corresponde. <b>«Marcar todas como leídas»</b> limpia el contador.'),
      phone('24-notificaciones.png', 'Notificaciones.', 168)) +
    I('Por URL el acudiente entra a <code>/announcements</code> (ve «Nuevo Anuncio») y a <code>/dashboard/polls</code> (ve «Crea la encuesta del día» y el BFF responde 403): las rutas no tienen <code>ProtectedRoute</code> (<code>App.tsx:648</code> y <code>:651</code> en develop). No están en Más (el spec §8 las quita), pero conviene cerrarlas por rol. «Mis eventos y torneos» abierto desde Más dice «Volver a Calendario» (<code>acudienteTabs.ts</code> lo asigna a Calendario). En <b>Mi cuenta › Seguridad</b> el BFF responde 500 en <code>GET /api/v1/me/data-deletion-request</code>: la tabla <code>account_deletion_requests</code> (migración <code>20260522141000</code>) no existe en la base viva, así que «eliminar cuenta» (Ley 1581) no puede funcionar. En dev aparece <b>Explorar</b> en Más porque <code>VITE_SHOW_EXPLORE=true</code> en ese ambiente; revisar que en prod esté apagado.')
  );

  // ── Cap. 8 — Código de escuela ──
  pgs.push(
    chapter(8, 'Unirme a la escuela con el código', 'Inicio → «¿Ya tienes escuela?» · enlace /unirse?codigo=…',
      'Si creaste tu cuenta y todavía no ves a tu hijo, pídele a la escuela su <b>código</b> (3 letras y 4 caracteres, por ejemplo <b>CAM-ABUP</b>). Con él la escuela te encuentra y te asigna la categoría.') +
    srow(1, 'Dónde se ingresa el código',
      p('Hay tres caminos, y los tres llegan al mismo lugar:') +
      ul('En <b>Inicio</b> (y en <b>Hijos</b>) aparece el aviso <b>«¿Ya tienes escuela? Ingresa el código que te dio tu escuela»</b> mientras tu cuenta no tenga escuela.',
        'Al crear la cuenta, el segundo paso tiene el campo opcional <b>«¿Ya tienes escuela? Ingresa su código»</b>.',
        'Si la escuela te mandó el <b>enlace</b> o el <b>QR</b>, ábrelo: si no has entrado, te pide entrar o crear la cuenta y después usa el código solo.'),
      phone('36-banner-sin-escuela.png', 'El aviso en Inicio de una cuenta sin escuela.', 168)) +
    phones(phone('30-unirse-sin-sesion.png', 'El enlace, sin haber entrado.', 125), phone('31-onboarding-codigo.png', 'El código al crear la cuenta.', 125))
  );
  pgs.push(
    srow(2, '¿Es tu escuela?',
      p('Al buscar el código aparece el <b>nombre, el logo y la ciudad</b> de la escuela. Si es la tuya, toca <b>«Sí, es mi escuela»</b>; si no, <b>«No, cambiar el código»</b>.'),
      phone('32-unirse-confirmar.png', 'Confirmar la escuela.', 168)) +
    srow(3, '¿Para quién es?',
      p('Elige <b>«Para mi hijo(a)»</b> (eres acudiente) o <b>«Para mí»</b> (tú entrenas). Escribe el <b>nombre completo</b> y la <b>fecha de nacimiento</b>, y si quieres la <b>categoría</b> que crees que le toca (es solo una sugerencia: la escuela decide). Toca <b>Enviar solicitud</b>.'),
      phone('33-unirse-para-quien.png', 'Los datos del hijo.', 168))
  );
  pgs.push(
    srow(4, 'Solicitud enviada',
      p('Listo: <b>«La escuela te asignará la categoría»</b>. Puedes <b>unir a otro hijo</b> con el mismo código. Mientras tanto, Inicio y Hijos muestran la solicitud en amarillo, con la opción <b>Cancelar solicitud</b>.') +
      p('Todavía <b>no se crea ningún cobro</b>: eso pasa cuando la escuela asigna la categoría.'),
      phones(phone('34-unirse-enviada.png', 'Solicitud enviada.', 150), phone('35b-hijos-solicitud.png', 'La solicitud en Hijos.', 150))) +
    srow(5, 'La escuela asigna y tu hijo aparece',
      p('Cuando la escuela elige el equipo te llegan dos avisos: <b>«¡Bienvenido(a) a la escuela! Mateo ya quedó en Fútbol — Sub-12»</b> y, si la escuela cobra, el <b>primer cobro</b> según sus reglas. Desde ese momento tu hijo tiene su ficha en Hijos y su cobro en Pagos.'),
      phones(phone('38c-aviso-asignado.png', 'Los avisos al asignar.', 150), phone('38-hijo-asignado.png', 'Mateo ya en su equipo.', 150)))
  );
  pgs.push(
    srow(6, 'El primer cobro',
      p('Si la categoría tiene mensualidad, el primer cobro aparece en <b>Pagos</b> con el nombre de tu hijo, y se paga igual que cualquier otro (capítulo 6).'),
      phone('38b-cobro-nuevo.png', 'El primer cobro, en Pagos.', 150)) +
    p('<b>Lo que hace la escuela</b> (para que sepas qué pasa del otro lado): en <b>Deportistas → «Por asignar»</b> ve tu solicitud con la edad y la categoría que sugeriste, y elige el equipo. El entrenador es el del equipo; el primer cobro sigue la regla normal de la escuela.') +
    wide('c-owner-bandeja.png', 'Del lado de la escuela: el código y la bandeja «Por asignar».', 600) +
    I('Probado de punta a punta en dev con una cuenta nueva creada por el registro normal (<code>familia.sincodigo@demo.sportmaps.co</code>) → onboarding con el código precargado desde <code>/unirse?codigo=CAM-ABUP</code> → solicitud <code>a4e92e21…</code> → asignada por el owner demo a «Fútbol — Sub-12» (no hay equipo con cuota 0 en el demo; el único es la sonda inactiva). Resultado: ficha <code>09c2b810…</code>, inscripción activa <code>2f1645ad…</code> con cuota $180.000 y <b>un cobro de $180.000 que vence el mismo día de la asignación</b> (concepto «Suscripción — Mensualidad completa, vence día 26 — Mateo Pardo Demo») <b>con <code>parent_id</code> NULL</b>: la familia lo ve (por <code>child_id</code>) pero el bot de WhatsApp, que busca por <code>parent_id</code>, no (spec §4.1). Origen: rama <code>child_existing</code> de <code>bff/src/routes/students-create-one.route.ts:1018-1062</code>, que no pasa el acudiente a <code>buildAltaPayments</code>. A 390 px, el pie del onboarding con código («Anterior · Más tarde · Unirme a mi escuela») se sale de la pantalla y el botón queda cortado (<code>ParentOnboarding.tsx</code>, rama <code>isJoinCodeShape</code>).')
  );

  // ── Cap. 9 — Preguntas frecuentes ──
  pgs.push(
    chapter(9, 'Preguntas frecuentes', 'Lo que más preguntan las familias', '') +
    tbl(['Pregunta', 'Respuesta'], [
      ['No veo a mi hijo en la app.', 'Si la escuela te invitó, acepta la invitación que te llegó al correo o al WhatsApp. Si no, pídele a la escuela su <b>código</b> e ingrésalo en Inicio (capítulo 8). También puedes registrarlo tú con <b>Agregar hijo</b>.'],
      ['Pagué y el cobro sigue apareciendo.', 'Si pagaste en línea, el cobro pasa a Pagados en unos minutos. Si pagaste por transferencia, sube el comprobante: queda <b>En revisión</b> hasta que la escuela lo apruebe.'],
      ['Pagué en efectivo en la escuela.', 'La escuela registra el pago y el cobro pasa a <b>Pagados</b>. No tienes que subir nada.'],
      ['¿Por qué hay un recargo?', 'Algunas escuelas cobran recargo por mora después de la fecha límite, o un recargo por pago en línea. Lo ves en el detalle de cada cobro antes de pagar.'],
      ['¿Hay descuento por pagar a tiempo?', 'Si tu escuela lo activó, al pagar dentro de los primeros días ves el precio de lista tachado junto al precio con descuento, antes de elegir cómo pagar.'],
      ['¿Puedo crear o cambiar un evento del calendario?', 'No. El calendario lo publica la escuela. Si algo está mal, escríbele al club.'],
      ['Convocaron a mi hijo y no puede ir.', 'Avísale al profe o a la escuela por WhatsApp lo antes posible (<b>Más → Escribirle al club</b>).'],
      ['¿Tengo que subir todos los documentos?', 'No. Todos son opcionales. Súbelos solo si la escuela te los pide.'],
      ['¿Quién ve las evaluaciones de mi hijo?', 'Tú, la escuela y el profe. Tu hijo solo se compara con su propio avance, nunca con otros niños.'],
      ['¿Dónde cambio mi correo, WhatsApp o contraseña?', 'En <b>Más → Mi cuenta</b>: Perfil para tus datos y Seguridad para la contraseña.'],
      ['Tengo una duda que no está aquí.', 'Pregúntale a <b>Mapi</b> (el botón redondo de abajo a la derecha) o escríbele al club por WhatsApp.'],
    ])
  );

  if (I('x')) {
    pgs.push(
      chapter(10, 'Hallazgos de la prueba y lo que no existe', 'Solo equipo SportMaps — no prometer a las escuelas', '') +
      tbl(['#', 'Hallazgo', 'Dónde', 'Gravedad'], [
        ['1', 'El acudiente no puede responder «Va / No va» a una convocatoria (el aviso lo pide)', '<code>v2Contratos.ts:160-172</code> solo lo usan pantallas de deportista', 'Alta'],
        ['2', 'La escuela no ve los documentos que sube la familia (ruta distinta)', '<code>useHijosData.ts:86</code> vs <code>SchoolStudentsManagementPage.tsx:548</code>', 'Alta'],
        ['3', 'Mapi responde con el menú V1 («menú lateral, sección Seguimiento»)', '<code>bff/src/data/app-map.ts:405-460</code>', 'Media'],
        ['4', 'Reporte del partido: no hay pantalla para encender <code>share_match_reports</code>', 'migración <code>20261022110209</code>; <code>MatchReportDialog.tsx:142-146</code>', 'Media'],
        ['5', 'Cobro del alta por código nace con <code>parent_id</code> NULL y vence el mismo día', '<code>students-create-one.route.ts:1018-1062</code>', 'Media'],
        ['6', '«Comentario del coach» sale como «Comentario 0»; el texto no se ve', '<code>hijosUtils.ts:233</code> / <code>skillRows</code>', 'Media'],
        ['7', '«Ya transferí» abre con «Pagar online» preseleccionado', '<code>MyPaymentsPage.tsx:531-541</code>', 'Baja'],
      ]) +
      tbl(['#', 'Hallazgo', 'Dónde', 'Gravedad'], [
        ['8', 'Cobros sin hijo rotulados «Tú (como atleta)»', '<code>MyPaymentsPage.tsx:303</code>', 'Baja'],
        ['9', '/announcements y /dashboard/polls abiertos al acudiente por URL', '<code>App.tsx:648, 651</code>', 'Baja'],
        ['10', 'Frase del entreno «p. m..»; pestaña «Ficha y salu…» cortada; pie del onboarding con código cortado a 390 px', '<code>ParentHomeV2.tsx:172</code>, <code>HijosV2.tsx:100</code>, <code>ParentOnboarding.tsx</code>', 'Baja'],
        ['11', 'Recordatorio «Todavía no respondes el entreno» duplicado (dos filas idénticas a las 20:00:00)', 'job de recordatorio post-entreno (¿dos BFF?)', 'Baja'],
        ['12', 'Mi cuenta › Seguridad: el BFF responde 500 al consultar la solicitud de eliminar cuenta (la tabla <code>account_deletion_requests</code> no existe en la base viva)', '<code>bff/src/routes/me.routes.ts:229-241</code>; migración <code>20260522141000</code> sin aplicar en esa parte', 'Media'],
        ['13', 'Mapi tapa botones (Enviar del reporte, Subir de documentos) a 390 px', 'burbuja fija del soporte', 'Baja'],
      ]) +
      tbl(['No existe todavía', 'Nota'], [
        ['Responder la convocatoria (acudiente)', 'Ver #1. El deportista adulto sí lo tiene.'],
        ['Detalle de un evento desde «Próximos»', 'La tarjeta no abre nada (sin mapa, sin agregar al calendario del teléfono).'],
        ['Pagar varios cobros en una sola transacción', 'Se pagan uno por uno.'],
        ['Informe del entreno publicado en el demo', 'La pantalla se probó en su estado vacío (BFF 404 «aún no publicado», esperado).'],
      ])
    );
  }
  return pgs;
}

// ── Documento ─────────────────────────────────────────────────────────────
function cover(isInternal, nChapters) {
  return `<div class="page cover"><div class="cover-inner">
    <div><div class="logo"><span class="pin"></span>SportMaps</div></div>
    <div>
      <div class="cover-eyebrow"><span class="dot" style="background:${isInternal ? '#ff8833' : '#4fd17a'}"></span>${isInternal ? '🔒 Uso interno — no enviar a escuelas' : 'Guía de uso · Familias'}</div>
      <h1 class="cover-title">Manual del acudiente</h1>
      <p class="cover-sub">Todo lo que hace una familia en SportMaps desde el celular: el inicio, el calendario de los hijos, su progreso, partidos y documentos, los pagos y cómo unirse a la escuela con su código.</p>
      <div class="pills">
        <span class="pill">App de familias · versión 2</span>
        <span class="pill">${nChapters} capítulos</span>
        <span class="pill">Capturas reales del celular</span>
        ${isInternal ? '<span class="pill" style="border-color:#ff8833;color:#ffcf9e">Uso interno</span>' : ''}
      </div>
    </div>
    <div class="cover-footer">SportMaps © 2026 · octubre${isInternal ? ' · probado en dev.sportmaps.co el 26-oct-2026' : ''}</div>
  </div></div>`;
}

function html(isInternal) {
  const I = (h) => (isInternal ? internal(h) : '');
  const body = pages(I);
  const label = isInternal ? 'Uso interno' : 'Guía de uso';
  const css = fs.readFileSync(path.join(here, 'manual.css'), 'utf8');
  // Paginación automática: cada grupo que abre con un capítulo empieza página;
  // los bloques (hijos directos del grupo) se van acomodando y el que no cabe
  // pasa a la página siguiente. El título del capítulo viaja con su primer bloque.
  const layout = `<script>window.addEventListener('load', async () => { await document.fonts.ready;
    const MAX = 1056;
    const pages = []; let cur = null;
    const nueva = () => { cur = document.createElement('div'); cur.className = 'page'; document.body.appendChild(cur); pages.push(cur); };
    for (const g of [...document.querySelectorAll('#src > .grp')]) {
      const kids = [...g.children];
      if (g.dataset.chapter === '1' || !cur) nueva();
      for (let i = 0; i < kids.length; i++) {
        const unit = [kids[i]];
        if (kids[i].classList.contains('chap') && kids[i + 1]) unit.push(kids[++i]);
        unit.forEach((k) => cur.appendChild(k));
        if (cur.scrollHeight > MAX && cur.children.length > unit.length) {
          // Un aviso que no cabe se lleva consigo el bloque anterior (el paso al
          // que se refiere), para no dejar una página con un aviso suelto.
          const prev = unit[0].previousElementSibling;
          const conPrevio = unit[0].classList.contains('callout') && prev && !prev.classList.contains('chap') && cur.children.length > unit.length + 1;
          nueva();
          if (conPrevio) cur.appendChild(prev);
          unit.forEach((k) => cur.appendChild(k));
        }
      }
    }
    document.getElementById('src').remove();
    const total = pages.length + 1;
    pages.forEach((pg, i) => {
      const f = document.createElement('div');
      f.className = 'footer${isInternal ? ' internal-mark' : ''}';
      f.innerHTML = '<span>SportMaps · ${label}</span><span>Página ' + (i + 2) + ' de ' + total + '</span>';
      pg.appendChild(f);
    });
    window.__laidOut = true;
  });<\/script>`;
  return `<!doctype html><html><head><meta charset="utf-8" /><title>SportMaps — Manual del acudiente (${isInternal ? 'Interno' : 'Academias'})</title><style>${css}</style></head><body>` +
    cover(isInternal, isInternal ? 10 : 9) +
    `<div id="src" style="width:816px">` +
    body.map((pg) => `<div class="grp" data-chapter="${pg.startsWith('<div class="chap">') ? 1 : 0}">${pg}</div>`).join('') +
    `</div>` + layout + `</body></html>`;
}

async function render() {
  const browser = await lib.launch();
  try {
    await makeCrops(browser);
    for (const [ver, base] of Object.entries(OUT)) {
      const isInternal = ver === 'interno';
      fs.mkdirSync(path.dirname(base), { recursive: true });
      fs.writeFileSync(`${base}.html`, html(isInternal), 'utf8');
      const page = await browser.newPage();
      await page.goto('file:///' + `${base}.html`.replace(/\\/g, '/'));
      await page.waitForFunction(() => window.__laidOut === true);
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
