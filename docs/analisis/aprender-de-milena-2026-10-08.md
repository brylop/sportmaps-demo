# Aprender de Milena — qué responde a mano y qué datos le faltan al bot (Dynasty, 2026-10-08)

Integración `f50d6940-…` · escuela `2d509571-…` · base prod, solo SELECT · código leído en `develop` (con cambios sin commitear).
Sin nombres ni teléfonos de familias: ejemplos parafraseados.

## 0. Ventana y volumen real

- Pedí 10 días, pero **solo hay datos desde el 2026-10-02 (noche)**: son ~6,5 días (02 al 08 de octubre).
- El **bot estuvo apagado hasta el 06-oct 08:00** (lo activaron ese día). Del 02 al 05 Milena contestó todo porque no había nadie más.

| | Total 7 días | Por día |
|---|---|---|
| Salientes de Milena (`ai_generated=false`) | 868 | ~124 |
| … en chats `personal`/`staff` ya marcados (6+1 contactos) | 444 | ~63 |
| … personales **mal marcados** como `desconocido` (hermana, pareja) + el chat del desarrollador | 117 | ~17 |
| … proveedores, arrendador, otros clubes, entrenadores, eventos | ~97 | ~14 |
| … saludo automático de WhatsApp Business («Gracias por comunicarte con Dynasty…») y 2 recordatorios de cortesía que el sistema registra como no-IA | 16 | ~2 |
| **Mensajes de Milena a familias y prospectos** | **~194** | **~28** |
| Bot (`ai_generated=true`) | 461 (45 eran duplicados del 06-oct, ya corregido) | ~140 desde que se activó |

Conclusión: de los «~100 mensajes al día» de Milena, **solo ~28 son atención a familias/prospectos**. El resto es su vida personal y la operación del club (entrenadores, proveedores, viaje a México), que el bot no debe tocar.

Ojo de clasificación: hay al menos 2 contactos personales (hermana y pareja) con `contact_kind='desconocido'`. El bot les contestó «escríbeme tu correo» a mensajes como «amor, urgente». Hay que marcarlos `personal`.

## 1. Qué responde Milena a mano, por intención

Conteo sobre los ~194 mensajes (y ~95 conversaciones) de familias y prospectos. «Hoy» = estado del código en `develop`.

