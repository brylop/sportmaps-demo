# Spec — CRM + 4 agentes de IA para profesionales independientes (fisios, entrenadores, psicólogos deportivos)

**Estado:** propuesta, sin código — tenant y pagos cerrados (bloqueaban el resto del schema); modelo de datos completo del módulo base + diseño completo del Agente 1 (Ventas)
**Origen:** discusión 2026-09-15/16 sobre el marketplace de profesionales y cómo extender el patrón de agente-por-WhatsApp que ya existe para escuelas
**Roles cubiertos:** `fisio`, `entrenador`, `psicologo` (dentro de los roles ya existentes `wellness_professional` / `coach` — no es una dimensión nueva de permisos)
**Relacionado:** [[project_whatsapp_wa1_wa2_built]], [[project_whatsapp_ai_channel]], [[project_meta_app_review_enviado]], [[project_notifications_unified]] (envío), [[project_reservations_module]] (disponibilidad), [[project_payment_creation_paths_census]] (por qué pagos no es un tool suelto), [[project_payment_accounts_list]], `docs/specs/outbound-ai-sales-calls.md`

---

## 0. Decisiones cerradas (bloqueaban el schema, ya resueltas)

| # | Decisión | Resuelto así | Por qué |
|---|---|---|---|
| 1 | **Tenant** | `schools.school_type = 'professional'` (no `professional_id` nuevo, no tabla de tenant propia) | `school_type` ya es `text` libre en `schools` (no enum) — agregar el valor no es migración de schema. Reutiliza `user_school_ids()` / `user_staff_school_ids()` / `user_admin_school_ids()`, el motor de mora, los créditos de sesión y las tres agregaciones de ingreso sin duplicar helpers de RLS — que es justo el patrón que la auditoría de seguridad ya marcó como riesgo cuando se duplica. |
| 2 | **Cobro** | No hay tool `create_payment_link`. Existen dos RPCs `SECURITY DEFINER` atómicas — ver ronda 2, punto 1 y 3 — que **transicionan una sesión ya agendada** a `confirmada` y crean el pago en la misma transacción. | Hay 13 caminos hoy que crean `payments` y solo 4 estampan `payment_category` bien. Un tool de pago suelto sería el 14º camino sin censar — mismo incidente que ya pasó con Dynasty. |
| 3 | **Envío de WhatsApp** | El agente nunca llama a la API de Meta directo — ver ronda 2, punto 5 para cómo queda exactamente el envío. | Ya está construido y validado en dev para los otros agentes de WhatsApp; un sender nuevo por módulo duplica infraestructura que ya resuelve reintentos, plantillas y logging. |
| 4 | **Disponibilidad** | No hay `availability_rules` ni `availability_blocks` nuevas. `get_available_slots` delega en el Módulo de Reservas (F0-F7) ya existente. | El motor de "slots libres = reglas − bloqueos − reservas" ya está resuelto ahí; construirlo de nuevo para este módulo es el mismo problema dos veces. |
| 5 | **Consentimiento clínico** | `clients.consent_at` — sin valor, el Agente 2 no envía `clinical_doc` aunque esté confirmado. | Dato de salud (fisio y psicólogo). Mismo patrón que ya se exigió para informes de coach en Club Carmel: consentimiento previo, nunca retroactivo. |

---

## 0 bis. Decisiones cerradas — ronda 2 (revisión QA 2026-09-16)

La ronda 1 cerró tenant y pagos a nivel de principio. Revisando como QA aparecieron contradicciones internas y huecos operativos que hay que cerrar antes de la primera migración.

