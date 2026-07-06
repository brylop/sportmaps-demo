# SportMaps — Complementos al Sistema Universal de Métricas de Rendimiento

> **Spec aditiva (hand-off a desarrollo).**
> Parte de lo **ya implementado** (`sport_metric_definitions`, `performance_entries`, `competition_results`, reconciliación de catálogo de deportes) y le suma, **sin romper nada**, lo mejor de nuestro diseño de 2 capas: `higher_is_better`, personalización/ponderación por escuela, normalización 0-100, índice compuesto + mejora (Δ), benchmark entre escuelas e ingesta de dispositivos.
>
> Fecha: 2026-07-06 · Estado: propuesta, pendiente de implementar.
> Documento hermano: `docs/performance-metrics-spec.md` (diseño original de 2 capas). Este documento **reconcilia** ese diseño con lo que finalmente se construyó.

---

## 0. Principio y reglas (no negociables)

- **Todo es aditivo.** No se migran ni reescriben `sport_metric_definitions` / `performance_entries` / `competition_results` ni las tablas legacy (`academic_progress`, `athlete_stats`). Solo se **añaden** columnas, tablas, vistas, RPCs y validaciones.
- **Migraciones inmutables**: nada se edita en `supabase/migrations/`; cada cosa va en migración nueva con timestamp posterior. (Sí está permitido `DROP CONSTRAINT` / `ALTER` desde una migración **nueva** — la inmutabilidad aplica a los archivos, no al schema.)
- `search_path = pg_catalog, public, pg_temp` en toda `CREATE FUNCTION`.
- `SECURITY DEFINER` + `GRANT EXECUTE` explícito; helpers de RLS nunca se revocan al rol que las invoca.
- RLS sin self-recursion (usar `is_school_admin(school_id)`, `is_super_admin()`, `is_school_member(school_id)`).
- Catálogo de roles usa `'school_admin'` (NO `'admin'`).
- Cada complemento se entrega full-stack: **DB + RLS + RPC + BFF + Frontend + Auditoría + QA**.

---

## 1. Estado base (lo que YA existe) vs. lo que falta

### Base implementada
- `sport_metric_definitions (id, sport_category_id, metric_key, display_name, data_type∈{numeric,duration,count,rating}, unit, category∈{physical,technical,tactical,attendance}, is_active)` — `UNIQUE(sport_category_id, metric_key)`.
- `performance_entries (id, school_id, subject_type∈{profile,child,unregistered}, subject_id, metric_key, value numeric, context_type∈{manual,competition,evaluation,session}, context_id, recorded_by, recorded_at, notes)`.
- `competition_results` — resultados con puntaje de juez / tiempo-posición / método de victoria (separada de `match_results`).
- Catálogo: `sports_categories` sincronizado (79 LATAM), `schools.category_id` backfilleado + trigger auto-resolve, dedup de categorías legacy.
- BFF `school/performance.ts` + `athlete/performance.ts`; frontend `performanceQueries`, `usePerformanceData`, `PerformanceEntryModal`, `PerformanceEvolutionSection`.

### Brechas frente al objetivo de negocio ("cada escuela pondera su estándar → consolidar mejora + benchmark")
| # | Brecha | Impacto | Complemento |
|---|---|---|---|
| G1 | No hay `higher_is_better` | Los tiempos/pesos rankean **al revés**; imposible normalizar | **C-A** |
| G2 | No hay rango (`min/max/target`) | No se puede normalizar 0-100 | **C-A** |
| G3 | No hay capa por escuela (pesos/metas propias) | El core del negocio (ponderar) no existe | **C-B** |
| G4 | No hay métricas custom por escuela | Escuela no puede medir lo suyo | **C-C** |
| G5 | `metric_key` es texto sin FK (solo valida el BFF) | Riesgo de claves huérfanas/typos en BD | **C-D** |
| G6 | `value` solo numérico | Sin lugar para boolean/enum/categórico | **C-E** |
| G7 | No hay normalización / índice / Δ mejora | Sin dashboards de rendimiento reales | **C-F** |
| G8 | No hay benchmark entre escuelas | Falta el diferencial SportMaps | **C-G** |
| G9 | No hay ingesta de dispositivos | Sin cronómetros/wearables | **C-H** |
| G10 | `performance_entries` vive en paralelo a legacy | Datos del atleta **fragmentados** en 2 sitios | **C-I** |
| G11 | `subject_type='unregistered'` sin tabla que lo defina | `subject_id` apunta a la nada | **C-J** |
| G12 | Pendientes explícitos del spec base | Deuda anotada | **C-K** |

