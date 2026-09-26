# Plan F1 — Partidos: base de datos, RLS y RPCs

> Fase 1 del spec [partidos-registro-y-evaluacion-por-jugador.md](specs/partidos-registro-y-evaluacion-por-jugador.md).
> **Para aprobación antes de crear la migración** (`npm run migrations:new`) y aplicarla con
> `apply_migration`. Todo lo de abajo está verificado contra la base viva el 2026-09-26.
>
> Supuestos que cierran las dos preguntas abiertas del spec (el usuario dijo «dale, continúa»):
> **D7:** la evaluación del hijo arranca **apagada** para las familias; cada escuela la prende
> en Configuración y además se publica partido por partido. **Criterios por escuela**, no por
> categoría (si Besser los quiere por categoría más adelante, se agrega `team_id` nullable a
> `school_metric_definitions` en una migración chica).

---

## 1. Lo que hay en la base hoy (2026-09-26) y cómo lo afecta esta fase

| Objeto | Estado vivo | Qué hace F1 |
|---|---|---|
| `match_results` | **24 partidos**, 3 escuelas (Besser 15, Academia Fútbol Demo 5 —3 sin marcador—, Carmel 4). `team_id` válido en las 24 (0 huérfanos). Columnas: id, team_id, opponent, home_score, away_score, is_home, match_date, match_type, notes, created_at, opponent_team_id. `match_type` libre: Amistoso, Clasificatorio, Torneo | + `school_id` (backfill desde `teams`, luego NOT NULL, trigger «el equipo manda»), `status`, `kickoff_at`, `location`, `calendar_event_id` (UNIQUE), `tournament_match_id`, `evaluation_published_at`, `created_by`, `updated_by`, `updated_at`. Los 3 sin marcador quedan `scheduled`, los 21 con marcador `played` |
| Policies de `match_results` | 5: `match_results_admin_all` (FOR ALL con WITH CHECK, `is_school_admin`), select para cualquier miembro activo (`teams JOIN school_members`), insert/update/delete por rol (`owner/admin/staff/coach/super_admin/school_admin`) | Se tiran las 5 y se crean 4 con helpers envueltos (`(SELECT fn())::uuid[]`), mismo patrón que `calendar_events`. Lectura: miembros de la escuela + familia del equipo. Escritura: `user_staff_school_ids()`. **Radio:** ningún rol pierde algo que hoy pueda hacer; la familia sin fila en `school_members` gana lectura |
| Grants `match_results` | `authenticated`: todo; `anon`: nada | Sin cambio |
| `match_lineups` / `match_lineup_players` | UNIQUE `(source_type, source_id)`; `source_type` ∈ team_match / tournament_match / training_session; `position_code` CHECK solo fútbol (NULL pasa); `role` starter/bench; `minutes_played ≥ 0`; escritura vía `user_tactical_edit_school_ids()` | Sin DDL. El RPC de convocados escribe aquí con `source_type = 'team_match'` y `source_id = match_results.id` |
| `performance_entries` | 683 filas, **0** con `context_type = 'competition'`. Índice único solo para `session`. `checkpoint` (rúbrica del mesociclo). Lectura: propio · padre del hijo · **cualquier miembro activo de la escuela** | + índice único parcial para `competition`. **Se reemplaza la policy de lectura**: el «cualquier miembro» pasa a `user_staff_school_ids()`; la familia sigue viendo lo del hijo, y lo de partido solo si está publicado (D7). Ver §4 radio |
| `sport_metric_definitions` | 122 métricas, 7 deportes; lectura `true` | Sin cambio; sirven de plantillas |
| `school_settings` | PK `school_id`; sin ninguna columna de evaluación | + `share_match_evaluations boolean NOT NULL DEFAULT false` |
| `training_microcycle_days` | `tournament_match_id` FK (nadie lo usa); FK compuesta `(microcycle_id, school_id)` | + `match_id` FK → `match_results` ON DELETE SET NULL |
| Helpers disponibles | `user_school_ids()`, `user_staff_school_ids()`, `user_admin_school_ids()`, `is_platform_admin()`, `is_parent_of_child(uuid)`, `calendar_family_team_ids()`, `calendar_family_school_ids()` (todos `uuid[]`/bool, SECURITY DEFINER) | Se reusan; se agrega `match_evaluation_visible_to_family(uuid)` |
| Código que escribe `match_results` directo | `ResultsPage.tsx`, `useFootballData.ts` (insert/delete), `useSchoolData.ts` | **Siguen funcionando**: insertan sin `school_id`, el trigger lo llena, y la policy de staff los deja. Pasan por el BFF en F2 |

