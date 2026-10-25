# Tokens de tamaño — SportMaps

Fuente única de verdad de anchos, altos y espacios estructurales del frontend.

| Dónde vive | Qué |
|---|---|
| `frontend/tailwind.config.ts` → `theme.extend` | Las clases (`max-w-page`, `h-touch`, `pb-nav-safe`…) |
| `frontend/src/index.css` → `:root` | Variables CSS (`--bottom-nav-h`, `--header-h`, `--touch`) y reglas base móviles |
| `frontend/src/lib/designTokens.ts` | Los mismos valores para TypeScript (Recharts, estilos inline) |
| `frontend/eslint.config.js` | Aviso cuando aparece un `w-[300px]` y similares |

Todo va en `rem` (1rem = 16px). Los breakpoints son los de Tailwind por defecto y **no se tocan**: `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280 · contenedor `2xl` 1400.

---

## 1. Tabla de tokens

### Anchos máximos — `max-w-*`

| Clase | Valor | px | Cuándo usarla |
|---|---|---|---|
| `max-w-page-narrow` | 40rem | 640 | Formularios, ajustes, perfil: una sola columna |
| `max-w-page` | 60rem | 960 | Página de contenido estándar |
| `max-w-page-wide` | 75rem | 1200 | Tablas, tableros, listados con muchas columnas |
| `max-w-modal-sm` | 26.25rem | 420 | Confirmaciones, alertas, avisos cortos |
| `max-w-modal` | 40rem | 640 | Modal con formulario |
| `max-w-modal-lg` | 60rem | 960 | Modal con tabla, detalle o dos columnas |
| `max-w-prose-ui` | 65ch | ~ | Texto corrido (descripciones, términos, ayudas largas) |

### Alturas, anchos y mínimos táctiles

| Clase | Valor | px | Cuándo usarla |
|---|---|---|---|
| `h-touch` · `min-h-touch` · `min-w-touch` · `w-touch` | 2.75rem | 44 | Todo lo que se toca: botones, filas clicables, íconos (`w-touch h-touch`) |
| `h-header` · `min-h-header` · `min-w-header` | 3.5rem | 56 | Barra superior de página / cabecera sticky |
| `h-tabs` · `min-h-tabs` | 2.75rem | 44 | Tira de pestañas en móvil: `<TabsList className="h-tabs md:h-10">` |
| `h-nav` · `min-h-nav` · `min-w-nav` | `var(--bottom-nav-h)` | 64 móvil / 0 en md+ | Alto de la barra inferior (`MobileBottomNav`) |
| `w-sidebar` | 15.5rem | 248 | Sidebar de escritorio expandida |
| `w-sidebar-collapsed` | 4rem | 64 | Sidebar colapsada (solo íconos) |

### Alturas de contenido — `h-*` y `max-h-*`

| Clase | Valor | px | Cuándo usarla |
|---|---|---|---|
| `h-screen-d` / `max-h-screen-d` | 100dvh | viewport real | Pantallas completas. **No** `h-screen` (100vh se mete debajo de la barra del navegador en iOS/Android) |
| `max-h-sheet` / `h-sheet` | 85dvh | ~ | Bottom sheet / drawer en móvil |
| `h-chart-sm` | 12rem | 192 | Sparkline, gráfica en tarjeta pequeña |
| `h-chart` | 16rem | 256 | Gráfica estándar de tablero |
| `h-chart-lg` | 20rem | 320 | Gráfica protagonista de la página |
| `h-media` / `max-h-media` | 14rem | 224 | Miniaturas, portadas, fotos de producto/escuela |
| `max-h-list` / `h-list` | 60dvh | ~ | Áreas con scroll interno (listas dentro de modal, selectores largos) |

En TS: `CHART_HEIGHT_PX.sm | md | lg` (192 / 256 / 320) para `<ResponsiveContainer height={…}>`.

### Tipografía

| Clase | Valor | Cuándo usarla |
|---|---|---|
| `text-input` | 1rem / line-height 1.5rem (16px) | Campos de formulario en móvil. Con menos de 16px, iOS hace zoom al enfocar |
| `text-xs` | 0.75rem (12px) | **Mínimo** para cualquier texto. Nada de `text-[10px]` / `text-[11px]` |

> `text-input` solo pone tamaño: el color shadcn `input` se quitó de los colores de texto para que la clase no pinte el texto del color del borde. `border-input`, `bg-input` y `ring-input` siguen igual.

### Espacios — `p-*`, `m-*`, `gap-*`, `bottom-*`, `inset-*`…

| Clase | Valor | Cuándo usarla |
|---|---|---|
| `px-gutter` (y `p-`, `gap-`…) | 1rem (16px) | Margen lateral de página en móvil |
| `pb-nav-safe` | `calc(var(--bottom-nav-h) + safe-area-bottom)` | Contenido de página para que el final no quede debajo de la barra inferior. En md+ queda solo el safe area (la barra está oculta) |
| `bottom-nav-safe` | ídem | Botón flotante / barra de acción fija por encima de la barra inferior |
| `pb-safe-b` / `bottom-safe-b` | `env(safe-area-inset-bottom, 0px)` | Elemento pegado al borde inferior físico (home indicator del iPhone) |
| `pt-safe-t` / `top-safe-t` | `env(safe-area-inset-top, 0px)` | Elemento pegado al borde superior físico (notch) |

### Variables CSS (`src/index.css`, `:root`)

| Variable | Valor | Nota |
|---|---|---|
| `--bottom-nav-h` | 4rem (64px); **0px desde 768px** | `MobileBottomNav` es `h-16` y `md:hidden` |
| `--header-h` | 3.5rem (56px) | Para `top-[var(--header-h)]` en stickies apilados |
| `--touch` | 2.75rem (44px) | Para cálculos en CSS |

### Utilidades CSS que ya existían (se conservan, no duplicar)

| Clase | Qué hace | Equivalente con tokens |
|---|---|---|
| `.safe-area-bottom` | `padding-bottom: env(safe-area-inset-bottom)` (20px en PWA standalone) | `pb-safe-b` |
| `.sticky-safe` | `padding-top: env(safe-area-inset-top)` aditivo para la cabecera pegada arriba | `pt-safe-t` |
| `.screen-safe` | `min-height: 100dvh` + padding `max(1rem, safe-area)` en los 4 lados | `min-h-screen-d` + paddings |
| `.dialog-safe` | `max-height: 100dvh`, scroll interno, padding inferior con safe area | `max-h-screen-d overflow-y-auto pb-…` |
| `.main-content-with-nav` | 80px abajo en ≤768px | **Preferir `pb-nav-safe`** (respeta el safe area y se apaga en md+) |

---

## 2. Scrollbars, pestañas y nitidez

### Scrollbars (global, `@layer base`)

Todas las barras de scroll son iguales y delgadas: `scrollbar-width: thin; scrollbar-color: hsl(var(--border)) transparent` (Firefox) y `::-webkit-scrollbar` de 8px con thumb redondeado y track transparente (Chrome/Edge/Safari). No hay que poner nada en cada pantalla. `.custom-scrollbar` sigue existiendo pero ya es el estilo global (no hace falta añadirla).

| Clase | Qué hace | Cuándo usarla |
|---|---|---|
| `scrollbar-none` | Oculta la barra pero deja deslizar | Tiras horizontales de pestañas, chips de filtros, carruseles. `scrollbar-hide` es alias (ya estaba en el código sin definir) |
| `scroll-fade-x` | Máscara que desvanece 1rem en los bordes izquierdo/derecho | Opcional, junto a `overflow-x-auto scrollbar-none`, para insinuar que hay más contenido |

```tsx
<div className="flex gap-2 overflow-x-auto scrollbar-none scroll-fade-x whitespace-nowrap px-gutter">
  {filtros.map(f => <Chip key={f.id} className="min-h-touch shrink-0">{f.nombre}</Chip>)}
