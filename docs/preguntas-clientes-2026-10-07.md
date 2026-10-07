# Preguntas y decisiones abiertas por cliente — 2026-10-07

Corte: base viva (solo SELECT) del 2026-10-07, memorias del proyecto, `docs/specs/` (ventas por WhatsApp,
ajustes por escuela, notas de voz, factura electrónica, cobranza, clases de prueba) y `docs/analisis/` del
06 y 07-oct. Este archivo **no** lleva nombres de menores ni teléfonos: cuando una pregunta toca casos
puntuales se dice «te mando la lista por privado» y la lista sale de la base en el momento de enviarla.

Cada pregunta trae:
- **Por qué preguntamos:** el dato o el problema que la origina.
- **Recomendado:** la opción que sugerimos, cuando aplica.

---

## 1. DYNASTY VOLLEY CLUB

`school_id 2d509571-3238-4c04-ac3f-6dfe20539226` · dueña: Milena · plan Elite (exenta de bloqueo) ·
504 inscripciones activas · bot de WhatsApp conectado desde el 02-oct, en modo automático.

> **Ya enviadas (no repetir):** las 20 preguntas de comprobantes de WhatsApp del 06-oct
> (`docs/analisis/comprobantes-sin-resolver-dynasty-2026-10-06.md`: los 5 que faltan, los 16 por decidir,
> varios meses en un solo pago, montos distintos, números sin familia). Tampoco se repiten las de las
> planillas de septiembre (`docs/dynasty-planillas-septiembre-2026/preguntas-para-milena.md`), salvo los
> 5 casos que siguen abiertos (pregunta 2.6).

### 1.1 Preguntas para Milena (listas para WhatsApp)

**Grupos y edades**

1. ¿Qué edades (o años de nacimiento) y qué género tiene cada grupo? Te pasamos la lista para que la completes: Minivolley Benjamines, Menores Femenino, Menores Masculino, Infantil Femenino, Infantil Masculino, Intermedio, Nueva Era, Juvenil Mayores Masculino, Juvenil Mayores Femenino y Seniors.
   - *Por qué preguntamos:* ningún grupo tiene rango de edad cargado. Por eso el bot le ofreció la clase de cortesía de «Menores Masculino» a una niña de 12 y a un adulto, y ayer hubo 0 reservas con 16 interesados.
   - *Recomendado:* edad mínima y máxima más «femenino / masculino / mixto» por grupo.

2. Intermedio tiene dos subgrupos (Origen y Evolución) y Menores Femenino dos (White y Selección). ¿Cómo se decide a cuál entra un niño nuevo? ¿Selección recibe gente nueva o solo por convocatoria?
   - *Por qué preguntamos:* el bot ofrece cortesía en todos los horarios, también en los de Selección.
   - *Recomendado:* los grupos de selección no reciben cortesía; el nuevo entra al subgrupo base y el profe lo sube.

3. Juvenil Mayores Femenino figura como «no la estamos ofertando este año» y sin horario, pero tiene 9 deportistas activas. ¿Esas 9 entrenan con otro grupo? ¿A cuál las pasamos?
   - *Por qué preguntamos:* sin horario no les sale asistencia ni clase en el calendario.

4. Nueva Era no tiene sede asignada. ¿Entrena en el Coliseo, en Nido del Colibrí o en las dos?
   - *Por qué preguntamos:* el horario dice las dos; la ficha del grupo no tiene ninguna.

5. Hay 16 deportistas activos sin grupo asignado. ¿Te mandamos la lista para que nos digas a qué grupo va cada uno?
   - *Por qué preguntamos:* sin grupo no aparecen en la asistencia ni reciben avisos del grupo.

**Clase de cortesía**

6. ¿Cuántos invitados de cortesía aceptas como máximo por clase?
   - *Por qué preguntamos:* hoy hay 116 franjas abiertas con cupo prácticamente ilimitado (999).
   - *Recomendado:* 2 o 3 por clase.

