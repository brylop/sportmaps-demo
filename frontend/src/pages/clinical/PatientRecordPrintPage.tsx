import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NoteBody } from '@/components/clinical/NoteCard';
import {
  getMyVendorProfile, getPatient, listConsents, listDiagnoses, listEpisodes, listNotes, logClinicalAccess,
} from '@/lib/clinical/api';
import {
  ageFrom, clinicalErrorMessage, CONSENT_LABEL, EPISODE_STATUS_LABEL, NOTE_TYPE_LABEL, SPECIALTY_LABEL,
} from '@/lib/clinical/labels';
import type {
  ClinicalConsent, ClinicalDiagnosis, ClinicalEpisode, ClinicalNote, ClinicalPatient,
} from '@/lib/clinical/types';

const fmtDT = (iso: string) => format(parseISO(iso), "d 'de' MMMM yyyy, h:mm a", { locale: es });
const fmtD = (iso: string) => format(parseISO(iso.length === 10 ? iso + 'T00:00:00' : iso), "d 'de' MMMM yyyy", { locale: es });

const SEX_LABEL: Record<string, string> = { F: 'Femenino', M: 'Masculino', X: 'Otro' };
const REL_LABEL: Record<string, string> = {
  titular: 'titular', madre: 'madre', padre: 'padre', acudiente: 'acudiente', representante_legal: 'representante legal',
};

const PRINT_CSS = `
@media print {
  #root { display: none !important; }
  html, body { background: #fff !important; }
  .clinical-print-root { display: block !important; }
  .clinical-print-root, .clinical-print-root * {
    color: #000 !important; background: transparent !important; border-color: #888 !important; box-shadow: none !important;
  }
  .clinical-print-root section, .clinical-print-root article { break-inside: avoid-page; }
  @page { margin: 14mm; }
}`;

interface Professional {
  display_name: string; professional_license: string | null; rethus_number: string | null; professional_specialty: string | null;
}

interface RecordData {
  patient: ClinicalPatient; consents: ClinicalConsent[]; episodes: ClinicalEpisode[]; notes: ClinicalNote[];
  diagnoses: ClinicalDiagnosis[]; professional: Professional | null;
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="text-sm">
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium">{value && value.trim() ? value : '—'}</span>
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-bold border-b pb-1 mb-2 mt-6">{children}</h2>;
}

function SignatureLine({ note }: { note: ClinicalNote }) {
  return (
    <div className="mt-2 pt-1 border-t border-dashed text-xs">
      Firma: {note.author_name ?? '—'}{note.author_license ? ` · T.P. ${note.author_license}` : ''} · Firmada el {fmtDT(note.signed_at)}
    </div>
  );
}

