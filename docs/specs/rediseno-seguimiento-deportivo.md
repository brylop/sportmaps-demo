# Rediseño: seguimiento deportivo (dueño) + herramientas del entrenador

> Origen: reunión de seguimiento con Club Carmel, 2026-10-08 (Mauricio Rodríguez, dueño).
> Estado: **PLAN — decisiones marcadas con ❓ pendientes del usuario.**

## 1. El problema en una frase

El dueño quiere saber **qué están haciendo sus entrenadores** y hoy no puede: todo lo que ve es la
mesa de trabajo del entrenador (formularios editables, 31 campos, cancha vacía), sin una sola vista
pensada para mirar.

## 2. Lo que se encontró (verificado en código y en la base, 2026-10-08)

| # | Queja de Carmel | Causa real |
|---|---|---|
| 1 | "Asistencia de todos los meses" | `/attendance-history` solo acepta un mes (`month=YYYY-MM`). No hay vista por mes ni tendencia. |
| 2 | "Subida de documentos en mesociclos no se ve" | **No existe**: ni columna, ni bucket, ni UI para adjuntar archivos a un mesociclo o sesión. |
| 3 | PDF del mesociclo "no se ve nada" | `MesocycleExportButton` imprime objetivo + 1 línea por sesión. Omite bloques, ejercicios y la jugada de la pizarra. No existe un render estático de la pizarra. |
| 4 | Roster con nombres "A…", "Al…" | Tres botones en una columna angosta truncan el nombre. **Arreglado** (nombre en su propia línea). |
| 5 | "Registrar Rendimiento" complejo | El modal muestra las **31** métricas de fútbol con steppers y 6 escalas distintas. Carmel usó 6 de 31, todas un solo coach un solo día. 25 nunca se tocaron. Lo que SÍ usan: el rating rápido post-entreno (134 registros) y la rúbrica del mesociclo. |
| 6 | Pizarra táctica "no se ve nada" | Abre con cancha vacía, paneles cerrados y la única instrucción en `sr-only`. Toolbar de íconos sin texto. "Plantilla" significa dos cosas distintas. "Sugerir XI" exige partidos jugados → deshabilitado en entrenamiento. |
| 7 | Mesociclo (pantalla) abrumador | Una sola página con semanas, 8 días vacíos por semana con "Crear sesión", 2 paneles de carga, 3 textareas de cierre semanal que guardan al salir del campo, cierre del mesociclo, rúbrica 6×5. Todo editable, también para el dueño. |
| 8 | "No se sabe qué hace cada entrenador" | No existe vista por entrenador. `training_sessions` y `training_mesocycles` **no tienen `created_by`**: las sesiones solo se atribuyen por equipo. |

Duplicados que confunden (salen del informe del modal):
- Asistencia: `asistencia_entrenamiento` (%) se digita a mano aunque hay 1.177 registros reales de asistencia.
- Métricas `mesociclo_*`: se cargan en el modal (sin checkpoint) y en la rúbrica (con checkpoint); la rúbrica no ve las del modal.
- Esfuerzo: 4 formas distintas de registrarlo.

## 3. Principio del rediseño

**Dos modos, no una pantalla para todos.**

- **Dueño = MIRAR.** Todo de solo lectura, resumido por entrenador, a 1 clic del detalle.
- **Entrenador = HACER.** Menos campos, una acción principal por pantalla, cancha que arranca llena.

**Informes con gráficas MUY claras** (pedido explícito del usuario, 2026-10-08):
- Una gráfica = una pregunta, escrita como título ("¿Cuántos vinieron cada mes?").
- Barras simples (recharts, ya instalado). Nada de tortas, radares, 3D ni ejes dobles.
- El número escrito encima de cada barra. No obligar a leer el eje.
- Semáforo fijo: verde ≥ 80 %, ámbar 60-79 %, rojo < 60 %, con la leyenda en palabras.
- Debajo de cada gráfica, una frase que la resume ("Septiembre fue el mejor mes: 62 %").
- Primero la gráfica y después la tabla, que queda para quien quiera el detalle.

## 4. Plan por fases

Cada fase es independiente, una rama, revisión entre fases. Las marcadas ⚡ no tocan base de datos.

### F1 ⚡ — Arreglos directos (ya en curso)
- [x] Roster: nombre completo en su línea; encabezado que no se desborda.
- [x] BFF `/attendance/history`: rango de meses (`fromMonth`/`toMonth` o `month=all`), agregado
      `months[]` y `by_month` por atleta; "Plan vs consumo" se omite en rango (tope mensual).
- [ ] Frontend histórico: selector **Mes / Rango / Todo**, pestaña nueva **"Por mes"** (tabla + barra
      de % por mes), "Por atleta" con una columna por mes en modo rango; se ocultan "Día por día",
      "Plan vs consumo" y Facturar en rango. CSV con el rango en el nombre.

### F2 ⚡ — Pizarra simple + render estático
- **Componente puro `TacticalStaticSvg`** (jugadores + figuras → SVG sin interacción). Reusa
  `FootballPitchBackground`, `tacticalGlyphs`, `tacticalGeometry`. Base de miniaturas, PDF y modo "ver".
- **Cancha que arranca llena:** si no hay jugada guardada, coloca el roster en una formación fija
  (4-3-3 / 4-4-2 / 3-5-2 / F7) sin depender de estadísticas.