| # | Punto | Resuelto así |
|---|---|---|
| 1 | **`process_professional_session_checkout` vs `create_session` — contradicción de flujo** | La RPC **no crea la sesión desde cero** (eso ya lo hizo `create_session` en el paso 7, con la reserva del slot). Recibe `session_id` y hace la transición `agendada → confirmada` + crea el pago, en una transacción. **No es una copia de `process_enrollment_checkout`** (ese sí crea todo de una vez) — es un patrón hermano, "transición + pago", con nombre y forma propios. |
| 2 | **Valor concreto de `payment_category`** | `'professional_session'`, agregado a la misma columna `payments.payment_category` (hoy `mensualidad / inscripcion / articulos / otro / torneo`) con una migración `DROP CONSTRAINT` + `ADD CONSTRAINT`, igual que se hizo para agregar `'torneo'` (`20260908152538_catalogo_torneos_y_articulos_self_service.sql`). `cash_ledger` lo expone automático (pasa `payment_category` sin lista cerrada). Si `school_payment_kpis()` o el desglose de `useDashboardStatsReal` tienen un `SUM(CASE WHEN payment_category = …)` por categoría (como ya lo tienen para `'articulos'`), necesitan la rama nueva explícita — verificar al implementar, no es blocker de schema pero sí de no repetir el patrón "9 de 13 caminos no estampan". |
| 3 | **Confirmación manual (efectivo / transferencia sin link) — el camino que faltaba** | Segunda RPC, `confirm_professional_session_manual(session_id, payment_method, payment_ref)`, mismo patrón atómico, mismo `payment_category = 'professional_session'`, la llama el profesional (comando de WhatsApp o panel), no el agente. Ambas RPCs delegan en un helper interno compartido, `_confirm_professional_session(session_id, payment_id)`, para no duplicar la lógica de transición + estampado — si no, es el mismo bug en dos lugares el día que alguien la toque. |
| 4 | **`confirmada → atendida` no depende del Agente 3** | Es un cron del módulo base (`pg_cron`, cada 15 min) que mueve `confirmada → atendida` cuando `now() > scheduled_at + duration_min`. Vive desde la primera migración, no se pospone a cuando exista Seguimiento — si no, con el MVP de solo Ventas las sesiones quedan en `confirmada` para siempre y el Agente 4 nunca las suma al resumen. |
| 5 | **`agent_events` no es un segundo outbox** | Queda como **solo auditoría** (qué tool llamó el agente, qué decidió). El envío real (`message_out`) se inserta directo en la tabla outbox que el Despachador Unificado ya consume — sin tabla intermedia propia, sin dueño doble de "marcar enviado". Nombre exacto de esa tabla a confirmar al implementar. |
| 6 | **`school_type = 'professional'` va a filtrar listados existentes** | Antes de la migración: censar todo `select … from schools` (y vistas que la envuelven) que alimenta marketplace de escuelas, dashboard de super admin, planes/facturación y reportes consolidados, y decidir el filtro explícito (`school_type = 'academy'` o `<> 'professional'`) en cada uno. Mismo tipo de trabajo que el censo de `payment_category` del punto 2 — se hace antes de migrar, no después. |

Y quedan cerrados los tres puntos que estaban abiertos en §3 de la ronda 1:

| Punto | Resuelto así |
|---|---|
| Google Calendar bidireccional | Para el MVP: SportMaps es la fuente de verdad, Google Calendar queda como espejo de solo lectura. El webhook de vuelta (push notifications de Calendar API) no es necesario para validar con un piloto — queda fuera de alcance por ahora. |
| `requires_human` sobre `escalation_rules.primera_consulta` | Confirmado — es la lectura correcta (§1.5). |
| Política de no-show / cancelación tardía | Reusa el motor de mora y los créditos de sesión ya existentes para escuelas. Definir uno propio para este módulo es exactamente el tipo de duplicación que las otras decisiones de este documento evitaron. |

Lo que sigue en §1–§2 ya refleja también la ronda 2. Lo que queda abierto está en §3.

---

## 1. Modelo de datos

### 1.1 Tenancy

El profesional independiente **es una escuela** con `school_type = 'professional'`. `owner_id` es el profesional. Si además trabaja dentro de una escuela real, es `school_staff` de esa escuela por separado — son dos membresías, no un campo opcional en una tabla nueva.

RLS: ninguna tabla de este módulo define política propia de tenancy. Todas llevan `school_id` y usan los helpers `SECURITY DEFINER` que ya existen (`user_school_ids()` para lectura de miembro, `user_staff_school_ids()` para escritura operativa, `user_admin_school_ids()` para lo que otorga permisos) — sin esto, cualquier policy nueva corre el riesgo de la misma recursión que ya costó tres migraciones de arreglo en `20260219000005/6/7`.

### 1.2 Tablas de configuración (se llenan una vez, en onboarding)

