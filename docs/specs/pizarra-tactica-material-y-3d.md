# Pizarra táctica: material de entrenamiento, modo arqueros y vista 3D

**Estado:** F1 entregada y en producción (2026-09-25, `2b1dc946`) + lápiz/texto/borrador
(2026-09-30, `5bda8a3f`) + ajustes de celular/iPhone (`e485a9b1`, `5acf1eeb`). **Auditoría de
diseño/UX/datos de la pizarra y la plantilla: 2026-10-05, ver §9** — fallas verificadas corregidas
en el frontend y el BFF; la migración de datos/lectura (`20261005173002`) está en el repo y **pendiente
de aplicar en la base viva**. F2 (3D) sigue sin empezar. Decisiones del §6 cerradas. Nace de los pedidos
de Club Carmel del 2026-09-24 (entrenador de arqueros Yohan Casas + coaches de categoría) sobre la
pizarra que ya existe en `/training-plans` → sesión → "Pizarra".
**Decide:** el usuario (decisiones cerradas en §6).

## 1. Qué hay hoy (verificado en el código, 2026-09-24)

- Pizarra 2D en SVG, un solo componente: `frontend/src/components/school/TacticalBoard.tsx`
  (~1.850 líneas). `viewBox 300×340`, coordenadas 0–100 de cancha.
- Objetos de un punto: **cono, balón, valla, contrincante, vallita** (`TacticalShapeType` en
  `lib/school/footballQueries.ts`: `arrow | curve | zone | cone | ball | goal | opponent | hurdle`).
  Sin tamaño ni rotación: cada objeto es un ícono fijo.
- Líneas: flecha, curva, zona. Colores: blanco, amarillo, rojo, azul. Regla de distancia.
- "Reproducir jugada": cada jugador con flecha/curva viaja hasta el final y vuelve (ensayo).
  El balón **no** se mueve solo.
- Plantillas guardadas por situación en `team_tactical_presets` (jsonb `slots` + `shapes`).
  Situaciones: ataque, defensa, presión, transición, córner, tiro libre, penalti y, desde hoy,
  **arqueros** (migración `20260924102935`).
- Rendimiento: todo se guarda en una columna jsonb → agregar tipos de objeto **no requiere
  migración**; solo el CHECK de `situation` está en la base.

## 2. Qué pidió Carmel (lista literal, ordenada)

| # | Pedido | Lectura |
|---|---|---|
| 1 | Balones (varios) | Ya existe; falta que se muevan en la jugada |
| 2 | Tamaño de los artículos de entrenamiento | Atributo `size` por objeto |
| 3 | Rotar el arco y desplazarlo | Atributo `rotation` + arco como objeto arrastrable (hoy el fondo no dibuja arco: solo áreas y punto penal) |
| 4 | Movimiento con animación | Extender "Reproducir jugada" a balón y objetos |
| 5 | Muñecos (maniquíes) | Objeto nuevo `mannequin` |
| 6 | Modo "solo arquero" | Situación `arqueros` + vista de media cancha / área |
| 7 | Jugadores pateando balones, penales | Trayectoria de balón (pase / remate / penal) con parábola |
| 8 | Siluetas de jugadores | Sprite por posición (hoy son discos con número) |
| 9 | Aros, escaleras de coordinación, estacas (picas) | Objetos nuevos `ring`, `ladder`, `pole` |
| 10 | "Todo el material de fútbol" | Catálogo abierto, ver §3.1 |
| 11 | Todo en 3D, optimizado | Ver §4: vista 3D **de solo lectura** sobre el mismo JSON |

## 3. Propuesta por fases

### F1 — Material y movimiento, en la pizarra 2D actual (sin migraciones)

Se cubre 1–5, 7–10. Todo dentro del SVG que ya existe; cero dependencias nuevas.

**3.1 Catálogo de material.** `TacticalShapeType` crece a:
`cone | ball | goal | mini_goal | opponent | hurdle | mannequin | ring | ladder | pole | marker`.
El fondo de cancha (`FootballPitchBackground.tsx`) nunca dibujó el marco del arco: solo las áreas
y el punto penal. Por eso **no se condiciona nada** en el fondo. El objeto "Arco" (`goal`) es un
marco adicional que el coach coloca, mueve y gira (rotar 180° para el arco de arriba). Las
plantillas viejas se ven exactamente igual; no hay caso borde ni migración de plantillas
(pedido 3).

