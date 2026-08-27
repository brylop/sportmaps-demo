# Banco de horas por torniquete — Dreamers Gymnastics

**Estado:** F1 aplicado (2026-08-21 13:03, `luebjarufsiadojhvxgi`) · **Fecha:** 2026-08-21 · **Alcance:** solo escuela Dreamers Gymnastics
(`school_id = 57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe`). No es una migración de plataforma.

> **Fuera de alcance:** el rediseño `enrollment_periods` de
> [inscripcion-vs-periodo-de-plan.md](inscripcion-vs-periodo-de-plan.md) — sigue sin aprobar y
> este módulo no depende de él. Tampoco toca el modelo de créditos por sesión de
> [plan-asistencia-y-creditos-de-sesion.md](../plan-asistencia-y-creditos-de-sesion.md), que
> sigue rigiendo para el resto de escuelas.

---

## 1. El modelo en una frase

El plan de Dreamers ya no cuenta clases, cuenta **minutos**: una mensualidad trae un total de
horas (ej. 4 sesiones × 2h = 8h/mes) que el atleta puede repartir libremente entre visitas —
2h un día, 3h otro para adelantar, 4h seguidas — mientras no se salga de la ventana del mes. La
**reserva** (agenda) es un techo de validación y visibilidad para el coach; el **torniquete**
es quien manda en cuánto se descuenta de verdad.

```
Agendar (session_bookings)          Torniquete (access_events)
  ├─ valida saldo restante            ├─ entrada → arranca el reloj
  ├─ reserva el bloque (2h)           ├─ salida  → cierra el reloj
  └─ NO descuenta en firme            └─ descuenta minutos REALES del banco
```

---

## 2. Decisiones de producto (cerradas, 2026-08-21)

| # | Decisión |
|---|---|
| D-1 | El plan de Dreamers se mide en **minutos incluidos por mes**, no en sesiones. Ej. 480 min = "4 clases de 2h". |
| D-2 | **La reserva no descuenta en firme.** Al agendar solo se valida que el bloque (fijo, 2h) quepa en el saldo restante del período. Si no alcanza, el sistema bloquea la reserva — para más, el padre negocia directo con administración (fuera del sistema, por ahora). |
| D-3 | **El torniquete es la fuente de verdad del consumo.** Al cerrar una visita (entrada+salida), los minutos reales — no los 2h reservados — son los que se descuentan del banco. |
| D-4 | **Bloques de reserva fijos en 2h** por ahora. No hay selector de duración al agendar; las horas de más salen de quedarse más tiempo el mismo día, no de agendar un bloque más largo. Sujeto a que la escuela lo ajuste más adelante. |
| D-5 | **Reinicio mensual sin acumulación.** Lo no usado al cierre del mes se pierde; una excepción se resuelve hablando con administración (no hay lógica automática de arrastre). |
| D-6 | **Reentradas cortas fusionan la visita.** Si el atleta sale y vuelve a entrar dentro de la ventana de gracia configurada, es la misma visita para efectos de descuento — pero cada entrada/salida se sigue mostrando por separado en el detalle (auditoría). |
| D-7 | **Cierre automático de visitas abiertas:** por hora de cierre de la sede (configurable) + un tope de seguridad absoluto (ej. 6h) si el cron falla o el registro cruza medianoche. Queda en `pending_review`, sin descuento en firme. |
| D-8 | **Solo el owner** puede corregir una visita `pending_review` (ajustar hora de salida real). Coach y admin no tienen ese permiso en esta fase. |
| D-9 | Gracia de entrada/salida y minutos por bloque son **configurables por escuela** desde un apartado de ajustes (Dreamers hoy, no hardcodeado al nombre de la escuela). |
| D-10 | **Sin automatismo cuando el tiempo real excede el saldo restante estando ya adentro.** Se notifica a la escuela, sin descuento negativo ni facturación automática. La mitigación real es D-9-bis: el saldo restante se muestra **siempre** a padre, coach y owner (al agendar y en vivo), así el excedente por sorpresa debería ser la excepción, no la regla. |
| D-11 | **La reserva es flexible: "hoy voy", sin franja horaria obligatoria.** No hace falta elegir hora exacta al agendar — implica que la reserva de horas NO puede depender de `attendance_sessions`/`session_id` (que hoy exige horario fijo), necesita su propia forma más liviana. Ver nota técnica en §7. |
| D-12 | **El período del banco de horas ancla al `billing_cycle_type` que ya tiene la escuela** en `school_settings` ([prorationUtils.ts:3-6](../../bff/src/utils/prorationUtils.ts:3)): `prorated`/`fixed_calendar` → mes calendario; `rolling_30` → 30 días desde `start_date`, encadenados. Dreamers está en `prorated` hoy → mes calendario. No se inventa un concepto de período nuevo, se reusa el que ya rige la facturación. |
| D-13 | **Aviso antes de perder horas sin usar al cierre del período.** Confirmado como necesario — entra al alcance de F5/F6 (job de recordatorio + notificación), no solo el saldo visible pasivo. |
| D-14 | Hora de cierre para el auto-cierre (D-7): **10 pm hora Colombia**, como valor por defecto de Dreamers **provisional** — el usuario todavía va a confirmarlo con la escuela. Configurable por escuela igual (D-9), este es solo el punto de partida. |
| D-15 | El banco de horas es **por atleta** (no compartido entre hermanos) — confirma el diseño ya propuesto en §3.3, colgado de `enrollment_id`. |

