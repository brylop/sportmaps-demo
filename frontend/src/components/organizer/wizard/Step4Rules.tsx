import React from 'react';
import { EventWizardState, WizardAction } from './WizardTypes';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { sanitizePositiveInt } from '@/lib/inputSanitizers';

interface Props {
  state: EventWizardState;
  dispatch: React.Dispatch<WizardAction>;
}

export function Step4Rules({ state, dispatch }: Props) {
  const { rules } = state;

  const update = (field: string, value: string | number) => {
    dispatch({ type: 'UPDATE_RULES', payload: { [field]: value } });
  };

  const handleSwitchChange = (val: boolean) => {
    dispatch({ type: 'UPDATE_RULES', payload: { crossover_allowed: val } });
  };

  const handleNext = () => {
    dispatch({ type: 'NEXT_STEP' });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
      <Card>
        <CardHeader>
          <CardTitle>Cortes y Fechas Límite (Deadlines)</CardTitle>
          <CardDescription>Establece hasta cuándo pueden las academias realizar modificaciones.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Cierre de Inscripciones *</Label>
            <Input type="date" value={rules.registration_deadline} onChange={e => update('registration_deadline', e.target.value)} />
            <p className="text-xs text-muted-foreground">Fecha máxima para afiliar equipos y atletas en plataforma.</p>
          </div>
          <div className="space-y-2">
            <Label>Límite de Pagos *</Label>
            <Input type="date" value={rules.payment_deadline} onChange={e => update('payment_deadline', e.target.value)} />
            <p className="text-xs text-muted-foreground">Fecha máxima para cargar comprobantes de pago.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reglas Competitivas y Beneficios</CardTitle>
          <CardDescription>Configura las reglas de participación para los atletas y entrenadores.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div className="space-y-0.5">
              <Label className="text-base font-semibold">Crossover Permitido</Label>
              <p className="text-sm text-muted-foreground">Permite que un atleta participe en múltiples equipos.</p>
            </div>
            <Switch checked={rules.crossover_allowed} onCheckedChange={handleSwitchChange} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>Fórmula de Gratuidad (Entrenadores)</Label>
              <Input value={rules.free_package_every} onChange={e => update('free_package_every', Number(sanitizePositiveInt(e.target.value)) || 1)} inputMode="numeric" maxLength={3} />
              <p className="text-xs text-muted-foreground">Ej. 1 hospedaje/inscripción gratis por cada X atletas.</p>
            </div>

            <div className="space-y-2">
              <Label>Precio Entrenador Extra (USD)</Label>
              <Input value={rules.coach_discount_usd} onChange={e => update('coach_discount_usd', Number(sanitizePositiveInt(e.target.value)) || 0)} inputMode="numeric" maxLength={6} />
            </div>

            <div className="space-y-2">
              <Label>Precio Acompañante Extra (USD)</Label>
              <Input value={rules.companion_discount_usd} onChange={e => update('companion_discount_usd', Number(sanitizePositiveInt(e.target.value)) || 0)} inputMode="numeric" maxLength={6} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={() => dispatch({ type: 'PREV_STEP' })}>Atrás</Button>
        <Button onClick={handleNext}>Continuar: Pagos y Publicación</Button>
      </div>
    </div>
  );
}
