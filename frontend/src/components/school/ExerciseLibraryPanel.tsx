/**
 * Biblioteca de ejercicios (pizarra T3, spec docs/specs/pizarra-nivel-tacticalpad.md §5):
 * búsqueda, filtros por deporte y objetivo, «Plantillas SportMaps» vs «De mi
 * escuela», tarjetas con miniatura y «Usar en esta sesión» / «Ver».
 *
 * Es un <Dialog> propio. Quien lo abre desde OTRO Dialog (SessionFormDialog,
 * TacticalBoard) tiene que ocultar el suyo mientras este está abierto —
 * dos Dialogs de Radix abiertos a la vez se cierran solos (ver el comentario
 * largo de SessionFormDialog).
 */
import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Clock, Search, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TacticalStaticSvg } from '@/components/school/TacticalStaticSvg';
import {
  EXERCISE_SPORT_LABEL,
  exerciseThumbnail,
  listExercises,
  type ExerciseSport,
  type TrainingExercise,
} from '@/lib/school/exerciseLibrary';

type Source = 'templates' | 'school';

/** Objetivos frecuentes como atajo (son etiquetas: filtran por `tag`). */
const OBJECTIVE_CHIPS: { tag: string; label: string }[] = [
  { tag: 'rondo', label: 'Rondos' },
  { tag: 'posesión', label: 'Posesión' },
  { tag: 'salida de balón', label: 'Salida de balón' },
  { tag: 'presión', label: 'Presión' },
  { tag: 'finalización', label: 'Finalización' },
  { tag: 'defensa', label: 'Defensa' },
  { tag: 'transición ofensiva', label: 'Transición' },
  { tag: 'balón parado', label: 'Balón parado' },
  { tag: 'conducción', label: 'Conducción' },
];

const SPORT_CHIPS: ExerciseSport[] = ['futbol', 'futbol7', 'futbol5', 'futsal', 'generico'];

export interface ExerciseLibraryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se llama al tocar «Usar en esta sesión». Si no viene, el panel es solo de consulta. */
  onPick?: (exercise: TrainingExercise) => void;
  pickLabel?: string;
  /** Deporte con el que arranca el filtro (el del equipo). */
  defaultSport?: ExerciseSport;
  /** Deshabilita «Usar» mientras el padre aplica el ejercicio. */
  picking?: boolean;
}