---

## 3. Modelo de datos propuesto

Nada de esto está aplicado — es la propuesta para F1.

### 3.1 `school_settings` (columnas nuevas, D-9)

| Columna | Tipo | Notas |
|---|---|---|
| `hours_plan_enabled` | boolean default false | feature flag, hoy solo `true` en Dreamers |
| `hours_session_block_minutes` | integer default 120 | duración del bloque de reserva (D-4) |
| `hours_entry_grace_minutes` | integer | tolerancia antes de que el reloj cuente en firme |
| `hours_exit_grace_minutes` | integer | tolerancia de recogida tarde |
| `hours_reentry_merge_minutes` | integer | ventana para fusionar salida+reentrada (D-6) |
| `hours_closing_time` | time | corte diario para auto-cierre (D-7) |
| `hours_max_visit_minutes` | integer default 360 | tope de seguridad absoluto (D-7) |

### 3.2 `offering_plans` — nueva columna

| Columna | Tipo | Notas |
|---|---|---|
| `included_minutes_per_period` | integer, nullable | si no es null, el plan es "por horas" (D-1); coexiste con `max_sessions` sin usarlo |

### 3.3 `hour_bank_periods` (nueva tabla) — la ventana mensual

```
id, enrollment_id (FK enrollments), school_id,
period_start date, period_end date,          -- ancla: start_date de la inscripción, mensual
included_minutes integer,                     -- copiado del plan al abrir el período
reserved_minutes integer default 0,           -- suma de reservas activas (D-2)
consumed_minutes integer default 0,           -- suma de visitas cerradas reales (D-3)
created_at, updated_at
```

Un solo escritor: RPC `SECURITY DEFINER` con `FOR UPDATE` sobre esta fila, mismo patrón que
`move_session_credit` (ver §4 de plan-asistencia). Sin esto, dos escrituras concurrentes
(reserva + cierre de visita al mismo tiempo) pisan el contador — el mismo bug B-5 ya
documentado para el modelo de sesiones.

### 3.4 `hour_bank_visits` (nueva tabla) — la visita facturable

```
id, school_id, enrollment_id, period_id (FK hour_bank_periods),
status text,           -- 'open' | 'closed' | 'pending_review' | 'corrected'
started_at timestamptz,
ended_at timestamptz nullable,
billed_minutes integer nullable,     -- null mientras está open
auto_closed boolean default false,
corrected_by uuid nullable references profiles(id),  -- solo owner (D-8)
corrected_at timestamptz nullable,
correction_reason text nullable,
created_at, updated_at
```

