import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Activity, AlertCircle, BarChart3, CalendarCheck, CircleSlash, Gauge, Loader2, Stethoscope, UserPlus,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { APPOINTMENT_STATUS_LABEL, BODY_REGION_LABEL, clinicalErrorMessage } from '@/lib/clinical/labels';
import {
  currentMonthColombia, getProfessionalMonthReport, offeredMinutesInMonth,
} from '@/lib/clinical/agenda-extra';
import type { AppointmentStatus, BodyRegion } from '@/lib/clinical/types';
import { dayToLocalDate } from '@/lib/dateUtils';

const STATUSES: AppointmentStatus[] = ['confirmed', 'completed', 'pending', 'no_show', 'cancelled'];
const STATUS_BAR: Record<AppointmentStatus, string> = {
  pending: 'bg-amber-500', confirmed: 'bg-emerald-500', completed: 'bg-slate-500', cancelled: 'bg-rose-500', no_show: 'bg-slate-400',
};

function lastMonths(n: number): string[] {
  const [y, m] = currentMonthColombia().split('-').map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return d.toISOString().slice(0, 7);
  });
}

function monthLabel(ym: string) {
  return format(dayToLocalDate(`${ym}-01`), "MMMM 'de' yyyy", { locale: es });
}

function Kpi({ icon: Icon, title, value, hint }: { icon: typeof Activity; title: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div>
          <div className="min-w-0">
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{title}</p>
            {hint && <p className="text-[11px] text-muted-foreground/80">{hint}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProfessionalReportsPage() {
  const months = useMemo(() => lastMonths(12), []);
  const [month, setMonth] = useState(months[0]);

  const q = useQuery({
    queryKey: ['clinical', 'reports', month],
    queryFn: () => getProfessionalMonthReport(month),
  });

  const derived = useMemo(() => {
    const r = q.data;
    if (!r) return null;
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<AppointmentStatus, number>;
    let bookedMinutes = 0;
    for (const a of r.appointments) {
      byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
      if (a.status !== 'cancelled') bookedMinutes += a.duration_minutes;
    }
    const total = r.appointments.length;
    const attendedOrMissed = byStatus.completed + byStatus.no_show;
    const noShowRate = attendedOrMissed > 0 ? Math.round((byStatus.no_show / attendedOrMissed) * 100) : null;
    const offered = offeredMinutesInMonth(month, r.availability, r.exceptions);
    const occupancy = offered > 0 ? Math.min(100, Math.round((bookedMinutes / offered) * 100)) : null;
    const regions = new Map<BodyRegion, number>();
    for (const i of r.activeInjuries) regions.set(i.body_region, (regions.get(i.body_region) ?? 0) + 1);
    const regionList = [...regions.entries()].sort((a, b) => b[1] - a[1]);
    const patientsSeen = new Set(r.appointments.filter((a) => a.status === 'completed' && a.patient_id).map((a) => a.patient_id)).size;
    return { byStatus, total, noShowRate, occupancy, bookedMinutes, offered, regionList, patientsSeen };
  }, [q.data, month]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <BarChart3 className="h-6 w-6 text-primary" />Reportes
          </h1>
          <p className="text-sm text-muted-foreground">Cómo va tu práctica mes a mes.</p>
        </div>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-full capitalize sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {months.map((m) => <SelectItem key={m} value={m} className="capitalize">{monthLabel(m)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {q.isLoading ? (
        <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : q.isError || !q.data || !derived ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">{clinicalErrorMessage(q.error)}</p>
            <Button variant="outline" onClick={() => q.refetch()}>Reintentar</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi icon={CalendarCheck} title="Citas en el mes" value={derived.total} hint={`${derived.patientsSeen} pacientes atendidos`} />
            <Kpi
              icon={CircleSlash}
              title="Tasa de no asistencia"
              value={derived.noShowRate === null ? '—' : `${derived.noShowRate}%`}
              hint={derived.noShowRate === null ? 'Sin citas cerradas' : `${derived.byStatus.no_show} de ${derived.byStatus.completed + derived.byStatus.no_show}`}
            />
            <Kpi icon={UserPlus} title="Pacientes nuevos" value={q.data.newPatients} />
            <Kpi
              icon={Gauge}
              title="Ocupación aproximada"
              value={derived.occupancy === null ? '—' : `${derived.occupancy}%`}
              hint={derived.occupancy === null ? 'Configura tu disponibilidad' : `${Math.round(derived.bookedMinutes / 60)} h de ${Math.round(derived.offered / 60)} h ofrecidas`}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Citas por estado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {derived.total === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin citas en este mes.</p>
                ) : STATUSES.map((s) => (
                  <div key={s} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{APPOINTMENT_STATUS_LABEL[s]}</span>
                      <span className="font-medium">{derived.byStatus[s]}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full ${STATUS_BAR[s]}`} style={{ width: `${(derived.byStatus[s] / derived.total) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Stethoscope className="h-4 w-4" />Tratamientos</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg border p-3">
                  <p className="text-2xl font-bold">{q.data.openEpisodes}</p>
                  <p className="text-xs text-muted-foreground">Abiertos hoy</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-2xl font-bold">{q.data.episodesOpened}</p>
                  <p className="text-xs text-muted-foreground">Iniciados en el mes</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-2xl font-bold">{q.data.discharges}</p>
                  <p className="text-xs text-muted-foreground">Altas en el mes</p>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4" />Lesiones activas por región</CardTitle>
                <CardDescription>Estado actual de tus pacientes (no depende del mes).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {derived.regionList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay lesiones activas registradas.</p>
                ) : derived.regionList.map(([region, n]) => (
                  <div key={region} className="grid grid-cols-[120px_1fr_32px] items-center gap-3 text-sm">
                    <span className="truncate">{BODY_REGION_LABEL[region] ?? region}</span>
                    <Progress value={(n / q.data.activeInjuries.length) * 100} className="h-2" />
                    <span className="text-right font-medium">{n}</span>
                  </div>
                ))}
                {derived.regionList.length > 0 && (
                  <Button asChild variant="link" className="h-auto px-0 text-xs"><Link to="/historias">Ver seguimientos</Link></Button>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