| # | Intención | Msgs de Milena | Ejemplos (parafraseados) | Respuesta típica de Milena | ¿El bot podría hoy? | Por qué no lo hizo |
|---|---|---|---|---|---|---|
| 1 | **Cobros / estado de cuenta / «ya pagué»** | ~47 (24 %) | «Me llegó cobro de septiembre pero el papá ya pagó»; «me dice que estoy en mora y ya adjunté octubre»; «¿cuánto pago de septiembre? vino 4 días»; «el mes pasado pagué 162 por los días que fue» | «Ya lo registré» / «ya te pongo al día» / «quedó septiembre al día»; prorratea a mano («serían $90 de septiembre»); manda «Bancolombia ahorros …3578, llave …5111» | **Parcial.** `get_payment_status` y la cola de comprobantes ya existen. No sabe prorratear por días asistidos ni aplicar pagos de agosto/septiembre hechos por fuera (eso es decisión de Milena). | Del 02 al 05 el bot estaba apagado. Después: la mayoría eran familias **sin cuenta o no identificadas** (el bot pide correo → la mamá le escribe a Milena). Pagos viejos en papel no estaban cargados (planillas). |
| 1b | *(dentro de 1)* **«No ha ido, no me cobren» / congelar** | ~13 | «Mi hija no ha vuelto y me llegan correos de cobro»; «lleva 10 días enferma, ¿este mes no lo pago?»; «no regresa, retírenla» | «Ya te desactivo» / «este mes lo dejamos congelado» / «claro que sí» | **No.** Es decisión de la escuela (congelar/retirar). Sí podría **registrar la novedad** (existe `whatsapp-ausencias`, pero solo para familia identificada y para una ausencia puntual). | Familias no identificadas; no hay flujo de «pausa/retiro» por chat. |
| 2 | **Torneos y viajes** | ~25 (13 %) | «¿Fechas de los dos torneos?»; «envío 100 mil del torneo + mensualidad»; «¿cuánto es para consignar?» (viaje); «¿recibiste la 2.ª cuota de México?»; «¿para qué es la reunión extraordinaria?» | Fechas: «8 de noviembre Corazonistas, 21 y 22 de noviembre Cenit». Cobro: «a mi Nequi …8969», monto dicho a mano. Viaje: mensajes largos y personales. | **No.** No hay ningún evento en `events` ni ítem en `school_tournament_items`; `wa_ventas_habilitadas=false` y `tournament_charges_enabled=false`. | No tenía el dato. Las conversaciones del viaje (cupos, devoluciones) **deben seguir siendo de Milena**. |
| 3 | **Información para prospectos** (precio, horarios, edad, dirección, inscripción) | ~28 (14 %) | «Tengo 23 años, he estado en otros clubes, ¿horarios?»; «¿cuánto es la mensualidad y qué dirección?»; «¿hasta qué edad reciben adultos?»; «¿cédula del titular de la cuenta para inscribirla?»; «¿mensualidad de 2 clases y uniforme?» | Pega su plantilla «Bienvenidos a Dynasty…» + imágenes de planes; manda el pin del coliseo; «hasta los 60»; «NIT 901929705»; «sí, 130 mil» (seniors); plantilla «Proceso de inscripción» (inscripción $170.000 al Nequi + mensualidad a Bancolombia + talla/número/nombre del uniforme) | **Parcial.** Horarios por edad (grupos-por-edad), cortesía y lista de precios (`wa_responder_precios=true`) ya funcionan. **No sabe**: valor de inscripción, qué incluye cada plan (días/semana), tope de edad de seniors, NIT, pin del mapa. | Del 02 al 05, bot apagado. Después respondió con el enlace genérico de inscripción y Milena igual completó (precio, edad máxima, ubicación). |
| 4 | **Clases extra / perfeccionamiento / refuerzo** (semana de receso) | ~19 (10 %) | «¿Pueden ir todas las categorías a perfeccionamiento? ¿cómo pago?»; «¿la clase de perfeccionamiento se paga a tu Nequi o por la plataforma?»; «¿dónde consigno las clases de hoy y mañana?»; «¿cómo son las clases de 25.000?»; «¿puede recuperar el domingo que faltó?» | «A mi Nequi …8969» (casi siempre); «llegas antes y me cancelas la clase»; «sí, en el coliseo»; «claro, el miércoles» | **No.** El carril de ventas (`whatsapp-venta-servicios`) está hecho pero **apagado** y el catálogo está **vacío**. Además la llave Nequi está marcada `only_for: [inscripcion]`, así que el bot nunca la ofrece para esto. | No tenía el dato + regla (ventas apagadas). Efecto colateral: **comprobantes de perfeccionamiento se aplicaron a «Mensualidad $180.000»** (2 casos vistos) y luego la escuela los rechazó. |
| 5 | **Horarios / ¿hay clase?** | ~17 (9 %) | «Esta semana (receso) ¿hay clase normal?»; «¿hoy hay vóley intermedio?»; «¿Nueva Era mañana tiene pruebas?»; «¿a qué hora entrena Intermedio Origen mañana?»; «¿está confirmado el entreno en cancha externa?» | «Sí claro», «siempre el mismo horario», «sí hay pruebas», «a las 7 hasta las 8:30» | **Parcial.** Responde el horario publicado y, con la regla nueva (`preguntaHorarioDeHoy`, 08-oct), también al desconocido. **No sabe** de novedades: receso, pruebas, cambios del día, cancelaciones. | Bot apagado hasta el 06. Después: dijo «no puedo confirmar la sesión de hoy» (correcto, no hay dato) y escaló. Una vez el entrenador no llegó a la cancha externa y nadie respondió por el chat. |
| 6 | **Uniformes / indumentaria** | ~12 (6 %) | «¿Precio de otros dos uniformes para los torneos?»; «¿me consigues pantalón de sudadera?»; «¿ya está la camiseta?»; «voy a pagar la matrícula para mandar hacer el uniforme, ¿a dónde y cuánto?» | «Valen $104» (sic), «sudadera $55», «al Nequi», «me recuerdas talla y número», «para el domingo me llegan» | **No.** No hay catálogo de prendas ni precios (`merchandise_enabled=false`, tienda no desplegada). | No tenía el dato. El pedido de talla/número/nombre sí podría capturarlo el bot. |
| 7 | **Cortesía** | ~3 | «Me quedaron de enviar la información para agendar la cortesía y nada»; «¿puedo llevar a una amiga de mi hija a una cortesía?» | «Para clase de cortesía: sábado 11 am» | **Sí.** `get_trial_class_info` agenda (se vieron 3 reservas completas del bot el 07 y 08). | Esas preguntas fueron del 02 al 05 (bot apagado). Hoy ya las cubre. |
| 8 | **Certificados / paz y salvo / factura** | ~9 | «Me regalas el paz y salvo y el certificado de servicio social»; «¿me puedes enviar factura electrónica?» | Pide documento y nombre completo, y al día siguiente manda 2 PDF | **No.** `paz y salvo` solo sube la urgencia del escalamiento. No hay generador de paz y salvo ni de certificado. | Falta la función. La factura electrónica existe en otro módulo (`whatsapp-factura.service`), pero la familia no estaba identificada. |
| 9 | **Cambio de grupo / recategorización / resultados de pruebas** | ~3 | «¿Le haces las pruebas de recategorización a mi hija?»; «¿cómo le fue en las pruebas y qué sigue?» | Audio | **No, y no debe.** Es criterio deportivo. | — |
| 10 | **Quejas** | ~2 | «Hay poca comunicación, yo así no pago sin que me informen»; «estamos en la cancha y el profe no ha llegado» | «Si quieres sube ahorita a la oficina, atiendo hasta las 9 pm» | **Parcial.** `wa_atencion_presencial` (4 a 9 p. m.) ya está cargado desde el 07-oct. La queja la debe ver una persona. | La primera queja llegó antes de cargar ese dato. |
| 11 | **Otros** (objetos perdidos, fisioterapia/psicología, excusas por salud, avisarle al profe que llega tarde, reunión de padres) | ~25 (13 %) | «¿Quedaron unas mangas blancas?»; «¿cómo saco cita con el fisio?»; «mi hijo no ha podido ir por un tratamiento»; «dile al profe que va tarde» | «Ya pregunto», «te comparto el contacto», «espero pronta recuperación» | **Parcial.** Ausencias → `whatsapp-ausencias` (si la familia está identificada). Fisio/psicología: podría estar en la info de la escuela (los teléfonos de psicología los publicó la escuela el 04-oct). | Familias no identificadas; el dato de fisio/psicología no está cargado. |