### 3.5 `hour_bank_visit_segments` (nueva tabla) — cada entrada/salida real

Para que D-6 se cumpla (fusionar para facturar, mostrar todo para auditar):

```
id, visit_id (FK hour_bank_visits),
entry_event_id (FK access_events), exit_event_id (FK access_events, nullable),
entered_at, exited_at nullable,
created_at
```

Una `hour_bank_visit` puede tener 2+ segmentos si hubo una salida corta y reentrada. El padre,
coach y owner ven la visita agregada ("2h 15min dentro") con el detalle de segmentos disponible
al expandir.

---

## 4. Flujo end-to-end

1. **Agendar** (`POST /session-bookings/:id/book`, ya existe): antes del insert, nuevo guard
   `validateHourBalance(enrollmentId)` — `included - reserved - consumed >= hours_session_block_minutes`.
   Si pasa, `reserved_minutes += block` vía la RPC del período. Si no, 422 con el saldo real
   (para que el frontend muestre "te quedan 45 min, no alcanza para una sesión completa").
2. **Cancelar reserva**: `reserved_minutes -= block` (ya existe el patrón de devolución en
   `session-bookings.ts`, se replica para minutos).
3. **Entrada** (`access-adms.ts`, ATTLOG): además de `validateAccess`, revisar si hay un
   `hour_bank_visit` reciente (`status='closed'`, `ended_at` dentro de `hours_reentry_merge_minutes`)
   de la misma inscripción — si existe, reabrir esa visita (nuevo segmento) en vez de crear una
   nueva (D-6). Si no, crear visita `status='open'` + primer segmento.
4. **Salida**: cerrar el segmento actual. Si no hay reentrada dentro de la ventana de gracia
   (verificado por el cron de auto-cierre, no en el momento), cerrar la visita: sumar segmentos,
   aplicar gracia de entrada/salida, `consumed_minutes += billed_minutes`,
   `reserved_minutes -= block` de la reserva que esa visita cumplió (si había una para ese día).
5. **Cron de auto-cierre** (D-7): cada N minutos, busca visitas `open` con `started_at` antes de
   `hours_closing_time` de hoy, o que ya superan `hours_max_visit_minutes` — las pasa a
   `pending_review` sin tocar `consumed_minutes` todavía.
6. **Owner corrige** `pending_review`: ajusta `ended_at`, la RPC recalcula `billed_minutes` y
   recién ahí impacta `consumed_minutes` (D-8).
7. **Dashboards** (owner / coach / padre): saldo del período = `included - reserved - consumed`,
   detalle de visitas con sus segmentos. Mismo dato, tres vistas con distinto nivel de detalle.

---

## 5. Fases

Con revisión entre cada una, sin escribir migraciones hasta aprobar este documento.

