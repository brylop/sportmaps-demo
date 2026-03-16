// src/lib/athleteUtils.ts

export interface SchoolAthlete {
    id: string;
    full_name: string;
    avatar_url: string | null;
    school_id: string;
    athlete_type: 'adult' | 'child';
    user_id: string | null;
    parent_id: string | null;
    enrollment_id: string | null;
    enrollment_status: string | null;
    enrolled_team_id: string | null;
    offering_plan_id: string | null;
    sessions_used: number;
    secondary_sessions_used: number;
    expires_at: string | null;
    team_name: string | null;
    team_sport: string | null;
    parent_name: string | null;
    parent_email: string | null;
}

/**
 * Retorna los IDs correctos para operaciones según tipo de atleta.
 */
export function getAthleteIds(athlete: SchoolAthlete): {
    userId: string | null;
    childId: string | null;
    primaryId: string;  // El ID principal para mostrar y referenciar
} {
    return {
        userId: athlete.athlete_type === 'adult' ? athlete.id : null,
        childId: athlete.athlete_type === 'child' ? athlete.id : null,
        primaryId: athlete.id,
    };
}

/**
 * Payload para session_bookings.
 */
export function getBookingPayload(athlete: SchoolAthlete): {
    user_id: string | null;
    child_id: string | null;
} {
    const { userId, childId } = getAthleteIds(athlete);
    return { user_id: userId, child_id: childId };
}

/**
 * Payload para payments (legacy).
 */
export function getPaymentPayload(athlete: SchoolAthlete): {
    user_id?: string;
    child_id?: string;
} {
    return athlete.athlete_type === 'adult'
        ? { user_id: athlete.id }
        : { child_id: athlete.id };
}
