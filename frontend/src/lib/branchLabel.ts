// Nombre corto de una sede para controles angostos: «Sede Suba» → «Suba».
// Si quitar el prefijo la deja vacía («Sede»), se conserva el nombre completo.
export function branchShortLabel(name: string): string {
  const corto = name.trim().replace(/^sede\s+/i, '').trim();
  return corto || name.trim();
}

// Con nombres largos los segmentos no caben en el menú lateral: se pasa a lista.
export const MAX_SEGMENT_LABEL = 9;
export function needsStackedLayout(labels: string[]): boolean {
  return labels.some((l) => l.length > MAX_SEGMENT_LABEL);
}
