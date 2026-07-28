# Spec — Ciclo de Mes: Apertura, Generación y Cierre

**Producto:** SportMaps · **Versión:** v0.4 (decisiones resueltas + hallazgos de viabilidad — listo para plan de F0/F1)
**Fecha:** Julio 2026
**Estado:** 🟢 decisiones de producto **resueltas** (ver §12). Pendiente: plan de migraciones aprobado antes de escribir código (convención del repo).

> Se construye **por fases con revisión entre cada una** (una rama por fase). Plan aprobado antes de código en migraciones. Tests de concurrencia en la fase backend. RLS revisado línea por línea.

**Cambios v0.3 → v0.4 (revisión de viabilidad contra el código real):**
- **H1 — El índice único solo cubre menores.** `uniq_payment_active_period_per_child` filtra `WHERE child_id IS NOT NULL` → adultos (`user_id`) y no registrados **no tienen red de DB**. F0 agrega un segundo índice único parcial para adultos (§7) o el advisory lock queda como única garantía (probado a fondo).
- **H2 — La generación actual NO pobla `period_year`/`period_month`.** El cron `generate_monthly_charges()` inserta sin esas columnas y deduplica por rango de `due_date`; por eso el índice único parcial **hoy nunca protege** los cobros del cron (period NULL → índice los ignora). `open_month` DEBE poblar `period_year`/`period_month` siempre para que el dedup canónico de §4.2 sea real. Decidir backfill de cobros viejos con period NULL.
- **H3 — Tensión caja vs. periodo.** Un pago que entra tras el cierre conserva su `period_month` original pero cuenta en la caja del mes en que entra → los totales por periodo y los de caja divergen. Es cash-basis correcto, pero hay que declarar cuál manda en cada reporte (§14).

**Cambios v0.2 → v0.3:**
- El spec pasa de "Cierre de Mes" a **"Ciclo de Mes"**: se incorpora la **Apertura de Mes + generación unificada de cuotas** (nueva §4) tras el hallazgo de que hoy existen 3 vías de generación con lógicas incompatibles entre sí.
- Nueva fase **F0 — Generación unificada** (bug activo de duplicados/inconsistencia; se entrega desacoplada del cierre).
- Nuevas decisiones D12–D14, resueltas.
- Regla de desacople: **el cierre nunca depende de que exista una apertura formal** (meses históricos siguen siendo cerrables).

**Cambios v0.1 → v0.2:** decisiones D1–D11 resueltas; cierre modular (`scope`: cobros/gastos/nómina/consolidado); versionado de snapshots; `month_close_draft_day`.

---

## 0. Contexto — qué existe HOY (no reinventarlo)

El "mes a mes" ya funciona sobre **4 crons diarios de pg_cron** que leen toggles de `school_settings`. **No existe** un concepto de "cierre" ni de "apertura" — el mes rota implícitamente al cambiar el calendario:

| Cron (hora COT) | Función | Migración |
|---|---|---|
| 01:00 | `run-recurring-charges` (autopay MP) | `20260512000002_recurring_subscriptions_cron.sql` |
| 01:30 | `generate_monthly_charges()` | `20260713000003_auto_generate_monthly_charges.sql` |
| 02:00 | `apply_late_fees()` | `20260706120000` + `20260706130000` |
| 08:00 | `send_payment_reminders()` | `20260713000004_payment_reminders_engine.sql` |

**Config existente** (`school_settings`): `payment_cutoff_day` (default 10), `payment_grace_days` (5), `auto_generate_payments`, `late_fee_enabled/percentage`, `reminder_enabled/days_before`, `billing_cycle_type` (`prorated`/`fixed_calendar`/`rolling_30`), `early_payment_discount_*`, `allow_installments`.

**Estructura de `payments`:** `status` es **TEXT** (`pending`/`awaiting_approval`/`paid`/`approved`/`overdue`/`partial`/`rejected`/`refunded`/`cancelled`/`failed`), `period_year` + `period_month` (mes que cubre), `amount`, `amount_paid`, `late_fee_amount`, unique index parcial `uniq_payment_active_period_per_child` (bloquea duplicado activo mismo hijo+periodo).

### 0.1 Hallazgo: hoy las cuotas se generan por 3 vías que NO comparten lógica

| Vía | Dónde | Comportamiento |
|---|---|---|
| **A — Cron** `generate_monthly_charges()` | `20260713000003` · 01:30 COT | Solo escuelas con `auto_generate_payments=true`. Monto por jerarquía enrollment > plan > equipo > hijo. `due_date` = `payment_cutoff_day`. `payment_type='one_time'`. **Sin prorrateo.** Dedup **por mes calendario**. Omite no-registrados. |
| **B — Botón manual** (Gestión de Pagos) | `PaymentsAutomationPage.tsx:1661-1840` | Preview → confirmar. Usa `calcFirstPayment` → **SÍ prorratea** según `billing_cycle_type`. `payment_type='subscription'`. Dedup **por `due_date >= hoy`**. Inserta **client-side en loop** (`.insert()`), sin RPC ni `FOR UPDATE`. |
| **C — Lista read-only** (Recordatorios) | `PaymentRemindersPage.tsx:371` · RPC `get_athletes_without_payment` | Solo muestra atletas con inscripción activa sin cobro. No genera. |

