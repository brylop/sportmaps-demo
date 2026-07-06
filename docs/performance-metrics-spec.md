# SportMaps — Métricas de Rendimiento por Deporte y Escuela

> **Especificación de implementación (hand-off a desarrollo).**
> Objetivo: permitir que **cada escuela defina sus propios parámetros de evaluación**, pero sobre un **estándar por deporte** curado por SportMaps, de modo que SportMaps **reciba, consolide, normalice y pondere** el rendimiento y la mejora de los atletas — y a futuro **ingiera datos de dispositivos** (cronómetros, relojes digitales, wearables, fotoceldas).
>
> Fecha: 2026-07-02 · Autor del diseño: equipo SportMaps · Estado: aprobado, pendiente de implementar.

---

## 0. TL;DR para quien implementa

- Se crea un **catálogo estándar de métricas por deporte** (`evaluation_metrics`, global, curado por SportMaps).
- Cada escuela **activa/personaliza** ese catálogo con **pesos y metas propias** (`school_metric_settings`) y puede **añadir métricas custom** vinculadas al estándar.
- Las evaluaciones dejan de ser texto libre: se **tipan con `metric_id`** en las tablas que ya existen (`academic_progress`, `athlete_stats`).
- Sobre esa serie temporal se calcula **normalización 0-100 + índice ponderado + mejora (Δ)** → dashboards por atleta / equipo / escuela y **benchmark entre escuelas del mismo deporte**.
- Se añade una **capa de ingesta de dispositivos** (manual/CSV → API/webhook → wearables/fotoceldas) que alimenta esas mismas tablas.

**Se implementa por fases (0 → 6).** Cada fase es full-stack: `DB + RLS + RPCs + BFF + Frontend + Auditoría + QA`.

---

## 1. Contexto y problema actual

### 1.1 Qué existe hoy en la BD (estado real)

| Tabla | Archivo | Rol actual | Problema |
|---|---|---|---|
| `sports_categories` | `supabase/master_plan.sql` | Catálogo de deportes (`id, name, description, icon, is_active`) | ✅ Sirve como ancla de deporte. Poco usado. |
| `programs` | `supabase/master_plan.sql` | Programa de escuela con `sport` (text), `level` (`program_level`) | ⚠️ Legacy — se migra hacia `offerings`. `sport` es texto. |
| `teams` | `supabase/master_plan.sql` | Equipo con `sport` (text), `coach_id` | `sport` es texto. |
| `offerings` | `20260310000001_universal_architecture_v2_1.sql` | Oferta comercial con `sport` (text) | `sport` es texto. |
| `children` | `supabase/master_plan.sql` | Atleta (menor) — `school_id, team_id, program_id` | Vincula atleta ↔ escuela ↔ deporte. |
| `enrollments` | `supabase/master_plan.sql` | Inscripción `child_id`/`user_id` a `program_id` | — |
| **`academic_progress`** | `supabase/master_plan.sql` | **Evaluación de habilidad**: `child_id, coach_id, skill_name (TEXT LIBRE), skill_level (0-100), evaluation_date, comments` | ❌ `skill_name` texto libre → imposible agregar/comparar. |
| **`athlete_stats`** | `supabase/master_plan.sql` | **Métrica física**: `athlete_id, stat_date, stat_type (TEXT LIBRE), value, unit, notes` | ❌ `stat_type` texto libre → imposible agregar/comparar. |
| `training_logs` | `supabase/master_plan.sql` | Carga de entrenamiento (`exercise_type, duration_minutes, intensity, calories_burned`) | Descriptivo, no evaluativo. |
| `athlete_goals` | `20260311000002_athlete_goals.sql` | Objetivos del atleta (`progress 0-100`) | Complementario. |
| `attendance_records` / `attendance_sessions` | varias | Asistencia | Insumo secundario de rendimiento. |
| `view_program_performance` | `20260219000003_business_analytics.sql` | Top programas por ingresos | Solo financiero, no deportivo. |

### 1.2 El gap central

`academic_progress.skill_name` y `athlete_stats.stat_type` son **texto libre**. Un coach escribe *"Tiro de 3"*, otro *"Lanzamiento triple"*, otro *"3PT"*. Consecuencia:

