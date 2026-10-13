# Canal de WhatsApp de plataforma (número comercial de SportMaps)

**Estado:** spec + F1 + F2 construidos el 2026-10-09 (develop). Migración `canal_whatsapp_plataforma` **SIN aplicar**. Todo apagado por defecto (`PLATFORM_WA_ENABLED` sin definir, `PLATFORM_WA_TESTERS` vacío).
**Número:** +57 320 268 3539 (`573202683539`), el comercial oficial ([[project_sales_whatsapp_number]]).

## 1. Por qué

1. **La dueña no se entera.** De la foto del comprobante a la aprobación pasan p50 3,7 h y p90 49 h (Dynasty, 2026-10-08). Las escalaciones urgentes quedaron sin respuesta humana el 2026-10-06. Hoy los avisos salen por push (44 tokens FCM acumulados en la dueña de Dynasty, nadie sabe cuál suena), in-app y correo. Lo único que Milena mira de verdad es WhatsApp.
2. **El número de la escuela no sirve para avisarle a ella.** En Dynasty el número de la escuela (573204298969, Coexistence) **es** el WhatsApp de Milena: no puede escribirse a sí misma. Hace falta un número que no sea de ninguna escuela.
3. **Probar el bot hoy exige el número de una escuela.** Para ver cómo contesta el bot con la configuración real de Dynasty hay que escribirle al número de Dynasty, con todo lo que eso deja escrito (conversación en su buzón, borradores, leads, avisos a la dueña). Se quiere un chat de pruebas que use la configuración real **sin tocar nada de la escuela**.

## 2. Decisiones

