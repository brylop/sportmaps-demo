import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  User,
  Mail,
  Phone,
  Calendar,
  Shield,
  Edit2,
  Save,
  X,
  Camera
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ProfilePage() {
  const { user, profile, updateProfile } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    avatar_url: profile?.avatar_url || '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        avatar_url: profile.avatar_url || '',
      });
    }
  }, [profile]);

  const handleSave = async () => {
    try {
      setLoading(true);
      await updateProfile(formData);
      setIsEditing(false);
      toast({
        title: 'Perfil actualizado',
        description: 'Tus cambios han sido guardados exitosamente',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el perfil',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      full_name: profile?.full_name || '',
      phone: profile?.phone || '',
      avatar_url: profile?.avatar_url || '',
    });
    setIsEditing(false);
  };

  const getRoleName = (role: string) => {
    const roles: Record<string, string> = {
      athlete: 'Deportista/Atleta',
      parent: 'Padre/Madre',
      coach: 'Entrenador/Coach',
      school: 'Escuela/Centro Deportivo',
      wellness_professional: 'Profesional de Bienestar',
      store_owner: 'Tienda/Vendedor',
      admin: 'Administrador',
    };
    return roles[role] || role;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!profile) return null;

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mi Perfil</h1>
          <p className="text-muted-foreground">
            Gestiona tu información personal
          </p>
        </div>
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)}>
            <Edit2 className="h-4 w-4 mr-2" />
            Editar Perfil
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel} disabled={loading}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              Guardar
            </Button>
          </div>
        )}
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>Información Personal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={formData.avatar_url} />
                <AvatarFallback className="text-2xl">
                  {getInitials(formData.full_name || 'Usuario')}
                </AvatarFallback>
              </Avatar>
              {isEditing && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute bottom-0 right-0 h-8 w-8 rounded-full p-0"
                >
                  <Camera className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-semibold">{profile.full_name}</h3>
              <Badge variant="secondary" className="gap-1">
                <Shield className="h-3 w-3" />
                {getRoleName(profile.role)}
              </Badge>
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="full_name" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Nombre Completo
              </Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) =>
                  setFormData({ ...formData, full_name: e.target.value })
                }
                disabled={!isEditing}
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={user?.email || ''}
                disabled
                className="bg-muted"
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Teléfono
              </Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone || ''}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                disabled={!isEditing}
                placeholder="+57 300 123 4567"
              />
            </div>

            {/* Role (read-only) */}
            <div className="space-y-2">
              <Label htmlFor="role" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Tipo de Usuario
              </Label>
              <Input
                id="role"
                value={getRoleName(profile.role)}
                disabled
                className="bg-muted"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Card */}
      <Card>
        <CardHeader>
          <CardTitle>Estadísticas de la Cuenta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Puntos SportMaps</p>
              <p className="text-2xl font-bold">0</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Nivel de Suscripción</p>
              <p className="text-2xl font-bold">Gratis</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Miembro desde</p>
              <p className="text-2xl font-bold">2025</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Zona de Peligro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold">Eliminar cuenta</h4>
              <p className="text-sm text-muted-foreground">
                Esta acción es permanente y no se puede deshacer
              </p>
            </div>
            <Button variant="destructive">Eliminar Cuenta</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