```sql
-- Config del agente para una escuela de tipo 'professional'.
-- Nombre, teléfono, logo, etc. ya viven en `schools`; acá solo lo que es específico del agente.
create table professional_settings (
  school_id         uuid primary key references public.schools(id) on delete cascade,
  role              text not null check (role in ('fisio','entrenador','psicologo')),
  whatsapp_number   text not null,                    -- número conectado vía Cloud API (puede diferir del `schools.phone`)
  timezone          text not null default 'America/Bogota',
  tone              text not null default 'amigable' check (tone in ('formal','amigable','cercano')),
  agent_enabled     boolean not null default false,
  agent_enabled_by  uuid references public.profiles(id),   -- quién lo prendió — auditable, igual que el flag de banco de horas
  agent_enabled_at  timestamptz,
  summary_time      time not null default '20:00',         -- hora del resumen diario (Agente 4)
  created_at        timestamptz not null default now()
);

-- Catálogo de servicios = la "base de precios" que usa el Agente de Ventas
create table service_catalog (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references public.schools(id),
  name              text not null,                    -- "Valoración inicial", "Sesión 60 min"
  description       text,
  duration_min      int not null,
  price_cop         int not null,
  modality          text not null check (modality in ('presencial','virtual','domicilio')),
  travel_buffer_min int not null default 0,            -- solo aplica si modality = 'domicilio'; se suma al slot ocupado
  requires_human    boolean not null default false,    -- ej. primera consulta compleja — ver 1.5 sobre cuál manda
  is_active         boolean not null default true
);

-- Lo que el agente NO puede resolver solo (personalizable por profesional)
create table escalation_rules (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references public.schools(id),
  trigger           text not null check (trigger in (
                      'primera_consulta','pregunta_clinica','negociacion_precio',
                      'servicio_fuera_catalogo','cancelacion_menos_24h',
                      'queja_o_tono_negativo','menor_sin_acudiente','crisis_emocional')),
  action            text not null default 'pausa_y_notifica' check (action in ('pausa_y_notifica','pide_dato_no_agenda'))
);

-- Preguntas frecuentes / conocimiento libre (políticas de cancelación, qué llevar, etc.)
create table knowledge_items (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references public.schools(id),
  question          text not null,
  answer            text not null
);
```

Disponibilidad (horarios recurrentes, bloqueos, slots) **no se define acá** — usa las tablas del Módulo de Reservas ya existente para el `school_id` de este profesional.

### 1.3 Tablas operativas (las llenan los agentes)

```sql
-- Cliente del profesional: viene del marketplace O era cliente externo
create table clients (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null references public.schools(id),
  athlete_id          uuid,                              -- si ya existe como atleta en SportMaps (ajustar FK real a la tabla vigente)
  guardian_profile_id uuid references public.profiles(id), -- si el acudiente ya tiene cuenta; se intenta resolver por teléfono al crear
  full_name           text not null,
  whatsapp_number     text not null,
  guardian_name       text,                              -- fallback en texto libre solo si no se resolvió a un profile
  source              text not null check (source in ('marketplace','externo','referido')),
  consent_at          timestamptz,                        -- consentimiento para recibir clinical_doc; NULL = Agente 2 no envía
  created_at          timestamptz not null default now(),
  unique (school_id, whatsapp_number)
);

-- La fila central. La abre Ventas, la completa Clínico, la lee Seguimiento y Cierre.
create table sessions (
  id                   uuid primary key default gen_random_uuid(),
  school_id            uuid not null references public.schools(id),
  client_id            uuid not null references clients(id),
  service_id           uuid references service_catalog(id),
  status               text not null default 'propuesta' check (status in (
                        'propuesta','cotizada','agendada','confirmada','atendida',
                        'documentada','cerrada','cancelada','no_show','abandonada')),
  scheduled_at         timestamptz,
  duration_min         int,
  location             text,
  price_cop            int,
  payment_id           uuid references payments(id),      -- lo crea process_professional_session_checkout O confirm_professional_session_manual, nunca el agente directo
  reservation_id        uuid,                               -- FK a la reserva del Módulo de Reservas, tipo exacto a confirmar al integrar
  calendar_event_id     text,                               -- ver §3: sync con Google Calendar sigue abierto
  clinical_doc          jsonb,                              -- lo llena el Agente 2 (ver 1.6)
  clinical_doc_status   text not null default 'sin_doc' check (clinical_doc_status in ('sin_doc','borrador','confirmado','enviado')),
  created_by            text not null default 'agent_sales' check (created_by in ('agent_sales','professional','admin')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
-- trigger set_updated_at() pendiente de enganchar (ver §3)

-- Evolución longitudinal del cliente. Una fila por métrica por sesión.
create table client_progress (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references public.schools(id),
  client_id         uuid not null references clients(id),
  session_id        uuid references sessions(id),
  metric_key        text not null,       -- 'dolor', 'rango_mov', 'carga_kg', 'estado_animo', 'asistencia'
  metric_value      numeric,
  metric_text       text,
  recorded_at       timestamptz not null default now()
);

-- Solo auditoría: qué tool llamó el agente, qué decidió. NO es outbox.
-- El envío real (message_out) va directo a la tabla outbox del Despachador
-- Unificado ya existente — esta tabla no reenvía ni marca "enviado".
create table agent_events (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references public.schools(id),
  client_id         uuid references clients(id),
  session_id        uuid references sessions(id),
  agent             text not null check (agent in ('sales','clinical','followup','closing')),
  event_type        text not null check (event_type in (
                      'message_in','message_out','tool_call','escalated','handoff_back')),
  payload           jsonb,
  created_at        timestamptz not null default now()
);
```

