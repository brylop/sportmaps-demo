# App Review de Meta — preparación completa

Objetivo: que la app `sportmaps` (`974986648677018`) quede aprobada como **Tech
Provider** con acceso avanzado a `whatsapp_business_messaging` y
`whatsapp_business_management`. Sin eso no hay Embedded Signup, y sin Embedded
Signup no hay **Coexistence** — que es lo que le permite a Dynasty conservar su app,
su catálogo y su historial mientras el bot trabaja en el mismo número.

Todo auditado contra la app real y el sitio en vivo el **2026-09-11**.

---

## 0. La corrección de orden que cambia el plan

La documentación de Meta pone el Embedded Signup en la **fase posterior** a la
aprobación, no antes. Y la evidencia que pide el review son **dos videos que ya
podemos grabar hoy**:

1. Un mensaje **creado, enviado y recibido** en un cliente de WhatsApp.
2. La **creación de una plantilla** de mensaje (o, como alternativa, los scripts de
   API o el WhatsApp Manager).

Las dos ya ocurrieron o están a un comando de distancia. **El App Review no está
bloqueado por construir Embedded Signup** — al revés: el Embedded Signup está
bloqueado por el App Review.

Orden real, entonces:

```
prerrequisitos de la app → webhook estable → registrar plantillas
   → grabar los 2 videos → pedir Advanced Access → ~24 h
   → Embedded Signup → Coexistence con Dynasty
```

