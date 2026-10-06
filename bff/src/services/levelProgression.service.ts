// levelProgression.service — progresión competitiva por puntaje (F2/F3 de
// docs/specs/dreamers-niveles-por-horas-y-progresion.md; fase F-F de
// docs/specs/dreamers-reglas-completas-plan.md).
//
//   · La elegibilidad la calcula la RPC get_level_promotion_eligibility
//     (migración 20261005214258) — solo lectura, solo resultados cargados por
//     staff, nunca cambia el plan (D4: sugerido, nunca automático).
//   · El aviso al owner/admin solo corre con school_settings.level_progression_enabled
//     (D6). Sin el flag, cargar puntos es dato pasivo.
//   · Dedupe: un aviso por (tipo, inscripción, plan destino, temporada).

import { supabase } from '../config/supabase';
import { loadSchoolAdmins } from './schoolAdmins';

export const LEVEL_PROMOTION_NOTIFICATION_TYPE = 'level_promotion_eligible';
export const COMPETITION_LEVELS = ['club', 'regional', 'nacional', 'federacion'] as const;
export type CompetitionLevel = typeof COMPETITION_LEVELS[number];

export interface EligibilityRow {
    enrollment_id: string;
    subject_type: 'child' | 'profile' | 'unregistered';
    subject_id: string;
    athlete_name: string | null;
    current_plan_id: string;
    current_plan_name: string | null;
    current_threshold: number | null;
    best_result_id: string;
    best_points: number;
    best_level: CompetitionLevel | null;
    best_competition_date: string;
    suggested_plan_id: string | null;
    suggested_plan_name: string | null;
    suggested_threshold: number | null;
    suggested_min_level: CompetitionLevel | null;
    suggested_fee: number | null;
    qualifying_result_id: string | null;
    qualifying_points: number | null;
}

// ── Flag por escuela, con caché (mismo patrón que getHourBankSettings) ───────
const FLAG_TTL_MS = 5 * 60 * 1000;
const flagCache = new Map<string, { value: boolean; at: number }>();

export async function getLevelProgressionEnabled(schoolId: string): Promise<boolean> {
    const cached = flagCache.get(schoolId);
    if (cached && Date.now() - cached.at < FLAG_TTL_MS) return cached.value;

    const { data, error } = await supabase
        .from('school_settings')
        .select('level_progression_enabled')
        .eq('school_id', schoolId)
        .maybeSingle();

    // Columna inexistente (migración sin aplicar) o error = apagado.
    const value = !error && !!(data as any)?.level_progression_enabled;
    flagCache.set(schoolId, { value, at: Date.now() });
    return value;
}

export function invalidateLevelProgressionCache(schoolId?: string): void {
    if (schoolId) flagCache.delete(schoolId);
    else flagCache.clear();
}

/** Temporada = año calendario (D5). Acepta '2026' o 2026; si no, el año actual en Bogotá. */
export function parseSeason(raw: unknown, now: Date = new Date()): number | null {
    if (raw === undefined || raw === null || raw === '') {
        return Number(now.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }).slice(0, 4));
    }
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 2000 || n > 2100) return null;
    return n;
}

/** Temporada de un resultado: el año de su competition_date ('YYYY-MM-DD'). */
export function seasonOfDate(competitionDate: string): number {
    return Number(competitionDate.slice(0, 4));
}

export async function fetchEligibility(
    schoolId: string,
    season: number,
    enrollmentId?: string | null,
): Promise<EligibilityRow[]> {
    const { data, error } = await supabase.rpc('get_level_promotion_eligibility', {
        p_school_id: schoolId,
        p_season: season,
        ...(enrollmentId ? { p_enrollment_id: enrollmentId } : {}),
    });
    if (error) throw error;
    return (data || []) as EligibilityRow[];
}

/** Inscripciones activas con plan del sujeto (child/profile/unregistered) en la escuela. */
export async function findActiveEnrollmentsForSubject(
    schoolId: string,
    subjectType: 'child' | 'profile' | 'unregistered',
    subjectId: string,
): Promise<string[]> {
    const column = subjectType === 'child' ? 'child_id'
        : subjectType === 'profile' ? 'user_id'
        : 'unregistered_athlete_id';
    const { data } = await supabase
        .from('enrollments')
        .select('id')
        .eq('school_id', schoolId)
        .eq('status', 'active')
        .eq(column, subjectId)
        .not('offering_plan_id', 'is', null);
    return (data || []).map((r: any) => r.id);
}

