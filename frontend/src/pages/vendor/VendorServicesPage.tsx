import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Clock, DollarSign, Edit, Trash2, Loader2, MapPin, Video, Home, Layers } from 'lucide-react';
import { ServiceWizard } from '@/components/vendor/service-wizard/ServiceWizard';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const MODALITY_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  presencial: { label: 'Presencial', icon: MapPin },
  virtual:    { label: 'Virtual',    icon: Video },
  domicilio:  { label: 'A domicilio', icon: Home },
  hibrido:    { label: 'Hibrido',    icon: Layers },
};

interface ServiceListing {
  id: string;
  name: string;
  description: string;
  service_type: string;
  subcategory?: string | null;
  price: number;
  duration_minutes: number;
  is_active: boolean;
  visibility: string;
  modality?: string[];
  target_audience?: string[];
  includes?: string[];
  image_url?: string | null;
  service_variations: any[];
}

export default function VendorServicesPage() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [services, setServices] = useState<ServiceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);

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
        <Button onClick={() => setWizardOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo Servicio
        </Button>
        <ServiceWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          onCreated={fetchServices}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : services.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold mb-2">No tienes servicios aun</h3>
            <p className="text-muted-foreground text-sm mb-4">Crea tu primer servicio para que aparezca en el marketplace</p>
            <Button onClick={() => setWizardOpen(true)}><Plus className="h-4 w-4 mr-2" /> Crear Servicio</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {services.map(service => (
            <Card key={service.id}>
              <CardContent className="p-4 flex gap-4">
                {service.image_url && (
                  <img
                    src={service.image_url}
                    alt={service.name}
                    className="hidden sm:block w-24 h-24 rounded-md object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-semibold">{service.name}</h3>
                    <Badge variant={service.is_active ? 'default' : 'secondary'}>
                      {service.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                    <Badge variant="outline">{service.service_type.replace('_', ' ')}</Badge>
                    {service.subcategory && (
                      <Badge variant="outline" className="bg-muted">{service.subcategory}</Badge>
                    )}
                  </div>

                  {(service.modality?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {service.modality!.map(m => {
                        const meta = MODALITY_META[m];
                        if (!meta) return null;
                        const Icon = meta.icon;
                        return (
                          <Badge key={m} variant="secondary" className="gap-1 text-xs">
                            <Icon className="h-3 w-3" /> {meta.label}
                          </Badge>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      ${service.price.toLocaleString('es-CO')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {service.duration_minutes} min
                    </span>
                    {(service.includes?.length ?? 0) > 0 && (
                      <span>Incluye {service.includes!.length} items</span>
                    )}
                    {service.service_variations?.length > 0 && (
                      <span>{service.service_variations.length} paquetes</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 items-start">
                  <Button variant="ghost" size="icon" disabled title="Edicion proximamente">
                    <Edit className="h-4 w-4" />
                  </Button>
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
