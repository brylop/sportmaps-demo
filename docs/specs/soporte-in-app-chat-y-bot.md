# Spec — Soporte in-app: botón, chat estilo Nu y bot de autogestión

**Estado:** propuesta, sin código
**Hermana de:** [`consola-de-soporte-super-admin.md`](./consola-de-soporte-super-admin.md) — son dos mitades de lo mismo (ver §3)
**Origen:** incidente 2026-08-05 (Dynasty) + pedido de reusar el chat de la landing

---

## 1. Hallazgo principal: el bot ya está construido

No hay que hacer un bot. Hay que darle **un canal nuevo** a uno que ya funciona.

| Pieza | Dónde | Estado |
|---|---|---|
| LLM con tool-calling y fallback de proveedor | `bff/src/services/llm.service.ts` | ✅ funciona |
| Orquestador: identificar → intent → tool → redactar → entregar | `bff/src/services/whatsapp-bot.service.ts` | ✅ funciona |
| Regla de cero alucinaciones | mismo archivo, decisión #6 | ✅ funciona |
| Modo `assisted` (borrador que un humano aprueba) vs `auto` | `whatsapp_settings.mode` | ✅ funciona |
| FAB con anillos de pulso + modal de chat + parser SSE de streaming | landing: `ChatBotButton.tsx`, `ChatBotModal.tsx` | ✅ portable |
| Corpus de ayuda (~2.350 líneas, 9 artículos) | landing: `lib/help-articles.ts` | ✅ portable |

### Lo que NO se reusa, y por qué

El chat de la landing sirve para vender, no para dar soporte. Cuatro razones concretas:

1. **`LOVABLE_API_KEY` → `ai.gateway.lovable.dev`.** Está atado a la plataforma Lovable y a sus créditos: la propia función ya maneja el `402` con *"Servicio temporalmente no disponible"*. No es base para producción, y el BFF ya tiene su propia abstracción de LLM con fallback.
2. **Cero persistencia.** Los mensajes viven en `useState`. Se cierra el modal y la conversación desaparece. Es exactamente lo contrario de "que me llegue y se pueda gestionar".
3. **Cero identidad.** Se autentica con la publishable key, así que el bot no sabe con quién habla. Sin eso no hay autogestión posible: no puede decirte *tu* cobro ni *tu* inscripción.
4. **Cero handoff.** Es bot puro con una salida a WhatsApp. Nadie recibe nada.

También hay **datos desactualizados** en su system prompt que no deben migrar: el WhatsApp `+57 312 846 3555` (el sitio publica `+57 320 268 3539`) y el rango de precios `$29.000–$149.000`, que no corresponde al pricing vigente de la landing.

**Conclusión:** se porta la **carcasa de UI** (FAB, burbujas, parser SSE) y el **corpus de ayuda**. El cerebro es el del BFF. La Edge Function `support-chat` se deja morir.

---

## 2. La ventaja que el canal in-app regala

En WhatsApp, `handleIdentification()` tiene que hacer un baile de OTP por correo porque un número de teléfono no es una identidad. **In-app eso desaparece:** el usuario ya viene con un JWT.

Se elimina el paso más frágil y más riesgoso del bot, y `parent_id` / `profile_id` sale gratis y verificado. El bot puede consultar datos sensibles desde el primer mensaje sin ceremonia.

---

## 3. Por qué esta spec y la de la consola son una sola cosa

El endpoint de diagnóstico de la consola (F0: `GET /admin/support/user-state`) es **la misma información** que el bot necesita para autogestionar. Se construye una vez y sirve a tres consumidores:

```
                 ┌─ panel del super_admin  (F0 de la consola)
user-state ──────┼─ contexto del bot       (tool get_my_state)
                 └─ autoservicio del user  ("¿por qué no puedo entrar?")
```

Por eso **F0 de la consola es prerrequisito de este módulo**, no una fase paralela. Y por eso el ticket que llega al super_admin debe abrirse **con el panel de diagnóstico embebido**: el humano ve el estado de la cuenta en la misma pantalla donde lee el reclamo.

Si el incidente de Dynasty hubiera pasado con esto en pie, el bot habría respondido: *"tu cuenta está activa en Coliseo Dynasty con el PLAN PRO; no necesitas crear otra"* — y no se habría escalado nada.

---

## 4. Modelo de datos

