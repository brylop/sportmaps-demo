import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, Users, DollarSign, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSchoolContext } from '@/hooks/useSchoolContext';
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
        // 1. Fetch Students/Enrollments for Occupancy & Growth
        const enrollmentsQuery = supabase
          .from('enrollments')
          .select('status, created_at, teams(name, capacity)');

        // Note: We'd need to filter by school_id, but enrollments link to programs which link to schools.
        // For simplicity/performance, we might assume the RLS handles filtered view or join programs.
        // Better: Join programs and filter by school_id

        const { data: enrollments, error: enrollError } = await supabase
          .from('enrollments')
          .select(`
            status, 
            created_at, 
            teams!inner (
              name, 
              max_students, 
              school_id,
              branch_id
            )
          `)
          .eq('teams.school_id', schoolId) as any;

        if (enrollError) throw enrollError;

        // Filter by branch if active
        const filteredEnrollments = activeBranchId
          ? enrollments.filter((e: any) => e.teams.branch_id === activeBranchId)
          : enrollments || [];

        // --- Process Occupancy ---
        const programMap = new Map<string, { occupied: number, capacity: number }>();
        let totalStudents = 0;
        let totalCapacity = 0;

        filteredEnrollments.forEach((e: any) => {
          if (e.status === 'active') {
            const pName = e.teams?.name || 'Varios';
            const pCap = e.teams?.max_students || 20; // Default capacity if missing

            if (!programMap.has(pName)) {
              programMap.set(pName, { occupied: 0, capacity: pCap });
              totalCapacity += pCap; // Add capacity only once per program? 
              // Wait, capacity is per program. 
              // We should sum capacities of UNIQUE programs.
            }

            // Increment occupied
            const current = programMap.get(pName)!;
            current.occupied += 1;
            totalStudents++;
          }
        });

        // Correction for Total Capacity: fetch all teams to get true capacity sum
        // (The loop above only counts teams that have at least 1 student)
        let progsQuery = supabase.from('teams').select('name, max_students').eq('school_id', schoolId);
        if (activeBranchId) progsQuery = progsQuery.eq('branch_id', activeBranchId);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: allPrograms } = await progsQuery as any;

        let realTotalCapacity = 0;
        const finalOccupancyData: any[] = [];

        if (allPrograms) {
          allPrograms.forEach(p => {
            realTotalCapacity += (p.max_students || 0);
            // Verify if we counted detailed students
            const foundObserved = programMap.get(p.name);
            finalOccupancyData.push({
              name: p.name,
              occupied: foundObserved ? foundObserved.occupied : 0,
              vacant: (p.max_students || 0) - (foundObserved ? foundObserved.occupied : 0)
            });
          });
        }

        setOccupancyData(finalOccupancyData.slice(0, 10)); // Top 10

        // --- Process Growth (Last 6 Months) ---
        const growthMap = new Map<string, { nuevos: number, retiros: number }>();
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const now = new Date();

        // Init last 6 months
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const mKey = `${months[d.getMonth()]}`;
          growthMap.set(mKey, { nuevos: 0, retiros: 0 });
        }

        filteredEnrollments.forEach((e: any) => {
          const d = new Date(e.created_at);
          const mKey = `${months[d.getMonth()]}`;
          if (growthMap.has(mKey)) {
            if (e.status === 'active') growthMap.get(mKey)!.nuevos++;
            else if (e.status === 'inactive' || e.status === 'dropped') growthMap.get(mKey)!.retiros++;
          }
        });

        const finalGrowthData = Array.from(growthMap.entries()).map(([month, data]) => ({
          month,
          ...data
        }));
        setGrowthData(finalGrowthData);

        // --- Process Revenue ---
        let paymentsQuery = supabase
          .from('payments')
          .select('amount, status, created_at, concept')
          .eq('school_id', schoolId)
          .eq('status', 'paid');

        if (activeBranchId) paymentsQuery = paymentsQuery.eq('branch_id', activeBranchId); // Assuming column exists or we rely on RLS/inference

        const { data: payments, error: payError } = await paymentsQuery;
        if (payError) {
          console.warn("Could not load payments details:", payError);
          // Don't crash, just show 0
        }

        const validPayments = payments || [];
        let revenueSum = 0;
        const revenueByConcept = new Map<string, number>();

        validPayments.forEach((p: any) => {
          const amt = Number(p.amount) || 0;
          revenueSum += amt;

          // Simple grouping by concept words (e.g. "Mensualidad X")
          // Improve: link to program_id if possible
          const conceptShort = p.concept?.split('-')[0]?.trim() || 'General';
          revenueByConcept.set(conceptShort, (revenueByConcept.get(conceptShort) || 0) + amt);
        });

        const finalRevenueData = Array.from(revenueByConcept.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5);

        setRevenueData(finalRevenueData);

        setSummary({
          occupancyRate: realTotalCapacity > 0 ? ((totalStudents / realTotalCapacity) * 100).toFixed(1) : '0',
          totalStudents,
          totalCapacity: realTotalCapacity,
          totalRevenue: revenueSum,
          netGrowth: filteredEnrollments.filter((e: any) =>
            new Date(e.created_at).getMonth() === new Date().getMonth() && e.status === 'active'
          ).length
        });

      } catch (err: any) {
        console.error("Error fetching reports:", err);
        setError("Error cargando los datos. Asegúrate de ejecutar el script de corrección de Pagos.");
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
