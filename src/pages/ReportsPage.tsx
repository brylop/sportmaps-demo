import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, Users, DollarSign } from 'lucide-react';

export default function ReportsPage() {
  const occupancyData = [
    { name: 'Fútbol Sub-12', occupied: 20, vacant: 0 },
    { name: 'Fútbol Sub-10', occupied: 18, vacant: 2 },
    { name: 'Tenis Infantil', occupied: 8, vacant: 4 },
    { name: 'Voleibol Juvenil', occupied: 8, vacant: 12 },
  ];

  const revenueData = [
    { name: 'Fútbol Sub-12', value: 3000000 },
    { name: 'Fútbol Sub-10', value: 2700000 },
    { name: 'Tenis Infantil', value: 1440000 },
    { name: 'Voleibol Juvenil', value: 1120000 },
  ];

  const growthData = [
    { month: 'Jul', nuevos: 12, retiros: 2 },
    { month: 'Ago', nuevos: 15, retiros: 3 },
    { month: 'Sep', nuevos: 10, retiros: 1 },
    { month: 'Oct', nuevos: 8, retiros: 4 },
  ];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  const totalRevenue = revenueData.reduce((sum, item) => sum + item.value, 0);
  const totalStudents = occupancyData.reduce((sum, item) => sum + item.occupied, 0);
  const totalCapacity = occupancyData.reduce((sum, item) => sum + item.occupied + item.vacant, 0);
  const occupancyRate = ((totalStudents / totalCapacity) * 100).toFixed(1);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reportes Gerenciales</h1>
        <p className="text-muted-foreground">Inteligencia de negocio y análisis estratégico</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ocupación Global</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{occupancyRate}%</div>
            <p className="text-xs text-muted-foreground">
              {totalStudents} de {totalCapacity} cupos
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
              ${(totalRevenue / 1000000).toFixed(1)}M
            </div>
            <p className="text-xs text-muted-foreground">Proyección mensual</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Crecimiento Neto</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">+4</div>
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
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={occupancyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-15} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="occupied" stackId="a" fill="#22c55e" name="Ocupados" />
                <Bar dataKey="vacant" stackId="a" fill="#ef4444" name="Vacantes" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ingresos por Programa</CardTitle>
            <CardDescription>Distribución de ingresos mensuales</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={revenueData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => entry.name}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {revenueData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reporte de Crecimiento</CardTitle>
          <CardDescription>Nuevos alumnos vs. retiros por mes</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={growthData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="nuevos" stroke="#22c55e" strokeWidth={2} name="Nuevos" />
              <Line type="monotone" dataKey="retiros" stroke="#ef4444" strokeWidth={2} name="Retiros" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
