import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Minus, Plus } from 'lucide-react';

interface ProductFormData {
  name: string;
  description: string;
  price: number | '';
  stock: number | '';
  category: string;
  image_url: string;
}

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ProductFormData) => void;
  initialData?: Partial<ProductFormData>;
  isLoading?: boolean;
  mode: 'create' | 'edit';
}

const categories = [
  'Fútbol', 'Baloncesto', 'Tenis', 'Natación', 'Running',
  'Fitness', 'Boxeo', 'Ciclismo', 'Ropa', 'Accesorios', 'Nutrición'
];

export function ProductFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  isLoading,
  mode
}: ProductFormDialogProps) {
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    description: '',
    price: 0 as number | '',
    stock: 0 as number | '',
    category: '',
    image_url: '',
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        description: initialData.description || '',
        price: initialData.price || 0,
        stock: initialData.stock || 0,
        category: initialData.category || '',
        image_url: initialData.image_url || '',
      });
    } else {
      setFormData({
        name: '',
        description: '',
        price: 0,
        stock: 0,
        category: '',
        image_url: '',
      });
    }
  }, [initialData, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      price: Number(formData.price) || 0,
      stock: Number(formData.stock) || 0,
    } as ProductFormData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Nuevo Producto' : 'Editar Producto'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del producto *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Balón de fútbol profesional"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe tu producto..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Precio *</Label>
              <div className="flex items-center border rounded-md h-10 w-full bg-background overflow-hidden relative">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, price: Math.max(0, (formData.price as number || 0) - 1000) })}
                  className="h-full px-3 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors absolute left-0 z-10 flex items-center justify-center border-r bg-muted/20"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="absolute left-10 text-muted-foreground font-medium z-10 pointer-events-none">$</span>
                <Input
                  id="price"
                  type="text"
                  className="border-0 text-center font-semibold focus-visible:ring-0 pl-14 pr-10"
                  value={formData.price ? Number(formData.price).toLocaleString('es-CO') : ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setFormData({ ...formData, price: val === '' ? '' : parseFloat(val) });
                  }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, price: (formData.price as number || 0) + 1000 })}
                  className="h-full px-3 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors absolute right-0 z-10 flex items-center justify-center border-l bg-muted/20"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stock">Stock *</Label>
              <div className="flex items-center border rounded-md h-10 bg-background overflow-hidden relative">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, stock: Math.max(0, (formData.stock as number || 0) - 1) })}
                  className="h-full px-3 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors absolute left-0 z-10 flex items-center justify-center border-r"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <Input
                  id="stock"
                  type="number"
                  className="border-0 text-center font-semibold focus-visible:ring-0 px-10 no-spinners"
                  min="0"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value === '' ? '' : parseInt(e.target.value) })}
                  required
                />
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, stock: (formData.stock as number || 0) + 1 })}
                  className="h-full px-3 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors absolute right-0 z-10 flex items-center justify-center border-l"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoría *</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="image_url">URL de imagen (opcional)</Label>
            <Input
              id="image_url"
              type="url"
              value={formData.image_url}
              onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'create' ? 'Crear Producto' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}