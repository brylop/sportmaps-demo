import React from 'react';
import { EventWizardState, WizardAction } from './WizardTypes';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface Props {
  state: EventWizardState;
  dispatch: React.Dispatch<WizardAction>;
}

export function Step4Rules({ state, dispatch }: Props) {
  const { rules } = state;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    dispatch({ type: 'UPDATE_RULES', payload: { [e.target.name]: val } });
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
            <Input name="registration_deadline" type="date" value={rules.registration_deadline} onChange={handleChange} />
            <p className="text-xs text-muted-foreground">Fecha máxima para afiliar equipos y atletas en plataforma.</p>
          </div>
          <div className="space-y-2">
            <Label>Límite de Pagos *</Label>
            <Input name="payment_deadline" type="date" value={rules.payment_deadline} onChange={handleChange} />
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
              <Input name="free_package_every" type="number" min={1} value={rules.free_package_every} onChange={handleChange} />
              <p className="text-xs text-muted-foreground">Ej. 1 hospedaje/inscripción gratis por cada X atletas.</p>
            </div>
            
            <div className="space-y-2">
              <Label>Precio Entrenador Extra (USD)</Label>
              <Input name="coach_discount_usd" type="number" min={0} value={rules.coach_discount_usd} onChange={handleChange} />
            </div>

            <div className="space-y-2">
              <Label>Precio Acompañante Extra (USD)</Label>
              <Input name="companion_discount_usd" type="number" min={0} value={rules.companion_discount_usd} onChange={handleChange} />
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
