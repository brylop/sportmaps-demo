// Lecturas auxiliares de la historia clínica (pantallas de pacientes y
// seguimientos). Complementa a api.ts sin tocarlo: mismas reglas (RLS filtra
// por professional_id = auth.uid()).
import { supabase } from '@/integrations/supabase/client';
import type { ClinicalConsent, ClinicalNote, ConsentType } from './types';
import { REQUIRED_CONSENTS } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function must<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data as T;
}

/** Consentimientos vigentes de todos mis pacientes, en una sola consulta (evita N+1 en la lista). */
export async function listConsentSummary(): Promise<{ patient_id: string; consent_type: ConsentType }[]> {
  return (must(await db.from('clinical_consents').select('patient_id, consent_type').is('revoked_at', null)) as
    { patient_id: string; consent_type: ConsentType }[] | null) ?? [];
}

/** Agrupa el resumen por paciente: patient_id → tipos vigentes. */
export function consentMap(rows: { patient_id: string; consent_type: ConsentType }[]): Map<string, Set<ConsentType>> {
  const m = new Map<string, Set<ConsentType>>();
  for (const r of rows) {
    if (!m.has(r.patient_id)) m.set(r.patient_id, new Set());
    m.get(r.patient_id)!.add(r.consent_type);
  }
  return m;
}

export function hasRequiredConsents(types: Iterable<ConsentType> | undefined | null): boolean {
  if (!types) return false;
  const set = new Set(types);
  return REQUIRED_CONSENTS.every((t) => set.has(t));
}

/** Consentimientos vigentes (no revocados) de un listado completo. */
export function activeConsents(consents: ClinicalConsent[]): ClinicalConsent[] {
  return consents.filter((c) => !c.revoked_at);
}

/** Notas que cuentan como sesión de tratamiento. */
export function isSessionNote(n: Pick<ClinicalNote, 'note_type'>): boolean {
  return n.note_type === 'valoracion_inicial' || n.note_type === 'evolucion';
}

export interface EpisodeNoteStats { sessions: number; lastNoteAt: string | null }

/** Sesiones hechas y última nota de cada episodio (para la vista de seguimientos). */
export async function listEpisodeNoteStats(episodeIds: string[]): Promise<Record<string, EpisodeNoteStats>> {
  const out: Record<string, EpisodeNoteStats> = {};
  for (const id of episodeIds) out[id] = { sessions: 0, lastNoteAt: null };
  if (episodeIds.length === 0) return out;
  // Por tandas para no pasar URLs gigantes.
  for (let i = 0; i < episodeIds.length; i += 100) {
    const chunk = episodeIds.slice(i, i + 100);
    const rows = (must(await db.from('clinical_notes').select('episode_id, note_type, occurred_at')
      .in('episode_id', chunk)) as Pick<ClinicalNote, 'episode_id' | 'note_type' | 'occurred_at'>[] | null) ?? [];
    for (const r of rows) {
      const s = out[r.episode_id] ?? (out[r.episode_id] = { sessions: 0, lastNoteAt: null });
      if (isSessionNote(r)) s.sessions += 1;
      if (!s.lastNoteAt || r.occurred_at > s.lastNoteAt) s.lastNoteAt = r.occurred_at;
    }
  }
  return out;
}
