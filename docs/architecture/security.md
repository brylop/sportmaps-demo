# SportMaps - Guía de Seguridad

## 🔐 Sistema de Permisos (RBAC)

SportMaps implementa un sistema robusto de **Role-Based Access Control** que garantiza que cada usuario solo pueda acceder a las funcionalidades apropiadas para su rol.

### Roles del Sistema

| Rol | Descripción | Nivel de Acceso |
|-----|-------------|-----------------|
| `athlete` | Deportista | Básico - Solo datos propios |
| `parent` | Padre/Madre | Intermedio - Datos propios + hijos |
| `coach` | Entrenador | Avanzado - Gestión de equipos |
| `school` | Escuela | Completo - Gestión institucional |
| `wellness_professional` | Profesional Bienestar | Especializado - Salud atletas |
| `store_owner` | Dueño de Tienda | Comercial - Gestión productos |
| `admin` | Administrador | Total - Acceso completo |

## 📋 Matriz de Permisos

### Permisos por Recurso

#### Dashboard
- **athlete, parent, coach, school, wellness, store, admin**: `view`

#### Calendar
- **athlete, parent**: `view`
- **coach, wellness**: `view`, `create`, `edit`
- **school, admin**: `view`, `create`, `edit`, `delete`

#### Teams
- **athlete**: `view`
- **coach**: `view`, `create`, `edit`
- **school, admin**: `view`, `create`, `edit`, `delete`

#### Students
- **parent**: `view` (solo hijos)
- **coach, wellness**: `view`, `edit`
- **school, admin**: `view`, `create`, `edit`, `delete`

#### Stats
- **athlete, parent, coach, store**: `view`
- **school, admin**: `view`, `edit`

#### Reports
- **parent, coach, wellness, store**: `view`
- **coach, wellness, school, store, admin**: `create`

#### Finances
- **school, store**: `view`, `manage`
- **admin**: `view`, `manage`

#### Messages
- **todos**: `view`, `send`

#### Admin Panel
- **admin**: `users`, `system`, `all`

## 🛡️ Cómo Usar el Sistema de Permisos

### En Componentes

```tsx
import { PermissionGate } from '@/components/PermissionGate';

// Renderizar solo si tiene permiso
<PermissionGate permission="calendar:create">
  <Button onClick={createEvent}>Crear Evento</Button>
</PermissionGate>

// Renderizar solo si tiene rol específico
<PermissionGate roles={['admin', 'school']}>
  <AdminPanel />
</PermissionGate>

// Renderizar solo si tiene feature flag
<PermissionGate feature="canExportData">
  <ExportButton />
</PermissionGate>
```

### Con Hooks

```tsx
import { usePermissions } from '@/hooks/usePermissions';

function MyComponent() {
  const { can, hasFeature, hasRole } = usePermissions();

  if (!can('calendar:create')) {
    return <p>No tienes permiso para crear eventos</p>;
  }

  if (hasFeature('canExportData')) {
    // Mostrar botón de exportar
  }

  if (hasRole('admin', 'school')) {
    // Lógica específica para admin/school
  }
}
```

### En Rutas (App.tsx)

```tsx
<Route path="admin/users" element={
  <ProtectedRoute allowedRoles={['admin']}>
    <AdminUsersPage />
  </ProtectedRoute>
} />
```

## 🔒 Seguridad en el Backend (Supabase RLS)

### Row Level Security (RLS)

Todas las tablas tienen políticas RLS que garantizan:

1. **Aislamiento de datos por usuario**
```sql
CREATE POLICY "Users can view own profile"
ON spm_users FOR SELECT
USING (auth.uid() = id);
```

2. **Acceso público controlado para demos**
```sql
CREATE POLICY "Public can view demo users"
ON spm_users FOR SELECT
USING (email ~~ '%@sportmaps-demo.com');
```

3. **Permisos de escritura restrictivos**
```sql
CREATE POLICY "Users can update own profile"
ON spm_users FOR UPDATE
USING (auth.uid() = id);
```

### Funciones de Seguridad

```sql
-- Verificar si usuario tiene rol específico
CREATE OR REPLACE FUNCTION has_role(user_id uuid, required_role text)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM spm_users
    WHERE id = user_id AND role = required_role
  );
END;
$$ LANGUAGE plpgsql;
```

## 🚨 Auditoría y Logging

### Eventos Auditables

- Login/Logout
- Cambios de perfil
- Creación/Edición/Eliminación de datos sensibles
- Acceso a datos financieros
- Cambios administrativos

### Implementación (Futuro)

```typescript
// Log de auditoría
await auditLog({
  userId: user.id,
  action: 'delete_user',
  resource: 'users',
  resourceId: targetUserId,
  metadata: { reason: 'account_closed' }
});
```

## 🔐 Mejores Prácticas

### 1. Validación Cliente + Servidor

❌ **Incorrecto**: Solo validar en frontend
```tsx
if (userRole === 'admin') {
  deleteUser(); // INSEGURO
}
```

✅ **Correcto**: Validar en ambos lados
```tsx
// Frontend
if (can('admin:users')) {
  await deleteUser(); // Backend valida nuevamente
}

// Backend (Edge Function)
if (!hasPermission(userId, 'admin:users')) {
  throw new Error('Unauthorized');
}
```

### 2. Nunca Exponer Datos Sensibles

❌ **Incorrecto**:
```typescript
const allUsers = await supabase.from('users').select('*');
```

✅ **Correcto**:
```typescript
const users = await supabase
  .from('users')
  .select('id, name, email')
  .eq('id', auth.uid());
```

### 3. Usar PermissionGate para UI

❌ **Incorrecto**: Lógica condicional esparcida
```tsx
{profile.role === 'admin' || profile.role === 'school' ? <Button /> : null}
```

✅ **Correcto**: Componente centralizado
```tsx
<PermissionGate roles={['admin', 'school']}>
  <Button />
</PermissionGate>
```

### 4. Feature Flags para Funcionalidades Beta

```tsx
<PermissionGate feature="canAccessBetaFeatures">
  <NewFeatureComponent />
</PermissionGate>
```

## 🛡️ Checklist de Seguridad

Antes de desplegar a producción:

- [ ] Todas las tablas tienen RLS habilitado
- [ ] Políticas RLS implementadas y testeadas
- [ ] Validación de inputs en cliente y servidor
- [ ] No hay datos sensibles hardcodeados
- [ ] Contraseñas nunca logueadas o expuestas
- [ ] HTTPS en producción
- [ ] CORS configurado correctamente
- [ ] Rate limiting en API endpoints críticos
- [ ] Tokens JWT con expiración adecuada
- [ ] Sanitización de inputs para prevenir XSS
- [ ] Preparación de queries para prevenir SQL injection
- [ ] Auditoría de dependencias (npm audit)

## 📞 Reporte de Vulnerabilidades

Si encuentras una vulnerabilidad de seguridad:

1. **NO** abras un issue público
2. Envía un email a: security@sportmaps.com
3. Incluye:
   - Descripción detallada
   - Pasos para reproducir
   - Impacto potencial
   - Sugerencias de solución (opcional)

## 🔄 Actualizaciones de Seguridad

Este documento se actualiza cuando:
- Se agregan nuevos roles
- Se modifican permisos
- Se detectan vulnerabilidades
- Se implementan nuevas medidas de seguridad

---

**Última revisión**: 2025-09-30  
**Próxima auditoría**: 2025-12-30