RPCs `SECURITY DEFINER` nuevas de este módulo (incluida `process_professional_session_checkout`): recordar `SET search_path = pg_catalog, public, pg_temp` y `GRANT EXECUTE` explícito a `authenticated` — `SECURITY DEFINER` no exime de eso.

### 1.4 Máquina de estados de `sessions.status`

```
propuesta ──► cotizada ──► agendada ──► confirmada ──► atendida ──► documentada ──► cerrada
    │             │            │              │
    └─ abandonada └─ abandonada└─ cancelada   └─ no_show
```

| Estado | Quién lo pone | Qué significa |
|---|---|---|
| propuesta | Ventas | El cliente pidió algo, aún no hay servicio ni fecha |
| cotizada | Ventas | Se envió precio y opciones de horario |
| agendada | Ventas | Fecha fijada, reserva creada en el Módulo de Reservas |
| confirmada | `process_professional_session_checkout` (pago con link) o `confirm_professional_session_manual` (efectivo/transferencia, la llama el profesional) | Pago registrado — nunca lo pone el agente directo |
| atendida | Cron del módulo base (`pg_cron`, cada 15 min) | Pasó `scheduled_at + duration_min`; se asume atendida salvo marca de no_show. No depende del Agente 3 — corre aunque Seguimiento no exista todavía |
| documentada | Clínico | `clinical_doc_status = confirmado` |
| cerrada | Cierre | Incluida en un resumen diario |
| cancelada | Ventas / humano | Cancelación antes de la hora |
| no_show | Humano | El cliente no llegó |
| abandonada | Ventas | Sin respuesta del cliente en 48 h |

### 1.5 Triggers de escalada (defaults por rol, editables)

| Trigger | fisio | entrenador | psicologo | Acción |
|---|:---:|:---:|:---:|---|
| primera_consulta | ✔ | | ✔ | pausa y notifica |
| pregunta_clinica | ✔ | | ✔ | pausa y notifica |
| negociacion_precio | ✔ | ✔ | ✔ | pausa y notifica |
| servicio_fuera_catalogo | ✔ | ✔ | ✔ | pausa y notifica |
| cancelacion_menos_24h | ✔ | ✔ | ✔ | pausa y notifica |
| queja_o_tono_negativo | ✔ | ✔ | ✔ | pausa y notifica |
| menor_sin_acudiente | ✔ | ✔ | ✔ | pide acudiente, no agenda |
| crisis_emocional | | | ✔ | pausa, notifica, da recursos |

**Fuente única para `primera_consulta`:** manda `service_catalog.requires_human` del servicio pedido, no la fila de `escalation_rules` — `escalation_rules` cubre el resto de triggers, que no son por-servicio. Confirmado (ver §0 bis).

`pausa_y_notifica`: el agente responde "te paso con [nombre], te escribe en breve", registra `agent_events.event_type = 'escalated'` y deja de responder a ese cliente hasta que el profesional envíe `/retomar` desde su WhatsApp.

### 1.6 Plantilla de `clinical_doc` por rol (para el Agente 2)

