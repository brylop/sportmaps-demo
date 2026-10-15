# Pizarra M6e — Cámaras, animación y video del 3D

> 2026-10-14. Continúa `pizarra-multideporte-3d-ia.md` (D5: el 3D es VISOR, no editor) y el bloque M6e de
> `pizarra-m6-paridad-tacticalpad.md`. Rama `pizarra-tp/m6e` (sobre `pizarra-tp/integracion`, c88f43a3).
> Pedido del usuario: «3D, animación de la jugada, tipos de cámaras, investiga todo eso».

## 1. Investigación: cómo se filma y se analiza una jugada

### 1.1 Cámaras de una transmisión de TV (fútbol y deportes de cancha)

| Cámara | Dónde va | Para qué la usa la transmisión |
|---|---|---|
| **Principal / «main camera»** | Plataforma alta en la tribuna principal, en la mitad de la cancha (las guías de Free TV Australia OP-32 la piden a ~30-40 m de la banda) | El plano de juego: panea siguiendo el balón, con zoom medio. Es lo que se ve el 80 % del partido |
| **Táctica alta / «tactical camera»** | Muy alta y abierta: en el techo o detrás de un arco (FIFA 2014: una en el techo de cada estadio, detrás de un arco; EURO 2012: una detrás de cada arco) | Plano abierto con los 20 jugadores de campo: estructura, líneas, distancias. Es la que piden los cuerpos técnicos |
| **18 m / borde del área** | Altas, a la altura de cada línea del área | Fueras de lugar y jugadas en el área |
| **Contraplano / «reverse angle»** | En la tribuna opuesta a la principal | Repeticiones desde el otro lado (se invierte el sentido del ataque) |
| **Detrás del arco** (alta y a ras: «goal cam», «in-net») | Atrás de cada arco | Remates, atajadas y el gol desde la perspectiva del arquero o del tirador |
| **Spider-cam / Skycam** (cable) | Colgada de cables sobre la cancha | Toma aérea que vuela encima de la jugada. En el Mundial 2026 pasó de usarse solo en la salida de los equipos y los goles a entrar en el juego en vivo, con varios sistemas por estadio |
| **Dron** | Exterior / estadios abiertos | Planos de ambiente, órbita lenta |
| **Cámara del jugador / POV** | En el árbitro o el arquero (pruebas), o reconstruida por computador | «Lo que veía él»: decisiones, línea de pase |
| **Cenital («top-down»)** | Cable o reconstrucción | Vista tipo pizarra: la que usan los análisis tácticos |
| **Isométrica** | Reconstrucción 3D | Vista de videojuego/analista: se ven a la vez las distancias y la profundidad |

Repeticiones: **cámara lenta** (superslow, 3× a 8×), **repetición** del último tramo desde otro ángulo y
**cuadro congelado** («freeze frame») con telestración: la imagen se detiene, se oscurece y un **foco /
halo** marca al jugador del que se habla (Piero de Ross Video, antes BBC/Red Bee: «auto tracking spotlight»,
«fly between cameras», «replays in 3D stadium or 3D tactical board»).

### 1.2 Herramientas de análisis y pizarras

- **Hudl Sportscode / Hudl Focus**: el club graba con una cámara fija **táctica** (y una «extra-wide»
  panorámica) y codifica las jugadas en vivo; la vista amplia es la que más usan los entrenadores.
- **Metrica Sports (Play)**: análisis de video con datos de posición sobre la imagen. La búsqueda no encontró
  que tenga una cámara virtual 3D.
- **Second Spectrum (Genius Sports)**: seguimiento óptico de la NBA. Hace transmisiones aumentadas en vivo (ESPN,
  Trail Blazers) y la «RomoVision» de CBS. La búsqueda no encontró detalles de su cámara virtual.
- **Beyond Sports (Fox Sports NL) / Piero**: reconstruyen el partido en 3D desde los datos de posición y lo
  muestran desde cámaras virtuales (cualquier ángulo, cenital, el del jugador).
- **Pixellot / Veo** (producción automática de fútbol amateur): graban una panorámica fija y un «**director
  virtual**» por visión artificial recorta un plano tipo TV que sigue la acción (paneo y zoom suavizados).
- **TacticalPad**: animación 3D de las jugadas en la versión Elite, con vista desde la perspectiva del jugador.
  La búsqueda no encontró su lista de cámaras. Tampoco aparece un producto llamado «Tactics Manager 3D».

