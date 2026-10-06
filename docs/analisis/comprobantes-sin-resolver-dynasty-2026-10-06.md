# Comprobantes sin resolver — Dynasty Volley Club (02 al 06-oct-2026)

Auditoría de solo lectura del 2026-10-06 sobre la cola `whatsapp_inbound_queue` de Dynasty (`2d509571-…`), desde el 2026-10-02. Pregunta: por cada archivo que el buzón muestra como «sin resolver», **¿el pago quedó registrado en SportMaps o no?**

Método:
- Se bajó del bucket `payment-receipts` cada archivo (84 de 90; 6 filas `contacto_no_atendido` no guardaron imagen) y **se miró uno por uno**. El OCR no queda guardado en la fila (solo el motivo), así que la imagen fue la fuente.
- Cada teléfono se cruzó (últimos 10 dígitos) contra `profiles.phone`, `children.parent_phone_temp`, `unregistered_athletes` y `school_staff`, y contra el Nequi de origen que aparece impreso en el comprobante.
- Se leyó el chat (`whatsapp_messages`) de cada familia con algo pendiente.
- Se contrastó con `payments` (ago-oct 2026, estados actuales a las ~11:00 del 06-oct).

Se escribió **nada** en la base. El SQL propuesto está en `docs/dynasty-planillas-septiembre-2026/aplicar_comprobantes_whatsapp_2026-10-06.sql`.

## Totales

La cola tiene **120 filas** desde el 02-oct: 30 `done` y **90 sin resolver** (las que muestra el buzón).

| Estado real hoy | Filas | Qué significa |
|---|---:|---|
| ❌ FALTA | **5** | Comprobante real a una cuenta de Dynasty, cobro identificado, y el pago **no** está registrado. SQL sección A. Suman **$880.000**. |
| ⚠️ DECIDIR | **16** | Hay plata y casi siempre atleta, pero falta una decisión (mes, monto, plan, ficha). 6 tienen SQL propuesto (B1-B7), el resto necesita a Milena o a la familia. |
| ✅ ESTÁ | **17** | El pago ya está registrado (paid). El motivo de la cola quedó viejo: Milena los registró a mano después. |
| 🗑️ NO ES MENSUALIDAD | **15** | Sí es una transferencia, pero no es una mensualidad: clases extra, torneo, rifa, viaje a México, uniformes, movimientos internos de la escuela. |
| 🗑️ NO ES COMPROBANTE | **37** | Fotos, afiches, menús, capturas de correos o de la app. Revisadas una por una: el OCR acertó en todas; **ninguna** era un comprobante mal clasificado. |
| **Total** | **90** | |

Por motivo de la cola: `no_es_comprobante`/`no es un comprobante` 33 · `ya_registrado` 14 · `sin_pendientes` 10 · `sin_familia` 9 · `varios_cobros` 7 · `contacto_no_atendido` 6 · `monto_distinto` 5 · `destino_ajeno`/`destino no es de la escuela` 3 · `familia_sin_cuenta` 1 · `waiting_user` 1 · `failed` 1.

## Las preguntas puntuales

**`···0690` aparece 15 veces** (no_es_comprobante / contacto_no_atendido / sin_familia). Es «Lu🪄», perfil *Luisa Danela Barrera* sin hijos en la escuela, conversación marcada `personal`: un **familiar de Milena**. Mandó fotos personales (una bebé, comida, una pizza, la calle) y una transferencia de $150.000 al Nequi de Milena. Nada es de la escuela. No es staff ni coach.

**Otros números que no son familias:** `···5309` es el WhatsApp de Giovanni Ávila (staff; comparte teléfono con el perfil de Milena) y mandó **transferencias salientes de la cuenta de Dynasty** hacia Milena; `···6212` es Federico Ávila (familia de Milena); `···8802` Laura Ávila Barrera (staff); `···8294` Ricardo Pardo (coach); `···3555` es el número del equipo SportMaps (fotos de planilla y de la app); `···2014` un restaurante; `···9820` un hotel; `···4173` un club rival (torneo Cenit); `···8205` el proveedor de uniformes.

**`destino_ajeno`:**
- **032-792500-01** (fila `06648d7d`, `···5309`): no es una cuenta que falte. Es un comprobante de **transferencia SALIENTE** de $2.100.000 *desde* la cuenta de Dynasty 806-000035-78 *hacia* la 032-792500-01. Movimiento interno.
- **52784471** (fila `f13bbce4`, `···1068`): es la **cédula de Milena** usada como llave Bre-B de su cuenta personal (la misma que figura como «Número de documento» en las transferencias salientes de `···5309`). La mamá de Sofía y Mariana Ariza pagó $1.250.000 = **2ª cuota de vuelos a México**. No es mensualidad.
- **Ninguna de las dos va en `payment_accounts`.** La configuración de Dynasty está completa: Bre-B 0092231411, 0089455111, 0090399230, cuenta 80600003578 (= 806-000035-78) y Nequi 3204298969 marcado «solo inscripciones». Todos los comprobantes de mensualidad revisados fueron a esas cuentas.
- El Nequi de Milena (3204298969) recibe **clases de perfeccionamiento/extra** ($25.000–$50.000), uniformes, rifa y matrículas: Milena se lo da a las familias por chat. Por eso varios `monto_distinto` de $25.000 no son mensualidades.

