# Checklist de QA — Pizarra táctica F1 (material, recorridos de balón, siluetas, modo arqueros)

**Fecha:** 2026-09-24 · **Estado:** listo para ejecutar cuando F1 esté desplegada en dev/staging.
**Spec:** `docs/specs/pizarra-tactica-material-y-3d.md` §3 (F1) y §5 (datos).
**Componente:** `frontend/src/components/school/TacticalBoard.tsx` (SVG 2D; figuras en el jsonb `arrows` de `match_lineups` y de `team_tactical_presets`).
**BFF:** `bff/src/routes/school/football.ts` → `validateArrows()` (tipos, colores, `size` 0.25–4, `rot` numérico, `kind` pase|remate|penal, coordenadas 0–100).
**Alcance:** solo F1, sin migraciones. La vista 3D (F2) NO se prueba acá.

Origen del pedido: Club Carmel (entrenador de arqueros Yohan Casas + coaches de categoría). Carmel usa **celulares en la cancha**, por eso la mitad de este plan es móvil.

---

## 0. Cómo usar este checklist

- Cada caso es independiente salvo que diga "requiere X". Se ejecuta en el orden de los grupos; el grupo 2.0 (humo) va primero y si falla algo ahí, se frena y se reporta antes de seguir.
- Resultado por caso y por dispositivo: **PASS** / **FAIL** / **BLOQUEADO** (no se pudo llegar) / **N/A** (no aplica a ese dispositivo). Todo FAIL lleva evidencia.
- Evidencia mínima: captura de pantalla. Para lo que se mueve (arrastrar, reproducir jugada, giro): video de pantalla de ≤ 30 s. En desktop, consola del navegador abierta (F12) y anotar cualquier error rojo nuevo.
- Ambiente: **dev o staging, nunca producción.** Ojo: los tres ambientes comparten la misma base de Supabase (`docs/gotchas-tecnicos.md`), así que los datos que se ven son reales aunque la URL sea de dev. No tocar equipos ni atletas de escuelas reales.
- Términos: **tamaño 1** = valor por defecto del slider; **0.5** = mínimo; **3** = máximo. **Selección** = tocar un objeto lo selecciona: marco punteado alrededor, **handle verde de giro** arriba y **× roja**; tocar **nunca** borra. **Borrar un objeto** = la × roja o el botón de basura del panel de selección; el botón **"Borrar"** del toolbar vacía todas las figuras. **Zoom** = cancha recortada al área; se prende solo al elegir la situación Arqueros y además tiene **botón propio** en el toolbar (ícono maximizar/minimizar), independiente de la situación.
- Cuidado con la palabra "Plantilla", que en la pizarra significa dos cosas: el botón **"Plantilla (N)"** del header abre la **nómina de jugadores** (roster + banca); el selector **"Plantilla…"** junto a la situación carga las **plantillas tácticas guardadas** (presets). En este documento "plantilla" sin más = plantilla táctica guardada; "nómina" = jugadores.

---

## 1. Precondiciones

### 1.1 Cuenta y datos

| Qué | Detalle |
|---|---|
| Rol | **Coach** con al menos un equipo de fútbol asignado (es el usuario real de Carmel), y una segunda pasada corta como **owner** (`school` / `school_admin`). El coach atraviesa `ModuleGate` sin gate; el owner solo entra si el módulo `gestion_deportiva_entrenamiento_metricas` está prendido para la escuela. |
| Escuela | Una escuela **de prueba** (p. ej. "Club Campestre Demo", la que se usó en la ronda de QA del 2026-09-18) con un equipo cuyo deporte sea **fútbol** (`teams.sport = 'futbol'` o `'fútbol'`; si no, el botón "Tablero táctico" de la lista de sesiones no aparece). **No usar Carmel Club** (`school_id 374a6716…`, slug `carmel-club`): son 72 menores reales. Si se necesita reproducir el caso Carmel, crear en la escuela de prueba un equipo con la misma forma (categoría por años de nacimiento, 15–20 atletas, sin `category_id`). |
| Atletas | ≥ 14 en el equipo (11 en cancha + banca), con **número de camiseta** en la mayoría y al menos 2 sin número (para ver iniciales). Al menos **1 atleta con foto** (`avatar_url`) para verificar que en modo siluetas nunca se muestra la foto. |
| Sesión | ≥ 1 sesión de entrenamiento del equipo con ≥ 2 bloques (los tableros son **por bloque**). |
| Datos "Retro" (**crear ANTES de desplegar F1**, con la versión vieja) | (a) Alineación **Retro-A** en un bloque: 11 jugadores, 1 flecha blanca, 1 curva amarilla, 1 zona azul, y los 5 objetos viejos: Cono, Balón, **Valla** (tipo interno `goal`, que en F1 se rotula "Arco" y se dibuja como marco con red), Contrincante, Vallita. (b) Plantilla **Retro-P** en situación Ataque con slots vacíos + las mismas figuras. Guardar captura de las dos como línea base. Sin esto, los grupos RET y PER-06 quedan BLOQUEADOS. |
| Permisos | El coach debe poder guardar alineaciones y plantillas del equipo (roles `STAFF_ROLES` del BFF). Si un guardado da 403, es precondición, no bug de F1. |

### 1.2 Cómo llegar a la pizarra

**Coach:** menú lateral → **"Sesiones de Entrenamiento"** (`/training-plans`) → filtro "Equipos" → elegir el equipo → abrir la sesión → en cada bloque, botón **"Tablero táctico"** (ícono de arco). También desde el formulario de crear/editar sesión: cada bloque tiene un botón solo con el ícono de arco (tooltip "Abrir tablero táctico para este bloque"); ahí la pizarra abre encima del formulario y al cerrarla el formulario sigue intacto.

**Owner:** menú → Entrenamiento → **"Métricas y Rendimiento"** (`/training-plans`) → mismo camino.

**Tercer punto de entrada (solo regresión, grupo RET):** dashboard de fútbol del equipo → partido → tablero (misma pizarra con `sourceType` de partido, con goles/asistencias en los pines).

