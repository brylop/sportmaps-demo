# Plan — Asistencia y créditos de sesión (equipo ↔ plan ↔ reservas)

> **Alcance:** cómo se consume una sesión del plan cuando el atleta reserva y/o cuando el
> entrenador le toma asistencia, y qué ve el entrenador mientras lo hace.
> **Fuera de alcance:** el cobro. Se queda un solo monto por inscripción (o cobra el plan o
> cobra el equipo, cascada actual de `open_month`). Nunca dos montos ni dos cobros.

---

## 1. El modelo en una frase

El atleta tiene un plan (paquete de N clases) y pertenece a un equipo. **Los créditos viven
en la inscripción que tiene `offering_plan_id`; el equipo solo pone al atleta en el roster.**
Un entrenador asignado únicamente al equipo descuenta del plan del atleta sin tener ningún
vínculo con la oferta — la conexión es indirecta y es correcta:

```
coach ──asignado a──> equipo ──roster──> atleta ──inscripción con plan──> créditos
```

Por eso el crédito se resuelve **por atleta**, no por la fila de inscripción que mande la
pantalla: si el plan quedó en otra inscripción activa, se encuentra igual.

---

## 2. Estado verificado contra la base viva (2026-07-31)

Tres cosas que el repo dice y **la base desmiente**. No confiar en `docs/plan-saneamiento-sesiones-plan-equipo.md` en estos puntos:

| Lo que dice el repo | Lo que hay en la base |
|---|---|
| `fn_deduct_sessions_on_finalize` descuenta al finalizar → doble conteo | Ya no descuenta. Solo pasa bookings a `attended`. Está activa pero es inofensiva. |
| Falta devolver el crédito al cancelar una reserva | Ya se devuelve, en los 4 puntos de cancelación de `session-bookings.ts`. |
| `attendance_records` tiene UNIQUE `(child_id, program_id, attendance_date)` | La columna `program_id` **no existe**. El eje real es `(session_id, persona)` vía `idx_attendance_records_unique_person_session`. |

Y tres que quedaron descartadas al revisarlas:

- `fn_process_session_booking` (BEFORE INSERT en `session_bookings`) **solo valida** — sesión abierta, aforo, inscripción activa, plan no vencido, créditos disponibles. No incrementa nada.
- `sync_session_capacity` solo mueve `current_bookings`. `sync_program_team_id`, pese al nombre, solo pone `updated_at`.
- El doble clic al reservar está bloqueado: hay UNIQUE por `(session_id, atleta)` `WHERE status <> 'cancelled'` en las tres ramas, y el `+1` del BFF corre solo tras un insert exitoso.

### Lo que sí está roto

| # | Problema | Dónde |
|---|---|---|
| B-1 | Reservar a una hora y ser marcado presente en **otra sesión del mismo día** descuenta 2 créditos por un solo entrenamiento. El guard `alreadyBooked` busca la reserva de *esa* sesión (o fecha+hora exacta en instalaciones). | `attendance.ts` walk-in |
| B-2 | El walk-in incrementa `sessions_used` aunque la inscripción **no tenga plan** → contador huérfano sobre datos que no significan nada. | `attendance.ts` |
| B-3 | El roster de equipo fuerza `plan: null` a propósito → el entrenador descuenta a ciegas y solo se entera por un 422 seco. | `attendance.ts` roster |
| B-4 | `POST /attendance/session` **nunca toca `enrollments`**: `CoachPlansPage` marca presente y no descuenta, y corregir presente→ausente en equipo **pierde** el crédito (la devolución solo vive en walk-in). | `attendance.ts` |
| B-5 | El contador se mueve con read-modify-write desde el BFF en ~6 sitios, y la validación del trigger no toma `FOR UPDATE` sobre `enrollments` → dos reservas simultáneas consumen **un solo** crédito. Va contra la convención del repo. | `session-bookings.ts`, `attendance.ts` |
| B-6 | Tres pares de índices únicos **idénticos** en `session_bookings` → escritura duplicada en cada reserva. | base |

---

## 3. Decisiones de producto (cerradas)

