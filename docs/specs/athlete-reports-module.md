# Spec — Informe Mensual del Atleta

**Producto:** SportMaps · **Versión:** v0.3 (contradicción temporal de D17 resuelta — listo para plan de F1)
**Fecha:** Julio 2026
**Estado:** 🟢 decisiones resueltas (ver §14). Pendiente: plan de migraciones aprobado antes de escribir código (convención del repo).

> Se construye **por fases con revisión entre cada una** (una rama por fase). Plan aprobado antes de código en migraciones. RLS revisado línea por línea. Tests de concurrencia en la fase backend.

**Cambios v0.2 → v0.3 (contradicción temporal en D17):**

- **H7 — D17 se contradecía con su propio calendario.** Prometía congelar «las notas de todos sus equipos» al publicar, y publicaba en el `send_day` **más temprano** — antes de que venciera el plazo del segundo coach. La nota del equipo B no se perdía en un caso raro: **se perdía siempre**, y el snapshot es la única fuente del padre y del PDF. Peor, el caso de QA «falta la nota del no gobernante → igual publica» documentaba el bug como comportamiento correcto. → **D17 pasa al `send_day` más tardío.**
- **H8 — El coach del equipo no gobernante no podía ver el informe donde va su propia nota**, y el atleta compartido desaparecía de su tablero, porque la RLS resolvía por `athlete_reports.team_id` (= gobernante). → **D19**, helper `coach_can_see_report()`.
- **F6 gana la adopción al vincular acudiente** (§15.1): se engancha donde ya vive `adopt_orphan_payments_on_child_link()`. Ataca R7 por el otro lado y es barato.
- Encabezado duplicado en la tabla de §10, corregido.

**Cambios v0.1 → v0.2 (revisión contra el código y la realidad operativa):**

- **H1 — Para la mayoría de los atletas no hay destinatario.** Todo el flujo asumía un padre al otro lado del push. En Dynasty la foto era ~415 de 419 atletas **sin acudiente vinculado**: sin cuenta que abra la app, sin token de push, y con el correo del acudiente viviendo en la invitación pendiente, no en un perfil. El módulo depende del embudo de onboarding más de lo que reconocía. → **D16**, nueva columna de cobertura, nuevo riesgo R7.
- **H2 — La cascada anti-spam era inimplementable.** FCM confirma *aceptación*, no *entrega*: el teléfono puede estar apagado o el permiso revocado en el SO sin invalidar el token. «Push entregado y no abierto» no es verificable. Peor: hacía esperar 24 h a las familias **sin app**, que son justo las que solo tienen correo. → §7 reescrita con una condición verificable.
- **H3 — «Coach: UPDATE solo `coach_note`» no se puede expresar con RLS.** Las policies de Postgres son por fila, no por columna. La nota individual pasa a entrar **solo por RPC**; la tabla no tiene UPDATE directo para el coach. → §9, §10.
- **H4 — Las RPCs `SECURITY DEFINER` no validaban al caller.** `mark_report_viewed` con `GRANT … TO authenticated` y sin check interno permite a cualquier usuario marcar como visto (o inflar `view_count` de) cualquier informe adivinando UUIDs — y como `viewed_at` gobierna la cascada, además suprime el correo de otra familia. Aplica a **todas** las RPCs, no solo a esa. → §10.
- **H5 — El atleta en dos equipos no tenía decisión**, solo un caso de QA. `team_id` es singular: faltaba definir qué nota lleva, qué día lo gobierna y quién lo ve en su avance. → **D17**.
- **H6 — `scheduled_for` se congelaba y el calendario podía cambiar después.** Borradores generados el 24, calendario ajustado el 26 → el job publica con la fecha vieja. → **D18**.
- **Menores:** el PDF renderiza el `snapshot`, nunca datos vivos (§12); el job es **diario**, no mensual (§11); el subdominio nuevo necesita warm-up (R1); D12 distingue «sin mediciones pero con asistencia» de «sin actividad»; R4 se mitiga generando el borrador de los rótulos con IA para que el coach solo revise.

---

## 0. Contexto — qué existe HOY (no reinventarlo)

Casi toda la infraestructura ya está construida. Este módulo es sobre todo **cableado y producto**, no plataforma nueva.

| Pieza | Dónde | Estado |
|---|---|---|
| Datos de rendimiento | `performance_entries`, `sport_metric_definitions` (+ `min_value`/`max_value`/`higher_is_better`), `sport_metric_thresholds` | ✅ en uso |
| Catálogo unificado | `bff/src/services/metric-catalog.service.ts` | ✅ alimenta rutas school y athlete |
| Presentación compartida | `frontend/src/lib/school/performanceDisplay.ts` (paleta, bandas, `computeDelta`) | ✅ |
| PDF con branding | `bff/src/routes/certificates.ts` — `pdfkit` + `resolveSchoolBranding`, gate por tier | ✅ patrón probado |
| Correo por lotes | `bff/src/routes/invitations.routes.ts` — `/emails/batch`, `sendBatchWithRetry`, lotes de 100 + `delayMs` | ✅ patrón probado |
| Log de correo | tabla `email_sends` (`20260730000001_email_sends_log.sql`) — permite reintentar solo las que fallaron | ✅ |
| Push unificado | `notification.service.ts` → `push.service.ts` (FCM, `firebase-admin`) + `webpush.service.ts` (VAPID); respeta `push_notifications` | ✅ **funciona** |
| Disparo de notificaciones | `internal-notifications.routes.ts` (inmediato) + `jobs/notifications-dispatch.job.ts` (red de seguridad) | ✅ |
| Jobs programados | `bff/src/jobs/` (3 jobs) + crons de `pg_cron` leyendo toggles de `school_settings` | ✅ patrón probado |
| Coach → equipos | `team_coaches` con policies; identidad del coach vía `school_staff.id` (`coach_auth_id`) | ✅ |
| Imagen en cliente | `html2canvas` + `jspdf` | ✅ instalados y en uso |
| Plan Resend | **Pro** — el techo de volumen no es problema | ✅ |