Dentro de la pizarra: header con el nombre del equipo, selector de **situación** (Ataque, Defensa, Presión, Transición, Córner, Tiro libre, Penalti, **Arqueros**), selector **"Plantilla…"** (si hay plantillas guardadas), ícono de marcador para guardar/actualizar plantilla, ojo para zonas de la cancha, botón **"Pizarra"** que abre el toolbar de dibujo (Reproducir jugada, Líneas, Objetos, Color, sliders de tamaño y giro más Duplicar y basura para el objeto seleccionado, botón de **zoom al área** con ícono maximizar/minimizar, Deshacer, Borrar, Medir distancia + "Largo cancha … m"), y a la derecha **"Plantilla (N)"** (nómina), **Cancelar** y **Guardar** (guarda la alineación del bloque y cierra).

### 1.3 Dispositivos mínimos

| Dispositivo | Requisito | Para qué |
|---|---|---|
| **Android gama media** (ej. Samsung A-series / Moto G, 4 GB RAM, Chrome actualizado) | Obligatorio | Todo el plan móvil; es el celular real de la cancha. También en **PWA instalada** (modo standalone) para el humo y GES-13. |
| **iPhone** (iOS 16+, **Safari**; y Chrome iOS para GES) | Obligatorio | Gestos (long-press, doble tap, borde izquierdo), memoria de Safari (RND-06). |
| **Desktop** (Chrome + Edge o Firefox; mouse y trackpad) | Obligatorio | Consola, payloads de red (PER-07, PER-13), rendimiento con más carga. |
| Tablet Android/iPad | Deseable | Layout intermedio del toolbar. |

Condiciones: probar al menos una vez con brillo al 50 % y luz fuerte (simula cancha al sol) para el contraste de COL-06; y una vez con red limitada a 4G (DevTools o modo de red del celular) para PER-10 y RND-05.

### 1.4 Prefijos de casos

`HUM` humo · `MAT` material/objetos · `ARC` arco · `BAL` recorridos de balón · `SIL` siluetas · `ARQ` modo arqueros · `COL` colores · `PER` persistencia · `RET` retrocompatibilidad · `REG` regla · `UND` deshacer/borrar · `RND` rendimiento · `GES` gestos táctiles.

Columna **Disp.**: T = todos · M = móviles · D = desktop · A = Android · i = iPhone.

---

## 2. Casos de prueba

### 2.0 Humo (15 minutos, frena si falla)

| ID | Pasos | Resultado esperado | Disp. |
|---|---|---|---|
| HUM-01 | Entrar como coach → Sesiones de Entrenamiento → equipo → sesión → "Tablero táctico". | La pizarra abre a pantalla completa con la nómina cargada, sin spinner infinito ni error. | T |
| HUM-02 | Botón "Pizarra" → colocar un cono → arrastrarlo → seleccionarlo → slider a 2 → girar con el handle → ×. | Cada paso responde de inmediato; el cono desaparece al final y no queda nada roto. | T |
| HUM-03 | Colocar un balón, dibujar un Pase que salga de él, "Reproducir jugada". | Un balón recorre la línea y al final todo vuelve a como estaba. | T |
| HUM-04 | Situación → Arqueros; luego botón de zoom del toolbar (minimizar) y otra vez (maximizar). | La cancha hace zoom al área al elegir Arqueros; el botón la devuelve a cancha completa y la vuelve a recortar; el toolbar sigue usable. | T |
| HUM-05 | Poner 11 jugadores + 3 objetos + 1 recorrido → Guardar → reabrir el mismo bloque. | Toast "Alineación guardada"; al reabrir está todo igual. | T |

### 2.1 Material / objetos (MAT)

| ID | Pasos | Resultado esperado | Disp. |
|---|---|---|---|
| MAT-01 | Abrir "Pizarra" → sección **Objetos**. | Se ven los 11 tipos: cono, plato, balón, arco, arco chico, vallita, aro, escalera, estaca, maniquí, rival. Cada uno con nombre (tooltip o rótulo). En móvil la fila se desplaza sin cortar íconos y sin tapar la cancha. | T |
| MAT-02 | Elegir cada tipo y tocar la cancha una vez por tipo (11 toques en puntos distintos). | Cada objeto aparece **centrado bajo el dedo/cursor**, no corrido ni en el borde. Ninguno se coloca dos veces por un solo toque. | T |
| MAT-03 | Con "cono" activo, tocar 5 veces en fila. | 5 conos separados; el contador del botón "Pizarra (N)" sube en 5. | T |
| MAT-04 | Arrastrar un cono de un extremo a otro de la cancha. | Sigue el dedo sin saltos; queda donde se levantó el dedo; **no** se crea otro cono al soltar. | T |
| MAT-05 | Tocar (sin arrastrar) un objeto ya colocado con una herramienta de objeto activa. | Se **selecciona**: marco punteado alrededor, **handle verde de giro** arriba y **× roja**; el panel muestra los sliders de tamaño y giro y el botón Duplicar. **No** se coloca uno nuevo encima y **no** se borra (tocar nunca borra). Tocar cancha vacía lo deselecciona. | T |
| MAT-06 | Tocar un segundo objeto con el primero seleccionado. | Solo el segundo queda seleccionado. | T |
| MAT-07 | Con un cono seleccionado, mover el slider de 1 → 3 → 0.5. | Escala alrededor de su **centro** (el punto de anclaje no se mueve); el cambio es fluido. | T |
| MAT-08 | Colocar los 11 tipos en tamaño **0.5**, uno al lado del otro. Mirar el celular a distancia de brazo. Captura. | Se distinguen entre sí: cono vs plato vs estaca; aro vs balón; vallita vs escalera; maniquí vs rival vs jugador propio. | M |
| MAT-09 | Los 11 tipos a tamaño **1** y luego a **3**. | A 1 se leen claros sobre el verde. A 3 no se pixelan ni se salen del área tocable; el área de agarre crece con el objeto (se puede agarrar por el borde). | T |
| MAT-10 | Seleccionar → arrastrar el **handle de giro** en círculo, despacio. | El objeto gira en tiempo real siguiendo el dedo; al soltar conserva el ángulo; al moverlo después sigue girado. | T |
| MAT-11 | Con un objeto seleccionado, **slider de giro** del panel: 0, 90, 180, 270, 360. | El dibujo coincide con el ángulo; 360 se ve igual que 0. Girar varias vueltas con el handle no deja un valor absurdo en el guardado (ver PER-13). | T |
| MAT-12 | Girar un objeto a tamaño 3. | Gira **sobre su centro**; no orbita ni se desplaza. | T |
| MAT-13 | Seleccionar un cono azul, tamaño 2, girado 45° → **Duplicar**. | Aparece una copia con mismo tipo, color, tamaño y giro, ligeramente desplazada; la copia queda seleccionada. El contador sube en 1. | T |
| MAT-14 | Seleccionar un objeto entre otros dos → (a) × roja sobre el objeto; repetir con otro → (b) botón de basura del panel de selección. | En los dos caminos desaparece solo ese; los vecinos intactos; contador baja en 1. Tocar el objeto sin más **no** lo borra. | T |
| MAT-15 | Con un objeto a **0.5** en móvil: tocarlo 5 veces y luego intentar girar con el handle verde 5 veces. | Tocar solo selecciona, nunca borra. Al girar, ninguna vez se acciona la × roja por error: × y handle quedan separados lo suficiente para el dedo. | M |
| MAT-16 | Arrastrar un objeto hasta más allá del borde de la cancha. | Queda en el borde (tope) o sobre la línea, nunca fuera del SVG; la pantalla **no** hace scroll. Guardar después de esto funciona (ver PER-13). | T |
| MAT-17 | Elegir color verde → colocar cono, plato, aro, estaca, maniquí, vallita, escalera. Luego seleccionar uno existente y cambiar el color a morado. | Los nuevos salen en el color activo; el seleccionado cambia al elegir otro color. Balón, arco y rival pueden tener color fijo: anotar cuál es el comportamiento. | T |
| MAT-18 | Con **Flecha** activa: (a) tocar un objeto existente; (b) arrastrar desde cancha vacía. | (a) selecciona el objeto sin empezar una línea; (b) dibuja la flecha. | T |
| MAT-19 | Colocar rival, maniquí y un jugador propio juntos. | Los tres se distinguen de un vistazo (rival rojo, maniquí con forma propia, jugador con disco/silueta). | T |
| MAT-20 | Colocar 3 objetos encima de un jugador. | El jugador sigue siendo arrastrable y su × sigue accesible (o el objeto de arriba se puede mover para llegar). Nada queda inalcanzable. | T |
| MAT-21 | **Sin nada seleccionado**, poner el slider de tamaño en 2 y el de giro en 45° → colocar 3 conos → deseleccionar → volver los sliders a 1 y 0° → colocar 1 cono más. | Los 3 primeros salen a 2× y 45°; el último a 1× y 0° (sin selección los sliders fijan cómo se colocan los objetos nuevos, spec §3.2). Los ya colocados no cambian al mover los sliders sin selección. | T |

