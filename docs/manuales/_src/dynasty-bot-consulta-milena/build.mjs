// PDF de consulta para Milena (Dynasty): cómo debe tratar el bot de WhatsApp los torneos y otros casos.
// Fuente: conversaciones reales de Dynasty, 2–16 oct 2026. Sin nombres de familias ni de menores.
// Uso: node docs/manuales/_src/dynasty-bot-consulta-milena/build.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aquí = path.dirname(fileURLToPath(import.meta.url));
const SALIDA = path.resolve(aquí, '../../../dynasty-bot-consulta-milena-2026-10-16.pdf');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const bub = (who, txt) => `<div class="b ${who}"><span class="w">${{ f: 'Familia', m: 'Milena', bot: 'Bot' }[who]}</span>${esc(txt)}</div>`;
const chat = (...msgs) => `<div class="chat">${msgs.map(([w, t]) => bub(w, t)).join('')}</div>`;
const box = (txt) => `<div class="op"><i></i><span>${txt}</span></div>`;
const line = (lbl) => `<div class="ln"><span>${lbl}</span><u></u></div>`;

const card = ({ n, tag, titulo, pasa, hoy, propuesta, preguntas }) => `
<section class="card">
  <div class="head"><div class="num">${n}</div><div><div class="tag">${tag}</div><h3>${titulo}</h3></div></div>
  <div class="lbl">Lo que pasó</div>${pasa}
  <div class="two">
    <div class="mini"><div class="lbl">Qué hace el bot hoy</div><p>${hoy}</p></div>
    <div class="mini ok"><div class="lbl">Lo que proponemos</div><p>${propuesta}</p></div>
  </div>
  <div class="q"><div class="lbl">Necesitamos que nos digas</div>${preguntas}</div>
</section>`;