- No se puede **agregar** ni **comparar** entre atletas, equipos o escuelas.
- No hay **catálogo** que diga "estas son las cosas evaluables del baloncesto".
- No se puede **ponderar** ni calcular un **índice de rendimiento/mejora** consistente.

**Este documento resuelve exactamente eso** sin migrar datos históricos de golpe (se mantiene el texto libre como fallback).

### 1.3 Convenciones obligatorias del repo (leer antes de codear)

- **Migraciones inmutables**: nunca editar/borrar archivos en `supabase/migrations/`. Todo fix va en migración **nueva** con timestamp posterior.
- **`search_path`**: toda `CREATE FUNCTION` nueva debe incluir `SET search_path = pg_catalog, public, pg_temp`.
- **`SECURITY DEFINER` + `GRANT EXECUTE`**: `SECURITY DEFINER` no exime al caller de `EXECUTE`. Otorgar `EXECUTE` a `authenticated`/`service_role` según corresponda. Nunca revocar helpers de RLS al rol que las invoca desde policies.
- **RLS sin self-recursion**: policies sobre tabla X nunca `SELECT FROM X` en `USING`. Usar funciones `SECURITY DEFINER` (`is_school_admin(school_id)`, `is_super_admin()`, etc.).
- **Catálogo de roles**: `public.roles` usa `'school_admin'` (NO `'admin'`).
- **Rama de trabajo**: `develop`. No mergear a `main`.

---

## 2. Modelo de datos objetivo (dos capas + ingesta)

```
                          sports_categories (deporte)
                                   │
                                   ▼
   Capa A ─── evaluation_metrics  ◄──────── parent_metric_id (custom→estándar)
   (estándar global   │  (school_id NULL = estándar SportMaps)
    + custom escuela)  │  (school_id set  = custom de esa escuela)
                       │
        ┌──────────────┼───────────────────────────┐
        ▼              ▼                             ▼
 Capa B                academic_progress /      measurement_readings
 school_metric_settings  athlete_stats           (ingesta de dispositivos)
 (weight, target,        (+ metric_id FK) ◄──── normaliza/mapea ──┘
  min/max, activo)
        │
        ▼
   Vistas de rollup: índice ponderado, mejora (Δ), benchmark por deporte
```

### 2.1 Capa A — Estándar por deporte: `evaluation_metrics`

Diccionario común. `school_id NULL` = métrica estándar (curada por SportMaps, igual para todas). `school_id` seteado = métrica **custom** de esa escuela, opcionalmente vinculada a un estándar vía `parent_metric_id` para no perder comparabilidad.

