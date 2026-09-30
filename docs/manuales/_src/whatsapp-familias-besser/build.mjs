// Genera el manual "WhatsApp de Besser — guía para familias" en sus dos
// versiones (interno / academias) como HTML + PDF.
//
//   node docs/manuales/_src/whatsapp-familias-besser/capture.mjs   (capturas de la app)
//   node docs/manuales/_src/whatsapp-familias-besser/build.mjs
//
// Las conversaciones se dibujan con los textos EXACTOS que manda el bot (tomados
// de whatsapp_messages y de bff/src/services/whatsapp-*.ts / jobs/whatsapp-*.ts).
// Los que redacta el modelo (estado de pagos, medios de pago) son respuestas reales
// del chat de prueba con nombres y montos de ejemplo. Nada de la conversación es
// una captura de la app de WhatsApp: no hay forma de automatizarla.

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
const NAME = 'whatsapp-familias-besser';
const OUT = {
  academias: path.join(repo, 'docs/manuales/academias', NAME),
  interno: path.join(repo, 'docs/manuales/interno', NAME),
};
const SCALE = 2;
const ESCUELA = 'CLUB DEPORTIVO BESSER';
const NUMERO = '+57 316 692 4086';

// Viewport 400 CSS px de ancho (celular).
const CROP_DEFS = {
  '01-registro-form.png': { src: '01-registro.png', x: 0, y: 0, w: 400, h: 640 },
  '02-mis-pagos-top.png': { src: '02-mis-pagos.png', x: 0, y: 60, w: 400, h: 520 },
};

async function makeCrops(browser) {
  fs.mkdirSync(CROPS, { recursive: true });
  const page = await browser.newPage();
  for (const [out, def] of Object.entries(CROP_DEFS)) {
    const src = path.join(SHOTS, def.src);
    if (!fs.existsSync(src)) throw new Error(`Falta ${def.src}. Corre capture.mjs primero.`);
    const b64 = fs.readFileSync(src).toString('base64');
    const cropped = await page.evaluate(async ([b64, d, s]) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const h = Math.min(d.h, img.naturalHeight / s - d.y);
      const c = document.createElement('canvas');
      c.width = d.w * s; c.height = h * s;
      c.getContext('2d').drawImage(img, d.x * s, d.y * s, d.w * s, h * s, 0, 0, d.w * s, h * s);
      return c.toDataURL('image/png').split(',')[1];
    }, [b64, def, SCALE]);
    fs.writeFileSync(path.join(CROPS, out), Buffer.from(cropped, 'base64'));
  }
  await page.close();
}

// ── Piezas ────────────────────────────────────────────────────────────────
function img(file, caption, width) {
  const fp = path.join(CROPS, file);
  const b64 = fs.readFileSync(fp).toString('base64');
  return `<div class="shot-wrap"><img class="shot" style="width:${width}px;max-height:none" src="data:image/png;base64,${b64}" alt="${caption}"/>` +
    (caption ? `<div class="shot-caption">${caption}</div>` : '') + `</div>`;
}
const step = (n, title, body, pic = '') =>
  `<div class="step"><div class="step-head"><div class="step-badge">${n}</div><div class="step-title">${title}</div></div>${body}${pic}</div>`;
const p = (html, cls = '') => `<p${cls ? ` class="${cls}"` : ''}>${html}</p>`;
const warn = (tag, html) => `<div class="callout warn"><span class="tag">${tag}</span>${html}</div>`;
const tip = (tag, html) => `<div class="callout tip"><span class="tag">${tag}</span>${html}</div>`;
const internal = (html) => `<div class="callout internal"><span class="tag">🔒 Interno</span>${html}</div>`;
const chapter = (n, title, crumb, intro) =>
  `<div class="chapter-head"><div class="chapter-badge">${n}</div><h2 class="chapter-title">${title}</h2></div>` +
  `<div class="breadcrumb">${crumb}</div><hr class="chapter-rule" />${intro ? p(intro) : ''}`;
const row = (left, right) => `<div class="row"><div class="row-l">${left}</div><div class="row-r">${right}</div></div>`;

