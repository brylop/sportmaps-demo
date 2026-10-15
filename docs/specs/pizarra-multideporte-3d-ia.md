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
  - Costo controlado: cupo mensual por usuario en costo real (USD 1) con techo por escuela (ver §6), caché por hash de la jugada, `llm-usage` registra cada llamada.
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

## 6. Cobro (decisión del usuario 2026-10-14, reemplaza la anterior: IA para el coach, limitada por costo real)

- **3D: gratis para toda escuela con pizarra.** Corre en el celular del coach: a SportMaps no le cuesta nada por uso.
- **IA: mejora PARA EL ROL COACH, limitada por TOKENS (costo real), sin precio todavía.** Se mide el uso y después se
  fija el precio; quien quiera más, compra más. Migración `20261014155445_pizarra_ia_cupo_por_entrenador_tokens`
  (encima de `20261014111442`, sin editarla).
  - **Cupo por USUARIO** (coach/staff que analiza) **y por mes** (hora Bogotá, se reinicia el 1.º): **USD 1,00**
    (`tactical_ai_user_budget_micro_usd()`). Un coach de dos escuelas tiene un cupo en cada una.
  - **Techo por ESCUELA y mes: 10 × el del usuario** (`tactical_ai_school_ceiling_factor()`). Medido el 2026-10-14:
    41 escuelas con staff activo, p90 = 4 personas, máximo 13: el techo casi nunca muerde; es el tope de exposición.
  - Todo en **microdólares de costo real**. El BFF calcula el costo de cada llamada con los tokens de entrada,
    escritura de caché, lectura de caché y salida y la tabla de precios del modelo usado (`PRECIOS_POR_MILLON` en
    `bff/src/services/llm-usage.service.ts`, la única tabla de precios del BFF). Se guardan también los tokens crudos.
    Modelo sin precio o sin tokens → se cobra el estimado (nunca gratis por no saber).
  - Costo medido por análisis (Sonnet 5.5, esfuerzo low): fútbol 11 USD 0,064 · f7 0,052 · f5 0,050 · futsal 0,056 ·
    voleibol 0,043 · baloncesto 0,046 · balonmano 0,061. Con USD 1 son ~15 análisis de fútbol 11 o ~22 de voleibol.
  - **Flujo:** antes de llamar al modelo se **reserva** un estimado (USD 0,08, por encima del máximo medido) con
    `FOR UPDATE` sobre la fila de la escuela y después la del usuario (siempre en ese orden); al llegar la respuesta
    se **cobra** el costo real; si falla, se **libera**. Una reserva sin cerrar vence a los 15 min. Caché (misma
    jugada) = USD 0. Cupo agotado (usuario o escuela) → `needs_more` sin llamar al modelo. La suma reservada nunca
    pasa el presupuesto (20 análisis en paralelo → 12 reservas de 0,08 con USD 1).
  - **Lo que ve el coach:** barra «Te queda el 60 % de tu IA este mes · unos 9 análisis de fútbol 11» (deporte del
    equipo; «unos N» = lo que queda / costo medio de ese deporte). Agotado: «Usaste tu IA de este mes» + **«Quiero
    más»**, que abre WhatsApp al comercial (`lib/salesContact.ts`, +57 320 268 3539) con un mensaje pre-llenado:
    escuela, quien pide, deporte y consumo del mes; **nada de atletas**. Se quitó «Comprar 50 análisis»
    (`/mi-plan?upsell=pizarra_ia` nunca se construyó). Visible para todo rol que usa la pizarra (coach incluido).
  - **Más cupo:** el super admin da USD con `grant_tactical_ai_credits(escuela, usd, usuario?, nota?)`: a un coach
    (sube su cupo y, por el mismo monto, el techo de la escuela, para que el techo no frene lo regalado) o a la
    escuela (sube solo el techo). Vale para el mes en curso; queda en `tactical_ai_grants` con quién lo dio. La firma
    vieja `grant_tactical_ai_credits(escuela, N análisis)` sigue y da N × USD 0,08 de techo de escuela.
  - **Panel del super admin** «Uso de IA de pizarra» (`/admin/ia-pizarra`, Gestión Global): por mes, por escuela y
    por coach (análisis, aciertos de caché, tokens entrada/salida, costo real, % del cupo, quién topó), totales y
    costo medio por deporte, y «Dar más cupo». Es el dato para fijar el precio.
- **Tablas** (mutadas solo por RPC `SECURITY DEFINER` con `FOR UPDATE`; EXECUTE solo `service_role` salvo el grant):
  `tactical_ai_user_usage` (usuario × escuela × mes), `tactical_ai_school_usage` (escuela × mes),
  `tactical_ai_runs` (cada intento: reserva / cobro / liberación / vencida / caché / sin saldo, con costo y tokens),
  `tactical_ai_grants`. **RLS:** el usuario lee lo suyo; el admin de la escuela (`user_admin_school_ids()`, sin
  coaches) lee su escuela por coach; el super admin todo; nadie escribe directo.
- **Obsoleto** (se depreca SIN borrar datos): `tactical_ai_credits` (contador por escuela en número de análisis),
  `tactical_ai_free_quota()`, `consume_/refund_tactical_ai_credit()` (sin EXECUTE para nadie: la tabla queda
  congelada) y `tactical_ai_balance()`. `tactical_ai_analyses` (caché por hash) sigue vigente.