```sql
-- Migración: supabase/migrations/2026XXXXXXXXXX_evaluation_metrics_catalog.sql

-- Enums de soporte
CREATE TYPE public.metric_category AS ENUM (
  'technical',      -- técnica del deporte (pase, tiro, recepción)
  'tactical',       -- táctica / lectura de juego / posicionamiento
  'physical',       -- físico (velocidad, fuerza, resistencia) — suele ser transversal
  'psychological',  -- actitud, liderazgo, concentración
  'anthropometric', -- peso, talla, IMC, envergadura
  'health'          -- indicadores de bienestar/salud
);

CREATE TYPE public.metric_value_type AS ENUM (
  'scale_0_100',   -- valoración subjetiva del coach 0-100
  'rating_1_5',    -- estrellas / rúbrica 1 a 5
  'numeric',       -- valor con unidad (cm, kg, reps, m/s)
  'time_seconds',  -- tiempo cronometrado (menor suele ser mejor)
  'boolean',       -- lo logra / no lo logra
  'enum'           -- categoría discreta (definida en options)
);

CREATE TABLE public.evaluation_metrics (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_id         uuid REFERENCES public.sports_categories(id) ON DELETE RESTRICT,
                     -- NULL = métrica transversal (física/salud aplica a cualquier deporte)
  school_id        uuid REFERENCES public.schools(id) ON DELETE CASCADE,
                     -- NULL = estándar global SportMaps · seteado = custom de la escuela
  parent_metric_id uuid REFERENCES public.evaluation_metrics(id) ON DELETE SET NULL,
                     -- si es custom, apunta al estándar equivalente (para consolidar)
  key              text NOT NULL,          -- slug estable: 'sprint_20m', 'shooting_3pt'
  name             text NOT NULL,          -- "Sprint 20m", "Tiro de 3 puntos"
  description      text,
  category         public.metric_category NOT NULL,
  value_type       public.metric_value_type NOT NULL,
  unit             text,                   -- 's','cm','kg','reps','m/s' (para numeric/time)
  min_value        numeric,                -- rango esperado para normalizar 0-100
  max_value        numeric,
  target_value     numeric,                -- meta de referencia estándar
  higher_is_better boolean NOT NULL DEFAULT true, -- CLAVE: en tiempos = false
  options          jsonb,                  -- para value_type='enum': ["A","B","C"]
  level_scope      public.program_level[], -- opcional: niveles a los que aplica
  display_order    int NOT NULL DEFAULT 0,
  is_active        boolean NOT NULL DEFAULT true,
  created_by       uuid REFERENCES public.profiles(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  -- unicidad de key por ámbito (global por deporte, o por escuela+deporte)
  CONSTRAINT evaluation_metrics_key_uq
    UNIQUE (COALESCE(school_id, '00000000-0000-0000-0000-000000000000'::uuid),
            COALESCE(sport_id,  '00000000-0000-0000-0000-000000000000'::uuid),
            key)
);

CREATE INDEX idx_eval_metrics_sport   ON public.evaluation_metrics(sport_id) WHERE is_active;
CREATE INDEX idx_eval_metrics_school  ON public.evaluation_metrics(school_id);
CREATE INDEX idx_eval_metrics_parent  ON public.evaluation_metrics(parent_metric_id);
```

**Notas de diseño**
- `higher_is_better = false` para tiempos (`sprint_20m`, `freestyle_50m`) y pesos donde bajar es mejor. Es el pivote de la normalización.
- `sport_id NULL` = métrica transversal (velocidad, salto, IMC). Aplica a cualquier deporte.
- `parent_metric_id` es lo que permite que, aunque una escuela invente su métrica, SportMaps la consolide contra el estándar.

### 2.2 Capa B — Parámetros por escuela: `school_metric_settings`

Cada escuela elige **qué** mide, con **qué peso** (ponderación para el índice compuesto) y contra **qué meta/rango**.

```sql
CREATE TABLE public.school_metric_settings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  metric_id     uuid NOT NULL REFERENCES public.evaluation_metrics(id) ON DELETE CASCADE,
  is_active     boolean NOT NULL DEFAULT true,
  weight        numeric NOT NULL DEFAULT 1  CHECK (weight >= 0),  -- ponderación
  target_value  numeric,      -- meta propia (override del estándar)
  min_value     numeric,      -- override de rango de normalización
  max_value     numeric,
  custom_label  text,         -- nombre que ve el coach en la app
  level_scope   public.program_level[],
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_metric_settings_uq UNIQUE (school_id, metric_id)
);

CREATE INDEX idx_school_metric_settings_school ON public.school_metric_settings(school_id) WHERE is_active;
```

**Resolución de parámetros efectivos** (helper): para un `school_id + metric_id`, el `min/max/target/label` efectivo es `COALESCE(school_metric_settings.x, evaluation_metrics.x)`. El `weight` vive solo en la capa B.

### 2.3 Tipado de las evaluaciones existentes (FKs, sin romper legacy)

```sql
-- Migración: 2026XXXXXXXXXX_link_evaluations_to_metrics.sql
ALTER TABLE public.academic_progress
  ADD COLUMN metric_id uuid REFERENCES public.evaluation_metrics(id) ON DELETE SET NULL,
  ADD COLUMN team_id   uuid REFERENCES public.teams(id) ON DELETE SET NULL; -- contexto de deporte/equipo

ALTER TABLE public.athlete_stats
  ADD COLUMN metric_id uuid REFERENCES public.evaluation_metrics(id) ON DELETE SET NULL;

CREATE INDEX idx_academic_progress_metric ON public.academic_progress(metric_id);
CREATE INDEX idx_athlete_stats_metric     ON public.athlete_stats(metric_id);
```

