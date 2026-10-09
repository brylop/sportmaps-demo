# Pizarra táctica a nivel TacticalPad

> 2026-10-08. Referencia: https://www.tacticalpad.com/es/ (herramienta aislada, 59 €/año por entrenador).
> Continúa `pizarra-tactica-material-y-3d.md` (F1 en prod) y `rediseno-seguimiento-deportivo.md` (F2: pizarra simple).
> Estado: **EN CONSTRUCCIÓN.** El usuario pidió construirlo todo con agentes, con pruebas y rediseño.

## 1. Dónde estamos

Ya tenemos (develop/staging/main): jugadores que se arrastran, flechas, curvas y zonas, material (conos, aros,
escalera, arco, maniquí…), tamaño y giro, 9 colores, siluetas, balón con recorrido animado, zoom de arqueros,
lápiz, texto y borrador. La pizarra está enganchada a sesiones, mesociclos y alineaciones.
En curso (2026-10-08): formaciones predefinidas, cancha que arranca llena, toolbar con palabras, modo `view`,
render estático `TacticalStaticSvg` + PNG (`lib/export/tacticalImage.tsx`) y la jugada dentro del PDF del mesociclo.

## 2. Nuestra ventaja (no copiar todo)

TacticalPad es una isla. En SportMaps la jugada ya vive con la **plantilla real, la sesión, el mesociclo, la
asistencia, el informe del atleta y la familia**. Meta: *diseño el ejercicio → lo meto en la sesión → el atleta
lo ve en su celular → queda en el informe*. Eso TacticalPad no lo da.

## 3. Fases

| Fase | Qué | Migración | Depende de |
|---|---|---|---|
| **T0** | Métrica de uso: cada apertura / guardado / reproducción / exportación → `tactical_board_events` | `20261008155459` | — |
| **T1** | **Animación por cuadros**: la jugada es `frames[]`. Cada cuadro guarda las posiciones de los jugadores, el balón y las figuras. Movimiento suave interpolado entre cuadros, línea de tiempo, Reproducir/Pausa/velocidad. Además deshacer/rehacer y copiar/pegar grupo | `20261008155454` | F2 (toolbar nueva) |
| **T2** | **Exportar**: PNG, ficha del ejercicio en PDF y video WebM/MP4 o GIF de la animación (MediaRecorder sobre canvas), con botón «Compartir por WhatsApp» (Web Share API en celular, descarga en escritorio) | — | T1 para el video |
| **T3** | **Biblioteca de ejercicios**: nombre, objetivo, duración, edad o categoría, material, jugadores, etiquetas y la jugada (cuadros). Se guarda desde la pizarra y se inserta en un bloque de sesión. Viene con plantillas listas (rondos, posesiones, salida de balón, 4-4-2…) | `20261008155457` | T1 (formato) |
| **T4** | **Más deportes**: fútbol 11/7/5, futsal, voleibol, baloncesto, balonmano y genérico, cada uno con su fondo SVG y su set de objetos. El deporte sale del equipo | `20261008155459` (CHECK del deporte) | — |
| T5 | Ver la jugada desde el celular del atleta o la familia (RPC con token, nunca policy `USING(true)`) | futura | T1, decisión de consentimiento |
| T6 | Análisis de video (dibujar sobre el video de un partido) | futura | Supabase Free al 49 %: requiere plan de almacenamiento |
| T7 | Vista 3D | futura | métrica T0: ≥20 aperturas/semana, ≥3 escuelas, ≥5 coaches |

**T5-T7 no se construyen ahora.** T5 choca con el consentimiento de imagen de Carmel. T6 necesita almacenamiento
que no tenemos. T7 lo frena la regla de métrica del spec anterior. Quedan diseñadas aquí y se deciden con datos de T0.

## 4. Decisiones técnicas