---

## 2. Migración propuesta (una sola, transaccional)

Nombre sugerido: `partidos_f1_school_id_status_criterios_rls_rpcs`.

### 2.1 `match_results` — columnas, backfill, trigger, índices

```sql
ALTER TABLE public.match_results
  ADD COLUMN IF NOT EXISTS school_id               uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status                  text NOT NULL DEFAULT 'played',
  ADD COLUMN IF NOT EXISTS kickoff_at              timestamptz,
  ADD COLUMN IF NOT EXISTS location                text,
  ADD COLUMN IF NOT EXISTS calendar_event_id       uuid REFERENCES public.calendar_events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tournament_match_id     uuid REFERENCES public.tournament_matches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS evaluation_published_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by              uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by              uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at              timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.match_results DROP CONSTRAINT IF EXISTS match_results_status_check;
ALTER TABLE public.match_results
  ADD CONSTRAINT match_results_status_check CHECK (status IN ('scheduled', 'played', 'cancelled'));

-- Backfill: escuela desde el equipo (24/24 tienen team_id válido) y estado desde el marcador.
UPDATE public.match_results mr SET school_id = t.school_id
  FROM public.teams t WHERE t.id = mr.team_id AND mr.school_id IS NULL;
UPDATE public.match_results
   SET status = CASE WHEN home_score IS NOT NULL AND away_score IS NOT NULL THEN 'played' ELSE 'scheduled' END;
ALTER TABLE public.match_results ALTER COLUMN school_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_match_results_calendar_event
  ON public.match_results (calendar_event_id) WHERE calendar_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_match_results_school_date ON public.match_results (school_id, match_date DESC);
CREATE INDEX IF NOT EXISTS idx_match_results_team_date   ON public.match_results (team_id, match_date DESC);

-- El equipo manda sobre la escuela (mismo patrón que calendar_events_fill_school).
CREATE OR REPLACE FUNCTION public.match_results_fill_school()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  SELECT t.school_id INTO NEW.school_id FROM public.teams t WHERE t.id = NEW.team_id;
  IF NEW.school_id IS NULL THEN
    RAISE EXCEPTION 'El equipo % no existe', NEW.team_id USING ERRCODE = '23503';
  END IF;
  IF TG_OP = 'UPDATE' THEN NEW.updated_at := now(); END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.match_results_fill_school() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_match_results_fill_school ON public.match_results;
CREATE TRIGGER trg_match_results_fill_school
  BEFORE INSERT OR UPDATE ON public.match_results
  FOR EACH ROW EXECUTE FUNCTION public.match_results_fill_school();
```

### 2.2 Enlaces y flag de escuela

```sql
ALTER TABLE public.training_microcycle_days
  ADD COLUMN IF NOT EXISTS match_id uuid REFERENCES public.match_results(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_training_microcycle_days_match ON public.training_microcycle_days (match_id);

ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS share_match_evaluations boolean NOT NULL DEFAULT false;
```

### 2.3 `school_metric_definitions` — criterios de la escuela (D3, D10, D13)

```sql
CREATE TABLE IF NOT EXISTS public.school_metric_definitions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id            uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  metric_key           text NOT NULL CHECK (metric_key ~ '^[a-z0-9_]{2,60}$'),
  display_name         text NOT NULL,
  description          text,
  scale                text NOT NULL CHECK (scale IN ('scale_1_5', 'scale_1_10', 'yes_no', 'number', 'text')),
  unit                 text,
  min_value            numeric,
  max_value            numeric,
  options              jsonb,
  applies_to           text NOT NULL DEFAULT 'match' CHECK (applies_to IN ('match', 'training', 'both')),
  sort_order           integer NOT NULL DEFAULT 0,
  is_active            boolean NOT NULL DEFAULT true,
  source_definition_id uuid REFERENCES public.sport_metric_definitions(id) ON DELETE SET NULL,
  created_by           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, metric_key)
);
CREATE INDEX IF NOT EXISTS idx_school_metric_definitions_school ON public.school_metric_definitions (school_id, is_active, sort_order);

ALTER TABLE public.school_metric_definitions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.school_metric_definitions FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.school_metric_definitions TO authenticated;

-- Lectura: miembros y familias de la escuela (la familia necesita los nombres para ver la
-- evaluación publicada del hijo). Escritura: solo administración (D3).
CREATE POLICY smd_select ON public.school_metric_definitions FOR SELECT TO authenticated
  USING ((SELECT public.is_platform_admin())
         OR school_id = ANY ((SELECT public.calendar_family_school_ids())::uuid[]));
CREATE POLICY smd_insert ON public.school_metric_definitions FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_platform_admin())
              OR school_id = ANY ((SELECT public.user_admin_school_ids())::uuid[]));
CREATE POLICY smd_update ON public.school_metric_definitions FOR UPDATE TO authenticated
  USING ((SELECT public.is_platform_admin()) OR school_id = ANY ((SELECT public.user_admin_school_ids())::uuid[]))
  WITH CHECK ((SELECT public.is_platform_admin()) OR school_id = ANY ((SELECT public.user_admin_school_ids())::uuid[]));
CREATE POLICY smd_delete ON public.school_metric_definitions FOR DELETE TO authenticated
  USING ((SELECT public.is_platform_admin()) OR school_id = ANY ((SELECT public.user_admin_school_ids())::uuid[]));
```