| Fase | Qué | Riesgo |
|---|---|---|
| **F1** | ✅ Aplicado 2026-08-21. Migración `20260821125525_dreamers_hour_bank_schema.sql`: columnas en `school_settings` + `offering_plans`, tablas `hour_bank_periods`, `hour_bank_visits`, `hour_bank_visit_segments` + RLS (solo SELECT — sin lógica de escritura todavía). `hours_plan_enabled = false` en todas las escuelas, cero efecto en runtime. `npm run seguridad:invariantes` corrido post-apply: sin violaciones CRÍTICAS, y ninguna de las 60 ALTA preexistentes corresponde a las tablas nuevas. **Nota de bookkeeping:** quedó registrado en `schema_migrations` como `20260821130357`, no `20260821125525` — ver "`apply_migration` nunca usa el timestamp del archivo" en `docs/gotchas-tecnicos.md`. | bajo |
| **F2** | ✅ Aplicado 2026-08-21 (`schema_migrations` v`20260821131636`, archivo `20260821131412_hour_bank_move_rpc.sql`). `get_or_open_hour_bank_period(enrollment_id)` + `move_hour_bank(period_id, reserved_delta, consumed_delta)`, `SECURITY DEFINER` + `FOR UPDATE` + `search_path` fijo confirmados en vivo. Probado dentro de un `ROLLBACK` antes de aplicar: bloqueo de reserva por saldo insuficiente (D-2), consumo real sin freno (D-3/D-10), apertura de período idempotente — las 3 aserciones pasaron. `seguridad:invariantes` post-apply: sin violaciones nuevas. Nadie llama estas RPCs todavía (F3/F4 pendientes) — cero efecto en runtime. | medio |
| **F3** | ✅ Código listo 2026-08-21 (`bff/src/routes/access-adms.ts`), **sin desplegar/activar todavía**. `trackHourBankVisit` corre independiente de `access_granted` (el F22 decide el acceso físico, no el BFF — ver comentario en el código). Reentradas cortas fusionan segmento en la misma visita (D-6); la salida solo cierra el segmento, el cierre con facturación pasa en la próxima entrada fuera de ventana o en el cron de F5. Excedente (D-10) notifica por `notifications`, mismo patrón que `payment_overdue`. Aislado de otras escuelas por 2 capas: `hours_plan_enabled` (hoy `false` en todas, confirmado en la base) + `get_or_open_hour_bank_period` devolviendo `NULL` sin plan de horas. Validado con una simulación SQL completa (entrada→salida→reentrada corta→salida→reentrada fuera de ventana) dentro de un `ROLLBACK`: las 6 aserciones de estado pasaron (fusión de segmentos, cierre con billing correcto — 145 min brutos, 115 facturados tras 30 min de gracia —, apertura de visita nueva). `tsc --noEmit` limpio, suite de tests existente sin romperse. | **alto — toca el pipeline en vivo de Dreamers** |
| **F4** | ✅ Aplicado 2026-08-21. Resuelto el técnico de §7: **tabla propia `hour_bank_reservations`** (D-11: reserva flexible sin franja horaria), no `session_bookings`. Migración `20260821141913_hour_bank_reservations.sql`: RPCs `reserve_hour_bank` / `cancel_hour_bank_reservation` (todo el ciclo — abrir período + validar saldo + reservar/liberar + escribir la fila — en una transacción, sin ventana de fila-sin-reserva). Endpoints `GET /hour-bank-balance/:enrollmentId`, `POST /hour-bank-reservations`, `POST /hour-bank-reservations/:id/cancel` en `access-api.ts`. **F3 quedó conectado**: `closeHourBankVisit` ahora busca la reserva `confirmed` del día de la visita y la libera (`fulfilled`) en la misma llamada a `move_hour_bank` que factura lo real. Validado en `ROLLBACK`: reservar hasta el saldo exacto (480 min en 4 reservas de 120) pasa, la quinta rechaza con `insufficient_balance` y `available_minutes:0`, cancelar libera y una doble cancelación se rechaza con `not_confirmed`. `tsc`/tests limpios, `seguridad:invariantes` sin violaciones nuevas. | medio |
| **F5** | ✅ Código + migración listos 2026-08-21, sin desplegar/activar todavía. Migración `20260821133157_hour_bank_autoclose_rpc.sql`: RPC `auto_close_stale_hour_bank_visits()` (`FOR UPDATE SKIP LOCKED`, no factura — solo pasa a `pending_review`). Cron cada 15 min (`bff/src/jobs/hour-bank-autoclose.job.ts`, registrado en `maintenance.job.ts`). Bandeja del owner: `GET /api/v1/access/hour-bank-visits` + `PATCH /api/v1/access/hour-bank-visits/:id/correct` (`access-api.ts`) — **D-8 implementado con chequeo manual de `role !== 'owner'`, a propósito sin `requireRole`**, porque su `PRIVILEGED_ROLES` deja pasar admin/super_admin y el negocio pidió "solo owner" sin excepción. Validado con 2 simulaciones SQL en `ROLLBACK` (auto-cierre por hora de cierre del día de inicio, por tope de 360 min, visita fresca intacta, `consumed_minutes` en 0 durante todo el auto-cierre). `tsc --noEmit` limpio, tests sin romperse, `seguridad:invariantes` sin violaciones nuevas. | medio |
| **F6** | ✅ Código listo 2026-08-21, **sin verificación visual** (ver nota abajo). `HourBankBalanceCard` (componente nuevo, no renderiza nada sin plan de horas) montado en `MyEnrollmentsPage.tsx` (padre/atleta, junto a cada `PlanCard`). `HourBankSchoolSection` (nuevo) montado en `AccessControlPage.tsx` (owner/coach): saldo de todos los atletas + bandeja de corrección de `pending_review` inline (oculta sola si el 403 de D-8 llega — no duplica la regla en frontend). Endpoint nuevo `GET /hour-bank-balances` (agregado de escuela) en `access-api.ts`. `tsc --noEmit` limpio en todo el frontend (0 errores). | bajo |