// Formato de WhatsApp → HTML: *negrita*, _cursiva_, saltos de línea.
function wa(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/\*([^*\n]+)\*/g, '<b>$1</b>')
    .replace(/(^|[\s(])_([^_\n]+)_/g, '$1<i>$2</i>')
    .replace(/(https?:\/\/\S+)/g, '<span class="link">$1</span>')
    .replace(/\n/g, '<br/>');
}
// msgs: [{from:'papa'|'bot', text, time, kind?:'img'}]
function chat(msgs, caption = '') {
  const body = msgs.map((m) => {
    if (m.kind === 'img') {
      return `<div class="b out img"><div class="receipt"><div class="r1">🧾</div><div class="r2">Comprobante de transferencia</div><div class="r3">${m.text || ''}</div></div><span class="t">${m.time} ✓✓</span></div>`;
    }
    if (m.kind === 'audio') {
      return `<div class="b out"><span class="audio">▶ ━━━━━━━━ 0:07 🎤</span><span class="t">${m.time} ✓✓</span></div>`;
    }
    const cls = m.from === 'papa' ? 'out' : 'in';
    return `<div class="b ${cls}">${wa(m.text)}<span class="t">${m.time}${cls === 'out' ? ' ✓✓' : ''}</span></div>`;
  }).join('');
  return `<div class="phone"><div class="wa-head"><div class="av">CB</div><div><div class="nm">${ESCUELA}</div><div class="st">Cuenta de empresa</div></div></div>` +
    `<div class="wa-body">${body}</div></div>` + (caption ? `<div class="shot-caption">${caption}</div>` : '');
}