| # | Decisión |
|---|---|
| D-1 | **Cobro fuera de alcance.** Un solo monto por inscripción: o cobra el plan, o cobra el equipo. |
| D-2 | Los créditos se resuelven **por atleta**. El entrenador del equipo descuenta del plan y **debe ver el saldo**. |
| D-3 | Atleta de equipo puro (sin plan): registra asistencia y **no descuenta nada**. |
| D-4 | **La reserva descuenta** al confirmarse. Cancelar devuelve el crédito. El no-show lo quema. |
| D-5 | **Sin tope diario.** Un atleta puede tomar varias clases el mismo día y cada una consume su crédito. |
| D-6 | **Sin bloqueo del día.** El bloqueo es por sesión, que ya existe en la base. Dos entrenadores pueden tomar asistencia el mismo día en sesiones distintas. |
| D-7 | **Opción A — la asistencia consume primero una reserva libre de ese día.** Si no hay ninguna, consume un crédito nuevo. *(Pendiente de confirmación del cliente.)* |
| D-8 | Reglas de emparejamiento de D-7 (ver §4). |
| D-9 | El entrenador ve **siempre** por qué se descontó o por qué no (ver §5). |
| D-10 | **Diferido:** toggle de reservas por escuela. Hoy no existe nada a nivel escuela; `is_bookable` es por sesión y se inserta hardcodeado en `true` en 5 lugares. |

### La fórmula que sale de D-4 + D-5 + D-7

> **créditos del día = reservas hechas + asistencias que no encontraron reserva libre**

| El mismo día | Créditos |
|---|---|
| Reserva 6 pm, aparece en la sesión de 4 pm | **1** |
| Reserva mañana + reserva tarde, asiste a las dos | **2** |
| Reserva mañana + reserva tarde, asiste solo a una | **2** — la otra se quema |
| Reserva mañana + tarde, asiste a las dos **y** a una tercera sin reservar | **3** |
| Sin reserva, el entrenador lo marca presente | **1** |
| Reserva clase en la mañana + cancha en la tarde | **1 principal + 1 secundaria** |

---

## 4. Reglas de emparejamiento (D-8)

1. **Una asistencia consume como máximo una reserva**, y al consumirla el booking se marca
   `attended`. Es el candado que impide que la reserva de la mañana absorba también la
   asistencia de la tarde — sin él, el segundo entrenamiento saldría gratis.
2. **El emparejamiento respeta la bolsa.** `sessions_used` (principal) y
   `secondary_sessions_used` (reservas de instalación) son bolsas separadas: una asistencia a
   clase principal nunca consume una reserva de cancha, ni al revés.
3. **Prioridad de match:** primero la reserva de esa misma sesión si existe; si no, la reserva
   libre más temprana del día en la misma bolsa. Con dos reservas activas cualquiera da el
   mismo total, pero fijar el orden evita que dos guardados simultáneos elijan la misma.
4. El emparejamiento mira `session_bookings` **y** `facility_reservations`, ambas con
   `status = 'confirmed'` y fecha de hoy.

---

## 5. Lo que ve el entrenador (D-9)

Hoy el entrenador de equipo no ve nada del plan y solo recibe un 422 seco cuando algo falla.
Cambia a: **el estado del plan siempre visible en la fila del atleta**, y un mensaje explícito
después de guardar.

### En la fila del roster (badge permanente)

| Situación | Texto |
|---|---|
| Con plan y saldo | `Plan Mensual · 3 de 10 clases · vence 15 ago` |
| Ya tiene reserva hoy | **`Ya reservó hoy (6:00 pm) — no se descuenta otra clase`** |
| Últimas clases | `Plan Mensual · 9 de 10 clases · queda 1` (en ámbar) |
| Sin saldo | `Sin clases disponibles en el plan` (en rojo) |
| Plan vencido | `Plan vencido el 28 jul` (en rojo) |
| Sin plan | `No maneja plan de clases` (gris, sin alarma — es lo normal en equipo puro) |
| Ya marcado en esta sesión | `Asistencia ya registrada por Carlos M. · 4:15 pm` |

### Al guardar (confirmación)

- Descuento normal: `Asistencia guardada · se descontó 1 clase a 3 atletas`
- Con reserva emparejada: `Asistencia guardada · a Juan no se le descontó: ya tenía reserva para hoy`
- Sin plan: `Asistencia guardada · 2 atletas sin plan de clases (no se descuenta)`
- Bloqueado: `Juan: sin clases disponibles en el plan` — y la asistencia **sí** queda registrada; lo que no ocurre es el descuento.

**Regla de fondo:** que al atleta le falten créditos **nunca** impide registrar la asistencia.
Registrar el hecho y cobrar el crédito son cosas distintas: hoy el 422 mezcla las dos y el
entrenador se queda sin poder pasar lista.

---

## 6. Fases

