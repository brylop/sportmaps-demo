import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, AlertCircle, TrendingUp } from 'lucide-react';
import { isOverdueCharge, isUpcomingCharge, type ChargeState } from '@/lib/paymentCartera';

interface FinancialSummaryCardsProps {
  payments: Array<ChargeState & { amount: number | string }> | undefined;
}

/** Las 3 tarjetas KPI de arriba de los tabs — siempre visibles, no son un tab más. */
export function FinancialSummaryCards({ payments }: FinancialSummaryCardsProps) {
  // Histórico a propósito: el acumulado del mes en curso vive en la tarjeta
  // "Ingresos del Mes" del Dashboard. El rótulo decía "(Mes)" pero la cuenta
  // nunca filtró por mes.
  const financialSummary = {
    totalIncome: payments?.filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount), 0) || 0,
    totalOverdue: payments?.filter(isOverdueCharge).reduce((sum, p) => sum + Number(p.amount), 0) || 0,
    pendingPayments: payments?.filter(isUpcomingCharge).reduce((sum, p) => sum + Number(p.amount), 0) || 0,
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Ingresado (Histórico)</CardTitle>
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
  );
}
