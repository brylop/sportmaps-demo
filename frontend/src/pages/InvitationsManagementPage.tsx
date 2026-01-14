import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Mail, UserPlus, Check, Clock, X as XIcon, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Invitation {
  id: string;
  invited_email: string;
  child_name: string;
  program_name: string;
  status: string;
  created_at: string;
}

export default function InvitationsManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    parentEmail: '',
    childName: '',
    programId: ''
  });

  // Demo invitations
  const demoInvitations: Invitation[] = [
    {
      id: '1',
      invited_email: 'maria.gonzalez@email.com',
      child_name: 'Mateo Pérez',
      program_name: 'Fútbol Sub-12',
      status: 'accepted',
      created_at: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: '2',
      invited_email: 'carlos.rodriguez@email.com',
      child_name: 'Laura Rodríguez',
      program_name: 'Tenis Infantil',
      status: 'pending',
      created_at: new Date(Date.now() - 172800000).toISOString()
    },
    {
      id: '3',
      invited_email: 'ana.martinez@email.com',
      child_name: 'Santiago Martínez',
      program_name: 'Natación Avanzada',
      status: 'pending',
      created_at: new Date(Date.now() - 259200000).toISOString()
    },
    {
      id: '4',
      invited_email: 'juan.perez@email.com',
      child_name: 'Valentina Pérez',
      program_name: 'Voleibol Juvenil',
      status: 'rejected',
      created_at: new Date(Date.now() - 345600000).toISOString()
    }
  ];

  const [invitations] = useState<Invitation[]>(demoInvitations);

  const demoPrograms = [
    { id: '1', name: 'Fútbol Sub-12' },
    { id: '2', name: 'Tenis Infantil' },
    { id: '3', name: 'Natación Avanzada' },
    { id: '4', name: 'Voleibol Juvenil' }
  ];

  const sendInvitationMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // This would call the edge function to send email
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invitation-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
          },
          body: JSON.stringify({
            to: data.parentEmail,
            parentName: data.parentEmail.split('@')[0],
            childName: data.childName,
            schoolName: 'Academia Deportiva Elite',
            programName: demoPrograms.find(p => p.id === data.programId)?.name || '',
            invitationLink: `${window.location.origin}/accept-invitation`
          })
        }
      );

      if (!response.ok) {
        throw new Error('Error enviando invitación');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      setDialogOpen(false);
      setFormData({ parentEmail: '', childName: '', programId: '' });
      toast({
        title: '✅ Invitación enviada',
        description: 'La invitación ha sido enviada por correo electrónico',
      });
    },
    onError: (error: any) => {
      toast({
        title: '❌ Error',
        description: error.message || 'No se pudo enviar la invitación',
        variant: 'destructive',
      });
    }
  });

  const resendInvitationMutation = useMutation({
    mutationFn: async (invitation: Invitation) => {
      // Resend invitation email
      toast({
        title: '📧 Reenviando invitación',
        description: `Enviando nueva invitación a ${invitation.invited_email}...`,
      });
      
      // Simulate API call
      return new Promise(resolve => setTimeout(resolve, 1000));
    },
    onSuccess: () => {
      toast({
        title: '✅ Invitación reenviada',
        description: 'La invitación ha sido reenviada exitosamente',
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendInvitationMutation.mutate(formData);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return (
          <Badge className="bg-green-500">
            <Check className="w-3 h-3 mr-1" />
            Aceptada
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1" />
            Pendiente
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive">
            <XIcon className="w-3 h-3 mr-1" />
            Rechazada
          </Badge>
        );
      default:
        return null;
    }
  };

  const stats = {
    total: invitations.length,
    accepted: invitations.filter(i => i.status === 'accepted').length,
    pending: invitations.filter(i => i.status === 'pending').length,
    rejected: invitations.filter(i => i.status === 'rejected').length
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Gestión de Invitaciones</h1>
          <p className="text-muted-foreground">
            Invita a padres para que inscriban a sus hijos en tus programas
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Nueva Invitación
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Invitaciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Aceptadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.accepted}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rechazadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* Invitations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Invitaciones Enviadas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email del Padre</TableHead>
                <TableHead>Nombre del Hijo</TableHead>
                <TableHead>Programa</TableHead>
                <TableHead>Fecha de Envío</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map((invitation) => (
                <TableRow key={invitation.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      {invitation.invited_email}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {invitation.child_name}
                  </TableCell>
                  <TableCell>{invitation.program_name}</TableCell>
                  <TableCell>
                    {format(new Date(invitation.created_at), 'PPP', { locale: es })}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(invitation.status)}
                  </TableCell>
                  <TableCell>
                    {invitation.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => resendInvitationMutation.mutate(invitation)}
                        disabled={resendInvitationMutation.isPending}
                      >
                        <Send className="w-4 h-4 mr-1" />
                        Reenviar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Invitation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar Nueva Invitación</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="parentEmail">Email del Padre/Tutor *</Label>
              <Input
                id="parentEmail"
                type="email"
                placeholder="padre@ejemplo.com"
                value={formData.parentEmail}
                onChange={(e) => setFormData({ ...formData, parentEmail: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="childName">Nombre del Hijo/a *</Label>
              <Input
                id="childName"
                placeholder="Ej: María Rodríguez"
                value={formData.childName}
                onChange={(e) => setFormData({ ...formData, childName: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="programId">Programa *</Label>
              <Select
                value={formData.programId}
                onValueChange={(value) => setFormData({ ...formData, programId: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar programa" />
                </SelectTrigger>
                <SelectContent>
                  {demoPrograms.map(program => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={sendInvitationMutation.isPending}
              >
                {sendInvitationMutation.isPending ? 'Enviando...' : 'Enviar Invitación'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
