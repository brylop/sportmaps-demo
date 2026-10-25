/**
 * Partidos de un hijo — acudiente V2.
 *
 * Cada partido: marcador desde el lado de su equipo, lo que escribió el profe
 * y la respuesta del acudiente (list_child_match_reports / reply_match_report).
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { type ChildMatchReport, useChildMatchReports, useReplyMatchReport } from '@/hooks/useMatchReports';
import { firstName } from '@/components/parent/v2/hijos/hijosUtils';
import { EmptyNote, InlineError, Pill, SectionSkeleton, type Tone } from '@/components/parent/v2/hijos/parts';
import { CabeceraHijo, PaginaHijo, VolverLegado } from '@/components/parent/hijo-detalle/HijoDetalle';
import { useHijoBasico } from '@/components/parent/hijo-detalle/useHijoDetalle';
import { longDateWithYear, matchScore, plural, type MatchOutcome } from '@/components/parent/hijo-detalle/hijoDetalleUtils';

const MAX_REPLY = 1000;

const OUTCOME_TONE: Record<NonNullable<MatchOutcome>, Tone> = { Ganó: 'good', Empató: 'neutral', Perdió: 'bad' };

function Bloque({ title, text }: { title: string; text: string | null }) {
  if (!text?.trim()) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground">{title}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm">{text}</p>
    </div>
  );
}

function ReportCard({ report, childId, nombre }: { report: ChildMatchReport; childId: string; nombre: string }) {
  const { toast } = useToast();
  const reply = useReplyMatchReport(childId);
  const [editing, setEditing] = useState(!report.my_reply);
  const [body, setBody] = useState(report.my_reply?.body ?? '');
  const score = matchScore(report);
  const fieldId = `respuesta-${report.match_id}`;

  const send = async () => {
    try {
      await reply.mutateAsync({ matchId: report.match_id, body: body.trim() });
      toast({ title: 'Respuesta enviada', description: 'El profe ya la puede leer.' });
      setEditing(false);
    } catch (e: unknown) {
      toast({
        title: 'No se pudo enviar la respuesta',
        description: e instanceof Error ? e.message : 'Intenta de nuevo.',
        variant: 'destructive',
      });
    }
  };

  return (
    <article className="overflow-hidden rounded-2xl border bg-card text-card-foreground">
      <header className="flex items-start gap-3 p-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">vs {report.opponent}</h2>
          <p className="text-sm text-muted-foreground">
            {longDateWithYear(report.match_date.slice(0, 10))}
            {report.team_name ? ` · ${report.team_name}` : ''}
          </p>
          {report.match_type && <p className="mt-0.5 text-xs text-muted-foreground">{report.match_type}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <p className="text-2xl font-semibold tabular-nums">{score ? score.text : '—'}</p>
          {score?.outcome && <Pill tone={OUTCOME_TONE[score.outcome]}>{score.outcome}</Pill>}
        </div>
      </header>

      <div className="space-y-3 border-t p-4">
        <Bloque title="Resumen" text={report.summary} />
        <Bloque title="Cómo fue el partido" text={report.development} />
        <Bloque title="Para mejorar" text={report.improvements} />
        {report.admin_comment?.trim() && (
          <div className="rounded-xl bg-muted/60 p-3">
            <p className="text-xs font-semibold text-muted-foreground">Comentario de la escuela</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{report.admin_comment}</p>
          </div>
        )}
        {!report.summary?.trim() && !report.development?.trim() && !report.improvements?.trim() && !report.admin_comment?.trim() && (
          <p className="text-sm text-muted-foreground">El profe publicó el resultado sin comentarios.</p>
        )}
      </div>

      <div className="space-y-2 border-t p-4">
        <label htmlFor={fieldId} className="text-sm font-semibold">
          Tu respuesta
        </label>
        {editing ? (
          <>
            <Textarea
              id={fieldId}
              rows={3}
              maxLength={MAX_REPLY}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={`Cuéntale al profe qué piensas del partido o cómo lo vivió ${nombre}`}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs tabular-nums text-muted-foreground">
                {body.length}/{MAX_REPLY}
              </span>
              <div className="flex gap-2">
                {report.my_reply && (
                  <Button
                    variant="outline"
                    className="min-h-touch"
                    onClick={() => {
                      setBody(report.my_reply!.body);
                      setEditing(false);
                    }}
                    disabled={reply.isPending}
                  >
                    Cancelar
                  </Button>
                )}
                <Button className="min-h-touch" onClick={send} disabled={reply.isPending || body.trim().length === 0}>
                  {reply.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                  Enviar
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <p id={fieldId} className="whitespace-pre-wrap rounded-xl bg-muted/60 p-3 text-sm">
              {report.my_reply?.body}
            </p>
            <Button variant="outline" className="min-h-touch" onClick={() => setEditing(true)}>
              Editar mi respuesta
            </Button>
          </>
        )}
      </div>
    </article>
  );
}

export default function ChildMatchReportsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: child } = useHijoBasico(id);
  const { data: reports, isLoading, isError, refetch } = useChildMatchReports(id);
  const nombre = child?.full_name ? firstName(child.full_name) : 'tu hijo';

  return (
    <PaginaHijo>
      <VolverLegado to="/children" label="Volver a Hijos" />
      <CabeceraHijo
        titulo={child?.full_name ? `Partidos de ${nombre}` : 'Partidos'}
        sub={
          reports && reports.length > 0
            ? `${plural(reports.length, 'partido con informe', 'partidos con informe')} del profe.`
            : 'Lo que el profe escribe después de cada partido.'
        }
      />

      {isLoading ? (
        <SectionSkeleton rows={3} label="Cargando los partidos" />
      ) : isError ? (
        <InlineError message="No pudimos cargar los partidos. Revisa tu conexión e intenta de nuevo." onRetry={() => refetch()} />
      ) : !reports || reports.length === 0 ? (
        <EmptyNote icon={<Trophy className="h-8 w-8 opacity-40" aria-hidden="true" />}>
          <p className="font-medium text-foreground">Todavía no hay informes de partidos.</p>
          <p className="mt-1">Cuando el profe publique cómo le fue a {nombre} en un partido, lo verás aquí.</p>
        </EmptyNote>
      ) : (
        reports.map((r) => <ReportCard key={r.match_id} report={r} childId={id!} nombre={nombre} />)
      )}
    </PaginaHijo>
  );
}
