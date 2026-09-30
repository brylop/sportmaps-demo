// Genera el manual "WhatsApp del club — guía para familias" de cada escuela, en
// sus dos versiones (interno / academias), como HTML + PDF.
//
//   node docs/manuales/_src/whatsapp-familias/capture.mjs          (capturas de la app, una vez)
//   node docs/manuales/_src/whatsapp-familias/build.mjs            (todos los clubes)
//   CLUB=monster node docs/manuales/_src/whatsapp-familias/build.mjs (uno solo)
//
// OJO: el PDF de Besser que está en docs/manuales lo generó OTRA sesión el
// 2026-09-29 (docs/manuales/_src/whatsapp-familias-besser/), con el mismo nombre
// de archivo. Correr este script sin CLUB lo sobrescribe: decidir antes cuál queda.
//
// Las conversaciones se dibujan con los textos EXACTOS que manda el bot (tomados
// de whatsapp_messages y de bff/src/services/whatsapp-*.ts / jobs/whatsapp-*.ts).
// Los que redacta el modelo (estado de pagos, medios de pago, info de la escuela)
// son respuestas del chat de prueba con nombres y montos de ejemplo. Nada de la
// conversación es una captura de WhatsApp: la app no se puede automatizar.
//
// Lo que cambia entre clubes vive en CLUBS: nombre tal como lo dice el bot
// (schools.name), número, cuentas, sedes, si tiene horarios cargados y las notas
// internas. Todo lo demás es el mismo manual.

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
const SCALE = 2;

