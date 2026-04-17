import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Package } from 'lucide-react';
import { NumberStepper } from '../ui/number-stepper';
import { ImageUpload } from '../common/ImageUpload';

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
  'Futbol', 'Baloncesto', 'Tenis', 'Natacion', 'Running',
  'Fitness', 'Boxeo', 'Ciclismo', 'Ropa', 'Accesorios', 'Nutricion'
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

  const isValid = formData.name && formData.category && Number(formData.price) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>
                {mode === 'create' ? 'Nuevo Producto' : 'Editar Producto'}
              </DialogTitle>
              <DialogDescription>
                {mode === 'create'
                  ? 'Agrega un nuevo producto a tu catalogo'
                  : 'Modifica los datos del producto'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-1">
          {/* Image Upload */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Imagen del producto
            </Label>
            <ImageUpload
              value={formData.image_url}
              onChange={(url) => setFormData({ ...formData, image_url: url })}
              onRemove={() => setFormData({ ...formData, image_url: '' })}
              bucket="school-assets"
              path="products"
            />
          </div>

          {/* Product Info Section */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">Nombre del producto *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Balon de futbol profesional"
                className="h-10"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">Descripcion</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe tu producto, materiales, tallas disponibles..."
                rows={3}
                className="resize-none"
              />
            </div>
          </div>

          {/* Price & Stock Section */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price" className="text-sm font-medium">Precio *</Label>
              <NumberStepper
                value={formData.price}
                onChange={(val) => setFormData({ ...formData, price: val })}
                min={0}
                step={1000}
                unit="$"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stock" className="text-sm font-medium">Stock *</Label>
              <NumberStepper
                value={formData.stock}
                onChange={(val) => setFormData({ ...formData, stock: val })}
                min={0}
              />
            </div>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category" className="text-sm font-medium">Categoria *</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Selecciona una categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !isValid}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'create' ? 'Crear Producto' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