7. ¿En qué grupos y horarios **no** quieres cortesías? (por ejemplo, sábados en cancha externa, Seniors o Selección).
   - *Por qué preguntamos:* la cortesía se está ofreciendo en todos los entrenamientos.

8. ¿Qué debe llevar el invitado a la clase de cortesía (ropa, tenis, agua, rodilleras, documento)? ¿Tiene que llegar unos minutos antes o preguntar por alguien?
   - *Por qué preguntamos:* el bot no sabe qué responder y los papás lo preguntan.

9. ¿Con cuánta anticipación mínima se puede reservar? ¿Se puede reservar para el mismo día?
   - *Por qué preguntamos:* el bot ofreció franjas que ya habían empezado.
   - *Recomendado:* mínimo 2 horas antes.

10. Cuando alguien pregunta «¿cuánto cuesta?», ¿quieres que el bot le diga los valores de los planes (Start $90.000, Pro $150.000, Elite $180.000, Dynasty $210.000…)?
    - *Por qué preguntamos:* 5 interesados preguntaron precio ayer y no recibieron respuesta. Ya está construido; solo falta tu visto bueno.
    - *Recomendado:* sí, sin enlace de pago, junto con la invitación a la cortesía.

11. ¿Quién llama o le escribe a los interesados que dejaron sus datos? Hay 8 nuevos sin contactar.
    - *Por qué preguntamos:* hoy los avisos llegan solo a ti (eres la única administradora en la app).
    - *Recomendado:* crear un usuario administrador para quien te ayude con esto.

**Cobros y pagos**

12. El Nequi que usas para inscripciones, clases de perfeccionamiento, uniformes y rifas está a tu nombre personal. ¿Lo seguimos mostrando como cuenta de la escuela, o prefieres que las familias le paguen todo a las cuentas de Dynasty?
    - *Por qué preguntamos:* los pagos a ese Nequi se confunden con mensualidades (ayer 3 rechazos repetidos a una misma familia por un pago de uniformes) y quedan por fuera de la contabilidad de la escuela.
    - *Recomendado:* dejar de usarlo para cobros de la escuela. Si lo quieres mantener, lo registramos como cuenta oficial con su uso (solo clases extra, solo uniformes…).

13. Tus tres llaves Bre-B aparecen solo como «Bre-B». ¿De qué banco es cada una y a nombre de quién están?
    - *Por qué preguntamos:* el bot las muestra sin titular y algunas familias desconfían; tampoco hay titular cargado para la cuenta Bancolombia.

14. ¿Cuánto cuesta cada cobro que no es mensualidad? Clase de perfeccionamiento, refuerzo, clase suelta, torneo, viaje, vacacionales. ¿A qué cuenta se paga cada uno?
    - *Por qué preguntamos:* el 12 % de las conversaciones son de estos pagos y el bot no sabe qué responder.

15. ¿Recibes pagos en efectivo? ¿Dónde y en qué horario?
    - *Por qué preguntamos:* una familia lo preguntó y el bot no tenía la respuesta.

16. Quedan 146 cobros de **agosto** sin pagar ($21.710.000). ¿Son deudas reales que hay que seguir cobrando, o se perdonan como hicimos con los retirados?
    - *Por qué preguntamos:* el estado de cuenta y el bot se las recuerdan a las familias; si no se van a cobrar, generan reclamos.
    - *Recomendado:* revisarlas por grupo; anular las de quien no entrenó en agosto.

17. Si una familia no paga, ¿quieres que la app cancele la inscripción sola (a los 12 días del vencimiento) o prefieres darla de baja tú?
    - *Por qué preguntamos:* hoy está activada la cancelación automática.
    - *Recomendado:* que la decidas tú. Varias familias pagan tarde por transferencia y no conviene sacarlas del grupo sin avisar.

18. El pago en línea tiene un recargo del 5 % para la familia. ¿Lo mantienes, lo bajas o lo asume la escuela?
    - *Por qué preguntamos:* es decisión de la escuela; el recargo influye en cuántos pagan en línea.

