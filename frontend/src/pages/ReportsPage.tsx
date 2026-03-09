import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import { TrendingUp, Users, DollarSign, Loader2, AlertCircle, RefreshCw, Printer, Download } from 'lucide-react';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { supabase } from '@/integrations/supabase/client';
import { bffClient } from '@/lib/api/bffClient';
import { formatCurrency } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// ─── Tipos ─────────────────────────────────────────────────────────────────────
interface SummaryData {
  occupancyRate: string;
  totalStudents: number;
  totalCapacity: number;
  totalRevenue: number;
  netGrowth: number;
}

interface ChartData {
  occupancyData: { name: string; occupied: number; vacant: number }[];
  growthData: { month: string; nuevos: number; retiros: number }[];
  revenueData: { name: string; value: number }[];
}

// ─── Fallback: carga los datos directamente desde Supabase ─────────────────────
// Se usa cuando el BFF falla (p.ej. el header x-school-id no llega al middleware)
async function fetchReportsFromSupabase(
  schoolId: string,
  branchId?: string | null,
): Promise<{ summary: SummaryData; charts: ChartData }> {

  // 1. Equipos activos
  let teamsQ = supabase
    .from('teams')
    .select('id, name, max_students')
    .eq('school_id', schoolId)
    .eq('status', 'active');
  if (branchId) teamsQ = teamsQ.eq('branch_id', branchId);
  const { data: teams } = await teamsQ;

  const programCapMap = new Map<string, number>();
  let totalCapacity = 0;
  (teams || []).forEach((t: any) => {
    const cap = t.max_students || 0;
    totalCapacity += cap;
    programCapMap.set(t.name, (programCapMap.get(t.name) || 0) + cap);
  });

  // 2. Inscripciones (enrollments)
  let enrollQ = supabase
    .from('enrollments')
    .select('status, created_at, teams!inner(name, school_id, branch_id)')
    .eq('teams.school_id', schoolId) as any;
  if (branchId) enrollQ = enrollQ.eq('teams.branch_id', branchId);
  const { data: enrollments } = await enrollQ;

  const programOccMap = new Map<string, number>();
  let totalStudents = 0;
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  let netGrowthThisMonth = 0;

  const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const growthMap = new Map<string, { nuevos: number; retiros: number; sortKey: number }>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    growthMap.set(MONTHS[d.getMonth()], { nuevos: 0, retiros: 0, sortKey: d.getTime() });
  }

  (enrollments || []).forEach((e: any) => {
    const pName = e.teams?.name || 'Varios';
    const d = new Date(e.created_at);
    const mKey = MONTHS[d.getMonth()];

    if (e.status === 'active') {
      programOccMap.set(pName, (programOccMap.get(pName) || 0) + 1);
      totalStudents++;
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        netGrowthThisMonth++;
      }
      if (growthMap.has(mKey)) growthMap.get(mKey)!.nuevos++;
    } else if (e.status === 'inactive' || e.status === 'dropped') {
      if (growthMap.has(mKey)) growthMap.get(mKey)!.retiros++;
    }
  });

  const occupancyData = Array.from(programCapMap.entries()).map(([name, capacity]) => ({
    name,
    occupied: programOccMap.get(name) || 0,
    vacant: Math.max(0, capacity - (programOccMap.get(name) || 0)),
  })).slice(0, 10);

  const growthData = Array.from(growthMap.entries())
    .sort((a, b) => a[1].sortKey - b[1].sortKey)
    .map(([month, d]) => ({ month, nuevos: d.nuevos, retiros: d.retiros }));

  // 3. Pagos confirmados
  let payQ = supabase
    .from('payments')
    .select('amount, concept')
    .eq('school_id', schoolId)
    .eq('status', 'paid');
  if (branchId) payQ = payQ.eq('branch_id', branchId);
  const { data: payments } = await payQ;

  let totalRevenue = 0;
  const revMap = new Map<string, number>();
  (payments || []).forEach((p: any) => {
    const amt = Number(p.amount) || 0;
    totalRevenue += amt;
    const concept = p.concept?.split('-')[0]?.trim() || 'General';
    revMap.set(concept, (revMap.get(concept) || 0) + amt);
  });

  const revenueData = Array.from(revMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return {
    summary: {
      occupancyRate: totalCapacity > 0
        ? ((totalStudents / totalCapacity) * 100).toFixed(1)
        : '0',
      totalStudents,
      totalCapacity,
      totalRevenue,
      netGrowth: netGrowthThisMonth,
    },
    charts: { occupancyData, growthData, revenueData },
  };
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function ReportsPage() {
  const { schoolId, activeBranchId } = useSchoolContext();

  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<'bff' | 'supabase' | null>(null);
  const [bffError, setBffError] = useState<string | null>(null);

  const [summary, setSummary] = useState<SummaryData>({
    occupancyRate: '0', totalStudents: 0,
    totalCapacity: 0, totalRevenue: 0, netGrowth: 0,
  });
  const [occupancyData, setOccupancyData] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [growthData, setGrowthData] = useState<any[]>([]);

  const exportCSV = () => {
    const rows: string[] = [
      '=== REPORTE SPORTMAPS ===',
      `Generado: ${new Date().toLocaleString('es-CO')}`,
      '',
      '-- RESUMEN --',
      `Ocupación Global,${summary.occupancyRate}%`,
      `Total Estudiantes,${summary.totalStudents}`,
      `Capacidad Total,${summary.totalCapacity}`,
      `Ingresos Confirmados,${formatCurrency(summary.totalRevenue)}`,
      `Crecimiento Neto (mes),${summary.netGrowth}`,
      '',
      '-- OCUPACIÓN POR PROGRAMA --',
      'Programa,Ocupados,Vacantes',
      ...occupancyData.map(r => `${r.name},${r.occupied},${r.vacant}`),
      '',
      '-- INGRESOS POR PROGRAMA --',
      'Programa,Monto',
      ...revenueData.map(r => `${r.name},${r.value}`),
      '',
      '-- CRECIMIENTO (6 MESES) --',
      'Mes,Nuevos,Retiros',
      ...growthData.map(r => `${r.month},${r.nuevos},${r.retiros}`),
    ];
    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-sportmaps-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadData = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    setBffError(null);

    // ── Intento 1: BFF ───────────────────────────────────────────────────────
    try {
      const branchQuery = activeBranchId ? `?branch_id=${activeBranchId}` : '';
      const response = await bffClient.get<{
        summary: SummaryData;
        charts: { occupancyData: any[]; growthData: any[]; revenueData: any[] };
      }>(`/api/v1/reports/school/summary${branchQuery}`);

      setSummary(response.summary);
      setOccupancyData(response.charts.occupancyData);
      setGrowthData(response.charts.growthData);
      setRevenueData(response.charts.revenueData);
      setDataSource('bff');
      setLoading(false);
      return;

    } catch (bffErr: any) {
      // Guardar el mensaje real para diagnóstico; no interrumpir el flujo
      const msg = bffErr?.response?.data?.error
        || bffErr?.message
        || 'Error desconocido del BFF';
      setBffError(msg);
      console.warn('[ReportsPage] BFF falló, usando fallback Supabase directo:', msg);
    }

    // ── Intento 2: Supabase directo (fallback) ───────────────────────────────
    try {
      const result = await fetchReportsFromSupabase(schoolId, activeBranchId);
      setSummary(result.summary);
      setOccupancyData(result.charts.occupancyData);
      setGrowthData(result.charts.growthData);
      setRevenueData(result.charts.revenueData);
      setDataSource('supabase');
    } catch (supaErr: any) {
      console.error('[ReportsPage] Fallback Supabase también falló:', supaErr);
    } finally {
      setLoading(false);
    }
  }, [schoolId, activeBranchId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Cargando reportes…</p>
      </div>
    );
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  return (
    <div className="container mx-auto p-6 space-y-6">

      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Reportes Gerenciales</h1>
          <p className="text-muted-foreground">
            Inteligencia de negocio y análisis estratégico
          </p>
        </div>
        <div className="flex items-center gap-2">

          <Button
            variant="outline"
            size="sm"
            className="gap-2 h-8"
            onClick={exportCSV}
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 h-8"
            onClick={() => window.print()}
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 h-8"
            onClick={exportCSV}
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 h-8"
            onClick={() => window.print()}
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 h-8"
            onClick={loadData}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Actualizar
          </Button>
        </div>
      </div>



      {/* Banner crítico: ambas fuentes fallaron */}
      {bffError && dataSource === null && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error al cargar reportes</AlertTitle>
          <AlertDescription className="text-xs mt-1">
            Ni el BFF ni Supabase respondieron correctamente.{' '}
            <strong>Detalle BFF:</strong> {bffError}.{' '}
            Verifica tu conexión y que la escuela esté activa en el contexto.
          </AlertDescription>
        </Alert>
      )}

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ocupación Global</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.occupancyRate}%</div>
            <p className="text-xs text-muted-foreground">
              {summary.totalStudents} de {summary.totalCapacity} cupos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Mensuales</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {formatCurrency(summary.totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">Confirmados este mes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Crecimiento Neto</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">+{summary.netGrowth}</div>
            <p className="text-xs text-muted-foreground">Estudiantes este mes</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Gráficas ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Reporte de Ocupación por Programa</CardTitle>
            <CardDescription>Cupos ocupados vs. disponibles</CardDescription>
          </CardHeader>
          <CardContent>
            {occupancyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={occupancyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    angle={-15}
                    textAnchor="end"
                    height={80}
                    interval={0}
                    fontSize={12}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="occupied" stackId="a" fill="#22c55e" name="Ocupados" />
                  <Bar dataKey="vacant" stackId="a" fill="#ef4444" name="Vacantes" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground gap-2">
                <Users className="w-10 h-10 opacity-30" />
                <p className="text-sm">No hay programas o estudiantes activos aún.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ingresos por Programa</CardTitle>
            <CardDescription>Distribución de ingresos confirmados</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={revenueData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) =>
                      entry.name.length > 15
                        ? entry.name.substring(0, 12) + '...'
                        : entry.name
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {revenueData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground gap-2">
                <DollarSign className="w-10 h-10 opacity-30" />
                <p className="text-sm">No hay pagos registrados para mostrar distribución.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reporte de Crecimiento</CardTitle>
          <CardDescription>Nuevos alumnos vs. retiros (Últimos 6 meses)</CardDescription>
        </CardHeader>
        <CardContent>
          {growthData.some((m) => m.nuevos > 0 || m.retiros > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="nuevos"
                  stroke="#22c55e"
                  strokeWidth={2}
                  name="Nuevos"
                />
                <Line
                  type="monotone"
                  dataKey="retiros"
                  stroke="#ef4444"
                  strokeWidth={2}
                  name="Retiros"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground gap-2">
              <TrendingUp className="w-10 h-10 opacity-30" />
              <p className="text-sm">Registra estudiantes para ver la tendencia de crecimiento.</p>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
