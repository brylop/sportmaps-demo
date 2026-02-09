import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, AlertCircle, Clock, CreditCard, TrendingUp, Download } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { getDemoSchoolData, formatCurrency } from '@/lib/demo-data';

export default function PaymentsAutomationPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const demoData = getDemoSchoolData();
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [manualPayments, setManualPayments] = useState([
    { id: 1, student: 'Santiago García', team: 'Firesquad', amount: 280000, file: 'ver_comprobante.jpg' }
  ]);

  // Only schools can access this page
  if (profile?.role !== 'school') {
    return <Navigate to="/dashboard" replace />;
  }

  const recurringPayments = [
    {
      id: 1,
      student: 'Sofía Ramírez',
      program: 'Butterfly (Junior Prep)',
      amount: 240000,
      nextCharge: '15 Feb 2025',
      status: 'active',
      method: 'Tarjeta **** 1234'
    },
    {
      id: 2,
      student: 'Mateo Torres',
      program: 'Firesquad (Senior L3)',
      amount: 280000,
      nextCharge: '20 Feb 2025',
      status: 'active',
      method: 'PSE - Bancolombia'
    },
    {
      id: 3,
      student: 'Lucas Martínez',
      program: 'Bombsquad (Coed L5)',
      amount: 350000,
      nextCharge: '18 Feb 2025',
      status: 'card_expiring',
      method: 'Tarjeta **** 5678'
    },
    {
      id: 4,
      student: 'Valentina Gómez',
      program: 'Legends (Open L6)',
      amount: 400000,
      nextCharge: '22 Feb 2025',
      status: 'active',
      method: 'Nequi'
    },
  ];

  const recentTransactions = [
    { id: 1, student: 'María López', amount: 180000, date: 'Hoy 10:30 AM', status: 'success' },
    { id: 2, student: 'Juan Pérez', amount: 220000, date: 'Ayer 3:45 PM', status: 'success' },
    { id: 3, student: 'Ana Rodríguez', amount: 200000, date: 'Hace 2 días', status: 'success' },
    { id: 4, student: 'Carlos Hernández', amount: 280000, date: 'Hace 3 días', status: 'failed' },
  ];

  const stats = [
    {
      label: 'Cobrado este mes',
      value: formatCurrency(demoData.monthly_revenue),
      change: '+24%',
      icon: TrendingUp
    },
    {
      label: 'Tasa de éxito',
      value: '98.5%',
      change: '+2.1%',
      icon: CheckCircle2
    },
    {
      label: 'Pagos pendientes',
      value: `${demoData.pending_payments}`,
      change: formatCurrency(560000),
      icon: Clock
    },
    {
      label: 'Próximo cobro',
      value: '15 Feb',
      change: formatCurrency(3200000),
      icon: CreditCard
    },
  ];

  const handleExport = () => {
    const headers = ['ID', 'Estudiante', 'Monto', 'Fecha', 'Estado'];

    const rows = recentTransactions.map(t => [
      t.id,
      t.student,
      t.amount,
      t.date,
      t.status === 'success' ? 'Exitoso' : 'Fallido'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `transacciones_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleManualAction = (id: number, action: 'approve' | 'reject') => {
    setManualPayments(prev => prev.filter(p => p.id !== id));
    toast({
      title: action === 'approve' ? '✅ Pago Aprobado' : '❌ Pago Rechazado',
      description: `El pago ha sido ${action === 'approve' ? 'validado' : 'rechazado'} y el estado del estudiante actualizado.`,
      variant: action === 'approve' ? 'default' : 'destructive',
    });
  };

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/payments/school/report/school_elite');
        const data = await response.json();
        if (data.success) {
          setReport(data.report);
        }
      } catch (error) {
        console.error('Error fetching report:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, []);

  const teams = ["Butterfly", "Firesquad", "Bombsquad", "Legends"];

  return (
    <div className="space-y-4 md:space-y-6 w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold truncate">💳 Cobros Automáticos</h1>
          <p className="text-sm md:text-base text-muted-foreground truncate">Gestiona los pagos recurrentes de tus estudiantes</p>
        </div>
        <Badge variant="default" className="text-xs md:text-sm w-fit">
          ✅ Plan Pro Activo
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs md:text-sm font-medium truncate">{stat.label}</CardTitle>
                <Icon className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
              </CardHeader>
              <CardContent>
                <div className="text-xl md:text-2xl font-bold truncate">{stat.value}</div>
                <p className="text-xs text-muted-foreground truncate">{stat.change}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Content */}
      <Tabs defaultValue="recurring" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recurring">Cobros Recurrentes</TabsTrigger>
          <TabsTrigger value="by-team">Vista por Equipos</TabsTrigger>
          <TabsTrigger value="transactions">Transacciones</TabsTrigger>
          <TabsTrigger value="settings">Configuración</TabsTrigger>
        </TabsList>

        <TabsContent value="recurring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Suscripciones Activas</CardTitle>
              <CardDescription>
                {recurringPayments.length} estudiantes con cobro automático activo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estudiante</TableHead>
                    <TableHead>Programa</TableHead>
                    <TableHead>Monto Mensual</TableHead>
                    <TableHead>Próximo Cobro</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recurringPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">{payment.student}</TableCell>
                      <TableCell>{payment.program}</TableCell>
                      <TableCell>{formatCurrency(payment.amount)}</TableCell>
                      <TableCell>{payment.nextCharge}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{payment.method}</TableCell>
                      <TableCell>
                        {payment.status === 'active' ? (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Activo
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Tarjeta vence pronto
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Payment Methods */}
          <Card>
            <CardHeader>
              <CardTitle>Métodos de Pago Integrados</CardTitle>
              <CardDescription>Acepta pagos con todos estos métodos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="border rounded-lg p-4 text-center">
                  <CreditCard className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="font-medium">PSE</p>
                  <p className="text-xs text-muted-foreground">Todos los bancos</p>
                </div>
                <div className="border rounded-lg p-4 text-center">
                  <CreditCard className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="font-medium">Tarjetas</p>
                  <p className="text-xs text-muted-foreground">Visa / Mastercard</p>
                </div>
                <div className="border rounded-lg p-4 text-center">
                  <CreditCard className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="font-medium">Nequi</p>
                  <p className="text-xs text-muted-foreground">Pago instantáneo</p>
                </div>
                <div className="border rounded-lg p-4 text-center">
                  <CreditCard className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="font-medium">Daviplata</p>
                  <p className="text-xs text-muted-foreground">Billetera digital</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-team" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {teams.map((team) => {
              const teamData = report?.by_teams[team] || { paid: 0, pending: 0, overdue: 0 };
              return (
                <Card key={team}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{team}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Pagados</span>
                      <Badge variant="default" className="bg-green-500">{teamData.paid}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Pendientes</span>
                      <Badge variant="secondary">{teamData.pending}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Vencidos</span>
                      <Badge variant="destructive">{teamData.overdue}</Badge>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full text-xs"
                      size="sm"
                      onClick={() => toast({ title: `👥 Atletas de ${team}`, description: 'Navegando a la lista de atletas del equipo...' })}
                    >
                      Ver Atletas
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Manual Payments Review */}
          <Card className="mt-6 border-blue-200 bg-blue-50/20">
            <CardHeader>
              <CardTitle className="text-blue-700 flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Validación de Pagos Manuales
              </CardTitle>
              <CardDescription>
                Pagos recibidos por transferencia que requieren aprobación manual
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estudiante</TableHead>
                    <TableHead>Equipo</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Comprobante</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manualPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">{payment.student}</TableCell>
                      <TableCell>{payment.team}</TableCell>
                      <TableCell>{formatCurrency(payment.amount)}</TableCell>
                      <TableCell>
                        <Button variant="link" size="sm" className="p-0 text-blue-600">
                          {payment.file}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                          onClick={() => handleManualAction(payment.id, 'approve')}
                        >
                          Aprobar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                          onClick={() => handleManualAction(payment.id, 'reject')}
                        >
                          Rechazar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {manualPayments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                        No hay pagos pendientes por validar
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Historial de Transacciones</CardTitle>
                <CardDescription>Todas las transacciones de los últimos 30 días</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estudiante</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-medium">{transaction.student}</TableCell>
                      <TableCell>{formatCurrency(transaction.amount)}</TableCell>
                      <TableCell className="text-muted-foreground">{transaction.date}</TableCell>
                      <TableCell>
                        {transaction.status === 'success' ? (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Exitoso
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Fallido
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuración de Cobros</CardTitle>
              <CardDescription>Personaliza cómo y cuándo se cobran los pagos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">Día de cobro mensual</h4>
                <p className="text-sm text-muted-foreground">Los cobros se procesaran automáticamente el día 15 de cada mes</p>
                <Button variant="outline">Cambiar fecha</Button>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Reintentos automáticos</h4>
                <p className="text-sm text-muted-foreground">Si un pago falla, se reintentará automáticamente después de 3 días</p>
                <Button variant="outline">Configurar</Button>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Notificaciones</h4>
                <p className="text-sm text-muted-foreground">Recibe notificaciones por email y WhatsApp de pagos exitosos y fallidos</p>
                <Button variant="outline">Gestionar notificaciones</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