**`waiting_user` (`···9366`, Isabella Colmenares):** $300.000 «sep y oct». Ya está: Milena registró los dos meses como efectivo el 06-oct 10:08. Solo falta cerrar la fila (SQL C1).

**`failed` (`···6708`, «no se entendió la elección»):** el bot le ofreció a Heidy Machado solo los cobros de Juan Pablo; ella contestó «Ninguno de esos. Es la mensualidad de Sara Sofía octubre». **Falta** → SQL A2.

**`varios_cobros`:**

| Atleta | Cobros abiertos | Comprobante | Propuesta |
|---|---|---|---|
| Sara Juliana Lamus Sanclemente | sep 150k (vencido) + oct 150k | **$180.000** Bre-B 03-oct | No cuadra (sobran 30k). Preguntar. SQL B4 comentado (sep). El otro archivo ($55.000) es un pantalón de sudadera. |
| Juan José Peña | sep 210k + oct 210k | $210.000 DaviPlata **11-sep** | La mamá dice que es de septiembre → **sep** (SQL A5, ❌). |
| Sofía Alexandra Ramos Chocontá | sep 180k + oct 180k | $180.000 Nequi 05-oct | Sin mes en el chat → **sep** (SQL B1). |
| Kamila Ortiz Tovar | ago + sep + oct 180k | **$360.000** Nequi 04-oct | 2 meses → **ago + sep** (SQL B3); oct queda pendiente. |
| Isabella Rojas Gutiérrez | sep 150k + oct 150k | $150.000 Davivienda 04-oct | Sin mes → **sep** (SQL B2). |
| María Camila Ramírez Medina (`···8028`) | — | $150.000 03-oct «mes de septiembre» | ✅ ya registrado (sep CASH 05-oct). Ver ficha duplicada abajo. |

**`monto_distinto`:**

| Atleta | Cobro | Leído | Qué es |
|---|---|---|---|
| Isabella Mateus León | oct 150k (PRO) | $210.000 | «de 4 días a la semana» = **PLAN DYNASTY**. Cambio de plan + octubre (SQL B6, confirmar). |
| Luis Alejandro Parra | oct 180k | $25.000 | Clase de perfeccionamiento al Nequi de Milena. **Su octubre sigue sin pagar.** |
| María Paula Gutiérrez | oct 180k | $25.000 | Clase extra. Su octubre ya está pagado. |
| Ana María Cardona López | oct 130k | $5.000 | Complemento de la clase extra (no se registra). |
| Ana María Cardona López | oct 130k | $150.000 | «Pago octubre». $20.000 de más = saldo a favor que la mamá destinó a la clase extra (+ los $5.000). Octubre (SQL B5). |

**`sin_familia` / `familia_sin_cuenta` / `contacto_no_atendido`:**

| Tel. | Quién es | Propuesta |
|---|---|---|
| ···7214 | José Ignacio = acudiente de **José Rodríguez Pérez** (correo de la ficha; el Nequi de origen ···9523 es el teléfono de la ficha) | ❌ octubre (SQL A1) |
| ···4839 | «Jorge», reenvía el comprobante de **Ana María Martínez Jiménez** (el Nequi de origen ···3614 es el de su mamá) | ❌ octubre (SQL A3) |
| ···3451 | Andrea Castañeda, mamá de **Salomé Zambrano Castañeda** | ❌ octubre (SQL A4); vincular el número |
| ···4697 | Mandó el mismo PDF de Santiago Vásquez | ✅ |
| ···5957 | Carolina, mamá de «Camila Rubio», **no registrada**: $170.000 matrícula + uniforme al Nequi de inscripciones | ⚠️ dar de alta |
| ···5405 | «Erika Cruz», $90.000 «octubre» | ⚠️ sin ficha; candidatos Alexander Castillo / Robert De La Cruz |
| ···1816 | «Mateo», $104.000 | ⚠️ monto raro; candidatos Mateo Lancheros / Joseph Mateo Blanco |
| ···1068 | Jannis (familia Ariza) | 🗑️ vuelos México |
| ···6212 · ···0690 | familia de Milena | 🗑️ personal |
| ···4827 | Beverly Sarmiento (Isabella Mancera): captura del correo de cobro; «llevo varios meses sin asistir» | 🗑️ Milena ya la inactivó |
| ···0120 | **Mauricio Montealegre** (atleta adulto con cuenta): «envío pago mes de octubre» — imagen no guardada | ⚠️ revisar en WhatsApp; oct 130k pendiente |
| ···8847 | «Helen»: «mi pago de este mes» — imagen no guardada, sin ficha | ⚠️ revisar en WhatsApp |
| ···5348 | Bernardo Gutiérrez (papá de Susana): clases de hoy y mañana | 🗑️ |