---

## 2. Complementos (priorizados)

### P0 — Robustez de datos (barato, desbloquea el resto)

#### C-A · `higher_is_better` + rango de normalización
```sql
-- Migración: 2026XXXX_metric_defs_add_normalization.sql
ALTER TABLE public.sport_metric_definitions
  ADD COLUMN higher_is_better boolean NOT NULL DEFAULT true,
  ADD COLUMN min_value        numeric,
  ADD COLUMN max_value        numeric,
  ADD COLUMN target_value     numeric,
  ADD COLUMN display_order    int NOT NULL DEFAULT 0;

-- Data-fix idempotente para el seed existente (menos-es-mejor):
UPDATE public.sport_metric_definitions
   SET higher_is_better = false
 WHERE data_type = 'duration'                     -- mejor tiempo/vuelta, 50m, etc.
    OR metric_key IN ('best_time','best_lap','weigh_in_weight');  -- ajustar a keys reales del seed
```
> `higher_is_better` es **el pivote**. Sin él, "mejor tiempo" y "peso en pesaje" se ordenan invertidos. Revisar uno por uno los 8 seeds contra la key real.

#### C-D · Integridad referencial de `metric_key`
`performance_entries.metric_key` no tiene FK (solo lo valida el BFF). Endurecer en BD con trigger, respetando que la key puede ser estándar del deporte de la escuela **o** custom de la escuela (ver C-C):
```sql
-- Migración: 2026XXXX_performance_entries_validate_key.sql
CREATE OR REPLACE FUNCTION public.fn_validate_performance_metric_key()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_cat uuid;
BEGIN
  SELECT category_id INTO v_cat FROM public.schools WHERE id = NEW.school_id;
  IF NOT EXISTS (
    SELECT 1 FROM public.sport_metric_definitions d
     WHERE d.metric_key = NEW.metric_key
       AND d.is_active
       AND (d.sport_category_id = v_cat OR d.sport_category_id IS NULL)   -- estándar del deporte o transversal
       AND (d.school_id IS NULL OR d.school_id = NEW.school_id)           -- global o custom de la escuela
  ) THEN
    RAISE EXCEPTION 'metric_key % no válida para la escuela % (deporte %)', NEW.metric_key, NEW.school_id, v_cat;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_validate_performance_metric_key
  BEFORE INSERT OR UPDATE OF metric_key ON public.performance_entries
  FOR EACH ROW EXECUTE FUNCTION public.fn_validate_performance_metric_key();
```

#### C-E · Valores no numéricos (boolean/enum/categórico)
`value numeric` no cubre "lo logra / no lo logra" ni categorías. Aditivo:
```sql
-- Migración: 2026XXXX_metrics_non_numeric.sql
-- 1) ampliar tipos permitidos en definiciones (drop+recreate del CHECK en migración nueva)
ALTER TABLE public.sport_metric_definitions DROP CONSTRAINT <check_data_type>;   -- descubrir nombre real
ALTER TABLE public.sport_metric_definitions
  ADD CONSTRAINT sport_metric_definitions_data_type_chk
  CHECK (data_type IN ('numeric','duration','count','rating','boolean','enum','scale_0_100'));
ALTER TABLE public.sport_metric_definitions ADD COLUMN options jsonb;  -- para enum: ["A","B","C"]

-- 2) columna de valor textual en entries (numeric sigue para lo numérico)
ALTER TABLE public.performance_entries
  ADD COLUMN value_text text,
  ADD COLUMN value_meta jsonb;
```

