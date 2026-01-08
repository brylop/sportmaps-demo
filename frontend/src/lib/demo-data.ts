// Realistic demo data for different roles

export interface DemoSchoolData {
  school_name: string;
  students_count: number;
  monthly_revenue: number;
  programs: Array<{
    id: string;
    name: string;
    enrolled: number;
    price: number;
    schedule: string;
  }>;
  recent_enrollments: Array<{
    student: string;
    date: string;
    program: string;
  }>;
  pending_payments: number;
  notifications: Array<{
    type: 'success' | 'info' | 'warning';
    message: string;
    time: string;
  }>;
}

export interface DemoParentData {
  children: Array<{
    id: string;
    name: string;
    age: number;
    program: string;
    school: string;
    attendance: number;
    next_class: string;
  }>;
  upcoming_payments: Array<{
    amount: number;
    due_date: string;
    program: string;
  }>;
}

export const getDemoSchoolData = (): DemoSchoolData => {
  return {
    school_name: "Academia Elite FC",
    students_count: 87,
    monthly_revenue: 17_800_000,
    programs: [
      {
        id: '1',
        name: 'Fútbol Infantil (4-7 años)',
        enrolled: 23,
        price: 180_000,
        schedule: 'Lun-Mié 4:00 PM',
      },
      {
        id: '2',
        name: 'Fútbol Juvenil (8-12 años)',
        enrolled: 34,
        price: 220_000,
        schedule: 'Mar-Jue 5:00 PM',
      },
      {
        id: '3',
        name: 'Porteros Especialización',
        enrolled: 12,
        price: 280_000,
        schedule: 'Sáb 9:00 AM',
      },
      {
        id: '4',
        name: 'Técnica y Habilidades',
        enrolled: 18,
        price: 200_000,
        schedule: 'Vie 4:30 PM',
      },
    ],
    recent_enrollments: [
      {
        student: 'Sofía Ramírez',
        date: 'Hace 2 horas',
        program: 'Fútbol Infantil',
      },
      {
        student: 'Mateo Torres',
        date: 'Hace 1 día',
        program: 'Fútbol Juvenil',
      },
      {
        student: 'Valentina Gómez',
        date: 'Hace 2 días',
        program: 'Técnica y Habilidades',
      },
    ],
    pending_payments: 3,
    notifications: [
      {
        type: 'success',
        message: 'Pago recibido: María López - $180.000',
        time: 'Hace 15 min',
      },
      {
        type: 'info',
        message: 'Nuevo mensaje de padre: Juan Pérez',
        time: 'Hace 1 hora',
      },
      {
        type: 'warning',
        message: '3 pagos pendientes por cobrar',
        time: 'Hace 2 horas',
      },
      {
        type: 'success',
        message: 'Nueva inscripción: Sofía Ramírez',
        time: 'Hace 2 horas',
      },
    ],
  };
};

export const getDemoParentData = (): DemoParentData => {
  return {
    children: [
      {
        id: '1',
        name: 'Santiago García',
        age: 8,
        program: 'Fútbol Juvenil',
        school: 'Academia Elite FC',
        attendance: 95,
        next_class: 'Mañana 5:00 PM',
      },
      {
        id: '2',
        name: 'Emma García',
        age: 6,
        program: 'Natación Infantil',
        school: 'Club Acuático SportMaps',
        attendance: 92,
        next_class: 'Hoy 4:00 PM',
      },
    ],
    upcoming_payments: [
      {
        amount: 220_000,
        due_date: '15 Feb 2025',
        program: 'Fútbol Juvenil',
      },
      {
        amount: 180_000,
        due_date: '20 Feb 2025',
        program: 'Natación Infantil',
      },
    ],
  };
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};