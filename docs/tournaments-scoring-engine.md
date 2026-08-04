# Motor de Calificación de Torneos — Diseño

> Estado: **diseño** (Fase 2 de [Torneos por Escuela]). Sin implementar aún.
> Última actualización: 2026-07-13.
> Contexto/decisiones previas: memoria `project_school_tournaments`.

## 1. Objetivos

1. **Reglamento claro y fácil de actualizar.** Los reglamentos deportivos cambian por temporada (ciclos USAG 2021-2029, ICU/IASF 2025-2026, Código FIG 2025-2028). Actualizar = publicar una versión nueva, sin romper torneos pasados.
2. **La escuela crea torneos por deporte sin fricción.** Elige el deporte → el sistema le sugiere la(s) plantilla(s) oficial(es) vigentes → las selecciona (y ajusta solo si quiere). No tiene que saber de fórmulas.
3. **Los organizadores igual.** Mismo motor y mismo flujo; solo cambia el dueño del torneo (`owner_type = school | organizer`).

## 2. Principios de diseño

- **Biblioteca central de plantillas oficiales** (mantenida por admin SportMaps), no cada escuela inventando. La escuela **selecciona**; **clona solo si necesita personalizar**.
- **Motor por arquetipo, config por deporte.** 50+ deportes → ~6 arquetipos de cálculo. Este documento cubre el **Arquetipo A (juzgado/panel)** — cheer + gimnasia. Los otros arquetipos reusan el mismo esqueleto de tablas.
- **Versionado por temporada.** El "reglamento" es un dato versionado (`scoring_rulesets`), no código. Cambio de año = fila nueva; las plantillas apuntan a su versión.
- **La fórmula es dato, no código.** El motor de cómputo interpreta un `config` jsonb; no hay lógica hardcodeada por deporte.

## 3. Hallazgos de la investigación (fundamento)

Investigación de reglamentos colombianos (deep-research 2026-07-13, verificada). Resumen operativo:

- **MinDeporte NO define scoring** (Res. 000093/2025): delega a los reglamentos técnicos de cada federación → las plantillas salen de **federaciones**.
- **Gimnasia (FEDECOLGIM)** — dos vías paralelas para GAF:
  - **USAG** (masificación escolar): base `10.0 − deducciones` ("Tabla de Penalidades"), adaptación local "USAG-COLOMBIA V6 2022". Niveles 1-5 SV 10.0; 6-10 usan FIG.
  - **FIG** (Grupo de Edades): `nota = D + E`, E parte de 10.0, agregación **drop-high-low**, panel 2D+7E (modificable en nacional/local).
- **Porrismo (FEDECOLCHEER)** — adopta/adapta **ICU + IASF** (no ECU, no código propio). Rúbrica = **suma ponderada de componentes** (Animación, Partner Stunts, Pirámides, Lanzamientos, Gimnasia) rangos 0-10/0-25 + Deducciones e Ilegalidades. Rúbrica distinta por división/nivel.

→ El motor debe soportar **3 modelos de cálculo**: `base_minus_deductions`, `additive_d_e`, `weighted_components`.

## 4. Modelo de datos

```
scoring_rulesets ──1:N──> scoring_formats ──ref──> event_categories_config.scoring_format_id
                                                            │
tournament_judge_scores ──(compute RPC)──> tournament_standings
```

### 4.1 `scoring_rulesets` — el reglamento versionado (fácil de actualizar)
| col | tipo | nota |
|---|---|---|
| id | uuid PK | |
| body | text | 'FEDECOLGIM-USAG', 'FEDECOLGIM-FIG', 'FEDECOLCHEER-ICU', 'FEDECOLCHEER-IASF', 'FIG', 'CUSTOM' |
| discipline | text | 'gimnasia_artistica', 'porrismo', ... |
| sport_category_id | uuid FK | → sports_categories |
| season_year | int | ej. 2026 |
| version_label | text | 'USAG-COLOMBIA V6 2022', 'ICU 2026', 'FIG 2025-2028' |
| source_url | text | PDF oficial de la fuente |
| effective_from / effective_until | date | vigencia |
| status | text | 'draft' \| 'active' \| 'archived' |
| created_at | timestamptz | |