### 0.1 Lo que NO existe

- Ningún informe consolidado, ni en PDF ni en pantalla.
- El padre no recibe **ningún** aviso cuando se registra una evaluación de su hijo.
- Las métricas solo tienen nombre técnico (`display_name`): «GMB Saque a los Lados» va directo a la cara del padre.
- No hay noción de nota del entrenador por periodo.
- WhatsApp funciona **enviando por web** (manual), no como emisor masivo.

---

## 1. El problema que resuelve

La app guarda buenos datos de rendimiento y el padre no los ve. Solo aparecen si entra por su cuenta a `/academic-progress`, y cuando entra encuentra 51 métricas con el vocabulario del entrenador.

Tres consecuencias:

1. **El módulo no se percibe.** La escuela paga por «yo informo a las familias» y la familia no siente que le informen.
2. **El dato más valioso muere en la base.** Una evaluación registrada que nadie lee no cambió nada.
3. **No hay nada que llevarse.** Ni guardar, ni imprimir, ni mandarle a la abuela.

El informe mensual convierte datos en un servicio percibido, y de paso da una razón recurrente para abrir la app.

---

## 2. Decisiones resueltas (resumen ejecutivo)

- **El coach es el autor, la escuela publica.** Son dos responsabilidades distintas; meterlas en un botón es el error (D1, D2).
- **La nota es por equipo, obligatoria; la individual es opcional.** Un coach con 4 equipos no va a escribir 60 notas — sí escribe 4 párrafos (D3). **Aquí está el riesgo de fracaso del módulo, no en el PDF.**
- **Liberación por excepción, no revisión ítem por ítem.** El admin ve cobertura, no lee 500 notas; los informes salen solos salvo retención (D2).
- **Calendario reparte la última semana:** un día por equipo. Distribuye la carga del coach y elimina el pico de correo (D4).
- **Canales: push + correo con enlace.** WhatsApp fuera de v1 (D5). **El PDF no se adjunta** — se descarga desde la app (D6).
- **El informe es un registro, no un archivo.** El PDF se arma al vuelo; lo que se congela son los destacados (D7, D8).
- **Sin percentil contra compañeros en el informe del padre** (D9).
- **Prerrequisito duro: rótulos para el padre.** Sin eso, mandar un informe es mandar ruido con logo (D10) → es F0 y shippea sola.
- **Publicado ≠ enviado.** Para la mayoría de los atletas hoy **no hay destinatario**: se genera y se archiva, y el hueco se vuelve la palanca del admin para cerrar el onboarding (D16, R7).
- **La cascada se decide por «¿tiene canal de push?», no por «¿se entregó?»** — lo segundo no es verificable (§7.1).

---

## 3. Modelo conceptual

### 3.1 El ciclo

```
día 24 (config)      generate_report_drafts()
                     → borrador por atleta con mediciones del mes
                     → notifica a cada coach: "tienes N informes por firmar"
                            ↓
día 24 → día D       el coach escribe la nota de EQUIPO (obligatoria)
                     y notas individuales donde valga la pena
                     ve su avance: "18 de 22 listos"
                            ↓
día D del equipo     publish_team_reports() — automático
  (última semana)    salvo que el admin lo haya retenido
                            ↓
                     push al padre + correo con enlace (lotes de 100)
                            ↓
                     el padre abre en la app → viewed_at
                     descarga PDF solo si quiere
                            ↓
día D+3              si no lo abrió → recordatorio (una sola vez)
```

### 3.2 Estados del informe

`text + CHECK`, **no** `CREATE TYPE` (convención del repo).

| Estado | Significado | Quién lo mueve |
|---|---|---|
| `borrador` | Generado con datos, sin nota del equipo gobernante | sistema |
| `listo` | Nota de equipo escrita; esperando su día | coach (al escribir la nota) |
| `publicado` | Snapshot congelado. **Publicado ≠ enviado** (ver D16) | sistema o admin |
| `retenido` | El admin lo frenó antes de salir | admin (con motivo) |
| `omitido` | El mes cerró sin nota y sin override | sistema |

El envío se registra aparte (`sent_at`, `email_sends`, `notifications`) porque un informe puede estar **publicado y sin destinatario** — es un estado normal, no un error (D16).

`visto` **no** es un estado: es `viewed_at` sobre `publicado` (un informe no deja de estar publicado por leerse).

### 3.3 Quién hace qué

| | Coach | Admin escuela | Padre |
|---|---|---|---|
| Escribir nota de equipo | ✅ sus equipos | ✅ | — |
| Escribir nota individual | ✅ sus equipos | ✅ | — |
| Ver cobertura de la escuela | solo sus equipos | ✅ todo | — |
| Retener / publicar manualmente | según `school_settings` | ✅ | — |
| Publicar sin nota (override) | ❌ | ✅ con motivo | — |
| Ver el informe | ✅ | ✅ | ✅ solo sus hijos |

---

## 4. El calendario de la última semana

El admin asigna a cada equipo un **día de envío**. El default reparte los equipos existentes entre los últimos 7 días del mes.

Por qué reparte y no manda todo el día 1:

- **Carga del coach.** 60 notas en un día no pasan; 15 por día sí.
- **Entregabilidad.** 500 correos concentrados desde el mismo dominio se leen como campaña masiva. Cinco días de 100 es un patrón sano. Los lotes de 100 del emisor existente cubren cada día con 1 request.
- **Contención de daño.** Si el informe sale con un error, se detecta el primer día y no salieron los 500.

