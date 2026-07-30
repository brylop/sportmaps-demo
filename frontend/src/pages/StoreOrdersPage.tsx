import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShoppingCart, Eye, Package, Truck, CheckCircle, Clock, Loader2, RefreshCw } from 'lucide-react';
import { useStoreOrders } from '@/hooks/useStoreData';
import { StatFilterBar } from '@/components/common/StatFilterBar';
import { TableRefreshBar } from '@/components/common/TableRefreshBar';


const statusConfig: Record<string, { label: string; variant: 'secondary' | 'default' | 'outline' | 'destructive'; icon: any }> = {
  pending: { label: 'Pendiente', variant: 'secondary', icon: Clock },
  processing: { label: 'Procesando', variant: 'default', icon: Package },
  shipped: { label: 'Enviado', variant: 'outline', icon: Truck },
  delivered: { label: 'Entregado', variant: 'secondary', icon: CheckCircle }
};

export default function StoreOrdersPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { data: orders, isLoading, isFetching, refetch } = useStoreOrders();

  // Clean MVP: Only real data
  const displayOrders = (orders || []).map(o => ({
    id: o.id.substring(0, 8).toUpperCase(),
    customer_name: (o.shipping_address as any)?.name || 'Cliente',
    date: new Date(o.created_at).toLocaleDateString('es-CO'),
    total: Number(o.total_amount),
    status: o.status as keyof typeof statusConfig,
    items: 0
  }));

  const filteredOrders = statusFilter === 'all'
    ? displayOrders
    : displayOrders.filter(o => o.status === statusFilter);

  const statusCounts = {
    pending: displayOrders.filter(o => o.status === 'pending').length,
    processing: displayOrders.filter(o => o.status === 'processing').length,
    shipped: displayOrders.filter(o => o.status === 'shipped').length,
    delivered: displayOrders.filter(o => o.status === 'delivered').length,
  };

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
        columns={5}
        value={statusFilter === 'all' ? null : statusFilter}
        onChange={(v) => setStatusFilter(v ?? 'all')}
        items={[
          { key: null, label: 'Todos', value: displayOrders.length, tone: 'neutral' },
          { key: 'pending', label: 'Pendientes', value: statusCounts.pending, tone: 'yellow' },
          { key: 'processing', label: 'En Proceso', value: statusCounts.processing, tone: 'blue' },
          { key: 'shipped', label: 'Enviados', value: statusCounts.shipped, tone: 'violet' },
          { key: 'delivered', label: 'Entregados', value: statusCounts.delivered, tone: 'emerald' },
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
                const status = statusConfig[order.status] || statusConfig.pending;
                const StatusIcon = status.icon;
                return (
                  <TableRow key={order.id}>
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
                      <Badge variant={status.variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="gap-1">
                        <Eye className="h-4 w-4" />
                        Ver
                      </Button>
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