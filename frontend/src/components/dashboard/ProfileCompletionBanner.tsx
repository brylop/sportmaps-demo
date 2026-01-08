import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Target, 
  Calendar, 
  Users, 
  X,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ProfileCompletionBannerProps {
  onDismiss?: () => void;
}

export function ProfileCompletionBanner({ onDismiss }: ProfileCompletionBannerProps) {
  const { profile, updateProfile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  // Form states for athlete
  const [sportLevel, setSportLevel] = useState('');
  const [position, setPosition] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  
  // Form states for parent
  const [childName, setChildName] = useState('');
  const [childAge, setChildAge] = useState('');
  const [childSport, setChildSport] = useState('');

  if (!profile) return null;

  // Calculate profile completion
  const getCompletionPercentage = () => {
    let completed = 0;
    const total = 4;
    
    if (profile.full_name && profile.full_name !== 'Usuario') completed++;
    if (profile.date_of_birth) completed++;
    if (profile.phone) completed++;
    if (profile.bio) completed++;
    
    return Math.round((completed / total) * 100);
  };

  const completionPercentage = getCompletionPercentage();
  
  // Si el perfil está completo, no mostrar el banner
  if (completionPercentage === 100) return null;

  const handleAthleteSubmit = async () => {
    setLoading(true);
    try {
      await updateProfile({
        date_of_birth: dateOfBirth || undefined,
        bio: `Nivel: ${sportLevel}${position ? `, Posición: ${position}` : ''}`,
      });
      
      toast({
        title: '¡Perfil actualizado!',
        description: 'Tu información deportiva ha sido guardada',
      });
      
      setShowForm(false);
      onDismiss?.();
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

  const handleParentSubmit = async () => {
    setLoading(true);
    try {
      await updateProfile({
        bio: `Padre de: ${childName} (${childAge} años) - ${childSport}`,
      });
      
      toast({
        title: '¡Perfil actualizado!',
        description: 'La información de tu hijo ha sido guardada. Puedes agregar más hijos desde "Mis Hijos".',
      });
      
      setShowForm(false);
      onDismiss?.();
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

  const renderAthleteForm = () => (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="dateOfBirth">Fecha de nacimiento</Label>
          <Input
            id="dateOfBirth"
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="sportLevel">Nivel deportivo</Label>
          <Select value={sportLevel} onValueChange={setSportLevel}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona nivel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="principiante">Principiante</SelectItem>
              <SelectItem value="intermedio">Intermedio</SelectItem>
              <SelectItem value="avanzado">Avanzado</SelectItem>
              <SelectItem value="competitivo">Competitivo</SelectItem>
              <SelectItem value="profesional">Profesional</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="position">Posición/Especialidad</Label>
          <Input
            id="position"
            placeholder="Ej: Delantero, Nadador, etc."
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          />
        </div>
      </div>
      
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => setShowForm(false)}>
          Cancelar
        </Button>
        <Button 
          onClick={handleAthleteSubmit} 
          disabled={loading}
          style={{ backgroundColor: '#FB9F1E' }}
        >
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Guardar
        </Button>
      </div>
    </div>
  );

  const renderParentForm = () => (
    <div className="space-y-4 pt-4">
      <p className="text-sm text-muted-foreground">
        Agrega la información de tu hijo para comenzar a explorar programas deportivos
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="childName">Nombre del hijo/a</Label>
          <Input
            id="childName"
            placeholder="Nombre completo"
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="childAge">Edad</Label>
          <Input
            id="childAge"
            type="number"
            placeholder="Años"
            min={3}
            max={18}
            value={childAge}
            onChange={(e) => setChildAge(e.target.value)}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="childSport">Deporte de interés</Label>
          <Select value={childSport} onValueChange={setChildSport}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona deporte" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="futbol">Fútbol</SelectItem>
              <SelectItem value="baloncesto">Baloncesto</SelectItem>
              <SelectItem value="natacion">Natación</SelectItem>
              <SelectItem value="tenis">Tenis</SelectItem>
              <SelectItem value="gimnasia">Gimnasia</SelectItem>
              <SelectItem value="artes-marciales">Artes Marciales</SelectItem>
              <SelectItem value="voleibol">Voleibol</SelectItem>
              <SelectItem value="atletismo">Atletismo</SelectItem>
              <SelectItem value="otro">Otro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => setShowForm(false)}>
          Cancelar
        </Button>
        <Button 
          onClick={handleParentSubmit} 
          disabled={loading || !childName || !childAge || !childSport}
          style={{ backgroundColor: '#248223' }}
        >
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Guardar Información
        </Button>
      </div>
    </div>
  );

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FB9F1E]/20 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-[#FB9F1E]" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold font-poppins">
                Completa tu Perfil para Empezar
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {profile.role === 'athlete' 
                  ? 'Agrega tu información deportiva para personalizar tu experiencia'
                  : profile.role === 'parent'
                  ? 'Vincula o crea el perfil de tu hijo/a para comenzar'
                  : 'Completa tu información para acceder a todas las funciones'
                }
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <Badge variant="outline" className="mb-1">
                {completionPercentage}% completo
              </Badge>
              <Progress value={completionPercentage} className="w-24 h-2" />
            </div>
            
            {onDismiss && (
              <Button variant="ghost" size="icon" onClick={onDismiss}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {!showForm ? (
          <div className="flex flex-wrap gap-2 pt-2">
            {profile.role === 'athlete' && (
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="gap-2"
                  onClick={() => setShowForm(true)}
                >
                  <Target className="w-4 h-4" />
                  Agregar nivel deportivo
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="gap-2"
                  onClick={() => setShowForm(true)}
                >
                  <Calendar className="w-4 h-4" />
                  Fecha de nacimiento
                </Button>
              </>
            )}
            
            {profile.role === 'parent' && (
              <Button 
                variant="outline" 
                size="sm"
                className="gap-2 border-[#248223] text-[#248223] hover:bg-[#248223]/10"
                onClick={() => setShowForm(true)}
              >
                <Users className="w-4 h-4" />
                Vincular hijo/a
              </Button>
            )}
            
            {!['athlete', 'parent'].includes(profile.role) && (
              <Button 
                variant="outline" 
                size="sm"
                className="gap-2"
                onClick={() => setShowForm(true)}
              >
                <User className="w-4 h-4" />
                Completar información
              </Button>
            )}
          </div>
        ) : (
          profile.role === 'athlete' ? renderAthleteForm() : 
          profile.role === 'parent' ? renderParentForm() : 
          renderAthleteForm()
        )}
      </CardContent>
    </Card>
  );
}
