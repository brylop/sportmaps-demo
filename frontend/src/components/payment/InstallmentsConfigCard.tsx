// src/components/payment/InstallmentsConfigCard.tsx
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

export function InstallmentsConfigCard({ settings, onChange }: InstallmentsConfigCardProps) {
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
                min={2} 
                max={12} 
                className="w-24" 
                value={settings.max_installments_per_payment} 
                onChange={(e) => onChange({ max_installments_per_payment: parseInt(e.target.value) || 3 })} 
              />
              <span className="text-sm text-muted-foreground">abonos por mensualidad</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="min_amount">Monto mínimo por abono</Label>
            <div className="relative w-40">
              <Input 
                id="min_amount" 
                type="number" 
                min={0} 
                className="pl-8" 
                value={settings.min_installment_amount} 
                onChange={(e) => onChange({ min_installment_amount: parseFloat(e.target.value) || 0 })} 
              />
              <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-[10px] text-muted-foreground italic">Ej: $10.000 COP</p>
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
