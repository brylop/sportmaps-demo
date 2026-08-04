// Plantillas de servicios por tipo. Al elegir el tipo, el wizard
// pre-llena estos campos para reducir la friccion del profesional.

export type ServiceType =
    | 'Fisioterapia'
    | 'Nutricion'
    | 'Psicologia'
    | 'Medicina_Deportiva'
    | 'Entrenamiento'
    | 'Otro';

export type Modality = 'presencial' | 'virtual' | 'domicilio' | 'hibrido';

export interface ServiceTemplate {
    suggested_name:        string;
    suggested_subcategories: string[];
    suggested_modalities:  Modality[];
    suggested_audiences:   string[];
    suggested_includes:    string[];
    suggested_requirements: string;
    suggested_duration:    number;
    suggested_price:       number;
}

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
    Fisioterapia:        'Fisioterapia',
    Nutricion:           'Nutricion',
    Psicologia:          'Psicologia deportiva',
    Medicina_Deportiva:  'Medicina deportiva',
    Entrenamiento:       'Entrenamiento personal',
    Otro:                'Otro servicio',
};

export const MODALITY_LABELS: Record<Modality, string> = {
    presencial: 'Presencial',
    virtual:    'Virtual',
    domicilio:  'A domicilio',
    hibrido:    'Hibrido',
};

export const COMMON_AUDIENCES = [
    'Deportistas amateur',
    'Deportistas profesionales',
    'Niños y adolescentes',
    'Adultos mayores',
    'Post-quirurgico',
    'Rehabilitacion de lesiones',
    'Embarazadas',
    'Principiantes',
    'Personas con sobrepeso',
    'Personas con diabetes',
];

export const SERVICE_TEMPLATES: Record<ServiceType, ServiceTemplate> = {
    Fisioterapia: {
        suggested_name:         'Sesion de fisioterapia deportiva',
        suggested_subcategories: ['Deportiva', 'Rehabilitacion', 'Prevencion', 'Postural', 'Pediatrica'],
        suggested_modalities:   ['presencial'],
        suggested_audiences:    ['Deportistas amateur', 'Rehabilitacion de lesiones'],
        suggested_includes: [
            'Evaluacion postural y funcional inicial',
            'Terapia manual y movilizaciones',
            'Ejercicios terapeuticos guiados',
            'Plan de ejercicios para realizar en casa',
        ],
        suggested_requirements: 'Traer ropa comoda y estudios medicos recientes si los tienes. Llegar 5 minutos antes.',
        suggested_duration:     60,
        suggested_price:        80000,
    },
    Nutricion: {
        suggested_name:         'Consulta nutricional deportiva',
        suggested_subcategories: ['Deportiva', 'Clinica', 'Bariatrica', 'Perinatal', 'Vegetariana'],
        suggested_modalities:   ['presencial', 'virtual'],
        suggested_audiences:    ['Deportistas amateur', 'Personas con sobrepeso'],
        suggested_includes: [
            'Evaluacion antropometrica',
            'Analisis de habitos alimenticios',
            'Plan nutricional personalizado por escrito',
            'Seguimiento semanal por chat',
        ],
        suggested_requirements: 'Traer registro de alimentacion de los ultimos 3 dias y estudios de laboratorio recientes.',
        suggested_duration:     45,
        suggested_price:        90000,
    },
    Psicologia: {
        suggested_name:         'Sesion de psicologia deportiva',
        suggested_subcategories: ['Deportiva', 'Cognitivo-conductual', 'Clinica', 'Grupal'],
        suggested_modalities:   ['presencial', 'virtual'],
        suggested_audiences:    ['Deportistas amateur', 'Deportistas profesionales'],
        suggested_includes: [
            'Anamnesis deportiva',
            'Evaluacion psicometrica inicial',
            'Sesion 1:1 confidencial',
            'Plan de seguimiento y tecnicas para casa',
        ],
        suggested_requirements: 'Si es virtual, contar con un espacio privado y conexion estable.',
        suggested_duration:     60,
        suggested_price:        120000,
    },
    Medicina_Deportiva: {
        suggested_name:         'Consulta de medicina deportiva',
        suggested_subcategories: ['Rendimiento', 'Lesiones', 'Cardiologia deportiva', 'Reincorporacion'],
        suggested_modalities:   ['presencial'],
        suggested_audiences:    ['Deportistas amateur', 'Deportistas profesionales', 'Rehabilitacion de lesiones'],
        suggested_includes: [
            'Examen fisico completo',
            'Lectura de estudios (RX, ecografias, MRI)',
            'Diagnostico y plan de tratamiento',
            'Plan de retorno seguro al deporte',
        ],
        suggested_requirements: 'Traer estudios recientes y carnet de afiliacion EPS si aplica.',
        suggested_duration:     45,
        suggested_price:        180000,
    },
    Entrenamiento: {
        suggested_name:         'Sesion de entrenamiento personal',
        suggested_subcategories: ['Funcional', 'Fuerza', 'Resistencia', 'HIIT', 'Yoga', 'Pilates'],
        suggested_modalities:   ['presencial', 'domicilio'],
        suggested_audiences:    ['Principiantes', 'Deportistas amateur'],
        suggested_includes: [
            'Evaluacion funcional inicial',
            'Rutina personalizada segun objetivos',
            'Demostracion y correccion tecnica',
            'Seguimiento por chat entre sesiones',
        ],
        suggested_requirements: 'Ropa deportiva, botella de agua y toalla. Llegar hidratado.',
        suggested_duration:     60,
        suggested_price:        70000,
    },
    Otro: {
        suggested_name:         '',
        suggested_subcategories: [],
        suggested_modalities:   ['presencial'],
        suggested_audiences:    [],
        suggested_includes:     [],
        suggested_requirements: '',
        suggested_duration:     60,
        suggested_price:        50000,
    },
};

// Paquetes preset para sugerir variaciones (ej. plan de 4 sesiones)
export interface VariationPreset {
    name:             string;
    sessions:         number;
    discount_percent: number;
}

export const VARIATION_PRESETS: VariationPreset[] = [
    { name: 'Sesion unica',          sessions: 1,  discount_percent: 0 },
    { name: 'Plan 4 sesiones',       sessions: 4,  discount_percent: 10 },
    { name: 'Plan 8 sesiones',       sessions: 8,  discount_percent: 15 },
    { name: 'Plan mensual ilimitado', sessions: 12, discount_percent: 20 },
];
