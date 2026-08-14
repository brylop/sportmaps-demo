# Plan — La marca de la escuela en toda la app (PWA Fase 2)

**Fecha:** 2026-08-14 · **Estado:** pendiente de revisión · **Rama:** `develop`

## Contexto

La Fase 1 ya está validada end-to-end en dev: la app se instala con el logo y el
nombre de la escuela, como app **separada** de SportMaps (probado con
`lopez-romero` en Android real). Ver `project_pwa_branded_install` en memoria.

Al probarla apareció lo que falta: el ícono es de la escuela, pero **todo lo de
adentro no**. Se abre la app de "López Romero" y aterriza en la landing comercial
de SportMaps ("Escuelas Deportivas", "Tienda") y después en un login verde de
SportMaps. El splash muestra tres capas de color descoordinadas.

**Decisiones tomadas con el usuario (2026-08-14):**

1. La app instalada aterriza **directo en el login**, no en la landing.
2. La marca va a **toda la app**, con un "powered by SportMaps" visible.
3. **Sí** se generan las imágenes de arranque de iOS.

## Ya aplicado (no requiere revisión)

- `background_color` del manifest = color de la escuela → el splash de Android
  deja de mostrar el cuadro del ícono flotando sobre blanco.
- `start_url` = `/login?t=<slug>`. **`id` se mantiene en `/?t=<slug>`**: cambiarlo
  convertiría a las apps ya instaladas en otra app distinta y quedarían huérfanas.
- Meta de iOS en `index.html`: `apple-mobile-web-app-capable`,
  `status-bar-style` y `apple-mobile-web-app-title` dinámico. Sin esto, en iPhone
  la app se instala llamándose "SportMaps - Revolucionando…" aunque sea la de la
  escuela, porque **iOS ignora el manifest** y lee el `<title>`.

## Lo que falta

### F2.1 — Alinear el gate de "mostrar marca" al addon

`get_school_by_slug` —la RPC que resolvería la marca antes del login— gatea por
**tier**, no por el addon. López Romero está en tier `free`, así que devolvería
`not_found` y el login no pintaría nada.

Gate nuevo: `has_pwa_branding OR has_whitelabel`. Medido contra la base: deja
fuera a **1 sola escuela** (28 quedan cubiertas por `whitelabel`).

Ojo con la distinción, que no es la misma pregunta:

- `school_has_branding_feature` (tier) = **puede EDITAR** su marca → lo usa
  `update_school_branding`. **Se deja como está.**
- gate nuevo = **se le MUESTRA** su marca. Es lo que se vendió.

Mismo criterio para `resolveSchoolBranding` del BFF (correos, PDFs, push), que
hoy también gatea por tier.

### F2.2 — Marca antes del login

- Generalizar `useTenantFromHostname` para que resuelva el tenant desde `?t=`,
  `localStorage` y el hostname (hoy solo hostname).
- Aplicarlo al `ThemeContext` antes de que exista sesión.
- Pintar login, registro y recuperar contraseña con el logo y los colores.

### F2.3 — "Powered by SportMaps"

**No hay que inventar nada**: ya existe `show_sportmaps_watermark` en
`branding_settings` y `schoolBrandingResolver` ya lo resuelve. Falta decidir si
es apagable y en qué tier, y mostrarlo en el pie de la app.

### F2.4 — Imágenes de arranque de iOS

`apple-touch-startup-image` con ~10 resoluciones por escuela, generadas con sharp
y declaradas con media queries. Implica más almacenamiento y más tiempo en cada
regeneración de íconos.

**Se sugiere hacerla al final:** es la de peor relación esfuerzo/beneficio (un
instante de pantalla) y las anteriores se ven todo el tiempo.

### F2.5 — Barrido de la app logueada

Revisar que no queden restos de marca SportMaps donde debería ir la de la
escuela: header, correos, PDFs, notificaciones push.

## Verificación

1. `curl -s "https://dev.sportmaps.co/app.webmanifest?s=lopez-romero"` → que
   `background_color` sea el color de la escuela y `start_url` el login.
2. Reinstalar en Android: el splash debe ser de un color continuo.
3. Abrir la app instalada: debe caer en el login **con la marca de la escuela**.
4. iPhone: "Añadir a inicio" debe quedar con el nombre de la escuela, no
   "SportMaps - Revolucionando…".
5. Que el "powered by SportMaps" se vea.
6. Confirmar que una escuela SIN el addon sigue viendo SportMaps en todo.

## Riesgo a no perder de vista

Cambiar el `id` del manifest rompe la identidad de las apps ya instaladas. Ante
la duda, **no se toca `id`**.
