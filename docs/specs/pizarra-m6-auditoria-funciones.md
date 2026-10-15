# Pizarra M6 — auditoría de funciones frente a TacticalPad y similares

> 2026-10-14 · bloque **M6d** (`pizarra-tp/m6d`). Continúa `pizarra-m6-paridad-tacticalpad.md`.
> Fuentes públicas (fichas de tiendas, sitios de los fabricantes, reseñas). Son afirmaciones de marketing: no se
> probaron las apps. No hay manual público de TacticalPad. Sus tipos de línea concretos (pase, conducción, disparo)
> no figuran en las fichas; la convención que adoptamos es la de Tacticsboard, Football Tactics Board y
> easy Sports-Graphics, que es la de cualquier cuerpo técnico.

**Herramientas comparadas.**

| Sigla | Herramienta |
|---|---|
| TP | TacticalPad |
| TM | Tactics Manager (SoccerTutor) |
| ESG | easy Sports-Graphics |
| EA4 | easy Animation 4 |
| SP | Sportplan |
| CP | Coach Paint |
| TB | Tacticsboard |
| TS | TacticSlate |
| FTB | Football Tactics Board |
| MB | TheManagerBoard |
| E2C | easy2coach |

**Leyenda de la columna «¿Lo tenemos?».**

| Valor | Qué significa |
|---|---|
| **Sí** | Ya estaba antes de M6. |
| **M6d** | Lo implementa este bloque. |
| **Parcial** | Existe, pero con límites (se explican en la fila). |
| **M6a / M6b / M6c / M6e / M6f / M6g** | Lo hace otro bloque: aquí solo se lista. |
| **No** | No se hará por ahora (motivo en la fila). |

**Prioridad:** P1 = paridad (sin esto no compite) · P2 = diferencial · P3 = deseable.

## 1. Dibujo

| Función | Quién la tiene | ¿Lo tenemos? | Prioridad | Nota |
|---|---|---|---|---|
| Trazo libre (lápiz) | TP, FTB, MB, TS | Sí | P1 | Con Apple Pencil, eventos coalescidos y suavizado |
| Recta / flecha | TP, FTB, MB, ESG | Sí | P1 | |
| Flecha curva | FTB, MB, E2C, ESG | Sí | P1 | Comba fija; además ahora hay curvas con estilo |
| **Tipos semánticos de línea**: pase, conducción, carrera, disparo | TB, ESG, SP | **M6d** | P1 | Pase discontinuo con flecha, conducción ondulada, carrera continua, disparo doble. Rectas y curvas. |
| **Leyenda de líneas** | (ESG por plantillas) | **M6d** | P2 | Sale sola en la cancha y en PNG/PDF/GIF/video, solo con los estilos usados |
| Línea discontinua | TP, FTB, MB | M6d | P1 | Es el «pase» |
| Conducción en zigzag / ondulada | FTB, TB | M6d | P1 | Onda de amplitud fija; los últimos 7 u van rectos para que la punta se lea |
| Color configurable | TP, FTB, MB, ESG | Sí | P1 | 9 colores |
| Grosor configurable | FTB, MB, EA4 | Parcial | P3 | Fijo por estilo (el disparo es más grueso). Un slider de grosor queda para después. |
| Borrador | TP | Sí | P1 | Conoce también polígonos y foco |
| Texto / etiquetas | TS, E2C, TM | Sí | P1 | |
| Globos de diálogo | TM | No | P3 | El texto libre cubre la necesidad |
| **Zonas: rectángulo, elipse, polígono** | TP, MB, EA4, CP, TS | **M6d** | P1 | Relleno translúcido (0,05–0,6) y color. Rect/elipse se giran y escalan como el material; el polígono mueve vértices. Hasta 24 vértices. |
| Triángulo / pentágono / hexágono | MB | Parcial | P3 | Se dibujan como polígono; además, rondos en las plantillas de campo |
| El relleno no tapa a los jugadores | — | M6d | P1 | Solo el borde toma toques; el centro deja arrastrar al jugador |
| **Resaltar jugador (foco / halo)** | TP, FTB, CP | **M6d** | P1 | Anillo con resplandor que se pega al jugador tocado; tamaño y color. **No sigue al jugador** en la animación (es una figura por cuadro). |
| **Numeración de movimientos (1, 2, 3)** | ESG, MB | **M6d** | P1 | «Numerar» agrega el número a cada flecha, curva o recorrido nuevo; «Renumerar» los deja 1..n |
| Líneas que unen jugadores y siguen al moverlos (línea defensiva, triángulos) | MB, TP, CP | No | P2 | Necesita figuras ancladas a jugadores: candidato a M7 |
| Estela del movimiento (trail / fantasmas) | TP, FTB, MB, TS | Sí / M6g | P2 | Ya hay rastro al mover; «mostrar siempre la ruta» es M6g |
| Medición de distancia | CP | Sí | P2 | Regla de medir en metros reales por deporte |
| Velocidad y distancia con IA | CP Pro | No | P3 | |
| Malla / cuadrícula de posiciones | FTB | M6d | P2 | Plantillas de campo (juego de posición, cuadrículas) |
| Selección múltiple | ESG | No | P3 | |
| Orden de capas (traer al frente) | ESG, MB | No | P3 | El orden es el de creación; las zonas van debajo de las flechas por color/opacidad |
| Deshacer / rehacer | (menores) | Sí | P1 | |

