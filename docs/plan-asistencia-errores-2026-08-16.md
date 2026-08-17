# Asistencia — errores pendientes y orden de ataque

**Fecha:** 2026-08-16 · **Rama:** `develop` · **Disparador:** Dynasty reportó que sus
entrenadores no podían tomar asistencia.

Todo lo de acá está **verificado contra la base viva**, no deducido del código. Los números
son de la Supabase compartida (`luebjarufsiadojhvxgi`), que es la misma para dev/stg/prod.

---

## 0. Lo ya cerrado (contexto, no trabajo pendiente)

| | Qué era | Commit |
|---|---|---|
| **A-1** | `staff_select_policy` hacía `SELECT` sobre `auth.users` → `42501` que aborta toda lectura de `school_staff`. Dejó a **todos los entrenadores de todas las escuelas** sin ver un solo equipo | `9876c50` + mig `20260816184104` |
| **A-2** | El guardado masivo se saltaba en silencio a los atletas sin `enrollment_id` y terminaba con el toast verde | `9876c50` |
| **A-3** | Las tres rutas de equipo resolvían la sesión del día con `maybeSingle()`; con dos bloques reservables el mismo día → PGRST116 → 500 | `9876c50` |
| **A-4** | Cinco pantallas de entrenador confundían "no pude resolver tu ficha" con "no tienes nada asignado" | `5edf5a2` |

El patrón que unía a los cuatro: **la pantalla del entrenador fallaba en silencio.** Lista vacía
y "guardado con éxito" significaban lo mismo que un error.

---

## 1. Cola de pendientes

Ordenada por daño × cantidad de afectados, no por dificultad.

### P1 — El padre nunca ve la asistencia de su hijo

**Severidad: alta. Afecta a todas las escuelas, siempre.**

`AttendancePage.tsx:48-56` y `ChildAttendancePage.tsx:36-48` leen la tabla **`attendance`**.

```
attendance (legacy)   →      0 filas
attendance_records    →    690 filas   (2026-02-27 … 2026-08-15)
```

La tabla legacy está **vacía**. No es que la tasa salga mal por el desfase de estados
(`attended` vs `present`): la pantalla del padre está **en blanco desde siempre**, mientras el
entrenador registra en `attendance_records`.

Hay que mirar además `attendance.child_id`: la tabla legacy solo contempla menores, así que el
atleta adulto (`user_id`) y el no registrado (`unregistered_athlete_id`) no tenían ni dónde caer.

**Fix:** apuntar ambas pantallas a `attendance_records` con los cuatro estados reales
(`present/absent/late/excused`) y las tres identidades de atleta. Revisar de paso qué RLS deja
que el padre lea las filas de su hijo — hoy nadie lo ejerce, así que puede estar sin cubrir.

Ya está diagnosticado en `docs/specs/attendance-reports-module.md` (D2, Fase 1).

---

### P2 — El guardado no es atómico

**Severidad: media. Se nota en equipos grandes.**

`CoachAttendancePage.tsx:507-535` manda **un POST por atleta presente**. Con 31 atletas
(SENIORS de Dynasty) son 31 requests. Si el token expira o cae la red a mitad, la mitad queda
guardada y la otra no.

Ya está mitigado a medias: el `onError` invalida las queries (`5edf5a2`), así que la pantalla
refleja lo que sí entró en vez de mostrar el estado optimista. Pero sigue sin ser una operación.

**Fix:** una ruta que reciba el lote completo y lo resuelva en una transacción, con los créditos
adentro. `POST /session` ya recibe `records[]`; falta que `walk-in` deje de ser el camino de los
presentes.

---

### P3 — El crédito sale del plan equivocado

**Severidad: media. Radio hoy: 2 atletas.**

`findCreditEnrollment` (`attendance.ts:95-111`) ordena por `created_at ASC` y toma la primera.
Con dos inscripciones activas con plan, descuenta **siempre de la más vieja** y la nueva nunca
consume.

Medido contra la base:

| Escuela | Atletas con 2+ inscripciones activas con plan |
|---|---|
| Club Campestre Demo | 2 |
| *(el resto)* | 0 |

Dynasty está limpio. El radio es chico **hoy**, pero depende de que no reaparezca el bug de
doble inscripción (`project_f0_duplicate_enrollments_audit`), así que conviene cerrarlo antes de
que vuelva a crecer.

