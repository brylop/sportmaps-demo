import { CheckCircle2, Circle, CircleDot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buyerTimeline, orderStatusLabel, type OrderLike } from '@/lib/store/orderStatus';
import type { StatusHistoryRow } from '@/lib/api/storeApi';

const ACTOR: Record<string, string> = {
  buyer: 'Comprador', seller: 'Tienda', admin: 'SportMaps', system: 'Sistema', webhook: 'Pasarela',
};

function when(iso: string) {
  return new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** Pasos del camino feliz + historial real (order_status_history). */
export function OrderTimeline({ order, history }: { order: OrderLike; history: StatusHistoryRow[] }) {
  const steps = buyerTimeline(order);
  return (
    <div className="space-y-4">
      <ol className="flex items-start justify-between gap-1" aria-label="Avance del pedido">
        {steps.map((s, i) => {
          const Icon = s.state === 'done' ? CheckCircle2 : s.state === 'current' ? CircleDot : Circle;
          return (
            <li key={s.status} className="flex-1 flex flex-col items-center text-center gap-1 relative">
              {i > 0 && <span className={cn('absolute top-2.5 right-1/2 w-full h-0.5 -z-0', s.state === 'todo' ? 'bg-muted' : 'bg-primary/60')} aria-hidden />}
              <Icon className={cn('h-5 w-5 relative z-10 bg-card rounded-full', s.state === 'todo' ? 'text-muted-foreground/40' : 'text-primary')} />
              <span className={cn('text-[11px] leading-tight', s.state === 'current' ? 'font-semibold' : 'text-muted-foreground')}>{s.label}</span>
            </li>
          );
        })}
      </ol>
      {history.length > 0 && (
        <ul className="border-l pl-4 space-y-2 text-sm" data-testid="order-history">
          {history.map((h) => (
            <li key={h.id} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary/70" aria-hidden />
              <p><span className="font-medium">{orderStatusLabel(h.to_status)}</span>
                <span className="text-muted-foreground"> · {when(h.created_at)}{h.actor_role ? ` · ${ACTOR[h.actor_role] ?? h.actor_role}` : ''}</span></p>
              {h.note && <p className="text-xs text-muted-foreground">{h.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