**Patrón transversal (por qué no respondió el bot):**
1. **Bot apagado del 02 al 05** → ~58 % de los mensajes de texto de Milena a familias de esta muestra son de esos días.
2. **Familia no identificada / sin cuenta** → el bot pide correo; la mamá le escribe «Hola Mile» y Milena contesta. En la muestra hay 92 conversaciones `desconocido` y 16 `familia_sin_cuenta` con mensajes a mano.
3. **Le falta el dato** (torneos, clases extra, uniformes, inscripción, novedades del día).
4. **Regla que lo calla**: ventas apagadas; Nequi restringido a inscripción; P4 (15 min de silencio después de que escribe una persona) — en varias conversaciones Milena contestó antes que el bot.

## 2. Datos que usa el bot vs. lo que dice Milena

| Dato | Lo que tiene la base | Lo que dice Milena en el chat | Estado |
|---|---|---|---|
| **Nequi de la dueña** (`payment_accounts`, «Nequi inscripciones») | `only_for: ["inscripcion"]` | Lo da para perfeccionamiento, clases extra, uniformes, sudaderas, torneo y viaje | **CONTRADICE.** El bot nunca lo ofrece para esos conceptos; la familia le escribe a Milena. Decidir: ampliar `only_for` a servicios/torneos o publicar otra cuenta para eso. |
| **Valor de la inscripción** | `offering_plans.registration_fee = null` en los 7 planes | «Inscripción $170.000» (incluye uniforme personalizado) | **FALTA.** El bot no puede responder «¿cuánto es la inscripción?». |
| **Enlace de inscripción** en la plantilla de Milena | El bot manda `app.sportmaps.co/join/dynasty-inscripcion` (bien) | Su respuesta rápida «Proceso de inscripción» apunta a **`stg.sportmaps.co`**/join/… | **DESACTUALIZADO (en el celular de Milena).** Las inscripciones que entren por ahí caen en staging. Cambiar la respuesta rápida. |
| **NIT del titular** (`bank_titular_id`) | `null` | «Es NIT 901929705» (un prospecto lo pidió para registrar la cuenta en su banco) | **FALTA.** |
| **Cuentas Bre-B** | 3 llaves activas (…1411, …5111, …9230) + Bancolombia ahorros …3578 + Wompi | Solo menciona Bancolombia ahorros …3578 y la llave …5111 | **POR CONFIRMAR** con Milena si …1411 y …9230 siguen vigentes (el bot manda las tres). |
| **Edad de Seniors** (`school_categories`) | `age_min=18`, `age_max=null` | «Adultos hasta los 60» | **FALTA** el tope (60). |
| **Qué incluye cada plan** | Nombres sin detalle («PLAN START», «PLAN PRO»…); `description=null`; `max_sessions` 4/8/12/16 no lo usa `textoDePrecios` | Prospectos preguntan «¿mensualidad de 2 clases?»; «seniors 130 mil» = «SENIORS 8 Clases» ✔ | **INCOMPLETO.** Precios coinciden; falta decir días por semana / para qué grupo. Cargar `description` o usar `max_sessions` en el texto. |
| **Ubicación del coliseo** (`school_branches`) | Dirección «Cl. 12 Bis #71g-09» ✔; `lat/lng = null`; `schools.address` vacío | Manda el pin a mano (coordenadas ~4.6444, -74.1310) y dice «sede propia en Ciudad Alsacia» | **INCOMPLETO.** Cargar lat/lng para que el bot pueda mandar el pin. |
| **Canchas externas** (Asoalsacia, Nido del Colibrí) | Solo texto en `teams.schedule[].place`, sin dirección | Las familias preguntan si el entreno en cancha externa está confirmado | **FALTA** la dirección de cada cancha externa (crearlas como sedes o instalaciones). |
| **Horarios** (`teams.schedule`) | Cargados para 10 grupos, actualizados el 07 y 08-oct; coinciden con lo que dice Milena («mañana no hay nada en la mañana, solo desde las 4 pm» ✔; Nueva Era mar/mié 5–7, vie 4–6, dom 9:30 ✔) | Durante el receso hubo horarios especiales (7 a. m., perfeccionamiento, pruebas) que no están en ninguna parte | **OK** el horario regular. **FALTA** un lugar para las novedades (receso, pruebas, cancelaciones). |
| **Grupo duplicado** | «MINIVOLLEY -BENJAMINES (DUPLICADO - NO USAR)» `active=true` (status inactive) | — | Menor: el bot ya lo filtra por el nombre. Conviene `active=false`. |
| **«Nueva Era»** | `branch_id = null` | Entrena en coliseo y en Nido del Colibrí | Menor: asignar sede. |
| **Atención presencial** (`payment_settings.wa_atencion_presencial`) | «Coliseo Dynasty, Cl. 12 Bis #71g-09. Desde las 4 p. m. hasta las 9 p. m.» | «Yo voy a estar hasta las nueve de la noche atendiendo» | **OK** (coincide). Solo existe desde el 07-oct. |
| **Qué llevar / a quién buscar** (`wa_cortesia_indicaciones`) | «Ropa de entrenamiento. La administración está en el ingreso derecho del coliseo, segundo piso.» | — | **OK** desde el 08-oct (el recordatorio del 07 todavía salió con el texto genérico). |
| **Franjas de cortesía** | Salen del horario de los grupos; `wa_modo_cortesia='clase'`, 7 días | Milena ofreció «sábado 11 am» (Infantil Femenino ✔) | **OK.** El 07-oct el bot dijo «los grupos no tienen edades cargadas» (ya corregido: el 08 respondió «para 13 años le corresponde Nueva Era»). |
| **Horario de atención del chat** (`whatsapp_settings.business_hours`) | 08:00–22:00/22:59 todos los días | — | Coherente. |
| **Torneos** (`events`, `school_tournament_items`) | **0 filas** | 8-nov Corazonistas; 21–22 nov Cenit; torneo $100.000; viaje a México en cuotas | **FALTA** todo. |
| **Clases extra / perfeccionamiento** | Catálogo vacío; `wa_ventas_habilitadas=false` | $25.000 por clase, se paga al Nequi o en la oficina antes de la clase; recuperar clase perdida: sí | **FALTA.** |
| **Uniformes y sudaderas** | Nada | Uniforme de competencia (~$104 mil, sin confirmar si es c/u o por dos), pantalón de sudadera $55.000, camiseta $25.000 | **FALTA** (y hay que confirmar los precios con Milena). |
| **Legacy** `payment_settings.allow_online=false` | — | Milena comparte el enlace de Wompi; `wompi_enabled=true` | Incoherente pero sin efecto en el bot (lee `payment_accounts`). |

