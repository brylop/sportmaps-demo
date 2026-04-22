import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  User, DollarSign, Phone, Eye, Save, Loader2, Upload, Plus, ExternalLink, Globe,
  MapPin, Mail, Building2, Trophy,
} from 'lucide-react';
import { PublishedSuccessModal } from '@/components/settings/PublishedSuccessModal';
import { PlanCard, type PlanFeature, type PlanDuration } from '@/components/explore/PlanCard';
import { useStorage } from '@/hooks/useStorage';

interface SchoolRow {
  id: string;
  name: string;
  description: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  sports: string[] | null;
}

interface SchoolSettingsRow {
  school_id: string;
  public_profile_enabled: boolean;
  show_plans: boolean;
  show_programs: boolean;
  show_facilities: boolean;
}

interface ProgramRow {
  id: string;
  name: string;
  description: string | null;
  sport: string;
  schedule: any | null;
  price_monthly: number;
  age_min: number | null;
  age_max: number | null;
  max_students: number | null;
  current_students: number;
  active: boolean | null;
  level?: string | null;
}

function getAgeRange(p: ProgramRow) {
  if (!p.age_min && !p.age_max) return 'Todas las edades';
  if (!p.age_max) return `${p.age_min}+ años`;
  if (!p.age_min) return `Hasta ${p.age_max} años`;
  return `${p.age_min}-${p.age_max} años`;
}

function getAvailability(p: ProgramRow) {
  if (!p.max_students) return 'Cupos ilimitados';
  const available = p.max_students - p.current_students;
  return available > 0 ? `${available} cupos disponibles` : 'Lleno';
}

