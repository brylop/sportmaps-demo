/**
 * «¿Quién tiene el balón?» del cuadro abierto (M6g, Definir la posesión del
 * balón). Se ve con el ajuste prendido y la pizarra en edición. Elegir a un
 * jugador pega el balón a sus pies en ese cuadro; en la reproducción el balón
 * se mueve con él y, cuando cambia de dueño entre cuadros, se dibuja el pase.
 */
import { useId } from 'react';
import { shortPlayerName } from './tacticalBoardPrefs';

export interface PossessionCandidate {
  key: string;
  name: string;
  /** Dorsal o etiqueta del puesto, para distinguir homónimos. */
  hint?: string | null;
}

export function TacticalPossessionBar({ frameNumber, candidates, value, onChange, disabled }: {
  frameNumber: number;
  candidates: PossessionCandidate[];
  value: string | null;
  onChange: (key: string | null) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const current = value && candidates.some((c) => c.key === value) ? value : '';
  return (
    <div data-board-chrome="" className="flex items-center justify-center gap-2 px-3 py-1 text-xs text-white/85">
      <label htmlFor={id} className="whitespace-nowrap font-semibold">
        Balón en el cuadro {frameNumber}:
      </label>
      <select
        id={id}
        aria-label="Quién tiene el balón en este cuadro"
        value={current}
        disabled={disabled || candidates.length === 0}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-8 max-w-[220px] rounded-md border border-white/20 bg-zinc-900 px-2 text-xs text-white [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:text-[16px]"
      >
        <option value="">Suelto (nadie lo tiene)</option>
        {candidates.map((c) => (
          <option key={c.key} value={c.key}>
            {shortPlayerName(c.name)}{c.hint ? ` · ${c.hint}` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
