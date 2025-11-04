import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { CheckCircle2, XCircle, School } from 'lucide-react';
import { toast } from 'sonner';

export function PendingInvitations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch pending invitations for user's children
  const { data: invitations, isLoading } = useQuery({
    queryKey: ['pending-invitations', user?.id],
    queryFn: async () => {
      // First get user's children
      const { data: children, error: childrenError } = await supabase
        .from('children')
        .select('id')
        .eq('parent_id', user?.id);

      if (childrenError) throw childrenError;
      if (!children || children.length === 0) return [];

      const childIds = children.map(c => c.id);

      // Then get invitations for those children
      const { data, error } = await supabase
        .from('student_invitations')
        .select(`
          *,
          schools (
            id,
            name,
            logo_url,
            address,
            city
          ),
          children (
            id,
            full_name,
            date_of_birth,
            sport
          )
        `)
        .in('child_id', childIds)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const respondToInvitationMutation = useMutation({
    mutationFn: async ({ invitationId, status }: { invitationId: string; status: 'accepted' | 'rejected' }) => {
      const { error } = await supabase
        .from('student_invitations')
        .update({ status })
        .eq('id', invitationId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(
        variables.status === 'accepted'
          ? 'Invitación aceptada exitosamente'
          : 'Invitación rechazada'
      );
      queryClient.invalidateQueries({ queryKey: ['pending-invitations'] });
    },
    onError: (error) => {
      console.error('Error responding to invitation:', error);
      toast.error('Error al procesar la invitación');
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  if (!invitations || invitations.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Invitaciones Pendientes</h2>
        <p className="text-muted-foreground">
          Tienes {invitations.length} invitación{invitations.length !== 1 ? 'es' : ''} de escuelas deportivas
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {invitations.map((invitation) => (
          <Card key={invitation.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <School className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      {invitation.schools?.name || 'Escuela Deportiva'}
                    </CardTitle>
                    <CardDescription>
                      {invitation.schools?.city}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="secondary">Pendiente</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium">Invitación para:</p>
                <p className="text-sm text-muted-foreground">
                  {invitation.children?.full_name}
                  {invitation.children?.sport && ` - ${invitation.children.sport}`}
                </p>
              </div>

              {invitation.schools?.address && (
                <p className="text-sm text-muted-foreground">
                  📍 {invitation.schools.address}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  className="flex-1 bg-green-500 hover:bg-green-600"
                  onClick={() =>
                    respondToInvitationMutation.mutate({
                      invitationId: invitation.id,
                      status: 'accepted',
                    })
                  }
                  disabled={respondToInvitationMutation.isPending}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Aceptar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() =>
                    respondToInvitationMutation.mutate({
                      invitationId: invitation.id,
                      status: 'rejected',
                    })
                  }
                  disabled={respondToInvitationMutation.isPending}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Rechazar
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Recibida {new Date(invitation.created_at).toLocaleDateString('es-CO', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
