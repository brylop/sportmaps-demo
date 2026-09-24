/**
 * AttendanceMonthCard — bloque "Asistencia del mes" del reporte gerencial.
 *
 * Pedido de Club Carmel (2026-09-18): el reporte global traía ocupación,
 * ingresos y crecimiento, pero nada de asistencia, que es lo que una escuela
 * que no cobra mira todos los días. Todo sale del mismo endpoint que usa el
 * Histórico (`GET /api/v1/attendance/history?month=YYYY-MM`), así los números
 * coinciden entre las dos pantallas. Solo lectura.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { bffClient } from '@/lib/api/bffClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CalendarCheck, ChevronLeft, ChevronRight, Loader2, Users, AlertTriangle, ArrowRight } from 'lucide-react';

interface ContextRow {
  name: string; present: number; absent: number; late: number; excused: number;
  total: number; rate: number; athletes: number;
}
interface AthleteRow {
  id: string; full_name: string; contexts: string[];
  present: number; absent: number; late: number; excused: number; total: number; rate: number;
}
interface HistoryResponse {
  month: string;
  days: { date: string; total: number; rate: number }[];
  athletes: AthleteRow[];
  contexts?: ContextRow[];
  totals: {
    records: number; present: number; absent: number; late: number; excused: number;
    rate: number; athletes: number; days: number;
  };
}

/** 'YYYY-MM' de hoy en la zona de la escuela (Colombia), sin depender de la del navegador. */
const currentMonth = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit' })
    .format(new Date())
    .slice(0, 7);

const shiftMonth = (ym: string, delta: number) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('es-CO', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const rateTone = (rate: number) =>
  rate < 70 ? 'text-red-600' : rate < 85 ? 'text-yellow-600' : 'text-green-600';
const barTone = (rate: number) =>
  rate < 70 ? '[&>div]:bg-red-500 bg-red-100' : rate < 85 ? '[&>div]:bg-yellow-500 bg-yellow-100' : '[&>div]:bg-green-500';

export default function AttendanceMonthCard() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(currentMonth);
  const isCurrent = month === currentMonth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['attendance-history', month],
    queryFn: () => bffClient.get<HistoryResponse>(`/api/v1/attendance/history?month=${month}`),
    staleTime: 60 * 1000,
  });

  const totals = data?.totals;
  const hasData = !!totals && totals.records > 0;
  const contexts = (data?.contexts ?? []).slice().sort((a, b) => a.rate - b.rate);
  const topAbsences = (data?.athletes ?? [])
    .filter((a) => a.absent > 0)
    .sort((a, b) => b.absent - a.absent || a.rate - b.rate)
    .slice(0, 5);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" />
            Asistencia del mes
          </CardTitle>
          <CardDescription>{monthLabel(month)} · presentes y tardanzas cuentan como asistencia</CardDescription>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Mes anterior" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Mes siguiente" disabled={isCurrent} onClick={() => setMonth((m) => shiftMonth(m, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => navigate('/attendance-history')}>
            Histórico <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : error ? (
          <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground gap-2">
            <AlertTriangle className="w-8 h-8 opacity-40" />
            <p className="text-sm">No se pudo cargar la asistencia de {monthLabel(month).toLowerCase()}.</p>
          </div>
        ) : !hasData ? (
          <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground gap-2">
            <Users className="w-10 h-10 opacity-30" />
            <p className="text-sm">Sin listas de asistencia en {monthLabel(month).toLowerCase()}.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* KPIs del mes */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Asistencia</p>
                <p className={`text-2xl font-bold ${rateTone(totals!.rate)}`}>{totals!.rate}%</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Presentes / registros</p>
                <p className="text-2xl font-bold tabular-nums">
                  {totals!.present + totals!.late}
                  <span className="text-sm font-normal text-muted-foreground"> / {totals!.records}</span>
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Días con lista</p>
                <p className="text-2xl font-bold tabular-nums">{totals!.days}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Deportistas con registro</p>
                <p className="text-2xl font-bold tabular-nums">{totals!.athletes}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Por equipo */}
              <div className="space-y-3">
                <p className="text-sm font-semibold">Por equipo</p>
                {contexts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Las listas de este mes no están ligadas a un equipo.</p>
                ) : (
                  contexts.map((c) => (
                    <div key={c.name} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate font-medium">{c.name}</span>
                        <span className="shrink-0 tabular-nums">
                          <span className={`font-bold ${rateTone(c.rate)}`}>{c.rate}%</span>
                          <span className="text-xs text-muted-foreground"> · {c.present + c.late}/{c.total} · {c.athletes} dep.</span>
                        </span>
                      </div>
                      <Progress value={c.rate} className={`h-2 ${barTone(c.rate)}`} />
                    </div>
                  ))
                )}
              </div>

              {/* Más faltas */}
              <div className="space-y-3">
                <p className="text-sm font-semibold">Más faltas del mes</p>
                {topAbsences.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nadie faltó este mes.</p>
                ) : (
                  <ul className="space-y-2">
                    {topAbsences.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{a.full_name}</p>
                          {a.contexts.length > 0 && (
                            <p className="truncate text-xs text-muted-foreground">{a.contexts.join(' · ')}</p>
                          )}
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          <Badge variant={a.rate < 70 ? 'destructive' : 'secondary'} className="tabular-nums">
                            {a.absent} falta{a.absent !== 1 ? 's' : ''}
                          </Badge>
                          <span className={`text-xs font-bold tabular-nums ${rateTone(a.rate)}`}>{a.rate}%</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
