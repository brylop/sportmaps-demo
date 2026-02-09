// Demo user credentials for SportMaps
// These users are pre-created for demo purposes

export interface DemoUser {
  role: string;
  email: string;
  password: string;
  fullName: string;
  description: string;
}

export const DEMO_USERS: Record<string, DemoUser> = {
  athlete: {
    role: 'athlete',
    email: 'carlos.martinez@sportmaps-demo.com',
    password: 'SportMapsDemo2025!',
    fullName: 'Carlos Martínez López',
    description: 'Atleta de cheerleading de alto rendimiento'
  },
  parent: {
    role: 'parent',
    email: 'maria.garcia@sportmaps-demo.com',
    password: 'SportMapsDemo2025!',
    fullName: 'María García Hernández',
    description: 'Madre de dos hijos deportistas'
  },
  coach: {
    role: 'coach',
    email: 'luis.rodriguez@sportmaps-demo.com',
    password: 'SportMapsDemo2025!',
    fullName: 'Luis Fernando Rodríguez',
    description: 'Entrenador certificado con 10 años de experiencia'
  },
  school: {
    role: 'school',
    email: 'academia.elite@sportmaps-demo.com',
    password: 'SportMapsDemo2025!',
    fullName: 'Spirit All Stars',
    description: 'Academia de cheerleading de alto rendimiento'
  },
  wellness_professional: {
    role: 'wellness_professional',
    email: 'sofia.rivera@sportmaps-demo.com',
    password: 'SportMapsDemo2025!',
    fullName: 'Dra. Sofía Rivera',
    description: 'Fisioterapeuta deportiva especializada'
  },
  store_owner: {
    role: 'store_owner',
    email: 'info.equipatemas@sportmaps-demo.com',
    password: 'SportMapsDemo2025!',
    fullName: 'Tienda Equípate Más',
    description: 'Tienda de artículos deportivos'
  },
  admin: {
    role: 'admin',
    email: 'admin@sportmaps-demo.com',
    password: 'SportMapsDemo2025!',
    fullName: 'Administrador Sistema',
    description: 'Control total de la plataforma'
  }
};

export const getDemoUser = (roleId: string): DemoUser | null => {
  return DEMO_USERS[roleId] || null;
};

export const isDemoEmail = (email: string): boolean => {
  return email.endsWith('@sportmaps-demo.com');
};