### 2.2 Arco (ARC)

| ID | Pasos | Resultado esperado | Disp. |
|---|---|---|---|
| ARC-01 | Cancha limpia → colocar un **arco**. | Aparece un marco de arco con red, movible y girable, sobre la cancha. El fondo **no cambia**: sigue mostrando solo áreas, punto penal y círculo central (nunca dibujó un arco, así que no hay nada que "apagar"). | T |
| ARC-02 | Arrastrar el arco al centro de la cancha. | Se mueve como cualquier objeto; la red/marco se ven completos. | T |
| ARC-03 | Colocar el arco en la parte de **arriba** y girarlo **180°** con el handle. | La boca del arco queda mirando hacia el centro de la cancha (como el arco de arriba real). | T |
| ARC-04 | Girar a 90°. | Arco transversal (para fútbol reducido). Sin deformarse. | T |
| ARC-05 | Arco a 0.5 y a 2; al lado un **arco chico** a 1. | El arco chico a tamaño 1 es claramente menor que el arco a tamaño 1; los dos se distinguen a 0.5. | T |
| ARC-06 | Borrar el arco con la × roja; colocar otro y borrarlo con la basura del panel. | Desaparece en ambos caminos; el fondo sigue idéntico (áreas, punto penal, círculo central). | T |
| ARC-07 | Colocar **dos** arcos (cancha reducida) y girar uno 180°. | Independientes: mover, girar o borrar uno no afecta al otro. | T |
| ARC-08 | Arco girado 180° + situación Arqueros. | En el zoom el arco se ve grande, girado igual, y en el mismo lugar relativo. | T |
| ARC-09 | Abrir **Retro-A** (alineación vieja con el objeto "Valla", tipo `goal`). | El objeto que antes se dibujaba como emoji 🥅 ahora se dibuja como **marco de arco con red en la misma posición, tamaño 1×, giro 0°**. Nada más cambia en la cancha. Es el único cambio visible en alineaciones viejas. | T |

### 2.3 Recorridos de balón (BAL)

| ID | Pasos | Resultado esperado | Disp. |
|---|---|---|---|
| BAL-01 | Abrir el toolbar. | Existen las herramientas **Pase**, **Remate** y **Penal** (en Líneas o en su propio grupo), distinguibles de Flecha/Curva/Zona. | T |
| BAL-02 | Dibujar un **Pase** de A a B. | Línea **recta** con estilo distinto a la flecha de jugador (p. ej. punteada / con marca de balón). Extremos arrastrables (como la curva). | T |
| BAL-03 | Dibujar un **Remate** desde el borde del área al arco. | Trazo **curvo** (parábola visual), distinto del pase. | T |
| BAL-04 | Dibujar un **Penal** desde el punto penal al arco. | Trazo curvo, más corto; distinto del remate por estilo o rótulo. | T |
| BAL-05 | Colocar un balón en A, pase A→B, **Reproducir jugada**. | El botón pasa a "Reproduciendo…" y se deshabilita; un balón recorre la línea de A a B; al terminar todo vuelve al estado inicial y el botón se rehabilita. | T |
| BAL-06 | Mismo setup que BAL-05. Mirar el punto A durante la animación. | El balón **colocado** en A se **esconde** al arrancar (no se ven dos balones) y **reaparece** en A al terminar. | T |
| BAL-07 | Balón colocado **lejos** (> 6 % de cancha) del origen del pase → Reproducir. | El balón colocado no se esconde ni se mueve; el recorrido igual anima un balón por la línea. | T |
| BAL-08 | Remate → Reproducir. | El balón se **eleva** durante el trayecto (crece / sombra separada / parábola) y "aterriza" al final. | T |
| BAL-09 | Penal → Reproducir. | Igual que remate, trayecto corto y elevación visible. | T |
| BAL-10 | Jugador puesto en A, balón en A, pase A→B → Reproducir. | Según spec §3.3: el jugador se anima primero hacia el balón y luego sale el balón ("jugador pateando"). Si el dev lo dejó para después, el jugador no se mueve y el balón sí: **anotar cuál** de las dos. | T |
| BAL-11 | Reproducir 3 veces seguidas. | Mismo resultado las 3 veces; sin balones fantasma acumulados; sin objetos desplazados. | T |
| BAL-12 | 2 flechas de jugador + 1 curva + 1 pase + 1 remate → Reproducir. | Todo anima a la vez sin trabarse; al terminar todo vuelve. | T |
| BAL-13 | Solo objetos, sin líneas → Reproducir. | Toast "Nada que reproducir" (variante destructiva), nada se mueve. | T |
| BAL-14 | Color activo naranja → dibujar pase. | El pase sale naranja; el balón animado se ve sobre esa línea. | T |
| BAL-15 | Arrastrar el extremo final de un pase ya dibujado. | El extremo se mueve; al reproducir, el balón llega al nuevo punto. | T |
| BAL-16 | Iniciar Reproducir y **cerrar** el diálogo (Cancelar o X) a mitad de la animación → reabrir. | Al reabrir: estado limpio, sin balón fantasma, botón habilitado, sin errores en consola. | T |
| BAL-17 | Pase cuyo origen está a **menos de 6 %** de dos balones colocados. | Se esconde uno solo (el más cercano) y vuelve al final; el otro no se toca. | T |

