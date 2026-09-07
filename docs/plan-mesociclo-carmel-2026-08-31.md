# Plan — Mesociclo (`PER-7`/`PER-8`), nivel de código

> **Plan, no migración.** Convención del repo: no se escribe SQL de migración hasta aprobar esto.
> Decisiones de producto ya resueltas en
> [`specs/periodizacion-microciclos-y-carga.md`](specs/periodizacion-microciclos-y-carga.md) §2
> (D2, D4, D9-D12) y verificadas contra la base viva en su §3.6. Este documento es el DDL/RLS/frontend
> concreto para ejecutar esas decisiones.

---

## 0. Alcance de este plan — qué entra y qué no

**Entra:** `PER-1` (microciclo + rótulos + índice MD), `PER-2` mínimo (sRPE → UA, sin monotonía/strain/
ACWR todavía — necesitan 28 días de historia que hoy no existen, `R2`), `PER-7` (mesociclo) y `PER-8`
(rúbrica, ambos modos de `D12`). Frontend de todo lo anterior sobre `TrainingPlansPage.tsx`.

**No entra, queda para después:** `PER-3` (alertas/validación de rótulo — necesita `PER-2` con datos
reales primero), el resto de `PER-0` (tablero táctico colgado de `training_slots` en vez de
`training_sessions`, ver `docs/ROADMAP.md`), `PER-4`/`PER-5`/`PER-6` (plantillas, export, vínculo con
Informe Mensual). Ninguno de estos bloquea lo de acá — son capas encima, no debajo.

---

## 1. DDL

### 1.1 `training_microcycles` (D1, con `school_id` explícito — D9's misma razón)

⚠️ **Orden de creación:** `training_mesocycles` (§1.3) va **antes** que esta tabla en el `.sql` real —
`mesocycle_id` la referencia. El orden de lectura de este plan es al revés (microciclo primero,
porque es lo que ya estaba semi-diseñado desde antes) pero el DDL tiene que crear `training_mesocycles`
primero, o agregar `mesocycle_id` con un `ALTER TABLE ... ADD COLUMN` después de que ambas existan.

```sql
CREATE TABLE public.training_microcycles (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    team_id     uuid        NOT NULL REFERENCES public.teams(id)   ON DELETE CASCADE,
    mesocycle_id uuid       REFERENCES public.training_mesocycles(id) ON DELETE SET NULL,  -- D10, opcional
    number      integer,
    starts_on   date        NOT NULL,
    ends_on     date        NOT NULL,
    objective   text,
    -- Cierre semanal (D11) — texto libre del coach, no derivado
    objective_compliance   text,
    collective_performance text,
    improvement_notes      text,
    created_by  uuid        NOT NULL REFERENCES public.profiles(id),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (team_id, starts_on)
);
```

### 1.2 `training_microcycle_days`

```sql
CREATE TABLE public.training_microcycle_days (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,  -- denormalizado, evita JOIN en RLS
    microcycle_id   uuid        NOT NULL REFERENCES public.training_microcycles(id) ON DELETE CASCADE,
    day_date        date        NOT NULL,
    day_type        text        NOT NULL CHECK (day_type = ANY (ARRAY['descanso','entrenamiento','partido','regenerativo','activacion'])),
    planned_rpe     smallint    CHECK (planned_rpe IS NULL OR planned_rpe BETWEEN 0 AND 10),
    planned_minutes integer     CHECK (planned_minutes IS NULL OR planned_minutes >= 0),
    focus           text,
    session_id           uuid  REFERENCES public.training_sessions(id) ON DELETE SET NULL,   -- liga a la sesión real (CAR-8)
    tournament_match_id  uuid  REFERENCES public.tournament_matches(id) ON DELETE SET NULL,  -- D2: fuente real si el partido es de un torneo en SportMaps
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (microcycle_id, day_date)
);
```

*Índice MD: **no se persiste** (D3). Se calcula en el frontend a partir de los `day_date` con
`day_type='partido'` de la lista ya traída — es aritmética de fechas pura, no necesita ida a la base.*

*Partido: si `tournament_match_id` está seteado, `day_date` se autocompleta desde
`tournament_matches.scheduled_at` (D2, camino "reusar"). Si no, se tipea a mano (D2, camino
"marcar el día" — el caso común, partidos externos como los del artefacto de Santa Fe).*

### 1.3 `training_mesocycles` (D9)

