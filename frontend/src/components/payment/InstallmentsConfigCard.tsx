// src/components/payment/InstallmentsConfigCard.tsx
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { CreditCard, DollarSign } from 'lucide-react';

interface InstallmentsConfigCardProps {
  settings: {
    allow_installments: boolean;
    max_installments_per_payment: number;
    min_installment_amount: number;
    installment_require_proof: boolean;
  };
  onChange: (updated: Partial<InstallmentsConfigCardProps['settings']>) => void;
}

const MIN_INSTALLMENTS = 2;
const MAX_INSTALLMENTS = 12;
const DEFAULT_INSTALLMENTS = 3;

/**
 * Borrador de texto para un input numérico controlado que SÍ deja borrar.
 *
 * Antes el campo era `value={settings.x}` + `onChange={parseInt(v) || 3}`:
 * al borrar el último dígito el input quedaba vacío, `parseInt('')` daba NaN
 * y el `|| 3` lo volvía a escribir en el mismo tick. En el celular se sentía
 * como "no deja borrar" (reporte de Athletic League, 2026-09-24).
 *
 * Acá lo que se escribe vive como string local; el número se confirma al
 * padre solo cuando parsea, y al salir del campo se normaliza (vacío →
 * valor por defecto, fuera de rango → al límite).
 */
function useDraftNumber(
  value: number,
  commit: (n: number) => void,
  normalize: (n: number) => number,
) {
  const [draft, setDraft] = useState(String(value));

  // Si el valor cambia desde afuera (carga inicial de settings, reset), se
  // re-sincroniza; si cambió porque nosotros mismos lo confirmamos, se deja
  // el texto tal cual para no pisar lo que la persona está escribiendo.
  useEffect(() => {
    setDraft(prev => (prev.trim() !== '' && Number(prev) === value ? prev : String(value)));
  }, [value]);

  const onChange = (raw: string) => {
    setDraft(raw);
    if (raw.trim() === '') return; // vacío se permite mientras escribe
    const n = Number(raw);
    if (Number.isFinite(n)) commit(n);
  };

  const onBlur = () => {
    const n = draft.trim() === '' ? NaN : Number(draft);
    const fixed = normalize(Number.isFinite(n) ? n : NaN);
    setDraft(String(fixed));
    if (fixed !== value) commit(fixed);
  };

  return { draft, onChange, onBlur };
}

export function InstallmentsConfigCard({ settings, onChange }: InstallmentsConfigCardProps) {
  const maxInstallments = useDraftNumber(
    settings.max_installments_per_payment,
    n => onChange({ max_installments_per_payment: n }),
    n => (Number.isNaN(n)
      ? DEFAULT_INSTALLMENTS
      : Math.min(MAX_INSTALLMENTS, Math.max(MIN_INSTALLMENTS, Math.round(n)))),
  );

  const minAmount = useDraftNumber(
    settings.min_installment_amount,
    n => onChange({ min_installment_amount: n }),
    n => (Number.isNaN(n) || n < 0 ? 0 : n),
  );

  return (
    <Card className="md:col-span-1 border-emerald-100/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-5 w-5 text-emerald-500" />
          Abonos (Pagos Parciales)
        </CardTitle>
        <CardDescription>Permite a los padres pagar en cuotas.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Label className="font-medium">Permitir abonos</Label>
            <p className="text-xs text-muted-foreground">Los padres pueden pagar parcialmente</p>
          </div>
          <Switch 
            checked={settings.allow_installments} 
            onCheckedChange={(v) => onChange({ allow_installments: v })} 
          />
        </div>

        <div className={`space-y-5 transition-all duration-300 ${!settings.allow_installments ? 'opacity-40 pointer-events-none grayscale-[0.5]' : ''}`}>
          <div className="space-y-2">
            <Label htmlFor="max_installments">Máximo de abonos por pago</Label>
            <div className="flex items-center gap-2">
              <Input 
                id="max_installments" 
                type="number" 
                inputMode="numeric"
                min={MIN_INSTALLMENTS} 
                max={MAX_INSTALLMENTS} 
                className="w-24" 
                value={maxInstallments.draft} 
                onChange={(e) => maxInstallments.onChange(e.target.value)} 
                onBlur={maxInstallments.onBlur}
              />
              <span className="text-sm text-muted-foreground">abonos por mensualidad</span>
            </div>
            <p className="text-[10px] text-muted-foreground italic">Entre {MIN_INSTALLMENTS} y {MAX_INSTALLMENTS}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="min_amount">Monto mínimo por abono</Label>
            <div className="relative w-40">
              <Input 
                id="min_amount" 
                type="number" 
                inputMode="decimal"
                min={0} 
                className="pl-8" 
                value={minAmount.draft} 
                onChange={(e) => minAmount.onChange(e.target.value)} 
                onBlur={minAmount.onBlur}
              />
              <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-[10px] text-muted-foreground italic">Ej: $10.000 COP. En 0 no hay mínimo.</p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              <Label className="font-medium">Exigir comprobante en abonos</Label>
              <p className="text-xs text-muted-foreground">El padre debe subir foto del recibo</p>
            </div>
            <Switch 
              checked={settings.installment_require_proof} 
              onCheckedChange={(v) => onChange({ installment_require_proof: v })} 
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
