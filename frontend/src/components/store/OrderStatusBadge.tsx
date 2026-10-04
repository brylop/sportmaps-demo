import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { orderStatusGroup, orderStatusLabel } from '@/lib/store/orderStatus';

function badgeClass(status: string | null): string {
  const g = orderStatusGroup(status);
  if (g === 'awaiting_payment') return 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 hover:bg-amber-100';
  if (g === 'to_prepare' || g === 'in_progress') return 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200 hover:bg-blue-100';
  if (g === 'delivered') return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 hover:bg-emerald-100';
  return 'bg-muted text-muted-foreground hover:bg-muted';
}

/** Estado del pedido con color por grupo (por cobrar, en curso, entregado, cerrado). */
export function OrderStatusBadge({ status, className }: { status: string | null; className?: string }) {
  return (
    <Badge className={cn(badgeClass(status), className)} data-testid="order-status">
      {orderStatusLabel(status)}
    </Badge>
  );
}
