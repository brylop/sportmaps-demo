import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, AlertCircle, Clock, CreditCard, TrendingUp, Download, Eye } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getDemoSchoolData, formatCurrency } from '@/lib/demo-data';

export default function PaymentsAutomationPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const demoData = getDemoSchoolData();
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [manualPayments, setManualPayments] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [recurringPayments, setRecurringPayments] = useState<any[]>([]);
  const [viewingProof, setViewingProof] = useState<{ open: boolean; url: string; student: string; amount: number }>({ open: false, url: '', student: '', amount: 0 });

  // Demo proof image for payments without a real uploaded image
  const DEMO_PROOF_URL = 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Receipt_sample.jpg/220px-Receipt_sample.jpg';

  // Only schools can access this page
  if (profile?.role !== 'school') {
    return <Navigate to="/dashboard" replace />;
  }

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

  const fetchTransactions = async () => {
    const { data: txData } = await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (txData) {
      setRecentTransactions(txData.map(t => ({
        id: t.id,
        student: 'Estudiante Demo',
        amount: t.amount,
        date: new Date(t.created_at).toLocaleDateString(),
        status: t.status === 'paid' ? 'success' : t.status === 'pending' ? 'pending' : 'failed'
      })));
    }
  };

  // Fetch data from Supabase
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch manual payments (pending)
        // We utilize RLS (assuming school can only see own payments) or explicit filter
        const { data: pendingData, error: pendingError } = await supabase
          .from('payments')
          .select('*')
          .eq('status', 'pending')
          // .eq('payment_method', 'transfer') // Optional: if we want to show all pending
          .order('created_at', { ascending: false });

        if (pendingData) {
          setManualPayments(pendingData.map(p => ({
            id: p.id,
            student: 'Estudiante Demo', // In real app, join with profiles/children
            team: 'Firesquad', // Mock for now
            amount: p.amount,
            file: 'Ver Comprobante',
            proof_url: p.receipt_url,
            payment_method: p.payment_method || p.payment_type // Handle both
          })));
        }

        // Fetch recent transactions (all)
        await fetchTransactions();

        // Mock report data and recurring payments for now
        setReport({
          by_teams: {
            Butterfly: { paid: 12, pending: 3, overdue: 1 },
            Firesquad: { paid: 15, pending: 2, overdue: 0 },
            Bombsquad: { paid: 8, pending: 4, overdue: 2 },
            Legends: { paid: 10, pending: 1, overdue: 0 },
          }
        });

        setRecurringPayments([
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
          }
        ]);

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleManualAction = async (id: string, action: 'approve' | 'reject') => {
    // Update Supabase
    const newStatus = action === 'approve' ? 'paid' : 'rejected';

    const { error } = await supabase
      .from('payments')
      .update({ status: newStatus })
      .eq('id', id);

    if (!error) {
      if (action === 'approve') {
        const payment = manualPayments.find(p => p.id === id);
        if (payment) {
          // Send email confirmation
          // 1. Fetch parent details (email, name)
          // We need to fetch from 'profiles' using parent_id from the payment record
          // But we don't have parent_id in 'manualPayments' state right now, let's fetch payment first

          const { data: fullPayment } = await supabase
            .from('payments')
            .select('*, profiles:parent_id(email, full_name)')
            .eq('id', id)
            .single();

          if (fullPayment && fullPayment.profiles) {
            const parentProfile = fullPayment.profiles as any; // Type assertion for brevity

            // Invoke Edge Function
            supabase.functions.invoke('send-payment-confirmation', {
              body: {
                userEmail: parentProfile.email,
                userName: parentProfile.full_name,
                amount: formatCurrency(fullPayment.amount),
                concept: fullPayment.concept,
                schoolName: 'Spirit All Stars', // Should be dynamic
                reference: fullPayment.receipt_number || `REF-${fullPayment.id.slice(0, 8)}`
              }
            }).then(({ error }) => {
              if (error) console.error("Error sending email:", error);
              else console.log("Email sent successfully");
            });
          }
        }
      }

      setManualPayments(prev => prev.filter(p => p.id !== id));
      toast({
        title: action === 'approve' ? '✅ Pago Aprobado' : '❌ Pago Rechazado',
        description: `El pago ha sido ${action === 'approve' ? 'validado' : 'rechazado'} correctamente. ${action === 'approve' ? 'Se ha notificado al padre por correo.' : ''}`,
        variant: action === 'approve' ? 'default' : 'destructive',
      });

      // Refresh transactions
      const { data: txData } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (txData) {
        setRecentTransactions(txData.map(t => ({
          id: t.id,
          student: 'Estudiante Demo',
          amount: t.amount,
          date: new Date(t.created_at).toLocaleDateString(),
          status: t.status === 'paid' ? 'success' : t.status === 'pending' ? 'pending' : 'failed'
        })));
      }
    } else {
      toast({
        title: "Error",
        description: "No se pudo actualizar el pago",
        variant: "destructive"
      });
    }
  };

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
                        <Button
                          variant="link"
                          size="sm"
                          className="p-0 text-blue-600 flex items-center gap-1"
                          onClick={() => setViewingProof({
                            open: true,
                            url: payment.proof_url || DEMO_PROOF_URL,
                            student: payment.student,
                            amount: payment.amount,
                          })}
                        >
                          <Eye className="h-3 w-3" />
                          Ver Comprobante
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

          {/* Proof Viewer Dialog */}
          <Dialog open={viewingProof.open} onOpenChange={(open) => setViewingProof(prev => ({ ...prev, open }))}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Comprobante de Pago</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                  <div>
                    <p className="font-semibold">{viewingProof.student}</p>
                    <p className="text-sm text-muted-foreground">Transferencia bancaria</p>
                  </div>
                  <p className="text-lg font-bold text-primary">{formatCurrency(viewingProof.amount)}</p>
                </div>
                <div className="border rounded-lg overflow-hidden bg-white">
                  <img
                    src={viewingProof.url}
                    alt={`Comprobante de pago - ${viewingProof.student}`}
                    className="w-full h-auto max-h-[60vh] object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = DEMO_PROOF_URL;
                    }}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (viewingProof.url) window.open(viewingProof.url, '_blank');
                    }}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Descargar
                  </Button>
                  <Button size="sm" onClick={() => setViewingProof(prev => ({ ...prev, open: false }))}>
                    Cerrar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
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
