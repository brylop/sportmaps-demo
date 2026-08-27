# Spec — SportMaps Agents: contrato interno para generalizar Pay / Connect / Analytics

**Estado:** propuesta, sin código
**Origen:** revisión crítica de la analogía "Obsidian + plugins" (2026-08-24/25) — los agentes no son un producto aparte, son la capa de automatización sobre el ERP que ya es SportMaps
**Relacionado:** [[project_notifications_unified]] (outbox/dispatcher del que se toma el patrón), [[project_receipt_extraction_v2_glosas]] (Pay), [[project_whatsapp_wa1_wa2_built]] (Connect), [[project_athlete_reports]] (Analytics)

---

## 0. Encuadre — qué se está pidiendo en realidad

SportMaps ya es el CRM/ERP vertical de las escuelas: estudiantes, cobros, staff, comunicación, reportes, todo en una base. "Pay", "Connect" y "Analytics" no son un producto nuevo — son nombres para automatizaciones que **ya existen y ya corren en producción**, dispersas dentro del mismo backend. Lo que se pide no es construir un negocio nuevo ("otra app" no es "otro cliente/otra base de datos") — es darles un **contrato compartido** para que:

1. Cada agente se pueda tocar/desactivar sin arriesgar a los otros (el punto de la analogía del vault).
2. Sumar el agente #4 sea barato — definir un evento + un handler, no reescribir infraestructura cada vez.

---

## 1. Qué son los 3 agentes HOY, en código real (no aspiracional)

| Agente | Código actual | Qué hace | Cómo se dispara hoy |
|---|---|---|---|
| **Pay** | `ocr.service.ts` + `receipt-verdict.ts` + `receipt-approval.service.ts` + `glosa.service.ts` | Extrae comprobante (LLM), aplica reglas determinísticas (veredicto verde/amarillo/rojo), ciclo de glosa, auto-aprueba con doble extracción cruzada | Llamada HTTP síncrona: `POST /api/v1/payments/extract-receipt` y `/auto-evaluate`, disparada por el frontend en el checkout del padre |
| **Connect** | `whatsapp-bot.service.ts` + `llm.service.ts` | Orquestador de WhatsApp: identifica al padre, resuelve intent, llama tools, redacta respuesta, regla de cero alucinaciones | Webhook de Meta (mensaje entrante) → handler síncrono, responde en la misma request |
| **Analytics** | `report-snapshot.service.ts` + `report-delivery.service.ts` + `athlete-reports.job.ts` + `routes/reports.ts` + `routes/school/reports.ts` | Snapshots de KPIs, informes de rendimiento por atleta, entrega por email/push | Mezcla: algunos endpoints on-demand, algunos jobs con cron (`maintenance.job.ts`) |

**El hallazgo importante:** hoy no hay nada que los una salvo compartir el mismo proceso Node del BFF. Cada uno tiene su propio punto de entrada (ruta HTTP o cron), su propia forma de dispararse, y ninguno sabe que los otros existen. Eso ya es, sin querer, el 80% del punto de la analogía — falta el 20%: un contrato común para que sumar el próximo agente no implique inventar de nuevo cómo se dispara y qué pasa si falla.

---

## 2. Qué significa "más fuerte y más general", en concreto

**No es:** una re-plataforma nueva, un segundo servicio desplegado aparte, ni un motor de reglas tipo LangGraph.

**Es:** un outbox genérico propio — `agent_events` — que NO es el mismo que `notification_deliveries` (ver revisión anterior: ese está soldado a push/prefs/canales de notificación a humanos, no sirve para disparar lógica de negocio). Mismo patrón ya validado en producción (trigger → outbox → worker con lease-claim y reintentos, [[project_notifications_unified]] F1), tabla y consumidores propios.

```
agent_events
  id, event_type text, payload jsonb, school_id uuid nullable
  status text CHECK ('pending','claimed','done','failed')
  attempts int, claimed_until timestamptz, created_at

Productor                          agent_events (outbox)          Consumidor
──────────                         ───────────────────            ──────────
trigger DB (evento ya es una fila) ──► INSERT pending      ──►    worker BFF, mismo
  ej: cierre de mes (open_month)                                  proceso, lease-claim
                                                                   (igual patrón que
BFF encola explícito (evento hoy                                  notifications-dispatch)
es una llamada síncrona)          ──► INSERT pending      ──►         │
  ej: comprobante subido,                                             ├─ handler Pay
      mensaje de WhatsApp                                             ├─ handler Connect
                                                                        └─ handler Analytics
```