La paleta de colores pasa de 4 a 9: blanco, amarillo, rojo, azul, verde, naranja, morado, rosado
y negro. Aplica a líneas, zonas y objetos. Con 4 colores no alcanzaba para marcar zonas por
color (pedido del 2026-09-24).

**3.2 Tamaño y rotación.** `TacticalArrow` (el tipo de figura, hoy solo `x1,y1,x2,y2,color`) suma
tres campos opcionales: `size` (0.5–3, multiplicador), `rot` (grados) y `label` (texto corto).
Retrocompatible: una figura sin esos campos se dibuja como hoy.

La edición es **por selección**: tocar un objeto lo selecciona (marco punteado); sobre él aparece
un handle de giro y una × para quitarlo. Con un objeto seleccionado, el panel muestra sliders de
tamaño (0,5× a 3×) y de giro, más el botón Duplicar. Sin selección, los mismos sliders fijan el
tamaño y el giro con que se colocan los objetos nuevos.

**3.3 Movimiento del balón (pedido 1, 4, 7).** Tipo de línea nuevo `ball_path` con `kind:
'pase' | 'remate' | 'penal'`. En "Reproducir jugada" el balón viaja por la línea; `remate` y
`penal` dibujan la sombra con parábola (altura visual, no física). Un jugador con `ball_path`
saliendo de su posición se anima primero al balón y luego el balón sale: eso es "jugador pateando".

**3.4 Modo arqueros (pedido 6).** Al elegir situación `arqueros`, la cancha se recorta al área
(zoom al tercio defensivo) y el catálogo destaca arco, balones, conos, maniquíes, vallas. Es un
`viewBox` distinto sobre el mismo SVG; las coordenadas guardadas siguen siendo 0–100 de cancha
completa, así una plantilla de arqueros se ve bien en ambos zooms.

**3.5 Siluetas (pedido 8).** Un sprite SVG por grupo (arquero, defensa, medio, delantero) que
reemplaza el disco, con el dorsal debajo. Opción por equipo "discos / siluetas" en el header de
la pizarra, guardada en `localStorage` del coach (es preferencia de vista, no dato).

**Estimación F1:** 6–9 días de desarrollo + 2 de QA en celular (Carmel usa celulares en cancha).

### F2 — Vista 3D de solo lectura (pedido 11), lazy y aislada

**Principio:** el JSON de la pizarra es la única fuente. La vista 3D lo **lee**; no edita. El
coach arma en 2D (rápido, preciso, funciona en cualquier celular) y presiona "Ver en 3D" para
mostrarle la jugada al grupo.

Cómo se hace optimizado:

- **Motor:** `three` + `@react-three/fiber` + `@react-three/drei`. Es la opción con más
  ecosistema en React; sin motores de juego completos (Babylon/Unity) que pesan 3–10× más.
- **Carga:** un chunk aparte con `React.lazy`, **excluido del precache del service worker**
  (hoy el SW precachea 7,4 MB y ya nos costó lentitud de login, ver
  `docs/gotchas-tecnicos.md`). Se descarga la primera vez que alguien toca "Ver en 3D", nunca antes.
  Presupuesto: ≤ 600 KB gzip de JS + ≤ 1,5 MB de modelos.
- **Modelos:** un pack de ~12 low-poly (cono, balón, valla, vallita, maniquí, aro, escalera,
  estaca, arco, mini-arco, silueta jugador, silueta arquero) en glTF comprimido (meshopt o
  Draco), ≤ 3.000 triángulos cada uno. Un solo material con textura atlas → un draw call por tipo
  usando `InstancedMesh` (30 conos son 1 draw call, no 30).
- **Jugadores:** billboards (sprites) con silueta y dorsal, no personajes con esqueleto. Es lo
  que hace la diferencia entre "corre en un Android de gama media" y "no corre".
- **Render bajo demanda:** `frameloop="demand"`; solo dibuja mientras hay animación o el usuario
  orbita la cámara. Con la pizarra quieta el GPU está en cero.
- **Animación:** misma línea de tiempo que "Reproducir jugada" en 2D; los objetos interpolan
  posición sobre las mismas flechas y `ball_path`. Nada de físicas.