19. ¿Nos das acceso a tu cuenta de Wompi (o nos ayudas a conectarla desde la app)?
    - *Por qué preguntamos:* hoy los pagos en línea no entran a una cuenta conectada de la escuela. Sin eso no podemos mandar enlaces de pago por WhatsApp para uniformes o clases extra.

20. Te mandamos por privado 5 casos de septiembre que siguen abiertos (un agosto de $180.000 o $150.000, un cambio de plan con posible retiro, y tres pagos sin confirmar), más un pago de agosto registrado dos veces en la misma familia. En ese último, ¿se deja como saldo a favor o se devuelve?
    - *Por qué preguntamos:* sin tu respuesta, esos cobros siguen vencidos o duplicados.
    - *Recomendado:* saldo a favor para el mes siguiente.

21. Hay dos registros con el mismo apellido y la misma acudiente en grupos distintos. ¿Son gemelas o es la misma niña registrada dos veces? (te mandamos los nombres por privado).
    - *Por qué preguntamos:* si es la misma, se le está cobrando doble.

**Ventas y uniformes**

22. ¿Qué productos quieres vender por WhatsApp? Para cada uno necesitamos foto, tallas y precio (uniforme de juego, sudadera, pantaloneta, medias, rodilleras…).
    - *Por qué preguntamos:* hoy no hay ningún producto cargado y las familias piden uniformes por chat.

23. El estampado (nombre y número), ¿tiene un precio igual para todo o cambia según el producto?
    - *Recomendado:* por producto (no cuesta lo mismo estampar una camiseta que una sudadera).

24. ¿Los uniformes son por encargo o tienes inventario? Si son por encargo, ¿cuántos días tarda la confección y hay un mínimo de pedidos para mandar a hacer?
    - *Recomendado:* por encargo, con fecha de entrega aproximada al pedir; inventario solo para implementos (medias, rodilleras).

25. Si alguien pide un nombre ofensivo o raro en el estampado, ¿lo revisas tú antes de mandarlo a confección?
    - *Recomendado:* sí. Todo pedido con nombre queda en «por revisar» hasta que la escuela lo apruebe.

26. ¿Quién atiende los pedidos: tú, alguien de la administración o un profe?
    - *Recomendado:* tú o un administrador. Los profes no ven pedidos ni plata.

27. ¿Dónde y cuándo se entregan los pedidos?

**Bot de WhatsApp**

28. ¿En qué horario hay una persona atendiendo el WhatsApp de la escuela? Hoy está configurado de 8:00 a. m. a 10:00 p. m. todos los días.
    - *Por qué preguntamos:* cuando el bot pasa un caso a una persona, la familia espera respuesta en ese horario. Ayer 3 casos quedaron sin respuesta en el día, uno urgente («no han llegado a dar la clase»).
    - *Recomendado:* el horario real de atención, y que los casos urgentes de sede te lleguen al celular de inmediato.

29. ¿Qué números son personales (familia, amigos, proveedores, staff) para que el bot nunca les conteste? Te mandamos la lista de los que ya marcamos para que la revises.
    - *Por qué preguntamos:* el 6-oct el bot les escribió a contactos personales. Hay 43 conversaciones sin clasificar.

30. Cuando hay cambios de última hora (clase cancelada, cambio de cancha), ¿cómo los avisas hoy? ¿Quieres que el bot pueda responder «¿hay clase hoy?» con lo que registres en la app?
    - *Por qué preguntamos:* 4 familias lo preguntaron ayer y el bot no tenía cómo saberlo.

31. Las canchas externas Nido del Colibrí y Asoalsacia no tienen dirección en la app. ¿Nos pasas la dirección (o el enlace de Google Maps) de cada una?
    - *Por qué preguntamos:* una familia preguntó la dirección y el bot no la tenía.

32. ¿Quieres que una familia pueda pedir el **paz y salvo** por WhatsApp?
    - *Por qué preguntamos:* lo pidieron ayer (también para servicio social).

**Facturación electrónica**

