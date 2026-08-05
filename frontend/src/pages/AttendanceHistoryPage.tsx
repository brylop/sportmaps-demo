/**
 * AttendanceHistoryPage — histórico de asistencia de la escuela.
 *
 * La pantalla de Supervisión sirve para pasar lista HOY; esta responde las dos
 * preguntas del mes: quién viene y quién no (por atleta), y cómo estuvo cada día.
 * Todo sale de un solo GET /api/v1/attendance/history?month=YYYY-MM.
 */
import { useMemo, useState, type ElementType } from 'react';
import { useQuery } from '@tanstack/react-query';
import { saveAs } from 'file-saver';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import {
  ChevronLeft, ChevronRight, Download, AlertCircle, Users, CalendarDays,
  Percent, CheckCircle2, XCircle, Clock, FileText, Search, RefreshCw,
} from 'lucide-react';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { supabase } from '@/integrations/supabase/client';
import { bffClient } from '@/lib/api/bffClient';
import { cn } from '@/lib/utils';

// ── Tipos ──────────────────────────────────────────────────────────────────────
type Status = 'present' | 'absent' | 'late' | 'excused';

interface AthleteRow {
  id: string;
  athlete_type: 'child' | 'adult' | 'unregistered';
  full_name: string;
  contexts: string[];
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  rate: number;
  by_day: Record<string, Status>;
}

interface DayRow {
  date: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  athletes: number;
  rate: number;
}

interface HistoryResponse {
  month: string;
  from: string;
  to: string;
  days: DayRow[];
  athletes: AthleteRow[];
  totals: {
    records: number; present: number; absent: number; late: number;
    excused: number; rate: number; athletes: number; days: number;
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Mes actual en hora de Colombia — no la del navegador del usuario. */
function currentMonth(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }).slice(0, 7);
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

function dayLabel(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('es-CO', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

const STATUS_META: Record<Status, { label: string; short: string; cls: string }> = {
  present: { label: 'Presente', short: 'P', cls: 'bg-green-500/15 text-green-600 border-green-500/30' },
  late: { label: 'Tarde', short: 'T', cls: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
  excused: { label: 'Excusada', short: 'E', cls: 'bg-blue-500/15 text-blue-600 border-blue-500/30' },
  absent: { label: 'Ausente', short: 'A', cls: 'bg-red-500/15 text-red-600 border-red-500/30' },
};

function rateColor(rate: number): string {
  if (rate >= 80) return 'text-green-600';
  if (rate >= 60) return 'text-amber-600';
  return 'text-red-600';
}

const csvCell = (v: string | number) => {
  const s = String(v ?? '');
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map(r => r.map(csvCell).join(';')).join('\r\n');
  // BOM para que Excel en Windows respete los acentos.
  saveAs(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }), name);
}

// ── Página ─────────────────────────────────────────────────────────────────────
export default function AttendanceHistoryPage() {
  const { schoolId, schoolName } = useSchoolContext();
  const [month, setMonth] = useState(currentMonth);
  const [contextFilter, setContextFilter] = useState<string>('all'); // `team:<id>` | `offering:<id>`
  const [search, setSearch] = useState('');

  // Filtros de contexto: mismos equipos y planes que ve Supervisión.
  const { data: teams = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['history-teams', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams').select('id, name')
        .eq('school_id', schoolId).eq('status', 'active').order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId,
  });

  const { data: offerings = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['history-offerings', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('offerings').select('id, name')
        .eq('school_id', schoolId).eq('is_active', true).order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId,
  });

  const {
    data, isLoading, isError, error, isFetching, refetch,
  } = useQuery<HistoryResponse>({
    queryKey: ['attendance-history', schoolId, month, contextFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ month });
      if (contextFilter.startsWith('team:')) params.set('teamId', contextFilter.slice(5));
      if (contextFilter.startsWith('offering:')) params.set('offeringId', contextFilter.slice(9));
      return bffClient.get<HistoryResponse>(`/api/v1/attendance/history?${params}`);
    },
    enabled: !!schoolId,
  });

  const athletes = useMemo(() => {
    const rows = data?.athletes ?? [];
    const q = search.trim().toLowerCase();
    return q ? rows.filter(a => a.full_name.toLowerCase().includes(q)) : rows;
  }, [data, search]);

  const days = data?.days ?? [];
  const totals = data?.totals;
  const isCurrentMonth = month === currentMonth();

  // ── Exportes ─────────────────────────────────────────────────────────────
  const exportByAthlete = () => {
    downloadCsv(`asistencia-${month}-por-atleta.csv`, [
      ['Atleta', 'Equipos / Planes', 'Presentes', 'Tarde', 'Excusadas', 'Ausentes', 'Registros', '% Asistencia'],
      ...athletes.map(a => [
        a.full_name, a.contexts.join(' · '),
        a.present, a.late, a.excused, a.absent, a.total, `${a.rate}%`,
      ]),
    ]);
  };