**Orden: F1 → F2 → F3 → F4 → F5 → F6.** F3 antes que F4 para que ya exista algo que consumir
cuando el guard de reserva entre en juego.

---

## 6. Matriz de aceptación

| # | Escenario | Esperado |
|---|---|---|
| 1 | Saldo 8h, reserva 2h, entra y sale exacto a las 2h | reserved -2h al confirmar reserva, consumed +2h al cerrar visita, reserved +2h de vuelta (la reserva se "consume", no se duplica el descuento) |
| 2 | Reserva 2h, se queda 3h (tenía saldo) | consumed +3h, no +2h |
| 3 | Reserva 2h, saldo restante 1h30 | 422 al agendar — no alcanza |
| 4 | Sale al baño 5 min (gracia 15 min) y vuelve | una sola visita, un segmento nuevo, tiempo se suma |
| 5 | Sale y no vuelve en 3h (gracia 15 min) | visitas separadas si vuelve después de la ventana |
| 6 | Nunca marca salida, pasa la hora de cierre | visita → `pending_review`, sin descuento en firme |
| 7 | Owner corrige la visita de #6 | recién ahí se descuenta, con `corrected_by` auditado |
| 8 | Coach intenta corregir una `pending_review` | rechazado — solo owner (D-8) |
| 9 | Cierra el mes con 2h sin usar | no rueda al siguiente período (D-5) |
| 10 | Dos entradas simultáneas del mismo atleta (glitch de lector) | el `FOR UPDATE` de la RPC evita doble apertura de visita |

---

## 7-bis. Integración con las reservas ya existentes de la plataforma (2026-08-27)