```jsonc
// fisio
{ "motivo": "", "dolor_inicio": 0, "dolor_fin": 0, "rango_movimiento": "",
  "tecnicas": [], "ejercicios_casa": [{ "nombre": "", "series": 0, "reps": 0, "nota": "" }],
  "observaciones": "", "proxima_sesion_objetivo": "" }

// entrenador
{ "objetivo_sesion": "", "bloques": [{ "ejercicio": "", "series": 0, "reps": 0, "carga_kg": 0, "rpe": 0 }],
  "duracion_real_min": 0, "sensaciones": "", "ajustes_proxima": "" }

// psicologo (solo lo no confidencial va al cliente; lo demás queda privado)
{ "tema_trabajado": "", "tecnicas": [], "tareas_entre_sesiones": [], "estado_animo_1_10": 0,
  "notas_privadas": "", "compartir_con_cliente": ["tema_trabajado","tareas_entre_sesiones"] }
```

El Agente 2 solo puede pasar `clinical_doc_status` a `enviado` si `clients.consent_at is not null`. Sin consentimiento queda en `confirmado` y notifica al profesional que falta pedirlo — no es un bloqueo silencioso.

---

## 2. Agente 1 — Ventas: diseño completo

### 2.1 Objetivo

Cerrar una sesión de punta a punta (servicio → horario → pago → confirmación) por WhatsApp, sin intervención del profesional salvo trigger de escalada. Atiende igual a clientes del marketplace y externos.

### 2.2 Herramientas (tools) que expone el backend

| Tool | Entrada | Salida |
|---|---|---|
| `get_school_context` | school_id | `professional_settings`, catálogo activo, FAQ |
| `find_or_create_client` | whatsapp_number, nombre? | client_id, source, historial resumido, intenta resolver `guardian_profile_id` por teléfono |
| `get_available_slots` | service_id, rango_fechas | slots del Módulo de Reservas (ya contempla `travel_buffer_min` si la modalidad es domicilio) |
| `create_session` | client_id, service_id, scheduled_at | session_id (status `agendada`) + reserva creada — con lock contra doble-booking dentro de la misma RPC `SECURITY DEFINER`, no en el tool. La sesión ya existe a partir de acá; el cobro solo la transiciona |
| `request_session_payment` | session_id (ya en `agendada`) | link de pago. El webhook, al confirmar, llama a `process_professional_session_checkout(session_id, …)`, que hace `agendada → confirmada` + crea el pago — no crea la sesión |
| `check_payment` | session_id | estado del `payment_id` asociado |
| `escalate` | client_id, trigger, resumen | registra `agent_events.event_type='escalated'`, pausa al agente para ese cliente |
| `log_event` | agent, event_type, payload | agrega a `agent_events` como auditoría — no dispara ningún envío |

Fuera del alcance del agente: si el profesional confirma manual (efectivo/transferencia), llama a `confirm_professional_session_manual` directo — no es un tool del agente de Ventas, es un comando del profesional.

### 2.3 Flujo conversacional

```
1. ENTRADA        mensaje de WhatsApp → find_or_create_client
2. SALUDO         si es nuevo: saludo + qué ofrece (máx. 3 servicios)
                  si es conocido: saludo por nombre + "¿otra sesión de X?"
3. IDENTIFICAR    servicio (si no lo dice, pregunta con opciones)
4. CHEQUEO        ¿service_catalog.requires_human? → escalate('primera_consulta') y sigue
                  ¿menor sin acudiente? → pide acudiente, no avanza
5. COTIZAR        precio + duración + modalidad. status = cotizada
6. HORARIO        get_available_slots → ofrece 3 opciones concretas ("mar 5:00 pm, mié 7:00 am, jue 5:00 pm")
7. AGENDAR        create_session → status = agendada. Confirma fecha, lugar, precio
8. COBRAR         request_session_payment (la sesión ya está agendada) → "para dejar el cupo reservado, paga aquí: <link>"
9. CONFIRMAR      webhook de pago (idempotente, ver §3) → process_professional_session_checkout transiciona agendada→confirmada + crea el pago → evento message_out al outbox del Despachador (cliente y profesional)
10. SI NO PAGA    recordatorio a las 12 h (evento al outbox del Despachador); a las 24 h el link expira, la reserva se libera, status = abandonada
```

### 2.4 Mensajes tipo (rol fisio, tono amigable)