### 2.4 Siluetas (SIL)

| ID | Pasos | Resultado esperado | Disp. |
|---|---|---|---|
| SIL-01 | Abrir la pizarra por primera vez en el dispositivo. | Existe el toggle **Discos / Siluetas** en el toolbar; por defecto **discos**; el estado se ve claramente. | T |
| SIL-02 | 11 jugadores puestos (POR, DEF, MED, DEL) → activar Siluetas. | Cada disco pasa a silueta genérica **según su posición** (arquero, defensa, medio, delantero). El **arquero en amarillo**; el resto en el color de jugador propio. | T |
| SIL-03 | Mirar el rótulo de cada silueta. | Número de camiseta si lo tiene; si no, **iniciales**. Legible en móvil a tamaño normal. | T |
| SIL-04 | Atleta **con foto** puesto en cancha → modo Siluetas. | **Nunca se ve la foto**, solo la silueta genérica. En modo Discos la foto se ve como hoy. (Consentimiento de menores: bloqueo real en Carmel.) | T |
| SIL-05 | Activar Siluetas → recargar la página (F5 / cerrar y abrir la PWA) → abrir la pizarra. | Sigue en Siluetas (`localStorage`). Desactivar → recargar → Discos. | T |
| SIL-06 | Siluetas activadas → cerrar sesión → entrar con **otro** coach en el mismo dispositivo → pizarra. | Anotar si hereda Siluetas o vuelve a Discos. Es una **preferencia de vista** (spec §3.5), heredarla no es bug; pero reportar si el `signOut` la borra o no, para que la clave nueva entre en la lista/prefijo de limpieza (`docs/gotchas-tecnicos.md`, "localStorage es del dispositivo"). | T |
| SIL-07 | Arrastrar una silueta; tocar su ×. | Se arrastra igual que un disco (el área de agarre cubre silueta + rótulo); × visible y funcional. | T |
| SIL-08 | Siluetas + flecha de jugador → Reproducir. | La silueta se anima igual que el disco. | T |
| SIL-09 | Siluetas + situación Arqueros. | El arquero amarillo escala proporcional al zoom y no tapa el arco. | T |
| SIL-10 | Abrir la nómina ("Plantilla (N)") y la banca con Siluetas activas. | La nómina y la banca no se rompen (pueden seguir en disco/foto o en silueta; el layout se mantiene). | T |
| SIL-11 | Guardar alineación y plantilla con Siluetas activas → abrir en **otro** dispositivo con Discos. | Se ve en Discos: la preferencia **no** viaja con los datos. | T |
| SIL-12 | Rival colocado + Siluetas. | El rival sigue rojo y distinto de las siluetas propias. | T |

### 2.5 Modo arqueros (ARQ)

| ID | Pasos | Resultado esperado | Disp. |
|---|---|---|---|
| ARQ-01 | Situación → **Arqueros**. | La cancha hace **zoom al tercio defensivo / área**; el arco se ve grande; el catálogo destaca arco, balón, cono, maniquí, valla. | T |
| ARQ-02 | Con situación Ataque y 5 figuras dibujadas, usar el **botón de zoom** del toolbar (ícono maximizar/minimizar) → prender y apagar 3 veces. | El zoom se alterna **sin cambiar la situación y sin tocar las figuras** ni la plantilla cargada (las 5 siguen ahí). En Arqueros el mismo botón devuelve la cancha completa y la vuelve a recortar. Este es el camino para hacer zoom sin perder lo dibujado. | T |
| ARQ-03 | Cancha completa: 11 jugadores repartidos → activar zoom. | Los que quedan **fuera** de la ventana **desaparecen** de la vista; los de adentro se ven en su lugar. Quitar el zoom → **vuelven todos**; el conteo de puestos no cambió. | T |
| ARQ-04 | En zoom, arrastrar un jugador y soltarlo justo sobre el punto penal. | Queda **exactamente** donde se soltó (no salta ni se corre por la escala). Repetir con un cono y con el extremo de una flecha. | T |
| ARQ-05 | En zoom, colocar un objeto con un toque. | Aparece bajo el dedo. | T |
| ARQ-06 | En zoom, dibujar un remate del borde del área al arco. | Extremos donde se tocó; al quitar el zoom la línea está en el mismo lugar relativo de la cancha. | T |
| ARQ-07 | En zoom, armar y **guardar plantilla** "Arqueros-1" → quitar zoom → cargar. Luego al revés: armar en cancha completa (todo dentro del área), guardar, cargar en zoom. | En ambos sentidos todo cae en el área, con proporciones correctas (coordenadas 0–100 de cancha completa, spec §3.4). | T |
| ARQ-08 | En zoom, arrastrar un jugador hacia el borde de la ventana visible y más allá. | Se detiene en el borde visible o queda en el borde; **no** desaparece sin aviso. | T |
| ARQ-09 | Regla: medir línea de gol → punto penal, en cancha completa y en zoom, con "Largo cancha" 105. | Misma lectura (~11 m) en los dos modos, ±0,5 m. | T |
| ARQ-10 | Con figuras dibujadas, cambiar la situación a Arqueros. | El zoom se prende solo. Cambiar de situación **vacía las figuras** y descarga la plantilla: es el comportamiento **previo a F1** (`setArrows([])`), no algo nuevo. Anotar si hubo aviso; si no lo hay, reportar como observación de UX, aclarando que el camino sin pérdida existe (botón de zoom, ARQ-02). | T |
| ARQ-11 | En zoom: balón en punto penal, penal al arco → Reproducir. | La animación ocurre dentro de la ventana; el balón se eleva y llega al arco. | T |
| ARQ-12 | Cambiar de Arqueros a Defensa. | Las figuras se vacían (comportamiento previo a F1). Anotar si el zoom se apaga solo o se mantiene hasta tocar el botón. En cualquier caso, con el zoom apagado (por el botón si hace falta) **vuelven todos** los jugadores; ninguno queda oculto. | T |
| ARQ-13 | Zoom en desktop ancho, móvil vertical y móvil horizontal. | La ventana del zoom mantiene proporción (no se estira), el toolbar sigue accesible, la X nativa del diálogo no queda tapada. | T |

