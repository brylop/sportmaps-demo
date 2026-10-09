import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Package, Edit, Archive, Loader2, Search, SlidersHorizontal } from 'lucide-react';
import { useMyStoreProducts } from '@/hooks/useMyStoreProducts';
import {
    PRODUCT_STATUSES, PRODUCT_STATUS_LABELS, STOCK_LEVEL_LABELS, filterProducts, formatCOP, productCategoryName,
    productStatusLabel, productStatusVariant, stockByCategory, type VendorProduct,
} from '@/lib/store/inventory';
import { StockAdjustDialog } from '@/components/store/inventory/StockAdjustDialog';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function VendorProductsPage() {
    const { session } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const { products, isLoading, error, invalidate } = useMyStoreProducts();
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('all');
    const [category, setCategory] = useState('all');
    const [level, setLevel] = useState('all');
    const [adjust, setAdjust] = useState<VendorProduct | null>(null);

    const categories = useMemo(() => stockByCategory(products).map((c) => c.category), [products]);
    // Por defecto no se muestran los archivados (siguen a un filtro de distancia).
    const visible = useMemo(() => {
        const base = status === 'all' ? products.filter((p) => p.status !== 'archived') : products;
        return filterProducts(base, { search, status, category, level });
    }, [products, search, status, category, level]);
    const countBy = (s: string) => products.filter((p) => p.status === s).length;

    const handleArchive = async (p: VendorProduct) => {
        try {
            const res = await fetch(`${API_URL}/api/v1/vendor/products/${p.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${session?.access_token}` },
            });
            if (!res.ok) throw new Error('No se pudo archivar.');
            toast({ title: 'Producto archivado', description: p.name });
            invalidate();
        } catch (err) {
            toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
        }
    };

    return (
        <div className="container mx-auto px-4 py-6 max-w-5xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Mis productos</h1>
                    <p className="text-muted-foreground">Tu catálogo, con el stock real de cada talla y color</p>
                </div>
                <Button onClick={() => navigate('/vendor/products/new')}>
                    <Plus className="h-4 w-4 mr-2" /> Nuevo producto
                </Button>
            </div>

            {products.length > 0 && (
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap mb-4">
                    <div className="relative sm:w-56">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                    </div>
                    <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger className="sm:w-44" aria-label="Estado"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos (sin archivados)</SelectItem>
                            {PRODUCT_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>{PRODUCT_STATUS_LABELS[s]} ({countBy(s)})</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger className="sm:w-48" aria-label="Categoría"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas las categorías</SelectItem>
                            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={level} onValueChange={setLevel}>
                        <SelectTrigger className="sm:w-40" aria-label="Stock"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todo el stock</SelectItem>
                            <SelectItem value="low">{STOCK_LEVEL_LABELS.low}</SelectItem>
                            <SelectItem value="out">{STOCK_LEVEL_LABELS.out}</SelectItem>
                            <SelectItem value="ok">{STOCK_LEVEL_LABELS.ok}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}

            {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : error ? (
                <Card><CardContent className="py-8 text-center text-sm text-destructive">No se pudieron cargar los productos: {error.message}</CardContent></Card>
            ) : products.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                        <h3 className="font-semibold mb-2">No tienes productos aún</h3>
                        <p className="text-muted-foreground text-sm mb-4">Agrega tu primer producto para que aparezca en tu tienda</p>
                        <Button onClick={() => navigate('/vendor/products/new')}><Plus className="h-4 w-4 mr-2" /> Crear producto</Button>
                    </CardContent>
                </Card>
            ) : visible.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No hay productos con esos filtros.</CardContent></Card>
            ) : (
                <div className="grid gap-3">
                    {visible.map((product) => (
                        <Card key={product.id} data-testid="vendor-product-card" data-product-name={product.name}>
                            <CardContent className="p-4 flex items-start sm:items-center gap-4">
                                {product.image_url ? (
                                    <img src={product.image_url} alt={product.name} className="w-16 h-16 rounded-lg object-cover shrink-0" />
                                ) : (
                                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                        <Package className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <h3 className="font-semibold">{product.name}</h3>
                                        <Badge variant={productStatusVariant(product.status)} data-testid="product-status">
                                            {productStatusLabel(product.status)}
                                        </Badge>
                                        <Badge variant="outline">{productCategoryName(product)}</Badge>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                        <span>{formatCOP(product.price)}</span>
                                        <span data-testid="product-stock">
                                            Stock: <strong className={product.stock_level === 'out' ? 'text-destructive' : product.stock_level === 'low' ? 'text-amber-600' : 'text-foreground'}>
                                                {product.stock_total}
                                            </strong>
                                            {product.stock_level !== 'ok' && ` (${STOCK_LEVEL_LABELS[product.stock_level].toLowerCase()})`}
                                        </span>
                                        {product.has_variants && (
                                            <span>{product.product_variants.filter((v) => v.is_active !== false).length} variantes</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    <Button variant="ghost" size="icon" onClick={() => setAdjust(product)} aria-label={`Ajustar stock de ${product.name}`}>
                                        <SlidersHorizontal className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => navigate(`/vendor/products/${product.id}/edit`)} aria-label={`Editar ${product.name}`}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    {product.status !== 'archived' && (
                                        <Button variant="ghost" size="icon" onClick={() => handleArchive(product)} aria-label={`Archivar ${product.name}`}>
                                            <Archive className="h-4 w-4 text-destructive" />
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <StockAdjustDialog product={adjust} open={!!adjust} onOpenChange={(o) => { if (!o) setAdjust(null); }} onDone={invalidate} />
        </div>
    );
}
