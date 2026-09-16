# Plan — Monster´s Volley Club: equipo de prueba, atleta inactivo y planes por sede

**Fecha:** 2026-09-16 · **Escuela:** Monster´s Volley Club (`eb3ebc77-4ea4-4992-96c8-3c8ec574578c`)
**Estado:** 🟡 plan. Sin código de migraciones todavía (convención del repo: plan aprobado antes de escribir).

Lo que pidió Monster, textual:

1. Eliminar el equipo **MAYORES FEMENINO** que se creó de prueba en la visita presencial.
2. Quitar **el deportista inactivo**.
3. Poner **los planes**: en **Sede Suba** todos pagan **$145.000**, y los de **doble categoría $165.000**.
   En **Sede Norte** son **$165.000** mensuales. Y los de doble categoría *"podrían estar en las dos listas"*.

---

## 0. Método — qué está verificado y qué no

Todo lo de este documento está verificado **contra el repositorio** (migraciones, BFF, frontend). **No** está
verificado contra la base viva: esta sesión no tiene acceso a Supabase. Los conteos que deciden el camino
(¿el equipo de prueba está vacío?, ¿existe la sede Norte?, ¿cuál es el atleta inactivo?) se confirman con el
SQL de §5 **antes** de tocar nada.

Recordatorio del repo: **la fuente de verdad es la base, no el repo** — que algo esté commiteado no significa
que esté vivo, y al revés (hay ~82 migraciones "sin registro" que sí están aplicadas).

---

## 1. Punto 1 — el equipo "MAYORES FEMENINO" de prueba

### 1.1 Primero: son dos cosas distintas con el mismo nombre

