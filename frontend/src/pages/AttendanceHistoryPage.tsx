/**
 * AttendanceHistoryPage — histórico de asistencia de la escuela.
 *
 * La pantalla de Supervisión sirve para pasar lista HOY; esta responde las dos
 * preguntas del mes: quién viene y quién no (por atleta), y cómo estuvo cada día.
 * Todo sale de un solo GET /api/v1/attendance/history?month=YYYY-MM.
 *
 * También acepta un rango (`fromMonth`/`toMonth`) o `month=all`: Carmel pidió
 * ver todos los meses juntos. En rango se agrega la pestaña "Por mes" y se
 * ocultan las vistas que solo tienen sentido dentro de un mes (matriz día por
 * día, plan vs consumo y facturar: el tope del plan es mensual).
 */
import { useMemo, useState, type ElementType } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Percent, CheckCircle2, XCircle, Clock, FileText, Search, RefreshCw, BarChart3,
} from 'lucide-react';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { bffClient } from '@/lib/api/bffClient';
import { cn } from '@/lib/utils';
import {
  AttendanceRateByMonthChart, AthletesByMonthChart,
} from '@/components/attendance/AttendanceByMonthChart';
import {
  proseMonthLabel, shortMonthLabel, type MonthPoint,
} from '@/components/attendance/attendanceMonths';

// ── Tipos ──────────────────────────────────────────────────────────────────────
type Status = 'present' | 'absent' | 'late' | 'excused';

interface AthleteRow {
  id: string;
  athlete_type: 'child' | 'adult' | 'unregistered';
  full_name: string;
  /** Otros nombres de la misma persona: la escuela la busca como la precargó. */
  aliases?: string[];
  contexts: string[];
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  rate: number;
  by_day: Record<string, Status>;
  /** Solo lo trae el BFF nuevo; en un mes suelto tiene una sola llave. */
  by_month?: Record<string, MonthCounts>;
  /** Cruce con el plan contratado. Ver "Plan vs consumo" en el BFF. En rango no viene. */
  plan?: {
    nombre: string | null;
    tope: number | null;
    vence: string | null;
    descontadas: number;
    asistidas: number;
    cubiertas: number;
    precio_clase: number | null;
    moneda: string;
    /** Se pasó del tope teniendo el plan vigente. */
    excedente: { clases: number; valor: number | null; fechas: string[] };
    /** Entrenó con el plan ya vencido. Cubo distinto: NO se solapa con el anterior. */
    vencidas: { clases: number; valor: number | null; fechas: string[] };
    fuera_de_plan: number;
    valor: number | null;
    enrollment_id?: string;
    plan_id?: string | null;
    team_id?: string | null;
    estado: 'ok' | 'excedido' | 'vencido' | 'sin_plan';
  };
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

interface MonthCounts {
  present: number; absent: number; late: number; excused: number; total: number;
}

interface MonthRow extends MonthCounts {
  month: string;
  athletes: number;
  days: number;
  rate: number;
}

interface HistoryResponse {
  month: string;
  from: string;
  to: string;
  range?: { from: string; to: string; is_range: boolean };
  months?: MonthRow[];
  days: DayRow[];
  athletes: AthleteRow[];
  /** null en rango: el tope del plan es mensual y no se puede sumar entre meses. */
  desfases?: {
    excedidos: number; con_vencido: number; sin_plan: number;
    clases_de_mas: number; clases_vencidas: number;
    valor_excedente: number; valor_vencidas: number; valor_total: number;
  } | null;
  totals: {
    records: number; present: number; absent: number; late: number;
    excused: number; rate: number; athletes: number; days: number;
  };
}

type FacturarItem = {
  athleteId: string;
  athleteType: 'child' | 'adult' | 'unregistered';
  motivo: 'excedente' | 'vencidas';
  clases: number;
  precioClase: number;
  teamId?: string | null;
  planId?: string | null;
  nombre?: string;
  fechas?: string[];
};

/**
 * Los cubos del plan, tolerando la forma vieja del BFF.
 *
 * Vercel y Render despliegan por separado, así que la pantalla puede quedar una
 * versión adelante del BFF. Cuando eso pasó, `plan.excedente` llegaba como
 * NÚMERO (forma vieja) donde la pantalla esperaba `{clases, valor, fechas}`, y
 * `cubo.fechas.length` tiraba la página entera con un ErrorBoundary.
 *
 * Una pantalla de reportes no puede caerse por un desfase de despliegue: se
 * degrada a mostrar el conteo sin fechas, que es lo que el BFF viejo sabe dar.
 */
type CuboPlan = { clases: number; valor: number | null; fechas: string[] };

function cuboDelPlan(plan: AthleteRow['plan'], motivo: 'excedente' | 'vencidas'): CuboPlan {
  const vacio: CuboPlan = { clases: 0, valor: null, fechas: [] };
  if (!plan) return vacio;

  const crudo = (plan as any)[motivo]
    // Forma vieja: `excedente` numérico y `tras_vencer` en vez de `vencidas`.
    ?? (motivo === 'vencidas' ? (plan as any).tras_vencer : undefined);

  if (typeof crudo === 'number') {
    const precio = (plan as any).precio_clase ?? null;
    return { clases: crudo, valor: precio ? crudo * precio : null, fechas: [] };
  }
  if (crudo && typeof crudo === 'object') {
    return {
      clases: Number(crudo.clases ?? 0),
      valor: crudo.valor ?? null,
      fechas: Array.isArray(crudo.fechas) ? crudo.fechas : [],
    };
  }
  return vacio;
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

/** Meses entre `from` y `to` inclusive, en orden. */
function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from; m <= to && out.length < 120; m = shiftMonth(m, 1)) out.push(m);
  return out;
}

