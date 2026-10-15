/**
 * Biblioteca de ejercicios (pizarra T3, spec docs/specs/pizarra-nivel-tacticalpad.md §5):
 * búsqueda, filtros por deporte y objetivo, «Plantillas SportMaps» vs «De mi
 * escuela», tarjetas con miniatura y «Usar en esta sesión» / «Ver».
 *
 * D1 (docs/specs/pizarra-multideporte-3d-ia.md, M1): los chips de deporte son
 * SOLO los de la escuela (GET /exercises/sports: sus equipos ∪ schools.sports)
 * y «Preparación física» (lo genérico) siempre. Con un solo deporte la fila de
 * chips no aparece. El BFF ya no manda plantillas de otros deportes.
 *
 * M2 (D4): pestaña «Paquetes» (ExercisePacksTab) para activar, exportar e
 * importar paquetes; la lista de plantillas ya llega filtrada por los
 * paquetes activados desde el BFF.
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
import { ExercisePacksTab } from '@/components/school/ExercisePacksTab';
import { isTacticalSport } from '@/lib/school/tacticalSports';
import type { TacticalPackEvent } from '@/lib/school/tacticalUsage';
import {
  EXERCISE_SPORT_LABEL,
  exerciseThumbnail,
  listExercises,
  listLibrarySports,
  type ExerciseSport,
  type TrainingExercise,
} from '@/lib/school/exerciseLibrary';

type Source = 'templates' | 'school' | 'packs';

/** Objetivos frecuentes como atajo (son etiquetas: filtran por `tag`). */
const OBJECTIVE_CHIPS: { tag: string; label: string }[] = [
  { tag: 'rondo', label: 'Rondos' },
  { tag: 'posesión', label: 'Posesión' },
  { tag: 'salida de balón', label: 'Salida de balón' },
  { tag: 'presión', label: 'Presión' },
  { tag: 'finalización', label: 'Finalización' },
  { tag: 'defensa', label: 'Defensa' },
  { tag: 'transición ofensiva', label: 'Transición' },
  // M6c: fases de juego de las notas de la jugada (lib/school/tacticalMedia.ts).
  { tag: 'transición defensiva', label: 'Transición defensiva' },
  { tag: 'ataque organizado', label: 'Ataque organizado' },
  { tag: 'defensa organizada', label: 'Defensa organizada' },
  { tag: 'balón parado', label: 'Balón parado' },
  { tag: 'conducción', label: 'Conducción' },
  { tag: 'calentamiento', label: 'Calentamiento' },
];

/**
 * Chips de deporte a partir de los deportes de la escuela (ya en orden del
 * catálogo). 'generico' («Preparación física») siempre, al final. Con UN solo
 * deporte (además de lo genérico) no hay nada que elegir: sin fila de chips.
 * Si el BFF no responde, el deporte del equipo + lo genérico (nunca todos).
 */
export function librarySportChips(
  schoolSports: readonly ExerciseSport[] | undefined,
  fallbackSport?: ExerciseSport,
): { chips: ExerciseSport[]; showRow: boolean } {
  const base = schoolSports && schoolSports.length > 0
    ? schoolSports
    : (fallbackSport && fallbackSport !== 'generico' ? [fallbackSport] : []);
  const chips: ExerciseSport[] = [...base.filter((s) => s !== 'generico'), 'generico'];
  return { chips, showRow: chips.length > 2 };
}

export interface ExerciseLibraryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se llama al tocar «Usar en esta sesión». Si no viene, el panel es solo de consulta. */
  onPick?: (exercise: TrainingExercise) => void;
  pickLabel?: string;
  /** Deporte con el que arranca el filtro (el del equipo). Con un deporte
   *  elegido la lista trae también los genéricos (calentamientos,
   *  coordinación): sirven para cualquier equipo. */
  defaultSport?: ExerciseSport;
  /** Deshabilita «Usar» mientras el padre aplica el ejercicio. */
  picking?: boolean;
  /** Métrica de uso (T0) de la pestaña «Paquetes». */
  onPackEvent?: (event: TacticalPackEvent) => void;
}

