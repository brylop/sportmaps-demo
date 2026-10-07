// Formularios de notas clínicas. Todas se firman con createNote y son inmutables:
// la base pone autor, tarjeta profesional y hora de firma.
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { listPatientAppointments } from '@/lib/clinical/api';
import { BODY_REGION_LABEL, NOTE_TYPE_LABEL } from '@/lib/clinical/labels';
import {
  BODY_REGIONS, type ClinicalEpisode, type ClinicalNote, type ClinicalPatient, type PhysioAssessmentData,
} from '@/lib/clinical/types';
import { FormSection, OccurredAtField, PainScale, RowsEditor, SignButton, SoapFields, TextField } from './NoteFormParts';
import {
  EMPTY_SOAP, SIDE_OPTIONS, nowLocalInput, occurredAtError, soapHasContent, soapToInput, useSignNote, type RowCol, type Soap,
} from './note-utils';

type BodyMapRow = NonNullable<PhysioAssessmentData['body_map']>[number];
type RomRow = NonNullable<PhysioAssessmentData['rom']>[number];
type StrengthRow = NonNullable<PhysioAssessmentData['strength']>[number];
type SpecialRow = NonNullable<PhysioAssessmentData['special_tests']>[number];
type FunctionalRow = NonNullable<PhysioAssessmentData['functional_tests']>[number];

const INTENSITY_OPTIONS = Array.from({ length: 11 }, (_, i) => ({ value: String(i), label: String(i) }));
const GRADE_OPTIONS = Array.from({ length: 6 }, (_, i) => ({ value: String(i), label: `${i}/5` }));
const REGION_OPTIONS = BODY_REGIONS.map((r) => ({ value: r, label: BODY_REGION_LABEL[r] }));
const RESULT_OPTIONS = [
  { value: 'positivo', label: 'Positivo' },
  { value: 'negativo', label: 'Negativo' },
  { value: 'no_concluyente', label: 'No concluyente' },
];

// Filas en edición: los números de selects se guardan como texto y se convierten al firmar.
type BodyMapEdit = { region: string; side: string; intensity: string };
type StrengthEdit = { muscle: string; side: string; grade: string };

const BODY_COLS: RowCol<BodyMapEdit>[] = [
  { key: 'region', label: 'Región', type: 'select', options: REGION_OPTIONS, span: 2 },
  { key: 'side', label: 'Lado', type: 'select', options: SIDE_OPTIONS, span: 2 },
  { key: 'intensity', label: 'EVA', type: 'select', options: INTENSITY_OPTIONS, span: 2 },
];
const ROM_COLS: RowCol<RomRow>[] = [
  { key: 'joint', label: 'Articulación', type: 'text', placeholder: 'Rodilla' },
  { key: 'movement', label: 'Movimiento', type: 'text', placeholder: 'Flexión' },
  { key: 'side', label: 'Lado', type: 'select', options: SIDE_OPTIONS },
  { key: 'active', label: 'Activo °', type: 'number' },
  { key: 'passive', label: 'Pasivo °', type: 'number' },
  { key: 'normal', label: 'Normal °', type: 'number' },
];
const STRENGTH_COLS: RowCol<StrengthEdit>[] = [
  { key: 'muscle', label: 'Músculo / grupo', type: 'text', span: 2, placeholder: 'Cuádriceps' },
  { key: 'side', label: 'Lado', type: 'select', options: SIDE_OPTIONS, span: 2 },
  { key: 'grade', label: 'Grado (Daniels)', type: 'select', options: GRADE_OPTIONS, span: 2 },
];
const SPECIAL_COLS: RowCol<SpecialRow>[] = [
  { key: 'name', label: 'Prueba', type: 'text', span: 2, placeholder: 'Lachman' },
  { key: 'side', label: 'Lado', type: 'select', options: SIDE_OPTIONS, span: 2 },
  { key: 'result', label: 'Resultado', type: 'select', options: RESULT_OPTIONS, span: 2 },
];
const FUNCTIONAL_COLS: RowCol<FunctionalRow>[] = [
  { key: 'name', label: 'Prueba', type: 'text', span: 2, placeholder: 'Sentadilla unipodal' },
  { key: 'result', label: 'Resultado', type: 'text', span: 2, placeholder: 'Valgo dinámico, 8 rep.' },
];

