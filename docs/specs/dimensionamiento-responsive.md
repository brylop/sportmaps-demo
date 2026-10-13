# Plan de dimensionamiento: SportMaps se ve bien en cualquier pantalla

**Estado:** en ejecución desde el 2026-10-10. **Dueño:** Brayan Steven Lopez.
**Alcance:** toda la app actual (no el rediseño), todos los roles, todos los tamaños de pantalla, zoom del navegador y escala de Windows. El rediseño V1/V2 hereda estas mismas medidas (ver «Integración con el rediseño»).

## 1. Problema

- La app se diseñó en escritorio. En celulares se ve distinta: páginas que se desbordan a los lados, tablas que no caben, ventanas que se salen, botones chicos, campos que hacen zoom en el iPhone, la barra inferior tapando botones.
- Un cliente (Julián) reporta que se ve **pixelado**: dimensiones de las pestañas, barras de desplazamiento visibles, textos e imágenes poco nítidos.
- Medido el 2026-10-10: **312 clases con píxeles fijos** (`w-[523px]`, `h-[480px]`…) y **32 estilos con anchos/altos fijos** ≥ 100 px en `frontend/src`. Cada uno es un punto donde el celular se rompe.
- Con zoom del navegador (110–200 %) o escala de Windows (125/150 %) hay cosas que **desaparecen** o quedan fuera de alcance.

## 2. Decisión

Los tamaños salen de **valores definidos una sola vez** (tokens), nunca escritos a mano en cada pantalla. Una regla de revisión avisa cuando alguien agrega un píxel fijo nuevo.

## 3. Tokens de tamaño (fuente única)

Definidos en `frontend/tailwind.config.ts` y `frontend/src/index.css`; documentados en `docs/design-tokens.md`.

| Grupo | Token | Valor | Cuándo |
|---|---|---|---|
| Página | `max-w-page-narrow` · `max-w-page` · `max-w-page-wide` | 640 · 960 · 1200 px | formularios · listas · tablas |
| Ventanas | `max-w-modal-sm` · `max-w-modal` · `max-w-modal-lg` | 420 · 640 · 960 px | confirmar · formulario · detalle |
| Hoja móvil | `max-h-sheet` | 85dvh | toda ventana en celular abre desde abajo |
| Toque | `min-h-touch` · `h-touch` · `min-w-touch` | 44 px | botones, filas tocables |
| Barras | `h-header` · `h-nav` · `pb-nav-safe` | 56 · 64 px (0 en escritorio) · 64 + área segura | encabezado · barra inferior · último contenido |
| Texto | `text-input` · `text-xs` | 16 · 12 px | campos (sin zoom iOS) · mínimo legible |
| Alturas | `h-chart-sm` · `h-chart` · `h-chart-lg` · `h-media` · `max-h-list` · `h-screen-d` | 12 · 16 · 20 rem · 14 rem · 60dvh · 100dvh | gráficas · imágenes · listas con scroll · pantalla completa |
| Espacio | escala Tailwind `2·4·6·10` · `px-gutter` · `pt-safe-t` · `pb-safe-b` | 8·16·24·40 · 16 px · áreas seguras | márgenes, notch |
| Menú | `w-sidebar` · `w-sidebar-collapsed` | 248 px · 4 rem | menú lateral |
| Pestañas | `h-tabs` + `scrollbar-none` | 44 px | pestañas deslizables sin barra en celular |
| Quiebres | `sm · md · lg · xl` | 640 · 768 · 1024 · 1280 | de una columna a varias |

Reglas base globales: barras de desplazamiento delgadas e iguales; campos ≥ 16 px en < md; `-webkit-text-size-adjust: 100%`; suavizado de fuente; Poppins con `font-display: swap`.

## 4. Reglas de celular (criterios de aceptación)

