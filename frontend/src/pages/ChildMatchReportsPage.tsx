import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/common/ErrorState';
import { ArrowLeft, Loader2, Trophy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { type ChildMatchReport, useChildMatchReports, useReplyMatchReport } from '@/hooks/useMatchReports';

const MAX_REPLY = 1000;

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

function Section({ title, text }: { title: string; text: string | null }) {
  if (!text) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm">{text}</p>
    </div>
  );
}

function ReportCard({ report, childId }: { report: ChildMatchReport; childId: string }) {
  const { toast } = useToast();
  const reply = useReplyMatchReport(childId);
  const [editing, setEditing] = useState(!report.my_reply);
  const [body, setBody] = useState(report.my_reply?.body ?? '');

  const hasScore = report.home_score != null && report.away_score != null;
  const ours = report.is_home ? report.home_score : report.away_score;
  const theirs = report.is_home ? report.away_score : report.home_score;

  const send = async () => {
    try {
      await reply.mutateAsync({ matchId: report.match_id, body: body.trim() });
      toast({ title: '✅ Respuesta enviada' });
      setEditing(false);
    } catch (e: any) {
      toast({ title: 'No se pudo enviar la respuesta', description: e?.message, variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">vs {report.opponent}</p>
            <p className="text-sm text-muted-foreground">
              {fmtDate(report.match_date)}
              {report.team_name ? ` · ${report.team_name}` : ''}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <p className="text-2xl font-bold">{hasScore ? `${ours} - ${theirs}` : '— vs —'}</p>
            {report.match_type && <Badge variant="outline">{report.match_type}</Badge>}
          </div>
        </div>

        <Section title="Resumen" text={report.summary} />
        <Section title="Desarrollo del partido" text={report.development} />
        <Section title="Aspectos a mejorar" text={report.improvements} />
        {report.admin_comment && (
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Comentario de la administración
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{report.admin_comment}</p>
          </div>
        )}

        <div className="space-y-2 border-t pt-4">
          <p className="text-sm font-medium">Tu respuesta</p>
          {editing ? (
            <>
              <Textarea
                rows={3}
                maxLength={MAX_REPLY}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Cuéntanos qué piensas del partido o cómo lo vivió tu hijo"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{body.length}/{MAX_REPLY}</span>
                <div className="flex gap-2">
                  {report.my_reply && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setBody(report.my_reply!.body); setEditing(false); }}
                      disabled={reply.isPending}
                    >
                      Cancelar
                    </Button>
                  )}
                  <Button size="sm" onClick={send} disabled={reply.isPending || body.trim().length === 0}>
                    {reply.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Enviar
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="whitespace-pre-wrap rounded-lg border p-3 text-sm">{report.my_reply?.body}</p>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                Editar mi respuesta
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ChildMatchReportsPage() {
  const { id } = useParams<{ id: string }>();

  const { data: child } = useQuery({
    queryKey: ['child-basic', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('children').select('id, full_name').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: reports, isLoading, error, refetch } = useChildMatchReports(id);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <div>
        <Link to="/my-children" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Mis hijos
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Partidos</h1>
        {child?.full_name && <p className="text-muted-foreground">Reportes de los partidos de {child.full_name}</p>}
      </div>

      {isLoading && <LoadingSpinner text="Cargando reportes..." />}
      {error && <ErrorState message="No pudimos cargar los reportes de partidos." onRetry={() => refetch()} />}

      {reports && reports.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center">
            <Trophy className="mx-auto mb-3 h-10 w-10 text-muted-foreground opacity-40" />
            <p className="font-medium">Todavía no hay reportes de partidos</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tu escuela todavía no publica reportes de partidos, o aún no hay ninguno para este equipo.
              Cuando el entrenador publique uno, lo verás aquí.
            </p>
          </CardContent>
        </Card>
      )}

      {reports?.map((r) => (
        <ReportCard key={r.match_id} report={r} childId={id!} />
      ))}
    </div>
  );
}
