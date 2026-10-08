import { Fragment, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    Package, AlertTriangle, Boxes, PackageX, Loader2, Search, ChevronDown, ChevronRight, History, SlidersHorizontal, Plus,
} from 'lucide-react';
import { useMyStoreProducts } from '@/hooks/useMyStoreProducts';
import {
    STOCK_LEVEL_LABELS, filterProducts, productCategoryName, productStatusLabel, stockByCategory, stockLevel,
    variantAvailable, type StockLevel, type VendorProduct,
} from '@/lib/store/inventory';
import { StockAdjustDialog } from '@/components/store/inventory/StockAdjustDialog';
import { KardexDialog } from '@/components/store/inventory/KardexDialog';

function LevelBadge({ level }: { level: StockLevel }) {
    if (level === 'out') return <Badge variant="destructive">{STOCK_LEVEL_LABELS.out}</Badge>;
    if (level === 'low') return <Badge className="bg-amber-500 hover:bg-amber-500 text-white">{STOCK_LEVEL_LABELS.low}</Badge>;
    return <Badge variant="outline">{STOCK_LEVEL_LABELS.ok}</Badge>;
}

export default function StoreInventoryPage() {
    const navigate = useNavigate();
    const { products, isLoading, error, invalidate } = useMyStoreProducts();
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('all');
    const [level, setLevel] = useState('all');
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [adjust, setAdjust] = useState<{ product: VendorProduct; variantId?: string | null } | null>(null);
    const [kardex, setKardex] = useState<VendorProduct | null>(null);

    // El inventario es de lo que se vende: sin archivados.
    const live = useMemo(() => products.filter((p) => p.status !== 'archived'), [products]);
    const categories = useMemo(() => stockByCategory(live), [live]);
    const filtered = useMemo(() => filterProducts(live, { search, category, level }), [live, search, category, level]);

    const totalUnits = live.reduce((s, p) => s + Number(p.stock_total ?? 0), 0);
    const lowCount = live.filter((p) => p.stock_level === 'low').length;
    const outCount = live.filter((p) => p.stock_level === 'out').length;
    const lowList = live
        .filter((p) => p.stock_level !== 'ok' || p.low_stock_variants > 0 || p.out_of_stock_variants > 0)
        .sort((a, b) => a.available_total - b.available_total)
        .slice(0, 8);
    const maxCatUnits = Math.max(1, ...categories.map((c) => c.units));

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Inventario</h1>
                    <p className="text-muted-foreground">Stock por producto y por talla/color. Cada ajuste queda en el historial.</p>
                </div>
                <Button onClick={() => navigate('/vendor/products/new')} className="gap-2">
                    <Plus className="h-4 w-4" /> Nuevo producto
                </Button>
            </div>

            {error && (
                <Card className="border-destructive/40">
                    <CardContent className="p-4 text-sm text-destructive">
                        No se pudo cargar el inventario: {error.message}
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                {[
                    { label: 'Productos', value: live.length, icon: Package, tone: 'bg-primary/10 text-primary' },
                    { label: 'Unidades en stock', value: totalUnits.toLocaleString('es-CO'), icon: Boxes, tone: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10' },
                    { label: 'Stock bajo', value: lowCount, icon: AlertTriangle, tone: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10' },
                    { label: 'Agotados', value: outCount, icon: PackageX, tone: 'bg-red-50 text-destructive dark:bg-red-500/10' },
                ].map((k) => (
                    <Card key={k.label} className="border-border/50">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${k.tone}`}>
                                    <k.icon className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">{k.label}</p>
                                    <p className="text-2xl font-bold" data-testid={`kpi-${k.label}`}>{k.value}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            Por reponer
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">Según el mínimo de cada producto (alerta de stock).</p>
                    </CardHeader>
                    <CardContent>
                        {lowList.length === 0 ? (
                            <p className="text-muted-foreground text-center py-6 text-sm">Todos los productos están por encima de su mínimo.</p>
                        ) : (
                            <div className="space-y-3">
                                {lowList.map((p) => (
                                    <div key={p.id} className="flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="font-medium truncate">{p.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {productCategoryName(p)} · mínimo {p.min_stock_alert ?? 5}
                                                {p.has_variants && (p.low_stock_variants + p.out_of_stock_variants) > 0 &&
                                                    ` · ${p.low_stock_variants + p.out_of_stock_variants} variante(s) en alerta`}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-sm font-semibold">{p.available_total} u.</span>
                                            <Button size="sm" variant="outline" onClick={() => setAdjust({ product: p })}>Reponer</Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Package className="h-5 w-5" />
                            Stock por categoría
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {categories.length === 0 ? (
                            <p className="text-muted-foreground text-center py-6 text-sm">Todavía no hay productos.</p>
                        ) : (
                            <div className="space-y-4" data-testid="stock-por-categoria">
                                {categories.map((c) => (
                                    <div key={c.category} className="space-y-1.5">
                                        <div className="flex justify-between text-sm">
                                            <span>{c.category} <span className="text-muted-foreground">({c.products})</span></span>
                                            <span className="text-muted-foreground">{c.units.toLocaleString('es-CO')} unidades</span>
                                        </div>
                                        <Progress value={(c.units / maxCatUnits) * 100} className="h-2" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <CardTitle className="text-base">Productos ({filtered.length})</CardTitle>
                        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                            <div className="relative sm:w-56">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Buscar producto o talla…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                            </div>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger className="sm:w-48" aria-label="Categoría"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas las categorías</SelectItem>
                                    {categories.map((c) => <SelectItem key={c.category} value={c.category}>{c.category}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={level} onValueChange={setLevel}>
                                <SelectTrigger className="sm:w-40" aria-label="Nivel de stock"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todo el stock</SelectItem>
                                    <SelectItem value="low">{STOCK_LEVEL_LABELS.low}</SelectItem>
                                    <SelectItem value="out">{STOCK_LEVEL_LABELS.out}</SelectItem>
                                    <SelectItem value="ok">{STOCK_LEVEL_LABELS.ok}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    {filtered.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8 text-sm">No hay productos con esos filtros.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Producto</TableHead>
                                    <TableHead className="hidden md:table-cell">Categoría</TableHead>
                                    <TableHead className="text-right">Stock</TableHead>
                                    <TableHead className="text-right hidden sm:table-cell">Disponible</TableHead>
                                    <TableHead>Nivel</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((p) => {
                                    const open = !!expanded[p.id];
                                    return (
                                        <Fragment key={p.id}>
                                            <TableRow data-testid="inventory-row" data-product-name={p.name}>
                                                <TableCell>
                                                    <button
                                                        type="button"
                                                        className="flex items-center gap-1.5 text-left disabled:cursor-default"
                                                        disabled={!p.has_variants}
                                                        onClick={() => setExpanded((e) => ({ ...e, [p.id]: !open }))}
                                                        aria-expanded={p.has_variants ? open : undefined}
                                                        aria-label={p.has_variants ? `Ver variantes de ${p.name}` : undefined}
                                                    >
                                                        {p.has_variants
                                                            ? (open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />)
                                                            : <span className="w-4" />}
                                                        <span>
                                                            <span className="font-medium block">{p.name}</span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {p.has_variants ? `${p.product_variants.filter((v) => v.is_active !== false).length} variantes` : 'Sin variantes'}
                                                                {p.status !== 'active' && ` · ${productStatusLabel(p.status)}`}
                                                            </span>
                                                        </span>
                                                    </button>
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell"><Badge variant="secondary">{productCategoryName(p)}</Badge></TableCell>
                                                <TableCell className="text-right font-semibold" data-testid="inventory-stock">{p.stock_total}</TableCell>
                                                <TableCell className="text-right hidden sm:table-cell">{p.available_total}</TableCell>
                                                <TableCell><LevelBadge level={p.stock_level} /></TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button size="sm" variant="ghost" onClick={() => setAdjust({ product: p })} aria-label={`Ajustar stock de ${p.name}`}>
                                                            <SlidersHorizontal className="h-4 w-4" /><span className="hidden lg:inline ml-1">Ajustar</span>
                                                        </Button>
                                                        <Button size="sm" variant="ghost" onClick={() => setKardex(p)} aria-label={`Historial de ${p.name}`}>
                                                            <History className="h-4 w-4" /><span className="hidden lg:inline ml-1">Historial</span>
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                            {open && p.product_variants.map((v) => {
                                                const avail = variantAvailable(v);
                                                const lvl = stockLevel(avail, p.min_stock_alert ?? 5);
                                                return (
                                                    <TableRow key={v.id} className="bg-muted/30" data-testid="inventory-variant-row" data-variant-name={v.name}>
                                                        <TableCell className="pl-10 text-sm">
                                                            {v.name}
                                                            {v.is_active === false && <span className="text-xs text-muted-foreground"> · inactiva</span>}
                                                        </TableCell>
                                                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{v.sku}</TableCell>
                                                        <TableCell className="text-right" data-testid="variant-stock">{v.stock}</TableCell>
                                                        <TableCell className="text-right hidden sm:table-cell">{avail}</TableCell>
                                                        <TableCell>{v.is_active !== false && <LevelBadge level={lvl} />}</TableCell>
                                                        <TableCell className="text-right">
                                                            {v.is_active !== false && (
                                                                <Button size="sm" variant="ghost" onClick={() => setAdjust({ product: p, variantId: v.id })}
                                                                        aria-label={`Ajustar ${v.name}`}>
                                                                    <SlidersHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </Fragment>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <StockAdjustDialog
                product={adjust?.product ?? null}
                variantId={adjust?.variantId}
                open={!!adjust}
                onOpenChange={(o) => { if (!o) setAdjust(null); }}
                onDone={invalidate}
            />
            <KardexDialog product={kardex} open={!!kardex} onOpenChange={(o) => { if (!o) setKardex(null); }} />
        </div>
    );
}