</div>
```

### Pestañas (`src/components/ui/tabs.tsx`)

`TabsList` ya trae `max-w-full overflow-x-auto whitespace-nowrap scrollbar-none`: en móvil, si las pestañas no caben, la tira desliza en horizontal sin barra visible en vez de cortarse. Centra con `justify-content: safe center` (clase `.tabs-list` en `@layer components`), así que al desbordar no se pierde la primera pestaña por la izquierda, y un `justify-start` del consumidor la sigue pisando. En escritorio, cuando caben, se ve igual que antes.

El alto **no** se cambió en el componente (11 pantallas le pasan `h-auto` con `flex-wrap`; forzar un alto responsive las rompería). Para la tira táctil en móvil:

```tsx
<TabsList className="h-tabs md:h-10">…</TabsList>
```

No envolver `TabsList` en un `grid grid-cols-5` en móvil si los textos no caben a 360px: dejarla en flex y que deslice.

### Nitidez del texto

`body` lleva `-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility`. Poppins se carga desde Google Fonts en `frontend/index.html` con pesos 400/500/600/700/800 y `display=swap`. **No usar** `image-rendering: pixelated` ni escalar imágenes pequeñas hacia arriba (usar `object-cover` sobre una imagen de al menos 2× el tamaño mostrado).

---

## 3. Reglas móviles (obligatorias)

1. **Objetivos táctiles de 44px.** Botones, íconos clicables, filas de lista y pestañas: `min-h-touch`, y `w-touch h-touch` para botones de solo ícono. El ícono puede ser de 16–20px; lo que mide 44 es el área.
2. **Campos a 16px.** Ya hay una regla base: en pantallas `< md`, `input, select, textarea { font-size: max(16px, 1em) }`. Pero una clase `text-sm` en el campo la pisa (las clases ganan a los selectores de elemento). En campos propios usar `text-input md:text-sm`. Los `Input` y `Textarea` de shadcn ya hacen `text-base md:text-sm`.
3. **12px mínimo de texto.** `text-xs` es el piso. Nada de `text-[10px]`/`text-[11px]`.
4. **Bottom sheets en móvil.** Formularios y selecciones largas en móvil van en `Drawer`/`Sheet` desde abajo con `max-h-sheet` y scroll interno, no en un `Dialog` centrado que se sale de la pantalla. En md+ puede ser `Dialog` con `max-w-modal`.
5. **Sin scroll horizontal de página a 360px.** Nada de anchos fijos mayores que el viewport: `w-full max-w-page` en vez de `w-[900px]`. Tablas anchas: dentro de un contenedor `overflow-x-auto`, nunca la página entera.
6. **Safe areas.** Lo que toca el borde físico de abajo lleva `pb-safe-b` (o `.safe-area-bottom`); lo que toca el de arriba, `pt-safe-t` (o `.sticky-safe`). El contenido de una página con barra inferior termina con `pb-nav-safe`.
7. **Viewport dinámico.** `h-screen-d`/`min-h-screen-d` en vez de `h-screen`/`min-h-screen` en pantallas completas.
8. **No cambiar el escritorio.** Los ajustes móviles se escriben "móvil primero" y se restauran con `md:` si hace falta (ej. `h-tabs md:h-10`).

---

## 4. Cómo migrar un `w-[..px]`

ESLint avisa (warning, no rompe el CI) con «Usa un token de tamaño (docs/design-tokens.md) en vez de píxeles fijos» cuando un string contiene `w-`, `h-`, `min-`/`max-`, `size-`, `top/left/right/bottom-`, `inset-`, `gap-`, `p*-` o `m*-` con `[Npx]`. Al momento de crear la regla había **187 avisos en 78 archivos** (deuda existente).

Pasos:

1. ¿Es un **ancho de contenedor**? Pasar a `w-full` + el `max-w-*` más cercano.
2. ¿Es un **alto de gráfica, imagen o lista**? Pasar al `h-chart*`, `h-media` o `max-h-list`.
3. ¿Es un **objetivo táctil**? `min-h-touch` / `w-touch h-touch`.
4. ¿Es un **espacio de la escala** (4, 8, 12, 16, 24…)? Usar la escala de Tailwind: `px-[12px]` → `px-3`, `gap-[6px]` → `gap-1.5`, `h-[40px]` → `h-10`, `w-[1px]` → `w-px`, `h-[18px] w-[18px]` → `size-[1.125rem]` o, mejor, `size-4`/`size-5`.
5. ¿Ninguno encaja y el valor es de verdad único (ej. una ilustración)? Expresarlo en `rem` (`w-[18.75rem]`) y dejar un comentario de por qué. Si aparece en tres sitios, proponer un token nuevo aquí.

| Antes | Después |
|---|---|
| `<div className="max-w-[640px] mx-auto">` | `<div className="max-w-page-narrow mx-auto">` |
| `<DialogContent className="max-w-[420px]">` | `<DialogContent className="max-w-modal-sm">` |
| `<DialogContent className="sm:max-w-[900px]">` | `<DialogContent className="sm:max-w-modal-lg">` |
| `<div className="h-[300px]"><ResponsiveContainer …>` | `<div className="h-chart-lg"><ResponsiveContainer …>` |
| `<img className="h-[220px] w-full object-cover">` | `<img className="h-media w-full object-cover">` |
| `<ScrollArea className="max-h-[400px]">` | `<ScrollArea className="max-h-list">` |
| `<Button className="h-[44px] w-[44px]" size="icon">` | `<Button className="w-touch h-touch" size="icon">` |
| `<main className="pb-[80px] md:pb-0">` | `<main className="pb-nav-safe">` |
| `<div className="fixed bottom-[72px] right-4">` | `<div className="fixed bottom-nav-safe right-4 mb-2">` |
| `<aside className="w-[248px]">` | `<aside className="w-sidebar">` |
| `<span className="max-w-[90px] truncate">` | `<span className="max-w-[5.5rem] truncate">` (único, en rem) o `min-w-0 flex-1 truncate` |
| `<input className="text-sm …">` | `<input className="text-input md:text-sm …">` |

## 5. Respuesta y movimiento

Base tomada de la skill *apple-design* (gethamster/skills, MIT; WWDC *Designing Fluid Interfaces* y *The Details of UI Typography*), adaptada a SportMaps. Lo global vive en `src/index.css` (`@layer base`) y en `src/components/ui/button.tsx`.

| Regla | Dónde | Valor |
|---|---|---|
| Respuesta al tocar, no al soltar | `button.tsx` (base) | `motion-safe:active:scale-[0.97]`, 100 ms |
| Sin espera de doble toque ni destello gris | `html` | `touch-action: manipulation`, `-webkit-tap-highlight-color: transparent` |
| Resorte por defecto **sin rebote** | `--transition-spring` | `0.35s cubic-bezier(0.2, 0, 0, 1)`. Rebote solo si un gesto trae impulso (soltar una tarjeta, lanzar una hoja) |
| Tracking por tamaño | `h1`/`h2`/`h3` | `-0.02em` / `-0.015em` / `-0.01em`, leading 1.15 / 1.2 / 1.3, `text-wrap: balance`; cuerpo en 0 |
| Movimiento reducido | `prefers-reduced-motion` | Entradas como fundido (sin escala ni deslizamiento); transiciones solo de color y opacidad; sin `bounce`/`ping` |
| Transparencia reducida | `prefers-reduced-transparency` | Lo que tiene `backdrop-blur` pasa a fondo sólido (no aplica a las capas de los modales) |
| Más contraste | `prefers-contrast: more` | `--border`, `--input` y `--muted-foreground` más oscuros |

Reglas para pantallas nuevas (se revisan en code review, no hay lint):

- **Deshacer en vez de «¿Seguro?».** La acción se hace al instante y se ofrece «Deshacer» unos 8 s con `toast` de `sonner` (`action: { label: "Deshacer" }`). Se confirma antes solo lo que borra o anula dinero.
- **Lo que entra por un lado sale por el mismo.** Una hoja que sube desde abajo se cierra hacia abajo; un menú nace del botón que lo abrió (`transform-origin` en el disparador).
- **Arrastrar = seguir el dedo 1:1 y poder soltar o devolver a mitad de camino.** En celular, para hojas usar `Drawer` (`vaul`), que ya lo hace; no animar con `@keyframes` lo que el usuario puede agarrar.
- **Retroalimentación con sentido.** Vibración (`navigator.vibrate`) solo en momentos que cierran algo (lista guardada, pago aprobado), en el mismo instante que el cambio visual.
- **Desenfoque con medida.** `backdrop-blur` cuesta en Android de gama media (MOV-12): solo en barras fijas pequeñas, nunca en listas ni tarjetas.

Lo que **no** se adopta de la skill: la fuente del sistema (SportMaps usa Poppins por marca) y librerías de resortes con velocidad (`motion`/`framer-motion`) mientras `vaul` y CSS alcancen; se reconsidera para la pizarra si se agrega lanzar jugadores con impulso.
