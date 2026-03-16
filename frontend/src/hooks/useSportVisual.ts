import { useSchoolFeatures } from './useSchoolFeatures';
import { getSportVisual, SportVisual, DEFAULT_VISUAL } from '@/lib/sportVisuals';

/**
 * Retorna los visuales del deporte principal de la escuela.
 * Si la escuela no tiene sport_configs activos, retorna DEFAULT_VISUAL.
 * Nunca hardcodea el deporte — todo viene de school_context.
 */
export function useSportVisual(): SportVisual {
    const { primarySport } = useSchoolFeatures();
    return getSportVisual(primarySport?.sport);
}

/**
 * Retorna los visuales de un deporte específico.
 * Útil cuando la escuela tiene múltiples deportes.
 */
export function useSportVisualFor(sport: string | null | undefined): SportVisual {
    return getSportVisual(sport);
}

/**
 * Retorna si la escuela tiene múltiples deportes configurados.
 * Útil para mostrar selector de deporte en el Owner dashboard.
 */
export function useIsMultiSport(): boolean {
    const { sports } = useSchoolFeatures();
    return sports.length > 1;
}
