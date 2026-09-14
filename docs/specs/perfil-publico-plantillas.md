# Spec — Plantillas de diseño para el perfil público de la escuela

**Producto:** SportMaps · **Versión:** v1 (borrador para revisión)
**Fecha:** Septiembre 2026
**Estado:** propuesta — **nada aprobado todavía**, no se escribe código hasta revisar este documento.

> Mismo patrón que **Carnets Digitales** ([[project_carnets_digitales]]): una sola conexión de
> datos, varias composiciones visuales que la escuela elige. La diferencia es de alcance: acá
> es un **selector de layout preexistente** (3-4 opciones curadas), no un editor de campo por
> campo como el de carnets — evita construir una herramienta de diseño completa para un perfil
> que solo se ve una vez por escuela.

---

## 1. Objetivo

El microsite público de la escuela (`/s/:slug`, `PublicSchoolPage.tsx`) hoy tiene **un solo
layout fijo**: hero a todo lo ancho + tabs (Equipos/Instalaciones/Servicios/Entrenadores). Todas
las escuelas se ven estructuralmente idénticas, solo cambia el color de marca y el logo. Se
siente repetitivo y "poco fluido".

**Meta:** ofrecer 3-4 layouts alternativos que la escuela elige desde su propio perfil
(`SchoolPublicProfilePage.tsx`, donde ya edita logo/portada/colores), reusando exactamente los
mismos datos — sin tocar RLS, RPCs ni la fuente de datos.

---

## 2. Qué NO cambia (la "conexión")

`PublicSchoolPage.tsx` ya arma sus datos reales vía `schoolsAPI.getSchoolBySlug()` →
`mapPublicProfile()`: escuela (`schools`), `teams`, `public_staff`, `offerings`, `facilities`,
respetando los toggles `show_programs` / `show_plans` / `show_facilities` de
`v_school_settings_publico`. **Ese contrato no cambia.** Los layouts nuevos consumen el mismo
objeto `SchoolProfile` que ya devuelve la API; solo cambia el componente que lo renderiza.

**Gap detectado de paso** (no es parte de esta spec, pero condiciona la sensación de "no
fluida" tanto como el layout): el bloque "Horarios de Atención" está **hardcodeado** (mismo
horario para las 361 escuelas) y los botones "Inscribirse" / "Contactar" / "Ver Detalle" /
"Reservar Espacio" disparan un toast `"Acción Demo"` en vez de una acción real. Lo dejo anotado
en §7 como decisión pendiente — se puede resolver en esta misma fase o después, pero conviene
decidirlo ahora porque **los layouts nuevos van a repetir el mismo hueco** si no se resuelve.

---

## 3. Modelo de datos (propuesta mínima)

Un solo campo, no una tabla nueva (a diferencia de carnets, que necesitaba CRUD de plantillas
por escuela con muchos parámetros). Candidato:

```sql
alter table public.schools
  add column public_page_layout text not null default 'classic'
  check (public_page_layout in ('classic', 'modern', 'minimal', 'magazine'));
```

- Vive en `schools` (no en `school_settings`) porque es una propiedad del perfil público, igual
  que `logo_url` / `cover_image_url`, y ya se lee sin auth vía `mapPublicProfile()`.
- **Decisión pendiente:** ¿editable directo (como logo/color) o protegida por el mismo trigger
  `enforce_branding_via_rpc` que ya cuida `logo_url`/`cover_image_url`? Por consistencia,
  probablemente debería sumarse a `update_school_public_profile` (la RPC que ya usa
  `SchoolPublicProfilePage.tsx`) en vez de un `UPDATE` directo.

---

## 4. Las 4 variantes propuestas

| Layout | Composición | Tono |
|---|---|---|
| **Clásica** (`classic`) | La actual: hero full-bleed con overlay oscuro, logo superpuesto, tabs para secciones. Se conserva tal cual — es el layout que hoy corre en las 361 escuelas, cero riesgo de regresión visual para quien no elige nada. | Corporativo, denso |
| **Moderna** (`modern`) | Hero partido 50/50 (imagen a la derecha, texto+CTA a la izquierda, sin overlay), secciones en scroll vertical continuo (no tabs) con anclas de navegación sticky. | Landing page, más "fluido" |
| **Minimal** (`minimal`) | Header compacto centrado (logo pequeño + nombre + una línea), sin hero de portada grande, secciones en acordeón, paleta reducida a blanco/gris + 1 color de marca. | Liviano, rápido de cargar |
| **Revista** (`magazine`) | Portada a sangre completa con badges de deportes superpuestos tipo editorial, grid asimétrico para equipos (destacado + secundarios), tipografía más grande. | Visual, para escuelas con buenas fotos |

Cada layout es un componente propio (`PublicSchoolPage.Classic.tsx`,
`PublicSchoolPage.Modern.tsx`, etc.) que recibe el mismo `SchoolProfile` + `facilities` ya
resueltos por el padre — el padre (`PublicSchoolPage.tsx`) pasa a ser solo data-fetching +
`switch(school.public_page_layout)`.

---

## 5. Selector en el perfil de la escuela

En `SchoolPublicProfilePage.tsx`, junto a logo/portada/colores: un picker con preview en miniatura
de los 4 layouts (mismo patrón visual que `LAYOUTS` en `CardTemplatesManager.tsx` — tarjetas con
nombre + hint, la seleccionada con check), sin editor de campos individuales. Guardar vía
`update_school_public_profile` (o RPC nueva si se decide separar).

**Sin preview en vivo con datos reales de la escuela en v1** (a diferencia de carnets) — con 4
miniaturas estáticas alcanza para elegir; renderizar las 4 variantes en vivo cada vez que se abre
el perfil es costo que no se justifica todavía. Se puede sumar después si el picker estático no
alcanza.

---

## 6. Fases de construcción

1. **Fase 1 — Refactor sin cambio visible:** partir `PublicSchoolPage.tsx` en
   `PublicSchoolPage` (data-fetching) + `PublicSchoolPage.Classic.tsx` (todo el JSX actual, sin
   tocar diseño). Cero riesgo: mismo layout, solo reorganizado. Migración del campo
   `public_page_layout` (default `'classic'`), sin UI todavía.
2. **Fase 2 — Layout Moderno + selector:** construir `Modern`, sumar el picker en
   `SchoolPublicProfilePage.tsx`. Primera vez que una escuela puede elegir algo distinto de
   Clásica.
3. **Fase 3 — Minimal + Revista:** los dos layouts restantes, mismo patrón.
4. **Fase 4 (opcional, a decidir):** resolver el gap de §2 (horarios reales, CTAs con acción de
   verdad) — probablemente conviene hacerlo **antes** de Fase 2, para no repetir el mismo
   hardcodeo en 3 layouts nuevos.

Revisión entre cada fase, rama por fase — igual que el resto de módulos grandes.

---

## 7. Decisiones de producto pendientes (bloquean Fase 1)

1. ¿El campo va en `schools` directo o protegido por RPC (`update_school_public_profile`)?
2. ¿Se resuelve el hardcodeo de horarios/CTAs antes de multiplicar el layout en 4 variantes, o
   se acepta la deuda por ahora y se resuelve aparte?
3. ¿Los 4 nombres/tonos de layout (Clásica/Moderna/Minimal/Revista) son los correctos, o hay
   una quinta idea que falta?
4. ¿"Horarios de Atención" real sale de una tabla nueva (`school_business_hours`) o de un campo
   JSON en `school_settings`? (Necesario si se resuelve el punto 2.)
