import { describe, it, expect, vi } from 'vitest';

// La rama clásica del menú (VITE_ENTRENADOR_V2=false) es la referencia de «lo que el coach tenía».
vi.mock('@/lib/feature-flags', async (orig) => ({ ...(await orig<typeof import('@/lib/feature-flags')>()), ENTRENADOR_V2: false }));

import { getNavigationByRole } from '@/config/navigation';
import { MENU_COACH_CLASICO, aplanar } from './coachMasModel';

describe('MENU_COACH_CLASICO sigue al menú clásico real del coach', () => {
  it('mismas rutas y mismo moduleKey que config/navigation.ts (rama ENTRENADOR_V2=false)', () => {
    const real = aplanar(getNavigationByRole('coach', () => true, () => true, true).flatMap((g) => g.items)).map((i) => i.href).sort();
    expect(MENU_COACH_CLASICO.map((i) => i.href).sort()).toEqual(real);
    const sinAgenda = aplanar(getNavigationByRole('coach', () => true, (k) => k !== 'gestion_deportiva_disponibilidad_coach', true).flatMap((g) => g.items)).map((i) => i.href);
    expect(sinAgenda).not.toContain('/coach-plans');
    expect(MENU_COACH_CLASICO.find((i) => i.href === '/coach-plans')?.moduleKey).toBe('gestion_deportiva_disponibilidad_coach');
  });
});