### 2.6 Colores (COL)

| ID | Pasos | Resultado esperado | Disp. |
|---|---|---|---|
| COL-01 | Sección **Color** del toolbar. | 9 muestras: blanco, amarillo, rojo, azul, verde, naranja, morado, rosado, negro. El seleccionado se distingue. En 360 px de ancho se ven las 9 (en 1 o 2 filas), ninguna oculta. | T |
| COL-02 | Dibujar 9 **flechas**, una por color. | Línea **y punta** del mismo color en las 9 (la punta es un `marker` por color). | T |
| COL-03 | 9 **curvas**, una por color. | Ídem: trazo y punta del color elegido. | T |
| COL-04 | 9 **zonas**. | Relleno translúcido + borde punteado del color; el verde y el negro siguen visibles sobre la cancha. | T |
| COL-05 | 9 **conos** (o platos). | Cada uno del color elegido; distinguibles entre sí a tamaño 1. | T |
| COL-06 | Brillo al 50 %, bajo luz fuerte: mirar verde y negro en línea, zona y objeto. Captura. | Legibles sobre el verde de la cancha (halo/borde de contraste o tono distinto al del césped). | M |
| COL-07 | Guardar alineación con figuras de los 9 colores → reabrir. | Los 9 colores vuelven iguales. | T |
| COL-08 | Cargar Retro-A / Retro-P. | Las figuras viejas sin `color` salen **blancas**; las de los 4 colores viejos salen en su color. | T |
| COL-09 | Pase, remate y penal en negro y en rosado. | El trazo y el balón animado se ven; el balón no se confunde con la línea negra. | T |

### 2.7 Persistencia (PER)

| ID | Pasos | Resultado esperado | Disp. |
|---|---|---|---|
| PER-01 | 11 jugadores + 6 objetos con tamaños y giros distintos (incl. arco a 180°) + 1 pase + 1 remate + 1 penal + 1 zona verde → **Guardar**. | Toast "Alineación guardada", el diálogo cierra. Reabrir el mismo bloque: **todo igual** (posición, tipo, tamaño, giro, color, tipo de recorrido). | T |
| PER-02 | Situación Ataque → armar figuras + slots vacíos → ícono marcador → nombre "F1-Ataque" → guardar. Cambiar a Defensa y volver a Ataque → "Plantilla…" → F1-Ataque. | Toast "Plantilla guardada". Al cargar: figuras y slots iguales, con `size`/`rot`/`kind` intactos. | T |
| PER-03 | Con F1-Ataque cargada: cambiar el tamaño de un cono a 2.5 → **Actualizar**. Recargar la página → cargar F1-Ataque. | Toast "Plantilla actualizada"; el cambio está; **no** se duplicó la plantilla (una sola F1-Ataque en el selector). | T |
| PER-04 | Con F1-Ataque cargada → botón **+** (guardar como nueva) → "F1-Ataque-B". | Dos plantillas en el selector; la original sin cambios. | T |
| PER-05 | Cargar F1-Ataque-B → **Eliminar la plantilla cargada**. | Desaparece del selector; F1-Ataque sigue. | T |
| PER-06 | Cargar **Retro-P** (sin `size`/`rot`/`kind`). Consola abierta en desktop. | Abre sin errores; objetos a tamaño 1 y giro 0; flechas sin color en blanco; nada invisible ni con `NaN` en el DOM. | T |
| PER-07 | Desktop, DevTools → Network: guardar plantilla y alineación con (a) un cono nuevo sin tocar tamaño ni giro, (b) un cono al que se le cambió tamaño y giro, (c) un pase, y (d) las figuras de Retro-A sin modificar. Inspeccionar el body del `POST/PUT …/tactical-presets` y `…/lineups`. | El payload **solo incluye `size`/`rot`/`kind` cuando el coach los cambió** (o `kind` en los recorridos): (a) sale sin `size`/`rot`; (b) con `size` y `rot`; (c) con `type: 'ball_path'` y `kind`; (d) **una figura vieja se reenvía sin esas claves** (no `null`, no `undefined`, no defaults inventados). `color` siempre dentro de la lista de 9. **No existe** `schema_version` ni ningún número de versión en la raíz (spec §5). | D |
| PER-08 | Guardar alineación en Android → abrir el mismo bloque en desktop (y viceversa). | Idéntico en ambos. | A, D |
| PER-09 | Hacer cambios → **Cancelar** → reabrir. | Los cambios **no** quedaron; se ve lo último guardado. | T |
| PER-10 | Red en modo avión / offline → Guardar. | Toast "No se pudo guardar" con el mensaje; el diálogo **sigue abierto con todo** lo dibujado (no se pierde el trabajo). Volver la red → Guardar funciona. | T |
| PER-11 | Guardar con el zoom activo (situación Ataque + toggle) → reabrir. | Abre en cancha completa (el zoom es vista, no dato) con las coordenadas intactas. En situación Arqueros abre con zoom. | T |
| PER-12 | 11 jugadores puestos → cargar una plantilla. | La plantilla **nunca mueve** a los jugadores ya puestos (regla D8): agrega slots vacíos y figuras. | T |
| PER-13 | Arrastrar un cono hasta el tope del borde (MAT-16), girar otro 3 vueltas completas, tamaño 0.5 y 3 en otros → Guardar. | Guarda sin 400. El BFF rechaza coordenadas fuera de 0–100, `size` fuera de 0.25–4 y `rot` no numérico: si aparece "x1 inválido…" o "size inválido…" es un bug del frontend (no normaliza antes de enviar). | D |
| PER-14 | Bloque 1 con figuras → Guardar; abrir el tablero del **bloque 2** de la misma sesión. | El bloque 2 abre vacío (tablero por bloque); volver al 1 muestra lo guardado. | T |

