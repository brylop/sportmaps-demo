# Plan de saneamiento — Hijo → Plan → Equipo → Sesiones que se descuentan

> **Estado actual:** el mecanismo de "oferta con N sesiones que se van descontando" **ya existe y funciona** por el eje `offering_plans` + `enrollments.sessions_used` + `attendance_sessions` (anclado al equipo). No hay que construirlo: hay que **sanearlo**.
> Este documento lista **solo lo que está mal y se debe modificar**, por fases.

---

## Contexto rápido del modelo (para ubicarse)

Cómo se conectan las piezas hoy:

```
offering  (servicio que vende la escuela)
  └── offering_plans.max_sessions      ← el "cupo" de la oferta (ej: 8 sesiones) + duration_days, price
        └── enrollment (child_id + offering_plan_id)
              ├── sessions_used         ← contador consumido
              └── expires_at            ← hoy + duration_days

attendance_sessions (team_id NOT NULL)  ← toda sesión pertenece a un EQUIPO
  └── session_bookings (enrollment_id)  ← reserva del hijo; aquí se enlazan equipo + plan
        └── al descontar: enrollments.sessions_used += 1
```

Punto de unión: el **`enrollment`**. La sesión vive en el equipo; los créditos viven en el plan; se encuentran en el booking.

**Saldo mostrado en UI:** `sessions_remaining = max(0, max_sessions − sessions_used)`.

---

## FASE 1 — Doble-conteo de sesiones 🔴 CRÍTICO (afecta saldos/dinero)

**Problema:** `sessions_used` se incrementa **dos veces** por una sola sesión:

1. En el BFF, inmediatamente al reservar — sin ningún guard
   `bff/src/routes/session-bookings.ts` (líneas 820-826)
2. En el trigger de BD, cuando el coach finaliza la sesión
   `fn_deduct_sessions_on_finalize` → `supabase/migrations/20260310000001_universal_architecture_v2_1.sql` (líneas 445-487)

**Efecto:** un hijo que reserva y luego asiste consume **2 créditos por 1 sesión**. Los saldos `sessions_remaining` están inflados.

**Decisión de diseño:** único punto de verdad = **descontar al finalizar** (refleja consumo real y permite cancelar sin penalizar). Al reservar solo se **valida** saldo.

**A modificar:**
- [ ] BFF `session-bookings.ts`: eliminar el incremento manual (líneas 820-826). Dejar **solo** la validación `sessions_used < max_sessions` (ya existe en líneas 405-425).
- [ ] Mantener el trigger `fn_deduct_sessions_on_finalize` como **único** descontador.
- [ ] Revisar cancelación: al cancelar un booking ya descontado (status `attended`), **devolver** el crédito (`sessions_used -= 1`).
- [ ] Migración nueva de **reconciliación**: recalcular `sessions_used` real por enrollment = nº de `session_bookings` en estado `attended`. Corrige los saldos ya inflados.

---

## FASE 2 — Sistemas de asistencia fragmentados 🟠

**Problema:** coexisten 3 sistemas y solo uno descuenta:

| Sistema | Tablas | ¿Descuenta? |
|---|---|---|
| Canónico (v2.1) | `attendance_sessions` + `session_bookings` | ✅ Sí |
| Legacy por programa/clase | `attendance_records` | ❌ No |
| Legacy equipos | `training_sessions` + `session_attendance` | ❌ No |

Según qué pantalla use el coach para marcar asistencia, el saldo se afecta o no.

**A modificar:**
- [ ] Declarar `attendance_sessions` / `session_bookings` como sistema **canónico**.
- [ ] Auditar el frontend: qué pantallas escriben en cada tabla (páginas de asistencia — p. ej. `CoachAttendancePage`, `AttendanceSupervisionPage`).
- [ ] Migrar esas pantallas al sistema canónico.
- [ ] Marcar `attendance_records`, `training_sessions`, `session_attendance` como **deprecated** (comentario en migración + dejar de escribir). No borrar aún.
- [ ] Migración de datos si se conserva histórico.

---

## FASE 3 — Créditos del marketplace huérfanos 🟠

