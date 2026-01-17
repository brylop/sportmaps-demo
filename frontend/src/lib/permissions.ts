/**
 * Role-Based Access Control (RBAC) System
 * Centralizes all permission logic for SportMaps
 */

import { UserRole } from '@/types/dashboard';

export type Permission = 
  | 'dashboard:view'
  | 'calendar:view' | 'calendar:create' | 'calendar:edit' | 'calendar:delete'
  | 'teams:view' | 'teams:create' | 'teams:edit' | 'teams:delete'
  | 'students:view' | 'students:create' | 'students:edit' | 'students:delete'
  | 'stats:view' | 'stats:edit'
  | 'reports:view' | 'reports:create'
  | 'finances:view' | 'finances:manage'
  | 'messages:view' | 'messages:send'
  | 'settings:view' | 'settings:edit'
  | 'admin:users' | 'admin:system' | 'admin:all';

export type Resource = 
  | 'dashboard'
  | 'calendar'
  | 'teams'
  | 'students'
  | 'stats'
  | 'reports'
  | 'finances'
  | 'messages'
  | 'settings'
  | 'admin';

export type Action = 'view' | 'create' | 'edit' | 'delete' | 'manage' | 'all';

/**
 * Role-Permission Matrix
 * Defines what each role can do
 */
const rolePermissions: Record<UserRole, Permission[]> = {
  athlete: [
    'dashboard:view',
    'calendar:view',
    'teams:view',
    'stats:view',
    'messages:view',
    'messages:send',
    'settings:view',
    'settings:edit'
  ],
  
  parent: [
    'dashboard:view',
    'calendar:view',
    'students:view',
    'stats:view',
    'reports:view',
    'messages:view',
    'messages:send',
    'settings:view',
    'settings:edit'
  ],
  
  coach: [
    'dashboard:view',
    'calendar:view',
    'calendar:create',
    'calendar:edit',
    'calendar:delete',
    'teams:view',
    'teams:create',
    'teams:edit',
    'students:view',
    'students:edit',
    'stats:view',
    'stats:edit',
    'reports:view',
    'reports:create',
    'messages:view',
    'messages:send',
    'settings:view',
    'settings:edit'
  ],
  
  school: [
    'dashboard:view',
    'calendar:view',
    'calendar:create',
    'calendar:edit',
    'calendar:delete',
    'teams:view',
    'teams:create',
    'teams:edit',
    'teams:delete',
    'students:view',
    'students:create',
    'students:edit',
    'students:delete',
    'stats:view',
    'stats:edit',
    'reports:view',
    'reports:create',
    'finances:view',
    'finances:manage',
    'messages:view',
    'messages:send',
    'settings:view',
    'settings:edit'
  ],
  
  wellness_professional: [
    'dashboard:view',
    'calendar:view',
    'calendar:create',
    'students:view',
    'students:edit',
    'reports:view',
    'reports:create',
    'messages:view',
    'messages:send',
    'settings:view',
    'settings:edit'
  ],
  
  store_owner: [
    'dashboard:view',
    'calendar:view',
    'stats:view',
    'reports:view',
    'reports:create',
    'finances:view',
    'finances:manage',
    'messages:view',
    'messages:send',
    'settings:view',
    'settings:edit'
  ],
  
  organizer: [
    'dashboard:view',
    'calendar:view',
    'calendar:create',
    'calendar:edit',
    'calendar:delete',
    'stats:view',
    'reports:view',
    'reports:create',
    'messages:view',
    'messages:send',
    'settings:view',
    'settings:edit'
  ],
  
  admin: [
    'dashboard:view',
    'calendar:view',
    'calendar:create',
    'calendar:edit',
    'calendar:delete',
    'teams:view',
    'teams:create',
    'teams:edit',
    'teams:delete',
    'students:view',
    'students:create',
    'students:edit',
    'students:delete',
    'stats:view',
    'stats:edit',
    'reports:view',
    'reports:create',
    'finances:view',
    'finances:manage',
    'messages:view',
    'messages:send',
    'settings:view',
    'settings:edit',
    'admin:users',
    'admin:system',
    'admin:all'
  ]
};

