import { useTrainerContext } from '@/hooks/useTrainerContext';
import PaymentsAutomationPage from '@/pages/PaymentsAutomationPage';

/**
 * TrainerPayments — wrapper del módulo de pagos para el entrenador personal.
 * El trainerSchoolId es el boundary — RLS garantiza que solo se ven
 * los pagos relacionados a la micro-escuela del entrenador.
 */
export default function TrainerPayments() {
  const { trainerSchoolId } = useTrainerContext();

  if (!trainerSchoolId) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-muted-foreground text-sm">Cargando configuración...</p>
      </div>
    );
  }

  return <PaymentsAutomationPage />;
}
