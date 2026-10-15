/**
 * M6d — piso y colores elegidos en el diálogo «Campo», para los fondos de
 * cancha. Contexto y no prop: así cada fondo cambia UNA línea (los colores
 * vienen del hook) y CourtShell/FootballPitchBackground aplican el piso.
 * Sin proveedor (o configuración de siempre) = el dibujo de siempre, idéntico.
 */
import { createContext, useContext } from 'react';
import type { CourtColors } from '@/lib/school/tacticalSports';
import { resolveCourtLook, type CourtConfig, type CourtLook } from '@/lib/school/tacticalCourt';

export const CourtConfigContext = createContext<CourtConfig | null>(null);

/** Colores efectivos de una cancha: los del deporte, o los del «Campo» si se
 *  eligió algo. `look` es null cuando no hay nada elegido (dibujo de siempre). */
export function useCourtLook(base: CourtColors): { line: string; accent?: string; look: CourtLook | null } {
  const cfg = useContext(CourtConfigContext);
  if (!cfg) return { line: base.line, accent: base.accent, look: null };
  const look = resolveCourtLook(base, cfg);
  return { line: look.line, accent: look.accent, look };
}

export const useCourtConfig = () => useContext(CourtConfigContext);
