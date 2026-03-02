export const USER_ROLES = {
    ATHLETE: 'athlete',
    PARENT: 'parent',
    COACH: 'coach',
    SCHOOL: 'school',
    SCHOOL_ADMIN: 'school_admin', // Branch Manager
    SUPER_ADMIN: 'super_admin',   // System Admin
    WELLNESS: 'wellness_professional',
    STORE: 'store_owner',
    ADMIN: 'admin',               // Alias for system admin/school owner
    ORGANIZER: 'organizer'
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];
