import React, { useReducer, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { wizardReducer, initialWizardState } from '@/components/organizer/wizard/WizardTypes';
import { Step1EventInfo } from '@/components/organizer/wizard/Step1EventInfo';
import { Step2Categories } from '@/components/organizer/wizard/Step2Categories';
import { Step3Packages } from '@/components/organizer/wizard/Step3Packages';
import { Step4Rules } from '@/components/organizer/wizard/Step4Rules';
import { Step5PaymentConfig } from '@/components/organizer/wizard/Step5PaymentConfig';

export default function CreateEventPage() {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(wizardReducer, initialWizardState);

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('sportmaps_event_wizard');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.step) {
          dispatch({ type: 'LOAD_STATE', payload: parsed });
        }
      } catch (e) {
        console.error('Failed to parse wizard state', e);
      }
    }
  }, []);

  // Save to local storage on state change
  useEffect(() => {
    if (state !== initialWizardState) {
      localStorage.setItem('sportmaps_event_wizard', JSON.stringify(state));
    }
  }, [state]);

  const steps = [
    { title: 'Info Básica', component: Step1EventInfo, desc: 'Datos y ubicación' },
    { title: 'Categorías', component: Step2Categories, desc: 'Divisiones y niveles' },
    { title: 'Paquetes', component: Step3Packages, desc: 'Fases y precios' },
    { title: 'Fechas', component: Step4Rules, desc: 'Reglas y cortes' },
    { title: 'Pagos', component: Step5PaymentConfig, desc: 'Métodos y cierre' }
  ];

  const CurrentStepComponent = steps[state.step - 1].component;

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/organizer/dashboard')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Crear Evento Deportivo</h1>
          <p className="text-muted-foreground">Configura todos los aspectos de tu evento paso a paso</p>
        </div>
      </div>

      {/* Progress Bar / Steps indicator */}
      <div className="mb-8 hidden md:block">
        <div className="flex justify-between items-center relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 -z-10 rounded"></div>
          <div 
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary -z-10 rounded transition-all duration-300"
            style={{ width: `${((state.step - 1) / (steps.length - 1)) * 100}%` }}
          ></div>
          
          {steps.map((s, idx) => {
            const stepNum = idx + 1;
            const isCompleted = state.step > stepNum;
            const isCurrent = state.step === stepNum;
            
            return (
              <div key={idx} className="flex flex-col items-center">
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-4 transition-colors ${
                    isCompleted ? 'bg-primary border-primary text-white' : 
                    isCurrent ? 'bg-white border-primary text-primary' : 
                    'bg-slate-50 border-slate-200 text-slate-400'
                  }`}
                  onClick={() => stepNum < state.step && dispatch({ type: 'SET_STEP', payload: stepNum })}
                  style={{ cursor: stepNum < state.step ? 'pointer' : 'default' }}
                >
                  {stepNum}
                </div>
                <div className={`mt-2 text-sm font-medium ${isCurrent ? 'text-primary' : 'text-slate-500'}`}>
                  {s.title}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader className="bg-slate-50/50 border-b pb-4">
          <CardTitle>Paso {state.step}: {steps[state.step - 1].title}</CardTitle>
          <CardDescription>{steps[state.step - 1].desc}</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <CurrentStepComponent state={state} dispatch={dispatch} />
        </CardContent>
      </Card>
      
      {state.step > 1 && (
        <div className="mt-4 text-center">
          <Button variant="link" className="text-muted-foreground text-xs" onClick={() => {
            if (confirm('¿Estás seguro de reiniciar? Se perderán todos los datos no guardados.')) {
              dispatch({ type: 'RESET' });
              localStorage.removeItem('sportmaps_event_wizard');
            }
          }}>
            Reiniciar formato
          </Button>
        </div>
      )}
    </div>
  );
}
