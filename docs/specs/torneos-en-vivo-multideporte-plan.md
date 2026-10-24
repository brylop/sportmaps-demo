# Torneos en vivo para todos los deportes — plan

**Fecha:** 2026-10-24 · **Estado:** PLAN para aprobar. No hay código ni migración escritos.
**Regla de la casa:** plan antes de código en migraciones; una sola sesión aplica DDL; nada a `main` sin pedirlo.
**Cómo leer:** §1 y §2 son lo que hay HOY (verificado en la base y el código el 2026-10-24); §3 en adelante es propuesta. Los tiempos son tamaños relativos (S/M/L), no fechas.

---

## 0. Qué queremos

Que un torneo creado en SportMaps **genere en vivo** su calendario, marcadores, tabla y cuadro, para **cualquier deporte**, con:

1. **Interruptor por torneo** para activar o desactivar lo «en vivo» (apagado = se ve solo el resultado final, como hoy).
2. **Página pública** sin login, con enlace y QR, que se actualiza sola.
3. **Anotador en la cancha** desde el celular, sin necesidad de cuenta.
4. **Más adelante: transmisión.** Mostrar en pantalla grande y enlazar el video que la escuela ya transmite (YouTube/Facebook).

Principios: genérico por **modelo de marcador** (no una pantalla por deporte); **opt-in** por torneo; lo que funciona hoy no cambia; sin exponer datos de menores en lo público.

---

## 1. Lo que ya hay (verificado)

### Base de datos
| Pieza | Estado |
|---|---|
| `events` | 12 eventos (11 de escuela). Campos útiles: `competition_format` (CHECK: `liga`, `copa`, `grupos`, `americano`), `tournament_scope`, `sport`, `slug`, `school_id`, `visibility`, `status`. |
| `tournament_matches` | `event_id`, `category_id`, `round`, `slot`, `home_team_id`, `away_team_id`, `home_score`, `away_score`, `status`, `scheduled_at`, `venue`, `notes`. **`status` solo admite** `scheduled`, `played`, `walkover`, `cancelled` (CHECK). 5 partidos hoy: 2 programados, 2 jugados, 1 walkover. |
| `tournament_match_events` | `match_id`, `team_id`, `member_id`, `type` (CHECK: `goal`, `own_goal`, `yellow`, `red`, `assist`), `minute`. Pensado para fútbol. |
| Equipos y delegaciones | `event_teams`, `event_team_members`, `event_delegations`, `event_categories_config`, pagos de inscripción. |
| Plantillas de categorías | `sport_category_templates` con **9 deportes**: atletismo, baloncesto, cheerleading, fútbol, futsal, gimnasia, natación, porras, voleibol. El catálogo (`sports_categories`) tiene **100 deportes**. |
| RLS | `tmatches_manage/read` y `tmevents_manage/read` solo para `authenticated`. **Nada para `anon`:** la página pública pasa por el BFF. |
| Tiempo real | `tournament_matches` **no** está en la publicación `supabase_realtime`. |

### BFF (`bff/src/routes/events.route.ts`, 2.291 líneas)
- Crear torneo de escuela (con control de que el complemento `tournaments` esté activo).
- `generate-fixtures`: **liga** (todos contra todos, `roundRobinRounds`) y **copa** (eliminación directa con sorteo/bye y `advanceWinner`).
- `GET matches`, `PATCH matches/:matchId` (marcador entero + goles opcionales; marca `played`, avanza al ganador en copa salvo empate, **notifica a los integrantes de los dos equipos**).
- `GET standings` (tabla + goleadores) y `GET public-results` (sin login).
- **Tabla de posiciones escrita dos veces** (copia en `standings` y en `public-results`), **solo lógica de fútbol**: 3/1/0 puntos, empates, diferencia de gol, goles a favor.
- Solo `school` / `school_admin` pueden cargar resultados.

