# Plan F1 — Catálogo de categorías deportivas

**Producto:** SportMaps · **Fecha:** 2026-07-31 · **Rama:** `develop`
**Estado:** 🟡 plan propuesto — **pendiente de aprobación antes de escribir migraciones**
**Spec:** [`docs/specs/sport-categories-and-multi-category.md`](specs/sport-categories-and-multi-category.md) §3, §7.1, §7.2

F1 crea el catálogo y nada más. **No toca inscripciones, ni cobros, ni la vista `school_athletes`.** Las tablas nacen vacías y ningún flujo existente las lee, así que el riesgo sobre datos productivos es nulo. Es lo único de todo el roadmap que se puede entregar sin esperar a que ninguna escuela conteste nada.

---

## 1. Qué entrega

1. El catálogo global (`sport_category_templates`) extendido y con seed de los deportes base del spec §3.
2. `school_categories` — el catálogo propio de cada escuela, con RLS.
3. CRUD en el BFF + wizard "adoptar del catálogo" en una página nueva **Config › Categorías**.
4. `suggest_category_for_athlete` — dada la fecha de nacimiento y el deporte, qué categorías le corresponden.

## 2. Qué NO toca

| | Por qué importa |
|---|---|
| `enrollments` | F1 no sabe que existen. La multi-categoría es F3 |
| `payments`, `open_month`, crons | El precio por cantidad es F4 |
| `school_athletes` | Es el query #1 de la app; no se le agrega nada hasta F3 |
| `teams` | `category_id` entra en F2 |
| El editor de torneos | Único consumidor actual de `sport_category_templates`. Ver §4 |

---

## 3. Preflight

Ya nos pasó dos veces en esta sesión que la BD no coincide con lo que el repo dice. Antes de escribir, verificar:

```sql
-- P1. ¿Existe la tabla y con qué columnas? (drift)
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='sport_category_templates'
 ORDER BY ordinal_position;

-- P2. ¿Qué trae el seed hoy, y lo modificó alguien?
SELECT sport, count(*) AS filas, count(*) FILTER (WHERE NOT is_active) AS inactivas
  FROM public.sport_category_templates GROUP BY sport ORDER BY sport;

-- P3. ¿Alguien ya usa estas plantillas en eventos reales?
SELECT count(*) AS categorias_de_eventos FROM public.event_categories_config;

-- P4. ¿Existe ya algo llamado school_categories? (net-new esperado: 0 filas)
SELECT table_name FROM information_schema.tables
 WHERE table_schema='public' AND table_name IN ('school_categories','enrollment_categories','school_category_pricing');
```

**Puertas:** si P1 muestra columnas que la migración `20260716000001` no crea, hay drift → la migración de F1 usa `ADD COLUMN IF NOT EXISTS` sobre la forma real y se documenta el hallazgo. Si P4 devuelve algo, parar: alguien ya creó tablas con esos nombres.

---

## 4. Migración 1 — extender el catálogo global

`npm run migrations:new -- sport-category-templates-extend-and-seed`

```sql
ALTER TABLE public.sport_category_templates
    ADD COLUMN IF NOT EXISTS code          text,
    ADD COLUMN IF NOT EXISTS scope         text NOT NULL DEFAULT 'both'
        CHECK (scope IN ('school','tournament','both')),
    ADD COLUMN IF NOT EXISTS axis          text NOT NULL DEFAULT 'age'
        CHECK (axis IN ('age','weight','belt','level','division','none')),
    ADD COLUMN IF NOT EXISTS weight_min_kg numeric,
    ADD COLUMN IF NOT EXISTS weight_max_kg numeric,
    ADD COLUMN IF NOT EXISTS belt          text,
    ADD COLUMN IF NOT EXISTS age_rule      text NOT NULL DEFAULT 'age_at_date'
        CHECK (age_rule IN ('age_at_date','birth_year'));
```

Más el seed de [spec §3](specs/sport-categories-and-multi-category.md) con `ON CONFLICT DO NOTHING`.

**Compatibilidad con torneos — la parte delicada.** Esta tabla ya la usa el editor de torneos. Las siete columnas son *nullable* o traen `DEFAULT`, así que ningún `INSERT` ni `SELECT` existente se rompe. Y `scope` entra con default `'both'`: las 38 filas actuales quedan visibles para torneos **y** para escuelas, que es el comportamiento de hoy más el nuevo. **Nada del editor de torneos cambia.**

**Backfill de `code`:** las filas existentes no lo tienen. Se deriva de `category` normalizada (`'Sub-12' → 'SUB12'`, `'Nivel 2' → 'L2'`) en la misma migración, con un `UPDATE … WHERE code IS NULL`. No se hace `NOT NULL` todavía: primero validar que el derivado no genere colisiones.

---

## 5. Migración 2 — `school_categories`

`npm run migrations:new -- school-categories`

DDL en [spec §7.2](specs/sport-categories-and-multi-category.md). Puntos que el plan fija:

- **Sin `CREATE TYPE`.** `axis`, `age_rule` y `rama` van con `text + CHECK` (convención del repo; historia de `payments.status`).
- **`search_path`** en toda función nueva: `SET search_path = pg_catalog, public, pg_temp`.
- **`GRANT EXECUTE`** explícito por RPC a `authenticated`.
- **FKs de negocio** a `public.schools(id)` y `public.school_branches(id)`, no a `auth.*`.
- Índice único parcial `(school_id, lower(sport), upper(code), rama) WHERE is_active` — permite recrear una categoría dada de baja sin chocar.

