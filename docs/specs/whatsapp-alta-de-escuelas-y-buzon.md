# Alta de escuelas en WhatsApp + buzón de conversaciones

**Estado:** propuesta, sin implementar. Plan antes de código.
**Fecha:** 2026-09-14
**Depende de:** App Review aprobado el 2026-09-14 (`whatsapp_business_messaging`,
`whatsapp_business_management`) y Tech Provider verificado el 2026-09-09.

---

## 1. El problema

Hoy el canal de WhatsApp funciona contra **un solo número: el de prueba de
Meta** (`+1 555-659-2322`), insertado a mano en la base. No existe forma de que
una escuela conecte el suyo, y el número de prueba solo entrega mensajes a
destinatarios pre-registrados (error `#131030` con cualquier otro). Es decir:
el canal está construido y validado, pero **no puede atender a una familia
real**.

Y hay un segundo problema, menos visible y más grave: **la escuela no tiene
dónde leer ni responder**. La pantalla de WhatsApp tiene cuatro pestañas
—Resumen, Plantillas, Bandeja, Configuración— y ninguna muestra
conversaciones. La "Bandeja" lista comprobantes que fallaron, no chats.

Consecuencias medidas el 2026-09-14:

- **1 conversación escalada** (`whatsapp_conversations.status = 'open'`) que el
  bot pasó a un humano y que **nadie puede ver**.
- El **modo asistido está roto de hecho**: el bot escribe su respuesta en
  `whatsapp_message_drafts` y no la envía, esperando aprobación. Ninguna
  pantalla lee esa tabla — verificado. Si una escuela activa ese modo, el padre
  deja de recibir respuestas **en silencio**.

---

## 2. Decisiones de producto

Resueltas. No se re-abren durante la implementación.

**D1 — Hay DOS caminos de alta, y Dynasty va por el manual.**
*(corregido el 2026-09-14: Dynasty tiene un solo número, y es el personal)*

| La escuela… | Camino | Quién paga los mensajes |
|---|---|---|
| Quiere seguir usando su número desde el celular | Embedded Signup + Coexistence | Ella, con su tarjeta |
| No tiene número aparte, o acepta uno nuevo | **Manual**: el número entra al WABA de SportMaps | **SportMaps**, y le factura |

**Dynasty va por el manual, con una línea nueva.** La razón no es la tarjeta: es
que su único número es el personal, y conectarlo haría que el bot le respondiera
a *todos* sus contactos. Hoy, a quien no reconoce, el bot le pide un correo para
identificarse — o sea que su mamá recibiría un pedido de identificación. Eso
descarta el número personal, y con un número nuevo no hay nada que preservar:
Coexistence deja de hacer falta para ella.

Consecuencia: **Dynasty no depende de F0–F4.** Se conecta con
`scripts/wa-conectar-escuela.ts`. El Embedded Signup sigue siendo necesario
para las escuelas que sí quieran conservar su número.

**D2 — El modo asistido queda apagado hasta que exista el buzón.**
Hoy produce silencio. Mientras no haya pantalla de aprobación, `mode` solo
admite `auto`, y la UI no ofrece la otra opción.

**D3 — El buzón entra en este spec, no en uno posterior.**
Coexistence exige suscribirse a `history`, `smb_app_state_sync` y
`smb_message_echoes`. Esos son exactamente los datos que alimentan un buzón de
conversaciones: construir uno sin el otro es hacer el mismo trabajo dos veces.

**D4 — NO hace falta un segundo App Review.** *(corregido el 2026-09-14)*
La suposición original era que el Embedded Signup exigía `business_management`.
La documentación dice otra cosa: ese permiso es requisito de los **Solution
Partners**, y solo para compartir línea de crédito con el cliente. Para un
**Tech Provider** el Embedded Signup necesita `whatsapp_business_management` y
`whatsapp_business_messaging` — los dos aprobados con acceso avanzado el
2026-09-14. La configuración creada en el panel (`1781832532844989`) pide
exactamente esos dos y ninguno más.