### 2.8 Retrocompatibilidad (RET)

| ID | Pasos | Resultado esperado | Disp. |
|---|---|---|---|
| RET-01 | Abrir **Retro-A** (alineación guardada antes de F1). Comparar con la captura base. | Jugadores, flecha, curva y zona iguales. Cono, balón, contrincante y vallita con su equivalente F1 a tamaño 1×, giro 0°. El objeto viejo **"Valla"** (tipo `goal`) se abre como **arco dibujado en la misma posición, tamaño 1×, giro 0°** (antes era un emoji 🥅; ahora es un marco con red). El fondo de cancha no cambia. Sin errores en consola. | T |
| RET-02 | Cargar **Retro-P**. | Igual que PER-06; además el nombre y la situación se mantienen. | T |
| RET-03 | Abrir Retro-A sin tocar nada → Guardar → reabrir. | Nada cambió visualmente; en Network las figuras viejas se reenvían **sin** las claves `size`/`rot`/`kind` (no se inventan defaults ni se mandan `null`/`undefined`), y el BFF responde 200. | D |
| RET-04 | Dashboard de fútbol → partido con alineación previa → tablero. | Abre como antes: pines con goles/asistencias, formación, figuras. El toolbar F1 funciona igual en contexto de partido. | T |
| RET-05 | En contexto de partido: "XI sugerido por minutos jugados". | Sigue funcionando (toast con la aclaración de formación genérica). | T |
| RET-06 | Con la versión vieja aún desplegada en otro ambiente (si existe): abrir una alineación guardada con F1. | La versión vieja ignora `size`/`rot`/`kind` y dibuja lo que conoce; los tipos nuevos (maniquí, aro…) no la rompen. Si no hay ambiente viejo, N/A. | D |

### 2.9 Regla de medir (REG)

| ID | Pasos | Resultado esperado | Disp. |
|---|---|---|---|
| REG-01 | Toolbar → **Medir distancia** → dos toques en la cancha. | Línea amarilla punteada con "~X.Xm". Cambiar "Largo cancha" de 90 a 105 → la lectura sube proporcionalmente. | T |
| REG-02 | Arrastrar un punto de la regla; luego tocar la línea. | El punto se ajusta sin reiniciar la medición; tocar la línea la borra. | T |
| REG-03 | Con la regla activa, tocar encima de un cono. | Pone un punto de medición; **no** selecciona ni mueve el cono (regla y dibujo son excluyentes). | T |
| REG-04 | Medir → Guardar alineación y plantilla → reabrir. | La regla **no** se guarda. | T |
| REG-05 | Medir el ancho del área en cancha completa y en zoom. | Misma lectura ±0,5 m (ver ARQ-09). | T |

### 2.10 Deshacer / Borrar todo (UND)

| ID | Pasos | Resultado esperado | Disp. |
|---|---|---|---|
| UND-01 | Dibujar flecha → colocar cono → dibujar pase → **Deshacer** ×3. | Quita en orden inverso: pase, cono, flecha. Con la lista vacía el botón queda deshabilitado. | T |
| UND-02 | Cambiar tamaño y giro de un cono → Deshacer. | Anotar si deshace el ajuste o quita el cono entero (F1 mínimo: deshace la última figura creada). Documentar cuál. | T |
| UND-03 | Con 10 figuras y 11 jugadores → **Borrar** (botón del toolbar, todas las figuras). | Todas las figuras desaparecen; los **jugadores quedan**; el contador vuelve a 0. | T |
| UND-04 | Cargar F1-Ataque → Borrar → **no** Actualizar → recargar → cargar F1-Ataque. | La plantilla guardada sigue intacta (Borrar solo afecta la pizarra abierta). | T |
| UND-05 | Duplicar un objeto → Deshacer. | Quita el duplicado, no el original. | T |
| UND-06 | Con un objeto seleccionado: (a) botón de basura del panel; luego, con otro seleccionado, (b) **Borrar** del toolbar. | (a) quita solo ese objeto; (b) vacía todas las figuras. En ambos la selección se limpia y no quedan handles ni marco punteado huérfanos flotando. | T |

### 2.11 Rendimiento (RND)

Carga estándar: **30 objetos** (10 conos, 5 platos, 3 balones, 2 arcos, 2 maniquíes, 3 aros, 2 estacas, 1 escalera, 1 vallita, 1 rival) + **10 líneas** (2 flechas, 1 curva, 1 zona, 3 pases, 2 remates, 1 penal) + 11 jugadores.

| ID | Pasos | Resultado esperado | Disp. |
|---|---|---|---|
| RND-01 | Con la carga estándar en el Android de gama media: arrastrar un cono de lado a lado, 5 veces. Video. | Sigue el dedo **sin retraso perceptible** (< ~100 ms) ni saltos. Opcional: Chrome remoto → Performance ≥ 30 fps. | A |
| RND-02 | Carga estándar → Reproducir jugada. | Animación fluida; la UI no se congela; el botón se rehabilita al final. | M |
| RND-03 | Carga estándar → botón de zoom al área (maximizar/minimizar) ×5. | Cada cambio < 1 s, sin parpadeo largo; las figuras y los jugadores siguen intactos. | M |
| RND-04 | Carga estándar → seleccionar un objeto → mover el slider de tamaño de punta a punta. | Escala fluida, sin trabarse. | M |
| RND-05 | Carga estándar → Guardar (red 4G). | < 3 s hasta el toast; body del request < 50 KB (desktop). | T |
| RND-06 | 10 minutos de uso continuo en iPhone Safari (colocar, borrar, reproducir, zoom). | La pestaña **no** se recarga sola (Safari mata pestañas por memoria) y el lag no crece. | i |
| RND-07 | Desktop: duplicar la carga (60 objetos, 20 líneas). | Arrastre fluido; sin errores ni advertencias nuevas en consola. | D |
| RND-08 | Bloque con la carga estándar guardada → cerrar → reabrir. | Con la nómina ya cargada, la pizarra dibuja todo en < 2 s. | T |

