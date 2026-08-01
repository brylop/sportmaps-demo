# Plan F0 — Inscripciones y cobros duplicados

> ⚠️ **Superseded como plan de ejecución (2026-08-01).** El plan vigente es
> [`plan-f0-generacion-de-mes-y-cobros-duplicados.md`](plan-f0-generacion-de-mes-y-cobros-duplicados.md),
> que consolida este documento con la §4 y los hallazgos H1/H2/H3 del
> [spec del ciclo de mes](specs/month-close-module.md).
>
> **Este documento sigue siendo la evidencia**: su §2 (preflight) y su §7 (mediciones del 31-jul,
> desglose de los 98 atletas, inventario por escuela) son la base del plan consolidado y no se
> duplican allí.
>
> **Dos correcciones que el plan consolidado resuelve:** (a) el §7.3 diagnostica que el cron no
> puebla `period_*` citando la migración `20260713000003`, que fue reemplazada el 24-jul por
> `20260724000003` — el cron ya delega en `open_month`; (b) el desempate del `DISTINCT ON` de §3.1
> incluye `fee.amount DESC`, que contradice el punto 4 de §3.3 y reintroduciría el sobrecobro que
> ese punto corrigió.

**Producto:** SportMaps · **Fecha:** 2026-07-31 · **Rama:** `develop`
**Estado:** 🟡 plan propuesto — **pendiente de aprobación antes de escribir migraciones** (convención del repo)
**Origen:** [`docs/specs/sport-categories-and-multi-category.md` §0.3 y §13-F0](specs/sport-categories-and-multi-category.md)

F0 no depende de nada del spec de categorías y arregla un **bug activo que cobra de más**. Se entrega solo, antes de tocar el catálogo de categorías.

---

## 1. Los cuatro defectos, por separado

| # | Defecto | Severidad | Estado |
|---|---|---|---|
| **A** | `POST /enrollments` con solo `team_id` inserta una **segunda inscripción activa** | 🔴 cobra de más | Abierto |
| **B** | `open_month`: el `NOT EXISTS` no ve las filas que inserta su propia sentencia → **N inscripciones = N cobros** del mismo mes | 🔴 cobra de más | Abierto |
| **C** | Red de DB de `payments` (índices únicos por periodo) | 🟢 | **Ya escrita** en [`20260724000001`](../supabase/migrations/20260724000001_payment_period_dedup_indexes.sql) — falta **verificar aplicación** + 2 huecos residuales |
| **D** | Atletas que **ya** tienen 2+ inscripciones activas | 🟠 dato sucio en producción | Abierto, sin criterio definido |

### A — El guard que no cubre el caso