```sql
CREATE TABLE public.training_mesocycles (
    id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id                uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    team_id                  uuid        NOT NULL REFERENCES public.teams(id)   ON DELETE CASCADE,
    starts_on                date        NOT NULL,
    ends_on                  date        NOT NULL,
    n_sessions_planned       integer,
    session_duration_minutes integer,
    general_objective        text,
    game_model               text,
    evaluation_mode          text        NOT NULL DEFAULT 'team'
                              CHECK (evaluation_mode = ANY (ARRAY['team','individual'])),  -- D12: el coach elige, por mesociclo
    closing_review           jsonb,  -- {strengths, areas_to_improve, next_cycle_notes} — mismo patrón que evaluation de CAR-8
    created_by               uuid        NOT NULL REFERENCES public.profiles(id),
    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now()
);
```

### 1.4 `training_mesocycle_evaluations` — **solo modo `team`**

Modo `individual` **no usa esta tabla** — ver §1.5. Tenerla separada por modo, en vez de un
`subject_id` nullable ambiguo en una sola tabla, es a propósito: el modo se fija una vez por
mesociclo (`evaluation_mode`), y mezclar los dos ejes en una columna nullable es el mismo error de
`payments.status` que `CLAUDE.md` ya cita.

```sql
CREATE TABLE public.training_mesocycle_evaluations (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id     uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    mesocycle_id  uuid        NOT NULL REFERENCES public.training_mesocycles(id) ON DELETE CASCADE,
    indicator     text        NOT NULL CHECK (indicator = ANY (ARRAY[
                              'tecnica_individual','toma_decisiones','principios_juego',
                              'condicion_fisica','comportamiento_colectivo','rendimiento_competitivo'])),
    checkpoint    text        NOT NULL CHECK (checkpoint = ANY (ARRAY['inicial','semana_2','semana_3','semana_4','final'])),
    score         smallint    NOT NULL CHECK (score BETWEEN 1 AND 10),
    observations  text,
    created_by    uuid        NOT NULL REFERENCES public.profiles(id),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (mesocycle_id, indicator, checkpoint)
);
```

### 1.5 Modo `individual` — cero tablas nuevas, reusa `performance_entries`

6 `sport_metric_definitions` nuevas, prefijadas `mesociclo_` para no repetir la colisión de
`duelos_ganados` (§3.6 del spec) con ninguna métrica existente o futura:

```sql
INSERT INTO public.sport_metric_definitions
    (sport_category_id, metric_key, display_name, data_type, category, min_value, max_value, higher_is_better)
VALUES
    (v_sport_id, 'mesociclo_tecnica_individual',       'Técnica individual (mesociclo)',        'rating', 'technical', 1, 10, true),
    (v_sport_id, 'mesociclo_toma_decisiones',          'Toma de decisiones (mesociclo)',        'rating', 'tactical',  1, 10, true),
    (v_sport_id, 'mesociclo_principios_juego',         'Principios de juego (mesociclo)',       'rating', 'tactical',  1, 10, true),
    (v_sport_id, 'mesociclo_condicion_fisica',         'Condición física (mesociclo)',          'rating', 'physical',  1, 10, true),
    (v_sport_id, 'mesociclo_comportamiento_colectivo', 'Comportamiento colectivo (mesociclo)',  'rating', 'tactical',  1, 10, true),
    (v_sport_id, 'mesociclo_rendimiento_competitivo',  'Rendimiento competitivo (mesociclo)',   'rating', 'physical',  1, 10, true)
ON CONFLICT (sport_category_id, metric_key) DO NOTHING;
```

**Verificado 2026-08-31 contra `20260731154626_regularize_performance_schema.sql:138-158`:** el
`CHECK` real de `category` es `physical|technical|tactical|attendance` (o `NULL`) — las 6 filas de
arriba ya usan solo valores válidos (`comportamiento_colectivo` se reasignó a `tactical`, más cercano
que `physical`; `rendimiento_competitivo` no tiene mejor encaje que `physical`, es aproximado a
sabiendas). El `UNIQUE (sport_category_id, metric_key)` que sostiene el `ON CONFLICT` también está
confirmado en esa misma migración (línea 157) — es la misma restricción contra la que chocó
`duelos_ganados`, ya demostrada en producción.

Cada entrada de la rúbrica individual, por atleta y por corte, es una fila de
`performance_entries` ya existente:

```sql
INSERT INTO performance_entries (school_id, subject_type, subject_id, metric_key, value, context_type, context_id, recorded_by, notes)
VALUES ($school_id, $subject_type, $subject_id, 'mesociclo_tecnica_individual', $score, 'evaluation', $mesocycle_id, $coach_id, $observations);
```

`context_type='evaluation'` ya existe en el `CHECK` desde que se creó la tabla y **nunca se usó**
(verificado 2026-08-31, §3.6). Esto es lo que alimenta el Informe Mensual del Atleta sin construir
nada — pero **no está probado en producción**, es la primera vez que se escribe con ese
`context_type`.

