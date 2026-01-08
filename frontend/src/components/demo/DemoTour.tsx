import { useEffect, useState } from 'react';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

interface DemoTourProps {
  role: 'school' | 'parent' | 'coach' | 'athlete';
  onComplete?: () => void;
}

export function DemoTour({ role, onComplete }: DemoTourProps) {
  const [run, setRun] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if tour should run
    const tourPending = sessionStorage.getItem('demo_tour_pending');
    const demoMode = sessionStorage.getItem('demo_mode');
    
    if (tourPending === 'true' && demoMode === 'true') {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        setRun(true);
        sessionStorage.removeItem('demo_tour_pending');
      }, 1000);
    }
  }, []);

  const getStepsForRole = (role: string): Step[] => {
    switch (role) {
      case 'school':
        return [
          {
            target: 'body',
            content: (
              <div className="space-y-2">
                <h3 className="text-lg font-bold">¡Bienvenido al Demo de SportMaps!</h3>
                <p>En 2 minutos te mostraré cómo SportMaps transforma la gestión de tu academia deportiva.</p>
                <p className="text-sm text-muted-foreground">Haz clic en "Siguiente" para comenzar el tour.</p>
              </div>
            ),
            placement: 'center',
          },
          {
            target: '[data-tour="revenue-card"]',
            content: (
              <div className="space-y-2">
                <h4 className="font-semibold">💰 Ingresos en Tiempo Real</h4>
                <p>Así ves tus ingresos mensuales. Esta academia genera <strong>$17.8M COP/mes</strong> con 87 estudiantes.</p>
                <p className="text-sm text-muted-foreground">Todo automatizado con cobros recurrentes.</p>
              </div>
            ),
            placement: 'bottom',
          },
          {
            target: '[data-tour="students-card"]',
            content: (
              <div className="space-y-2">
                <h4 className="font-semibold">👥 Estudiantes Activos</h4>
                <p><strong>87 estudiantes</strong> inscritos y pagando automáticamente cada mes.</p>
                <p className="text-sm text-muted-foreground">Sin perseguir pagos, sin Excel complicado.</p>
              </div>
            ),
            placement: 'bottom',
          },
          {
            target: '[data-tour="programs-card"]',
            content: (
              <div className="space-y-2">
                <h4 className="font-semibold">📚 Programas Deportivos</h4>
                <p><strong>4 programas activos</strong>: Fútbol Infantil, Juvenil, Porteros y Técnica.</p>
                <p className="text-sm text-muted-foreground">Gestiona horarios, precios y cupos desde un solo lugar.</p>
              </div>
            ),
            placement: 'bottom',
          },
          {
            target: '[data-tour="quick-actions"]',
            content: (
              <div className="space-y-2">
                <h4 className="font-semibold">⚡ Acciones Rápidas</h4>
                <p>Acceso rápido a:</p>
                <ul className="text-sm list-disc list-inside space-y-1">
                  <li>Ver cobros automáticos y pagos pendientes</li>
                  <li>Tu perfil público en el marketplace</li>
                  <li>App móvil para padres</li>
                  <li>Tienda de uniformes</li>
                </ul>
              </div>
            ),
            placement: 'left',
          },
          {
            target: 'body',
            content: (
              <div className="space-y-3">
                <h3 className="text-lg font-bold">🎉 ¡Tour Completado!</h3>
                <p>Ahora puedes explorar libremente todas las funcionalidades:</p>
                <ul className="text-sm list-disc list-inside space-y-1">
                  <li><strong>Explora</strong> - Ver tu academia en el marketplace</li>
                  <li><strong>Finanzas</strong> - Sistema de cobros automáticos</li>
                  <li><strong>Programas</strong> - Gestionar clases y horarios</li>
                  <li><strong>Estudiantes</strong> - Base de datos unificada</li>
                </ul>
                <p className="text-sm font-semibold text-primary mt-2">¿Listo para transformar tu academia?</p>
              </div>
            ),
            placement: 'center',
          },
        ];
      
      case 'parent':
        return [
          {
            target: 'body',
            content: (
              <div className="space-y-2">
                <h3 className="text-lg font-bold">¡Bienvenido Padre/Madre!</h3>
                <p>Te mostraré cómo encontrar la escuela deportiva perfecta para tus hijos en minutos.</p>
              </div>
            ),
            placement: 'center',
          },
          {
            target: '[data-tour="children-card"]',
            content: (
              <div className="space-y-2">
                <h4 className="font-semibold">👶 Tus Hijos</h4>
                <p>Aquí ves el progreso de tus hijos inscritos en programas deportivos.</p>
              </div>
            ),
            placement: 'bottom',
          },
          {
            target: '[data-tour="explore-link"]',
            content: (
              <div className="space-y-2">
                <h4 className="font-semibold">🔍 Explorar Escuelas</h4>
                <p>Busca entre <strong>150+ academias certificadas</strong> con precios transparentes y reseñas reales.</p>
              </div>
            ),
            placement: 'right',
          },
        ];
      
      default:
        return [];
    }
  };

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, action } = data;
    
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status as any)) {
      setRun(false);
      
      if (status === STATUS.FINISHED) {
        // Show conversion modal
        sessionStorage.setItem('show_conversion_modal', 'true');
        
        toast({
          title: "¡Tour completado!",
          description: "Ahora explora libremente todas las funcionalidades",
        });
      }
      
      onComplete?.();
    }
  };

  return (
    <Joyride
      steps={getStepsForRole(role)}
      run={run}
      continuous
      showProgress
      showSkipButton
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: '#248223',
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: 8,
          padding: 16,
        },
        buttonNext: {
          backgroundColor: '#248223',
          borderRadius: 6,
          padding: '8px 16px',
        },
        buttonBack: {
          color: '#666',
          marginRight: 8,
        },
      }}
      locale={{
        back: 'Atrás',
        close: 'Cerrar',
        last: 'Finalizar',
        next: 'Siguiente',
        skip: 'Saltar tour',
      }}
    />
  );
}