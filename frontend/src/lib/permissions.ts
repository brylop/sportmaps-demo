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
  | 'events:view' | 'events:create' | 'events:edit' | 'events:delete'
  | 'admin:users' | 'admin:system' | 'admin:all'
  // Marketplace permissions
  | 'marketplace:browse' | 'marketplace:manage'
  | 'products:view' | 'products:create' | 'products:edit' | 'products:delete'
  | 'services:view' | 'services:create' | 'services:edit' | 'services:delete'
  | 'orders:view' | 'orders:manage'
  | 'appointments:view' | 'appointments:create' | 'appointments:manage'
  | 'inventory:view' | 'inventory:manage'
  | 'health_records:view' | 'health_records:create' | 'health_records:edit';

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
  | 'events'
  | 'admin'
  | 'marketplace'
  | 'products'
  | 'services'
  | 'orders'
  | 'appointments'
  | 'inventory'
  | 'health_records';

export type Action = 'view' | 'create' | 'edit' | 'delete' | 'manage' | 'all';

/**
 * Role-Permission Matrix
 * Defines what each role can do
 */
const rolePermissions: Partial<Record<UserRole, Permission[]>> & Record<string, Permission[]> = {
  athlete: [
    'dashboard:view',
    'calendar:view',
    'teams:view',
    'stats:view',
    'events:view',
    'messages:view',
    'messages:send',
    'settings:view',
    'settings:edit',
    'marketplace:browse',
    'orders:view',
    'appointments:view'
  ],

  parent: [
    'dashboard:view',
    'calendar:view',
    'students:view',
    'stats:view',
    'reports:view',
    'events:view',
    'messages:view',
    'messages:send',
    'settings:view',
    'settings:edit',
    'marketplace:browse',
    'orders:view',
    'appointments:view',
    'appointments:create'
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
    'events:view',
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
    'events:view',
    'messages:view',
    'messages:send',
    'settings:view',
    'settings:edit',
    'marketplace:manage',
    'products:view',
    'products:create',
    'products:edit'
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
    'settings:edit',
    'marketplace:manage',
    'services:view',
    'services:create',
    'services:edit',
    'services:delete',
    'appointments:view',
    'appointments:create',
    'appointments:manage',
    'health_records:view',
    'health_records:create',
    'health_records:edit'
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
    'settings:edit',
    'marketplace:manage',
    'products:view',
    'products:create',
    'products:edit',
    'products:delete',
    'orders:view',
    'orders:manage',
    'inventory:view',
    'inventory:manage'
  ],

  organizer: [
    'dashboard:view',
    'calendar:view',
    'calendar:create',
    'calendar:edit',
    'calendar:delete',
    'events:view',
    'events:create',
    'events:edit',
    'events:delete',
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

  reporter: [
    'dashboard:view',
    'calendar:view',
    'teams:view',
    'students:view',
    'stats:view',
    'reports:view',
    'reports:create',
    'messages:view',
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
    'events:view',
    'events:create',
    'events:edit',
    'events:delete',
    'admin:users',
    'admin:system',
    'admin:all',
    'marketplace:browse',
    'marketplace:manage',
    'products:view',
    'products:create',
    'products:edit',
    'products:delete',
    'services:view',
    'services:create',
    'services:edit',
    'services:delete',
    'orders:view',
    'orders:manage',
    'appointments:view',
    'appointments:create',
    'appointments:manage',
    'inventory:view',
    'inventory:manage',
    'health_records:view',
    'health_records:create',
    'health_records:edit'
  ]
};

// ALIASING FOR DB COMPATIBILITY
// Database uses 'school_admin', 'super_admin', 'owner', etc.
(rolePermissions as any)['school_admin'] = rolePermissions.school;
(rolePermissions as any)['super_admin'] = rolePermissions.admin;
(rolePermissions as any)['owner'] = rolePermissions.admin;
(rolePermissions as any)['guest'] = rolePermissions.athlete; // guests get basic access

/**
 * Check if a user has a specific permission
 */
export function hasPermission(userRole: UserRole, permission: Permission): boolean {
  const permissions = rolePermissions[userRole];
  if (!permissions) return false; // Safety: unknown role → deny
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
export const featureFlags: Partial<Record<UserRole, Record<string, boolean>>> & Record<string, Record<string, boolean>> = {
  athlete: {
    canCreateEvents: false,
    canManageTeams: false,
    canViewFinances: false,
    canAccessAdmin: false,
    canExportData: false,
    canSellProducts: false,
    canSellServices: false,
    canBrowseMarketplace: true,
    canBookAppointments: true
  },
  parent: {
    canCreateEvents: false,
    canManageTeams: false,
    canViewFinances: true,
    canAccessAdmin: false,
    canExportData: false,
    canSellProducts: false,
    canSellServices: false,
    canBrowseMarketplace: true,
    canBookAppointments: true
  },
  coach: {
    canCreateEvents: true,
    canManageTeams: true,
    canViewFinances: false,
    canAccessAdmin: false,
    canExportData: true,
    canSellProducts: false,
    canSellServices: false,
    canBrowseMarketplace: true,
    canBookAppointments: false
  },
  school: {
    canCreateEvents: true,
    canManageTeams: true,
    canViewFinances: true,
    canAccessAdmin: false,
    canExportData: true,
    canSellProducts: true,
    canSellServices: false,
    canBrowseMarketplace: true,
    canBookAppointments: false
  },
  wellness_professional: {
    canCreateEvents: true,
    canManageTeams: false,
    canViewFinances: false,
    canAccessAdmin: false,
    canExportData: true,
    canSellProducts: false,
    canSellServices: true,
    canBrowseMarketplace: true,
    canBookAppointments: false
  },
  store_owner: {
    canCreateEvents: false,
    canManageTeams: false,
    canViewFinances: true,
    canAccessAdmin: false,
    canExportData: true,
    canSellProducts: true,
    canSellServices: false,
    canBrowseMarketplace: true,
    canBookAppointments: false
  },
  organizer: {
    canCreateEvents: true,
    canManageTeams: false,
    canViewFinances: true,
    canAccessAdmin: false,
    canExportData: true,
    canSellProducts: false,
    canSellServices: false,
    canBrowseMarketplace: true,
    canBookAppointments: false
  },
  reporter: {
    canCreateEvents: false,
    canManageTeams: false,
    canViewFinances: false,
    canAccessAdmin: false,
    canExportData: true,
    canSellProducts: false,
    canSellServices: false,
    canBrowseMarketplace: false,
    canBookAppointments: false
  },
  admin: {
    canCreateEvents: true,
    canManageTeams: true,
    canViewFinances: true,
    canAccessAdmin: true,
    canExportData: true,
    canSellProducts: true,
    canSellServices: true,
    canBrowseMarketplace: true,
    canBookAppointments: true
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
    canSeeSystemLogs: false,
    canSeeHealthRecords: false
  },
  parent: {
    canSeeOwnData: true,
    canSeeChildrenData: true,
    canSeeTeamData: true,
    canSeeAllStudents: false,
    canSeeFinancialData: false,
    canSeeSystemLogs: false,
    canSeeHealthRecords: false
  },
  coach: {
    canSeeOwnData: true,
    canSeeTeamData: true,
    canSeeAllStudents: true,
    canSeeFinancialData: false,
    canSeeSystemLogs: false,
    canSeeHealthRecords: false
  },
  school: {
    canSeeOwnData: true,
    canSeeTeamData: true,
    canSeeAllStudents: true,
    canSeeFinancialData: true,
    canSeeSystemLogs: false,
    canSeeHealthRecords: false
  },
  wellness_professional: {
    canSeeOwnData: true,
    canSeeAssignedAthletes: true,
    canSeeAllStudents: false,
    canSeeFinancialData: false,
    canSeeSystemLogs: false,
    canSeeHealthRecords: true
  },
  store_owner: {
    canSeeOwnData: true,
    canSeeCustomerData: true,
    canSeeFinancialData: true,
    canSeeSystemLogs: false,
    canSeeHealthRecords: false
  },
  organizer: {
    canSeeOwnData: true,
    canSeeEventRegistrations: true,
    canSeeFinancialData: true,
    canSeeSystemLogs: false,
    canSeeHealthRecords: false
  },
  admin: {
    canSeeOwnData: true,
    canSeeTeamData: true,
    canSeeAllStudents: true,
    canSeeFinancialData: true,
    canSeeSystemLogs: true,
    canSeeHealthRecords: true
  }
};