export function ExerciseLibraryPanel({
  open,
  onOpenChange,
  onPick,
  pickLabel = 'Usar en esta sesión',
  defaultSport,
  picking,
}: ExerciseLibraryPanelProps) {
  const [source, setSource] = useState<Source>('templates');
  const [search, setSearch] = useState('');
  const [sport, setSport] = useState<ExerciseSport | undefined>(defaultSport);
  const [tag, setTag] = useState<string | undefined>();
  const [viewing, setViewing] = useState<TrainingExercise | null>(null);

  const params = useMemo(
    () => ({ q: search.trim() || undefined, sport, tag, templates: source === 'templates' }),
    [search, sport, tag, source],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['training-exercises', params],
    queryFn: () => listExercises(params),
    enabled: open,
    staleTime: 60_000,
  });

  const exercises = data ?? [];

  const handleOpenChange = (next: boolean) => {
    if (!next) setViewing(null);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <DialogTitle>{viewing ? viewing.name : 'Biblioteca de ejercicios'}</DialogTitle>
              <DialogDescription>
                {viewing
                  ? (viewing.is_template ? 'Plantilla SportMaps' : 'Ejercicio de tu escuela')
                  : 'Elige un ejercicio con su jugada lista y úsalo en el bloque.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {viewing ? (
          <ExerciseDetail
            exercise={viewing}
            onBack={() => setViewing(null)}
            onPick={onPick ? () => onPick(viewing) : undefined}
            pickLabel={pickLabel}
            picking={picking}
          />
        ) : (
          <div className="space-y-4">
            {/* Origen: una acción por fila, botones grandes (celular). */}
            <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Origen de los ejercicios">
              {([
                { value: 'templates', label: 'Plantillas SportMaps' },
                { value: 'school', label: 'De mi escuela' },
              ] as const).map((o) => (
                <Button
                  key={o.value}
                  type="button"
                  role="tab"
                  aria-selected={source === o.value}
                  variant={source === o.value ? 'default' : 'outline'}
                  className="min-h-11"
                  onClick={() => setSource(o.value)}
                >
                  {o.label}
                </Button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre u objetivo (ej: rondo, presión)"
                className="pl-9 min-h-11"
                aria-label="Buscar ejercicio"
              />
            </div>

            <ChipRow label="Deporte">
              <Chip active={!sport} onClick={() => setSport(undefined)}>Todos</Chip>
              {SPORT_CHIPS.map((s) => (
                <Chip key={s} active={sport === s} onClick={() => setSport(sport === s ? undefined : s)}>
                  {EXERCISE_SPORT_LABEL[s]}
                </Chip>
              ))}
            </ChipRow>

            <ChipRow label="Objetivo">
              <Chip active={!tag} onClick={() => setTag(undefined)}>Todos</Chip>
              {OBJECTIVE_CHIPS.map((c) => (
                <Chip key={c.tag} active={tag === c.tag} onClick={() => setTag(tag === c.tag ? undefined : c.tag)}>
                  {c.label}
                </Chip>
              ))}
            </ChipRow>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
              </div>
            ) : isError ? (
              <div className="rounded-lg border border-destructive/40 p-4 text-sm space-y-2">
                <p>No pudimos cargar la biblioteca.</p>
                <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>Reintentar</Button>
              </div>
            ) : exercises.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                {source === 'school'
                  ? 'Tu escuela todavía no tiene ejercicios guardados. Desde la pizarra táctica usa «Guardar en biblioteca».'
                  : 'No hay plantillas con esos filtros.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {exercises.map((ex) => (
                  <ExerciseCard
                    key={ex.id}
                    exercise={ex}
                    onView={() => setViewing(ex)}
                    onPick={onPick ? () => onPick(ex) : undefined}
                    pickLabel={pickLabel}
                    picking={picking}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 min-h-9 rounded-full border px-3 text-sm transition-colors ${
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-background hover:bg-muted border-border text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function ExerciseMeta({ exercise }: { exercise: TrainingExercise }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {exercise.minutes != null && (
        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{exercise.minutes} min</span>
      )}
      {exercise.age_group && (
        <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{exercise.age_group}</span>
      )}
      <span>{EXERCISE_SPORT_LABEL[exercise.sport] ?? exercise.sport}</span>
    </div>
  );
}

function ExerciseCard({
  exercise, onView, onPick, pickLabel, picking,
}: {
  exercise: TrainingExercise;
  onView: () => void;
  onPick?: () => void;
  pickLabel: string;
  picking?: boolean;
}) {
  const thumb = useMemo(() => exerciseThumbnail(exercise.board), [exercise.board]);
  return (
    <div className="rounded-xl border bg-card overflow-hidden flex flex-col">
      <button type="button" onClick={onView} className="block bg-emerald-800" aria-label={`Ver ${exercise.name}`}>
        <TacticalStaticSvg players={thumb.players} arrows={thumb.arrows} width={300} className="w-full h-auto max-h-44" />
      </button>
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="space-y-1">
          <p className="font-semibold leading-tight">{exercise.name}</p>
          <ExerciseMeta exercise={exercise} />
        </div>
        {exercise.objective && <p className="text-xs text-muted-foreground line-clamp-2">{exercise.objective}</p>}
        <div className="mt-auto grid grid-cols-2 gap-2 pt-1">
          <Button type="button" variant="outline" className="min-h-11" onClick={onView}>Ver</Button>
          {onPick && (
            <Button type="button" className="min-h-11 px-2 text-xs sm:text-sm" onClick={onPick} disabled={picking}>
              {picking ? 'Aplicando…' : pickLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ExerciseDetail({
  exercise, onBack, onPick, pickLabel, picking,
}: {
  exercise: TrainingExercise;
  onBack: () => void;
  onPick?: () => void;
  pickLabel: string;
  picking?: boolean;
}) {
  const thumb = useMemo(() => exerciseThumbnail(exercise.board), [exercise.board]);
  const frames = Array.isArray(exercise.board?.frames) ? exercise.board.frames.length : 0;
  return (
    <div className="space-y-4">
      <Button type="button" variant="ghost" className="min-h-11 -ml-2" onClick={onBack}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver a la biblioteca
      </Button>
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,320px)_1fr] gap-4">
        <div className="rounded-xl overflow-hidden bg-emerald-800 self-start">
          <TacticalStaticSvg players={thumb.players} arrows={thumb.arrows} width={320} className="w-full h-auto" />
        </div>
        <div className="space-y-3 text-sm">
          <ExerciseMeta exercise={exercise} />
          {frames > 1 && (
            <p className="text-xs text-muted-foreground">Jugada animada de {frames} cuadros (se ve completa en la pizarra).</p>
          )}
          {exercise.objective && (
            <div><p className="font-medium">Objetivo</p><p className="text-muted-foreground">{exercise.objective}</p></div>
          )}
          {exercise.description && (
            <div><p className="font-medium">Organización</p><p className="text-muted-foreground whitespace-pre-line">{exercise.description}</p></div>
          )}
          {exercise.materials && (
            <div><p className="font-medium">Material</p><p className="text-muted-foreground">{exercise.materials}</p></div>
          )}
          {exercise.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {exercise.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
            </div>
          )}
        </div>
      </div>
      {onPick && (
        <Button type="button" className="w-full min-h-11" onClick={onPick} disabled={picking}>
          {picking ? 'Aplicando…' : pickLabel}
        </Button>
      )}
    </div>
  );
}
