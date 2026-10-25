/**
 * Datos del Calendario del acudiente (V2). Solo lectura y solo con lo que ya
 * existe: ninguna tabla ni endpoint nuevo.
 *
 *  - Hijos: `children` (+ `enrollments` activas/pendientes/pausadas), el mismo
 *    criterio que `calendar_family_team_ids()` en la RLS de calendar_events.
 *  - Equipos: `teams` (nombre, lugar, horario fijo y profe).
 *  - Eventos: `calendar_events`; la RLS ya limita a lo de los equipos de los
 *    hijos, lo de toda la escuela y lo propio.
 *  - Torneos: BFF `/api/v1/events/my-registrations/list` (inscritos),
 *    `/api/v1/events/my-open-tournaments` (abiertos) y
 *    `/school-tournaments/:id/for-participant` (precio y quién ya está).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { bffClient } from '@/lib/api/bffClient';
import { getForParticipant, getMyOpenTournaments, TournamentForParticipant } from '@/lib/api/tournaments';
import type { CalendarEventLite, ChildLite, TeamLite } from './parentCalendarModel';

export const AGENDA_DAYS = 14;

/** Resultado de PostgREST con filas tipadas a mano (los selects con joins no los infiere bien el cliente). */
type Rows<T> = { data: T[] | null; error: { message: string } | null };

interface ChildRow {
  id: string;
  full_name: string | null;
  school_id: string | null;
  team_id: string | null;
  is_active: boolean | null;
  enrollments: { team_id: string | null; status: string }[] | null;
}

interface TeamRow {
  id: string;
  name: string;
  school_id: string | null;
  location: string | null;
  schedule: unknown;
  coach: { full_name: string | null } | null;
}

export interface ParentAgendaData {
  children: ChildLite[];
  teams: TeamLite[];
  events: CalendarEventLite[];
}

export function useParentAgenda() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['parent-calendar-v2', 'agenda', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<ParentAgendaData> => {
      const uid = user!.id;
      const { data: kids, error: kidsErr } = (await supabase
        .from('children')
        .select('id, full_name, school_id, team_id, is_active, enrollments(team_id, status)')
        .eq('parent_id', uid)) as unknown as Rows<ChildRow>;
      if (kidsErr) throw kidsErr;

      const children: ChildLite[] = (kids || [])
        .filter((c) => c.is_active !== false)
        .map((c) => {
          const ids = new Set<string>();
          if (c.team_id) ids.add(c.team_id);
          for (const e of c.enrollments || []) {
            if (e?.team_id && ['active', 'pending', 'paused'].includes(e.status)) ids.add(e.team_id);
          }
          return {
            id: c.id,
            name: String(c.full_name || '').trim().split(/\s+/)[0] || 'Tu hijo',
            schoolId: c.school_id ?? null,
            teamIds: [...ids],
          };
        });

      const teamIds = [...new Set(children.flatMap((c) => c.teamIds))];
      const schoolIds = [...new Set(children.map((c) => c.schoolId).filter(Boolean) as string[])];

      let teams: TeamLite[] = [];
      if (teamIds.length > 0) {
        const { data: t, error: tErr } = (await supabase
          .from('teams')
          .select('id, name, school_id, location, schedule, coach:coach_id(full_name)')
          .in('id', teamIds)) as unknown as Rows<TeamRow>;
        if (tErr) throw tErr;
        teams = (t || []).map((r) => ({
          id: r.id,
          name: r.name,
          schoolId: r.school_id ?? null,
          location: r.location ?? null,
          coachName: r.coach?.full_name ?? null,
          schedule: r.schedule,
        }));
      }

      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + AGENDA_DAYS);

      // Lo de los equipos de los hijos, lo de toda su escuela y lo propio.
      const ors = [`user_id.eq.${uid}`];
      if (teamIds.length) ors.push(`team_id.in.(${teamIds.join(',')})`);
      if (schoolIds.length) ors.push(`and(team_id.is.null,school_id.in.(${schoolIds.join(',')}))`);
      const { data: evs, error: evErr } = (await supabase
        .from('calendar_events')
        .select('id, title, description, event_type, start_time, end_time, location, all_day, team_id, school_id, user_id')
        .or(ors.join(','))
        .gte('start_time', from.toISOString())
        .lt('start_time', to.toISOString())
        .order('start_time', { ascending: true })) as unknown as Rows<CalendarEventLite>;
      if (evErr) throw evErr;

      return { children, teams, events: evs || [] };
    },
  });
}

// ─── Torneos ────────────────────────────────────────────────────────────────
export interface RegisteredTournament {
  registrationId: string;
  eventId: string;
  title: string;
  eventDate: string | null;
  childName: string;
  status: string;
  paymentStatus: string | null;
  /** Ruta de la página pública en vivo, si el torneo la tiene encendida. */
  liveUrl: string | null;
}