/**
 * Check if a user has a specific permission
 */
export function hasPermission(userRole: UserRole, permission: Permission): boolean {
  const permissions = rolePermissions[userRole];
  return permissions.includes(permission);
}

/**
 * Check if a user can perform an action on a resource
 */
export function canAccess(userRole: UserRole, resource: Resource, action: Action): boolean {
  const permission = `${resource}:${action}` as Permission;
  return hasPermission(userRole, permission);
}

/**
 * Get all permissions for a role
 */
export function getPermissions(userRole: UserRole): Permission[] {
  return rolePermissions[userRole];
}

/**
 * Check if user has any of the provided permissions (OR logic)
 */
export function hasAnyPermission(userRole: UserRole, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(userRole, permission));
}

/**
 * Check if user has all of the provided permissions (AND logic)
 */
export function hasAllPermissions(userRole: UserRole, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(userRole, permission));
}

/**
 * Feature flags by role
 * Controls visibility of UI features
 */
export const featureFlags: Record<UserRole, Record<string, boolean>> = {
  athlete: {
    canCreateEvents: false,
    canManageTeams: false,
    canViewFinances: false,
    canAccessAdmin: false,
    canExportData: false
  },
  parent: {
    canCreateEvents: false,
    canManageTeams: false,
    canViewFinances: true,
    canAccessAdmin: false,
    canExportData: false
  },
  coach: {
    canCreateEvents: true,
    canManageTeams: true,
    canViewFinances: false,
    canAccessAdmin: false,
    canExportData: true
  },
  school: {
    canCreateEvents: true,
    canManageTeams: true,
    canViewFinances: true,
    canAccessAdmin: false,
    canExportData: true
  },
  wellness_professional: {
    canCreateEvents: true,
    canManageTeams: false,
    canViewFinances: false,
    canAccessAdmin: false,
    canExportData: true
  },
  store_owner: {
    canCreateEvents: false,
    canManageTeams: false,
    canViewFinances: true,
    canAccessAdmin: false,
    canExportData: true
  },
  admin: {
    canCreateEvents: true,
    canManageTeams: true,
    canViewFinances: true,
    canAccessAdmin: true,
    canExportData: true
  }
};

/**
 * Check if a feature is enabled for a role
 */
export function hasFeature(userRole: UserRole, feature: keyof typeof featureFlags[UserRole]): boolean {
  return featureFlags[userRole]?.[feature] ?? false;
}

/**
 * Data visibility rules
 * Defines what data each role can see
 */
export const dataVisibility = {
  athlete: {
    canSeeOwnData: true,
    canSeeTeamData: true,
    canSeeAllStudents: false,
    canSeeFinancialData: false,
    canSeeSystemLogs: false
  },
  parent: {
    canSeeOwnData: true,
    canSeeChildrenData: true,
    canSeeTeamData: true,
    canSeeAllStudents: false,
    canSeeFinancialData: false,
    canSeeSystemLogs: false
  },
  coach: {
    canSeeOwnData: true,
    canSeeTeamData: true,
    canSeeAllStudents: true,
    canSeeFinancialData: false,
    canSeeSystemLogs: false
  },
  school: {
    canSeeOwnData: true,
    canSeeTeamData: true,
    canSeeAllStudents: true,
    canSeeFinancialData: true,
    canSeeSystemLogs: false
  },
  wellness_professional: {
    canSeeOwnData: true,
    canSeeAssignedAthletes: true,
    canSeeAllStudents: false,
    canSeeFinancialData: false,
    canSeeSystemLogs: false
  },
  store_owner: {
    canSeeOwnData: true,
    canSeeCustomerData: true,
    canSeeFinancialData: true,
    canSeeSystemLogs: false
  },
  admin: {
    canSeeOwnData: true,
    canSeeTeamData: true,
    canSeeAllStudents: true,
    canSeeFinancialData: true,
    canSeeSystemLogs: true
  }
};
