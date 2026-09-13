# Meta App Review — "Instrucciones de prueba para la web"

Campo por campo. La contraseña NO está acá: sale de
`C:\tmp\meta-reviewer-credenciales.txt`.

---

## 1. ¿Dónde podemos encontrar la aplicación?

```
https://stg.sportmaps.co/login
```

---

## 2. Instrucciones sobre cómo acceder a la aplicación

> Pega esto tal cual, y reemplaza `<PASSWORD>` por la clave del archivo.

```
SportMaps is a management platform for sports schools in Colombia: athletes,
enrollments and tuition payments. This app uses the WhatsApp Business Platform
so each school can serve families over WhatsApp and manage its own message
templates from inside the product.

FACEBOOK LOGIN IS NOT USED
The app authenticates its own users with email and password. Calls to the
WhatsApp Cloud API are made server-to-server with a System User access token,
stored encrypted per school. We do not call Meta Login endpoints and we do not
read Facebook profile data. We intend to add Facebook Login for Business later,
only to offer WhatsApp Embedded Signup so each school can connect its own phone
number. That flow is not built yet and is not part of this submission.

HOW TO LOG IN
URL:      https://stg.sportmaps.co/login
Email:    meta.reviewer@sportmaps.co
Password: <PASSWORD>

This account administers a test school ("Escuela Pruebas") and has no access to
any other school or to customer data.

TESTING whatsapp_business_management — can be tested live
See the attached 84-second video, which carries English captions.
1. Log in with the credentials above.
2. In the left menu open Comunicacion -> WhatsApp. The header shows the
   connected WhatsApp Business number and the monthly message usage.
3. Open the "Plantillas" tab. The list is fetched live from the WhatsApp
   Business Account through GET /{waba-id}/message_templates. Each row shows
   the template name, its category and its approval status.
4. Click "Nueva plantilla" and fill in the three fields:
   - Name: clase_cancelada_2
   - Body: Hola {{1}}, la clase de {{2}} del {{3}} a las {{4}} fue cancelada
     por {{5}}. Te avisamos apenas se reprograme.
     ("Hi {{1}}, the {{2}} class on {{3}} at {{4}} was cancelled due to {{5}}.
     We will let you know as soon as it is rescheduled.")
   - Variable examples, which Meta requires to review the template.
5. Click "Enviar a Meta para aprobacion". This calls
   POST /{waba-id}/message_templates.
6. The new template appears at the top of the list with status PENDING.

TESTING whatsapp_business_messaging — demonstrated in the video
The number connected to this test account is a Meta-provided test number
(+1 555-659-2322). Test numbers only deliver messages to recipients that have
been pre-registered, so an inbound message from an arbitrary phone will not
receive a reply and fails with error #131030. This is a platform restriction on
test numbers, not a defect in the application.

The flow is therefore demonstrated in the attached video, recorded against a
pre-registered recipient: a parent asks about pending tuition, the app replies
inside the 24-hour service window, the parent sends a photo of a payment
receipt, the app downloads it, extracts the amount and reference number, and
the school sees the payment waiting for approval.

If you would prefer to test this live, tell us which phone number to allow-list
and we will add it.

NOTE ON LANGUAGE
The product interface is in Spanish. Both videos carry English captions
describing each step.
```

---

## 3. ¿Está integrado el inicio de sesión con Facebook en esta plataforma?

**No**

---

## 4. Códigos de acceso o credenciales de test (pago/suscripción)

```
No payment or subscription is required to access the functionality under
review. Test credentials are provided in the access instructions above:

Email:    meta.reviewer@sportmaps.co
Password: <PASSWORD>
```

---

## 5. Códigos de regalo para descargar la aplicación

```
Not applicable. This is a web application; no purchase is required to access it.
```

---

## 6. Restricciones por ubicación / bloqueo geográfico

```
None. The application is accessible worldwide and no feature under review is
geo-restricted.
```

---

## Nota interna (NO pegar en Meta)

**`public_profile` y la respuesta "No" a Facebook Login se contradicen.**
`public_profile` es un permiso de Facebook Login, y la app no lo usa. Si el
formulario permite quitarlo de la solicitud, quitarlo — es el mismo criterio
con el que se sacaron `whatsapp_business_manage_events` y `business_management`:
no se pide lo que no se puede demostrar. Si Meta no deja quitarlo, el párrafo
"FACEBOOK LOGIN IS NOT USED" ya explica por qué aparece.

**Usar un nombre de plantilla nuevo (`clase_cancelada_2`).** `clase_cancelada`
ya existe en la cuenta desde la grabación del video; si el revisor intenta
crearla otra vez, falla por nombre duplicado.