## 3. Top 10 respuestas que el bot debería asumir

Ordenadas por mensajes ahorrados.

| # | Respuesta | Dato que falta / qué hay que hacer | Quién lo da |
|---|---|---|---|
| 1 | **Identificar por teléfono a las familias «sin cuenta» y contestarles su estado de cuenta** en vez de pedir correo (es la causa de la mitad de los «Hola Mile, me llegó un cobro…») | Ya hay `wa_identify_by_phone`/`familia_sin_cuenta`: dejar que consulten el estado sin crear la cuenta antes. Terminar de cargar los pagos de las planillas de papel. | Equipo SportMaps (código) + Milena (pagos en papel) |
| 2 | **Clases extra / perfeccionamiento / refuerzo: precio, quién puede ir, dónde y cómo pagar** (con el cobro con su concepto, para que el comprobante no caiga en «Mensualidad») | Cargar el catálogo (perfeccionamiento $25.000, refuerzo, recuperación), prender `wa_ventas_habilitadas` + `tournament_charges_enabled`, y decidir la cuenta (ampliar el `only_for` del Nequi) | Milena (precios, días, cupos) · SportMaps (activar) |
| 3 | **Valor y pasos de la inscripción** (los $170.000, qué incluye, a dónde, y pedir talla/número/nombre del uniforme) | `registration_fee` en los planes (o un texto de inscripción por escuela); el bot ya pega el enlace correcto | Milena |
| 4 | **Fechas y valor de torneos** («¿cuándo son los torneos?», «¿cuánto es el torneo?») | Cargar los eventos (8-nov y 21–22 nov) en el calendario y el ítem de cobro del torneo ($100.000) | Milena / entrenador principal |
| 5 | **«¿Hay clase hoy / esta semana?» con novedades** (receso, pruebas, cancelación, cambio de cancha) | Un aviso de novedades por grupo y fecha (el calendario de eventos para familias ya existe; falta que el bot lo lea) | Entrenadores o Milena, el mismo día |
| 6 | **«No ha ido / está enferma, no me cobren»**: registrar la novedad, explicar la política (congelar el mes, retiro) y dejarla en la bandeja para que la escuela la apruebe con un clic | Política escrita de congelamiento y retiro (Milena dijo «este mes lo dejamos congelado») + flujo de pausa (`pause_enabled=false` hoy) | Milena (política) · SportMaps (flujo) |
| 7 | **Información completa al prospecto**: qué incluye cada plan, edad máxima de adultos, NIT para registrar la cuenta, pin del coliseo | `description` de los 7 planes (días por semana y para qué grupo), `age_max=60` en Seniors, `bank_titular_id`, lat/lng de la sede | Milena |
| 8 | **Uniformes y sudaderas: precios y pedido** (talla, número, nombre) | Lista de prendas con precio (tienda escolar/dotación) y la cuenta donde se paga | Milena (y el proveedor) |
| 9 | **Paz y salvo / certificado de servicio social** | Generar el paz y salvo desde el estado de cuenta (ya se sabe si está al día) y una plantilla de certificado con los datos que Milena pide (documento y nombre completo) | SportMaps (función) · Milena (plantilla y firma) |
| 10 | **Dónde y cuándo pagar en efectivo / atención presencial y servicios del club** (fisio, psicología) | Atención presencial ya cargada ✔. Falta el contacto de fisioterapia y psicología en la info de la escuela | Milena |