| # | Decisión | Razón |
|---|---|---|
| D1 | El canal de plataforma **no** es una fila de `school_whatsapp_integrations`. Vive en una tabla singleton propia `platform_wa_canal`. | `school_whatsapp_integrations.school_id` es NOT NULL y ~40 consultas (buzón, métricas, cola, resumen, RLS de WA1) asumen que toda integración es de una escuela. Una fila con `school_id` nulo o una "escuela SportMaps" falsa haría aparecer el canal en el buzón, el resumen diario y las métricas de alguien. Tabla aparte = cero consultas existentes lo ven. |
| D2 | El webhook es el **mismo** endpoint (`POST /api/v1/webhooks/whatsapp`, misma app de Meta, mismo HMAC). El enrutamiento se decide por `phone_number_id`: si es el del canal de plataforma, va a `atenderEntrantePlataforma` y **nunca** a `resolveIntegration`. | Una sola app, un solo secreto; Meta manda todos los WABA suscritos a la misma URL. |
| D3 | El token del canal va **cifrado en la base** (`platform_wa_canal.access_token_encrypted`, AES-256-GCM con `WHATSAPP_TOKEN_ENC_KEY`), igual que el de cada escuela. Nunca en `.env`. Se carga con `bff/scripts/wa-plataforma.ts conectar`. | Misma regla que `wa-set-token.ts`. |
| D4 | **Consentimiento por número + escuela, probado por el propio número.** La suscripción se pide desde la app (queda `pendiente` con un código) y se activa SOLO cuando ese número escribe «ACTIVAR <código>» al número de SportMaps (Meta autentica el `from`). Atajo: «ACTIVAR» a secas activa las escuelas donde ese número es el teléfono del perfil de un owner/admin activo. | Una casilla en la web no prueba que el número sea de quien la marca (el mismo razonamiento de `whatsapp-activar-avisos.ts`). Mandarle avisos con datos de una escuela a un número equivocado es una fuga. |
| D5 | Se revalida en **cada envío** que el perfil siga siendo owner/admin activo de la escuela. | Quitarle el rol a alguien corta los avisos sin tener que acordarse de esta tabla. |
| D6 | Preferencias por tipo de aviso (6 booleanos) y **horario silencioso** por suscripción (22:00–07:00 por defecto, hora Colombia). En silencio no se envía ni se reserva: lo de la noche lo recoge el resumen de las 7:00. Opción `urgentes_en_silencio` (apagada) deja pasar solo escalaciones urgentes. | Ley 2300 no aplica (no es cobranza), pero sí el sentido común: la dueña también duerme. |
| D7 | **Idempotencia en la base**: `platform_wa_envios` con `UNIQUE (suscripcion_id, clave)`. Cada aviso tiene una clave determinística por evento (la misma que ya usan los avisos in-app). El BFF que logra el INSERT envía; los otros dos reciben 23505 y no hacen nada. | Los 3 BFF (dev/stg/prod) comparten la base y corren los mismos crons. |
| D8 | **Ventana de 24 h**: si el número escribió al canal en las últimas 24 h, sale texto libre con botón «Ver en la app» (`cta_url`); si no, plantilla UTILITY `es_CO` con botón URL dinámico. | Política de Meta. Utility en CO ≈ US$0,0008 por entregado; lo paga SportMaps (es su WABA). |
| D9 | **Nada se aprueba desde WhatsApp.** Los avisos solo llevan enlaces a la app. «Aprobar los verdes» se nombra como acción que existe *en la app*, nunca como botón de respuesta. | Aprobar mueve plata; necesita la sesión, la vista del comprobante y la auditoría de la app. Un botón de WhatsApp no autentica a la persona, solo al número. |
| D10 | Se **reutilizan los eventos existentes**: el canal es un destino más, enganchado al final de cada aviso que ya sale por push/in-app/correo. No hay crons nuevos ni lógica de cálculo duplicada. | Una sola verdad de qué se avisa y cuándo. |
| D11 | Informe de cartera por WhatsApp = **solo cifras + enlace** (familias en mora, total, comprobantes en revisión). Ni nombres ni teléfonos de familias. | El informe completo tiene datos de menores y deudas; WhatsApp no es un canal para eso. |
| D12 | **Desconocidos (ni dueña/admin con opt-in, ni tester): silencio por defecto.** El número es el comercial y en Coexistence el equipo de ventas lo sigue atendiendo desde la app de WhatsApp Business: una respuesta automática chocaría con la persona. Con `PLATFORM_WA_RESPUESTA_COMERCIAL=true` se manda UNA respuesta breve cada 30 días por número. De los desconocidos **no se guarda el texto**, solo metadatos. | No pisar a ventas; no acumular conversaciones privadas de prospectos en la base. |
| D13 | **Modo pruebas = simulación con cortafuegos.** El turno corre el MISMO pipeline (`debeAtender` → `runBotTurn` / `atenderDesconocido`) dentro de un contexto donde el cliente de Supabase **no puede escribir** en tablas reales (devuelve error `SIM00`), las RPC que escriben se bloquean (allowlist explícita de RPC `STABLE`, verificadas en `pg_proc.provolatile`; el resto devuelve `SIM00`), y no salen push, correo ni llamadas a Graph. Las tablas de la conversación (`whatsapp_conversations`, `whatsapp_messages`, `whatsapp_message_drafts`, `whatsapp_conversation_flows`, `whatsapp_settings`, `whatsapp_optins`, `whatsapp_identifications`) se sirven desde una **memoria virtual** por tester+escuela, persistida en `platform_wa_sesiones_prueba.estado`. | Lo que se prueba es el bot real con los datos reales de la escuela (horarios, precios, cortesía, medios de pago, grupos por edad). Bloquear en el cliente y no en cada camino del bot hace que un camino nuevo del bot también quede cubierto el día que se agregue. |
| D14 | `/como papa` solo acepta atletas **de prueba** (`children.is_demo = true` o escuela `is_demo = true`). | Un tester por WhatsApp no debe ver los pagos de una familia real. |
| D15 | Todas las tablas nuevas: RLS activado, **sin policies**, `REVOKE ALL` a `anon` y `authenticated`. Solo el BFF (service role) las toca. Estados con `text + CHECK`. FKs a `profiles(id)` y `schools(id)`. | Convenciones del repo; nada de esto lo lee el frontend directo. |

## 3. Flujos

### 3.1 Alta de la dueña (opt-in)

```
App → WhatsApp → Configuración → «Recibir avisos de SportMaps en mi WhatsApp»
  escribe su número → POST /api/v1/whatsapp/:schoolId/avisos-sportmaps
    → fila 'pendiente' (school, profile, contact_wa_id, codigo 6 car., vence 7 días)
    → la app muestra el botón «Confirmar desde mi WhatsApp» = wa.me/573202683539?text=… ACTIVAR <código>
Su teléfono envía el mensaje (Meta autentica el from)
  → webhook → canal de plataforma → «ACTIVAR <código>»
    → código vigente + from == contact_wa_id de la fila → 'activa', consentimiento_ref = wa_message_id
    → respuesta: «Listo, vas a recibir aquí los avisos de <escuela>…» (+ cómo pausar)
```