  const exportByDay = () => {
    downloadCsv(`asistencia-${month}-por-dia.csv`, [
      ['Fecha', 'Atletas', 'Presentes', 'Tarde', 'Excusadas', 'Ausentes', 'Registros', '% Asistencia'],
      ...days.map(d => [
        d.date, d.athletes, d.present, d.late, d.excused, d.absent, d.total, `${d.rate}%`,
      ]),
    ]);
  };

  const exportMatrix = () => {
    downloadCsv(`asistencia-${month}-matriz.csv`, [
      ['Atleta', ...days.map(d => d.date), '% Asistencia'],
      ...athletes.map(a => [
        a.full_name,
        ...days.map(d => (a.by_day[d.date] ? STATUS_META[a.by_day[d.date]].label : '')),
        `${a.rate}%`,
      ]),
    ]);
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px] mx-auto">
      {/* ── Encabezado y selector de mes ─────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-primary" />
            Histórico de asistencia
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {schoolName ? `${schoolName} · ` : ''}Consolidado del mes por atleta y por día.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 border rounded-lg p-1 bg-card">
            <Button variant="ghost" size="icon" className="h-8 w-8"
              onClick={() => setMonth(m => shiftMonth(m, -1))} aria-label="Mes anterior">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-bold min-w-[140px] text-center">{monthLabel(month)}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isCurrentMonth}
              onClick={() => setMonth(m => shiftMonth(m, 1))} aria-label="Mes siguiente">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {!isCurrentMonth && (
            <Button variant="outline" size="sm" onClick={() => setMonth(currentMonth())}>
              Mes actual
            </Button>
          )}

          <Select value={contextFilter} onValueChange={setContextFilter}>
            <SelectTrigger className="w-[220px] h-9">
              <SelectValue placeholder="Todos los equipos y planes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los equipos y planes</SelectItem>
              {teams.map(t => (
                <SelectItem key={t.id} value={`team:${t.id}`}>Equipo · {t.name}</SelectItem>
              ))}
              {offerings.map(o => (
                <SelectItem key={o.id} value={`offering:${o.id}`}>Plan · {o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('w-4 h-4 mr-1.5', isFetching && 'animate-spin')} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* ── Error: nunca dejar una tabla vacía haciéndose pasar por "sin datos" ── */}
      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No se pudo cargar el histórico</AlertTitle>
          <AlertDescription className="flex flex-col gap-2 items-start">
            <span>{(error as Error)?.message || 'Error desconocido consultando el BFF.'}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Reintentar</Button>
          </AlertDescription>
        </Alert>
      )}

      {isLoading && <div className="py-20"><LoadingSpinner text="Cargando histórico..." /></div>}

      {!isLoading && !isError && totals && (
        <>
          {/* ── KPIs del mes ───────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <KpiCard icon={Percent} label="% Asistencia"
              value={`${totals.rate}%`} valueCls={rateColor(totals.rate)} />
            <KpiCard icon={Users} label="Atletas con registro" value={totals.athletes} />
            <KpiCard icon={CalendarDays} label="Días con lista" value={totals.days} />
            <KpiCard icon={CheckCircle2} label="Presentes" value={totals.present} valueCls="text-green-600" />
            <KpiCard icon={Clock} label="Tarde" value={totals.late} valueCls="text-amber-600" />
            <KpiCard icon={XCircle} label="Ausentes" value={totals.absent} valueCls="text-red-600" />
          </div>

          {totals.records === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="font-semibold">Sin asistencias registradas en {monthLabel(month)}</p>
                <p className="text-sm mt-1">
                  Las listas se pasan en Asistencias → Supervisión; lo que se marque ahí aparece acá.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Tabs defaultValue="atleta">
              <TabsList>
                <TabsTrigger value="atleta" className="gap-2">
                  <Users className="w-4 h-4" /> Por atleta
                </TabsTrigger>
                <TabsTrigger value="dia" className="gap-2">
                  <CalendarDays className="w-4 h-4" /> Por día
                </TabsTrigger>
                <TabsTrigger value="matriz" className="gap-2">
                  <FileText className="w-4 h-4" /> Día por día
                </TabsTrigger>
              </TabsList>

              {/* ── Por atleta ─────────────────────────────────────────── */}
              <TabsContent value="atleta">
                <Card>
                  <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Asistencia del mes por atleta</CardTitle>
                      <CardDescription>
                        {athletes.length} atleta{athletes.length === 1 ? '' : 's'} · % = (presentes + tarde) / registros
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input className="pl-8 h-9 w-[220px]" placeholder="Buscar atleta..."
                          value={search} onChange={e => setSearch(e.target.value)} />
                      </div>
                      <Button variant="outline" size="sm" onClick={exportByAthlete}>
                        <Download className="w-4 h-4 mr-1.5" /> CSV
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Atleta</TableHead>
                          <TableHead>Equipos / Planes</TableHead>
                          <TableHead className="text-right">Presentes</TableHead>
                          <TableHead className="text-right">Tarde</TableHead>
                          <TableHead className="text-right">Excusadas</TableHead>
                          <TableHead className="text-right">Ausentes</TableHead>
                          <TableHead className="text-right">Registros</TableHead>
                          <TableHead className="text-right">%</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {athletes.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                              Ningún atleta coincide con “{search}”.
                            </TableCell>
                          </TableRow>
                        ) : athletes.map(a => (
                          <TableRow key={a.id}>
                            <TableCell className="font-semibold">
                              {a.full_name}
                              {a.athlete_type === 'unregistered' && (
                                <Badge variant="outline" className="ml-2 text-[10px]">Sin cuenta</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">
                              {a.contexts.join(' · ') || '—'}
                            </TableCell>
                            <TableCell className="text-right text-green-600 font-medium">{a.present}</TableCell>
                            <TableCell className="text-right text-amber-600">{a.late}</TableCell>
                            <TableCell className="text-right text-blue-600">{a.excused}</TableCell>
                            <TableCell className="text-right text-red-600 font-medium">{a.absent}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{a.total}</TableCell>
                            <TableCell className={cn('text-right font-black', rateColor(a.rate))}>
                              {a.rate}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Por día ────────────────────────────────────────────── */}
              <TabsContent value="dia">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Asistencia día por día</CardTitle>
                      <CardDescription>
                        Solo los días en que se pasó lista ({days.length} de {monthLabel(month)}).
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={exportByDay}>
                      <Download className="w-4 h-4 mr-1.5" /> CSV
                    </Button>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Día</TableHead>
                          <TableHead className="text-right">Atletas</TableHead>
                          <TableHead className="text-right">Presentes</TableHead>
                          <TableHead className="text-right">Tarde</TableHead>
                          <TableHead className="text-right">Excusadas</TableHead>
                          <TableHead className="text-right">Ausentes</TableHead>
                          <TableHead className="text-right">Registros</TableHead>
                          <TableHead className="text-right">%</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {days.map(d => (
                          <TableRow key={d.date}>
                            <TableCell className="font-semibold capitalize">{dayLabel(d.date)}</TableCell>
                            <TableCell className="text-right">{d.athletes}</TableCell>
                            <TableCell className="text-right text-green-600 font-medium">{d.present}</TableCell>
                            <TableCell className="text-right text-amber-600">{d.late}</TableCell>
                            <TableCell className="text-right text-blue-600">{d.excused}</TableCell>
                            <TableCell className="text-right text-red-600 font-medium">{d.absent}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{d.total}</TableCell>
                            <TableCell className={cn('text-right font-black', rateColor(d.rate))}>
                              {d.rate}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Matriz atleta × día ────────────────────────────────── */}
              <TabsContent value="matriz">
                <Card>
                  <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Atleta por día</CardTitle>
                      <CardDescription className="flex flex-wrap items-center gap-2 mt-1">
                        {(Object.keys(STATUS_META) as Status[]).map(s => (
                          <span key={s} className={cn('px-1.5 py-0.5 rounded border text-[10px] font-bold', STATUS_META[s].cls)}>
                            {STATUS_META[s].short} = {STATUS_META[s].label}
                          </span>
                        ))}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input className="pl-8 h-9 w-[220px]" placeholder="Buscar atleta..."
                          value={search} onChange={e => setSearch(e.target.value)} />
                      </div>
                      <Button variant="outline" size="sm" onClick={exportMatrix}>
                        <Download className="w-4 h-4 mr-1.5" /> CSV
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 bg-card z-10 min-w-[200px]">Atleta</TableHead>
                          {days.map(d => (
                            <TableHead key={d.date} className="text-center px-1 text-[10px] font-bold">
                              {Number(d.date.slice(-2))}
                            </TableHead>
                          ))}
                          <TableHead className="text-right">%</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {athletes.map(a => (
                          <TableRow key={a.id}>
                            <TableCell className="sticky left-0 bg-card z-10 font-semibold whitespace-nowrap">
                              {a.full_name}
                            </TableCell>
                            {days.map(d => {
                              const st = a.by_day[d.date];
                              return (
                                <TableCell key={d.date} className="text-center px-1">
                                  {st ? (
                                    <span
                                      title={`${dayLabel(d.date)} — ${STATUS_META[st].label}`}
                                      className={cn(
                                        'inline-flex w-5 h-5 items-center justify-center rounded border text-[10px] font-black',
                                        STATUS_META[st].cls,
                                      )}
                                    >
                                      {STATUS_META[st].short}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground/30 text-xs">·</span>
                                  )}
                                </TableCell>
                              );
                            })}
                            <TableCell className={cn('text-right font-black', rateColor(a.rate))}>
                              {a.rate}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </div>
  );
}

// ── KPI ────────────────────────────────────────────────────────────────────────
function KpiCard({
  icon: Icon, label, value, valueCls,
}: {
  icon: ElementType; label: string; value: string | number; valueCls?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          <Icon className="w-3.5 h-3.5" />
          {label}
        </div>
        <p className={cn('text-2xl font-black mt-1.5', valueCls)}>{value}</p>
      </CardContent>
    </Card>
  );
}