`send_day` es día del mes (`CHECK BETWEEN 1 AND 31`), con clamp al último día real del mes en la RPC. El borrador se crea `draft_lead_days` antes (default 5).

---

## 5. La nota del entrenador

**La decisión más importante del spec.**

- **Nota de equipo** (`team_report_notes`): una por equipo+periodo. **Obligatoria para publicar.** Responde «qué trabajamos este mes, qué viene el siguiente». Es el contexto que un padre entiende.
- **Nota individual** (`athlete_reports.coach_note`): **opcional**, para los casos que lo merecen.

Un coach con 4 equipos escribe 4 párrafos en veinte minutos y agrega 5 notas individuales. Eso sí ocurre todos los meses. Exigir 60 notas individuales garantiza que el módulo se muera en el segundo mes.

**Si el coach no escribe la nota de equipo:** el lote **no sale** (queda `listo`), el admin lo ve en el tablero y recibe aviso. El admin puede publicar con override explícito (`published_without_note = true` + motivo, auditado). Un informe sin ninguna nota es un reporte de sistema — no queremos que sea el camino fácil, pero tampoco bloquear a la escuela.

Recordatorios al coach: al generarse el borrador, 2 días antes y el día D en la mañana.

---

## 6. Contenido del informe

Ninguna métrica aparece con su nombre técnico.

1. **Cabecera** — logo y nombre de la escuela (branding por tier, igual que `certificates.ts`), periodo.
2. **Atleta** — nombre, categoría, con quién entrena.
3. **Lo que más mejoró** — top 3 por delta normalizado, respetando `higher_is_better`. Rótulo de padre.
4. **Asistencia del mes** — sesiones asistidas / programadas + banda.
5. **En qué se va a trabajar** — hasta 3 métricas en banda `yellow`/`red`.
6. **Notas del entrenador** — la de equipo **de cada equipo en que entrenó el periodo** (D17), y la individual si existe.
7. **Radar de perfil** — hoy vs. inicio del periodo comparado (reusa la normalización de la opción E ya diseñada).
8. **Próximo evento** — si hay algo en `events`.
9. **Pie** — enlace a la app.

**No incluye:** comparación con compañeros ni percentil (D9).

---

## 7. Canales

Cada canal tiene un trabajo distinto. Si los tres llevan lo mismo, el correo canibaliza la app.

| Canal | Contenido | Por qué |
|---|---|---|
| **Push** (app) | Titular: «Valentina mejoró en 3 de 4 áreas en agosto» + deep link | Es el gancho. Llega al teléfono y abre la app. Ya funciona (FCM + web push). |
| **App** | Informe completo e interactivo: toca una métrica y ves su historia, radar, compartir, descargar PDF | Es el destino. Hace cosas que un PDF no puede. |
| **Correo** | Resumen corto + **enlace**, nunca adjunto | Red de seguridad para quien no tiene la app o no dio permiso de push. |
| ~~WhatsApp~~ | — | Fuera de v1 (D5). |

### 7.1 Cascada — condición verificable, no «entrega»

FCM y web push confirman que **aceptaron** el mensaje, no que llegó: el teléfono puede estar apagado, la app desinstalada sin invalidar el token, o el permiso revocado en el SO. Así que la cascada **no** puede condicionarse a «el push se entregó».

Lo que sí es verificable es si el destinatario tiene un **canal de push vivo**: una fila activa en `user_devices` (nativo, no revocada) o en `push_subscriptions` (web). Ambos servicios ya **podan tokens muertos** solos — `webpush.service.ts` borra en 404/410 y `push.service.ts` revoca con `revoked_reason='push_token_unregistered'` — así que la pregunta se contesta con confianza razonable.

| Situación al publicar | Qué se manda | Por qué |
|---|---|---|
| **Sin canal de push vivo** | **Correo inmediato** | Es su único canal. La v0.1 lo hacía esperar 24 h, castigando justo a las familias sin app — que en el primer año son probablemente la mayoría. |
| **Con canal de push vivo** | Push ahora; correo a las 24 h si `viewed_at` sigue `NULL` | El push es el gancho; el correo es la red. |
| **El push falla y poda el token** | **Correo inmediato**, no a las 24 h | La poda ocurre en el mismo despacho: ya sabemos que no hay canal, no hay nada que esperar. |
| **Sin destinatario** (D16) | **Nada** | No hay a quién mandarle. No cuenta como pendiente de envío. |

A los 3 días sin abrir, un único recordatorio. Nunca tres avisos por el mismo informe.

**Agrupación por destinatario:** si un padre tiene 2+ hijos con informe el mismo día, va **un** correo con los enlaces de todos (D15).

**Reputación de dominio:** los informes salen por un subdominio distinto al transaccional crítico (cobros, invitaciones, recuperación de contraseña), con SPF/DKIM/DMARC en ambos. Un boletín que nadie pidió no puede envenenar la entregabilidad de los cobros. → §16 R1.

---

## 8. Modelo de datos (a validar en el plan)

> Convenciones obligatorias: `text + CHECK` (no `CREATE TYPE`), FKs de negocio a `public.profiles(id)`, `SET search_path = pg_catalog, public, pg_temp` en toda función nueva, `GRANT EXECUTE` explícito por RPC, migración creada con `npm run migrations:new -- <slug>`.

### 8.1 `athlete_reports` — el registro (uno por atleta+periodo)

