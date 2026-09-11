# Spec — Catálogo de respuestas del bot de WhatsApp

Qué puede responder el bot, **con qué dato lo responde**, y qué contesta cuando no
lo sabe.

Prerrequisito de la **fase 2** del plan del canal. Sin esto, el bot sabe hablar de
pagos y nada más: poner a los padres de una escuela real frente a un bot que no
sabe a qué hora entrena su hijo es peor que no tener bot.

> Todo verificado contra la base viva el **2026-09-11**, con Dynasty
> (`2d509571-…`, 505 inscripciones activas) como escuela de referencia.
> Los pagos van aparte, en `whatsapp-pagos-en-el-chat.md`.

---

## 0. El bloqueador de la fase 2: el número no puede estar en dos lados

**Antes que cualquier catálogo.** El número de Dynasty, `+57 320 4298969`, es hoy
una cuenta **activa de WhatsApp Business App**, y la usan de verdad:

- perfil completo: dirección **CL. 12 BIS #71G-09** (Coliseo Dynasty), horarios de
  atención por día, descripción del club, web, correo
- **catálogo armado** con "Servicios", "Inscripción y mensualidad" y "Ubicación
  Coliseo Dynasty" (con carrito y *order request*)
- 100 elementos de media, 168 MB de historial
- cuenta vinculada a Instagram (@dynastyvolleyclub, 3.687 seguidores) y Facebook

**Corregido el 2026-09-11.** La primera versión de este spec decía que un número
vive en un solo lugar —app o Cloud API— y recomendaba número nuevo. **Es incorrecto:
existe Coexistence.**

### Coexistence — un número, las dos cosas, con historial

*Business app number onboarding* permite conectar la cuenta existente de WhatsApp
Business App a la Cloud API **conservando el número y usando las dos al mismo
tiempo**:

- Milena sigue respondiendo uno a uno desde su app, como siempre.
- **WhatsApp mantiene el historial sincronizado entre ambas**, y puede traer hasta
  **6 meses** de conversaciones si el negocio lo autoriza.
- Conserva catálogo, perfil, dirección y el vínculo con Instagram.

**Requisitos y límites:** se hace **únicamente por Embedded Signup con *session
logging*** (no a mano desde el Business Manager); partner certificado —lo que
probablemente implica el App Review pendiente—; webhooks funcionando; app de la
escuela en **2.24.17 o superior**; la sincronización debe completarse **dentro de
24 h** del onboarding. Techo de 20 mensajes/segundo, irrelevante a esta escala. Los
mensajes que salen por la API se cobran; los que ella manda desde la app son gratis.

Fuentes: [migrar un número existente](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started/migrate-existing-whatsapp-number-to-a-business-account/) ·
[onboarding de usuarios de la Business App](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users)

### Las tres opciones

| | Milena conserva | Cuándo se puede | Costo |
|---|---|---|---|
| **Coexistence** (recomendado para el piloto real) | app, catálogo, perfil **e historial** | cuando exista Embedded Signup | **invierte el orden del plan: fase 6 antes de la fase 2** |
| **Número nuevo** | todo lo suyo intacto | **hoy** | los padres ven dos contactos; el número del bot nace sin historial |
| Migrar borrando la cuenta de la app | **pierde la app en ese número y el historial** | hoy | descartado |

**Recomendación:** número nuevo como **banco de pruebas** para validar el bot esta
semana sin tocar la operación de la escuela, y **Coexistence como destino** para el
piloto real. Embedded Signup deja de ser "escalar a más escuelas" y pasa a ser el
requisito para no degradarle la herramienta a la primera escuela — y es el mismo
mecanismo que se reutiliza con cada cliente nuevo, así que no es trabajo desechable.

### Lo que el perfil de WhatsApp ya nos regala

Los datos que faltaban en SportMaps **existen, solo están en el otro lado**:

| Dato | En WhatsApp Business | En SportMaps |
|---|---|---|
| Dirección | CL. 12 BIS #71G-09 + mapa de cómo llegar | 🔴 no hay columna |
| Horarios de atención | lun-vie 15:00–22:00, sáb y dom 07:00–14:00 | 🔴 solo horas de sede (06:00–22:00) |
| Servicios | fisioterapia, psicología deportiva, nutricionista, preparación física, convenios, afiliación a la Liga de Bogotá | 🔴 no modelado |
| Precios de planes | 4 modalidades por días/semana | 🟢 **coinciden exactos** |
| Inscripción anual $170.000 | en el catálogo | ⚪ fuera de alcance por decisión de la escuela |

Los horarios del perfil (**15:00–22:00 de lunes a viernes**) son mucho más cercanos
a la realidad que los `available_hours` de la sede (06:00–22:00), y sirven para
responder "¿a qué hora los encuentro?". Siguen **sin ser** el horario de
entrenamiento de cada equipo.