Aparte: la **inscripción por checkout/QR** crea el primer cobro del enrollment al inscribirse (ese sí legítimamente prorrateable).

**Incompatibilidades A vs B:**

| | Cron (A) | Botón manual (B) |
|---|---|---|
| `payment_type` | `one_time` | `subscription` |
| Prorrateo | No | Sí (`calcFirstPayment`) |
| Dedup | Por mes calendario | Por `due_date >= hoy` |
| Escritura | RPC `SECURITY DEFINER` | `.insert()` client-side, sin `FOR UPDATE` |

→ Un mismo atleta puede terminar con montos/tipos distintos según qué vía lo generó, y el botón manual es vulnerable a duplicados por doble-clic/concurrencia (concuerda con [[project_payment_duplication_audit]]). **Esto es un bug activo, independiente del cierre — se arregla en F0.**

**Módulos hermanos que alimentan el cierre en fases posteriores:** Finanzas (libro de caja, proveedores, presupuesto, estado de resultados) y Nómina. En v1 el cierre NO los toca, pero el modelo de datos ya los contempla vía `scope` (§3, §7).

**Dónde vive la UI:** página **Gestión de Pagos** ([PaymentsAutomationPage.tsx](../../frontend/src/pages/PaymentsAutomationPage.tsx), ruta `/payments-automation`), con tabs: **Cobros** (validación manual), **Equipos y Planes**, **Historial**, **Config**.

---

## 1. El problema que resuelve el Ciclo de Mes

Hoy no hay un momento en que la escuela **abra el mes de forma controlada** ni **cierre el mes y vea la foto consolidada**. Consecuencias:

1. **No hay corte contable.** Los pendientes de un mes se arrastran indefinidamente como `overdue`; nadie declara "el mes X quedó cerrado con $Y cobrado y $Z por cobrar".
2. **No hay snapshot histórico.** Si mañana cambia una cuota o se borra un enrollment, la foto del mes pasado se distorsiona (los reportes se recalculan sobre datos vivos).
3. **La cartera (deuda) no es un objeto de primera clase.** El saldo pendiente se recalcula al vuelo (`pendingAmount` en el frontend) pero no se persiste ni se puede comparar mes contra mes.
4. **Decisión ambigua sobre los pendientes:** hoy un cobro no pagado queda `overdue` para siempre, sin política explícita.
5. **La apertura del mes es implícita y fragmentada** (§0.1): 3 vías de generación con dedup, prorrateo, `payment_type` y garantías de concurrencia distintos → duplicados y montos inconsistentes.
6. **(Visión) No hay Estado de Resultados del mes.** La escuela quiere saber "cómo me fue": ingresos − gastos − nómina. Ese consolidado es el destino final del cierre (fases F5–F6).

**Objetivo:** dar a la escuela un ciclo mensual explícito que (a) genere las cuotas del mes por **una sola vía** con garantías de concurrencia, (b) consolide ingresos/cartera del periodo al cerrar, (c) congele una foto inmutable, (d) defina qué pasa con lo no pagado, y (e) a futuro, consolide gastos y nómina en un Estado de Resultados congelado del mes.

---

## 2. Decisiones resueltas (resumen ejecutivo)

Detalle y justificación en §12. En una línea cada una:

1. **Pendientes:** carryover — la deuda sigue viva con su fecha original; la mora sigue corriendo.
2. **Disparo del cierre:** híbrido — borrador automático el día 5 del mes siguiente; la escuela confirma.
3. **Alcance v1:** mensualidades + inscripciones (lo que la escuela cobra directo a familias); marketplace fuera.
4. **Multi-sede:** cierre por escuela en v1; `branch_id` reservado en schema para fase 2.
5. **Soft-close:** el cierre no bloquea operar el mes siguiente.
6. **Reapertura:** admin con motivo obligatorio + auditoría + snapshots versionados.
7. **Sin asientos contables en v1:** el snapshot es autosuficiente para generarlos retroactivamente.
8. **Auto-borrador día 5** del mes siguiente, configurable por escuela.
9. **Nombre en UI:** "Cierre de Mes".
10. **Base de caja en v1** (no devengado).
11. **Consolidado opcional:** sub-cierres independientes.
12. **Generación unificada (F0):** una sola RPC `open_month` reemplaza la lógica del cron y del botón; el botón deja de insertar client-side.
13. **Desacople apertura↔cierre:** el cierre nunca exige que el mes haya sido "abierto" formalmente (meses históricos cerrables).
14. **Prorrateo confinado al enrollment:** `open_month` genera siempre cuota completa; el prorrateo (`calcFirstPayment`) vive solo en el primer cobro del flujo de inscripción/checkout.