**Actualizar un reglamento** = insertar una fila nueva (season siguiente) + marcar la vieja `archived`. Los torneos ya jugados siguen apuntando a su versión → historia intacta.

### 4.2 `scoring_formats` — la plantilla computable
| col | tipo | nota |
|---|---|---|
| id | uuid PK | |
| ruleset_id | uuid FK | → scoring_rulesets |
| sport_category_id | uuid FK | |
| name | text | 'Cheer Colegial N1 (ICU 2026)' |
| archetype | text | 'judged_panel' (A), 'race' (C), ... |
| division / level | text null | mapea a event_categories_config |
| config | jsonb | **la fórmula** (§5) |
| is_template | bool | true = biblioteca oficial |
| owner_school_id | uuid null | set si es clon de una escuela |
| owner_organizer_id | uuid null | set si es clon de un organizador |
| is_active | bool | |
| created_at / updated_at | timestamptz | |

Regla: `is_template=true AND owner_* IS NULL` = plantilla global (biblioteca). Un clon copia el `config` y setea el `owner_*` correspondiente (XOR school/organizer).

### 4.3 Enganche con lo existente
- `event_categories_config` **+ `scoring_format_id uuid`** (FK nullable). Cada categoría/división del torneo usa una plantilla. Ya tiene `division/level/category/rama` para el match automático.
- `sport_metric_definitions` → fuente de `metric_key` para los componentes cuando aplique.

### 4.4 Captura y resultado
- `tournament_judge_scores` — un renglón por (competidor, juez, componente): `event_id, category_id, competitor_ref (team/athlete), judge_id, component_key, raw_score, created_at`.
- `tournament_standings` — resultado calculado: `event_id, category_id, competitor_ref, final_score, rank, breakdown jsonb, computed_at`.

## 5. Spec del `config` jsonb

Campos comunes a todos los modelos:

```jsonc
{
  "archetype": "judged_panel",
  "model": "weighted_components",          // base_minus_deductions | additive_d_e | weighted_components
  "higher_is_better": true,
  "score_scale": { "min": 0, "max": 100 },
  "panel": {
    "aggregation": "drop_high_low",        // drop_high_low | average | sum | single
    "drop_high": 1, "drop_low": 1,
    "min_scores_for_drop": 5               // si hay menos jueces, cae a 'average'
  },
  "tie_breakers": [                         // orden = prioridad
    { "order": 1, "rule": "highest_component", "component": "dificultad" },
    { "order": 2, "rule": "lowest_deductions" }
  ],
  "penalties": [                            // ilegalidades / tiempo / límites (restan al total)
    { "code": "tiempo_excedido", "label": "Excede tiempo", "value": 0.5 }
  ]
}
```

### 5.1 Modelo `weighted_components` (Porrismo ICU/IASF)
```jsonc
{
  "model": "weighted_components",
  "components": [
    { "key": "animacion",      "label": "Animación",        "min": 0, "max": 10, "weight": 1, "judges": 2 },
    { "key": "partner_stunts", "label": "Partner Stunts",   "min": 0, "max": 25, "weight": 1, "judges": 2 },
    { "key": "piramides",      "label": "Pirámides",        "min": 0, "max": 25, "weight": 1, "judges": 2 },
    { "key": "lanzamientos",   "label": "Lanzamientos",     "min": 0, "max": 15, "weight": 1, "judges": 2 },
    { "key": "gimnasia",       "label": "Gimnasia (tumbling)","min": 0,"max": 25, "weight": 1, "judges": 2 }
  ],
  "deductions": [
    { "code": "caida",     "label": "Caída",       "value": 0.5, "type": "per_occurrence" },
    { "code": "ilegalidad","label": "Ilegalidad",  "value": 1.0, "type": "per_occurrence" }
  ],
  "formula": "sum(component_agg * weight) - sum(deductions) - sum(penalties)"
}
```

