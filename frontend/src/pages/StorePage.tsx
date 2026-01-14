import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Package, PlusCircle, ShoppingCart, TrendingUp, DollarSign, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function StorePage() {
  const { toast } = useToast();
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [products, setProducts] = useState<any[]>([
    {
      id: '1',
      name: 'Balón de Fútbol Nike',
      category: 'Fútbol',
      price: 120000,
      stock: 25,
      image: 'https://images.unsplash.com/photo-1614632537197-38a17061c2bd?w=400',
    },
    {
      id: '2',
      name: 'Raqueta de Tenis Wilson',
      category: 'Tenis',
      price: 450000,
      stock: 8,
      image: 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=400',
    },
    {
      id: '3',
      name: 'Zapatillas Running Adidas',
      category: 'Running',
      price: 380000,
      stock: 15,
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400',
    },
  ]);

  const handleCreateProduct = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newProduct = {
      id: Date.now().toString(),
      name: formData.get('name') as string,
      category: formData.get('category') as string,
      price: parseInt(formData.get('price') as string),
      stock: parseInt(formData.get('stock') as string),
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400',
    };
    setProducts([...products, newProduct]);
    toast({
      title: '✅ Producto creado',
      description: 'El producto ha sido agregado al catálogo',
    });
    setProductDialogOpen(false);
  };

  const handleDeleteProduct = (id: string) => {
    setProducts(products.filter(p => p.id !== id));
    toast({
      title: '🗑️ Producto eliminado',
      description: 'El producto ha sido removido del catálogo',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Tienda</h1>
          <p className="text-muted-foreground mt-1">
            Administra tu catálogo de productos deportivos
          </p>
        </div>
        <Button onClick={() => setProductDialogOpen(true)}>
          <PlusCircle className="w-4 h-4 mr-2" />
          Nuevo Producto
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Productos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas Mes</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">42</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Mes</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$8.4M</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inventario Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.reduce((sum, p) => sum + p.stock, 0)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Products Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <Card key={product.id} className="overflow-hidden">
            <div className="aspect-video bg-muted relative">
              <img 
                src={product.image} 
                alt={product.name}
                className="w-full h-full object-cover"
              />
              <Badge className="absolute top-2 right-2">
                {product.category}
              </Badge>
            </div>
            <CardHeader>
              <CardTitle className="text-lg">{product.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-primary">
                    ${product.price.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Stock: {product.stock} unidades
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Edit className="w-4 h-4 mr-2" />
                  Editar
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => handleDeleteProduct(product.id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Product Dialog */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo Producto</DialogTitle>
            <DialogDescription>
              Agrega un nuevo producto a tu catálogo
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateProduct} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="name">Nombre del Producto *</Label>
                <Input 
                  name="name" 
                  placeholder="Ej: Balón de Fútbol Nike"
                  required 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Categoría *</Label>
                <Select name="category" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fútbol">Fútbol</SelectItem>
                    <SelectItem value="Tenis">Tenis</SelectItem>
                    <SelectItem value="Running">Running</SelectItem>
                    <SelectItem value="Natación">Natación</SelectItem>
                    <SelectItem value="Gimnasio">Gimnasio</SelectItem>
                    <SelectItem value="Accesorios">Accesorios</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Precio (COP) *</Label>
                <Input 
                  type="number" 
                  name="price" 
                  placeholder="120000"
                  required 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="stock">Stock Inicial *</Label>
                <Input 
                  type="number" 
                  name="stock" 
                  placeholder="25"
                  required 
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea 
                  name="description" 
                  placeholder="Descripción del producto, características, materiales..."
                  rows={4}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setProductDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                Crear Producto
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