const torneos = [
  card({
    n: 1, tag: 'Torneos · Pagos', titulo: 'Pagos de torneo a la cuenta de Giovanni',
    pasa: chat(
      ['bot', 'Revisé tu comprobante y el dinero se envió a la cuenta [llave], que no es ninguna de las cuentas registradas por la escuela. Verifica la llave o el número antes de volver a transferir…'],
      ['f', 'Es el pago de los torneos que siempre se envía a la cuenta del entrenador, lo cual no está mal, pero sí debería existir un vínculo entre esa cuenta y Dynasty.'],
    ),
    hoy: 'En 14 días, al menos <b>5 familias</b> que pagaron un torneo recibieron este aviso. Suena a que se equivocaron o a que las estafaron, y no es así.',
    propuesta: 'Registrar las cuentas de Giovanni como <b>«pago por fuera de SportMaps»</b>. El bot respondería: «Recibí tu comprobante 📄 Los pagos de torneo se manejan directamente con el club, así que no los registro aquí», y a ti te queda anotado como informativo. La función ya existe; falta cargar las cuentas.',
    preguntas: line('Cuentas donde Giovanni recibe torneos (Nequi, Bre-B, otras)') +
      box('Está bien el texto propuesto  ·  Prefiero este otro: ________________') +
      box('El control de quién pagó cada torneo lo lleva: Milena · Giovanni · SportMaps (cobro «torneo» marcado como pagado por fuera)') +
      box('Si una familia pide soporte de lo pagado (renta, contadora): Dynasty da constancia · No'),
  }),
  card({
    n: 2, tag: 'Torneos · Información', titulo: 'Fechas, reglamento y convocatoria',
    pasa: chat(
      ['f', 'Y cuándo es el torneo'],
      ['m', 'Ese es el 8 de nov'],
      ['f', '¿Me podrías compartir el reglamento del torneo menores femenino por favor?'],
      ['f', 'Están hablando en el grupo del torneo, pero [atleta] no está en la lista, o no sé si no la convocaron.'],
    ),
    hoy: 'El bot <b>no tiene fechas ni reglamentos de torneos</b>: pasa el mensaje y la familia espera. La pregunta de la fecha tardó 25 minutos en responderse; la de la convocatoria no es de las que el bot deba contestar.',
    propuesta: 'El bot responde <b>fecha, hora y lugar</b> de los torneos que cargues en el calendario, y envía el <b>reglamento</b> (PDF) que subas. La <b>convocatoria</b> (quién juega, en qué equipo) siempre la responde una persona.',
    preguntas: box('Las fechas de torneos las carga: Milena · Giovanni · los dejamos en el grupo de WhatsApp') +
      box('Reglamento: lo subes tú · lo manda el organizador · no se envía por el bot') +
      box('¿Quién responde convocatorias? Milena · Giovanni · el entrenador de cada grupo') +
      line('Torneos que quedan este año (nombre y fecha)'),
  }),
  card({
    n: 3, tag: 'Torneos · Cancelaciones', titulo: 'Torneo cancelado y devoluciones',
    pasa: chat(
      ['m', 'Les informo que la organización del torneo de la categoría juvenil decidió cancelarlo. Por tal motivo, comenzaré a realizar la devolución del dinero de manera individual.'],
      ['f', 'Hola Mile, por favor devolver el dinero.'],
    ),
    hoy: 'El bot no tiene una regla para «devolución». Hay riesgo de que conteste algo que suene a promesa, y la promesa es tuya, no de él.',
    propuesta: 'El bot <b>nunca promete ni da plazos</b> de devolución: responde «Milena revisa tu caso y te escribe» y te avisa con la etiqueta <b>devolución</b>.',
    preguntas: box('Torneo cancelado por el organizador: se devuelve el 100 %') +
      box('La familia se retira <b>antes</b> de que se pague al organizador: se devuelve ____ %') +
      box('La familia se retira <b>después</b> de pagar al organizador: no se devuelve · se devuelve ____ %') +
      line('Plazo para devolver (días)') + line('Texto que debe decir el bot'),
  }),
  card({
    n: 4, tag: 'Torneos · Viajes', titulo: 'Cuotas del viaje a México',
    pasa: chat(
      ['f', '2da cuota vuelos [atletas] México  (con foto del comprobante)'],
      ['bot', 'Recibí tu comprobante 📄 Para poder aplicarlo necesito saber quién eres. Escríbeme el correo con el que estás registrado…'],
      ['f', '…no queremos perjudicar nada de lo que tú ya hiciste. Hablamos con Giovanni y seguimos con ustedes.'],
    ),
    hoy: 'Ya se decidió que el viaje <b>no se cobra por SportMaps</b>. El 3 de octubre el bot pidió correo a una familia que sí es de la escuela, como si fuera una mensualidad.',
    propuesta: 'Las cuotas del viaje se tratan igual que el torneo: «Recibí tu comprobante; las cuotas del viaje las maneja Milena directamente». Nunca se aplican a la mensualidad. Si alguien pregunta por <b>retirarse del viaje</b>, pasa a ti.',
    preguntas: line('Cuenta(s) donde se pagan las cuotas del viaje') +
      box('Si preguntan por retirarse: el bot pasa a Milena · responde un texto fijo: ________________') +
      box('¿Hay un segundo viaje o torneo con cuotas este año?  Sí ______  ·  No'),
  }),
  card({
    n: 5, tag: 'Torneos · Uniformes', titulo: 'Uniformes para los torneos',
    pasa: chat(
      ['f', '¿Me ayudas con el precio de los otros dos uniformes de [atleta] para los torneos?'],
      ['m', 'Sí claro, valen $104… Ese valor se consigna al Nequi.'],
      ['f', '¿Ya le llegó el uniforme?  ·  ¿Para cuándo me lo entregarían?'],
    ),
    hoy: 'El bot <b>no vende uniformes</b> (decisión tuya del 7 de oct) y pasa el caso. Pero en un solo día tres familias preguntaron por el estado de su pedido.',
    propuesta: 'El bot recoge <b>talla y número</b> y avisa a quién lo gestiona. El <b>estado del pedido</b> y la fecha de llegada los responde una persona, salvo que nos des una fecha de entrega del lote.',
    preguntas: box('El bot puede decir el precio del uniforme: $ ________  ·  Siempre lo dice Milena') +
      line('Fecha estimada de llegada del próximo lote') +
      box('Los pedidos (talla, número, pago) los llevamos: en una lista de SportMaps · como hasta ahora, por WhatsApp'),
  }),
  card({
    n: 6, tag: 'Torneos · Certificados', titulo: 'Certificados de torneos jugados',
    pasa: chat(
      ['f', 'Milena, qué pena: los certificados que necesitamos son los de todos los torneos a los que ha asistido o participado [atleta], para temas de la universidad.'],
    ),
    hoy: 'El bot dice «dejo tu mensaje para Milena». Tú tienes que volver a pedirle los datos a la familia por el chat.',
    propuesta: 'El bot pide <b>nombre completo, documento y para qué se necesita</b> (universidad, EPS, beca) y te lo entrega listo, con la etiqueta <b>certificado</b>.',
    preguntas: box('Quién firma y emite el certificado: Milena · Giovanni · otra persona: ____________') +
      box('Costo: gratis · $ ________') + line('Plazo de entrega (días hábiles)') +
      box('¿Hay un registro de en qué torneos jugó cada atleta?  Sí, dónde: ______  ·  No, hay que armarlo'),
  }),
  card({
    n: 7, tag: 'Torneos · Familias nuevas', titulo: 'Quien llega preguntando por torneos',
    pasa: chat(
      ['f', 'Me gustaría conocer del club qué torneos futuros y clase de cortesía.'],
      ['f', '¿Cómo serían los costos y si tienen o participan en torneos seguido?'],
    ),
    hoy: 'El bot sabe de clase de cortesía, planes y precios, pero <b>no sabe qué decir de los torneos</b>: cuántos hay, cuánto cuestan, si van incluidos en la mensualidad.',
    propuesta: 'Un texto corto y verdadero sobre torneos que el bot use con familias nuevas y actuales. Lo redactamos con lo que respondas.',
    preguntas: line('Torneos que juega Dynasty en un año (aprox.)') + line('Costo típico de un torneo ($)') +
      box('Los torneos van incluidos en la mensualidad · se cobran aparte, cada uno') +
      box('A familias nuevas el bot habla de torneos · prefiero que lo hable yo en la clase de cortesía'),
  }),
];