## 2. Cancha: vistas, plantillas y estilos

| Función | Quién la tiene | ¿Lo tenemos? | Prioridad | Nota |
|---|---|---|---|---|
| Cancha completa / media cancha | FTB, MB, TP | **M6d** | P1 | Cámara: completa, media (arco abajo), media (arco arriba), 3/4 y área. Generaliza el zoom de arqueros `GK_VIEW`. Las coordenadas se guardan siempre sobre la cancha completa. |
| Orientación horizontal / vertical | TP, MB | **Parcial (M6d)** | P2 | Horizontal en PNG, PDF, GIF, video y miniaturas, con el arco rival a la derecha y los textos derechos. La pizarra **edita en vertical**: girarla rompería el arrastre de los pines (dnd-kit mide en px de pantalla) y los paneles de otros bloques. Se avisa con «Horizontal al exportar». |
| **Plantillas de líneas** con galería y miniatura | TP | **M6d** | P1 | 5 carriles, 3 tercios, carriles + tercios, half-spaces, juego de posición (20 zonas), área grande + líneas, diagonales, cuadrículas 2×2 / 3×3 / 4×3, sin líneas y rondos (círculo, triángulo, hexágono, cuadrado). Carriles, half-spaces y juego de posición solo en canchas de fútbol (11/7/5/futsal). |
| «Incluyendo porterías» | TP | M6d | P2 | Agrega un arco en cada fondo de los lienzos de ejercicio; las canchas reglamentarias ya traen los suyos |
| Divisiones tácticas (carriles/tercios) | FTB, MB | M6d | P1 | Mismas plantillas |
| **Estilos de piso** | FTB, MB, TP, ESG | **M6d** | P1 | Césped a rayas, liso, sintética, madera, azul indoor y pizarra blanca (para imprimir, líneas oscuras) |
| Colores de césped, líneas y contorno | TP (2025.1), MB | **M6d** | P2 | Paletas cortas pensadas para que las figuras se sigan leyendo |
| Imagen propia de fondo | TP | No | — | Decisión del spec: no subir archivos de usuarios (almacenamiento). Se reemplaza con plantillas dibujadas. |
| Más deportes (rugby, tenis, pádel…) | TP, MB, ESG | M6f | P2 | |
| Ángulos 2D/3D (43 cámaras), campos en perspectiva | TM, ESG | M6e | P2 | Cámaras 3D |
| Zoom y paneo con pellizco | FTB, EA4, CP | Parcial | P3 | Las cámaras cubren el zoom útil; un pellizco libre queda para después |

## 3. Jugadores, equipos y formaciones (otros bloques)

| Función | Quién la tiene | ¿Lo tenemos? | Prioridad |
|---|---|---|---|
| Galería de formaciones con miniatura, espejo al rival | TP, FTB, E2C | M6a | P1 |
| Configuración de los dos equipos: nombre, escudo, colores, estilo de ficha, qué mostrar | TP, MB, ESG | M6b | P1 |
| Rivales guardados por escuela | TP (2026.1) | M6b | P2 |
| Portero distinto, tamaño global de fichas y material | TP, MB | M6b | P2 |
| Figuras con pose / orientación del cuerpo | ESG, FTB, TM | No (P3) | P3 |
| Árbitro | E2C, MB | No | P3 |

