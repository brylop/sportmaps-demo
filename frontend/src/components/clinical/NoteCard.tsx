import type { ReactNode } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarCheck, FilePlus2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BODY_REGION_LABEL, NOTE_TYPE_LABEL } from '@/lib/clinical/labels';
import type { BodyRegion, ClinicalNote, NoteType, PhysioAssessmentData } from '@/lib/clinical/types';

const TYPE_TONE: Record<NoteType, string> = {
  valoracion_inicial: 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900',
  evolucion: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900',
  alta: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  nota_aclaratoria: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  otro: 'bg-muted text-foreground',
};

const SIDE_LABEL: Record<string, string> = { izquierdo: 'Izq.', derecho: 'Der.', bilateral: 'Bilateral', na: '—' };
const RESULT_LABEL: Record<string, string> = { positivo: 'Positivo', negativo: 'Negativo', no_concluyente: 'No concluyente' };

const fmtDateTime = (iso: string) => format(parseISO(iso), "d 'de' MMM yyyy, h:mm a", { locale: es });

function painTone(v: number) {
  return v <= 3 ? 'border-emerald-300 text-emerald-700 dark:text-emerald-400'
    : v <= 6 ? 'border-amber-300 text-amber-700 dark:text-amber-400' : 'border-rose-300 text-rose-700 dark:text-rose-400';
}

export function Signature({ note }: { note: ClinicalNote }) {
  return (
    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
      <Lock className="h-3 w-3" />
      Firmada por {note.author_name ?? 'el profesional'}
      {note.author_license ? ` · T.P. ${note.author_license}` : ''} · {fmtDateTime(note.signed_at)}
    </p>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value || !value.trim()) return null;
  return (
    <div className="text-sm">
      <span className="font-medium">{label}: </span>
      <span className="whitespace-pre-line text-foreground/90">{value}</span>
    </div>
  );
}