```
id                      uuid pk
school_id               uuid not null → schools(id)
branch_id               uuid null → school_branches(id)   -- reservado (D13)
team_id                 uuid null → teams(id)             -- equipo GOBERNANTE (D17), no "el" equipo
subject_type            text not null CHECK (subject_type IN ('profile','child','unregistered'))
subject_id              uuid not null                     -- mismo eje que performance_entries
period_year             smallint not null
period_month            smallint not null CHECK (period_month BETWEEN 1 AND 12)
status                  text not null DEFAULT 'borrador'
                        CHECK (status IN ('borrador','listo','publicado','retenido','omitido'))
scheduled_for           date not null                     -- día que le toca salir
snapshot                jsonb null                        -- congelado al publicar (§8.4)
snapshot_version        smallint not null DEFAULT 1
coach_note              text null                         -- individual, opcional
coach_note_by           uuid null → school_staff(id)      -- ⚠️ staff id, NO auth.uid()
published_at            timestamptz null
published_by            uuid null → profiles(id)
published_without_note  boolean not null DEFAULT false
hold_reason             text null
recipient_id            uuid null → profiles(id)          -- resuelto al publicar; NULL = sin destinatario (D16)
sent_at                 timestamptz null                  -- publicado ≠ enviado
viewed_at               timestamptz null                  -- primera apertura
view_count              integer not null DEFAULT 0
created_at / updated_at timestamptz
```

Índice único: `UNIQUE (school_id, subject_type, subject_id, period_year, period_month)`.

> ⚠️ **Lección de `payments`:** el índice único parcial de cobros solo cubría menores (`WHERE child_id IS NOT NULL`) y dejó a los adultos sin red de DB. Aquí el eje es `subject_type + subject_id`, que cubre los tres tipos sin índice parcial. **No introducir columnas separadas por tipo de sujeto.**

### 8.2 `team_report_notes` — la nota de equipo

```
id            uuid pk
school_id     uuid not null → schools(id)
team_id       uuid not null → teams(id)
period_year   smallint not null
period_month  smallint not null CHECK (period_month BETWEEN 1 AND 12)
body          text not null CHECK (length(btrim(body)) >= 20)
author_id     uuid not null → school_staff(id)   -- ⚠️ staff id
created_at / updated_at timestamptz
UNIQUE (team_id, period_year, period_month)
```

### 8.3 `report_team_schedule` — el calendario

```
id         uuid pk
school_id  uuid not null → schools(id)
team_id    uuid not null → teams(id)
send_day   smallint not null CHECK (send_day BETWEEN 1 AND 31)
UNIQUE (school_id, team_id)
```

Config en `school_settings` (tabla, no el JSONB legacy de `schools.payment_settings`):
`reports_enabled`, `reports_release_by` (`'school'` \| `'coach'`), `reports_draft_lead_days` (default 5), `reports_reminder_days` (default 3).

### 8.4 Qué congela `snapshot` al publicar

Destacados (top 3 con su delta), métricas a trabajar, asistencia del mes, datos del radar, nombre de los equipos y del coach, **las notas de equipo de todos sus equipos del periodo** (D17), la nota individual, y los rótulos de padre vigentes.

**El snapshot es la única fuente de la vista del padre y del PDF.** Ni la pantalla ni `GET /reports/:id/pdf` leen `performance_entries` — si lo hicieran, el PDF diferiría de lo que el padre vio y se rompería justo lo que D8 protege.

**Por qué congelar:** un informe que el padre ya leyó no puede cambiar en silencio si mañana se corrige una medición. La regeneración es **explícita, versionada y auditada** — mismo patrón que la reapertura de cierre de mes (`snapshot_version` sube, el anterior se archiva).

---

## 9. RLS (revisar línea por línea antes de aplicar)

- **Padre:** `SELECT` en `athlete_reports` solo si `status = 'publicado'` **y** el sujeto es su hijo (`children.parent_id = auth.uid()`) o él mismo. Un borrador nunca es visible para la familia.
- **Coach:** `SELECT` de informes de **cualquier atleta que entrene en alguno de sus equipos en el periodo** — vía `coach_can_see_report()` (`SECURITY DEFINER`), **no** por `athlete_reports.team_id`, que solo marca el equipo gobernante (D19). `INSERT`/`UPDATE` en `team_report_notes` de sus equipos.
- **Admin escuela:** todo dentro de su escuela, vía `is_school_admin()`.
- **Super admin:** vía `is_super_admin()`.

### 9.1 Nadie hace UPDATE directo sobre `athlete_reports`

**Las policies de Postgres son por fila, no por columna.** «El coach puede actualizar solo `coach_note`» **no se puede expresar con una policy** — una policy de UPDATE le deja tocar `status`, `snapshot` y todo lo demás.

Postgres sí tiene privilegio por columna (`GRANT UPDATE (coach_note) ON athlete_reports TO authenticated`), pero la opción coherente con el resto del diseño es la otra: **`athlete_reports` no otorga `UPDATE` a `authenticated` en absoluto.** Toda escritura pasa por las RPCs de §10, que son las que conocen las reglas de estado. La nota individual entra por `set_athlete_report_note`.

`team_report_notes` sí acepta escritura directa del coach: es una tabla de texto plano sin máquina de estados, y la policy por fila (su equipo, su escuela) alcanza.

> **Sin self-recursion:** ninguna policy sobre `athlete_reports` hace `SELECT FROM athlete_reports`. La resolución padre→hijo va en una función `SECURITY DEFINER`.
> **No revocar** `EXECUTE` de los helpers (`is_school_admin`, `is_super_admin`) al rol que las invoca desde policies — rompe con 403 todas las queries.

---

## 10. RPCs (`SECURITY DEFINER`, patrón del repo)

