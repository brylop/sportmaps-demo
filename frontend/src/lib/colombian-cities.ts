/**
 * Source of truth para ciudades colombianas.
 *
 * Cualquier selector de ciudad (onboarding entrenador, perfil de escuela,
 * filtro de marketplace, etc.) debe consumir desde aqui en vez de pedirlas
 * a una API geo abierta como Nominatim — eso introduce variabilidad y
 * normalizacion impredecible.
 *
 * Cubre las 32 capitales departamentales + ciudades intermedias con mayor
 * actividad deportiva. Si necesitas una ciudad fuera de esta lista, agregala
 * en el PR correspondiente — no la "extiendas" via input libre.
 */

export interface CityOption {
    /** Slug en lowercase, sin tildes ni espacios. Es el valor canonico. */
    value: string;
    /** Etiqueta visible (mantiene tildes y mayusculas). */
    label: string;
    /** Departamento al que pertenece — utilidad UI y agrupacion. */
    department: string;
}

/**
 * Lista ordenada por departamento + nombre. La etiqueta visible incluye el
 * departamento (`Medellín · Antioquia`) para desambiguar municipios con
 * nombres repetidos (San Pedro, San José, etc.) sin necesidad de columna extra.
 */
export const COLOMBIAN_CITIES: CityOption[] = [
    // ─── Capitales departamentales ───
    { value: 'leticia',          label: 'Leticia',         department: 'Amazonas' },
    { value: 'medellin',         label: 'Medellín',        department: 'Antioquia' },
    { value: 'arauca',           label: 'Arauca',          department: 'Arauca' },
    { value: 'barranquilla',     label: 'Barranquilla',    department: 'Atlántico' },
    { value: 'bogota',           label: 'Bogotá',          department: 'Bogotá D.C.' },
    { value: 'cartagena',        label: 'Cartagena',       department: 'Bolívar' },
    { value: 'tunja',            label: 'Tunja',           department: 'Boyacá' },
    { value: 'manizales',        label: 'Manizales',       department: 'Caldas' },
    { value: 'florencia',        label: 'Florencia',       department: 'Caquetá' },
    { value: 'yopal',            label: 'Yopal',           department: 'Casanare' },
    { value: 'popayan',          label: 'Popayán',         department: 'Cauca' },
    { value: 'valledupar',       label: 'Valledupar',      department: 'Cesar' },
    { value: 'quibdo',           label: 'Quibdó',          department: 'Chocó' },
    { value: 'monteria',         label: 'Montería',        department: 'Córdoba' },
    { value: 'inirida',          label: 'Inírida',         department: 'Guainía' },
    { value: 'san_jose_guaviare',label: 'San José del Guaviare', department: 'Guaviare' },
    { value: 'neiva',            label: 'Neiva',           department: 'Huila' },
    { value: 'riohacha',         label: 'Riohacha',        department: 'La Guajira' },
    { value: 'santa_marta',      label: 'Santa Marta',     department: 'Magdalena' },
    { value: 'villavicencio',    label: 'Villavicencio',   department: 'Meta' },
    { value: 'pasto',            label: 'Pasto',           department: 'Nariño' },
    { value: 'cucuta',           label: 'Cúcuta',          department: 'Norte de Santander' },
    { value: 'mocoa',            label: 'Mocoa',           department: 'Putumayo' },
    { value: 'armenia',          label: 'Armenia',         department: 'Quindío' },
    { value: 'pereira',          label: 'Pereira',         department: 'Risaralda' },
    { value: 'san_andres',       label: 'San Andrés',      department: 'San Andrés y Providencia' },
    { value: 'bucaramanga',      label: 'Bucaramanga',     department: 'Santander' },
    { value: 'sincelejo',        label: 'Sincelejo',       department: 'Sucre' },
    { value: 'ibague',           label: 'Ibagué',          department: 'Tolima' },
    { value: 'cali',             label: 'Cali',            department: 'Valle del Cauca' },
    { value: 'mitu',             label: 'Mitú',            department: 'Vaupés' },
    { value: 'puerto_carreno',   label: 'Puerto Carreño',  department: 'Vichada' },

    // ─── Ciudades intermedias con alta actividad deportiva ───
    { value: 'bello',            label: 'Bello',           department: 'Antioquia' },
    { value: 'envigado',         label: 'Envigado',        department: 'Antioquia' },
    { value: 'itagui',           label: 'Itagüí',          department: 'Antioquia' },
    { value: 'rionegro',         label: 'Rionegro',        department: 'Antioquia' },
    { value: 'apartado',         label: 'Apartadó',        department: 'Antioquia' },
    { value: 'turbo',            label: 'Turbo',           department: 'Antioquia' },
    { value: 'soledad',          label: 'Soledad',         department: 'Atlántico' },
    { value: 'malambo',          label: 'Malambo',         department: 'Atlántico' },
    { value: 'soacha',           label: 'Soacha',          department: 'Cundinamarca' },
    { value: 'chia',             label: 'Chía',            department: 'Cundinamarca' },
    { value: 'zipaquira',        label: 'Zipaquirá',       department: 'Cundinamarca' },
    { value: 'fusagasuga',       label: 'Fusagasugá',      department: 'Cundinamarca' },
    { value: 'facatativa',       label: 'Facatativá',      department: 'Cundinamarca' },
    { value: 'cajica',           label: 'Cajicá',          department: 'Cundinamarca' },
    { value: 'mosquera',         label: 'Mosquera',        department: 'Cundinamarca' },
    { value: 'madrid',           label: 'Madrid',          department: 'Cundinamarca' },
    { value: 'funza',            label: 'Funza',           department: 'Cundinamarca' },
    { value: 'girardot',         label: 'Girardot',        department: 'Cundinamarca' },
    { value: 'magangue',         label: 'Magangué',        department: 'Bolívar' },
    { value: 'sahagun',          label: 'Sahagún',         department: 'Córdoba' },
    { value: 'lorica',           label: 'Lorica',          department: 'Córdoba' },
    { value: 'cienaga',          label: 'Ciénaga',         department: 'Magdalena' },
    { value: 'maicao',           label: 'Maicao',          department: 'La Guajira' },
    { value: 'uribia',           label: 'Uribia',          department: 'La Guajira' },
    { value: 'aguachica',        label: 'Aguachica',       department: 'Cesar' },
    { value: 'duitama',          label: 'Duitama',         department: 'Boyacá' },
    { value: 'sogamoso',         label: 'Sogamoso',        department: 'Boyacá' },
    { value: 'chiquinquira',     label: 'Chiquinquirá',    department: 'Boyacá' },
    { value: 'barrancabermeja',  label: 'Barrancabermeja', department: 'Santander' },
    { value: 'floridablanca',    label: 'Floridablanca',   department: 'Santander' },
    { value: 'giron',            label: 'Girón',           department: 'Santander' },
    { value: 'piedecuesta',      label: 'Piedecuesta',     department: 'Santander' },
    { value: 'ocana',            label: 'Ocaña',           department: 'Norte de Santander' },
    { value: 'pamplona',         label: 'Pamplona',        department: 'Norte de Santander' },
    { value: 'villa_rosario',    label: 'Villa del Rosario',department: 'Norte de Santander' },
    { value: 'palmira',          label: 'Palmira',         department: 'Valle del Cauca' },
    { value: 'buenaventura',     label: 'Buenaventura',    department: 'Valle del Cauca' },
    { value: 'tulua',            label: 'Tuluá',           department: 'Valle del Cauca' },
    { value: 'cartago',          label: 'Cartago',         department: 'Valle del Cauca' },
    { value: 'buga',             label: 'Buga',            department: 'Valle del Cauca' },
    { value: 'jamundi',          label: 'Jamundí',         department: 'Valle del Cauca' },
    { value: 'yumbo',            label: 'Yumbo',           department: 'Valle del Cauca' },
    { value: 'tumaco',           label: 'Tumaco',          department: 'Nariño' },
    { value: 'ipiales',          label: 'Ipiales',         department: 'Nariño' },
    { value: 'dosquebradas',     label: 'Dosquebradas',    department: 'Risaralda' },
    { value: 'la_dorada',        label: 'La Dorada',       department: 'Caldas' },
    { value: 'espinal',          label: 'Espinal',         department: 'Tolima' },
    { value: 'honda',            label: 'Honda',           department: 'Tolima' },
    { value: 'melgar',           label: 'Melgar',          department: 'Tolima' },
    { value: 'pitalito',         label: 'Pitalito',        department: 'Huila' },
    { value: 'garzon',           label: 'Garzón',          department: 'Huila' },
    { value: 'acacias',          label: 'Acacías',         department: 'Meta' },
    { value: 'arauquita',        label: 'Arauquita',       department: 'Arauca' },
];

/** Mapa value -> label para mostrar etiquetas legibles. */
export const CITY_LABEL: Record<string, string> = Object.fromEntries(
    COLOMBIAN_CITIES.map(c => [c.value, c.label]),
);

/** Lista ordenada por departamento + nombre, util para selects agrupados. */
export const CITIES_BY_DEPARTMENT: Record<string, CityOption[]> = COLOMBIAN_CITIES.reduce(
    (acc, c) => {
        (acc[c.department] ??= []).push(c);
        return acc;
    },
    {} as Record<string, CityOption[]>,
);
