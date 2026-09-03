// Compartido entre CoachCheckInScanPage (escáner in-app) y el panel de staff en
// AthleteCardPublicPage (staff que escanea con la cámara del teléfono, fuera de
// la app) — misma respuesta del BFF (`POST /checkin-by-card`), mismas etiquetas.

export type CheckInResponse = {
  outcome: string;
  athleteName?: string;
  sessionId?: string;
};

export type Tone = 'ok' | 'warn' | 'err';

export const OUTCOME_INFO: Record<string, { label: string; tone: Tone }> = {
  deducted:            { label: 'Presente — se descontó una clase',        tone: 'ok' },
  covered_by_booking:  { label: 'Presente — ya tenía reserva de hoy',       tone: 'ok' },
  already_present:     { label: 'Ya estaba marcado presente hoy',          tone: 'ok' },
  no_plan:             { label: 'Presente — sin plan de clases',           tone: 'warn' },
  no_credits:          { label: 'Presente — sin clases disponibles',       tone: 'warn' },
  expired:             { label: 'Presente — el plan está vencido',         tone: 'warn' },
  no_team:             { label: 'No tiene equipo asignado',                tone: 'err' },
  session_closed:      { label: 'La sesión de hoy ya está cerrada',        tone: 'err' },
  wrong_school:        { label: 'Este carnet es de otra escuela',          tone: 'err' },
  card_not_found:      { label: 'Carnet no reconocido',                    tone: 'err' },
  card_revoked:        { label: 'Carnet revocado',                        tone: 'err' },
  card_expired:        { label: 'Carnet vencido — hay que renovarlo',      tone: 'err' },
};

export const MARKED_PRESENT = new Set([
  'deducted', 'covered_by_booking', 'already_present', 'no_plan', 'no_credits', 'expired',
]);

export function resolveOutcomeInfo(outcome: string): { label: string; tone: Tone } {
  return OUTCOME_INFO[outcome] ?? { label: outcome, tone: 'warn' };
}