---

## 3. Modelo conceptual

### 3.1 El ciclo completo

```
  open_month (F0)          [mes transcurre]           borrador auto (día 5)      confirmación
 ───────────────► abierto ───────────────────────► en_revision ───────────► cerrado
                     ▲                                                          │
                     │                                                          ▼ (admin + motivo)
                     └───────────────── re-cierre ◄──────────────────────  reabierto
```

- **`abierto` deja de ser implícito:** la fila `monthly_closes (scope='cobros', status='abierto')` la crea el acto de apertura (`open_month`) — o el primer cierre en meses históricos que nunca tuvieron apertura (D13: el cierre crea la fila si no existe; nunca la exige).
- La apertura **dispara la generación unificada** de cuotas del periodo (§4). El cierre consume lo que haya en `payments` del periodo, venga de la vía que venga.

### 3.2 Cierre modular: sub-cierres + consolidado

Un **cierre** es un registro por `(school_id, branch_id?, period_year, period_month, scope)` que congela los totales del periodo para un dominio:

| `scope` | Qué congela | Fase |
|---|---|---|
| `cobros` | Facturado, cobrado, cartera, mora del periodo (payments) | **F1–F2 (v1)** |
| `gastos` | Egresos del libro de caja por categoría + cuentas por pagar abiertas a proveedores | F5 |
| `nomina` | Salarios + prestaciones del periodo, pagado vs pendiente (pasivo laboral), # empleados | F5 |
| `consolidado` | Estado de Resultados del mes (base de caja): cobrado − gastos pagados − nómina pagada. Referencia los ids de los 3 sub-cierres | F6 |

Reglas del consolidado (D11): cada sub-cierre es **independiente**; el consolidado solo se habilita cuando los sub-cierres existentes del periodo están `cerrado`; módulos sin uso quedan marcados `"sin_registro"` en el snapshot.

### 3.3 Estados

```
Estados (text + CHECK, nunca CREATE TYPE):
  abierto      → mes en curso (creado por open_month o backfill del cierre); cobros se generan/pagan
  en_revision  → borrador consolidado calculado (auto el día N, o a pedido); espera confirmación
  cerrado      → foto congelada; pendientes pasaron a cartera según política
  reabierto    → un admin lo reabrió con motivo (trazado quién/cuándo/por qué)
```

### 3.4 Qué congela el snapshot de `cobros` (al pasar a `cerrado`)

- Total facturado del periodo (Σ `amount` de payments con `period = mes`)
- Total cobrado (Σ pagos `paid`/`approved` + abonos `amount_paid` de `partial`)
- Cartera / por cobrar (facturado − cobrado)
- Recargos por mora aplicados (Σ `late_fee_amount`)
- Conteos: # atletas facturados, # pagados, # en mora, # abonos parciales
- Desglose por método de pago y por equipo/plan (fase 2, en `breakdown` jsonb)

> El snapshot es **inmutable** una vez `cerrado`. Los reportes históricos leen el snapshot, no recalculan sobre `payments` vivos. Los pagos que entren **después** del cierre afectan el mes en que entran (caja), no mutan el snapshot cerrado.

---

## 4. Apertura de Mes + generación unificada (F0) — NUEVO

### 4.1 Objetivo

Reemplazar las 3 lógicas paralelas de §0.1 por **una sola fuente de verdad**: la RPC `open_month`. El cron y el botón manual pasan a ser dos disparadores del mismo código.

### 4.2 Reglas canónicas de generación (resuelven las incompatibilidades A vs B)