Atajo sin app: escribir «ACTIVAR» desde el número del perfil. Se buscan escuelas **habilitadas** donde ese número (últimos 10 dígitos, solo celular CO) sea el teléfono de un owner (`schools.owner_id`) o de un `school_members` activo con rol owner/admin/school_admin. Hasta 5 escuelas; si no hay ninguna, se le indica el camino de la app.

Baja: «DESACTIVAR», «PAUSAR», «STOP», «BAJA» → todas las suscripciones de ese número quedan `revocada`. Desde la app: botón «Dejar de recibir».

### 3.2 Avisos (F1)

| Tipo (`tipo`) | Evento existente | Gancho | Clave de idempotencia | Enlace |
|---|---|---|---|---|
| `comprobantes` | `receipt-review-alerts.job` («nuevo» agrupado / «recordatorio» >2 h) | tras reclamar la versión e insertar las notificaciones | `comprobantes:<school>:<tipo>:<new_cursor o last_reminder_at>` | `/payments-automation?tab=recurrent` |
| `escalacion` | `avisarEscalacionAlEquipo` (inicial y re-aviso) | tras armar título/cuerpo | `escalacion:<conversation>:<ancla>:<etapa>` | `/whatsapp?conversacion=<id>` |
| `retiro` | idem con `tema='retiro'` | idem | idem | idem |
| `cortesia` | `avisarCortesia` (reservada, llegada, cancelación pedida, por confirmar, datos, cancelada) | tras armar el contenido | `claveAviso(a)` | `/whatsapp?tab=cortesias` |
| `resumen_diario` | `runWhatsAppResumenDiario` 07:00 | tras armar el resumen no vacío de la escuela | `resumen:<school>:<fecha>` | `/whatsapp?tab=conversaciones` |
| `informe_cartera` | `enviarInformeCartera` lunes | tras armar el informe no vacío (`aplicar: true`) | `cartera:<school>:<lunes>` | `/finances` |

Orden de compuertas en `avisarPorPlataforma` (todas baratas primero):
`PLATFORM_WA_ENABLED=true` → no estamos en simulación → canal `activo` con token → escuela `habilitado` → suscripciones `activa` con la preferencia del tipo → perfil sigue siendo admin → fuera de horario silencioso (salvo urgente con `urgentes_en_silencio`) → **reserva** (INSERT) → ventana 24 h ? texto+botón : plantilla → estado `enviado`/`fallido` en la reserva + fila en `platform_wa_mensajes`.

Nunca lanza: un fallo del canal de plataforma no puede tumbar el aviso in-app, el push ni el correo que ya salieron.

### 3.3 Entrantes al número de plataforma

```
from ∈ PLATFORM_WA_TESTERS → modo pruebas (F2), salvo ACTIVAR/PAUSAR/AYUDA escritos sin sesión de prueba (así el tester también prueba el alta)
PLATFORM_WA_ENABLED y texto = ACTIVAR / DESACTIVAR / AYUDA → comandos de suscripción
from con suscripción activa → ayuda corta (1 vez cada 24 h): «este número solo envía avisos; responde a las familias desde la app»
resto → silencio (o respuesta comercial 1 vez/30 días con PLATFORM_WA_RESPUESTA_COMERCIAL=true)
```

Idempotencia de entrantes: `platform_wa_mensajes.wa_message_id` UNIQUE (Meta reintenta).

### 3.4 Modo pruebas (F2)

| Comando | Efecto |
|---|---|
| `/escuela <slug o nombre>` | Elige escuela (slug exacto o nombre parecido; si hay varias, lista hasta 5 con su slug). Arranca como prospecto y con memoria vacía. |
| `/como papa <id o nombre>` | Hace de acudiente de un atleta **de prueba** de esa escuela. Con cuenta → `identificado`; sin cuenta → `debe_registrarse`. |
| `/como prospecto` | Número desconocido para la escuela. |
| `/reiniciar` | Borra la memoria de la conversación simulada (mantiene escuela y rol). |
| `/estado` | Escuela, rol, mensajes en memoria y las escrituras que el cortafuegos bloqueó en el último turno. |
| `/salir` | Borra la sesión. |
| cualquier otro texto o botón | Un turno simulado. Las respuestas salen por el número de SportMaps al tester, con un prefijo `🧪`. Los botones se mandan como botones reales (mismos ids `sm_*`), así que tocarlos ejercita `accionDeBoton`. |

