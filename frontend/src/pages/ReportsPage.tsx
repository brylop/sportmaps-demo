import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, Users, DollarSign, Loader2, AlertCircle } from 'lucide-react';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { bffClient } from '@/lib/api/bffClient';
import { formatCurrency } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function ReportsPage() {
  const { schoolId, activeBranchId } = useSchoolContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [occupancyData, setOccupancyData] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [growthData, setGrowthData] = useState<any[]>([]);

  const [summary, setSummary] = useState({
    occupancyRate: '0',
    totalStudents: 0,
    totalCapacity: 0,
    totalRevenue: 0,
    netGrowth: 0
  });

  useEffect(() => {
    if (!schoolId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const branchQuery = activeBranchId ? `?branch_id=${activeBranchId}` : '';
        const response = await bffClient.get<{
          summary: {
            occupancyRate: string;
            totalStudents: number;
            totalCapacity: number;
            totalRevenue: number;
            netGrowth: number;
          };
          charts: {
            occupancyData: any[];
            growthData: any[];
            revenueData: any[];
          };
        }>(`/api/v1/reports/school/summary${branchQuery}`);

        setSummary(response.summary);
        setOccupancyData(response.charts.occupancyData);
        setGrowthData(response.charts.growthData);
        setRevenueData(response.charts.revenueData);

      } catch (err: any) {
        console.error("Error fetching reports:", err);
        setError("Error cargando los reportes del servidor BFF.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [schoolId, activeBranchId]);

  if (loading) {
    return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reportes Gerenciales</h1>
        <p className="text-muted-foreground">Inteligencia de negocio y análisis estratégico (Datos Reales)</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error de Datos</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
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
                  <XAxis dataKey="name" angle={-15} textAnchor="end" height={80} interval={0} fontSize={12} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="occupied" stackId="a" fill="#22c55e" name="Ocupados" />
                  <Bar dataKey="vacant" stackId="a" fill="#ef4444" name="Vacantes" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No hay programas o estudiantes activos aún.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ingresos por Programa</CardTitle>
            <CardDescription>Distribución de ingresos</CardDescription>
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
                    label={(entry) => entry.name.length > 15 ? entry.name.substring(0, 12) + '...' : entry.name}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {revenueData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No hay pagos registrados para mostrar distribución.
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
          {growthData.some(m => m.nuevos > 0 || m.retiros > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="nuevos" stroke="#22c55e" strokeWidth={2} name="Nuevos" />
                <Line type="monotone" dataKey="retiros" stroke="#ef4444" strokeWidth={2} name="Retiros" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Registra estudiantes para ver la tendencia de crecimiento.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