- **Cámara:** tres presets (cenital, banda, detrás del arco) + órbita libre. El preset "detrás del
  arco" es el modo arqueros en 3D.
- **Degradación:** si `WebGL2` no está disponible o el dispositivo reporta poca memoria, el botón
  no aparece y el coach se queda en 2D. Nunca una pantalla rota.

**Estimación F2:** 12–16 días de desarrollo (incluye el pack de modelos) + 3 de QA en 4 celulares
reales de gama media.

### F3 — Edición en 3D (solo si F2 se usa de verdad)

Arrastrar objetos dentro de la escena 3D. Es lo más caro (raycasting, snapping, gestos táctiles
en 3D) y lo que menos agrega si F1 ya resuelve la edición. Se decide con métrica: cuántas
aperturas de "Ver en 3D" por semana en escuelas reales, no solo Carmel.

## 4. Lo que NO se va a hacer

- Motor de físicas (rebotes, colisiones): el coach quiere mostrar la idea, no simular el partido.
- Personajes animados con esqueleto: cuesta 10× y mata el celular.
- Realidad aumentada / VR.
- Guardar las jugadas como video: si hace falta, se exporta el JSON y se reproduce; un video de
  30 s por jugada rompe el plan Free de Supabase (160/500 MB, ver memoria de la cuenta).

## 5. Datos

- **Sin migración** para F1/F2: todo va dentro del jsonb `shapes` de `team_tactical_presets`
  (y del `layout` de la sesión). Los campos nuevos son opcionales.
- La única enumeración en la base es `situation` (CHECK); `arqueros` ya está.
- **Sin número de versión en el JSON.** Todos los campos nuevos (`size`, `rot`, `kind`, tipos
  nuevos) son opcionales dentro del jsonb y las figuras viejas se leen como están. Un
  `schema_version` no aporta nada y obliga a tocar dos escritores (alineación y plantilla).
- **Validación en el BFF.** `validateArrows` (hoy en `bff/src/routes/school/footballShapes.ts`,
  lógica pura con tests en `footballShapes.test.ts`) valida los campos nuevos: `size` en rango
  0,25–4, `rot` numérico entre −360 y 360, `kind` ∈ `pase | remate | penal` y tipos dentro del
  catálogo. **Desde la auditoría del 2026-10-05 (§9):** rechaza elementos que no son objeto (422, antes
  500), tope de **300 figuras** y **40 slots** por plantilla, nombre ≤80 y `slot_label` ≤40; y
  `sanitizeArrows`/`sanitizeSlots` guardan **solo los campos conocidos** (antes el objeto del
  cliente se persistía crudo). La paridad de catálogos (17 tipos, 9 colores, límites) entre frontend
  y BFF sigue siendo manual — ampliar JUNTO `footballQueries.ts`, `tacticalGeometry.ts`,
  `tacticalPalette.ts` y `footballShapes.ts`.
- **Restricciones en la base** (migración `20261005173002`, **pendiente de aplicar**): `CHECK` de que
  `slots`/`arrows` sean listas con el mismo tope, `CHECK` de nombre ≤80, e índice único
  `(team_id, situation, lower(btrim(name)))` en `team_tactical_presets`; `CHECK` de `arrows` en
  `match_lineups`. Medido antes: 9 plantillas (máx. 11 slots, 14 figuras, 0 duplicados) y 58
  alineaciones (máx. 52 figuras) — ninguna fila existente se rechaza.
- **Lectura (RLS), misma migración:** los SELECT de `team_tactical_presets`, `match_lineups`,
  `match_lineup_players` y `football_match_events` pasan de `user_school_ids()` (cualquier miembro,
  incluidos padres y atletas) a `user_staff_school_ids()`; se conservan las ramas de "lo mío" (el
  atleta/padre sigue viendo las alineaciones y eventos donde participa él o su hijo). Nada fuera del
  BFF (service_role) lee estas tablas con el JWT del usuario. Esto **corrige** lo que dejaba
  `20260819173354` (lectura de plantillas en `user_school_ids()`, ver
  `docs/seguridad-escritura-rls-registro.md`).

## 6. Decisiones cerradas (2026-09-24)

Revisadas y cerradas por el dueño del producto el 2026-09-24.