| RPC | Qué hace | Quién puede (validado DENTRO) |
|---|---|---|
| `generate_report_drafts(p_school_id, p_year, p_month)` | Crea borradores para atletas **con mediciones en el periodo**. Resuelve el equipo gobernante (D17) y `scheduled_for` | service_role / admin. **Idempotente** (`ON CONFLICT DO NOTHING`), nunca pisa notas ya escritas. |
| `set_athlete_report_note(p_report_id, p_note)` | Escribe la nota individual | Coach del equipo gobernante o admin de la escuela. Rechaza si el informe ya está `publicado`. |
| `publish_athlete_report(p_report_id, p_override_note, p_reason)` | Congela snapshot, resuelve `recipient_id`, pasa a `publicado`, encola notificación | Admin, o coach si `reports_release_by='coach'`. `SELECT … FOR UPDATE`; rechaza si ya está `publicado`. |
| `publish_team_reports(p_school_id, p_team_id, p_year, p_month)` | Publica el lote del equipo | Igual. Exige nota del equipo gobernante salvo override. |
| `hold_athlete_report(p_report_id, p_reason)` | Pasa a `retenido`, motivo obligatorio | Solo admin. Auditado. |
| `regenerate_report_snapshot(p_report_id, p_reason)` | Recalcula y sube `snapshot_version` | Solo admin. Archiva el anterior. |
| `mark_report_viewed(p_report_id)` | Setea `viewed_at` la primera vez, incrementa `view_count` | **Solo el destinatario**: `recipient_id = auth.uid()` o el propio sujeto. |
| `report_coverage(p_school_id, p_year, p_month)` | Agregado por equipo para el tablero (§10.2) | Admin de la escuela; coach limitado a sus equipos. |
| `reschedule_pending_reports(p_school_id, p_year, p_month)` | Re-fecha los borradores no publicados tras cambiar el calendario (D18) | Admin. |
| `coach_can_see_report(p_report_id)` | Helper de visibilidad: ¿el caller entrena alguno de los equipos del atleta en ese periodo? (D19) | Helper de policy. **No revocar `EXECUTE`** al rol que la invoca desde la policy. |
| `adopt_reports_on_child_link(p_child_id, p_parent_id)` | Al vincular acudiente: resuelve `recipient_id` del informe publicado más reciente y notifica **solo ese** (F6) | Se engancha donde ya vive `adopt_orphan_payments_on_child_link()`. |

### 10.1 La autorización va DENTRO de cada función

`SECURITY DEFINER` **corre con los privilegios del dueño y salta la RLS**. Con `GRANT EXECUTE … TO authenticated`, cualquier usuario autenticado puede invocar cualquiera de estas RPCs con cualquier UUID. **Cada función valida al caller en su cuerpo, sin excepción.**

El caso más fácil de subestimar es `mark_report_viewed`: sin el check interno, cualquier usuario autenticado adivinando UUIDs puede marcar informes ajenos como vistos e inflar `view_count`. Y como `viewed_at` gobierna la cascada de §7, eso además **suprime el correo de otra familia** — un fallo de disponibilidad, no solo de integridad.

Recordar también la otra mitad: `SECURITY DEFINER` **no** exime al caller de tener `EXECUTE`. `GRANT EXECUTE … TO authenticated` explícito por cada RPC.

### 10.2 Buckets de `report_coverage`

Para el tablero del admin. Los tres últimos son nuevos de la v0.2 y son la mitad del valor del tablero:

| Bucket | Significado |
|---|---|
| `listos` | Nota escrita, esperando su día |
| `faltan_nota` | Borrador sin nota de equipo → el coach debe actuar |
| `publicados` | Snapshot congelado |
| `leidos` | `viewed_at` no nulo |
| **`sin_destinatario`** | Publicado pero sin acudiente activo (D16). **Para el admin es el mejor argumento para perseguir a las familias que no activaron cuenta.** |
| **`sin_mediciones_con_asistencia`** | Asistió pero nadie lo midió → el coach debe medir, no es que el atleta no viniera (D12) |
| **`sin_actividad`** | Ni mediciones ni asistencia |

---

## 11. BFF / API

```
GET    /api/v1/school/reports?year&month              cobertura + listado (coach ve sus equipos)
GET    /api/v1/school/reports/:id                     detalle
PUT    /api/v1/school/reports/:id/note                nota individual
PUT    /api/v1/school/teams/:teamId/report-note       nota de equipo
POST   /api/v1/school/reports/:id/publish             publicar suelto
POST   /api/v1/school/reports/:id/hold                retener
POST   /api/v1/school/teams/:teamId/reports/publish   publicar lote
GET    /api/v1/school/reports/schedule                calendario
PUT    /api/v1/school/reports/schedule                asignar días (re-fecha borradores pendientes, D18)

GET    /api/v1/athlete/reports?child_id               listado del padre (solo publicados)
GET    /api/v1/athlete/reports/:id                    detalle + marca visto
GET    /api/v1/athlete/reports/:id/pdf                PDF al vuelo (pdfkit + branding)
```

Documentar en `docs/api/openapi.yaml`.

**Job DIARIO** en `bff/src/jobs/athlete-reports.job.ts`, calcado de los 3 existentes. Es diario, no mensual: publica los lotes que caen hoy, evalúa la ventana de 24 h de la cascada y los recordatorios de 3 días — nada de eso funciona corriendo una vez al mes.

1. Genera borradores del periodo en curso, `draft_lead_days` antes del `send_day` **más temprano de la escuela** — así todos los borradores existen antes de que empiece a publicarse cualquiera. (No confundir con D17: ese «más tardío» decide qué equipo *gobierna* un atleta compartido, no cuándo se crean los borradores.)
2. Publica los lotes cuyo `scheduled_for` es hoy y no están `retenido`.
3. Emite según §7.1: push vía `notification.service`; correo por lotes de 100 con `sendBatchWithRetry` + log en `email_sends`; **nada si `recipient_id` es NULL**.
4. Correo diferido: publicados hace ≥24 h con canal de push y `viewed_at` NULL.
5. Recordatorios: coach (borradores sin nota) y padre (publicado hace 3 días sin abrir, una sola vez).