const TECHNIQUES = [
  'Terapia manual', 'Ejercicio terapéutico', 'Electroterapia/TENS', 'Ultrasonido', 'Crioterapia', 'Termoterapia',
  'Vendaje neuromuscular', 'Punción seca', 'Masaje', 'Estiramientos', 'Propiocepción', 'Educación',
];

/** Quita strings vacíos, filas vacías y llaves sin valor. */
function cleanData(d: PhysioAssessmentData): PhysioAssessmentData {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) {
    if (typeof v === 'string') { if (v.trim()) out[k] = v.trim(); }
    else if (Array.isArray(v)) { if (v.length) out[k] = v; }
    else if (v !== undefined && v !== null) out[k] = v;
  }
  return out as PhysioAssessmentData;
}

interface BaseProps {
  patient: ClinicalPatient;
  episode: ClinicalEpisode;
  onDone: (note: ClinicalNote) => void;
  onCancel: () => void;
}

function FormFooter({ onCancel, children }: { onCancel: () => void; children: React.ReactNode }) {
  return (
    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t">
      <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
      {children}
    </div>
  );
}

// ── Valoración inicial ───────────────────────────────────────────────────────
export function InitialAssessmentForm({ patient, episode, onDone, onCancel, appointmentId }: BaseProps & { appointmentId?: string | null }) {
  const [occurredAt, setOccurredAt] = useState(nowLocalInput);
  const [text, setText] = useState({
    anamnesis: '', mechanism: '', onset_date: '', pain_location: '', pain_character: '', aggravating: '', relieving: '',
    posture: '', gait: '',
  });
  const [pain, setPain] = useState<number | null>(null);
  const [bodyMap, setBodyMap] = useState<BodyMapEdit[]>([]);
  const [rom, setRom] = useState<RomRow[]>([]);
  const [strength, setStrength] = useState<StrengthEdit[]>([]);
  const [special, setSpecial] = useState<SpecialRow[]>([]);
  const [functional, setFunctional] = useState<FunctionalRow[]>([]);
  const [soap, setSoap] = useState<Soap>(EMPTY_SOAP);
  const sign = useSignNote(patient.id, onDone);

  const setT = (k: keyof typeof text) => (v: string) => setText((t) => ({ ...t, [k]: v }));

  const build = (): PhysioAssessmentData => cleanData({
    ...text,
    body_map: bodyMap.filter((r) => r.region).map((r): BodyMapRow => ({
      region: r.region, side: (r.side || undefined) as BodyMapRow['side'], intensity: Number(r.intensity || 0),
    })),
    rom: rom.filter((r) => r.joint.trim() || r.movement.trim()),
    strength: strength.filter((r) => r.muscle.trim() && r.grade !== '').map((r): StrengthRow => ({
      muscle: r.muscle.trim(), side: r.side || undefined, grade: Number(r.grade),
    })),
    special_tests: special.filter((r) => r.name.trim()),
    functional_tests: functional.filter((r) => r.name.trim()),
  });

  const validate = () => {
    const err = occurredAtError(occurredAt);
    if (err) return err;
    if (special.some((r) => r.name.trim() && !r.result)) return 'Indica el resultado de cada prueba especial.';
    if (strength.some((r) => r.muscle.trim() && r.grade === '')) return 'Indica el grado de fuerza de cada músculo.';
    if (rom.some((r) => [r.active, r.passive, r.normal].some((v) => v !== null && v !== undefined && (v < -90 || v > 360))))
      return 'Revisa los grados de la goniometría.';
    const data = build();
    if (!soapHasContent(soap) && Object.keys(data).length === 0) return 'La valoración está vacía.';
    return null;
  };

  const submit = () => sign.mutate({
    patient_id: patient.id, episode_id: episode.id, note_type: 'valoracion_inicial',
    appointment_id: appointmentId ?? null, occurred_at: new Date(occurredAt).toISOString(),
    pain_before: pain, data: build(), ...soapToInput(soap),
  });

  return (
    <div className="space-y-4">
      <OccurredAtField value={occurredAt} onChange={setOccurredAt} />

      <FormSection title="Anamnesis">
        <TextField label="Historia de la condición actual" value={text.anamnesis} onChange={setT('anamnesis')} rows={3} />
        <div className="grid sm:grid-cols-2 gap-3">
          <TextField label="Mecanismo de lesión" value={text.mechanism} onChange={setT('mechanism')} rows={2}
            placeholder="Contacto, giro, sobreuso…" />
          <div className="space-y-1.5">
            <Label className="text-xs">Inicio de los síntomas</Label>
            <Input type="date" value={text.onset_date} max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setT('onset_date')(e.target.value)} />
          </div>
        </div>
      </FormSection>

      <FormSection title="Dolor">
        <PainScale label="EVA actual (0-10)" value={pain} onChange={setPain} />
        <div className="grid sm:grid-cols-2 gap-3">
          <TextField label="Localización" value={text.pain_location} onChange={setT('pain_location')} rows={1} />
          <TextField label="Carácter" value={text.pain_character} onChange={setT('pain_character')} rows={1}
            placeholder="Punzante, quemante, sordo…" />
          <TextField label="Lo agrava" value={text.aggravating} onChange={setT('aggravating')} rows={1} />
          <TextField label="Lo alivia" value={text.relieving} onChange={setT('relieving')} rows={1} />
        </div>
      </FormSection>

      <RowsEditor title="Mapa corporal del dolor" rows={bodyMap} onChange={setBodyMap} cols={BODY_COLS}
        empty={() => ({ region: '', side: '', intensity: '' })} addLabel="Agregar región" />
      <RowsEditor title="Goniometría (arcos de movimiento)" rows={rom} onChange={setRom} cols={ROM_COLS}
        empty={() => ({ joint: '', movement: '', side: '', active: null, passive: null, normal: null })} addLabel="Agregar medición" />
      <RowsEditor title="Fuerza muscular (Daniels 0-5)" rows={strength} onChange={setStrength} cols={STRENGTH_COLS}
        empty={() => ({ muscle: '', side: '', grade: '' })} addLabel="Agregar músculo" />
      <RowsEditor title="Pruebas especiales" rows={special} onChange={setSpecial} cols={SPECIAL_COLS}
        empty={() => ({ name: '', side: '', result: '' as SpecialRow['result'] })} addLabel="Agregar prueba" />
      <RowsEditor title="Pruebas funcionales" rows={functional} onChange={setFunctional} cols={FUNCTIONAL_COLS}
        empty={() => ({ name: '', result: '' })} addLabel="Agregar prueba" />

      <FormSection title="Postura y marcha">
        <div className="grid sm:grid-cols-2 gap-3">
          <TextField label="Postura" value={text.posture} onChange={setT('posture')} />
          <TextField label="Marcha" value={text.gait} onChange={setT('gait')} />
        </div>
      </FormSection>

      <FormSection title="Nota SOAP">
        <SoapFields value={soap} onChange={setSoap} />
      </FormSection>

      <FormFooter onCancel={onCancel}>
        <SignButton validate={validate} onConfirm={submit} pending={sign.isPending} label="Firmar valoración" />
      </FormFooter>
    </div>
  );
}

