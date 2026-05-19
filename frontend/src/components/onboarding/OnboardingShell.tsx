import { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Check } from 'lucide-react';

/**
 * OnboardingShell — layout unificado para todos los onboardings (trainer,
 * school, vendor). Replica el diseño del TrainerOnboarding: badge
 * "Configuración inicial", titulo grande, subtitulo "Paso X de N",
 * barra de progreso, pills clickeables por paso, y card con el contenido
 * del paso actual.
 *
 * Cada onboarding mantiene su propia logica (handlers, state, API calls).
 * Este shell SOLO unifica visualmente.
 */

export interface ShellStep {
  /** Identificador unico del paso. */
  id: string;
  /** Texto corto que aparece en las pills (ej: "Tu Deporte"). */
  title: string;
  /** Texto que va en el subtitulo "Paso X de N: ..." y en la card. */
  description: string;
  /** Icono Lucide a usar en pills y en el header del card. */
  icon: React.ElementType;
  /** Si true, ya esta completado (muestra check en lugar del icono). */
  done?: boolean;
}

interface OnboardingShellProps {
  /** Titulo grande arriba (ej: "Configura tu workspace"). */
  title: string;
  /** Texto del badge de arriba. Default: "Configuración inicial". */
  eyebrow?: string;
  /** Lista completa de pasos en orden. */
  steps: ShellStep[];
  /** Indice del paso actual (0-based) en la lista de steps. */
  currentStep: number;
  /** Callback al clickear una pill — para navegar a ese paso. */
  onStepChange?: (index: number) => void;
  /** Contenido del paso actual (el body de la card). */
  children: ReactNode;
  /** Slot opcional para botones de navegacion (Anterior/Siguiente). */
  footer?: ReactNode;
  /** Si true, los pills no son clickeables. */
  lockPills?: boolean;
  /**
   * - `full`: full-screen con fondo gradient (trainer onboarding).
   * - `card`: solo el contenido — sin min-h-screen ni gradient, util cuando
   *   el shell se embede dentro del dashboard u otra pantalla.
   * Default: `full`.
   */
  variant?: 'full' | 'card';
}

export function OnboardingShell({
  title,
  eyebrow = 'Configuración inicial',
  steps,
  currentStep,
  onStepChange,
  children,
  footer,
  lockPills = false,
  variant = 'full',
}: OnboardingShellProps) {
  const stepInfo = steps[currentStep];
  if (!stepInfo) return null;

  // Progreso por pasos completados, no por currentStep (asi refleja real done state)
  const doneCount = steps.filter(s => s.done).length;
  const progress = Math.round((doneCount / steps.length) * 100);

  const StepIcon = stepInfo.icon;

  const inner = (
    <div className="w-full max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-4">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest text-primary">{eyebrow}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">{title}</h1>
          <p className="text-muted-foreground">
            Paso {currentStep + 1} de {steps.length}:{' '}
            <span className="font-medium text-foreground">{stepInfo.description}</span>
          </p>
        </div>

        {/* Progress bar */}
        <Progress value={progress} className="h-1.5 mb-8" />

        {/* Step pills */}
        <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isCurrent = idx === currentStep;
            const isDone = !!step.done;
            const clickable = !lockPills && !!onStepChange;
            return (
              <button
                key={step.id}
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepChange!(idx)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
                  isCurrent
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30'
                    : isDone
                    ? 'bg-primary/15 text-primary hover:bg-primary/25'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                } ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
              >
                {isDone ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                <span className="hidden sm:inline">{step.title}</span>
              </button>
            );
          })}
        </div>

        {/* Step content card */}
        <Card className="shadow-xl border-border/50 animate-in fade-in slide-in-from-bottom-4 duration-400">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <StepIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>{stepInfo.title}</CardTitle>
                <CardDescription>{stepInfo.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">{children}</CardContent>
        </Card>

      {/* Navigation footer */}
      {footer && <div className="flex items-center justify-between mt-6">{footer}</div>}
    </div>
  );

  if (variant === 'card') return inner;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      {inner}
    </div>
  );
}
