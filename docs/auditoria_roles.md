# Sistema de Auditoría y Roles por Sede — SportMaps

Este documento detalla la implementación del nuevo rol de Auditor (Reporter) y la lógica de administración jerárquica para escuelas con múltiples sedes.

## 1. El Rol de Auditor (Reporter)

El rol `reporter` (Súper Usuario de Auditoría) ha sido diseñado para personal administrativo o contable que requiere una visión global sin permisos de edición.

### Permisos y Restricciones
- **Lectura Total**: Acceso a dashboards financieros, reportes de asistencia y métricas globales.
- **Sin Edición**: No puede crear programas, eliminar estudiantes ni modificar configuraciones de la escuela.
- **Navegación Simplificada**: Su menú lateral está optimizado para la visualización de datos.

### Estructura de Navegación
```typescript
reporter: [
  {
    title: 'Auditoría',
    items: [
      { title: 'Dashboard', href: '/dashboard', icon: Home },
      { title: 'Reportes Globales', href: '/school-reports', icon: FileText },
      { title: 'Finanzas', href: '/finances', icon: DollarSign }
    ]
  },
  {
    title: 'Sistema',
    items: [
      { title: 'Notificaciones', href: '/notifications', icon: Bell },
      { title: 'Configuración', href: '/settings', icon: Settings }
    ]
  }
]
```

## 2. Administración por Sedes (Branches)

Se ha implementado una distinción clara entre administradores globales y locales.

### Tipos de Administrador
1. **Admin General (Global)**:
   - **Quiénes**: Dueños (`owner`) y Admins sin una `branch_id` específica.
   - **Badge**: "Admin General".
   - **Poder**: Puede crear/borrar sedes, ver reportes de todas las sedes y gestionar toda la escuela.

2. **Admin de Sede (Local)**:
   - **Quiénes**: Usuarios con rol `school_admin` vinculados a una `branch_id`.
   - **Badge**: "Admin Sede".
   - **Poder**: Su acceso está filtrado solo a los datos (estudiantes, pagos, programas) de su sede asignada.

## 3. Lógica de Invitación

El flujo de invitaciones ahora permite crear estos roles de forma proactiva:
- Al invitar a alguien como `reporter`, el sistema le asignará ese rol al registrarse.
- Si el Admin invita desde una sede activa, el nuevo usuario hereda esa restricción de sede.

## 4. Correcciones Técnicas Relacionadas
- **Defensa del Sidebar**: Se añadió un bloque `try-catch` alrededor de `useSidebar()` para prevenir errores de contexto si el componente se renderiza fuera de su proveedor.
- **Optimización de Interfaz**: Si una escuela solo tiene una sede, el selector de sedes se oculta automáticamente para simplificar la experiencia del usuario.
