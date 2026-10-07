import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, Dumbbell, Loader2, Lock, PlayCircle, Plus, Search, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { formatDayCO, todayColombia } from '@/lib/dateUtils';
import {
  createAssignment, createLibraryExercise, listAssignments, listExerciseLibrary, listExerciseLogs, updateAssignment,
} from '@/lib/clinical/api';
import { BODY_REGION_LABEL, clinicalErrorMessage } from '@/lib/clinical/labels';
import { adherencePct, lastNDaysColombia } from '@/lib/clinical/family-extra';
import {
  BODY_REGIONS, type BodyRegion, type ClinicalEpisode, type ClinicalPatient, type ExerciseAssignment,
  type ExerciseLibraryItem,
} from '@/lib/clinical/types';

type Category = NonNullable<ExerciseLibraryItem['category']>;
const CATEGORY_LABEL: Record<Category, string> = {
  movilidad: 'Movilidad', fortalecimiento: 'Fortalecimiento', estiramiento: 'Estiramiento', propiocepcion: 'Propiocepción',
  cardio: 'Cardio', respiracion: 'Respiración', otro: 'Otro',
};
const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];

type Props = { patient: ClinicalPatient; episodes: ClinicalEpisode[]; canWrite: boolean };

function regionLabel(r: string | null) {
  if (!r) return null;
  return BODY_REGION_LABEL[r as BodyRegion] ?? r;
}

function paramsText(a: Pick<ExerciseAssignment, 'sets' | 'reps' | 'hold_seconds' | 'frequency_per_week'>) {
  return [
    a.sets && a.reps ? `${a.sets}×${a.reps}` : a.sets ? `${a.sets} series` : a.reps ? `${a.reps} reps` : null,
    a.hold_seconds ? `sostener ${a.hold_seconds} s` : null,
    `${a.frequency_per_week} ${a.frequency_per_week === 1 ? 'vez' : 'veces'}/semana`,
  ].filter(Boolean).join(' · ');
}

