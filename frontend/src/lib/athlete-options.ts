/**
 * Source of truth para las opciones de "Talla camiseta" y "Tipo de sangre"
 * del formulario de edición de un deportista (menores y adultos comparten
 * el mismo select, por eso incluye tallas infantiles y de adulto juntas).
 */

export interface SimpleOption {
    value: string;
    label: string;
}

export const TSHIRT_SIZES: SimpleOption[] = [
    { value: '4', label: '4 (niño)' },
    { value: '6', label: '6 (niño)' },
    { value: '8', label: '8 (niño)' },
    { value: '10', label: '10 (niño)' },
    { value: '12', label: '12 (niño)' },
    { value: '14', label: '14 (niño)' },
    { value: '16', label: '16 (niño)' },
    { value: 'XS', label: 'XS' },
    { value: 'S', label: 'S' },
    { value: 'M', label: 'M' },
    { value: 'L', label: 'L' },
    { value: 'XL', label: 'XL' },
    { value: 'XXL', label: 'XXL' },
];

export const BLOOD_TYPES: SimpleOption[] = [
    { value: 'O+', label: 'O+' },
    { value: 'O-', label: 'O-' },
    { value: 'A+', label: 'A+' },
    { value: 'A-', label: 'A-' },
    { value: 'B+', label: 'B+' },
    { value: 'B-', label: 'B-' },
    { value: 'AB+', label: 'AB+' },
    { value: 'AB-', label: 'AB-' },
];