Convención de claves en `performance_entries.metric_key`: un criterio de escuela se guarda
como `school:<metric_key>`; una métrica global, con su clave global. Así el Informe Mensual
y la evolución del atleta distinguen el origen sin columna nueva.

### 2.4 `performance_entries` — unicidad por partido y lectura con publicación (D7, D14)

```sql
-- Dos evaluadores del mismo partido no duplican: gana el último (ON CONFLICT en el RPC).
CREATE UNIQUE INDEX IF NOT EXISTS performance_entries_competition_unique
  ON public.performance_entries (subject_type, subject_id, metric_key, context_id)
  WHERE context_type = 'competition';

-- ¿La familia puede ver la evaluación de este partido? Escuela con el flag prendido
-- Y partido publicado. SECURITY DEFINER: no depende de la RLS de school_settings.
CREATE OR REPLACE FUNCTION public.match_evaluation_visible_to_family(p_match uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.match_results mr
    JOIN public.school_settings ss ON ss.school_id = mr.school_id
    WHERE mr.id = p_match AND mr.evaluation_published_at IS NOT NULL AND ss.share_match_evaluations
  );
$$;
REVOKE ALL ON FUNCTION public.match_evaluation_visible_to_family(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_evaluation_visible_to_family(uuid) TO authenticated;

-- Lectura: se REEMPLAZA (las policies son permisivas; sumar otra no restringe nada).
DROP POLICY IF EXISTS performance_entries_select_own ON public.performance_entries;
CREATE POLICY performance_entries_select ON public.performance_entries FOR SELECT TO authenticated
  USING (
    (SELECT public.is_platform_admin())
    OR school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[])
    OR (
      ((subject_type = 'profile' AND subject_id = (SELECT auth.uid()))
       OR (subject_type = 'child' AND public.is_parent_of_child(subject_id)))
      AND (context_type <> 'competition' OR public.match_evaluation_visible_to_family(context_id))
    )
  );
```

### 2.5 Policies de `match_results` (se tiran las 5 vivas)

```sql
DROP POLICY IF EXISTS match_results_admin_all ON public.match_results;
DROP POLICY IF EXISTS match_results_select    ON public.match_results;
DROP POLICY IF EXISTS match_results_insert    ON public.match_results;
DROP POLICY IF EXISTS match_results_update    ON public.match_results;
DROP POLICY IF EXISTS match_results_delete    ON public.match_results;
ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY match_results_select ON public.match_results FOR SELECT TO authenticated
  USING ((SELECT public.is_platform_admin())
         OR school_id = ANY ((SELECT public.user_school_ids())::uuid[])
         OR team_id   = ANY ((SELECT public.calendar_family_team_ids())::uuid[]));
CREATE POLICY match_results_insert ON public.match_results FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_platform_admin())
              OR school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[]));
CREATE POLICY match_results_update ON public.match_results FOR UPDATE TO authenticated
  USING ((SELECT public.is_platform_admin()) OR school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[]))
  WITH CHECK ((SELECT public.is_platform_admin()) OR school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[]));
CREATE POLICY match_results_delete ON public.match_results FOR DELETE TO authenticated
  USING ((SELECT public.is_platform_admin()) OR school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[]));
```

El trigger corre **antes** del WITH CHECK, así que un insert del cliente que solo manda
`team_id` (ResultsPage, Fútbol) pasa la policy con el `school_id` ya lleno.

### 2.6 RPCs (todas `SECURITY DEFINER`, `search_path` fijo, gate interno, `GRANT EXECUTE … TO authenticated`)

