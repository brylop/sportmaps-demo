import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ShoppingCart, Eye, Package, Truck, CheckCircle, Clock, Loader2, RefreshCw,
  CreditCard, FileSearch, XCircle, Undo2, Store, HelpCircle,
} from 'lucide-react';
import { useStoreOrders } from '@/hooks/useStoreData';
import { useToast } from '@/hooks/use-toast';
import { bffClient } from '@/lib/api/bffClient';
import { StatFilterBar } from '@/components/common/StatFilterBar';
import { TableRefreshBar } from '@/components/common/TableRefreshBar';
import {
  ORDER_STATUS_GROUPS,
  VENDOR_ACTION_LABELS,
  normalizeOrderStatus,
  orderStatusGroup,
  orderStatusLabel,
  vendorNextStatuses,
  type OrderStatus,
  type OrderStatusGroup,
} from '@/lib/store/orderStatus';

type BadgeVariant = 'secondary' | 'default' | 'outline' | 'destructive';

// Estados de M-F0-3. Los legacy (`pending`, `processing`) se normalizan antes
// de llegar aquí (lib/store/orderStatus).
const statusVisual: Record<OrderStatus, { variant: BadgeVariant; icon: typeof Clock }> = {
  pending_payment: { variant: 'secondary', icon: Clock },
  awaiting_approval: { variant: 'secondary', icon: FileSearch },
  payment_review: { variant: 'secondary', icon: FileSearch },
  paid: { variant: 'default', icon: CreditCard },
  preparing: { variant: 'default', icon: Package },
  ready_for_pickup: { variant: 'outline', icon: Store },
  shipped: { variant: 'outline', icon: Truck },
  delivered: { variant: 'secondary', icon: CheckCircle },
  expired: { variant: 'outline', icon: Clock },
  cancelled: { variant: 'destructive', icon: XCircle },
  refunded: { variant: 'outline', icon: Undo2 },
  partially_refunded: { variant: 'outline', icon: Undo2 },
};

export default function StoreOrdersPage() {
  const [statusFilter, setStatusFilter] = useState<OrderStatusGroup | 'all'>('all');
  const { data: orders, isLoading, isFetching, refetch } = useStoreOrders();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // El vendedor ya no escribe `orders` con su JWT (M-F0-3): las transiciones
  // van por el BFF, que valida la matriz paid→preparing→ready_for_pickup|shipped→delivered.
  // TODO(tienda v2 F3): revisar comprobante de transferencia y confirmar
  // efectivo (`review_order_receipt` / `confirm_cash_pickup`) cuando el BFF
  // exponga sus rutas; hoy no existen y no se inventan aquí.
  const transition = useMutation({
    mutationFn: async ({ orderId, to }: { orderId: string; to: OrderStatus }) =>
      bffClient.patch(`/api/v1/marketplace/orders/vendor/${orderId}/status`, { status: to }),
    onSuccess: (_data, { to }) => {
      queryClient.invalidateQueries({ queryKey: ['store-orders'] });
      toast({ title: 'Pedido actualizado', description: `Nuevo estado: ${orderStatusLabel(to)}` });
    },
    onError: (error: Error) => {
      toast({ title: 'No se pudo actualizar el pedido', description: error.message, variant: 'destructive' });
    },
  });

  // Clean MVP: Only real data
  const displayOrders = (orders || []).map(o => ({
    orderId: o.id as string,
    id: o.id.substring(0, 8).toUpperCase(),
    customer_name: (o.shipping_address as any)?.name || 'Cliente',
    date: new Date(o.created_at).toLocaleDateString('es-CO'),
    total: Number(o.total_amount),
    rawStatus: o.status as string,
    status: normalizeOrderStatus(o.status),
    group: orderStatusGroup(o.status),
    items: 0
  }));

  const filteredOrders = statusFilter === 'all'
    ? displayOrders
    : displayOrders.filter(o => o.group === statusFilter);

  const countGroup = (g: OrderStatusGroup) => displayOrders.filter(o => o.group === g).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pedidos</h1>
        <p className="text-muted-foreground">Gestiona los pedidos de tu tienda</p>
      </div>

      <StatFilterBar
        columns={6}
        value={statusFilter === 'all' ? null : statusFilter}
        onChange={(v) => setStatusFilter((v as OrderStatusGroup | null) ?? 'all')}
        items={[
          { key: null, label: 'Todos', value: displayOrders.length, tone: 'neutral' },
          { key: 'awaiting_payment', label: ORDER_STATUS_GROUPS.awaiting_payment.label, value: countGroup('awaiting_payment'), tone: 'yellow' },
          { key: 'to_prepare', label: ORDER_STATUS_GROUPS.to_prepare.label, value: countGroup('to_prepare'), tone: 'blue' },
          { key: 'in_progress', label: ORDER_STATUS_GROUPS.in_progress.label, value: countGroup('in_progress'), tone: 'violet' },
          { key: 'delivered', label: ORDER_STATUS_GROUPS.delivered.label, value: countGroup('delivered'), tone: 'emerald' },
          { key: 'closed', label: ORDER_STATUS_GROUPS.closed.label, value: countGroup('closed'), tone: 'rose' },
        ]}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Listado de Pedidos
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-center">Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => {
                const visual = order.status
                  ? statusVisual[order.status]
                  : { variant: 'outline' as BadgeVariant, icon: HelpCircle };
                const StatusIcon = visual.icon;
                const nextStatuses = vendorNextStatuses(order.rawStatus);
                const busy = transition.isPending && transition.variables?.orderId === order.orderId;
                return (
                  <TableRow key={order.orderId}>
                    <TableCell className="font-mono font-medium">
                      {typeof order.id === 'string' && order.id.startsWith('ORD') ? order.id : `ORD-${order.id}`}
                    </TableCell>
                    <TableCell>{order.customer_name}</TableCell>
                    <TableCell>{order.date}</TableCell>
                    <TableCell className="text-center">{order.items}</TableCell>
                    <TableCell className="text-right font-medium text-primary">
                      ${order.total.toLocaleString('es-CO', { minimumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={visual.variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {orderStatusLabel(order.rawStatus)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 flex-wrap">
                        {nextStatuses.map((to) => (
                          <Button
                            key={to}
                            variant="outline"
                            size="sm"
                            disabled={transition.isPending}
                            onClick={() => transition.mutate({ orderId: order.orderId, to })}
                          >
                            {busy && transition.variables?.to === to && (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            )}
                            {VENDOR_ACTION_LABELS[to] ?? orderStatusLabel(to)}
                          </Button>
                        ))}
                        <Button variant="ghost" size="sm" className="gap-1">
                          <Eye className="h-4 w-4" />
                          Ver
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {filteredOrders.length === 0 && (
            <div className="text-center py-12">
              <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No hay pedidos</h3>
              <p className="text-muted-foreground">
                Los pedidos aparecerán aquí cuando los clientes compren
              </p>
            </div>
          )}
          <TableRefreshBar
            className="-mx-6 -mb-6 mt-2 rounded-b-lg"
            onRefresh={refetch}
            loading={isFetching}
            summary={
              filteredOrders.length === displayOrders.length
                ? `${displayOrders.length} pedido(s)`
                : `${filteredOrders.length} de ${displayOrders.length} pedido(s)`
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
