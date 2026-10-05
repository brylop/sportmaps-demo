# Cierre de seguridad IA/pagos — plan (2026-10-05)

Lo que ya quedó **cerrado y aplicado/commiteado** está en
`auditoria-seguridad-2026-08-14.md` (adendas del 2026-10-05): RPC sin gate +
invariante I7, authz del BFF (SEG-26), fuga de cuentas en `/extract-receipt`, y
**destino obligatorio para verde** (destino ausente → amarillo; el match por
máscara de 4 dígitos sigue valiendo, porque hay escuelas cuyo único dato de la
cuenta son los últimos dígitos).

Este documento es el **plan** de las cuatro piezas que el usuario pidió cerrar
pero que tocan flujo vivo (pagos / WhatsApp) y necesitan medición o decisión
antes de escribir código. No se tocó código de estas cuatro todavía.

---

## 1. `amount` del INSERT lo pone el cliente

**Radio medido (2026-10-05):**
- El trigger `fn_guard_payments_client` valida en el INSERT la **escuela** y el
  **status** (`pending`/`awaiting_approval`), y en el UPDATE sí bloquea `amount`.
  Pero **en el INSERT no valida `amount`**: el navegador lo pone libre.
- Caminos desde el cliente con monto del cliente: `PaymentCheckoutModal.tsx:426`,
  `:683`, `:848`; `ParentCheckoutPage.tsx:417`, `:422`.
  (`RegisterCashPaymentModal.tsx:411` es **staff** registrando en caja → pasa el
  bypass de staff del trigger, no es vector.)

**Vector:** un acudiente inserta un cobro en `awaiting_approval` con `amount`
bajo (p.ej. $1) y sube un comprobante por ese mismo monto. Para conceptos de
monto fijo, el `expectedAmount` del veredicto sale de ese mismo `amount` que puso
el cliente, así que `MONTO_DIFIERE` se compara contra un valor que el atacante
controla: el comprobante "cuadra" y puede auto-aprobarse por menos de lo debido.

**Antes de escribir — medir (no romper lo legítimo):**
- Contar los INSERT no-staff de los últimos 60 días cuyo `amount` **no** coincide
  con la tarifa canónica del cargo. Los abonos y los montos variables (inscripción
  con descuento, mensualidad prorrateada, banco de horas) son legítimamente
  distintos de la tarifa base → el fix no puede exigir igualdad ciega.
- Fuente de la tarifa: `monthly_fee` > plan > `teams.price_monthly`
  (ver memoria `project_athlete_fee_source`).

**Fix propuesto (a validar con el radio):** derivar/validar el monto en el
servidor. Dos opciones:
- (A) En `fn_guard_payments_client`, para INSERT no-staff de concepto fijo,
  rechazar si `NEW.amount` difiere de la tarifa canónica del cargo. Toca el
  trigger que gobierna **todos** los INSERT de pagos → medir radio primero.
- (B) Mover la creación del cobro del cliente a una RPC `SECURITY DEFINER` que
  calcule el monto server-side (como ya se hizo con `process_enrollment_checkout`
  en SEG-26), y revocar el INSERT directo de `payments` desde el cliente para esos
  caminos. Más limpio, más trabajo de frontend.

---

## 2. OTP en el bot de WhatsApp (solo al revincular a otro acudiente)

**Hallazgo:** `wa_identify_by_phone` identifica al acudiente por `profiles.phone`
(últimos 10 dígitos) + hijo activo en la escuela, y **revincula automáticamente**
`whatsapp_conversations.parent_id` cuando el número apunta a otro acudiente
(`whatsapp-bot.service.ts:455-480`; hoy solo **avisa**, no exige nada). Vector:
número reasignado / SIM-swap → el nuevo dueño del número recibe estado de pagos,
montos, conceptos y nombres de atletas de la familia anterior.