Gate común (se repite en cada una; sin función compartida para que cada RPC sea legible sola):

```sql
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
IF NOT (v_school = ANY (public.user_staff_school_ids()) OR public.is_platform_admin()) THEN
  RAISE EXCEPTION 'Sin permiso sobre esta escuela' USING ERRCODE = '42501';
END IF;
```

| RPC | Firma | Qué hace (en una transacción) |
|---|---|---|
| `create_match` | `(p jsonb) → jsonb {match_id, calendar_event_id}` | Lee `team_id` (obligatorio), `opponent` (obligatorio), `match_date` (obligatorio), `kickoff_at`, `is_home` (default true), `match_type`, `location`, `notes`, `home_score`, `away_score`, `tournament_match_id`, `calendar_event_id` (enlazar uno existente), `create_calendar_event` (bool), `microcycle_day_id` (enlazar un día). Resuelve `v_school` desde el equipo; gate. Si `create_calendar_event`: inserta en `calendar_events` (`user_id = auth.uid()`, `event_type = 'match'`, título `Partido vs <rival>`, `start_time = COALESCE(kickoff_at, match_date 15:00 Bogotá)`, `end_time = start + 2h`, `team_id`, `location`). Inserta el partido con `status = played` si trae los dos marcadores, si no `scheduled`; `created_by/updated_by = auth.uid()`. Si `microcycle_day_id`: `UPDATE training_microcycle_days SET match_id … WHERE id AND school_id = v_school` (0 filas → error 22023) |
| `update_match` | `(p_match uuid, p jsonb) → jsonb` | Gate por la escuela del partido. Actualiza solo las claves presentes en `p` (`opponent, match_date, kickoff_at, is_home, match_type, location, notes, home_score, away_score, status`). Si llegan los dos marcadores y estaba `scheduled` → `played`. Si cambia `kickoff_at`/`match_date` y hay evento enlazado, mueve el evento. `updated_by = auth.uid()` |
| `save_match_roster` | `(p_match uuid, p_players jsonb) → integer` | Gate. Upsert de `match_lineups` (`source_type = 'team_match'`, `source_id = p_match`, `ON CONFLICT (source_type, source_id) DO UPDATE SET updated_at`). Borra los `match_lineup_players` del lineup y vuelve a insertar los de `p_players` (`[{subject_type, subject_id, role, minutes_played, position_code?, jersey_number?}]`) — borrar-e-insertar dentro de la misma transacción es atómico y evita depender de un índice único que hoy no existe. Devuelve cuántos quedaron |
| `submit_match_evaluation` | `(p_match uuid, p_entries jsonb) → integer` | Gate. Por cada `{subject_type, subject_id, metric_key, value, notes}`: `INSERT … ON CONFLICT (subject_type, subject_id, metric_key, context_id) WHERE context_type = 'competition' DO UPDATE SET value, notes, recorded_by = auth.uid(), recorded_at = now()`. `context_type = 'competition'`, `context_id = p_match`, `school_id = v_school`. Criterio `text`: `value NULL`, texto en `notes`. Si el partido estaba `scheduled` pasa a `played`. Devuelve filas escritas |
| `publish_match_evaluation` | `(p_match uuid, p_publish boolean) → timestamptz` | Gate. `evaluation_published_at = CASE WHEN p_publish THEN now() END`, `updated_by` |
| `link_day_to_match` | `(p_day uuid, p_match uuid) → void` | Gate por la escuela del día. `p_match NULL` desenlaza. Si `p_match` no es de la misma escuela → 22023 |
| `seed_school_match_criteria` | `(p_school uuid) → integer` | Gate **admin** (`user_admin_school_ids()`). Inserta los 7 por defecto con `ON CONFLICT (school_id, metric_key) DO NOTHING`: `actitud` Actitud y compromiso · `tecnica` Técnica · `decisiones` Toma de decisiones · `fisico` Físico · `comunicacion` Comunicación · `rol` Cumplimiento del rol (todos `scale_1_5`, min 1, max 5) · `comentario` Comentario del coach (`text`). Devuelve cuántos creó |

Al final de cada `CREATE FUNCTION`: `REVOKE ALL ON FUNCTION … FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION … TO authenticated;`.

---

## 3. Verificación después de aplicar (se corre en la misma sesión)

