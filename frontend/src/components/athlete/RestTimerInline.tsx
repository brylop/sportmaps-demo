import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, SkipForward, Plus, Minus } from 'lucide-react';

interface RestTimerInlineProps {
  remaining:  number;
  total:      number;
  progress:   number; // 0→1
  isPaused:   boolean;
  onPause:    () => void;
  onResume:   () => void;
  onSkip:     () => void;
  onAdjust:   (delta: number) => void;
}

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function RestTimerInline({
  remaining, total, progress, isPaused,
  onPause, onResume, onSkip, onAdjust,
}: RestTimerInlineProps) {
  const isLow = remaining <= 10 && remaining > 0;

  return (
    <div className={`mt-3 rounded-xl border px-4 py-3 space-y-2 transition-colors ${
      isLow
        ? 'bg-orange-500/10 border-orange-500/30'
        : 'bg-primary/5 border-primary/20'
    }`}>
      {/* Fila principal */}
      <div className="flex items-center justify-between gap-3">
        {/* Etiqueta */}
        <span className={`text-[10px] font-black uppercase tracking-widest ${
          isLow ? 'text-orange-500' : 'text-primary'
        }`}>
          ⏱ Descanso
        </span>

        {/* Tiempo */}
        <span className={`text-xl font-black tabular-nums leading-none ${
          isLow ? 'text-orange-500 animate-pulse' : 'text-foreground'
        }`}>
          {fmt(remaining)}
        </span>

        {/* Controles */}
        <div className="flex items-center gap-1">
          {/* Ajuste -15s */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => onAdjust(-15)}
            title="-15s"
          >
            <Minus className="h-3 w-3" />
          </Button>

          {/* Pausa / Reanudar */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={isPaused ? onResume : onPause}
          >
            {isPaused
              ? <Play   className="h-3.5 w-3.5 text-primary fill-primary" />
              : <Pause  className="h-3.5 w-3.5 text-primary" />
            }
          </Button>

          {/* Ajuste +15s */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => onAdjust(15)}
            title="+15s"
          >
            <Plus className="h-3 w-3" />
          </Button>

          {/* Saltar */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={onSkip}
            title="Saltar descanso"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="h-1 w-full rounded-full bg-muted/40 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            isLow ? 'bg-orange-500' : 'bg-primary'
          }`}
          style={{ width: `${(1 - progress) * 100}%` }}
        />
      </div>

      {isPaused && (
        <p className="text-[10px] text-center text-muted-foreground font-medium">
          Pausado — toca ▶ para continuar
        </p>
      )}
    </div>
  );
}