| Regla | Canónico | Justificación |
|---|---|---|
| **Dedup** | **Por mes calendario** (`period_year` + `period_month` por atleta). ⚠️ Requiere dos cosas que HOY no se cumplen: (a) que `open_month` **pobla** `period_year`/`period_month` en cada cobro (el cron actual no lo hace — H2), y (b) que exista índice único parcial **también para adultos** (`user_id`), no solo menores (H1). | Es la semántica del negocio ("una cuota por atleta por mes"). El índice `uniq_payment_active_period_per_child` solo la garantiza para menores CON period poblado; F0 cierra ambos huecos. El dedup por `due_date >= hoy` del botón es el que permite duplicados. |
| **Prorrateo** | **`open_month` NUNCA prorratea** — siempre cuota completa. `calcFirstPayment` queda confinado al **primer cobro de un enrollment nuevo** (flujo inscripción/checkout/QR, alta a mitad de mes) | El prorrateo pertenece al alta, no a la recurrencia. Esto disuelve la contradicción A-vs-B sin config nueva: si el atleta ya tiene el cobro prorrateado de su alta ese mes, el dedup por mes calendario impide que `open_month` le genere otro. |
| **`payment_type`** | **`subscription`** para todo cobro generado por `open_month` (es la recurrencia mensual, semánticamente correcto) | ⚠️ Verificar en el plan de F0 los consumidores actuales de `payment_type` (reportes, filtros, autopay MP) antes de fijarlo — los históricos quedan con sus valores mixtos, no se migran. Si algún consumidor depende de `one_time`, documentar el mapeo. |
| **Monto** | Jerarquía existente del cron: `enrollment.monthly_fee` > plan > equipo > hijo | Ya probada en producción vía A. |
| **`due_date`** | `payment_cutoff_day` del mes que se abre | Igual que el cron hoy. |
| **Elegibilidad** | Inscripción activa; omite no-registrados (igual que A) | |
| **Concurrencia** | `SECURITY DEFINER` + advisory lock por `(school_id, period)` o `FOR UPDATE` sobre enrollments del periodo; **idempotente** (segunda llamada = no-op, retorna resumen de lo ya generado) | Elimina la vulnerabilidad de doble-clic del botón. |

### 4.3 La RPC

```
open_month(school_id, year, month, branch_id default NULL) → jsonb
  1. Crea (o encuentra) la fila monthly_closes (scope='cobros', status='abierto') del periodo
  2. Toma advisory lock por (school_id, year, month)
  3. Genera cuotas para todos los enrollments elegibles SIN cobro activo en el periodo
     (dedup por mes calendario; el índice único es la red de seguridad final)
  4. Retorna resumen: {generados: N, omitidos_dedup: M, omitidos_no_registrados: K, total: $X}
Idempotente: si se llama dos veces, la segunda genera 0 y retorna el resumen.

preview_open_month(school_id, year, month) → jsonb   -- STABLE, sin persistir
  Lo que generaría: lista de atletas + montos (reemplaza el loadPreview client-side del botón)
```

### 4.4 Migración de las 3 vías

| Vía actual | Pasa a |
|---|---|
| Cron `generate_monthly_charges()` | Llama `open_month` por cada escuela con `auto_generate_payments=true`. La función vieja queda como wrapper deprecado o se reemplaza en la misma migración. |
| Botón manual (Gestión de Pagos) | UI llama `preview_open_month` → muestra preview → `open_month`. **Se elimina el `.insert()` client-side y `calcFirstPayment` de esta pantalla.** |
| Lista Recordatorios (C) | Sin cambios (read-only, ya usa RPC). Opcional: CTA "Generar faltantes" que llame `open_month`. |
| Checkout/QR (primer cobro) | Sin cambios — conserva `calcFirstPayment` (es su lugar legítimo). |

### 4.5 Tests de F0 (obligatorios)

1. Doble-clic / doble llamada concurrente a `open_month` → 0 duplicados (advisory lock + índice único).
2. `open_month` corriendo mientras el checkout/QR crea el primer cobro del mismo atleta → un solo cobro activo del periodo (gana el primero; el otro dedup).
3. Cron y botón el mismo día → segunda vía genera 0.
4. Atleta con cobro prorrateado de alta a mitad de mes → `open_month` NO le genera cuota completa adicional ese mes.
5. Idempotencia: resumen correcto en llamadas repetidas.

---

## 5. Tratamiento de los pendientes — RESUELTO: carryover (D2)

**Política v1: Arrastre a cartera.** El pago sigue **abierto** con su `due_date` original y se marca como "deuda de mes anterior". El mes se cierra igual.

Por qué se descartan las otras dos (registro de la decisión):

| Opción | Por qué NO |
|---|---|
| Cancelación al cierre | Regala la deuda — el padre "se salva" de pagar. Contradice el negocio directamente. |
| Re-emisión al mes siguiente | Resetea la mora acumulada (u obliga a lógica especial para migrarla) y choca con `uniq_payment_active_period_per_child`: el cobro re-emitido no tiene un periodo limpio que asignar. Reescribe la historia del periodo. |

La política queda como **config por escuela** (`month_close_pending_policy`, default `'carryover'`); en v1 la UI **no** expone las otras opciones.

**Regla dura:** el cierre **nunca** toca dinero ya recibido ni aprueba/rechaza cobros por sí solo. Solo consolida y etiqueta pendientes.

**Interacción con la mora:** `apply_late_fees()` sigue corriendo sobre los pendientes arrastrados sin cambios (opera por `due_date`).

**Marcado del pago arrastrado:** columna `payments.carried_over_from` (smallint `period_year*100+period_month`, NULL si no aplica) — indexable y consultable para el badge "deuda de mes anterior". A confirmar en el plan de F1.

---

