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
    Printer, Calendar, ChevronRight, ArrowUpRight, ArrowDownRight
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

interface StudentRow { id: string; full_name: string; program: string; sede: string; status: string; fee: number; joined: string; }
interface PaymentRow { id: string; student: string; amount: number; status: string; month: string; program: string; }
interface CoachRow { id: string; name: string; email: string; program: string; sede: string; students: number; }
interface SedeRow { id: string; name: string; students: number; coaches: number; income: number; }
interface ProgramRow { id: string; name: string; students: number; monthly_fee: number; revenue: number; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const currency = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);

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
        <Card className="relative overflow-hidden border-0 shadow-md bg-gradient-to-br from-card to-card/80">
            <div className={`absolute top-0 right-0 w-20 h-20 rounded-bl-full opacity-10 ${kpi.color || 'bg-primary'}`} />
            <CardContent className="p-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                <p className="text-3xl font-bold mt-1 text-foreground">{kpi.value}</p>
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
function MiniTable({ headers, rows }: { headers: string[]; rows: (string | number | React.ReactNode)[][] }) {
    return (
        <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-muted/50 border-b">
                        {headers.map(h => (
                            <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-3 py-2 whitespace-nowrap">{h}</th>
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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ReporterDashboardPage() {
    const { schoolId, schoolName, activeBranchId } = useSchoolContext();
    const [dateRange, setDateRange] = useState('30');
    const [loading, setLoading] = useState(true);
    const printRef = useRef<HTMLDivElement>(null);

    // Data states
    const [kpis, setKpis] = useState<KPI[]>([]);
    const [students, setStudents] = useState<StudentRow[]>([]);
    const [payments, setPayments] = useState<PaymentRow[]>([]);
    const [coaches, setCoaches] = useState<CoachRow[]>([]);
    const [sedes, setSedes] = useState<SedeRow[]>([]);
    const [programs, setPrograms] = useState<ProgramRow[]>([]);

    useEffect(() => {
        if (!schoolId) return;
        fetchAll();
    }, [schoolId, activeBranchId, dateRange]);

    async function fetchAll() {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams({ days: dateRange });
            if (activeBranchId) {
                queryParams.append('branch_id', activeBranchId);
            }

            const res = await bffClient.get<{
                students: StudentRow[];
                payments: PaymentRow[];
                coaches: CoachRow[];
                sedes: SedeRow[];
                programs: ProgramRow[];
            }>(`/api/v1/reports/reporter/dashboard?${queryParams.toString()}`);

            // Process students for KPIs
            setStudents(res.students);
            const totalRevenuePotential = res.students.reduce((s, r) => s + r.fee, 0);
            const active = res.students.filter(r => r.status === 'active').length;

            // Process payments for KPIs
            setPayments(res.payments);
            const collected = res.payments.filter(r => r.status === 'paid').reduce((s, r) => s + r.amount, 0);
            const pending = res.payments.filter(r => r.status === 'pending').reduce((s, r) => s + r.amount, 0);
            const overdue = res.payments.filter(r => r.status === 'overdue').length;

            // Process coaches and sedes
            setCoaches(res.coaches);
            setSedes(res.sedes);
            setPrograms(res.programs);

            // Set all KPIs at once
            setKpis([
                { label: 'Estudiantes Activos', value: active, sub: `${res.students.length} total`, trend: 'up', trendValue: 'Ver listado', color: 'bg-blue-500' },
                { label: 'Ingreso Potencial Mes', value: currency(totalRevenuePotential), sub: 'Si todos pagan', trend: 'neutral', color: 'bg-green-500' },
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

        <h2>Estudiantes (${students.length})</h2>
        <table>
          <tr><th>Nombre</th><th>Programa</th><th>Sede</th><th>Estado</th><th>Mensualidad</th><th>Ingreso</th></tr>
          ${students.slice(0, 50).map(s => `<tr><td>${s.full_name}</td><td>${s.program}</td><td>${s.sede}</td><td>${s.status === 'active' ? 'Activo' : 'Inactivo'}</td><td>${currency(s.fee)}</td><td>${s.joined}</td></tr>`).join('')}
        </table>

        <h2>Pagos — Últimos ${dateRange} días (${payments.length})</h2>
        <table>
          <tr><th>Estudiante</th><th>Programa</th><th>Mes</th><th>Monto</th><th>Estado</th></tr>
          ${payments.slice(0, 50).map(p => `<tr><td>${p.student}</td><td>${p.program}</td><td>${p.month}</td><td>${currency(p.amount)}</td><td>${p.status}</td></tr>`).join('')}
        </table>

        <h2>Sedes (${sedes.length})</h2>
        <table>
          <tr><th>Sede</th><th>Estudiantes</th><th>Entrenadores</th><th>Ingresos</th></tr>
          ${sedes.map(s => `<tr><td>${s.name}</td><td>${s.students}</td><td>${s.coaches}</td><td>${currency(s.income)}</td></tr>`).join('')}
        </table>

        <h2>Programas (${programs.length})</h2>
        <table>
          <tr><th>Programa</th><th>Estudiantes</th><th>Mensualidad</th><th>Ingreso Potencial</th></tr>
          ${programs.map(p => `<tr><td>${p.name}</td><td>${p.students}</td><td>${currency(p.monthly_fee)}</td><td>${currency(p.revenue)}</td></tr>`).join('')}
        </table>

        <h2>Entrenadores (${coaches.length})</h2>
        <table>
          <tr><th>Nombre</th><th>Email</th><th>Programa</th><th>Sede</th></tr>
          ${coaches.map(c => `<tr><td>${c.name}</td><td>${c.email}</td><td>${c.program}</td><td>${c.sede}</td></tr>`).join('')}
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
        };
        const s = map[status] || { label: status, className: 'bg-muted text-muted-foreground' };
        return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.className}`}>{s.label}</span>;
    }

    const orderedKpis: KPI[] = [
        kpis.find(k => k.label === 'Estudiantes Activos') || { label: 'Estudiantes Activos', value: '—' },
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
                        <Users className="w-3.5 h-3.5" /> Estudiantes
                    </TabsTrigger>
                    <TabsTrigger value="sedes" className="gap-1.5 text-xs">
                        <Building className="w-3.5 h-3.5" /> Sedes
                    </TabsTrigger>
                    <TabsTrigger value="programs" className="gap-1.5 text-xs">
                        <Activity className="w-3.5 h-3.5" /> Programas
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
                                        exportCSV('finanzas', ['Estudiante', 'Programa', 'Mes', 'Monto', 'Estado'],
                                            payments.map(p => [p.student, p.program, p.month, p.amount, p.status])
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
                                    { label: 'Total Recaudado', value: currency(payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0)), icon: CheckCircle, color: 'text-green-600 bg-green-50' },
                                    { label: 'Pendiente', value: currency(payments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0)), icon: Clock, color: 'text-yellow-600 bg-yellow-50' },
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
                                headers={['Estudiante', 'Programa', 'Mes', 'Monto', 'Estado']}
                                rows={payments.slice(0, 30).map(p => [
                                    p.student, p.program, p.month, currency(p.amount),
                                    <StatusBadge key={p.id} status={p.status} />
                                ])}
                            />
                            {payments.length > 30 && (
                                <p className="text-xs text-muted-foreground text-center mt-2">Mostrando 30 de {payments.length}. Exporta CSV para ver todos.</p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Estudiantes ───────────────────────────────────────────────── */}
                <TabsContent value="students">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base">Listado de Estudiantes</CardTitle>
                                    <CardDescription>{students.length} estudiantes registrados</CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button asChild variant="ghost" size="sm" className="text-xs h-7">
                                        <Link to="/students">Ver Estudiantes <ChevronRight className="w-3 h-3 ml-1" /></Link>
                                    </Button>
                                    <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() =>
                                        exportCSV('estudiantes', ['Nombre', 'Programa', 'Sede', 'Estado', 'Mensualidad', 'Ingreso'],
                                            students.map(s => [s.full_name, s.program, s.sede, s.status, s.fee, s.joined])
                                        )
                                    }>
                                        <Download className="w-3 h-3" /> CSV
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <MiniTable
                                headers={['Nombre', 'Programa', 'Sede', 'Estado', 'Mensualidad', 'Ingreso']}
                                rows={students.slice(0, 30).map(s => [
                                    s.full_name, s.program, s.sede,
                                    <StatusBadge key={s.id} status={s.status} />,
                                    currency(s.fee), s.joined
                                ])}
                            />
                            {students.length > 30 && (
                                <p className="text-xs text-muted-foreground text-center mt-2">Mostrando 30 de {students.length}. Exporta CSV para ver todos.</p>
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
                                        exportCSV('sedes', ['Sede', 'Estudiantes', 'Entrenadores', 'Ingresos Recaudados'],
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
                                                <p className="text-[10px] text-muted-foreground">Estudiantes</p>
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

                {/* ── Programas ─────────────────────────────────────────────────── */}
                <TabsContent value="programs">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base">Programas Académicos</CardTitle>
                                    <CardDescription>{programs.length} programas activos</CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button asChild variant="ghost" size="sm" className="text-xs h-7">
                                        <Link to="/programs-management">Ver Programas <ChevronRight className="w-3 h-3 ml-1" /></Link>
                                    </Button>
                                    <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() =>
                                        exportCSV('programas', ['Programa', 'Estudiantes', 'Mensualidad', 'Ingreso Potencial'],
                                            programs.map(p => [p.name, p.students, p.monthly_fee, p.revenue])
                                        )
                                    }>
                                        <Download className="w-3 h-3" /> CSV
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <MiniTable
                                headers={['Programa', 'Estudiantes', 'Mensualidad', 'Ingreso Potencial']}
                                rows={programs.map(p => [
                                    p.name,
                                    <span key={p.id} className="font-bold text-blue-600">{p.students}</span>,
                                    currency(p.monthly_fee),
                                    <span key={p.id + 'r'} className="font-semibold text-green-600">{currency(p.revenue)}</span>
                                ])}
                            />
                            {programs.length > 0 && (
                                <div className="mt-3 p-3 bg-muted/30 rounded-lg flex justify-between items-center">
                                    <span className="text-xs text-muted-foreground font-medium">Total Ingreso Potencial:</span>
                                    <span className="text-sm font-bold text-green-600">{currency(programs.reduce((s, p) => s + p.revenue, 0))}</span>
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
                                        exportCSV('entrenadores', ['Nombre', 'Email', 'Programa', 'Sede'],
                                            coaches.map(c => [c.name, c.email, c.program, c.sede])
                                        )
                                    }>
                                        <Download className="w-3 h-3" /> CSV
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <MiniTable
                                headers={['Nombre', 'Email', 'Programa', 'Sede']}
                                rows={coaches.map(c => [c.name, c.email, c.program, c.sede])}
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
