const FALLBACK_ROWS = [
    { label: 'Lunes - Viernes', value: '8:00 AM - 8:00 PM' },
    { label: 'Sábados', value: '9:00 AM - 5:00 PM' },
    { label: 'Domingos', value: 'Cerrado' },
];

/**
 * Filas del bloque "Horarios de Atención". Usa lo que la escuela configuró
 * (school_settings.business_hours, ver docs/specs/perfil-publico-plantillas.md
 * Fase 4) y, mientras no lo configure, cae al horario fijo que mostraban los
 * 4 layouts antes de esta fase — así ninguna escuela existente ve un cambio
 * hasta que active su propio horario.
 */
export function BusinessHoursRows({ businessHours }: { businessHours?: { label: string; value: string }[] | null }) {
    const rows = businessHours && businessHours.length > 0 ? businessHours : FALLBACK_ROWS;
    return (
        <>
            {rows.map((r, i) => (
                <div key={i} className="flex justify-between text-sm">
                    <span>{r.label}</span>
                    <span className="font-medium">{r.value}</span>
                </div>
            ))}
        </>
    );
}