// ── Contenido: cada entrada del array es UNA página ───────────────────────
// Besser vs Dynasty (medido en la base el 2026-09-29): cobra SOLO por
// transferencia (wompi_enabled=false, allow_online=false: el checkout muestra
// «Transferencia manual» y nada más), una sola cuenta (Davivienda ahorros),
// fútbol, 8 grupos SIN horario cargado, sin dirección en `schools` y sin
// horario de atención. El manual no promete lo que el bot hoy no puede decir.
function pages(isInternal) {
  const I = (html) => (isInternal ? internal(html) : '');
  const pgs = [];

  // Cap. 1 — Qué cambia
  pgs.push(
    chapter(1, 'El mismo WhatsApp de siempre, ahora con asistente', `Chat de WhatsApp con ${ESCUELA} · ${NUMERO}`,
      `Besser sigue atendiendo por el <b>mismo número</b> de siempre, <b>${NUMERO}</b>. Lo nuevo es que ahora te contesta primero un <b>asistente automático</b>, a cualquier hora, y cuando hace falta te pasa con una persona del club.`) +
    `<div class="cards">
      <div class="card"><div class="ic">💳</div><div class="ct">Consultar tus pagos</div><div class="cd">Qué debes, qué está en revisión y qué ya quedó confirmado.</div></div>
      <div class="card"><div class="ic">🏦</div><div class="ct">Saber cómo pagar</div><div class="cd">La cuenta del club para transferir, con el número completo.</div></div>
      <div class="card"><div class="ic">🧾</div><div class="ct">Enviar el comprobante</div><div class="cd">Mandas la foto de la transferencia y queda registrada en tu pago.</div></div>
      <div class="card"><div class="ic">⚽</div><div class="ct">Sede, categorías y horarios</div><div class="cd">Dónde entrenan y las categorías del club.</div></div>
      <div class="card"><div class="ic">🔔</div><div class="ct">Recibir avisos</div><div class="cd">Recordatorios de pago y avisos de tu deportista, si los activas.</div></div>
      <div class="card"><div class="ic">🙋</div><div class="ct">Hablar con una persona</div><div class="cd">Escribe «quiero hablar con alguien» y te pasa con el club.</div></div>
    </div>` +
    tip('Cómo se le habla', 'Escríbele como le escribes a una persona, con frases cortas: <b>«cuánto debo»</b>, <b>«cómo pago»</b>, <b>«qué categorías hay»</b>. No hace falta usar palabras especiales ni menús.') +
    warn('Es un asistente automático', 'Te lo dice desde el primer mensaje. No firma con el nombre de nadie del club. Solo conoce la información de Besser y la de tus pagos; no puede inscribir, cambiar de categoría, conceder descuentos ni mover fechas. Para eso te pasa con el club.') +
    I(`<b>Estado 2026-09-29:</b> Besser <b>no tiene integración de WhatsApp</b> (0 filas en <code>school_whatsapp_integrations</code>). El número de este manual sale de <code>school_settings.whatsapp_number</code> (<code>+573166924086</code>): <b>confirmar que es el que van a conectar</b> y si es personal de alguien (Coexistence: borrar chats personales y anunciar la línea nueva antes). Al conectar queda <code>ai_enabled = false</code>. Chats dibujados con los textos exactos del bot y datos de ejemplo.`)
  );

  // Cap. 2 — Primer mensaje
  pgs.push(
    chapter(2, 'Tu primer mensaje', 'Escribe «Hola» al WhatsApp del club',
      'No te pide contraseña ni código. El asistente <b>te reconoce por el número de celular</b> que tienes registrado en el club. Según lo que encuentre, pasa una de estas tres cosas:') +
    row(
      step('A', 'Te reconoce: listo para usar',
        p('Si tu celular está en tu cuenta de acudiente, entras directo. Te pregunta si quieres recibir por ahí los recordatorios de pago y los avisos de tu deportista: responde <b>SÍ</b> si los quieres.') +
        p('Si respondes otra cosa, igual puedes preguntarle lo que necesites; solo no te llegarán avisos automáticos.')) +
      tip('Escribe desde el celular registrado', 'El asistente reconoce <b>el número desde el que escribes</b>. Si escribes desde otro celular (el de tu pareja, un número nuevo), no te va a reconocer. Escribe desde el número que diste al club, o pídele al club que lo actualice.'),
      chat([
        { from: 'papa', text: 'Hola', time: '7:41 p. m.' },
        { from: 'bot', text: `¡Hola! Soy el *asistente automático* de ${ESCUELA}. 🤖\n\nTe reconocí por tu número, así que no necesitas hacer nada más.\n\n¿Quieres que la escuela te envíe por aquí los recordatorios de pago y los avisos de tu atleta? Responde *SÍ* para activarlos — puedes darte de baja cuando quieras escribiendo *STOP*.`, time: '7:41 p. m.' },
        { from: 'papa', text: 'Sí', time: '7:42 p. m.' },
        { from: 'bot', text: '✅ Activado. Te avisaré por aquí de tus pagos y de tu atleta. Para darte de baja, escribe *STOP*.', time: '7:42 p. m.' },
      ], 'Caso A: el asistente te reconoce por tu número.')) +
    step('C', 'Tu número aparece en dos cuentas',
      p('Pasa cuando dos personas registraron el mismo celular. Para no mostrarte información de otra familia, el asistente no responde datos y <b>le avisa al club</b>, que te escribe para corregirlo.', 'no-shot'))
  );

  pgs.push(
    row(
      step('B', 'Tu número está en el club, pero aún no creaste tu cuenta',
        p('El asistente te manda un <b>enlace para crear tu cuenta</b> de acudiente. Ábrelo, completa el formulario y vuelve a escribir «Hola» en el chat: ya te reconocerá.') +
        p('Por seguridad, <b>mientras no tengas cuenta no te muestra ningún dato</b>, ni siquiera el nombre de tu deportista. Así nadie que tenga tu número puede ver información de tu familia.')),
      chat([
        { from: 'papa', text: 'Buenas tardes', time: '3:10 p. m.' },
        { from: 'bot', text: 'Tu número está registrado en la escuela, pero todavía no tienes tu cuenta creada. 🙌\n\nCréala aquí, ya te dejé todo listo: https://app.sportmaps.co/register?invite=…\n\nCuando la tengas, escríbeme por acá y podrás consultar tus pagos, mandar comprobantes y recibir los avisos de tu atleta.', time: '3:10 p. m.' },
      ], 'Caso B: te manda el enlace para crear la cuenta.')) +
    row(
      step(1, 'Crear la cuenta desde el enlace',
        p('El enlace abre la página <b>Crear cuenta</b>. Si el club te había invitado por correo, el correo ya viene escrito: <b>usa ese mismo correo</b>. Elige una contraseña (mínimo 8 caracteres), escribe tu nombre, revisa tu WhatsApp, marca <b>Acudiente</b> en «Soy…», acepta los términos y pulsa <b>Crear mi cuenta</b>.') +
        warn('Usa el correo que ya viene escrito', 'Si lo cambias por otro, la cuenta se crea pero <b>no queda unida a tu deportista</b>, y el asistente te seguirá pidiendo que te registres.') +
        I('Besser: 43 invitaciones de acudiente aceptadas, <b>29 pendientes</b> y 2 canceladas. A las 29 el bot les manda <code>?invite=…&email=…</code> y el registro las vincula con <code>accept_invitation_pro</code>. De los 48 acudientes activos, 46 tienen celular de 10+ dígitos. Quien no tenga invitación recibe <code>/register?phone=57…</code>, con el 57 repetido en <code>PhoneInput</code> (visual; esas familias no se vinculan solas y las resuelve el club desde Conversaciones). Ojo con el caso de 09-25: quien se registra sin el enlace queda en el onboarding sin hijo.')),
      img('01-registro-form.png', 'Página «Crear cuenta» que abre el enlace (captura real).', 250))
  );

  // Cap. 3 — Consultar pagos
  pgs.push(
    chapter(3, 'Consultar tus pagos', 'Escribe «cuánto debo», «pagos» o «ya me aprobaron el pago?»',
      'El asistente consulta tus cobros en ese momento. Te muestra <b>lo que tienes pendiente</b> con su fecha de vencimiento y <b>lo que ya quedó resuelto</b> en los últimos 60 días. Si tienes varios hijos en el club, te muestra los de todos.') +
    row(
      `<table class="tbl"><tr><th>Lo que te dice</th><th>Qué significa</th></tr>
        <tr><td><b>Pendiente</b></td><td>Todavía no se ha pagado. Aparece con la fecha en que vence.</td></tr>
        <tr><td><b>Comprobante en revisión</b></td><td>Mandaste el soporte y el club lo está revisando.</td></tr>
        <tr><td><b>Pagado y confirmado por la escuela</b></td><td>Listo, no debes nada de ese cobro.</td></tr>
        <tr><td><b>Rechazado</b></td><td>El club no pudo validar el comprobante. Te dice por qué, y puedes mandar el correcto.</td></tr></table>` +
      tip('Pregunta lo que quieras saber', 'También entiende preguntas como <b>«cuánto es mi mensualidad»</b>, <b>«cuándo vence»</b> o <b>«ya quedó aprobado lo que mandé ayer»</b>.') +
      I('El texto de la respuesta lo redacta el modelo (<code>get_payment_status</code>) y puede variar; los datos salen siempre de la herramienta. En Besser el corte es el día 10 con 5 días de gracia y el recargo por mora está apagado.'),
      chat([
        { from: 'papa', text: 'Cuánto debo', time: '8:05 p. m.' },
        { from: 'bot', text: 'Actualmente tienes un saldo total pendiente de *$380.000 COP*:\n\n• *Mensualidad 10/2026 - Samuel Rodríguez:* $380.000 (Vence el 10 de octubre de 2026)\n\n✅ *Pagos al día:*\n• *Mensualidad 09/2026:* $380.000 — pagado y confirmado por la escuela\n\nSi deseas conocer los medios de pago disponibles, con gusto te los comparto.', time: '8:05 p. m.' },
      ], 'Ejemplo con datos ficticios.'))
  );

  // Cap. 4 — Cómo pagar
  pgs.push(
    chapter(4, 'Cómo pagar', 'Escribe «cómo pago» o «a qué cuenta consigno»',
      'Besser recibe los pagos <b>por transferencia</b>. El asistente te da <b>la cuenta del club</b> con el número completo y te recuerda que puedes mandar el comprobante por el mismo chat.') +
    row(
      chat([
        { from: 'papa', text: 'Cómo pago', time: '8:06 p. m.' },
        { from: 'bot', text: 'Puedes realizar tu pago de las siguientes formas:\n\n1. *Transferencia:* a la cuenta de la escuela\n   • Davivienda — (número de cuenta del club)\n2. *En la app:* ingresando a https://app.sportmaps.co/my-payments\n3. *Por este chat:* si ya hiciste la transferencia, envíame la foto o captura del comprobante por aquí mismo y lo registro.', time: '8:06 p. m.' },
      ], 'Ejemplo: el asistente responde con la cuenta real del club.') +
      I('Una cuenta (Davivienda, en <code>bank_*</code>); no va en el PDF por si cambia. <b>Ojo:</b> medios de pago manda siempre <code>enlace_para_pagar</code> y el modelo puede decir «en línea», pero Besser solo acepta transferencia.'),
      step(1, 'Tus pagos en la app: «Mis Pagos»',
        p('El enlace abre <b>Mis Pagos</b> en SportMaps (inicias sesión con tu correo y contraseña). Ahí ves lo pendiente, lo aprobado y el estado de cuenta de cada hijo. Al pagar un cobro, la app te muestra <b>los datos para transferir</b> y te deja <b>subir el comprobante</b>.'),
        img('02-mis-pagos-top.png', 'Mis Pagos del acudiente (captura real, cuenta de demostración).', 250))) +
    warn('Antes de transferir', 'Transfiere <b>solo a la cuenta que te da el asistente o el club</b>. Si el comprobante muestra otra cuenta, el asistente te avisa que no es una cuenta del club.')
  );

  // Cap. 5 — Comprobante
  pgs.push(
    chapter(5, 'Enviar el comprobante de pago', 'Manda la foto o el PDF de la transferencia al chat',
      'Es la forma más rápida de que tu pago quede registrado: no tienes que entrar a la app ni esperar a que alguien lo lea. El asistente <b>lee el comprobante</b>, lo aplica a tu cobro y, cuando el club lo confirma, <b>te avisa por el mismo chat</b>.') +
    row(
      step(1, 'Manda la foto o el PDF que te da el banco', p('Una <b>foto clara</b> o la captura de pantalla del comprobante, donde se vean el valor, la fecha, la cuenta de destino y el número de aprobación.')) +
      step(2, 'El asistente lo aplica a tu cobro', p('Te dice a qué cobro lo aplicó y, si te queda algo más pendiente, te lo recuerda.')) +
      step(3, 'El club lo confirma y te avisa', p('Cuando el club lo revisa, te llega: <b>«¡Listo! ✅ La escuela confirmó tu pago…»</b>. Si no lo pudo validar, te dice el motivo para que mandes el correcto.')) +
      I('Besser tiene <code>auto_approve_enabled = true</code> hasta $570.000: un comprobante que cuadra puede confirmarse sin que nadie lo mire, y el aviso de «¡Listo!» llega casi enseguida.'),
      chat([
        { kind: 'img', text: '$380.000 · Davivienda', time: '9:12 a. m.' },
        { from: 'bot', text: 'Recibí tu comprobante 📄 Lo estoy revisando y te confirmo en un momento.', time: '9:12 a. m.' },
        { from: 'bot', text: 'Recibí tu comprobante y lo apliqué a *Mensualidad 10/2026 - Samuel Rodríguez* 📄\n\nLa escuela lo está revisando y te confirma en poco tiempo.', time: '9:13 a. m.' },
        { from: 'bot', text: '¡Listo! ✅ La escuela confirmó tu pago de *$ 380.000* por *Mensualidad 10/2026 - Samuel Rodríguez*. Queda al día.', time: '11:40 a. m.' },
      ], 'De la foto a la confirmación del club.'))
  );

  pgs.push(
    `<h3 class="sub">Si tienes varios cobros pendientes</h3>` +
    row(
      p('Cuando no sabe a cuál cobro va el comprobante, <b>te pregunta</b> con una lista numerada. Respóndele solo con el número. Si te equivocas o no sabes, respóndele «ninguno» y no lo aplica.') +
      tip('Un comprobante, un pago', 'Cada comprobante se aplica a <b>un solo cobro</b>. Si hiciste una sola transferencia para pagar dos meses, escríbele al club para que la repartan.') +
      I('La regla vive en <code>whatsapp-queue.job.ts</code> y es la misma para todas las escuelas: el comprobante va al cobro más antiguo y el del mes en curso queda vivo (se fijó con Dynasty el 2026-09-15).'),
      chat([
        { kind: 'img', text: '$380.000 · Davivienda', time: '6:02 p. m.' },
        { from: 'bot', text: 'Recibí tu comprobante, pero tienes varios cobros pendientes y no quiero aplicarlo al que no es 🤔\n\n1. Mensualidad 10/2026 - Samuel Rodríguez por $ 380.000 (vence 2026-10-10)\n2. Mensualidad 10/2026 - Sofía Rodríguez por $ 380.000 (vence 2026-10-10)\n\nRespóndeme con el número al que corresponde.', time: '6:02 p. m.' },
        { from: 'papa', text: '2', time: '6:03 p. m.' },
      ], 'Te pregunta a cuál cobro aplicarlo.'))  +
    `<h3 class="sub">Otros avisos que te puede dar</h3>` +
    `<table class="tbl"><tr><th>Si pasa esto…</th><th>El asistente te dice…</th><th>Qué hacer</th></tr>
      <tr><td>Mandas un comprobante que ya habías enviado</td><td>«Ese comprobante ya lo había recibido, así que no lo apliqué de nuevo.»</td><td>Nada, ya quedó. Si fue otra transferencia, manda <b>ese</b> comprobante.</td></tr>
      <tr><td>La transferencia fue a una cuenta que no es del club</td><td>«…el dinero se envió a la cuenta …, que no es ninguna de las cuentas registradas por la escuela.»</td><td>Revisa el número de cuenta. Si ya transferiste, escríbele al club.</td></tr>
      <tr><td>Mandas un archivo que no puede leer</td><td>«Recibí tu archivo, pero no puedo leer ese formato. Mándame una <b>foto</b>…»</td><td>Manda una foto, captura o PDF.</td></tr>
      <tr><td>El club no pudo validar el pago</td><td>«La escuela revisó tu comprobante… y no lo pudo validar.» + el motivo</td><td>Corrige y manda el comprobante correcto.</td></tr></table>`
  );

  // Cap. 6 — Info del club
  pgs.push(
    chapter(6, 'Sede, categorías y horarios', 'Escribe «dónde queda», «qué categorías hay» o «a qué hora entrena mi hijo»',
      'El asistente responde con la información que el club tiene cargada: la sede, las categorías y los horarios de entrenamiento. Si un dato no lo tiene, <b>te lo dice</b> y te ofrece pasarte con el club; nunca se inventa un horario.') +
    row(
      tip('Pregunta por la categoría', 'Los nombres de las categorías los dice tal cual los usa el club: por año, como <b>2012 - LIGA</b>, o por grupo, como <b>INICIACIÓN FEMENINO</b>.') +
      warn('Cambios de última hora', 'Si el club cancela o mueve un entrenamiento por un festivo o un partido, el aviso te llega por el club y por el Calendario de la app; el asistente responde el horario habitual.') +
      I('<b>Bloquea el envío.</b> Hoy el bot no puede contestar casi nada de este capítulo: (1) <b>0 de 8 grupos</b> tienen <code>teams.schedule</code> → dirá que no tiene horarios; (2) <code>schools.address</code> y <code>city</code> están vacíos y la única sede se llama «CLUB DEPORTIVO BESSER» (<code>get_school_info</code> lee solo el <i>nombre</i> de la sede, no la dirección <b>Calle 138 # 55 - 38</b>) → no sabrá decir dónde queda. Antes de enviar: cargar la dirección en <code>schools</code> y pedirle al club los horarios por grupo (con Dynasty se transcribieron de sus piezas gráficas). Las categorías sí salen: son los 8 equipos (no hay <code>school_categories</code>).'),
      chat([
        { from: 'papa', text: 'Qué categorías hay para niñas?', time: '5:20 p. m.' },
        { from: 'bot', text: 'En *CLUB DEPORTIVO BESSER* las categorías femeninas son:\n\n• *INICIACIÓN FEMENINO*\n• *INFANTIL FEMENINO*\n• *PRE JUVENIL FEMENINO*\n• *JUVENIL FEMENINO*\n\nSi quieres inscribir a tu hija, con gusto te paso con el club.', time: '5:20 p. m.' },
      ], 'Ejemplo de respuesta con las categorías del club.'))
  );

  // Cap. 7 — Hablar con una persona
  pgs.push(
    chapter(7, 'Hablar con una persona del club', 'Escribe «quiero hablar con alguien» o pregunta algo que el asistente no sepa',
      'Cuando algo se sale de lo que el asistente puede resolver —inscripciones nuevas, cambios de categoría, descuentos, uniformes, torneos, un problema con tu cuenta— <b>te pasa con el club</b>. La conversación sigue en el mismo chat: alguien del equipo te responde ahí mismo.') +
    row(
      tip('Fuera del horario de atención', 'El asistente responde las 24 horas, pero las personas del club no. Si escribes de noche o en fin de semana, te responden <b>apenas estén disponibles</b>.') +
      warn('Notas de voz y videos', 'El asistente <b>no puede escuchar notas de voz</b> ni ver videos. Escríbele el mensaje. Si es un comprobante, mándalo como foto o PDF.') +
      I('Besser no tiene <code>business_hours</code> (ni en <code>school_settings</code> ni, por no haber integración, en <code>whatsapp_settings</code>). Sin horario, al escalar el bot dice «En breve te contactan» <b>también a las 10 p. m.</b>: cargarlo al conectar para que diga «te responden mañana a las 8:00». Las escaladas quedan en <b>Conversaciones</b>; con Coexistence también se ven en el celular del club, y si alguien contesta desde ahí el bot no se entera: acordar quién responde desde dónde.'),
      chat([
        { from: 'papa', text: 'Quiero cambiar a mi hijo de categoría', time: '10:15 p. m.' },
        { from: 'bot', text: 'Voy a pasar tu caso con una persona del equipo de la escuela para ayudarte mejor.\n\nTe responden apenas estén disponibles. 🙌', time: '10:15 p. m.' },
        { kind: 'audio', time: '10:16 p. m.' },
        { from: 'bot', text: 'No puedo escuchar notas de voz 🙊 Escríbeme el mensaje y te ayudo. Y si es un comprobante de pago, mándame la *foto* o el *PDF* que te da el banco.', time: '10:16 p. m.' },
      ], 'Te pasa con el club.'))
  );

  // Cap. 8 — Avisos + resumen
  pgs.push(
    chapter(8, 'Avisos automáticos y resumen', 'Palabras para activar o apagar los avisos',
      'Si activaste los avisos, por este chat te llegan los <b>recordatorios de pago</b> y los <b>avisos de tu deportista</b>. Puedes apagarlos o volver a prenderlos cuando quieras.') +
    `<table class="tbl"><tr><th>Escribe</th><th>Qué pasa</th></tr>
      <tr><td><b>SÍ</b> (cuando te lo pregunta)</td><td>Activa los recordatorios de pago y los avisos de tu deportista.</td></tr>
      <tr><td><b>STOP</b> o <b>baja</b></td><td>Deja de enviarte mensajes automáticos. Igual puedes seguir preguntándole lo que quieras.</td></tr>
      <tr><td><b>ACTIVAR</b></td><td>Vuelve a prender los avisos si los habías apagado.</td></tr></table>` +
    `<h3 class="sub">Resumen: qué escribir</h3>` +
    `<table class="tbl"><tr><th>Quiero…</th><th>Escribo…</th></tr>
      <tr><td>Saber cuánto debo</td><td>«cuánto debo», «mis pagos»</td></tr>
      <tr><td>Saber a qué cuenta pagar</td><td>«cómo pago», «a qué cuenta consigno»</td></tr>
      <tr><td>Registrar mi pago</td><td>Mando la <b>foto</b> o el <b>PDF</b> del comprobante</td></tr>
      <tr><td>Saber si ya me aprobaron</td><td>«ya aprobaron mi pago?»</td></tr>
      <tr><td>Categorías, horario o sede</td><td>«qué categorías hay», «a qué hora entrena mi hijo», «dónde queda»</td></tr>
      <tr><td>Hablar con alguien del club</td><td>«quiero hablar con una persona»</td></tr></table>` +
    tip('Privacidad', 'El asistente solo te muestra información <b>de tu familia</b>, y solo cuando escribes desde el celular registrado en tu cuenta. Nunca te va a pedir tu contraseña ni datos de tarjetas.') +
    I('Antes de enviar: (1) confirmar y conectar el número (Coexistence, sync en 24 h); (2) <code>wa-copiar-plantillas.ts</code>; (3) dirección en <code>schools</code> y horarios en <code>teams.schedule</code>; (4) <code>business_hours</code>; (5) el «pagar en línea» de medios de pago; (6) prender <code>ai_enabled</code>; (7) prueba con un acudiente real; (8) alguien mirando <b>Conversaciones</b> los primeros días.')
  );

  return pgs;
}


