import { useAuth } from '@/contexts/AuthContext';
import { 
  hasPermission, 
  canAccess, 
  hasFeature,
  Permission,
  Resource,
  Action
} from '@/lib/permissions';
import { UserRole } from '@/types/dashboard';

/**
 * Custom hook for checking user permissions
 * Provides easy access to permission checking in components
 */
export function usePermissions() {
  const { profile } = useAuth();
  const userRole = profile?.role as UserRole;

  return {
    /**
     * Check if user has a specific permission
     */
    can: (permission: Permission): boolean => {
      if (!userRole) return false;
      return hasPermission(userRole, permission);
    },

    /**
     * Check if user can perform an action on a resource
     */
    canAccess: (resource: Resource, action: Action): boolean => {
      if (!userRole) return false;
      return canAccess(userRole, resource, action);
    },

    /**
     * Check if a feature is enabled for the user
     */
    hasFeature: (feature: string): boolean => {
      if (!userRole) return false;
      return hasFeature(userRole, feature as any);
    },

    /**
     * Check if user is admin
     */
    isAdmin: (): boolean => {
      return userRole === 'admin';
    },

    /**
     * Check if user is in one of the specified roles
     */
    hasRole: (...roles: UserRole[]): boolean => {
      if (!userRole) return false;
      return roles.includes(userRole);
    },

    /**
     * Get current user role
     */
    role: userRole
  };
}

/**
 * Hook for conditional rendering based on permissions
 */
export function useConditionalRender() {
  const permissions = usePermissions();

  return {
    /**
     * Render component only if user has permission
     */
    renderIf: (permission: Permission, component: React.ReactNode): React.ReactNode => {
      return permissions.can(permission) ? component : null;
    },

    /**
     * Render component only if user has feature
     */
    renderIfFeature: (feature: string, component: React.ReactNode): React.ReactNode => {
      return permissions.hasFeature(feature) ? component : null;
    },

    /**
     * Render component only if user has role
     */
    renderIfRole: (roles: UserRole[], component: React.ReactNode): React.ReactNode => {
      return permissions.hasRole(...roles) ? component : null;
    }
  };
}
