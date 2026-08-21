import { useState, useEffect, useRef } from 'react';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { supabase } from '@/integrations/supabase/client';
import { bffClient } from '@/lib/api/bffClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Download, FileText, TrendingUp, TrendingDown, Users, DollarSign,
    Building, Activity, BarChart3, AlertCircle, CheckCircle, Clock,
    Printer, Calendar, ChevronRight, ChevronLeft, ChevronUp, ChevronDown,
    ChevronsUpDown, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';

// ─── Types ────────────────────────────────────────────────────────────────────
interface KPI {
    label: string;
    value: string | number;
    sub?: string;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
    color?: string;
}

interface StudentRow {
    id: string; full_name: string; team: string; plan: string; sede: string; status: string; fee: number; joined: string;
    sessions_attended: number | null; sessions_total: number | null;
}
interface PaymentRow {
    id: string; student: string; amount: number; amount_paid: number | null; status: string; month: string;
    team: string; plan: string; concept: string; due_date: string | null; payment_date: string | null; days: number | null;
}
interface CoachRow { id: string; name: string; email: string; team: string; sede: string; students: number; }
interface SedeRow { id: string; name: string; students: number; coaches: number; income: number; }
interface TeamRow { id: string; name: string; students: number; monthly_fee: number; revenue: number; }
interface PlanRow { id: string; name: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const currency = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);

// Diferencia en días entre dos 'YYYY-MM-DD' (b − a), positiva si b es posterior.
const daysBetweenDates = (a: string, b: string): number =>
    Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);

// `days` (due_date vs hoy) solo describe algo pendiente de cobrar. Un pago ya
// `paid` no sigue "vencido" aunque su due_date haya pasado — se cobró, tarde
// o no — así que necesita su propio mensaje en vez de heredar el de pending/overdue.
const formatDays = (p: Pick<PaymentRow, 'status' | 'days' | 'due_date' | 'payment_date'>): string => {
    if (p.status === 'paid') {
        if (p.due_date && p.payment_date) {
            const lateBy = daysBetweenDates(p.due_date, p.payment_date);
            if (lateBy <= 0) return 'Pagado a tiempo';
            return `Pagado con ${lateBy} día${lateBy === 1 ? '' : 's'} de atraso`;
        }
        return 'Pagado';
    }
    if (p.days === null) return '—';
    if (p.days > 0) return `Vencido hace ${p.days} día${p.days === 1 ? '' : 's'}`;
    if (p.days < 0) return `Vence en ${-p.days} día${-p.days === 1 ? '' : 's'}`;
    return 'Vence hoy';
};

const formatSessions = (attended: number | null, total: number | null): string =>
    attended === null || total === null ? '—' : `${attended}/${total}`;

// Orden genérico por columna: numérico si ambos valores son number, texto
// (localeCompare, sin distinguir mayúsculas) en cualquier otro caso. `null`
// siempre al final, sin importar la dirección — un dato ausente no es "menor".
function sortRows<T extends Record<string, any>>(rows: T[], sort: SortState): T[] {
    if (!sort.key) return rows;
    const key = sort.key;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
        const av = a[key];
        const bv = b[key];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
        return String(av).localeCompare(String(bv), 'es', { sensitivity: 'base' }) * dir;
    });
}

function toggleSort(current: SortState, key: string): SortState {
    if (current.key !== key) return { key, dir: 'asc' };
    return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
}

