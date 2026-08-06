# Plan — Vigencia y clases derivadas del periodo pagado

**Estado:** propuesta, pendiente de aprobación. No hay SQL escrito todavía.
**Fecha:** 2026-08-05
**Decisiones de producto (dadas por el dueño del producto):**

1. Un pago del valor del plan = un periodo. Dos pagos = dos periodos.
2. La bolsa de clases se calcula sobre los periodos pagados.
3. La vigencia se **muestra** como rango: desde qué día hasta qué día.
4. **Las clases no usadas se vencen con el periodo** (2026-08-05). No se acumulan: si el
   atleta no fue, es problema del atleta. Que se venzan *es* el control — y para la
   escuela es la duda regular, así que tiene que quedar visible.
5. **El saldo de clases se muestra en el histórico de asistencia**, no solo en la ficha:
   ahí es donde la escuela y el padre lo van viendo mes a mes.

---

## 1. Qué está mal hoy

### 1.1 La vigencia se regala y luego se suma (bug principal)

Dos escrituras independientes se acumulan en `enrollments.expires_at`:

| # | Quién | Qué escribe |
|---|---|---|
| 1 | BFF al asignar el plan — [`students.ts:980-982`](../bff/src/routes/students.ts#L980-L982) | `expires_at = inicio + 30` **hardcodeado**, sin que nadie haya pagado y **ignorando `duration_days`** |
| 2 | Trigger `fn_extend_enrollment_on_payment_paid` — [migración 20260717171018:89](../supabase/migrations/20260717171018_extend_enrollment_on_payment_paid.sql#L89) | `expires_at = GREATEST(expires_at, hoy) + duration_days` |

El pago no *cubre* el mes ya concedido en (1): lo *extiende*. Un mes pagado = dos meses de
acceso.

**Medido en la base (2026-08-05), 667 inscripciones activas con plan:**

| Vigencia otorgada (inicio → `expires_at`) | Casos | Lectura |
|---|---|---|
| 30 días | 145 | el mes regalado, nadie pagó |
| 54 días | 93 | `start_date` reescrito por los merges de inscripciones divididas; `expires_at` quedó del cálculo anterior |
| 60 días | 53 | un periodo pagado → dos meses de acceso |
| 84 días | 18 | dos extensiones acumuladas |
| 58, 59, 61, 56, 53, 83 días | 28 | variantes del mismo desalineo |

`PLAN DYNASTY` (`duration_days = 30`, `max_sessions = 16`, $210.000) — 27 inscripciones
activas, pagado vs. otorgado:

- 12 con **$0 pagado** y entre 30 y 54 días de acceso vigente
- 9 con **1 periodo pagado** y entre 58 y 84 días de acceso
- 1 con $250.000 (1,19 periodos) y 60 días
- 8 **sin `expires_at`** — el alta por QR (`sportmaps_join_by_qr`) nunca lo setea

El caso reportado: `start_date = 2026-08-05`, cobro del 2026-07-30 marcado *paid* el
2026-08-05 → `09-04 + 30 = 10-04`.

### 1.2 La bolsa de clases nunca se renueva (bug hermano, aún no visible)

`enrollments.sessions_used` es un contador acumulado **sin noción de periodo**. Los
únicos `sessions_used = 0` del código están en los INSERT de alta
([`enrollments.ts:304`](../bff/src/routes/enrollments.ts#L304),
[`:439`](../bff/src/routes/enrollments.ts#L439),
[`:635`](../bff/src/routes/enrollments.ts#L635),
[`public-booking.routes.ts:554`](../bff/src/routes/public-booking.routes.ts#L554),
[`trainer/clients.ts:644`](../bff/src/routes/trainer/clients.ts#L644)) — **ningún reset
periódico, ningún cron**. `move_session_credit` topea contra `max_sessions` del plan, que
es un tope *por mes*.

Consecuencia: con un plan de 16 clases/mes, al llegar a 16 clases acumuladas el atleta
queda bloqueado **para siempre**, aunque siga pagando.

Hoy: **141** inscripciones activas con consumo > 0, **5 con la bolsa llena** y **3 a dos
clases de llenarse**. Todavía no explotó porque el módulo de asistencia es reciente.

### 1.3 Re-marcar un pago vuelve a otorgar

El trigger dispara con `OLD.status IS DISTINCT FROM 'paid' AND NEW.status = 'paid'`. Un
pago que va `paid → pending → paid` (corrección de la escuela, reintento de webhook)
otorga **dos** periodos. No hay nada que ate el otorgamiento al pago que lo causó.

### 1.4 La facturación no está afectada

Verificado: `expires_at` no aparece en ninguna de las funciones de generación de cobros
(`open_month` / `generate_monthly_charges`). La facturación mensual es independiente y
está correcta. Lo que está mal es la **vigencia de acceso** y lo que se le **muestra** a
la escuela.

---

## 2. Modelo propuesto

Un pago no *extiende* nada: **compra un periodo**, y el periodo es una fila.

### Tabla nueva `enrollment_periods`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `enrollment_id` | uuid → `enrollments(id)` | |
| `school_id` | uuid → `schools(id)` | para RLS sin joins |
| `payment_id` | uuid → `payments(id)` | **UNIQUE** — la idempotencia es estructural (§1.3) |
| `starts_on` / `ends_on` | date | el rango que se le muestra al padre |
| `sessions_granted` | integer | `max_sessions` del plan al momento de la compra |
| `source` | text + CHECK (`payment`, `courtesy`, `manual`, `backfill`) | sin `CREATE TYPE`, como manda CLAUDE.md |
| `created_at` | timestamptz | |

`enrollments.expires_at` pasa a ser **derivado**: `max(ends_on)` de los periodos. Se deja
la columna (la leen `attendance.ts`, `session-bookings.ts`,
`fn_process_session_booking` y la vista `school_athletes`) pero solo la escribe la RPC.

### El consumo vive en el periodo, no en la inscripción

Como las clases **se vencen** (decisión 4), el contador acumulado de la inscripción deja
de servir: hay que saber cuántas se usaron *dentro de cada ventana*. `enrollment_periods`
lleva entonces su propio `sessions_used` / `secondary_sessions_used`, y
`move_session_credit` resuelve el periodo vigente por fecha y mueve el contador **ahí**,
conservando el `SELECT … FOR UPDATE`.

`enrollments.sessions_used` se conserva como **espejo del periodo vigente** (lo escribe la
misma RPC). Así no hay que tocar los ~6 callers ni la vista `school_athletes`, y el saldo
que ya muestran las pantallas pasa a ser el correcto sin cambiarles el contrato.

Efecto lateral bueno: cada periodo queda con su consumo histórico congelado — que es
exactamente lo que necesita el histórico de asistencia (decisión 5) para decir "en agosto
usó 12 de 16" sin recalcular nada.

**Clase fuera de cobertura:** si la fecha no cae en ningún periodo, la asistencia **se
registra igual** (regla ya cerrada: la falta de créditos nunca impide registrar el hecho)
pero no descuenta, y queda marcada como fuera de cobertura. Eso le da a la escuela la
señal que hoy no tiene: quién está entrando sin haber pagado.

**Encadenamiento:** `starts_on = GREATEST(último ends_on + 1, enrollment.start_date)`,
`ends_on = starts_on + duration_days - 1`. Pagar dos meses de una da dos filas
consecutivas → un solo rango visible de 2 meses, sin regalar días por atrasarse.

### RPC única `grant_enrollment_period(p_payment_id uuid)`

`SECURITY DEFINER`, `SET search_path = pg_catalog, public, pg_temp`, `GRANT EXECUTE … TO
authenticated` (explícito — `SECURITY DEFINER` no exime al caller).

1. `SELECT … FOR UPDATE` sobre la inscripción (contador ⇒ RPC con lock, CLAUDE.md).
2. `periodos = floor(monto_pagado_acumulado / precio_del_plan)` — cuántos periodos
   compró en total.
3. Inserta las filas que falten hasta llegar a `periodos` (`ON CONFLICT (payment_id) DO
   NOTHING` cubre el re-marcado).
4. Recalcula `expires_at` y `sessions_granted` de la inscripción.

El trigger de `payments` deja de hacer aritmética: solo llama a esta RPC.

---

## 3. Decisiones abiertas — necesito tu respuesta

| # | Pregunta | Mi recomendación |
|---|---|---|
| **D1** | Atleta recién inscrito, cobro emitido pero **sin pagar**: ¿puede entrar? | **Cortesía hasta el `due_date` del primer cobro** (no 30 días). Queda como periodo `source='courtesy'` con `sessions_granted = 0` o el tope mensual, según D2. Hoy se le regala un mes completo. |
| **D3** | Pago **parcial** (`amount_paid < amount`) o abono de $250.000 sobre un plan de $210.000: | **Solo periodos completos** (`floor`), el sobrante queda como saldo y suma al siguiente pago. No prorratear días. |
| **D4** | ¿El periodo es **mes de facturación** o **rango rodante de `duration_days`**? Aparece ahora porque el histórico va por mes calendario ([`attendance.ts:1184`](../bff/src/routes/attendance.ts#L1184)) y un periodo 05 ago – 04 sep se parte en dos columnas del informe. | **Híbrido, por tipo de plan.** Los 98 planes activos de `duration_days = 30` anclan al **mes de facturación** del pago (`payments.period_year` / `period_month`, que ya existen y ya vienen rellenados): el cobro de agosto otorga el periodo de agosto, con sus 16 clases, y cuadra exactamente con la columna de agosto del histórico. Los 36 planes de 90/180/365 días siguen con rango rodante, que es para lo que existe `duration_days`. |

**D2 — resuelto (2026-08-05):** las clases **se vencen** con el periodo. Ver decisión 4
arriba; el diseño de §2 ya está reescrito para eso.

---

## 4. Fases

Una rama por fase, revisión entre cada una.

| Fase | Alcance | Entregable |
|---|---|---|
| **F1 — Modelo** | Migración nueva: tabla `enrollment_periods` (con `sessions_used` propio) + RLS (policies sin `SELECT` sobre la propia tabla) + índices, incluido uno por `(enrollment_id, starts_on, ends_on)` para resolver el periodo vigente por fecha. Sin tocar el trigger todavía. | 1 migración vía `npm run migrations:new` |
| **F2 — RPC + trigger** | `grant_enrollment_period()` con `FOR UPDATE`; el trigger pasa a llamarla; `revoke_enrollment_period()` para el pago anulado/reversado. `move_session_credit` v2: resuelve el periodo por fecha, mueve el contador del periodo y refleja en la inscripción. Tests de concurrencia (dos reservas simultáneas, dos pagos simultáneos, webhook duplicado, `paid→pending→paid`) y de **cambio de periodo** (clase del 04 sep vs del 05 sep consumen bolsas distintas). | 1 migración + tests |
| **F3 — BFF** | Sacar el `+30` de [`students.ts:981`](../bff/src/routes/students.ts#L981); el alta ya no escribe `expires_at` (lo hace la RPC vía cortesía D1). `sportmaps_join_by_qr` idem. `attendance.ts` y `session-bookings.ts` reportan el periodo vigente y su saldo. **`GET /attendance/history` agrega por atleta `clases_otorgadas` / `clases_usadas` / `clases_restantes` del periodo que cubre ese mes** — el consolidado por atleta ya existe, es una columna más. | PR BFF |
| **F4 — Frontend** | El modal deja de decir un "Vence" suelto: muestra **`Cubierto: 05 ago – 04 sep`**, `Clases: 3 de 16`, y el estado del cobro. Si hay 2 periodos: `05 ago – 04 oct · 2 meses pagados`. **[`AttendanceHistoryPage`](../frontend/src/pages/AttendanceHistoryPage.tsx) suma la columna de saldo** en el consolidado por atleta, y marca las asistencias fuera de cobertura. Mismo bloque en la ficha del padre y en el carnet. | PR frontend |
| **F5 — Backfill** | Script que reconstruye los periodos de las 667 inscripciones activas desde el histórico de `payments` y recalcula `expires_at`/`sessions_granted`. **Se corre primero en modo reporte** (qué cambiaría en cada fila) para que lo revises antes de escribir. | script + reporte |
| **F6 — QA** | Auditoría de que no quede ninguna inscripción con vigencia > periodos pagados, y de que los 8 sin `expires_at` queden resueltos. | reporte |

**Nota sobre F5:** la base es compartida entre dev/stg/prod
([una sola Supabase](../CLAUDE.md)) — el backfill toca datos reales de Dynasty. No se
ejecuta nada sin tu confirmación explícita sobre el reporte.

---

## 5. Riesgos

- **F5 quita acceso a quien hoy lo tiene.** 145 inscripciones con el mes regalado y $0
  pagado pasan a cortesía-hasta-`due_date`. Hay que avisar a las escuelas antes, o dejar
  el recorte para el siguiente cierre de mes.
- **Las 93 con `start_date` reescrito** (span 54) necesitan que el backfill reconstruya
  desde los pagos, no desde `start_date` — ese campo ya no es confiable en esas filas.
- **`school_athletes` es una vista con 12 LATERAL** ya identificada como difícil de
  optimizar; agregar lecturas de `enrollment_periods` ahí puede pegarle a la latencia.
  Se resuelve exponiendo el rango en la RPC de detalle, no en la vista del listado.