## Otras cosas que salieron

- **Natalia Aguirre Bastidas** (`···7261`): pagó octubre ($180.000, 02-oct) pero su inscripción está **cancelada desde julio** y no tiene cobros; la ficha sigue activa. Reactivar desde la app.
- **Valentina Barreto** (`···0047`): octubre figura pagado en **efectivo el 11-sep**; el 06-oct la mamá mandó $180.000 de mensualidad + $100.000 de torneo. O el efectivo del 11-sep no existió, o estos $180.000 son noviembre.
- **Santiago Vásquez** septiembre quedó `paid` por $180.000, pero el comprobante y la planilla dicen $90.000 (asistió parte del mes). SQL B7 comentado.
- **Sarah Sequeda**: el comprobante del **04-sep** quedó pegado al cobro de **octubre**, y septiembre figura en efectivo el 06-oct. Confirmar que no se contó dos veces.
- **Ramírez Medina**: existe una ficha duplicada «JUANITA MARIA CAMILA RAMIREZ MEDINA» con sep y oct cobrando, además de agosto vencido en la ficha buena; la mamá dice «debo solo octubre».
- **Isabella Mateus**: hay una segunda ficha inactiva «ISABELLA MATEUS LEON» con un agosto pagado.
- **Ana María Sánchez Prieto** (`···7139`) mandó una foto en consultorio con la muñeca vendada: posible lesión, no es un pago.
- Entre las 30 `done` hay 5 aprobadas con monto distinto al leído (Silvanna Cruz y Leidy Pasachoa leídos 180k vs cobro 150k; Mariana Chingate 150k y Daniel Suárez 65k aprobados por el total; Susana Gutiérrez con el comprobante de 50k adjunto). Milena las aprobó así; no se tocan.
- La fila `0b18276d` (Juliana Rodríguez Amórtegui, $25.000 de clase) quedó `rejected`: correcto.

## Tabla completa (90 filas sin resolver)

Orden: ❌, ⚠️, ✅, 🗑️; dentro, por teléfono y fecha. «Fila» = primeros 8 caracteres del id de la cola. Teléfono enmascarado (últimos 4).

