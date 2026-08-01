# Spec — Categorías Deportivas, Multi-Categoría y Precio por Cantidad

**Producto:** SportMaps · **Versión:** v0.2 (revisión de precio cross-sport, backfill de becas, alcance de F0)
**Fecha:** Julio 2026
**Estado:** 🟡 borrador. **No se escribe código de migraciones hasta que el plan esté aprobado** (convención del repo).

**Cambios v0.1 → v0.2 (revisión del 2026-07-31):**
- **D8 resuelto: pricing global-only en v1.** El ejemplo canónico (fútbol Sub-12 + fútbol sala Sub-12) cruza deportes, y con tramos por deporte `resolve_athlete_fee` no tenía respuesta definida para `n=2` repartido entre dos tablas de precio. La columna `sport` queda **reservada** con `CHECK (sport IS NULL)` hasta v2 (§5, §7.5, **D8**).
- **`n=0` billable definido** — antes el paso 2 de §5.2 producía un extra negativo (**D13**).
- **El backfill de F4 marca `fee_is_manual`** en las cuotas que hoy no coinciden con la cascada. Sin ese paso, el primer `recalc_school_fees` pisaba todas las becas existentes — justo lo que D6 promete evitar (§11.6).
- **Equipos sin categoría dejan de ser callejón sin salida:** asignar `teams.category_id` a posteriori crea las `enrollment_categories` faltantes (§11.7).
- **Alcance de F0 ampliado y corregido:** el índice único de `payments` para las 3 identidades **ya existe** ([`20260724000001`](../../supabase/migrations/20260724000001_payment_period_dedup_indexes.sql)); F0 verifica que esté aplicado y cubre los dos huecos residuales, no lo reescribe. Se agrega el criterio de merge para los duplicados ya existentes (§13-F0).
- Precisiones: granularidad del trigger de recálculo (**D15**), RLS de acudiente vía helper `SECURITY DEFINER` (**§8**), `enrollments.team_id` cuando la principal no tiene equipo (**D16**), redacción de D7 y del caso QA 1.

> Se construye **por fases con revisión entre cada una** (una rama por fase). Tests de concurrencia en la fase backend. RLS revisado línea por línea antes de aplicar. Toda migración se crea con `npm run migrations:new -- <slug>`.

**Qué resuelve, en una línea:** hoy la "categoría" de un atleta es texto libre dentro del nombre de un equipo; este spec la vuelve un dato estructurado, reutilizable por escuela **y** por liga/torneo, permite que un atleta esté en **más de una categoría**, y hace que el precio dependa de **cuántas** (1 categoría $145.000 / 2 categorías $165.000).

---

## 0. Contexto — qué existe HOY (no reinventarlo)

Hay **tres mundos que hablan de "categoría" y no se conocen entre sí**:

