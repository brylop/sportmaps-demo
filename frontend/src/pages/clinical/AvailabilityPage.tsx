import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  AlertCircle, AlertTriangle, CalendarOff, Copy, Eye, Loader2, Pencil, Plus, Trash2, UserCog,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  createAvailabilityException, deleteAvailabilityBlock, deleteAvailabilityException, getAvailableSlots,
  getMyVendorProfile, listAvailability, listAvailabilityExceptions, upsertAvailabilityBlock,
} from '@/lib/clinical/api';
import { clinicalErrorMessage } from '@/lib/clinical/labels';
import { addDaysISO, minutesToTime, timeToMinutes } from '@/lib/clinical/agenda-extra';
import type { AvailabilityBlock } from '@/lib/clinical/types';
import { dayToLocalDate, todayColombia } from '@/lib/dateUtils';

const DAYS: { dow: number; label: string }[] = [
  { dow: 1, label: 'Lunes' }, { dow: 2, label: 'Martes' }, { dow: 3, label: 'Miércoles' },
  { dow: 4, label: 'Jueves' }, { dow: 5, label: 'Viernes' }, { dow: 6, label: 'Sábado' }, { dow: 0, label: 'Domingo' },
];
const WEEKDAYS = [1, 2, 3, 4, 5];
const TIMES = Array.from({ length: (23 - 5) * 4 + 1 }, (_, i) => minutesToTime(5 * 60 + i * 15));
const SLOT_DURATIONS = [15, 20, 30, 45, 60, 75, 90, 120];
const BUFFERS = [0, 5, 10, 15, 20, 30];

type BlockDraft = Omit<AvailabilityBlock, 'id'> & { id?: string };

function hhmm(t: string) { return t.slice(0, 5); }
function overlaps(a: { start_time: string; end_time: string }, b: { start_time: string; end_time: string }) {
  return timeToMinutes(a.start_time) < timeToMinutes(b.end_time) && timeToMinutes(b.start_time) < timeToMinutes(a.end_time);
}