function numOrNull(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

// ── Crear ejercicio propio ───────────────────────────────────────────────────
function CreateExerciseForm({ onCreated, onCancel }: { onCreated: (ex: ExerciseLibraryItem) => void; onCancel: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category | 'none'>('none');
  const [region, setRegion] = useState<BodyRegion | 'none'>('none');
  const [video, setVideo] = useState('');
  const badVideo = video.trim() !== '' && !/^https:\/\//i.test(video.trim());

  const createM = useMutation({
    mutationFn: () => createLibraryExercise({
      name: name.trim(),
      description: description.trim() || null,
      category: category === 'none' ? null : category,
      body_region: region === 'none' ? null : region,
      video_url: video.trim() || null,
    }),
    onSuccess: (ex) => {
      toast.success('Ejercicio creado en tu biblioteca.');
      qc.invalidateQueries({ queryKey: ['clinical', 'exercise-library'] });
      onCreated(ex);
    },
    onError: (e) => toast.error(clinicalErrorMessage(e)),
  });

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="ex-name">Nombre</Label>
        <Input id="ex-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Puente de glúteo a una pierna" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ex-desc">Cómo se hace</Label>
        <Textarea id="ex-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Categoría</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as Category | 'none')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin categoría</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Zona</Label>
          <Select value={region} onValueChange={(v) => setRegion(v as BodyRegion | 'none')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">General</SelectItem>
              {BODY_REGIONS.map((r) => <SelectItem key={r} value={r}>{BODY_REGION_LABEL[r]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ex-video">Enlace al video (opcional)</Label>
        <Input id="ex-video" inputMode="url" value={video} onChange={(e) => setVideo(e.target.value)} placeholder="https://…" />
        {badVideo && <p className="text-xs text-destructive">El enlace debe empezar por https://</p>}
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button disabled={name.trim().length < 3 || badVideo || createM.isPending} onClick={() => createM.mutate()}>
          {createM.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Crear ejercicio
        </Button>
      </div>
    </div>
  );
}

// ── Asignar ──────────────────────────────────────────────────────────────────
function AssignDialog({ open, onOpenChange, patient, episodes }: {
  open: boolean; onOpenChange: (o: boolean) => void; patient: ClinicalPatient; episodes: ClinicalEpisode[];
}) {
  const qc = useQueryClient();
  const openEpisodes = episodes.filter((e) => e.status === 'abierto');
  const [mode, setMode] = useState<'pick' | 'create' | 'params'>('pick');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<Category | 'all'>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [picked, setPicked] = useState<ExerciseLibraryItem | null>(null);
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('10');
  const [hold, setHold] = useState('');
  const [freq, setFreq] = useState('3');
  const [instructions, setInstructions] = useState('');
  const [startDate, setStartDate] = useState(todayColombia());
  const [endDate, setEndDate] = useState('');
  const [episodeId, setEpisodeId] = useState<string>(openEpisodes.length === 1 ? openEpisodes[0].id : 'none');

  const libQ = useQuery({
    queryKey: ['clinical', 'exercise-library'],
    queryFn: listExerciseLibrary,
    enabled: open,
    staleTime: 10 * 60_000,
  });

  const regionsInLib = useMemo(
    () => Array.from(new Set((libQ.data ?? []).map((e) => e.body_region).filter(Boolean) as string[])).sort(),
    [libQ.data],
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (libQ.data ?? []).filter((e) =>
      (catFilter === 'all' || e.category === catFilter)
      && (regionFilter === 'all' || e.body_region === regionFilter)
      && (!q || e.name.toLowerCase().includes(q) || (e.description ?? '').toLowerCase().includes(q)));
  }, [libQ.data, search, catFilter, regionFilter]);

  const reset = () => {
    setMode('pick'); setSearch(''); setPicked(null); setSets('3'); setReps('10'); setHold(''); setFreq('3');
    setInstructions(''); setStartDate(todayColombia()); setEndDate('');
  };

  const nSets = numOrNull(sets); const nReps = numOrNull(reps); const nHold = numOrNull(hold); const nFreq = numOrNull(freq);
  const errors = [
    nSets !== null && (nSets < 1 || nSets > 20) ? 'Series entre 1 y 20.' : null,
    nReps !== null && (nReps < 1 || nReps > 200) ? 'Repeticiones entre 1 y 200.' : null,
    nHold !== null && (nHold < 1 || nHold > 600) ? 'Sostener entre 1 y 600 segundos.' : null,
    nFreq === null || nFreq < 1 || nFreq > 14 ? 'Veces por semana entre 1 y 14.' : null,
    !startDate ? 'Indica la fecha de inicio.' : null,
    endDate && endDate < startDate ? 'La fecha final no puede ser antes del inicio.' : null,
  ].filter(Boolean) as string[];

  const assignM = useMutation({
    mutationFn: () => createAssignment({
      patient_id: patient.id,
      exercise_id: picked!.id,
      episode_id: episodeId === 'none' ? null : episodeId,
      sets: nSets, reps: nReps, hold_seconds: nHold, frequency_per_week: nFreq ?? 3,
      instructions: instructions.trim() || null,
      start_date: startDate,
      end_date: endDate || null,
    }),
    onSuccess: () => {
      toast.success('Ejercicio asignado. Ya aparece en la app del paciente.');
      qc.invalidateQueries({ queryKey: ['clinical', 'assignments', patient.id] });
      reset();
      onOpenChange(false);
    },
    onError: (e) => toast.error(clinicalErrorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Crear ejercicio propio' : mode === 'params' ? 'Indicaciones' : 'Asignar ejercicio'}
          </DialogTitle>
          <DialogDescription>{patient.full_name}</DialogDescription>
        </DialogHeader>

        {mode === 'pick' && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar ejercicio" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={catFilter} onValueChange={(v) => setCatFilter(v as Category | 'all')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={regionFilter} onValueChange={setRegionFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las zonas</SelectItem>
                  {regionsInLib.map((r) => <SelectItem key={r} value={r}>{regionLabel(r)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {libQ.isLoading && <Skeleton className="h-40 w-full" />}
            {libQ.error && <p className="text-sm text-destructive">{clinicalErrorMessage(libQ.error)}</p>}
            {!libQ.isLoading && !libQ.error && (
              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                {filtered.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No hay ejercicios con ese filtro.</p>}
                {filtered.map((e) => (
                  <button key={e.id} type="button" onClick={() => { setPicked(e); setMode('params'); }}
                    className="w-full text-left rounded-lg border p-2.5 hover:bg-muted/60 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{e.name}</p>
                      {e.professional_id && <Badge variant="outline" className="text-[10px] shrink-0">Propio</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {[e.category ? CATEGORY_LABEL[e.category] : null, regionLabel(e.body_region), e.video_url ? 'Con video' : null].filter(Boolean).join(' · ')}
                    </p>
                  </button>
                ))}
              </div>
            )}
            <Button variant="outline" className="w-full" onClick={() => setMode('create')}>
              <Plus className="w-4 h-4 mr-2" />Crear ejercicio propio
            </Button>
          </div>
        )}

        {mode === 'create' && (
          <CreateExerciseForm
            onCancel={() => setMode('pick')}
            onCreated={(ex) => { setPicked(ex); setMode('params'); }}
          />
        )}

        {mode === 'params' && picked && (
          <div className="space-y-3">
            <div className="rounded-lg bg-muted/50 p-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-sm">{picked.name}</p>
                {picked.description && <p className="text-xs text-muted-foreground line-clamp-3">{picked.description}</p>}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setMode('pick')}><ArrowLeft className="w-4 h-4 mr-1" />Cambiar</Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="as-sets">Series</Label>
                <Input id="as-sets" type="number" inputMode="numeric" min={1} max={20} value={sets} onChange={(e) => setSets(e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="as-reps">Repeticiones</Label>
                <Input id="as-reps" type="number" inputMode="numeric" min={1} max={200} value={reps} onChange={(e) => setReps(e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="as-hold">Sostener (segundos)</Label>
                <Input id="as-hold" type="number" inputMode="numeric" min={1} max={600} value={hold} onChange={(e) => setHold(e.target.value)} placeholder="Opcional" /></div>
              <div className="space-y-1.5"><Label htmlFor="as-freq">Veces por semana</Label>
                <Input id="as-freq" type="number" inputMode="numeric" min={1} max={14} value={freq} onChange={(e) => setFreq(e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="as-start">Desde</Label>
                <Input id="as-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="as-end">Hasta (opcional)</Label>
                <Input id="as-end" type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="as-ins">Indicaciones para el paciente</Label>
              <Textarea id="as-ins" rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)}
                placeholder="Ej.: sin dolor por encima de 3/10; detente si duele más" />
            </div>
            {openEpisodes.length > 0 && (
              <div className="space-y-1.5">
                <Label>Episodio (opcional)</Label>
                <Select value={episodeId} onValueChange={setEpisodeId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin vincular</SelectItem>
                    {openEpisodes.map((e) => <SelectItem key={e.id} value={e.id}>{e.reason}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {errors.length > 0 && <p className="text-xs text-destructive">{errors[0]}</p>}
          </div>
        )}

        {mode === 'params' && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button disabled={!picked || errors.length > 0 || assignM.isPending} onClick={() => assignM.mutate()}>
              {assignM.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Asignar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Lista de asignaciones ────────────────────────────────────────────────────
type Log = { assignment_id: string; done_on: string; pain: number | null; comment: string | null };

function AssignmentCard({ a, logs, days, canWrite, onDeactivate }: {
  a: ExerciseAssignment; logs: Log[]; days: string[]; canWrite: boolean; onDeactivate: () => void;
}) {
  const doneDays = new Set(logs.map((l) => l.done_on.slice(0, 10)));
  const doneCount = days.filter((d) => doneDays.has(d)).length;
  const expected = a.frequency_per_week * 2;
  const pct = adherencePct(doneCount, a.frequency_per_week, 14);
  const pains = logs.filter((l) => l.pain !== null).map((l) => l.pain as number);
  const lastPain = logs.find((l) => l.pain !== null);
  const avgPain = pains.length ? Math.round((pains.reduce((s, p) => s + p, 0) / pains.length) * 10) / 10 : null;
  const comments = logs.filter((l) => l.comment);

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm flex items-center gap-1.5">
              {a.exercise?.name ?? 'Ejercicio'}
              {a.exercise?.video_url && (
                <a href={a.exercise.video_url} target="_blank" rel="noopener noreferrer" className="text-primary" aria-label="Ver video">
                  <PlayCircle className="w-4 h-4" />
                </a>
              )}
            </p>
            <p className="text-xs text-muted-foreground">{paramsText(a)}</p>
          </div>
          {canWrite && (
            <Button variant="ghost" size="sm" className="text-muted-foreground shrink-0" onClick={onDeactivate}>
              <X className="w-4 h-4 mr-1" />Quitar
            </Button>
          )}
        </div>
        {a.instructions && <p className="text-sm whitespace-pre-line">{a.instructions}</p>}
        <p className="text-xs text-muted-foreground">
          Desde {formatDayCO(a.start_date)}{a.end_date ? ` hasta ${formatDayCO(a.end_date)}` : ' · sin fecha final'}
        </p>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Adherencia 14 días</span>
            <span className={cn('font-medium', pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-rose-600')}>
              {doneCount}/{expected} · {pct}%
            </span>
          </div>
          <div className="flex gap-1">
            {days.map((d) => (
              <span key={d} title={formatDayCO(d)} className={cn('h-2.5 flex-1 rounded-full', doneDays.has(d) ? 'bg-emerald-500' : 'bg-muted')} />
            ))}
          </div>
        </div>
        {(lastPain || comments.length > 0) && (
          <div className="text-xs text-muted-foreground space-y-0.5">
            {lastPain && (
              <p>Dolor reportado: último {lastPain.pain}/10 ({formatDayCO(lastPain.done_on)}){avgPain !== null && pains.length > 1 ? ` · promedio ${avgPain}/10` : ''}</p>
            )}
            {comments.slice(0, 2).map((c) => <p key={c.done_on}>«{c.comment}» — {formatDayCO(c.done_on)}</p>)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ExercisesTab({ patient, episodes, canWrite }: Props) {
  const qc = useQueryClient();
  const [assigning, setAssigning] = useState(false);
  const [toDeactivate, setToDeactivate] = useState<ExerciseAssignment | null>(null);
  const days = useMemo(() => lastNDaysColombia(14), []);

  const assignmentsQ = useQuery({
    queryKey: ['clinical', 'assignments', patient.id],
    queryFn: () => listAssignments(patient.id),
  });
  const logsQ = useQuery({
    queryKey: ['clinical', 'exercise-logs', patient.id, days[0]],
    queryFn: () => listExerciseLogs(patient.id, days[0]),
  });

  const logsByAssignment = useMemo(() => {
    const m = new Map<string, Log[]>();
    for (const l of logsQ.data ?? []) {
      const arr = m.get(l.assignment_id) ?? [];
      arr.push(l);
      m.set(l.assignment_id, arr);
    }
    return m;
  }, [logsQ.data]);

  const deactivateM = useMutation({
    mutationFn: (id: string) => updateAssignment(id, { is_active: false }),
    onSuccess: () => {
      toast.success('Ejercicio retirado del plan.');
      setToDeactivate(null);
      qc.invalidateQueries({ queryKey: ['clinical', 'assignments', patient.id] });
    },
    onError: (e) => toast.error(clinicalErrorMessage(e)),
  });

  const today = todayColombia();
  const all = assignmentsQ.data ?? [];
  const active = all.filter((a) => a.is_active && (!a.end_date || a.end_date >= today));
  const finished = all.filter((a) => !active.includes(a));

  return (
    <div className="space-y-4">
      {!canWrite && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Solo lectura: falta el consentimiento del paciente (o de su acudiente) para datos de salud y tratamiento.
            Cuando lo autorice podrás asignar ejercicios.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Plan de ejercicios en casa</h3>
        {canWrite && <Button size="sm" onClick={() => setAssigning(true)}><Plus className="w-4 h-4 mr-1" />Asignar ejercicio</Button>}
      </div>

      {assignmentsQ.isLoading && <div className="space-y-2"><Skeleton className="h-28 w-full" /><Skeleton className="h-28 w-full" /></div>}

      {assignmentsQ.error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {clinicalErrorMessage(assignmentsQ.error)}
            <Button size="sm" variant="outline" onClick={() => assignmentsQ.refetch()}>Reintentar</Button>
          </AlertDescription>
        </Alert>
      )}
      {logsQ.error && <p className="text-xs text-destructive">No pudimos cargar los registros del paciente: {clinicalErrorMessage(logsQ.error)}</p>}

      {!assignmentsQ.isLoading && !assignmentsQ.error && active.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center space-y-1">
            <Dumbbell className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="text-sm font-medium">Sin ejercicios activos</p>
            <p className="text-xs text-muted-foreground">Lo que asignes aparece en la app del paciente o de su acudiente para marcarlo como hecho.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {active.map((a) => (
          <AssignmentCard key={a.id} a={a} logs={logsByAssignment.get(a.id) ?? []} days={days} canWrite={canWrite}
            onDeactivate={() => setToDeactivate(a)} />
        ))}
      </div>

      {finished.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Ejercicios anteriores ({finished.length})</summary>
          <ul className="mt-2 space-y-1">
            {finished.map((a) => (
              <li key={a.id} className="text-xs text-muted-foreground">
                {a.exercise?.name ?? 'Ejercicio'} · {paramsText(a)} · {formatDayCO(a.start_date)}{a.end_date ? ` – ${formatDayCO(a.end_date)}` : ''}
                {!a.is_active ? ' · retirado' : ''}
              </li>
            ))}
          </ul>
        </details>
      )}

      {canWrite && <AssignDialog open={assigning} onOpenChange={setAssigning} patient={patient} episodes={episodes} />}

      <AlertDialog open={!!toDeactivate} onOpenChange={(o) => !o && setToDeactivate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar este ejercicio del plan?</AlertDialogTitle>
            <AlertDialogDescription>
              «{toDeactivate?.exercise?.name ?? 'Ejercicio'}» dejará de aparecer en la app del paciente. Los registros que ya hizo se conservan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivateM.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={deactivateM.isPending}
              onClick={(e) => { e.preventDefault(); if (toDeactivate) deactivateM.mutate(toDeactivate.id); }}>
              {deactivateM.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default ExercisesTab;
