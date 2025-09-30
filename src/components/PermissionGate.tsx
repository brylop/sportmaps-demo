import { usePermissions } from '@/hooks/usePermissions';
import { Permission } from '@/lib/permissions';
import { UserRole } from '@/types/dashboard';

interface PermissionGateProps {
  children: React.ReactNode;
  permission?: Permission;
  roles?: UserRole[];
  feature?: string;
  fallback?: React.ReactNode;
}

/**
 * Component that conditionally renders children based on permissions
 * 
 * @example
 * ```tsx
 * <PermissionGate permission="calendar:create">
 *   <Button>Crear Evento</Button>
 * </PermissionGate>
 * ```
 */
export function PermissionGate({ 
  children, 
  permission, 
  roles, 
  feature,
  fallback = null 
}: PermissionGateProps) {
  const permissions = usePermissions();

  // Check permission if provided
  if (permission && !permissions.can(permission)) {
    return <>{fallback}</>;
  }

  // Check roles if provided
  if (roles && !permissions.hasRole(...roles)) {
    return <>{fallback}</>;
  }

  // Check feature if provided
  if (feature && !permissions.hasFeature(feature)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