## 6. Dónde se coloca en la app

1. **Tab nuevo "Cierre" en Gestión de Pagos** (`/payments-automation`), junto a Cobros/Equipos/Historial/Config.
   - **V1 (solo cobros):** selector de mes → tarjetas de totales (facturado / cobrado / cartera / mora) → tabla de pendientes del mes → botón **"Cerrar mes"** con confirmación que explica textualmente el carryover → historial de cierres anteriores.
   - **Generación (F0):** el botón "Generar cobros" existente se re-cablea a `preview_open_month` + `open_month` — misma UX de preview→confirmar, nueva tubería.
   - **V2+ (F5–F6):** el tab se vuelve **checklist del mes**: tarjetas Cobros ✓ / Gastos ✓ / Nómina ⏳ + botón "Cerrar mes (consolidado)" con el Estado de Resultados a congelar.
2. **Tarjeta resumen en el Dashboard**: "Mes actual: $X cobrado de $Y · Z pendientes" + CTA "Ver cierre". Con borrador `en_revision`: "Tu cierre de [mes] está listo para revisar".
3. **Integración con Módulo Contable** ([[project_accounting_module]]): en v1 solo lectura (D7). El snapshot guarda lo necesario para asientos retroactivos.

> Reutilizar el patrón de tablas paginadas (`usePagedRpc` + `Pager`, ver [[project_frontend_tables_audit]]) — paginación server-side desde el inicio.

---

## 7. Modelo de datos (a validar en el plan)

```sql
-- Un cierre por escuela (y sede opcional) por periodo y por dominio (scope).
CREATE TABLE public.monthly_closes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  branch_id     uuid REFERENCES public.school_branches(id), -- NULL = toda la escuela (v1 siempre NULL)
  period_year   smallint NOT NULL CHECK (period_year BETWEEN 2020 AND 2100),
  period_month  smallint NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  scope         text NOT NULL DEFAULT 'cobros'
                CHECK (scope IN ('cobros','gastos','nomina','consolidado')),
  status        text NOT NULL DEFAULT 'abierto'
                CHECK (status IN ('abierto','en_revision','cerrado','reabierto')),
  -- Apertura (F0)
  opened_by     uuid REFERENCES public.profiles(id),        -- NULL si la fila la creó el backfill del cierre
  opened_at     timestamptz,
  generation_summary jsonb,                                 -- resumen retornado por open_month
  -- Snapshot congelado (se llena al cerrar). Nombres neutros para los 4 scopes:
  total_expected    numeric NOT NULL DEFAULT 0,  -- cobros: facturado · gastos: devengado · nomina: devengado
  total_settled     numeric NOT NULL DEFAULT 0,  -- cobros: cobrado  · gastos: pagado    · nomina: pagado
  total_open        numeric NOT NULL DEFAULT 0,  -- cobros: cartera  · gastos: por pagar · nomina: pasivo laboral
  total_late_fees   numeric NOT NULL DEFAULT 0,  -- solo cobros; 0 en los demás
  count_expected    integer NOT NULL DEFAULT 0,
  count_settled     integer NOT NULL DEFAULT 0,
  count_open        integer NOT NULL DEFAULT 0,
  breakdown         jsonb NOT NULL DEFAULT '{}', -- por método/equipo/plan (cobros), por categoría (gastos);
                                                 -- consolidado: ids de sub-cierres + resultado del mes
  pending_policy    text,                        -- política aplicada a pendientes (solo scope=cobros)
  -- Versionado (D6): al re-cerrar tras reapertura, el snapshot anterior se archiva, nunca se pisa.
  snapshot_history  jsonb NOT NULL DEFAULT '[]', -- [{closed_at, closed_by, totals..., reason_reopened}]
  closed_by         uuid REFERENCES public.profiles(id),
  closed_at         timestamptz,
  reopened_by       uuid REFERENCES public.profiles(id),
  reopened_at       timestamptz,
  reopen_reason     text,                        -- obligatorio al reabrir (validado en la RPC)
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, branch_id, period_year, period_month, scope)
);

-- Marcado del pago arrastrado desde un mes cerrado (badge "deuda de mes anterior")
ALTER TABLE public.payments
  ADD COLUMN carried_over_from smallint;  -- period_year*100+period_month del cierre que lo arrastró; NULL = no aplica

-- H1 — Red de DB para ADULTOS/no-registrados (el índice existente solo cubre menores).
-- Bloquea duplicado activo del mismo periodo para pagos sin child_id.
CREATE UNIQUE INDEX uniq_payment_active_period_per_adult
  ON public.payments (user_id, period_year, period_month)
  WHERE child_id IS NULL AND user_id IS NOT NULL
    AND period_year IS NOT NULL AND period_month IS NOT NULL
    AND status IN ('pending','awaiting_approval','paid','approved','partial');
-- (equivalente para unregistered_athlete_id si aplica; validar cardinalidad en el plan de F0)

-- H2 — open_month DEBE poblar period_year/period_month en cada cobro que inserta
-- (el cron actual no lo hace → el dedup por periodo no aplicaba). Decidir en el
-- plan de F0 si se hace backfill de cobros históricos con period NULL derivándolo
-- de due_date (heurística ya usada en 20260503000004, solo para 'mensual').

-- Config de escuela (nuevas columnas en school_settings — NO en el JSONB legacy)
ALTER TABLE public.school_settings
  ADD COLUMN month_close_mode           text NOT NULL DEFAULT 'hybrid',     -- 'manual' | 'hybrid' | 'auto' (auto reservado)
  ADD COLUMN month_close_pending_policy text NOT NULL DEFAULT 'carryover',  -- 'carryover'|'cancel'|'reissue' (solo carryover en v1)
  ADD COLUMN month_close_draft_day      smallint NOT NULL DEFAULT 5
                CHECK (month_close_draft_day BETWEEN 1 AND 28);             -- día del mes siguiente del borrador
```