/**
 * Decide qué avisos hacen falta: filas con plan sugerido que todavía no
 * tienen aviso (mismo tipo + inscripción + plan destino + temporada).
 * Pura — la lectura de avisos previos la hace notifyNewlyEligible.
 */
export function pendingPromotionNotices(
    rows: EligibilityRow[],
    alreadyNotified: Array<{ enrollment_id?: string; target_plan_id?: string; season?: number | string }>,
    season: number,
): EligibilityRow[] {
    const seen = new Set(
        alreadyNotified.map((d) => `${d.enrollment_id}|${d.target_plan_id}|${Number(d.season)}`),
    );
    return rows.filter((r) =>
        !!r.suggested_plan_id && !seen.has(`${r.enrollment_id}|${r.suggested_plan_id}|${season}`),
    );
}

function formatCop(n: number | null | undefined): string {
    if (n === null || n === undefined) return '—';
    return `$${Math.round(Number(n)).toLocaleString('es-CO')}`;
}

/**
 * Tras guardar un resultado individual: si la escuela tiene el flag, recalcula
 * la elegibilidad de las inscripciones del atleta y avisa a owner/admin las que
 * quedaron elegibles por primera vez. Nunca lanza (el resultado ya se guardó).
 */
export async function notifyNewlyEligible(params: {
    schoolId: string;
    subjectType: 'child' | 'profile' | 'unregistered';
    subjectId: string;
    season: number;
    resultId: string;
    log?: { error: (obj: any, msg?: string) => void };
}): Promise<{ notified: number }> {
    const { schoolId, subjectType, subjectId, season, resultId, log } = params;
    try {
        if (!(await getLevelProgressionEnabled(schoolId))) return { notified: 0 };

        const enrollmentIds = await findActiveEnrollmentsForSubject(schoolId, subjectType, subjectId);
        let notified = 0;

        for (const enrollmentId of enrollmentIds) {
            const rows = await fetchEligibility(schoolId, season, enrollmentId);
            if (!rows.some((r) => r.suggested_plan_id)) continue;

            const { data: prior } = await supabase
                .from('notifications')
                .select('data')
                .eq('school_id', schoolId)
                .eq('type', LEVEL_PROMOTION_NOTIFICATION_TYPE)
                .contains('data', { enrollment_id: enrollmentId, season });
            const pending = pendingPromotionNotices(
                rows, (prior || []).map((p: any) => p.data || {}), season,
            );
            if (pending.length === 0) continue;

            const admins = await loadSchoolAdmins(schoolId);
            const recipientIds = new Set(admins.map((a) => a.id));
            const { data: school } = await supabase
                .from('schools').select('owner_id').eq('id', schoolId).maybeSingle();
            if (school?.owner_id) recipientIds.add(school.owner_id);
            if (recipientIds.size === 0) continue;

            const notifRows = pending.flatMap((r) => [...recipientIds].map((userId) => ({
                user_id:   userId,
                school_id: schoolId,
                type:      LEVEL_PROMOTION_NOTIFICATION_TYPE,
                category:  'enrollment',
                title:     'Atleta elegible para ascenso',
                message:   `${r.athlete_name ?? 'Un atleta'} logró ${r.qualifying_points ?? r.best_points} puntos `
                    + `y cumple el umbral de "${r.suggested_plan_name}". Cambio de plan sugerido `
                    + `(mensualidad ${formatCop(r.suggested_fee)}); nada cambia hasta que lo confirmes.`,
                link:      '/results', // panel "Ascensos por puntaje"
                data: {
                    enrollment_id:  r.enrollment_id,
                    target_plan_id: r.suggested_plan_id,
                    points:         r.qualifying_points ?? r.best_points,
                    season,
                    result_id:      resultId,
                },
            })));

            const { error } = await supabase.from('notifications').insert(notifRows);
            if (error) {
                log?.error({ err: error }, 'level-progression: no se pudo insertar el aviso');
                continue;
            }
            notified += pending.length;
        }
        return { notified };
    } catch (err) {
        log?.error({ err }, 'level-progression: fallo calculando elegibilidad (el resultado sí se guardó)');
        return { notified: 0 };
    }
}
