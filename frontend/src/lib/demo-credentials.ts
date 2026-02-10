// Demo user credentials for SportMaps
// All demo emails use Gmail+ aliasing so they arrive at the same inbox

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
    email: 'spoortmaps+athlete@gmail.com',
    password: 'SportMapsDemo2025!',
    fullName: 'Carlos Martínez López',
    description: 'Atleta de cheerleading de alto rendimiento'
  },
  parent: {
    role: 'parent',
    email: 'spoortmaps@gmail.com',
    password: 'SportMapsDemo2025!',
    fullName: 'María García Hernández',
    description: 'Madre de dos hijos deportistas'
  },
  coach: {
    role: 'coach',
    email: 'spoortmaps+coach@gmail.com',
    password: 'SportMapsDemo2025!',
    fullName: 'Luis Fernando Rodríguez',
    description: 'Entrenador certificado con 10 años de experiencia'
  },
  school: {
    role: 'school',
    email: 'spoortmaps+school@gmail.com',
    password: 'SportMapsDemo2025!',
    fullName: 'Spirit All Stars',
    description: 'Academia de cheerleading de alto rendimiento'
  },
  wellness_professional: {
    role: 'wellness_professional',
    email: 'spoortmaps+wellness@gmail.com',
    password: 'SportMapsDemo2025!',
    fullName: 'Dra. Sofía Rivera',
    description: 'Fisioterapeuta deportiva especializada'
  },
  store_owner: {
    role: 'store_owner',
    email: 'spoortmaps+store@gmail.com',
    password: 'SportMapsDemo2025!',
    fullName: 'Tienda Equípate Más',
    description: 'Tienda de artículos deportivos'
  },
  admin: {
    role: 'admin',
    email: 'spoortmaps+admin@gmail.com',
    password: 'SportMapsDemo2025!',
    fullName: 'Administrador Sistema',
    description: 'Control total de la plataforma'
  }
};

export const getDemoUser = (roleId: string): DemoUser | null => {
  return DEMO_USERS[roleId] || null;
};

export const isDemoEmail = (email: string): boolean => {
  return email.startsWith('spoortmaps') && email.includes('@gmail.com');
};
