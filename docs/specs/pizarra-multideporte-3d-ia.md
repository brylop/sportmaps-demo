# Pizarra por deporte, bibliotecas cargables, 3D e IA de jugadas

> 2026-10-14. Continúa `pizarra-nivel-tacticalpad.md` (T0-T4 construidas; integración en ramas `pizarra-tp/*`).
> Pedido del usuario: «separar todos los deportes y con ello los que puedan usar las pizarras: si una escuela es de
> fútbol solo ve acciones de fútbol, campos y bibliotecas reducidas; además 3D, cargar diferentes bibliotecas e
> incluir análisis de IA de jugadas posibles, contraataques».
> Estado: **PLAN — pendiente de aprobación** (regla del repo: plan antes de código en migraciones; una rama por fase).

## 1. Lo que muestra la base (2026-10-14)

`teams.sport` es texto libre. Por equipos: fútbol 37 (11 escuelas), voleibol 32 (7), baloncesto 13 (5),
cheerleading/porrismo 18 en 4 variantes de nombre, natación 8, gimnasia artística 7, patinaje 8 en 2 variantes,
golf 5, karate 5, tenis 4, pádel 3, MMA 3, boxeo 2, atletismo 2, waterpolo 1, y otros sueltos.
Hoy la pizarra solo se abre si `teams.sport` es literalmente `futbol`/`fútbol` (`TrainingPlansPage.tsx:318`,
`isFootballTeam`), así que 32 equipos de vóley y 13 de básquet nunca la ven aunque sus canchas ya existen.
`schools.sports text[]` y `school_staff.sports text[]` ya existen.

## 2. Decisiones

- **D1 — El deporte manda en todo, y es del EQUIPO.** La pizarra, las formaciones, el material, la cancha, la
  biblioteca y la IA salen del deporte del equipo. Una escuela multideporte (Club Campestre, 8 disciplinas) ve en
  la biblioteca solo los deportes de sus equipos activos (∪ `schools.sports`), nunca los demás.
  Fútbol ve fútbol 11/7/5 (y futsal solo si tiene equipos de futsal). «Genérico» (calentamiento, coordinación)
  se muestra a todos como «Preparación física».
- **D2 — Catálogo único de deportes con su nivel de pizarra** (`lib/sports/sportCatalog.ts`, una sola función
  `resolveSport(texto)` que normaliza tildes, guiones y sinónimos: «Fútbol Sala» → futsal, «Porrismo» =
  «Cheerleading all-star», «Basket» → baloncesto):
  - **Pizarra completa:** fútbol 11, fútbol 7, fútbol 5, futsal, voleibol, baloncesto, balonmano.
  - **Pizarra de cancha (fase M5, sin formaciones):** waterpolo, tenis, pádel, vóley playa.
    **M6f (2026-10-15):** el nivel «cancha» crece a rugby, fútbol americano, tenis, pádel, bádminton, vóley playa,
    hockey césped, hockey sobre patines/sala, netball, waterpolo y ultimate, cada uno con SU cancha (medidas
    oficiales) y 1-2 posiciones de arranque. **Abren la pizarra (`hasTacticalBoard`) pero NO la biblioteca**
    (`hasExerciseLibrary` / `LIBRARY_BOARD_SPORTS`): ni «Desde la biblioteca», ni «Guardar en biblioteca», ni
    paquetes, porque `EXERCISE_SPORTS` del BFF y la base no los aceptan y no se tocan. Los de «completa» no cambian.
  - **Sin pizarra:** natación, gimnasia, karate, MMA, boxeo, golf, patinaje, atletismo, cheerleading, crossfit,
    piragüismo… Para ellos el botón «Pizarra» no aparece; usan sesiones, asistencia y métricas como hoy.
  - Deporte desconocido → sin pizarra y queda en un reporte para mapearlo (no adivinar).
- **D3 — `isFootballTeam` se parte en dos:** `hasTacticalBoard(sport)` abre pizarra y biblioteca a todos los
  deportes de nivel «completa»; lo futbolero de verdad (principios de juego, evaluación de partido de fútbol,
  bloques de fútbol) sigue con `isFootball`. Sin regresión para los equipos de fútbol.
- **D4 — Bibliotecas cargables = paquetes.** Un **paquete** es un conjunto de ejercicios de un deporte
  («Fútbol base: fundamentos», «Vóley formativo», «Básquet: defensa», «Arqueros»). SportMaps publica los del
  sistema; la escuela **activa** los que quiere y solo ve esos + los suyos. Además **importar/exportar** un
  paquete como archivo (`.json` con versión de formato), para pasar ejercicios entre escuelas del mismo dueño o
  traer los de un entrenador. Importar valida cada jugada con `validateFrames` y nunca trae ids de atletas.
- **D5 — 3D como VISOR, no como editor.** Se dibuja en 2D como hoy; «Ver en 3D» reproduce los mismos `frames`
  con jugadores en volumen, balón y cancha del deporte, cámara que se gira y 3 cámaras fijas (tribuna, detrás del
  arco/aro, vista del jugador seleccionado). three.js + `@react-three/fiber` en un chunk aparte que solo se carga
  al tocar el botón. En celulares sin WebGL2 o lentos (mide fps los primeros 2 s) vuelve solo a 2D con aviso.
  Cero almacenamiento: se calcula de los mismos cuadros. Siluetas genéricas, nunca fotos (consentimiento Carmel).
  Esto **reemplaza la regla de métrica de T7** («≥20 aperturas/semana») por decisión del usuario; T0 ya mide uso
  y sirve para ver si el 3D se usa.