- Se **mantiene** `skill_name` / `stat_type` (texto) como fallback para registros viejos y métricas ad-hoc.
- Nuevos registros **deben** setear `metric_id`. (No se pone `NOT NULL` para no romper histórico; se valida en RPC.)
- `team_id` en `academic_progress` da el contexto de deporte cuando la métrica es transversal (`sport_id NULL`).

---

## 3. Ingesta de dispositivos (cronómetros, relojes, wearables)

> Objetivo: capturar mediciones desde hardware/apps externas (cronómetro digital, reloj deportivo, GPS, pulsómetro, fotoceldas de contrarreloj) y **mapearlas a `metric_id`** para que caigan en `athlete_stats`/`academic_progress` como cualquier otra evaluación.

### 3.1 Estrategia por madurez (de lo simple a lo avanzado)

| Nivel | Método | Ejemplo | Complejidad |
|---|---|---|---|
| **N1** | Entrada manual tipada | Coach cronometra y digita el tiempo | Baja (ya cubierto por Fase 2) |
| **N2** | Importación CSV/Excel | Export de cronómetro/planilla → subir archivo | Media |
| **N3** | API / Webhook | App de terceros o fotocelda POSTea el resultado | Media-alta |
| **N4** | Wearables / Health APIs | Garmin, Polar, Apple HealthKit, Google Fit, Strava | Alta (OAuth + normalización) |
| **N5** | Fotoceldas / timing gates | Puertas de tiempo en pista (contrarreloj) | Alta (integración de hardware) |

**Recomendación:** implementar N1 (Fase 2) y N2/N3 (Fase 4); dejar N4/N5 detrás de las tablas de ingesta ya listas para no re-arquitecturar.

### 3.2 Esquema de ingesta

```sql
-- Migración: 2026XXXXXXXXXX_device_ingestion.sql

CREATE TYPE public.device_kind AS ENUM (
  'manual',          -- captura humana (cronómetro a mano)
  'stopwatch',       -- cronómetro digital
  'smartwatch',      -- reloj deportivo (Garmin/Polar/Apple/Amazfit...)
  'gps_tracker',     -- GPS de campo
  'heart_rate',      -- pulsómetro / banda
  'timing_gate',     -- fotocelda / puerta de tiempo (contrarreloj)
  'health_app',      -- HealthKit / Google Fit / Strava
  'csv_import',      -- carga de archivo
  'other'
);

CREATE TYPE public.reading_status AS ENUM (
  'pending',   -- recibido, sin mapear a métrica/atleta
  'mapped',    -- vinculado a metric_id + atleta y volcado a la tabla destino
  'rejected',  -- descartado (duplicado, dato inválido, sin match)
  'error'
);

-- 3.2.a  Integraciones/fuentes configuradas por escuela
CREATE TABLE public.measurement_sources (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  kind        public.device_kind NOT NULL,
  name        text NOT NULL,                 -- "Fotocelda pista 1", "Garmin del club"
  provider    text,                          -- 'garmin','polar','apple_health','custom'...
  config      jsonb NOT NULL DEFAULT '{}',   -- credenciales/endpoints (NO secretos crudos: usar ref a vault)
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 3.2.b  Lecturas crudas (staging) — TODO dato externo entra aquí primero
CREATE TABLE public.measurement_readings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  source_id     uuid REFERENCES public.measurement_sources(id) ON DELETE SET NULL,
  athlete_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL, -- puede resolverse después
  child_id      uuid REFERENCES public.children(id) ON DELETE SET NULL,
  metric_id     uuid REFERENCES public.evaluation_metrics(id) ON DELETE SET NULL,
  external_ref  text,          -- id del evento en el dispositivo (para dedup)
  raw_value     numeric,       -- valor tal cual llegó
  unit          text,
  captured_at   timestamptz NOT NULL,  -- cuándo se tomó la medición (no cuándo llegó)
  payload       jsonb,         -- crudo original para trazabilidad
  status        public.reading_status NOT NULL DEFAULT 'pending',
  status_reason text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- dedup: misma fuente + mismo evento externo no entra dos veces
  CONSTRAINT measurement_readings_dedup UNIQUE (source_id, external_ref)
);

CREATE INDEX idx_readings_school_status ON public.measurement_readings(school_id, status);
CREATE INDEX idx_readings_athlete       ON public.measurement_readings(athlete_id, captured_at);
```

