import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RoutineCard } from '@/components/trainer/RoutineCard';
import { RoutineFormModal } from '@/components/trainer/RoutineFormModal';
import { QuickUseRoutineModal } from '@/components/trainer/QuickUseRoutineModal';
import { Plus, Dumbbell, Loader2, Sparkles, Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';

const BFF_URL = import.meta.env.VITE_BFF_URL || 'http://localhost:3000';

export default function TrainerRoutines() {
  const { session } = useAuth();
  const token = session?.access_token;
  const { toast } = useToast();
  const navigate = useNavigate();
  const [routines, setRoutines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('Todas');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [useRoutine, setUseRoutine] = useState<any>(null);
  const [editingRoutine, setEditingRoutine] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchRoutines();
  }, []);

  const fetchRoutines = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BFF_URL}/api/v1/trainer/routines`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setRoutines(Array.isArray(data) ? data : []);
    } catch (err) {
      toast({ title: 'Error', description: 'No se pudieron cargar las rutinas.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (formData: any) => {
    setIsSaving(true);
    try {
      const isEdit = !!formData.id;
      const url = isEdit 
        ? `${BFF_URL}/api/v1/trainer/routines/${formData.id}` 
        : `${BFF_URL}/api/v1/trainer/routines`;
      
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(formData)
      });

      if (!res.ok) throw new Error('Error al guardar');

      toast({ title: isEdit ? '✅ Rutina actualizada' : '✅ Rutina creada' });
      fetchRoutines();
      setIsModalOpen(false);
    } catch (err) {
      toast({ title: 'Error', description: 'No se pudo guardar la rutina.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`${BFF_URL}/api/v1/trainer/routines/${deleteId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al eliminar');
      toast({ title: 'Rutina eliminada' });
      setRoutines(routines.filter(r => r.id !== deleteId));
    } catch (err) {
      toast({ title: 'Error', description: 'No se pudo eliminar la rutina.', variant: 'destructive' });
    } finally {
      setDeleteId(null);
    }
  };

  const filteredRoutines = routines.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === 'Todas' || r.category === activeTab;
    return matchesSearch && matchesTab;
  });

  const categories = ['Todas', ...Array.from(new Set(routines.map(r => r.category)))];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
            <Dumbbell className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter">Mis Rutinas</h1>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest opacity-80">Biblioteca de entrenamientos reutilizables</p>
          </div>
        </div>
        <Button 
          onClick={() => { setEditingRoutine(null); setIsModalOpen(true); }} 
          className="gap-2 bg-primary shadow-lg shadow-primary/20 h-12 px-6 font-bold"
        >
          <Plus className="h-5 w-5" />
          NUEVA RUTINA
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nombre..." 
            className="pl-9 bg-muted/20 border-border/40 h-11 font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-muted/20 p-1 h-11 border border-border/40">
            {categories.map(cat => (
              <TabsTrigger key={cat} value={cat} className="rounded-md px-4 font-black text-[10px] uppercase tracking-widest">
                {cat}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Cargando biblioteca...</p>
        </div>
      ) : filteredRoutines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center border-2 border-dashed border-border/50 rounded-3xl bg-accent/5">
          <div className="p-4 bg-accent/50 rounded-full mb-4">
            <Sparkles className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold mb-1">Aún no hay rutinas aquí</h3>
          <p className="text-muted-foreground max-w-xs">
            Comienza a construir tu biblioteca de entrenamientos para asignarlos rápidamente a tus clientes.
          </p>
          <Button 
            variant="outline" 
            className="mt-6 gap-2 border-primary/20 hover:bg-primary/5"
            onClick={() => setIsModalOpen(true)}
          >
            Configurar mi primera rutina
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {filteredRoutines.map(routine => (
            <RoutineCard 
              key={routine.id}
              routine={routine}
              onClick={(id) => navigate(`/trainer/routines/${id}`)}
              onUse={() => {
                setUseRoutine(routine);
              }}
              onDelete={(id) => setDeleteId(id)}
            />
          ))}
        </div>
      )}

      <RoutineFormModal 
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        routine={editingRoutine}
        onSave={handleSave}
        isLoading={isSaving}
      />

      <QuickUseRoutineModal 
        open={!!useRoutine}
        onClose={() => setUseRoutine(null)}
        routineId={useRoutine?.id}
        routineName={useRoutine?.name}
        onSuccess={() => fetchRoutines()}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold">¿Eliminar esta rutina?</AlertDialogTitle>
            <AlertDialogDescription className="font-medium">
              Esta acción no se puede deshacer. Se eliminará permanentemente de tu biblioteca de entrenamiento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl font-bold">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold"
            >
              Sí, eliminar rutina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
