# SportMaps - Mejores Prácticas de Desarrollo

## 📐 Arquitectura de Código

### 1. **Separación de Responsabilidades**

✅ **Correcto**:
```
components/
├── dashboard/       # Componentes de negocio
│   ├── StatCard.tsx
│   └── ActivityList.tsx
├── ui/             # Componentes UI base
│   ├── button.tsx
│   └── card.tsx
└── PermissionGate.tsx  # Componentes utilitarios
```

❌ **Incorrecto**:
```
components/
└── AllComponentsHere.tsx  # 2000 líneas
```

### 2. **Componentes Pequeños y Enfocados**

✅ **Correcto** (Single Responsibility):
```tsx
// StatCard.tsx - Solo renderiza una tarjeta de estadística
export function StatCard({ title, value, icon }: StatCardProps) {
  return <Card>...</Card>;
}

// Dashboard.tsx - Compone varios StatCards
export function Dashboard() {
  return (
    <>
      <StatCard {...} />
      <StatCard {...} />
    </>
  );
}
```

❌ **Incorrecto** (God Component):
```tsx
export function Dashboard() {
  // 500 líneas de lógica + UI + estilos
  return <div>...</div>;
}
```

### 3. **Tipos Centralizados**

✅ **Correcto**:
```tsx
// types/dashboard.ts
export interface StatCardProps { ... }

// components/dashboard/StatCard.tsx
import { StatCardProps } from '@/types/dashboard';
```

❌ **Incorrecto**:
```tsx
// Definir tipos inline en cada archivo
interface Props { ... } // Duplicado en 10 archivos
```

## 🔐 Seguridad y Permisos

### 1. **Usar PermissionGate para UI Condicional**

✅ **Correcto**:
```tsx
<PermissionGate permission="calendar:create">
  <Button>Crear Evento</Button>
</PermissionGate>
```

❌ **Incorrecto**:
```tsx
{profile?.role === 'admin' || profile?.role === 'coach' ? 
  <Button>Crear</Button> : null}
```

**Razón**: Centraliza lógica, más fácil de mantener.

### 2. **Hook usePermissions para Lógica**

✅ **Correcto**:
```tsx
function MyComponent() {
  const { can, hasRole } = usePermissions();
  
  if (!can('dashboard:view')) {
    return <Navigate to="/unauthorized" />;
  }
  
  return <Dashboard />;
}
```

❌ **Incorrecto**:
```tsx
function MyComponent() {
  const { profile } = useAuth();
  
  if (profile.role !== 'admin' && profile.role !== 'coach') {
    return <Navigate to="/unauthorized" />;
  }
}
```

### 3. **Validación en Cliente Y Servidor**

✅ **Correcto**:
```tsx
// Frontend
if (can('users:delete')) {
  await deleteUser(id); // Backend también valida
}

// Backend (Edge Function)
export async function deleteUser(userId: string) {
  // Re-validar permisos
  if (!hasPermission(currentUser, 'users:delete')) {
    throw new Error('Unauthorized');
  }
  // Proceder con eliminación
}
```

## 🎨 Diseño y Estilos

### 1. **Usar Tokens Semánticos**

✅ **Correcto**:
```tsx
<div className="bg-primary text-primary-foreground">
  <Button variant="default">Acción</Button>
</div>
```

❌ **Incorrecto**:
```tsx
<div className="bg-green-600 text-white">
  <Button className="bg-green-700">Acción</Button>
</div>
```

**Razón**: Consistencia, temas, mantenibilidad.

### 2. **Componentes UI con Variantes**

✅ **Correcto**:
```tsx
// button.tsx
const buttonVariants = cva("...", {
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground",
      outline: "border border-primary",
      ghost: "hover:bg-accent"
    }
  }
});

// Uso
<Button variant="outline">Click</Button>
```

❌ **Incorrecto**:
```tsx
<button className="border-2 border-green-600 px-4 py-2 rounded-md hover:bg-green-50">
  Click
</button>
```

### 3. **Animaciones con Tailwind**

✅ **Correcto**:
```tsx
<div className="animate-in fade-in duration-500">
  <Card className="hover:scale-105 transition-transform">
    Content
  </Card>
</div>
```

❌ **Incorrecto**:
```tsx
<div style={{ 
  animation: 'fadeIn 0.5s',
  transition: 'all 0.3s'
}}>
  Content
</div>
```

## 🪝 Hooks y Estado

### 1. **Custom Hooks para Lógica Reutilizable**

✅ **Correcto**:
```tsx
// hooks/useDashboardConfig.ts
export function useDashboardConfig(role: UserRole) {
  return useMemo(() => {
    // Lógica compleja
  }, [role]);
}

// Uso en componente
const config = useDashboardConfig(userRole);
```

