# Plan P2a+P2b — Plantillas tácticas guardadas (fases de juego + balón parado)

> **Estado: para aprobación.** No se escribe SQL hasta que esto esté aprobado.
> Spec de referencia: `docs/specs/football-tactical-experience.md` (pieza 3).
> Sigue a P0 (`docs/plan-p0-tablero-tactico.md`, ya aplicado).

---

## 0. Por qué P2a y P2b comparten UNA tabla, no dos

Un córner y un "presión alta" son lo mismo desde el modelo de datos: un
conjunto de posiciones con nombre, sin jugadores específicos asignados
todavía. La única diferencia es la **situación** (`ataque`, `defensa`,
`corner`, `tiro_libre`...). Separarlas en dos tablas duplicaría RLS, BFF y
frontend por una diferencia que es solo un valor de columna — mismo
razonamiento que ya se aplicó en P0 para no crear 3 tablas nuevas.

## 1. A diferencia de P0, esto SÍ es una tabla nueva

P0 pudo extender `match_lineups`/`match_lineup_players` porque una plantilla
guardada **no está atada a un partido o entrenamiento concreto** — es
reutilizable entre fechas. No hay tabla existente de la que colgarse.

```sql
CREATE TABLE public.team_tactical_presets (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id    uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    team_id      uuid        NOT NULL REFERENCES public.teams(id)   ON DELETE CASCADE,
    name         text        NOT NULL CHECK (length(btrim(name)) > 0),
    situation    text        NOT NULL CHECK (situation = ANY (ARRAY[
                     'ataque','defensa','presion','transicion',
                     'corner','tiro_libre','penalti'
                 ])),
    slots        jsonb       NOT NULL,  -- [{slot_label, x, y}], SIN subject_id (ver D8)
    created_by   uuid        NOT NULL REFERENCES public.profiles(id),
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);
```

RLS y grants calcados de `match_lineups` (`20260812182000`): mismo patrón de
`STAFF_ROLES` a nivel BFF + `school_id = ANY (user_school_ids())` a nivel RLS
— sin restringir a admin, porque el resto del módulo de fútbol tampoco lo
hace (el coach ya puede crear alineaciones hoy).

## 2. Decisión D8 — el preset guarda LAYOUT, no jugadores

`slots` es `[{slot_label, x, y}]` — **sin** `subject_id`. Por qué: la
plantilla vive semanas o meses; la plantilla de jugadores (quién está
disponible) cambia por lesiones, ausencias, etc. Guardar `subject_id` haría
que aplicar un preset viejo intente ubicar a un jugador que ya no está, en
silencio. Con solo layout, aplicar un preset simplemente coloca los slots
vacíos en la cancha y el coach arrastra encima a quien esté disponible ESE
día — es más trabajo manual pero nunca miente.

## 3. Cómo se "aplica" un preset — sin RPC nueva

Aplicar un preset es 100% frontend: el `TacticalBoard` lee
`GET .../tactical-presets?team_id=`, y al elegir uno, puebla su estado local
(`placed`) con los slots del preset **sin** `subject_id` — o sea, posiciones
marcadas pero sin jugador. El coach sigue arrastrando jugadores desde la
banca a esos puntos. Guardar la alineación sigue siendo exactamente el mismo
`POST /football/lineups` que ya existe. Nada nuevo que tocar ahí.

## 4. BFF — nuevas rutas en `football.ts`

```
GET    /api/v1/school/football/tactical-presets?team_id=      lista (STAFF_ROLES)
POST   /api/v1/school/football/tactical-presets                crea  (STAFF_ROLES)
PUT    /api/v1/school/football/tactical-presets/:id             edita (STAFF_ROLES, dueño de la escuela)
DELETE /api/v1/school/football/tactical-presets/:id             borra (STAFF_ROLES)
```

Mismo patrón que el resto del archivo: `supabase` (service role) +
`assertTeamBelongsToSchool` para create, `.eq('school_id', schoolId)` en
update/delete para no tocar presets de otra escuela.

## 5. Frontend

- `TacticalBoard.tsx`: selector de **situación** (7 valores de D8) arriba de
  la cancha, botón "Guardar como plantilla" (abre un input de nombre) y un
  dropdown "Cargar plantilla" que filtra por la situación elegida.
- Al cargar un preset, si ya había jugadores puestos, se pide confirmación
  (reemplaza el layout actual) — no se pisa en silencio.

### 5.1 Bug encontrado y corregido (post-implementación, con flechas/curvas/zonas ya en juego)

El `PUT` de la sección 4 estaba en el BFF desde el principio, pero el
frontend **nunca lo llamaba** -- `handleSaveAsPreset` siempre hacía `POST`,
así que "editar" una plantilla cargada en realidad creaba una copia nueva
cada vez, dejando la original intacta. Se agregó `updateTacticalPreset` +
`useUpdateTacticalPreset`, y el toolbar ahora distingue **Actualizar**
(PUT sobre la plantilla cargada) de **Guardar como nueva** (POST, ícono `+`,
solo visible cuando ya hay una cargada).

De paso, `handleLoadPreset` reconstruía cada flecha sin su campo `type` --
una curva o zona guardada volvía como flecha recta al recargarla. Corregido
en el mismo pase.

## 6. Qué necesito de ti para seguir

D8 y "compartir tabla" (sección 0) son los cambios de diseño reales — los
dejo con mi recomendación aplicada arriba porque tienen poco margen de
ambigüedad (a diferencia de D1/D2 en P0). Si estás de acuerdo, reservo la
migración y escribo el DDL + BFF + frontend como en P0.