#### C-J · Tabla compañera para sujetos no registrados
`subject_type='unregistered'` necesita a qué apuntar (tryouts, invitados, prospectos):
```sql
-- Migración: 2026XXXX_unregistered_subjects.sql
CREATE TABLE public.unregistered_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  birthdate date,
  external_ref text,               -- para conciliar con dispositivos/planillas
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- RLS: school_admin/coach de la escuela. subject_id de performance_entries resuelve aquí cuando subject_type='unregistered'.
```

---

### P1 — Objetivo de negocio: ponderación por escuela + cálculo

#### C-B · Capa por escuela — `school_metric_settings` (pesos y metas propias)
Es la capa que hoy falta. Referencia a la definición (una escuela tiene un solo `category_id`, así que sus métricas activas = definiciones de su deporte):
```sql
-- Migración: 2026XXXX_school_metric_settings.sql
CREATE TABLE public.school_metric_settings (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id            uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  metric_definition_id uuid NOT NULL REFERENCES public.sport_metric_definitions(id) ON DELETE CASCADE,
  is_active            boolean NOT NULL DEFAULT true,
  weight               numeric NOT NULL DEFAULT 1 CHECK (weight >= 0),   -- ponderación del índice
  target_value         numeric,     -- override de meta
  min_value            numeric,     -- override de rango de normalización
  max_value            numeric,
  custom_label         text,        -- nombre que ve el coach
  display_order        int NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_metric_settings_uq UNIQUE (school_id, metric_definition_id)
);
CREATE INDEX idx_school_metric_settings_school ON public.school_metric_settings(school_id) WHERE is_active;
```
- **Parámetro efectivo** = `COALESCE(school_metric_settings.x, sport_metric_definitions.x)` para min/max/target/label; `weight` vive solo aquí.
- RLS: lectura miembros de la escuela; escritura `school_admin` de la escuela.
- RPC: `set_school_metric(p_school_id, p_metric_definition_id, p_weight, p_target, p_min, p_max, p_label, p_active)`.

#### C-C · Métricas custom por escuela (sin ensuciar el catálogo global)
Hoy `sport_metric_definitions` no tiene `school_id`, así que una custom contaminaría el estándar global. Aditivo:
```sql
-- Migración: 2026XXXX_metric_defs_school_scope.sql
ALTER TABLE public.sport_metric_definitions
  ADD COLUMN school_id        uuid REFERENCES public.schools(id) ON DELETE CASCADE,  -- NULL = estándar global
  ADD COLUMN parent_metric_id uuid REFERENCES public.sport_metric_definitions(id) ON DELETE SET NULL; -- custom→estándar

-- reemplazar el UNIQUE global por uno con scope de escuela
ALTER TABLE public.sport_metric_definitions DROP CONSTRAINT <unique_sport_metric_key>;  -- descubrir nombre
CREATE UNIQUE INDEX sport_metric_definitions_scoped_key
  ON public.sport_metric_definitions (
     COALESCE(school_id, '00000000-0000-0000-0000-000000000000'::uuid),
     COALESCE(sport_category_id, '00000000-0000-0000-0000-000000000000'::uuid),
     metric_key);
```
- RLS: `school_id IS NULL` legible por todos, escribible solo `super_admin`; `school_id` set → miembros/`school_admin` de esa escuela.
- `parent_metric_id` es lo que permite consolidar la custom contra el estándar en el benchmark (C-G).
- RPC `create_custom_metric(...)` crea la fila con `school_id` + `parent_metric_id`.