### 2.12 Gestos táctiles (GES)

| ID | Pasos | Resultado esperado | Disp. |
|---|---|---|---|
| GES-01 | **Tap** corto sobre un jugador (sin mover) ×5; luego arrastrar ≥ 1 cm. | El tap no lo mueve (umbral de 6 px de dnd-kit); el arrastre sí. Tap en × lo quita sin arrastrarlo. | M |
| GES-02 | Tap sobre un objeto; arrastre sobre otro. | Tap = selecciona; arrastre = mueve **sin** perder la selección a mitad de camino. Mismo umbral que los jugadores (que no se sienta distinto). | M |
| GES-03 | Con Flecha activa, arrastrar de arriba abajo por toda la cancha, en vertical y en horizontal. | La página/diálogo **no** hace scroll; se dibuja la línea. Repetir con Pase y con el handle de giro y el slider. | M |
| GES-04 | Doble tap sobre la cancha; doble tap sobre un objeto. | El navegador **no** hace zoom de página. | M |
| GES-05 | Long-press (1,5 s) sobre un objeto y sobre una silueta. | Sin menú contextual, sin selección de texto azul, sin "guardar imagen" de iOS. | i, A |
| GES-06 | Colocar un objeto pegado al **borde izquierdo** de la pantalla y arrastrarlo hacia la derecha. | No se dispara el gesto de "volver atrás" del navegador ni se cierra el diálogo. Si ocurre, reportar como limitación conocida con la marca del dispositivo. | i, A |
| GES-07 | Girar un objeto a tamaño 1 con el dedo tapándolo. | El giro funciona igual; hay algún indicador del ángulo o del handle visible fuera del dedo. | M |
| GES-08 | Mientras se arrastra un cono, apoyar un **segundo dedo** y levantar los dos. | El cono queda donde estaba el primer dedo; no queda pegado al puntero ni se duplica; el siguiente toque funciona normal. | M |
| GES-09 | Con 5 objetos y 3 líneas, **rotar el celular** (vertical → horizontal → vertical). | Todo se reacomoda en proporción (coordenadas 0–100); nada se pierde; la selección se limpia o se conserva de forma segura. | M |
| GES-10 | Deslizar horizontalmente sobre la fila de **Objetos** y sobre la fila de **Color**. | Solo se desplaza el toolbar; **no** se coloca ningún objeto ni se cambia el color por accidente. | M |
| GES-11 | Editar la etiqueta de un jugador (rótulo bajo el pin) con teclado en pantalla. | El teclado abre, la cancha no salta fuera de la vista, al cerrar el teclado el layout vuelve. | M |
| GES-12 | Desktop: clic derecho sobre un objeto; rueda del mouse sobre la cancha; arrastre con trackpad. | Nada se rompe; la rueda no hace zoom de la pizarra (salvo que sea intencional: anotar). | D |
| GES-13 | **PWA instalada** (Android, standalone): repetir HUM-01…05 y GES-03. | Igual que en el navegador; sin barra de URL, la X nativa del diálogo sigue accesible y el safe-area no tapa el toolbar. | A |

---

## 3. Riesgos donde es más probable que falle

