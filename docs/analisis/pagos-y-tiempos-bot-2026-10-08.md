# Pagos que pasan por el bot y tiempos de respuesta — Dynasty (2026-10-08)

> Informe local, **no commitear**. Solo lectura sobre la base de producción (SELECT). Sin nombres: solo conteos y montos.
> Escuela `2d509571-…`, integración WhatsApp `f50d6940-…`. Ventana pedida: últimos 10 días (28-sep → 08-oct ~16:45 COT).
> **Ojo:** los mensajes de WhatsApp existen desde el **02-oct** (alta de Coexistence), así que la parte B cubre 7 días reales.

## Resumen en 6 líneas

1. Recaudo aprobado en 10 días: **183 pagos / ≈ $28,7 M**. Pasaron por el bot (comprobante por WhatsApp leído y registrado por el bot): **53 pagos / $8,29 M (29 %)**.
2. Pago en línea (Wompi firmado desde `/p/`): **0 pagos, $0**. 12 sesiones de checkout creadas: 11 abandonadas, 1 fallida; el único webhook vino de `environment=test` con `ERROR` (comercio sandbox).
3. Enlaces `/p/:token`: **803 emitidos** (797 en el reenvío del estado de cuenta del 06-oct, **todos por correo**; 0 estados de cuenta salieron por WhatsApp). **201 abiertos (25 %)**, 55 de esos cobros ya están pagados (6,8 %). Abierto → pagado 14 %; no abierto → pagado 4 %.
4. Cuello de botella principal: **la aprobación humana**. Foto → registro por el bot: p50 **3,5 min**. Foto → aprobación: p50 **3,7 h**, promedio **18,7 h**, p90 **49 h**, máx **75 h**. Incluso los comprobantes en **verde** esperan p50 2,7 h (p90 24 h).
5. Primera respuesta a familias/prospectos: p50 **0,7 min** (bot primero en 312 de 601 solicitudes), pero **164 (27 %) se quedan sin respuesta el mismo día**; domingo 60 % y lunes 50 % (el bot no respondió nada el 04 y 05-oct).
6. Escalaciones a persona: **25 eventos, solo 10 con respuesta humana; 18 (72 %) sin respuesta al cierre del día y 15 (60 %) nunca**. En la franja 16–21 h fue peor (9 de 10 sin respuesta al cierre).

---

## A) Pagos que pasan por el bot

### A.1 Enlaces `/p/:token` (`payment_public_tokens`)

| Día de emisión | Emitidos | Abiertos | Aperturas | Cobros hoy pagados |
|---|---:|---:|---:|---:|
| 04-oct | 1 | 1 | 4 | 1 |
| 05-oct | 1 | 1 | 2 | 0 |
| 06-oct (reenvío estado de cuenta) | 797 | 199 | 389 | 54 |
| 07-oct | 4 | 0 | 0 | 0 |
| **Total** | **803** | **201 (25 %)** | **395** | **55 (6,8 %)** |

- Canal del estado de cuenta (`email_sends`): 05-oct **304 correos** 12:42–12:48 (los del enlace a localhost) y 06-oct **421 correos** 08:06–08:22 + 1 fallido. **Ningún envío por WhatsApp** (no hay salientes de plantilla con `/p/` en `whatsapp_messages`).
- El bot **no entregó ningún `/p/`** en el periodo: 14 respuestas de «cuánto debo» (`get_payment_status`, todas el 06-oct, antes de que el enlace «Pagar» estuviera vivo) y en 3 de 4 respuestas de medios de pago mandó **`app.sportmaps.co/my-payments` (exige login)**. El 07 y 08-oct no hubo ninguna consulta de saldo al bot.

**Cobros con token del 05–07-oct que hoy están pagados (54), por vía:**

| Vía | Abrió el enlace | No lo abrió | Total | Monto |
|---|---:|---:|---:|---:|
| Transferencia + comprobante por WhatsApp (bot) | 18 | 16 | 34 | $5,26 M |
| Link de pago genérico de la escuela + comprobante por WhatsApp | 1 | 0 | 1 | $0,18 M |
| Transferencia registrada sin pasar por el bot | 3 | 5 | 8 | $1,14 M |
| Efectivo | 6 | 5 | 11 | $1,60 M |
| Wompi en línea (checkout firmado) | 0 | 0 | **0** | $0 |

- Tiempo envío (06-oct ~08:10) → foto por WhatsApp, entre quienes abrieron: p50 **9,4 h**; → aprobación: p50 **11,1 h**.
- Los 16 «no abiertos» con comprobante por WhatsApp mandaron la foto **antes** del reenvío (p50 −12,8 h): pagaron por el correo del 05-oct o por iniciativa propia.
- Efectivo: aprobado p50 0,5 h después del envío → registro de caja de la mañana, no efecto del enlace.