33. Cuando una familia **no** quiere factura a su nombre, ¿se emite a «consumidor final» o no se emite?
    - *Por qué preguntamos:* hoy se omiten los pagos sin datos del pagador. Es decisión tuya y de tu contador.
    - *Recomendado:* consultarlo con tu contador; por defecto, consumidor final.

34. ¿Quieres que la factura le llegue al correo de la familia, o basta con que la vea en la app?
    - *Por qué preguntamos:* hoy no se envía por correo.

---

### 1.2 Decisiones internas nuestras (Dynasty)

| # | Decisión | Dato | Recomendado |
|---|---|---|---|
| DI-1 | Filtro de franjas de cortesía por edad y género | Depende de la pregunta 1; `teams.age_min/age_max` existen pero están vacíos | Cargar los rangos que dé Milena y filtrar en `whatsapp-clase-cortesia.service.ts` |
| DI-2 | Cupo por franja de cortesía | 116 franjas con `max_capacity = 999`, `school_trial_class_settings` sin fila | Fijar el cupo que diga Milena en el generador (pregunta 6) |
| DI-3 | `responder_desconocidos` | Volvió a `true` (el 06-oct se había puesto `false` a las 10:51 por los mensajes a contactos personales) | Dejarlo en `false` hasta tener el filtro de contactos personales |
| DI-4 | Contenido de contactos `personal` | Se guarda completo en `whatsapp_messages` (texto y adjuntos) | Guardar solo metadatos y purgar lo ya guardado (P0-3 de la auditoría) |
| DI-5 | Transcribir audios sin consentimiento | `wa_transcribir_sin_consentimiento = true` solo en Dynasty | Revisar con legal; el spec recomienda transcribir solo con consentimiento (D4) |
| DI-6 | Jobs de WhatsApp en dev/stg | Mandaron enlaces a `dev.sportmaps.co` | Solo en prod con variable positiva (P0-1 y P0-2) |
| DI-7 | Pagos al Nequi personal | 15 filas «no es mensualidad» en 4 días | Regla «el pie nombra otro concepto → no aplicar a la mensualidad»; D-V7 según la respuesta 12 |
| DI-8 | Tienda: addon `store` o catálogo liviano (D-V1) | Dynasty tiene `vendor_profile` activo, 0 productos, sin addon `store` | Tienda |
| DI-9 | Pasarela propia (D-V2) | 0 filas en `school_payment_providers`; checkout cae al comercio sandbox desde 27-ago | Conectar la cuenta Wompi de Dynasty antes del piloto de ventas |
| DI-10 | Reserva del pedido (D-V6) | 45 min hoy | 1 hora para pedidos del chat |
| DI-11 | `payment_category` nuevas (D-V4) | Clases extra, vacacionales y viajes caen en `otro` o vacío (161 cobros abiertos sin categoría) | Agregar `clase_extra`, `vacacional`, `viaje` |
| DI-12 | Opt-in de marketing separado (D-V10) | 8 opt-in activos, 1 baja | Obligatorio antes de promociones |
| DI-13 | Rifas (D-V11) | Milena cobra rifas al Nequi | Fuera hasta concepto legal (Coljuegos) |
| DI-14 | Plantillas | 10 aprobadas en la WABA de Dynasty; `pago_recordatorio_previo` y `pago_vence_hoy` fueron recategorizadas a MARKETING en la WABA de prueba | Apelar o reescribir antes de prender recordatorios previos |
| DI-15 | Horario del bot | `business_hours` con valores raros (22:22, 22:59) | Reemplazar por lo que responda Milena (pregunta 28) |
| DI-16 | Desplegar develop | Duplicados de «confirmó tu pago», adjunto-consulta y precios no corrieron el 06-oct | Desplegar y prender `wa_responder_precios` si Milena acepta (pregunta 10) |
| DI-17 | 360 de 754 cobros abiertos sin pagador | Fichas sin cuenta | Seguir con el enlace público `/p/<token>` y el bot; no exigir cuenta |
| DI-18 | Notas de voz (D1-D7 del spec) | 25 audios el 06-oct, 8 de familias | Groq `whisper-large-v3` con respaldo; eco «Entendí:»; >120 s al buzón |
| DI-19 | Factura electrónica: migración del pagador | `docs/migraciones-para-aplicar-2026-10-05/3_factura_electronica_pagador.sql` sin aplicar; 298 facturas aceptadas | Aplicar tras las respuestas 33 y 34 |