### RLS, línea por línea

| Operación | Policy |
|---|---|
| `SELECT` | `is_school_admin(school_id) OR is_school_coach(school_id) OR EXISTS(school_members activo)`. El coach necesita leerlas para ver su roster |
| `INSERT/UPDATE/DELETE` | `is_school_admin(school_id) OR is_super_admin()` |

Sin self-recursion: ninguna policy hace `SELECT FROM school_categories`. No se revoca `EXECUTE` de `is_school_admin` / `is_super_admin` a `authenticated`.

**`DELETE` no se expone:** la baja es `is_active = false`, y se bloquea si la categoría tiene equipos o inscripciones colgando (relevante desde F2; en F1 no hay nada que colgar todavía).

---

## 6. RPCs

| RPC | Qué hace |
|---|---|
| `adopt_sport_category_templates(p_school_id uuid, p_template_ids uuid[])` → `jsonb` | Copia N plantillas a `school_categories`. Idempotente: las ya adoptadas se saltan por el índice único. Valida `is_school_admin` **dentro del cuerpo** |
| `suggest_category_for_athlete(p_school_id, p_sport, p_dob date, p_rama text)` → `setof` | Devuelve las categorías donde encaja, resolviendo por `age_rule`: `birth_year` compara año de nacimiento; `age_at_date` compara edad cumplida al 31-dic |

**Autorización dentro de cada función, sin excepción.** `SECURITY DEFINER` salta la RLS: con `GRANT … TO authenticated`, cualquiera puede invocarlas con cualquier `school_id`. Es la lección H4 del spec de informes y aplica igual aquí.

---

## 7. BFF

| Método | Ruta |
|---|---|
| `GET` | `/api/v1/categories/templates?sport=` |
| `GET/POST/PATCH` | `/api/v1/schools/:id/categories` |
| `POST` | `/api/v1/schools/:id/categories/adopt` |
| `GET` | `/api/v1/schools/:id/categories/suggest?dob=&sport=&rama=` |

Zod en todas. `DELETE` responde `405` — la baja es `PATCH { is_active: false }`. Documentar en `docs/api/openapi.yaml`.

---

## 8. Frontend — Config › Categorías

Página nueva. Dos modos:

1. **Adoptar del catálogo** — elige deporte, ve las plantillas con sus rangos, marca las que usa, un clic. Es el camino esperado para el 90 %.
2. **Manual** — para lo que el catálogo no cubre (pesos de combate, niveles propios).

Listado con chips por rama, rango de edad o peso, y cupo `team_min`–`team_max`. Sin badges de conteo todavía: no hay atletas asociados hasta F2/F3.

---

## 9. Orden de ejecución

1. Preflight §3 → confirmar drift y que no exista nada con esos nombres.
2. Migración 1 (extensión + seed) → verificar que el editor de torneos sigue funcionando: crear un torneo de prueba con categorías.
3. Migración 2 (`school_categories` + RLS).
4. Pruebas de RLS **por rol**: admin de la escuela A no ve ni escribe categorías de la escuela B; coach lee y no escribe; padre no lee nada; RPC invocada con un `school_id` ajeno responde error.
5. BFF + OpenAPI.
6. Frontend.
7. Adoptar el catálogo real con **una** escuela primero (Monster's, que es quien va a usar esto) antes de anunciarlo.

---

## 10. Riesgos

| Riesgo | Mitigación |
|---|---|
| Romper el editor de torneos, único consumidor actual del catálogo | Todas las columnas nuevas son nullable o con default; `scope='both'` conserva el comportamiento. Prueba explícita en el paso 2 |
| Drift en `sport_category_templates` | Preflight P1; la migración se escribe contra la forma real, no contra la del repo |
| `code` derivado colisiona | No se pone `NOT NULL` en F1; se valida con datos antes de endurecerlo |
| RPC `SECURITY DEFINER` sin check interno | Autorización dentro del cuerpo de cada función + test de permisos por RPC, no solo por tabla |
| Que F1 se vuelva "F1 + un poquito de F3" | Regla dura: si un cambio toca `enrollments`, `payments` o `school_athletes`, **no es F1** |

---

## 11. Lo que queda fuera

**F2** — `teams.category_id`, versionar `teams.price_monthly` (drift), backfill inferido desde `age_group`, `backfill_team_categories`, decidir qué pasa con `children.team_id` (columna muerta que `accept_invitation_pro` todavía escribe).
**F3** — `enrollment_categories`, multi-categoría, columnas nuevas en `school_athletes`. **Prerrequisito duro:** el guard del editor de atletas (ya aplicado en `students.ts`) y el `CHECK` de D19. Ese editor es el mismo que va a manejar categorías; si puede dejar huérfanas, dejará categorías huérfanas.
**F4** — `school_category_pricing`, `resolve_athlete_fee`, `fee_is_manual`, precio por cantidad para Monster's.
**F5** — mapeo a `event_categories_config`, elegibilidad, delegaciones.
