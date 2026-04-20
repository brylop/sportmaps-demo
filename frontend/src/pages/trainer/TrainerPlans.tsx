import { useTrainerContext } from '@/hooks/useTrainerContext';
import OfferingsPage from '@/pages/OfferingsPage';

/**
 * TrainerPlans — wrapper del módulo de planes/offerings existente.
 * El entrenador personal tiene su propia micro-escuela con school_id propio,
 * por lo que OfferingsPage funciona sin modificación interna.
 */
export default function TrainerPlans() {
  const { trainerSchoolId } = useTrainerContext();

  if (!trainerSchoolId) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-muted-foreground text-sm">Cargando configuración...</p>
      </div>
    );
  }

  return <OfferingsPage />;
}
