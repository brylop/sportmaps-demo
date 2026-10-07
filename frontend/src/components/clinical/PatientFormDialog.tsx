import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, ShieldAlert } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COLOMBIAN_EPS } from '@/lib/colombian-eps';
import { createPatient, updatePatient } from '@/lib/clinical/api';
import { ageFrom, clinicalErrorMessage } from '@/lib/clinical/labels';
import type { BloodType, ClinicalPatient, ClinicalPatientInput, DocumentType } from '@/lib/clinical/types';

const DOC_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'CC', label: 'Cédula de ciudadanía' },
  { value: 'TI', label: 'Tarjeta de identidad' },
  { value: 'RC', label: 'Registro civil' },
  { value: 'CE', label: 'Cédula de extranjería' },
  { value: 'PA', label: 'Pasaporte' },
  { value: 'PPT', label: 'Permiso por protección temporal' },
  { value: 'NUIP', label: 'NUIP' },
  { value: 'OTRO', label: 'Otro' },
];
const BLOOD_TYPES: BloodType[] = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const NONE = '__none__';

type FormState = Record<
  'full_name' | 'document_type' | 'document_number' | 'birth_date' | 'sex' | 'phone' | 'email' | 'sport' |
  'occupation' | 'eps_name' | 'blood_type' | 'allergies' | 'medical_background' | 'medications' |
  'guardian_name' | 'guardian_relationship' | 'guardian_phone' | 'guardian_document' |
  'emergency_contact_name' | 'emergency_contact_phone' | 'notes', string>;

function toForm(p?: ClinicalPatient): FormState {
  const v = (x: string | null | undefined) => x ?? '';
  return {
    full_name: v(p?.full_name), document_type: v(p?.document_type), document_number: v(p?.document_number),
    birth_date: v(p?.birth_date), sex: v(p?.sex), phone: v(p?.phone), email: v(p?.email), sport: v(p?.sport),
    occupation: v(p?.occupation), eps_name: v(p?.eps_name), blood_type: v(p?.blood_type), allergies: v(p?.allergies),
    medical_background: v(p?.medical_background), medications: v(p?.medications), guardian_name: v(p?.guardian_name),
    guardian_relationship: v(p?.guardian_relationship), guardian_phone: v(p?.guardian_phone),
    guardian_document: v(p?.guardian_document), emergency_contact_name: v(p?.emergency_contact_name),
    emergency_contact_phone: v(p?.emergency_contact_phone), notes: v(p?.notes),
  };
}

function toInput(f: FormState): ClinicalPatientInput {
  const n = (x: string) => (x.trim() === '' ? null : x.trim());
  return {
    full_name: f.full_name.trim().replace(/\s+/g, ' '),
    document_type: n(f.document_type) as DocumentType | null,
    document_number: n(f.document_number),
    birth_date: n(f.birth_date),
    sex: n(f.sex) as ClinicalPatient['sex'],
    phone: n(f.phone),
    email: n(f.email)?.toLowerCase() ?? null,
    sport: n(f.sport),
    occupation: n(f.occupation),
    eps_name: n(f.eps_name),
    blood_type: n(f.blood_type) as BloodType | null,
    allergies: n(f.allergies),
    medical_background: n(f.medical_background),
    medications: n(f.medications),
    guardian_name: n(f.guardian_name),
    guardian_relationship: n(f.guardian_relationship),
    guardian_phone: n(f.guardian_phone),
    guardian_document: n(f.guardian_document),
    emergency_contact_name: n(f.emergency_contact_name),
    emergency_contact_phone: n(f.emergency_contact_phone),
    notes: n(f.notes),
  };
}

