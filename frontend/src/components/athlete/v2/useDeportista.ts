/**
 * Quién es el deportista que mira la pantalla y si paga lo suyo.
 * Regla mayor/menor en athleteV2Model (decisión 6 del contrato).
 */
import { useAuth } from '@/contexts/AuthContext';
import { edadDeportista, puedePagar, type Edad } from './athleteV2Model';
import { useAthleteCobros } from './useAthleteV2Data';

export interface Deportista {
  userId: string | undefined;
  nombre: string;
  edad: Edad;
  /** Mayor (o pagador explícito sin fecha de nacimiento). El menor: siempre false. */
  paga: boolean;
  cobros: ReturnType<typeof useAthleteCobros>;
}

export function useDeportista(): Deportista {
  const { user, profile } = useAuth();
  const edad = edadDeportista(profile?.date_of_birth ?? null);
  // Al menor NO se le consultan cobros: no hay nada que mostrarle.
  const cobros = useAthleteCobros(user?.id, edad !== 'menor');
  const paga = puedePagar(
    edad,
    user?.id,
    (cobros.data?.filas ?? []).map((f) => ({ parent_id: f.parent_id ?? null, user_id: f.user_id ?? null, child_id: f.child_id ?? null })),
  );
  return { userId: user?.id, nombre: profile?.full_name ?? '', edad, paga, cobros };
}