### 3.3 Flujo de normalización dispositivo → evaluación

1. La lectura entra a `measurement_readings` (`status='pending'`) por CSV, webhook o API.
2. Un RPC/worker `promote_reading(reading_id, metric_id, athlete_id)`:
   - Resuelve atleta (por `external_ref`/mapeo) y métrica.
   - Convierte unidad si hace falta (ej. ms → s).
   - Inserta en `athlete_stats` (numeric/time) o `academic_progress` (scale/rating) con `metric_id`.
   - Marca la lectura `status='mapped'`.
3. Lecturas sin match quedan `pending` para revisión manual en un panel de la escuela.

> **Reglas anti-duplicado** (reutilizar patrón de webhooks de pagos): `UNIQUE (source_id, external_ref)` + idempotencia en `promote_reading`. Nunca volcar dos veces la misma medición.

### 3.4 Herramientas candidatas a integrar (para evaluación futura)

| Herramienta | Tipo | Vía de integración |
|---|---|---|
| Garmin / Polar / Coros | Reloj deportivo | OAuth + API de actividades (N4) |
| Apple Watch | Reloj | HealthKit (app móvil Capacitor → sync) |
| Google Fit / Health Connect | Agregador Android | API (N4) |
| Strava | App | OAuth API (N4) |
| Freelap / Brower / fotoceldas | Timing gates contrarreloj | CSV/export o webhook (N3/N5) |
| Cronómetro digital manual | — | Entrada manual (N1) |

*(Se listan como hoja de ruta; el esquema de §3.2 ya las soporta sin cambios estructurales.)*

---

## 4. Cálculo de rendimiento, mejora y benchmark

### 4.1 Normalización a índice 0-100

Para comparar métricas heterogéneas (0-100, tiempos, cm) todo se lleva a 0-100 usando el rango efectivo de la escuela:

```
Sea v = valor, lo = min efectivo, hi = max efectivo.
Recortar v a [lo, hi].

score_norm =
  higher_is_better ?  100 * (v  - lo) / (hi - lo)
                   :  100 * (hi - v ) / (hi - lo)
```

- Rango efectivo = `COALESCE(school_metric_settings.min_value, evaluation_metrics.min_value)` (igual para max).
- `higher_is_better` viene de `evaluation_metrics`.

### 4.2 Mejora (Δ)

Sobre la serie temporal (`evaluation_date` / `stat_date`):

```
mejora = score_norm(último) - score_norm(primero del periodo)      -- puntos ganados
mejora_% = mejora / max(score_norm(primero), 1) * 100
```

### 4.3 Índice compuesto (ponderado)

Por atleta / equipo / escuela y categoría:

```
indice = Σ ( score_norm(métrica) * weight(métrica) ) / Σ weight(métrica)
```

`weight` sale de `school_metric_settings` (default 1).

### 4.4 Vistas / RPCs de rollup (entregables Fase 3)

```sql
-- Vista base: cada evaluación con su score normalizado y peso
CREATE OR REPLACE VIEW public.v_evaluation_scored AS
SELECT
  ap.child_id, ap.team_id, ap.evaluation_date::date AS eval_date,
  em.id AS metric_id, em.sport_id, em.category,
  sms.school_id, sms.weight,
  ap.skill_level AS raw_value,
  -- ... aplicar fórmula de §4.1 con COALESCE de rangos ...
  <score_norm_expr> AS score_norm
FROM public.academic_progress ap
JOIN public.evaluation_metrics em      ON em.id = ap.metric_id
LEFT JOIN public.school_metric_settings sms
       ON sms.metric_id = em.id AND sms.school_id = <school del atleta>
WHERE ap.metric_id IS NOT NULL;
-- (unir athlete_stats con UNION ALL, misma forma)

-- RPC principal para dashboards
CREATE OR REPLACE FUNCTION public.get_school_performance(
  p_school_id uuid, p_sport_id uuid DEFAULT NULL,
  p_from date DEFAULT NULL, p_to date DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  -- índice ponderado por categoría + mejora en el periodo
$$;
GRANT EXECUTE ON FUNCTION public.get_school_performance(uuid,uuid,date,date) TO authenticated;
```