const otros = [
  card({
    n: 8, tag: 'Con quién habla el bot', titulo: 'Otros clubes, organizadores, entrenadores y spam',
    pasa: chat(
      ['f', '(un club) Te comparto la invitación; no sé si de pronto puedan participar del mini este lunes.'],
      ['bot', 'Si eres familia de un atleta y quieres consultar pagos o inscripciones, escríbeme el correo electrónico con el que estás registrado…'],
      ['f', '(otro club) Podrías agregar a [persona], quien está a cargo de torneos y pagos.'],
    ),
    hoy: 'En el teléfono de la escuela entran también <b>clubes aliados, organizadores, entrenadores, tu familia y hasta mensajes de estafa</b> (un falso «Nequi te regala $600.000»). A varios el bot les contestó como si fueran una familia nueva.',
    propuesta: 'Una lista de números <b>donde el bot nunca responde</b> (entrenadores, clubes aliados, organizadores, proveedores). Esos chats siguen siendo solo tuyos.',
    preguntas: line('Entrenadores y staff (nombre y número)') + line('Clubes aliados y organizadores de torneos (nombre y número)') +
      box('Si un club u organizador nuevo escribe, avisarle a: Milena · Giovanni'),
  }),
  card({
    n: 9, tag: 'Familias sin cuenta', titulo: 'Preguntas sencillas de familias que aún no crean la cuenta',
    pasa: chat(
      ['f', 'Hola buenas tardes… Te quería preguntar cuándo es el entreno de las 2013.'],
      ['bot', 'Tu número está registrado en la escuela, pero todavía no tienes tu cuenta creada. 🙌 Créala aquí…'],
    ),
    hoy: 'Hubo <b>21 avisos de «crea tu cuenta»</b> en 14 días. Cuando la familia pregunta por un horario, el bot solo manda el enlace y la pregunta espera hasta que tú la veas.',
    propuesta: 'Sin cuenta, el bot responde lo que <b>no es privado</b>: horarios, fechas de torneos, dónde queda cada cancha. Para pagos y comprobantes sigue pidiendo la cuenta.',
    preguntas: box('Sí, que responda horarios, torneos y direcciones sin cuenta  ·  No, solo con cuenta'),
  }),
  card({
    n: 10, tag: 'Día a día', titulo: 'Cambios de última hora: sede, clima y entrenamientos',
    pasa: chat(
      ['f', 'Mile, ¿el entreno se mantiene el de mis grupos en la cancha externa?'],
      ['m', 'Hola, es que está brisando. Mejor coliseo.'],
      ['f', 'Esos horarios son en la cancha del lado de la Ribera, o al lado de la Boyacá?'],
    ),
    hoy: 'El bot conoce los horarios fijos de cada grupo, no los <b>cambios del día</b> (lluvia, cancha externa, cancelación). La pregunta «¿hoy hay entreno?» solo la puedes responder tú.',
    propuesta: 'Cuando hay un cambio, lo publicas una vez en el calendario (llega por notificación y WhatsApp) y el bot responde «hoy sí hay / hoy cambió a…» a quien pregunte. Sin aviso cargado, te pasa la pregunta.',
    preguntas: box('Los cambios del día los publica: Milena · Giovanni · el entrenador de cada grupo') +
      line('Canchas que usan y su dirección (Coliseo Dynasty, Nido del Colibrí, ¿cuáles más?)') +
      line('¿Cuál es «la cancha del lado de la Ribera»?'),
  }),
  card({
    n: 11, tag: 'Mensualidad', titulo: 'Faltas, viajes y pagos por menos de la mensualidad',
    pasa: chat(
      ['f', 'El mes pasado pagué $162.000 por los días que ella iba a asistir; este mes pagué lo mismo, pero me llegaron mensajes de que no corresponde a $180.000. ¿Cómo procedo?'],
      ['f', '[atleta] solo asistió 5 veces; queremos corroborar el valor pendiente.'],
      ['bot', 'La escuela revisó tu comprobante… y no lo pudo validar.  (el mismo mensaje, 3 veces)'],
    ),
    hoy: 'Si el pago es menor que el cobro, el bot lo rechaza o lo manda a revisión sin saber <b>si hay un descuento acordado</b>. La familia se queda con un mensaje que parece un reclamo.',
    propuesta: 'El bot <b>no negocia ni descuenta</b>. Si la familia explica una ausencia, responde «Milena lo revisa» y te llega con la etiqueta <b>ausencia / descuento</b>.',
    preguntas: box('Se descuenta por clases perdidas: nunca · solo con aviso previo · solo por lesión · caso a caso (Milena)') +
      box('Se aceptan pagos por días (como los $162.000): sí · no') +
      line('Valor de una clase suelta ($)') + box('Quién autoriza el descuento: Milena · Giovanni'),
  }),
  card({
    n: 12, tag: 'Mensualidad', titulo: 'Valores que no cuadran: $150.000, $180.000 y $210.000',
    pasa: chat(
      ['f', 'Lo de [atleta] está mal en el aplicativo: eran 180 y quedó 210. ¿Se puede corregir desde allá?'],
      ['bot', 'Recibí tu comprobante de $180.000. No coincide con el valor de la Mensualidad… por $210.000, así que se lo paso a la escuela.'],
    ),
    hoy: 'En el sistema hay mensualidades de <b>$150.000, $180.000 y $210.000</b>. Cuando el comprobante no coincide con el valor del cobro, el bot no lo aplica solo y a ti te llega a revisar.',
    propuesta: 'Confirmar qué significa cada valor para <b>corregir de una vez los cobros mal cargados</b>. Así el bot los valida solo, sin que tengas que revisar cada uno.',
    preguntas: line('$150.000 corresponde a') + line('$180.000 corresponde a') + line('$210.000 corresponde a') +
      box('Hay otros valores (hermanos, 2 clases, becas): ________________'),
  }),
  card({
    n: 13, tag: 'Clases extra', titulo: 'Clase de perfeccionamiento y clases sueltas',
    pasa: chat(
      ['f', 'Quisiera participar en la clase de perfeccionamiento del martes. ¿Todas las categorías pueden asistir? ¿Cuál sería el medio de pago?'],
      ['m', 'Por Nequi al [número].'],
      ['f', '¿Habría chance de pagar en físico?'],
      ['bot', 'Lo de pagar en efectivo y el cupo… no lo tengo a la mano. Si quieres, le paso tu mensaje a la escuela.'],
    ),
    hoy: 'El precio de la clase extra <b>no está definido</b>, así que el bot solo pasa el caso. Cada pregunta de este tipo la respondes tú.',
    propuesta: 'Con precio, categorías, cupo y formas de pago definidos, el bot responde estas preguntas y recibe el comprobante sin molestarte.',
    preguntas: line('Precio de la clase extra / perfeccionamiento ($)') + line('Categorías que pueden asistir') + line('Cupo máximo por clase') +
      box('Pago en efectivo en el coliseo: sí (4 a 9 p. m.) · solo Nequi'),
  }),
];

