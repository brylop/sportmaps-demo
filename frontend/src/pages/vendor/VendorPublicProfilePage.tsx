import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  User, DollarSign, Phone, Eye, Save, Loader2, Upload, Plus, ExternalLink, Globe,
  MapPin, Mail, Stethoscope, Package, Share2,
} from 'lucide-react';
import { PublishedSuccessModal } from '@/components/settings/PublishedSuccessModal';
import { ShareStoreDialog } from '@/components/vendor/ShareStoreDialog';
import { PlanCard, type PlanFeature, type PlanDuration } from '@/components/explore/PlanCard';
import { useStorage } from '@/hooks/useStorage';

interface VendorRow {
  id: string;
  user_id: string;
  vendor_type: string;
  display_name: string;
  slug: string | null;
  description: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website_url: string | null;
  is_active: boolean;
}

interface ServiceVariation {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  is_active: boolean;
}

interface ServiceListing {
  id: string;
  name: string;
  description: string | null;
  service_type: string;
  price: number;
  duration_minutes: number;
  is_active: boolean;
  has_variations: boolean;
  service_variations: ServiceVariation[];
}

const SERVICE_COLORS: Record<string, string> = {
  Fisioterapia: 'bg-sky-500 hover:bg-sky-600',
  Nutricion: 'bg-emerald-500 hover:bg-emerald-600',
  Psicologia: 'bg-violet-500 hover:bg-violet-600',
  Medicina_Deportiva: 'bg-rose-500 hover:bg-rose-600',
  Entrenamiento: 'bg-amber-500 hover:bg-amber-600',
  Otro: 'bg-slate-500 hover:bg-slate-600',
};

function formatDuration(minutes: number, price: number) {
  const priceFmt = `$${price.toLocaleString('es-CO')}`;
  if (minutes === 60) return `1 sesión - 60 min / ${priceFmt}`;
  if (minutes === 30) return `1 sesión - 30 min / ${priceFmt}`;
  if (minutes === 45) return `1 sesión - 45 min / ${priceFmt}`;
  if (minutes === 90) return `1 sesión - 90 min / ${priceFmt}`;
  return `${minutes} min / ${priceFmt}`;
}

