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
  parent: {
    role: 'parent',
    email: 'padre@sportmaps-demo.com',
    password: 'DemoSportMaps2024!',
    fullName: 'María González (Demo Padre)',
    description: 'Perfil demo de padre/madre con 2 hijos en escuelas deportivas'
  },
  coach: {
    role: 'coach',
    email: 'entrenador@sportmaps-demo.com',
    password: 'DemoSportMaps2024!',
    fullName: 'Carlos Rodríguez (Demo Entrenador)',
    description: 'Perfil demo de entrenador con múltiples clases y alumnos'
  },
  school: {
    role: 'school',
    email: 'escuela@sportmaps-demo.com',
    password: 'DemoSportMaps2024!',
    fullName: 'Academia Deportiva SportMaps (Demo)',
    description: 'Perfil demo de escuela deportiva con gestión completa'
  },
  athlete: {
    role: 'athlete',
    email: 'deportista@sportmaps-demo.com',
    password: 'DemoSportMaps2024!',
    fullName: 'Juan Pérez (Demo Deportista)',
    description: 'Perfil demo de deportista/atleta con historial deportivo'
  },
  wellness_professional: {
    role: 'wellness_professional',
    email: 'bienestar@sportmaps-demo.com',
    password: 'DemoSportMaps2024!',
    fullName: 'Dra. Ana Martínez (Demo Bienestar)',
    description: 'Perfil demo de profesional de bienestar y salud'
  },
  store_owner: {
    role: 'store_owner',
    email: 'tienda@sportmaps-demo.com',
    password: 'DemoSportMaps2024!',
    fullName: 'Deportes Pro (Demo Tienda)',
    description: 'Perfil demo de tienda deportiva con catálogo de productos'
  }
};

export const getDemoUser = (roleId: string): DemoUser | null => {
  return DEMO_USERS[roleId] || null;
};

export const isDemoEmail = (email: string): boolean => {
  return email.endsWith('@sportmaps-demo.com');
};
