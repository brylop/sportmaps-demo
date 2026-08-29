import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Settings, Plus, Pencil, ArrowLeft } from 'lucide-react';
import { useTrialClasses, type TrialClassCategory } from '@/hooks/useTrialClasses';

export interface TrialClassSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type CategoryForm = {
  id?: string;
  name: string;
  description: string;
  price: string;
  is_active: boolean;
};

const EMPTY_FORM: CategoryForm = { name: '', description: '', price: '0', is_active: true };

export function TrialClassSettingsModal({ open, onOpenChange }: TrialClassSettingsModalProps) {
  const {
    settings, saveSettings,
    categories, isLoadingCategories,
    createCategory, isCreatingCategory,
    updateCategory, isUpdatingCategory,
    setCategoryActive,
  } = useTrialClasses();

  const [form, setForm] = useState<CategoryForm | null>(null);

  const handleToggleEnabled = (enabled: boolean) => {
    saveSettings({ enabled, requires_approval: settings?.requires_approval ?? false });
  };

  const openNewCategory = () => setForm(EMPTY_FORM);
  const openEditCategory = (c: TrialClassCategory) => setForm({
    id: c.id, name: c.name, description: c.description ?? '', price: String(c.price), is_active: c.is_active,
  });

  const handleSaveCategory = async () => {
    if (!form) return;
    const price = Number(form.price);
    if (!form.name.trim() || Number.isNaN(price) || price < 0) return;

    const payload = { name: form.name.trim(), description: form.description.trim() || undefined, price, is_active: form.is_active };
    if (form.id) {
      await updateCategory({ id: form.id, ...payload });
    } else {
      await createCategory(payload);
    }
    setForm(null);
  };

  const isSavingCategory = isCreatingCategory || isUpdatingCategory;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setForm(null); }}>
      <DialogContent className="sm:max-w-xl bg-card text-card-foreground border-border/40 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            {form && (
              <Button variant="ghost" size="icon" className="h-7 w-7 -ml-1" onClick={() => setForm(null)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <Settings className="h-5 w-5 text-primary" />
            {form ? (form.id ? 'Editar categoría' : 'Nueva categoría') : 'Clases de Prueba'}
          </DialogTitle>
          {!form && (
            <DialogDescription className="text-muted-foreground/80">
              Configura si tu escuela ofrece clases de prueba y qué categorías (con su propio precio) puede elegir el owner al agendar.
            </DialogDescription>
          )}
        </DialogHeader>

        {!form ? (
          <div className="space-y-6 py-2">
            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/30 p-4">
              <div>
                <p className="font-semibold text-sm">Habilitar clases de prueba</p>
                <p className="text-xs text-muted-foreground mt-0.5">Permite agendarlas desde este módulo.</p>
              </div>
              <Switch checked={settings?.enabled ?? true} onCheckedChange={handleToggleEnabled} />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold tracking-tight">Categorías</Label>
                <Button size="sm" variant="outline" className="h-8 font-semibold border-border/50" onClick={openNewCategory}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Nueva categoría
                </Button>
              </div>

              {isLoadingCategories ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : categories.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  Aún no hay categorías. Crea la primera para poder agendar clases de prueba.
                </p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {categories.map((c) => (
                    <div key={c.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/50 bg-muted/20 p-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm truncate">{c.name}</p>
                          {!c.is_active && <Badge variant="outline" className="text-[10px] py-0 text-muted-foreground">Inactiva</Badge>}
                        </div>
                        {c.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{c.description}</p>}
                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-500 mt-1">
                          {c.price > 0 ? `$${c.price.toLocaleString('es-CO')} COP` : 'Sin costo'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Switch checked={c.is_active} onCheckedChange={(v) => setCategoryActive({ id: c.id, is_active: v })} />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditCategory(c)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-5 py-2">
            <div className="space-y-3">
              <Label className="text-sm font-semibold tracking-tight">Nombre</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej. Clase individual"
                className="bg-muted/30 border-border/50 h-11"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-sm font-semibold tracking-tight">Descripción</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Se muestra al owner cuando elige esta categoría al agendar."
                className="bg-muted/30 border-border/50 min-h-20"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-sm font-semibold tracking-tight">Precio (COP)</Label>
              <div className="flex items-center border border-border/50 rounded-md h-11 bg-muted/30 overflow-hidden relative">
                <span className="absolute left-3 text-muted-foreground font-medium z-10 pointer-events-none">$</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={form.price && form.price !== '0' ? Number(form.price).toLocaleString('es-CO') : ''}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '');
                    setForm({ ...form, price: digits === '' ? '0' : digits });
                  }}
                  placeholder="0"
                  className="border-0 bg-transparent pl-7 h-full focus-visible:ring-0"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                $0 = sin costo. El cobro se coordina con el prospecto por fuera del sistema.
              </p>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/30 p-4">
              <p className="font-semibold text-sm">Activa</p>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
          </div>
        )}

        <DialogFooter>
          {form ? (
            <>
              <Button variant="outline" onClick={() => setForm(null)} className="font-medium border-border/50">Atrás</Button>
              <Button onClick={handleSaveCategory} disabled={isSavingCategory || !form.name.trim()} className="font-bold">
                {isSavingCategory && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Guardar categoría
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)} className="font-medium border-border/50">Cerrar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