**Queda abierto, y es de negocio, no de código:** se decidió que *SportMaps
paga a Meta* los excedentes y le vende paquetes a la escuela. Con Embedded
Signup la escuela es dueña de su WABA, así que hay que resolver **qué método de
pago queda asociado**. Si la vía fuera compartir línea de crédito, eso sí es
territorio de Solution Partner y cambia los requisitos. Resolverlo antes de
facturarle a nadie.

**D4-bis — El modelo comercial: se vende la integración, no los mensajes.**
*(resuelto el 2026-09-14 contra la documentación)*
Meta lo impone: «si no eres Solution Partner, el cliente debe asociar un método
de pago a su WABA antes de poder enviar mensajes». Con Embedded Signup el WABA
es de la escuela, así que **Meta le cobra a ella directamente** y SportMaps no
intermedia plata de mensajería. Lo que se cobra es el addon de la integración
en el SaaS.

Consecuencia operativa: **la escuela necesita una tarjeta registrada aunque no
vaya a pagar nada** — los 1.000 mensajes de servicio gratis al mes no eximen
del requisito. Va en la pantalla de alta junto con D5.

**Lo que la escuela NO tiene que hacer** (verificado en la documentación): no
necesita App Review propio —ese fue de la app de SportMaps, una sola vez—, ni
Business Verification por adelantado, ni aprobación del nombre para mostrar
(eso solo aplica a los números de prueba `555`). Sí tiene que verificar su
número con un código, así que el alta exige tener el celular a mano.

**Techo de escuelas:** con Business Verification, App Review y Access
Verification completos —los tres lo están— el límite es de **200 clientes
nuevos**. No hay que pedir nada más hasta llegar ahí.

**D5 — Lo que Coexistence le quita a la escuela se le avisa ANTES de conectar.**
WhatsApp desactiva en ese número: mensajes temporales, ver una vez, ubicación
en tiempo real, y deja las **listas de difusión en solo lectura**. Los chats de
grupo no se sincronizan. Esa última pesa: varias escuelas le escriben a los
papás por difusión. Va en la pantalla de alta, antes del botón, no en un
tooltip.

---

## 3. Lo que ya existe

No se re-construye nada de esto.

| Pieza | Estado |
|---|---|
| Webhook multi-tenant, ruteo por `phone_number_id` | Construido y validado en vivo |
| Cola de comprobantes + worker (`wa_queue_claim`, lease, SKIP LOCKED) | Validado end-to-end |
| Bot con cadena de proveedores (`gemini → groq`) | En producción |
| Opt-out como estado, no como evento | Corregido 2026-09 |
| Plantillas: listar y crear desde la app | Aprobado por Meta |
| Eventos de cuenta de Meta (6 campos) | Construido; capturó 3 reclasificaciones en vivo |
| Medidor de consumo facturable | Corregido 2026-09-12 |
| Token de sistema permanente, cifrado por escuela | Vigente desde 2026-09-09 |

**Tablas** (`public`): `school_whatsapp_integrations`, `whatsapp_settings`,
`whatsapp_conversations`, `whatsapp_messages`, `whatsapp_message_drafts`,
`whatsapp_inbound_queue`, `whatsapp_identifications`, `whatsapp_optins`,
`whatsapp_account_events`, `whatsapp_blocked_numbers`.

---

## 4. Fases

Una rama por fase, con revisión entre cada una.

### F0 — Facebook Login for Business y el diálogo de alta

Configurar en el panel de Meta la *configuración* de Embedded Signup con la
función de Coexistence habilitada. En el frontend, el SDK y el botón que abre
el diálogo.

**Entregable:** el diálogo abre, la escuela autoriza, y el `code` llega al
frontend. No se persiste nada todavía.
**Criterio de aceptación:** se ve el `code` en consola con una cuenta de prueba
propia. Registro de sesión activado (Meta lo exige para Coexistence).

### F1 — El alta en el backend

Canjear el `code` por el token del negocio, resolver el `waba_id` y el
`phone_number_id`, registrar el número, suscribir la app a los webhooks de ese
WABA, y guardar la integración cifrada.

