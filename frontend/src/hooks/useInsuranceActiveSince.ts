/**
 * ¿El atleta (que ya existe) tiene un seguro de los últimos 12 meses en la escuela?
 *
 * Lo responde el BFF (POST /api/v1/students/first-payment-preview con user_id),
 * con el mismo criterio que emit_enrollment_fees: si lo tiene, el alta NO crea
 * otro cobro de seguro y el formulario no debe sumarlo al primer cobro.
 * Atleta nuevo (sin id) = nunca tiene → null sin llamar a nadie.
 */
import { useEffect, useState } from 'react';
import { bffClient } from '@/lib/api/bffClient';

export function useInsuranceActiveSince(p: {
  schoolId: string;
  planId: string | null;
  startDate: string;
  userId?: string | null;
  childId?: string | null;
  enabled: boolean;
}): string | null {
  const [since, setSince] = useState<string | null>(null);

  useEffect(() => {
    setSince(null);
    const athlete = p.userId ? { user_id: p.userId } : p.childId ? { child_id: p.childId } : null;
    if (!p.enabled || !p.planId || !p.startDate || !athlete || !p.schoolId) return;
    let cancelled = false;
    bffClient.post('/api/v1/students/first-payment-preview', {
      offering_plan_id: p.planId,
      start_date: p.startDate,
      ...athlete,
    }, { 'x-school-id': p.schoolId })
      .then((res: any) => { if (!cancelled) setSince(res?.insurance_active_since ?? null); })
      .catch(() => { /* sin dato: el formulario muestra el seguro como cobrable (el BFF igual no lo repite) */ });
    return () => { cancelled = true; };
  }, [p.schoolId, p.planId, p.startDate, p.userId, p.childId, p.enabled]);

  return since;
}