export default function VendorPublicProfilePage() {
  const { user, profile } = useAuth();
  const { uploadFile, uploading } = useStorage();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const [vendor, setVendor] = useState<VendorRow | null>(null);
  const [services, setServices] = useState<ServiceListing[]>([]);

  const isStore = profile?.role === 'store_owner';
  const isWellness = profile?.role === 'wellness_professional';

  const [form, setForm] = useState({
    display_name: '',
    description: '',
    city: '',
    address: '',
    phone: '',
    email: '',
    website_url: '',
    logo_url: '',
    cover_image_url: '',
  });

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: v, error: ve } = await supabase
        .from('vendor_profiles')
        .select('id, user_id, vendor_type, display_name, slug, description, logo_url, cover_image_url, city, address, phone, email, website_url, is_active')
        .eq('user_id', user.id)
        .maybeSingle();
      if (ve && ve.code !== 'PGRST116') throw ve;

      if (v) {
        const vendorRow = v as VendorRow;
        setVendor(vendorRow);
        setForm({
          display_name: vendorRow.display_name ?? '',
          description: vendorRow.description ?? '',
          city: vendorRow.city ?? '',
          address: vendorRow.address ?? '',
          phone: vendorRow.phone ?? '',
          email: vendorRow.email ?? '',
          website_url: vendorRow.website_url ?? '',
          logo_url: vendorRow.logo_url ?? '',
          cover_image_url: vendorRow.cover_image_url ?? '',
        });

        if (isWellness) {
          const { data: srv } = await supabase
            .from('service_listings')
            .select('id, name, description, service_type, price, duration_minutes, is_active, has_variations, service_variations(id, name, price, duration_minutes, is_active)')
            .eq('vendor_profile_id', vendorRow.id)
            .eq('is_active', true)
            .order('created_at', { ascending: false });
          if (srv) setServices(srv as unknown as ServiceListing[]);
        }
      }
    } catch (err: any) {
      console.error('[VendorPublicProfile] load', err);
      toast.error('Error cargando el perfil');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [user?.id]); // eslint-disable-line

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleUpload = async (file: File, field: 'logo_url' | 'cover_image_url') => {
    if (!vendor) return;
    try {
      const folder = field === 'logo_url' ? `vendor-logos/${vendor.id}` : `vendor-covers/${vendor.id}`;
      const publicUrl = await uploadFile(file, 'avatars', folder);
      if (!publicUrl) return;
      set(field, publicUrl);
      toast.success('Imagen subida');
    } catch (err: any) {
      toast.error(err.message || 'Error subiendo imagen');
    }
  };

  const handleSave = async () => {
    if (!vendor) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('vendor_profiles').update({
        display_name: form.display_name,
        description: form.description,
        city: form.city,
        address: form.address,
        phone: form.phone,
        email: form.email,
        website_url: form.website_url,
        logo_url: form.logo_url || null,
        cover_image_url: form.cover_image_url || null,
      }).eq('id', vendor.id);
      if (error) throw error;
      await loadData();
      toast.success('Cambios guardados');
    } catch (err: any) {
      toast.error(err.message || 'Error guardando');
    } finally {
      setSaving(false);
    }
  };

  const handlePublishToggle = async () => {
    if (!vendor) return;
    const next = !vendor.is_active;
    setPublishing(true);
    try {
      const { error } = await supabase
        .from('vendor_profiles')
        .update({ is_active: next })
        .eq('id', vendor.id);
      if (error) throw error;
      setVendor(prev => prev ? { ...prev, is_active: next } : prev);
      if (next) setSuccessOpen(true);
      else toast.success('Perfil despublicado');
    } catch (err: any) {
      toast.error(err.message || 'Error publicando');
    } finally {
      setPublishing(false);
    }
  };

  const vendorSlugOrId = vendor?.slug || vendor?.id || '';
  const publicUrl = vendor ? `${window.location.origin}/tienda/${vendorSlugOrId}` : '';
  const isPublished = vendor?.is_active ?? false;
  const exploreCategory = isWellness ? 'services' : isStore ? 'products' : 'all';
  const exploreLabel = isWellness ? 'Profesionales' : isStore ? 'Productos' : 'Explorar';

  if (loading || !user?.id) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!vendor) {
    const emptyTitle = isWellness
      ? 'Aún no tienes perfil profesional'
      : isStore
        ? 'Aún no tienes perfil de tienda'
        : 'Aún no tienes perfil público';
    const emptyDescription = isWellness
      ? 'Completa el onboarding para publicar tus servicios y que atletas te encuentren en Explorar.'
      : isStore
        ? 'Completa el onboarding para publicar tu catálogo y que los clientes te encuentren en Explorar.'
        : 'Completa el onboarding para crear tu perfil público en Explorar.';

    return (
      <div className="container mx-auto px-4 py-10 max-w-2xl text-center">
        <Card><CardContent className="p-10 space-y-4">
          <h2 className="text-xl font-bold">{emptyTitle}</h2>
          <p className="text-sm text-muted-foreground">{emptyDescription}</p>
          <Button asChild>
            <Link to="/vendor/onboarding">Crear perfil</Link>
          </Button>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mi Perfil Público</h1>
          <p className="text-sm text-muted-foreground">
            Personaliza cómo te ven los clientes potenciales en Explorar.
          </p>
          {isPublished && (
            <Badge className="mt-2 bg-green-500 text-white gap-1.5">
              <Globe className="h-3 w-3" /> Publicado
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isPublished && (
            <Button variant="outline" onClick={() => setShareOpen(true)} className="gap-1.5">
              <Share2 className="h-4 w-4" /> Compartir
            </Button>
          )}
          <Button
            variant={isPublished ? 'outline' : 'default'}
            onClick={handlePublishToggle}
            disabled={publishing}
            className="gap-1.5"
          >
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            {isPublished ? 'Despublicar' : 'Publicar perfil'}
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </Button>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="general" className="w-full">
        <TabsList className={`grid ${isWellness ? 'grid-cols-3' : 'grid-cols-2'} w-full max-w-xl`}>
          <TabsTrigger value="general" className="gap-1.5"><User className="h-3.5 w-3.5" /> General</TabsTrigger>
          {isWellness && (
            <TabsTrigger value="planes" className="gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Tarifas</TabsTrigger>
          )}
          <TabsTrigger value="contacto" className="gap-1.5"><Phone className="h-3.5 w-3.5" /> Contacto</TabsTrigger>
        </TabsList>

        {/* ── GENERAL ───────────────────────────────────────────────────── */}
        <TabsContent value="general" className="space-y-5 mt-6">
          <Card>
            <CardContent className="p-6 space-y-5">
              <div>
                <h3 className="font-semibold text-base flex items-center gap-2">
                  {isWellness ? <Stethoscope className="h-4 w-4 text-primary" /> : <Package className="h-4 w-4 text-primary" />}
                  Presentación
                </h3>
                <p className="text-sm text-muted-foreground">Lo primero que verán tus clientes.</p>
              </div>

              <div className="space-y-2">
                <Label>Foto de perfil</Label>
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={form.logo_url} />
                    <AvatarFallback>{(form.display_name ?? 'V').substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <label>
                    <input type="file" className="hidden" accept="image/*"
                      onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'logo_url')} />
                    <Button asChild variant="outline" size="sm" disabled={uploading}>
                      <span><Upload className="h-4 w-4 mr-1.5" /> Subir foto</span>
                    </Button>
                  </label>
                  <p className="text-xs text-muted-foreground">JPG/PNG · máx 5MB</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Imagen de portada</Label>
                {form.cover_image_url ? (
                  <div className="relative rounded-lg overflow-hidden border">
                    <img src={form.cover_image_url} alt="cover" className="w-full h-32 object-cover" />
                    <label className="absolute top-2 right-2">
                      <input type="file" className="hidden" accept="image/*"
                        onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'cover_image_url')} />
                      <Button asChild variant="secondary" size="sm" disabled={uploading}>
                        <span><Upload className="h-3.5 w-3.5 mr-1" /> Cambiar</span>
                      </Button>
                    </label>
                  </div>
                ) : (
                  <label className="block border-2 border-dashed rounded-lg p-8 text-center hover:border-primary cursor-pointer transition-colors">
                    <input type="file" className="hidden" accept="image/*"
                      onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'cover_image_url')} />
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mt-1">Subir portada (recomendado 1200x300)</p>
                  </label>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre para mostrar *</Label>
                  <Input value={form.display_name} onChange={e => set('display_name', e.target.value)} placeholder="Ej. Dra. Ana — Fisioterapia" />
                </div>
                <div className="space-y-2">
                  <Label>Ciudad</Label>
                  <Input value={form.city} onChange={e => set('city', e.target.value)} placeholder="Ej. Bogotá" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Bio / Descripción</Label>
                <Textarea
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  placeholder="Cuenta a tus clientes qué ofreces…"
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── PLANES / TARIFAS (solo wellness) ──────────────────────────── */}
        {isWellness && (
          <TabsContent value="planes" className="space-y-5 mt-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-base flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-primary" />
                      Tarifas y servicios
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Así ven tus clientes los servicios cuando entran a tu perfil en Explorar.
                    </p>
                  </div>
                  <Button asChild size="sm" className="gap-1.5">
                    <Link to="/vendor/services">
                      <Plus className="h-4 w-4" /> Gestionar servicios
                    </Link>
                  </Button>
                </div>

                {services.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <Stethoscope className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="font-medium">Aún no tienes servicios publicados</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Crea tu primer servicio para que aparezca en Explorar.
                    </p>
                    <Button asChild>
                      <Link to="/vendor/services">Crear servicio</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {services.map(svc => {
                      const features: PlanFeature[] = [];
                      if (svc.description) {
                        svc.description.split(/\.\s+|\n+/).map(s => s.trim()).filter(s => s.length > 3)
                          .slice(0, 4).forEach(s => features.push({ label: s.replace(/\.$/, '') }));
                      }
                      if (features.length === 0) {
                        features.push({ label: `${svc.service_type.replace('_', ' ')}` });
                      }

                      const variations = (svc.service_variations ?? []).filter(v => v.is_active);
                      const durations: PlanDuration[] = variations.length > 0
                        ? variations.map(v => ({
                            key: v.id,
                            label: `${v.name} - ${formatDuration(v.duration_minutes, v.price)}`,
                            price: v.price,
                            durationDays: 0,
                          }))
                        : [{
                            key: 'base',
                            label: formatDuration(svc.duration_minutes, svc.price),
                            price: svc.price,
                            durationDays: 0,
                          }];

                      return (
                        <PlanCard
                          key={svc.id}
                          title={svc.name}
                          sport={svc.service_type.replace('_', ' ')}
                          features={features}
                          durations={durations}
                          primaryCta="Vista previa"
                          onPrimary={() => toast.info('Vista previa: así se ve este servicio en Explorar.')}
                          accentClassName={`${SERVICE_COLORS[svc.service_type] ?? 'bg-emerald-500 hover:bg-emerald-600'} text-white`}
                        />
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── CONTACTO ──────────────────────────────────────────────────── */}
        <TabsContent value="contacto" className="space-y-5 mt-6">
          <Card>
            <CardContent className="p-6 space-y-5">
              <div>
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  Contacto público
                </h3>
                <p className="text-sm text-muted-foreground">Cómo te contactan tus clientes.</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> WhatsApp</Label>
                  <PhoneInput value={form.phone} onChange={(v) => set('phone', v)} />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</Label>
                  <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="hola@tuconsulta.com" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> Sitio web</Label>
                  <Input type="url" value={form.website_url} onChange={e => set('website_url', e.target.value)} placeholder="https://tuconsulta.com" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Dirección del consultorio/local</Label>
                <Input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Calle 123 # 45-67" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ShareStoreDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        publicUrl={publicUrl}
        displayName={form.display_name || vendor.display_name}
      />

      <PublishedSuccessModal
        open={successOpen}
        onOpenChange={setSuccessOpen}
        publicUrl={publicUrl}
        viewUrl={`/tienda/${vendorSlugOrId}`}
        exploreHint={{ label: exploreLabel, href: `/explorar?category=${exploreCategory}` }}
        description={`${form.display_name || 'Tu perfil'} ya es visible para clientes potenciales en SportMaps. Comparte tu link para que te encuentren.`}
      />
    </div>
  );
}
