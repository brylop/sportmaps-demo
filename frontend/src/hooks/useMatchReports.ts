import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Las RPC del reporte del partido aún no están en types.ts: se llaman con el
// cliente sin tipar, como hace el resto del repo cuando falta el tipo.
const db = supabase as any;

export interface MatchReport {
  match_id: string;
  school_id: string;
  summary: string | null;
  development: string | null;
  improvements: string | null;
  coach_id: string | null;
  admin_comment: string | null;
  admin_comment_at: string | null;
  published_at: string | null;
  updated_at: string;
}

export interface MatchReportReply {
  id: string;
  match_id: string;
  author_id: string;
  author_name: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface ChildMatchReport {
  match_id: string;
  match_date: string;
  opponent: string;
  is_home: boolean;
  home_score: number | null;
  away_score: number | null;
  match_type: string | null;
  team_name: string | null;
  summary: string | null;
  development: string | null;
  improvements: string | null;
  admin_comment: string | null;
  published_at: string;
  my_reply: { body: string; updated_at: string } | null;
}

export interface MatchReportInput {
  summary: string;
  development: string;
  improvements: string;
}

/** Reportes (solo personal de la escuela, por RLS) de una lista de partidos. */
export function useMatchReports(matchIds: string[]) {
  const key = [...matchIds].sort().join(',');
  return useQuery({
    queryKey: ['match-reports', key],
    enabled: matchIds.length > 0,
    queryFn: async (): Promise<Record<string, MatchReport>> => {
      const { data, error } = await db.from('match_reports').select('*').in('match_id', matchIds);
      if (error) throw error;
      const map: Record<string, MatchReport> = {};
      for (const r of (data || []) as MatchReport[]) map[r.match_id] = r;
      return map;
    },
  });
}

/** Respuestas de las familias a un reporte (solo lectura para el personal). */
export function useMatchReportReplies(matchId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['match-report-replies', matchId],
    enabled: !!matchId && enabled,
    queryFn: async (): Promise<MatchReportReply[]> => {
      const { data, error } = await db
        .from('match_report_replies')
        .select('id, match_id, author_id, body, created_at, updated_at')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const rows = (data || []) as Omit<MatchReportReply, 'author_name'>[];
      const ids = [...new Set(rows.map((r) => r.author_id))];
      const names: Record<string, string> = {};
      if (ids.length > 0) {
        // Si la RLS de profiles no deja leer al autor, queda sin nombre.
        const { data: profs } = await db.from('profiles').select('id, full_name').in('id', ids);
        for (const p of (profs || []) as { id: string; full_name: string | null }[]) {
          if (p.full_name) names[p.id] = p.full_name;
        }
      }
      return rows.map((r) => ({ ...r, author_name: names[r.author_id] ?? null }));
    },
  });
}

export function useSaveMatchReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { matchId: string; report: MatchReportInput }) => {
      const { error } = await db.rpc('save_match_report', { p_match: v.matchId, p: v.report });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['match-reports'] }),
  });
}

export function useSaveMatchAdminComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { matchId: string; comment: string }) => {
      const { error } = await db.rpc('save_match_admin_comment', { p_match: v.matchId, p_comment: v.comment });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['match-reports'] }),
  });
}

export function usePublishMatchReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { matchId: string; publish: boolean }) => {
      const { error } = await db.rpc('publish_match_report', { p_match: v.matchId, p_publish: v.publish });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['match-reports'] }),
  });
}

/** Reportes publicados de los equipos de un hijo (acudiente). */
export function useChildMatchReports(childId: string | undefined) {
  return useQuery({
    queryKey: ['child-match-reports', childId],
    enabled: !!childId,
    queryFn: async (): Promise<ChildMatchReport[]> => {
      const { data, error } = await db.rpc('list_child_match_reports', { p_child: childId });
      if (error) throw error;
      return (data || []) as ChildMatchReport[];
    },
  });
}

export function useReplyMatchReport(childId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { matchId: string; body: string }) => {
      const { error } = await db.rpc('reply_match_report', { p_match: v.matchId, p_body: v.body });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['child-match-reports', childId] }),
  });
}