**Fix:** decidir la regla de negocio primero — ¿la más nueva? ¿la del equipo de la sesión? ¿la
que aún tiene saldo? La tercera es la que menos sorprende al entrenador. **No escribir código
hasta que esté decidida.**

---

### P4 — Roster incompleto y sin explicación

**Severidad: baja-media. Radio real menor de lo que parece.**

El roster de equipo sale de `enrollments` activas con `team_id = contextId`
(`attendance.ts:552-553`). Quien esté en el equipo pero cuya inscripción no apunte a ese
`team_id` **no aparece para pasarle lista, y no hay mensaje que lo explique**.

Cuidado al medirlo: hay 108 inscripciones sin `team_id` en GYM RM y 20 en THE BLAIR TEAM, pero
esas escuelas trabajan **por oferta, no por equipo** — para ellas el roster sale por el otro
camino y no hay problema.

El caso que sí importa es Dynasty: **17 inscripciones activas sin `team_id`**. De esas,
**0 tienen asistencia histórica** — nadie intentó pasarles lista todavía, así que no hay daño
consumado, pero son 17 atletas invisibles para el entrenador.

**Fix:** dos partes. (a) Que el roster avise cuando hay inscripciones activas de la escuela sin
equipo asignado, en vez de omitirlas mudo. (b) Que la escuela pueda asignarles equipo desde la
misma pantalla.

---

## 2. Qué hacer primero

**P1.** Es el único que ve un usuario final que no es de la escuela, afecta a todas las escuelas
a la vez, y lleva roto desde siempre sin que nadie lo reportara — lo cual dice más del silencio
de la pantalla que de la falta de uso.

P2 y P4 se pueden agrupar en una sola pasada por `CoachAttendancePage` + `roster`. P3 está
bloqueado por una decisión de producto, no por código.

---

## 2.b Carga retroactiva — decidido y construido (2026-08-17)

No estaba en la cola: salió de una pregunta de Dynasty. Hasta hoy la asistencia **solo se podía
tomar del día en curso** — las tres rutas de escritura calculaban la fecha adentro, la pantalla
de Supervisión tenía selector de fecha que solo servía para leer (guardaba con la fecha de hoy,
que es peor que no tenerlo: no falla, miente), y `auto_finalize_stale_sessions` cerraba cada
noche todo lo anterior sin que existiera forma de reabrir.

Las tres decisiones de producto, resueltas:

| | Decisión |
|---|---|
| **Quién** | El entrenador hasta **7 días** atrás; la administración **sin tope**. Quien responde por la plata puede reescribir más lejos que quien solo pasa lista. |
| **Créditos** | Se descuentan evaluando el saldo **como estaba ese día**: el plan vencido se compara contra la fecha del evento, no contra hoy. Sin saldo, la asistencia se registra igual y se avisa — misma regla que en el día corriente. |
| **Cerrado** | Una sesión finalizada se puede **reabrir**, solo si su fecha cae dentro de la ventana de quien lo pide. |

Sin migración: el gate vive en el BFF (que escribe con service role, así que RLS no es la
barrera) y la trazabilidad va por `security_audit_log` — `attendance_backdated` y
`attendance_session_reopened`, con quién, cuándo y para qué fecha. No se agregó columna a
`attendance_records`.

**Consecuencia que hay que conocer:** el cron vuelve a cerrar esta noche la sesión reabierta,
así que la corrección hay que terminarla el mismo día. Es deliberado — el cierre automático
sigue siendo la regla, la reapertura es la excepción puntual.

---

## 3. Cabos sueltos que no son de este plan

- `bff/_subir-logo-tmp.mjs` — borrador viejo de `scripts/subir-logo-escuela.mjs`, que ya está
  terminado y commiteado. Sin uso. Pendiente de que el usuario decida borrarlo.
- Dynasty: 18 clases asistidas sin descontar crédito por plan vencido (6 atletas, `expires_at`
  2026-08-05 con asistencia el 11 y el 15 de agosto). Es el comportamiento por diseño
  —la asistencia nunca falla por saldo— pero significa clases regaladas.
- Dynasty: `MINIVOLLEY BENJAMINES` (79 inscritos) y `JUVENIL MAYORES MASCULINO` (17) **nunca**
  tuvieron una toma de asistencia. Con A-1 vivo desde el 14 de agosto, hay que volver a mirarlo
  ahora que los entrenadores pueden entrar.
- Dynasty: el equipo `MINIVOLLEY -BENJAMINES (DUPLICADO - NO USAR)` está inactivo pero conserva
  3 inscripciones activas.