// ── Clubes (datos verificados contra la base el 2026-09-29) ──────────────
const CLUBS = {
  dynasty: {
    slug: 'whatsapp-familias-dynasty',
    nombre: 'DYNASTY VOLLEY CLUB',      // schools.name: es lo que dice el bot
    corto: 'Dynasty',
    iniciales: 'DV',
    numero: '+57 320 429 8969',
    mismoNumero: true,
    categoriaEjemplo: 'INFANTIL FEMENINO',
    cuentasEjemplo: ['Bancolombia — (número de cuenta del club)', 'Bre-B — (llave del club)'],
    horarios: { equipo: 'SENIORS', texto: '• *Lunes y jueves* de 8:00 p. m. a 10:00 p. m.' },
    infoEjemplo: null,
    notasInternas: {
      estado: 'El número de Dynasty <b>no está conectado</b> (en <code>school_whatsapp_integrations</code> solo existe Escuela Pruebas). Al conectarlo queda con <code>ai_enabled = false</code> (<code>8b98f1be</code>): prender el asistente antes de enviar este manual.',
      registro: '148 de las 157 familias de Dynasty sin cuenta tienen invitación pendiente: el enlace lleva <code>?invite=…&email=…</code> y el registro las vincula con <code>accept_invitation_pro</code>. Las 9 sin invitación reciben <code>/register?phone=57…</code>, que <b>muestra el 57 repetido</b> en <code>PhoneInput</code> (el bot manda el número sin «+»). Es visual, pero esas 9 no se vinculan solas: las resuelve el club desde Conversaciones.',
      cuentas: 'El bot lee <code>school_settings</code>: Dynasty sale con Bancolombia y Bre-B. <b>Hasta el fix del 2026-09-29 el bot nunca dio cuentas</b> (pedía <code>account_holder</code>, que no existe): desplegar el BFF antes de enviar. Los números no van en el PDF: si el club cambia de cuenta, un PDF viejo mandaría plata a la anterior.',
      horarios: 'Horarios cargados en <code>teams.schedule</code> para 9 de los 10 equipos reales. Falta <b>JUVENIL MAYORES FEMENINO</b>: el bot dirá que no lo tiene. INTERMEDIO y MENORES FEMENINO tienen dos subgrupos dentro de un solo equipo. El equipo «MINIVOLLEY -BENJAMINES (DUPLICADO - NO USAR)» sigue existiendo.',
      humano: 'Con Coexistence, Milena también ve los chats en la app de WhatsApp Business del celular: si contesta desde ahí, el bot no se entera. Acordar con el club quién responde desde dónde.',
    },
  },
  besser: {
    slug: 'whatsapp-familias-besser',
    nombre: 'CLUB DEPORTIVO BESSER',
    corto: 'Besser',
    iniciales: 'CB',
    numero: '+57 316 692 4086',   // el que usa la otra sesión que armó el Besser del 2026-09-29
    mismoNumero: true,
    categoriaEjemplo: 'INFANTIL FEMENINO',
    cuentasEjemplo: ['Davivienda — (número de cuenta del club)'],
    horarios: null,
    infoEjemplo: {
      pregunta: 'Dónde queda el club?',
      respuesta: 'El *CLUB DEPORTIVO BESSER* queda en la *Calle 138 # 55 - 38*.\n\nSi necesitas algo más, con gusto te ayudo o te paso con el club.',
    },
    notasInternas: {
      estado: 'Besser <b>no tiene WhatsApp conectado</b> (el número +57 316 692 4086 no está en la ficha del club ni en <code>school_whatsapp_integrations</code>). Al conectarlo queda con <code>ai_enabled = false</code> (<code>8b98f1be</code>): prender el asistente antes de enviar el manual.',
      registro: 'Al 2026-09-25, 40 de 69 atletas de Besser tenían acudiente vinculado: el resto recibirá «crea tu cuenta». Quienes tengan invitación pendiente reciben <code>?invite=…&email=…</code> y quedan vinculados; los que no, <code>/register?phone=57…</code>, que <b>muestra el 57 repetido</b> y no vincula solo: los resuelve el club desde Conversaciones. Medir cuántos quedan en cada caso antes de enviar.',
      cuentas: 'El bot lee <code>school_settings</code>: Besser tiene <b>una sola cuenta, Davivienda</b> (columnas viejas; <code>payment_accounts</code> vacío). <b>Hasta el fix del 2026-09-29 el bot nunca dio cuentas</b> (<code>account_holder</code> inexistente): desplegar el BFF antes de enviar el manual.',
      horarios: '<b>0 de 8 equipos tienen horario</b> en <code>teams.schedule</code>: hoy el bot responde «eso no lo tengo a la mano» y ofrece pasar con el club. Por eso el manual NO promete horarios. Si el club los carga desde la pestaña <b>Horarios</b> de WhatsApp, cambiar <code>horarios</code> en <code>CLUBS.besser</code> y regenerar. La sede se responde con <code>school_branches</code> (Calle 138 # 55 - 38).',
      humano: 'Las conversaciones escaladas quedan en la pestaña <b>Conversaciones</b> del panel del club. Hay que acordar quién del club las mira.',
    },
  },
  monster: {
    slug: 'whatsapp-familias-monster',
    nombre: 'Monster´s Volley Club',
    corto: 'Monster',
    iniciales: 'MV',
    numero: null,
    mismoNumero: false,
    categoriaEjemplo: 'U15 FEMENINO COMPETENCIA',
    cuentasEjemplo: null,   // sin cuentas cargadas: el bot ofrece en línea + comprobante
    horarios: null,
    infoEjemplo: {
      pregunta: 'Qué sedes tienen?',
      respuesta: '*Monster´s Volley Club* tiene dos sedes:\n\n• *Sede Suba:* Cl. 152 # 94A - 67\n• *Sede Norte:* Av. El Polo, Cl. 201 # 67 - 12\n\nSi quieres confirmar en cuál entrena tu atleta, con gusto te paso con el club.',
    },
    notasInternas: {
      estado: 'Monster <b>no tiene WhatsApp conectado</b>. La ficha tiene el 318 868 2241, pero no está confirmado que sea el que se conecta, así que el PDF va sin número. Al conectarlo queda con <code>ai_enabled = false</code> (<code>8b98f1be</code>): prender el asistente antes de enviar el manual.',
      registro: 'Las familias con invitación pendiente reciben <code>?invite=…&email=…</code> y quedan vinculadas; las que no, <code>/register?phone=57…</code>, que <b>muestra el 57 repetido</b> y no vincula solo: las resuelve el club desde Conversaciones. Medir cuántas quedan en cada caso antes de enviar.',
      cuentas: '<b>Monster no tiene ninguna cuenta cargada</b> en <code>school_settings</code>: el bot solo ofrece «en línea» y «mándame el comprobante». Si cobra por transferencia, que cargue las cuentas en Configuración de pagos <b>antes</b> de enviar el manual (y regenerar con <code>cuentasEjemplo</code>). Además, hasta el fix del 2026-09-29 el bot nunca dio cuentas a ninguna escuela (<code>account_holder</code> inexistente): desplegar el BFF.',
      horarios: '<b>0 de 14 equipos tienen horario</b> en <code>teams.schedule</code>: hoy el bot responde «eso no lo tengo a la mano». Por eso el manual NO promete horarios. Hay dos equipos casi iguales, «Mayores Femenino» y «MAYORES FEMENINO»: al listar categorías el bot dirá los dos. Revisar con el club cuál se usa antes de enviar.',
      humano: 'Las conversaciones escaladas quedan en la pestaña <b>Conversaciones</b> del panel del club. Hay que acordar quién del club las mira.',
    },
  },
};

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
  const b64 = fs.readFileSync(path.join(CROPS, file)).toString('base64');
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

