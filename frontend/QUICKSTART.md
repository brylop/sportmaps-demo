# 🚀 SportMaps - Guía Rápida

## Inicio en 5 Minutos

### 1. Login Demo Rápido

Accede con usuarios pre-configurados desde la página de login:

**Padre/Madre**: `padre@sportmaps-demo.com`
**Entrenador**: `entrenador@sportmaps-demo.com`
**Escuela**: `escuela@sportmaps-demo.com`
**Deportista**: `deportista@sportmaps-demo.com`

Contraseña para todos: `DemoSportMaps2024!`

### 2. Explorar Dashboards por Rol

Cada rol tiene un dashboard único:

- **Deportista**: Stats personales, equipos, calendario
- **Padre**: Seguimiento de hijos, asistencias, pagos
- **Entrenador**: Gestión de equipos, resultados, reportes
- **Escuela**: Gestión completa, finanzas, programas

### 3. Navegar por Módulos

**Menú lateral izquierdo** → Rutas organizadas por categorías:
- Principal (Dashboard, Calendario, Notificaciones)
- Rendimiento/Gestión (según rol)
- Comunidad/Admin

### 4. Funcionalidades Clave

#### Dashboard
- Ver stats principales
- Próximas actividades
- Acciones rápidas

#### Calendario
- Ver eventos del mes
- Crear eventos (solo con permisos)
- Filtrar por fecha

#### Equipos
- Ver tus equipos
- Stats y resultados
- Próximos partidos

#### Estadísticas
- Gráficos de rendimiento
- Métricas físicas
- Forma reciente

#### Mensajes
- Chat con contactos
- Conversaciones grupales
- Estados online/offline

#### Notificaciones
- Ver todas las notificaciones
- Filtrar no leídas
- Marcar como leídas

#### Configuración
- Editar perfil
- Preferencias de notificaciones
- Privacidad y seguridad

## 🎯 Casos de Uso Comunes

### Como Deportista
1. Ver mi dashboard
2. Revisar próximos entrenamientos en calendario
3. Ver stats personales
4. Chatear con entrenador
5. Revisar notificaciones

### Como Entrenador
1. Ver todos mis equipos
2. Crear evento de entrenamiento
3. Registrar resultado de partido
4. Enviar mensaje al equipo
5. Ver reportes de asistencia

### Como Padre
1. Ver actividades de mis hijos
2. Confirmar asistencia
3. Revisar pagos pendientes
4. Chatear con entrenador
5. Ver progreso académico

### Como Escuela
1. Dashboard con métricas generales
2. Gestionar estudiantes y entrenadores
3. Ver finanzas y reportes
4. Crear programas deportivos
5. Administrar instalaciones

## 🛠️ Desarrollo

### Agregar Nueva Página

```typescript
// 1. Crear archivo
// src/pages/MyPage.tsx
export default function MyPage() {
  return <div>Content</div>;
}

// 2. Agregar ruta en App.tsx
<Route path="my-page" element={<MyPage />} />

// 3. Agregar al sidebar (navigation.ts)
{ title: 'Mi Página', href: '/my-page', icon: Star }
```

### Usar Permisos

```tsx
import { PermissionGate } from '@/components/PermissionGate';

<PermissionGate permission="teams:create">
  <Button>Crear Equipo</Button>
</PermissionGate>
```

### Usar Config por Rol

```tsx
import { useDashboardConfig } from '@/hooks/useDashboardConfig';

const config = useDashboardConfig(userRole);
// Usa config.stats, config.activities, etc.
```

## 📚 Recursos Importantes

- **Arquitectura**: Ver `ARCHITECTURE.md`
- **Seguridad**: Ver `SECURITY.md`
- **Mejores Prácticas**: Ver `BEST_PRACTICES.md`
- **Dev Guide**: Ver `README_DEV.md`

## 🐛 Problemas Comunes

### No puedo ver mis datos
→ Verificar RLS policies en Supabase

### Error de permisos
→ Verificar rol del usuario en `useAuth()`

### Build error
→ `npm install` y `npm run build`

### TypeScript error
→ Verificar imports y tipos

## 💡 Tips Rápidos

1. **Usa snippets**: Los componentes están diseñados para copy-paste
2. **Reutiliza hooks**: `usePermissions()`, `useDashboardConfig()`
3. **Sigue convenciones**: Archivos PascalCase, variables camelCase
4. **Usa design tokens**: No colores directos, usa CSS variables
5. **Documenta cambios**: Actualiza README si modificas arquitectura

## 🚀 Deploy

```bash
# Build
npm run build

# Preview local
npm run preview

# Deploy (automático en Lovable)
git push
```

---

**¿Necesitas ayuda?** Ver documentación completa en `/docs`
