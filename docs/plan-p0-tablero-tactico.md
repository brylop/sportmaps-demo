# Plan P0 — Tablero táctico base

> **Estado: para aprobación.** No se escribe SQL hasta que esto esté aprobado
> (convención del repo: *plan antes de código en migraciones*).
>
> Spec de referencia: `docs/specs/football-tactical-experience.md` — D1, D2,
> D5 ya resueltos ahí. Este plan es la implementación de **P0** únicamente.

---

## 0. Decisión de diseño que cambia el punto de partida de la spec

La spec (sección 3) dibujaba 3 tablas nuevas (`tactical_sessions`,
`tactical_slots`, `tactical_slot_assignments`). Al planear el DDL real me
encontré con que **`match_lineups`/`match_lineup_players` (`20260812182000`)
ya cubren el 90% de eso**: identidad polimórfica de partido
(`source_type`/`source_id`), identidad polimórfica de jugador
(`subject_type`/`subject_id`), RLS ya escrita y probada, `formation text` ya
existe como columna (hoy sin uso real).

Construir 3 tablas nuevas en paralelo duplicaría ese trabajo y crearía dos
modelos de "alineación" compitiendo. **Propongo EXTENDER, no reemplazar**:

| En vez de… | Hago… |
|---|---|
| `tactical_sessions` nueva | Nada — `match_lineups` ya es la sesión. Se le agrega soporte para `context='training'` (D5) ampliando el CHECK de `source_type`. |
| `tactical_slots` nueva | Nada — el slot vive como columnas nuevas (`slot_label`, `x`, `y`) directamente en `match_lineup_players`. No hay "slot vacío" persistido: la cancha en el frontend muestra posiciones sugeridas, pero solo se guarda una fila cuando el coach suelta un jugador ahí. Simplifica el modelo y evita inventar un concepto de fila fantasma. |
| `tactical_slot_assignments` nueva | Nada — es lo que ya es `match_lineup_players`, con 3 columnas más. |

Esto **sigue cumpliendo D1 y D2**: D1 (formación libre) se logra con `x`/`y`
libres en vez de un catálogo; D2 (`position_code` reemplazado) se logra
dejando de leer/escribir esa columna desde el código nuevo — la columna y su
CHECK quedan intactos en la tabla (no se toca ni se borra), simplemente el
tablero nuevo no la usa. Es el reemplazo más barato y más reversible posible.

**Si prefieres las 3 tablas nuevas de la spec original en vez de este
approach de extensión, dímelo antes de que siga** — el resto de este plan
asume la extensión.

---

## 1. Bloqueador de D5 (entrenamientos) — resuelto

Antes de escribir el CHECK ampliado, verifiqué contra la base viva
(`luebjarufsiadojhvxgi`) qué es realmente `training_sessions`, porque no
tiene `CREATE TABLE` en una migración reciente identificable (misma clase de
duda que ya se documentó para otras tablas de este repo):

```
id (uuid), team_id (uuid), session_date (date), session_time (time, nullable),
created_at, max_capacity (int, nullable), current_bookings (int, nullable)
```

