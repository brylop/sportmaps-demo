import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle, ArrowLeft, Droplet, HeartPulse, Link2, Loader2, Lock, Pencil, Phone, Printer, ShieldAlert, UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PatientFormDialog } from '@/components/clinical/PatientFormDialog';
import { ConsentPanel } from '@/components/clinical/ConsentPanel';
import { ClinicalHistoryTab } from '@/components/clinical/ClinicalHistoryTab';
import { AttachmentsTab } from '@/components/clinical/AttachmentsTab';
import { InjuriesTab } from '@/components/clinical/InjuriesTab';
import { ExercisesTab } from '@/components/clinical/ExercisesTab';
import { PatientAppointmentsTab } from '@/components/clinical/PatientAppointmentsTab';
import { getPatient, listConsents, listEpisodes, logClinicalAccess, updatePatient } from '@/lib/clinical/api';
import { ageFrom, clinicalErrorMessage } from '@/lib/clinical/labels';
import { activeConsents, hasRequiredConsents } from '@/lib/clinical/record-extra';
import type { PatientStatus } from '@/lib/clinical/types';

const STATUS_LABEL: Record<PatientStatus, string> = { activo: 'Activo', alta: 'De alta', archivado: 'Archivado' };
type TabKey = 'historia' | 'lesiones' | 'ejercicios' | 'citas' | 'adjuntos' | 'consentimientos';

function LockedNotice({ onGo }: { onGo: () => void }) {
  return (
    <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-3 flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
      <Lock className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0" />
      <p className="flex-1 text-amber-900 dark:text-amber-200">
        Bloqueado hasta que el paciente (o su acudiente) autorice el tratamiento de datos de salud y el tratamiento.
      </p>
      <Button size="sm" variant="outline" onClick={onGo}>Ver consentimientos</Button>
    </div>
  );
}