Notas:
- `scope` y `branch_id` entran **desde la migración inicial** aunque v1 solo use `cobros`/NULL — evita migrar el UNIQUE después.
- **`branch_id` referencia `public.school_branches(id)`** (la tabla de sedes real; `public.branches` no existe — corrección verificada contra el schema).
- ⚠️ El `UNIQUE (school_id, branch_id, ...)` **no** bloquea dos filas escuela-wide del mismo periodo/scope, porque en Postgres `NULL` no colisiona con `NULL`. Resolver en el plan de F1 con un índice único parcial `WHERE branch_id IS NULL` sobre `(school_id, period_year, period_month, scope)` **+** el UNIQUE normal para cuando haya sede.
- `opened_by/at` + `generation_summary` registran el acto de apertura (F0). NULL en filas creadas por backfill del cierre (meses históricos, D13).
- `snapshot_history` implementa el versionado de D6.
- Nombres neutros `total_expected/settled/open` documentados con `COMMENT ON COLUMN`.

---

## 8. Backend (RPCs `SECURITY DEFINER` — patrón del repo)

Todas con `SET search_path = pg_catalog, public, pg_temp` y `GRANT EXECUTE` explícito. Gate de escritura vía `is_super_admin() OR is_school_admin(school_id)` (helpers verificados; sedes en `school_members`).

**Apertura (F0):**
- `preview_open_month(school_id, year, month)` → jsonb con lo que se generaría, sin persistir. `STABLE`.
- `open_month(school_id, year, month, branch_id default NULL)` → crea/encuentra la fila `abierto`, advisory lock por `(school_id, periodo)`, genera cuotas con las reglas canónicas de §4.2, retorna resumen. **Idempotente.**

**Cierre (F1):**
- `preview_month_close(school_id, year, month, scope default 'cobros', branch_id default NULL)` → totales calculados sin persistir. `STABLE`.
- `close_month(school_id, year, month, scope default 'cobros', branch_id default NULL)` → congela snapshot y aplica `pending_policy` en transacción con `SELECT … FOR UPDATE` sobre los payments del periodo. Si la fila del periodo no existe (mes histórico sin apertura), **la crea** (D13). **Idempotente:** si ya está `cerrado`, no-op.
- `reopen_month(close_id, reason)` → exige `reason`; archiva snapshot en `snapshot_history`; pasa a `reabierto`; auditoría. Solo admin/super_admin.
- `close_month_consolidated(school_id, year, month)` *(F6)* → valida sub-cierres, congela Estado de Resultados, marca módulos sin uso como `sin_registro`.

**Crons:**
- **Cron 01:30 (F0):** reemplaza/wrapea `generate_monthly_charges()` → llama `open_month` por escuela con `auto_generate_payments=true`. Manejo de error por escuela (una falla no aborta el batch).
- **Cron de borradores (F1):** el día `month_close_draft_day`, genera el registro `en_revision` con preview y notifica al admin. NO cierra.

**Concurrencia — tests obligatorios:**
- F0: los 5 tests de §4.5.
- F1: (1) cerrar mientras entra webhook MP → foto consistente, nunca mitad y mitad; (2) cerrar mientras corre `apply_late_fees()`; (3) doble llamada a `close_month` → idempotente; (4) pago posterior al cierre → snapshot NO muta, pago computa en caja del mes en que entró.

---

## 9. BFF / API

**Apertura (F0):**
- `GET  /api/v1/months/:year/:month/open/preview` → `preview_open_month`.
- `POST /api/v1/months/:year/:month/open` → `open_month`.