1. **Orden:** F1 primero, 3D después. Cubre 10 de 11 pedidos en una fracción del costo y la
   pizarra 2D sigue siendo la que se usa en cancha.
2. **3D como visor** (F2), no como editor. F3 solo si se cumple la métrica del punto 6.
3. **Siluetas genéricas por posición, nunca foto del jugador.** La foto exige consentimiento de
   los padres, que en Carmel es el bloqueo real de todo lo que muestra menores (ver memoria
   `project_club_carmel_reports_consent`).
4. **Modo arqueros = zoom al área.** Reutiliza todo; una cancha aparte de fútbol reducido
   duplicaría plantillas.
5. **Pack de modelos 3D comprado + retoque** (~USD 50–150), no hecho in-house. Criterio de
   compra: la licencia debe permitir **uso comercial y redistribución dentro de un producto SaaS
   ofrecido a múltiples escuelas**. No basta una licencia de "uso en un proyecto".
6. **Métrica de éxito de F2 antes de F3:** ≥ 20 aperturas semanales de "Ver en 3D" en ≥ 3
   escuelas distintas durante un mes, **y además** con al menos 5 coaches distintos. Si el 90 %
   de las aperturas son de un solo coach, la señal es débil aunque el total se cumpla.

7. **(2026-10-05) La foto del jugador en el modo disco es opt-in, apagada por defecto.** El modo
   disco mostraba la foto (`avatar_url`) sin preguntar, contra la decisión 3. Ahora hay un botón
   "Fotos" por dispositivo (`localStorage` `tactical_board_pin_photos`, borrado al cerrar sesión). *Pendiente
   de confirmar con el dueño del producto: si se prefiere quitar la foto del todo.*
8. **(2026-10-05) Solo `owner`, `coach` y `super_admin` modifican el tablero** (espejo de
   `TACTICAL_EDIT_ROLES` del BFF y de `user_tactical_edit_school_ids()`); admin/school_admin/staff lo
   abren en **modo lectura** (insignia "Solo lectura", sin arrastrar, guardar ni dibujar).
9. **(2026-10-05) La lectura de plantillas, alineaciones y eventos es de staff**, no de cualquier
   miembro (ver §5). El padre/atleta conserva lo suyo.

## 7. Plan de QA

- F1 **exige pruebas en dispositivos reales antes de desplegar.** La pizarra se usa con el dedo
  en la cancha; un emulador no reproduce los gestos táctiles ni el rendimiento del SVG.
- El plan de casos vive en `docs/qa/pizarra-tactica-f1-checklist.md`.
- Mínimo: un Android de gama media y un iPhone (Chrome y Safari), más desktop.
- **Pregunta abierta:** confirmar si el equipo ya cuenta con esos dispositivos o hay que
  conseguirlos. Corre el cronograma: sin dispositivos no hay QA de F1 y no se despliega.
- Los tests automatizados cubren la lógica pura: helpers de coordenadas y la validación del BFF
  (`validateArrows`). No cubren los gestos táctiles; eso es manual en dispositivo.

## 8. Relación con lo ya hecho hoy (2026-09-24)

- Situación `arqueros` en la pizarra y en las plantillas: **hecho** (frontend + BFF + CHECK).
- Bloque de sesión con componente "Arqueros" en `SessionFormDialog`: **hecho**.
- Grupo transversal de arqueros (un niño en su categoría **y** en el grupo de arqueros): tema
  aparte, ver `docs/plan-club-carmel-2026-09.md` y memoria `project_carmel_arqueros_grupo_transversal`.

## 9. Auditoría de diseño, edición y plantilla (2026-10-05)

Pedido: validar y mejorar todo el editor de la pizarra y la plantilla interactiva, funcional en
todos los dispositivos. El plan completo se aprobó el 2026-10-05; esta sección es el registro de lo
encontrado (leyendo el código completo, no por opinión) y de dónde está cada cosa. **Las pruebas en
celular/tableta las hace el usuario**; el checklist de gestos vive en
`docs/qa/pizarra-tactica-f1-checklist.md` (casos nuevos al final).

### 9.1 Fallas verificadas y su estado

