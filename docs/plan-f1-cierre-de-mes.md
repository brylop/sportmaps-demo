# Plan F1 — Cierre de Mes (cobros)

**Producto:** SportMaps · **Fecha:** 2026-08-27 · **Rama:** `feature/school-module-overrides-f3` (mover a rama propia antes de escribir migraciones — ver §7)
**Estado:** 🟡 plan propuesto — **pendiente de aprobación antes de escribir migraciones**
**Cubre:** F1 + parte de F2 de [`specs/month-close-module.md`](specs/month-close-module.md) §11. F0 (generación unificada, `open_month`) ya está construido y verificado — no se toca acá.

---

## 0. Alcance acordado en esta conversación (27-ago-2026)

El spec v0.4 ya tenía D1–D14 resueltas, pero tres decisiones de UI/producto se cerraron recién ahora y **acotan el alcance de v1 más de lo que el spec original preveía**:

1. **El botón no bloquea pagos (soft-close, D5 ya estaba).** Confirmado explícitamente: cerrar el mes es un acto de registro/reporte, no un candado. Un pago puede seguir entrando después de cerrado; afecta la caja del mes en que entra (H3), no el snapshot cerrado.
2. **El detalle nominal (quién debe / quién pagó) NO se congela en el snapshot — se consulta en vivo, filtrado por período.** Solo los **totales agregados** (facturado/cobrado/cartera/mora + conteos) se congelan. Esto tira abajo la necesidad de un `breakdown` nominal versionado que el spec dejaba abierto en §7 — **simplifica el modelo de datos**.
3. **No se construye una tabla propia de "quién pagó"**: se reutiliza el tab **Historial** que ya existe en `PaymentsAutomationPage.tsx` (filtrado por rango de fechas del período). Tampoco se construye una tabla nueva de "quién debe": se reutiliza **`PaymentAgingCard`** (`get_payment_aging_report`), que ya vive en `FinancesPage.tsx`.
4. **Sí se construye un drill-down por atleta**: al hacer clic en un atleta desde el cierre, se ve un timeline — fecha real de pago, qué debía en ese momento, y las sesiones (asistencia) que tomó en el período. **v1 muestra el cruce crudo** (pagos + asistencia superpuestos en el tiempo), **sin resolver todavía** el criterio de "sesión cubierta vs sin cubrir" — eso es una iteración posterior, explícitamente pospuesta por el usuario.
5. **Ubicación:** tab nuevo **"Cierre"** en Gestión de Pagos (`/payments-automation`), junto al tab **"Config"** (donde ya vive `BackfillPaymentsCard`, la card "Apertura del Mes — Generar Cobros", [`PaymentsAutomationPage.tsx:2618-2747`](../frontend/src/pages/PaymentsAutomationPage.tsx#L2618-L2747)) — son las dos mitades del mismo ciclo (abrir / cerrar) y conviene tenerlas visualmente cerca.

**Resultado del recorte:** v1 no necesita nueva tabla paginada de detalle, ni jsonb de breakdown nominal versionado. Es más chico que lo que el spec original dibujaba en §7.

---

## 1. Lo que YA existe y no hay que reconstruir

| Pieza | Dónde | Cubre |
|---|---|---|
| Generación unificada (`open_month`/`preview_open_month`) | [`20260724000002`](../supabase/migrations/20260724000002_open_month_rpc.sql), [`20260803114540`](../supabase/migrations/20260803114540_open_month_distinct_athlete.sql) | Apertura del mes — F0, cerrado |
| Botón "Generar cobros" | `PaymentsAutomationPage.tsx:2618` (`BackfillPaymentsCard`, tab Config) | La mitad "abrir" del ciclo |
| Cartera por atleta con antigüedad (quién debe) | `get_payment_aging_report` ([`20260824141220`](../supabase/migrations/20260824141220_rpc_aging_cartera_por_atleta.sql)) + `PaymentAgingCard.tsx` en `FinancesPage.tsx` | "Quién debe" — **se reutiliza tal cual**, filtrado por período |
| Grilla de estado por atleta (últimos N meses) | `get_school_payment_history_grid` ([`20260824171232`](../supabase/migrations/20260824171232_rpc_historial_pagos_por_atleta.sql)) | Base para el drill-down §3 — hay que extenderla, no reemplazarla |
| Transacciones / quién pagó | Tab "Historial" en `PaymentsAutomationPage.tsx:1856` | "Quién pagó" — **se reutiliza tal cual**, filtrado por rango de fechas del período que se cierra |
| Vista previa del próximo cierre | `NextMonthCloseCard.tsx` en `FinancesPage.tsx` | Ya linkea a `/payments-automation?tab=config` — **cuando exista el tab Cierre, este link debe apuntar ahí**, no a Config (ver §8) |
| Preview de mes por venir | `preview_open_month` | Reutilizado por `NextMonthCloseCard` — no confundir con `preview_close_month` (nuevo, §4) |

**Lo que NO existe (verificado):** la tabla `monthly_closes` no aparece en ninguna migración del repo ni en `frontend/src/integrations/supabase/types.ts` (columnas `month_close_draft_day`, `monthly_close`, `carried_over_from` — cero resultados). No hay RPC `close_month`, `preview_close_month` ni `reopen_month`. F1 está 100% sin construir, tal como decía la memoria — verificado contra código, no solo recordado.

> ⚠️ El spec §6 menciona reutilizar "`usePagedRpc` + `Pager`" para paginación server-side. **No existen esos nombres en el repo** (`grep` sin resultados) — `PaymentAgingCard` pagina client-side sobre el array ya cargado (`AGING_PAGE_SIZE = 25`, slice en memoria). El spec describía una aspiración, no código existente. v1 sigue el patrón real (paginación en cliente), consistente con lo que ya hay.

---

## 2. Modelo de datos

```sql
CREATE TABLE public.monthly_closes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  branch_id         uuid REFERENCES public.school_branches(id),  -- v1 siempre NULL (single-branch)
  period_year       smallint NOT NULL CHECK (period_year BETWEEN 2020 AND 2100),
  period_month      smallint NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  scope             text NOT NULL DEFAULT 'cobros'
                    CHECK (scope IN ('cobros','gastos','nomina','consolidado')),  -- v1 solo usa 'cobros'
  status            text NOT NULL DEFAULT 'abierto'
                    CHECK (status IN ('abierto','cerrado','reabierto')),  -- sin 'en_revision': no hay borrador auto v1 (§9)
  opened_by         uuid REFERENCES public.profiles(id),   -- NULL = backfill (mes histórico nunca abierto formalmente)
  opened_at         timestamptz,
  closed_by         uuid REFERENCES public.profiles(id),
  closed_at         timestamptz,
  reopened_by       uuid REFERENCES public.profiles(id),
  reopened_at       timestamptz,
  reopen_reason     text,
  -- Snapshot (solo totales agregados — el detalle nominal se consulta en vivo, §0.2)
  total_expected    numeric NOT NULL DEFAULT 0,  -- facturado
  total_settled     numeric NOT NULL DEFAULT 0,  -- cobrado (paid + amount_paid de partial)
  total_open        numeric NOT NULL DEFAULT 0,  -- cartera = expected - settled
  total_late_fees   numeric NOT NULL DEFAULT 0,
  count_expected    integer NOT NULL DEFAULT 0,
  count_settled     integer NOT NULL DEFAULT 0,
  count_open        integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Un cierre activo por escuela/sede/período/scope. branch_id NULL no colisiona en
-- Postgres (NULL <> NULL) → índice único parcial adicional (mismo gotcha que el
-- spec ya documentaba en §7).
CREATE UNIQUE INDEX uniq_monthly_close_branch
  ON public.monthly_closes (school_id, branch_id, period_year, period_month, scope)
  WHERE branch_id IS NOT NULL;
CREATE UNIQUE INDEX uniq_monthly_close_no_branch
  ON public.monthly_closes (school_id, period_year, period_month, scope)
  WHERE branch_id IS NULL;
```

**Recortes deliberados frente al spec §7 original:**
- Sin `generation_summary jsonb` (era para trazar la apertura; `open_month` ya devuelve su propio resultado al frontend, no hace falta duplicarlo en `monthly_closes`).
- Sin `breakdown jsonb` (era el detalle nominal — §0.2 lo saca del snapshot).
- Sin `en_revision` en el `CHECK` de `status` — no hay borrador automático día 5 en v1 (ver §9, decisión pendiente si se quiere después).
- `scope` queda con las 4 opciones en el `CHECK` (no cuesta nada dejarlo abierto), pero **la RPC de v1 solo acepta `'cobros'`** — gastos/nómina/consolidado son F5/F6, fuera de este plan.

Convenciones del repo respetadas: `text + CHECK` (no `CREATE TYPE`), FK de negocio a `public.profiles(id)`.

---

## 3. RPCs (`SECURITY DEFINER`, patrón del repo)

Todas con `SET search_path = pg_catalog, public, pg_temp`, `REVOKE ALL FROM PUBLIC, authenticated, anon` + `GRANT EXECUTE TO authenticated`, gate `is_super_admin() OR is_school_admin(p_school_id)` — mismo patrón que `get_payment_aging_report` y `open_month`.

### 3.1 `preview_close_month(p_school_id, p_year, p_month, p_branch_id DEFAULT NULL)`

Solo lectura. Calcula los mismos 7 números que congelaría `close_month`, **sin escribir nada**:

```sql
SELECT
  count(*) FILTER (WHERE true)                                   AS count_expected,
  sum(amount)                                                     AS total_expected,
  count(*) FILTER (WHERE status IN ('paid','partial'))            AS count_settled,
  sum(COALESCE(amount_paid, amount)) FILTER (WHERE status IN ('paid','partial')) AS total_settled,
  count(*) FILTER (WHERE status IN ('pending','overdue','partial')) AS count_open,
  sum(amount - COALESCE(amount_paid,0)) FILTER (WHERE status IN ('pending','overdue','partial')) AS total_open,
  sum(late_fee_amount)                                            AS total_late_fees
FROM public.payments
WHERE school_id = p_school_id
  AND period_year = p_year AND period_month = p_month
  AND (p_branch_id IS NULL OR branch_id IS NULL OR branch_id = p_branch_id)
  AND status <> 'cancelled';  -- cancelado no cuenta en ningún total
```

⚠️ **Punto a decidir en preflight, no a asumir:** ¿`rejected` cuenta como facturado-no-cobrado (cartera) o se excluye como `cancelled`? El spec de aging (`get_payment_aging_report`) NO incluye `rejected` en su set de deuda (§ comentario mig. `20260824141220`). Por consistencia, `rejected` se trata igual que `cancelled` — se excluye de todos los totales. Si el preflight (§6) muestra volumen relevante de `rejected` con período poblado, se reevalúa.

### 3.2 `close_month(p_school_id, p_year, p_month, p_branch_id DEFAULT NULL)`

1. Gate de rol.
2. `INSERT ... ON CONFLICT (school_id, period_year, period_month, scope) WHERE branch_id IS NULL DO UPDATE` — si no existe la fila `abierto` (mes histórico nunca abierto por `open_month`, D13), la crea; si existe, la actualiza.
3. Corre el mismo cálculo de §3.1, escribe los 7 totales + `status='cerrado'`, `closed_by=auth.uid()`, `closed_at=now()`.
4. Advisory lock por `(school_id, year, month)` — mismo patrón que `open_month`, evita doble-cierre concurrente.
5. **Idempotente (confirmado 27-ago):** cerrar un mes ya cerrado **recalcula y sobreescribe** el snapshot directo, sin pasar por `reopen_month`. Prioriza simplicidad de uso sobre trazabilidad de "quién recalculó" — si más adelante hace falta ese rastro, se agrega sin romper el contrato (el `updated_at`/`closed_by`/`closed_at` ya quedan pisados con el último valor, que es un mínimo de auditoría).

### 3.3 `reopen_month(p_school_id, p_year, p_month, p_reason text, p_branch_id DEFAULT NULL)`

`status='reabierto'`, `reopened_by`, `reopened_at`, `reopen_reason` **obligatorio** (D6 del spec, ya decidida). No borra el snapshot anterior — lo deja como último valor conocido hasta el próximo `close_month`.

### 3.4 `get_athlete_payment_timeline(p_school_id, p_athlete_key, p_year, p_month, p_branch_id DEFAULT NULL)` — drill-down (§0.4)

Extiende la lógica de identidad de `get_school_payment_history_grid` (mismo patrón: `child_id` / `COALESCE(user_id, parent_id)` / `unregistered_athlete_id`). Devuelve, para un atleta y un período (con algo de margen antes/después para dar contexto):

```sql
-- Eventos de pago del período (y el mes anterior, para ver si "debía" al inicio)
SELECT 'pago' AS tipo, p.payment_date AS fecha, p.status, p.amount, p.amount_paid, p.period_year, p.period_month
FROM public.payments p
WHERE p.school_id = p_school_id AND <identidad del atleta>
  AND (p.period_year, p.period_month) IN ((p_year, p_month), <mes anterior>)

UNION ALL

-- Sesiones (asistencia) tomadas en el rango del período
SELECT 'sesion' AS tipo, a.attendance_date AS fecha, a.status, NULL, NULL, NULL, NULL
FROM public.attendance_records a
WHERE a.school_id = p_school_id AND <identidad del atleta>
  AND a.attendance_date BETWEEN <primer día del mes> AND <último día del mes>

ORDER BY fecha;
```

**v1 no cruza "sesión cubierta/no cubierta"** — devuelve los dos flujos crudos, ordenados por fecha, y el frontend los intercala visualmente (como la tabla de §0.4 de la conversación). El cálculo de cobertura queda para una iteración posterior, explícitamente pospuesta.

### 3.5 `get_school_year_closes_report(p_school_id, p_year, p_branch_id DEFAULT NULL)` — reporte general del año (confirmado 27-ago)

Requisito nuevo: todos los cierres de un año deben poder verse juntos, no solo mes a mes. Como cada `monthly_closes` ya guarda sus 7 totales, el reporte anual es una lectura directa — no necesita agregación nueva ni recalcular nada:

```sql
SELECT period_month, status, total_expected, total_settled, total_open, total_late_fees,
       count_expected, count_settled, count_open, closed_at
FROM public.monthly_closes
WHERE school_id = p_school_id AND period_year = p_year AND scope = 'cobros'
  AND (p_branch_id IS NULL AND branch_id IS NULL)
ORDER BY period_month;
```

Meses del año que todavía no tienen fila en `monthly_closes` (no abiertos, no cerrados) se completan en la respuesta como `status: 'sin_cierre'` con totales en `0`, para que el reporte muestre los 12 meses del año sin huecos silenciosos. Mismo gate de rol que las demás RPCs de este plan.

---

## 4. Frontend

**Tab nuevo "Cierre"** en `PaymentsAutomationPage.tsx`, en el `TabsList` de [`:1361-1368`](../frontend/src/pages/PaymentsAutomationPage.tsx#L1361-L1368), entre "Historial" y "Config" (las dos mitades del ciclo — abrir/cerrar — quedan adyacentes):

```
Cobros | Equipos y Planes | Glosas | Conciliación | Historial | Cierre | Config
```

Contenido del tab (v1):
1. Selector de mes (default: mes anterior al actual, que es el que normalmente se cierra). El **mes en curso** (el que todavía transcurre) se marca con un badge **"Mes en curso — sin cerrar"**, visualmente separado de la lista de cierres ya confirmados (§4.6) — para no confundir "lo que va corrido de este mes" con un cierre real.
2. Tarjetas de totales — llaman `preview_close_month` si `status='abierto'`/no existe, o leen el snapshot si ya está `cerrado`.
3. **Split confirmado (27-ago): cartera pendiente vs al día, no una sola lista mezclada:**
   - **Cartera pendiente** (quién debe): se **reutiliza `PaymentAgingCard`** tal cual — ya trae el bucket por antigüedad (1/2/3+ meses) y, para cada atleta que debe, **`clases_desde_vencimiento`** (cuántas sesiones tomó mientras debía) — esto ya resuelve el cruce "asistencias de quienes deben" que pediste, sin construir nada nuevo. Requiere agregarle un prop opcional `periodFilter` (hoy filtra toda la cartera viva, sin acotar a un mes); prop opcional con default = comportamiento actual, no rompe su uso en `FinancesPage.tsx`.
   - **Al día**: roster con `al_dia = true` de `get_school_payment_history_grid`, filtrado al período del cierre — lista separada, sin mezclar con la de arriba.
4. **Quién pagó**: link "Ver en Historial" → `/payments-automation?tab=history` con el rango de fechas del período precargado (mismo patrón que `NextMonthCloseCard` ya usa con `?tab=config`).
5. Botón **"Cerrar mes"** con diálogo de confirmación que explica el carryover (D1: los pendientes siguen vivos, no desaparecen). Volver a apretarlo sobre un mes ya cerrado **recalcula directo** (confirmado 27-ago, §3.2.5) — sin paso de reapertura.
6. Historial de cierres anteriores (tabla simple: período, cerrado por, fecha, totales) — client-side, sin paginación server-side (§1, corrección al spec).
7. Clic en un atleta de la tabla de deben → modal/drawer con el timeline de §3.4.
8. **Reporte general del año** (confirmado 27-ago): vista/gráfico aparte (puede vivir como sub-tab dentro de "Cierre", o como sección al final) que llama a `get_school_year_closes_report` (§3.5) y muestra los 12 meses del año en una sola tabla/gráfico de tendencia (facturado/cobrado/cartera por mes) — todos los cierres del año alimentan esta vista automáticamente porque leen directo de `monthly_closes`, sin cálculo adicional.

**`NextMonthCloseCard.tsx:63`** — el link `to="/payments-automation?tab=config"` pasa a `?tab=cierre` cuando este tab exista (hoy apunta a Config porque el botón de abrir vivía ahí y era lo único disponible; el nombre del comentario en línea 61-62 ya lo explica).

---

## 5. Auditoría

Patrón estándar del repo: `audit_trigger_func()` (AFTER INS/UPD/DEL) sobre `monthly_closes` + `admin_activity_logs`. No hace falta tabla de auditoría dedicada — la reapertura ya queda trazada en las columnas propias (`reopened_by/at/reason`).

---

## 6. Preflight (correr antes de escribir migraciones)

```sql
-- V1. Confirmar que monthly_closes sigue sin existir (por si algo cambió fuera del repo)
SELECT to_regclass('public.monthly_closes');

-- V2. Volumen de 'rejected' con período poblado — decide §3.1
SELECT period_year, period_month, count(*), sum(amount)
FROM public.payments WHERE status = 'rejected' AND period_year IS NOT NULL
GROUP BY 1,2 ORDER BY 1 DESC, 2 DESC LIMIT 12;

-- V3. ¿Cuántos payments quedarían fuera de los totales por NO tener period_year/period_month?
-- (siguen siendo los 349 que el plan F0 dejó documentados como hueco de backfill)
SELECT count(*) FROM public.payments
WHERE period_year IS NULL AND status NOT IN ('cancelled','rejected','failed');

-- V4. ¿Algún mes ya tiene algo parecido a un cierre hecho a mano / por otra vía?
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND column_name ILIKE '%month_close%';
```

**Puerta de decisión:** si V3 devuelve un número alto, `preview_close_month`/`close_month` estarían subcontando facturación real — mismo hueco que el plan F0 ya documentó (§3.4 de ese plan) y que decidió no resolver todavía. Este plan hereda esa decisión: **no bloquea F1**, pero el snapshot de meses con backlog de `period_year NULL` será impreciso hasta que se resuelva el backfill.

### 6.1 Resultado — corrido en vivo 27-ago-2026 (`scripts/preflight-f1-cierre-de-mes.mjs`, read-only)

| Check | Resultado |
|---|---|
| **V1** | `monthly_closes` **no existe** en la base viva — confirma lo que decía el repo, sin deriva |
| **V2** | Solo **7 cobros** `rejected` con `period_year` poblado, **$870.000** total, repartidos 1 por periodo (2026-07 a 2027-03). Volumen trivial → **decisión §9.1 resuelta: se excluye `rejected` de los totales**, igual que `cancelled` — no vale la pena una regla distinta para 7 filas |
| **V3** | **285 payments activos sin `period_year`** (237 `paid`, 47 `overdue`, 1 `partial`), **$58.546.653** — es el mismo hueco heredado de F0 (documentado ahí como "349", ya bajó a 285 con limpiezas posteriores). **No bloquea F1**: son en su mayoría pagos históricos previos a que `open_month` empezara a poblar `period_year` (24-jul-2026). Un cierre del mes **actual** no los toca (esos meses ya nacen con período poblado); un cierre **retroactivo** de un mes viejo sí los subcontaría — documentar la limitación en la UI si se ofrece cerrar meses anteriores a agosto 2026 |

---

## 7. Tests

| # | Escenario | Esperado |
|---|---|---|
| 1 | `close_month` dos veces seguidas, mismo mes | Segunda llamada recalcula, no error (§3.2.5) |
| 2 | `close_month` mientras entra un webhook MP que marca un pago `paid` | El snapshot refleja un estado consistente (todo antes o todo después de la transacción del webhook) — nunca mitad y mitad |
| 3 | `close_month` mientras corre `apply_late_fees()` | Mismo criterio: no mezclar mora a medio aplicar |
| 4 | `reopen_month` sin `p_reason` | Rechaza (NOT NULL / validación explícita) |
| 5 | `preview_close_month` vs `close_month` sobre el mismo período, sin cambios entre medio | Totales idénticos |
| 6 | Pago que entra **después** de `close_month` | No muta el snapshot cerrado; si se vuelve a `close_month` (recálculo), sí lo refleja — coherente con soft-close (D5) |
| 7 | Dos escuelas cerrando el mismo período en paralelo | Sin bloqueo cruzado (el advisory lock es por `school_id`) |
| 8 | `get_athlete_payment_timeline` con atleta sin ningún pago en el período | Devuelve solo sesiones (si las hay), sin error |

---

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| `PaymentAgingCard` con el nuevo prop `periodFilter` rompe su uso actual en `FinancesPage.tsx` (sin período, cartera completa) | Prop opcional con default `undefined` = comportamiento actual sin cambios; probar ambos usos antes de mergear |
| El link de `NextMonthCloseCard` queda apuntando a `?tab=config` si se olvida el cambio de §4 | Se lista explícito como parte de este plan, no una nota suelta |
| Los 285 `payments` sin `period_year` ($58,5M, medido 27-ago — §6.1 V3) hacen que un cierre **retroactivo** de un mes anterior a agosto 2026 subcuente sin que se note | No afecta el cierre del mes actual/en curso (ya nace con período poblado desde F0). Si se ofrece cerrar meses viejos, mostrar aviso comparando `count_expected` contra un conteo alternativo por `due_date`, o documentar la limitación sin bloquear v1 |
| Confusión entre `preview_open_month` (F0, genera cobros del mes siguiente) y `preview_close_month` (F1, totales del mes que se cierra) — nombres parecidos | Nombrar sin ambigüedad en el código y en la UI: "Abrir mes" vs "Cerrar mes" en los botones, nunca "generar/procesar" genérico |
| `close_month` idempotente (recalcula sin exigir `reopen_month`) puede sorprender si alguien ya citó el número en un reporte externo | Aceptado para v1 (no hay reportes externos todavía que consuman el snapshot); revisar si en F2+ conviene exigir `reopen_month` explícito antes de recalcular |

---

## 9. Decisiones — estado

| # | Decisión | Resolución |
|---|---|---|
| 1 | ¿`rejected` cuenta como cartera o se excluye igual que `cancelled`? (§3.1) | ✅ **Resuelta (27-ago, preflight V2): se excluye.** Solo 7 filas / $870.000 en toda la base — volumen trivial, se trata igual que `cancelled` por consistencia con `get_payment_aging_report` |
| 2 | ¿Recerrar (§3.2.5) recalcula libremente, o exige pasar por `reopen_month` primero? | ✅ **Resuelta (27-ago): recalcula directo**, sin exigir reapertura |
| 3 | ¿Se quiere ya el borrador automático día 5 (`en_revision`, D2/D8 del spec) o se pospone? | ✅ **Resuelta (27-ago): pospuesto.** v1 = solo botón manual, sin cron de borrador. `status` de `monthly_closes` queda sin `en_revision` (§2) |
| 4 | Nombre exacto del botón y del tab en la UI | Propuesta: tab **"Cierre"**, botón **"Cerrar mes"**, encabezado **"Cierre de Mes"** (D9 del spec) — sin objeción, se da por buena salvo que se diga lo contrario |

---

## 10. Orden de ejecución

1. **Preflight §6** — correr contra la base viva (dev), especialmente V2 y V3.
2. Resolver las decisiones de §9 (al menos 1 y 3, que cambian código).
3. Migración `monthly_closes` + índices únicos (`npm run migrations:new -- monthly-closes-table`).
4. Migración de las 4 RPCs (`preview_close_month`, `close_month`, `reopen_month`, `get_athlete_payment_timeline`) — puede ir en la misma migración o separada, siguiendo el patrón de M1/M2 del plan F0 (separadas si conviene poder revertir una sin la otra).
5. Frontend: tab "Cierre" + prop `periodFilter` en `PaymentAgingCard` + corrección del link en `NextMonthCloseCard` + drill-down.
6. Tests de concurrencia §7.
7. Actualizar `specs/month-close-module.md` marcando F1 como entregado y `ROADMAP.md` (agregar `DIN-20` o el próximo ID libre, siguiendo la convención de IDs estables del catálogo).

---

## 11. Fuera de alcance (explícito)

- **`scope` gastos / nómina / consolidado** (F5/F6 del spec) — el `CHECK` los deja como valores válidos en la tabla, pero ninguna RPC de este plan los produce.
- **Borrador automático día 5** (`en_revision`) — pospuesto, ver §9.3.
- **Resolver "sesión cubierta vs sin cubrir"** en el drill-down — pospuesto explícitamente por el usuario; v1 solo muestra el cruce crudo pago+asistencia.
- **Tabla propia de "quién pagó"** — se reutiliza el tab Historial existente, sin cambios a su lógica.
- **Multi-sede real** (`branch_id` no NULL) — columna reservada, sin UI ni RPC que la ejerciten en v1.
- **Asientos contables / Estado de Resultados** — F6, fuera de alcance total de este plan.
