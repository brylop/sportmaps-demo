import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MedicalAlertBadge } from '@/components/common/MedicalAlertBadge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Users,
  Trophy,
  Search,
  Plus,
  TrendingUp,
  Star,
  X as XIcon,
  Crown,
  MapPin,
  Calendar,
  Filter,
  RefreshCcw,
  LayoutGrid,
  List as ListIcon,
  Pencil,
  UserPlus,
  MoreVertical,
  Archive,
  Trash2,
  RotateCcw
} from 'lucide-react';
import { StatFilterBar } from '@/components/common/StatFilterBar';
import { TableRefreshBar } from '@/components/common/TableRefreshBar';
import { PermissionGate } from '@/components/PermissionGate';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CreateTeamModal } from '@/components/teams/CreateTeamModal';
import { EnrollTeamStudentModal } from '@/components/teams/EnrollTeamStudentModal';
import { useToast } from '@/hooks/use-toast';
import { studentsAPI } from '@/lib/api/students';
import { Mail, Phone, User, Copy } from 'lucide-react';

interface TeamWithRelations {
  id: string;
  name: string;
  sport?: string;
  age_group?: string;
  max_students?: number;
  current_students?: number;
  wins?: number;
  losses?: number;
  status: string;
  level?: string;
  school_id: string;
  branch_id?: string;
  team_id?: string;
  coach_id?: string;
  // Used to have programs here, now data is flat on teams table
  school_branches?: any;
  coach?: {
    full_name: string;
  }[];
  team_coaches?: {
    coach: {
      id: string;
      full_name: string;
    };
  }[];
  coach_name?: string;
  is_virtual?: boolean;
}