```
support_tickets
  id, requester_id → profiles(id)
  audience         ('sportmaps'|'school')  -- QUIÉN atiende. Ver §4.1
  school_id        → schools(id), nullable -- obligatorio si audience='school'
  subject, status  ('open'|'bot_handled'|'waiting_human'|'waiting_user'|'resolved'|'closed')
  channel          ('in_app'|'whatsapp'|'email')   -- canal de ORIGEN, no partición
  whatsapp_conversation_id → whatsapp_conversations(id), nullable  -- puente para S4
  assignee_id      → profiles(id)   -- hoy el super_admin
  category         ('acceso'|'cobros'|'inscripcion'|'datos'|'otro')
  priority, first_response_at, resolved_at, created_at, updated_at

support_messages
  id, ticket_id → support_tickets(id)
  author_type    ('user'|'bot'|'agent')
  author_id      → profiles(id)  (null si bot)
  body, attachments jsonb
  internal_note  boolean   -- notas que el usuario NO ve
  created_at
```

### 4.1 El hilo se identifica por (persona, destinatario) — no solo por persona

S4 dice *"un hilo, todos los canales"*. Tomado al pie de la letra **choca con §6**: in-app va a
soporte de SportMaps y WhatsApp va a la escuela. Un solo hilo por persona haría que el reclamo
que un padre le manda a SportMaps y la conversación que tiene con su club caigan en el mismo
sitio, y lo lea quien no debe.

La unidad correcta es **(requester_id, audience)**:

```sql
-- Un solo hilo ABIERTO por persona y destinatario.
CREATE UNIQUE INDEX support_tickets_one_open_thread
  ON support_tickets (requester_id, audience, COALESCE(school_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status NOT IN ('resolved', 'closed');
```

En v1 **solo se crean tickets con `audience='sportmaps'`**. `audience='school'` queda escrito en
el CHECK pero sin productor: es el gancho para que delegar al `school_admin` sea agregar policies,
no migrar datos. `whatsapp_conversation_id` nace nullable y sin usar, y es el puente por el que
S4 va a colgar las conversaciones de WhatsApp sin tocar el esquema.

**Convenciones del repo que aplican** (`CLAUDE.md`): estados como `text + CHECK`, **no** `CREATE TYPE`; FKs a `public.profiles(id)`; toda función nueva con `SET search_path = pg_catalog, public, pg_temp` y `GRANT EXECUTE` explícito; migración creada con `npm run migrations:new`.

**RLS:**
- El solicitante ve **sus** tickets y los mensajes con `internal_note = false`.
- El `super_admin` ve todo.
- La policy sobre `support_messages` **no** hace `SELECT FROM support_messages` en su `USING` — resuelve la pertenencia con una función `SECURITY DEFINER` sobre `support_tickets`.
- Ojo con el patrón ya documentado de *miembro ≠ staff*: no reusar helpers que traten al solicitante como personal de la escuela.

---

## 5. El chat estilo Nu

Lo que hace que el de Nubank se sienta bien, traducido a requisitos:

1. **Un solo hilo persistente.** Se abre y está la historia completa, no un chat en blanco. Es la diferencia central contra el widget de la landing.
2. **El bot arranca con contexto,** no con un menú. Primer turno: llama `get_my_state` y saluda sabiendo quién eres y qué tienes pendiente.
3. **El humano entra en el mismo hilo.** Sin "te contactaremos por correo". El super_admin escribe y aparece ahí, con su nombre y avatar.
4. **Estado siempre visible.** Un chip: *SportBot* / *Esperando a soporte* / *Resuelto*. La ansiedad en soporte viene de no saber si alguien leyó.
5. **Acciones dentro de la burbuja.** El bot no explica cómo reenviar el enlace: pone el botón.

### Tools del bot

Se declaran igual que las de WhatsApp (`TOOLS: LlmTool[]`) y el BFF las ejecuta:

| Tool | Qué hace | Riesgo |
|---|---|---|
| `get_my_state` | El diagnóstico F0 acotado al propio usuario: acceso, inscripción, escuela, invitación | Solo lectura |
| `get_payment_status` | **Ya existe** (`wa_get_payment_status`) | Solo lectura |
| `search_help_articles` | Corpus portado de la landing | Solo lectura |
| `resend_my_access_link` | Se manda el enlace a sí mismo, a su correo verificado | Bajo — requiere rate limit |
| `escalate_to_human` | **Ya existe.** Pasa a `waiting_human` y notifica al super_admin | — |

**Nunca como tool:** contraseñas temporales, reabrir invitaciones, fusionar identidades, tocar cobros. Eso vive en la consola, detrás de `requireRole('super_admin')`, con motivo obligatorio y auditoría.

**La regla de oro se hereda literal:** cero respuestas con datos sin una tool exitosa. Si la tool falla, el bot escala; jamás improvisa. Es la línea que separa "asistente útil" de "asistente que le dice a un padre que su hijo está inscrito cuando no lo está".

---

## 6. Enrutamiento al super_admin