**Nuevo, sin servicio claro**
> ¡Hola! Soy el asistente de Laura, fisioterapeuta deportiva. Cuéntame qué necesitas y te ayudo a agendar. Lo más común:
> 1. Valoración inicial (60 min, $120.000)
> 2. Sesión de fisioterapia (45 min, $90.000)
> 3. Recuperación post-partido (30 min, $70.000)

**Cotización + horario**
> Perfecto, sesión de fisioterapia de 45 min, $90.000, en la sede de Hayuelos.
> Laura tiene cupo:
> • Martes 16 a las 5:00 pm
> • Miércoles 17 a las 7:00 am
> • Jueves 18 a las 5:00 pm
> ¿Cuál te sirve?

**Agendado + cobro**
> Listo, quedaste para el martes 16 a las 5:00 pm. Para reservar el cupo puedes pagar aquí: `<link>` (vence en 24 h). Cuando pagues te confirmo por acá.

**Escalada**
> Esa pregunta la puede responder mejor Laura directamente. Ya le avisé, te escribe en un rato. Mientras tanto, ¿quieres que igual te reserve el martes?

### 2.5 Reglas duras del agente

- Nunca inventa precios, horarios ni servicios: solo lo que devuelve `get_school_context` y `get_available_slots`.
- Nunca da consejo clínico, diagnóstico ni recomendaciones de ejercicio. Eso es trigger de escalada.
- Nunca llama a la API de WhatsApp directo — todo mensaje saliente se inserta en el outbox del Despachador Unificado, no en `agent_events` (que es solo auditoría).
- Máximo 3 opciones de horario por mensaje.
- Confirma siempre fecha + hora + lugar + precio antes de cobrar.
- Si el cliente escribe fuera del horario de atención, responde igual (es 24/7) pero aclara cuándo responde el profesional si escala.
- Todo mensaje entrante y saliente → `agent_events`.

### 2.6 Prompt del sistema (esqueleto)

```
Eres el asistente de {display_name}, {role_label}. Tono: {tone}.
Tu único trabajo es ayudar a clientes a agendar y pagar sesiones.

SERVICIOS DISPONIBLES: {catalogo_json}
PREGUNTAS FRECUENTES: {faq_json}
HORARIO GENERAL: {availability_resumen}

REGLAS:
- Usa solo los servicios y precios listados. Si piden algo distinto, llama a escalate('servicio_fuera_catalogo').
- Para horarios llama a get_available_slots; ofrece máximo 3.
- No des consejos de salud, ejercicio ni diagnóstico. Si preguntan, llama a escalate('pregunta_clinica').
- Si mencionan precio distinto o descuento, llama a escalate('negociacion_precio').
- Si el cliente parece menor y no hay acudiente, pide el contacto del acudiente antes de agendar.
- Antes de request_session_payment, confirma servicio, fecha, hora, lugar y precio en un solo mensaje.
- Mensajes cortos, máximo 4 líneas, sin emojis excesivos.
```

### 2.7 Casos borde a cubrir en QA

| Caso | Comportamiento esperado |
|---|---|
| Dos clientes toman el mismo slot a la vez | `create_session` con lock dentro de la RPC; el segundo recibe alternativas |
| Webhook de pago duplicado o reintentado | `process_professional_session_checkout` es idempotente por `session_id` — confirmar contra el webhook real antes de ir a producción (ver §3) |
| Cliente paga después de que el link venció | Webhook llega → reactiva sesión si el slot sigue libre; si no, reembolso automático + reagendar |
| Profesional bloquea horario con sesión agendada | Notifica al profesional, propone al cliente reagendar |
| Cliente cambia de servicio a mitad de conversación | Recotiza desde cero, no arrastra el precio anterior |
| Mensaje de voz del cliente | Transcribir y tratar como texto |
| Mismo número escribe para dos hijos | Un `client` por número, `athlete_id` por hijo en la sesión (campo a definir si se da el caso) |
| Profesional mueve la cita directo en Google Calendar | Sin decisión aún — ver §3 |
| Escuela de una sola persona (dueño = único staff) | Probar que invitaciones, paneles de staff y reportes no asumen >1 miembro |

---

## 3. Decisiones y riesgos pendientes (no bloquean el schema, sí bloquean partes de la implementación)

