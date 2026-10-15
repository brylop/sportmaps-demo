# Pizarra M6 — todo lo de TacticalPad y más

> 2026-10-14. Continúa `pizarra-multideporte-3d-ia.md` (M0-M4 en `pizarra-tp/integracion`).
> Pedido del usuario, con capturas de TacticalPad (galería de formaciones, configuración del equipo, videos,
> notas): «añadamos todo lo que más podamos, que tengamos de más y no de menos; la IA es un plus».
> Estado: **EN CONSTRUCCIÓN** (aprobado por el usuario en ese mensaje).

## 1. Lo que falta hoy (auditado en el código)

- **Formaciones:** fútbol 11 solo tiene 4-3-3, 4-4-2, 3-5-2 (+ 2-3-1 de F7). TacticalPad trae ~16 con miniatura.
- **Equipos:** el rival son figuras sueltas `opponent`; no hay nombre, escudo, colores, estilo de ficha, qué mostrar
  (número / iniciales / nombre), portero con apariencia distinta, tamaño global, ni equipos rivales guardados.
- **Videos y notas:** no existen por jugada ni por cuadro.
- **Herramientas:** sin estilos de línea (pase, conducción, carrera, disparo), sin zonas rectangulares/elípticas/
  polígonos, sin vista de media cancha / 3/4 / orientación, sin estilos de césped.

## 2. Bloques (un agente por bloque, una rama por bloque, se integran en `pizarra-tp/integracion`)

| Bloque | Qué | Migración |
|---|---|---|
| **M6a Formaciones** | Catálogo completo por deporte con galería de miniaturas; se aplica al equipo propio y al rival (espejado); deporte del equipo manda | — |
| **M6b Equipos** | Configuración de los dos equipos (nombre, escudo, 3 colores, estilo de ficha: disco con número / camiseta lisa / rayas / silueta; mostrar número, iniciales o nombre; portero distinto; tamaño global de jugadores y material); rivales guardados por escuela («Equipos almacenados»); plantilla del rival (solo número y alias, nunca datos de menores de otra escuela) | tabla `tactical_rival_teams` |
| **M6c Videos y notas** | Notas por jugada y por cuadro (texto con formato básico + etiquetas); videos de YouTube/Vimeo por enlace (sin subir archivos: cero almacenamiento), con minuto de inicio y vista previa `youtube-nocookie`; videos guardados por escuela; notas y videos viajan en la ficha PDF, en los paquetes exportados y como intención en el análisis de IA | columnas/tabla de medios |
| **M6d Herramientas** | Estilos de línea (pase discontinuo, conducción en zigzag, carrera continua, disparo doble), zonas (rectángulo, elipse, polígono) con relleno translúcido, resaltar jugador (foco), vistas de cancha (completa, media, 3/4, área) y orientación, estilos de césped/piso; más todo lo de la lista pública de funciones de TacticalPad que falte (auditoría web) | — |

## 3. Reglas

- `TacticalBoard.tsx` lo tocan los cuatro: cada bloque mete su lógica en componentes/hooks nuevos y deja en la
  pizarra solo el punto de enganche. Formato de jugada retrocompatible (campos opcionales en el jsonb).
- Fútbol 11 sin regresión; deportes por catálogo (M1). Siluetas genéricas, nunca fotos de menores.
- Disk IO (CLAUDE.md): nada de DDL contra la base desde los agentes, lecturas puntuales, `gen types` al final del
  lote, pruebas de permisos contra la base una sola vez al aplicar.
- Pruebas: unitarias, e2e en `playwright.pizarra.config.ts`, capturas revisadas a ojo, batería completa.

## 4. M6a — Formaciones (hecho, rama `pizarra-tp/m6a`)

- **Catálogo** (sin duplicar la fuente): fútbol 11 en `lib/school/tacticalFormations.ts`; el resto en
  `lib/school/tacticalSports.ts`. Campos opcionales nuevos: `group` (familia), `description` (una línea) y
  `flyingKeeper` (portero-jugador). Las formaciones de antes conservan clave, etiqueta y coordenadas
  (`src/test/fixtures/formacionesHistoricas.json`, sacado del código anterior).
- **Fútbol 11 (37):** Clásicas 4-3-3, 4-4-2 (plano), 3-5-2, 4-5-1, 4-4-1-1, 5-3-2 · Modernas 4-2-3-1, 4-2-3-1
  estrecho, 4-1-2-1-2 (rombo), 4-3-1-2, 4-3-2-1, 4-1-4-1, 4-1-2-3, 4-2-2-2, 4-1-3-2, 4-6-0, 3-4-3, 3-4-2-1, 3-4-1-2,
  3-2-4-1, 3-6-1 · Defensivas 5-4-1, 5-2-2-1, 5-2-1-2, 5-2-3 · Ofensivas 3-2-5 (4-3-3 en ataque), 3-4-3 rombo, 3-3-4,
  3-3-1-3, 3-3-3-1, 4-2-1-3 · Históricas 2-3-5 (Pirámide), 2-3-2-3 (Método), 3-2-2-3 (WM), 3-2-3-2 (WW), 4-2-4,
  Catenaccio (1-4-3-2) · + 2-3-1 de F7 para planteles chicos.
- **Fútbol 7 (8):** 2-3-1, 3-2-1, 3-1-2, 2-1-2-1, 2-2-2, 3-3, 2-1-3, 4-1-1.
- **Fútbol 5 (8) y futsal (8):** 1-2-1 (rombo), 2-2 (cuadrado), 3-1, 4-0, 2-1-1, 1-1-2, 1-3, 5x4 (arquero/portero-jugador).
- **Voleibol (41):** rotaciones R1-R6 de 5-1, 4-2 y 6-2, cada una en recepción y en defensa de base, generadas por
  código (orden de planilla + zona por rotación; líbero por el central de atrás) · defensas 2-1-3, 2-0-4
  (perímetro), rotacional · zonas 1-6 y recepción en W.
- **Baloncesto (19):** individual · zonas 2-3, 3-2, 1-3-1, 1-2-2, 2-1-2, caja y uno, triángulo y dos · presiones
  1-2-2 (3/4), 2-2-1, 1-3-1, individual · ataques 5 abierto, 4 fuera 1 dentro, 3 fuera 2 dentro, cuernos, 1-4 alto,
  1-3-1, caja.
- **Balonmano (11):** defensas 6-0, 5-1, 4-2, 3-2-1, 3-3, mixtas 5+1 y 4+2, individual · ataques 3-3, 2-4, 7 contra 6.
- **Genérico (3):** dos líneas de 3, tres líneas de 2, rombo 1-2-2-1.
- **Galería** `components/school/FormationGallery.tsx` (reemplaza «Formación ▾»): miniatura de la cancha con los
  puntos, familias, búsqueda («433» encuentra 4-3-3), filtro por jugadores, 2 columnas en celular (≥ 44 px).
  Pestaña «Rival»: figuras `opponent` en espejo (giro de 180°), reemplaza a los rivales que había; «Quitar rival».
  Lógica pura en `lib/school/tacticalFormationGallery.ts`.
- **Fuentes:** Wikipedia «Formation (association football)»; galería de TacticalPad; UEFA «Talking futsal tactics» y
  futsal.tech (sistemas de futsal); JVA Volleyball «Serve receive rotations»; coachesclipboard.net y hooptactics.net
  (zonas y presiones); INEF Madrid y e-balonmano.com (sistemas defensivos y ofensivos de balonmano).
