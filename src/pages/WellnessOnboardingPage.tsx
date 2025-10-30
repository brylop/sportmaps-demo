import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Settings
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function WellnessOnboardingPage() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  const weekDays = [
    { id: 'monday', label: 'Lunes' },
    { id: 'tuesday', label: 'Martes' },
    { id: 'wednesday', label: 'Miércoles' },
    { id: 'thursday', label: 'Jueves' },
    { id: 'friday', label: 'Viernes' },
    { id: 'saturday', label: 'Sábado' },
    { id: 'sunday', label: 'Domingo' },
  ];

  const handleToggleDay = (dayId: string) => {
    setSelectedDays(prev =>
      prev.includes(dayId)
        ? prev.filter(d => d !== dayId)
        : [...prev, dayId]
    );
  };

  const handleSaveAvailability = () => {
    localStorage.setItem(`availability_configured_${user?.id}`, 'true');
    toast({
      title: '✅ Disponibilidad configurada',
      description: 'Los deportistas ya pueden agendar citas contigo',
    });
    setDialogOpen(false);
    navigate('/schedule');
  };

  const hasConfigured = localStorage.getItem(`availability_configured_${user?.id}`);

  const modules = [
    {
      id: 'calendar',
      title: 'Calendario de Citas',
      description: 'Tu calendario de citas está vacío. Cuando un deportista agende una sesión contigo, aparecerá aquí.',
      icon: Calendar,
      gradient: 'from-blue-500 to-cyan-500',
      route: '/schedule',
    },
    {
      id: 'athletes',
      title: 'Mis Deportistas/Pacientes',
      description: 'Aún no has atendido a ningún deportista. Aquí aparecerá un historial de las personas con las que has tenido citas.',
      icon: Users,
      gradient: 'from-purple-500 to-pink-500',
      route: '/athletes',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Welcome Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/60 mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">
            ¡Hola, {profile?.full_name}!
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Tu perfil de profesional de bienestar está activo.
          </p>
        </div>

        {/* Configuration Alert */}
        {!hasConfigured && (
          <Card className="border-2 border-yellow-500/50 bg-yellow-500/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="space-y-2 flex-1">
                  <h3 className="font-semibold text-lg">Configuración Pendiente</h3>
                  <p className="text-muted-foreground">
                    Para que los deportistas puedan reservar contigo, primero debes configurar
                    tus horarios de disponibilidad.
                  </p>
                  <Button 
                    className="mt-3"
                    onClick={() => setDialogOpen(true)}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Configurar mi Disponibilidad
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {hasConfigured && (
          <Card className="border-2 border-green-500/50 bg-green-500/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">¡Todo Listo!</h3>
                  <p className="text-muted-foreground">
                    Tu disponibilidad está configurada. Los deportistas ya pueden agendar citas contigo.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Modules Overview */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Tus Módulos</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {modules.map((module) => {
              const Icon = module.icon;

              return (
                <Card 
                  key={module.id}
                  className="relative overflow-hidden hover:shadow-lg transition-all duration-300"
                >
                  <div className={`absolute top-0 left-0 w-full h-2 bg-gradient-to-r ${module.gradient}`} />
                  
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${module.gradient} flex items-center justify-center flex-shrink-0`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <CardTitle className="text-lg">{module.title}</CardTitle>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {module.description}
                    </p>
                    
                    <Button 
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate(module.route)}
                    >
                      Ver Módulo
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Availability Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configurar Disponibilidad</DialogTitle>
              <DialogDescription>
                Define tus horarios de trabajo para que los deportistas puedan agendar citas.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="space-y-4">
                <Label>Días de Trabajo</Label>
                <div className="space-y-2">
                  {weekDays.map((day) => (
                    <div key={day.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={day.id}
                        checked={selectedDays.includes(day.id)}
                        onCheckedChange={() => handleToggleDay(day.id)}
                      />
                      <Label
                        htmlFor={day.id}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {day.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Horario de Trabajo</Label>
                <p className="text-sm text-muted-foreground">
                  Por defecto: 9:00 AM - 5:00 PM
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveAvailability}
                disabled={selectedDays.length === 0}
              >
                Guardar Disponibilidad
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
