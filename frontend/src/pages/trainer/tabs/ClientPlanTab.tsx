import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { CreditCard, CheckCircle2, AlertCircle } from "lucide-react";

export function ClientPlanTab({ enrollment, payments }: { enrollment: any, payments: any[] }) {
  if (!enrollment) return null;

  const planName = enrollment.offering_plans?.name || 'Clases a Demanda';
  const billingCycle = enrollment.offering_plans?.billing_cycle || 'monthly';
  const planInfo = `${planName} (${billingCycle})`;

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" /> Plan Activo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-6">
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Detalle del Plan</div>
              <div className="font-bold text-lg">{planInfo}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Sesiones del ciclo</div>
              <div className="font-bold text-lg">{enrollment.sessions_used ?? 0} / {enrollment.offering_plans?.max_sessions ?? '∞'}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Estado de Facturación</div>
              <Badge className="bg-green-500 hover:bg-green-600">Al día</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h4 className="text-sm font-semibold flex items-center gap-2"><CreditCard className="w-4 h-4" /> Historial de Pagos (Últimos 5)</h4>
        
        {(!payments || payments.length === 0) ? (
          <div className="text-center p-8 border border-dashed rounded-lg text-muted-foreground">
            No se han registrado pagos para este cliente en el sistema.
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden border-border/50">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 border-b">Fecha</th>
                  <th className="px-4 py-3 border-b">Monto</th>
                  <th className="px-4 py-3 border-b">Método</th>
                  <th className="px-4 py-3 border-b">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">
                      {p.payment_date || p.due_date
                        ? new Date(p.payment_date ?? p.due_date).toLocaleDateString('es-CO')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">{formatCurrency(p.amount)} {p.currency}</td>
                    <td className="px-4 py-3 capitalize">{p.payment_method}</td>
                    <td className="px-4 py-3">
                      <Badge variant={p.status === 'completed' ? 'default' : 'secondary'}>{p.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 text-sm flex gap-3">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
        <p>Recuerda que la gestión central de pagos se realiza en la pestaña principal de "Negocio {'>'} Pagos". Para registrar nuevos abonos o enviar recordatorios, por favor dirígete a esa sección.</p>
      </div>
    </div>
  );
}