Lo que el modo pruebas **no** hace (y por qué): no aplica pagos, no reserva cupos, no crea leads, cobros ni escalaciones, no avisa a la escuela, no manda nada por el número de la escuela, no registra opt-ins, no gasta la cola de comprobantes (los adjuntos no se procesan en simulación: se contesta «en pruebas solo texto y botones»). Lo que sí gasta: llamadas al modelo (Groq/Gemini), igual que un turno real.

Lo que se ve en el chat, además de las respuestas: si el bot no contesta nada, sale «🧪 (el bot no respondió nada: …)» con el camino que tomó (p. ej. `atenderDesconocido → …` o `runBotTurn (contacto: desconocido)`), que es el comportamiento real (el freno de 30 días del tema escolar, por ejemplo).

Límite honesto: un camino del bot que necesita leer lo que acaba de escribir en una tabla **real** (p. ej. un lead recién creado) verá el error `SIM00` y responderá como si la escritura hubiera fallado. `/estado` muestra qué se bloqueó para no confundir eso con un bug del bot.

## 4. Seguridad

- **Cortafuegos fail-closed (D13).** El proxy del cliente de Supabase solo actúa dentro del `AsyncLocalStorage` de la simulación; fuera de él no cambia nada. Dentro: `insert/upsert/update/delete` sobre tablas reales → error; `rpc` fuera de la allowlist → error; `functions`, `storage`, `auth.admin` → error. `fetch` a `graph.facebook.com`, `/functions/v1/`, Resend, Wompi o Mercado Pago → 503 simulado. `push.service`, `webpush.service`, `postearMensaje`, `markAsRead` y el envío de plantillas cortan explícitamente. Las salidas al tester se mandan **fuera** del contexto, después del turno.
- **Allowlist de testers por variable de entorno**, comparando los dígitos completos del `from`. Vacía = modo pruebas apagado.
- **Datos de prueba solamente** para `/como papa` (D14).
- **El canal no expone datos de familias más allá del aviso mínimo:** escalación = nombre de contacto o número enmascarado (`etiquetaDeContacto`) y el motivo; cortesía = nombre que dio el prospecto, grupo y hora; cartera = cifras. El detalle siempre en la app.
- **Tablas service-only** (D15). Ningún `SECURITY DEFINER` nuevo (I4 no aplica). Ninguna policy nueva (I1–I3 no aplican). Correr `npm run seguridad:invariantes` igual tras aplicar.
- **Kill-switches:** `PLATFORM_WA_ENABLED` (avisos y comandos de suscripción), `PLATFORM_WA_TESTERS` (modo pruebas), `platform_wa_canal.status` (todo el canal), `platform_wa_escuelas.habilitado` (por escuela), y la baja de la propia dueña.

## 5. Plan de migraciones (escrito ANTES de la migración)

Una sola migración, `canal_whatsapp_plataforma`, creada con `npm run migrations:new`. Solo crea objetos nuevos: no toca tablas, policies ni funciones existentes, así que no hay radio que medir sobre escuelas actuales.

