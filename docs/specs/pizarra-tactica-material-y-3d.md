# Pizarra táctica: material de entrenamiento, modo arqueros y vista 3D

**Estado:** F1 en construcción (2026-09-24). Decisiones del §6 cerradas. Nace de los pedidos de
Club Carmel del 2026-09-24 (entrenador de arqueros Yohan Casas + coaches de categoría) sobre la
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
- **Validación en el BFF.** `validateArrows` en `bff/src/routes/school/football.ts` valida los
  campos nuevos: `size` en rango 0,25–4, `rot` numérico, `kind` ∈ `pase | remate | penal` y
  tipos dentro del catálogo.

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
