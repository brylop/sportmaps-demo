# 06 · Ventas por WhatsApp y en campo — SportMaps Canchas

Número comercial: **+57 320 268 3539**. Este archivo tiene: la secuencia de primer contacto, el manejo de
objeciones, el guion de visita «crea tu sede en 5 minutos» y la oferta del club piloto.

## Reglas antes de escribirle a nadie

- **Uno a uno, escrito por una persona.** Nada de envíos masivos ni listas de difusión a números que no nos
  han escrito: Meta restringe los números que reciben muchos reportes, y el número comercial es el que
  usamos para todo.
- **Datos personales (Ley 1581 de 2012):** solo números de contacto **publicados por el negocio** (Google
  Maps, su Instagram, su web). Siempre se ofrece salir («si prefieres que no te escriba más, me dices y
  listo») y quien lo pida se marca en la hoja y no se vuelve a contactar. `<!-- VERIFICAR con asesoría
  legal el texto de tratamiento de datos para prospectos. -->`
- **Antes del 20-nov se vende la lista de espera y el piloto, no el producto.** Nunca «ya puedes…» antes
  del lanzamiento.
- **Nunca hablar mal de un competidor.** Se responde con hechos verificados (spec §10) y preguntas.
- Horario de envío: lunes a sábado, 9:00–12:00 y 14:00–18:00. Nunca de noche (es justo lo que les molesta
  de su propio negocio).

Variables: `{nombre}` (de la persona, si se conoce; si no, se saluda al negocio), `{club}`, `{ciudad}`,
`{barrio}`, `{n_canchas}`, `{link_video}` (R09 recortado), `{link}` = `[LINK LISTA DE ESPERA]` antes del
20-nov / `sportmaps.co/canchas` desde el 20-nov.

---

## 1. Secuencia de primer contacto (3 mensajes + seguimientos)

### Mensaje 1 — Día 0 · Abrir conversación (sin link, sin video)

Corto y con una pregunta. Los mensajes con link en frío se ven como spam.

> Hola {nombre}, ¿cómo estás? Soy [NOMBRE] de SportMaps. Vi {club} en {barrio} y te quería hacer una
> pregunta rápida: ¿las reservas de las canchas las manejan por WhatsApp o tienen algún sistema?

**Si responde** → pasar a Mensaje 2 en la misma conversación, adaptado a lo que dijo.
**Si no responde** → Mensaje 2 el día 2.

### Mensaje 2 — Día 2 · El video

> {nombre}, te dejo esto que estamos construyendo para canchas como la tuya. Son 20 segundos: un cliente
> pregunta por WhatsApp, el bot le muestra las horas libres, paga el abono y la reserva aparece sola en la
> agenda. {link_video}
>
> Sin comisión para tus jugadores y con la API oficial de WhatsApp (tu número no corre riesgo de bloqueo).
> ¿Te sirve algo así en {club}?

Antes del 6-nov (sin video del bot): reemplazar el video por R01 o R07 y decir «estamos construyendo esto;
lanzamos el 20 de noviembre».

### Mensaje 3 — Día 5 · La oferta concreta

Antes del 20-nov:
> {nombre}, último mensaje para no llenarte el chat. Lanzamos el 20 de noviembre y los primeros 50 clubes
> tienen 3 meses del plan Pro gratis (el del bot). Si quieres, te aparto el cupo y ese día te ayudo a crear
> la sede en 5 minutos. ¿Te lo aparto?

Desde el 20-nov:
> {nombre}, último mensaje para no llenarte el chat. Crear la sede es gratis (hasta 2 canchas, sin tiempo
> límite) y los primeros 50 clubes tienen 3 meses del plan Pro gratis. Si me das 10 minutos, te la dejo
> creada por videollamada o paso por {club} esta semana. ¿Qué día te queda bien?

### Seguimientos

| Cuándo | Situación | Mensaje |
|---|---|---|
| Día 12 | Nunca respondió | «{nombre}, te escribo una última vez por si se te pasó. Si no es el momento, cero problema; me dices y no te escribo más.» → si no responde, estado **Frío**, no se vuelve a escribir en 60 días. |
| Día 1 tras «ahora no puedo» | Dijo que después | «Listo, {nombre}. ¿Te escribo el [día que dijo]?» → agendar. |
| Día 3 tras crear la sede | Creó la sede pero no tiene reservas | «{nombre}, vi que ya creaste la sede 🙌. El paso que más sirve: pon el link en la bio de Instagram y en tu estado de WhatsApp. ¿Te ayudo a configurar los precios por franja?» |
| Día 7 tras crear la sede | Sigue sin reservas | Llamada de 5 minutos o visita (ver §3). |
| Tras la 1.ª reserva real | Activado | «¡Primera reserva por el link! ¿Cómo te fue? Si algo no te gustó, dímelo sin filtro.» |

---

## 2. Manejo de objeciones

