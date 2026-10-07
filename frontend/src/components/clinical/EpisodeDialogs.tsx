// Diálogos del ciclo de vida del episodio: abrir, editar plan, alta y cierre sin alta.
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { createEpisode, createNote, updateEpisode } from '@/lib/clinical/api';
import { clinicalErrorMessage, SPECIALTY_LABEL } from '@/lib/clinical/labels';
import type { ClinicalEpisode, ClinicalPatient, Specialty } from '@/lib/clinical/types';
import { PainScale, SignButton } from './NoteFormParts';
import { invalidateAfterNote } from './note-utils';

function useEpisodeInvalidate(patientId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['clinical', 'episodes', patientId] });
    qc.invalidateQueries({ queryKey: ['clinical', 'open-episodes'] });
    qc.invalidateQueries({ queryKey: ['clinical', 'episode-stats'] });
  };
}

function parseSessions(v: string): number | null | 'error' {
  if (!v.trim()) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 200 ? n : 'error';
}

// ── Abrir episodio ───────────────────────────────────────────────────────────
export function OpenEpisodeDialog({ open, onOpenChange, patient, onCreated, notice }: {
  open: boolean; onOpenChange: (o: boolean) => void; patient: ClinicalPatient;
  onCreated?: (e: ClinicalEpisode) => void; notice?: string;
}) {
  const invalidate = useEpisodeInvalidate(patient.id);
  const [specialty, setSpecialty] = useState<Specialty>('fisioterapia');
  const [reason, setReason] = useState('');
  const [goals, setGoals] = useState('');
  const [sessions, setSessions] = useState('');
  const [frequency, setFrequency] = useState('');

  useEffect(() => {
    if (open) { setSpecialty('fisioterapia'); setReason(''); setGoals(''); setSessions(''); setFrequency(''); }
  }, [open]);

  const create = useMutation({
    mutationFn: () => createEpisode({
      patient_id: patient.id, specialty, reason: reason.trim(), treatment_goals: goals.trim() || null,
      planned_sessions: parseSessions(sessions) as number | null, frequency: frequency.trim() || null,
    }),
    onSuccess: (e) => { toast.success('Episodio abierto'); invalidate(); onOpenChange(false); onCreated?.(e); },
    onError: (e) => toast.error(clinicalErrorMessage(e)),
  });

  const submit = () => {
    if (reason.trim().length < 3) { toast.error('Escribe el motivo de consulta.'); return; }
    if (parseSessions(sessions) === 'error') { toast.error('Las sesiones planeadas van de 1 a 200.'); return; }
    create.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!create.isPending) onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Abrir episodio de atención</DialogTitle>
          <DialogDescription>Un episodio va desde el motivo de consulta hasta el alta.</DialogDescription>
        </DialogHeader>
        {notice && <p className="rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-xs p-2">{notice}</p>}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Especialidad</Label>
            <Select value={specialty} onValueChange={(v) => setSpecialty(v as Specialty)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(SPECIALTY_LABEL) as Specialty[]).map((s) => <SelectItem key={s} value={s}>{SPECIALTY_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Motivo de consulta *</Label>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej.: dolor en rodilla derecha tras partido" />
          </div>
          <PlanFields goals={goals} setGoals={setGoals} sessions={sessions} setSessions={setSessions}
            frequency={frequency} setFrequency={setFrequency} />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancelar</Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Abrir episodio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlanFields({ goals, setGoals, sessions, setSessions, frequency, setFrequency }: {
  goals: string; setGoals: (v: string) => void; sessions: string; setSessions: (v: string) => void;
  frequency: string; setFrequency: (v: string) => void;
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs">Objetivos del tratamiento</Label>
        <Textarea rows={2} value={goals} onChange={(e) => setGoals(e.target.value)} placeholder="Ej.: EVA ≤ 2, flexión completa, volver a entrenar" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Sesiones planeadas</Label>
          <Input type="number" min={1} max={200} inputMode="numeric" value={sessions} onChange={(e) => setSessions(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Frecuencia</Label>
          <Input value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="2 por semana" maxLength={60} />
        </div>
      </div>
    </>
  );
}

// ── Editar plan ──────────────────────────────────────────────────────────────
export function EditPlanDialog({ episode, onClose }: { episode: ClinicalEpisode | null; onClose: () => void }) {
  const invalidate = useEpisodeInvalidate(episode?.patient_id ?? '');
  const [goals, setGoals] = useState('');
  const [sessions, setSessions] = useState('');
  const [frequency, setFrequency] = useState('');

  useEffect(() => {
    if (episode) {
      setGoals(episode.treatment_goals ?? '');
      setSessions(episode.planned_sessions ? String(episode.planned_sessions) : '');
      setFrequency(episode.frequency ?? '');
    }
  }, [episode]);

  const save = useMutation({
    mutationFn: () => updateEpisode(episode!.id, {
      treatment_goals: goals.trim() || null, planned_sessions: parseSessions(sessions) as number | null,
      frequency: frequency.trim() || null,
    }),
    onSuccess: () => { toast.success('Plan actualizado'); invalidate(); onClose(); },
    onError: (e) => toast.error(clinicalErrorMessage(e)),
  });

  return (
    <Dialog open={!!episode} onOpenChange={(o) => { if (!o && !save.isPending) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Plan de tratamiento</DialogTitle>
          <DialogDescription>{episode?.reason}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <PlanFields goals={goals} setGoals={setGoals} sessions={sessions} setSessions={setSessions}
            frequency={frequency} setFrequency={setFrequency} />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>Cancelar</Button>
          <Button disabled={save.isPending} onClick={() => {
            if (parseSessions(sessions) === 'error') { toast.error('Las sesiones planeadas van de 1 a 200.'); return; }
            save.mutate();
          }}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Guardar plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Alta ─────────────────────────────────────────────────────────────────────
export function DischargeDialog({ episode, onClose }: { episode: ClinicalEpisode | null; onClose: () => void }) {
  const qc = useQueryClient();
  const invalidate = useEpisodeInvalidate(episode?.patient_id ?? '');
  const [summary, setSummary] = useState('');
  const [achieved, setAchieved] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [pain, setPain] = useState<number | null>(null);
  // Si la nota de alta ya se firmó pero cerrar el episodio falló, el reintento no la duplica.
  const signedNoteFor = useRef<string | null>(null);

  useEffect(() => {
    if (episode) { setSummary(''); setAchieved(''); setRecommendations(''); setPain(null); }
  }, [episode]);

  const discharge = useMutation({
    mutationFn: async () => {
      const ep = episode!;
      if (signedNoteFor.current !== ep.id) {
        await createNote({
          patient_id: ep.patient_id, episode_id: ep.id, note_type: 'alta',
          assessment: summary.trim(), objective: achieved.trim() || null, plan: recommendations.trim() || null,
          pain_after: pain,
        });
        signedNoteFor.current = ep.id;
        invalidateAfterNote(qc, ep.patient_id, false);
      }
      return updateEpisode(ep.id, { status: 'alta', discharge_summary: summary.trim() });
    },
    onSuccess: () => { toast.success('Alta registrada'); invalidate(); onClose(); },
    onError: (e) => toast.error(clinicalErrorMessage(e)),
  });

  return (
    <Dialog open={!!episode} onOpenChange={(o) => { if (!o && !discharge.isPending) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dar de alta</DialogTitle>
          <DialogDescription>
            Se firma una nota de alta y el episodio se cierra. Después solo admite notas aclaratorias.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Resumen de alta * (mínimo 10 caracteres)</Label>
            <Textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)}
              placeholder="Estado final, evolución durante el tratamiento" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Objetivos alcanzados</Label>
            <Textarea rows={2} value={achieved} onChange={(e) => setAchieved(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Recomendaciones al egreso</Label>
            <Textarea rows={2} value={recommendations} onChange={(e) => setRecommendations(e.target.value)}
              placeholder="Ejercicios de mantenimiento, retorno progresivo…" />
          </div>
          <PainScale label="EVA al alta" value={pain} onChange={setPain} />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={discharge.isPending}>Cancelar</Button>
          <SignButton pending={discharge.isPending} label="Firmar alta" onConfirm={() => discharge.mutate()}
            validate={() => (summary.trim().length < 10 ? 'Escribe el resumen de alta (mínimo 10 caracteres).' : null)} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Cerrar sin alta ──────────────────────────────────────────────────────────
export function CloseEpisodeDialog({ episode, onClose }: { episode: ClinicalEpisode | null; onClose: () => void }) {
  const invalidate = useEpisodeInvalidate(episode?.patient_id ?? '');
  const [reason, setReason] = useState('');
  useEffect(() => { if (episode) setReason(''); }, [episode]);

  const close = useMutation({
    mutationFn: () => updateEpisode(episode!.id, { status: 'cerrado_sin_alta', discharge_summary: reason.trim() }),
    onSuccess: () => { toast.success('Episodio cerrado'); invalidate(); onClose(); },
    onError: (e) => toast.error(clinicalErrorMessage(e)),
  });

  return (
    <Dialog open={!!episode} onOpenChange={(o) => { if (!o && !close.isPending) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cerrar sin alta</DialogTitle>
          <DialogDescription>
            Para cuando el paciente abandona el tratamiento, lo remites o no vuelve. No se puede reabrir: si regresa, abres un episodio nuevo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label className="text-xs">Motivo del cierre *</Label>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Ej.: no asistió a las últimas 3 citas y no responde" />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={close.isPending}>Cancelar</Button>
          <Button variant="destructive" disabled={close.isPending} onClick={() => {
            if (reason.trim().length < 10) { toast.error('Escribe el motivo del cierre (mínimo 10 caracteres).'); return; }
            close.mutate();
          }}>
            {close.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Cerrar episodio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
