# SportMaps - Guía de Desarrollo

## 🚀 Inicio Rápido

```bash
# Instalar dependencias
npm install

# Iniciar desarrollo
npm run dev

# Build para producción
npm run build

# Preview de producción
npm run preview
```

## 📁 Estructura del Proyecto

```
sportmaps/
├── src/
│   ├── components/          # Componentes reutilizables
│   │   ├── dashboard/      # Componentes específicos de dashboard
│   │   ├── ui/             # Componentes base (shadcn)
│   │   ├── AppSidebar.tsx  # Navegación lateral
│   │   └── PermissionGate.tsx
│   ├── config/             # Configuración
│   │   └── navigation.ts   # Rutas por rol
│   ├── contexts/           # React Contexts
│   │   └── AuthContext.tsx # Autenticación
│   ├── hooks/              # Custom Hooks
│   │   ├── useDashboardConfig.ts
│   │   ├── usePermissions.ts
│   │   └── use-toast.ts
│   ├── layouts/            # Layouts compartidos
│   │   └── AuthLayout.tsx
│   ├── lib/                # Utilidades y lógica
│   │   ├── permissions.ts  # Sistema RBAC
│   │   ├── utils.ts
│   │   └── supabase.ts
│   ├── pages/              # Páginas de la aplicación
│   │   ├── DashboardPage.tsx
│   │   ├── CalendarPage.tsx
│   │   ├── TeamsPage.tsx
│   │   ├── StatsPage.tsx
│   │   ├── MessagesPage.tsx
│   │   ├── NotificationsPage.tsx
│   │   ├── SettingsPage.tsx
│   │   └── LoginPage.tsx
│   ├── types/              # Definiciones TypeScript
│   │   └── dashboard.ts
│   ├── App.tsx             # Configuración de rutas
│   ├── index.css           # Design system tokens
│   └── main.tsx           # Entry point
├── public/                 # Assets estáticos
├── supabase/              # Configuración Supabase
│   └── migrations/        # Migraciones SQL
└── docs/                  # Documentación
    ├── ARCHITECTURE.md    # Arquitectura
    ├── SECURITY.md        # Seguridad
    ├── BEST_PRACTICES.md  # Mejores prácticas
    └── PHASE_2_STATUS.md  # Estado del proyecto
```

## 🎨 Design System

### Colores Semánticos

Todos los colores se definen en `src/index.css`:

```css
:root {
  --primary: 147 96% 33%;      /* Verde esmeralda #04A462 */
  --primary-glow: 147 85% 45%; /* Verde claro */
  --secondary: 147 20% 95%;    /* Fondo suave */
  --accent: 147 79% 95%;       /* Acentos */
  --muted: 147 25% 95%;        /* Tonos apagados */
  --destructive: 0 84% 60%;    /* Rojo para errores */
}
```

### Uso en Componentes

```tsx
// ✅ Correcto - Usar tokens semánticos
<div className="bg-primary text-primary-foreground">
  <Button variant="default">Acción</Button>
</div>

// ❌ Incorrecto - Colores directos
<div className="bg-green-600 text-white">
  <Button>Acción</Button>
</div>
```

### Gradientes Predefinidos

```css
--gradient-hero: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)));
--gradient-performance: linear-gradient(45deg, hsl(var(--primary)), hsl(var(--secondary)));
```

## 🔐 Sistema de Permisos

### Roles Disponibles

```typescript
type UserRole = 
  | 'athlete'              // Deportista
  | 'parent'               // Padre/Madre
  | 'coach'                // Entrenador
  | 'school'               // Escuela
  | 'wellness_professional' // Profesional de bienestar
  | 'store_owner'          // Dueño de tienda
  | 'admin';               // Administrador
```

### Uso de Permisos

#### En Componentes

```tsx
import { PermissionGate } from '@/components/PermissionGate';

// Renderizar solo con permiso
<PermissionGate permission="calendar:create">
  <Button>Crear Evento</Button>
</PermissionGate>

// Renderizar solo para roles específicos
<PermissionGate roles={['admin', 'school']}>
  <AdminPanel />
</PermissionGate>
```

#### Con Hooks

```tsx
import { usePermissions } from '@/hooks/usePermissions';

function MyComponent() {
  const { can, hasRole, hasFeature } = usePermissions();

  if (!can('teams:create')) {
    return <p>Sin permiso</p>;
  }

  return (
    <>
      <Button>Crear Equipo</Button>
      {hasRole('admin') && <AdminTools />}
    </>
  );
}
```

## 📄 Crear Nuevas Páginas

### 1. Crear el Archivo

```tsx
// src/pages/MyNewPage.tsx
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

export default function MyNewPage() {
  const { profile } = useAuth();
  const { can } = usePermissions();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <h1 className="text-3xl font-bold">Mi Nueva Página</h1>
      {/* Contenido */}
    </div>
  );
}
```

### 2. Agregar Ruta en App.tsx

```tsx
import MyNewPage from "./pages/MyNewPage";

// En Routes
<Route path="my-new-page" element={<MyNewPage />} />

// O con protección por rol
<Route path="admin/my-page" element={
  <ProtectedRoute allowedRoles={['admin']}>
    <MyNewPage />
  </ProtectedRoute>
} />
```

### 3. Agregar al Sidebar (navigation.ts)

