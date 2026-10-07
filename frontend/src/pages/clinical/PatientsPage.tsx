import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronRight, ClipboardList, FileSignature, Link2, Loader2, Plus, Search, ShieldAlert, ShieldCheck, UserPlus, Users,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PatientFormDialog } from '@/components/clinical/PatientFormDialog';
import { listPatients } from '@/lib/clinical/api';
import { ageFrom, clinicalErrorMessage } from '@/lib/clinical/labels';
import { consentMap, hasRequiredConsents, listConsentSummary } from '@/lib/clinical/record-extra';
import type { PatientStatus } from '@/lib/clinical/types';

const STATUS_LABEL: Record<PatientStatus, string> = { activo: 'Activos', alta: 'De alta', archivado: 'Archivados' };

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

export default function PatientsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PatientStatus>('activo');
  const [createOpen, setCreateOpen] = useState(false);

  const patientsQ = useQuery({ queryKey: ['clinical', 'patients'], queryFn: listPatients });
  const consentsQ = useQuery({ queryKey: ['clinical', 'consent-summary'], queryFn: listConsentSummary });
  const consents = useMemo(() => consentMap(consentsQ.data ?? []), [consentsQ.data]);

  const counts = useMemo(() => {
    const c: Record<PatientStatus, number> = { activo: 0, alta: 0, archivado: 0 };
    (patientsQ.data ?? []).forEach((p) => { c[p.status] += 1; });
    return c;
  }, [patientsQ.data]);

  const filtered = useMemo(() => {
    const q = normalize(search.trim());
    return (patientsQ.data ?? []).filter((p) => p.status === status && (!q ||
      normalize(p.full_name).includes(q) || (p.document_number ?? '').toLowerCase().includes(q)));
  }, [patientsQ.data, search, status]);

  const total = patientsQ.data?.length ?? 0;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6 text-primary" /> Pacientes</h1>
          <p className="text-sm text-muted-foreground">Tus pacientes y su historia clínica. Solo tú tienes acceso.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo paciente
        </Button>
      </div>

      {patientsQ.isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Cargando pacientes…
        </div>
      ) : patientsQ.isError ? (
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <p className="text-sm">No pudimos cargar tus pacientes.</p>
            <p className="text-xs text-muted-foreground">{clinicalErrorMessage(patientsQ.error)}</p>
            <Button variant="outline" onClick={() => patientsQ.refetch()}>Reintentar</Button>
          </CardContent>
        </Card>
      ) : total === 0 ? (
        <EmptyState onCreate={() => setCreateOpen(true)} />
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9"
                placeholder="Buscar por nombre o documento" />
            </div>
            <Tabs value={status} onValueChange={(v) => setStatus(v as PatientStatus)}>
              <TabsList className="w-full sm:w-auto">
                {(Object.keys(STATUS_LABEL) as PatientStatus[]).map((s) => (
                  <TabsTrigger key={s} value={s} className="flex-1 sm:flex-none text-xs sm:text-sm">
                    {STATUS_LABEL[s]} ({counts[s]})
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">
              {search ? 'Ningún paciente coincide con la búsqueda.' : `No tienes pacientes ${STATUS_LABEL[status].toLowerCase()}.`}
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((p) => {
                const age = ageFrom(p.birth_date);
                const linked = !!(p.profile_id || p.child_id);
                const consentOk = hasRequiredConsents(consents.get(p.id));
                return (
                  <button key={p.id} type="button" onClick={() => navigate(`/pacientes/${p.id}`)}
                    className="w-full text-left rounded-xl border bg-card hover:bg-accent/50 transition-colors p-3 sm:p-4 flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 text-primary font-semibold text-sm flex items-center justify-center">
                      {initials(p.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{p.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[age !== null ? `${age} años` : null,
                          p.document_number ? `${p.document_type ?? ''} ${p.document_number}`.trim() : null,
                          p.sport].filter(Boolean).join(' · ') || 'Sin datos de identificación'}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {consentsQ.isLoading ? null : consentOk ? (
                          <Badge variant="outline" className="gap-1 text-[10px] border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400">
                            <ShieldCheck className="h-3 w-3" /> Consentimiento vigente
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-[10px] border-amber-300 text-amber-800 dark:border-amber-800 dark:text-amber-400">
                            <ShieldAlert className="h-3 w-3" /> Falta consentimiento
                          </Badge>
                        )}
                        {linked ? (
                          <Badge variant="outline" className="gap-1 text-[10px]">
                            <Link2 className="h-3 w-3" /> Con cuenta
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">Sin cuenta</Badge>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      <PatientFormDialog open={createOpen} onOpenChange={setCreateOpen}
        onSaved={(p) => navigate(`/pacientes/${p.id}`)} />
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  const steps = [
    { icon: UserPlus, title: 'Crea el paciente', text: 'Sus datos de identificación, salud y acudiente si es menor.' },
    { icon: FileSignature, title: 'Registra el consentimiento', text: 'Firma presencial o invitación a la app. Es obligatorio por ley.' },
    { icon: ClipboardList, title: 'Abre la historia', text: 'Valoración inicial, diagnóstico CIE-10, evoluciones y alta.' },
  ];
  return (
    <Card>
      <CardContent className="py-10 px-4 text-center space-y-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Aún no tienes pacientes</h2>
          <p className="text-sm text-muted-foreground">Así funciona la historia clínica en SportMaps:</p>
        </div>
        <ol className="grid gap-3 sm:grid-cols-3 text-left">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-lg border p-3 space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center">{i + 1}</span>
                <s.icon className="h-4 w-4 text-primary" /> {s.title}
              </div>
              <p className="text-xs text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ol>
        <Button onClick={onCreate} className="gap-2"><Plus className="h-4 w-4" /> Crear mi primer paciente</Button>
      </CardContent>
    </Card>
  );
}