**Ya existe infraestructura parcial de OTP:** la tabla `whatsapp_identifications`
tiene `email`, `otp_hash`, `otp_expires_at`, `attempts`, `verified_at`. **Primer
paso: auditar ese estado parcial** (¿quién lo creó, hay flujo de verificación ya
empezado?) antes de construir encima.

**Matiz de diseño crítico:** un OTP enviado por el **mismo WhatsApp** NO frena un
SIM-swap (quien tiene el número lo recibe). El OTP tiene que ir al **correo**
registrado del acudiente (`profiles.email`, que existe), o escalar a staff.

**Plan (alcance acotado a la revinculación):**
1. Auditar la infra `whatsapp_identifications`.
2. En `wa_identify_by_phone`: cuando el número apunta a un acudiente **distinto**
   del vínculo actual, NO reescribir el vínculo ni entregar datos; generar OTP,
   guardar `otp_hash`/`otp_expires_at`, y mandarlo al **correo** del acudiente
   (Resend — ver `project_email_sending_resend`).
3. El bot pide el código; con `verified_at` se completa la revinculación.
4. Sin correo en el perfil → escalar al staff (no entregar datos).
5. Vigencia corta (p.ej. 10 min), tope de `attempts`, y registrar la
   revinculación para auditoría. No tocar el camino feliz (mismo número, mismo
   acudiente), que es la inmensa mayoría.

---

## 3. Rate-limit por número/escuela (denial-of-wallet)

**Hallazgo:** el worker (`whatsapp-queue.job.ts`, `LOTE=10`, `MAX_REINTENTOS=5`)
dispara OCR por cada imagen y la auto-aprobación re-extrae con 2 proveedores. No
hay tope de comprobantes por `wa_phone_number` ni por `school_id` por ventana de
tiempo. Un número en ráfaga quema tokens de pago a discreción.

**Antes de escribir — medir:** ubicar la tabla real de la cola de WhatsApp (no es
`wa_queue`; el job la toma por RPC) y contar comprobantes/mensajes por número y
por día para calibrar el umbral sin cortar a familias legítimas.

**Plan:** tope por `wa_phone_number` y por `school_id` por ventana (p.ej. N
imágenes/hora), evaluado **antes** de llamar al OCR; al exceder, responder
"demasiados intentos, intenta más tarde" sin llamar al modelo. Contar los
reintentos de OCR aparte del lease y no re-OCR en cada vuelta si el fallo es
permanente. Tomar la IP real de `cf-connecting-ip` para cualquier límite por IP.

---

## 4. auto_approve de comprobantes — plan para cruzar contra DKIM/webhook

**Estado:** la decisión de aprobar NO la toma el LLM — la toman reglas
deterministas (`receipt-verdict.ts`) + el trigger `trg_zz_guard_payments_client`
+ re-extracción con dos proveedores (`receipt-approval.service.ts`). El residual
es que una **imagen falsa bien hecha** puede cuadrar monto+referencia+destino y
auto-aprobarse (el PNG falso de Nequi que pasó 9 controles,
`project_notificaciones_banco_por_correo_dkim`).

**Plan (dejarlo prendido, sumar una confirmación real del dinero):**
- Conectar el parser de correos del banco (`banco-correo-parser.service.ts`, hoy
  sin webhook) con **verificación DKIM** del remitente del banco, y exigir que
  `auto_approve_payment` cruce el comprobante contra un movimiento real
  confirmado por ese correo (o por el webhook de la pasarela cuando aplique)
  antes de aprobar en firme.
- Mientras no exista ese cruce, `auto_approve` sigue siendo la pieza de mayor
  riesgo residual; el gate determinista lo contiene pero no lo elimina.

---

## Orden sugerido

1. **Rate-limit** (3) — el de menor riesgo de romper algo; cierra el gasto abierto.
2. **amount** (1) — medir radio, luego fix B (RPC server-side) por concepto.
3. **OTP revinculación** (2) — auditar la infra parcial, OTP por correo.
4. **auto_approve/DKIM** (4) — el más grande; cierra el residual de fondo.
