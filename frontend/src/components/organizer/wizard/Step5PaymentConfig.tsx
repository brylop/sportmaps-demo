import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EventWizardState, WizardAction } from './WizardTypes';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, CalendarCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const SYSTEM_PAYMENT_METHODS = [
  { id: 'bank_transfer', label: 'Transferencia Bancaria (Manual)' },
  { id: 'wompi', label: 'WompiGateway (Tarjetas y PSE)' },
  { id: 'epayco', label: 'ePayco (Tarjetas, PSE, Efectivo)' },
  { id: 'cash', label: 'Pago Presencial en Evento' }
];

interface Props {
  state: EventWizardState;
  dispatch: React.Dispatch<WizardAction>;
}

export function Step5PaymentConfig({ state, dispatch }: Props) {
  const { paymentConfig } = state;
  const { toast } = useToast();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);

  const togglePaymentMethod = (methodId: string) => {
    const current = paymentConfig.payment_methods || [];
    const updated = current.includes(methodId)
      ? current.filter(m => m !== methodId)
      : [...current, methodId];
    dispatch({ type: 'UPDATE_PAYMENT_CONFIG', payload: { payment_methods: updated } });
  };

  const submitEvent = async () => {
    // Basic validations
    if (!state.eventInfo.title || !state.eventInfo.event_date) {
      toast({ title: 'Datos Faltantes', description: 'Por favor regresa al Paso 1 y completa el título y fecha.', variant: 'destructive' });
      return;
    }
    
    setLoading(true);
    try {
      // Join states into full payload
      const payload = {
        ...state.eventInfo,
        ...state.rules,
        ...state.paymentConfig,
        categories: state.categories,
        price_phases: state.pricePhases,
      };

      const response = await fetch(`${API_URL}/api/v1/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Error al guardar el evento');
      }

      const newEvent = await response.json();
      
      toast({ title: '¡Evento Creado!', description: 'El evento ha sido creado exitosamente como Borrador.' });
      dispatch({ type: 'RESET' }); // Clear wizard
      navigate(`/organizer/event/${newEvent.id}`);

    } catch (error: any) {
      console.error(error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
      <Card>
        <CardHeader>
          <CardTitle>Métodos de Pago del Evento</CardTitle>
          <CardDescription>
            Selecciona cómo podrán pagar las delegaciones. Estas opciones reemplazarán la configuración global de tu perfil solo para este evento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SYSTEM_PAYMENT_METHODS.map(method => (
              <div key={method.id} className="flex items-center space-x-2 border p-4 rounded-lg bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                <Checkbox 
                  id={method.id} 
                  checked={paymentConfig.payment_methods.includes(method.id)}
                  onCheckedChange={() => togglePaymentMethod(method.id)}
                />
                <label htmlFor={method.id} className="text-sm font-medium leading-none cursor-pointer flex-1">
                  {method.label}
                </label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-8 flex flex-col items-center justify-center text-center space-y-4">
          <CalendarCheck className="h-16 w-16 text-primary" />
          <h3 className="text-2xl font-bold text-primary">Todo listo para crear tu evento</h3>
          <p className="text-muted-foreground max-w-md">
            Al finalizar, tu evento se guardará en modo Borrador. Podrás revisar y ajustar todos los detalles antes de abrir las inscripciones al público.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-between pt-4 pb-10">
        <Button variant="outline" onClick={() => dispatch({ type: 'PREV_STEP' })} disabled={loading}>Atrás</Button>
        <Button onClick={submitEvent} disabled={loading} className="min-w-32 bg-green-600 hover:bg-green-700 text-white">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Finalizar y Crear Evento
        </Button>
      </div>
    </div>
  );
}
