import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ChevronDown, ClipboardList, DoorClosed, Loader2, LogOut, NotebookPen, Pencil, Plus, Stethoscope,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { listDiagnoses, listNotes } from '@/lib/clinical/api';
import { clinicalErrorMessage, EPISODE_STATUS_LABEL, SPECIALTY_LABEL } from '@/lib/clinical/labels';
import { isSessionNote } from '@/lib/clinical/record-extra';
import type { ClinicalDiagnosis, ClinicalEpisode, ClinicalNote, ClinicalPatient, EpisodeStatus } from '@/lib/clinical/types';
import { EpisodeDiagnoses } from './DiagnosisPicker';
import { CloseEpisodeDialog, DischargeDialog, EditPlanDialog, OpenEpisodeDialog } from './EpisodeDialogs';
import { NoteCard } from './NoteCard';
import { AddendumForm, EvolutionForm, InitialAssessmentForm } from './NoteForms';

const STATUS_TONE: Record<EpisodeStatus, string> = {
  abierto: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900',
  alta: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  cerrado_sin_alta: 'bg-muted text-muted-foreground',
};

const fmtDate = (iso: string) => format(parseISO(iso), "d 'de' MMM yyyy", { locale: es });

type NoteDialog =
  | { kind: 'initial'; episode: ClinicalEpisode; appointmentId?: string | null }
  | { kind: 'evolution'; episode: ClinicalEpisode; appointmentId?: string | null }
  | { kind: 'addendum'; note: ClinicalNote };

interface Props {
  patient: ClinicalPatient;
  episodes: ClinicalEpisode[];
  canWrite: boolean;
  /** Pedido externo (?nota=evolucion&cita=…) de abrir la evolución enlazada a una cita. */
  evolutionRequest?: { appointmentId: string | null } | null;
  onEvolutionRequestHandled?: () => void;
}

