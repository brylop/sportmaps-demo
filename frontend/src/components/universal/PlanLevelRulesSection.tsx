// "Ascenso y días" del editor de tarifas (F-F,
// docs/specs/dreamers-niveles-por-horas-y-progresion.md D9/D15).
//
//   · Días permitidos: 7 chips. Ninguno marcado = NULL = sin restricción
//     (lo de hoy). Con días, el atleta solo puede reservar esos días (422 en
//     el servidor) y el torniquete solo registra/avisa — nunca bloquea.
//   · Umbral de ascenso (plan DESTINO): solo visible si la escuela tiene
//     school_settings.level_progression_enabled. Solo sugiere; nunca cambia
//     planes por su cuenta (D4).
//
// Vive aparte de OfferingsManagement para que el formulario principal solo
// tenga que montar este bloque y mezclar el payload que devuelve.
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays, TrendingUp } from 'lucide-react';
import {
  COMPETITION_LEVELS,
  COMPETITION_LEVEL_LABEL,
  WEEKDAY_SHORT,
  type CompetitionLevel,
} from '@/lib/school/levelProgression';

export interface PlanLevelRules {
  allowed_days: number[];          // vacío = sin restricción
  threshold: string;               // '' = sin umbral
  min_level: CompetitionLevel | ''; // '' = cualquier nivel
}

export const EMPTY_LEVEL_RULES: PlanLevelRules = { allowed_days: [], threshold: '', min_level: '' };

export function levelRulesFromPlan(plan: any): PlanLevelRules {
  const days = Array.isArray(plan?.allowed_days_of_week) ? (plan.allowed_days_of_week as number[]) : [];
  return {
    allowed_days: [...days].sort((a, b) => a - b),
    threshold: plan?.promotion_threshold_points != null ? String(plan.promotion_threshold_points) : '',
    min_level: (plan?.promotion_min_competition_level as CompetitionLevel) ?? '',
  };
}

function toApi(r: PlanLevelRules) {
  return {
    allowed_days_of_week: r.allowed_days.length ? [...r.allowed_days].sort((a, b) => a - b) : null,
    promotion_threshold_points: r.threshold !== '' && !Number.isNaN(Number(r.threshold)) ? Number(r.threshold) : null,
    promotion_min_competition_level: r.min_level || null,
  };
}

/**
 * Solo manda lo que CAMBIÓ respecto de cómo se abrió el formulario: un plan
 * que nadie tocó en esta sección no escribe columnas nuevas (no depende de
 * que la migración esté aplicada para guardar el resto).
 */
export function levelRulesPayload(current: PlanLevelRules, initial: PlanLevelRules): Record<string, unknown> {
  const a = toApi(current);
  const b = toApi(initial);
  const out: Record<string, unknown> = {};
  (Object.keys(a) as (keyof typeof a)[]).forEach((k) => {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out[k] = a[k];
  });
  return out;
}

interface Props {
  value: PlanLevelRules;
  onChange: (next: PlanLevelRules) => void;
  progressionEnabled: boolean;
}

export function PlanLevelRulesSection({ value, onChange, progressionEnabled }: Props) {
  const toggleDay = (d: number) => {
    const has = value.allowed_days.includes(d);
    const next = has ? value.allowed_days.filter((x) => x !== d) : [...value.allowed_days, d];
    onChange({ ...value, allowed_days: next.sort((a, b) => a - b) });
  };

  return (
    <div className="space-y-3 rounded-lg border border-border/50 p-4">
      <Label className="text-sm font-medium flex items-center gap-1.5">
        <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> Ascenso y días
      </Label>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground flex items-center gap-1">
          <CalendarDays className="h-3 w-3" /> Días en que se puede reservar
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAY_SHORT.map((label, d) => {
            const active = value.allowed_days.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                aria-pressed={active}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all ${
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border/50 hover:text-foreground'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {value.allowed_days.length === 0
            ? 'Sin días marcados = se puede reservar cualquier día.'
            : 'Solo esos días. El torniquete no bloquea: si entra otro día, queda registrado y te avisamos.'}
        </p>
      </div>

      {progressionEnabled && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Puntaje para entrar a esta tarifa</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              className="h-9"
              placeholder="Ej. 34"
              value={value.threshold}
              onChange={(e) => onChange({ ...value, threshold: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nivel mínimo de competencia</Label>
            <Select
              value={value.min_level || 'any'}
              onValueChange={(v) => onChange({ ...value, min_level: v === 'any' ? '' : (v as CompetitionLevel) })}
            >
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Cualquier nivel</SelectItem>
                {COMPETITION_LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>{COMPETITION_LEVEL_LABEL[l]} o superior</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="col-span-2 text-[11px] text-muted-foreground">
            Cuando un atleta logre ese puntaje te avisamos y aparece en “Ascensos”. El cambio de tarifa siempre lo confirmas tú.
          </p>
        </div>
      )}
    </div>
  );
}
