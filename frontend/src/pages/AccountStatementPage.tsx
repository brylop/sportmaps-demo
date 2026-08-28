import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Statement {
  athlete_name: string;
  summary: {
    count_expected: number; total_expected: number;
    count_settled: number;  total_settled: number;
    count_open: number;     total_open: number;
    total_late_fees: number;
  };
  meses: Array<{ periodo: string; status: string | null }>;
  events: Array<{
    tipo: 'pago' | 'sesion'; fecha: string; status: string | null;
    amount: number | null; amount_paid: number | null; attendance_status: string | null;
  }>;
}

const STATUS_LABELS: Record<string, string> = {
  paid: 'Pagado', partial: 'Abono parcial', pending: 'Pendiente', overdue: 'Vencido',
  awaiting_approval: 'En revisión', glosado: 'En aclaración', cancelled: 'Cancelado', rejected: 'Rechazado',
};

export default function AccountStatementPage() {
  const { schoolId } = useSchoolContext();
  const [searchParams] = useSearchParams();
  const childId = searchParams.get('child_id') || undefined;
  const userId = searchParams.get('user_id') || undefined;
  const unregisteredId = searchParams.get('unregistered_athlete_id') || undefined;
  const months = Number(searchParams.get('months') || 12);

  const { data, isLoading, error } = useQuery({
    queryKey: ['account-statement', schoolId, childId, userId, unregisteredId, months],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_athlete_account_statement', {
        p_school_id: schoolId,
        p_child_id: childId || null,
        p_user_id: userId || null,
        p_unregistered_athlete_id: unregisteredId || null,
        p_months: months,
      });
      if (error) throw error;
      return data as Statement;
    },
    enabled: !!schoolId && !!(childId || userId || unregisteredId),
  });

  const handlePrint = () => {
    if (!data) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const generated = new Date().toLocaleString('es-CO');
    const mesesRows = data.meses.map((m) => `<tr><td>${m.periodo}</td><td>${STATUS_LABELS[m.status || ''] || 'Sin cobro'}</td></tr>`).join('');
    const eventRows = data.events.map((ev) => `
      <tr>
        <td>${new Date(ev.fecha).toLocaleDateString('es-CO')}</td>
        <td>${ev.tipo === 'pago' ? 'Pago' : 'Sesión'}</td>
        <td>${ev.tipo === 'pago' ? (STATUS_LABELS[ev.status || ''] || ev.status) : (ev.attendance_status || '')}</td>
        <td>${ev.tipo === 'pago' && ev.amount != null ? formatCurrency(ev.amount) : ''}</td>
      </tr>`).join('');

    win.document.write(`
<!DOCTYPE html><html lang="es">
<head>
  <meta charset="utf-8">
  <title>Estado de Cuenta — ${data.athlete_name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; background: #fff; padding: 28px; }
    .header h1 { font-size: 20px; color: #1a3d6b; }
    .meta { font-size: 11px; color: #666; margin: 6px 0 22px; }
    h2 { font-size: 12px; font-weight: 700; margin: 20px 0 8px; color: #1a3d6b;
         border-bottom: 2px solid #e8eef5; padding-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 24px; }
    .kpi { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; }
    .kpi-label { font-size: 9px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; }
    .kpi-value { font-size: 20px; font-weight: 700; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 11px; }
    th { background: #f3f4f6; text-align: left; padding: 6px 8px; font-size: 9px; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: 0.4px; }
    td { padding: 6px 8px; border-bottom: 1px solid #f3f4f6; }
    tr:nth-child(even) td { background: #fafafa; }
    .footer { text-align: center; font-size: 10px; color: #aaa; margin-top: 36px; border-top: 1px solid #e5e7eb; padding-top: 14px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header"><h1>Estado de Cuenta — ${data.athlete_name}</h1></div>
  <p class="meta">Generado el ${generated} · últimos ${months} meses en el detalle (el resumen es histórico completo)</p>

  <h2>Resumen</h2>
  <div class="kpis">
    <div class="kpi"><div class="kpi-label">Facturado</div><div class="kpi-value">${formatCurrency(data.summary.total_expected)}</div></div>
    <div class="kpi"><div class="kpi-label">Cobrado</div><div class="kpi-value">${formatCurrency(data.summary.total_settled)}</div></div>
    <div class="kpi"><div class="kpi-label">Saldo pendiente</div><div class="kpi-value">${formatCurrency(data.summary.total_open)}</div></div>
    <div class="kpi"><div class="kpi-label">Mora aplicada</div><div class="kpi-value">${formatCurrency(data.summary.total_late_fees)}</div></div>
  </div>

  <h2>Meses (últimos ${months})</h2>
  <table><thead><tr><th>Período</th><th>Estado</th></tr></thead><tbody>${mesesRows}</tbody></table>

  <h2>Detalle — pagos y sesiones</h2>
  <table><thead><tr><th>Fecha</th><th>Tipo</th><th>Estado</th><th>Monto</th></tr></thead><tbody>${eventRows}</tbody></table>

  <div class="footer">SportMaps — Estado de cuenta generado automáticamente.</div>
</body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); }, 400);
  };

  if (isLoading) {
    return <div className="p-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando estado de cuenta...</div>;
  }
  if (error || !data) {
    return <div className="p-8 text-sm text-destructive">No se pudo cargar el estado de cuenta. {(error as any)?.message}</div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-xl font-semibold">{data.athlete_name}</h1>
          <p className="text-sm text-muted-foreground">Estado de cuenta — últimos {months} meses en el detalle, resumen histórico completo.</p>
        </div>
        <Button variant="outline" onClick={handlePrint}><Printer className="h-4 w-4 mr-2" />Imprimir</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="py-3"><p className="text-xs text-muted-foreground">Facturado</p><p className="text-lg font-bold">{formatCurrency(data.summary.total_expected)}</p></CardContent></Card>
        <Card><CardContent className="py-3"><p className="text-xs text-muted-foreground">Cobrado</p><p className="text-lg font-bold text-emerald-600">{formatCurrency(data.summary.total_settled)}</p></CardContent></Card>
        <Card><CardContent className="py-3"><p className="text-xs text-muted-foreground">Saldo pendiente</p><p className="text-lg font-bold text-red-500">{formatCurrency(data.summary.total_open)}</p></CardContent></Card>
        <Card><CardContent className="py-3"><p className="text-xs text-muted-foreground">Mora aplicada</p><p className="text-lg font-bold text-orange-600">{formatCurrency(data.summary.total_late_fees)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Meses (últimos {months})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Período</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.meses.map((m, idx) => (
                <TableRow key={idx}>
                  <TableCell>{m.periodo}</TableCell>
                  <TableCell>{m.status ? <Badge variant="outline">{STATUS_LABELS[m.status] || m.status}</Badge> : <span className="text-xs text-muted-foreground">Sin cobro</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Detalle — pagos y sesiones</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Tipo</TableHead><TableHead>Estado</TableHead><TableHead>Monto</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.events.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">Sin movimientos en este rango.</TableCell></TableRow>
              ) : data.events.map((ev, idx) => (
                <TableRow key={idx}>
                  <TableCell>{new Date(ev.fecha).toLocaleDateString('es-CO')}</TableCell>
                  <TableCell className="capitalize">{ev.tipo}</TableCell>
                  <TableCell>{ev.tipo === 'pago' ? (STATUS_LABELS[ev.status || ''] || ev.status) : ev.attendance_status}</TableCell>
                  <TableCell>{ev.tipo === 'pago' && ev.amount != null ? formatCurrency(ev.amount) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