#### C-F · Capa de cálculo — normalización 0-100 + índice ponderado + Δ mejora
```sql
-- Migración: 2026XXXX_performance_scoring.sql
-- Vista base: cada entry con su score normalizado y su peso efectivo
CREATE OR REPLACE VIEW public.v_performance_scored AS
SELECT
  pe.id, pe.school_id, pe.subject_type, pe.subject_id, pe.recorded_at::date AS eval_date,
  d.id AS metric_definition_id, d.sport_category_id, d.category, d.higher_is_better,
  COALESCE(sms.weight, 1) AS weight,
  pe.value AS raw_value,
  -- rango efectivo
  COALESCE(sms.min_value, d.min_value) AS lo,
  COALESCE(sms.max_value, d.max_value) AS hi,
  CASE
    WHEN COALESCE(sms.max_value,d.max_value) IS NULL
      OR COALESCE(sms.min_value,d.min_value) IS NULL
      OR COALESCE(sms.max_value,d.max_value) = COALESCE(sms.min_value,d.min_value)
      THEN NULL
    WHEN d.higher_is_better THEN
      100 * (LEAST(GREATEST(pe.value, COALESCE(sms.min_value,d.min_value)), COALESCE(sms.max_value,d.max_value))
             - COALESCE(sms.min_value,d.min_value))
          / (COALESCE(sms.max_value,d.max_value) - COALESCE(sms.min_value,d.min_value))
    ELSE
      100 * (COALESCE(sms.max_value,d.max_value)
             - LEAST(GREATEST(pe.value, COALESCE(sms.min_value,d.min_value)), COALESCE(sms.max_value,d.max_value)))
          / (COALESCE(sms.max_value,d.max_value) - COALESCE(sms.min_value,d.min_value))
  END AS score_norm
FROM public.performance_entries pe
JOIN public.sport_metric_definitions d ON d.metric_key = pe.metric_key
  AND (d.sport_category_id IS NULL OR d.sport_category_id = (SELECT category_id FROM public.schools s WHERE s.id = pe.school_id))
  AND (d.school_id IS NULL OR d.school_id = pe.school_id)
LEFT JOIN public.school_metric_settings sms
  ON sms.metric_definition_id = d.id AND sms.school_id = pe.school_id
WHERE pe.value IS NOT NULL;
```
Fórmulas (documentadas en §4 del spec original, se reusan):
- `mejora = score_norm(último) − score_norm(primero del periodo)`; `mejora_% = mejora / max(primero,1) * 100`.
- `indice = Σ(score_norm × weight) / Σ weight` por sujeto/equipo/escuela y categoría.

RPCs entregables: `get_subject_performance(subject_type, subject_id, from, to)` y `get_school_performance(school_id, sport_category_id, from, to)` → jsonb con índice por categoría + Δ. `SECURITY DEFINER` + grant `authenticated`.

**Frontend**: enriquecer `PerformanceEvolutionSection` con score normalizado (no solo valor crudo) + radar por categoría + índice compuesto; pantalla "Parámetros de evaluación" para `school_admin` (activar/pesar/meta/custom) montada sobre C-B/C-C.

#### C-F.2 · Perfil de crecimiento para atleta y padre (vista de MEJORA, no solo evolución)
**Hueco actual**: desde su perfil, atleta (`StatsPage`) y padre (`AcademicProgressPage`, tab Escuela) solo ven **valor crudo en el tiempo** (línea recharts). No ven cuánto **mejoraron** ni un índice consolidado. Entregables:

- **`PerformanceGrowthSummary`** (sección embebida en el perfil, consume `get_subject_performance`):
  - **Índice compuesto por categoría** (radar: physical/technical/tactical/attendance) — un solo número de rendimiento global del periodo.
  - Por cada métrica activa de la escuela: **valor actual**, **Δ del periodo** con flecha ↑/↓ y **% de mejora** (verde/rojo), y **avance hacia la meta** (barra hacia `target_value` efectivo).
  - Selector de periodo (mes / trimestre / temporada).