export default function TeamsPage() {
  const { toast } = useToast();
  const { schoolId, activeBranchId, currentUserRole } = useSchoolContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamWithRelations | null>(null);
  const [selectedTeamForEnroll, setSelectedTeamForEnroll] = useState<TeamWithRelations | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [showArchived, setShowArchived] = useState(false);
  const [teamToArchive, setTeamToArchive] = useState<TeamWithRelations | null>(null);
  const [teamToDelete, setTeamToDelete] = useState<TeamWithRelations | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch teams with relations
  const { data: teams = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['teams', schoolId, activeBranchId, currentUserRole],
    queryFn: async () => {
      if (!schoolId) return [];

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      const userEmail = authData.user?.email;

      // Fetch the staff record for this coach if they are a coach
      // Mapeo directo sobre datos de la tabla teams
      let staffId = null;
      if (currentUserRole === 'coach' && userEmail && schoolId) {
        const { data: staffData } = await supabase
          .from('school_staff')
          .select('id')
          .eq('email', userEmail)
          .eq('school_id', schoolId)
          .maybeSingle();

        if (staffData) {
          staffId = staffData.id;
        }
      }

      // Fetch all unified teams for the school
      const query = (supabase as any)
        .from('teams')
        .select('*, school_branches(name, id), team_coaches(coach:school_staff(full_name, id))')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });

      const { data: teamsData, error: teamsError } = await query;

      if (teamsError) throw teamsError;
      let allTeams = (teamsData || []) as unknown as TeamWithRelations[];

      // ── Resolver nombre del coach desde profiles cuando team_coaches está vacío ──
      // Ocurre cuando el entrenador asignado tiene rol owner/school_admin y no tiene
      // registro en school_staff, por lo que el join team_coaches → school_staff devuelve [].
      const teamsWithoutCoachName = allTeams.filter(
        (t) => (!t.team_coaches || t.team_coaches.length === 0) && t.coach_id
      );

      if (teamsWithoutCoachName.length > 0) {
        const coachIds = [...new Set(teamsWithoutCoachName.map((t) => t.coach_id as string))];

        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', coachIds);

        if (profilesData && profilesData.length > 0) {
          const profileMap = Object.fromEntries(profilesData.map((p: any) => [p.id, p.full_name]));

          allTeams = allTeams.map((team) => {
            if ((!team.team_coaches || team.team_coaches.length === 0) && team.coach_id && profileMap[team.coach_id]) {
              return {
                ...team,
                // Inyectar como team_coaches sintético para que el render existente lo lea igual
                team_coaches: [{
                  coach: {
                    id: team.coach_id,
                    full_name: profileMap[team.coach_id],
                  },
                }],
              };
            }
            return team;
          });
        }
      }
      // ─────────────────────────────────────────────────────────────────────────────

      const isAdminRole = (currentUserRole as string) === 'owner' ||
        (currentUserRole as string) === 'school' ||
        (currentUserRole as string) === 'admin' ||
        (currentUserRole as string) === 'school_admin' ||
        (currentUserRole as string) === 'super_admin';

      // Apply visibility logic by Role in memory
      if (isAdminRole) {
        // Admins see everything unless a specific branch is selected
        if (activeBranchId) {
          allTeams = allTeams.filter(team =>
            team.branch_id === activeBranchId || !team.branch_id
          );
        }
      }
      // Filtering logic based on user role
      if (currentUserRole === 'coach') {
        // Coach view: buscar por staffId (school_staff) y también por userId (profiles)
        // para cubrir coaches invitados cuyo staffId recién se creó o que tienen coach_id = profile.id
        allTeams = allTeams.filter(team => {
          if (staffId) {
            const isAssignedByStaff = team.team_coaches?.some((tc: any) => tc.coach?.id === staffId);
            if (isAssignedByStaff || team.coach_id === staffId) return true;
          }
          if (userId) {
            const isAssignedByProfile = team.team_coaches?.some((tc: any) => tc.coach?.id === userId);
            if (isAssignedByProfile || team.coach_id === userId) return true;
          }
          return false;
        });
      } else if (activeBranchId) {
        allTeams = allTeams.filter(team => team.branch_id === activeBranchId);
      }

      return allTeams;
    },
    enabled: !!schoolId
  });

  // Fetch school students for the detailed list view
  const { data: schoolStudents = [], isLoading: studentsLoading } = useQuery({
    queryKey: ['school-students', schoolId, activeBranchId],
    queryFn: () => schoolId ? studentsAPI.getSchoolView(schoolId) : Promise.resolve([]),
    enabled: statusFilter === 'with_students' && !!schoolId,
  });

  // Calculate Stats
  const stats = {
    total: teams.length,
    athletes: teams.reduce((sum, t) => sum + (t.current_students || 0), 0),
    victories: teams.reduce((sum, t) => sum + (t.wins || 0), 0),
    winRate: teams.length > 0
      ? Math.round((teams.reduce((sum, t) => {
        const total = (t.wins || 0) + (t.losses || 0);
        return sum + (total > 0 ? ((t.wins || 0) / total) * 100 : 0);
      }, 0) / teams.length))
      : 0
  };

  const archivedCount = teams.filter((t) => t.status === 'inactive').length;

  // Filtered teams
  const filteredTeams = teams.filter((team) => {
    // 0. Archivados: por defecto ocultos. El toggle "Ver archivados" muestra SOLO esos.
    const isArchived = team.status === 'inactive';
    if (showArchived) {
      if (!isArchived) return false;
    } else if (isArchived) {
      return false;
    }

    // 1. Search Filter
    const matchesSearch =
      team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (team.sport || '').toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // 2. Status Filter (Integrated with Stats Cards)
    if (statusFilter === 'active' && team.status !== 'active') return false;
    if (statusFilter === 'with_students' && (team.current_students || 0) <= 0) return false;
    if (statusFilter === 'with_wins' && (team.wins || 0) <= 0) return false;
    if (statusFilter === 'top_rate') {
      const total = (team.wins || 0) + (team.losses || 0);
      const rate = total > 0 ? (team.wins || 0) / total : 0;
      if (rate < 0.5 && team.wins === 0) return false;
    }

    return true;
  });

  const handleRefresh = () => {
    refetch();
    toast({
      title: 'Datos actualizados',
      description: 'La lista de equipos se ha refrescado correctamente.',
    });
  };

  // Archivar: soft-delete reversible (status inactive). No toca inscritos ni pagos.
  const handleArchive = async (team: TeamWithRelations) => {
    try {
      setActionLoading(true);
      const { error } = await (supabase as any)
        .from('teams')
        .update({ status: 'inactive' })
        .eq('id', team.id);
      if (error) throw error;
      toast({ title: 'Equipo archivado', description: `"${team.name}" se movió a archivados. Puedes reactivarlo cuando quieras.` });
      setTeamToArchive(null);
      refetch();
    } catch (err: any) {
      toast({ title: 'No se pudo archivar', description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async (team: TeamWithRelations) => {
    try {
      setActionLoading(true);
      const { error } = await (supabase as any)
        .from('teams')
        .update({ status: 'active' })
        .eq('id', team.id);
      if (error) throw error;
      toast({ title: 'Equipo reactivado', description: `"${team.name}" vuelve a estar activo.` });
      refetch();
    } catch (err: any) {
      toast({ title: 'No se pudo reactivar', description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  // Eliminar permanente: SOLO si el equipo está vacío (sin deportistas/inscripciones).
  // Si tiene datos, se bloquea y se sugiere archivar.
  const handleDelete = async (team: TeamWithRelations) => {
    try {
      setActionLoading(true);

      const [{ count: enrollCount }, { count: childCount }] = await Promise.all([
        supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('team_id', team.id),
        supabase.from('children').select('id', { count: 'exact', head: true }).eq('team_id', team.id),
      ]);
      const total = (enrollCount || 0) + (childCount || 0);
      if (total > 0) {
        toast({
          title: 'No se puede eliminar',
          description: `"${team.name}" tiene ${total} deportista(s)/inscripción(es) asociada(s). Archívalo en su lugar para conservar el historial.`,
          variant: 'destructive',
        });
        setTeamToDelete(null);
        return;
      }

      const { error } = await (supabase as any).from('teams').delete().eq('id', team.id);
      if (error) {
        // 23503 = foreign_key_violation → tiene registros relacionados (partidos, asistencia, etc.)
        if ((error as any).code === '23503') {
          toast({
            title: 'No se puede eliminar',
            description: `"${team.name}" tiene registros asociados. Archívalo en su lugar.`,
            variant: 'destructive',
          });
        } else {
          throw error;
        }
        setTeamToDelete(null);
        return;
      }

      toast({ title: 'Equipo eliminado', description: `"${team.name}" se eliminó permanentemente.` });
      setTeamToDelete(null);
      refetch();
    } catch (err: any) {
      toast({ title: 'Error al eliminar', description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  // Menú de acciones (⋯) reutilizable en tabla y grid.
  const renderActionsMenu = (team: TeamWithRelations) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Más acciones">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {team.status === 'inactive' ? (
          <DropdownMenuItem onClick={() => handleReactivate(team)}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reactivar
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => setTeamToArchive(team)}>
            <Archive className="h-4 w-4 mr-2" />
            Archivar
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => setTeamToDelete(team)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Eliminar permanente
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Header section like Invitations */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Mis Equipos</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Gestiona tus grupos deportivos y programas ({teams.length})
          </p>
        </div>

        <div className="flex items-center gap-2">
          {(searchTerm || statusFilter !== 'all') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
              }}
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              <XIcon className="h-4 w-4 mr-2" />
              Limpiar Filtros
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <PermissionGate permission="teams:create">
            <Button className="gap-2 bg-primary hover:bg-primary/90" onClick={() => setIsModalOpen(true)}>
              <Plus className="h-4 w-4" />
              Nuevo Equipo
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Stats Cards — tarjetas que filtran el listado al hacer clic */}
      <StatFilterBar
        columns={4}
        value={statusFilter === 'all' ? null : statusFilter}
        onChange={(v) => setStatusFilter(v ?? 'all')}
        items={[
          { key: null, label: 'Total Equipos', value: stats.total, tone: 'neutral' },
          { key: 'with_students', label: 'Deportistas', value: stats.athletes, tone: 'orange' },
          { key: 'with_wins', label: 'Victorias', value: stats.victories, tone: 'emerald' },
          { key: 'top_rate', label: '% Victoria', value: `${stats.winRate}%`, tone: 'blue' },
        ]}
      />

      {/* Filters & Search Like Invitations */}
      <Card className="bg-card/50 border-dashed shadow-none">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, deporte o programa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setSearchTerm('')}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px] h-10">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Nombre (A-Z)</SelectItem>
                <SelectItem value="newest">Más recientes</SelectItem>
                <SelectItem value="sport">Deporte</SelectItem>
                <SelectItem value="members">Más alumnos</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant={showArchived ? 'secondary' : 'outline'}
              size="sm"
              className="h-10 gap-2"
              onClick={() => setShowArchived((v) => !v)}
              title="Ver equipos archivados"
            >
              <Archive className="h-4 w-4" />
              {showArchived ? 'Ver activos' : `Archivados${archivedCount ? ` (${archivedCount})` : ''}`}
            </Button>

            <div className="border rounded-md p-1 flex bg-muted/20">
              <Button
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setViewMode('table')}
              >
                <ListIcon className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <RefreshCcw className="h-8 w-8 animate-spin text-primary opacity-50" />
          <p className="text-muted-foreground animate-pulse">Cargando equipos...</p>
        </div>
      ) : filteredTeams.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-16 text-center">
            <Users className="h-16 w-16 mx-auto text-muted-foreground/30 mb-6" />
            <h3 className="text-xl font-semibold mb-2">
              {statusFilter === 'with_students' ? 'Sin deportistas registrados' :
                statusFilter === 'with_wins' ? 'Sin victorias registradas' :
                  statusFilter === 'top_rate' ? 'Sin estadísticas de rendimiento' :
                    'No se encontraron equipos'}
            </h3>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              {searchTerm
                ? 'No hay equipos que coincidan con tu búsqueda. Prueba con otros términos.'
                : statusFilter === 'with_students'
                  ? 'Aún no hay alumnos inscritos en ningún equipo de esta sede.'
                  : statusFilter === 'with_wins' || statusFilter === 'top_rate'
                    ? 'Aún no se ha registrado información de partidos o victorias para estos equipos.'
                    : currentUserRole === 'coach'
                      ? 'Aún no estás asignado a ningún equipo. Pídele al administrador que te asigne a un equipo desde "Editar Equipo".'
                      : 'Aún no has creado ningún equipo en esta sede o para tu perfil.'}
            </p>
            <PermissionGate permission="teams:create">
              <Button className="gap-2 scale-110" onClick={() => setIsModalOpen(true)}>
                <Plus className="h-4 w-4" />
                Crear Primer Equipo
              </Button>
            </PermissionGate>
          </CardContent>
        </Card>
      ) : statusFilter === 'with_students' ? (
        <Card className="border-t-4 border-t-orange-500 shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Star className="h-5 w-5 text-orange-500" />
                  Listado de Deportistas Inscritos
                </CardTitle>
                <CardDescription>
                  Alumnos actualmente activos en la sede {activeBranchId ? '(Filtrado por sede)' : 'principal'}
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 px-3 py-1">
                {schoolStudents.length} Deportistas
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {studentsLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <RefreshCcw className="h-8 w-8 animate-spin text-orange-500 mb-2" />
                <p className="text-muted-foreground">Cargando lista de deportistas...</p>
              </div>
            ) : schoolStudents.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-xl">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-20" />
                <p className="text-muted-foreground font-medium">No se encontraron deportistas registrados</p>
                <p className="text-xs text-muted-foreground">Vincula alumnos a la escuela desde el módulo de Deportistas.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="font-bold">Nombre</TableHead>
                      <TableHead className="font-bold">Programa / Equipo</TableHead>
                      <TableHead className="font-bold">Acudiente</TableHead>
                      <TableHead className="font-bold">Contacto</TableHead>
                      <TableHead className="font-bold">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schoolStudents.map((student: any) => {
                      // Usar el acudiente registrado o recuperar el contacto de emergencia
                      const emergencyContact = student.emergency_contact || '';
                      const hasEmergencyContactParts = emergencyContact.includes(' - ');
                      const fallbackParentName = hasEmergencyContactParts ? emergencyContact.split(' - ')[0] : emergencyContact;
                      const fallbackParentPhone = hasEmergencyContactParts ? emergencyContact.split(' - ')[1] : '';

                      const isAdult = (student as any).athlete_type === 'adult';

                      const displayParentName = isAdult
                        ? null
                        : student.parent_name || fallbackParentName?.trim() || 'No registrado';

                      const displayParentPhone = isAdult
                        ? (student as any).parent_phone || null
                        : student.parent_phone || fallbackParentPhone?.trim() || null;

                      return (
                        <TableRow key={student.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-xs">
                                {student.full_name?.substring(0, 2).toUpperCase()}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{student.full_name}</span>
                                <MedicalAlertBadge medicalInfo={student.medical_info} />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[140px]">
                              {(student as any).team_name
                                ? String((student as any).team_name).split(',').map((prog: string, i: number) => (
                                  <Badge
                                    key={i}
                                    variant="secondary"
                                    className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary border-primary/20 whitespace-nowrap"
                                  >
                                    {prog.trim()}
                                  </Badge>
                                ))
                                : <span className="text-xs text-muted-foreground italic">Sin programa</span>
                              }
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              {isAdult ? <span className="text-muted-foreground">—</span> : displayParentName}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {displayParentPhone && (
                                <div className="flex items-center gap-1.5 text-xs">
                                  <Phone className="h-3 w-3 text-primary" />
                                  <span>{displayParentPhone}</span>
                                </div>
                              )}
                              {student.parent_email && (
                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                  <Mail className="h-3 w-3" />
                                  <span className="truncate max-w-[120px]">{student.parent_email}</span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-green-500 hover:bg-green-600 text-[10px] capitalize">
                              Activo
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : viewMode === 'table' ? (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[200px]">Equipo / Deporte</TableHead>
                  <TableHead className="hidden md:table-cell">Programa / Nivel</TableHead>
                  <TableHead className="hidden lg:table-cell">Sede</TableHead>
                  <TableHead>Entrenador</TableHead>
                  <TableHead className="hidden md:table-cell">Estadísticas</TableHead>
                  <TableHead className="hidden lg:table-cell">Capacidad</TableHead>
                  <TableHead className="hidden sm:table-cell">Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeams.map((team) => (
                  <TableRow key={team.id} className="hover:bg-muted/10 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Crown className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{team.name}</p>
                          <Badge variant="outline" className="text-[10px] mt-1">{team.sport}</Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium">{team.name}</span>
                        <span className="text-[10px] text-muted-foreground capitalize">
                          Nivel: {team.level || '—'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex items-center gap-1.5 text-xs">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        {team.school_branches?.name || 'Sede Principal'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[150px]">
                        {team.team_coaches && team.team_coaches.length > 0 ? (
                          team.team_coaches.map((tc: any) => (
                            <Badge key={tc.coach?.id} variant="secondary" className="text-[10px] py-0 h-5 bg-orange-50 text-orange-700 border-orange-100 truncate max-w-[130px]">
                              {tc.coach?.full_name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Sin asignar</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {((team.wins || 0) + (team.losses || 0)) > 0 ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-green-600 font-bold">W: {team.wins || 0}</span>
                            <span className="text-red-500 font-bold">L: {team.losses || 0}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">Sin info</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="w-24 space-y-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>{team.current_students || 0}/{team.max_students || 20}</span>
                          <span>{Math.round(((team.current_students || 0) / (team.max_students || 20)) * 100)}%</span>
                        </div>
                        <Progress value={((team.current_students || 0) / (team.max_students || 20)) * 100} className="h-1.5" />
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge
                        variant={team.status === 'active' ? 'default' : 'secondary'}
                        className={`capitalize text-[10px] ${team.status === 'active' ? 'bg-green-500 hover:bg-green-600' : ''}`}
                      >
                        {team.status === 'active' ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => { setSelectedTeamForEnroll(team); setIsEnrollModalOpen(true); }}
                          title="Gestionar Deportistas"
                        >
                          <UserPlus className="h-4 w-4" />
                        </Button>
                        <PermissionGate permission="teams:edit">
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8"
                            onClick={() => { setEditingTeam(team); setIsModalOpen(true); }}
                            title="Editar Equipo"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate permission="teams:edit">
                          {renderActionsMenu(team)}
                        </PermissionGate>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TableRefreshBar
              className="-mx-6 -mb-6 mt-2 rounded-b-lg"
              onRefresh={handleRefresh}
              loading={isFetching}
              summary={
                filteredTeams.length === teams.length
                  ? `${teams.length} equipo(s)`
                  : `${filteredTeams.length} de ${teams.length} equipo(s)`
              }
            />
          </CardContent>
        </Card>
      ) : (
        /* Grid View Mode */
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTeams.map((team) => (
            <Card key={team.id} className="hover:shadow-lg transition-all group overflow-hidden border-t-4 border-t-primary">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Crown className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{team.name}</CardTitle>
                      <CardDescription className="text-xs">{team.sport}</CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10">
                      {team.name || 'Equipo'}
                    </Badge>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => {
                          setSelectedTeamForEnroll(team);
                          setIsEnrollModalOpen(true);
                        }}
                        title="Gestionar Deportistas"
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                      <PermissionGate permission="teams:edit">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditingTeam(team);
                            setIsModalOpen(true);
                          }}
                          title="Editar Equipo"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </PermissionGate>
                      <PermissionGate permission="teams:edit">
                        {renderActionsMenu(team)}
                      </PermissionGate>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {((team.wins || 0) + (team.losses || 0)) > 0 ? (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-muted/40 rounded-lg flex flex-col gap-0.5">
                      <span className="text-muted-foreground">Victorias</span>
                      <span className="font-bold text-lg text-green-600">{team.wins || 0}</span>
                    </div>
                    <div className="p-2 bg-muted/40 rounded-lg flex flex-col gap-0.5">
                      <span className="text-muted-foreground">Derrotas</span>
                      <span className="font-bold text-lg text-red-600">{team.losses || 0}</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-muted/20 rounded-lg text-center">
                    <span className="text-[10px] text-muted-foreground italic">Aún no se registra información de victorias/derrotas</span>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{team.current_students || 0}/{team.max_students || 20} Alumnos</span>
                    </div>
                    <span>{Math.round(((team.current_students || 0) / (team.max_students || 20)) * 100)}%</span>
                  </div>
                  <Progress value={((team.current_students || 0) / (team.max_students || 20)) * 100} className="h-2" />
                </div>

                <div className="flex flex-wrap gap-1 mt-1">
                  <Star className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  <div className="flex flex-wrap gap-1">
                    {team.team_coaches && team.team_coaches.length > 0 ? (
                      team.team_coaches.map((tc: any) => (
                        <Badge key={tc.coach?.id} variant="secondary" className="text-[9px] py-0 h-3.5 bg-orange-50 text-orange-700 border-orange-100">
                          {tc.coach?.full_name}
                        </Badge>
                      ))
                    ) : team.coach?.[0]?.full_name ? (
                      <Badge variant="secondary" className="text-[9px] py-0 h-3.5 bg-orange-50 text-orange-700 border-orange-100">
                        {team.coach[0].full_name}
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-muted-foreground italic">Sin asignar</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    variant="default"
                    className="flex-1 h-8 text-xs"
                    size="sm"
                    onClick={() => {
                      setEditingTeam(team);
                      setIsModalOpen(true);
                    }}
                  >
                    Gestionar / Editar
                  </Button>
                  <Button
                    variant="outline"
                    className="h-8 px-2 gap-1 text-xs"
                    size="sm"
                    title="Copiar link para invitar padres"
                    onClick={() => {
                      const link = `${window.location.origin}/join-team/${team.id}`;
                      const waText = encodeURIComponent(`Únete al equipo ${team.name} en SportMaps: ${link}`);
                      toast({
                        title: `🔗 Invitar al equipo ${team.name}`,
                        description: (
                          <div className="flex gap-2 mt-2 flex-wrap">
                            <a
                              href={`https://wa.me/?text=${waText}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[#25D366] text-white hover:bg-[#1ebe59] transition-colors"
                            >
                              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                              WhatsApp
                            </a>
                            <button
                              onClick={() => navigator.clipboard.writeText(link)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-background hover:bg-muted transition-colors"
                            >
                              <Copy className="h-3 w-3" />
                              Copiar
                            </button>
                          </div>
                        ) as any,
                      });
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Invitar padres</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          <div className="md:col-span-2 lg:col-span-3">
            <Card className="overflow-hidden">
              <TableRefreshBar
                onRefresh={handleRefresh}
                loading={isFetching}
                summary={
                  filteredTeams.length === teams.length
                    ? `${teams.length} equipo(s)`
                    : `${filteredTeams.length} de ${teams.length} equipo(s)`
                }
                className="border-t-0"
              />
            </Card>
          </div>
        </div>
      )}

      {/* Modal for new team */}
      <CreateTeamModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTeam(null);
        }}
        onSuccess={() => {
          setIsModalOpen(false);
          setEditingTeam(null);
          refetch();
        }}
        schoolId={schoolId || ''}
        branchId={activeBranchId}
        team={editingTeam}
      />
      <EnrollTeamStudentModal
        open={isEnrollModalOpen}
        onClose={() => {
          setIsEnrollModalOpen(false);
          setSelectedTeamForEnroll(null);
        }}
        onSuccess={() => {
          refetch();
        }}
        team={selectedTeamForEnroll}
      />

      {/* Confirmar archivar */}
      <AlertDialog open={!!teamToArchive} onOpenChange={(o) => !o && setTeamToArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar "{teamToArchive?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              El equipo se ocultará de la lista activa pero se conserva junto con sus deportistas,
              inscripciones y pagos. Podrás reactivarlo en cualquier momento desde "Archivados".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (teamToArchive) handleArchive(teamToArchive); }}
              disabled={actionLoading}
            >
              {actionLoading ? 'Archivando...' : 'Archivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar eliminar permanente */}
      <AlertDialog open={!!teamToDelete} onOpenChange={(o) => !o && setTeamToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar "{teamToDelete?.name}" permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Solo funciona si el equipo está vacío
              (sin deportistas ni inscripciones). Si tiene datos asociados, usa "Archivar" en su lugar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); if (teamToDelete) handleDelete(teamToDelete); }}
              disabled={actionLoading}
            >
              {actionLoading ? 'Eliminando...' : 'Eliminar permanente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