otros.push(
  card({
    n: 14, tag: 'Con quién habla el bot', titulo: 'Saludos sueltos de números que no conocemos',
    pasa: chat(
      ['f', 'Hola buenos días'],
      ['f', '(…y nada más. El chat queda en «Sin responder» en la bandeja)'],
    ),
    hoy: 'Si el número no está en ninguna ficha y solo saluda, el bot <b>se queda callado</b>: ese teléfono también recibe amigos, entrenadores y tu familia, y no queremos contestarles como si fueran clientes. En cuanto la persona pide algo (precios, horarios, clase de cortesía) el bot responde enseguida.',
    propuesta: 'Que el bot conteste <b>una línea</b>: «Hola 👋 soy el asistente de Dynasty, ¿en qué te ayudo?». Ganas rapidez con las familias nuevas; a cambio, a veces le saluda a un amigo.',
    preguntas: box('Que el bot salude y pregunte  ·  Que siga callado ante un saludo suelto (lo ves tú)') +
      box('Los chats personales y de entrenadores los marcamos como «no familia» para que no llenen tu bandeja: me parece bien · prefiero verlos todos'),
  }),
  card({
    n: 15, tag: 'Día a día', titulo: '«¿Hoy entrena…?» de una persona que quiere ir a la clase de cortesía',
    pasa: chat(
      ['f', 'Oye, una pregunta: ¿hoy entrena el juvenil femenino? Es para ir a la clase de cortesía.'],
      ['bot', '(muestra dos veces la lista de próximos horarios y el enlace de inscripción, sin decir si ese grupo entrena hoy)'],
      ['m', 'Sí claro… pero ya para el otro año.'],
    ),
    hoy: 'El bot responde con la lista general de clases de cortesía y <b>no contesta la pregunta concreta</b> («¿entrena hoy el grupo X?»). La persona termina escribiéndote.',
    propuesta: 'Si el grupo entrena hoy y hay cupo, el bot lo dice; si el grupo no tiene cortesía abierta (juvenil), lo dice claro y ofrece el grupo más cercano, o te pasa el caso.',
    preguntas: box('Grupos que SÍ reciben clase de cortesía: ________________') +
      box('Grupos que NO (cerrados, solo por invitación o con cupo lleno): ________________') +
      box('Cuando preguntan por un grupo sin cortesía, el bot ofrece otro grupo · te pasa el caso a ti'),
  }),
);

