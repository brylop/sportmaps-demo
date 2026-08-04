import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Package, DollarSign, Edit, Archive, Loader2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  image_url: string;
  status: string;
  visibility: string;
  product_variants: any[];
}

export default function VendorProductsPage() {
  const { session } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/vendor/products`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      });
      const json = await res.json();
      if (json.ok) setProducts(json.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) fetchProducts();
  }, [session]);

  const handleArchive = async (id: string) => {
    try {
      await fetch(`${API_URL}/api/v1/vendor/products/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      });
      toast({ title: 'Producto archivado' });
      fetchProducts();
    } catch (err) {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Mis Productos</h1>
          <p className="text-muted-foreground">Gestiona tu catalogo de productos en el marketplace</p>
        </div>
        <Button onClick={() => navigate('/vendor/products/new')}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo Producto
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold mb-2">No tienes productos aun</h3>
            <p className="text-muted-foreground text-sm mb-4">Agrega tu primer producto para que aparezca en el marketplace</p>
            <Button onClick={() => navigate('/vendor/products/new')}><Plus className="h-4 w-4 mr-2" /> Crear Producto</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {products.map(product => (
            <Card key={product.id}>
              <CardContent className="p-4 flex items-center gap-4">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-16 h-16 rounded-lg object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{product.name}</h3>
                    <Badge variant={product.status === 'active' ? 'default' : 'secondary'}>{product.status}</Badge>
                    {product.category && <Badge variant="outline">{product.category}</Badge>}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />${product.price.toLocaleString('es-CO')}</span>
                    <span>Stock: {product.stock}</span>
                    {product.product_variants?.length > 0 && <span>{product.product_variants.length} variantes</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => navigate(`/vendor/products/${product.id}/edit`)}><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleArchive(product.id)}>
                    <Archive className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
