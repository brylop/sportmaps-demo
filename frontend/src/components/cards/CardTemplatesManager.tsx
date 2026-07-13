import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Star, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AthleteIdCard, type CardData } from '@/components/cards/AthleteIdCard';

export type CardTemplate = {
  id?: string;
  school_id?: string;
  name: string;
  accent_color: string | null;
  header_text: string | null;
  footer_text: string | null;
  show_fields: Record<string, boolean>;
  is_default: boolean;
  active: boolean;
};

const FIELD_LABELS: [string, string][] = [
  ['photo', 'Foto'],
  ['doc_number', 'Documento'],
  ['team', 'Equipo'],
  ['branch', 'Sede'],
  ['valid_until', 'Vigencia'],
  ['fee_status', 'Estado de cuota'],
  ['blood_type', 'RH (tipo de sangre)'],
  ['eps', 'EPS'],
  ['tshirt_size', 'Talla'],
  ['emergency_contact', 'Contacto de emergencia'],
];

const DEFAULT_SHOW: Record<string, boolean> = {
  photo: true, doc_number: true, team: true, branch: true, plan: true,
  valid_until: true, fee_status: true, blood_type: false,
  emergency_contact: false, eps: false, tshirt_size: false,
};

const emptyTemplate = (): CardTemplate => ({
  name: '',
  accent_color: '#0ea5e9',
  header_text: 'Carnet deportivo',
  footer_text: '',
  show_fields: { ...DEFAULT_SHOW },
  is_default: false,
  active: true,
});