export interface OpenTournamentForChild {
  eventId: string;
  title: string;
  eventDate: string | null;
  schoolName: string | null;
  childId: string | null;
  childName: string | null;
  /** null = no se pudo saber el precio; 0 = gratis. */
  price: number | null;
  priceUntil: string | null;
}

export interface ParentTournamentsData {
  registered: RegisteredTournament[];
  open: OpenTournamentForChild[];
}

interface RawRegistration {
  id: string;
  event_id: string;
  participant_name: string;
  status: string;
  payment_status: string | null;
  child_id: string | null;
  events: { id: string; title: string; event_date: string | null; slug: string | null; status: string | null } | null;
}

function currentPrice(t: TournamentForParticipant): { price: number | null; until: string | null } {
  if (t.is_paid === false) return { price: 0, until: null };
  const today = new Date(new Date().toDateString());
  const phase = (t.phases || [])
    .filter((p) => new Date(p.valid_until) >= today)
    .sort((a, b) => a.valid_until.localeCompare(b.valid_until))[0];
  return phase ? { price: Number(phase.price_solo), until: phase.valid_until } : { price: null, until: null };
}

export function useParentTournaments(agendaChildren: ChildLite[] | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['parent-calendar-v2', 'tournaments', user?.id, (agendaChildren || []).map((c) => c.id).join(',')],
    enabled: !!user?.id && !!agendaChildren,
    queryFn: async (): Promise<ParentTournamentsData> => {
      const children = agendaChildren || [];
      const [regsRaw, openRaw] = await Promise.all([
        bffClient.get<RawRegistration[] | null>('/api/v1/events/my-registrations/list'),
        getMyOpenTournaments(),
      ]);

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 1);
      const regs = (Array.isArray(regsRaw) ? regsRaw : []).filter((r) => {
        if (['cancelled', 'rejected'].includes(r.status)) return false;
        if (!r.events) return false;
        if (['finished', 'completed', 'cancelled'].includes(String(r.events.status || ''))) return false;
        return !r.events.event_date || new Date(`${r.events.event_date.slice(0, 10)}T23:59:59`) >= cutoff;
      });

      // ¿Tiene página en vivo? `live_enabled` lo enciende la escuela (torneos en
      // vivo, 2026-10-24). Si la consulta falla, simplemente no hay botón.
      const live = new Map<string, string>();
      const eventIds = [...new Set(regs.map((r) => r.event_id))];
      if (eventIds.length) {
        try {
          // live_enabled todavía no está en types.ts (columna del 2026-10-24).
          const { data } = (await supabase
            .from('events')
            .select('id, slug, live_enabled')
            .in('id', eventIds)) as unknown as Rows<{ id: string; slug: string | null; live_enabled: boolean | null }>;
          for (const e of data || []) {
            if (e.live_enabled === true && e.slug) live.set(e.id, `/torneo/${e.slug}/en-vivo`);
          }
        } catch { /* sin botón en vivo */ }
      }

      const nameOf = (childId: string | null, fallback: string) =>
        children.find((c) => c.id === childId)?.name ?? (fallback.trim().split(/\s+/)[0] || fallback);

      const registered: RegisteredTournament[] = regs.map((r) => ({
        registrationId: r.id,
        eventId: r.event_id,
        title: r.events!.title,
        eventDate: r.events!.event_date,
        childName: nameOf(r.child_id, r.participant_name || ''),
        status: r.status,
        paymentStatus: r.payment_status,
        liveUrl: live.get(r.event_id) ?? null,
      }));

      // Abiertos: por cada torneo, qué hijo de esa escuela todavía no está inscrito y a cuánto.
      const open: OpenTournamentForChild[] = [];
      const details = await Promise.all(
        (openRaw || []).slice(0, 8).map((t) => getForParticipant(t.id).then((d) => ({ t, d })).catch(() => ({ t, d: null }))),
      );
      for (const { t, d } of details) {
        const base = { eventId: t.id, title: t.title, eventDate: t.event_date, schoolName: t.school?.name ?? null };
        if (!d) {
          open.push({ ...base, childId: null, childName: null, price: null, priceUntil: null });
          continue;
        }
        if (!d.registrations_open) continue;
        const already = new Set((d.my_registrations || []).map((r) => r.child_id).filter(Boolean));
        const { price, until } = currentPrice(d);
        const eligible = children.filter((c) => c.schoolId === d.school_id && !already.has(c.id));
        for (const c of eligible) {
          open.push({ ...base, childId: c.id, childName: c.name, price, priceUntil: until });
        }
      }

      return { registered, open };
    },
  });
}
