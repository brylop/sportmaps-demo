import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Calendar, Trash2, Clock, MinusCircle } from 'lucide-react';
import { useCompetitionResults, useDeleteCompetitionResult } from '@/hooks/useCompetitionResults';
import type { CompetitionResult, MatchResult } from '@/lib/school/competitionResultsQueries';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

interface CompetitionResultsListProps {
  teamId: string;
}

const RESULT_BADGE: Record<NonNullable<MatchResult>, { label: string; className: string }> = {
  win:  { label: 'Ganado',  className: 'bg-green-500/10 text-green-600 border-green-500/30' },
  loss: { label: 'Perdido', className: 'bg-red-500/10 text-red-600 border-red-500/30' },
  draw: { label: 'Empate',  className: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
};

function ResultBadge({ result }: { result: CompetitionResult }) {
  const matchResult = result.result_data?.match_result;
  if (!matchResult) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <Clock className="h-3 w-3" /> Programado
      </Badge>
    );
  }
  const cfg = RESULT_BADGE[matchResult];
  return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>;
}

function SetsRow({ result }: { result: CompetitionResult }) {
  const sets = result.result_data?.sets ?? [];
  if (sets.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {sets.map((s) => (
        <span key={s.set_number} className="text-xs font-mono bg-muted/60 rounded px-1.5 py-0.5">
          {s.team_score}-{s.opponent_score}
        </span>
      ))}
      {result.result_data?.warnings?.length > 0 && (
        <span title={result.result_data.warnings.join('\n')} className="text-amber-500 text-xs">
          ⚠ marcador atípico confirmado
        </span>
      )}
    </div>
  );
}

export function CompetitionResultsList({ teamId }: CompetitionResultsListProps) {
  const { data: results, isLoading } = useCompetitionResults({ team_id: teamId });
  const deleteResult = useDeleteCompetitionResult();

  if (isLoading) return <LoadingSpinner text="Cargando resultados..." />;

  if (!results || results.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <Trophy className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">Sin partidos registrados para este equipo todavía.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {results.map((r) => (
        <Card key={r.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm truncate">vs {r.opponent}</span>
                  <ResultBadge result={r} />
                  <Badge variant="secondary" className="text-[10px]">
                    {r.result_type === 'competencia_oficial' ? 'Competencia Oficial' : 'Preparatorio'}
                  </Badge>
                </div>
                {r.competition_name && (
                  <p className="text-xs text-muted-foreground">{r.competition_name}</p>
                )}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {new Date(r.competition_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
                <SetsRow result={r} />
                {r.notes && <p className="text-xs italic text-muted-foreground pt-1">{r.notes}</p>}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 shrink-0"
                onClick={() => deleteResult.mutate(r.id)}
                disabled={deleteResult.isPending}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