---

## 12. Frontend

**Coach** — `/coach-reports` (la página ya existe, se le agrega pestaña «Informes del mes»): lista de sus equipos con avance («18 de 22 listos»), un textarea para la nota de equipo, notas individuales en línea, y **cuántas familias leyeron el informe del mes pasado** (§13).

**Admin** — tablero de cobertura por equipo: listos / faltantes / publicados / leídos. Botones de retener y publicar. Calendario de días por equipo. No lee 500 notas: ve huecos y hace muestreo.

**Padre** — nueva sección **Informes** en `/academic-progress`: los meses se acumulan, el más reciente arriba. Detalle interactivo (reusa `MetricSummary`, `MetricTrendChart`, el radar), botón de descargar PDF y de compartir imagen (`html2canvas`).

> Un informe que solo existe como notificación se pierde. El archivo que crece mes a mes es en sí mismo la razón para volver a abrir la app.

---

## 13. Auditoría e incentivo

Auditoría con `audit_trigger_func` en `athlete_reports` y `team_report_notes`. Quedan registrados quién escribió, quién publicó, quién retuvo y con qué motivo, y toda regeneración de snapshot.

**El incentivo al coach no son los recordatorios.** Son dos cosas:

1. **Su propio avance visible** — la barra llenándose mueve más que una notificación.
2. **Saber que lo leyeron.** Si escribe 22 notas al vacío, el mes siguiente escribe 5. Si ve «17 familias leyeron tu informe», escribe las 22. El `viewed_at` que sirve para medir el canal sirve igual para cerrarle el ciclo al entrenador.

---

## 14. DECISIONES — RESUELTAS

| # | Pregunta | Decisión | Justificación |
|---|---|---|---|
| D1 | ¿Quién escribe el informe? | **El coach es el autor** | Es el único que vio entrenar al niño. La nota no se automatiza ni se delega. |
| D2 | ¿Quién lo envía? | **La escuela publica, por excepción.** Config `reports_release_by` | Es el nombre de la escuela en el correo y quien recibe la llamada. Pero revisar 500 notas colapsa en el mes 2 → tablero de cobertura + liberación automática salvo retención. Escuela chica puede delegar al coach. |
| D3 | ¿Nota obligatoria por atleta? | **No. Nota de EQUIPO obligatoria, individual opcional** | 60 notas no pasan; 4 párrafos sí. **Aquí está el riesgo de fracaso del módulo.** |
| D4 | ¿Cuándo sale? | **Última semana, un día por equipo** (configurable) | Reparte la carga del coach, evita el pico de correo que los filtros leen como campaña, y contiene el daño si sale con error. |
| D5 | ¿WhatsApp? | **Fuera de v1** | Hoy es envío web manual (500 a mano, imposible). Por API exige plantilla aprobada por Meta y cobra por mensaje: trámite recurrente + factura. Queda para lo conversacional, donde ya funciona. |
| D6 | ¿PDF adjunto? | **No. Enlace; PDF se descarga desde la app** | Los adjuntos suben el puntaje de spam y pesan; el enlace empuja a la app (que es el objetivo); y la mayoría de padres mira sin descargar → generar 500 PDFs mensuales que nadie abre es cómputo tirado. |
| D7 | ¿El informe es archivo o registro? | **Registro; el PDF se arma al vuelo** | Hace medible `viewed_at`, permite el archivo histórico, evita almacenar 500 archivos/mes y permite regenerar si se corrige una medición. |
| D8 | ¿El snapshot se congela? | **Sí, al publicar. Regeneración explícita y versionada** | Un informe que el padre ya leyó no puede cambiar en silencio. Mismo patrón que la reapertura de cierre de mes. |
| D9 | ¿Percentil contra el equipo? | **No en el informe del padre** | Para un coordinador es útil; para un padre es combustible de comparación entre niños, y en deporte formativo eso se vuelve presión sobre el atleta. Queda del lado escuela. |
| D10 | ¿Nombres técnicos al padre? | **No. `parent_label` + `parent_hint`, opcionales con fallback** | «GMB Saque a los Lados» no se manda a una familia. Es **prerrequisito duro**: sin esto el informe es ruido con logo. ⚠️ El costo real no es técnico, son 51 rótulos por deporte que alguien redacta. |
| D11 | ¿Y si el coach no escribe? | **El lote no sale; el admin lo ve y puede publicar con override + motivo** | El valor entero está en la nota. No queremos que salir sin nota sea el camino fácil, pero tampoco bloquear a la escuela. |
| D12 | ¿Atletas sin mediciones? | **No se genera informe. Pero la cobertura distingue «sin mediciones con asistencia» de «sin actividad»** | Mandar «este mes no medimos nada» es peor que no mandar. Pero el atleta que asistió todo el mes y nadie midió es un problema **del coach**, no del atleta, y merecía un bucket propio: es la señal de que hay que medir, no de que el niño no vino. |
| D13 | ¿Multi-sede? | **Por escuela en v1; `branch_id` reservado** | Mismo criterio que el cierre de mes: por sede multiplica y el `branch_id` histórico no es confiable. |
| D14 | ¿Se mide la lectura? | **Sí — `viewed_at` + `view_count`** | Sin esto no se sabe si la app le gana al correo y toda la discusión de canales queda en intuición. Además cierra el ciclo al coach. |
| D15 | ¿Padre con varios hijos? | **Un correo con los enlaces de todos** | Tres correos el mismo día al mismo padre es la forma más rápida de que silencie el remitente. |
| **D16** | **¿Informe para atleta sin acudiente vinculado?** | **Sí se genera y se publica, pero no se envía.** `recipient_id` NULL, bucket `sin_destinatario` en cobertura. Para `unregistered`: se genera **explícitamente para consumo interno**, nunca se intenta enviar | El coach ya hizo el trabajo, y el archivo histórico vale cuando la familia llegue. Pero hay que dejar de mentirse: en Dynasty eran ~415 de 419 atletas sin acudiente — sin cuenta, sin token de push, y con el correo viviendo en la invitación pendiente, no en un perfil. **Publicado ≠ enviado.** Y para el admin, la lista de «sin destinatario» es el mejor argumento que va a tener para perseguir a las familias que no activaron cuenta: convierte un problema de onboarding en una acción concreta. |
| **D17** | **¿Atleta en dos equipos?** | **Un solo informe. Gobierna el equipo con `send_day` MÁS TARDÍO.** El snapshot incluye las notas de todos sus equipos del periodo. Publicar exige la nota del equipo gobernante; las demás entran si existen | Un informe por atleta y periodo (el índice único ya lo garantiza); dos informes serían dos correos por el mismo niño. **El día más tardío, no el más temprano:** con el más temprano el informe se congelaba antes de que venciera el plazo del segundo coach, así que su nota **nunca** llegaba al snapshot — y como el snapshot es la única fuente del padre y del PDF, esa nota se perdía siempre (no en un caso raro: en todos). Con el más tardío ya vencieron todos los plazos, así que «todas sus notas» pasa de promesa imposible a resultado normal. Costo aceptado: el atleta multi-equipo recibe su informe unos días después que sus compañeros — el padre no tiene con qué comparar. `team_id` significa **equipo gobernante**; las notas se resuelven al congelar, sin tabla de relación. |
| **D19** | **¿El coach del equipo no gobernante ve el informe?** | **Sí.** La visibilidad del coach se resuelve por **membresía real del atleta en el periodo**, no por `team_id`, vía la función `SECURITY DEFINER` `coach_can_see_report()` | Sin esto, el coach B no podía ver el informe **donde va su propia nota**, y el atleta compartido desaparecía de su tablero: técnicamente coherente y humanamente absurdo. Se resuelve con una función, no con tabla de relación (se mantiene D17). El tablero muestra **cuál es el equipo gobernante** para que no haya ambigüedad sobre quién manda la fecha; los totales del admin se cuentan por informe, atribuidos al gobernante, sin doble conteo. |
| **D18** | **¿Y si el calendario cambia después de generar los borradores?** | **`PUT /reports/schedule` re-fecha los borradores no publicados del periodo en curso** (`reschedule_pending_reports`). Nunca toca `publicado` | Las dos opciones eran re-fechar o que el job leyera el calendario vivo (y entonces `scheduled_for` sobraría). Se elige re-fechar porque deja registro de cuándo *debía* salir cada informe, es auditable, y le da al job un índice por fecha en vez de un join al calendario en cada corrida. |

