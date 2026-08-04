# Plan F0 consolidado — Generación de mes y cobros duplicados

**Producto:** SportMaps · **Fecha:** 2026-08-01 · **Rama:** `develop`
**Estado:** 🟡 plan propuesto — **pendiente de aprobación antes de escribir migraciones**
**Cubre:** `DIN-1` + `DIN-2` de [ROADMAP.md](ROADMAP.md) §2

**Consolida y reemplaza como plan de ejecución:**
- [`plan-f0-inscripciones-y-cobros-duplicados.md`](plan-f0-inscripciones-y-cobros-duplicados.md) — sus §2 y §7 (preflight y mediciones del 31-jul) siguen siendo la **evidencia** de este plan y no se duplican aquí.
- [`specs/month-close-module.md`](specs/month-close-module.md) §4 (apertura + generación unificada) y los hallazgos H1/H2/H3. El resto de ese spec — cierre, `monthly_closes`, snapshots, sub-cierres — es **F1 y posteriores**, fuera de este plan.

Se consolidan porque son el mismo bug visto desde dos specs: el dedup por periodo y la generación
unificada son la misma cadena, y planearlos por separado produce dos migraciones que se pisan.

---

## 1. El hallazgo que cambia el alcance

**Los dos documentos fuente describen como pendiente trabajo que se entregó el 24 de julio.**
Tres migraciones de ese día cerraron la mayor parte, y ninguno de los dos documentos lo registró.
El caso más claro: el §7.3 del plan F0, escrito el **31** de julio, diagnostica que el cron no
puebla `period_*` citando la migración `20260713000003` — que había sido reemplazada **una semana
antes** por `20260724000003`.

