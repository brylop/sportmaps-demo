import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DollarSign, AlertCircle, TrendingUp, Mail } from 'lucide-react';

export default function FinancesPage() {
  const financialSummary = {
    totalIncome: 3200000,
    totalOverdue: 290000,
    pendingPayments: 140000,
  };

  const overdueAccounts = [
    {
      id: '1',
      parent: 'Carlos Vargas',
      student: 'Juan Vargas',
      concept: 'Mensualidad Oct',
      amount: 150000,
      daysOverdue: 5,
    },
    {
      id: '2',
      parent: 'Elena Torres',
      student: 'Camila Torres',
      concept: 'Mensualidad Oct',
      amount: 140000,
      daysOverdue: 2,
    },
  ];

  const recentTransactions = [
    {
      id: '1',
      date: '2024-10-28',
      parent: 'María González',
      concept: 'Mensualidad Oct',
      amount: 300000,
      method: 'Transferencia',
    },
    {
      id: '2',
      date: '2024-10-27',
      parent: 'Pedro Sánchez',
      concept: 'Matrícula',
      amount: 200000,
      method: 'Efectivo',
    },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Finanzas</h1>
        <p className="text-muted-foreground">Panel de control financiero</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ingresado (Mes)</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              ${financialSummary.totalIncome.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vencido</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              ${financialSummary.totalOverdue.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos Pendientes</CardTitle>
            <TrendingUp className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">
              ${financialSummary.pendingPayments.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Cuentas por Cobrar - Acción Requerida
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Padre</TableHead>
                <TableHead>Estudiante</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead>Monto Vencido</TableHead>
                <TableHead>Días</TableHead>
                <TableHead>Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overdueAccounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">{account.parent}</TableCell>
                  <TableCell>{account.student}</TableCell>
                  <TableCell>{account.concept}</TableCell>
                  <TableCell className="text-red-500 font-bold">
                    ${account.amount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="destructive">{account.daysOverdue} días</Badge>
                  </TableCell>
                  <TableCell>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        // Simulate sending reminder
                        alert(`Recordatorio enviado a ${account.parent}`);
                      }}
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      Enviar Recordatorio
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Transacciones Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Padre</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Método</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>
                    {new Date(transaction.date).toLocaleDateString('es-ES')}
                  </TableCell>
                  <TableCell>{transaction.parent}</TableCell>
                  <TableCell>{transaction.concept}</TableCell>
                  <TableCell className="font-bold text-green-500">
                    ${transaction.amount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{transaction.method}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