Patrón: **reconocer → preguntar → un dato verificable → siguiente paso pequeño**. Nunca discutir.

### «Yo manejo todo con el cuaderno y me funciona»

> Tiene sentido, si te funciona no hay por qué cambiar a la loca. Te pregunto: ¿cuántas veces al mes te pasa
> que alguien reserva y no llega, o que dos equipos quedan para la misma hora? (Escuchar.)
> Lo que hacemos es que el cuaderno se llene solo: el cliente reserva y paga el abono por WhatsApp, y tú
> ves la agenda en el celular. Crear la sede es gratis hasta 2 canchas, así que puedes probarlo una semana
> sin dejar el cuaderno. Si no te sirve, lo dejas.

Si da números de no-shows → mandarle la `/calculadora` con sus números.

### «Ya uso Controla Cancha»

Hechos verificados al 14-oct-2026 (spec §10). Revisar si cambiaron antes de usarlos.

> Bien, entonces ya sabes lo que es dejar de anotar a mano. ¿Qué es lo que más te gusta y qué le
> cambiarías? (Escuchar: reconocer lo que hacen bien, como la poca fricción y los estados del comprobante.)
> Tres preguntas que te sirven para comparar, sea con nosotros o con quien sea:
> 1. ¿El bot usa la API oficial de WhatsApp o una sesión tipo WhatsApp Web? Según su propia información
>    pública, ellos usan una sesión no oficial; nosotros, la API oficial de Meta.
> 2. ¿Puedes cobrar en línea con tarjeta o PSE, con la plata directo a tu cuenta? Hoy ellos manejan
>    transferencia y efectivo; nosotros sumamos Wompi o Mercado Pago.
> 3. ¿Tu plan tiene tope de reservas con IA al mes? En nuestro Pro no hay tope.
> Si quieres, crea la sede gratis con nosotros y compáralas en paralelo un par de semanas.

No mencionar sus precios salvo que el prospecto los traiga; si los trae, solo los publicados ($149k /
$249k / $399k según número de canchas).

### «Ya uso Easycancha» (o Playtomic)

> Perfecto. Si te traen jugadores nuevos, eso vale y no te diría que lo quites. ¿Cuántas de tus reservas
> vienen de la app y cuántas te siguen llegando por WhatsApp de tus clientes de siempre? (Escuchar.)
> Lo que hacemos es distinto: no somos un marketplace, somos el sistema de tu club. Tus clientes de siempre
> reservan con tu link y tu WhatsApp, sin tarifa de servicio para el jugador. Muchos clubes usan las dos
> cosas: el marketplace para gente nueva y su propio canal para los fijos.
> `<!-- VERIFICAR: si se integra o no la disponibilidad con marketplaces. Hoy NO: la doble reserva solo
> está garantizada dentro de SportMaps. Si el club usa ambos, decirle que bloquee en uno lo que vende en
> el otro. -->`

Pádel: no forzar. El plan dice entrar al pádel en la semana 6 con diferenciales probados.

### «No quiero pagar» / «Está caro»

> Entiendo. Por eso hay un plan gratis: hasta 2 canchas, página de reservas, agenda y cobro por
> transferencia o efectivo, sin tiempo límite. Y si te sirve el bot, los primeros 50 clubes tienen 3 meses
> de Pro gratis.
> Para ponerlo en números: el Pro son $99.000 al mes. ¿Cuánto cobras por una hora un viernes en la noche?
> (Escuchar.) Si el bot te salva [N] horas que hoy se pierden por no-shows, ya se pagó.

Nunca prometer un retorno; que el prospecto haga la cuenta con sus números.

### «Mis clientes no pagan en línea»

> Muchos no, y está bien. Por eso no te obligamos: pueden pagar por transferencia y mandar el comprobante
> por el mismo chat (la IA lo lee y te avisa si está repetido o no llegó a tu cuenta), o pagar en efectivo
> en la cancha. Lo que sí te recomiendo es pedir un abono para reservar; ese abono puede ser por Nequi o
> transferencia como siempre.

### «No tengo tiempo para configurar eso»

> Son 5 minutos y lo hacemos juntos: canchas, horarios, precios y cómo cobras. Paso por {club} cuando
> estés, o lo hacemos por videollamada. ¿Mañana a qué hora te queda bien?

### «¿Y si se cae el sistema?» / «¿Y mis datos?»

> Tu agenda siempre la ves en el celular y puedes registrar reservas a mano desde recepción. Los datos son
> de tu club: tus clientes no se vuelven clientes de SportMaps. `<!-- VERIFICAR: dónde se alojan los datos
> y qué dice la política de privacidad antes de afirmar algo más específico. -->`

### «Mándame información y yo la miro»

> Claro. Te mando el video de 20 segundos y el link. ¿Te escribo el jueves para ver qué te pareció?
(Agendar siempre una fecha.)

---

## 3. Guion de visita en campo: «crea tu sede en 5 minutos»