| Afirmación en la documentación | Realidad en el código | Evidencia |
|---|---|---|
| **H1** — «el índice único solo cubre menores; adultos y no registrados no tienen red de DB» ([month-close:10](specs/month-close-module.md)) | Los **tres** índices existen — menores, adultos y no registrados — y los tres cubren los 6 estados vivos (`pending, awaiting_approval, paid, partial, overdue, glosado`) | [`20260724000001`](../supabase/migrations/20260724000001_payment_period_dedup_indexes.sql#L61-L79) |
| **H2** — «el cron no puebla `period_year`/`period_month`, así que el dedup por periodo es inerte» ([month-close:11](specs/month-close-module.md), [plan-f0:256](plan-f0-inscripciones-y-cobros-duplicados.md)) | `open_month` los puebla **siempre**, y `generate_monthly_charges` es desde el 24-jul un *thin loop* que delega en `open_month` escuela por escuela, con manejo de error por escuela | [`…000002:68-92`](../supabase/migrations/20260724000002_open_month_rpc.sql#L68-L92) · [`…000003:32-42`](../supabase/migrations/20260724000003_generate_monthly_charges_delegates.sql#L32-L42) |
| **§4.4** — «hay que re-cablear las 3 vías; el botón debe dejar de insertar client-side» ([month-close:190](specs/month-close-module.md)) | Hecho. El botón llama `preview_open_month` y `open_month`; el `.insert()` en bucle desapareció; `calcFirstPayment` quedó confinado a los modales de alta, que es su lugar legítimo | [`PaymentsAutomationPage:2131,2148`](../frontend/src/pages/PaymentsAutomationPage.tsx#L2131-L2148) · [`prorationUtils:22`](../frontend/src/lib/prorationUtils.ts#L22) usado solo en [`CreateChildModal:105`](../frontend/src/components/students/CreateChildModal.tsx#L105) y [`CreateAdultAthleteModal:98`](../frontend/src/components/students/CreateAdultAthleteModal.tsx#L98) |
| Doble-clic y cron+botón el mismo día | Advisory lock transaccional por `(school_id, year, month)` dentro de `open_month` | [`…000002:56`](../supabase/migrations/20260724000002_open_month_rpc.sql#L56) |
| El dedup no ve a los adultos legacy que viven en `parent_id` | El `NOT EXISTS` ya cubre `p2.parent_id = e.user_id` **y** el caso `period_year IS NULL` por rango de `due_date` | [`…000002:110-124`](../supabase/migrations/20260724000002_open_month_rpc.sql#L110-L124) |

**Resultado:** de los cuatro defectos del plan original, **C está cerrado**; de los tres hallazgos
del ciclo de mes, **H1 y H2 están cerrados**. Lo que queda es más pequeño, más concreto y no
requiere tocar la generación unificada — solo terminarla.

> ⚠️ **Esto se verifica contra la base, no contra el repo.** Las migraciones se aplican a mano y
> hay [deriva documentada](ROADMAP.md#inf--infraestructura-y-deuda-de-esquema). El preflight del
> 31-jul verificó `…000001` (3 de 3 índices) pero **no** verificó `…000002` ni `…000003`. Es el
> paso 1 de este plan, y si alguna no está aplicada el diagnóstico cambia.

---

## 2. La contradicción que hay que resolver antes de escribir SQL

El plan original se contradice consigo mismo en el punto que decide **cuánta plata se cobra**:

- **§3.1** propone el desempate del `DISTINCT ON` como
  `(offering_plan_id IS NOT NULL) DESC, fee.amount DESC, created_at` — y afirma que es «el mismo
  criterio de merge de §3.3, deliberadamente».
- **§3.3 punto 4** dice lo contrario, y lo dice **corregido por el preflight**: la cuota sale de la
  fuente propia de la fila que sobrevive, **NO** el máximo entre filas. La evidencia: una atleta de
  Dynasty tiene una huérfana de $180.000 y un plan de $150.000; con el criterio del máximo se le
  cobrarían $30.000 de más cada mes. El monto alto era **dato rancio**, no una cuota mayor.

Si el `DISTINCT ON` se escribe con `fee.amount DESC` se reintroduce exactamente el sobrecobro que
§3.3 corrigió.

**Resolución propuesta — el desempate no mira el monto:**

```
ORDER BY  COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id),
          (e.offering_plan_id IS NOT NULL) DESC,   -- 1. el plan gobierna el cobro
          (e.team_id IS NOT NULL)          DESC,   -- 2. antes que una huérfana
          e.created_at ASC                         -- 3. la más antigua: carga el historial
```

Determinista (`created_at` desempata siempre) y alineado con el merge: la fila que gana el
`DISTINCT ON` es la misma que sobreviviría al merge, y cobra por su propia fuente. `monthly_fee`
explícito en la fila superviviente se respeta — es override deliberado.

---

## 3. Lo que sigue abierto

### 3.1 🔴 La ventana intra-sentencia — el único bug que todavía cobra de más

`open_month` es un solo `INSERT … SELECT` con `NOT EXISTS`. Las subconsultas de una sentencia ven
el snapshot **anterior** a la sentencia: las filas que el propio `INSERT` va produciendo son
invisibles para su `NOT EXISTS`. Con dos inscripciones activas del mismo atleta, **ambas pasan el
filtro y ambas insertan**.

**El advisory lock no protege de esto.** No es concurrencia entre transacciones: es una sola
sentencia. El lock serializa dos llamadas; no serializa dos filas dentro de la misma.

Lo que hoy lo frena es el índice único: la segunda fila revienta con `23505` y **aborta el
`open_month` completo**. El síntoma visible no es «dos cobros» sino **«la apertura de mes falla
para toda la escuela»** — mejor que cobrar de más, pero es un incidente que deja el mes sin generar.

→ `DISTINCT ON` con el desempate de §2, en `open_month` **y** en `preview_open_month` (si el
preview no lleva el mismo, miente respecto de lo que se va a generar).

### 3.2 Las dos vías que siguen fabricando el duplicado

| Vía | Qué hace | Dónde |
|---|---|---|
| **A — `POST /enrollments`** | Atleta con `{team: A, plan: P}`, llega `{team_id: B}`: no hay merge (la condición exige mismo `team_id` o alguno nulo), no hay replace (exige `offering_plan_id`), y el índice `uq_enrollment_child_team` es por `(child_id, team_id)` así que un equipo distinto no colisiona ⇒ `INSERT`. Los guards de arriba solo preguntan «¿ya está en ESTE equipo/plan?», nunca «¿ya tiene una inscripción?» | [`enrollments.ts:233`](../bff/src/routes/enrollments.ts#L233) merge · [`:250`](../bff/src/routes/enrollments.ts#L250) replace · [`:344`](../bff/src/routes/enrollments.ts#L344) el insert |
| **B — el editor de atletas** | Al guardar un atleta sin equipo se escribe `team_id = null`; si la fila no tenía plan queda **huérfana conservando su cuota**. Es el origen identificado de 14 de los 21 casos que cobran | [`students.ts:829`](../bff/src/routes/students.ts#L829) |

Vía A se cierra con un guard; vía B con no anular `team_id` cuando eso dejaría la fila sin equipo
**ni** plan (cancelarla o rechazar el guardado — decisión en §8).

**Hay que auditar las demás vías que insertan en `enrollments`** antes de mergear:
`accept_invitation_pro` ya está cubierta por
[`20260730000000`](../supabase/migrations/20260730000000_enrollment_no_split_rows.sql#L166-L207);
las RPCs de QR y el checkout se revisan una por una en este mismo paso.

### 3.3 🟠 El dato sucio que ya existe

Medido el 31-jul: **98 atletas / 198 filas** activas duplicadas, de los cuales **21 tienen 2+ filas
que cobran**. Detalle por escuela en [§7.4 del plan original](plan-f0-inscripciones-y-cobros-duplicados.md).

- **10 huérfanas ya canceladas** en la primera pasada (verificado: nada colgando en las 6 tablas con FK).
- **16 huérfanas siguen activas**, todas de atletas **activos**. **La solución es asignar, no
  cancelar:** el atleta entrena y la escuela le cobra; lo que falta es a qué referirse. Cancelarlas
  dejaría **~$2.210.000/mes sin facturar**. Requiere que cada escuela diga cuál equipo.
- **GYM RM es la única productiva con daño**: ~15 atletas con mora falsa, 1 cobrado de más
  ($70.000), 1 doble cobro `pending` de agosto, 1 con equipo y plan cobrados a la vez. **Necesita
  conciliación con el gimnasio** — hay que confirmar la cuota real de tres atletas.
- **ORIGINAL BOXING STYLE**: 8 pares equipo+plan, todos en mora, ninguno pagado. Está inactiva.
  Limpiar **antes** de que la activen, o arranca con cartera falsa.
- **Nada revienta el 10 de agosto:** `auto_generate_payments = false` en Dynasty y GYM RM, así que
  el cron no las toca. El riesgo se materializa cuando **una persona** genera el mes.

### 3.4 Los residuos de la era anterior

| Residuo | Cantidad | Nota |
|---|---|---|
| Cobros activos sin `period_year` | **349** | Quedan fuera de los tres índices (son parciales sobre periodo poblado). El `NOT EXISTS` de `open_month` **sí** los ve por rango de `due_date`, así que no generan duplicado nuevo; el hueco es solo el backstop de DB. Decidir backfill derivando de `due_date` (heurística ya usada en `20260503000004`, solo mensualidades) o documentar la exclusión |
| Cobros de adulto con el adulto en `parent_id` y `user_id NULL` | **4** | Forma que producía el cron viejo. **La fuente ya está cerrada**: `open_month` escribe `user_id` correctamente. Son 4 filas de residuo; no justifican un cuarto índice. El conteo es bajo solo porque la autogeneración está apagada casi en todas partes |

### 3.5 La invariante que falta en la base

Nada impide hoy que exista una inscripción activa sin equipo **ni** plan — que es exactamente la
huérfana. Después de limpiar, un `CHECK` la vuelve imposible:

```
ALTER TABLE public.enrollments
  ADD CONSTRAINT enrollments_active_needs_target
  CHECK (status <> 'active' OR team_id IS NOT NULL OR offering_plan_id IS NOT NULL)
  NOT VALID;   -- NOT VALID: no bloquea el despliegue con las 16 pendientes; VALIDATE al cerrarlas
```

`NOT VALID` es deliberado: valida las filas nuevas desde ya, y se corre `VALIDATE CONSTRAINT`
cuando las 16 huérfanas estén asignadas. Sin esto, el `ALTER` falla y bloquea el despliegue.

### 3.6 H3 — caja vs periodo: declarativo, sin código

Un pago que entra tras el cierre conserva su `period_month` original pero cuenta en la caja del mes
en que entra. Es cash-basis correcto, pero **hay que declarar cuál criterio manda en cada reporte**
para que la conciliación no confunda los dos números. No hay migración: es una línea en el spec y
un `COMMENT ON COLUMN`.

### 3.7 La verdad en pantalla

`school_athletes.price_monthly` sale del plan que eligió un `LATERAL … LIMIT 1`; `open_month` suma
según su propia cascada. **Dos números por caminos distintos**: un atleta se veía en $150.000
mientras el motor intentaría $480.000. Mientras no salgan de la misma fuente, el listado puede
mentir. Tres capas, en orden de valor:

1. **Verdad** — `school_athletes` expone `inscripciones_activas` y `cobro_estimado` (lo que
   `open_month` generaría hoy, misma cascada y mismo desempate). En **un solo `LATERAL`** con
   `count`/`sum`: una subconsulta más por fila es donde esta vista se degrada
   ([INF-4](ROADMAP.md#inf--infraestructura-y-deuda-de-esquema)).
2. **Visibilidad** — badge en la fila cuando `inscripciones_activas > 1`, y tarjeta `⚠ N REVISAR`
   junto a TODOS / AL DÍA / PENDIENTE / VENCIDO, clicable como filtro.
3. **Último aviso** — la pantalla de generación muestra el contraste de `preview_open_month` antes
   de confirmar: *«373 cobros por $X · 8 atletas con inscripciones múltiples»*. Es el último punto
   donde el error es gratis.

### 3.8 Deuda de nombre, a registrar

`monthly_closes` **no existe en ninguna migración** del repo. La RPC se llama `open_month` y el
§4.3 del spec dice que su paso 1 es «crear o encontrar la fila `monthly_closes` del periodo» — eso
no está implementado: la RPC genera cuotas y no persiste ninguna apertura. **No se arregla aquí**
(la tabla es F1 del cierre), pero se documenta como desviación consciente en el `COMMENT` de la
función, para que nadie asuma que abrir el mes deja rastro.

---

## 4. Preflight

Se corre en el SQL Editor **como dueño de la escuela**, no como `postgres`. Sin `CREATE TEMP TABLE`
ni `RAISE NOTICE`: el pooler pierde la temp entre sentencias y el notice no se ve. Reportar con un
`SELECT` final. Base para el script: [`scripts/f0_preflight.sql`](../scripts/f0_preflight.sql).

```sql
-- V1. ¿Están aplicadas las tres migraciones del 24-jul? (lo que NO se verificó el 31-jul)
--     Se compara la definición viva contra lo que el repo cree, no solo la existencia.
SELECT p.proname,
       (pg_get_functiondef(p.oid) LIKE '%period_year%')          AS puebla_period,
       (pg_get_functiondef(p.oid) LIKE '%pg_advisory_xact_lock%') AS tiene_lock,
       (pg_get_functiondef(p.oid) LIKE '%DISTINCT ON%')           AS ya_tiene_distinct
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('open_month','preview_open_month','generate_monthly_charges');

-- V2. ¿El cron realmente delega? (esperado: el cuerpo llama a open_month)
SELECT (pg_get_functiondef(p.oid) LIKE '%open_month%') AS delega
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname='public' AND p.proname='generate_monthly_charges';

-- V3. Los tres índices únicos (esperado: 3)
SELECT indexname FROM pg_indexes
 WHERE tablename='payments' AND indexname LIKE 'uniq_payment_active_period_per_%';

-- V4. Atletas con más de una inscripción activa — re-medir, ya pasó una limpieza
SELECT school_id,
       COALESCE(child_id::text, user_id::text, unregistered_athlete_id::text) AS atleta,
       count(*) AS activas,
       count(*) FILTER (WHERE offering_plan_id IS NOT NULL) AS con_plan,
       count(*) FILTER (WHERE team_id IS NULL AND offering_plan_id IS NULL) AS huerfanas,
       count(DISTINCT team_id) FILTER (WHERE team_id IS NOT NULL) AS equipos
  FROM public.enrollments WHERE status='active'
 GROUP BY 1,2 HAVING count(*) > 1 ORDER BY activas DESC;

-- V5. Cobros duplicados por atleta y periodo.
--     ⚠️ NO agrupar por COALESCE(child_id, user_id, unregistered_athlete_id, parent_id):
--     cuando child_id es NULL los HERMANOS colapsan bajo el acudiente y salen falsos
--     positivos (caso medido: 13 "duplicados" que eran de dos niños distintos).
SELECT child_id, user_id, unregistered_athlete_id, period_year, period_month,
       count(*) AS cobros, sum(amount) AS total, array_agg(status) AS estados
  FROM public.payments
 WHERE COALESCE(child_id, user_id, unregistered_athlete_id) IS NOT NULL
 GROUP BY 1,2,3,4,5 HAVING count(*) > 1;

-- V5b. Los cobros sin atleta identificable, aparte (no mezclar con V5)
SELECT count(*) FROM public.payments
 WHERE child_id IS NULL AND user_id IS NULL AND unregistered_athlete_id IS NULL;

-- V6. Duplicados entre los que NO tienen periodo (el hueco de los índices)
SELECT parent_id, child_id, date_trunc('month', due_date) AS mes,
       count(*), array_agg(status)
  FROM public.payments
 WHERE period_year IS NULL
   AND status IN ('pending','awaiting_approval','paid','partial','overdue','glosado')
 GROUP BY 1,2,3 HAVING count(*) > 1;

-- V7. Consumidores de payment_type (D14): ¿algo depende de 'one_time'?
SELECT payment_type, count(*), min(created_at), max(created_at)
  FROM public.payments GROUP BY 1 ORDER BY 2 DESC;
```

**Puertas de decisión:**

| Resultado | Consecuencia |
|---|---|
| V1 `puebla_period = false` o V2 `delega = false` | Las migraciones del 24-jul **no están aplicadas**. Se aplican primero y este plan se reevalúa: el alcance vuelve a ser el del plan original |
| V1 `ya_tiene_distinct = true` | Alguien ya lo arregló fuera del repo → medir la deriva antes de escribir nada |
| V3 < 3 | Aplicar `20260724000001` antes de todo. Su propio preflight aborta si hay duplicados; limpiar V5 primero |
| V6 > 0 | Hay duplicación real entre los 349 sin periodo → el backfill de `period_*` deja de ser opcional |
| V7 muestra consumidores vivos de `one_time` | Documentar el mapeo antes de dar por bueno que todo lo nuevo es `subscription` |

---

## 5. Los cambios

### M1 — `DISTINCT ON` en `open_month` y `preview_open_month`

`npm run migrations:new -- open-month-distinct-athlete`

Se interpone un CTE con `DISTINCT ON` sobre el sujeto **antes** del `INSERT`, con el desempate de
§2 (sin `fee.amount`). El mismo CTE en `preview_open_month`.

Sin cambios de contrato: firma, retorno y `GRANT` intactos. Mantiene
`SET search_path = pg_catalog, public, pg_temp`. Se añade al `COMMENT` la nota de §3.8.

Verificable solo con `preview_open_month` contra el mes en curso, sin escribir nada.

### M2 — `CHECK` de inscripción activa con destino

`npm run migrations:new -- enrollments-active-needs-target`

El `CHECK … NOT VALID` de §3.5. Migración aparte de M1 para poder revertir una sin la otra.

### M3 — Merge de los duplicados que quedan

`npm run migrations:new -- merge-remaining-split-enrollments`

Función con `p_dry_run boolean DEFAULT true` que reporta antes de escribir. Criterio:

0. **La huérfana (sin `team_id` ni `offering_plan_id`) se cancela** — salvo las 16 de §3.3, que se
   asignan. Su monto venía de `children.monthly_fee`, que sigue en el hijo aunque la inscripción se cancele.
1. **Sobrevive la que tiene plan** — el plan gobierna el cobro.
2. Si ninguna o ambas tienen plan → **la más antigua** por `created_at`: carga historial de pagos,
   asistencia y carnets.
3. La superviviente **absorbe** el `team_id` y el `offering_plan_id` que le falten.
4. **La cuota sale de la fuente propia de la superviviente** (precio de su plan, o
   `price_monthly` de su equipo). **NO** el máximo entre filas — ver §2.
5. La descartada pasa a `cancelled` con `end_date = CURRENT_DATE`, **conservando** su
   `offering_plan_id` como registro de lo que pasó.
6. `sessions_used` / `secondary_sessions_used` → el `GREATEST` de ambas.
7. **Solo se automatizan** la huérfana y el split limpio equipo+plan sin ambigüedad de monto. Dos
   equipos distintos, dos planes distintos, o un paquete multi-mes conviviendo con una mensualidad
   **no se fusionan por script**: van a revisión con la escuela.

**Orden obligatorio dentro de cada par: cancelar la descartada primero, mover el plan después.**
Los índices únicos son parciales `WHERE status='active'`; al revés revienta con `23505` — la trampa
ya documentada en [`20260730000000` §4](../supabase/migrations/20260730000000_enrollment_no_split_rows.sql#L328-L338).

**Cobros ya emitidos: no se tocan.** Si un atleta tiene dos cobros del mismo periodo, se listan en
el reporte para que la escuela decida. Es plata y puede haber uno pagado — las anulaciones las
ejecuta el usuario.

### M4 — `school_athletes` con `inscripciones_activas` y `cobro_estimado`

`npm run migrations:new -- school-athletes-enrollment-truth`

Un solo `LATERAL` con `count`/`sum`, misma cascada y mismo desempate que `open_month` (§3.7 capa 1).

### M5 — Backfill de `period_*`, **solo si V6 > 0**

Deriva de `due_date`, únicamente para conceptos de mensualidad. No se escribe «por si acaso»: un
índice único sobre datos sucios falla en el `CREATE` y bloquea el despliegue.

### B1 — El guard que falta en el BFF

En [`enrollments.ts`](../bff/src/routes/enrollments.ts), **después** de calcular `mergeTarget` y
`replaceTarget` y **antes** del `INSERT` de [L344](../bff/src/routes/enrollments.ts#L344):

```ts
// Una sola inscripción activa por atleta por escuela. Si hay una activa y esto no
// es merge ni replace, es un intento de abrir una segunda: se rechaza.
if (!mergeTarget && !replaceTarget && (activeEnrollments?.length ?? 0) > 0) {
    return res.status(409).json({
        error: 'El atleta ya tiene una inscripción activa en esta escuela.',
        details: 'Para cambiar de equipo, edita la inscripción existente.',
        enrollment_id: activeEnrollments![0].id,
    });
}
```

Va **después** de merge/replace para no romper esos dos flujos, y devuelve el `enrollment_id`
existente para que la UI pueda ofrecer «editar la inscripción» en vez de dejar al admin sin salida.

> Cuando llegue la multi-categoría (`MOD-3`), este `409` se relaja: el segundo `team_id` pasará a
> crear una fila en `enrollment_categories`. Hasta entonces, cerrado.

### B2 — `students.ts:829` deja de fabricar huérfanas

El `UPDATE` no puede anular `team_id` si eso deja la fila sin equipo **ni** plan. Ver §8 para la
decisión de qué hacer en ese caso.

### F1 — Frontend: badge, tarjeta REVISAR y contraste del preview

Capas 2 y 3 de §3.7. Depende de M4.

---

## 6. Tests

**Concurrencia e idempotencia** (`bff/tests/`, patrón de los tests existentes):

| # | Escenario | Esperado |
|---|---|---|
| 1 | Dos `open_month` simultáneos, misma escuela — **menor** | 1 cobro; la 2ª llamada devuelve `generados: 0` |
| 2 | Ídem — **adulto** (`user_id`) | 1 cobro |
| 3 | Ídem — **no registrado** | 1 cobro |
| 4 | **Atleta con 2 inscripciones activas + `open_month`** | 1 cobro, por el monto del desempate de §2, **y el `open_month` no aborta** |
| 5 | `open_month` + alta por QR en paralelo, mismo atleta y mes | 1 cobro |
| 6 | Atleta con cobro prorrateado de alta a mitad de mes | `open_month` **no** le genera cuota completa adicional |
| 7 | Cron y botón el mismo día | La segunda vía genera 0 |
| 8 | `preview_open_month` vs `open_month` sobre el mismo periodo | Lista y montos **idénticos** |
| 9 | Doble `POST /enrollments` con `team_id` distinto | 1ª `201`, 2ª `409` |
| 10 | `POST` que **sí** es merge (plan sobre inscripción con equipo) | Sigue funcionando: `200 merged` |
| 11 | `POST` que **sí** es replace (plan distinto) | Sigue funcionando: `200 replaced` |
| 12 | Guardar atleta sin equipo desde el editor, con plan | El plan sobrevive; no aparece huérfana |
| 13 | Ídem, sin plan | Según la decisión de §8 — no queda huérfana con cuota |

**4 y 8 son los nuevos**: 4 es el bug de §3.1 y 8 es el que impide que el preview mienta.
**10 y 11 son los de regresión**: el `409` se mete justo al lado de esa lógica y es donde más fácil
se rompe algo que hoy funciona.

**Datos:** escuela de prueba propia, **no Dynasty ni GYM RM**. La base es compartida entre
dev/stg/prod.

---

## 7. Orden de ejecución

1. **Preflight §4.** Si V1/V2 dicen que las migraciones del 24-jul no están aplicadas, **parar** y reevaluar.
2. **M1** (`DISTINCT ON`) sola. Verificable con `preview_open_month` sin escribir nada.
3. **B1 + B2** con los tests 9–13. Auditoría de las RPCs de QR y del checkout en el mismo paso.
4. **M3 en `dry_run`** → revisar el reporte con el usuario → ejecutar.
5. **Asignación de las 16 huérfanas** — requiere que cada escuela diga el equipo. GYM RM y ORIGINAL BOXING antes que nada.
6. **M2** (`CHECK NOT VALID`), y `VALIDATE CONSTRAINT` cuando el paso 5 cierre.
7. **M4 + F1** (verdad y visibilidad en pantalla).
8. Tests de concurrencia 1–8.
9. **M5** solo si V6 lo justificó.
10. **Actualizar los dos documentos fuente**: marcar H1 y H2 como cerrados en
    [month-close-module.md](specs/month-close-module.md) (§0.1, §4.2, §7, §14 los dan por
    pendientes) y §7.3 del plan original (diagnostica contra una migración superseded).

Los pasos que escriben en la base compartida (4, 5, 6, 9) van con `dry_run`/preview y **el usuario
ejecuta las escrituras**.

---

## 8. Decisiones que hacen falta

| # | Decisión | Por qué importa |
|---|---|---|
| 1 | **`students.ts:829`** — cuando se guarda un atleta sin equipo y su inscripción tampoco tiene plan: ¿se **cancela** la inscripción (el atleta queda sin inscripción activa y deja de facturarse) o se **rechaza el guardado** pidiendo equipo o plan? | Cancelar es silencioso y puede dejar de cobrar a alguien que sí entrena; rechazar es explícito pero puede bloquear un flujo que hoy los admins usan a diario |
| 2 | **Las 16 huérfanas** — ¿se piden los equipos escuela por escuela antes de M2, o se entrega M2 con `NOT VALID` y se cierran después? | Son ~$2.21M/mes. La segunda opción avanza sin esperar respuestas |
| 3 | **Los 349 sin `period_*`** — ¿backfill derivando de `due_date`, o se documenta la exclusión del backstop? | V6 lo decide en gran parte: si hay duplicados reales ahí, el backfill deja de ser opcional |
| 4 | **GYM RM** — ¿quién habla con el gimnasio para confirmar la cuota real de los tres atletas y qué se hace con el sobrecobro de $70.000 ya pagado? | Es el único tenant productivo con daño y no se puede resolver desde el código |

---

## 9. Riesgos

| Riesgo | Mitigación |
|---|---|
| El `DISTINCT ON` deja fuera a un atleta que **legítimamente** debería tener dos cobros | No existe hoy ese caso: una inscripción activa por atleta es la regla en las tres capas. Cuando llegue la multi-categoría, el precio va en **un** cobro, no en dos |
| El merge fusiona algo que no debía | Criterio determinista + `dry_run` + reporte revisado antes de escribir. Reversible: la descartada queda `cancelled`, no borrada |
| El `409` rompe un flujo vivo (QR, invitación, checkout) | Se audita cada vía que inserta en `enrollments` **antes** de mergear; tests 10 y 11 cubren merge y replace |
| Bajar una cuota en el merge o en el desempate | El criterio es explícito y no mira el monto (§2); un `monthly_fee` explícito en la superviviente se respeta |
| El `CHECK` bloquea el despliegue por las 16 huérfanas | `NOT VALID` + `VALIDATE` posterior (§3.5) |
| Las migraciones del 24-jul no están aplicadas y el plan se escribió sobre una premisa falsa | V1/V2 del preflight son puerta dura: si fallan, se para |
| `students.ts:829` se «arregla» y rompe el editor de atletas | Tests 12 y 13, y la decisión 1 de §8 tomada antes de tocar código |

---

## 10. Fuera de alcance

- **Todo el cierre de mes**: `monthly_closes`, snapshots, sub-cierres por `scope`, carryover,
  reapertura, Estado de Resultados. Es F1+ del [spec del ciclo de mes](specs/month-close-module.md).
- **Multi-categoría** (`MOD-3`): el `409` de B1 es deliberadamente estricto hasta entonces.
- **H3** más allá de declararlo (§3.6).
- **Anulación de cobros ya emitidos**: se listan, las ejecuta el usuario.
