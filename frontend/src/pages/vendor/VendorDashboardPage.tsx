import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Package, Calendar, DollarSign, ShoppingBag, Plus, BarChart3, Clock, Star } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface VendorStats {
  total_products: number;
  total_services: number;
  total_orders: number;
  vendor_type: string;
}

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

  const statCards = isWellness
    ? [
        { title: 'Servicios Activos', value: stats?.total_services || 0, icon: Calendar, color: 'text-blue-600' },
        { title: 'Citas Recibidas', value: stats?.total_orders || 0, icon: Clock, color: 'text-green-600' },
        { title: 'Ingresos', value: '$0', icon: DollarSign, color: 'text-emerald-600' },
        { title: 'Rating', value: '-', icon: Star, color: 'text-amber-500' },
      ]
    : [
        { title: 'Productos Activos', value: stats?.total_products || 0, icon: Package, color: 'text-blue-600' },
        { title: 'Ordenes', value: stats?.total_orders || 0, icon: ShoppingBag, color: 'text-green-600' },
        { title: 'Ingresos', value: '$0', icon: DollarSign, color: 'text-emerald-600' },
        { title: 'Rating', value: '-', icon: Star, color: 'text-amber-500' },
      ];

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{isWellness ? 'Dashboard Profesional' : 'Dashboard Vendedor'}</h1>
          <p className="text-muted-foreground">Gestiona tu presencia en el marketplace</p>
        </div>
        <Button onClick={() => navigate(isWellness ? '/vendor/services' : '/vendor/products')}>
          <Plus className="h-4 w-4 mr-2" />
          {isWellness ? 'Nuevo Servicio' : 'Nuevo Producto'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted ${card.color}`}>
                  <card.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{loading ? '-' : card.value}</p>
                  <p className="text-xs text-muted-foreground">{card.title}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Acciones Rapidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {isWellness ? (
              <>
                <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/vendor/services')}>
                  <Calendar className="h-5 w-5" />
                  <span className="text-xs">Mis Servicios</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/vendor/appointments')}>
                  <Clock className="h-5 w-5" />
                  <span className="text-xs">Citas</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/schedule')}>
                  <Calendar className="h-5 w-5" />
                  <span className="text-xs">Agenda</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/athletes')}>
                  <BarChart3 className="h-5 w-5" />
                  <span className="text-xs">Mis Atletas</span>
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/vendor/products')}>
                  <Package className="h-5 w-5" />
                  <span className="text-xs">Mis Productos</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/orders')}>
                  <ShoppingBag className="h-5 w-5" />
                  <span className="text-xs">Ordenes</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/inventory')}>
                  <BarChart3 className="h-5 w-5" />
                  <span className="text-xs">Inventario</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/promotions')}>
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