### A.2 Pagos en línea (Wompi)

- `payment_links` del periodo: 12 (11 `pending` abandonados, 1 `failed`), **0 `paid`**. 5 de esas 12 sesiones son de cobros cuyo `/p/` se abrió.
- `webhook_events`: 1 evento, `environment=test`, `transaction.status=ERROR` (05-oct). Sigue el problema conocido del comercio sandbox de Dynasty. Mientras eso siga así, `/p/` no puede ofrecer pago en línea real (por diseño, nunca ofrece sandbox).

### A.3 Comprobantes por WhatsApp (`whatsapp_inbound_queue`)

188 adjuntos (173 imágenes + 15 documentos) en 10 días:

| Desenlace | n |
|---|---:|
| Registrado como comprobante (`payment_receipt`) | **46** → 43 aprobados ($6,83 M) / 3 rechazados ($0,54 M) |
| Escalado a persona | **43**: familia sin cuenta 10 · número sin ficha 9 · sin cobros pendientes 9 · varios cobros sin desempate 6 · monto distinto 4 · destino ajeno 1 · pregunta vencida sin enviar 1 · otros 3 |
| No es comprobante | 48 |
| Contacto no atendido (personal/staff) | 31 |
| Duplicado detectado (`ya_registrado`, referencia repetida) | ~10 |
| Sin pendientes / destino no es de la escuela / falla | 3 / 1 / 1 |

**Tiempos (43 aprobados):**

| Tramo | p50 | p90 | Máx |
|---|---:|---:|---:|
| Foto → registrado por el bot | 3,5 min | — | — |
| Foto → aprobación | **3,7 h** | **49 h** | 75 h |
| Aprobación → aviso «pago confirmado» | 18 s | — | — |

Distribución foto → aprobación: < 15 min **4** · 15–60 min **11** · 1–4 h **7** · 4–24 h **9** · 24–48 h **7** · > 48 h **5**.

- **Toda** la aprobación la hace una sola persona (183 de 183 pagos del periodo, mismo `approved_by`).
- Se aprueba **por tandas**: 31 de 43 el 06-oct; 26 de 43 entre las 08:00 y las 10:59. Ninguna entre 18:00 y 21:59 (la franja de atención).
- Veredicto automático vs espera: **verde** (vía WhatsApp, n=28) p50 **2,7 h**, p90 23,8 h; **amarillo** (n=15) p50 0,4 h. Los verdes no se aprueban antes que los amarillos: el veredicto no está ordenando la cola.
- **Rechazos: 3, los 3 sin `rejection_reason`.** El bot solo puede decir «la escuela no lo pudo validar». Además el panel rechaza poniendo `status='rejected'` **sobre el propio cobro** (ver mejora 2): esos 3 cobros de octubre ($0,54 M) dejaron de figurar como pendientes.
- Aviso de resultado triplicado el 06-oct (65 mensajes para 20 avisos únicos, los tres BFF). El 07 y 08-oct salió sin duplicados: **ya resuelto**.

### A.4 Recaudo atribuible al bot vs total (aprobados en los 10 días)

| Origen | Pagos | Monto |
|---|---:|---:|
| **Comprobante procesado por el bot (WhatsApp)** | **53** | **$8,29 M (29 %)** |
| Transferencia con recibo subido en la app | 49 | ≈ $7,6 M |
| Transferencia registrada a mano, sin recibo | 50 | ≈ $8,1 M |
| Efectivo | 28 | ≈ $4,3 M |
| Tarjeta (registro manual) | 3 | $0,54 M |
| Wompi en línea | 0 | $0 |
| **Total** | **183** | **≈ $28,7 M** |

Influencia del enlace sin bot: otros 8 cobros (transferencia/efectivo, $1,1 M) se pagaron después de abrir `/p/` sin pasar por el bot.
Contexto de octubre: 103 cobros pagados ($16,3 M) frente a **397 pendientes ($60,4 M)**.

---

## B) Tiempos de respuesta (familias y prospectos; sin personal ni staff)

**Método.** «Solicitud» = mensaje entrante que abre turno (es el primero, el anterior fue saliente o pasaron más de 6 h). Se excluyen stickers y acuses («ok», «gracias», «listo»…). Bot = `ai_generated`. Persona = eco de Coexistence (`payload.to`), sin contar el saludo automático de la app ni los textos repetidos a 3 o más contactos. Horas en America/Bogota. **Límite:** lo que se resolvió por llamada o en persona no queda registrado.