- **Benchmark entre escuelas del mismo deporte**: agregar por `sport_id` + `metric_id` estándar (usando `parent_metric_id` para consolidar las custom) y calcular percentiles. **Solo SportMaps (super_admin)** ve el cruce entre escuelas; cada escuela ve solo lo suyo.

---

## 5. Seguridad (RLS)

| Tabla | Lectura | Escritura |
|---|---|---|
| `evaluation_metrics` (estándar, `school_id NULL`) | Todos autenticados | Solo `super_admin` |
| `evaluation_metrics` (custom, `school_id` set) | Miembros de esa escuela | `school_admin` de esa escuela |
| `school_metric_settings` | Miembros de la escuela | `school_admin` de la escuela |
| `academic_progress` / `athlete_stats` | Coach del equipo, escuela, y el propio atleta/padre | Coach/escuela; RPC valida `metric_id` activo |
| `measurement_sources` / `measurement_readings` | `school_admin` de la escuela | `school_admin` / `service_role` (ingesta) |

- Usar helpers `SECURITY DEFINER` existentes (`is_school_admin(school_id)`, `is_super_admin()`, `is_school_member(school_id)`); **no** hacer `SELECT` sobre la misma tabla en `USING` (evitar self-recursion).
- Ingesta por webhook corre como `service_role`.

---

## 6. Plan por fases (cada fase = full-stack)

> Cada fase entrega: **DB (migración) + RLS + RPCs + BFF (endpoints) + Frontend + Auditoría (activity log) + QA (Playwright)**.

### Fase 0 — Catálogo estándar por deporte
- **DB**: `evaluation_metrics` (§2.1) + enums + índices.
- **Seed**: métricas estándar por deporte (ver §7). Migración de datos idempotente.
- **RLS**: lectura pública autenticada; escritura `super_admin`.
- **BFF**: `GET /api/v1/metrics?sport_id=` (catálogo).
- **Frontend (admin SportMaps)**: CRUD de catálogo estándar.
- **QA**: alta/edición de métrica, unicidad de `key`, filtro por deporte.

### Fase 1 — Personalización por escuela
- **DB**: `school_metric_settings` (§2.2) + helper de "parámetros efectivos".
- **RLS**: `school_admin` gestiona lo de su escuela.
- **RPCs**: `set_school_metric(school_id, metric_id, weight, target, ...)`, `create_custom_metric(...)` (crea `evaluation_metrics` con `school_id` + `parent_metric_id`).
- **BFF**: `GET/PUT /api/v1/schools/:id/metrics`.
- **Frontend (escuela)**: pantalla "Parámetros de evaluación" — activar métricas del estándar, fijar pesos/metas, crear custom.
- **QA**: escuela activa subset, cambia peso, crea métrica custom vinculada.

### Fase 2 — Registro de evaluaciones tipado
- **DB**: FKs `metric_id`/`team_id` en `academic_progress` y `athlete_stats` (§2.3).
- **RPCs**: `record_evaluation(child_id, metric_id, value, date, comments)` valida que `metric_id` esté activo para la escuela y castea por `value_type`.
- **BFF**: `POST /api/v1/athletes/:id/evaluations`.
- **Frontend (coach)**: formulario de evaluación que **carga los ítems desde el catálogo de la escuela** (no texto libre); UI según `value_type` (slider 0-100, estrellas 1-5, input tiempo, etc.).
- **QA**: coach evalúa a un atleta con métricas del catálogo; rechazo si `metric_id` inactivo.

