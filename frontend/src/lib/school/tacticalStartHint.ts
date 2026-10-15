/**
 * Texto del botón «Poner jugadores» del aviso «Empieza aquí» de la pizarra
 * (TacticalBoard). Antes se armaba como «Poner jugadores (<etiqueta>)» y con
 * formaciones cuya etiqueta ya trae paréntesis salía «Poner jugadores
 * (Rotación (zonas 1-6))»: doble paréntesis y un texto que se salía del botón.
 * Ahora la formación va en su propia línea y sin paréntesis.
 */
export function startHintFormationLabel(formation: { key: string; label: string } | null | undefined): string {
  if (!formation) return '';
  if (formation.key === 'f7-2-3-1') return 'F7 2-3-1';
  return formation.label.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
}