### 1.6 `evaluation.rpe` — dentro del jsonb que `CAR-8` ya creó, no columna nueva

`training_sessions.evaluation` (jsonb, `CAR-8`) suma una clave más: `rpe smallint 0-10`, la carga
real de la sesión (D4, sRPE de Foster). No se toca el DDL de `training_sessions` — es un campo más
dentro del jsonb existente, mismo patrón que `component` en `session_blocks` (spec §3.5).

UA se calcula, no se guarda: `evaluation->>'rpe' × Σ(session_blocks[].minutes)`, vista
`v_session_load` agrupable por semana desde `session_date` — no depende de que exista el
microciclo como entidad para el cálculo, solo para el nombre/objetivo (mismo punto ya señalado en
la conversación).

---

## 2. RLS y grants

Mismo patrón que `futbol_metricas_alineacion` (`CAR-8`/`PER-0` parcial): `user_staff_school_ids()`
para las cuatro operaciones — es contenido operativo de coach/admin, nunca de padre/atleta (D7),
y no otorga permisos, así que no aplica `user_admin_school_ids()`.

```sql
-- Mismas 4 policies (select/insert/update/delete) en cada una de las 4 tablas nuevas:
CREATE POLICY "<tabla>_select" ON public.<tabla>
    FOR SELECT USING (school_id = ANY (public.user_staff_school_ids()));
CREATE POLICY "<tabla>_insert" ON public.<tabla>
    FOR INSERT WITH CHECK (school_id = ANY (public.user_staff_school_ids()));
CREATE POLICY "<tabla>_update" ON public.<tabla>
    FOR UPDATE USING (school_id = ANY (public.user_staff_school_ids()))
    WITH CHECK (school_id = ANY (public.user_staff_school_ids()));
CREATE POLICY "<tabla>_delete" ON public.<tabla>
    FOR DELETE USING (school_id = ANY (public.user_staff_school_ids()));
```

`GRANT SELECT, INSERT, UPDATE, DELETE ON <las 4 tablas> TO authenticated, service_role;` — **sin
`anon`**, igual que `CAR-8` y `futbol_metricas_alineacion`. `training_mesocycle_evaluations` en modo
`individual` no se usa — sus policies existen igual por si el mismo club cambia de modo entre
mesociclos.

Sin RPCs nuevas: todo el CRUD es `INSERT`/`UPDATE`/`DELETE` directo desde el frontend vía RLS, **igual
que `training_sessions` hoy** (`TrainingPlansPage.tsx` escribe `supabase.from('training_sessions')`
directo, no por BFF). Es una desviación consciente del patrón idealizado de `CLAUDE.md`
("frontend escribe vía BFF"), pero es el patrón *real* que `CAR-8` ya usa para esta misma familia de
datos — mantenerlo consistente pesa más que corregirlo acá.

---

## 3. Frontend — sobre `TrainingPlansPage.tsx`, sin tocar `SessionFormDialog.tsx`

| Pieza | Qué hace | Dónde |
|---|---|---|
| `useMesocycles(teamId)` | Query del mesociclo vigente del equipo (`starts_on <= hoy <= ends_on`) | hook nuevo, mismo patrón que las queries inline que ya hay en la page |
| `useMicrocycles(mesocycleId)` | Query de las semanas + sus días, con `session_id` resuelto contra `training_sessions` | ídem |
| `MesocycleFormDialog.tsx` | Crear/editar mesociclo: período, objetivo, modelo de juego, nº sesiones, duración, toggle `evaluation_mode` | componente nuevo, mismo molde que `SessionFormDialog` |
| **Card "Mesociclo actual"** | Reemplaza el hueco arriba de la lista de sesiones. Colapsada si existe, botón "Crear" si no | edición en `TrainingPlansPage.tsx` |
| **Lista de sesiones → agrupada por semana** | `Accordion` por microciclo (Semana 1-4). Cada fila: fecha, `day_type`, índice MD (badge, calculado en cliente), objetivo, intensidad planeada. Click abre `SessionFormDialog` sin cambios | reemplaza el `sessions.map(...)` plano (líneas 288-469 hoy) — **solo cuando hay mesociclo activo**; si no, sigue la lista plana de hoy |
| **Cierre semanal** | En el header de cada semana: inputs de `objective_compliance`/`collective_performance`/`improvement_notes`, más UA/asistencia calculados (no editables) | mismo patrón visual que el bloque de evaluación de sesión ya existente (líneas 413-465) |
| **Cierre de mesociclo** | Fortalezas / a mejorar / notas — reusa el mismo patrón de estrellas+textarea | debajo del accordion |
| `MesocycleRubricTable.tsx` | Tabla 6×5. Si `evaluation_mode='team'`: una fila por indicador, escribe `training_mesocycle_evaluations`. Si `'individual'`: una tabla por atleta del `roster` **ya cargado** en la page (cero fetch nuevo), escribe `performance_entries` | componente nuevo |

