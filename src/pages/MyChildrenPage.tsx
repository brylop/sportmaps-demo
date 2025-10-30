import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/common/ErrorState';
import { Plus, Calendar, User, School } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function MyChildrenPage() {
  const { user } = useAuth();

  const { data: children, isLoading, error, refetch } = useQuery({
    queryKey: ['children', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('children')
        .select('*')
        .eq('parent_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return <LoadingSpinner fullScreen text="Cargando tus hijos..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Error al cargar"
        message="No pudimos cargar la información de tus hijos"
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mis Hijos</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona la información de tus hijos y sus actividades deportivas
          </p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Añadir Hijo
        </Button>
      </div>

      {children && children.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <School className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No hay hijos registrados</h3>
            <p className="text-muted-foreground mb-4">
              Comienza agregando información sobre tus hijos
            </p>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Añadir Primer Hijo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {children?.map((child) => (
            <Card key={child.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-semibold text-lg">
                      {child.full_name.charAt(0)}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{child.full_name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {new Date(child.date_of_birth).toLocaleDateString('es-CO', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {child.team_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <School className="w-4 h-4 text-muted-foreground" />
                    <span>{child.team_name}</span>
                  </div>
                )}
                {child.sport && (
                  <Badge variant="secondary">{child.sport}</Badge>
                )}
                <div className="pt-3 space-y-2">
                  <Link to={`/children/${child.id}/progress`}>
                    <Button variant="outline" size="sm" className="w-full">
                      <User className="w-4 h-4 mr-2" />
                      Ver Progreso
                    </Button>
                  </Link>
                  <Link to={`/children/${child.id}/attendance`}>
                    <Button variant="outline" size="sm" className="w-full">
                      <Calendar className="w-4 h-4 mr-2" />
                      Ver Asistencias
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