### B.1 Primera respuesta: 601 solicitudes

| | n | p50 primera respuesta | p50 hasta respuesta humana | Primero el bot | Primero una persona | Sin respuesta el mismo día |
|---|---:|---:|---:|---:|---:|---:|
| **Total** | 601 | **0,7 min** | **26,5 min** | 312 | 195 | **164 (27 %)** |
| 07–16 h | 427 | 0,7 min | 29,4 min | 215 | 143 | 109 (26 %) |
| **16–21 h (atención)** | 125 | 0,5 min | 24,9 min | 79 | 32 | 35 (28 %) |
| 21–07 h | 49 | 4,9 min | 22,4 min | 18 | 20 | 20 (41 %) |

**Por día de la semana:**

| Día | n | p50 1.ª respuesta | p50 humana | Sin respuesta el mismo día |
|---|---:|---:|---:|---:|
| Lunes | 88 | 37 min | 27 min | 44 (50 %) |
| Martes | 205 | 0,4 min | 14 min | 32 (16 %) |
| Miércoles | 133 | 0,4 min | 19 min | 11 (8 %) |
| Jueves | 42 | 0,4 min | 13 min | 9 (21 %) |
| Viernes | 9 | 8,4 h | 4,7 h | 7 |
| Sábado | 69 | 37 min | 6,2 h | 28 (41 %) |
| Domingo | 55 | 27 min | 18 min | 33 (60 %) |

- **Bot apagado de hecho el 04 y 05-oct** (0 respuestas del bot con 248 y 272 entrantes), y casi apagado el 02 y 03-oct (4 y 26). Eso explica el lunes y el domingo. `whatsapp_settings` hoy dice `ai_enabled=true`, `mode=auto` (modificado el 07-oct).
- Por tipo de contacto: familia (270) p50 0,4 min y 18 % sin respuesta; desconocido/prospecto (247) p50 2,3 min, humana 42 min, **32 % sin respuesta**; sin clasificar (48) humana 4,4 h, **54 % sin respuesta**.
- `whatsapp_settings.business_hours` está en **08:00–22:00 todos los días**, no en 16–21. Fuera de ese rango, lo que el bot promete al escalar no coincide con la atención real.

### B.2 Escalaciones a persona

| Paso | Franja | n | Con respuesta humana | p50 hasta respuesta humana | Sin respuesta al cierre del día | Nunca |
|---|---|---:|---:|---:|---:|---:|
| escalated | 07–16 | 4 | 3 | 12,7 min | 2 | 1 |
| escalated | 16–21 | 4 | 1 | 44,5 h | 4 | 3 |
| escalated | 21–07 | 1 | 1 | 1,6 min | 0 | 0 |
| mensaje_para_persona | 07–16 | 6 | 1 | 1,7 h | 5 | 5 |
| mensaje_para_persona | 16–21 | 1 | 0 | — | 1 | 1 |
| mensaje_para_persona | 21–07 | 3 | 2 | 10,5 min | 1 | 1 |
| retoma (sin respuesta / respuesta) | 16–21 | 4 | 2 | 5 min / 16 h | 3 | 2 |
| escalacion_sin_respuesta | 07–16 y 16–21 | 2 | 0 | — | 2 | 2 |
| **Total** | | **25** | **10** | | **18 (72 %)** | **15 (60 %)** |

- En la franja 16–21 h: 10 escalaciones, 3 con respuesta, **9 sin respuesta al cierre**. Fuera de ella: 15, 7 con respuesta, 9 sin respuesta al cierre. El horario de atención no mejora la atención de lo escalado.
- Además hay **43 comprobantes escalados** (A.3) que no generan un evento `escalated` en el chat y no entran en esta tabla.

---

## Cuellos de botella

1. **Aprobación manual, por tandas y por una sola persona.** El bot registra en 3,5 min, pero la familia espera p50 3,7 h y p90 2 días por el «pago confirmado». El veredicto verde no acelera nada.
2. **El dinero en línea no entra.** Wompi de Dynasty sigue en sandbox → 0 pagos en línea. `/p/` termina siendo una página de «transfiera y mande la foto».
3. **El estado de cuenta salió solo por correo.** Abrió el 25 %. WhatsApp, el canal donde ocurre el pago (el 29 % del recaudo), no se usó para el cobro.
4. **Escalaciones sin dueño.** El 60 % nunca recibió respuesta humana en el chat.
5. **El bot no resuelve la identidad en los comprobantes.** 28 de 43 escalados son «familia sin cuenta», «número sin ficha» o «sin pendientes».
6. **Rechazos sin motivo y que borran la deuda.** La familia no sabe qué corregir y el cobro deja de figurar como pendiente.

