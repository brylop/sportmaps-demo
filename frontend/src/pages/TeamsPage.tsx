import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
  UserPlus
} from 'lucide-react';
import { PermissionGate } from '@/components/PermissionGate';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreateTeamModal } from '@/components/teams/CreateTeamModal';
import { EnrollTeamStudentModal } from '@/components/teams/EnrollTeamStudentModal';
import { useToast } from '@/hooks/use-toast';
import { studentsAPI } from '@/lib/api/students';
import { Mail, Phone, User } from 'lucide-react';

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
  program_id?: string;
  coach_id?: string;
  programs?: any; // Using any for deep flexible access to name, coach_id, etc.
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

  // Fetch teams with relations
  const { data: teams = [], isLoading, refetch } = useQuery({
    queryKey: ['teams', schoolId, activeBranchId, currentUserRole],
    queryFn: async () => {
      if (!schoolId) return [];

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      const userEmail = authData.user?.email;

      // Fetch the staff record for this coach if they are a coach
      // This is necessary because programs often link to school_staff.id instead of profiles.id
      let staffId = null;
      if (currentUserRole === 'coach' && userEmail) {
        const { data: staffData } = await supabase
          .from('school_staff')
          .select('id')
          .eq('email', userEmail)
          .single();

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
      if (currentUserRole === 'coach' && staffId) {
        // Coach view: filter by team_coaches relation or legacy fields
        allTeams = allTeams.filter(team => {
          const isAssigned = team.team_coaches?.some((tc: any) => tc.coach?.id === staffId);
          const isLegacyCoach = team.coach_id === staffId;

          return isAssigned || isLegacyCoach;
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
    queryFn: () => schoolId ? studentsAPI.getSchoolView(schoolId, activeBranchId) : Promise.resolve([]),
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

  // Filtered teams
  const filteredTeams = teams.filter((team) => {
    // 1. Search Filter
    const matchesSearch =
      team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (team.sport || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (team.programs?.name || '').toLowerCase().includes(searchTerm.toLowerCase());

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

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Header section like Invitations */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Mis Equipos</h1>
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

      {/* Stats Cards - Replicating screenshot */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card
          className={`bg-card transition-all border-l-4 border-l-primary cursor-pointer hover:shadow-md ${statusFilter === 'all' ? 'ring-2 ring-primary ring-offset-2' : 'opacity-80 hover:opacity-100'}`}
          onClick={() => setStatusFilter(statusFilter === 'all' ? 'all' : 'all')}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Equipos
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card
          className={`bg-card transition-all border-l-4 border-l-orange-500 cursor-pointer hover:shadow-md ${statusFilter === 'with_students' ? 'ring-2 ring-orange-500 ring-offset-2' : 'opacity-80 hover:opacity-100'}`}
          onClick={() => setStatusFilter(statusFilter === 'with_students' ? 'all' : 'with_students')}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Deportistas
              </CardTitle>
              <Star className="h-4 w-4 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.athletes}</div>
          </CardContent>
        </Card>

        <Card
          className={`bg-card transition-all border-l-4 border-l-green-500 cursor-pointer hover:shadow-md ${statusFilter === 'with_wins' ? 'ring-2 ring-green-500 ring-offset-2' : 'opacity-80 hover:opacity-100'}`}
          onClick={() => setStatusFilter(statusFilter === 'with_wins' ? 'all' : 'with_wins')}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Victorias
              </CardTitle>
              <Trophy className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.victories}</div>
          </CardContent>
        </Card>

        <Card
          className={`bg-card transition-all border-l-4 border-l-blue-500 cursor-pointer hover:shadow-md ${statusFilter === 'top_rate' ? 'ring-2 ring-blue-500 ring-offset-2' : 'opacity-80 hover:opacity-100'}`}
          onClick={() => setStatusFilter(statusFilter === 'top_rate' ? 'all' : 'top_rate')}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                % Victoria
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.winRate}%</div>
          </CardContent>
        </Card>
      </div>

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
                {schoolStudents.length} Estudiantes
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
                <p className="text-muted-foreground font-medium">No se encontraron estudiantes registrados</p>
                <p className="text-xs text-muted-foreground">Vincula alumnos a la escuela desde el módulo de Estudiantes.</p>
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
                    {schoolStudents.map((student: any) => (
                      <TableRow key={student.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-xs">
                              {student.full_name?.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="font-medium">{student.full_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-background text-[10px]">
                            {student.program_name || 'Sin programa'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            {student.parent_name || 'No registrado'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {student.parent_phone && (
                              <div className="flex items-center gap-1.5 text-xs">
                                <Phone className="h-3 w-3 text-primary" />
                                <span>{student.parent_phone}</span>
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
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : viewMode === 'table' ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[280px]">Equipo / Deporte</TableHead>
                  <TableHead>Programa / Nivel</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead>Entrenador</TableHead>
                  <TableHead>Estadísticas</TableHead>
                  <TableHead>Capacidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeams.map((team) => (
                  <TableRow key={team.id} className="hover:bg-muted/10 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Crown className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{team.name}</p>
                          <Badge variant="outline" className="text-[10px] mt-1">
                            {team.sport}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium">{team.programs?.name || team.name}</span>
                        <span className="text-[10px] text-muted-foreground capitalize">
                          Nivel: {team.programs?.level || team.level || '—'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                        {team.school_branches?.name || 'Sede Principal'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {team.team_coaches && team.team_coaches.length > 0 ? (
                          team.team_coaches.map((tc: any) => (
                            <Badge key={tc.coach?.id} variant="secondary" className="text-[10px] py-0 h-4 bg-orange-50 text-orange-700 border-orange-100">
                              {tc.coach?.full_name}
                            </Badge>
                          ))
                        ) : team.coach?.[0]?.full_name ? (
                          <Badge variant="secondary" className="text-[10px] py-0 h-4 bg-orange-50 text-orange-700 border-orange-100">
                            {team.coach[0].full_name}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Sin asignar</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {((team.wins || 0) + (team.losses || 0)) > 0 ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-green-600 font-bold">W: {team.wins || 0}</span>
                            <span className="text-red-500 font-bold">L: {team.losses || 0}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            Efectividad: {Math.round(((team.wins || 0) / ((team.wins || 0) + (team.losses || 0) || 1)) * 100)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">Aún no registra información</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="w-24 space-y-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>{team.current_students || 0}/{team.max_students || 20}</span>
                          <span>{Math.round(((team.current_students || 0) / (team.max_students || 20)) * 100)}%</span>
                        </div>
                        <Progress value={((team.current_students || 0) / (team.max_students || 20)) * 100} className="h-1.5" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={team.status === 'active' ? 'default' : 'secondary'}
                        className={`capitalize text-[10px] ${team.status === 'active' ? 'bg-green-500 hover:bg-green-600' : ''}`}
                      >
                        {team.status === 'active' ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => {
                            setSelectedTeamForEnroll(team);
                            setIsEnrollModalOpen(true);
                          }}
                          title="Gestionar Estudiantes"
                        >
                          <UserPlus className="h-4 w-4" />
                        </Button>
                        <PermissionGate permission="teams:edit">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
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
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Estadísticas">
                            <TrendingUp className="h-4 w-4" />
                          </Button>
                        </PermissionGate>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
                      {team.programs?.name || 'Independiente'}
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
                        title="Gestionar Estudiantes"
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
                  <Button variant="outline" className="h-8 w-8 p-0" size="sm" title="Detalles">
                    <Filter className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
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
    </div>
  );
}
