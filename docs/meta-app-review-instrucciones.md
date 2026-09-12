# Meta App Review — texto para pegar

Para el envío de `whatsapp_business_messaging` y `whatsapp_business_management`.
Va en inglés: los revisores de Meta leen inglés y la interfaz está en español.

---

## whatsapp_business_management

### How the app uses this permission

SportMaps is a management platform for sports schools in Colombia. Schools use
it to manage athletes, enrollments and tuition payments.

We use `whatsapp_business_management` so each school can manage the message
templates of its own WhatsApp Business Account from inside SportMaps, without
leaving the product to go to Business Manager. Templates are transactional
notifications about tuition: payment due dates, payment confirmations, and
rejected payment receipts.

We also subscribe to account webhooks so the school learns when Meta disables
or recategorizes one of its templates. This matters because a disabled
template silently stops the school's billing notifications, and a template
recategorized from UTILITY to MARKETING changes both the cost and the consent
required.

### Graph API endpoints used

- `GET /{waba-id}/message_templates` — list the school's templates
- `POST /{waba-id}/message_templates` — create a template
- Webhook fields: `message_template_status_update`,
  `message_template_quality_update`, `template_category_update`,
  `phone_number_quality_update`, `account_update`,
  `business_capability_update`

### Steps to reproduce (see attached video, 84 seconds)

1. Log in with the test credentials provided below.
2. In the left menu open **Comunicación → WhatsApp** (video 00:08).
   The header shows the connected WhatsApp Business number and the monthly
   message usage.
3. Open the **Plantillas** tab (video 00:18). The list is fetched live from
   the WhatsApp Business Account through `GET /message_templates` — each row
   shows the template name, its category and its approval status.
4. Click **Nueva plantilla** and fill in the three fields (video 00:28):
   - Name: `clase_cancelada`
   - Body: `Hola {{1}}, la clase de {{2}} del {{3}} a las {{4}} fue cancelada
     por {{5}}. Te avisamos apenas se reprograme.`
     (English: "Hi {{1}}, the {{2}} class on {{3}} at {{4}} was cancelled due
     to {{5}}. We will let you know as soon as it is rescheduled.")
   - Variable examples, required by Meta to review the template.
5. Click **Enviar a Meta para aprobación** (video 01:11). This calls
   `POST /message_templates`.
6. The new template appears at the top of the list with status **PENDING**
   and category **UTILITY** (video 01:18).

The video has English captions describing each step, since the product
interface is in Spanish.

---

## whatsapp_business_messaging

### How the app uses this permission

Parents of the school's athletes message the school's WhatsApp number to ask
what tuition they owe and to send proof of payment. SportMaps replies inside
the 24-hour customer service window, downloads the receipt the parent sent,
extracts the amount and reference number, and creates a payment record that
the school reviews and approves in the app.

Every reply is a response to a message the parent started. The app does not
send unsolicited messages: notifications outside the 24-hour window go through
approved templates only, and parents can opt out at any time by replying STOP,
which the app honours as a stored state, not as a single event.

### Graph API endpoints used

- `POST /{phone-number-id}/messages` — reply to the parent
- `GET /{media-id}` and the media download endpoint — retrieve the payment
  receipt the parent sent as an image or PDF
- Webhook fields: `messages` (incoming messages) and message `statuses`
  (delivery and pricing information)

### Steps to reproduce (see attached video)

1. From a WhatsApp account, send a message to the school's WhatsApp Business
   number asking about a pending payment.
2. The app replies with the athlete's pending tuition.
3. Send a photo of a payment receipt.
4. The app confirms it received the receipt, reads the amount and reference,
   and tells the parent the school will review it.
5. In SportMaps, the school sees the payment waiting for approval.

---

## Important note about the test phone number

The number connected to this test account is a **Meta-provided test number**
(`+1 555-659-2322`). Test numbers only deliver messages to recipients that
have been pre-registered in the app dashboard, so an inbound message from an
arbitrary phone will fail to receive a reply with error `#131030`. This is a
platform restriction on test numbers, not a defect in the application.

For this reason:

- **`whatsapp_business_management` can be tested live.** Logging in and
  creating a template calls the Graph API in real time against the connected
  WhatsApp Business Account. Please follow the steps above.
- **`whatsapp_business_messaging` is demonstrated in the attached video**,
  recorded against a pre-registered recipient. If you would prefer to test it
  live, tell us which phone number to allow-list and we will add it.

Schools will connect their own production numbers through Embedded Signup once
this app is approved. Until then, this is the only number available to us.

---

## Test credentials

- URL: `https://stg.sportmaps.co/login`
- Email: `meta.reviewer@sportmaps.co`
- Password: ver `C:	mp\meta-reviewer-credenciales.txt`

Cuenta creada solo para esta revision: admin de Escuela Pruebas, sin acceso a
ninguna otra escuela ni a datos de otros clientes.

---

## Nota interna (NO pegar en Meta)

Resuelto el 2026-09-12:

- **Ambiente:** staging. Las tres ramas quedaron iguales ese dia, y el BFF de
  staging responde 401 (no 404) en la ruta de WhatsApp, o sea que esta
  desplegada. Se eligio staging sobre dev porque dev se toca todo el dia y un
  despliegue a medias durante la revision es un rechazo.
- **Credenciales:** usuario `meta.reviewer@sportmaps.co`, perfil `school`,
  miembro `school_admin` activo de Escuela Pruebas, con
  `onboarding_completed = true` — sin eso el revisor cae en el onboarding y
  nunca llega a la pantalla.

Pendiente: borrar esa cuenta cuando Meta apruebe.