---

## 15. Fases de entrega

| Fase | Alcance | Entregable |
|---|---|---|
| **F0 — Vocabulario del padre** ⚡ *shippea sola* | `parent_label` + `parent_hint` en `sport_metric_definitions` (opcionales, fallback a `display_name`); la vista del padre destaca 3 métricas en vez de 51; «última medición hace N días». **Prerrequisito de todo lo demás.** El borrador de los rótulos **se genera con IA y el coach solo revisa** — convierte días de redacción en una hora de revisión (R4). | Migración chica + frontend + pasada de revisión humana |
| **F1 — Backend** | Las 3 tablas, RLS línea por línea, las 7 RPCs, auditoría, índice único por `subject_type+subject_id`, tests de concurrencia sobre `publish` | Migraciones + **plan aprobado antes de código** |
| **F2 — UI del coach** | Pestaña «Informes del mes» en `/coach-reports`: nota de equipo, notas individuales, avance visible | Frontend + BFF |
| **F3 — Tablero del admin** | Cobertura por equipo, retener/publicar, calendario de días | Frontend + BFF |
| **F4 — Vista del padre** | Sección «Informes» acumulativa, detalle interactivo, PDF al vuelo, `mark_report_viewed` | Frontend + BFF + `pdfkit` |
| **F5 — Emisor** | Job mensual: borradores, publicación por día, push + correo por lotes de 100, cascada anti-spam, recordatorios, subdominio de envío | Job + `notification.service` + `email_sends` |
| **F6 — Extras** | **Adopción al vincular acudiente** (ver abajo — ataca R7 por el otro lado y es barato); compartir imagen (`html2canvas`); consolidado de fin de temporada (mismo generador, otro rango + `competition_results`); vista multi-hijo | Aditivo |

### 15.1 Adopción de informes al vincular acudiente (F6)

`recipient_id` se resuelve al publicar, así que los informes publicados sin acudiente quedan con NULL para siempre. El padre **sí los ve** al entrar (la RLS resuelve por `children.parent_id`), pero nunca se enteraría de que existen.

El momento en que una familia se vincula es justo cuando un aviso vale más: «Ya está disponible el informe de julio de Valentina». Convierte el archivo muerto en el gancho de bienvenida.

Se engancha exactamente donde ya vive `adopt_orphan_payments_on_child_link()` (`20260730194230`) — el mismo punto del flujo ya adopta los cobros huérfanos del menor, así que adoptar sus informes es una línea más en un camino probado.

**Solo se notifica el informe publicado más reciente**, nunca el histórico completo: doce avisos de bienvenida es spam, no gancho.

> **F4 va antes de F5 a propósito:** no se puede mandar un enlace a una pantalla que no existe.
> **F0 puede ir ya**, en paralelo a todo: arregla hoy la legibilidad de la vista del padre y no depende de nada.

---

## 16. Riesgos

