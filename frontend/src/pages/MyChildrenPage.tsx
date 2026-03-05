import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/common/ErrorState';
import { Plus, Calendar, User, AlertTriangle, School, Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AddChildDialog } from '@/components/children/AddChildDialog';
import { EditChildDialog } from '@/components/children/EditChildDialog';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import { MedicalAlertBadge } from '@/components/common/MedicalAlertBadge';

export default function MyChildrenPage() {
  const { user } = useAuth();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingChild, setEditingChild] = useState<any | null>(null);



  const { data: children, isLoading, error, refetch } = useQuery({
    queryKey: ['children', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('children')
        .select('*, schools(name), teams!team_id(name, sport, level)')
        .eq('parent_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching children:', error);
        throw error;
      }
      return data;
    },
    enabled: !!user?.id,
  });

  // Demo data only for demo users
  const displayChildren = children || [];

  if (isLoading) {
    return <LoadingSpinner fullScreen text="Cargando tus hijos..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Error al cargar tus hijos"
        message="Hubo un problema al recuperar la información. Por favor, intenta de nuevo."
        onRetry={() => refetch()}
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
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Añadir Hijo
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {displayChildren?.map((child: any) => (
          <Card key={child.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12 border border-primary/10">
                    <AvatarImage src={child.avatar_url || ''} className="object-cover" />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-white font-semibold text-lg">
                      {child.full_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">{child.full_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {child.date_of_birth
                        ? new Date(child.date_of_birth + 'T00:00:00').toLocaleDateString('es-CO', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                        : 'Sin fecha de nacimiento'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Allergy Icon */}
                  <MedicalAlertBadge medicalInfo={child.medical_info} />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                    onClick={() => setEditingChild(child)}
                    title="Editar información"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                {child.teams && (
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <School className="w-4 h-4 text-muted-foreground" />
                    <span>{child.teams.name} {child.teams.level ? `(${child.teams.level})` : ''}</span>
                  </div>
                )}

                {child.teams?.sport && (
                  <Badge variant="secondary" className="text-[10px] px-2 py-0 h-5">
                    {child.teams.sport}
                  </Badge>
                )}

                {child.schools?.name && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span role="img" aria-label="academia">🏫</span>
                    <span>{child.schools.name}</span>
                  </div>
                )}

                {child.monthly_fee != null && child.monthly_fee > 0 && (
                  <div className="flex items-center gap-2 text-sm font-bold text-green-600 dark:text-green-500 pt-1">
                    <span role="img" aria-label="pago">💰</span>
                    <span>Mensualidad: {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(child.monthly_fee)}</span>
                  </div>
                )}
              </div>

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

      <AddChildDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={refetch}
      />

      {editingChild && (
        <EditChildDialog
          open={!!editingChild}
          onOpenChange={(open) => !open && setEditingChild(null)}
          onSuccess={refetch}
          child={editingChild}
        />
      )}
    </div>
  );
}