### Frontend
- `SchoolTournamentDetailPage.tsx` (749 líneas), pestaña **Resultados**: generar calendario, tabla, goleadores, cargar marcadores.
- `TournamentResultsPage.tsx` (85 líneas, pública `/tournaments/:id/results`): **solo la tabla de posiciones, carga una vez**, con botón de compartir.
- Existe un hook de tiempo real (`useRealtime.ts`) que se usa en otras pantallas.

### Gating
- El complemento **Torneos** está **apagado en Monster** (`tournaments:false`). Besser lo tiene de cortesía desde el 20-oct.

---

## 2. Lo que falta (brechas)

| # | Brecha | Por qué importa |
|---|---|---|
| B1 | **No hay modelo de marcador**: todo es fútbol (goles, empates). | Vóley (sets, sin empates), tenis, baloncesto, gimnasia (jueces) y natación (tiempos) no caben. |
| B2 | **No hay estado «en juego»** (`status` no admite `live`). | Sin esto no hay marcador en vivo. |
| B3 | **No hay marcador por set** ni puntos corridos. | El vóley se juega y se puntúa por sets. |
| B4 | **La página pública no se actualiza sola** y solo muestra tabla. | No muestra partidos, marcadores ni cuadro. |
| B5 | **Solo la escuela carga resultados**, con cuenta. | En la cancha anota otra persona (árbitro, mesa). |
| B6 | **Sin interruptor «en vivo»** ni configuración de reglas por torneo. | No se puede activar o desactivar. |
| B7 | **Tabla duplicada** en dos rutas. | Cualquier regla nueva hay que cambiarla en dos sitios. |
| B8 | **Sin enlace de transmisión** por partido o cancha. | Para mostrar el video junto al marcador. |
| B9 | **Sin corrección auditada**: un error de marcador se pisa sin dejar rastro. | En vivo se corrige seguido. |

---

## 3. Diseño propuesto

### 3.1 Modelos de marcador
| Modelo | Deportes típicos | Cómo se anota | Fase |
|---|---|---|---|
| `goals` | fútbol, futsal, hockey, balonmano, baloncesto | Goles o puntos corridos, con o sin empate | Ya existe (se mantiene) |
| `sets` | vóley, tenis, pádel, bádminton, tenis de mesa | Puntos por set; gana quien llegue a N sets | **F1** |
| `judged` | gimnasia, porras, patinaje artístico, artes marciales | Nota de uno o varios jueces | F5 |
| `timed` | atletismo, natación, ciclismo | Tiempo o puesto de llegada, sin duelo directo | F5 |

Cada torneo guarda su configuración en un solo campo (`events.scoring_config`, jsonb). Ejemplo vóley:
```json
{ "model": "sets", "best_of": 5, "set_points": 25, "last_set_points": 15, "win_by": 2,
  "standings": { "3-0": [3,0], "3-1": [3,0], "3-2": [2,1] },
  "tiebreakers": ["points", "wins", "set_ratio", "point_ratio", "head_to_head"] }
```
Los valores exactos del reglamento los define la escuela (ver §7).

### 3.2 Datos (UNA migración, con aprobación)
- `events.live_enabled boolean not null default false` — el interruptor.
- `events.scoring_config jsonb null` — modelo y reglas (NULL = comportamiento de hoy).
- `tournament_matches`: ampliar el CHECK de `status` con `live`; agregar `court text` si `venue` no alcanza, `stream_url text null`, `started_at`, `finished_at`, `version int not null default 0` (control de concurrencia entre anotadores).
- Tabla nueva **`tournament_match_sets`** (`match_id`, `set_no`, `home_points`, `away_points`, `finished`), RLS igual que `tournament_matches`.
- Tabla nueva **`tournament_scorekeepers`** (`event_id`, `token_hash`, `label`, `court`, `expires_at`, `revoked_at`): enlaces de anotador revocables, **solo se guarda el hash del token**.
- Tabla nueva **`tournament_match_log`** (`match_id`, `actor`, `before`, `after`, `at`): auditoría de cada cambio de marcador.
- Todo con `search_path` fijo, `GRANT` explícito, estados como `text + CHECK` (no `CREATE TYPE`), RLS sin autorreferencia.
- **Tiempo real:** en la primera versión **no se expone ninguna tabla a `anon`**. Lo público pasa por el BFF con caché de pocos segundos. El tiempo real (Supabase Broadcast desde el BFF) llega en F4.