| | Qué es | Se borra |
|---|---|---|
| **Categoría** `MAYFEM` — "MAYORES FEMENINO" | Fila del catálogo de la escuela (`school_categories`), sembrada con las 13 categorías reales de Suba en [`20260826105957`](../supabase/migrations/20260826105957_mod3_school_categories_f1_f2.sql#L121) | **No.** Es catálogo, no roster. Si sobra: `is_active = false` (D10: nunca hard delete) |
| **Equipo** de prueba (`teams`) | El grupo concreto que se creó en la demo presencial | Sí, con las reglas de abajo |

Borrar el equipo **no** toca la categoría, y no hay por qué tocarla: es una de las 13 categorías reales que
Monster dictó, no un artefacto de la prueba.

### 1.2 Sí se puede, y ya está en la UI

`Equipos` → menú **⋯** del equipo → dos opciones ([`TeamsPage.tsx:282-360`](../frontend/src/pages/TeamsPage.tsx#L282-L360)):

| Acción | Qué hace | Cuándo |
|---|---|---|
| **Archivar** | `teams.status = 'inactive'`. Reversible. No toca inscritos ni pagos. Desaparece de los selectores de equipo (todos filtran `status='active'`, p. ej. [`CreateChildModal.tsx:304`](../frontend/src/components/students/CreateChildModal.tsx#L304)) | El equipo tiene aunque sea **una** ficha, asistencia o partido |
| **Eliminar permanente** | `DELETE` real. **Se bloquea solo** si el equipo tiene inscripciones o `children` asociados, y el `23503` de FK lo bloquea si tiene asistencia/partidos | El equipo está **vacío** — que es lo esperable en un equipo de demo |

**Recomendación:** correr el conteo de §5.1. Si da 0 → *Eliminar permanente*. Si da cualquier cosa > 0, no
forzar el borrado: **archivar** (conserva historial y lo saca de todas las listas) o mover esas fichas al
equipo correcto primero. Un equipo de prueba con 14 fichas adentro no es un equipo de prueba: es roster real
mal ubicado.

> Dato de contexto: Monster tiene **14 equipos** y **126 inscripciones activas** (125 fichas sin cuenta + 1
> adulto), según [`docs/inscripciones-sin-monto-y-candados.md §1.2`](inscripciones-sin-monto-y-candados.md).
> Vale la pena mirar los 14 de una vez: si la demo dejó más de un equipo de prueba, se limpian juntos.

---

## 2. Punto 2 — "quitar el deportista inactivo"

### 2.1 Inactivarlo ya lo saca de la operación

La baja **no** es solo un rótulo: pasa por el RPC `set_school_athlete_status`
([`20260730170000`](../supabase/migrations/20260730170000_deactivate_athlete_cancels_plan.sql)), que en una
sola transacción:

- marca el atleta inactivo en su tabla base (`children` / `school_members` / `unregistered_athletes`),
- **cancela su inscripción**, y
- **anula los cobros pendientes** (`pending`, `awaiting_approval`, `overdue`). Los `paid` / `partial` **nunca** se tocan.

Nació justo del caso contrario (VOLK FIT, 2026-07-30: tres atletas dados de baja que siguieron facturando).
Un atleta inactivo no aparece en la pestaña *Activos* de `Deportistas`, no se le puede asignar equipo ni plan,
y no entra en la generación del mes.

### 2.2 Borrarlo del todo: no existe en la UI, y es a propósito

No hay borrado duro de atletas en la aplicación. Se conserva el historial (pagos conciliados, asistencia,
documentos). **Si lo que Monster quiere es que no estorbe en la lista, inactivarlo ya lo resuelve.**

Si de verdad es una ficha cargada por error, sin historial, el camino limpio es el rollback del import
([`scripts/monster-volley-suba-import/03_rollback.sql`](../scripts/monster-volley-suba-import/03_rollback.sql),
que borra en orden inverso: `athlete_documents` → `enrollments` → `unregistered_athletes` → el equipo si queda
vacío), previa verificación de 0 pagos y 0 asistencias.

**Falta el dato:** *cuál* es el atleta (nombre + documento). Con 126 inscripciones no se adivina.

---

## 3. Punto 3 — los planes

### 3.1 Lo que pidieron, en tabla

| Sede | 1 categoría | 2 categorías |
|---|---|---|
| **Suba** | $145.000 | $165.000 |
| **Norte** | $165.000 | **¿?** — no lo dijeron (ver §6) |

### 3.2 Hoy, sin escribir una línea de código

Se puede dejar operando ya, en `Ofertas y planes`
([`OfferingsPage`](../frontend/src/pages/OfferingsPage.tsx) → [`OfferingsManagement`](../frontend/src/components/universal/OfferingsManagement.tsx)),
creando **tres planes** y asignándolos por atleta desde el editor de `Deportistas`:

| Plan | Precio |
|---|---|
| Mensualidad Sede Suba | 145.000 |
| Mensualidad Sede Suba — doble categoría | 165.000 |
| Mensualidad Sede Norte | 165.000 |

El motor de cobros ya resuelve el monto con la cascada
`COALESCE(NULLIF(enrollments.monthly_fee,0), offering_plans.price, teams.price_monthly, children.monthly_fee, 0)`,
y `fee_is_manual` ([`20260827175215`](../supabase/migrations/20260827175215_fee_is_manual_becas_cuota_exenta.sql))
protege becas y cuotas pactadas de cualquier recálculo. Es decir: **el cobro por $165.000 sale bien desde el
primer mes.**

Lo que esta vía **no** da, y hay que decirlo antes de venderla como solución:

1. **Es mantenimiento manual.** Si un atleta deja una categoría, alguien tiene que acordarse de bajarle el plan.
2. **No queda registrado cuáles** son las dos categorías. El plan se llama "doble categoría" y ahí muere el dato.
3. **El atleta sigue apareciendo en una sola lista** — que es justo la otra mitad de lo que pidieron (§3.4).
4. **Monster tiene 0 cuentas de pago configuradas.** Los cobros se generan, pero hoy nadie puede pagarlos en
   línea, y de 125 fichas cargadas **no se envió ninguna invitación** (§1.2 del doc de inscripciones). Poner
   los planes sin resolver eso deja la cartera creciendo contra un buzón vacío. **Esto es más urgente que los tramos.**

### 3.3 La forma correcta: F4 del spec, adaptada a dos sedes

El modelo ya está diseñado en
[`docs/specs/sport-categories-and-multi-category.md §5`](specs/sport-categories-and-multi-category.md):
`school_category_pricing` con tramos por cantidad de categorías, `resolve_athlete_fee` escribiendo en
`enrollments.monthly_fee`, y **un solo cobro** — el tramo **reemplaza** al plan, no se suma (D18). Los $145.000
/ $165.000 del spec salieron literalmente de esta conversación con Monster (D17: son la única escuela que va a
usar esto).

**Lo que el spec no previó: dos sedes con precio base distinto.** D8 cerró los tramos como *globales por
escuela* pensando en un único precio base. Con Suba a $145.000 y Norte a $165.000, el mismo `n=1` vale distinto
según dónde entrena. El modelo **ya lo soporta sin columna nueva**: `school_category_pricing.offering_id`
(NULL = todas) existe desde el diseño, y `offerings` tiene `branch_id`. Basta con **una oferta por sede**:

| Oferta | `categories_count` | `price` |
|---|---|---|
| Sede Suba | 1 | 145.000 |
| Sede Suba | 2 | 165.000 |
| Sede Norte | 1 | 165.000 |
| Sede Norte | 2 | *(decisión pendiente)* |

Queda **una** pregunta que el modelo no responde solo: un atleta con una categoría en Suba y otra en Norte,
¿qué tramo aplica? Propuesta: **manda la oferta del plan que tiene asignado** (es un dato explícito que alguien
eligió); si no tiene plan, la sede de la **categoría principal**. Es decisión de Monster (§6).

### 3.4 "Estar en las dos listas" — esto es lo que de verdad falta

Media obra está hecha. `enrollment_categories` existe
([`20260826110135`](../supabase/migrations/20260826110135_mod3_enrollment_categories_f3.sql)) y el BFF ya deja
de duplicar la inscripción: si llega un `team_id` de otra categoría, **agrega una fila de categoría** en vez de
una segunda inscripción ([`enrollments.ts:396-470`](../bff/src/routes/enrollments.ts#L396-L470)).

Pero el dato **no se lee en ninguna parte**:

| Dónde | Qué pasa hoy | Qué falta |
|---|---|---|
| `Deportistas` (vista `school_athletes`) | Muestra **un** equipo y **un** plan (`LEFT JOIN LATERAL … LIMIT 1`). Las columnas `categories_count` / `categories` del spec §7.7 **no se aplicaron** | Agregar las dos columnas al final de la vista, con `EXPLAIN (ANALYZE, BUFFERS)` como `authenticated` antes/después — es el query #1 de la app |
| Roster de un equipo | Filtra `enrollments.team_id` ([`EnrollTeamStudentModal.tsx:113`](../frontend/src/components/teams/EnrollTeamStudentModal.tsx#L113)) | Leer también `enrollment_categories.team_id` |
| Asistencia | Igual: `eq('team_id', …)` ([`attendance.ts:44`](../bff/src/routes/attendance.ts#L44), [`:1095`](../bff/src/routes/attendance.ts#L1095)) | Igual — si no, el coach de la segunda categoría no puede pasar lista |
| Editar categorías de un atleta | **No hay UI.** `set_enrollment_categories` no existe; la única vía es re-inscribir al atleta a un equipo de otra categoría | RPC + multi-select en el editor de `Deportistas` |

Traducción para Monster: **"estar en las dos listas" no es configuración, es desarrollo.** Hoy el que tiene dos
categorías entrena en las dos, pero el sistema lo muestra en una.

---

## 4. Alcance por fases

| Fase | Qué | Código | Rama |
|---|---|---|---|
| **0 — hoy** | Limpiar el equipo de prueba · inactivar (o depurar) el atleta · crear los 3 planes de §3.2 · **y resolver cuenta de pago + invitaciones** | Ninguno | — |
| **1 — las dos listas** | Cierre de F3: columnas en `school_athletes`, rosters y asistencia leyendo `enrollment_categories`, `set_enrollment_categories` + UI | DB + BFF + Front | una rama |
| **2 — los tramos** | F4: `school_category_pricing` con alcance por oferta/sede, `resolve_athlete_fee`, `recalc_*`, trigger, UI de tramos con preview | DB + BFF + Front | una rama |

Fase 1 antes que Fase 2 **a propósito**: cobrar $165.000 por dos categorías que el sistema no sabe listar es
cobrar por un dato que nadie puede auditar. Además la Fase 0 ya deja el precio correcto en la factura mientras
tanto.

---

## 5. Verificación previa (correr antes de tocar nada)

```sql
-- 5.1 ¿El equipo de prueba está vacío? (reemplazar el id tras identificarlo)
select t.id, t.name, t.status, t.category_id,
       (select count(*) from public.enrollments e where e.team_id = t.id)          as inscripciones,
       (select count(*) from public.enrollments e where e.team_id = t.id
                                                    and e.status = 'active')        as activas,
       (select count(*) from public.children c   where c.team_id = t.id)            as children,
       (select count(*) from public.attendance_sessions a where a.team_id = t.id)   as sesiones
  from public.teams t
 where t.school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c'
 order by t.name;

-- 5.2 Las 13 categorías del catálogo (MAYFEM debe seguir viva, no se borra)
select code, name, rama, is_active
  from public.school_categories
 where school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c'
 order by sort_order, code;

-- 5.3 ¿Existe la sede Norte en la plataforma?
select id, name, is_active from public.school_branches
 where school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c';

-- 5.4 Ofertas y planes que ya tiene (el doc de septiembre decía: 1 plan para 14 equipos)
select o.id as offering_id, o.name as oferta, o.branch_id,
       p.id as plan_id, p.name as plan, p.price, p.is_active
  from public.offerings o
  left join public.offering_plans p on p.offering_id = o.id
 where o.school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c'
 order by o.name, p.price;

-- 5.5 Atletas inactivos de la escuela (para identificar "el deportista inactivo")
-- ojo: la vista expone `is_active`, no `status` (la UI deriva el rótulo en
-- SchoolStudentsManagementPage.tsx:982)
select id, athlete_type, full_name, is_active, team_name, plan_name, enrollment_id
  from public.school_athletes
 where school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c'
   and is_active is not true;

-- 5.6 ¿Alguien ya quedó con dos categorías por la vía del BFF?
select ec.enrollment_id, count(*) as categorias
  from public.enrollment_categories ec
 where ec.school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c'
   and ec.status = 'active'
 group by 1 having count(*) > 1;
```

---

## 6. Decisiones que faltan de Monster

| # | Pregunta | Por qué bloquea |
|---|---|---|
| **1** | En **Sede Norte**, ¿la doble categoría también cuesta $165.000, o hay otro valor? | Es el tramo `n=2` de la oferta Norte. Sin esto, Norte solo puede tener el tramo de 1 |
| **2** | ¿Suba y Norte son **dos sedes de la misma escuela** en la plataforma, o dos escuelas? Hoy solo está cargada **Suba** (13 categorías, 14 equipos, 126 inscripciones) | Define si Norte es un `school_branches` nuevo + su roster, o una escuela aparte. Cambia todo lo demás |
| **3** | Un atleta con una categoría en **cada** sede: ¿qué paga? | §3.3. Propuesta: manda la oferta de su plan; si no tiene, la sede de su categoría principal |
| **4** | ¿Desde qué mes aplican los precios nuevos? | D7: los cobros **ya emitidos** no se tocan; el ajuste entra en el siguiente `open_month` |
| **5** | ¿Cuál es el deportista inactivo (nombre + documento) y qué significa "quitar": sacarlo de la lista o borrarlo? | §2 |
| **6** | ¿Hay matrícula/inscripción anual aparte de la mensualidad? | Cambia si va como `registration_fee` del plan o como cobro suelto |

---

## 7. Qué NO hacer (trampas ya conocidas)

- **No borrar la categoría** `MAYFEM` del catálogo para "eliminar mayores femenino": son cosas distintas (§1.1). D10: las categorías nunca se borran duro.
- **No crear una segunda inscripción** para la doble categoría. Rompe `school_athletes`, `open_month` y los índices únicos (D3). La multi-categoría vive en `enrollment_categories`.
- **No partir el cobro en dos** ($145.000 + $20.000). Obligaría a relajar `uniq_payment_active_period_per_child`, el índice que sostiene toda la protección anti-duplicado (D18).
- **No "repartir" los $165.000 por categoría** en el desglose: dos categorías juntas valen 165.000, la segunda no "vale 20.000" (§5.3 del spec).
- **No editar migraciones existentes.** Todo fix va en una nueva, creada con `npm run migrations:new -- <slug>`.
- **No aplicar SQL desde el editor de Supabase**: deja la base cambiada sin rastro en `schema_migrations`.

---

## 8. Referencias

- [`docs/specs/sport-categories-and-multi-category.md`](specs/sport-categories-and-multi-category.md) — spec madre (F0–F6, decisiones D1–D19)
- [`docs/plan-f1-catalogo-de-categorias.md`](plan-f1-catalogo-de-categorias.md) — F1, y qué quedó fuera
- [`docs/inscripciones-sin-monto-y-candados.md §1.2`](inscripciones-sin-monto-y-candados.md) — estado real de la cuenta de Monster
- [`scripts/monster-volley-suba-import/README.md`](../scripts/monster-volley-suba-import/README.md) — cómo se cargó Sede Suba
- [`20260826105957`](../supabase/migrations/20260826105957_mod3_school_categories_f1_f2.sql) · [`20260826110135`](../supabase/migrations/20260826110135_mod3_enrollment_categories_f3.sql) · [`20260827175215`](../supabase/migrations/20260827175215_fee_is_manual_becas_cuota_exenta.sql)