### 5.2 Modelo `additive_d_e` (Gimnasia vía FIG)
```jsonc
{
  "model": "additive_d_e",
  "components": [
    { "key": "D", "label": "Dificultad", "min": 0, "max": null, "judges": 2, "aggregation": "average" },
    { "key": "E", "label": "Ejecución",  "base": 10.0,          "judges": 7, "aggregation": "drop_high_low" }
  ],
  "neutral_deductions": [
    { "code": "linea",  "value": 0.1 },
    { "code": "tiempo", "value": 0.1 }
  ],
  "formula": "D + E - sum(neutral_deductions)",
  "apparatus": ["salto", "barras", "viga", "suelo"],   // opcional multi-aparato
  "all_around": "sum"                                   // total = suma de aparatos
}
```

### 5.3 Modelo `base_minus_deductions` (Gimnasia USAG N1-5)
```jsonc
{
  "model": "base_minus_deductions",
  "base_value": 10.0,
  "panel": { "aggregation": "average" },
  "deductions_ref": "tabla_penalidades_usag_v6",   // set de deducciones nombrado (poblar de PDF)
  "formula": "base_value - sum(deductions)",
  "apparatus": ["salto", "barras", "viga", "suelo"],
  "all_around": "sum"
}
```

## 6. Motor de cómputo (RPC)

`compute_tournament_standings(event_id, category_id)`:
1. Lee la plantilla (`event_categories_config.scoring_format_id → scoring_formats.config`).
2. Lee `tournament_judge_scores` de esa categoría.
3. Por competidor y componente: aplica `panel.aggregation` (drop-high-low con la tabla de tamaño de panel, o promedio/suma).
4. Aplica `formula` del modelo → puntaje por aparato/rutina → agrega (`all_around`) si aplica.
5. Resta `deductions` + `penalties`.
6. Ordena por `higher_is_better`; resuelve empates con `tie_breakers` en orden.
7. Escribe `tournament_standings` (con `breakdown` para auditoría/transparencia).

Convenciones al implementar: `SET search_path`, `SECURITY DEFINER` + `GRANT EXECUTE`, RLS sin auto-recursión (ver memorias de feedback).

## 7. Flujo UX — crear torneo (escuela y organizador, idéntico)

1. Activa torneos (addon `tournaments`) → **Crear torneo** → elige **deporte**.
2. El sistema sugiere las **plantillas oficiales vigentes** para ese `sport_category_id` (último `scoring_ruleset` `active`), agrupadas por división/nivel.
3. Por cada categoría del torneo: **selecciona** una plantilla. (Botón "Personalizar" → clona a `owner_*` y permite editar pesos/deducciones/panel.)
4. Listo. El torneo queda con `scoring_format_id` por categoría; en resultados, los jueces cargan por componente y el RPC calcula.

Diferencia escuela vs organizador: solo `owner_type`. Mismo wizard, misma biblioteca.

## 8. Actualización de reglamentos (operación)

- Admin SportMaps publica, por temporada, un `scoring_ruleset` nuevo + sus `scoring_formats` (is_template global).
- Marca la versión anterior `archived`.
- Torneos nuevos sugieren la vigente; torneos históricos mantienen su versión → resultados reproducibles.
- Clones de escuelas/organizadores no se tocan al actualizar (opcional: avisar "hay versión nueva del reglamento").

## 9. Gaps a poblar (datos de plantilla, no bloquean el motor)

Los valores celda-a-celda viven en PDFs (no en HTML). Cargar como datos de plantilla:
1. **Tabla de Penalidades USAG** (valores de deducción) — fedecolgim.co.
2. **Rangos/pesos por componente ICU/IASF** + rúbricas Liga Bogotana — fedecolcheer.com.co, ligabogotanadeporrismo.com.
3. **Gimnasia rítmica y trampolín** en Colombia (sin evidencia directa aún) — fedecolgim.co.
4. **Tie-breakers exactos** por disciplina; y para GAF-USAG confirmar nº de jueces y si drop-high-low o promedio simple.

El motor y las tablas se construyen **sin** estos valores; las plantillas se afinan cuando se extraigan.
