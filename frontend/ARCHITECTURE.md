# SportMaps - Arquitectura del Proyecto

## 📐 Estructura Modular

El proyecto sigue una arquitectura component-driven con separación clara de responsabilidades.

### Jerarquía de Carpetas

```
src/
├── components/          # Componentes reutilizables
│   ├── dashboard/      # Componentes específicos de dashboard
│   │   ├── StatCard.tsx
│   │   ├── ActivityList.tsx
│   │   ├── QuickActions.tsx
│   │   └── NotificationList.tsx
│   ├── ui/             # Componentes base (shadcn/ui)
│   ├── AppSidebar.tsx  # Navegación lateral
│   └── ...
├── config/             # Configuración centralizada
│   └── navigation.ts   # Rutas y navegación por rol
├── contexts/           # React Contexts
│   └── AuthContext.tsx # Estado de autenticación
├── hooks/              # Custom Hooks
│   ├── useDashboardConfig.ts  # Configuración por rol
│   └── use-toast.ts
├── types/              # TypeScript definitions
│   └── dashboard.ts    # Tipos del dashboard
├── pages/              # Páginas principales
│   ├── DashboardPage.tsx
│   └── ...
└── layouts/            # Layouts compartidos
    └── AuthLayout.tsx
```

## 🎯 Principios de Diseño

### 1. **Composición sobre Herencia**
Los componentes son pequeños, enfocados y reutilizables.

```typescript
// ❌ Evitar: Componentes monolíticos
<DashboardAthlete />  // 500+ líneas

// ✅ Mejor: Componentes compuestos
<Dashboard>
  <StatCard {...} />
  <ActivityList {...} />
  <QuickActions {...} />
</Dashboard>
```

### 2. **Single Responsibility Principle**
Cada componente tiene una única responsabilidad clara.

- `StatCard.tsx` → Solo renderiza una tarjeta de estadística
- `ActivityList.tsx` → Solo muestra una lista de actividades
- `useDashboardConfig.ts` → Solo proporciona configuración por rol

### 3. **Inversión de Dependencias**
Los componentes dependen de abstracciones (interfaces), no de implementaciones concretas.

```typescript
// Types first
interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType;
}

// Luego la implementación
export function StatCard({ title, value, icon }: StatCardProps) { }
```

### 4. **DRY (Don't Repeat Yourself)**
La lógica compartida se extrae a hooks y utilidades centralizadas.

```typescript
// Hook centralizado para configuración
export function useDashboardConfig(role: UserRole): DashboardConfig {
  // Toda la lógica de roles en un solo lugar
}
```

## 🔄 Flujo de Datos

```
User Login
    ↓
AuthContext (user, profile, role)
    ↓
DashboardPage (consume role)
    ↓
useDashboardConfig(role) → DashboardConfig
    ↓
StatCard, ActivityList, QuickActions (render)
```

### Estado Global vs Local

- **Global (Context)**: Autenticación, perfil de usuario
- **Local (useState)**: Estado UI temporal (modales, toggles)
- **Derivado (useMemo)**: Configuración basada en rol

## 🎨 Sistema de Diseño

### Tokens Semánticos (index.css)

Todos los colores y estilos usan variables CSS centralizadas:

```css
--primary: 147 96% 33%;         /* Verde esmeralda */
--primary-glow: 147 85% 45%;   /* Resplandor */
--gradient-hero: linear-gradient(...);
--shadow-elevation: 0 25px 50px...;
```

### Componentes UI (shadcn)

- Personalizados y extendibles
- Variantes consistentes (`variant`, `size`)
- Accesibles (ARIA labels, keyboard navigation)

## 🚀 Escalabilidad

### Agregar un Nuevo Rol

1. **Actualizar tipos** (`src/types/dashboard.ts`):
```typescript
export type UserRole = 'athlete' | 'new_role';
```

2. **Agregar configuración** (`src/hooks/useDashboardConfig.ts`):
```typescript
case 'new_role':
  return {
    title: 'Nuevo Rol',
    stats: [...],
    activities: [...],
  };
```

3. **Agregar navegación** (`src/config/navigation.ts`):
```typescript
new_role: [
  {
    title: 'Principal',
    items: [...]
  }
]
```

### Agregar un Nuevo Componente Dashboard

1. Crear componente en `src/components/dashboard/`
2. Definir interface en `src/types/dashboard.ts`
3. Usar en `DashboardPage.tsx`

```typescript
// types/dashboard.ts
export interface NewComponentProps { ... }

// components/dashboard/NewComponent.tsx
export function NewComponent({ ... }: NewComponentProps) { ... }

// pages/DashboardPage.tsx
import { NewComponent } from '@/components/dashboard/NewComponent';
<NewComponent {...config.newData} />
```

## 🧪 Testing (Futuro)

Preparado para testing:

```typescript
// Componentes puros → fácil de testear
expect(render(<StatCard {...mockProps} />)).toMatchSnapshot();

// Hooks aislados
const { result } = renderHook(() => useDashboardConfig('athlete'));
expect(result.current.stats).toHaveLength(4);
```

## 🔒 Seguridad

### Row Level Security (RLS)

- Todos los datos filtrados por `auth.uid()`
- Queries solo retornan datos del usuario logueado
- Políticas RLS en Supabase

### Validación de Roles

```typescript
// ProtectedRoute valida permisos
<ProtectedRoute allowedRoles={['admin']}>
  <AdminPanel />
</ProtectedRoute>
```

## 📱 Responsive Design

- Mobile-first approach
- Grid adaptativo (`grid-cols-1 md:grid-cols-2 lg:grid-cols-4`)
- Sidebar colapsable en móvil

## ⚡ Performance

### Optimizaciones Implementadas

- `useMemo` para configuración derivada
- Lazy loading de rutas (futuro)
- Componentes pequeños → re-renders limitados
- CSS-in-JS evitado → Tailwind compile-time

### Métricas Target

- **First Contentful Paint**: < 1s
- **Time to Interactive**: < 2s
- **Lighthouse Score**: > 90

## 🛠️ Herramientas de Desarrollo

### Stack Principal

- **React 18** → Concurrent features
- **TypeScript** → Type safety
- **Tailwind CSS** → Utility-first styling
- **shadcn/ui** → Componentes base
- **Supabase** → Backend & Auth
- **Vite** → Build tool

### Convenciones de Código

```typescript
// Nombres de archivos: PascalCase para componentes
StatCard.tsx

// Funciones: camelCase
export function useDashboardConfig() { }

// Tipos: PascalCase con sufijo
interface DashboardConfig { }
type UserRole = ...;

// Constantes: UPPER_SNAKE_CASE
const API_URL = '...';
```

## 📚 Recursos Adicionales

- [Documentación shadcn/ui](https://ui.shadcn.com)
- [Supabase Docs](https://supabase.com/docs)
- [React Best Practices](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)

---

**Última actualización**: 2025-09-30
**Autor**: SportMaps Team
