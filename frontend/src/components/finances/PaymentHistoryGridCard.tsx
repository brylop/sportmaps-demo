import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatFilterBar } from '@/components/common/StatFilterBar';
import { TableRefreshBar } from '@/components/common/TableRefreshBar';

interface HistoryReport {
  meses: Array<{ year: number; month: number; label: string }>;
  count: number;
  items: Array<{
    athlete: string;
    tipo: 'menor' | 'adulto' | 'no_registrado';
    branch_id: string | null;
    al_dia: boolean;
    meses: Array<{ periodo: string; status: string }>;
  }>;
}

const HISTORY_PAGE_SIZE = 25;

const HISTORY_STATUS_STYLE: Record<string, string> = {
  paid: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  overdue: 'bg-red-100 text-red-800 border-red-300',
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  partial: 'bg-orange-100 text-orange-800 border-orange-300',
  awaiting_approval: 'bg-blue-100 text-blue-800 border-blue-300',
  glosado: 'bg-violet-100 text-violet-800 border-violet-300',
  sin_cobro: 'bg-muted text-muted-foreground border-transparent',
};
const HISTORY_STATUS_LABEL: Record<string, string> = {
  paid: 'Pagado',
  overdue: 'Vencido',
  pending: 'Pendiente',
  partial: 'Abono',
  awaiting_approval: 'En revisión',
  glosado: 'Glosa',
  sin_cobro: 'Sin cobro',
};

interface PaymentHistoryGridCardProps {
  schoolId: string | null | undefined;
  activeBranchId: string | null | undefined;
  onCount?: (n: number) => void;
}

/**
 * Historial de pagos — TODO el roster (deba o no), a diferencia de la
 * antigüedad que solo lista morosos. Sirve para auditar que quien está al
 * día de verdad tiene 2-3 meses pagados y no solo "sin cobro".
 */
export function PaymentHistoryGridCard({ schoolId, activeBranchId, onCount }: PaymentHistoryGridCardProps) {
  const {
    data: historyReport,
    isLoading: historyLoading,
    isFetching: historyFetching,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ['payment-history-grid', schoolId, activeBranchId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_school_payment_history_grid', {
        p_school_id: schoolId,
        p_branch_id: activeBranchId || null,
        p_months: 3,
      });
      if (error) throw error;
      return data as HistoryReport;
    },
    enabled: !!schoolId,
  });

  useEffect(() => { onCount?.(historyReport?.count ?? 0); }, [historyReport?.count, onCount]);

  const historyItems = historyReport?.items ?? [];
  const [historyFilter, setHistoryFilter] = useState<'al_dia' | 'con_problema' | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  useEffect(() => { setHistoryPage(1); }, [historyFilter, schoolId, activeBranchId]);

  const historyCounts = {
    al_dia: historyItems.filter(i => i.al_dia).length,
    con_problema: historyItems.filter(i => !i.al_dia).length,
  };
  const filteredHistory = historyFilter
    ? historyItems.filter(i => (historyFilter === 'al_dia' ? i.al_dia : !i.al_dia))
    : historyItems;
  const historyTotalPages = Math.max(1, Math.ceil(filteredHistory.length / HISTORY_PAGE_SIZE));
  const historyCurrentPage = Math.min(historyPage, historyTotalPages);
  const pagedHistory = filteredHistory.slice(
    (historyCurrentPage - 1) * HISTORY_PAGE_SIZE,
    historyCurrentPage * HISTORY_PAGE_SIZE,
  );

  return (
    <>
      <p className="text-sm text-muted-foreground mb-4">
        Todo el roster activo, deba o no — para confirmar que quien está al día
        de verdad tiene sus últimos meses pagados y correctos.
      </p>
      <div className="mb-4">
        <StatFilterBar
          columns={3}
          value={historyFilter}
          onChange={(v) => setHistoryFilter(v as 'al_dia' | 'con_problema' | null)}
          items={[
            { key: null, label: 'Todos', value: historyItems.length, tone: 'neutral' },
            { key: 'al_dia', label: 'Al día', value: historyCounts.al_dia, tone: 'emerald' },
            { key: 'con_problema', label: 'Con problema', value: historyCounts.con_problema, tone: 'rose' },
          ]}
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Atleta</TableHead>
            <TableHead>Tipo</TableHead>
            {(historyReport?.meses ?? []).map((m) => (
              <TableHead key={m.label} className="text-center">{m.label}</TableHead>
            ))}
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!historyLoading && pagedHistory.length === 0 && (
            <TableRow>
              <TableCell colSpan={3 + (historyReport?.meses.length ?? 3)} className="py-8 text-center text-sm text-muted-foreground">
                {historyFilter ? 'Nadie cae en este filtro.' : 'No hay atletas activos.'}
              </TableCell>
            </TableRow>
          )}
          {pagedHistory.map((item, idx) => (
            <TableRow key={`${item.athlete}-${idx}`}>
              <TableCell className="font-medium">{item.athlete}</TableCell>
              <TableCell className="capitalize">{item.tipo.replace('_', ' ')}</TableCell>
              {item.meses.map((m) => (
                <TableCell key={m.periodo} className="text-center">
                  <Badge
                    variant="outline"
                    className={HISTORY_STATUS_STYLE[m.status] ?? ''}
                    title={m.periodo}
                  >
                    {HISTORY_STATUS_LABEL[m.status] ?? m.status}
                  </Badge>
                </TableCell>
              ))}
              <TableCell>
                {item.al_dia ? (
                  <Badge className="bg-emerald-500 text-white">Al día</Badge>
                ) : (
                  <Badge variant="destructive">Con deuda</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TableRefreshBar
        className="-mx-6 -mb-6 mt-2 rounded-b-lg"
        onRefresh={refetchHistory}
        loading={historyFetching}
        summary={
          `${filteredHistory.length} atleta(s)` +
          (historyFilter ? ` de ${historyItems.length}` : '') +
          (historyTotalPages > 1 ? ` · página ${historyCurrentPage} de ${historyTotalPages}` : '')
        }
      >
        {historyTotalPages > 1 && (
          <>
            <Button variant="outline" size="sm" disabled={historyCurrentPage <= 1}
              onClick={() => setHistoryPage(historyCurrentPage - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={historyCurrentPage >= historyTotalPages}
              onClick={() => setHistoryPage(historyCurrentPage + 1)}>Siguiente</Button>
          </>
        )}
      </TableRefreshBar>
    </>
  );
}