**No tiene `school_id`** — a diferencia de `match_lineups`. Para usarla como
`source_id` cuando `source_type='training_session'`, el `school_id` de
`match_lineups` se resuelve por `team_id → teams.school_id` en el momento de
insertar (el BFF ya conoce `req.schoolId` de todas formas, así que en la
práctica no es más que una validación extra: "el `team_id` de esta sesión de
entrenamiento pertenece a mi escuela").

---

## 2. DDL propuesto

Migración nueva (reservar con `npm run migrations:new -- tactical_board_p0`).
Todo `ALTER TABLE` sobre tablas con tráfico real sigue el patrón anti-lock de
`20260731160301_regularize_performance_schema_lockfree.sql` (chequear
catálogo antes de tomar lock, `SET LOCAL lock_timeout`).

```sql
-- 1. match_lineups: permitir entrenamiento como fuente (D5).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'match_lineups_source_type_check_v2'
          AND conrelid = 'public.match_lineups'::regclass
    ) THEN
        ALTER TABLE public.match_lineups
            DROP CONSTRAINT IF EXISTS match_lineups_source_type_check;
        ALTER TABLE public.match_lineups
            ADD CONSTRAINT match_lineups_source_type_check_v2
            CHECK (source_type = ANY (ARRAY['team_match','tournament_match','training_session']));
    END IF;
END $$;

-- 2. match_lineup_players: slot libre (D1) — label + coordenadas.
--    Nullable a propósito: las filas viejas (position_code, sin x/y) siguen
--    siendo válidas y legibles; el tablero nuevo solo puebla estas 3 columnas
--    hacia adelante. position_code NO se toca (D2: reemplazo por desuso, no
--    por DROP).
ALTER TABLE public.match_lineup_players
    ADD COLUMN IF NOT EXISTS slot_label text,
    ADD COLUMN IF NOT EXISTS x numeric(5,2) CHECK (x IS NULL OR (x >= 0 AND x <= 100)),
    ADD COLUMN IF NOT EXISTS y numeric(5,2) CHECK (y IS NULL OR (y >= 0 AND y <= 100));
```

**No hace falta tocar RLS.** Las 4 policies de `match_lineups` y las 4 de
`match_lineup_players` (`20260812182000`) ya cubren exactamente el mismo
patrón de acceso que necesita el tablero — son columnas nuevas sobre una
tabla ya gobernada, no una tabla nueva sin policies.

### 2.1 Lo que este DDL NO resuelve todavía

- No hay RPC nueva: el CRUD de `match_lineup_players` ya pasa por el BFF
  (`football.ts`) con `userClient(req)`, y las policies existentes bastan.
  El BFF solo necesita aceptar `slot_label`/`x`/`y` en el body — es un cambio
  de Zod schema, no de autorización.
- La validación "¿el `team_id` de esta `training_session` es de mi escuela?"
  va en el BFF al crear un `match_lineups` con `source_type='training_session'`
  — mismo lugar donde hoy se valida `team_id` para `team_match`.

### 2.2 Validado contra la base viva (no solo contra el archivo de migración)

Comparé `information_schema.columns` y `pg_constraint` reales de
`luebjarufsiadojhvxgi` contra lo que este plan asume — **sin drift**: los
nombres de constraint (`match_lineups_source_type_check`,
`match_lineup_players_position_code_check`, etc.) coinciden exactamente con
lo que el `DROP/ADD CONSTRAINT` de la sección 2 espera encontrar. Tráfico
real hoy: `match_lineups`=1 fila, `match_lineup_players`=14,
`football_match_events`=3 — riesgo de lock insignificante en la práctica.

También audité el otro consumidor que me preocupaba —
`bff/src/services/report-snapshot.service.ts` (el Informe Mensual del
Atleta, ya en producción) — lee `match_lineup_players`/`match_lineups` pero
filtra explícitamente `source_type IN ('team_match','tournament_match')`.
Las filas nuevas con `'training_session'` quedan excluidas del conteo de
"partidos jugados" sin tocar ese archivo — es el comportamiento correcto
(un entrenamiento no es un partido), no una coincidencia frágil.

**Dos puntos que SÍ hay que tocar y no estaban en la sección 2:**

- `bff/src/routes/school/football.ts:8` — `VALID_SOURCE_TYPES =
  ['team_match','tournament_match']` es UN SOLO array que gobierna tanto el
  endpoint de alineación (línea 278) como el de eventos de partido (línea
  446, goles/tarjetas). Ampliarlo tal cual dejaría registrar goles en un
  entrenamiento. Se separa en dos constantes:
  `VALID_LINEUP_SOURCE_TYPES` (agrega `'training_session'`) y
  `VALID_EVENT_SOURCE_TYPES` (se queda igual).
- `frontend/src/lib/school/footballQueries.ts:11` — mismo problema con el
  tipo `FootballSourceType`, usado para ambos casos. Se separa en
  `LineupSourceType` y `EventSourceType`.

---

## 3. Frontend — reemplazo de `LineupModal.tsx`

- **Librería**: `@dnd-kit/core` + `@dnd-kit/utilities` (D7). Pointer events
  unificados (mouse + touch), sin depender de HTML5 Drag and Drop nativo —
  que en WebViews de Capacitor es conocido por comportarse mal.
- **Componente nuevo**: `TacticalBoard.tsx` — cancha SVG/CSS a la que se le
  sueltan jugadores desde una lista lateral (el roster del equipo, filtrando
  a los ya colocados). Cada jugador soltado crea/actualiza su fila en
  `match_lineup_players` con `x`/`y` del punto de soltado y `slot_label`
  editable (doble clic o campo al lado).
- **Reutiliza**, no reimplementa: `useFootballData.ts` (roster, ya existe),
  el mismo patrón de mutación optimista que ya usa `LineupModal.tsx` hoy.
- **Punto de entrada compartido (D5)**: el mismo `TacticalBoard` se monta
  tanto desde `FootballDashboardModal` (contexto partido) como desde un
  nuevo punto de entrada en `TrainingPlansPage` (contexto entrenamiento) —
  mismo componente, prop `sourceType` distinta.
- **Prueba obligatoria antes de cerrar la fase (R1 de la spec)**: drag-and-
  drop probado en el APK real de Android (no solo en el navegador del
  preview), por el riesgo documentado de que pointer events se comporten
  distinto dentro del WebView de Capacitor.

`LineupModal.tsx` no se borra en este PR — queda como fallback accesible
hasta confirmar que el tablero nuevo se usa sin fricción en producción; se
retira en un PR aparte una vez validado.

---

## 4. Qué necesito de ti para seguir

1. **Aprobar la sección 0** — extender `match_lineups`/`match_lineup_players`
   en vez de las 3 tablas nuevas que dibujaba la spec original. Es el cambio
   más grande de este plan respecto a lo ya acordado.
2. Con eso aprobado, reservo la migración (`npm run migrations:new`), escribo
   el DDL final + el diff de Zod/BFF, y armamos el `TacticalBoard.tsx` — cada
   uno como su propio patch, igual que con Informes.