| # | Falla | Estado |
|---|---|---|
| B1 | Con zoom de arqueros, reposicionar un jugador lo hacía saltar (~10 puntos): usaba `y/100` sin la ventana visible | ✅ `repositionedCenterPx` (`tacticalBoardLogic.ts`), con tests |
| B2 | El relleno de una zona tapaba a los jugadores debajo (tocarla la borraba) | ✅ relleno `pointer-events-none`; solo el borde es tocable |
| B3 | Un jugador guardado que ya no está en el roster reventaba el guardado y contaba para el máximo de 11 | ✅ `splitKnownKeys` + aviso al guardar |
| B4 | "Reproducir jugada" mutaba `placed`, Guardar seguía activo, timeouts sin limpiar | ✅ botón Detener que restaura posiciones; Guardar deshabilitado; timers limpios |
| B5 | Guardar/Actualizar plantilla perdía los marcadores sin jugador | ✅ `buildPresetSlots` |
| B6/B7 | Cargar plantilla, cambiar de situación, "Borrar todo" y eliminar plantilla sin confirmación; eliminar limpiaba la pantalla aunque fallara | ✅ `AlertDialog` único; eliminar solo limpia si el servidor respondió OK |
| B8 | `Select` de plantilla no controlado | ✅ controlado + botón "volver a cargar la plantilla guardada" |
| B9 | Gestos interrumpidos dejaban trazo/preview/arrastre colgados | ✅ `onPointerCancel`/`onLostPointerCapture` |
| B13 | Etiqueta de jugador <16 px (zoom de iOS), texto negro invisible, contraste `white/40` | ✅ |
| B15 | El modo disco mostraba la foto de menores | ✅ opt-in (decisión 7, §6) |
| B16 | BFF: 500 con elementos nulos, sin topes, objetos crudos al jsonb, `DELETE` 204 siempre, `PUT` con `slots: []`, sin unicidad de nombre ni control de concurrencia | ✅ BFF (`footballShapes.ts`, `football.ts`: 409 por `expected_updated_at`/nombre repetido, 404 al borrar inexistente) · ⏳ base (migración pendiente de aplicar) |
| B17 | RLS: lectura de plantillas/alineaciones/eventos para cualquier miembro, incluidos padres | ⏳ migración `20261005173002` en el repo, **pendiente de aplicar** |
| B18 | Sin control de rol en el frontend (admin/staff recibían 403 después de armar todo) | ✅ modo lectura (decisión 8, §6) |
| B19 | Catálogos duplicados a mano en 4-5 archivos, sin test de paridad | ⏳ Fase 0 pendiente (`scripts/verificar-paridad-pizarra.mjs`) |
| B10 | Deshacer = quitar la última figura; sin rehacer; sin teclado; líneas/zonas se borran con un toque | ⏳ Fase 3 |
| B11 | Sin estado "sin guardar": Cancelar/X/Esc cierran perdiendo todo | ⏳ Fase 3 |
| B12 | Handles y botones muy por debajo de 44 px | ⏳ Fase 6 |
| B14 | El jugador "patea" y el balón sale a la vez (spec §3.3); solo 2 siluetas en vez de 4 por posición (§3.5) | ⏳ Fases 3 y 6 |

### 9.2 Lo que sigue (orden aprobado)

`0 → 1 → 2 → 5(partición del archivo) → 3 → 4 → 6 → 7`. Hecho: Fase 1 completa y la parte de
código de la Fase 2. Pendiente: aplicar la migración (Fase 2), Fase 0 (paridad de catálogos, e2e de
referencia, medición de rendimiento), partición de `TacticalBoard.tsx` en módulos, historial real +
atajos + "sin guardar" + reproducción v2 (Fase 3), panel de plantillas con vista previa, renombrar,
duplicar y envío de `expected_updated_at` (Fase 4), rendimiento (carga diferida, memo), y sistema de
diseño + accesibilidad + áreas táctiles ≥44 px (Fase 6). No cambia la forma del JSON.

### 9.3 Decisiones abiertas

1. Foto en modo disco: ¿se queda opt-in o se quita del todo? (decisión 7, recomendada opt-in).
2. Preferencia disco/silueta: ¿por dispositivo (hoy) o por equipo (lo que dice §3.5)?
3. Aplicar plantilla: ¿ofrecer "solo formación / solo dibujos" o siempre "todo"?
4. ¿Guardar `situation` (y la plantilla cargada) con la alineación? Hoy no viaja.
5. Multiselección y zoom libre: ¿en esta ronda o en una segunda?