const indice = [
  ...torneos.map((_, i) => i), ...otros.map((_, i) => 7 + i),
].length; // (solo para validar que las tarjetas existen)
const hoja = [
  [1, 'Pagos de torneo a la cuenta de Giovanni', '¿Qué cuentas registramos como «por fuera de SportMaps»?'],
  [2, 'Fechas, reglamento y convocatoria', '¿Quién carga las fechas? ¿Quién responde la convocatoria?'],
  [3, 'Torneo cancelado y devoluciones', '¿Cuál es la política de devolución?'],
  [4, 'Cuotas del viaje a México', '¿A qué cuenta se pagan? ¿Qué decir a quien quiera retirarse?'],
  [5, 'Uniformes para torneos', '¿El bot dice el precio? ¿Cuándo llega el lote?'],
  [6, 'Certificados de torneos', '¿Quién los emite, costo y plazo?'],
  [7, 'Familias nuevas y torneos', '¿Cuántos torneos hay al año y cuánto cuestan?'],
  [8, 'Otros clubes, entrenadores y spam', 'Lista de números donde el bot no responde'],
  [9, 'Familias sin cuenta con preguntas sencillas', '¿Puede responder horarios y direcciones sin cuenta?'],
  [10, 'Cambios de última hora y canchas', '¿Quién publica los cambios del día? ¿Qué canchas hay?'],
  [11, 'Faltas y pagos por menos de la mensualidad', '¿Se descuenta por clases perdidas?'],
  [12, 'Valores $150.000 / $180.000 / $210.000', '¿Qué significa cada uno?'],
  [13, 'Clase de perfeccionamiento', 'Precio, categorías, cupo y pago en efectivo'],
  [14, 'Saludos sueltos de desconocidos', '¿El bot saluda o sigue callado?'],
  [15, '«¿Hoy entrena…?» para clase de cortesía', '¿Qué grupos reciben cortesía?'],
];
const hojaHtml = `<h2 class="parte" style="break-before:page">Las 15 decisiones en una hoja</h2>
<table class="hoja"><thead><tr><th>#</th><th>Tema</th><th>Lo que hay que decidir</th><th>Hecho</th></tr></thead><tbody>
${hoja.map(([n, t, q]) => `<tr><td>${n}</td><td><b>${t}</b></td><td>${q}</td><td><i></i></td></tr>`).join('')}
</tbody></table>`;

