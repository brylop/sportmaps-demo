/**
 * SessionViewer — una sesión de entrenamiento en SOLO LECTURA.
 *
 * Spec docs/specs/rediseno-seguimiento-deportivo.md (F4): el dueño ve lo que
 * planificó el entrenador — fecha, equipo, objetivo, principios de juego, cada
 * bloque como tarjeta, materiales, notas y la evaluación — y, si el bloque
 * tiene jugada dibujada, una miniatura (TacticalStaticSvg). Clic en la
 * miniatura → la pizarra en modo `view`.
 *
 * NO escribe en la base. A diferencia de openBlockTacticalBoard()
 * (TrainingPlansPage), que le crea un id al bloque y hace UPDATE de
 * training_sessions la primera vez, acá un bloque sin id simplemente no tiene
 * jugada: no hay nada que mostrar y no se inventa nada.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Calendar, ClipboardList, Loader2, Package, Star, StickyNote, Target, Clock } from 'lucide-react';
import { TacticalStaticSvg, type TacticalStaticPlayer } from '@/components/school/TacticalStaticSvg';
import { TacticalBoard } from '@/components/school/TacticalBoard';
import {
  getFootballLineup, getFootballLineups, type TacticalArrow,
} from '@/lib/school/footballQueries';
import { dayToLocalDate } from '@/lib/dateUtils';

interface SessionBlock {
  id?: string;
  name?: string;
  minutes?: number | string | null;
  activity?: string;
  objective?: string;
  description?: string;
  component?: string;
}

interface SessionRow {
  id: string;
  team_id: string;
  session_date: string;
  objectives: unknown;
  game_principles: string | null;
  warmup: string | null;
  session_blocks: unknown;
  drills: unknown;
  materials: string | null;
  notes: string | null;
  evaluation: {
    objectives_met?: 'si' | 'parcial' | 'no' | string;
    team_rating?: number;
    highlights?: string;
    improvements?: string;
  } | null;
}

interface BlockDrawing {
  players: TacticalStaticPlayer[];
  arrows: TacticalArrow[];
}

export interface SessionViewerProps {
  open: boolean;
  onClose: () => void;
  sessionId: string | null;
  teamId: string;
  teamName: string;
  /** Quién la creó, si se sabe (sale del BFF de seguimiento). */
  createdByName?: string | null;
}

const objectiveText = (raw: unknown): string => {
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === 'string').join(' · ');
  return '';
};

const OBJECTIVES_MET: Record<string, { label: string; className: string }> = {
  si: { label: 'Objetivos cumplidos', className: 'text-green-700 dark:text-green-400 bg-green-500/10 border-green-500/25' },
  parcial: { label: 'Objetivos cumplidos a medias', className: 'text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/25' },
  no: { label: 'Objetivos no cumplidos', className: 'text-red-700 dark:text-red-400 bg-red-500/10 border-red-500/25' },
};

function Section({ icon: Icon, title, children }: { icon: typeof Target; title: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </h3>
      {children}
    </section>
  );
}

