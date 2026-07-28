import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RoutineCard } from '@/components/trainer/RoutineCard';
import { RoutineFormModal } from '@/components/trainer/RoutineFormModal';
import { QuickUseRoutineModal } from '@/components/trainer/QuickUseRoutineModal';
import { Plus, Dumbbell, Loader2, Sparkles, Search, Globe2, ClipboardList, UserX, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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

// ── Sub-badge: identifica el origen de la rutina en la biblioteca del gym ───
function RoutineOriginBadge({ routine }: { routine: any }) {
  if (routine.scope === 'global') {
    return (
      <Badge className="gap-1 bg-blue-500/10 text-blue-600 border-blue-500/20 text-[10px] font-black uppercase tracking-widest">
        <Globe2 className="h-3 w-3" /> Catálogo SportMaps
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest">
      Personalizada
    </Badge>
  );
}

export default function SchoolRoutines() {
  const { session } = useAuth();
  const token = session?.access_token;
  const { toast } = useToast();
  const navigate = useNavigate();
  const [routines, setRoutines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('todas');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [useRoutine, setUseRoutine] = useState<any>(null);
  const [editingRoutine, setEditingRoutine] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [assignedSessions, setAssignedSessions] = useState<any[]>([]);
  const [loadingAssigned, setLoadingAssigned] = useState(false);
  const [unassigningId, setUnassigningId] = useState<string | null>(null);
  const [sessionToUnassign, setSessionToUnassign] = useState<any | null>(null);

  useEffect(() => {
    fetchRoutines();
  }, []);

  useEffect(() => {
    if (activeTab === 'asignadas' && assignedSessions.length === 0 && !loadingAssigned) {
      fetchAssignedSessions();
    }
  }, [activeTab]);

  const fetchRoutines = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BFF_URL}/api/v1/school/routines?include_global=true`, {
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

  const fetchAssignedSessions = async () => {
    setLoadingAssigned(true);
    try {
      const res = await fetch(`${BFF_URL}/api/v1/school/session-plans`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setAssignedSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      toast({ title: 'Error', description: 'No se pudieron cargar las sesiones asignadas.', variant: 'destructive' });
    } finally {
      setLoadingAssigned(false);
    }
  };

  const handleUnassign = async () => {
    if (!sessionToUnassign) return;
    setUnassigningId(sessionToUnassign.id);
    try {
      const res = await fetch(`${BFF_URL}/api/v1/school/session-plans/${sessionToUnassign.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'No se pudo desasociar.');
      toast({ title: '✅ Sesión desasociada' });
      setAssignedSessions(assignedSessions.filter(s => s.id !== sessionToUnassign.id));
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message ?? 'No se pudo desasociar.', variant: 'destructive' });
    } finally {
      setUnassigningId(null);
      setSessionToUnassign(null);
    }
  };

  const handleSave = async (formData: any) => {
    setIsSaving(true);
    try {
      const isEdit = !!formData.id;
      const url = isEdit
        ? `${BFF_URL}/api/v1/school/routines/${formData.id}`
        : `${BFF_URL}/api/v1/school/routines`;

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
      const res = await fetch(`${BFF_URL}/api/v1/school/routines/${deleteId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al eliminar');
      toast({ title: 'Rutina eliminada' });
      setRoutines(routines.filter(r => r.id !== deleteId));
    } catch (err) {
      toast({ title: 'Error', description: 'No se pudo eliminar la rutina. (El catálogo global no se puede borrar desde aquí.)', variant: 'destructive' });
    } finally {
      setDeleteId(null);
    }
  };

  // ── Filtro por pestaña: Todas / Personalizadas / Catálogo ──
  const tabFiltered = routines.filter(r => {
    if (activeTab === 'todas') return true;
    if (activeTab === 'personalizadas') return r.scope === 'school';
    if (activeTab === 'catalogo') return r.scope === 'global';
    return true;
  });

  const filteredRoutines = tabFiltered.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTag = !selectedTag || (r.tags && r.tags.includes(selectedTag));
    return matchesSearch && matchesTag;
  });

  const counts = {
    todas: routines.length,
    personalizadas: routines.filter(r => r.scope === 'school').length,
    catalogo: routines.filter(r => r.scope === 'global').length,
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
            <Dumbbell className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter">Rutinas del Gimnasio</h1>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest opacity-80">
              Biblioteca compartida entre dueño y coaches
            </p>
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
        <div className="flex items-center gap-2 w-full md:max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre..."
              className="pl-9 bg-muted/20 border-border/40 h-11 font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {selectedTag && (
            <Badge 
              variant="secondary" 
              className="h-11 px-3 gap-2 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 rounded-xl shrink-0"
            >
              #{selectedTag}
              <button 
                onClick={() => setSelectedTag(null)} 
                className="font-bold hover:text-destructive text-sm"
              >
                ×
              </button>
            </Badge>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-muted/20 p-1 h-11 border border-border/40">
            <TabsTrigger value="todas" className="rounded-md px-4 font-black text-[10px] uppercase tracking-widest">
              Todas ({counts.todas})
            </TabsTrigger>
            <TabsTrigger value="personalizadas" className="rounded-md px-4 font-black text-[10px] uppercase tracking-widest">
              Personalizadas ({counts.personalizadas})
            </TabsTrigger>
            <TabsTrigger value="catalogo" className="rounded-md px-4 font-black text-[10px] uppercase tracking-widest">
              <Globe2 className="h-3 w-3 mr-1" /> Catálogo ({counts.catalogo})
            </TabsTrigger>
            <TabsTrigger value="asignadas" className="rounded-md px-4 font-black text-[10px] uppercase tracking-widest">
              <ClipboardList className="h-3 w-3 mr-1" /> Asignadas
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {activeTab === 'asignadas' ? (
        loadingAssigned ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Cargando sesiones asignadas...</p>
          </div>
        ) : assignedSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center border-2 border-dashed border-border/50 rounded-3xl bg-accent/5">
            <div className="p-4 bg-accent/50 rounded-full mb-4">
              <ClipboardList className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold mb-1">Sin sesiones asignadas todavía</h3>
            <p className="text-muted-foreground max-w-xs">
              Cuando le asignes una rutina a un atleta desde "Usar rutina ahora", aparecerá aquí.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignedSessions.map((s) => (
              <div key={s.id} className="flex items-center gap-4 p-4 rounded-2xl border border-border/40 bg-card">
                <Avatar className="h-10 w-10 border-2 border-background shadow-sm shrink-0">
                  <AvatarImage src={s.client_avatar ?? undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                    {s.client_name?.substring(0, 2).toUpperCase() ?? '??'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{s.name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-[9px] py-0">{s.client_name}</Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(s.session_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                    </span>
                    <Badge
                      className={`text-[9px] py-0 ${
                        s.status === 'completed' ? 'bg-green-500/10 text-green-600 border-green-500/20'
                        : s.status === 'in_progress' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                        : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {s.status === 'completed' ? 'Completada' : s.status === 'in_progress' ? 'En progreso' : 'Asignada'}
                    </Badge>
                  </div>
                </div>
                {s.status !== 'completed' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => setSessionToUnassign(s)}
                    disabled={unassigningId === s.id}
                  >
                    {unassigningId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Cargando biblioteca...</p>
        </div>
      ) : filteredRoutines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center border-2 border-dashed border-border/50 rounded-3xl bg-accent/5">
          <div className="p-4 bg-accent/50 rounded-full mb-4">
            <Sparkles className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold mb-1">
            {activeTab === 'catalogo' ? 'Aún no hay catálogo global' : 'Aún no hay rutinas aquí'}
          </h3>
          <p className="text-muted-foreground max-w-xs">
            {activeTab === 'catalogo'
              ? 'SportMaps aún no ha publicado rutinas predeterminadas globales.'
              : 'Comienza a construir tu biblioteca de entrenamientos para el equipo.'}
          </p>
          {activeTab !== 'catalogo' && (
            <Button
              variant="outline"
              className="mt-6 gap-2 border-primary/20 hover:bg-primary/5"
              onClick={() => setIsModalOpen(true)}
            >
              Configurar mi primera rutina
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {filteredRoutines.map(routine => (
            <div key={routine.id} className="space-y-2">
              <RoutineOriginBadge routine={routine} />
              <RoutineCard
                routine={routine}
                onClick={(id) => navigate(`/school/routines/${id}`)}
                onUse={() => setUseRoutine(routine)}
                onDelete={routine.scope === 'global' ? undefined : (id) => setDeleteId(id)}
                onTagClick={(tag) => setSelectedTag(tag === selectedTag ? null : tag)}
              />
            </div>
          ))}
        </div>
      )}

      <RoutineFormModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        routine={editingRoutine}
        onSave={handleSave}
        isLoading={isSaving}
        context="school"
      />

      <QuickUseRoutineModal
        open={!!useRoutine}
        onClose={() => setUseRoutine(null)}
        routineId={useRoutine?.id}
        routineName={useRoutine?.name}
        onSuccess={() => fetchRoutines()}
        useEndpoint="school"
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold">¿Eliminar esta rutina?</AlertDialogTitle>
            <AlertDialogDescription className="font-medium">
              Esta acción no se puede deshacer. Se eliminará permanentemente de la biblioteca del gimnasio
              y ya no estará disponible para ningún coach.
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

      <AlertDialog open={!!sessionToUnassign} onOpenChange={() => setSessionToUnassign(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold flex items-center gap-2">
              <UserX className="h-5 w-5 text-destructive" /> ¿Desasociar esta sesión?
            </AlertDialogTitle>
            <AlertDialogDescription className="font-medium">
              "{sessionToUnassign?.name}" dejará de estar asignada a {sessionToUnassign?.client_name}.
              {sessionToUnassign?.status === 'in_progress' && ' Ya tiene progreso registrado — se perderá.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl font-bold">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnassign}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold"
            >
              Sí, desasociar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