| # | Dónde vive | Forma | Quién lo usa |
|---|---|---|---|
| 1 | [`teams`](../../supabase/migrations/20260217000001_schema_refactored.sql#L334) — `name`, `sport`, `age_group`, `season`, `price_monthly`¹ | **Texto libre.** La categoría está embebida en el nombre ("Sub-12 Masculino") o en `age_group` | Roster de la escuela, cobros, asistencia, carnets |
| 2 | [`sport_category_templates`](../../supabase/migrations/20260716000001_sport_category_templates.sql) — `sport`, `archetype`, `division`, `category`, `rama`, `level`, `age_min/max`, `team_min/max` | **Catálogo estructurado**, seed de 8 deportes, editable por super-admin | **Solo el editor de torneos.** No lo ve el módulo de escuela |
| 3 | `event_categories_config`² — `division`, `level`, `category`, `rama`, `age_min/max`, `birth_year_min/max`, `team_min/max`, `routine_max_seconds`, `scoring_system`, `crossover_allowed`, `min_not_met_action` | Categorías **de un torneo concreto** | Inscripción a eventos, delegaciones, `tournament_matches.category_id` |

¹ `teams.price_monthly` es **drift**: la usa [`school_athletes`](../../supabase/migrations/20260730195021_school_athletes_lateral_rewrite.sql#L149) y `open_month`, pero no está en ninguna migración. Se versiona en F2.
² `event_categories_config` **tampoco está versionada** (solo hay `ALTER`s y policies sobre ella). Se versiona en F5.

### 0.1 La cadena real de la escuela

```
atleta (children | profiles+school_members | unregistered_athletes)
   └── enrollments   ← UNA fila activa por atleta por escuela
         ├── team_id           → roster (qué equipo entrena)
         ├── offering_plan_id  → qué se le cobra
         └── monthly_fee       → override individual (gana sobre todo)
```

**Una inscripción activa por atleta** es una regla deliberada, reforzada en tres capas tras el incidente Dynasty (2026-07-29):

- [`enrollments.ts:130-257`](../../bff/src/routes/enrollments.ts#L130-L257) — `mergeTarget` completa la fila existente; `replaceTarget` reemplaza el plan sobre la misma fila. Nunca inserta una segunda.
- [`accept_invitation_pro`](../../supabase/migrations/20260730000000_enrollment_no_split_rows.sql#L166-L207) — completa, no apila.
- [`school_athletes`](../../supabase/migrations/20260730195021_school_athletes_lateral_rewrite.sql#L146-L165) — `LEFT JOIN LATERAL … ORDER BY created_at LIMIT 1`: muestra **un** equipo y **un** plan. Un segundo sería invisible.

Índices únicos parciales existentes sobre `enrollments` (todos `WHERE status='active'`): `uq_enrollment_child_team`, `uq_enrollment_child_plan`, `uq_enrollment_user_team`, `uq_enrollment_user_plan` y gemelos para `unregistered_athlete_id`. **Solo impiden repetir el MISMO equipo o el MISMO plan** — no impiden dos equipos distintos.

### 0.2 Cascada del monto (no cambia con este spec)

[`open_month`](../../supabase/migrations/20260724000002_open_month_rpc.sql#L95-L103) y su preview resuelven así:

```
enrollments.monthly_fee  →  offering_plans.price  →  teams.price_monthly  →  children.monthly_fee  →  0
```

**Esta cascada es el punto de enganche del precio multi-categoría** (§5): si el precio resuelto se escribe en `enrollments.monthly_fee`, el motor de cobros no se toca.

### 0.3 🔴 Bug activo que este spec destapa (y arregla en F0)

Hoy `POST /api/v1/enrollments` con **solo** `team_id` sobre un atleta que ya tiene equipo:

- no hace merge (la fila ya trae equipo, y `row.team_id !== data.team_id`),
- no hace replace (no viene `offering_plan_id`),
- `uq_enrollment_child_team` no lo bloquea (es otro equipo),
- → **inserta una segunda inscripción activa.**

Y en `open_month`, el `NOT EXISTS` anti-duplicado se evalúa contra el snapshot **previo** al `INSERT … SELECT`: las filas que inserta la propia sentencia no son visibles para su subconsulta. Con dos inscripciones activas del mismo atleta → **dos cobros del mismo mes**, por montos sueltos (145.000 + precio del equipo B), nunca 165.000.

> Es decir: la "doble categoría" ya se puede colar por la API, queda invisible en `/deportistas`, y factura mal. F0 lo cierra **antes** de construir nada encima.

---

## 1. El problema

1. **La categoría no es un dato.** Es una cadena dentro de `teams.name`. No se puede filtrar, agrupar, reportar ni validar. "¿Cuántos atletas tengo en Sub-12 femenino?" hoy se responde a ojo.
2. **No hay elegibilidad.** Nada valida que un atleta de 14 años esté en Sub-12. Se detecta cuando la liga lo rechaza.
3. **La escuela y el torneo no comparten vocabulario.** Armar una delegación ([`school-delegations.route.ts:117-170`](../../bff/src/routes/school-delegations.route.ts#L117-L170)) es 100% manual: el admin vuelve a elegir categoría y atletas uno por uno, aunque en la escuela ya estén agrupados exactamente así.
4. **Doble categoría no existe.** El atleta que entrena fútbol Sub-12 **y** fútbol sala no se puede representar; o se le pone un equipo o el otro.
5. **El precio no puede depender de la cantidad.** Los $165.000 solo se representan como un plan con nombre distinto o un override manual en `monthly_fee`; en ningún caso queda registrado **cuáles** son las dos categorías, ni se recalcula si el atleta deja una.

---

## 2. Modelo propuesto — cuatro niveles

```
sport_category_templates        (GLOBAL, super-admin)   "Sub-12 Masculino de fútbol, 11-12 años, 11-20 jugadores"
        │  se copia al adoptarla
        ▼
school_categories               (POR ESCUELA)            "Sub-12 Masculino" de MI escuela, con MIS rangos
        │  1..N
        ▼
teams                           (GRUPO CONCRETO)         "Sub-12 M — Lunes/Miércoles 4pm — Sede Norte — Coach Ana"
        │  N..M vía enrollment_categories
        ▼
enrollments (1 por atleta)  ──►  enrollment_categories    el atleta pertenece a 1..N categorías
                                        │
                                        ▼
                            school_category_pricing       1 → $145.000 · 2 → $165.000
                                        │
                                        ▼
                            enrollments.monthly_fee       ← lo que ya lee open_month
```

**Las tres separaciones que importan:**

| Concepto | Qué es | Qué NO es |
|---|---|---|
| **Categoría** (`school_categories`) | La clasificación deportiva: deporte + edad/peso/nivel + rama. Es lo que entiende una liga. | No tiene horario, ni sede, ni coach, ni precio propio |
| **Equipo** (`teams`) | El grupo concreto que entrena: horario, sede, coach, cupo. Pertenece a **una** categoría. | No es la categoría. Una categoría puede tener 3 equipos (por horario o sede) |
| **Plan** (`offering_plans`) | El paquete comercial (mensualidad, sesiones, duración) | No es ni categoría ni equipo. El precio final sale del plan **ajustado por cantidad de categorías** |

**Invariante que se conserva:** sigue habiendo **una sola `enrollments` activa por atleta por escuela**. La multi-categoría vive en la tabla hija `enrollment_categories`. Esto es deliberado: no toca los ~20 lectores de `enrollments`, ni los índices únicos, ni `open_month`, ni `school_athletes` más allá de dos columnas nuevas.

---

## 3. Catálogo base de deportes y categorías

Seed de `sport_category_templates` ampliado. **Son sugerencias editables**: cada escuela adopta lo que use y ajusta rangos; cada liga tiene sus propias variantes y la escuela puede sobreescribir en `school_categories`. `sport` se guarda en minúsculas sin tildes (convención existente, el BFF hace `lower()` al filtrar).

**Eje de categorización** (`categorization_axis`, enum que ya existe): `age` · `weight` · `belt` · `level` · `division` · `none`.

### 3.1 Deportes de conjunto — eje `age` (+ `rama`)

**Fútbol / Fútbol sala / Microfútbol** (`futbol`, `futsal`, `microfutbol`) — arquetipo `team`:

| Código | Nombre | Edad | Rama | Jugadores |
|---|---|---|---|---|
| `SUB6` | Baby Fútbol / Sub-6 | 4–6 | Mixto | 5–12 |
| `SUB8` | Sub-8 | 7–8 | Mixto | 7–14 |
| `SUB10` | Sub-10 | 9–10 | M / F | 7–18 |
| `SUB12` | Sub-12 | 11–12 | M / F | 11–20 |
| `SUB14` | Sub-14 | 13–14 | M / F | 11–22 |
| `SUB16` | Sub-16 | 15–16 | M / F | 11–22 |
| `SUB18` | Sub-18 | 17–18 | M / F | 11–22 |
| `SUB20` | Sub-20 | 19–20 | M / F | 11–22 |
| `LIBRE` | Libre / Mayores | 16–99 | M / F | 11–22 |

**Baloncesto** (`baloncesto`) — arquetipo `team`:

| Código | Nombre | Edad | Rama | Jugadores |
|---|---|---|---|---|
| `MINI` | Mini-baloncesto / Sub-11 | 8–11 | Mixto | 5–12 |
| `PREINF` | Pre-infantil / Sub-13 | 12–13 | M / F | 5–12 |
| `INF` | Infantil / Sub-15 | 14–15 | M / F | 5–12 |
| `JUV` | Juvenil / Sub-17 | 16–17 | M / F | 5–12 |
| `SUB19` | Sub-19 | 18–19 | M / F | 5–12 |
| `MAY` | Mayores | 18–99 | M / F | 5–12 |

**Voleibol** (`voleibol`) — arquetipo `team`:

| Código | Nombre | Edad | Rama | Jugadores |
|---|---|---|---|---|
| `MINI` | Mini-voley / Sub-12 | 9–12 | Mixto | 4–10 |
| `INF` | Infantil / Sub-14 | 13–14 | M / F | 6–14 |
| `MEN` | Menores / Sub-16 | 15–16 | M / F | 6–14 |
| `JUV` | Juvenil / Sub-18 | 17–18 | M / F | 6–14 |
| `MAY` | Mayores | 18–99 | M / F | 6–14 |

### 3.2 Deportes individuales por edad — eje `age`

**Natación** (`natacion`) — arquetipo `race`, individual (`team_min/max = 1`):

| Código | Nombre | Edad | Rama |
|---|---|---|---|
| `PREINF` | Pre-infantil | 6–8 | Mixto |
| `INFA` | Infantil A | 9–10 | M / F |
| `INFB` | Infantil B | 11–12 | M / F |
| `JUVA` | Juvenil A | 13–14 | M / F |
| `JUVB` | Juvenil B | 15–16 | M / F |
| `MAY` | Mayores | 17–99 | M / F |

**Atletismo** (`atletismo`) — arquetipo `race`, individual:

| Código | Nombre | Edad | Rama |
|---|---|---|---|
| `SUB14` | Sub-14 / Menores | 12–13 | M / F |
| `SUB16` | Sub-16 / Infantil | 14–15 | M / F |
| `SUB18` | Sub-18 / Juvenil | 16–17 | M / F |
| `SUB20` | Sub-20 | 18–19 | M / F |
| `SUB23` | Sub-23 | 20–22 | M / F |
| `MAY` | Mayores | 18–99 | M / F |

**Tenis / Tenis de mesa / Bádminton** (`tenis`, `tenis_mesa`, `badminton`) — `race`/`judged`, individual: `SUB10` (8–10), `SUB12` (11–12), `SUB14` (13–14), `SUB16` (15–16), `SUB18` (17–18), `MAY` (18–99), en M/F.

**Patinaje** (`patinaje`) — `race`, individual: `PREINF` (7–8), `INF` (9–10), `MEN` (11–12), `PREJUV` (13–14), `JUV` (15–16), `MAY` (17–99), en M/F.

**Ciclismo** (`ciclismo`) — `race`: `SUB15`, `SUB17`, `SUB19`, `SUB23`, `ELITE`, `MASTER` (por décadas).

### 3.3 Deportes por nivel — eje `level`

**Porrismo / Cheerleading** (`porras`, `cheerleading`) — `judged`. **Dos ejes simultáneos**: nivel (dificultad) × grupo etario.

| Nivel | Grupo etario | Edad | Rama |
|---|---|---|---|
| `PREP`, `NOVICE`, `L1`…`L6` | `TINY` | 4–6 | Femenino / Mixto |
| | `MINI` | 5–8 | Femenino / Mixto |
| | `YOUTH` | 8–11 | Femenino / Mixto |
| | `JUNIOR` | 11–14 | Femenino / Mixto |
| | `SENIOR` | 14–18 | Femenino / Mixto |
| | `OPEN` | 15–99 | Femenino / Mixto |

→ La categoría real es la combinación (`L2` + `JUNIOR` + `Femenino`). Se modela con `level` + `code` + `age_min/max`, no con dos tablas.

**Gimnasia artística** (`gimnasia`) — `judged`, individual: niveles `N1`…`N10` con rangos de edad crecientes (6–8, 7–9, 8–11, 9–12, 10–14, 11–16, 12–18, 13–99…), rama F/M.

### 3.4 Deportes de combate — ejes `age` + `weight` (+ `belt`)

**Taekwondo** (`taekwondo`), **Judo** (`judo`), **Karate** (`karate`), **Lucha** (`lucha`), **Boxeo** (`boxeo`) — `judged`/`combat`, individual.

Grupos etarios: `INF` (6–9), `PREJUV` (10–11), `JUV` (12–14), `CAD` (15–17), `MAY` (18–99).
Sobre cada grupo, **categorías de peso** (`weight_min_kg` / `weight_max_kg`) que cambian por edad y rama.
En artes marciales, además **cinturón** (`belt`: blanco…negro) para separar novatos de avanzados en el mismo peso.

→ Estos deportes son la razón por la que `school_categories` necesita `weight_min_kg`, `weight_max_kg` y `belt`, no solo edad. **El seed inicial trae los grupos etarios y deja los pesos vacíos** (varían demasiado por federación); la escuela los carga en su catálogo. Ver **D9**.

### 3.5 Cómo se determina la categoría de un atleta

Dos convenciones y **hay que soportar las dos** (ver **D2**):

| Modo | Regla | Quién lo usa |
|---|---|---|
| `birth_year` | `birth_year_min ≤ año_nacimiento ≤ birth_year_max` | **Ligas colombianas** (el que juega Sub-12 en 2026 es el nacido en 2014-2015, sin importar el mes) |
| `age_at_date` | edad cumplida a una fecha de corte (`reference_date`, default 31-dic del año en curso) | Escuelas para su organización interna |

`event_categories_config` **ya tiene** `birth_year_min/max` además de `age_min/max` — el modelo de escuela debe traer los mismos cuatro campos para que el mapeo a torneo sea directo.

---

## 4. Multi-categoría

### 4.1 Regla

Un atleta tiene **una inscripción activa** y **1..N categorías activas** dentro de ella. Una de ellas es la **principal** (`is_primary`) — la que se muestra donde hoy hay una sola (carnet, listados compactos, `school_athletes.team_name`).

```
enrollments (id, child_id/user_id/unregistered_athlete_id, school_id, status='active', monthly_fee, offering_plan_id, team_id)
     │
     ├── enrollment_categories (category_id=Sub-12 Fútbol M, team_id=grupo L/M 4pm, is_primary=true,  billable=true)
     └── enrollment_categories (category_id=Fútbol Sala Sub-12,  team_id=grupo J/V 5pm, is_primary=false, billable=true)
```

`enrollments.team_id` **se conserva** apuntando siempre al equipo de la categoría principal (lo mantiene un trigger). Así ningún lector actual se rompe.

### 4.2 Reglas duras

| # | Regla | Dónde se aplica |
|---|---|---|
| R1 | Exactamente **una** categoría `is_primary` activa por inscripción | Índice único parcial + trigger |
| R2 | No se repite la misma categoría en la misma inscripción | Índice único parcial `WHERE status='active'` |
| R3 | El `team_id` de una fila debe pertenecer a esa `category_id` | `CHECK` vía trigger (FK compuesta no es viable con `teams.category_id` nullable en la transición) |
| R4 | Cambiar el set de categorías **siempre** recalcula `monthly_fee` | Trigger `AFTER INSERT/UPDATE/DELETE` |
| R5 | Máximo de categorías por atleta configurable por escuela (default 3) | Validación BFF + `CHECK` en RPC |
| R6 | Un atleta inactivo no admite categorías nuevas | Reusa `isAthleteActive()` del BFF |
| R7 | Elegibilidad por edad/año/peso: **advertencia, no bloqueo** (ver **D5**) | BFF devuelve `warnings[]`; la UI pide confirmación |

### 4.3 Qué pasa con lo que ya existe

`POST /api/v1/enrollments` deja de poder crear una segunda fila:

- Si llega `team_id` y el atleta ya tiene inscripción activa → **se agrega una fila en `enrollment_categories`** (no una inscripción nueva), con la categoría del equipo.
- La lógica `mergeTarget` / `replaceTarget` de plan se conserva tal cual.
- Cualquier intento de insertar una segunda `enrollments` activa se rechaza con `409`.

---

## 5. Precio por cantidad de categorías

### 5.1 Modelo — tramos **globales por escuela** (v1)

| `school_id` | `sport` | `categories_count` | `price` |
|---|---|---|---|
| Dynasty | `NULL` | 1 | 145.000 |
| Dynasty | `NULL` | 2 | 165.000 |
| Dynasty | `NULL` | 3 | 180.000 |

Para cantidades por encima del último tramo: `extra_category_price` (ej. +20.000 por cada adicional). Si no hay tramos configurados, el precio es el del plan — **comportamiento actual intacto**.

> **Por qué global-only en v1 (D8).** El caso estrella del spec —fútbol Sub-12 **+ fútbol sala** Sub-12— cruza deportes. Con tramos por deporte (`futbol` 1→145k, `futsal` 1→130k) y `n=2`, no hay tramo que aplicar: el atleta no está "en el tramo 2 de fútbol" ni "en el tramo 2 de futsal". Las salidas eran (a) exigir que **todas** las categorías billables sean del mismo deporte para usar el tramo de ese deporte y caer al global si no, o (b) posponer el pricing por deporte. **Se elige (b):** `resolve_athlete_fee` se vuelve una función de un solo argumento efectivo (`n`), sin ramas por composición del set. La columna `sport` se crea con `CHECK (sport IS NULL)` — reservada, sin semántica, imposible de poblar por accidente. Levantar ese CHECK en v2 exige definir primero la regla cross-sport, no antes.

### 5.2 Resolución del monto

```
resolve_athlete_fee(enrollment_id) →
  n := count(enrollment_categories WHERE status='active' AND billable)

  0. n = 0  (sin categorías, o todas de cortesía)  → paso 3   ← D13
  1. tramo exacto en school_category_pricing (school, n)      → ese precio
  2. n > último tramo configurado (T):
        T.price + COALESCE(T.extra_category_price, 0) × (n − T.categories_count)
     (si extra_category_price es NULL → T.price, nunca un extra negativo)
  3. sin tramos configurados → offering_plans.price            → como hoy
  4. sin plan → teams.price_monthly de la categoría principal  → como hoy
  5. sin nada → children.monthly_fee → 0                       → como hoy
```

**`n = 0` cae al paso 3, no a `$0`** (D13). "Todas las categorías en cortesía" significa *no cobro el extra por categoría*, no *no cobro nada*: el atleta sigue teniendo un plan y ese plan tiene precio. Si la escuela quiere cuota cero, el camino explícito es `monthly_fee = 0` con `fee_is_manual = true`, que además queda visible en la UI como decisión deliberada y auditable. La UI del multi-select debe decir literalmente *"las categorías de cortesía no suman al precio; la cuota vuelve a la del plan"* para que no se lea como gratuidad.

El resultado se **escribe en `enrollments.monthly_fee`** vía `recalc_enrollment_fee()` (`SECURITY DEFINER`, disparada por trigger en `enrollment_categories`).

**Por qué así:** `monthly_fee` es el primer eslabón de la cascada que ya lee [`open_month`](../../supabase/migrations/20260724000002_open_month_rpc.sql#L95-L103). El motor de cobros, el preview, los recordatorios, la mora y el QR no se tocan. Un solo cobro por atleta por mes, por el monto correcto.

**Riesgo asumido:** `monthly_fee` es también el override manual que hoy usa la escuela para cuotas especiales (beca, descuento familiar). Un recálculo automático lo pisaría. Ver **D6** — se resuelve con `enrollments.fee_is_manual boolean`: si está en `true`, el recálculo no toca el monto y la UI muestra "cuota manual — no sigue la tabla de precios".

> ⚠️ **El flag nace en `false` para todo lo que ya existe.** Hoy no hay forma de distinguir en `monthly_fee` una beca de $100.000 de una copia del precio del plan — son la misma columna con el mismo aspecto. Si F4 se aplica sin marcar el pasado, el primer `recalc_school_fees` **pisa todas las becas vigentes**. El backfill obligatorio está en §11.6 y es parte de F4, no opcional.

### 5.3 Un solo cobro — el tramo REEMPLAZA al plan, no se suma

Decisión del negocio (Monster's, 2026-07-31): **si el atleta está en dos categorías, hace ese pago y nada más.** No paga el plan por un lado y un adicional por otro: su cuota **es** $165.000.

Esto ya es lo que hace la cascada de §5.2 —el tramo gana sobre `offering_plans.price`— pero se deja explícito porque es fácil leerlo al revés:

| | ✔ Correcto | ✘ Incorrecto |
|---|---|---|
| Cobro mensual | **una** fila en `payments` por $165.000 | dos filas: $145.000 + $20.000 |
| Relación con el plan | el tramo **sustituye** el precio del plan | el tramo **se suma** al plan |
| Estado de pago | uno por atleta | uno por categoría |
| Mora / recordatorios | sobre el cobro único | por categoría |

**Por qué no dos cobros:** `uniq_payment_active_period_per_child` (y sus gemelos de adulto y no-registrado) imponen **un cobro activo por atleta por periodo**. Es el índice que sostiene toda la protección anti-duplicado del sistema. Partir el cobro en dos obligaría a relajarlo y reabriría exactamente el agujero que F0 cierra. No se toca.

**Desglose informativo.** Para que la escuela y la familia vean *qué cubre* el cobro, se registra la relación, no un reparto de plata:

```sql
CREATE TABLE public.payment_categories (
    payment_id  uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
    category_id uuid NOT NULL REFERENCES public.school_categories(id) ON DELETE RESTRICT,
    PRIMARY KEY (payment_id, category_id)
);
```

La UI muestra *"Mensualidad 08/2026 — cubre Voleibol Sub-12 y Voleibol Playa · $165.000"*. **No se inventan montos por categoría:** un tramo de 1→$145.000 y 2→$165.000 no significa que la segunda categoría "valga $20.000", significa que dos juntas valen $165.000. Repartirlo sería fabricar un dato que el negocio no definió. Si más adelante una escuela quiere reparto real por categoría, eso es un modelo de precio distinto (precio por categoría, no por cantidad) y va en otra versión.

Lo poblan `open_month` y las demás vías de cobro, con las categorías activas del atleta al momento de emitir.

### 5.4 Qué se recalcula y cuándo

| Evento | Acción |
|---|---|
| Se agrega/quita/desactiva una categoría | Recalcular esa inscripción |
| Cambia el plan | Recalcular |
| Se edita la tabla de precios | Recalcular **en lote** las inscripciones activas de la escuela (RPC explícita con preview, no automática) |
| Cobros del mes **ya generados** | **No se tocan.** El nuevo monto aplica desde el siguiente mes (ver **D7**) |

---

## 6. Ligas y torneos — el porqué del dato estructurado

Con `school_categories` poblado se destraba:

1. **Mapeo escuela → torneo.** `school_categories` y `event_categories_config` comparten forma (`sport`, `code`, `rama`, `age/birth_year`, `level`, `team_min/max`). Al inscribir una delegación, el sistema propone: *"tu Sub-12 M (14 atletas) encaja en la categoría Sub-12 Masculino del torneo"*, y **arma el `event_team` con sus miembros de un clic**. Hoy [eso es manual, atleta por atleta](../../bff/src/routes/school-delegations.route.ts#L117-L170).
2. **Elegibilidad automática.** Antes de inscribir: edad/año de nacimiento fuera de rango, peso fuera de la división, cupo `team_min`/`team_max` no alcanzado. Se detecta en la escuela, no en la mesa de inscripción de la liga.
3. **Crossover coherente.** `event_categories_config.crossover_allowed` **ya existe** — el torneo ya contempla que un atleta compita en dos categorías. Lo que faltaba era que la escuela pudiera representarlo. Con este spec, ambos lados hablan lo mismo.
4. **Torneos propios de la escuela** ([[project_school_tournaments]]): la escuela crea su liga interna y las categorías salen de su propio catálogo en vez de escribirlas a mano.
5. **Reportes por categoría** — asistencia, rendimiento, cartera, ocupación, todo agrupable por categoría real. Hoy imposible: la categoría es una subcadena de un nombre.
6. **Métricas de rendimiento comparables** ([[project_performance_metrics_model]]): el benchmark tiene sentido dentro de una categoría (comparar un Sub-10 con un Sub-18 no dice nada).

---

## 7. Modelo de datos

> DDL indicativo. **No se escribe hasta aprobar el plan.** Convenciones obligatorias del repo: `SET search_path = pg_catalog, public, pg_temp` en toda función nueva; `GRANT EXECUTE` explícito por RPC; estados en tablas nuevas con `text + CHECK`, **no** `CREATE TYPE`; FKs de negocio a `public.profiles(id)`.

### 7.1 Extender el catálogo global (no crear uno nuevo)

```sql
ALTER TABLE public.sport_category_templates
    ADD COLUMN IF NOT EXISTS code            text,          -- 'SUB12', 'L2', 'INFA'
    ADD COLUMN IF NOT EXISTS scope           text NOT NULL DEFAULT 'both'
        CHECK (scope IN ('school','tournament','both')),
    ADD COLUMN IF NOT EXISTS axis            text NOT NULL DEFAULT 'age'
        CHECK (axis IN ('age','weight','belt','level','division','none')),
    ADD COLUMN IF NOT EXISTS weight_min_kg   numeric,
    ADD COLUMN IF NOT EXISTS weight_max_kg   numeric,
    ADD COLUMN IF NOT EXISTS belt            text,
    ADD COLUMN IF NOT EXISTS age_rule        text NOT NULL DEFAULT 'age_at_date'
        CHECK (age_rule IN ('age_at_date','birth_year'));
```

Más el seed de §3 (`ON CONFLICT DO NOTHING`, sin tocar las filas existentes de torneos).

### 7.2 Categorías de la escuela

```sql
CREATE TABLE public.school_categories (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    branch_id       uuid REFERENCES public.school_branches(id) ON DELETE SET NULL,
    template_id     uuid REFERENCES public.sport_category_templates(id) ON DELETE SET NULL,
    sport           text NOT NULL,
    code            text NOT NULL,                    -- 'SUB12'
    name            text NOT NULL,                    -- 'Sub-12 Masculino'
    rama            text NOT NULL DEFAULT 'Mixto' CHECK (rama IN ('Masculino','Femenino','Mixto')),
    axis            text NOT NULL DEFAULT 'age' CHECK (axis IN ('age','weight','belt','level','division','none')),
    age_rule        text NOT NULL DEFAULT 'age_at_date' CHECK (age_rule IN ('age_at_date','birth_year')),
    age_min         integer,
    age_max         integer,
    birth_year_min  integer,
    birth_year_max  integer,
    level           text,
    belt            text,
    weight_min_kg   numeric,
    weight_max_kg   numeric,
    team_min        integer,
    team_max        integer,
    color           text,                             -- para chips en la UI
    is_active       boolean NOT NULL DEFAULT true,
    sort_order      integer NOT NULL DEFAULT 0,
    metadata        jsonb   NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT school_categories_age_range  CHECK (age_min IS NULL OR age_max IS NULL OR age_min <= age_max),
    CONSTRAINT school_categories_year_range CHECK (birth_year_min IS NULL OR birth_year_max IS NULL OR birth_year_min <= birth_year_max)
);

CREATE UNIQUE INDEX ux_school_categories_code
    ON public.school_categories (school_id, lower(sport), upper(code), rama)
    WHERE is_active;
```

### 7.3 El equipo pertenece a una categoría

```sql
ALTER TABLE public.teams
    ADD COLUMN IF NOT EXISTS category_id  uuid REFERENCES public.school_categories(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS price_monthly numeric;   -- versiona el drift existente (§0)
```

`teams.age_group` **se conserva** (no se borra nada) como respaldo del backfill.

### 7.4 Roster multi-categoría

```sql
CREATE TABLE public.enrollment_categories (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
    school_id     uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,  -- denormalizado para RLS sin join
    category_id   uuid NOT NULL REFERENCES public.school_categories(id) ON DELETE RESTRICT,
    team_id       uuid REFERENCES public.teams(id) ON DELETE SET NULL,
    is_primary    boolean NOT NULL DEFAULT false,
    billable      boolean NOT NULL DEFAULT true,      -- categoría de cortesía: no suma al precio
    status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')),
    start_date    date NOT NULL DEFAULT CURRENT_DATE,
    end_date      date,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

-- R2: sin categorías repetidas
CREATE UNIQUE INDEX ux_enrollment_categories_unique
    ON public.enrollment_categories (enrollment_id, category_id) WHERE status = 'active';
-- R1: exactamente una principal
CREATE UNIQUE INDEX ux_enrollment_categories_primary
    ON public.enrollment_categories (enrollment_id) WHERE is_primary AND status = 'active';
-- lecturas de la vista
CREATE INDEX idx_enrollment_categories_enrollment
    ON public.enrollment_categories (enrollment_id) WHERE status = 'active';
CREATE INDEX idx_enrollment_categories_category
    ON public.enrollment_categories (category_id) WHERE status = 'active';
```

### 7.5 Tramos de precio

```sql
CREATE TABLE public.school_category_pricing (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id             uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    -- RESERVADA v2 (D8). El CHECK la vuelve imposible de poblar: definir primero
    -- la regla cross-sport, después levantar el CHECK. Ver §5.1.
    sport                 text CONSTRAINT school_category_pricing_sport_reserved CHECK (sport IS NULL),
    offering_id           uuid REFERENCES public.offerings(id) ON DELETE CASCADE,  -- NULL = todas
    categories_count      integer NOT NULL CHECK (categories_count >= 1),
    price                 numeric NOT NULL CHECK (price >= 0),
    extra_category_price  numeric CHECK (extra_category_price >= 0),
    currency              text NOT NULL DEFAULT 'COP',
    is_active             boolean NOT NULL DEFAULT true,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ux_school_category_pricing
    ON public.school_category_pricing (school_id, COALESCE(offering_id,'00000000-0000-0000-0000-000000000000'::uuid), categories_count)
    WHERE is_active;
```

```sql
ALTER TABLE public.enrollments
    ADD COLUMN IF NOT EXISTS fee_is_manual boolean NOT NULL DEFAULT false;  -- D6
```

### 7.6 RPCs

| RPC | Firma | Qué hace |
|---|---|---|
| `resolve_athlete_fee` | `(p_enrollment_id uuid) → numeric` | `STABLE`. Aplica §5.2. No escribe |
| `recalc_enrollment_fee` | `(p_enrollment_id uuid) → numeric` | `SECURITY DEFINER`. Escribe `monthly_fee` salvo `fee_is_manual` |
| `recalc_school_fees` | `(p_school_id uuid, p_dry_run boolean) → jsonb` | Lote con preview. `SELECT … FOR UPDATE` sobre las inscripciones |
| `set_enrollment_categories` | `(p_enrollment_id uuid, p_categories jsonb) → jsonb` | Set completo, transaccional: agrega, cancela, fija principal, recalcula. Una sola llamada = un solo recálculo |
| `suggest_category_for_athlete` | `(p_school_id uuid, p_sport text, p_dob date, p_rama text) → setof` | Elegibilidad: qué categorías le corresponden |
| `map_school_to_event_category` | `(p_school_category_id uuid, p_event_id uuid) → uuid` | F5. Mapeo para delegaciones |

Todas con `SET search_path = pg_catalog, public, pg_temp` y `GRANT EXECUTE … TO authenticated`. Y **cada una valida al caller en su cuerpo**: `SECURITY DEFINER` salta la RLS, así que con `GRANT … TO authenticated` cualquiera puede invocarlas con cualquier UUID (lección H4 de [athlete-reports-module.md §10.1](athlete-reports-module.md)).

**Granularidad del recálculo (D15).** El trigger de R4 es **`AFTER … FOR EACH STATEMENT` con transition tables** (`REFERENCING NEW TABLE AS n OLD TABLE AS o`), no `FOR EACH ROW`. Con row-level, una edición que quita una categoría y agrega dos dispara `recalc_enrollment_fee` 3 veces: es idempotente, así que no es un bug, pero infla el trabajo y —más importante— vuelve ambiguo qué mide el test de concurrencia. Statement-level resuelve el set completo una vez, que es exactamente el contrato que promete `set_enrollment_categories`:

```sql
CREATE TRIGGER trg_enrollment_categories_recalc
    AFTER INSERT OR UPDATE OR DELETE ON public.enrollment_categories
    REFERENCING NEW TABLE AS n OLD TABLE AS o
    FOR EACH STATEMENT EXECUTE FUNCTION public.tg_recalc_enrollment_fees();
```

La función junta los `enrollment_id` distintos de `n` y `o` y llama `recalc_enrollment_fee` una vez por cada uno. Nota: se necesitan **tres** triggers (uno por evento) porque Postgres no admite `OLD TABLE` en `INSERT` ni `NEW TABLE` en `DELETE` en un trigger combinado.

### 7.7 Vista `school_athletes`

Se agregan **al final** dos columnas (Postgres solo permite añadir columnas al final en `CREATE OR REPLACE VIEW`; el orden y tipo de las 33 actuales no se toca):

```
categories_count  integer   -- cuántas categorías activas
categories        jsonb     -- [{id, code, name, rama, team_id, team_name, is_primary}]
```

Se resuelven con **un solo `LEFT JOIN LATERAL` con `jsonb_agg`** por rama, en línea con la reescritura de [20260730195021](../../supabase/migrations/20260730195021_school_athletes_lateral_rewrite.sql) (esta vista es el query #1 de la app — 4,98 % del tiempo de BD). **Obligatorio medir con `EXPLAIN (ANALYZE, BUFFERS)` como `authenticated`, no como `postgres`**, antes y después.

---

## 8. RLS

| Tabla | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| `sport_category_templates` | `authenticated` (ya existe) | `is_platform_admin()` (ya existe) |
| `school_categories` | miembros de la escuela + público si la escuela es pública | `is_school_admin(school_id) OR is_super_admin()` |
| `enrollment_categories` | admin/coach de la escuela; el propio atleta; el acudiente del menor | `is_school_admin(school_id) OR is_super_admin()` |
| `school_category_pricing` | **solo** admin de la escuela (es información comercial) | `is_school_admin(school_id) OR is_super_admin()` |

**Acudiente y atleta: helper, no join en la policy.** El `school_id` denormalizado resuelve admin y coach sin tocar `enrollments`, pero "el acudiente del menor" exige llegar de `enrollment_id` → `enrollments.child_id` → `children.parent_id`. Meter ese join en el `USING` significa ejecutarlo **por fila** desde la vista #1 de la app. Va en un helper `SECURITY DEFINER` cacheable, mismo patrón que [athlete-reports-module.md §9](athlete-reports-module.md):

```sql
CREATE FUNCTION public.can_view_enrollment(p_enrollment_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments e
    LEFT JOIN public.children c ON c.id = e.child_id
    WHERE e.id = p_enrollment_id
      AND (e.user_id = auth.uid() OR c.parent_id = auth.uid())
  );
$$;
GRANT EXECUTE ON FUNCTION public.can_view_enrollment(uuid) TO authenticated;
```

Policy de lectura: `is_school_admin(school_id) OR is_school_coach(school_id) OR can_view_enrollment(enrollment_id)`. El orden importa — el `OR` corta en el primer `true` y el caso admin/coach (el 95 % del tráfico) no llega a invocar el helper. **El costo de esta policy se mide en QA 10**, no se asume.

Reglas del repo que aplican aquí:
- **Sin self-recursion:** ninguna policy sobre `enrollment_categories` hace `SELECT FROM enrollment_categories`. Por eso `school_id` va denormalizado en la tabla — la policy resuelve con `is_school_admin(school_id)` directo, sin join a `enrollments`.
- **Nunca revocar** `is_school_admin()` / `is_super_admin()` al rol que las invoca desde las policies.
- La vista `school_athletes` es `security_invoker` — cada `LATERAL` nuevo arrastra su propio filtro RLS. **Contar buffers.**

---

## 9. BFF / API

| Método | Ruta | Nota |
|---|---|---|
| `GET` | `/api/v1/categories/templates?sport=` | Catálogo global para el wizard de adopción |
| `GET/POST/PATCH/DELETE` | `/api/v1/schools/:id/categories` | CRUD de `school_categories`. `DELETE` = soft (`is_active=false`); bloqueado si tiene equipos o inscripciones activas |
| `POST` | `/api/v1/schools/:id/categories/adopt` | Adopta N plantillas de golpe |
| `GET` | `/api/v1/schools/:id/categories/:cid/roster` | Atletas de la categoría, paginado |
| `PUT` | `/api/v1/enrollments/:id/categories` | Set completo → `set_enrollment_categories`. Devuelve `{ fee, warnings[] }` |
| `GET/PUT` | `/api/v1/schools/:id/category-pricing` | Tramos. `PUT` devuelve preview del impacto |
| `POST` | `/api/v1/schools/:id/fees/recalc` | Lote, con `dry_run` |
| `GET` | `/api/v1/schools/:id/categories/suggest?dob=&sport=&rama=` | Elegibilidad |

Cambios en rutas existentes:

- [`enrollments.ts`](../../bff/src/routes/enrollments.ts) — `POST` deja de poder crear una segunda fila activa (§4.3). El `team_id` entrante se traduce a `enrollment_categories`.
- [`school-delegations.route.ts`](../../bff/src/routes/school-delegations.route.ts) — F5: proponer categorías y pre-armar `event_teams`.
- `openapi.yaml` — documentar todo lo nuevo ([[reference_bff_openapi]]).

---

## 10. Frontend

| Pantalla | Cambio |
|---|---|
| **Config › Categorías** (nueva) | Wizard "adoptar del catálogo" por deporte + editor manual. Chips por rama, rangos de edad, cupos |
| [`TeamsPage.tsx`](../../frontend/src/pages/TeamsPage.tsx) | El equipo pasa a tener **selector de categoría** (obligatorio). `age_group` queda como campo legado, oculto |
| [`SchoolStudentsManagementPage.tsx`](../../frontend/src/pages/SchoolStudentsManagementPage.tsx) | Columna "Equipo" → **chips de categorías** (principal destacada). Editor con multi-select; al marcar la 2ª muestra en vivo *"2 categorías — $165.000"*. Filtro por categoría en la barra superior |
| [`PaymentsAutomationPage.tsx`](../../frontend/src/pages/PaymentsAutomationPage.tsx) | Pestaña **Equipos y Planes** gana la tabla de tramos de precio + botón "Recalcular cuotas" con preview |
| [`MyChildrenPage.tsx`](../../frontend/src/pages/MyChildrenPage.tsx) / [`MyEnrollmentsPage.tsx`](../../frontend/src/pages/MyEnrollmentsPage.tsx) | El acudiente/atleta ve sus categorías y el desglose del monto: *"Fútbol Sub-12 + Fútbol Sala Sub-12 · $165.000"* |
| [`SchoolDelegationDetailPage.tsx`](../../frontend/src/pages/school/SchoolDelegationDetailPage.tsx) | F5: "Traer mi categoría Sub-12 M" → arma el equipo del torneo con su roster |
| Carnets, asistencia, reportes | Muestran la categoría **principal** (sin cambios de layout) |

---

## 11. Migración de datos existentes

Riesgo alto: Dynasty tiene ~424 atletas y ~1.000 inscripciones activas. El backfill va **con preview y reversible**.

### 11.1–11.5 Categorías y roster (F2 / F3)

1. **Inferir categorías** desde `teams.name` + `teams.age_group` + `teams.sport` con reglas (`Sub-?\s*(\d+)`, `masculino|femenino|mixto`, niveles `L\d`). Lo que no matchee queda en un reporte para resolución manual — **nunca se adivina**.
2. **Crear `school_categories`** por escuela a partir de lo inferido (+ lo adoptado del catálogo).
3. **`teams.category_id`** = la categoría inferida. Los equipos sin match quedan `NULL` y la UI los marca "sin categoría".
4. **`enrollment_categories`**: una fila `is_primary=true` por cada `enrollments` activa con `team_id`. Las inscripciones sin equipo (solo plan) no generan fila.
5. **No recalcular cuotas en el backfill de F3.** Sin tramos configurados, `resolve_athlete_fee` devuelve exactamente lo de hoy. El precio multi-categoría se activa cuando la escuela configura los tramos.

### 11.6 Backfill de `fee_is_manual` — obligatorio en F4, antes de cualquier recálculo

`fee_is_manual` nace en `false` para las ~1.000 inscripciones activas. Entre ellas hay becas y descuentos que hoy viven en `monthly_fee` **indistinguibles** de una copia del precio del plan. Sin este paso, el primer `recalc_school_fees` las pisa todas.

Criterio: **marcar toda cuota que hoy no coincide con lo que la cascada produciría.**

```sql
UPDATE public.enrollments e
   SET fee_is_manual = true
 WHERE e.status = 'active'
   AND e.monthly_fee IS NOT NULL
   AND e.monthly_fee <> public.resolve_athlete_fee(e.id);
```

- Se corre **con los tramos ya configurados pero antes del primer recálculo** — si se corre antes de configurar tramos, `resolve_athlete_fee` devuelve el precio del plan y marca correctamente lo que difiere de él, que es la definición práctica de "override".
- **El error conservador es marcar de más.** Un falso positivo = una cuota que no se recalcula sola y hay que tocar a mano. Un falso negativo = una beca pisada, un padre cobrado de más y una conversación desagradable. Se prefiere el primero, siempre.
- Produce un **reporte** (`SELECT` con atleta, monto actual, monto que la cascada daría, diferencia) para que el admin revise los marcados y desmarque los que solo eran desactualización. Ese reporte es entregable de F4, no un extra.
- Aplica también a `monthly_fee = 0`: hoy un cero puede ser "exento" o "nadie lo configuró". Se marcan los ceros con inscripción activa y plan asignado (el cero contradice al plan → es deliberado).

### 11.7 Equipos sin categoría: crear las filas a posteriori

`enrollment_categories.category_id` es `NOT NULL`, así que los equipos que no matchearon (§11.3, `category_id NULL`) **no generan filas** para sus atletas. Esos atletas quedarían fuera de los filtros por categoría, del multi-select y de `categories_count` — y el reporte de no-matcheados sería un callejón sin salida.

Se cierra con una RPC que **F2 entrega junto con el reporte**:

```
backfill_team_categories(p_team_id uuid, p_dry_run boolean) → jsonb
```

Al setear `teams.category_id` sobre un equipo que no lo tenía, crea la fila `enrollment_categories` (`is_primary = true` si el atleta no tiene ninguna otra) para **todas** sus inscripciones activas. La UI la dispara desde el propio reporte: *"14 atletas sin categoría en este equipo → asignar"*. Sin `p_dry_run=false` explícito no escribe nada.

Se invoca también desde el `PATCH` del equipo, para que asignar categoría desde `TeamsPage` no deje el roster a medias.

### 11.8 Verificación

- Conteo de atletas por categoría contra el conteo por equipo previo.
- `SELECT` de diff de `monthly_fee` antes/después = **0 filas** (F3 no toca plata).
- Conteo de inscripciones activas **sin** fila en `enrollment_categories` = solo las que legítimamente no tienen equipo (solo plan). Cualquier otra es un hueco de §11.7.

> Gotchas del SQL Editor de Supabase ([[project_supabase_sql_editor_gotchas]]): sin `CREATE TEMP TABLE` (el pooler la pierde entre sentencias) ni `RAISE NOTICE` (no se ve). Los snapshots van en tablas normales `tmp_*` y el reporte final en un `SELECT`.

---

## 12. Decisiones

| # | Decisión | Recomendación | Estado |
|---|---|---|---|
| **D1** | ¿Categoría global compartida o por escuela? | **Ambas**: catálogo global de plantillas (`sport_category_templates`, super-admin) + instancia por escuela (`school_categories`) que se puede editar sin afectar a nadie más | 🟢 propuesta |
| **D2** | ¿Edad o año de nacimiento? | **Las dos**, por categoría (`age_rule`). Default `age_at_date`; las escuelas que compiten en liga cambian a `birth_year` | 🟢 propuesta |
| **D3** | ¿La multi-categoría son N inscripciones o 1 + tabla hija? | **1 inscripción + `enrollment_categories`.** N inscripciones rompería `school_athletes`, `open_month`, los 4 índices únicos y el guard del BFF | 🟢 propuesta |
| **D4** | ¿Máximo de categorías? | **3** por default, configurable en `school_settings.max_categories_per_athlete` | 🟢 propuesta |
| **D5** | Atleta fuera de rango de edad, ¿se bloquea? | **Advertencia con confirmación**, no bloqueo. Hay casos legítimos (atleta adelantado, autorización de la liga). Queda registrado en auditoría | 🟢 propuesta |
| **D6** | ¿El recálculo pisa la cuota manual (beca/descuento)? | **No.** `enrollments.fee_is_manual` la protege; la UI lo indica explícitamente | 🟢 propuesta |
| **D7** | Al cambiar de categorías a mitad de mes, ¿se reajusta el cobro? | **Los cobros ya emitidos no se tocan.** Si la categoría se agrega **antes** de que corra `open_month`, el mes en curso sale al precio nuevo (correcto y deseable); si se agrega después, el ajuste se ve en el siguiente. La regla es sobre el cobro, no sobre el calendario — evita tocar filas `paid`/`partial` y desalinear la conciliación | 🟢 **cerrada** |
| **D8** | ¿El precio es global o por deporte? | **Global-only en v1.** El caso estrella cruza deportes y "el tramo de qué deporte" no tiene respuesta definida. `sport` queda con `CHECK (sport IS NULL)`. v2 exige resolver primero la regla cross-sport. Ver §5.1 | 🟢 **cerrada** |
| **D9** | Categorías de peso en deportes de combate | El seed trae solo grupos etarios; los pesos los carga cada escuela (varían por federación y por año) | 🟢 propuesta |
| **D10** | ¿Se borran las categorías? | **Nunca hard delete.** Soft (`is_active=false`), bloqueado si tiene roster activo. [[feedback_user_handles_deletions]] | 🟢 propuesta |
| **D17** | ¿Para qué escuelas aplica el precio por cantidad? | **Solo las que configuren tramos. Hoy: Monster's Volley Club, y nadie más.** No hace falta feature flag: `school_category_pricing` es por `school_id` y `resolve_athlete_fee` cae al precio del plan si la escuela no tiene filas. **Escuela sin tramos = comportamiento actual bit a bit.** Monster's además **no tiene** hoy ningún atleta multi-inscrito (no aparece en el preflight), así que no hay backfill que hacer para ellos | 🟢 **cerrada** |
| **D18** | ¿Uno o dos cobros? | **Uno.** El tramo reemplaza al plan, no se suma. Sin estado de pago ni mora por categoría. Ver §5.3 — dos cobros obligarían a relajar `uniq_payment_active_period_per_*`, el índice que sostiene toda la protección anti-duplicado | 🟢 **cerrada** |
| **D19** | Inscripción activa sin equipo **ni** plan | **Inválida por definición del negocio** (las combinaciones válidas son equipo+plan, solo plan, solo equipo). Deja de depender del código: `CHECK (status <> 'active' OR team_id IS NOT NULL OR offering_plan_id IS NOT NULL)`. Orden de entrega en F0: arreglar el BFF → limpiar huérfanas → agregar el CHECK | 🟢 **cerrada** |
| **D11** | ¿Es addon pago o va en todos los tiers? | Catálogo + categoría única: **todos los tiers**. Multi-categoría + precio por cantidad: **Pro en adelante**. **Al bajar de tier se congela, no se recorta:** los atletas que ya tienen 2+ categorías las conservan y siguen cobrándose igual; lo que se bloquea es *agregar* nuevas y editar los tramos. Quitar categorías automáticamente cambiaría la cuota de familias que no hicieron nada — nunca | 🟢 **cerrada** |
| **D12** | ¿`teams.age_group` se elimina? | No. Se conserva como legado y respaldo del backfill; se oculta de la UI | 🟢 propuesta |
| **D13** | `n = 0` categorías billables (todas de cortesía) | **Cae al precio del plan** (paso 3), no a `$0`. Cortesía = "no suma el extra", no "no se cobra". Cuota cero es `monthly_fee = 0` + `fee_is_manual`, explícito y auditable. La UI lo dice con esas palabras | 🟢 propuesta |
| **D14** | ¿Se puede tener categorías de deportes distintos? | **Sí, es el caso de uso principal.** Por eso el pricing es global (D8) y `school_categories.sport` no restringe la composición del set | 🟢 propuesta |
| **D15** | Granularidad del trigger de recálculo | **`FOR EACH STATEMENT` con transition tables** (3 triggers, uno por evento). Row-level recalcularía 3–4 veces por edición y volvería ambiguo el test de concurrencia. Ver §7.6 | 🟢 propuesta |
| **D16** | La categoría principal no tiene equipo (o se borró): ¿qué pasa con `enrollments.team_id`? | **Queda `NULL`.** Conservar el anterior dejaría a la inscripción apuntando a un equipo del que el atleta ya no es parte — mentira silenciosa en carnets, asistencia y roster. Consecuencia asumida: para escuelas **sin plan** eso apaga el eslabón 4 de la cascada (`teams.price_monthly`) y la cuota caería a `children.monthly_fee` o 0. Se mitiga en el mismo trigger: si el nuevo `team_id` es `NULL` y el anterior tenía precio, **se congela** ese monto en `monthly_fee` con `fee_is_manual = true` y se notifica al admin. Nunca se baja una cuota a 0 en silencio | 🟢 propuesta |

---

## 13. Fases

Una rama por fase, revisión entre cada una.

### F0 — Cerrar el duplicado (independiente, va primero)
No depende de nada de este spec y arregla un bug activo. Plan detallado: [`docs/plan-f0-inscripciones-y-cobros-duplicados.md`](../plan-f0-inscripciones-y-cobros-duplicados.md).

1. **Ventana intra-sentencia:** `open_month` + `preview_open_month` con `DISTINCT ON (atleta)` (§0.3).
2. **Red de DB — verificar, no reescribir.** [`20260724000001`](../../supabase/migrations/20260724000001_payment_period_dedup_indexes.sql) **ya crea** los tres índices únicos (`per_child`, `per_adult`, `per_unreg`) y de paso cerró el hueco de estados (el índice viejo excluía `overdue`/`glosado`, así que un cobro dejaba de estar protegido al entrar en mora). Lo pendiente es **confirmar que está aplicada** en la Supabase compartida y cubrir los dos huecos residuales:
   - adultos legacy con `user_id NULL` y el adulto en `parent_id` → fuera del índice de adultos;
   - filas con `period_year/month NULL` (QR, checkout) → fuera de los tres índices.
3. **Guard del BFF:** `POST /enrollments` rechaza con `409` la creación de una segunda inscripción activa.
4. **Duplicados que ya existen** — el reporte no basta, hace falta criterio de merge. **Sobrevive la fila con plan**; si ninguna o ambas lo tienen, la **más antigua** (es la que carga el historial: pagos, asistencia, carnets). La descartada se `cancelled` conservando su `offering_plan_id` como registro. La cuota que gana es el `monthly_fee` no-cero más alto — al alza, nunca a la baja, porque bajarla en silencio es regalar plata. **Orden obligatorio:** cancelar la descartada **antes** de mover el plan a la que queda, o los índices únicos parciales revientan con `23505` (misma trampa que documenta [`20260730000000`](../../supabase/migrations/20260730000000_enrollment_no_split_rows.sql#L328-L338)).
5. **Tests de concurrencia:** dos `open_month` simultáneos ⇒ un cobro, **para los tres tipos de atleta** (menor, adulto, no registrado), no solo menores.

### F1 — Catálogo de categorías
- Extender `sport_category_templates` (§7.1) + seed de §3.
- Crear `school_categories` + RLS + CRUD BFF + página **Config › Categorías** + wizard de adopción.
- Sin impacto en cobros ni roster: la tabla nace vacía y nadie la lee todavía.

### F2 — El equipo pertenece a una categoría
- `teams.category_id` + versionar `teams.price_monthly` (drift).
- Backfill inferido con reporte de no-matcheados (§11.1–11.3).
- `TeamsPage` con selector de categoría.

### F3 — Multi-categoría
- `enrollment_categories` + índices + RLS + triggers R1/R3 + `set_enrollment_categories`.
- Backfill 1:1 desde `enrollments.team_id` (§11.4).
- `school_athletes` +2 columnas, con medición de buffers antes/después.
- UI: chips y multi-select en `SchoolStudentsManagementPage`.
- **Precio todavía no cambia** (sin tramos, resuelve como hoy).
- Tests de concurrencia: dos admins editando categorías del mismo atleta ⇒ una sola principal, un solo `monthly_fee`.

### F4 — Precio por cantidad
- `school_category_pricing` + `enrollments.fee_is_manual` + `resolve_athlete_fee` / `recalc_enrollment_fee` / `recalc_school_fees`.
- Trigger de recálculo en `enrollment_categories`.
- UI de tramos en `PaymentsAutomationPage` + recálculo en lote con preview.
- Desglose visible para el acudiente.
- **Aquí es donde $145.000 / $165.000 empieza a operar.**

### F5 — Ligas y torneos
- Versionar `event_categories_config` (drift).
- `map_school_to_event_category` + sugerencia de categorías al armar delegación + pre-armado de `event_teams`.
- Validación de elegibilidad (edad/año/peso/cupo) antes de inscribir.

### F6 — Reportes por categoría
- Asistencia, cartera, ocupación y rendimiento agrupados por categoría.
- Enganche con [[project_performance_metrics_model]] (benchmark dentro de categoría).

---

## 14. Riesgos

| Riesgo | Mitigación |
|---|---|
| **`school_athletes` se vuelve a poner lenta** — es el query #1 (4,98 % del tiempo de BD) y ya se reescribió por eso | Un solo `LATERAL` con `jsonb_agg`, índice parcial dedicado, `EXPLAIN (ANALYZE, BUFFERS)` como `authenticated` antes/después. Si sube el costo, la columna `categories` se sirve por RPC aparte y la vista solo lleva `categories_count` |
| **Doble cobro** al recalcular | El recálculo escribe en `enrollments`, nunca en `payments`. Los cobros emitidos no se tocan (D7). F0 cierra la ventana de `open_month` |
| **Se pisan cuotas especiales** (becas) | `fee_is_manual` (D6) + preview obligatorio del recálculo en lote |
| **Backfill mal inferido** | Nada se adivina: lo que no matchea queda `NULL` + reporte. Reversible (`age_group` intacto) |
| **RLS con recursión** en `enrollment_categories` | `school_id` denormalizado ⇒ la policy no hace join a `enrollments` |
| **Drift**: `teams.price_monthly` y `event_categories_config` existen en BD y no en el repo | Se versionan en F2 y F5 con `ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS` sobre la forma real |
| **BD compartida** dev/stg/prod ([[project_shared_supabase_env]]) | Todo backfill corre primero en `dry_run` y con conteos; el usuario ejecuta las escrituras masivas |

---

## 15. QA

Entrega full-stack por feature ([[feedback_full_stack_per_feature]]): DB + RLS + RPCs + BFF + API + Frontend + Auditoría + QA.

**Casos mínimos:**

1. Atleta con 1 categoría → $145.000. Se agrega la 2ª **antes** de `open_month` → el mes en curso sale a $165.000. Se agrega **después** → el cobro emitido queda intacto y el ajuste se ve en el siguiente (D7).
2. Se quita la 2ª categoría → vuelve a $145.000.
3. Atleta con `fee_is_manual=true` (beca $100.000) → agregar categoría **no** cambia el monto.
4. **Backfill de becas (§11.6):** escuela con 3 becas vigentes → tras marcar, `recalc_school_fees` deja las 3 intactas y solo mueve las demás. Con el paso omitido, las 3 se pisan — el test debe demostrar **ambos** comportamientos.
5. Dos admins agregan categorías al mismo atleta en paralelo → una sola principal, un solo recálculo, sin `23505`.
6. Dos `open_month` concurrentes → **un** cobro, para **menor, adulto y no registrado** (el caso adulto es el que históricamente no tenía red).
7. Atleta con todas las categorías en `billable=false` → cuota = precio del plan, no `$0` (D13).
8. Categoría principal sin equipo → `enrollments.team_id` queda `NULL` y la cuota se congela con `fee_is_manual`, no cae a 0 (D16).
9. Equipo sin categoría al que se le asigna una → `backfill_team_categories` crea las filas de sus atletas activos; `dry_run` no escribe (§11.7).
6. Atleta de 14 años en Sub-12 → warning, se puede confirmar, queda en auditoría.
7. Menor con acudiente ve el desglose; un acudiente ajeno no ve nada (RLS).
8. Coach ve el roster de sus categorías; no ve `school_category_pricing`.
9. Categoría con roster activo no se puede desactivar.
10. `school_athletes` con 424 atletas: buffers y `mean_exec_time` no empeoran (comparar `pg_stat_statements` antes/después).
11. Delegación a torneo: la Sub-12 M de la escuela mapea a la Sub-12 Masculino del evento y arma el equipo con los 14 atletas.

---

## 16. Referencias

- [`20260730000000_enrollment_no_split_rows.sql`](../../supabase/migrations/20260730000000_enrollment_no_split_rows.sql) — por qué hay una sola inscripción activa
- [`20260730195021_school_athletes_lateral_rewrite.sql`](../../supabase/migrations/20260730195021_school_athletes_lateral_rewrite.sql) — contrato y rendimiento de la vista
- [`20260724000002_open_month_rpc.sql`](../../supabase/migrations/20260724000002_open_month_rpc.sql) — generación canónica de cuotas
- [`20260716000001_sport_category_templates.sql`](../../supabase/migrations/20260716000001_sport_category_templates.sql) — catálogo actual (torneos)
- [`docs/specs/month-close-module.md`](month-close-module.md) — ciclo de mes; F0 de aquí toca el mismo `open_month`
- [`docs/migrations-workflow.md`](../migrations-workflow.md) — ledger, `npm run migrations:new`, gate de pre-commit