| Objeto | Columnas clave | Restricciones |
|---|---|---|
| `platform_wa_canal` | `id text PK = 'sportmaps'`, `phone_number_id`, `waba_id`, `display_phone_number`, `access_token_encrypted`, `status`, `conectado_at`, `token_rotated_at` | CHECK `id='sportmaps'` (singleton); `phone_number_id` UNIQUE; `status ∈ (inactivo, activo, suspendido)` |
| `platform_wa_escuelas` | `school_id PK → schools`, `habilitado bool default false`, `actualizado_por → profiles`, `updated_at` | ON DELETE CASCADE |
| `platform_wa_suscripciones` | `school_id → schools`, `profile_id → profiles`, `contact_wa_id`, `estado`, `origen`, `codigo`, `codigo_expira_at`, `consentimiento_ref`, `activada_at`, `revocada_at`, `motivo_revocacion`, 6 × `avisar_*`, `silencio_desde`, `silencio_hasta`, `urgentes_en_silencio` | UNIQUE (`school_id`, `contact_wa_id`); `estado ∈ (pendiente, activa, revocada)`; `origen ∈ (app, whatsapp)`; `contact_wa_id ~ '^573[0-9]{9}$'` (solo celular CO, como el resto del canal); horas 0–23; CHECK activa ⇒ `consentimiento_ref` y `activada_at` no nulos; índice por `contact_wa_id`; índice parcial por escuela `WHERE estado='activa'`; índice único parcial por `codigo` vigente |
| `platform_wa_envios` | `suscripcion_id → suscripciones`, `school_id`, `tipo`, `clave`, `estado`, `via`, `plantilla`, `wa_message_id`, `detalle` | UNIQUE (`suscripcion_id`, `clave`) = la reserva; `tipo` y `estado` con CHECK; `via ∈ (texto, plantilla)` |
| `platform_wa_mensajes` | `wa_message_id UNIQUE`, `direccion`, `contact_wa_id`, `clase`, `tipo`, `texto`, `status`, `status_at` | `direccion ∈ (entrante, saliente)`; `clase ∈ (suscriptor, tester, desconocido)`; CHECK desconocido ⇒ `texto IS NULL`; índice (`contact_wa_id`, `created_at desc`) |
| `platform_wa_sesiones_prueba` | `contact_wa_id PK`, `school_id → schools`, `rol`, `child_id → children`, `parent_id → profiles`, `estado jsonb` | `rol ∈ (papa, prospecto)` |

Para las seis: `ENABLE ROW LEVEL SECURITY`, ninguna policy, `REVOKE ALL … FROM anon, authenticated`, `GRANT ALL … TO service_role`. Trigger `updated_at` con una función propia `platform_wa_touch_updated_at()` (`SET search_path = pg_catalog, public, pg_temp`, sin `SECURITY DEFINER`, `REVOKE EXECUTE` a `anon`/`authenticated`).

Verificación tras aplicar (solo SELECT):

```sql
select relname, relrowsecurity from pg_class where relname like 'platform_wa_%';           -- todas true
select count(*) from pg_policies where tablename like 'platform_wa_%';                      -- 0
select grantee, table_name, privilege_type from information_schema.role_table_grants
 where table_name like 'platform_wa_%' and grantee in ('anon','authenticated');              -- 0 filas
```

**Sin la migración el código no hace nada:** cada lectura de las tablas nuevas que falla con 42P01/PGRST205 se trata como «canal no configurado».

### 5.1 Ensayo del modo pruebas (2026-10-09, local, contra la base real)

Script en el scratchpad (no se commitea) con una **segunda red independiente** del cortafuegos: un `fetch` que solo deja pasar GET/HEAD a Supabase, POST a `/rest/v1/rpc/<STABLE>` y el LLM; todo lo demás lanza. Escuela: Dynasty, rol prospecto, sin enviar nada por WhatsApp (se imprimen las salidas).

- «Hola, quiero inscribir a mi hija de 10 años» → la respuesta real de Dynasty: presentación, enlace `join/dynasty-inscripcion`, «Para 10 años le corresponde *Minivolley Benjamines* (lunes y miércoles 5–7 p. m.; sábado y domingo 8–10 a. m.)» y 9 franjas de cortesía como botones `sm_cc_f:<id>`.
- «y cuánto vale la mensualidad?» → silencio (freno real del tema escolar para un desconocido).
- Peticiones rechazadas por la red del ensayo: **0**. Lo único que bloqueó el cortafuegos fue `rpc school_shows_own_brand`, que es `STABLE` y se agregó a la allowlist.

## 6. Fases

| Fase | Contenido | Estado |
|---|---|---|
| F0 | Spec + migración | hecho (migración SIN aplicar) |
| F1 | Modelo, opt-in (app + ACTIVAR), preferencias, horario silencioso, envío con reserva, ganchos en los 5 eventos, plantillas en el catálogo, script de conexión/registro, UI en Configuración | hecho, detrás de `PLATFORM_WA_ENABLED` + escuela habilitada |
| F2 | Modo pruebas con cortafuegos | hecho, detrás de `PLATFORM_WA_TESTERS` |
| F3 | Preferencias finas en la UI (hoy: los 6 tipos + silencio vía API; la UI expone los 6 interruptores y el silencio por defecto), estados de entrega en la UI, retención de `platform_wa_mensajes` (90 días) en `whatsapp-mantenimiento.job` | pendiente |
| F4 | Abrirlo a escuelas sin WhatsApp conectado (hoy el resumen diario solo corre para escuelas con integración, porque se arma sobre su buzón) | pendiente |

