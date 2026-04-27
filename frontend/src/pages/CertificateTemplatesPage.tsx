import { useEffect, useState } from 'react';
import { Loader2, Plus, Save, Trash2, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type Tpl = {
  id?: string;
  school_id?: string;
  name: string;
  kind: 'study' | 'conduct' | 'medical' | 'payment' | 'federation' | 'custom';
  title: string;
  body_template: string;
  signature_name?: string | null;
  signature_title?: string | null;
  signature_image_url?: string | null;
  footer_text?: string | null;
  requires_payment: boolean;
  price: number;
  currency: string;
  is_default: boolean;
  active: boolean;
};

const EMPTY: Tpl = {
  name: 'Constancia de estudio',
  kind: 'study',
  title: 'CONSTANCIA',
  body_template:
    'La institución hace constar que {{atleta.nombre}} con documento {{atleta.tipo_doc}} {{atleta.documento}} se encuentra inscrito en el equipo {{equipo}} de la sede {{sede}} de la escuela {{escuela.nombre}}, vigente hasta {{inscripcion.vence}}.\n\nEsta constancia se expide en {{fecha_actual}} a solicitud del interesado.',
  signature_name: '',
  signature_title: 'Director(a)',
  footer_text: 'Documento generado electrónicamente. Verifique su autenticidad escaneando el QR.',
  requires_payment: false,
  price: 0,
  currency: 'COP',
  is_default: false,
  active: true,
};

export default function CertificateTemplatesPage() {
  const { schoolId } = useSchoolContext();
  const { toast } = useToast();
  const [items, setItems] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Tpl | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  async function load() {
    if (!schoolId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('school_certificate_templates' as any)
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setItems([]);
      return;
    }
    setItems((data as any[]) as Tpl[]);
  }

  function startNew() {
    setEditing({ ...EMPTY, school_id: schoolId ?? undefined });
  }
  function startEdit(t: Tpl) {
    setEditing({ ...t });
  }

  async function save() {
    if (!editing || !schoolId) return;
    setSaving(true);
    const payload: any = { ...editing, school_id: schoolId };
    delete payload.created_at; delete payload.updated_at;
    const isNew = !payload.id;
    if (isNew) delete payload.id;
    const { error } = isNew
      ? await supabase.from('school_certificate_templates' as any).insert(payload)
      : await supabase.from('school_certificate_templates' as any).update(payload).eq('id', payload.id);
    setSaving(false);
    if (error) return toast({ title: 'Error', description: error.message, variant: 'destructive' });
    toast({ title: isNew ? 'Plantilla creada' : 'Plantilla actualizada' });
    setEditing(null);
    await load();
  }

  async function remove(t: Tpl) {
    if (!t.id) return;
    if (!window.confirm(`¿Eliminar plantilla "${t.name}"?`)) return;
    const { error } = await supabase.from('school_certificate_templates' as any).delete().eq('id', t.id);
    if (error) return toast({ title: 'Error', description: error.message, variant: 'destructive' });
    toast({ title: 'Plantilla eliminada' });
    await load();
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary" />
            Plantillas de constancias
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Define qué tipos de constancias puedes emitir (estudio, conducta, federación, etc).
            Usa variables como {'{{'}atleta.nombre{'}}'}.
          </p>
        </div>
        <Button onClick={startNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva plantilla
        </Button>
      </header>

      <Card>
        <CardHeader><CardTitle>Plantillas activas</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Aún no creas plantillas.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {items.map((t) => (
                <Card key={t.id} className="border-2 hover:border-primary cursor-pointer transition" onClick={() => startEdit(t)}>
                  <CardContent className="pt-4 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{t.name}</span>
                      <div className="flex gap-1">
                        {t.is_default && <Badge variant="default">Default</Badge>}
                        {t.active ? <Badge variant="secondary">Activa</Badge> : <Badge variant="outline">Inactiva</Badge>}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Tipo: <span className="capitalize">{t.kind}</span>
                      {t.requires_payment && (
                        <span className="ml-2">· Costo {Number(t.price).toLocaleString('es-CO')} {t.currency}</span>
                      )}
                    </div>
                    <p className="text-xs line-clamp-2 text-muted-foreground italic">{t.body_template.slice(0, 140)}…</p>
                    <div className="flex justify-end mt-1">
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); remove(t); }} className="text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editor dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Editar plantilla' : 'Nueva plantilla'}</DialogTitle>
            <DialogDescription>
              Variables disponibles: <code>{'{{atleta.nombre}}'}</code>, <code>{'{{atleta.documento}}'}</code>,
              <code> {'{{escuela.nombre}}'}</code>, <code>{'{{equipo}}'}</code>, <code>{'{{sede}}'}</code>,
              <code> {'{{folio}}'}</code>, <code>{'{{fecha_actual}}'}</code>, <code>{'{{inscripcion.vence}}'}</code>
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nombre interno</Label>
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={editing.kind} onValueChange={(v) => setEditing({ ...editing, kind: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="study">Estudio</SelectItem>
                      <SelectItem value="conduct">Conducta</SelectItem>
                      <SelectItem value="medical">Médica</SelectItem>
                      <SelectItem value="payment">Paz y salvo</SelectItem>
                      <SelectItem value="federation">Federación</SelectItem>
                      <SelectItem value="custom">Personalizada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Título del documento</Label>
                <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </div>

              <div>
                <Label>Cuerpo (con variables)</Label>
                <Textarea
                  className="min-h-[180px] font-mono text-sm"
                  value={editing.body_template}
                  onChange={(e) => setEditing({ ...editing, body_template: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Firma — Nombre</Label>
                  <Input value={editing.signature_name ?? ''} onChange={(e) => setEditing({ ...editing, signature_name: e.target.value })} />
                </div>
                <div>
                  <Label>Firma — Cargo</Label>
                  <Input value={editing.signature_title ?? ''} onChange={(e) => setEditing({ ...editing, signature_title: e.target.value })} />
                </div>
              </div>

              <div>
                <Label>Pie de página</Label>
                <Input value={editing.footer_text ?? ''} onChange={(e) => setEditing({ ...editing, footer_text: e.target.value })} />
              </div>

              <div className="grid grid-cols-3 gap-3 items-end">
                <div className="flex items-center gap-2 mt-6">
                  <Switch
                    checked={editing.requires_payment}
                    onCheckedChange={(v) => setEditing({ ...editing, requires_payment: v })}
                  />
                  <Label>Cobra esta constancia</Label>
                </div>
                <div>
                  <Label>Precio</Label>
                  <Input
                    type="number"
                    value={editing.price}
                    onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) || 0 })}
                    disabled={!editing.requires_payment}
                  />
                </div>
                <div>
                  <Label>Moneda</Label>
                  <Input
                    value={editing.currency}
                    onChange={(e) => setEditing({ ...editing, currency: e.target.value })}
                    disabled={!editing.requires_payment}
                  />
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={editing.is_default} onCheckedChange={(v) => setEditing({ ...editing, is_default: v })} />
                  <Label>Default para este tipo</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
                  <Label>Activa</Label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