## 5 mejoras concretas (propuestas, no implementadas)

1. **Cola de aprobación rápida con prioridad por veredicto.** Tres partes:
   - Agrupar los comprobantes en «Por aprobar», con los verdes arriba, y un botón «Aprobar todos los verdes» (cada uno sigue pasando por la lógica de abono y discrepancia de `ApprovePaymentMethodSheet`).
   - Avisar por push en cuanto llega un comprobante y repetir el aviso si pasan 2 h sin aprobarlo.
   - Archivos probables: `frontend/src/pages/PaymentsAutomationPage.tsx`, `bff/src/services/receipt-approval.service.ts` (`evaluatePaymentReceipt`) y `bff/src/services/receipt-verdict.ts`.
   - La aprobación automática de verdes (referencia única + destino de la escuela + monto exacto) es una decisión de producto aparte: hay que mirarla junto con el hallazgo de `auto_approve_payment` de la auditoría de seguridad.
2. **Motivo obligatorio al rechazar, sin matar el cobro.**
   - Hoy `handleManualAction` en `PaymentsAutomationPage.tsx` hace `update({ status: 'rejected' })` sobre el cobro, sin `rejection_reason`.
   - Propuesta: un modal con motivos tipificados (monto, destino, ilegible, duplicado, otro). Que el cobro vuelva a `pending`/`overdue` y quede rechazado el comprobante, no la deuda.
   - `bff/src/jobs/whatsapp-payment-outcome.job.ts` debe incluir el motivo en el mensaje a la familia.
   - Verificar antes cómo quedaron los 3 cobros de octubre rechazados.
3. **Estado de cuenta y recordatorios por WhatsApp con botón `/p/`, y pago en línea real.**
   - Revisar por qué la corrida del 06-oct no eligió WhatsApp: `elegirCanal`, `whatsappDisponibleEnEscuela` en `bff/src/services/estado-de-cuenta.service.ts`, y opt-ins y plantilla aprobada en `whatsapp-plantillas.service.ts`.
   - En paralelo, pasar Dynasty a llaves Wompi de producción (cuenta conectada), para que `pasarelaParaCobro` en `cobro-enlace-publico.service.ts` ofrezca pago en línea.
   - Y que el bot nunca vuelva a mandar `/my-payments`: falta la regla de prompt y el uso de `conEnlacesDePago` en la rama de `get_payment_methods` de `whatsapp-bot.service.ts`.
4. **Escalaciones con dueño y cierre de día.**
   - `revisarEscalacionesVencidas` (`whatsapp-bot.service.ts`) / `whatsapp-escalaciones.service.ts`: un segundo re-aviso al dueño de la escuela si la escalación sigue sin respuesta.
   - Resumen a las 21:00 con escalaciones y comprobantes escalados abiertos (`bff/src/jobs/whatsapp-resumen-diario.job.ts` hoy sale a las 07:00).
   - Contar los comprobantes escalados como escalación visible en el buzón (`whatsapp-buzon.ts`).
   - Alinear `whatsapp_settings.business_hours` con la atención real (16–21 h), para que el bot prometa bien.
5. **Resolver la identidad del comprobante antes de escalar.**
   - En `bff/src/services/whatsapp-receipt-matching.service.ts`, cuando no hay ficha («sin_familia», «familia_sin_cuenta»), preguntar con botones «¿De qué deportista es este pago?». Buscar por el nombre del pagador del OCR (`ocr_origin_name`) y por la leyenda del mensaje.
   - Para «sin_pendientes», confirmar si el pago ya estaba aprobado y decirlo, en vez de escalar.
   - Para «varios_cobros», ofrecer botones con los cobros. Cubriría hasta 34 de los 43 escalados.
   - Aparte: investigar por qué el bot no respondió el 04 y 05-oct (registro de `ai_enabled`/`mode`, kill-switch de la cola `whatsapp-queue.job.ts`).

## Limitaciones

- La parte B empieza el 02-oct (no hay mensajes antes). Los ecos humanos se identifican por heurística: un mensaje de difusión de la dueña enviado a menos de 3 contactos podría contarse como respuesta.
- «Abierto» viene de `open_count` (resolver de `/p/`), que también cuenta previsualizaciones de enlaces de clientes de correo. La tasa real de apertura humana puede ser menor.
- Atribución al bot = el pago quedó ligado a un comprobante procesado por la cola de WhatsApp (`result_ref_id`). No mide si el bot convenció a alguien de pagar.
