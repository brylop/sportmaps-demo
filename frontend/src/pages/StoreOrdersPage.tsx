import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingCart, Eye, Package, Truck, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { useStoreOrders } from '@/hooks/useStoreData';
import { mockOrders } from '@/lib/mock-data';

const statusConfig: Record<string, { label: string; variant: 'secondary' | 'default' | 'outline' | 'destructive'; icon: any }> = {
  pending: { label: 'Pendiente', variant: 'secondary', icon: Clock },
  processing: { label: 'Procesando', variant: 'default', icon: Package },
  shipped: { label: 'Enviado', variant: 'outline', icon: Truck },
  delivered: { label: 'Entregado', variant: 'secondary', icon: CheckCircle }
};

export default function StoreOrdersPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { data: orders, isLoading } = useStoreOrders();
  
  // Use real data if available, otherwise show mock data
  const displayOrders = (orders && orders.length > 0) ? orders.map(o => ({
    id: o.id.substring(0, 8).toUpperCase(),
    customer_name: (o.shipping_address as any)?.name || 'Cliente',
    date: new Date(o.created_at).toLocaleDateString('es-CO'),
    total: Number(o.total),
    status: o.status as keyof typeof statusConfig,
    items: Array.isArray(o.items) ? (o.items as any[]).length : 1
  })) : mockOrders;

  const filteredOrders = statusFilter === 'all' 
    ? displayOrders 
    : displayOrders.filter(o => o.status === statusFilter);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pedidos</h1>
        <p className="text-muted-foreground">Gestiona los pedidos de tu tienda</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="hover:border-yellow-500 transition-colors cursor-pointer" onClick={() => setStatusFilter('pending')}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendientes</p>
                <p className="text-2xl font-bold">
                  {displayOrders.filter(o => o.status === 'pending').length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="hover:border-blue-500 transition-colors cursor-pointer" onClick={() => setStatusFilter('processing')}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">En Proceso</p>
                <p className="text-2xl font-bold">
                  {displayOrders.filter(o => o.status === 'processing').length}
                </p>
              </div>
              <Package className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="hover:border-purple-500 transition-colors cursor-pointer" onClick={() => setStatusFilter('shipped')}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Enviados</p>
                <p className="text-2xl font-bold">
                  {displayOrders.filter(o => o.status === 'shipped').length}
                </p>
              </div>
              <Truck className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="hover:border-green-500 transition-colors cursor-pointer" onClick={() => setStatusFilter('delivered')}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Entregados</p>
                <p className="text-2xl font-bold">
                  {displayOrders.filter(o => o.status === 'delivered').length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Listado de Pedidos
            </CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="processing">En Proceso</SelectItem>
                <SelectItem value="shipped">Enviados</SelectItem>
                <SelectItem value="delivered">Entregados</SelectItem>
              </SelectContent>
            </Select>
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
        </CardContent>
      </Card>
    </div>
  );
}