---

## 2. CLUB DEPORTIVO BESSER

`school_id 759eee9d-05cb-4958-b84a-2560f77e3683` · plan Profesional (periodo hasta 2026-10-15) ·
89 inscripciones activas · addons `whatsapp` y `pwa_branding` · WhatsApp **sin conectar**.

### 2.1 Preguntas para Besser (listas para WhatsApp)

**Grupos y edades**

1. ¿Qué edades (o años de nacimiento) y qué género tiene cada grupo? 2011 Arrayanes, 2012 Liga, 2014 Liga, Iniciación Femenino, Iniciación Masculino, Infantil Femenino, Pre Juvenil Femenino y Juvenil Femenino.
   - *Por qué preguntamos:* ningún grupo tiene rango de edad, y 2014 Liga no tiene categoría. El bot lo necesita para decirle a un papá nuevo a qué grupo llevar a su hijo.
   - *Recomendado:* edad mínima y máxima más «femenino / masculino / mixto» por grupo.

2. El plan «2 días / semana (fines de semana)» dice fines de semana, pero todos los horarios que tenemos son de martes a viernes de 4:00 a 6:00 p. m. ¿Hay entrenamientos sábado o domingo? ¿Cuáles y dónde?
   - *Por qué preguntamos:* el plan no coincide con ningún horario cargado.

3. El plan «6 días / semana» dice 6 días, pero ningún grupo entrena más de 4. ¿Qué otros días entrenan los de alto rendimiento?