// ── Ensamblado ────────────────────────────────────────────────────────────
function html(isInternal) {
  const css = fs.readFileSync(path.join(here, 'manual.css'), 'utf8') + fs.readFileSync(path.join(here, 'extra.css'), 'utf8');
  const body = pages(isInternal);
  const total = body.length + 1;
  const foot = (n) => `<div class="footer${isInternal ? ' internal-mark' : ''}"><span>${isInternal ? 'SportMaps · Uso interno' : 'SportMaps · Guía de uso'}</span><span>Página ${n} de ${total}</span></div>`;
  const cover = `<section class="page cover"><div class="cover-inner">
    <div class="logo"><span class="pin"></span>SportMaps</div>
    <div>
      ${isInternal ? '<div class="cover-eyebrow"><span class="dot"></span>🔒 Uso interno — no enviar a escuelas</div>' : `<div class="cover-eyebrow"><span class="dot"></span>${ESCUELA}</div>`}
      <h1 class="cover-title">WhatsApp del club: guía para familias</h1>
      <p class="cover-sub">Consulta tus pagos, envía tus comprobantes y resuelve dudas escribiendo al mismo número de siempre, ${NUMERO}. Te atiende un asistente automático las 24 horas, y el club cuando lo necesitas.</p>
      <div class="pills"><span class="pill">Para acudientes</span><span class="pill">${NUMERO}</span><span class="pill">8 pasos guiados</span>${isInternal ? '<span class="pill" style="border-color:#ff8833;color:#ffcf9e">Uso interno</span>' : ''}</div>
    </div>
    <div class="cover-footer">SportMaps · Septiembre de 2026</div>
  </div></section>`;
  const secs = body.map((c, i) => `<section class="page">${c}${foot(i + 2)}</section>`).join('\n');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>WhatsApp del club — guía para familias</title><style>${css}</style></head><body>${cover}${secs}</body></html>`;
}

const browser = await chromium.launch();
try {
  await makeCrops(browser);
  for (const [kind, base] of Object.entries(OUT)) {
    const isInternal = kind === 'interno';
    fs.writeFileSync(base + '.html', html(isInternal));
    const page = await browser.newPage({ viewport: { width: 816, height: 1056 } });
    await page.goto('file:///' + (base + '.html').replace(/\\/g, '/'), { waitUntil: 'networkidle' });
    await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalHeight));
    const over = await page.evaluate(() => [...document.querySelectorAll('.page')]
      .map((el, i) => ({ i: i + 1, h: el.scrollHeight })).filter((x) => x.h > 1056));
    if (over.length) console.log(`[${kind}] páginas que desbordan:`, JSON.stringify(over));
    await page.pdf({ path: base + '.pdf', width: '816px', height: '1056px', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    await page.close();
    console.log(`${kind}: ${base}.pdf`);
  }
} finally {
  await browser.close();
}