const css = fs.readFileSync(path.join(aquí, 'estilo.css'), 'utf8');

const portada = `
<div class="cover">
  <div class="eyebrow">DYNASTY VOLLEY CLUB · Consulta con Milena</div>
  <h1>Cómo debe tratar el bot de WhatsApp los torneos, y otros casos</h1>
  <p>Revisamos 14 días de conversaciones reales. Estos son los casos donde el bot no sabe qué hacer, o hace algo que no corresponde, y necesitamos tu decisión para corregirlo.</p>
  <div class="pills"><span>2 al 16 de octubre 2026</span><span>388 chats revisados</span><span>15 decisiones</span></div>
</div>
<div class="intro">
  <div class="stats">
    <div><b>4.094</b><span>mensajes recibidos</span></div>
    <div><b>874</b><span>mensajes del bot</span></div>
    <div><b>2.727</b><span>mensajes tuyos y del equipo</span></div>
    <div><b>65</b><span>chats con torneos, viajes, uniformes, certificados, devoluciones o clases extra</span></div>
  </div>
  <h2>Cómo usar este documento</h2>
  <p>Cada tarjeta trae un caso real, <b>lo que hace el bot hoy</b>, <b>lo que proponemos</b> y las preguntas. Marca la opción o escribe al lado; con eso configuramos el bot. Los fragmentos de chat no llevan nombres de familias ni de menores.</p>
  <div class="callout"><b>LO QUE YA FUNCIONA</b>Confirmar pagos de mensualidad por WhatsApp, enviar las formas de pago y las llaves, y mostrar los horarios de la clase de cortesía. Lo que sigue son los casos que quedan por definir.</div>
  <div class="callout warn"><b>PRIMERO LOS TORNEOS</b>Son 7 de las 15 decisiones: es donde el bot hoy se equivoca más a la vista de las familias (cobros a la cuenta de Giovanni marcados como «cuenta ajena»).</div>
</div>`;

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${css}</style></head><body>
${portada}
${hojaHtml}
<h2 class="parte" style="break-before:page">Parte 1 · Torneos</h2>
${torneos.join('\n')}
<h2 class="parte">Parte 2 · Otros ajustes del bot</h2>
${otros.join('\n')}
<div class="cierre"><h2>Lo que sigue</h2>
<p>Con tus respuestas: (1) cargamos las cuentas de Giovanni como pagos por fuera de SportMaps, (2) ajustamos los textos del bot, (3) cargamos torneos, canchas y valores, y (4) revisamos otra semana de chats para confirmar que cada caso salga como lo definiste.</p></div>
</body></html>`;

fs.writeFileSync(path.join(aquí, 'documento.html'), html);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file:///' + path.join(aquí, 'documento.html').replace(/\\/g, '/'));
await page.evaluate(() => document.fonts.ready);
await page.pdf({
  path: SALIDA, format: 'Letter', printBackground: true,
  margin: { top: '48px', bottom: '64px', left: '48px', right: '48px' },
  displayHeaderFooter: true, headerTemplate: '<span></span>',
  footerTemplate: '<div style="width:100%;font-family:Arial;font-size:9px;color:#7a8a80;padding:0 48px;display:flex;justify-content:space-between;border-top:1px solid #dfe8e2;padding-top:6px"><span>SportMaps · Dynasty · Consulta del bot de WhatsApp</span><span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>',
});
await browser.close();
console.log('OK', SALIDA);
