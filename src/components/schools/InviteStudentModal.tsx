import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Mail, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const emailSchema = z.string().trim().email('Email inválido').max(255);

interface InviteStudentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string;
}

export function InviteStudentModal({ open, onOpenChange, schoolId }: InviteStudentModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [selectedChild, setSelectedChild] = useState<string | null>(null);

  // Fetch user's children (profiles linked to the account)
  const { data: children, isLoading: isLoadingChildren } = useQuery({
    queryKey: ['user-children', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('children')
        .select('*')
        .eq('parent_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && open,
  });

  // Mutation for inviting by email
  const inviteByEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      // Validate email
      const validation = emailSchema.safeParse(email);
      if (!validation.success) {
        throw new Error('Email inválido');
      }

      if (!user?.id) {
        throw new Error('Usuario no autenticado');
      }

      const { error } = await supabase.from('student_invitations').insert({
        school_id: schoolId,
        invited_email: email.trim().toLowerCase(),
        invited_by: user.id,
        status: 'pending',
      });

      if (error) {
        if (error.code === '23505') {
          throw new Error('Ya existe una invitación para este email');
        }
        throw error;
      }
    },
    onSuccess: () => {
      toast.success('Invitación enviada exitosamente');
      queryClient.invalidateQueries({ queryKey: ['student-invitations', schoolId] });
      setInviteEmail('');
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error sending invitation:', error);
      toast.error('Error al enviar la invitación');
    },
  });

  // Mutation for inviting existing profile
  const inviteChildMutation = useMutation({
    mutationFn: async (childId: string) => {
      // Verify child belongs to current user
      const { data: child } = await supabase
        .from('children')
        .select('parent_id')
        .eq('id', childId)
        .single();

      if (!child || child.parent_id !== user?.id) {
        throw new Error('No tienes permiso para invitar este perfil');
      }

      const { error } = await supabase.from('student_invitations').insert({
        school_id: schoolId,
        child_id: childId,
        invited_by: user?.id,
        status: 'pending',
      });

      if (error) throw error;

      // Create notification for parent
      await supabase.from('notifications').insert({
        user_id: user?.id,
        title: 'Invitación enviada',
        message: `Se ha enviado una invitación a la escuela deportiva`,
        type: 'success',
      });
    },
    onSuccess: () => {
      toast.success('Invitación enviada exitosamente');
      queryClient.invalidateQueries({ queryKey: ['student-invitations', schoolId] });
      setSelectedChild(null);
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error sending invitation:', error);
      toast.error('Error al enviar la invitación');
    },
  });

  const handleInviteByEmail = () => {
    const validation = emailSchema.safeParse(inviteEmail);
    if (!validation.success) {
      toast.error('Por favor ingresa un email válido');
      return;
    }
    inviteByEmailMutation.mutate(inviteEmail);
  };

  const handleInviteChild = () => {
    if (!selectedChild) {
      toast.error('Por favor selecciona un perfil');
      return;
    }
    inviteChildMutation.mutate(selectedChild);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Invitar Estudiante
          </DialogTitle>
          <DialogDescription>
            Invita estudiantes a unirse a tu escuela mediante email o selecciona de tus perfiles existentes
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="email" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="email">
              <Mail className="w-4 h-4 mr-2" />
              Por Email
            </TabsTrigger>
            <TabsTrigger value="profiles">
              <Users className="w-4 h-4 mr-2" />
              Perfiles Existentes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email del estudiante registrado</Label>
              <Input
                id="email"
                type="email"
                placeholder="estudiante@ejemplo.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                El estudiante debe tener una cuenta registrada en la plataforma
              </p>
            </div>

            <Button
              onClick={handleInviteByEmail}
              disabled={inviteByEmailMutation.isPending || !inviteEmail}
              className="w-full"
            >
              {inviteByEmailMutation.isPending ? 'Enviando...' : 'Enviar Invitación'}
            </Button>
          </TabsContent>

          <TabsContent value="profiles" className="space-y-4 mt-4">
            {isLoadingChildren ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : !children || children.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No tienes perfiles registrados</p>
                    <p className="text-sm mt-1">
                      Agrega hijos o perfiles en la sección "Mis Hijos"
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {children.map((child) => (
                    <Card
                      key={child.id}
                      className={`cursor-pointer transition-all ${
                        selectedChild === child.id
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedChild(child.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>
                              {child.full_name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <h4 className="font-semibold">{child.full_name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {new Date(child.date_of_birth).toLocaleDateString('es-CO', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}
                            </p>
                          </div>
                          {child.sport && (
                            <Badge variant="secondary">{child.sport}</Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Button
                  onClick={handleInviteChild}
                  disabled={inviteChildMutation.isPending || !selectedChild}
                  className="w-full"
                >
                  {inviteChildMutation.isPending ? 'Enviando...' : 'Enviar Invitación'}
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