export default function SchoolPublicProfilePage() {
  const { schoolId, schoolName } = useSchoolContext();
  const { uploadFile, uploading } = useStorage();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);

  const [school, setSchool] = useState<SchoolRow | null>(null);
  const [settings, setSettings] = useState<SchoolSettingsRow | null>(null);
  const [programs, setPrograms] = useState<ProgramRow[]>([]);

  const [form, setForm] = useState({
    name: '',
    description: '',
    city: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    logo_url: '',
    cover_image_url: '',
    sports: '' as string,
    show_plans: true,
    show_programs: true,
    show_facilities: false,
  });

  const loadData = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const [{ data: s }, { data: st }, { data: pr }] = await Promise.all([
        supabase.from('schools')
          .select('id, name, description, city, address, phone, email, website, logo_url, cover_image_url, sports')
          .eq('id', schoolId).single(),
        supabase.from('school_settings')
          .select('school_id, public_profile_enabled, show_plans, show_programs, show_facilities')
          .eq('school_id', schoolId).maybeSingle(),
        supabase.from('programs')
          .select('id, name, description, sport, schedule, price_monthly, age_min, age_max, max_students, current_students, active, level')
          .eq('school_id', schoolId)
          .eq('active', true)
          .order('created_at', { ascending: false }),
      ]);
      if (s) {
        setSchool(s as SchoolRow);
        setForm(prev => ({
          ...prev,
          name: s.name ?? '',
          description: s.description ?? '',
          city: s.city ?? '',
          address: s.address ?? '',
          phone: s.phone ?? '',
          email: s.email ?? '',
          website: s.website ?? '',
          logo_url: s.logo_url ?? '',
          cover_image_url: s.cover_image_url ?? '',
          sports: (s.sports ?? []).join(', '),
        }));
      }
      if (st) {
        setSettings(st as SchoolSettingsRow);
        setForm(prev => ({
          ...prev,
          show_plans: st.show_plans ?? true,
          show_programs: st.show_programs ?? true,
          show_facilities: st.show_facilities ?? false,
        }));
      }
      if (pr) setPrograms(pr as ProgramRow[]);
    } catch (err: any) {
      console.error('[SchoolPublicProfile] load', err);
      toast.error('Error cargando el perfil');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [schoolId]); // eslint-disable-line

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleUpload = async (file: File, field: 'logo_url' | 'cover_image_url') => {
    if (!schoolId) return;
    try {
      const bucket = field === 'logo_url' ? 'school-logos' : 'school-covers';
      const { publicUrl } = await uploadFile(file, bucket, `${schoolId}/${Date.now()}-${file.name}`);
      set(field, publicUrl);
      toast.success('Imagen subida');
    } catch (err: any) {
      toast.error(err.message || 'Error subiendo imagen');
    }
  };

  const handleSave = async () => {
    if (!schoolId) return;
    setSaving(true);
    try {
      const sportsArray = form.sports.split(',').map(s => s.trim()).filter(Boolean);
      const { error: se } = await supabase.from('schools').update({
        name: form.name,
        description: form.description,
        city: form.city,
        address: form.address,
        phone: form.phone,
        email: form.email,
        website: form.website,
        logo_url: form.logo_url || null,
        cover_image_url: form.cover_image_url || null,
        sports: sportsArray,
      }).eq('id', schoolId);
      if (se) throw se;

      const { error: te } = await supabase.from('school_settings').upsert({
        school_id: schoolId,
        show_plans: form.show_plans,
        show_programs: form.show_programs,
        show_facilities: form.show_facilities,
      }, { onConflict: 'school_id' });
      if (te) throw te;

      await loadData();
      toast.success('Cambios guardados');
    } catch (err: any) {
      toast.error(err.message || 'Error guardando');
    } finally {
      setSaving(false);
    }
  };

  const handlePublishToggle = async () => {
    if (!schoolId) return;
    const next = !(settings?.public_profile_enabled ?? false);
    setPublishing(true);
    try {
      const { error } = await supabase.from('school_settings').upsert({
        school_id: schoolId,
        public_profile_enabled: next,
      }, { onConflict: 'school_id' });
      if (error) throw error;
      setSettings(prev => prev ? { ...prev, public_profile_enabled: next } : {
        school_id: schoolId, public_profile_enabled: next,
        show_plans: form.show_plans, show_programs: form.show_programs, show_facilities: form.show_facilities,
      });
      if (next) setSuccessOpen(true);
      else toast.success('Perfil despublicado');
    } catch (err: any) {
      toast.error(err.message || 'Error publicando');
    } finally {
      setPublishing(false);
    }
  };

  const publicUrl = schoolId ? `${window.location.origin}/schools/${schoolId}` : '';
  const isPublished = settings?.public_profile_enabled ?? false;

  if (loading || !schoolId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Mi Perfil Público</h1>
          <p className="text-sm text-muted-foreground">
            Personaliza como te ven los alumnos potenciales en Explorar.
          </p>
          {isPublished && (
            <Badge className="mt-2 bg-emerald-500/10 text-emerald-700 border-0 text-xs">
              <Eye className="h-3 w-3 mr-1" />
              Publicado
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
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
        <TabsList className="grid grid-cols-3 w-full max-w-xl">
          <TabsTrigger value="general" className="gap-1.5"><User className="h-3.5 w-3.5" /> General</TabsTrigger>
          <TabsTrigger value="planes" className="gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Planes</TabsTrigger>
          <TabsTrigger value="contacto" className="gap-1.5"><Phone className="h-3.5 w-3.5" /> Contacto</TabsTrigger>
        </TabsList>

        {/* ── GENERAL ───────────────────────────────────────────────────── */}
        <TabsContent value="general" className="space-y-5 mt-6">
          <Card>
            <CardContent className="p-6 space-y-5">
              <div>
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  Presentación
                </h3>
                <p className="text-sm text-muted-foreground">Lo primero que verán tus alumnos.</p>
              </div>

              {/* Logo */}
              <div className="space-y-2">
                <Label>Logo de la escuela</Label>
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={form.logo_url} />
                    <AvatarFallback>{(form.name ?? 'SM').substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <label>
                    <input
                      type="file" className="hidden" accept="image/*"
                      onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'logo_url')}
                    />
                    <Button asChild variant="outline" size="sm" disabled={uploading}>
                      <span><Upload className="h-4 w-4 mr-1.5" /> Subir logo</span>
                    </Button>
                  </label>
                  <p className="text-xs text-muted-foreground">JPG/PNG · máx 5MB</p>
                </div>
              </div>

              {/* Cover */}
              <div className="space-y-2">
                <Label>Imagen de portada</Label>
                {form.cover_image_url ? (
                  <div className="relative rounded-lg overflow-hidden border">
                    <img src={form.cover_image_url} alt="cover" className="w-full h-32 object-cover" />
                    <label className="absolute top-2 right-2">
                      <input
                        type="file" className="hidden" accept="image/*"
                        onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'cover_image_url')}
                      />
                      <Button asChild variant="secondary" size="sm" disabled={uploading}>
                        <span><Upload className="h-3.5 w-3.5 mr-1" /> Cambiar</span>
                      </Button>
                    </label>
                  </div>
                ) : (
                  <label className="block border-2 border-dashed rounded-lg p-8 text-center hover:border-primary cursor-pointer transition-colors">
                    <input
                      type="file" className="hidden" accept="image/*"
                      onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'cover_image_url')}
                    />
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mt-1">Subir portada (recomendado 1200x300)</p>
                  </label>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre de la escuela *</Label>
                  <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej. Escuela Futbol Bogota" />
                </div>
                <div className="space-y-2">
                  <Label>Ciudad</Label>
                  <Input value={form.city} onChange={e => set('city', e.target.value)} placeholder="Ej. Bogota" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  placeholder="Cuenta a los alumnos qué ofrece tu academia…"
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Deportes</Label>
                <Input
                  value={form.sports}
                  onChange={e => set('sports', e.target.value)}
                  placeholder="Futbol, Natacion, Tenis (separados por coma)"
                />
                <p className="text-xs text-muted-foreground">Aparecen como chips en tu tarjeta de Explorar.</p>
              </div>
            </CardContent>
          </Card>

          {/* ── Secciones mostradas ───────────────────────────────────── */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-base">¿Qué mostrar en tu perfil público?</h3>
                <p className="text-sm text-muted-foreground">Controla qué secciones aparecen en Explorar.</p>
              </div>
              <div className="space-y-3">
                {[
                  { k: 'show_programs' as const, label: 'Programas deportivos', desc: 'Listado de programas/equipos' },
                  { k: 'show_plans'    as const, label: 'Planes y mensualidades', desc: 'Card con precios y CTA de inscripción' },
                  { k: 'show_facilities' as const, label: 'Instalaciones', desc: 'Canchas, gimnasios y recursos disponibles' },
                ].map(row => (
                  <div key={row.k} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{row.label}</p>
                      <p className="text-xs text-muted-foreground">{row.desc}</p>
                    </div>
                    <Switch checked={form[row.k]} onCheckedChange={v => set(row.k, v)} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── PLANES ────────────────────────────────────────────────────── */}
        <TabsContent value="planes" className="space-y-5 mt-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    Planes y mensualidades
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Así ven tus alumnos los planes cuando entran a tu perfil en Explorar.
                  </p>
                </div>
                <Button asChild size="sm" className="gap-1.5">
                  <Link to="/offerings">
                    <Plus className="h-4 w-4" /> Gestionar planes
                  </Link>
                </Button>
              </div>

              {programs.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <Trophy className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="font-medium">Aún no tienes planes publicados</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Crea tu primer programa para que aparezca en Explorar.
                  </p>
                  <Button asChild>
                    <Link to="/offerings">Crear plan</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {programs.map(p => {
                    const features: PlanFeature[] = [];
                    if (p.description) {
                      p.description.split(/\.\s+|\n+/).map(s => s.trim()).filter(s => s.length > 3)
                        .slice(0, 4).forEach(s => features.push({ label: s.replace(/\.$/, '') }));
                    }
                    features.push({ label: `Edades: ${getAgeRange(p)}` });
                    if (p.schedule) {
                      const sched = typeof p.schedule === 'string' ? p.schedule : JSON.stringify(p.schedule);
                      features.push({ label: `Horario: ${sched}` });
                    }
                    features.push({ label: getAvailability(p) });

                    const durations: PlanDuration[] = [{
                      key: 'monthly',
                      label: `1 mes - 30 días / $${p.price_monthly.toLocaleString('es-CO')}`,
                      price: p.price_monthly,
                      durationDays: 30,
                    }];

                    return (
                      <PlanCard
                        key={p.id}
                        title={p.name}
                        sport={p.sport}
                        level={p.level ? p.level.charAt(0).toUpperCase() + p.level.slice(1) : null}
                        features={features}
                        durations={durations}
                        primaryCta="Vista previa"
                        onPrimary={() => toast.info('Vista previa: los alumnos verán este card en Explorar.')}
                      />
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── CONTACTO ──────────────────────────────────────────────────── */}
        <TabsContent value="contacto" className="space-y-5 mt-6">
          <Card>
            <CardContent className="p-6 space-y-5">
              <div>
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  Contacto público
                </h3>
                <p className="text-sm text-muted-foreground">Cómo los alumnos se ponen en contacto contigo.</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Teléfono</Label>
                  <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+57 300 1234567" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</Label>
                  <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="hola@tuacademia.com" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> Sitio web</Label>
                  <Input type="url" value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://tuacademia.com" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Dirección de la sede principal</Label>
                <Input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Calle 123 # 45-67" />
                <p className="text-xs text-muted-foreground">
                  Para que aparezcas en el mapa de Explorar necesitas coordenadas — las defines en{' '}
                  <Link to="/branches" className="underline underline-offset-2 font-medium">Sedes</Link>.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <PublishedSuccessModal
        open={successOpen}
        onOpenChange={setSuccessOpen}
        publicUrl={publicUrl}
        viewUrl={`/schools/${schoolId}`}
        exploreHint={{ label: 'Escuelas', href: '/explorar?category=schools' }}
        description={`${schoolName || 'Tu academia'} ya es visible para alumnos potenciales en SportMaps. Comparte tu link para que te encuentren.`}
      />
    </div>
  );
}