| # | Prueba | Esperado |
|---|---|---|
| T1 | `SELECT count(*) FROM match_results WHERE school_id IS NULL` | 0 |
| T2 | `SELECT status, count(*) FROM match_results GROUP BY 1` | played 21 · scheduled 3 |
| T3 | Sesión simulada del papá de Besser (Carlos, PRE JUVENIL): `SELECT count(*) FROM match_results` | 15 (sigue viendo los de su escuela, como hoy); `INSERT` → 42501; `SELECT create_match(...)` → 42501 |
| T4 | Sesión simulada de Duván (coach): `create_match` para PRE JUVENIL con `create_calendar_event = true` | Devuelve `match_id` y `calendar_event_id`; el evento tiene `team_id` y `school_id` de Besser; el partido tiene `school_id` por trigger y `status = scheduled` |
| T5 | Duván: `submit_match_evaluation` dos veces seguidas con el mismo jugador y criterio, valores 3 y 5 | **1 fila** con `value = 5` (índice único + ON CONFLICT). La prueba concurrente real (dos requests con `Promise.all`) va en F2 contra el endpoint |
| T6 | Carlos: `SELECT * FROM performance_entries WHERE context_id = <partido>` con el partido sin publicar | 0 filas. Tras `publish_match_evaluation(…, true)` **y** `share_match_evaluations = true` en Besser → ve solo las filas de su hija |
| T7 | Carlos: `SELECT count(*) FROM performance_entries WHERE subject_id <> <su hija>` | 0 (antes veía las 683 de cualquier escuela donde fuera miembro) |
| T8 | `npm run seguridad:invariantes` | Sin críticas; `match_results` y `school_metric_definitions` no aparecen en I2/I3/I4 |
| T9 | `ResultsPage` en dev: crear un resultado como hasta hoy (sin `school_id`) | Se crea; `school_id` lleno; aparece en la lista |
| T10 | Limpieza: borrar el partido y el evento creados en T4 (`DELETE` como Duván, la policy de staff lo permite) | 0 filas residuales |

---

## 4. Radio de impacto (lo que cambia para alguien que hoy puede hacer algo)

- **`performance_entries` lectura:** hoy un **padre o atleta** miembro activo de la escuela lee
  las 683 evaluaciones de todos. Después: solo las propias o de su hijo (y las de partido,
  solo publicadas). El staff no pierde nada. Ninguna pantalla de padre/atleta consulta
  evaluaciones ajenas (las de reportes van por el BFF con service role).
- **`match_results` escritura:** hoy escriben los roles `owner/admin/staff/coach/super_admin/
  school_admin` por `school_members`. `user_staff_school_ids()` cubre esos mismos roles **más**
  `school_staff` con `coach_auth_id` (coaches que no son `school_members`, caso Carmel) y el
  `owner_id` de la escuela. Nadie pierde; algunos coaches ganan.
- **`match_results` lectura:** igual que hoy (miembros) más la familia del equipo.
- **Código existente:** `ResultsPage`, `useFootballData`, `useSchoolData`, `reports.ts` y
  `report-snapshot.service.ts` siguen leyendo/escribiendo las mismas columnas; las nuevas
  tienen default. `frontend/src/integrations/supabase/types.ts` se regenera en F2.

---

## 5. Rollback (si algo sale mal en T3–T9)

Las columnas nuevas son inofensivas y se dejan. Lo que se revierte son las policies:

```sql
DROP POLICY IF EXISTS performance_entries_select ON public.performance_entries;
CREATE POLICY performance_entries_select_own ON public.performance_entries FOR SELECT
  USING (((subject_type = 'profile') AND (subject_id = auth.uid()))
      OR ((subject_type = 'child') AND is_parent_of_child(subject_id))
      OR (school_id = ANY (user_school_ids())));
-- match_results: recrear las 5 policies con el texto exacto guardado en §1 de este plan
-- (pg_policies del 2026-09-26) — se copia en el archivo de migración como comentario.
```

---

## 6. Qué sigue después de F1

- **F2 · BFF:** `school/matches` (list/create/update/roster/evaluate/publish/delete),
  `school/evaluation-criteria` (list/create/update/reorder/seed/plantillas),
  `metric-catalog.service` resuelve escuela → global, `ResultsPage`/`useFootballData` dejan de
  escribir directo, prueba de concurrencia real, OpenAPI.
- **F3 · UI:** Resultados nueva + Criterios (admin).
- **F4:** Calendario ↔ partido + mesociclo (día editable/borrable, «Registrar partido»).
- **F5:** familia + Informe Mensual + manual.

**Para arrancar F1:** con un «aplica» creo la migración con `npm run migrations:new`, la aplico
con `apply_migration`, corro T1–T10 y te muestro los resultados.
