import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useVendorProfile } from '@/hooks/useVendorProfile';
import { useCategories, useCategory, useBrands, productAttributes, variantAttributes, validateProductAttributes, ProductCategory } from '@/hooks/useCategories';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, Loader2, Sparkles, Image as ImageIcon, AlertTriangle, CheckCircle2, Tag, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DynamicAttributeField } from './DynamicAttributeField';
import { VariantMatrixBuilder } from './VariantMatrixBuilder';
import { ProductGalleryUploader } from './ProductGalleryUploader';
import {
    buildVariantRows, legacyMissingRequired, planVariantSave, productStatusLabel, type VendorVariant,
} from '@/lib/store/inventory';
import { adjustStock, createVariants, setVariantActive } from '@/lib/store/vendorProductsApi';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ─────────────────────────────────────────────────────────────────────────────
// Estado del wizard
// ─────────────────────────────────────────────────────────────────────────────
interface WizardState {
    category_slug?:     string;
    category_id?:       string;
    name:               string;
    description:        string;
    brand_id?:          string;
    price:              number | '';
    tax_rate:           number;
    weight_grams?:      number;
    image_url:          string;          // legacy: se llena automaticamente con images[0]
    images:             string[];         // galeria multi-imagen
    visibility:         'public' | 'school_only' | 'private';
    product_attrs:      Record<string, unknown>;
    has_variants:       boolean;
    variant_matrix:     Record<string, string[]>;
    /** Stock por combinación (clave = comboKey). */
    variant_stocks:     Record<string, number>;
    /** Activa/inactiva por combinación (solo lo que el usuario cambió). */
    variant_active:     Record<string, boolean>;
    variant_price_override?: number;
    base_stock:         number;
    /** Al editar: variantes que ya existen y estado actual del producto. */
    existing_variants:  VendorVariant[];
    current_status?:    string;
    /** Al editar: atributos y categoría con los que se cargó el producto. */
    loaded_attrs:       Record<string, unknown> | null;
    loaded_category_id?: string;
}

const INITIAL: WizardState = {
    name:             '',
    description:      '',
    price:            '',
    tax_rate:         0,
    image_url:        '',
    images:           [],
    visibility:       'public',
    product_attrs:    {},
    has_variants:     false,
    variant_matrix:   {},
    variant_stocks:   {},
    variant_active:   {},
    base_stock:       0,
    existing_variants: [],
    loaded_attrs:     null,
};

