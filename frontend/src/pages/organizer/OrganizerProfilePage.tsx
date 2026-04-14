import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { CheckCircle2, AlertTriangle, Loader2, Save, Upload } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function OrganizerProfilePage() {
  const { session, user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [orgData, setOrgData] = useState<any>({});
  const [docFile, setDocFile] = useState<File | null>(null);

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('event_organizers')
        .select('*')
        .eq('user_id', user.id)
        .single();
        
      if (error && error.code !== 'PGRST116') throw error;
      if (data) setOrgData(data);
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'No se pudo cargar el perfil', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setOrgData((prev: any) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSwitchChange = (val: boolean) => {
    setOrgData((prev: any) => ({ ...prev, qr_smart_enabled: val }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/organizer/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        // En un caso real solo enviaríamos los campos que necesitamos
        body: JSON.stringify(orgData)
      });

      if (!response.ok) throw new Error('Error saving');
      
      toast({ title: 'Ajustes guardados', description: 'Tu perfil ha sido actualizado.' });
    } catch (err) {
      toast({ title: 'Error', description: 'No se pudieron guardar los ajustes', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleUploadDoc = async () => {
    if (!docFile || !user) return;
    setSaving(true);
    try {
      const fileExt = docFile.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('organizer-docs')
        .upload(fileName, docFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('organizer-docs')
        .getPublicUrl(fileName);

      setOrgData((prev: any) => ({ ...prev, verification_doc_url: urlData.publicUrl }));
      
      // Immediately call backend to update url
      await fetch(`${API_URL}/api/v1/organizer/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ verification_doc_url: urlData.publicUrl })
      });

      toast({ title: 'Documento subido', description: 'A la espera de verificación.' });
      setDocFile(null);
    } catch (err) {
      toast({ title: 'Error', description: 'No se pudo subir el archivo', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Perfil de Organizador</h1>
          <p className="text-muted-foreground">Administra los datos de tu empresa u organización</p>
        </div>
        
        {orgData.is_verified ? (
          <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-base px-3 py-1 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Organizador Verificado
          </Badge>
        ) : (
          <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-base px-3 py-1 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Verificación Pendiente
          </Badge>
        )}
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="w-full justify-start border-b rounded-none pb-px bg-transparent h-auto p-0">
          <TabsTrigger value="general" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3">General</TabsTrigger>
          <TabsTrigger value="verification" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3">Verificación</TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3">Ajustes</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Datos Básicos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre de la Organización</Label>
                  <Input name="organization_name" value={orgData.organization_name || ''} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>NIT</Label>
                  <Input name="nit" value={orgData.nit || ''} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>Ciudad</Label>
                  <Input name="city" value={orgData.city || ''} onChange={handleChange} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Biografía corta</Label>
                <Textarea name="bio" value={orgData.bio || ''} onChange={handleChange} rows={4} />
              </div>
            </CardContent>
            <CardFooter className="flex justify-end border-t p-4 bg-slate-50">
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Cambios
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="verification" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Documentos de Identidad</CardTitle>
              <CardDescription>Para certificar tu cuenta y habilitar pagos, requerimos validar la existencia legal.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {orgData.verification_doc_url ? (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex flex-col md:flex-row items-center gap-4">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                  <div className="flex-1 text-center md:text-left">
                    <p className="font-semibold text-green-900">Documento subido correctamente</p>
                    <a href={orgData.verification_doc_url} target="_blank" rel="noreferrer" className="text-sm text-green-700 underline">Ver documento actual</a>
                  </div>
                  {!orgData.is_verified && (
                    <div className="text-xs font-semibold text-amber-600 bg-amber-100 px-3 py-1 rounded-full uppercase tracking-wider">En revisión</div>
                  )}
                </div>
              ) : (
                <div className="text-center p-6 border-2 border-dashed rounded-xl bg-slate-50">
                  <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                  <p className="font-semibold">No se ha subido ningún documento</p>
                  <p className="text-sm text-muted-foreground mb-4">Sube un PDF o imagen con el RUT o documento equivalente de la empresa.</p>
                </div>
              )}

              {!orgData.is_verified && (
                <div className="pt-4 space-y-2">
                  <Label>Subir o Reemplazar Documento</Label>
                  <div className="flex gap-2">
                    <Input type="file" accept=".pdf,image/*" onChange={(e) => setDocFile(e.target.files?.[0] || null)} />
                    <Button onClick={handleUploadDoc} disabled={!docFile || saving} className="gap-2">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      Subir
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuraciones Adicionales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-white">
                <div className="space-y-0.5">
                  <Label className="text-base font-semibold">QR Smart Dinámico</Label>
                  <p className="text-sm text-muted-foreground">Genera códigos QR de acceso únicos e inteligentes para staff de los eventos.</p>
                </div>
                <Switch 
                  checked={orgData.qr_smart_enabled || false}
                  onCheckedChange={handleSwitchChange}
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-end border-t p-4 bg-slate-50">
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Configuración
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