export function CardTemplatesManager({ schoolId }: { schoolId: string | null | undefined }) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<CardTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<CardTemplate>(emptyTemplate());
  const [saving, setSaving] = useState(false);
  const [school, setSchool] = useState<{ name: string; branding_settings: any } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CardTemplate | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    void load();
    supabase.from('schools').select('name, branding_settings').eq('id', schoolId).maybeSingle()
      .then(({ data }) => data && setSchool(data as any));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  async function load() {
    if (!schoolId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('athlete_id_card_templates')
      .select('*')
      .eq('school_id', schoolId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else setTemplates((data as any as CardTemplate[]) || []);
    setLoading(false);
  }

  function edit(t: CardTemplate) {
    setForm({ ...t, show_fields: { ...DEFAULT_SHOW, ...t.show_fields } });
  }
  function newTemplate() { setForm(emptyTemplate()); }

  function setField(k: string, v: boolean) {
    setForm((f) => ({ ...f, show_fields: { ...f.show_fields, [k]: v } }));
  }

  async function save() {
    if (!schoolId) return;
    if (!form.name.trim()) {
      toast({ title: 'Falta el nombre', description: 'Ponle un nombre a la plantilla.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      // Solo una default por escuela: si esta va como default, desmarca las demás.
      if (form.is_default) {
        await supabase.from('athlete_id_card_templates')
          .update({ is_default: false })
          .eq('school_id', schoolId)
          .neq('id', form.id ?? '00000000-0000-0000-0000-000000000000');
      }
      const payload: any = {
        school_id: schoolId,
        name: form.name.trim(),
        accent_color: form.accent_color,
        header_text: form.header_text,
        footer_text: form.footer_text,
        show_fields: form.show_fields,
        is_default: form.is_default,
        active: form.active,
      };
      const res = form.id
        ? await supabase.from('athlete_id_card_templates').update(payload).eq('id', form.id)
        : await supabase.from('athlete_id_card_templates').insert(payload);
      if (res.error) throw res.error;
      toast({ title: form.id ? 'Plantilla actualizada' : 'Plantilla creada' });
      newTemplate();
      void load();
    } catch (e: any) {
      toast({ title: 'No se pudo guardar', description: e?.message || 'Error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    const t = deleteTarget;
    if (!t?.id) return;
    const { error } = await supabase.from('athlete_id_card_templates').delete().eq('id', t.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Plantilla eliminada' });
    if (form.id === t.id) newTemplate();
    setDeleteTarget(null);
    void load();
  }

  // CardData de muestra para el preview en vivo
  const preview: CardData = {
    found: true,
    status: 'active',
    school: { id: '', name: school?.name || 'Tu escuela', branding_settings: school?.branding_settings || {} },
    template: {
      id: '',
      name: form.name,
      accent_color: form.accent_color,
      header_text: form.header_text,
      footer_text: form.footer_text,
      show_fields: form.show_fields,
    },
    athlete: {
      kind: 'child',
      full_name: 'Abril Samudio Vera',
      avatar_url: null,
      doc_type: 'TI',
      doc_number: '101500072',
      blood_type: 'O+',
      eps_name: 'Sura',
      tshirt_size: 'S',
      emergency_contact: 'María Vera · 300 555 1188',
    },
    branch_name: 'Coliseo Dynasty',
    team_name: 'Minivolley Benjamines',
    valid_until: '2026-12-31',
    version: 1,
    fee_status: 'paid',
    last_payment: { concept: 'Mensualidad 07/2026', amount: 100000, payment_date: '2026-07-01' },
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
      {/* Columna izquierda: lista + editor */}
      <div className="space-y-6">
        {/* Lista de plantillas */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Plantillas de la escuela</h3>
              <Button size="sm" variant="outline" onClick={newTemplate} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Nueva
              </Button>
            </div>
            {loading ? (
              <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : templates.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Aún no hay plantillas. Crea una — la primera será la predeterminada.</p>
            ) : (
              <div className="space-y-2">
                {templates.map((t) => (
                  <div key={t.id} className={`flex items-center gap-3 rounded-lg border p-2.5 ${form.id === t.id ? 'border-primary bg-primary/5' : ''}`}>
                    <span className="h-8 w-8 rounded-md border shrink-0" style={{ background: t.accent_color || '#0ea5e9' }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm flex items-center gap-2">
                        {t.name}
                        {t.is_default && <Badge className="bg-amber-100 text-amber-700 gap-1"><Star className="h-3 w-3" />Predeterminada</Badge>}
                        {!t.active && <Badge variant="outline">Inactiva</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{t.header_text || '—'}</div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => edit(t)}>Editar</Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setDeleteTarget(t)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Editor */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-semibold">{form.id ? 'Editar plantilla' : 'Nueva plantilla'}</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Nombre</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Carnet 2026" />
              </div>
              <div>
                <Label>Color de acento</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.accent_color || '#0ea5e9'} onChange={(e) => setForm((f) => ({ ...f, accent_color: e.target.value }))} className="h-9 w-12 rounded border p-0.5 bg-transparent" />
                  <Input value={form.accent_color || ''} onChange={(e) => setForm((f) => ({ ...f, accent_color: e.target.value }))} placeholder="#0ea5e9" className="flex-1" />
                </div>
              </div>
              <div>
                <Label>Encabezado</Label>
                <Input value={form.header_text || ''} onChange={(e) => setForm((f) => ({ ...f, header_text: e.target.value }))} placeholder="Carnet deportivo" />
              </div>
              <div>
                <Label>Pie de página</Label>
                <Input value={form.footer_text || ''} onChange={(e) => setForm((f) => ({ ...f, footer_text: e.target.value }))} placeholder="Nota legal opcional" />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Campos visibles en el carnet</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {FIELD_LABELS.map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 text-sm cursor-pointer rounded-md border px-2.5 py-1.5">
                    <input type="checkbox" className="h-4 w-4 accent-primary" checked={!!form.show_fields[k]} onChange={(e) => setField(k, e.target.checked)} />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-5">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="h-4 w-4 accent-primary" checked={form.is_default} onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))} />
                Predeterminada
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="h-4 w-4 accent-primary" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
                Activa
              </label>
              <div className="ml-auto flex gap-2">
                {form.id && <Button variant="outline" onClick={newTemplate}>Cancelar</Button>}
                <Button onClick={save} disabled={saving} className="gap-1">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {form.id ? 'Guardar cambios' : 'Crear plantilla'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Columna derecha: preview en vivo */}
      <div className="lg:sticky lg:top-4 self-start">
        <p className="text-xs text-muted-foreground mb-2 text-center">Vista previa en vivo</p>
        <div className="flex justify-center">
          <AthleteIdCard data={preview} publicUrl="https://sportmaps.co/c/preview" />
        </div>
      </div>

      {/* Confirmar eliminación */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar plantilla</DialogTitle>
            <DialogDescription>
              ¿Eliminar la plantilla <strong>{deleteTarget?.name}</strong>? Los carnets ya emitidos no se ven afectados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