// ── Contenido: cada entrada del array es UNA página ───────────────────────
function pages(club, isInternal) {
  const I = (html) => (isInternal ? internal(html) : '');
  const E = club.nombre;
  const alNumero = club.numero ? `<b>${club.numero}</b>` : 'el WhatsApp del club';
  const chat = (msgs, caption = '') => {
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
    return `<div class="phone"><div class="wa-head"><div class="av">${club.iniciales}</div><div><div class="nm">${E}</div><div class="st">Cuenta de empresa</div></div></div>` +
      `<div class="wa-body">${body}</div></div>` + (caption ? `<div class="shot-caption">${caption}</div>` : '');
  };
  const pgs = [];

  // Cap. 1 — Qué cambia
  const intro1 = club.mismoNumero
    ? `${club.corto} sigue atendiendo por el <b>mismo número</b> de siempre, ${alNumero}. Lo nuevo es que ahora te contesta primero un <b>asistente automático</b>, a cualquier hora, y cuando hace falta te pasa con una persona del club.`
    : `Cuando le escribes al WhatsApp de ${club.corto}, te contesta primero un <b>asistente automático</b>, a cualquier hora, y cuando hace falta te pasa con una persona del club.`;
  const tarjetaInfo = club.horarios
    ? '<div class="card"><div class="ic">📍</div><div class="ct">Sede, categorías y horarios</div><div class="cd">Dónde entrenan y los horarios de cada categoría.</div></div>'
    : '<div class="card"><div class="ic">📍</div><div class="ct">Sedes y categorías</div><div class="cd">Dónde queda el club y qué categorías tiene.</div></div>';
  pgs.push(
    chapter(1, 'El WhatsApp del club, ahora con asistente', `Chat de WhatsApp con ${E}${club.numero ? ' · ' + club.numero : ''}`, intro1) +
    `<div class="cards">
      <div class="card"><div class="ic">💳</div><div class="ct">Consultar tus pagos</div><div class="cd">Qué debes, qué está en revisión y qué ya quedó confirmado.</div></div>
      <div class="card"><div class="ic">🏦</div><div class="ct">Saber cómo pagar</div><div class="cd">${club.cuentasEjemplo ? 'Las cuentas del club y el enlace para pagar en línea.' : 'El enlace para pagar en línea y cómo mandar tu soporte.'}</div></div>
      <div class="card"><div class="ic">🧾</div><div class="ct">Enviar el comprobante</div><div class="cd">Mandas la foto de la transferencia y queda registrada en tu pago.</div></div>
      ${tarjetaInfo}
      <div class="card"><div class="ic">🔔</div><div class="ct">Recibir avisos</div><div class="cd">Recordatorios de pago y avisos de tu atleta, si los activas.</div></div>
      <div class="card"><div class="ic">🙋</div><div class="ct">Hablar con una persona</div><div class="cd">Escribe «quiero hablar con alguien» y te pasa con el club.</div></div>
    </div>` +
    tip('Cómo se le habla', `Escríbele como le escribes a una persona, con frases cortas: <b>«cuánto debo»</b>, <b>«cómo pago»</b>, <b>«${club.horarios ? 'a qué hora entrena mi hija' : 'dónde queda el club'}»</b>. No hace falta usar palabras especiales ni menús.`) +
    warn('Es un asistente automático', `Te lo dice desde el primer mensaje. No firma con el nombre de nadie del club. Solo conoce la información de ${club.corto} y la de tus pagos; no puede inscribir, cambiar de categoría, conceder descuentos ni mover fechas. Para eso te pasa con el club.`) +
    I(`<b>Estado 2026-09-29:</b> ${club.notasInternas.estado} Las conversaciones están dibujadas con los textos exactos del bot (chat de prueba + código del BFF), con nombres, montos y cuentas de ejemplo; no son capturas de WhatsApp.`)
  );

  // Cap. 2 — Primer mensaje
  pgs.push(
    chapter(2, 'Tu primer mensaje', 'Escribe «Hola» al WhatsApp del club',
      'No te pide contraseña ni código. El asistente <b>te reconoce por el número de celular</b> que tienes registrado en el club. Según lo que encuentre, pasa una de estas tres cosas:') +
    row(
      step('A', 'Te reconoce: listo para usar',
        p('Si tu celular está en tu cuenta de acudiente, entras directo. Te pregunta si quieres recibir por ahí los recordatorios de pago y los avisos de tu atleta: responde <b>SÍ</b> si los quieres.') +
        p('Si respondes otra cosa, igual puedes preguntarle lo que necesites; solo no te llegarán avisos automáticos.')) +
      tip('Escribe desde el celular registrado', 'El asistente reconoce <b>el número desde el que escribes</b>. Si escribes desde otro celular (el de tu pareja, un número nuevo), no te va a reconocer. Escribe desde el número que diste al club, o pídele al club que lo actualice.'),
      chat([
        { from: 'papa', text: 'Hola', time: '7:41 p. m.' },
        { from: 'bot', text: `¡Hola! Soy el *asistente automático* de ${E}. 🤖\n\nTe reconocí por tu número, así que no necesitas hacer nada más.\n\n¿Quieres que la escuela te envíe por aquí los recordatorios de pago y los avisos de tu atleta? Responde *SÍ* para activarlos — puedes darte de baja cuando quieras escribiendo *STOP*.`, time: '7:41 p. m.' },
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
        p('Por seguridad, <b>mientras no tengas cuenta no te muestra ningún dato</b>, ni siquiera el nombre de tu atleta. Así nadie que tenga tu número puede ver información de tu familia.')),
      chat([
        { from: 'papa', text: 'Buenas tardes', time: '3:10 p. m.' },
        { from: 'bot', text: 'Tu número está registrado en la escuela, pero todavía no tienes tu cuenta creada. 🙌\n\nCréala aquí, ya te dejé todo listo: https://app.sportmaps.co/register?invite=…\n\nCuando la tengas, escríbeme por acá y podrás consultar tus pagos, mandar comprobantes y recibir los avisos de tu atleta.', time: '3:10 p. m.' },
      ], 'Caso B: te manda el enlace para crear la cuenta.')) +
    row(
      step(1, 'Crear la cuenta desde el enlace',
        p('El enlace abre la página <b>Crear cuenta</b>. Si el club te había invitado por correo, el correo ya viene escrito: <b>usa ese mismo correo</b>. Elige una contraseña (mínimo 8 caracteres), escribe tu nombre, revisa tu WhatsApp, marca <b>Acudiente</b> en «Soy…», acepta los términos y pulsa <b>Crear mi cuenta</b>.') +
        warn('Usa el correo que ya viene escrito', 'Si lo cambias por otro, la cuenta se crea pero <b>no queda unida a tu atleta</b>, y el asistente te seguirá pidiendo que te registres.') +
        I(club.notasInternas.registro)),
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
      I('El texto de la respuesta lo redacta el modelo (<code>get_payment_status</code>) y puede variar de una vez a otra; los datos salen siempre de la herramienta.'),
      chat([
        { from: 'papa', text: 'Cuánto debo', time: '8:05 p. m.' },
        { from: 'bot', text: 'Actualmente tienes un saldo total pendiente de *$300.000 COP*:\n\n• *Mensualidad 09/2026 - Valentina Gómez:* $150.000 (Venció el 10 de septiembre de 2026)\n• *Mensualidad 10/2026 - Valentina Gómez:* $150.000 (Vence el 10 de octubre de 2026)\n\n✅ *Pagos al día:*\n• *Mensualidad 08/2026:* $150.000 — pagado y confirmado por la escuela\n\nSi deseas conocer los medios de pago disponibles, con gusto te los comparto.', time: '8:05 p. m.' },
      ], 'Ejemplo con datos ficticios.'))
  );

  // Cap. 4 — Cómo pagar
  const respuestaPago = club.cuentasEjemplo
    ? 'Puedes realizar tu pago de las siguientes formas:\n\n1. *Transferencia:* a las cuentas de la escuela\n' +
      club.cuentasEjemplo.map((c) => `   • ${c}`).join('\n') +
      '\n2. *En línea:* ingresando a https://app.sportmaps.co/my-payments\n3. *Por este chat:* si ya hiciste la transferencia, envíame la foto o captura del comprobante por aquí mismo y lo registro.'
    : 'Puedes realizar tu pago de las siguientes formas:\n\n1. *En línea:* ingresando directamente a https://app.sportmaps.co/my-payments\n2. *Por este chat:* si ya realizaste una transferencia o consignación, puedes enviarme la foto o captura del comprobante por aquí mismo y nos encargamos de registrarlo.';
  pgs.push(
    chapter(4, 'Cómo pagar', 'Escribe «cómo pago», «a qué cuenta consigno» o «aceptan Nequi?»',
      club.cuentasEjemplo
        ? 'El asistente te da <b>las cuentas del club</b> con el número completo para transferir, el <b>enlace para pagar en línea</b> y te recuerda que puedes mandar el comprobante por el mismo chat.'
        : 'El asistente te da el <b>enlace para pagar en línea</b> y te recuerda que puedes mandar el comprobante de tu transferencia por el mismo chat.') +
    row(
      chat([
        { from: 'papa', text: 'Cómo pago', time: '8:06 p. m.' },
        { from: 'bot', text: respuestaPago, time: '8:06 p. m.' },
      ], club.cuentasEjemplo ? 'Ejemplo: el asistente responde con las cuentas reales del club.' : 'Ejemplo de respuesta.'),
      step(1, 'Pagar en línea desde «Mis Pagos»',
        p('El enlace abre <b>Mis Pagos</b> en SportMaps (inicias sesión con tu correo y contraseña). Ahí ves lo pendiente, lo aprobado y el estado de cuenta de cada hijo.'),
        img('02-mis-pagos-top.png', 'Mis Pagos del acudiente (captura real, cuenta de demostración).', 250))) +
    warn('Antes de transferir', club.cuentasEjemplo
      ? 'Transfiere <b>solo a las cuentas que te da el asistente o el club</b>. Si el comprobante muestra otra cuenta, el asistente te avisa que no es una cuenta del club.'
      : 'Transfiere <b>solo a las cuentas que te dé el club</b>. Si tienes dudas, escribe «quiero hablar con una persona».') +
    I(club.notasInternas.cuentas)
  );

  // Cap. 5 — Comprobante
  pgs.push(
    chapter(5, 'Enviar el comprobante de pago', 'Manda la foto o el PDF de la transferencia al chat',
      'Es la forma más rápida de que tu pago quede registrado: no tienes que entrar a la app ni esperar a que alguien lo lea. El asistente <b>lee el comprobante</b>, lo aplica a tu cobro y, cuando el club lo confirma, <b>te avisa por el mismo chat</b>.') +
    row(
      step(1, 'Manda la foto o el PDF que te da el banco', p('Una <b>foto clara</b> o la captura de pantalla del comprobante, donde se vean el valor, la fecha, la cuenta de destino y el número de aprobación.')) +
      step(2, 'El asistente lo aplica a tu cobro', p('Te dice a qué cobro lo aplicó y, si te queda algo más pendiente, te lo recuerda.')) +
      step(3, 'El club lo confirma y te avisa', p('Cuando el club lo revisa, te llega: <b>«¡Listo! ✅ La escuela confirmó tu pago…»</b>. Si no lo pudo validar, te dice el motivo para que mandes el correcto.')),
      chat([
        { kind: 'img', text: '$150.000', time: '9:12 a. m.' },
        { from: 'bot', text: 'Recibí tu comprobante 📄 Lo estoy revisando y te confirmo en un momento.', time: '9:12 a. m.' },
        { from: 'bot', text: 'Recibí tu comprobante y lo apliqué a *Mensualidad 09/2026 - Valentina Gómez* 📄\n\nLa escuela lo está revisando y te confirma en poco tiempo.', time: '9:13 a. m.' },
        { from: 'bot', text: '¡Listo! ✅ La escuela confirmó tu pago de *$ 150.000* por *Mensualidad 09/2026 - Valentina Gómez*. Queda al día.', time: '11:40 a. m.' },
      ], 'De la foto a la confirmación del club.'))
  );

  pgs.push(
    `<h3 class="sub">Si tienes varios cobros pendientes</h3>` +
    row(
      p('Cuando no sabe a cuál cobro va el comprobante, <b>te pregunta</b> con una lista numerada. Respóndele solo con el número. Si te equivocas o no sabes, respóndele «ninguno» y no lo aplica.') +
      tip('Un comprobante, un pago', 'Cada comprobante se aplica a <b>un solo cobro</b>. Si hiciste una sola transferencia para pagar dos meses, escríbele al club para que la repartan.'),
      chat([
        { kind: 'img', text: '$150.000', time: '6:02 p. m.' },
        { from: 'bot', text: 'Recibí tu comprobante, pero tienes varios cobros pendientes y no quiero aplicarlo al que no es 🤔\n\n1. Mensualidad 09/2026 - Valentina Gómez por $ 150.000 (vence 2026-09-10)\n2. Mensualidad 09/2026 - Samuel Gómez por $ 150.000 (vence 2026-09-10)\n\nRespóndeme con el número al que corresponde.', time: '6:02 p. m.' },
        { from: 'papa', text: '2', time: '6:03 p. m.' },
      ], 'Te pregunta a cuál cobro aplicarlo.')) +
    `<h3 class="sub">Otros avisos que te puede dar</h3>` +
    `<table class="tbl"><tr><th>Si pasa esto…</th><th>El asistente te dice…</th><th>Qué hacer</th></tr>
      <tr><td>Mandas un comprobante que ya habías enviado</td><td>«Ese comprobante ya lo había recibido, así que no lo apliqué de nuevo.»</td><td>Nada, ya quedó. Si fue otra transferencia, manda <b>ese</b> comprobante.</td></tr>
      <tr><td>La transferencia fue a una cuenta que no es del club</td><td>«…el dinero se envió a la cuenta …, que no es ninguna de las cuentas registradas por la escuela.»</td><td>Revisa la llave o el número. Si ya transferiste, escríbele al club.</td></tr>
      <tr><td>Mandas un archivo que no puede leer</td><td>«Recibí tu archivo, pero no puedo leer ese formato. Mándame una <b>foto</b>…»</td><td>Manda una foto, captura o PDF.</td></tr>
      <tr><td>El club no pudo validar el pago</td><td>«La escuela revisó tu comprobante… y no lo pudo validar.» + el motivo</td><td>Corrige y manda el comprobante correcto.</td></tr></table>`
  );

  // Cap. 6 — Info del club
  if (club.horarios) {
    pgs.push(
      chapter(6, 'Sede, categorías y horarios', 'Escribe «dónde queda», «qué categorías hay» o «a qué hora entrena mi hijo»',
        'El asistente responde con la información que el club tiene cargada: la sede, las categorías y los <b>horarios de entrenamiento</b> de cada una. Si un dato no lo tiene, <b>te lo dice</b> y te ofrece pasarte con el club; nunca se inventa un horario.') +
      row(
        tip('Pregunta por la categoría', `Si preguntas «a qué hora entrena mi hijo», te responde con el horario de su categoría. Los nombres de las categorías los dice tal cual los usa el club (por ejemplo, <b>${club.categoriaEjemplo}</b>).`) +
        warn('Cambios de última hora', 'Si el club cancela o mueve un entrenamiento por un festivo o un torneo, el aviso te llega por el club y por el Calendario de la app; el asistente responde el horario habitual.') +
        I(club.notasInternas.horarios),
        chat([
          { from: 'papa', text: `A qué hora entrena ${club.horarios.equipo}?`, time: '5:20 p. m.' },
          { from: 'bot', text: `La categoría *${club.horarios.equipo}* entrena:\n\n${club.horarios.texto}\n\nSi necesitas confirmar algo más, con gusto te paso con el club.`, time: '5:20 p. m.' },
        ], 'Ejemplo de respuesta con horario cargado.'))
    );
  } else {
    pgs.push(
      chapter(6, 'Sedes y categorías', 'Escribe «dónde queda», «qué sedes tienen» o «qué categorías hay»',
        'El asistente responde con la información que el club tiene cargada: <b>dónde queda</b> y <b>qué categorías tiene</b>. Lo que no tiene a la mano —como los horarios de entrenamiento— <b>te lo dice</b> y te ofrece pasarte con el club; nunca se inventa un dato.') +
      row(
        tip('Horarios de entrenamiento', 'Para saber a qué hora entrena tu atleta, pregúntale al asistente «quiero hablar con una persona» y el club te confirma el horario de su categoría.') +
        tip('Nombres de categoría', `Los nombres de las categorías los dice tal cual los usa el club (por ejemplo, <b>${club.categoriaEjemplo}</b>).`) +
        I(club.notasInternas.horarios),
        chat([
          { from: 'papa', text: club.infoEjemplo.pregunta, time: '5:20 p. m.' },
          { from: 'bot', text: club.infoEjemplo.respuesta, time: '5:20 p. m.' },
          { from: 'papa', text: 'Y a qué hora entrenan?', time: '5:21 p. m.' },
          { from: 'bot', text: 'Los horarios de entrenamiento no los tengo a la mano. Si quieres, te paso con una persona del club para que te los confirme. 🙌', time: '5:21 p. m.' },
        ], 'Ejemplo: la sede sí la sabe; el horario lo confirma el club.'))
    );
  }

  // Cap. 7 — Hablar con una persona
  pgs.push(
    chapter(7, 'Hablar con una persona del club', 'Escribe «quiero hablar con alguien» o pregunta algo que el asistente no sepa',
      'Cuando algo se sale de lo que el asistente puede resolver —inscripciones nuevas, cambios de categoría, descuentos, uniformes, torneos, un problema con tu cuenta— <b>te pasa con el club</b>. La conversación sigue en el mismo chat: alguien del equipo te responde ahí mismo.') +
    row(
      tip('Fuera del horario de atención', 'El asistente responde las 24 horas, pero las personas del club no. Si escribes de noche o en fin de semana, te dice <b>cuándo te van a responder</b>.') +
      warn('Notas de voz y videos', 'El asistente <b>no puede escuchar notas de voz</b> ni ver videos. Escríbele el mensaje. Si es un comprobante, mándalo como foto o PDF.') +
      I(club.notasInternas.humano),
      chat([
        { from: 'papa', text: 'Quiero cambiar a mi hija de categoría', time: '10:15 p. m.' },
        { from: 'bot', text: 'Voy a pasar tu caso con una persona del equipo de la escuela para ayudarte mejor.\n\nAhora mismo están fuera del horario de atención, así que te responden mañana a las 8:00. 🙌', time: '10:15 p. m.' },
        { kind: 'audio', time: '10:16 p. m.' },
        { from: 'bot', text: 'No puedo escuchar notas de voz 🙊 Escríbeme el mensaje y te ayudo. Y si es un comprobante de pago, mándame la *foto* o el *PDF* que te da el banco.', time: '10:16 p. m.' },
      ], 'Te pasa con el club y te dice cuándo te responden.'))
  );

  // Cap. 8 — Avisos + resumen
  pgs.push(
    chapter(8, 'Avisos automáticos y resumen', 'Palabras para activar o apagar los avisos',
      'Si activaste los avisos, por este chat te llegan los <b>recordatorios de pago</b> y los <b>avisos de tu atleta</b>. Puedes apagarlos o volver a prenderlos cuando quieras.') +
    `<table class="tbl"><tr><th>Escribe</th><th>Qué pasa</th></tr>
      <tr><td><b>SÍ</b> (cuando te lo pregunta)</td><td>Activa los recordatorios de pago y los avisos de tu atleta.</td></tr>
      <tr><td><b>STOP</b> o <b>baja</b></td><td>Deja de enviarte mensajes automáticos. Igual puedes seguir preguntándole lo que quieras.</td></tr>
      <tr><td><b>ACTIVAR</b></td><td>Vuelve a prender los avisos si los habías apagado.</td></tr></table>` +
    `<h3 class="sub">Resumen: qué escribir</h3>` +
    `<table class="tbl"><tr><th>Quiero…</th><th>Escribo…</th></tr>
      <tr><td>Saber cuánto debo</td><td>«cuánto debo», «mis pagos»</td></tr>
      <tr><td>Saber cómo pagar</td><td>«cómo pago»${club.cuentasEjemplo ? ', «a qué cuenta consigno»' : ''}</td></tr>
      <tr><td>Registrar mi pago</td><td>Mando la <b>foto</b> o el <b>PDF</b> del comprobante</td></tr>
      <tr><td>Saber si ya me aprobaron</td><td>«ya aprobaron mi pago?»</td></tr>
      <tr><td>${club.horarios ? 'Horario o sede' : 'Sede o categorías'}</td><td>${club.horarios ? '«a qué hora entrena mi hija», «dónde queda»' : '«dónde queda», «qué categorías hay»'}</td></tr>
      <tr><td>Hablar con alguien del club</td><td>«quiero hablar con una persona»</td></tr></table>` +
    tip('Privacidad', 'El asistente solo te muestra información <b>de tu familia</b>, y solo cuando escribes desde el celular registrado en tu cuenta. Nunca te va a pedir tu contraseña ni datos de tarjetas.') +
    I('Antes de enviar a las familias: (1) número del club conectado y, si va por Coexistence, sincronización del historial completa (plazo 24 h); (2) BFF desplegado con el fix de cuentas del 2026-09-29; (3) asistente prendido (<code>ai_enabled</code>); (4) horario de atención cargado en <code>whatsapp_settings.business_hours</code>; (5) prueba con un acudiente real del club (Te reconocí → cuánto debo → foto → confirmación); (6) alguien del club mirando <b>Conversaciones</b> los primeros días.')
  );

  return pgs;
}

// ── Ensamblado ────────────────────────────────────────────────────────────
function html(club, isInternal) {
  const css = fs.readFileSync(path.join(here, 'manual.css'), 'utf8') + fs.readFileSync(path.join(here, 'extra.css'), 'utf8');
  const body = pages(club, isInternal);
  const total = body.length + 1;
  const foot = (n) => `<div class="footer${isInternal ? ' internal-mark' : ''}"><span>${isInternal ? 'SportMaps · Uso interno' : 'SportMaps · Guía de uso'}</span><span>Página ${n} de ${total}</span></div>`;
  const sub = club.numero
    ? `Consulta tus pagos, envía tus comprobantes y resuelve dudas escribiendo al mismo número de siempre, ${club.numero}. Te atiende un asistente automático las 24 horas, y el club cuando lo necesitas.`
    : 'Consulta tus pagos, envía tus comprobantes y resuelve dudas escribiendo al WhatsApp del club. Te atiende un asistente automático las 24 horas, y el club cuando lo necesitas.';
  const cover = `<section class="page cover"><div class="cover-inner">
    <div class="logo"><span class="pin"></span>SportMaps</div>
    <div>
      ${isInternal ? '<div class="cover-eyebrow"><span class="dot"></span>🔒 Uso interno — no enviar a escuelas</div>' : `<div class="cover-eyebrow"><span class="dot"></span>${club.nombre}</div>`}
      <h1 class="cover-title">WhatsApp del club: guía para familias</h1>
      <p class="cover-sub">${sub}</p>
      <div class="pills"><span class="pill">Para acudientes</span>${club.numero ? `<span class="pill">${club.numero}</span>` : `<span class="pill">${club.nombre}</span>`}<span class="pill">8 pasos guiados</span>${isInternal ? '<span class="pill" style="border-color:#ff8833;color:#ffcf9e">Uso interno</span>' : ''}</div>
    </div>
    <div class="cover-footer">SportMaps · Septiembre de 2026</div>
  </div></section>`;
  const secs = body.map((c, i) => `<section class="page">${c}${foot(i + 2)}</section>`).join('\n');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>WhatsApp del club — guía para familias</title><style>${css}</style></head><body>${cover}${secs}</body></html>`;
}

const elegidos = process.env.CLUB ? [process.env.CLUB] : Object.keys(CLUBS);
const browser = await chromium.launch();
try {
  await makeCrops(browser);
  for (const key of elegidos) {
    const club = CLUBS[key];
    if (!club) throw new Error(`Club desconocido: ${key}. Opciones: ${Object.keys(CLUBS).join(', ')}`);
    for (const kind of ['academias', 'interno']) {
      const base = path.join(repo, 'docs/manuales', kind, club.slug);
      fs.writeFileSync(base + '.html', html(club, kind === 'interno'));
      const page = await browser.newPage({ viewport: { width: 816, height: 1056 } });
      await page.goto('file:///' + (base + '.html').replace(/\\/g, '/'), { waitUntil: 'networkidle' });
      await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalHeight));
      const over = await page.evaluate(() => [...document.querySelectorAll('.page')]
        .map((el, i) => ({ i: i + 1, h: el.scrollHeight })).filter((x) => x.h > 1056));
      if (over.length) console.log(`[${key}/${kind}] páginas que desbordan:`, JSON.stringify(over));
      await page.pdf({ path: base + '.pdf', width: '816px', height: '1056px', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
      await page.close();
      console.log(`${key}/${kind}: ${base}.pdf`);
    }
  }
} finally {
  await browser.close();
}