- **Toolbar con palabras y una acción principal:** `Formación ▾` · `Jugadores` · `Dibujar` ·
  `Material` · **`Guardar jugada`**. Zonas, disco/silueta, fotos, zoom de arqueros, regla y
  plantillas guardadas → menú `⋯ Más`. "Plantilla" (formación guardada) → **"Mis jugadas"**.
- **Aviso sobre la cancha vacía** con dos botones grandes: "Usar 4-3-3" y "Dibujar ejercicio".
- **Modo `view`:** solo cancha + Reproducir + Cerrar. Sin el UPDATE que hoy hace
  `openBlockTacticalBoard` al abrir.

### F3 ⚡ — PDF del mesociclo completo
Por cada sesión: fecha, objetivo, **cada bloque** (nombre, duración, descripción, ejercicios,
material) y **la jugada dibujada** (SVG → PNG con `TacticalStaticSvg`), más la rúbrica y el cierre.
Depende de F2 (render estático).

### F4 — Vista del dueño: "Seguimiento deportivo" (página nueva)
Ruta nueva para `school`/`school_admin`, solo lectura:
- **Una tarjeta por entrenador:** semáforo, última actividad, sesiones planificadas vs listas tomadas
  esta semana, evaluaciones registradas, mesociclo vigente y su adherencia.
- **Clic → detalle del entrenador** con pestañas Sesiones · Mesociclo · Asistencia · Evaluaciones ·
  Documentos.
- **`SessionViewer`** (solo lectura): sesión con sus bloques y la miniatura de la jugada. Clic en la
  miniatura → pizarra en modo `view`.
- `WeekSessionsPanel`: el clic en una sesión abre el `SessionViewer` en vez de solo cambiar de equipo.
- `/training-plans` para el dueño: sin "Crear sesión", "Evaluar", "tu equipo".
- **Migración:** `created_by`/`updated_by` en `training_sessions` y `training_mesocycles` (con
  trigger que lo llena desde `auth.uid()`), para atribuir por persona y no solo por equipo.
- BFF: endpoint agregado `GET /school/coach-activity?week=` (una llamada, no N desde el cliente) y
  filtro `recorded_by` en performance entries.

### F5 — Evaluación simple
- **"Evaluación rápida":** 5 métricas en botones **1-5** (mismo patrón que el rating post-entreno,
  que es lo que sí usan). Lista elegida por la escuela en `school_metric_definitions` (ya existe,
  0 filas, nadie la lee), con un default por deporte.
- Fuera del modal: `asistencia_entrenamiento` (se calcula de la asistencia real), `focus_*`,
  métricas post-entreno (`category IS NULL`) y `mesociclo_*` (las tiene la rúbrica).
- "Evaluación completa" queda detrás de un enlace para quien la quiera.

### F6 — Mesociclo simple + documentos
- Pantalla del mesociclo en **pestañas**: Plan (semanas, colapsadas salvo la actual, sin días vacíos
  — un solo "+ Sesión" por semana) · Carga · Rúbrica · Cierre · **Documentos**.
- Cierre semanal y de mesociclo con botón "Guardar" explícito (hoy guardan al salir del campo).
- **Documentos adjuntos al mesociclo:** bucket privado `mesocycle-documents`, tabla
  `training_mesocycle_documents` (mesocycle_id, school_id, path, nombre, tamaño, mime, uploaded_by),
  RLS: escribe staff de la escuela, lee staff de la escuela. **Sin acceso de padres ni atletas.**
  PDF/imagen/Word, tope de tamaño.

## 5. Decisiones tomadas (usuario, 2026-10-08)

- **Evaluación:** **cada escuela elige sus métricas** (pantalla de configuración para el admin).
  Sin configuración, se aplica la lista corta por defecto del deporte (botones 1-5).
- **Documentos del mesociclo:** **solo el staff** de la escuela. Nada para padres ni atletas.
- **Ejecución:** todas las fases en paralelo con agentes. La pizarra va primero. Al final se corren las pruebas, se coordina con
  las otras sesiones y se empaqueta en un solo commit.
- Migraciones reservadas: `20261008154652` (created_by), `20261008154653` (métricas por escuela),
  `20261008154654` (documentos). **Se escriben, no se aplican** hasta el visto del usuario.

## 5b. Decisiones originales ❓ (referencia)

1. **Orden:** propuesta F1 → F2 → F3 (lo que Carmel ve ya) → F4 → F5 → F6.
2. **Dueño en la pizarra:** ¿entra en `view` por defecto con botón "Editar", o solo puede ver?
3. **Evaluación rápida:** ¿cuáles 5 métricas por defecto para fútbol? Propuesta: actitud y
   esfuerzo, control de balón, precisión de pase, posicionamiento, definición.
4. **¿Se apaga para todas las escuelas** el modal de 31 campos, o solo donde haya lista propia?
   Propuesta: el modal rápido para todos; el completo detrás de un enlace.
5. **Documentos:** ¿los ve solo el staff, o también se pueden compartir con familias? Propuesta:
   solo staff (consentimiento de Carmel).
6. **Supabase Free tier en 49 % de archivos** (`project_supabase_free_tier_approaching_limit`):
   tope de 10 MB por documento y compresión de imágenes al subir.

## 6. QA

- tsc BFF + frontend, build, tests unitarios del agregado por mes y de `TacticalStaticSvg`.
- Simular sesión de Mauricio (owner Carmel) y de un coach para cada vista nueva.
- Fase con migración: `npm run seguridad:invariantes` + listar todas las policies de las tablas nuevas.