const pct = (c: MonthCounts) => (c.total > 0 ? Math.round(((c.present + c.late) / c.total) * 100) : 0);

/** Un mes, o "de agosto 2026 a octubre 2026", para frases y vacíos. */
function periodText(from: string, to: string): string {
  return from === to ? proseMonthLabel(from) : `de ${proseMonthLabel(from)} a ${proseMonthLabel(to)}`;
}

type PeriodMode = 'month' | 'range' | 'all';

const MODE_LABEL: Record<PeriodMode, string> = { month: 'Un mes', range: 'Varios meses', all: 'Todo' };

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
  const [mode, setMode] = useState<PeriodMode>('month');
  const [rangeFrom, setRangeFrom] = useState(() => shiftMonth(currentMonth(), -2));
  const [rangeTo, setRangeTo] = useState(currentMonth);
  // Controlada: al pasar a rango la pestaña por defecto cambia a "Por mes", y
  // si estaba en una que en rango no existe (matriz, plan) no puede quedar colgada.
  const [tab, setTab] = useState('atleta');
  const [contextFilter, setContextFilter] = useState<string>('all'); // `team:<id>` | `offering:<id>`
  const [coachFilter, setCoachFilter] = useState<string>('all');     // school_staff.id
  const [search, setSearch] = useState('');

  // Cuerpo técnico, para filtrar por quién pasó la lista. Solo el staff que
  // efectivamente aparece tomando asistencia tiene sentido acá, pero se listan
  // todos los activos: si uno no marcó nada, el filtro devuelve vacío y eso
  // también es información — dice que ese entrenador no está pasando lista.
  const { data: coaches = [] } = useQuery<{ id: string; full_name: string }[]>({
    queryKey: ['history-coaches', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('school_staff').select('id, full_name')
        .eq('school_id', schoolId).eq('status', 'active').order('full_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId,
  });

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

  const isRangeMode = mode !== 'month';
  // Los <input type="month"> pueden quedar al revés; el BFF los invierte igual,
  // pero se ordenan acá para que llave, títulos y CSV digan lo mismo.
  const [qFrom, qTo] = rangeFrom <= rangeTo ? [rangeFrom, rangeTo] : [rangeTo, rangeFrom];
  const rangeTooLong = mode === 'range' && monthsBetween(qFrom, qTo).length > 24;

  const changeMode = (next: PeriodMode) => {
    setMode(next);
    setTab(next === 'month' ? 'atleta' : 'mes');
  };

  const {
    data, isLoading, isError, error, isFetching, refetch,
  } = useQuery<HistoryResponse>({
    // Llave distinta por modo: un mes suelto y un rango que lo contiene no
    // pueden pisarse en la caché.
    queryKey: [
      'attendance-history', schoolId,
      mode === 'month' ? month : mode === 'range' ? `${qFrom}_${qTo}` : 'all',
      mode, contextFilter, coachFilter,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (mode === 'month') params.set('month', month);
      else if (mode === 'all') params.set('month', 'all');
      else { params.set('fromMonth', qFrom); params.set('toMonth', qTo); }
      if (contextFilter.startsWith('team:')) params.set('teamId', contextFilter.slice(5));
      if (contextFilter.startsWith('offering:')) params.set('offeringId', contextFilter.slice(9));
      if (coachFilter !== 'all') params.set('coachId', coachFilter);
      return bffClient.get<HistoryResponse>(`/api/v1/attendance/history?${params}`);
    },
    enabled: !!schoolId && !rangeTooLong,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Facturar es plata: se emite por CONCEPTO y por atleta, nunca todo junto en
  // un cargo. El BFF vuelve a validar contra doble cobro por (atleta, mes,
  // concepto), asi que dos clics o dos personas a la vez no duplican.
  const facturar = useMutation({
    mutationFn: async (items: FacturarItem[]) =>
      bffClient.post<{ emitidos: number; omitidos: number; total: number; detalle: any }>(
        '/api/v1/attendance/facturar-fuera-de-plan', { month, items }),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['attendance-history'] });
      const yaEstaban = (r.detalle?.omitidos ?? []).filter((o: any) => o.razon === 'ya_facturado').length;
      toast({
        title: r.emitidos > 0 ? `Se emitieron ${r.emitidos} cobros` : 'No se emitió ningún cobro',
        description: [
          r.emitidos > 0 ? `Total $${r.total.toLocaleString('es-CO')}.` : null,
          yaEstaban > 0 ? `${yaEstaban} ya estaban facturados y se omitieron.` : null,
        ].filter(Boolean).join(' '),
      });
    },
    onError: (e: any) => toast({ title: 'No se pudo facturar', description: e?.message, variant: 'destructive' }),
  });

  // Atletas cuyo consumo no cuadra con lo que pagaron. Es la pregunta que la
  // escuela no podia hacerse: la asistencia se registra aunque no haya saldo,
  // asi que el desfase era invisible hasta que alguien sumaba a mano.
  const desglose = useMemo(
    () => (data?.athletes ?? []).filter(a => {
      if (!a.plan) return false;
      // No confiar solo en `estado`: si el BFF es viejo puede no traerlo. Se
      // decide por los cubos, que ya vienen normalizados.
      return cuboDelPlan(a.plan, 'excedente').clases > 0
          || cuboDelPlan(a.plan, 'vencidas').clases > 0;
    }),
    [data],
  );
  const desfases = desglose.length;
  // Se suma en el cliente en vez de leer `desfases.valor_total`: si el BFF es
  // una version atras ese campo no existe y el encabezado mostraria $0.
  const totalDesfase = desglose.reduce(
    (t, a) => t + (cuboDelPlan(a.plan, 'excedente').valor ?? 0) + (cuboDelPlan(a.plan, 'vencidas').valor ?? 0),
    0,
  );

  const athletes = useMemo(() => {
    const rows = data?.athletes ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    // Busca también por el nombre con que la escuela precargó a la persona: si la
    // cuenta dice "Dai Vázquez", escribir "DAIMARIS" tiene que encontrarla igual.
    return rows.filter(a =>
      a.full_name.toLowerCase().includes(q)
      || (a.aliases ?? []).some(n => n.toLowerCase().includes(q)));
  }, [data, search]);

  const days = data?.days ?? [];
  const totals = data?.totals;
  const isCurrentMonth = month === currentMonth();

  // Periodo efectivo. En "Todo" el inicio lo decide el BFF (primera lista de
  // la escuela), así que hasta que responda no se sabe.
  const period = mode === 'month'
    ? { from: month, to: month }
    : data?.range
      ? { from: data.range.from, to: data.range.to }
      : mode === 'range' ? { from: qFrom, to: qTo } : null;
  const enPeriodo = !period
    ? 'en todo el historial'
    : period.from === period.to ? `en ${periodText(period.from, period.to)}` : periodText(period.from, period.to);
  const fileTag = !period ? 'todo' : period.from === period.to ? period.from : `${period.from}_a_${period.to}`;

  // Todos los meses del periodo, también los que no tuvieron lista: el BFF solo
  // manda los que tienen registros y un hueco en la gráfica también informa.
  const monthRows = useMemo(() => data?.months ?? [], [data]);
  const periodFrom = period?.from;
  const periodTo = period?.to;
  const rangeMonths = useMemo(
    () => (periodFrom && periodTo ? monthsBetween(periodFrom, periodTo) : monthRows.map(m => m.month)),
    [periodFrom, periodTo, monthRows],
  );
  const monthPoints: MonthPoint[] = useMemo(() => {
    const byKey = new Map(monthRows.map(m => [m.month, m]));
    return rangeMonths.map(m => {
      const r = byKey.get(m);
      return { month: m, rate: r && r.total > 0 ? r.rate : null, athletes: r?.athletes ?? 0 };
    });
  }, [monthRows, rangeMonths]);

  // ── Exportes ─────────────────────────────────────────────────────────────
  const exportByAthlete = () => {
    const porMes = isRangeMode ? rangeMonths : [];
    downloadCsv(`asistencia-${fileTag}-por-atleta.csv`, [
      ['Atleta', 'Otros nombres', 'Equipos / Planes',
        ...porMes.map(m => `% ${shortMonthLabel(m)}`),
        'Presentes', 'Tarde', 'Excusadas', 'Ausentes', 'Registros', '% Asistencia'],
      ...athletes.map(a => [
        a.full_name, (a.aliases ?? []).join(' · '), a.contexts.join(' · '),
        ...porMes.map(m => {
          const c = a.by_month?.[m];
          return c && c.total > 0 ? `${pct(c)}%` : '';
        }),
        a.present, a.late, a.excused, a.absent, a.total, `${a.rate}%`,
      ]),
    ]);
  };

  const exportByMonth = () => {
    const byKey = new Map(monthRows.map(m => [m.month, m]));
    downloadCsv(`asistencia-${fileTag}-por-mes.csv`, [
      ['Mes', 'Días con lista', 'Deportistas', 'Presentes', 'Tarde', 'Excusadas', 'Ausentes', 'Registros', '% Asistencia'],
      ...rangeMonths.map(m => {
        const r = byKey.get(m);
        return r
          ? [m, r.days, r.athletes, r.present, r.late, r.excused, r.absent, r.total, `${r.rate}%`]
          : [m, 0, 0, 0, 0, 0, 0, 0, ''];
      }),
    ]);
  };

  const exportByDay = () => {
    downloadCsv(`asistencia-${fileTag}-por-dia.csv`, [
      ['Fecha', 'Atletas', 'Presentes', 'Tarde', 'Excusadas', 'Ausentes', 'Registros', '% Asistencia'],
      ...days.map(d => [
        d.date, d.athletes, d.present, d.late, d.excused, d.absent, d.total, `${d.rate}%`,
      ]),
    ]);
  };

  const exportMatrix = () => {
    downloadCsv(`asistencia-${fileTag}-matriz.csv`, [
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
            {schoolName ? `${schoolName} · ` : ''}
            {isRangeMode
              ? `Consolidado ${enPeriodo} por mes, por atleta y por día.`
              : 'Consolidado del mes por atleta y por día.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de periodo: tres modos y nada más. */}
          <div role="radiogroup" aria-label="Periodo" className="flex items-center gap-0.5 border rounded-lg p-1 bg-card">
            {(Object.keys(MODE_LABEL) as PeriodMode[]).map(m => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => changeMode(m)}
                className={cn(
                  'h-8 px-3 rounded-md text-sm font-semibold transition-colors',
                  mode === m
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>

          {mode === 'range' && (
            <div className="flex items-center gap-1.5 border rounded-lg p-1 pl-2 bg-card text-sm">
              <span className="text-muted-foreground">Desde</span>
              <input
                type="month"
                value={rangeFrom}
                max={currentMonth()}
                onChange={e => { if (e.target.value) setRangeFrom(e.target.value); }}
                aria-label="Mes inicial"
                className="h-8 w-[140px] bg-transparent font-bold text-center border-0 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
              />
              <span className="text-muted-foreground">hasta</span>
              <input
                type="month"
                value={rangeTo}
                max={currentMonth()}
                onChange={e => { if (e.target.value) setRangeTo(e.target.value); }}
                aria-label="Mes final"
                className="h-8 w-[140px] bg-transparent font-bold text-center border-0 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>
          )}

          {/* El mes es el filtro principal: además de las flechas hay que poder
              saltar a cualquier mes, y la flecha bloqueada tiene que decir por qué. */}
          {mode === 'month' && (<>
          <div className="flex items-center gap-1 border rounded-lg p-1 bg-card">
            <Button variant="ghost" size="icon" className="h-8 w-8"
              onClick={() => setMonth(m => shiftMonth(m, -1))} aria-label="Mes anterior">
              <ChevronLeft className="w-4 h-4" />
            </Button>

            {/* Input nativo y visible: su propio calendario abre el selector de mes.
                Un overlay invisible sobre un rótulo no sirve — en Chrome el clic
                sobre el campo no abre el picker, solo el ícono. */}
            <input
              type="month"
              value={month}
              max={currentMonth()}
              onChange={e => { if (e.target.value) setMonth(e.target.value); }}
              aria-label="Elegir mes"
              title="Elegir mes"
              className="h-8 w-[150px] bg-transparent text-sm font-bold text-center border-0 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
            />

            <span title={isCurrentMonth
              ? `${monthLabel(month)} es el mes en curso: no hay meses siguientes que consultar`
              : 'Mes siguiente'}>
              <Button variant="ghost" size="icon" className="h-8 w-8 disabled:opacity-25"
                disabled={isCurrentMonth}
                onClick={() => setMonth(m => shiftMonth(m, 1))} aria-label="Mes siguiente">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </span>
          </div>

          {!isCurrentMonth && (
            <Button variant="outline" size="sm" onClick={() => setMonth(currentMonth())}>
              Mes actual
            </Button>
          )}
          </>)}

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

          {/* Por entrenador: cruza quién quedó asignado a la sesión con quién
              efectivamente pasó la lista, así que sirve tanto para ver la carga
              de un coach como para detectar al que no está marcando. */}
          <Select value={coachFilter} onValueChange={setCoachFilter}>
            <SelectTrigger className="w-[210px] h-9">
              <SelectValue placeholder="Todos los entrenadores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los entrenadores</SelectItem>
              {coaches.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
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

      {rangeTooLong && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>El rango es demasiado largo</AlertTitle>
          <AlertDescription>
            Se pueden ver hasta 24 meses a la vez. Acorte el rango o use «Todo».
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
                <p className="font-semibold">Sin asistencias registradas {enPeriodo}</p>
                <p className="text-sm mt-1">
                  Las listas se pasan en Asistencias → Supervisión; lo que se marque ahí aparece acá.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="flex-wrap h-auto">
                {isRangeMode && (
                  <TabsTrigger value="mes" className="gap-2">
                    <BarChart3 className="w-4 h-4" /> Por mes
                  </TabsTrigger>
                )}
                <TabsTrigger value="atleta" className="gap-2">
                  <Users className="w-4 h-4" /> Por atleta
                </TabsTrigger>
                <TabsTrigger value="dia" className="gap-2">
                  <CalendarDays className="w-4 h-4" /> Por día
                </TabsTrigger>
                {!isRangeMode && (
                  <TabsTrigger value="matriz" className="gap-2">
                    <FileText className="w-4 h-4" /> Día por día
                  </TabsTrigger>
                )}
                {!isRangeMode && (
                  <TabsTrigger value="plan" className="gap-2">
                    <Percent className="w-4 h-4" /> Plan vs consumo
                    {desfases > 0 && (
                      <Badge variant="destructive" className="ml-1 h-4 px-1.5 text-[10px]">{desfases}</Badge>
                    )}
                  </TabsTrigger>
                )}
              </TabsList>

              {/* ── Por mes (solo en rango): primero la gráfica, después la tabla ── */}
              {isRangeMode && (
                <TabsContent value="mes" className="space-y-4">
                  <AttendanceRateByMonthChart points={monthPoints} />
                  <AthletesByMonthChart points={monthPoints} />
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">Detalle por mes</CardTitle>
                        <CardDescription>
                          {rangeMonths.length} mes{rangeMonths.length === 1 ? '' : 'es'} · % = (presentes + tarde) / registros
                        </CardDescription>
                      </div>
                      <Button variant="outline" size="sm" onClick={exportByMonth}>
                        <Download className="w-4 h-4 mr-1.5" /> CSV
                      </Button>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Mes</TableHead>
                            <TableHead className="text-right">Días con lista</TableHead>
                            <TableHead className="text-right">Deportistas</TableHead>
                            <TableHead className="text-right">Presentes</TableHead>
                            <TableHead className="text-right">Tarde</TableHead>
                            <TableHead className="text-right">Ausentes</TableHead>
                            <TableHead className="text-right">%</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rangeMonths.map(m => {
                            const r = monthRows.find(x => x.month === m);
                            if (!r || r.total === 0) {
                              return (
                                <TableRow key={m} className="text-muted-foreground">
                                  <TableCell className="font-semibold capitalize">{proseMonthLabel(m)}</TableCell>
                                  <TableCell colSpan={6} className="text-right text-xs">Sin lista ese mes</TableCell>
                                </TableRow>
                              );
                            }
                            return (
                              <TableRow key={m}>
                                <TableCell className="font-semibold capitalize">{proseMonthLabel(m)}</TableCell>
                                <TableCell className="text-right">{r.days}</TableCell>
                                <TableCell className="text-right">{r.athletes}</TableCell>
                                <TableCell className="text-right text-green-600 font-medium">{r.present}</TableCell>
                                <TableCell className="text-right text-amber-600">{r.late}</TableCell>
                                <TableCell className="text-right text-red-600 font-medium">{r.absent}</TableCell>
                                <TableCell className={cn('text-right font-black', rateColor(r.rate))}>
                                  {r.rate}%
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {/* ── Por atleta ─────────────────────────────────────────── */}
              <TabsContent value="atleta">
                <Card>
                  <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">
                        {isRangeMode ? 'Asistencia por atleta, mes a mes' : 'Asistencia del mes por atleta'}
                      </CardTitle>
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
                          {isRangeMode ? (
                            rangeMonths.map(m => (
                              <TableHead key={m} className="text-right whitespace-nowrap">{shortMonthLabel(m)}</TableHead>
                            ))
                          ) : (<>
                            <TableHead className="text-right">Presentes</TableHead>
                            <TableHead className="text-right">Tarde</TableHead>
                            <TableHead className="text-right">Excusadas</TableHead>
                            <TableHead className="text-right">Ausentes</TableHead>
                          </>)}
                          <TableHead className="text-right">Registros</TableHead>
                          <TableHead className="text-right">{isRangeMode ? 'Total' : '%'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {athletes.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={isRangeMode ? rangeMonths.length + 4 : 8}
                              className="text-center text-muted-foreground py-10">
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
                              {!!a.aliases?.length && (
                                <span className="block text-[11px] font-normal text-muted-foreground"
                                  title="Nombre con que la escuela la tenía precargada">
                                  antes: {a.aliases.join(' · ')}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">
                              {a.contexts.join(' · ') || '—'}
                            </TableCell>
                            {isRangeMode ? (
                              rangeMonths.map(m => {
                                const c = a.by_month?.[m];
                                if (!c || c.total === 0) {
                                  return <TableCell key={m} className="text-right text-muted-foreground/40">—</TableCell>;
                                }
                                const r = pct(c);
                                return (
                                  <TableCell key={m}
                                    className={cn('text-right font-semibold', rateColor(r))}
                                    title={`${proseMonthLabel(m)}: ${c.present} presentes, ${c.late} tarde, ${c.excused} excusadas, ${c.absent} ausentes`}>
                                    {r}%
                                  </TableCell>
                                );
                              })
                            ) : (<>
                              <TableCell className="text-right text-green-600 font-medium">{a.present}</TableCell>
                              <TableCell className="text-right text-amber-600">{a.late}</TableCell>
                              <TableCell className="text-right text-blue-600">{a.excused}</TableCell>
                              <TableCell className="text-right text-red-600 font-medium">{a.absent}</TableCell>
                            </>)}
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
                        Solo los días en que se pasó lista ({isRangeMode ? `${days.length} en total, ${enPeriodo}` : `${days.length} de ${monthLabel(month)}`}).
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
              {/* Matriz y plan solo dentro de un mes: el tope del plan es mensual. */}
              {!isRangeMode && (<>
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

              {/* Plan vs consumo */}
              <TabsContent value="plan">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Clases dictadas contra el plan pagado</CardTitle>
                    <CardDescription>
                      {desfases === 0
                        ? `Todos los atletas están dentro de su plan en ${monthLabel(month)}.`
                        : <>
                            <strong>{desfases}</strong> {desfases === 1 ? 'atleta entrenó' : 'atletas entrenaron'} por
                            fuera de lo contratado en {monthLabel(month)}, por un total de{' '}
                            <strong>${totalDesfase.toLocaleString('es-CO')}</strong> sin cobrar.
                            {' '}Son {data?.desfases?.clases_de_mas ?? 0} clases por encima del plan y{' '}
                            {data?.desfases?.clases_vencidas ?? 0} con el plan ya vencido.
                          </>}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {desfases === 0 ? (
                      <p className="text-sm text-muted-foreground py-8 text-center">
                        Sin desfases en {monthLabel(month)}.
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Atleta</TableHead>
                            <TableHead>Plan</TableHead>
                            <TableHead className="text-center">Pagó</TableHead>
                            <TableHead className="text-center">Asistió</TableHead>
                            <TableHead className="text-right">Valor clase</TableHead>
                            <TableHead>Por encima del plan</TableHead>
                            <TableHead>Sin plan vigente</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {desglose.map(a => {
                            const pl = a.plan!;
                            const base = {
                              athleteId: a.id, athleteType: a.athlete_type,
                              precioClase: pl.precio_clase ?? 0, teamId: pl.team_id,
                              planId: pl.plan_id, nombre: a.full_name,
                            };
                            return (
                              <TableRow key={a.id}>
                                <TableCell className="font-medium">{a.full_name}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {pl.nombre ?? <span className="text-red-600 font-semibold">Sin plan activo</span>}
                                  {pl.vence && <div className="text-[10px]">vence {pl.vence}</div>}
                                </TableCell>
                                <TableCell className="text-center">{pl.tope ?? '—'}</TableCell>
                                <TableCell className="text-center font-bold">{pl.asistidas}</TableCell>
                                <TableCell className="text-right text-xs">
                                  {pl.precio_clase ? `$${pl.precio_clase.toLocaleString('es-CO')}` : '—'}
                                </TableCell>
                                {(['excedente', 'vencidas'] as const).map(motivo => {
                                  const cubo = cuboDelPlan(pl, motivo);
                                  return (
                                    <TableCell key={motivo}>
                                      {cubo.clases === 0 ? (
                                        <span className="text-muted-foreground text-xs">—</span>
                                      ) : (
                                        <div className="flex flex-col gap-1 items-start">
                                          <div className="flex items-center gap-2">
                                            <Badge
                                              variant={motivo === 'excedente' ? 'destructive' : 'default'}
                                              className={cn(motivo === 'vencidas' && 'bg-amber-500/20 text-amber-700 border-amber-500/30')}>
                                              {cubo.clases} {cubo.clases === 1 ? 'clase' : 'clases'}
                                            </Badge>
                                            <span className="font-semibold text-sm">
                                              ${(cubo.valor ?? 0).toLocaleString('es-CO')}
                                            </span>
                                          </div>
                                          {cubo.fechas.length > 0 && (
                                            <span className="text-[10px] text-muted-foreground">
                                              {cubo.fechas.map(f => f.slice(8) + '/' + f.slice(5, 7)).join(', ')}
                                            </span>
                                          )}
                                          <Button
                                            size="sm" variant="outline" className="h-6 text-[10px] px-2"
                                            disabled={!pl.precio_clase || facturar.isPending}
                                            onClick={() => facturar.mutate([{ ...base, motivo, clases: cubo.clases, fechas: cubo.fechas }])}>
                                            Facturar
                                          </Button>
                                        </div>
                                      )}
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                  {desfases > 0 && (
                    <CardHeader className="border-t pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <CardDescription className="text-xs">
                        Cada concepto se factura por separado. Si ya existe un cobro para ese atleta,
                        ese mes y ese concepto, se omite — no se duplica.
                      </CardDescription>
                      <Button
                        disabled={facturar.isPending}
                        onClick={() => facturar.mutate(
                          desglose.flatMap(a => (['excedente', 'vencidas'] as const)
                            .map(m => ({ m, cubo: cuboDelPlan(a.plan, m) }))
                            .filter(({ cubo }) => cubo.clases > 0 && a.plan?.precio_clase)
                            .map(({ m, cubo }) => ({
                              athleteId: a.id, athleteType: a.athlete_type, motivo: m,
                              clases: cubo.clases, precioClase: a.plan!.precio_clase!,
                              teamId: a.plan!.team_id, planId: a.plan!.plan_id,
                              nombre: a.full_name, fechas: cubo.fechas,
                            })))
                        )}>
                        {facturar.isPending
                          ? 'Emitiendo…'
                          : `Facturar todo — $${totalDesfase.toLocaleString('es-CO')}`}
                      </Button>
                    </CardHeader>
                  )}
                </Card>
              </TabsContent>
              </>)}
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
