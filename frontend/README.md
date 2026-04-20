# SportMaps — Frontend

SPA React con PWA, multi-rol, multi-tenant.

## Stack

React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui + Supabase Client + TanStack Query

## Setup

```bash
npm install
npm run dev       # http://localhost:3001
npm run build     # Build produccion en ./build
npm run preview   # Preview del build
```

## Estructura

```
src/
  pages/           88 paginas organizadas por feature
  components/      173 componentes (UI, modals, forms, layouts)
  hooks/           32 hooks custom (useSchoolContext, useAthleteData, etc.)
  contexts/        AuthContext, ThemeContext, CartContext
  config/          navigation.ts (sidebar por rol)
  lib/             APIs, utilidades, constantes
  integrations/    Tipos auto-generados de Supabase
  pwa/             Service Worker, InstallBanner, UpdateBanner
```

## Roles y navegacion

Cada rol tiene su sidebar definido en `src/config/navigation.ts`:

| Rol | Items principales |
|-----|------------------|
| school | Dashboard, Invitaciones, Estudiantes, Staff, Equipos, Planes, Calendario, Asistencias, Pagos, Recordatorios, Sedes |
| parent | Dashboard, Mis Hijos, Calendario, Asistencias, Pagos, Mensajes, Inscripciones |
| coach | Dashboard, Equipos, Agenda, Estudiantes, Calendario, Asistencias, Resultados, Planes Entrenamiento, Reportes |
| athlete | Dashboard, Calendario, Explorar, Inscripciones, Pagos |

## Features tecnicas

- Lazy loading en todas las paginas (React.lazy + Suspense)
- PWA con Service Worker (instalable en mobile)
- Multi-tenant via SchoolContext (school_id + branch_id)
- Dark mode (parcial)
- MobileBottomNav responsive (5 items por rol)
- ErrorBoundary global
- Code splitting: tesseract, pdfjs, leaflet en chunks separados

## Cuentas demo

Ver `docs/guides/DEMO_CREDENTIALS.md` en la raiz del proyecto.
