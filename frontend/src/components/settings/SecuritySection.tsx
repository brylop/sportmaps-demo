import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Key, Loader2, Save, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface SecuritySectionProps {
  saving: boolean;
  onChangePassword: (password: string) => Promise<void>;
}

export function SecuritySection({ saving, onChangePassword }: SecuritySectionProps) {
  const [passwords, setPasswords] = useState({
    new: '',
    confirm: '',
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (passwords.new.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (passwords.new !== passwords.confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    try {
      await onChangePassword(passwords.new);
      setPasswords({ new: '', confirm: '' });
    } catch (err) {
      // Error handled by parent hook toast
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Seguridad de la Cuenta
            </CardTitle>
            <CardDescription>
              Administra tu contraseña y protege el acceso a tu cuenta.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nueva Contraseña</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type="password"
                    className="pl-9"
                    value={passwords.new}
                    onChange={(e) => setPasswords(prev => ({ ...prev, new: e.target.value }))}
                    placeholder="Escribe tu nueva contraseña"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar Nueva Contraseña</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type="password"
                    className="pl-9"
                    value={passwords.confirm}
                    onChange={(e) => setPasswords(prev => ({ ...prev, confirm: e.target.value }))}
                    placeholder="Confirma tu nueva contraseña"
                  />
                </div>
              </div>
            </div>

            {error && (
              <Alert variant="destructive" className="py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">{error}</AlertDescription>
              </Alert>
            )}

            <Alert className="bg-amber-50 border-amber-200">
              <Shield className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800 font-semibold mb-1">Recomendación de seguridad</AlertTitle>
              <AlertDescription className="text-amber-700 text-xs">
                Usa una combinación de letras, números y símbolos para una contraseña más robusta. 
                Evita usar la misma contraseña que en otros sitios.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex justify-end border-t bg-muted/5 py-4">
            <Button type="submit" disabled={saving || !passwords.new} className="gap-2 shadow-sm">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Actualizar Contraseña
            </Button>
          </CardFooter>
        </Card>
      </form>

      <Card className="border-destructive/20 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Zona de Peligro
          </CardTitle>
          <CardDescription>
            Acciones irreversibles sobre tu cuenta de SportMaps.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="font-medium">Eliminar mi cuenta</p>
              <p className="text-sm text-muted-foreground">
                Se borrarán permanentemente todos tus datos, perfiles y membresías.
              </p>
            </div>
            <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive hover:text-destructive-foreground transition-colors shrink-0">
              Eliminar Cuenta
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