### F-A — Asistencia (BFF + frontend, sin migraciones)

1. Helper `findCreditEnrollment(schoolId, atleta)`: la inscripción con plan, o `null`. Fuente única.
2. `validatePlanForAttendance` lo usa; sin plan → válido y sin descuento. Cierra **B-2**.
3. Helper `consumeBookingOfTheDay(...)` con las reglas de §4. Reemplaza los dos guards
   estrechos del walk-in. Cierra **B-1**.
4. El roster de equipo deja de forzar `plan: null` y expone además `booking_today`. Cierra **B-3**.
5. `POST /attendance/session` aplica el movimiento de crédito por transición de estado
   (`no-presente→presente` = −1, `presente→otro` = +1). Cierra **B-4**.
6. Falta de créditos deja de ser 422 bloqueante: se registra la asistencia y se informa.
7. Frontend: badges y toasts de §5 en `CoachAttendancePage` y `AttendanceSupervisionPage`.

### F-B — Un solo escritor del contador (migración + BFF)

RPC `move_session_credit(p_enrollment_id, p_is_secondary, p_delta)`, `SECURITY DEFINER`,
`SELECT … FOR UPDATE` sobre `enrollments`, `SET search_path = pg_catalog, public, pg_temp`,
`GRANT EXECUTE … TO authenticated`. Los ~6 sitios del BFF que hoy hacen read-modify-write
pasan a llamarla. Cierra **B-5** y deja un único punto que mueve el saldo, en reservas y en
asistencia.

### F-C — Limpieza (migración, opcional)

`DROP INDEX` de los tres duplicados exactos: `session_bookings_unique_active_child`,
`session_bookings_unique_active_user`, `uq_session_bookings_unregistered_active` (sobreviven
`uq_active_booking_*`). Cierra **B-6**.

**Orden: F-A → F-B → F-C.** F-B antes de F-C para que el movedor atómico ya esté en pie.

---

## 7. Matriz de aceptación

| # | Atleta | Entrenador | Pantalla | Esperado |
|---|---|---|---|---|
| 1 | plan + equipo | equipo | Asistencia, ctx equipo | −1 del plan; ve el saldo en la fila |
| 2 | solo equipo | equipo | Asistencia, ctx equipo | registra, no descuenta, sin contador huérfano |
| 3 | plan + equipo | plan | Asistencia ctx plan **y** `CoachPlansPage` | −1 del plan en ambas |
| 4 | plan + equipo | equipo | corrige presente→ausente | crédito devuelto |
| 5 | reservó 6 pm | equipo | lo marca presente a las 4 pm | −1 **total**; el badge avisa que ya tenía reserva |
| 6 | reservó mañana y tarde | equipo | asiste a las dos | −2, una por bloque |
| 7 | plan agotado | equipo | marca presente | asistencia registrada + aviso claro; sin descuento |
| 8 | plan vencido | equipo | marca presente | igual que 7, con el motivo correcto |
| 9 | dos entrenadores, misma sesión | ambos | marcan a la vez | un solo registro, un solo crédito |
| 10 | dos reservas simultáneas | — | reserva doble concurrente | −2 (no −1): prueba de concurrencia de F-B |

---

## 8. Pendientes y riesgos

- **D-7 pendiente de confirmación del cliente.** Si vuelve "Opción B" (cada registro descuenta
  por separado), se cae el punto 3 de F-A y B-1 deja de ser bug para volverse comportamiento
  esperado. Todo lo demás sigue igual.
- Falta correr el diagnóstico de daño acumulado: cuántas inscripciones sin plan tienen
  `sessions_used > 0` (contadores huérfanos de B-2) y cuántos saldos quedaron sobregirados. Si
  sale > 0, F-A se acompaña de un `UPDATE` que pone esos contadores en 0 — es dato basura, no
  dinero.
- **Fuera de alcance, pero anotado:** `facility_reservations_unique_active_slot` es UNIQUE por
  `(facility_id, reservation_date, start_time)` **sin incluir al atleta**, o sea que las
  instalaciones son de uso exclusivo: una sola reserva activa por bloque, sea quien sea. Y el
  código crea la sesión con `max_capacity = max_group_capacity ?? 10`, asumiendo aforo grupal.
  Una de las dos sobra. Decisión de producto aparte.
- `upsert_attendance_record` no está versionada y el linter la reporta ejecutable por `anon`
  siendo `SECURITY DEFINER`. Ninguna fase la toca, pero conviene cerrarla en su momento.
