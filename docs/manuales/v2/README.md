# Manuales V2

Manuales de la **versión 2** de la app (rediseño por rol, mobile-first). Mismo patrón que el resto
de los manuales (capturas reales, dos versiones, contenido para Sportbot; ver
`docs/manuales/README.md` y la memoria `feedback_pdf_manual_template`), pero en su propia carpeta
para no mezclarlos con los de la V1.

## Qué hay

| Archivo | Para quién |
|---|---|
| `academias/manual-entrenador-v2.pdf` (+ `.html`) | Para enviar a las escuelas. 25 páginas, 11 capítulos. Sin notas internas. |
| `interno/manual-entrenador-v2.pdf` (+ `.html`) | Equipo SportMaps. 27 páginas: lo mismo + callouts «🔒 INTERNO —», tabla de bugs y datos de prueba. Marcado «Uso interno» en portada y en el pie de todas las hojas. |
| `sportbot/manual-entrenador-v2.help-articles.ts` | Artículos listos para pegar en `bff/src/data/help-articles.ts`: 4 nuevos (`entrenador-app-v2`, `partidos-entrenador`, `sesiones-entrenador-v2`, `planillas-y-matriculas-coach`) y el `body` de reemplazo de `tomar-asistencia-coach` y `evaluaciones-jugadores`. No se editó `help-articles.ts`. |
| `pruebas-entrenador-v2.md` | Reporte de las pruebas en `dev.sportmaps.co` (2026-10-26): función → resultado → evidencia, bugs con archivo:línea, datos creados en el demo y la checklist para probar en el celular con una cuenta real. |

| `academias/manual-acudiente-v2.pdf` (+ `.html`) | Para enviar a las escuelas / familias. 25 páginas. Manual ÚNICO del acudiente V2: Inicio · Calendario · Hijos · Pagos · Más, partidos y convocatorias, pagos y comprobante, unirse con el código de escuela, preguntas frecuentes. |
| `interno/manual-acudiente-v2.pdf` (+ `.html`) | Equipo SportMaps. 32 páginas: lo mismo + callouts «🔒 INTERNO —» y capítulo 10 de hallazgos con archivo:línea. |
| `sportbot/manual-acudiente-v2.help-articles.ts` | 5 artículos para `bff/src/data/help-articles.ts`: reemplaza `inscripcion-padre-paso-a-paso`; nuevos `acudiente-app-guia`, `acudiente-pagos-comprobante`, `acudiente-ficha-del-hijo`, `unirse-escuela-con-codigo`. Actualizar también `bff/src/data/app-map.ts` (rol `parent`, hoy describe el menú V1). |
| `pruebas-acudiente-v2.md` | 41 funciones probadas (38 PASA, 3 FALLA), 13 hallazgos, datos creados en el demo y checklist para probar con una cuenta real. |

Fuente reproducible del manual del acudiente: `docs/manuales/_src/manual-acudiente-v2/` (`capture.mjs` = pruebas + capturas,
`build.mjs` con paginación automática; `codigo-escuela/` y `partidos-demo/` = flujos de una sola vez).

Fuente reproducible del manual del entrenador: `docs/manuales/_src/manual-entrenador-v2/` (`capture.mjs` por secciones,
`build.mjs`, `manual.css`). El entrenador demo de fútbol se crea con
`node scripts/demo-club-campestre/add-coach.mjs`.

## Manual del entrenador V2 — qué reemplaza

Reemplaza, para el entrenador con la V2 prendida, a estos manuales (**no se borraron**: siguen en
su lugar por si alguna escuela sigue con la V1 o se necesita su contenido):

| Manual anterior | Qué quedó obsoleto | Qué se conserva |
|---|---|---|
| `docs/manuales/{academias,interno}/tomar-asistencia.pdf` | Pantalla de Asistencias con Presente/Ausente y «Finalizar sesión»; corrección de días anteriores (la V2 deja corregir hoy y ayer). | Escaneo de carnet y torniquete (resumidos en el capítulo 7). |
| `docs/manuales/{academias,interno}/evaluacion-post-entrenamiento.pdf` | «Calificar el esfuerzo» con porcentajes al cerrar la sesión. La V2 usa «Evaluar al equipo» (Bien · Normal · Le costó). | Lo que recibe la familia y el informe mensual (capítulos 4 y 7). |
| `docs/manuales/{academias,interno}/guia-entrenadores-asignar-categoria.pdf` | «Mis Equipos → Gestionar Deportistas» como pantalla principal del entrenador. | Inscribir/mover deportistas sigue en «Mis deportistas» (se llega desde la ficha → «Ver todo en Mis deportistas»). |
| `docs/manuales/{academias,interno}/entrenador-carmel.pdf` | Menú lateral y panel del entrenador V1; asistencia y sesiones como pantallas sueltas. | Lo específico de los permisos de Carmel (crear equipo, segundo equipo) sigue valiendo en «Mis deportistas». |
| `docs/manuales/{academias,interno}/mesociclo-mes-siguiente.pdf` | Nada de fondo: la planificación completa es la misma. | Sigue siendo la guía detallada del mesociclo; el capítulo 6 la resume. |
| `docs/manuales/{academias,interno}/calendario-equipos-familias.pdf` (parte del coach) | Crear un evento tipo Partido ahora crea el partido y muestra «Abrir partido». | La parte de las familias y el «Para quién». |

No reemplaza: `pizarra-tactica.pdf` (detalle de la pizarra), `informe-mensual-besser.pdf`.

## Antes de enviar a una escuela

- El capítulo 9 (planillas en papel) describe una función que **hoy falla** (bug B2) y que en la V2 no
  tiene botón de entrada sin planillas pendientes (B4). No enviarlo hasta corregirlos, o quitar ese
  capítulo de la versión academias.
- Los pasos «Guardar resultado» y «Guardar evaluación» del partido no se pueden tocar en el celular
  (B1). Corregir antes de mandar el capítulo 5 a escuelas que trabajan desde el teléfono.

## Manual del acudiente V2 — qué reemplaza

Reemplaza a `../academias/pagos-de-padres.pdf` y al capítulo «Qué ve la familia» de
`calendario-equipos-familias.pdf`. Las pantallas de la app en `dreamers-familias.pdf` y
`carnets-digitales.pdf` quedan desactualizadas (detalle en `pruebas-acudiente-v2.md` §6). No se borró ninguno.

Antes de enviarlo: la familia no puede responder «Va / No va» a la convocatoria (B1 del acudiente) y
los documentos que sube no los ve la escuela (B2). Corregir o quitar esos pasos de la versión academias.