**Cierre (F1+):**
- `GET  /api/v1/months/:year/:month/close/preview?scope=cobros` → `preview_month_close`.
- `POST /api/v1/months/:year/:month/close` (body: `{scope}`) → `close_month`.
- `POST /api/v1/months/close/:id/reopen` (body: `{reason}`) → `reopen_month`.
- `POST /api/v1/months/:year/:month/close/consolidated` *(F6)* → `close_month_consolidated`.
- `GET  /api/v1/months/closes?scope=&page=` → historial paginado.

(Alineado con el estilo REST del BFF: `/api/v1/...`.)

---

## 10. Auditoría y versionado

- Todo `open`/`close`/`reopen` va a `admin_activity_logs` (o `audit_trigger_func()` sobre `monthly_closes`): quién, cuándo, periodo, scope, política/resumen, totales.
- La reapertura **siempre** exige `reason` (validado en la RPC, no solo en UI).
- **Versionado (D6):** el snapshot cerrado nunca se sobreescribe en silencio; al re-cerrar, el anterior queda en `snapshot_history` con su `closed_at/by` original y el `reason` de la reapertura. La UI del historial muestra "cerrado 2 veces" con acceso a ambas fotos.

---

## 11. Fases de entrega

| Fase | Alcance | Entregable |
|---|---|---|
| **F0 — Generación unificada** ⚠️ *bug activo* | RPC `open_month` + `preview_open_month`, reglas canónicas §4.2, **poblado de `period_year`/`period_month` (H2)** + **índice único para adultos (H1)**, re-cableo del cron y del botón (fin del insert client-side), inventario de consumidores de `payment_type` (D14), tests §4.5. **Desacoplada del cierre — puede shippear sola.** | Migración + refactor UI botón + plan aprobado |
| **F1 — Backend cierre (cobros)** | Tabla `monthly_closes` (con `scope`, `branch_id`, campos de apertura desde el día 1), config, `carried_over_from`, RPCs `preview`/`close`/`reopen`, cron de borradores, RLS línea por línea, auditoría + versionado, tests de concurrencia | Migraciones + plan aprobado antes de código |
| **F2 — UI Cierre (cobros)** | Tab "Cierre": preview, tabla de pendientes paginada, botón cerrar con confirmación de carryover, historial con versiones | Frontend + BFF endpoints |
| **F3 — Dashboard** | Tarjeta resumen + notificación de borrador listo | Wiring cross-módulo |
| **F4 — Auto-cierre (opcional, pospuesto)** | Modo `auto` sobre la infraestructura del híbrido | Toggle + pg_cron |
| **F5 — Sub-cierres Gastos y Nómina** | `scope='gastos'` y `scope='nomina'`; checklist en el tab | RPCs + UI por scope |
| **F6 — Cierre Consolidado** | `close_month_consolidated`: Estado de Resultados (base de caja) congelado; integración lectura con Contable | RPC + UI + tarjeta E.R. |

> **Orden sugerido:** F0 primero o en paralelo a F1 — arregla un bug de producción hoy. Nota: F1 crea la tabla `monthly_closes` que F0 usa para la fila `abierto`; si F0 va primero, su migración incluye la tabla (y F1 solo agrega lo que falte).

---

## 12. DECISIONES — RESUELTAS

