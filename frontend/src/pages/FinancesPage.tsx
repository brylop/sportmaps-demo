import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DollarSign, AlertCircle, TrendingUp, MessageCircle, CheckCircle2, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ReminderHistoryModal, ReminderRecord } from '@/components/finances/ReminderHistoryModal';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { todayColombia, daysDiffFromToday } from '@/lib/dateUtils';

interface OverdueAccount {
  id: string;
  parent: string;
  student: string;
  concept: string;
  amount: number;
  daysOverdue: number;
  status: 'overdue' | 'reminder_sent';
  lastContactDate?: string;
}

interface Transaction {
  id: string;
  date: string;
  parent: string;
  concept: string;
  amount: number;
  method: string;
}

export default function FinancesPage() {
  const { toast } = useToast();
  const { schoolId, activeBranchId } = useSchoolContext();
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Fetch payments from Supabase — filtrado por school_id y branch
  const { data: payments, isLoading } = useQuery({
    queryKey: ['school-payments-all', schoolId, activeBranchId],
    queryFn: async () => {
      let query = supabase
        .from('payments')
        .select(`
          id,
          amount,
          status,
          due_date,
          payment_date,
          concept,
          student:children(full_name),
          parent:profiles!payments_parent_id_fkey(full_name) 
        `)
        .order('due_date', { ascending: false });

      if (schoolId) query = query.eq('school_id', schoolId);
      if (activeBranchId) query = query.eq('branch_id', activeBranchId);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!schoolId,
  });

  // Calculate Aggregates
  const financialSummary = {
    totalIncome: payments?.filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount), 0) || 0,
    totalOverdue: payments?.filter(p => p.status === 'overdue' || (p.status === 'pending' && p.due_date < todayColombia())).reduce((sum, p) => sum + Number(p.amount), 0) || 0,
    pendingPayments: payments?.filter(p => p.status === 'pending' && p.due_date >= todayColombia()).reduce((sum, p) => sum + Number(p.amount), 0) || 0,
  };

  // Map Overdue Accounts
  const accountsData = payments?.filter(p => p.status === 'overdue' || (p.status === 'pending' && p.due_date < todayColombia())) || [];

  const [overdueAccounts, setOverdueAccounts] = useState<OverdueAccount[]>([]);

  // Update effect to sync state
  useEffect(() => {
    if (accountsData) {
      setOverdueAccounts(accountsData.map(p => ({
        id: p.id,
        parent: (Array.isArray(p.parent) ? p.parent[0]?.full_name : p.parent?.full_name) || 'Desconocido',
        student: (Array.isArray(p.student) ? p.student[0]?.full_name : p.student?.full_name) || 'Estudiante',
        concept: p.concept,
        amount: Number(p.amount),
        daysOverdue: daysDiffFromToday(p.due_date),
        status: 'overdue'
      })));
    }
  }, [payments]);


  // Map Recent Transactions
  const recentTransactions = payments?.filter(p => p.status === 'paid').slice(0, 5).map(p => ({
    id: p.id,
    date: p.payment_date || p.due_date,
    parent: (Array.isArray(p.parent) ? p.parent[0]?.full_name : p.parent?.full_name) || 'Desconocido',
    concept: p.concept,
    amount: Number(p.amount),
    method: 'Transferencia' // Default as method might not be in query yet
  })) || [];

  const [reminderHistory, setReminderHistory] = useState<ReminderRecord[]>([]);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  const handleSendReminder = async (accountId: string) => {
    setSendingReminder(accountId);

    // Simulate WhatsApp notification
    await new Promise(resolve => setTimeout(resolve, 1500));

    const account = overdueAccounts.find(a => a.id === accountId);
    if (!account) return;

    const now = new Date().toISOString();

    // Add to reminder history
    const newReminder: ReminderRecord = {
      id: `reminder-${Date.now()}`,
      parent: account.parent,
      student: account.student,
      amount: account.amount,
      sentAt: now,
      channel: 'whatsapp',
    };
    setReminderHistory(prev => [newReminder, ...prev]);

    // Update account status
    setOverdueAccounts(prev => prev.map(a =>
      a.id === accountId
        ? { ...a, status: 'reminder_sent' as const, lastContactDate: now }
        : a
    ));

    setSendingReminder(null);

    // Show WhatsApp simulation toast
    toast({
      title: '📱 Recordatorio WhatsApp enviado',
      description: `Se envió recordatorio de pago a ${account.parent} por $${account.amount.toLocaleString()}`,
    });
  };

  const getStatusBadge = (account: OverdueAccount) => {
    if (account.status === 'reminder_sent') {
      return (
        <div className="flex flex-col gap-1">
          <Badge className="bg-yellow-500 text-white gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Recordatorio Enviado
          </Badge>
          {account.lastContactDate && (
            <span className="text-xs text-muted-foreground">
              Último: {new Date(account.lastContactDate).toLocaleDateString('es-CO')}
            </span>
          )}
        </div>
      );
    }
    return <Badge variant="destructive">{account.daysOverdue} días vencido</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Finanzas</h1>
          <p className="text-muted-foreground">Panel de control financiero</p>
        </div>
        <Button variant="outline" onClick={() => setShowHistoryModal(true)}>
          <History className="mr-2 h-4 w-4" />
          Ver Historial de Recordatorios
        </Button>
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
                <TableHead>Estado</TableHead>
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
                    {getStatusBadge(account)}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={account.status === 'reminder_sent' ? 'ghost' : 'outline'}
                      onClick={() => handleSendReminder(account.id)}
                      disabled={sendingReminder === account.id}
                      className={account.status === 'reminder_sent' ? 'text-green-600' : ''}
                    >
                      {sendingReminder === account.id ? (
                        <>
                          <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                          Enviando...
                        </>
                      ) : account.status === 'reminder_sent' ? (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Reenviar
                        </>
                      ) : (
                        <>
                          <MessageCircle className="mr-2 h-4 w-4" />
                          Enviar WhatsApp
                        </>
                      )}
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

      {/* Reminder History Modal */}
      <ReminderHistoryModal
        open={showHistoryModal}
        onOpenChange={setShowHistoryModal}
        reminders={reminderHistory}
      />
    </div>
  );
}
