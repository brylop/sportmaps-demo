/**
 * tournaments — llamadas al BFF para inscripción/pago de torneos y ligas
 * INTERNAS de una escuela (padre/atleta). Ver
 * docs/specs/torneos-internos-inscripcion-pago-2026-09-01.md Fase 3.
 */
import { bffClient } from '@/lib/api/bffClient';

export interface TournamentCategory {
    id: string;
    division: string;
    level: string;
    category: string;
    rama: string;
    age_min: number | null;
    age_max: number | null;
    active: boolean;
}

export interface TournamentPricePhase {
    id: string;
    phase_name: string;
    valid_until: string;
    price_solo: number;
}

export interface MyRegistration {
    id: string;
    category_id: string;
    child_id: string | null;
    participant_name: string;
    status: string;
    payment_id: string | null;
    payment: { status: string; amount: number; due_date: string } | null;
}

export interface IndividualRegistration {
    id: string;
    participant_name: string;
    participant_role: string;
    category_id: string;
    status: string;
    team_id: string | null;
    created_at: string;
    payment: { id: string; status: string; amount: number; due_date: string } | null;
    team: { id: string; team_name: string } | null;
}

export interface TournamentForParticipant {
    id: string;
    title: string;
    sport: string;
    city: string;
    event_date: string;
    status: string;
    tournament_scope: string;
    registrations_open: boolean;
    school_id: string;
    categories: TournamentCategory[];
    phases: TournamentPricePhase[];
    my_registrations: MyRegistration[];
}

export interface OpenTournament {
    id: string;
    title: string;
    sport: string;
    city: string;
    event_date: string;
    school: { name: string } | null;
}

export interface PublicStanding {
    team_id: string;
    team_name: string;
    P: number; W: number; D: number; L: number; GF: number; GA: number; GD: number; Pts: number;
}

export interface PublicResults {
    title: string;
    sport: string;
    city: string;
    event_date: string;
    school_name: string | null;
    standings: PublicStanding[];
}

const BASE = '/api/v1/events';

export const getMyOpenTournaments = () =>
    bffClient.get<OpenTournament[]>(`${BASE}/my-open-tournaments`);

export const getForParticipant = (eventId: string) =>
    bffClient.get<TournamentForParticipant>(`${BASE}/school-tournaments/${eventId}/for-participant`);

export const register = (eventId: string, body: { category_id: string; child_id?: string | null }) =>
    bffClient.post<{ registration_id: string }>(`${BASE}/school-tournaments/${eventId}/register`, body);

export const getPublicResults = (eventId: string, categoryId?: string) =>
    bffClient.get<PublicResults>(
        `${BASE}/school-tournaments/${eventId}/public-results${categoryId ? `?category_id=${categoryId}` : ''}`,
        undefined,
        'public',
    );

// ── Lado escuela (Fase 4) ───────────────────────────────────────────────────
export const getIndividualRegistrations = (eventId: string) =>
    bffClient.get<IndividualRegistration[]>(`${BASE}/school-tournaments/${eventId}/individual-registrations`);

export const assignTeams = (
    eventId: string,
    categoryId: string,
    assignments: Array<{ team_name: string; registration_ids: string[] }>,
) =>
    bffClient.post<{ teams_created: number; members_assigned: number }>(
        `${BASE}/school-tournaments/${eventId}/categories/${categoryId}/assign-teams`,
        { assignments },
    );