| # | Riesgo | Mitigación |
|---|---|---|
| **R1** | **Un boletín masivo envenena la entregabilidad de los cobros.** Mismo dominio, 500 correos, un puñado marca spam → caen también los recordatorios de pago, que son los que no se pueden perder. | Subdominio separado para informativo vs. transaccional crítico, con SPF/DKIM/DMARC en ambos. Reparto por día (D4). Enlace en vez de adjunto (D6). ⚠️ **Un subdominio nuevo arranca con reputación fría** — mandando 500 correos el primer mes tiene más papeletas de spam que el dominio actual, que ya tiene historia. **Warm-up obligatorio:** primer ciclo con **una sola escuela**, subir volumen gradual, vigilando las métricas de Resend Pro. |
| **R2** | **El coach no escribe y el módulo muere en el mes 2.** | Nota por equipo, no por atleta (D3). Avance visible + feedback de lectura (§13). Override del admin como válvula (D11). |
| **R3** | El deep link del push no abre bien en PWA y nativo (Capacitor). | Probar en los dos antes de F5. El fallback es el enlace del correo. |
| **R4** | Los 51 rótulos de padre no se redactan y F0 queda a medias. | Fallback a `display_name` desde el día 1: sin rótulo el informe sigue saliendo, solo menos legible. Se puede llenar por deporte, incremental. **Generar el borrador con IA y dejar que el coach revise** baja la tarea de días de redacción a una hora de revisión — el conocimiento del deporte lo aporta el coach corrigiendo, no escribiendo desde cero. |
| **R5** | Publicación doble por doble-clic o por job + botón manual. | `SELECT … FOR UPDATE` + rechazo si ya está `publicado` + índice único por periodo. Tests de concurrencia en F1. |
| **R6** | El snapshot congela un dato malo. | `regenerate_report_snapshot` con motivo y versión (D8). |
| **R7** | **El módulo se entrega y casi nadie lo recibe.** Depende del embudo de onboarding: sin acudiente vinculado no hay canal. Si Dynasty sigue en ~1% de vinculación, se construye un emisor para 4 familias. | El módulo se entrega igual (D16) porque el archivo histórico vale, pero **el bucket `sin_destinatario` es la métrica de éxito real, no el número de informes publicados**. Medir la vinculación **antes** de F5: si es baja, la prioridad es el ciclo de onboarding, no el emisor. Ver el spec de onboarding y la auditoría de Dynasty. |
| **R8** | Una RPC `SECURITY DEFINER` sin check interno abre la puerta a marcar informes ajenos y suprimir correos de otras familias. | §10.1: autorización dentro de cada función, sin excepción. Test de RLS/permisos por RPC en F1, no solo por tabla. |

---

## 17. Fuera de alcance (v1)

- WhatsApp como emisor masivo (D5).
- Percentil / comparación entre atletas en el informe del padre (D9).
- Informes por sede (D13).
- Ejercicios sugeridos para métricas en rojo — necesita contenido por deporte, no código.
- Informe para el atleta adulto con voz distinta a la del padre (usa el mismo por ahora).
- Traducción a otros idiomas.

---

## 18. QA

- **Concurrencia (F1, obligatorio):** doble `publish` simultáneo del mismo informe; job y botón manual a la vez; `generate_report_drafts` corrido dos veces.
- **Permisos por RPC, no solo por tabla (R8):** con un JWT de padre A, llamar `mark_report_viewed` con el id de un informe del padre B → debe fallar. Ídem `set_athlete_report_note` desde un coach ajeno al equipo, y `hold_athlete_report` desde un coach. **Cada RPC tiene su propio test de autorización.**
- **RLS:** un padre no ve borradores; no ve informes de hijos ajenos; un coach no ve equipos que no son suyos. Verificar con el truco de simular rol en el SQL editor.
- **Sin UPDATE directo:** un coach con su JWT no puede `UPDATE athlete_reports SET status='publicado'` — la tabla no otorga UPDATE a `authenticated` (§9.1).
- **Idempotencia:** regenerar borradores no duplica ni pisa notas escritas.
- **Cascada (§7.1):** sin token de push → correo **inmediato**, no a las 24 h; con token y abierto → no sale correo; con token y sin abrir a 24 h → sale; push que poda el token → correo inmediato; sin abrir a 3 días → un recordatorio y solo uno.
- **Sin destinatario (D16):** hijo sin acudiente activo → informe `publicado`, `recipient_id` NULL, `sent_at` NULL, **cero intentos de envío**, y aparece en `sin_destinatario`. Un `unregistered` nunca genera intento de envío.
- **Re-fechado (D18):** cambiar el calendario mueve los borradores pendientes y **no** toca los ya publicados.
- **Dos equipos (D17):** gobierna el `send_day` **más tardío** → al publicar, el snapshot **contiene las notas de ambos equipos**. Verificar explícitamente que la del equipo no gobernante (la del día anterior) **sí quedó dentro** — con el día más temprano este caso fallaba siempre. Si la no gobernante nunca se escribió, publica igual con la que hay.
- **Visibilidad del coach compartido (D19):** el coach del equipo NO gobernante ve el informe y ve al atleta en su tablero; un coach de otro equipo cualquiera **no** lo ve. Probar `coach_can_see_report()` con los tres casos.
- **Adopción al vincular (F6):** vincular acudiente resuelve `recipient_id` y notifica **un solo** informe, el más reciente; los anteriores quedan visibles sin aviso.
- **Agrupación:** padre con 2 hijos el mismo día recibe **un** correo.
- **PDF:** renderiza el `snapshot`, no las tablas vivas — cambiar una medición tras publicar **no** cambia el PDF. Branding por tier (start sin logo propio, pro+ con logo), atleta sin foto, nombres largos, métricas sin unidad.
- **Bordes:** atleta que se retiró a mitad de mes; equipo sin coach asignado; mes sin ninguna medición en toda la escuela; atleta con asistencia y cero mediciones (D12).