---

## 4. Orden de ejecución

1. Migración única (DDL §1 + RLS §2 + seed §1.5), `npm run migrations:new -- mesociclo-carmel`.
   Verificar con `npm run seguridad:invariantes` antes de dar por cerrada la parte de RLS.
2. Frontend (§3) en el mismo commit — mismo patrón que `CAR-8` (`a550d40f` trajo DB+frontend juntos).
3. `docs/ROADMAP.md`: mover `PER-7`/`PER-8` de 🔵/⚪ a ✅ cuando esté aplicado y verificado contra la
   base viva (no contra el repo — regla de siempre).

## 5. Verificación contra la base viva y contra lo que está en vuelo (2026-08-31)

Antes de dar este plan por listo, se chequeó — read-only, por REST con la service key de
`bff/.env` — que nada de lo propuesto choque con lo que ya existe o con lo que hay sin commitear en
el working tree:

| Se verificó | Resultado |
|---|---|
| `user_staff_school_ids()` y `user_school_ids()` — ¿existen y son invocables? | ✅ Ambas responden `200` vía `rpc/`, devuelven array (vacío bajo `service_role`, esperado — no hay `auth.uid()` en ese contexto). No son solo texto de `CLAUDE.md`, están vivas |
| `sport_metric_definitions` — `CHECK` de `category` y `UNIQUE (sport_category_id, metric_key)` | ✅ Confirmados en `20260731154626_regularize_performance_schema.sql:138-158`. Valores válidos: `physical\|technical\|tactical\|attendance` — ajustado §1.5 arriba |
| `performance_entries`/`sport_metric_definitions` — ¿siguen con `GRANT ALL` a `anon`? (gap conocido en memoria del proyecto) | ✅ **Ya cerrado** — `20260828224353_endurecer_grants_anon_metricas.sql`, aplicado. `sport_metric_definitions_select_all` quedó restringida a `authenticated`; las 6 filas nuevas de §1.5 heredan esa misma policy sin tocar nada |
| Nombres de las 4 tablas nuevas — ¿colisionan con algo ya escrito, del repo o de una migración sin commitear? | ✅ Cero coincidencias en todo el repo (`training_mesocycles`, `training_microcycles`, `training_microcycle_days`, `training_mesocycle_evaluations`) |
| Las 9 migraciones sin commitear en el working tree (`20260829020235`...`20260829121405`, `trial_class_self_service`) — ¿tocan `training_sessions`, `performance_entries` o `sport_metric_definitions`? | ✅ Ninguna las toca — son de reservas públicas de clases de prueba, eje distinto |
| `migrations_ledger.json` — `head` actual | `20260831133329`, 467 migraciones. Informativo: `npm run migrations:new` reserva la próxima versión sola, no hace falta calcularla a mano |
| Orden de `CREATE TABLE` — ¿`training_microcycles.mesocycle_id` puede referenciar `training_mesocycles` si esta última no existe todavía? | ⚠️ **Encontrado y corregido en este plan** (§1.1): el DDL real tiene que crear `training_mesocycles` primero, o agregar la columna por `ALTER TABLE` después. El plan tal como estaba escrito antes de esta pasada tenía el orden de exposición al revés del orden de ejecución — no afectaba el diseño, sí habría fallado si alguien copiaba el `.sql` en el orden en que estaba redactado |

**No se dejó nada de lo ya construido en un estado más débil:** las 4 tablas son aditivas, ninguna
`ALTER` toca una tabla con datos reales salvo `sport_metric_definitions` (solo `INSERT`, con
`ON CONFLICT DO NOTHING` — no puede pisar ninguna de las 498 filas ni las definiciones existentes) y
`training_sessions.evaluation` (una clave más en un jsonb, no una migración de columna). Nada de esto
toca RLS de tablas existentes ni revoca ningún grant ya dado.

## 6. Riesgos que ya se conocen (heredados de la conversación)

- **Cero uso real hoy en todo el módulo de fútbol** (§3.6 del spec) — esto no lo arregla el código,
  hay que confirmar con Carmel quién va a cargar el primer mesociclo real.
- `individual` (§1.5) usa un camino de `performance_entries` (`context_type='evaluation'`)
  **nunca antes ejercido en producción** — probar con un mesociclo de prueba antes de ofrecerlo como
  opción por defecto a un cliente real.
- El índice MD calculado en cliente asume que todos los `training_microcycle_days` de la semana ya
  están cargados en memoria — si en el futuro se pagina, hay que recalcular server-side.