❌ **Incorrecto**:
```tsx
// Duplicar lógica en cada componente
function Dashboard() {
  const config = useMemo(() => {
    // 100 líneas de lógica
  }, []);
}
```

### 2. **useMemo para Cálculos Costosos**

✅ **Correcto**:
```tsx
const filteredData = useMemo(() => {
  return data.filter(/* complejo */).sort(/* costoso */);
}, [data, filters]);
```

❌ **Incorrecto**:
```tsx
// Recalcula en cada render
const filteredData = data.filter(...).sort(...);
```

### 3. **Estado Local vs Global**

✅ **Correcto**:
```tsx
// Estado global en Context
const { user, profile } = useAuth();

// Estado local en componente
const [isOpen, setIsOpen] = useState(false);
```

❌ **Incorrecto**:
```tsx
// Todo en Context (overkill)
const { user, profile, modalOpen, selectedDate, ... } = useAuth();
```

## 📁 Estructura de Archivos

### Organización Recomendada

```
src/
├── components/
│   ├── dashboard/        # Componentes de negocio
│   ├── ui/              # shadcn components
│   └── PermissionGate.tsx
├── config/
│   └── navigation.ts     # Configuración
├── contexts/
│   └── AuthContext.tsx   # Estado global
├── hooks/
│   ├── useDashboardConfig.ts
│   └── usePermissions.ts
├── lib/
│   ├── permissions.ts    # Lógica de negocio
│   └── utils.ts         # Utilidades
├── pages/
│   ├── DashboardPage.tsx
│   └── CalendarPage.tsx
├── types/
│   └── dashboard.ts      # Tipos TypeScript
└── layouts/
    └── AuthLayout.tsx
```

## 🧪 Testing (Futuro)

### Componentes Puros

✅ **Fácil de testear**:
```tsx
export function StatCard({ title, value }: StatCardProps) {
  return <Card>{title}: {value}</Card>;
}

// Test
it('renders correctly', () => {
  const { getByText } = render(
    <StatCard title="Test" value="100" />
  );
  expect(getByText('Test: 100')).toBeInTheDocument();
});
```

❌ **Difícil de testear**:
```tsx
export function StatCard() {
  const { data } = useComplexAPI();
  const config = useGlobalConfig();
  // Muchas dependencias
  return <Card>...</Card>;
}
```

## 📝 Convenciones de Código

### Nombres de Archivos

- **Componentes**: PascalCase (`StatCard.tsx`)
- **Hooks**: camelCase con prefijo `use` (`usePermissions.ts`)
- **Utilidades**: camelCase (`permissions.ts`)
- **Tipos**: PascalCase (`dashboard.ts` exporta `DashboardConfig`)
- **Constantes**: UPPER_SNAKE_CASE (`const API_URL`)

### Nombres de Variables

```tsx
// ✅ Descriptivos
const userPermissions = getPermissions(role);
const filteredEvents = events.filter(e => e.date > today);

// ❌ Crípticos
const up = getPerms(r);
const fe = events.filter(e => e.d > t);
```

### Orden de Imports

```tsx
// 1. React y librerías externas
import { useState } from 'react';
import { Link } from 'react-router-dom';

// 2. Componentes internos
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/dashboard/StatCard';

// 3. Hooks y utilidades
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/lib/permissions';

// 4. Tipos
import { UserRole } from '@/types/dashboard';

// 5. Iconos
import { Calendar, Users } from 'lucide-react';
```

## ⚡ Performance

### 1. **Lazy Loading de Rutas**

```tsx
const DashboardPage = lazy(() => import('./pages/DashboardPage'));

<Suspense fallback={<Loader />}>
  <DashboardPage />
</Suspense>
```

### 2. **Evitar Re-renders Innecesarios**

✅ **Correcto**:
```tsx
const MemoizedCard = memo(StatCard);

// Solo re-renderiza si props cambian
<MemoizedCard title="Stats" value={stats} />
```

### 3. **useCallback para Funciones en Props**

```tsx
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);

<Button onClick={handleClick}>Click</Button>
```

## 🚀 Deployment

### Pre-Deploy Checklist

- [ ] `npm run build` sin errores
- [ ] TypeScript sin errores (`tsc --noEmit`)
- [ ] Lint pasando (`npm run lint`)
- [ ] Variables de entorno configuradas
- [ ] RLS policies activadas
- [ ] Testing básico completado
- [ ] README actualizado

## 📚 Recursos

- [React Best Practices](https://react.dev)
- [TypeScript Handbook](https://typescriptlang.org/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Supabase Docs](https://supabase.com/docs)

---

**Mantener este documento actualizado con cada nueva práctica adoptada.**
