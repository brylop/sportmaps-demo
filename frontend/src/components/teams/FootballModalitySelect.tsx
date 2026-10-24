import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FOOTBALL_MODALITIES, isFootballModality, sportAllowsModality } from '@/lib/sports/footballModality';

interface FootballModalitySelectProps {
  sport: string | null | undefined;
  /** '11' | '7' | '5' | '' (sin definir). */
  value: string | null | undefined;
  onChange: (value: string) => void;
  id?: string;
}

const AUTO = 'auto';

/**
 * «Modalidad» del equipo de fútbol: define la cancha de la pizarra táctica
 * (11, 7 o 5) sin depender de que el nombre diga «F7». Solo se muestra si el
 * deporte es Fútbol; en los demás no hay nada que escoger.
 */
export function FootballModalitySelect({ sport, value, onChange, id = 'sport-modality' }: FootballModalitySelectProps) {
  if (!sportAllowsModality(sport)) return null;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Modalidad</Label>
      <Select value={isFootballModality(value) ? value : AUTO} onValueChange={(v) => onChange(v === AUTO ? '' : v)}>
        <SelectTrigger id={id} data-testid="football-modality">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={AUTO}>Sin definir (según el nombre)</SelectItem>
          {FOOTBALL_MODALITIES.map((m) => (
            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">Define la cancha de la pizarra táctica.</p>
    </div>
  );
}
