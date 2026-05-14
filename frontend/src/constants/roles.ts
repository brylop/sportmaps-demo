export const USER_ROLES = {
    ATHLETE: 'athlete',
    PARENT: 'parent',
    COACH: 'coach',
    SCHOOL: 'school',
    SCHOOL_ADMIN: 'school_admin',          // Branch Manager
    SUPER_ADMIN: 'super_admin',            // System Admin
    WELLNESS: 'wellness_professional',
    PERSONAL_TRAINER: 'personal_trainer',
    EXTERNAL_VENDOR: 'external_vendor',    // Vendedor puro / marca / tienda externa (reemplaza STORE)
    STORE: 'store_owner',                  // legacy — mantener para usuarios pre-migracion
    ADMIN: 'admin',                        // Alias for system admin/school owner
    ORGANIZER: 'organizer'
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

// Roles cuyo vendor_profile se crea automaticamente al signup.
// El resto (coach, school, parent, athlete) debe activar Mi Tienda explicitamente.
export const AUTO_VENDOR_ROLES: UserRole[] = [
    USER_ROLES.EXTERNAL_VENDOR,
    USER_ROLES.WELLNESS,
    USER_ROLES.PERSONAL_TRAINER,
    USER_ROLES.STORE, // legacy
];
