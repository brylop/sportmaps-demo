import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Globe, Lock, Loader2, Save, Users } from 'lucide-react';

interface PrivacySectionProps {
  data: any;
  saving: boolean;
  onSave: (prefs: Record<string, boolean>) => Promise<void>;
}

export function PrivacySection({ data, saving, onSave }: PrivacySectionProps) {
  const [prefs, setPrefs] = useState({
    public_profile: data?.profile?.preferences?.public_profile ?? true,
    show_stats: data?.profile?.preferences?.show_stats ?? true,
    show_achievements: data?.profile?.preferences?.show_achievements ?? true,
    allow_search: data?.profile?.preferences?.allow_search ?? true,
  });

  const handleToggle = (key: string, value: boolean) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(prefs);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in duration-500">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Privacidad del Perfil
          </CardTitle>
          <CardDescription>
            Controla quién puede ver tu actividad y cómo apareces en los resultados de búsqueda.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-muted-foreground/10">
              <div className="flex gap-4">
                <div className="mt-1">
                  {prefs.public_profile ? <Eye className="h-5 w-5 text-primary" /> : <EyeOff className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="space-y-0.5">
                  <Label className="text-base">Manten mi perfil público</Label>
                  <p className="text-sm text-muted-foreground">Otras personas podrán ver tus datos básicos y logros.</p>
                </div>
              </div>
              <Switch 
                checked={prefs.public_profile} 
                onCheckedChange={(val) => handleToggle('public_profile', val)} 
              />
            </div>

            <div className="grid gap-6 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex gap-3">
                  <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="space-y-0.5">
                    <Label>Aparecer en búsquedas</Label>
                    <p className="text-sm text-muted-foreground">Permitir que otros te encuentren por tu nombre o email.</p>
                  </div>
                </div>
                <Switch 
                  checked={prefs.allow_search} 
                  onCheckedChange={(val) => handleToggle('allow_search', val)} 
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex gap-3">
                  <Lock className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="space-y-0.5">
                    <Label>Mostrar estadísticas de rendimiento</Label>
                    <p className="text-sm text-muted-foreground">Visible solo para tus entrenadores si está desactivado.</p>
                  </div>
                </div>
                <Switch 
                  checked={prefs.show_stats} 
                  onCheckedChange={(val) => handleToggle('show_stats', val)} 
                />
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end border-t bg-muted/5 py-4">
          <Button type="submit" disabled={saving} className="gap-2 shadow-sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar Privacidad
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
