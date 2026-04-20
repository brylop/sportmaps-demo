import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Clock, DollarSign, Edit, Trash2, Loader2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const SERVICE_TYPES = [
  'Fisioterapia', 'Nutricion', 'Psicologia',
  'Medicina_Deportiva', 'Entrenamiento', 'Otro'
];

interface ServiceListing {
  id: string;
  name: string;
  description: string;
  service_type: string;
  price: number;
  duration_minutes: number;
  is_active: boolean;
  visibility: string;
  service_variations: any[];
}

export default function VendorServicesPage() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [services, setServices] = useState<ServiceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', service_type: 'Fisioterapia',
    price: '', duration_minutes: '60', visibility: 'public',
  });

  const fetchServices = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/vendor/services`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      });
      const json = await res.json();
      if (json.ok) setServices(json.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) fetchServices();
  }, [session]);

  const handleCreate = async () => {
    if (!form.name || !form.price) {
      toast({ title: 'Error', description: 'Nombre y precio son requeridos', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/vendor/services`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          ...form,
          price: parseFloat(form.price),
          duration_minutes: parseInt(form.duration_minutes, 10),
        }),
      });
      const json = await res.json();

      if (json.ok) {
        toast({ title: 'Servicio creado' });
        setDialogOpen(false);
        setForm({ name: '', description: '', service_type: 'Fisioterapia', price: '', duration_minutes: '60', visibility: 'public' });
        fetchServices();
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'No se pudo crear el servicio', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await fetch(`${API_URL}/api/v1/vendor/services/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      });
      toast({ title: 'Servicio desactivado' });
      fetchServices();
    } catch (err) {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Mis Servicios</h1>
          <p className="text-muted-foreground">Gestiona los servicios que ofreces en el marketplace</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Nuevo Servicio</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Crear Servicio</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nombre *</Label>
                <Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ej: Sesion de Fisioterapia Deportiva" />
              </div>
              <div>
                <Label>Tipo de servicio</Label>
                <Select value={form.service_type} onValueChange={(v) => setForm(p => ({ ...p, service_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Precio (COP) *</Label>
                  <Input type="number" value={form.price} onChange={(e) => setForm(p => ({ ...p, price: e.target.value }))} placeholder="80000" />
                </div>
                <div>
                  <Label>Duracion (min)</Label>
                  <Input type="number" value={form.duration_minutes} onChange={(e) => setForm(p => ({ ...p, duration_minutes: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Descripcion</Label>
                <Textarea value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="Describe el servicio..." />
              </div>
              <Button className="w-full" onClick={handleCreate} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Crear Servicio
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : services.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold mb-2">No tienes servicios aun</h3>
            <p className="text-muted-foreground text-sm mb-4">Crea tu primer servicio para que aparezca en el marketplace</p>
            <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" /> Crear Servicio</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {services.map(service => (
            <Card key={service.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{service.name}</h3>
                    <Badge variant={service.is_active ? 'default' : 'secondary'}>
                      {service.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                    <Badge variant="outline">{service.service_type.replace('_', ' ')}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      ${service.price.toLocaleString('es-CO')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {service.duration_minutes} min
                    </span>
                    {service.service_variations?.length > 0 && (
                      <span>{service.service_variations.length} variaciones</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeactivate(service.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
