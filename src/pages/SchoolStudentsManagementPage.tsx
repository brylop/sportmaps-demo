import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { InviteStudentModal } from '@/components/schools/InviteStudentModal';
import { UserPlus, Clock, CheckCircle2, XCircle } from 'lucide-react';

export default function SchoolStudentsManagementPage() {
  const { user } = useAuth();
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Fetch user's school
  const { data: school, isLoading: isLoadingSchool } = useQuery({
    queryKey: ['user-school', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .eq('owner_id', user?.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch invitations for the school
  const { data: invitations, isLoading: isLoadingInvitations } = useQuery({
    queryKey: ['student-invitations', school?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_invitations')
        .select(`
          *,
          children (
            id,
            full_name,
            date_of_birth,
            sport,
            avatar_url
          )
        `)
        .eq('school_id', school?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!school?.id,
  });

  const pendingInvitations = invitations?.filter(inv => inv.status === 'pending') || [];
  const acceptedInvitations = invitations?.filter(inv => inv.status === 'accepted') || [];
  const rejectedInvitations = invitations?.filter(inv => inv.status === 'rejected') || [];

  if (isLoadingSchool || isLoadingInvitations) {
    return <LoadingSpinner fullScreen text="Cargando estudiantes..." />;
  }

  if (!school) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>No tienes una escuela registrada</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Debes registrar una escuela primero para poder gestionar estudiantes
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Estudiantes</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona las invitaciones y estudiantes de {school.name}
          </p>
        </div>
        <Button onClick={() => setShowInviteModal(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Invitar Estudiante
        </Button>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending">
            <Clock className="w-4 h-4 mr-2" />
            Pendientes ({pendingInvitations.length})
          </TabsTrigger>
          <TabsTrigger value="accepted">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Aceptadas ({acceptedInvitations.length})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            <XCircle className="w-4 h-4 mr-2" />
            Rechazadas ({rejectedInvitations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          {pendingInvitations.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No hay invitaciones pendientes"
              description="Las invitaciones que envíes aparecerán aquí hasta que sean aceptadas o rechazadas"
              actionLabel="Invitar Estudiante"
              onAction={() => setShowInviteModal(true)}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pendingInvitations.map((invitation) => (
                <Card key={invitation.id}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {invitation.children
                            ? invitation.children.full_name.charAt(0)
                            : invitation.invited_email?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <CardTitle className="text-base">
                          {invitation.children
                            ? invitation.children.full_name
                            : invitation.invited_email}
                        </CardTitle>
                        <Badge variant="secondary" className="mt-1">
                          <Clock className="w-3 h-3 mr-1" />
                          Pendiente
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {invitation.children && (
                      <div className="space-y-2 text-sm">
                        <p className="text-muted-foreground">
                          Fecha de nacimiento:{' '}
                          {new Date(invitation.children.date_of_birth).toLocaleDateString('es-CO')}
                        </p>
                        {invitation.children.sport && (
                          <Badge variant="outline">{invitation.children.sport}</Badge>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-3">
                      Enviada {new Date(invitation.created_at).toLocaleDateString('es-CO')}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="accepted" className="mt-6">
          {acceptedInvitations.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No hay invitaciones aceptadas"
              description="Los estudiantes que acepten tu invitación aparecerán aquí"
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {acceptedInvitations.map((invitation) => (
                <Card key={invitation.id}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {invitation.children
                            ? invitation.children.full_name.charAt(0)
                            : invitation.invited_email?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <CardTitle className="text-base">
                          {invitation.children
                            ? invitation.children.full_name
                            : invitation.invited_email}
                        </CardTitle>
                        <Badge className="mt-1 bg-green-500">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Aceptada
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {invitation.children && (
                      <div className="space-y-2 text-sm">
                        <p className="text-muted-foreground">
                          Fecha de nacimiento:{' '}
                          {new Date(invitation.children.date_of_birth).toLocaleDateString('es-CO')}
                        </p>
                        {invitation.children.sport && (
                          <Badge variant="outline">{invitation.children.sport}</Badge>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-3">
                      Aceptada {new Date(invitation.updated_at).toLocaleDateString('es-CO')}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="rejected" className="mt-6">
          {rejectedInvitations.length === 0 ? (
            <EmptyState
              icon={XCircle}
              title="No hay invitaciones rechazadas"
              description="Las invitaciones rechazadas aparecerán aquí"
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {rejectedInvitations.map((invitation) => (
                <Card key={invitation.id}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {invitation.children
                            ? invitation.children.full_name.charAt(0)
                            : invitation.invited_email?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <CardTitle className="text-base">
                          {invitation.children
                            ? invitation.children.full_name
                            : invitation.invited_email}
                        </CardTitle>
                        <Badge variant="destructive" className="mt-1">
                          <XCircle className="w-3 h-3 mr-1" />
                          Rechazada
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Rechazada {new Date(invitation.updated_at).toLocaleDateString('es-CO')}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <InviteStudentModal
        open={showInviteModal}
        onOpenChange={setShowInviteModal}
        schoolId={school.id}
      />
    </div>
  );
}