1. Ninguna página se desplaza a los lados a **360 px**.
2. Tablas anchas → tarjetas en < md, o desplazamiento dentro de su caja.
3. Ventanas → hoja desde abajo en celular, máximo 85dvh, con el botón principal siempre visible.
4. Botones y filas tocables ≥ **44 px**; texto ≥ **12 px**; campos **16 px**.
5. Nada queda tapado por la barra inferior ni el notch (`pb-nav-safe`, áreas seguras).
6. A zoom **80–200 %** y escala Windows **125/150 %**, todo botón, pestaña y enlace sigue visible o alcanzable.
7. Imágenes con resolución ≥ tamaño mostrado × densidad de pantalla (nada pixelado); Poppins cargada.
8. Sin doble barra de desplazamiento (página + caja interna) ni barras visibles en pestañas/filtros.
9. En escritorio se ve igual que antes.

## 5. Fases

| Fase | Qué | Estado (10-oct) |
|---|---|---|
| D0 · Base | Tokens, reglas base, regla ESLint (aviso), `docs/design-tokens.md`, scrollbars y pestañas | en curso |
| D1 · Migración | Reemplazar los píxeles fijos por tokens, por zonas: componentes base (ui, common, universal, school, navegación) · páginas · resto de componentes | componentes base **listo** (46 reemplazados, 5 conservados con razón); páginas y resto en curso |
| D2 · Rutinas | Pantallas de rutinas/ejercicios responsivas con los componentes actuales + PDF antes/después | en curso |
| D3 · Auditoría automática | `scripts/qa-responsive/`: todos los roles × pantallas × 6 tamaños (360, 390, 430, 768, 1024, 1440) × zoom (80–200 %) × escala (1, 1,25, 1,5, 2): desborde, toques, texto, zoom iOS, barra inferior, pixelado, texto borroso, scrollbars, pestañas, errores. Línea base contra dev + PDF `docs/qa-responsive-baseline.pdf` | en curso |
| D4 · Arreglos por rol | Con el informe de D3 sobre el código migrado: agentes por rol (dueño/admin · entrenador · acudiente/deportista · otros) hasta que pasen los criterios de §4 | después de D1–D3 |
| D5 · Cierre | Reejecutar D3, PDF antes/después, subir con CI verde; la regla ESLint pasa de aviso a error cuando el conteo de píxeles fijos llegue a 0 (salvo los justificados) | al final |

Píxeles que se conservan a propósito (con comentario): líneas de 1–2 px, tamaño de impresión del carnet (CR80), lienzos y coordenadas SVG, ancho de la cancha en alineaciones.

## 6. Mapa completo de la app (insumo del rediseño)

En paralelo, tres agentes inventarían desde el código **cada módulo → pantalla → pestaña → acción** de todos los roles (escuela; entrenador/acudiente/deportista; otros roles, públicas y super admin), con ruta, archivo, permisos, datos que usa, estado (funciona/parcial/rota/oculta/duplicada) y uso real de 90 días. Salida: `docs/mapa-app/*.md` y `*.json`. Ese mapa se cruza con el lienzo del rediseño para ubicar cada función en V1/V2.

## 7. Integración con el rediseño

El lienzo «SportMaps — Rediseño global» (https://claude.ai/artifact/CGQozXBXP91kJn7YNF5Cs4) ya usa estas medidas: tabla «Tokens de tamaño» y «Reglas de celular» en *V1 · Sistema visual*, y «Mismas medidas que la V1» en *V2 · Qué cambia y por qué*. Toda pantalla nueva del rediseño se construye con estos tokens; ninguna introduce píxeles fijos.

## 8. Riesgos

- Cambios visibles pequeños (0–16 px) en escritorio al pasar a la escala; se revisan en la auditoría D3.
- Varias sesiones editan el frontend a la vez: cada agente revisa `git diff` antes de tocar un archivo y no toca pizarra, periodización, rutinas ni «Cobros y pagos» si no le corresponden.
- La regla ESLint arranca como aviso para no romper el CI.