## 4. Ahorro estimado

Base: ~28 mensajes/día de Milena a familias y prospectos (~194 en 7 días).

| Respuesta del top | Msgs/semana hoy | Asumibles por el bot | Ahorro/semana |
|---|---|---|---|
| 1 Estado de cuenta a familias sin cuenta | ~34 | ~50 % | ~17 |
| 2 Clases extra | ~19 | ~70 % | ~13 |
| 3 + 7 Prospectos e inscripción | ~28 | ~70 % | ~20 |
| 4 Torneos (fechas y cobro; el viaje no) | ~25 | ~35 % | ~9 |
| 5 Novedades de horario | ~17 | ~70 % | ~12 |
| 6 Congelar o retirar (registro, no decisión) | ~13 | ~40 % | ~5 |
| 8 Uniformes | ~12 | ~50 % | ~6 |
| 9 Paz y salvo | ~9 | ~60 % | ~5 |
| 10 Otros (fisio/psicología, presencial) | ~25 | ~15 % | ~4 |
| **Total** | **~182** | | **~91/semana ≈ 13 mensajes/día** |

- Eso es **~45 % de lo que Milena escribe a familias**, y ~10 % de sus ~124 mensajes diarios (el resto es personal u operación del club).
- Ahorro adicional sin construir nada: **marcar como `personal`** a los 2 familiares mal clasificados y apagar el **saludo automático de WhatsApp Business** (14 envíos en la semana que además pisan al bot). Eso no le ahorra mensajes a Milena, pero le quita ruido al bot y a las métricas.
- Como el bot estuvo apagado del 02 al 05, el número de hoy ya es menor: medido solo del 06 al 08 (el 08 hasta media tarde), Milena escribió ~26 mensajes de texto al día a familias. **Con el top 10 quedarían ~12–14 al día.**

## 5. Hallazgos colaterales

- **Comprobantes que no eran mensualidad se aplicaron a «Mensualidad»** (perfeccionamiento, uniforme) y luego la escuela los rechazó. El aviso «no lo pudo validar» confunde a la familia, que sí pagó. Se resuelve con el punto 2.
- Duplicados del 06-oct: 45 avisos repetidos («la escuela confirmó tu pago» ×3, «no lo pudo validar» ×3). Ya no aparecen el 07 ni el 08.
- El bot mandó **3 enlaces a `dev.sportmaps.co`** el 06-oct (el último a las 14:16). Desde entonces solo `app.` ✔.
- Varias preguntas de familias quedaron **sin respuesta de nadie** (p. ej. «¿esta semana de receso hay clase normal o adicionales?», «¿me regala el valor?»). El seguimiento «todavía nadie te ha contestado» ayuda, pero sin el dato el bot no puede cerrarlas.