**DECIDIDO:** el destinatario es `spoortmaps+admin@gmail.com` (*Administrador Sistema*, `bcb88976-5998-440f-ba9b-803571bfb46f`), que ya es el único `super_admin` en la base. **No hace falta migración de roles.** `spiritfontibon@gmail.com` y `demo.admin@sportmaps.co` siguen como `admin` y no reciben tickets.

**DECIDIDO:** en esta primera versión **todos los tickets van a soporte de SportMaps**. El `school_admin` no atiende a sus propias familias. Consecuencias que hay que asumir a conciencia:

- La RLS de S0 es chica: solicitante ve lo suyo, `super_admin` ve todo. Nada de acotar por `school_id` ni capa de enrutamiento. Eso es lo que permite arrancar S0 ya.
- **No escala solo:** cada reclamo de cobro de cada club pasa por una sola persona. Si el volumen crece, el desbloqueo es delegar al `school_admin`, y por eso `support_tickets` ya nace con `school_id` — para que ese cambio sea agregar policies, no migrar datos.

**Aun así, enrutar por rol y no por UUID.** El default es "sin asignar → visible para todo `super_admin`", y quien lo toma se autoasigna. Un `assignee_id` hardcodeado se rompe el día que entre alguien más a soporte.

Notificación de ticket nuevo: reusar el **Despachador Unificado de Notificaciones** (ya construido y validado en dev) — push web + nativo, con correo como respaldo.

---

## 7. Fases

| Fase | Alcance | Depende de |
|---|---|---|
| **S0** | Tablas + RLS + FAB portado + hilo persistente **sin bot**: el usuario escribe, llega al super_admin, este responde en el hilo | F0 de la consola |
| **S1** | Bot con las 3 tools de solo lectura (`get_my_state`, `get_payment_status`, `search_help_articles`) reusando `chatWithTools()` | S0 |
| **S2** | Bandeja de tickets para el super_admin con el **panel de diagnóstico embebido** + notas internas + notificación push | S0 + F0 |
| **S3** | Acciones en burbuja: `resend_my_access_link` y los atajos seguros de F1 | S1 + F1 |
| **S4** | Un hilo, todos los canales: unificar WhatsApp e in-app sobre `support_tickets` (el bot de WA pasa a escribir aquí) | S1 |
| **S5** | Métricas: primera respuesta, resolución, % resuelto por bot, categorías más frecuentes → alimenta F4 de la consola | S2 |

**S0 ya entrega valor sin una línea de LLM:** un canal de soporte real que hoy no existe (hoy la única vía es WhatsApp personal). El bot es una optimización encima, no el producto.

---

## 8. Riesgos

- **El bot afirmando cosas falsas sobre dinero o menores.** Mitigación: la regla de cero alucinaciones ya implementada, más `assisted` para los primeros días (el super_admin aprueba borradores antes de que salgan).
- **Costo de LLM sin techo.** Rate limit por usuario y por día, y tope global. El `402` de Lovable es el precedente de qué pasa cuando no hay techo.
- **El chat se vuelve un canal de reclamos de cobro que nadie atiende.** Si no hay quién responda, es peor que no tenerlo: promete atención y no la da. De ahí que S0 (humano) vaya **antes** que S1 (bot), y no al revés.
- **Fuga entre escuelas.** Un ticket de un padre de Dynasty no puede ser visible para el admin de otro club. RLS por `requester_id` y `school_id`, revisada línea por línea antes de aplicar.

---

## 9. Decisiones

### Resueltas (2026-08-05)

1. **Destinatario:** `spoortmaps+admin@gmail.com`, el `super_admin` existente. Sin migración de roles. → §6
2. **Alcance:** solo soporte de SportMaps; el `school_admin` no atiende a sus familias en v1. `support_tickets` igual nace con `school_id` para que delegar después sea agregar policies, no migrar datos. → §6

3. **Modo del bot: `auto` para solo-lectura, `assisted` obligatorio para el resto.** Las tres tools
   de S1 (`get_my_state`, `get_payment_status`, `search_help_articles`) no escriben nada, así que
   salen sin aprobación y el chat responde de inmediato. Cualquier tool que toque dinero o
   inscripciones (S3 en adelante) exige que un humano apruebe el borrador. Con **un solo**
   destinatario, `assisted` total sería un cuello de botella que rompe la promesa de respuesta
   rápida — y un canal que promete atención y no la da es peor que no tenerlo (§8).
   Se mantiene un interruptor global tipo `whatsapp_settings.ai_enabled` para apagar el bot entero.
4. **S4 se compromete, pero por (persona, destinatario), no por persona.** `support_tickets` nace
   con `audience`, `school_id` nullable y `whatsapp_conversation_id` desde S0. → §4.1

### Pendientes

*(ninguna abierta)*
