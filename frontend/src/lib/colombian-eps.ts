/**
 * Source of truth para EPS (Entidades Promotoras de Salud) colombianas.
 *
 * Lista de las EPS vigentes en régimen contributivo y subsidiado más usadas
 * al registrar el dato de un deportista. `value` y `label` son el mismo
 * texto: la columna `eps_name` solo almacena el nombre, no un código.
 */

export interface EpsOption {
    value: string;
    label: string;
}

export const COLOMBIAN_EPS: EpsOption[] = [
    { value: 'Nueva EPS', label: 'Nueva EPS' },
    { value: 'Sura EPS', label: 'Sura EPS' },
    { value: 'Sanitas EPS', label: 'Sanitas EPS' },
    { value: 'Compensar EPS', label: 'Compensar EPS' },
    { value: 'Salud Total EPS', label: 'Salud Total EPS' },
    { value: 'Famisanar EPS', label: 'Famisanar EPS' },
    { value: 'Coosalud EPS', label: 'Coosalud EPS' },
    { value: 'Mutual Ser EPS', label: 'Mutual Ser EPS' },
    { value: 'Aliansalud EPS', label: 'Aliansalud EPS' },
    { value: 'EPS Comfenalco Valle', label: 'EPS Comfenalco Valle' },
    { value: 'SOS EPS', label: 'SOS EPS (Servicio Occidental de Salud)' },
    { value: 'Emssanar EPS', label: 'Emssanar EPS' },
    { value: 'Capital Salud EPS', label: 'Capital Salud EPS' },
    { value: 'Asmet Salud EPS', label: 'Asmet Salud EPS' },
    { value: 'Ecoopsos EPS', label: 'Ecoopsos EPS' },
    { value: 'Comparta EPS', label: 'Comparta EPS' },
    { value: 'Savia Salud EPS', label: 'Savia Salud EPS' },
    { value: 'Salud Bolívar EPS', label: 'Salud Bolívar EPS' },
    { value: 'Dusakawi EPSI', label: 'Dusakawi EPSI (indígena)' },
    { value: 'Pijaos Salud EPSI', label: 'Pijaos Salud EPSI (indígena)' },
    { value: 'Fomag', label: 'Fomag (magisterio)' },
    { value: 'Dirección de Sanidad Militar', label: 'Dirección de Sanidad Militar' },
    { value: 'Dirección de Sanidad Policía', label: 'Dirección de Sanidad Policía' },
    { value: 'Ecopetrol Salud', label: 'Ecopetrol Salud (régimen especial)' },
];