**Problema:** `subscription_plans.sessions_included` / `recurring_subscriptions.sessions_remaining` **nunca se decrementan**; solo se resetean en la renovación.
`supabase/migrations/20260417000003_unified_marketplace_payments.sql` (línea 1345)

**A modificar (elegir una):**
- [ ] **Opción A (recomendada):** el consumo real es `offering_plans` + `enrollments.sessions_used`. Dejar el marketplace **solo para venta/facturación** (no conteo de sesiones). Documentarlo y quitar `sessions_remaining` de las respuestas donde sugiere consumo.
- [ ] **Opción B:** cablear el decremento real de `recurring_subscriptions.sessions_remaining` (más trabajo, duplica lo que ya hace offering_plans).

---

## FASE 4 — Doble vía hijo ↔ equipo 🟡

**Problema:** dos formas de ligar un hijo a un equipo → inconsistencia potencial:
- `children.team_id` (FK directa, legacy) — `supabase/migrations/20260217000001_schema_refactored.sql` (línea 380)
- `enrollments.team_id` (relacional) — `supabase/migrations/20260226000055_shift_to_teams.sql` (línea 21)

**A modificar:**
- [ ] Elegir `enrollments.team_id` como fuente única.
- [ ] Migración: backfill de `enrollments` desde `children.team_id` donde falte.
- [ ] Marcar `children.team_id` como deprecated; dejar de escribirlo desde front/BFF.
- [ ] Ajustar queries/vistas que aún leen `children.team_id`.

---

## FASE 5 — Semántica "enrollment con equipo + plan a la vez" 🟡

**Problema:** un `enrollment` puede llevar `team_id` y `offering_plan_id` juntos, pero **qué enrollment consume** un booking depende de qué `enrollment_id` mande el frontend. No hay regla explícita.

**A modificar:**
- [ ] Regla: el `session_booking` siempre apunta al enrollment que **tiene el `offering_plan_id`** (el que aporta créditos).
- [ ] Validar en el BFF que el `enrollment_id` recibido **pertenezca al hijo** y esté **activo** antes de reservar/descontar.
- [ ] Documentar el flujo canónico "equipo con plan de sesiones" en `docs/`.

---

## Orden sugerido de ejecución

**1 → 2 → 4 → 5 → 3**

- **Fase 1** es la única **urgente** (corrige saldos en vivo → dinero).
- El resto es limpieza estructural; puede ir en releases sucesivas.

---

## Archivos clave (referencia)

| Componente | Archivo | Líneas |
|---|---|---|
| `offerings` | `supabase/migrations/20260310000001_universal_architecture_v2_1.sql` | 55-78 |
| `offering_plans` (`max_sessions`) | `supabase/migrations/20260310000001_universal_architecture_v2_1.sql` | 85-113 |
| `enrollments` (base) | `supabase/migrations/20260217000001_schema_refactored.sql` | 449-461 |
| `enrollments` ALTER (`sessions_used`, `expires_at`, `offering_plan_id`) | `supabase/migrations/20260310000001_universal_architecture_v2_1.sql` | 164-177 |
| `enrollments.team_id` | `supabase/migrations/20260226000055_shift_to_teams.sql` | 21 |
| `attendance_sessions` (`team_id` NOT NULL) | `supabase/migrations/20260303000000_mvp_attendance_fix.sql` | 29-51 |
| `session_bookings` | `supabase/migrations/20260310000001_universal_architecture_v2_1.sql` | 184-227 |
| Trigger de descuento `fn_deduct_sessions_on_finalize` | `supabase/migrations/20260310000001_universal_architecture_v2_1.sql` | 445-487 |
| Marketplace `sessions_remaining` (reset, sin decremento) | `supabase/migrations/20260417000003_unified_marketplace_payments.sql` | 209, 1345 |
| BFF crear enrollment | `bff/src/routes/enrollments.ts` | 30-145 |
| BFF reservar + **doble-conteo** | `bff/src/routes/session-bookings.ts` | 405-425 (validación), 820-826 (incremento a quitar) |
| BFF cálculo `sessions_remaining` | `bff/src/routes/attendance.ts` | 208 |
| `children.team_id` (legacy) | `supabase/migrations/20260217000001_schema_refactored.sql` | 380 |
