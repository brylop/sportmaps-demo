/**
 * Interruptor «El torneo tiene costo» + medios de pago, compartido por la
 * creación del torneo y la pestaña Info del detalle (un borrador viejo sin
 * medios no tendría de otra forma cómo publicarse).
 * Spec docs/specs/torneos-inscripcion-escuela-y-pago-2026-10-15.md (D2–D4).
 */
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import type { MedioDeCobro } from '@/lib/tournaments/mediosDeCobro';

interface Props {
  isPaid: boolean;
  onIsPaid: (v: boolean) => void;
  metodos: string[];
  onMetodos: (m: string[]) => void;
  /** Solo los que la escuela ya tiene configurados. */
  medios: MedioDeCobro[];
}

export function CobroTorneoFields({ isPaid, onIsPaid, metodos, onMetodos, medios }: Props) {
  const toggle = (key: string, on: boolean) =>
    onMetodos(on ? [...new Set([...metodos, key])] : metodos.filter((k) => k !== key));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border p-3">
        <Label htmlFor="is_paid" className="cursor-pointer">El torneo tiene costo</Label>
        <Switch id="is_paid" checked={isPaid} onCheckedChange={onIsPaid} />
      </div>
      {isPaid && (
        <div className="space-y-2">
          <Label>Medios de pago que aceptas *</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {medios.map((m) => (
              <label key={m.key} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm">
                <Checkbox checked={metodos.includes(m.key)} onCheckedChange={(v) => toggle(m.key, v === true)} />
                {m.label}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Solo aparecen los medios que ya configuraste en los datos de pago de la escuela.
          </p>
        </div>
      )}
    </div>
  );
}