export function ExerciseLibraryPanel({
  open,
  onOpenChange,
  onPick,
  pickLabel = 'Usar en esta sesión',
  defaultSport,
  picking,
  onPackEvent,
}: ExerciseLibraryPanelProps) {
  const [source, setSource] = useState<Source>('templates');
  const [search, setSearch] = useState('');
  const [sport, setSport] = useState<ExerciseSport | undefined>(isTacticalSport(defaultSport) ? defaultSport : undefined);
  const [tag, setTag] = useState<string | undefined>();
  const [viewing, setViewing] = useState<TrainingExercise | null>(null);

  const sportsQuery = useQuery({
    queryKey: ['training-exercise-sports'],
    queryFn: listLibrarySports,
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const { chips, showRow: showSportRow } = librarySportChips(
    sportsQuery.data,
    isTacticalSport(defaultSport) ? defaultSport : undefined,
  );
  // Un deporte que la escuela no tiene (o la fila escondida con un solo
  // deporte) = sin filtro: el BFF ya devuelve solo lo de la escuela.
  const sportsKnown = sportsQuery.isSuccess || sportsQuery.isError;
  const effectiveSport = sport && (!sportsKnown || (showSportRow && chips.includes(sport))) ? sport : undefined;

  const params = useMemo(
    () => ({ q: search.trim() || undefined, sport: effectiveSport, includeGeneric: true, tag, templates: source === 'templates' }),
    [search, effectiveSport, tag, source],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['training-exercises', params],
    queryFn: () => listExercises(params),
    enabled: open && source !== 'packs',
    staleTime: 60_000,
  });

  const exercises = data ?? [];

  const handleOpenChange = (next: boolean) => {
    if (!next) setViewing(null);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* min-w-0 + overflow-x-hidden: DialogContent es un grid y una fila de chips
          sin envolver lo ensanchaba más allá del diálogo (pestañas, buscador y
          chips cortados a la derecha en escritorio). */}
      <DialogContent className="max-w-3xl max-h-[90vh] grid-cols-[minmax(0,1fr)] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
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
          <div className="space-y-4 min-w-0">
            {/* Origen: una acción por fila, botones grandes (celular). */}
            <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Origen de los ejercicios">
              {([
                { value: 'templates', label: 'Plantillas SportMaps' },
                { value: 'school', label: 'De mi escuela' },
                { value: 'packs', label: 'Paquetes' },
              ] as const).map((o) => (
                <Button
                  key={o.value}
                  type="button"
                  role="tab"
                  aria-selected={source === o.value}
                  variant={source === o.value ? 'default' : 'outline'}
                  className="min-h-11 h-auto px-2 py-2 whitespace-normal leading-tight text-center"
                  onClick={() => setSource(o.value)}
                >
                  {o.label}
                </Button>
              ))}
            </div>

            {source === 'packs' ? <ExercisePacksTab onEvent={onPackEvent} /> : (<>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar (ej: rondo, saque, bandeja)"
                className="pl-9 min-h-11"
                aria-label="Buscar ejercicio"
              />
            </div>

            {showSportRow && (
              <ChipRow label="Deporte">
                <Chip active={!effectiveSport} onClick={() => setSport(undefined)}>Todos</Chip>
                {chips.map((s) => (
                  <Chip key={s} active={effectiveSport === s} onClick={() => setSport(effectiveSport === s ? undefined : s)}>
                    {EXERCISE_SPORT_LABEL[s]}
                  </Chip>
                ))}
              </ChipRow>
            )}
            {effectiveSport && effectiveSport !== 'generico' && (
              <p className="text-xs text-muted-foreground -mt-2">
                También ves la preparación física (calentamiento, coordinación), que sirve para cualquier deporte.
              </p>
            )}

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
            </>)}
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
      {/* Envuelven en varias filas: con 9 deportes y 10 objetivos un scroll
          lateral escondía la mitad y empujaba el ancho del diálogo. */}
      <div className="flex flex-wrap gap-2">{children}</div>
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
        <TacticalStaticSvg sport={exercise.sport} players={thumb.players} arrows={thumb.arrows} width={300} className="w-full h-auto max-h-44" />
      </button>
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="space-y-1">
          <p className="font-semibold leading-tight">{exercise.name}</p>
          <ExerciseMeta exercise={exercise} />
        </div>
        {exercise.objective && <p className="text-xs text-muted-foreground line-clamp-2">{exercise.objective}</p>}
        <div className="mt-auto grid grid-cols-[auto_minmax(0,1fr)] gap-2 pt-1">
          <Button type="button" variant="outline" className="min-h-11 px-4" onClick={onView}>Ver</Button>
          {onPick && (
            <Button type="button" className="min-h-11 h-auto px-3 py-2 text-sm whitespace-normal leading-tight text-center" onClick={onPick} disabled={picking}>
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
          <TacticalStaticSvg sport={exercise.sport} players={thumb.players} arrows={thumb.arrows} width={320} className="w-full h-auto" />
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
