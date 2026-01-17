import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, Users, Trophy, ArrowRight, Loader2 } from 'lucide-react';

export default function OrganizerOnboardingPage() {
  const navigate = useNavigate();
  const { profile, updateProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    bio: profile?.bio || ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProfile({
        ...formData,
        role: 'organizer' as any
      });
      navigate('/organizer/home');
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: Calendar,
      title: 'Crea eventos fácilmente',
      description: 'Torneos, clínicas, tryouts y más en minutos'
    },
    {
      icon: Users,
      title: 'Gestiona inscripciones',
      description: 'Recibe y aprueba participantes desde tu dashboard'
    },
    {
      icon: Trophy,
      title: 'Comparte tu evento',
      description: 'Link público para compartir en redes sociales'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <div className="container max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            Bienvenido a SportMaps 🏟️
          </h1>
          <p className="text-xl text-muted-foreground">
            Organiza eventos deportivos y conecta con atletas
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {features.map((feature, index) => (
            <Card key={index} className="text-center">
              <CardContent className="pt-6">
                <feature.icon className="h-12 w-12 mx-auto mb-4 text-orange-500" />
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Completa tu perfil de organizador</CardTitle>
            <CardDescription>
              Esta información será visible para los participantes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="full_name">Nombre completo / Organización</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Tu nombre o nombre de tu organización"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Teléfono de contacto</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+57 300 123 4567"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="bio">Descripción (opcional)</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Cuéntanos sobre ti o tu organización..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={loading} size="lg" className="gap-2">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      Comenzar a crear eventos
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