- **`MetricGrowthDetailModal`** (modal, al hacer click en una métrica):
  - Línea con **score normalizado 0-100** (respeta `higher_is_better`, no el crudo) + línea de referencia de la **meta**.
  - **Mejor marca** del periodo y comparación opcional **vs promedio del equipo** (solo si el rol lo permite por RLS).
  - Historial de registros (fecha, valor crudo, contexto, quién lo registró).
- **Enganche**: reusar los mismos puntos que ya usa `PerformanceEvolutionSection` — perfil del atleta adulto y `AcademicProgressPage` con `childId` para el padre. Es aditivo: la línea de valor crudo actual se conserva; esto suma la capa de mejora/índice encima.
- **Dependencia**: requiere C-A (`higher_is_better`+rango), C-B (pesos/meta por escuela) y C-F (RPC de scoring). Sin ellos solo se puede mostrar valor crudo (lo que ya existe).

**Mockup — `PerformanceGrowthSummary` (sección en el perfil):**
```
┌───────────────────────────────────────────────────────────────┐
│  Mi crecimiento          [ Mes ▾ ][ Trimestre ][ Temporada ]   │
├───────────────────────────────────────────────────────────────┤
│                                                                 │
│    Índice global   78/100   ↑ +6 pts                            │
│                                                                 │
│         ╱‾‾‾╲   Físico       ██████████░░  82  ↑ +8             │
│        │radar│  Técnico      ████████░░░░  71  ↑ +4             │
│         ╲___╱   Táctico      ███████░░░░░  64  ↑ +2             │
│                 Asistencia   ███████████░  91  → 0              │
│                                                                 │
├───────────────────────────────────────────────────────────────┤
│  Métricas                                          (click ▸)    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Sprint 20m        3.10 s     ↑ +0.18 s  (+5%)    ▸       │   │
│  │ meta 2.90 s   [███████████░░░░]  hacia meta             │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ Salto vertical    54 cm      ↑ +3 cm   (+6%)     ▸       │   │
│  │ meta 60 cm    [█████████░░░░░░]                          │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ Ataques efectivos 12         ↓ −2      (−14%)    ▸       │   │
│  │ meta 18       [██████░░░░░░░░░]                          │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```
> Nota: Sprint 20m es `higher_is_better=false` → bajar el tiempo se pinta como mejora (↑ verde). Ese es el porqué de C-A.

**Mockup — `MetricGrowthDetailModal` (al hacer click en una métrica):**
```
┌─────────────────────────────────────────────────────────────┐
│  Sprint 20m                                            [ ✕ ] │
│  Físico · segundos · menos es mejor                          │
├─────────────────────────────────────────────────────────────┤
│  Actual 3.10 s   Mejor 3.02 s   Δ periodo ↑ +0.18 s (+5%)    │
│                                                               │
│  Score normalizado (0-100)                                    │
│  100┤                                          ●———           │
│     │                              ●———————————               │
│   50┤            ●———————————————                             │
│     │  ●—————————                                             │
│    0└──┴────┴────┴────┴────┴────┴────┴────  · · · meta (100)  │
│      ene  feb  mar  abr  may  jun                             │
│                                                               │
│  vs promedio del equipo:  tú 62 ·· equipo 55   (si RLS OK)   │
├─────────────────────────────────────────────────────────────┤
│  Historial                                                    │
│  12 jun  3.10 s   evaluación   · coach Ana                   │
│  28 may  3.14 s   competencia  · coach Ana                   │
│  10 may  3.20 s   manual       · coach Luis                  │
└─────────────────────────────────────────────────────────────┘
```

---

### P2 — Diferencial y captura

#### C-G · Benchmark entre escuelas (solo `super_admin`)
RPC de percentiles por `sport_category_id` + `metric_key`, consolidando custom vía `parent_metric_id`. RLS: exclusivo `super_admin`; cada escuela ve solo lo suyo. Frontend en admin SportMaps.