### 3.3 BFF
- Módulo puro compartido **`tournament-scoring.shared.ts`** con los modelos: validar un marcador, decidir ganador, calcular tabla (`standings`) y avance de copa. Reemplaza la copia doble de la tabla (B7), con **pruebas de regresión** sobre los 5 partidos actuales para demostrar que fútbol no cambia.
- Endpoints nuevos: iniciar y terminar partido; sumar o corregir punto/set; ajustes del torneo (`live_enabled`, `scoring_config`); generar y revocar enlace de anotador; `GET /public/tournaments/:id/live` (partidos por cancha, marcadores, tabla y cuadro, con caché corta y `ETag`).
- Todo cambio de marcador pasa por **un solo punto** que valida (`version` optimista), registra en `tournament_match_log` y notifica.

### 3.4 Frontend
- **Ajustes del torneo:** modelo de marcador y reglas (con valores por defecto por deporte), interruptor «en vivo», enlace de transmisión.
- **Anotador** (móvil, botones grandes, sin cuenta): elegir cancha → partido → sumar puntos o cerrar set.
- **Página pública en vivo:** calendario por cancha, marcadores, tabla, cuadro de copa, QR, refresco automático.
- **Modo pantalla / TV** (`/tournaments/:id/tv`), solo lectura y letra grande.
- Textos en español colombiano (el aviso actual de resultado dice «podés»; se corrige).

### 3.5 Privacidad y seguridad
- Lo público muestra **equipos, marcadores y horarios**. **No** muestra nombres de menores, documentos, contactos ni pagos. El detalle de goleadores públicos queda detrás de una decisión de la escuela (§7).
- El enlace del anotador es un token largo, con hash en la base, vencimiento y revocación; limita acciones a un torneo.
- Limitación de frecuencia en endpoints públicos y de anotador.
- **Interruptor de emergencia:** apagar `live_enabled` deja de exponer lo «en vivo» al instante.
- El enlace de transmisión se valida contra una **lista de dominios permitidos** (YouTube, Facebook, Vimeo), para no incrustar sitios arbitrarios.

### 3.6 Transmisión
- **Incluido:** la escuela pega el enlace de su transmisión (por partido o cancha) y la página lo muestra junto al marcador; y la vista de TV.
- **No incluido:** video propio de SportMaps (infraestructura y costo aparte).

---

## 4. Fases

| Fase | Entrega | Criterio de aceptación | Tamaño |
|---|---|---|---|
| **F0** | Sacar la tabla de posiciones a un módulo puro y borrar la copia. **Sin cambio de comportamiento.** | Pruebas de regresión con los datos actuales; `standings` y `public-results` devuelven lo mismo de antes. | S |
| **F1** | Modelo `sets` (vóley) + estado `live` + ajustes del torneo + migración. | Partido de vóley a 3 de 5 con tabla de vóley correcta; validación de sets; un torneo de fútbol existente sigue igual. | M |
| **F2** | Página pública en vivo con refresco automático, calendario, cuadro y QR; interruptor. | Con `live_enabled` apagado se ve como hoy; encendido, un cambio de marcador aparece en menos de ~20 s. | M |
| **F3** | Anotador con enlace, punto a punto, corrección auditada, concurrencia. | Dos anotadores sobre el mismo partido no se pisan; cada cambio queda en el registro; token revocable. | M |
| **F4** | Tiempo real (Broadcast), modo TV, avisos de partido a las familias. | Actualización inmediata sin recargar; sin carga extra en la base. | M |
| **F5** | Modelos `judged` y `timed`. | Una competencia de gimnasia con notas de jueces y una de natación con tiempos, con su clasificación. | L |
| **F6** | Enlace de transmisión por partido o cancha. | Se ve el video incrustado, solo de dominios permitidos. | S |