- **Formato de cuadros (T1):** columna nueva `frames jsonb` en `match_lineups` y en `team_tactical_presets`.
  Forma: `[{ "id", "duration_ms", "players": [{ "key", "x", "y" }], "ball": { "x", "y" } | null, "arrows": [...] }]`.
  `key` = `subject_type:subject_id`, o `slot_label` cuando la jugada no tiene jugador asignado.
  - **Retrocompatible:** sin `frames`, la jugada es un solo cuadro y se arma con `match_lineup_players` + `arrows` como hoy.
  - **Con `frames`:** el cuadro 1 sigue escribiéndose en las columnas actuales, así el PDF, la miniatura y las
    versiones viejas lo ven.
  - Topes: 30 cuadros, 300 figuras por cuadro. Valida el BFF (`footballShapes.ts`) y un CHECK de tamaño.
- **Interpolación:** lineal sobre x/y con easing `easeInOutCubic`, 60 fps con `requestAnimationFrame`. Una figura
  que aparece o desaparece entre cuadros entra o sale con fade.
- **Export de video:** se dibuja cada cuadro en un `<canvas>` con `TacticalStaticSvg` → `Image` y se graba con
  `canvas.captureStream()` + `MediaRecorder`. Sale WebM en Chrome/Android y MP4 en Safari si lo soporta. GIF como
  alternativa con un encoder JS liviano, solo si no hay MediaRecorder. Todo en el cliente: **cero almacenamiento**.
- **Biblioteca (T3):** tabla `training_exercises` (school_id, created_by, nombre, objetivo, minutos, edad o
  categoría, material, etiquetas, `sport`, `board jsonb` con `frames`, `is_template`, `is_active`).
  - Las plantillas del sistema van con `school_id NULL` + `is_template`, de solo lectura.
  - RLS: leen las del sistema y las de su escuela quienes están en `user_staff_school_ids()`; escribe staff; borra el
    autor o admin.
  - La copia a un bloque de sesión va por RPC `SECURITY DEFINER` transaccional (`insert_exercise_into_session_block`):
    crea el `match_lineups` del bloque con `frames`.
- **Deportes (T4):** `lib/school/tacticalSports.ts` con su catálogo (fondo, viewBox, objetos, número de jugadores,
  formaciones). `FootballPitchBackground` pasa a ser uno de varios `*CourtBackground`. El deporte se toma del equipo
  (`teams.sport` / categoría de la escuela).
- **Métrica (T0):** `tactical_board_events(school_id, user_id, team_id, event text CHECK, source_type, created_at)`.
  INSERT solo vía RPC `log_tactical_board_event` (SECURITY DEFINER, search_path fijo, GRANT a authenticated).
  SELECT para admin de la escuela y super admin. Vista `v_tactical_board_usage_weekly` para la regla de T7.

## 5. Diseño (UX)

- Línea de tiempo abajo de la cancha: miniaturas de los cuadros, «+ Cuadro» (copia el anterior), arrastrar para
  reordenar, duración por cuadro, ▶ Reproducir / ❚❚ Pausa / velocidad 0,5× 1× 2×.
- Mover un jugador en el cuadro 2 deja una flecha fantasma desde su posición en el cuadro 1, para ver el movimiento.
- «Exportar ▾»: Imagen · Ficha PDF · Video · Compartir.
- «Biblioteca»: panel con búsqueda, filtros (deporte, categoría, objetivo) y tarjetas con miniatura; «Usar en esta sesión».
- Todo con palabras, una acción principal por pantalla y botones de 44 px como mínimo (celular).

## 6. Pruebas

- Unitarias: interpolación, validación de `frames` (BFF), catálogo de deportes y render estático por deporte.
- RLS: simular coach, owner, padre y anon sobre `training_exercises` y `tactical_board_events`. `seguridad:invariantes`.
- e2e Playwright (`frontend/e2e/`): crear 3 cuadros → reproducir → exportar PNG; guardar en biblioteca → insertar en sesión.
- Manual: Android gama media + iPhone (sigue pendiente desde F1).