> **La inscripción de $170.000 es deliberadamente externa.** Dynasty la cobra y la
> recibe por fuera de SportMaps. El sistema tiene dónde guardarla
> (`offering_plans.registration_fee`, hoy NULL en los 6 planes) y **no se configura
> porque la escuela no quiere**. Consecuencia para el bot: si preguntan por la
> inscripción, **no tiene el dato y no lo improvisa** — escala. Y jamás puede dar a
> entender que la mensualidad la incluye: son dos conceptos secuenciales distintos
> ([[project_inscripcion_once_then_mensualidad]]).

---

## 1. El semáforo: qué se puede responder HOY

| Lo que el padre pregunta | Dato que lo responde | Dynasty hoy |
|---|---|---|
| ¿Cuánto debo? ¿De qué mes? | `payments` (513 pendientes, todos con monto) | 🟢 **construido** |
| ¿Cómo pago? ¿A qué cuenta? | `school_settings.payment_accounts` (3 llaves Bre-B activas) | 🟡 dato sí, código no |
| ¿Ya me llegó el pago que hice? | `payments.receipt_verdict` + pipeline de comprobantes | 🟡 dato sí, código no |
| ¿Qué planes hay y cuántas clases traen? | `offerings` + `offering_plans` (6 planes: START 4, PRO 8, ELITE 12, DYNASTY 16, SENIORS 4 y 8) | 🟡 dato sí, código no |
| ¿En qué equipo está mi hijo? | `enrollments` + `teams` (11 equipos) | 🟡 dato sí, código no |
| **¿A qué hora entrena mi hijo?** | `teams.schedule` / `training_sessions` | 🔴 **NO HAY DATO** |
| **¿Dónde queda? ¿Cuál es la dirección?** | ninguna tabla la tiene | 🔴 **NO EXISTE LA COLUMNA** |
| **¿Puedo agendar una clase de prueba?** | `school_trial_class_settings` | 🔴 **sin configurar** |
| ¿Me dan un certificado / constancia? | `athlete_certificates` | 🔴 0 filas |
| ¿Cómo aviso que mi hijo no va? | `attendance_*` | 🟡 dato sí, código no |
| Quiero hablar con alguien | escalamiento a humano | 🟢 **construido** |

### 1.1 Los tres rojos, con su número

**Horarios de entrenamiento: no existen en ninguna parte.**
`teams.schedule` está en **NULL en los 11 equipos**. `training_sessions` tiene **0
filas** para Dynasty. `attendance_sessions` tiene 46 pero **ninguna futura**.
`report_team_schedule` no es un horario —es el día de envío de informes— y tiene 0
filas en toda la plataforma.

> ⚠️ **La trampa que hay que evitar.** Dynasty **sí** tiene horarios cargados, pero
> son los de su sede: `facilities.available_hours` del *Coliseo Dynasty Club*
> (lun-vie 06:00–22:00, sáb 07:00–20:00, dom 08:00–18:00). Eso es **cuándo abre el
> coliseo**, no cuándo entrena MINIVOLLEY BENJAMINES. Si el LLM ve ese dato cerca
> de la pregunta "¿a qué hora entrena mi hijo?", va a responder con él y va a estar
> mintiendo con seguridad absoluta. **Ese dato no entra en la respuesta de horario
> de equipo, ni siquiera como contexto.**

**Dirección: no hay dónde guardarla.** `school_settings.address` está en NULL,
`teams.location` está vacío en los 11, y **`facilities` no tiene columna de
dirección** (solo `name`, `type`, `capacity`, `available_hours`). No es que esté sin
llenar: no existe el campo. Es un gap de producto, no de datos.

**Clase de prueba: sin configurar.** 2 cupos en `school_trial_slots`, **0 filas en
`school_trial_class_settings`**, 0 reservas. El módulo existe y es self-service,
pero Dynasty no lo prendió.

---

## 2. La regla que evita el desastre

**El bot nunca improvisa un dato que no obtuvo de una herramienta.** Es la decisión
#6 del bloque, y con datos de menores no se negocia.

Cuando la respuesta no existe, hay tres salidas y ninguna es inventar:

| Situación | Qué hace el bot |
|---|---|
| La escuela **no cargó** el dato (horario) | lo dice sin rodeos y ofrece pasar con un humano: *"no tengo el horario de ese equipo cargado; te paso con alguien de la escuela"* |
| El dato **no aplica** (clase de prueba no configurada) | no menciona la opción. Nunca ofrecer algo que no se puede cumplir |
| La herramienta **falla** | escala, con mensaje neutro. Jamás un dato aproximado |

Y un límite de alcance: **sin identificación por OTP, el bot solo da información
pública** (planes, horarios generales de la sede). Nada de "tu hijo", "tu saldo" ni
"tu equipo" antes de verificar quién escribe. Es el riesgo R17 — que un número
ajeno pida datos de un menor.