export default function PatientDetailPage() {
  const { patientId = '' } = useParams<{ patientId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>('historia');

  const [evolutionRequest, setEvolutionRequest] = useState<{ appointmentId: string | null } | null>(() =>
    searchParams.get('nota') === 'evolucion' ? { appointmentId: searchParams.get('cita') } : null);

  const patientQ = useQuery({ queryKey: ['clinical', 'patient', patientId], queryFn: () => getPatient(patientId), enabled: !!patientId });
  const consentsQ = useQuery({ queryKey: ['clinical', 'consents', patientId], queryFn: () => listConsents(patientId), enabled: !!patientId });
  const episodesQ = useQuery({ queryKey: ['clinical', 'episodes', patientId], queryFn: () => listEpisodes(patientId), enabled: !!patientId });

  // Registro de acceso (Res. 1995/1999): una vez por paciente abierto.
  const logged = useRef<string | null>(null);
  useEffect(() => {
    if (!patientId || logged.current === patientId) return;
    logged.current = patientId;
    logClinicalAccess(patientId, 'ver_historia').catch(() => undefined);
  }, [patientId]);

  const active = useMemo(() => activeConsents(consentsQ.data ?? []), [consentsQ.data]);
  const canWrite = hasRequiredConsents(active.map((c) => c.consent_type));
  const episodes = useMemo(() => episodesQ.data ?? [], [episodesQ.data]);

  useEffect(() => { if (evolutionRequest) setTab('historia'); }, [evolutionRequest]);
  useEffect(() => {
    if (evolutionRequest && consentsQ.isSuccess && !canWrite) {
      toast.error('Falta el consentimiento del paciente para registrar la nota de esta cita.');
    }
  }, [evolutionRequest, consentsQ.isSuccess, canWrite]);

  const handledRequest = useCallback(() => {
    setEvolutionRequest(null);
    const next = new URLSearchParams(searchParams);
    next.delete('nota');
    next.delete('cita');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const setStatus = useMutation({
    mutationFn: (status: PatientStatus) => updatePatient(patientId, { status }),
    onSuccess: (p) => {
      qc.setQueryData(['clinical', 'patient', patientId], p);
      qc.invalidateQueries({ queryKey: ['clinical', 'patients'] });
      toast.success(`Paciente marcado como ${STATUS_LABEL[p.status].toLowerCase()}`);
    },
    onError: (e) => toast.error(clinicalErrorMessage(e)),
  });

  const refreshConsents = () => {
    qc.invalidateQueries({ queryKey: ['clinical', 'consents', patientId] });
  };

  if (patientQ.isLoading) {
    return <div className="flex justify-center py-20 text-muted-foreground gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Cargando paciente…</div>;
  }
  if (patientQ.isError || !patientQ.data) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-3">
        <p className="font-medium">No pudimos abrir este paciente.</p>
        <p className="text-sm text-muted-foreground">{patientQ.error ? clinicalErrorMessage(patientQ.error) : 'No está en tu lista.'}</p>
        <div className="flex justify-center gap-2">
          <Button variant="outline" asChild><Link to="/pacientes">Volver a pacientes</Link></Button>
          <Button onClick={() => patientQ.refetch()}>Reintentar</Button>
        </div>
      </div>
    );
  }

  const patient = patientQ.data;
  const age = ageFrom(patient.birth_date);
  const isMinor = age !== null && age < 18;
  const linked = !!(patient.profile_id || patient.child_id);
  const doc = [patient.document_type, patient.document_number].filter(Boolean).join(' ');
  // Esperar consentimientos Y episodios: si no, ?nota=evolucion ofrecería abrir
  // un episodio que ya existe, o se descartaría con canWrite aún en false.
  const historyReady = consentsQ.isSuccess && episodesQ.isSuccess;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" asChild className="gap-1 -ml-2">
        <Link to="/pacientes"><ArrowLeft className="h-4 w-4" /> Pacientes</Link>
      </Button>

      {/* Encabezado */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-start gap-3">
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold">{patient.full_name}</h1>
                {linked ? (
                  <Badge variant="outline" className="gap-1 text-[11px]"><Link2 className="h-3 w-3" /> Con cuenta en la app</Badge>
                ) : (
                  <Badge variant="outline" className="text-[11px] text-muted-foreground">Sin cuenta</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {[age !== null ? `${age} años` : null, doc || null, patient.sport].filter(Boolean).join(' · ') || 'Sin datos de identificación'}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
                {patient.eps_name && <span className="flex items-center gap-1"><HeartPulse className="h-3.5 w-3.5" /> {patient.eps_name}</span>}
                {patient.blood_type && <span className="flex items-center gap-1"><Droplet className="h-3.5 w-3.5" /> RH {patient.blood_type}</span>}
                {patient.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {patient.phone}</span>}
                {patient.guardian_name && (
                  <span className={`flex items-center gap-1 ${isMinor ? 'text-foreground font-medium' : ''}`}>
                    <UserRound className="h-3.5 w-3.5" /> Acudiente: {patient.guardian_name}
                    {patient.guardian_relationship ? ` (${patient.guardian_relationship})` : ''}
                    {patient.guardian_phone ? ` · ${patient.guardian_phone}` : ''}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Select value={patient.status} onValueChange={(v) => setStatus.mutate(v as PatientStatus)} disabled={setStatus.isPending}>
                <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABEL) as PatientStatus[]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="h-9 gap-1" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" /> Editar datos
              </Button>
              <Button variant="outline" size="sm" className="h-9 gap-1" asChild>
                <Link to={`/pacientes/${patient.id}/imprimir`}><Printer className="h-4 w-4" /> Imprimir historia</Link>
              </Button>
            </div>
          </div>

          {patient.allergies && (
            <div className="rounded-md border border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30 px-3 py-2 text-sm text-rose-800 dark:text-rose-300 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span><b>Alergias:</b> {patient.allergies}</span>
            </div>
          )}
          {isMinor && !patient.guardian_name && (
            <p className="text-xs text-amber-700 dark:text-amber-400">Es menor de edad y no tiene acudiente registrado. Edita sus datos.</p>
          )}
        </CardContent>
      </Card>

      {/* Consentimiento pendiente */}
      {consentsQ.isSuccess && !canWrite && (
        <Card className="border-amber-300 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-700 dark:text-amber-400 shrink-0" />
              <div>
                <p className="font-semibold">Falta el consentimiento</p>
                <p className="text-sm text-muted-foreground">
                  Por ley (Ley 1581 de 2012) necesitas la autorización de datos de salud y el consentimiento informado
                  {isMinor ? ' firmados por el acudiente' : ''} antes de abrir la historia, escribir notas o registrar lesiones.
                </p>
              </div>
            </div>
            <ConsentPanel patient={patient} variant="actions" onChange={refreshConsents} />
          </CardContent>
        </Card>
      )}
      {consentsQ.isError && (
        <p className="text-sm text-destructive">No pudimos verificar los consentimientos: {clinicalErrorMessage(consentsQ.error)}</p>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="w-max">
            <TabsTrigger value="historia">Historia</TabsTrigger>
            <TabsTrigger value="lesiones">Lesiones</TabsTrigger>
            <TabsTrigger value="ejercicios">Ejercicios</TabsTrigger>
            <TabsTrigger value="citas">Citas</TabsTrigger>
            <TabsTrigger value="adjuntos">Adjuntos</TabsTrigger>
            <TabsTrigger value="consentimientos" className="gap-1">
              Consentimientos{historyReady && !canWrite && <span className="h-2 w-2 rounded-full bg-amber-500" />}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="historia" className="space-y-3">
          {historyReady && !canWrite && <LockedNotice onGo={() => setTab('consentimientos')} />}
          {episodesQ.isLoading || consentsQ.isLoading ? (
            <div className="flex justify-center py-10 text-muted-foreground gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Cargando…</div>
          ) : episodesQ.isError ? (
            <div className="text-center py-6 text-sm space-y-2">
              <p>{clinicalErrorMessage(episodesQ.error)}</p>
              <Button size="sm" variant="outline" onClick={() => episodesQ.refetch()}>Reintentar</Button>
            </div>
          ) : canWrite || episodes.length > 0 ? (
            <ClinicalHistoryTab patient={patient} episodes={episodes} canWrite={canWrite}
              evolutionRequest={historyReady ? evolutionRequest : null} onEvolutionRequestHandled={handledRequest} />
          ) : null}
        </TabsContent>

        <TabsContent value="lesiones" className="space-y-3">
          {historyReady && !canWrite && <LockedNotice onGo={() => setTab('consentimientos')} />}
          <InjuriesTab patient={patient} episodes={episodes} canWrite={canWrite} />
        </TabsContent>

        <TabsContent value="ejercicios" className="space-y-3">
          {historyReady && !canWrite && <LockedNotice onGo={() => setTab('consentimientos')} />}
          <ExercisesTab patient={patient} episodes={episodes} canWrite={canWrite} />
        </TabsContent>

        <TabsContent value="citas">
          <PatientAppointmentsTab patient={patient} />
        </TabsContent>

        <TabsContent value="adjuntos">
          <AttachmentsTab patient={patient} episodes={episodes} />
        </TabsContent>

        <TabsContent value="consentimientos">
          <ConsentPanel patient={patient} onChange={refreshConsents} />
        </TabsContent>
      </Tabs>

      <PatientFormDialog open={editOpen} onOpenChange={setEditOpen} patient={patient} />
    </div>
  );
}