**Hallazgo:** `session_bookings` (reserva "por plan") y `facility_reservations` (reserva "por
instalaciones") llamaban a `move_session_credit` sin condición — ninguna de las dos vías sabía que
el banco de horas existe. Una inscripción con `included_minutes_per_period` podía reservar por ahí
moviendo `sessions_used`/`secondary_sessions_used`, un contador que nadie mira, sin tocar el saldo
real. Y con "Máx. sesiones" conviviendo como etiqueta (D-4), ese número **sí actúa como tope real**
sobre `sessions_used` en el sistema viejo — riesgo de que un coach vea "0 de 4 disponibles" mientras
el banco de horas real todavía tiene saldo.

**Fix aplicado, migración `20260827131341_hour_bank_link_bookings.sql`:** columna
`hour_bank_reservation_id` en ambas tablas. Al reservar, si la inscripción tiene plan de horas,
`POST /:id/book` y `POST /athlete/book-secondary` llaman a `reserve_hour_bank` **antes** de insertar
la reserva (D-2: bloquea sin crear nada si no alcanza el saldo) y guardan el `reservation_id`
devuelto. Al cancelar, si la reserva tiene `hour_bank_reservation_id`, se llama
`cancel_hour_bank_reservation` en vez de `move_session_credit`. Una sola bolsa de minutos —
`is_secondary` deja de importar para el banco de horas, aunque siga distinguiendo primaria/
secundaria en el sistema viejo.

`closeHourBankVisit` (F3) no necesitó cambios: sigue buscando la reserva `confirmed` del día por
`enrollment_id` + `reservation_date`, sin importar si nació desde el endpoint dedicado o desde
estas dos vías redirigidas.

**Corrección del mismo día:** el primer arreglo tocó `POST /:id/book` y `DELETE /bookings/:id`
(servidos también en `/api/v1/sessions/:id/book` — lo usan `AddDropInModal.tsx` y
`CalendarSessionSlot.tsx`, el flujo de **coach/staff**). Pero "Mis Inscripciones" (padre/atleta)
llama a un handler **distinto**: `POST /athlete/book-session` y `DELETE /athlete/cancel-booking`
(`useAthleteSessionBookings.ts` → `useBookSession`/`useCancelBooking`) — mismo patrón de
`session_bookings` + `move_session_credit`, pero código separado, así que el primer fix no lo
cubría. Se aplicó el mismo redirect ahí. `POST /athlete/book-secondary` (reserva de instalaciones
desde "Mis Inscripciones") ya había quedado bien la primera vez porque coincide exactamente con el
endpoint que usa `useBookSecondarySession`. **Los cuatro puntos de entrada reales quedan
cubiertos:** `/:id/book`, `DELETE /bookings/:id`, `/athlete/book-session`,
`/athlete/cancel-booking`, `/athlete/book-secondary`, `/athlete/secondary/:id/cancel`.

## 7. Pendientes y riesgos

- **F6 no tuvo verificación visual en navegador.** No hay `.claude/launch.json` para levantar el frontend local, y las páginas tocadas requieren sesión autenticada real (padre/owner de Dreamers) — no se armó ese entorno en esta sesión. La validación que sí se hizo: `tsc --noEmit` limpio en todo el frontend, revisión manual del JSX, y que los componentes nuevos devuelven `null` de forma explícita cuando no hay plan de horas (`has_hours_plan: false` / lista vacía), así que no deberían alterar el render de ninguna escuela que no sea Dreamers. **Antes de dar F6 por cerrado de verdad, alguien tiene que abrirlo en el navegador** con `hours_plan_enabled=true` en Dreamers y datos de prueba.

- **D-11 tiene una implicación técnica real en F4.** Con la reserva flexible ("hoy voy", sin
  franja horaria), no se puede seguir insertando en `session_bookings` con `session_id` apuntando
  a una fila de `attendance_sessions` de horario fijo — ese modelo asume una hora concreta. Para
  Dreamers hace falta una reserva más liviana: básicamente "este atleta apartó saldo para una
  visita hoy", sin sesión de horario asociada. Dos caminos a evaluar en F4:
  1. Una tabla nueva y chica (`hour_bank_reservations`: enrollment_id, fecha, minutos, status) en
     vez de forzar el modelo de `session_bookings`.
  2. Insertar en `session_bookings` con `session_id` nulo/opcional si el schema lo permite — hay
     que revisar si las constraints actuales de esa tabla lo bloquean.
  No se decide acá — es de diseño de F4, con revisión antes de escribir esa parte.
- **D-14 es un valor provisional.** 10 pm Colombia es el punto de partida de Dreamers, no un
  número confirmado con la escuela — no tratarlo como definitivo al construir F1/F5.
- `school_settings.hours_closing_time` asume un horario único por sede — si Dreamers termina
  necesitando horarios distintos por día de la semana, hace falta una estructura más rica (o una
  tabla de horarios en vez de una columna). No se sabe todavía si aplica.
- Falta decidir si `hour_bank_visits`/`_segments` necesitan RLS visible al padre (solo sus
  hijos) desde el día uno, o si por ahora todo pasa por el BFF — dado el historial de RLS del
  repo, más vale definirlo en F1 y no parchearlo después.
- **D-13 (aviso antes de perder horas) no tiene fase asignada todavía.** Encaja en F5 (junto al
  cron de auto-cierre) o F6 (junto al frontend de saldo) — se define al planear esas fases en
  detalle.