export default function AvailabilityPage() {
  const qc = useQueryClient();
  const today = todayColombia();
  const vendorQ = useQuery({ queryKey: ['clinical', 'my-vendor-profile'], queryFn: getMyVendorProfile });
  const vendorId = vendorQ.data?.id ?? null;

  const blocksQ = useQuery({
    queryKey: ['agenda', 'availability', vendorId],
    queryFn: () => listAvailability(vendorId as string),
    enabled: !!vendorId,
  });
  const exQ = useQuery({
    queryKey: ['agenda', 'exceptions', vendorId, today],
    queryFn: () => listAvailabilityExceptions(vendorId as string, today),
    enabled: !!vendorId,
  });

  const [blockDraft, setBlockDraft] = useState<BlockDraft | null>(null);
  const [exOpen, setExOpen] = useState(false);
  const [previewDate, setPreviewDate] = useState(today);

  const previewQ = useQuery({
    queryKey: ['agenda', 'available-slots', vendorId, null, previewDate],
    queryFn: () => getAvailableSlots(vendorId as string, null, previewDate),
    enabled: !!vendorId && !!previewDate,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['agenda', 'availability'] });
    qc.invalidateQueries({ queryKey: ['agenda', 'exceptions'] });
    qc.invalidateQueries({ queryKey: ['agenda', 'available-slots'] });
  };

  const blocks = useMemo(() => blocksQ.data ?? [], [blocksQ.data]);

  const deleteBlockM = useMutation({
    mutationFn: (id: string) => deleteAvailabilityBlock(id),
    onSuccess: () => { toast.success('Bloque eliminado'); invalidate(); },
    onError: (e) => toast.error(clinicalErrorMessage(e)),
  });

  const toggleBlockM = useMutation({
    mutationFn: (b: AvailabilityBlock) => upsertAvailabilityBlock({ ...b, is_active: !b.is_active }),
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(clinicalErrorMessage(e)),
  });

  // Copia los bloques de un día a los días hábiles que no tengan nada que se cruce.
  const copyM = useMutation({
    mutationFn: async (fromDow: number) => {
      const source = blocks.filter((b) => b.day_of_week === fromDow);
      let created = 0;
      let skipped = 0;
      for (const dow of WEEKDAYS.filter((d) => d !== fromDow)) {
        const existing = blocks.filter((b) => b.day_of_week === dow);
        for (const s of source) {
          if (existing.some((e) => overlaps(e, s))) { skipped++; continue; }
          await upsertAvailabilityBlock({
            vendor_profile_id: s.vendor_profile_id, day_of_week: dow, start_time: s.start_time, end_time: s.end_time,
            slot_duration_minutes: s.slot_duration_minutes, buffer_time_minutes: s.buffer_time_minutes,
            max_concurrent: s.max_concurrent, is_active: s.is_active,
          });
          created++;
        }
      }
      return { created, skipped };
    },
    onSuccess: ({ created, skipped }) => {
      toast.success(`Copiado: ${created} bloque(s)`, skipped ? { description: `${skipped} se omitieron porque ya había horario en ese rango.` } : undefined);
      invalidate();
    },
    onError: (e) => { toast.error(clinicalErrorMessage(e)); invalidate(); },
  });

  const deleteExM = useMutation({
    mutationFn: (id: string) => deleteAvailabilityException(id),
    onSuccess: () => { toast.success('Bloqueo eliminado'); invalidate(); },
    onError: (e) => toast.error(clinicalErrorMessage(e)),
  });

  if (vendorQ.isLoading) {
    return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (vendorQ.isError) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">{clinicalErrorMessage(vendorQ.error)}</p>
          <Button variant="outline" onClick={() => vendorQ.refetch()}>Reintentar</Button>
        </CardContent>
      </Card>
    );
  }
  if (!vendorQ.data) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserCog className="h-5 w-5" />Primero tu perfil profesional</CardTitle>
          <CardDescription>
            Tus horarios se guardan en tu perfil profesional (especialidad, tarjeta profesional y datos públicos).
            Créalo y vuelve aquí para definir tu disponibilidad.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild><Link to="/vendor/onboarding">Crear mi perfil profesional</Link></Button>
        </CardContent>
      </Card>
    );
  }

  const vendor = vendorQ.data;
  const exceptions = exQ.data ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Disponibilidad</h1>
        <p className="text-sm text-muted-foreground">Define cuándo atiendes. Con esto se arman los horarios que ven quienes reservan.</p>
      </div>

      {vendor.verification_status !== 'verified' && (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Aún no apareces en el marketplace; tu agenda interna sí funciona. Cuando verifiquemos tu perfil, estos horarios quedarán visibles para reservar.</p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* Semana */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Horario semanal</CardTitle>
            <CardDescription>Puedes tener varios bloques por día (por ejemplo, mañana y tarde).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {blocksQ.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : blocksQ.isError ? (
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-destructive">{clinicalErrorMessage(blocksQ.error)}</span>
                <Button size="sm" variant="outline" onClick={() => blocksQ.refetch()}>Reintentar</Button>
              </div>
            ) : DAYS.map(({ dow, label }) => {
              const dayBlocks = blocks.filter((b) => b.day_of_week === dow);
              return (
                <div key={dow} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{label}</span>
                    <div className="flex gap-1">
                      {dayBlocks.length > 0 && WEEKDAYS.includes(dow) && (
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => copyM.mutate(dow)} disabled={copyM.isPending}>
                          {copyM.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
                          Copiar a días hábiles
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => setBlockDraft({
                          vendor_profile_id: vendor.id, day_of_week: dow, start_time: '08:00', end_time: '12:00',
                          slot_duration_minutes: 60, buffer_time_minutes: 0, max_concurrent: 1, is_active: true,
                        })}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" />Bloque
                      </Button>
                    </div>
                  </div>
                  {dayBlocks.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">No atiendes este día.</p>
                  ) : (
                    <div className="mt-2 space-y-1.5">
                      {dayBlocks.map((b) => (
                        <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-sm">
                          <div className={b.is_active ? '' : 'opacity-50'}>
                            <span className="font-medium">{hhmm(b.start_time)} – {hhmm(b.end_time)}</span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              citas de {b.slot_duration_minutes} min{b.buffer_time_minutes ? ` + ${b.buffer_time_minutes} min de pausa` : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Switch
                              checked={b.is_active}
                              onCheckedChange={() => toggleBlockM.mutate(b)}
                              aria-label={b.is_active ? 'Desactivar bloque' : 'Activar bloque'}
                            />
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setBlockDraft(b)} aria-label="Editar bloque">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => deleteBlockM.mutate(b.id)} disabled={deleteBlockM.isPending} aria-label="Eliminar bloque"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-5">
          {/* Excepciones */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Bloqueos y vacaciones</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setExOpen(true)}><Plus className="mr-1 h-3.5 w-3.5" />Agregar</Button>
              </div>
              <CardDescription>Días o rangos en los que no atiendes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {exQ.isLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : exQ.isError ? (
                <p className="text-sm text-destructive">{clinicalErrorMessage(exQ.error)}</p>
              ) : exceptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin bloqueos próximos.</p>
              ) : exceptions.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium capitalize">
                      {format(dayToLocalDate(e.exception_date), "EEE d 'de' MMM yyyy", { locale: es })}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {e.start_time && e.end_time ? `${hhmm(e.start_time)} – ${hhmm(e.end_time)}` : 'Todo el día'}
                      {e.reason ? ` · ${e.reason}` : ''}
                    </p>
                  </div>
                  <Button
                    size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                    onClick={() => deleteExM.mutate(e.id)} disabled={deleteExM.isPending} aria-label="Eliminar bloqueo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Vista previa */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Eye className="h-4 w-4" />Vista previa</CardTitle>
              <CardDescription>Los horarios libres que vería un cliente ese día.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input type="date" value={previewDate} min={today} onChange={(e) => setPreviewDate(e.target.value)} />
              {previewQ.isLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : previewQ.isError ? (
                <p className="text-sm text-destructive">{clinicalErrorMessage(previewQ.error)}</p>
              ) : (previewQ.data ?? []).length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarOff className="h-4 w-4" />Sin horarios libres ese día.</p>
              ) : (
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-3">
                  {(previewQ.data ?? []).map((s) => (
                    <div key={s.start_time} className="rounded-md border px-2 py-1.5 text-center text-sm">
                      {s.start_time.slice(0, 5)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <BlockDialog
        draft={blockDraft}
        siblings={blockDraft ? blocks.filter((b) => b.day_of_week === blockDraft.day_of_week && b.id !== blockDraft.id) : []}
        onClose={() => setBlockDraft(null)}
        onSaved={invalidate}
      />
      <ExceptionDialog open={exOpen} onOpenChange={setExOpen} vendorId={vendor.id} onSaved={invalidate} />
    </div>
  );
}

function BlockDialog({ draft, siblings, onClose, onSaved }: {
  draft: BlockDraft | null;
  siblings: AvailabilityBlock[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [b, setB] = useState<BlockDraft | null>(draft);
  useEffect(() => { setB(draft ? { ...draft, start_time: hhmm(draft.start_time), end_time: hhmm(draft.end_time) } : null); }, [draft]);

  const m = useMutation({
    mutationFn: (x: BlockDraft) => upsertAvailabilityBlock(x),
    onSuccess: () => { toast.success('Horario guardado'); onSaved(); onClose(); },
    onError: (e) => toast.error(clinicalErrorMessage(e)),
  });

  const rangeOk = !!b && timeToMinutes(b.end_time) > timeToMinutes(b.start_time);
  const fitsOne = !!b && timeToMinutes(b.end_time) - timeToMinutes(b.start_time) >= b.slot_duration_minutes;
  const clash = !!b && siblings.some((s) => overlaps(s, b));
  const dayLabel = b ? DAYS.find((d) => d.dow === b.day_of_week)?.label : '';

  return (
    <Dialog open={!!draft} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{draft?.id ? 'Editar bloque' : 'Nuevo bloque'} · {dayLabel}</DialogTitle>
          <DialogDescription>Las citas se ofrecen dentro de este rango.</DialogDescription>
        </DialogHeader>
        {b && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Desde</Label>
              <Select value={b.start_time} onValueChange={(v) => setB({ ...b, start_time: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">{TIMES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Hasta</Label>
              <Select value={b.end_time} onValueChange={(v) => setB({ ...b, end_time: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">{TIMES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Duración de cada cita</Label>
              <Select value={String(b.slot_duration_minutes)} onValueChange={(v) => setB({ ...b, slot_duration_minutes: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SLOT_DURATIONS.map((d) => <SelectItem key={d} value={String(d)}>{d} min</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Pausa entre citas</Label>
              <Select value={String(b.buffer_time_minutes)} onValueChange={(v) => setB({ ...b, buffer_time_minutes: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BUFFERS.map((d) => <SelectItem key={d} value={String(d)}>{d === 0 ? 'Sin pausa' : `${d} min`}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1 text-xs">
              {!rangeOk && <p className="text-destructive">La hora final debe ser posterior a la inicial.</p>}
              {rangeOk && !fitsOne && <p className="text-destructive">El rango no alcanza para una cita completa.</p>}
              {clash && <p className="text-destructive">Se cruza con otro bloque de este día.</p>}
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={m.isPending}>Cancelar</Button>
          <Button
            onClick={() => b && m.mutate({ ...b, start_time: `${b.start_time}:00`, end_time: `${b.end_time}:00` })}
            disabled={!b || !rangeOk || !fitsOne || clash || m.isPending}
          >
            {m.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExceptionDialog({ open, onOpenChange, vendorId, onSaved }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  vendorId: string;
  onSaved: () => void;
}) {
  const today = todayColombia();
  const [date, setDate] = useState(today);
  const [endDate, setEndDate] = useState('');
  const [fullDay, setFullDay] = useState(true);
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('12:00');
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (open) { setDate(today); setEndDate(''); setFullDay(true); setStart('08:00'); setEnd('12:00'); setReason(''); }
  }, [open, today]);

  const m = useMutation({
    mutationFn: async () => {
      // Día completo con fecha final = un bloqueo por cada día del rango (vacaciones).
      const last = fullDay && endDate && endDate > date ? endDate : date;
      for (let d = date; d <= last; d = addDaysISO(d, 1)) {
        await createAvailabilityException({
          vendor_profile_id: vendorId,
          exception_date: d,
          start_time: fullDay ? null : `${start}:00`,
          end_time: fullDay ? null : `${end}:00`,
          reason: reason.trim() || null,
        });
      }
    },
    onSuccess: () => { toast.success('Bloqueo agregado'); onSaved(); onOpenChange(false); },
    onError: (e) => toast.error(clinicalErrorMessage(e)),
  });

  const rangeDays = fullDay && endDate && endDate > date
    ? Math.round((dayToLocalDate(endDate).getTime() - dayToLocalDate(date).getTime()) / 86_400_000) + 1 : 1;
  const valid = !!date && date >= today && (fullDay || timeToMinutes(end) > timeToMinutes(start))
    && (!endDate || endDate >= date) && rangeDays <= 62;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Bloquear fecha</DialogTitle>
          <DialogDescription>Ese día (o rango) no se ofrecerán horarios. Las citas ya agendadas no se cancelan solas.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ex-date">Fecha</Label>
            <Input id="ex-date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="ex-full" checked={fullDay} onCheckedChange={setFullDay} />
            <Label htmlFor="ex-full">Día completo</Label>
          </div>
          {fullDay && (
            <div className="space-y-1.5">
              <Label htmlFor="ex-end">Hasta (opcional, para vacaciones)</Label>
              <Input id="ex-end" type="date" min={date} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              {rangeDays > 1 && <p className="text-xs text-muted-foreground">Se bloquean {rangeDays} días.</p>}
              {rangeDays > 62 && <p className="text-xs text-destructive">Máximo 62 días por vez.</p>}
            </div>
          )}
          {!fullDay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Desde</Label>
                <Select value={start} onValueChange={setStart}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">{TIMES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Hasta</Label>
                <Select value={end} onValueChange={setEnd}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">{TIMES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="ex-reason">Motivo (opcional)</Label>
            <Input id="ex-reason" value={reason} maxLength={120} onChange={(e) => setReason(e.target.value)} placeholder="Vacaciones, congreso, festivo…" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={m.isPending}>Cancelar</Button>
          <Button onClick={() => m.mutate()} disabled={!valid || m.isPending}>
            {m.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
