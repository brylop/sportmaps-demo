import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/common/ErrorState';
import { Plus, Users, Calendar, DollarSign } from 'lucide-react';
import { CreateProgramDialog } from '@/components/programs/CreateProgramDialog';

export default function ProgramsManagementPage() {
  const { user } = useAuth();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Fetch user's profile to check role
  const { data: profile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch user's school
  const { data: school, isLoading: isLoadingSchool } = useQuery({
    queryKey: ['user-school', user?.id],
    queryFn: async () => {
      // First try to find school by owner_id
      const { data: ownedSchool, error: ownedError } = await supabase
        .from('schools')
        .select('*')
        .eq('owner_id', user?.id)
        .maybeSingle();

      if (ownedSchool) return ownedSchool;

      // If user has 'school' role but no linked school, try to find by profile name
      if (profile?.role === 'school') {
        const { data: matchingSchool, error: matchError } = await supabase
          .from('schools')
          .select('*')
          .ilike('name', `%${profile.full_name}%`)
          .maybeSingle();

        // If we found a matching school, link it to this user
        if (matchingSchool && !matchingSchool.owner_id) {
          const { error: updateError } = await supabase
            .from('schools')
            .update({ owner_id: user?.id })
            .eq('id', matchingSchool.id);

          if (!updateError) {
            return matchingSchool;
          }
        }
      }

      return null;
    },
    enabled: !!user?.id && !!profile,
  });

  // Fetch programs for the school
  const { data: programs, isLoading: isLoadingPrograms, error } = useQuery({
    queryKey: ['programs', school?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('programs')
        .select('*')
        .eq('school_id', school?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!school?.id,
  });

  const getCapacityBadge = (current: number, max: number | null) => {
    if (!max) return <Badge variant="secondary">Sin límite</Badge>;
    const percentage = (current / max) * 100;
    if (percentage === 100) return <Badge className="bg-red-500">Lleno</Badge>;
    if (percentage >= 80) return <Badge className="bg-yellow-500">Casi lleno</Badge>;
    return <Badge className="bg-green-500">Disponible</Badge>;
  };

  if (isLoadingSchool || isLoadingPrograms) {
    return <LoadingSpinner fullScreen text="Cargando programas..." />;
  }

  if (error) {
    return <ErrorState message="Error al cargar los programas" />;
  }

  if (!school && profile?.role === 'school') {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Perfil de Escuela sin Vincular</CardTitle>
            <CardDescription>
              Tu cuenta tiene permisos de escuela pero no está vinculada a ninguna escuela registrada. 
              Por favor contacta al administrador del sistema.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!school) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Acceso Restringido</CardTitle>
            <CardDescription>
              Solo los administradores de escuelas pueden acceder a esta sección.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Programas</h1>
          <p className="text-muted-foreground">
            Gestiona los programas deportivos de {school.name}
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Crear Nuevo Programa
        </Button>
      </div>

      {!programs || programs.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No hay programas</CardTitle>
            <CardDescription>
              Crea tu primer programa deportivo para comenzar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Crear Primer Programa
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {programs.map((program) => (
            <Card key={program.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{program.name}</CardTitle>
                    <CardDescription>{program.sport}</CardDescription>
                  </div>
                  <div className="flex flex-col gap-2">
                    {getCapacityBadge(
                      program.current_participants || 0,
                      program.max_participants
                    )}
                    {program.active ? (
                      <Badge className="bg-green-500">Activo</Badge>
                    ) : (
                      <Badge variant="secondary">Inactivo</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {program.description && (
                  <p className="text-sm text-muted-foreground">{program.description}</p>
                )}
                
                {program.max_participants && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Users className="mr-2 h-4 w-4" />
                    <span className="font-medium">Cupos:</span>
                    <span className="ml-2">
                      {program.current_participants || 0}/{program.max_participants}
                    </span>
                  </div>
                )}

                {program.schedule && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="mr-2 h-4 w-4" />
                    <span className="font-medium">Horario:</span>
                    <span className="ml-2">{program.schedule}</span>
                  </div>
                )}

                {program.age_min && program.age_max && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Users className="mr-2 h-4 w-4" />
                    <span className="font-medium">Edades:</span>
                    <span className="ml-2">
                      {program.age_min} - {program.age_max} años
                    </span>
                  </div>
                )}

                <div className="flex items-center text-sm text-muted-foreground">
                  <DollarSign className="mr-2 h-4 w-4" />
                  <span className="font-medium">Precio:</span>
                  <span className="ml-2">
                    ${program.price_monthly.toLocaleString()} / Mes
                  </span>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" size="sm" className="flex-1">
                    Editar
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1">
                    Ver Alumnos
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {school && (
        <CreateProgramDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          schoolId={school.id}
        />
      )}
    </div>
  );
}