- **D6 — IA de jugadas («Analizar jugada»).** Botón en la pizarra que manda al BFF la jugada (deporte, cuadros,
  posiciones normalizadas, etiquetas de puesto, color de cada equipo; **sin nombres de atletas**) y devuelve,
  en español:
  1. Lectura de la jugada (qué busca, en 3-5 líneas para el coach).
  2. Riesgos: espacios que deja, jugadores mal perfilados, superioridades del rival.
  3. **2-3 contraataques posibles del rival**, cada uno con sus cuadros, para verlos animados encima de la jugada
     en otro color («Ver contraataque») y en 3D.
  4. **Variantes** de la propia jugada («¿y si el 8 arrastra al lateral?») como cuadros nuevos.
  5. Botón «Guardar como nueva jugada / en la biblioteca».
  - Motor: `bff/src/services/llm.service.ts` (Claude con salida JSON estructurada y los proveedores de respaldo que
    ya existen). Toda salida pasa por `validateFrames` + recorte a la cancha; si no valida, se descarta esa parte.
  - Costo controlado: cupo mensual por escuela, caché por hash de la jugada, `llm-usage` registra cada llamada.
  - La IA sugiere, el coach decide: todo sale marcado «Sugerencia IA», nunca se guarda solo.

## 3. Fases (una rama y una revisión por fase)

| Fase | Qué | Migración | Depende de |
|---|---|---|---|
| **M0** | Integrar `pizarra-tp/{board,export,plantillas,rls,e2e}` en `develop`; aplicar `20261005173002` + `20261013200604` | ya escritas | — |
| **M1** | Catálogo de deportes + `resolveSport` + `hasTacticalBoard`; pizarra abierta a vóley/básquet/balonmano/futsal; toolbar, formaciones, material y biblioteca filtrados por deporte; reporte de deportes sin mapear | — (solo código) | M0 |
| **M2** | Paquetes de biblioteca: `exercise_packs` (sistema/escuela, deporte, versión), `training_exercises.pack_id`, `school_exercise_packs` (activados); paquetes del sistema por deporte; importar/exportar archivo; la biblioteca de la escuela = sus deportes ∩ paquetes activos + propios | nueva | M1 |
| **M3** | IA de jugadas: endpoint `POST /api/v1/school/tactical/analyze`, prompt por deporte, salida estructurada, superposición del rival animada, guardar variante; cupo y caché (`tactical_ai_analyses`) | nueva | M1 |
| **M4** | Visor 3D por deporte (fútbol 11/7/5, futsal, vóley, básquet, balonmano), cámaras, caída a 2D | — | M1 (M3 para ver contraataques en 3D) |
| M5 | Pizarra de cancha para waterpolo, tenis, pádel, vóley playa (+ rugby, americano, bádminton, hockey, netball, ultimate en M6f: hecho) | — | M1 |

M2, M3 y M4 son independientes entre sí después de M1 y pueden ir en paralelo con agentes.

## 4. Seguridad

- `exercise_packs` / `school_exercise_packs`: leen staff (`user_staff_school_ids()`); activar o importar, solo
  `user_admin_school_ids()` o coach con permiso táctico (`user_tactical_edit_school_ids()`); paquetes del sistema
  de solo lectura. Activación e importación multi-fila = RPC `SECURITY DEFINER` transaccional.
- IA: el endpoint exige staff con permiso táctico del equipo; nunca manda nombres ni fotos; rate limit por
  usuario; la respuesta del modelo es dato no confiable (se valida, no se ejecuta).
- `npm run seguridad:invariantes` + `seguridad:rls-pizarra` ampliado tras cada migración.

## 5. Pruebas por fase

- M1: unitarias de `resolveSport` contra los 25+ textos reales de `teams.sport`; e2e: equipo de vóley abre su
  cancha, equipo de natación no ve el botón, escuela de fútbol no ve plantillas de vóley.
- M2: RLS (staff, padre, otra escuela, anon); importar archivo válido/inválido/malicioso; e2e activar paquete.
- M3: unitarias del validador de la salida; pruebas con respuestas grabadas del modelo (sin gastar cupo en CI);
  1 corrida real por deporte revisada a ojo; e2e con el endpoint mockeado.
- M4: render en Chromium (WebGL por software), fps mínimo, caída a 2D sin WebGL; captura revisada a ojo.
- Todas: Android gama media + iPhone reales (sigue pendiente desde F1).

## 6. Cobro (decidido 2026-10-14: gratis hasta un punto, después por uso)

- **3D: gratis para toda escuela con pizarra.** Corre en el celular del coach: a SportMaps no le cuesta nada por uso.
- **IA: cupo gratis mensual por escuela, después paquetes de análisis.** Se vende en *análisis* («50 análisis»),
  no en tokens: un coach no sabe qué es un token. Cada análisis registra sus tokens reales en `llm-usage`; el precio
  del paquete se fija con el costo medido de las primeras corridas reales + margen, no con una estimación.
  - Cupo gratis inicial: 15 análisis/mes por escuela (se reinicia el 1.º del mes, hora Bogotá). Número configurable.
  - Al agotarse: el botón sigue visible y ofrece «Comprar 50 análisis» (adicional de la escuela, mismo flujo de
    pago de adicionales que ya existe). Sin cupo ni paquete no se llama al modelo.
  - Un análisis en caché (misma jugada) no descuenta cupo.
  - Saldo y consumo visibles para el admin de la escuela.
- Tabla `tactical_ai_credits` (escuela, periodo, usados, comprados) mutada solo por RPC `SECURITY DEFINER` con
  `FOR UPDATE` (regla de contadores del repo).
