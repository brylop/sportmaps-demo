import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Package, AlertTriangle, TrendingUp, BarChart3 } from 'lucide-react';
import { mockProducts, getStoreStats } from '@/lib/mock-data';

export default function StoreInventoryPage() {
  const stats = getStoreStats();
  const lowStockProducts = mockProducts.filter(p => p.stock < 20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Inventario</h1>
        <p className="text-muted-foreground">Control y seguimiento de stock</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Productos</p>
                <p className="text-2xl font-bold">{stats.totalProducts}</p>
              </div>
              <Package className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Stock Bajo</p>
                <p className="text-2xl font-bold text-destructive">{stats.lowStock}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ventas Totales</p>
                <p className="text-2xl font-bold">{stats.totalSales}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ingresos</p>
                <p className="text-2xl font-bold">${(stats.totalRevenue / 1000).toFixed(1)}k</p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Productos con Stock Bajo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockProducts.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Todos los productos tienen stock suficiente
              </p>
            ) : (
              <div className="space-y-4">
                {lowStockProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">{product.category}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="destructive">{product.stock} unidades</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Nivel de Stock por Categoría
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {['Fútbol', 'Tenis', 'Running', 'Fitness', 'Boxeo', 'Ropa'].map((category) => {
                const categoryProducts = mockProducts.filter(p => p.category === category);
                const totalStock = categoryProducts.reduce((acc, p) => acc + p.stock, 0);
                const maxStock = 200;
                const percentage = Math.min((totalStock / maxStock) * 100, 100);
                
                return (
                  <div key={category} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{category}</span>
                      <span className="text-muted-foreground">{totalStock} unidades</span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