#### C-H · Ingesta de dispositivos (N1→N5) → alimenta `performance_entries`
Reusar el diseño de §3 del spec original (`measurement_sources` + `measurement_readings` + `promote_reading`), con dos ajustes al modelo actual:
- Ampliar `performance_entries.context_type` para incluir `'device'`:
  ```sql
  ALTER TABLE public.performance_entries DROP CONSTRAINT <check_context_type>;
  ALTER TABLE public.performance_entries
    ADD CONSTRAINT performance_entries_context_type_chk
    CHECK (context_type IN ('manual','competition','evaluation','session','device'));
  ```
- `promote_reading` inserta en `performance_entries` (no en `athlete_stats`), resolviendo `subject_type/subject_id` (incl. `unregistered` vía C-J y `external_ref`).
- Dedup `UNIQUE(source_id, external_ref)` (mismo patrón anti-duplicado de webhooks de pagos).

#### C-I · Puente con legacy (anti-fragmentación)
Hoy el rendimiento del atleta puede vivir en `academic_progress`/`athlete_stats` **y** en `performance_entries`. Para que los dashboards sean completos:
- **Opción recomendada (lectura)**: vista `v_all_performance` que UNIONa `performance_entries` con `academic_progress`/`athlete_stats` (mapeando `skill_name`/`stat_type` a `metric_key` cuando exista match, dejando el resto como legacy no tipado). Cero migración de datos.
- **Opción escritura (si se quiere converger)**: que el RPC de registro escriba en `performance_entries` como fuente única y deje las legacy solo-lectura. Decisión de producto — **no hacer dual-write silencioso**.

---

### P3 — Cierre de pendientes y calidad (C-K)

De los pendientes explícitos del spec base + higiene:
1. **`get_athlete_stats` rama `context='school'`** declarada pero nunca implementada (`v_sessions_school` siempre 0) → arreglar con migración nueva.
2. **Onboarding**: `schools.category_id` no obligatorio → añadir prompt suave en el wizard (o validación blanda), aprovechando que el trigger ya lo auto-resuelve.
3. **`CoachReportsPage`**: resolver el modelo `RosterPlayer` → `subject_type/subject_id` antes de poner el botón "Registrar Rendimiento".
4. **Categorías ambiguas** `Ciclismo` (3 escuelas) y `Gimnasia` (1) → confirmar disciplina con negocio y fusionar (migración estilo la #5 original).
5. **Higiene**: `"Pruebas 15"` con `is_demo=false` siendo cuenta de prueba → corregir flag.
6. **QA (Playwright)** por cada complemento: normalización con `higher_is_better=false`, validación de `metric_key` (C-D), ponderación por escuela, dedup de ingesta.

---

## 3. Orden sugerido de ejecución

```
P0  C-A (higher_is_better+rango) → C-D (integridad key) → C-E (no-numérico) → C-J (unregistered)
P1  C-B (settings escuela) → C-C (custom metrics) → C-F (scoring + dashboards)
P2  C-G (benchmark) → C-H (ingesta) → C-I (puente legacy)
P3  C-K (pendientes + higiene + QA)
```
P0 es barato y desbloquea todo lo demás (sin `higher_is_better` ni rango, el scoring de P1 no puede existir). P1 es el que entrega el **objetivo de negocio** que hoy no está cubierto.

---

## 4. Riesgos / cuidados
- `higher_is_better` mal seteado invierte rankings de tiempo/peso → revisar seed uno por uno (C-A).
- No poner `NOT NULL` en columnas nuevas sobre datos existentes sin default.
- Al hacer `DROP CONSTRAINT` de CHECK/UNIQUE, **descubrir el nombre real** primero (`\d sport_metric_definitions`), no asumirlo.
- Benchmark (C-G): exponer **solo** a `super_admin`.
- Ingesta (C-H): idempotencia obligatoria por `UNIQUE(source_id, external_ref)`.
- No hacer dual-write legacy↔`performance_entries` sin decisión de producto (C-I).
- Migraciones inmutables + `search_path` + grants en toda función nueva.
```
