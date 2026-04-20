# SportMaps - Arquitectura Frontend

> Ultima actualizacion: Abril 2026
> Stack: React 18 + Vite + TypeScript + TailwindCSS + shadcn/ui
> ~88 paginas, PWA habilitado

---

## Estructura del Proyecto

```
frontend/src/
  components/
    dashboard/           # Componentes de dashboard por rol
    footer/              # SportMapsFooter
    organizer/           # OrganizerGuard, componentes de eventos
    pages/               # Componentes de paginas especificas (RoleSelection, AthleteRegister, etc.)
    settings/            # SportMapsPaySettings, configuraciones
    ui/                  # shadcn/ui base components (Button, Card, Dialog, etc.)
    AppSidebar.tsx       # Navegacion lateral responsive
    ProtectedRoute.tsx   # Guard de rutas autenticadas
    PermissionGate.tsx   # Guard a nivel de componente
  config/
    navigation.ts        # Menus laterales por rol
    routePermissions.ts  # Mapa ruta → roles + permisos (Single Source of Truth)
  constants/
    roles.ts             # USER_ROLES constantes
  contexts/
    AuthContext.tsx       # Sesion, perfil, login/logout, updateProfile
    ThemeContext.tsx      # Tema claro/oscuro
    CartContext.tsx       # Carrito de compras (marketplace)
  hooks/
    useSchoolContext.ts   # Escuela activa, rol, branch, onboarding
    useDashboardConfig.ts # Configuracion de dashboard por rol
    usePermissions.ts     # can(), hasRole(), hasFeature(), isAdmin()
    useEvents.ts          # CRUD de eventos deportivos
    useExplorarGlobal.ts  # Busqueda global con filtros
    useInvitationBranding.ts # Branding de invitaciones
    use-toast.ts          # Notificaciones toast
  integrations/
    supabase/
      client.ts           # Cliente Supabase (singleton)
      types.ts            # Tipos generados de la BD
  lib/
    constants/
      sportsCatalog.ts    # Catalogo de deportes
    bffClient.ts          # Cliente HTTP para el BFF
    error-translator.ts   # Traduce errores tecnicos a mensajes amigables
    utils.ts              # cn() y utilidades
  pages/
    # ~88 paginas organizadas por modulo:
    DashboardPage.tsx
    LoginPage.tsx
    RegisterPage.tsx
    TermsPage.tsx
    PrivacyPage.tsx
    events/               # EventPublicPage, EventIndividualRegisterPage
    organizer/            # OrganizerDashboardPage, CreateEventPage, etc.
    trainer/              # TrainerDashboardPage, TrainerOnboarding, etc.
    ...
  App.tsx                 # Rutas principales, lazy loading, providers
  main.tsx                # Entry point
  index.css               # Tokens CSS, tema shadcn
```

---

## Flujo de Datos

```
Supabase Auth (login/register)
     ↓
AuthContext (user, profile, session)
     ↓
useSchoolContext (schoolId, role, branch, onboarding)
     ↓
App.tsx Routes (lazy loaded)
     ↓
ProtectedRoute (valida auth + rol + onboarding)
     ↓
Page Component
     ↓
├── Supabase Client directo (queries simples con RLS)
└── bffClient (operaciones complejas via BFF)
     ↓
TanStack React Query (cache, refetch, mutations)
     ↓
UI Components (shadcn/ui + Tailwind)
```

### Estado Global vs Local

| Tipo | Mecanismo | Ejemplo |
|------|-----------|---------|
| Autenticacion | AuthContext | user, profile, session |
| Escuela activa | useSchoolContext | schoolId, role, branch |
| Tema | ThemeContext | dark/light |
| Carrito | CartContext | items, total |
| Cache de datos | TanStack React Query | Queries con staleTime |
| Estado UI local | useState | modales, toggles, forms |
| Derivado | useMemo | Config de dashboard por rol |

---

## Sistema de Routing

### Lazy Loading

Todas las paginas se cargan con `React.lazy()` + `Suspense`:

```tsx
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const EventPublicPage = lazy(() => import("@/pages/events/EventPublicPage"));
// ...88+ paginas
```

### Tipos de Rutas

| Tipo | Ejemplo | Guard |
|------|---------|-------|
| Publica | `/`, `/explore`, `/login`, `/register` | Ninguno |
| Legal | `/terminos-y-condiciones`, `/politica-de-privacidad` | Ninguno |
| Alias | `/terms` → redirect a `/terminos-y-condiciones` | `<Navigate>` |
| Autenticada | `/dashboard`, `/students` | `<ProtectedRoute>` |
| Por rol | `/organizer/dashboard` | `<ProtectedRoute>` + `<OrganizerGuard>` |
| Checkout | `/parent-checkout` | `<ProtectedRoute>` |

### Route Permissions Map

Single Source of Truth en `config/routePermissions.ts`:

