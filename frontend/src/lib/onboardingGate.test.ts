import { describe, expect, it } from 'vitest';
import { resolveOnboardingGateStatus } from './onboardingGate';

describe('resolveOnboardingGateStatus', () => {
  it('mientras el servidor no responde, no decide (evita el rebote al asistente)', () => {
    expect(resolveOnboardingGateStatus({ loading: true, serverStatus: null, fallbackStatus: 'in_progress' })).toBeNull();
  });
  it('con respuesta del servidor, manda el servidor aunque el respaldo diga otra cosa', () => {
    // Dueño de «pollitos» (in_progress) y miembro de otra escuela completada:
    // el servidor contesta «completed» y no debe ir al asistente.
    expect(resolveOnboardingGateStatus({ loading: false, serverStatus: 'completed', fallbackStatus: 'in_progress' })).toBe('completed');
  });
  it('si el servidor no trae estado, usa el respaldo (el wizard sigue apareciendo)', () => {
    expect(resolveOnboardingGateStatus({ loading: false, serverStatus: null, fallbackStatus: 'in_progress' })).toBe('in_progress');
    expect(resolveOnboardingGateStatus({ loading: false, serverStatus: undefined, fallbackStatus: 'pending' })).toBe('pending');
  });
  it('sin ninguno de los dos devuelve null', () => {
    expect(resolveOnboardingGateStatus({ loading: false, serverStatus: null, fallbackStatus: undefined })).toBeNull();
  });
});
