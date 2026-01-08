// Helper para manejar inscripciones pendientes en localStorage

const PENDING_ENROLLMENT_KEY = 'sportmaps_pending_enrollment';

export interface PendingEnrollment {
  programId: string;
  programName: string;
  schoolId: string;
  schoolName: string;
  amount: number;
  savedAt: number;
}

export function savePendingEnrollment(enrollment: Omit<PendingEnrollment, 'savedAt'>) {
  const data: PendingEnrollment = {
    ...enrollment,
    savedAt: Date.now(),
  };
  localStorage.setItem(PENDING_ENROLLMENT_KEY, JSON.stringify(data));
}

export function getPendingEnrollment(): PendingEnrollment | null {
  try {
    const stored = localStorage.getItem(PENDING_ENROLLMENT_KEY);
    if (!stored) return null;
    
    const enrollment = JSON.parse(stored) as PendingEnrollment;
    
    // Expira después de 24 horas
    const ONE_DAY = 24 * 60 * 60 * 1000;
    if (Date.now() - enrollment.savedAt > ONE_DAY) {
      clearPendingEnrollment();
      return null;
    }
    
    return enrollment;
  } catch {
    return null;
  }
}

export function clearPendingEnrollment() {
  localStorage.removeItem(PENDING_ENROLLMENT_KEY);
}

export function hasPendingEnrollment(): boolean {
  return getPendingEnrollment() !== null;
}
