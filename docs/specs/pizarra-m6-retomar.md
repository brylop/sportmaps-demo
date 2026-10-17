# Pizarra — cómo retomar (pausa del 2026-10-14, tarde)

> Pausa pedida por el usuario. Ningún agente quedó con archivos a medio escribir ni procesos corriendo.
> Nada aplicado a la base en esta tanda. Nada en `develop`.
> Specs: `pizarra-multideporte-3d-ia.md`, `pizarra-m6-paridad-tacticalpad.md`.

## Rama de integración `pizarra-tp/integracion` (`C:/Users/Usuario/Documents/demo/wt-pizarra-integracion`)

Commiteado (HEAD `c88f43a3`): M0-M4 (cancha por deporte, métrica, GIF, 28 plantillas, separación por deporte,
paquetes, IA, 3D), «Ver en 3D» desde la IA, eventos, recorrido. 18/18 e2e, 997 vitest, 274 BFF.
`frontend/node_modules` es carpeta REAL (con three); los M6 la usan por junction.

**Sin commitear: cupo de IA por coach** (migración `20261014155445_pizarra_ia_cupo_por_entrenador_tokens`, ya en
el ledger). USD 1/coach/mes, tope escuela 10×, reserva/liquida/libera con FOR UPDATE, `/admin/ia-pizarra`,
«Quiero más» → WhatsApp. Probado: BFF 55/55, front 27/27, e2e 18 ✓ / 1 ✗ (`tactical-board-animacion`, sin
investigar). Falta: ver `frontend/test-results/tactical-board-animacion-*/error-context.md`, re-correr las 6
specs y la batería completa, commitear.

## Bloques M6 (todas las ramas salen de `c88f43a3`; worktree `wt-pizarra-<x>`)

| Bloque | Estado | Para retomar |
|---|---|---|
| M6a formaciones | Sin commitear: `lib/school/tacticalFormationGallery.ts` (rival espejado 180° con figuras `opponent` rojas, familias, búsqueda sin tildes «433»→«4-3-3»; sin probar) y el snapshot de no-regresión `frontend/src/test/fixtures/formacionesHistoricas.json` | **Retomar el MISMO agente** (el catálogo de ~40 formaciones de fútbol 11 + futsal/básquet/balonmano/vóley con coordenadas está en su contexto). Campos opcionales `group`, `description`, `flyingKeeper`; rotaciones de vóley 1-6 (5-1, 4-2, 6-2, recepción y defensa con líbero) generadas por código; ajustar el test de arquero de `tacticalSports.test.tsx` para `flyingKeeper`. vitest con `--pool=threads` (máquina cargada); puerto 3021 |
| M6b equipos | Versión `20261014162158` reservada (solo encabezado), sin código | Reusar esa versión. Modelo puro `lib/school/tacticalTeams.ts`, `TeamChipGlyph` (rayas con paths, sin clipPath), contexto + `useTacticalTeams` + `TacticalTeamsDialog`; `teams` jsonb nullable en `match_lineups` y `team_tactical_presets` con el mismo fallback que `frames`; arquero rival = el `opponent` más cercano al arco de arriba (y ≤ 20) |
| M6c notas y videos | Versión `20261014163705` reservada (plantilla), sin código | Reusar. `notes {text,tags}` + `videos` jsonb en lineups/presets; en `training_exercises` dentro de `board`; `note` por cuadro; tabla `tactical_saved_videos`; `provider` CHECK youtube/vimeo/veo/hudl/trace/pixellot/spiideo/xbotgo/reeplayer/drive/dropbox/sportmaps; iframe SOLO YouTube-nocookie y Vimeo, el resto tarjeta «Ver en … ↗». No hay CSP en los `vercel.json`. Privados fuera del PDF y paquetes. CREATE OR REPLACE de `insert_exercise_into_session_block` para copiar notas |
| M6d herramientas + Campo | BFF hecho sin commitear (`footballShapes.ts`: `spotlight`, `line` pass/dribble/run/shot, zonas rect/ellipse/polygon 3-24 pts, `fill`, `seq`; 173/173) | **PRIMERO** generar el snapshot de compatibilidad (`npx vitest run src/test/tacticalM6dCompat.test.tsx`, `--pool=threads` si el worker revienta) ANTES de tocar el frontend, y commitear el `.snap`. Campo = UNA pseudo-figura `{type:'court', court:{tpl,goals,cam,orient,surface,grass,lines,outline}}` dentro de `arrows` (sin migración; se borra si es el default). Orientación horizontal solo en render estático/exportes |
| M6e cámaras 3D | Investigación hecha, nada escrito | Cámaras en `lib/school/tactical3dCameras.ts`, movimiento en `tactical3dMotion.ts`. Altura del balón `4·apex·e·(1−e)`, `apex = min(0.22·d, tope)`; zancada por distancia. Director: tiro al 20 % final → detrás de ese arco; pase ≥ max(20 m, 0,3·largo) → seguir balón; si no, TV; mínimo 1,2 s por cámara. Velocidades 3D `[0.25,0.5,1,2]`. Harness e2e en `frontend/e2e/harness/` (puerto 3025). La cámara por defecto pasa a «Transmisión TV» → actualizar `pizarra-ia-3d.spec.ts` |
| M6f más deportes | Lectura hecha, nada escrito | **Decidir antes:** los deportes nuevos ¿pasan a «completa» (y se agregan a `EXERCISE_SPORTS` en `bff/src/routes/school/exerciseShapes.ts` y al CHECK de la base) o se abre la pizarra también a «cancha» con biblioteca vacía? `TacticalSport` y `BoardSport` deben listar lo mismo |
| M6g ajustes | Nada escrito | Preferencias en localStorage con clave por id de usuario + limpieza en el signOut (`AuthContext.tsx`), sin migración. Posesión = campo opcional `ball_owner` por cuadro → hay que agregarlo en `sanitizeFrames`/`validateFrames` (`footballShapes.ts` ~l. 241) o el BFF lo borra; el balón se mueve como figura `ball` (`hydrateFrames` con `ballAsObject`) |
| M6h videos subidos (celular, Veo) | Nada escrito; su investigación web se detuvo | Relanzar con el mismo encargo desde cero |

## Migraciones pendientes de aplicar (en este orden, una sola sesión, con permiso del usuario)

`20261013194057` plantillas → `20261014111442` cupo IA → `20261014121142` paquetes → `20261014125632` eventos →
`20261014155445` cupo por coach → (M6b `20261014162158`, M6c `20261014163705` cuando estén). Después: `gen types`
UNA vez, `npm run seguridad:rls-pizarra` y `seguridad:invariantes` UNA vez. El modo auto bloquea `db query
--linked -f`: hace falta permiso explícito (`Bash(npx supabase db query --linked:*)`, `Bash(npx supabase migration
repair:*)`).

Ojo al integrar en develop: otra sesión ya subió a origin/develop (commit 5f87147c) este archivo, el spec M6 y
`docs/capturas/pizarra-multideporte/` → conflicto add/add esperable; quedarse con la versión de la rama.

Ojo con el ledger: M6b y M6c reservaron versiones en ramas distintas → al integrar, `git checkout --ours` del
ledger + `npm run migrations:sync`.