function validate(f: FormState): string | null {
  const name = f.full_name.trim();
  if (name.length < 2) return 'Escribe el nombre completo del paciente.';
  if (name.length > 160) return 'El nombre es demasiado largo.';
  if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return 'El correo no es válido.';
  if (f.birth_date) {
    const d = new Date(f.birth_date + 'T00:00:00');
    if (Number.isNaN(d.getTime()) || d > new Date()) return 'La fecha de nacimiento no puede ser futura.';
    if (ageFrom(f.birth_date) === null) return 'Revisa la fecha de nacimiento.';
  }
  for (const [k, label] of [['phone', 'teléfono'], ['guardian_phone', 'teléfono del acudiente'],
    ['emergency_contact_phone', 'teléfono de emergencia']] as const) {
    const v = f[k].trim();
    if (v && !/^[+\d][\d\s()-]{6,19}$/.test(v)) return `Revisa el ${label}.`;
  }
  if (f.document_number.trim() && !f.document_type) return 'Elige el tipo de documento.';
  return null;
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

function Section({ title, hint, children, highlight }: {
  title: string; hint?: string; children: React.ReactNode; highlight?: boolean;
}) {
  return (
    <section className={`rounded-lg border p-3 sm:p-4 space-y-3 ${highlight ? 'border-amber-300 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/20' : ''}`}>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </section>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient?: ClinicalPatient;
  onSaved?: (p: ClinicalPatient) => void;
}

export function PatientFormDialog({ open, onOpenChange, patient, onSaved }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(() => toForm(patient));

  useEffect(() => { if (open) setForm(toForm(patient)); }, [open, patient]);

  const set = (k: keyof FormState) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const onInput = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k)(e.target.value);

  const age = useMemo(() => ageFrom(form.birth_date || null), [form.birth_date]);
  const isMinor = age !== null && age < 18;

  const save = useMutation({
    mutationFn: async () => {
      const input = toInput(form);
      return patient ? updatePatient(patient.id, input) : createPatient(input);
    },
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['clinical', 'patients'] });
      qc.setQueryData(['clinical', 'patient', p.id], p);
      toast.success(patient ? 'Datos del paciente actualizados' : 'Paciente creado');
      onOpenChange(false);
      onSaved?.(p);
    },
    onError: (e) => toast.error(clinicalErrorMessage(e)),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate(form);
    if (err) { toast.error(err); return; }
    if (isMinor && !form.guardian_name.trim()) {
      toast.error('El paciente es menor de edad: escribe el nombre del acudiente.');
      return;
    }
    save.mutate();
  };

  const guardian = (
    <Section
      title="Acudiente / representante legal"
      hint={isMinor ? 'Es menor de edad: el acudiente firma los consentimientos.' : 'Solo si el paciente es menor o tiene representante.'}
      highlight={isMinor}
    >
      <Field label={isMinor ? 'Nombre del acudiente *' : 'Nombre del acudiente'}>
        <Input value={form.guardian_name} onChange={onInput('guardian_name')} maxLength={160} />
      </Field>
      <Field label="Parentesco">
        <Input value={form.guardian_relationship} onChange={onInput('guardian_relationship')} placeholder="Madre, padre, tío…" maxLength={60} />
      </Field>
      <Field label="Teléfono del acudiente">
        <Input value={form.guardian_phone} onChange={onInput('guardian_phone')} inputMode="tel" maxLength={20} />
      </Field>
      <Field label="Documento del acudiente">
        <Input value={form.guardian_document} onChange={onInput('guardian_document')} maxLength={30} />
      </Field>
    </Section>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!save.isPending) onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{patient ? 'Editar datos del paciente' : 'Nuevo paciente'}</DialogTitle>
          <DialogDescription>
            Identificación del paciente para la historia clínica. Solo tú ves estos datos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <Section title="Identificación">
            <Field label="Nombre completo *" className="sm:col-span-2">
              <Input value={form.full_name} onChange={onInput('full_name')} maxLength={160} autoFocus required />
            </Field>
            <Field label="Tipo de documento">
              <Select value={form.document_type || NONE} onValueChange={(v) => set('document_type')(v === NONE ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Elige" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sin especificar</SelectItem>
                  {DOC_TYPES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Número de documento">
              <Input value={form.document_number} onChange={onInput('document_number')} maxLength={30} />
            </Field>
            <Field label={age !== null ? `Fecha de nacimiento (${age} años)` : 'Fecha de nacimiento'}>
              <Input type="date" value={form.birth_date} onChange={onInput('birth_date')}
                max={new Date().toISOString().slice(0, 10)} />
            </Field>
            <Field label="Sexo">
              <Select value={form.sex || NONE} onValueChange={(v) => set('sex')(v === NONE ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Elige" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sin especificar</SelectItem>
                  <SelectItem value="F">Femenino</SelectItem>
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="X">Otro / no binario</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Teléfono">
              <Input value={form.phone} onChange={onInput('phone')} inputMode="tel" maxLength={20} placeholder="300 123 4567" />
            </Field>
            <Field label="Correo">
              <Input type="email" value={form.email} onChange={onInput('email')} maxLength={160} />
            </Field>
            <Field label="Deporte">
              <Input value={form.sport} onChange={onInput('sport')} maxLength={80} placeholder="Fútbol, natación…" />
            </Field>
            <Field label="Ocupación">
              <Input value={form.occupation} onChange={onInput('occupation')} maxLength={80} />
            </Field>
          </Section>

          {isMinor && guardian}

          <Section title="Salud">
            <Field label="EPS">
              <Input value={form.eps_name} onChange={onInput('eps_name')} list="clinical-eps-list" maxLength={120} placeholder="Escribe o elige" />
              <datalist id="clinical-eps-list">
                {COLOMBIAN_EPS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </datalist>
            </Field>
            <Field label="Grupo sanguíneo (RH)">
              <Select value={form.blood_type || NONE} onValueChange={(v) => set('blood_type')(v === NONE ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Elige" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sin especificar</SelectItem>
                  {BLOOD_TYPES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Alergias" className="sm:col-span-2">
              <Textarea rows={2} value={form.allergies} onChange={onInput('allergies')} placeholder="Medicamentos, alimentos, látex… (vacío si no tiene)" />
            </Field>
            <Field label="Antecedentes" className="sm:col-span-2">
              <Textarea rows={2} value={form.medical_background} onChange={onInput('medical_background')} placeholder="Patológicos, quirúrgicos, traumáticos, familiares" />
            </Field>
            <Field label="Medicamentos actuales" className="sm:col-span-2">
              <Textarea rows={2} value={form.medications} onChange={onInput('medications')} />
            </Field>
          </Section>

          {!isMinor && guardian}

          <Section title="Contacto de emergencia">
            <Field label="Nombre">
              <Input value={form.emergency_contact_name} onChange={onInput('emergency_contact_name')} maxLength={160} />
            </Field>
            <Field label="Teléfono">
              <Input value={form.emergency_contact_phone} onChange={onInput('emergency_contact_phone')} inputMode="tel" maxLength={20} />
            </Field>
          </Section>

          <section className="space-y-1.5">
            <Label className="text-xs font-medium">Notas administrativas</Label>
            <Textarea rows={2} value={form.notes} onChange={onInput('notes')}
              placeholder="Cómo llegó, preferencias de horario… (no clínicas)" />
          </section>

          {!patient && (
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
              Después de crearlo, registra el consentimiento (firma presencial o invitación a la app) para poder abrir la historia.
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {patient ? 'Guardar cambios' : 'Crear paciente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default PatientFormDialog;
