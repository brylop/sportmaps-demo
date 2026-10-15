# 04 · LinkedIn del fundador — construcción en público

10 posts en primera persona + una plantilla de actualización semanal (U1–U5). Son borradores: **el
fundador los reescribe con su voz** antes de publicar; lo que está entre corchetes lo completa él con datos
reales. Ninguna cifra se publica si no sale de la app o del tablero semanal (plan §7).

Formato LinkedIn: primera línea que se entienda sola (es lo único que se ve antes de «ver más»), párrafos
de 1–2 líneas, sin hashtags en el cuerpo (2–3 al final), una imagen o captura real por post cuando aplique.

| # | Fecha | Tema | Depende de |
|---|---|---|---|
| L01 | jue 15-oct | Arrancamos: 6 semanas en público | — |
| L02 | mar 20-oct | Por qué no le cobramos nada al jugador | — |
| L03 | jue 22-oct | Hoy hicimos imposible la doble reserva | H1 verificado |
| L04 | mar 27-oct | Por qué WhatsApp oficial | — |
| L05 | mar 3-nov | Lo que copiamos de la competencia (y lo que no) | — |
| L06 | jue 5-nov | Que nadie pague dos veces | Idempotencia implementada |
| L07 | mar 10-nov | La primera reserva real | H3 + permiso del club |
| L08 | vie 20-nov | Lanzamiento | H4 |
| L09 | mar 24-nov | Escuela + canchas en la misma cuenta | — |
| L10 | vie 4-dic | 6 semanas: metas vs realidad | Tablero semanal |

---

## L01 · Arrancamos

> Tenemos 6 semanas para construir algo y lo voy a contar todo, incluido lo que salga mal.
>
> En Colombia, alquilar una cancha sintética todavía funciona así: escribes por WhatsApp, alguien te
> responde cuando puede, anota en un cuaderno, te pide el pantallazo de la transferencia y lo revisa a ojo.
>
> Con SportMaps ya ayudamos a escuelas deportivas a cobrar mensualidades y manejar sus alumnos. Muchas de
> esas escuelas tienen canchas, y las horas que no usan sus equipos se pierden.
>
> Así que vamos por esto: **SportMaps Canchas**. Que una cancha se reserve y se cobre sola por WhatsApp.
> Sin comisiones al jugador, sin dobles reservas, sin cuaderno.
>
> Fechas, para que me las cobren:
> → 6 de noviembre: piloto con un club real cobrando.
> → 20 de noviembre: lanzamiento público.
>
> Cada semana voy a publicar qué construimos, qué se rompió y qué aprendimos.
>
> Y necesito una cosa: un club de fútbol sintético que quiera ser el piloto. Seis meses gratis a cambio de
> que nos diga sin filtro qué sirve y qué no. Si conoces a alguien, etiquétalo.
>
> #construcciónenpúblico #startupscolombia #deporte

---

## L02 · Por qué no le cobramos nada al jugador

> No le vamos a cobrar ni un peso al jugador que reserva una cancha. Te explico por qué, aunque sea plata
> que dejamos en la mesa.
>
> Muchos marketplaces de reservas cobran una tarifa de servicio al jugador. Es un modelo válido: te traen
> clientes y cobran por eso.
>
> Pero nosotros no somos un marketplace. Somos el software del club. Y cuando el club le manda su link a un
> cliente de toda la vida y aparece un cargo extra al final, quien queda mal es el club.
>
> Por eso decidimos tres cosas:
> 1. El jugador paga el precio de la cancha y nada más. El precio que ve al principio es el final.
> 2. El club paga una mensualidad fija. Gratis hasta 2 canchas; $99.000 hasta 5; $199.000 ilimitadas.
> 3. Sin tope de reservas por WhatsApp en el plan Pro. No queremos que un club piense dos veces antes de
>    que su bot conteste.
>
> El riesgo es nuestro: el bot gasta en inteligencia artificial por cada conversación. Lo vamos a medir en
> el piloto y lo voy a publicar aquí.
>
> ¿Tú qué prefieres como dueño: pagar por reserva o una mensualidad fija?
>
> #pricing #saas #construcciónenpúblico

`<!-- VERIFICAR: precios confirmados (D9) antes de publicar. -->`

---

## L03 · Hoy hicimos imposible la doble reserva

**Solo si H1 está verificado en vivo** (la prueba de 50 reservas simultáneas a la misma franja dejó 1).
Adjuntar captura del resultado de la prueba.

