import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users, School, Activity, Settings, Shield, BarChart3, Search, MoreHorizontal, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';

interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
}

interface AdminSchool {
  id: string;
  name: string;
  city: string;
  verified: boolean;
  owner_email?: string;
}

export default function AdminPanelPage() {
  const { user } = useAuth(); // Aunque es ruta protegida, validamos acceso si es necesario
  const { toast } = useToast();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [schools, setSchools] = useState<AdminSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Stats state
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeSchools: 0,
    activityToday: 0,
    systemStatus: 'Online'
  });

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      setLoading(true);

      // Disparamos los 3 RPCs en paralelo. Todos usan SECURITY DEFINER y validan
      // is_super_admin() server-side, asi no chocamos con la RLS de profiles/schools.
      const [usersRes, schoolsRes, countsRes] = await Promise.all([
        supabase.rpc('admin_list_users' as any, {
          p_search: null, p_role: null, p_limit: 50, p_offset: 0,
        }),
        supabase.rpc('admin_list_schools_global' as any, {
          p_search: null, p_verified: null, p_limit: 20, p_offset: 0,
        }),
        supabase.rpc('admin_global_counts' as any),
      ]);

      if (usersRes.error)   throw usersRes.error;
      if (schoolsRes.error) throw schoolsRes.error;
      if (countsRes.error)  throw countsRes.error;

      const userRows = ((usersRes.data as any)?.rows ?? []) as Array<any>;
      setUsers(userRows.map((p) => ({
        id: p.id,
        full_name: p.full_name || 'Sin Nombre',
        email: p.email || '—',
        role: p.role,
        created_at: p.created_at,
      })));

      const schoolRows = ((schoolsRes.data as any)?.rows ?? []) as Array<any>;
      setSchools(schoolRows.map((s) => ({
        id: s.id,
        name: s.name,
        city: s.city,
        verified: s.verified,
        owner_email: s.owner_email,
      })));

      const counts = (countsRes.data as any) || {};
      setStats({
        totalUsers:    counts.total_users ?? 0,
        activeSchools: counts.total_schools ?? 0,
        activityToday: counts.payments_paid_30d ?? 0,
        systemStatus:  'Online',
      });
    } catch (error: any) {
      console.error('Error fetching admin data:', error);
      toast({
        title: 'Error de carga',
        description: error?.message?.includes('Forbidden')
          ? 'Tu cuenta no es super-admin de plataforma.'
          : 'No se pudieron cargar los datos del panel administrativo.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u =>
    u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <LoadingSpinner fullScreen text="Cargando panel de administración..." />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Panel de Administración</h1>
          <p className="text-muted-foreground mt-1">
            Gestión completa del sistema SportMaps
          </p>
        </div>
        <Link to="/admin/activity-logs">
          <Button variant="outline" className="gap-2">
            <FileText className="h-4 w-4" />
            Logs y actividad global
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Usuarios</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">Registrados en la plataforma</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Escuelas</CardTitle>
            <School className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeSchools}</div>
            <p className="text-xs text-muted-foreground">Centros deportivos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actividad Hoy</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activityToday}</div>
            <p className="text-xs text-muted-foreground">Sesiones activas (Est.)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sistema</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.systemStatus}</div>
            <p className="text-xs text-muted-foreground">Servicios operativos</p>
          </CardContent>
        </Card>
      </div>

      {/* Users Table Section */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle>Gestión de Usuarios</CardTitle>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuarios..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Fecha Registro</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No se encontraron usuarios
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{u.full_name}</span>
                          <span className="text-xs text-muted-foreground">{u.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {u.role.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(u.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Abrir menú</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(u.id)}>
                              Copiar ID
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>Ver Detalles</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">Desactivar Cuenta</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Schools Table Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Escuelas Recientes</CardTitle>
            <Button size="sm" variant="outline">
              <School className="w-4 h-4 mr-2" />
              Ver Todas
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schools.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                    No hay escuelas registradas
                  </TableCell>
                </TableRow>
              ) : (
                schools.map((school) => (
                  <TableRow key={school.id}>
                    <TableCell className="font-medium">{school.name}</TableCell>
                    <TableCell>{school.city}</TableCell>
                    <TableCell>
                      <Badge variant={school.verified ? 'default' : 'secondary'}>
                        {school.verified ? 'Verificada' : 'Pendiente'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">Gestionar</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* System Config Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Configuración del Sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start">
              Configuración General
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Notificaciones Globales
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Integraciones de Pagos
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Seguridad y Auditoría
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start">
              Ver Logs del Sistema
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Reportes de Seguridad
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Gestión de Roles
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
