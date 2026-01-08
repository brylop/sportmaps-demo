// Mock data for demo profiles

export interface MockProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  image_url: string;
  sales: number;
}

export interface MockAppointment {
  id: string;
  client_name: string;
  date: string;
  time: string;
  service: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
}

export interface MockPatient {
  id: string;
  name: string;
  age: number;
  sport: string;
  last_visit: string;
  status: 'active' | 'inactive';
  conditions?: string[];
}

export interface MockOrder {
  id: string;
  customer_name: string;
  date: string;
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered';
  items: number;
}

// Store Owner Mock Data
export const mockProducts: MockProduct[] = [
  {
    id: '1',
    name: 'Balón de Fútbol Profesional',
    description: 'Balón oficial tamaño 5 para competición',
    price: 89.99,
    stock: 45,
    category: 'Fútbol',
    image_url: '/placeholder.svg',
    sales: 128
  },
  {
    id: '2',
    name: 'Raqueta de Tenis Pro',
    description: 'Raqueta de grafito para jugadores avanzados',
    price: 249.99,
    stock: 12,
    category: 'Tenis',
    image_url: '/placeholder.svg',
    sales: 34
  },
  {
    id: '3',
    name: 'Zapatillas Running Air',
    description: 'Zapatillas ligeras con amortiguación premium',
    price: 159.99,
    stock: 78,
    category: 'Running',
    image_url: '/placeholder.svg',
    sales: 256
  },
  {
    id: '4',
    name: 'Kit de Pesas 20kg',
    description: 'Set completo de mancuernas ajustables',
    price: 189.99,
    stock: 23,
    category: 'Fitness',
    image_url: '/placeholder.svg',
    sales: 67
  },
  {
    id: '5',
    name: 'Guantes de Boxeo Pro',
    description: 'Guantes 14oz para entrenamiento profesional',
    price: 79.99,
    stock: 56,
    category: 'Boxeo',
    image_url: '/placeholder.svg',
    sales: 89
  },
  {
    id: '6',
    name: 'Camiseta Deportiva Dry-Fit',
    description: 'Tecnología de secado rápido, varios colores',
    price: 34.99,
    stock: 150,
    category: 'Ropa',
    image_url: '/placeholder.svg',
    sales: 412
  }
];

export const mockOrders: MockOrder[] = [
  {
    id: 'ORD-001',
    customer_name: 'Carlos Martínez',
    date: '2025-12-26',
    total: 249.99,
    status: 'pending',
    items: 2
  },
  {
    id: 'ORD-002',
    customer_name: 'Ana López',
    date: '2025-12-25',
    total: 89.99,
    status: 'processing',
    items: 1
  },
  {
    id: 'ORD-003',
    customer_name: 'Pedro Sánchez',
    date: '2025-12-24',
    total: 349.98,
    status: 'shipped',
    items: 3
  },
  {
    id: 'ORD-004',
    customer_name: 'Laura García',
    date: '2025-12-23',
    total: 159.99,
    status: 'delivered',
    items: 1
  }
];

// Wellness Professional Mock Data
export const mockAppointments: MockAppointment[] = [
  {
    id: '1',
    client_name: 'Miguel Torres',
    date: '2025-12-26',
    time: '09:00',
    service: 'Evaluación Física',
    status: 'confirmed',
    notes: 'Primera consulta'
  },
  {
    id: '2',
    client_name: 'Sofía Ramírez',
    date: '2025-12-26',
    time: '10:30',
    service: 'Fisioterapia',
    status: 'confirmed'
  },
  {
    id: '3',
    client_name: 'Diego Fernández',
    date: '2025-12-26',
    time: '12:00',
    service: 'Nutrición Deportiva',
    status: 'pending'
  },
  {
    id: '4',
    client_name: 'Valentina Castro',
    date: '2025-12-27',
    time: '09:00',
    service: 'Rehabilitación',
    status: 'confirmed'
  },
  {
    id: '5',
    client_name: 'Andrés Morales',
    date: '2025-12-27',
    time: '11:00',
    service: 'Control Mensual',
    status: 'pending'
  }
];

export const mockPatients: MockPatient[] = [
  {
    id: '1',
    name: 'Miguel Torres',
    age: 24,
    sport: 'Fútbol',
    last_visit: '2025-12-20',
    status: 'active',
    conditions: ['Esguince tobillo grado II']
  },
  {
    id: '2',
    name: 'Sofía Ramírez',
    age: 19,
    sport: 'Natación',
    last_visit: '2025-12-18',
    status: 'active',
    conditions: ['Tendinitis hombro']
  },
  {
    id: '3',
    name: 'Diego Fernández',
    age: 28,
    sport: 'Running',
    last_visit: '2025-12-15',
    status: 'active',
    conditions: ['Plan nutricional deportivo']
  },
  {
    id: '4',
    name: 'Valentina Castro',
    age: 22,
    sport: 'Voleibol',
    last_visit: '2025-12-10',
    status: 'active',
    conditions: ['Rehabilitación rodilla']
  },
  {
    id: '5',
    name: 'Andrés Morales',
    age: 31,
    sport: 'Ciclismo',
    last_visit: '2025-11-28',
    status: 'inactive'
  }
];

// Store statistics
export const getStoreStats = () => ({
  totalProducts: mockProducts.length,
  totalSales: mockProducts.reduce((acc, p) => acc + p.sales, 0),
  totalRevenue: mockProducts.reduce((acc, p) => acc + (p.price * p.sales), 0),
  pendingOrders: mockOrders.filter(o => o.status === 'pending' || o.status === 'processing').length,
  lowStock: mockProducts.filter(p => p.stock < 20).length
});

// Wellness statistics
export const getWellnessStats = () => ({
  totalPatients: mockPatients.length,
  activePatients: mockPatients.filter(p => p.status === 'active').length,
  todayAppointments: mockAppointments.filter(a => a.date === '2025-12-26').length,
  pendingAppointments: mockAppointments.filter(a => a.status === 'pending').length,
  confirmedAppointments: mockAppointments.filter(a => a.status === 'confirmed').length
});