// ── Evolución ────────────────────────────────────────────────────────────────
export function EvolutionForm({ patient, episode, onDone, onCancel, defaultAppointmentId }: BaseProps & {
  defaultAppointmentId?: string | null;
}) {
  const [occurredAt, setOccurredAt] = useState(nowLocalInput);
  const [soap, setSoap] = useState<Soap>(EMPTY_SOAP);
  const [painBefore, setPainBefore] = useState<number | null>(null);
  const [painAfter, setPainAfter] = useState<number | null>(null);
  const [techniques, setTechniques] = useState<string[]>([]);
  const [custom, setCustom] = useState('');
  const [homePlan, setHomePlan] = useState('');
  const [appointmentId, setAppointmentId] = useState<string>(defaultAppointmentId ?? '');
  const sign = useSignNote(patient.id, onDone);

  const apptsQ = useQuery({
    queryKey: ['clinical', 'appointments', patient.id],
    queryFn: () => listPatientAppointments(patient.id),
  });
  const openAppts = useMemo(
    () => (apptsQ.data ?? []).filter((a) => a.status === 'pending' || a.status === 'confirmed' || a.id === defaultAppointmentId),
    [apptsQ.data, defaultAppointmentId],
  );

  const toggle = (t: string) => setTechniques((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));
  const addCustom = () => {
    const t = custom.trim();
    if (t && !techniques.includes(t)) setTechniques((s) => [...s, t]);
    setCustom('');
  };

  const data = (): PhysioAssessmentData => cleanData({ techniques, home_plan: homePlan });

  const validate = () => {
    const err = occurredAtError(occurredAt);
    if (err) return err;
    if (!soapHasContent(soap) && Object.keys(data()).length === 0) return 'Escribe al menos un campo de la nota.';
    return null;
  };

  const submit = () => sign.mutate({
    patient_id: patient.id, episode_id: episode.id, note_type: 'evolucion',
    appointment_id: appointmentId || null, occurred_at: new Date(occurredAt).toISOString(),
    pain_before: painBefore, pain_after: painAfter, data: data(), ...soapToInput(soap),
  });

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <OccurredAtField value={occurredAt} onChange={setOccurredAt} />
        <div className="space-y-1.5">
          <Label className="text-xs">Cita de esta sesión (opcional)</Label>
          <Select value={appointmentId || '__none__'} onValueChange={(v) => setAppointmentId(v === '__none__' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder={apptsQ.isLoading ? 'Cargando…' : 'Sin cita'} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sin cita enlazada</SelectItem>
              {openAppts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {format(parseISO(a.appointment_date), "EEE d MMM", { locale: es })} · {a.appointment_time.slice(0, 5)} · {a.service_type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {appointmentId && <p className="text-[11px] text-muted-foreground">Al firmar, la cita queda como realizada.</p>}
        </div>
      </div>

      <FormSection title="Dolor (EVA)">
        <div className="grid sm:grid-cols-2 gap-4">
          <PainScale label="Antes de la sesión" value={painBefore} onChange={setPainBefore} />
          <PainScale label="Después de la sesión" value={painAfter} onChange={setPainAfter} />
        </div>
      </FormSection>

      <FormSection title="Nota SOAP">
        <SoapFields value={soap} onChange={setSoap} />
      </FormSection>

      <FormSection title="Técnicas aplicadas">
        <div className="flex flex-wrap gap-1.5">
          {[...TECHNIQUES, ...techniques.filter((t) => !TECHNIQUES.includes(t))].map((t) => {
            const on = techniques.includes(t);
            return (
              <button key={t} type="button" onClick={() => toggle(t)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}>
                {t}{on && !TECHNIQUES.includes(t) && <X className="inline h-3 w-3 ml-1" />}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Otra técnica" className="h-8 text-sm"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }} />
          <Button type="button" variant="outline" size="sm" onClick={addCustom} disabled={!custom.trim()} className="gap-1">
            <Plus className="h-3.5 w-3.5" /> Agregar
          </Button>
        </div>
        <TextField label="Indicaciones para la casa" value={homePlan} onChange={setHomePlan} />
      </FormSection>

      <FormFooter onCancel={onCancel}>
        <SignButton validate={validate} onConfirm={submit} pending={sign.isPending} label="Firmar evolución" />
      </FormFooter>
    </div>
  );
}

// ── Nota aclaratoria ─────────────────────────────────────────────────────────
export function AddendumForm({ note, onDone, onCancel }: {
  note: ClinicalNote; onDone: (n: ClinicalNote) => void; onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const [body, setBody] = useState('');
  const sign = useSignNote(note.patient_id, onDone);

  const validate = () => {
    if (reason.trim().length < 5) return 'Escribe el motivo de la aclaración (mínimo 5 caracteres).';
    if (body.trim().length < 3) return 'Escribe el texto de la aclaración.';
    return null;
  };

  const submit = () => sign.mutate({
    patient_id: note.patient_id, episode_id: note.episode_id, note_type: 'nota_aclaratoria',
    addendum_of: note.id, addendum_reason: reason.trim(), subjective: body.trim(),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1">
        <p className="font-medium">Aclara la nota:</p>
        <p>
          <Badge variant="outline" className="text-[10px] mr-1">{NOTE_TYPE_LABEL[note.note_type]}</Badge>
          {format(parseISO(note.occurred_at), "d 'de' MMM yyyy, h:mm a", { locale: es })}
          {note.author_name ? ` · ${note.author_name}` : ''}
        </p>
        <p className="text-muted-foreground">La nota original no cambia: esta aclaración queda firmada debajo de ella.</p>
      </div>
      <TextField label="Motivo de la aclaración *" value={reason} onChange={setReason} rows={1}
        placeholder="Ej.: error de lateralidad, dato omitido" />
      <TextField label="Aclaración *" value={body} onChange={setBody} rows={4} />
      <FormFooter onCancel={onCancel}>
        <SignButton validate={validate} onConfirm={submit} pending={sign.isPending} label="Firmar aclaración" />
      </FormFooter>
    </div>
  );
}