4. ¿Todos los grupos entrenan en el Círculo de Suboficiales (Calle 138 # 55-38)? ¿En qué ciudad o barrio queda?
   - *Por qué preguntamos:* falta la ciudad en la sede y el bot da la dirección incompleta.

5. Juvenil Femenino tiene solo 2 deportistas activas. ¿Sigue abierto para nuevas o se une con Pre Juvenil?

6. Hay 3 deportistas sin grupo y 11 sin plan ni mensualidad. ¿Te mandamos la lista para que nos digas grupo y plan de cada uno?
   - *Por qué preguntamos:* sin plan no se les genera cobro; sin grupo no salen en la asistencia.

**Cobros y pagos**

7. Quedan 55 mensualidades de **septiembre** vencidas ($17.614.000). ¿Las familias ya les pagaron por fuera de la app (efectivo o transferencia)? Si es así, ¿nos mandas la relación para registrarlas?
   - *Por qué preguntamos:* los correos automáticos de vencido están encendidos y les van a llegar a familias que quizá ya pagaron.
   - *Recomendado:* revisar la lista antes del próximo aviso de vencido.

8. Hay 16 deportistas con una mensualidad distinta a la de su plan (por ejemplo $342.000 en el plan de $380.000, o $140.000 en el de $340.000), y 20 en $0 (becas y segundo equipo). ¿Te mandamos la lista para que confirmes que cada valor está bien?
   - *Por qué preguntamos:* hay un caso con una mensualidad mayor que la de su plan, que parece un plan mal asignado.

9. Tienen activado el **descuento militar**. ¿De cuánto es y a quién aplica (hijos de suboficiales, socios del Círculo…)?
   - *Por qué preguntamos:* está prendido pero no sabemos la regla; los $342.000 parecen un 10 %.

10. La cuenta para pagos es una llave Bre-B de Nequi Negocios a nombre de una persona natural. ¿Es la cuenta oficial del club? La cuenta Davivienda que tenían antes, ¿sigue vigente? ¿De qué tipo es y a nombre de quién?
    - *Por qué preguntamos:* el bot muestra los medios de pago; si hay una cuenta vieja, puede confundir a las familias.
    - *Recomendado:* mostrar solo la cuenta que de verdad reciben y quitar la otra.

11. Hoy la app aprueba sola los comprobantes de hasta $570.000. ¿Quieres seguir así o prefieres revisar cada comprobante antes de darlo por pagado?
    - *Por qué preguntamos:* con aprobación automática, un comprobante equivocado queda como pagado sin que nadie lo vea.
    - *Recomendado:* revisar tú los primeros meses y luego decidir.

12. Si una familia no paga, ¿quieres que la app cancele la inscripción sola (a los 12 días del vencimiento) o prefieres darla de baja tú?
    - *Por qué preguntamos:* hoy está activada la cancelación automática.
    - *Recomendado:* que la decidas tú.

13. ¿Reciben pagos en efectivo? ¿Dónde y en qué horario?

14. ¿Tienen descuento por hermanos?
    - *Por qué preguntamos:* está apagado; si lo dan a mano, conviene configurarlo.

**Clase de cortesía (semana de cortesía)**

15. Confirmamos lo que nos pidieron: el deportista nuevo entra una **semana gratis** con el enlace de cortesía, sin pagar. ¿Son 7 días? ¿En cualquier grupo o solo en algunos?

16. Al terminar la semana, ¿quién le asigna el plan o lo da de baja? ¿Quieres que la app te avise ese día?
    - *Por qué preguntamos:* la inscripción de cortesía queda activa sin mensualidad hasta que alguien la cambie.
    - *Recomendado:* aviso automático al día 7 para la administración.

17. ¿Qué debe llevar el deportista a su primera clase y a quién debe buscar al llegar?

18. ¿Quieres que el bot diga los precios a quien pregunta «¿cuánto cuesta?»? Hoy diría: 2 días $210.000, 4 días $340.000, 6 días $380.000, más la semana de cortesía, sin enlace de pago.
    - *Por qué preguntamos:* ya está configurado así; confírmanos que esos son los valores que quieren publicar.

**Bot de WhatsApp**

19. ¿Cuándo conectamos el número de WhatsApp del club? Hay que hacerlo con el Facebook del dueño y toma unos 15 minutos.
    - *Por qué preguntamos:* todo lo de arriba está listo, pero el bot no funciona hasta conectar.

20. Nos dijeron que la atención humana es de lunes a viernes de 9:00 a. m. a 3:00 p. m. con «Admin». ¿Quién es esa persona? En la app no hay ningún administrador además del dueño, así que hoy todos los avisos le llegarían solo al dueño.
    - *Recomendado:* crear el usuario administrador para esa persona.

21. ¿Fines de semana y festivos no hay atención? ¿Qué debe decir el bot fuera de horario?

22. El primer mes el bot funciona en **modo asistido**: escribe la respuesta y una persona la aprueba antes de enviarla. ¿Quién va a aprobar las respuestas?
    - *Por qué preguntamos:* en Dynasty, en modo asistido, 38 respuestas quedaron sin aprobar y las familias no recibieron nada.
    - *Recomendado:* asistido solo la primera semana y con alguien revisando en el horario de atención.

23. ¿Qué números del club son personales (familia, amigos, proveedores) para que el bot nunca les conteste?

**Ventas y uniformes**

24. ¿Venden uniformes, sudaderas o implementos? ¿Les interesa venderlos por la app o por WhatsApp?
    - *Por qué preguntamos:* tienen activados ventas y cobros de torneo, pero no hay tienda creada.

25. ¿Cobran torneos, viajes o clases extra aparte de la mensualidad? ¿Cuánto y a qué cuenta?

**Facturación electrónica**

26. ¿El club necesita facturación electrónica para las mensualidades? ¿Tiene resolución DIAN o software de facturación hoy?
    - *Por qué preguntamos:* no tienen facturación conectada. Si la necesitan, la podemos activar.

**Datos faltantes**

27. Unas 11 familias no tienen correo ni cuenta en la app y no reciben avisos de cobro. ¿Nos ayudas con el correo o el celular de cada una? (te mandamos la lista por privado).

28. 26 familias recibieron la invitación y no han entrado a la app. ¿Les mandamos un recordatorio por WhatsApp cuando conectemos el número?
    - *Recomendado:* sí, una sola vez y con el enlace directo.

29. Hay un deportista con dos números de documento casi iguales en dos registros. ¿Cuál es el correcto? (te lo mandamos por privado).

---

### 2.2 Decisiones internas nuestras (Besser)

| # | Decisión | Dato | Recomendado |
|---|---|---|---|
| BI-1 | Enlace de inscripción del bot | `enlaceDeInscripcion()` elige el QR abierto con más altas → mandaría el pagado (`besser-inscripciones`), no el de cortesía | Cambio de código: en `semana_app` usar siempre `wa_cortesia_qr_id` |
| BI-2 | Al conectar el número | Spec `whatsapp-ajustes-por-escuela.md`: `ai_enabled`, `assisted`, horario L-V 9-15 y copiar plantillas | Correr el SQL y `wa-copiar-plantillas.ts` el mismo día; antes, merge a main (lo hace el usuario) |
| BI-3 | Plantillas en la WABA de Besser | 0 aprobadas; las de recordatorio previo están recategorizadas a MARKETING | Copiar solo las UTILITY aprobadas |
| BI-4 | Catálogo de categorías | Los 8 equipos con `category_id = NULL`; multi-categoría funciona por el parche `allow_secondary_team_enrollment` | Decidir si se adopta el catálogo (`teams.category_id`) |
| BI-5 | Suscripción SaaS | Periodo vence 2026-10-15, no exenta de bloqueo | Confirmar cobro y renovación antes del 15 |
| BI-6 | Aprobación automática de comprobantes | `auto_approve_enabled = true` hasta $570.000 | Depende de la pregunta 11; con WhatsApp conectado, apagarla el primer mes |
| BI-7 | Factura electrónica | Sin facturador | Si la piden, V2 vía aliado Factus (bloqueado por el RUT de SportMaps) |
| BI-8 | PWA con marca | Addon `pwa_branding` activo, construido en develop el 14-ago y sin desplegar | Desplegar o dejar de cobrarlo |
| BI-9 | Script `02_verificar_becas.mjs` | En la rama `claude/besser-pending-tasks-3nn445`, sin mergear | Traerlo a develop para que quede trazable |
| BI-10 | Cobro del 2º equipo | 11 niñas en Iniciación Femenino como segundo equipo con cuota 0 | Confirmar que `open_month` no les genere un segundo cobro al cambiar de plan |

---

## Fuentes

- Base viva, 2026-10-07: `teams`, `school_branches`, `offering_plans`, `enrollments`, `payments`,
  `school_settings`, `school_whatsapp_integrations`, `whatsapp_settings`, `whatsapp_conversations`,
  `whatsapp_optins`, `whatsapp_template_status`, `school_addons`, `school_subscriptions`,
  `school_payment_providers`, `electronic_invoice_providers`, `electronic_invoices`, `school_trial_slots`,
  `trial_class_bookings`, `school_signup_leads`, `vendor_profiles`, `products`, `school_members`.
- `docs/analisis/auditoria-bot-whatsapp-dynasty-2026-10-06.md`, `calidad-bot-whatsapp-dynasty-2026-10-06-tarde.md`,
  `comprobantes-sin-resolver-dynasty-2026-10-06.md`, `whatsapp-conversaciones-dynasty-2026-10-06.md`.
- `docs/specs/ventas-por-whatsapp.md` (§12, D-V1 a D-V13), `whatsapp-ajustes-por-escuela.md`,
  `whatsapp-notas-de-voz.md` (§6), `factura-electronica-preferencia-y-datos-del-pagador.md` (D4, D8).
- Memorias: Besser, onboarding y planillas de Dynasty, checkout sandbox, WhatsApp (canal y bot), facturación electrónica.