**Orden recomendado:** F0 → F1 → F2 → F3 → F4 → F6; F5 cuando haya un deporte calificado real que lo pida.

---

## 5. Lo que tengo para hacerlo (y lo que no)

**Tengo**
- Acceso al repo y al módulo actual de torneos, con su código ya leído.
- Consultas a la base por nombre de objeto; migraciones con aprobación y verificación después.
- Pruebas automáticas del BFF y del frontend (hoy pasan las del módulo de horas y de cobros que toqué), y pruebas con la base simulada.
- Capacidad de dividir el trabajo en agentes por archivos distintos (backend, frontend, pruebas), con commits separados.
- Un entorno de desarrollo con la base compartida, donde se puede probar con datos de prueba sin tocar clientes.

**No tengo**
- El **reglamento** de cada deporte y torneo (puntos de tabla, desempates, tamaño de set).
- Un torneo real de Monster para probar con árbitros y gente en cancha.
- Tus decisiones de privacidad (qué se muestra al público).
- Cuentas ni credenciales de YouTube o Facebook para probar la transmisión.

---

## 6. Riesgos y cómo se cubren

| Riesgo | Cobertura |
|---|---|
| La página pública consulta la base cada pocos segundos y hay una sola base para dev, staging y producción | Caché de 10-15 s en el BFF, `ETag`, solo torneos con `live_enabled`, y el tiempo real pasa a Broadcast en F4. |
| Exponer tablas a `anon` | No se exponen: todo lo público va por el BFF. |
| Dos anotadores corrigen a la vez | `version` optimista y registro de cambios. |
| Cambiar el CHECK de `status` y romper lo existente | La migración solo **agrega** el valor `live`; pruebas de regresión en F0. |
| El reglamento del vóley (o de otro deporte) cambia por federación | Reglas por torneo en `scoring_config`, no escritas en el código. |
| Datos de menores en una página pública | Solo equipos y marcadores; nombres de jugadores públicos solo con decisión explícita. |
| Las migraciones se aplican a mano y son inmutables | Una sola migración, revisada línea por línea antes de aplicar. |

---

## 7. Decisiones abiertas

1. **¿Qué deporte y torneo primero?** (si es vóley de Monster, empezamos por sets) y **¿cuándo es el próximo torneo?**
2. **Reglamento de vóley:** ¿sets de 25 y tercero a 15, a 3 de 5 o a 2 de 3, con diferencia de 2? ¿Puntos de tabla: 3-0 y 3-1 dan 3, 3-2 da 2 al ganador y 1 al perdedor? ¿Qué desempates?
3. **¿Quién anota?** (mesa del club, árbitros externos, voluntarios) y ¿cuántas canchas a la vez?
4. **Público:** ¿familias, otros clubes, pantalla en el coliseo? ¿Se muestran nombres de jugadores, o solo equipos?
5. **¿Torneos solo del club o con otros clubes?** Cambia quién anota y quién ve.
6. **¿Monster activa el complemento de Torneos ahora?** Hoy está apagado.
7. **¿La transmisión es un enlace que ya tienen** (YouTube/Facebook) o necesitan algo más?
8. **¿La notificación de resultado a las familias se mantiene** y se extiende a «partido en vivo»?

---

## 8. Primer paso concreto, si se aprueba

**F0**: extraer la tabla de posiciones a un módulo con pruebas y comprobar que los 5 partidos actuales dan exactamente lo mismo. No toca la base, no cambia lo que ven los usuarios y deja el camino listo para F1. Después, F1 con la migración, que te presento antes de aplicar.
