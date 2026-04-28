/**
 * ExerciseSearchInput.tsx
 * Input de nombre de ejercicio con autocompletado desde el proxy de wger.
 * 
 * Si el usuario selecciona un ejercicio del dropdown, el bloque queda
 * "vinculado" a wger (wger_id presente) y la descripción + imágenes
 * se guardan en el bloque para usarse en SessionExecution.
 * 
 * Si el usuario escribe libremente y no selecciona del dropdown,
 * el bloque funciona igual que antes (sin wger_id).
 * 
 * Ubicación: src/components/trainer/ExerciseSearchInput.tsx
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { bffClient } from '@/lib/api/bffClient';
import {
  WgerExercise,
  WgerBlockData,
  wgerExerciseToBlockData,
} from '@/lib/trainer/wgerTypes';
import { Loader2, Link2, Link2Off, Dumbbell } from 'lucide-react';

// ── Props ────────────────────────────────────────────────────────────────────

interface ExerciseSearchInputProps {
  /** Valor actual del nombre del ejercicio */
  value:       string;
  /** Datos wger actuales del bloque (null si no está vinculado) */
  wgerData?:   WgerBlockData | null;
  /** Se llama con el nuevo nombre y opcionalmente los datos wger al seleccionar */
  onChange:    (name: string, wgerData?: WgerBlockData | null) => void;
  /** Placeholder del input */
  placeholder?: string;
  className?:   string;
  disabled?:    boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// Mapeo de categorías de wger a block types de SportMaps
const WGER_CATEGORY_TO_BLOCK_TYPE: Record<string, string> = {
  'Arms':        'strength',
  'Legs':        'strength',
  'Chest':       'strength',
  'Back':        'strength',
  'Shoulders':   'strength',
  'Calves':      'strength',
  'Abs':         'strength',
  'Cardio':      'cardio',
  'Stretching':  'flexibility',
};

export function categoryToBlockType(category: string): string {
  return WGER_CATEGORY_TO_BLOCK_TYPE[category] ?? 'strength';
}

// ── Componente ────────────────────────────────────────────────────────────────