function MiniTable({ title, head, rows }: { title: string; head: string[]; rows: ReactNode[][] }) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground">{title}</p>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>{head.map((h) => <th key={h} className="text-left font-medium px-2 py-1">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t">{r.map((c, j) => <td key={j} className="px-2 py-1">{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const deg = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v}°`);

/** Contenido estructurado de la nota (valoración, técnicas…). Reutilizado en la impresión. */
export function NoteBody({ note }: { note: ClinicalNote }) {
  const d: PhysioAssessmentData = note.data ?? {};
  return (
    <div className="space-y-2">
      {(note.pain_before !== null || note.pain_after !== null) && (
        <div className="flex flex-wrap gap-1.5">
          {note.pain_before !== null && (
            <Badge variant="outline" className={`text-[11px] ${painTone(note.pain_before)}`}>
              EVA {note.note_type === 'evolucion' ? 'antes' : ''} {note.pain_before}/10
            </Badge>
          )}
          {note.pain_after !== null && (
            <Badge variant="outline" className={`text-[11px] ${painTone(note.pain_after)}`}>
              EVA {note.note_type === 'alta' ? 'al alta' : 'después'} {note.pain_after}/10
            </Badge>
          )}
        </div>
      )}
      <Row label="Anamnesis" value={d.anamnesis} />
      <Row label="Mecanismo de lesión" value={d.mechanism} />
      <Row label="Inicio" value={d.onset_date ? format(parseISO(d.onset_date), "d 'de' MMM yyyy", { locale: es }) : null} />
      <Row label="Localización del dolor" value={d.pain_location} />
      <Row label="Carácter" value={d.pain_character} />
      <Row label="Lo agrava" value={d.aggravating} />
      <Row label="Lo alivia" value={d.relieving} />
      <MiniTable title="Mapa corporal" head={['Región', 'Lado', 'EVA']}
        rows={(d.body_map ?? []).map((r) => [BODY_REGION_LABEL[r.region as BodyRegion] ?? r.region, SIDE_LABEL[r.side ?? 'na'] ?? r.side, `${r.intensity}/10`])} />
      <MiniTable title="Goniometría" head={['Articulación', 'Movimiento', 'Lado', 'Activo', 'Pasivo', 'Normal']}
        rows={(d.rom ?? []).map((r) => [r.joint, r.movement, SIDE_LABEL[r.side ?? ''] ?? r.side ?? '—', deg(r.active), deg(r.passive), deg(r.normal)])} />
      <MiniTable title="Fuerza muscular (Daniels)" head={['Músculo', 'Lado', 'Grado']}
        rows={(d.strength ?? []).map((r) => [r.muscle, SIDE_LABEL[r.side ?? ''] ?? r.side ?? '—', `${r.grade}/5`])} />
      <MiniTable title="Pruebas especiales" head={['Prueba', 'Lado', 'Resultado']}
        rows={(d.special_tests ?? []).map((r) => [r.name, SIDE_LABEL[r.side ?? ''] ?? r.side ?? '—', RESULT_LABEL[r.result] ?? r.result])} />
      <MiniTable title="Pruebas funcionales" head={['Prueba', 'Resultado']}
        rows={(d.functional_tests ?? []).map((r) => [r.name, r.result])} />
      <Row label="Postura" value={d.posture} />
      <Row label="Marcha" value={d.gait} />
      {note.note_type === 'nota_aclaratoria' ? (
        <>
          <Row label="Motivo" value={note.addendum_reason} />
          {[note.subjective, note.objective, note.assessment, note.plan].filter(Boolean).map((t, i) => (
            <p key={i} className="text-sm whitespace-pre-line">{t}</p>
          ))}
        </>
      ) : (
        <>
          <Row label={note.note_type === 'alta' ? 'Evolución' : 'S'} value={note.subjective} />
          <Row label={note.note_type === 'alta' ? 'Objetivos alcanzados' : 'O'} value={note.objective} />
          <Row label={note.note_type === 'alta' ? 'Resumen de alta' : 'A'} value={note.assessment} />
          <Row label={note.note_type === 'alta' ? 'Recomendaciones' : 'P'} value={note.plan} />
        </>
      )}
      {d.techniques && d.techniques.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-xs font-medium mr-1">Técnicas:</span>
          {d.techniques.map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
        </div>
      )}
      <Row label="Indicaciones para la casa" value={d.home_plan} />
    </div>
  );
}

interface Props {
  note: ClinicalNote;
  addenda: ClinicalNote[];
  onAddendum?: (note: ClinicalNote) => void;
}

export function NoteCard({ note, addenda, onAddendum }: Props) {
  return (
    <article className="rounded-lg border bg-card p-3 space-y-2">
      <header className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={`text-[11px] ${TYPE_TONE[note.note_type]}`}>{NOTE_TYPE_LABEL[note.note_type]}</Badge>
        <span className="text-xs text-muted-foreground">{fmtDateTime(note.occurred_at)}</span>
        {note.appointment_id && (
          <span className="text-[11px] text-muted-foreground flex items-center gap-1"><CalendarCheck className="h-3 w-3" /> Con cita</span>
        )}
      </header>
      <NoteBody note={note} />
      <Signature note={note} />

      {addenda.length > 0 && (
        <div className="ml-2 sm:ml-4 border-l-2 border-amber-300 dark:border-amber-800 pl-3 space-y-2">
          {addenda.map((a) => (
            <div key={a.id} className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-[10px] ${TYPE_TONE.nota_aclaratoria}`}>Nota aclaratoria</Badge>
                <span className="text-[11px] text-muted-foreground">{fmtDateTime(a.occurred_at)}</span>
              </div>
              <NoteBody note={a} />
              <Signature note={a} />
            </div>
          ))}
        </div>
      )}

      {onAddendum && (
        <Button variant="ghost" size="sm" className="gap-1 h-7 px-2 text-xs" onClick={() => onAddendum(note)}>
          <FilePlus2 className="h-3.5 w-3.5" /> Agregar nota aclaratoria
        </Button>
      )}
    </article>
  );
}

export default NoteCard;
