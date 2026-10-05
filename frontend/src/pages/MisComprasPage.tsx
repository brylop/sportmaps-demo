/**
 * MisComprasPage — "Mis compras" del comprador (tienda v2 §2.1).
 * Lista de pedidos de la tienda con estado y lo que falta hacer.
 */

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Loader2, Package, ShoppingBag } from 'lucide-react';
import { OrderStatusBadge } from '@/components/store/OrderStatusBadge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMyOrders, type StoreOrder } from '@/lib/api/storeApi';
import { formatCurrency } from '@/lib/utils';
import { buyerCanUploadReceipt, normalizeOrderStatus, orderShortRef } from '@/lib/store/orderStatus';

function itemsSummary(o: StoreOrder): string {
  const names = (o.order_items ?? []).map((i) => `${i.quantity} × ${i.products?.name ?? 'Producto'}`);
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} y ${names.length - 2} más` : names.join(', ');
}

export default function MisComprasPage() {
  const { user } = useAuth();
  const { data: orders = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['store', 'my-orders', user?.id],
    queryFn: fetchMyOrders,
    enabled: !!user,
  });

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Mis compras</h1>
          <p className="text-muted-foreground text-sm">Tus pedidos en la tienda y en qué van.</p>
        </div>
        <Button asChild variant="outline" size="sm"><Link to="/mi-tienda">Ir a la tienda</Link></Button>
      </div>

      {isLoading ? (
        <div className="py-16 grid place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : isError ? (
        <div className="rounded-xl border p-6 text-center space-y-2">
          <p className="font-medium">No pudimos cargar tus compras.</p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>Reintentar</Button>
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border bg-card py-14 text-center space-y-2">
          <ShoppingBag className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="font-medium">Todavía no tienes compras</p>
          <p className="text-sm text-muted-foreground">Cuando compres en la tienda de tu escuela, tus pedidos aparecen aquí.</p>
        </div>
      ) : (
        <ul className="space-y-3" data-testid="my-orders">
          {orders.map((o) => {
            const needsReceipt = buyerCanUploadReceipt(o);
            const status = normalizeOrderStatus(o.status);
            return (
              <li key={o.id}>
                <Link to={`/mis-compras/${o.id}`} className="block rounded-xl border bg-card p-4 hover:border-primary/50 transition-colors" data-testid="my-order-row">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center shrink-0"><Package className="h-5 w-5 text-primary" /></div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-muted-foreground">{orderShortRef(o)}</span>
                        <OrderStatusBadge status={o.status} />
                      </div>
                      <p className="text-sm line-clamp-1">{itemsSummary(o) || 'Pedido de la tienda'}</p>
                      <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      {needsReceipt && <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Falta subir el comprobante</p>}
                      {status === 'ready_for_pickup' && <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Listo para retirar</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold tabular-nums">{formatCurrency(Number(o.total_amount))}</p>
                      <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto mt-2" />
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
