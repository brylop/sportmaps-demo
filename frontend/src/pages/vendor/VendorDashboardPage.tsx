import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import {
  Package, Calendar, DollarSign, ShoppingBag, Plus, BarChart3, Clock, Star, Users, Inbox, type LucideIcon,
} from 'lucide-react';
import { countMyAppointments, currentMonthColombia, getMyVendorSummary, monthRangeISO } from '@/lib/clinical/agenda-extra';
import { todayColombia } from '@/lib/dateUtils';
import { useStoreSalesInsights } from '@/hooks/useMyStoreProducts';
import { formatCOP } from '@/lib/store/inventory';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface VendorStats {
  total_products: number;
  total_services: number;
  total_orders: number;
  vendor_type: string;
}

interface StatCard { title: string; value: string | number; icon: LucideIcon; color: string; onClick?: () => void }

export default function VendorDashboardPage() {
  const { session, profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<VendorStats | null>(null);
  const [loading, setLoading] = useState(true);

  const isWellness = profile?.role === 'wellness_professional';

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch(`${API_URL}/api/v1/vendor/stats`, {
          headers: { 'Authorization': `Bearer ${session?.access_token}` },
        });
        const json = await res.json();
        if (json.ok) setStats(json.data);
      } catch (err) {
        console.error('Error fetching vendor stats:', err);
      } finally {
        setLoading(false);
      }
    }
    if (session) fetchStats();
  }, [session]);

  // Rating real del perfil (si tiene reseñas).
  const vendorQ = useQuery({
    queryKey: ['agenda', 'vendor-summary', session?.user?.id],
    queryFn: getMyVendorSummary,
    enabled: !!session,
  });

  // Citas del profesional (agenda), no pedidos de productos.
  const month = currentMonthColombia();
  const aptQ = useQuery({
    queryKey: ['agenda', 'vendor-dashboard-counts', month],
    queryFn: async () => {
      const { from, to } = monthRangeISO(month);
      const [monthCount, pendingCount] = await Promise.all([
        countMyAppointments({ from, to, statuses: ['pending', 'confirmed', 'completed', 'no_show'] }),
        countMyAppointments({ from: todayColombia(), statuses: ['pending'] }),
      ]);
      return { monthCount, pendingCount };
    },
    enabled: isWellness && !!session,
  });

  // Ventas reales de la tienda (orders/order_items pagados en adelante), últimos 30 días.
  const salesQ = useStoreSalesInsights(30);
  const sales = !isWellness ? salesQ.data : undefined;
  const salesValue = (v: string | number) => (salesQ.isLoading ? '…' : salesQ.error ? '—' : v);

  const vendor = vendorQ.data;
  const ratingCard: StatCard[] = vendor && (vendor.reviews_count ?? 0) > 0 && vendor.avg_rating != null
    ? [{
      title: `Calificación (${vendor.reviews_count} ${vendor.reviews_count === 1 ? 'reseña' : 'reseñas'})`,
      value: Number(vendor.avg_rating).toFixed(1), icon: Star, color: 'text-amber-500',
    }]
    : [];

  const statCards: StatCard[] = isWellness
    ? [
      { title: 'Servicios activos', value: loading ? '-' : stats?.total_services ?? 0, icon: Calendar, color: 'text-blue-600', onClick: () => navigate('/vendor/services') },
      { title: 'Citas este mes', value: aptQ.isLoading ? '-' : aptQ.data?.monthCount ?? 0, icon: Clock, color: 'text-green-600', onClick: () => navigate('/schedule') },
      { title: 'Por confirmar', value: aptQ.isLoading ? '-' : aptQ.data?.pendingCount ?? 0, icon: Inbox, color: 'text-amber-600', onClick: () => navigate('/schedule') },
      ...ratingCard,
    ]
    : [
      { title: 'Ingresos (30 días)', value: salesValue(formatCOP(sales?.revenue ?? 0)), icon: DollarSign, color: 'text-emerald-600', onClick: () => navigate('/orders') },
      { title: 'Pedidos pagados (30 días)', value: salesValue(sales?.orders ?? 0), icon: ShoppingBag, color: 'text-green-600', onClick: () => navigate('/orders') },
      { title: 'Ticket promedio', value: salesValue(formatCOP(sales?.avg_ticket ?? 0)), icon: BarChart3, color: 'text-violet-600' },
      { title: 'Productos activos', value: loading ? '…' : stats?.total_products ?? 0, icon: Package, color: 'text-blue-600', onClick: () => navigate('/vendor/products') },
      // Calificación solo si hay reseñas reales (sin "-" fijo).
      ...ratingCard,
    ];

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{isWellness ? 'Panel profesional' : 'Panel de vendedor'}</h1>
          <p className="text-muted-foreground">
            {isWellness ? 'Tu agenda, tus pacientes y tu presencia en el marketplace' : 'Gestiona tu presencia en el marketplace'}
          </p>
        </div>
        <Button onClick={() => navigate(isWellness ? '/vendor/services' : '/vendor/products')}>
          <Plus className="h-4 w-4 mr-2" />
          {isWellness ? 'Nuevo servicio' : 'Nuevo producto'}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <Card
            key={card.title}
            className={card.onClick ? 'cursor-pointer transition hover:shadow-md' : undefined}
            onClick={card.onClick}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted ${card.color}`}>
                  <card.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold">{card.value}</p>
                  <p className="text-xs text-muted-foreground">{card.title}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!isWellness && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Más vendidos (30 días)</CardTitle>
          </CardHeader>
          <CardContent>
            {salesQ.isLoading ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : salesQ.error ? (
              <p className="text-sm text-muted-foreground">No se pudieron cargar las ventas de la tienda.</p>
            ) : (sales?.top_products.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="top-products-empty">Todavía no hay ventas pagadas en este periodo.</p>
            ) : (
              <ol className="space-y-2" data-testid="top-products">
                {sales!.top_products.map((p, i) => (
                  <li key={p.product_id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-5 text-muted-foreground">{i + 1}.</span>
                      <span className="truncate font-medium">{p.name}</span>
                    </span>
                    <span className="shrink-0 text-muted-foreground">{p.units} u. · {formatCOP(p.revenue)}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Accesos rápidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {isWellness ? (
              <>
                <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/schedule')}>
                  <Calendar className="h-5 w-5" />
                  <span className="text-xs">Agenda</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/pacientes')}>
                  <Users className="h-5 w-5" />
                  <span className="text-xs">Pacientes</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/disponibilidad')}>
                  <Clock className="h-5 w-5" />
                  <span className="text-xs">Disponibilidad</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/vendor/services')}>
                  <BarChart3 className="h-5 w-5" />
                  <span className="text-xs">Mis servicios</span>
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/vendor/products')}>
                  <Package className="h-5 w-5" />
                  <span className="text-xs">Mis productos</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/orders')}>
                  <ShoppingBag className="h-5 w-5" />
                  <span className="text-xs">Órdenes</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/inventory')}>
                  <BarChart3 className="h-5 w-5" />
                  <span className="text-xs">Inventario</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/vendor/promotions')}>
                  <DollarSign className="h-5 w-5" />
                  <span className="text-xs">Promociones</span>
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
