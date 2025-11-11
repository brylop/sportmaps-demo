import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditCard, Download, Check, Clock, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Payment {
  id: string;
  concept: string;
  amount: number;
  status: string;
  due_date: string;
  payment_date?: string;
  receipt_url?: string;
  receipt_number?: string;
}

export default function PaymentsStripePage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Demo payments data
  const demoPayments: Payment[] = [
    {
      id: '1',
      concept: 'Mensualidad Fútbol Sub-12 - Junio 2024',
      amount: 250000,
      status: 'paid',
      due_date: '2024-06-05',
      payment_date: '2024-06-03',
      receipt_number: 'REC-2024-001',
      receipt_url: '#'
    },
    {
      id: '2',
      concept: 'Inscripción Tenis Infantil',
      amount: 150000,
      status: 'paid',
      due_date: '2024-06-01',
      payment_date: '2024-05-30',
      receipt_number: 'REC-2024-002',
      receipt_url: '#'
    },
    {
      id: '3',
      concept: 'Mensualidad Fútbol Sub-12 - Julio 2024',
      amount: 250000,
      status: 'pending',
      due_date: '2024-07-05'
    },
    {
      id: '4',
      concept: 'Material Deportivo',
      amount: 85000,
      status: 'overdue',
      due_date: '2024-05-20'
    }
  ];

  const [payments] = useState<Payment[]>(demoPayments);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <Badge className="bg-green-500">
            <Check className="w-3 h-3 mr-1" />
            Pagado
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1" />
            Pendiente
          </Badge>
        );
      case 'overdue':
        return (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
            Vencido
          </Badge>
        );
      default:
        return null;
    }
  };

  const handlePayment = async (paymentId: string, amount: number) => {
    // Demo Stripe integration
    toast({
      title: '💳 Procesando pago',
      description: 'Redirigiendo a la pasarela de pagos...',
    });

    // Simulate payment process
    setTimeout(() => {
      toast({
        title: '✅ Pago exitoso',
        description: 'Tu pago ha sido procesado correctamente',
      });
    }, 2000);
  };

  const totalPending = payments
    .filter(p => p.status === 'pending' || p.status === 'overdue')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalPaid = payments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Gestión de Pagos</h1>
        <p className="text-muted-foreground">
          Administra tus pagos y recibos
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pendiente de Pago</CardTitle>
            <Clock className="w-4 h-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalPending.toLocaleString('es-CO')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {payments.filter(p => p.status === 'pending' || p.status === 'overdue').length} pago(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Pagado</CardTitle>
            <Check className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalPaid.toLocaleString('es-CO')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {payments.filter(p => p.status === 'paid').length} pago(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Este Mes</CardTitle>
            <CreditCard className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$335,000</div>
            <p className="text-xs text-muted-foreground mt-1">
              3 pago(s)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Pagos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Concepto</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Fecha Vencimiento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{payment.concept}</p>
                      {payment.receipt_number && (
                        <p className="text-xs text-muted-foreground">
                          Recibo: {payment.receipt_number}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold">
                    ${payment.amount.toLocaleString('es-CO')}
                  </TableCell>
                  <TableCell>
                    {format(new Date(payment.due_date), 'PPP', { locale: es })}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(payment.status)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {payment.status === 'paid' && payment.receipt_url ? (
                        <Button variant="outline" size="sm">
                          <Download className="w-4 h-4 mr-1" />
                          Recibo
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handlePayment(payment.id, payment.amount)}
                        >
                          <CreditCard className="w-4 h-4 mr-1" />
                          Pagar Ahora
                        </Button>
                      )}
                    </div>
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
          <CardTitle>Métodos de Pago Disponibles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <CreditCard className="w-8 h-8 text-primary" />
              <div>
                <p className="font-semibold">Tarjeta de Crédito/Débito</p>
                <p className="text-xs text-muted-foreground">Visa, Mastercard, Amex</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#00A1E0"/>
              </svg>
              <div>
                <p className="font-semibold">PSE</p>
                <p className="text-xs text-muted-foreground">Pago desde tu banco</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="#009EE3">
                <circle cx="12" cy="12" r="10" />
              </svg>
              <div>
                <p className="font-semibold">Efectivo</p>
                <p className="text-xs text-muted-foreground">Pago en efectivo</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm">
              <strong>Nota:</strong> Todos los pagos son procesados de forma segura a través de nuestra pasarela de pagos.
              Recibirás un recibo digital por cada transacción exitosa.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