| # | Riesgo | Por qué (lo que se ve en el código) | Qué mirar | Casos |
|---|---|---|---|---|
| R1 | **Jugadores y objetos viven en dos sistemas de coordenadas distintos** | Los pines de jugador son `div` HTML posicionados con `left/top` en % del contenedor (dnd-kit); las figuras son SVG dentro del `viewBox`. El zoom de arqueros cambia el `viewBox`, pero el % de los `div` no se recorta solo: los jugadores pueden quedar desalineados de sus flechas, o "saltar" al soltarlos porque la conversión píxel→% usa la cancha completa. | Jugador soltado sobre el punto penal en zoom queda ahí; su flecha nace de su pie; los de afuera desaparecen y vuelven. | ARQ-03, ARQ-04, ARQ-07, BAL-10, SIL-09 |
| R2 | **Puntas de flecha por color** | La punta es un `<marker id="arrowhead-<color>">` generado por color. Pasar de 4 a 9 colores exige 9 markers; si falta uno, la línea sale sin punta o con punta blanca. | Punta y línea del mismo color en los 9, en flecha, curva y pase. | COL-02, COL-03, COL-09 |
| R3 | **Cambiar de situación vacía las figuras sin avisar** (riesgo de UX, no de F1) | El `onValueChange` del selector hace `setArrows([])` y `setLoadedPresetId(null)` desde antes de F1. Como elegir "Arqueros" también prende el zoom, un coach que quiera solo el zoom puede llegar por el selector y perder lo dibujado. **Hay camino sin pérdida:** el botón de zoom del toolbar (maximizar/minimizar) funciona en cualquier situación y no toca las figuras. | Que el botón de zoom esté visible y no toque las figuras; que al cambiar de situación haya aviso, o que el equipo acepte explícitamente el vaciado. | ARQ-02, ARQ-10, ARQ-12 |
| R4 | **El `goal` viejo se rotulaba "Valla" y se dibujaba como emoji 🥅** | En F1 el mismo tipo `goal` se rotula "Arco" y se dibuja como marco con red, movible y girable. El fondo de cancha nunca dibujó un arco y no se condiciona nada, así que el **único** cambio visible en alineaciones viejas es ese: el objeto pasa de emoji a marco, en la misma posición, 1×, 0°. Riesgo real: que el dibujo nuevo salga desplazado (anclaje distinto al del emoji), escalado o girado por defecto. | Retro-A: el arco aparece exactamente donde estaba el emoji, a 1×, 0°; el resto de la cancha idéntico a la captura base. | ARC-09, RET-01, RET-02 |
| R5 | **× roja y handle verde de giro se superponen a tamaño 0.5** | Tocar un objeto solo lo selecciona (nunca borra), pero la × roja sí borra de un toque. Si los handles no escalan con el objeto (o escalan y quedan minúsculos), al intentar agarrar el handle verde con el dedo se acciona la × por error. | Borrados accidentales al intentar girar objetos pequeños; separación entre × y handle en móvil. | MAT-15, GES-07 |
| R6 | **Orden de las transformaciones SVG** | `translate → rotate → scale` mal encadenado hace que el objeto orbite alrededor de otro punto al girar, o se desplace al escalar. Se nota más a tamaño 3. | El centro no se mueve al girar ni al escalar. | MAT-07, MAT-10, MAT-12, ARC-03 |
| R7 | **Ocultar el balón real durante la animación** | Se reutiliza la distancia de match de 6 % (`PLAY_MATCH_DISTANCE`). Con dos balones cerca se esconden ambos o el equivocado; si el timer de la secuencia no se cancela al cerrar el diálogo, queda un balón oculto o fantasma al reabrir. | Uno solo se esconde; reaparece siempre; cerrar a mitad no deja estado sucio. | BAL-06, BAL-07, BAL-16, BAL-17 |
| R8 | **La foto le gana a la silueta** | `PitchPin` ya prioriza `avatar_url` sobre el disco. En modo siluetas la silueta debe ganar siempre: mostrar la foto de un menor es el bloqueo real de Carmel. | Atleta con foto en modo siluetas. | SIL-04 |
| R9 | **`localStorage` es del dispositivo, no del usuario** | Gotcha documentado: sobrevive al cierre de sesión; el `signOut` limpia una lista enumerada de claves que se desactualiza. La clave nueva de siluetas puede quedar fuera. | Comportamiento al cambiar de cuenta en el mismo celular; que la clave use el prefijo común o entre en la lista. | SIL-05, SIL-06 |
| R10 | **Campos opcionales ausentes en datos viejos** | `size`/`rot`/`kind` `undefined` en una figura vieja → `undefined * n = NaN` en el `transform` → figura invisible o consola roja, sin excepción visible. | Retro-P y Retro-A sin errores; nada invisible. | PER-06, RET-01, RET-02, COL-08 |
| R11 | **Validación estricta del BFF** | `validateArrows()` rechaza coordenadas fuera de 0–100, `size` fuera de 0.25–4 y `rot` no finito. Un objeto arrastrado al borde con `x = -0.3`, o un `rot` `NaN` tras girar, hace fallar **todo** el guardado con 400 ("x1 inválido…"). | Guardar tras llevar objetos al borde y girar varias vueltas; mensaje del toast. | MAT-16, PER-13, RET-03 |
| R12 | **Gestos distintos entre jugadores y objetos** | Los jugadores usan dnd-kit (`PointerSensor`, `distance: 6`); los objetos SVG usan handlers propios. Un slider o handle nuevo sin `touch-none` hace scroll al arrastrar; un umbral distinto hace que tap y drag se sientan diferentes según qué se toque. | Scroll de página al dibujar/girar/deslizar el slider; tap que mueve. | GES-01, GES-02, GES-03 |
| R13 | **Un solo componente de 1.850 líneas re-renderiza todo el SVG** | Cada `pointermove` sobre un objeto pasa por el estado del componente completo. Con 30 objetos + 10 líneas en Android medio puede haber lag visible. | Arrastre bajo carga estándar; slider bajo carga. | RND-01, RND-04 |
| R14 | **Toolbar en 360 px de ancho** | 11 objetos + 9 colores + slider de tamaño + toggles de siluetas y zoom. El código ya deja `pr-8` para que la X nativa del diálogo no tape el último botón; con más controles puede volver a taparse o tapar la cancha. | Que todo el toolbar se alcance sin tapar la cancha ni la X. | MAT-01, COL-01, GES-10, ARQ-13 |
| R15 | **Regla y zoom** | La regla convierte unidades 0–100 a metros con "Largo cancha". Si el zoom cambia la escala de píxeles sin tocar las coordenadas, la regla sigue bien; si alguien la calculó en píxeles, marca el doble. | Misma lectura en ambos modos. | ARQ-09, REG-05 |
| R16 | **Tablero por bloque** | El `id` del bloque se genera al tocar el botón (comentario en `MesocycleSection`: un efecto borraba ese `id` y el guard cerraba el tablero). Abrir desde el formulario de sesión recién creado puede cerrar solo o guardar en el bloque equivocado. | Abrir desde el formulario y desde la lista; que el bloque 2 no muestre lo del 1. | HUM-01, PER-14 |

---

## 4. Plantilla de reporte de resultados

Copiar esta tabla al reporte (una fila por caso **y** dispositivo). Dispositivo: modelo + SO + navegador (ej. "Moto G54 / Android 14 / Chrome 129", "iPhone 13 / iOS 17.6 / Safari", "Desktop Win 11 / Chrome 129"). Evidencia: nombre del archivo (captura o video) o enlace.

| ID | Dispositivo | Resultado (PASS / FAIL / BLOQUEADO / N/A) | Evidencia | Notas |
|---|---|---|---|---|
| HUM-01 | | | | |
| HUM-02 | | | | |
| HUM-03 | | | | |
| HUM-04 | | | | |
| HUM-05 | | | | |
| MAT-01 | | | | |
| … | | | | |
| GES-13 | | | | |

### Resumen de la ronda

| Campo | Valor |
|---|---|
| Fecha y ambiente (URL) | |
| Build / commit probado | |
| Cuenta usada (rol, escuela, equipo) | |
| Dispositivos | |
| Total casos ejecutados / PASS / FAIL / BLOQUEADO / N/A | |
| FAIL bloqueantes (impiden usar la pizarra en cancha) | |
| Observaciones de UX (no son bugs, pero se anotan) | |
| Riesgos de la tabla §3 confirmados / descartados | |

### Formato de cada FAIL

```
ID: MAT-15
Dispositivo: Moto G54 / Android 14 / Chrome 129
Pasos exactos: cono a tamaño 0.5, intentar girar con el handle
Esperado: gira sin borrarse
Obtenido: 3 de 5 intentos borraron el cono (la × quedó debajo del handle)
Evidencia: mat-15-motog54.mp4
Reproducible: siempre / a veces (3/5) / una vez
Consola (desktop): sin errores | <texto del error>
```
