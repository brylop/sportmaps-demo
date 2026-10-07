// Utilidades (no componentes) de los formularios de notas clínicas.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createNote } from '@/lib/clinical/api';
import { clinicalErrorMessage } from '@/lib/clinical/labels';
import type { ClinicalNote, ClinicalNoteInput } from '@/lib/clinical/types';

/** Invalida todo lo que cambia cuando se firma una nota. */
export function invalidateAfterNote(qc: ReturnType<typeof useQueryClient>, patientId: string, withAppointment: boolean) {
  if (withAppointment) {
    // La nota completa la cita enlazada: refresca agenda y citas, sean cuales sean sus llaves.
    qc.invalidateQueries({ queryKey: ['clinical'] });
    qc.invalidateQueries({ queryKey: ['agenda'] });
    return;
  }
  qc.invalidateQueries({ queryKey: ['clinical', 'notes', patientId] });
  qc.invalidateQueries({ queryKey: ['clinical', 'open-episodes'] });
  qc.invalidateQueries({ queryKey: ['clinical', 'episode-stats'] });
}

export function useSignNote(patientId: string, onDone: (n: ClinicalNote) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ClinicalNoteInput) => createNote(input),
    onSuccess: (n, input) => {
      toast.success('Nota firmada');
      invalidateAfterNote(qc, patientId, !!input.appointment_id);
      onDone(n);
    },
    onError: (e) => toast.error(clinicalErrorMessage(e)),
  });
}

export interface Soap { subjective: string; objective: string; assessment: string; plan: string }
export const EMPTY_SOAP: Soap = { subjective: '', objective: '', assessment: '', plan: '' };

export function soapHasContent(s: Soap) {
  return Object.values(s).some((v) => v.trim() !== '');
}

export function soapToInput(s: Soap) {
  const n = (v: string) => (v.trim() ? v.trim() : null);
  return { subjective: n(s.subjective), objective: n(s.objective), assessment: n(s.assessment), plan: n(s.plan) };
}

export type RowCol<T> = {
  key: keyof T & string;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: { value: string; label: string }[];
  span?: 1 | 2;
  placeholder?: string;
};

export const SIDE_OPTIONS = [
  { value: 'izquierdo', label: 'Izquierdo' },
  { value: 'derecho', label: 'Derecho' },
  { value: 'bilateral', label: 'Bilateral' },
  { value: 'na', label: 'No aplica' },
];

/** Fecha y hora de la atención (por defecto, ahora). */
export function nowLocalInput(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function occurredAtError(local: string): string | null {
  if (!local) return 'Indica la fecha y hora de la atención.';
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return 'Fecha de atención no válida.';
  if (d.getTime() > Date.now() + 5 * 60_000) return 'La fecha de la atención no puede ser futura.';
  return null;
}

