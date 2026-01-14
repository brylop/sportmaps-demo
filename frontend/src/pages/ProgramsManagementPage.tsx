import { useState, useEffect } from 'react';
<<<<<<< HEAD
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Users, Calendar, Edit2, Trash2 } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';

interface Program {
  id: string;
  name: string;
  description: string;
  sport: string;
  price_monthly: number;
  schedule: string;
  active: boolean;
  max_participants: number | null;
  current_participants: number;
}

export default function ProgramsManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [schoolId, setSchoolId] = useState<string | null>(null);

  // Form state basic
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sport: '',
    price_monthly: '',
    schedule: '',
    max_participants: ''
  });

  useEffect(() => {
    if (user) {
      fetchPrograms();
    }
  }, [user]);

  const fetchPrograms = async () => {
    try {
      setLoading(true);
      
      // 1. Get School ID
      const { data: schoolData, error: schoolError } = await supabase
        .from('schools')
        .select('id')
        .eq('owner_id', user?.id)
        .single();

      if (schoolError) throw schoolError;
      setSchoolId(schoolData.id);

      // 2. Get Programs
      const { data, error } = await supabase
        .from('programs')
        .select('*')
        .eq('school_id', schoolData.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPrograms(data || []);
    } catch (error) {
      console.error('Error:', error);
=======
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Users, Calendar, MapPin, DollarSign, Search, Loader2, RefreshCw, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { classesAPI, Class } from '@/lib/api/classes';
import { CreateClassModal } from '@/components/classes/CreateClassModal';

export default function ProgramsManagementPage() {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadClasses();
  }, [profile]);

  const loadClasses = async () => {
    try {
      setLoading(true);
      const data = await classesAPI.getClasses({
        school_id: profile?.id || 'demo-school',
        limit: 500
      });
      setClasses(data);
    } catch (error: any) {
      console.error('Error loading classes:', error);
      toast({
        title: 'Error al cargar clases',
        description: error.message,
        variant: 'destructive',
      });
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
    } finally {
      setLoading(false);
    }
  };

<<<<<<< HEAD
  const handleCreateProgram = async () => {
    if (!schoolId) return;

    try {
      const { error } = await supabase.from('programs').insert({
        school_id: schoolId,
        name: formData.name,
        description: formData.description,
        sport: formData.sport,
        price_monthly: Number(formData.price_monthly),
        schedule: formData.schedule,
        max_participants: formData.max_participants ? Number(formData.max_participants) : null,
        active: true
      });

      if (error) throw error;

      toast({ title: 'Programa creado exitosamente' });
      setIsCreateOpen(false);
      setFormData({ name: '', description: '', sport: '', price_monthly: '', schedule: '', max_participants: '' });
      fetchPrograms();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
=======
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadClasses();
    setRefreshing(false);
    toast({
      title: 'Lista actualizada',
      description: 'Las clases se han actualizado correctamente',
    });
  };

  const handleDelete = async (classId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta clase?')) return;
    
    try {
      await classesAPI.deleteClass(classId);
      toast({
        title: 'Clase eliminada',
        description: 'La clase se eliminó correctamente',
      });
      await loadClasses();
    } catch (error: any) {
      toast({
        title: 'Error al eliminar',
        description: error.message,
        variant: 'destructive',
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
      });
    }
  };

<<<<<<< HEAD
  const toggleStatus = async (programId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('programs')
        .update({ active: !currentStatus })
        .eq('id', programId);

      if (error) throw error;
      
      // Optimistic update
      setPrograms(programs.map(p => 
        p.id === programId ? { ...p, active: !currentStatus } : p
      ));
    } catch (error) {
      toast({ title: 'Error al actualizar estado', variant: 'destructive' });
    }
  };

  if (loading) return <LoadingSpinner fullScreen text="Cargando programas..." />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Mis Programas</h2>
          <p className="text-muted-foreground">
            Gestiona la oferta académica de tu escuela
          </p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Programa
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Programa</DialogTitle>
              <DialogDescription>
                Completa los detalles del programa para publicarlo en SportMaps.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre</Label>
                  <Input id="name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ej: Fútbol Base" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sport">Deporte</Label>
                  <Input id="sport" value={formData.sport} onChange={e => setFormData({...formData, sport: e.target.value})} placeholder="Ej: Fútbol" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea id="description" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Describe el programa..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Precio Mensual</Label>
                  <Input id="price" type="number" value={formData.price_monthly} onChange={e => setFormData({...formData, price_monthly: e.target.value})} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max">Cupos Máx.</Label>
                  <Input id="max" type="number" value={formData.max_participants} onChange={e => setFormData({...formData, max_participants: e.target.value})} placeholder="Opcional" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule">Horario</Label>
                <Input id="schedule" value={formData.schedule} onChange={e => setFormData({...formData, schedule: e.target.value})} placeholder="Ej: Mar y Jue 4PM" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreateProgram}>Crear Programa</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {programs.map((program) => (
          <Card key={program.id} className={`transition-opacity ${!program.active ? 'opacity-60' : ''}`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <Badge variant="secondary">{program.sport}</Badge>
                <Switch 
                  checked={program.active}
                  onCheckedChange={() => toggleStatus(program.id, program.active)}
                />
              </div>
              <CardTitle className="mt-2">{program.name}</CardTitle>
              <CardDescription className="line-clamp-2 h-10">
                {program.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center text-muted-foreground">
                  <Users className="mr-2 h-4 w-4" />
                  <span>{program.current_participants} / {program.max_participants || '∞'}</span>
                </div>
                <div className="font-bold text-lg">
                  ${program.price_monthly.toLocaleString()}
                </div>
              </div>
              <div className="flex items-center text-muted-foreground">
                <Calendar className="mr-2 h-4 w-4" />
                <span className="truncate">{program.schedule || 'Sin horario definido'}</span>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button variant="outline" className="w-full">
                <Edit2 className="mr-2 h-4 w-4" /> Editar
              </Button>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
=======
  const filteredClasses = classes.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.sport.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.coach_name?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const getCapacityBadge = (enrolled: number, capacity: number) => {
    const percentage = (enrolled / capacity) * 100;
    if (percentage === 100) return <Badge className="bg-red-500">🔴 Lleno</Badge>;
    if (percentage >= 80) return <Badge className="bg-yellow-500">🟡 Casi lleno</Badge>;
    return <Badge className="bg-green-500">🟢 Disponible</Badge>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Activo</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inactivo</Badge>;
      case 'full':
        return <Badge className="bg-red-500">Lleno</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelado</Badge>;
      default:
        return null;
    }
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'beginner':
        return <Badge variant="outline" className="bg-blue-50">Principiante</Badge>;
      case 'intermediate':
        return <Badge variant="outline" className="bg-purple-50">Intermedio</Badge>;
      case 'advanced':
        return <Badge variant="outline" className="bg-orange-50">Avanzado</Badge>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Cargando programas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 md:p-6 space-y-4 md:space-y-6 max-w-full overflow-x-hidden">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 md:gap-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Programas Deportivos</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Gestiona clases y programas ({classes.length})
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex-1 md:flex-initial"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Actualizar
          </Button>
          <Button 
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="flex-1 md:flex-initial"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nueva Clase
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardHeader className="p-3 md:p-6">
            <CardTitle className="text-sm md:text-base">Total Clases</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <div className="text-xl md:text-2xl font-bold">{classes.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 md:p-6">
            <CardTitle className="text-sm md:text-base">Activas</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <div className="text-xl md:text-2xl font-bold text-green-600">
              {classes.filter(c => c.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 md:p-6">
            <CardTitle className="text-sm md:text-base">Llenas</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <div className="text-xl md:text-2xl font-bold text-red-600">
              {classes.filter(c => c.enrolled_count >= c.capacity).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 md:p-6">
            <CardTitle className="text-sm md:text-base">Estudiantes</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <div className="text-xl md:text-2xl font-bold text-blue-600">
              {classes.reduce((sum, c) => sum + c.enrolled_count, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader className="p-3 md:p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, deporte o entrenador..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
      </Card>

      {/* Classes Grid */}
      {filteredClasses.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground mb-4">
              {searchQuery ? 'No se encontraron clases con esa búsqueda' : 'No hay clases creadas aún'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Crear Primera Clase
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClasses.map((classItem) => (
            <Card key={classItem.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{classItem.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {classItem.sport} • {getLevelBadge(classItem.level)}
                    </CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 text-destructive"
                      onClick={() => handleDelete(classItem.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {classItem.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {classItem.description}
                  </p>
                )}
                
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {classItem.enrolled_count}/{classItem.capacity} estudiantes
                  </span>
                  {getCapacityBadge(classItem.enrolled_count, classItem.capacity)}
                </div>

                {classItem.coach_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>Entrenador: {classItem.coach_name}</span>
                  </div>
                )}

                {classItem.location && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{classItem.location}</span>
                  </div>
                )}

                {classItem.schedule && classItem.schedule.length > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {classItem.schedule.length} sesión{classItem.schedule.length > 1 ? 'es' : ''} por semana
                    </span>
                  </div>
                )}

                {classItem.price !== undefined && classItem.price > 0 && (
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <DollarSign className="h-4 w-4" />
                    <span>${classItem.price.toLocaleString()}/mes</span>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  {getStatusBadge(classItem.status)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <CreateClassModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          loadClasses();
        }}
        schoolId={profile?.id || 'demo-school'}
      />
    </div>
  );
}
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