> Hoy hicimos imposible la doble reserva. No "poco probable": imposible.
>
> El problema clásico: un cliente reserva por la web, otro por WhatsApp y la recepción anota a un tercero,
> los tres para el sábado a las 8. Si el sistema revisa "¿está libre?" y después guarda, hay un instante
> en el que los tres ven la hora libre.
>
> La mayoría de sistemas lo resuelven con cuidado en el código. Nosotros lo pusimos en la base de datos:
> una restricción que no deja que dos reservas ocupen la misma cancha en horarios que se crucen. Si dos
> llegan al mismo milisegundo, la base acepta una y rechaza la otra. Sin excepciones, venga de donde venga.
>
> Lo probamos así: [50] reservas a la misma cancha, misma hora, al mismo tiempo. Resultado: [1] confirmada,
> [49] rechazadas con mensaje claro.
>
> Para un dueño de cancha esto no suena técnico. Suena a no tener dos equipos peleando en la puerta un
> domingo.
>
> Mañana seguimos con la disponibilidad y los precios por franja.
>
> #ingeniería #postgresql #construcciónenpúblico

---

## L04 · Por qué WhatsApp oficial

> Elegimos la API oficial de WhatsApp aunque nos cueste más tiempo y más plata. Esta es la razón.
>
> Hay dos maneras de poner un bot a contestar en WhatsApp:
> → Una sesión no oficial, que imita a WhatsApp Web. Es rápida de montar y no pasa por Meta.
> → La API oficial de WhatsApp Business, con número verificado y plantillas que Meta aprueba.
>
> La primera tiene un riesgo que muchos dueños no conocen: el número se puede restringir o bloquear. Y
> para una cancha, ese número es el negocio. Está guardado en los celulares de cientos de clientes.
>
> La oficial es más lenta de arrancar: hay que verificar el negocio, aprobar cada plantilla (el
> recordatorio de 2 horas antes, la confirmación, el código de verificación) y pagar algunas conversaciones.
>
> Pero es la única que le podemos recomendar a un club sin cruzar los dedos.
>
> Una cosa más: con la oficial, el jugador verifica su número con un código antes de reservar. Así nadie
> aparta una hora a nombre de otro.
>
> #whatsapp #producto #construcciónenpúblico

---

## L05 · Lo que copiamos de la competencia (y lo que no)

> Esta semana leí todo lo que pude de los productos de reservas de canchas que hay en Colombia y afuera. Y
> copiamos varias cosas sin vergüenza.
>
> De Controla Cancha: apartar la hora unos minutos mientras llega el comprobante, que el jugador vea el
> estado de su comprobante en vivo y el botón "dar más tiempo" para la recepción. Tienen muy poca fricción
> y eso hay que reconocerlo.
>
> De Playtomic: el pago dividido entre jugadores.
>
> De CourtReserve y Skedda: reglas distintas para socios y público, y liberar la cancha si nadie llega.
>
> Y también leímos las quejas. Reseñas públicas de jugadores en tiendas y en Trustpilot. Casi todas son de
> plata y soporte: reembolsos que nadie responde, cobros dobles, cargos de servicio que aparecen al final,
> soporte que es solo un chatbot.
>
> Cada queja se volvió un requisito:
> → La política de cancelación se ve antes de pagar, en una línea.
> → Antes de cancelar, el sistema te dice cuánto te devuelve.
> → Todo caso de plata pasa a una persona por WhatsApp.
> → Ningún pago se puede cobrar dos veces.
>
> Copiar lo bueno es fácil. Lo difícil es no copiar lo que la gente odia.
>
> #producto #construcciónenpúblico

---

## L06 · Que nadie pague dos veces

> El peor bug de un sistema de cobros no es que falle. Es que cobre dos veces.
>
> Pasa así: el jugador toca "Pagar", la señal está mala, no ve respuesta y vuelve a tocar. O el bot no
> recibe a tiempo la confirmación de la pasarela y reintenta. Dos pagos, una cancha, un cliente furioso.
>
> La solución tiene un nombre feo: idempotencia. Cada intento de reserva y de pago lleva una llave única
> desde el celular del jugador hasta la base de datos. Si llega la misma llave diez veces, se crea una sola
> reserva y se cobra un solo pago. Las otras nueve devuelven el mismo resultado.
>
> Lo probamos repitiendo la misma operación [10] veces seguidas: [1] fila en la base.
>
> No es la parte que se ve en un video. Pero es la que hace que un dueño duerma tranquilo.
>
> #pagos #ingeniería #construcciónenpúblico

`<!-- VERIFICAR: que el middleware de idempotencia y la prueba estén hechos antes de publicar. -->`

---

## L07 · La primera reserva real

**Solo con el club piloto en vivo y su permiso para nombrarlo** (si no, «un club de fútbol sintético en
[CIUDAD]»).

> [DÍA], [HORA]. Alguien escribió "¿tienen cancha a las 8?" al WhatsApp de [CLUB] y, por primera vez,
> nadie tuvo que contestar.
>
> El bot mostró las horas libres, el jugador eligió, confirmó, pagó el abono [en línea / con comprobante]
> y la reserva apareció sola en la agenda del club.
>
> [N] minutos de punta a punta. [DATO PILOTO]
>
> Lo que salió mal esta semana: [CONTAR UNO REAL].
> Lo que nos sorprendió: [CONTAR UNO REAL].
>
> Gracias a [NOMBRE, si autorizó] por confiar en algo que todavía estamos terminando.
>
> Faltan dos semanas para abrirlo a todos.
>
> #construcciónenpúblico #startupscolombia

