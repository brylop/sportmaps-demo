import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Pencil, ShieldOff, X, ShoppingBag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface CatalogItem {
  id: string;
  name: string;
  price: number;
  size_options?: string | null;
  image_url?: string | null;
  active: boolean;
}

interface SellableCatalogCardProps {
  schoolId: string;
  /** Tabla real detrás del catálogo — cada una tiene su propia RLS/gate en school_settings. */
  table: 'school_merchandise_items' | 'school_tournament_items';
  /** school_settings.merchandise_enabled / tournament_charges_enabled — SOLO SportMaps lo prende
      (guard trigger, ver 20260908152538); esta card nunca ofrece encenderlo. */
  enabled: boolean;
  title: string;
  description: string;
  /** Usado en los toasts y el formulario, ej. "artículo" / "cobro". */
  itemLabel: string;
  /** Artículos usa tallas + imagen; torneos no (no aplica a una cuota). */
  withSizesAndImage?: boolean;
}

/**
 * CRUD de un catálogo vendible (artículos deportivos, cobros de torneo) que la
 * propia escuela administra una vez SportMaps lo habilitó. Mismo componente lo
 * usa AdminSubscriptionsPage (soporte interno) y PaymentsAutomationPage
 * (self-service de la escuela) — ver migración 20260908152538.
 */
export function SellableCatalogCard({
  schoolId, table, enabled, title, description, itemLabel, withSizesAndImage = false,
}: SellableCatalogCardProps) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [sizes, setSizes] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setPrice('');
    setSizes('');
    setImageUrl('');
  };

  const load = async () => {
    setLoading(true);
    const cols = withSizesAndImage ? 'id, name, price, size_options, image_url, active' : 'id, name, price, active';
    const { data, error } = await supabase
      .from(table as any)
      .select(cols)
      .eq('school_id', schoolId)
      .order('sort_order', { ascending: true });
    if (error) toast({ title: 'Error cargando el catálogo', description: error.message, variant: 'destructive' });
    setItems(((data as any) || []) as CatalogItem[]);
    setLoading(false);
  };

  useEffect(() => {
    if (enabled && schoolId) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, enabled, table]);

  const startEdit = (item: CatalogItem) => {
    setEditingId(item.id);
    setName(item.name);
    setPrice(String(item.price));
    setSizes(item.size_options || '');
    setImageUrl(item.image_url || '');
  };

  const save = async () => {
    const trimmedName = name.trim();
    const parsedPrice = Number(price.replace(/\./g, '').replace(/,/g, ''));
    if (!trimmedName) { toast({ title: 'Falta el nombre', variant: 'destructive' }); return; }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) { toast({ title: 'Precio inválido', variant: 'destructive' }); return; }
    if (withSizesAndImage && imageUrl.trim() && !/^https:\/\//.test(imageUrl.trim())) {
      toast({ title: 'La imagen debe ser una URL https://', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const row: Record<string, unknown> = { school_id: schoolId, name: trimmedName, price: parsedPrice };
    if (withSizesAndImage) {
      row.size_options = sizes.trim() || null;
      row.image_url = imageUrl.trim() || null;
    }
    const { error } = editingId
      ? await supabase.from(table as any).update(row).eq('id', editingId)
      : await supabase.from(table as any).insert(row);
    setSaving(false);
    if (error) { toast({ title: 'No se pudo guardar', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editingId ? `${itemLabel} actualizado` : `${itemLabel} agregado`, description: trimmedName });
    resetForm();
    await load();
  };

  const toggleActive = async (item: CatalogItem) => {
    setSaving(true);
    const { error } = await supabase.from(table as any).update({ active: !item.active }).eq('id', item.id);
    setSaving(false);
    if (error) { toast({ title: 'No se pudo aplicar', description: error.message, variant: 'destructive' }); return; }
    await load();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {!enabled ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            SportMaps todavía no habilitó este catálogo para tu escuela. Contacta a soporte si lo necesitas.
          </div>
        ) : loading ? (
          <div className="py-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-3">
            {items.length > 0 && (
              <div className="space-y-1.5">
                {items.map((item) => (
                  <div key={item.id} className={`flex items-center gap-2 rounded-lg border p-2 ${!item.active ? 'opacity-50 bg-muted/30' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{item.name}</span>
                        {item.size_options && <span className="text-[11px] text-muted-foreground">{item.size_options}</span>}
                      </div>
                      <div className="text-xs text-primary font-semibold">${item.price.toLocaleString('es-CO')}</div>
                    </div>
                    <Badge variant={item.active ? 'secondary' : 'outline'} className="text-[10px] shrink-0">
                      {item.active ? 'Activo' : 'Inactivo'}
                    </Badge>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" disabled={saving} onClick={() => startEdit(item)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" disabled={saving} onClick={() => toggleActive(item)}>
                      <ShieldOff className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xl border border-dashed p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">{editingId ? `Editar ${itemLabel}` : `+ Agregar ${itemLabel}`}</p>
                {editingId && (
                  <Button size="sm" variant="ghost" className="h-6 px-2" onClick={resetForm}>
                    <X className="h-3 w-3 mr-1" /> Cancelar
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" />
                <Input placeholder="Precio (COP)" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} className="h-8 text-sm" />
                {withSizesAndImage && (
                  <>
                    <Input placeholder="Tallas, ej. S, M, L (opcional)" value={sizes} onChange={(e) => setSizes(e.target.value)} className="h-8 text-sm" />
                    <Input placeholder="Imagen https:// (opcional)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="h-8 text-sm" />
                  </>
                )}
              </div>
              <Button size="sm" disabled={saving} onClick={save}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                {editingId ? 'Guardar cambios' : 'Agregar'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