---

## 3. Los intents, y cuáles vale la pena construir

Hoy hay **2 de 6** del plan original. Pero la lista del plan estaba hecha sin mirar
los datos, y con los datos a la vista el orden cambia.

### 3.1 Vale la pena ya (el dato existe)

| Intent | Fuente | Por qué |
|---|---|---|
| `get_payment_status` | `wa_get_payment_status` | ✅ ya está |
| `como_pago` | `payment_accounts` + monto del pago | 513 pendientes esperando; es la pregunta #1 |
| `get_athlete_info` | `enrollments` + `teams` + `children` | "¿en qué equipo está?", "¿está activo?" |
| `get_planes` | `offerings` + `offering_plans` | los 6 planes con sus clases/mes; sirve para vender, no solo para atender |
| `report_absence` | `attendance_*` | el padre avisa y queda registrado |
| `escalate_to_human` | — | ✅ ya está |

### 3.2 No construir todavía (responderían vacío)

| Intent | Por qué esperar |
|---|---|
| `get_athlete_schedule` | 0 sesiones, 0 horarios. Construirlo es construir un intent que siempre escala |
| `get_certificate_status` | 0 certificados emitidos en Dynasty |
| `agendar_clase_prueba` | módulo sin configurar en la escuela |

**Esto es lo importante del documento:** `get_athlete_schedule` era el intent
estrella del plan original y hoy **no tiene nada que responder**. Construirlo antes
de que la escuela cargue horarios es trabajo tirado.

---

## 4. Lo que Dynasty tiene que llenar (no es código)

Checklist para la reunión con la escuela, en orden de impacto:

- [ ] **Decidir el número** (§0): número nuevo para probar ya, y Coexistence para el
      piloto real (exige Embedded Signup antes). No es una decisión técnica: define
      si la escuela conserva su herramienta de trabajo.
- [ ] **Horario de cada equipo.** 11 equipos, todos con `schedule` en NULL, y
      `offering_plans.metadata.schedule` en `[]` en los 6 planes —que es justamente
      donde iría. Los planes ya dicen *cuántos* días (4/8/12/16 sesiones al mes);
      falta **cuáles** y a qué hora.
- [ ] **Copiar del perfil de WhatsApp a SportMaps** lo que ya tienen escrito allá:
      dirección, horarios de atención, servicios (§0).
- [ ] **Configurar la clase de prueba** si la quieren ofrecer por WhatsApp
      (`school_trial_class_settings` está vacío).
- [ ] **Decidir Wompi o solo Bre-B** (ver `whatsapp-pagos-en-el-chat.md` §1.2).
- [ ] Revisar el equipo *"MINIVOLLEY -BENJAMINES (DUPLICADO - NO USAR)"*, que está
      `status='inactive'` pero `active=true` y con 3 atletas dentro. Si un padre
      pregunta por su hijo, el bot puede nombrarle un equipo que dice "no usar".
- [ ] `price_monthly` está en 0 en 10 de los 11 equipos. No rompe nada hoy —el
      monto sale de `enrollments.monthly_fee`— pero es la tercera fuente de la
      cascada y conviene que no mienta.

Y uno nuestro, de producto: **no hay dónde guardar la dirección de una sede.**
Mientras no exista el campo, ninguna escuela puede responder "¿dónde queda?" por
ningún canal, no solo por WhatsApp.

---

## 5. Orden de construcción

1. `como_pago` — la pregunta #1 de 513 pendientes, y el dato ya está.
2. Comprobante por el chat (`whatsapp-pagos-en-el-chat.md`).
3. `get_athlete_info` + `get_planes` — baratos, el dato existe.
4. `report_absence`.
5. *(Cuando la escuela cargue horarios)* `get_athlete_schedule`.
6. *(Cuando la escuela configure el módulo)* `agendar_clase_prueba`.

Los pasos 1 a 4 no dependen de nada que Dynasty tenga que hacer. Los pasos 5 y 6
**sí**, y no vale la pena empezarlos antes.

---

## 6. Fuentes

- Base viva `luebjarufsiadojhvxgi`, 2026-09-11: `teams` (11 filas, `schedule` NULL),
  `training_sessions` (0), `attendance_sessions` (46, 0 futuras),
  `facilities` (1, con `available_hours` de sede), `school_trial_class_settings` (0),
  `athlete_certificates` (0), `offerings`/`offering_plans` (6),
  `school_settings.payment_accounts` (3 Bre-B), `payments` (513 pendientes).
- `docs/specs/whatsapp-pagos-en-el-chat.md` — las dos opciones de pago.
- `docs/specs/whatsapp-optin-y-rastreo-de-plantillas.md` — fase 1, validada en vivo el 2026-09-11.
