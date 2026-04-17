# SportMaps - Guia de Seguridad

## Sistema de Permisos (RBAC)

SportMaps implementa un sistema robusto de **Role-Based Access Control** con tres capas de defensa:

1. **Base de Datos (RLS)** - Supabase Row Level Security
2. **Backend (BFF Middleware)** - Express middleware chain
3. **Frontend (UI Guards)** - ProtectedRoute + PermissionGate + routePermissions

### Principio de Menor Privilegio

**Denegacion por Defecto:** Si un permiso no esta explicitamente concedido a un rol, se asume que esta prohibido. Esto aplica en las tres capas.

---

## Roles del Sistema

| Rol | Descripcion | Nivel de Acceso |
|-----|-------------|-----------------|
| `athlete` | Deportista | Basico - Solo datos propios |
| `parent` | Padre/Madre | Intermedio - Datos propios + hijos |
| `coach` | Entrenador | Avanzado - Gestion de equipos |
| `school` | Escuela (owner) | Completo - Gestion institucional |
| `school_admin` | Admin de sede | Completo - Gestion de una sede |
| `staff` | Staff operativo | Operativo - Permisos basicos de la escuela |
| `personal_trainer` | Entrenador personal | Independiente - Workspace propio |
| `wellness_professional` | Profesional Bienestar | Especializado - Salud atletas |
| `store_owner` | Dueno de Tienda | Comercial - Gestion productos |
| `organizer` | Organizador de eventos | Eventos - CRUD de competencias |
| `reporter` | Reportero | Lectura - Reportes y estadisticas |
| `admin` / `super_admin` / `owner` | Administrador | Total - Acceso completo |

### Jerarquia de Roles Privilegiados

```
owner / super_admin / admin
  └── Pasan SIEMPRE requireRole() sin necesidad de estar listados
  └── PRIVILEGED_CONTEXT_ROLES en ProtectedRoute: bypass de restriccion de ruta
```

---

## Capa 1: Base de Datos (RLS)

### Funcion Helper Central

```sql
-- Retorna los school_ids donde el usuario tiene membresía activa
CREATE FUNCTION public.user_school_ids() RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE(ARRAY_AGG(school_id), ARRAY[]::uuid[])
     FROM public.school_members
     WHERE profile_id = auth.uid() AND status = 'active'; $$;
```

### Patron RLS por Tipo de Tabla

| Tipo | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| **Escolar** (children, payments, enrollments) | `school_id IN user_school_ids() OR parent_id = auth.uid()` | Staff de escuela (owner/admin/coach) | Staff o padre | Solo admin |
| **Personal** (carts, notifications) | `user_id = auth.uid()` | `user_id = auth.uid()` | `user_id = auth.uid()` | `user_id = auth.uid()` |
| **Publica** (schools, events, programs) | `USING (true)` | Creador verificado | Solo creador | Solo creador + estado valido |
| **Auditoria** (security_audit_log) | Solo admin/super_admin | Authenticated (triggers) | Prohibido | Prohibido |

### Prevencion de Escalada de Privilegios (Phase 2)

```sql
-- Trigger: Bloquea que un usuario cambie su propio role o role_id
CREATE TRIGGER trg_prevent_role_escalation
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_role_self_escalation();

-- Trigger: Impide eliminar al ultimo owner de una escuela
CREATE TRIGGER trg_prevent_last_owner_removal
    BEFORE UPDATE ON public.school_members
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_last_owner_removal();
```

### Auditoria de Seguridad

Tabla `security_audit_log` registra automaticamente:
- Cambios de rol en `profiles` y `school_members`
- Adicion/eliminacion de miembros
- Acciones sensibles via `auditLog()` en el BFF

---

## Capa 2: Backend (BFF Middleware)

### Middleware Chain

```
Request → requireBasicAuth/requireAuth → requireRole → requirePermission → requireOwnership → Handler
```

### Middlewares Disponibles