## 4. Material

| Función | Quién la tiene | ¿Lo tenemos? | Nota |
|---|---|---|---|
| Conos, platos, vallas, picas, aros, escalera, maniquí, arcos, balón | MB, ESG, TM, TP | Sí | 11 objetos por deporte, con tamaño y giro |
| Más de 250 íconos | E2C | No | Se amplía por pedido |
| Imagen propia como objeto | MB | No | Igual que el fondo: no se suben archivos |

## 5. Animación, exportar, video y notas

| Función | Quién la tiene | ¿Lo tenemos? | Nota |
|---|---|---|---|
| Cuadros, línea de tiempo, reproducir | TP, TB, TS, MB, EA4 | Sí | Hasta 30 cuadros |
| Curva de velocidad, posesión del balón, rutas siempre visibles | MB | M6g | |
| Animación 3D | TP, TM, TS | Sí / M6e | |
| PNG, PDF, GIF, video (MP4/WebM) | TB, TS, MB, ESG, TP | Sí | Ahora con cámara, orientación, piso, plantilla y leyenda |
| Presets de tamaño 4:3 / 16:9 | TP, ESG | No | P3 |
| Compartir por WhatsApp / enlace | TP, E2C, TB | Sí | |
| Imprimir | ESG, E2C | Sí (PDF) | La «pizarra blanca» es para imprimir sin gastar tinta |
| Notas por jugada y por cuadro, videos de YouTube/Vimeo | TP, MB | M6c | |
| Análisis de video con telestración | CP, TP Elite | No | Fuera de alcance |

## 6. Otros

| Función | Quién la tiene | ¿Lo tenemos? | Nota |
|---|---|---|---|
| Biblioteca de ejercicios, paquetes | TP, TM, E2C | Sí | |
| Planificador de sesiones | TP, TM, MB | Sí | Mesociclos y sesiones |
| Colaboración y comunidad | E2C, TB, TM | Parcial | La biblioteca se comparte dentro de la escuela |
| IA (análisis de la jugada) | CP Pro | Sí | Más que la competencia: riesgos, contraataques, variantes |
| Tema claro u oscuro, pantalla completa, nombre siempre visible | TP | M6g | |
| Papelera para restaurar | TP (2026.1) | No | P3 |

## 7. Qué guarda M6d y dónde (sin migración)

Todo viaja en el jsonb `arrows` de la jugada y de cada cuadro, con campos **opcionales**. Una jugada vieja se ve
byte a byte igual: lo prueba `frontend/src/test/tacticalM6dCompat.test.tsx`, contra una línea base generada con el
código anterior a M6d.

| Campo | En | Valores |
|---|---|---|
| `line` | flecha, curva | `pass` · `dribble` · `run` · `shot` |
| `form` | zona | `rect` · `ellipse` · `polygon` (el polígono usa `points`, de 3 a 24 vértices) |
| `fill` | zona | 0,05–0,6 (ausente = 0,14, el de siempre) |
| `rot` | zona rect/elipse | igual que en el material |
| `seq` | flecha, curva, recorrido | 1–99 |
| `type: 'spotlight'` | — | objeto de un punto (tamaño y color) |
| `type: 'court'` + `court` | pseudo-figura, **una por jugada** | `tpl`, `goals`, `cam`, `orient`, `surface`, `grass`/`lines`/`outline` (#rrggbb) |

- **Validación.** La hace el BFF (`bff/src/routes/school/footballShapes.ts`): valores cerrados, colores en formato
  hexadecimal, vértices dentro de la cancha, nada de campos extra, y sigue el tope de 300 figuras.
- **Base de datos.** Los CHECK de la base (`20261005173002`, `20261008155454`) solo miran que sea un arreglo y su
  largo, así que **no hace falta migración**.
- **Clientes viejos.** Mientras no recarguen, dibujarían la pseudo-figura `court` como un punto en la esquina (0,0).
  Se va al recargar.