export function ClinicalHistoryTab({ patient, episodes, canWrite, evolutionRequest, onEvolutionRequestHandled }: Props) {
  const [noteDialog, setNoteDialog] = useState<NoteDialog | null>(null);
  const [openEpisode, setOpenEpisode] = useState<{ notice?: string; then?: { appointmentId: string | null } } | null>(null);
  const [editPlan, setEditPlan] = useState<ClinicalEpisode | null>(null);
  const [discharge, setDischarge] = useState<ClinicalEpisode | null>(null);
  const [closing, setClosing] = useState<ClinicalEpisode | null>(null);

  const notesQ = useQuery({ queryKey: ['clinical', 'notes', patient.id], queryFn: () => listNotes(patient.id) });
  const diagQ = useQuery({ queryKey: ['clinical', 'diagnoses', patient.id], queryFn: () => listDiagnoses(patient.id) });

  const sorted = useMemo(() => [...episodes].sort((a, b) => b.opened_at.localeCompare(a.opened_at)), [episodes]);

  const notesByEpisode = useMemo(() => {
    const m = new Map<string, ClinicalNote[]>();
    (notesQ.data ?? []).forEach((n) => {
      if (!m.has(n.episode_id)) m.set(n.episode_id, []);
      m.get(n.episode_id)!.push(n);
    });
    return m;
  }, [notesQ.data]);

  const diagByEpisode = useMemo(() => {
    const m = new Map<string, ClinicalDiagnosis[]>();
    (diagQ.data ?? []).forEach((d) => {
      if (!m.has(d.episode_id)) m.set(d.episode_id, []);
      m.get(d.episode_id)!.push(d);
    });
    return m;
  }, [diagQ.data]);

  // ?nota=evolucion&cita=…: abre la evolución del episodio abierto más reciente.
  useEffect(() => {
    if (!evolutionRequest || !notesQ.isSuccess) return;
    onEvolutionRequestHandled?.();
    if (!canWrite) return;
    const current = sorted.find((e) => e.status === 'abierto');
    if (current) {
      const hasInitial = (notesByEpisode.get(current.id) ?? []).some((n) => n.note_type === 'valoracion_inicial');
      setNoteDialog({ kind: hasInitial ? 'evolution' : 'initial', episode: current, appointmentId: evolutionRequest.appointmentId });
    } else {
      setOpenEpisode({
        notice: 'Este paciente no tiene un episodio abierto. Ábrelo y luego registra la valoración inicial de la cita.',
        then: { appointmentId: evolutionRequest.appointmentId },
      });
    }
  }, [evolutionRequest, notesQ.isSuccess, canWrite, sorted, notesByEpisode, onEvolutionRequestHandled]);

  const hasOpen = sorted.some((e) => e.status === 'abierto');

  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="flex justify-end">
          <Button onClick={() => setOpenEpisode({})} variant={hasOpen ? 'outline' : 'default'} className="gap-2">
            <Plus className="h-4 w-4" /> Abrir episodio
          </Button>
        </div>
      )}

      {notesQ.isError || diagQ.isError ? (
        <Card><CardContent className="py-6 text-center text-sm space-y-2">
          <p>{clinicalErrorMessage(notesQ.error ?? diagQ.error)}</p>
          <Button size="sm" variant="outline" onClick={() => { notesQ.refetch(); diagQ.refetch(); }}>Reintentar</Button>
        </CardContent></Card>
      ) : notesQ.isLoading || diagQ.isLoading ? (
        <div className="flex justify-center py-10 text-muted-foreground gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Cargando historia…</div>
      ) : sorted.length === 0 ? (
        <Card><CardContent className="py-10 text-center space-y-2">
          <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-medium">Sin episodios de atención</p>
          <p className="text-sm text-muted-foreground">
            Abre un episodio con el motivo de consulta y registra la valoración inicial.
          </p>
        </CardContent></Card>
      ) : (
        sorted.map((ep) => (
          <EpisodeCard key={ep.id} episode={ep} notes={notesByEpisode.get(ep.id) ?? []}
            diagnoses={diagByEpisode.get(ep.id) ?? []} canWrite={canWrite}
            onInitial={() => setNoteDialog({ kind: 'initial', episode: ep })}
            onEvolution={() => setNoteDialog({ kind: 'evolution', episode: ep })}
            onAddendum={(note) => setNoteDialog({ kind: 'addendum', note })}
            onEditPlan={() => setEditPlan(ep)} onDischarge={() => setDischarge(ep)} onClose={() => setClosing(ep)} />
        ))
      )}

      <Dialog open={!!noteDialog} onOpenChange={(o) => { if (!o) setNoteDialog(null); }}>
        <DialogContent className="max-w-3xl max-h-[94dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {noteDialog?.kind === 'initial' ? 'Valoración inicial' : noteDialog?.kind === 'evolution' ? 'Nota de evolución' : 'Nota aclaratoria'}
            </DialogTitle>
            <DialogDescription>
              {noteDialog?.kind === 'addendum' ? 'Corrige o complementa una nota firmada sin alterarla.'
                : `${patient.full_name} · ${noteDialog && 'episode' in noteDialog ? noteDialog.episode.reason : ''}`}
            </DialogDescription>
          </DialogHeader>
          {noteDialog?.kind === 'initial' && (
            <InitialAssessmentForm patient={patient} episode={noteDialog.episode} appointmentId={noteDialog.appointmentId}
              onDone={() => setNoteDialog(null)} onCancel={() => setNoteDialog(null)} />
          )}
          {noteDialog?.kind === 'evolution' && (
            <EvolutionForm patient={patient} episode={noteDialog.episode} defaultAppointmentId={noteDialog.appointmentId}
              onDone={() => setNoteDialog(null)} onCancel={() => setNoteDialog(null)} />
          )}
          {noteDialog?.kind === 'addendum' && (
            <AddendumForm note={noteDialog.note} onDone={() => setNoteDialog(null)} onCancel={() => setNoteDialog(null)} />
          )}
        </DialogContent>
      </Dialog>

      <OpenEpisodeDialog open={!!openEpisode} onOpenChange={(o) => { if (!o) setOpenEpisode(null); }} patient={patient}
        notice={openEpisode?.notice}
        onCreated={(ep) => {
          const then = openEpisode?.then;
          if (then) setNoteDialog({ kind: 'initial', episode: ep, appointmentId: then.appointmentId });
        }} />
      <EditPlanDialog episode={editPlan} onClose={() => setEditPlan(null)} />
      <DischargeDialog episode={discharge} onClose={() => setDischarge(null)} />
      <CloseEpisodeDialog episode={closing} onClose={() => setClosing(null)} />
    </div>
  );
}