**Antes de prometerle nada al segundo profesional piloto:**
- **Modelo de número de WhatsApp.** Cada número bajo el Tech Provider de Meta necesita registro, display name aprobado y verificación propia — con 3 profesionales piloto se maneja a mano, con 30 es un cuello de botella de Meta, no técnico. Falta decidir entre: **(a)** número propio por profesional (identidad clara — "te escribe Laura" — pero escala al ritmo de la verificación de Meta) o **(b)** número compartido de SportMaps con routing interno por `school_id` (escala rápido, pero el cliente le escribe "a SportMaps", no a su profesional). No es una decisión técnica, es de producto — no bloquea el MVP de un solo piloto, sí bloquea decirle que sí al segundo.

**Antes de ir a producción con cobros:**
- Confirmar que el webhook de pago existente (Wompi/MP/epayco, el que ya usa `payment_accounts`) es idempotente por referencia — si no, `process_professional_session_checkout` necesita su propio chequeo antes de marcar `confirmada` dos veces.
- Verificar si `school_payment_kpis()` / `useDashboardStatsReal` necesitan una rama explícita para `payment_category = 'professional_session'` (ver §0 bis, punto 2) o si el desglose genérico alcanza.

**Antes de escribir el prompt real:**
- Definir el formato de **golden transcripts** (conversaciones doradas) como suite de regresión del prompt — Playwright no valida esto. Es una convención de módulo, no una migración; buen entregable para fijar como parte del QA de este proyecto antes de que exista el primer prompt.

**Antes de la primera migración:**
- Censo de `select … from schools` en marketplace, dashboard de super admin, planes/facturación y reportes consolidados (§0 bis, punto 6).

**Producto, no bloqueante para el MVP de un profesional piloto:**
- Límite de costo/uso de LLM por profesional — no hay cuota definida, a diferencia de las "conversaciones IA/mes" que ya son parte de los planes de escuela.
- UX de cómo y cuándo se pide `clients.consent_at` — la columna ya existe, falta el flujo conversacional que lo capture.
- Resolución de `guardian_profile_id` — el campo ya está en el schema, falta definir el matching (por teléfono, por invitación) cuando se implemente `find_or_create_client`.

**Menor / higiene, para cuando se escriban las migraciones reales:**
- Enganchar trigger `set_updated_at()` en `sessions` (columna ya existe, nada la actualiza todavía).
- Envolver las llamadas a los helpers de RLS en `(SELECT fn())` dentro de las policies nuevas — la lección de rendimiento de agosto (`project_rls_helpers_not_wrapped`) aplica también acá.
- FK real de `clients.athlete_id` a confirmar contra el nombre vigente de la tabla de atletas al momento de migrar (no asumir `athletes` sin verificar).

---

## 4. Orden de implementación sugerido

1. Censo de `schools` (§0 bis, punto 6) y migración del `payment_category` nuevo (§0 bis, punto 2) — antes de tocar el resto, porque son los dos que "se resuelven después" si no se fijan ahora.
2. Migración de §1.2 y 1.3 (`professional_settings`, `service_catalog`, `escalation_rules`, `knowledge_items`, `clients`, `sessions`, `client_progress`, `agent_events`) con RLS vía los helpers de escuela ya existentes.
3. `_confirm_professional_session(session_id, payment_id)` como helper interno, y encima `process_professional_session_checkout` + `confirm_professional_session_manual` como RPCs `SECURITY DEFINER` públicas (§0 bis, puntos 1 y 3).
4. Cron `pg_cron` para `confirmada → atendida` (§0 bis, punto 4) — parte del módulo base, no espera al Agente 3.
5. Integración de `get_available_slots` / `create_session` contra el Módulo de Reservas (Google Calendar como espejo de solo lectura, ya cerrado).
6. Onboarding mínimo en el panel: `school_type='professional'`, `professional_settings`, catálogo, disponibilidad (reusa las pantallas del Módulo de Reservas).
7. Tools de 2.2 como Edge Functions; el envío de mensajes va directo al outbox del Despachador Unificado, `agent_events` queda aparte como auditoría.
8. Decidir el modelo de número de WhatsApp (§3) antes de sumar al segundo profesional piloto.
9. Agente de Ventas con un solo profesional piloto — antes de prender `agent_enabled`, tener los golden transcripts de §3 como gate de calidad.
10. Recién ahí: Agente 2 (Clínico), reutilizando `sessions` y `agent_events`, con el gate de `consent_at` desde el día uno.
