import { useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, HeartPulse, ShieldCheck, Stethoscope } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useSchoolAthleteAvailability } from '@/hooks/useSchoolAthleteAvailability';
import { formatDayCO } from '@/lib/dateUtils';
import {
  AVAILABILITY_LABEL, AVAILABILITY_TONE, BODY_REGION_LABEL, RTP_STAGE_LABEL, clinicalErrorMessage,
} from '@/lib/clinical/labels';
import type { AvailabilityStatus, SchoolAthleteAvailability } from '@/lib/clinical/types';
import { cn } from '@/lib/utils';

const GROUPS: { status: AvailabilityStatus; title: string; hint: string }[] = [
  { status: 'no_disponible', title: 'No disponibles', hint: 'No deben entrenar ni competir por ahora.' },
  { status: 'restringido', title: 'Con restricciones', hint: 'Pueden entrenar respetando las restricciones.' },
  { status: 'disponible', title: 'En seguimiento, disponibles', hint: 'Tienen una lesión en seguimiento pero ya pueden participar.' },
];

function AthleteRow({ a }: { a: SchoolAthleteAvailability }) {
  let updated = '';
  try {
    updated = formatDistanceToNow(new Date(a.updated_at), { addSuffix: true, locale: es });
  } catch { /* fecha inválida: se omite */ }
  return (
    <div className="rounded-lg border bg-card p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold leading-tight">{a.athlete_name}</p>
        <Badge variant="outline" className={cn('shrink-0', AVAILABILITY_TONE[a.availability_status])}>
          {AVAILABILITY_LABEL[a.availability_status]}
        </Badge>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <p><span className="text-muted-foreground">Zona:</span> {BODY_REGION_LABEL[a.body_region] ?? a.body_region}</p>
        <p><span className="text-muted-foreground">Etapa:</span> {RTP_STAGE_LABEL[a.rtp_stage] ?? a.rtp_stage}</p>
        <p><span className="text-muted-foreground">Regreso estimado:</span> {a.expected_return ? formatDayCO(a.expected_return) : 'Sin fecha'}</p>
        {a.professional_name && (
          <p className="flex items-center gap-1"><Stethoscope className="w-3.5 h-3.5 text-muted-foreground" />{a.professional_name}</p>
        )}
      </div>
      {a.restrictions && (
        <p className="text-sm rounded-md bg-muted/60 px-2 py-1.5"><span className="font-medium">Restricciones:</span> {a.restrictions}</p>
      )}
      {updated && <p className="text-xs text-muted-foreground">Actualizado {updated}</p>}
    </div>
  );
}

export default function SchoolAvailabilityPage() {
  const { schoolId, schoolName, loading: loadingSchool } = useSchoolContext();
  const { list, isLoading, error, refetch } = useSchoolAthleteAvailability(schoolId);

  const grouped = useMemo(() => {
    const out: Record<AvailabilityStatus, SchoolAthleteAvailability[]> = { no_disponible: [], restringido: [], disponible: [] };
    for (const a of list) out[a.availability_status]?.push(a);
    for (const k of Object.keys(out) as AvailabilityStatus[]) out[k].sort((x, y) => x.athlete_name.localeCompare(y.athlete_name));
    return out;
  }, [list]);

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><HeartPulse className="w-6 h-6 text-primary" />Disponibilidad médica</h1>
        {schoolName && <p className="text-muted-foreground text-sm">{schoolName}</p>}
      </div>

      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription>
          Solo aparece lo que el profesional y la familia autorizaron compartir. Nunca se muestra el diagnóstico.
        </AlertDescription>
      </Alert>

      {(isLoading || loadingSchool) && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {!loadingSchool && !schoolId && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Selecciona una escuela para ver la disponibilidad de sus atletas.</CardContent></Card>
      )}

      {error && !isLoading && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {clinicalErrorMessage(error)}
            <Button size="sm" variant="outline" onClick={() => refetch()}>Reintentar</Button>
          </AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && schoolId && list.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center space-y-1">
            <p className="font-medium">No hay atletas con restricciones médicas compartidas.</p>
            <p className="text-sm text-muted-foreground">Si un profesional de la salud reporta una lesión y la familia lo autoriza, aparecerá aquí.</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && GROUPS.map((g) => grouped[g.status].length > 0 && (
        <Card key={g.status}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {g.title}
              <Badge variant="outline" className={AVAILABILITY_TONE[g.status]}>{grouped[g.status].length}</Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground">{g.hint}</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {grouped[g.status].map((a) => <AthleteRow key={`${a.child_id ?? ''}-${a.profile_id ?? ''}`} a={a} />)}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