function EpisodeCard({ episode, notes, diagnoses, canWrite, onInitial, onEvolution, onAddendum, onEditPlan, onDischarge, onClose }: {
  episode: ClinicalEpisode; notes: ClinicalNote[]; diagnoses: ClinicalDiagnosis[]; canWrite: boolean;
  onInitial: () => void; onEvolution: () => void; onAddendum: (n: ClinicalNote) => void;
  onEditPlan: () => void; onDischarge: () => void; onClose: () => void;
}) {
  const isOpen = episode.status === 'abierto';
  const [expanded, setExpanded] = useState(isOpen);
  const main = notes.filter((n) => !n.addendum_of);
  const addendaOf = (id: string) => notes.filter((n) => n.addendum_of === id);
  const done = notes.filter(isSessionNote).length;
  const hasInitial = notes.some((n) => n.note_type === 'valoracion_inicial');
  const planned = episode.planned_sessions;

  return (
    <Card>
      <CardContent className="p-3 sm:p-4 space-y-3">
        <button type="button" className="w-full text-left flex items-start gap-3" onClick={() => setExpanded((v) => !v)}>
          <Stethoscope className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={`text-[11px] ${STATUS_TONE[episode.status]}`}>{EPISODE_STATUS_LABEL[episode.status]}</Badge>
              <span className="text-xs text-muted-foreground">
                {SPECIALTY_LABEL[episode.specialty]} · desde {fmtDate(episode.opened_at)}
                {episode.closed_at ? ` hasta ${fmtDate(episode.closed_at)}` : ''}
              </span>
            </div>
            <p className="font-medium mt-1">{episode.reason}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {done} {done === 1 ? 'sesión' : 'sesiones'}{planned ? ` de ${planned} planeadas` : ''}
              {episode.frequency ? ` · ${episode.frequency}` : ''}
            </p>
            {planned ? <Progress value={Math.min(100, (done / planned) * 100)} className="h-1.5 mt-1.5 max-w-xs" /> : null}
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>

        {expanded && (
          <div className="space-y-4">
            {(episode.treatment_goals || (isOpen && canWrite)) && (
              <div className="rounded-md bg-muted/40 p-2.5 text-sm flex items-start gap-2">
                <div className="flex-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Objetivos</span>
                  <p className="whitespace-pre-line">{episode.treatment_goals || 'Sin objetivos registrados.'}</p>
                </div>
                {isOpen && canWrite && (
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onEditPlan}>
                    <Pencil className="h-3 w-3" /> Editar plan
                  </Button>
                )}
              </div>
            )}

            {episode.discharge_summary && (
              <div className="rounded-md border border-emerald-200 dark:border-emerald-900 p-2.5 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {episode.status === 'alta' ? 'Resumen de alta' : 'Motivo del cierre'}
                </span>
                <p className="whitespace-pre-line">{episode.discharge_summary}</p>
              </div>
            )}

            <EpisodeDiagnoses episode={episode} diagnoses={diagnoses} canWrite={canWrite} />

            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notas</h4>
              {main.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin notas firmadas en este episodio.</p>
              ) : (
                main.map((n) => (
                  <NoteCard key={n.id} note={n} addenda={addendaOf(n.id)} onAddendum={canWrite ? onAddendum : undefined} />
                ))
              )}
            </div>

            {isOpen && canWrite && (
              <div className="flex flex-col sm:flex-row flex-wrap gap-2 pt-1">
                {!hasInitial && (
                  <Button onClick={onInitial} className="gap-2"><ClipboardList className="h-4 w-4" /> Valoración inicial</Button>
                )}
                <Button onClick={onEvolution} variant={hasInitial ? 'default' : 'outline'} className="gap-2">
                  <NotebookPen className="h-4 w-4" /> Evolución
                </Button>
                <Button onClick={onDischarge} variant="outline" className="gap-2"><LogOut className="h-4 w-4" /> Alta</Button>
                <Button onClick={onClose} variant="ghost" className="gap-2 text-muted-foreground"><DoorClosed className="h-4 w-4" /> Cerrar sin alta</Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ClinicalHistoryTab;