```tsx
// src/config/navigation.ts
export function getNavigationByRole(role: UserRole): NavGroup[] {
  return {
    // ...
    athlete: [
      {
        title: 'Principal',
        items: [
          // ...
          { title: 'Mi Nueva Página', href: '/my-new-page', icon: Star }
        ]
      }
    ]
  };
}
```

## 🎯 Componentes Reutilizables

### StatCard

```tsx
import { StatCard } from '@/components/dashboard/StatCard';

<StatCard
  title="Total Equipos"
  value={24}
  description="+12% vs mes pasado"
  icon={Users}
  trend={{ value: '+12%', positive: true }}
/>
```

### ActivityList

```tsx
import { ActivityList } from '@/components/dashboard/ActivityList';

const activities = [
  {
    id: '1',
    title: 'Entrenamiento',
    subtitle: 'Cancha Principal',
    time: 'Hoy 4:00 PM',
    icon: Clock,
    variant: 'primary'
  }
];

<ActivityList title="Próximas Actividades" activities={activities} />
```

### PermissionGate

```tsx
<PermissionGate permission="calendar:create">
  <CreateEventButton />
</PermissionGate>
```

## 🔧 Hooks Personalizados

### useDashboardConfig

Retorna configuración del dashboard según rol:

```tsx
const config = useDashboardConfig('athlete');
// config.stats, config.activities, config.quickActions
```

### usePermissions

Verifica permisos del usuario:

```tsx
const { can, hasRole, hasFeature } = usePermissions();

if (can('teams:delete')) {
  // Usuario puede eliminar equipos
}
```

## 🎨 Animaciones

### Animaciones CSS Predefinidas

```tsx
// Fade in
<div className="animate-in fade-in duration-500">

// Slide in
<div className="animate-in slide-in-from-bottom">

// Scale
<div className="hover:scale-105 transition-transform">

// Stagger animations
{items.map((item, i) => (
  <div
    key={item.id}
    className="animate-in slide-in-from-left"
    style={{ animationDelay: `${i * 50}ms` }}
  />
))}
```

## 🧪 Testing (Futuro)

### Estructura de Tests

```
src/
├── components/
│   └── StatCard.test.tsx
├── hooks/
│   └── usePermissions.test.tsx
└── lib/
    └── permissions.test.ts
```

### Ejemplo de Test

```tsx
import { render, screen } from '@testing-library/react';
import { StatCard } from '@/components/dashboard/StatCard';

describe('StatCard', () => {
  it('renders correctly', () => {
    render(
      <StatCard
        title="Test"
        value={100}
        icon={Users}
      />
    );
    
    expect(screen.getByText('Test')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });
});
```

## 🗄️ Supabase

### Cliente Supabase

```tsx
import { supabase } from '@/integrations/supabase/client';

// Consultas
const { data, error } = await supabase
  .from('teams')
  .select('*')
  .eq('coach_id', userId);

// Inserciones
const { data, error } = await supabase
  .from('teams')
  .insert({ name: 'Nuevo Equipo', coach_id: userId });
```

### RLS Policies

Todas las tablas tienen Row Level Security habilitado:

```sql
-- Los usuarios solo ven sus propios datos
CREATE POLICY "Users can view own data"
ON teams FOR SELECT
USING (auth.uid() = coach_id);
```

## 📝 Convenciones de Código

### Archivos

- Componentes: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Utilidades: `camelCase.ts`
- Tipos: `camelCase.ts` (exports PascalCase)

### Variables

```tsx
// ✅ Descriptivo
const userPermissions = getPermissions(role);
const filteredTeams = teams.filter(t => t.active);

// ❌ Críptico
const up = getPerms(r);
const ft = teams.filter(t => t.a);
```

### Imports

```tsx
// 1. React y librerías
import { useState } from 'react';
import { Link } from 'react-router-dom';

// 2. Componentes internos
import { Button } from '@/components/ui/button';

// 3. Hooks
import { useAuth } from '@/contexts/AuthContext';

// 4. Tipos
import { UserRole } from '@/types/dashboard';

// 5. Iconos
import { Calendar } from 'lucide-react';
```

## 🚀 Deployment

### Preparar para Producción

```bash
# 1. Verificar tipos
npm run type-check

# 2. Build
npm run build

# 3. Preview local
npm run preview

# 4. Deploy (automático en Lovable)
git push
```

### Checklist Pre-Deploy

- [ ] `npm run build` sin errores
- [ ] TypeScript sin errores
- [ ] Todas las RLS policies activas
- [ ] Variables de entorno configuradas
- [ ] README actualizado

## 🔗 Enlaces Útiles

- [Arquitectura](./ARCHITECTURE.md)
- [Seguridad](./SECURITY.md)
- [Mejores Prácticas](./BEST_PRACTICES.md)
- [Estado Fase 2](./PHASE_2_STATUS.md)

## 🆘 Problemas Comunes

### Build Errors

**Error**: `Module not found`
```bash
# Limpiar y reinstalar
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Errors

**Error**: Type errors en componentes
```bash
# Verificar tipos
npm run type-check

# Regenerar tipos de Supabase
# (automático en Lovable)
```

### Supabase RLS

**Error**: No puedo ver mis datos
- Verificar políticas RLS en Supabase
- Confirmar que `auth.uid()` coincide con user_id

## 📞 Soporte

- **Issues**: Abrir ticket en proyecto
- **Docs**: [Lovable Docs](https://docs.lovable.dev)
- **Community**: [Lovable Discord](https://discord.gg/lovable)

---

**Última actualización**: 2025-09-30
