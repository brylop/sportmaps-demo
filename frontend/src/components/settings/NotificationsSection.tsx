import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell, Mail, Smartphone, Info, Loader2, Save } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface NotificationsSectionProps {
  data: any;
  saving: boolean;
  onSave: (prefs: Record<string, boolean>) => Promise<void>;
}

export function NotificationsSection({ data, saving, onSave }: NotificationsSectionProps) {
  const [prefs, setPrefs] = useState({
    email_notifications: data?.profile?.preferences?.email_notifications ?? true,
    push_notifications: data?.profile?.preferences?.push_notifications ?? true,
    activity_alerts: data?.profile?.preferences?.activity_alerts ?? true,
    marketing_emails: data?.profile?.preferences?.marketing_emails ?? false,
    order_updates: data?.profile?.preferences?.order_updates ?? true,
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
            <Bell className="h-5 w-5 text-primary" />
            Preferencias de Notificación
          </CardTitle>
          <CardDescription>
            Elige cómo y cuándo quieres recibir noticias de SportMaps y tus escuelas seguidas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Canales de Comunicación</h3>
            
            <div className="flex items-center justify-between py-2">
              <div className="flex gap-3">
                <div className="mt-0.5 p-2 bg-primary/5 rounded-full text-primary">
                  <Mail className="h-4 w-4" />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-base">Notificaciones por Email</Label>
                  <p className="text-sm text-muted-foreground">Recibe alertas, resúmenes y actualizaciones en tu correo.</p>
                </div>
              </div>
              <Switch 
                checked={prefs.email_notifications} 
                onCheckedChange={(val) => handleToggle('email_notifications', val)} 
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="flex gap-3">
                <div className="mt-0.5 p-2 bg-primary/5 rounded-full text-primary">
                  <Smartphone className="h-4 w-4" />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-base">Notificaciones Push</Label>
                  <p className="text-sm text-muted-foreground">Alertas inmediatas en tu navegador o dispositivo móvil.</p>
                </div>
              </div>
              <Switch 
                checked={prefs.push_notifications} 
                onCheckedChange={(val) => handleToggle('push_notifications', val)} 
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Eventos y Actividad</h3>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Nuevas clases y horarios</Label>
                <p className="text-sm text-muted-foreground">Avisarme cuando mis escuelas publiquen nuevos horarios.</p>
              </div>
              <Switch 
                checked={prefs.activity_alerts} 
                onCheckedChange={(val) => handleToggle('activity_alerts', val)} 
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Actualizaciones de pedidos</Label>
                <p className="text-sm text-muted-foreground">Sobre tus compras en la tienda o pagos de membresías.</p>
              </div>
              <Switch 
                checked={prefs.order_updates} 
                onCheckedChange={(val) => handleToggle('order_updates', val)} 
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Promociones y novedades</Label>
                <p className="text-sm text-muted-foreground">Descuentos exclusivos y nuevas funciones de la plataforma.</p>
              </div>
              <Switch 
                checked={prefs.marketing_emails} 
                onCheckedChange={(val) => handleToggle('marketing_emails', val)} 
              />
            </div>
          </div>

          <Alert className="bg-primary/5 border-primary/20 text-primary-dark">
            <Info className="h-4 w-4 text-primary" />
            <AlertTitle>Privacidad de datos</AlertTitle>
            <AlertDescription className="text-xs">
              Respetamos tu privacidad. Nunca compartiremos tu correo con terceros sin tu consentimiento explícito. 
              Puedes darte de baja en cualquier momento.
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="flex justify-end border-t bg-muted/5 py-4">
          <Button type="submit" disabled={saving} className="gap-2 shadow-sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Actualizar Preferencias
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
