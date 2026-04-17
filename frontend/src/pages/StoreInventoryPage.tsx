import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Package, AlertTriangle, TrendingUp, BarChart3, Loader2 } from 'lucide-react';
import { useStoreProducts, useStoreStats } from '@/hooks/useStoreData';

export default function StoreInventoryPage() {
  const { products, isLoading: productsLoading } = useStoreProducts();
  const stats = useStoreStats();

  const lowStockProducts = products.filter(p => p.stock < 20);
  const isLoading = productsLoading || stats.isLoading;

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
        <h1 className="text-3xl font-bold tracking-tight">Inventario</h1>
        <p className="text-muted-foreground">Control y seguimiento de stock</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Package className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Productos</p>
                <p className="text-2xl font-bold">{stats.totalProducts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Stock Bajo</p>
                <p className="text-2xl font-bold text-destructive">{stats.lowStock}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-green-50 dark:bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ventas Totales</p>
                <p className="text-2xl font-bold">{stats.totalSales}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ingresos</p>
                <p className="text-2xl font-bold">${(stats.totalRevenue / 1000).toFixed(1)}k</p>
              </div>
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
                const categoryProducts = products.filter(p => p.category === category);
                const totalStock = categoryProducts.reduce((acc, p) => acc + p.stock, 0);
                const maxStock = 200; // Arbitrary max for progress bar
                const percentage = Math.min((totalStock / maxStock) * 100, 100);

                // Only show categories with products
                if (categoryProducts.length === 0) return null;

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
              {products.length === 0 && (
                <p className="text-muted-foreground text-center py-4">No hay datos de inventario.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