| Fila | Tel. | Fecha (COT) | Motivo en la cola | Estado real | Atleta | Cobro · monto | Propuesta |
|---|---|---|---|---|---|---|---|
| b65cd282 | ···3363 | 10-05 15:14 | varios_cobros | ❌ FALTA | Juan José Peña | Sep $210.000 vencido · leído $210.000 (DaviPlata 11-sep) | La mamá: «ese pago lo realicé el 10 de septiembre para ese mismo mes». Aplicar a SEPTIEMBRE con fecha 2026-09-11; octubre queda pendiente. SQL A5. |
| 5f52b8c2 | ···3451 | 10-03 10:51 | sin_familia | ❌ FALTA | Salomé Zambrano Castañeda | Oct $150.000 pendiente · leído $150.000 (Davivienda 03-oct) | Leyenda «Salomé Zambrano Castañeda — octubre». Aplicar a OCTUBRE; septiembre sigue vencido. Vincular el teléfono (mamá Andrea Castañeda). SQL A4. |
| 462c4ba3 | ···4839 | 10-03 11:54 | sin_familia | ❌ FALTA | Ana María Martínez Jiménez | Oct $180.000 pendiente · leído $180.000 (Nequi 03-oct, M08990043) | El Nequi de origen (···3614) es el de su mamá María Cenaida Jiménez; lo reenvió otro contacto. Aplicar a OCTUBRE. SQL A3. |
| f3bdec1d | ···6708 | 10-03 09:05 | failed: no se entendió la elección | ❌ FALTA | Sara Sofía López Machado | Oct $210.000 pendiente · leído $210.000 (03-oct, comp. 0000097500) | Aplicar a OCTUBRE: la mamá escribió «Ninguno de esos. Es la mensualidad de Sara Sofía octubre» (el bot solo le ofreció cobros del hermano). SQL A2. |
| 8bb39c9a | ···7214 | 10-03 11:05 | sin_familia | ❌ FALTA | José Rodríguez Pérez (acudiente José Ignacio) | Oct $130.000 pendiente · leído $130.000 (Nequi 03-oct, M07245237) | Aplicar a OCTUBRE (leyenda «pago OCTUBRE - José Ignacio»; el Nequi de origen ···9523 es el de la ficha). Septiembre sigue vencido. SQL A1. |
| f36bcc81 | ···0047 | 10-06 08:00 | sin_pendientes | ⚠️ DECIDIR | Valentina Barreto García | Oct ya figura PAGADO el 11-sep (CASH-MTWYCF34) · leído $190.000 (06-oct) | Chat: $180.000 mensualidad + $10.000 del torneo. Si el «efectivo» del 11-sep fue real, estos $180.000 son un adelanto (noviembre); si fue un error de registro, son octubre. Milena decide. Sin SQL. |
| ca976965 | ···0120 | 10-06 08:43 | contacto_no_atendido | ⚠️ DECIDIR | Mauricio Montealegre (atleta adulto con cuenta) | Oct $130.000 pendiente · sin archivo guardado | «Envío pago mes de octubre». La imagen no se guardó: revisarla en el WhatsApp; si es $130.000, aprobar octubre. |
| 2c40bc61 | ···0280 | 10-03 11:36 | monto_distinto | ⚠️ DECIDIR | Ana María Cardona López | Oct $130.000 pendiente · leído $150.000 (03-oct, «Pago octubre Ana María Cardona López») | Pagó $20.000 de más; la mamá (Janeth) dice que ese saldo a favor + los $5.000 del 05-oct son la clase extra. Marcar OCTUBRE pagado con amount_paid $150.000. SQL B5. |
| 7336cd09 | ···1696 | 10-05 17:18 | monto_distinto | ⚠️ DECIDIR | Isabella Mateus León | Oct $150.000 (PLAN PRO) · leído $210.000 (DaviPlata 05-oct) | La mamá: «mes de Isabella … de 4 días a la semana» = PLAN DYNASTY $210.000. Cambio de plan PRO→DYNASTY y octubre pagado. Confirmar con Milena. SQL B6. |
| abd9ff87 | ···1816 | 10-04 10:47 | sin_familia | ⚠️ DECIDIR | ¿? (contacto «Mateo», sin ficha) | leído $104.000 (Nequi 04-oct, a Bre-B 0090399230) | Monto que no es ningún plan. Candidatos: Mateo Lancheros Tafur (sep+oct $150.000) o Joseph Mateo Blanco (oct $150.000). Preguntar. |
| ac8e65e3 | ···3561 | 10-04 10:02 | varios_cobros | ⚠️ DECIDIR | Isabella Rojas Gutiérrez | Sep $150.000 vencido + Oct $150.000 · leído $150.000 (Davivienda 04-oct) | El chat no dice el mes → SEPTIEMBRE. SQL B2. |
| 4bbe3397 | ···4616 | 10-04 11:40 | sin_pendientes | ⚠️ DECIDIR | Sara Victoria Aguilar León | sin cobro · leído $75.000 (Bre-B 04-oct) | «Entrenamientos vacacionales lun-mar-mié». La mensualidad de octubre ya está pagada (fila 278aa289). No existe cobro de vacacionales: la escuela decide si lo crea. Sin SQL. |
| 68de14b8 | ···5253 | 10-04 13:53 | varios_cobros | ⚠️ DECIDIR | Kamila Stephanny Ortiz Tovar | Ago+Sep+Oct $180.000 c/u · leído $360.000 (Nequi 04-oct, M10465936) | $360.000 = 2 meses → AGOSTO y SEPTIEMBRE; octubre queda pendiente. SQL B3. |
| cb492b7a | ···5405 | 10-05 19:35 | sin_familia | ⚠️ DECIDIR | ¿? (contacto «Erika Cruz», sin ficha) | leído $90.000 (05-oct, a 806-000035-78) | «Te envío el comprobante de octubre». Número sin ficha. Candidatos con octubre de $90.000 pendiente: Alexander Castillo (mamá Erika Arévalo) o Robert De La Cruz Hernández. Preguntar. |
| f52c4388 | ···5425 | 10-06 08:52 | sin_pendientes | ⚠️ DECIDIR | Santiago Vásquez Saldaña | Sep marcado paid por $180.000 el 06-oct · leído $90.000 (Nequi 17-sep, M21970947) | La mamá envió $90.000 «de los días que Santiago asistió en septiembre» (la planilla de papel también dice $90.000). Septiembre quedó pagado completo: corregir amount_paid a $90.000 o confirmar el prorrateo. SQL B7 (comentado). |
| 38742902 | ···5957 | 10-03 10:20 | sin_familia | ⚠️ DECIDIR | «Camila Rubio» (mamá Carolina) — NO registrada | leído $170.000 (03-oct, al Nequi de inscripciones) | Matrícula + uniforme (Rubio #2, talla L). Destino correcto (Nequi solo inscripciones). Dar de alta a la atleta y registrar la inscripción. Sin SQL. |
| ca875e50 | ···7261 | 10-02 21:16 | sin_pendientes | ⚠️ DECIDIR | Natalia Aguirre Bastidas | sin cobros (inscripción CANCELADA desde jul-2026) · leído $180.000 (02-oct, a 806-000035-78) | «Envío soporte mes Octubre». La ficha está activa pero sin inscripción ni cobros. Reactivar la inscripción (PLAN ELITE $180.000) desde la app y aprobar octubre ahí (no por SQL: toca enrollments + payments). |
| 0d27a587 | ···7508 | 10-03 09:32 | varios_cobros | ⚠️ DECIDIR | Sara Juliana Lamus Sanclemente | Sep $150.000 vencido + Oct $150.000 · leído $180.000 (Bre-B 03-oct, TRUUSfWKLjEC) | No cuadra con ningún cobro (sobran $30.000). Preguntar a la familia; si es septiembre + otro concepto, aplicar a SEPTIEMBRE. SQL B4 (comentado). |
| eedbe970 | ···8847 | 10-06 10:30 | contacto_no_atendido | ⚠️ DECIDIR | ¿? (contacto «Helen», sin ficha) | sin archivo guardado (contacto_no_atendido) | «Mira Mile mi pago de este mes». La imagen no se guardó: revisarla en el WhatsApp y registrar. |
| 13cdadd7 | ···9005 | 10-05 17:21 | ya_registrado | ⚠️ DECIDIR | Sarah Luciana Sequeda Toro | Oct marcado paid con este comprobante · leído $150.000 del 04-SEP (M18960356) | Un comprobante de SEPTIEMBRE quedó pegado al cobro de OCTUBRE, y septiembre figura como efectivo del 06-oct. Confirmar que no sea el mismo dinero contado dos veces. Sin SQL. |
| a0129863 | ···9570 | 10-05 18:43 | varios_cobros | ⚠️ DECIDIR | Sofía Alexandra Ramos Chocontá | Sep $180.000 vencido + Oct $180.000 · leído $180.000 (Nequi 05-oct, M22778048) | El chat no dice el mes → al más antiguo vencido (SEPTIEMBRE). SQL B1. |
| da9346e9 | ···0030 | 10-06 10:22 | sin pagos pendientes | ✅ ESTÁ | María Susana Gutiérrez Guevara | Oct $210.000 paid 06-oct | Este es el comprobante real ($210.000, 01-oct); el cobro quedó con el de $50.000 (M05465595) adjunto. Solo cosmético. |
| 6ea93144 | ···2318 | 10-03 15:10 | ya_registrado | ✅ ESTÁ | Darwin Hernández | Sep $130.000 paid (06-sep) | Nada que hacer. |
| a72af73d | ···2318 | 10-03 15:11 | ya_registrado | ✅ ESTÁ | Darwin Hernández | Oct $130.000 paid 05-oct | Nada que hacer. |
| af8689d8 | ···2361 | 10-06 08:49 | ya_registrado | ✅ ESTÁ | María Isabella Marín Cadena | Oct $150.000 paid 06-oct | Nada que hacer. |
| a96e21d7 | ···4207 | 10-05 19:12 | ya_registrado | ✅ ESTÁ | Salomé Olarte Garzón | Oct $210.000 paid 06-oct | Nada que hacer. |
| 4eee92c8 | ···4697 | 10-04 11:26 | sin_familia | ✅ ESTÁ | Santiago Vásquez Saldaña | Oct $180.000 paid 06-oct | Mismo PDF que 0ed701d1, enviado desde otro número. Nada que hacer. |
| 1371cb50 | ···5153 | 10-06 08:54 | ya_registrado | ✅ ESTÁ | Sara Priolo Galeano | Oct $150.000 paid 06-oct | Nada que hacer. |
| 0ed701d1 | ···5425 | 10-06 08:52 | ya_registrado | ✅ ESTÁ | Santiago Vásquez Saldaña | Oct $180.000 paid 06-oct | AV Villas 04-oct «Pago Santiago Vasquez». Nada que hacer. |
| 3621be6b | ···5621 | 10-04 21:01 | ya_registrado | ✅ ESTÁ | Juliana Devia Salinas | Oct $180.000 paid 05-oct | Nada que hacer. |
| dfc72207 | ···5621 | 10-04 21:02 | ya_registrado | ✅ ESTÁ | Juliana Devia Salinas | Oct $180.000 paid 05-oct | Mismo comprobante enviado dos veces. |
| e9fb2364 | ···6135 | 10-04 14:33 | ya_registrado | ✅ ESTÁ | María Luisa Pardo Rodríguez | Oct $130.000 paid 06-oct | Nada que hacer. |
| 4458954f | ···6174 | 10-04 16:34 | ya_registrado | ✅ ESTÁ | Valeria Sanabria Velásquez | Oct $90.000 paid 05-oct | Nada que hacer. |
| 93c83a59 | ···7470 | 10-06 08:33 | ya_registrado | ✅ ESTÁ | Juan Ángel González Daza | Oct $150.000 paid 06-oct | Nada que hacer. |
| 45ecf4f4 | ···8028 | 10-03 10:34 | varios_cobros | ✅ ESTÁ | María Camila Ramírez Medina | Sep $150.000 paid 05-oct (CASH) | Comprobante de septiembre ya registrado. Aparte: hay una ficha duplicada «JUANITA MARIA CAMILA RAMIREZ MEDINA» cobrando sep+oct, y agosto figura vencido; la mamá dice «debo solo octubre». Revisar el duplicado. |
| b8d14b56 | ···8497 | 10-03 10:14 | ya_registrado | ✅ ESTÁ | David Santiago Parada Riaño | Oct $150.000 paid 05-oct | Nada que hacer. |
| e9a6fce5 | ···8880 | 10-05 07:52 | ya_registrado | ✅ ESTÁ | María José García Rojas | Oct $150.000 paid 05-oct | Nada que hacer. |
| f8cdc027 | ···9366 | 10-06 09:31 | waiting_user | ✅ ESTÁ | Isabella Colmenares Acevedo | Sep+Oct $150.000 c/u paid 06-oct | $300.000 Bre-B 03-oct «sep y oct». Milena los registró como EFECTIVO el 06-oct. Cerrar la fila waiting_user. |
| 9d67e78b | ···0047 | 10-06 08:24 | sin_pendientes | 🗑️ NO ES MENSUALIDAD | Valentina Barreto García | leído $90.000 (06-oct) | Torneo ($90.000 + $10.000 = $100.000). No hay cobro de torneo. |
| 852316a7 | ···0280 | 10-05 14:22 | monto_distinto | 🗑️ NO ES MENSUALIDAD | Ana María Cardona López | leído $5.000 (05-oct) | Complemento de la clase extra (semana de receso). No hay cobro; no se registra. |
| f073a551 | ···0640 | 10-05 15:11 | no_es_comprobante | 🗑️ NO ES COMPROBANTE | — | — | Foto de un entrenamiento. |
| 9aca0919 | ···0640 | 10-06 08:22 | no es un comprobante | 🗑️ NO ES COMPROBANTE | — | — | Correo estado de cuenta (familia Soracá). |
| f64ff7b3 | ···0680 | 10-06 08:23 | no es un comprobante | 🗑️ NO ES COMPROBANTE | — | — | Captura del correo «Tu estado de cuenta» (Sarah Sequeda). Su pago real llegó en decaa27a. |
| be8e4853 | ···0690 | 10-02 20:27 | no_es_comprobante | 🗑️ NO ES COMPROBANTE | Contacto personal de Milena («Lu») | — | Foto personal (bebé, comida, calle). Sin archivo si es contacto_no_atendido. |
| 656097fd | ···0690 | 10-02 23:14 | no_es_comprobante | 🗑️ NO ES COMPROBANTE | Contacto personal de Milena («Lu») | — | Foto personal (bebé, comida, calle). Sin archivo si es contacto_no_atendido. |
| 2f916f37 | ···0690 | 10-02 23:50 | no_es_comprobante | 🗑️ NO ES COMPROBANTE | Contacto personal de Milena («Lu») | — | Foto personal (bebé, comida, calle). Sin archivo si es contacto_no_atendido. |
| d3e4d07a | ···0690 | 10-02 23:50 | no_es_comprobante | 🗑️ NO ES COMPROBANTE | Contacto personal de Milena («Lu») | — | Foto personal (bebé, comida, calle). Sin archivo si es contacto_no_atendido. |
| 96eaba39 | ···0690 | 10-03 18:32 | no_es_comprobante | 🗑️ NO ES COMPROBANTE | Contacto personal de Milena («Lu») | — | Foto personal (bebé, comida, calle). Sin archivo si es contacto_no_atendido. |
| ec640fc4 | ···0690 | 10-03 22:13 | no_es_comprobante | 🗑️ NO ES COMPROBANTE | Contacto personal de Milena («Lu») | — | Foto personal (bebé, comida, calle). Sin archivo si es contacto_no_atendido. |
| 3641be8b | ···0690 | 10-03 22:25 | sin_familia | 🗑️ NO ES MENSUALIDAD | Contacto personal de Milena («Lu», Barrera) | leído $150.000 (03-oct, al Nequi de Milena) | Transferencia personal. No aplica. |
| 3deb2ef9 | ···0690 | 10-03 22:41 | no_es_comprobante | 🗑️ NO ES COMPROBANTE | Contacto personal de Milena («Lu») | — | Foto personal (bebé, comida, calle). Sin archivo si es contacto_no_atendido. |
| 56b121a6 | ···0690 | 10-04 09:40 | no_es_comprobante | 🗑️ NO ES COMPROBANTE | Contacto personal de Milena («Lu») | — | Foto personal (bebé, comida, calle). Sin archivo si es contacto_no_atendido. |
| 8e3c14bb | ···0690 | 10-04 10:03 | no_es_comprobante | 🗑️ NO ES COMPROBANTE | Contacto personal de Milena («Lu») | — | Foto personal (bebé, comida, calle). Sin archivo si es contacto_no_atendido. |
| 63ddea4f | ···0690 | 10-04 22:30 | no_es_comprobante | 🗑️ NO ES COMPROBANTE | Contacto personal de Milena («Lu») | — | Foto personal (bebé, comida, calle). Sin archivo si es contacto_no_atendido. |
| eae95d2b | ···0690 | 10-05 22:18 | no_es_comprobante | 🗑️ NO ES COMPROBANTE | Contacto personal de Milena («Lu») | — | Foto personal (bebé, comida, calle). Sin archivo si es contacto_no_atendido. |
| b54cccf4 | ···0690 | 10-06 08:10 | contacto_no_atendido | 🗑️ NO ES COMPROBANTE | Contacto personal de Milena («Lu») | — | Imagen no guardada (contacto personal). |
| 0166fb22 | ···0690 | 10-06 08:12 | contacto_no_atendido | 🗑️ NO ES COMPROBANTE | Contacto personal de Milena («Lu») | — | Imagen no guardada (contacto personal). |
| 6a998e3c | ···0690 | 10-06 08:23 | contacto_no_atendido | 🗑️ NO ES COMPROBANTE | Contacto personal de Milena («Lu») | — | Imagen no guardada (contacto personal). |
| 87756929 | ···0811 | 10-04 08:51 | no_es_comprobante | 🗑️ NO ES COMPROBANTE | — | — | Afiche Copa de Voleibol Ciudad de Bogotá. |
| f13bbce4 | ···1068 | 10-03 11:50 | destino_ajeno | 🗑️ NO ES MENSUALIDAD | Familia Ariza Sánchez (Jannis) | leído $1.250.000 (03-oct, llave 52784471) | 2ª cuota de vuelos a México (Sofía y Mariana Ariza). La llave 52784471 es la cédula de Milena. No aplica. |
| 4af7f048 | ···1621 | 10-05 12:54 | no_es_comprobante | 🗑️ NO ES COMPROBANTE | — | — | Correo estado de cuenta (Michell Garzón, atleta inactiva). |
| d000db50 | ···1621 | 10-06 08:13 | no es un comprobante | 🗑️ NO ES COMPROBANTE | — | — | Correo estado de cuenta (Michell Garzón). |
| 156a3fd8 | ···2014 | 10-04 13:53 | no_es_comprobante | 🗑️ NO ES COMPROBANTE | — | — | Menú de restaurante. |
| 3397dabb | ···2014 | 10-04 13:53 | no_es_comprobante | 🗑️ NO ES COMPROBANTE | — | — | Menú de restaurante. |
| dcdfd681 | ···3526 | 10-03 11:40 | no es un comprobante | 🗑️ NO ES COMPROBANTE | — | — | Afiche de la rifa Profondos México. |
| 01919c75 | ···3526 | 10-03 11:40 | no es un comprobante | 🗑️ NO ES COMPROBANTE | — | — | Afiche de la rifa. |
| 3b52d2ab | ···3526 | 10-03 11:40 | no es un comprobante | 🗑️ NO ES COMPROBANTE | — | — | Afiche de la rifa. |
| b8dd6ae6 | ···3526 | 10-03 11:46 | destino no es de la escuela | 🗑️ NO ES MENSUALIDAD | Familia Santacruz Silva | leído $1.200.000 (03-oct, al Nequi de Milena) | «Cartones 17 34 y 35 Sofía» = rifa. No aplica. |
| 76344911 | ···3555 | 10-03 22:53 | no_es_comprobante | 🗑️ NO ES COMPROBANTE | — | — | Foto de una planilla de papel (número del equipo SportMaps). |
| bc93269d | ···3555 | 10-06 08:35 | no es un comprobante | 🗑️ NO ES COMPROBANTE | — | — | Captura del buzón de la app (equipo SportMaps). |
| 4416d0de | ···3797 | 10-05 16:25 | monto_distinto | 🗑️ NO ES MENSUALIDAD | Luis Alejandro Parra Moreno | leído $25.000 (05-oct, al Nequi de Milena) | Clase de perfeccionamiento (Milena le dio su Nequi). Su octubre de $180.000 sigue PENDIENTE. |
| e70be041 | ···4173 | 10-04 10:58 | no_es_comprobante | 🗑️ NO ES COMPROBANTE | — | — | Afiche Torneo Cenit. |
| 8c2ad34a | ···4173 | 10-04 10:58 | no_es_comprobante | 🗑️ NO ES COMPROBANTE | — | — | PDF del Torneo Cenit. |
| 6802b154 | ···4207 | 10-05 18:18 | sin_pendientes | 🗑️ NO ES MENSUALIDAD | Salomé Olarte Garzón | leído $50.000 (05-oct, al Nequi de Milena) | Clases de perfeccionamiento. No aplica. |
| 016252b9 | ···4827 | 10-06 09:38 | familia_sin_cuenta | 🗑️ NO ES COMPROBANTE | — | — | Captura del correo de cobro (Isabella Mancera). Milena ya la inactivó el 06-oct; cobros anulados. |
| 44d0196c | ···5309 | 10-04 08:56 | sin_pendientes | 🗑️ NO ES MENSUALIDAD | Movimiento interno (número de Giovanni Ávila) | $4.618.000 SALIENTE de 80600003578 → Milena | No es un pago de familia: sale de la cuenta de Dynasty. |
| 06648d7d | ···5309 | 10-04 08:57 | destino_ajeno | 🗑️ NO ES MENSUALIDAD | Movimiento interno | $2.100.000 SALIENTE de 806-000035-78 → 032-792500-01 | Es la cuenta a la que la escuela TRANSFIRIÓ, no una cuenta que falte en la configuración. |
| be6747a2 | ···5309 | 10-04 21:04 | sin_pendientes | 🗑️ NO ES MENSUALIDAD | Movimiento interno | $4.618.000 SALIENTE de 80600003578 → Milena | Igual que el anterior (otro envío del mismo valor, 04-oct 21:04). |
| 85e39876 | ···5309 | 10-05 21:02 | sin_pendientes | 🗑️ NO ES MENSUALIDAD | Movimiento interno | $3.314.000 SALIENTE de 80600003578 → Milena | No es un pago de familia. |
| 40367b21 | ···5348 | 10-06 10:20 | contacto_no_atendido | 🗑️ NO ES MENSUALIDAD | Bernardo Gutiérrez (papá de Susana Gutiérrez) | sin archivo guardado | Clases de hoy y mañana, al Nequi de Milena. No aplica. |
| c7f9d451 | ···6212 | 10-04 10:26 | sin_familia | 🗑️ NO ES MENSUALIDAD | Federico Ávila (familia de Milena) | leído $1.000.000 (04-oct, al Nequi de Milena) | Transferencia personal. No aplica. |
| 8ddb774c | ···7139 | 10-03 13:22 | no_es_comprobante | 🗑️ NO ES COMPROBANTE | — | — | Foto de una atleta en consultorio (posible lesión; avisar). |
| 4ef7eebf | ···7217 | 10-05 08:11 | monto_distinto | 🗑️ NO ES MENSUALIDAD | María Paula Gutiérrez Rodríguez | leído $25.000 (05-oct, al Nequi de Milena) | Clase extra. Su octubre ya está pagado (fila 132932b1). |
| 7782d02c | ···7508 | 10-05 12:51 | varios_cobros | 🗑️ NO ES MENSUALIDAD | Sara Juliana Lamus Sanclemente | leído $55.000 (05-oct, al Nequi de Milena) | Pantalón de sudadera (chat). No aplica. |
| e37f647b | ···8028 | 10-05 12:43 | no_es_comprobante | 🗑️ NO ES COMPROBANTE | — | — | Captura del correo estado de cuenta (Ramírez Medina): evidencia de la ficha duplicada. |
| a457693b | ···8205 | 10-05 13:07 | no_es_comprobante | 🗑️ NO ES COMPROBANTE | — | — | Cuenta de cobro del proveedor de uniformes (Aptitud Deportiva, $582.000): gasto, no ingreso. |
| fb43237a | ···8294 | 10-05 08:04 | no_es_comprobante | 🗑️ NO ES COMPROBANTE | — | — | Foto de un entrenamiento (Ricardo Pardo, coach). |
| 1328baad | ···8802 | 10-03 08:18 | no_es_comprobante | 🗑️ NO ES COMPROBANTE | — | — | Selfie (Laura Ávila Barrera, familia/staff). |
| 2884dba5 | ···9206 | 10-06 08:54 | no es un comprobante | 🗑️ NO ES COMPROBANTE | — | — | Captura de la app (Juan David Salgado). Su octubre ya figura pagado el 06-oct. |
| 2c8afa60 | ···9820 | 10-05 14:11 | no_es_comprobante | 🗑️ NO ES COMPROBANTE | — | — | Publicidad de hotel. |