function RecordDocument({ data }: { data: RecordData }) {
  const { patient: p, consents, episodes, notes, diagnoses, professional } = data;
  const age = ageFrom(p.birth_date);
  const chronological = [...episodes].sort((a, b) => a.opened_at.localeCompare(b.opened_at));
  const addendaOf = (id: string) => notes.filter((n) => n.addendum_of === id);

  return (
    <div className="bg-card text-card-foreground rounded-lg border p-5 sm:p-8 space-y-1 max-w-3xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:justify-between gap-2 border-b-2 border-foreground pb-3">
        <div>
          <h1 className="text-xl font-bold">Historia clínica</h1>
          <p className="text-xs text-muted-foreground">Copia generada el {fmtDT(new Date().toISOString())}</p>
        </div>
        <div className="text-sm sm:text-right">
          <p className="font-semibold">{professional?.display_name ?? 'Profesional'}</p>
          {professional?.professional_specialty && <p>{professional.professional_specialty}</p>}
          {professional?.professional_license && <p>T.P. {professional.professional_license}</p>}
          {professional?.rethus_number && <p>ReTHUS {professional.rethus_number}</p>}
        </div>
      </header>

      <section>
        <H2>Identificación del paciente</H2>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-0.5">
          <Field label="Nombre" value={p.full_name} />
          <Field label="Documento" value={[p.document_type, p.document_number].filter(Boolean).join(' ')} />
          <Field label="Fecha de nacimiento" value={p.birth_date ? `${fmtD(p.birth_date)}${age !== null ? ` (${age} años)` : ''}` : null} />
          <Field label="Sexo" value={p.sex ? SEX_LABEL[p.sex] : null} />
          <Field label="EPS" value={p.eps_name} />
          <Field label="Grupo sanguíneo" value={p.blood_type} />
          <Field label="Teléfono" value={p.phone} />
          <Field label="Correo" value={p.email} />
          <Field label="Ocupación" value={p.occupation} />
          <Field label="Deporte" value={p.sport} />
          <Field label="Acudiente" value={p.guardian_name ? [p.guardian_name, p.guardian_relationship && `(${p.guardian_relationship})`,
            p.guardian_document && `doc. ${p.guardian_document}`, p.guardian_phone].filter(Boolean).join(' ') : null} />
          <Field label="Contacto de emergencia" value={[p.emergency_contact_name, p.emergency_contact_phone].filter(Boolean).join(' · ')} />
        </div>
        <div className="mt-2 space-y-0.5">
          <Field label="Alergias" value={p.allergies} />
          <Field label="Antecedentes" value={p.medical_background} />
          <Field label="Medicamentos" value={p.medications} />
        </div>
      </section>

      <section>
        <H2>Consentimientos</H2>
        {consents.length === 0 ? <p className="text-sm">Sin consentimientos registrados.</p> : (
          <ul className="text-sm space-y-1">
            {consents.map((c) => (
              <li key={c.id}>
                <b>{CONSENT_LABEL[c.consent_type]}</b> (v{c.version}) — otorgado el {fmtDT(c.granted_at)} por {c.granted_by_name}
                {' '}({REL_LABEL[c.relationship] ?? c.relationship}, {c.channel === 'app' ? 'en la app' : 'firma presencial'})
                {c.revoked_at ? ` — REVOCADO el ${fmtDT(c.revoked_at)}${c.revoked_reason ? `: ${c.revoked_reason}` : ''}` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>

      {chronological.length === 0 ? (
        <section><H2>Episodios de atención</H2><p className="text-sm">Sin episodios registrados.</p></section>
      ) : chronological.map((ep, i) => {
        const epNotes = notes.filter((n) => n.episode_id === ep.id && !n.addendum_of);
        const epDiag = diagnoses.filter((d) => d.episode_id === ep.id);
        return (
          <div key={ep.id}>
            <H2>Episodio {i + 1}: {ep.reason}</H2>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-0.5">
              <Field label="Especialidad" value={SPECIALTY_LABEL[ep.specialty]} />
              <Field label="Estado" value={EPISODE_STATUS_LABEL[ep.status]} />
              <Field label="Apertura" value={fmtDT(ep.opened_at)} />
              <Field label="Cierre" value={ep.closed_at ? fmtDT(ep.closed_at) : null} />
              <Field label="Sesiones planeadas" value={ep.planned_sessions ? String(ep.planned_sessions) : null} />
              <Field label="Frecuencia" value={ep.frequency} />
            </div>
            <Field label="Objetivos" value={ep.treatment_goals} />
            <div className="mt-2">
              <p className="text-sm font-semibold">Diagnósticos (CIE-10)</p>
              {epDiag.length === 0 ? <p className="text-sm">—</p> : (
                <ul className="text-sm list-disc pl-5">
                  {epDiag.map((d) => (
                    <li key={d.id}>
                      {d.cie10_code} {d.description} — {d.kind === 'principal' ? 'principal' : 'relacionado'}, {d.status}
                      {d.status_changed_at ? ` (${fmtD(d.status_changed_at)})` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="mt-3 space-y-3">
              {epNotes.map((n) => (
                <article key={n.id} className="border rounded p-3">
                  <p className="text-sm font-semibold">{NOTE_TYPE_LABEL[n.note_type]} — {fmtDT(n.occurred_at)}</p>
                  <NoteBody note={n} />
                  <SignatureLine note={n} />
                  {addendaOf(n.id).map((a) => (
                    <div key={a.id} className="mt-2 ml-4 border-l-2 pl-3">
                      <p className="text-sm font-semibold">Nota aclaratoria — {fmtDT(a.occurred_at)}</p>
                      <NoteBody note={a} />
                      <SignatureLine note={a} />
                    </div>
                  ))}
                </article>
              ))}
            </div>
            {ep.discharge_summary && (
              <div className="mt-3 text-sm">
                <b>{ep.status === 'alta' ? 'Resumen de alta' : 'Motivo del cierre'}:</b>{' '}
                <span className="whitespace-pre-line">{ep.discharge_summary}</span>
              </div>
            )}
          </div>
        );
      })}

      <footer className="pt-10 text-sm">
        <div className="w-64 border-t border-foreground pt-1">
          {professional?.display_name ?? 'Profesional tratante'}
          {professional?.professional_license ? <><br />T.P. {professional.professional_license}</> : null}
        </div>
        <p className="text-[10px] text-muted-foreground mt-4">
          Documento con información confidencial sujeta a reserva (Res. 1995 de 1999, Ley 1581 de 2012).
        </p>
      </footer>
    </div>
  );
}

export default function PatientRecordPrintPage() {
  const { patientId = '' } = useParams<{ patientId: string }>();

  const q = useQuery({
    queryKey: ['clinical', 'record-print', patientId],
    enabled: !!patientId,
    queryFn: async (): Promise<RecordData> => {
      const [patient, consents, episodes, notes, diagnoses, professional] = await Promise.all([
        getPatient(patientId), listConsents(patientId), listEpisodes(patientId), listNotes(patientId),
        listDiagnoses(patientId), getMyVendorProfile(),
      ]);
      return { patient, consents, episodes, notes, diagnoses, professional };
    },
  });

  const portalTarget = useMemo(() => (typeof document !== 'undefined' ? document.body : null), []);

  const print = () => {
    logClinicalAccess(patientId, 'imprimir_historia').catch(() => undefined);
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <style>{PRINT_CSS}</style>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild className="gap-1 -ml-2">
          <Link to={`/pacientes/${patientId}`}><ArrowLeft className="h-4 w-4" /> Volver al paciente</Link>
        </Button>
        <Button onClick={print} disabled={!q.data} className="gap-2"><Printer className="h-4 w-4" /> Imprimir / Guardar PDF</Button>
      </div>

      {q.isLoading ? (
        <div className="flex justify-center py-16 text-muted-foreground gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Preparando la historia…</div>
      ) : q.isError || !q.data ? (
        <div className="text-center py-12 space-y-2">
          <p className="text-sm">{q.error ? clinicalErrorMessage(q.error) : 'No encontramos la historia.'}</p>
          <Button variant="outline" onClick={() => q.refetch()}>Reintentar</Button>
        </div>
      ) : (
        <>
          <RecordDocument data={q.data} />
          {portalTarget && createPortal(
            <div className="clinical-print-root hidden">
              <RecordDocument data={q.data} />
            </div>,
            portalTarget,
          )}
        </>
      )}
    </div>
  );
}