function exportCSV(filename: string, headers: string[], rows: (string | number)[][]) {
    const bom = '\uFEFF';
    const content = [
        headers.join(','),
        ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ kpi }: { kpi: KPI }) {
    const isUp = kpi.trend === 'up';
    const isDown = kpi.trend === 'down';
    return (
        <Card className="relative border-0 shadow-md bg-gradient-to-br from-card to-card/80">
            {/* La mancha decorativa necesita su propio `overflow-hidden` — ponerlo en
                la Card entera recortaba el valor del KPI cuando el número era largo
                (ej. moneda COP de 8+ dígitos en una tarjeta angosta a 7 columnas). */}
            <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
                <div className={`absolute top-0 right-0 w-20 h-20 rounded-bl-full opacity-10 ${kpi.color || 'bg-primary'}`} />
            </div>
            <CardContent className="relative p-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                <p className="text-xl sm:text-2xl font-bold mt-1 text-foreground truncate" title={String(kpi.value)}>{kpi.value}</p>
                {kpi.sub && <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>}
                {kpi.trendValue && (
                    <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${isUp ? 'text-green-600' : isDown ? 'text-red-500' : 'text-muted-foreground'}`}>
                        {isUp ? <ArrowUpRight className="w-3 h-3" /> : isDown ? <ArrowDownRight className="w-3 h-3" /> : null}
                        {kpi.trendValue}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ title, onExport, linkTo, linkLabel }: {
    title: string; onExport?: () => void; linkTo?: string; linkLabel?: string;
}) {
    return (
        <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <div className="flex gap-2">
                {linkTo && (
                    <Button asChild variant="ghost" size="sm" className="text-xs h-7">
                        <Link to={linkTo}>{linkLabel || 'Ver detalle'} <ChevronRight className="w-3 h-3 ml-1" /></Link>
                    </Button>
                )}
                {onExport && (
                    <Button variant="outline" size="sm" onClick={onExport} className="text-xs h-7 gap-1">
                        <Download className="w-3 h-3" /> CSV
                    </Button>
                )}
            </div>
        </div>
    );
}

// ─── Mini Table ───────────────────────────────────────────────────────────────
type MiniTableColumn = string | { label: string; key: string };
interface SortState { key: string | null; dir: 'asc' | 'desc'; }

function MiniTable({ headers, rows, sort, onSort }: {
    headers: MiniTableColumn[];
    rows: (string | number | React.ReactNode)[][];
    sort?: SortState;
    onSort?: (key: string) => void;
}) {
    const cols = headers.map(h => typeof h === 'string' ? { label: h, key: null as string | null } : h);
    return (
        <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-muted/50 border-b">
                        {cols.map(c => (
                            <th key={c.label} className="text-left text-xs font-semibold text-muted-foreground px-3 py-2 whitespace-nowrap">
                                {c.key && onSort ? (
                                    <button
                                        type="button"
                                        onClick={() => onSort(c.key!)}
                                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                                    >
                                        {c.label}
                                        {sort?.key === c.key
                                            ? (sort.dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
                                            : <ChevronsUpDown className="w-3 h-3 opacity-40" />}
                                    </button>
                                ) : c.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr><td colSpan={headers.length} className="text-center text-muted-foreground text-xs py-8">Sin datos</td></tr>
                    ) : (
                        rows.map((row, i) => (
                            <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                {row.map((cell, j) => (
                                    <td key={j} className="px-3 py-2 text-xs whitespace-nowrap">{cell}</td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

const PAGE_SIZE = 30;

// ─── Paginador ────────────────────────────────────────────────────────────────
function TablePager({ page, total, pageSize, onChange }: {
    page: number; total: number; pageSize: number; onChange: (page: number) => void;
}) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (totalPages <= 1) return null;
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);
    return (
        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
            <span>Mostrando {from}–{to} de {total}</span>
            <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => onChange(page - 1)}>
                    <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <span className="px-2">Página {page} de {totalPages}</span>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
                    <ChevronRight className="w-3.5 h-3.5" />
                </Button>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ReporterDashboardPage() {
    const { schoolId, schoolName, activeBranchId } = useSchoolContext();
    const [dateRange, setDateRange] = useState('30');
    const [teamFilter, setTeamFilter] = useState('all');
    const [planFilter, setPlanFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const printRef = useRef<HTMLDivElement>(null);

    // Data states
    const [kpis, setKpis] = useState<KPI[]>([]);
    const [students, setStudents] = useState<StudentRow[]>([]);
    const [payments, setPayments] = useState<PaymentRow[]>([]);
    const [coaches, setCoaches] = useState<CoachRow[]>([]);
    const [sedes, setSedes] = useState<SedeRow[]>([]);
    const [teams, setTeams] = useState<TeamRow[]>([]);
    const [plans, setPlans] = useState<PlanRow[]>([]);
    const [financesPage, setFinancesPage] = useState(1);
    const [studentsPage, setStudentsPage] = useState(1);
    const [financesSort, setFinancesSort] = useState<SortState>({ key: null, dir: 'asc' });
    const [studentsSort, setStudentsSort] = useState<SortState>({ key: null, dir: 'asc' });

    useEffect(() => {
        if (!schoolId) return;
        setFinancesPage(1);
        setStudentsPage(1);
        fetchAll();
    }, [schoolId, activeBranchId, dateRange, teamFilter, planFilter]);

    async function fetchAll() {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams({ days: dateRange });
            if (activeBranchId) {
                queryParams.append('branch_id', activeBranchId);
            }
            if (teamFilter !== 'all') queryParams.append('team_id', teamFilter);
            if (planFilter !== 'all') queryParams.append('offering_plan_id', planFilter);

            const res = await bffClient.get<{
                students: StudentRow[];
                payments: PaymentRow[];
                coaches: CoachRow[];
                sedes: SedeRow[];
                teams: TeamRow[];
                plans: PlanRow[];
                revenue_potential?: number;
                athletes_active?: number;
            }>(`/api/v1/reports/reporter/dashboard?${queryParams.toString()}`);

            // Process students for KPIs
            setStudents(res.students);
            // El potencial y el conteo de activos los calcula el BFF sobre TODOS los
            // atletas del alcance. `students` viene capado a 500 filas: sumar la lista
            // dejaba ambos KPIs cortos, en silencio, para escuelas con más atletas.
            // El `??` mantiene el comportamiento viejo si el BFF todavía no desplegó.
            const totalRevenuePotential = res.revenue_potential
                ?? res.students.reduce((s, r) => s + r.fee, 0);
            const active = res.athletes_active
                ?? res.students.filter(r => r.status === 'active').length;

            // Process payments for KPIs
            setPayments(res.payments);
            // Un pago `partial` sí tiene plata adentro: la parte abonada ya se
            // recaudó y el resto sigue por cobrar. Contarlo solo en un lado (o en
            // ninguno) es la mentira más común de un dashboard de cobros.
            const collected = res.payments.filter(r => r.status === 'paid').reduce((s, r) => s + r.amount, 0)
                + res.payments.filter(r => r.status === 'partial').reduce((s, r) => s + (r.amount_paid ?? 0), 0);
            const pending = res.payments.filter(r => r.status === 'pending').reduce((s, r) => s + r.amount, 0)
                + res.payments.filter(r => r.status === 'partial').reduce((s, r) => s + (r.amount - (r.amount_paid ?? 0)), 0);
            const overdue = res.payments.filter(r => r.status === 'overdue').length;

            // Process coaches and sedes
            setCoaches(res.coaches);
            setSedes(res.sedes);
            setTeams(res.teams);
            setPlans(res.plans || []);

            // Set all KPIs at once
            setKpis([
                { label: 'Deportistas Activos', value: active, sub: `${res.athletes_active ?? res.students.length} total`, trend: 'up', trendValue: 'Ver listado', color: 'bg-blue-500' },
                { label: 'Ingreso Potencial Mensual', value: currency(totalRevenuePotential), sub: 'Si todos pagan', trend: 'neutral', color: 'bg-green-500' },
                { label: 'Recaudado', value: currency(collected), sub: `Últimos ${dateRange} días`, trend: 'up', trendValue: `${res.payments.filter(r => r.status === 'paid').length} pagos`, color: 'bg-emerald-500' },
                { label: 'Por Cobrar', value: currency(pending), sub: 'Pendiente de pago', trend: 'neutral', color: 'bg-yellow-500' },
                { label: 'Morosos', value: overdue, sub: 'Con deuda vencida', trend: overdue > 0 ? 'down' : 'neutral', trendValue: overdue > 0 ? 'Requiere atención' : 'Al día', color: 'bg-red-500' },
                { label: 'Entrenadores', value: res.coaches.length, sub: 'Activos', color: 'bg-purple-500' },
                { label: 'Sedes', value: res.sedes.length, sub: 'Ubicaciones activas', color: 'bg-orange-500' }
            ]);

        } catch (err: any) {
            console.error("Error fetching reporter dashboard:", err);
            // Ignore for now, dashboard will show empty states
        } finally {
            setLoading(false);
        }
    }

    // ─── PDF Print ───────────────────────────────────────────────────────────────
    function handlePrint() {
        const printContent = printRef.current;
        if (!printContent) return;
        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write(`
      <!DOCTYPE html><html lang="es">
      <head>
        <meta charset="utf-8">
        <title>Reporte ${schoolName} – ${format(new Date(), 'dd/MM/yyyy')}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; background: #fff; padding: 24px; }
          h1 { font-size: 20px; color: #1a6118; margin-bottom: 4px; }
          h2 { font-size: 14px; font-weight: bold; margin: 16px 0 8px; color: #333; border-bottom: 1px solid #eee; padding-bottom: 4px; }
          .meta { font-size: 11px; color: #666; margin-bottom: 20px; }
          .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
          .kpi { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; }
          .kpi-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
          .kpi-value { font-size: 18px; font-weight: bold; color: #1a1a1a; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { background: #f3f4f6; text-align: left; padding: 6px 8px; font-size: 10px; font-weight: 600; color: #555; text-transform: uppercase; }
          td { padding: 6px 8px; border-bottom: 1px solid #f3f4f6; font-size: 11px; }
          tr:last-child td { border-bottom: none; }
          .footer { text-align: center; font-size: 10px; color: #999; margin-top: 30px; border-top: 1px solid #eee; padding-top: 12px; }
          @media print { body { padding: 0; } }
        </style>
      </head><body>
        <h1>📊 Reporte General — ${schoolName}</h1>
        <p class="meta">Generado el ${format(new Date(), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })} · Período: últimos ${dateRange} días</p>

        <h2>Indicadores Clave</h2>
        <div class="kpis">
          ${kpis.map(k => `<div class="kpi"><div class="kpi-label">${k.label}</div><div class="kpi-value">${k.value}</div>${k.sub ? `<div style="font-size:10px;color:#888;margin-top:2px">${k.sub}</div>` : ''}</div>`).join('')}
        </div>

        <h2>Deportistas (${students.length})</h2>
        <table>
          <tr><th>Nombre</th><th>Equipo</th><th>Plan</th><th>Sede</th><th>Estado</th><th>Mensualidad</th><th>Ingreso</th><th>Sesiones</th></tr>
          ${students.slice(0, 50).map(s => `<tr><td>${s.full_name}</td><td>${s.team}</td><td>${s.plan}</td><td>${s.sede}</td><td>${s.status === 'active' ? 'Activo' : 'Inactivo'}</td><td>${currency(s.fee)}</td><td>${s.joined}</td><td>${formatSessions(s.sessions_attended, s.sessions_total)}</td></tr>`).join('')}
        </table>

        <h2>Pagos — Últimos ${dateRange} días (${payments.length})</h2>
        <table>
          <tr><th>Deportista</th><th>Equipo</th><th>Plan</th><th>Mes</th><th>Monto</th><th>Estado</th><th>Días</th></tr>
          ${payments.slice(0, 50).map(p => `<tr><td>${p.student}</td><td>${p.team}</td><td>${p.plan}</td><td>${p.month}</td><td>${currency(p.amount)}</td><td>${p.status}</td><td>${formatDays(p)}</td></tr>`).join('')}
        </table>

        <h2>Sedes (${sedes.length})</h2>
        <table>
          <tr><th>Sede</th><th>Deportistas</th><th>Entrenadores</th><th>Ingresos</th></tr>
          ${sedes.map(s => `<tr><td>${s.name}</td><td>${s.students}</td><td>${s.coaches}</td><td>${currency(s.income)}</td></tr>`).join('')}
        </table>

        <h2>Equipos (${teams.length})</h2>
        <table>
          <tr><th>Equipo</th><th>Deportistas</th><th>Mensualidad</th><th>Ingreso Potencial</th></tr>
          ${teams.map(p => `<tr><td>${p.name}</td><td>${p.students}</td><td>${currency(p.monthly_fee)}</td><td>${currency(p.revenue)}</td></tr>`).join('')}
        </table>

        <h2>Entrenadores (${coaches.length})</h2>
        <table>
          <tr><th>Nombre</th><th>Email</th><th>Equipo</th><th>Sede</th></tr>
          ${coaches.map(c => `<tr><td>${c.name}</td><td>${c.email}</td><td>${c.team}</td><td>${c.sede}</td></tr>`).join('')}
        </table>

        <div class="footer">Reporte confidencial de solo lectura — SportMaps © ${new Date().getFullYear()}</div>
      </body></html>
    `);
        win.document.close();
        setTimeout(() => { win.print(); }, 400);
    }

    // ─── Status Badge ─────────────────────────────────────────────────────────
    function StatusBadge({ status }: { status: string }) {
        const map: Record<string, { label: string; className: string }> = {
            active: { label: 'Activo', className: 'bg-green-100 text-green-700' },
            inactive: { label: 'Inactivo', className: 'bg-gray-100 text-gray-600' },
            paid: { label: 'Pagado', className: 'bg-green-100 text-green-700' },
            pending: { label: 'Pendiente', className: 'bg-yellow-100 text-yellow-700' },
            overdue: { label: 'Vencido', className: 'bg-red-100 text-red-700' },
            partial: { label: 'Parcial', className: 'bg-orange-100 text-orange-700' },
        };
        const s = map[status] || { label: status, className: 'bg-muted text-muted-foreground' };
        return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.className}`}>{s.label}</span>;
    }

    const orderedKpis: KPI[] = [
        kpis.find(k => k.label === 'Deportistas Activos') || { label: 'Deportistas Activos', value: '—' },
        kpis.find(k => k.label === 'Recaudado') || { label: 'Recaudado', value: '—' },
        kpis.find(k => k.label === 'Por Cobrar') || { label: 'Por Cobrar', value: '—' },
        kpis.find(k => k.label === 'Morosos') || { label: 'Morosos', value: '—' },
        kpis.find(k => k.label === 'Ingreso Potencial Mensual') || { label: 'Ingreso Potencial Mensual', value: '—' },
        kpis.find(k => k.label === 'Entrenadores') || { label: 'Entrenadores', value: '—' },
        kpis.find(k => k.label === 'Sedes') || { label: 'Sedes', value: '—' },
    ].filter(Boolean);

    return (
        <div className="container mx-auto p-6 space-y-6 max-w-7xl" ref={printRef}>
            {/* ─── Header ─────────────────────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <BarChart3 className="w-6 h-6 text-primary" />
                        Panel de Reportes
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Vista de solo lectura · <span className="font-medium text-foreground">{schoolName}</span>
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                    <Select value={dateRange} onValueChange={setDateRange}>
                        <SelectTrigger className="w-40 h-9 text-sm">
                            <Calendar className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="30">Últimos 30 días</SelectItem>
                            <SelectItem value="60">Últimos 60 días</SelectItem>
                            <SelectItem value="90">Últimos 90 días</SelectItem>
                            <SelectItem value="180">Últimos 6 meses</SelectItem>
                            <SelectItem value="365">Último año</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={teamFilter} onValueChange={setTeamFilter}>
                        <SelectTrigger className="w-40 h-9 text-sm">
                            <Users className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                            <SelectValue placeholder="Equipo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los equipos</SelectItem>
                            {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={planFilter} onValueChange={setPlanFilter}>
                        <SelectTrigger className="w-40 h-9 text-sm">
                            <FileText className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                            <SelectValue placeholder="Plan" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los planes</SelectItem>
                            {plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2 h-9">
                        <Printer className="w-3.5 h-3.5" /> PDF / Imprimir
                    </Button>
                    <Button
                        onClick={() => exportCSV('reporte_general', ['Sección', 'Métrica', 'Valor'],
                            orderedKpis.map(k => ['KPI', k.label, String(k.value)])
                        )}
                        variant="outline" size="sm" className="gap-2 h-9"
                    >
                        <Download className="w-3.5 h-3.5" /> Exportar Todo
                    </Button>
                </div>
            </div>

            {/* ─── Read-Only Banner ───────────────────────────────────────────── */}
            <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-2.5">
                <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <p className="text-xs text-blue-700 dark:text-blue-300">
                    <strong>Modo Reporter:</strong> Vista de solo lectura. Los datos se actualizan en tiempo real pero no pueden modificarse desde aquí.
                </p>
            </div>

            {/* ─── KPI Grid ──────────────────────────────────────────────────── */}
            {loading ? (
                <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-7">
                    {Array.from({ length: 7 }).map((_, i) => (
                        <Card key={i} className="h-24 animate-pulse bg-muted/30" />
                    ))}
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
                    {orderedKpis.map((kpi, i) => <StatCard key={i} kpi={kpi} />)}
                </div>
            )}

            {/* ─── Tabs ──────────────────────────────────────────────────────── */}
            <Tabs defaultValue="finances" className="space-y-4">
                <TabsList className="flex-wrap h-auto gap-1">
                    <TabsTrigger value="finances" className="gap-1.5 text-xs">
                        <DollarSign className="w-3.5 h-3.5" /> Finanzas
                    </TabsTrigger>
                    <TabsTrigger value="students" className="gap-1.5 text-xs">
                        <Users className="w-3.5 h-3.5" /> Deportistas
                    </TabsTrigger>
                    <TabsTrigger value="sedes" className="gap-1.5 text-xs">
                        <Building className="w-3.5 h-3.5" /> Sedes
                    </TabsTrigger>
                    <TabsTrigger value="teams" className="gap-1.5 text-xs">
                        <Activity className="w-3.5 h-3.5" /> Equipos
                    </TabsTrigger>
                    <TabsTrigger value="coaches" className="gap-1.5 text-xs">
                        <Users className="w-3.5 h-3.5" /> Entrenadores
                    </TabsTrigger>
                </TabsList>

                {/* ── Finanzas ──────────────────────────────────────────────────── */}
                <TabsContent value="finances">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base">Movimientos Financieros</CardTitle>
                                    <CardDescription>Últimos {dateRange} días · {payments.length} registros</CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button asChild variant="ghost" size="sm" className="text-xs h-7">
                                        <Link to="/finances">Ver Finanzas <ChevronRight className="w-3 h-3 ml-1" /></Link>
                                    </Button>
                                    <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() =>
                                        exportCSV('finanzas', ['Deportista', 'Equipo', 'Plan', 'Mes', 'Monto', 'Estado', 'Días'],
                                            payments.map(p => [p.student, p.team, p.plan, p.month, p.amount, p.status, formatDays(p)])
                                        )
                                    }>
                                        <Download className="w-3 h-3" /> CSV
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {/* Summary row */}
                            <div className="grid grid-cols-3 gap-3 mb-4">
                                {[
                                    {
                                        label: 'Total Recaudado',
                                        value: currency(
                                            payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0)
                                            + payments.filter(p => p.status === 'partial').reduce((s, p) => s + (p.amount_paid ?? 0), 0)
                                        ),
                                        icon: CheckCircle, color: 'text-green-600 bg-green-50',
                                    },
                                    {
                                        label: 'Pendiente',
                                        value: currency(
                                            payments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0)
                                            + payments.filter(p => p.status === 'partial').reduce((s, p) => s + (p.amount - (p.amount_paid ?? 0)), 0)
                                        ),
                                        icon: Clock, color: 'text-yellow-600 bg-yellow-50',
                                    },
                                    { label: 'Vencido', value: currency(payments.filter(p => p.status === 'overdue').reduce((s, p) => s + p.amount, 0)), icon: AlertCircle, color: 'text-red-600 bg-red-50' },
                                ].map(item => (
                                    <div key={item.label} className={`flex items-center gap-3 p-3 rounded-lg ${item.color.split(' ')[1]}`}>
                                        <item.icon className={`w-4 h-4 ${item.color.split(' ')[0]}`} />
                                        <div>
                                            <p className="text-[10px] text-muted-foreground">{item.label}</p>
                                            <p className={`text-sm font-bold ${item.color.split(' ')[0]}`}>{item.value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <MiniTable
                                headers={[
                                    { label: 'Deportista', key: 'student' },
                                    { label: 'Equipo', key: 'team' },
                                    { label: 'Plan', key: 'plan' },
                                    { label: 'Mes', key: 'due_date' },
                                    { label: 'Monto', key: 'amount' },
                                    { label: 'Estado', key: 'status' },
                                    { label: 'Días', key: 'days' },
                                ]}
                                sort={financesSort}
                                onSort={key => { setFinancesSort(s => toggleSort(s, key)); setFinancesPage(1); }}
                                rows={sortRows(payments, financesSort)
                                    .slice((financesPage - 1) * PAGE_SIZE, financesPage * PAGE_SIZE)
                                    .map(p => [
                                        p.student, p.team, p.plan, p.month, currency(p.amount),
                                        <StatusBadge key={p.id} status={p.status} />,
                                        formatDays(p)
                                    ])}
                            />
                            <TablePager page={financesPage} total={payments.length} pageSize={PAGE_SIZE} onChange={setFinancesPage} />
                            {payments.length > PAGE_SIZE && (
                                <p className="text-xs text-muted-foreground text-center mt-2">Exporta CSV para ver todos los registros de una vez.</p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Deportistas ───────────────────────────────────────────────── */}
                <TabsContent value="students">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base">Listado de Deportistas</CardTitle>
                                    <CardDescription>{students.length} deportistas registrados</CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button asChild variant="ghost" size="sm" className="text-xs h-7">
                                        <Link to="/students">Ver Deportistas <ChevronRight className="w-3 h-3 ml-1" /></Link>
                                    </Button>
                                    <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() =>
                                        exportCSV('deportistas', ['Nombre', 'Equipo', 'Plan', 'Sede', 'Estado', 'Mensualidad', 'Ingreso', 'Sesiones'],
                                            students.map(s => [s.full_name, s.team, s.plan, s.sede, s.status, s.fee, s.joined, formatSessions(s.sessions_attended, s.sessions_total)])
                                        )
                                    }>
                                        <Download className="w-3 h-3" /> CSV
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <MiniTable
                                headers={[
                                    { label: 'Nombre', key: 'full_name' },
                                    { label: 'Equipo', key: 'team' },
                                    { label: 'Plan', key: 'plan' },
                                    { label: 'Sede', key: 'sede' },
                                    { label: 'Estado', key: 'status' },
                                    { label: 'Mensualidad', key: 'fee' },
                                    { label: 'Ingreso', key: 'joined' },
                                    { label: 'Sesiones', key: 'sessions_attended' },
                                ]}
                                sort={studentsSort}
                                onSort={key => { setStudentsSort(s => toggleSort(s, key)); setStudentsPage(1); }}
                                rows={sortRows(students, studentsSort)
                                    .slice((studentsPage - 1) * PAGE_SIZE, studentsPage * PAGE_SIZE)
                                    .map(s => [
                                        s.full_name, s.team, s.plan, s.sede,
                                        <StatusBadge key={s.id} status={s.status} />,
                                        currency(s.fee), s.joined, formatSessions(s.sessions_attended, s.sessions_total)
                                    ])}
                            />
                            <TablePager page={studentsPage} total={students.length} pageSize={PAGE_SIZE} onChange={setStudentsPage} />
                            {students.length > PAGE_SIZE && (
                                <p className="text-xs text-muted-foreground text-center mt-2">Exporta CSV para ver todos los registros de una vez.</p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Sedes ─────────────────────────────────────────────────────── */}
                <TabsContent value="sedes">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base">Resumen por Sede</CardTitle>
                                    <CardDescription>{sedes.length} sedes registradas</CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button asChild variant="ghost" size="sm" className="text-xs h-7">
                                        <Link to="/branches">Ver Sedes <ChevronRight className="w-3 h-3 ml-1" /></Link>
                                    </Button>
                                    <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() =>
                                        exportCSV('sedes', ['Sede', 'Deportistas', 'Entrenadores', 'Ingresos Recaudados'],
                                            sedes.map(s => [s.name, s.students, s.coaches, s.income])
                                        )
                                    }>
                                        <Download className="w-3 h-3" /> CSV
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 mb-4">
                                {sedes.map(sede => (
                                    <div key={sede.id} className="border rounded-xl p-4 space-y-3 hover:shadow-md transition-shadow">
                                        <div className="flex items-center justify-between">
                                            <p className="font-semibold text-sm">{sede.name}</p>
                                            <Building className="w-4 h-4 text-muted-foreground" />
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="text-center">
                                                <p className="text-lg font-bold text-blue-600">{sede.students}</p>
                                                <p className="text-[10px] text-muted-foreground">Deportistas</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-lg font-bold text-purple-600">{sede.coaches}</p>
                                                <p className="text-[10px] text-muted-foreground">Entrenadores</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-xs font-bold text-green-600">{sede.income > 0 ? currency(sede.income) : '—'}</p>
                                                <p className="text-[10px] text-muted-foreground">Ingresos</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Equipos ─────────────────────────────────────────────────── */}
                <TabsContent value="teams">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base">Equipos Activos</CardTitle>
                                    <CardDescription>{teams.length} equipos en la academia</CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button asChild variant="ghost" size="sm" className="text-xs h-7">
                                        <Link to="/teams">Ver Equipos <ChevronRight className="w-3 h-3 ml-1" /></Link>
                                    </Button>
                                    <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() =>
                                        exportCSV('equipos', ['Equipo', 'Deportistas', 'Mensualidad', 'Ingreso Potencial'],
                                            teams.map(p => [p.name, p.students, p.monthly_fee, p.revenue])
                                        )
                                    }>
                                        <Download className="w-3 h-3" /> CSV
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <MiniTable
                                headers={['Equipo', 'Deportistas', 'Mensualidad', 'Ingreso Potencial']}
                                rows={teams.map(p => [
                                    p.name,
                                    <span key={p.id} className="font-bold text-blue-600">{p.students}</span>,
                                    currency(p.monthly_fee),
                                    <span key={p.id + 'r'} className="font-semibold text-green-600">{currency(p.revenue)}</span>
                                ])}
                            />
                            {teams.length > 0 && (
                                <div className="mt-3 p-3 bg-muted/30 rounded-lg flex justify-between items-center">
                                    <span className="text-xs text-muted-foreground font-medium">Total Ingreso Potencial:</span>
                                    <span className="text-sm font-bold text-green-600">{currency(teams.reduce((s, p) => s + p.revenue, 0))}</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Entrenadores ──────────────────────────────────────────────── */}
                <TabsContent value="coaches">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base">Entrenadores y Staff</CardTitle>
                                    <CardDescription>{coaches.length} miembros del staff</CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button asChild variant="ghost" size="sm" className="text-xs h-7">
                                        <Link to="/staff">Ver Staff <ChevronRight className="w-3 h-3 ml-1" /></Link>
                                    </Button>
                                    <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() =>
                                        exportCSV('entrenadores', ['Nombre', 'Email', 'Equipo', 'Sede'],
                                            coaches.map(c => [c.name, c.email, c.team, c.sede])
                                        )
                                    }>
                                        <Download className="w-3 h-3" /> CSV
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <MiniTable
                                headers={['Nombre', 'Email', 'Equipo', 'Sede']}
                                rows={coaches.map(c => [c.name, c.email, c.team, c.sede])}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* ─── Footer ─────────────────────────────────────────────────────── */}
            <p className="text-center text-xs text-muted-foreground pb-2">
                Reporte de solo lectura · <FileText className="w-3 h-3 inline" /> Generado {format(new Date(), "dd/MM/yyyy HH:mm")} · SportMaps
            </p>
        </div>
    );
}
