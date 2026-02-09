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
    school_name: "Spirit All Stars",
    students_count: 124,
    monthly_revenue: 28_500_000,
    programs: [
      {
        id: '1',
        name: 'Butterfly (Junior Prep)',
        enrolled: 32,
        price: 240_000,
        schedule: 'Mar-Jue 4:00 PM',
      },
      {
        id: '2',
        name: 'Firesquad (Senior L3)',
        enrolled: 45,
        price: 280_000,
        schedule: 'Lun-Mié-Vie 5:30 PM',
      },
      {
        id: '3',
        name: 'Bombsquad (Coed L5)',
        enrolled: 28,
        price: 350_000,
        schedule: 'Lun a Sáb 7:00 PM',
      },
      {
        id: '4',
        name: 'Legends (Open L6)',
        enrolled: 19,
        price: 400_000,
        schedule: 'Fines de semana',
      },
    ],
    recent_enrollments: [
      {
        student: 'Sofía Ramírez',
        date: 'Hace 2 horas',
        program: 'Butterfly (Junior Prep)',
      },
      {
        student: 'Mateo Torres',
        date: 'Hace 1 día',
        program: 'Firesquad (Senior L3)',
      },
      {
        student: 'Valentina Gómez',
        date: 'Hace 2 días',
        program: 'Bombsquad (Coed L5)',
      },
    ],
    pending_payments: 5,
    notifications: [
      {
        type: 'success',
        message: 'Pago recibido: María López - Inscripción Nacional',
        time: 'Hace 15 min',
      },
      {
        type: 'info',
        message: 'Nuevo mensaje de padre: Juan Pérez (Duda Uniforme)',
        time: 'Hace 1 hora',
      },
      {
        type: 'warning',
        message: '5 pagos pendientes de uniformes',
        time: 'Hace 2 horas',
      },
      {
        type: 'success',
        message: 'Nueva estrella: Sofía Ramírez se unió a Butterfly',
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
        age: 14,
        program: 'Firesquad (Senior L3)',
        school: 'Spirit All Stars',
        attendance: 98,
        next_class: 'Hoy 5:30 PM',
      },
      {
        id: '2',
        name: 'Emma García',
        age: 7,
        program: 'Butterfly (Junior Prep)',
        school: 'Spirit All Stars',
        attendance: 94,
        next_class: 'Mañana 4:00 PM',
      },
    ],
    upcoming_payments: [
      {
        amount: 280_000,
        due_date: '15 Feb 2025',
        program: 'Firesquad (Mensual)',
      },
      {
        amount: 550_000,
        due_date: '20 Feb 2025',
        program: 'Uniforme Metallic Blue Edition',
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