export function ExerciseSearchInput({
  value,
  wgerData,
  onChange,
  placeholder = 'Ej: Press de banca, Sentadilla...',
  className,
  disabled,
}: ExerciseSearchInputProps) {
  const [query,       setQuery]       = useState(value);
  const [suggestions, setSuggestions] = useState<WgerExercise[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [wgerAvailable, setWgerAvailable] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 350);

  // Sincronizar si el valor cambia desde afuera (ej: al editar una rutina existente)
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Buscar ejercicios cuando el query cambia
  useEffect(() => {
    if (!wgerAvailable) return;
    if (debouncedQuery.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    // Si hay un ejercicio wger vinculado y el nombre no cambió, no buscar
    if (wgerData && (wgerData.wger_name_es === debouncedQuery || wgerData.wger_name_en === debouncedQuery)) {
      return;
    }

    let cancelled = false;

    const search = async () => {
      setLoading(true);
      try {
        const data = await bffClient.get<{ results: WgerExercise[]; error?: string }>(
          `/api/v1/trainer/exercises/search?q=${encodeURIComponent(debouncedQuery)}&limit=8`
        );

        if (cancelled) return;

        if (data?.error === 'timeout') {
          setWgerAvailable(false);
          return;
        }

        setSuggestions(data?.results ?? []);
        setShowDropdown((data?.results?.length ?? 0) > 0);
      } catch {
        if (!cancelled) {
          // wger no disponible — degradar silenciosamente
          setWgerAvailable(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    search();
    return () => { cancelled = true; };
  }, [debouncedQuery, wgerAvailable, wgerData]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleInputChange = (newValue: string) => {
    setQuery(newValue);
    // Si el usuario edita el nombre, desvincula wger
    if (wgerData) {
      onChange(newValue, null);
    } else {
      onChange(newValue);
    }
  };

  const handleSelectExercise = useCallback((exercise: WgerExercise) => {
    const name = exercise.name_es ?? exercise.name_en;
    const blockData = wgerExerciseToBlockData(exercise);

    setQuery(name);
    setSuggestions([]);
    setShowDropdown(false);
    onChange(name, blockData);
  }, [onChange]);

  const handleClearWger = () => {
    onChange(query, null);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const isLinked = !!wgerData?.wger_id;

  return (
    <div ref={containerRef} className="relative">
      {/* Input principal */}
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          className={`h-9 pr-8 ${isLinked ? 'border-indigo-500/40 bg-indigo-500/5' : ''} ${className ?? ''}`}
          disabled={disabled}
        />

        {/* Indicador de estado en el lado derecho del input */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
          ) : isLinked ? (
            <button
              type="button"
              onClick={handleClearWger}
              title="Desvincular de wger"
              className="text-indigo-500 hover:text-muted-foreground transition-colors"
            >
              <Link2 className="h-3.5 w-3.5" />
            </button>
          ) : wgerAvailable ? (
            <Link2Off className="h-3.5 w-3.5 text-muted-foreground/30" />
          ) : null}
        </div>
      </div>

      {/* Badge de vinculación */}
      {isLinked && (
        <div className="flex items-center gap-1 mt-1">
          <Badge
            variant="outline"
            className="text-[9px] h-4 px-1.5 border-indigo-500/30 text-indigo-500 bg-indigo-500/5 font-bold"
          >
            🔗 wger · {wgerData!.muscle_names.slice(0, 2).join(', ')}
            {wgerData!.equipment_name && ` · ${wgerData!.equipment_name}`}
          </Badge>
        </div>
      )}

      {/* Dropdown de sugerencias */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-background border border-border/60 rounded-xl shadow-xl overflow-hidden">
          <div className="px-3 py-1.5 border-b border-border/30 bg-muted/20">
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
              Ejercicios — catálogo wger
            </p>
          </div>
          <div className="max-h-[240px] overflow-y-auto">
            {suggestions.map((exercise) => {
              const name          = exercise.name_es ?? exercise.name_en;
              const muscleNames   = exercise.muscles.map((m) => m.name_en).slice(0, 2).join(', ');
              const equipmentName = exercise.equipment[0]?.name ?? null;
              const hasImages     = exercise.images.length > 0;

              return (
                <button
                  key={exercise.wger_id}
                  type="button"
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent/50 transition-colors text-left group"
                  onMouseDown={(e) => {
                    // mousedown en vez de click para evitar que onBlur del input
                    // cierre el dropdown antes de procesar la selección
                    e.preventDefault();
                    handleSelectExercise(exercise);
                  }}
                >
                  {/* Miniatura de imagen o icono */}
                  <div className="h-8 w-8 rounded-lg bg-muted/40 border border-border/30 flex items-center justify-center shrink-0 overflow-hidden">
                    {hasImages ? (
                      <img
                        src={exercise.images[0]}
                        alt={name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Dumbbell className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>

                  {/* Info del ejercicio */}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                      {name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {muscleNames && (
                        <span className="text-[9px] text-muted-foreground font-medium">
                          💪 {muscleNames}
                        </span>
                      )}
                      {equipmentName && (
                        <span className="text-[9px] text-muted-foreground">
                          · {equipmentName}
                        </span>
                      )}
                      {exercise.is_compound && (
                        <Badge
                          variant="outline"
                          className="text-[8px] h-3 px-1 border-orange-500/30 text-orange-500"
                        >
                          compound
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Flecha */}
                  <span className="text-muted-foreground group-hover:text-primary text-xs shrink-0">
                    ↵
                  </span>
                </button>
              );
            })}
          </div>

          {/* Footer del dropdown */}
          <div className="px-3 py-1.5 border-t border-border/30 bg-muted/10">
            <p className="text-[8px] text-muted-foreground/60">
              Selecciona para vincular descripción e imágenes de ejecución
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