Conclusión: lo que de verdad usan coach y transmisión cabe en **4 familias**: (a) planos abiertos para leer
la estructura (táctica, cenital, isométrica, dron); (b) el plano de TV que sigue el balón; (c) los fondos
(detrás de cada arco/aro); (d) cámaras pegadas a la acción (balón, jugador, spider-cam). A eso se suma un
**director** que corta entre ellas y la **gramática de la repetición** (lenta, repetición, congelado + foco).

Fuentes:
[Lensrentals — cámaras del Mundial 2026](https://www.lensrentals.com/blog/2026/07/camera-innovations-used-in-the-2026-world-cup/) ·
[Free TV Australia OP-32 (rugby/fútbol)](https://www.freetv.com.au/wp-content/uploads/2019/08/OP-32-Outside-broadcast-requirements-for-rugby-league-rugby-union-and-soccer-Issue-4-January-2015..pdf) ·
[OP-33 (AFL)](https://www.freetv.com.au/wp-content/uploads/2019/08/OP-33-Outside-broadcast-requirements-for-Australian-Football-League-Issue-4-January-2015.pdf) ·
[Cámaras robóticas del Mundial 2014](https://www.live-production.tv/news/sports/robotic-cameras-fifa-world-cup-stadiums.html) ·
[Camera Corps, cámaras tácticas EURO 2012](https://www.live-production.tv/news/sports/camera-corps-gets-tactical-uefa-euro-2012) ·
[NBCSN «tactical cam»](https://awfulannouncing.com/2014/nbcsn-debuting-tactical-soccer-cam-today.html) ·
[Hudl Focus Flex (FAI)](https://www.hudl.com/blog/hudl-focus-flex-football-association-ireland) ·
[Hudl + Rangers FC](https://www.hudl.com/blog/seeing-success-a-view-from-the-top-with-rangers-fc) ·
[Hudl compra Incatec](https://hudl.com/blog/hudl-announces-incatec-acquisition-bolsters-smart-camera-technology-for-2019-and-beyond) ·
[Fox Sports NL / Beyond Sports](https://www.svgeurope.org/blog/headlines/sporttech-2017-fox-sports-netherlands-ventures-into-virtual-camera-technology/) ·
[Ross Piero](https://rossvideo.com/live-production/graphics/piero) ·
[Second Spectrum + Trail Blazers](https://sportbusiness.com/news/genius-sports-trail-blazers) ·
[Second Spectrum, broadcast inmersivo](https://www.hashtagsports.com/awards/shortlist-2022/powering-immersive-broadcast-second-spectrum) ·
[Metrica Sports](https://www.soccerscene.com.au/metrica-sports-revamping-data-extrapolation-and-analysis/) ·
[Pixellot (NVIDIA)](https://developer.nvidia.com/ai-technology-automatically-records-soccer-matches) ·
[Veo (TechCrunch)](https://techcrunch.com/2017/08/30/veo/amp/) ·
[TacticalPad (World Soccer Talk)](https://worldsoccertalk.com/product-reviews/tacticalpad-helps-visualize-soccer-tactics-with-quick-and-easy-to-use-software-20130725-CMS-80038.html).

## 2. Qué implementamos (decisiones cerradas)

Todo es **cálculo puro** sobre los MISMOS cuadros e interpolación del 2D (`tacticalAnimation.ts`). Nada se
guarda. Ejes: x a lo ancho, z a lo largo (arco propio = +z, rival = −z), metros reales.

### 2.1 Las 11 cámaras (`lib/school/tactical3dCameras.ts`)

| Botón | Pose | Se mueve |
|---|---|---|
| **Transmisión TV** (por defecto) | Tribuna izquierda, 30° de elevación. A lo ancho entra el 55 % del largo en fútbol 11 (casi toda la cancha en las chicas) | **Panea a lo largo** siguiendo el balón suavizado (τ = 0,45 s), con tope para no mostrar la nada detrás del fondo. Nunca se corre a lo ancho (está fija en la tribuna) |
| **Táctica alta** | La «Tribuna» de M4: cancha entera desde la banda, alta | No |
| **Cenital** | Encima del centro, el arco rival ARRIBA como en el 2D | No |
| **Isométrica** | Desde la esquina propia-izquierda, 45° en planta y 35,26° de elevación | No |
| **Detrás del arco / aro** · **Fondo propio** (vóley) | Atrás del fondo propio, alta | No |
| **Arco / Aro rival** · **Fondo rival** | La misma, espejada en el otro fondo | No |
| **Seguir balón** | Detrás del balón (+z) y arriba, mirando hacia el ataque | Sí (τ = 0,22 s) |
| **Seguir jugador** | «Sus ojos» (POV: a 1,65 m × escala, mira al balón o al arco rival; su figura no se dibuja) o «Detrás de él» (3.ª persona según hacia dónde corre). Se elige **tocando al jugador** o en la lista | Sí |
| **Spider-cam** | Alta (22 % del largo, ≥ 9 m), un poco detrás del balón y mirándolo en picado | Sí, lenta (τ = 0,9 s, cable) |
| **Dron** | Órbita alrededor de la cancha, una vuelta cada 48 s, arranca sobre la banda izquierda | Sí, sola |
| **Libre** | La órbita con el dedo o el mouse de M4, desde donde estaba la cámara | El usuario |

Nombres por deporte: **arco** (fútbol, futsal, balonmano), **aro** (básquet), **fondo** (vóley y genérico).

**Transiciones**: posición y objetivo se interpolan con ease in-out cúbico. Tardan 600 ms entre poses cercanas
y hasta 900 ms entre las lejanas (600 + 2,5 ms por metro). Para llegar a una cámara que se mueve, se mezcla
hacia su pose VIVA, así que no hay salto al final. Al abrir y con `prefers-reduced-motion` el corte es directo.

**Suavizado**: exponencial e independiente de los fps (dos pasos de dt/2 = uno de dt). Hacia dónde mira el
jugador, por el camino corto.

### 2.2 Director automático («Cámara automática»)

Reglas por tramo (el tramo es la transición entre dos cuadros que se está reproduciendo):

1. El balón **termina el tramo en el último 20 % de un fondo** y va hacia él (remate, tiro, lanzamiento): la
   cámara va **detrás de ese arco/aro**. Hacia el rival es «Arco rival» y hacia el propio, «Detrás del arco».
2. El balón recorre un **pase largo**, de al menos el 30 % del largo de la cancha (31,5 m en fútbol 11; mínimo
   6 m): **Seguir balón**.
3. Todo lo demás (salida, elaboración, conducción): **Transmisión TV**.

Vóley (red) y genérico no tienen arco: solo aplican 2 y 3. **Histéresis**: no corta antes de 1,2 s en la
misma cámara. A 0,25× los tramos duran 4 veces más y no hace falta otra regla. Mientras el director está
prendido, el botón de la cámara al aire lleva un anillo y aparece «Al aire: …». Tocar una cámara apaga el
director.

### 2.3 Animación (`lib/school/tactical3dMotion.ts` + componentes)

- **Balón**: la planta es exactamente la del 2D. Encima va una **parábola** cuando el tramo supera el umbral
  de vuelo (20 % del largo, entre 5 y 16 m). La altura máxima es el 22 % de la distancia, con tope del 10 % del
  largo (mínimo 4 m): 30 m de pase son 6,6 m de altura. Usa el MISMO easing, así que sale del pie con altura 0
  y **cae donde dice el cuadro**. En los pases cortos **rueda** (gira distancia/radio). La sombra se queda en
  el piso y se achica y aclara con la altura: así no «flota». Va en `BallFlight3D.tsx`; `Ball3D` queda solo
  para el material «balón».
- **Jugadores** (`FigureMotion3D.tsx`, sin modelos ni esqueletos): miran hacia su último desplazamiento (por
  defecto, el arco rival). La velocidad sale de la derivada del easing. Al correr mueven las piernas desde la
  cadera, el cuerpo rebota y se inclina. Quietos quedan en reposo. La fase de la zancada es determinista
  (ciclos por tramo, con tope de 3 ciclos/s, porque las jugadas van comprimidas en el tiempo). Sombra y aro de
  selección se compensan para quedar planos en el piso. Gira las piezas que ya arma `PlayerFigure`, **sin
  tocar `Figures3D.tsx`**: si la figura cambia, solo gira el cuerpo entero.
- **Rastro** (opcional, botón «Rastro»): por dónde pasó cada jugador hasta el instante, del color de su
  camiseta (un solo `LineSegments`).
- **Cámara lenta 0,25×** (además de 0,5×, 1× y 2×; el 2D sigue con las suyas).
- **Repetición**: el último tramo a 0,25×; al terminar vuelve a la velocidad que había.
- **Cuadro congelado**: pausa, baja las luces y pone haz de luz + halo sobre el jugador tocado o, si no hay,
  el más cercano al balón. El foco queda siempre montado con intensidad 0 para no recompilar los shaders.
- **Cuadro a cuadro**: ◀ ▶ (y las flechas del teclado) saltan al cuadro anterior o siguiente.

Sincronía: mismas funciones de tiempo (`interpolateFrames`, `frameStartMs`, `advancePlayback`). La prueba
compara jugadores, balón y orientación con el 2D en 10 instantes.

### 2.4 Video del 3D

«Grabar video»: vuelve a 0, reproduce y descarga `jugada-3d-<título>.mp4|webm`. Mientras graba,
`RecorderTap3D` toma el render: dibuja la escena y, en la MISMA tarea, copia el canvas WebGL a un canvas 2D
con «Powered by SportMaps» en la esquina. El canvas 2D va en la página fuera de vista, porque un canvas suelto
no le entrega cuadros al MP4 de Chromium. Además se limita a ~400 mil píxeles (p. ej. 808×505): el MP4 elegido
es H.264 nivel 3.0 (`avc1.42E01E`, ≤ 1620 macrobloques) y si es más grande sale vacío. Las dos cosas se midieron
en Chromium. Ese canvas 2D es el que se graba con
`captureStream(30)` + `MediaRecorder`. Grabar el canvas WebGL directo daba un video vacío: sin
`preserveDrawingBuffer`, SwiftShader no le entrega ningún cuadro a `captureStream` (medido: 0 bytes). Usa el mismo criterio de formato que el video 2D
(`pickVideoMime` / `canRecordVideo` de `tacticalAnimationFormat.ts`): MP4 primero, después WebM. Si el
navegador no graba (Safari viejo, WebView), el botón no aparece y el GIF del 2D sigue siendo el camino.
Los botones no salen en el video (es solo la escena). Pendiente: la marca no la apaga la marca blanca, porque el visor no conoce el addon; hay que pasarlo
cuando se conecte con la exportación.

### 2.5 Rendimiento y accesibilidad

- Sigue la caída a 2D por WebGL2 o por menos de 20 fps en los primeros 2 s (sin cambios).
- `prefers-reduced-motion`: el director y el dron quedan deshabilitados (con el motivo en el botón), las
  transiciones son corte directo, no hay zancada ni halo que late. Si se pidió dron al abrir, queda en TV.
- Sin fugas: todo pasa por `track/useResources`. La prueba e2e abre y cierra 5 veces y exige `live = 0` y
  todos los contextos perdidos.
- three sigue en `vendor-three` y el visor en el chunk lazy de `Tactical3DModal`: nada entra a la pizarra.

## 3. Pruebas

- `src/test/tactical3dCameras.test.ts`, vitest puro:
  - cada cámara por deporte, el paneo de TV con tope, la órbita del dron y el jugador elegido;
  - el suavizado (retraso, 63 % a τ, independiente de los fps) y las transiciones (600-900 ms, ease);
  - las reglas y la histéresis del director;
  - el arco del balón (altura según la distancia, tope, sale y cae donde debe, simetría);
  - la sincronía con el 2D en 10 instantes, la zancada (reposo, cadencia con tope);
  - cuadro a cuadro, repetición, foco y rastro.
- `e2e/pizarra-3d-camaras.spec.ts` (en `playwright.pizarra.config.ts`), contra el banco
  `e2e/harness/visor-3d.html`, que tiene jugadas fijas y no pide login ni base:
  - capturas de las 11 cámaras (+ 3.ª persona) en fútbol 11, vóley y básquet con el balón en el aire;
  - el director en 3 instantes y en vivo;
  - cámara lenta medida, cuadro a cuadro, repetición, congelado con foco y rastro;
  - un video descargado con firma WebM/MP4;
  - reduced-motion y abrir/cerrar 5 veces.

## 4. Fuera de alcance (después)

- Contraplano («reverse», la TV desde la otra tribuna) y cámaras de 18 m: fáciles de sumar al catálogo si se
  piden. Hoy «Arco rival» cubre el cambio de sentido.
- Telestración sobre el cuadro congelado (dibujar encima) y zoom de la cámara de TV según la jugada.
- Animación con huesos o modelos con camiseta del equipo (M6b define los estilos de ficha, en `Figures3D`).
- Marca blanca en el video del 3D (ver 2.4).