```typescript
'/students': {
  allowedRoles: ['school', 'admin', 'school_admin', 'coach'],
  requiredPermission: 'students:view',
  description: 'Gestion de estudiantes'
},
'/organizer/dashboard': {
  allowedRoles: ['organizer'],
  description: 'Dashboard del organizador'
}
```

---

## Sistema de Permisos (Frontend)

### 3 Mecanismos

#### 1. ProtectedRoute (rutas completas)

```tsx
<Route path="students" element={
  <ProtectedRoute allowedRoles={['school', 'admin', 'coach']}>
    <SchoolStudentsManagementPage />
  </ProtectedRoute>
} />
```

#### 2. PermissionGate (componentes individuales)

```tsx
<PermissionGate permission="finances:manage">
  <Button>Configurar Pagos</Button>
</PermissionGate>

<PermissionGate roles={['organizer']}>
  <EventManagementPanel />
</PermissionGate>
```

#### 3. usePermissions Hook

```tsx
const { can, hasRole, hasFeature, isAdmin } = usePermissions();

if (can('students:create')) { /* mostrar boton crear */ }
if (hasRole('organizer')) { /* mostrar menu de eventos */ }
```

---

## Comunicacion con el Backend

### Supabase Client (directo)

Para consultas simples protegidas por RLS:

```typescript
import { supabase } from '@/integrations/supabase/client';

const { data } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', user.id)
  .single();
```

### BFF Client

Para operaciones complejas, multi-tabla o que requieren service role:

```typescript
import { bffClient } from '@/lib/bffClient';

// El client agrega automaticamente el Bearer token y schoolId
const response = await bffClient.post('/api/v1/students/create-one', {
  type: 'child',
  first_name: 'Santiago',
  // ...
});
```

### TanStack React Query

Cache y sincronizacion de datos:

```typescript
const { data, isLoading } = useQuery({
  queryKey: ['students', schoolId],
  queryFn: () => bffClient.get('/api/v1/students'),
  staleTime: 5 * 60 * 1000, // 5 minutos
});
```

---

## Sistema de Registro

### Flujos por Rol

| Rol | Componente | Pasos |
|-----|-----------|-------|
| General (todos) | `RegisterPage.tsx` | 1 paso: datos + rol + terminos |
| athlete/parent | `AthleteRegister.tsx` | 3 pasos: datos → deporte → terminos |
| coach | `CoachRegister.tsx` | 5 pasos: datos → experiencia → docs → codigo conducta + terminos |
| school | `SchoolRegister.tsx` | 5 pasos: legal → admin → deportes → docs + terminos → confirmacion |

### Aceptacion Legal Obligatoria

Todos los flujos de registro requieren aceptacion explicita (checkboxes obligatorios) de:
- **Terminos y Condiciones** (`/terminos-y-condiciones`)
- **Politica de Privacidad** (`/politica-de-privacidad`)

Coaches adicionalmente aceptan el **Codigo de Conducta del Entrenador**.

---

## Sistema de Diseno

### Tokens CSS (index.css)

```css
--primary: 147 96% 33%;         /* Verde SportMaps */
--primary-glow: 147 85% 45%;   /* Resplandor */
```

### Componentes UI

- Base: shadcn/ui (Button, Card, Dialog, Select, etc.)
- Personalizados: StatCard, ActivityList, QuickActions
- Consistencia via variantes (`variant`, `size`)
- Accesibilidad: ARIA labels, keyboard navigation

### Responsive

- Mobile-first approach
- Grid adaptativo: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`
- Sidebar colapsable en movil (AppSidebar)
- PWA: installable, offline-capable

---

## Performance

### Optimizaciones Implementadas

- Lazy loading de todas las paginas (~88 rutas)
- TanStack React Query con staleTime para cache
- useMemo para configuracion derivada de roles
- Componentes pequenos → re-renders limitados
- Tailwind CSS (compile-time, no runtime)
- Vite (HMR rapido, tree-shaking)

---

## Convenciones

```
Archivos de componente:  PascalCase.tsx     (StatCard.tsx)
Archivos de hook:        camelCase.ts       (usePermissions.ts)
Archivos de config:      camelCase.ts       (routePermissions.ts)
Funciones:               camelCase          (useDashboardConfig)
Tipos/Interfaces:        PascalCase         (DashboardConfig)
Constantes:              UPPER_SNAKE_CASE   (USER_ROLES)
Paginas:                 PascalCase+Page    (DashboardPage.tsx)
```

---

## Documentacion Relacionada

- **API del BFF:** [`api_specifications.md`](./api_specifications.md)
- **Seguridad y RBAC:** [`security.md`](./security.md)
- **Backend y BD:** [`backend_architecture.md`](./backend_architecture.md)
- **Credenciales demo:** [`../guides/DEMO_CREDENTIALS.md`](../guides/DEMO_CREDENTIALS.md)

---

*SportMaps Demo — Abril 2026*