export function SessionViewer({ open, onClose, sessionId, teamId, teamName, createdByName }: SessionViewerProps) {
  const [boardBlock, setBoardBlock] = useState<{ id: string; name: string } | null>(null);

  const { data: session, isLoading } = useQuery({
    queryKey: ['session-viewer', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_sessions')
        .select('id, team_id, session_date, objectives, game_principles, warmup, session_blocks, drills, materials, notes, evaluation')
        .eq('id', sessionId as string)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as SessionRow | null;
    },
    enabled: open && !!sessionId,
  });

  const blocks: SessionBlock[] = useMemo(
    () => (Array.isArray(session?.session_blocks) ? (session!.session_blocks as SessionBlock[]) : []),
    [session],
  );
  const blockIds = useMemo(() => blocks.map((b) => b.id).filter((x): x is string => !!x), [blocks]);

  // Jugadas por bloque: una lista por equipo (solo lectura) y el detalle de las
  // que corresponden a bloques de esta sesión. Un equipo que no es de fútbol o
  // un error del BFF = sin miniaturas, no un error en pantalla.
  const { data: drawings } = useQuery({
    queryKey: ['session-viewer-drawings', teamId, blockIds.join(',')],
    queryFn: async () => {
      const lineups = await getFootballLineups({ team_id: teamId, source_type: 'training_session' });
      const wanted = lineups.filter((l) => blockIds.includes(l.source_id));
      const details = await Promise.all(wanted.map((l) => getFootballLineup(l.id).catch(() => null)));
      const out: Record<string, BlockDrawing> = {};
      for (const d of details) {
        if (!d) continue;
        const players: TacticalStaticPlayer[] = (d.players || [])
          .filter((p) => p.x != null && p.y != null)
          .map((p) => ({
            x: p.x as number,
            y: p.y as number,
            label: p.slot_label ?? undefined,
            jersey: p.jersey_number ?? null,
            role: p.role,
          }));
        const arrows = Array.isArray(d.arrows) ? d.arrows : [];
        if (players.length === 0 && arrows.length === 0) continue;
        out[d.source_id] = { players, arrows };
      }
      return out;
    },
    enabled: open && !!teamId && blockIds.length > 0,
    retry: false,
    staleTime: 60 * 1000,
  });

  const dateLabel = session
    ? dayToLocalDate(session.session_date).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const shortDate = session
    ? dayToLocalDate(session.session_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })
    : '';
  const objective = objectiveText(session?.objectives);
  const totalMinutes = blocks.reduce((n, b) => n + (Number(b.minutes) || 0), 0);
  const evaluation = session?.evaluation ?? null;
  const drills = Array.isArray(session?.drills) ? (session!.drills as { name?: string; focus?: string; duration?: string }[]) : [];

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-lg leading-snug">{teamName}</DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="inline-flex items-center gap-1 capitalize">
                <Calendar className="h-3.5 w-3.5" /> {dateLabel || 'Sesión'}
              </span>
              {totalMinutes > 0 && (
                <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {totalMinutes} min</span>
              )}
              {createdByName && <span>· La planificó {createdByName}</span>}
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : !session ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No se encontró la sesión.</p>
          ) : (
            <div className="space-y-5">
              {objective && (
                <Section icon={Target} title="Objetivo">
                  <p className="text-sm">{objective}</p>
                </Section>
              )}

              {session.game_principles && (
                <Section icon={Target} title="Principios de juego">
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{session.game_principles}</p>
                </Section>
              )}

              {session.warmup && (
                <Section icon={Clock} title="Calentamiento">
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{session.warmup}</p>
                </Section>
              )}

              {blocks.length > 0 && (
                <Section icon={ClipboardList} title={`Bloques (${blocks.length})`}>
                  <ol className="space-y-3">
                    {blocks.map((block, i) => {
                      const drawing = block.id ? drawings?.[block.id] : undefined;
                      return (
                        <li key={block.id || i} className="rounded-xl border bg-card p-3">
                          <div className="flex flex-col gap-3 sm:flex-row">
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                  {i + 1}
                                </span>
                                <p className="font-semibold break-words">{block.name || `Bloque ${i + 1}`}</p>
                                {Number(block.minutes) > 0 && <Badge variant="outline">{block.minutes} min</Badge>}
                                {block.component && <Badge variant="secondary" className="capitalize">{block.component}</Badge>}
                              </div>
                              {block.activity && <p className="text-sm break-words">{block.activity}</p>}
                              {block.objective && (
                                <p className="text-sm text-muted-foreground break-words">
                                  <span className="font-medium text-foreground">Objetivo: </span>{block.objective}
                                </p>
                              )}
                              {block.description && (
                                <p className="text-sm text-muted-foreground whitespace-pre-line break-words">{block.description}</p>
                              )}
                            </div>
                            {drawing && block.id && (
                              <button
                                type="button"
                                onClick={() => setBoardBlock({ id: block.id as string, name: block.name || `Bloque ${i + 1}` })}
                                className="group shrink-0 self-start rounded-lg border bg-muted/30 p-1 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                title="Ver la jugada en la pizarra"
                              >
                                <TacticalStaticSvg players={drawing.players} arrows={drawing.arrows} width={140} className="rounded-md" />
                                <span className="mt-1 block text-center text-xs font-medium text-primary group-hover:underline">
                                  Ver jugada
                                </span>
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </Section>
              )}

              {drills.length > 0 && (
                <Section icon={ClipboardList} title="Ejercicios">
                  <ul className="space-y-1.5">
                    {drills.map((d, i) => (
                      <li key={i} className="rounded-lg border px-3 py-2 text-sm">
                        <span className="font-medium">{d.name}</span>
                        {d.duration && <span className="text-muted-foreground"> · {d.duration}</span>}
                        {d.focus && <p className="text-muted-foreground">Enfoque: {d.focus}</p>}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {session.materials && (
                <Section icon={Package} title="Materiales">
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{session.materials}</p>
                </Section>
              )}

              {session.notes && (
                <Section icon={StickyNote} title="Notas">
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{session.notes}</p>
                </Section>
              )}

              {evaluation && (evaluation.objectives_met || evaluation.team_rating || evaluation.highlights || evaluation.improvements) && (
                <Section icon={Star} title="Cómo salió la sesión">
                  <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
                    <div className="flex flex-wrap items-center gap-3">
                      {evaluation.objectives_met && OBJECTIVES_MET[evaluation.objectives_met] && (
                        <Badge variant="outline" className={OBJECTIVES_MET[evaluation.objectives_met].className}>
                          {OBJECTIVES_MET[evaluation.objectives_met].label}
                        </Badge>
                      )}
                      {!!evaluation.team_rating && (
                        <span className="flex items-center gap-1 text-sm" aria-label={`Calificación del equipo: ${evaluation.team_rating} de 5`}>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star
                              key={n}
                              className={`h-4 w-4 ${(evaluation.team_rating ?? 0) >= n ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/30'}`}
                            />
                          ))}
                          <span className="ml-1 font-semibold">{evaluation.team_rating}/5</span>
                        </span>
                      )}
                    </div>
                    {evaluation.highlights && (
                      <p className="text-sm"><span className="font-medium">Lo mejor: </span>{evaluation.highlights}</p>
                    )}
                    {evaluation.improvements && (
                      <p className="text-sm"><span className="font-medium">A mejorar: </span>{evaluation.improvements}</p>
                    )}
                  </div>
                </Section>
              )}

              {!objective && blocks.length === 0 && drills.length === 0 && !session.notes && !session.materials && (
                <p className="text-sm text-muted-foreground">La sesión está creada pero todavía no tiene contenido.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {boardBlock && (
        <TacticalBoard
          open={!!boardBlock}
          onClose={() => setBoardBlock(null)}
          teamId={teamId}
          teamName={teamName}
          sourceType="training_session"
          sourceId={boardBlock.id}
          contextLabel={`Entrenamiento ${shortDate} — ${boardBlock.name}`}
          mode="view"
        />
      )}
    </>
  );
}