## 7. Variables de entorno (Render, BFF de **producción**)

| Variable | Valor | Nota |
|---|---|---|
| `PLATFORM_WA_ENABLED` | `true` cuando se quiera prender | Sin ella no sale ningún aviso ni se atienden ACTIVAR/DESACTIVAR |
| `PLATFORM_WA_TESTERS` | `573128463555` | Lista separada por comas, solo dígitos con indicativo |
| `PLATFORM_WA_RESPUESTA_COMERCIAL` | (no definir) | `true` = respuesta breve a desconocidos 1 vez/30 días |
| `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_TOKEN_ENC_KEY` | ya existen | La misma app de Meta firma los webhooks del canal |
| `FRONTEND_URL` | ya existe | Base de los enlaces «Ver en la app» del texto libre |

Los webhooks de Meta llegan **solo** al BFF de producción. Los BFF de dev y stg comparten la base: si tienen `PLATFORM_WA_ENABLED=true` también intentarán enviar avisos (la reserva evita duplicados, pero el que gane la reserva puede ser dev con código viejo). **Definir `PLATFORM_WA_ENABLED` solo en producción.**

## 8. Conectar el número comercial en Meta — pasos exactos

> El 2026-10-01, ensayando el alta de Dynasty, el +57 320 268 3539 pasó por Embedded Signup con Coexistence y quedó **en una WABA del portafolio SportMaps**; el último paso falló con #1690130 porque esa WABA no se puede compartir con la propia app (SportMaps es el Tech Provider). Para el canal de plataforma eso no es un problema: la WABA ya es de SportMaps y la app es de SportMaps; no hace falta compartir nada. Lo que hay que hacer es **verificar** en qué estado quedó y completar lo que falte.

### 8.1 Antes de empezar

1. En el celular del número comercial: WhatsApp Business ≥ 2.24.17. Ajustes → Cuenta → **Plataforma conectada**: anotar qué dice. Si dice «Bandeja de entrada de Meta Business Suite», desconectarla primero (es lo que frenó a Dynasty).
2. Respaldar los chats (Ajustes → Chats → Copia de seguridad).

### 8.2 Ver el estado actual (solo lectura)

En business.facebook.com → portafolio **SportMaps** → Configuración → Cuentas → **Cuentas de WhatsApp**: buscar la WABA que contiene +57 320 268 3539. Anotar el **ID de la WABA**. En WhatsApp Manager → Números de teléfono, anotar el **Phone number ID**.

Con el token del System User `SportMaps WA Bot` (en una terminal, sin pegarlo en ningún archivo):

```bash
curl -s "https://graph.facebook.com/v21.0/<WABA_ID>/phone_numbers?fields=id,display_phone_number,verified_name,name_status,code_verification_status,platform_type,status,quality_rating,is_on_biz_app" \
  -H "Authorization: Bearer $SYSTEM_USER_TOKEN"
```

- `platform_type: CLOUD_API` y `is_on_biz_app: true` → **Coexistence activo**: seguir en 8.4.
- `platform_type: NOT_APPLICABLE` o el número no aparece → seguir en 8.3.

### 8.3 Si Coexistence no quedó activo

1. WhatsApp Manager (portafolio SportMaps) → Números de teléfono → **Agregar número de teléfono** → elegir conectar el número existente de la **app de WhatsApp Business** (Coexistence). Escanear el QR desde la app del celular comercial (Ajustes → Cuenta → Plataforma conectada / Dispositivos vinculados según versión) y aceptar compartir el historial.
2. Si WhatsApp Manager no ofrece esa opción para el portafolio propio, el camino alterno es el Embedded Signup de la app de SportMaps iniciado **por un usuario del portafolio SportMaps** eligiendo «crear/usar una WABA de este portafolio» (no «compartir con un proveedor»). Si vuelve a salir #1690130, abrir caso en soporte de Meta con los session ids del 2026-10-01 (`01a0fa42-4efe-79a1-bc08-b54c0f1769f2`, `01a0fa47-8956-7979-b0b9-081e2e736b48`) explicando que es el número propio del Tech Provider.
3. La sincronización del historial tiene que completarse dentro de las 24 h del alta.

