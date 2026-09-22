# Agendamiento por equipo + descuento variable de banco de horas

**Estado:** construido y aplicado en producción (`luebjarufsiadojhvxgi`) entre el 2026-09-12 y el 2026-09-17, piloto activo en Dreamers Gymnastics y Academia Superior Bogotá. Documentado retroactivamente — no tenía spec hasta ahora.
**Fecha:** 2026-09-17
**Migraciones:** `20260912102517`, `20260912102940`, `20260912103828`, `20260914221557` (revierte las dos anteriores), `20260915001252`, `20260915121329`, `20260917152141`, `20260917152834`.
**Relacionado:** `docs/specs/dreamers-banco-de-horas-torniquete.md` (banco de horas base, D-1 a D-12), `docs/specs/dreamers-niveles-por-horas-y-progresion.md` (NIV, planes por horas).

---

## 0. Aviso: colisión de nombre con "flexible" de `dreamers-banco-de-horas-torniquete.md`

**Son dos conceptos distintos que comparten la palabra "flexible". No confundir.**

| | D-11 (banco de horas base) | Esta feature |
|---|---|---|
| Nombre | "reserva flexible" | `school_settings.hour_bank_flexible_booking_enabled` |
| Significa | **Sin franja horaria obligatoria** — "hoy voy", sin elegir hora exacta al agendar | **Descuento variable** — el banco de horas cobra los minutos realmente agendados (varios bloques consecutivos de `coach_availability`), no siempre el bloque fijo de la escuela |
| Requiere elegir horario | No | **Sí** — depende de `coach_availability`/`scheduling_team_id` |

Ambas cosas conviven en el mismo módulo (banco de horas) y ambas se activan por flag de escuela, pero no son la misma decisión de producto ni se excluyen entre sí. Si se retoma este módulo, verificar cuál de las dos "flexible" está en juego antes de tocar código.

---

## 1. Qué resuelve

Dos problemas separados que llegaron juntos en la misma tanda de trabajo:

1. **Agendar sesiones de plan requiere saber la disponibilidad real del entrenador del equipo**, no solo un horario genérico de la escuela. `enrollments.scheduling_team_id` (nuevo) permite asignarle a una inscripción un equipo específico cuyo `coach_availability` se usa para calcular horarios disponibles (`GET /athlete/available`, `bff/src/routes/session-bookings.ts`).
2. **El banco de horas siempre descontaba un bloque fijo** (`session_block_minutes` del plan → `hours_session_block_minutes` de la escuela → 120 min por defecto), sin importar cuántos bloques consecutivos de disponibilidad agendó realmente el atleta. `reserve_hour_bank(p_minutes_override)` permite pasar el minutaje real cuando el BFF ya validó una franja consecutiva más larga.

## 2. Decisiones de producto (implícitas, no hubo sesión formal — reconstruidas del código y las migraciones)

| # | Decisión | Resuelto |
|---|---|---|
| A | ¿Tabla propia `team_availability` o reusar `coach_availability`? | **Reusar `coach_availability` del equipo.** El primer intento (`20260912102517`/`20260912102940`, tabla + columna nuevas) se revirtió el mismo ciclo (`20260914221557`) al notar que duplicaba disponibilidad que ya existía por entrenador — la tabla nunca llegó a tener filas en producción. |
| B | ¿El descuento variable reemplaza el bloque fijo o convive? | **Convive, opt-in.** `p_minutes_override` es opcional (default `NULL` = comportamiento idéntico al de siempre); el piloto se activa por `hour_bank_flexible_booking_enabled`, apagado por defecto. |
| C | ¿Quién calcula el minutaje real? | **El BFF**, revalidando disponibilidad consecutiva real (`walkConsecutiveRun`/`buildBundledSessionsForDay` en `session-bookings.ts`) antes de pasar `p_minutes_override` al RPC — el RPC no confía en el número que le llega sin que el caller ya lo haya validado contra `coach_availability`. |

## 3. Lo que ya existe (no reconstruir)

- `enrollments.scheduling_team_id` (FK a `teams`), asignable por staff vía `AssignSchedulingTeamModal.tsx` → `PATCH /enrollments/:id` (`bff/src/routes/enrollments.ts`), valida que el equipo pertenezca a `schoolId` del token.
- `school_settings.team_scheduling_enabled` (flag) y `school_settings.hour_bank_flexible_booking_enabled` (flag) — ambos opt-in, default `false`.
- `reserve_hour_bank(p_enrollment_id, p_reservation_date, p_created_by, p_minutes_override)` — `DROP + CREATE` en vez de `CREATE OR REPLACE` porque Postgres no permite agregar un parámetro sin volver ambigua una llamada de 3 argumentos.
- `get_or_open_hour_bank_period()` respeta `school_settings.hours_plan_enabled` (flag maestro del módulo completo, distinto de los dos flags de arriba) y `billing_cycle_type` (`fixed_calendar` o `rolling_30`).

## 4. Hallazgos de seguridad cerrados en el mismo cierre (2026-09-17, fuera del alcance original)

No son parte del diseño de esta feature, pero se encontraron auditando su código y se cerraron en la misma sesión:

- `get_or_open_hour_bank_period(uuid)` había recuperado `EXECUTE` para `authenticated` — un `CREATE OR REPLACE` (migración `20260915121329`) reusó el cuerpo de una migración vieja sin arrastrar el `REVOKE` que `20260827174032` ya había aplicado a propósito (la función no valida que el caller sea dueño del `enrollment_id`). Corregido en `20260917152141`.
- `auto_close_stale_hour_bank_visits()` tenía `EXECUTE` para **`anon` y `authenticated`** — causa raíz: el default privilege de funciones nuevas en el esquema `public` nunca se había revocado (el equivalente para tablas se cerró en `SEG-23`, 2026-08-31, pero el de funciones quedó abierto sin que ninguna nota lo marcara pendiente). Cerrado de raíz para toda función futura en `20260917152834` (`ALTER DEFAULT PRIVILEGES ... REVOKE ALL ON FUNCTIONS FROM anon, authenticated`), y la función puntual corregida en `20260917152141`.

Ninguno de los dos era explotable a través de una ruta de negocio normal detectada, pero ambos permitían a un usuario sin el rol correcto (o sin sesión, en el segundo caso) invocar directamente RPCs `SECURITY DEFINER` que mutan estado de banco de horas de cualquier escuela.

## 5. Pendiente

- **Auditoría de funciones existentes**: el fix del default privilege no es retroactivo — no se revisó si otras funciones `public` (creadas antes del 2026-09-17) tienen `anon`/`authenticated` de sobra por el mismo motivo.
- **Guardia para `rolling_30` + `hours_plan_enabled`**: `docs/specs/dreamers-niveles-por-horas-y-progresion.md` ya recomendaba una guardia de código antes de permitir esta combinación; sigue sin escribirse pese a que Academia Superior Bogotá ya la usa en producción.
- Sin prueba end-to-end documentada del flujo completo (asignar equipo → agendar → descuento variable) con datos reales de un padre, más allá de la verificación de código.
