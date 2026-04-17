import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Package, DollarSign, Edit, Archive, Loader2 } from 'lucide-react';
import { PRODUCT_CATEGORIES } from '@/types/shop';

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
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', price: '', stock: '0',
    category: '', visibility: 'public', image_url: '',
  });

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

  const handleCreate = async () => {
    if (!form.name || !form.price) {
      toast({ title: 'Error', description: 'Nombre y precio son requeridos', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/vendor/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          ...form,
          price: parseFloat(form.price),
          stock: parseInt(form.stock, 10),
        }),
      });
      const json = await res.json();

      if (json.ok) {
        toast({ title: 'Producto creado' });
        setDialogOpen(false);
        setForm({ name: '', description: '', price: '', stock: '0', category: '', visibility: 'public', image_url: '' });
        fetchProducts();
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'No se pudo crear el producto', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

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
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Nuevo Producto</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Crear Producto</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nombre *</Label>
                <Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ej: Camiseta de Compresion Pro" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Precio (COP) *</Label>
                  <Input type="number" value={form.price} onChange={(e) => setForm(p => ({ ...p, price: e.target.value }))} placeholder="89000" />
                </div>
                <div>
                  <Label>Stock</Label>
                  <Input type="number" value={form.stock} onChange={(e) => setForm(p => ({ ...p, stock: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar categoria" /></SelectTrigger>
                  <SelectContent>
                    {PRODUCT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Visibilidad</Label>
                <Select value={form.visibility} onValueChange={(v) => setForm(p => ({ ...p, visibility: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Publico (todos)</SelectItem>
                    <SelectItem value="school_only">Solo miembros de escuela</SelectItem>
                    <SelectItem value="private">Privado (borrador)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Descripcion</Label>
                <Textarea value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} rows={3} />
              </div>
              <div>
                <Label>URL de imagen</Label>
                <Input value={form.image_url} onChange={(e) => setForm(p => ({ ...p, image_url: e.target.value }))} placeholder="https://..." />
              </div>
              <Button className="w-full" onClick={handleCreate} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Crear Producto
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold mb-2">No tienes productos aun</h3>
            <p className="text-muted-foreground text-sm mb-4">Agrega tu primer producto para que aparezca en el marketplace</p>
            <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" /> Crear Producto</Button>
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
                  <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
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