**Meta del plan:** 10 canchas por semana en una ciudad. **Meta de cada visita:** salir con la sede creada
en el celular del dueño (o con fecha agendada).

**Llevar:** celular con datos, cargador, el video R09 descargado (sin depender de la señal), hoja de
prospectos abierta, tarjeta con QR a `sportmaps.co/canchas`.

**Mejor horario:** media tarde entre semana (14:00–17:00), cuando la cancha está vacía y el dueño o el
administrador está.

### Paso a paso (15 minutos en total)

1. **Saludo (1 min).** «Hola, soy [NOMBRE] de SportMaps. Trabajamos con escuelas y canchas aquí en
   {ciudad}. ¿Hablo con el dueño o con quien maneja las reservas?» — Si no está, pedir nombre y mejor hora;
   anotar en la hoja.
2. **Pregunta de dolor (2 min).** «¿Cómo les llegan las reservas? ¿Quién contesta de noche? ¿Qué pasa
   cuando alguien no llega?» — **Escuchar y anotar** las palabras exactas del dueño (sirven para el
   contenido, con permiso).
3. **Video (1 min).** Mostrar R09 en el celular propio: «Mira, así reserva un cliente.»
4. **Propuesta (1 min).** «¿Lo armamos ya? Es gratis hasta 2 canchas y lo dejamos funcionando en 5
   minutos, en tu celular.»
5. **Crear la sede con él, en su celular (5 min).** Él toca, tú guías:
   1. Descarga o abre `sportmaps.co/canchas` → «Crea tu sede gratis» → registro con su número.
   2. **Canchas:** nombre, tipo (fútbol 5 / 7 / 8), si se pueden combinar.
   3. **Horarios:** de qué hora a qué hora, días.
   4. **Precios:** por franja (valle / pico / fin de semana y festivo). Preguntar los reales; no sugerir
      precios.
   5. **Cómo cobra:** cuentas para transferencia (y Wompi/MP si tiene o quiere) y el % de abono.
   6. **Política de cancelación:** proponer la plantilla de B03 con sus números.
6. **Primera reserva de prueba (2 min).** Desde tu celular reservas una hora en su link. Él ve aparecer la
   reserva en su agenda. **Este es el momento que vende.** Luego se cancela la de prueba.
7. **Cierre (2 min).** Pegar el link en la bio de su Instagram y en su estado de WhatsApp; ofrecer el botón
   «Reservar» en su perfil de Google (Google Business). Agendar llamada de seguimiento en 3 días.
8. **Anotar en la hoja:** estado `Sede creada`, fecha, n.º de canchas, precios, objeciones, próxima acción.

Antes del 20-nov: el mismo guion se usa solo con los candidatos a piloto o beta (versión en pruebas), y se
dice explícitamente.

---

## 4. Oferta del club piloto (D12)

**Perfil buscado:** cancha sintética **nueva para SportMaps** (no una escuela actual), con 2–5 canchas, que
reciba la mayoría de reservas por WhatsApp, en Bogotá, Medellín o Cali, y dispuesta a conectar Wompi
propio. Prioridad 1 del frente F esta semana.

**Mensaje para proponerlo:**

> {nombre}, te quiero proponer algo concreto. Estamos buscando **un** club para ser el piloto de SportMaps
> Canchas, antes del lanzamiento del 20 de noviembre.
>
> Lo que te damos:
> • **6 meses del plan Pro gratis** (bot de WhatsApp sin tope, cobro en línea, comprobantes con IA).
> • Te lo configuramos nosotros y tienes línea directa con el equipo que lo construye.
> • Lo que pidas y tenga sentido, entra primero.
>
> Lo que te pedimos:
> • Usarlo de verdad desde el 6 de noviembre.
> • Decirnos sin filtro qué sirve y qué no.
> • Al final, un video corto contando tu experiencia (lo que tú quieras decir, nada armado) y permiso para
>   escribir un caso de estudio con tus números, sin datos de tus clientes.
>
> ¿Te interesa que lo hablemos 15 minutos esta semana?

**Condiciones a dejar por escrito (acuerdo simple de una página):** `<!-- DECIDIR/VERIFICAR con asesoría
legal -->`
- Duración: 6 meses de Canchas Pro sin costo desde la activación; al terminar, pasa al precio vigente o al
  plan Gratis, a elección del club, sin cobro automático.
- El testimonio es **voluntario** y se publica solo lo que el club apruebe. Si no quiere grabar, el club no
  pierde los 6 meses (lo contrario se vuelve un testimonio comprado).
  `<!-- DECIDIR: si el testimonio es condición o solo se pide. Recomendación: pedirlo, no condicionarlo. -->`
- Datos: se usan agregados y anonimizados (reservas, % pagadas en línea, no-shows), nunca datos personales
  de jugadores.
- Autorización de imagen para videos en la cancha (formato aparte, firmado por cada persona que salga).
- Cualquiera de las partes puede terminar el piloto con aviso por WhatsApp.