---

## L08 · Lanzamiento

> Hoy lanzamos SportMaps Canchas. Hace 6 semanas dije que lo íbamos a hacer y que lo iba a contar todo.
>
> Lo que entra hoy:
> → Página de reservas de tu club, sin que el jugador cree cuenta (verifica su número por WhatsApp).
> → Bot de WhatsApp sobre la API oficial de Meta que reserva y cobra.
> → Cobro en línea con la plata directo al club, o transferencia con el comprobante leído por IA.
> → Imposible la doble reserva, venga de donde venga.
> → Política de cancelación en el sistema, visible antes de pagar.
>
> Lo que llega el 27 de noviembre: pago dividido entre jugadores, precio de socio, lista de espera y faltas
> por no-show automáticas.
>
> Precio: gratis hasta 2 canchas. $99.000 al mes hasta 5, con el bot sin tope de reservas. $199.000 sin
> límite de canchas. Sin comisión al jugador. Los primeros 50 clubes tienen 3 meses de Pro gratis.
>
> En números, estas 6 semanas fueron: [DATO: sedes en lista de espera], [DATO PILOTO: reservas del piloto].
>
> Si tienes una cancha, o conoces a alguien que la tenga: sportmaps.co/canchas
>
> #lanzamiento #startupscolombia #deporte

`<!-- VERIFICAR: la lista de «lo que entra hoy» se ajusta a lo que esté vivo el 20-nov. -->`

---

## L09 · Escuela + canchas en la misma cuenta

> La mayoría de escuelas deportivas que conozco tienen el mismo problema: tienen cancha, pero solo la usan
> unas horas al día.
>
> El resto del tiempo, la cancha está vacía o se alquila por un chat aparte, con otro cuaderno.
>
> Por eso no hicimos SportMaps Canchas como un producto separado. Es la misma cuenta de la escuela:
> → Las clases bloquean la cancha solas; nadie la alquila encima del entrenamiento.
> → Las horas libres se venden por WhatsApp.
> → Las familias de los alumnos reservan con precio de socio.
> → Mensualidades y reservas llegan al mismo reporte de ingresos.
>
> Otras plataformas separan la academia y las canchas en dos productos, o directamente no tienen escuela.
> Para un club que tiene las dos cosas, eso es pagar dos veces y conciliar dos veces.
>
> Si ya usas SportMaps con tu escuela, activar las canchas es un interruptor. [DATO: escuelas que ya lo
> activaron]
>
> #deporte #escuelasdeportivas

`<!-- VERIFICAR: bloqueo por clases y precio de socio vivos. -->`

---

## L10 · 6 semanas: metas vs realidad

> El 15 de octubre publiqué metas para 6 semanas. Hoy es 4 de diciembre. Aquí están, sin maquillaje.
>
> | Meta | Real |
> |---|---|
> | 60 sedes creadas | [DATO] |
> | 25 sedes con al menos 1 reserva real | [DATO] |
> | 500 reservas por semana | [DATO] |
> | 70 % de reservas pagadas en línea o con comprobante validado | [DATO] |
> | 0 dobles reservas | [DATO] |
> | 10 escuelas actuales con canchas activas | [DATO] |
>
> Lo que salió mejor de lo esperado: [REAL].
> Lo que no cumplimos y por qué: [REAL].
> Lo que haría distinto: [REAL].
>
> Lo que sigue: [PRÓXIMOS PASOS, p. ej. entrada al pádel].
>
> Gracias a [CLUBES, con permiso] por confiar antes que nadie.
>
> #construcciónenpúblico #startupscolombia

(LinkedIn no renderiza tablas: publicar la tabla como imagen o como lista con flechas.)

---

## Plantilla U · Actualización semanal (U1–U5)

Corta, 5–8 líneas. Se publica los jueves que no tienen post largo.

> Semana [N] de 6 construyendo SportMaps Canchas.
>
> ✅ Construimos: [1–2 cosas concretas, con captura].
> ❌ Se rompió: [1 cosa real y cómo la arreglamos].
> 📈 Números: [1 dato real del tablero: lista de espera / sedes / reservas].
> 👉 La próxima semana: [1 cosa].
>
> [Pregunta abierta a los dueños de canchas].

Temas sugeridos: U1 (29-oct) primeras pantallas en pruebas · U2 (12-nov) primeros números del piloto ·
U3 (17-nov) lo que entra y lo que no en el lanzamiento · U4 (26-nov) primera semana abierta · U5 (1-dic)
lo que los dueños nos pidieron.