| Middleware | Proposito | Ejemplo |
|-----------|-----------|---------|
| `requireBasicAuth` | Solo valida que existe Bearer token, sin contexto de escuela | Favoritos (`/api/favoritos`) |
| `requireAuth` | Valida JWT + busca school_members + popula schoolId/role | Todas las rutas de escuela |
| `requireMarketplaceAuth` | Valida JWT + lee rol desde `profiles` (no school_members) | Rutas de vendedor (`/api/v1/vendor`) |
| `requireTrainerAuth` | Valida JWT + busca workspace `personal_trainer` en schools | Rutas de trainer (`/api/v1/trainer`) |
| `optionalAuth` | No falla sin token. Si hay token, popula req.user | Marketplace publico (`/api/v1/marketplace`) |
| `requireRole(...roles)` | Verifica rol del usuario. Privilegiados siempre pasan | `requireRole('owner', 'admin', 'coach')` |
| `requirePermission(...perms)` | Valida contra matriz de permisos | `requirePermission('students:create')` |
| `requireOwnership(table, param, field)` | Previene IDOR | `requireOwnership('children', 'id', 'school_id')` |
| `auditLog(req, action, ...)` | Registra accion en audit log (non-blocking) | `await auditLog(req, 'payment_create', ...)` |

### Ejemplo: Proteger un endpoint contra IDOR

```typescript
// ANTES (vulnerable a IDOR):
router.get('/:id', requireAuth, requireRole('school'), handler);

// DESPUES (con ownership check):
router.get('/:id', requireAuth, requireRole('school'),
    requireOwnership('children', 'id', 'school_id'), handler);
```

### Matriz de Permisos (Backend)

El BFF mantiene una copia **identica** de la matriz de permisos del frontend en `authMiddleware.ts`. Esto permite validar permisos en el backend sin depender solo de roles:

```typescript
// Valida que el usuario tiene permiso de crear estudiantes
router.post('/students', requireAuth, requirePermission('students:create'), handler);
```

---

## Capa 3: Frontend (UI Guards)

### 1. ProtectedRoute (Ruta completa)

```tsx
<Route path="students" element={
  <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin', 'super_admin', 'coach']}>
    <SchoolStudentsManagementPage />
  </ProtectedRoute>
} />
```

### 2. PermissionGate (Componentes individuales)

```tsx
<PermissionGate permission="calendar:create">
  <Button>Crear Evento</Button>
</PermissionGate>

<PermissionGate roles={['admin', 'school']}>
  <AdminPanel />
</PermissionGate>
```

### 3. usePermissions Hook

```tsx
const { can, hasFeature, hasRole, isAdmin } = usePermissions();

if (can('finances:manage')) { /* mostrar seccion financiera */ }
if (hasFeature('canExportData')) { /* mostrar boton exportar */ }
```

### 4. Route Permission Map (`routePermissions.ts`)

Single Source of Truth para mapeo ruta → roles + permisos:

```typescript
import { getRoutePermission, isPublicRoute } from '@/config/routePermissions';

const config = getRoutePermission('/students');
// → { allowedRoles: ['school', 'admin', ...], requiredPermission: 'students:view' }
```

---

## Matriz de Permisos Completa

### Permisos por Recurso

| Recurso | athlete | parent | coach | school | organizer | admin |
|---------|---------|--------|-------|--------|-----------|-------|
| dashboard:view | Y | Y | Y | Y | Y | Y |
| calendar:view | Y | Y | Y | Y | Y | Y |
| calendar:create | - | - | Y | Y | Y | Y |
| teams:view | Y | - | Y | Y | - | Y |
| teams:create | - | - | Y | Y | - | Y |
| students:view | - | Y | Y | Y | - | Y |
| students:create | - | - | - | Y | - | Y |
| stats:view | Y | Y | Y | Y | Y | Y |
| reports:view | - | Y | Y | Y | Y | Y |
| finances:view | - | - | - | Y | Y | Y |
| finances:manage | - | - | - | Y | Y | Y |
| events:view | Y | Y | Y | Y | Y | Y |
| events:create | - | - | - | - | Y | Y |
| events:edit | - | - | - | - | Y | Y |
| events:delete | - | - | - | - | Y | Y |
| admin:all | - | - | - | - | - | Y |

### Feature Flags

