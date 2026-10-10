import type { AthleteRef, AthleteType } from '@/lib/api/chargeBatches';

/** Fila de la vista `school_athletes` (lo que el modal necesita de ella). */
export interface SchoolAthlete {
    id: string;
    athlete_type: AthleteType | string | null;
    full_name: string | null;
    parent_id: string | null;
    parent_name: string | null;
    parent_email: string | null;
    parent_phone: string | null;
    team_id: string | null;
    team_name: string | null;
    plan_name: string | null;
    offering_plan_id: string | null;
    enrollment_status: string | null;
    is_active: boolean | null;
}

export function athleteRefOf(a: Pick<SchoolAthlete, 'id' | 'athlete_type'>): AthleteRef {
    const t = a.athlete_type === 'adult' || a.athlete_type === 'unregistered' ? a.athlete_type : 'child';
    return { type: t, id: a.id };
}

/** ¿Tiene a quién cobrarle en línea? Menor: acudiente vinculado; adulto con cuenta: él mismo. */
export function payerLinked(a: Pick<SchoolAthlete, 'athlete_type' | 'parent_id'>): boolean {
    if (a.athlete_type === 'adult') return true;
    if (a.athlete_type === 'unregistered') return false;
    return !!a.parent_id;
}