| # | Pregunta | Decisión | Justificación |
|---|---|---|---|
| D1 | ¿Disparo del cierre? | **Híbrido** (borrador auto + confirmación) | Manual puro → escuelas se olvidan, sin snapshots. Auto puro → política sobre pendientes sin ojo humano. Híbrido notifica día N; "auto total" (F4) es un toggle futuro sobre la misma infra. |
| D2 | ¿Pendientes al cerrar? | **Carryover** (arrastre a cartera) | Única opción que no destruye información: cancelar regala la deuda; re-emitir resetea mora y choca con `uniq_payment_active_period_per_child`. Config por escuela; solo carryover expuesto en v1. |
| D3 | ¿Bloquea el mes siguiente? | **Soft-close** | Bloqueante convierte un olvido en una escuela que no opera. La disciplina la aporta el híbrido. |
| D4 | ¿Alcance del snapshot? | **Mensualidades + inscripciones** | Lo que la escuela cobra **directo a familias** (misma tabla `payments`). Tienda/eventos tienen su propio ledger — entran vía consolidado F6. |
| D5 | ¿Multi-sede? | **Por escuela en v1**; sede = filtro | Por sede multiplica cierres y expone `branch_id` histórico no confiable → fotos incorrectas. Reservado en schema desde el día 1. |
| D6 | ¿Reapertura? | **Admin + motivo obligatorio + auditoría + versionado** | Va a pasar (pago en efectivo tardío). `reason` en RPC, log, snapshot anterior archivado — nunca se pisa en silencio. |
| D7 | ¿Asientos contables? | **Solo lectura en v1** | Contable aún se define; el snapshot es autosuficiente para asientos retroactivos. |
| D8 | ¿Día del auto-borrador? | **Día 5, configurable** (`month_close_draft_day`) | Margen para webhooks MP/OCR/transferencias tardías. |
| D9 | ¿Nombre en UI? | **"Cierre de Mes"** | Término natural del dueño; "Cierre de Cobros" queda corto con F5. |
| D10 | ¿Caja o devengado? | **Caja en v1** | El dueño entiende "entró X, salió Y"; devengado exige disciplina que no existe y daría E.R. falsos. |
| D11 | ¿Consolidado obligatorio? | **Opcional; sub-cierres independientes** | Escuela sin Nómina no queda bloqueada; consolidado marca `sin_registro`. |
| D12 | ¿Unificar la generación de cuotas? | **Sí — RPC única `open_month` (F0)** | Las 3 vías actuales tienen dedup/prorrateo/`payment_type`/concurrencia incompatibles → duplicados y montos inconsistentes HOY. El cron y el botón pasan a ser disparadores del mismo código. Es bug fix, no solo diseño. |
| D13 | ¿El cierre depende de la apertura? | **No — desacople total** | Si `close_month` exigiera apertura formal, ningún mes histórico sería cerrable y se acoplan dos entregas independientes. El cierre crea la fila del periodo si no existe (backfill con `opened_by` NULL). |
| D14 | ¿Prorrateo y `payment_type` canónicos? | **`open_month` nunca prorratea (cuota completa siempre); prorrateo confinado al primer cobro del enrollment (checkout/QR). `payment_type='subscription'` para lo generado por `open_month`** | El prorrateo pertenece al alta, no a la recurrencia — esto disuelve la contradicción cron-vs-botón sin config nueva. ⚠️ Verificar consumidores de `payment_type` en el plan de F0; históricos no se migran. |

---

## 13. Fuera de alcance (v1)

- Cierre del marketplace / tienda / eventos (propio ledger; se integran en F6 vía consolidado).
- Sub-cierres de Gastos y Nómina (diseñados aquí, implementados en F5).
- Reportes fiscales / facturación electrónica (ver [[project_electronic_invoicing]]).
- Conciliación bancaria automática.
- Cierre a nivel de organización multi-escuela.
- Base devengada / asientos contables (esperan a Contable maduro — D7, D10).
- Migración de `payment_type` en registros históricos (quedan mixtos; solo se normaliza hacia adelante — D14).

---

## 14. Riesgos

- **Carrera con pagos entrantes** al cerrar (webhook MP / OCR) → `FOR UPDATE` + snapshot inmutable + tests de §8.
- **Carrera en la generación** (doble-clic, cron+botón mismo día, checkout simultáneo) → advisory lock + dedup por mes calendario + índice único como red final + tests §4.5.
- **H1 — Adultos sin red de DB:** el índice único existente solo cubre menores. Sin el `uniq_payment_active_period_per_adult` nuevo (§7), un duplicado de cobro de adulto solo lo frena el advisory lock → agregarlo en F0 y cubrirlo en los tests §4.5.
- **H2 — Dedup por periodo inerte hasta poblar `period_*`:** el cron actual no escribe `period_year`/`period_month`, así que el índice único parcial nunca protegió sus cobros. `open_month` debe poblarlos siempre; decidir backfill de históricos con period NULL (derivable de `due_date`, solo mensualidades).
- **H3 — Caja vs. periodo divergen:** un pago que entra tras el cierre mantiene su `period_month` original pero cuenta en la caja del mes en que entra → el total-por-periodo de julio queda subvaluado y agosto-caja incluye plata de julio. Es cash-basis correcto; declarar explícitamente cuál criterio manda en cada reporte (snapshot congelado vs. recálculo por periodo) para no confundir la conciliación.
- **Cambio de comportamiento del botón manual (F0):** hoy prorratea; con `open_month` generará cuota completa. Escuelas acostumbradas al prorrateo desde ese botón notarán la diferencia → comunicar el cambio y verificar que el caso real de prorrateo (altas a mitad de mes) siga cubierto por el flujo de inscripción.
- **Consumidores de `payment_type`** (reportes, filtros, autopay MP) pueden asumir `one_time` para cuotas del cron → inventario de consumidores en el plan de F0 antes de fijar `subscription` (D14).
- **Confusión con la política de pendientes** → la confirmación de la UI explica textualmente el carryover.
- **Doble store de config** (`school_settings` vs `schools.payment_settings` JSONB legacy, ver [[project_payment_config_wiring]]) → columnas nuevas solo en `school_settings`.
- **Fetch-all sin límite** en la página actual ([[project_frontend_tables_audit]]) → paginación server-side desde el inicio.
- **Nombres neutros del snapshot** → `COMMENT ON COLUMN` por scope.
- **Cron por escuela** → manejo de error individual; una escuela que falla no aborta el batch.