- **Productor por trigger:** cuando el evento de negocio ya es un INSERT/UPDATE real (cierre de mes, pago marcado `paid`) — un trigger `AFTER INSERT/UPDATE` encola en `agent_events`, igual que hoy lo hace `notifications`.
- **Productor por código:** cuando el evento hoy es una llamada HTTP síncrona (comprobante subido, mensaje de WhatsApp) — el BFF encola explícitamente después de manejar la request. **Ojo con Connect:** convertir "mensaje recibido" en 100% asíncrono le agrega latencia a una conversación que hoy responde en la misma request — evaluar caso por caso, no asumir que todo evento debe volverse async (ver §5, no es gratis).

---

## 3. Por qué NO separar en un segundo servicio/deploy todavía

Separar Pay/Connect/Analytics en un deploy propio (otro Render service) cuesta operativamente: 2+ sets de secrets, 2+ healthchecks, autenticación servicio-a-servicio, más superficie de fallo — y a la escala actual (6+ clubes) no hay un motivo real que lo justifique. Nadie necesita escalar Connect independiente de Pay hoy.

**Lo que sí se separa es el código**, en `bff/src/agents/{pay,connect,analytics}/`, con una regla dura: un agente solo puede leer de `agent_events` y llamar a sus propias tablas/servicios — nunca importa código de otro agente directamente. Eso da la generalidad real (se puede apagar un agente sin tocar los otros, exactamente el punto de la analogía del vault) sin pagar el costo de infraestructura de microservicios que nadie necesita todavía.

**Se migra a servicio propio el día que:** (a) un agente necesita escalar distinto de los demás (ej. Connect con miles de conversaciones simultáneas), o (b) se empieza a vender como capacidad separada a otro negocio. Ninguno de los dos es el caso hoy — diseñar para eso ahora sería la abstracción prematura que el propio `CLAUDE.md` del repo pide evitar.

---

## 4. Riesgos que NO hay que heredar

- El trigger de notificaciones de pagos (`fn_notify_on_payment_created`) **no está versionado en el repo** y tiene bugs conocidos (no llena `school_id`, se salta destinatarios sin `parent_id` — ver [[project_unversioned_schema_drift]] y [[project_payments_null_payer_minors]]). Cualquier trigger nuevo de `agent_events` se escribe versionado desde el día 1, con `npm run migrations:new`, sin excepciones.
- `notification_deliveries` no se toca ni se reutiliza — outbox propio para `agent_events`, tablas separadas, para no mezclar semántica de "avisarle a un humano" con "disparar lógica de negocio".
- Mismas convenciones de siempre: `search_path` fijo en toda función nueva, `GRANT EXECUTE` explícito, RLS sin auto-recursión, estados `TEXT + CHECK`.

---

## 5. Fases

| Fase | Alcance | Riesgo |
|---|---|---|
| **F0** | Mover el código de Pay/Connect/Analytics a `bff/src/agents/*` **sin cambiar comportamiento** — refactor puro de carpetas/imports, cero lógica nueva. | Ninguno — es reordenar, no reescribir |
| **F1** | Tabla `agent_events` + worker (mismo patrón lease-claim que notifications F1) + **un solo evento real de punta a punta** como prueba de concepto: `period-closed` → Analytics (es el único de los tres candidatos que ya es un evento discreto de base de datos, no una llamada síncrona). | Bajo — un solo productor, un solo consumidor, patrón ya probado |
| **F2** | Evaluar sumar productores para Pay (comprobante subido) y Connect (mensaje recibido) **caso por caso**, midiendo el trade-off de latencia de §2 antes de mover nada a async. | Medio — acá es donde se decide si vale la pena para cada uno, no se asume que sí |
| **F3** | Recién si en F2 aparece una necesidad real de escalar un agente distinto de los demás: evaluar separar deploy. | No se construye hasta que haya un motivo concreto |

**Qué NO se construye ahora:** registro genérico de plugins, marketplace de agentes, API de suscripción dinámica. Eso tiene sentido con 5+ agentes reales compitiendo por los mismos eventos — con 3 agentes conocidos y de dueño único, un `switch` por `event_type` dentro del worker alcanza y es más fácil de debuggear que una capa de indirección.
