import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { CreditCard, CheckCircle2, AlertCircle, Calendar, Clock } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

const BILLING_CYCLE: Record<string, string> = {
  monthly:    'Mensual',
  weekly:     'Semanal',
  biweekly:   'Quincenal',
  quarterly:  'Trimestral',
  yearly:     'Anual',
  per_session:'Por sesión',
  one_time:   'Pago único',
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  paid:             'Pagado',
  completed:        'Pagado',
  pending:          'Pendiente',
  awaiting_approval:'En aprobación',
  overdue:          'Vencido',
  failed:           'Fallido',
  rejected:         'Rechazado',
  cancelled:        'Cancelado',
};

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T12:00:00-05:00').getTime();
  return Math.ceil((target - Date.now()) / 86400000);
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ── Componente ────────────────────────────────────────────────────────────────

export function ClientPlanTab({
  enrollment,
  payments,
  ptSummary,
}: {
  enrollment: any;
  payments:   any[];
  ptSummary?: any;
}) {
  if (!enrollment) return null;

  const planName     = enrollment.offering_plans?.name ?? 'Clases a Demanda';
  const billingCycle = enrollment.offering_plans?.billing_cycle;
  const cycleLabel   = billingCycle ? BILLING_CYCLE[billingCycle] ?? billingCycle : null;

  // Sesiones
  const sessionsUsed      = ptSummary?.sessions_used      ?? enrollment.sessions_used      ?? 0;
  const sessionsCompleted = ptSummary?.sessions_completed ?? null;
  const maxSessions       = ptSummary?.max_sessions       ?? enrollment.offering_plans?.max_sessions ?? null;
  const isUnlimited       = ptSummary?.is_unlimited       ?? maxSessions === null;

  // Vencimiento
  const expiresAt = ptSummary?.expires_at ?? enrollment.expires_at ?? null;
  const daysLeft  = daysUntil(expiresAt);

  // Pago
  const lastPayment = payments?.[0];
  const billingStatus = !lastPayment
    ? { label: 'Sin pagos', cls: 'bg-muted text-muted-foreground' }
    : ['paid', 'completed'].includes(lastPayment.status)
      ? { label: 'Al día',    cls: 'bg-green-500 hover:bg-green-600 text-white' }
      : lastPayment.status === 'overdue'
        ? { label: 'Vencido',   cls: 'bg-red-500 hover:bg-red-600 text-white' }
        : ['pending', 'awaiting_approval'].includes(lastPayment.status)
          ? { label: 'Pendiente', cls: 'bg-amber-500 hover:bg-amber-600 text-white' }
          : { label: lastPayment.status, cls: 'bg-muted text-muted-foreground' };

  return (
    <div className="space-y-6">

      {/* Plan activo */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" /> Plan Activo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Plan</p>
              <p className="font-bold text-base leading-tight">{planName}</p>
              {cycleLabel && (
                <p className="text-xs text-muted-foreground mt-0.5">{cycleLabel}</p>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Sesiones</p>
              <p className="font-bold text-base">
                {sessionsCompleted ?? sessionsUsed} / {isUnlimited ? '∞' : (maxSessions ?? '—')}
              </p>
              {!isUnlimited && maxSessions && (
                <div className="mt-1.5 h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, ((sessionsCompleted ?? sessionsUsed) / maxSessions) * 100)}%` }}
                  />
                </div>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Vencimiento</p>
              {expiresAt ? (
                <div>
                  <p className="font-bold text-base">{fmtDate(expiresAt)}</p>
                  {daysLeft !== null && (
                    <p className={`text-xs font-medium mt-0.5 flex items-center gap-1 ${
                      daysLeft <= 0 ? 'text-red-500'
                      : daysLeft <= 7 ? 'text-red-500'
                      : daysLeft <= 15 ? 'text-amber-500'
                      : 'text-muted-foreground'
                    }`}>
                      <Clock className="h-3 w-3" />
                      {daysLeft > 0 ? `${daysLeft} día${daysLeft !== 1 ? 's' : ''}` : 'Vencido'}
                    </p>
                  )}
                </div>
              ) : (
                <p className="font-bold text-base text-muted-foreground">Sin fecha</p>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Facturación</p>
              <Badge className={billingStatus.cls}>{billingStatus.label}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Historial de pagos */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <CreditCard className="w-4 h-4" /> Historial de Pagos
        </h4>

        {!payments || payments.length === 0 ? (
          <div className="text-center p-8 border border-dashed rounded-xl text-muted-foreground">
            <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-20" />
            No se han registrado pagos para este cliente.
          </div>
        ) : (
          <div className="border rounded-xl overflow-hidden border-border/50">
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
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      {p.payment_date || p.due_date
                        ? fmtDate(p.payment_date ?? p.due_date)
                        : '—'}
                    </td>
                    <td className="px-4 py-3 font-bold">{formatCurrency(p.amount)}</td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">
                      {p.payment_method ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={['paid','completed'].includes(p.status) ? 'default' : 'secondary'}>
                        {PAYMENT_STATUS_LABEL[p.status] ?? p.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Aviso */}
      <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 text-sm flex gap-3">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
        <p>
          La gestión central de pagos se realiza en <strong>Negocio › Pagos</strong>.
          Para registrar nuevos abonos o enviar recordatorios, dirígete a esa sección.
        </p>
      </div>
    </div>
  );
}