**Multi-tenant desde el primer commit.** La tabla ya soporta N escuelas; el
código no puede asumir `.limit(1).single()` en ninguna parte.

**Criterio de aceptación:** una segunda integración convive con la del número
de prueba, y el webhook rutea cada mensaje a la escuela correcta por
`phone_number_id`.

### F2 — Coexistence

Suscribir y procesar `history`, `smb_app_state_sync` y `smb_message_echoes`.
Sincronizar el historial dentro de la ventana de **24 horas** que da Meta —
pasada esa ventana hay que desconectar y repetir el alta. Los *echoes* (lo que
la escuela escribe desde su celular) se guardan en el mismo hilo, para que el
bot sepa que un humano ya respondió y no conteste encima.

**Criterio de aceptación:** un mensaje escrito desde el celular aparece en
`whatsapp_messages` con su dirección correcta, y el bot no duplica la
respuesta.

### F3 — Buzón de conversaciones

Pestaña nueva en la pantalla de WhatsApp: lista de conversaciones, hilo
completo, responder a mano, y aprobar o descartar los borradores del modo
asistido. Al existir esto, D2 se levanta y `assisted` vuelve a ser elegible.

**RLS línea por línea antes de aplicar.** Estas tablas traen teléfonos,
nombres de menores y montos. El alcance correcto es `user_staff_school_ids()`,
no `user_school_ids()` — que incluye padres y atletas.

**Criterio de aceptación:** la conversación escalada que hoy está invisible
aparece y se puede responder. Verificado con un `school_admin`, no solo con el
dueño — el arbol de menu de `school_admin` es una copia aparte del de `school`.

### F4 — La pantalla de alta

La pantalla donde la escuela se conecta sola, con el aviso de D5 antes del
botón. Ya no incluye un segundo App Review: ver D4.

---

## 5. Trampas conocidas

- **Ventana de 24 h para sincronizar el historial.** Si se pasa, hay que
  desconectar a la escuela y repetir. El alta tiene que completar la
  sincronización en la misma sesión, no diferirla a un cron.
- **Throughput fijo de 20 mensajes/segundo** en números con Coexistence. Muy
  por encima de lo que necesita una escuela, pero el envío masivo de cobranza
  tiene que respetarlo.
- **Versión mínima de la app:** WhatsApp Business 2.24.17. Hay que verificarlo
  con la escuela antes de conectar, no después.
- **Los grupos no se sincronizan.** La API no los soporta.
- **Dispositivos vinculados:** WhatsApp Web se desvincula al conectar y hay que
  volver a vincularlo. WhatsApp para Windows y WearOS no están soportados.
- **Error `131060`** es esperado en el primer mensaje; se resuelve solo en
  segundos. No tratarlo como fallo permanente.
- **Falta el callback de desautorización.** El panel de Meta tiene un campo
  (*URL de devolución de llamada de retirada de autorización*) que se dejó
  vacío a propósito: hoy no existe ese endpoint. Sin él, si una escuela le
  quita el permiso a SportMaps no nos enteramos — lo descubriríamos cuando las
  llamadas empiecen a fallar. Va en F1: recibir el ping y marcar la integración
  como inactiva, en vez de dejarla fallando en silencio.
- **Rotación del token por escuela.** Ya existe `wa-set-token.ts` para el
  número de prueba; el alta automática tiene que escribir por el mismo camino.

---

## 6. Qué NO entra

- Migrar números entre proveedores (otra escuela que ya use otro Tech Provider).
- Mensajería de grupo.
- Llamadas de WhatsApp.
- El buzón **no** es un CRM: sin asignación entre agentes, sin SLA, sin
  etiquetas. Leer, responder y aprobar. Nada más en esta vuelta.

---

## 7. Referencias

- [Onboard WhatsApp Business app users](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users)
- [Embedded Signup overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview/)
- `docs/specs/whatsapp-cola-de-comprobantes-plan.md`
- `docs/specs/whatsapp-optin-y-rastreo-de-plantillas.md`
