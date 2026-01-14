import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Edit, Trash2, Package, Loader2, AlertCircle } from 'lucide-react';
import { useStoreProducts } from '@/hooks/useStoreData';
import { mockProducts } from '@/lib/mock-data';
import { ProductFormDialog } from '@/components/store/ProductFormDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export default function StoreProductsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  
  const { products, isLoading, createProduct, updateProduct, deleteProduct } = useStoreProducts();

  // Use real data if available, otherwise show mock data for demo
  const displayProducts = products.length > 0 ? products : mockProducts;
  const isUsingMockData = products.length === 0;

  const filteredProducts = displayProducts.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = () => {
    setSelectedProduct(null);
    setFormMode('create');
    setIsFormOpen(true);
  };

  const handleEdit = (product: any) => {
    setSelectedProduct(product);
    setFormMode('edit');
    setIsFormOpen(true);
  };

  const handleDelete = (product: any) => {
    setSelectedProduct(product);
    setIsDeleteOpen(true);
  };

  const handleFormSubmit = (data: any) => {
    if (formMode === 'create') {
      createProduct.mutate(data, {
        onSuccess: () => setIsFormOpen(false),
      });
    } else if (selectedProduct) {
      updateProduct.mutate({ id: selectedProduct.id, ...data }, {
        onSuccess: () => setIsFormOpen(false),
      });
    }
  };

  const handleConfirmDelete = () => {
    if (selectedProduct) {
      deleteProduct.mutate(selectedProduct.id, {
        onSuccess: () => setIsDeleteOpen(false),
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Mis Productos</h1>
          <p className="text-muted-foreground">Gestiona tu catálogo de productos</p>
          {isUsingMockData && (
            <Badge variant="secondary" className="mt-2 gap-1">
              <AlertCircle className="h-3 w-3" />
              Mostrando datos de demostración
            </Badge>
          )}
        </div>
        <Button className="gap-2" onClick={handleCreate}>
          <Plus className="h-4 w-4" />
          Nuevo Producto
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Catálogo ({filteredProducts.length} productos)
            </CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {product.description}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{product.category}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium text-primary">
                    ${Number(product.price).toLocaleString('es-CO', { minimumFractionDigits: 0 })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={product.stock < 20 ? 'destructive' : 'outline'}>
                      {product.stock}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleEdit(product)}
                        disabled={isUsingMockData}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(product)}
                        disabled={isUsingMockData}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No hay productos</h3>
              <p className="text-muted-foreground mb-4">
                Comienza agregando tu primer producto al catálogo
              </p>
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Agregar Producto
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Form Dialog */}
      <ProductFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleFormSubmit}
        initialData={selectedProduct}
        isLoading={createProduct.isPending || updateProduct.isPending}
        mode={formMode}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El producto "{selectedProduct?.name}" 
              será eliminado permanentemente de tu catálogo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteProduct.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Eliminar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}