[`bff/src/routes/enrollments.ts:149-168`](../bff/src/routes/enrollments.ts#L149-L168). Atleta con inscripción `{team: A, plan: P}`, llega `POST {team_id: B}`:

- `mergeTarget` — la condición exige `(!data.team_id || !row.team_id || row.team_id === data.team_id)`; con `data.team_id = B` y `row.team_id = A` las tres son falsas ⇒ no hay merge.
- `replaceTarget` — exige `data.offering_plan_id`, que no viene ⇒ null.
- `uq_enrollment_child_team` es `(child_id, team_id) WHERE status='active'` ⇒ equipo distinto, no colisiona.
- ⇒ **`INSERT`**. Dos inscripciones activas.

Los guards de arriba ([líneas 79-112](../bff/src/routes/enrollments.ts#L79-L112)) solo preguntan *"¿ya está en ESTE equipo?"* y *"¿ya está en ESTE plan?"* — nunca *"¿ya tiene una inscripción?"*.

### B — La ventana intra-sentencia

[`open_month`](../supabase/migrations/20260724000002_open_month_rpc.sql#L109-L125) es un `INSERT … SELECT` con un `NOT EXISTS` sobre `payments`. Las subconsultas de una sentencia ven el snapshot **anterior** a la sentencia: las filas que el propio `INSERT` va produciendo son invisibles para el `NOT EXISTS`. Con dos inscripciones activas del mismo atleta, ambas pasan el filtro y ambas insertan.

Hoy lo frena — parcialmente — el índice único de C: la segunda fila revienta con `23505` y **aborta el `open_month` completo**. Es decir, el síntoma visible no es "dos cobros" sino "la apertura de mes falla entera", que es mejor pero sigue siendo un incidente.

### C — La red de DB: qué hay y qué falta

[`20260724000001`](../supabase/migrations/20260724000001_payment_period_dedup_indexes.sql) ya crea los tres índices y **además** corrigió un hueco de estados: el índice original excluía `overdue` y `glosado`, así que un cobro salía de la protección justo al entrar en mora (`apply_late_fees`). El conjunto canónico quedó `pending, awaiting_approval, paid, partial, overdue, glosado`.

Huecos residuales:

| Hueco | Por qué | Alcance real |
|---|---|---|
| Adultos legacy en `parent_id` | El índice de adultos exige `user_id IS NOT NULL`; hay cobros históricos con el adulto en `parent_id` y `user_id NULL`. El `NOT EXISTS` de `open_month` **sí** los mira ([línea 116](../supabase/migrations/20260724000002_open_month_rpc.sql#L116)), el índice no | Solo bajo concurrencia real. Medir cuántas filas así existen antes de decidir si vale un índice más |
| `period_year/month NULL` | Los tres índices son parciales sobre periodo poblado. `open_month` siempre lo puebla; QR y checkout no necesariamente | Un `open_month` concurrente con un cobro sin periodo no tiene backstop |

**Ninguno de los dos se arregla a ciegas.** Paso 1 del plan es contarlos.

### D — Los duplicados que ya existen

Sin criterio de merge, el reporte es una lista sin acción.

---

## 2. Preflight — medir antes de tocar

Se corre en el SQL Editor **como dueño de la escuela**, no como `postgres`. Sin `CREATE TEMP TABLE` ni `RAISE NOTICE` — el pooler pierde la temp entre sentencias y el notice no se ve ([[project_supabase_sql_editor_gotchas]]).

```sql
-- P1. ¿Está aplicada 20260724000001? (esperado: 3 filas)
SELECT indexname FROM pg_indexes
 WHERE tablename = 'payments'
   AND indexname LIKE 'uniq_payment_active_period_per_%';

-- P2. Atletas con más de una inscripción activa (defecto D)
SELECT school_id,
       COALESCE(child_id::text, user_id::text, unregistered_athlete_id::text) AS atleta,
       count(*) AS activas,
       count(*) FILTER (WHERE offering_plan_id IS NOT NULL) AS con_plan,
       count(DISTINCT team_id) FILTER (WHERE team_id IS NOT NULL) AS equipos
  FROM public.enrollments
 WHERE status = 'active'
 GROUP BY 1, 2 HAVING count(*) > 1
 ORDER BY activas DESC;

-- P3. ¿Alguno ya generó cobros duplicados este mes?
SELECT child_id, user_id, unregistered_athlete_id, period_year, period_month,
       count(*), sum(amount), array_agg(status)
  FROM public.payments
 WHERE period_year IS NOT NULL
 GROUP BY 1,2,3,4,5 HAVING count(*) > 1;

-- P4. Hueco 1 — cobros de adulto legacy sin user_id
SELECT count(*) FROM public.payments
 WHERE child_id IS NULL AND user_id IS NULL AND parent_id IS NOT NULL;

-- P5. Hueco 2 — cobros activos sin periodo poblado
SELECT count(*) FROM public.payments
 WHERE period_year IS NULL
   AND status IN ('pending','awaiting_approval','paid','partial','overdue','glosado');
```

**Puertas de decisión:**
- P1 devuelve <3 → aplicar `20260724000001` **primero** (su propio preflight aborta si hay duplicados; entonces limpiar con P3 antes).
- P4 = 0 → el hueco de adultos legacy es teórico, no se agrega índice.
- P5 alto → decidir si se backfillea `period_*` o si se acepta que esas filas queden fuera de la red (documentarlo, no dejarlo implícito).

---

## 3. Los cambios

### 3.1 Migración — `open_month` y `preview_open_month` idempotentes por atleta

`npm run migrations:new -- open-month-distinct-athlete`

Se interpone un `DISTINCT ON` sobre el sujeto **antes** del `INSERT`, con desempate determinista:

```sql
WITH elegibles AS (
  SELECT DISTINCT ON (COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id))
         e.*, fee.amount
    FROM public.enrollments e
    …
   WHERE e.school_id = p_school_id AND e.status = 'active' AND fee.amount > 0 …
   ORDER BY COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id),
            (e.offering_plan_id IS NOT NULL) DESC,   -- gana la que tiene plan
            fee.amount DESC,                          -- luego el monto mayor
            e.created_at                              -- luego la más antigua
)
INSERT INTO public.payments (…) SELECT … FROM elegibles WHERE NOT EXISTS (…)
```

**El desempate es el mismo criterio de merge de 3.3** — deliberadamente. Si un duplicado se cuela entre el merge y la apertura del mes, el cobro sale por el mismo monto que habría salido después de fusionar.

`preview_open_month` lleva el **mismo** `DISTINCT ON`, o el preview mentiría respecto de lo que genera.

Cambios de contrato: ninguno. Firma, retorno y `GRANT` intactos. `SET search_path = pg_catalog, public, pg_temp` (ya lo tiene).

### 3.2 BFF — el guard que faltaba

[`bff/src/routes/enrollments.ts`](../bff/src/routes/enrollments.ts), tras calcular `mergeTarget` y `replaceTarget`:

```ts
// Una sola inscripción activa por atleta por escuela. Si hay una activa y esto
// no es merge ni replace, es un intento de abrir una segunda: se rechaza.
if (!mergeTarget && !replaceTarget && (activeEnrollments?.length ?? 0) > 0) {
    return res.status(409).json({
        error: 'El atleta ya tiene una inscripción activa en esta escuela.',
        details: 'Para cambiar de equipo, edita la inscripción existente.',
        enrollment_id: activeEnrollments![0].id,
    });
}
```

Va **después** de merge/replace para no romper esos dos flujos. Devuelve el `enrollment_id` existente para que la UI pueda ofrecer "editar la inscripción" en vez de dejar al admin en un callejón.

> Cuando llegue F3, este `409` se relaja: el segundo `team_id` pasará a crear una fila en `enrollment_categories`. Hasta entonces, cerrado.

**Auditar también** las otras vías que insertan en `enrollments` (RPCs de QR, `accept_invitation_pro`, checkout) — `accept_invitation_pro` ya está cubierta por [`20260730000000`](../supabase/migrations/20260730000000_enrollment_no_split_rows.sql#L166-L207); las de QR hay que revisarlas una por una en este mismo paso.

### 3.3 Migración — merge de los duplicados existentes

`npm run migrations:new -- merge-remaining-split-enrollments`

**Criterio** (corregido tras el preflight del 2026-07-31 — ver §7):

0. **La fila huérfana (sin `team_id` ni `offering_plan_id`) se cancela siempre.** No referencia nada; su monto venía de `children.monthly_fee`, que sigue existiendo en el hijo aunque la inscripción se cancele. Es el 33 % de los casos y el único grupo mecánico.
1. **Sobrevive la que tiene plan.** El plan es lo que gobierna el cobro.
2. Si ninguna o ambas tienen plan → **la más antigua** (`created_at`): carga el historial de pagos, asistencia y carnets.
3. La superviviente **absorbe** el `team_id` y el `offering_plan_id` que le falten.
4. **Cuota: sale de la fuente propia de la fila que sobrevive** (precio de su plan, o `price_monthly` de su equipo). **NO** el máximo entre filas.
   > La versión anterior de este plan decía "gana el monto más alto". El preflight lo desmintió: Victoria Ávila (Dynasty) tiene una huérfana de $180.000 y un PLAN PRO de $150.000 — el máximo le cobraría $30.000 de más cada mes. El monto alto era **dato rancio**, no una cuota mayor. Un `monthly_fee` explícito en la fila superviviente sí se respeta (es override deliberado); el de las descartadas se descarta con ellas.
5. La descartada pasa a `cancelled` con `end_date = CURRENT_DATE`, **conservando** su `offering_plan_id` como registro de lo que pasó.
6. `sessions_used` / `secondary_sessions_used` → el `GREATEST` de ambas.
7. **Solo los grupos 🔴 (huérfana) y 🔵 (split equipo+plan sin ambigüedad de monto) se automatizan.** Dos equipos distintos, dos planes distintos, o un paquete multi-mes conviviendo con una mensualidad (caso `GOLD 3 MESES $550.000` + `GRAPPLING MMA $180.000` en MMA Blair) **no se fusionan por script**: van a revisión con la escuela.

**Orden obligatorio dentro de cada par:** cancelar la descartada **primero**, mover el plan **después**. Los índices únicos son parciales `WHERE status='active'`; al revés revienta con `23505` — es exactamente la trampa que ya documentó [`20260730000000` §4](../supabase/migrations/20260730000000_enrollment_no_split_rows.sql#L328-L338).

**Diferencia con aquella migración:** la de julio 30 solo cubría el par limpio *equipo-solo + plan-solo* con exactamente dos filas activas. Esta cubre **cualquier** combinación y cualquier cantidad (dos equipos distintos, tres filas, etc.).

**Cobros ya emitidos:** no se tocan. Si el atleta tiene dos cobros del mismo periodo por el duplicado, se listan en el reporte para que la escuela decida — es plata y puede haber uno ya pagado. [[feedback_user_handles_deletions]]: el usuario ejecuta y decide las anulaciones, el plan no las hace por su cuenta.

### 3.4 Índices residuales — solo si el preflight los justifica

- P4 > 0 → cuarto índice único parcial para adultos legacy (`child_id IS NULL AND user_id IS NULL AND parent_id IS NOT NULL`).
- P5 > 0 → decidir entre backfillear `period_*` o documentar la exclusión.

No se escriben "por si acaso": un índice único sobre datos sucios falla en el `CREATE` y bloquea el despliegue.

---

## 4. Tests

**Concurrencia** (`bff/tests/`, patrón de los tests existentes):

| # | Escenario | Esperado |
|---|---|---|
| 1 | Dos `open_month` simultáneos, misma escuela — **menor** | 1 cobro, la 2ª llamada devuelve `generados: 0` |
| 2 | Ídem — **adulto** (`user_id`) | 1 cobro |
| 3 | Ídem — **no registrado** | 1 cobro |
| 4 | Atleta con 2 inscripciones activas (antes del merge) + `open_month` | 1 cobro, por el monto del criterio de desempate |
| 5 | `open_month` + creación de cobro por QR en paralelo, mismo atleta y mes | 1 cobro |
| 6 | Doble `POST /enrollments` con `team_id` distinto | 1ª `201`, 2ª `409` |
| 7 | `POST` que **sí** es merge (plan sobre inscripción con equipo) | Sigue funcionando: `200 merged` |
| 8 | `POST` que **sí** es replace (plan distinto) | Sigue funcionando: `200 replaced` |

Los casos 7 y 8 son los de regresión: el `409` nuevo se mete justo al lado de esa lógica y es donde más fácil se rompe algo que hoy funciona.

**Datos:** escuela de prueba propia, no Dynasty. La BD es compartida entre dev/stg/prod ([[project_shared_supabase_env]]).

---

## 5. Orden de ejecución

1. Preflight §2 → decidir P1/P4/P5.
2. Si P1 < 3: limpiar duplicados de P3 (**el usuario decide y ejecuta**) y aplicar `20260724000001`.
3. Migración 3.1 (`DISTINCT ON`) — sola, verificable con `preview_open_month` contra el mes en curso.
4. Guard del BFF 3.2 + tests 6/7/8.
5. Migración 3.3 (merge) en `dry_run` → revisar reporte con el usuario → ejecutar.
6. Tests de concurrencia 1-5.
7. Índices residuales 3.4, si aplican.
8. Actualizar [month-close-module.md](specs/month-close-module.md): H1 quedó cerrado por `20260724000001`, el texto todavía lo da por pendiente.

Pasos 3, 5 y 7 tocan la BD compartida: van con `dry_run`/preview y el usuario ejecuta las escrituras.

---

## 6. Riesgos

| Riesgo | Mitigación |
|---|---|
| El `DISTINCT ON` deja fuera a un atleta que **legítimamente** debería tener dos cobros | No existe hoy ese caso: una inscripción activa por atleta es la regla vigente en las 3 capas. Cuando F3 traiga multi-categoría, el precio va en **un** cobro, no en dos |
| El merge fusiona algo que no debía | Criterio explícito y determinista + `dry_run` + reporte revisado antes de escribir. Reversible: la descartada queda `cancelled`, no borrada |
| El `409` rompe un flujo vivo (QR, invitación, checkout) | Se audita cada vía que inserta en `enrollments` **antes** de mergear; tests 7 y 8 cubren merge y replace |
| `20260724000001` falla al aplicarse por duplicados históricos | Su preflight aborta con mensaje claro y no toca nada. Se limpia primero |
| Bajar una cuota en el merge | El criterio es explícito: la cuota sale de la fuente propia de la fila que sobrevive (§3.3) |

---

## 7. Resultado del preflight — 2026-07-31

SQL en [`scripts/f0_preflight.sql`](../scripts/f0_preflight.sql). Corrido contra la Supabase compartida.

### 7.1 Chequeos

| Chequeo | Resultado | Conclusión |
|---|---|---|
| P1 · índices únicos de `payments` | **3 de 3** | `20260724000001` **está aplicada**. Sale del alcance de F0 |
| P1b · índices únicos de `enrollments` | 4 de 4 | OK |
| P2 · atletas con >1 inscripción activa | **98 atletas / 198 filas** | 20× la estimación inicial |
| P3 · cobros duplicados **con periodo** | 0 | ✅ …pero ver 7.3: la medición estaba incompleta |
| P4 · adultos legacy en `parent_id` | 4 | No justifica un 4º índice |
| P5 · cobros activos **sin** `period_year` | **349** | Fuera de la red de índices |

### 7.2 Los 98, desglosados

De los 98, **21 tienen 2+ filas que cobran** (el resto cobra por una sola y el duplicado está latente). De esos 21:

- **14 son filas huérfanas** (sin equipo ni plan, monto heredado de `children.monthly_fee`). Origen identificado: el `UPDATE` de [`students.ts:820`](../bff/src/routes/students.ts#L820) pone `team_id = NULL` cuando se guarda un atleta sin equipo, y si la fila no tenía plan queda huérfana **conservando su cuota**. 10 se cancelan sin ambigüedad de plata.
- **Dynasty (2) está protegida**: su cobro de agosto ya existe con `period` poblado, así que el `NOT EXISTS` de `open_month` descarta sus tres inscripciones. No hay riesgo el 10 de agosto. Además la limpieza es **no-op visual**: `school_athletes` ya ignoraba la huérfana, así que la pantalla no cambia.
- El resto se reparte entre tenants de prueba y **GYM RM**, el único productivo afectado.

### 7.3 Hallazgo que P3 no vio

`generate_monthly_charges` **no pobla `period_year`/`period_month`** ([líneas 46-49](../supabase/migrations/20260713000003_auto_generate_monthly_charges.sql#L46-L49)) y los tres índices únicos son parciales `WHERE period_year IS NOT NULL`. Los cobros de esa vía **no chocan con el índice: duplican en silencio**. P3 filtraba por periodo poblado, así que los contó como cero.

Revisando los 349 sin periodo aparecen duplicados reales. **H2 del spec de cierre de mes sigue abierto y ahora tiene daño medido** → poblar `period_*` en el cron entra en F0.

> Nota de método: la query de duplicados agrupaba por `COALESCE(child_id, user_id, unregistered_athlete_id, parent_id)`. Cuando `child_id` es NULL, **los hermanos colapsan bajo el acudiente** y producen falsos positivos (caso NPC: 13 "cobros" que eran de dos niños distintos). Agrupar solo por el atleta y reportar aparte los cobros sin atleta identificable.

### 7.4 Inventario por escuela

| Escuela | Estado | Qué tiene |
|---|---|---|
| **GYM RM** | 🔴 **productiva, con daño** | ~15 atletas con **mora falsa** (pares `Membresía Mensual GYM RM` + `… (pendiente validación post-migración)`, uno pagado y otro en mora); **1 cobrado de más** (JUAN JOSE RAMIREZ, dos cobros pagados en julio); 1 doble cobro `pending` de agosto (David Rios); 1 con equipo y plan cobrados a la vez (ROBINSON); 5 con inscripciones duplicadas |
| **DYNASTY** | 🟢 sin riesgo | 3 huérfanas; agosto ya emitido; limpieza invisible para el usuario |
| **MONSTER'S VOLLEY** | ⚪ no afectada | Es quien pide el precio por categorías. **No tiene** atletas multi-inscritos: nada que backfillear |
| **ORIGINAL BOXING STYLE** | 🟡 real pero inactiva | Estuvo en periodo gratis y no se usó. 8 atletas con pares equipo+plan, todos en mora, ninguno pagado. Limpiar **antes** de que la activen, o arranca con cartera falsa |
| NPC · SOLO MILLOS · MMA BLAIR · ACADEMIA SUPERIOR | ⚪ pruebas | No requieren decisión de negocio |

### 7.5 Prioridad revisada

**No hay incendio.** Nada revienta el 10 de agosto. El daño real es cartera inflada en GYM RM y $70.000 cobrados de más a una persona. F0 pasa de "esta semana" a trabajo planificado, con este orden:

1. Cancelar las 10 huérfanas sin ambigüedad (bloque A+B).
2. GYM RM: reconciliar sus cuatro problemas con el gimnasio. Requiere que ellos confirmen la cuota real de DUVAN, NINI y ROBINSON ($130.000 vs $70.000).
3. Arreglar `students.ts:820` para que no se generen más huérfanas.
4. `CHECK (status <> 'active' OR team_id IS NOT NULL OR offering_plan_id IS NOT NULL)`.
5. Poblar `period_*` en `generate_monthly_charges` (7.3).
6. `DISTINCT ON` en `open_month` / `preview_open_month`.
7. Merge del resto, con el criterio de §3.3.
8. **Nuevo** — `school_athletes` gana `inscripciones_activas` y `cobro_estimado`, + badge y tarjeta "REVISAR" en el listado (§7.7).

### 7.6 Estado tras la primera pasada

- **10 huérfanas canceladas** (verificado: 0 filas colgando en las 6 tablas con FK a `enrollments`).
- **Quedan 16 huérfanas activas**, todas de atletas **activos** — ninguna se cierra sola. Se reparten: 8 Dynasty (6 de onboarding sin asignar + Edward y Victoria), 6 GYM RM (todos `unregistered_athletes`), 2 de prueba.
- **La solución para estas 16 es asignar, no cancelar:** el atleta está activo y la escuela le cobra; lo que falta es a qué referirse. Un `UPDATE … SET team_id = …` por atleta, una vez la escuela diga cuál. Cancelarlas dejaría sin facturar ~$2.210.000/mes.
- **`children.team_id` es columna muerta** — no sirve para reconstruir el equipo perdido. Caso de control: Edward tiene equipo vía `enrollments` y su `children.team_id` es NULL. Ojo: `accept_invitation_pro` **todavía le escribe**. Decidir en F2 si se mantiene o se marca legado, como `teams.age_group`.
- **`auto_generate_payments = false` en Dynasty y en GYM RM** → el cron diario no las toca. **Ninguna duplicación puede dispararse sola.** El riesgo solo se materializa cuando una persona genera el mes: con el botón manual (insert en bucle) cae solo el atleta duplicado; con `open_month` (una sentencia) aborta la escuela entera. Acción: limpiar GYM RM **antes** de que alguien genere agosto allí.
- Los cobros de Dynasty los emite `emitPlanCharge` al asignar plan (concepto `Plan <nombre>`), no `open_month` (`Mensualidad MM/YYYY`). Por eso los 6 sin plan no tienen cobro: es onboarding a medias, no corrupción.

### 7.7 Por qué el front no mostraba nada

`school_athletes.price_monthly` sale del plan que eligió el `LATERAL … LIMIT 1`; `open_month` suma **todas** las inscripciones activas. Dos números por caminos distintos: Victoria se veía en $150.000 mientras el motor intentaría $480.000. Mientras no salgan de la misma fuente, el listado puede mentir.

Tres capas, en orden de valor:

1. **Verdad**: `school_athletes` expone `inscripciones_activas` (cuántas hay, no cuántas muestro) y `cobro_estimado` (lo que `open_month` generaría hoy, misma cascada). Un solo `LATERAL` con `count`/`sum` — no una subconsulta más por fila, que es donde esta vista se degrada.
2. **Visibilidad**: badge en la fila cuando `inscripciones_activas > 1`, y tarjeta `⚠ N REVISAR` junto a TODOS / AL DÍA / PENDIENTE / VENCIDO, clicable como filtro.
3. **Último aviso**: la pantalla de generación muestra el contraste de `preview_open_month` antes de confirmar — *"373 cobros por $X; 8 atletas con inscripciones múltiples"*. Es el último punto donde el error es gratis.