### Fase 3 — Rollup, ponderación y dashboards
- **DB**: vista `v_evaluation_scored` + RPC `get_school_performance` (§4.4).
- **BFF**: `GET /api/v1/schools/:id/performance`.
- **Frontend**: dashboard por atleta (radar por categoría, evolución), por equipo y por escuela (índice ponderado + mejora).
- **QA**: verificar normalización (incl. `higher_is_better=false`), índice ponderado y Δ.

### Fase 4 — Ingesta de dispositivos (N2/N3)
- **DB**: `measurement_sources`, `measurement_readings` + `promote_reading` (§3).
- **BFF**: `POST /api/v1/schools/:id/readings/import` (CSV) y `POST /webhooks/measurements/:source` (idempotente).
- **Frontend**: panel de lecturas `pending` → mapear a métrica/atleta; historial de fuentes.
- **QA**: import CSV, dedup por `external_ref`, promoción a `athlete_stats`.

### Fase 5 — Benchmark entre escuelas (solo SportMaps)
- **DB**: RPC de percentiles por `sport_id` + métrica estándar (consolidando custom vía `parent_metric_id`).
- **RLS**: `super_admin` únicamente.
- **Frontend (admin SportMaps)**: comparativa entre escuelas por deporte.

### Fase 6 — Wearables / Health APIs (N4/N5) *(futuro)*
- OAuth por proveedor, sync desde app móvil (Capacitor + HealthKit/Health Connect), mapeo a métricas transversales. **Sin cambios de esquema** (usa §3.2).

---

## 7. Seed de referencia (estándar por deporte)

> `school_id = NULL` en todos. Ajustar `min/max/target` con criterio técnico por nivel.

```
-- Transversales (sport_id = NULL, category='physical'/'anthropometric')
sprint_20m       | Sprint 20m         | physical       | time_seconds | s   | higher_is_better=false
vertical_jump    | Salto vertical     | physical       | numeric      | cm  | true
endurance_cooper | Test de Cooper     | physical       | numeric      | m   | true
body_weight      | Peso corporal      | anthropometric | numeric      | kg  | (informativo)
height           | Estatura           | anthropometric | numeric      | cm  | true

-- Fútbol (sport_id = <futbol>)
passing_accuracy    | Precisión de pase        | technical | scale_0_100 | — | true
ball_control        | Control de balón         | technical | scale_0_100 | — | true
shooting_power      | Potencia de tiro         | technical | scale_0_100 | — | true
tactical_positioning| Posicionamiento táctico  | tactical  | rating_1_5  | — | true

-- Baloncesto
shooting_3pt         | Tiro de 3 puntos        | technical | scale_0_100 | — | true
free_throw_pct       | % Tiros libres          | technical | numeric     | % | true
defensive_positioning| Posición defensiva      | tactical  | rating_1_5  | — | true

-- Natación
freestyle_50m   | 50m Libre    | technical | time_seconds | s | higher_is_better=false
turn_technique  | Técnica de viraje | technical | rating_1_5 | — | true

-- Tenis / Voleibol / Artes marciales / Atletismo / Gimnasia: mismo patrón.
```

---

## 8. Checklist de hand-off

- [ ] Fase 0: catálogo + seed + CRUD admin + QA verde.
- [ ] Fase 1: settings por escuela + custom metrics + QA.
- [ ] Fase 2: FKs + `record_evaluation` + form coach sin texto libre + QA.
- [ ] Fase 3: vistas + `get_school_performance` + dashboards + QA.
- [ ] Fase 4: ingesta CSV/webhook + `promote_reading` + panel + QA.
- [ ] Fase 5: benchmark super_admin.
- [ ] Fase 6 (futuro): wearables/HealthKit.

**Riesgos / cuidados**
- No poner `metric_id NOT NULL` en tablas legacy (rompe histórico). Validar en RPC.
- `higher_is_better` mal seteado invierte el ranking de tiempos → revisar en seed.
- Ingesta: idempotencia obligatoria (`UNIQUE (source_id, external_ref)`).
- Benchmark entre escuelas: exponer **solo** a `super_admin`; cada escuela ve lo suyo.
- Migraciones inmutables + `search_path` + grants en toda función nueva.
```