Fuentes: [Become a Tech Provider](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers) ·
[App Review](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/app-review) ·
[Sample submission](https://developers.facebook.com/docs/whatsapp/solution-providers/app-review/sample-submission)

---

## 1. Auditoría: qué hay y qué falta

### Ya está (no tocar)

| | Evidencia |
|---|---|
| Verificación del negocio aprobada | verde en el panel de la app |
| Negocio propietario conectado | SportMaps administra la app |
| Token permanente de System User | `SportMaps WA Bot`, sin expiración, 3 permisos |
| Icono y nombre de la app | `icon_url` y `logo_url` presentes |
| **Páginas legales publicadas** | `/privacidad`, `/terminos` y `/tratamiento-datos` en `www.sportmaps.co`, las tres **HTTP 200** |
| Webhook funcionando | `GET` devuelve el challenge con token correcto, 403 con token malo; HMAC validado |
| **Mensaje enviado y recibido** | 2026-09-11: plantilla `hello_world` entregada + conversación completa del bot (opt-in, STOP) |
| Plantillas escritas | 8 JSON UTILITY en `bff/whatsapp-templates/` + su script de registro |

### Falta — configuración de la app (consola, minutos)

| Campo | Estado | Dónde |
|---|---|---|
| `privacy_policy_url` | **vacío** | Configuración → Básica. Poner `https://www.sportmaps.co/privacidad` |
| `terms_of_service_url` | **vacío** | Ídem. `https://www.sportmaps.co/terminos` |
| `category` | **vacío** | Ídem. Es requisito explícito del review |
| `app_domains` | **vacío** | Ídem. `sportmaps.co` |
| **Tech Provider onboarding** | sin verificar | Casos de uso → Personalizar → *Tech Provider onboarding*. Confirmar si está completo |

> ⚠️ **`contact_email` está mal: dice `spoortmaps@gmail.com`** (con doble "o").
> Confirmado el 2026-09-11: **el correcto es `contacto@sportmaps.co`**. Es la
> dirección por la que Meta contacta sobre la app, así que hay que corregirlo antes
> de enviar el review.

### Falta — nuestro trabajo

| | Por qué bloquea |
|---|---|
| **Commitear y desplegar el parche de `express-rate-limit`** | Hoy el BFF **no arranca** con el lockfile actual (`ERR_ERL_KEY_GEN_IPV6`, 4 limitadores). Sin deploy no hay webhook estable |
| **Mover el webhook de ngrok a un host estable** | Apunta a `kitty-raider-prevent.ngrok-free.dev`, un túnel a una laptop. Meta puede verificarlo, y un canal de producción no puede depender de una máquina encendida |
| **Registrar las 8 plantillas** | Es la evidencia del video 2, y de paso desbloquea la cobranza |

---

## 2. Textos de la solicitud (borrador para revisar)

Meta espera, por permiso, una descripción de qué hace la app y por qué necesita el
permiso. Se presentan en inglés.

### `whatsapp_business_management`

> SportMaps is a sports-club management platform used by schools, clubs and gyms in
> Latin America to manage athletes, enrollments, attendance and billing. We act as a
> Tech Provider: each client club connects its own WhatsApp Business Account through
> our onboarding flow, and we manage that account on the club's behalf.
>
> We need `whatsapp_business_management` to, for each client's WABA: register and
> subscribe the client's phone numbers to our webhook, create and submit message
> templates for their billing notifications, read template approval status, and read
> the phone-number configuration we administer for them. We never access WABAs
> belonging to businesses that have not explicitly connected them to us.

### `whatsapp_business_messaging`

> Parents of athletes enrolled in our client clubs contact the club over WhatsApp to
> ask about payments, their athlete's status and schedules. SportMaps answers those
> conversations on the club's behalf and lets club staff take over at any time.
>
> We need `whatsapp_business_messaging` to send and receive messages through our
> clients' phone numbers: replying within the 24-hour customer service window,
> sending approved utility templates for payment reminders and confirmations, and
> receiving inbound messages (including payment receipts sent as images) via webhook.
>
> Opt-in is explicit and recorded per phone number and per club: a contact only
> receives business-initiated template messages after affirmatively confirming it in
> the conversation, and we store the message ID of that confirmation as evidence.
> Any contact can opt out at any time by replying STOP, which we honor immediately.

El párrafo de opt-in no es adorno: es lo que la
[política de mensajería](https://business.whatsapp.com/policy) exige y lo que
construimos en la fase 1 (tabla `whatsapp_optins`, validado en vivo el 2026-09-11).

---

## 3. Guion de los dos videos

El screencast tiene que mostrar **la interfaz del negocio, no la del consumidor**.
Es el error más común de rechazo.

### Video 1 — mensaje creado, enviado y recibido

1. Panel de administración de SportMaps: la escuela con su integración de WhatsApp.
2. Se dispara un mensaje al padre (desde el panel o por el flujo del bot).
3. Se ve el mensaje **llegar** al WhatsApp del padre.
4. El padre responde y se ve la respuesta **entrando** al sistema.

El ciclo del 2026-09-11 sirve tal cual de guion: el padre escribe → el bot pide
consentimiento → responde `SÍ` → queda registrado → escribe `STOP` → se respeta la
baja. Muestra envío, recepción y cumplimiento de la política en una sola toma.

### Video 2 — creación de una plantilla

1. Se lanza el registro de una plantilla UTILITY (`register-templates.sh` o el
   WhatsApp Manager).
2. Se ve la respuesta de Meta con su `id` y estado `PENDING`.
3. Se ve la plantilla listada en el WABA.

**Grabar sobre el número de prueba**, no sobre el de Dynasty: el de Dynasty todavía
no está conectado y no hay que tocarlo hasta Coexistence.

---

## 4. Orden de ejecución

| # | Qué | Quién |
|---|---|---|
| 1 | Los 4 campos de la app + confirmar Tech Provider onboarding | tú, consola |
| 2 | Corregir el `contact_email` a `contacto@sportmaps.co` | tú, consola |
| 3 | Commitear y desplegar el BFF (incluye el parche que hoy impide arrancar) | yo |
| 4 | Repuntar el webhook al host desplegado | yo |
| 5 | Registrar las 8 plantillas | yo |
| 6 | Grabar los dos videos | los dos |
| 7 | Enviar Advanced Access de los 2 permisos con los textos de §2 | tú |
| 8 | Esperar (~24 h de promedio) | Meta |
| 9 | Embedded Signup con *session logging* | yo |
| 10 | Coexistence sobre el número de Dynasty | los dos + la escuela |

Los pasos 1 y 2 no dependen de nada. El 3 desbloquea el 4, el 4 y el 5 habilitan el
6, y el 7 cierra todo lo que está en nuestras manos.

---

## 5. Riesgos del review

| | Riesgo | Mitigación |
|---|---|---|
| AR-1 | Rechazo por grabar la interfaz del consumidor | §3: se graba el panel del negocio |
| AR-2 | Rechazo por webhook inalcanzable durante la revisión | paso 4: host estable antes de enviar |
| AR-3 | Faltan política de privacidad o categoría | paso 1, y las URLs ya existen y responden 200 |
| AR-4 | Dudas sobre el opt-in | el párrafo de §2 describe un mecanismo real, con evidencia por mensaje |
| AR-5 | **Coexistence pide "partner certificado"** | por confirmar si eso es este mismo review o un trámite adicional. **Preguntarlo antes de prometerle Coexistence a Dynasty** |
| AR-6 | Se despliega el BFF sin el parche y no levanta | el paso 3 es justamente eso; ya está escrito y con `tsc` limpio |

---

## 6. Fuentes

- Documentación de Meta citada en §0.
- App `974986648677018` consultada por Graph API el 2026-09-11 (campos `category`, `privacy_policy_url`, `terms_of_service_url`, `app_domains`, `icon_url`, `contact_email`).
- `https://www.sportmaps.co/{privacidad,terminos,tratamiento-datos}` — las tres 200.
- `docs/specs/whatsapp-optin-y-rastreo-de-plantillas.md` — el opt-in que se describe en §2, validado en vivo.
- `docs/specs/whatsapp-catalogo-de-respuestas.md` §0 — Coexistence y la decisión del número.