export function ProductWizard() {
    const { id: editId } = useParams<{ id: string }>();
    const isEdit = !!editId;
    const navigate = useNavigate();
    const { session } = useAuth();
    const { data: vendorProfile, canSellProducts } = useVendorProfile();
    const { toast } = useToast();

    const [step, setStep]             = useState(1);
    const [state, setState]           = useState<WizardState>(INITIAL);
    const [saving, setSaving]         = useState(false);
    const [productId, setProductId]   = useState<string | null>(editId || null);

    const { data: categories = [], isLoading: catsLoading } = useCategories();
    const { data: category }                                = useCategory(state.category_slug);
    const { data: brands = [] }                             = useBrands(state.category_id);

    // En edit mode, cargar producto existente
    useEffect(() => {
        if (!isEdit || !editId) return;

        (async () => {
            const { data, error } = await supabase
                .from('products')
                .select('*, product_categories(slug), product_variants(*)')
                .eq('id', editId)
                .maybeSingle();

            if (error || !data) {
                toast({ title: 'Error', description: 'No se pudo cargar el producto.', variant: 'destructive' });
                return;
            }

            const categorySlug = (data.product_categories as any)?.slug;
            const attrs = (data.attributes as any) || {};
            const variants: any[] = [...(data.product_variants || [])]
                .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

            // Rebuild variant_matrix from existing variants
            const matrix: Record<string, string[]> = {};
            for (const v of variants) {
                for (const [k, val] of Object.entries(v.attributes || {})) {
                    if (!matrix[k]) matrix[k] = [];
                    if (!matrix[k].includes(String(val))) matrix[k].push(String(val));
                }
            }

            // Reconstruir galeria desde attributes.images (nuevo) o image_url (legacy)
            const galleryImages: string[] = Array.isArray((attrs as any).images)
                ? (attrs as any).images
                : (data.image_url ? [data.image_url] : []);

            setState({
                category_slug:    categorySlug,
                category_id:      data.category_id,
                name:             data.name,
                description:      data.description || '',
                brand_id:         data.brand_id || undefined,
                price:            Number(data.price) || 0,
                tax_rate:         Number(data.tax_rate) || 0,
                weight_grams:     data.weight_grams || undefined,
                image_url:        galleryImages[0] || '',
                images:           galleryImages,
                visibility:       data.visibility || 'public',
                product_attrs:    attrs,
                has_variants:     variants.length > 0,
                variant_matrix:   matrix,
                variant_stocks:   {},
                variant_active:   {},
                base_stock:       data.stock || 0,
                existing_variants: variants.map((v: any) => ({
                    id: v.id, sku: v.sku ?? null, name: v.name, attributes: v.attributes || {},
                    price_override: v.price_override ?? null, stock: Number(v.stock ?? 0),
                    reserved: Number(v.reserved ?? 0), is_active: v.is_active, sort_order: v.sort_order,
                })),
                current_status:   data.status,
                loaded_attrs:     attrs,
                loaded_category_id: data.category_id || undefined,
            });
        })();
    }, [isEdit, editId, toast]);

    const productSchema  = category?.attribute_schema ? productAttributes(category.attribute_schema) : [];
    const variantSchema  = category?.attribute_schema ? variantAttributes(category.attribute_schema) : [];

    // Producto creado antes de que un atributo fuera obligatorio (ej. "Género"):
    // al editar, ese faltante avisa pero no traba el paso 2 ni el guardado.
    // Se deriva de los atributos con los que se CARGÓ el producto, solo mientras
    // siga en su categoría original.
    const legacyMissing = useMemo(
        () => (isEdit && category && state.loaded_attrs && category.id === state.loaded_category_id
            ? legacyMissingRequired(category.attribute_schema || [], state.loaded_attrs)
            : []),
        [isEdit, category, state.loaded_attrs, state.loaded_category_id],
    );
    const legacyLabels = useMemo(
        () => productSchema.filter(f => legacyMissing.includes(f.key)
            && validateProductAttributes([f], state.product_attrs).length > 0).map(f => f.label),
        [productSchema, legacyMissing, state.product_attrs],
    );
    const attrErrors = useMemo(
        () => (category
            ? validateProductAttributes(
                (category.attribute_schema || []).filter(f => !legacyMissing.includes(f.key)),
                state.product_attrs)
            : []),
        [category, state.product_attrs, legacyMissing],
    );

    // Filas de stock por variante (existentes + combinaciones nuevas).
    const missingAxes = variantSchema.filter(f => f.required && !(state.variant_matrix[f.key]?.length)).map(f => f.label);
    const variantRows = useMemo(
        () => buildVariantRows(
            variantSchema.map(f => f.key),
            missingAxes.length > 0 ? {} : state.variant_matrix,
            state.existing_variants,
            state.variant_stocks,
            state.variant_active,
        ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [variantSchema.map(f => f.key).join(','), missingAxes.join(','), state.variant_matrix, state.existing_variants,
         state.variant_stocks, state.variant_active],
    );
    const variantsOk = !state.has_variants
        || (variantRows.some(r => r.is_active) && variantRows.length <= 200
            && variantRows.every(r => !r.variant_id || !r.is_active || r.stock >= r.reserved));

    // Requisitos de calidad para publicar (los valida también la base).
    const publishIssues = [
        state.name.length < 5 && 'Nombre de al menos 5 caracteres',
        state.description.length < 30 && 'Descripción de al menos 30 caracteres',
        !(typeof state.price === 'number' && state.price > 0) && 'Precio mayor a 0',
        state.images.length === 0 && 'Al menos una foto',
    ].filter(Boolean) as string[];

    const canGoStep2 = !!state.category_id;
    // Crear: todo lo de calidad. Editar: nombre y precio bastan para guardar;
    // lo demás se muestra como pendiente para publicar.
    const canGoStep3 = attrErrors.length === 0 && (isEdit
        ? state.name.length >= 5 && typeof state.price === 'number' && state.price > 0
        : publishIssues.length === 0);
    const canSave    = canGoStep2 && canGoStep3 && variantsOk;
    const canPublish = canSave && publishIssues.length === 0;
    const isActiveProduct = isEdit && state.current_status === 'active';

    // ─────────────────────────────────────────────────────────────────────
    // Guardar
    // ─────────────────────────────────────────────────────────────────────
    const saveAsDraft  = () => persistProduct({ publish: false });
    const saveAndPublish = () => persistProduct({ publish: true });

    async function persistProduct({ publish }: { publish: boolean }) {
        if (!canSellProducts) {
            toast({ title: 'Tu cuenta no puede vender productos', description: 'Activa la capacidad de venta de productos en Mi Tienda.', variant: 'destructive' });
            return;
        }

        setSaving(true);
        try {
            // attributes incluye atributos dinamicos + galeria de imagenes
            const mergedAttrs = {
                ...state.product_attrs,
                images: state.images,
            };

            const payload = {
                name:              state.name,
                description:       state.description,
                price:             typeof state.price === 'number' ? state.price : 0,
                tax_rate:          state.tax_rate,
                weight_grams:      state.weight_grams || null,
                image_url:         state.images[0] || null,    // legacy: primera imagen
                visibility:        state.visibility,
                category_id:       state.category_id || null,
                brand_id:          state.brand_id || null,
                attributes:        mergedAttrs,
                // Con variantes, el stock es de cada variante (products.stock es la suma).
                ...(state.has_variants ? (isEdit ? {} : { stock: 0 }) : { stock: state.base_stock }),
                // Al editar no se toca el estado (guardar un producto activo no lo despublica).
                ...(isEdit ? {} : { vendor_profile_id: vendorProfile?.id || null, status: 'draft' }),
            };

            let createdProductId = productId;

            if (!createdProductId) {
                const res = await fetch(`${API_URL}/api/v1/vendor/products`, {
                    method:  'POST',
                    headers: {
                        'Content-Type':  'application/json',
                        'Authorization': `Bearer ${session?.access_token}`,
                    },
                    body: JSON.stringify(payload),
                });
                const json = await res.json();
                if (!res.ok || !json.ok) throw new Error(json?.error || 'Error creando producto.');
                createdProductId = json.data.id;
                setProductId(createdProductId);
            } else {
                const res = await fetch(`${API_URL}/api/v1/vendor/products/${createdProductId}`, {
                    method:  'PATCH',
                    headers: {
                        'Content-Type':  'application/json',
                        'Authorization': `Bearer ${session?.access_token}`,
                    },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) {
                    const j = await res.json().catch(() => ({}));
                    throw new Error(j?.error || 'Error actualizando producto.');
                }
            }

            // Variantes: nuevas con SU stock inicial; las existentes, ajuste de
            // inventario (kardex) si cambió el stock; activar/desactivar.
            if (state.has_variants && createdProductId) {
                const token = session?.access_token;
                const plan = planVariantSave(variantRows, state.existing_variants, state.variant_price_override ?? null);
                const failures: string[] = [];
                if (plan.create.length > 0) {
                    try {
                        await createVariants(token, createdProductId, plan.create);
                    } catch (e) {
                        failures.push((e as Error).message);
                    }
                }
                for (const a of plan.adjust) {
                    try {
                        await adjustStock(token, createdProductId, {
                            variant_id: a.variant_id, new_stock: a.to, reason_code: a.reason_code,
                            note: 'Edición del producto',
                        });
                    } catch (e) {
                        const label = variantRows.find(r => r.variant_id === a.variant_id)?.label ?? 'variante';
                        failures.push(`${label}: ${(e as Error).message}`);
                    }
                }
                for (const t of plan.toggle) {
                    try {
                        await setVariantActive(token, createdProductId, t.variant_id, t.is_active);
                    } catch (e) {
                        failures.push((e as Error).message);
                    }
                }
                if (failures.length > 0) {
                    toast({ title: 'Algunas variantes no se guardaron', description: failures.join(' · '), variant: 'destructive' });
                    setSaving(false);
                    if (!isEdit) navigate(`/vendor/products/${createdProductId}/edit`, { replace: true });
                    return;
                }
            }

            if (publish) {
                const res = await fetch(`${API_URL}/api/v1/vendor/products/${createdProductId}/publish`, {
                    method:  'POST',
                    headers: { 'Authorization': `Bearer ${session?.access_token}` },
                });
                const json = await res.json();
                if (!res.ok) {
                    if (res.status === 422) {
                        toast({ title: 'Producto no cumple calidad', description: json.error, variant: 'destructive' });
                        setSaving(false);
                        return;
                    }
                    throw new Error('Error publicando producto.');
                }
                toast({
                    title:       json.data.status === 'pending_review' ? 'Producto en revisión' : 'Producto publicado',
                    description: json.message,
                });
            } else if (isEdit) {
                toast({ title: 'Cambios guardados', description: state.name });
            } else {
                toast({ title: 'Borrador guardado', description: 'Puedes publicarlo cuando quieras.' });
            }

            navigate('/vendor/products');
        } catch (err: any) {
            toast({ title: 'Error', description: err?.message || 'No se pudo guardar.', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────
    return (
        <div className="container mx-auto p-4 max-w-4xl space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Package className="h-6 w-6 text-primary" />
                        {isEdit ? 'Editar producto' : 'Nuevo producto'}
                    </h1>
                    <p className="text-sm text-muted-foreground">Paso {step} de 4</p>
                </div>
                <div className="flex gap-1.5">
                    {[1, 2, 3, 4].map(s => (
                        <div key={s} className={`h-1.5 w-10 rounded-full transition-colors ${step >= s ? 'bg-primary' : 'bg-slate-200'}`} />
                    ))}
                </div>
            </header>

            {/* PASO 1: Categoría */}
            {step === 1 && (
                <Card>
                    <CardHeader>
                        <CardTitle>¿Qué vas a vender?</CardTitle>
                        <CardDescription>Elige la categoría que mejor describe tu producto. Esto determina los campos que pediremos después.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {catsLoading ? (
                            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {categories.map((c: ProductCategory) => {
                                    const active = state.category_slug === c.slug;
                                    return (
                                        <button
                                            key={c.id}
                                            type="button"
                                            onClick={() => setState(s => ({
                                                ...s,
                                                category_slug: c.slug,
                                                category_id:   c.id,
                                                product_attrs: s.category_id === c.id ? s.product_attrs : {},
                                                brand_id:      s.category_id === c.id ? s.brand_id : undefined,
                                            }))}
                                            className={`text-left rounded-lg border p-4 transition-colors hover:bg-muted ${active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border'}`}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-2xl">{c.icon === 'shirt' ? '👕'
                                                  : c.icon === 'footprints' ? '👟'
                                                  : c.icon === 'pill' ? '💊'
                                                  : c.icon === 'apple' ? '🍎'
                                                  : c.icon === 'dumbbell' ? '🏋️'
                                                  : c.icon === 'glasses' ? '🕶️'
                                                  : c.icon === 'briefcase' ? '💼'
                                                  : '📦'}</span>
                                                <span className="font-semibold">{c.name}</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground">{c.attribute_schema?.length || 0} atributos</p>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {step >= 2 && !category && (
                <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Elige una categoría</AlertTitle>
                    <AlertDescription className="text-xs">
                        La categoría de este producto ya no está disponible. Vuelve al paso 1 y elige otra.
                    </AlertDescription>
                </Alert>
            )}

            {/* PASO 2: Información básica + atributos producto */}
            {step === 2 && category && (
                <Card>
                    <CardHeader>
                        <CardTitle>Información básica</CardTitle>
                        <CardDescription>
                            Categoría: <Badge variant="outline">{category.name}</Badge>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div>
                            <Label>Nombre del producto *</Label>
                            <Input value={state.name} onChange={e => setState(s => ({ ...s, name: e.target.value }))}
                                   placeholder="Ej: Tenis Nike Air Zoom Pegasus 40" />
                            <p className="text-xs text-muted-foreground mt-1">Mínimo 5 caracteres.</p>
                        </div>

                        <div>
                            <Label>Descripción *</Label>
                            <Textarea rows={4} value={state.description} onChange={e => setState(s => ({ ...s, description: e.target.value }))}
                                      placeholder="¿Qué hace especial este producto? ¿Para quién es? Materiales, usos, garantía..." />
                            <p className="text-xs text-muted-foreground mt-1">Mínimo 30 caracteres ({state.description.length}/30).</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Marca</Label>
                                <Select value={state.brand_id || ''} onValueChange={v => setState(s => ({ ...s, brand_id: v || undefined }))}>
                                    <SelectTrigger><SelectValue placeholder="Elige marca" /></SelectTrigger>
                                    <SelectContent>
                                        {brands.map(b => (
                                            <SelectItem key={b.id} value={b.id}>
                                                <span className="flex items-center gap-1.5">
                                                    {b.name}
                                                    {b.is_official && <span className="text-[10px]">✓</span>}
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Precio (COP) *</Label>
                                <Input type="number" min={0} value={state.price}
                                       onChange={e => setState(s => ({ ...s, price: e.target.value === '' ? '' : Number(e.target.value) }))}
                                       placeholder="120000" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>IVA (%)</Label>
                                <Input type="number" min={0} max={100} step="0.01" value={state.tax_rate * 100}
                                       onChange={e => setState(s => ({ ...s, tax_rate: Number(e.target.value) / 100 }))}
                                       placeholder="19" />
                            </div>
                            <div>
                                <Label>Peso de envío (g)</Label>
                                <Input type="number" min={0} value={state.weight_grams ?? ''}
                                       onChange={e => setState(s => ({ ...s, weight_grams: e.target.value === '' ? undefined : Number(e.target.value) }))}
                                       placeholder="500" />
                            </div>
                        </div>

                        <ProductGalleryUploader
                            images={state.images}
                            onChange={imgs => setState(s => ({ ...s, images: imgs, image_url: imgs[0] || '' }))}
                            vendorId={vendorProfile?.id}
                        />

                        {/* Atributos dinámicos del producto */}
                        {productSchema.length > 0 && (
                            <div className="space-y-3 border-t pt-4">
                                <h4 className="text-sm font-medium flex items-center gap-1.5">
                                    <Sparkles className="h-4 w-4 text-purple-500" /> Atributos de {category.name}
                                </h4>
                                {productSchema.map(f => (
                                    <DynamicAttributeField
                                        key={f.key}
                                        field={f}
                                        value={state.product_attrs[f.key]}
                                        onChange={v => setState(s => ({ ...s, product_attrs: { ...s.product_attrs, [f.key]: v } }))}
                                    />
                                ))}
                            </div>
                        )}

                        {legacyLabels.length > 0 && (
                            <Alert data-testid="legacy-attrs-alert">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Dato nuevo sin completar</AlertTitle>
                                <AlertDescription className="text-xs">
                                    Este producto se creó antes de que {legacyLabels.join(', ')} fuera obligatorio.
                                    Complétalo cuando puedas; no impide guardar los cambios.
                                </AlertDescription>
                            </Alert>
                        )}

                        {isEdit && publishIssues.length > 0 && (
                            <Alert>
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Para publicar falta</AlertTitle>
                                <AlertDescription>
                                    <ul className="list-disc pl-5 text-xs space-y-0.5">
                                        {publishIssues.map((e, i) => <li key={i}>{e}</li>)}
                                    </ul>
                                </AlertDescription>
                            </Alert>
                        )}

                        {attrErrors.length > 0 && (
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Faltan campos requeridos</AlertTitle>
                                <AlertDescription>
                                    <ul className="list-disc pl-5 text-xs space-y-0.5">
                                        {attrErrors.map((e, i) => <li key={i}>{e}</li>)}
                                    </ul>
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* PASO 3: Variantes */}
            {step === 3 && category && (
                <Card>
                    <CardHeader>
                        <CardTitle>Variantes y stock</CardTitle>
                        <CardDescription>¿Tu producto tiene tallas, colores, sabores u otras variantes? Si no, gestiona stock único.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                                <p className="text-sm font-medium">Este producto tiene variantes</p>
                                <p className="text-xs text-muted-foreground">Ej: distintas tallas, colores, sabores, presentaciones.</p>
                            </div>
                            <Switch checked={state.has_variants}
                                    disabled={state.existing_variants.length > 0}
                                    aria-label="Este producto tiene variantes"
                                    onCheckedChange={c => setState(s => ({ ...s, has_variants: c }))} />
                        </div>

                        {!state.has_variants ? (
                            <div>
                                <Label htmlFor="base-stock">Stock disponible</Label>
                                <Input id="base-stock" type="number" min={0} value={state.base_stock}
                                       onChange={e => setState(s => ({ ...s, base_stock: Math.max(0, Math.trunc(Number(e.target.value) || 0)) }))} />
                                {isEdit && <p className="text-xs text-muted-foreground mt-1">El cambio queda en el historial de inventario.</p>}
                            </div>
                        ) : (
                            <VariantMatrixBuilder
                                schema={variantSchema}
                                matrix={state.variant_matrix}
                                onChange={m => setState(s => ({ ...s, variant_matrix: m }))}
                                rows={variantRows}
                                onStockChange={(key, n) => setState(s => ({ ...s, variant_stocks: { ...s.variant_stocks, [key]: n } }))}
                                onActiveChange={(key, a) => setState(s => ({ ...s, variant_active: { ...s.variant_active, [key]: a } }))}
                                onApplyAll={n => setState(s => ({
                                    ...s,
                                    variant_stocks: Object.fromEntries(variantRows.filter(r => r.is_active).map(r => [r.key, n])),
                                }))}
                                priceOverride={state.variant_price_override}
                                onPriceOverrideChange={v => setState(s => ({ ...s, variant_price_override: v }))}
                                missingAxes={missingAxes}
                                isEdit={isEdit}
                            />
                        )}
                    </CardContent>
                </Card>
            )}

            {/* PASO 4: Publicación */}
            {step === 4 && category && (
                <Card>
                    <CardHeader>
                        <CardTitle>Listo para publicar</CardTitle>
                        <CardDescription>Revisa y elige cómo se publica.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="rounded-lg border p-4 space-y-2 bg-muted/30">
                            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Categoría</span><span className="text-sm font-medium">{category.name}</span></div>
                            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Nombre</span><span className="text-sm font-medium truncate max-w-[60%]">{state.name}</span></div>
                            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Precio</span><span className="text-sm font-medium">${typeof state.price === 'number' ? state.price.toLocaleString('es-CO') : '—'} COP</span></div>
                            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Variantes</span><span className="text-sm font-medium">{state.has_variants
                                ? `${variantRows.filter(r => r.is_active).length} combinaciones · ${variantRows.filter(r => r.is_active).reduce((a, r) => a + r.stock, 0)} unidades`
                                : `Producto único · ${state.base_stock} unidades`}</span></div>
                            {isEdit && state.current_status && (
                                <div className="flex justify-between"><span className="text-sm text-muted-foreground">Estado</span><span className="text-sm font-medium">{productStatusLabel(state.current_status)}</span></div>
                            )}
                        </div>

                        <div>
                            <Label>Visibilidad</Label>
                            <Select value={state.visibility} onValueChange={(v: any) => setState(s => ({ ...s, visibility: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="public">Público — todo el marketplace lo ve</SelectItem>
                                    <SelectItem value="school_only">Solo mi escuela</SelectItem>
                                    <SelectItem value="private">Privado (no listado)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {vendorProfile?.verification_status !== 'verified' && (
                            <Alert>
                                <Tag className="h-4 w-4" />
                                <AlertTitle>Tu cuenta no está verificada</AlertTitle>
                                <AlertDescription>
                                    Tu primer producto pasará por revisión admin antes de aparecer público. Acelera verificándote desde "Mi Tienda → Verificación".
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Navegación */}
            <div className="flex items-center justify-between gap-2">
                <Button variant="outline" onClick={() => step > 1 ? setStep(s => s - 1) : navigate('/vendor/products')}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    {step === 1 ? 'Cancelar' : 'Atrás'}
                </Button>

                {step < 4 ? (
                    <Button
                        onClick={() => setStep(s => s + 1)}
                        disabled={(step === 1 && !canGoStep2) || (step === 2 && !canGoStep3) || (step >= 2 && !category)}
                    >
                        Siguiente
                        <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                ) : (
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={saveAsDraft} disabled={saving || !canSave}>
                            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                            {isEdit ? 'Guardar cambios' : 'Guardar borrador'}
                        </Button>
                        {!isActiveProduct && (
                            <Button onClick={saveAndPublish} disabled={saving || !canPublish}>
                                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                                Publicar ahora
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
