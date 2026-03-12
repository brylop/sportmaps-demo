import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Building2, MapPin, Phone, Mail, Globe, Save, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getUserFriendlyError } from '@/lib/error-translator';

interface SchoolInfoProps {
  data: any;
  saving?: boolean;
  onSave: (updates: any) => Promise<void>;
}

export function SchoolInfoSection({ data, saving: parentSaving, onSave }: SchoolInfoProps) {
  const { toast } = useToast();
  const [localSaving, setLocalSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    city: '',
    address: '',
    phone: '',
    email: '',
    website: ''
  });

  useEffect(() => {
    if (data?.school) {
      setForm({
        name: data.school.name || '',
        description: data.school.description || '',
        city: data.school.city || '',
        address: data.school.address || '',
        phone: data.school.phone || '',
        email: data.school.email || '',
        website: data.school.website || ''
      });
    }
  }, [data]);

  const handleSave = async () => {
    setLocalSaving(true);
    try {
      await onSave(form);
      toast({
        title: "✅ Información guardada",
        description: "Los datos de la academia han sido actualizados correctamente.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      setLocalSaving(false);
    }
  };

  const isSaving = parentSaving || localSaving;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Información de la Academia</h2>
          <p className="text-muted-foreground">Gestiona los detalles públicos y de contacto de tu institución.</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="shadow-md gap-2">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isSaving ? 'Guardando...' : 'Guardar Cambios'}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Info */}
        <Card className="shadow-sm border-muted/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-primary" />
              Identidad
            </CardTitle>
            <CardDescription>Nombre oficial y descripción pública.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="school-name">Nombre de la Escuela *</Label>
              <Input
                id="school-name"
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ej. Academia de Artes Marciales"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="school-description">Descripción</Label>
              <Textarea
                id="school-description"
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Cuéntanos sobre tu academia..."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Location */}
        <Card className="shadow-sm border-muted/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5 text-amber-500" />
              Ubicación
            </CardTitle>
            <CardDescription>Sede principal y ciudad.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="school-city">Ciudad</Label>
              <Input
                id="school-city"
                value={form.city}
                onChange={(e) => setForm(prev => ({ ...prev, city: e.target.value }))}
                placeholder="Ej. Bogotá"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="school-address">Dirección</Label>
              <Input
                id="school-address"
                value={form.address}
                onChange={(e) => setForm(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Calle 123 # 45-67"
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card className="md:col-span-2 shadow-sm border-muted/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Phone className="h-5 w-5 text-blue-500" />
              Contacto y Web
            </CardTitle>
            <CardDescription>Información para que tus alumnos te encuentren.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="school-phone">Teléfono</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="school-phone"
                  className="pl-9"
                  value={form.phone}
                  onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+57 300 1234567"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="school-email">Email de Contacto</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="school-email"
                  type="email"
                  className="pl-9"
                  value={form.email}
                  onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="hola@tuacademia.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="school-website">Sitio Web</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="school-website"
                  className="pl-9"
                  value={form.website}
                  onChange={(e) => setForm(prev => ({ ...prev, website: e.target.value }))}
                  placeholder="https://tuacademia.com"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