| Feature | athlete | parent | coach | school | organizer | admin |
|---------|---------|--------|-------|--------|-----------|-------|
| canCreateEvents | - | - | Y | Y | Y | Y |
| canManageTeams | - | - | Y | Y | - | Y |
| canViewFinances | - | Y | - | Y | Y | Y |
| canAccessAdmin | - | - | - | - | - | Y |
| canExportData | - | - | Y | Y | Y | Y |

---

## Multitenancy (Aislamiento por Escuela)

### Flujo de Aislamiento

```
Frontend → bffClient.setSchoolId(activeSchoolId)
  → Header: x-school-id
    → BFF requireAuth: valida school_members + popula req.schoolId
      → Todas las queries: .eq('school_id', req.schoolId)
        → RLS: school_id IN user_school_ids()
```

### Tabla Pivote: school_members

```sql
school_members (
    profile_id  → auth.users.id
    school_id   → schools.id
    branch_id   → school_branches.id (nullable = acceso global)
    role        → 'owner' | 'admin' | 'coach' | 'athlete' | 'parent' | 'staff'
    status      → 'active' | 'inactive' | 'pending'
)
```

---

## Validaciones de Seguridad

### Tipo de Validacion

| Capa | Validacion | Ejemplo de Ataque que Previene |
|------|-----------|-------------------------------|
| **Auth Check** | Token JWT valido | Sesion expirada que accede datos cacheados |
| **Role Check** | Rol correcto para la ruta | Vendedor entrando a `/dashboard-contable` |
| **Permission Check** | Permiso especifico | Coach intentando borrar un equipo (`teams:delete`) |
| **Ownership Check** | Recurso pertenece a su escuela | Cambiar ID en URL: `/students/100` → `/students/101` |
| **Escalation Check** | No puede cambiar su propio rol | `UPDATE profiles SET role = 'admin'` |
| **Last Owner Check** | No eliminar ultimo owner | Dejar escuela sin administrador |

---

## Mejores Practicas

### 1. Validacion Cliente + Servidor

```tsx
// Frontend: oculta el boton
<PermissionGate permission="admin:users">
  <Button onClick={deleteUser}>Eliminar</Button>
</PermissionGate>

// BFF: valida nuevamente
router.delete('/users/:id',
  requireAuth,
  requireRole('admin'),
  requirePermission('admin:users'),
  requireOwnership('profiles', 'id', 'school_id'),
  handler
);

// DB: RLS como ultima linea de defensa
```

### 2. Usar PermissionGate en lugar de condicionales

```tsx
// MAL:
{profile.role === 'admin' || profile.role === 'school' ? <Button /> : null}

// BIEN:
<PermissionGate roles={['admin', 'school']}><Button /></PermissionGate>
```

### 3. Siempre filtrar por schoolId en el BFF

```typescript
// MAL (IDOR vulnerable):
const { data } = await supabase.from('children').select('*').eq('id', req.params.id);

// BIEN:
const { data } = await supabase.from('children').select('*')
  .eq('id', req.params.id)
  .eq('school_id', req.schoolId); // Siempre filtrar
```

### 4. Auditar acciones sensibles

```typescript
await auditLog(req, 'payment_create', 'payments', newPayment.id, null, { amount, concept });
```

---

## Checklist de Seguridad

- [x] Todas las tablas tienen RLS habilitado
- [x] Politicas RLS implementadas para todas las tablas core
- [x] Prevencion de escalada de privilegios (trigger en profiles)
- [x] Proteccion del ultimo owner (trigger en school_members)
- [x] Tabla de auditoria general (security_audit_log)
- [x] Triggers de auditoria en tablas sensibles
- [x] Middleware de ownership (IDOR prevention)
- [x] Middleware de permisos (mirror del frontend)
- [x] Route permission map (Single Source of Truth)
- [x] Rate limiting en API endpoints
- [x] CORS configurado correctamente
- [x] Cache-Control headers (no-store)
- [x] Validacion de inputs con Zod
- [x] JWT con auto-refresh
- [ ] Rate limiting por usuario (no solo por IP)
- [ ] Audit log de login/logout
- [ ] Alertas de actividad sospechosa

---

**Ultima revision**: 2026-04-17
**Proxima auditoria**: 2026-07-15