**Qué se conserva con Coexistence:** la app, los chats e historial (hasta 6 meses sincronizados), el perfil, el catálogo y las etiquetas; el equipo de ventas sigue contestando desde el celular. **Qué cambia o se pierde (verificar contra la doc vigente de Meta el día del alta):** los mensajes temporales y «ver una vez» se desactivan, las listas de difusión pasan a solo lectura, los grupos siguen en el celular pero no entran a la API, algunos dispositivos vinculados (Windows/Wear OS) se desvinculan, y hay que abrir la app al menos una vez cada 14 días para que el vínculo no caiga. Los mensajes enviados desde la app siguen gratis; los que manda la API se cobran a la WABA de SportMaps.

### 8.4 Dar acceso a la app y al System User

1. business.facebook.com → Configuración → Usuarios → **Usuarios del sistema** → `SportMaps WA Bot` → Asignar activos → Cuentas de WhatsApp → la WABA del número comercial → **Control total**.
2. Suscribir la app a la WABA (con el token del System User):

```bash
curl -s -X POST "https://graph.facebook.com/v21.0/<WABA_ID>/subscribed_apps" -H "Authorization: Bearer $SYSTEM_USER_TOKEN"
curl -s "https://graph.facebook.com/v21.0/<WABA_ID>/subscribed_apps" -H "Authorization: Bearer $SYSTEM_USER_TOKEN"   # debe listar la app sportmaps
```

3. El webhook es **de la app**, no del número: ya apunta a `https://sportmaps-bff-prod.onrender.com/api/v1/webhooks/whatsapp` con `messages` (y los de Coexistence). No hay que tocarlo. Verificar en developers.facebook.com → app sportmaps → WhatsApp → Configuración → Webhook que el campo `messages` esté suscrito.

### 8.5 Nombre visible «SportMaps»

WhatsApp Manager → Números de teléfono → el número → **Perfil** → Nombre para mostrar → `SportMaps` → Enviar a revisión. El negocio ya está verificado (2026-09-09), así que la revisión suele tardar horas. El campo `name_status` del curl de 8.2 pasa a `APPROVED`. La insignia azul (Meta Verified) es otro trámite, pago y opcional.

### 8.6 Cargar el canal en SportMaps

Primero aplicar la migración (§5). Después, desde `bff/` (el token se lee de un archivo que el script borra; nunca va a `.env`):

```bash
# 1) guardar el token del System User en un archivo temporal (una sola línea)
# 2) simulación (no escribe nada): valida contra Graph que el token alcance el número
npx tsx scripts/wa-plataforma.ts conectar --phone-number-id <PHONE_NUMBER_ID> --waba-id <WABA_ID> --token-file C:\tmp\token-plataforma.txt
# 3) de verdad
npx tsx scripts/wa-plataforma.ts conectar --phone-number-id <PHONE_NUMBER_ID> --waba-id <WABA_ID> --token-file C:\tmp\token-plataforma.txt --aplicar
npx tsx scripts/wa-plataforma.ts estado
```

### 8.7 Plantillas (registrar en la WABA de SportMaps)

```bash
npx tsx scripts/wa-plataforma.ts plantillas            # simulación: muestra lo que mandaría
npx tsx scripts/wa-plataforma.ts plantillas --aplicar  # POST /<WABA_ID>/message_templates, una por archivo
npx tsx scripts/wa-plataforma.ts estado                # estado de cada plantilla en Meta
```

Las plantillas están en `bff/whatsapp-templates/plataforma/` (subcarpeta a propósito: `register-templates.sh` y `wa-copiar-plantillas.ts` registran en WABAs de escuelas y no deben verlas).

### 8.8 Prender el piloto con Dynasty

```bash
npx tsx scripts/wa-plataforma.ts habilitar-escuela 2d509571-3238-4c04-ac3f-6dfe20539226            # simulación
npx tsx scripts/wa-plataforma.ts habilitar-escuela 2d509571-3238-4c04-ac3f-6dfe20539226 --aplicar
```

Render (solo producción): `PLATFORM_WA_ENABLED=true`, `PLATFORM_WA_TESTERS=573128463555`. Luego Milena entra a WhatsApp → Configuración → «Recibir avisos de SportMaps en mi WhatsApp», escribe su número y toca «Confirmar desde mi WhatsApp» (o escribe «ACTIVAR» al +57 320 268 3539 desde el 320 429 8969).
